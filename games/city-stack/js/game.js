'use strict';
var CityStack = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score;
  var PLATFORM_Y = 720;   // y of the ground platform top
  var PLATFORM_H = 80;    // height of ground/each stacked block
  var slider;             // {x, w, h, color, spd, dir}
  var stack;              // [{x, w, h, color, y}] bottom to top
  var fallingSlabs;       // overhang falling off [{x,y,w,h,vy,color}]
  var particles;
  var BLOCK_H_MIN = 24, BLOCK_H_MAX = 52;
  var BASE_W = 210;
  var SLIDER_Y;
  var speed;

  var NEON = ['#00fff7','#ff00cc','#39ff14','#ffe600','#ff6600','#cc00ff','#0099ff'];

  function _pickColor() { return NEON[Math.floor(Math.random() * NEON.length)]; }

  function _reset() { state = 'MENU'; score = 0; }

  function _stackTop() {
    if (stack.length === 0) return { x: VW / 2 - BASE_W / 2, w: BASE_W, y: PLATFORM_Y, color: '#004466' };
    var top = stack[stack.length - 1];
    return top;
  }

  function _newSlider(prevTop) {
    var bh = BLOCK_H_MIN + Math.floor(Math.random() * (BLOCK_H_MAX - BLOCK_H_MIN + 1));
    SLIDER_Y = prevTop.y - bh;
    speed = Math.min(280, 80 + score * 12);
    return {
      x: 0,
      w: prevTop.w,
      h: bh,
      color: _pickColor(),
      spd: speed,
      dir: 1
    };
  }

  function _startGame() {
    state = 'PLAYING';
    score = 0;
    particles = [];
    fallingSlabs = [];
    stack = [];
    // Ground block
    var groundW = BASE_W;
    var groundX = Math.floor(VW / 2 - groundW / 2);
    stack.push({ x: groundX, w: groundW, h: PLATFORM_H, y: PLATFORM_Y, color: '#004466' });
    slider = _newSlider(_stackTop());
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function _spawnParticles(bx, by, bw, bh, color) {
    for (var i = 0; i < 14; i++) {
      var px = bx + Math.random() * bw;
      var py = by + Math.random() * bh;
      var ang = Math.random() * Math.PI * 2;
      var spd = 50 + Math.random() * 120;
      particles.push({ x: px, y: py, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40, life: 0.9, maxLife: 0.9, color: color, r: 3 + Math.random() * 3 });
    }
  }

  function init(canvas, savedBest) {
    ctx = canvas.getContext('2d');
    best = savedBest || 0;
    _reset();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    // Move slider
    slider.x += slider.spd * slider.dir * dt;
    if (slider.x + slider.w > VW) { slider.x = VW - slider.w; slider.dir = -1; }
    if (slider.x < 0) { slider.x = 0; slider.dir = 1; }

    // Falling slabs
    for (var i = fallingSlabs.length - 1; i >= 0; i--) {
      var fs = fallingSlabs[i];
      fs.vy += 500 * dt;
      fs.y += fs.vy * dt;
      if (fs.y > VH + 100) fallingSlabs.splice(i, 1);
    }

    // Particles
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var p = particles[pi];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(pi, 1);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { _startGame(); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function () { _startGame(); }); } catch (e) { _startGame(); }
      return;
    }
    if (state !== 'PLAYING') return;

    var prev = _stackTop();
    // Calculate overlap
    var overlapStart = Math.max(slider.x, prev.x);
    var overlapEnd = Math.min(slider.x + slider.w, prev.x + prev.w);
    var overlapW = overlapEnd - overlapStart;

    if (overlapW <= 0) {
      // Complete miss
      state = 'DEAD';
      if (score > best) best = score;
      try { Audio.play('lose'); } catch (e) {}
      try { AdManager.gameplayStop(); } catch (e) {}
      try { AdManager.onRunEnd(); } catch (e) {}
      return;
    }

    if (overlapW < 15) {
      // Too thin
      state = 'DEAD';
      if (score > best) best = score;
      try { Audio.play('crash'); } catch (e) {}
      try { AdManager.gameplayStop(); } catch (e) {}
      try { AdManager.onRunEnd(); } catch (e) {}
      return;
    }

    // Spawn falling overhang slabs
    if (slider.x < prev.x) {
      // Left overhang
      fallingSlabs.push({ x: slider.x, y: SLIDER_Y, w: prev.x - slider.x, h: slider.h, vy: 0, color: slider.color });
    }
    if (slider.x + slider.w > prev.x + prev.w) {
      // Right overhang
      var rx = prev.x + prev.w;
      fallingSlabs.push({ x: rx, y: SLIDER_Y, w: (slider.x + slider.w) - rx, h: slider.h, vy: 0, color: slider.color });
    }

    // Add new block to stack
    var newBlock = {
      x: overlapStart,
      w: overlapW,
      h: slider.h,
      y: SLIDER_Y,
      color: slider.color
    };
    stack.push(newBlock);
    score++;

    _spawnParticles(overlapStart, SLIDER_Y, overlapW, slider.h, slider.color);

    // Check if stack is getting too high — scroll if needed
    if (SLIDER_Y < 300) {
      // Shift everything down
      var shift = 300 - SLIDER_Y;
      for (var si = 0; si < stack.length; si++) stack[si].y += shift;
      SLIDER_Y += shift;
    }

    try { Audio.play('land'); } catch (e) {}

    // New slider based on new top
    slider = _newSlider(_stackTop());
  }

  function _drawBuilding(bx, by, bw, bh, color) {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    // Main fill with gradient
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(4,5,14,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;

    // Windows
    var winW = 7, winH = 9, winGapX = 5, winGapY = 7;
    var winStartX = bx + winGapX;
    var winStartY = by + winGapY;
    var cols = Math.floor((bw - winGapX) / (winW + winGapX));
    var rows = Math.floor((bh - winGapY) / (winH + winGapY));
    for (var wr = 0; wr < rows; wr++) {
      for (var wc = 0; wc < cols; wc++) {
        var wx = winStartX + wc * (winW + winGapX);
        var wy = winStartY + wr * (winH + winGapY);
        var lit = Math.random() > 0.25;
        ctx.fillStyle = lit ? 'rgba(255,255,180,0.7)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(wx, wy, winW, winH);
      }
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    // Stars bg
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (var si = 0; si < 60; si++) {
      var sx = (si * 137.5 + 10) % VW;
      var sy = (si * 97.3 + 20) % (VH * 0.85);
      ctx.fillRect(sx, sy, 1, 1);
    }

    if (state === 'MENU') { _drawMenu(); return; }

    // Ground
    ctx.save();
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(0, PLATFORM_Y + PLATFORM_H, VW, VH - PLATFORM_Y - PLATFORM_H);
    ctx.strokeStyle = '#00fff7';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00fff7';
    ctx.beginPath();
    ctx.moveTo(0, PLATFORM_Y + PLATFORM_H);
    ctx.lineTo(VW, PLATFORM_Y + PLATFORM_H);
    ctx.stroke();
    ctx.restore();

    // Stack
    for (var bi = 0; bi < stack.length; bi++) {
      var b = stack[bi];
      _drawBuilding(b.x, b.y, b.w, b.h, b.color);
    }

    // Falling slabs
    for (var fi = 0; fi < fallingSlabs.length; fi++) {
      var fs = fallingSlabs[fi];
      ctx.save();
      ctx.globalAlpha = 0.75;
      _drawBuilding(fs.x, fs.y, fs.w, fs.h, fs.color);
      ctx.restore();
    }

    // Slider
    if (state === 'PLAYING') {
      _drawBuilding(slider.x, SLIDER_Y, slider.w, slider.h, slider.color);
      // Drop guide line
      var prev = _stackTop();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(prev.x, SLIDER_Y + slider.h);
      ctx.lineTo(prev.x, prev.y);
      ctx.stroke();
      ctx.moveTo(prev.x + prev.w, SLIDER_Y + slider.h);
      ctx.lineTo(prev.x + prev.w, prev.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Particles
    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px system-ui';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#00fff7';
    ctx.fillText(score, VW / 2, 56);
    ctx.fillStyle = 'rgba(255,230,0,0.7)';
    ctx.font = '13px system-ui';
    ctx.shadowBlur = 0;
    ctx.fillText('BEST ' + best, VW / 2, 76);
    ctx.restore();

    if (state === 'DEAD') _drawDead();
  }

  function _drawMenu() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00fff7';
    ctx.fillStyle = '#00fff7';
    ctx.fillText('CITY', VW / 2, VH / 2 - 55);
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.fillText('STACK', VW / 2, VH / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '15px system-ui';
    ctx.fillText('Tap to drop the building block!', VW / 2, VH / 2 + 72);
    ctx.fillText('Stack as high as you can.', VW / 2, VH / 2 + 95);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 160);
    if (best > 0) {
      ctx.fillStyle = 'rgba(255,230,0,0.7)';
      ctx.font = '15px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 200);
    }
    ctx.restore();
  }

  function _drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,14,0.8)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff00cc';
    ctx.fillStyle = '#ff00cc';
    ctx.fillText('GAME', VW / 2, VH / 2 - 60);
    ctx.fillStyle = '#ff6600';
    ctx.shadowColor = '#ff6600';
    ctx.fillText('OVER', VW / 2, VH / 2 + 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 + 62);
    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.font = '16px system-ui';
    ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 95);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 155);
    ctx.restore();
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
