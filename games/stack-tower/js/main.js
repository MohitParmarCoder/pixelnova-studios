'use strict';

(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');

  // ── Letterbox resize ────────────────────────────────────────────────────────
  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // ── Module init ─────────────────────────────────────────────────────────────
  Audio.init();
  AdManager.init();
  let _best = 0;
  try { _best = parseInt(localStorage.getItem('stacktower_best'), 10) || 0; } catch(e) {}
  StackTower.init(canvas);

  // ── Input — tap / click / touch ─────────────────────────────────────────────
  function onTap(e) {
    e.preventDefault();
    StackTower.tap();
  }

  canvas.addEventListener('pointerdown', onTap);

  // Keyboard spacebar / enter as tap
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      StackTower.tap();
    }
  });

  // ── rAF loop ────────────────────────────────────────────────────────────────
  let prev = 0;

  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    StackTower.update(dt);
    StackTower.draw();
    const b = StackTower.getBest ? StackTower.getBest() : 0;
    if (b > _best) { _best = b; try { localStorage.setItem('stacktower_best', String(_best)); } catch(e) {} }
    requestAnimationFrame(loop);
  }

  // First frame: record timestamp then start loop
  requestAnimationFrame(function (ts) {
    prev = ts;
    requestAnimationFrame(loop);
  });

  // Resume after tab switch
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
