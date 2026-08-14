'use strict';

(function () {
  const VW = 390, VH = 844;
  const BEST_KEY = 'nummerge_best';
  const SWIPE_THRESHOLD = 30; // raw client px

  const canvas = document.getElementById('gameCanvas');
  canvas.width  = VW;
  canvas.height = VH;

  function resize() {
    var wrap = document.getElementById('canvasWrap');
    var wW = wrap ? wrap.clientWidth  : window.innerWidth;
    var wH = wrap ? wrap.clientHeight : window.innerHeight;
    var s = Math.min(wW / VW, wH / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}

  try { AdManager.gameLoadingStart(); } catch(e) {}
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
  NumberMerge.init(canvas, best);

  // ── Touch swipe detection ──────────────────────────────────────────────────
  let start = null;
  canvas.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    const adx = Math.abs(dx), ady = Math.abs(dy);

    if (adx < SWIPE_THRESHOLD && ady < SWIPE_THRESHOLD) {
      // Tap — starts/restarts the game (ignored mid-play by game.js)
      NumberMerge.swipe(0, 0);
      return;
    }
    if (adx > ady) NumberMerge.swipe(dx > 0 ? 1 : -1, 0);
    else           NumberMerge.swipe(0, dy > 0 ? 1 : -1);
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const KEY_MAP = {
    ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    d: [1, 0], a: [-1, 0], w: [0, -1], s: [0, 1],
    Enter: [0, 0], ' ': [0, 0],
  };
  window.addEventListener('keydown', (e) => {
    const dir = KEY_MAP[e.key];
    if (dir) { e.preventDefault(); NumberMerge.swipe(dir[0], dir[1]); }
  });

  function persistBest() {
    const b = NumberMerge.getBest();
    if (b > best) {
      best = b;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
  }

  let prev = 0;
  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    if (!_paused) { NumberMerge.update(dt); }
    NumberMerge.draw();


    persistBest();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) prev = performance.now();
  });
  (function () {
    var elI = document.getElementById('btnInfo');
    var elIO = document.getElementById('infoOverlay');
    var elIC = document.getElementById('btnInfoClose');
    if (elI) elI.addEventListener('click', function () { _paused = true; if (elIO) elIO.classList.remove('hidden'); });
    if (elIC) elIC.addEventListener('click', function () { _paused = false; prev = performance.now(); if (elIO) elIO.classList.add('hidden'); });
    if (elIO) elIO.addEventListener('click', function (e) { if (e.target === this) { _paused = false; prev = performance.now(); elIO.classList.add('hidden'); } });
  })();


  // ── Info canvas preview animation ──────────────────────────────────────────
  (function() {
    var ic = document.getElementById('infoCanvas'); if (!ic) return;
    var ix = ic.getContext('2d'), IW = 280, IH = 140;
    var _dots = [];
    for (var i = 0; i < 14; i++) {
      _dots.push({ x: Math.random()*IW, y: Math.random()*IH,
        vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
        r: 3+Math.random()*5, c: ['#a8edea','#6C8EEF','#f0abfc','#34d399','#fbbf24'][i%5],
        ph: Math.random()*6.28 });
    }
    var _iT = 0, _iRunning = false;
    function _iLoop() {
      var ov = document.getElementById('infoOverlay');
      if (!ov || ov.classList.contains('hidden')) { _iRunning = false; return; }
      _iT += 0.016;
      var g = ix.createLinearGradient(0,0,0,IH);
      g.addColorStop(0,'#050a1a'); g.addColorStop(1,'#0c0828');
      ix.fillStyle = g; ix.fillRect(0,0,IW,IH);
      ix.strokeStyle = 'rgba(168,237,234,0.07)'; ix.lineWidth = 1;
      for (var gx=0; gx<IW; gx+=28) { ix.beginPath(); ix.moveTo(gx,0); ix.lineTo(gx,IH); ix.stroke(); }
      for (var gy=0; gy<IH; gy+=28) { ix.beginPath(); ix.moveTo(0,gy); ix.lineTo(IW,gy); ix.stroke(); }
      for (var i=0; i<_dots.length; i++) {
        var d=_dots[i];
        d.x+=d.vx; d.y+=d.vy;
        if(d.x<0||d.x>IW) d.vx*=-1; if(d.y<0||d.y>IH) d.vy*=-1;
        var p=0.55+0.45*Math.sin(_iT*2+d.ph);
        ix.shadowBlur=14*p; ix.shadowColor=d.c;
        ix.fillStyle=d.c; ix.globalAlpha=0.65*p;
        ix.beginPath(); ix.arc(d.x,d.y,d.r*p,0,Math.PI*2); ix.fill();
      }
      ix.globalAlpha=1; ix.shadowBlur=0;
      var rp=(_iT%2.4)/2.4;
      ix.strokeStyle='rgba(168,237,234,'+(0.7*(1-rp))+')'; ix.lineWidth=2;
      ix.beginPath(); ix.arc(IW/2,IH/2,8+36*rp,0,Math.PI*2); ix.stroke();
      ix.strokeStyle='rgba(255,255,255,'+(0.4*(1-rp))+')'; ix.lineWidth=1.5;
      ix.beginPath(); ix.arc(IW/2,IH/2,4+18*rp,0,Math.PI*2); ix.stroke();
      ix.save(); ix.globalAlpha=0.45+0.45*Math.sin(_iT*1.8);
      ix.fillStyle='#a8edea'; ix.font='bold 10px system-ui';
      ix.textAlign='center'; ix.textBaseline='bottom';
      ix.fillText('\u2736 PIXELNOVA STUDIOS \u2736', IW/2, IH-3);
      ix.restore();
      requestAnimationFrame(_iLoop);
    }
    var _elI = document.getElementById('btnInfo');
    if (_elI) _elI.addEventListener('click', function() { if (!_iRunning) { _iRunning=true; requestAnimationFrame(_iLoop); } });
  })();
})();
