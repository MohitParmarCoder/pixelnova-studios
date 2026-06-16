'use strict';
var LeafFall = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, items, particles, spawnTimer, spawnInterval, speed, wind, windTimer;
  var basket = { x: 195, w: 72, h: 24, y: VH - 80 };
  var dragX = null;
  var LEAF_COLORS = ['#E8A838', '#D4522A', '#C13B1B', '#E8C85A', '#8B4513'];

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; items = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.8; speed = 140; wind = 0; windTimer = 3;
    basket.x = VW / 2; dragX = null; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnItem() {
    var isThorn = Math.random() < 0.14 + score * 0.003;
    var isAcorn = Math.random() < 0.1;
    items.push({
      x: 20 + Math.random() * (VW - 40), y: -20,
      r: 13 + Math.random() * 5, vx: wind * 0.5,
      thorn: isThorn, acorn: !isThorn && isAcorn,
      color: isThorn ? '#4a4a00' : (isAcorn ? '#8B4513' : LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]),
      rot: Math.random() * Math.PI, rotSpd: (Math.random() - 0.5) * 3
    });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * 60 + wind * 20, vy: Math.sin(a) * 60, life: 0.55, maxLife: 0.55, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) basket.x += (dragX - basket.x) * 0.28;
    basket.x = Math.max(basket.w / 2, Math.min(VW - basket.w / 2, basket.x));

    windTimer -= dt;
    if (windTimer <= 0) { wind = (Math.random() - 0.5) * 80; windTimer = 3 + Math.random() * 2; }

    spawnTimer += dt; speed = 140 + score * 2.5;
    spawnInterval = Math.max(0.35, 0.8 - score * 0.008);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnItem(); }

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.y += speed * dt; it.x += (it.vx + wind * 0.3) * dt; it.rot += it.rotSpd * dt;
      var hit = it.y > basket.y - 10 && it.y < basket.y + basket.h &&
          it.x > basket.x - basket.w / 2 - it.r && it.x < basket.x + basket.w / 2 + it.r;
      if (hit) {
        if (it.thorn) { lives--; addParticles(it.x, it.y, '#888'); try { Audio.play('crash'); } catch(e) {} }
        else { score += it.acorn ? 3 : 1; if (score > best) best = score; addParticles(it.x, it.y, it.color); try { Audio.play(it.acorn ? 'gem' : 'land'); } catch(e) {} }
        items.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (it.y > VH + 20 || it.x < -40 || it.x > VW + 40) {
        if (!it.thorn) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        items.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawLeaf(it) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
    if (it.thorn) {
      ctx.fillStyle = '#4a4a00'; ctx.shadowBlur = 6; ctx.shadowColor = '#888';
      ctx.beginPath(); ctx.moveTo(0, -it.r); ctx.lineTo(it.r * 0.4, it.r); ctx.lineTo(-it.r * 0.4, it.r); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (it.acorn) {
      ctx.fillStyle = '#8B4513'; ctx.shadowBlur = 8; ctx.shadowColor = '#FFD700';
      ctx.beginPath(); ctx.ellipse(0, 2, it.r * 0.6, it.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5C2E00';
      ctx.beginPath(); ctx.ellipse(0, -it.r * 0.3, it.r * 0.7, it.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = it.color; ctx.shadowBlur = 8; ctx.shadowColor = it.color;
      ctx.beginPath(); ctx.ellipse(0, 0, it.r * 0.5, it.r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,200,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -it.r); ctx.lineTo(0, it.r); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#0f0800'); bg.addColorStop(1, '#1a0a00');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#E8A838'; ctx.font = 'bold 52px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#E8A838'; ctx.fillText('LEAF FALL', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '19px system-ui';
      ctx.fillText('Collect leaves, avoid thorns!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    // wind indicator
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Wind: ' + (wind > 10 ? '>>>' : wind < -10 ? '<<<' : '--'), VW / 2, 65);

    items.forEach(drawLeaf);
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    var bx = basket.x - basket.w / 2;
    ctx.strokeStyle = '#E8A838'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(232,168,56,0.12)';
    ctx.beginPath(); ctx.moveTo(bx, basket.y); ctx.lineTo(bx + basket.w, basket.y);
    ctx.lineTo(bx + basket.w - 6, basket.y + basket.h); ctx.lineTo(bx + 6, basket.y + basket.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0; ctx.fillStyle = '#E8A838'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44); ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    ctx.fillText('♥ '.repeat(lives), VW - 16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#E8A838'; ctx.font = 'bold 30px system-ui';
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
