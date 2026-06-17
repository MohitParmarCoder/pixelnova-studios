'use strict';
var CandyRain = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, items, particles, spawnTimer, spawnInterval, speed;
  var bucket = { x: 195, w: 68, h: 26, y: VH - 80 };
  var dragX = null;

  var CANDY_COLORS = ['#FF6B9D', '#FF8C42', '#6BCB77', '#4D9DE0', '#E15FC0', '#FFC300'];

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; items = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.85; speed = 150;
    bucket.x = VW / 2; dragX = null; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnCandy() {
    var isGolden = Math.random() < 0.1;
    var isBad = Math.random() < 0.15;
    items.push({
      x: 20 + Math.random() * (VW - 40), y: -18,
      r: isGolden ? 16 : 12,
      color: isGolden ? '#FFD700' : (isBad ? '#888' : CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)]),
      pts: isGolden ? 5 : (isBad ? 0 : 1),
      golden: isGolden, bad: isBad,
      wobble: Math.random() * Math.PI * 2, wobbleSpd: 2 + Math.random() * 2
    });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (50 + Math.random() * 90),
        vy: Math.sin(a) * (50 + Math.random() * 90), life: 0.65, maxLife: 0.65, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) bucket.x += (dragX - bucket.x) * 0.3;
    bucket.x = Math.max(bucket.w / 2, Math.min(VW - bucket.w / 2, bucket.x));

    spawnTimer += dt; speed = 150 + score * 3;
    spawnInterval = Math.max(0.35, 0.85 - score * 0.009);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnCandy(); }

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.y += speed * dt;
      it.wobble += it.wobbleSpd * dt;
      it.x += Math.sin(it.wobble) * 0.8;
      var hit = it.y > bucket.y - 10 && it.y < bucket.y + bucket.h &&
          it.x > bucket.x - bucket.w / 2 - it.r && it.x < bucket.x + bucket.w / 2 + it.r;
      if (hit) {
        if (it.bad) { lives--; addParticles(it.x, it.y, '#aaa'); try { Audio.play('crash'); } catch(e) {} }
        else { score += it.pts; if (score > best) best = score; addParticles(it.x, it.y, it.color); try { Audio.play(it.golden ? 'power' : 'gem'); } catch(e) {} }
        items.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (it.y > VH + 20) {
        if (!it.bad) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        items.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawCandy(it) {
    ctx.save(); ctx.translate(it.x, it.y);
    if (it.golden) {
      ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700';
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF8DC';
      ctx.beginPath(); ctx.arc(-4, -4, it.r * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (it.bad) {
      ctx.shadowBlur = 8; ctx.shadowColor = '#555';
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.moveTo(0, -it.r); ctx.lineTo(it.r, it.r); ctx.lineTo(-it.r, it.r);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.shadowBlur = 10; ctx.shadowColor = it.color;
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(-it.r * 0.3, -it.r * 0.3, it.r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#1a0020'); bg.addColorStop(1, '#000510');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FF6B9D'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#FF6B9D'; ctx.fillText('CANDY RAIN', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Catch the candies!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    items.forEach(drawCandy);
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    var bx = bucket.x - bucket.w / 2;
    ctx.strokeStyle = '#FF6B9D'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,107,157,0.12)';
    ctx.beginPath(); ctx.moveTo(bx, bucket.y); ctx.lineTo(bx + bucket.w, bucket.y);
    ctx.lineTo(bx + bucket.w - 6, bucket.y + bucket.h); ctx.lineTo(bx + 6, bucket.y + bucket.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0; ctx.fillStyle = '#FF6B9D'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui'; ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FF6B9D'; ctx.font = 'bold 30px system-ui';
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
