'use strict';

(function () {
  const VW = 390, VH = 844;
  const canvas = document.getElementById('gameCanvas');

  // ── Letterbox: scale 390x844 to fit window ───────────────────────────────────
  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.width  = VW;
    canvas.height = VH;
    canvas.style.width  = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // ── Init modules ─────────────────────────────────────────────────────────────
  try { Audio.init();

  // ── Settings/Pause + Mute buttons — capture phase ─────────────────────────
  var _settingsOpen = false;
  var _settingsTime = 0;
  canvas.addEventListener('pointerdown', function(ev) {
    var rect = canvas.getBoundingClientRect();
    var vx = (ev.clientX - rect.left) * (VW / rect.width);
    var vy = (ev.clientY - rect.top)  * (VH / rect.height);
    // Settings/Pause button (top-left, 35,38)
    if (Math.hypot(vx - 35, vy - 38) <= 30) {
      ev.stopImmediatePropagation();
      _settingsOpen = !_settingsOpen;
      return;
    }
    // Mute button (top-right, 355,38)
    if (!_settingsOpen && Math.hypot(vx - 355, vy - 38) <= 30) {
      ev.stopImmediatePropagation();
      if (Audio.toggle) Audio.toggle();
      else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      return;
    }
    // When settings overlay open — handle resume + mute toggle inside overlay
    if (_settingsOpen) {
      // Resume button ~(VW/2, VH*0.72)
      if (vx > VW/2 - 80 && vx < VW/2 + 80 && vy > VH*0.69 && vy < VH*0.75) {
        _settingsOpen = false;
      }
      // Mute toggle inside settings ~(VW/2, VH*0.55)
      if (Math.hypot(vx - VW/2, vy - VH * 0.55) <= 36) {
        if (Audio.toggle) Audio.toggle();
        else if (Audio.setMuted && Audio.isMuted) Audio.setMuted(!Audio.isMuted());
      }
      ev.stopImmediatePropagation();
      return;
    }
  }, true);

 } catch (e) {}
  try { AdManager.init(); } catch (e) {}

  let best = 0;
  try { best = parseInt(localStorage.getItem('skyhopper_best'), 10) || 0; } catch (e) {}

  SkyHopper.init(canvas, best);

  // ── Convert a clientX to virtual canvas x ────────────────────────────────────
  function toVirtualX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(VW, sx * VW));
  }

  // ── Pointer: tap to play/retry + drag to steer ───────────────────────────────
  let dragging = false;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    SkyHopper.tap();
    if (SkyHopper.getState() === 'PLAYING') {
      SkyHopper.setTiltX(toVirtualX(e.clientX));
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (SkyHopper.getState() === 'PLAYING') {
      SkyHopper.setTiltX(toVirtualX(e.clientX));
    }
  }, { passive: false });

  function endDrag(e) {
    dragging = false;
    if (e && e.pointerId != null) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const keys = { left: false, right: false };

  document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') { SkyHopper.tap(); e.preventDefault(); }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  // ── Persist best when it increases ───────────────────────────────────────────
  function persistBest() {
    const b = SkyHopper.getBest();
    if (b > best) {
      best = b;
      try { localStorage.setItem('skyhopper_best', String(best)); } catch (e) {}
    }
  }

  // ── rAF loop ─────────────────────────────────────────────────────────────────
  let prev = 0;

  function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;

    // Held keyboard steering.
    if (SkyHopper.getState() === 'PLAYING') {
      const sp = 380 * dt;
      if (keys.left) SkyHopper.nudge(-sp);
      if (keys.right) SkyHopper.nudge(sp);
    }

    if (!_settingsOpen) { SkyHopper.update(dt); }
    SkyHopper.draw();

    // ── Full overlay: PixelNova branding + Settings/Pause ─────────────────────
    (function drawPNOverlay() {
      var c = canvas.getContext('2d');
      var gs = SkyHopper.getState ? SkyHopper.getState() : '';
      // PixelNova branding on MENU screen bottom
      if (gs === 'MENU' || gs === 'DEAD' || gs === 'WIN') {
        c.save();
        c.textAlign = 'center';
        c.globalAlpha = 0.5;
        c.fillStyle = '#a8edea';
        c.font = 'bold 13px system-ui,sans-serif';
        c.fillText('\u2605 PixelNova Studios \u2605', VW/2, VH - 30);
        c.globalAlpha = 0.32;
        c.fillStyle = '#ffffff';
        c.font = '10px system-ui,sans-serif';
        c.fillText('pixelnovastudios.github.io', VW/2, VH - 14);
        c.restore();
      }
      // Settings/Pause button icon (top-left)
      if (gs !== '') {
        var mx = 35, my = 38, mr = 22;
        c.save();
        c.globalAlpha = 0.88;
        c.fillStyle = '#111827';
        c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#374151'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#d1fae5'; c.strokeStyle = '#d1fae5'; c.lineWidth = 2.5;
        if (_settingsOpen) {
          c.beginPath(); c.moveTo(mx-7,my-7); c.lineTo(mx+7,my+7); c.stroke();
          c.beginPath(); c.moveTo(mx+7,my-7); c.lineTo(mx-7,my+7); c.stroke();
        } else {
          c.fillRect(mx-7, my-6, 14, 2.5);
          c.fillRect(mx-7, my-1, 14, 2.5);
          c.fillRect(mx-7, my+4,  14, 2.5);
        }
        c.restore();
      }
      // Mute button icon (top-right)
      if (!_settingsOpen && gs !== '') {
        var sx = 355, sy = 38, sr = 22;
        c.save();
        c.globalAlpha = 0.88;
        c.fillStyle = '#111827';
        c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#374151'; c.lineWidth = 1.5; c.stroke();
        var muted = Audio.isMuted ? Audio.isMuted() : false;
        c.lineWidth = 2.5;
        if (muted) {
          c.strokeStyle = '#f87171';
          c.beginPath(); c.moveTo(sx-8,sy-8); c.lineTo(sx+8,sy+8); c.stroke();
          c.beginPath(); c.moveTo(sx+8,sy-8); c.lineTo(sx-8,sy+8); c.stroke();
        } else {
          c.fillStyle = c.strokeStyle = '#86efac';
          c.beginPath();
          c.moveTo(sx-10,sy-4); c.lineTo(sx-4,sy-4);
          c.lineTo(sx+4,sy-10); c.lineTo(sx+4,sy+10);
          c.lineTo(sx-4,sy+4);  c.lineTo(sx-10,sy+4); c.closePath();
          c.fill();
          c.beginPath(); c.arc(sx+4,sy,5,-0.7,0.7); c.stroke();
          c.beginPath(); c.arc(sx+4,sy,10,-0.7,0.7); c.stroke();
        }
        c.restore();
      }
      // Full settings overlay
      if (_settingsOpen) {
        _settingsTime += 1/60;
        c.save();
        c.fillStyle = 'rgba(4,5,16,0.97)';
        c.fillRect(0, 0, VW, VH);
        // Rotating 8-point star logo
        var rot = _settingsTime * 0.40;
        var lx = VW/2, ly = VH * 0.22, lr = 42;
        var hg = c.createRadialGradient(lx,ly,0,lx,ly,lr*1.7);
        hg.addColorStop(0,'rgba(168,237,234,.22)');
        hg.addColorStop(1,'rgba(168,237,234,0)');
        c.fillStyle = hg;
        c.beginPath(); c.arc(lx,ly,lr*1.7,0,Math.PI*2); c.fill();
        c.shadowBlur = 24; c.shadowColor = '#a8edea';
        var sg = c.createRadialGradient(lx,ly,0,lx,ly,lr);
        sg.addColorStop(0,'#ffffff');
        sg.addColorStop(0.38,'#a8edea');
        sg.addColorStop(0.72,'#6C8EEF');
        sg.addColorStop(1,'rgba(20,20,80,0)');
        c.fillStyle = sg;
        c.beginPath();
        for (var i=0;i<16;i++){
          var a=(i*Math.PI/8)+rot, rr=i%2===0?lr:lr*0.36;
          var px=lx+Math.cos(a)*rr, py=ly+Math.sin(a)*rr;
          i===0?c.moveTo(px,py):c.lineTo(px,py);
        }
        c.closePath(); c.fill();
        c.shadowBlur=12; c.shadowColor='#fff';
        c.fillStyle='rgba(255,255,255,.9)';
        c.beginPath(); c.arc(lx,ly,lr*0.13,0,Math.PI*2); c.fill();
        c.shadowBlur=0;
        // Company name
        c.textAlign='center';
        c.shadowBlur=14; c.shadowColor='#a8edea';
        c.fillStyle='#ffffff'; c.font='bold 27px system-ui,sans-serif';
        c.fillText('PixelNova', VW/2, VH*0.40);
        c.shadowBlur=0;
        c.fillStyle='rgba(168,237,234,.58)'; c.font='12px system-ui,sans-serif';
        c.fillText('S T U D I O S', VW/2, VH*0.445);
        c.fillStyle='rgba(255,255,255,.3)'; c.font='11px system-ui,sans-serif';
        c.fillText('Games crafted with passion', VW/2, VH*0.48);
        // Divider
        c.globalAlpha=0.2; c.strokeStyle='#a8edea'; c.lineWidth=1;
        c.beginPath(); c.moveTo(VW/2-90,VH*0.51); c.lineTo(VW/2+90,VH*0.51); c.stroke();
        c.globalAlpha=1;
        // Mute toggle inside settings
        var muteX=VW/2, muteY=VH*0.575;
        var muted2 = Audio.isMuted ? Audio.isMuted() : false;
        c.fillStyle = muted2 ? 'rgba(239,68,68,0.15)' : 'rgba(134,239,172,0.15)';
        c.beginPath(); c.arc(muteX,muteY,30,0,Math.PI*2); c.fill();
        c.strokeStyle = muted2?'#f87171':'#86efac'; c.lineWidth=1.5;
        c.beginPath(); c.arc(muteX,muteY,30,0,Math.PI*2); c.stroke();
        c.strokeStyle = c.fillStyle = muted2?'#f87171':'#86efac'; c.lineWidth=2.5;
        if (muted2) {
          c.beginPath(); c.moveTo(muteX-10,muteY-10); c.lineTo(muteX+10,muteY+10); c.stroke();
          c.beginPath(); c.moveTo(muteX+10,muteY-10); c.lineTo(muteX-10,muteY+10); c.stroke();
        } else {
          c.beginPath();
          c.moveTo(muteX-10,muteY-4); c.lineTo(muteX-4,muteY-4);
          c.lineTo(muteX+4,muteY-10); c.lineTo(muteX+4,muteY+10);
          c.lineTo(muteX-4,muteY+4); c.lineTo(muteX-10,muteY+4); c.closePath();
          c.fill();
          c.beginPath(); c.arc(muteX+4,muteY,6,-0.7,0.7); c.stroke();
          c.beginPath(); c.arc(muteX+4,muteY,11,-0.7,0.7); c.stroke();
        }
        c.fillStyle = muted2?'#f87171':'#86efac'; c.font='11px system-ui'; c.textAlign='center';
        c.fillText(muted2?'MUTED':'SOUND ON', muteX, muteY+46);
        // Divider
        c.globalAlpha=0.15; c.strokeStyle='#a8edea'; c.lineWidth=1;
        c.beginPath(); c.moveTo(VW/2-90,VH*0.665); c.lineTo(VW/2+90,VH*0.665); c.stroke();
        c.globalAlpha=1;
        // Resume button
        var btnY = VH*0.72;
        c.fillStyle='rgba(134,239,172,0.18)';
        c.beginPath();
        if(c.roundRect){c.roundRect(VW/2-80,btnY-27,160,54,12);}else{c.rect(VW/2-80,btnY-27,160,54);}
        c.fill();
        c.strokeStyle='#86efac'; c.lineWidth=1.5; c.stroke();
        c.fillStyle='#ffffff'; c.font='bold 16px system-ui'; c.textAlign='center';
        c.fillText('\u25b6  RESUME', VW/2, btnY+6);
        // Contact details
        c.globalAlpha=0.55; c.fillStyle='#a8edea'; c.font='11px system-ui,sans-serif';
        c.fillText('pixelnovastudios.github.io', VW/2, VH*0.835);
        c.globalAlpha=0.38; c.fillStyle='#ffffff'; c.font='10px system-ui,sans-serif';
        c.fillText('contact@pixelnovastudios.com', VW/2, VH*0.868);
        c.globalAlpha=0.25; c.fillStyle='#ffffff'; c.font='9px system-ui,sans-serif';
        c.fillText('\u00a9 2025 PixelNova Studios. All rights reserved.', VW/2, VH*0.93);
        c.globalAlpha=1;
        c.restore();
      }
    })();


    persistBest();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((ts) => {
    prev = ts;
    requestAnimationFrame(loop);
  });

  // Reset dt on visibility resume so pause doesn't cause a giant jump.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) prev = performance.now();
  });
})();
