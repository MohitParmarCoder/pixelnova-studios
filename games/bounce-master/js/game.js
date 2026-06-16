'use strict';

/* ============================================================
   Bounce Master — Classic brick-breaker arcade game
   Virtual canvas: 390 × 844
   Exposed global: BounceMaster
   ============================================================ */
var BounceMaster = (function () {

  var VW = 390, VH = 844;

  // ── Brick layout constants ───────────────────────────────────────────────────
  var COLS = 7;
  var BRICK_W = 48;
  var BRICK_H = 20;
  var BRICK_GAP = 4;
  var BRICK_TOP = 100;
  var BRICK_MARGIN = (VW - COLS * (BRICK_W + BRICK_GAP) + BRICK_GAP) / 2;

  var ROW_COLORS = [
    '#FF2266', // hot pink
    '#FF7700', // orange
    '#FFD700', // gold
    '#00DD44', // green
    '#00BBFF', // cyan
    '#AA44FF'  // purple
  ];

  // ── Paddle constants ─────────────────────────────────────────────────────────
  var PADDLE_Y = 770;
  var PADDLE_H = 14;
  var PADDLE_W = 100;
  var PADDLE_HALF = PADDLE_W / 2;

  // ── Ball constants ───────────────────────────────────────────────────────────
  var BALL_R = 9;
  var BALL_SPD_BASE = 300;
  var BALL_SPD_MAX = 520;

  // ── Lives ────────────────────────────────────────────────────────────────────
  var MAX_LIVES = 3;

  // ── State ────────────────────────────────────────────────────────────────────
  var _canvas, _ctx;
  var _state;       // 'MENU' | 'PLAYING' | 'DEAD'
  var _best;
  var _score, _lives, _level;
  var _pulseT;

  // ── Bricks ───────────────────────────────────────────────────────────────────
  var _bricks;      // [{x,y,color,alive}]

  // ── Ball ─────────────────────────────────────────────────────────────────────
  var _ball;        // {x, y, vx, vy, stuck}

  // ── Paddle ───────────────────────────────────────────────────────────────────
  var _paddleX;     // center x

  // ── Stars (background) ───────────────────────────────────────────────────────
  var _stars;       // [{x,y,r,a,twinkleT,twinkleSpd}]

  // ── Particles (brick hit) ────────────────────────────────────────────────────
  var _particles;   // [{x,y,vx,vy,r,color,life,t}]

  // ── Launch angle timer (for auto-relaunch after life loss) ──────────────────
  var _relaunchTimer;

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────
  function _snd(name) {
    try { Audio.play(name); } catch (e) {}
  }

  function _clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function _ballSpeed() {
    return Math.min(BALL_SPD_MAX, BALL_SPD_BASE + (_level - 1) * 20);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Initialisation
  // ────────────────────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = bestScore || 0;
    _pulseT = 0;
    _buildStars();
    _score = 0;
    _level = 1;
    _lives = MAX_LIVES;
    _buildLevel();
    _state = 'MENU';
  }

  function _buildStars() {
    _stars = [];
    for (var i = 0; i < 80; i++) {
      _stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: 0.5 + Math.random() * 1.8,
        a: 0.3 + Math.random() * 0.7,
        twinkleT: Math.random() * Math.PI * 2,
        twinkleSpd: 0.8 + Math.random() * 2.0
      });
    }
  }

  function _buildLevel() {
    _bricks = [];
    var rows = Math.min(5 + _level - 1, 8); // more rows each level, max 8
    var i, r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < COLS; c++) {
        _bricks.push({
          x: BRICK_MARGIN + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true
        });
      }
    }
    _paddleX = VW / 2;
    _particles = [];
    _relaunchTimer = 0;
    _placeBall(true);
  }

  function _placeBall(stuck) {
    _ball = {
      x: _paddleX,
      y: PADDLE_Y - BALL_R - 2,
      vx: 0,
      vy: 0,
      stuck: stuck
    };
  }

  function _launchBall() {
    var spd = _ballSpeed();
    // slight random angle biased upward-center
    var ang = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 3);
    _ball.vx = Math.cos(ang) * spd;
    _ball.vy = Math.sin(ang) * spd;
    _ball.stuck = false;
    _snd('tap');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────
  function tap(x, y) {
    if (_state === 'MENU') {
      _score = 0;
      _level = 1;
      _lives = MAX_LIVES;
      _buildLevel();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      _launchBall();
      return;
    }

    if (_state === 'DEAD') {
      _score = 0;
      _level = 1;
      _lives = MAX_LIVES;
      _buildLevel();
      _state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      _launchBall();
      return;
    }

    if (_state === 'PLAYING') {
      // Move paddle toward tap x; if ball stuck, also launch
      _paddleX = _clamp(x, PADDLE_HALF, VW - PADDLE_HALF);
      if (_ball.stuck) {
        _ball.x = _paddleX;
        _launchBall();
      }
    }
  }

  function getBest() {
    return _best;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────────────────────
  function update(dt) {
    _pulseT += dt;

    // Animate stars always
    var i;
    for (i = 0; i < _stars.length; i++) {
      _stars[i].twinkleT += _stars[i].twinkleSpd * dt;
    }

    if (_state !== 'PLAYING') {
      _advanceParticles(dt);
      return;
    }

    _advanceParticles(dt);

    // Auto-relaunch after losing a life
    if (_relaunchTimer > 0) {
      _relaunchTimer -= dt;
      if (_relaunchTimer <= 0) {
        _relaunchTimer = 0;
        _launchBall();
      }
      return;
    }

    if (_ball.stuck) return;

    // Move ball
    _ball.x += _ball.vx * dt;
    _ball.y += _ball.vy * dt;

    // ── Wall collisions ──────────────────────────────────────────────────────
    if (_ball.x - BALL_R < 0) {
      _ball.x = BALL_R;
      _ball.vx = Math.abs(_ball.vx);
    }
    if (_ball.x + BALL_R > VW) {
      _ball.x = VW - BALL_R;
      _ball.vx = -Math.abs(_ball.vx);
    }
    if (_ball.y - BALL_R < 0) {
      _ball.y = BALL_R;
      _ball.vy = Math.abs(_ball.vy);
    }

    // ── Paddle collision ─────────────────────────────────────────────────────
    var paddleLeft = _paddleX - PADDLE_HALF;
    var paddleRight = _paddleX + PADDLE_HALF;
    if (_ball.vy > 0 &&
        _ball.y + BALL_R >= PADDLE_Y &&
        _ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
        _ball.x >= paddleLeft - BALL_R &&
        _ball.x <= paddleRight + BALL_R) {

      var rel = (_ball.x - _paddleX) / PADDLE_HALF; // -1..1
      rel = _clamp(rel, -0.99, 0.99);
      var ang = rel * (Math.PI * 0.38); // max ~68 deg from vertical
      var spd = _ballSpeed();
      _ball.vx = Math.sin(ang) * spd;
      _ball.vy = -Math.abs(Math.cos(ang) * spd);
      _ball.y = PADDLE_Y - BALL_R - 1;
      _snd('tap');
    }

    // ── Brick collisions ─────────────────────────────────────────────────────
    var hitSomething = false;
    for (i = 0; i < _bricks.length; i++) {
      var br = _bricks[i];
      if (!br.alive) continue;

      var bLeft = br.x;
      var bRight = br.x + BRICK_W;
      var bTop = br.y;
      var bBot = br.y + BRICK_H;

      // AABB + ball radius check
      if (_ball.x + BALL_R < bLeft  ||
          _ball.x - BALL_R > bRight ||
          _ball.y + BALL_R < bTop   ||
          _ball.y - BALL_R > bBot) {
        continue;
      }

      // Determine which axis to bounce on
      var overlapLeft  = _ball.x + BALL_R - bLeft;
      var overlapRight = bRight  - (_ball.x - BALL_R);
      var overlapTop   = _ball.y + BALL_R - bTop;
      var overlapBot   = bBot    - (_ball.y - BALL_R);

      var minH = overlapLeft < overlapRight ? overlapLeft : overlapRight;
      var minV = overlapTop  < overlapBot   ? overlapTop  : overlapBot;

      if (minH < minV) {
        _ball.vx = -_ball.vx;
      } else {
        _ball.vy = -_ball.vy;
      }

      br.alive = false;
      _score += 10;
      if (_score > _best) { _best = _score; }
      _snd('gem');
      _spawnParticles(br.x + BRICK_W / 2, br.y + BRICK_H / 2, br.color);
      hitSomething = true;
      break; // one brick per frame for clean physics
    }

    // ── Check all bricks cleared ─────────────────────────────────────────────
    if (_bricksRemaining() === 0) {
      _level++;
      _buildLevel();
      _snd('gem');
      _launchBall();
      return;
    }

    // ── Ball fell off bottom ─────────────────────────────────────────────────
    if (_ball.y - BALL_R > VH) {
      _lives--;
      _snd('crash');
      if (_lives <= 0) {
        _die();
      } else {
        _placeBall(true);
        _relaunchTimer = 1.2; // brief pause then auto-relaunch
      }
    }
  }

  function _bricksRemaining() {
    var n = 0, i;
    for (i = 0; i < _bricks.length; i++) {
      if (_bricks[i].alive) { n++; }
    }
    return n;
  }

  function _die() {
    _state = 'DEAD';
    if (_score > _best) { _best = _score; }
    _snd('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Particles
  // ────────────────────────────────────────────────────────────────────────────
  function _spawnParticles(cx, cy, color) {
    var i, a, sp;
    for (i = 0; i < 10; i++) {
      a  = Math.random() * Math.PI * 2;
      sp = 60 + Math.random() * 160;
      _particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 2.5,
        color: color,
        life: 0.35 + Math.random() * 0.35,
        t: 0
      });
    }
  }

  function _advanceParticles(dt) {
    var i, p;
    for (i = _particles.length - 1; i >= 0; i--) {
      p = _particles[i];
      p.t += dt;
      if (p.t >= p.life) {
        _particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt; // gravity
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Drawing
  // ────────────────────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) { return; }
    var ctx = _ctx;

    _drawBackground(ctx);
    _drawStars(ctx);
    _drawParticles(ctx);
    _drawBricks(ctx);

    if (_state === 'PLAYING' || _state === 'DEAD') {
      _drawPaddle(ctx);
      _drawBall(ctx);
      _drawHUD(ctx);
    }

    if (_state === 'MENU') { _drawMenu(ctx); }
    if (_state === 'DEAD') { _drawDead(ctx); }
  }

  function _drawBackground(ctx) {
    // Dark blue to deep purple gradient
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#050a1a');
    grad.addColorStop(0.4, '#0a0528');
    grad.addColorStop(1, '#12003a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // Subtle nebula glow bands
    var ng1 = ctx.createRadialGradient(VW * 0.2, 200, 0, VW * 0.2, 200, 160);
    ng1.addColorStop(0, 'rgba(80,20,160,0.18)');
    ng1.addColorStop(1, 'rgba(80,20,160,0)');
    ctx.fillStyle = ng1;
    ctx.fillRect(0, 0, VW, VH);

    var ng2 = ctx.createRadialGradient(VW * 0.75, 500, 0, VW * 0.75, 500, 140);
    ng2.addColorStop(0, 'rgba(0,80,180,0.15)');
    ng2.addColorStop(1, 'rgba(0,80,180,0)');
    ctx.fillStyle = ng2;
    ctx.fillRect(0, 0, VW, VH);
  }

  function _drawStars(ctx) {
    var i, s, twinkle;
    for (i = 0; i < _stars.length; i++) {
      s = _stars[i];
      twinkle = s.a * (0.5 + 0.5 * Math.sin(s.twinkleT));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawBricks(ctx) {
    var i, br, grd;
    for (i = 0; i < _bricks.length; i++) {
      br = _bricks[i];
      if (!br.alive) { continue; }

      ctx.shadowColor = br.color;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = br.color;
      _fillRoundRect(ctx, br.x, br.y, BRICK_W, BRICK_H, 5);
      ctx.shadowBlur  = 0;

      // Highlight sheen on top
      ctx.globalAlpha = 0.35;
      ctx.fillStyle   = '#ffffff';
      _fillRoundRect(ctx, br.x + 2, br.y + 2, BRICK_W - 4, 6, 3);
      ctx.globalAlpha = 1;
    }
  }

  function _drawPaddle(ctx) {
    var grad = ctx.createLinearGradient(_paddleX - PADDLE_HALF, PADDLE_Y,
                                        _paddleX - PADDLE_HALF, PADDLE_Y + PADDLE_H);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#88aaee');
    ctx.shadowColor = '#aaddff';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = grad;
    _fillRoundRect(ctx, _paddleX - PADDLE_HALF, PADDLE_Y, PADDLE_W, PADDLE_H, 7);
    ctx.shadowBlur  = 0;
  }

  function _drawBall(ctx) {
    // Glowing orb
    var radGrad = ctx.createRadialGradient(
      _ball.x - BALL_R * 0.3, _ball.y - BALL_R * 0.3, BALL_R * 0.1,
      _ball.x, _ball.y, BALL_R
    );
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.5, '#88ddff');
    radGrad.addColorStop(1, '#2266cc');

    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = radGrad;
    ctx.beginPath();
    ctx.arc(_ball.x, _ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  function _drawParticles(ctx) {
    var i, p, alpha;
    for (i = 0; i < _particles.length; i++) {
      p = _particles[i];
      alpha = 1 - p.t / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  function _drawHUD(ctx) {
    // Score centered top
    _text(ctx, String(_score), VW / 2, 52, 32, '#ffffff', 'center', '#44ccff');

    // Level – top right
    _text(ctx, 'LV ' + _level, VW - 12, 52, 18, '#FFDD44', 'right', '#FFAA00');

    // Lives – top left as colored circles
    var i, cx;
    for (i = 0; i < MAX_LIVES; i++) {
      cx = 18 + i * 26;
      ctx.beginPath();
      ctx.arc(cx, 52, 9, 0, Math.PI * 2);
      if (i < _lives) {
        ctx.fillStyle   = '#FF3366';
        ctx.shadowColor = '#FF3366';
        ctx.shadowBlur  = 10;
      } else {
        ctx.fillStyle   = '#333355';
        ctx.shadowBlur  = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function _drawMenu(ctx) {
    // Title
    _text(ctx, 'BOUNCE', VW / 2, 380, 64, '#44CCFF', 'center', '#44CCFF');
    _text(ctx, 'MASTER', VW / 2, 452, 64, '#FF3366', 'center', '#FF3366');

    // Pulsing "TAP TO PLAY"
    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO PLAY', VW / 2, 558, 28, '#ffffff', 'center', '#00FF88');
    ctx.globalAlpha = 1;

    // Best score
    if (_best > 0) {
      _text(ctx, 'BEST: ' + _best, VW / 2, 622, 20, '#FFDD44', 'center', '#FFAA00');
    }

    // Decorative brick row preview
    var colors = ['#FF2266', '#FF7700', '#FFD700', '#00DD44', '#00BBFF', '#AA44FF', '#FF2266'];
    var bw = 40, bh = 14, bgap = 4;
    var totalW = colors.length * (bw + bgap) - bgap;
    var startX = (VW - totalW) / 2;
    var j;
    for (j = 0; j < colors.length; j++) {
      ctx.shadowColor = colors[j];
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = colors[j];
      _fillRoundRect(ctx, startX + j * (bw + bgap), 310, bw, bh, 4);
    }
    ctx.shadowBlur = 0;
  }

  function _drawDead(ctx) {
    // Dim overlay
    ctx.fillStyle = 'rgba(2, 4, 20, 0.78)';
    ctx.fillRect(0, 0, VW, VH);

    _text(ctx, 'GAME OVER', VW / 2, 330, 48, '#FF3366', 'center', '#FF3366');
    _text(ctx, 'SCORE: ' + _score, VW / 2, 410, 30, '#ffffff', 'center');
    _text(ctx, 'BEST:  ' + _best,  VW / 2, 456, 22, '#FFDD44', 'center', '#FFAA00');

    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 28, '#44CCFF', 'center', '#44CCFF');
    ctx.globalAlpha = 1;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Drawing utilities
  // ────────────────────────────────────────────────────────────────────────────
  function _fillRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }

  function _text(ctx, str, x, y, size, color, align, glow) {
    ctx.font          = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign     = align || 'left';
    ctx.textBaseline  = 'middle';
    ctx.fillStyle     = color;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 16;
    }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public interface
  // ────────────────────────────────────────────────────────────────────────────
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
