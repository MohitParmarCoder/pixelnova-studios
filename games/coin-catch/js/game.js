'use strict';
var CoinCatch = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, coins, particles, spawnTimer, spawnInterval, speed;
  var basket = { x: 195, w: 70, h: 22, y: VH - 80 };
  var dragX = null;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; coins = []; particles = [];
    spawnTimer = 0; spawnInterval = 1.2; speed = 160;
    basket.x = VW / 2;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnCoin() {
    var types = [
      { color: '#FFD700', pts: 1, r: 14 },
      { color: '#C0C0C0', pts: 2, r: 12 },
      { color: '#a8edea', pts: 3, r: 10 }
    ];
    var t = types[Math.floor(Math.random() * types.length)];
    coins.push({ x: 20 + Math.random() * (VW - 40), y: -20, r: t.r, color: t.color, pts: t.pts, spin: 0 });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (50 + Math.random() * 60),
        vy: Math.sin(a) * (50 + Math.random() * 60), life: 0.6, maxLife: 0.6, color: color });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnCoin(); }
    speed = 160 + score * 2.5;
    spawnInterval = Math.max(0.4, 1.2 - score * 0.01);

    for (var i = coins.length - 1; i >= 0; i--) {
      var co = coins[i];
      co.y += speed * dt;
      co.spin += dt * 2;
      if (co.y > basket.y - 10 && co.y < basket.y + basket.h &&
          co.x > basket.x - basket.w / 2 - co.r && co.x < basket.x + basket.w / 2 + co.r) {
        score += co.pts;
        if (score > best) { best = score; AdManager.happyTime(1.0); }
        addParticles(co.x, basket.y, co.color);
        try { Audio.play('gem'); } catch(e) {}
        coins.splice(i, 1);
      } else if (co.y > VH + 20) {
        lives--;
        spawnTimer = Math.min(spawnTimer, -0.6); // 600ms grace period before next coin
        try { Audio.play('crash'); } catch(e) {}
        coins.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} 
          AdManager.showInterstitial(() => {});
          try { AdManager.offerDoubleScore(score, 'coincatch_best'); } catch(e) {}
        }
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
    if (dragX !== null) basket.x += (dragX - basket.x) * 0.25;
    basket.x = Math.max(basket.w / 2, Math.min(VW - basket.w / 2, basket.x));
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a0015'); g.addColorStop(1, '#1a0030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawBasket() {
    var bx = basket.x - basket.w / 2, by = basket.y;
    ctx.save();
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + basket.w, by);
    ctx.lineTo(bx + basket.w - 8, by + basket.h); ctx.lineTo(bx + 8, by + basket.h);
    ctx.closePath(); ctx.stroke();
    var g2 = ctx.createLinearGradient(bx, by, bx, by + basket.h);
    g2.addColorStop(0, 'rgba(168,237,234,0.18)'); g2.addColorStop(1, 'rgba(168,237,234,0.05)');
    ctx.fillStyle = g2; ctx.fill();
    ctx.restore();
  }

  function draw() {
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700';
      ctx.fillText('COIN CATCH', VW / 2, 280);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 440);
      drawBasket();
      return;
    }
    coins.forEach(function (co) {
      ctx.save(); ctx.translate(co.x, co.y);
      ctx.rotate(co.spin);
      ctx.fillStyle = co.color; ctx.shadowBlur = 12; ctx.shadowColor = co.color;
      ctx.beginPath(); ctx.ellipse(0, 0, co.r, co.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    });
    particles.forEach(function (p) {
      var a = p.life / p.maxLife;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * a, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawBasket();
    // HUD
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    ctx.fillText('♥'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives)), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 320);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 430);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 500);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    dragX = x;
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
