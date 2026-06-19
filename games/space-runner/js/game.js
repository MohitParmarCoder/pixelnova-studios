'use strict';
var SpaceRunner = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';

  // Game state
  var score, lives, wave;
  var ship;
  var aliens, alienDir, alienSpeed;
  var playerBullets, alienBullets;
  var shootTimer, shootInterval;
  var alienShootTimer, alienShootInterval;
  var stars;
  var particles;

  var ALIEN_COLS = 5;
  var ALIEN_ROWS = 3;
  var ALIEN_W = 40;
  var ALIEN_H = 30;
  var ALIEN_GAP_X = 18;
  var ALIEN_GAP_Y = 16;
  var ALIEN_START_Y = 80;
  var ALIEN_STEP_DOWN = 30;
  var ALIEN_EDGE_LEFT = 20;
  var ALIEN_EDGE_RIGHT = VW - 20;

  function init(canvas, bestScore) {
    c = canvas;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    stars = [];
    for (var i = 0; i < 20; i++) {
      stars.push({ x: Math.random() * VW, y: Math.random() * VH, r: Math.random() * 1.5 + 0.5 });
    }
  }

  function spawnAlienGrid() {
    aliens = [];
    var baseX = ALIEN_EDGE_LEFT + 10;
    var baseY = ALIEN_START_Y;
    for (var row = 0; row < ALIEN_ROWS; row++) {
      for (var col = 0; col < ALIEN_COLS; col++) {
        aliens.push({
          x: baseX + col * (ALIEN_W + ALIEN_GAP_X),
          y: baseY + row * (ALIEN_H + ALIEN_GAP_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          alive: true,
          row: row,
          col: col
        });
      }
    }
    alienDir = 1;
  }

  function startGame() {
    score = 0;
    lives = 3;
    wave = 1;
    playerBullets = [];
    alienBullets = [];
    particles = [];
    ship = { x: VW / 2, y: VH - 80 };
    shootTimer = 0;
    shootInterval = 0.8;
    alienShootTimer = 0;
    alienShootInterval = 1.8;
    alienSpeed = 80;
    spawnAlienGrid();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function addParticle(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * (60 + Math.random() * 80),
        vy: Math.sin(a) * (60 + Math.random() * 80),
        life: 0.45, maxLife: 0.45, color: color
      });
    }
  }

  function loseLife() {
    lives--;
    try { Audio.play('crash'); } catch(e) {}
    addParticle(ship.x, ship.y, '#f87171');
    if (lives <= 0) {
      lives = 0;
      if (score > best) best = score;
      state = 'DEAD';
      try { Audio.play('lose'); } catch(e) {}
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    }
  }

  function nextWave() {
    wave++;
    alienSpeed = 80 * Math.pow(1.1, wave - 1);
    alienShootInterval = Math.max(0.6, 1.8 - wave * 0.1);
    shootInterval = Math.max(0.3, 0.8 - wave * 0.04);
    playerBullets = [];
    alienBullets = [];
    spawnAlienGrid();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    // Update particles
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pp = particles[pi];
      pp.x += pp.vx * dt;
      pp.y += pp.vy * dt;
      pp.life -= dt;
      if (pp.life <= 0) particles.splice(pi, 1);
    }

    // Player auto-shoot
    shootTimer -= dt;
    if (shootTimer <= 0) {
      shootTimer = shootInterval;
      playerBullets.push({ x: ship.x, y: ship.y - 20, vy: -500 });
    }

    // Move player bullets and check alien collisions
    for (var bi = playerBullets.length - 1; bi >= 0; bi--) {
      var bul = playerBullets[bi];
      bul.y += bul.vy * dt;
      if (bul.y < -10) { playerBullets.splice(bi, 1); continue; }

      var hit = false;
      for (var ai = aliens.length - 1; ai >= 0; ai--) {
        var al = aliens[ai];
        if (!al.alive) continue;
        if (bul.x >= al.x && bul.x <= al.x + al.w && bul.y >= al.y && bul.y <= al.y + al.h) {
          al.alive = false;
          score += 10 * wave;
          if (score > best) best = score;
          try { Audio.play('gem'); } catch(e) {}
          addParticle(al.x + al.w / 2, al.y + al.h / 2, '#60a5fa');
          playerBullets.splice(bi, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // Count living aliens
    var livingAliens = [];
    for (var li = 0; li < aliens.length; li++) {
      if (aliens[li].alive) livingAliens.push(aliens[li]);
    }

    if (livingAliens.length === 0) {
      nextWave();
      return;
    }

    // Move alien grid: find leftmost/rightmost
    var leftmost = VW, rightmost = 0;
    for (var ci = 0; ci < livingAliens.length; ci++) {
      if (livingAliens[ci].x < leftmost) leftmost = livingAliens[ci].x;
      if (livingAliens[ci].x + livingAliens[ci].w > rightmost) rightmost = livingAliens[ci].x + livingAliens[ci].w;
    }

    var willHitEdge = false;
    if (alienDir === 1 && rightmost + alienSpeed * dt >= ALIEN_EDGE_RIGHT) willHitEdge = true;
    if (alienDir === -1 && leftmost - alienSpeed * dt <= ALIEN_EDGE_LEFT) willHitEdge = true;

    if (willHitEdge) {
      for (var di = 0; di < aliens.length; di++) {
        aliens[di].y += ALIEN_STEP_DOWN;
      }
      alienDir *= -1;
    } else {
      for (var mi = 0; mi < aliens.length; mi++) {
        aliens[mi].x += alienDir * alienSpeed * dt;
      }
    }

    // Check if aliens reached player area
    for (var ri = 0; ri < livingAliens.length; ri++) {
      if (livingAliens[ri].y + livingAliens[ri].h > VH - 100) {
        lives = 0;
        if (score > best) best = score;
        state = 'DEAD';
        try { Audio.play('lose'); } catch(e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        return;
      }
    }

    // Alien shooting
    alienShootTimer -= dt;
    if (alienShootTimer <= 0) {
      alienShootTimer = alienShootInterval * (0.7 + Math.random() * 0.6);
      if (livingAliens.length > 0) {
        var shooter = livingAliens[Math.floor(Math.random() * livingAliens.length)];
        alienBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, vy: 200 });
      }
    }

    // Move alien bullets and check player collision
    for (var abi = alienBullets.length - 1; abi >= 0; abi--) {
      var ab = alienBullets[abi];
      ab.y += ab.vy * dt;
      if (ab.y > VH + 10) { alienBullets.splice(abi, 1); continue; }
      if (Math.abs(ab.x - ship.x) < 20 && Math.abs(ab.y - ship.y) < 20) {
        alienBullets.splice(abi, 1);
        loseLife();
        if (state === 'DEAD') return;
      }
    }
  }

  function drawAlien(al) {
    var x = al.x, y = al.y, w = al.w, h = al.h;
    ctx.fillStyle = '#86efac';
    ctx.fillRect(x + 4, y + 8, w - 8, h - 8);
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 8, (w - 8) / 2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 6, y + 4);
    ctx.lineTo(x + w / 2 - 10, y - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 6, y + 4);
    ctx.lineTo(x + w / 2 + 10, y - 6);
    ctx.stroke();
    ctx.fillStyle = '#04050e';
    ctx.beginPath(); ctx.arc(x + w / 2 - 5, y + 7, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w / 2 + 5, y + 7, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.fillStyle = '#a8edea';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#a8edea';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-16, 14);
    ctx.lineTo(0, 6);
    ctx.lineTo(16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f87171';
    ctx.shadowColor = '#f87171';
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(0, 24);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    for (var si = 0; si < stars.length; si++) {
      var s = stars[si];
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === 'MENU') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 40px system-ui';
      ctx.fillStyle = '#60a5fa';
      ctx.shadowBlur = 28;
      ctx.shadowColor = '#60a5fa';
      ctx.fillText('SPACE RUNNER', VW / 2, 290);
      ctx.shadowBlur = 0;
      ctx.font = '20px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Tap left/right to move', VW / 2, 366);
      ctx.fillText('Destroy all aliens!', VW / 2, 398);
      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#86efac';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#86efac';
      ctx.fillText('TAP TO PLAY', VW / 2, 472);
      ctx.shadowBlur = 0;
      ctx.font = '18px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 530);
      ctx.textAlign = 'left';
      return;
    }

    // Draw aliens
    for (var ai = 0; ai < aliens.length; ai++) {
      if (aliens[ai].alive) drawAlien(aliens[ai]);
    }

    // Draw player bullets
    for (var bi = 0; bi < playerBullets.length; bi++) {
      var bul = playerBullets[bi];
      ctx.fillStyle = '#fde68a';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fde68a';
      ctx.fillRect(bul.x - 2, bul.y - 10, 4, 12);
      ctx.shadowBlur = 0;
    }

    // Draw alien bullets
    for (var abi = 0; abi < alienBullets.length; abi++) {
      var ab = alienBullets[abi];
      ctx.fillStyle = '#f87171';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#f87171';
      ctx.fillRect(ab.x - 2, ab.y, 4, 12);
      ctx.shadowBlur = 0;
    }

    // Draw particles
    for (var pi = 0; pi < particles.length; pi++) {
      var pp = particles[pi];
      ctx.globalAlpha = pp.life / pp.maxLife;
      ctx.fillStyle = pp.color;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawShip();

    // HUD lives top-left
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    var heartsStr = '';
    for (var hi = 0; hi < 3; hi++) {
      heartsStr += (hi < lives) ? '♥' : '♡';
    }
    ctx.fillText(heartsStr, 14, 44);

    // Score top-right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui';
    ctx.fillText(score, VW - 14, 44);

    // Wave center-top
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('WAVE ' + wave, VW / 2, 44);
    ctx.textAlign = 'left';

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px system-ui';
      ctx.fillStyle = '#f87171';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 300);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(score, VW / 2, 375);
      ctx.font = '22px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 428);
      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TAP TO RETRY', VW / 2, 510);
      ctx.textAlign = 'left';
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'DEAD') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'PLAYING') {
      // Move ship: set x to tap x, clamped 30 to VW-30
      var newX = x;
      if (newX < 30) newX = 30;
      if (newX > VW - 30) newX = VW - 30;
      ship.x = newX;
      try { Audio.play('tap'); } catch(e) {}
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
