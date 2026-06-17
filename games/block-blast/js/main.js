'use strict';
(function () {
  var VW = 390, VH = 844;
  var canvas = document.getElementById('gameCanvas');
  function resize() {
    var wrap = document.getElementById('canvasWrap');
    var wW = wrap ? wrap.clientWidth : window.innerWidth;
    var wH = wrap ? wrap.clientHeight : window.innerHeight;
    var s = Math.min(wW / VW, wH / VH);
    canvas.width = VW; canvas.height = VH;
    canvas.style.width = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 100); });
  try { Audio.init(); } catch(e) {}
  try { AdManager.init(); } catch(e) {}
  var _paused = false, _logoRot = 0, _logoRaf = null;
  function _drawLogo() {
    var lc = document.getElementById('logoCanvas'); if (!lc) return;
    var lx = lc.getContext('2d'), cx=55, cy=55, r=38;
    lx.clearRect(0,0,110,110); _logoRot += 0.012;
    var hg = lx.createRadialGradient(cx,cy,0,cx,cy,r*1.5);
    hg.addColorStop(0,'rgba(168,237,234,.2)'); hg.addColorStop(1,'rgba(168,237,234,0)');
    lx.fillStyle=hg; lx.beginPath(); lx.arc(cx,cy,r*1.5,0,Math.PI*2); lx.fill();
    lx.shadowBlur=20; lx.shadowColor='#a8edea';
    var sg = lx.createRadialGradient(cx,cy,0,cx,cy,r);
    sg.addColorStop(0,'#fff'); sg.addColorStop(0.38,'#a8edea');
    sg.addColorStop(0.72,'#6C8EEF'); sg.addColorStop(1,'rgba(20,20,80,0)');
    lx.fillStyle=sg; lx.beginPath();
    for (var i=0;i<16;i++) {
      var a=(i*Math.PI/8)+_logoRot, rr=i%2===0?r:r*0.36;
      var px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr;
      i===0?lx.moveTo(px,py):lx.lineTo(px,py);
    }
    lx.closePath(); lx.fill();
    lx.shadowBlur=10; lx.shadowColor='#fff'; lx.fillStyle='rgba(255,255,255,.9)';
    lx.beginPath(); lx.arc(cx,cy,r*0.12,0,Math.PI*2); lx.fill(); lx.shadowBlur=0;
    if (!document.getElementById('settingsOverlay').classList.contains('hidden'))
      _logoRaf = requestAnimationFrame(_drawLogo);
  }
  function _updateMuteUI() {
    var m = Audio.isMuted ? Audio.isMuted() : false;
    var b1 = document.getElementById('btnMute'); if (!b1) return;
    var b2 = document.getElementById('btnMuteInSettings');
    b1.innerHTML = m ? '&#128263;' : '&#128266;';
    b1.classList.toggle('muted', m);
    if (b2) { b2.innerHTML = (m ? '&#128263;&nbsp; MUTED' : '&#128266;&nbsp; SOUND ON'); b2.classList.toggle('muted', m); }
  }
  function _openSettings() {
    _paused = true;
    document.getElementById('settingsOverlay').classList.remove('hidden');
    _updateMuteUI();
  (function () {
    var elI = document.getElementById('btnInfo');
    var elIO = document.getElementById('infoOverlay');
    var elIC = document.getElementById('btnInfoClose');
    if (elI) elI.addEventListener('click', function () { if (elIO) elIO.classList.remove('hidden'); });
    if (elIC) elIC.addEventListener('click', function () { if (elIO) elIO.classList.add('hidden'); });
    if (elIO) elIO.addEventListener('click', function (e) { if (e.target === this) elIO.classList.add('hidden'); });
  })();
    if (_logoRaf) cancelAnimationFrame(_logoRaf);
    _drawLogo();
  }
  function _closeSettings() {
    _paused = false;
    document.getElementById('settingsOverlay').classList.add('hidden');
    if (_logoRaf) { cancelAnimationFrame(_logoRaf); _logoRaf = null; }
    prev = performance.now();
  }
  (function () {
    var elS = document.getElementById('btnSettings'), elR = document.getElementById('btnResume');
    var elO = document.getElementById('settingsOverlay'), elM = document.getElementById('btnMute');
    var elMS = document.getElementById('btnMuteInSettings');
    if (elS) elS.addEventListener('click', _openSettings);
    if (elR) elR.addEventListener('click', _closeSettings);
    if (elO) elO.addEventListener('click', function (e) { if (e.target === this) _closeSettings(); });
    if (elM) elM.addEventListener('click', function () {
      if (Audio.toggle) Audio.toggle(); else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      _updateMuteUI();
    });
    if (elMS) elMS.addEventListener('click', function () {
      if (Audio.toggle) Audio.toggle(); else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      _updateMuteUI();
    });
  })();
  _updateMuteUI();

  var best = 0;
  try { best = parseInt(localStorage.getItem('blockblast_best'), 10) || 0; } catch(e) {}
  BlockBlast.init(canvas, best);

  function toVirtual(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (VW / rect.width), y: (e.clientY - rect.top) * (VH / rect.height) };
  }
  var _pDown = false;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault(); _pDown = true;
    var p = toVirtual(e);
    BlockBlast.tap(p.x, p.y);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!_pDown) return;
    e.preventDefault();
    var p = toVirtual(e);
    BlockBlast.tap(p.x, p.y);
  });
  canvas.addEventListener('pointerup', function () { _pDown = false; });
  canvas.addEventListener('pointercancel', function () { _pDown = false; });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); BlockBlast.tap(VW / 2, VH / 2); }
  });

  var prev = 0;
  function loop(ts) {
    var dt = Math.min((ts - prev) / 1000, 0.05); prev = ts;
    if (!_paused) { BlockBlast.update(dt); }
    BlockBlast.draw();
    var b = BlockBlast.getBest ? BlockBlast.getBest() : 0;
    if (b > best) { best = b; try { localStorage.setItem('blockblast_best', String(best)); } catch(e) {} }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(function (ts) { prev = ts; requestAnimationFrame(loop); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) prev = performance.now(); });
})();
