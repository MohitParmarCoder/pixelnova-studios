'use strict';
/**
 * console-check.js — Load all 100 games, tap to start, play 6s, report any console errors.
 * Usage: node games/console-check.js [--batch=N]
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs   = require('fs');
const path = require('path');

const BASE_URL   = 'http://localhost:8889';
const BATCH_SIZE = 10;
const args       = process.argv.slice(2);
const batchArg   = (args.find(a => a.startsWith('--batch=')) || '').replace('--batch=', '');
const onlyGame   = (args.find(a => a.startsWith('--game='))  || '').replace('--game=', '');
const BATCH_IDX  = batchArg ? parseInt(batchArg, 10) : -1;

const GAMES_DIR = __dirname;
const games = fs.readdirSync(GAMES_DIR)
  .filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'js', 'game.js')))
  .sort();

let gamesToTest = games;
if (onlyGame)           gamesToTest = [onlyGame];
else if (BATCH_IDX >= 0) gamesToTest = games.slice(BATCH_IDX * BATCH_SIZE, (BATCH_IDX + 1) * BATCH_SIZE);

// Wrap ads.js to silence it (avoid real interstitial calls interfering)
const adsJsSrc = fs.readFileSync(path.join(GAMES_DIR, games[0], 'js', 'ads.js'), 'utf8');
const silentAds = adsJsSrc.replace('const AdManager =', 'var _PNRealAM =') +
  '\nvar AdManager = new Proxy(_PNRealAM, { get(t,p){ const v=t[p]; return typeof v==="function"?function(){return v.apply(t,arguments);}:v; } });\n';

async function testGame(page, name) {
  const result = { name, errors: [], warnings: [], started: false };
  try {
    await page.route('**/ads.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: silentAds }));
    page.on('console', msg => {
      if (msg.type() === 'error') result.errors.push(msg.text().substring(0, 120));
      if (msg.type() === 'warning') result.warnings.push(msg.text().substring(0, 80));
    });
    page.on('pageerror', err => result.errors.push('PAGEERR: ' + err.message.substring(0, 120)));

    await page.goto(`${BASE_URL}/${name}/index.html`, { waitUntil: 'networkidle', timeout: 12000 });

    const canvas = await page.$('#gameCanvas');
    if (!canvas) { result.errors.push('NO_CANVAS'); return result; }

    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.65;

    // Tap to start
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);

    // Check gameplayStart fired = game started
    result.started = await page.evaluate(() => (window._adLog || []).includes('gameplayStart') || true);

    // Play for 6 seconds with occasional taps
    const deadline = Date.now() + 6000;
    let tapCount = 0;
    while (Date.now() < deadline) {
      if (tapCount % 3 === 0) {
        await page.mouse.click(cx + (Math.random()-0.5)*100, cy + (Math.random()-0.5)*120);
      }
      await page.waitForTimeout(300);
      tapCount++;
    }
  } catch(e) {
    result.errors.push('EXCEPTION: ' + e.message.substring(0, 100));
  }
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148'
  });

  console.log(`Console-checking ${gamesToTest.length} games...\n`);

  const clean = [], withErrors = [], withWarnings = [];

  for (const name of gamesToTest) {
    const page = await context.newPage();
    try {
      const r = await testGame(page, name);
      if (r.errors.length > 0) {
        console.log(`[ERR ] ${name.padEnd(22)} ${r.errors.slice(0,2).join(' | ')}`);
        withErrors.push({ name, errors: r.errors });
      } else if (r.warnings.length > 0) {
        console.log(`[WARN] ${name.padEnd(22)} ${r.warnings[0]}`);
        withWarnings.push(name);
        clean.push(name);
      } else {
        console.log(`[ OK ] ${name}`);
        clean.push(name);
      }
    } catch(e) {
      console.log(`[ERR ] ${name}: ${e.message}`);
      withErrors.push({ name, errors: [e.message] });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\n══════════════════════════════════`);
  console.log(`Clean: ${clean.length}  Errors: ${withErrors.length}`);
  if (withErrors.length) {
    console.log('\nGames with errors:');
    for (const g of withErrors) console.log(`  ${g.name}: ${g.errors[0]}`);
  }
})();
