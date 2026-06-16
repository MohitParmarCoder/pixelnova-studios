'use strict';
(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');
  const BEST_KEY = 'gravflip_best';

  function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY)) || 0; } catch(e) { return 0; } }
  function saveBest(v) { try { localStorage.setItem(BEST_KEY, v); } catch(e) {} }

  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = (VW * scale) + 'px';
    canvas.style.height = (VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  Audio.init();
  AdManager.init();
  GravityFlip.init(canvas, loadBest());

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); GravityFlip.tap(); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      GravityFlip.tap();
    }
  });

  let prev = 0, wasDead = false;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    GravityFlip.update(dt);
    GravityFlip.draw();
    const dead = GravityFlip.getState() === 'DEAD';
    if (dead && !wasDead) saveBest(GravityFlip.getBest());
    wasDead = dead;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame((ts) => { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) prev = performance.now(); });
})();
