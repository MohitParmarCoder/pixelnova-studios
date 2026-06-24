'use strict';
var LightningGrab = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';

  // Game state variables
  var score, lives;
  var phase; // 'FLASH' or 'CHOOSE'
  var flashTimer, chooseTimer, flashDuration, chooseDuration;
  var targetColor, reactionStart;
  var roundColors, buttonLayout;

  var COLORS = ['#f87171', '#86efac', '#60a5fa', '#fde68a'];

  function init(canvas, bestScore) {
    c = canvas;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function startGame() {
    score = 0;
    lives = 3;
    flashDuration = 0.4;
    chooseDuration = 2.5;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    startRound();
  }

  function startRound() {
    var idx = Math.floor(Math.random() * COLORS.length);
    targetColor = COLORS[idx];
    roundColors = shuffle(COLORS);
    // Layout: 2x2 grid centered on screen
    // Each button 110px wide, 90px tall with gap
    var bw = 110, bh = 90, gap = 20;
    var totalW = bw * 2 + gap;
    var totalH = bh * 2 + gap;
    var startX = (VW - totalW) / 2;
    var startY = (VH - totalH) / 2;
    buttonLayout = [];
    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 2; col++) {
        var colorIdx = row * 2 + col;
        buttonLayout.push({
          x: startX + col * (bw + gap),
          y: startY + row * (bh + gap),
          w: bw,
          h: bh,
          color: roundColors[colorIdx]
        });
      }
    }
    phase = 'FLASH';
    flashTimer = flashDuration;
  }

  function loseLife() {
    lives--;
    try { Audio.play('crash'); } catch(e) {}
    if (lives <= 0) {
      lives = 0;
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      state = 'DEAD';
      try { Audio.play('lose'); } catch(e) {}
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      AdManager.showInterstitial(() => {});
      try { AdManager.offerDoubleScore(score, 'lightninggrab_best'); } catch(e) {}
    } else {
      startRound();
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;

    if (phase === 'FLASH') {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        phase = 'CHOOSE';
        chooseTimer = chooseDuration;
        reactionStart = chooseTimer;
      }
    } else if (phase === 'CHOOSE') {
      chooseTimer -= dt;
      if (chooseTimer <= 0) {
        // Time ran out - lose a life
        loseLife();
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawHUD() {
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'left';
    var heartsStr = '';
    for (var i = 0; i < 3; i++) {
      heartsStr += (i < lives) ? '♥' : '♡';
    }
    ctx.fillStyle = '#f87171';
    ctx.fillText(heartsStr, 14, 44);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui';
    ctx.fillText(score, VW - 14, 44);
    ctx.textAlign = 'left';
  }

  function draw() {
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px system-ui';
      ctx.fillStyle = '#fde68a';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#fde68a';
      ctx.fillText('LIGHTNING GRAB', VW / 2, 300);
      ctx.shadowBlur = 0;

      ctx.font = '22px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Watch the color flash,', VW / 2, 370);
      ctx.fillText('then tap the matching button!', VW / 2, 402);

      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#86efac';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#86efac';
      ctx.fillText('TAP TO PLAY', VW / 2, 480);
      ctx.shadowBlur = 0;

      ctx.font = '18px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 540);
      ctx.textAlign = 'left';
      return;
    }

    drawHUD();

    if (state === 'PLAYING') {
      if (phase === 'FLASH') {
        ctx.save();
        ctx.shadowBlur = 60;
        ctx.shadowColor = targetColor;
        ctx.fillStyle = targetColor;
        ctx.beginPath();
        ctx.arc(VW / 2, VH / 2, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.font = '20px system-ui';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Remember this color!', VW / 2, VH / 2 + 140);
        ctx.textAlign = 'left';

      } else if (phase === 'CHOOSE') {
        // Timer bar
        var timerFrac = chooseTimer / chooseDuration;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(20, 70, VW - 40, 10);
        ctx.fillStyle = timerFrac > 0.4 ? '#86efac' : '#f87171';
        ctx.fillRect(20, 70, (VW - 40) * timerFrac, 10);

        ctx.textAlign = 'center';
        ctx.font = 'bold 22px system-ui';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Tap the correct color!', VW / 2, VH / 2 - 140);
        ctx.textAlign = 'left';

        for (var i = 0; i < buttonLayout.length; i++) {
          var btn = buttonLayout[i];
          ctx.save();
          ctx.shadowBlur = 18;
          ctx.shadowColor = btn.color;
          ctx.fillStyle = btn.color;
          roundRect(btn.x, btn.y, btn.w, btn.h, 16);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, VW, VH);

      ctx.textAlign = 'center';
      ctx.font = 'bold 52px system-ui';
      ctx.fillStyle = '#f87171';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 300);
      ctx.shadowBlur = 0;

      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(score, VW / 2, 375);

      ctx.font = '22px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 428);

      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TAP TO RETRY', VW / 2, 510);
      ctx.textAlign = 'left';
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'DEAD') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'PLAYING' && phase === 'CHOOSE') {
      try { Audio.play('tap'); } catch(e) {}
      for (var i = 0; i < buttonLayout.length; i++) {
        var btn = buttonLayout[i];
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          if (btn.color === targetColor) {
            var elapsed = chooseDuration - chooseTimer;
            var bonus = Math.floor(10 - 10 * elapsed / 2.0);
            if (bonus < 1) bonus = 1;
            score += bonus;
            if (score > best) { best = score; AdManager.happyTime(1.0); }
            try { Audio.play('gem'); } catch(e) {}
            flashDuration -= 0.02;
            if (flashDuration < 0.15) flashDuration = 0.15;
            startRound();
          } else {
            loseLife();
          }
          return;
        }
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
