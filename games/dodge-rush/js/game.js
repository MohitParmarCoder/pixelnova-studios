'use strict';

/* ============================================================
   Dodge Rush — survive the falling shapes
   Virtual canvas: 390 × 844
   Exposed global: DodgeRush
   ============================================================ */
const DodgeRush = (() => {
  const VW = 390, VH = 844;
  const PLAYER_Y = 760, PLAYER_R = 22;
  const INVINCIBLE_DUR = 3.0;

  let _canvas, _ctx;
  let _state;            // 'MENU' | 'PLAYING' | 'DEAD'
  let _best = 0;
  let _time;             // elapsed seconds (float)
  let _playerX;
  let _enemies;          // {x,y,r,vy,shape,color,counted}
  let _powerups;         // {x,y,r,vy}
  let _particles;
  let _stars;
  let _invuln;           // remaining invincibility seconds
  let _spawnTimer;
  let _powerTimer;
  let _pulseT;

  const SHAPES = ['triangle', 'square', 'diamond'];
  const ENEMY_COLORS = ['#FF2255', '#FF5500', '#FF3388'];

  function init(canvas, best) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _best = best || 0;
    _stars = _makeStars();
    _reset();
    _state = 'MENU';
  }

  function _makeStars() {
    const s = [];
    for (let i = 0; i < 60; i++) {
      s.push({ x: Math.random() * VW, y: Math.random() * VH, r: Math.random() * 1.6 + 0.3, tw: Math.random() * Math.PI * 2 });
    }
    return s;
  }

  function _reset() {
    _time = 0;
    _playerX = VW / 2;
    _enemies = [];
    _powerups = [];
    _particles = [];
    _invuln = 0;
    _spawnTimer = 0;
    _powerTimer = 6 + Math.random() * 4;
    _pulseT = 0;
  }

  function setPlayerX(vx) {
    _playerX = Math.max(PLAYER_R, Math.min(VW - PLAYER_R, vx));
  }

  function nudge(dx) {
    setPlayerX(_playerX + dx);
  }

  function tap(x, y) {
    if (_state === 'MENU') { _reset(); _state = 'PLAYING'; AdManager.gameplayStart(); _snd('button'); }
    else if (_state === 'PLAYING') {
      // Move player toward the tapped X position.
      if (x != null && !isNaN(x)) {
        setPlayerX(x);
      }
    }
    else if (_state === 'DEAD') {
      AdManager.showInterstitial(() => { _reset(); _state = 'PLAYING'; AdManager.gameplayStart(); });
    }
  }

  function _snd(n) { try { Audio.play(n); } catch (e) {} }

  // ── Difficulty curve ─────────────────────────────────────────────────────────
  function _enemySpawnInterval() {
    // starts ~0.85s, ramps toward 0.32s
    return Math.max(0.32, 0.85 - _time * 0.012);
  }
  function _enemySpeed() {
    return 180 + _time * 7 + Math.random() * 80;
  }

  function _spawnEnemy() {
    const r = 16 + Math.random() * 8;
    _enemies.push({
      x: r + Math.random() * (VW - 2 * r),
      y: -30,
      r,
      vy: _enemySpeed(),
      shape: SHAPES[(Math.random() * SHAPES.length) | 0],
      color: ENEMY_COLORS[(Math.random() * ENEMY_COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 4,
      counted: false,
      near: false,
    });
  }

  function _spawnPowerup() {
    _powerups.push({ x: 24 + Math.random() * (VW - 48), y: -24, r: 14, vy: 150 + Math.random() * 60, rot: 0 });
  }

  function _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
      _particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, t: 0, color, r: 2 + Math.random() * 2.5 });
    }
  }

  function update(dt) {
    _pulseT += dt;
    for (const s of _stars) s.tw += dt * 2;

    if (_state === 'MENU') {
      // ambient falling enemies for flavour
      _spawnTimer -= dt;
      if (_spawnTimer <= 0) { _spawnTimer = 0.6; _spawnEnemy(); }
      _advanceEnemies(dt, false);
      _advanceParticles(dt);
      return;
    }

    if (_state === 'DEAD') {
      _advanceEnemies(dt, false);
      _advanceParticles(dt);
      return;
    }

    // PLAYING
    _time += dt;
    if (_invuln > 0) _invuln = Math.max(0, _invuln - dt);

    _spawnTimer -= dt;
    if (_spawnTimer <= 0) { _spawnTimer = _enemySpawnInterval(); _spawnEnemy(); }

    _powerTimer -= dt;
    if (_powerTimer <= 0) { _powerTimer = 9 + Math.random() * 6; _spawnPowerup(); }

    _advanceEnemies(dt, true);
    _advancePowerups(dt);
    _advanceParticles(dt);
  }

  function _advanceEnemies(dt, live) {
    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];
      e.y += e.vy * dt;
      e.rot += e.vr * dt;
      if (live) {
        const dx = e.x - _playerX, dy = e.y - PLAYER_Y;
        const dist = Math.hypot(dx, dy);
        // close-call whoosh
        if (!e.near && dist < PLAYER_R + e.r + 60 && e.y > PLAYER_Y - 120) { e.near = true; _snd('hop'); }
        if (dist < PLAYER_R + e.r) {
          if (_invuln > 0) {
            _burst(e.x, e.y, e.color, 10);
            _enemies.splice(i, 1);
            _scoreBonus();
            _snd('gem');
            continue;
          } else {
            _die();
            return;
          }
        }
      }
      if (e.y > VH + 40) _enemies.splice(i, 1);
    }
  }

  function _advancePowerups(dt) {
    for (let i = _powerups.length - 1; i >= 0; i--) {
      const p = _powerups[i];
      p.y += p.vy * dt;
      p.rot += dt * 3;
      const dist = Math.hypot(p.x - _playerX, p.y - PLAYER_Y);
      if (dist < PLAYER_R + p.r) {
        _invuln = INVINCIBLE_DUR;
        _burst(p.x, p.y, '#00FF88', 14);
        _powerups.splice(i, 1);
        _snd('power');
        continue;
      }
      if (p.y > VH + 40) _powerups.splice(i, 1);
    }
  }

  function _advanceParticles(dt) {
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.t += dt;
      if (p.t >= p.life) { _particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
    }
  }

  let _bonus = 0;
  function _scoreBonus() { _bonus += 5; }

  function _score() { return Math.floor(_time) + _bonus; }

  function _die() {
    _state = 'DEAD';
    _burst(_playerX, PLAYER_Y, '#00EEFF', 18);
    const sc = _score();
    if (sc > _best) _best = sc;
    _snd('crash');
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore(), 'dodgerush_best'); } catch(e) {}
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) return;
    const ctx = _ctx;
    // bg
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0d0a1a'); g.addColorStop(1, '#140d24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    _drawStars(ctx);

    for (const e of _enemies) _drawEnemy(ctx, e);
    for (const p of _powerups) _drawStar(ctx, p.x, p.y, p.r, p.rot, '#00FF88');
    _drawParticles(ctx);

    if (_state === 'MENU') { _drawMenu(ctx); return; }

    _drawPlayer(ctx);

    // score
    _text(ctx, _score() + 's', VW / 2, 60, 40, '#ffffff', 'center', '#00EEFF');

    if (_invuln > 0) {
      const barW = 160, pct = _invuln / INVINCIBLE_DUR;
      ctx.fillStyle = 'rgba(255,215,0,0.25)';
      ctx.fillRect(VW / 2 - barW / 2, 78, barW, 6);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(VW / 2 - barW / 2, 78, barW * pct, 6);
    }

    if (_state === 'DEAD') _drawDead(ctx);
  }

  function _drawStars(ctx) {
    for (const s of _stars) {
      const a = 0.4 + 0.5 * Math.sin(s.tw);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#aab8ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawPlayer(ctx) {
    const gold = _invuln > 0;
    const baseCol = gold ? '#FFD700' : '#00EEFF';
    if (gold) {
      const pa = 0.5 + 0.5 * Math.sin(_pulseT * 12);
      ctx.globalAlpha = 0.35 * pa;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(_playerX, PLAYER_Y, PLAYER_R + 14, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = baseCol; ctx.shadowBlur = 22;
    ctx.fillStyle = baseCol;
    ctx.beginPath(); ctx.arc(_playerX, PLAYER_Y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(_playerX - 6, PLAYER_Y - 6, PLAYER_R * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  function _drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.shadowColor = e.color; ctx.shadowBlur = 14;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    if (e.shape === 'triangle') {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
        const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
    } else if (e.shape === 'square') {
      const s = e.r * 0.85;
      ctx.rect(-s, -s, s * 2, s * 2);
    } else { // diamond
      ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function _drawStar(ctx, x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function _drawParticles(ctx) {
    for (const p of _particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawMenu(ctx) {
    _text(ctx, 'DODGE', VW / 2, 300, 64, '#00EEFF', 'center', '#00EEFF');
    _text(ctx, 'RUSH', VW / 2, 366, 64, '#FF2255', 'center', '#FF2255');
    if (_best > 0) _text(ctx, 'BEST: ' + _best + 's', VW / 2, 430, 22, '#9aa', 'center');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO PLAY', VW / 2, 560, 28, '#ffffff', 'center', '#00EEFF');
    ctx.globalAlpha = 1;
    _text(ctx, 'Drag to move · grab gold stars', VW / 2, 620, 16, '#778', 'center');
  }

  function _drawDead(ctx) {
    ctx.fillStyle = 'rgba(8,6,18,0.78)';
    ctx.fillRect(0, 0, VW, VH);
    _text(ctx, 'GAME OVER', VW / 2, 340, 46, '#FF2255', 'center', '#FF2255');
    _text(ctx, _score() + ' SECONDS', VW / 2, 410, 30, '#ffffff', 'center');
    _text(ctx, 'BEST: ' + _best + 's', VW / 2, 452, 22, '#FFD700', 'center', '#FFD700');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 26, '#00EEFF', 'center', '#00EEFF');
    ctx.globalAlpha = 1;
  }

  function _text(ctx, str, x, y, size, color, align, glow) {
    ctx.font = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function getBest()  { return _best; }
  function getState() { return _state; }
  function getScore() { return _score(); }

  return { init, update, draw, setPlayerX, nudge, tap, getBest, getState, getScore };
})();
