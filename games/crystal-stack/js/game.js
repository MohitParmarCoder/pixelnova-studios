'use strict';
var CrystalStack = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score;
  var COLS = 8, ROWS = 18;
  var CELL = 40, BOARD_X, BOARD_Y, BOARD_W, BOARD_H;
  var board;        // ROWS x COLS grid, 0=empty or color string
  var piece;        // current falling piece
  var nextType;
  var dropAcc, dropInterval;
  var rowsCleared;
  var sparkles;     // particles from cleared rows
  var flashRows;    // [{row, life}]

  var TETROMINOES = {
    I: { cells: [[0,1],[1,1],[2,1],[3,1]], color: '#00fff7', glow: '#00cccc' },
    O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: '#ffe600', glow: '#cc9900' },
    T: { cells: [[1,0],[0,1],[1,1],[2,1]], color: '#cc00ff', glow: '#ff00cc' },
    L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: '#ff6600', glow: '#ff3300' },
    J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: '#0066ff', glow: '#00ccff' },
    S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#39ff14', glow: '#00aa00' },
    Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#ff00cc', glow: '#cc0099' }
  };
  var TYPES = ['I','O','T','L','J','S','Z'];

  function _initBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
      board.push([]);
      for (var c = 0; c < COLS; c++) board[r].push(0);
    }
  }

  function _newPiece(type) {
    var def = TETROMINOES[type];
    var cells = def.cells.map(function(c){ return [c[0], c[1]]; });
    return {
      type: type,
      cells: cells,
      color: def.color,
      glow: def.glow,
      x: Math.floor(COLS / 2) - 2,
      y: 0
    };
  }

  function _randomType() {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
  }

  function _pieceCells(p) {
    return p.cells.map(function(c){ return [c[0] + p.x, c[1] + p.y]; });
  }

  function _collides(cells) {
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0], cy = cells[i][1];
      if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
      if (cy >= 0 && board[cy][cx]) return true;
    }
    return false;
  }

  function _rotateCells(cells) {
    // Rotate 90 degrees clockwise around centroid of bounding box
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < cells.length; i++) {
      minX = Math.min(minX, cells[i][0]); maxX = Math.max(maxX, cells[i][0]);
      minY = Math.min(minY, cells[i][1]); maxY = Math.max(maxY, cells[i][1]);
    }
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return cells.map(function(c) {
      var dx = c[0] - cx, dy = c[1] - cy;
      return [Math.round(cx + dy), Math.round(cy - dx)];
    });
  }

  function _lockPiece() {
    var cells = _pieceCells(piece);
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0], cy = cells[i][1];
      if (cy >= 0) board[cy][cx] = piece.color;
    }
    try { Audio.play('land'); } catch(e){}
    _clearRows();
    piece = _newPiece(nextType);
    nextType = _randomType();
    if (_collides(_pieceCells(piece))) {
      state = 'DEAD';
      if (score > best) best = score;
      try { Audio.play('lose'); } catch(e){}
      try { AdManager.gameplayStop(); } catch(e){}
      try { AdManager.onRunEnd(); } catch(e){}
    }
  }

  function _clearRows() {
    var cleared = 0;
    flashRows = flashRows || [];
    for (var r = ROWS - 1; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < COLS; c++) {
        if (!board[r][c]) { full = false; break; }
      }
      if (full) {
        _spawnRowSparkles(r);
        board.splice(r, 1);
        var empty = [];
        for (var c2 = 0; c2 < COLS; c2++) empty.push(0);
        board.unshift(empty);
        cleared++;
        r++; // re-check same row index after splice
      }
    }
    if (cleared > 0) {
      rowsCleared += cleared;
      score += cleared === 4 ? 800 : cleared === 3 ? 400 : cleared === 2 ? 200 : 80;
      dropInterval = Math.max(0.1, 0.7 - Math.floor(rowsCleared / 5) * 0.05);
      try { Audio.play('score'); } catch(e){}
    }
  }

  function _spawnRowSparkles(row) {
    var by = BOARD_Y + row * CELL;
    for (var i = 0; i < COLS * 3; i++) {
      var sx = BOARD_X + Math.random() * BOARD_W;
      var sy = by + Math.random() * CELL;
      var ang = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 120;
      sparkles.push({
        x: sx, y: sy,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.8, maxLife: 0.8,
        r: 2 + Math.random() * 3,
        color: ['#00fff7','#ff00cc','#ffe600','#39ff14'][Math.floor(Math.random()*4)]
      });
    }
  }

  function _reset() { state = 'MENU'; score = 0; }

  function _startGame() {
    state = 'PLAYING';
    score = 0;
    rowsCleared = 0;
    dropAcc = 0;
    dropInterval = 0.7;
    sparkles = [];
    flashRows = [];
    BOARD_W = COLS * CELL;
    BOARD_H = ROWS * CELL;
    BOARD_X = Math.floor((VW - BOARD_W) / 2);
    BOARD_Y = 80;
    _initBoard();
    nextType = _randomType();
    piece = _newPiece(_randomType());
    try { AdManager.gameplayStart(); } catch(e){}
  }

  function init(canvas, savedBest) {
    ctx = canvas.getContext('2d');
    best = savedBest || 0;
    _reset();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    dropAcc += dt;
    if (dropAcc >= dropInterval) {
      dropAcc -= dropInterval;
      var moved = _pieceCells(piece).map(function(c){ return [c[0], c[1] + 1]; });
      if (_collides(moved)) {
        _lockPiece();
      } else {
        piece.y++;
      }
    }

    // Sparkles
    for (var i = sparkles.length - 1; i >= 0; i--) {
      var sp = sparkles[i];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      sp.vy += 150 * dt;
      sp.life -= dt;
      if (sp.life <= 0) sparkles.splice(i, 1);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { _startGame(); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function(){ _startGame(); }); } catch(e){ _startGame(); }
      return;
    }
    if (state !== 'PLAYING') return;

    var third = VW / 3;
    if (x < third) {
      // Move left
      var moved = _pieceCells(piece).map(function(c){ return [c[0]-1, c[1]]; });
      if (!_collides(moved)) { piece.x--; try{Audio.play('hop');}catch(e){} }
    } else if (x > third * 2) {
      // Move right
      var moved2 = _pieceCells(piece).map(function(c){ return [c[0]+1, c[1]]; });
      if (!_collides(moved2)) { piece.x++; try{Audio.play('hop');}catch(e){} }
    } else {
      // Rotate
      var rotated = _rotateCells(piece.cells.map(function(c){return[c[0],c[1]];}));
      var testPiece = {cells: rotated, x: piece.x, y: piece.y};
      var testCells = _pieceCells(testPiece);
      // Wall kick: try shifting ±1 if collides
      if (!_collides(testCells)) {
        piece.cells = rotated;
      } else {
        var kick = _pieceCells({cells:rotated, x:piece.x+1, y:piece.y});
        if (!_collides(kick)) { piece.cells = rotated; piece.x++; }
        else {
          var kick2 = _pieceCells({cells:rotated, x:piece.x-1, y:piece.y});
          if (!_collides(kick2)) { piece.cells = rotated; piece.x--; }
        }
      }
      try{Audio.play('flip');}catch(e){}
    }
  }

  function _drawCrystalCell(x, y, color, glow, alpha) {
    var sz = CELL - 2;
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.shadowBlur = 14;
    ctx.shadowColor = glow;
    var g = ctx.createLinearGradient(x, y, x + sz, y + sz);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, color);
    g.addColorStop(1, glow);
    ctx.fillStyle = g;
    // Diamond-cut polygon
    ctx.beginPath();
    ctx.moveTo(x + sz / 2, y);
    ctx.lineTo(x + sz, y + sz * 0.35);
    ctx.lineTo(x + sz, y + sz * 0.65);
    ctx.lineTo(x + sz / 2, y + sz);
    ctx.lineTo(x, y + sz * 0.65);
    ctx.lineTo(x, y + sz * 0.35);
    ctx.closePath();
    ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x + sz / 2, y + 2);
    ctx.lineTo(x + sz - 3, y + sz * 0.35);
    ctx.lineTo(x + sz / 2, y + sz * 0.55);
    ctx.lineTo(x + 3, y + sz * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') { _drawMenu(); return; }

    // Board background
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,247,0.08)';
    ctx.lineWidth = 1;
    for (var r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + r * CELL);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL);
      ctx.stroke();
    }
    for (var c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + BOARD_H);
      ctx.stroke();
    }
    ctx.restore();

    // Board border
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00fff7';
    ctx.strokeStyle = '#00fff7';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 1, BOARD_Y - 1, BOARD_W + 2, BOARD_H + 2);
    ctx.restore();

    // Placed cells
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        if (board[row][col]) {
          var def = TETROMINOES;
          // find glow by color
          var glow = board[row][col];
          for (var k in TETROMINOES) {
            if (TETROMINOES[k].color === board[row][col]) { glow = TETROMINOES[k].glow; break; }
          }
          _drawCrystalCell(BOARD_X + col * CELL + 1, BOARD_Y + row * CELL + 1, board[row][col], glow);
        }
      }
    }

    // Current piece
    if (piece && state === 'PLAYING') {
      var cells = _pieceCells(piece);
      // Ghost piece
      var ghostY = piece.y;
      while (true) {
        var below = cells.map(function(c){ return [c[0], c[1]+1+(ghostY-piece.y)]; });
        if (_collides(below)) break;
        ghostY++;
      }
      if (ghostY > piece.y) {
        var def2 = TETROMINOES[piece.type];
        piece.cells.forEach(function(c) {
          var gx = BOARD_X + (c[0] + piece.x) * CELL + 1;
          var gy = BOARD_Y + (c[1] + ghostY) * CELL + 1;
          _drawCrystalCell(gx, gy, def2.color, def2.glow, 0.2);
        });
      }
      // Real piece
      cells.forEach(function(c) {
        if (c[1] >= 0) {
          _drawCrystalCell(BOARD_X + c[0] * CELL + 1, BOARD_Y + c[1] * CELL + 1, piece.color, piece.glow);
        }
      });
    }

    // Sparkles
    for (var si = 0; si < sparkles.length; si++) {
      var sp = sparkles[si];
      ctx.save();
      ctx.globalAlpha = sp.life / sp.maxLife;
      ctx.fillStyle = sp.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00fff7';
    ctx.fillText(score, VW / 2, BOARD_Y - 14);
    ctx.fillStyle = 'rgba(255,230,0,0.7)';
    ctx.font = '12px system-ui';
    ctx.shadowBlur = 0;
    ctx.fillText('BEST ' + best, VW / 2, BOARD_Y - 0);

    // Controls hint
    var hintY = BOARD_Y + BOARD_H + 28;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '12px system-ui';
    ctx.fillText('LEFT  |  ROTATE  |  RIGHT', VW / 2, hintY);
    ctx.restore();

    if (state === 'DEAD') _drawDead();
  }

  function _drawMenu() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00fff7';
    ctx.fillStyle = '#00fff7';
    ctx.fillText('CRYSTAL', VW / 2, VH / 2 - 55);
    ctx.fillStyle = '#cc00ff';
    ctx.shadowColor = '#cc00ff';
    ctx.fillText('STACK', VW / 2, VH / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '15px system-ui';
    ctx.fillText('Left / Center / Right to move & rotate', VW / 2, VH / 2 + 72);
    ctx.fillText('Clear rows to score!', VW / 2, VH / 2 + 96);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 160);
    if (best > 0) {
      ctx.fillStyle = 'rgba(255,230,0,0.7)';
      ctx.font = '15px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 200);
    }
    ctx.restore();
  }

  function _drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,14,0.82)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff00cc';
    ctx.fillStyle = '#ff00cc';
    ctx.fillText('GAME', VW / 2, VH / 2 - 60);
    ctx.fillStyle = '#ff6600';
    ctx.shadowColor = '#ff6600';
    ctx.fillText('OVER', VH / 2, VH / 2 + 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 + 60);
    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.font = '16px system-ui';
    ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 92);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 150);
    ctx.restore();
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
