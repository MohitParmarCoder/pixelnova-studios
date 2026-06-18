'use strict';
var NinjaRun = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score, lives;
  var anchors, player, flying, camY;
  var particles;
  var angle, angularVelocity, ropeLen;
  var anchorIdx;

  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; }
  function makeAnchor(x, y) { return { x: x, y: y, r: 14 }; }

  function genAnchors() {
    anchors = [];
    var xs = [60, 195, 330, 80, 260, 140];
    var ys = [120, 100, 130, 220, 210, 310];
    for (var i = 0; i < xs.length; i++) {
      anchors.push(makeAnchor(xs[i], ys[i]));
    }
  }

  function addMoreAnchors() {
    var topY = anchors[anchors.length - 1].y;
    for (var i = 0; i < 3; i++) {
      anchors.push(makeAnchor(rnd(50, VW - 50), topY - rnd(100, 200)));
    }
  }

  function attachToAnchor(idx) {
    anchorIdx = idx;
    var ax = anchors[idx].x;
    var ay = anchors[idx].y;
    angle = Math.atan2(player.x - ax, player.y - ay);
    var tx = Math.cos(angle);
    var ty = -Math.sin(angle);
    angularVelocity = (player.vx * tx + player.vy * ty) / ropeLen;
    flying = false;
  }

  function spawnParticles(x, y, col) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * rnd(60, 140),
        vy: Math.sin(a) * rnd(60, 140),
        life: 0.5, maxLife: 0.5,
        color: col || '#f87171'
      });
    }
  }

  function loseLife() {
    lives--;
    spawnParticles(player.x, player.y - camY, '#f87171');
    try { Audio.play('crash'); } catch(e) {}
    if (lives <= 0) {
      if (score > best) best = score;
      state = 'DEAD';
      try { Audio.play('lose'); } catch(e) {}
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      return;
    }
    flying = false;
    angle = 0.3;
    angularVelocity = 0;
    var ax = anchors[anchorIdx].x, ay = anchors[anchorIdx].y;
    player.x = ax + Math.sin(angle) * ropeLen;
    player.y = ay + Math.cos(angle) * ropeLen;
    player.vx = 0;
    player.vy = 0;
  }

  function startGame() {
    score = 0;
    lives = 3;
    camY = 0;
    particles = [];
    flying = false;
    ropeLen = 140;
    genAnchors();
    anchorIdx = 0;
    angle = 0.3;
    angularVelocity = 0;
    var ax = anchors[0].x, ay = anchors[0].y;
    player = {
      x: ax + Math.sin(angle) * ropeLen,
      y: ay + Math.cos(angle) * ropeLen,
      vx: 0, vy: 0
    };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function init(canvas, bestScore) {
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    particles = [];
    anchors = [];
    player = { x: 0, y: 0, vx: 0, vy: 0 };
    camY = 0;
    score = 0;
    lives = 3;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    var i, p, j, d2, prevIdx;

    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (!flying) {
      var angularAccel = (-9.8 / (ropeLen / 100)) * Math.sin(angle);
      angularVelocity += angularAccel * dt * 18;
      angularVelocity *= Math.pow(0.998, dt * 60);
      angle += angularVelocity * dt;
      var ax = anchors[anchorIdx].x;
      var ay = anchors[anchorIdx].y;
      player.x = ax + Math.sin(angle) * ropeLen;
      player.y = ay + Math.cos(angle) * ropeLen;
      player.vx = Math.cos(angle) * angularVelocity * ropeLen;
      player.vy = Math.sin(angle) * angularVelocity * ropeLen;
    } else {
      player.vy += 500 * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      for (j = 0; j < anchors.length; j++) {
        if (j === anchorIdx) continue;
        d2 = dist2(player.x, player.y, anchors[j].x, anchors[j].y);
        if (d2 < 60 * 60) {
          prevIdx = anchorIdx;
          attachToAnchor(j);
          if (anchors[j].y < anchors[prevIdx].y) {
            score++;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            spawnParticles(player.x, player.y - camY, '#a8edea');
            if (anchors.length - j < 4) addMoreAnchors();
          }
          break;
        }
      }

      if (player.y - camY > VH + 60) {
        loseLife();
        return;
      }
    }

    var targetCamY = player.y - VH * 0.6;
    if (targetCamY < camY) {
      camY += (targetCamY - camY) * Math.min(1, dt * 3);
    }
  }

  function drawHUD() {
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e53e3e';
    var heartsStr = '';
    for (var i = 0; i < 3; i++) {
      heartsStr += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(heartsStr, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(score, VW - 14, 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function draw() {
    var i, s, sx, sy, pt;
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (s = 0; s < 30; s++) {
      sx = (s * 73 + 17) % VW;
      sy = (s * 131 + 41) % VH;
      ctx.fillRect(sx, sy, 2, 2);
    }

    if (state === 'MENU') {
      ctx.fillStyle = '#a8edea';
      ctx.font = 'bold 46px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#a8edea';
      ctx.fillText('ROPE SWING', VW / 2, 300);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '20px system-ui';
      ctx.fillText('Swing between anchors to climb!', VW / 2, 370);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui';
      var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
      ctx.globalAlpha = pulse;
      ctx.fillText('TAP TO PLAY', VW / 2, 440);
      ctx.globalAlpha = 1;
      if (best > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '20px system-ui';
        ctx.fillText('BEST: ' + best, VW / 2, 510);
      }
      ctx.textBaseline = 'alphabetic';
      return;
    }

    ctx.save();
    ctx.translate(0, -camY);

    for (i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      var screenY = anchor.y - camY;
      if (screenY < -30 || screenY > VH + 30) continue;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#a8edea';
      ctx.fillStyle = (i === anchorIdx) ? '#00e5cc' : '#4a9eff';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, anchor.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (!flying) {
      var curAnchor = anchors[anchorIdx];
      ctx.strokeStyle = '#c8a96a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(curAnchor.x, curAnchor.y);
      ctx.lineTo(player.x, player.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff6b6b';
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(player.x - 14, player.y - 6, 28, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x - 8, player.y - 2, 5, 4);
    ctx.fillRect(player.x + 3, player.y - 2, 5, 4);

    ctx.restore();

    for (i = 0; i < particles.length; i++) {
      pt = particles[i];
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawHUD();

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 52px system-ui';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, VH / 2 - 20);
      ctx.fillStyle = '#ffd700';
      ctx.font = '22px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui';
      var p2 = 0.65 + 0.35 * Math.sin(Date.now() * 0.005);
      ctx.globalAlpha = p2;
      ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 80);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  function tap(x, y) {
    var j, d2, prevIdx, bestDistSq, bestJ;
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING') {
      try { Audio.play('tap'); } catch(e) {}
      if (!flying) {
        flying = true;
      } else {
        bestDistSq = 60 * 60;
        bestJ = -1;
        for (j = 0; j < anchors.length; j++) {
          if (j === anchorIdx) continue;
          d2 = dist2(player.x, player.y, anchors[j].x, anchors[j].y);
          if (d2 < bestDistSq) { bestDistSq = d2; bestJ = j; }
        }
        if (bestJ >= 0) {
          prevIdx = anchorIdx;
          attachToAnchor(bestJ);
          if (anchors[bestJ].y < anchors[prevIdx].y) {
            score++;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            spawnParticles(player.x, player.y - camY, '#a8edea');
            if (anchors.length - bestJ < 4) addMoreAnchors();
          }
        }
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
