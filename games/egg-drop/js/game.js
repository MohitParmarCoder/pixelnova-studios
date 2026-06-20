'use strict';
var EggDrop = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, items, particles, spawnTimer, spawnInterval, speed;
  var pan, dragX;
  var recipe, recipeIdx, recipeBonus;
  var RECIPES = [
    ['egg', 'tomato', 'cheese'],
    ['tomato', 'egg', 'tomato'],
    ['cheese', 'egg', 'cheese'],
    ['egg', 'egg', 'tomato']
  ];
  var ITEM_TYPES = [
    { type: 'egg',    color: '#ffd700', pts: 1, rotten: false, shape: 'circle', size: 16 },
    { type: 'tomato', color: '#ff6b6b', pts: 1, rotten: false, shape: 'circle', size: 16 },
    { type: 'cheese', color: '#ff9f43', pts: 1, rotten: false, shape: 'square', size: 18 },
    { type: 'rotten', color: '#333333', pts: 0, rotten: true,  shape: 'circle', size: 15 }
  ];

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function pickRecipe() {
    recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    recipeIdx = 0; recipeBonus = 0;
  }

  function startGame() {
    score = 0; lives = 3; items = []; particles = [];
    spawnTimer = 0; spawnInterval = 1.0; speed = 180;
    pan = { x: VW / 2, w: 70, h: 18, y: VH - 80 };
    dragX = null;
    pickRecipe();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnItem() {
    var t;
    if (Math.random() < 0.22) {
      t = ITEM_TYPES[3];
    } else {
      t = ITEM_TYPES[Math.floor(Math.random() * 3)];
    }
    items.push({
      x: 24 + Math.random() * (VW - 48),
      y: -24,
      size: t.size,
      color: t.color,
      type: t.type,
      pts: t.pts,
      rotten: t.rotten,
      shape: t.shape
    });
  }

  function addParticles(x, y, color) {
    var i, a;
    for (i = 0; i < 8; i++) {
      a = (i / 8) * Math.PI * 2;
      particles.push({ x: x, y: y,
        vx: Math.cos(a) * (50 + Math.random() * 60),
        vy: Math.sin(a) * (50 + Math.random() * 60),
        life: 0.5, maxLife: 0.5, color: color });
    }
  }

  function die() {
    state = 'DEAD';
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'eggdrop_best'); } catch(e) {}
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    var i, it;
    spawnTimer += dt;
    speed = 180 + score * 3;
    spawnInterval = Math.max(0.45, 1.0 - score * 0.008);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnItem(); }

    for (i = items.length - 1; i >= 0; i--) {
      it = items[i];
      it.y += speed * dt;
      var panLeft = pan.x - pan.w / 2 - it.size;
      var panRight = pan.x + pan.w / 2 + it.size;
      if (it.y > pan.y - 10 && it.y < pan.y + pan.h && it.x > panLeft && it.x < panRight) {
        if (it.rotten) {
          lives--;
          addParticles(it.x, it.y, '#333');
          try { Audio.play('crash'); } catch(e) {}
          items.splice(i, 1);
          if (lives <= 0) { lives = 0; die(); return; }
        } else {
          score += it.pts;
          if (score > best) best = score;
          addParticles(it.x, it.y, it.color);
          try { Audio.play('gem'); } catch(e) {}
          if (it.type === recipe[recipeIdx]) {
            recipeIdx++;
            recipeBonus++;
            if (recipeIdx >= recipe.length) {
              score += 3;
              try { Audio.play('gem'); } catch(e) {}
              pickRecipe();
            }
          } else {
            recipeIdx = 0;
          }
          items.splice(i, 1);
        }
      } else if (it.y > VH + it.size + 20) {
        items.splice(i, 1);
      }
    }

    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (dragX !== null) pan.x += (dragX - pan.x) * 0.3;
    pan.x = Math.max(pan.w / 2, Math.min(VW - pan.w / 2, pan.x));
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1a0a00'); g.addColorStop(1, '#2a1500');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawPan() {
    var bx = pan.x - pan.w / 2, by = pan.y;
    ctx.save();
    ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(192,192,192,0.3)';
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + pan.w, by);
    ctx.lineTo(bx + pan.w - 6, by + pan.h);
    ctx.lineTo(bx + 6, by + pan.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + pan.w, by + pan.h / 2);
    ctx.lineTo(bx + pan.w + 28, by + pan.h / 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawItem(it) {
    ctx.save();
    ctx.fillStyle = it.color;
    ctx.shadowBlur = 10; ctx.shadowColor = it.color;
    if (it.shape === 'square') {
      ctx.fillRect(it.x - it.size, it.y - it.size, it.size * 2, it.size * 2);
    } else {
      ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (it.rotten) {
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(it.x - 6, it.y - 6); ctx.lineTo(it.x + 6, it.y + 6);
      ctx.moveTo(it.x + 6, it.y - 6); ctx.lineTo(it.x - 6, it.y + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    var i, p, a, hearts, h, rx;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#ffd700';
      ctx.fillText('EGG DROP', VW / 2, 280);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('Catch good ingredients!', VW / 2, 350);
      ctx.fillText('Avoid the rotten (black X) ones!', VW / 2, 382);
      ctx.fillStyle = '#ff9f43'; ctx.font = '18px system-ui';
      ctx.fillText('Match recipe order for bonus pts!', VW / 2, 416);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 460);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 520);
      ctx.textAlign = 'left';
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, 130);
    ctx.fillStyle = '#ff9f43'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Recipe:', VW / 2, 24);
    rx = VW / 2 - (recipe.length - 1) * 28;
    for (i = 0; i < recipe.length; i++) {
      var rc = recipe[i];
      var col = rc === 'egg' ? '#ffd700' : (rc === 'tomato' ? '#ff6b6b' : '#ff9f43');
      ctx.fillStyle = i < recipeIdx ? 'rgba(255,255,255,0.3)' : col;
      ctx.beginPath(); ctx.arc(rx + i * 56, 54, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = i === recipeIdx ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = i === recipeIdx ? 3 : 1;
      ctx.stroke();
    }
    for (i = 0; i < items.length; i++) drawItem(items[i]);
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      a = p.life / p.maxLife;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPan();
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 118);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, 118);
    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 320);
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffd700'; ctx.font = 'bold 32px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 430);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 500);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state === 'PLAYING') { dragX = x; }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
