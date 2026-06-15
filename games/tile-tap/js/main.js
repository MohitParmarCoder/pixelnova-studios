'use strict';

(function () {
  var VW = 390, VH = 844;
  var BEST_KEY = 'tiletap_best';

  var canvas = document.getElementById('gameCanvas');
  canvas.width = VW;
  canvas.height = VH;

  function resize() {
    var s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 100); });

  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}

  Audio.init();
  AdManager.init();
  TileTap.init(canvas, best);

  function toVirtual(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var vx = (clientX - rect.left) * (VW / rect.width);
    var vy = (clientY - rect.top) * (VH / rect.height);
    return { x: vx, y: vy };
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var p = toVirtual(e.clientX, e.clientY);
    TileTap.tap(p.x, p.y);
  });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      TileTap.tap(VW / 2, VH / 2);
    }
  });

  function persistBest() {
    var b = TileTap.getBest();
    if (b > best) {
      best = b;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
  }

  var prev = 0;
  function loop(ts) {
    var dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    TileTap.update(dt);
    TileTap.draw();
    persistBest();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
