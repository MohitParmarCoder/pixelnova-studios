'use strict';

var RooftopRun = (function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  var PLAYER_Y      = VH * 0.65;   // fixed vertical position of player
  var PLAYER_R      = 18;
  var BASE_SPEED    = 200;          // px/s platforms scroll down
  var SPEED_INC     = 20;           // added per 10 score
  var BASE_INTERVAL = 1.5;          // seconds between platforms
  var MIN_INTERVAL  = 0.8;
  var WINDOW_GOOD   = 0.15;         // ±0.15s timing window
  var WINDOW_PERF   = 0.08;         // inner perfect window
  var PLAT_W        = 120;
  var PLAT_H        = 16;
  var MAX_LIVES     = 3;

  // ── State ──────────────────────────────────────────────────────────────────
  var canvas, ctx;
  var state;          // 'MENU' | 'PLAYING' | 'DEAD'
  var bestScore;

  // gameplay
  var score;
  var lives;
  var platforms;      // array of {x, y, xCenter, judged}
  var spawnTimer;
  var spawnInterval;
  var scrollSpeed;
  var playerX;        // current x of player circle center
  var targetX;        // x we lerp player toward
  var streak;         // consecutive hits

  // feedback
  var flashText;      // 'PERFECT!' | 'GOOD!'
  var flashTimer;
  var flashColor;
  var shakeTimer;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function spawnPlatform() {
    var zone = Math.floor(Math.random() * 3);
    var xCenter;
    if (zone === 0) { xCenter = VW * 0.2; }
    else if (zone === 1) { xCenter = VW * 0.5; }
    else { xCenter = VW * 0.8; }
    platforms.push({
      x: xCenter - PLAT_W / 2,
      y: -PLAT_H,
      xCenter: xCenter,
      judged: false
    });
  }

  function calcPlatSpeed() {
    return BASE_SPEED + Math.floor(score / 10) * SPEED_INC;
  }

  function calcInterval() {
    return clamp(BASE_INTERVAL - score * 0.015, MIN_INTERVAL, BASE_INTERVAL);
  }

  function resetGame() {
    score         = 0;
    lives         = MAX_LIVES;
    platforms     = [];
    spawnTimer    = 0.4;
    spawnInterval = BASE_INTERVAL;
    scrollSpeed   = BASE_SPEED;
    playerX       = VW / 2;
    targetX       = VW / 2;
    streak        = 0;
    flashText     = null;
    flashTimer    = 0;
    shakeTimer    = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function endGame() {
    state = 'DEAD';
    if (score > bestScore) { bestScore = score; }
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'rooftoprun_best'); } catch(e) {}
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(cnv, best) {
    canvas    = cnv;
    ctx       = canvas.getContext('2d');
    bestScore = best || 0;
    state     = 'MENU';
    resetGame();
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') { return; }
    dt = clamp(dt, 0, 0.05);

    scrollSpeed   = calcPlatSpeed();
    spawnInterval = calcInterval();

    // Spawn timer
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPlatform();
      spawnTimer = spawnInterval;
    }

    // Scroll platforms down
    var i, p, platCenter, dist, missY;
    for (i = 0; i < platforms.length; i++) {
      platforms[i].y += scrollSpeed * dt;
    }

    // Check for missed platforms
    for (i = 0; i < platforms.length; i++) {
      p = platforms[i];
      if (p.judged) { continue; }
      platCenter = p.y + PLAT_H / 2;
      missY      = PLAYER_Y + scrollSpeed * WINDOW_GOOD;
      if (platCenter > missY) {
        p.judged = true;
        streak   = 0;
        lives--;
        shakeTimer = 0.25;
        try { Audio.play('crash'); } catch (e) {}
        if (lives <= 0) { endGame(); return; }
      }
    }

    // Remove platforms off bottom
    for (i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > VH + 30) {
        platforms.splice(i, 1);
      }
    }

    // Lerp player x toward target
    playerX += (targetX - playerX) * clamp(dt * 12, 0, 1);

    if (flashTimer > 0) { flashTimer -= dt; }
    if (shakeTimer > 0) { shakeTimer -= dt; }
  }

  // ── Tap ────────────────────────────────────────────────────────────────────

  function tap(x, y) {
    if (state === 'MENU') {
      try { Audio.play('tap'); } catch (e) {}
      startGame();
      return;
    }
    if (state === 'DEAD') {
      try { Audio.play('tap'); } catch (e) {}
      startGame();
      return;
    }
    if (state !== 'PLAYING') { return; }

    // Find nearest un-judged platform within WINDOW_GOOD
    var best = null;
    var bestDist = 9999;
    var i, p, platCenter, dist;
    for (i = 0; i < platforms.length; i++) {
      p = platforms[i];
      if (p.judged) { continue; }
      platCenter = p.y + PLAT_H / 2;
      dist       = Math.abs(platCenter - PLAYER_Y);
      if (dist <= scrollSpeed * WINDOW_GOOD && dist < bestDist) {
        bestDist = dist;
        best     = p;
      }
    }

    if (best === null) {
      try { Audio.play('tap'); } catch (e) {}
      return;
    }

    best.judged = true;
    var timing  = bestDist / scrollSpeed;

    if (timing <= WINDOW_PERF) {
      score += 2;
      streak++;
      if (streak >= 3) { score += 1; }
      flashText  = 'PERFECT!';
      flashColor = '#00e5ff';
      flashTimer = 0.7;
      targetX    = best.xCenter;
      try { Audio.play('gem'); } catch (e) {}
    } else {
      score += 1;
      streak++;
      flashText  = 'GOOD!';
      flashColor = '#ffeb3b';
      flashTimer = 0.5;
      targetX    = best.xCenter;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  function drawBg() {
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = 'rgba(0,200,255,0.04)';
    ctx.lineWidth   = 1;
    var gx;
    for (gx = 0; gx < VW; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, VH);
      ctx.stroke();
    }
  }

  function drawTrack() {
    ctx.strokeStyle = 'rgba(0,200,255,0.18)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(VW / 2, 0);
    ctx.lineTo(VW / 2, VH);
    ctx.stroke();
  }

  function drawPlatforms() {
    var i, p, platCenter, dist, proximity;
    for (i = 0; i < platforms.length; i++) {
      p = platforms[i];
      if (p.judged) { continue; }
      platCenter  = p.y + PLAT_H / 2;
      dist        = Math.abs(platCenter - PLAYER_Y);
      proximity   = 1 - clamp(dist / (scrollSpeed * WINDOW_GOOD * 2), 0, 1);

      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur  = proximity * 24;
      ctx.fillStyle   = '#00bcd4';
      ctx.fillRect(p.x, p.y, PLAT_W, PLAT_H);

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(p.x + 4, p.y + 2, PLAT_W - 8, 3);
      ctx.shadowBlur = 0;
    }
    ctx.shadowBlur = 0;
  }

  function drawPlayer() {
    var sx  = shakeTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
    var px2 = playerX + sx;
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = '#ff4081';
    ctx.beginPath();
    ctx.arc(px2, PLAYER_Y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(px2 - 5, PLAYER_Y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTargetLine() {
    ctx.strokeStyle = 'rgba(255,64,129,0.2)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, PLAYER_Y);
    ctx.lineTo(VW, PLAYER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFlash() {
    if (!flashText || flashTimer <= 0) { return; }
    var alpha = clamp(flashTimer * 2, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = flashColor;
    ctx.font        = 'bold 36px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(flashText, VW / 2, PLAYER_Y - 50);
    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
  }

  function drawLives() {
    ctx.font      = '26px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff1744';
    var str = '';
    var i;
    for (i = 0; i < MAX_LIVES; i++) {
      str += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(str, 16, 44);
  }

  function drawScore() {
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, VW - 16, 44);
    if (streak >= 3) {
      ctx.font      = '14px monospace';
      ctx.fillStyle = '#ffeb3b';
      ctx.fillText('x' + streak + ' streak', VW - 16, 64);
    }
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    drawBg();
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#00e5ff';
    ctx.font        = 'bold 54px monospace';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 24;
    ctx.fillText('ROOFTOP', VW / 2, VH / 2 - 60);
    ctx.fillStyle   = '#ff4081';
    ctx.shadowColor = '#ff4081';
    ctx.fillText('RUN', VW / 2, VH / 2);
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = '20px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 70);
    if (bestScore > 0) {
      ctx.fillStyle = '#aaaacc';
      ctx.font      = '16px monospace';
      ctx.fillText('BEST: ' + bestScore, VW / 2, VH / 2 + 106);
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    drawBg();
    ctx.fillStyle = 'rgba(4,5,14,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#ff4081';
    ctx.font        = 'bold 48px monospace';
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur  = 20;
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 60px monospace';
    ctx.fillText(score, VW / 2, VH / 2);

    ctx.fillStyle = '#ffeb3b';
    ctx.font      = '22px monospace';
    ctx.fillText('BEST: ' + bestScore, VW / 2, VH / 2 + 52);

    ctx.fillStyle = '#aaaacc';
    ctx.font      = '18px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 110);
    ctx.textAlign = 'left';
  }

  // ── Draw (main) ────────────────────────────────────────────────────────────

  function draw() {
    if (!ctx) { return; }
    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') { drawMenu(); return; }
    if (state === 'DEAD')  { drawDead();  return; }

    // PLAYING
    drawBg();
    drawTrack();
    drawTargetLine();
    drawPlatforms();
    drawPlayer();
    drawFlash();
    drawLives();
    drawScore();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function getBest() { return bestScore; }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

}());
