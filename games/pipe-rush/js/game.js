'use strict';

/* ============================================================
   Pipe Rush — Flappy meets Color Switch
   Virtual canvas: 390 × 844
   Exposed global: PipeRush
   ============================================================ */
const PipeRush = (() => {
  const VW = 390, VH = 844;

  const GRAVITY = 900;
  const FLAP = -380;
  const ORB_X = 90, ORB_R = 18;

  const PIPE_W = 52, GAP_H = 155;
  const PIPE_SPD0 = 200, PIPE_SPD_MAX = 320;
  const SPAWN_DX = 260;

  const COLORS = ['#00AAFF', '#00FF66', '#FFDD00', '#FF3355'];

  let _canvas, _ctx;
  let _state;       // 'MENU' | 'PLAYING' | 'DEAD'
  let _best = 0;
  let _score;
  let _orbY, _orbVY, _orbColor;
  let _pipes;       // {x, gapTop, color, passed}
  let _distSinceSpawn;
  let _stars;
  let _particles;
  let _pulseT;
  let _deathMsg;

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
    for (let i = 0; i < 70; i++) s.push({ x: Math.random() * VW, y: Math.random() * VH, r: Math.random() * 1.5 + 0.3, tw: Math.random() * Math.PI * 2 });
    return s;
  }

  function _reset() {
    _score = 0;
    _orbY = VH / 2;
    _orbVY = 0;
    _orbColor = 0;
    _pipes = [];
    _distSinceSpawn = SPAWN_DX; // spawn immediately
    _particles = [];
    _pulseT = 0;
    _deathMsg = '';
  }

  function _snd(n) { try { Audio.play(n); } catch (e) {} }

  function _pipeSpeed() { return Math.min(PIPE_SPD_MAX, PIPE_SPD0 + _score * 8); }

  function tap() {
    if (_state === 'MENU') { _reset(); _state = 'PLAYING'; AdManager.gameplayStart(); _flap(); return; }
    if (_state === 'DEAD') { AdManager.showInterstitial(() => { _reset(); _state = 'PLAYING'; AdManager.gameplayStart(); _flap(); }); return; }
    if (_state === 'PLAYING') _flap();
  }

  function _flap() {
    _orbVY = FLAP;
    _orbColor = (_orbColor + 1) % COLORS.length;
    _snd('flip');
  }

  function _spawnPipe() {
    const gapTop = 120 + Math.random() * (VH - 120 - GAP_H - 160);
    _pipes.push({ x: VW + PIPE_W, gapTop, color: (Math.random() * COLORS.length) | 0, passed: false });
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    _pulseT += dt;
    for (const s of _stars) s.tw += dt * 1.5;
    _advanceParticles(dt);

    if (_state === 'MENU') {
      // gentle bobbing orb
      _orbY = VH / 2 + Math.sin(_pulseT * 2) * 30;
      return;
    }
    if (_state === 'DEAD') return;

    // PLAYING
    _orbVY += GRAVITY * dt;
    _orbY += _orbVY * dt;

    if (_orbY < ORB_R) { _orbY = ORB_R; _orbVY = 0; _deathMsg = 'OUT OF BOUNDS'; _die(); return; }
    if (_orbY > VH - ORB_R) { _deathMsg = 'OUT OF BOUNDS'; _die(); return; }

    const spd = _pipeSpeed();
    _distSinceSpawn += spd * dt;
    if (_distSinceSpawn >= SPAWN_DX) { _distSinceSpawn = 0; _spawnPipe(); }

    for (let i = _pipes.length - 1; i >= 0; i--) {
      const p = _pipes[i];
      p.x -= spd * dt;

      // passing the orb plane
      if (!p.passed && p.x + PIPE_W < ORB_X - ORB_R) {
        p.passed = true;
        if (p.color === _orbColor) {
          _score++;
          _burst(ORB_X, _orbY, COLORS[_orbColor], 10);
          _snd('score');
        } else {
          _deathMsg = 'WRONG COLOR';
          _die();
          return;
        }
      }

      // physical overlap with pipe body (when colour mismatched OR in the wall)
      if (ORB_X + ORB_R > p.x && ORB_X - ORB_R < p.x + PIPE_W) {
        const inGap = _orbY - ORB_R > p.gapTop && _orbY + ORB_R < p.gapTop + GAP_H;
        if (!inGap) {
          _deathMsg = 'CRASH';
          _die();
          return;
        }
        // inside gap but wrong colour → block (treated as wrong colour on the ring)
        if (p.color !== _orbColor && !p.passed && ORB_X + ORB_R > p.x + PIPE_W - 6) {
          _deathMsg = 'WRONG COLOR';
          _die();
          return;
        }
      }

      if (p.x + PIPE_W < -20) _pipes.splice(i, 1);
    }
  }

  function _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 150;
      _particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, t: 0, color, r: 2 + Math.random() * 2 });
    }
  }

  function _advanceParticles(dt) {
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.t += dt;
      if (p.t >= p.life) { _particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  function _die() {
    _state = 'DEAD';
    _burst(ORB_X, _orbY, COLORS[_orbColor], 16);
    if (_score > _best) _best = _score;
    _snd('crash');
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score || 0, 'piperush_best'); } catch(e) {}
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────
  function draw() {
    if (!_ctx) return;
    const ctx = _ctx;
    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, VW, VH);
    _drawStars(ctx);

    for (const p of _pipes) _drawPipe(ctx, p);
    _drawParticles(ctx);
    _drawOrb(ctx);

    if (_state === 'MENU') { _drawMenu(ctx); return; }

    _text(ctx, String(_score), VW / 2, 70, 46, '#ffffff', 'center', COLORS[_orbColor]);

    // color legend dots
    for (let i = 0; i < COLORS.length; i++) {
      const x = VW / 2 - 36 + i * 24;
      ctx.globalAlpha = i === _orbColor ? 1 : 0.3;
      ctx.fillStyle = COLORS[i];
      ctx.beginPath(); ctx.arc(x, 120, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (_state === 'DEAD') _drawDead(ctx);
  }

  function _drawStars(ctx) {
    for (const s of _stars) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.sin(s.tw);
      ctx.fillStyle = '#90a0d0';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawPipe(ctx, p) {
    const col = COLORS[p.color];
    ctx.fillStyle = '#1a2035';
    // top
    ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
    // bottom
    ctx.fillRect(p.x, p.gapTop + GAP_H, PIPE_W, VH - (p.gapTop + GAP_H));
    // glowing colored rings at gap edges
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.strokeStyle = col; ctx.lineWidth = 5;
    ctx.strokeRect(p.x, 0, PIPE_W, p.gapTop);
    ctx.strokeRect(p.x, p.gapTop + GAP_H, PIPE_W, VH - (p.gapTop + GAP_H));
    ctx.shadowBlur = 0;
  }

  function _drawOrb(ctx) {
    const col = COLORS[_orbColor];
    ctx.shadowColor = col; ctx.shadowBlur = 24;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(ORB_X, _orbY, ORB_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(ORB_X - 5, _orbY - 5, ORB_R * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  function _drawParticles(ctx) {
    for (const p of _particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _drawMenu(ctx) {
    _text(ctx, 'PIPE', VW / 2, 300, 64, '#00AAFF', 'center', '#00AAFF');
    _text(ctx, 'RUSH', VW / 2, 366, 64, '#FF3355', 'center', '#FF3355');
    if (_best > 0) _text(ctx, 'BEST: ' + _best, VW / 2, 430, 22, '#9aa', 'center');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO FLY', VW / 2, 560, 28, '#ffffff', 'center', '#00FF66');
    ctx.globalAlpha = 1;
    _text(ctx, 'Each tap flaps + changes color', VW / 2, 620, 16, '#778', 'center');
    _text(ctx, 'Match the pipe color to pass!', VW / 2, 646, 16, '#778', 'center');
  }

  function _drawDead(ctx) {
    ctx.fillStyle = 'rgba(6,6,18,0.8)';
    ctx.fillRect(0, 0, VW, VH);
    _text(ctx, _deathMsg || 'GAME OVER', VW / 2, 340, 40, '#FF3355', 'center', '#FF3355');
    _text(ctx, 'SCORE: ' + _score, VW / 2, 410, 30, '#ffffff', 'center');
    _text(ctx, 'BEST: ' + _best, VW / 2, 452, 22, '#FFDD00', 'center', '#FFDD00');
    const pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.2);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 26, '#00AAFF', 'center', '#00AAFF');
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

  function getScore() { return _score; }
  function getState() { return _state; }
  function getBest()  { return _best; }

  return { init, update, draw, tap, getScore, getState, getBest };
})();
