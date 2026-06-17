'use strict';

var CaveRunner = (function () {

  // ── Virtual canvas dimensions ──────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // ── Canvas / context ───────────────────────────────────────────────────────
  var _canvas = null;
  var _ctx    = null;

  // ── Persistent best ───────────────────────────────────────────────────────
  var _best = 0;

  // ── Game state ─────────────────────────────────────────────────────────────
  var _state = 'MENU';   // 'MENU' | 'PLAYING' | 'DEAD'

  // ── Player ─────────────────────────────────────────────────────────────────
  var PLAYER_X      = 90;
  var PLAYER_W      = 22;
  var PLAYER_H      = 28;
  var GRAVITY       = 1400;   // px / s^2  (virtual space)
  var JUMP_VEL      = -520;   // px / s  (upward = negative Y)
  var PLAYER_MIN_Y  = 40;     // ceiling guard (top cave wall height)

  var _playerY  = 0;
  var _playerVY = 0;

  // ── Obstacles ──────────────────────────────────────────────────────────────
  var OBS_SPACING   = 220;   // px between pairs
  var OBS_MIN_GAP   = 140;   // minimum gap that can ever be reached
  var OBS_START_GAP = 280;   // initial gap size
  var OBS_W         = 52;    // obstacle pair half-width
  var OBS_SPEED_BASE = 160;  // px / s at start
  var OBS_SPEED_MAX  = 400;

  var _obstacles = [];   // array of { x, gapTop, gapBot, scored }

  // ── Crystals (decoration) ──────────────────────────────────────────────────
  var _crystals = [];   // { x, y, r, alpha, wall }  wall = 't'|'b'

  // ── Score / distance ───────────────────────────────────────────────────────
  var _score    = 0;   // integer metres
  var _distAcc  = 0;   // accumulated sub-metre distance
  var _speed    = OBS_SPEED_BASE;

  // ── Cave wall thickness ────────────────────────────────────────────────────
  var WALL_TOP = 60;
  var WALL_BOT = 60;

  // ── Parallax background rock layers ───────────────────────────────────────
  var _bgRocks = [];   // { x, y, w, h, shade }

  // ── Tap flash ─────────────────────────────────────────────────────────────
  var _tapFlash = 0;   // countdown timer for jump flash

  // ── Death shake ───────────────────────────────────────────────────────────
  var _shake    = 0;
  var _shakeAmt = 0;

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function _clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function _rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function _randInt(lo, hi) {
    return Math.floor(_rand(lo, hi + 1));
  }

  // current gap size based on score
  function _gapSize() {
    var g = OBS_START_GAP - _score * 1.4;
    return g < OBS_MIN_GAP ? OBS_MIN_GAP : g;
  }

  // current scroll speed based on score
  function _calcSpeed() {
    var s = OBS_SPEED_BASE + _score * 2.2;
    return s > OBS_SPEED_MAX ? OBS_SPEED_MAX : s;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  INIT HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function _initBgRocks() {
    _bgRocks = [];
    var i;
    for (i = 0; i < 18; i++) {
      _bgRocks.push({
        x     : _rand(0, VW),
        y     : _rand(0, VH),
        w     : _rand(30, 90),
        h     : _rand(14, 40),
        shade : _randInt(18, 38)
      });
    }
  }

  function _initCrystals() {
    _crystals = [];
    var i;
    for (i = 0; i < 22; i++) {
      _crystals.push({
        x     : _rand(0, VW * 2),
        y     : _rand(0, VH),
        r     : _rand(3, 9),
        alpha : _rand(0.35, 0.95),
        wall  : Math.random() < 0.5 ? 't' : 'b'
      });
    }
  }

  function _spawnObstacle(x) {
    var gap    = _gapSize();
    var usable = VH - WALL_TOP - WALL_BOT;       // playable height
    var center = WALL_TOP + _rand(gap * 0.5 + 10, usable - gap * 0.5 - 10);
    _obstacles.push({
      x      : x,
      gapTop : center - gap / 2,
      gapBot : center + gap / 2,
      scored : false
    });
  }

  function _initObstacles() {
    _obstacles = [];
    var i;
    var startX = VW + OBS_SPACING;
    for (i = 0; i < 5; i++) {
      _spawnObstacle(startX + i * OBS_SPACING);
    }
  }

  function _resetGame() {
    _playerY  = VH / 2 - PLAYER_H / 2;
    _playerVY = 0;
    _score    = 0;
    _distAcc  = 0;
    _speed    = OBS_SPEED_BASE;
    _tapFlash = 0;
    _shake    = 0;
    _shakeAmt = 0;

    _initObstacles();
    _initCrystals();
    _initBgRocks();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = bestScore || 0;

    _state  = 'MENU';
    _initBgRocks();
    _initCrystals();
    _initObstacles();

    _playerY  = VH / 2 - PLAYER_H / 2;
    _playerVY = 0;
    _score    = 0;
    _distAcc  = 0;
  }

  function getBest() {
    return _best;
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _resetGame();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }

    if (_state === 'DEAD') {
      _resetGame();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }

    if (_state === 'PLAYING') {
      _playerVY = JUMP_VEL;
      _tapFlash = 0.12;
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  function update(dt) {
    if (_state !== 'PLAYING') {
      // idle crystal twinkle
      _updateCrystals(dt, 40);
      return;
    }

    _speed   = _calcSpeed();
    _tapFlash = _tapFlash > 0 ? _tapFlash - dt : 0;

    // ── player physics ──────────────────────────────────────────────────────
    _playerVY += GRAVITY * dt;
    _playerY  += _playerVY * dt;

    // ceiling clamp
    var ceilY = WALL_TOP;
    if (_playerY < ceilY) {
      _playerY  = ceilY;
      _playerVY = 0;
    }

    // floor clamp
    var floorY = VH - WALL_BOT - PLAYER_H;
    if (_playerY > floorY) {
      _playerY  = floorY;
      _playerVY = 0;
      // hitting floor = death
      _die();
      return;
    }

    // ── scroll distance / score ─────────────────────────────────────────────
    _distAcc += _speed * dt;
    _score    = Math.floor(_distAcc / 60);   // ~60px per metre feel

    // ── obstacles ───────────────────────────────────────────────────────────
    var i;
    var obs;
    for (i = 0; i < _obstacles.length; i++) {
      _obstacles[i].x -= _speed * dt;
    }

    // recycle off-screen obstacles
    while (_obstacles.length > 0 && _obstacles[0].x < -OBS_W - 20) {
      _obstacles.shift();
      _spawnObstacle(_obstacles[_obstacles.length - 1].x + OBS_SPACING);
    }

    // ── collision & scoring ─────────────────────────────────────────────────
    var px1 = PLAYER_X - PLAYER_W / 2 + 3;
    var px2 = PLAYER_X + PLAYER_W / 2 - 3;
    var py1 = _playerY + 2;
    var py2 = _playerY + PLAYER_H - 2;

    for (i = 0; i < _obstacles.length; i++) {
      obs = _obstacles[i];
      var ox1 = obs.x - OBS_W / 2;
      var ox2 = obs.x + OBS_W / 2;

      // horizontal overlap?
      if (px2 < ox1 || px1 > ox2) {
        // no overlap; check scoring
        if (!obs.scored && obs.x < PLAYER_X) {
          obs.scored = true;
          try { Audio.play('gem'); } catch (e) {}
        }
        continue;
      }

      // vertical collision: player hits stalactite (top) or stalagmite (bottom)
      if (py1 < obs.gapTop || py2 > obs.gapBot) {
        _die();
        return;
      }
    }

    // ── crystals parallax ───────────────────────────────────────────────────
    _updateCrystals(dt, _speed * 0.35);

    // ── shake decay ─────────────────────────────────────────────────────────
    if (_shake > 0) {
      _shake -= dt;
      if (_shake < 0) { _shake = 0; }
    }
  }

  function _updateCrystals(dt, scrollSpd) {
    var i;
    var c;
    for (i = 0; i < _crystals.length; i++) {
      c = _crystals[i];
      c.x -= scrollSpd * dt;
      if (c.x < -20) {
        c.x     = VW + _rand(10, 80);
        c.y     = _rand(0, VH);
        c.r     = _rand(3, 9);
        c.alpha = _rand(0.35, 0.95);
        c.wall  = Math.random() < 0.5 ? 't' : 'b';
      }
    }
  }

  function _die() {
    _state = 'DEAD';
    _shake    = 0.45;
    _shakeAmt = 14;
    if (_score > _best) { _best = _score; }
    try { Audio.play('crash'); } catch (e) {}
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DRAW
  // ══════════════════════════════════════════════════════════════════════════

  function draw() {
    var ctx = _ctx;
    if (!ctx) { return; }

    ctx.save();

    // screen shake
    if (_shake > 0) {
      var sx = (_rand(-1, 1)) * _shakeAmt * (_shake / 0.45);
      var sy = (_rand(-1, 1)) * _shakeAmt * (_shake / 0.45);
      ctx.translate(sx, sy);
    }

    // clear
    ctx.fillStyle = '#0a0508';
    ctx.fillRect(0, 0, VW, VH);

    _drawBgRocks(ctx);
    _drawCrystals(ctx);
    _drawCaveWalls(ctx);
    _drawObstacles(ctx);
    _drawPlayer(ctx);
    _drawHUD(ctx);

    if (_state === 'MENU') { _drawMenu(ctx); }
    if (_state === 'DEAD') { _drawDead(ctx); }

    ctx.restore();
  }

  // ── background rock texture ────────────────────────────────────────────────
  function _drawBgRocks(ctx) {
    var i;
    var r;
    for (i = 0; i < _bgRocks.length; i++) {
      r = _bgRocks[i];
      ctx.fillStyle = 'rgb(' + r.shade + ',' + r.shade + ',' + (r.shade + 4) + ')';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── glowing crystals ───────────────────────────────────────────────────────
  function _drawCrystals(ctx) {
    var i;
    var c;
    for (i = 0; i < _crystals.length; i++) {
      c = _crystals[i];

      // only draw crystals near the walls
      var drawY;
      if (c.wall === 't') {
        drawY = WALL_TOP * 0.6 + c.r;
      } else {
        drawY = VH - WALL_BOT * 0.6 - c.r;
      }

      // outer glow
      var grd = ctx.createRadialGradient(c.x, drawY, 0, c.x, drawY, c.r * 3.5);
      grd.addColorStop(0, 'rgba(0,220,200,' + c.alpha + ')');
      grd.addColorStop(1, 'rgba(0,100,120,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(c.x, drawY, c.r * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // core dot
      ctx.fillStyle = 'rgba(180,255,245,' + c.alpha + ')';
      ctx.beginPath();
      ctx.arc(c.x, drawY, c.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── cave walls (top + bottom bands) ───────────────────────────────────────
  function _drawCaveWalls(ctx) {
    // top wall
    var topGrd = ctx.createLinearGradient(0, 0, 0, WALL_TOP);
    topGrd.addColorStop(0, '#1a1218');
    topGrd.addColorStop(1, '#2e2430');
    ctx.fillStyle = topGrd;
    ctx.fillRect(0, 0, VW, WALL_TOP);

    // ragged lower edge of top wall
    ctx.fillStyle = '#2e2430';
    _drawRaggedEdge(ctx, true, WALL_TOP);

    // bottom wall
    var botGrd = ctx.createLinearGradient(0, VH - WALL_BOT, 0, VH);
    botGrd.addColorStop(0, '#2e2430');
    botGrd.addColorStop(1, '#1a1218');
    ctx.fillStyle = botGrd;
    ctx.fillRect(0, VH - WALL_BOT, VW, WALL_BOT);

    // ragged upper edge of bottom wall
    ctx.fillStyle = '#2e2430';
    _drawRaggedEdge(ctx, false, VH - WALL_BOT);
  }

  function _drawRaggedEdge(ctx, isTop, baseY) {
    // small static bumps to give rocky look
    var step = 24;
    var i;
    ctx.beginPath();
    if (isTop) {
      ctx.moveTo(0, baseY);
      for (i = 0; i <= VW; i += step) {
        var bumpH = (Math.sin(i * 0.07) * 0.5 + 0.5) * 12 + 4;
        ctx.lineTo(i, baseY - bumpH);
        ctx.lineTo(i + step / 2, baseY);
      }
      ctx.lineTo(VW, 0);
      ctx.lineTo(0, 0);
    } else {
      ctx.moveTo(0, baseY);
      for (i = 0; i <= VW; i += step) {
        var bumpH2 = (Math.sin(i * 0.07 + 1) * 0.5 + 0.5) * 12 + 4;
        ctx.lineTo(i, baseY + bumpH2);
        ctx.lineTo(i + step / 2, baseY);
      }
      ctx.lineTo(VW, VH);
      ctx.lineTo(0, VH);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── obstacle stalactites / stalagmites ─────────────────────────────────────
  function _drawObstacles(ctx) {
    var i;
    var obs;
    for (i = 0; i < _obstacles.length; i++) {
      obs = _obstacles[i];
      _drawStalactite(ctx, obs.x, obs.gapTop);
      _drawStalagmite(ctx, obs.x, obs.gapBot);
    }
  }

  // stalactite: hangs from top wall down to gapTop
  function _drawStalactite(ctx, cx, tipY) {
    var baseY = WALL_TOP;
    var hw    = OBS_W / 2;  // half width at base

    var grd = ctx.createLinearGradient(cx, baseY, cx, tipY);
    grd.addColorStop(0, '#4a3f52');
    grd.addColorStop(1, '#6a5872');
    ctx.fillStyle = grd;

    ctx.beginPath();
    ctx.moveTo(cx - hw, baseY);
    ctx.lineTo(cx + hw, baseY);
    ctx.lineTo(cx + 4, tipY);
    ctx.lineTo(cx,     tipY + 12);
    ctx.lineTo(cx - 4, tipY);
    ctx.closePath();
    ctx.fill();

    // edge highlight
    ctx.strokeStyle = 'rgba(120,100,130,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // crystal tip glow
    _drawObsGlow(ctx, cx, tipY, true);
  }

  // stalagmite: rises from bottom wall up to gapBot
  function _drawStalagmite(ctx, cx, tipY) {
    var baseY = VH - WALL_BOT;
    var hw    = OBS_W / 2;

    var grd = ctx.createLinearGradient(cx, tipY, cx, baseY);
    grd.addColorStop(0, '#6a5872');
    grd.addColorStop(1, '#4a3f52');
    ctx.fillStyle = grd;

    ctx.beginPath();
    ctx.moveTo(cx - hw, baseY);
    ctx.lineTo(cx + hw, baseY);
    ctx.lineTo(cx + 4, tipY);
    ctx.lineTo(cx,     tipY - 12);
    ctx.lineTo(cx - 4, tipY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,100,130,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    _drawObsGlow(ctx, cx, tipY, false);
  }

  function _drawObsGlow(ctx, cx, ty, isTop) {
    var gy = isTop ? ty + 6 : ty - 6;
    var grd = ctx.createRadialGradient(cx, gy, 0, cx, gy, 18);
    grd.addColorStop(0, 'rgba(0,180,160,0.45)');
    grd.addColorStop(1, 'rgba(0,80,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, gy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── player spelunker ───────────────────────────────────────────────────────
  function _drawPlayer(ctx) {
    var px = PLAYER_X;
    var py = _playerY;
    var pw = PLAYER_W;
    var ph = PLAYER_H;
    var cx = px;
    var cy = py + ph / 2;

    // headlamp cone glow
    var lampGrd = ctx.createRadialGradient(cx + pw * 0.6, cy - ph * 0.25, 2, cx + pw * 0.6, cy - ph * 0.25, 70);
    lampGrd.addColorStop(0, 'rgba(255,240,160,0.38)');
    lampGrd.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = lampGrd;
    ctx.beginPath();
    ctx.arc(cx + pw * 0.6, cy - ph * 0.25, 70, 0, Math.PI * 2);
    ctx.fill();

    // jump flash ring
    if (_tapFlash > 0) {
      var alpha = _tapFlash / 0.12;
      ctx.strokeStyle = 'rgba(100,220,255,' + (alpha * 0.6) + ')';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, pw * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // body
    var bodyGrd = ctx.createLinearGradient(cx - pw / 2, py, cx + pw / 2, py + ph);
    bodyGrd.addColorStop(0, '#e8d4b0');
    bodyGrd.addColorStop(1, '#c4a070');
    ctx.fillStyle = bodyGrd;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, py + ph * 0.3, pw, ph * 0.65, 4);
    ctx.fill();

    // head
    ctx.fillStyle = '#f0ddb8';
    ctx.beginPath();
    ctx.arc(cx, py + ph * 0.22, pw * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // helmet
    ctx.fillStyle = '#d44020';
    ctx.beginPath();
    ctx.arc(cx, py + ph * 0.18, pw * 0.42, Math.PI, Math.PI * 2);
    ctx.fill();

    // headlamp dot
    ctx.fillStyle = '#ffee88';
    ctx.beginPath();
    ctx.arc(cx + pw * 0.3, py + ph * 0.13, 4, 0, Math.PI * 2);
    ctx.fill();

    // legs running anim (simple bob)
    var legPhase = _distAcc * 0.04;
    var legL = Math.sin(legPhase) * 5;
    var legR = -legL;

    ctx.strokeStyle = '#c4a070';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';

    // left leg
    ctx.beginPath();
    ctx.moveTo(cx - pw * 0.15, py + ph * 0.92);
    ctx.lineTo(cx - pw * 0.22, py + ph + legL);
    ctx.stroke();

    // right leg
    ctx.beginPath();
    ctx.moveTo(cx + pw * 0.15, py + ph * 0.92);
    ctx.lineTo(cx + pw * 0.22, py + ph + legR);
    ctx.stroke();

    ctx.lineCap = 'butt';
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function _drawHUD(ctx) {
    if (_state !== 'PLAYING') { return; }

    ctx.fillStyle    = 'rgba(0,220,180,0.9)';
    ctx.font         = 'bold 28px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(_score + 'm', VW / 2, 14);

    ctx.fillStyle    = 'rgba(160,200,190,0.6)';
    ctx.font         = '16px monospace';
    ctx.fillText('best ' + _best + 'm', VW / 2, 46);
  }

  // ── MENU screen ────────────────────────────────────────────────────────────
  function _drawMenu(ctx) {
    // dark vignette
    var vgd = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.18, VW / 2, VH / 2, VH * 0.75);
    vgd.addColorStop(0, 'rgba(0,0,0,0)');
    vgd.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vgd;
    ctx.fillRect(0, 0, VW, VH);

    // title glow
    ctx.shadowColor   = 'rgba(0,220,180,0.9)';
    ctx.shadowBlur    = 28;
    ctx.fillStyle     = '#00ddb4';
    ctx.font          = 'bold 52px monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('CAVE', VW / 2, VH / 2 - 80);
    ctx.fillText('RUNNER', VW / 2, VH / 2 - 18);
    ctx.shadowBlur    = 0;

    // subtitle
    ctx.fillStyle    = 'rgba(200,220,215,0.75)';
    ctx.font         = '18px monospace';
    ctx.fillText('Survive the depths', VW / 2, VH / 2 + 34);

    // tap to play pulse
    var pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(255,240,160,' + pulse + ')';
    ctx.font      = 'bold 24px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 110);

    // best score
    if (_best > 0) {
      ctx.fillStyle = 'rgba(0,200,160,0.7)';
      ctx.font      = '18px monospace';
      ctx.fillText('best  ' + _best + ' m', VW / 2, VH / 2 + 160);
    }
  }

  // ── DEAD overlay ──────────────────────────────────────────────────────────
  function _drawDead(ctx) {
    // dark overlay
    ctx.fillStyle = 'rgba(10,2,8,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    // panel
    var panelW = 290;
    var panelH = 220;
    var panelX = (VW - panelW) / 2;
    var panelY = (VH - panelH) / 2 - 20;

    ctx.fillStyle   = 'rgba(30,18,34,0.92)';
    ctx.strokeStyle = 'rgba(0,200,160,0.55)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // "DEAD" header
    ctx.shadowColor  = 'rgba(255,60,60,0.85)';
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = '#ff6060';
    ctx.font         = 'bold 38px monospace';
    ctx.fillText('DEAD', VW / 2, panelY + 46);
    ctx.shadowBlur   = 0;

    // score
    ctx.fillStyle = '#e8e0d8';
    ctx.font      = '22px monospace';
    ctx.fillText('distance  ' + _score + ' m', VW / 2, panelY + 96);

    // best
    var bestLabel = _score >= _best ? 'NEW BEST!' : 'best  ' + _best + ' m';
    ctx.fillStyle = _score >= _best ? '#ffdd44' : 'rgba(0,200,160,0.8)';
    ctx.font      = _score >= _best ? 'bold 20px monospace' : '18px monospace';
    ctx.fillText(bestLabel, VW / 2, panelY + 134);

    // tap to retry pulse
    var pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.005);
    ctx.fillStyle = 'rgba(255,240,160,' + pulse + ')';
    ctx.font      = 'bold 22px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, panelY + 185);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC EXPORT
  // ══════════════════════════════════════════════════════════════════════════

  return {
    init    : init,
    update  : update,
    draw    : draw,
    tap     : tap,
    getBest : getBest
  };

}());
