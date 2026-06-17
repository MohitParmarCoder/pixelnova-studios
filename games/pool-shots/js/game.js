'use strict';
var PoolShots = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, shotsLeft, cueBall, targetBall, aiming;
  var POCKETS = [
    {x:30,y:200},{x:VW/2,y:190},{x:VW-30,y:200},
    {x:30,y:700},{x:VW/2,y:710},{x:VW-30,y:700}
  ];
  var TABLE = {x:20,y:180,w:350,h:540};

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function resetBalls() {
    cueBall = { x: TABLE.x + TABLE.w/2, y: TABLE.y + TABLE.h*0.7, r: 12, vx: 0, vy: 0 };
    targetBall = { x: TABLE.x + TABLE.w/2, y: TABLE.y + TABLE.h*0.3, r: 12, vx: 0, vy: 0, color: '#FF6B6B', pocketed: false };
  }

  function startGame() {
    score = 0; shotsLeft = 10; aiming = false;
    resetBalls();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function ballMoving(b) { return Math.abs(b.vx) > 2 || Math.abs(b.vy) > 2; }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var friction = 0.96;

    [cueBall, targetBall].forEach(function(b) {
      if (!b || b.pocketed) return;
      b.vx *= friction; b.vy *= friction;
      if (Math.abs(b.vx) < 1) b.vx = 0;
      if (Math.abs(b.vy) < 1) b.vy = 0;
      b.x += b.vx * dt; b.y += b.vy * dt;

      if (b.x < TABLE.x + b.r) { b.x = TABLE.x + b.r; b.vx = Math.abs(b.vx); }
      if (b.x > TABLE.x + TABLE.w - b.r) { b.x = TABLE.x + TABLE.w - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < TABLE.y + b.r) { b.y = TABLE.y + b.r; b.vy = Math.abs(b.vy); }
      if (b.y > TABLE.y + TABLE.h - b.r) { b.y = TABLE.y + TABLE.h - b.r; b.vy = -Math.abs(b.vy); }

      for (var p = 0; p < POCKETS.length; p++) {
        var pk = POCKETS[p];
        var dx = b.x - pk.x, dy = b.y - pk.y;
        if (dx*dx + dy*dy < 18*18) {
          if (b === targetBall && !b.pocketed) {
            b.pocketed = true; b.vx = 0; b.vy = 0;
            score++; if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            setTimeout(function() {
              if (state === 'PLAYING') { resetBalls(); }
            }, 600);
          } else if (b === cueBall) {
            b.x = TABLE.x + TABLE.w/2; b.y = TABLE.y + TABLE.h*0.7; b.vx = 0; b.vy = 0;
            try { Audio.play('crash'); } catch(e) {}
          }
        }
      }
    });

    var dx = cueBall.x - targetBall.x, dy = cueBall.y - targetBall.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < cueBall.r + targetBall.r && !targetBall.pocketed) {
      var nx = dx/dist, ny = dy/dist;
      var dvx = cueBall.vx - targetBall.vx, dvy = cueBall.vy - targetBall.vy;
      var dot = dvx*nx + dvy*ny;
      if (dot < 0) {
        cueBall.vx -= dot*nx; cueBall.vy -= dot*ny;
        targetBall.vx += dot*nx; targetBall.vy += dot*ny;
        var overlap = (cueBall.r + targetBall.r - dist) / 2;
        cueBall.x += nx*overlap; cueBall.y += ny*overlap;
        targetBall.x -= nx*overlap; targetBall.y -= ny*overlap;
      }
    }

    if (shotsLeft <= 0 && !ballMoving(cueBall) && !ballMoving(targetBall)) {
      state = 'DEAD';
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    }
  }

  function draw() {
    ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#1a5c2a'; ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 12;
    ctx.strokeRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);

    POCKETS.forEach(function(p) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI*2); ctx.fill();
    });

    if (state === 'MENU') {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 12; ctx.shadowColor = '#000'; ctx.fillText('POOL SHOTS', VW/2, 520);
      ctx.shadowBlur = 0; ctx.font = '20px system-ui'; ctx.fillText('TAP TO SHOOT', VW/2, 580);
      ctx.fillStyle = '#FFD700'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW/2, 630);
      return;
    }

    if (!targetBall.pocketed) {
      ctx.fillStyle = targetBall.color; ctx.shadowBlur = 8; ctx.shadowColor = targetBall.color;
      ctx.beginPath(); ctx.arc(targetBall.x, targetBall.y, targetBall.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (aiming && !ballMoving(cueBall)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(cueBall.x, cueBall.y); ctx.lineTo(aiming.x, aiming.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#fff'; ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(cueBall.x, cueBall.y, cueBall.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Pots: ' + score, 16, 44);
    ctx.textAlign = 'right'; ctx.fillText('Shots: ' + shotsLeft, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700'; ctx.fillText('FINAL!', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Pots: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING' && !ballMoving(cueBall) && !ballMoving(targetBall) && !targetBall.pocketed) {
      var dx = cueBall.x - x, dy = cueBall.y - y;
      var dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
        var power = Math.min(dist * 1.2, 350);
        cueBall.vx = (dx / dist) * power;
        cueBall.vy = (dy / dist) * power;
        shotsLeft--;
        aiming = null;
        try { Audio.play('tap'); } catch(e) {}
      }
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
