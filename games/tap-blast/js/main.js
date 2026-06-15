'use strict';

(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');

  // ── Letterbox resize ───────────────────────────────────────────────────────
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

  // ── Module init ────────────────────────────────────────────────────────────
  Audio.init();
  AdManager.init();
  TapBlast.init(canvas);

  // ── Convert pointer event to virtual canvas coordinates ────────────────────
  function toVirtual(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = VW / rect.width;
    const scaleY = VH / rect.height;
    // Use clientX/Y from the first touch or mouse event
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      vx: (clientX - rect.left) * scaleX,
      vy: (clientY - rect.top)  * scaleY,
    };
  }

  // ── Input — tap / click / touch ────────────────────────────────────────────
  function onTap(e) {
    e.preventDefault();
    const { vx, vy } = toVirtual(e);
    TapBlast.tap(vx, vy);
  }

  canvas.addEventListener('pointerdown', onTap);

  // Keyboard space/enter: simulate a tap at canvas center (menu/dead transitions)
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      TapBlast.tap(VW / 2, VH / 2);
    }
  });

  // ── rAF loop ───────────────────────────────────────────────────────────────
  let prev = 0;

  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    TapBlast.update(dt);
    TapBlast.draw();
    requestAnimationFrame(loop);
  }

  // First frame: record timestamp then start
  requestAnimationFrame(function (ts) {
    prev = ts;
    requestAnimationFrame(loop);
  });

  // Resume after tab switch
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
