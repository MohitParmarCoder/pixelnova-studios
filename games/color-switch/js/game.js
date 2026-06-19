'use strict';

/*
 * Color Switch — game module
 * Exposes global: ColorSwitch  { init, update, draw, tap }
 *
 * Virtual canvas: 390 × 844 px
 * States: MENU → PLAYING → DEAD → PLAYING (restart)
 *
 * Physics model
 * ─────────────
 * The ball has a worldY that increases downward (standard canvas Y-axis).
 * Gravity pulls the ball downward (positive worldY direction).
 * Tapping gives an upward impulse (negative vy).
 * The camera tracks the ball so the ball always appears at BALL_SCREEN_Y.
 *
 * Obstacle rings
 * ──────────────
 * Rings have worldY positions. They are stationary in world-space.
 * As the ball moves upward (worldY decreasing), rings appear to scroll down.
 * Rings are placed every RING_SPACING units above the ball's start position.
 * "Above" in world-space = lower worldY value (more negative).
 *
 * Ring collision
 * ──────────────
 * Each ring is divided into 4 coloured arcs, each 90°.
 * Arc 0 is the "safe" arc (matches some colour index 0-3).
 * Arc 1-3 are danger arcs.
 * The ball's centre sits at (VW/2, BALL_SCREEN_Y) on screen.
 * The ring centre sits at (VW/2, toScreenY(ring.worldY)).
 * dx is always 0 (both centred horizontally).
 * The angle from ring centre to ball is therefore exactly -PI/2 (up) or +PI/2 (down).
 * We account for ring rotation when determining which arc is at that angle.
 */

const ColorSwitch = (() => {
  // ── Virtual canvas dimensions ────────────────────────────────────────────────
  const VW = 390;
  const VH = 844;

  // ── Physics constants ────────────────────────────────────────────────────────
  const GRAVITY     = 520;   // px / s²  (downward)
  const TAP_IMPULSE = -360;  // px / s   (upward burst on tap)

  // ── Ring geometry ────────────────────────────────────────────────────────────
  const RING_OUTER   = 70;   // outer radius px
  const RING_INNER   = 42;   // inner radius px
  const RING_SPACING = 290;  // world-units between consecutive ring centres

  // ── Ball ─────────────────────────────────────────────────────────────────────
  const BALL_R       = 15;       // ball radius px
  const BALL_SCREEN_Y = 520;     // fixed screen Y where ball is drawn

  // ── Difficulty ───────────────────────────────────────────────────────────────
  const BASE_ROT_SPEED = 1.0;    // ring rotation rad/s at score 0
  const ROT_PER_LEVEL  = 0.20;   // extra rad/s every LEVEL_STEP score points
  const LEVEL_STEP     = 5;

  // ── Colour palette ───────────────────────────────────────────────────────────
  const COLORS = ['#FF3366', '#00CCFF', '#FFCC00', '#00FF88'];
  const GLOW   = ['#FF0044', '#00AAFF', '#FFAA00', '#00CC66'];

  // ── localStorage key ─────────────────────────────────────────────────────────
  const KEY_BEST = 'colorswitch_best';

  // ── Module state ─────────────────────────────────────────────────────────────
  let canvas, ctx;

  let state = 'MENU'; // 'MENU' | 'PLAYING' | 'DEAD'

  // Ball state
  let ballWorldY  = 0;   // world Y of ball centre (increases downward)
  let ballVY      = 0;   // vertical velocity (positive = downward)
  let ballColorIdx = 0;  // 0-3

  // Camera: ball always at BALL_SCREEN_Y on screen
  // screenY(worldY) = worldY - cameraY + BALL_SCREEN_Y
  // cameraY = ballWorldY  (so ball screenY = 0 - 0 + BALL_SCREEN_Y = BALL_SCREEN_Y ✓)
  let cameraY = 0;

  // Rings
  let rings = [];

  // Particles
  let particles = [];

  // Scores
  let score     = 0;
  let bestScore = 0;
  let _isNewBest = false;

  // UI timers
  let blinkTimer = 0;
  let blinkOn    = true;

  // Menu animated ring rotation
  let menuRot = 0;

  // Death overlay animation
  let deadOverlayAlpha = 0;

  // Flash-on-score timer
  let scoreFlashTimer = 0;

  // Star field (generated once)
  let stars = null;

  // ── Utilities ────────────────────────────────────────────────────────────────
  function rng(lo, hi) { return lo + Math.random() * (hi - lo); }

  function toScreenY(worldY) {
    return worldY - cameraY + BALL_SCREEN_Y;
  }

  function loadBest() {
    try { bestScore = parseInt(localStorage.getItem(KEY_BEST) || '0', 10) || 0; }
    catch (e) { bestScore = 0; }
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem(KEY_BEST, String(bestScore)); } catch (e) {}
    }
  }

  // ── Star field ───────────────────────────────────────────────────────────────
  function buildStars() {
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.45 + 0.08,
      });
    }
  }

  function drawStars() {
    if (!stars) buildStars();
    ctx.save();
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Ring factory ─────────────────────────────────────────────────────────────
  function makeRing(worldY) {
    return {
      worldY,
      rot:       Math.random() * Math.PI * 2,   // starting rotation
      safeColor: Math.floor(Math.random() * 4), // colour index of safe arc
      passed:    false,
      // prevBallBelow: track previous frame ball-below-ring state for scoring
      prevBallBelow: true, // ball starts below rings
    };
  }

  // ── Ring pool management ─────────────────────────────────────────────────────
  function spawnInitialRings() {
    rings = [];
    // Place 4 rings above ball starting position.
    // Ball starts at worldY = 0. Rings above = lower worldY values.
    // First ring 480 units above (worldY = -480), then every RING_SPACING.
    for (let i = 0; i < 4; i++) {
      rings.push(makeRing(-(480 + i * RING_SPACING)));
    }
  }

  function maintainRings() {
    if (rings.length === 0) { spawnInitialRings(); return; }

    // Find the highest ring (most negative worldY = furthest above camera)
    let highestY = rings[0].worldY;
    for (const r of rings) {
      if (r.worldY < highestY) highestY = r.worldY;
    }

    // Keep spawning until there are rings at least 2 screen-heights above camera top
    const cameraTopWorld = cameraY - BALL_SCREEN_Y;      // world Y of top of screen
    const spawnThreshold = cameraTopWorld - RING_SPACING; // one ring-gap above top

    while (highestY > spawnThreshold) {
      const newY = highestY - RING_SPACING;
      rings.push(makeRing(newY));
      highestY = newY;
    }
  }

  function pruneRings() {
    // Remove rings that have scrolled more than 200px below the bottom of the screen
    const worldBottom = cameraY + (VH - BALL_SCREEN_Y) + 200;
    rings = rings.filter(r => r.worldY <= worldBottom);
  }

  // ── Arc colour at a world angle ──────────────────────────────────────────────
  /*
   * Ring has 4 arcs, each spanning PI/2.
   * Arc 0 starts at ring.rot and covers [rot, rot+PI/2).
   * Arc i covers [rot + i*PI/2, rot + (i+1)*PI/2).
   * Arc 0 has colour ring.safeColor.
   * Arc i has colour (safeColor + i) % 4.
   *
   * Given a world angle (atan2 from ring centre to query point),
   * compute which arc covers that angle, then return its colour.
   */
  function arcColorAt(ring, angle) {
    const TWO_PI = Math.PI * 2;
    const HALF_PI = Math.PI / 2;
    // Normalise angle relative to ring.rot into [0, 2PI)
    let rel = ((angle - ring.rot) % TWO_PI + TWO_PI) % TWO_PI;
    const arcIdx = Math.floor(rel / HALF_PI) % 4; // 0, 1, 2, or 3
    return (ring.safeColor + arcIdx) % 4;
  }

  // ── Collision detection ──────────────────────────────────────────────────────
  /*
   * The ball is always at screen (VW/2, BALL_SCREEN_Y).
   * A ring is at screen (VW/2, toScreenY(ring.worldY)).
   * dx is always 0.
   * dy = BALL_SCREEN_Y - ringScreenY = ballWorldY - ring.worldY  (in world coords too)
   *
   * dist = |dy| = |ballWorldY - ring.worldY|
   *
   * Angle from ring centre to ball:
   *   atan2(dy, 0) = PI/2 if dy > 0 (ball below ring), -PI/2 if dy < 0 (ball above ring)
   *
   * The ball is in the ring band when RING_INNER - BALL_R < dist < RING_OUTER + BALL_R.
   * For precise collision: treat ball as circle, ring as annulus.
   * Collision when: ball circle overlaps the annulus.
   *   overlap = dist > RING_INNER - BALL_R  AND  dist < RING_OUTER + BALL_R
   * But we want the ball centre to be in the annulus for a solid hit:
   *   RING_INNER < dist < RING_OUTER  (strict hit detection)
   * We use a slightly looser check to feel fair:
   *   RING_INNER - BALL_R*0.5 < dist < RING_OUTER + BALL_R*0.5
   */
  function isInRingBand(dist) {
    return dist > RING_INNER - BALL_R * 0.5 && dist < RING_OUTER + BALL_R * 0.5;
  }

  function checkCollision(ring) {
    const dist = Math.abs(ballWorldY - ring.worldY); // ball is always at VW/2 horizontally
    if (!isInRingBand(dist)) return false;

    // Determine angle from ring centre to ball
    // dy = ballWorldY - ring.worldY  (positive if ball is below ring in world)
    const dy = ballWorldY - ring.worldY;
    const angle = Math.atan2(dy, 0); // either PI/2 or -PI/2

    const hitColor = arcColorAt(ring, angle);
    return hitColor !== ballColorIdx;
  }

  // ── Scoring ──────────────────────────────────────────────────────────────────
  /*
   * Score increments when ball passes through a ring's centre from below to above.
   * "Below" means ball.worldY > ring.worldY (in world coords, lower = larger Y).
   * "Above" means ball.worldY < ring.worldY.
   * We track a prevBallBelow flag per ring.
   */
  function checkScoring(ring) {
    if (ring.passed) return false;
    const ballBelow = ballWorldY > ring.worldY;
    if (ring.prevBallBelow && !ballBelow) {
      // Ball just crossed ring centre upward
      ring.passed = true;
      return true;
    }
    ring.prevBallBelow = ballBelow;
    return false;
  }

  // ── Difficulty ───────────────────────────────────────────────────────────────
  function currentRotSpeed() {
    const level = Math.floor(score / LEVEL_STEP);
    return BASE_ROT_SPEED + level * ROT_PER_LEVEL;
  }

  // ── Particles ────────────────────────────────────────────────────────────────
  function spawnParticles(screenX, screenY, colorIdx) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rng(70, 220);
      particles.push({
        x:     screenX,
        y:     screenY,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed,
        life:  1,
        decay: rng(1.4, 2.8),
        r:     rng(3, 7),
        color: COLORS[colorIdx],
        glow:  GLOW[colorIdx],
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 160 * dt; // gravity pull
      p.vx   *= Math.pow(0.98, dt * 60);
      p.life -= p.decay * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 0.9);
      ctx.shadowColor = p.glow;
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * Math.max(0, p.life), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Game lifecycle ───────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx    = c.getContext('2d');
    loadBest();
    buildStars();
    state = 'MENU';
  }

  function resetGame() {
    ballWorldY   = 0;
    ballVY       = 0;
    ballColorIdx = 0;
    cameraY      = 0;
    score        = 0;
    particles    = [];
    scoreFlashTimer = 0;
    deadOverlayAlpha = 0;
    spawnInitialRings();
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  function die() {
    _isNewBest = score > bestScore;
    saveBest();
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'colorswitch_best'); } catch(e) {}
  }

  // ── Public: tap ──────────────────────────────────────────────────────────────
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
    ballVY       = TAP_IMPULSE;
    ballColorIdx = (ballColorIdx + 1) % 4;
    try { Audio.play('tap'); } catch(e) {}
  }

  // ── Public: update ───────────────────────────────────────────────────────────
  function update(dt) {
    // Blink timer (shared across states)
    blinkTimer += dt;
    if (blinkTimer > 0.55) { blinkTimer = 0; blinkOn = !blinkOn; }

    if (state === 'MENU') {
      menuRot += 0.85 * dt;
      return;
    }

    if (state === 'DEAD') {
      deadOverlayAlpha = Math.min(1, deadOverlayAlpha + dt * 2.5);
      updateParticles(dt);
      return;
    }

    // ── PLAYING ──────────────────────────────────────────────────────────────
    scoreFlashTimer = Math.max(0, scoreFlashTimer - dt);

    // Physics
    ballVY     += GRAVITY * dt;
    ballWorldY += ballVY * dt;

    // Camera follows ball
    cameraY = ballWorldY;

    // Death zone: if ball falls more than 400 units below start, it's gone
    if (ballWorldY > 400) {
      die();
      return;
    }

    // Rotate rings
    const rs = currentRotSpeed();
    for (const ring of rings) {
      ring.rot += rs * dt;
    }

    // Pool management
    maintainRings();
    pruneRings();

    // Score + collision checks
    for (const ring of rings) {
      const ringScreenY = toScreenY(ring.worldY);

      // Only check rings near the ball (on screen)
      if (ringScreenY < -RING_OUTER - 20 || ringScreenY > VH + RING_OUTER + 20) continue;

      // Scoring: did ball just pass this ring upward?
      if (!ring.passed && checkScoring(ring)) {
        score++;
        scoreFlashTimer = 0.25;
        try { Audio.play('score'); } catch(e) {}
        spawnParticles(VW / 2, ringScreenY, ballColorIdx);
      }

      // Collision: is ball touching a danger arc?
      if (checkCollision(ring)) {
        die();
        return;
      }
    }

    updateParticles(dt);
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────────
  function drawText(text, x, y, size, color, align, baseline) {
    ctx.save();
    ctx.font         = `bold ${size}px Arial, sans-serif`;
    ctx.textAlign    = align    || 'center';
    ctx.textBaseline = baseline || 'middle';
    ctx.fillStyle    = color || '#fff';
    ctx.shadowColor  = color || '#fff';
    ctx.shadowBlur   = 12;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawRing(cx, cy, ring, alpha) {
    const SEGMENTS = 4;
    const ARC_SPAN = (Math.PI * 2) / SEGMENTS;
    const GAP_HALF = 0.04; // radians of black gap on each side of arc join

    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;

    for (let i = 0; i < SEGMENTS; i++) {
      const colorIdx  = (ring.safeColor + i) % 4;
      const startAngle = ring.rot + i * ARC_SPAN + GAP_HALF;
      const endAngle   = ring.rot + (i + 1) * ARC_SPAN - GAP_HALF;

      ctx.beginPath();
      ctx.arc(cx, cy, RING_OUTER, startAngle, endAngle);
      ctx.arc(cx, cy, RING_INNER, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle  = COLORS[colorIdx];
      ctx.shadowColor = COLORS[colorIdx];
      ctx.shadowBlur  = 10;
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBall() {
    const x = VW / 2;
    const y = BALL_SCREEN_Y;
    const col  = COLORS[ballColorIdx];
    const glow = GLOW[ballColorIdx];

    ctx.save();

    // Outer glow
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 28;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x - BALL_R * 0.28, y - BALL_R * 0.28, BALL_R * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
  }

  // Colour indicator dots (top-left HUD)
  function drawColorDots() {
    const dotY  = 34;
    const startX = 24;
    const spacing = 22;

    for (let i = 0; i < 4; i++) {
      const active = i === ballColorIdx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX + i * spacing, dotY, active ? 9 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle   = COLORS[i];
      ctx.globalAlpha = active ? 1.0 : 0.30;
      ctx.shadowColor = COLORS[i];
      ctx.shadowBlur  = active ? 16 : 0;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Draw: MENU ───────────────────────────────────────────────────────────────
  function drawMenu() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    // Spinning ring preview (centred mid-screen)
    const ringPreview = { rot: menuRot, safeColor: 0, passed: false, prevBallBelow: false };
    drawRing(VW / 2, 400, ringPreview);

    // --- Title "COLOR" with per-letter colours ---
    ctx.save();
    const letterSize = 64;
    ctx.font         = `900 ${letterSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    const word1 = 'COLOR';
    // Measure full word width to centre it
    let totalW = 0;
    for (const ch of word1) totalW += ctx.measureText(ch).width;
    let lx = VW / 2 - totalW / 2;
    for (let i = 0; i < word1.length; i++) {
      const ch = word1[i];
      const w  = ctx.measureText(ch).width;
      ctx.fillStyle   = COLORS[i % 4];
      ctx.shadowColor = COLORS[i % 4];
      ctx.shadowBlur  = 18;
      ctx.fillText(ch, lx + w / 2, 172);
      lx += w;
    }

    // "SWITCH" in white
    ctx.font         = `900 ${letterSize}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.fillStyle    = '#fff';
    ctx.shadowColor  = '#aaa';
    ctx.shadowBlur   = 10;
    ctx.fillText('SWITCH', VW / 2, 250);
    ctx.restore();

    // Subtitle
    drawText('Match the ball color to pass through!', VW / 2, 310, 16, '#777');

    // Color legend dots
    const legendY = 570;
    const legendSpacing = 58;
    const legendStartX  = VW / 2 - (COLORS.length - 1) * legendSpacing / 2;
    COLORS.forEach((col, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(legendStartX + i * legendSpacing, legendY, 15, 0, Math.PI * 2);
      ctx.fillStyle  = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 20;
      ctx.fill();
      ctx.restore();
    });
    drawText('Tap to cycle ball color', VW / 2, 610, 16, '#666');

    // Best score
    if (bestScore > 0) {
      drawText(`Best: ${bestScore}`, VW / 2, 670, 22, '#aaa');
    }

    // TAP TO START
    if (blinkOn) {
      drawText('TAP TO START', VW / 2, 760, 30, '#fff');
    }
  }

  // ── Draw: PLAYING ────────────────────────────────────────────────────────────
  function drawPlaying() {
    // Background — subtle white flash on score
    if (scoreFlashTimer > 0) {
      const t = scoreFlashTimer / 0.25;
      ctx.fillStyle = `rgba(255,255,255,${0.07 * t})`;
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    // Rings
    for (const ring of rings) {
      const ry = toScreenY(ring.worldY);
      if (ry > -RING_OUTER - 5 && ry < VH + RING_OUTER + 5) {
        drawRing(VW / 2, ry, ring);
      }
    }

    drawParticles();
    drawBall();

    // Score (top centre)
    ctx.save();
    ctx.font         = 'bold 58px Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(255,255,255,0.92)';
    ctx.shadowColor  = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur   = 12;
    ctx.fillText(String(score), VW / 2, 24);
    ctx.restore();

    // Colour indicator dots (top-left)
    drawColorDots();
  }

  // ── Draw: DEAD ───────────────────────────────────────────────────────────────
  function drawDead() {
    // Frozen game behind overlay
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    for (const ring of rings) {
      const ry = toScreenY(ring.worldY);
      if (ry > -RING_OUTER - 5 && ry < VH + RING_OUTER + 5) {
        drawRing(VW / 2, ry, ring, 0.25);
      }
    }

    drawParticles();

    // Dark overlay fade-in
    ctx.save();
    ctx.globalAlpha = deadOverlayAlpha * 0.7;
    ctx.fillStyle   = '#000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // "GAME OVER"
    ctx.save();
    ctx.globalAlpha = Math.min(1, deadOverlayAlpha * 1.5);
    drawText('GAME OVER', VW / 2, 290, 54, '#FF3366');

    // Score label
    drawText('SCORE', VW / 2, 365, 20, '#888');

    // Score value
    ctx.font         = 'bold 88px Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#fff';
    ctx.shadowColor  = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur   = 22;
    ctx.fillText(String(score), VW / 2, 430);
    ctx.restore();

    // New best / best
    if (score > 0 && _isNewBest) {
      drawText('NEW BEST!', VW / 2, 505, 24, '#FFCC00');
    } else if (bestScore > 0) {
      drawText(`Best: ${bestScore}`, VW / 2, 505, 24, '#888');
    }

    // TAP TO RESTART
    if (blinkOn && deadOverlayAlpha > 0.6) {
      drawText('TAP TO RESTART', VW / 2, 720, 30, '#fff');
    }
  }

  // ── Public: draw ─────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    if      (state === 'MENU')    drawMenu();
    else if (state === 'PLAYING') drawPlaying();
    else if (state === 'DEAD')    drawDead();
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function getScore() { return score; }
  function getState() { return state; }
  function getBest()  { return bestScore; }
  return { init, update, draw, tap, getScore, getState, getBest };
})();
