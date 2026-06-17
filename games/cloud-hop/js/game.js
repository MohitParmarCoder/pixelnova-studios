'use strict';
var CloudHop = (function () {

  var canvas, ctx;
  var state; // MENU, PLAYING, DEAD
  var best;

  var VW = 390;
  var VH = 844;

  // character
  var cx2, cy2, cvx, cvy;
  var CW = 28;
  var CH = 32;
  var GRAVITY = 1600;
  var JUMP_VEL = -720;

  // clouds
  var clouds; // {x, y, w} — y in screen coords (clouds scroll down)
  var CLOUD_H = 18;
  var CLOUD_SPEED_BASE = 70;
  var cloudSpeed;

  // scroll / score
  var totalHeight;
  var score;

  var GEN_TOP = -60; // generate clouds above this screen y

  function genClouds() {
    // fill from top up to GEN_TOP
    while (true) {
      // find the topmost cloud y
      var minY = VH;
      var i;
      for (i = 0; i < clouds.length; i++) {
        if (clouds[i].y < minY) minY = clouds[i].y;
      }
      if (minY <= GEN_TOP) break;
      var w = 70 + Math.random() * 100;
      var x = Math.random() * (VW - w);
      var newY = minY - (80 + Math.random() * 60);
      clouds.push({ x: x, y: newY, w: w });
    }
  }

  function resetGame() {
    totalHeight = 0;
    score = 0;
    cloudSpeed = CLOUD_SPEED_BASE;
    clouds = [];

    // start cloud right under character
    clouds.push({ x: VW / 2 - 70, y: VH - 180, w: 140 });
    clouds.push({ x: 30, y: VH - 300, w: 100 });
    clouds.push({ x: 200, y: VH - 420, w: 110 });
    clouds.push({ x: 60, y: VH - 540, w: 90 });
    clouds.push({ x: 220, y: VH - 650, w: 120 });

    genClouds();

    cx2 = VW / 2 - CW / 2;
    cy2 = VH - 180 - CH;
    cvx = 0;
    cvy = 0;
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    resetGame();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    cloudSpeed = CLOUD_SPEED_BASE + totalHeight * 0.01;
    var scrollDelta = cloudSpeed * dt;

    // move clouds down (world scrolls down as player goes up)
    var i;
    for (i = 0; i < clouds.length; i++) {
      clouds[i].y += scrollDelta;
    }

    // move character with world (keep screen position)
    cy2 += scrollDelta;
    totalHeight += scrollDelta;
    score = Math.floor(totalHeight / 60);

    // physics
    cvy += GRAVITY * dt;
    cx2 += cvx * dt;
    cy2 += cvy * dt;

    // wall wrap
    if (cx2 + CW < 0) cx2 = VW;
    if (cx2 > VW) cx2 = -CW;

    // cloud collision (landing on top)
    for (i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      if (cvy >= 0 &&
          cx2 + CW > cl.x && cx2 < cl.x + cl.w &&
          cy2 + CH >= cl.y && cy2 + CH <= cl.y + CLOUD_H + 15) {
        cy2 = cl.y - CH;
        cvy = JUMP_VEL * (0.85 + Math.random() * 0.2);
        cvx *= 0.5;
        try { Audio.play('tap'); } catch (e) {}
        break;
      }
    }

    // cull clouds below screen
    for (i = clouds.length - 1; i >= 0; i--) {
      if (clouds[i].y > VH + 40) clouds.splice(i, 1);
    }

    genClouds();

    // fall off bottom = dead
    if (cy2 > VH + 50) {
      die();
    }

    // don't let player go above top (slight squeeze)
    if (cy2 < 0) {
      cy2 = 0;
      cvy = Math.abs(cvy) * 0.5;
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('lose'); } catch (e) {}
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
    if (state === 'PLAYING') {
      // horizontal push based on which side tapped
      if (x < VW / 2) {
        cvx = -220;
      } else {
        cvx = 220;
      }
      // boost upward slightly on tap
      if (cvy > 0) cvy = JUMP_VEL * 0.6;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ---- drawing ----
  function drawBg() {
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#1565c0');
    grad.addColorStop(0.5, '#42a5f5');
    grad.addColorStop(1, '#90caf9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // sun
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(60, 80, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff176';
    ctx.beginPath();
    ctx.arc(60, 80, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCloud(x, y, w) {
    var h = CLOUD_H;
    var puffR = h * 1.2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    // base rectangle
    ctx.fillRect(x, y, w, h);
    // rounded top puffs
    ctx.beginPath();
    ctx.arc(x + w * 0.2, y, puffR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y - 6, puffR * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.8, y, puffR, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + 6, y - 4, w - 12, 6);
  }

  function drawClouds() {
    var i;
    for (i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      if (cl.y < -40 || cl.y > VH + 40) continue;
      drawCloud(cl.x, cl.y, cl.w);
    }
  }

  function drawCharacter() {
    // body (rounded square person)
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(cx2, cy2, CW, CH);
    // head
    ctx.fillStyle = '#ffccbc';
    ctx.fillRect(cx2 + 4, cy2 - 18, CW - 8, 18);
    // scarf
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(cx2, cy2 + 2, CW, 6);
    // eyes
    ctx.fillStyle = '#37474f';
    ctx.fillRect(cx2 + 5, cy2 - 13, 5, 5);
    ctx.fillRect(cx2 + 16, cy2 - 13, 5, 5);
    // arms
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(cx2 - 8, cy2 + 6, 8, 5);
    ctx.fillRect(cx2 + CW, cy2 + 6, 8, 5);
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HEIGHT ' + score, 16, 38);
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + best, VW - 16, 38);
  }

  function drawMenu() {
    drawBg();
    drawClouds();
    ctx.fillStyle = 'rgba(0,0,50,0.4)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#e3f2fd';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLOUD', VW / 2, 310);
    ctx.fillText('HOP', VW / 2, 375);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, 470);

    if (best > 0) {
      ctx.fillStyle = '#fff9c4';
      ctx.font = '22px monospace';
      ctx.fillText('BEST: ' + best, VW / 2, 520);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#90caf9';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FELL!', VW / 2, 340);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('HEIGHT: ' + score, VW / 2, 410);

    ctx.fillStyle = '#fff9c4';
    ctx.font = '24px monospace';
    ctx.fillText('BEST: ' + best, VW / 2, 450);

    ctx.fillStyle = '#a5d6a7';
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
    drawClouds();
    drawCharacter();
    drawHUD();
    if (state === 'DEAD') {
      drawDead();
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
