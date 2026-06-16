'use strict';

(function () {
  var VW = 390, VH = 844;
  var canvas = document.getElementById('gameCanvas');

  // ── Letterbox: scale 390x844 to fit window ──────────────────────────────────
  function resize() {
    var topH = (document.getElementById('topBar') || {offsetHeight:0}).offsetHeight || 0;
    var botH = (document.getElementById('bottomBar') || {offsetHeight:0}).offsetHeight || 0;
    var s = Math.min(window.innerWidth / VW, (window.innerHeight - topH - botH) / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 100); });
  resize();

  // ── Init modules ────────────────────────────────────────────────────────────
  Audio.init();


  AdManager.init();

  // ── HTML Chrome: Settings overlay + Mute btn ────────────────────────────────
  var _paused = false;
  var _logoRot = 0, _logoRaf = null;

  function _drawLogo() {
    var lc = document.getElementById('logoCanvas');
    if (!lc) return;
    var lx = lc.getContext('2d');
    var cx = 55, cy = 55, r = 38;
    lx.clearRect(0, 0, 110, 110);
    _logoRot += 0.012;
    var hg = lx.createRadialGradient(cx,cy,0,cx,cy,r*1.5);
    hg.addColorStop(0,'rgba(168,237,234,.2)'); hg.addColorStop(1,'rgba(168,237,234,0)');
    lx.fillStyle=hg; lx.beginPath(); lx.arc(cx,cy,r*1.5,0,Math.PI*2); lx.fill();
    lx.shadowBlur=20; lx.shadowColor='#a8edea';
    var sg=lx.createRadialGradient(cx,cy,0,cx,cy,r);
    sg.addColorStop(0,'#fff'); sg.addColorStop(0.38,'#a8edea');
    sg.addColorStop(0.72,'#6C8EEF'); sg.addColorStop(1,'rgba(20,20,80,0)');
    lx.fillStyle=sg; lx.beginPath();
    for(var i=0;i<16;i++){
      var a=(i*Math.PI/8)+_logoRot, rr=i%2===0?r:r*0.36;
      var px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr;
      i===0?lx.moveTo(px,py):lx.lineTo(px,py);
    }
    lx.closePath(); lx.fill();
    lx.shadowBlur=10; lx.shadowColor='#fff'; lx.fillStyle='rgba(255,255,255,.9)';
    lx.beginPath(); lx.arc(cx,cy,r*0.12,0,Math.PI*2); lx.fill();
    lx.shadowBlur=0;
    if (!document.getElementById('settingsOverlay').classList.contains('hidden'))
      _logoRaf = requestAnimationFrame(_drawLogo);
  }

  function _updateMuteUI() {
    var m = Audio.isMuted ? Audio.isMuted() : false;
    var b1 = document.getElementById('btnMute');  if (!b1) return;
    var b2 = document.getElementById('btnMuteInSettings');
    b1.innerHTML = m ? '&#128263;' : '&#128266;';
    b1.classList.toggle('muted', m);
    if (b2) { b2.innerHTML = (m ? '&#128263;&nbsp; MUTED' : '&#128266;&nbsp; SOUND ON'); b2.classList.toggle('muted', m); }
  }

  function _openSettings() {
    _paused = true;
    document.getElementById('settingsOverlay').classList.remove('hidden');
    _updateMuteUI();
    if (_logoRaf) cancelAnimationFrame(_logoRaf);
    _drawLogo();
  }

  function _closeSettings() {
    _paused = false;
    document.getElementById('settingsOverlay').classList.add('hidden');
    if (_logoRaf) { cancelAnimationFrame(_logoRaf); _logoRaf = null; }
    prev = performance.now();
  }

  // Wire up chrome buttons (guarded for headless/test environments)
  (function() {
    var elSettings = document.getElementById('btnSettings');
    var elResume   = document.getElementById('btnResume');
    var elOverlay  = document.getElementById('settingsOverlay');
    var elMute     = document.getElementById('btnMute');
    var elMuteSet  = document.getElementById('btnMuteInSettings');
    if (elSettings)  elSettings.addEventListener('click', _openSettings);
    if (elResume)    elResume.addEventListener('click', _closeSettings);
    if (elOverlay)   elOverlay.addEventListener('click', function(e) { if (e.target === this) _closeSettings(); });
    if (elMute)      elMute.addEventListener('click', function() {
      if (Audio.toggle) Audio.toggle(); else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      _updateMuteUI();
    });
    if (elMuteSet)   elMuteSet.addEventListener('click', function() {
      if (Audio.toggle) Audio.toggle(); else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      _updateMuteUI();
    });
  })();

  // Init mute icon on load
  _updateMuteUI();

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
    if (!_paused) { BubblePop.update(dt); }
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
