'use strict';
function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch(e) {} }
var _msDone = {};
function _milestone(s) {
  var ms = [10,25,50,100,250,500];
  for (var i=0; i<ms.length; i++) {
    if (s >= ms[i] && !_msDone[ms[i]]) {
      _msDone[ms[i]] = true;
      vib([10,30,10]);
      try { Audio.play('highscore'); } catch(e) {}
      _showMsFlash(ms[i]);
      break;
    }
  }
}
function _showMsFlash(n) {
  if (typeof document === 'undefined') return;
  var el = document.createElement('div');
  el.textContent = n >= 100 ? n+'!!!' : n >= 50 ? n+'!!' : n+'!';
  Object.assign(el.style, {
    position:'fixed', top:'30%', left:'50%', transform:'translateX(-50%)',
    fontSize:'72px', fontWeight:'900', color:'#FFD700',
    textShadow:'0 0 30px #FFD700, 0 0 60px rgba(255,215,0,0.5)',
    fontFamily:'system-ui,sans-serif', zIndex:'9999',
    pointerEvents:'none', opacity:'1', transition:'opacity 1.5s ease 0.8s'
  });
  document.body.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; }, 100);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2500);
}

// StackTower — virtual canvas 390×844
// States: MENU → PLAYING → DEAD
const StackTower = (() => {
  const VW = 390, VH = 844;

  // ── Neon block colors (cycling) ────────────────────────────────────────────
  const COLORS = [
    '#ff2d78', // hot pink
    '#00f5ff', // cyan
    '#aaff00', // lime
    '#ff9900', // orange
    '#bf5fff', // violet
    '#ffee00', // yellow
  ];

  // ── Constants ──────────────────────────────────────────────────────────────
  const BLOCK_H         = 28;       // block height in px
  const BASE_W          = 220;      // starting block width
  const BASE_SPEED      = 120;      // px/s at level 0
  const SPEED_INC       = 8;        // px/s per level
  const MAX_SPEED       = 380;      // hard cap
  const PERFECT_RATIO   = 0.95;     // overlap >= 95% → perfect
  const MIN_BLOCK_W     = 10;       // game over below this width
  const FLOOR_Y         = VH - 60;  // y of first block bottom edge (virtual canvas)
  const CAMERA_MARGIN   = 300;      // keep top of stack this far from top of screen
  const FLASH_DURATION  = 0.22;     // seconds for perfect flash

  let _canvas, _ctx;

  // ── Game state ──────────────────────────────────────────────────────────────
  let state;         // 'MENU' | 'PLAYING' | 'DEAD'
  let score;
  let best = 0;
  let level;
  let camY;          // camera offset: subtract from virtual y to get screen y
  let flashTimer;    // countdown for perfect flash

  // Sliding block at top
  let slider;        // { x, w, dir, speed }

  // Stack: array of placed blocks (bottom-first)
  // Each entry: { x, w, y (top edge in virtual canvas coords), color }
  let stack;

  // Dead-screen display
  let deadScore;
  let _isNewBest = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function colorAt(index) {
    return COLORS[index % COLORS.length];
  }

  function blockTop(index) {
    // Top edge of block at stack[index]
    return FLOOR_Y - (index + 1) * BLOCK_H;
  }

  function stackTopY() {
    if (stack.length === 0) return FLOOR_Y;
    return blockTop(stack.length - 1);
  }

  function sliderY() {
    // Top edge of the currently sliding block
    return stackTopY() - BLOCK_H;
  }

  // ── Initialise / reset ─────────────────────────────────────────────────────
  function _resetGame() {
    _msDone = {};
    score  = 0;
    level  = 0;
    camY   = 0;
    flashTimer = 0;
    _isNewBest = false;

    // Build base block centered on canvas
    const baseX = (VW - BASE_W) / 2;
    stack = [{
      x:     baseX,
      w:     BASE_W,
      y:     blockTop(0),
      color: colorAt(0),
    }];

    _spawnSlider();
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  function _spawnSlider() {
    const top = stack[stack.length - 1];
    slider = {
      x:     0,               // start off-screen left
      w:     top.w,           // same width as current top
      dir:   1,               // 1 = moving right, -1 = left
      speed: Math.min(BASE_SPEED + level * SPEED_INC, MAX_SPEED),
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    state   = 'MENU';
    score   = 0;
    best    = bestScore || 0;
    deadScore = 0;
    camY    = 0;
    flashTimer = 0;
    stack   = [];
    slider  = null;
  }

  function tap() {
    if (state === 'MENU') {
      _resetGame();
      return;
    }
    if (state === 'DEAD') {
      // Transition back via interstitial
      AdManager.showInterstitial(() => { _resetGame(); });
      return;
    }
    if (state === 'PLAYING') {
      _placeBlock();
    }
  }

  function _placeBlock() {
    const top   = stack[stack.length - 1]; // current top of stack
    const sLeft  = slider.x;
    const sRight = slider.x + slider.w;
    const tLeft  = top.x;
    const tRight = top.x + top.w;

    // Overlap
    const oLeft  = Math.max(sLeft, tLeft);
    const oRight = Math.min(sRight, tRight);
    const overlap = oRight - oLeft;

    if (overlap <= 0) {
      // Fell off entirely
      _triggerDead();
      return;
    }

    const ratio = overlap / top.w;

    if (ratio >= PERFECT_RATIO) {
      // Perfect: snap to exact same position, give bonus
      score += 2;
      vib(8); _milestone(score);
      flashTimer = FLASH_DURATION;
      try { Audio.play('score'); } catch(e) {}
      stack.push({
        x:     top.x,
        w:     top.w,
        y:     sliderY(),
        color: colorAt(stack.length),
      });
    } else {
      // Normal: cut the block
      const newW = overlap;
      if (newW < MIN_BLOCK_W) {
        _triggerDead();
        return;
      }
      score += 1;
      vib(8); _milestone(score);
      try { Audio.play('tap'); } catch(e) {}
      stack.push({
        x:     oLeft,
        w:     newW,
        y:     sliderY(),
        color: colorAt(stack.length),
      });
    }

    level = Math.floor(score / 5);
    _updateCamera();
    _spawnSlider();
  }

  function _triggerDead() {
    deadScore = score;
    _isNewBest = score > best;
    if (_isNewBest) best = score;
    state = 'DEAD';
    vib([40,80,80]);
    try { Audio.play('lose'); } catch(e) {}
    AdManager.gameplayStop()
    AdManager.onRunEnd();;
    // show interstitial automatically with callback that just leaves us on DEAD
    // (tap to restart will be the user's next action)
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore(), 'stacktower_best'); } catch(e) {}
  }

  function _updateCamera() {
    // We want the top of the stack to be visible at CAMERA_MARGIN from top of screen.
    // camY is subtracted from virtual-canvas y to get screen y.
    // Screen y of stack top = stackTopY() - camY
    // We want: stackTopY() - camY = CAMERA_MARGIN
    const desired = stackTopY() - CAMERA_MARGIN;
    if (desired > camY) {
      camY = desired;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING' || !slider) return;

    if (flashTimer > 0) flashTimer -= dt;

    // Move slider
    slider.x += slider.dir * slider.speed * dt;

    // Bounce off virtual canvas edges
    if (slider.dir === 1 && slider.x + slider.w > VW) {
      slider.x = VW - slider.w;
      slider.dir = -1;
    } else if (slider.dir === -1 && slider.x < 0) {
      slider.x = 0;
      slider.dir = 1;
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    const ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#0d0d1a');
    grad.addColorStop(1, '#12122a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU')    { _drawMenu(ctx);    return; }
    if (state === 'PLAYING') { _drawPlaying(ctx); return; }
    if (state === 'DEAD')    { _drawDead(ctx);    return; }
  }

  // ── Screen-space y helper (applies camera) ──────────────────────────────────
  function sv(virtualY) {
    return virtualY - camY;
  }

  // ── Draw: MENU ─────────────────────────────────────────────────────────────
  function _drawMenu(ctx) {
    // Decorative static mini-stack
    const demoColors = COLORS;
    const demoW   = 160;
    const demoX   = (VW - demoW) / 2;
    const demoBot = VH - 100;
    const demoH   = 24;
    const demoCount = 7;
    for (let i = 0; i < demoCount; i++) {
      const shrink = i * 8;
      const bx = demoX + shrink / 2;
      const bw = demoW - shrink;
      const by = demoBot - (i + 1) * demoH;
      _drawBlock(ctx, bx, by, bw, demoH, demoColors[i % demoColors.length], false);
    }

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 52px "Arial Narrow", Arial, sans-serif';
    ctx.letterSpacing = '4px';
    // Neon glow
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = '#ffffff';
    ctx.fillText('STACK', VW / 2, VH / 2 - 100);
    ctx.fillText('TOWER', VW / 2, VH / 2 - 40);

    ctx.shadowBlur = 0;

    // Tap to play — pulsing
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = '#aaffee';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Draw: PLAYING ──────────────────────────────────────────────────────────
  function _drawPlaying(ctx) {
    const perfect = flashTimer > 0;

    // Draw stack blocks (only those on screen)
    for (let i = 0; i < stack.length; i++) {
      const b = stack[i];
      const sy = sv(b.y);
      if (sy > VH + BLOCK_H) continue;  // below screen
      if (sy + BLOCK_H < -BLOCK_H) continue; // above screen
      const col = perfect ? '#ffffff' : b.color;
      _drawBlock(ctx, b.x, sy, b.w, BLOCK_H, col, true);
    }

    // Draw slider
    if (slider) {
      const sy = sv(sliderY());
      const col = perfect ? '#ffffff' : colorAt(stack.length);
      // Draw with extra glow for slider
      _drawBlock(ctx, slider.x, sy, slider.w, BLOCK_H, col, true);

      // Movement shadow line
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = col;
      ctx.fillRect(slider.x, sy + BLOCK_H - 2, slider.w, 2);
      ctx.restore();
    }

    // Score
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 42px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,245,255,0.6)';
    ctx.shadowBlur  = 12;
    ctx.fillText(score, VW / 2, 32);
    ctx.restore();

    // Perfect flash overlay
    if (perfect) {
      ctx.save();
      ctx.globalAlpha = (flashTimer / FLASH_DURATION) * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
  }

  // ── Draw: DEAD ─────────────────────────────────────────────────────────────
  function _drawDead(ctx) {
    // Show the frozen stack (dimmed)
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < stack.length; i++) {
      const b = stack[i];
      const sy = sv(b.y);
      if (sy > VH + BLOCK_H || sy + BLOCK_H < 0) continue;
      _drawBlock(ctx, b.x, sy, b.w, BLOCK_H, b.color, false);
    }
    ctx.restore();

    // Overlay panel
    ctx.save();
    ctx.fillStyle = 'rgba(13,13,26,0.82)';
    ctx.fillRect(40, VH / 2 - 160, VW - 80, 320);
    _roundRect(ctx, 40, VH / 2 - 160, VW - 80, 320, 18);
    ctx.fill();

    // Border glow
    ctx.strokeStyle = '#ff2d78';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur  = 16;
    ctx.lineWidth   = 2;
    _roundRect(ctx, 40, VH / 2 - 160, VW - 80, 320, 18);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // "GAME OVER"
    ctx.font        = 'bold 38px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle   = '#ff2d78';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur  = 18;
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 88);

    ctx.shadowBlur = 0;

    // Score label
    ctx.font      = '18px Arial, sans-serif';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText('SCORE', VW / 2, VH / 2 - 32);

    // Score value
    ctx.font        = 'bold 72px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 20;
    ctx.fillText(deadScore, VW / 2, VH / 2 + 30);

    ctx.shadowBlur = 0;

    // Best score
    if (best > 0) {
      ctx.font      = '16px Arial, sans-serif';
      ctx.fillStyle = _isNewBest ? '#ffd700' : '#888899';
      ctx.fillText((_isNewBest ? '★ NEW BEST: ' : 'BEST: ') + best, VW / 2, VH / 2 + 78);
    }

    // Tap to restart — pulsing
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = pulse;
    ctx.font        = 'bold 20px Arial, sans-serif';
    ctx.fillStyle   = '#aaffee';
    ctx.fillText('TAP TO RESTART', VW / 2, VH / 2 + 110);
    ctx.restore();
  }

  // ── Drawing helpers ────────────────────────────────────────────────────────
  function _drawBlock(ctx, x, y, w, h, color, glow) {
    ctx.save();

    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
    }

    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // Top highlight strip
    ctx.globalAlpha = 0.5;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(x, y, w, 3);

    // Bottom shadow strip
    ctx.globalAlpha = 0.3;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(x, y + h - 3, w, 3);

    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function getScore() { return score; }
  function getState() { return state; }
  function getBest()  { return best; }

  return { init, update, draw, tap, getScore, getState, getBest };
})();
