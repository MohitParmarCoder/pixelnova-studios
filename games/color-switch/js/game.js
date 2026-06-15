'use strict';

const ColorSwitch = (() => {
  // ── Constants ────────────────────────────────────────────────────────────────
  const VW = 390, VH = 844;
  const GRAVITY      = 500;   // px/s²
  const TAP_IMPULSE  = -360;  // px/s  (negative = up)
  const BALL_R       = 15;
  const RING_OUTER   = 70;
  const RING_INNER   = 40;
  const RING_SPACING = 290;   // world-units between ring centres
  const BASE_ROT_SPD = 1.1;   // rad/s
  const BASE_SCROLL  = 55;    // px/s – how fast world scrolls when ball is still
  const BALL_SCREEN_Y = 500;  // where ball appears on screen (fixed)

  const COLORS = ['#FF3366', '#00CCFF', '#FFCC00', '#00FF88'];
  const GLOW   = ['#FF0044', '#00AAFF', '#FFAA00', '#00DD66'];
  const COLOR_NAMES = ['red', 'blue', 'yellow', 'green'];

  const STORAGE_BEST = 'colorswitch_best';

  // ── State ────────────────────────────────────────────────────────────────────
  let canvas, ctx;
  let state = 'MENU'; // MENU | PLAYING | DEAD

  // Ball
  let ball = { worldY: 0, vy: 0, colorIdx: 0 };

  // Camera – tracks ball world position
  let cameraY = 0;

  // Obstacles (rings)
  let rings = [];

  // Score
  let score    = 0;
  let bestScore = 0;

  // Particles
  let particles = [];

  // Blink timer
  let blinkTimer = 0;
  let blinkOn    = true;

  // Preview ring for menu
  let menuRingRot = 0;

  // Death overlay alpha
  let deadAlpha = 0;

  // Safe-arc flash timer (visual feedback when passing through)
  let flashTimer = 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rng(lo, hi)      { return lo + Math.random() * (hi - lo); }

  function loadBest() {
    try { bestScore = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10) || 0; } catch(e) {}
  }
  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem(STORAGE_BEST, String(bestScore)); } catch(e) {}
    }
  }

  // ── Ring helpers ─────────────────────────────────────────────────────────────
  function makeRing(worldY, safeColorIdx) {
    const safe = (safeColorIdx !== undefined)
      ? safeColorIdx
      : Math.floor(Math.random() * 4);
    return {
      worldY,
      rot: Math.random() * Math.PI * 2,
      safeColor: safe,
      passed: false,
      // shuffle arc order so safe arc isn't always at the same position
      // The 4 arcs cover [0..PI/2], [PI/2..PI], [PI..3PI/2], [3PI/2..2PI]
      // We assign colors to each quadrant (arc 0=top, 1=right, 2=bottom, 3=left)
      // After rotation, we recalculate which colour covers which angle
    };
  }

  function spawnInitialRings() {
    rings = [];
    // Place first ring 500 units above ball start (higher up = negative world Y here).
    // Ball worldY starts at 0, we track upward as negative worldY.
    // Obstacles start above the ball which means negative worldY values.
    // We place them at worldY = -500, -790, -1080 so 3 are visible right away.
    rings.push(makeRing(-500,  Math.floor(Math.random() * 4)));
    rings.push(makeRing(-790,  Math.floor(Math.random() * 4)));
    rings.push(makeRing(-1080, Math.floor(Math.random() * 4)));
  }

  // Ensure rings ahead of ball
  function maintainRings() {
    // Highest ring (most negative worldY = furthest above camera)
    const highest = rings.reduce((m, r) => r.worldY < m ? r.worldY : m, Infinity);
    // Spawn new rings until we have at least 4 rings ahead of camera top
    const cameraTop = cameraY - BALL_SCREEN_Y; // world Y of top of screen
    while (rings.length < 5 || highest > cameraTop - RING_SPACING) {
      const top = rings.reduce((m, r) => r.worldY < m ? r.worldY : m, Infinity);
      rings.push(makeRing(top - RING_SPACING, Math.floor(Math.random() * 4)));
      break; // one at a time is fine since we call each frame
    }
  }

  // Remove rings that have scrolled off the bottom of the screen
  function pruneRings() {
    const screenBottom = cameraY + (VH - BALL_SCREEN_Y) + 200;
    rings = rings.filter(r => r.worldY < screenBottom);
  }

  // World Y → screen Y
  function toScreenY(worldY) {
    return worldY - cameraY + BALL_SCREEN_Y;
  }

  // ── Collision ────────────────────────────────────────────────────────────────
  // Arc layout: 4 arcs each spanning PI/2.
  // Arc i spans from (rot + i * PI/2) to (rot + (i+1) * PI/2)
  // Colors assigned to arcs:
  //   Arc 0 → safeColor
  //   Arc 1 → (safeColor+1)%4
  //   Arc 2 → (safeColor+2)%4
  //   Arc 3 → (safeColor+3)%4
  // So arc 0 is safe, rest are danger.

  function arcColorAt(ring, angle) {
    // Normalise angle relative to ring rotation into [0, 2PI)
    let rel = ((angle - ring.rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const arcIdx = Math.floor(rel / (Math.PI / 2)) % 4; // 0..3
    return (ring.safeColor + arcIdx) % 4;
  }

  function checkCollision(ring) {
    const sx = VW / 2;          // ball screen X
    const sy = BALL_SCREEN_Y;   // ball screen Y (fixed)
    const ry = toScreenY(ring.worldY);
    const dx = sx - VW / 2;
    const dy = sy - ry;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Ball overlaps the ring annulus?
    if (dist < RING_INNER - BALL_R || dist > RING_OUTER + BALL_R) return false;
    // More precise: ball centre is within ring band
    if (dist < RING_INNER || dist > RING_OUTER) {
      // Edge of ball touches — use ball circle vs ring band
      if (dist + BALL_R < RING_INNER || dist - BALL_R > RING_OUTER) return false;
    }

    const angle = Math.atan2(dy, dx);
    const hitColor = arcColorAt(ring, angle);
    return hitColor !== ball.colorIdx;
  }

  function checkScoring(ring) {
    if (ring.passed) return false;
    // Ball passes ring centre when ball screen Y < ring screen Y
    const ry = toScreenY(ring.worldY);
    if (BALL_SCREEN_Y < ry) {
      ring.passed = true;
      return true;
    }
    return false;
  }

  // ── Particles ────────────────────────────────────────────────────────────────
  function spawnParticles(x, y, colorIdx) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rng(60, 200);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: rng(1.5, 3.0),
        r: rng(3, 7),
        color: COLORS[colorIdx],
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 150 * dt; // gravity
      p.vx   *= 0.97;
      p.life -= p.decay * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  // ── Difficulty ───────────────────────────────────────────────────────────────
  function diffLevel() {
    return Math.floor(score / 5);
  }

  function rotSpeed() {
    return BASE_ROT_SPD + diffLevel() * 0.18;
  }

  // ── Init / Reset ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx    = c.getContext('2d');
    loadBest();
    state = 'MENU';
  }

  function resetGame() {
    ball      = { worldY: 0, vy: 0, colorIdx: 0 };
    cameraY   = 0;
    score     = 0;
    particles = [];
    flashTimer = 0;
    deadAlpha  = 0;
    spawnInitialRings();
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  function update(dt) {
    blinkTimer += dt;
    if (blinkTimer > 0.55) { blinkTimer = 0; blinkOn = !blinkOn; }

    if (state === 'MENU') {
      menuRingRot += 0.8 * dt;
      return;
    }

    if (state === 'DEAD') {
      deadAlpha = Math.min(1, deadAlpha + dt * 2);
      updateParticles(dt);
      return;
    }

    // PLAYING
    flashTimer = Math.max(0, flashTimer - dt);

    // Physics
    ball.vy    += GRAVITY * dt;
    ball.worldY += ball.vy * dt;

    // Camera: keep ball at BALL_SCREEN_Y
    cameraY = ball.worldY;

    // Maintain ring supply
    maintainRings();
    pruneRings();

    // Rotate rings
    const rs = rotSpeed();
    for (const ring of rings) {
      ring.rot += rs * dt;
    }

    // Score + collision
    for (const ring of rings) {
      if (!ring.passed) {
        if (checkScoring(ring)) {
          score++;
          flashTimer = 0.25;
          Audio.play('score');
          spawnParticles(VW / 2, toScreenY(ring.worldY), ball.colorIdx);
        }
        // Collision only for rings in dangerous proximity
        const ry = toScreenY(ring.worldY);
        if (ry > -RING_OUTER - 10 && ry < VH + RING_OUTER + 10) {
          if (checkCollision(ring)) {
            die();
            return;
          }
        }
      }
    }

    updateParticles(dt);
  }

  function die() {
    saveBest();
    state = 'DEAD';
    Audio.play('lose');
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
  }

  // ── Tap ──────────────────────────────────────────────────────────────────────
  function tap() {
    if (state === 'MENU') {
      resetGame();
      return;
    }
    if (state === 'DEAD') {
      resetGame();
      return;
    }
    // PLAYING
    ball.vy = TAP_IMPULSE;
    ball.colorIdx = (ball.colorIdx + 1) % 4;
    Audio.play('tap');
  }

  // ── Draw helpers ─────────────────────────────────────────────────────────────
  function drawRing(x, y, ring, alpha) {
    const SEGMENTS = 4;
    const step = (Math.PI * 2) / SEGMENTS;
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    for (let i = 0; i < SEGMENTS; i++) {
      const colorIdx = (ring.safeColor + i) % 4;
      const startAngle = ring.rot + i * step;
      const endAngle   = startAngle + step;

      // Draw thick arc
      ctx.beginPath();
      ctx.arc(x, y, RING_OUTER, startAngle, endAngle);
      ctx.arc(x, y, RING_INNER, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = COLORS[colorIdx];
      ctx.shadowColor = COLORS[colorIdx];
      ctx.shadowBlur  = 8;
      ctx.fill();
    }

    // Gap lines (thin black lines between arcs)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = ring.rot + i * step;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * RING_INNER, y + Math.sin(angle) * RING_INNER);
      ctx.lineTo(x + Math.cos(angle) * RING_OUTER, y + Math.sin(angle) * RING_OUTER);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBall() {
    const x = VW / 2;
    const y = BALL_SCREEN_Y;
    const col  = COLORS[ball.colorIdx];
    const glow = GLOW[ball.colorIdx];

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 24;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    // Inner bright highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x - BALL_R * 0.3, y - BALL_R * 0.3, BALL_R * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawScore(x, y, size, col) {
    ctx.save();
    ctx.font         = `bold ${size}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = col || '#fff';
    ctx.shadowColor  = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur   = 12;
    ctx.fillText(String(score), x, y);
    ctx.restore();
  }

  function drawText(text, x, y, size, col, align) {
    ctx.save();
    ctx.font         = `bold ${size}px Arial, sans-serif`;
    ctx.textAlign    = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = col || '#fff';
    ctx.shadowColor  = col || '#fff';
    ctx.shadowBlur   = 10;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Draw star field (subtle background detail)
  let stars = null;
  function ensureStars() {
    if (stars) return;
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x:    Math.random() * VW,
        y:    Math.random() * VH,
        r:    Math.random() * 1.5 + 0.3,
        a:    Math.random() * 0.5 + 0.1,
      });
    }
  }
  function drawStars() {
    ensureStars();
    ctx.save();
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Draw: MENU ───────────────────────────────────────────────────────────────
  function drawMenu() {
    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    // Animated ring preview
    const rx = VW / 2, ry = 380;
    drawRing(rx, ry, { rot: menuRingRot, safeColor: 0 });

    // Title: "COLOR" – each letter a different colour
    const titleWord1 = 'COLOR';
    const titleWord2 = 'SWITCH';
    const letterSize = 62;
    ctx.save();
    ctx.font         = `900 ${letterSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    // Measure to centre
    const totalW1 = titleWord1.split('').reduce((acc, ch) => {
      ctx.font = `900 ${letterSize}px Arial, sans-serif`;
      return acc + ctx.measureText(ch).width;
    }, 0);
    let lx = VW / 2 - totalW1 / 2;
    titleWord1.split('').forEach((ch, i) => {
      ctx.font      = `900 ${letterSize}px Arial, sans-serif`;
      ctx.fillStyle = COLORS[i % 4];
      ctx.shadowColor = COLORS[i % 4];
      ctx.shadowBlur  = 16;
      const w = ctx.measureText(ch).width;
      ctx.fillText(ch, lx + w / 2, 180);
      lx += w;
    });

    ctx.font      = `900 ${letterSize}px Arial, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#aaa';
    ctx.shadowBlur  = 10;
    ctx.textAlign = 'center';
    ctx.fillText(titleWord2, VW / 2, 255);
    ctx.restore();

    // Subtitle
    drawText('Match the color to pass!', VW / 2, 320, 18, '#888');

    // Color dots legend
    const dotY = 560;
    const dotSpacing = 60;
    const startX = VW / 2 - (COLORS.length - 1) * dotSpacing / 2;
    COLORS.forEach((col, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX + i * dotSpacing, dotY, 14, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 18;
      ctx.fill();
      ctx.restore();
    });
    drawText('tap to cycle ball color', VW / 2, 600, 16, '#666');

    // Best score
    if (bestScore > 0) {
      drawText(`Best: ${bestScore}`, VW / 2, 660, 22, '#aaa');
    }

    // Tap to Start
    if (blinkOn) {
      drawText('TAP TO START', VW / 2, 740, 28, '#fff');
    }
  }

  // ── Draw: PLAYING ────────────────────────────────────────────────────────────
  function drawPlaying() {
    // Flash background on successful pass
    if (flashTimer > 0) {
      const intensity = flashTimer / 0.25;
      ctx.fillStyle = `rgba(255,255,255,${0.06 * intensity})`;
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    // Draw rings
    for (const ring of rings) {
      const ry = toScreenY(ring.worldY);
      if (ry > -RING_OUTER - 5 && ry < VH + RING_OUTER + 5) {
        drawRing(VW / 2, ry, ring);
      }
    }

    drawParticles();
    drawBall();

    // Score HUD
    ctx.save();
    ctx.font         = `bold 56px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(255,255,255,0.9)';
    ctx.shadowColor  = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur   = 10;
    ctx.fillText(String(score), VW / 2, 30);
    ctx.restore();

    // Ball color indicator – small dots at top corners
    const indY = 32;
    const indX = 30;
    COLORS.forEach((col, i) => {
      const active = i === ball.colorIdx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(indX + i * 22, indY, active ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = active ? 1 : 0.35;
      ctx.shadowColor = col;
      ctx.shadowBlur  = active ? 14 : 0;
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Draw: DEAD ───────────────────────────────────────────────────────────────
  function drawDead() {
    // Draw the frozen game underneath
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    for (const ring of rings) {
      const ry = toScreenY(ring.worldY);
      if (ry > -RING_OUTER - 5 && ry < VH + RING_OUTER + 5) {
        drawRing(VW / 2, ry, ring, 0.3);
      }
    }

    drawParticles();

    // Dark overlay
    ctx.save();
    ctx.globalAlpha = deadAlpha * 0.65;
    ctx.fillStyle   = '#000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Game Over text
    ctx.save();
    ctx.globalAlpha = Math.min(1, deadAlpha * 2);
    ctx.restore();

    drawText('GAME OVER', VW / 2, 310, 52, '#FF3366');

    // Score
    ctx.save();
    ctx.font         = `bold 80px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#fff';
    ctx.shadowColor  = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur   = 20;
    ctx.fillText(String(score), VW / 2, 420);
    ctx.restore();

    drawText('SCORE', VW / 2, 370, 20, '#888');

    // Best
    if (score >= bestScore && bestScore > 0) {
      drawText('NEW BEST!', VW / 2, 490, 22, '#FFCC00');
    } else if (bestScore > 0) {
      drawText(`Best: ${bestScore}`, VW / 2, 490, 22, '#888');
    }

    // Tap to restart
    if (blinkOn) {
      drawText('TAP TO RESTART', VW / 2, 700, 28, '#fff');
    }
  }

  // ── Draw (main) ──────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    if      (state === 'MENU')    drawMenu();
    else if (state === 'PLAYING') drawPlaying();
    else if (state === 'DEAD')    drawDead();
  }

  return { init, update, draw, tap };
})();
