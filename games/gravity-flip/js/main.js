'use strict';
(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');
  const BEST_KEY = 'gravflip_best';

  function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY)) || 0; } catch(e) { return 0; } }
  function saveBest(v) { try { localStorage.setItem(BEST_KEY, v); } catch(e) {} }

  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = (VW * scale) + 'px';
    canvas.style.height = (VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

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
  GravityFlip.init(canvas, loadBest());

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); GravityFlip.tap(); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      GravityFlip.tap();
    }
  });

  let prev = 0, wasDead = false;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    GravityFlip.update(dt);
    GravityFlip.draw();
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

    const dead = GravityFlip.getState() === 'DEAD';
    if (dead && !wasDead) saveBest(GravityFlip.getBest());
    wasDead = dead;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame((ts) => { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) prev = performance.now(); });
})();
