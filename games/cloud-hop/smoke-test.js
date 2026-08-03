'use strict';
// Headless smoke test for cloud-hop (CloudHop)
const fs = require('fs');
const path = require('path');
const errors = [];

// ── Browser stubs ──────────────────────────────────────────────────────────
const gradientStub = { addColorStop() {} };
function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradientStub;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'roundRect') return function() {};
      if (!(prop in t)) t[prop] = (..._a) => {};
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
const canvasStub = {
  width: 390, height: 844, style: {},
  getContext: () => makeCtx(),
  getBoundingClientRect: () => ({ left:0, top:0, width:390, height:844 }),
  addEventListener() {},
};
const storage = {};
global.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k,v) => { storage[k] = String(v); },
};
global.window = {
  addEventListener() {}, innerWidth:390, innerHeight:844,
  AudioContext: undefined, webkitAudioContext: undefined,
  GAME_PORTAL: 'null',
  CrazyGames: undefined,
};
global.document = {
  getElementById: (id) => id === 'gameCanvas' ? canvasStub : null,
  createElement: (tag) => {
    const el = { style:{}, id:'', textContent:'', appendChild(){}, addEventListener(){}, remove(){} };
    if (tag === 'canvas') Object.assign(el, canvasStub);
    return el;
  },
  head: { appendChild(){} },
  body: { appendChild(){}, style:{} },
  addEventListener() {},
  hidden: false,
};
Object.defineProperty(global, 'navigator', { value: { vibrate: () => true }, writable: true, configurable: true });
global.performance = { now: () => Date.now() };
global.CanvasRenderingContext2D = { prototype: { roundRect: function(){} } };
global.requestAnimationFrame = () => {};

// ── Load scripts ──────────────────────────────────────────────────────────
const dir = path.join(__dirname, 'js');
const files = ['audio.js','ads.js','game.js','main.js'];
let code = '';
for (const f of files) {
  try { code += fs.readFileSync(path.join(dir,f),'utf8') + '\n;\n'; } catch(e) {}
}
try { eval(code); } catch(e) { errors.push('load error: '+e.message); }

// ── Drive game ─────────────────────────────────────────────────────────────
function step(dt) {
  try {
    if (typeof CloudHop !== 'undefined' && CloudHop.update) CloudHop.update(dt);
    if (typeof CloudHop !== 'undefined' && CloudHop.draw) CloudHop.draw();
  } catch(e) { errors.push('step: '+e.message.slice(0,80)); }
}
function tap(x,y) {
  try {
    if (typeof CloudHop !== 'undefined' && CloudHop.tap) CloudHop.tap(x,y);
  } catch(e) { errors.push('tap: '+e.message.slice(0,80)); }
}
function frames(n, dt) {
  dt = dt || 1/60;
  for (let i=0;i<n;i++) step(dt);
}

// init
try {
  if (typeof CloudHop !== 'undefined' && CloudHop.init) CloudHop.init(canvasStub, 0);
} catch(e) { errors.push('init: '+e.message.slice(0,80)); }

// idle
frames(60);
// start
tap(195, 422); frames(120);
// play 3 simulated runs (random taps)
for (let run=0;run<3;run++) {
  for (let i=0;i<200;i++) {
    if (Math.random()<0.08) tap(Math.random()*390, Math.random()*844);
    step(1/60);
  }
}
// mute/unmute
tap(380, 20); frames(2);
tap(380, 20); frames(2);
// soak
for (let i=0;i<1000;i++) {
  if (Math.random()<0.05) tap(Math.random()*390, Math.random()*844);
  step(1/60);
}

// ── Report ────────────────────────────────────────────────────────────────
const uniq = [...new Set(errors)];
if (uniq.length) {
  console.error('FAIL (cloud-hop): '+uniq.slice(0,5).join(' | '));
  process.exit(1);
} else {
  console.log('PASS cloud-hop');
}
