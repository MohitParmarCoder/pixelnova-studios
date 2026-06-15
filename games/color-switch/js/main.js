'use strict';

(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');

  // ── Letterbox: scale 390x844 to fit window ───────────────────────────────────
  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // ── Init modules ────────────────────────────────────────────────────────────
  Audio.init();
  AdManager.init();
  ColorSwitch.init(canvas);

  // ── Input ────────────────────────────────────────────────────────────────────
  // Single tap / click → ColorSwitch.tap()
  // Prevent double-fire on touchscreen (touch fires both touchstart and click)
  let lastTouchTime = 0;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = Date.now();
    // Debounce: ignore pointer events within 80 ms of each other
    if (now - lastTouchTime < 80) return;
    lastTouchTime = now;
    ColorSwitch.tap();
  }, { passive: false });

  // Keyboard: space / arrow-up / enter
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      e.preventDefault();
      ColorSwitch.tap();
    }
  });

  // ── rAF loop ─────────────────────────────────────────────────────────────────
  let prev = 0;

  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05); // cap at 50 ms (20 fps floor)
    prev = ts;
    ColorSwitch.update(dt);
    ColorSwitch.draw();
    requestAnimationFrame(loop);
  }

  // Skip first frame so dt starts at 0 rather than a huge number
  requestAnimationFrame(ts => {
    prev = ts;
    requestAnimationFrame(loop);
  });

  // Reset dt on visibility resume so pause doesn't cause a giant jump
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) prev = performance.now();
  });
})();
