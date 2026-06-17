'use strict';

var SpikeField = (function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  var VW = 390, VH = 844;

  var GROUND_Y   = VH - 40;   // top of ground panel
  var CEILING_Y  = 40;         // bottom of ceiling panel

  var CHAR_X     = 100;        // fixed screen-x of character
  var CHAR_W     = 24;
  var CHAR_H     = 28;

  // Pogo stick dimensions
  var POGO_W     = 6;
  var POGO_H     = 22;

  var GRAVITY      = 1600;     // px/s²
  var BOUNCE_FORCE = 820;      // upward vy on ground hit
  var TAP_BOOST    = 320;      // extra upward velocity on tap (while on ground / ascending)
  var TAP_DAMP     = 0.55;     // multiply vy by this when tapping while moving up fast

  var BASE_SPEED   = 200;      // world scroll speed px/s
  var SPEED_INC    = 6;        // px/s per 10 score

  var SPIKE_H_GROUND  = 24;    // ground spike height
  var SPIKE_H_CEIL    = 20;    // ceiling spike height
  var SPIKE_W         = 18;    // base width of one spike triangle

  // Cluster generation
  var CLUSTER_MIN_SPIKES  = 3;
  var CLUSTER_MAX_SPIKES  = 7;
  var GAP_MIN             = 80;
  var GAP_MAX             = 160;
  var CLUSTER_SPACING_MIN = 40;  // min flat gap between cluster top tips
  var CLUSTER_SPACING_MAX = 20;  // added randomness

  // Spark / trail
  var MAX_SPARKS = 18;
  var TRAIL_LEN  = 5;

  // Colours
  var COL_BG        = '#1a1a20';
  var COL_PANEL     = '#131318';
  var COL_PANEL2    = '#0e0e12';
  var COL_RIVET     = '#2a2a32';
  var COL_SPIKE     = '#b0b8c8';
  var COL_SPIKE_HI  = '#e8eef8';
  var COL_CHAR_BODY = '#f5a623';
  var COL_CHAR_HI   = '#ffe07a';
  var COL_CHAR_DARK = '#c47a10';
  var COL_POGO      = '#e0e0e0';
  var COL_POGO_DARK = '#888';
  var COL_SPRING    = '#f5a623';
  var COL_SPARK     = '#ffe07a';
  var COL_SPARK2    = '#ff9020';
  var COL_SCORE     = '#ffffff';
  var COL_GREY      = '#8899aa';
  var COL_TITLE     = '#f5a623';
  var COL_DEAD_OVL  = 'rgba(0,0,0,0.6)';
  var COL_PANEL_BG  = 'rgba(14,14,20,0.93)';
  var COL_STRIPE    = 'rgba(255,255,255,0.018)';

  // ── Module state ──────────────────────────────────────────────────────────
  var _canvas, _ctx;
  var _state;   // 'MENU' | 'PLAYING' | 'DEAD'
  var _score, _best;

  // Character physics
  var _charY, _velY;
  var _onGround;      // true when resting on ground this frame
  var _onCeiling;     // true when hitting ceiling

  // Pogo spring animation
  var _springComp;    // compression 0-1 (1 = fully compressed)
  var _springVel;

  // Trail positions
  var _trail;  // array of {x, y}

  // Sparks [{x,y,vx,vy,life,maxLife,color}]
  var _sparks;

  // Spike clusters [{x, spikesGround: [{bx}], spikesCeil: [{bx}], scored}]
  // bx = base-left x relative to cluster x
  var _clusters;
  var _worldX;       // total distance scrolled (for score)
  var _speed;
  var _nextClusterX; // absolute x at which next cluster should appear

  // Dead overlay timer
  var _deadTimer;

  // Menu demo pogo
  var _demoY, _demoVY;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = bestScore || 0;
    _setState('MENU');
  }

  function _setState(s) {
    _state = s;
    if (s === 'MENU') {
      _demoY  = GROUND_Y - CHAR_H - POGO_H;
      _demoVY = -BOUNCE_FORCE;
    }
    if (s === 'PLAYING') {
      _resetGame();
      try { AdManager.gameplayStart(); } catch(e) {}
    }
    if (s === 'DEAD') {
      _deadTimer = 0;
      try { AdManager.gameplayStop(); } catch(e) {}
      try { AdManager.onRunEnd(); } catch(e) {}
    }
  }

  function _resetGame() {
    _charY      = GROUND_Y - CHAR_H - POGO_H;
    _velY       = -BOUNCE_FORCE;
    _onGround   = false;
    _onCeiling  = false;
    _springComp = 0;
    _springVel  = 0;
    _trail      = [];
    _sparks     = [];
    _clusters   = [];
    _score      = 0;
    _worldX     = 0;
    _speed      = BASE_SPEED;
    _nextClusterX = VW + 60;
    // Seed a few clusters off-screen to the right
    _spawnCluster(_nextClusterX);
    _scheduleNextCluster();
    _spawnCluster(_nextClusterX);
    _scheduleNextCluster();
  }

  function _scheduleNextCluster() {
    var gap = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    _nextClusterX += gap;
  }

  function _spawnCluster(x) {
    var nGround = CLUSTER_MIN_SPIKES + Math.floor(Math.random() * (CLUSTER_MAX_SPIKES - CLUSTER_MIN_SPIKES + 1));
    var nCeil   = CLUSTER_MIN_SPIKES + Math.floor(Math.random() * (CLUSTER_MAX_SPIKES - CLUSTER_MIN_SPIKES + 1));

    var spikesGround = [];
    var bx = 0;
    var i;
    for (i = 0; i < nGround; i++) {
      spikesGround.push({ bx: bx });
      bx += SPIKE_W + 1 + Math.floor(Math.random() * 4);
    }
    var groundWidth = bx;

    var spikesCeil = [];
    bx = 0;
    for (i = 0; i < nCeil; i++) {
      spikesCeil.push({ bx: bx });
      bx += SPIKE_W + 1 + Math.floor(Math.random() * 4);
    }
    var ceilWidth = bx;

    // Randomly offset the ceiling cluster relative to ground cluster
    var ceilOffset = Math.floor(Math.random() * 40) - 20;

    _clusters.push({
      x:            x,
      spikesGround: spikesGround,
      spikesCeil:   spikesCeil,
      ceilOffset:   ceilOffset,
      groundWidth:  groundWidth,
      ceilWidth:    ceilWidth,
      scored:       false
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function tap(x, y) {
    if (_state === 'MENU') {
      _setState('PLAYING');
      return;
    }
    if (_state === 'DEAD') {
      if (_deadTimer > 0.35) {
        _setState('PLAYING');
      }
      return;
    }
    if (_state === 'PLAYING') {
      try { Audio.play('tap'); } catch(e) {}
      if (_onGround) {
        // Bonus upward kick from ground
        _velY -= TAP_BOOST;
      } else if (_velY < 0) {
        // Already moving upward – mild additional boost
        _velY -= TAP_BOOST * 0.45;
      } else {
        // Moving downward – dampen / reverse
        _velY = _velY * TAP_DAMP - TAP_BOOST * 0.3;
      }
    }
  }

  function getBest() {
    return _best;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt) {
    if (_state === 'MENU')    { _updateMenu(dt);    return; }
    if (_state === 'PLAYING') { _updatePlaying(dt); return; }
    if (_state === 'DEAD')    { _deadTimer += dt;   return; }
  }

  function _updateMenu(dt) {
    _demoVY += GRAVITY * dt;
    _demoY  += _demoVY * dt;
    if (_demoY >= GROUND_Y - CHAR_H - POGO_H) {
      _demoY  = GROUND_Y - CHAR_H - POGO_H;
      _demoVY = -BOUNCE_FORCE * 0.85;
    }
  }

  function _updatePlaying(dt) {
    // Speed scaling: +6 px/s per 10 score points
    _speed = BASE_SPEED + Math.floor(_score / 10) * SPEED_INC;

    // Scroll world
    var dx = _speed * dt;
    _worldX += dx;

    var i, cl;
    for (i = 0; i < _clusters.length; i++) {
      _clusters[i].x -= dx;
    }

    // Spawn clusters
    while (_nextClusterX - _worldX < VW + 80) {
      _spawnCluster(_nextClusterX - _worldX + VW);
      _scheduleNextCluster();
    }

    // Remove off-screen clusters
    var keep = [];
    for (i = 0; i < _clusters.length; i++) {
      cl = _clusters[i];
      var maxW = Math.max(cl.groundWidth, cl.ceilWidth) + Math.abs(cl.ceilOffset) + 40;
      if (cl.x + maxW > -20) {
        keep.push(cl);
      }
    }
    _clusters = keep;

    // Physics
    _velY   += GRAVITY * dt;
    _charY  += _velY * dt;

    _onGround  = false;
    _onCeiling = false;

    // Character bounding box (body only, pogo extends below)
    var charTop    = _charY;
    var charBot    = _charY + CHAR_H;
    var pogoBot    = _charY + CHAR_H + POGO_H;
    var charLeft   = CHAR_X;
    var charRight  = CHAR_X + CHAR_W;

    // Ground collision
    if (pogoBot >= GROUND_Y) {
      _charY    = GROUND_Y - CHAR_H - POGO_H;
      pogoBot   = GROUND_Y;
      charBot   = _charY + CHAR_H;
      charTop   = _charY;
      _onGround = true;
      var wasFalling = _velY > 0;
      _velY = -BOUNCE_FORCE;
      if (wasFalling) {
        _springComp = 1;
        _spawnBounceSparks(CHAR_X + CHAR_W / 2, GROUND_Y);
        try { Audio.play('gem'); } catch(e) {}
      }
    }

    // Ceiling collision
    if (charTop <= CEILING_Y) {
      _charY     = CEILING_Y;
      charTop    = CEILING_Y;
      _onCeiling = true;
      if (_velY < 0) { _velY = Math.abs(_velY) * 0.5; }
    }

    // Spring animation
    _springComp += (_springVel - _springComp) * Math.min(1, dt * 18);
    if (_onGround) {
      _springComp = 0.85;
      _springVel  = 0;
    } else {
      _springComp += -_springComp * Math.min(1, dt * 12);
    }

    // Trail
    _trail.unshift({ x: CHAR_X, y: _charY });
    if (_trail.length > TRAIL_LEN) {
      _trail.length = TRAIL_LEN;
    }

    // Sparks
    for (i = _sparks.length - 1; i >= 0; i--) {
      var sp = _sparks[i];
      sp.x    += sp.vx * dt;
      sp.y    += sp.vy * dt;
      sp.vy   += 400 * dt;
      sp.life -= dt;
      if (sp.life <= 0) { _sparks.splice(i, 1); }
    }

    // Score: based on distance
    var newScore = Math.floor(_worldX / 80);
    if (newScore > _score) {
      _score = newScore;
      if (_score > _best) { _best = _score; }
    }

    // Spike collision
    if (_checkSpikeCollision(charLeft, charRight, charTop, pogoBot)) {
      _die();
      return;
    }

    // Score clusters passed
    for (i = 0; i < _clusters.length; i++) {
      cl = _clusters[i];
      if (!cl.scored) {
        var clRight = cl.x + Math.max(cl.groundWidth, cl.ceilWidth + Math.abs(cl.ceilOffset)) + 20;
        if (clRight < CHAR_X) {
          cl.scored = true;
          try { Audio.play('gem'); } catch(e) {}
        }
      }
    }
  }

  function _checkSpikeCollision(cLeft, cRight, cTop, cBot) {
    var i, j, cl, sp, sx, tipX, tipY, baseY;
    // Slight inset for forgiveness
    var il = cLeft  + 3;
    var ir = cRight - 3;
    var it = cTop   + 3;
    var ib = cBot   - 2;

    for (i = 0; i < _clusters.length; i++) {
      cl = _clusters[i];
      // Ground spikes (pointing up)
      for (j = 0; j < cl.spikesGround.length; j++) {
        sp    = cl.spikesGround[j];
        sx    = cl.x + sp.bx;
        tipX  = sx + SPIKE_W / 2;
        baseY = GROUND_Y;
        tipY  = GROUND_Y - SPIKE_H_GROUND;
        // Triangle bounding box
        if (ir > sx && il < sx + SPIKE_W && ib > tipY && it < baseY) {
          // Fine triangle check: interpolate width at collision point
          var depth = (ib - tipY) / SPIKE_H_GROUND;
          var halfW = (SPIKE_W / 2) * depth;
          var triL  = tipX - halfW;
          var triR  = tipX + halfW;
          if (ir > triL && il < triR) { return true; }
        }
      }
      // Ceiling spikes (pointing down)
      for (j = 0; j < cl.spikesCeil.length; j++) {
        sp    = cl.spikesCeil[j];
        sx    = cl.x + cl.ceilOffset + sp.bx;
        tipX  = sx + SPIKE_W / 2;
        tipY  = CEILING_Y + SPIKE_H_CEIL;
        baseY = CEILING_Y;
        if (ir > sx && il < sx + SPIKE_W && it < tipY && ib > baseY) {
          var depth2 = (tipY - it) / SPIKE_H_CEIL;
          var halfW2 = (SPIKE_W / 2) * depth2;
          var triL2  = tipX - halfW2;
          var triR2  = tipX + halfW2;
          if (ir > triL2 && il < triR2) { return true; }
        }
      }
    }
    return false;
  }

  function _spawnBounceSparks(cx, groundY) {
    var i, ang, spd, color;
    for (i = 0; i < 8; i++) {
      ang   = -Math.PI + Math.random() * Math.PI;  // upward hemisphere
      spd   = 120 + Math.random() * 220;
      color = Math.random() < 0.5 ? COL_SPARK : COL_SPARK2;
      _sparks.push({
        x:       cx + (Math.random() - 0.5) * 12,
        y:       groundY - 4,
        vx:      Math.cos(ang) * spd,
        vy:      Math.sin(ang) * spd - 60,
        life:    0.28 + Math.random() * 0.22,
        maxLife: 0.5,
        color:   color
      });
    }
    if (_sparks.length > MAX_SPARKS) {
      _sparks = _sparks.slice(_sparks.length - MAX_SPARKS);
    }
  }

  function _die() {
    try { Audio.play('crash'); } catch(e) {}
    try { Audio.play('lose'); } catch(e) {}
    _setState('DEAD');
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    _drawBackground(ctx);
    _drawPanels(ctx);
    _drawClusters(ctx);

    if (_state === 'MENU') {
      _drawMenuContent(ctx);
      return;
    }
    if (_state === 'PLAYING') {
      _drawPlayingContent(ctx);
      return;
    }
    if (_state === 'DEAD') {
      _drawDeadContent(ctx);
      return;
    }
  }

  // Dark steel background with subtle horizontal lines
  function _drawBackground(ctx) {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, VW, VH);

    // Subtle scanlines in play area
    ctx.fillStyle = COL_STRIPE;
    var y;
    for (y = CEILING_Y; y < GROUND_Y; y += 10) {
      ctx.fillRect(0, y, VW, 1);
    }

    // Vertical metal seam lines
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth   = 1;
    var x;
    for (x = 0; x < VW; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, CEILING_Y);
      ctx.lineTo(x, GROUND_Y);
      ctx.stroke();
    }
  }

  // Ground and ceiling panels with rivets
  function _drawPanels(ctx) {
    var i, rx, ry;

    // Ceiling panel
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(0, 0, VW, CEILING_Y);

    // Ceiling edge strip
    ctx.fillStyle = COL_PANEL2;
    ctx.fillRect(0, CEILING_Y - 6, VW, 6);

    // Rivets on ceiling
    ctx.fillStyle = COL_RIVET;
    for (i = 0; i < 8; i++) {
      rx = 24 + i * 50;
      ry = CEILING_Y - 14;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
      // Rivet highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(rx - 1, ry - 1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COL_RIVET;
    }

    // Ground panel
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);

    // Ground edge strip
    ctx.fillStyle = COL_PANEL2;
    ctx.fillRect(0, GROUND_Y, VW, 6);

    // Rivets on ground
    ctx.fillStyle = COL_RIVET;
    for (i = 0; i < 8; i++) {
      rx = 24 + i * 50;
      ry = GROUND_Y + 16;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(rx - 1, ry - 1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COL_RIVET;
    }
  }

  function _drawClusters(ctx) {
    var i, j, cl, sp, sx;
    for (i = 0; i < _clusters.length; i++) {
      cl = _clusters[i];
      // Ground spikes
      for (j = 0; j < cl.spikesGround.length; j++) {
        sp = cl.spikesGround[j];
        sx = cl.x + sp.bx;
        _drawSpike(ctx, sx, GROUND_Y, SPIKE_H_GROUND, false);
      }
      // Ceiling spikes
      for (j = 0; j < cl.spikesCeil.length; j++) {
        sp = cl.spikesCeil[j];
        sx = cl.x + cl.ceilOffset + sp.bx;
        _drawSpike(ctx, sx, CEILING_Y, SPIKE_H_CEIL, true);
      }
    }
  }

  // Draw a single metallic spike triangle
  // baseX = left edge of spike base, baseY = ground/ceiling surface y
  // h = spike height, fromCeiling = true if pointing down
  function _drawSpike(ctx, baseX, baseY, h, fromCeiling) {
    var tipX = baseX + SPIKE_W / 2;
    var tipY, lbX, rbX, lbY, rbY;

    ctx.save();
    if (fromCeiling) {
      tipY = baseY + h;
      lbX  = baseX;
      rbX  = baseX + SPIKE_W;
      lbY  = baseY;
      rbY  = baseY;
    } else {
      tipY = baseY - h;
      lbX  = baseX;
      rbX  = baseX + SPIKE_W;
      lbY  = baseY;
      rbY  = baseY;
    }

    // Shadow glow
    ctx.shadowColor = 'rgba(180,200,230,0.3)';
    ctx.shadowBlur  = 6;

    // Fill
    var grad;
    if (fromCeiling) {
      grad = ctx.createLinearGradient(tipX, baseY, tipX, tipY);
    } else {
      grad = ctx.createLinearGradient(tipX, baseY, tipX, tipY);
    }
    grad.addColorStop(0, COL_SPIKE);
    grad.addColorStop(1, COL_SPIKE_HI);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(lbX,  lbY);
    ctx.lineTo(rbX,  rbY);
    ctx.closePath();
    ctx.fill();

    // Highlight edge (left face brighter)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COL_SPIKE_HI;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(lbX, lbY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function _drawCharacter(ctx, cy, springComp) {
    var cx      = CHAR_X;
    var centerX = cx + CHAR_W / 2;

    // Spring compression: pogo stick gets shorter when compressed
    var pogoActual  = POGO_H * (1 - springComp * 0.4);
    var bodyY       = cy;
    var pogoTopY    = bodyY + CHAR_H;
    var pogoBotY    = pogoTopY + pogoActual;

    ctx.save();

    // ── Pogo stick ──
    // Spring coils
    var coilCount   = 5;
    var coilH       = pogoActual / coilCount;
    var coilW       = 10;
    ctx.strokeStyle = COL_SPRING;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = COL_SPRING;
    ctx.shadowBlur  = 4;
    var ci;
    for (ci = 0; ci < coilCount; ci++) {
      var y0 = pogoTopY + ci * coilH;
      var y1 = y0 + coilH;
      var offX = (ci % 2 === 0 ? coilW : -coilW) * 0.4 * (1 - springComp * 0.5);
      ctx.beginPath();
      ctx.moveTo(centerX - offX, y0);
      ctx.lineTo(centerX + offX, y1);
      ctx.stroke();
    }

    // Pogo rod
    ctx.strokeStyle = COL_POGO;
    ctx.lineWidth   = POGO_W;
    ctx.shadowColor = 'rgba(200,200,200,0.3)';
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, pogoTopY);
    ctx.lineTo(centerX, pogoBotY);
    ctx.stroke();

    // Pogo foot (horizontal bar)
    ctx.strokeStyle = COL_POGO_DARK;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 8, pogoBotY);
    ctx.lineTo(centerX + 8, pogoBotY);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // ── Body (rounded square) ──
    var bx = cx;
    var bw = CHAR_W;
    var bh = CHAR_H;
    var br = 6;

    // Outer glow
    ctx.shadowColor = COL_CHAR_BODY;
    ctx.shadowBlur  = 14;

    // Body fill
    var bgrad = ctx.createLinearGradient(bx, bodyY, bx + bw, bodyY + bh);
    bgrad.addColorStop(0, COL_CHAR_HI);
    bgrad.addColorStop(1, COL_CHAR_DARK);
    ctx.fillStyle = bgrad;
    _roundRect(ctx, bx, bodyY, bw, bh, br);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Body highlight (top-left shine)
    ctx.fillStyle = 'rgba(255,255,220,0.38)';
    ctx.beginPath();
    ctx.ellipse(bx + bw * 0.32, bodyY + bh * 0.28, bw * 0.22, bh * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (two small white dots)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx + bw * 0.32, bodyY + bh * 0.38, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw * 0.68, bodyY + bh * 0.38, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(bx + bw * 0.32 + 0.5, bodyY + bh * 0.38 + 0.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw * 0.68 + 0.5, bodyY + bh * 0.38 + 0.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(bx + bw * 0.5, bodyY + bh * 0.55, bw * 0.22, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.restore();
  }

  function _drawSparks(ctx) {
    var i, sp, alpha;
    for (i = 0; i < _sparks.length; i++) {
      sp    = _sparks[i];
      alpha = Math.max(0, sp.life / 0.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = sp.color;
      ctx.shadowColor = sp.color;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function _drawScore(ctx) {
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = 'bold 36px monospace';
    ctx.shadowColor  = COL_TITLE;
    ctx.shadowBlur   = 10;
    ctx.fillStyle    = COL_SCORE;
    ctx.fillText(_score, VW / 2, CEILING_Y + 8);
    ctx.shadowBlur   = 0;
    ctx.restore();
  }

  function _drawMenuContent(ctx) {
    // Demo pogo character bouncing
    _drawCharacter(ctx, _demoY, 0);

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Title — SPIKE
    ctx.font        = 'bold 62px monospace';
    ctx.shadowColor = COL_TITLE;
    ctx.shadowBlur  = 28;
    ctx.fillStyle   = COL_TITLE;
    ctx.fillText('SPIKE', VW / 2, VH / 2 - 68);

    // Title — FIELD
    ctx.font        = 'bold 62px monospace';
    ctx.fillText('FIELD', VW / 2, VH / 2 - 0);

    ctx.shadowBlur  = 0;

    // TAP TO PLAY pulsing
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 520));
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 22px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 72);
    ctx.globalAlpha = 1;

    // Best score
    if (_best > 0) {
      ctx.fillStyle = COL_GREY;
      ctx.font      = '18px monospace';
      ctx.fillText('BEST: ' + _best, VW / 2, VH / 2 + 114);
    }

    ctx.restore();
  }

  function _drawPlayingContent(ctx) {
    var i;
    // Motion trail
    for (i = _trail.length - 1; i >= 1; i--) {
      var t     = _trail[i];
      var alpha = (1 - i / TRAIL_LEN) * 0.22;
      ctx.save();
      ctx.globalAlpha = alpha;
      _drawCharacter(ctx, t.y, 0);
      ctx.restore();
    }

    _drawSparks(ctx);
    _drawCharacter(ctx, _charY, _springComp);
    _drawScore(ctx);
  }

  function _drawDeadContent(ctx) {
    // Frozen character
    ctx.save();
    ctx.globalAlpha = 0.45;
    _drawCharacter(ctx, _charY, _springComp);
    ctx.restore();

    // Dark overlay
    ctx.fillStyle = COL_DEAD_OVL;
    ctx.fillRect(0, CEILING_Y, VW, GROUND_Y - CEILING_Y);

    // Panel
    var pw = 300, ph = 230;
    var px = (VW - pw) / 2;
    var py = (VH - ph) / 2;

    ctx.fillStyle   = COL_PANEL_BG;
    ctx.strokeStyle = COL_TITLE;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = COL_TITLE;
    ctx.shadowBlur  = 18;
    _roundRect(ctx, px, py, pw, ph, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER
    ctx.font        = 'bold 38px monospace';
    ctx.shadowColor = COL_TITLE;
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = COL_TITLE;
    ctx.fillText('GAME OVER', VW / 2, py + 52);
    ctx.shadowBlur  = 0;

    // Score
    ctx.fillStyle = COL_SCORE;
    ctx.font      = 'bold 30px monospace';
    ctx.fillText('SCORE: ' + _score, VW / 2, py + 108);

    // Best
    ctx.fillStyle = COL_GREY;
    ctx.font      = '20px monospace';
    ctx.fillText('BEST: ' + _best, VW / 2, py + 152);

    // TAP TO RETRY pulsing after brief delay
    var showRetry = _deadTimer > 0.35;
    var pulse2    = showRetry ? (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 520))) : 0;
    ctx.globalAlpha = pulse2;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 20px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, py + 198);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x,    y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  // ── Public ────────────────────────────────────────────────────────────────
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
