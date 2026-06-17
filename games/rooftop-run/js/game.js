'use strict';

var RooftopRun = (function () {

  // ─── Constants ───────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  var GRAVITY        = 2200;   // px/s²
  var JUMP_VEL       = -680;   // px/s  (negative = up)
  var BASE_SPEED     = 220;    // px/s
  var SPEED_INC      = 12;     // px/s per score point
  var MAX_SPEED      = 620;    // px/s cap

  var PLAYER_W       = 18;
  var PLAYER_H       = 32;

  var BUILDING_MIN_H = 120;    // min height of rooftop from bottom
  var BUILDING_MAX_H = 420;    // max height of rooftop from bottom
  var BUILDING_MIN_W = 90;
  var BUILDING_MAX_W = 160;
  var GAP_MIN        = 80;
  var GAP_MAX        = 145;

  var WINDOW_COLS    = 3;
  var WINDOW_ROWS    = 6;

  var STAR_COUNT     = 80;

  // ─── Module state ────────────────────────────────────────────────────────────
  var canvas, ctx;
  var state;            // 'MENU' | 'PLAYING' | 'DEAD'
  var bestScore;

  // Player
  var px, py, pvy;      // position, vertical velocity
  var onGround;

  // Buildings
  var buildings;        // array of { x, y (rooftop), w, h, windows[] }
  var score;
  var lastScoredBuilding;

  // Scroll speed
  var speed;

  // Stars
  var stars;            // array of { x, y, r }

  // Flash on death
  var deadFlash;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function rnd(min, max) {
    return min + Math.random() * (max - min);
  }

  function rndInt(min, max) {
    return Math.floor(rnd(min, max + 1));
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // ─── Building factory ────────────────────────────────────────────────────────

  function makeWindows(bx, by, bw, bh) {
    var wins = [];
    var cols = WINDOW_COLS;
    var rows = WINDOW_ROWS;
    var padX = 12;
    var padY = 14;
    var cellW = (bw - padX * 2) / cols;
    var cellH = (bh - padY * 2) / rows;
    var ww = clamp(cellW - 8, 6, 18);
    var wh = clamp(cellH - 8, 6, 14);
    var i, j;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < cols; j++) {
        if (Math.random() > 0.35) {
          wins.push({
            x: bx + padX + j * cellW + (cellW - ww) / 2,
            y: by + padY + i * cellH + (cellH - wh) / 2,
            w: ww,
            h: wh,
            lit: Math.random() > 0.3
          });
        }
      }
    }
    return wins;
  }

  function makeBuilding(x, rooftopY) {
    var bh = VH - rooftopY;
    var bw = rnd(BUILDING_MIN_W, BUILDING_MAX_W);
    return {
      x: x,
      y: rooftopY,
      w: bw,
      h: bh,
      windows: makeWindows(x, rooftopY, bw, bh)
    };
  }

  function makeStars() {
    var arr = [];
    var i;
    for (i = 0; i < STAR_COUNT; i++) {
      arr.push({
        x: rnd(0, VW),
        y: rnd(0, VH * 0.65),
        r: rnd(0.5, 2)
      });
    }
    return arr;
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function init(cnv, best) {
    canvas = cnv;
    ctx    = canvas.getContext('2d');
    bestScore = best || 0;
    stars  = makeStars();
    state  = 'MENU';
    resetGame();
  }

  function resetGame() {
    score  = 0;
    speed  = BASE_SPEED;
    deadFlash = 0;
    lastScoredBuilding = -1;

    // First building — wide, mid-height, starting left side
    var firstRooftopY = VH - 260;
    var firstW = 180;
    buildings = [];
    buildings.push({
      x: 0,
      y: firstRooftopY,
      w: firstW,
      h: VH - firstRooftopY,
      windows: makeWindows(0, firstRooftopY, firstW, VH - firstRooftopY)
    });

    // Pre-fill screen with more buildings
    var nx = firstW + rnd(GAP_MIN, GAP_MAX);
    while (nx < VW + 300) {
      var ry = rnd(BUILDING_MIN_H, BUILDING_MAX_H);
      var ry2 = VH - ry;
      var b = makeBuilding(nx, ry2);
      buildings.push(b);
      nx = nx + b.w + rnd(GAP_MIN, GAP_MAX);
    }

    // Player stands on first building's rooftop
    px = 70;
    py = firstRooftopY - PLAYER_H;
    pvy = 0;
    onGround = true;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  function update(dt) {
    if (state !== 'PLAYING') { return; }

    dt = clamp(dt, 0, 0.05);

    // Update speed
    speed = clamp(BASE_SPEED + score * SPEED_INC, BASE_SPEED, MAX_SPEED);

    // Scroll buildings
    var i;
    for (i = 0; i < buildings.length; i++) {
      buildings[i].x -= speed * dt;
      var wi, wlen;
      for (wi = 0, wlen = buildings[i].windows.length; wi < wlen; wi++) {
        buildings[i].windows[wi].x -= speed * dt;
      }
    }

    // Spawn new buildings off right edge
    var last = buildings[buildings.length - 1];
    if (last.x + last.w < VW + 400) {
      var ry = VH - rnd(BUILDING_MIN_H, BUILDING_MAX_H);
      var nb = makeBuilding(last.x + last.w + rnd(GAP_MIN, GAP_MAX), ry);
      buildings.push(nb);
    }

    // Remove buildings fully off-screen left
    while (buildings.length > 1 && buildings[0].x + buildings[0].w < -10) {
      buildings.shift();
      // adjust lastScoredBuilding index since we removed the first
      lastScoredBuilding -= 1;
    }

    // Physics
    pvy += GRAVITY * dt;
    py  += pvy * dt;

    // Landing detection
    onGround = false;
    for (i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var playerLeft  = px;
      var playerRight = px + PLAYER_W;
      var playerBottom = py + PLAYER_H;

      // Check horizontal overlap
      var overlapX = playerRight > b.x + 4 && playerLeft < b.x + b.w - 4;

      if (overlapX && pvy >= 0 && playerBottom >= b.y && playerBottom <= b.y + 30) {
        // Land on rooftop
        py = b.y - PLAYER_H;
        pvy = 0;
        onGround = true;

        // Score: count each new building landing
        if (i > lastScoredBuilding && i > 0) {
          score += (i - Math.max(lastScoredBuilding, 0));
          lastScoredBuilding = i;
          try { Audio.play('gem'); } catch (e) {}
        }
        break;
      }
    }

    // Death: fell below screen
    if (py > VH + 20) {
      killPlayer();
      return;
    }

    // Death: ran into a building wall (clipped left side of a building ahead)
    for (i = 0; i < buildings.length; i++) {
      var b2 = buildings[i];
      if (px + PLAYER_W > b2.x + 5 &&
          px < b2.x + b2.w - 5 &&
          py + PLAYER_H > b2.y + 30 &&
          py < VH) {
        // Player body inside the building bulk (below rooftop) — shouldn't happen with landing check
        // but guard against clipping through side
        if (px + PLAYER_W > b2.x && px + PLAYER_W < b2.x + 20 && py + PLAYER_H > b2.y) {
          killPlayer();
          return;
        }
      }
    }

    // Death: player scrolled off left edge entirely
    if (px + PLAYER_W < 0) {
      killPlayer();
      return;
    }

    // Slowly push player right to maintain character on screen (runner feel)
    // Character x is fixed; buildings scroll toward them
    // But clamp player x to not scroll off screen left
    if (px < 30) { px = 30; }
  }

  function killPlayer() {
    state = 'DEAD';
    deadFlash = 1.0;
    if (score > bestScore) { bestScore = score; }
    try { Audio.play('crash'); } catch (e) {}
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  // ─── Draw ────────────────────────────────────────────────────────────────────

  function drawSky() {
    var grad = ctx.createLinearGradient(0, 0, 0, VH * 0.75);
    grad.addColorStop(0, '#060618');
    grad.addColorStop(1, '#0a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawStars() {
    var i, s;
    ctx.fillStyle = '#ffffff';
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon() {
    ctx.fillStyle = '#fffde7';
    ctx.shadowColor = '#fffde7';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(VW - 60, 70, 28, 0, Math.PI * 2);
    ctx.fill();
    // crescent shadow
    ctx.fillStyle = '#08082a';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(VW - 50, 64, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBuildings() {
    var i, b, wi, w;
    for (i = 0; i < buildings.length; i++) {
      b = buildings[i];

      // Building body
      ctx.fillStyle = '#1a1a3a';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Rooftop edge highlight
      ctx.fillStyle = '#2a2a5a';
      ctx.fillRect(b.x, b.y, b.w, 4);

      // Windows
      for (wi = 0; wi < b.windows.length; wi++) {
        w = b.windows[wi];
        if (w.lit) {
          ctx.fillStyle = '#ffe066';
          ctx.shadowColor = '#ffe066';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = '#0d0d28';
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
      ctx.shadowBlur = 0;
    }
  }

  function drawPlayer() {
    var x = px;
    var y = py;

    // Body
    ctx.fillStyle = '#e53935';
    ctx.fillRect(x + 4, y + 10, 10, 14);

    // Head
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(x + 4, y + 2, 10, 10);

    // Eyes
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 4, 2, 2);
    ctx.fillRect(x + 10, y + 4, 2, 2);

    // Legs (animated)
    var legOff = onGround ? 0 : 4;
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x + 4,      y + 24, 4, 8 - legOff);
    ctx.fillRect(x + 10,     y + 24, 4, 8 + legOff);

    // Feet
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 3,  y + 32 - legOff, 5, 3);
    ctx.fillRect(x + 10, y + 32 + legOff, 5, 3);

    // Scarf / cape
    ctx.fillStyle = '#fff176';
    ctx.fillRect(x + 12, y + 11, 5, 8);
  }

  function drawHUD() {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score, VW / 2, 52);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText('BEST ' + bestScore, VW / 2, 72);
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    drawSky();
    drawStars();
    drawMoon();
    drawBuildings();
    drawPlayer();

    // Title panel
    ctx.fillStyle = 'rgba(6,6,24,0.78)';
    ctx.fillRect(30, VH / 2 - 130, VW - 60, 240);

    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROOFTOP', VW / 2, VH / 2 - 72);
    ctx.fillText('RUNNER', VW / 2, VH / 2 - 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 28);

    if (bestScore > 0) {
      ctx.fillStyle = '#aaaacc';
      ctx.font = '14px monospace';
      ctx.fillText('BEST  ' + bestScore, VW / 2, VH / 2 + 60);
    }

    ctx.textAlign = 'left';
  }

  function drawDead() {
    drawSky();
    drawStars();
    drawMoon();
    drawBuildings();
    drawPlayer();

    // Flash effect on death
    if (deadFlash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (deadFlash * 0.45) + ')';
      ctx.fillRect(0, 0, VW, VH);
      deadFlash -= 0.04;
      if (deadFlash < 0) { deadFlash = 0; }
    }

    // Overlay panel
    ctx.fillStyle = 'rgba(6,6,24,0.82)';
    ctx.fillRect(30, VH / 2 - 150, VW - 60, 280);

    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(score, VW / 2, VH / 2 - 20);

    ctx.fillStyle = '#ffe066';
    ctx.font = '16px monospace';
    ctx.fillText('BEST  ' + bestScore, VW / 2, VH / 2 + 22);

    ctx.fillStyle = '#aaaacc';
    ctx.font = '15px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 76);

    ctx.textAlign = 'left';
  }

  function draw() {
    if (!ctx) { return; }

    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    if (state === 'DEAD') {
      drawDead();
      return;
    }

    // PLAYING
    drawSky();
    drawStars();
    drawMoon();
    drawBuildings();
    drawPlayer();
    drawHUD();
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

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

    if (state === 'PLAYING') {
      // Jump (can jump even in air for double-jump feel — or restrict to onGround)
      pvy = JUMP_VEL;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  function getBest() {
    return bestScore;
  }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

}());
