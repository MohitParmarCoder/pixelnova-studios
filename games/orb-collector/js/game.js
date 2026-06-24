'use strict';
var OrbCollector = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, player, orbs, particles, spawnTimer;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; particles = []; orbs = []; spawnTimer = 0.6;
    player = { x: VW/2, y: VH/2, vx: 0, vy: 0, r: 16, targetX: VW/2, targetY: VH/2 };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random()*Math.PI*2;
      particles.push({ x:x, y:y, vx:Math.cos(a)*80, vy:Math.sin(a)*80, life:0.5, maxLife:0.5, color:color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    var damp = Math.pow(0.85, dt * 60);
    player.vx += (player.targetX - player.x) * 6 * dt;
    player.vy += (player.targetY - player.y) * 6 * dt;
    player.vx *= damp; player.vy *= damp;
    player.x += player.vx * dt * 60; player.y += player.vy * dt * 60;
    player.x = Math.max(player.r, Math.min(VW - player.r, player.x));
    player.y = Math.max(player.r, Math.min(VH - player.r, player.y));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      var baseInterval = Math.max(0.2, 0.4 - score * 0.004);
      spawnTimer = baseInterval + Math.random() * 0.3;
      var bad = Math.random() < 0.3;
      var side = Math.floor(Math.random() * 4);
      var ox, oy;
      if (side === 0) { ox = Math.random()*VW; oy = -20; }
      else if (side === 1) { ox = VW+20; oy = Math.random()*VH; }
      else if (side === 2) { ox = Math.random()*VW; oy = VH+20; }
      else { ox = -20; oy = Math.random()*VH; }
      var spd = Math.min(500, (80 + Math.random() * 60) * (1 + score * 0.02));
      var dx = player.x - ox, dy = player.y - oy, dist = Math.sqrt(dx*dx+dy*dy);
      orbs.push({ x:ox, y:oy, vx:(dx/dist)*spd, vy:(dy/dist)*spd, r:16, bad:bad,
        color: bad ? '#f87171' : ['#a8edea','#FFD700','#6BCB77','#CC5DE8'][Math.floor(Math.random()*4)] });
    }

    for (var i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i];
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.x < -60 || o.x > VW+60 || o.y < -60 || o.y > VH+60) { orbs.splice(i, 1); continue; }
      var dx = o.x - player.x, dy = o.y - player.y;
      if (dx*dx + dy*dy < (o.r + player.r) * (o.r + player.r)) {
        if (o.bad) {
          lives--;
          addParticles(o.x, o.y, '#f87171');
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { state='DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} 
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'orbcollector_best'); } catch(e) {}
          }
        } else {
          score++; if (score > best) { best = score; AdManager.happyTime(1.0); }
          addParticles(o.x, o.y, o.color);
          try { Audio.play('gem'); } catch(e) {}
        }
        orbs.splice(i, 1);
      }
    }

    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#050015'); g.addColorStop(1, '#001020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#a8edea'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#a8edea';
      ctx.fillText('ORB COLLECTOR', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Collect glowing orbs!', VW/2, 350);
      ctx.fillText('Avoid red anti-orbs!', VW/2, 385);
      ctx.fillText('TAP TO PLAY', VW/2, 450);
      ctx.fillStyle = '#FFD700'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 510);
      return;
    }

    orbs.forEach(function(o) {
      ctx.fillStyle = o.color; ctx.shadowBlur = 14; ctx.shadowColor = o.color;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      if (o.bad) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o.x-8, o.y-8); ctx.lineTo(o.x+8, o.y+8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x+8, o.y-8); ctx.lineTo(o.x-8, o.y+8); ctx.stroke();
      }
    });

    var pg = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r);
    pg.addColorStop(0, '#fff'); pg.addColorStop(0.4, '#a8edea'); pg.addColorStop(1, 'rgba(0,200,200,0)');
    ctx.fillStyle = pg; ctx.shadowBlur = 20; ctx.shadowColor = '#a8edea';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#a8edea'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#a8edea'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#FFD700'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    player.targetX = x; player.targetY = y;
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
