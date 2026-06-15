'use strict';
// Headless smoke test: stub browser APIs, load game scripts, drive all states.
const fs = require('fs');
const path = require('path');

const errors = [];

// ── Browser stubs ──────────────────────────────────────────────────────────
const gradientStub = { addColorStop() {} };

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => gradientStub;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (!(prop in t)) t[prop] = (..._a) => {};
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

const canvasStub = {
  width: 390, height: 844,
  style: {},
  getContext: () => makeCtx(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
  addEventListener() {},
};

const storage = {};
global.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
};

global.window = {
  addEventListener() {},
  innerWidth: 390, innerHeight: 844,
  AudioContext: undefined, webkitAudioContext: undefined,
};
global.document = {
  getElementById: () => canvasStub,
  addEventListener() {},
  hidden: false,
};
global.performance = { now: () => Date.now() };

// ── Load scripts (skip main.js; we drive the loop ourselves) ──────────────
const dir = path.join(__dirname, 'js');
const code = ['audio.js', 'ads.js', 'input.js', 'ui.js', 'game.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n;\n');

let Audio, AdManager, Input, UI, Game;
eval(code + '\n;[Audio, AdManager, Input, UI, Game].forEach(()=>{});' +
  '\nmodule.exports = { Audio, AdManager, Input, UI, Game };');
({ Audio, AdManager, Input, UI, Game } = module.exports);

// Controllable input mock
let pressQueued = false;
let tapPos = { x: 195, y: 422 };
Input.consumePress = () => { const v = pressQueued; pressQueued = false; return v; };
Input.lastPos = () => tapPos;
const tap = (x, y) => { tapPos = { x, y }; pressQueued = true; };

function frames(n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) {
    try { Game.step(dt); }
    catch (e) { errors.push(`step error: ${e.stack.split('\n').slice(0,3).join(' | ')}`); return false; }
  }
  return true;
}

// ── Test sequence ──────────────────────────────────────────────────────────
console.log('1. init + menu idle (120 frames)');
Audio.init(); AdManager.init();
Game.init(canvasStub);
frames(120);

console.log('2. tap to start, play 120 frames');
tap(195, 422); frames(1); frames(120);

console.log('3. launch ship (tap), fly 600 frames (should land or die)');
tap(195, 422); frames(1); frames(600);

console.log('4. spam launches for 3 simulated runs');
for (let run = 0; run < 3; run++) {
  for (let i = 0; i < 40; i++) {
    tap(195, 422);
    if (!frames(45)) break;
  }
  // Whatever state we're in, tap through DYING (skip continue) and RESULTS (retry)
  frames(140);            // let DYING finish -> RESULTS
  tap(243, 300); frames(1); // tap retry area (results buttons probed below)
  frames(60);
}

console.log('5. mute toggle (top-right corner tap)');
tap(380, 20); frames(2);
tap(380, 20); frames(2);

console.log('6. long soak: 3000 frames of random taps');
for (let i = 0; i < 3000; i++) {
  if (Math.random() < 0.05) tap(Math.random() * 390, Math.random() * 844);
  if (!frames(1)) break;
}

if (errors.length) {
  console.error('\nFAILURES:');
  errors.slice(0, 10).forEach(e => console.error('  ' + e));
  process.exit(1);
} else {
  console.log('\nAll smoke tests passed — no runtime errors across all states.');
}
