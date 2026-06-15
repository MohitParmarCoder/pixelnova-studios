'use strict';
// Automated E2E: drives the real game in headless Chromium.
//
// Usage:
//   1. Serve the game:  npx serve -p 8080 orbit-hopper   (or python3 -m http.server)
//   2. Run:             NODE_PATH=$(npm root -g) node orbit-hopper/test/e2e.js
//
// Asserts: zero console errors, canvas actually renders pixels, full state
// machine works across 3 runs, FPS >= 50, localStorage persistence,
// interstitial frequency cap.

const { chromium } = require('playwright');

const URL = process.env.GAME_URL || 'http://localhost:8080/';
const results = [];
const fail = msg => { results.push(['FAIL', msg]); };
const pass = msg => { results.push(['PASS', msg]); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Set RECORD_DIR to also capture a .webm video of the whole session
  const ctxOpts = { viewport: { width: 390, height: 844 } };
  if (process.env.RECORD_DIR)
    ctxOpts.recordVideo = { dir: process.env.RECORD_DIR, size: { width: 390, height: 844 } };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();

  const consoleErrors = [];
  const adLogs = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    if (m.text().startsWith('[Ads]')) adLogs.push(m.text());
  });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  loadMs < 2000 ? pass(`load time ${loadMs} ms (< 2000 ms budget)`)
                : fail(`load time ${loadMs} ms exceeds 2 s budget`);

  await page.waitForTimeout(800);

  // 1. Canvas actually renders (non-uniform pixels)
  const rendered = await page.evaluate(() => {
    const c = document.getElementById('gameCanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const first = [d[0], d[1], d[2]];
    for (let i = 4; i < d.length; i += 4)
      if (d[i] !== first[0] || d[i+1] !== first[1] || d[i+2] !== first[2]) return true;
    return false;
  });
  rendered ? pass('canvas renders non-blank frame') : fail('canvas is blank');

  // 2. Initial state is MENU
  const state0 = await page.evaluate(() => Game.getState());
  state0 === 'MENU' ? pass('boots into MENU') : fail(`boot state ${state0}, expected MENU`);

  // 3. FPS over 2 s on menu
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const start = performance.now();
    (function tick() {
      n++;
      if (performance.now() - start < 2000) requestAnimationFrame(tick);
      else res(Math.round(n / 2));
    })();
  }));
  fps >= 50 ? pass(`steady FPS ${fps} (>= 50)`) : fail(`FPS ${fps} below 50`);

  // 4. Play 3 full runs: tap to start, spam launches until death, retry
  const waitState = async (want, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await page.evaluate(() => Game.getState()) === want) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };

  for (let run = 1; run <= 3; run++) {
    await page.mouse.click(195, 422);                      // start / retry
    (await waitState('PLAYING', 3000))
      ? pass(`run ${run}: entered PLAYING`)
      : fail(`run ${run}: never entered PLAYING`);

    // Launch repeatedly until the run ends (max ~60 s)
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => Game.getState());
      if (s === 'DYING' || s === 'RESULTS') break;
      await page.mouse.click(195, 422);
      await page.waitForTimeout(450);
    }
    (await waitState('RESULTS', 8000))
      ? pass(`run ${run}: reached RESULTS (score ${await page.evaluate(() => Game.getScore())})`)
      : fail(`run ${run}: never reached RESULTS`);

    // Tap retry button (results panel: retry at ~62 % width)
    await page.mouse.click(242, 344);
    await page.waitForTimeout(400);
  }

  // 5. Interstitial frequency cap: in 3 runs expect skip logs, max one shown
  const shown = adLogs.filter(l => l.includes('Showing interstitial')).length;
  const skipped = adLogs.filter(l => l.includes('Interstitial skipped')).length;
  shown <= 1 && skipped >= 1
    ? pass(`interstitial cap holds (${shown} shown, ${skipped} skipped over 3 runs)`)
    : fail(`interstitial cap broken (${shown} shown, ${skipped} skipped)`);

  // 6. localStorage persistence
  const ls = await page.evaluate(() => ({
    best: localStorage.getItem('orbit_best'),
    runs: localStorage.getItem('orbit_runs'),
  }));
  ls.runs && parseInt(ls.runs) >= 3 ? pass(`orbit_runs persisted (${ls.runs})`)
                                    : fail(`orbit_runs wrong: ${ls.runs}`);
  ls.best !== null ? pass(`orbit_best persisted (${ls.best})`)
                   : fail('orbit_best missing');

  // 7. Mute toggle persists
  await page.mouse.click(370, 25);
  await page.waitForTimeout(200);
  const muted = await page.evaluate(() => localStorage.getItem('orbit_muted'));
  muted === '1' ? pass('mute toggle persisted to localStorage')
                : fail(`orbit_muted = ${muted}, expected '1'`);

  // 8. Zero console errors throughout
  consoleErrors.length === 0
    ? pass('zero console errors across all runs')
    : fail(`console errors: ${consoleErrors.join(' | ')}`);

  await context.close();
  await browser.close();

  // ── Report ──
  console.log('\n══════ E2E RESULTS ══════');
  let failed = 0;
  for (const [status, msg] of results) {
    console.log(`  ${status === 'PASS' ? '✓' : '✗'} ${msg}`);
    if (status === 'FAIL') failed++;
  }
  console.log(`══════ ${results.length - failed}/${results.length} passed ══════\n`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('E2E crashed:', e); process.exit(1); });
