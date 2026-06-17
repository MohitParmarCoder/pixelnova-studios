'use strict';
var SequenceGame = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;
  var score = 0;
  var lives = 3;
  var round = 0;

  var COLS = 3, ROWS = 3;
  var TILE_W = 100, TILE_H = 100;
  var TILE_PAD = 12;
  var GRID_X, GRID_Y;

  var tiles = []; // [{num, x, y, flashT, wrongFlash}]
  var nextExpected = 1;
  var roundTimer = 0;
  var baseTime = 8; // seconds for round
  var roundLimit = 8;
  var flashTiles = {};
  var wrongTile = -1;
  var wrongT = 0;

  function buildTiles() {
    // place 1-9 randomly in 3x3 grid slots
    var slots = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        slots.push([c, r]);
      }
    }
    // shuffle slots
    for (var j = slots.length-1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j+1));
      var tmp = slots[j]; slots[j] = slots[k]; slots[k] = tmp;
    }
    tiles = [];
    for (var i = 0; i < 9; i++) {
      var col = slots[i][0];
      var row = slots[i][1];
      tiles.push({
        num: i+1,
        x: GRID_X + col*(TILE_W+TILE_PAD) + TILE_W/2,
        y: GRID_Y + row*(TILE_H+TILE_PAD) + TILE_H/2,
        flashT: 0,
        lit: false
      });
    }
    nextExpected = 1;
    roundTimer = 0;
    roundLimit = Math.max(3, baseTime - round * 0.5);
    flashTiles = {};
    wrongTile = -1;
  }

  function init(c, b) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = b || 0;
    var totalW = COLS*(TILE_W+TILE_PAD)-TILE_PAD;
    GRID_X = Math.floor((VW - totalW)/2);
    GRID_Y = 250;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    lives = 3;
    round = 0;
    buildTiles();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  function nextRound() {
    round++;
    score = round;
    if (score > best) best = score;
    try { Audio.play('gem'); } catch(e) {}
    buildTiles();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    roundTimer += dt;
    if (roundTimer >= roundLimit) {
      lives--;
      try { Audio.play('crash'); } catch(e) {}
      if (lives <= 0) { endGame(); return; }
      buildTiles();
      return;
    }

    if (wrongT > 0) {
      wrongT -= dt;
      if (wrongT < 0) { wrongT = 0; wrongTile = -1; }
    }

    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].lit) {
        tiles[i].flashT += dt;
        if (tiles[i].flashT >= 0.25) {
          tiles[i].lit = false;
          tiles[i].flashT = 0;
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    var grad = ctx.createLinearGradient(0,0,0,VH);
    grad.addColorStop(0,'#12192b');
    grad.addColorStop(1,'#0a0f1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEQUENCE', VW/2, 300);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Tap numbers 1 to 9 in order!', VW/2, 360);
      ctx.fillText('Faster each round.', VW/2, 395);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO PLAY', VW/2, 480);
      if (best > 0) {
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Best: ' + best + ' rounds', VW/2, 540);
      }
      return;
    }

    // HUD
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Round: ' + (round+1), 20, 50);
    ctx.textAlign = 'right';
    ctx.fillText('Score: ' + score, VW-20, 50);
    // lives
    ctx.textAlign = 'left';
    for (var li = 0; li < 3; li++) {
      ctx.fillStyle = li < lives ? '#e74c3c' : '#333';
      ctx.beginPath();
      ctx.arc(22 + li*34, 80, 13, 0, Math.PI*2);
      ctx.fill();
    }

    // timer bar
    var timeRatio = 1 - (roundTimer / roundLimit);
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 100, VW-40, 10);
    ctx.fillStyle = timeRatio < 0.3 ? '#e74c3c' : '#3498db';
    ctx.fillRect(20, 100, (VW-40)*timeRatio, 10);

    // "next" label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('TAP: ' + nextExpected, VW/2, 155);

    // tiles
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var tx = tile.x, ty = tile.y;
      var isWrong = (wrongTile === tile.num);
      var isLit = tile.lit;

      ctx.save();
      if (isLit) {
        ctx.shadowColor = '#3498db';
        ctx.shadowBlur = 20;
      }
      ctx.fillStyle = isWrong ? '#e74c3c' : (isLit ? '#3498db' : '#1e2d40');
      ctx.beginPath();
      ctx.roundRect(tx - TILE_W/2, ty - TILE_H/2, TILE_W, TILE_H, 14);
      ctx.fill();

      ctx.strokeStyle = isWrong ? '#ff6b6b' : (isLit ? '#74b9ff' : '#2d4a6a');
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = isWrong ? '#fff' : (isLit ? '#fff' : '#8ab4d4');
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.num, tx, ty);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', VW/2, 340);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#f39c12';
      ctx.fillText('Score: ' + score + ' rounds', VW/2, 405);
      ctx.fillStyle = '#aaa';
      ctx.font = '24px sans-serif';
      ctx.fillText('Best: ' + best, VW/2, 450);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO RETRY', VW/2, 520);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD')  { startGame(); return; }

    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var dx = x - tile.x, dy = y - tile.y;
      if (Math.abs(dx) <= TILE_W/2 && Math.abs(dy) <= TILE_H/2) {
        if (tile.num === nextExpected) {
          tile.lit = true;
          tile.flashT = 0;
          nextExpected++;
          try { Audio.play('tap'); } catch(e) {}
          if (nextExpected > 9) {
            nextRound();
          }
        } else {
          wrongTile = tile.num;
          wrongT = 0.4;
          lives--;
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { endGame(); return; }
          buildTiles();
        }
        return;
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
