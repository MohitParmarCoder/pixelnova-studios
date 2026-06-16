'use strict';

(function () {
  const VW = 390, VH = 844;
  const BEST_KEY = 'starblaster_best';

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
  StarBlaster.init(canvas, best);

  function toVirtualX(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * (VW / rect.width);
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    StarBlaster.tap();
    dragging = true;
    StarBlaster.setShipX(toVirtualX(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    StarBlaster.setShipX(toVirtualX(e));
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', stop);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); StarBlaster.tap(); }
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { e.preventDefault(); keys[e.key] = true; }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  function persistBest() {
    const b = StarBlaster.getBest();
    if (b > best) { best = b; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
  }

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    const sp = 360 * dt;
    if (keys.ArrowLeft || keys.a || keys.A) StarBlaster.nudge(-sp);
    if (keys.ArrowRight || keys.d || keys.D) StarBlaster.nudge(sp);
    StarBlaster.update(dt);
    StarBlaster.draw();
    persistBest();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
