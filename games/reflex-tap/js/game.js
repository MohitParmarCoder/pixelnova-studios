'use strict';

const ReflexTap = (() => {
  // Virtual canvas dimensions
  const VW = 390, VH = 844;

  // Ring geometry
  const CX = 195, CY = 422;
  const OUTER_R = 140, INNER_R = 100;

  // Speed config
  const SPEED_INIT = 2.0;
  const SPEED_INC  = 0.12;
  const SPEED_MAX  = 6.0;

  // Hit zone config
  const ZONE_ARC_INIT = Math.PI / 3;       // 60 degrees
  const ZONE_ARC_MIN  = Math.PI / 10;      // 18 degrees
  const ZONE_ARC_SHRINK = 0.015;

  // Flash duration
  const FLASH_DUR = 0.2;

  // Combo cap
  const COMBO_MAX = 4;

  // Starting lives
  const LIVES_MAX = 3;

  // ---- State ----
  let _canvas, _ctx;
  let _state = 'MENU';

  // Needle
  let _angle   = -Math.PI / 2;  // current needle angle
  let _speed   = SPEED_INIT;    // rad/s, clockwise

  // Hit zone
  let _zoneStart = 0;           // arc start angle
  let _zoneArc   = ZONE_ARC_INIT;

  // Game
  let _score  = 0;
  let _best   = 0;
  let _lives  = LIVES_MAX;
  let _combo  = 0;              // consecutive hits

  // Flash
  let _flashTimer = 0;
  let _flashColor = '';         // '#00FF66' or '#FF3333'

  // Pulse for MENU "TAP TO START"
  let _pulseT = 0;

  // ---- Helpers ----

  function _randZoneStart() {
    return Math.random() * Math.PI * 2;
  }

  function _normalizeAngle(a) {
    a = a % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a;
  }

  // Returns true if angle `a` (normalized 0..2PI) is within arc [start, start+arc]
  function _inArc(a, start, arc) {
    const end = _normalizeAngle(start + arc);
    const s   = _normalizeAngle(start);
    if (s <= end) {
      return a >= s && a <= end;
    } else {
      // wraps around 0
      return a >= s || a <= end;
    }
  }

  function _resetRound() {
    _angle     = -Math.PI / 2;
    _speed     = SPEED_INIT;
    _score     = 0;
    _lives     = LIVES_MAX;
    _combo     = 0;
    _zoneArc   = ZONE_ARC_INIT;
    _zoneStart = _randZoneStart();
    _flashTimer = 0;
    _flashColor = '';
  }

  // ---- Public API ----

  function init(canvas, best) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _best   = best || 0;
    _resetRound();
    _state = 'MENU';
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    _pulseT += dt;

    if (_flashTimer > 0) {
      _flashTimer = Math.max(0, _flashTimer - dt);
    }

    if (_state === 'MENU' || _state === 'PLAYING') {
      // Rotate needle clockwise
      _angle += _speed * dt;
      // Keep angle in reasonable range to avoid float bloat
      if (_angle > Math.PI * 100) _angle -= Math.PI * 200;
    }
    // No movement in DEAD state
  }

  function tap() {
    if (_state === 'MENU') {
      _resetRound();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    if (_state === 'DEAD') {
      _resetRound();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch(e) {}
      return;
    }

    if (_state !== 'PLAYING') return;

    const normalizedAngle = _normalizeAngle(_angle);
    const hit = _inArc(normalizedAngle, _zoneStart, _zoneArc);

    if (hit) {
      // Success
      _combo = Math.min(_combo + 1, COMBO_MAX);
      _score += _combo;
      _flashTimer = FLASH_DUR;
      _flashColor = '#00FF66';
      try { Audio.play('score'); } catch(e) {}

      // Speed up
      _speed = Math.min(_speed + SPEED_INC, SPEED_MAX);

      // Shrink zone
      _zoneArc = Math.max(_zoneArc - ZONE_ARC_SHRINK, ZONE_ARC_MIN);

      // New zone position
      _zoneStart = _randZoneStart();

      // Update best immediately
      if (_score > _best) _best = _score;
    } else {
      // Miss
      _combo = 0;
      _lives--;
      _flashTimer = FLASH_DUR;
      _flashColor = '#FF3333';
      try { Audio.play('crash'); } catch(e) {}

      // New zone position
      _zoneStart = _randZoneStart();

      if (_lives <= 0) {
        _state = 'DEAD';
        try { AdManager.gameplayStop(); } catch(e) {}
        try { AdManager.onRunEnd(); } catch(e) {}
        try { AdManager.showInterstitial(() => {}); } catch(e) {}
        try { AdManager.offerDoubleScore(getScore(), 'reflextap_best'); } catch(e) {}
      }
    }
  }

  function getScore() { return _score; }
  function getState() { return _state; }
  function getBest()  { return _best; }

  // ---- Drawing helpers ----

  function _drawRing(color, alpha) {
    const ctx = _ctx;
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2, true);
    ctx.fillStyle = color;
    ctx.fill('evenodd');
    ctx.restore();
  }

  function _drawHitZone(alpha) {
    const ctx = _ctx;
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;

    // Glow
    ctx.shadowBlur  = 18;
    ctx.shadowColor = '#00FF66';

    // Draw the arc segment as an annular wedge
    const s = _zoneStart;
    const e = s + _zoneArc;

    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, s, e);
    ctx.arc(CX, CY, INNER_R, e, s, true);
    ctx.closePath();
    ctx.fillStyle = '#00FF66';
    ctx.fill();

    ctx.restore();
  }

  function _drawNeedle() {
    const ctx = _ctx;
    const nx = CX + Math.cos(_angle) * OUTER_R;
    const ny = CY + Math.sin(_angle) * OUTER_R;

    ctx.save();
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    // Needle tip dot
    ctx.beginPath();
    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  function _drawFlash() {
    if (_flashTimer <= 0 || !_flashColor) return;
    const ctx = _ctx;
    const t = _flashTimer / FLASH_DUR; // 1 → 0

    ctx.save();
    ctx.globalAlpha = t * 0.85;
    ctx.shadowBlur  = 30;
    ctx.shadowColor = _flashColor;

    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2, true);
    ctx.fillStyle = _flashColor;
    ctx.fill('evenodd');
    ctx.restore();
  }

  function _drawLives() {
    const ctx = _ctx;
    const r   = 10;
    const gap = 28;
    const startX = VW - (LIVES_MAX * gap) + gap / 2 - 10;
    const y = 58;

    for (let i = 0; i < LIVES_MAX; i++) {
      const x = startX + i * gap;
      const alive = i < _lives;

      ctx.save();
      if (alive) {
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#00FF66';
        ctx.fillStyle   = '#00FF66';
      } else {
        ctx.fillStyle   = '#333';
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function _drawScore() {
    const ctx = _ctx;
    ctx.save();
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = 'bold 44px "Arial", sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(_score, CX, CY);
    ctx.restore();
  }

  function _drawCombo() {
    if (_combo <= 1) return;
    const ctx = _ctx;
    ctx.save();
    ctx.fillStyle    = '#FFD700';
    ctx.font         = 'bold 22px "Arial", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 8;
    ctx.shadowColor  = '#FFD700';
    ctx.fillText(_combo + 'x COMBO', CX, CY - OUTER_R - 30);
    ctx.restore();
  }

  function _drawText(text, x, y, size, color, alpha, glow) {
    const ctx = _ctx;
    ctx.save();
    ctx.globalAlpha  = alpha !== undefined ? alpha : 1;
    ctx.fillStyle    = color || '#FFFFFF';
    ctx.font         = 'bold ' + size + 'px "Arial", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowBlur  = 20;
      ctx.shadowColor = glow;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ---- Draw states ----

  function _drawMenu() {
    const ctx = _ctx;

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, VW, VH);

    // Hit zone at half opacity
    _drawHitZone(0.45);

    // Main ring
    _drawRing('#222');

    // Needle spinning
    _drawNeedle();

    // Title
    _drawText('REFLEX TAP', CX, 160, 38, '#FFFFFF', 1, '#FFFFFF');

    // Subtitle
    _drawText('TAP WHEN NEEDLE HITS GREEN', CX, 210, 15, '#AAAAAA');

    // Score label (best)
    if (_best > 0) {
      _drawText('BEST: ' + _best, CX, 250, 18, '#888888');
    }

    // Pulsing "TAP TO START"
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.5);
    _drawText('TAP TO START', CX, VH - 120, 26, '#00FF66', pulse, '#00FF66');

    // Decorative ring label
    _drawText('●', CX, CY - OUTER_R - 20, 12, '#555555');
  }

  function _drawPlaying() {
    const ctx = _ctx;

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, VW, VH);

    // Hit zone
    _drawHitZone(1);

    // Flash overlay (drawn before main ring overlay so it shows through)
    _drawFlash();

    // Main ring
    _drawRing('#222');

    // Re-draw hit zone on top of ring base (ring covers part of zone)
    // Actually we want zone visible on ring face, so draw zone after ring
    _drawHitZone(1);

    // Needle
    _drawNeedle();

    // Score in center
    _drawScore();

    // Combo above ring
    _drawCombo();

    // Lives top-right
    _drawLives();
  }

  function _drawDead() {
    const ctx = _ctx;

    // Dark background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, VW, VH);

    // Dim ring
    _drawRing('#1a1a1a');

    // GAME OVER
    _drawText('GAME OVER', CX, CY - 120, 42, '#FF3333', 1, '#FF3333');

    // Score
    _drawText('SCORE: ' + _score, CX, CY - 50, 30, '#FFFFFF');

    // Best
    _drawText('BEST: ' + _best, CX, CY, 24, '#FFD700', 1, '#FFD700');

    // Pulsing "TAP TO RETRY"
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.5);
    _drawText('TAP TO RETRY', CX, CY + 80, 26, '#00FF66', pulse, '#00FF66');
  }

  function draw() {
    if (!_ctx) return;

    if (_state === 'MENU') {
      _drawMenu();
    } else if (_state === 'PLAYING') {
      _drawPlaying();
    } else if (_state === 'DEAD') {
      _drawDead();
    }
  }

  return { init, update, draw, tap, getScore, getState, getBest };
})();
