'use strict';
var SymbolHunt = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, grid, target, timer, timerMax, found;
  var SYMBOLS = ['♦','♠','♥','♣','★','◆','●','▲'];
  var COLS = 5, ROWS = 7;
  var CELL = 62;
  var GRID_X = (VW - COLS * CELL) / 2;
  var GRID_Y = 200;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function newRound() {
    target = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    grid = [];
    var count = 0;
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var sym;
        if (count < 3 && Math.random() < 0.3) { sym = target; count++; }
        else { do { sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; } while (sym === target); }
        grid.push({ col: col, row: row, sym: sym, found: false });
      }
    }
    if (count === 0) {
      var idx = Math.floor(Math.random() * grid.length);
      grid[idx].sym = target;
    }
    found = 0;
    timerMax = Math.max(3, 6 - score * 0.1);
    timer = timerMax;
  }

  function startGame() {
    score = 0; lives = 3;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    newRound();
  }

  function countTarget() {
    var n = 0;
    grid.forEach(function(cell) { if (cell.sym === target && !cell.found) n++; });
    return n;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    timer -= dt;
    if (timer <= 0) {
      if (countTarget() > 0) {
        lives--;
        try { Audio.play('lose'); } catch(e) {}
        if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} return; }
      }
      newRound();
    }
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#080020'); g.addColorStop(1, '#001040');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700';
      ctx.fillText('SYMBOL HUNT', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Find the matching symbols!', VW/2, 340);
      ctx.fillText('TAP TO PLAY', VW/2, 400);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 460);
      return;
    }

    ctx.fillStyle = '#a8edea'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Find:', VW/2, 100);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 16; ctx.shadowColor = '#FFD700';
    ctx.fillText(target, VW/2, 165);
    ctx.shadowBlur = 0;

    var timerFrac = Math.max(0, timer / timerMax);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, 174, VW-40, 8);
    ctx.fillStyle = timerFrac > 0.5 ? '#6BCB77' : timerFrac > 0.25 ? '#FFD700' : '#f87171';
    ctx.fillRect(20, 174, (VW-40) * timerFrac, 8);

    grid.forEach(function(cell) {
      var cx = GRID_X + cell.col * CELL + CELL/2;
      var cy = GRID_Y + cell.row * CELL + CELL/2;
      if (cell.found) {
        ctx.fillStyle = 'rgba(107,203,119,0.3)';
        ctx.fillRect(GRID_X + cell.col*CELL+2, GRID_Y + cell.row*CELL+2, CELL-4, CELL-4);
        ctx.fillStyle = '#6BCB77'; ctx.font = '26px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('✓', cx, cy+9);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(GRID_X + cell.col*CELL+2, GRID_Y + cell.row*CELL+2, CELL-4, CELL-4);
        ctx.fillStyle = '#a8edea';
        ctx.font = '26px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(cell.sym, cx, cy+9);
      }
    });

    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Rounds: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    var col = Math.floor((x - GRID_X) / CELL);
    var row = Math.floor((y - GRID_Y) / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    var idx = row * COLS + col;
    if (idx < 0 || idx >= grid.length || grid[idx].found) return;

    if (grid[idx].sym === target) {
      grid[idx].found = true; found++;
      score++; if (score > best) best = score;
      try { Audio.play('gem'); } catch(e) {}
      if (countTarget() === 0) { setTimeout(function() { if (state==='PLAYING') newRound(); }, 400); }
    } else {
      lives--;
      try { Audio.play('crash'); } catch(e) {}
      if (lives <= 0) { state = 'DEAD'; try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {} }
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
