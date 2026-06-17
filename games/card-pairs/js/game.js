'use strict';
var CardPairs = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;

  var COLS = 4, ROWS = 4;
  var CARD_W = 80, CARD_H = 100;
  var CARD_PAD = 10;
  var GRID_X, GRID_Y;

  var SYMBOLS = ['★','♦','♠','♥','♣','◆','●','▲'];
  var SYMBOL_COLORS = ['#f39c12','#3498db','#2c3e50','#e74c3c','#27ae60','#9b59b6','#1abc9c','#e67e22'];

  var cards = [];
  // card: { sym, colorIdx, faceUp, matched, flipT, flipping, toFace }
  var flipped = [];
  var checking = false;
  var checkTimer = 0;
  var CHECK_DELAY = 0.8;
  var matchCount = 0;
  var elapsed = 0;
  var won = false;
  var finalScore = 0;

  function buildCards() {
    var deck = [];
    for (var i = 0; i < 8; i++) {
      deck.push(i);
      deck.push(i);
    }
    // shuffle
    for (var j = deck.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j+1));
      var tmp = deck[j]; deck[j] = deck[k]; deck[k] = tmp;
    }
    cards = [];
    for (var n = 0; n < 16; n++) {
      cards.push({ sym: deck[n], colorIdx: deck[n], faceUp: false, matched: false, flipT: 1, flipping: false, toFace: false });
    }
    flipped = [];
    checking = false;
    matchCount = 0;
    elapsed = 0;
    won = false;
  }

  function cardRect(idx) {
    var c = idx % COLS;
    var r = Math.floor(idx / COLS);
    var x = GRID_X + c * (CARD_W + CARD_PAD);
    var y = GRID_Y + r * (CARD_H + CARD_PAD);
    return [x, y];
  }

  function cardFromXY(x, y) {
    for (var i = 0; i < 16; i++) {
      var pos = cardRect(i);
      if (x >= pos[0] && x <= pos[0]+CARD_W && y >= pos[1] && y <= pos[1]+CARD_H) return i;
    }
    return -1;
  }

  function init(c, b) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = b || 0;
    var totalW = COLS * CARD_W + (COLS-1)*CARD_PAD;
    var totalH = ROWS * CARD_H + (ROWS-1)*CARD_PAD;
    GRID_X = Math.floor((VW - totalW) / 2);
    GRID_Y = 180;
    state = 'MENU';
  }

  function startGame() {
    buildCards();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    finalScore = Math.round(1600 / Math.max(elapsed, 1));
    if (finalScore > best) best = finalScore;
    won = true;
    state = 'DEAD';
    try { Audio.play('gem'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    if (!won) elapsed += dt;

    // animate flips
    for (var i = 0; i < 16; i++) {
      var card = cards[i];
      if (card.flipping) {
        card.flipT += dt / 0.15;
        if (card.flipT >= 1) {
          card.flipT = 1;
          card.faceUp = card.toFace;
          card.flipping = false;
        }
      }
    }

    if (checking) {
      checkTimer += dt;
      if (checkTimer >= CHECK_DELAY) {
        checking = false;
        var a = flipped[0], b = flipped[1];
        if (cards[a].sym === cards[b].sym) {
          cards[a].matched = true;
          cards[b].matched = true;
          matchCount++;
          try { Audio.play('gem'); } catch(e) {}
          if (matchCount === 8) { endGame(); }
        } else {
          // flip back
          cards[a].flipping = true; cards[a].flipT = 0; cards[a].toFace = false;
          cards[b].flipping = true; cards[b].flipT = 0; cards[b].toFace = false;
          try { Audio.play('crash'); } catch(e) {}
        }
        flipped = [];
      }
    }
  }

  function drawCard(idx) {
    var card = cards[idx];
    var pos = cardRect(idx);
    var x = pos[0], y = pos[1];
    var cx = x + CARD_W/2;
    var cy = y + CARD_H/2;
    var scaleX = card.flipping ? Math.abs(Math.cos(card.flipT * Math.PI)) : 1;
    var faceUp = card.flipping ? (card.flipT >= 0.5 ? card.toFace : card.faceUp) : card.faceUp;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);
    ctx.translate(-CARD_W/2, -CARD_H/2);

    if (card.matched) {
      // matched: show face with glow
      ctx.shadowColor = SYMBOL_COLORS[card.colorIdx];
      ctx.shadowBlur = 12;
    }

    if (faceUp || card.matched) {
      // face
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(0, 0, CARD_W, CARD_H, 10);
      ctx.fill();
      // symbol
      ctx.fillStyle = SYMBOL_COLORS[card.colorIdx];
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SYMBOLS[card.sym], CARD_W/2, CARD_H/2);
    } else {
      // back
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.roundRect(0, 0, CARD_W, CARD_H, 10);
      ctx.fill();
      // pattern
      ctx.strokeStyle = '#3d5166';
      ctx.lineWidth = 1.5;
      for (var gi = 10; gi < CARD_W; gi += 12) {
        ctx.beginPath(); ctx.moveTo(gi,0); ctx.lineTo(gi,CARD_H); ctx.stroke();
      }
      for (var gj = 10; gj < CARD_H; gj += 12) {
        ctx.beginPath(); ctx.moveTo(0,gj); ctx.lineTo(CARD_W,gj); ctx.stroke();
      }
      ctx.strokeStyle = '#4a6880';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(4, 4, CARD_W-8, CARD_H-8, 7);
      ctx.stroke();
    }

    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CARD PAIRS', VW/2, 300);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Flip cards to find matching pairs!', VW/2, 360);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO PLAY', VW/2, 460);
      if (best > 0) {
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Best: ' + best, VW/2, 520);
      }
      return;
    }

    // HUD
    var secs = Math.floor(elapsed);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Pairs: ' + matchCount + '/8', 20, 50);
    ctx.textAlign = 'right';
    ctx.fillText('Time: ' + secs + 's', VW-20, 50);

    for (var i = 0; i < 16; i++) {
      drawCard(i);
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', VW/2, 320);
      ctx.fillStyle = '#fff';
      ctx.font = '26px sans-serif';
      ctx.fillText('Time: ' + Math.floor(elapsed) + 's', VW/2, 380);
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#f39c12';
      ctx.fillText('Score: ' + finalScore, VW/2, 430);
      ctx.fillStyle = '#aaa';
      ctx.font = '24px sans-serif';
      ctx.fillText('Best: ' + best, VW/2, 475);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO RETRY', VW/2, 540);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD')  { startGame(); return; }
    if (checking) return;

    var idx = cardFromXY(x, y);
    if (idx < 0) return;
    var card = cards[idx];
    if (card.faceUp || card.matched || card.flipping) return;
    if (flipped.length >= 2) return;

    card.flipping = true;
    card.flipT = 0;
    card.toFace = true;
    flipped.push(idx);
    try { Audio.play('tap'); } catch(e) {}

    if (flipped.length === 2) {
      checking = true;
      checkTimer = 0;
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
