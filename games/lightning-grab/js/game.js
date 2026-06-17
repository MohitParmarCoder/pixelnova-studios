'use strict';
var LightningGrab = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, bolts, particles, spawnTimer, spawnInterval, missed;

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; missed = 0; bolts = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.7;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnBolt() {
    var life = 1.2 - score * 0.008;
    life = Math.max(0.35, life);
    bolts.push({
      x: 30 + Math.random() * (VW - 60), y: 120 + Math.random() * (VH - 280),
      life: life, maxLife: life,
      segments: makeBolt(30 + Math.random() * (VW - 60), 120 + Math.random() * (VH - 280))
    });
  }

  function makeBolt(x, y) {
    var segs = []; var cx = x, cy = y;
    for (var i = 0; i < 5; i++) {
      var nx = cx + (Math.random() - 0.5) * 30;
      var ny = cy + (Math.random() - 0.5) * 30;
      segs.push([cx, cy, nx, ny]); cx = nx; cy = ny;
    }
    return segs;
  }

  function addParticles(x, y) {
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (60 + Math.random() * 100),
        vy: Math.sin(a) * (60 + Math.random() * 100), life: 0.5, maxLife: 0.5, color: '#FFD700' });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    spawnTimer += dt;
    spawnInterval = Math.max(0.3, 0.7 - score * 0.005);
    var maxBolts = Math.min(6, 2 + Math.floor(score / 8));
    if (spawnTimer >= spawnInterval && bolts.length < maxBolts) { spawnTimer = 0; spawnBolt(); }

    for (var i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) { bolts.splice(i, 1); missed++; if (missed >= 5) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} } }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawBolt(b) {
    var alpha = b.life / b.maxLife;
    var t = Date.now() / 100;
    ctx.save(); ctx.globalAlpha = alpha;
    // glow ring
    ctx.strokeStyle = 'rgba(255,220,0,' + alpha * 0.3 + ')'; ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2); ctx.stroke();
    // bolt segments
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5; ctx.shadowBlur = 16; ctx.shadowColor = '#FFD700';
    b.segments.forEach(function (seg, idx) {
      var ox = Math.sin(t + idx) * 3, oy = Math.cos(t + idx) * 3;
      ctx.beginPath(); ctx.moveTo(seg[0] - b.x + b.x + ox, seg[1] - b.y + b.y + oy);
      ctx.lineTo(seg[2] - b.x + b.x + ox, seg[3] - b.y + b.y + oy); ctx.stroke();
    });
    // touch indicator
    ctx.fillStyle = 'rgba(255,220,0,' + alpha * 0.5 + ')';
    ctx.beginPath(); ctx.arc(b.x, b.y, 28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#050010'); bg.addColorStop(1, '#100500');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 24; ctx.shadowColor = '#FFD700'; ctx.fillText('LIGHTNING GRAB', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap lightning before it fades!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    bolts.forEach(drawBolt);
    ctx.shadowBlur = 0;
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.shadowBlur = 0; ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < missed ? '#f87171' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(VW - 16 - (5 - i) * 22, 28, 16, 14);
    }

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
    for (var i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i], dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy < 35 * 35) {
        score++; if (score > best) best = score;
        addParticles(b.x, b.y); bolts.splice(i, 1);
        try { Audio.play('power'); } catch(e) {}
        return;
      }
    }
  }
  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
