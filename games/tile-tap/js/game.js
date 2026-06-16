'use strict';

/* Tile Tap — Piano Tiles style. 4 lanes, tiles scroll down, tap before they fall off. */
var TileTap = (function () {
  var VW = 390, VH = 844;
  var LANES = 4;
  var LANE_W = VW / LANES;          // 97.5
  var TILE_H = 140;
  var ROW_GAP = TILE_H;             // one tile per row, rows spaced by tile height

  var BASE_SPEED = 300;             // px/s
  var SPEED_CAP = 650;

  var canvas, ctx;
  var state = 'MENU';               // 'MENU' | 'PLAYING' | 'DEAD'
  var score = 0, _best = 0;
  var speed = BASE_SPEED;
  var tiles = [];                   // {lane, y, color, hit, flash}
  var t = 0;                        // global time for animation
  var deadLane = -1;                // lane to highlight red on death
  var deadTile = null;              // tile to highlight red on death

  var COLORS = ['#ff3b6b', '#33e1ff', '#ffd23b', '#7c4dff', '#2bff88', '#ff7a33'];

  function rnd(n) { return Math.floor(Math.random() * n); }

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function curSpeed() {
    var s = BASE_SPEED + Math.floor(score / 5) * 12;
    return s > SPEED_CAP ? SPEED_CAP : s;
  }

  function spawnRow(topY) {
    var lane = rnd(LANES);
    tiles.push({
      lane: lane,
      y: topY,
      color: COLORS[rnd(COLORS.length)],
      hit: false,
      flash: 0
    });
  }

  function resetGame() {
    score = 0;
    speed = BASE_SPEED;
    tiles = [];
    deadLane = -1;
    deadTile = null;
    // Pre-fill a column of rows from above the screen down toward the visible area.
    // Start the lowest row near the top so the player has reaction time.
    var startY = -TILE_H;
    for (var i = 0; i < 8; i++) {
      spawnRow(startY - i * ROW_GAP);
    }
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function gameOver(lane, tile) {
    state = 'DEAD';
    deadLane = (lane === undefined) ? -1 : lane;
    deadTile = tile || null;
    snd('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    try { AdManager.showInterstitial(function () {}); } catch (e) {}
    try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'tiletap_best'); } catch(e) {}
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    tiles = [];
    t = 0;
  }

  function update(dt) {
    t += dt;
    if (state !== 'PLAYING') {
      // keep flashes ticking on dead screen so the highlight pulses
      for (var k = 0; k < tiles.length; k++) {
        if (tiles[k].flash > 0) tiles[k].flash = Math.max(0, tiles[k].flash - dt * 3);
      }
      return;
    }

    speed = curSpeed();
    var dy = speed * dt;

    // Move tiles down.
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      tl.y += dy;
      if (tl.flash > 0) tl.flash = Math.max(0, tl.flash - dt * 3);
    }
    // Maintain a steady supply: keep tiles stacked above the screen so a new
    // row appears whenever the topmost tile has descended past the spawn line.
    var topMost = Infinity;
    for (var j = 0; j < tiles.length; j++) {
      if (tiles[j].y < topMost) topMost = tiles[j].y;
    }
    while (topMost > -TILE_H - ROW_GAP) {
      var newY = topMost - ROW_GAP;
      spawnRow(newY);
      topMost = newY;
    }

    // Check for missed tiles (fell off the bottom without being hit).
    for (var m = 0; m < tiles.length; m++) {
      var mt = tiles[m];
      if (!mt.hit && mt.y > VH) {
        gameOver(mt.lane, mt);
        return;
      }
    }

    // Cull hit tiles whose flash finished and that have scrolled away.
    tiles = tiles.filter(function (tt) {
      if (tt.hit && tt.flash <= 0) return false;
      if (tt.y > VH + TILE_H) return false;
      return true;
    });
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      startGame();
      try { Audio.play('button'); } catch (e) {}
      return;
    }
    if (state === 'DEAD') {
      try {
        AdManager.showInterstitial(function () { startGame(); });
      } catch (e) {
        startGame();
      }
      try { Audio.play('button'); } catch (e) {}
      return;
    }

    // PLAYING
    var lane = Math.floor(vx / LANE_W);
    if (lane < 0) lane = 0;
    if (lane >= LANES) lane = LANES - 1;

    // Find the lowest (largest y) un-hit tile in this lane within the playable band.
    var target = null;
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      if (tl.lane !== lane || tl.hit) continue;
      // Tile occupies [y, y+TILE_H]; it's tappable while any part is on screen.
      if (tl.y + TILE_H < 0 || tl.y > VH) continue;
      if (!target || tl.y > target.y) target = tl;
    }

    if (target) {
      target.hit = true;
      target.flash = 1;
      score++;
      snd('score');
      if (score > _best) _best = score;
    } else {
      // Tapped an empty lane -> game over.
      gameOver(lane, null);
    }
  }

  function getScore() { return score; }
  function getState() { return state; }
  function getBest() { return _best; }

  // ---- Rendering ----

  function clearBg() {
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawLaneSeparators() {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    for (var i = 1; i < LANES; i++) {
      var x = i * LANE_W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VH);
      ctx.stroke();
    }
  }

  function lowestTile() {
    var low = null;
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      if (tl.hit) continue;
      if (!low || tl.y > low.y) low = tl;
    }
    return low;
  }

  function drawTile(tl, highlight) {
    var x = tl.lane * LANE_W;
    var pad = 4;
    var w = LANE_W - pad * 2;
    var h = TILE_H - pad * 2;
    var px = x + pad;
    var py = tl.y + pad;

    if (tl.hit && tl.flash > 0) {
      // White flash on tap.
      ctx.globalAlpha = Math.max(0, tl.flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, py, w, h);
      ctx.globalAlpha = 1;
      return;
    }

    // Body
    ctx.fillStyle = tl.color;
    ctx.fillRect(px, py, w, h);

    // Glow / highlight band
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px, py, w, h * 0.35);

    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, w, h);
    }
  }

  function drawDeadHighlight() {
    if (deadTile) {
      var x = deadTile.lane * LANE_W;
      ctx.fillStyle = 'rgba(255,40,60,0.30)';
      ctx.fillRect(x, 0, LANE_W, VH);
      ctx.strokeStyle = '#ff2a3c';
      ctx.lineWidth = 4;
      ctx.strokeRect(deadTile.lane * LANE_W + 4, deadTile.y + 4, LANE_W - 8, TILE_H - 8);
    } else if (deadLane >= 0) {
      ctx.fillStyle = 'rgba(255,40,60,0.30)';
      ctx.fillRect(deadLane * LANE_W, 0, LANE_W, VH);
    }
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.fillStyle = color;
    ctx.font = (weight || '700') + ' ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawScore() {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    text(String(score), VW / 2, 70, 56, '#ffffff', 'center', '800');
    ctx.restore();
  }

  function drawTiles() {
    var low = (state === 'PLAYING') ? lowestTile() : null;
    for (var i = 0; i < tiles.length; i++) {
      drawTile(tiles[i], low && tiles[i] === low);
    }
  }

  function drawMenu() {
    clearBg();
    drawLaneSeparators();

    ctx.save();
    var pulse = 0.5 + 0.5 * Math.sin(t * 2);

    text('TILE', VW / 2, VH * 0.32, 72, '#33e1ff', 'center', '800');
    text('TAP', VW / 2, VH * 0.32 + 78, 72, '#ff3b6b', 'center', '800');

    text('Tap the falling tiles!', VW / 2, VH * 0.55, 24, '#cfd2e6', 'center', '600');

    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    text('TAP TO PLAY', VW / 2, VH * 0.72, 32, '#ffd23b', 'center', '700');
    ctx.globalAlpha = 1;

    if (_best > 0) {
      text('BEST  ' + _best, VW / 2, VH * 0.82, 22, '#8a8fb0', 'center', '600');
    }
    ctx.restore();
  }

  function drawDead() {
    clearBg();
    drawLaneSeparators();
    drawTiles();
    drawDeadHighlight();

    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    text('GAME OVER', VW / 2, VH * 0.30, 48, '#ff3b6b', 'center', '800');
    text('SCORE', VW / 2, VH * 0.44, 22, '#8a8fb0', 'center', '600');
    text(String(score), VW / 2, VH * 0.50, 60, '#ffffff', 'center', '800');
    text('BEST  ' + _best, VW / 2, VH * 0.60, 24, '#ffd23b', 'center', '700');

    var pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    text('TAP TO RETRY', VW / 2, VH * 0.74, 30, '#33e1ff', 'center', '700');
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlaying() {
    clearBg();
    drawLaneSeparators();
    drawTiles();
    drawScore();
  }

  function draw() {
    if (!ctx) return;
    if (state === 'MENU') drawMenu();
    else if (state === 'PLAYING') drawPlaying();
    else drawDead();
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getScore: getScore,
    getState: getState,
    getBest: getBest
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = TileTap; }
