'use strict';
var ChainTap = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, circles, nextNum, round, timer;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function newRound() {
    var n = Math.min(5 + round, 12);
    circles = [];
    for (var i = 1; i <= n; i++) {
      circles.push({
        num: i, x: 40 + Math.random() * (VW - 80), y: 160 + Math.random() * (VH - 280),
        r: 32, tapped: false,
        color: ['#FF6B6B','#4EC5F1','#6BCB77','#FFD700','#CC5DE8'][Math.floor(Math.random()*5)]
      });
    }
    nextNum = 1;
    timer = Math.max(8, 20 - round);
  }

  function startGame() {
    score = 0; lives = 3; round = 0;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    newRound();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    timer -= dt;
    if (timer <= 0) {
      lives--;
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'chaintap_best'); } catch(e) {}
      } else newRound();
    }
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#050020'); g.addColorStop(1, '#002040');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#FFD700';
      ctx.fillText('CHAIN TAP', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap numbers in order!', VW/2, 350);
      ctx.fillText('TAP TO PLAY', VW/2, 420);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 480);
      return;
    }

    var tLine = ctx.createLinearGradient(0, VH-90, VW, VH-90);
    circles.forEach(function(ci) {
      if (ci.tapped) return;
      if (ci.num === nextNum) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.setLineDash([5,5]);
        ctx.beginPath(); ctx.arc(ci.x, ci.y, ci.r + 8, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = ci.tapped ? 'rgba(107,203,119,0.3)' : ci.color;
      ctx.shadowBlur = ci.num === nextNum ? 16 : 6;
      ctx.shadowColor = ci.color;
      ctx.beginPath(); ctx.arc(ci.x, ci.y, ci.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(ci.num, ci.x, ci.y + 8);
    });

    var tf = Math.max(0, timer / Math.max(8, 20 - round));
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, VH-80, VW-40, 10);
    ctx.fillStyle = tf > 0.5 ? '#6BCB77' : tf > 0.25 ? '#FFD700' : '#f87171';
    ctx.fillRect(20, VH-80, (VW-40)*tf, 10);

    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Round: ' + (round+1), 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    ctx.fillStyle = '#a8edea'; ctx.font = '16px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Tap: ' + nextNum + ' →', VW/2, 110);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#FFD700'; ctx.fillText('TIMES UP!', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    for (var i = 0; i < circles.length; i++) {
      var ci = circles[i]; if (ci.tapped) continue;
      var dx = x - ci.x, dy = y - ci.y;
      if (dx*dx + dy*dy < ci.r*ci.r) {
        if (ci.num === nextNum) {
          ci.tapped = true; nextNum++;
          try { Audio.play('tap'); } catch(e) {}
          if (nextNum > circles.length) {
            score++; round++; if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            setTimeout(function() { if (state==='PLAYING') newRound(); }, 500);
          }
        } else {
          lives--;
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { state='DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} 
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'chaintap_best'); } catch(e) {}
          }
        }
        return;
      }
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
