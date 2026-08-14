'use strict';

var NeonPath = (function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // Rail Y positions (virtual space)
  var RAIL_TOP    = 300;
  var RAIL_BOTTOM = 500;

  // Ball visual x (fixed on screen)
  var BALL_X = 120;
  var BALL_R = 12;

  // Rail thickness
  var RAIL_H = 8;

  // Gap size range (world units)
  var GAP_MIN = 45;
  var GAP_MAX = 85;

  // Segment length range between gaps
  var SEG_MIN = 120;
  var SEG_MAX = 260;

  // Scroll speed
  var BASE_SPEED  = 150;  // px/s
  var SPEED_INC   = 10;   // added every 5 seconds
  var SPEED_TIMER = 5;    // seconds between speed bumps

  // Jump
  var JUMP_DUR = 0.4;   // seconds

  // How far ahead to generate rail content (world units)
  var GEN_AHEAD = VW * 3;

  // Colors
  var BG_COLOR   = '#050510';
  var RAIL_TOP_COLOR = '#00FFFF';
  var RAIL_BOT_COLOR = '#FF00FF';
  var BALL_COLOR = '#FFFFFF';
  var SCORE_COLOR = '#FFFFFF';

  // ── State ──────────────────────────────────────────────────────────────────
  var _canvas  = null;
  var _ctx     = null;
  var _best    = 0;
  var _state   = 'MENU';  // 'MENU' | 'PLAYING' | 'DEAD'

  // World / game vars
  var _worldX   = 0;   // how far camera has scrolled (world units)
  var _speed    = BASE_SPEED;
  var _speedTimer = 0;

  // Ball
  var _ballRail  = 0;  // 0 = top rail, 1 = bottom rail
  var _ballY     = RAIL_TOP;

  // Jump state
  var _jumping   = false;
  var _jumpT     = 0;     // elapsed time of current jump
  var _jumpFrom  = 0;     // starting Y
  var _jumpTo    = 0;     // target Y

  // Rail segments: array of {start, end} in world coords
  // Each gap means there's NO segment covering that range
  // We model it as an array of solid segment spans.
  var _topSegs = [];
  var _botSegs = [];

  // Score (distance in world units, displayed as integer)
  var _score    = 0;

  // Menu animation
  var _menuTime = 0;

  // Dead overlay fade
  var _deadTime = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function _randInt(min, max) {
    return Math.floor(_rand(min, max + 1));
  }

  // Return the far end of the last segment in an array (-Infinity if empty)
  function _farEnd(segs) {
    if (segs.length === 0) { return -Infinity; }
    return segs[segs.length - 1].end;
  }

  // Generate new segments up to worldX + GEN_AHEAD
  function _generate() {
    var targetEnd = _worldX + GEN_AHEAD;

    // Top rail
    while (_farEnd(_topSegs) < targetEnd) {
      var lastEnd = (_topSegs.length === 0) ? (_worldX - VW) : _topSegs[_topSegs.length - 1].end;
      // gap after last segment
      var gapLen = _rand(GAP_MIN, GAP_MAX);
      var segStart = lastEnd + gapLen;
      var segLen   = _rand(SEG_MIN, SEG_MAX);
      _topSegs.push({ start: segStart, end: segStart + segLen });
    }

    // Bottom rail
    while (_farEnd(_botSegs) < targetEnd) {
      var lastEndB = (_botSegs.length === 0) ? (_worldX - VW) : _botSegs[_botSegs.length - 1].end;
      var gapLenB  = _rand(GAP_MIN, GAP_MAX);
      var segStartB = lastEndB + gapLenB;
      var segLenB   = _rand(SEG_MIN, SEG_MAX);
      _botSegs.push({ start: segStartB, end: segStartB + segLenB });
    }
  }

  // Remove segments that have fully scrolled off the left
  function _prune() {
    var leftEdge = _worldX - VW;

    while (_topSegs.length > 0 && _topSegs[0].end < leftEdge) {
      _topSegs.shift();
    }
    while (_botSegs.length > 0 && _botSegs[0].end < leftEdge) {
      _botSegs.shift();
    }
  }

  // Check if world position wx is covered by a solid segment in segs
  function _isOnSolid(segs, wx) {
    for (var i = 0; i < segs.length; i++) {
      if (wx >= segs[i].start && wx <= segs[i].end) {
        return true;
      }
    }
    return false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = bestScore || 0;
    _state  = 'MENU';
    _menuTime = 0;
  }

  // ── Reset game ─────────────────────────────────────────────────────────────

  function _resetGame() {
    _worldX      = 0;
    _speed       = BASE_SPEED;
    _speedTimer  = 0;
    _score       = 0;
    _ballRail    = 0;
    _ballY       = RAIL_TOP;
    _jumping     = false;
    _jumpT       = 0;
    _topSegs     = [];
    _botSegs     = [];
    _deadTime    = 0;

    // Seed the first solid platform that starts before the ball
    // so the player always starts on solid ground.
    var startSeg = { start: _worldX - VW, end: _worldX + SEG_MAX };
    _topSegs.push(startSeg);
    var startSegB = { start: _worldX - VW, end: _worldX + SEG_MAX };
    _botSegs.push(startSegB);

    _generate();
  }

  // ── Die ────────────────────────────────────────────────────────────────────

  function _die() {
    _state    = 'DEAD';
    _deadTime = 0;
    if (_score > _best) { _best = _score; AdManager.happyTime(1.0); }
    try { Audio.play('crash'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score, 'neonpath_best'); } catch(e) {}
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (_state === 'MENU') {
      _menuTime += dt;
      return;
    }

    if (_state === 'DEAD') {
      _deadTime += dt;
      return;
    }

    // PLAYING
    _worldX     += _speed * dt;
    _score       = Math.floor(_worldX / 10);

    // Speed ramp
    _speedTimer += dt;
    if (_speedTimer >= SPEED_TIMER) {
      _speedTimer -= SPEED_TIMER;
      _speed += SPEED_INC;
    }

    // Jump animation
    if (_jumping) {
      _jumpT += dt;
      var t = _jumpT / JUMP_DUR;
      if (t >= 1) {
        t = 1;
        _jumping  = false;
        _ballRail = (_ballRail === 0) ? 1 : 0;
        _ballY    = _jumpTo;

        // Check landing
        var landSegs = (_ballRail === 0) ? _topSegs : _botSegs;
        if (!_isOnSolid(landSegs, _worldX)) {
          _die();
          return;
        }
        try { Audio.play('gem'); } catch(e) {}
      } else {
        // Sine arc: both rails are horizontal, arc outward
        var sinT    = Math.sin(t * Math.PI);
        var linearY = _jumpFrom + (_jumpTo - _jumpFrom) * t;
        // bulge outward (towards opposite side from center between rails)
        var midY    = (RAIL_TOP + RAIL_BOTTOM) / 2;
        var bulgeDir = (_jumpFrom < midY) ? -1 : 1;  // top rail bulges up, bottom bulges down
        _ballY = linearY + bulgeDir * sinT * 40;
      }
    } else {
      // Not jumping: check the current rail for a gap
      var curSegs = (_ballRail === 0) ? _topSegs : _botSegs;
      if (!_isOnSolid(curSegs, _worldX)) {
        _die();
        return;
      }
    }

    _generate();
    _prune();
  }

  // ── Tap ────────────────────────────────────────────────────────────────────

  function tap(x, y) {
    if (_state === 'MENU') {
      _resetGame();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    if (_state === 'DEAD') {
      _resetGame();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    // PLAYING: initiate jump if not already jumping
    if (!_jumping) {
      _jumping  = true;
      _jumpT    = 0;
      _jumpFrom = _ballY;
      _jumpTo   = (_ballRail === 0) ? RAIL_BOTTOM : RAIL_TOP;
      try { Audio.play('tap'); } catch(e) {}
    }
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  // Draw glowing line (neon effect): thick dim pass + thin bright pass
  function _neonLine(x1, y1, x2, y2, color, glowAlpha) {
    var ctx = _ctx;

    // Glow pass
    ctx.save();
    ctx.globalAlpha = glowAlpha || 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 14;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    // Bright core pass
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = color;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // Convert world X to screen X
  function _toScreenX(wx) {
    return wx - _worldX + BALL_X;
  }

  // Draw the two neon rails with gaps
  function _drawRails() {
    var i, seg, sx, ex;
    var leftLimit  = _worldX - BALL_X - 20;
    var rightLimit = _worldX + VW - BALL_X + 20;

    // Top rail (cyan)
    for (i = 0; i < _topSegs.length; i++) {
      seg = _topSegs[i];
      if (seg.end < leftLimit || seg.start > rightLimit) { continue; }
      sx = _toScreenX(seg.start);
      ex = _toScreenX(seg.end);
      _neonLine(sx, RAIL_TOP, ex, RAIL_TOP, RAIL_TOP_COLOR, 0.2);
    }

    // Bottom rail (magenta)
    for (i = 0; i < _botSegs.length; i++) {
      seg = _botSegs[i];
      if (seg.end < leftLimit || seg.start > rightLimit) { continue; }
      sx = _toScreenX(seg.start);
      ex = _toScreenX(seg.end);
      _neonLine(sx, RAIL_BOTTOM, ex, RAIL_BOTTOM, RAIL_BOT_COLOR, 0.2);
    }
  }

  // Draw the ball with glow
  function _drawBall() {
    var ctx = _ctx;
    var bx  = BALL_X;
    var by  = _ballY;

    // Outer glow
    ctx.save();
    ctx.globalAlpha  = 0.3;
    ctx.fillStyle    = BALL_COLOR;
    ctx.shadowBlur   = 30;
    ctx.shadowColor  = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner glow
    ctx.save();
    ctx.globalAlpha  = 0.6;
    ctx.fillStyle    = BALL_COLOR;
    ctx.shadowBlur   = 15;
    ctx.shadowColor  = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Core
    ctx.save();
    ctx.fillStyle    = BALL_COLOR;
    ctx.shadowBlur   = 8;
    ctx.shadowColor  = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw score HUD
  function _drawHUD() {
    var ctx = _ctx;
    ctx.save();
    ctx.fillStyle  = SCORE_COLOR;
    ctx.font       = 'bold 32px monospace';
    ctx.textAlign  = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#AAFFFF';
    ctx.fillText(String(_score), VW / 2, 60);
    ctx.restore();
  }

  // Draw menu animated neon lines in background
  function _drawMenuBG() {
    var ctx = _ctx;
    var t   = _menuTime;
    var i, y, alpha;

    // Horizontal sweeping neon lines
    for (i = 0; i < 6; i++) {
      y     = 80 + i * 130;
      alpha = 0.12 + 0.08 * Math.sin(t * 1.2 + i * 1.0);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = (i % 2 === 0) ? RAIL_TOP_COLOR : RAIL_BOT_COLOR;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 16;
      ctx.shadowColor = (i % 2 === 0) ? RAIL_TOP_COLOR : RAIL_BOT_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
      ctx.restore();
    }

    // Vertical accents
    for (i = 0; i < 4; i++) {
      var x = 48 + i * 100;
      alpha = 0.08 + 0.06 * Math.sin(t * 0.9 + i * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = (i % 2 === 0) ? RAIL_BOT_COLOR : RAIL_TOP_COLOR;
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = (i % 2 === 0) ? RAIL_BOT_COLOR : RAIL_TOP_COLOR;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VH);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw glowing text helper
  function _glowText(text, x, y, size, color, align) {
    var ctx = _ctx;
    ctx.save();
    ctx.font        = 'bold ' + size + 'px monospace';
    ctx.textAlign   = align || 'center';
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = color;
    ctx.fillText(text, x, y);
    // Second pass for extra brightness
    ctx.shadowBlur  = 6;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function draw() {
    if (!_ctx) { return; }
    var ctx = _ctx;

    // Clear
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenuBG();

      // Title
      _glowText('NEON', VW / 2, 300, 72, RAIL_TOP_COLOR, 'center');
      _glowText('PATH', VW / 2, 380, 72, RAIL_BOT_COLOR, 'center');

      // Tap to play (blink)
      if (Math.floor(_menuTime * 2) % 2 === 0) {
        _glowText('TAP TO PLAY', VW / 2, 520, 26, '#FFFFFF', 'center');
      }

      // Best score
      if (_best > 0) {
        ctx.save();
        ctx.font      = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#AAAACC';
        ctx.fillText('BEST: ' + String(_best), VW / 2, 600);
        ctx.restore();
      }

      // Rail preview at bottom
      _neonLine(20, 700, VW - 20, 700, RAIL_TOP_COLOR, 0.15);
      _neonLine(20, 740, VW - 20, 740, RAIL_BOT_COLOR, 0.15);

      return;
    }

    if (_state === 'PLAYING') {
      _drawRails();
      _drawBall();
      _drawHUD();

      // Rail labels (faint, left side)
      ctx.save();
      ctx.font        = '14px monospace';
      ctx.textAlign   = 'left';
      ctx.globalAlpha = 0.4;
      ctx.fillStyle   = RAIL_TOP_COLOR;
      ctx.fillText('TOP', 10, RAIL_TOP - 16);
      ctx.fillStyle   = RAIL_BOT_COLOR;
      ctx.fillText('BOT', 10, RAIL_BOTTOM - 16);
      ctx.restore();

      return;
    }

    if (_state === 'DEAD') {
      // Draw final rail state (frozen)
      _drawRails();
      _drawBall();

      // Dark overlay
      ctx.save();
      var overlayAlpha = Math.min(_deadTime / 0.4, 0.75);
      ctx.fillStyle   = 'rgba(5,5,16,' + overlayAlpha + ')';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();

      if (_deadTime > 0.3) {
        _glowText('GAME OVER', VW / 2, 320, 46, '#FF4444', 'center');

        ctx.save();
        ctx.font      = '26px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#FFFFFF';
        ctx.fillText('SCORE: ' + String(_score), VW / 2, 400);
        ctx.restore();

        ctx.save();
        ctx.font      = '22px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#AAAACC';
        ctx.fillText('BEST: ' + String(_best), VW / 2, 445);
        ctx.restore();

        if (Math.floor(_deadTime * 2) % 2 === 0 || _deadTime > 1.5) {
          _glowText('TAP TO RETRY', VW / 2, 560, 24, '#FFFFFF', 'center');
        }
      }

      return;
    }
  }

  // ── getBest ────────────────────────────────────────────────────────────────

  function getBest() {
    return _best;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
