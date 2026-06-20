'use strict';

/* ============================================================
   Block Breaker — neon Breakout/Arkanoid
   Virtual canvas: 390 × 844
   Exposed global: BlockBreaker
   ============================================================ */
const BlockBreaker = (() => {
  const VW = 390, VH = 844;

  // Brick grid
  const ROWS = 5, COLS = 8;
  const BRICK_W = 40, BRICK_H = 18, GAP = 4;
  const MARGIN = (VW - COLS * (BRICK_W + GAP) + GAP) / 2; // center
  const TOP_Y = 120;

  const ROW_COLORS = ['#FF3355', '#FF8800', '#FFDD00', '#00FF66', '#00CCFF'];
  const ROW_HP     = [3, 3, 2, 1, 1];

  // Paddle / ball
  const PADDLE_Y = 790, PADDLE_H = 14, PADDLE_W0 = 80;
  const BALL_R = 8, BALL_SPD0 = 320, BALL_SPD_MAX = 520;

  let _canvas, _ctx;
  let _state;      // 'MENU' | 'PLAYING' | 'DEAD' | 'WIN'
  let _best = 0;
  let _score, _lives, _level;
  let _bricks;     // {x,y,hp,maxHp,color}
  let _balls;      // {x,y,vx,vy,stuck}
  let _paddleX, _paddleW;
  let _powerups;   // {x,y,vy,type}
  let _effects;    // {wide:t, fireball:t}
  let _winTimer;
  let _pulseT;
  let _particles;

  function init(canvas, best) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = best || 0;
    _score = 0; _level = 1; _lives = 3;
    _newLevel();
    _state = 'MENU';
  }

  function _newLevel() {
    _bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const hp = ROW_HP[r];
        _bricks.push({
          x: MARGIN + c * (BRICK_W + GAP),
          y: TOP_Y + r * (BRICK_H + GAP),
          hp, maxHp: hp,
          color: ROW_COLORS[r],
          row: r,
        });
      }
    }
    _paddleX = VW / 2;
    _paddleW = PADDLE_W0;
    _powerups = [];
    _effects = { wide: 0, fireball: 0 };
    _particles = [];
    _winTimer = 0;
    _pulseT = 0;
    _resetBall();
  }

  function _ballSpeed() {
    return Math.min(BALL_SPD_MAX, BALL_SPD0 + (_level - 1) * 15);
  }

  function _resetBall() {
    _balls = [{ x: _paddleX, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0, stuck: true }];
  }

  function _snd(n) { try { Audio.play(n); } catch (e) {} }

  function setPaddleX(vx) {
    _paddleX = Math.max(_paddleW / 2, Math.min(VW - _paddleW / 2, vx));
    // carry stuck ball
    for (const b of _balls) if (b.stuck) b.x = _paddleX;
  }
  function nudge(dx) { setPaddleX(_paddleX + dx); }

  function tap() {
    if (_state === 'MENU') { _score = 0; _level = 1; _lives = 3; _newLevel(); _state = 'PLAYING'; AdManager.gameplayStart(); _launch(); _snd('button'); return; }
    if (_state === 'DEAD') { AdManager.showInterstitial(() => { _score = 0; _level = 1; _lives = 3; _newLevel(); _state = 'PLAYING'; AdManager.gameplayStart(); _launch(); }); return; }
    if (_state === 'PLAYING') _launch();
  }

  function _launch() {
    const spd = _ballSpeed();
    for (const b of _balls) {
      if (b.stuck) {
        b.stuck = false;
        const ang = -Math.PI / 4 - Math.random() * Math.PI / 6; // up-ish
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
      }
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    _pulseT += dt;
    if (_state !== 'PLAYING' && _state !== 'WIN') return;

    if (_effects.wide > 0) { _effects.wide -= dt; if (_effects.wide <= 0) _paddleW = PADDLE_W0; }
    if (_effects.fireball > 0) _effects.fireball -= dt;

    if (_state === 'WIN') {
      _winTimer -= dt;
      _advanceParticles(dt);
      if (_winTimer <= 0) { _level++; _newLevel(); _state = 'PLAYING'; }
      return;
    }

    _advanceParticles(dt);
    _advancePowerups(dt);

    const spd = _ballSpeed();
    for (let bi = _balls.length - 1; bi >= 0; bi--) {
      const b = _balls[bi];
      if (b.stuck) { b.x = _paddleX; continue; }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // walls
      if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x > VW - BALL_R) { b.x = VW - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

      // paddle
      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          b.x >= _paddleX - _paddleW / 2 - BALL_R && b.x <= _paddleX + _paddleW / 2 + BALL_R) {
        const rel = (b.x - _paddleX) / (_paddleW / 2); // -1..1
        const ang = rel * (Math.PI / 3); // up to 60°
        b.vx = Math.sin(ang) * spd;
        b.vy = -Math.abs(Math.cos(ang) * spd);
        b.y = PADDLE_Y - BALL_R - 1;
        _snd('tap');
      }

      // bricks
      _ballBricks(b);

      // fell out
      if (b.y - BALL_R > VH) {
        _balls.splice(bi, 1);
      }
    }

    if (_balls.length === 0) {
      _lives--;
      if (_lives <= 0) { _die(); return; }
      _snd('lose');
      _resetBall();
    }

    if (_bricks.length === 0) {
      _state = 'WIN';
      _winTimer = 1.5;
      _snd('power');
    }
  }

  function _ballBricks(b) {
    for (let i = _bricks.length - 1; i >= 0; i--) {
      const br = _bricks[i];
      if (b.x + BALL_R < br.x || b.x - BALL_R > br.x + BRICK_W ||
          b.y + BALL_R < br.y || b.y - BALL_R > br.y + BRICK_H) continue;

      // collision — determine bounce axis by overlap
      const overlapX = Math.min(b.x + BALL_R - br.x, br.x + BRICK_W - (b.x - BALL_R));
      const overlapY = Math.min(b.y + BALL_R - br.y, br.y + BRICK_H - (b.y - BALL_R));
      if (overlapX < overlapY) b.vx = -b.vx; else b.vy = -b.vy;

      const fire = _effects.fireball > 0;
      br.hp = fire ? 0 : br.hp - 1;
      _snd('tap');

      if (br.hp <= 0) {
        _bricks.splice(i, 1);
        _score += 10 + (ROWS - 1 - br.row) * 4 * _level;
        _spawnHitParticles(br);
        _snd('score');
        if (Math.random() < 0.2) _dropPowerup(br.x + BRICK_W / 2, br.y + BRICK_H / 2);
      }
      return; // one brick per frame
    }
  }

  const PU_TYPES = ['wide', 'fireball', 'multiball'];
  const PU_COLORS = { wide: '#00CCFF', fireball: '#FF6600', multiball: '#FFDD00' };
  function _dropPowerup(x, y) {
    _powerups.push({ x, y, vy: 140, type: PU_TYPES[(Math.random() * PU_TYPES.length) | 0] });
  }

  function _advancePowerups(dt) {
    for (let i = _powerups.length - 1; i >= 0; i--) {
      const p = _powerups[i];
      p.y += p.vy * dt;
      if (p.y > PADDLE_Y - 6 && p.y < PADDLE_Y + PADDLE_H + 6 &&
          p.x >= _paddleX - _paddleW / 2 && p.x <= _paddleX + _paddleW / 2) {
        _applyPowerup(p.type);
        _powerups.splice(i, 1);
        _snd('gem');
        continue;
      }
      if (p.y > VH + 20) _powerups.splice(i, 1);
    }
  }

  function _applyPowerup(type) {
    if (type === 'wide') { _paddleW = PADDLE_W0 + 36; _effects.wide = 8; }
    else if (type === 'fireball') { _effects.fireball = 6; }
    else if (type === 'multiball') {
      const src = _balls[0];
      if (src) {
        const spd = _ballSpeed();
        for (let k = 0; k < 2; k++) {
          const ang = -Math.PI / 2 + (k === 0 ? -0.5 : 0.5);
          _balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, stuck: false });
        }
      }
    }
  }

  function _spawnHitParticles(br) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 140;
      _particles.push({ x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, t: 0, color: br.color, r: 2 + Math.random() * 2 });
    }
  }

  function _advanceParticles(dt) {
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.t += dt;
      if (p.t >= p.life) { _particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
    }
  }

  function _die() {
    _state = 'DEAD';
    if (_score > _best) _best = _score;
    _snd('lose');
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore(), 'blockbreaker_best'); } catch(e) {}
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) return;
    const ctx = _ctx;
    ctx.fillStyle = '#080818';
    ctx.fillRect(0, 0, VW, VH);

    for (const br of _bricks) _drawBrick(ctx, br);
    for (const p of _powerups) _drawPowerup(ctx, p);
    _drawParticles(ctx);

    if (_state !== 'MENU') {
      _drawPaddle(ctx);
      for (const b of _balls) _drawBall(ctx, b);
      _drawHud(ctx);
    }

    if (_state === 'MENU') _drawMenu(ctx);
    if (_state === 'WIN') _drawWin(ctx);
    if (_state === 'DEAD') _drawDead(ctx);
  }

  function _drawBrick(ctx, br) {
    const a = 0.45 + 0.55 * (br.hp / br.maxHp);
    ctx.globalAlpha = a;
    ctx.shadowColor = br.color; ctx.shadowBlur = 8;
    ctx.fillStyle = br.color;
    _roundRect(ctx, br.x, br.y, BRICK_W, BRICK_H, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function _drawPaddle(ctx) {
    const fire = _effects.fireball > 0;
    const col = fire ? '#FF6600' : '#ffffff';
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.fillStyle = col;
    _roundRect(ctx, _paddleX - _paddleW / 2, PADDLE_Y, _paddleW, PADDLE_H, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function _drawBall(ctx, b) {
    const fire = _effects.fireball > 0;
    const col = fire ? '#FF8800' : '#ffffff';
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function _drawPowerup(ctx, p) {
    const col = PU_COLORS[p.type];
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fillStyle = col;
    _roundRect(ctx, p.x - 12, p.y - 7, 24, 14, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const letter = p.type === 'wide' ? 'W' : p.type === 'fireball' ? 'F' : 'M';
    ctx.fillText(letter, p.x, p.y + 1);
  }

  function _drawParticles(ctx) {
    for (const p of _particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawHud(ctx) {
    _text(ctx, String(_score), VW / 2, 50, 34, '#ffffff', 'center', '#00CCFF');
    // lives top-left
    ctx.fillStyle = '#FF3355';
    ctx.font = '22px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#FF3355'; ctx.shadowBlur = 8;
    ctx.fillText('♥ '.repeat(Math.max(0, _lives)).trim(), 14, 36);
    ctx.shadowBlur = 0;
    _text(ctx, 'LV ' + _level, VW - 14, 36, 18, '#FFDD00', 'right');
  }

  function _drawMenu(ctx) {
    _text(ctx, 'BLOCK', VW / 2, 470, 60, '#00CCFF', 'center', '#00CCFF');
    _text(ctx, 'BREAKER', VW / 2, 536, 60, '#FF3355', 'center', '#FF3355');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO PLAY', VW / 2, 640, 28, '#ffffff', 'center', '#00FF66');
    ctx.globalAlpha = 1;
    _text(ctx, 'Drag to move · tap to launch', VW / 2, 700, 16, '#778', 'center');
  }

  function _drawWin(ctx) {
    _text(ctx, 'LEVEL ' + _level + ' CLEAR!', VW / 2, VH / 2, 38, '#00FF66', 'center', '#00FF66');
  }

  function _drawDead(ctx) {
    ctx.fillStyle = 'rgba(8,8,24,0.8)';
    ctx.fillRect(0, 0, VW, VH);
    _text(ctx, 'GAME OVER', VW / 2, 350, 46, '#FF3355', 'center', '#FF3355');
    _text(ctx, 'SCORE: ' + _score, VW / 2, 420, 28, '#ffffff', 'center');
    _text(ctx, 'BEST: ' + _best, VW / 2, 460, 22, '#FFDD00', 'center', '#FFDD00');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 26, '#00CCFF', 'center', '#00CCFF');
    ctx.globalAlpha = 1;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function _text(ctx, str, x, y, size, color, align, glow) {
    ctx.font = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function getScore() { return _score; }
  function getState() { return _state; }
  function getBest()  { return _best; }

  return { init, update, draw, setPaddleX, nudge, tap, getScore, getState, getBest };
})();
