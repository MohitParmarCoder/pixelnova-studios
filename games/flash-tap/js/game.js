'use strict';
var FlashTap = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, best;

  // Grid
  var COLS = 4, ROWS = 4;
  var CELL_W, CELL_H;
  var RADIUS = 36;
  var circles; // array of {x, y, lit, flash}

  // Round timing
  var flashIndex = -1;
  var flashTimer = 0;
  var FLASH_DUR = 0.5;
  var tapWindow = 1.0;
  var tapTimer = 0;
  var roundPhase; // 'flashing', 'waiting', 'idle'
  var idleTimer = 0;
  var IDLE_DUR = 0.4;

  var difficultyFactor = 1.0;

  // Animation
  var glowPulse = 0;

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    setupGrid();
  }

  function setupGrid() {
    CELL_W = VW / COLS;
    CELL_H = (VH * 0.6) / ROWS;
    var offsetY = VH * 0.2;
    circles = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        circles.push({
          x: CELL_W * c + CELL_W / 2,
          y: offsetY + CELL_H * r + CELL_H / 2,
          lit: false,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }
  }

  function startGame() {
    score = 0;
    lives = 3;
    difficultyFactor = 1.0;
    flashIndex = -1;
    roundPhase = 'idle';
    idleTimer = 0.3;
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function startRound() {
    flashIndex = Math.floor(Math.random() * circles.length);
    flashTimer = 0;
    tapTimer = 0;
    roundPhase = 'flashing';
    for (var i = 0; i < circles.length; i++) {
      circles[i].lit = false;
    }
    circles[flashIndex].lit = true;
  }

  function endGame() {
    if (score > best) best = score;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  function update(dt) {
    glowPulse += dt * 2.5;

    if (state === 'MENU' || state === 'DEAD') return;

    if (roundPhase === 'idle') {
      idleTimer -= dt;
      if (idleTimer <= 0) {
        startRound();
      }
      return;
    }

    if (roundPhase === 'flashing') {
      flashTimer += dt;
      if (flashTimer >= Math.max(0.15, FLASH_DUR / Math.sqrt(difficultyFactor))) {
        circles[flashIndex].lit = false;
        roundPhase = 'waiting';
        tapTimer = 0;
      }
      return;
    }

    if (roundPhase === 'waiting') {
      tapTimer += dt;
      var window = tapWindow / difficultyFactor;
      if (tapTimer >= window) {
        // Time's up = miss
        lives--;
        try { Audio.play('crash'); } catch (e) {}
        if (lives <= 0) {
          endGame();
          return;
        }
        roundPhase = 'idle';
        idleTimer = IDLE_DUR;
        flashIndex = -1;
      }
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      return;
    }
    if (state === 'DEAD') {
      startGame();
      return;
    }

    if (roundPhase !== 'flashing' && roundPhase !== 'waiting') return;

    for (var i = 0; i < circles.length; i++) {
      var cx = circles[i].x;
      var cy = circles[i].y;
      var dx = x - cx;
      var dy = y - cy;
      if (dx * dx + dy * dy <= (RADIUS + 10) * (RADIUS + 10)) {
        if (i === flashIndex) {
          // Correct!
          score++;
          difficultyFactor = 1.0 + score * 0.04;
          try { Audio.play('gem'); } catch (e) {}
          circles[flashIndex].lit = false;
          flashIndex = -1;
          roundPhase = 'idle';
          idleTimer = IDLE_DUR / difficultyFactor;
        } else {
          // Wrong circle
          lives--;
          try { Audio.play('crash'); } catch (e) {}
          if (lives <= 0) {
            endGame();
            return;
          }
          roundPhase = 'idle';
          idleTimer = IDLE_DUR;
          if (flashIndex >= 0) circles[flashIndex].lit = false;
          flashIndex = -1;
        }
        return;
      }
    }
    // Empty-space tap during waiting is a no-op (timer expiry already penalizes)
  }

  function draw() {
    // Background gradient
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#0a0a1a');
    bg.addColorStop(1, '#0d1a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawGrid();
    drawHUD();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawMenu() {
    // Decorative circles
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      ctx.beginPath();
      ctx.arc(c.x, c.y, RADIUS, 0, Math.PI * 2);
      var hue = (i * 23 + glowPulse * 30) % 360;
      ctx.fillStyle = 'hsl(' + hue + ',80%,60%)';
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillText('FLASH TAP', VW / 2, VH * 0.12);
    ctx.shadowBlur = 0;

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#aac';
    ctx.fillText('Tap the glowing circle!', VW / 2, VH * 0.18);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(0,240,255,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawGrid() {
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      var pulse = Math.sin(glowPulse + c.pulse) * 0.5 + 0.5;

      if (c.lit) {
        // Glowing lit circle
        var grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, RADIUS * 1.8);
        grd.addColorStop(0, 'rgba(0,255,200,0.4)');
        grd.addColorStop(1, 'rgba(0,255,200,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(c.x, c.y, RADIUS * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(c.x, c.y, RADIUS, 0, Math.PI * 2);
        var litGrd = ctx.createRadialGradient(c.x - RADIUS * 0.3, c.y - RADIUS * 0.3, 0, c.x, c.y, RADIUS);
        litGrd.addColorStop(0, '#afffef');
        litGrd.addColorStop(0.5, '#00ffc8');
        litGrd.addColorStop(1, '#00a884');
        ctx.fillStyle = litGrd;
        ctx.fill();
        ctx.strokeStyle = '#00ffc8';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // Dim circle
        ctx.beginPath();
        ctx.arc(c.x, c.y, RADIUS, 0, Math.PI * 2);
        var dimAlpha = 0.15 + pulse * 0.08;
        ctx.fillStyle = 'rgba(80,100,160,' + dimAlpha + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,130,200,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Tap timer bar under waiting circle
    if (roundPhase === 'waiting' && flashIndex >= 0) {
      var window = tapWindow / difficultyFactor;
      var prog = 1.0 - tapTimer / window;
      var fc = circles[flashIndex];
      var barW = RADIUS * 2 * prog;
      ctx.fillStyle = 'rgba(255,100,100,0.7)';
      ctx.fillRect(fc.x - RADIUS, fc.y + RADIUS + 6, RADIUS * 2, 6);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(fc.x - RADIUS, fc.y + RADIUS + 6, barW, 6);
    }
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, VW, 60);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 38);

    ctx.textAlign = 'right';
    ctx.fillText('Best: ' + best, VW - 16, 38);

    // Lives
    ctx.textAlign = 'center';
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff4466' : '#333';
      ctx.beginPath();
      ctx.arc(VW / 2 - 24 + i * 24, 32, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#cce';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(0,240,255,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.68);
    ctx.textAlign = 'left';
  }

  function getBest() {
    return best;
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
})();
