'use strict';
var ColorBurst = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, rings, ball, ballColor, colorIdx, particles;
  var COLORS = ['#FF6B6B','#4EC5F1','#6BCB77','#FFD700'];
  var COLOR_NAMES = ['RED','BLUE','GREEN','GOLD'];
  var CX = VW/2, CY = VH/2;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; rings = []; particles = []; colorIdx = 0;
    ballColor = COLORS[colorIdx];
    ball = { x: CX, y: CY, r: 16, vx: 0, vy: 0, moving: false };
    spawnRing();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnRing() {
    var ci = Math.floor(Math.random() * COLORS.length);
    rings.push({ r: 30, maxR: 250, speed: Math.min(420, 120 + score * 3), color: COLORS[ci], colorIdx: ci });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random()*Math.PI*2;
      particles.push({ x:x, y:y, vx:Math.cos(a)*100, vy:Math.sin(a)*100, life:0.5, maxLife:0.5, color:color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;

    if (ball.moving) {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      var dx = ball.x - CX, dy = ball.y - CY;
      var dist = Math.sqrt(dx*dx + dy*dy);

      for (var i = rings.length - 1; i >= 0; i--) {
        var rng = rings[i];
        if (Math.abs(dist - rng.r) < ball.r + 6) {
          if (COLORS.indexOf(ballColor) === rng.colorIdx) {
            rings.splice(i, 1);
            score++; if (score > best) best = score;
            addParticles(ball.x, ball.y, ballColor);
            try { Audio.play('gem'); } catch(e) {}
            if (rings.length === 0) spawnRing();
          } else {
            lives--;
            addParticles(ball.x, ball.y, '#f87171');
            try { Audio.play('crash'); } catch(e) {}
            if (lives <= 0) { state='DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
              AdManager.showInterstitial(() => {});
              try { AdManager.offerDoubleScore(score, 'colorburst_best'); } catch(e) {}
              return; }
          }
          ball.moving = false; ball.x = CX; ball.y = CY;
          return;
        }
      }
      if (dist > 280) { ball.moving = false; ball.x = CX; ball.y = CY; }
    }

    for (var j = rings.length - 1; j >= 0; j--) {
      rings[j].r += rings[j].speed * dt;
      if (rings[j].r > rings[j].maxR) {
        rings.splice(j, 1);
        lives--;
        try { Audio.play('crash'); } catch(e) {}
        addParticles(CX, CY, '#f87171');
        if (lives <= 0) { state='DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'colorburst_best'); } catch(e) {}
          return; }
        if (rings.length === 0) spawnRing();
      }
    }

    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k]; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
      if (p.life <= 0) particles.splice(k, 1);
    }
  }

  function draw() {
    ctx.fillStyle = '#080020'; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#FFD700';
      ctx.fillText('COLOR BURST', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Match color to pass through ring!', VW/2, 350);
      ctx.fillText('TAP: cycle color  SWIPE: shoot', VW/2, 390);
      ctx.fillText('TAP TO PLAY', VW/2, 460);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 520);
      return;
    }

    rings.forEach(function(rng) {
      ctx.strokeStyle = rng.color; ctx.lineWidth = 8;
      ctx.shadowBlur = 12; ctx.shadowColor = rng.color;
      ctx.beginPath(); ctx.arc(CX, CY, rng.r, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    });

    var bg2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, ball.r);
    bg2.addColorStop(0, '#fff'); bg2.addColorStop(0.5, ballColor); bg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg2; ctx.shadowBlur = 16; ctx.shadowColor = ballColor;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    for (var ci = 0; ci < COLORS.length; ci++) {
      var bx = 60 + ci * 70;
      ctx.fillStyle = ci === colorIdx ? COLORS[ci] : COLORS[ci] + '55';
      ctx.shadowBlur = ci === colorIdx ? 12 : 0; ctx.shadowColor = COLORS[ci];
      ctx.beginPath(); ctx.arc(bx, VH - 50, 22, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#FFD700'; ctx.fillText('GAME OVER', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  var lastTap = 0;
  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;
    var now = Date.now();
    if (y > VH - 100) {
      colorIdx = (colorIdx + 1) % COLORS.length;
      ballColor = COLORS[colorIdx];
      try { Audio.play('tap'); } catch(e) {}
    } else if (!ball.moving) {
      var dx = x - CX, dy = y - CY;
      var dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
        var spd = 400;
        ball.vx = (dx/dist)*spd; ball.vy = (dy/dist)*spd;
        ball.moving = true;
      }
    }
    lastTap = now;
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
