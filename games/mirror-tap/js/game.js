'use strict';
var MirrorTap = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, leftPattern, rightTaps, phase, showTimer, round;
  var DOTS = 8;
  var dotPositions = [];

  function makeDotPositions() {
    dotPositions = [];
    for (var i = 0; i < DOTS; i++) {
      dotPositions.push({ x: 40 + Math.random() * (VW/2 - 80), y: 250 + Math.random() * (VH - 420) });
    }
  }

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function newRound() {
    makeDotPositions();
    var n = Math.min(3 + Math.floor(round / 2), DOTS);
    leftPattern = [];
    for (var i = 0; i < n; i++) leftPattern.push(i);
    leftPattern.sort(function() { return Math.random()-0.5; });
    leftPattern = leftPattern.slice(0, n);
    rightTaps = [];
    phase = 'SHOW'; showTimer = 1.5 + n * 0.2;
  }

  function startGame() {
    score = 0; lives = 3; round = 0;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    newRound();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (phase === 'SHOW') {
      showTimer -= dt;
      if (showTimer <= 0) { phase = 'TAP'; }
    }
  }

  function getMirrorX(x) { return VW - x; }

  function draw() {
    ctx.fillStyle = '#0a0a20'; ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = 'rgba(168,237,234,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(VW/2, 0); ctx.lineTo(VW/2, VH); ctx.stroke();

    if (state === 'MENU') {
      ctx.fillStyle = '#a8edea'; ctx.font = 'bold 46px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#a8edea';
      ctx.fillText('MIRROR TAP', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Mirror the left pattern', VW/2, 350);
      ctx.fillText('on the right side!', VW/2, 385);
      ctx.fillText('TAP TO PLAY', VW/2, 460);
      ctx.fillStyle = '#FFD700'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 520);
      return;
    }

    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('ORIGINAL', VW/4, 220);
    ctx.fillText('YOUR MIRROR', VW*3/4, 220);

    dotPositions.forEach(function(dp, i) {
      var active = leftPattern.indexOf(i) >= 0;
      ctx.fillStyle = active ? '#FFD700' : 'rgba(255,255,255,0.1)';
      ctx.shadowBlur = active ? 10 : 0; ctx.shadowColor = '#FFD700';
      ctx.beginPath(); ctx.arc(dp.x, dp.y, 18, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      var mx = getMirrorX(dp.x);
      var tapped = rightTaps.indexOf(i) >= 0;
      ctx.fillStyle = tapped ? '#6BCB77' : (phase === 'SHOW' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)');
      ctx.shadowBlur = tapped ? 10 : 0; ctx.shadowColor = '#6BCB77';
      ctx.beginPath(); ctx.arc(mx, dp.y, 18, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    ctx.fillStyle = '#a8edea'; ctx.font = '16px system-ui'; ctx.textAlign = 'center';
    if (phase === 'SHOW') ctx.fillText('Memorize...', VW/2, 110);
    else ctx.fillText('Tap mirrors! (' + rightTaps.length + '/' + leftPattern.length + ')', VW/2, 110);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#a8edea'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Rounds: ' + score, VW/2, 380);
      ctx.fillStyle = '#FFD700'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (phase !== 'TAP') return;
    if (x < VW/2) return;

    var mx = getMirrorX(x);
    for (var i = 0; i < dotPositions.length; i++) {
      var dp = dotPositions[i];
      var dx = mx - dp.x, dy = y - dp.y;
      if (dx*dx + dy*dy < 22*22 && rightTaps.indexOf(i) < 0) {
        if (leftPattern.indexOf(i) >= 0) {
          rightTaps.push(i);
          try { Audio.play('tap'); } catch(e) {}
          if (rightTaps.length === leftPattern.length) {
            score++; round++; if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            setTimeout(function() { if (state==='PLAYING') newRound(); }, 500);
          }
        } else {
          lives--;
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { state='DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        return;
      }
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
