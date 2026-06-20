'use strict';
var BlockBlast = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score = 0;
  var best = 0;

  var COLS = 7;
  var ROWS = 9;
  var CELL;
  var GRID_X;
  var GRID_Y;
  var VW = 390;
  var VH = 844;

  var COLORS = ['#FF4C4C', '#FF9900', '#FFD700', '#4CAF50', '#2196F3', '#9C27B0', '#FF69B4'];

  var grid = [];
  var fallAnims = [];
  var blastParticles = [];
  var newRowTimer = 0;
  var NEW_ROW_INTERVAL = 5;
  var shakeTime = 0;
  var shakeAmt = 0;

  function makeGrid() {
    grid = [];
    for (var r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (var c = 0; c < COLS; c++) {
        grid[r][c] = Math.floor(Math.random() * COLORS.length);
      }
    }
  }

  function floodFill(row, col, colorIdx, visited) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return [];
    var key = row + ',' + col;
    if (visited[key]) return [];
    if (grid[row][col] !== colorIdx) return [];
    visited[key] = true;
    var cells = [[row, col]];
    var up = floodFill(row - 1, col, colorIdx, visited);
    var dn = floodFill(row + 1, col, colorIdx, visited);
    var lt = floodFill(row, col - 1, colorIdx, visited);
    var rt = floodFill(row, col + 1, colorIdx, visited);
    return cells.concat(up, dn, lt, rt);
  }

  function blastCells(cells) {
    for (var i = 0; i < cells.length; i++) {
      var r = cells[i][0];
      var c = cells[i][1];
      var cx = GRID_X + c * CELL + CELL / 2;
      var cy = GRID_Y + r * CELL + CELL / 2;
      spawnParticles(cx, cy, COLORS[grid[r][c]]);
      grid[r][c] = -1;
    }
    score += cells.length;
    try { Audio.play('gem'); } catch (e) {}
  }

  function spawnParticles(cx, cy, color) {
    for (var i = 0; i < 8; i++) {
      var angle = (Math.PI * 2 * i) / 8;
      blastParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        color: color,
        life: 0.6,
        maxLife: 0.6,
        size: 4 + Math.random() * 4
      });
    }
  }

  function applyGravity() {
    for (var c = 0; c < COLS; c++) {
      var writeRow = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] !== -1) {
          if (r !== writeRow) {
            grid[writeRow][c] = grid[r][c];
            grid[r][c] = -1;
          }
          writeRow--;
        }
      }
    }
  }

  function addNewRow() {
    // check if top row is occupied BEFORE shifting — if so, game over
    for (var cc = 0; cc < COLS; cc++) {
      if (grid[0][cc] !== -1) {
        killPlayer();
        return;
      }
    }
    // shift everything up
    for (var r = 0; r < ROWS - 1; r++) {
      grid[r] = grid[r + 1].slice();
    }
    grid[ROWS - 1] = [];
    for (var c = 0; c < COLS; c++) {
      grid[ROWS - 1][c] = Math.floor(Math.random() * COLORS.length);
    }
  }

  function checkTopRowDead() {
    for (var c = 0; c < COLS; c++) {
      if (grid[0][c] !== -1) return true;
    }
    return false;
  }

  function killPlayer() {
    if (state === 'DEAD') return;
    state = 'DEAD';
    if (score > best) best = score;
    shakeTime = 0.4;
    shakeAmt = 12;
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'blockblast_best'); } catch(e) {}
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    CELL = Math.floor(VW / (COLS + 1));
    GRID_X = Math.floor((VW - COLS * CELL) / 2);
    GRID_Y = Math.floor(VH * 0.18);
    state = 'MENU';
    score = 0;
    newRowTimer = 0;
    blastParticles = [];
    makeGrid();
  }

  function startGame() {
    state = 'PLAYING';
    score = 0;
    newRowTimer = 0;
    blastParticles = [];
    makeGrid();
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (shakeTime > 0) shakeTime -= dt;

    newRowTimer += dt;
    if (newRowTimer >= NEW_ROW_INTERVAL) {
      newRowTimer = 0;
      addNewRow();
    }

    for (var i = blastParticles.length - 1; i >= 0; i--) {
      var p = blastParticles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 6 * dt;
      p.life -= dt;
      if (p.life <= 0) blastParticles.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);

    // Background
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#1a0533');
    bg.addColorStop(1, '#0d0221');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    var sx = 0, sy = 0;
    if (shakeTime > 0) {
      sx = (Math.random() - 0.5) * shakeAmt;
      sy = (Math.random() - 0.5) * shakeAmt;
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawGrid();
    drawParticles();
    drawHUD();
    ctx.restore();

    if (state === 'DEAD') {
      drawDeadOverlay();
    }
  }

  function drawGrid() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var colorIdx = grid[r][c];
        if (colorIdx === -1) continue;
        var x = GRID_X + c * CELL;
        var y = GRID_Y + r * CELL;
        var color = COLORS[colorIdx];

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 3, y + 3, CELL - 2, CELL - 2);

        // Block
        ctx.fillStyle = color;
        roundRect(ctx, x + 1, y + 1, CELL - 4, CELL - 4, 6);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        roundRect(ctx, x + 3, y + 3, CELL - 8, (CELL - 8) * 0.4, 4);
        ctx.fill();
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < blastParticles.length; i++) {
      var p = blastParticles[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE: ' + score, VW / 2, GRID_Y - 20);

    // Timer bar
    var barW = COLS * CELL;
    var barH = 8;
    var bx = GRID_X;
    var by = GRID_Y + ROWS * CELL + 12;
    var pct = 1 - (newRowTimer / NEW_ROW_INTERVAL);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = pct < 0.3 ? '#FF4C4C' : '#4CAF50';
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NEW ROW IN ' + (NEW_ROW_INTERVAL - newRowTimer).toFixed(1) + 's', VW / 2, by + 24);
  }

  function drawMenu() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF4C4C';
    ctx.shadowBlur = 20;
    ctx.fillText('BLOCK BLAST', VW / 2, VH * 0.32);
    ctx.shadowBlur = 0;

    ctx.font = '22px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Blast same-colored neighbors!', VW / 2, VH * 0.42);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.52);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.65);
    ctx.globalAlpha = 1;

    // Mini preview grid
    drawMiniPreview();
  }

  function drawMiniPreview() {
    var cellS = 22;
    var cols2 = 5, rows2 = 3;
    var px = (VW - cols2 * cellS) / 2;
    var py = VH * 0.73;
    for (var r = 0; r < rows2; r++) {
      for (var c = 0; c < cols2; c++) {
        var ci = (r * cols2 + c) % COLORS.length;
        ctx.fillStyle = COLORS[ci];
        roundRect(ctx, px + c * cellS + 1, py + r * cellS + 1, cellS - 3, cellS - 3, 4);
        ctx.fill();
      }
    }
  }

  function drawDeadOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#FF4C4C';
    ctx.font = 'bold 54px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF4C4C';
    ctx.shadowBlur = 30;
    ctx.fillText('DEAD', VW / 2, VH * 0.35);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('SCORE: ' + score, VW / 2, VH * 0.47);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.56);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.7);
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx2, x, y, w, h, r2) {
    ctx2.beginPath();
    ctx2.moveTo(x + r2, y);
    ctx2.lineTo(x + w - r2, y);
    ctx2.quadraticCurveTo(x + w, y, x + w, y + r2);
    ctx2.lineTo(x + w, y + h - r2);
    ctx2.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
    ctx2.lineTo(x + r2, y + h);
    ctx2.quadraticCurveTo(x, y + h, x, y + h - r2);
    ctx2.lineTo(x, y + r2);
    ctx2.quadraticCurveTo(x, y, x + r2, y);
    ctx2.closePath();
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      return;
    }
    if (state === 'DEAD') {
      state = 'MENU';
      return;
    }
    if (state === 'PLAYING') {
      var col = Math.floor((x - GRID_X) / CELL);
      var row = Math.floor((y - GRID_Y) / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      if (grid[row][col] === -1) return;
      var colorIdx = grid[row][col];
      var visited = {};
      var cells = floodFill(row, col, colorIdx, visited);
      if (cells.length < 2) return;
      blastCells(cells);
      applyGravity();
      if (checkTopRowDead()) {
        killPlayer();
      }
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function getBest() {
    return best;
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
}());
