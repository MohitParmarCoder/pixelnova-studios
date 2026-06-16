'use strict';

/* ============================================================
   NumberMerge — 2048-style 4×4 merge puzzle
   Virtual canvas: 390 × 844
   Exposed global: NumberMerge
   ============================================================ */
const NumberMerge = (() => {

  // ── Constants ────────────────────────────────────────────────────────────────
  const VW = 390, VH = 844;
  const COLS = 4, ROWS = 4;
  const CELL = 78, GAP = 12;
  const GRID_X = 9;          // left edge of grid
  const GRID_Y = 240;        // top edge of grid

  // Grid outer dimensions
  const GRID_W = COLS * CELL + (COLS + 1) * GAP;
  const GRID_H = ROWS * CELL + (ROWS + 1) * GAP;

  const TILE_COLORS = {
    2:    '#eee4da',
    4:    '#ede0c8',
    8:    '#f2b179',
    16:   '#f59563',
    32:   '#f67c5f',
    64:   '#f65e3b',
    128:  '#edcf72',
    256:  '#edcc61',
    512:  '#edc850',
    1024: '#edc53f',
    2048: '#edc22e',
  };
  const TEXT_DARK  = '#776e65';
  const TEXT_LIGHT = '#f9f6f2';
  const BG_COLOR   = '#faf8ef';
  const GRID_BG    = '#bbada0';
  const EMPTY_CELL = '#cdc1b4';

  const MERGE_ANIM_DUR = 0.15; // seconds for merge pop animation

  // ── State ────────────────────────────────────────────────────────────────────
  let _canvas, _ctx;
  let _state;      // 'MENU' | 'PLAYING' | 'DEAD' | 'WIN'
  let _score, _best;
  let _winShown;   // whether we've already shown the WIN overlay (keep playing after)
  let _grid;       // [row][col] = value or 0
  let _anims;      // array of {row, col, t} for merge pop

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init(canvas, best) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = best || 0;

    _resetGame();
    _state = 'MENU';
  }

  function _resetGame() {
    _score    = 0;
    _winShown = false;
    _anims    = [];
    _grid     = [];
    for (let r = 0; r < ROWS; r++) {
      _grid[r] = [];
      for (let c = 0; c < COLS; c++) _grid[r][c] = 0;
    }
    _spawnTile();
    _spawnTile();
  }

  // ── Tile spawning ────────────────────────────────────────────────────────────
  function _emptyCells() {
    const cells = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (_grid[r][c] === 0) cells.push({ r, c });
    return cells;
  }

  function _spawnTile() {
    const empties = _emptyCells();
    if (!empties.length) return;
    const { r, c } = empties[Math.random() * empties.length | 0];
    _grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  // ── Move logic ───────────────────────────────────────────────────────────────
  // Compress a single line (array of non-zero values) leftward and merge
  function _compressLine(line) {
    const filtered = line.filter(v => v !== 0);
    const result   = [];
    let mergedScore = 0;
    let mergedPositions = []; // indices in result[] that were merges
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const merged = filtered[i] * 2;
        result.push(merged);
        mergedPositions.push(result.length - 1);
        mergedScore += merged;
        i += 2;
      } else {
        result.push(filtered[i]);
        i++;
      }
    }
    while (result.length < COLS) result.push(0);
    return { result, mergedScore, mergedPositions };
  }

  // Returns true if the move changed the grid
  function _move(dx, dy) {
    let changed = false;
    let totalMerged = 0;
    let maxMerge = 0;
    let mergePositions = []; // {r, c} in output grid

    if (dx === -1) {
      // slide left — process each row left→right
      for (let r = 0; r < ROWS; r++) {
        const { result, mergedScore, mergedPositions } = _compressLine([..._grid[r]]);
        for (let c = 0; c < COLS; c++) {
          if (result[c] !== _grid[r][c]) changed = true;
          _grid[r][c] = result[c];
        }
        if (mergedScore) {
          totalMerged += mergedScore;
          mergedPositions.forEach(mc => {
            const v = result[mc];
            if (v > maxMerge) maxMerge = v;
            mergePositions.push({ r, c: mc });
          });
        }
      }
    } else if (dx === 1) {
      // slide right — reverse each row, compress, reverse back
      for (let r = 0; r < ROWS; r++) {
        const rev = [..._grid[r]].reverse();
        const { result, mergedScore, mergedPositions } = _compressLine(rev);
        const final = [...result].reverse();
        for (let c = 0; c < COLS; c++) {
          if (final[c] !== _grid[r][c]) changed = true;
          _grid[r][c] = final[c];
        }
        if (mergedScore) {
          totalMerged += mergedScore;
          mergedPositions.forEach(mc => {
            const oc = COLS - 1 - mc;
            const v = final[oc];
            if (v > maxMerge) maxMerge = v;
            mergePositions.push({ r, c: oc });
          });
        }
      }
    } else if (dy === -1) {
      // slide up — process each column top→bottom
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = 0; r < ROWS; r++) col.push(_grid[r][c]);
        const { result, mergedScore, mergedPositions } = _compressLine(col);
        for (let r = 0; r < ROWS; r++) {
          if (result[r] !== _grid[r][c]) changed = true;
          _grid[r][c] = result[r];
        }
        if (mergedScore) {
          totalMerged += mergedScore;
          mergedPositions.forEach(mr => {
            const v = result[mr];
            if (v > maxMerge) maxMerge = v;
            mergePositions.push({ r: mr, c });
          });
        }
      }
    } else if (dy === 1) {
      // slide down — reverse each column, compress, reverse back
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = 0; r < ROWS; r++) col.push(_grid[r][c]);
        const rev = [...col].reverse();
        const { result, mergedScore, mergedPositions } = _compressLine(rev);
        const final = [...result].reverse();
        for (let r = 0; r < ROWS; r++) {
          if (final[r] !== _grid[r][c]) changed = true;
          _grid[r][c] = final[r];
        }
        if (mergedScore) {
          totalMerged += mergedScore;
          mergedPositions.forEach(mr => {
            const or = ROWS - 1 - mr;
            const v = final[or];
            if (v > maxMerge) maxMerge = v;
            mergePositions.push({ r: or, c });
          });
        }
      }
    }

    if (!changed) return false;

    // Update score
    _score += totalMerged;
    if (_score > _best) _best = _score;

    // Sound feedback
    if (maxMerge >= 2048) {
      try { Audio.play('power'); } catch(e) {}
    } else if (maxMerge >= 1024) {
      try { Audio.play('gem'); } catch(e) {}
    } else if (maxMerge >= 8) {
      try { Audio.play('score'); } catch(e) {}
    } else if (totalMerged) {
      try { Audio.play('tap'); } catch(e) {}
    }

    // Queue merge animations
    mergePositions.forEach(pos => {
      _anims.push({ r: pos.r, c: pos.c, t: 0 });
    });

    // Spawn new tile
    _spawnTile();

    // Check win
    if (!_winShown) {
      outer:
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (_grid[r][c] >= 2048) { _state = 'WIN'; _winShown = true; try { AdManager.gameplayStop(); } catch(e) {} break outer; }
        }
      }
    }

    // Check loss (no empty cells and no possible merges)
    if (_state !== 'WIN' && !_emptyCells().length && !_hasMoves()) {
      _state = 'DEAD';
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      try {
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'nummerge_best'); } catch(e) {}
      } catch(e) {}
    }

    return true;
  }

  function _hasMoves() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = _grid[r][c];
        if (c + 1 < COLS && _grid[r][c + 1] === v) return true;
        if (r + 1 < ROWS && _grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  // ── Public swipe ─────────────────────────────────────────────────────────────
  function swipe(dx, dy) {
    if (_state === 'MENU') {
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch(e) {}
      try { Audio.play('button'); } catch(e) {}
      return;
    }
    if (_state === 'DEAD' || _state === 'WIN') {
      AdManager.showInterstitial(() => {
        _resetGame();
        _state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch(e) {}
        try { Audio.play('button'); } catch(e) {}
      });
      return;
    }
    if (_state !== 'PLAYING') return;
    if (dx === 0 && dy === 0) return; // pure tap during play — ignore

    const moved = _move(dx, dy);
    if (moved) {
      try { Audio.play('tap'); } catch(e) {}
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  function update(dt) {
    // Advance merge animations
    _anims = _anims.filter(a => {
      a.t += dt;
      return a.t < MERGE_ANIM_DUR;
    });
  }

  // ── Draw helpers ─────────────────────────────────────────────────────────────
  function _roundRect(ctx, x, y, w, h, r) {
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

  function _tileColor(v) {
    return TILE_COLORS[v] || '#3c3a32';
  }

  function _tileTextColor(v) {
    return v <= 4 ? TEXT_DARK : TEXT_LIGHT;
  }

  function _tileFontSize(v) {
    if (v < 100)   return 42;
    if (v < 1000)  return 34;
    if (v < 10000) return 26;
    return 22;
  }

  function _getAnim(r, c) {
    return _anims.find(a => a.r === r && a.c === c) || null;
  }

  function _cellXY(r, c) {
    const x = GRID_X + GAP + c * (CELL + GAP);
    const y = GRID_Y + GAP + r * (CELL + GAP);
    return { x, y };
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  function draw() {
    const ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, VW, VH);

    _drawHeader(ctx);
    _drawGrid(ctx);

    if (_state === 'MENU')       _drawMenuOverlay(ctx);
    if (_state === 'DEAD')       _drawDeadOverlay(ctx);
    if (_state === 'WIN')        _drawWinOverlay(ctx);
  }

  function _drawHeader(ctx) {
    // Title
    ctx.fillStyle = '#776e65';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('2048', GRID_X, 24);

    // Subtitle
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#776e65';
    ctx.fillText('Join numbers to get to 2048!', GRID_X, 96);

    // Score boxes
    _drawScoreBox(ctx, 'SCORE', _score, VW - 180, 24);
    _drawScoreBox(ctx, 'BEST',  _best,  VW - 84,  24);
  }

  function _drawScoreBox(ctx, label, value, x, y) {
    const w = 68, h = 56;
    _roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = '#bbada0';
    ctx.fill();

    ctx.fillStyle = '#eee4da';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + w / 2, y + 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + w / 2, y + h - 17);
  }

  function _drawGrid(ctx) {
    // Grid background
    _roundRect(ctx, GRID_X, GRID_Y, GRID_W, GRID_H, 8);
    ctx.fillStyle = GRID_BG;
    ctx.fill();

    // Empty cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = _cellXY(r, c);
        _roundRect(ctx, x, y, CELL, CELL, 6);
        ctx.fillStyle = EMPTY_CELL;
        ctx.fill();
      }
    }

    // Tiles (draw non-animated first, then animated on top so scale doesn't clip)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = _grid[r][c];
        if (!v) continue;
        const anim = _getAnim(r, c);
        if (anim) continue; // draw after
        _drawTile(ctx, r, c, v, 1);
      }
    }
    // Animated tiles
    for (const a of _anims) {
      const v = _grid[a.r][a.c];
      if (!v) continue;
      const prog = a.t / MERGE_ANIM_DUR; // 0→1
      // scale: 1→1.2→1 (peak at midpoint)
      const scale = 1 + 0.2 * Math.sin(prog * Math.PI);
      _drawTile(ctx, a.r, a.c, v, scale);
    }
  }

  function _drawTile(ctx, r, c, v, scale) {
    const { x, y } = _cellXY(r, c);
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    _roundRect(ctx, x, y, CELL, CELL, 6);
    ctx.fillStyle = _tileColor(v);
    ctx.fill();

    ctx.fillStyle = _tileTextColor(v);
    ctx.font = `bold ${_tileFontSize(v)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(v), cx, cy + 2);

    ctx.restore();
  }

  // ── Overlays ─────────────────────────────────────────────────────────────────
  function _drawOverlay(ctx, bgAlpha) {
    ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
    ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H);
  }

  function _drawMenuOverlay(ctx) {
    // Full screen dim
    ctx.fillStyle = 'rgba(250,248,239,0.88)';
    ctx.fillRect(0, 0, VW, VH);

    // Big title
    ctx.fillStyle = '#776e65';
    ctx.font = 'bold 80px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2048', VW / 2, VH / 2 - 100);

    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = '#776e65';
    ctx.fillText('Swipe to merge tiles', VW / 2, VH / 2 - 20);
    ctx.fillText('Reach 2048 to win!', VW / 2, VH / 2 + 20);

    // Tap to play button
    _drawButton(ctx, 'TAP TO PLAY', VW / 2, VH / 2 + 100);
  }

  function _drawDeadOverlay(ctx) {
    ctx.fillStyle = 'rgba(238,228,218,0.72)';
    _roundRect(ctx, GRID_X, GRID_Y, GRID_W, GRID_H, 8);
    ctx.fill();

    const cx = GRID_X + GRID_W / 2;
    const cy = GRID_Y + GRID_H / 2;

    ctx.fillStyle = '#776e65';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over!', cx, cy - 50);

    ctx.font = '20px Arial, sans-serif';
    ctx.fillText('Score: ' + _score, cx, cy);

    _drawButton(ctx, 'TRY AGAIN', cx, cy + 64);
  }

  function _drawWinOverlay(ctx) {
    ctx.fillStyle = 'rgba(237,207,114,0.82)';
    _roundRect(ctx, GRID_X, GRID_Y, GRID_W, GRID_H, 8);
    ctx.fill();

    const cx = GRID_X + GRID_W / 2;
    const cy = GRID_Y + GRID_H / 2;

    ctx.fillStyle = '#f9f6f2';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('You Win!', cx, cy - 60);

    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('Score: ' + _score, cx, cy - 8);

    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('Keep going or restart', cx, cy + 28);

    _drawButton(ctx, 'KEEP GOING', cx, cy + 82);
  }

  function _drawButton(ctx, label, cx, cy) {
    const w = 180, h = 52, r = 8;
    const x = cx - w / 2, y = cy - h / 2;
    _roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = '#8f7a66';
    ctx.fill();

    ctx.fillStyle = '#f9f6f2';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  function getScore() { return _score; }
  function getState() { return _state; }
  function getBest()  { return _best; }

  return { init, update, draw, swipe, getScore, getState, getBest };

})();
