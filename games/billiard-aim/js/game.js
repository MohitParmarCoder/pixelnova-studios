'use strict';
var BilliardAim = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;

  // Game state
  var score = 0;
  var lives = 3;
  var timeLeft = 60;
  var gameOver = false;

  // Balls
  var cueBall;
  var targetBalls;
  var BALL_R = 14;

  // Pockets
  var pockets;
  var POCKET_R = 20;

  // Table bounds (inside rails)
  var TABLE = { x: 30, y: 100, w: VW - 60, h: VH - 200 };

  // Rail thickness
  var RAIL = 22;

  // Aim tap phase
  var tapPhase = 0; // 0=aim, 1=shoot
  var aimAngle = 0;
  var aimPower = 12;

  // Friction
  var FRICTION = 0.985;
  var MIN_SPEED = 0.8;

  var flashTimer = 0;
  var flashGood = true;

  var ballColors = ['#ff2222', '#ffcc00', '#0066ff', '#aa44ff', '#ff6600', '#00aa44', '#cc2244'];

  function makeVec(x, y) { return { x: x, y: y }; }

  function setupTable() {
    pockets = [
      makeVec(TABLE.x, TABLE.y),
      makeVec(TABLE.x + TABLE.w / 2, TABLE.y),
      makeVec(TABLE.x + TABLE.w, TABLE.y),
      makeVec(TABLE.x, TABLE.y + TABLE.h),
      makeVec(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h),
      makeVec(TABLE.x + TABLE.w, TABLE.y + TABLE.h)
    ];
  }

  function makeBall(x, y, color, isCue) {
    return {
      x: x, y: y,
      vx: 0, vy: 0,
      r: BALL_R,
      color: color,
      isCue: isCue || false,
      pocketed: false
    };
  }

  function spawnTargetBalls() {
    targetBalls = [];
    var positions = [
      { x: TABLE.x + TABLE.w * 0.3, y: TABLE.y + TABLE.h * 0.3 },
      { x: TABLE.x + TABLE.w * 0.6, y: TABLE.y + TABLE.h * 0.25 },
      { x: TABLE.x + TABLE.w * 0.75, y: TABLE.y + TABLE.h * 0.5 },
      { x: TABLE.x + TABLE.w * 0.55, y: TABLE.y + TABLE.h * 0.7 },
      { x: TABLE.x + TABLE.w * 0.25, y: TABLE.y + TABLE.h * 0.65 },
      { x: TABLE.x + TABLE.w * 0.45, y: TABLE.y + TABLE.h * 0.45 }
    ];
    for (var i = 0; i < positions.length; i++) {
      targetBalls.push(makeBall(positions[i].x, positions[i].y, ballColors[i % ballColors.length], false));
    }
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    setupTable();
  }

  function resetGame() {
    score = 0;
    lives = 3;
    timeLeft = 60;
    gameOver = false;
    cueBall = makeBall(TABLE.x + TABLE.w * 0.5, TABLE.y + TABLE.h * 0.75, '#f8f8f8', true);
    spawnTargetBalls();
    tapPhase = 0;
    aimAngle = -Math.PI / 2;
    flashTimer = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function allPocketed() {
    for (var i = 0; i < targetBalls.length; i++) {
      if (!targetBalls[i].pocketed) return false;
    }
    return true;
  }

  function anyMoving() {
    if (Math.abs(cueBall.vx) > MIN_SPEED || Math.abs(cueBall.vy) > MIN_SPEED) return true;
    for (var i = 0; i < targetBalls.length; i++) {
      if (Math.abs(targetBalls[i].vx) > MIN_SPEED || Math.abs(targetBalls[i].vy) > MIN_SPEED) return true;
    }
    return false;
  }

  function bounceBall(ball) {
    var left = TABLE.x + RAIL + ball.r;
    var right = TABLE.x + TABLE.w - RAIL - ball.r;
    var top = TABLE.y + RAIL + ball.r;
    var bot = TABLE.y + TABLE.h - RAIL - ball.r;

    if (ball.x < left) { ball.x = left; ball.vx = Math.abs(ball.vx) * 0.75; try { Audio.play('tap'); } catch (e) {} }
    if (ball.x > right) { ball.x = right; ball.vx = -Math.abs(ball.vx) * 0.75; try { Audio.play('tap'); } catch (e) {} }
    if (ball.y < top) { ball.y = top; ball.vy = Math.abs(ball.vy) * 0.75; try { Audio.play('tap'); } catch (e) {} }
    if (ball.y > bot) { ball.y = bot; ball.vy = -Math.abs(ball.vy) * 0.75; try { Audio.play('tap'); } catch (e) {} }
  }

  function collideBalls(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var minDist = a.r + b.r;
    if (dist < minDist && dist > 0) {
      var nx = dx / dist;
      var ny = dy / dist;
      var overlap = minDist - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      var dvx = a.vx - b.vx;
      var dvy = a.vy - b.vy;
      var dot = dvx * nx + dvy * ny;
      if (dot > 0) {
        a.vx -= dot * nx;
        a.vy -= dot * ny;
        b.vx += dot * nx;
        b.vy += dot * ny;
        try { Audio.play('tap'); } catch (e) {}
      }
    }
  }

  function checkPocket(ball) {
    for (var i = 0; i < pockets.length; i++) {
      var dx = ball.x - pockets[i].x;
      var dy = ball.y - pockets[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < POCKET_R) {
        return true;
      }
    }
    return false;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (flashTimer > 0) flashTimer -= dt;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      if (score > best) best = score;
      state = 'DEAD';
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
      AdManager.showInterstitial(() => {});
      try { AdManager.offerDoubleScore(score, 'billiardaim_best'); } catch(e) {}
      return;
    }

    // Move balls (dt-scaled to stay framerate-independent)
    var fric = Math.pow(FRICTION, dt * 60);
    var allBalls = [cueBall].concat(targetBalls);
    for (var i = 0; i < allBalls.length; i++) {
      var b = allBalls[i];
      if (b.pocketed) continue;
      b.vx *= fric;
      b.vy *= fric;
      if (Math.abs(b.vx) < MIN_SPEED * 0.1) b.vx = 0;
      if (Math.abs(b.vy) < MIN_SPEED * 0.1) b.vy = 0;
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      bounceBall(b);
    }

    // Ball-ball collisions
    for (var j = 0; j < allBalls.length; j++) {
      for (var k = j + 1; k < allBalls.length; k++) {
        if (!allBalls[j].pocketed && !allBalls[k].pocketed) {
          collideBalls(allBalls[j], allBalls[k]);
        }
      }
    }

    // Check pockets
    for (var m = 0; m < targetBalls.length; m++) {
      if (!targetBalls[m].pocketed && checkPocket(targetBalls[m])) {
        targetBalls[m].pocketed = true;
        score++;
        if (score > best) best = score;
        flashGood = true;
        flashTimer = 0.3;
        try { Audio.play('gem'); } catch (e) {}
      }
    }
    // Cue ball pocketed
    if (!cueBall.pocketed && checkPocket(cueBall)) {
      cueBall.pocketed = false; // Respawn
      cueBall.x = TABLE.x + TABLE.w * 0.5;
      cueBall.y = TABLE.y + TABLE.h * 0.75;
      cueBall.vx = 0; cueBall.vy = 0;
      lives--;
      flashGood = false;
      flashTimer = 0.5;
      try { Audio.play('crash'); } catch (e) {}
      if (lives <= 0) {
        if (score > best) best = score;
        state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'billiardaim_best'); } catch(e) {}
      }
    }

    // Respawn targets if all pocketed
    if (allPocketed()) {
      spawnTargetBalls();
    }
  }

  function drawTable() {
    // Outer frame
    ctx.fillStyle = '#5c3010';
    ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);

    // Rail color
    ctx.fillStyle = '#4a2808';
    ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, RAIL);
    ctx.fillRect(TABLE.x, TABLE.y + TABLE.h - RAIL, TABLE.w, RAIL);
    ctx.fillRect(TABLE.x, TABLE.y, RAIL, TABLE.h);
    ctx.fillRect(TABLE.x + TABLE.w - RAIL, TABLE.y, RAIL, TABLE.h);

    // Rail wood texture (lines)
    ctx.strokeStyle = '#6b4018';
    ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(TABLE.x + RAIL, TABLE.y + 4 + i * 5);
      ctx.lineTo(TABLE.x + TABLE.w - RAIL, TABLE.y + 4 + i * 5);
      ctx.stroke();
    }

    // Felt (playing surface)
    var feltGrad = ctx.createLinearGradient(TABLE.x + RAIL, TABLE.y + RAIL, TABLE.x + TABLE.w - RAIL, TABLE.y + TABLE.h - RAIL);
    feltGrad.addColorStop(0, '#1a6b2a');
    feltGrad.addColorStop(0.5, '#228b38');
    feltGrad.addColorStop(1, '#1a6b2a');
    ctx.fillStyle = feltGrad;
    ctx.fillRect(TABLE.x + RAIL, TABLE.y + RAIL, TABLE.w - RAIL * 2, TABLE.h - RAIL * 2);

    // Center spot
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Baulk line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TABLE.x + RAIL, TABLE.y + TABLE.h * 0.7);
    ctx.lineTo(TABLE.x + TABLE.w - RAIL, TABLE.y + TABLE.h * 0.7);
    ctx.stroke();

    // Pockets
    for (var j = 0; j < pockets.length; j++) {
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.arc(pockets[j].x, pockets[j].y, POCKET_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c3010';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pockets[j].x, pockets[j].y, POCKET_R + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBallObj(ball) {
    if (ball.pocketed) return;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ball.x + 3, ball.y + 4, ball.r * 0.9, ball.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    var grad = ctx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.1, ball.x, ball.y, ball.r);
    var c = ball.color;
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, c);
    grad.addColorStop(1, shadeColor(c, -60));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // Number circle for target balls
    if (!ball.isCue) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(ball.x - ball.r * 0.25, ball.y - ball.r * 0.28, ball.r * 0.3, ball.r * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function shadeColor(hex, amount) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawAimLine() {
    if (cueBall.pocketed) return;
    if (anyMoving()) return;
    // Always show aim line
    var len = 180;
    var ex = cueBall.x + Math.cos(aimAngle) * len;
    var ey = cueBall.y + Math.sin(aimAngle) * len;

    // Dotted line
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Arrow
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    var headLen = 12;
    var nx = Math.cos(aimAngle);
    var ny = Math.sin(aimAngle);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - nx * headLen - ny * 6, ey - ny * headLen + nx * 6);
    ctx.lineTo(ex - nx * headLen + ny * 6, ey - ny * headLen - nx * 6);
    ctx.fill();

    // Cue stick
    ctx.strokeStyle = '#c8a060';
    ctx.lineWidth = 4;
    var cueStart = 30;
    var cueEnd = 100;
    ctx.beginPath();
    ctx.moveTo(cueBall.x - Math.cos(aimAngle) * cueStart, cueBall.y - Math.sin(aimAngle) * cueStart);
    ctx.lineTo(cueBall.x - Math.cos(aimAngle) * cueEnd, cueBall.y - Math.sin(aimAngle) * cueEnd);
    ctx.stroke();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, 92);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff4444';
    ctx.font = '22px sans-serif';
    for (var i = 0; i < 3; i++) {
      ctx.fillText(i < lives ? '♥' : '♡', 15 + i * 30, 40);
    }
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('LIVES', 15, 64);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(score, VW / 2, 44);
    ctx.fillStyle = '#ffcc44';
    ctx.font = '18px sans-serif';
    ctx.fillText('BEST ' + best, VW / 2, 72);

    ctx.textAlign = 'right';
    var tColor = timeLeft <= 10 ? '#ff4444' : '#ffffff';
    ctx.fillStyle = tColor;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(Math.ceil(timeLeft) + 's', VW - 15, 44);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('TIME', VW - 15, 66);

    // Hint
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '15px sans-serif';
    if (!anyMoving()) {
      if (tapPhase === 0) ctx.fillText('TAP to aim', VW / 2, TABLE.y + TABLE.h + 20);
      else ctx.fillText('TAP to shoot', VW / 2, TABLE.y + TABLE.h + 20);
    }
    ctx.textAlign = 'left';
  }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.globalAlpha = flashTimer * 0.5;
      ctx.fillStyle = flashGood ? '#44ff88' : '#ff4444';
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, VW, VH);
    // Subtle vignette
    var vig = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawMenu() {
    drawBackground();
    drawTable();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = '#44ff88';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BILLIARD', VW / 2, 300);
    ctx.fillText('AIM', VW / 2, 360);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('60s · 3 Lives', VW / 2, 412);

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
    drawTable();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#44ff88';
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
    drawTable();
    for (var i = 0; i < targetBalls.length; i++) drawBallObj(targetBalls[i]);
    drawAimLine();
    drawBallObj(cueBall);
    drawHUD();
    drawFlash();
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { state = 'MENU'; return; }
    if (anyMoving()) return;

    if (tapPhase === 0) {
      // Set aim angle toward tap
      aimAngle = Math.atan2(y - cueBall.y, x - cueBall.x);
      tapPhase = 1;
      try { Audio.play('tap'); } catch (e) {}
    } else {
      // Shoot
      cueBall.vx = Math.cos(aimAngle) * aimPower;
      cueBall.vy = Math.sin(aimAngle) * aimPower;
      tapPhase = 0;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
