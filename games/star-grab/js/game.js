'use strict';
var StarGrab = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, stars, spawnTimer, spawnInterval, maxStars, particles;

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; stars = []; particles = []; spawnTimer = 0; spawnInterval = 0.8; maxStars = 3;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) best = score;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'stargrab_best'); } catch(e) {}
    state = 'DEAD';
  }

  function spawnStar() {
    var size = 16 + Math.random() * 18;
    stars.push({
      x: 40 + Math.random() * (VW - 80), y: 100 + Math.random() * (VH - 220),
      r: size, life: 2.5 - Math.random() * 0.8, maxLife: 2.5, scale: 0, growing: true,
      color: ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FF8C00'][Math.floor(Math.random() * 5)],
      pts: Math.ceil(20 / size)
    });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 100;
      particles.push({ x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.6, maxLife: 0.6, color: color });
    }
  }

  function drawStar(x, y, r, rot, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = col; ctx.shadowBlur = 16; ctx.shadowColor = col;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = (i * Math.PI / 5) - Math.PI / 2;
      var rr = i % 2 === 0 ? r : r * 0.45;
      var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    spawnTimer += dt;
    spawnInterval = Math.max(0.4, 0.8 - score * 0.005);
    maxStars = Math.min(8, 3 + Math.floor(score / 10));
    if (spawnTimer >= spawnInterval && stars.length < maxStars) { spawnTimer = 0; spawnStar(); }

    for (var i = stars.length - 1; i >= 0; i--) {
      var s = stars[i];
      s.life -= dt;
      if (s.growing) { s.scale = Math.min(1, s.scale + dt * 3); if (s.scale >= 1) s.growing = false; }
      if (s.life <= 0) {
        stars.splice(i, 1);
        lives--;
        try { Audio.play('crash'); } catch(e) {}
        if (lives <= 0) { endGame(); return; }
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#000510'); bg.addColorStop(1, '#050010');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      for (var i = 0; i < 30; i++) {
        var sx = (i * 137.5) % VW, sy = (i * 83.7) % VH;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + (i % 5) * 0.1) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 52px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 24; ctx.shadowColor = '#FFD700'; ctx.fillText('STAR GRAB', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap stars before they fade!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    var t = Date.now() / 1000;
    stars.forEach(function (s) {
      var lifeRatio = s.life / s.maxLife;
      var alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      alpha *= s.scale;
      drawStar(s.x, s.y, s.r * s.scale, t * 0.5, s.color, alpha);
      if (lifeRatio < 0.3) {
        ctx.save(); ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = s.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (1 + (0.3 - lifeRatio) * 2), 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
      }
    });
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.shadowBlur = 0; ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.font = '22px system-ui'; ctx.textAlign = 'right';
    var hearts = ''; for (var hi = 0; hi < 3; hi++) hearts += (hi < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW - 16, 44);
    ctx.textAlign = 'left';

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380); ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 425); ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    var hit = false;
    for (var i = stars.length - 1; i >= 0; i--) {
      var s = stars[i];
      var dx = x - s.x, dy = y - s.y;
      if (dx * dx + dy * dy < (s.r + 10) * (s.r + 10)) {
        score += s.pts; if (score > best) best = score;
        addParticles(s.x, s.y, s.color);
        stars.splice(i, 1); hit = true;
        try { Audio.play('gem'); } catch(e) {}
        break;
      }
    }
    if (!hit && stars.length > 0) {
      score = Math.max(0, score - 1);
      try { Audio.play('tap'); } catch(e) {}
    }
  }
  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
