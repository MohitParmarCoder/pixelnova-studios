'use strict';
var ChainBlast = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score, best, lives;
  var VW = 390, VH = 844;

  var bubbles;
  var spawnTimer, spawnInterval;
  var particles;
  var chainAnim; // array of chain highlight frames

  var BUBBLE_R = 22;
  var COLORS = ['#ff4444', '#44ff44', '#4488ff', '#ffff44', '#ff44ff'];
  var COLOR_NAMES = ['red', 'green', 'blue', 'yellow', 'purple'];
  var MAX_BUBBLES = 25;

  // Track solo-shot strikes per bubble
  // soloStrikes: map from bubble id to count

  var nextId;

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    lives = 3;
    bubbles = [];
    particles = [];
    chainAnim = [];
    spawnInterval = 1.8;
    spawnTimer = 0;
    nextId = 0;
    // Seed some initial bubbles
    for (var i = 0; i < 8; i++) {
      spawnBubble();
    }
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function randColor() {
    return Math.floor(Math.random() * COLORS.length);
  }

  function spawnBubble() {
    if (bubbles.length >= MAX_BUBBLES) return;
    var tries = 0;
    var x, y, ok;
    do {
      ok = true;
      x = BUBBLE_R + 10 + Math.random() * (VW - (BUBBLE_R + 10) * 2);
      y = 100 + Math.random() * (VH - 200);
      for (var i = 0; i < bubbles.length; i++) {
        var dx = x - bubbles[i].x;
        var dy = y - bubbles[i].y;
        if (dx * dx + dy * dy < (BUBBLE_R * 2.5) * (BUBBLE_R * 2.5)) {
          ok = false;
          break;
        }
      }
      tries++;
    } while (!ok && tries < 30);

    if (!ok) return;

    var colorIdx = randColor();
    bubbles.push({
      id: nextId++,
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      color: colorIdx,
      r: BUBBLE_R,
      soloStrikes: 0,
      blasting: false,
      blastTimer: 0
    });
  }

  function addParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var angle = (Math.PI * 2 / 10) * i + Math.random() * 0.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (80 + Math.random() * 80),
        vy: Math.sin(angle) * (80 + Math.random() * 80),
        life: 0.6,
        maxLife: 0.6,
        r: 5 + Math.random() * 5,
        color: color
      });
    }
  }

  function findChain(startIdx, colorIdx, visited) {
    if (visited[startIdx]) return [];
    visited[startIdx] = true;
    var chain = [startIdx];
    var bx = bubbles[startIdx].x;
    var by = bubbles[startIdx].y;
    for (var i = 0; i < bubbles.length; i++) {
      if (i === startIdx || visited[i]) continue;
      if (bubbles[i].color !== colorIdx || bubbles[i].blasting) continue;
      var dx = bubbles[i].x - bx;
      var dy = bubbles[i].y - by;
      if (dx * dx + dy * dy < (BUBBLE_R * 3) * (BUBBLE_R * 3)) {
        var sub = findChain(i, colorIdx, visited);
        for (var j = 0; j < sub.length; j++) {
          chain.push(sub[j]);
        }
      }
    }
    return chain;
  }

  function blastBubbles(indices) {
    for (var i = 0; i < indices.length; i++) {
      var b = bubbles[indices[i]];
      b.blasting = true;
      b.blastTimer = 0;
      addParticles(b.x, b.y, COLORS[b.color]);
    }
    var pts = indices.length;
    score += pts;
    if (score > best) best = score;
    try { Audio.play('gem'); } catch (e) {}
    // Chain anim
    chainAnim.push({ count: pts, timer: 1.2, x: VW / 2, y: VH / 2 - 50 });
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnBubble();
      spawnTimer = spawnInterval;
    }

    // Update bubbles
    var toRemove = [];
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];

      if (b.blasting) {
        b.blastTimer += dt;
        if (b.blastTimer > 0.35) {
          toRemove.push(i);
        }
        continue;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Bounce off walls
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > VW) { b.x = VW - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 80) { b.y = 80 + b.r; b.vy = Math.abs(b.vy); }
      if (b.y + b.r > VH - 40) { b.y = VH - 40 - b.r; b.vy = -Math.abs(b.vy); }

      // Bubble-bubble repulsion
      for (var j = i + 1; j < bubbles.length; j++) {
        var b2 = bubbles[j];
        if (b2.blasting) continue;
        var dx = b2.x - b.x;
        var dy = b2.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = b.r + b2.r;
        if (dist < minDist && dist > 0) {
          var nx = dx / dist;
          var ny = dy / dist;
          var overlap = minDist - dist;
          b.x -= nx * overlap * 0.5;
          b.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;
          var rv = (b.vx - b2.vx) * nx + (b.vy - b2.vy) * ny;
          b.vx -= rv * nx * 0.5;
          b.vy -= rv * ny * 0.5;
          b2.vx += rv * nx * 0.5;
          b2.vy += rv * ny * 0.5;
        }
      }
    }

    for (var r = toRemove.length - 1; r >= 0; r--) {
      bubbles.splice(toRemove[r], 1);
    }

    // Particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    // Chain anim
    for (var ca = chainAnim.length - 1; ca >= 0; ca--) {
      chainAnim[ca].timer -= dt;
      if (chainAnim[ca].timer <= 0) chainAnim.splice(ca, 1);
    }
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    var hitIdx = -1;
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      if (b.blasting) continue;
      var dx = x - b.x;
      var dy = y - b.y;
      if (dx * dx + dy * dy < b.r * b.r) {
        hitIdx = i;
        break;
      }
    }

    if (hitIdx < 0) {
      try { Audio.play('tap'); } catch (e) {}
      return;
    }

    var b = bubbles[hitIdx];
    var colorIdx = b.color;
    var visited = {};
    var chain = findChain(hitIdx, colorIdx, visited);

    if (chain.length >= 2) {
      blastBubbles(chain);
    } else {
      // Solo shot
      b.soloStrikes++;
      try { Audio.play('tap'); } catch (e) {}
      if (b.soloStrikes >= 3) {
        lives--;
        try { Audio.play('lose'); } catch (e) {}
        b.soloStrikes = 0;
        chainAnim.push({ count: -1, timer: 1.0, x: b.x, y: b.y - 40 });
        if (lives <= 0) {
          endGame();
          return;
        }
      }
    }
  }

  function drawBubble(b) {
    var r = b.r;
    var alpha = 1;
    var scale = 1;

    if (b.blasting) {
      var p = b.blastTimer / 0.35;
      alpha = 1 - p;
      scale = 1 + p * 0.8;
    }

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Bubble body
    var grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    var c = COLORS[b.color];
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, c);
    grad.addColorStop(1, c.replace('ff', '88').replace('44', '22'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Bubble outline
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.25, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Strike marks
    if (b.soloStrikes > 0 && !b.blasting) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      for (var s = 0; s < b.soloStrikes; s++) {
        var sx = (s - 1) * 8;
        ctx.beginPath();
        ctx.moveTo(sx - 4, -4);
        ctx.lineTo(sx + 4, 4);
        ctx.moveTo(sx + 4, -4);
        ctx.lineTo(sx - 4, 4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw() {
    // Background
    ctx.fillStyle = '#0d0820';
    ctx.fillRect(0, 0, VW, VH);

    // Background glow dots
    ctx.fillStyle = 'rgba(80,0,180,0.15)';
    for (var g = 0; g < 5; g++) {
      ctx.beginPath();
      ctx.arc(80 + g * 70, 400, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === 'MENU') { drawMenu(); return; }

    // Particles
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Bubbles
    for (var i = 0; i < bubbles.length; i++) {
      drawBubble(bubbles[i]);
    }

    // Chain anim labels
    for (var ca = 0; ca < chainAnim.length; ca++) {
      var c = chainAnim[ca];
      var alpha = Math.min(1, c.timer * 2);
      ctx.globalAlpha = alpha;
      if (c.count > 0) {
        ctx.fillStyle = '#ffff44';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+' + c.count + ' CHAIN!', c.x, c.y - (1 - c.timer / 1.2) * 40);
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('-1 LIFE', c.x, c.y - (1 - c.timer) * 40);
      }
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 40);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 40);

    ctx.fillStyle = '#ff4444';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'right';
    var heartsStr = '';
    for (var h = 0; h < 3; h++) {
      heartsStr += h < lives ? '♥ ' : '♡ ';
    }
    ctx.fillText(heartsStr, VW - 16, 40);

    ctx.fillStyle = '#888888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap same-color clusters to chain blast!', VW / 2, VH - 20);

    if (state === 'DEAD') drawDead();
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, VH);

    // Draw some example bubbles
    var menuBubbles = [
      { x: 80, y: 300, color: 0, r: BUBBLE_R },
      { x: 160, y: 280, color: 1, r: BUBBLE_R },
      { x: 240, y: 310, color: 2, r: BUBBLE_R },
      { x: 310, y: 290, color: 3, r: BUBBLE_R }
    ];
    for (var i = 0; i < menuBubbles.length; i++) {
      var mb = menuBubbles[i];
      mb.blasting = false;
      mb.soloStrikes = 0;
      drawBubble(mb);
    }

    ctx.fillStyle = '#ff44ff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHAIN', VW / 2, 380);
    ctx.fillText('BLAST', VW / 2, 438);

    ctx.fillStyle = '#ddaaff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Tap clusters of same color!', VW / 2, 490);

    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 560);

    if (best > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Best: ' + best, VW / 2, 610);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ff44ff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VW / 2, 340);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 400);

    ctx.fillStyle = '#ffff44';
    ctx.font = '24px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 440);

    ctx.fillStyle = '#ff44ff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 520);
  }

  function getBest() { return best; }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
}());
