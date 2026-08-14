'use strict';

/*
 * Plank Bridge — stick figure plank-extending game.
 * Exposes global: PlankBridge
 *   { init, update, draw, tap, getBest }
 *
 * Virtual canvas: 390 × 844 px.
 * States: MENU → PLAYING → DEAD
 *
 * Gameplay
 * ────────
 * A stick figure stands on the right edge of the left platform.
 * Tap once to start growing a plank (downward line rotating to horizontal).
 * Tap again to release — plank falls flat.
 * If the plank bridges the gap to the next platform, the figure walks across,
 * the screen scrolls left, and a new platform spawns on the right.
 * Too short → plank falls into gap, figure falls → DEAD.
 * Too long  → figure walks off far end → DEAD.
 * Score = number of platforms successfully crossed.
 */

var PlankBridge = (function () {

  // ── Virtual canvas ─────────────────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // ── Layout constants ───────────────────────────────────────────────────────
  var PLATFORM_Y    = 680;   // top-of-platform Y (platforms are at bottom portion)
  var PLATFORM_H    = 18;    // platform thickness
  var PLANK_W       = 6;     // plank visual thickness
  var CHAR_H        = 50;    // total stick-figure height
  var CHAR_W        = 18;    // shoulder width
  var HEAD_R        = 9;     // head radius
  var PLANK_RATE    = 150;   // px / second while holding
  var PLANK_MAX     = 320;   // safety cap on plank length
  var ROTATE_SPEED  = 4.0;   // radians / second for plank fall rotation
  var WALK_SPEED    = 90;    // px / second character walk
  var SCROLL_SPEED  = 200;   // px / second for scroll animation
  var BASE_GAP      = 80;    // starting gap width
  var GAP_INC       = 5;     // gap grows by this each platform
  var PLAT_W_MIN    = 70;    // minimum platform width
  var PLAT_W_START  = 110;   // first platform width
  var PLAT_W_NEXT   = 90;    // subsequent platform width (with variance)
  var DEAD_FALL_SPD = 400;   // px / second character falls when dead

  // ── Canvas / context ───────────────────────────────────────────────────────
  var canvas, ctx;

  // ── Persistent ────────────────────────────────────────────────────────────
  var _best = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  var state = 'MENU';   // 'MENU' | 'PLAYING' | 'DEAD'

  // ── Game variables ─────────────────────────────────────────────────────────
  var score;
  var time;

  // Platforms: array of { x, w } — all in screen space (scroll handled separately)
  var platforms;

  // Plank state
  var plankLength;      // current length being grown (px)
  var plankAngle;       // 0 = vertical (growing down), PI/2 = horizontal (fallen)
  var isHolding;        // true while first tap has been made and not yet released
  var plankDropped;     // true once plank has been released and is rotating
  var plankFallen;      // true once plank has finished rotating (flat)
  var plankOk;          // true if plank successfully bridges the gap

  // Character
  var charX;            // X position of character feet-center
  var charWalking;      // bool — is character currently walking
  var charFallY;        // Y offset for death fall (added to normal Y)
  var charFallVY;       // velocity of death fall

  // Walk / scroll animation
  var walkTargetX;      // where character is walking toward
  var scrollAmount;     // total pixels still to scroll left
  var scrolling;        // bool

  // Walk leg animation
  var walkCycle;        // time accumulator for leg swing

  // Death animation
  var deadTimer;        // time after death before overlay appears fully

  // Mountains for background (generated once)
  var mountains;
  var farMountains;
  var stars;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function sfx(name) {
    try { Audio.play(name); } catch (e) {}
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = (best | 0) || 0;
    buildBackground();
    resetGame();
    state = 'MENU';
  }

  function buildBackground() {
    // Far mountains (lighter, shorter)
    farMountains = [];
    var fx = -20;
    while (fx < VW + 40) {
      var fw = randInt(60, 130);
      var fh = randInt(60, 160);
      farMountains.push({ x: fx, w: fw, h: fh });
      fx += fw - randInt(10, 30);
    }

    // Near mountains (darker, taller)
    mountains = [];
    var mx = -30;
    while (mx < VW + 60) {
      var mw = randInt(80, 180);
      var mh = randInt(120, 280);
      mountains.push({ x: mx, w: mw, h: mh });
      mx += mw - randInt(20, 50);
    }

    // Stars
    stars = [];
    for (var i = 0; i < 60; i++) {
      stars.push({
        x: rand(0, VW),
        y: rand(0, PLATFORM_Y - 80),
        r: rand(0.4, 1.6),
        tw: rand(0, Math.PI * 2)
      });
    }
  }

  function resetGame() {
    score      = 0;
    time       = 0;
    walkCycle  = 0;
    deadTimer  = 0;
    charFallY  = 0;
    charFallVY = 0;
    scrolling  = false;
    scrollAmount = 0;
    charWalking  = false;
    plankLength  = 0;
    plankAngle   = 0;
    plankDropped = false;
    plankFallen  = false;
    plankOk      = false;
    isHolding    = false;

    // Initial two platforms
    platforms = [];
    // Left starting platform — starts at x=0
    platforms.push({ x: 0, w: PLAT_W_START });
    // First gap + second platform
    var gap = BASE_GAP;
    var nx = PLAT_W_START + gap;
    platforms.push({ x: nx, w: PLAT_W_NEXT });

    // Character stands at right edge of first platform
    charX = platforms[0].w - 2;
    walkTargetX = charX;
  }

  // ── Public: tap ───────────────────────────────────────────────────────────
  // Tap toggles holding: first tap = start growing, second = release/drop.
  function tap(x, y) {
    if (state === 'MENU') {
      sfx('tap');
      resetGame();
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }

    if (state === 'DEAD') {
      sfx('tap');
      resetGame();
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }

    if (state !== 'PLAYING') { return; }

    // Only accept taps when not currently animating walk/scroll
    if (charWalking || scrolling || charFallY > 0) { return; }
    // Don't start new plank if old one is still rotating
    if (plankDropped && !plankFallen) { return; }
    // Don't act if plank is in resolution phase
    if (plankFallen) { return; }

    if (!isHolding) {
      // First tap: start growing plank
      isHolding    = true;
      plankLength  = 0;
      plankAngle   = 0;
      plankDropped = false;
      plankFallen  = false;
      plankOk      = false;
      sfx('tap');
    } else {
      // Second tap: release plank (start rotation)
      isHolding    = false;
      plankDropped = true;
      sfx('tap');
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    if (dt > 0.05) { dt = 0.05; }
    time += dt;

    // Animate star twinkle always
    for (var si = 0; si < stars.length; si++) {
      stars[si].tw += dt * 1.5;
    }

    if (state === 'MENU') { return; }
    if (state === 'DEAD') {
      deadTimer += dt;
      // Character falls during death animation
      charFallVY += 600 * dt;
      charFallY  += charFallVY * dt;
      return;
    }

    // ── PLAYING ──────────────────────────────────────────────────────────────

    // 1. Grow plank while holding
    if (isHolding && !plankDropped) {
      plankLength += PLANK_RATE * dt;
      if (plankLength > PLANK_MAX) { plankLength = PLANK_MAX; }
    }

    // 2. Rotate plank from vertical (0) toward horizontal (PI/2)
    if (plankDropped && !plankFallen) {
      plankAngle += ROTATE_SPEED * dt;
      if (plankAngle >= Math.PI / 2) {
        plankAngle  = Math.PI / 2;
        plankFallen = true;
        // Resolve: did the plank bridge the gap?
        resolvePlank();
      }
    }

    // 3. Walk animation
    if (charWalking) {
      walkCycle += dt * 8;
      var dir = (walkTargetX > charX) ? 1 : -1;
      charX += WALK_SPEED * dir * dt;
      if (dir > 0 && charX >= walkTargetX) {
        charX = walkTargetX;
        charWalking = false;
        sfx('gem');
        score++;
        if (score > _best) { _best = score; AdManager.happyTime(1.0); }
        // Start scroll to center the view
        startScroll();
      } else if (dir < 0 && charX <= walkTargetX) {
        charX = walkTargetX;
        charWalking = false;
        // walked back — should not happen in normal flow
      }
    }

    // 4. Scroll animation
    if (scrolling) {
      var scrollDelta = SCROLL_SPEED * dt;
      if (scrollDelta > scrollAmount) { scrollDelta = scrollAmount; }
      scrollAmount -= scrollDelta;

      // Move all platforms left
      for (var pi = 0; pi < platforms.length; pi++) {
        platforms[pi].x -= scrollDelta;
      }
      // Move character left too
      charX -= scrollDelta;

      if (scrollAmount <= 0) {
        scrolling = false;
        // Cull off-screen platforms (x + w < 0)
        var kept = [];
        for (var ki = 0; ki < platforms.length; ki++) {
          if (platforms[ki].x + platforms[ki].w > -10) {
            kept.push(platforms[ki]);
          }
        }
        platforms = kept;
        // Spawn new platform on right
        spawnNextPlatform();
        // Reset plank for next round
        plankLength  = 0;
        plankAngle   = 0;
        plankDropped = false;
        plankFallen  = false;
        plankOk      = false;
        isHolding    = false;
      }
    }
  }

  function resolvePlank() {
    var leftPlat  = platforms[0];
    var rightPlat = platforms[1];

    // Plank pivots from right edge of left platform (charX position)
    var pivotX = leftPlat.x + leftPlat.w;
    var plankEndX = pivotX + plankLength;

    // The plank must land ON the right platform (within its bounds)
    var rpLeft  = rightPlat.x;
    var rpRight = rightPlat.x + rightPlat.w;

    if (plankEndX >= rpLeft && plankEndX <= rpRight) {
      // Success!
      plankOk = true;
      sfx('tap');
      // Walk character to right end of plank (on the right platform)
      walkTargetX = plankEndX;
      charWalking = true;
    } else if (plankEndX < rpLeft) {
      // Too short — fell into gap
      sfx('crash');
      triggerDeath();
    } else {
      // Too long — walked off far end
      sfx('crash');
      // Still walk the character across (and off the edge)
      walkTargetX = plankEndX;
      charWalking = true;
      // We'll detect fall-off in startScroll / check after walk
      plankOk = false;
    }
  }

  function startScroll() {
    if (!plankOk) {
      // Character walked off the end — DEAD
      triggerDeath();
      return;
    }
    // Scroll left so first platform goes off screen, second becomes first
    // Amount to scroll = left platform width + gap (= right platform x)
    var leftPlat = platforms[0];
    scrollAmount = leftPlat.x + leftPlat.w; // scroll enough to bring next plat to x near 0?
    // Actually: scroll so the right platform's left edge lands near x=30
    var rightPlat = platforms[1];
    scrollAmount = rightPlat.x - 30;
    if (scrollAmount < 0) { scrollAmount = 0; }
    scrolling = true;
  }

  function spawnNextPlatform() {
    // Find rightmost platform right edge
    var rightmost = 0;
    for (var i = 0; i < platforms.length; i++) {
      var edge = platforms[i].x + platforms[i].w;
      if (edge > rightmost) { rightmost = edge; }
    }
    // Gap grows with score
    var gap = BASE_GAP + score * GAP_INC;
    // Cap gap so it's still possible
    if (gap > 200) { gap = 200; }
    var nw = randInt(PLAT_W_MIN, PLAT_W_NEXT + 20);
    platforms.push({ x: rightmost + gap, w: nw });
  }

  function triggerDeath() {
    if (state === 'DEAD') { return; }
    state = 'DEAD';
    charFallY  = 0;
    charFallVY = 80;
    deadTimer  = 0;
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
    sfx('lose');
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'plankbridge_best'); } catch(e) {}
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) { return; }
    ctx.clearRect(0, 0, VW, VH);
    drawBackground();

    if (state === 'MENU') {
      drawPlatformsAndPlank();
      drawMenuChar();
      drawMenuOverlay();
      return;
    }

    drawPlatformsAndPlank();
    drawStickFigure(charX, charFallY);
    drawHud();

    if (state === 'DEAD' && deadTimer > 0.4) {
      drawDeadOverlay();
    }
  }

  function drawBackground() {
    // Dark blue-navy sky gradient
    var grad = ctx.createLinearGradient(0, 0, 0, PLATFORM_Y);
    grad.addColorStop(0,   '#0b0d1e');
    grad.addColorStop(0.5, '#101535');
    grad.addColorStop(1,   '#1a2040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // Ground area below platforms
    ctx.fillStyle = '#0a0c18';
    ctx.fillRect(0, PLATFORM_Y, VW, VH - PLATFORM_Y);

    // Stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.tw));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c8d8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Far mountains (lighter silhouette)
    ctx.fillStyle = '#1e2545';
    ctx.beginPath();
    ctx.moveTo(0, PLATFORM_Y);
    for (var fi = 0; fi < farMountains.length; fi++) {
      var fm = farMountains[fi];
      var peak = PLATFORM_Y - fm.h;
      ctx.lineTo(fm.x, PLATFORM_Y);
      ctx.lineTo(fm.x + fm.w / 2, peak);
      ctx.lineTo(fm.x + fm.w, PLATFORM_Y);
    }
    ctx.lineTo(VW, PLATFORM_Y);
    ctx.closePath();
    ctx.fill();

    // Near mountains (darker silhouette)
    ctx.fillStyle = '#12162c';
    ctx.beginPath();
    ctx.moveTo(0, PLATFORM_Y);
    for (var mi = 0; mi < mountains.length; mi++) {
      var mm = mountains[mi];
      var mpeak = PLATFORM_Y - mm.h;
      ctx.lineTo(mm.x, PLATFORM_Y);
      ctx.lineTo(mm.x + mm.w / 2, mpeak);
      ctx.lineTo(mm.x + mm.w, PLATFORM_Y);
    }
    ctx.lineTo(VW, PLATFORM_Y);
    ctx.closePath();
    ctx.fill();

    // Ground line / shadow
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, PLATFORM_Y + PLATFORM_H + 4, VW, VH - PLATFORM_Y - PLATFORM_H - 4);
  }

  function drawPlatformsAndPlank() {
    // Draw platforms
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      drawPlatform(p.x, p.w);
    }

    // Draw plank if in PLAYING or relevant dead state
    if (state === 'PLAYING' || (state === 'DEAD' && deadTimer < 0.6)) {
      drawPlank();
    }
  }

  function drawPlatform(px, pw) {
    // Platform body — black silhouette
    ctx.fillStyle = '#111111';
    ctx.fillRect(px, PLATFORM_Y, pw, PLATFORM_H);

    // Top highlight edge
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px, PLATFORM_Y, pw, 3);

    // Side shadow
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(px, PLATFORM_Y + PLATFORM_H, pw, 5);
  }

  function drawPlank() {
    // Only draw plank if it exists
    if (plankLength <= 0 && !isHolding && !plankDropped) { return; }
    if (plankLength <= 0) { return; }

    var leftPlat = platforms[0];
    if (!leftPlat) { return; }

    var pivotX = leftPlat.x + leftPlat.w;
    var pivotY = PLATFORM_Y;  // plank pivots from platform top at right edge

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(plankAngle);   // 0 = pointing down, PI/2 = pointing right

    // Plank as a dark brown rectangle
    ctx.fillStyle = '#4a2e0a';
    ctx.fillRect(-PLANK_W / 2, 0, PLANK_W, plankLength);

    // Wood grain highlight
    ctx.fillStyle = '#6b4015';
    ctx.fillRect(-PLANK_W / 2 + 1, 0, 2, plankLength);

    ctx.restore();
  }

  function drawStickFigure(cx, extraY) {
    var baseY = PLATFORM_Y - 2;   // feet level
    var ey = extraY || 0;

    baseY += ey;

    // Clamp — don't draw if off-screen top
    if (baseY < -CHAR_H) { return; }

    ctx.save();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Head
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(cx, baseY - CHAR_H + HEAD_R, HEAD_R, 0, Math.PI * 2);
    ctx.fill();

    // Neck to pelvis
    var neckY   = baseY - CHAR_H + HEAD_R * 2;
    var torsoY  = baseY - CHAR_H * 0.35;
    var pelvisY = baseY - CHAR_H * 0.1;

    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(cx, pelvisY);
    ctx.stroke();

    // Arms — slightly raised
    var armY = neckY + (torsoY - neckY) * 0.4;
    var armSwing = charWalking ? Math.sin(walkCycle) * 12 : 0;
    ctx.beginPath();
    ctx.moveTo(cx - CHAR_W / 2 + armSwing * 0.5, armY + 10);
    ctx.lineTo(cx, armY);
    ctx.lineTo(cx + CHAR_W / 2 - armSwing * 0.5, armY + 10);
    ctx.stroke();

    // Legs with walk cycle
    var legSwing = charWalking ? Math.sin(walkCycle) * 14 : 0;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx, pelvisY);
    ctx.lineTo(cx - 8 + legSwing, baseY);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx, pelvisY);
    ctx.lineTo(cx + 8 - legSwing, baseY);
    ctx.stroke();

    ctx.restore();
  }

  function drawMenuChar() {
    // Static stick figure for menu preview
    var leftPlat = platforms[0];
    var cx = leftPlat ? (leftPlat.x + leftPlat.w - 2) : 110;
    drawStickFigure(cx, 0);
  }

  function drawHud() {
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 32px Arial, sans-serif';
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 6;
    ctx.fillText(String(score), VW / 2, 20);
    ctx.shadowBlur = 0;

    // Best (smaller, top right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font      = 'bold 15px Arial, sans-serif';
    ctx.fillText('BEST ' + _best, VW - 16, 26);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawMenuOverlay() {
    // Semi-transparent title band
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 180, VW, 280);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Title: PLANK BRIDGE
    ctx.fillStyle    = '#f0f0f0';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 12;
    ctx.font         = 'bold 54px Arial, sans-serif';
    ctx.fillText('PLANK', VW / 2, 240);
    ctx.fillText('BRIDGE', VW / 2, 306);
    ctx.shadowBlur   = 0;

    // Sub-tagline
    ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.font      = '17px Arial, sans-serif';
    ctx.fillText('Tap once to grow. Tap again to drop!', VW / 2, 368);

    // Pulsing TAP TO PLAY
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(time * 2.5));
    ctx.globalAlpha  = pulse;
    ctx.fillStyle    = '#ffdd44';
    ctx.shadowColor  = 'rgba(255,210,0,0.7)';
    ctx.shadowBlur   = 14;
    ctx.font         = 'bold 26px Arial, sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 570);
    ctx.shadowBlur   = 0;
    ctx.globalAlpha  = 1;

    // Best score
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = '15px Arial, sans-serif';
    ctx.fillText('BEST ' + _best, VW / 2, 630);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawDeadOverlay() {
    // Darken
    var alpha = Math.min(1, (deadTimer - 0.4) * 2.5) * 0.72;
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    ctx.fillRect(0, 0, VW, VH);

    if (deadTimer < 0.8) { return; }

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER text
    ctx.fillStyle   = '#ff4444';
    ctx.shadowColor = 'rgba(255,60,60,0.7)';
    ctx.shadowBlur  = 18;
    ctx.font        = 'bold 50px Arial, sans-serif';
    ctx.fillText('GAME OVER', VW / 2, 310);
    ctx.shadowBlur  = 0;

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 34px Arial, sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 395);

    // Best
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font      = '22px Arial, sans-serif';
    ctx.fillText('Best: ' + _best, VW / 2, 445);

    // Pulsing TAP TO RETRY
    var pulse2 = 0.55 + 0.45 * Math.abs(Math.sin(time * 2.8));
    ctx.globalAlpha = pulse2;
    ctx.fillStyle   = '#ffdd44';
    ctx.shadowColor = 'rgba(255,210,0,0.7)';
    ctx.shadowBlur  = 12;
    ctx.font        = 'bold 24px Arial, sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 540);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Public accessors ───────────────────────────────────────────────────────
  function getBest() {
    return _best;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

}());
