'use strict';

var PixelTrace = (function() {

  // ── Virtual canvas dimensions ──────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // ── Colors ─────────────────────────────────────────────────────────────────
  var COLOR_FG      = '#E74C3C';   // red  – foreground / 1-cells
  var COLOR_BG      = '#1A1A2E';   // dark – background / 0-cells
  var COLOR_GRID_LN = '#2C2C54';   // grid line color
  var COLOR_DONE_BG = '#27AE60';   // "Done" button
  var COLOR_WHITE   = '#FFFFFF';
  var COLOR_YELLOW  = '#F1C40F';
  var COLOR_ORANGE  = '#E67E22';
  var COLOR_PURPLE  = '#9B59B6';
  var COLOR_PANEL   = '#16213E';

  // ── Grid / game constants ──────────────────────────────────────────────────
  var GRID_SIZE      = 8;    // 8 × 8
  var MAX_TAPS       = 30;
  var MEMORIZE_TIME  = 2.0;  // seconds

  // ── 5 Hardcoded 8×8 pixel-art patterns (0 = bg, 1 = fg) ──────────────────
  var PATTERNS = [
    // 1. House
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [0,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,0]
    ],
    // 2. Heart
    [
      [0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,0,0,0,0,0]
    ],
    // 3. Star
    [
      [0,0,0,1,1,0,0,0],
      [0,0,0,1,1,0,0,0],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0],
      [1,1,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0]
    ],
    // 4. Tree
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [0,0,0,1,1,0,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0]
    ],
    // 5. Smiley face
    [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,0,1],
      [1,1,0,1,1,0,1,1],
      [0,1,1,1,1,1,1,0]
    ]
  ];

  // ── Module-level state ─────────────────────────────────────────────────────
  var _canvas      = null;
  var _ctx         = null;
  var _best        = 0;
  var _state       = 'MENU';
  var _round       = 1;
  var _patternIdx  = 0;
  var _target      = null;   // 8×8 array – current target pattern
  var _player      = null;   // 8×8 array – player's guesses
  var _tapsLeft    = MAX_TAPS;
  var _memTimer    = 0;
  var _lastAccuracy = 0;
  var _isWin       = false;

  // Grid layout (computed in init / on each draw)
  var _cellSize    = 36;
  var _gridOffX    = 0;
  var _gridOffY    = 0;

  // Done-button hit area
  var _doneBtn     = { x: 0, y: 0, w: 0, h: 0 };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _makeEmptyGrid() {
    var g = [];
    var r, c;
    for (r = 0; r < GRID_SIZE; r++) {
      g[r] = [];
      for (c = 0; c < GRID_SIZE; c++) {
        g[r][c] = 0;
      }
    }
    return g;
  }

  function _copyPattern(pat) {
    var g = [];
    var r, c;
    for (r = 0; r < GRID_SIZE; r++) {
      g[r] = [];
      for (c = 0; c < GRID_SIZE; c++) {
        g[r][c] = pat[r][c];
      }
    }
    return g;
  }

  function _calcAccuracy() {
    var correct = 0;
    var r, c;
    for (r = 0; r < GRID_SIZE; r++) {
      for (c = 0; c < GRID_SIZE; c++) {
        if (_player[r][c] === _target[r][c]) {
          correct++;
        }
      }
    }
    return Math.round((correct / (GRID_SIZE * GRID_SIZE)) * 100);
  }

  function _computeGridLayout() {
    _cellSize = Math.floor(Math.min(VW, VH * 0.5) / GRID_SIZE);
    _gridOffX = Math.floor((VW - _cellSize * GRID_SIZE) / 2);
    _gridOffY = Math.floor(VH * 0.25);
  }

  function _startRound() {
    _patternIdx = (_round - 1) % PATTERNS.length;
    _target     = _copyPattern(PATTERNS[_patternIdx]);
    _player     = _makeEmptyGrid();
    _tapsLeft   = MAX_TAPS;
    _memTimer   = MEMORIZE_TIME;
    _state      = 'MEMORIZE';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function _endRound() {
    _lastAccuracy = _calcAccuracy();
    _isWin        = (_lastAccuracy >= 70);
    if (_lastAccuracy > _best) {
      _best = _lastAccuracy;
    }
    _state = 'DEAD';
    try { AdManager.gameplayStop(); } catch(e) {}
    try { AdManager.onRunEnd(); } catch(e) {}
    if (_isWin) {
      try { Audio.play('gem'); } catch(e) {}
    } else {
      try { Audio.play('lose'); } catch(e) {}
    }
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  function _fillRect(color, x, y, w, h) {
    _ctx.fillStyle = color;
    _ctx.fillRect(x, y, w, h);
  }

  function _text(str, x, y, size, color, align) {
    _ctx.fillStyle = color;
    _ctx.font = 'bold ' + size + 'px monospace';
    _ctx.textAlign = align || 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(str, x, y);
  }

  function _drawGrid(grid, ox, oy, cs, showGrid) {
    var r, c, x, y;
    for (r = 0; r < GRID_SIZE; r++) {
      for (c = 0; c < GRID_SIZE; c++) {
        x = ox + c * cs;
        y = oy + r * cs;
        _fillRect(grid[r][c] === 1 ? COLOR_FG : COLOR_BG, x, y, cs, cs);
        if (showGrid) {
          _ctx.strokeStyle = COLOR_GRID_LN;
          _ctx.lineWidth   = 1;
          _ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        }
      }
    }
  }

  function _drawTimerBar(frac) {
    var bw = VW - 60;
    var bx = 30;
    var by = VH - 80;
    var bh = 16;
    _fillRect('#333355', bx, by, bw, bh);
    _fillRect(COLOR_YELLOW, bx, by, Math.round(bw * frac), bh);
    _ctx.strokeStyle = COLOR_WHITE;
    _ctx.lineWidth = 2;
    _ctx.strokeRect(bx, by, bw, bh);
  }

  function _drawDoneButton() {
    var bw = 160;
    var bh = 50;
    var bx = Math.floor((VW - bw) / 2);
    var by = VH - 130;
    _doneBtn.x = bx;
    _doneBtn.y = by;
    _doneBtn.w = bw;
    _doneBtn.h = bh;
    _ctx.fillStyle = COLOR_DONE_BG;
    _ctx.beginPath();
    _ctx.roundRect(bx, by, bw, bh, 10);
    _ctx.fill();
    _text('DONE', VW / 2, by + bh / 2, 22, COLOR_WHITE, 'center');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = bestScore || 0;
    _round  = 1;
    _state  = 'MENU';
    _computeGridLayout();
  }

  function update(dt) {
    if (_state === 'MEMORIZE') {
      _memTimer -= dt;
      if (_memTimer <= 0) {
        _memTimer = 0;
        _state    = 'PLAYING';
      }
    }
  }

  function draw() {
    if (!_ctx) { return; }
    _computeGridLayout();

    // Clear
    _fillRect(COLOR_BG, 0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenu();
    } else if (_state === 'MEMORIZE') {
      _drawMemorize();
    } else if (_state === 'PLAYING') {
      _drawPlaying();
    } else if (_state === 'DEAD') {
      _drawDead();
    }
  }

  function _drawMenu() {
    // Background decoration – faint pattern preview
    var pat = PATTERNS[0];
    var previewCS = 16;
    var previewOX = Math.floor((VW - previewCS * GRID_SIZE) / 2);
    var previewOY = Math.floor(VH * 0.28);
    var r, c;
    for (r = 0; r < GRID_SIZE; r++) {
      for (c = 0; c < GRID_SIZE; c++) {
        _ctx.globalAlpha = 0.18;
        _fillRect(pat[r][c] === 1 ? COLOR_FG : '#11112A',
          previewOX + c * previewCS,
          previewOY + r * previewCS,
          previewCS, previewCS);
      }
    }
    _ctx.globalAlpha = 1;

    // Title
    _text('PIXEL', VW / 2, VH * 0.14, 48, COLOR_FG, 'center');
    _text('TRACE', VW / 2, VH * 0.21, 48, COLOR_WHITE, 'center');

    // Divider
    _fillRect(COLOR_FG, VW / 2 - 60, Math.floor(VH * 0.265), 120, 3);

    // Best score
    _text('BEST ACCURACY', VW / 2, VH * 0.56, 16, '#8899AA', 'center');
    _text(_best + '%', VW / 2, VH * 0.62, 40, COLOR_YELLOW, 'center');

    // Tap to play
    _text('TAP TO PLAY', VW / 2, VH * 0.80, 22, COLOR_WHITE, 'center');

    // Subtitle hint
    _text('Memorize & recreate pixel art!', VW / 2, VH * 0.87, 14, '#8899AA', 'center');
  }

  function _drawMemorize() {
    // Header
    _text('MEMORIZE!', VW / 2, VH * 0.10, 30, COLOR_YELLOW, 'center');
    _text('Round ' + _round, VW / 2, VH * 0.17, 18, '#AABBCC', 'center');

    // Pattern preview
    _drawGrid(_target, _gridOffX, _gridOffY, _cellSize, false);

    // Timer bar
    var frac = _memTimer / MEMORIZE_TIME;
    _drawTimerBar(frac < 0 ? 0 : frac > 1 ? 1 : frac);

    // Hint text above bar
    _text('Remember the pattern!', VW / 2, VH - 110, 14, '#8899AA', 'center');
  }

  function _drawPlaying() {
    // Header
    _text('PIXEL TRACE', VW / 2, VH * 0.07, 24, COLOR_FG, 'center');
    _text('Round ' + _round, VW / 2, VH * 0.13, 16, '#AABBCC', 'center');

    // Taps left
    _text('Taps left: ' + _tapsLeft, VW / 2, VH * 0.20, 18, COLOR_ORANGE, 'center');

    // Player grid
    _drawGrid(_player, _gridOffX, _gridOffY, _cellSize, true);

    // Done button
    _drawDoneButton();

    // Hint
    _text('Tap cells to fill them', VW / 2, VH - 60, 13, '#667788', 'center');
  }

  function _drawDead() {
    // Panel
    var pw = 300;
    var ph = 380;
    var px = Math.floor((VW - pw) / 2);
    var py = Math.floor((VH - ph) / 2);
    _ctx.fillStyle = COLOR_PANEL;
    _ctx.beginPath();
    _ctx.roundRect(px, py, pw, ph, 16);
    _ctx.fill();

    // Border
    _ctx.strokeStyle = _isWin ? COLOR_DONE_BG : COLOR_FG;
    _ctx.lineWidth = 3;
    _ctx.beginPath();
    _ctx.roundRect(px, py, pw, ph, 16);
    _ctx.stroke();

    var cx = VW / 2;
    var baseY = py + 40;

    // Round label
    _text('ROUND ' + _round, cx, baseY, 18, '#AABBCC', 'center');

    // Accuracy big number
    _text(_lastAccuracy + '%', cx, baseY + 70, 60, _isWin ? COLOR_DONE_BG : COLOR_FG, 'center');
    _text('ACCURACY', cx, baseY + 115, 14, '#8899AA', 'center');

    // Best
    _text('BEST: ' + _best + '%', cx, baseY + 160, 18, COLOR_YELLOW, 'center');

    // Win/loss message
    var msg = _isWin ? 'GREAT JOB!' : 'KEEP TRYING!';
    _text(msg, cx, baseY + 200, 20, _isWin ? COLOR_DONE_BG : COLOR_ORANGE, 'center');

    // Next action hint
    var hint = _isWin ? 'TAP FOR NEXT ROUND' : 'TAP TO RETRY';
    _text(hint, cx, baseY + 250, 17, COLOR_WHITE, 'center');

    // Pulsing underline
    _fillRect(COLOR_WHITE, cx - 70, baseY + 263, 140, 2);
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _round = 1;
      _startRound();
      return;
    }

    if (_state === 'MEMORIZE') {
      // Allow skipping memorize by tapping
      _memTimer = 0;
      _state    = 'PLAYING';
      return;
    }

    if (_state === 'PLAYING') {
      // Check Done button
      if (x >= _doneBtn.x && x <= _doneBtn.x + _doneBtn.w &&
          y >= _doneBtn.y && y <= _doneBtn.y + _doneBtn.h) {
        _endRound();
        return;
      }

      // Check grid cell hit
      var col = Math.floor((x - _gridOffX) / _cellSize);
      var row = Math.floor((y - _gridOffY) / _cellSize);
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        if (_tapsLeft > 0) {
          _player[row][col] = (_player[row][col] === 1) ? 0 : 1;
          _tapsLeft--;
          try { Audio.play('tap'); } catch(e) {}
          if (_tapsLeft === 0) {
            _endRound();
          }
        }
      }
      return;
    }

    if (_state === 'DEAD') {
      if (_isWin) {
        _round++;
      }
      // Retry keeps the same round
      _startRound();
      return;
    }
  }

  function getBest() {
    return _best;
  }

  // ── Expose public API ──────────────────────────────────────────────────────
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
