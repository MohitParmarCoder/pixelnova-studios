'use strict';
function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch(e) {} }
var _msDone = {};
function _milestone(s) {
  var ms = [10,25,50,100,250,500];
  for (var i=0; i<ms.length; i++) {
    if (s >= ms[i] && !_msDone[ms[i]]) {
      _msDone[ms[i]] = true;
      vib([10,30,10]);
      try { Audio.play('highscore'); } catch(e) {}
      AdManager.happyTime(0.8);
      _showMsFlash(ms[i]);
      break;
    }
  }
}
function _showMsFlash(n) {
  if (typeof document === 'undefined') return;
  var el = document.createElement('div');
  el.textContent = n >= 100 ? n+'!!!' : n >= 50 ? n+'!!' : n+'!';
  Object.assign(el.style, {
    position:'fixed', top:'30%', left:'50%', transform:'translateX(-50%)',
    fontSize:'72px', fontWeight:'900', color:'#FFD700',
    textShadow:'0 0 30px #FFD700, 0 0 60px rgba(255,215,0,0.5)',
    fontFamily:'system-ui,sans-serif', zIndex:'9999',
    pointerEvents:'none', opacity:'1', transition:'opacity 1.5s ease 0.8s'
  });
  document.body.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; }, 100);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2500);
}

// Bubble Pop — classic bubble shooter. Global: BubblePop
// Virtual canvas 390 x 844.
var BubblePop = (function () {
  // ── Constants ────────────────────────────────────────────────────────────────
  var VW = 390, VH = 844;
  var R = 18;                 // bubble radius
  var COLS = 10;              // columns on even rows
  var CELL_W = 2 * R;         // 36
  var GRID_LEFT = (VW - COLS * CELL_W) / 2 + R; // centre x of first column
  var ROW_H = R * 1.74;       // vertical spacing for hex packing (~31.3)
  var TOP_Y = R + 24;         // y of first row centre
  var DEADLINE = 720;         // if any bubble centre passes this → game over
  var SHOOTER_X = 195, SHOOTER_Y = 800;
  var SHOOT_SPEED = 600;      // px/s
  var SHOTS_PER_DROP = 5;     // add a new top row every N shots

  var COLORS = ['#FF3355', '#00CCFF', '#FFDD00', '#00FF88', '#B06BFF'];
  var COLOR_DARK = ['#8a1226', '#0a5e80', '#8a7400', '#0a8048', '#5c3287'];

  // ── State ────────────────────────────────────────────────────────────────────
  var ctx, canvas;
  var state = 'MENU';        // MENU | PLAYING | DEAD | WIN
  var score = 0, _best = 0;
  var grid = [];             // grid[row] = array of cells (null or {color})
  var rowOffset = 0;         // 0 → even row layout, 1 → shifted; toggles as rows added
  var gridShiftY = 0;        // extra y pushdown applied to whole grid when rows added at top
  var shots = 0;             // shots since last row drop
  var curColor = 0, nextColor = 0;
  var aimX = SHOOTER_X, aimY = SHOOTER_Y - 200;
  var aiming = false;
  var flying = null;         // {x,y,vx,vy,color}
  var fallers = [];          // dropping bubbles {x,y,vx,vy,color,life}
  var pops = [];             // pop particles {x,y,vx,vy,color,life}
  var winTimer = 0;
  var level = 1;
  var t = 0;                 // global time for animation

  // ── Grid helpers ─────────────────────────────────────────────────────────────
  function rowCols(row) {
    // even rows (in current layout) have COLS, odd rows have COLS-1 and are shifted right by R
    return ((row + rowOffset) % 2 === 0) ? COLS : COLS - 1;
  }
  function isShifted(row) {
    return ((row + rowOffset) % 2 !== 0);
  }
  function cellX(row, col) {
    return GRID_LEFT + col * CELL_W + (isShifted(row) ? R : 0);
  }
  function cellY(row) {
    return TOP_Y + row * ROW_H + gridShiftY;
  }

  function newRowArray(row, fillProb, palette) {
    var n = rowCols(row);
    var arr = new Array(n);
    for (var c = 0; c < n; c++) {
      if (Math.random() < fillProb) {
        arr[c] = { color: palette[(Math.random() * palette.length) | 0] };
      } else {
        arr[c] = null;
      }
    }
    return arr;
  }

  function buildGrid(rows, fillProb, paletteSize) {
    grid = [];
    rowOffset = 0;
    gridShiftY = 0;
    var pal = [];
    for (var i = 0; i < paletteSize; i++) pal.push(i);
    for (var r = 0; r < rows; r++) {
      // top rows always full, lower rows sparser
      var p = (r < rows - 2) ? 1.0 : fillProb;
      grid.push(newRowArray(r, p, pal));
    }
  }

  function activePaletteSize() {
    return Math.min(COLORS.length, 3 + level); // 4,5,5...
  }

  // colors actually present in grid (so shooter only fires useful colors)
  function presentColors() {
    var set = {};
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      for (var c = 0; c < row.length; c++) {
        if (row[c]) set[row[c].color] = true;
      }
    }
    var out = [];
    for (var k in set) out.push(parseInt(k, 10));
    if (out.length === 0) for (var i = 0; i < activePaletteSize(); i++) out.push(i);
    return out;
  }

  function pickColor() {
    var p = presentColors();
    return p[(Math.random() * p.length) | 0];
  }

  function loadNext() {
    curColor = nextColor;
    nextColor = pickColor();
  }

  // ── Neighbours (hex) ─────────────────────────────────────────────────────────
  function neighbors(row, col) {
    var res = [];
    var shifted = isShifted(row);
    // same row
    res.push([row, col - 1]);
    res.push([row, col + 1]);
    // above & below depend on shift
    if (shifted) {
      res.push([row - 1, col]);
      res.push([row - 1, col + 1]);
      res.push([row + 1, col]);
      res.push([row + 1, col + 1]);
    } else {
      res.push([row - 1, col - 1]);
      res.push([row - 1, col]);
      res.push([row + 1, col - 1]);
      res.push([row + 1, col]);
    }
    return res;
  }

  function cellAt(row, col) {
    if (row < 0 || row >= grid.length) return undefined;
    if (col < 0 || col >= grid[row].length) return undefined;
    return grid[row][col];
  }

  // ── Find nearest empty grid cell to a point (for snapping) ───────────────────
  function nearestEmptyCell(x, y) {
    var best = null, bestD = Infinity;
    var approxRow = Math.round((y - TOP_Y - gridShiftY) / ROW_H);
    for (var r = Math.max(0, approxRow - 2); r <= approxRow + 2; r++) {
      if (r < 0) continue;
      // ensure row exists; extend grid downward if needed
      while (r >= grid.length) {
        grid.push(newEmptyRow(grid.length));
      }
      var n = rowCols(r);
      for (var c = 0; c < n; c++) {
        if (grid[r][c]) continue;
        var dx = x - cellX(r, c), dy = y - cellY(r);
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [r, c]; }
      }
    }
    return best;
  }

  function newEmptyRow(row) {
    var n = rowCols(row);
    var arr = new Array(n);
    for (var c = 0; c < n; c++) arr[c] = null;
    return arr;
  }

  // Does (x,y) collide with any existing bubble?
  function collidesWithGrid(x, y) {
    var approxRow = Math.round((y - TOP_Y - gridShiftY) / ROW_H);
    for (var r = Math.max(0, approxRow - 2); r <= approxRow + 2; r++) {
      if (r < 0 || r >= grid.length) continue;
      var n = grid[r].length;
      for (var c = 0; c < n; c++) {
        if (!grid[r][c]) continue;
        var dx = x - cellX(r, c), dy = y - cellY(r);
        if (dx * dx + dy * dy <= (2 * R - 2) * (2 * R - 2)) return true;
      }
    }
    return false;
  }

  // ── Flood fill same color ────────────────────────────────────────────────────
  function floodSameColor(row, col) {
    var start = cellAt(row, col);
    if (!start) return [];
    var color = start.color;
    var seen = {};
    var stack = [[row, col]];
    var found = [];
    while (stack.length) {
      var p = stack.pop();
      var key = p[0] + ',' + p[1];
      if (seen[key]) continue;
      var cell = cellAt(p[0], p[1]);
      if (!cell || cell.color !== color) continue;
      seen[key] = true;
      found.push(p);
      var nb = neighbors(p[0], p[1]);
      for (var i = 0; i < nb.length; i++) stack.push(nb[i]);
    }
    return found;
  }

  // ── Find bubbles connected to the top (row 0) ───────────────────────────────
  function findFloating() {
    var connected = {};
    var stack = [];
    // seed from row 0
    for (var c = 0; c < grid[0].length; c++) {
      if (grid[0][c]) stack.push([0, c]);
    }
    while (stack.length) {
      var p = stack.pop();
      var key = p[0] + ',' + p[1];
      if (connected[key]) continue;
      var cell = cellAt(p[0], p[1]);
      if (!cell) continue;
      connected[key] = true;
      var nb = neighbors(p[0], p[1]);
      for (var i = 0; i < nb.length; i++) {
        var nc = cellAt(nb[i][0], nb[i][1]);
        if (nc) stack.push(nb[i]);
      }
    }
    var floating = [];
    for (var r = 0; r < grid.length; r++) {
      for (var cc = 0; cc < grid[r].length; cc++) {
        if (grid[r][cc] && !connected[r + ',' + cc]) floating.push([r, cc]);
      }
    }
    return floating;
  }

  // ── Pop / drop bubbles ───────────────────────────────────────────────────────
  function popCells(cells) {
    for (var i = 0; i < cells.length; i++) {
      var r = cells[i][0], c = cells[i][1];
      var cell = grid[r][c];
      if (!cell) continue;
      spawnPop(cellX(r, c), cellY(r), cell.color);
      grid[r][c] = null;
    }
  }

  function dropCells(cells) {
    for (var i = 0; i < cells.length; i++) {
      var r = cells[i][0], c = cells[i][1];
      var cell = grid[r][c];
      if (!cell) continue;
      fallers.push({
        x: cellX(r, c), y: cellY(r),
        vx: (Math.random() - 0.5) * 60,
        vy: -40 - Math.random() * 60,
        color: cell.color, life: 2.5
      });
      grid[r][c] = null;
    }
  }

  function spawnPop(x, y, color) {
    for (var i = 0; i < 7; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 140;
      pops.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: color, life: 0.4 + Math.random() * 0.3, max: 0.7
      });
    }
  }

  function play(name) {
    try { Audio.play(name); } catch (e) {}
  }

  // ── Land flying bubble ───────────────────────────────────────────────────────
  function landBubble(x, y, color) {
    var cell = nearestEmptyCell(x, y);
    if (!cell) { flying = null; return; }
    var r = cell[0], c = cell[1];
    // safety: ensure within row bounds
    if (c < 0) c = 0;
    if (c >= grid[r].length) c = grid[r].length - 1;
    grid[r][c] = { color: color };
    play('hop');

    // match
    var group = floodSameColor(r, c);
    if (group.length >= 3) {
      popCells(group);
      score += group.length * 10;
      vib(8); _milestone(score);
      play('score');
      // floating
      var floating = findFloating();
      if (floating.length) {
        dropCells(floating);
        score += floating.length * 20;
        vib(8); _milestone(score);
        play('gem');
      }
    }
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }

    // game over check
    if (checkDeadline()) {
      gameOver();
      flying = null;
      return;
    }
    // win check
    if (isGridEmpty()) {
      doWin();
      flying = null;
      return;
    }

    // add a row periodically
    shots++;
    if (shots >= SHOTS_PER_DROP) {
      shots = 0;
      addTopRow();
      if (checkDeadline()) { gameOver(); }
    }
    flying = null;
  }

  function isGridEmpty() {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) return false;
      }
    }
    return true;
  }

  function checkDeadline() {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c] && cellY(r) + R >= DEADLINE) return true;
      }
    }
    return false;
  }

  function addTopRow() {
    // shift whole grid down by toggling rowOffset and adding a row at index 0
    rowOffset = (rowOffset + 1) % 2;
    var pal = presentColors();
    var nr = newRowArray(0, 1.0, pal); // full row
    grid.unshift(nr);
    // Every existing row's index increased by 1, so cellY grows naturally —
    // the whole cluster is effectively pushed down one row.
  }

  function gameOver() {
    state = 'DEAD';
    vib([40,80,80]);
    play('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    try { AdManager.showInterstitial(function () {}); } catch (e) {}
    try { AdManager.offerDoubleScore(getScore(), 'bubblepop_best'); } catch(e) {}
  }

  function doWin() {
    state = 'WIN';
    winTimer = 1.4;
    play('power');
    score += 100; // clear bonus
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
  }

  // ── Reset / start ────────────────────────────────────────────────────────────
  function startGame() {
    _msDone = {};
    score = 0;
    level = 1;
    shots = 0;
    fallers = [];
    pops = [];
    flying = null;
    buildGrid(6, 0.6, activePaletteSize());
    nextColor = pickColor();
    loadNext();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function nextLevel() {
    level++;
    shots = 0;
    var rows = Math.min(9, 6 + level);
    buildGrid(rows, 0.7, activePaletteSize());
    nextColor = pickColor();
    loadNext();
    state = 'PLAYING';
  }

  // ── Public input ─────────────────────────────────────────────────────────────
  function aim(vx, vy) {
    if (state !== 'PLAYING' || flying) return;
    aiming = true;
    aimX = vx; aimY = vy;
  }

  function shoot(vx, vy) {
    if (state !== 'PLAYING') return;
    if (flying) return;
    aiming = false;
    var dx = vx - SHOOTER_X;
    var dy = vy - SHOOTER_Y;
    // clamp to upward angles: dy must be sufficiently negative
    if (dy > -8) dy = -8;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    // limit horizontal angle so it never goes near-horizontal
    var ang = Math.atan2(dy, dx); // in (-PI..0) roughly
    var minA = -Math.PI + 0.32;   // ~ -2.82  (left limit)
    var maxA = -0.32;             // right limit
    if (ang > maxA) ang = maxA;
    if (ang < minA) ang = minA;
    flying = {
      x: SHOOTER_X, y: SHOOTER_Y,
      vx: Math.cos(ang) * SHOOT_SPEED,
      vy: Math.sin(ang) * SHOOT_SPEED,
      color: curColor
    };
    loadNext();
    play('tap');
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      try { Audio.play('button'); } catch (e) {}
      startGame();
    } else if (state === 'DEAD') {
      try { Audio.play('button'); } catch (e) {}
      try {
        AdManager.showInterstitial(function () { startGame(); });
      } catch (e) { startGame(); }
    } else if (state === 'WIN') {
      nextLevel();
    } else if (state === 'PLAYING') {
      shoot(vx, vy);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    t += dt;

    // particles always
    var i;
    for (i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt;
      if (p.life <= 0) pops.splice(i, 1);
    }
    for (i = fallers.length - 1; i >= 0; i--) {
      var f = fallers[i];
      f.life -= dt;
      f.vy += 900 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y - R > VH || f.life <= 0) fallers.splice(i, 1);
    }

    if (state === 'WIN') {
      winTimer -= dt;
      if (winTimer <= 0) nextLevel();
      return;
    }

    if (state !== 'PLAYING') return;

    // flying bubble
    if (flying) {
      // sub-step for stable collision
      var steps = 4;
      var sdt = dt / steps;
      for (var s = 0; s < steps && flying; s++) {
        flying.x += flying.vx * sdt;
        flying.y += flying.vy * sdt;
        // wall bounce
        if (flying.x < R) { flying.x = R; flying.vx = Math.abs(flying.vx); play('crash'); }
        else if (flying.x > VW - R) { flying.x = VW - R; flying.vx = -Math.abs(flying.vx); play('crash'); }
        // top wall
        if (flying.y <= TOP_Y) {
          landBubble(flying.x, Math.max(flying.y, TOP_Y), flying.color);
          break;
        }
        // grid collision
        if (collidesWithGrid(flying.x, flying.y)) {
          landBubble(flying.x, flying.y, flying.color);
          break;
        }
      }
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────
  function drawBubble(x, y, color, alpha) {
    var c = COLORS[color], cd = COLOR_DARK[color];
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    // body gradient
    var g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.2, x, y, R);
    g.addColorStop(0, c);
    g.addColorStop(1, cd);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R - 1, 0, Math.PI * 2);
    ctx.fill();
    // rim
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - R * 0.32, y - R * 0.38, R * 0.32, R * 0.2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGrid() {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) drawBubble(cellX(r, c), cellY(r), grid[r][c].color);
      }
    }
  }

  function drawShooter() {
    // base
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, R + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // current bubble
    drawBubble(SHOOTER_X, SHOOTER_Y, curColor);
    // next bubble preview (smaller, bottom-right)
    ctx.save();
    ctx.globalAlpha = 0.9;
    var nx = SHOOTER_X + 70, ny = SHOOTER_Y;
    var g = ctx.createRadialGradient(nx - 5, ny - 5, 2, nx, ny, R * 0.6);
    g.addColorStop(0, COLORS[nextColor]);
    g.addColorStop(1, COLOR_DARK[nextColor]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, R * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', nx, ny + R + 8);
    ctx.restore();
  }

  function drawAim() {
    if (!flying) {
      // compute aim direction clamped same as shoot
      var dx = aimX - SHOOTER_X, dy = aimY - SHOOTER_Y;
      if (dy > -8) dy = -8;
      var ang = Math.atan2(dy, dx);
      var minA = -Math.PI + 0.32, maxA = -0.32;
      if (ang > maxA) ang = maxA;
      if (ang < minA) ang = minA;
      var dirx = Math.cos(ang), diry = Math.sin(ang);

      // simple dotted ray with one wall bounce
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      var px = SHOOTER_X, py = SHOOTER_Y;
      var vxr = dirx, vyr = diry;
      var dist = 0;
      var step = 10;
      for (var k = 0; k < 90; k++) {
        px += vxr * step; py += vyr * step;
        if (px < R) { px = R; vxr = -vxr; }
        else if (px > VW - R) { px = VW - R; vxr = -vxr; }
        if (py < TOP_Y) break;
        if (collidesWithGrid(px, py)) break;
        dist++;
        if (k % 2 === 0) {
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawDeadline() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,60,90,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE);
    ctx.lineTo(VW, DEADLINE);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    var i;
    for (i = 0; i < fallers.length; i++) {
      var f = fallers[i];
      drawBubble(f.x, f.y, f.color, Math.min(1, f.life));
    }
    for (i = 0; i < pops.length; i++) {
      var p = pops[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = COLORS[p.color];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawScore() {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(score), VW / 2, 8);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('LV ' + level, VW / 2, 42);
    ctx.restore();
  }

  function drawCenterText(lines) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      ctx.fillStyle = L.color || '#fff';
      ctx.font = L.font;
      ctx.fillText(L.text, VW / 2, L.y);
    }
    ctx.restore();
  }

  function drawMenu() {
    // decorative bubbles
    for (var i = 0; i < 5; i++) {
      var bx = 70 + i * 60;
      var by = 230 + Math.sin(t * 1.5 + i) * 10;
      drawBubble(bx, by, i % COLORS.length);
    }
    drawCenterText([
      { text: 'BUBBLE POP', font: 'bold 46px sans-serif', y: 360, color: '#00CCFF' },
      { text: 'Match 3+ to pop!', font: '20px sans-serif', y: 410, color: 'rgba(255,255,255,0.8)' },
      { text: 'TAP TO PLAY', font: 'bold 24px sans-serif', y: 520, color: '#FFDD00' },
      { text: 'Best: ' + _best, font: '16px sans-serif', y: 570, color: 'rgba(255,255,255,0.5)' }
    ]);
  }

  function drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,24,0.78)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
    drawCenterText([
      { text: 'GAME OVER', font: 'bold 42px sans-serif', y: 320, color: '#FF3355' },
      { text: 'Score: ' + score, font: '24px sans-serif', y: 390, color: '#fff' },
      { text: 'Best: ' + _best, font: '20px sans-serif', y: 430, color: 'rgba(255,255,255,0.7)' },
      { text: 'TAP TO RETRY', font: 'bold 24px sans-serif', y: 530, color: '#FFDD00' }
    ]);
  }

  function drawWin() {
    drawCenterText([
      { text: 'CLEARED!', font: 'bold 46px sans-serif', y: 380, color: '#00FF88' },
      { text: '+100', font: 'bold 28px sans-serif', y: 440, color: '#FFDD00' }
    ]);
  }

  function draw() {
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawDeadline();
    drawGrid();
    drawParticles();

    if (state === 'PLAYING') {
      if (flying) drawBubble(flying.x, flying.y, flying.color);
      else drawAim();
      drawShooter();
    } else if (state === 'WIN') {
      drawShooter();
      drawWin();
    }

    drawScore();

    if (state === 'DEAD') {
      drawShooter();
      drawDead();
    }
  }

  // ── Init / public API ────────────────────────────────────────────────────────
  function init(cnv, best) {
    canvas = cnv;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    level = 1;
    // seed a decorative empty grid so draw() before play is safe
    buildGrid(6, 0.6, activePaletteSize());
    nextColor = pickColor();
    loadNext();
    state = 'MENU';
  }

  return {
    init: init,
    update: update,
    draw: draw,
    aim: aim,
    shoot: shoot,
    tap: tap,
    getScore: function () { return score; },
    getState: function () { return state; },
    getBest: function () { return _best; }
  };
})();
