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
