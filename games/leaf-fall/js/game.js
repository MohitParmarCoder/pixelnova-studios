'use strict';
var LeafFall = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, bugs, particles, spawnTimer, spawnInterval, baseSpeed;
  var MAX_BUGS = 8;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function makeBug() {
    var gold = Math.random() < 0.15;
    var r = gold ? 18 : 12;
    var pts = gold ? 5 : 1;
    var color = gold ? '#ffd700' : (['#ff6b6b','#6bcb77','#4d96ff','#c77dff','#ff9f43'])[Math.floor(Math.random() * 5)];
    var fromLeft = Math.random() < 0.5;
    var speed = baseSpeed + Math.random() * 60;
    return {
      x: fromLeft ? -r - 10 : VW + r + 10,
      y: 100 + Math.random() * (VH - 200),
      r: r, pts: pts, color: color,
      speed: speed,
      dir: fromLeft ? 1 : -1,
      sinOffset: Math.random() * Math.PI * 2,
      sinAmp: 30 + Math.random() * 50,
      sinFreq: 1.5 + Math.random() * 1.5,
      baseY: 0,
      t: 0,
      gold: gold
    };
  }

  function startGame() {
    score = 0; lives = 3; bugs = []; particles = [];
    spawnTimer = 0; spawnInterval = 1.2; baseSpeed = 80;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function addParticles(x, y, color) {
    var i, a;
    for (i = 0; i < 12; i++) {
      a = (i / 12) * Math.PI * 2;
      particles.push({ x: x, y: y,
        vx: Math.cos(a) * (50 + Math.random() * 70),
        vy: Math.sin(a) * (50 + Math.random() * 70),
        life: 0.6, maxLife: 0.6, color: color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    var i, b, p;
    spawnTimer += dt;
    spawnInterval = Math.max(0.5, 1.2 - score * 0.01);
    baseSpeed = Math.min(300, 80 + score * 2);
    if (spawnTimer >= spawnInterval && bugs.length < MAX_BUGS) {
      spawnTimer = 0;
      var nb = makeBug();
      nb.baseY = nb.y;
      bugs.push(nb);
    }

    for (i = bugs.length - 1; i >= 0; i--) {
      b = bugs[i];
      b.t += dt;
      b.x += b.speed * b.dir * dt;
      b.y = b.baseY + Math.sin(b.sinOffset + b.t * b.sinFreq) * b.sinAmp;
      if (b.x < -b.r - 30 || b.x > VW + b.r + 30) {
        if (b.gold) {
          lives--;
          try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) {
            lives = 0; state = 'DEAD';
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'leaffall_best'); } catch(e) {}
            return;
          }
        }
        bugs.splice(i, 1);
      }
    }

    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 180 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBug(b) {
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowBlur = b.gold ? 18 : 8;
    ctx.shadowColor = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = b.gold ? '#333' : '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x - 4, b.y - b.r);
    ctx.lineTo(b.x - 8, b.y - b.r - 10);
    ctx.moveTo(b.x + 4, b.y - b.r);
    ctx.lineTo(b.x + 8, b.y - b.r - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x - b.r, b.y - 4); ctx.lineTo(b.x - b.r - 12, b.y - 8);
    ctx.moveTo(b.x - b.r, b.y + 4); ctx.lineTo(b.x - b.r - 10, b.y + 8);
    ctx.moveTo(b.x + b.r, b.y - 4); ctx.lineTo(b.x + b.r + 12, b.y - 8);
    ctx.moveTo(b.x + b.r, b.y + 4); ctx.lineTo(b.x + b.r + 10, b.y + 8);
    ctx.stroke();
    if (b.gold) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('5', b.x, b.y);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0f2027'); g.addColorStop(1, '#203a43');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function draw() {
    var i, p, a, hearts, h;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#6bcb77'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#6bcb77';
      ctx.fillText('LEAF FALL', VW / 2, 300);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('Tap bugs to catch them!', VW / 2, 370);
      ctx.fillStyle = '#ffd700'; ctx.font = '20px system-ui';
      ctx.fillText('Gold bugs = 5pts (dont miss!)', VW / 2, 408);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 456);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 520);
      ctx.textAlign = 'left';
      return;
    }
    for (i = 0; i < bugs.length; i++) drawBug(bugs[i]);
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      a = p.life / p.maxLife;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6bcb77'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, 44);
    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 320);
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffd700'; ctx.font = 'bold 32px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 430);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 500);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;
    var i, b, dx, dy, dist;
    for (i = bugs.length - 1; i >= 0; i--) {
      b = bugs[i];
      dx = x - b.x; dy = y - b.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.r + 10) {
        score += b.pts;
        if (score > best) { best = score; AdManager.happyTime(1.0); }
        addParticles(b.x, b.y, b.color);
        try { Audio.play('gem'); } catch(e) {}
        bugs.splice(i, 1);
        return;
      }
    }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
