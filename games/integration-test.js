'use strict';
/* Integration test: loads each game's REAL script chain
   (audio.js + ads.js + game.js + main.js) in one shared scope — exactly
   like the browser's <script> tags — mocks the DOM with capturable
   listeners, dispatches REAL pointer/touch/key events through main.js's
   wiring, and drives the requestAnimationFrame loop.

   Unlike smoke-test.js (which calls game.tap() directly), this verifies
   the FULL integration: does a real tap actually start and play the game?

   Run:  node games/integration-test.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock 2D context that throws like a real browser on the canvas2D error
// conditions games most commonly trip over, so we catch render-time crashes
// that would freeze the rAF loop in an actual browser.
function fin(...xs) { return xs.every(v => typeof v === 'number' && isFinite(v)); }
function makeGradient(kind) {
  return {
    addColorStop(offset, color) {
      if (typeof offset !== 'number' || !isFinite(offset) || offset < 0 || offset > 1)
        throw new Error(`IndexSizeError: addColorStop offset out of range (${offset})`);
      if (typeof color !== 'string' || color === '')
        throw new Error(`SyntaxError: addColorStop invalid color (${color})`);
    },
  };
}
function mockCtx() {
  const noop = () => {};
  const real = {
    canvas: { width: 390, height: 844 },
    createLinearGradient(x0, y0, x1, y1) {
      if (!fin(x0, y0, x1, y1)) throw new Error('NotSupportedError: createLinearGradient non-finite');
      return makeGradient('linear');
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      if (!fin(x0, y0, r0, x1, y1, r1)) throw new Error('NotSupportedError: createRadialGradient non-finite');
      if (r0 < 0 || r1 < 0) throw new Error(`IndexSizeError: createRadialGradient negative radius (r0=${r0}, r1=${r1})`);
      return makeGradient('radial');
    },
    createConicGradient() { return makeGradient('conic'); },
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: [] }),
    putImageData: noop, setLineDash: noop, getLineDash: () => [],
    arc(x, y, r) { if (typeof r === 'number' && r < 0) throw new Error(`IndexSizeError: arc negative radius (${r})`); },
    arcTo(x1, y1, x2, y2, r) { if (typeof r === 'number' && r < 0) throw new Error(`IndexSizeError: arcTo negative radius (${r})`); },
    ellipse(x, y, rx, ry) { if ((typeof rx === 'number' && rx < 0) || (typeof ry === 'number' && ry < 0)) throw new Error(`IndexSizeError: ellipse negative radius (rx=${rx}, ry=${ry})`); },
    roundRect(x, y, w, h, r) { const rr = Array.isArray(r) ? Math.min(...r) : r; if (typeof rr === 'number' && rr < 0) throw new Error(`IndexSizeError: roundRect negative radius (${rr})`); },
  };
  return new Proxy(real, {
    get(t, p) { if (p in t) return t[p]; return typeof p === 'string' ? noop : undefined; },
    set() { return true; },
  });
}

function emitter(extra) {
  const map = {};
  return Object.assign({
    _listeners: map,
    addEventListener(t, fn) { (map[t] || (map[t] = [])).push(fn); },
    removeEventListener(t, fn) { if (map[t]) map[t] = map[t].filter(f => f !== fn); },
    dispatchEvent(ev) { (map[ev.type] || []).slice().forEach(fn => fn(ev)); return true; },
    _emit(type, ev) { (map[type] || []).slice().forEach(fn => fn(Object.assign({ type, preventDefault(){}, stopPropagation(){} }, ev))); },
  }, extra || {});
}

function makeEl(tag) {
  const el = emitter({
    tagName: (tag || 'div').toUpperCase(), style: {}, children: [], id: '',
    dataset: {}, parentElement: null, onclick: null,
    setAttribute(k, v) { if (k === 'id') this.id = v; },
    getAttribute() { return null; },
    classList: { add(){}, remove(){}, toggle(){}, contains() { return false; } },
    appendChild(ch) { this.children.push(ch); ch.parentElement = this; return ch; },
    removeChild(ch) { this.children = this.children.filter(c => c !== ch); ch.parentElement = null; return ch; },
    remove() { if (this.parentElement) this.parentElement.removeChild(this); },
    focus(){}, blur(){}, getBoundingClientRect: () => ({ left:0, top:0, width:390, height:844, right:390, bottom:844 }),
  });
  Object.defineProperty(el, 'textContent', { get(){ return this._t || ''; }, set(v){ this._t = v; } });
  Object.defineProperty(el, 'innerHTML', { get(){ return this._h || ''; }, set(v){ this._h = v; } });
  return el;
}

function makeSandbox() {
  const store = {};
  const byId = {};

  const canvas = makeEl('canvas');
  canvas.id = 'gameCanvas';
  canvas.width = 390; canvas.height = 844;
  canvas.getContext = () => mockCtx();
  byId['gameCanvas'] = canvas;

  const head = makeEl('head');
  const body = makeEl('body');
  // wire id registration on append so ads.js getElementById('__pn_kf') works
  const reg = (el) => { if (el && el.id) byId[el.id] = el; (el.children||[]).forEach(reg); };
  const wrapAppend = (node) => {
    const orig = node.appendChild.bind(node);
    node.appendChild = (ch) => { const r = orig(ch); reg(ch); return r; };
  };
  wrapAppend(head); wrapAppend(body);

  const document = emitter({
    body, head, hidden: false, visibilityState: 'visible',
    documentElement: makeEl('html'),
    getElementById: (id) => (id === 'gameCanvas' ? canvas : (byId[id] || null)),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => { const e = makeEl(tag); wrapAppend(e); return e; },
    createTextNode: (t) => ({ textContent: t }),
  });

  const sandbox = {
    Math, Date, JSON, console, isNaN, parseInt, parseFloat, isFinite,
    String, Number, Boolean, Array, Object, Symbol, Map, Set, Promise, RegExp, Error,
    Float32Array, Uint8Array, Int32Array,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => sandbox.__now },
    navigator: { userAgent: 'node', vibrate: () => {}, maxTouchPoints: 1 },
    __now: 0, __rafQ: [],
    requestAnimationFrame: (cb) => { sandbox.__rafQ.push(cb); return sandbox.__rafQ.length; },
    cancelAnimationFrame: () => {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    },
    document,
    // NOTE: deliberately NOT providing Audio/AdManager — the real scripts define them.
  };
  // window === global sandbox; give it event-emitter behaviour
  const winListeners = {};
  sandbox.addEventListener = (t, fn) => { (winListeners[t] || (winListeners[t] = [])).push(fn); };
  sandbox.removeEventListener = (t, fn) => { if (winListeners[t]) winListeners[t] = winListeners[t].filter(f => f !== fn); };
  sandbox.dispatchEvent = (ev) => { (winListeners[ev.type] || []).slice().forEach(fn => fn(ev)); return true; };
  sandbox._emit = (type, ev) => { (winListeners[type] || []).slice().forEach(fn => fn(Object.assign({ type, preventDefault(){}, stopPropagation(){} }, ev))); };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.document = document;
  sandbox.__canvas = canvas;
  return sandbox;
}

const GAMES = [
  { dir: 'stack-tower',   global: 'StackTower' },
  { dir: 'color-switch',  global: 'ColorSwitch' },
  { dir: 'gravity-flip',  global: 'GravityFlip' },
  { dir: 'neon-snake',    global: 'NeonSnake' },
  { dir: 'tap-blast',     global: 'TapBlast' },
  { dir: 'dodge-rush',    global: 'DodgeRush' },
  { dir: 'block-breaker', global: 'BlockBreaker' },
  { dir: 'number-merge',  global: 'NumberMerge' },
  { dir: 'reflex-tap',    global: 'ReflexTap' },
  { dir: 'pipe-rush',     global: 'PipeRush' },
  { dir: 'tile-tap',      global: 'TileTap' },
  { dir: 'sky-hopper',    global: 'SkyHopper' },
  { dir: 'bubble-pop',    global: 'BubblePop' },
  { dir: 'star-blaster',  global: 'StarBlaster' },
  { dir: 'memory-flip',   global: 'MemoryFlip' },
];

function dispatchTap(env, x, y, y2) {
  const c = env.__canvas, w = env.window, d = env.document;
  const down = { clientX: x, clientY: y, pointerId: 1, button: 0, touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] };
  const move = { clientX: x, clientY: (y2 != null ? y2 : y), pointerId: 1, touches: [{ clientX: x, clientY: (y2 != null ? y2 : y) }] };
  const up   = { clientX: x, clientY: (y2 != null ? y2 : y), pointerId: 1, touches: [], changedTouches: [{ clientX: x, clientY: (y2 != null ? y2 : y) }] };
  for (const tgt of [c, w, d]) {
    tgt._emit('pointerdown', down); tgt._emit('mousedown', down); tgt._emit('touchstart', down);
    tgt._emit('pointermove', move); tgt._emit('mousemove', move); tgt._emit('touchmove', move);
    tgt._emit('pointerup', up); tgt._emit('mouseup', up); tgt._emit('touchend', up);
    tgt._emit('click', down);
  }
}
function dispatchKey(env, code, key) {
  const ev = { code, key, keyCode: 0, which: 0 };
  env.document._emit('keydown', ev); env.window._emit('keydown', ev);
}

function drive(env, frames) {
  for (let i = 0; i < frames; i++) {
    env.__now += 16.67;
    const q = env.__rafQ; env.__rafQ = [];
    for (const cb of q) cb(env.__now);
  }
}

const results = [];
for (const meta of GAMES) {
  const r = { name: meta.dir, issues: [], info: {} };
  try {
    const env = makeSandbox();
    vm.createContext(env);
    const files = [
      path.join(__dirname, meta.dir, 'js', 'audio.js'),
      path.join(__dirname, meta.dir, 'js', 'ads.js'),
      path.join(__dirname, meta.dir, 'js', 'game.js'),
      path.join(__dirname, meta.dir, 'js', 'main.js'),
    ];
    let src = '';
    for (const f of files) {
      if (!fs.existsSync(f)) { r.issues.push('MISSING file ' + path.relative(__dirname, f)); }
      else src += fs.readFileSync(f, 'utf8') + '\n;\n';
    }
    src += `\n;globalThis.__GAME__ = (typeof ${meta.global} !== 'undefined') ? ${meta.global} : null;`;
    vm.runInContext(src, env, { filename: meta.dir + '/[bundle]' });

    const g = env.__GAME__;
    if (!g) { r.issues.push(`global ${meta.global} not defined`); results.push(r); continue; }

    const stateOf = () => (g.getState ? g.getState() : '?');
    const scoreOf = () => (g.getScore ? g.getScore() : 0);

    // main.js should have started the rAF loop. Prime a few idle frames (menu).
    drive(env, 5);
    r.info.menuState = stateOf();

    // 1) START: a real tap at canvas center must leave the menu.
    dispatchTap(env, 195, 560, 560);
    drive(env, 3);
    const afterStart = stateOf();
    r.info.afterStart = afterStart;
    if (afterStart === r.info.menuState && afterStart !== 'PLAYING') {
      r.issues.push(`tap did not start game (state stuck at "${afterStart}")`);
    }

    // 2) PLAY: drive frames + varied input; watch score + states.
    const seen = new Set([afterStart]);
    let maxScore = scoreOf();
    const dirs = [['ArrowRight','d'],['ArrowUp','w'],['ArrowLeft','a'],['ArrowDown','s']];
    for (let t = 0; t < 30; t++) {
      const x = 90 + ((t * 53) % 210);
      const y = 300 + ((t * 70) % 300);
      dispatchTap(env, x, y, y - 80);
      const dk = dirs[t % 4];
      dispatchKey(env, dk[0], dk[0]);
      dispatchKey(env, 'Space', ' ');
      drive(env, 8);
      seen.add(stateOf());
      maxScore = Math.max(maxScore, scoreOf());
    }
    r.info.statesSeen = [...seen].join(',');
    r.info.maxScore = maxScore;
    r.info.finalState = stateOf();

    // 3) Did gameplay actually produce progress?
    const playedSomehow = seen.has('PLAYING') || seen.has('DEAD') || seen.has('WIN') || maxScore > 0;
    if (!playedSomehow) r.issues.push('no gameplay progress (never PLAYING/DEAD, score stayed 0)');

  } catch (e) {
    r.issues.push('THREW: ' + e.message);
    r.stack = (e.stack || '').split('\n').slice(0, 4).join('\n');
  }
  results.push(r);
}

let fails = 0;
for (const r of results) {
  if (r.issues.length === 0) {
    console.log(`✅  ${r.name.padEnd(15)} menu=${r.info.menuState} start->${r.info.afterStart} states=[${r.info.statesSeen}] score=${r.info.maxScore}`);
  } else {
    fails++;
    console.log(`❌  ${r.name.padEnd(15)} ${r.issues.join(' | ')}`);
    console.log(`      menu=${r.info.menuState} afterStart=${r.info.afterStart} states=[${r.info.statesSeen||''}] score=${r.info.maxScore||0}`);
    if (r.stack) console.log('      ' + r.stack.replace(/\n/g, '\n      '));
  }
}
console.log(fails === 0 ? '\n✅ All games pass integration test.' : `\n❌ ${fails} game(s) have issues.`);
process.exit(fails === 0 ? 0 : 1);
