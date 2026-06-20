'use strict';
var EndlessRunner = (function () {

  var canvas, ctx;
  var state; // MENU, PLAYING, DEAD
  var best;

  // player
  var px, py, pvy, pw, ph, onGround;
  var JUMP_VEL = -900;
  var GRAVITY = 2200;
  var PLAYER_X = 100;
  var PLAYER_W = 36;
  var PLAYER_H = 36;

  // world
  var scrollX;
  var speed;
  var SPEED_BASE = 280;
  var SPEED_INC = 18;
  var score;
  var scoreFrac;

  // ground segments: {x, w} — solid ground pieces
  var segments;
  // obstacles: {x, w, h} on ground
  var obstacles;

  // ground y
  var GROUND_Y = 680;

  var VW = 390;
  var VH = 844;

  // ---- generation ----
  var GEN_AHEAD = 900; // how far ahead to generate
  var worldEnd; // rightmost generated x

  function segEnd(s) { return s.x + s.w; }

  function generateAhead() {
    while (worldEnd - scrollX < GEN_AHEAD) {
      // choose gap or solid
      var roll = Math.random();
      if (roll < 0.35) {
        // gap
        var gapW = 60 + Math.random() * 80;
        worldEnd += gapW;
      } else {
        // solid segment
        var segW = 120 + Math.random() * 200;
        var seg = { x: worldEnd, w: segW };
        segments.push(seg);
        // maybe obstacle on segment
        if (Math.random() < 0.45 && segW > 80) {
          var ox = worldEnd + 30 + Math.random() * (segW - 60);
          var oh = 28 + Math.random() * 28;
          obstacles.push({ x: ox, w: 20, h: oh });
        }
        worldEnd += segW;
      }
    }
  }

  function cullBehind() {
    var edge = scrollX - 100;
    var i;
    for (i = segments.length - 1; i >= 0; i--) {
      if (segments[i].x + segments[i].w < edge) segments.splice(i, 1);
    }
    for (i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].x + obstacles[i].w < edge) obstacles.splice(i, 1);
    }
  }

  // ---- physics / collision ----
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function resetGame() {
    scrollX = 0;
    speed = SPEED_BASE;
    score = 0;
    scoreFrac = 0;
    segments = [];
    obstacles = [];
    worldEnd = 0;

    // start with solid ground under player
    segments.push({ x: 0, w: 350 });
    worldEnd = 350;
    generateAhead();

    px = PLAYER_X;
    py = GROUND_Y - PLAYER_H;
    pvy = 0;
    onGround = true;
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    resetGame();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    // speed increases with score
    speed = SPEED_BASE + score * SPEED_INC * 0.05;

    scrollX += speed * dt;
    scoreFrac += speed * dt / 100;
    score = Math.floor(scoreFrac);

    generateAhead();
    cullBehind();

    // gravity
    pvy += GRAVITY * dt;
    py += pvy * dt;

    // check ground collision
    onGround = false;
    var i;
    for (i = 0; i < segments.length; i++) {
      var s = segments[i];
      var sx = s.x - scrollX;
      // player screen x is always PLAYER_X
      // player world x is scrollX + PLAYER_X... no:
      // worldX of player = PLAYER_X + scrollX (player screen pos is fixed at PLAYER_X)
      // segment world coords: s.x to s.x+s.w
      // player world x: scrollX + PLAYER_X
      var pwx = scrollX + PLAYER_X;
      if (pwx + PLAYER_W > s.x && pwx < s.x + s.w) {
        // horizontally overlapping
        var groundTop = GROUND_Y;
        if (py + PLAYER_H >= groundTop && pvy >= 0) {
          py = groundTop - PLAYER_H;
          pvy = 0;
          onGround = true;
        }
      }
    }

    // fall into gap = dead
    if (py > VH + 50) {
      die();
      return;
    }

    // obstacle collision (world coords)
    var pwx2 = scrollX + PLAYER_X;
    for (i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      var obScreenX = ob.x - scrollX;
      if (rectOverlap(PLAYER_X, py, PLAYER_W, PLAYER_H,
                      obScreenX, GROUND_Y - ob.h, ob.w, ob.h)) {
        die();
        return;
      }
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('crash'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'endlessrunner_best'); } catch(e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') {
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (state === 'DEAD') {
      resetGame();
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (state === 'PLAYING' && onGround) {
      pvy = JUMP_VEL;
      onGround = false;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ---- drawing ----
  function drawGround() {
    // draw visible ground segments
    var i;
    for (i = 0; i < segments.length; i++) {
      var s = segments[i];
      var sx = s.x - scrollX;
      var sw = s.w;
      // ground block
      ctx.fillStyle = '#5d8a3c';
      ctx.fillRect(sx, GROUND_Y, sw, VH - GROUND_Y);
      // top strip
      ctx.fillStyle = '#7bc950';
      ctx.fillRect(sx, GROUND_Y, sw, 8);
      // pixel grid lines
      ctx.strokeStyle = '#4a7030';
      ctx.lineWidth = 1;
      var gx;
      for (gx = 0; gx < sw; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(sx + gx, GROUND_Y);
        ctx.lineTo(sx + gx, VH);
        ctx.stroke();
      }
    }
  }

  function drawObstacles() {
    var i;
    for (i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      var ox = ob.x - scrollX;
      var oy = GROUND_Y - ob.h;
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(ox, oy, ob.w, ob.h);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(ox + 2, oy + 2, ob.w - 4, 6);
      ctx.fillStyle = '#922b21';
      ctx.fillRect(ox, oy + ob.h - 4, ob.w, 4);
    }
  }

  function drawPlayer() {
    var px2 = PLAYER_X;
    // body
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(px2, py, PLAYER_W, PLAYER_H);
    // eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(px2 + 20, py + 8, 10, 10);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(px2 + 23, py + 10, 5, 5);
    // legs (animated)
    var legPhase = (scrollX / 20) % (Math.PI * 2);
    var leg1 = Math.sin(legPhase) * 8;
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(px2 + 4, py + PLAYER_H, 10, 10 + leg1);
    ctx.fillRect(px2 + 20, py + PLAYER_H, 10, 10 - leg1);
  }

  function drawBg() {
    // sky gradient
    var grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, '#87ceeb');
    grad.addColorStop(1, '#d4f1f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, GROUND_Y);

    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    var cloudOffsets = [50, 180, 310];
    var i;
    for (i = 0; i < cloudOffsets.length; i++) {
      var cx2 = ((cloudOffsets[i] - scrollX * 0.2) % (VW + 100) + VW + 100) % (VW + 100) - 50;
      var cy2 = 100 + i * 70;
      ctx.beginPath();
      ctx.arc(cx2, cy2, 30, 0, Math.PI * 2);
      ctx.arc(cx2 + 30, cy2 - 10, 25, 0, Math.PI * 2);
      ctx.arc(cx2 + 60, cy2, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 16, 40);
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + best, VW - 16, 40);
  }

  function drawMenu() {
    drawBg();
    drawGround();
    drawPlayer();

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENDLESS', VW / 2, 320);
    ctx.fillText('RUNNER', VW / 2, 385);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, 480);

    if (best > 0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = '22px monospace';
      ctx.fillText('BEST: ' + best, VW / 2, 530);
    }
  }

  function drawDead() {
    drawBg();
    drawGround();
    drawObstacles();
    drawPlayer();
    drawHUD();

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEAD!', VW / 2, 340);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SCORE: ' + score, VW / 2, 410);

    ctx.fillStyle = '#f1c40f';
    ctx.font = '24px monospace';
    ctx.fillText('BEST: ' + best, VW / 2, 450);

    ctx.fillStyle = '#7dcea0';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    if (state === 'MENU') {
      drawMenu();
      return;
    }
    drawBg();
    drawGround();
    drawObstacles();
    drawPlayer();
    drawHUD();
    if (state === 'DEAD') {
      drawDead();
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
