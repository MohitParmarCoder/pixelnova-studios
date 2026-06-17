'use strict';
var FruitCatcher = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, fruits, particles, spawnTimer, spawnInterval;
  var lastTapX = -1, lastTapY = -1;
  var GRAVITY = 400;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; fruits = []; particles = [];
    spawnTimer = 0; spawnInterval = 0.6;
    lastTapX = -1; lastTapY = -1;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function spawnFruit() {
    var isBomb = Math.random() < 0.18;
    var color, r, pts;
    if (isBomb) {
      color = '#333'; r = 18; pts = 0;
    } else {
      var roll = Math.floor(Math.random() * 4);
      if (roll === 0) { color = '#ff6b6b'; r = 20; pts = 1; }
      else if (roll === 1) { color = '#ffd700'; r = 18; pts = 1; }
      else if (roll === 2) { color = '#6bcb77'; r = 22; pts = 2; }
      else { color = '#4d96ff'; r = 14; pts = 1; }
    }
    var x = 40 + Math.random() * (VW - 80);
    var vx = (Math.random() - 0.5) * 320;
    var vy = -(500 + Math.random() * 300);
    fruits.push({ x: x, y: VH - 30, vx: vx, vy: vy, r: r, color: color,
      pts: pts, bomb: isBomb, sliced: false, alpha: 1 });
  }

  function addParticles(x, y, color) {
    var i, a;
    for (i = 0; i < 10; i++) {
      a = (i / 10) * Math.PI * 2;
      particles.push({ x: x, y: y,
        vx: Math.cos(a) * (60 + Math.random() * 80),
        vy: Math.sin(a) * (60 + Math.random() * 80),
        life: 0.55, maxLife: 0.55, color: color });
    }
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var lenSq = dx * dx + dy * dy;
    var t, nx, ny, ddx, ddy;
    if (lenSq === 0) {
      ddx = px - ax; ddy = py - ay;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    nx = ax + t * dx - px;
    ny = ay + t * dy - py;
    return Math.sqrt(nx * nx + ny * ny);
  }

  function checkSlice(x, y) {
    if (lastTapX < 0) return;
    var i, f, dist;
    for (i = 0; i < fruits.length; i++) {
      f = fruits[i];
      if (f.sliced) continue;
      dist = distToSegment(f.x, f.y, lastTapX, lastTapY, x, y);
      if (dist < f.r + 8) {
        f.sliced = true;
        addParticles(f.x, f.y, f.color);
        if (f.bomb) {
          lives--;
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { lives = 0; die(); return; }
        } else {
          score += f.pts;
          if (score > best) best = score;
          try { Audio.play('gem'); } catch(e) {}
        }
      }
    }
  }

  function die() {
    state = 'DEAD';
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var i, f, p, offscreen;
    spawnTimer += dt;
    spawnInterval = Math.max(0.3, 0.6 - score * 0.005);
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnFruit(); }

    offscreen = 0;
    for (i = fruits.length - 1; i >= 0; i--) {
      f = fruits[i];
      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.sliced) {
        f.alpha -= dt * 2.5;
        if (f.alpha <= 0) { fruits.splice(i, 1); }
        continue;
      }
      if (f.y > VH + f.r + 20) {
        if (!f.bomb) offscreen++;
        fruits.splice(i, 1);
      }
    }
    if (offscreen > 0) {
      lives -= offscreen;
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) { lives = 0; die(); return; }
    }

    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1a001a'); g.addColorStop(1, '#0d0030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawFruit(f) {
    ctx.save();
    ctx.globalAlpha = f.alpha;
    if (f.bomb) {
      ctx.fillStyle = '#222'; ctx.shadowBlur = 10; ctx.shadowColor = '#f00';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f00'; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(f.x - 7, f.y - 7); ctx.lineTo(f.x + 7, f.y + 7);
      ctx.moveTo(f.x + 7, f.y - 7); ctx.lineTo(f.x - 7, f.y + 7);
      ctx.stroke();
    } else {
      ctx.fillStyle = f.color; ctx.shadowBlur = 14; ctx.shadowColor = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (f.sliced) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x - f.r, f.y); ctx.lineTo(f.x + f.r, f.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    var i, p, a, hearts, h;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 52px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 24; ctx.shadowColor = '#ffd700';
      ctx.fillText('FRUIT NINJA', VW / 2, 300);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '24px system-ui';
      ctx.fillText('SWIPE ACROSS FRUITS!', VW / 2, 370);
      ctx.fillStyle = '#ff6b6b'; ctx.font = '20px system-ui';
      ctx.fillText('Avoid the bombs!', VW / 2, 410);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 460);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 530);
      ctx.textAlign = 'left';
      return;
    }
    for (i = 0; i < fruits.length; i++) drawFruit(fruits[i]);
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      a = p.life / p.maxLife;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, 44);
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
    if (state === 'PLAYING') {
      checkSlice(x, y);
      lastTapX = x;
      lastTapY = y;
    }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
