'use strict';
var LineBreaker = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score = 0;
  var best = 0;
  var lives = 3;

  var VW = 390;
  var VH = 844;

  // Paddle
  var paddleW = 80;
  var paddleH = 14;
  var paddleX;
  var paddleY;
  var paddleTargetX;

  // Ball
  var ballX, ballY, ballVX, ballVY;
  var ballR = 9;
  var BALL_SPEED = 340;

  // Bricks
  var BRICK_COLS = 8;
  var BRICK_ROWS = 6;
  var BRICK_W;
  var BRICK_H = 28;
  var BRICK_PAD = 4;
  var BRICK_TOP = 120;
  var BRICK_LEFT;
  var bricks = [];

  var particles = [];
  var shakeTime = 0;

  var BRICK_COLORS = [
    '#FF4C4C', '#FF4C4C',
    '#FF9900', '#FF9900',
    '#FFD700', '#FFD700',
    '#4CAF50', '#4CAF50',
    '#2196F3', '#2196F3',
    '#9C27B0', '#9C27B0'
  ];

  function initBricks() {
    bricks = [];
    for (var r = 0; r < BRICK_ROWS; r++) {
      for (var c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          row: r, col: c,
          alive: true,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
          x: BRICK_LEFT + c * (BRICK_W + BRICK_PAD),
          y: BRICK_TOP + r * (BRICK_H + BRICK_PAD)
        });
      }
    }
  }

  function resetBall() {
    ballX = VW / 2;
    ballY = paddleY - ballR - 2;
    var angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 3);
    ballVX = Math.cos(angle) * BALL_SPEED;
    ballVY = Math.sin(angle) * BALL_SPEED;
    if (ballVY > 0) ballVY = -ballVY;
  }

  function spawnParticles(cx, cy, color) {
    for (var i = 0; i < 10; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 100;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 0.5,
        maxLife: 0.5,
        size: 3 + Math.random() * 3
      });
    }
  }

  function checkBallBrickCollision() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      if (ballX + ballR > b.x && ballX - ballR < b.x + BRICK_W &&
          ballY + ballR > b.y && ballY - ballR < b.y + BRICK_H) {
        b.alive = false;
        score++;
        spawnParticles(b.x + BRICK_W / 2, b.y + BRICK_H / 2, b.color);
        try { Audio.play('gem'); } catch (e) {}

        // Figure out bounce side
        var overlapLeft = (ballX + ballR) - b.x;
        var overlapRight = (b.x + BRICK_W) - (ballX - ballR);
        var overlapTop = (ballY + ballR) - b.y;
        var overlapBottom = (b.y + BRICK_H) - (ballY - ballR);
        var minH = Math.min(overlapLeft, overlapRight);
        var minV = Math.min(overlapTop, overlapBottom);
        if (minH < minV) {
          ballVX = -ballVX;
        } else {
          ballVY = -ballVY;
        }

        checkLineCleared(b.row);
        break;
      }
    }
  }

  function checkLineCleared(row) {
    for (var i = 0; i < bricks.length; i++) {
      if (bricks[i].row === row && bricks[i].alive) return;
    }
    // Whole row cleared = bonus
    score += 5;
    try { Audio.play('tap'); } catch (e) {}
  }

  function allBricksCleared() {
    for (var i = 0; i < bricks.length; i++) {
      if (bricks[i].alive) return false;
    }
    return true;
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    BRICK_W = Math.floor((VW - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS);
    BRICK_LEFT = Math.floor((VW - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2);
    paddleX = VW / 2 - paddleW / 2;
    paddleY = VH - 100;
    paddleTargetX = paddleX;
    state = 'MENU';
    score = 0;
    lives = 3;
    initBricks();
    resetBall();
  }

  function startGame() {
    state = 'PLAYING';
    score = 0;
    lives = 3;
    initBricks();
    paddleX = VW / 2 - paddleW / 2;
    paddleTargetX = paddleX;
    resetBall();
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function killPlayer() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (shakeTime > 0) shakeTime -= dt;

    // Paddle smoothing
    paddleX += (paddleTargetX - paddleX) * Math.min(1, dt * 12);
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleW > VW) paddleX = VW - paddleW;

    // Ball movement
    ballX += ballVX * dt;
    ballY += ballVY * dt;

    // Wall collisions
    if (ballX - ballR < 0) { ballX = ballR; ballVX = Math.abs(ballVX); try { Audio.play('tap'); } catch (e) {} }
    if (ballX + ballR > VW) { ballX = VW - ballR; ballVX = -Math.abs(ballVX); try { Audio.play('tap'); } catch (e) {} }
    if (ballY - ballR < 0) { ballY = ballR; ballVY = Math.abs(ballVY); try { Audio.play('tap'); } catch (e) {} }

    // Paddle collision
    if (ballVY > 0 &&
        ballY + ballR >= paddleY &&
        ballY + ballR <= paddleY + paddleH + 4 &&
        ballX >= paddleX - ballR &&
        ballX <= paddleX + paddleW + ballR) {
      ballVY = -Math.abs(ballVY);
      ballY = paddleY - ballR;
      // Angle based on hit position
      var hitPos = (ballX - paddleX) / paddleW;
      var angle2 = (hitPos - 0.5) * (Math.PI * 0.7);
      var spd = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
      ballVX = Math.sin(angle2) * spd;
      ballVY = -Math.cos(angle2) * spd;
      try { Audio.play('tap'); } catch (e) {}
    }

    // Ball fell off
    if (ballY - ballR > VH + 20) {
      lives--;
      try { Audio.play('crash'); } catch (e) {}
      shakeTime = 0.3;
      if (lives <= 0) {
        killPlayer();
      } else {
        resetBall();
      }
    }

    checkBallBrickCollision();

    if (allBricksCleared()) {
      initBricks();
      BALL_SPEED += 20;
      resetBall();
    }

    // Particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);

    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#0a0a1a');
    bg.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') { drawMenu(); return; }

    var sx = 0, sy = 0;
    if (shakeTime > 0) {
      sx = (Math.random() - 0.5) * 10;
      sy = (Math.random() - 0.5) * 10;
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawBricks();
    drawPaddle();
    drawBall();
    drawParticles();
    drawHUD();
    ctx.restore();

    if (state === 'DEAD') drawDeadOverlay();
  }

  function drawBricks() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      roundRect(b.x, b.y, BRICK_W, BRICK_H, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(b.x + 2, b.y + 2, BRICK_W - 4, BRICK_H * 0.4, 3);
      ctx.fill();
    }
  }

  function drawPaddle() {
    var grd = ctx.createLinearGradient(paddleX, paddleY, paddleX, paddleY + paddleH);
    grd.addColorStop(0, '#60cfff');
    grd.addColorStop(1, '#0077cc');
    ctx.fillStyle = grd;
    roundRect(paddleX, paddleY, paddleW, paddleH, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(paddleX + 4, paddleY + 2, paddleW - 8, 4, 2);
    ctx.fill();
  }

  function drawBall() {
    var grd = ctx.createRadialGradient(ballX - 2, ballY - 2, 1, ballX, ballY, ballR);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#60cfff');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.shadowColor = '#60cfff';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 14, 40);

    ctx.textAlign = 'right';
    ctx.fillText('BEST: ' + best, VW - 14, 40);

    // Lives
    ctx.textAlign = 'center';
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#FF4C4C' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(VW / 2 + (i - 1) * 28, 68, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMenu() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#2196F3';
    ctx.shadowBlur = 20;
    ctx.fillText('LINE BREAKER', VW / 2, VH * 0.3);
    ctx.shadowBlur = 0;

    ctx.font = '20px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Break bricks. Clear rows for bonus!', VW / 2, VH * 0.4);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.5);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.65);
    ctx.globalAlpha = 1;
  }

  function drawDeadOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#FF4C4C';
    ctx.font = 'bold 54px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF4C4C';
    ctx.shadowBlur = 30;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.35);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('SCORE: ' + score, VW / 2, VH * 0.47);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.56);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.7);
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { state = 'MENU'; BALL_SPEED = 340; return; }
    if (state === 'PLAYING') {
      paddleTargetX = x - paddleW / 2;
    }
  }

  function getBest() { return best; }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
}());
