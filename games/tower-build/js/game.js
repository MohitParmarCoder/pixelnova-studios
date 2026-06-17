'use strict';
var TowerBuild = (function () {
  var VW = 390, VH = 844;

  // ── Pastel block colors (cycling) ─────────────────────────────────────────
  var PASTEL_COLORS = [
    '#FFB3BA', // soft pink
    '#BAFFC9', // mint green
    '#FFDFBA', // peach
    '#D4BAFF', // lavender
    '#BAE1FF', // sky blue
    '#FFFFBA', // butter yellow
    '#FFB3E6', // light magenta
    '#B3FFF5', // seafoam
    '#FFDDD2', // light coral
    '#C9BAFF', // periwinkle
  ];

  // ── Constants ──────────────────────────────────────────────────────────────
  var BLOCK_H        = 30;      // block height px
  var BASE_W         = 200;     // starting block width
  var BASE_SPEED     = 130;     // px/s
  var SPEED_INC      = 7;       // px/s per block placed
  var MAX_SPEED      = 400;     // hard cap
  var PERFECT_TOL    = 5;       // px tolerance for perfect land
  var MIN_BLOCK_W    = 8;       // game over if resulting block narrower than this
  var FLOOR_Y        = VH - 80; // y of base block top edge
  var CAMERA_MARGIN  = 250;     // desired pixels from top of screen to top of stack
  var FLASH_DUR      = 0.28;    // seconds for perfect flash

  // Cloud data — static for consistent background
  var CLOUDS = [
    { x: 40,  y: 120, r: 34 },
    { x: 100, y: 140, r: 24 },
    { x: 70,  y: 148, r: 28 },
    { x: 260, y: 90,  r: 38 },
    { x: 310, y: 108, r: 26 },
    { x: 280, y: 116, r: 30 },
    { x: 160, y: 200, r: 20 },
    { x: 200, y: 190, r: 28 },
    { x: 230, y: 205, r: 18 },
    { x: 50,  y: 300, r: 22 },
    { x: 85,  y: 310, r: 16 },
    { x: 330, y: 260, r: 32 },
    { x: 360, y: 278, r: 20 },
    { x: 150, y: 380, r: 18 },
    { x: 180, y: 370, r: 26 },
    { x: 280, y: 420, r: 24 },
    { x: 315, y: 410, r: 18 },
    { x: 60,  y: 480, r: 20 },
    { x: 90,  y: 468, r: 28 },
    { x: 230, y: 530, r: 16 },
  ];

  var _canvas, _ctx;

  // ── Game state vars ────────────────────────────────────────────────────────
  var state;        // 'MENU' | 'PLAYING' | 'DEAD'
  var score;
  var best;
  var camY;         // camera offset (subtract from virtual y to get screen y)
  var flashTimer;   // countdown for perfect landing flash
  var deadScore;

  // stack: array of placed blocks (bottom-first)
  // Each: { x, w, y (top edge in virtual canvas), colorIdx }
  var stack;

  // slider: the moving block
  // { x, w, dir (+1 right / -1 left), speed }
  var slider;

  // Falling overhang chunks for visual effect
  var fallers; // [{ x, y, w, vy, colorIdx }]

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _colorOf(idx) {
    return PASTEL_COLORS[idx % PASTEL_COLORS.length];
  }

  function _sliderSpeed() {
    return Math.min(BASE_SPEED + score * SPEED_INC, MAX_SPEED);
  }

  // Virtual y → screen y (with camera)
  function _sv(vy) {
    return vy - camY;
  }

  // Top-edge virtual-y of the topmost stack block
  function _stackTopY() {
    if (stack.length === 0) return FLOOR_Y;
    return stack[stack.length - 1].y;
  }

  // Desired slider top-edge (one block above top of stack)
  function _sliderY() {
    return _stackTopY() - BLOCK_H;
  }

  // ── Spawn a new slider ─────────────────────────────────────────────────────
  function _spawnSlider() {
    var top = stack[stack.length - 1];
    var fromLeft = (score % 2 === 0); // alternates each block
    slider = {
      x:     fromLeft ? -top.w : VW,
      w:     top.w,
      dir:   fromLeft ? 1 : -1,
      speed: _sliderSpeed(),
    };
  }

  // ── Update camera to keep stack top visible ────────────────────────────────
  function _updateCamera() {
    var desired = _stackTopY() - CAMERA_MARGIN;
    if (desired > camY) {
      camY = desired;
    }
  }

  // ── Death ──────────────────────────────────────────────────────────────────
  function _die() {
    deadScore = score;
    if (score > best) best = score;
    state = 'DEAD';
    try { Audio.play('crash'); } catch (e) {}
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  // ── Place the slider block ─────────────────────────────────────────────────
  function _placeBlock() {
    var top = stack[stack.length - 1];

    var sL = slider.x;
    var sR = slider.x + slider.w;
    var tL = top.x;
    var tR = top.x + top.w;

    var oL = sL > tL ? sL : tL; // Math.max
    var oR = sR < tR ? sR : tR; // Math.min
    var overlap = oR - oL;

    if (overlap <= 0) {
      _die();
      return;
    }

    // Check for perfect landing (overlap covers almost all of the top block)
    var isPerfect = (top.w - overlap) <= PERFECT_TOL;
    var newW, newX;

    if (isPerfect) {
      // Snap to exact position of the top block
      newW = top.w;
      newX = top.x;
      score += 1;
      flashTimer = FLASH_DUR;
      try { Audio.play('gem'); } catch (e) {}
    } else {
      newW = overlap;
      newX = oL;

      if (newW < MIN_BLOCK_W) {
        _die();
        return;
      }

      // Spawn falling overhang
      if (sL < tL) {
        fallers.push({ x: sL, y: _sliderY(), w: tL - sL, vy: 0, colorIdx: stack.length });
      }
      if (sR > tR) {
        fallers.push({ x: tR, y: _sliderY(), w: sR - tR, vy: 0, colorIdx: stack.length });
      }

      score += 1;
      try { Audio.play('tap'); } catch (e) {}
    }

    stack.push({
      x:        newX,
      w:        newW,
      y:        _sliderY(),
      colorIdx: stack.length,
    });

    _updateCamera();
    _spawnSlider();
  }

  // ── Start / reset game ─────────────────────────────────────────────────────
  function _startGame() {
    score      = 0;
    camY       = 0;
    flashTimer = 0;
    fallers    = [];

    // Base block
    var baseX = (VW - BASE_W) / 2;
    stack = [{
      x:        baseX,
      w:        BASE_W,
      y:        FLOOR_Y,
      colorIdx: 0,
    }];

    _spawnSlider();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function init(canvas, bestScore) {
    _canvas    = canvas;
    _ctx       = canvas.getContext('2d');
    best       = bestScore || 0;
    state      = 'MENU';
    score      = 0;
    deadScore  = 0;
    camY       = 0;
    flashTimer = 0;
    stack      = [];
    fallers    = [];
    slider     = null;
  }

  function tap(x, y) {
    if (state === 'MENU') {
      _startGame();
      return;
    }
    if (state === 'DEAD') {
      try {
        AdManager.showInterstitial(function () { _startGame(); });
      } catch (e) {
        _startGame();
      }
      return;
    }
    if (state === 'PLAYING') {
      _placeBlock();
    }
  }

  function update(dt) {
    if (state !== 'PLAYING' || !slider) return;

    if (flashTimer > 0) flashTimer -= dt;

    // Move slider — bounce at canvas edges
    slider.x += slider.dir * slider.speed * dt;
    if (slider.dir === 1 && slider.x + slider.w > VW) {
      slider.x  = VW - slider.w;
      slider.dir = -1;
    } else if (slider.dir === -1 && slider.x < 0) {
      slider.x  = 0;
      slider.dir = 1;
    }

    // Animate falling overhang chunks
    for (var i = fallers.length - 1; i >= 0; i--) {
      fallers[i].vy += 600 * dt;
      fallers[i].y  += fallers[i].vy * dt;
      if (fallers[i].y > VH + 200) {
        fallers.splice(i, 1);
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    _drawBackground(ctx);

    if (state === 'MENU')    { _drawMenu(ctx);    return; }
    if (state === 'PLAYING') { _drawPlaying(ctx); return; }
    if (state === 'DEAD')    { _drawDead(ctx);    return; }
  }

  // ── Background: pastel sky gradient + clouds ───────────────────────────────
  function _drawBackground(ctx) {
    // Sky gradient
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0,   '#c9e8ff'); // light blue at top
    grad.addColorStop(0.5, '#ddd0f5'); // lavender mid
    grad.addColorStop(1,   '#f9e4f0'); // soft pink at bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // Subtle horizon glow
    var horiz = ctx.createLinearGradient(0, VH - 200, 0, VH);
    horiz.addColorStop(0, 'rgba(255,200,220,0)');
    horiz.addColorStop(1, 'rgba(255,180,200,0.35)');
    ctx.fillStyle = horiz;
    ctx.fillRect(0, VH - 200, VW, 200);

    // Clouds (shifted by camY for parallax feel at 30%)
    var cloudShift = camY * 0.3;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (var ci = 0; ci < CLOUDS.length; ci++) {
      var cx = CLOUDS[ci].x;
      var cy = ((CLOUDS[ci].y - cloudShift % (VH + 100) + VH + 100)) % (VH + 100) - 50;
      var cr = CLOUDS[ci].r;
      ctx.beginPath();
      ctx.arc(cx,          cy,          cr,       0, Math.PI * 2);
      ctx.arc(cx + cr,     cy + cr * 0.3, cr * 0.75, 0, Math.PI * 2);
      ctx.arc(cx - cr * 0.8, cy + cr * 0.3, cr * 0.7,  0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ground strip at virtual bottom (screen-space)
    var groundScreenY = _sv(FLOOR_Y + BLOCK_H);
    ctx.save();
    var groundGrad = ctx.createLinearGradient(0, groundScreenY, 0, groundScreenY + 80);
    groundGrad.addColorStop(0, '#b5d5a0');
    groundGrad.addColorStop(1, '#8ab87a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundScreenY, VW, VH - groundScreenY + 80);
    // Grass top line
    ctx.strokeStyle = '#7fba6e';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(VW, groundScreenY);
    ctx.stroke();
    ctx.restore();
  }

  // ── Draw a single pastel block ─────────────────────────────────────────────
  function _drawBlock(ctx, x, y, w, colorIdx, alpha) {
    if (w < 1) return;
    var col = _colorOf(colorIdx);
    ctx.save();
    if (typeof alpha === 'number') ctx.globalAlpha = alpha;

    // Main block
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 6;
    ctx.fillRect(x, y, w, BLOCK_H);

    ctx.shadowBlur = 0;

    // Top highlight
    ctx.fillStyle   = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x, y, w, 5);

    // Left highlight
    ctx.fillStyle   = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y, 4, BLOCK_H);

    // Bottom shadow
    ctx.fillStyle   = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + BLOCK_H - 4, w, 4);

    // Right shadow
    ctx.fillStyle   = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + w - 3, y, 3, BLOCK_H);

    // Thin border
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, BLOCK_H - 1);

    ctx.restore();
  }

  // ── Draw PLAYING state ─────────────────────────────────────────────────────
  function _drawPlaying(ctx) {
    var perfect = (flashTimer > 0);

    // Falling overhang chunks
    for (var fi = 0; fi < fallers.length; fi++) {
      var f = fallers[fi];
      var alpha = 0.7;
      _drawBlock(ctx, f.x, _sv(f.y), f.w, f.colorIdx, alpha);
    }

    // Stack blocks
    for (var bi = 0; bi < stack.length; bi++) {
      var b  = stack[bi];
      var sy = _sv(b.y);
      if (sy > VH + BLOCK_H) continue;   // below screen
      if (sy + BLOCK_H < 0) continue;    // above screen
      if (perfect) {
        // Flash all white
        ctx.save();
        ctx.fillStyle   = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur  = 18;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(b.x, sy, b.w, BLOCK_H);
        ctx.restore();
      } else {
        _drawBlock(ctx, b.x, sy, b.w, b.colorIdx, 1);
      }
    }

    // Slider block
    if (slider) {
      var slY = _sv(_sliderY());
      _drawBlock(ctx, slider.x, slY, slider.w, stack.length, 1);

      // Guide lines showing where block will land (alignment guides)
      var topBlock = stack[stack.length - 1];
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(topBlock.x, slY + BLOCK_H);
      ctx.lineTo(topBlock.x, _sv(topBlock.y));
      ctx.stroke();
      ctx.moveTo(topBlock.x + topBlock.w, slY + BLOCK_H);
      ctx.lineTo(topBlock.x + topBlock.w, _sv(topBlock.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Perfect flash overlay
    if (perfect) {
      ctx.save();
      ctx.globalAlpha = (flashTimer / FLASH_DUR) * 0.3;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }

    // Score HUD
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = 'bold 52px system-ui, Arial, sans-serif';
    ctx.fillStyle    = 'rgba(80,50,100,0.85)';
    ctx.shadowColor  = 'rgba(200,150,220,0.5)';
    ctx.shadowBlur   = 10;
    ctx.fillText(score, VW / 2, 24);
    ctx.shadowBlur   = 0;
    ctx.font         = '14px system-ui, Arial, sans-serif';
    ctx.fillStyle    = 'rgba(100,70,130,0.7)';
    ctx.fillText('BEST ' + best, VW / 2, 80);
    ctx.restore();
  }

  // ── Draw MENU state ────────────────────────────────────────────────────────
  function _drawMenu(ctx) {
    // Decorative mini-tower preview
    var demoW   = 180;
    var demoBot = VH - 100;
    for (var di = 0; di < 7; di++) {
      var shrink = di * 10;
      var bw = demoW - shrink;
      var bx = (VW - bw) / 2;
      var by = demoBot - (di + 1) * BLOCK_H;
      _drawBlock(ctx, bx, by, bw, di, 1);
    }

    // Title panel background
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    _roundRect(ctx, 40, 160, VW - 80, 260, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,130,200,0.5)';
    ctx.lineWidth   = 2;
    _roundRect(ctx, 40, 160, VW - 80, 260, 22);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.font      = 'bold 54px system-ui, Arial, sans-serif';
    ctx.fillStyle = '#9b59b6';
    ctx.shadowColor = 'rgba(155,89,182,0.4)';
    ctx.shadowBlur  = 14;
    ctx.fillText('TOWER', VW / 2, 228);
    ctx.fillStyle = '#e67e22';
    ctx.shadowColor = 'rgba(230,126,34,0.4)';
    ctx.fillText('BUILD', VW / 2, 288);
    ctx.shadowBlur  = 0;

    // Best score
    if (best > 0) {
      ctx.font      = 'bold 16px system-ui, Arial, sans-serif';
      ctx.fillStyle = 'rgba(100,60,130,0.85)';
      ctx.fillText('BEST: ' + best, VW / 2, 340);
    }

    // Tap to play — pulsing
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.0035);
    ctx.globalAlpha = pulse;
    ctx.font        = 'bold 22px system-ui, Arial, sans-serif';
    ctx.fillStyle   = '#e74c3c';
    ctx.fillText('TAP TO PLAY', VW / 2, 390);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── Draw DEAD state ────────────────────────────────────────────────────────
  function _drawDead(ctx) {
    // Show frozen stack (dimmed)
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (var bi = 0; bi < stack.length; bi++) {
      var b  = stack[bi];
      var sy = _sv(b.y);
      if (sy > VH + BLOCK_H || sy + BLOCK_H < 0) continue;
      _drawBlock(ctx, b.x, sy, b.w, b.colorIdx, 1);
    }
    ctx.restore();

    // Dim overlay
    ctx.save();
    ctx.fillStyle = 'rgba(50,20,70,0.6)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Result panel
    var panX = 40;
    var panY = VH / 2 - 170;
    var panW = VW - 80;
    var panH = 340;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    _roundRect(ctx, panX, panY, panW, panH, 24);
    ctx.fill();
    ctx.strokeStyle = '#d6aef0';
    ctx.lineWidth   = 2.5;
    _roundRect(ctx, panX, panY, panW, panH, 24);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // "GAME OVER"
    ctx.font      = 'bold 40px system-ui, Arial, sans-serif';
    ctx.fillStyle = '#c0392b';
    ctx.shadowColor = 'rgba(192,57,43,0.35)';
    ctx.shadowBlur  = 12;
    ctx.fillText('GAME OVER', VW / 2, panY + 56);
    ctx.shadowBlur  = 0;

    // Divider
    ctx.strokeStyle = '#e8d0f5';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(panX + 30, panY + 90);
    ctx.lineTo(panX + panW - 30, panY + 90);
    ctx.stroke();

    // Score label
    ctx.font      = '16px system-ui, Arial, sans-serif';
    ctx.fillStyle = 'rgba(120,80,160,0.7)';
    ctx.fillText('SCORE', VW / 2, panY + 122);

    // Score value
    ctx.font        = 'bold 76px system-ui, Arial, sans-serif';
    ctx.fillStyle   = '#6c3483';
    ctx.shadowColor = 'rgba(108,52,131,0.3)';
    ctx.shadowBlur  = 10;
    ctx.fillText(deadScore, VW / 2, panY + 196);
    ctx.shadowBlur  = 0;

    // Best
    ctx.font      = '15px system-ui, Arial, sans-serif';
    ctx.fillStyle = '#e67e22';
    ctx.fillText('BEST: ' + best, VW / 2, panY + 262);

    // Tap to retry — pulsing
    var pulse2 = 0.6 + 0.4 * Math.sin(Date.now() * 0.004);
    ctx.globalAlpha = pulse2;
    ctx.font        = 'bold 20px system-ui, Arial, sans-serif';
    ctx.fillStyle   = '#c0392b';
    ctx.fillText('TAP TO RETRY', VW / 2, panY + 306);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── Rounded rect path helper ───────────────────────────────────────────────
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  function getBest() { return best; }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest,
  };
})();
