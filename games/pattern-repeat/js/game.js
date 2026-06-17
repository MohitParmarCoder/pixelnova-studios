'use strict';
var PatternRepeat = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, sequence, playerSeq, showing, showIdx, showTimer, inputReady;
  var lives;

  var COLORS = ['#FF6B6B','#4EC5F1','#6BCB77','#FFD700'];
  var ZONES = [
    {x:0,   y:VH/2, w:VW/2, h:VH/2, color:'#FF6B6B', label:'A'},
    {x:VW/2,y:VH/2, w:VW/2, h:VH/2, color:'#4EC5F1', label:'B'},
    {x:0,   y:150,  w:VW/2, h:VH/2-150, color:'#6BCB77', label:'C'},
    {x:VW/2,y:150,  w:VW/2, h:VH/2-150, color:'#FFD700', label:'D'}
  ];
  var flash = -1, flashTimer = 0;

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function startGame() {
    score = 0; lives = 3; sequence = []; playerSeq = [];
    showing = false; inputReady = false; flash = -1;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    addToSequence();
  }

  function addToSequence() {
    sequence.push(Math.floor(Math.random() * 4));
    playerSeq = [];
    showIdx = 0; showTimer = 0; showing = true; inputReady = false;
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) flash = -1; }

    if (showing) {
      showTimer -= dt;
      if (showTimer <= 0) {
        if (flash >= 0) { flash = -1; showTimer = 0.2; }
        else if (showIdx < sequence.length) {
          flash = sequence[showIdx]; showIdx++; showTimer = 0.5; flashTimer = 0.4;
        } else {
          showing = false; inputReady = true; flash = -1;
        }
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      for (var i = 0; i < 4; i++) {
        var z = ZONES[i];
        ctx.fillStyle = z.color + '88';
        ctx.fillRect(z.x, z.y, z.w, z.h);
      }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 46px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#a8edea';
      ctx.fillText('PATTERN', VW/2, 280);
      ctx.fillText('REPEAT', VW/2, 340);
      ctx.shadowBlur = 0; ctx.font = '20px system-ui';
      ctx.fillText('Watch the pattern', VW/2, 410);
      ctx.fillText('then tap to repeat!', VW/2, 445);
      ctx.fillText('TAP TO PLAY', VW/2, 510);
      ctx.fillStyle = '#FFD700'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 560);
      return;
    }

    for (var j = 0; j < 4; j++) {
      var zn = ZONES[j];
      var lit = (flash === j);
      ctx.fillStyle = lit ? zn.color : zn.color + '55';
      ctx.fillRect(zn.x, zn.y, zn.w, zn.h);
      if (lit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(zn.x+2, zn.y+2, zn.w-4, zn.h-4); }
    }

    ctx.fillStyle = '#111'; ctx.fillRect(VW/2-2, 150, 4, VH);
    ctx.fillRect(0, VH/2-2, VW, 4);
    ctx.fillRect(0, 145, VW, 10);

    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    ctx.fillStyle = '#a8edea'; ctx.font = '16px system-ui'; ctx.textAlign = 'center';
    if (showing) ctx.fillText('WATCH...', VW/2, 100);
    else if (inputReady) ctx.fillText('YOUR TURN! (' + playerSeq.length + '/' + sequence.length + ')', VW/2, 100);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, VW, VH);
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
    if (!inputReady) return;

    var idx = -1;
    for (var i = 0; i < ZONES.length; i++) {
      var z = ZONES[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) { idx = i; break; }
    }
    if (idx < 0) return;

    flash = idx; flashTimer = 0.25;
    playerSeq.push(idx);
    var pos = playerSeq.length - 1;

    if (playerSeq[pos] !== sequence[pos]) {
      lives--;
      try { Audio.play('crash'); } catch(e) {}
      if (lives <= 0) {
        state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      } else {
        playerSeq = []; showIdx = 0; showTimer = 0.5; showing = true; inputReady = false;
      }
    } else if (playerSeq.length === sequence.length) {
      score++; if (score > best) best = score;
      try { Audio.play('gem'); } catch(e) {}
      inputReady = false;
      setTimeout(function() { if (state === 'PLAYING') addToSequence(); }, 600);
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
