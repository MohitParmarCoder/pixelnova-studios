'use strict';
var ColorMemory = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;
  var score = 0;
  var lives = 3;

  var TILE_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
  var TILE_LABELS = ['RED','BLUE','GREEN','YELLOW','PURPLE','TEAL'];

  var TILE_COLS = 3, TILE_ROWS = 2;
  var TILE_W = 110, TILE_H = 110;
  var TILE_PAD = 12;
  var TILES_X, TILES_Y;

  var sequence = [];
  var playerSeq = [];
  var seqLen = 3;

  var phase = 'SHOW'; // SHOW | WAIT
  var showIdx = 0;
  var showTimer = 0;
  var SHOW_HOLD = 0.5;
  var SHOW_GAP  = 0.2;
  var inGap = false;

  var flashIdx = -1;
  var flashT = 0;
  var wrongFlash = false;
  var wrongT = 0;

  function tileCenterXY(idx) {
    var c = idx % TILE_COLS;
    var r = Math.floor(idx / TILE_COLS);
    var totalW = TILE_COLS * TILE_W + (TILE_COLS-1)*TILE_PAD;
    var x = TILES_X + c * (TILE_W + TILE_PAD) + TILE_W/2;
    var y = TILES_Y + r * (TILE_H + TILE_PAD) + TILE_H/2;
    return [x, y];
  }

  function tileRect(idx) {
    var c = idx % TILE_COLS;
    var r = Math.floor(idx / TILE_COLS);
    var x = TILES_X + c * (TILE_W + TILE_PAD);
    var y = TILES_Y + r * (TILE_H + TILE_PAD);
    return [x, y, TILE_W, TILE_H];
  }

  function tileFromXY(x, y) {
    for (var i = 0; i < 6; i++) {
      var rect = tileRect(i);
      if (x >= rect[0] && x <= rect[0]+rect[2] && y >= rect[1] && y <= rect[1]+rect[3]) return i;
    }
    return -1;
  }

  function buildSequence() {
    sequence = [];
    for (var i = 0; i < seqLen; i++) {
      sequence.push(Math.floor(Math.random() * 6));
    }
  }

  function startShow() {
    phase = 'SHOW';
    showIdx = 0;
    showTimer = 0;
    inGap = false;
    flashIdx = sequence[0];
    flashT = 0;
    playerSeq = [];
  }

  function init(c, b) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = b || 0;
    var totalW = TILE_COLS * TILE_W + (TILE_COLS-1)*TILE_PAD;
    var totalH = TILE_ROWS * TILE_H + (TILE_ROWS-1)*TILE_PAD;
    TILES_X = Math.floor((VW - totalW) / 2);
    TILES_Y = 380;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    lives = 3;
    seqLen = 3;
    buildSequence();
    startShow();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (wrongFlash) {
      wrongT += dt;
      if (wrongT >= 0.4) wrongFlash = false;
    }

    if (phase === 'SHOW') {
      showTimer += dt;
      if (!inGap) {
        if (showTimer >= SHOW_HOLD) {
          flashIdx = -1;
          inGap = true;
          showTimer = 0;
        }
      } else {
        if (showTimer >= SHOW_GAP) {
          showIdx++;
          if (showIdx >= sequence.length) {
            phase = 'WAIT';
            flashIdx = -1;
          } else {
            flashIdx = sequence[showIdx];
            flashT = 0;
            inGap = false;
            showTimer = 0;
          }
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);

    // bg
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COLOR MEMORY', VW/2, 300);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Remember the sequence!', VW/2, 360);
      ctx.fillText('Repeat in the same order.', VW/2, 395);
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
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Score: ' + score, 20, 50);
    ctx.textAlign = 'right';
    ctx.fillText('Seq: ' + seqLen, VW-20, 50);
    // lives
    ctx.textAlign = 'left';
    for (var li = 0; li < 3; li++) {
      ctx.fillStyle = li < lives ? '#e74c3c' : '#333';
      ctx.beginPath();
      ctx.arc(20 + li*32, 80, 12, 0, Math.PI*2);
      ctx.fill();
    }

    // phase label
    ctx.textAlign = 'center';
    if (phase === 'SHOW') {
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('WATCH THE SEQUENCE...', VW/2, 170);
      // dots
      for (var si = 0; si < sequence.length; si++) {
        ctx.fillStyle = si < showIdx ? '#555' : (si === showIdx && !inGap ? TILE_COLORS[sequence[si]] : '#333');
        ctx.beginPath();
        ctx.arc(VW/2 + (si - sequence.length/2 + 0.5)*22, 200, 8, 0, Math.PI*2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('YOUR TURN! (' + playerSeq.length + '/' + sequence.length + ')', VW/2, 170);
    }

    // wrong flash overlay
    if (wrongFlash) {
      ctx.fillStyle = 'rgba(231,76,60,' + (0.4 * (1 - wrongT/0.4)) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }

    // tiles
    for (var ti = 0; ti < 6; ti++) {
      var rect = tileRect(ti);
      var lit = (flashIdx === ti);
      ctx.fillStyle = lit ? TILE_COLORS[ti] : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(rect[0], rect[1], rect[2], rect[3], 16);
      ctx.fill();
      if (lit) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = lit ? '#fff' : TILE_COLORS[ti];
      ctx.font = 'bold ' + (lit ? '20px' : '18px') + ' sans-serif';
      ctx.fillText(TILE_LABELS[ti], rect[0]+TILE_W/2, rect[1]+TILE_H/2+7);
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
    if (phase !== 'WAIT') return;

    var ti = tileFromXY(x, y);
    if (ti < 0) return;

    flashIdx = ti;
    setTimeout(function () { flashIdx = -1; }, 200);

    playerSeq.push(ti);
    var idx = playerSeq.length - 1;

    if (playerSeq[idx] !== sequence[idx]) {
      // wrong
      lives--;
      wrongFlash = true;
      wrongT = 0;
      try { Audio.play('crash'); } catch(e) {}
      if (lives <= 0) { endGame(); return; }
      // restart same sequence
      setTimeout(function () {
        startShow();
      }, 500);
      return;
    }

    try { Audio.play('tap'); } catch(e) {}

    if (playerSeq.length === sequence.length) {
      // correct!
      score = Math.max(score, seqLen);
      if (score > best) best = score;
      seqLen++;
      try { Audio.play('gem'); } catch(e) {}
      buildSequence();
      setTimeout(function () { startShow(); }, 600);
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
