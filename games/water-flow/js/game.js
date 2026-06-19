'use strict';

/* ============================================================
   Water Flow — Pipe Puzzle
   Virtual canvas: 390 × 844
   Exposed global: WaterFlow
   ============================================================ */
var WaterFlow = (function () {

  var VW = 390, VH = 844;

  /* ---- pipe type constants ---- */
  var PIPE_H   = 'H';   // straight horizontal: opens E, W
  var PIPE_V   = 'V';   // straight vertical:   opens N, S
  var PIPE_NE  = 'NE';  // corner: opens N, E
  var PIPE_ES  = 'ES';  // corner: opens E, S
  var PIPE_SW  = 'SW';  // corner: opens S, W
  var PIPE_WN  = 'WN';  // corner: opens W, N
  var PIPE_T0  = 'T0';  // T-junction: opens N, E, W  (missing S)
  var PIPE_T1  = 'T1';  // T-junction: opens N, E, S  (missing W)
  var PIPE_T2  = 'T2';  // T-junction: opens E, S, W  (missing N)
  var PIPE_T3  = 'T3';  // T-junction: opens N, S, W  (missing E)
  var PIPE_X   = 'X';   // cross: opens all 4

  /*
   * Pipe openings: N=0, E=1, S=2, W=3
   * Returns an object with boolean flags {n, e, s, w}
   */
  function getOpenings(type) {
    if (type === PIPE_H)  return { n: false, e: true,  s: false, w: true  };
    if (type === PIPE_V)  return { n: true,  e: false, s: true,  w: false };
    if (type === PIPE_NE) return { n: true,  e: true,  s: false, w: false };
    if (type === PIPE_ES) return { n: false, e: true,  s: true,  w: false };
    if (type === PIPE_SW) return { n: false, e: false, s: true,  w: true  };
    if (type === PIPE_WN) return { n: true,  e: false, s: false, w: true  };
    if (type === PIPE_T0) return { n: true,  e: true,  s: false, w: true  };
    if (type === PIPE_T1) return { n: true,  e: true,  s: true,  w: false };
    if (type === PIPE_T2) return { n: false, e: true,  s: true,  w: true  };
    if (type === PIPE_T3) return { n: true,  e: false, s: true,  w: true  };
    if (type === PIPE_X)  return { n: true,  e: true,  s: true,  w: true  };
    return { n: false, e: false, s: false, w: false };
  }

  /* Rotate a pipe type 90 degrees clockwise once */
  function rotatePipe(type) {
    if (type === PIPE_H)  return PIPE_V;
    if (type === PIPE_V)  return PIPE_H;
    if (type === PIPE_NE) return PIPE_ES;
    if (type === PIPE_ES) return PIPE_SW;
    if (type === PIPE_SW) return PIPE_WN;
    if (type === PIPE_WN) return PIPE_NE;
    if (type === PIPE_T0) return PIPE_T1;
    if (type === PIPE_T1) return PIPE_T2;
    if (type === PIPE_T2) return PIPE_T3;
    if (type === PIPE_T3) return PIPE_T0;
    if (type === PIPE_X)  return PIPE_X;
    return type;
  }

  /* ---- 5 hardcoded puzzle layouts ----
   * Each puzzle is a 5x5 array (row-major) of pipe types.
   * Row 0 is the top row. Cell [0][0] = source, [4][4] = drain.
   */
  var PUZZLES = [
    /* Puzzle 0 */
    [
      [ PIPE_ES, PIPE_H,  PIPE_ES, PIPE_H,  PIPE_SW ],
      [ PIPE_V,  PIPE_ES, PIPE_SW, PIPE_NE, PIPE_V  ],
      [ PIPE_V,  PIPE_V,  PIPE_NE, PIPE_H,  PIPE_SW ],
      [ PIPE_V,  PIPE_SW, PIPE_H,  PIPE_ES, PIPE_V  ],
      [ PIPE_NE, PIPE_H,  PIPE_NE, PIPE_H,  PIPE_WN ]
    ],
    /* Puzzle 1 */
    [
      [ PIPE_ES, PIPE_SW, PIPE_NE, PIPE_H,  PIPE_SW ],
      [ PIPE_NE, PIPE_V,  PIPE_H,  PIPE_ES, PIPE_V  ],
      [ PIPE_H,  PIPE_SW, PIPE_ES, PIPE_V,  PIPE_V  ],
      [ PIPE_ES, PIPE_V,  PIPE_V,  PIPE_SW, PIPE_V  ],
      [ PIPE_NE, PIPE_NE, PIPE_NE, PIPE_NE, PIPE_WN ]
    ],
    /* Puzzle 2 */
    [
      [ PIPE_ES, PIPE_H,  PIPE_H,  PIPE_H,  PIPE_SW ],
      [ PIPE_V,  PIPE_ES, PIPE_SW, PIPE_ES, PIPE_V  ],
      [ PIPE_V,  PIPE_NE, PIPE_X,  PIPE_WN, PIPE_V  ],
      [ PIPE_V,  PIPE_ES, PIPE_SW, PIPE_ES, PIPE_V  ],
      [ PIPE_NE, PIPE_H,  PIPE_NE, PIPE_H,  PIPE_WN ]
    ],
    /* Puzzle 3 */
    [
      [ PIPE_ES, PIPE_H,  PIPE_SW, PIPE_ES, PIPE_SW ],
      [ PIPE_V,  PIPE_ES, PIPE_T2, PIPE_WN, PIPE_V  ],
      [ PIPE_T1, PIPE_WN, PIPE_ES, PIPE_SW, PIPE_V  ],
      [ PIPE_V,  PIPE_ES, PIPE_V,  PIPE_T2, PIPE_WN ],
      [ PIPE_NE, PIPE_NE, PIPE_NE, PIPE_H,  PIPE_WN ]
    ],
    /* Puzzle 4 */
    [
      [ PIPE_ES, PIPE_T2, PIPE_T2, PIPE_T2, PIPE_SW ],
      [ PIPE_T1, PIPE_X,  PIPE_V,  PIPE_X,  PIPE_T3 ],
      [ PIPE_V,  PIPE_T1, PIPE_T3, PIPE_T1, PIPE_V  ],
      [ PIPE_T1, PIPE_X,  PIPE_V,  PIPE_X,  PIPE_T3 ],
      [ PIPE_NE, PIPE_T0, PIPE_T0, PIPE_T0, PIPE_WN ]
    ]
  ];

  /* ---- module state ---- */
  var _canvas, _ctx;
  var _state;
  var _best;
  var _score;
  var _lives;
  var _movesLeft;   // rotations allowed before losing a life
  var _puzzleIdx;
  var _grid;        // 5x5 array of pipe types (current rotation state)
  var _solved;      // is current puzzle solved?
  var _solvedTimer; // countdown after solving before loading next puzzle
  var _flowPath;    // array of {r,c} cells in water flow path (when solved)
  var _flowAnim;    // 0..1 animation fraction for water flow

  var MOVES_PER_PUZZLE = 20;

  /* ---- grid / puzzle helpers ---- */
  var GRID_SIZE = 5;

  function _copyPuzzle(idx) {
    var src = PUZZLES[idx % PUZZLES.length];
    var grid = [];
    var r, c;
    for (r = 0; r < GRID_SIZE; r++) {
      grid[r] = [];
      for (c = 0; c < GRID_SIZE; c++) {
        grid[r][c] = src[r][c];
      }
    }
    return grid;
  }

  /* BFS from source (0,0) to drain (4,4). Returns path array or null. */
  function _findPath(grid) {
    var visited = [];
    var parent = [];
    var r, c, i;
    for (r = 0; r < GRID_SIZE; r++) {
      visited[r] = [];
      parent[r] = [];
      for (c = 0; c < GRID_SIZE; c++) {
        visited[r][c] = false;
        parent[r][c] = null;
      }
    }
    var queue = [];
    queue.push({ r: 0, c: 0 });
    visited[0][0] = true;

    /* direction deltas: N, E, S, W */
    var DR = [-1, 0, 1, 0];
    var DC = [0, 1, 0, -1];
    var FROM_N = 's'; /* coming from north means entering via south opening */
    var FROM_E = 'w';
    var FROM_S = 'n';
    var FROM_W = 'e';
    var FROM_DIR = [FROM_N, FROM_E, FROM_S, FROM_W];
    /* opening keys for exits */
    var EXIT_DIR = ['n', 'e', 's', 'w'];

    while (queue.length > 0) {
      var cur = queue.shift();
      var cr = cur.r;
      var cc = cur.c;
      var op = getOpenings(grid[cr][cc]);

      for (i = 0; i < 4; i++) {
        var nr = cr + DR[i];
        var nc = cc + DC[i];
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
        if (visited[nr][nc]) continue;
        /* current cell must open toward neighbor */
        if (!op[EXIT_DIR[i]]) continue;
        /* neighbor must open back */
        var nop = getOpenings(grid[nr][nc]);
        if (!nop[FROM_DIR[i]]) continue;
        visited[nr][nc] = true;
        parent[nr][nc] = { r: cr, c: cc };
        if (nr === GRID_SIZE - 1 && nc === GRID_SIZE - 1) {
          /* reconstruct path */
          var path = [];
          var pr = nr, pc = nc;
          while (pr !== null) {
            path.unshift({ r: pr, c: pc });
            var p = parent[pr][pc];
            if (p === null) break;
            pr = p.r;
            pc = p.c;
          }
          return path;
        }
        queue.push({ r: nr, c: nc });
      }
    }
    return null;
  }

  /* ---- drawing constants ---- */
  var CELL_SIZE = 68;
  var GRID_MARGIN_X = (VW - GRID_SIZE * CELL_SIZE) / 2;
  var GRID_TOP = 220;

  function _cellX(c) { return GRID_MARGIN_X + c * CELL_SIZE; }
  function _cellY(r) { return GRID_TOP + r * CELL_SIZE; }
  function _cellCX(c) { return _cellX(c) + CELL_SIZE / 2; }
  function _cellCY(r) { return _cellY(r) + CELL_SIZE / 2; }

  /* Convert virtual canvas coords to grid cell */
  function _hitCell(vx, vy) {
    var c = Math.floor((vx - GRID_MARGIN_X) / CELL_SIZE);
    var r = Math.floor((vy - GRID_TOP) / CELL_SIZE);
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
    return { r: r, c: c };
  }

  /* ---- state management ---- */
  function _loadPuzzle(idx) {
    _puzzleIdx = idx % PUZZLES.length;
    _grid = _copyPuzzle(_puzzleIdx);
    _solved = false;
    _solvedTimer = 0;
    _flowPath = null;
    _flowAnim = 0;
  }

  function _checkSolvedSilent() {
    return !!_findPath(_grid);
  }

  function _checkSolved() {
    var path = _findPath(_grid);
    if (path) {
      _solved = true;
      _solvedTimer = 1.0;
      _flowPath = path;
      _flowAnim = 0;
      try { Audio.play('gem'); } catch(e) {}
    } else {
      _solved = false;
      _flowPath = null;
    }
  }

  /* ---- public API ---- */
  function _startGame() {
    _score = 0;
    _lives = 3;
    _puzzleIdx = 0;
    _movesLeft = MOVES_PER_PUZZLE;
    _loadPuzzle(0);
    _state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function _endGame() {
    if (_score > _best) _best = _score;
    _state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score, 'waterflow_best'); } catch(e) {}
  }

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    _score = 0;
    _lives = 3;
    _movesLeft = MOVES_PER_PUZZLE;
    _puzzleIdx = 0;
    _loadPuzzle(0);
    _state = 'MENU';
  }

  function update(dt) {
    if (_state === 'PLAYING') {
      if (_solved) {
        _solvedTimer -= dt;
        _flowAnim = Math.min(1, 1 - _solvedTimer / 1.0);
        if (_solvedTimer <= 0) {
          _score += 1;
          if (_score > _best) { _best = _score; }
          _movesLeft = MOVES_PER_PUZZLE;
          _loadPuzzle(_puzzleIdx + 1);
        }
      }
    }
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _startGame();
      return;
    }
    if (_state === 'DEAD') {
      _startGame();
      return;
    }
    if (_state === 'PLAYING') {
      if (_solved) return; /* wait for animation */
      var cell = _hitCell(x, y);
      if (cell === null) return;
      /* rotate the pipe */
      _grid[cell.r][cell.c] = rotatePipe(_grid[cell.r][cell.c]);
      try { Audio.play('tap'); } catch(e) {}
      _movesLeft--;
      if (_movesLeft <= 0 && !_checkSolvedSilent()) {
        _lives--;
        try { Audio.play('crash'); } catch(e) {}
        if (_lives <= 0) { _endGame(); return; }
        _movesLeft = MOVES_PER_PUZZLE;
        _loadPuzzle(_puzzleIdx); // retry same puzzle
        return;
      }
      _checkSolved();
    }
  }

  function getBest() {
    return _best;
  }

  /* ---- drawing helpers ---- */
  function _drawBackground() {
    var ctx = _ctx;
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#0d2340');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
  }

  function _drawTitle() {
    var ctx = _ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4ecdc4';
    ctx.fillText('WATER FLOW', VW / 2, 180);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _drawPipeSegment(ctx, x1, y1, x2, y2, color, lineW) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW || 8;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* Draw a single pipe piece centered at (cx, cy) with given cell size */
  function _drawPipe(ctx, type, cx, cy, cs, color) {
    var half = cs / 2 - 6;
    var lw = cs * 0.22;
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var N = cy - half, S = cy + half, E = cx + half, W = cx - half;

    ctx.beginPath();

    if (type === PIPE_H) {
      ctx.moveTo(W, cy); ctx.lineTo(E, cy);
      ctx.stroke();
    } else if (type === PIPE_V) {
      ctx.moveTo(cx, N); ctx.lineTo(cx, S);
      ctx.stroke();
    } else if (type === PIPE_NE) {
      ctx.moveTo(cx, N); ctx.lineTo(cx, cy); ctx.lineTo(E, cy);
      ctx.stroke();
    } else if (type === PIPE_ES) {
      ctx.moveTo(E, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, S);
      ctx.stroke();
    } else if (type === PIPE_SW) {
      ctx.moveTo(cx, S); ctx.lineTo(cx, cy); ctx.lineTo(W, cy);
      ctx.stroke();
    } else if (type === PIPE_WN) {
      ctx.moveTo(W, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, N);
      ctx.stroke();
    } else if (type === PIPE_T0) {
      /* opens N, E, W — missing S */
      ctx.moveTo(W, cy); ctx.lineTo(E, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx, N);
      ctx.stroke();
    } else if (type === PIPE_T1) {
      /* opens N, E, S — missing W */
      ctx.moveTo(cx, N); ctx.lineTo(cx, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(E, cy);
      ctx.stroke();
    } else if (type === PIPE_T2) {
      /* opens E, S, W — missing N */
      ctx.moveTo(W, cy); ctx.lineTo(E, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx, S);
      ctx.stroke();
    } else if (type === PIPE_T3) {
      /* opens N, S, W — missing E */
      ctx.moveTo(cx, N); ctx.lineTo(cx, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(W, cy);
      ctx.stroke();
    } else if (type === PIPE_X) {
      ctx.moveTo(W, cy); ctx.lineTo(E, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, N); ctx.lineTo(cx, S);
      ctx.stroke();
    }
  }

  /* Draw water flowing through a single pipe. progress 0..1 drives the animated head. */
  function _drawWaterInPipe(ctx, type, cx, cy, cs, progress) {
    var half = cs / 2 - 6;
    var lw = cs * 0.13;
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#00d4ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00d4ff';
    ctx.lineCap = 'round';

    var N = cy - half, S = cy + half, E = cx + half, W = cx - half;

    /* helper: draw a partial segment from start to end by fraction */
    function seg(x1, y1, x2, y2, frac) {
      if (frac <= 0) return;
      var tx = x1 + (x2 - x1) * Math.min(1, frac);
      var ty = y1 + (y2 - y1) * Math.min(1, frac);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    /* For corner pipes we have two segments of length half each.
       Total animation split: first half = first segment, second half = second segment */
    if (type === PIPE_H)  { seg(W, cy, E, cy, progress); }
    else if (type === PIPE_V)  { seg(cx, N, cx, S, progress); }
    else if (type === PIPE_NE) {
      seg(cx, N, cx, cy, progress * 2);
      if (progress > 0.5) seg(cx, cy, E, cy, (progress - 0.5) * 2);
    } else if (type === PIPE_ES) {
      seg(E, cy, cx, cy, progress * 2);
      if (progress > 0.5) seg(cx, cy, cx, S, (progress - 0.5) * 2);
    } else if (type === PIPE_SW) {
      seg(cx, S, cx, cy, progress * 2);
      if (progress > 0.5) seg(cx, cy, W, cy, (progress - 0.5) * 2);
    } else if (type === PIPE_WN) {
      seg(W, cy, cx, cy, progress * 2);
      if (progress > 0.5) seg(cx, cy, cx, N, (progress - 0.5) * 2);
    } else if (type === PIPE_T0) {
      seg(W, cy, cx, cy, progress * 2);
      if (progress > 0.5) {
        seg(cx, cy, E, cy, (progress - 0.5) * 2);
        seg(cx, cy, cx, N, (progress - 0.5) * 2);
      }
    } else if (type === PIPE_T1) {
      seg(cx, N, cx, cy, progress * 2);
      if (progress > 0.5) {
        seg(cx, cy, E, cy, (progress - 0.5) * 2);
        seg(cx, cy, cx, S, (progress - 0.5) * 2);
      }
    } else if (type === PIPE_T2) {
      seg(W, cy, cx, cy, progress * 2);
      if (progress > 0.5) {
        seg(cx, cy, E, cy, (progress - 0.5) * 2);
        seg(cx, cy, cx, S, (progress - 0.5) * 2);
      }
    } else if (type === PIPE_T3) {
      seg(cx, N, cx, cy, progress * 2);
      if (progress > 0.5) {
        seg(cx, cy, W, cy, (progress - 0.5) * 2);
        seg(cx, cy, cx, S, (progress - 0.5) * 2);
      }
    } else if (type === PIPE_X) {
      seg(W, cy, E, cy, progress);
      seg(cx, N, cx, S, progress);
    }

    ctx.shadowBlur = 0;
  }

  function _drawGrid() {
    var ctx = _ctx;
    var r, c;

    /* cell backgrounds */
    for (r = 0; r < GRID_SIZE; r++) {
      for (c = 0; c < GRID_SIZE; c++) {
        var cx = _cellCX(c);
        var cy = _cellCY(r);
        /* bg rect */
        ctx.fillStyle = '#0e2a45';
        ctx.strokeStyle = '#1a3a5c';
        ctx.lineWidth = 1.5;
        roundRect(ctx, _cellX(c) + 2, _cellY(r) + 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
        ctx.fill();
        ctx.stroke();
      }
    }

    /* pipes */
    for (r = 0; r < GRID_SIZE; r++) {
      for (c = 0; c < GRID_SIZE; c++) {
        var px = _cellCX(c);
        var py = _cellCY(r);
        _drawPipe(ctx, _grid[r][c], px, py, CELL_SIZE, '#2a6a8a');
      }
    }

    /* water flow animation */
    if (_solved && _flowPath && _flowPath.length > 0) {
      var total = _flowPath.length;
      for (var i = 0; i < total; i++) {
        var cell = _flowPath[i];
        /* progress for this cell: how much of animation has reached/passed it */
        var cellStart = i / total;
        var cellEnd = (i + 1) / total;
        var cellProgress = (_flowAnim - cellStart) / (cellEnd - cellStart);
        cellProgress = Math.max(0, Math.min(1, cellProgress));
        if (cellProgress <= 0) break;
        var wx = _cellCX(cell.c);
        var wy = _cellCY(cell.r);
        _drawWaterInPipe(ctx, _grid[cell.r][cell.c], wx, wy, CELL_SIZE, cellProgress);
      }
    }

    /* source marker (0,0) */
    ctx.save();
    ctx.beginPath();
    var sx = _cellCX(0), sy = _cellCY(0), sr = CELL_SIZE * 0.18;
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = '#0099ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#0099ff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    /* drain marker (4,4) */
    ctx.save();
    ctx.beginPath();
    var dx = _cellCX(4), dy = _cellCY(4), dr = CELL_SIZE * 0.18;
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = _solved ? '#00ff88' : '#00aa55';
    ctx.shadowBlur = _solved ? 18 : 8;
    ctx.shadowColor = '#00ff88';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /* Utility: rounded rectangle path */
  function roundRect(ctx, x, y, w, h, r) {
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

  function _drawHUD() {
    var ctx = _ctx;
    /* lives */
    ctx.save();
    ctx.font = '22px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < _lives ? '♥' : '♡');
    ctx.fillText(hearts, 14, 44);
    /* score */
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('LEVEL ' + (_score + 1), VW / 2, 60);
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = '#8aa8c0';
    ctx.fillText('BEST: ' + _best, VW / 2, 90);
    /* moves remaining */
    ctx.textAlign = 'right';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = _movesLeft <= 5 ? '#f87171' : '#fde68a';
    ctx.fillText('Moves: ' + _movesLeft, VW - 14, 44);
    ctx.restore();

    /* solved banner */
    if (_solved) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.fillStyle = '#00ff88';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff88';
      ctx.fillText('CONNECTED!', VW / 2, GRID_TOP + GRID_SIZE * CELL_SIZE + 55);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function _drawMenu() {
    var ctx = _ctx;
    _drawBackground();

    /* decorative wave lines */
    ctx.save();
    ctx.strokeStyle = '#1a4060';
    ctx.lineWidth = 1.5;
    var i, y;
    for (i = 0; i < 8; i++) {
      y = 50 + i * 100;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(VW * 0.25, y - 20, VW * 0.75, y + 20, VW, y);
      ctx.stroke();
    }
    ctx.restore();

    /* title */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.fillStyle = '#4ecdc4';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#4ecdc4';
    ctx.fillText('WATER', VW / 2, 340);
    ctx.fillText('FLOW', VW / 2, 410);
    ctx.shadowBlur = 0;

    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#8acfe0';
    ctx.fillText('Connect source to drain', VW / 2, 460);
    ctx.fillText('by rotating the pipes', VW / 2, 488);

    /* best score */
    if (_best > 0) {
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('BEST: ' + _best + ' LEVELS', VW / 2, 540);
    }

    /* tap to play pulse */
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4ecdc4';
    ctx.fillText('TAP TO PLAY', VW / 2, 640);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function _drawPlaying() {
    var ctx = _ctx;
    _drawBackground();
    _drawTitle();
    _drawHUD();
    _drawGrid();
  }

  function _drawDead() {
    var ctx = _ctx;
    _drawBackground();

    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff6b6b';
    ctx.fillText('GAME OVER', VW / 2, 320);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('SCORE: ' + _score, VW / 2, 390);

    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('BEST: ' + _best, VW / 2, 440);

    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4ecdc4';
    ctx.fillText('TAP TO RETRY', VW / 2, 560);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function draw() {
    if (!_ctx) return;
    if (_state === 'MENU') {
      _drawMenu();
    } else if (_state === 'PLAYING') {
      _drawPlaying();
    } else if (_state === 'DEAD') {
      _drawDead();
    }
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };

})();
