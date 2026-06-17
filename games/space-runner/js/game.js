'use strict';
var SpaceRunner = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, dist, ship, asteroids, particles, spawnTimer, stars;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
    stars = [];
    for (var i = 0; i < 60; i++) stars.push({ x: Math.random()*VW, y: Math.random()*VH, r: Math.random()*2+0.5 });
  }

  function startGame() {
    score = 0; dist = 0; particles = []; asteroids = []; spawnTimer = 0.8;
    ship = { x: 80, y: VH/2, vy: 0, r: 16 };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function addParticles(x, y) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random()*Math.PI*2;
      particles.push({ x:x, y:y, vx:Math.cos(a)*100, vy:Math.sin(a)*100, life:0.5, maxLife:0.5, color: ['#FF6B6B','#FFD700','#FF8C00'][Math.floor(Math.random()*3)] });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var speed = 240 + dist * 0.05;
    dist += speed * dt;
    score = Math.floor(dist / 50);
    if (score > best) best = score;

    ship.vy += 900 * dt;
    ship.y += ship.vy * dt;
    if (ship.y < ship.r) { ship.y = ship.r; ship.vy = 0; }
    if (ship.y > VH - ship.r) { ship.y = VH - ship.r; ship.vy = 0; }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.5 + Math.random() * 0.6;
      var gap = 160 - dist * 0.01;
      gap = Math.max(80, gap);
      var cy = 80 + Math.random() * (VH - 160);
      asteroids.push({ x: VW + 30, y: cy - gap/2, w: 30 + Math.random()*20, h: cy - gap/2 - 0, isTop: true, gy: cy - gap/2 });
      asteroids.push({ x: VW + 30, y: cy + gap/2, w: 30 + Math.random()*20, h: VH - (cy + gap/2), isTop: false, gy: cy + gap/2 });
    }

    for (var i = asteroids.length - 1; i >= 0; i--) {
      var a = asteroids[i];
      a.x -= speed * dt;
      if (a.x < -60) { asteroids.splice(i, 1); continue; }
      var sx = ship.x, sy = ship.y, sr = ship.r;
      var hit = false;
      if (a.isTop && sx + sr > a.x && sx - sr < a.x + a.w && sy - sr < a.gy) hit = true;
      if (!a.isTop && sx + sr > a.x && sx - sr < a.x + a.w && sy + sr > a.gy) hit = true;
      if (hit) {
        addParticles(ship.x, ship.y);
        try { Audio.play('crash'); } catch(e) {}
        state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        return;
      }
    }

    stars.forEach(function(s) { s.x -= speed * 0.1 * dt; if (s.x < 0) s.x = VW; });

    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    ctx.fillStyle = '#000510'; ctx.fillRect(0, 0, VW, VH);
    stars.forEach(function(s) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + s.r * 0.2) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });

    if (state === 'MENU') {
      ctx.fillStyle = '#4EC5F1'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#4EC5F1';
      ctx.fillText('SPACE RUNNER', VW/2, 280);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap to boost up!', VW/2, 360);
      ctx.fillText('TAP TO PLAY', VW/2, 420);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 480);
      return;
    }

    asteroids.forEach(function(a) {
      ctx.fillStyle = '#666';
      if (a.isTop) {
        ctx.fillRect(a.x, 0, a.w, a.gy);
      } else {
        ctx.fillRect(a.x, a.gy, a.w, VH - a.gy);
      }
      ctx.fillStyle = '#888';
      for (var c2 = 0; c2 < 3; c2++) {
        var cx = a.x + Math.random()*a.w; var cy = a.isTop ? a.gy - 10 - Math.random()*20 : a.gy + 10 + Math.random()*20;
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();
      }
    });

    ctx.save(); ctx.translate(ship.x, ship.y);
    ctx.fillStyle = '#a8edea'; ctx.shadowBlur = 16; ctx.shadowColor = '#a8edea';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -10); ctx.lineTo(-8, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF6B6B'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-20, 0); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#4EC5F1'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('CRASHED!', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#4EC5F1'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    ship.vy = -520;
    try { Audio.play('tap'); } catch(e) {}
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
