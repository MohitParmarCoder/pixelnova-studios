'use strict';
var LavaSurf = (function () {

  var canvas, ctx;
  var state; // MENU, PLAYING, DEAD
  var best;

  var VW = 390;
  var VH = 844;

  // lava baseline
  var LAVA_BASE = 720;
  // surfboard / character y
  var charX, charY, charVY;
  var CHAR_W = 48;
  var CHAR_H = 24;
  var CHAR_X = 90;
  var GRAVITY = 1800;
  var JUMP_VEL = -820;
  var onSurf; // on the lava surface

  // lava wave
  var wavePhase;
  var lavaPoints; // array of y offsets for lava surface
  var LAVA_SEGS = 20;

  // rocks
  var rocks; // {x, h} — height above lava
  var nextRockDist;

  // game
  var scrollX;
  var speed;
  var SPEED_BASE = 250;
  var score;
  var scoreFrac;

  function getLavaY(screenX) {
    // interpolate lava y at given screen x
    var segW = VW / LAVA_SEGS;
    var idx = Math.floor(screenX / segW);
    idx = Math.max(0, Math.min(LAVA_SEGS - 2, idx));
    var t = (screenX - idx * segW) / segW;
    var y0 = LAVA_BASE + lavaPoints[idx];
    var y1 = LAVA_BASE + lavaPoints[idx + 1];
    return y0 + (y1 - y0) * t;
  }

  function resetGame() {
    scrollX = 0;
    speed = SPEED_BASE;
    score = 0;
    scoreFrac = 0;
    rocks = [];
    nextRockDist = 350;
    wavePhase = 0;

    lavaPoints = [];
    var i;
    for (i = 0; i <= LAVA_SEGS; i++) {
      lavaPoints.push(0);
    }

    charX = CHAR_X;
    charY = LAVA_BASE - CHAR_H;
    charVY = 0;
    onSurf = true;
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    resetGame();
  }

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    var m = 5;
    return ax + m < bx + bw - m && ax + aw - m > bx + m &&
           ay + m < by + bh - m && ay + ah - m > by + m;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    speed = SPEED_BASE + score * 0.6;
    scrollX += speed * dt;
    scoreFrac += speed * dt / 100;
    score = Math.floor(scoreFrac);

    // update lava wave
    wavePhase += dt * 1.8;
    var i;
    for (i = 0; i <= LAVA_SEGS; i++) {
      var nx = (i / LAVA_SEGS) * Math.PI * 4;
      lavaPoints[i] = Math.sin(wavePhase + nx) * 22 +
                      Math.sin(wavePhase * 1.7 + nx * 0.6) * 12;
    }

    // lava y at character x
    var lavaY = getLavaY(CHAR_X);

    // gravity
    charVY += GRAVITY * dt;
    charY += charVY * dt;

    if (charY + CHAR_H >= lavaY) {
      charY = lavaY - CHAR_H;
      charVY = 0;
      onSurf = true;
    } else {
      onSurf = false;
    }

    // move rocks
    for (i = rocks.length - 1; i >= 0; i--) {
      rocks[i].x -= speed * dt;
      if (rocks[i].x + rocks[i].w < -20) rocks.splice(i, 1);
    }

    // spawn rocks
    nextRockDist -= speed * dt;
    if (nextRockDist <= 0) {
      var rh = 40 + Math.random() * 60;
      var rw = 24 + Math.random() * 20;
      var lavaAtSpawn = getLavaY(VW + 40);
      rocks.push({ x: VW + 30, w: rw, h: rh, ry: lavaAtSpawn - rh });
      nextRockDist = 240 + Math.random() * 280;
    }

    // collision
    for (i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var ry = getLavaY(r.x + r.w / 2) - r.h;
      if (rectOverlap(charX, charY, CHAR_W, CHAR_H, r.x, ry, r.w, r.h)) {
        die();
        return;
      }
    }

    // char fell into lava (shouldn't happen normally but safety check)
    if (charY > VH) {
      die();
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('crash'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') {
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (state === 'DEAD') {
      resetGame();
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (state === 'PLAYING' && onSurf) {
      charVY = JUMP_VEL;
      onSurf = false;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ---- drawing ----
  function drawBg() {
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#1a0500');
    grad.addColorStop(0.4, '#7f1300');
    grad.addColorStop(0.7, '#bf360c');
    grad.addColorStop(1, '#e64a19');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // embers
    var time = scrollX / 200;
    var i;
    for (i = 0; i < 18; i++) {
      var ex = ((i * 71 + scrollX * (0.1 + i * 0.02)) % (VW + 40)) - 20;
      var ey = ((i * 113 + time * 30) % (LAVA_BASE)) + 10;
      var alpha = 0.4 + Math.sin(time * 3 + i) * 0.3;
      ctx.fillStyle = 'rgba(255,' + Math.floor(100 + i * 8) + ',0,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(ex, ey, 2 + Math.sin(time * 2 + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLava() {
    var segW = VW / LAVA_SEGS;
    // lava surface gradient fill
    var grad = ctx.createLinearGradient(0, LAVA_BASE - 30, 0, VH);
    grad.addColorStop(0, '#ff6f00');
    grad.addColorStop(0.3, '#e64a19');
    grad.addColorStop(1, '#bf360c');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, getLavaY(0));
    var i;
    for (i = 0; i <= LAVA_SEGS; i++) {
      ctx.lineTo(i * segW, LAVA_BASE + lavaPoints[i]);
    }
    ctx.lineTo(VW, VH);
    ctx.lineTo(0, VH);
    ctx.closePath();
    ctx.fill();

    // bright glow line on top of lava
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, getLavaY(0));
    for (i = 1; i <= LAVA_SEGS; i++) {
      ctx.lineTo(i * segW, LAVA_BASE + lavaPoints[i]);
    }
    ctx.stroke();

    // lava bubbles
    for (i = 0; i < 5; i++) {
      var bx2 = ((i * 80 + scrollX * 0.15) % VW);
      var bphase = (scrollX * 0.03 + i) % (Math.PI * 2);
      var br = 8 + Math.sin(bphase) * 4;
      var bly = getLavaY(bx2) - br;
      ctx.fillStyle = 'rgba(255,160,0,0.7)';
      ctx.beginPath();
      ctx.arc(bx2, bly, br, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRocks() {
    var i;
    for (i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var ry = getLavaY(r.x + r.w / 2) - r.h;
      // rock shape
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(r.x, ry, r.w, r.h);
      // highlight
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(r.x + 3, ry + 3, r.w * 0.4, r.h * 0.3);
      // glowing base
      ctx.fillStyle = '#ff6f00';
      ctx.fillRect(r.x, ry + r.h - 4, r.w, 4);
    }
  }

  function drawChar() {
    // surfboard
    ctx.fillStyle = '#ff7043';
    ctx.beginPath();
    ctx.moveTo(charX - 8, charY + CHAR_H);
    ctx.lineTo(charX + CHAR_W + 8, charY + CHAR_H);
    ctx.lineTo(charX + CHAR_W + 4, charY + CHAR_H - 6);
    ctx.lineTo(charX - 4, charY + CHAR_H - 6);
    ctx.closePath();
    ctx.fill();

    // character body on board
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(charX + 8, charY, 20, CHAR_H - 6);
    // helmet
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(charX + 6, charY - 10, 24, 14);
    // visor
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(charX + 10, charY - 6, 16, 7);
    // arms out for balance
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(charX - 2, charY + 4, 10, 6);
    ctx.fillRect(charX + CHAR_W - 8, charY + 4, 10, 6);
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 16, 38);
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + best, VW - 16, 38);
  }

  function drawMenu() {
    drawBg();
    drawLava();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ff7043';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAVA', VW / 2, 310);
    ctx.fillText('SURF', VW / 2, 375);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, 470);

    if (best > 0) {
      ctx.fillStyle = '#ffeb3b';
      ctx.font = '22px monospace';
      ctx.fillText('BEST: ' + best, VW / 2, 520);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ff7043';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BURNED!', VW / 2, 340);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SCORE: ' + score, VW / 2, 410);

    ctx.fillStyle = '#ffeb3b';
    ctx.font = '24px monospace';
    ctx.fillText('BEST: ' + best, VW / 2, 450);

    ctx.fillStyle = '#80cbc4';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    if (state === 'MENU') {
      drawMenu();
      return;
    }
    drawBg();
    drawLava();
    drawRocks();
    drawChar();
    drawHUD();
    if (state === 'DEAD') {
      drawDead();
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
