'use strict';

(function () {
  var VW = 390, VH = 844;
  var canvas = document.getElementById('gameCanvas');

  // ── Letterbox: scale 390x844 to fit window ──────────────────────────────────
  function resize() {
    var scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width = VW;
    canvas.height = VH;
    canvas.style.width = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 100); });
  resize();

  // ── Init modules ────────────────────────────────────────────────────────────
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

  var best = 0;
  try { best = parseInt(localStorage.getItem('bubblepop_best') || '0', 10) || 0; } catch (e) {}

  BubblePop.init(canvas, best);

  // ── Pointer → virtual coords ────────────────────────────────────────────────
  function toVirtual(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * VW;
    var y = (e.clientY - rect.top) / rect.height * VH;
    return { x: x, y: y };
  }

  var pointerActive = false;

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var v = toVirtual(e);
    pointerActive = true;
    var s = BubblePop.getState();
    if (s === 'MENU' || s === 'DEAD' || s === 'WIN') {
      BubblePop.tap(v.x, v.y);
    } else {
      BubblePop.aim(v.x, v.y);
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    if (!pointerActive) return;
    e.preventDefault();
    var v = toVirtual(e);
    BubblePop.aim(v.x, v.y);
  }, { passive: false });

  function release(e) {
    if (!pointerActive) return;
    pointerActive = false;
    e.preventDefault();
    var v = toVirtual(e);
    if (BubblePop.getState() === 'PLAYING') {
      BubblePop.shoot(v.x, v.y);
    }
  }
  canvas.addEventListener('pointerup', release, { passive: false });
  canvas.addEventListener('pointercancel', function () { pointerActive = false; }, { passive: false });

  // ── Keyboard ────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      BubblePop.tap(VW / 2, VH / 2);
    }
  });

  // ── Persist best ────────────────────────────────────────────────────────────
  var savedBest = best;
  function persistBest() {
    var b = BubblePop.getBest();
    if (b > savedBest) {
      savedBest = b;
      try { localStorage.setItem('bubblepop_best', String(b)); } catch (e) {}
    }
  }

  // ── rAF loop ────────────────────────────────────────────────────────────────
  var prev = 0;
  function loop(ts) {
    var dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    BubblePop.update(dt);
    BubblePop.draw();
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
  requestAnimationFrame(function (ts) {
    prev = ts;
    requestAnimationFrame(loop);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
