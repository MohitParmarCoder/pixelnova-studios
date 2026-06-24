'use strict';
var CaveRunner = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score, lives;
  var grid, playerRow, playerCol, depth;
  var particles, flashText, flashTimer;

  var COLS = 7;
  var ROWS = 12; // grows dynamically
  var CELL_W = 50, CELL_H = 60;
  var GRID_X = 20, GRID_Y = 80;

  var TYPE_ROCK = 0;
  var TYPE_GEM = 1;
  var TYPE_GOLD = 2;
  var TYPE_BOMB = 3;
  var TYPE_EMPTY = 4;

  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

  function spawnParticles(x, y, col) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * rnd(50, 130),
        vy: Math.sin(a) * rnd(50, 130),
        life: 0.6, maxLife: 0.6,
        r: rnd(3, 6),
        color: col
      });
    }
  }

  function makeNewRows(count) {
    for (var r = 0; r < count; r++) {
      var newRow = [];
      for (var c2 = 0; c2 < COLS; c2++) {
        var rr = Math.random();
        var t;
        if (rr < 0.60) t = TYPE_ROCK;
        else if (rr < 0.85) t = TYPE_GEM;
        else if (rr < 0.95) t = TYPE_GOLD;
        else t = TYPE_BOMB;
        newRow[c2] = t;
      }
      grid.push(newRow);
      ROWS = grid.length;
    }
  }

  function makeGrid() {
    ROWS = 12;
    grid = [];
    for (var row = 0; row < ROWS; row++) {
      grid[row] = [];
      for (var col = 0; col < COLS; col++) {
        if (row === 0 && col === 3) {
          // starting cell is empty
          grid[row][col] = TYPE_EMPTY;
          continue;
        }
        var r = Math.random();
        var type;
        if (r < 0.60) type = TYPE_ROCK;
        else if (r < 0.85) type = TYPE_GEM;
        else if (r < 0.95) type = TYPE_GOLD;
        else type = TYPE_BOMB;
        grid[row][col] = type;
      }
    }
  }

  function isReachable(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (grid[row][col] === TYPE_EMPTY) return false;
    var dr = Math.abs(row - playerRow);
    var dc = Math.abs(col - playerCol);
    return (dr + dc === 1);
  }

  function hasAnyReachable() {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = playerRow + dirs[i][0];
      var nc = playerCol + dirs[i][1];
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] !== TYPE_EMPTY) {
        return true;
      }
    }
    return false;
  }

  function startGame() {
    score = 0;
    lives = 3;
    depth = 0;
    particles = [];
    flashText = '';
    flashTimer = 0;
    makeGrid();
    playerRow = 0;
    playerCol = 3;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function init(canvas, bestScore) {
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    score = 0;
    lives = 3;
    depth = 0;
    particles = [];
    flashText = '';
    flashTimer = 0;
    grid = [];
    playerRow = 0;
    playerCol = 3;
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    var i, p;

    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (flashTimer > 0) flashTimer -= dt;

    if (state !== 'PLAYING') return;

    // Extend grid when player nears the bottom
    if (playerRow >= ROWS - 3) {
      makeNewRows(4);
    }

    // Check if any moves remain
    if (!hasAnyReachable()) {
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      state = 'DEAD';
      try { Audio.play('lose'); } catch(e) {}
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      AdManager.showInterstitial(() => {});
      try { AdManager.offerDoubleScore(score, 'caverunner_best'); } catch(e) {}
    }
  }

  function cellCenter(row, col) {
    return {
      x: GRID_X + col * CELL_W + CELL_W / 2,
      y: GRID_Y + row * CELL_H + CELL_H / 2
    };
  }

  function drawHUD() {
    ctx.font = 'bold 24px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e53e3e';
    var heartsStr = '';
    for (var i = 0; i < 3; i++) {
      heartsStr += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(heartsStr, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(score, VW - 14, 14);
    // depth indicator bottom-left
    ctx.fillStyle = 'rgba(168,237,234,0.8)';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Depth: ' + depth, 14, VH - 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function draw() {
    var i, row, col, cell, cx, cy, cc;
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 52px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ffd700';
      ctx.fillText('CAVE RUNNER', VW / 2, 280);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '20px system-ui';
      ctx.fillText('Tap adjacent cells to dig!', VW / 2, 350);
      ctx.fillText('Avoid bombs, collect gems & gold', VW / 2, 378);

      // legend
      var items = [
        { label: '■ Rock (+1)', color: '#888888' },
        { label: '◆ Gem (+10)', color: '#44ff88' },
        { label: '★ Gold (+25)', color: '#ffd700' },
        { label: '● Bomb (-life)', color: '#ff4444' }
      ];
      for (i = 0; i < items.length; i++) {
        ctx.fillStyle = items[i].color;
        ctx.font = '18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(items[i].label, VW / 2, 440 + i * 28);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
      ctx.globalAlpha = pulse;
      ctx.fillText('TAP TO PLAY', VW / 2, 570);
      ctx.globalAlpha = 1;
      if (best > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '20px system-ui';
        ctx.fillText('BEST: ' + best, VW / 2, 620);
      }
      ctx.textBaseline = 'alphabetic';
      return;
    }

    // draw grid
    if (state === 'PLAYING' || state === 'DEAD') {
      for (row = 0; row < ROWS; row++) {
        for (col = 0; col < COLS; col++) {
          cell = grid[row][col];
          var rx = GRID_X + col * CELL_W;
          var ry = GRID_Y + row * CELL_H;
          var isPlayer = (row === playerRow && col === playerCol);
          var reach = (state === 'PLAYING') && isReachable(row, col);

          // cell background
          if (cell === TYPE_EMPTY) {
            ctx.fillStyle = '#0a0a18';
          } else if (isPlayer) {
            ctx.fillStyle = '#1a2a3a';
          } else if (reach) {
            ctx.fillStyle = 'rgba(100,200,255,0.15)';
          } else {
            ctx.fillStyle = '#14141e';
          }
          ctx.fillRect(rx + 2, ry + 2, CELL_W - 4, CELL_H - 4);

          // border
          if (reach) {
            ctx.strokeStyle = 'rgba(100,200,255,0.7)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(100,200,255,0.8)';
          } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
          }
          ctx.strokeRect(rx + 2, ry + 2, CELL_W - 4, CELL_H - 4);
          ctx.shadowBlur = 0;

          // content
          if (!isPlayer && cell !== TYPE_EMPTY) {
            cc = cellCenter(row, col);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (cell === TYPE_ROCK) {
              ctx.fillStyle = reach ? '#aaaaaa' : '#666666';
              ctx.font = '22px system-ui';
              ctx.fillText('■', cc.x, cc.y);
            } else if (cell === TYPE_GEM) {
              ctx.fillStyle = '#44ff88';
              ctx.shadowBlur = reach ? 10 : 4;
              ctx.shadowColor = '#44ff88';
              ctx.font = '22px system-ui';
              ctx.fillText('◆', cc.x, cc.y);
              ctx.shadowBlur = 0;
            } else if (cell === TYPE_GOLD) {
              ctx.fillStyle = '#ffd700';
              ctx.shadowBlur = reach ? 10 : 4;
              ctx.shadowColor = '#ffd700';
              ctx.font = '22px system-ui';
              ctx.fillText('★', cc.x, cc.y);
              ctx.shadowBlur = 0;
            } else if (cell === TYPE_BOMB) {
              ctx.fillStyle = reach ? '#ff4444' : '#882222';
              ctx.shadowBlur = reach ? 10 : 0;
              ctx.shadowColor = '#ff4444';
              ctx.font = '22px system-ui';
              ctx.fillText('●', cc.x, cc.y);
              ctx.shadowBlur = 0;
            }
          }

          // player
          if (isPlayer) {
            cx = GRID_X + col * CELL_W + CELL_W / 2;
            cy = GRID_Y + row * CELL_H + CELL_H / 2;
            ctx.fillStyle = '#00ddff';
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#00ddff';
            ctx.font = 'bold 26px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('@', cx, cy);
            ctx.shadowBlur = 0;
          }
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      drawHUD();
    }

    // particles
    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // flash
    if (flashTimer > 0 && flashText) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ffffff';
      ctx.fillText(flashText, VW / 2, VH / 2 - 60);
      ctx.restore();
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 52px system-ui';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, VH / 2 - 20);
      ctx.fillStyle = '#ffd700';
      ctx.font = '22px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui';
      var p2 = 0.65 + 0.35 * Math.sin(Date.now() * 0.005);
      ctx.globalAlpha = p2;
      ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 80);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  function tap(x, y) {
    var row, col, cc, pts;
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    // find tapped cell
    col = Math.floor((x - GRID_X) / CELL_W);
    row = Math.floor((y - GRID_Y) / CELL_H);

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    if (!isReachable(row, col)) return;

    cc = cellCenter(row, col);
    var cellType = grid[row][col];

    // move player to cell
    playerRow = row;
    playerCol = col;
    if (row > depth) depth = row;

    if (cellType === TYPE_ROCK) {
      grid[row][col] = TYPE_EMPTY;
      score += 1;
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      flashText = '+1';
      flashTimer = 0.4;
      spawnParticles(cc.x, cc.y, '#888888');
      try { Audio.play('tap'); } catch(e) {}
    } else if (cellType === TYPE_GEM) {
      grid[row][col] = TYPE_EMPTY;
      score += 10;
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      flashText = '+10';
      flashTimer = 0.5;
      spawnParticles(cc.x, cc.y, '#44ff88');
      try { Audio.play('gem'); } catch(e) {}
    } else if (cellType === TYPE_GOLD) {
      grid[row][col] = TYPE_EMPTY;
      score += 25;
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      flashText = '+25';
      flashTimer = 0.6;
      spawnParticles(cc.x, cc.y, '#ffd700');
      try { Audio.play('gem'); } catch(e) {}
    } else if (cellType === TYPE_BOMB) {
      grid[row][col] = TYPE_EMPTY;
      lives--;
      flashText = 'BOOM!';
      flashTimer = 0.7;
      spawnParticles(cc.x, cc.y, '#ff4444');
      try { Audio.play('crash'); } catch(e) {}
      if (lives <= 0) {
        if (score > best) { best = score; AdManager.happyTime(1.0); }
        state = 'DEAD';
        try { Audio.play('lose'); } catch(e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'caverunner_best'); } catch(e) {}
        return;
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
