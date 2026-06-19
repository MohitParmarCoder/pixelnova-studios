'use strict';

/* Ice Curling — LavaSurf namespace
   6 stones per game. Tap left/right to adjust aim angle.
   Tap RELEASE button to launch. Score 1-10 per stone by ring.
   Total score = sum of all 6. */
var LavaSurf = (function () {
  var VW = 390, VH = 844;
  var canvas, ctx;
  var state = 'MENU';
  var score = 0, _best = 0;
  var t = 0;
  var lives = 3;

  // Lane
  var LANE_X = 40, LANE_W = VW - 80;
  var LANE_TOP = 118, LANE_BOT = VH - 195;

  // Bullseye
  var TARGET_CX = VW / 2, TARGET_CY = LANE_TOP + 92;

  // Rings: outermost first
  var RING_R    = [68, 48, 30, 14];
  var RING_PTS  = [4,  6,  8, 10];
  var RING_COLS = ['#1b3c6e', '#1e5c2e', '#8b2020', '#cc3333'];

  // Aim
  var aimAngle = 0;
  var AIM_STEP = 0.055, AIM_MAX = 0.44;

  // Physics
  var STONE_SPD = 760;
  var FRICTION  = 0.97;
  var MIN_SPD   = 2;

  // Game state
  var STONES_TOTAL = 6;
  var stonesLeft   = 0;
  var placedStones = [];  // {x,y,pts}
  var stone        = null; // {x,y,vx,vy}
  var lastPts      = 0;

  // Phase: 'AIM' | 'SLIDING' | 'RESULT'
  var phase      = 'AIM';
  var phaseTimer = 0;

  // Release button
  var BTN_X = VW / 2 - 70, BTN_Y = VH - 170;
  var BTN_W = 140, BTN_H = 50;

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function resetGame() {
    score = 0; lives = 3;
    stonesLeft = STONES_TOTAL;
    placedStones = [];
    stone = null;
    aimAngle = 0; lastPts = 0;
    phase = 'AIM'; phaseTimer = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function runEnded() {
    if (score > _best) _best = score;
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function launchStone() {
    var dir = Math.PI / 2 + aimAngle;
    stone = {
      x: VW / 2, y: LANE_BOT - 20,
      vx: -Math.cos(dir) * STONE_SPD,
      vy: -Math.sin(dir) * STONE_SPD
    };
    phase = 'SLIDING';
    snd('tap');
  }

  function calcPts(sx, sy) {
    var dx = sx - TARGET_CX, dy = sy - TARGET_CY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var i;
    for (i = 0; i < RING_R.length; i++) {
      if (dist <= RING_R[i]) return RING_PTS[i];
    }
    return 0;
  }

  function stopStone() {
    var pts = calcPts(stone.x, stone.y);
    lastPts = pts;
    score += pts;
    placedStones.push({ x: stone.x, y: stone.y, pts: pts });
    stonesLeft--;
    if (pts === 0) {
      lives--;
      snd('lose');
      if (lives <= 0) {
        phase = 'RESULT'; phaseTimer = 0.1;
        stonesLeft = 0;
        return;
      }
    } else {
      snd(pts >= 8 ? 'gem' : 'tap');
    }
    phase = 'RESULT';
    phaseTimer = stonesLeft <= 0 ? 2.2 : 1.3;
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c; ctx = canvas.getContext('2d');
    _best = best || 0; state = 'MENU';
    score = 0; lives = 3; t = 0;
    placedStones = []; stone = null;
    stonesLeft = 0; aimAngle = 0; phase = 'AIM';
  }

  function update(dt) {
    t += dt;
    if (state !== 'PLAYING') return;

    if (phase === 'SLIDING' && stone) {
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      var spd = Math.sqrt(stone.vx * stone.vx + stone.vy * stone.vy);
      if (spd > MIN_SPD) {
        var f = Math.pow(FRICTION, dt * 60);
        stone.vx *= f; stone.vy *= f;
      } else {
        stopStone(); return;
      }
      // Wall bounces
      if (stone.x < LANE_X + 14) { stone.x = LANE_X + 14; stone.vx = Math.abs(stone.vx) * 0.55; }
      if (stone.x > LANE_X + LANE_W - 14) { stone.x = LANE_X + LANE_W - 14; stone.vx = -Math.abs(stone.vx) * 0.55; }
      if (stone.y < LANE_TOP + 12) { stone.y = LANE_TOP + 12; stopStone(); return; }
      if (stone.y > LANE_BOT + 10) { stone.y = LANE_BOT - 5; stopStone(); return; }
    }

    if (phase === 'RESULT') {
      phaseTimer -= dt;
      if (phaseTimer <= 0) {
        if (stonesLeft <= 0) {
          state = 'DEAD'; snd('lose'); runEnded(); return;
        }
        stone = null; phase = 'AIM'; aimAngle = 0; lastPts = 0;
      }
    }
  }

  function tap(vx, vy) {
    if (state === 'MENU') { startGame(); snd('tap'); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function () { startGame(); }); } catch (e) { startGame(); }
      try { AdManager.offerDoubleScore(score, 'lavasurf_best'); } catch(e) {}
      snd('tap'); return;
    }
    if (state !== 'PLAYING') return;

    if (phase === 'AIM') {
      if (vx >= BTN_X && vx <= BTN_X + BTN_W && vy >= BTN_Y && vy <= BTN_Y + BTN_H) {
        launchStone(); return;
      }
      if (vx < VW / 2) {
        aimAngle = Math.max(-AIM_MAX, aimAngle - AIM_STEP);
      } else {
        aimAngle = Math.min(AIM_MAX, aimAngle + AIM_STEP);
      }
      snd('tap');
    }
  }

  function getBest()  { return _best; }
  function getScore() { return score; }
  function getState() { return state; }

  // ---- Drawing helpers ----

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#091828'); g.addColorStop(1, '#0b2434');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawLane() {
    var h = LANE_BOT - LANE_TOP;
    ctx.fillStyle = 'rgba(180,225,255,0.10)';
    roundRect(LANE_X, LANE_TOP, LANE_W, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(130,195,255,0.32)'; ctx.lineWidth = 2;
    roundRect(LANE_X, LANE_TOP, LANE_W, h, 10); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    var i;
    for (i = 0; i < 6; i++) {
      var xi = LANE_X + 18 + i * 52;
      ctx.beginPath(); ctx.moveTo(xi, LANE_TOP + 18); ctx.lineTo(xi - 8, LANE_BOT - 18); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTarget() {
    var cx = TARGET_CX, cy = TARGET_CY, i;
    for (i = RING_R.length - 1; i >= 0; i--) {
      ctx.beginPath(); ctx.arc(cx, cy, RING_R[i], 0, Math.PI * 2);
      ctx.fillStyle = RING_COLS[i]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < RING_R.length; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(String(RING_PTS[i]), cx + RING_R[i] - 8, cy);
    }
  }

  function drawAimGuide() {
    if (phase !== 'AIM') return;
    var dir = Math.PI / 2 + aimAngle;
    var sx = VW / 2, sy = LANE_BOT - 20;
    var ex = sx - Math.cos(dir) * 210, ey = sy - Math.sin(dir) * 210;
    ctx.save(); ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(100,215,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  function drawStone(sx, sy, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha || 1;
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(sx - 4, sy - 4, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    ctx.restore();
  }

  function drawPlaced() {
    var i;
    for (i = 0; i < placedStones.length; i++) {
      var s = placedStones[i];
      drawStone(s.x, s.y, '#4ab8ff', 0.82);
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#fff'; ctx.fillText(String(s.pts), s.x, s.y - 15);
    }
  }

  function drawReleaseBtn() {
    if (phase !== 'AIM') return;
    ctx.save(); ctx.shadowColor = '#33e1ff'; ctx.shadowBlur = 14;
    roundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 10);
    ctx.fillStyle = '#10304a'; ctx.fill();
    ctx.strokeStyle = '#33e1ff'; ctx.lineWidth = 2;
    roundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 10); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RELEASE', BTN_X + BTN_W / 2, BTN_Y + BTN_H / 2);
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = '#7df'; ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('LAVA SURF', VW / 2, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial';
    ctx.fillText(String(score), VW / 2, 40);
    ctx.font = 'bold 14px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.textAlign = 'left'; ctx.fillText('Stones: ' + stonesLeft, 18, 78);
    ctx.textAlign = 'right'; ctx.fillText('Best: ' + _best, VW - 18, 78);
    var i;
    for (i = 0; i < 3; i++) {
      ctx.font = '18px Arial'; ctx.textAlign = 'left';
      ctx.fillStyle = i < lives ? '#ff3b6b' : 'rgba(255,255,255,0.22)';
      ctx.fillText(i < lives ? '♥' : '♡', VW / 2 - 28 + i * 22, 78);
    }
    if (phase === 'RESULT' && lastPts > 0 && stonesLeft > 0) {
      ctx.save(); ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 22;
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 38px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + lastPts, VW / 2, VH - 120);
      ctx.restore();
    }
  }

  function drawMenu() {
    drawBg();
    var float = Math.sin(t * 1.4) * 6;
    ctx.save();
    ctx.shadowColor = '#33e1ff'; ctx.shadowBlur = 26;
    ctx.fillStyle = '#33e1ff'; ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ICE', VW / 2, 305 + float);
    ctx.fillStyle = '#7df';
    ctx.fillText('CURLING', VW / 2, 366 + float);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '19px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Tap left/right to aim', VW / 2, 452);
    ctx.fillText('Press RELEASE to launch', VW / 2, 480);
    ctx.fillText('6 stones - hit the bullseye!', VW / 2, 508);
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save(); ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial';
    ctx.fillText('TAP TO PLAY', VW / 2, 622);
    ctx.restore();
    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.52)'; ctx.font = '17px Arial';
      ctx.fillText('BEST ' + _best, VW / 2, 676);
    }
    ctx.save(); ctx.translate(0, -192); drawTarget(); ctx.restore();
  }

  function drawDead() {
    ctx.save(); ctx.fillStyle = 'rgba(0,8,20,0.74)'; ctx.fillRect(0, 0, VW, VH);
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.shadowColor = '#33e1ff'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#33e1ff'; ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', VW / 2, 300);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial';
    ctx.fillText('Score: ' + score, VW / 2, 370);
    ctx.font = '20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('Best: ' + _best, VW / 2, 415);
    ctx.globalAlpha = pulse; ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
    ctx.restore();
  }

  function draw() {
    drawBg();
    if (state === 'MENU') { drawMenu(); return; }
    drawLane(); drawTarget(); drawAimGuide(); drawPlaced();
    if (stone) drawStone(stone.x, stone.y, '#8edfff', 1.0);
    drawReleaseBtn(); drawHUD();
    if (state === 'DEAD') drawDead();
  }

  return { init: init, update: update, draw: draw, tap: tap,
           getScore: getScore, getState: getState, getBest: getBest };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = LavaSurf; }
