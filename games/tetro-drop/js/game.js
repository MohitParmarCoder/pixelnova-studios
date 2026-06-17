'use strict';
var TetroDrop = (function () {

  // ── Constants ────────────────────────────────────────────────────────────────
  var VW = 390, VH = 844;
  var CX = 195, CY = 422;          // board centre
  var BOARD_R = 180;               // circular board radius
  var HOLE_R  = 22;                // visual hole radius
  var BALL_R  = 14;                // ball radius

  // Hole positions: 0=top,1=right,2=bottom,3=left  (angles in radians from +x axis)
  var HOLE_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  var HOLE_GREEN  = [0, 2];        // top and bottom are green  (+10 pts)
  var HOLE_RED    = [1, 3];        // right and left are red    (-1 life)

  var ARM_SPEED_BASE = 90 * Math.PI / 180;   // rad/s
  var FREEZE_DURATION = 0.5;                 // seconds arm is frozen after tap
  var GRAVITY = 520;                         // px/s²  toward centre
  var MAX_LIVES = 3;
  var POINTS_PER_HIT = 10;

  // ── State ────────────────────────────────────────────────────────────────────
  var _canvas, _ctx;
  var _state;          // 'MENU' | 'PLAYING' | 'DEAD'
  var _score, _best, _lives;
  var _armAngle, _armSpeed, _armFrozen, _freezeTimer;
  var _ball;           // { x, y, vx, vy, phase, targetHole, travelT, travelDur }
  //   phase: 'drop' = falling toward centre, 'travel' = heading to hole, 'idle' = not active
  var _bgStars;
  var _particles;      // array of { x,y, vx,vy, life, maxLife, col, r }
  var _diffTimer;      // time accumulator to gradually increase arm speed
  var _holeFlash;      // array of { idx, timer } for hit-flash effect
  var _scoreFlash;     // { val, x, y, timer } floating score text
  var _shakeTimer;     // screen shake duration
  var _shakeMag;

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    _state = 'MENU';
    _bgStars = _buildStars(80);
    _particles = [];
    _holeFlash = [];
    _scoreFlash = null;
    _shakeTimer = 0;
    _shakeMag = 0;
    _resetGame();
  }

  function _resetGame() {
    _score = 0;
    _lives = MAX_LIVES;
    _armAngle = 0;
    _armSpeed = ARM_SPEED_BASE;
    _armFrozen = false;
    _freezeTimer = 0;
    _diffTimer = 0;
    _ball = null;
    _particles = [];
    _holeFlash = [];
    _scoreFlash = null;
    _shakeTimer = 0;
    _shakeMag = 0;
    _spawnBall();
  }

  // ── Stars ────────────────────────────────────────────────────────────────────
  function _buildStars(n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: 0.5 + Math.random() * 1.5,
        a: 0.3 + Math.random() * 0.7
      });
    }
    return arr;
  }

  // ── Ball spawning ─────────────────────────────────────────────────────────────
  function _spawnBall() {
    // Spawn from a random edge position OUTSIDE the board, near top
    var angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 0.5);
    var spawnR = BOARD_R * 0.75;
    var sx = CX + Math.cos(angle) * spawnR;
    var sy = CY + Math.sin(angle) * spawnR - BOARD_R * 0.2;
    // ensure it starts above centre
    if (sy > CY - 40) { sy = CY - BOARD_R * 0.7; }
    _ball = {
      x: sx, y: sy,
      vx: 0,  vy: 0,
      phase: 'drop',
      targetHole: -1,
      travelT: 0, travelDur: 0,
      startX: sx, startY: sy,
      endX: 0, endY: 0,
      trail: []
    };
  }

  // ── Arm freeze (tap) ──────────────────────────────────────────────────────────
  function _freezeArm() {
    _armFrozen = true;
    _freezeTimer = FREEZE_DURATION;
    try { Audio.play('tap'); } catch (e) {}
  }

  // ── Deflect ball along arm ────────────────────────────────────────────────────
  function _deflectBall() {
    if (!_ball || _ball.phase !== 'drop') { return; }

    // Compute ball direction relative to arm angle
    // The arm angle determines which quadrant the ball gets kicked to
    // We pick the nearest hole to the arm's direction
    var norm = ((_armAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var best = -1, bestDiff = 9999;
    for (var i = 0; i < 4; i++) {
      var ha = ((HOLE_ANGLES[i] % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      var diff = Math.abs(ha - norm);
      if (diff > Math.PI) { diff = Math.PI * 2 - diff; }
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    _sendBallToHole(best);
  }

  function _sendBallToHole(holeIdx) {
    var holeX = CX + Math.cos(HOLE_ANGLES[holeIdx]) * BOARD_R;
    var holeY = CY + Math.sin(HOLE_ANGLES[holeIdx]) * BOARD_R;
    _ball.phase = 'travel';
    _ball.targetHole = holeIdx;
    _ball.travelT = 0;
    _ball.startX = _ball.x;
    _ball.startY = _ball.y;
    _ball.endX = holeX;
    _ball.endY = holeY;
    var dx = holeX - _ball.x, dy = holeY - _ball.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    _ball.travelDur = Math.max(0.25, dist / 420);
    _ball.trail = [];
  }

  // ── Resolve hole hit ──────────────────────────────────────────────────────────
  function _resolveHole(holeIdx) {
    var isGreen = false;
    for (var gi = 0; gi < HOLE_GREEN.length; gi++) {
      if (HOLE_GREEN[gi] === holeIdx) { isGreen = true; break; }
    }

    var holeX = CX + Math.cos(HOLE_ANGLES[holeIdx]) * BOARD_R;
    var holeY = CY + Math.sin(HOLE_ANGLES[holeIdx]) * BOARD_R;

    if (isGreen) {
      _score += POINTS_PER_HIT;
      if (_score > _best) { _best = _score; }
      try { Audio.play('gem'); } catch (e) {}
      _spawnParticles(holeX, holeY, '#00ff88', 18);
      _scoreFlash = { val: '+' + POINTS_PER_HIT, x: holeX, y: holeY - 30, timer: 0.9 };
      _holeFlash.push({ idx: holeIdx, timer: 0.5, color: '#00ff88' });
    } else {
      _lives -= 1;
      try { Audio.play('crash'); } catch (e) {}
      _spawnParticles(holeX, holeY, '#ff3333', 18);
      _holeFlash.push({ idx: holeIdx, timer: 0.5, color: '#ff4444' });
      _shakeTimer = 0.35;
      _shakeMag = 8;
      if (_lives <= 0) {
        _ball = null;
        _state = 'DEAD';
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); } catch (e) {}
        try { AdManager.onRunEnd(); } catch (e) {}
        return;
      }
    }
    // Next ball
    _diffTimer += 1;
    if (_diffTimer >= 5) {
      _diffTimer = 0;
      _armSpeed = Math.min(_armSpeed + 12 * Math.PI / 180, ARM_SPEED_BASE * 2.5);
    }
    _ball = null;
    _spawnBall();
  }

  // ── Particles ─────────────────────────────────────────────────────────────────
  function _spawnParticles(x, y, col, n) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 80 + Math.random() * 220;
      _particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.55 + Math.random() * 0.3,
        col: col,
        r: 2 + Math.random() * 4
      });
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (_state === 'MENU' || _state === 'DEAD') { return; }

    // Screen shake decay
    if (_shakeTimer > 0) {
      _shakeTimer -= dt;
      if (_shakeTimer < 0) { _shakeTimer = 0; }
    }

    // Arm rotation
    if (_armFrozen) {
      _freezeTimer -= dt;
      if (_freezeTimer <= 0) {
        _armFrozen = false;
        _freezeTimer = 0;
        // If ball is still in drop phase when freeze ends, auto-deflect
        if (_ball && _ball.phase === 'drop') {
          _deflectBall();
        }
      }
    } else {
      _armAngle += _armSpeed * dt;
    }

    // Ball physics
    if (_ball) {
      if (_ball.phase === 'drop') {
        // Gravity pull toward centre
        var dx = CX - _ball.x;
        var dy = CY - _ball.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) {
          _ball.vx += (dx / dist) * GRAVITY * dt;
          _ball.vy += (dy / dist) * GRAVITY * dt;
        }
        _ball.x += _ball.vx * dt;
        _ball.y += _ball.vy * dt;

        // Record trail
        _ball.trail.push({ x: _ball.x, y: _ball.y });
        if (_ball.trail.length > 14) { _ball.trail.shift(); }

        // If arm is frozen at moment of near-centre pass, deflect
        // Check if ball is within ~30px of centre while arm is frozen
        var dcx = _ball.x - CX, dcy = _ball.y - CY;
        var dcentre = Math.sqrt(dcx * dcx + dcy * dcy);
        if (dcentre < 30 && _armFrozen) {
          _deflectBall();
        } else if (dcentre < 10) {
          // Ball reaches centre without frozen arm — send to nearest default
          _deflectBall();
        }
      } else if (_ball.phase === 'travel') {
        _ball.travelT += dt;
        var t = Math.min(_ball.travelT / _ball.travelDur, 1);
        // Ease-in-out
        var et = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        _ball.x = _ball.startX + (_ball.endX - _ball.startX) * et;
        _ball.y = _ball.startY + (_ball.endY - _ball.startY) * et;

        _ball.trail.push({ x: _ball.x, y: _ball.y });
        if (_ball.trail.length > 10) { _ball.trail.shift(); }

        if (t >= 1) {
          _ball.x = _ball.endX;
          _ball.y = _ball.endY;
          _resolveHole(_ball.targetHole);
        }
      }
    }

    // Particles
    for (var pi = _particles.length - 1; pi >= 0; pi--) {
      var p = _particles[pi];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) { _particles.splice(pi, 1); }
    }

    // Hole flash timers
    for (var hfi = _holeFlash.length - 1; hfi >= 0; hfi--) {
      _holeFlash[hfi].timer -= dt;
      if (_holeFlash[hfi].timer <= 0) { _holeFlash.splice(hfi, 1); }
    }

    // Score flash
    if (_scoreFlash) {
      _scoreFlash.timer -= dt;
      _scoreFlash.y -= 40 * dt;
      if (_scoreFlash.timer <= 0) { _scoreFlash = null; }
    }
  }

  // ── Tap ───────────────────────────────────────────────────────────────────────
  function tap(x, y) {
    if (_state === 'MENU') {
      _state = 'PLAYING';
      _resetGame();
      try { Audio.play('tap'); } catch (e) {}
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (_state === 'DEAD') {
      _state = 'PLAYING';
      _resetGame();
      try { Audio.play('tap'); } catch (e) {}
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    // PLAYING: freeze arm
    if (!_armFrozen) {
      _freezeArm();
    }
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────────
  function _drawBackground() {
    var ctx = _ctx;
    // Deep space background gradient
    var bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, VH * 0.7);
    bg.addColorStop(0, '#0d1b2a');
    bg.addColorStop(0.5, '#0a1020');
    bg.addColorStop(1, '#050810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    // Stars
    ctx.save();
    for (var i = 0; i < _bgStars.length; i++) {
      var s = _bgStars[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function _drawBoard() {
    var ctx = _ctx;

    // Outer glow
    var outerGlow = ctx.createRadialGradient(CX, CY, BOARD_R * 0.7, CX, CY, BOARD_R * 1.25);
    outerGlow.addColorStop(0, 'rgba(80, 140, 255, 0.0)');
    outerGlow.addColorStop(0.6, 'rgba(60, 100, 220, 0.08)');
    outerGlow.addColorStop(1, 'rgba(30, 60, 180, 0.18)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(CX, CY, BOARD_R * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Board fill
    var boardFill = ctx.createRadialGradient(CX, CY - 30, 10, CX, CY, BOARD_R);
    boardFill.addColorStop(0, 'rgba(20, 35, 65, 0.92)');
    boardFill.addColorStop(1, 'rgba(8, 15, 35, 0.97)');
    ctx.fillStyle = boardFill;
    ctx.beginPath();
    ctx.arc(CX, CY, BOARD_R, 0, Math.PI * 2);
    ctx.fill();

    // Concentric rings for depth
    var ringCount = 5;
    for (var ri = 1; ri <= ringCount; ri++) {
      var rr = BOARD_R * (ri / (ringCount + 1));
      ctx.beginPath();
      ctx.arc(CX, CY, rr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(80, 120, 200, ' + (0.04 + ri * 0.02) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Board rim
    ctx.beginPath();
    ctx.arc(CX, CY, BOARD_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Board rim glow
    ctx.beginPath();
    ctx.arc(CX, CY, BOARD_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.15)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Cross-hairs subtle
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#6699ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(CX - BOARD_R, CY); ctx.lineTo(CX + BOARD_R, CY);
    ctx.moveTo(CX, CY - BOARD_R); ctx.lineTo(CX, CY + BOARD_R);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function _drawHoles() {
    var ctx = _ctx;
    for (var i = 0; i < 4; i++) {
      var hx = CX + Math.cos(HOLE_ANGLES[i]) * BOARD_R;
      var hy = CY + Math.sin(HOLE_ANGLES[i]) * BOARD_R;
      var isGreen = false;
      for (var gi = 0; gi < HOLE_GREEN.length; gi++) {
        if (HOLE_GREEN[gi] === i) { isGreen = true; break; }
      }
      var baseCol = isGreen ? '#00ff88' : '#ff3344';
      var darkCol = isGreen ? '#003322' : '#330011';
      var glowCol = isGreen ? 'rgba(0,255,136,0.35)' : 'rgba(255,51,68,0.35)';

      // Flash effect
      var flashAlpha = 0;
      for (var hfi = 0; hfi < _holeFlash.length; hfi++) {
        if (_holeFlash[hfi].idx === i) {
          flashAlpha = _holeFlash[hfi].timer / 0.5;
        }
      }

      // Glow halo
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, HOLE_R * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = glowCol;
      ctx.globalAlpha = 0.4 + flashAlpha * 0.6;
      ctx.fill();
      ctx.restore();

      // Hole dark pit
      ctx.beginPath();
      ctx.arc(hx, hy, HOLE_R, 0, Math.PI * 2);
      ctx.fillStyle = darkCol;
      ctx.fill();

      // Hole rim
      ctx.beginPath();
      ctx.arc(hx, hy, HOLE_R, 0, Math.PI * 2);
      ctx.strokeStyle = baseCol;
      ctx.lineWidth = 3;
      if (flashAlpha > 0) {
        ctx.shadowBlur = 20 + flashAlpha * 20;
        ctx.shadowColor = baseCol;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner dot
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = baseCol;
      ctx.globalAlpha = 0.6 + flashAlpha * 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label symbol (+ or -)
      ctx.save();
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = baseCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.85;
      ctx.fillText(isGreen ? '+' : '-', hx, hy);
      ctx.restore();
    }
  }

  function _drawArm() {
    var ctx = _ctx;
    var armLen = BOARD_R * 0.72;
    var ax = CX + Math.cos(_armAngle) * armLen;
    var ay = CY + Math.sin(_armAngle) * armLen;
    var ax2 = CX + Math.cos(_armAngle + Math.PI) * armLen;
    var ay2 = CY + Math.sin(_armAngle + Math.PI) * armLen;

    var armColor = _armFrozen ? '#ffe066' : '#ffffff';
    var glowColor = _armFrozen ? 'rgba(255,224,102,0.6)' : 'rgba(200,220,255,0.5)';

    // Glow pass
    ctx.save();
    ctx.shadowBlur = _armFrozen ? 24 : 16;
    ctx.shadowColor = glowColor;
    ctx.beginPath();
    ctx.moveTo(ax2, ay2);
    ctx.lineTo(ax, ay);
    ctx.strokeStyle = armColor;
    ctx.lineWidth = _armFrozen ? 5 : 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // End caps (bright tips)
    ctx.shadowBlur = 18;
    ctx.fillStyle = armColor;
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax2, ay2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Centre pivot
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#a0c0ff';
    var cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 10);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(1, '#5588ff');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(CX, CY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawBall() {
    if (!_ball) { return; }
    var ctx = _ctx;

    // Trail
    for (var ti = 0; ti < _ball.trail.length; ti++) {
      var tp = _ball.trail[ti];
      var ta = (ti / _ball.trail.length) * 0.35;
      var tr = BALL_R * (ti / _ball.trail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, tr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,230,255,' + ta + ')';
      ctx.fill();
    }

    // Ball glow
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(180,220,255,0.8)';
    var bg2 = ctx.createRadialGradient(_ball.x - BALL_R * 0.3, _ball.y - BALL_R * 0.3, 1,
                                        _ball.x, _ball.y, BALL_R);
    bg2.addColorStop(0, '#ffffff');
    bg2.addColorStop(0.5, '#aaddff');
    bg2.addColorStop(1, '#4488cc');
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.arc(_ball.x, _ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawParticles() {
    var ctx = _ctx;
    ctx.save();
    for (var i = 0; i < _particles.length; i++) {
      var p = _particles[i];
      var a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function _drawHUD() {
    var ctx = _ctx;
    // Score
    ctx.save();
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(100,180,255,0.8)';
    ctx.fillText(_score, CX, 28);
    ctx.restore();

    // Best
    ctx.save();
    ctx.font = '15px monospace';
    ctx.fillStyle = 'rgba(180,210,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BEST ' + _best, CX, 72);
    ctx.restore();

    // Lives (dots)
    var dotR = 9;
    var spacing = 26;
    var totalW = (MAX_LIVES - 1) * spacing;
    var lx0 = CX - totalW / 2;
    var ly = VH - 65;
    for (var li = 0; li < MAX_LIVES; li++) {
      var lx = lx0 + li * spacing;
      ctx.save();
      if (li < _lives) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ff6688';
        ctx.fillStyle = '#ff4466';
      } else {
        ctx.fillStyle = 'rgba(80,80,100,0.5)';
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(lx, ly, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score flash
    if (_scoreFlash) {
      var sf = _scoreFlash;
      var sa = Math.max(0, sf.timer / 0.9);
      ctx.save();
      ctx.globalAlpha = sa;
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = '#00ff88';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#00ff88';
      ctx.fillText(sf.val, sf.x, sf.y);
      ctx.restore();
    }

    // Arm frozen indicator
    if (_armFrozen) {
      ctx.save();
      ctx.font = '13px monospace';
      ctx.fillStyle = '#ffe066';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.85;
      ctx.fillText('LOCKED', CX, CY + BOARD_R + 24);
      ctx.restore();
    }
  }

  function _drawMenu() {
    var ctx = _ctx;
    _drawBackground();

    // Title glow ring
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(80,140,255,0.5)';
    ctx.beginPath();
    ctx.arc(CX, CY - 60, BOARD_R * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,160,255,0.25)';
    ctx.lineWidth = 60;
    ctx.stroke();
    ctx.restore();

    // Decorative board preview
    ctx.save();
    ctx.globalAlpha = 0.55;
    _drawBoard();
    _drawHoles();
    ctx.restore();

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(120,200,255,0.9)';
    ctx.font = 'bold 52px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TETRO', CX, CY - 130);
    ctx.font = 'bold 52px monospace';
    ctx.fillStyle = '#66ccff';
    ctx.fillText('DROP', CX, CY - 72);
    ctx.restore();

    // Subtitle
    ctx.save();
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(160,210,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Deflect. Score. Survive.', CX, CY - 28);
    ctx.restore();

    // Instructions
    ctx.save();
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(140,180,220,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap to freeze the arm  |  3 lives', CX, CY + 20);
    ctx.restore();

    // Hole legend
    ctx.save();
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff88';
    ctx.fillText('TOP/BOTTOM = +10 pts', CX, CY + 55);
    ctx.shadowColor = '#ff3344';
    ctx.fillStyle = '#ff4455';
    ctx.fillText('LEFT/RIGHT = -1 life', CX, CY + 78);
    ctx.restore();

    // Best score
    if (_best > 0) {
      ctx.save();
      ctx.font = '17px monospace';
      ctx.fillStyle = 'rgba(255,220,100,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255,200,0,0.6)';
      ctx.fillText('BEST  ' + _best, CX, CY + 112);
      ctx.restore();
    }

    // TAP TO PLAY  (pulsing)
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 380);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(180,220,255,0.8)';
    ctx.fillText('TAP TO PLAY', CX, CY + 165);
    ctx.restore();
  }

  function _drawDead() {
    var ctx = _ctx;
    // Dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Panel
    var pw = 300, ph = 280;
    var px = CX - pw / 2, py = CY - ph / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.fillStyle = 'rgba(10, 18, 40, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,150,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER
    ctx.font = 'bold 38px monospace';
    ctx.fillStyle = '#ff4455';
    ctx.shadowBlur = 22;
    ctx.shadowColor = 'rgba(255,60,80,0.8)';
    ctx.fillText('GAME OVER', CX, py + 52);
    ctx.shadowBlur = 0;

    // Score
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(_score, CX, py + 110);
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(160,200,255,0.75)';
    ctx.fillText('SCORE', CX, py + 140);

    // Best
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255,220,100,0.9)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,200,0,0.5)';
    ctx.fillText('BEST  ' + _best, CX, py + 178);
    ctx.shadowBlur = 0;

    // TAP TO RETRY
    var pulse2 = 0.65 + 0.35 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse2;
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(180,220,255,0.7)';
    ctx.fillText('TAP TO RETRY', CX, py + 240);
    ctx.restore();
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) { return; }
    var ctx = _ctx;

    if (_state === 'MENU') {
      _drawMenu();
      return;
    }

    // Apply screen shake
    var shakeX = 0, shakeY = 0;
    if (_shakeTimer > 0) {
      shakeX = (Math.random() * 2 - 1) * _shakeMag;
      shakeY = (Math.random() * 2 - 1) * _shakeMag;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    _drawBackground();
    _drawBoard();
    _drawHoles();
    _drawArm();
    _drawBall();
    _drawParticles();
    _drawHUD();

    ctx.restore();

    if (_state === 'DEAD') {
      _drawDead();
    }
  }

  // ── getBest ───────────────────────────────────────────────────────────────────
  function getBest() {
    return _best;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };

})();
