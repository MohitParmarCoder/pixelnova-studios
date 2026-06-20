'use strict';

/* Blackjack 21 — simplified blackjack card game.
   Player starts with 100 chips. Bet 10 chips per round.
   Hit or Stand. Dealer draws to 17+. Win/Lose/Push. */
var CardPairs = (function () {
  var VW = 390, VH = 844;

  var canvas, ctx;
  var state = 'MENU'; // 'MENU' | 'PLAYING' | 'DEAD'
  var score = 0, _best = 0;
  var t = 0;

  var chips = 100;
  var BET = 10;

  var playerHand = [];
  var dealerHand = [];
  var dealerHidden = true;
  var roundPhase = 'PLAYER'; // 'PLAYER' | 'DEALER' | 'RESULT'
  var resultMsg = '';
  var resultTimer = 0;
  var lives = 3;

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function drawACard() {
    var raw = Math.floor(Math.random() * 13) + 1;
    var suit = Math.floor(Math.random() * 4);
    var val = raw;
    if (val === 1) val = 11;
    else if (val > 10) val = 10;
    return { val: val, raw: raw, suit: suit };
  }

  function handTotal(hand) {
    var total = 0;
    var aces = 0;
    var i;
    for (i = 0; i < hand.length; i++) {
      total += hand[i].val;
      if (hand[i].raw === 1) aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  function suitChar(s) {
    if (s === 0) return 'S';
    if (s === 1) return 'H';
    if (s === 2) return 'D';
    return 'C';
  }

  function suitColor(s) {
    return (s === 1 || s === 2) ? '#ff4466' : '#ddeeff';
  }

  function startRound() {
    playerHand = [];
    dealerHand = [];
    dealerHidden = true;
    resultMsg = '';
    playerHand.push(drawACard());
    playerHand.push(drawACard());
    dealerHand.push(drawACard());
    dealerHand.push(drawACard());
    roundPhase = 'PLAYER';
    if (handTotal(playerHand) === 21) {
      doStand();
    }
  }

  function doHit() {
    if (roundPhase !== 'PLAYER') return;
    playerHand.push(drawACard());
    snd('gem');
    var total = handTotal(playerHand);
    if (total > 21) {
      snd('crash');
      chips -= BET;
      score = chips;
      resultMsg = 'BUST! -' + BET + ' chips';
      roundPhase = 'RESULT';
      resultTimer = 2.2;
      lives--;
      if (chips <= 0) {
        if (chips < 0) chips = 0;
        endGame(false);
      }
    } else if (total === 21) {
      doStand();
    }
  }

  function doStand() {
    roundPhase = 'DEALER';
    dealerHidden = false;
    var guard = 0;
    while (handTotal(dealerHand) < 17 && guard < 20) {
      dealerHand.push(drawACard());
      guard++;
    }
    resolveRound();
  }

  function resolveRound() {
    var pTot = handTotal(playerHand);
    var dTot = handTotal(dealerHand);
    var dBust = dTot > 21;

    if (dBust || pTot > dTot) {
      chips += BET;
      score = chips;
      resultMsg = 'WIN! +' + BET + ' chips';
      snd('gem');
    } else if (pTot === dTot) {
      resultMsg = 'PUSH - No change';
      snd('tap');
    } else {
      chips -= BET;
      score = chips;
      resultMsg = 'DEALER WINS -' + BET;
      snd('crash');
      lives--;
    }

    if (chips >= 200) {
      resultMsg = 'YOU WIN! 200 chips!';
      endGame(true);
      return;
    }
    if (chips <= 0) {
      if (chips < 0) chips = 0;
      endGame(false);
      return;
    }

    roundPhase = 'RESULT';
    resultTimer = 2.2;
  }

  function endGame(won) {
    if (chips > _best) _best = chips;
    score = chips;
    snd(won ? 'gem' : 'lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  function startGame() {
    chips = 100;
    score = 100;
    lives = 3;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
    startRound();
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    t = 0;
    chips = 100;
    lives = 3;
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    t += dt;
    if (state !== 'PLAYING') return;
    if (roundPhase === 'RESULT') {
      resultTimer -= dt;
      if (resultTimer <= 0 && state === 'PLAYING') {
        startRound();
      }
    }
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      startGame();
      snd('tap');
      return;
    }
    if (state === 'DEAD') {
      try {
        AdManager.showInterstitial(function () { startGame(); });
        try { AdManager.offerDoubleScore(chips, 'cardpairs_best'); } catch(e) {}
      } catch (e) {
        startGame();
      }
      snd('tap');
      return;
    }
    if (roundPhase !== 'PLAYER') return;
    if (vy > 520) {
      if (vx < VW / 2) {
        doHit();
      } else {
        doStand();
      }
    }
  }

  function getBest() { return _best; }
  function getScore() { return score; }
  function getState() { return state; }

  // ---- Rendering ----

  function clearBg() {
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, VW, VH);
    var g = ctx.createRadialGradient(VW / 2, VH / 2, 60, VW / 2, VH / 2, VH * 0.7);
    g.addColorStop(0, 'rgba(0,80,30,0.35)');
    g.addColorStop(1, 'rgba(0,20,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function rrPath(x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawOneCard(x, y, w, h, card, faceDown) {
    ctx.fillStyle = faceDown ? '#1a3a5c' : '#f0f0e8';
    rrPath(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = faceDown ? '#2255aa' : '#aaaaaa';
    ctx.lineWidth = 2;
    rrPath(x, y, w, h, 10);
    ctx.stroke();

    if (faceDown) {
      ctx.save();
      ctx.strokeStyle = '#2266bb';
      ctx.lineWidth = 1.5;
      rrPath(x + 6, y + 6, w - 12, h - 12, 6);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.fillStyle = suitColor(card.suit);
    ctx.font = 'bold ' + Math.floor(w * 0.38) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(card.val), x + w / 2, y + h * 0.38);
    ctx.font = 'bold ' + Math.floor(w * 0.22) + 'px Arial';
    ctx.fillText(suitChar(card.suit), x + w / 2, y + h * 0.68);
    ctx.restore();
  }

  function drawHand(hand, label, startY, hideSecond) {
    var cw = 72, ch = 100, gap = 14;
    var totalCards = hand.length;
    var totalW = totalCards * cw + (totalCards - 1) * gap;
    var startX = (VW - totalW) / 2;
    var i;

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 20, startY - 22);

    for (i = 0; i < hand.length; i++) {
      drawOneCard(startX + i * (cw + gap), startY, cw, ch, hand[i], (i === 1 && hideSecond));
    }

    var tot, totStr;
    if (hideSecond) {
      tot = hand[0].val;
      totStr = String(tot) + '+?';
    } else {
      tot = handTotal(hand);
      totStr = String(tot);
    }
    var totColor = '#ffffff';
    if (!hideSecond && tot > 21) totColor = '#ff4444';
    else if (!hideSecond && tot === 21) totColor = '#ffdd44';
    ctx.save();
    ctx.fillStyle = totColor;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(totStr, VW - 20, startY + ch / 2);
    ctx.restore();
  }

  function drawButtons() {
    if (roundPhase !== 'PLAYER') return;
    var btnY = 535, btnH = 80, btnW = 160, btnGap = 14;
    var leftX = VW / 2 - btnGap / 2 - btnW;
    var rightX = VW / 2 + btnGap / 2;

    ctx.save();
    ctx.shadowColor = '#22ff88';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#1a5c2a';
    rrPath(leftX, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.strokeStyle = '#22ff88';
    ctx.lineWidth = 2.5;
    rrPath(leftX, btnY, btnW, btnH, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22ff88';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HIT', leftX + btnW / 2, btnY + btnH / 2);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#ffaa22';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#5c3a1a';
    rrPath(rightX, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffaa22';
    ctx.lineWidth = 2.5;
    rrPath(rightX, btnY, btnW, btnH, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffaa22';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STAND', rightX + btnW / 2, btnY + btnH / 2);
    ctx.restore();
  }

  function drawHUD() {
    var i;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('CHIPS: ' + chips, VW / 2, 18);

    for (i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff3b6b' : '#555555';
      ctx.font = '26px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(i < lives ? '♥' : '♡', 18 + i * 34, 20);
    }

    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('BEST ' + _best, VW - 14, 24);
    }
  }

  function drawResultMsg() {
    if (resultMsg === '') return;
    var alpha = 1.0;
    if (resultTimer < 0.6) alpha = resultTimer / 0.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rrPath(40, VH / 2 - 50, VW - 80, 90, 12);
    ctx.fill();
    var col = '#ffffff';
    if (resultMsg.indexOf('WIN') >= 0) col = '#22ff88';
    else if (resultMsg.indexOf('BUST') >= 0 || resultMsg.indexOf('DEALER') >= 0) col = '#ff4444';
    else if (resultMsg.indexOf('PUSH') >= 0) col = '#ffaa44';
    ctx.fillStyle = col;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(resultMsg, VW / 2, VH / 2 - 10);
    ctx.restore();
  }

  function drawPlaying() {
    drawHUD();
    drawHand(dealerHand, 'DEALER:', 160, dealerHidden);
    drawHand(playerHand, 'YOU:', 340, false);
    if (roundPhase === 'PLAYER') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('BET: ' + BET + ' chips', VW / 2, 468);
    }
    drawButtons();
    drawResultMsg();
  }

  function drawMenu() {
    var float = Math.sin(t * 1.6) * 5;

    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 58px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillText('CARD PAIRS', VW / 2, 280 + float);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaffcc';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('21', VW / 2, 340 + float);
    ctx.restore();

    var demo1 = { val: 11, raw: 1, suit: 1 };
    var demo2 = { val: 10, raw: 10, suit: 0 };
    drawOneCard(VW / 2 - 100, 390, 72, 100, demo1, false);
    drawOneCard(VW / 2 + 28, 390, 72, 100, demo2, false);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Start with 100 chips', VW / 2, 524);
    ctx.fillText('Hit or Stand to beat dealer', VW / 2, 552);

    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('TAP TO PLAY', VW / 2, 640);
    ctx.restore();

    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '18px Arial';
      ctx.fillText('BEST: ' + _best + ' chips', VW / 2, 700);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    var col = chips >= 200 ? '#ffd700' : '#ff4444';
    var title = chips >= 200 ? 'YOU WIN!' : 'GAME OVER';

    ctx.save();
    ctx.fillStyle = col;
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = col;
    ctx.shadowBlur = 20;
    ctx.fillText(title, VW / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Chips: ' + chips, VW / 2, 380);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '22px Arial';
    ctx.fillText('Best: ' + _best, VW / 2, 430);
    ctx.restore();

    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO RETRY', VW / 2, 580);
    ctx.restore();
  }

  function draw() {
    clearBg();
    if (state === 'MENU') {
      drawMenu();
    } else if (state === 'PLAYING') {
      drawPlaying();
    } else if (state === 'DEAD') {
      drawDead();
    }
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

if (typeof module !== 'undefined' && module.exports) { module.exports = CardPairs; }
