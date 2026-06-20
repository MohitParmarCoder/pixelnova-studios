'use strict';

var ShadowSlide = (function () {

  // ── Constants ────────────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;
  var GRAVITY = 1800;        // px/s²
  var JUMP_VEL = -700;       // px/s  (negative = upward)
  var PLAYER_R = 12;         // player circle radius
  var PLAYER_X = 100;        // fixed horizontal position
  var SCROLL_SPEED = 180;    // px/s initial scroll speed
  var PLATFORM_H = 14;       // platform rectangle height
  var LIGHT_RADIUS = 130;    // darkness cutout radius
  var SPEED_INC = 8;         // extra px/s per platform scored
  var MAX_SPEED = 500;
  var PLATFORM_GAP_MIN = 90;
  var PLATFORM_GAP_MAX = 200;
  var PLATFORM_W_MIN = 70;
  var PLATFORM_W_MAX = 160;
  var PLATFORM_Y_MIN = 200;
  var PLATFORM_Y_MAX = VH - 100;
  var BEST_KEY = 'shadowslide_best';

  // ── State ────────────────────────────────────────────────────────────────────
  var _canvas = null;
  var _ctx = null;
  var _state = 'MENU';    // 'MENU' | 'PLAYING' | 'DEAD'
  var _best = 0;
  var _lives = 3;

  // player
  var _py = 0;            // player y (center)
  var _vy = 0;            // vertical velocity
  var _onGround = false;
  var _jumpReady = false;

  // platforms array — each: { x, y, w }
  var _platforms = [];
  var _scrollX = 0;       // total scroll distance (for platform worldX → screenX)
  var _score = 0;
  var _lastPlatIdx = -1;  // index of last platform player was on
  var _speed = SCROLL_SPEED;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function _randInt(min, max) {
    return Math.floor(_rand(min, max + 1));
  }

  // ── Platform generation ───────────────────────────────────────────────────────
  function _makePlatform(worldX) {
    var w = _rand(PLATFORM_W_MIN, PLATFORM_W_MAX);
    var y = _rand(PLATFORM_Y_MIN, PLATFORM_Y_MAX);
    return { worldX: worldX, y: y, w: w, scored: false };
  }

  function _seedPlatforms() {
    _platforms = [];
    // First platform directly under player so game starts on solid ground
    _platforms.push({ worldX: PLAYER_X - 40, y: VH - 180, w: 160, scored: false });
    var nextX = PLAYER_X + 160;
    var i;
    for (i = 0; i < 10; i++) {
      nextX += _rand(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
      _platforms.push(_makePlatform(nextX));
      nextX += _rand(PLATFORM_W_MIN, PLATFORM_W_MAX);
    }
  }

  function _extendPlatforms() {
    // Find the rightmost worldX on screen or upcoming
    var rightmost = 0;
    var i;
    for (i = 0; i < _platforms.length; i++) {
      var rx = _platforms[i].worldX + _platforms[i].w;
      if (rx > rightmost) { rightmost = rx; }
    }
    // Keep platforms generated ahead of the right edge (scroll offset + VW + 200 buffer)
    var needed = _scrollX + VW + 300;
    while (rightmost < needed) {
      rightmost += _rand(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
      _platforms.push(_makePlatform(rightmost));
      rightmost += _rand(PLATFORM_W_MIN, PLATFORM_W_MAX);
    }
  }

  function _prunePlatforms() {
    // Remove platforms that have fully scrolled off screen to the left
    var i = 0;
    while (i < _platforms.length) {
      var screenRight = _platforms[i].worldX + _platforms[i].w - _scrollX;
      if (screenRight < -50) {
        _platforms.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    try { var saved = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; if (saved > _best) { _best = saved; } } catch (e) {}
    _state = 'MENU';
  }

  // ── Start game ───────────────────────────────────────────────────────────────
  function _startGame() {
    _scrollX = 0;
    _score = 0;
    _lives = 3;
    _speed = SCROLL_SPEED;
    _seedPlatforms();
    // Place player on first platform
    var fp = _platforms[0];
    _py = fp.y - PLAYER_R;
    _vy = 0;
    _onGround = true;
    _jumpReady = true;
    _lastPlatIdx = 0;
    _state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  // ── Death ─────────────────────────────────────────────────────────────────────
  function _die() {
    if (_state !== 'PLAYING') { return; }
    _lives--;
    try { Audio.play('crash'); } catch (e) {}
    if (_lives > 0) {
      // Respawn on a new platform
      _seedPlatforms();
      var fp = _platforms[0];
      _py = fp.y - PLAYER_R;
      _vy = 0;
      _onGround = true;
      _jumpReady = true;
      return;
    }
    _state = 'DEAD';
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score, 'shadowslide_best'); } catch(e) {}
    if (_score > _best) {
      _best = _score;
      try { localStorage.setItem(BEST_KEY, String(_best)); } catch (e) {}
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (_state !== 'PLAYING') { return; }

    // Scroll world
    _scrollX += _speed * dt;

    // Gravity
    _vy += GRAVITY * dt;
    _py += _vy * dt;

    _onGround = false;

    // Platform collision
    var playerScreenX = PLAYER_X;
    var playerBottom = _py + PLAYER_R;
    var prevVy = _vy;
    var i;

    for (i = 0; i < _platforms.length; i++) {
      var p = _platforms[i];
      var px = p.worldX - _scrollX;   // platform left on screen
      var pr = px + p.w;               // platform right on screen

      // Only collide when falling (vy > 0) and player center within horizontal bounds
      if (prevVy >= 0 &&
          playerScreenX + PLAYER_R > px &&
          playerScreenX - PLAYER_R < pr) {
        var platTop = p.y;
        // Check if bottom of player crossed platform top this frame
        // (was above last frame, now at or below)
        var prevBottom = playerBottom - _vy * dt;
        if (prevBottom <= platTop + 2 && playerBottom >= platTop - 2) {
          _py = platTop - PLAYER_R;
          _vy = 0;
          _onGround = true;
          _jumpReady = true;

          // Score: new platform
          if (!p.scored) {
            p.scored = true;
            _score++;
            _speed = Math.min(SCROLL_SPEED + _score * SPEED_INC, MAX_SPEED);
            try { Audio.play('gem'); } catch (e) {}
          }
        }
      }
    }

    // Recalculate playerBottom after collision resolution
    playerBottom = _py + PLAYER_R;

    // Extend / prune
    _extendPlatforms();
    _prunePlatforms();

    // Death conditions
    if (playerBottom > VH + 20) { _die(); }
    if (_py - PLAYER_R < -60) {
      // Flew off top — bring back and apply penalty
      _py = -PLAYER_R + 1;
      _vy = 100;
    }
  }

  // ── Tap ──────────────────────────────────────────────────────────────────────
  function tap(x, y) {
    if (_state === 'MENU') {
      _startGame();
      return;
    }
    if (_state === 'DEAD') {
      _startGame();
      return;
    }
    if (_state === 'PLAYING') {
      if (_jumpReady && _onGround) {
        _vy = JUMP_VEL;
        _onGround = false;
        _jumpReady = false;
        try { Audio.play('tap'); } catch (e) {}
      }
    }
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────────
  function _drawTextCenter(text, y, size, color, shadow) {
    var ctx = _ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + size + 'px "Arial", sans-serif';
    if (shadow) {
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, VW / 2, y);
    ctx.restore();
  }

  function _drawDarknessOverlay() {
    var ctx = _ctx;
    var px = PLAYER_X;
    var py = _py;

    // Full black rect
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // We want black everywhere EXCEPT near the player.
    // Strategy: fill black rect, then use destination-out to carve a radial gradient hole.

    // Step 1: draw solid black over entire canvas
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Step 2: use destination-out to erase black around player using radial gradient
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    var grad = ctx.createRadialGradient(px, py, 0, px, py, LIGHT_RADIUS);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.95)');
    grad.addColorStop(0.85, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, LIGHT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawMenu() {
    var ctx = _ctx;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Ambient glow in center
    ctx.save();
    var grad = ctx.createRadialGradient(VW / 2, VH / 2, 0, VW / 2, VH / 2, 200);
    grad.addColorStop(0, 'rgba(255,230,100,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Title
    _drawTextCenter('SHADOW', VH / 2 - 80, 54, '#fff', '#fff');
    _drawTextCenter('SLIDE', VH / 2 - 18, 54, '#FFE064', '#FFE064');

    // Subtitle
    _drawTextCenter('Jump through the darkness', VH / 2 + 48, 18, '#aaa', null);

    // Tap to play pulsing hint
    var alpha = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 500));
    ctx.save();
    ctx.globalAlpha = alpha;
    _drawTextCenter('TAP TO PLAY', VH / 2 + 120, 26, '#FFE064', '#FFE064');
    ctx.restore();

    // Best score
    if (_best > 0) {
      _drawTextCenter('BEST: ' + _best, VH / 2 + 180, 20, '#888', null);
    }

    // Small sample player icon
    ctx.save();
    ctx.shadowColor = '#FFE064';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFE064';
    ctx.beginPath();
    ctx.arc(VW / 2, VH / 2 - 130, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawGame() {
    var ctx = _ctx;

    // Background — very dark purple/black
    ctx.save();
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Draw platforms (they will be partly hidden by darkness)
    var i;
    for (i = 0; i < _platforms.length; i++) {
      var p = _platforms[i];
      var px = p.worldX - _scrollX;
      var py = p.y;
      var pw = p.w;

      ctx.save();
      ctx.fillStyle = '#4a7fff';
      ctx.shadowColor = '#6699ff';
      ctx.shadowBlur = 10;
      ctx.fillRect(px, py, pw, PLATFORM_H);
      // Highlight top edge
      ctx.fillStyle = 'rgba(180,210,255,0.6)';
      ctx.fillRect(px, py, pw, 3);
      ctx.restore();
    }

    // Draw player
    var playerX = PLAYER_X;
    var playerY = _py;
    ctx.save();
    // Outer glow
    ctx.shadowColor = '#FFE064';
    ctx.shadowBlur = 30;
    // Body
    var bodyGrad = ctx.createRadialGradient(playerX - 3, playerY - 3, 1, playerX, playerY, PLAYER_R);
    bodyGrad.addColorStop(0, '#fff');
    bodyGrad.addColorStop(0.4, '#FFE064');
    bodyGrad.addColorStop(1, '#FF8800');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Darkness overlay — applied after world is drawn
    _drawDarknessOverlay();

    // Score and lives HUD (drawn AFTER darkness so it stays visible)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.shadowColor = '#FFE064';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.fillText(_score, 20, 20);
    ctx.shadowBlur = 0;
    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = '#f87171';
    var hStr = '';
    for (var hi = 0; hi < 3; hi++) hStr += (hi < _lives ? '♥' : '♡');
    ctx.textAlign = 'right';
    ctx.fillText(hStr, VW - 20, 20);
    ctx.restore();
  }

  function _drawDead() {
    var ctx = _ctx;

    // Background — same dark world underneath
    ctx.save();
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Semi-dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Panel
    ctx.save();
    ctx.fillStyle = 'rgba(20,10,40,0.95)';
    ctx.strokeStyle = '#4a7fff';
    ctx.lineWidth = 2;
    var panW = 280;
    var panH = 280;
    var panX = (VW - panW) / 2;
    var panY = (VH - panH) / 2;
    _roundRect(ctx, panX, panY, panW, panH, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Game over text
    _drawTextCenter('GAME OVER', VH / 2 - 90, 32, '#fff', '#ff4444');

    // Score
    _drawTextCenter('SCORE', VH / 2 - 40, 18, '#aaa', null);
    _drawTextCenter(String(_score), VH / 2 - 4, 48, '#FFE064', '#FFE064');

    // Best
    _drawTextCenter('BEST: ' + _best, VH / 2 + 56, 20, '#888', null);

    // Tap to retry
    var alpha = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 500));
    ctx.save();
    ctx.globalAlpha = alpha;
    _drawTextCenter('TAP TO RETRY', VH / 2 + 108, 24, '#FFE064', '#FFE064');
    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Draw (public) ─────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) { return; }
    if (_state === 'MENU') {
      _drawMenu();
    } else if (_state === 'PLAYING') {
      _drawGame();
    } else if (_state === 'DEAD') {
      _drawDead();
    }
  }

  // ── getBest (public) ──────────────────────────────────────────────────────────
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
