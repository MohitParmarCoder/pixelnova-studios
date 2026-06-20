'use strict';
/* ============================================================
   Color Flood -> Slide Puzzle  (15-puzzle)
   Virtual canvas: 390 x 844
   Namespace: ColorFlood
   ============================================================ */
var ColorFlood = (function () {

  var VW = 390, VH = 844;

  /* ── Grid constants ─────────────────────────────────────────── */
  var GRID_SIZE  = 4;          /* 4x4 = 16 cells, tile 1-15 + blank */
  var TILE_SIZE  = 80;
  var TILE_GAP   = 6;
  var GRID_W     = GRID_SIZE * TILE_SIZE + (GRID_SIZE - 1) * TILE_GAP;
  var GRID_X     = Math.floor((VW - GRID_W) / 2);
  var GRID_Y     = 180;
  var CORNER_R   = 10;
  var MAX_MOVES  = 200;

  /* ── State ──────────────────────────────────────────────────── */
  var _canvas, _ctx;
  var _state;   /* 'MENU' | 'PLAYING' | 'DEAD' */
  var _best;
  var _score, _lives, _moves, _round;
  var _pulseT;

  /* tiles[i] = value 0..15, where 0 = blank */
  /* index 0 = top-left, index 15 = bottom-right */
  var _tiles;

  /* win animation */
  var _winTimer;
  var _winAnim;   /* 0..1 */

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _snd(name) {
    try { Audio.play(name); } catch (e) {}
  }

  function _randInt(n) {
    return Math.floor(Math.random() * n);
  }

  /* Returns index of blank tile (value 0) */
  function _blankIdx() {
    var i;
    for (i = 0; i < 16; i++) {
      if (_tiles[i] === 0) return i;
    }
    return -1;
  }

  /* Check whether puzzle is solved: tiles[i] === i+1 for 0..14, tiles[15]===0 */
  function _isSolved() {
    var i;
    for (i = 0; i < 15; i++) {
      if (_tiles[i] !== i + 1) return false;
    }
    return _tiles[15] === 0;
  }

  /* Generate a solvable shuffle by doing 200 random valid slides from solved */
  function _makeSolvable() {
    var t = [], i, tmp;
    for (i = 0; i < 15; i++) t.push(i + 1);
    t.push(0);

    var lastMoved = -1;
    var n = 200;
    while (n > 0) {
      var blank = -1;
      for (i = 0; i < 16; i++) {
        if (t[i] === 0) { blank = i; break; }
      }
      var br = Math.floor(blank / GRID_SIZE);
      var bc = blank % GRID_SIZE;
      var nbrs = [];
      if (br > 0) nbrs.push(blank - GRID_SIZE);
      if (br < GRID_SIZE - 1) nbrs.push(blank + GRID_SIZE);
      if (bc > 0) nbrs.push(blank - 1);
      if (bc < GRID_SIZE - 1) nbrs.push(blank + 1);
      var candidates = [];
      var j;
      for (j = 0; j < nbrs.length; j++) {
        if (nbrs[j] !== lastMoved) candidates.push(nbrs[j]);
      }
      if (candidates.length === 0) candidates = nbrs;
      var pick = candidates[_randInt(candidates.length)];
      lastMoved = blank;
      tmp = t[blank];
      t[blank] = t[pick];
      t[pick] = tmp;
      n--;
    }
    return t;
  }

  /* Start a new puzzle round */
  function _newPuzzle() {
    _tiles    = _makeSolvable();
    _moves    = 0;
    _winTimer = -1;
    _winAnim  = 0;
  }

  /* Convert canvas tap to tile index; returns -1 if outside grid */
  function _tapToTile(tapX, tapY) {
    var lx = tapX - GRID_X;
    var ly = tapY - GRID_Y;
    if (lx < 0 || ly < 0) return -1;
    var col = Math.floor(lx / (TILE_SIZE + TILE_GAP));
    var row = Math.floor(ly / (TILE_SIZE + TILE_GAP));
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return -1;
    var cx = col * (TILE_SIZE + TILE_GAP);
    var cy = row * (TILE_SIZE + TILE_GAP);
    if (lx > cx + TILE_SIZE || ly > cy + TILE_SIZE) return -1;
    return row * GRID_SIZE + col;
  }

  /* Try to slide tile at index idx; returns true if legal move */
  function _slideIfAdjacent(idx) {
    var blank = _blankIdx();
    var br = Math.floor(blank / GRID_SIZE), bc = blank % GRID_SIZE;
    var tr = Math.floor(idx   / GRID_SIZE), tc = idx   % GRID_SIZE;
    var dr = Math.abs(br - tr), dc = Math.abs(bc - tc);
    if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;
    var tmp = _tiles[blank];
    _tiles[blank] = _tiles[idx];
    _tiles[idx]   = tmp;
    return true;
  }

  /* ── Public: init ────────────────────────────────────────────── */
  function init(canvas, bestScore) {
    _canvas  = canvas;
    _ctx     = canvas.getContext('2d');
    _best    = bestScore || 0;
    _state   = 'MENU';
    _pulseT  = 0;
    _score   = 0;
    _lives   = 3;
    _round   = 0;
    _newPuzzle();
  }

  /* ── Public: tap ─────────────────────────────────────────────── */
  function tap(tapX, tapY) {
    if (_state === 'MENU') {
      _startGame();
      return;
    }
    if (_state === 'DEAD') {
      init(_canvas, _best);
      return;
    }
    if (_state === 'PLAYING') {
      if (_winTimer >= 0) return;

      var tidx = _tapToTile(tapX, tapY);
      if (tidx < 0) return;
      if (_tiles[tidx] === 0) return;

      if (_slideIfAdjacent(tidx)) {
        _snd('tap');
        _moves++;

        if (_isSolved()) {
          var gained = Math.max(0, MAX_MOVES - _moves);
          _score += gained;
          if (_score > _best) _best = _score;
          _snd('gem');
          _winTimer = 0;
          _winAnim  = 0;
          _round++;
        } else if (_moves >= MAX_MOVES) {
          _snd('lose');
          _lives--;
          if (_lives <= 0) {
            _endGame();
          } else {
            _newPuzzle();
          }
        }
      }
    }
  }

  function _startGame() {
    _score = 0;
    _lives = 3;
    _round = 0;
    _newPuzzle();
    try { AdManager.gameplayStart(); } catch (e) {}
    _state = 'PLAYING';
  }

  function _endGame() {
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd();     } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score, 'colorflood_best'); } catch(e) {}
    _state = 'DEAD';
  }

  /* ── Public: update ──────────────────────────────────────────── */
  function update(dt) {
    _pulseT += dt;

    if (_state === 'PLAYING' && _winTimer >= 0) {
      _winTimer += dt;
      _winAnim = Math.min(1, _winTimer / 0.8);
      if (_winTimer > 1.0) {
        _winTimer = -1;
        _newPuzzle();
      }
    }
  }

  /* ── Public: draw ────────────────────────────────────────────── */
  function draw() {
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#0d1b2a');
    bg.addColorStop(1, '#1a2f4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenu(ctx);
    } else if (_state === 'PLAYING') {
      _drawGame(ctx);
    } else {
      _drawGame(ctx);
      _drawDead(ctx);
    }
  }

  function _drawMenu(ctx) {
    _text(ctx, 'SLIDE PUZZLE', VW / 2, 200, 44, '#FFD700', 'center', '#FFA500');
    _text(ctx, '15-Puzzle Classic', VW / 2, 260, 22, '#aaaaff', 'center');
    _text(ctx, 'Tap tiles to slide', VW / 2, 340, 20, '#cccccc', 'center');
    _text(ctx, 'Arrange 1-15 in order', VW / 2, 375, 20, '#cccccc', 'center');
    _text(ctx, 'Max ' + MAX_MOVES + ' moves per puzzle', VW / 2, 410, 20, '#ffaa44', 'center');

    var px = VW / 2 - 100, py = 460, ps = 44, pg = 4;
    var k, pr, pc, val, mx, my;
    for (k = 0; k < 16; k++) {
      pr  = Math.floor(k / GRID_SIZE);
      pc  = k % GRID_SIZE;
      val = k < 15 ? k + 1 : 0;
      mx  = px + pc * (ps + pg);
      my  = py + pr * (ps + pg);
      ctx.fillStyle = val === 0 ? '#0d1b2a' : '#2a4a7a';
      _fillRoundRect(ctx, mx, my, ps, ps, 6);
      if (val > 0) {
        _text(ctx, '' + val, mx + ps / 2, my + ps / 2, 14, '#ffffff', 'center');
      }
    }

    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO PLAY', VW / 2, 680, 28, '#00FF88', 'center', '#00FF88');
    ctx.globalAlpha = 1;

    if (_best > 0) {
      _text(ctx, 'BEST: ' + _best, VW / 2, 730, 20, '#FFDD44', 'center', '#FFAA00');
    }
  }

  function _drawGame(ctx) {
    _text(ctx, 'SLIDE PUZZLE', VW / 2, 50, 28, '#FFD700', 'center', '#FFA500');
    _text(ctx, 'Score: ' + _score, 20, 90, 20, '#ffffff', 'left');
    _text(ctx, 'Moves: ' + _moves + '/' + MAX_MOVES, VW / 2, 90, 20, '#ffffff', 'center');
    _drawLives(ctx, VW - 20, 90);

    var winGlow = (_winTimer >= 0) ? _winAnim : 0;
    var i, row, col, tx, ty, val, isInOrder, tileColor, numSize;
    for (i = 0; i < 16; i++) {
      row = Math.floor(i / GRID_SIZE);
      col = i % GRID_SIZE;
      tx  = GRID_X + col * (TILE_SIZE + TILE_GAP);
      ty  = GRID_Y + row * (TILE_SIZE + TILE_GAP);
      val = _tiles[i];

      if (val === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        _fillRoundRect(ctx, tx, ty, TILE_SIZE, TILE_SIZE, CORNER_R);
      } else {
        isInOrder = (val === i + 1);
        tileColor = (isInOrder || winGlow > 0) ? '#2ecc71' : '#2a4a7a';
        ctx.shadowColor = winGlow > 0 ? '#00FF88' : (isInOrder ? '#00cc55' : '#5599cc');
        ctx.shadowBlur  = winGlow > 0 ? 20 * winGlow : (isInOrder ? 8 : 4);
        ctx.fillStyle = tileColor;
        _fillRoundRect(ctx, tx, ty, TILE_SIZE, TILE_SIZE, CORNER_R);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = isInOrder ? '#00ff88' : '#4477aa';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(tx + CORNER_R, ty);
        ctx.arcTo(tx + TILE_SIZE, ty,     tx + TILE_SIZE, ty + TILE_SIZE, CORNER_R);
        ctx.arcTo(tx + TILE_SIZE, ty + TILE_SIZE, tx, ty + TILE_SIZE, CORNER_R);
        ctx.arcTo(tx, ty + TILE_SIZE, tx, ty, CORNER_R);
        ctx.arcTo(tx, ty, tx + TILE_SIZE, ty, CORNER_R);
        ctx.closePath();
        ctx.stroke();

        numSize = val >= 10 ? 28 : 34;
        _text(ctx, '' + val, tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, numSize, '#ffffff', 'center');
      }
    }

    if (_winTimer >= 0) {
      ctx.globalAlpha = Math.min(1, _winAnim * 2);
      _text(ctx, 'SOLVED!', VW / 2, GRID_Y + GRID_W / 2 + 20, 48, '#00FF88', 'center', '#00FF88');
      _text(ctx, '+' + Math.max(0, MAX_MOVES - _moves) + ' pts', VW / 2, GRID_Y + GRID_W / 2 + 80, 28, '#FFD700', 'center', '#FFA500');
      ctx.globalAlpha = 1;
    }

    var barW = VW - 40;
    var barH = 12;
    var barX = 20, barY = VH - 60;
    var frac = 1 - Math.min(1, _moves / MAX_MOVES);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    _fillRoundRect(ctx, barX, barY, barW, barH, 6);
    var barColor = frac > 0.5 ? '#00DD44' : (frac > 0.2 ? '#FFAA00' : '#FF4444');
    ctx.fillStyle = barColor;
    _fillRoundRect(ctx, barX, barY, Math.max(0, barW * frac), barH, 6);
    _text(ctx, 'Moves left', VW / 2, VH - 35, 14, '#aaaaaa', 'center');
  }

  function _drawDead(ctx) {
    ctx.fillStyle = 'rgba(5, 10, 20, 0.80)';
    ctx.fillRect(0, 0, VW, VH);

    _text(ctx, 'GAME OVER', VW / 2, 330, 48, '#FF3366', 'center', '#FF3366');
    _text(ctx, 'Score: ' + _score, VW / 2, 410, 30, '#ffffff', 'center');
    _text(ctx, 'Best:  ' + _best,  VW / 2, 456, 22, '#FFDD44', 'center', '#FFAA00');

    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 28, '#44CCFF', 'center', '#44CCFF');
    ctx.globalAlpha = 1;
  }

  function _drawLives(ctx, rightX, y) {
    var i;
    for (i = 0; i < 3; i++) {
      var hx = rightX - (3 - i) * 28;
      ctx.font         = '22px Arial';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = i < _lives ? '#FF4466' : '#444466';
      ctx.fillText(i < _lives ? '♥' : '♡', hx, y);
    }
  }

  function _fillRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }

  function _text(ctx, str, x, y, size, color, align, glow) {
    ctx.font         = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign    = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = color;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 16;
    }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function getBest() {
    return _best;
  }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
