'use strict';
var BasketShot = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;
  var score = 0;
  var lives = 5;

  // Hoop
  var hoopX = VW / 2;
  var hoopY = 160;
  var hoopW = 70;
  var hoopDir = 1;
  var hoopSpeed = 120;

  // Ball
  var ballX = VW / 2;
  var ballY = VH - 100;
  var ballVX = 0;
  var ballVY = 0;
  var ballR = 22;
  var ballInFlight = false;
  var ballLanded = false;

  // Background stars
  var stars = [];

  // Spin angle for ball
  var ballRot = 0;

  // Flash
  var flashTimer = 0;
  var flashGood = false;

  var GRAV = 900;

  function resetBall() {
    ballX = VW / 2 + (Math.random() - 0.5) * 80;
    ballY = VH - 100;
    ballVX = 0;
    ballVY = 0;
    ballInFlight = false;
    ballLanded = false;
    ballRot = 0;
  }

  function initStars() {
    stars = [];
    for (var i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH * 0.6,
        r: Math.random() * 2 + 0.5,
        a: Math.random()
      });
    }
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    initStars();
    resetGame();
  }

  function resetGame() {
    score = 0;
    lives = 5;
    hoopX = VW / 2;
    hoopDir = 1;
    hoopSpeed = 120;
    resetBall();
    flashTimer = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function shoot(tapX, tapY) {
    if (ballInFlight || ballLanded) return;
    var dx = tapX - ballX;
    var dy = tapY - ballY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    // Time to reach tap point approximated
    var t = 0.7 + dist / 900;
    ballVX = dx / t;
    ballVY = dy / t - 0.5 * GRAV * t;
    ballInFlight = true;
    try { Audio.play('tap'); } catch (e) {}
  }

  function checkHoop() {
    // Ball passes through hoop band
    var rim1 = hoopX - hoopW / 2;
    var rim2 = hoopX + hoopW / 2;
    var netTop = hoopY;
    var netBot = hoopY + 30;
    if (ballY >= netTop && ballY <= netBot) {
      if (ballX > rim1 + ballR * 0.5 && ballX < rim2 - ballR * 0.5) {
        return true;
      }
    }
    return false;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    // Animate stars
    for (var i = 0; i < stars.length; i++) {
      stars[i].a += dt * 0.5;
    }

    // Move hoop
    hoopX += hoopDir * hoopSpeed * dt;
    if (hoopX > VW - hoopW / 2 - 20) { hoopX = VW - hoopW / 2 - 20; hoopDir = -1; }
    if (hoopX < hoopW / 2 + 20) { hoopX = hoopW / 2 + 20; hoopDir = 1; }

    if (flashTimer > 0) {
      flashTimer -= dt;
    }

    if (ballInFlight) {
      ballVY += GRAV * dt;
      ballX += ballVX * dt;
      ballY += ballVY * dt;
      ballRot += ballVX * dt * 0.05;

      // Check score
      if (ballVY > 0 && checkHoop()) {
        score++;
        if (score > best) best = score;
        flashTimer = 0.4;
        flashGood = true;
        hoopSpeed = Math.min(260, 120 + score * 10);
        try { Audio.play('gem'); } catch (e) {}
        ballInFlight = false;
        ballLanded = true;
        setTimeout(function () { resetBall(); }, 400);
        return;
      }

      // Out of bounds / missed
      if (ballY > VH + 60 || ballX < -60 || ballX > VW + 60) {
        lives--;
        flashTimer = 0.4;
        flashGood = false;
        try { Audio.play('crash'); } catch (e) {}
        ballInFlight = false;
        ballLanded = true;
        if (lives <= 0) {
          state = 'DEAD';
          try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        } else {
          setTimeout(function () { resetBall(); }, 500);
        }
      }
    }
  }

  function drawBackground() {
    // Court gradient
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#1a0a00');
    grad.addColorStop(0.5, '#2d1200');
    grad.addColorStop(1, '#4a1e00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // Stars twinkle
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(s.a));
      ctx.fillStyle = '#ffcc88';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Court floor
    ctx.fillStyle = '#c8622a';
    ctx.fillRect(0, VH - 60, VW, 60);
    // Court lines
    ctx.strokeStyle = '#e8824a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, VH - 60);
    ctx.lineTo(VW, VH - 60);
    ctx.stroke();
    // Three-point arc
    ctx.strokeStyle = 'rgba(255,200,100,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(VW / 2, VH - 60, 140, Math.PI, 0);
    ctx.stroke();
    // Paint lane
    ctx.strokeStyle = 'rgba(255,200,100,0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(VW / 2 - 60, VH - 60, 120, -200);
  }

  function drawHoop() {
    var rx = hoopX;
    var ry = hoopY;

    // Backboard
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillRect(rx - 50, ry - 60, 100, 55);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx - 50, ry - 60, 100, 55);
    // Inner square
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 22, ry - 45, 44, 30);

    // Rim
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(rx - hoopW / 2, ry);
    ctx.lineTo(rx + hoopW / 2, ry);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Net
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    var netH = 35;
    var segments = 6;
    for (var i = 0; i <= segments; i++) {
      var nx = rx - hoopW / 2 + (hoopW * i / segments);
      var nx2 = rx - hoopW / 2 + (hoopW / 2) + (hoopW / 2) * (i / segments - 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(nx, ry);
      ctx.lineTo(nx2, ry + netH);
      ctx.stroke();
    }
    // Horizontal net strands
    for (var j = 1; j <= 3; j++) {
      var frac = j / 4;
      var w = hoopW * (1 - frac * 0.4);
      ctx.beginPath();
      ctx.moveTo(rx - w / 2, ry + netH * frac);
      ctx.lineTo(rx + w / 2, ry + netH * frac);
      ctx.stroke();
    }
  }

  function drawBall(bx, by, rot) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 6, ballR * 0.9, ballR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball gradient
    var grad = ctx.createRadialGradient(-ballR * 0.3, -ballR * 0.3, ballR * 0.1, 0, 0, ballR);
    grad.addColorStop(0, '#ff8c00');
    grad.addColorStop(0.5, '#e05a00');
    grad.addColorStop(1, '#8b2800');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Seams
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, ballR, 0, Math.PI * 2);
    ctx.stroke();
    // Vertical seam
    ctx.beginPath();
    ctx.arc(0, 0, ballR, -0.3, 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ballR, Math.PI - 0.3, Math.PI + 0.3);
    ctx.stroke();
    // Horizontal seam
    ctx.beginPath();
    ctx.arc(0, 0, ballR, Math.PI * 0.5 - 0.3, Math.PI * 0.5 + 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ballR, -Math.PI * 0.5 - 0.3, -Math.PI * 0.5 + 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-ballR * 0.28, -ballR * 0.3, ballR * 0.28, ballR * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHUD() {
    // Lives (heart icons)
    for (var i = 0; i < 5; i++) {
      ctx.font = '22px sans-serif';
      ctx.fillStyle = i < lives ? '#ff4444' : '#440000';
      ctx.fillText('♥', 20 + i * 30, 40);
    }

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(score, VW / 2, 45);

    // Best
    ctx.fillStyle = '#ffcc44';
    ctx.font = '18px sans-serif';
    ctx.fillText('BEST ' + best, VW / 2, 70);
    ctx.textAlign = 'left';
  }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.globalAlpha = flashTimer / 0.4 * 0.35;
      ctx.fillStyle = flashGood ? '#00ff88' : '#ff2222';
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  function drawMenu() {
    drawBackground();

    // Title glow
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BASKET', VW / 2, 300);
    ctx.fillText('SHOT', VW / 2, 365);
    ctx.shadowBlur = 0;

    // Draw decorative ball
    drawBall(VW / 2, 480, 0.3);
    // Draw decorative hoop
    var savedHoopX = hoopX, savedHoopY = hoopY;
    hoopX = VW / 2; hoopY = 540;
    drawHoop();
    hoopX = savedHoopX; hoopY = savedHoopY;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 670);

    if (best > 0) {
      ctx.fillStyle = '#ffcc44';
      ctx.font = '22px sans-serif';
      ctx.fillText('BEST: ' + best, VW / 2, 710);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    drawBackground();
    drawHoop();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('GAME OVER', VW / 2, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 390);

    ctx.fillStyle = '#ffcc44';
    ctx.font = '26px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 435);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
    ctx.textAlign = 'left';
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }
    if (state === 'DEAD') {
      drawDead();
      return;
    }

    // PLAYING
    drawBackground();
    drawHoop();

    // Trajectory hint (dotted arc) when ball not in flight
    if (!ballInFlight) {
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var hintDX = hoopX - ballX;
      var hintDY = hoopY - ballY;
      var hintT = 0.7 + Math.sqrt(hintDX * hintDX + hintDY * hintDY) / 900;
      var hintVX = hintDX / hintT;
      var hintVY = hintDY / hintT - 0.5 * GRAV * hintT;
      ctx.moveTo(ballX, ballY);
      for (var ti = 0; ti <= 20; ti++) {
        var t2 = hintT * ti / 20;
        var px = ballX + hintVX * t2;
        var py = ballY + hintVY * t2 + 0.5 * GRAV * t2 * t2;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawBall(ballX, ballY, ballRot);
    drawHUD();
    drawFlash();
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      return;
    }
    if (state === 'DEAD') {
      state = 'MENU';
      return;
    }
    // PLAYING
    shoot(x, y);
  }

  function getBest() {
    return best;
  }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
