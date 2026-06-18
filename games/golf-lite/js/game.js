'use strict';
var GolfLite = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;

  // Game state
  var score = 0;
  var hole = 0;
  var shotsLeft = 5;
  var totalHoles = 10;

  // Ball
  var ballX, ballY;
  var ballVX, ballVY;
  var ballR = 12;
  var ballMoving = false;

  // Hole (cup)
  var holeX, holeY;
  var holeR = 18;

  // Tap state
  var tapPhase = 0; // 0 = waiting for aim tap, 1 = waiting for shoot tap
  var aimX, aimY;

  // Visual
  var grassBlades = [];
  var clouds = [];
  var flashTimer = 0;
  var flashGood = false;

  var FRICTION = 0.97;
  var MIN_SPEED = 8;

  function randomHolePos() {
    holeX = 60 + Math.random() * (VW - 120);
    holeY = 150 + Math.random() * (VH - 350);
    // Keep away from ball start; cap iterations to prevent an infinite loop
    var attempts = 0;
    while (Math.abs(holeX - ballX) < 80 && Math.abs(holeY - ballY) < 80) {
      if (++attempts >= 100) {
        // Fallback: place hole on the opposite side of the canvas from the ball
        holeX = ballX < VW / 2 ? VW - 100 : 100;
        holeY = ballY < VH / 2 ? VH - 250 : 200;
        break;
      }
      holeX = 60 + Math.random() * (VW - 120);
      holeY = 150 + Math.random() * (VH - 350);
    }
  }

  function placeBall() {
    do {
      ballX = 60 + Math.random() * (VW - 120);
      ballY = VH - 200 + Math.random() * 100;
    } while (false);
    ballVX = 0;
    ballVY = 0;
    ballMoving = false;
    tapPhase = 0;
  }

  function initDecor() {
    grassBlades = [];
    for (var i = 0; i < 80; i++) {
      grassBlades.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        h: 8 + Math.random() * 14,
        sway: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1
      });
    }
    clouds = [];
    for (var j = 0; j < 5; j++) {
      clouds.push({
        x: Math.random() * VW,
        y: 50 + Math.random() * 120,
        w: 60 + Math.random() * 80,
        speed: 10 + Math.random() * 20
      });
    }
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    initDecor();
  }

  function resetGame() {
    score = 0;
    hole = 0;
    shotsLeft = 5;
    placeBall();
    randomHolePos();
    tapPhase = 0;
    flashTimer = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function nextHole() {
    hole++;
    if (hole >= totalHoles) {
      if (score > best) best = score;
      state = 'DEAD';
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
      return;
    }
    shotsLeft = 5;
    placeBall();
    randomHolePos();
    tapPhase = 0;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    // Update clouds
    for (var i = 0; i < clouds.length; i++) {
      clouds[i].x += clouds[i].speed * dt;
      if (clouds[i].x > VW + 80) clouds[i].x = -80;
    }

    // Update grass sway
    for (var j = 0; j < grassBlades.length; j++) {
      grassBlades[j].sway += grassBlades[j].speed * dt;
    }

    if (flashTimer > 0) flashTimer -= dt;

    if (!ballMoving) return;

    ballVX *= FRICTION;
    ballVY *= FRICTION;
    ballX += ballVX * dt * 60;
    ballY += ballVY * dt * 60;

    // Wall bounce
    if (ballX < ballR) { ballX = ballR; ballVX = Math.abs(ballVX) * 0.7; try { Audio.play('tap'); } catch (e) {} }
    if (ballX > VW - ballR) { ballX = VW - ballR; ballVX = -Math.abs(ballVX) * 0.7; try { Audio.play('tap'); } catch (e) {} }
    if (ballY < ballR + 90) { ballY = ballR + 90; ballVY = Math.abs(ballVY) * 0.7; try { Audio.play('tap'); } catch (e) {} }
    if (ballY > VH - ballR - 40) { ballY = VH - ballR - 40; ballVY = -Math.abs(ballVY) * 0.7; try { Audio.play('tap'); } catch (e) {} }

    // Check pot
    var dx = ballX - holeX;
    var dy = ballY - holeY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < holeR) {
      score++;
      if (score > best) best = score;
      flashGood = true;
      flashTimer = 0.5;
      try { Audio.play('gem'); } catch (e) {}
      ballMoving = false;
      setTimeout(function () { nextHole(); }, 500);
      return;
    }

    // Stop if slow
    var spd = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
    if (spd < MIN_SPEED) {
      ballVX = 0; ballVY = 0;
      ballMoving = false;
      tapPhase = 0;
      // Check shots
      if (shotsLeft <= 0) {
        flashGood = false;
        flashTimer = 0.5;
        try { Audio.play('lose'); } catch (e) {}
        setTimeout(function () { nextHole(); }, 600);
      }
    }
  }

  function drawBackground() {
    // Sky
    var skyGrad = ctx.createLinearGradient(0, 0, 0, VH * 0.35);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#c8e8ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VW, VH * 0.35);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      ctx.beginPath();
      ctx.ellipse(cl.x, cl.y, cl.w * 0.5, cl.w * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(cl.x - cl.w * 0.2, cl.y + 5, cl.w * 0.3, cl.w * 0.18, 0, 0, Math.PI * 2);
      ctx.ellipse(cl.x + cl.w * 0.2, cl.y + 5, cl.w * 0.28, cl.w * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Green fairway gradient
    var grassGrad = ctx.createLinearGradient(0, VH * 0.35, 0, VH);
    grassGrad.addColorStop(0, '#4caf50');
    grassGrad.addColorStop(0.3, '#388e3c');
    grassGrad.addColorStop(1, '#1b5e20');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, VH * 0.35, VW, VH * 0.65);

    // Lighter fairway strip
    ctx.fillStyle = 'rgba(100,220,80,0.15)';
    ctx.fillRect(VW * 0.2, VH * 0.35, VW * 0.6, VH * 0.65);

    // Grass blades
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1.5;
    for (var j = 0; j < grassBlades.length; j++) {
      var gb = grassBlades[j];
      if (gb.y < VH * 0.35) continue;
      var sway = Math.sin(gb.sway) * 4;
      ctx.beginPath();
      ctx.moveTo(gb.x, gb.y);
      ctx.quadraticCurveTo(gb.x + sway, gb.y - gb.h * 0.5, gb.x + sway * 1.5, gb.y - gb.h);
      ctx.stroke();
    }
  }

  function drawHoleCup() {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(holeX, holeY + 4, holeR, holeR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark cup
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(holeX, holeY, holeR, 0, Math.PI * 2);
    ctx.fill();

    // Inner depth
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(holeX, holeY, holeR * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Flag pole
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(holeX, holeY - holeR);
    ctx.lineTo(holeX, holeY - holeR - 50);
    ctx.stroke();

    // Flag
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(holeX, holeY - holeR - 50);
    ctx.lineTo(holeX + 25, holeY - holeR - 40);
    ctx.lineTo(holeX, holeY - holeR - 30);
    ctx.fill();
  }

  function drawBall() {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ballX + 3, ballY + 5, ballR * 0.85, ballR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    var grad = ctx.createRadialGradient(ballX - 3, ballY - 3, 1, ballX, ballY, ballR);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#e0e0e0');
    grad.addColorStop(1, '#aaaaaa');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Dimples (dots)
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    var dimples = [[-4, -3], [3, -4], [0, 3], [-5, 3], [4, 2], [-2, -7]];
    for (var i = 0; i < dimples.length; i++) {
      ctx.beginPath();
      ctx.arc(ballX + dimples[i][0], ballY + dimples[i][1], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAimLine() {
    if (tapPhase !== 1 || ballMoving) return;
    ctx.setLineDash([5, 10]);
    ctx.strokeStyle = 'rgba(255,255,100,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ballX, ballY);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    // Arrow tip
    var dx = aimX - ballX;
    var dy = aimY - ballY;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len; dy /= len;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,100,0.85)';
      ctx.beginPath();
      ctx.moveTo(aimX, aimY);
      ctx.lineTo(aimX - dx * 12 - dy * 7, aimY - dy * 12 + dx * 7);
      ctx.lineTo(aimX - dx * 12 + dy * 7, aimY - dy * 12 - dx * 7);
      ctx.fill();
    }
    ctx.setLineDash([]);
  }

  function drawHUD() {
    // Info bar bg
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, VW, 85);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Hole: ' + (hole + 1) + '/10', 15, 30);
    ctx.fillText('Shots: ' + shotsLeft, 15, 58);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#88ff44';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(score, VW / 2, 40);
    ctx.fillStyle = '#ccff88';
    ctx.font = '16px sans-serif';
    ctx.fillText('SCORE', VW / 2, 60);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffcc44';
    ctx.font = '18px sans-serif';
    ctx.fillText('BEST ' + best, VW - 15, 35);

    // Tap hint
    if (!ballMoving) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '16px sans-serif';
      if (tapPhase === 0) {
        ctx.fillText('TAP to aim', VW / 2, VH - 20);
      } else {
        ctx.fillText('TAP again to shoot', VW / 2, VH - 20);
      }
    }
    ctx.textAlign = 'left';
  }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.globalAlpha = flashTimer * 0.6;
      ctx.fillStyle = flashGood ? '#88ff44' : '#ff4444';
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  function drawMenu() {
    drawBackground();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = '#88ff44';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ccff44';
    ctx.font = 'bold 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOLF', VW / 2, 310);
    ctx.fillText('LITE', VW / 2, 378);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('10 Holes · 5 Shots Each', VW / 2, 430);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 520);

    if (best > 0) {
      ctx.fillStyle = '#ffcc44';
      ctx.font = '22px sans-serif';
      ctx.fillText('BEST: ' + best, VW / 2, 565);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    drawBackground();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ccff44';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('ROUND OVER', VW / 2, 310);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
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
    drawHoleCup();
    drawAimLine();
    drawBall();
    drawHUD();
    drawFlash();
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { state = 'MENU'; return; }
    if (ballMoving) return;

    if (tapPhase === 0) {
      aimX = x;
      aimY = y;
      tapPhase = 1;
      try { Audio.play('tap'); } catch (e) {}
    } else {
      // Shoot toward aim point then beyond
      var dx = aimX - ballX;
      var dy = aimY - ballY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) { tapPhase = 0; return; }
      var power = Math.min(dist * 0.18, 14);
      ballVX = (dx / dist) * power;
      ballVY = (dy / dist) * power;
      ballMoving = true;
      shotsLeft--;
      tapPhase = 0;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
