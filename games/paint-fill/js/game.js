'use strict';

/* Paint Fill — flood-fill puzzle game.
   Tap a color button to flood-fill the grid from the top-left corner.
   Goal: fill the entire grid with one color in 20 moves or fewer.
   Score = number of boards solved. */

var PaintFill = (function () {
  var VW = 390, VH = 844;

  var canvas, ctx;
  var state = 'MENU';   // 'MENU' | 'PLAYING' | 'DEAD'
  var score = 0;
  var _best = 0;
  var t = 0;            // global animation time (seconds)

  // Grid constants
  var COLS = 10, ROWS = 10;
  var MAX_MOVES = 20;
  var movesLeft = MAX_MOVES;

  // Grid: flat array of color indices (0-3), length = COLS * ROWS
  var grid = [];

  // The 4 available colors
  var COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

  // Layout for color buttons at the bottom
  var BTN_COUNT = 4;
  var BTN_SIZE = 64;
  var BTN_GAP = 16;
  var BTN_Y = 0;        // computed in init

  // Grid layout
  var GRID_MARGIN = 20;
  var GRID_TOP = 130;
  var CELL_SIZE = 0;    // computed in init

  // ---- Helpers ----

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function rnd(n) { return Math.floor(Math.random() * n); }

  function cellIndex(col, row) { return row * COLS + col; }

  // ---- Flood fill ----

  // Flood-fill from (0,0): replace oldColor with newColor for all connected cells.
  function floodFill(newColorIdx) {
    var oldColorIdx = grid[cellIndex(0, 0)];
    if (oldColorIdx === newColorIdx) return; // no-op: same color chosen

    var stack = [];
    var visited = [];
    var i;
    for (i = 0; i < COLS * ROWS; i++) { visited[i] = false; }

    stack.push(0); // start at top-left (col=0, row=0), index=0
    visited[0] = true;

    while (stack.length > 0) {
      var idx = stack.pop();
      grid[idx] = newColorIdx;
      var col = idx % COLS;
      var row = Math.floor(idx / COLS);

      // Check 4 neighbors
      var neighbors = [];
      if (col > 0)        neighbors.push(cellIndex(col - 1, row));
      if (col < COLS - 1) neighbors.push(cellIndex(col + 1, row));
      if (row > 0)        neighbors.push(cellIndex(col, row - 1));
      if (row < ROWS - 1) neighbors.push(cellIndex(col, row + 1));

      for (var n = 0; n < neighbors.length; n++) {
        var ni = neighbors[n];
        if (!visited[ni] && grid[ni] === oldColorIdx) {
          visited[ni] = true;
          stack.push(ni);
        }
      }
    }
  }

  // Returns true if every cell has the same color
  function isGridComplete() {
    var first = grid[0];
    for (var i = 1; i < COLS * ROWS; i++) {
      if (grid[i] !== first) return false;
    }
    return true;
  }

  // ---- Board generation ----

  function buildBoard() {
    grid = [];
    var i;
    for (i = 0; i < COLS * ROWS; i++) {
      grid.push(rnd(COLORS.length));
    }
    // Ensure the puzzle is solvable and interesting: make sure the grid is
    // not already solved (very unlikely but guard it).
    while (isGridComplete()) {
      for (i = 0; i < COLS * ROWS; i++) {
        grid[i] = rnd(COLORS.length);
      }
    }
  }

  // ---- Layout ----

  function computeLayout() {
    CELL_SIZE = Math.floor((VW - GRID_MARGIN * 2) / COLS);
    var totalBtnW = BTN_COUNT * BTN_SIZE + (BTN_COUNT - 1) * BTN_GAP;
    // Place buttons near bottom, leaving some padding
    BTN_Y = VH - 80;
  }

  // ---- Game state transitions ----

  function startGame() {
    movesLeft = MAX_MOVES;
    score = 0;
    buildBoard();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function nextBoard() {
    score += 1;
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
    movesLeft = MAX_MOVES;
    buildBoard();
    // Stay in PLAYING state
  }

  function gameOver() {
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
    state = 'DEAD';
    snd('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'paintfill_best'); } catch(e) {}
  }

  // ---- Public API ----

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    computeLayout();
    state = 'MENU';
    score = 0;
    movesLeft = MAX_MOVES;
    grid = [];
    t = 0;
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    t += dt;
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      startGame();
      snd('button');
      return;
    }

    if (state === 'DEAD') {
      startGame();
      snd('button');
      return;
    }

    if (state !== 'PLAYING') return;

    // Hit-test color buttons
    var totalBtnW = BTN_COUNT * BTN_SIZE + (BTN_COUNT - 1) * BTN_GAP;
    var btnStartX = (VW - totalBtnW) / 2;

    for (var i = 0; i < BTN_COUNT; i++) {
      var bx = btnStartX + i * (BTN_SIZE + BTN_GAP);
      var by = BTN_Y - BTN_SIZE / 2;
      if (vx >= bx && vx <= bx + BTN_SIZE && vy >= by && vy <= by + BTN_SIZE) {
        if (i === grid[cellIndex(0, 0)]) return; // same color — no cost
        snd('tap');
        floodFill(i);
        movesLeft -= 1;

        if (isGridComplete()) {
          snd('gem');
          nextBoard();
        } else if (movesLeft <= 0) {
          gameOver();
        }
        return;
      }
    }
  }

  function getBest() { return _best; }

  // ---- Rendering helpers ----

  function roundRect(x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function clearBg() {
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, VW, VH);
  }

  // ---- Draw: MENU ----

  function drawMenu() {
    // Colorful animated background cells
    var cellSz = 38;
    var cols = Math.ceil(VW / cellSz) + 1;
    var rows = Math.ceil(VH / cellSz) + 1;
    var shift = (t * 18) % cellSz;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ci = (c + r * 3 + Math.floor(t * 0.4 + c * 0.3 + r * 0.7)) % COLORS.length;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = COLORS[ci];
        ctx.fillRect(c * cellSz - shift, r * cellSz - shift, cellSz - 2, cellSz - 2);
      }
    }
    ctx.globalAlpha = 1;

    // Dark overlay for readability
    ctx.fillStyle = 'rgba(26, 26, 46, 0.65)';
    ctx.fillRect(0, 0, VW, VH);

    // Title: PAINT
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#E74C3C';
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 68px Arial';
    ctx.fillText('PAINT', VW / 2, 300 + Math.sin(t * 1.2) * 5);
    ctx.shadowColor = '#3498DB';
    ctx.fillStyle = '#3498DB';
    ctx.fillText('FILL', VW / 2, 375 + Math.sin(t * 1.2 + 0.5) * 5);
    ctx.restore();

    // Subtitle
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '22px Arial';
    ctx.fillText('Flood fill the grid in ' + MAX_MOVES + ' moves!', VW / 2, 445);
    ctx.restore();

    // Sample color swatches
    var swatchW = 48;
    var swatchGap = 14;
    var totalSw = COLORS.length * swatchW + (COLORS.length - 1) * swatchGap;
    var swX = (VW - totalSw) / 2;
    for (var ci2 = 0; ci2 < COLORS.length; ci2++) {
      ctx.save();
      ctx.shadowBlur = 16 + 6 * Math.sin(t * 2 + ci2);
      ctx.shadowColor = COLORS[ci2];
      ctx.fillStyle = COLORS[ci2];
      roundRect(swX + ci2 * (swatchW + swatchGap), 490 + Math.sin(t * 1.8 + ci2 * 1.1) * 6, swatchW, swatchW, 10);
      ctx.fill();
      ctx.restore();
    }

    // TAP TO PLAY (pulsing)
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('TAP TO PLAY', VW / 2, 618);
    ctx.restore();

    // Best score
    if (_best > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '20px Arial';
      ctx.fillText('BEST  ' + _best, VW / 2, 672);
      ctx.restore();
    }
  }

  // ---- Draw: Grid ----

  function drawGrid() {
    var gridLeft = GRID_MARGIN;
    var cellBorder = 2;

    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var idx = cellIndex(col, row);
        var x = gridLeft + col * CELL_SIZE;
        var y = GRID_TOP + row * CELL_SIZE;
        var colorStr = COLORS[grid[idx]];

        // Cell fill
        ctx.fillStyle = colorStr;
        ctx.fillRect(x + cellBorder, y + cellBorder, CELL_SIZE - cellBorder * 2, CELL_SIZE - cellBorder * 2);

        // Subtle inner highlight on top-left region (connected to origin)
        if (col === 0 && row === 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + cellBorder, y + cellBorder, CELL_SIZE - cellBorder * 2, CELL_SIZE - cellBorder * 2);
          ctx.restore();
        }
      }
    }
  }

  // ---- Draw: Color buttons ----

  function drawButtons() {
    var totalBtnW = BTN_COUNT * BTN_SIZE + (BTN_COUNT - 1) * BTN_GAP;
    var btnStartX = (VW - totalBtnW) / 2;
    var by = BTN_Y - BTN_SIZE / 2;
    var currentColor = grid.length > 0 ? grid[cellIndex(0, 0)] : -1;

    for (var i = 0; i < BTN_COUNT; i++) {
      var bx = btnStartX + i * (BTN_SIZE + BTN_GAP);
      var isActive = (i === currentColor);

      ctx.save();
      if (isActive) {
        ctx.shadowColor = COLORS[i];
        ctx.shadowBlur = 20;
      }
      ctx.fillStyle = COLORS[i];
      roundRect(bx, by, BTN_SIZE, BTN_SIZE, 12);
      ctx.fill();

      // Border: thicker white ring for active (already-selected) color
      ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = isActive ? 3 : 1.5;
      roundRect(bx + 1, by + 1, BTN_SIZE - 2, BTN_SIZE - 2, 11);
      ctx.stroke();

      // Check mark inside active button
      if (isActive) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bx + BTN_SIZE * 0.25, by + BTN_SIZE * 0.5);
        ctx.lineTo(bx + BTN_SIZE * 0.44, by + BTN_SIZE * 0.68);
        ctx.lineTo(bx + BTN_SIZE * 0.75, by + BTN_SIZE * 0.32);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---- Draw: HUD ----

  function drawHUD() {
    // Score (top center)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(String(score), VW / 2, 24);
    ctx.restore();

    // Best (top right)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '16px Arial';
    ctx.fillText('BEST ' + _best, VW - 18, 30);
    ctx.restore();

    // Moves remaining bar label
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('MOVES', 18, 30);
    ctx.restore();

    // Moves remaining counter (large)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Arial';
    var moveFrac = movesLeft / MAX_MOVES;
    ctx.fillStyle = moveFrac > 0.4 ? '#2ECC71' : (moveFrac > 0.2 ? '#F39C12' : '#E74C3C');
    ctx.fillText(String(movesLeft), 18, 75);
    ctx.restore();

    // Moves bar (below "MOVES" label)
    var barX = 18, barY = 62, barW = 120, barH = 10;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(barX, barY, barW, barH, 5);
    ctx.fill();

    var barFill = movesLeft / MAX_MOVES;
    if (barFill < 0) barFill = 0;
    if (barFill > 1) barFill = 1;
    var barColor = barFill > 0.4 ? '#2ECC71' : (barFill > 0.2 ? '#F39C12' : '#E74C3C');
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = barColor;
    if (barFill > 0) {
      roundRect(barX, barY, barW * barFill, barH, 5);
      ctx.fill();
    }
    ctx.restore();

    // "COLOR BUTTONS" label above buttons
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '14px Arial';
    ctx.fillText('CHOOSE COLOR', VW / 2, BTN_Y - BTN_SIZE / 2 - 8);
    ctx.restore();
  }

  // ---- Draw: DEAD overlay ----

  function drawDead() {
    // Semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(26,26,46,0.78)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // "OUT OF MOVES" title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#E74C3C';
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 46px Arial';
    ctx.fillText('OUT OF', VW / 2, 300);
    ctx.fillText('MOVES!', VW / 2, 354);
    ctx.restore();

    // Score
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '22px Arial';
    ctx.fillText('BOARDS SOLVED', VW / 2, 420);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 52px Arial';
    ctx.fillText(String(score), VW / 2, 474);
    ctx.restore();

    // Best score
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '20px Arial';
    ctx.fillText('BEST  ' + _best, VW / 2, 530);
    ctx.restore();

    // TAP TO RETRY (pulsing)
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('TAP TO RETRY', VW / 2, 630);
    ctx.restore();
  }

  // ---- Draw: PLAYING state ----

  function drawPlaying() {
    drawGrid();
    drawHUD();
    drawButtons();
  }

  // ---- Main draw ----

  function draw() {
    clearBg();

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawPlaying();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  // ---- Expose public API ----

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = PaintFill; }
