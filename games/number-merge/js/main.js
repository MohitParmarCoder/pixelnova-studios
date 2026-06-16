'use strict';

(function () {
  const VW = 390, VH = 844;
  const BEST_KEY = 'nummerge_best';
  const SWIPE_THRESHOLD = 30; // raw client px

  const canvas = document.getElementById('gameCanvas');
  canvas.width  = VW;
  canvas.height = VH;

  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width  = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}

  Audio.init();
  AdManager.init();
  NumberMerge.init(canvas, best);

  // ── Touch swipe detection ──────────────────────────────────────────────────
  let start = null;
  canvas.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    const adx = Math.abs(dx), ady = Math.abs(dy);

    if (adx < SWIPE_THRESHOLD && ady < SWIPE_THRESHOLD) {
      // Tap — starts/restarts the game (ignored mid-play by game.js)
      NumberMerge.swipe(0, 0);
      return;
    }
    if (adx > ady) NumberMerge.swipe(dx > 0 ? 1 : -1, 0);
    else           NumberMerge.swipe(0, dy > 0 ? 1 : -1);
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const KEY_MAP = {
    ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    d: [1, 0], a: [-1, 0], w: [0, -1], s: [0, 1],
    Enter: [0, 0], ' ': [0, 0],
  };
  window.addEventListener('keydown', (e) => {
    const dir = KEY_MAP[e.key];
    if (dir) { e.preventDefault(); NumberMerge.swipe(dir[0], dir[1]); }
  });

  function persistBest() {
    const b = NumberMerge.getBest();
    if (b > best) {
      best = b;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
  }

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    NumberMerge.update(dt);
    NumberMerge.draw();
    persistBest();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
