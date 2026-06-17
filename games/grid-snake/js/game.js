'use strict';

var GridSnake = (function () {
  // Virtual canvas dimensions
  var VW = 390, VH = 844;

  // Grid constants
  var COLS = 13, ROWS = 18;
  var CELL = 30; // VW / COLS = 390 / 13 = 30
  var GX = (VW - COLS * CELL) / 2; // = 0, centered
  var GY_TOP_PAD = 80; // room for score display
  var GY = Math.floor((VH - GY_TOP_PAD - ROWS * CELL) / 2) + GY_TOP_PAD;

  // Colors
  var C_BG        = '#0A0A0A';
  var C_GRID      = '#111111';
  var C_BORDER    = '#222222';
  var C_HEAD      = '#39FF14';
  var C_BODY      = '#00CC00';
  var C_TAIL      = '#007700';
  var C_FOOD      = '#FF0066';
  var C_TITLE     = '#39FF14';
  var C_TEXT      = '#CCFFCC';
  var C_DIM_TEXT  = '#88AA88';
  var C_OVERLAY   = 'rgba(0,0,0,0.72)';
  var C_DEAD_TXT  = '#FF4466';

  // Timing
  var INTERVAL_START = 0.15;
  var INTERVAL_MIN   = 0.08;
  var SPEED_EVERY    = 5;

  // State
  var state = 'MENU';
  var snake; // array of {x, y}, head first
  var dx, dy; // current direction
  var ndx, ndy; // next direction (buffered)
  var food; // {x, y}
  var score;
  var best;
  var interval;
  var timer; // countdown to next move
  var foodEaten; // total foods eaten (for speed calc)
  var grew; // flag: snake grew this step, don't remove tail
  var _canvas, _ctx;
  var _time; // accumulated time for animations

  // ── Helpers ──────────────────────────────────────────────────────────────

  function cellX(c) { return GX + c * CELL; }
  function cellY(r) { return GY + r * CELL; }

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  function isOnSnake(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function placeFood() {
    var empties = [];
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        if (!isOnSnake(c, r)) {
          empties.push({x: c, y: r});
        }
      }
    }
    if (empties.length === 0) return {x: 0, y: 0};
    return empties[rnd(0, empties.length - 1)];
  }

  function calcInterval() {
    var speedUps = Math.floor(foodEaten / SPEED_EVERY);
    var iv = INTERVAL_START - speedUps * 0.005;
    if (iv < INTERVAL_MIN) iv = INTERVAL_MIN;
    return iv;
  }

  // ── Init / Reset ─────────────────────────────────────────────────────────

  function resetGame() {
    // Start snake at center going right (3 segments)
    var cx = Math.floor(COLS / 2); // 6
    var cy = Math.floor(ROWS / 2); // 9
    snake = [
      {x: cx,     y: cy},
      {x: cx - 1, y: cy},
      {x: cx - 2, y: cy}
    ];
    dx = 1; dy = 0;  // moving right
    ndx = 1; ndy = 0;
    score = 0;
    foodEaten = 0;
    grew = false;
    interval = calcInterval();
    timer = interval;
    food = placeFood();
    _time = 0;
  }

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    _time = 0;
    resetGame();
  }

  // ── Update ────────────────────────────────────────────────────────────────

  function update(dt) {
    _time += dt;

    if (state !== 'PLAYING') return;

    timer -= dt;
    if (timer > 0) return;
    timer += interval; // schedule next move (additive to avoid drift)

    // Commit buffered direction
    dx = ndx;
    dy = ndy;

    // Compute new head position
    var head = snake[0];
    var nx = head.x + dx;
    var ny = head.y + dy;

    // Check wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      die();
      return;
    }

    // Check self collision (skip tail tip because it will be removed unless growing)
    var limit = grew ? snake.length : snake.length - 1;
    for (var i = 0; i < limit; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        die();
        return;
      }
    }

    // Move: add new head
    snake.unshift({x: nx, y: ny});

    // Check food
    if (nx === food.x && ny === food.y) {
      score++;
      foodEaten++;
      grew = true;
      interval = calcInterval();
      if (score > best) best = score;
      food = placeFood();
      try { Audio.play('gem'); } catch(e) {}
    } else {
      grew = false;
      snake.pop(); // remove tail
    }
  }

  function die() {
    state = 'DEAD';
    try { Audio.play('crash'); } catch(e) {}
    try { AdManager.gameplayStop(); } catch(e) {}
    try { AdManager.onRunEnd(); } catch(e) {}
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────

  function drawRect(x, y, w, h, color) {
    _ctx.fillStyle = color;
    _ctx.fillRect(x, y, w, h);
  }

  function drawRoundRect(x, y, w, h, r, color) {
    _ctx.fillStyle = color;
    _ctx.beginPath();
    _ctx.moveTo(x + r, y);
    _ctx.lineTo(x + w - r, y);
    _ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    _ctx.lineTo(x + w, y + h - r);
    _ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    _ctx.lineTo(x + r, y + h);
    _ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    _ctx.lineTo(x, y + r);
    _ctx.quadraticCurveTo(x, y, x + r, y);
    _ctx.closePath();
    _ctx.fill();
  }

  function drawGrid() {
    _ctx.strokeStyle = C_GRID;
    _ctx.lineWidth = 0.5;
    var x0 = GX, y0 = GY;
    var x1 = GX + COLS * CELL, y1 = GY + ROWS * CELL;
    for (var c = 0; c <= COLS; c++) {
      var gx = GX + c * CELL;
      _ctx.beginPath();
      _ctx.moveTo(gx, y0);
      _ctx.lineTo(gx, y1);
      _ctx.stroke();
    }
    for (var r = 0; r <= ROWS; r++) {
      var gy = GY + r * CELL;
      _ctx.beginPath();
      _ctx.moveTo(x0, gy);
      _ctx.lineTo(x1, gy);
      _ctx.stroke();
    }
    // Border
    _ctx.strokeStyle = C_BORDER;
    _ctx.lineWidth = 1.5;
    _ctx.strokeRect(x0 - 1, y0 - 1, COLS * CELL + 2, ROWS * CELL + 2);
  }

  function drawSnake() {
    var len = snake.length;
    for (var i = len - 1; i >= 0; i--) {
      var seg = snake[i];
      var px = cellX(seg.x) + 1;
      var py = cellY(seg.y) + 1;
      var pw = CELL - 2;
      var ph = CELL - 2;

      if (i === 0) {
        // Head - brightest, with glow
        _ctx.shadowBlur = 14;
        _ctx.shadowColor = C_HEAD;
        drawRoundRect(px, py, pw, ph, 5, C_HEAD);
        _ctx.shadowBlur = 0;

        // Eyes
        var ex1, ey1, ex2, ey2;
        var eyeR = 2.5;
        var eyeOff = 5;
        // eye positions based on direction
        if (dx === 1) { // right
          ex1 = px + pw - eyeOff; ey1 = py + eyeOff;
          ex2 = px + pw - eyeOff; ey2 = py + ph - eyeOff;
        } else if (dx === -1) { // left
          ex1 = px + eyeOff; ey1 = py + eyeOff;
          ex2 = px + eyeOff; ey2 = py + ph - eyeOff;
        } else if (dy === -1) { // up
          ex1 = px + eyeOff;      ey1 = py + eyeOff;
          ex2 = px + pw - eyeOff; ey2 = py + eyeOff;
        } else { // down
          ex1 = px + eyeOff;      ey1 = py + ph - eyeOff;
          ex2 = px + pw - eyeOff; ey2 = py + ph - eyeOff;
        }
        _ctx.fillStyle = '#0A0A0A';
        _ctx.beginPath(); _ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); _ctx.fill();
        _ctx.beginPath(); _ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); _ctx.fill();
      } else {
        // Body / tail gradient
        var t = i / (len - 1); // 0 = just behind head, 1 = tail tip
        // Interpolate from C_BODY to C_TAIL
        // #00CC00 → #007700
        var g = Math.floor(0xCC - t * (0xCC - 0x77));
        var hexG = g.toString(16);
        if (hexG.length < 2) hexG = '0' + hexG;
        var segColor = '#00' + hexG + '00';
        var radius = i === len - 1 ? 4 : 3;
        drawRoundRect(px + 1, py + 1, pw - 2, ph - 2, radius, segColor);
      }
    }
  }

  function drawFood() {
    var fx = cellX(food.x) + CELL / 2;
    var fy = cellY(food.y) + CELL / 2;
    var pulse = 0.8 + 0.2 * Math.sin(_time * 6);
    var fr = (CELL / 2 - 4) * pulse;

    _ctx.shadowBlur = 16;
    _ctx.shadowColor = C_FOOD;
    _ctx.fillStyle = C_FOOD;
    _ctx.beginPath();
    _ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.shadowBlur = 0;

    // Inner highlight
    _ctx.fillStyle = 'rgba(255,180,200,0.6)';
    _ctx.beginPath();
    _ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.35, 0, Math.PI * 2);
    _ctx.fill();
  }

  function drawScore() {
    _ctx.textAlign = 'center';
    _ctx.fillStyle = C_TEXT;
    _ctx.font = 'bold 28px monospace';
    _ctx.fillText(String(score), VW / 2, 44);

    _ctx.font = '13px monospace';
    _ctx.fillStyle = C_DIM_TEXT;
    _ctx.fillText('BEST: ' + String(best), VW / 2, 64);
  }

  function drawTapHints() {
    var bY = GY + ROWS * CELL + 24;
    _ctx.font = '12px monospace';
    _ctx.textAlign = 'left';
    _ctx.fillStyle = 'rgba(100,200,100,0.35)';
    _ctx.fillText('< TURN LEFT', 14, bY);
    _ctx.textAlign = 'right';
    _ctx.fillStyle = 'rgba(100,200,100,0.35)';
    _ctx.fillText('TURN RIGHT >', VW - 14, bY);
  }

  function drawDecorativeSnake(cx, cy) {
    // Draw a simple decorative coiled snake path for menu
    var pts = [];
    var s = 18; // segment size
    var cols = 8, rows = 5;
    var ox = cx - (cols * s) / 2;
    var oy = cy - (rows * s) / 2;
    for (var row = 0; row < rows; row++) {
      if (row % 2 === 0) {
        for (var col = 0; col < cols; col++) {
          pts.push({x: ox + col * s, y: oy + row * s});
        }
      } else {
        for (var col2 = cols - 1; col2 >= 0; col2--) {
          pts.push({x: ox + col2 * s, y: oy + row * s});
        }
      }
    }
    var len = pts.length;
    for (var i = 0; i < len; i++) {
      var t = i / (len - 1);
      var p = pts[i];
      var g = Math.floor(0xCC * (1 - t) + 0x22 * t);
      var hexG2 = g.toString(16);
      if (hexG2.length < 2) hexG2 = '0' + hexG2;
      var col3 = i === 0 ? C_HEAD : ('#00' + hexG2 + '00');
      var alpha = 0.55 - t * 0.25;
      _ctx.globalAlpha = alpha;
      _ctx.fillStyle = col3;
      _ctx.fillRect(p.x - s / 2 + 1, p.y - s / 2 + 1, s - 2, s - 2);
    }
    _ctx.globalAlpha = 1;
  }

  // ── Draw states ───────────────────────────────────────────────────────────

  function drawMenu() {
    // Background
    drawRect(0, 0, VW, VH, C_BG);

    // Decorative snake
    drawDecorativeSnake(VW / 2, VH * 0.54);

    // Title glow
    _ctx.save();
    _ctx.shadowBlur = 32;
    _ctx.shadowColor = C_TITLE;
    _ctx.fillStyle = C_TITLE;
    _ctx.font = 'bold 46px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('GRID SNAKE', VW / 2, VH * 0.22);
    _ctx.restore();

    // Subtitle
    _ctx.fillStyle = '#226622';
    _ctx.font = '18px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('CLASSIC SNAKE GAME', VW / 2, VH * 0.22 + 36);

    // Best score
    if (best > 0) {
      _ctx.fillStyle = C_DIM_TEXT;
      _ctx.font = '16px monospace';
      _ctx.textAlign = 'center';
      _ctx.fillText('BEST: ' + String(best), VW / 2, VH * 0.22 + 74);
    }

    // Tap to play - pulsing
    var alpha = 0.6 + 0.4 * Math.abs(Math.sin(_time * 2.5));
    _ctx.globalAlpha = alpha;
    _ctx.fillStyle = C_TITLE;
    _ctx.font = 'bold 22px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.84);
    _ctx.globalAlpha = 1;

    // Controls hint
    _ctx.fillStyle = C_DIM_TEXT;
    _ctx.font = '13px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('TAP LEFT / RIGHT TO TURN', VW / 2, VH * 0.84 + 28);
  }

  function drawPlaying() {
    // Background
    drawRect(0, 0, VW, VH, C_BG);

    // Grid area bg
    drawRect(GX, GY, COLS * CELL, ROWS * CELL, '#0D0D0D');

    // Grid lines
    drawGrid();

    // Food
    drawFood();

    // Snake
    drawSnake();

    // Score
    drawScore();

    // Tap hints
    drawTapHints();
  }

  function drawDead() {
    // Render the playing field first (frozen)
    drawPlaying();

    // Overlay
    drawRect(0, 0, VW, VH, C_OVERLAY);

    // Game over panel
    var panelW = 280, panelH = 220;
    var panelX = (VW - panelW) / 2;
    var panelY = (VH - panelH) / 2;
    drawRoundRect(panelX, panelY, panelW, panelH, 14, '#0F1F0F');
    _ctx.strokeStyle = '#2A4A2A';
    _ctx.lineWidth = 1.5;
    _ctx.strokeRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2);

    _ctx.save();
    _ctx.shadowBlur = 20;
    _ctx.shadowColor = C_DEAD_TXT;
    _ctx.fillStyle = C_DEAD_TXT;
    _ctx.font = 'bold 36px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('GAME OVER', VW / 2, panelY + 58);
    _ctx.restore();

    _ctx.fillStyle = C_TEXT;
    _ctx.font = 'bold 28px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('SCORE: ' + String(score), VW / 2, panelY + 106);

    _ctx.fillStyle = C_DIM_TEXT;
    _ctx.font = '16px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('BEST: ' + String(best), VW / 2, panelY + 140);

    var alpha2 = 0.6 + 0.4 * Math.abs(Math.sin(_time * 2.5));
    _ctx.globalAlpha = alpha2;
    _ctx.fillStyle = C_TITLE;
    _ctx.font = 'bold 18px monospace';
    _ctx.textAlign = 'center';
    _ctx.fillText('TAP TO RETRY', VW / 2, panelY + 188);
    _ctx.globalAlpha = 1;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function draw() {
    if (!_ctx) return;
    if (state === 'MENU') {
      drawMenu();
    } else if (state === 'PLAYING') {
      drawPlaying();
    } else if (state === 'DEAD') {
      drawDead();
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      state = 'PLAYING';
      resetGame();
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    if (state === 'DEAD') {
      state = 'PLAYING';
      resetGame();
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    if (state === 'PLAYING') {
      // Left half = turn left relative to current direction
      // Right half = turn right relative to current direction
      if (x < VW / 2) {
        // Turn left (relative)
        // RIGHT → UP, DOWN → RIGHT, LEFT → DOWN, UP → LEFT
        if (dx === 1 && dy === 0) { ndx = 0; ndy = -1; }       // right → up
        else if (dx === 0 && dy === 1) { ndx = 1; ndy = 0; }   // down → right
        else if (dx === -1 && dy === 0) { ndx = 0; ndy = 1; }  // left → down
        else if (dx === 0 && dy === -1) { ndx = -1; ndy = 0; } // up → left
      } else {
        // Turn right (relative)
        // RIGHT → DOWN, DOWN → LEFT, LEFT → UP, UP → RIGHT
        if (dx === 1 && dy === 0) { ndx = 0; ndy = 1; }        // right → down
        else if (dx === 0 && dy === 1) { ndx = -1; ndy = 0; }  // down → left
        else if (dx === -1 && dy === 0) { ndx = 0; ndy = -1; } // left → up
        else if (dx === 0 && dy === -1) { ndx = 1; ndy = 0; }  // up → right
      }
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
})();
