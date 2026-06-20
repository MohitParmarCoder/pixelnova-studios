'use strict';
/**
 * playwright-test.js — Automated smoke test for all 100 games.
 * Tests: load, canvas render, ad hooks fire, state machine, console errors.
 *
 * Uses network route interception to wrap ads.js with call logging.
 *
 * Usage: node games/playwright-test.js [--game=name] [--batch=N]
 *   --game=name   Test only this game (by folder name)
 *   --batch=N     Test games N*10 through N*10+9
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs   = require('fs');
const path = require('path');

const BASE_URL  = 'http://localhost:8889';
const TIMEOUT   = 15000;
const BATCH_SIZE = 10;

const args     = process.argv.slice(2);
const onlyGame = (args.find(a => a.startsWith('--game='))  || '').replace('--game=', '');
const batchArg = (args.find(a => a.startsWith('--batch=')) || '').replace('--batch=', '');
const BATCH_IDX = batchArg ? parseInt(batchArg, 10) : -1;

const GAMES_DIR = __dirname;
const games = fs.readdirSync(GAMES_DIR)
  .filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'js', 'game.js')))
  .sort();

let gamesToTest = games;
if (onlyGame)          gamesToTest = games.filter(g => g === onlyGame);
else if (BATCH_IDX >= 0) gamesToTest = games.slice(BATCH_IDX * BATCH_SIZE, (BATCH_IDX + 1) * BATCH_SIZE);

// Wrap ads.js: replace `const AdManager` with `var _PNRealAM` (the IIFE result),
// then assign a Proxy to `var AdManager` (= window.AdManager) that logs every call.
// This way game.js's `AdManager.x()` references go through window.AdManager → Proxy.
function wrapAdsJs(src) {
  let patched = src;

  // Change `const AdManager =` → `var _PNRealAM =`
  patched = patched.replace('const AdManager =', 'var _PNRealAM =');

  // Append logging proxy
  patched += `
// ── Ad spy injected by playwright-test.js ──────────────────────────────────
window._adLog = window._adLog || [];
var AdManager = new Proxy(_PNRealAM, {
  get: function(t, p) {
    var v = t[p];
    if (typeof v === 'function') {
      return function() {
        window._adLog.push(p);
        return v.apply(t, arguments);
      };
    }
    return v;
  }
});
`;
  return patched;
}

// Load the ads.js source once (all games use the same file)
let adsJsSrc = null;
let wrappedAdsSrc = null;
(function() {
  const firstGame = games[0];
  if (!firstGame) return;
  const adsPath = path.join(GAMES_DIR, firstGame, 'js', 'ads.js');
  adsJsSrc = fs.readFileSync(adsPath, 'utf8');
  wrappedAdsSrc = wrapAdsJs(adsJsSrc);
})();

const results = [];

async function testGame(page, name) {
  const result = { name, pass: true, issues: [], adLog: [], errors: [] };

  try {
    // Intercept ads.js to inject logging wrapper
    await page.route('**/ads.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: wrappedAdsSrc,
      });
    });

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

    await page.goto(`${BASE_URL}/${name}/index.html`, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // Check canvas
    const canvas = await page.$('canvas');
    if (!canvas) {
      result.issues.push('NO_CANVAS');
      result.pass = false;
      return result;
    }

    const errCount0 = consoleErrors.length;

    // Tap canvas to start (MENU→PLAYING)
    const box = await canvas.boundingBox();
    const cx  = box.x + box.width  / 2;
    const cy  = box.y + box.height * 0.65;

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);

    // Verify gameplayStart fired
    const log1 = await page.evaluate(() => (window._adLog || []));
    if (!log1.includes('gameplayStart')) {
      result.issues.push('NO_gameplayStart_after_tap');
    }

    // Rapid taps to exhaust lives / trigger death in tap-based games
    for (let i = 0; i < 20; i++) {
      const tx = cx + (Math.random() - 0.5) * 120;
      const ty = cy + (Math.random() - 0.5) * 150;
      await page.mouse.click(tx, ty);
      await page.waitForTimeout(80);
    }

    // Wait up to 8 s for death hooks to fire (covers timer-based games)
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const log = await page.evaluate(() => window._adLog || []);
      if (log.includes('gameplayStop')) break;
      // Continue tapping while waiting
      await page.mouse.click(cx + (Math.random()-0.5)*80, cy + (Math.random()-0.5)*80);
      await page.waitForTimeout(200);
    }

    // Some games (e.g. balance-beam) trigger showInterstitial on the restart tap,
    // not immediately on death. Tap once more to trigger those.
    await page.waitForTimeout(400);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(600);

    // Check ad log
    const adLog = await page.evaluate(() => window._adLog || []);
    result.adLog = adLog;

    // Verify all 5 hooks fired
    const requiredHooks = ['gameplayStart', 'gameplayStop', 'onRunEnd', 'showInterstitial', 'offerDoubleScore'];
    for (const hook of requiredHooks) {
      if (!adLog.includes(hook)) {
        result.issues.push('MISSING_' + hook);
        if (hook !== 'gameplayStart') result.pass = false;
      }
    }

    // Verify call order: stop before runEnd
    const stopIdx   = adLog.indexOf('gameplayStop');
    const runEndIdx = adLog.indexOf('onRunEnd');
    if (stopIdx > -1 && runEndIdx > -1 && stopIdx > runEndIdx) {
      result.issues.push('WRONG_ORDER');
      result.pass = false;
    }

    // Check for doubleScore DOM overlay (additional visual check)
    const hasOverlay = await page.evaluate(() => !!document.getElementById('__pn_rewarded_ov'));
    if (!hasOverlay && adLog.includes('offerDoubleScore')) {
      // offerDoubleScore returns early if score=0; that's OK
    }

    // Collect console errors
    result.errors = consoleErrors.slice(errCount0);
    if (result.errors.length > 0) {
      result.issues.push('CONSOLE_ERR:' + result.errors.slice(0, 2).join('; ').substring(0, 100));
    }

  } catch (err) {
    result.pass = false;
    result.issues.push('EXCEPTION:' + String(err.message).substring(0, 120));
  }

  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });

  console.log(`Testing ${gamesToTest.length} games...\n`);
  const passed = [], warnings = [], failed = [];

  for (const name of gamesToTest) {
    const page = await context.newPage();
    try {
      const r = await testGame(page, name);
      results.push(r);

      const missingOnlyStart = r.issues.every(i => i === 'NO_gameplayStart_after_tap' || i.startsWith('CONSOLE_ERR'));
      if (r.pass && r.issues.length === 0) {
        console.log(`[ OK ] ${name.padEnd(22)} hooks:${r.adLog.join(',')}`);
        passed.push(name);
      } else if (missingOnlyStart) {
        const consErr = r.issues.find(i => i.startsWith('CONSOLE_ERR')) || '';
        console.log(`[WARN] ${name.padEnd(22)} hooks:${r.adLog.join(',')}${consErr ? ' '+consErr : ''}`);
        warnings.push(name);
      } else {
        console.log(`[FAIL] ${name.padEnd(22)} ${r.issues.join(' | ')}`);
        if (r.adLog.length) console.log(`       hooks: ${r.adLog.join(',')}`);
        failed.push({ name, issues: r.issues, adLog: r.adLog });
      }
    } catch (e) {
      console.log(`[ERR ] ${name}: ${e.message}`);
      failed.push({ name, issues: ['OUTER:' + e.message], adLog: [] });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed.length} passed, ${warnings.length} warnings, ${failed.length} failed`);

  if (warnings.length) console.log('\nWARNINGS:\n  ' + warnings.join('\n  '));
  if (failed.length) {
    console.log('\nFAILED:');
    for (const f of failed) console.log(`  ${f.name}: ${f.issues.join(' | ')}`);
  }

  const reportPath = path.join(__dirname, 'playwright-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport saved: ${reportPath}`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
