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

  requestAnimationFrame(loop);
})();
