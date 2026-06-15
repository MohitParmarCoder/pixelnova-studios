'use strict';
/* Headless smoke test for all games in this folder.
   Mocks a 2D canvas + Audio/AdManager globals, loads each game's
   game.js, then drives init/tap/update/draw for a few seconds of
   simulated time. Fails loudly on any thrown error.

   Run:  node games/smoke-test.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── Mock 2D context ────────────────────────────────────────────────────────────
function mockCtx() {
  const noop = () => {};
  return new Proxy({
    canvas: { width: 390, height: 844 },
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: [] }),
  }, {
    get(t, p) {
      if (p in t) return t[p];
      // every other property is a no-op function or writable scalar
      return typeof p === 'string' ? noop : undefined;
    },
    set() { return true; },
  });
}

function mockCanvas() {
  const ctx = mockCtx();
  return {
    width: 390, height: 844, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

// ── Shared sandbox globals ─────────────────────────────────────────────────────
function makeSandbox() {
  const store = {};
  const sandbox = {
    Math, Date, JSON, console, performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    Audio: { init() {}, play() {}, setMuted() {}, isMuted() { return false; }, toggle() {} },
    AdManager: {
      init() {}, gameplayStart() {}, gameplayStop() {},
      showInterstitial(cb) { if (cb) cb(); },
      showRewarded(ok, skip) { if (skip) skip(); },
      onRunEnd() {},
    },
    window: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const doc = {
    body: { dataset: {} },
    getElementById: () => mockCanvas(),
    addEventListener: () => {}, removeEventListener: () => {},
    createElement: () => mockCanvas(),
    hidden: false,
  };
  sandbox.document = doc;
  return sandbox;
}

// Each game exposes a different global + input method.
const GAMES = [
  { dir: 'stack-tower',   global: 'StackTower',  tap: (g) => g.tap() },
  { dir: 'color-switch',  global: 'ColorSwitch', tap: (g) => g.tap() },
  { dir: 'gravity-flip',  global: 'GravityFlip', tap: (g) => g.tap() },
  { dir: 'neon-snake',    global: 'NeonSnake',   tap: (g) => g.swipe(1, 0) },
  { dir: 'tap-blast',     global: 'TapBlast',    tap: (g) => g.tap(195, 422) },
  { dir: 'dodge-rush',    global: 'DodgeRush',   tap: (g) => { g.tap(); g.setPlayerX(180); } },
  { dir: 'block-breaker', global: 'BlockBreaker',tap: (g) => { g.tap(); g.setPaddleX(195); } },
  { dir: 'number-merge',  global: 'NumberMerge', tap: (g) => g.swipe(1, 0) },
  { dir: 'reflex-tap',    global: 'ReflexTap',   tap: (g) => g.tap() },
  { dir: 'pipe-rush',     global: 'PipeRush',    tap: (g) => g.tap() },
];

let failures = 0;
for (const meta of GAMES) {
  const file = path.join(__dirname, meta.dir, 'js', 'game.js');
  if (!fs.existsSync(file)) { console.log(`SKIP  ${meta.dir} (no game.js)`); continue; }
  try {
    const sandbox = makeSandbox();
    vm.createContext(sandbox);
    // load shared audio/ads optionally (we already mock them; skip to keep mocks)
    const src = fs.readFileSync(file, 'utf8') + `\n;globalThis.__GAME__ = ${meta.global};`;
    vm.runInContext(src, sandbox, { filename: file });
    const g = sandbox.__GAME__;
    if (!g) throw new Error(`global ${meta.global} not defined`);
    const canvas = mockCanvas();
    g.init(canvas, 0);
    // drive ~8 simulated seconds at 60fps, tapping every ~10 frames
    for (let i = 0; i < 480; i++) {
      if (i % 10 === 0) meta.tap(g);
      g.update(1 / 60);
      g.draw();
    }
    // force restart path from DEAD if reached
    meta.tap(g);
    g.update(1 / 60); g.draw();
    console.log(`OK    ${meta.dir.padEnd(14)} state=${g.getState ? g.getState() : '?'}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${meta.dir}: ${e.message}`);
    console.log(e.stack.split('\n').slice(1, 3).join('\n'));
  }
}

console.log(failures === 0 ? '\nAll games passed smoke test.' : `\n${failures} game(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
