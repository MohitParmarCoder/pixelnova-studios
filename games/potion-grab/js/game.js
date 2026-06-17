'use strict';
var PotionGrab = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, totalRounds, roundsLeft, roundScore;
  var targetR, targetG, targetB;
  var mixR, mixG, mixB;
  var roundTimer, ROUND_TIME;
  var dragSlider;

  var SLIDER_Y_TOP = 260;
  var SLIDER_Y_BOT = 700;
  var SLIDER_XS = [80, 195, 310];
  var SLIDER_W = 28;
  var SLIDER_H = SLIDER_Y_BOT - SLIDER_Y_TOP;
  var THUMB_R = 18;

  function valToY(v) {
    return SLIDER_Y_BOT - (v / 255) * SLIDER_H;
  }

  function yToVal(y) {
    var v = (1 - (y - SLIDER_Y_TOP) / SLIDER_H) * 255;
    if (v < 0) v = 0;
    if (v > 255) v = 255;
    return Math.round(v);
  }

  function rgbStr(r, g, b) {
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function newTarget() {
    targetR = Math.floor(Math.random() * 230) + 20;
    targetG = Math.floor(Math.random() * 230) + 20;
    targetB = Math.floor(Math.random() * 230) + 20;
    mixR = 128; mixG = 128; mixB = 128;
    roundTimer = ROUND_TIME;
  }

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
    ROUND_TIME = 5;
  }

  function startGame() {
    score = 0; lives = 3; totalRounds = 10; roundsLeft = 10;
    roundScore = 0; dragSlider = -1;
    newTarget();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function calcAccuracy() {
    var dr = Math.abs(mixR - targetR);
    var dg = Math.abs(mixG - targetG);
    var db = Math.abs(mixB - targetB);
    return 1 - (dr + dg + db) / (255 * 3);
  }

  function endRound(timedOut) {
    var acc = calcAccuracy();
    if (timedOut && acc < 0.9) {
      lives--;
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) {
        lives = 0; state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        return;
      }
    } else if (acc >= 0.9) {
      var pts = Math.round(1000 * acc);
      score += pts;
      roundScore = pts;
      if (score > best) best = score;
      try { Audio.play('gem'); } catch(e) {}
    } else {
      roundScore = 0;
    }
    roundsLeft--;
    if (roundsLeft <= 0) {
      state = 'DEAD';
      try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
      return;
    }
    newTarget();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    roundTimer -= dt;
    if (roundTimer <= 0) {
      roundTimer = 0;
      endRound(true);
    }
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a001a'); g.addColorStop(1, '#1a0030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawSlider(idx, val, label, trackColor) {
    var sx = SLIDER_XS[idx];
    var ty = valToY(val);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = SLIDER_W;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, SLIDER_Y_TOP); ctx.lineTo(sx, SLIDER_Y_BOT); ctx.stroke();
    ctx.strokeStyle = trackColor; ctx.lineWidth = SLIDER_W - 4;
    ctx.beginPath(); ctx.moveTo(sx, ty); ctx.lineTo(sx, SLIDER_Y_BOT); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 12; ctx.shadowColor = trackColor;
    ctx.beginPath(); ctx.arc(sx, ty, THUMB_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('' + val, sx, ty);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
    ctx.fillText(label, sx, SLIDER_Y_BOT + 26);
    ctx.restore();
  }

  function draw() {
    var acc, timerPct, hearts, h;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#c77dff'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#c77dff';
      ctx.fillText('COLOR LAB', VW / 2, 290);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('Drag R, G, B sliders', VW / 2, 360);
      ctx.fillText('to match the target color!', VW / 2, 392);
      ctx.fillStyle = '#ffd700'; ctx.font = '18px system-ui';
      ctx.fillText('90%+ accuracy in 5s to score', VW / 2, 428);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 474);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 534);
      ctx.textAlign = 'left';
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, VW, 110);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Target:', 16, 36);
    ctx.fillStyle = rgbStr(targetR, targetG, targetB);
    ctx.shadowBlur = 16; ctx.shadowColor = rgbStr(targetR, targetG, targetB);
    ctx.beginPath(); ctx.arc(110, 62, 34, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Mixed:', 180, 36);
    ctx.fillStyle = rgbStr(mixR, mixG, mixB);
    ctx.shadowBlur = 16; ctx.shadowColor = rgbStr(mixR, mixG, mixB);
    ctx.beginPath(); ctx.arc(282, 62, 34, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    acc = calcAccuracy();
    ctx.fillStyle = acc >= 0.9 ? '#6bcb77' : '#ffd700';
    ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(acc * 100) + '%', VW / 2, 100);

    timerPct = roundTimer / ROUND_TIME;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(10, 112, VW - 20, 10);
    ctx.fillStyle = timerPct > 0.4 ? '#6bcb77' : '#f87171';
    ctx.fillRect(10, 112, (VW - 20) * timerPct, 10);

    drawSlider(0, mixR, 'R', '#ff6b6b');
    drawSlider(1, mixG, 'G', '#6bcb77');
    drawSlider(2, mixB, 'B', '#4d96ff');

    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, VH - 90);
    ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
    ctx.fillText('Rounds left: ' + roundsLeft, 16, VH - 64);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, VH - 90);

    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('TAP CIRCLE TO SUBMIT', VW / 2, VH - 30);
    ctx.fillStyle = acc >= 0.9 ? '#6bcb77' : '#aaa';
    ctx.shadowBlur = acc >= 0.9 ? 14 : 0; ctx.shadowColor = '#6bcb77';
    ctx.beginPath(); ctx.arc(VW / 2, VH - 50, 14, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#c77dff'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#c77dff';
      ctx.fillText('GAME OVER', VW / 2, 300);
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffd700'; ctx.font = 'bold 32px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 370);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 410);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 480);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;
    var i, sx, dy;
    var submitDx = x - VW / 2;
    var submitDy = y - (VH - 50);
    if (Math.sqrt(submitDx * submitDx + submitDy * submitDy) < 22) {
      endRound(false);
      return;
    }
    dragSlider = -1;
    for (i = 0; i < 3; i++) {
      sx = SLIDER_XS[i];
      if (Math.abs(x - sx) < 30) {
        dragSlider = i;
        var newVal = yToVal(y);
        if (i === 0) mixR = newVal;
        else if (i === 1) mixG = newVal;
        else mixB = newVal;
        return;
      }
    }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
