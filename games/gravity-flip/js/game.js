/* Gravity Flip — game logic
   Virtual canvas: 390 × 844 (portrait)
   Public API: GravityFlip.init / update / draw / tap / getScore / getState
*/
'use strict';

const GravityFlip = (() => {

  // ── Constants ──────────────────────────────────────────────────────────────
  const VW = 390, VH = 844;
  const FLOOR_Y    = 760;   // top of floor platform
  const CEILING_Y  = 84;    // bottom of ceiling platform
  const CHAR_X     = 100;   // fixed screen x
  const CHAR_W     = 28;
  const CHAR_H     = 28;
  const GRAVITY    = 800;   // px/s²
  const WALL_W     = 40;
  const GAP_H      = 160;
  const BASE_SPEED = 220;   // px/s
  const SPEED_STEP = 10;    // score interval for speed boost
  const SPEED_INC  = 5;     // px/s per step
  const SPAWN_MIN  = 220;   // min px between wall pairs
  const SPAWN_MAX  = 280;   // max px between wall pairs
  const TRAIL_COUNT = 4;    // motion trail rectangles

  // Colours
  const COL_BG      = '#111122';
  const COL_CHAR    = '#00FF88';
  const COL_WALL    = '#00CCFF';
  const COL_ACCENT  = '#FF00AA';
  const COL_WHITE   = '#FFFFFF';
  const COL_GREY    = '#888899';

  // Platform height (visual strip at floor / ceiling)
  const PLAT_H = VH - FLOOR_Y;   // floor strip height  (844-760 = 84)
  const CEIL_H = CEILING_Y;       // ceiling strip height (84)

  // ── Module state ──────────────────────────────────────────────────────────
  let _canvas, _ctx;
  let _state;        // 'MENU' | 'PLAYING' | 'DEAD'
  let _score, _best;

  // Character
  let _charY, _velY, _gravDir;  // gravDir: +1 = down, -1 = up
  let _charRot;     // visual tilt (radians, clamped)
  let _trail;       // [{x, y}] last positions for motion trail

  // Walls  [{x, gapY, scored}]  gapY = top of gap
  let _walls;
  let _nextSpawn;   // x-distance until next wall spawns (relative to rightmost wall x)
  let _scrollX;     // cumulative scroll (for spawning logic)
  let _speed;       // current scroll speed px/s

  // Menu demo-bounce
  let _demoY, _demoVY, _demoGrav;

  // Dead-screen flash timer
  let _deadTimer;

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
      _demoY    = (FLOOR_Y + CEILING_Y) / 2;
      _demoVY   = -300;
      _demoGrav = +1;
    }
    if (s === 'PLAYING') {
      _resetGame();
    }
    if (s === 'DEAD') {
      _deadTimer = 0;
    }
  }

  function _resetGame() {
    _charY   = (FLOOR_Y + CEILING_Y) / 2 - CHAR_H / 2;
    _velY    = 0;
    _gravDir = +1;
    _charRot = 0;
    _trail   = [];
    _walls   = [];
    _score   = 0;
    _speed   = BASE_SPEED;
    _scrollX = 0;
    // Spawn first wall pair well off screen to the right
    _spawnWall(VW + 80);
    _scheduleNextSpawn();
  }

  function _scheduleNextSpawn() {
    _nextSpawn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
  }

  function _spawnWall(x) {
    // gapY: top of the gap opening. Must fit between ceiling and floor.
    const minGapY = CEILING_Y + 10;
    const maxGapY = FLOOR_Y - GAP_H - 10;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);
    _walls.push({ x, gapY, scored: false });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function tap() {
    if (_state === 'MENU') {
      _setState('PLAYING');
      return;
    }
    if (_state === 'DEAD') {
      _setState('PLAYING');
      return;
    }
    if (_state === 'PLAYING') {
      _gravDir = -_gravDir;
      _velY    = 0;   // reset velocity on flip for snappier feel
      try { Audio.play('flip'); } catch(e) {}
    }
  }

  function getScore() { return _score; }
  function getState() { return _state; }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt) {
    if (_state === 'MENU')    { _updateMenu(dt);    return; }
    if (_state === 'PLAYING') { _updatePlaying(dt); return; }
    if (_state === 'DEAD')    { _deadTimer += dt;   return; }
  }

  function _updateMenu(dt) {
    // Animate demo character bouncing
    _demoVY += _demoGrav * GRAVITY * dt;
    _demoY  += _demoVY * dt;
    if (_demoY + CHAR_H >= FLOOR_Y) {
      _demoY  = FLOOR_Y - CHAR_H;
      _demoVY = -Math.abs(_demoVY) * 0.85;
      _demoGrav = +1;
    }
    if (_demoY <= CEILING_Y) {
      _demoY  = CEILING_Y;
      _demoVY = Math.abs(_demoVY) * 0.85;
      _demoGrav = -1;
    }
    // Flip demo gravity occasionally to show the mechanic
    if (Math.random() < dt * 0.4) {
      _demoGrav = -_demoGrav;
      _demoVY   = 0;
    }
  }

  function _updatePlaying(dt) {
    // Speed scaling
    const speedSteps = Math.floor(_score / SPEED_STEP);
    _speed = BASE_SPEED + speedSteps * SPEED_INC;

    // Scroll walls
    const dx = _speed * dt;
    _scrollX += dx;
    for (let i = 0; i < _walls.length; i++) {
      _walls[i].x -= dx;
    }

    // Spawn new walls
    // Distance from rightmost wall's right edge
    const rightX = _walls.length > 0 ? _walls[_walls.length - 1].x : 0;
    if (VW - rightX >= _nextSpawn || _walls.length === 0) {
      // spawn off right edge
      const spawnX = _walls.length > 0
        ? _walls[_walls.length - 1].x + _nextSpawn + WALL_W
        : VW + 60;
      _spawnWall(spawnX);
      _scheduleNextSpawn();
    }

    // Remove walls that have fully scrolled off left
    _walls = _walls.filter(w => w.x + WALL_W > -10);

    // Physics
    _velY += _gravDir * GRAVITY * dt;
    _charY += _velY * dt;

    // Visual tilt
    const targetRot = Math.max(-0.35, Math.min(0.35, _velY / 800 * 0.35 * _gravDir));
    _charRot += (targetRot - _charRot) * Math.min(1, dt * 10);

    // Update trail
    _trail.unshift({ x: CHAR_X, y: _charY });
    if (_trail.length > TRAIL_COUNT) _trail.length = TRAIL_COUNT;

    // Bounds check (floor / ceiling)
    if (_charY + CHAR_H > FLOOR_Y || _charY < CEILING_Y) {
      _die();
      return;
    }

    // Collision with walls
    for (let i = 0; i < _walls.length; i++) {
      const w = _walls[i];
      if (_collidesWithWall(w)) {
        _die();
        return;
      }
      // Score: trailing edge of wall pair passes character x
      if (!w.scored && w.x + WALL_W < CHAR_X) {
        w.scored = true;
        _score++;
        if (_score > _best) _best = _score;
        try { Audio.play('score'); } catch(e) {}
      }
    }
  }

  function _collidesWithWall(w) {
    // Character rect: [CHAR_X, _charY, CHAR_W, CHAR_H]
    // Wall is two rects: top wall and bottom wall with a gap in between
    const cx1 = CHAR_X, cy1 = _charY, cx2 = CHAR_X + CHAR_W, cy2 = _charY + CHAR_H;
    const wx1 = w.x,    wx2 = w.x + WALL_W;

    // Horizontal overlap?
    if (cx2 <= wx1 || cx1 >= wx2) return false;

    // Top wall: from CEILING_Y down to w.gapY
    if (cy1 < w.gapY && cy2 > CEILING_Y) return true;

    // Bottom wall: from w.gapY + GAP_H down to FLOOR_Y
    if (cy2 > w.gapY + GAP_H && cy1 < FLOOR_Y) return true;

    return false;
  }

  function _die() {
    _setState('DEAD');
    try { Audio.play('crash'); } catch(e) {}
    try {
      AdManager.onRunEnd();
      AdManager.showInterstitial(() => {});
    } catch(e) {}
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    const ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    _drawBackground(ctx);
    _drawPlatforms(ctx);

    if (_state === 'MENU')    { _drawMenu(ctx);    return; }
    if (_state === 'PLAYING') { _drawPlaying(ctx); return; }
    if (_state === 'DEAD')    { _drawDead(ctx);    return; }
  }

  function _drawBackground(ctx) {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, VW, VH);

    // Subtle horizontal scanline effect
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let y = CEILING_Y; y < FLOOR_Y; y += 8) {
      ctx.fillRect(0, y, VW, 1);
    }
  }

  function _drawPlatforms(ctx) {
    // Floor platform
    ctx.fillStyle = '#1A1A3A';
    ctx.fillRect(0, FLOOR_Y, VW, VH - FLOOR_Y);
    // Floor edge glow
    ctx.shadowBlur  = 12;
    ctx.shadowColor = COL_WALL;
    ctx.fillStyle   = COL_WALL;
    ctx.fillRect(0, FLOOR_Y, VW, 3);
    ctx.shadowBlur = 0;

    // Ceiling platform
    ctx.fillStyle = '#1A1A3A';
    ctx.fillRect(0, 0, VW, CEILING_Y);
    // Ceiling edge glow
    ctx.shadowBlur  = 12;
    ctx.shadowColor = COL_WALL;
    ctx.fillStyle   = COL_WALL;
    ctx.fillRect(0, CEILING_Y - 3, VW, 3);
    ctx.shadowBlur = 0;
  }

  function _drawWalls(ctx) {
    ctx.shadowBlur  = 16;
    ctx.shadowColor = COL_WALL;
    ctx.fillStyle   = COL_WALL;
    for (const w of _walls) {
      // Top wall: ceiling down to gapY
      ctx.fillRect(w.x, CEILING_Y, WALL_W, w.gapY - CEILING_Y);
      // Bottom wall: gapY + GAP_H down to floor
      ctx.fillRect(w.x, w.gapY + GAP_H, WALL_W, FLOOR_Y - (w.gapY + GAP_H));
      // Gap outline accents
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = 'rgba(0, 204, 255, 0.25)';
      ctx.fillRect(w.x, w.gapY - 3, WALL_W, 3);
      ctx.fillRect(w.x, w.gapY + GAP_H, WALL_W, 3);
      ctx.fillStyle  = COL_WALL;
      ctx.shadowBlur = 16;
    }
    ctx.shadowBlur = 0;
  }

  function _drawCharacter(ctx, x, y, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.translate(x + CHAR_W / 2, y + CHAR_H / 2);
    ctx.rotate(rot || 0);

    // Outer glow
    ctx.shadowBlur  = 20;
    ctx.shadowColor = COL_CHAR;
    ctx.fillStyle   = COL_CHAR;
    ctx.fillRect(-CHAR_W / 2, -CHAR_H / 2, CHAR_W, CHAR_H);

    // Inner highlight
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-CHAR_W / 2 + 4, -CHAR_H / 2 + 4, CHAR_W / 2 - 2, CHAR_H / 2 - 2);

    ctx.restore();
  }

  function _drawGravityArrow(ctx, charCX, charCY) {
    const ax = charCX;
    const ay = charCY + (_gravDir > 0 ? CHAR_H / 2 + 8 : -CHAR_H / 2 - 8);
    const len = 14;
    ctx.save();
    ctx.strokeStyle = COL_ACCENT;
    ctx.fillStyle   = COL_ACCENT;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = COL_ACCENT;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay + _gravDir * len);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    const tip = ay + _gravDir * len;
    ctx.moveTo(ax, tip);
    ctx.lineTo(ax - 5, tip - _gravDir * 7);
    ctx.lineTo(ax + 5, tip - _gravDir * 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _drawMenu(ctx) {
    // Demo character
    _drawCharacter(ctx, CHAR_X, _demoY, 0, 0.7);

    // Demo walls hint
    ctx.globalAlpha = 0.25;
    ctx.fillStyle   = COL_WALL;
    ctx.fillRect(VW * 0.55, CEILING_Y, WALL_W, 120);
    ctx.fillRect(VW * 0.55, CEILING_Y + 120 + GAP_H, WALL_W, FLOOR_Y - CEILING_Y - 120 - GAP_H);
    ctx.globalAlpha = 1;

    // Title
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Glow title
    ctx.shadowBlur  = 30;
    ctx.shadowColor = COL_ACCENT;
    ctx.fillStyle   = COL_ACCENT;
    ctx.font        = 'bold 48px monospace';
    ctx.fillText('GRAVITY', VW / 2, VH / 2 - 70);
    ctx.fillText('FLIP', VW / 2, VH / 2 - 14);
    ctx.shadowBlur  = 0;

    // TAP TO PLAY prompt (pulsing)
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 500));
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = COL_WHITE;
    ctx.font        = 'bold 22px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
    ctx.globalAlpha = 1;

    // Best score
    if (_best > 0) {
      ctx.fillStyle = COL_GREY;
      ctx.font      = '18px monospace';
      ctx.fillText('BEST: ' + _best, VW / 2, VH / 2 + 104);
    }
    ctx.restore();
  }

  function _drawPlaying(ctx) {
    // Motion trail (behind character)
    for (let i = _trail.length - 1; i >= 1; i--) {
      const t     = _trail[i];
      const alpha = (1 - i / TRAIL_COUNT) * 0.28;
      const scale = 1 - i * 0.1;
      const tw    = CHAR_W * scale;
      const th    = CHAR_H * scale;
      const tx    = t.x + (CHAR_W - tw) / 2;
      const ty    = t.y + (CHAR_H - th) / 2;
      _drawCharacter(ctx, tx, ty, _charRot, alpha);
    }

    // Walls
    _drawWalls(ctx);

    // Character
    _drawCharacter(ctx, CHAR_X, _charY, _charRot, 1);

    // Gravity arrow
    _drawGravityArrow(ctx, CHAR_X + CHAR_W / 2, _charY + CHAR_H / 2);

    // Score
    _drawScore(ctx);
  }

  function _drawScore(ctx) {
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = COL_ACCENT;
    ctx.fillStyle   = COL_WHITE;
    ctx.font        = 'bold 36px monospace';
    ctx.fillText(_score, VW / 2, CEILING_Y + 10);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _drawDead(ctx) {
    // Draw walls frozen in place
    _drawWalls(ctx);
    // Draw character (dead, no rotation animation)
    _drawCharacter(ctx, CHAR_X, _charY, _charRot, 0.5);

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CEILING_Y, VW, FLOOR_Y - CEILING_Y);

    // Panel
    const pw = 300, ph = 220;
    const px = (VW - pw) / 2, py = (VH - ph) / 2;
    ctx.fillStyle   = 'rgba(17, 17, 34, 0.92)';
    ctx.strokeStyle = COL_ACCENT;
    ctx.lineWidth   = 2;
    _roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.shadowBlur  = 16;
    ctx.shadowColor = COL_ACCENT;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER
    ctx.shadowBlur  = 20;
    ctx.shadowColor = COL_ACCENT;
    ctx.fillStyle   = COL_ACCENT;
    ctx.font        = 'bold 38px monospace';
    ctx.fillText('GAME OVER', VW / 2, py + 52);
    ctx.shadowBlur  = 0;

    // Score
    ctx.fillStyle = COL_WHITE;
    ctx.font      = 'bold 28px monospace';
    ctx.fillText('SCORE: ' + _score, VW / 2, py + 106);

    // Best
    ctx.fillStyle = COL_GREY;
    ctx.font      = '20px monospace';
    ctx.fillText('BEST: ' + _best, VW / 2, py + 148);

    // Retry prompt
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 500));
    ctx.globalAlpha = _deadTimer > 0.4 ? pulse : 0;
    ctx.fillStyle   = COL_WHITE;
    ctx.font        = 'bold 20px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, py + 192);
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
    ctx.lineTo(x,     y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  // ── Public ────────────────────────────────────────────────────────────────
  function getBest() { return _best; }
  return { init, update, draw, tap, getScore, getState, getBest };
})();
