'use strict';
var PulseDodge = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, player, waves, spawnTimer, t;
  var CX = VW / 2, CY = VH / 2;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; waves = []; spawnTimer = 1.2; t = 0;
    player = { angle: 0, dist: 120, r: 12 };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    t += dt;
    score = Math.floor(t * 10);
    if (score > best) best = score;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.5, 1.2 - t * 0.02);
      var spx = CX + Math.cos(player.angle) * player.dist;
      var wSrc = Math.random() < 0.5 ? { x: CX, y: CY } : { x: spx > CX ? -30 : VW+30, y: CY };
      waves.push({ r: 20, speed: Math.min(500, 200 + t * 2), src: wSrc });
    }

    for (var i = waves.length - 1; i >= 0; i--) {
      waves[i].r += waves[i].speed * dt;
      if (waves[i].r > Math.max(VW, VH)) { waves.splice(i, 1); continue; }

      var px = CX + Math.cos(player.angle) * player.dist;
      var py = CY + Math.sin(player.angle) * player.dist;
      var wr = waves[i].r;
      var src = waves[i].src;
      var dx = px - src.x, dy = py - src.y;
      var dist = Math.sqrt(dx*dx + dy*dy);
      if (Math.abs(dist - wr) < player.r + 4) {
        lives--;
        try { Audio.play('crash'); } catch(e) {}
        waves.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'pulsedodge_best'); } catch(e) {}
          return; }
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#030312'; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#CC5DE8'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#CC5DE8';
      ctx.fillText('PULSE DODGE', VW/2, 280);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap to orbit & dodge pulses!', VW/2, 360);
      ctx.fillText('TAP TO PLAY', VW/2, 420);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 480);
      return;
    }

    ctx.strokeStyle = 'rgba(200,100,255,0.15)'; ctx.lineWidth = 1;
    for (var ring = 60; ring < 300; ring += 60) {
      ctx.beginPath(); ctx.arc(CX, CY, ring, 0, Math.PI*2); ctx.stroke();
    }

    waves.forEach(function(w) {
      var src = w.src;
      var alpha = Math.max(0, 1 - w.r / 350);
      ctx.strokeStyle = 'rgba(200,100,255,' + alpha + ')';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(src.x, src.y, w.r, 0, Math.PI*2); ctx.stroke();
    });

    var px = CX + Math.cos(player.angle) * player.dist;
    var py = CY + Math.sin(player.angle) * player.dist;
    var pg = ctx.createRadialGradient(px, py, 0, px, py, player.r);
    pg.addColorStop(0, '#fff'); pg.addColorStop(0.5, '#a8edea'); pg.addColorStop(1, 'rgba(0,200,200,0)');
    ctx.fillStyle = pg; ctx.shadowBlur = 18; ctx.shadowColor = '#a8edea';
    ctx.beginPath(); ctx.arc(px, py, player.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#CC5DE8'; ctx.shadowBlur = 8; ctx.shadowColor = '#CC5DE8';
    ctx.beginPath(); ctx.arc(CX, CY, 8, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#CC5DE8'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#CC5DE8'; ctx.fillText('PULSED!', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    var dx = x - CX, dy = y - CY;
    player.angle = Math.atan2(dy, dx);
    player.dist = Math.max(60, Math.min(160, Math.sqrt(dx*dx+dy*dy)));
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
