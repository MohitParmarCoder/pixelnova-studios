'use strict';

var ColorFlood = (function () {

  /* ── Constants ─────────────────────────────────────────────── */
  var VW = 390;
  var VH = 844;
  var COLS = 12;
  var ROWS = 12;
  var MAX_MOVES = 25;
  var NUM_COLORS = 6;
  var COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];

  /* Layout */
  var GRID_MARGIN_X = 20;
  var GRID_TOP = 120;
  var CELL_SIZE = Math.floor((VW - GRID_MARGIN_X * 2) / COLS);  /* ≈29 */
  var GRID_W = CELL_SIZE * COLS;
  var GRID_H = CELL_SIZE * ROWS;
  var GRID_X = Math.floor((VW - GRID_W) / 2);

  var BTN_AREA_Y = GRID_TOP + GRID_H + 28;
  var BTN_R = 26;
  var BTN_SPACING = Math.floor((VW - 2 * GRID_MARGIN_X) / NUM_COLORS);

  /* ── State ─────────────────────────────────────────────────── */
  var _canvas = null;
  var _ctx = null;
  var _state = 'MENU';
  var _best = 0;

  /* Grid: flat array [row*COLS+col] = color index 0-5 */
  var _grid = [];
  /* Territory: same indexing, boolean */
  var _terr = [];

  var _movesLeft = 0;
  var _score = 0;

  /* animation pulse for territory border */
  var _pulse = 0;

  /* ── Internal helpers ──────────────────────────────────────── */
  function _randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function _idx(r, c) {
    return r * COLS + c;
  }

  function _newGrid() {
    var g = [];
    var i;
    for (i = 0; i < ROWS * COLS; i++) {
      g.push(_randInt(NUM_COLORS));
    }
    return g;
  }

  /* Build initial territory: BFS from (0,0) collecting same-color cells */
  function _initTerritory() {
    var t = [];
    var i;
    for (i = 0; i < ROWS * COLS; i++) {
      t.push(false);
    }
    var startColor = _grid[_idx(0, 0)];
    var queue = [_idx(0, 0)];
    t[_idx(0, 0)] = true;
    var qi = 0;
    while (qi < queue.length) {
      var cur = queue[qi];
      qi++;
      var r = Math.floor(cur / COLS);
      var c = cur % COLS;
      var neighbors = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
      ];
      var n;
      for (n = 0; n < neighbors.length; n++) {
        var nr = neighbors[n][0];
        var nc = neighbors[n][1];
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          var ni = _idx(nr, nc);
          if (!t[ni] && _grid[ni] === startColor) {
            t[ni] = true;
            queue.push(ni);
          }
        }
      }
    }
    return t;
  }

  /* Flood-fill: change territory to newColor, expand into adjacent matching cells */
  function _floodFill(newColorIdx) {
    var i;
    /* Change all territory cells to new color */
    for (i = 0; i < ROWS * COLS; i++) {
      if (_terr[i]) {
        _grid[i] = newColorIdx;
      }
    }
    /* BFS expansion: any neighbor of territory that matches newColor */
    var changed = true;
    while (changed) {
      changed = false;
      for (i = 0; i < ROWS * COLS; i++) {
        if (_terr[i]) {
          continue;
        }
        if (_grid[i] !== newColorIdx) {
          continue;
        }
        /* check if any neighbor is territory */
        var r = Math.floor(i / COLS);
        var c = i % COLS;
        var neighbors = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
        ];
        var n;
        var isAdj = false;
        for (n = 0; n < neighbors.length; n++) {
          var nr = neighbors[n][0];
          var nc = neighbors[n][1];
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (_terr[_idx(nr, nc)]) {
              isAdj = true;
              break;
            }
          }
        }
        if (isAdj) {
          _terr[i] = true;
          changed = true;
        }
      }
    }
  }

  function _isComplete() {
    var i;
    for (i = 0; i < ROWS * COLS; i++) {
      if (!_terr[i]) {
        return false;
      }
    }
    return true;
  }

  function _startGame() {
    _grid = _newGrid();
    _terr = _initTerritory();
    _movesLeft = MAX_MOVES;
    _state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  /* ── Public API ────────────────────────────────────────────── */
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    _score = 0;
    _state = 'MENU';
    /* pre-build a sample grid for the menu */
    _grid = _newGrid();
    _terr = _initTerritory();
    _movesLeft = MAX_MOVES;
  }

  function update(dt) {
    _pulse += dt * 3;
    if (_pulse > Math.PI * 2) {
      _pulse -= Math.PI * 2;
    }
  }

  /* ── Drawing helpers ───────────────────────────────────────── */
  function _drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function _drawGrid(ctx, alpha) {
    var borderPulse = 0.55 + 0.35 * Math.sin(_pulse);
    var i, r, c, ci, x, y;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        i = _idx(r, c);
        ci = _grid[i];
        x = GRID_X + c * CELL_SIZE;
        y = GRID_TOP + r * CELL_SIZE;

        /* cell fill */
        ctx.globalAlpha = alpha !== undefined ? alpha : 1;
        ctx.fillStyle = COLORS[ci];
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        /* grid line */
        ctx.globalAlpha = (alpha !== undefined ? alpha : 1) * 0.18;
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, CELL_SIZE, 1);
        ctx.fillRect(x, y, 1, CELL_SIZE);
      }
    }

    /* territory highlight */
    if (_state === 'PLAYING') {
      ctx.globalAlpha = borderPulse;
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          i = _idx(r, c);
          if (!_terr[i]) {
            continue;
          }
          x = GRID_X + c * CELL_SIZE;
          y = GRID_TOP + r * CELL_SIZE;
          /* Draw bright border only on edges that face non-territory */
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 2;
          /* top */
          if (r === 0 || !_terr[_idx(r - 1, c)]) {
            ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + CELL_SIZE, y + 1); ctx.stroke();
          }
          /* bottom */
          if (r === ROWS - 1 || !_terr[_idx(r + 1, c)]) {
            ctx.beginPath(); ctx.moveTo(x, y + CELL_SIZE - 1); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE - 1); ctx.stroke();
          }
          /* left */
          if (c === 0 || !_terr[_idx(r, c - 1)]) {
            ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + CELL_SIZE); ctx.stroke();
          }
          /* right */
          if (c === COLS - 1 || !_terr[_idx(r, c + 1)]) {
            ctx.beginPath(); ctx.moveTo(x + CELL_SIZE - 1, y); ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE); ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function _drawColorButtons(ctx) {
    var i, cx, cy;
    for (i = 0; i < NUM_COLORS; i++) {
      cx = GRID_MARGIN_X + BTN_SPACING * i + Math.floor(BTN_SPACING / 2);
      cy = BTN_AREA_Y + BTN_R;

      /* shadow */
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;

      /* circle fill */
      ctx.fillStyle = COLORS[i];
      ctx.beginPath();
      ctx.arc(cx, cy, BTN_R, 0, Math.PI * 2);
      ctx.fill();

      /* white ring outline */
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function _drawHUD(ctx) {
    /* moves bar background */
    var barX = GRID_X;
    var barY = 72;
    var barW = GRID_W;
    var barH = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    _drawRoundRect(ctx, barX, barY, barW, barH, 9);
    ctx.fill();

    /* moves bar fill */
    var frac = _movesLeft / MAX_MOVES;
    var fillW = Math.floor(barW * frac);
    var barColor;
    if (frac > 0.5) {
      barColor = '#2ECC71';
    } else if (frac > 0.25) {
      barColor = '#F39C12';
    } else {
      barColor = '#E74C3C';
    }
    if (fillW > 18) {
      ctx.fillStyle = barColor;
      _drawRoundRect(ctx, barX, barY, fillW, barH, 9);
      ctx.fill();
    }

    /* moves text */
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOVES: ' + _movesLeft + ' / ' + MAX_MOVES, VW / 2, barY + barH / 2);

    /* score */
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFE066';
    ctx.fillText('SCORE: ' + _score, GRID_X, 52);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('BEST: ' + _best, GRID_X + GRID_W, 52);
  }

  function _drawMenuBg(ctx) {
    /* gradient background */
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    /* decorative color swatches across top */
    var sw = VW / NUM_COLORS;
    var si;
    for (si = 0; si < NUM_COLORS; si++) {
      ctx.fillStyle = COLORS[si];
      ctx.globalAlpha = 0.18;
      ctx.fillRect(si * sw, 0, sw, VH);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!_ctx) {
      return;
    }
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenuBg(ctx);

      /* sample grid (faded) */
      _drawGrid(ctx, 0.35);

      /* title */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 18;

      ctx.font = 'bold 52px Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('COLOR', VW / 2, VH * 0.22);
      ctx.fillText('FLOOD', VW / 2, VH * 0.22 + 58);

      ctx.shadowBlur = 0;

      /* color stripe under title */
      var stripeY = VH * 0.22 + 86;
      var sw2 = 40;
      var totalW = sw2 * NUM_COLORS + 8 * (NUM_COLORS - 1);
      var startX = (VW - totalW) / 2;
      var si2;
      for (si2 = 0; si2 < NUM_COLORS; si2++) {
        ctx.fillStyle = COLORS[si2];
        ctx.beginPath();
        ctx.arc(startX + si2 * (sw2 + 8) + sw2 / 2, stripeY, sw2 / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* best score */
      if (_best > 0) {
        ctx.font = '18px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('BEST: ' + _best, VW / 2, stripeY + 52);
      }

      /* tap to play */
      var tapAlpha = 0.55 + 0.45 * Math.sin(_pulse);
      ctx.globalAlpha = tapAlpha;
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#FFE066';
      ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.78);
      ctx.globalAlpha = 1;

      /* instructions */
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('Capture the whole grid in ' + MAX_MOVES + ' moves', VW / 2, VH * 0.84);

    } else if (_state === 'PLAYING') {
      /* background */
      var bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, '#1a1a2e');
      bg.addColorStop(1, '#0f3460');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VW, VH);

      _drawGrid(ctx, 1);
      _drawHUD(ctx);
      _drawColorButtons(ctx);

      /* label */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText('CHOOSE COLOR', VW / 2, BTN_AREA_Y + BTN_R * 2 + 16);

    } else if (_state === 'DEAD') {
      /* background with grid visible */
      var bg2 = ctx.createLinearGradient(0, 0, 0, VH);
      bg2.addColorStop(0, '#1a1a2e');
      bg2.addColorStop(1, '#0f3460');
      ctx.fillStyle = bg2;
      ctx.fillRect(0, 0, VW, VH);

      _drawGrid(ctx, 0.5);
      _drawColorButtons(ctx);

      /* dark overlay */
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, VW, VH);

      /* panel */
      var panX = 40;
      var panY = VH / 2 - 140;
      var panW = VW - 80;
      var panH = 280;
      ctx.fillStyle = 'rgba(22,33,62,0.97)';
      _drawRoundRect(ctx, panX, panY, panW, panH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      _drawRoundRect(ctx, panX, panY, panW, panH, 20);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var cx2 = VW / 2;

      /* GAME OVER */
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillStyle = '#E74C3C';
      ctx.shadowColor = '#E74C3C';
      ctx.shadowBlur = 14;
      ctx.fillText('GAME OVER', cx2, panY + 52);
      ctx.shadowBlur = 0;

      /* score */
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#FFE066';
      ctx.fillText('Score: ' + _score, cx2, panY + 106);

      /* best */
      ctx.font = '17px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText('Best: ' + _best, cx2, panY + 142);

      /* tap to retry */
      var tapAlpha2 = 0.6 + 0.4 * Math.sin(_pulse);
      ctx.globalAlpha = tapAlpha2;
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('TAP TO RETRY', cx2, panY + 196);
      ctx.globalAlpha = 1;

      /* color dots decoration */
      var di;
      for (di = 0; di < NUM_COLORS; di++) {
        ctx.fillStyle = COLORS[di];
        ctx.beginPath();
        ctx.arc(panX + 30 + di * ((panW - 60) / (NUM_COLORS - 1)), panY + 248, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _score = 0;
      _startGame();
      return;
    }

    if (_state === 'DEAD') {
      _score = 0;
      _startGame();
      return;
    }

    if (_state === 'PLAYING') {
      /* Check color button taps */
      var i, cx, cy, dx, dy;
      for (i = 0; i < NUM_COLORS; i++) {
        cx = GRID_MARGIN_X + BTN_SPACING * i + Math.floor(BTN_SPACING / 2);
        cy = BTN_AREA_Y + BTN_R;
        dx = x - cx;
        dy = y - cy;
        if (dx * dx + dy * dy <= (BTN_R + 8) * (BTN_R + 8)) {
          /* tapped color i */
          try { Audio.play('tap'); } catch (e) {}
          _floodFill(i);
          _movesLeft--;

          if (_isComplete()) {
            _score++;
            if (_score > _best) {
              _best = _score;
            }
            try { Audio.play('gem'); } catch (e) {}
            /* Start a fresh board, keep score */
            _grid = _newGrid();
            _terr = _initTerritory();
            _movesLeft = MAX_MOVES;
          } else if (_movesLeft <= 0) {
            try { Audio.play('lose'); } catch (e) {}
            try { AdManager.gameplayStop(); } catch (e) {}
            try { AdManager.onRunEnd(); } catch (e) {}
            _state = 'DEAD';
          }
          return;
        }
      }
    }
  }

  function getBest() {
    return _best;
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };

})();
