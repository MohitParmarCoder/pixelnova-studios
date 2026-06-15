'use strict';

(function () {
  const VW = 390, VH = 844;
  const BEST_KEY = 'piperush_best';

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
  PipeRush.init(canvas, best);

  function onTap(e) { e.preventDefault(); PipeRush.tap(); }
  canvas.addEventListener('pointerdown', onTap);
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); PipeRush.tap(); }
  });

  function persistBest() {
    const b = PipeRush.getBest();
    if (b > best) { best = b; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
  }

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    PipeRush.update(dt);
    PipeRush.draw();
    persistBest();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
