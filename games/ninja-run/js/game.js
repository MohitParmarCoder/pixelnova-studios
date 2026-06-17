'use strict';
var NinjaRun = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, dist, player, obstacles, particles, spawnTimer, jumpCount;
  var GROUND = VH - 120;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; dist = 0; jumpCount = 0; particles = []; obstacles = []; spawnTimer = 1.5;
    player = { x: 80, y: GROUND, vy: 0, w: 36, h: 48, onGround: true };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function jump() {
    if (player.onGround) { player.vy = -780; player.onGround = false; jumpCount = 1; try { Audio.play('tap'); } catch(e) {} }
    else if (jumpCount < 2) { player.vy = -680; jumpCount = 2; try { Audio.play('tap'); } catch(e) {} }
  }

  function addParticles(x, y) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x:x, y:y, vx:Math.cos(a)*80, vy:Math.sin(a)*80-60, life:0.4, maxLife:0.4, color:'#f87171' });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var speed = 280 + dist * 0.04;
    dist += speed * dt;
    score = Math.floor(dist / 50);
    if (score > best) best = score;

    player.vy += 1800 * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND) { player.y = GROUND; player.vy = 0; player.onGround = true; jumpCount = 0; }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.8 + Math.random() * 0.8;
      var type = Math.random();
      if (type < 0.5) obstacles.push({x:VW+20, y:GROUND, w:20, h:50+Math.random()*40, type:'wall'});
      else obstacles.push({x:VW+20, y:GROUND-60, w:50, h:16, type:'blade'});
    }

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var ob = obstacles[i];
      ob.x -= speed * dt;
      if (ob.x < -100) { obstacles.splice(i, 1); continue; }
      var px = player.x, py = player.y, pw = player.w, ph = player.h;
      if (px + pw - 8 > ob.x && px + 8 < ob.x + ob.w && py - ph + 8 < ob.y && py - 8 > ob.y - ob.h - 8) {
        addParticles(player.x + pw/2, player.y - ph/2);
        try { Audio.play('crash'); } catch(e) {}
        state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        return;
      }
    }

    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 400*dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawNinja(x, y, w, h) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(x + 4, y - h, w - 8, 8);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x + w*0.3, y - h*0.7, w*0.4, w*0.4);
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, VW, VH);
    for (var s = 0; s < 3; s++) {
      var sd = (s + 1) * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,' + sd * 0.3 + ')';
      for (var i2 = 0; i2 < 10; i2++) {
        var sx = ((i2 * 97 + dist * sd * 0.5) % VW);
        ctx.fillRect(sx, 50 + i2 * 60, 2, 20);
      }
    }
    ctx.fillStyle = '#1a1a3e'; ctx.fillRect(0, GROUND, VW, VH - GROUND);
    ctx.fillStyle = '#2a2a5e'; ctx.fillRect(0, GROUND - 4, VW, 4);

    if (state === 'MENU') {
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 54px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#f87171';
      ctx.fillText('NINJA RUN', VW/2, 300);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap to jump, double tap = double jump', VW/2, 370);
      ctx.fillText('TAP TO PLAY', VW/2, 430);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 490);
      return;
    }

    obstacles.forEach(function(ob) {
      ctx.fillStyle = ob.type === 'wall' ? '#4a4a8e' : '#cc3333';
      ctx.fillRect(ob.x, ob.y - ob.h, ob.w, ob.h);
      if (ob.type === 'blade') {
        ctx.fillStyle = '#ff8888';
        for (var b = 0; b < 3; b++) {
          ctx.beginPath(); ctx.moveTo(ob.x + b*18, ob.y - ob.h);
          ctx.lineTo(ob.x + b*18 + 9, ob.y - ob.h - 16);
          ctx.lineTo(ob.x + b*18 + 18, ob.y - ob.h);
          ctx.fill();
        }
      }
    });

    drawNinja(player.x, player.y, player.w, player.h);

    particles.forEach(function(p) {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#f87171'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.shadowBlur = 0; ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#a8edea'; ctx.textAlign = 'right'; ctx.fillText('Best: ' + best, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('CAUGHT!', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    jump();
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
