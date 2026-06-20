'use strict';

// TapBlast — virtual canvas 390×844
// States: MENU → PLAYING → DEAD
const TapBlast = (() => {
  const VW = 390, VH = 844;

  // ── Neon colors (5 rotating) ───────────────────────────────────────────────
  const COLORS = [
    '#ff2d78', // hot pink
    '#00f5ff', // cyan
    '#aaff00', // lime
    '#bf5fff', // violet
    '#ff9900', // orange
  ];

  // ── Constants ──────────────────────────────────────────────────────────────
  const MAX_LIVES        = 3;
  const BASE_MAX_LIFE    = 1.8;   // seconds a circle survives at score 0
  const MIN_MAX_LIFE     = 0.9;   // floor at high score
  const LIFE_RAMP_SCORE  = 40;    // score at which maxLife reaches MIN_MAX_LIFE
  const BASE_SPAWN_INT   = 0.6;   // seconds between spawns at score 0
  const MIN_SPAWN_INT    = 0.22;  // floor spawn interval
  const SPAWN_RAMP_SCORE = 50;
  const COMBO_WINDOW     = 1.0;   // seconds to sustain a combo

  let _canvas, _ctx;

  // ── Game state ─────────────────────────────────────────────────────────────
  let state;         // 'MENU' | 'PLAYING' | 'DEAD'
  let score;
  let best;
  let lives;
  let circles;      // array of circle objects
  let particles;    // array of particle objects
  let nextId;
  let spawnTimer;
  let comboCount;
  let comboTimer;   // seconds until combo resets
  let deadScore;
  let colorIndex;

  // ── Menu state ─────────────────────────────────────────────────────────────
  let menuCircles;  // decorative background circles for menu

  // ── Derived helpers ────────────────────────────────────────────────────────
  function _maxLife() {
    const t = Math.min(score / LIFE_RAMP_SCORE, 1);
    return BASE_MAX_LIFE - t * (BASE_MAX_LIFE - MIN_MAX_LIFE);
  }

  function _spawnInterval() {
    const t = Math.min(score / SPAWN_RAMP_SCORE, 1);
    return BASE_SPAWN_INT - t * (BASE_SPAWN_INT - MIN_SPAWN_INT);
  }

  function _maxCircles() {
    return Math.min(3 + Math.floor(score / 8), 6);
  }

  function _randomR() {
    return 35 + Math.random() * 20; // 35–55
  }

  function _randomColor() {
    const c = COLORS[colorIndex % COLORS.length];
    colorIndex++;
    return c;
  }

  // ── Circle spawning ────────────────────────────────────────────────────────
  function _spawnCircle() {
    const r = _randomR();
    const margin = r + 8;
    // Keep circles away from the HUD (top 80px)
    const x = margin + Math.random() * (VW - margin * 2);
    const y = 90 + margin + Math.random() * (VH - 90 - margin * 2);
    const ml = _maxLife();
    circles.push({
      x, y, r,
      maxR: r,
      life: ml,
      maxLife: ml,
      color: _randomColor(),
      id: nextId++,
    });
  }

  // ── Initialise menu background circles ────────────────────────────────────
  function _initMenuCircles() {
    menuCircles = [];
    for (let i = 0; i < 8; i++) {
      const r = 20 + Math.random() * 40;
      menuCircles.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r,
        maxR: r,
        life: Math.random(),   // phase offset
        maxLife: 1,
        color: COLORS[i % COLORS.length],
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
      });
    }
  }

  // ── Reset / start ──────────────────────────────────────────────────────────
  function _resetGame() {
    score      = 0;
    lives      = MAX_LIVES;
    circles    = [];
    particles  = [];
    nextId     = 1;
    spawnTimer = 0;
    comboCount = 0;
    comboTimer = 0;
    colorIndex = 0;
    deadScore  = 0;
    // Spawn a couple of circles immediately
    _spawnCircle();
    _spawnCircle();
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  function _spawnParticles(x, y, color) {
    const count = 8 + Math.floor(Math.random() * 5); // 8–12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 80 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        r: 4 + Math.random() * 5,
        color,
      });
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function init(canvas) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    best    = parseInt(localStorage.getItem('tapblast_best') || '0', 10);
    state   = 'MENU';
    score   = 0;
    lives   = MAX_LIVES;
    circles = [];
    particles = [];
    nextId  = 1;
    spawnTimer = 0;
    comboCount = 0;
    comboTimer = 0;
    colorIndex = 0;
    deadScore = 0;
    _initMenuCircles();
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state === 'MENU') {
      _updateMenu(dt);
      return;
    }
    if (state !== 'PLAYING') return;

    // ── Combo timer ──────────────────────────────────────────────────────────
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) comboCount = 0;
    }

    // ── Spawn ────────────────────────────────────────────────────────────────
    spawnTimer -= dt;
    if (spawnTimer <= 0 && circles.length < _maxCircles()) {
      _spawnCircle();
      spawnTimer = _spawnInterval();
    }

    // ── Update circles ───────────────────────────────────────────────────────
    const expired = [];
    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      c.life -= dt;
      c.r = c.maxR * Math.max(c.life / c.maxLife, 0);
      if (c.life <= 0) {
        expired.push(i);
      }
    }

    // Remove expired — lose a life each
    for (const i of expired) {
      circles.splice(i, 1);
      lives--;
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) {
        _triggerDead();
        return;
      }
    }

    // ── Update particles ─────────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt; // gravity pull
      p.vx *= Math.pow(0.97, dt * 60);
    }

    // ── Miss flash countdown ─────────────────────────────────────────────────
    if (_missFlash > 0) _missFlash = Math.max(0, _missFlash - dt);
  }

  function _updateMenu(dt) {
    if (!menuCircles) return;
    for (const c of menuCircles) {
      c.life = (c.life + dt * 0.5) % 1; // animate phase
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      // Bounce off edges
      if (c.x < c.maxR || c.x > VW - c.maxR) { c.vx *= -1; c.x = Math.max(c.maxR, Math.min(VW - c.maxR, c.x)); }
      if (c.y < c.maxR || c.y > VH - c.maxR) { c.vy *= -1; c.y = Math.max(c.maxR, Math.min(VH - c.maxR, c.y)); }
      // Pulse radius
      c.r = c.maxR * (0.7 + 0.3 * Math.sin(c.life * Math.PI * 2));
    }
  }

  function draw() {
    const ctx = _ctx;
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU')    { _drawMenu(ctx);    return; }
    if (state === 'PLAYING') { _drawPlaying(ctx); return; }
    if (state === 'DEAD')    { _drawDead(ctx);    return; }
  }

  // ── tap(vx, vy) — virtual canvas coordinates ──────────────────────────────
  function tap(vx, vy) {
    if (state === 'MENU') {
      _resetGame();
      return;
    }
    if (state === 'DEAD') {
      AdManager.showInterstitial(() => { _resetGame(); });
      return;
    }
    if (state !== 'PLAYING') return;

    // Find the topmost circle (last in array) that the tap hits
    let hit = -1;
    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      const dx = vx - c.x;
      const dy = vy - c.y;
      if (dx * dx + dy * dy < c.r * c.r) {
        hit = i;
        break;
      }
    }

    if (hit >= 0) {
      const c = circles[hit];
      // Combo
      comboCount++;
      comboTimer = COMBO_WINDOW;
      const multiplier = comboCount;
      const gained = multiplier;
      score += gained;
      if (score > best) {
        best = score;
        localStorage.setItem('tapblast_best', String(best));
      }
      _spawnParticles(c.x, c.y, c.color);
      circles.splice(hit, 1);
      try { Audio.play('tap'); } catch(e) {}
      // Immediately try to spawn a replacement
      spawnTimer = Math.max(spawnTimer, 0); // let next update spawn
    } else {
      // Missed — lose a life
      lives--;
      comboCount = 0;
      comboTimer = 0;
      try { Audio.play('crash'); } catch(e) {}
      // Small screen flash managed by a flag
      _missFlash = 0.25;
      if (lives <= 0) {
        _triggerDead();
      }
    }
  }

  let _missFlash = 0; // countdown for red flash on miss (decremented in update)

  // ── Trigger death ──────────────────────────────────────────────────────────
  function _triggerDead() {
    deadScore = score;
    if (score > best) {
      best = score;
      localStorage.setItem('tapblast_best', String(best));
    }
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore(), 'tapblast_best'); } catch(e) {}
  }

  // ── Draw: MENU ─────────────────────────────────────────────────────────────
  function _drawMenu(ctx) {
    // Decorative background circles
    if (menuCircles) {
      for (const c of menuCircles) {
        _drawCircle(ctx, c, 0.35);
      }
    }

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Title glow
    ctx.font        = 'bold 64px "Arial Narrow", Arial, sans-serif';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#ffffff';
    ctx.fillText('TAP', VW / 2, VH / 2 - 90);

    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#ff2d78';
    ctx.fillText('BLAST', VW / 2, VH / 2 - 20);

    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#aaaacc';
    ctx.font        = '16px Arial, sans-serif';
    ctx.fillText('Tap circles before they shrink!', VW / 2, VH / 2 + 50);

    // Tap to play — pulsing
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.font        = 'bold 24px Arial, sans-serif';
    ctx.fillStyle   = '#aaffee';
    ctx.shadowColor = '#aaffee';
    ctx.shadowBlur  = 12;
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 120);
    ctx.restore();

    // Best score
    if (best > 0) {
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '18px Arial, sans-serif';
      ctx.fillStyle    = '#ffee00';
      ctx.shadowColor  = '#ffee00';
      ctx.shadowBlur   = 8;
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 170);
      ctx.restore();
    }
  }

  // ── Draw: PLAYING ──────────────────────────────────────────────────────────
  function _drawPlaying(ctx) {
    // Miss flash overlay
    if (_missFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (_missFlash / 0.25) * 0.18;
      ctx.fillStyle   = '#ff0000';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }

    // Circles
    for (const c of circles) {
      _drawCircle(ctx, c, 1);
      // Timer arc (shrinking ring shows time left)
      const frac = c.life / c.maxLife;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.maxR + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth   = 3;
      ctx.shadowColor = c.color;
      ctx.shadowBlur  = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of particles) {
      const a = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha  = a;
      ctx.fillStyle    = p.color;
      ctx.shadowColor  = p.color;
      ctx.shadowBlur   = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── HUD ──────────────────────────────────────────────────────────────────
    // Score (top-center)
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = 'bold 48px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.shadowColor  = '#00f5ff';
    ctx.shadowBlur   = 16;
    ctx.fillText(score, VW / 2, 20);
    ctx.restore();

    // Combo label (below score)
    if (comboCount >= 2) {
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = 'bold 20px Arial, sans-serif';
      ctx.fillStyle    = '#ffee00';
      ctx.shadowColor  = '#ffee00';
      ctx.shadowBlur   = 12;
      ctx.fillText(comboCount + 'x COMBO!', VW / 2, 72);
      ctx.restore();
    }

    // Lives (top-right as ♥ glyphs)
    _drawLives(ctx, lives);
  }

  // ── Draw: DEAD ─────────────────────────────────────────────────────────────
  function _drawDead(ctx) {
    // Dimmed circles (frozen)
    for (const c of circles) {
      _drawCircle(ctx, c, 0.2);
    }

    // Panel
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,26,0.88)';
    _roundRect(ctx, 40, VH / 2 - 180, VW - 80, 360, 20);
    ctx.fill();

    ctx.strokeStyle = '#ff2d78';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur  = 18;
    ctx.lineWidth   = 2;
    _roundRect(ctx, 40, VH / 2 - 180, VW - 80, 360, 20);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER
    ctx.font        = 'bold 42px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle   = '#ff2d78';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur  = 20;
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 110);

    ctx.shadowBlur = 0;

    // Score label
    ctx.font      = '18px Arial, sans-serif';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText('SCORE', VW / 2, VH / 2 - 50);

    // Score value
    ctx.font        = 'bold 80px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 22;
    ctx.fillText(deadScore, VW / 2, VH / 2 + 20);

    ctx.shadowBlur = 0;

    // Best score
    ctx.font      = '18px Arial, sans-serif';
    ctx.fillStyle = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 8;
    ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 90);

    ctx.shadowBlur  = 0;

    // Tap to retry — pulsing
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = pulse;
    ctx.font        = 'bold 22px Arial, sans-serif';
    ctx.fillStyle   = '#aaffee';
    ctx.shadowColor = '#aaffee';
    ctx.shadowBlur  = 10;
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 140);
    ctx.restore();
  }

  // ── Drawing helpers ────────────────────────────────────────────────────────
  function _drawCircle(ctx, c, alphaScale) {
    const frac  = Math.max(c.life / c.maxLife, 0);
    const alpha = frac * alphaScale;

    ctx.save();
    ctx.globalAlpha = Math.min(alpha + 0.1, alphaScale);

    // Outer glow
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 24;

    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.min(0.6 * alphaScale, alphaScale);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  function _drawLives(ctx, n) {
    ctx.save();
    ctx.font         = '26px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'right';
    const heartSpacing = 30;
    for (let i = 0; i < MAX_LIVES; i++) {
      const x = VW - 14 - i * heartSpacing;
      ctx.fillStyle   = i < n ? '#ff2d78' : '#3a1a2a';
      ctx.shadowColor = i < n ? '#ff2d78' : 'transparent';
      ctx.shadowBlur  = i < n ? 10 : 0;
      ctx.fillText('♥', x, 18);
    }
    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r,          r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y,     x + r, y,              r);
    ctx.closePath();
  }

  function getScore() { return score; }
  function getState() { return state; }
  function getBest()  { return best; }
  return { init, update, draw, tap, getScore, getState, getBest };
})();
