'use strict';
var ColorTap = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, best;

  var COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
  var COLOR_MAP = {
    'RED':    '#ff3344',
    'BLUE':   '#3366ff',
    'GREEN':  '#22cc55',
    'YELLOW': '#ffcc00'
  };
  var COLOR_DIM = {
    'RED':    '#7a1522',
    'BLUE':   '#162e7a',
    'GREEN':  '#0e5a25',
    'YELLOW': '#7a6100'
  };

  var targetName;   // the color word shown
  var targetColor;  // the actual color the word is written in (could differ)
  var correctBtn;   // index of button that matches targetName
  var buttons;      // [{label, color, x, y, w, h}]

  var roundTimer = 0;
  var roundTime = 3.0;
  var glowPulse = 0;
  var feedbackTimer = 0;
  var feedbackOk = false;

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    buildButtons();
  }

  function buildButtons() {
    var btnW = 160, btnH = 120;
    var gap = 20;
    var startX = (VW - btnW * 2 - gap) / 2;
    var startY = VH * 0.45;
    buttons = [];
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var idx = r * 2 + c;
        buttons.push({
          label: COLORS[idx],
          color: COLOR_MAP[COLORS[idx]],
          x: startX + c * (btnW + gap),
          y: startY + r * (btnH + gap),
          w: btnW,
          h: btnH
        });
      }
    }
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function startGame() {
    score = 0;
    lives = 3;
    roundTime = 3.0;
    feedbackTimer = 0;
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
    newRound();
  }

  function newRound() {
    // Shuffle button positions
    var shuffled = shuffleArray(COLORS.slice());
    for (var i = 0; i < 4; i++) {
      buttons[i].label = shuffled[i];
      buttons[i].color = COLOR_MAP[shuffled[i]];
    }

    // Target word
    targetName = COLORS[Math.floor(Math.random() * COLORS.length)];

    // The word itself is drawn in a DIFFERENT random color (classic Stroop effect)
    var otherColors = COLORS.filter(function (c) { return c !== targetName; });
    targetColor = COLOR_MAP[otherColors[Math.floor(Math.random() * otherColors.length)]];

    // Find which button has the label matching targetName
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].label === targetName) {
        correctBtn = i;
        break;
      }
    }

    roundTimer = 0;
  }

  function endGame() {
    if (score > best) best = score;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  function update(dt) {
    glowPulse += dt * 2;

    if (feedbackTimer > 0) {
      feedbackTimer -= dt;
    }

    if (state !== 'PLAYING') return;

    roundTimer += dt;
    if (roundTimer >= roundTime) {
      // Time up = miss
      lives--;
      feedbackTimer = 0.35;
      feedbackOk = false;
      try { Audio.play('crash'); } catch (e) {}
      if (lives <= 0) {
        endGame();
        return;
      }
      newRound();
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

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (i === correctBtn) {
          score++;
          feedbackOk = true;
          feedbackTimer = 0.25;
          roundTime = Math.max(1.0, 3.0 - score * 0.06);
          try { Audio.play('gem'); } catch (e) {}
          newRound();
        } else {
          lives--;
          feedbackOk = false;
          feedbackTimer = 0.35;
          try { Audio.play('crash'); } catch (e) {}
          if (lives <= 0) {
            endGame();
            return;
          }
          newRound();
        }
        return;
      }
    }
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, VW, VH);
    bg.addColorStop(0, '#1a0533');
    bg.addColorStop(1, '#0d1a33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawGame();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawMenu() {
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (var i = 0; i < 4; i++) {
      var b = buttons[i];
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 16);
      ctx.fill();
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.shadowColor = '#f0c';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('COLOR TAP', VW / 2, VH * 0.15);
    ctx.shadowBlur = 0;

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ccb';
    ctx.fillText('Tap the button matching', VW / 2, VH * 0.22);
    ctx.fillText('the COLOR NAME shown!', VW / 2, VH * 0.27);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,100,255,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawGame() {
    // Timer bar at top
    var prog = 1.0 - roundTimer / roundTime;
    var barH = 10;
    var hue = prog * 120; // green to red
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, VW, barH);
    ctx.fillStyle = 'hsl(' + hue + ',90%,55%)';
    ctx.fillRect(0, 0, VW * prog, barH);

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, barH, VW, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 48);
    ctx.textAlign = 'right';
    ctx.fillText('Best: ' + best, VW - 16, 48);

    // Lives
    ctx.textAlign = 'center';
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff4466' : '#333';
      ctx.beginPath();
      ctx.arc(VW / 2 - 20 + i * 20, 40, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Feedback flash
    if (feedbackTimer > 0) {
      var alpha = feedbackTimer / 0.35 * 0.3;
      ctx.fillStyle = feedbackOk ? 'rgba(0,255,100,' + alpha + ')' : 'rgba(255,50,50,' + alpha + ')';
      ctx.fillRect(0, 0, VW, VH);
    }

    // Target word
    ctx.textAlign = 'center';
    ctx.font = 'bold 68px sans-serif';
    ctx.shadowColor = targetColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = targetColor;
    ctx.fillText(targetName, VW / 2, VH * 0.35);
    ctx.shadowBlur = 0;

    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Tap the button with this color name', VW / 2, VH * 0.42);

    // Color buttons
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var isCorrect = (i === correctBtn);

      var grd = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      grd.addColorStop(0, b.color);
      grd.addColorStop(1, COLOR_DIM[b.label]);

      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 16);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 9);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = '#f0c';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,100,255,' + pulse + ')';
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
