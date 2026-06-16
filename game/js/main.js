'use strict';

(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');

  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = (VW * s) + 'px';
    canvas.style.height = (VH * s) + 'px';
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  Audio.init();
  AdManager.init();
  Input.init(canvas, VW, VH);
  Game.init(canvas);

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    Game.step(dt);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(ts => { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) prev = performance.now();
  });
})();
