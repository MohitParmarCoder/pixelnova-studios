'use strict';
var SlingshotAim = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, shotsLeft, targets, particles;
  var ball = null;
  var aimX = 80, aimY = 680;
  var phase = 'AIM';
  var ballX = 80, ballY = 680;
  var lastTapX = null, lastTapY = null;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function makeTargets() {
    targets = [];
    for (var i = 0; i < 5; i++) {
      targets.push({
        x: 240 + Math.random() * 100, y: 300 + i * 90,
        w: 40, h: 30, color: ['#FF6B6B','#FFD700','#6BCB77','#4EC5F1','#CC5DE8'][i],
        pts: i + 1, alive: true
      });
    }
  }

  function startGame() {
    score = 0; shotsLeft = 5; particles = [];
    makeTargets(); ball = null; phase = 'AIM';
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (60 + Math.random() * 80), vy: Math.sin(a) * (60 + Math.random() * 80) - 40, life: 0.6, maxLife: 0.6, color: color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    if (ball) {
      ball.vx *= Math.pow(0.99, dt * 60);
      ball.vy += 400 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      for (var i = targets.length - 1; i >= 0; i--) {
        var t = targets[i];
        if (!t.alive) continue;
        if (ball.x > t.x - t.w / 2 - 8 && ball.x < t.x + t.w / 2 + 8 &&
            ball.y > t.y - t.h / 2 - 8 && ball.y < t.y + t.h / 2 + 8) {
          t.alive = false;
          score += t.pts; if (score > best) { best = score; AdManager.happyTime(1.0); }
          addParticles(t.x, t.y, t.color);
          try { Audio.play('gem'); } catch(e) {}
        }
      }

      if (ball.x < -20 || ball.x > VW + 20 || ball.y > VH + 20) {
        ball = null;
        var alive = targets.filter(function(t) { return t.alive; });
        if (shotsLeft <= 0 || alive.length === 0) {
          state = 'DEAD';
          try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'slingshotaim_best'); } catch(e) {}
        }
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#87CEEB'); g.addColorStop(0.6, '#98FB98'); g.addColorStop(1, '#228B22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#228B22'; ctx.fillRect(0, VH - 60, VW, 60);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 16; ctx.shadowColor = '#333';
      ctx.fillText('SLINGSHOT', VW / 2, 260);
      ctx.fillText('AIM', VW / 2, 320);
      ctx.shadowBlur = 0; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO AIM & SHOOT', VW / 2, 400);
      ctx.fillStyle = '#FFD700'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 450);
      return;
    }

    targets.forEach(function(t) {
      if (!t.alive) return;
      ctx.fillStyle = t.color; ctx.shadowBlur = 6; ctx.shadowColor = t.color;
      ctx.fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(t.pts + 'pt', t.x, t.y + 4);
    });

    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(60, VH - 60); ctx.lineTo(80, 680); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, VH - 60); ctx.lineTo(80, 680); ctx.stroke();

    if (!ball && phase === 'AIM' && lastTapX !== null) {
      var tdx = lastTapX - ballX, tdy = lastTapY - ballY;
      var power = 3.5;
      var pvx = tdx * power, pvy = tdy * power;
      var px = ballX, py = ballY;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([5, 8]);
      ctx.beginPath(); ctx.moveTo(px, py);
      var step = 1 / 60;
      for (var si = 0; si < 60; si++) {
        pvx *= 0.99;
        pvy += 400 * step;
        px += pvx * step;
        py += pvy * step;
        ctx.lineTo(px, py);
        if (px < -20 || px > VW + 20 || py > VH + 20) break;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    if (ball) {
      ctx.fillStyle = '#FF6B6B'; ctx.shadowBlur = 12; ctx.shadowColor = '#FF6B6B';
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#FF6B6B'; ctx.shadowBlur = 8; ctx.shadowColor = '#FF6B6B';
      ctx.beginPath(); ctx.arc(ballX, ballY, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#333'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.textAlign = 'right'; ctx.fillText('Shots: ' + shotsLeft, VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('DONE!', VW / 2, 310);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW / 2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW / 2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING' && !ball) {
      lastTapX = x; lastTapY = y;
      var dx = x - ballX, dy = y - ballY;
      var power = 3.5;
      ball = { x: ballX, y: ballY, vx: dx * power, vy: dy * power };
      shotsLeft--;
      try { Audio.play('tap'); } catch(e) {}
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
