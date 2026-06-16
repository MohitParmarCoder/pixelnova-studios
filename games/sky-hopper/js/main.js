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
  try { Audio.init();
  // ── Mute button — capture phase intercept ──────────────────────────────────
  canvas.addEventListener('pointerdown', function(ev) {
    var rect = canvas.getBoundingClientRect();
    var vx = (ev.clientX - rect.left) * (VW / rect.width);
    var vy = (ev.clientY - rect.top)  * (VH / rect.height);
    if (Math.hypot(vx - 355, vy - 38) <= 30) {
      ev.stopImmediatePropagation();
      if (Audio.toggle) Audio.toggle();
      else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
    }
  }, true);
 } catch (e) {}
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
    // ── Mute button overlay ────────────────────────────────────────────────────
    (function() {
      var ctx2 = canvas.getContext('2d');
      var mx = 355, my = 38, mr = 22;
      ctx2.save();
      ctx2.globalAlpha = 0.88;
      ctx2.fillStyle = '#111827';
      ctx2.beginPath(); ctx2.arc(mx, my, mr, 0, Math.PI * 2); ctx2.fill();
      ctx2.strokeStyle = '#374151'; ctx2.lineWidth = 1.5; ctx2.stroke();
      var muted = Audio.isMuted ? Audio.isMuted() : false;
      ctx2.lineWidth = 2.5;
      if (muted) {
        ctx2.strokeStyle = '#f87171';
        ctx2.beginPath(); ctx2.moveTo(mx-8,my-8); ctx2.lineTo(mx+8,my+8); ctx2.stroke();
        ctx2.beginPath(); ctx2.moveTo(mx+8,my-8); ctx2.lineTo(mx-8,my+8); ctx2.stroke();
      } else {
        ctx2.fillStyle = ctx2.strokeStyle = '#86efac';
        ctx2.beginPath();
        ctx2.moveTo(mx-10,my-4); ctx2.lineTo(mx-4,my-4);
        ctx2.lineTo(mx+4,my-10); ctx2.lineTo(mx+4,my+10);
        ctx2.lineTo(mx-4,my+4); ctx2.lineTo(mx-10,my+4); ctx2.closePath();
        ctx2.fill();
        ctx2.beginPath(); ctx2.arc(mx+4,my,5,-0.7,0.7); ctx2.stroke();
        ctx2.beginPath(); ctx2.arc(mx+4,my,10,-0.7,0.7); ctx2.stroke();
      }
      ctx2.restore();
    })();

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
