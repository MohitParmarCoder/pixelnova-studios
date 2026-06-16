'use strict';
var PotionGrab = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, potions, particles, spawnTimer, spawnInterval, speed;
  var cauldron = { x: 195, w: 72, h: 28, y: 80 };
  var dragX = null;

  var POTIONS = [
    { color: '#FF00FF', pts: 1 }, { color: '#00FFFF', pts: 2 },
    { color: '#00FF88', pts: 3 }, { color: '#FF4466', pts: -1, bad: true },
  ];

  function init(canvas, bestScore) { c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU'; }

  function startGame() {
    score = 0; lives = 3; potions = []; particles = [];
    spawnTimer = 0; spawnInterval = 1.0; speed = 150;
    cauldron.x = VW / 2; dragX = null; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnPotion() {
    var t = POTIONS[Math.floor(Math.random() * POTIONS.length)];
    potions.push({ x: 20 + Math.random() * (VW - 40), y: VH + 20, vy: -speed, r: 14, color: t.color, pts: t.pts, bad: !!t.bad, wobble: Math.random() * Math.PI * 2 });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.6, maxLife: 0.6, color: color });
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (dragX !== null) cauldron.x += (dragX - cauldron.x) * 0.28;
    cauldron.x = Math.max(cauldron.w / 2, Math.min(VW - cauldron.w / 2, cauldron.x));

    spawnTimer += dt; speed = 150 + score * 3;
    spawnInterval = Math.max(0.35, 1.0 - score * 0.01);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnPotion(); }

    for (var i = potions.length - 1; i >= 0; i--) {
      var pt = potions[i];
      pt.y += pt.vy * dt;
      pt.wobble += 2 * dt;
      pt.x += Math.sin(pt.wobble) * 0.6;
      var hit = pt.y < cauldron.y + cauldron.h + 10 && pt.y > cauldron.y - 10 &&
          pt.x > cauldron.x - cauldron.w / 2 - pt.r && pt.x < cauldron.x + cauldron.w / 2 + pt.r;
      if (hit) {
        if (pt.bad) { lives--; addParticles(pt.x, pt.y, '#FF4466'); try { Audio.play('crash'); } catch(e) {} }
        else { score += pt.pts; if (score > best) best = score; addParticles(pt.x, pt.y, pt.color); try { Audio.play('gem'); } catch(e) {} }
        potions.splice(i, 1);
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
      } else if (pt.y < -30) {
        if (!pt.bad) { lives--; try { Audio.play('lose'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
        }
        potions.splice(i, 1);
      }
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(j, 1);
    }
  }

  function drawPotion(pt) {
    ctx.save(); ctx.translate(pt.x, pt.y);
    ctx.fillStyle = pt.color; ctx.shadowBlur = 16; ctx.shadowColor = pt.color;
    // bottle body
    ctx.beginPath();
    ctx.moveTo(-pt.r * 0.7, pt.r); ctx.lineTo(pt.r * 0.7, pt.r);
    ctx.lineTo(pt.r * 0.6, -pt.r * 0.3); ctx.lineTo(pt.r * 0.3, -pt.r * 0.7);
    ctx.lineTo(-pt.r * 0.3, -pt.r * 0.7); ctx.lineTo(-pt.r * 0.6, -pt.r * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(-pt.r * 0.2, -pt.r * 0.2, pt.r * 0.2, pt.r * 0.35, -0.5, 0, Math.PI * 2); ctx.fill();
    // stopper
    ctx.fillStyle = '#888';
    ctx.fillRect(-pt.r * 0.2, -pt.r * 0.95, pt.r * 0.4, pt.r * 0.25);
    ctx.restore();
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#0a001a'); bg.addColorStop(1, '#1a0030');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#CC5DE8'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#CC5DE8'; ctx.fillText('POTION GRAB', VW / 2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Catch potions, avoid poison!', VW / 2, 340); ctx.fillText('TAP TO PLAY', VW / 2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui'; ctx.fillText('BEST: ' + best, VW / 2, 460);
      return;
    }

    potions.forEach(drawPotion);
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // cauldron
    var cx2 = cauldron.x, cy2 = cauldron.y;
    ctx.strokeStyle = '#CC5DE8'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(100,0,160,0.3)';
    ctx.beginPath(); ctx.ellipse(cx2, cy2 + cauldron.h / 2, cauldron.w / 2, cauldron.h / 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, cauldron.w / 2, 10, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.shadowBlur = 0; ctx.fillStyle = '#CC5DE8'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, VH - 30);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui'; ctx.fillText('♥ '.repeat(lives), VW - 16, VH - 30);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW / 2, 350);
      ctx.shadowBlur = 0; ctx.fillStyle = '#CC5DE8'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 420); ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 465); ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 535);
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
