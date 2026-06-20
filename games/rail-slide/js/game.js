'use strict';

var RailSlide = (function () {

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var VW = 390;
  var VH = 844;

  var LANE_COUNT = 3;
  var LANE_POSITIONS = [97, 195, 293]; // x-centres for left, center, right lanes

  var PLAYER_Y = 260; // player fixed y (top third of screen)

  var BASE_SPEED = 320;       // px/s at start
  var MAX_SPEED  = 780;       // px/s cap
  var ACCEL      = 18;        // px/s² speed-up

  var OBSTACLE_H   = 18;
  var OBSTACLE_W   = 62;
  var COIN_R       = 12;
  var PLAYER_W     = 34;
  var PLAYER_H     = 46;

  var OBSTACLE_SPAWN_BASE = 1.35; // seconds between spawns at start
  var OBSTACLE_SPAWN_MIN  = 0.42;

  var COIN_SPAWN_BASE = 0.85;
  var COIN_SPAWN_MIN  = 0.32;

  var COIN_PTS = 10;

  // Rail glow colours
  var COL_BG      = '#0d0014';
  var COL_RAIL_L  = '#00ffe7';   // cyan
  var COL_RAIL_R  = '#ff00cc';   // magenta
  var COL_OBS     = '#ff2244';
  var COL_COIN    = '#ffe844';
  var COL_PLAYER  = '#a0ffcc';
  var COL_SCORE   = '#ffffff';
  var COL_TITLE   = '#00ffe7';
  var COL_SHADOW  = '#ff00cc';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var canvas, ctx;
  var state;       // 'MENU' | 'PLAYING' | 'DEAD'
  var score;
  var best;
  var _isNewBest = false;
  var distScore;   // fractional distance accumulator
  var speed;
  var lane;        // 0=left 1=center 2=right
  var obstacles;   // [{x, y, lane}]
  var coins;       // [{x, y, lane, taken}]
  var obTimer;     // seconds until next obstacle
  var coinTimer;
  var time;        // total elapsed seconds in PLAYING

  // Lane-change animation
  var laneAnim;      // {from, to, t} or null
  var LANE_ANIM_DUR = 0.07; // seconds for lane switch

  // Player bob
  var bobT = 0;

  // Particle effects
  var particles; // [{x,y,vx,vy,life,maxLife,r,col}]

  // Menu pulse timer
  var menuT = 0;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function init(c, bestScore) {
    canvas = c;
    ctx    = canvas.getContext('2d');
    best   = bestScore || 0;
    state  = 'MENU';
    menuT  = 0;
  }

  function update(dt) {
    if (dt > 0.05) dt = 0.05;

    if (state === 'MENU') {
      menuT += dt;
      return;
    }

    if (state === 'DEAD') {
      updateParticles(dt);
      return;
    }

    // --- PLAYING ---
    time     += dt;
    bobT     += dt;

    // Accelerate
    speed += ACCEL * dt;
    if (speed > MAX_SPEED) { speed = MAX_SPEED; }

    // Distance score (1 pt per 60 px)
    distScore += speed * dt / 60;
    score = Math.floor(distScore) + (score - Math.floor(distScore - (speed * dt / 60))); // keep coin pts
    // Simpler: track dist separately, recompute total in draw
    // (see scoreFn below)

    // Lane animation
    if (laneAnim) {
      laneAnim.t += dt;
      if (laneAnim.t >= LANE_ANIM_DUR) {
        lane     = laneAnim.to;
        laneAnim = null;
      }
    }

    // Spawn obstacles
    obTimer -= dt;
    if (obTimer <= 0) {
      spawnObstacle();
      var interval = OBSTACLE_SPAWN_BASE - time * 0.012;
      if (interval < OBSTACLE_SPAWN_MIN) { interval = OBSTACLE_SPAWN_MIN; }
      obTimer = interval * (0.8 + Math.random() * 0.4);
    }

    // Spawn coins
    coinTimer -= dt;
    if (coinTimer <= 0) {
      spawnCoin();
      var cint = COIN_SPAWN_BASE - time * 0.008;
      if (cint < COIN_SPAWN_MIN) { cint = COIN_SPAWN_MIN; }
      coinTimer = cint * (0.7 + Math.random() * 0.6);
    }

    // Move obstacles upward
    var i;
    for (i = 0; i < obstacles.length; i++) {
      obstacles[i].y -= speed * dt;
    }

    // Move coins upward
    for (i = 0; i < coins.length; i++) {
      coins[i].y -= speed * dt;
    }

    // Player current x
    var px = playerX();

    // Collision: obstacles
    for (i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      if (ob.y + OBSTACLE_H < PLAYER_Y - PLAYER_H * 0.5) { continue; }
      if (ob.y > PLAYER_Y + PLAYER_H * 0.5) { continue; }
      var obX = LANE_POSITIONS[ob.lane];
      if (Math.abs(obX - px) < (OBSTACLE_W * 0.45 + PLAYER_W * 0.4)) {
        killPlayer();
        return;
      }
    }

    // Coin pickup
    for (i = 0; i < coins.length; i++) {
      var co = coins[i];
      if (co.taken) { continue; }
      if (Math.abs(co.y - PLAYER_Y) > COIN_R + PLAYER_H * 0.5) { continue; }
      var coX = LANE_POSITIONS[co.lane];
      if (Math.abs(coX - px) < COIN_R + PLAYER_W * 0.4) {
        co.taken = true;
        score += COIN_PTS;
        spawnCoinParticles(coX, co.y);
        try { Audio.play('gem'); } catch (e) {}
      }
    }

    // Cull off-screen
    obstacles = filterAbove(obstacles, -OBSTACLE_H - 20);
    coins     = filterAbove(coins,     -COIN_R - 20);

    // Update particles
    updateParticles(dt);
  }

  function draw() {
    if (!ctx) { return; }

    ctx.clearRect(0, 0, VW, VH);

    // Background
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0,   '#0d0014');
    grad.addColorStop(0.6, '#110020');
    grad.addColorStop(1,   '#1a0030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    drawGrid();
    drawRails();

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawObstacles();
    drawCoins();
    drawPlayer();
    drawParticles();
    drawHUD();

    if (state === 'DEAD') {
      drawDeadOverlay();
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      return;
    }

    if (state === 'DEAD') {
      startGame();
      return;
    }

    // PLAYING: left half → move left, right half → move right
    if (x < VW / 2) {
      moveLeft();
    } else {
      moveRight();
    }
  }

  function getBest() {
    return best;
  }

  // ---------------------------------------------------------------------------
  // Game logic helpers
  // ---------------------------------------------------------------------------

  function startGame() {
    state     = 'PLAYING';
    score     = 0;
    distScore = 0;
    speed     = BASE_SPEED;
    lane      = 1; // center
    laneAnim  = null;
    obstacles = [];
    coins     = [];
    particles = [];
    obTimer   = 0.6;
    coinTimer = 0.4;
    time      = 0;
    bobT      = 0;
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function killPlayer() {
    state = 'DEAD';
    var fx = playerX();
    spawnCrashParticles(fx, PLAYER_Y);
    try { Audio.play('crash'); } catch (e) {}
    try { Audio.play('lose'); }  catch (e) {}
    _isNewBest = score > best;
    if (score > best) { best = score; }
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd();     } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'railslide_best'); } catch(e) {}
  }

  function moveLeft() {
    var target = currentLane();
    if (target > 0) {
      startLaneAnim(target, target - 1);
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function moveRight() {
    var target = currentLane();
    if (target < LANE_COUNT - 1) {
      startLaneAnim(target, target + 1);
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function currentLane() {
    if (laneAnim) { return laneAnim.to; }
    return lane;
  }

  function startLaneAnim(from, to) {
    if (laneAnim) {
      // Already animating — snap to current destination and start new anim
      lane = laneAnim.to;
    }
    laneAnim = { from: from, to: to, t: 0 };
  }

  function playerX() {
    if (!laneAnim) { return LANE_POSITIONS[lane]; }
    var t  = laneAnim.t / LANE_ANIM_DUR;
    if (t > 1) { t = 1; }
    // Ease-out cubic
    t = 1 - Math.pow(1 - t, 3);
    return LANE_POSITIONS[laneAnim.from] + (LANE_POSITIONS[laneAnim.to] - LANE_POSITIONS[laneAnim.from]) * t;
  }

  function spawnObstacle() {
    // Pick a random lane; avoid stacking on same lane as most recent obstacle
    var l = Math.floor(Math.random() * LANE_COUNT);
    obstacles.push({ lane: l, y: VH + OBSTACLE_H + 20 });
  }

  function spawnCoin() {
    var l = Math.floor(Math.random() * LANE_COUNT);
    // Stagger a cluster of 2-4 coins vertically
    var count = 1 + Math.floor(Math.random() * 3);
    var startY = VH + COIN_R + 20;
    var i;
    for (i = 0; i < count; i++) {
      coins.push({ lane: l, y: startY + i * (COIN_R * 2.8), taken: false });
    }
  }

  function filterAbove(arr, threshold) {
    var out = [];
    var i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i].y > threshold) { out.push(arr[i]); }
    }
    return out;
  }

  function totalScore() {
    return score;
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------

  function spawnCoinParticles(x, y) {
    var i;
    for (i = 0; i < 8; i++) {
      var angle = (Math.PI * 2 * i) / 8;
      var spd   = 60 + Math.random() * 80;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0, maxLife: 0.45,
        r: 3 + Math.random() * 3,
        col: COL_COIN
      });
    }
  }

  function spawnCrashParticles(x, y) {
    var i;
    for (i = 0; i < 18; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd   = 80 + Math.random() * 200;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 60,
        life: 0, maxLife: 0.7 + Math.random() * 0.4,
        r: 4 + Math.random() * 6,
        col: Math.random() > 0.5 ? COL_OBS : '#ff8800'
      });
    }
  }

  function updateParticles(dt) {
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.life += dt;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 200 * dt; // gravity
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Draw helpers
  // ---------------------------------------------------------------------------

  function drawGrid() {
    // Subtle perspective grid lines converging to a vanishing point
    var vp = { x: VW / 2, y: VH * 0.15 }; // vanishing point
    ctx.save();
    ctx.strokeStyle = 'rgba(100,0,180,0.18)';
    ctx.lineWidth   = 1;
    var i;
    // Horizontal grid lines (perspective rows)
    for (i = 0; i < 14; i++) {
      var rowY = VH * 0.18 + i * (VH * 0.07) * (1 + i * 0.08);
      if (rowY > VH + 10) { break; }
      ctx.beginPath();
      ctx.moveTo(0,  rowY);
      ctx.lineTo(VW, rowY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRails() {
    var i, lx;
    for (i = 0; i < LANE_COUNT; i++) {
      lx = LANE_POSITIONS[i];
      // Alternate cyan and magenta for outer rails, white for center
      var col;
      if (i === 0)      { col = COL_RAIL_L; }
      else if (i === 2) { col = COL_RAIL_R; }
      else              { col = '#ffffff'; }

      // Glow: draw multiple strokes at increasing widths with decreasing alpha
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 6;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, VH);
      ctx.stroke();

      ctx.lineWidth   = 3;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, VH);
      ctx.stroke();

      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, VH);
      ctx.stroke();
      ctx.restore();

      // Lane edge dashes (speed sensation)
      if (i < LANE_COUNT - 1) {
        var midX = (LANE_POSITIONS[i] + LANE_POSITIONS[i + 1]) / 2;
        drawDashedLine(midX, 'rgba(80,0,140,0.22)');
      }
    }
  }

  function drawDashedLine(x, col) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1;
    ctx.setLineDash([14, 22]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawObstacles() {
    var i, ob, ox, oy;
    for (i = 0; i < obstacles.length; i++) {
      ob = obstacles[i];
      ox = LANE_POSITIONS[ob.lane];
      oy = ob.y;

      // Glow
      ctx.save();
      ctx.shadowColor = COL_OBS;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = COL_OBS;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(ox - OBSTACLE_W / 2 - 8, oy - OBSTACLE_H / 2 - 8,
                   OBSTACLE_W + 16, OBSTACLE_H + 16);
      ctx.restore();

      // Body
      ctx.save();
      ctx.shadowColor = COL_OBS;
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = COL_OBS;
      ctx.globalAlpha = 0.9;
      roundRect(ctx, ox - OBSTACLE_W / 2, oy - OBSTACLE_H / 2,
                OBSTACLE_W, OBSTACLE_H, 4);
      ctx.fill();
      ctx.restore();

      // Inner highlight bar
      ctx.save();
      ctx.fillStyle   = '#ff8899';
      ctx.globalAlpha = 0.7;
      roundRect(ctx, ox - OBSTACLE_W / 2 + 4, oy - OBSTACLE_H / 2 + 4,
                OBSTACLE_W - 8, 4, 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCoins() {
    var i, co, cx2, cy;
    for (i = 0; i < coins.length; i++) {
      co  = coins[i];
      if (co.taken) { continue; }
      cx2 = LANE_POSITIONS[co.lane];
      cy  = co.y;

      // Outer glow
      ctx.save();
      ctx.shadowColor = COL_COIN;
      ctx.shadowBlur  = 22;
      ctx.fillStyle   = COL_COIN;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(cx2, cy, COIN_R + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Coin body
      ctx.save();
      ctx.shadowColor = COL_COIN;
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = COL_COIN;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(cx2, cy, COIN_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner shine
      ctx.save();
      ctx.fillStyle   = '#fffbe8';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx2 - COIN_R * 0.25, cy - COIN_R * 0.25, COIN_R * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer() {
    var px  = playerX();
    var py  = PLAYER_Y;
    var bob = Math.sin(bobT * 8) * 2.5;
    py += bob;

    // Shadow
    ctx.save();
    ctx.fillStyle   = 'rgba(0,0,0,0.35)';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(px, py + PLAYER_H * 0.52, PLAYER_W * 0.38, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = COL_PLAYER;
    ctx.shadowBlur  = 20;

    // Board (bottom)
    ctx.fillStyle   = '#cc88ff';
    ctx.globalAlpha = 0.95;
    roundRect(ctx, px - PLAYER_W / 2, py + PLAYER_H * 0.3, PLAYER_W, 7, 3);
    ctx.fill();

    // Wheels
    ctx.fillStyle   = '#8844cc';
    ctx.beginPath();
    ctx.arc(px - PLAYER_W * 0.32, py + PLAYER_H * 0.3 + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + PLAYER_W * 0.32, py + PLAYER_H * 0.3 + 9, 5, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle   = COL_PLAYER;
    ctx.globalAlpha = 0.95;
    // Torso
    ctx.fillRect(px - 7, py - PLAYER_H * 0.2, 14, PLAYER_H * 0.44);

    // Head
    ctx.beginPath();
    ctx.arc(px, py - PLAYER_H * 0.28, 9, 0, Math.PI * 2);
    ctx.fill();

    // Helmet visor
    ctx.fillStyle   = '#00ffe7';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(px + 2, py - PLAYER_H * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Left arm
    ctx.strokeStyle = COL_PLAYER;
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(px - 7, py - PLAYER_H * 0.1);
    ctx.lineTo(px - PLAYER_W * 0.45, py + PLAYER_H * 0.08);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(px + 7, py - PLAYER_H * 0.1);
    ctx.lineTo(px + PLAYER_W * 0.45, py + PLAYER_H * 0.08);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    var i, p, alpha;
    for (i = 0; i < particles.length; i++) {
      p     = particles[i];
      alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle   = p.col;
      ctx.shadowColor = p.col;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHUD() {
    // Score
    ctx.save();
    ctx.font        = 'bold 28px monospace';
    ctx.textAlign   = 'center';
    ctx.fillStyle   = COL_SCORE;
    ctx.shadowColor = COL_RAIL_L;
    ctx.shadowBlur  = 12;
    ctx.fillText(String(score), VW / 2, 48);
    ctx.restore();

    // Speed bar
    var barW   = 120;
    var barH   = 6;
    var barX   = VW / 2 - barW / 2;
    var barY   = 58;
    var pct    = (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    ctx.save();
    ctx.fillStyle   = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle   = COL_RAIL_L;
    ctx.shadowColor = COL_RAIL_L;
    ctx.shadowBlur  = 8;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.restore();

    // Best
    ctx.save();
    ctx.font        = '16px monospace';
    ctx.textAlign   = 'right';
    ctx.fillStyle   = 'rgba(255,255,255,0.45)';
    ctx.fillText('BEST ' + String(best), VW - 16, 48);
    ctx.restore();
  }

  function drawMenu() {
    // Title
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowBlur  = 30;
    ctx.shadowColor = COL_SHADOW;
    ctx.fillStyle   = COL_TITLE;
    ctx.font        = 'bold 58px monospace';
    ctx.fillText('RAIL', VW / 2, VH * 0.3);
    ctx.fillStyle   = '#ff00cc';
    ctx.shadowColor = COL_TITLE;
    ctx.fillText('SLIDE', VW / 2, VH * 0.3 + 64);
    ctx.restore();

    // Subtitle / instructions
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font      = '17px monospace';
    ctx.fillStyle = 'rgba(200,200,255,0.75)';
    ctx.fillText('DODGE BARRIERS  GRAB COINS', VW / 2, VH * 0.52);
    ctx.fillText('TAP LEFT / RIGHT TO SWITCH LANES', VW / 2, VH * 0.52 + 30);
    ctx.restore();

    // Pulsing TAP TO PLAY
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(menuT * 2.2));
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 26px monospace';
    ctx.fillStyle   = COL_TITLE;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = COL_TITLE;
    ctx.shadowBlur  = 18;
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.68);
    ctx.restore();

    // Best score
    if (best > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font      = '20px monospace';
      ctx.fillStyle = COL_COIN;
      ctx.fillText('BEST  ' + String(best), VW / 2, VH * 0.78);
      ctx.restore();
    }

    // Skater preview
    drawMenuSkater();
  }

  function drawMenuSkater() {
    var px = VW / 2;
    var py = VH * 0.43;
    var bob = Math.sin(menuT * 5) * 4;
    py += bob;

    ctx.save();
    ctx.shadowColor = COL_PLAYER;
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = COL_PLAYER;

    // Board
    ctx.fillStyle = '#cc88ff';
    roundRect(ctx, px - 22, py + 18, 44, 9, 4);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#8844cc';
    ctx.beginPath();
    ctx.arc(px - 13, py + 31, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 13, py + 31, 6, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = COL_PLAYER;
    ctx.fillRect(px - 9, py - 8, 18, 26);

    // Head
    ctx.beginPath();
    ctx.arc(px, py - 16, 12, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#00ffe7';
    ctx.beginPath();
    ctx.arc(px + 3, py - 18, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDeadOverlay() {
    // Dim
    ctx.save();
    ctx.fillStyle   = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Panel
    var panW = 300;
    var panH = 260;
    var panX = (VW - panW) / 2;
    var panY = (VH - panH) / 2;

    ctx.save();
    ctx.fillStyle   = 'rgba(13,0,30,0.92)';
    ctx.strokeStyle = COL_OBS;
    ctx.lineWidth   = 2;
    ctx.shadowColor = COL_OBS;
    ctx.shadowBlur  = 24;
    roundRect(ctx, panX, panY, panW, panH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';

    // WIPEOUT header
    ctx.font        = 'bold 36px monospace';
    ctx.fillStyle   = COL_OBS;
    ctx.shadowColor = COL_OBS;
    ctx.shadowBlur  = 18;
    ctx.fillText('WIPEOUT!', VW / 2, panY + 58);
    ctx.shadowBlur  = 0;

    // Score
    ctx.font        = 'bold 52px monospace';
    ctx.fillStyle   = COL_SCORE;
    ctx.shadowColor = COL_RAIL_L;
    ctx.shadowBlur  = 14;
    ctx.fillText(String(score), VW / 2, panY + 128);
    ctx.shadowBlur  = 0;

    // Best
    ctx.font        = '20px monospace';
    ctx.fillStyle   = COL_COIN;
    ctx.shadowBlur  = 8;
    var bestLabel = _isNewBest ? 'NEW BEST!' : ('BEST  ' + String(best));
    ctx.fillText(bestLabel, VW / 2, panY + 163);
    ctx.shadowBlur  = 0;

    // TAP TO RETRY
    var rpulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 500));
    ctx.font        = 'bold 22px monospace';
    ctx.fillStyle   = COL_TITLE;
    ctx.globalAlpha = rpulse;
    ctx.shadowColor = COL_TITLE;
    ctx.shadowBlur  = 16;
    ctx.fillText('TAP TO RETRY', VW / 2, panY + 222);
    ctx.shadowBlur  = 0;

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  function roundRect(context, x, y, w, h, r) {
    if (r > w / 2) { r = w / 2; }
    if (r > h / 2) { r = h / 2; }
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  // ---------------------------------------------------------------------------
  // Return public API
  // ---------------------------------------------------------------------------
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
