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
