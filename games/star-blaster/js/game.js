'use strict';

/* ============================================================
   Star Blaster — vertical space shooter
   Virtual canvas: 390 × 844
   Exposed global: StarBlaster
   ============================================================ */
const StarBlaster = (() => {
  const VW = 390, VH = 844;
  const SHIP_Y = 780;
  const SHIP_HALF = 15;          // ~30px wide
  const SHIP_MIN = 24, SHIP_MAX = 366;
  const BASE_FIRE = 0.22;        // seconds between shots
  const BULLET_VY = -700;
  const BOSS_EVERY = 30;         // boss spawns every N kills

  let _canvas, _ctx;
  let _state;                    // 'MENU' | 'PLAYING' | 'DEAD'
  let _best = 0;
  let _score;
  let _lives;
  let _kills;

  let _shipX;
  let _bullets;                  // {x,y,vy}
  let _enemies;                  // {x,y,r,vy,hp,maxhp,type,color,worth,zigDir,zigPhase,boss}
  let _powerups;                 // {x,y,vy,kind}
  let _particles;                // {x,y,vx,vy,life,maxlife,color,r}
  let _stars;                    // {x,y,r,sp}

  let _fireTimer;
  let _spawnTimer;
  let _bossActive;
  let _nextBossAt;

  // power-up timers (seconds remaining)
  let _tripleT, _rapidT, _shieldT;
  let _shieldHits;               // shield absorbs one hit
  let _pulseT;
  let _shakeT;
  let _flashT;

  function _sfx(name) { try { Audio.play(name); } catch (e) {} }

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
    for (let i = 0; i < 70; i++) {
      const r = Math.random() < 0.7 ? 1 : (Math.random() < 0.6 ? 1.5 : 2.3);
      s.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: r,
        sp: 20 + r * 40 + Math.random() * 30
      });
    }
    return s;
  }

  function _reset() {
    _score = 0;
    _lives = 3;
    _kills = 0;
    _shipX = VW / 2;
    _bullets = [];
    _enemies = [];
    _powerups = [];
    _particles = [];
    _fireTimer = 0;
    _spawnTimer = 0.6;
    _bossActive = false;
    _nextBossAt = BOSS_EVERY;
    _tripleT = 0;
    _rapidT = 0;
    _shieldT = 0;
    _shieldHits = 0;
    _pulseT = 0;
    _shakeT = 0;
    _flashT = 0;
  }

  // ── Input API ──────────────────────────────────────────────────────────────
  function setShipX(vx) {
    if (_state !== 'PLAYING') return;
    _shipX = Math.max(SHIP_MIN, Math.min(SHIP_MAX, vx));
  }
  function nudge(dx) {
    if (_state !== 'PLAYING') return;
    _shipX = Math.max(SHIP_MIN, Math.min(SHIP_MAX, _shipX + dx));
  }
  function tap() {
    if (_state === 'MENU') {
      _reset();
      _state = 'PLAYING';
      _sfx('tap');
      try { AdManager.gameplayStart(); } catch (e) {}
    } else if (_state === 'DEAD') {
      _sfx('button');
      try {
        AdManager.showInterstitial(() => {
          _reset();
          _state = 'PLAYING';
          try { AdManager.gameplayStart(); } catch (e) {}
        });
      } catch (e) {
        _reset();
        _state = 'PLAYING';
      }
    }
  }

  function getScore() { return _score; }
  function getState() { return _state; }
  function getBest() { return _best; }

  // ── Spawning ───────────────────────────────────────────────────────────────
  function _difficulty() {
    // ramps from 0 upward with score
    return _score / 100;
  }

  function _spawnInterval() {
    const d = _difficulty();
    return Math.max(0.32, 1.05 - d * 0.12);
  }

  function _enemySpeed() {
    const d = _difficulty();
    return 80 + Math.min(80, d * 16) + Math.random() * 40;
  }

  function _spawnEnemy() {
    const roll = Math.random();
    const d = _difficulty();
    let type;
    if (roll < 0.18 && d > 0.4) type = 'tank';
    else if (roll < 0.5) type = 'zigzag';
    else type = 'grunt';

    let r, hp, color, worth;
    if (type === 'grunt') { r = 14; hp = 1; color = '#FF3C8E'; worth = 10; }
    else if (type === 'tank') { r = 18; hp = 3; color = '#FF8A1E'; worth = 30; }
    else { r = 14; hp = 1; color = '#3CE0FF'; worth = 20; }

    const x = r + 6 + Math.random() * (VW - 2 * (r + 6));
    _enemies.push({
      x: x, y: -r - 4, r: r, vy: _enemySpeed(),
      hp: hp, maxhp: hp, type: type, color: color, worth: worth,
      zigDir: Math.random() < 0.5 ? -1 : 1,
      zigPhase: Math.random() * Math.PI * 2,
      boss: false
    });
  }

  function _spawnBoss() {
    _bossActive = true;
    _enemies.push({
      x: VW / 2, y: -50, r: 42, vy: 24,
      hp: 20, maxhp: 20, type: 'boss', color: '#C04CFF', worth: 200,
      zigDir: 1, zigPhase: 0, boss: true
    });
    _sfx('flip');
  }

  function _spawnPowerup(x, y) {
    const kinds = ['triple', 'shield', 'rapid'];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    _powerups.push({ x: x, y: y, vy: 70, kind: kind });
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  function _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      _particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4, maxlife: 0.9,
        color: color, r: 1.5 + Math.random() * 2.5
      });
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    _pulseT += dt;

    // stars always scroll
    for (const s of _stars) {
      s.y += s.sp * dt;
      if (s.y > VH) { s.y = -2; s.x = Math.random() * VW; }
    }

    // particles always animate
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) _particles.splice(i, 1);
    }

    if (_shakeT > 0) _shakeT = Math.max(0, _shakeT - dt);
    if (_flashT > 0) _flashT = Math.max(0, _flashT - dt);

    if (_state !== 'PLAYING') return;

    // power-up timers
    if (_tripleT > 0) _tripleT = Math.max(0, _tripleT - dt);
    if (_rapidT > 0) _rapidT = Math.max(0, _rapidT - dt);
    if (_shieldT > 0) {
      _shieldT = Math.max(0, _shieldT - dt);
      if (_shieldT === 0) _shieldHits = 0;
    }

    // auto-fire
    _fireTimer -= dt;
    const fireGap = _rapidT > 0 ? BASE_FIRE * 0.5 : BASE_FIRE;
    if (_fireTimer <= 0) {
      _fireTimer += fireGap;
      _fire();
      _sfx('hop');
    }

    // bullets
    for (let i = _bullets.length - 1; i >= 0; i--) {
      const b = _bullets[i];
      b.y += b.vy * dt;
      b.x += (b.vx || 0) * dt;
      if (b.y < -10 || b.x < -10 || b.x > VW + 10) _bullets.splice(i, 1);
    }

    // spawning
    if (!_bossActive) {
      _spawnTimer -= dt;
      if (_spawnTimer <= 0) {
        _spawnTimer = _spawnInterval();
        _spawnEnemy();
      }
      if (_kills >= _nextBossAt) _spawnBoss();
    }

    // enemies
    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];
      e.y += e.vy * dt;
      if (e.type === 'zigzag' && !e.boss) {
        e.zigPhase += dt * 3;
        e.x += Math.cos(e.zigPhase) * 90 * dt;
        e.x = Math.max(e.r, Math.min(VW - e.r, e.x));
      } else if (e.boss) {
        e.zigPhase += dt;
        e.x = VW / 2 + Math.sin(e.zigPhase * 0.8) * (VW / 2 - e.r - 10);
      }

      // collision with ship
      const dx = e.x - _shipX, dy = e.y - SHIP_Y;
      if (Math.hypot(dx, dy) < e.r + SHIP_HALF) {
        _loseLife();
        _killEnemy(i, false);
        continue;
      }

      // passed the bottom
      if (e.y - e.r > VH) {
        if (e.boss) {
          _bossActive = false;
          _nextBossAt += BOSS_EVERY;
        }
        _loseLife();
        _enemies.splice(i, 1);
        continue;
      }
    }

    // bullet vs enemy
    for (let bi = _bullets.length - 1; bi >= 0; bi--) {
      const b = _bullets[bi];
      let hit = false;
      for (let ei = _enemies.length - 1; ei >= 0; ei--) {
        const e = _enemies[ei];
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) {
          hit = true;
          e.hp -= 1;
          _burst(b.x, b.y, e.color, 4);
          if (e.hp <= 0) {
            _killEnemy(ei, true);
          } else {
            _sfx('score');
          }
          break;
        }
      }
      if (hit) _bullets.splice(bi, 1);
    }

    // powerups fall + collect
    for (let i = _powerups.length - 1; i >= 0; i--) {
      const p = _powerups[i];
      p.y += p.vy * dt;
      if (p.y > VH + 20) { _powerups.splice(i, 1); continue; }
      if (Math.hypot(p.x - _shipX, p.y - SHIP_Y) < 18 + SHIP_HALF) {
        _collect(p.kind);
        _powerups.splice(i, 1);
      }
    }

    if (_score > _best) _best = _score;
  }

  function _fire() {
    const tip = SHIP_Y - SHIP_HALF - 4;
    if (_tripleT > 0) {
      _bullets.push({ x: _shipX, y: tip, vy: BULLET_VY, vx: 0 });
      _bullets.push({ x: _shipX - 8, y: tip + 4, vy: BULLET_VY, vx: -150 });
      _bullets.push({ x: _shipX + 8, y: tip + 4, vy: BULLET_VY, vx: 150 });
    } else {
      _bullets.push({ x: _shipX, y: tip, vy: BULLET_VY, vx: 0 });
    }
  }

  function _killEnemy(idx, scored) {
    const e = _enemies[idx];
    _burst(e.x, e.y, e.color, e.boss ? 36 : 12);
    if (e.boss) { _shakeT = 0.4; _flashT = 0.25; }
    if (scored) {
      _score += e.worth;
      _kills += 1;
      _sfx(e.boss ? 'gem' : 'score');
      // chance to drop power-up (not from boss-overlap kills handled here)
      if (!e.boss && Math.random() < 0.12) _spawnPowerup(e.x, e.y);
      if (e.boss && Math.random() < 0.9) _spawnPowerup(e.x, e.y);
    }
    if (e.boss) {
      _bossActive = false;
      _nextBossAt += BOSS_EVERY;
    }
    _enemies.splice(idx, 1);
  }

  function _collect(kind) {
    _sfx('power');
    _burst(_shipX, SHIP_Y, '#FFE45C', 14);
    if (kind === 'triple') _tripleT = 8;
    else if (kind === 'rapid') _rapidT = 6;
    else if (kind === 'shield') { _shieldT = 10; _shieldHits = 1; }
  }

  function _loseLife() {
    // shield absorbs
    if (_shieldHits > 0) {
      _shieldHits = 0;
      _shieldT = 0;
      _sfx('crash');
      _burst(_shipX, SHIP_Y, '#3CE0FF', 18);
      _shakeT = 0.3;
      return;
    }
    _lives -= 1;
    _sfx('crash');
    _burst(_shipX, SHIP_Y, '#FF5500', 22);
    _shakeT = 0.35;
    _flashT = 0.2;
    if (_lives <= 0) _gameOver();
  }

  function _gameOver() {
    _state = 'DEAD';
    if (_score > _best) _best = _score;
    _sfx('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    try { AdManager.showInterstitial(() => {}); } catch (e) {}
    try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'starblaster_best'); } catch(e) {}
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    const ctx = _ctx;
    ctx.save();
    if (_shakeT > 0) {
      const m = _shakeT * 14;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    // background
    ctx.fillStyle = '#05060f';
    ctx.fillRect(-20, -20, VW + 40, VH + 40);

    // stars
    for (const s of _stars) {
      ctx.globalAlpha = 0.4 + s.r * 0.25;
      ctx.fillStyle = '#9fb4ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // particles
    for (const p of _particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxlife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (_state === 'MENU') {
      _drawShip(VW / 2, SHIP_Y);
      _drawMenu();
      ctx.restore();
      return;
    }

    // powerups
    for (const p of _powerups) _drawPowerup(p);

    // bullets
    ctx.fillStyle = '#5CF0FF';
    ctx.shadowColor = '#5CF0FF';
    ctx.shadowBlur = 8;
    for (const b of _bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    ctx.shadowBlur = 0;

    // enemies
    for (const e of _enemies) _drawEnemy(e);

    // ship
    if (_state === 'PLAYING') _drawShip(_shipX, SHIP_Y);

    // HUD
    _drawHUD();

    if (_state === 'DEAD') _drawDead();

    // damage flash
    if (_flashT > 0) {
      ctx.globalAlpha = _flashT * 0.6;
      ctx.fillStyle = '#ff2244';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function _drawShip(x, y) {
    const ctx = _ctx;
    // shield aura
    if (_shieldHits > 0 && _state === 'PLAYING') {
      ctx.globalAlpha = 0.35 + Math.sin(_pulseT * 8) * 0.15;
      ctx.strokeStyle = '#3CE0FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, SHIP_HALF + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // engine flame
    const fl = 6 + Math.abs(Math.sin(_pulseT * 20)) * 8;
    ctx.fillStyle = '#FF9A1E';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + SHIP_HALF - 2);
    ctx.lineTo(x + 6, y + SHIP_HALF - 2);
    ctx.lineTo(x, y + SHIP_HALF - 2 + fl);
    ctx.closePath();
    ctx.fill();

    // body (arrow up)
    ctx.fillStyle = '#E8F3FF';
    ctx.strokeStyle = '#5CF0FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - SHIP_HALF);
    ctx.lineTo(x + SHIP_HALF, y + SHIP_HALF);
    ctx.lineTo(x, y + SHIP_HALF - 6);
    ctx.lineTo(x - SHIP_HALF, y + SHIP_HALF);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // cockpit
    ctx.fillStyle = '#1F6BFF';
    ctx.beginPath();
    ctx.arc(x, y - 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawEnemy(e) {
    const ctx = _ctx;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 8;

    if (e.boss) {
      // big rounded hex body
      _poly(ctx, 6, e.r, Math.PI / 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // core
      ctx.fillStyle = '#FFE45C';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'grunt') {
      // diamond
      ctx.beginPath();
      ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (e.type === 'tank') {
      // hexagon
      _poly(ctx, 6, e.r, 0);
      ctx.fill(); ctx.stroke();
      // hp pips
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < e.hp; i++) {
        ctx.fillRect(-6 + i * 6, -2, 4, 4);
      }
    } else {
      // zigzag triangle
      ctx.beginPath();
      ctx.moveTo(0, e.r); ctx.lineTo(e.r, -e.r); ctx.lineTo(-e.r, -e.r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function _poly(ctx, sides, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function _drawPowerup(p) {
    const ctx = _ctx;
    let col = '#FFE45C', label = '3';
    if (p.kind === 'triple') { col = '#5CFF9A'; label = 'T'; }
    else if (p.kind === 'shield') { col = '#3CE0FF'; label = 'S'; }
    else if (p.kind === 'rapid') { col = '#FFE45C'; label = 'R'; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(_pulseT * 2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    _poly(ctx, 4, 13, 0);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#05060f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 1);
  }

  function _drawHUD() {
    const ctx = _ctx;
    // lives (ship icons, top-left)
    for (let i = 0; i < _lives; i++) {
      const x = 26 + i * 26, y = 30;
      ctx.fillStyle = '#E8F3FF';
      ctx.strokeStyle = '#5CF0FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 8, y + 8);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 8, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // score top-center
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(_score), VW / 2, 16);

    // active power-up indicators (top-right)
    let ix = VW - 22;
    const drawBadge = (col, t, max) => {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(ix, 30, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(ix, 30);
      ctx.arc(ix, 30, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t / max));
      ctx.closePath();
      ctx.fillStyle = '#05060f';
      ctx.fill();
      ctx.globalAlpha = 1;
      ix -= 24;
    };
    if (_tripleT > 0) drawBadge('#5CFF9A', _tripleT, 8);
    if (_rapidT > 0) drawBadge('#FFE45C', _rapidT, 6);
    if (_shieldT > 0) drawBadge('#3CE0FF', _shieldT, 10);

    // boss health bar
    if (_bossActive) {
      const boss = _enemies.find(e => e.boss);
      if (boss) {
        const w = VW - 80, x = 40, y = 56;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#FF3C8E';
        ctx.fillRect(x, y, w * (boss.hp / boss.maxhp), 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, 8);
      }
    }
  }

  function _drawMenu() {
    const ctx = _ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5CF0FF';
    ctx.shadowColor = '#5CF0FF';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 52px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('STAR', VW / 2, VH * 0.32);
    ctx.fillText('BLASTER', VW / 2, VH * 0.32 + 56);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#cdd8ff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Move to dodge & blast!', VW / 2, VH * 0.5);

    if (_best > 0) {
      ctx.fillStyle = '#FFE45C';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('BEST  ' + _best, VW / 2, VH * 0.56);
    }

    const a = 0.55 + Math.sin(_pulseT * 3) * 0.45;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.66);
    ctx.globalAlpha = 1;
  }

  function _drawDead() {
    const ctx = _ctx;
    ctx.fillStyle = 'rgba(5,6,15,0.72)';
    ctx.fillRect(-20, -20, VW + 40, VH + 40);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF3C8E';
    ctx.shadowColor = '#FF3C8E';
    ctx.shadowBlur = 16;
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('GAME OVER', VW / 2, VH * 0.34);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('SCORE  ' + _score, VW / 2, VH * 0.46);

    ctx.fillStyle = '#FFE45C';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('BEST  ' + _best, VW / 2, VH * 0.52);

    const a = 0.55 + Math.sin(_pulseT * 3) * 0.45;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#5CF0FF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.64);
    ctx.globalAlpha = 1;
  }

  return {
    init, update, draw,
    setShipX, nudge, tap,
    getScore, getState, getBest
  };
})();
