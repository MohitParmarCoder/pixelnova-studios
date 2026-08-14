'use strict';
var GemCollector = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, gems, particles, spawnTimer, spawnInterval, lives;
  var player = { x: 195, y: VH - 100, r: 18, targetX: 195, targetY: VH - 100 };

  var GEM_TYPES = [
    { color: '#00FFFF', pts: 1, r: 12 }, { color: '#FF00FF', pts: 2, r: 11 },
    { color: '#FFD700', pts: 3, r: 10 }, { color: '#00FF88', pts: 2, r: 11 },
    { color: '#FF4466', pts: -0, r: 13, bad: true }
  ];

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; gems = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.9;
    player.x = VW / 2; player.y = VH - 100; player.targetX = VW / 2; player.targetY = VH - 100;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnGem() {
    var side = Math.floor(Math.random() * 4);
    var x, y, vx, vy;
    var spd = Math.min(400, 120 + score * 3);
    if (side === 0) { x = Math.random() * VW; y = -20; vx = 0; vy = spd; }
    else if (side === 1) { x = VW + 20; y = Math.random() * VH; vx = -spd; vy = 0; }
    else if (side === 2) { x = Math.random() * VW; y = VH + 20; vx = 0; vy = -spd; }
    else { x = -20; y = Math.random() * VH; vx = spd; vy = 0; }
    var t = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    gems.push({ x: x, y: y, vx: vx, vy: vy, r: t.r, color: t.color, pts: t.pts, bad: !!t.bad, life: 4 });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.5, maxLife: 0.5, color: color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    player.x += (player.targetX - player.x) * 8 * dt;
    player.y += (player.targetY - player.y) * 8 * dt;

    spawnTimer += dt;
    spawnInterval = Math.max(0.3, 0.9 - score * 0.01);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnGem(); }

    for (var i = gems.length - 1; i >= 0; i--) {
      var g = gems[i];
      g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
      var dx = g.x - player.x, dy = g.y - player.y;
      if (dx * dx + dy * dy < (g.r + player.r) * (g.r + player.r)) {
        if (g.bad) { lives--; addParticles(g.x, g.y, '#FF4466'); try { Audio.play('crash'); } catch(e) {} }
        else { score += g.pts; if (score > best) { best = score; AdManager.happyTime(1.0); } addParticles(g.x, g.y, g.color); try { Audio.play('gem'); } catch(e) {} }
        gems.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} 
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'gemcollector_best'); } catch(e) {}
        }
        continue;
      }
      if (g.life <= 0 || g.x < -50 || g.x > VW + 50 || g.y < -50 || g.y > VH + 50) gems.splice(i, 1);
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawGem(g) {
    ctx.save(); ctx.translate(g.x, g.y);
    ctx.fillStyle = g.color; ctx.shadowBlur = 14; ctx.shadowColor = g.color;
    ctx.beginPath();
    ctx.moveTo(0, -g.r); ctx.lineTo(g.r * 0.7, 0); ctx.lineTo(0, g.r); ctx.lineTo(-g.r * 0.7, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#080020'); bg.addColorStop(1, '#001020');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 46px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#00FFFF'; ctx.fillText('GEM COLLECTOR', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Collect gems, avoid red!', VW / 2, 335); ctx.fillText('TAP TO PLAY', VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 450);
      return;
    }

    gems.forEach(drawGem);
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // player
    ctx.save(); ctx.translate(player.x, player.y);
    var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, player.r);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#a8edea'); pg.addColorStop(1, 'rgba(0,200,200,0)');
    ctx.fillStyle = pg; ctx.shadowBlur = 18; ctx.shadowColor = '#a8edea';
    ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0; ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380); ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 425); ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU' || state === 'DEAD') { startGame(); return; }
    player.targetX = x; player.targetY = y;
  }
  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
