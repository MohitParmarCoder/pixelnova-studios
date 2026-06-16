'use strict';
var EggDrop = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, eggs, chickens, particles, timer, spawnInterval, speed;
  var basket = { x: 195, w: 70, h: 24, y: VH - 80 };
  var dragX = null;

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; eggs = []; particles = [];
    chickens = [
      { x: 60, y: 60, dir: 1, spd: 55 },
      { x: 250, y: 100, dir: -1, spd: 70 },
    ];
    timer = 0; spawnInterval = 1.8; speed = 160;
    basket.x = VW / 2; dragX = null; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function dropEgg(chicken) {
    var golden = Math.random() < 0.12;
    var broken = Math.random() < 0.08;
    eggs.push({ x: chicken.x, y: chicken.y + 20, vy: speed * (0.8 + Math.random() * 0.4),
      r: golden ? 14 : 11, golden: golden, broken: broken,
      color: golden ? '#FFD700' : (broken ? '#8B0000' : '#FFF8DC'), rotation: 0 });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 20, life: 0.55, maxLife: 0.55, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) basket.x += (dragX - basket.x) * 0.28;
    basket.x = Math.max(basket.w / 2, Math.min(VW - basket.w / 2, basket.x));

    chickens.forEach(function (ch) {
      ch.x += ch.dir * ch.spd * dt;
      if (ch.x > VW - 20) ch.dir = -1;
      if (ch.x < 20) ch.dir = 1;
    });

    timer += dt; speed = 160 + score * 3;
    spawnInterval = Math.max(0.5, 1.8 - score * 0.015);
    if (timer >= spawnInterval) {
      timer = 0;
      var ch = chickens[Math.floor(Math.random() * chickens.length)];
      dropEgg(ch);
      if (score > 20 && chickens.length < 4) {
        chickens.push({ x: Math.random() * VW, y: 80 + Math.random() * 60, dir: Math.random() < 0.5 ? 1 : -1, spd: 55 + Math.random() * 30 });
      }
    }

    for (var i = eggs.length - 1; i >= 0; i--) {
      var eg = eggs[i];
      eg.y += eg.vy * dt; eg.rotation += 1.5 * dt;
      var hit = eg.y > basket.y - 10 && eg.y < basket.y + basket.h &&
          eg.x > basket.x - basket.w / 2 - eg.r && eg.x < basket.x + basket.w / 2 + eg.r;
      if (hit) {
        if (eg.broken) { lives--; addParticles(eg.x, eg.y, '#8B0000'); try { Audio.play('crash'); } catch(e) {} }
        else { score += eg.golden ? 5 : 1; if (score > best) best = score; addParticles(eg.x, eg.y, eg.color); try { Audio.play(eg.golden ? 'power' : 'land'); } catch(e) {} }
        eggs.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (eg.y > VH + 20) {
        if (!eg.broken) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        eggs.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawChicken(ch) {
    ctx.save(); ctx.translate(ch.x, ch.y);
    if (ch.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = '#FF8C42'; ctx.shadowBlur = 8; ctx.shadowColor = '#FF8C42';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B00';
    ctx.beginPath(); ctx.ellipse(16, -10, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.moveTo(24, -10); ctx.lineTo(30, -8); ctx.lineTo(24, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(22, -13, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#001a00'); bg.addColorStop(1, '#0a1a00');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#2d4a00'; ctx.fillRect(0, VH - 50, VW, 50);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 52px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#FFD700'; ctx.fillText('EGG DROP', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Catch the eggs!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    chickens.forEach(drawChicken);

    eggs.forEach(function (eg) {
      ctx.save(); ctx.translate(eg.x, eg.y); ctx.rotate(eg.rotation);
      ctx.fillStyle = eg.color; ctx.shadowBlur = eg.golden ? 16 : 6; ctx.shadowColor = eg.color;
      ctx.beginPath(); ctx.ellipse(0, 0, eg.r * 0.75, eg.r, 0, 0, Math.PI * 2); ctx.fill();
      if (eg.broken) {
        ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.stroke();
      }
      ctx.restore();
    });

    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    var bx = basket.x - basket.w / 2;
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(168,237,234,0.12)';
    ctx.beginPath(); ctx.moveTo(bx, basket.y); ctx.lineTo(bx + basket.w, basket.y);
    ctx.lineTo(bx + basket.w - 6, basket.y + basket.h); ctx.lineTo(bx + 6, basket.y + basket.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44); ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

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
    if (state === 'MENU' || state === 'DEAD') { startGame(); return; }
    dragX = x;
  }
  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
