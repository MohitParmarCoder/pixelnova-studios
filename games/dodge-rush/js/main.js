'use strict';

(function () {
  const VW = 390, VH = 844;
  const BEST_KEY = 'dodgerush_best';

  const canvas = document.getElementById('gameCanvas');
  canvas.width  = VW;
  canvas.height = VH;

  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width  = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}

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
  DodgeRush.init(canvas, best);

  function toVirtualX(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * (VW / rect.width);
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    DodgeRush.tap();
    dragging = true;
    DodgeRush.setPlayerX(toVirtualX(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    DodgeRush.setPlayerX(toVirtualX(e));
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', stop);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); DodgeRush.tap(); }
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { e.preventDefault(); keys[e.key] = true; }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  function persistBest() {
    const b = DodgeRush.getBest();
    if (b > best) { best = b; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
  }

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    const sp = 320 * dt;
    if (keys.ArrowLeft || keys.a || keys.A) DodgeRush.nudge(-sp);
    if (keys.ArrowRight || keys.d || keys.D) DodgeRush.nudge(sp);
    DodgeRush.update(dt);
    DodgeRush.draw();
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
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
})();
