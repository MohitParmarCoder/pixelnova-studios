'use strict';
var DotLink = (function () {

  // ── Virtual canvas dimensions ──────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // ── Palette ────────────────────────────────────────────────────────────────
  var COLORS = {
    red:    '#E74C3C',
    blue:   '#3498DB',
    green:  '#2ECC71',
    yellow: '#F1C40F',
    purple: '#9B59B6'
  };
  // Array of color keys for indexed access
  var COLOR_KEYS = ['red', 'blue', 'green', 'yellow', 'purple'];

  // ── Puzzle definitions ─────────────────────────────────────────────────────
  // Each puzzle: { size, dots }
  // dots is array of { color, r, c } pairs (each color appears exactly twice)
  var PUZZLES = [
    // Puzzle 1 – 4×4, 3 pairs (red, blue, green)
    {
      size: 4,
      dots: [
        { color: 'red',   r: 0, c: 0 },
        { color: 'red',   r: 3, c: 3 },
        { color: 'blue',  r: 0, c: 3 },
        { color: 'blue',  r: 3, c: 0 },
        { color: 'green', r: 1, c: 1 },
        { color: 'green', r: 2, c: 2 }
      ]
    },
    // Puzzle 2 – 4×4, 4 pairs (red, blue, green, yellow)
    {
      size: 4,
      dots: [
        { color: 'red',    r: 0, c: 0 },
        { color: 'red',    r: 2, c: 3 },
        { color: 'blue',   r: 0, c: 2 },
        { color: 'blue',   r: 3, c: 1 },
        { color: 'green',  r: 1, c: 0 },
        { color: 'green',  r: 3, c: 3 },
        { color: 'yellow', r: 0, c: 3 },
        { color: 'yellow', r: 3, c: 0 }
      ]
    },
    // Puzzle 3 – 5×5, 4 pairs (red, blue, green, yellow)
    {
      size: 5,
      dots: [
        { color: 'red',    r: 0, c: 0 },
        { color: 'red',    r: 4, c: 4 },
        { color: 'blue',   r: 0, c: 4 },
        { color: 'blue',   r: 4, c: 0 },
        { color: 'green',  r: 1, c: 1 },
        { color: 'green',  r: 3, c: 3 },
        { color: 'yellow', r: 1, c: 3 },
        { color: 'yellow', r: 3, c: 1 }
      ]
    }
  ];

  // ── Module state ───────────────────────────────────────────────────────────
  var _canvas = null;
  var _ctx    = null;
  var _best   = 0;
  var _state  = 'MENU';   // 'MENU' | 'PLAYING' | 'DEAD'
  var _score  = 0;

  // Current puzzle index
  var _puzzleIdx = 0;

  // Grid state for current puzzle
  var _gridSize = 4;        // number of cells per side
  var _dots     = null;     // copy of puzzle dots array
  var _paths    = null;     // { colorKey: [ {r,c}, ... ] }  – completed/in-progress paths
  var _selected = null;     // colorKey currently being drawn, or null

  // Move counter (if > 50 with no completion → DEAD)
  var _moves = 0;

  // Flash timer for error feedback
  var _errorFlash = 0;      // counts down in seconds

  // Solved-celebration timer
  var _solveFlash = 0;

  // ── Grid geometry (computed each puzzle load) ──────────────────────────────
  var _cellSize  = 0;
  var _gridLeft  = 0;
  var _gridTop   = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _colorOf(r, c) {
    // Returns the color key of the dot at (r,c) or null
    for (var i = 0; i < _dots.length; i++) {
      if (_dots[i].r === r && _dots[i].c === c) {
        return _dots[i].color;
      }
    }
    return null;
  }

  function _isDot(r, c) {
    return _colorOf(r, c) !== null;
  }

  function _pathContains(path, r, c) {
    for (var i = 0; i < path.length; i++) {
      if (path[i].r === r && path[i].c === c) { return true; }
    }
    return false;
  }

  // Check if cell (r,c) is the start-dot of a given color
  function _isStartDot(colorKey, r, c) {
    // Convention: dots come in pairs; first occurrence is "start"
    for (var i = 0; i < _dots.length; i++) {
      if (_dots[i].color === colorKey) {
        return _dots[i].r === r && _dots[i].c === c;
      }
    }
    return false;
  }

  // Return both dots for a color: { a: {r,c}, b: {r,c} }
  function _dotsForColor(colorKey) {
    var found = [];
    for (var i = 0; i < _dots.length; i++) {
      if (_dots[i].color === colorKey) { found.push(_dots[i]); }
    }
    return { a: found[0], b: found[1] };
  }

  // Is this cell occupied by ANY completed/in-progress path (other than colorKey)?
  function _cellOccupiedByOther(r, c, excludeColor) {
    for (var k in _paths) {
      if (_paths.hasOwnProperty(k) && k !== excludeColor) {
        if (_pathContains(_paths[k], r, c)) { return true; }
      }
    }
    return false;
  }

  // Is this cell occupied by the current drawing path?
  function _cellInCurrentPath(r, c) {
    if (_selected === null) { return false; }
    return _pathContains(_paths[_selected], r, c);
  }

  // Count total cells covered by all paths
  function _totalCellsCovered() {
    var count = 0;
    for (var k in _paths) {
      if (_paths.hasOwnProperty(k)) { count += _paths[k].length; }
    }
    return count;
  }

  // Check if a path for colorKey is complete (starts and ends at the two dots)
  function _isPathComplete(colorKey) {
    var path = _paths[colorKey];
    if (!path || path.length < 2) { return false; }
    var pair = _dotsForColor(colorKey);
    var first = path[0];
    var last  = path[path.length - 1];
    var matchFwd = (first.r === pair.a.r && first.c === pair.a.c &&
                    last.r  === pair.b.r && last.c  === pair.b.c);
    var matchRev = (first.r === pair.b.r && first.c === pair.b.c &&
                    last.r  === pair.a.r && last.c  === pair.a.c);
    return matchFwd || matchRev;
  }

  // Are all pairs connected AND all cells filled?
  function _isPuzzleSolved() {
    // Every color path must be complete
    var colorKeys = _getColorKeys();
    for (var i = 0; i < colorKeys.length; i++) {
      if (!_isPathComplete(colorKeys[i])) { return false; }
    }
    // All cells covered
    var total = _gridSize * _gridSize;
    return _totalCellsCovered() >= total;
  }

  function _getColorKeys() {
    var seen = {};
    var keys = [];
    for (var i = 0; i < _dots.length; i++) {
      if (!seen[_dots[i].color]) {
        seen[_dots[i].color] = true;
        keys.push(_dots[i].color);
      }
    }
    return keys;
  }

  // Convert virtual pixel coords to grid cell
  function _pixelToCell(x, y) {
    var c = Math.floor((x - _gridLeft) / _cellSize);
    var r = Math.floor((y - _gridTop)  / _cellSize);
    if (r < 0 || r >= _gridSize || c < 0 || c >= _gridSize) { return null; }
    return { r: r, c: c };
  }

  // Center pixel of a cell
  function _cellCenter(r, c) {
    return {
      x: _gridLeft + c * _cellSize + _cellSize / 2,
      y: _gridTop  + r * _cellSize + _cellSize / 2
    };
  }

  // ── Puzzle setup ───────────────────────────────────────────────────────────

  function _loadPuzzle(idx) {
    var puzzle  = PUZZLES[idx];
    _gridSize   = puzzle.size;
    _dots       = puzzle.dots.slice();   // shallow copy good enough
    _paths      = {};
    _selected   = null;
    _moves      = 0;
    _errorFlash = 0;
    _solveFlash = 0;

    // Compute grid geometry – leave room for score text above
    var margin    = 24;
    var topOffset = 80;   // score header height
    var available = Math.min(VW - margin * 2, VH - topOffset - margin * 2);
    _cellSize = Math.floor(available / _gridSize);
    _gridLeft = Math.floor((VW - _cellSize * _gridSize) / 2);
    _gridTop  = topOffset + Math.floor((VH - topOffset - _cellSize * _gridSize) / 2);
  }

  // ── State machine ──────────────────────────────────────────────────────────

  function _startGame() {
    _score     = 0;
    _puzzleIdx = 0;
    _state     = 'PLAYING';
    _loadPuzzle(_puzzleIdx);
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function _nextPuzzle() {
    if (_state !== 'PLAYING') return;
    _score += 1;
    if (_score > _best) { _best = _score; }
    _puzzleIdx = (_puzzleIdx + 1) % PUZZLES.length;
    _loadPuzzle(_puzzleIdx);
  }

  function _die() {
    _state      = 'DEAD';
    _selected   = null;
    _errorFlash = 0;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  // ── Tap logic ──────────────────────────────────────────────────────────────

  function tap(x, y) {
    if (_state === 'MENU') {
      _startGame();
      return;
    }

    if (_state === 'DEAD') {
      // Restart current puzzle
      _state = 'PLAYING';
      _loadPuzzle(_puzzleIdx);
      return;
    }

    // PLAYING
    var cell = _pixelToCell(x, y);
    if (!cell) {
      // Tapped outside grid – deselect
      _selected = null;
      return;
    }

    var r = cell.r;
    var c = cell.c;
    var dotColor = _colorOf(r, c);

    // ── Case 1: tapped a dot ───────────────────────────────────────────────
    if (dotColor !== null) {
      try { Audio.play('tap'); } catch(e) {}

      // If we have a path selected and this dot is the matching endpoint → complete path
      if (_selected !== null && _selected === dotColor) {
        var path = _paths[_selected];
        if (path && path.length > 0) {
          var pair = _dotsForColor(dotColor);
          var last = path[path.length - 1];
          // Last cell must be adjacent to this dot for valid completion
          var dr = Math.abs(last.r - r);
          var dc = Math.abs(last.c - c);
          if (dr + dc === 1) {
            // Add endpoint to path
            path.push({ r: r, c: c });
            _selected = null;
            _moves += 1;
            try { Audio.play('gem'); } catch(e) {}
            if (_isPuzzleSolved()) {
              _solveFlash = 1.2;
              setTimeout(function () { _nextPuzzle(); }, 1200);
            }
            return;
          }
          // Not adjacent – invalid
          try { Audio.play('crash'); } catch(e) {}
          _errorFlash = 0.4;
          return;
        }
      }

      // Start fresh path from this dot
      // Clear any existing path for this color
      _paths[dotColor] = [{ r: r, c: c }];
      _selected = dotColor;
      _moves += 1;

      // Also clear any other path that ran through this dot
      for (var k in _paths) {
        if (_paths.hasOwnProperty(k) && k !== dotColor) {
          var p = _paths[k];
          for (var i = 0; i < p.length; i++) {
            if (p[i].r === r && p[i].c === c) {
              // Truncate path at this position
              _paths[k] = p.slice(0, i);
              break;
            }
          }
        }
      }
      return;
    }

    // ── Case 2: tapped an empty / path cell ───────────────────────────────
    if (_selected === null) { return; }

    var curPath = _paths[_selected];
    if (!curPath) { return; }

    // Check if tapping a cell already in the current path → backtrack
    for (var bi = 0; bi < curPath.length; bi++) {
      if (curPath[bi].r === r && curPath[bi].c === c) {
        // Truncate path here (keep up to and including this cell)
        _paths[_selected] = curPath.slice(0, bi + 1);
        return;
      }
    }

    // Must be adjacent to last cell in path
    var last2 = curPath[curPath.length - 1];
    var dr2 = Math.abs(last2.r - r);
    var dc2 = Math.abs(last2.c - c);
    if (dr2 + dc2 !== 1) {
      // Not adjacent
      try { Audio.play('crash'); } catch(e) {}
      _errorFlash = 0.4;
      return;
    }

    // Check if cell is occupied by another color's path
    if (_cellOccupiedByOther(r, c, _selected)) {
      // Remove the other path that passes through here (it gets interrupted)
      for (var ok in _paths) {
        if (_paths.hasOwnProperty(ok) && ok !== _selected) {
          var op = _paths[ok];
          for (var oi = 0; oi < op.length; oi++) {
            if (op[oi].r === r && op[oi].c === c) {
              _paths[ok] = op.slice(0, oi);
              break;
            }
          }
        }
      }
    }

    // Extend path
    curPath.push({ r: r, c: c });
    _moves += 1;

    // Auto-check puzzle solved (shouldn't happen here since endpoint not reached, but just in case)
    if (_isPuzzleSolved()) {
      _solveFlash = 1.2;
      try { Audio.play('gem'); } catch(e) {}
      setTimeout(function () { _nextPuzzle(); }, 1200);
    }

    // Move limit
    if (_moves > 50 && !_isPuzzleSolved()) {
      _die();
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt) {
    if (_errorFlash > 0) { _errorFlash -= dt; if (_errorFlash < 0) { _errorFlash = 0; } }
    if (_solveFlash > 0) { _solveFlash -= dt; if (_solveFlash < 0) { _solveFlash = 0; } }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function _drawRoundRect(ctx, x, y, w, h, r2) {
    ctx.beginPath();
    ctx.moveTo(x + r2, y);
    ctx.lineTo(x + w - r2, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r2);
    ctx.lineTo(x + w, y + h - r2);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
    ctx.lineTo(x + r2, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r2);
    ctx.lineTo(x, y + r2);
    ctx.quadraticCurveTo(x, y, x + r2, y);
    ctx.closePath();
  }

  function _drawMenu(ctx) {
    // Background
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(0, 0, VW, VH);

    // Decorative glowing dots in background
    var bgDotPositions = [
      { x: 60,  y: 200, color: '#E74C3C', r: 14 },
      { x: 330, y: 180, color: '#3498DB', r: 14 },
      { x: 80,  y: 500, color: '#2ECC71', r: 14 },
      { x: 310, y: 520, color: '#F1C40F', r: 14 },
      { x: 195, y: 620, color: '#9B59B6', r: 14 },
      { x: 60,  y: 340, color: '#3498DB', r: 10 },
      { x: 330, y: 360, color: '#E74C3C', r: 10 },
      { x: 195, y: 150, color: '#F1C40F', r: 10 }
    ];
    for (var bi = 0; bi < bgDotPositions.length; bi++) {
      var bd = bgDotPositions[bi];
      ctx.save();
      ctx.shadowBlur  = 24;
      ctx.shadowColor = bd.color;
      ctx.fillStyle   = bd.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(bd.x, bd.y, bd.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Title
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 58px Arial, sans-serif';
    ctx.shadowBlur   = 30;
    ctx.shadowColor  = '#3498DB';
    ctx.fillStyle    = '#FFFFFF';
    ctx.fillText('DOT LINK', VW / 2, VH / 2 - 90);
    ctx.restore();

    // Subtitle decoration: a mini row of colored dots
    var dotColors = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6'];
    var dotSpacing = 44;
    var dotStartX = VW / 2 - (dotColors.length - 1) * dotSpacing / 2;
    for (var di = 0; di < dotColors.length; di++) {
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = dotColors[di];
      ctx.fillStyle   = dotColors[di];
      ctx.beginPath();
      ctx.arc(dotStartX + di * dotSpacing, VH / 2 - 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // TAP TO PLAY
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 26px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.75)';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
    ctx.restore();

    // Best score
    if (_best > 0) {
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '20px Arial, sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.5)';
      ctx.fillText('BEST: ' + _best, VW / 2, VH / 2 + 110);
      ctx.restore();
    }
  }

  function _drawPlaying(ctx) {
    // Background
    ctx.fillStyle = '#0D0D1A';
    ctx.fillRect(0, 0, VW, VH);

    // Error flash tint
    if (_errorFlash > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(231,76,60,' + (_errorFlash * 0.4) + ')';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }

    // Solve flash tint
    if (_solveFlash > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(46,204,113,' + (_solveFlash * 0.3) + ')';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }

    // Score header
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 22px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.85)';
    ctx.fillText('PUZZLE ' + (_puzzleIdx + 1), VW / 2, 36);
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = '18px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.6)';
    ctx.fillText('SCORE: ' + _score, 20, 36);
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.font         = '18px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.6)';
    ctx.fillText('BEST: ' + _best, VW - 20, 36);
    ctx.restore();

    // Grid background
    var gridW = _cellSize * _gridSize;
    var gridH = _cellSize * _gridSize;
    ctx.save();
    ctx.fillStyle   = 'rgba(255,255,255,0.04)';
    _drawRoundRect(ctx, _gridLeft - 4, _gridTop - 4, gridW + 8, gridH + 8, 10);
    ctx.fill();
    ctx.restore();

    // Grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 1;
    for (var row = 0; row <= _gridSize; row++) {
      ctx.beginPath();
      ctx.moveTo(_gridLeft,          _gridTop + row * _cellSize);
      ctx.lineTo(_gridLeft + gridW,  _gridTop + row * _cellSize);
      ctx.stroke();
    }
    for (var col = 0; col <= _gridSize; col++) {
      ctx.beginPath();
      ctx.moveTo(_gridLeft + col * _cellSize, _gridTop);
      ctx.lineTo(_gridLeft + col * _cellSize, _gridTop + gridH);
      ctx.stroke();
    }
    ctx.restore();

    // Draw paths (colored fill segments)
    for (var colorKey in _paths) {
      if (!_paths.hasOwnProperty(colorKey)) { continue; }
      var path = _paths[colorKey];
      if (!path || path.length < 1) { continue; }
      var hexColor = COLORS[colorKey];
      var isSelected = (_selected === colorKey);
      var pad = isSelected ? _cellSize * 0.28 : _cellSize * 0.32;

      // Draw filled squares for each non-endpoint cell
      for (var pi = 0; pi < path.length; pi++) {
        var pr = path[pi].r;
        var pc = path[pi].c;
        var isDotCell = _isDot(pr, pc);
        if (isDotCell) { continue; }   // dots drawn separately
        var px = _gridLeft + pc * _cellSize + pad;
        var py = _gridTop  + pr * _cellSize + pad;
        var pw = _cellSize - pad * 2;
        ctx.save();
        ctx.fillStyle   = hexColor;
        ctx.globalAlpha = isSelected ? 0.85 : 0.65;
        _drawRoundRect(ctx, px, py, pw, pw, pw * 0.35);
        ctx.fill();
        ctx.restore();
      }

      // Draw connecting line through centers
      if (path.length >= 2) {
        ctx.save();
        ctx.strokeStyle = hexColor;
        ctx.lineWidth   = _cellSize * 0.28;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.globalAlpha = isSelected ? 0.9 : 0.7;
        ctx.shadowBlur  = isSelected ? 12 : 6;
        ctx.shadowColor = hexColor;
        ctx.beginPath();
        for (var li = 0; li < path.length; li++) {
          var lc2 = _cellCenter(path[li].r, path[li].c);
          if (li === 0) { ctx.moveTo(lc2.x, lc2.y); }
          else          { ctx.lineTo(lc2.x, lc2.y); }
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw dots (endpoints) on top
    for (var di2 = 0; di2 < _dots.length; di2++) {
      var dot      = _dots[di2];
      var dColor   = COLORS[dot.color];
      var dCenter  = _cellCenter(dot.r, dot.c);
      var dRadius  = _cellSize * 0.30;
      var isSelDot = (_selected === dot.color);
      ctx.save();
      ctx.shadowBlur  = isSelDot ? 22 : 12;
      ctx.shadowColor = dColor;
      ctx.fillStyle   = dColor;
      ctx.beginPath();
      ctx.arc(dCenter.x, dCenter.y, dRadius, 0, Math.PI * 2);
      ctx.fill();
      // White inner ring
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
      ctx.restore();

      // Pulsing ring for selected color
      if (isSelDot) {
        ctx.save();
        ctx.strokeStyle = dColor;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(dCenter.x, dCenter.y, dRadius * 1.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Move counter hint
    var movesLeft = 50 - _moves;
    if (movesLeft <= 15 && movesLeft > 0) {
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '16px Arial, sans-serif';
      ctx.fillStyle    = movesLeft <= 5 ? '#E74C3C' : 'rgba(255,255,255,0.45)';
      ctx.fillText('MOVES LEFT: ' + movesLeft, VW / 2, _gridTop + gridH + 28);
      ctx.restore();
    }
  }

  function _drawDead(ctx) {
    // Dim background
    _drawPlaying(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Card
    var cardW = 280;
    var cardH = 220;
    var cardX = (VW - cardW) / 2;
    var cardY = (VH - cardH) / 2;
    ctx.save();
    ctx.fillStyle = '#1A1A2E';
    _drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.font        = 'bold 34px Arial, sans-serif';
    ctx.fillStyle   = '#E74C3C';
    ctx.shadowBlur  = 16;
    ctx.shadowColor = '#E74C3C';
    ctx.fillText('NO MOVES', VW / 2, cardY + 55);

    ctx.shadowBlur = 0;
    ctx.font       = '20px Arial, sans-serif';
    ctx.fillStyle  = 'rgba(255,255,255,0.8)';
    ctx.fillText('SCORE: ' + _score, VW / 2, cardY + 105);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = '18px Arial, sans-serif';
    ctx.fillText('BEST:  ' + _best, VW / 2, cardY + 138);

    ctx.font      = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = '#3498DB';
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#3498DB';
    ctx.fillText('TAP TO RETRY', VW / 2, cardY + 185);

    ctx.restore();
  }

  function draw() {
    if (!_ctx) { return; }
    var ctx = _ctx;

    if (_state === 'MENU') {
      _drawMenu(ctx);
    } else if (_state === 'PLAYING') {
      _drawPlaying(ctx);
    } else if (_state === 'DEAD') {
      _drawDead(ctx);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = bestScore || 0;
    _state  = 'MENU';
    _score  = 0;
    _puzzleIdx = 0;
    _paths  = {};
    _selected = null;
    _moves  = 0;
    _errorFlash = 0;
    _solveFlash = 0;
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
