'use strict';
var FruitCatcher = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, items, particles, spawnTimer, spawnInterval, speed;
  var basket = { x: 195, w: 72, h: 24, y: VH - 80 };
  var dragX = null;

  var FRUITS = [
    { color: '#FF6B6B', pts: 1, r: 14, name: 'apple' },
    { color: '#FFD93D', pts: 2, r: 12, name: 'lemon' },
    { color: '#6BCB77', pts: 3, r: 13, name: 'grape' },
    { color: '#FF922B', pts: 2, r: 11, name: 'orange' },
    { color: '#CC5DE8', pts: 4, r: 10, name: 'plum' },
  ];

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; items = []; particles = [];
    spawnTimer = 0; spawnInterval = 1.0; speed = 170;
    basket.x = VW / 2; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnItem() {
    var isBomb = Math.random() < 0.18 + score * 0.002;
    if (isBomb) {
      items.push({ x: 20 + Math.random() * (VW - 40), y: -20, r: 14, color: '#333', bomb: true, fuse: 0 });
    } else {
      var f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      items.push({ x: 20 + Math.random() * (VW - 40), y: -20, r: f.r, color: f.color, pts: f.pts, bomb: false });
    }
  }

  function addParticles(x, y, color, n) {
    for (var i = 0; i < (n || 8); i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * (40 + Math.random() * 80),
        vy: Math.sin(a) * (40 + Math.random() * 80) - 30, life: 0.7, maxLife: 0.7, color: color, r: 4 + Math.random() * 4 });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) basket.x += (dragX - basket.x) * 0.25;
    basket.x = Math.max(basket.w / 2, Math.min(VW - basket.w / 2, basket.x));

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnItem(); }
    speed = 170 + score * 2;
    spawnInterval = Math.max(0.35, 1.0 - score * 0.008);

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.y += speed * dt;
      if (it.bomb) it.fuse += dt;
      var hit = it.y > basket.y - 10 && it.y < basket.y + basket.h &&
          it.x > basket.x - basket.w / 2 - it.r && it.x < basket.x + basket.w / 2 + it.r;
      if (hit) {
        if (it.bomb) { lives--; addParticles(it.x, it.y, '#FF4500', 12); try { Audio.play('crash'); } catch(e) {} }
        else { score += it.pts; if (score > best) best = score; addParticles(it.x, it.y, it.color, 8); try { Audio.play('gem'); } catch(e) {} }
        items.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (it.y > VH + 30) {
        if (!it.bomb) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        items.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawFruit(it) {
    ctx.save(); ctx.translate(it.x, it.y);
    if (it.bomb) {
      ctx.fillStyle = '#444'; ctx.shadowBlur = 8; ctx.shadowColor = '#FF4500';
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FF4500'; ctx.lineWidth = 2; ctx.stroke();
      // fuse
      ctx.strokeStyle = '#FFD93D'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -it.r); ctx.lineTo(5, -it.r - 8 + it.fuse * 3); ctx.stroke();
    } else {
      ctx.fillStyle = it.color; ctx.shadowBlur = 10; ctx.shadowColor = it.color;
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(-it.r * 0.3, -it.r * 0.3, it.r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0d001a'); g.addColorStop(1, '#001a0d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#6BCB77'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#6BCB77';
      ctx.fillText('FRUIT CATCHER', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Catch fruits, dodge bombs!', VW / 2, 330);
      ctx.fillText('TAP TO PLAY', VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 450);
      return;
    }

    items.forEach(drawFruit);
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // basket
    var bx = basket.x - basket.w / 2;
    ctx.strokeStyle = '#6BCB77'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(107,203,119,0.15)';
    ctx.beginPath(); ctx.moveTo(bx, basket.y); ctx.lineTo(bx + basket.w, basket.y);
    ctx.lineTo(bx + basket.w - 8, basket.y + basket.h); ctx.lineTo(bx + 8, basket.y + basket.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#FFD93D'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.shadowBlur = 0; ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFD93D'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW / 2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW / 2, 495);
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
