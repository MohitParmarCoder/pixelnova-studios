'use strict';
var GravityMaze = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score, best, lives;
  var VW = 390, VH = 844;

  var ball;
  var gravityDir; // 1 = down, -1 = up
  var GRAV = 600;
  var BALL_R = 10;

  var currentLevel;
  var walls;
  var exitStar;
  var passages;

  var flipAnim; // 0..1 flash timer
  var deathFlash;

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    lives = 3;
    currentLevel = 1;
    gravityDir = 1;
    flipAnim = 0;
    deathFlash = 0;
    buildLevel(currentLevel);
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function buildLevel(lvl) {
    gravityDir = 1;
    flipAnim = 0;

    var passageW = Math.max(28, 70 - lvl * 4);
    var numWalls = 3 + Math.min(lvl - 1, 5);
    walls = [];
    passages = [];

    var spacing = (VH - 200) / (numWalls + 1);

    for (var i = 0; i < numWalls; i++) {
      var wy = 180 + spacing * (i + 1);
      // Passage must always include VW/2 (ball's fixed x) so the level is beatable.
      // Offset the passage center by up to (passageW/2 - BALL_R - 8) from center.
      var maxOff = passageW / 2 - BALL_R - 8;
      if (maxOff < 0) maxOff = 0;
      var offset = (Math.random() * 2 - 1) * maxOff;
      var px = VW / 2 - passageW / 2 + offset;
      px = Math.max(10, Math.min(VW - passageW - 10, px));
      passages.push({ x: px, w: passageW, y: wy });
      walls.push({ x: 0, y: wy - 8, w: VW, h: 16, px: px, pw: passageW });
    }

    ball = {
      x: VW / 2,
      y: 120,
      vy: 0
    };

    exitStar = {
      x: VW / 2,
      y: VH - 80,
      r: 18,
      rot: 0
    };
  }

  function nextLevel() {
    currentLevel++;
    score++;
    if (score > best) best = score;
    try { Audio.play('gem'); } catch (e) {}
    buildLevel(currentLevel);
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (deathFlash > 0) {
      deathFlash -= dt;
    }
    if (flipAnim > 0) {
      flipAnim -= dt * 4;
    }

    exitStar.rot += dt * 2;

    ball.vy += gravityDir * GRAV * dt;
    ball.vy = Math.max(-600, Math.min(600, ball.vy));
    ball.y += ball.vy * dt;

    // Boundary bounce (ceiling/floor)
    if (ball.y - BALL_R < 60) {
      ball.y = 60 + BALL_R;
      ball.vy = Math.abs(ball.vy) * 0.3;
    }
    if (ball.y + BALL_R > VH - 40) {
      ball.y = VH - 40 - BALL_R;
      ball.vy = -Math.abs(ball.vy) * 0.3;
    }

    // Wall collision
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var ballLeft = ball.x - BALL_R;
      var ballRight = ball.x + BALL_R;
      var ballTop = ball.y - BALL_R;
      var ballBot = ball.y + BALL_R;
      var wallTop = w.y;
      var wallBot = w.y + w.h;
      var passLeft = w.px;
      var passRight = w.px + w.pw;

      if (ballBot > wallTop && ballTop < wallBot) {
        // Check if in passage gap
        if (ballRight > passLeft && ballLeft < passRight) {
          // In passage - no collision
          continue;
        }
        // Hit wall
        if (ballBot > wallTop && ball.vy > 0 && (ball.y - ball.vy * dt) - BALL_R <= wallTop) {
          ball.y = wallTop - BALL_R;
          loseLife();
          return;
        }
        if (ballTop < wallBot && ball.vy < 0 && (ball.y - ball.vy * dt) + BALL_R >= wallBot) {
          ball.y = wallBot + BALL_R;
          loseLife();
          return;
        }
        // Side collision
        loseLife();
        return;
      }
    }

    // Exit star check
    var dx = ball.x - exitStar.x;
    var dy = ball.y - exitStar.y;
    if (dx * dx + dy * dy < (BALL_R + exitStar.r) * (BALL_R + exitStar.r)) {
      nextLevel();
    }
  }

  function loseLife() {
    lives--;
    deathFlash = 0.4;
    try { Audio.play('crash'); } catch (e) {}
    ball.vy = 0;
    ball.x = VW / 2;
    ball.y = 120;
    gravityDir = 1;
    if (lives <= 0) {
      endGame();
    }
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING') {
      gravityDir *= -1;
      flipAnim = 1;
      ball.vy *= 0.3;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function drawStar(cx, cy, r, rot, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var angle = rot + (Math.PI * 2 / 5) * i - Math.PI / 2;
      var innerAngle = rot + (Math.PI * 2 / 5) * i + Math.PI / 5 - Math.PI / 2;
      if (i === 0) {
        ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      } else {
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
      ctx.lineTo(cx + Math.cos(innerAngle) * r * 0.4, cy + Math.sin(innerAngle) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    // Background
    var flashAmt = deathFlash > 0 ? Math.min(1, deathFlash * 4) : 0;
    ctx.fillStyle = flashAmt > 0 ? ('rgba(80,0,0,' + flashAmt + ')') : '#0a0a14';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#0a0a14';
    if (flashAmt > 0) {
      ctx.globalAlpha = 1 - flashAmt * 0.5;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }

    if (state === 'MENU') { drawMenu(); return; }

    // Walls
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      ctx.fillStyle = '#334466';
      // Left segment
      ctx.fillRect(0, w.y, w.px, w.h);
      // Right segment
      ctx.fillRect(w.px + w.pw, w.y, VW - w.px - w.pw, w.h);
      // Passage highlight
      ctx.fillStyle = 'rgba(100,200,255,0.15)';
      ctx.fillRect(w.px, w.y, w.pw, w.h);
      // Edge glow
      ctx.strokeStyle = '#5588cc';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.px, w.y, w.pw, w.h);
    }

    // Boundary lines
    ctx.strokeStyle = '#334466';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 60, VW, VH - 100);

    // Exit star
    var starGlow = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    ctx.shadowColor = '#ffff44';
    ctx.shadowBlur = 12 + starGlow * 8;
    drawStar(exitStar.x, exitStar.y, exitStar.r, exitStar.rot, '#ffff44');
    drawStar(exitStar.x, exitStar.y, exitStar.r * 0.6, exitStar.rot + Math.PI / 5, '#ffffff');
    ctx.shadowBlur = 0;

    // Gravity indicator
    var arrowAlpha = flipAnim > 0 ? 1 : 0.5;
    ctx.globalAlpha = arrowAlpha;
    ctx.fillStyle = gravityDir === 1 ? '#ff8844' : '#44aaff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(gravityDir === 1 ? '▼ GRAV' : '▲ GRAV', 16, 50);
    ctx.globalAlpha = 1;

    // Ball
    var ballGrad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#4488ff');
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Lvl ' + (score + 1), VW - 16, 32);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 32);

    ctx.fillStyle = '#ff4444';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    var heartsStr = '';
    for (var h = 0; h < 3; h++) {
      heartsStr += h < lives ? '♥ ' : '♡ ';
    }
    ctx.fillText(heartsStr, 16, 32);

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRAVITY', VW / 2, 320);
    ctx.fillText('MAZE', VW / 2, 378);

    ctx.fillStyle = '#aaccff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Tap to flip gravity!', VW / 2, 440);
    ctx.fillText('Reach the star!', VW / 2, 470);

    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 540);

    if (best > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Best: ' + best + ' levels', VW / 2, 590);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VW / 2, 340);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Levels: ' + score, VW / 2, 400);

    ctx.fillStyle = '#ffff44';
    ctx.font = '24px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 440);

    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 520);
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
}());
