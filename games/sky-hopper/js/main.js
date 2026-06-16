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

  // ── Init modules ─────────────────────────────────────────────────────────────
  try { Audio.init(); } catch (e) {}
  try { AdManager.init(); } catch (e) {}

  let best = 0;
  try { best = parseInt(localStorage.getItem('skyhopper_best'), 10) || 0; } catch (e) {}

  SkyHopper.init(canvas, best);

  // ── Convert a clientX to virtual canvas x ────────────────────────────────────
  function toVirtualX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(VW, sx * VW));
  }

  // ── Pointer: tap to play/retry + drag to steer ───────────────────────────────
  let dragging = false;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    SkyHopper.tap();
    if (SkyHopper.getState() === 'PLAYING') {
      SkyHopper.setTiltX(toVirtualX(e.clientX));
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (SkyHopper.getState() === 'PLAYING') {
      SkyHopper.setTiltX(toVirtualX(e.clientX));
    }
  }, { passive: false });

  function endDrag(e) {
    dragging = false;
    if (e && e.pointerId != null) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const keys = { left: false, right: false };

  document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') { SkyHopper.tap(); e.preventDefault(); }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  // ── Persist best when it increases ───────────────────────────────────────────
  function persistBest() {
    const b = SkyHopper.getBest();
    if (b > best) {
      best = b;
      try { localStorage.setItem('skyhopper_best', String(best)); } catch (e) {}
    }
  }

  // ── rAF loop ─────────────────────────────────────────────────────────────────
  let prev = 0;

  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;

    // Held keyboard steering.
    if (SkyHopper.getState() === 'PLAYING') {
      const sp = 380 * dt;
      if (keys.left) SkyHopper.nudge(-sp);
      if (keys.right) SkyHopper.nudge(sp);
    }

    SkyHopper.update(dt);
    SkyHopper.draw();
    persistBest();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((ts) => {
    prev = ts;
    requestAnimationFrame(loop);
  });

  // Reset dt on visibility resume so pause doesn't cause a giant jump.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) prev = performance.now();
  });
})();
