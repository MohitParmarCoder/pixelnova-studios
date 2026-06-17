'use strict';
var BowlingStrike = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;

  // Game
  var score = 0;
  var frame = 0;
  var totalFrames = 3;
  var shot = 0; // 0 or 1 (2 shots per frame)
  var pinsStanding = [];
  var PIN_COUNT = 10;

  // Ball
  var ballX, ballY;
  var ballR = 20;
  var ballVX = 0;
  var ballVY = 0;
  var ballInFlight = false;
  var ballLanded = false;
  var ballCurve = 0;

  // Aim
  var tapPhase = 0; // 0=aim, 1=shoot
  var aimX = VW / 2;

  // Pins layout (triangle, 4-3-2-1)
  var pinPositions = [];
  var PIN_R = 10;

  // Lane visual
  var laneY = 120;

  // Flash
  var flashTimer = 0;
  var flashColor = '#ffffff';

  // Message
  var msgText = '';
  var msgTimer = 0;

  function setupPins() {
    pinPositions = [];
    pinsStanding = [];
    var spacing = 30;
    var rows = [4, 3, 2, 1];
    var yStart = laneY + 40;
    var rowIdx = 0;
    for (var r = 0; r < rows.length; r++) {
      var count = rows[r];
      var xStart = VW / 2 - (count - 1) * spacing / 2;
      for (var c = 0; c < count; c++) {
        pinPositions.push({ x: xStart + c * spacing, y: yStart + rowIdx * (spacing * 0.85) });
        pinsStanding.push(true);
      }
      rowIdx++;
    }
  }

  function countStanding() {
    var n = 0;
    for (var i = 0; i < pinsStanding.length; i++) {
      if (pinsStanding[i]) n++;
    }
    return n;
  }

  function resetBall() {
    ballX = VW / 2;
    ballY = VH - 80;
    ballVX = 0;
    ballVY = 0;
    ballInFlight = false;
    ballLanded = false;
    ballCurve = 0;
    tapPhase = 0;
    aimX = VW / 2;
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function resetGame() {
    score = 0;
    frame = 0;
    shot = 0;
    setupPins();
    resetBall();
    flashTimer = 0;
    msgText = '';
    msgTimer = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function showMessage(txt, good) {
    msgText = txt;
    msgTimer = 1.2;
    flashColor = good ? '#88ff44' : '#ff4444';
    flashTimer = 0.4;
  }

  function nextShot() {
    var wasStanding = countStanding();
    shot++;
    if (shot >= 2) {
      // End of frame
      shot = 0;
      frame++;
      if (frame >= totalFrames) {
        if (score > best) best = score;
        state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        return;
      }
      setupPins();
    }
    resetBall();
  }

  function knockPins() {
    // Find pins near ball path and knock some
    var knocked = 0;
    var hitAny = false;
    for (var i = 0; i < pinPositions.length; i++) {
      if (!pinsStanding[i]) continue;
      var dx = pinPositions[i].x - ballX;
      var dy = pinPositions[i].y - ballY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ballR + PIN_R + 15) {
        hitAny = true;
      }
    }
    if (!hitAny) return false;

    // Hit cluster: knock random number based on proximity
    var standingBefore = countStanding();
    // Simple spread: ball knocks pins near trajectory
    var spread = 60 + Math.random() * 40; // how wide the impact zone
    for (var j = 0; j < pinPositions.length; j++) {
      if (!pinsStanding[j]) continue;
      var pdx = pinPositions[j].x - ballX;
      var pdy = pinPositions[j].y - ballY;
      var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist < spread) {
        pinsStanding[j] = false;
        knocked++;
      }
    }
    return knocked > 0;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (flashTimer > 0) flashTimer -= dt;
    if (msgTimer > 0) msgTimer -= dt;

    if (!ballInFlight) return;

    ballVY -= 0; // No gravity vertically (ball slides up lane)
    ballX += (ballVX + ballCurve) * dt * 60;
    ballY += ballVY * dt * 60;
    ballCurve += (ballCurve > 0 ? 0.002 : -0.002) * dt * 60;

    // Check pin collision
    if (ballY <= laneY + 80) {
      var hit = knockPins();
      if (hit) {
        try { Audio.play('crash'); } catch (e) {}
        var knocked = PIN_COUNT - countStanding();
        score += knocked;
        if (score > best) best = score;
        if (knocked === 10) {
          showMessage('STRIKE!', true);
          try { Audio.play('gem'); } catch (e) {}
        } else if (knocked >= 7) {
          showMessage('SPARE!', true);
          try { Audio.play('gem'); } catch (e) {}
        } else {
          showMessage(knocked + ' pins!', knocked > 3);
        }
      } else {
        showMessage('GUTTER!', false);
        try { Audio.play('lose'); } catch (e) {}
      }
      ballInFlight = false;
      ballLanded = true;
      setTimeout(function () { nextShot(); }, 1200);
    }

    // Off sides
    if (ballX < 20 || ballX > VW - 20) {
      showMessage('GUTTER!', false);
      try { Audio.play('lose'); } catch (e) {}
      ballInFlight = false;
      ballLanded = true;
      setTimeout(function () { nextShot(); }, 1000);
    }
  }

  function drawLane() {
    // Lane
    var laneGrad = ctx.createLinearGradient(40, 0, VW - 40, 0);
    laneGrad.addColorStop(0, '#c8a96b');
    laneGrad.addColorStop(0.5, '#e8c88a');
    laneGrad.addColorStop(1, '#c8a96b');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(40, laneY, VW - 80, VH - laneY - 20);

    // Lane lines
    ctx.strokeStyle = '#b09050';
    ctx.lineWidth = 1;
    var stripeX = [60, VW - 60, 90, VW - 90];
    for (var i = 0; i < stripeX.length; i++) {
      ctx.beginPath();
      ctx.moveTo(stripeX[i], laneY);
      ctx.lineTo(stripeX[i], VH - 20);
      ctx.stroke();
    }

    // Approach dots (arrows)
    ctx.fillStyle = '#cc9944';
    var dotY = VH - 160;
    var dotXs = [100, 130, 160, VW - 100, VW - 130, VW - 160, VW / 2];
    for (var j = 0; j < dotXs.length; j++) {
      ctx.beginPath();
      ctx.arc(dotXs[j], dotY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gutters
    ctx.fillStyle = '#6b4a20';
    ctx.fillRect(0, laneY, 42, VH - laneY - 20);
    ctx.fillRect(VW - 42, laneY, 42, VH - laneY - 20);
    // Gutter lines
    ctx.strokeStyle = '#4a2a08';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, laneY);
    ctx.lineTo(42, VH - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(VW - 42, laneY);
    ctx.lineTo(VW - 42, VH - 20);
    ctx.stroke();
  }

  function drawBackground() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#1a0f05');
    bg.addColorStop(1, '#2d1a08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    // Ceiling lights
    for (var i = 0; i < 4; i++) {
      var lx = 50 + i * (VW - 100) / 3;
      var grad = ctx.createRadialGradient(lx, 0, 0, lx, 50, 80);
      grad.addColorStop(0, 'rgba(255,240,200,0.5)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lx - 80, 0, 160, 100);

      ctx.fillStyle = '#fffde0';
      ctx.fillRect(lx - 12, 0, 24, 8);
    }
  }

  function drawPins() {
    for (var i = 0; i < pinPositions.length; i++) {
      if (!pinsStanding[i]) continue;
      var px = pinPositions[i].x;
      var py = pinPositions[i].y;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(px + 2, py + PIN_R + 3, PIN_R * 0.7, PIN_R * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pin body
      var grad = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, PIN_R);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f0f0f0');
      grad.addColorStop(1, '#cccccc');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, PIN_R, 0, Math.PI * 2);
      ctx.fill();

      // Red stripe
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, PIN_R * 0.65, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBallOnLane() {
    if (ballLanded) return;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ballX + 4, ballY + 5, ballR * 0.9, ballR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    var grad = ctx.createRadialGradient(ballX - ballR * 0.3, ballY - ballR * 0.3, ballR * 0.1, ballX, ballY, ballR);
    grad.addColorStop(0, '#3a3a8a');
    grad.addColorStop(0.5, '#1a1a6a');
    grad.addColorStop(1, '#0a0a3a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Finger holes
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(ballX - 5, ballY - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ballX + 5, ballY - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ballX, ballY + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(ballX - ballR * 0.25, ballY - ballR * 0.25, ballR * 0.3, ballR * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAim() {
    if (tapPhase !== 1 || ballInFlight || ballLanded) return;
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(255,200,0,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ballX, ballY);
    ctx.lineTo(aimX, laneY + 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, 115);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Frame: ' + (frame + 1) + '/' + totalFrames, 15, 30);
    ctx.fillText('Shot: ' + (shot + 1) + '/2', 15, 56);
    ctx.fillText('Pins: ' + countStanding(), 15, 82);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(score, VW / 2, 50);
    ctx.fillStyle = '#ffcc44';
    ctx.font = '18px sans-serif';
    ctx.fillText('BEST ' + best, VW / 2, 80);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    if (!ballInFlight && !ballLanded) {
      if (tapPhase === 0) ctx.fillText('TAP to aim', VW - 15, 30);
      else ctx.fillText('TAP to shoot', VW - 15, 30);
    }

    if (msgTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = flashColor;
      ctx.font = 'bold 38px sans-serif';
      ctx.shadowColor = flashColor;
      ctx.shadowBlur = 15;
      ctx.fillText(msgText, VW / 2, VH / 2 + 50);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'left';
  }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.globalAlpha = flashTimer * 0.4;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  function drawMenu() {
    drawBackground();
    drawLane();

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = '#ffcc44';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOWLING', VW / 2, 300);
    ctx.fillText('STRIKE', VW / 2, 362);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('3 Frames · 2 Shots Each', VW / 2, 415);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 510);

    if (best > 0) {
      ctx.fillStyle = '#ffcc44';
      ctx.font = '22px sans-serif';
      ctx.fillText('BEST: ' + best, VW / 2, 555);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    drawBackground();
    drawLane();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('GAME OVER', VW / 2, 310);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 380);

    ctx.fillStyle = '#ffcc44';
    ctx.font = '26px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 425);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
    ctx.textAlign = 'left';
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') { drawMenu(); return; }
    if (state === 'DEAD') { drawDead(); return; }

    drawBackground();
    drawLane();
    drawPins();
    drawAim();
    drawBallOnLane();
    drawHUD();
    drawFlash();
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { state = 'MENU'; return; }
    if (ballInFlight || ballLanded) return;

    if (tapPhase === 0) {
      aimX = x;
      tapPhase = 1;
      try { Audio.play('tap'); } catch (e) {}
    } else {
      // Shoot
      var dx = aimX - ballX;
      var dy = (laneY + 40) - ballY;
      var len = Math.sqrt(dx * dx + dy * dy);
      var speed = 0.35;
      ballVX = (dx / len) * speed;
      ballVY = (dy / len) * speed;
      ballCurve = (Math.random() - 0.5) * 0.03;
      ballInFlight = true;
      tapPhase = 0;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
