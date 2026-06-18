'use strict';
var DinoDash = (function () {

  var canvas, ctx;
  var state; // MENU, PLAYING, DEAD
  var best;
  var lives;
  var invincTimer; // seconds remaining of invincibility after a hit

  var VW = 390;
  var VH = 844;

  var GROUND_Y = 700;

  // dino
  var dx, dy, dvy;
  var DW = 42;
  var DH = 52;
  var DINO_X = 80;
  var GRAVITY = 2400;
  var JUMP_VEL = -950;
  var onGround;

  // game
  var scrollX;
  var speed;
  var SPEED_BASE = 300;
  var score;
  var scoreFrac;

  // obstacles: {x, w, h, type} type='cactus' or 'bird'
  var obstacles;
  var nextObstDist;

  // ground details
  var groundDots;

  function spawnObstacle() {
    var type = Math.random() < 0.3 ? 'bird' : 'cactus';
    var h, w, oy;
    if (type === 'cactus') {
      h = 40 + Math.random() * 40;
      w = 18 + Math.random() * 14;
      // sometimes cluster of 2
      if (Math.random() < 0.3) {
        obstacles.push({ x: VW + 30, w: w, h: h, type: type });
        obstacles.push({ x: VW + 30 + w + 12, w: w - 4, h: h - 8, type: type });
      } else {
        obstacles.push({ x: VW + 30, w: w, h: h, type: type });
      }
    } else {
      h = 22;
      w = 38;
      oy = GROUND_Y - DH - 20 - Math.random() * 80;
      obstacles.push({ x: VW + 30, w: w, h: h, type: type, oy: oy });
    }
    nextObstDist = 280 + Math.random() * 300;
  }

  function resetGame() {
    scrollX = 0;
    speed = SPEED_BASE;
    score = 0;
    scoreFrac = 0;
    obstacles = [];
    nextObstDist = 400;
    lives = 3;
    invincTimer = 0;

    dx = DINO_X;
    dy = GROUND_Y - DH;
    dvy = 0;
    onGround = true;

    // ground decoration dots
    groundDots = [];
    var i;
    for (i = 0; i < 20; i++) {
      groundDots.push({ x: Math.random() * VW * 3, size: 2 + Math.random() * 3 });
    }
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    resetGame();
  }

  function rectOverlap(ax, ay, aw, ah, bx2, by2, bw, bh) {
    var margin = 6;
    return ax + margin < bx2 + bw - margin &&
           ax + aw - margin > bx2 + margin &&
           ay + margin < by2 + bh - margin &&
           ay + ah - margin > by2 + margin;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    speed = SPEED_BASE + score * 0.8;
    scrollX += speed * dt;
    scoreFrac += speed * dt / 100;
    score = Math.floor(scoreFrac);

    // gravity
    dvy += GRAVITY * dt;
    dy += dvy * dt;

    if (dy >= GROUND_Y - DH) {
      dy = GROUND_Y - DH;
      dvy = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    // move obstacles
    var i;
    for (i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed * dt;
      if (obstacles[i].x + obstacles[i].w < -20) {
        obstacles.splice(i, 1);
      }
    }

    // spawn
    nextObstDist -= speed * dt;
    if (nextObstDist <= 0) {
      spawnObstacle();
    }

    // invincibility countdown
    if (invincTimer > 0) {
      invincTimer -= dt;
      if (invincTimer < 0) invincTimer = 0;
    }

    // collision (skip while invincible)
    if (invincTimer <= 0) {
      for (i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        var ox = ob.x;
        var oy2, oh, ow;
        oy2 = ob.type === 'bird' ? ob.oy : (GROUND_Y - ob.h);
        oh = ob.h;
        ow = ob.w;
        if (rectOverlap(dx, dy, DW, DH, ox, oy2, ow, oh)) {
          hit();
          return;
        }
      }
    }
  }

  function hit() {
    lives -= 1;
    try { Audio.play('crash'); } catch (e) {}
    if (lives <= 0) {
      die();
    } else {
      invincTimer = 0.8; // 0.8 s of invincibility to recover
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) best = score;
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
    if (state === 'PLAYING' && onGround) {
      dvy = JUMP_VEL;
      onGround = false;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ---- drawing ----
  function drawBg() {
    // desert sky
    var grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, '#ffeaa7');
    grad.addColorStop(0.6, '#fdcb6e');
    grad.addColorStop(1, '#e17055');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, GROUND_Y);

    // sun
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(330, 100, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath();
    ctx.arc(330, 100, 35, 0, Math.PI * 2);
    ctx.fill();

    // distant mountains
    ctx.fillStyle = '#d4895a';
    var mPts = [0, GROUND_Y - 60, 80, GROUND_Y - 140, 160, GROUND_Y - 90,
                 240, GROUND_Y - 160, 320, GROUND_Y - 110, 390, GROUND_Y - 70, 390, GROUND_Y, 0, GROUND_Y];
    ctx.beginPath();
    ctx.moveTo(mPts[0], mPts[1]);
    var j;
    for (j = 2; j < mPts.length; j += 2) {
      ctx.lineTo(mPts[j], mPts[j + 1]);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    // sand ground
    ctx.fillStyle = '#c9884a';
    ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
    // ground top line
    ctx.fillStyle = '#e09a55';
    ctx.fillRect(0, GROUND_Y, VW, 6);
    // texture dots
    ctx.fillStyle = '#b5773f';
    var i;
    for (i = 0; i < groundDots.length; i++) {
      var gx = ((groundDots[i].x - scrollX * 0.3) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      ctx.fillRect(gx, GROUND_Y + 10 + i % 3 * 12, groundDots[i].size, groundDots[i].size);
    }
  }

  function drawCactus(x, w, h) {
    var baseY = GROUND_Y;
    // main trunk
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(x + w / 4, baseY - h, w / 2, h);
    // left arm
    ctx.fillRect(x, baseY - h * 0.65, w / 4 + 1, h * 0.25);
    ctx.fillRect(x, baseY - h * 0.65, w * 0.22, h * 0.12);
    // right arm
    ctx.fillRect(x + w * 0.65, baseY - h * 0.55, w / 4, h * 0.25);
    ctx.fillRect(x + w * 0.65, baseY - h * 0.55, w * 0.22, h * 0.12);
    // highlight
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x + w / 4 + 2, baseY - h, 4, h);
  }

  function drawBird(x, y, w, h, t) {
    var wingFlap = Math.sin(t * 8) * 0.4;
    ctx.fillStyle = '#636e72';
    // body
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // wings
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.4);
    ctx.lineTo(x - 12, y + h * (0.4 + wingFlap));
    ctx.lineTo(x + w * 0.3, y + h * 0.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y + h * 0.4);
    ctx.lineTo(x + w + 12, y + h * (0.4 + wingFlap));
    ctx.lineTo(x + w * 0.7, y + h * 0.6);
    ctx.fill();
    // beak
    ctx.fillStyle = '#fdcb6e';
    ctx.beginPath();
    ctx.moveTo(x + w, y + h * 0.4);
    ctx.lineTo(x + w + 12, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.6);
    ctx.fill();
  }

  function drawObstacles() {
    var time = scrollX / 300;
    var i;
    for (i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      if (ob.type === 'cactus') {
        drawCactus(ob.x, ob.w, ob.h);
      } else {
        drawBird(ob.x, ob.oy, ob.w, ob.h, time);
      }
    }
  }

  function drawDino() {
    // flash every ~0.1 s while invincible (alternate visible/invisible)
    if (invincTimer > 0 && Math.floor(invincTimer * 10) % 2 === 0) return;
    // body
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(dx, dy, DW, DH);
    // head
    ctx.fillStyle = '#795548';
    ctx.fillRect(dx + DW - 14, dy - 18, 22, 22);
    // eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx + DW + 2, dy - 14, 8, 8);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(dx + DW + 4, dy - 12, 4, 4);
    // mouth
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(dx + DW + 4, dy - 4, 12, 3);
    // tail
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(dx - 16, dy + 10, 18, 12);
    ctx.fillRect(dx - 22, dy + 18, 10, 8);
    // legs
    var legAnim = onGround ? Math.sin(scrollX / 12) * 10 : 0;
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(dx + 6, dy + DH, 12, 16 + legAnim);
    ctx.fillRect(dx + DW - 14, dy + DH, 12, 16 - legAnim);
  }

  function drawHUD() {
    ctx.fillStyle = '#4e342e';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 16, 38);
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + best, VW - 16, 38);

    // hearts: ♥ filled for remaining lives, ♡ outline for lost lives
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    var hearts = '';
    var i;
    for (i = 0; i < lives; i++) hearts += '♥';
    for (i = lives; i < 3; i++) hearts += '♡';
    ctx.fillStyle = '#e17055';
    ctx.fillText(hearts, 16, 70);
  }

  function drawMenu() {
    drawBg();
    drawGround();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#fdcb6e';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DINO', VW / 2, 310);
    ctx.fillText('DASH', VW / 2, 375);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, 470);

    if (best > 0) {
      ctx.fillStyle = '#ffeaa7';
      ctx.font = '22px monospace';
      ctx.fillText('BEST: ' + best, VW / 2, 520);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#e17055';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BONK!', VW / 2, 340);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SCORE: ' + score, VW / 2, 410);

    ctx.fillStyle = '#ffeaa7';
    ctx.font = '24px monospace';
    ctx.fillText('BEST: ' + best, VW / 2, 450);

    ctx.fillStyle = '#55efc4';
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
    drawGround();
    drawObstacles();
    drawDino();
    drawHUD();
    if (state === 'DEAD') {
      drawDead();
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
