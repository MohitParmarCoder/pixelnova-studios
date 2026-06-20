'use strict';
var PegDrop = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, balls, ballsLeft, particles;
  var SLOTS = [1, 2, 3, 5, 10, 5, 3, 2, 1];
  var PEGS = [];
  var activeBall = null;
  var dropX = VW / 2;

  function buildPegs() {
    PEGS = [];
    var rows = 6, startY = 220, gapY = 70, gapX = 44;
    for (var r = 0; r < rows; r++) {
      var cols = r + 3;
      var startX = VW / 2 - (cols - 1) * gapX / 2;
      for (var col = 0; col < cols; col++) {
        PEGS.push({ x: startX + col * gapX, y: startY + r * gapY, r: 6 });
      }
    }
  }

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; buildPegs();
  }

  function startGame() {
    score = 0; balls = []; particles = []; ballsLeft = 10; activeBall = null;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    dropBall(VW / 2);
  }

  function dropBall(x) {
    if (ballsLeft <= 0) return;
    ballsLeft--;
    activeBall = { x: x, y: 60, vx: (Math.random() - 0.5) * 20, vy: 0, r: 10, settled: false };
    balls.push(activeBall);
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (50 + Math.random() * 60), vy: Math.sin(a) * (50 + Math.random() * 60), life: 0.5, maxLife: 0.5, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var gravity = 600;

    for (var i = balls.length - 1; i >= 0; i--) {
      var b = balls[i];
      if (b.settled) continue;
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > VW - b.r) { b.x = VW - b.r; b.vx = -Math.abs(b.vx) * 0.6; }

      for (var p = 0; p < PEGS.length; p++) {
        var pg = PEGS[p];
        var dx = b.x - pg.x, dy = b.y - pg.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < b.r + pg.r) {
          var nx = dx / dist, ny = dy / dist;
          var dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.7 + (Math.random() - 0.5) * 40;
          b.vy = (b.vy - 2 * dot * ny) * 0.7;
          b.x = pg.x + nx * (b.r + pg.r + 1);
          b.y = pg.y + ny * (b.r + pg.r + 1);
        }
      }

      var slotBottom = 840;
      if (b.y > slotBottom - b.r) {
        var slotW = VW / SLOTS.length;
        var slotIdx = Math.floor(b.x / slotW);
        slotIdx = Math.max(0, Math.min(SLOTS.length - 1, slotIdx));
        var pts = SLOTS[slotIdx];
        score += pts; if (score > best) best = score;
        addParticles(b.x, slotBottom - 20, pts >= 5 ? '#FFD700' : '#a8edea');
        try { Audio.play(pts >= 5 ? 'gem' : 'tap'); } catch(e) {}
        balls.splice(i, 1);
        if (balls.length === 0 && ballsLeft === 0) {
          state = 'DEAD';
          try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'pegdrop_best'); } catch(e) {}
        } else if (balls.length === 0 && ballsLeft > 0) {
          setTimeout(function() { if (state === 'PLAYING') dropBall(dropX); }, 300);
        }
      }
    }

    for (var j = particles.length - 1; j >= 0; j--) {
      var pt = particles[j]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 200 * dt; pt.life -= dt;
      if (pt.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a001a'); g.addColorStop(1, '#1a0030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#FFD700';
      ctx.fillText('PEG DROP', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO DROP A BALL', VW / 2, 360);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 420);
      return;
    }

    PEGS.forEach(function(p) {
      ctx.fillStyle = '#a8edea'; ctx.shadowBlur = 8; ctx.shadowColor = '#a8edea';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;

    var slotW = VW / SLOTS.length;
    for (var s = 0; s < SLOTS.length; s++) {
      var sx = s * slotW;
      var hue = SLOTS[s] >= 10 ? '#FFD700' : SLOTS[s] >= 5 ? '#FF8C00' : '#4488ff';
      ctx.fillStyle = 'rgba(100,100,200,0.15)';
      ctx.fillRect(sx + 1, VH - 60, slotW - 2, 60);
      ctx.strokeStyle = 'rgba(168,237,234,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(sx + 1, VH - 60, slotW - 2, 60);
      ctx.fillStyle = hue; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(SLOTS[s], sx + slotW / 2, VH - 30);
    }

    balls.forEach(function(b) {
      ctx.fillStyle = '#FF6B6B'; ctx.shadowBlur = 12; ctx.shadowColor = '#FF6B6B';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#a8edea'; ctx.textAlign = 'right';
    ctx.fillText('Balls: ' + ballsLeft, VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW / 2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW / 2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING' && balls.length === 0 && ballsLeft > 0) {
      dropX = x; dropBall(x);
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
