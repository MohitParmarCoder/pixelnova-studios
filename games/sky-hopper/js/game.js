'use strict';

/*
 * Sky Hopper — Doodle Jump style auto-bounce climber.
 * Exposes global: SkyHopper
 *   { init, update, draw, tap, setTiltX, nudge, getScore, getState, getBest }
 *
 * Virtual canvas: 390 × 844 px.
 * States: MENU → PLAYING → DEAD → PLAYING (restart via tap).
 *
 * World model
 * ───────────
 * Standard canvas Y grows downward. The character has a worldY in world-space.
 * As the character climbs, worldY decreases. The camera holds the character
 * around screen Y = CAM_ANCHOR when it rises above it, scrolling the world.
 * Score = total upward distance climbed / 10.
 */

const SkyHopper = (() => {
  // ── Virtual canvas dimensions ───────────────────────────────────────────────
  const VW = 390;
  const VH = 844;

  // ── Physics ─────────────────────────────────────────────────────────────────
  const GRAVITY      = 1400;   // px / s² downward
  const BOUNCE_V     = -720;   // px / s upward on landing
  const SPRING_V     = -1200;  // px / s upward on spring landing
  const CHAR_SIZE    = 30;     // character box size
  const CAM_ANCHOR   = 380;    // screen Y the camera keeps character near when climbing

  // ── Platforms ───────────────────────────────────────────────────────────────
  const PLAT_W       = 70;
  const PLAT_H       = 14;
  const GAP_MIN      = 90;
  const GAP_MAX      = 130;

  // Platform types
  const T_NORMAL = 0;
  const T_MOVING = 1;
  const T_SPRING = 2;

  // ── Canvas / state ──────────────────────────────────────────────────────────
  let canvas, ctx;
  let state = 'MENU';
  let _best = 0;
  let score = 0;

  // ── Character ───────────────────────────────────────────────────────────────
  let ch = { x: VW / 2, worldY: 0, vy: 0, targetX: VW / 2, face: 1 };

  // ── World ───────────────────────────────────────────────────────────────────
  let platforms = [];        // { x, worldY, type, baseX, phase, amp, w }
  let camY = 0;              // world-space Y mapped to screen top (worldY - camY = screenY)
  let highestY = 0;          // most-negative worldY reached (for scoring)
  let nextSpawnY = 0;        // worldY above which we still need to spawn platforms
  let particles = [];        // landing puffs
  let stars = [];            // parallax background stars
  let clouds = [];           // background clouds
  let time = 0;

  // ── Audio helper ────────────────────────────────────────────────────────────
  function sfx(name) {
    try { if (typeof Audio !== 'undefined' && Audio.play) Audio.play(name); } catch (e) {}
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best | 0;
    buildBackground();
    reset();
    state = 'MENU';
  }

  function buildBackground() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: rand(0.5, 1.8),
        tw: Math.random() * Math.PI * 2
      });
    }
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        s: rand(40, 90),
        a: rand(0.04, 0.10)
      });
    }
  }

  // ── Reset to a fresh playable world ─────────────────────────────────────────
  function reset() {
    score = 0;
    particles = [];
    camY = 0;
    highestY = 0;

    // Character starts near bottom, standing.
    ch.worldY = CAM_ANCHOR;     // worldY equals screenY initially (camY = 0)
    ch.x = VW / 2;
    ch.targetX = VW / 2;
    ch.vy = 0;
    ch.face = 1;

    platforms = [];

    // Starting platform directly under the character.
    platforms.push(makePlatform(VW / 2 - PLAT_W / 2, ch.worldY + CHAR_SIZE + 4, T_NORMAL));

    // Fill upward to above the top of the screen.
    nextSpawnY = ch.worldY;
    let y = ch.worldY;
    while (y > camY - VH - 200) {
      y -= rand(GAP_MIN, GAP_MAX);
      spawnPlatformAt(y);
    }
    nextSpawnY = y;
  }

  function makePlatform(x, worldY, type) {
    const p = {
      x: x,
      worldY: worldY,
      type: type,
      w: PLAT_W,
      baseX: x,
      phase: Math.random() * Math.PI * 2,
      amp: rand(30, 70),
      dir: Math.random() < 0.5 ? -1 : 1
    };
    return p;
  }

  // Spawn a platform at worldY with difficulty-scaled type.
  function spawnPlatformAt(worldY) {
    // Difficulty grows with score: more moving platforms higher up.
    const movChance = Math.min(0.10 + score * 0.0008, 0.40);
    const springChance = 0.08;
    let type = T_NORMAL;
    const r = Math.random();
    if (r < springChance) type = T_SPRING;
    else if (r < springChance + movChance) type = T_MOVING;

    const x = rand(8, VW - PLAT_W - 8);
    platforms.push(makePlatform(x, worldY, type));
  }

  // ── Public input ────────────────────────────────────────────────────────────
  function tap(x, y) {
    if (state === 'MENU') {
      sfx('button');
      reset();
      state = 'PLAYING';
      try { if (typeof AdManager !== 'undefined') AdManager.gameplayStart(); } catch (e) {}
    } else if (state === 'PLAYING') {
      // Move character toward tapped X position.
      if (x != null && !isNaN(x)) {
        const dx = x - ch.x;
        ch.x += dx * 0.6;
        ch.targetX = x;
        if (dx > 1) ch.face = 1;
        else if (dx < -1) ch.face = -1;
      }
      // Tap above the character gives an extra upward boost (optional jump).
      if (y != null && !isNaN(y)) {
        const screenY = ch.worldY - camY;
        if (y < screenY && ch.vy > 0) {
          ch.vy = BOUNCE_V;
          sfx('hop');
        }
      }
    } else if (state === 'DEAD') {
      sfx('button');
      try {
        if (typeof AdManager !== 'undefined') {
          AdManager.showInterstitial(() => {
            reset();
            state = 'PLAYING';
            try { AdManager.gameplayStart(); } catch (e) {}
          });
          return;
        }
      } catch (e) {}
      reset();
      state = 'PLAYING';
    }
  }

  // Set target virtual x (0..390). Simplest: directly set character x.
  function setTiltX(vx) {
    if (vx == null || isNaN(vx)) return;
    ch.x = Math.max(0, Math.min(VW, vx));
    ch.targetX = ch.x;
  }

  // Move character by dx px (keyboard).
  function nudge(dx) {
    if (!dx) return;
    ch.x += dx;
    ch.targetX = ch.x;
    if (dx > 0) ch.face = 1; else if (dx < 0) ch.face = -1;
  }

  // ── Game over ───────────────────────────────────────────────────────────────
  function die() {
    if (state !== 'PLAYING') return;
    state = 'DEAD';
    sfx('lose');
    if (score > _best) _best = score;
    try {
      if (typeof AdManager !== 'undefined') {
        AdManager.gameplayStop();
        AdManager.onRunEnd();
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'skyhopper_best'); } catch(e) {}
      }
    } catch (e) {}
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt) {
    if (dt > 0.05) dt = 0.05;
    time += dt;

    // Background twinkle
    for (let i = 0; i < stars.length; i++) stars[i].tw += dt * 2;

    if (state !== 'PLAYING') return;

    // Move moving platforms.
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (p.type === T_MOVING) {
        p.x = p.baseX + Math.sin(time * 1.6 + p.phase) * p.amp;
        // keep on screen-ish
        if (p.x < 4) p.x = 4;
        if (p.x > VW - p.w - 4) p.x = VW - p.w - 4;
      }
    }

    // Apply gravity.
    ch.vy += GRAVITY * dt;
    const prevBottom = ch.worldY + CHAR_SIZE;
    ch.worldY += ch.vy * dt;
    const newBottom = ch.worldY + CHAR_SIZE;

    // Horizontal ease toward target (gives smoother drag, but mostly direct).
    // setTiltX already set x; keep face based on movement done by nudge.

    // Horizontal wrap.
    if (ch.x < -15) ch.x = VW + 15;
    else if (ch.x > VW + 15) ch.x = -15;

    // Landing detection: only when falling (vy > 0), test downward crossing.
    if (ch.vy > 0) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const px = p.x;
        // Simple AABB horizontal overlap of character box vs platform.
        const charLeft = ch.x - CHAR_SIZE / 2;
        const charRight = ch.x + CHAR_SIZE / 2;
        const hOverlap = charRight > px && charLeft < px + p.w;
        if (!hOverlap) continue;
        const top = p.worldY;
        // Character bottom crossed the platform top this frame.
        if (prevBottom <= top + 8 && newBottom >= top) {
          // Land + bounce.
          ch.worldY = top - CHAR_SIZE;
          if (p.type === T_SPRING) {
            ch.vy = SPRING_V;
            sfx('power');
            spawnPuff(ch.x, top, '#FFCC00');
          } else {
            ch.vy = BOUNCE_V;
            sfx('hop');
            spawnPuff(ch.x, top, '#00FF88');
          }
          break;
        }
      }
    }

    // Camera: when character rises above anchor, scroll world.
    const screenY = ch.worldY - camY;
    if (screenY < CAM_ANCHOR) {
      const scroll = CAM_ANCHOR - screenY;
      camY -= scroll; // move camera up (camY decreases as we climb)
    }

    // Track highest climb for score.
    if (ch.worldY < highestY) {
      highestY = ch.worldY;
      const newScore = Math.floor((CAM_ANCHOR - highestY) / 10);
      if (newScore > score) {
        score = newScore;
        // periodic score blip
      }
    }

    // Spawn new platforms above as camera climbs.
    const spawnCeiling = camY - 200; // a bit above top of screen
    while (nextSpawnY > spawnCeiling) {
      nextSpawnY -= rand(GAP_MIN, GAP_MAX);
      spawnPlatformAt(nextSpawnY);
    }

    // Cull platforms that fell below the screen.
    const cullBelow = camY + VH + 60;
    if (platforms.length > 64) {
      platforms = platforms.filter(p => p.worldY < cullBelow);
    }

    // Update particles.
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 400 * dt;
      if (q.life <= 0) particles.splice(i, 1);
    }

    // Game over: fell below the bottom of the screen.
    if ((ch.worldY - camY) > VH + CHAR_SIZE) {
      die();
    }
  }

  function spawnPuff(x, worldY, color) {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: x,
        y: worldY - camY,
        vx: rand(-80, 80),
        vy: rand(-40, 40),
        life: rand(0.25, 0.5),
        color: color
      });
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a1228');
    g.addColorStop(1, '#1a2550');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    drawClouds();
    drawStars();

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawPlatforms();
    drawParticles();
    drawCharacter();
    drawHud();

    if (state === 'DEAD') drawDead();
  }

  function drawStars() {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const a = 0.4 + 0.4 * Math.sin(s.tw);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe3ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds() {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#9fb8ff';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.s, c.s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlatforms() {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const sy = p.worldY - camY;
      if (sy < -PLAT_H - 20 || sy > VH + 20) continue;

      let col, glow;
      if (p.type === T_MOVING) { col = '#00E5FF'; glow = 'rgba(0,229,255,0.6)'; }
      else if (p.type === T_SPRING) { col = '#2BE36B'; glow = 'rgba(43,227,107,0.6)'; }
      else { col = '#3DDC84'; glow = 'rgba(61,220,132,0.5)'; }

      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      roundRect(p.x, sy, p.w, PLAT_H, 6);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(p.x + 4, sy + 2, p.w - 8, 3, 2);
      ctx.fill();

      // Spring icon
      if (p.type === T_SPRING) drawSpring(p.x + p.w / 2, sy);
    }
  }

  function drawSpring(cx, topY) {
    ctx.save();
    ctx.strokeStyle = '#FFCC00';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255,204,0,0.8)';
    ctx.shadowBlur = 8;
    const baseY = topY - 2;
    const h = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 5, baseY);
    let yy = baseY;
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      yy -= h / steps;
      ctx.lineTo(cx + (i % 2 === 0 ? 5 : -5), yy);
    }
    ctx.stroke();
    // top cap
    ctx.fillStyle = '#FFCC00';
    ctx.fillRect(cx - 6, topY - h - 4, 12, 3);
    ctx.restore();
  }

  function drawCharacter() {
    const sx = ch.x;
    const sy = ch.worldY - camY;
    ctx.save();

    // Squash/stretch hint based on velocity.
    const stretch = Math.max(-0.18, Math.min(0.18, -ch.vy / 4000));
    const w = CHAR_SIZE * (1 - stretch);
    const h = CHAR_SIZE * (1 + stretch);

    ctx.shadowColor = 'rgba(0,255,136,0.8)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#00FF88';
    roundRect(sx - w / 2, sy + (CHAR_SIZE - h), w, h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Body gradient sheen
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(sx - w / 2 + 3, sy + (CHAR_SIZE - h) + 3, w - 6, 6, 4);
    ctx.fill();

    // Eyes
    const eyeY = sy + CHAR_SIZE * 0.42;
    ctx.fillStyle = '#0a1228';
    ctx.beginPath();
    ctx.arc(sx - 5 + (ch.face > 0 ? 2 : 0), eyeY, 3.4, 0, Math.PI * 2);
    ctx.arc(sx + 5 + (ch.face > 0 ? 2 : 0), eyeY, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx - 5 + (ch.face > 0 ? 2 : 0) - 1, eyeY - 1, 1, 0, Math.PI * 2);
    ctx.arc(sx + 5 + (ch.face > 0 ? 2 : 0) - 1, eyeY - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw wrap ghost when near edges so it reads as continuous.
    if (sx < CHAR_SIZE) drawGhost(sx + VW, sy);
    else if (sx > VW - CHAR_SIZE) drawGhost(sx - VW, sy);
  }

  function drawGhost(sx, sy) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#00FF88';
    roundRect(sx - CHAR_SIZE / 2, sy, CHAR_SIZE, CHAR_SIZE, 8);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      ctx.globalAlpha = Math.max(0, q.life * 2);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(String(score), 16, 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('BEST ' + Math.max(_best, score), VW - 16, 20);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    // Decorative platform + character preview.
    const bob = Math.sin(time * 2) * 8;
    // floating platform
    ctx.shadowColor = 'rgba(61,220,132,0.5)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#3DDC84';
    roundRect(VW / 2 - 45, 470, 90, 16, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    // character
    drawMenuChar(VW / 2, 470 - CHAR_SIZE + bob);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00FF88';
    ctx.shadowColor = 'rgba(0,255,136,0.6)';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText('SKY', VW / 2, 230);
    ctx.fillText('HOPPER', VW / 2, 290);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('Bounce as high as you can!', VW / 2, 360);

    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FFCC00';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 600);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('BEST ' + _best, VW / 2, 650);

    ctx.textAlign = 'left';
  }

  function drawMenuChar(cx, cy) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,255,136,0.8)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#00FF88';
    roundRect(cx - CHAR_SIZE / 2, cy, CHAR_SIZE, CHAR_SIZE, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a1228';
    ctx.beginPath();
    ctx.arc(cx - 5, cy + 13, 3.4, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy + 13, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(5,8,20,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF3366';
    ctx.shadowColor = 'rgba(255,51,102,0.6)';
    ctx.shadowBlur = 16;
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText('GAME OVER', VW / 2, 280);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText('Score ' + score, VW / 2, 370);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText('Best ' + _best, VW / 2, 415);

    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FFCC00';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 540);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
  }

  // ── Draw helpers ────────────────────────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ── Public accessors ────────────────────────────────────────────────────────
  function getScore() { return score; }
  function getState() { return state; }
  function getBest() { return Math.max(_best, score); }

  return {
    init, update, draw, tap, setTiltX, nudge,
    getScore, getState, getBest
  };
})();
