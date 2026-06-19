'use strict';

var CloudHop = (function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  var KITE_X    = 100;   // fixed screen x of kite
  var KITE_W    = 28;
  var KITE_H    = 28;
  var CLIMB_ACC = 400;   // vy -= 400*dt when holding
  var FALL_ACC  = 300;   // vy += 300*dt when not holding
  var VY_MIN    = -350;
  var VY_MAX    = 350;
  var DRIFT_VX  = 80;    // world scrolls at this rate (px/s)
  var CEIL_Y    = 60;
  var FLOOR_Y   = VH - 60;
  var MAX_LIVES = 3;

  var STAR_SPAWN_DIST  = 500;
  var BIRD_SPAWN_DIST  = 700;
  var CLOUD_SPAWN_DIST = 300;

  // ── State ──────────────────────────────────────────────────────────────────
  var canvas, ctx;
  var state;       // 'MENU' | 'PLAYING' | 'DEAD'
  var bestScore;

  var kiteY, kiteVy;
  var worldX;
  var isHolding;
  var holdTimer;
  var score;
  var lives;
  var scoreTimer;

  var stars;
  var birds;
  var clouds;

  var nextStarX, nextBirdX, nextCloudX;
  var flashTimer;
  var tailPoints;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function resetGame() {
    kiteY      = VH / 2;
    kiteVy     = 0;
    worldX     = 0;
    isHolding  = false;
    holdTimer  = 0;
    score      = 0;
    lives      = MAX_LIVES;
    scoreTimer = 0;
    flashTimer = 0;
    stars      = [];
    birds      = [];
    clouds     = [];
    tailPoints = [];

    nextStarX  = KITE_X + 300;
    nextBirdX  = KITE_X + 600;
    nextCloudX = 50;

    var i;
    for (i = 0; i < 5; i++) {
      clouds.push({
        wx: 80 + i * 200 + Math.random() * 100,
        y:  80 + Math.random() * (VH - 200),
        w:  80 + Math.random() * 100,
        h:  36 + Math.random() * 20
      });
    }
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function loseLife() {
    lives--;
    flashTimer = 1.2;
    if (lives <= 0) {
      state = 'DEAD';
      if (score > bestScore) { bestScore = score; }
      try { Audio.play('lose'); } catch (e) {}
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
      AdManager.showInterstitial(() => {});
      try { AdManager.offerDoubleScore(score, 'cloudhop_best'); } catch(e) {}
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(cnv, best) {
    canvas    = cnv;
    ctx       = canvas.getContext('2d');
    bestScore = best || 0;
    state     = 'MENU';
    resetGame();
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt) {
    if (state !== 'PLAYING') { return; }
    dt = clamp(dt, 0, 0.05);

    holdTimer = Math.max(0, holdTimer - dt);
    isHolding = holdTimer > 0;

    if (isHolding) {
      kiteVy -= CLIMB_ACC * dt;
    } else {
      kiteVy += FALL_ACC * dt;
    }
    kiteVy  = clamp(kiteVy, VY_MIN, VY_MAX);
    kiteY  += kiteVy * dt;

    worldX += (DRIFT_VX + score * 2) * dt;

    scoreTimer += dt;
    if (scoreTimer >= 1) {
      scoreTimer -= 1;
      score++;
    }

    if (kiteY < CEIL_Y) {
      kiteY  = CEIL_Y;
      kiteVy = Math.abs(kiteVy) * 0.4;
    }

    if (kiteY > FLOOR_Y && flashTimer <= 0) {
      kiteY  = VH / 2;
      kiteVy = -80;
      try { Audio.play('crash'); } catch (e) {}
      loseLife();
      if (state === 'DEAD') { return; }
    }

    if (flashTimer > 0) { flashTimer -= dt; }

    tailPoints.push({ x: KITE_X, y: kiteY });
    if (tailPoints.length > 18) { tailPoints.shift(); }

    // Spawn
    while (nextStarX < worldX + VW + 100) {
      stars.push({
        wx:        nextStarX,
        y:         80 + Math.random() * (VH - 180),
        collected: false
      });
      nextStarX += STAR_SPAWN_DIST * (0.7 + Math.random() * 0.6);
    }
    while (nextBirdX < worldX + VW + 100) {
      birds.push({
        wx:    nextBirdX,
        y:     120 + Math.random() * (VH - 280),
        vy:    (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 60),
        phase: Math.random() * Math.PI * 2
      });
      nextBirdX += BIRD_SPAWN_DIST * (0.8 + Math.random() * 0.4);
    }
    while (nextCloudX < worldX + VW + 200) {
      clouds.push({
        wx: nextCloudX,
        y:  40 + Math.random() * (VH - 200),
        w:  80 + Math.random() * 120,
        h:  30 + Math.random() * 30
      });
      nextCloudX += CLOUD_SPAWN_DIST * (0.8 + Math.random() * 0.4);
    }

    var i, b, s, screenX, dx, dy;

    for (i = 0; i < birds.length; i++) {
      b = birds[i];
      b.y += b.vy * dt;
      b.phase += dt * 3;
      if (b.y < 60)       { b.y = 60;       b.vy = Math.abs(b.vy); }
      if (b.y > VH - 100) { b.y = VH - 100; b.vy = -Math.abs(b.vy); }
    }

    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      if (s.collected) { continue; }
      screenX = s.wx - worldX;
      dx      = screenX - KITE_X;
      dy      = s.y    - kiteY;
      if (dx * dx + dy * dy < 22 * 22) {
        s.collected = true;
        score += 10;
        try { Audio.play('gem'); } catch (e) {}
      }
    }

    if (flashTimer <= 0) {
      for (i = 0; i < birds.length; i++) {
        b       = birds[i];
        screenX = b.wx - worldX;
        dx      = screenX - KITE_X;
        dy      = b.y    - kiteY;
        if (dx * dx + dy * dy < 24 * 24) {
          try { Audio.play('crash'); } catch (e) {}
          loseLife();
          if (state === 'DEAD') { return; }
          break;
        }
      }
    }

    var cullX = worldX - 100;
    for (i = stars.length - 1; i >= 0; i--) {
      if (stars[i].wx < cullX) { stars.splice(i, 1); }
    }
    for (i = birds.length - 1; i >= 0; i--) {
      if (birds[i].wx < cullX) { birds.splice(i, 1); }
    }
    for (i = clouds.length - 1; i >= 0; i--) {
      if (clouds[i].wx + clouds[i].w < cullX) { clouds.splice(i, 1); }
    }
  }

  // ── Tap ────────────────────────────────────────────────────────────────────

  function tap(x, y) {
    if (state === 'MENU') {
      try { Audio.play('tap'); } catch (e) {}
      startGame();
      return;
    }
    if (state === 'DEAD') {
      try { Audio.play('tap'); } catch (e) {}
      startGame();
      return;
    }
    if (state !== 'PLAYING') { return; }
    holdTimer = 0.12;
    try { Audio.play('tap'); } catch (e) {}
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  function drawBg() {
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0,   '#1565c0');
    grad.addColorStop(0.5, '#42a5f5');
    grad.addColorStop(1,   '#b3e5fc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawWindStreaks() {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 1.5;
    var i, sy, len;
    for (i = 0; i < 8; i++) {
      sy  = ((i * 113 + worldX * 0.4) % VH);
      len = 40 + (i * 17) % 60;
      ctx.beginPath();
      ctx.moveTo(KITE_X + 60 + (i * 37) % (VW - 80), sy);
      ctx.lineTo(KITE_X + 60 + (i * 37) % (VW - 80) - len, sy);
      ctx.stroke();
    }
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    var i, c, sx, rx, ry;
    for (i = 0; i < clouds.length; i++) {
      c  = clouds[i];
      sx = c.wx - worldX;
      if (sx > VW + 50 || sx + c.w < -50) { continue; }
      rx = c.w / 2;
      ry = c.h / 2;
      ctx.beginPath();
      ctx.ellipse(sx + rx, c.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + rx * 0.4, c.y + ry * 0.3, rx * 0.65, ry * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + rx * 1.6, c.y + ry * 0.3, rx * 0.65, ry * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBirds() {
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth   = 2.5;
    var i, b, sx, wing;
    for (i = 0; i < birds.length; i++) {
      b   = birds[i];
      sx  = b.wx - worldX;
      if (sx < -40 || sx > VW + 40) { continue; }
      wing = Math.sin(b.phase) * 8;
      ctx.beginPath();
      ctx.moveTo(sx - 14, b.y + wing);
      ctx.lineTo(sx,      b.y);
      ctx.lineTo(sx + 14, b.y + wing);
      ctx.stroke();
    }
  }

  function drawStarsWorld() {
    var i, s, sx;
    ctx.font = '24px monospace';
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      if (s.collected) { continue; }
      sx = s.wx - worldX;
      if (sx < -20 || sx > VW + 20) { continue; }
      ctx.fillStyle   = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur  = 12;
      ctx.textAlign   = 'center';
      ctx.fillText('★', sx, s.y + 8);
      ctx.shadowBlur  = 0;
    }
    ctx.textAlign = 'left';
  }

  function drawKite() {
    var i, t, alpha;
    for (i = 1; i < tailPoints.length; i++) {
      t     = tailPoints[i];
      alpha = (i / tailPoints.length) * 0.5;
      ctx.strokeStyle = 'rgba(230,100,60,' + alpha + ')';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(tailPoints[i - 1].x, tailPoints[i - 1].y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    if (flashTimer > 0 && Math.floor(flashTimer * 8) % 2 === 0) { return; }

    var kx = KITE_X;
    var ky = kiteY;

    ctx.fillStyle   = '#ef5350';
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(kx,               ky - KITE_H / 2);
    ctx.lineTo(kx + KITE_W / 2,  ky);
    ctx.lineTo(kx,               ky + KITE_H / 2);
    ctx.lineTo(kx - KITE_W / 2,  ky);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(kx,               ky - KITE_H / 2);
    ctx.lineTo(kx + KITE_W / 4,  ky - KITE_H / 6);
    ctx.lineTo(kx,               ky - KITE_H / 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(100,80,60,0.7)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(kx,     ky + KITE_H / 2);
    ctx.lineTo(kx - 6, ky + KITE_H / 2 + 20);
    ctx.lineTo(kx + 4, ky + KITE_H / 2 + 38);
    ctx.stroke();

    if (isHolding) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(kx, ky, KITE_W, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHUD() {
    ctx.font      = '26px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff1744';
    var str = '';
    var i;
    for (i = 0; i < MAX_LIVES; i++) {
      str += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(str, 16, 44);

    ctx.font      = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, VW - 16, 44);

    var dist = (worldX / 100) | 0;
    ctx.font      = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(dist + 'm', VW - 16, 64);

    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'center';
    var hint = isHolding ? 'HOLDING' : 'TAP = CLIMB';
    var hw = ctx.measureText(hint).width;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(VW / 2 - hw / 2 - 10, VH - 36, hw + 20, 24);
    ctx.fillStyle = isHolding ? 'rgba(120,255,160,0.95)' : 'rgba(255,255,255,0.9)';
    ctx.fillText(hint, VW / 2, VH - 20);
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    drawBg();
    drawClouds();
    ctx.fillStyle = 'rgba(4,5,14,0.45)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#e3f2fd';
    ctx.font        = 'bold 56px monospace';
    ctx.shadowColor = '#90caf9';
    ctx.shadowBlur  = 20;
    ctx.fillText('KITE', VW / 2, VH / 2 - 70);
    ctx.fillStyle   = '#ef5350';
    ctx.shadowColor = '#ef5350';
    ctx.fillText('FLYER', VW / 2, VH / 2 - 5);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font      = '20px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 65);

    if (bestScore > 0) {
      ctx.fillStyle = '#fff9c4';
      ctx.font      = '16px monospace';
      ctx.fillText('BEST: ' + bestScore, VW / 2, VH / 2 + 100);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(4,5,14,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#ef5350';
    ctx.font        = 'bold 48px monospace';
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur  = 18;
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 56px monospace';
    ctx.fillText(score, VW / 2, VH / 2);

    ctx.fillStyle = '#fff9c4';
    ctx.font      = '22px monospace';
    ctx.fillText('BEST: ' + bestScore, VW / 2, VH / 2 + 52);

    ctx.fillStyle = '#aaaacc';
    ctx.font      = '18px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 110);
    ctx.textAlign = 'left';
  }

  // ── Draw (main) ────────────────────────────────────────────────────────────

  function draw() {
    if (!ctx) { return; }
    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') { drawMenu(); return; }

    drawBg();
    drawWindStreaks();
    drawClouds();
    drawStarsWorld();
    drawBirds();
    drawKite();
    drawHUD();

    if (state === 'DEAD') { drawDead(); }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function getBest() { return bestScore; }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

}());
