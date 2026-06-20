'use strict';

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
      r=Math.min(r,w/2,h/2); this.moveTo(x+r,y); this.lineTo(x+w-r,y); this.quadraticCurveTo(x+w,y,x+w,y+r); this.lineTo(x+w,y+h-r); this.quadraticCurveTo(x+w,y+h,x+w-r,y+h); this.lineTo(x+r,y+h); this.quadraticCurveTo(x,y+h,x,y+h-r); this.lineTo(x,y+r); this.quadraticCurveTo(x,y,x+r,y);
    };
  }
var MatchGems = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;
  var score = 0;
  var timer = 60;
  var timerAcc = 0;

  var COLS = 5, ROWS = 5;
  var CELL = 64;
  var GRID_X, GRID_Y;
  var grid = [];
  var selected = null;
  var swapping = false;
  var swapA = null, swapB = null;
  var swapT = 0, SWAP_DUR = 0.18;
  var clearing = false;
  var clearT = 0, CLEAR_DUR = 0.25;
  var clearMask = [];
  var falling = false;
  var fallT = 0, FALL_DUR = 0.2;
  var fallOffsets = [];

  var GEM_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
  var GEM_NAMES  = ['red','blue','green','yellow','purple','teal'];

  function randomGem() {
    return Math.floor(Math.random() * GEM_COLORS.length);
  }

  function initGrid() {
    grid = [];
    for (var r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (var c = 0; c < COLS; c++) {
        grid[r][c] = randomGem();
      }
    }
    // avoid initial matches
    for (var pass = 0; pass < 5; pass++) {
      var matches = findMatches();
      if (matches.length === 0) break;
      for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        grid[m[0]][m[1]] = randomGem();
      }
    }
    clearMask = [];
    fallOffsets = [];
    for (var r2 = 0; r2 < ROWS; r2++) {
      clearMask[r2] = [];
      fallOffsets[r2] = [];
      for (var c2 = 0; c2 < COLS; c2++) {
        clearMask[r2][c2] = false;
        fallOffsets[r2][c2] = 0;
      }
    }
    selected = null;
    swapping = false;
    clearing = false;
    falling = false;
  }

  function findMatches() {
    var matched = [];
    var mark = [];
    for (var r = 0; r < ROWS; r++) {
      mark[r] = [];
      for (var c = 0; c < COLS; c++) {
        mark[r][c] = false;
      }
    }
    // horizontal
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var c2 = 0; c2 < COLS - 2; c2++) {
        var g = grid[r2][c2];
        if (g === grid[r2][c2+1] && g === grid[r2][c2+2]) {
          mark[r2][c2] = mark[r2][c2+1] = mark[r2][c2+2] = true;
          var ext = c2 + 3;
          while (ext < COLS && grid[r2][ext] === g) {
            mark[r2][ext] = true;
            ext++;
          }
        }
      }
    }
    // vertical
    for (var c3 = 0; c3 < COLS; c3++) {
      for (var r3 = 0; r3 < ROWS - 2; r3++) {
        var g2 = grid[r3][c3];
        if (g2 === grid[r3+1][c3] && g2 === grid[r3+2][c3]) {
          mark[r3][c3] = mark[r3+1][c3] = mark[r3+2][c3] = true;
          var ext2 = r3 + 3;
          while (ext2 < ROWS && grid[ext2][c3] === g2) {
            mark[ext2][c3] = true;
            ext2++;
          }
        }
      }
    }
    for (var r4 = 0; r4 < ROWS; r4++) {
      for (var c4 = 0; c4 < COLS; c4++) {
        if (mark[r4][c4]) matched.push([r4, c4]);
      }
    }
    return matched;
  }

  function applyClears(matches) {
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      clearMask[m[0]][m[1]] = true;
    }
    score += matches.length * 10;
    if (score > best) best = score;
    try { Audio.play('gem'); } catch(e) {}
  }

  function collapseGrid() {
    for (var c = 0; c < COLS; c++) {
      var drops = 0;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (clearMask[r][c]) {
          drops++;
        } else if (drops > 0) {
          grid[r + drops][c] = grid[r][c];
          fallOffsets[r + drops][c] = -drops;
        }
      }
      for (var k = 0; k < drops; k++) {
        grid[k][c] = randomGem();
        fallOffsets[k][c] = -(drops - k);
      }
    }
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var c2 = 0; c2 < COLS; c2++) {
        clearMask[r2][c2] = false;
      }
    }
  }

  function cellFromXY(x, y) {
    var c = Math.floor((x - GRID_X) / CELL);
    var r = Math.floor((y - GRID_Y) / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return [r, c];
    return null;
  }

  function adjacent(a, b) {
    return (Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1])) === 1;
  }

  function swapCells(a, b) {
    var tmp = grid[a[0]][a[1]];
    grid[a[0]][a[1]] = grid[b[0]][b[1]];
    grid[b[0]][b[1]] = tmp;
  }

  function init(c, b) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = b || 0;
    GRID_X = Math.floor((VW - COLS * CELL) / 2);
    GRID_Y = 220;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    timer = 60;
    timerAcc = 0;
    initGrid();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'matchgems_best'); } catch(e) {}
  }

  function update(dt) {
    if (state === 'PLAYING') {
      if (swapping) {
        swapT += dt;
        if (swapT >= SWAP_DUR) {
          swapT = SWAP_DUR;
          swapping = false;
          // check matches
          var matches = findMatches();
          if (matches.length === 0) {
            // swap back
            swapCells(swapA, swapB);
          } else {
            applyClears(matches);
            clearing = true;
            clearT = 0;
          }
          selected = null;
        }
        return;
      }
      if (clearing) {
        clearT += dt;
        if (clearT >= CLEAR_DUR) {
          clearing = false;
          collapseGrid();
          falling = true;
          fallT = 0;
        }
        return;
      }
      if (falling) {
        fallT += dt;
        if (fallT >= FALL_DUR) {
          falling = false;
          fallT = FALL_DUR;
          for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
              fallOffsets[r][c] = 0;
            }
          }
          // check cascade
          var m2 = findMatches();
          if (m2.length > 0) {
            applyClears(m2);
            clearing = true;
            clearT = 0;
          }
        }
        return;
      }
      timerAcc += dt;
      if (timerAcc >= 1) {
        timerAcc -= 1;
        timer--;
        if (timer <= 0) {
          timer = 0;
          endGame();
        }
      }
    }
  }

  function drawGem(cx, cy, colorIdx, alpha, scale) {
    if (alpha === undefined) alpha = 1;
    if (scale === undefined) scale = 1;
    var r = (CELL / 2 - 6) * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    // gem shape (hexagon-ish diamond)
    var color = GEM_COLORS[colorIdx];
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.6, -r * 0.3);
    ctx.lineTo(r * 0.6, r * 0.3);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.6, r * 0.3);
    ctx.lineTo(-r * 0.6, -r * 0.3);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // shine
    ctx.beginPath();
    ctx.moveTo(-r*0.2, -r*0.6);
    ctx.lineTo(r*0.15, -r*0.4);
    ctx.lineTo(r*0.05, -r*0.1);
    ctx.lineTo(-r*0.3, -r*0.25);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);

    // bg
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#1a0533');
    grad.addColorStop(1, '#0d0221');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MATCH GEMS', VW/2, 320);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#f39c12';
      ctx.fillText('Match 3 in a row or column!', VW/2, 390);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO PLAY', VW/2, 480);
      if (best > 0) {
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Best: ' + best, VW/2, 540);
      }
      return;
    }

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 20, 50);
    ctx.textAlign = 'right';
    ctx.fillStyle = timer <= 10 ? '#e74c3c' : '#fff';
    ctx.fillText('Time: ' + timer + 's', VW - 20, 50);

    // timer bar
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 65, VW-40, 10);
    ctx.fillStyle = timer <= 10 ? '#e74c3c' : '#2ecc71';
    ctx.fillRect(20, 65, (VW-40) * (timer/60), 10);

    // grid bg
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    _roundRect(ctx, GRID_X - 8, GRID_Y - 8, COLS*CELL+16, ROWS*CELL+16, 12);
    ctx.fill();

    // gems
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var gx = GRID_X + c * CELL + CELL/2;
        var gy = GRID_Y + r * CELL + CELL/2;

        // selected highlight
        if (selected && selected[0] === r && selected[1] === c) {
          ctx.fillStyle = 'rgba(255,255,100,0.3)';
          ctx.beginPath();
          ctx.roundRect(GRID_X + c*CELL + 2, GRID_Y + r*CELL + 2, CELL-4, CELL-4, 8);
          ctx.fill();
        }

        var alpha = 1;
        var scale = 1;
        var dx = 0, dy = 0;

        if (clearing && clearMask[r][c]) {
          var p = clearT / CLEAR_DUR;
          alpha = 1 - p;
          scale = 1 + p * 0.4;
        }
        if (falling && fallOffsets[r][c] !== 0) {
          var fp = Math.min(fallT / FALL_DUR, 1);
          dy = fallOffsets[r][c] * CELL * (1 - fp);
        }
        if (swapping) {
          var sp = Math.min(swapT / SWAP_DUR, 1);
          if (swapA && swapA[0] === r && swapA[1] === c) {
            dx = (swapB[1] - swapA[1]) * CELL * sp;
            dy += (swapB[0] - swapA[0]) * CELL * sp;
          } else if (swapB && swapB[0] === r && swapB[1] === c) {
            dx = (swapA[1] - swapB[1]) * CELL * sp;
            dy += (swapA[0] - swapB[0]) * CELL * sp;
          }
        }

        drawGem(gx + dx, gy + dy, grid[r][c], alpha, scale);
      }
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TIME\'S UP!', VW/2, 340);
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#f39c12';
      ctx.fillText('Score: ' + score, VW/2, 400);
      ctx.fillStyle = '#aaa';
      ctx.font = '24px sans-serif';
      ctx.fillText('Best: ' + best, VW/2, 445);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO RETRY', VW/2, 520);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD')  { startGame(); return; }
    if (swapping || clearing || falling) return;

    var cell = cellFromXY(x, y);
    if (!cell) { selected = null; return; }

    if (!selected) {
      selected = cell;
      return;
    }

    if (selected[0] === cell[0] && selected[1] === cell[1]) {
      selected = null;
      return;
    }

    if (adjacent(selected, cell)) {
      swapA = selected;
      swapB = cell;
      swapCells(swapA, swapB);
      swapping = true;
      swapT = 0;
      selected = null;
      try { Audio.play('tap'); } catch(e) {}
    } else {
      selected = cell;
    }
  }

  function _roundRect(ctx, x, y, w, h, r) {
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

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
