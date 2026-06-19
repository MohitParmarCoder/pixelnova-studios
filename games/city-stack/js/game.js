'use strict';

var CityStack = (function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  var ROWS         = 8;
  var COLS         = 3;
  var BLOCK_W      = 90;
  var BLOCK_H      = 28;
  var BLOCK_GAP    = 4;
  var ROW_H        = BLOCK_H + BLOCK_GAP;
  var TOWER_BASE_Y = VH - 230;    // y of bottom row top
  var TOWER_CX     = 195;         // center x of tower
  var MAX_LIVES    = 3;

  // Row colors: bottom = brownish, top = gray
  var ROW_COLORS = [
    '#8d6e63', '#795548', '#6d4c41',
    '#607d8b', '#546e7a', '#455a64',
    '#78909c', '#90a4ae'
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  var canvas, ctx;
  var state;        // 'MENU' | 'PLAYING' | 'DEAD'
  var bestScore;

  var score;
  var lives;
  var pullCount;    // total blocks pulled this game
  var safeLeft;     // guaranteed safe pulls remaining

  // blocks[row][col] = true (present) | false (removed)
  var blocks;

  // Animation
  var wobbleAmt;    // current wobble amplitude
  var wobbleTime;   // accumulated time for wobble oscillation
  var wobbleDecay;
  var crashFlash;   // timer for crash flash before DEAD

  // highlight: which block is "pre-selected" (last tap candidate)
  var highlightRow, highlightCol;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function blockX(col) {
    // Left edge of a block in a given column (0,1,2)
    var totalW = COLS * BLOCK_W + (COLS - 1) * BLOCK_GAP;
    return TOWER_CX - totalW / 2 + col * (BLOCK_W + BLOCK_GAP);
  }

  function blockY(row) {
    // Top edge of block in a given row (0=bottom, 7=top)
    return TOWER_BASE_Y - row * ROW_H;
  }

  function countPresent(row) {
    var n = 0;
    var c;
    for (c = 0; c < COLS; c++) {
      if (blocks[row][c]) { n++; }
    }
    return n;
  }

  function hasAnyTappable() {
    for (var r = 0; r < ROWS - 1; r++) {
      if (countPresent(r) > 0) return true;
    }
    return false;
  }

  function isTappable(row) {
    // Can only pull from rows 0-6 (not the top row 7)
    // and the row must have at least one block
    if (row >= ROWS - 1) { return false; }
    if (countPresent(row) === 0) { return false; }
    return true;
  }

  function stabilityCheck() {
    // First safeLeft pulls always succeed
    if (safeLeft > 0) {
      safeLeft--;
      return 'safe';
    }
    // Probability of collapse grows with pulls, but is capped so the run
    // stays skill-based rather than a coin flip. Ramps slower and tops out
    // well below 1.0 so a careful player can keep going.
    var pCollapse = pullCount * 0.03;
    if (pCollapse > 0.45) { pCollapse = 0.45; }
    var r = Math.random();
    if (r < pCollapse) {
      return 'collapse';
    }
    // Near-miss: reduce a life but don't collapse
    var pNearMiss = pCollapse * 0.5;
    if (r < pCollapse + pNearMiss) {
      return 'nearmiss';
    }
    return 'safe';
  }

  function initBlocks() {
    var r, c;
    blocks = [];
    for (r = 0; r < ROWS; r++) {
      blocks[r] = [];
      for (c = 0; c < COLS; c++) {
        blocks[r][c] = true;
      }
    }
  }

  function resetGame() {
    score         = 0;
    lives         = MAX_LIVES;
    pullCount     = 0;
    safeLeft      = 2;
    wobbleAmt     = 0;
    wobbleTime    = 0;
    wobbleDecay   = 0;
    crashFlash    = 0;
    highlightRow  = -1;
    highlightCol  = -1;
    initBlocks();
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function triggerCollapse() {
    crashFlash = 0.8;
    // Delay death to show crash flash
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

    // Wobble animation
    if (wobbleDecay > 0) {
      wobbleTime  += dt * 18;
      wobbleDecay -= dt * 1.5;
      if (wobbleDecay < 0) { wobbleDecay = 0; }
      wobbleAmt = wobbleDecay;
    } else {
      wobbleAmt  = 0;
      wobbleTime = 0;
    }

    // All blocks exhausted — game over
    if (crashFlash <= 0 && !hasAnyTappable()) {
      triggerCollapse();
    }

    // Crash flash counts down to DEAD
    if (crashFlash > 0) {
      crashFlash -= dt;
      if (crashFlash <= 0) {
        crashFlash = 0;
        state      = 'DEAD';
        if (score > bestScore) { bestScore = score; }
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
      }
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
    if (crashFlash > 0) { return; }

    // Hit-test which block was tapped
    var tappedRow = -1;
    var tappedCol = -1;
    var r, c, bx, by;
    for (r = 0; r < ROWS - 1; r++) {
      for (c = 0; c < COLS; c++) {
        if (!blocks[r][c]) { continue; }
        bx = blockX(c);
        by = blockY(r);
        if (x >= bx && x <= bx + BLOCK_W && y >= by && y <= by + BLOCK_H) {
          tappedRow = r;
          tappedCol = c;
          break;
        }
      }
      if (tappedRow >= 0) { break; }
    }

    if (tappedRow < 0 || !isTappable(tappedRow)) {
      try { Audio.play('tap'); } catch (e) {}
      return;
    }

    // Pull the block
    blocks[tappedRow][tappedCol] = false;
    pullCount++;

    var result = stabilityCheck();

    if (result === 'collapse') {
      try { Audio.play('crash'); } catch (e) {}
      // near-total wobble then crash
      wobbleDecay = 1.5;
      wobbleTime  = 0;
      triggerCollapse();
    } else if (result === 'nearmiss') {
      lives--;
      if (lives < 1) { lives = 1; }
      score += 10;
      wobbleDecay = 0.8;
      wobbleTime  = 0;
      try { Audio.play('crash'); } catch (e) {}
    } else {
      // Safe
      score += 10;
      wobbleDecay = 0.3;
      wobbleTime  = 0;
      try { Audio.play('gem'); } catch (e) {}
    }

    highlightRow = -1;
    highlightCol = -1;
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  function drawBg() {
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    var i, sx, sy;
    for (i = 0; i < 60; i++) {
      sx = (i * 137.5 + 10) % VW;
      sy = (i * 97.3  + 20) % (VH * 0.85);
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  function drawBlock(bx, by, color, present, tappable, highlight) {
    if (!present) {
      // Empty gap — draw faint outline
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(bx + 2, by + 2, BLOCK_W - 4, BLOCK_H - 4);
      return;
    }

    // Shadow / glow
    ctx.shadowColor = color;
    ctx.shadowBlur  = tappable ? 8 : 3;

    // Gradient fill
    var grad = ctx.createLinearGradient(bx, by, bx, by + BLOCK_H);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(4,5,14,0.6)');
    ctx.fillStyle = grad;

    // Rounded rect via arc
    var r = 4;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + BLOCK_W - r, by);
    ctx.quadraticCurveTo(bx + BLOCK_W, by, bx + BLOCK_W, by + r);
    ctx.lineTo(bx + BLOCK_W, by + BLOCK_H - r);
    ctx.quadraticCurveTo(bx + BLOCK_W, by + BLOCK_H, bx + BLOCK_W - r, by + BLOCK_H);
    ctx.lineTo(bx + r, by + BLOCK_H);
    ctx.quadraticCurveTo(bx, by + BLOCK_H, bx, by + BLOCK_H - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur  = 0;

    // Border
    ctx.strokeStyle = highlight ? '#ffffff' : color;
    ctx.lineWidth   = highlight ? 2 : 1;
    ctx.stroke();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx + 4, by + 3, BLOCK_W - 8, 4);
  }

  function drawTower() {
    var wobbleX = wobbleAmt > 0 ? Math.sin(wobbleTime) * wobbleAmt * 10 : 0;

    ctx.save();
    ctx.translate(wobbleX, 0);

    var r, c, bx, by, color, present, tappable, highlight;
    for (r = 0; r < ROWS; r++) {
      color    = ROW_COLORS[r % ROW_COLORS.length];
      tappable = isTappable(r);
      for (c = 0; c < COLS; c++) {
        bx      = blockX(c);
        by      = blockY(r);
        present = blocks[r][c];
        highlight = (r === highlightRow && c === highlightCol);
        drawBlock(bx, by, color, present, tappable, highlight);
      }
    }

    ctx.restore();
  }

  function drawHUD() {
    // Lives top-left
    ctx.font      = '26px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff1744';
    var str = '';
    var i;
    for (i = 0; i < MAX_LIVES; i++) {
      str += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(str, 16, 44);

    // Score top-right
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, VW - 16, 44);

    // Pull count
    ctx.font      = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('pulls: ' + pullCount, VW - 16, 64);

    // Stability label
    var stabilityLabel, stabilityColor;
    if (lives === 3) {
      stabilityLabel = 'STABLE';
      stabilityColor = '#69f0ae';
    } else if (lives === 2) {
      stabilityLabel = 'WOBBLING';
      stabilityColor = '#ffeb3b';
    } else {
      stabilityLabel = 'CRITICAL!';
      stabilityColor = '#ff5252';
    }
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = stabilityColor;
    ctx.fillText(stabilityLabel, VW / 2, VH - 30);

    ctx.textAlign = 'left';
  }

  function drawCrashFlash() {
    if (crashFlash <= 0) { return; }
    var alpha = clamp(crashFlash * 0.7, 0, 0.7);
    ctx.fillStyle = 'rgba(255,80,40,' + alpha + ')';
    ctx.fillRect(0, 0, VW, VH);

    // "CRASH!" text
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 72px monospace';
    ctx.shadowColor = '#ff5252';
    ctx.shadowBlur  = 30;
    ctx.fillText('CRASH!', VW / 2, VH / 2);
    ctx.shadowBlur  = 0;
    ctx.textAlign   = 'left';
  }

  function drawMenu() {
    drawBg();
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#00e5ff';
    ctx.font        = 'bold 54px monospace';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 24;
    ctx.fillText('CITY', VW / 2, VH / 2 - 60);
    ctx.fillStyle   = '#ffeb3b';
    ctx.shadowColor = '#ffeb3b';
    ctx.fillText('STACK', VW / 2, VH / 2);
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = '20px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 70);
    if (bestScore > 0) {
      ctx.fillStyle = '#aaaacc';
      ctx.font      = '16px monospace';
      ctx.fillText('BEST: ' + bestScore, VW / 2, VH / 2 + 106);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(4,5,14,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#ff5252';
    ctx.font        = 'bold 48px monospace';
    ctx.shadowColor = '#ff5252';
    ctx.shadowBlur  = 20;
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 60px monospace';
    ctx.fillText(score, VW / 2, VH / 2);

    ctx.fillStyle = '#ffeb3b';
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
    drawTower();
    drawHUD();
    drawCrashFlash();

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
