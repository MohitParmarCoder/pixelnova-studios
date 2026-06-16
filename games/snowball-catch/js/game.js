'use strict';
var SnowballCatch = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, items, particles, spawnTimer, spawnInterval, speed, snowflakes;
  var basket = { x: 195, w: 72, h: 26, y: VH - 80 };
  var dragX = null;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
    snowflakes = [];
    for (var i = 0; i < 50; i++) {
      snowflakes.push({ x: Math.random() * VW, y: Math.random() * VH, r: 1 + Math.random() * 2, spd: 20 + Math.random() * 40, wx: Math.random() * 0.5 - 0.25 });
    }
  }

  function startGame() {
    score = 0; lives = 3; items = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.9; speed = 155;
    basket.x = VW / 2; dragX = null; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnItem() {
    var isIcicle = Math.random() < 0.2 + score * 0.004;
    items.push({
      x: 20 + Math.random() * (VW - 40), y: -20,
      r: isIcicle ? 8 : 14 + Math.random() * 6,
      icicle: isIcicle, speed: speed * (0.8 + Math.random() * 0.4)
    });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.55, maxLife: 0.55, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) basket.x += (dragX - basket.x) * 0.28;
    basket.x = Math.max(basket.w / 2, Math.min(VW - basket.w / 2, basket.x));

    snowflakes.forEach(function (sf) {
      sf.y += sf.spd * dt; sf.x += sf.wx;
      if (sf.y > VH) { sf.y = -5; sf.x = Math.random() * VW; }
    });

    spawnTimer += dt; speed = 155 + score * 3;
    spawnInterval = Math.max(0.35, 0.9 - score * 0.009);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnItem(); }

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.y += it.speed * dt;
      var hit = it.y > basket.y - 10 && it.y < basket.y + basket.h &&
          it.x > basket.x - basket.w / 2 - it.r && it.x < basket.x + basket.w / 2 + it.r;
      if (hit) {
        if (it.icicle) { lives--; addParticles(it.x, it.y, '#88CCFF'); try { Audio.play('crash'); } catch(e) {} }
        else { score++; if (score > best) best = score; addParticles(it.x, it.y, '#fff'); try { Audio.play('land'); } catch(e) {} }
        items.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (it.y > VH + 20) {
        if (!it.icicle) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        items.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#001020'); bg.addColorStop(1, '#102030');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    // snowflakes
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    snowflakes.forEach(function (sf) {
      ctx.beginPath(); ctx.arc(sf.x, sf.y, sf.r, 0, Math.PI * 2); ctx.fill();
    });

    if (state === 'MENU') {
      ctx.fillStyle = '#a8edea'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#a8edea'; ctx.fillText('SNOWBALL CATCH', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '19px system-ui';
      ctx.fillText('Catch snowballs, dodge icicles!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    items.forEach(function (it) {
      ctx.save(); ctx.translate(it.x, it.y);
      if (it.icicle) {
        ctx.fillStyle = '#88CCFF'; ctx.shadowBlur = 10; ctx.shadowColor = '#88CCFF';
        ctx.beginPath(); ctx.moveTo(0, -it.r * 2.5); ctx.lineTo(it.r, 0); ctx.lineTo(-it.r, 0); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 14; ctx.shadowColor = '#a8edea';
        ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(168,237,234,0.3)'; ctx.beginPath(); ctx.arc(-it.r * 0.3, -it.r * 0.3, it.r * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    var bx = basket.x - basket.w / 2;
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(168,237,234,0.1)';
    ctx.beginPath(); ctx.moveTo(bx, basket.y); ctx.lineTo(bx + basket.w, basket.y);
    ctx.lineTo(bx + basket.w - 6, basket.y + basket.h); ctx.lineTo(bx + 6, basket.y + basket.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0; ctx.fillStyle = '#a8edea'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44); ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#a8edea'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380); ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 425); ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU' || state === 'DEAD') { startGame(); return; }
    dragX = x;
  }
  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
