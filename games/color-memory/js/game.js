'use strict';

/* Piano Keys — a mini piano with 8 keys.
   A melody plays, player must replay it by tapping keys.
   Melody grows by 1 note each round (3..10 notes). Lives=3. */
var ColorMemory = (function () {
  var VW = 390, VH = 844;

  var canvas, ctx;
  var state = 'MENU'; // 'MENU' | 'PLAYING' | 'DEAD'
  var score = 0, _best = 0;
  var t = 0;
  var lives = 3;

  // 8 piano keys: label, color, highlight color
  var KEYS = [
    { label: 'C',  color: '#e8e8e8', glow: '#ffffff', dark: false },
    { label: 'D',  color: '#ddddff', glow: '#aaaaff', dark: false },
    { label: 'E',  color: '#ffd8d8', glow: '#ff9999', dark: false },
    { label: 'F',  color: '#d8ffd8', glow: '#88ff88', dark: false },
    { label: 'G',  color: '#d8f8ff', glow: '#66eeff', dark: false },
    { label: 'A',  color: '#fff8d8', glow: '#ffee88', dark: false },
    { label: 'B',  color: '#ffd8ff', glow: '#ff88ff', dark: false },
    { label: 'C2', color: '#ffe0c0', glow: '#ffbb66', dark: false }
  ];

  var KEY_COUNT = 8;
  var KEY_Y = VH - 260;
  var KEY_H = 210;
  var KEY_W = 0; // computed in init
  var KEY_GAP = 4;

  // Melody state
  var melody = [];         // array of key indices (0..7)
  var melodyLen = 3;
  var showPhase = false;   // true while computer is showing melody
  var showIdx = 0;         // which note is currently lit
  var showTimer = 0;
  var SHOW_ON = 0.4;       // seconds key is lit
  var SHOW_OFF = 0.15;     // gap between notes
  var showOff = false;     // true during the off gap

  var playerIdx = 0;       // which note player must tap next
  var keyLit = -1;         // key currently flashing (player feedback or show)
  var litTimer = 0;
  var errorFlash = false;

  var roundDelay = 0;      // brief pause before next round starts

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function computeLayout() {
    KEY_W = Math.floor((VW - KEY_GAP * (KEY_COUNT + 1)) / KEY_COUNT);
  }

  function keyX(i) {
    return KEY_GAP + i * (KEY_W + KEY_GAP);
  }

  function buildMelody(len) {
    melody = [];
    for (var i = 0; i < len; i++) {
      melody.push(Math.floor(Math.random() * KEY_COUNT));
    }
  }

  function startShow() {
    showPhase = true;
    showIdx = 0;
    showTimer = SHOW_ON;
    showOff = false;
    keyLit = melody[0];
    playerIdx = 0;
  }

  function startRound() {
    buildMelody(melodyLen);
    roundDelay = 0.5;
    showPhase = false;
    keyLit = -1;
    playerIdx = 0;
  }

  function startGame() {
    score = 0;
    lives = 3;
    melodyLen = 3;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
    startRound();
  }

  function gameOver() {
    if (score > _best) _best = score;
    snd('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    t = 0;
    lives = 3;
    computeLayout();
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    t += dt;

    if (state !== 'PLAYING') return;

    // Lit key timer (player feedback flash)
    if (keyLit >= 0 && !showPhase) {
      litTimer -= dt;
      if (litTimer <= 0) {
        keyLit = -1;
      }
    }

    // Pre-round delay before showing melody
    if (roundDelay > 0) {
      roundDelay -= dt;
      if (roundDelay <= 0) {
        startShow();
      }
      return;
    }

    if (!showPhase) return;

    // Advance the show sequence
    showTimer -= dt;
    if (showTimer <= 0) {
      if (!showOff) {
        // End of ON phase — go to OFF gap
        keyLit = -1;
        showOff = true;
        showTimer = SHOW_OFF;
      } else {
        // End of OFF gap — next note or end show
        showOff = false;
        showIdx++;
        if (showIdx >= melody.length) {
          // Done showing
          showPhase = false;
          keyLit = -1;
        } else {
          keyLit = melody[showIdx];
          showTimer = SHOW_ON;
        }
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
        try { AdManager.offerDoubleScore(score, 'colormemory_best'); } catch(e) {}
      } catch (e) {
        startGame();
      }
      snd('tap');
      return;
    }

    // Only accept taps during player input phase
    if (showPhase || roundDelay > 0) return;

    // Which key was tapped?
    if (vy < KEY_Y || vy > KEY_Y + KEY_H) return;
    var ki = -1;
    var i;
    for (i = 0; i < KEY_COUNT; i++) {
      var kx = keyX(i);
      if (vx >= kx && vx <= kx + KEY_W) { ki = i; break; }
    }
    if (ki < 0) return;

    if (ki === melody[playerIdx]) {
      // Correct!
      snd('gem');
      keyLit = ki;
      litTimer = 0.25;
      playerIdx++;
      if (playerIdx >= melody.length) {
        // Completed melody!
        score++;
        if (score > _best) _best = score;
        snd('gem');
        melodyLen = melodyLen < 10 ? melodyLen + 1 : 10;
        roundDelay = 0.8;
        keyLit = -1;
      }
    } else {
      // Wrong key
      snd('crash');
      errorFlash = true;
      keyLit = ki;
      litTimer = 0.3;
      lives--;
      if (lives <= 0) {
        gameOver();
        return;
      }
      // Replay melody
      roundDelay = 0.6;
      playerIdx = 0;
    }
  }

  function getBest() { return _best; }
  function getScore() { return score; }
  function getState() { return state; }

  // ---- Rendering ----

  function clearBg() {
    ctx.fillStyle = '#0d0d1e';
    ctx.fillRect(0, 0, VW, VH);
    var g = ctx.createRadialGradient(VW / 2, VH * 0.4, 30, VW / 2, VH * 0.4, VH * 0.65);
    g.addColorStop(0, 'rgba(50,30,100,0.30)');
    g.addColorStop(1, 'rgba(10,10,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawKeys() {
    var i;
    for (i = 0; i < KEY_COUNT; i++) {
      var kx = keyX(i);
      var key = KEYS[i];
      var lit = (i === keyLit);
      var col = lit ? key.glow : key.color;
      var alpha = lit ? 1.0 : 0.85;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (lit) {
        ctx.shadowColor = key.glow;
        ctx.shadowBlur = 28;
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kx, KEY_Y, KEY_W, KEY_H, 8) : drawRR(kx, KEY_Y, KEY_W, KEY_H, 8);
      ctx.fill();

      ctx.strokeStyle = lit ? key.glow : 'rgba(0,0,0,0.4)';
      ctx.lineWidth = lit ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kx, KEY_Y, KEY_W, KEY_H, 8) : drawRR(kx, KEY_Y, KEY_W, KEY_H, 8);
      ctx.stroke();

      // Key label
      ctx.shadowBlur = 0;
      ctx.fillStyle = lit ? '#000000' : 'rgba(60,60,80,0.9)';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(key.label, kx + KEY_W / 2, KEY_Y + KEY_H - 8);

      ctx.restore();
    }
  }

  function drawRR(x, y, w, h, r) {
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

  function drawHUD() {
    var i;
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(score), VW / 2, 22);

    // Lives
    for (i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff3b6b' : '#444455';
      ctx.font = '28px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(i < lives ? '♥' : '♡', 16 + i * 36, 22);
    }

    // Best
    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('BEST ' + _best, VW - 14, 26);
    }

    // Phase indicator
    var phaseText = '';
    if (showPhase || roundDelay > 0) {
      phaseText = 'WATCH...';
    } else {
      phaseText = 'TAP NOTE ' + (playerIdx + 1) + ' / ' + melody.length;
    }
    ctx.fillStyle = showPhase ? '#ffee66' : '#66eeff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(phaseText, VW / 2, 70);

    // Melody length display dots
    var dotR = 8, dotY = 108, dotGap = 22;
    var totalDotW = melody.length * (dotR * 2 + dotGap) - dotGap;
    var dotStartX = (VW - totalDotW) / 2 + dotR;
    for (i = 0; i < melody.length; i++) {
      var filled = !showPhase && i < playerIdx;
      var current = !showPhase && i === playerIdx;
      ctx.fillStyle = filled ? '#66eeff' : (current ? '#ffee66' : 'rgba(255,255,255,0.2)');
      ctx.beginPath();
      ctx.arc(dotStartX + i * (dotR * 2 + dotGap), dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMenu() {
    var float = Math.sin(t * 1.5) * 6;

    ctx.save();
    ctx.fillStyle = '#66eeff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#66eeff';
    ctx.shadowBlur = 20;
    ctx.fillText('PIANO', VW / 2, 280 + float);
    ctx.fillStyle = '#ff88ff';
    ctx.shadowColor = '#ff88ff';
    ctx.fillText('KEYS', VW / 2, 340 + float);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Mini key demo
    var i;
    for (i = 0; i < KEY_COUNT; i++) {
      var kx = keyX(i);
      var lit = (Math.floor(t * 2.5 + i) % KEY_COUNT) === 0;
      var col = lit ? KEYS[i].glow : KEYS[i].color;
      ctx.globalAlpha = lit ? 1.0 : 0.7;
      ctx.fillStyle = col;
      drawRR(kx, 420, KEY_W, 80, 6);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Watch the melody, then replay it!', VW / 2, 540);

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
      ctx.fillText('BEST: ' + _best, VW / 2, 700);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.save();
    ctx.fillStyle = '#ff4466';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 20;
    ctx.fillText('WRONG NOTE!', VW / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Score: ' + score, VW / 2, 380);
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
      return;
    }
    if (state === 'DEAD') {
      drawDead();
      return;
    }
    // PLAYING
    drawHUD();
    drawKeys();
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

if (typeof module !== 'undefined' && module.exports) { module.exports = ColorMemory; }
