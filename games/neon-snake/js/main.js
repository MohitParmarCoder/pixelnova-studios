'use strict';

(function () {
  const VW = 390, VH = 844;

  // ── Canvas setup & letterboxing ────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  canvas.width  = VW;
  canvas.height = VH;

  function resize() {
    const scaleX = window.innerWidth  / VW;
    const scaleY = window.innerHeight / VH;
    const scale  = Math.min(scaleX, scaleY);
    canvas.style.width  = (VW * scale) + 'px';
    canvas.style.height = (VH * scale) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Init subsystems ────────────────────────────────────────────────────────
  Audio.init();
  AdManager.init();
  NeonSnake.init(canvas);

  // ── Touch / swipe detection ────────────────────────────────────────────────
  let touchStart = null;
  const SWIPE_THRESHOLD = 20; // px in virtual space — but we compare raw client px

  canvas.addEventListener('pointerdown', (e) => {
    touchStart = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;

    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
      // Short tap — treat as "tap to start/retry" (no directional change)
      NeonSnake.swipe(0, 0);
      return;
    }

    if (absDx > absDy) {
      NeonSnake.swipe(dx > 0 ? 1 : -1, 0);
    } else {
      NeonSnake.swipe(0, dy > 0 ? 1 : -1);
    }
  });

  // ── Keyboard input ─────────────────────────────────────────────────────────
  const KEY_MAP = {
    ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    d: [1, 0], a: [-1, 0], w: [0, -1], s: [0, 1],
    D: [1, 0], A: [-1, 0], W: [0, -1], S: [0, 1],
    // Enter / Space also trigger start
    Enter: [0, 0], ' ': [0, 0],
  };

  window.addEventListener('keydown', (e) => {
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      NeonSnake.swipe(dir[0], dir[1]);
    }
  });

  // ── rAF loop ───────────────────────────────────────────────────────────────
  let prevTs = null;

  function loop(ts) {
    if (prevTs === null) prevTs = ts;
    const dt = Math.min((ts - prevTs) / 1000, 0.05); // cap at 50ms
    prevTs = ts;

    NeonSnake.update(dt);
    NeonSnake.draw();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
