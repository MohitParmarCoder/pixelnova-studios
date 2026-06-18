'use strict';

const NeonSnake = (() => {
  // ── Virtual canvas dimensions ──────────────────────────────────────────────
  const VW = 390, VH = 844;

  // ── Grid constants ─────────────────────────────────────────────────────────
  const COLS = 18, ROWS = 24, CELL = 18;
  const GX = (VW - COLS * CELL) / 2;   // 9
  const GY = (VH - ROWS * CELL) / 2;   // 206

  // ── Colours ────────────────────────────────────────────────────────────────
  const C_BG        = '#080810';
  const C_GRID      = '#111120';
  const C_BORDER    = '#1a1a35';
  const C_SNAKE_H   = '#44ffaa';
  const C_SNAKE_B   = '#00ff66';
  const C_SNAKE_GLO = '#00ff66';
  const C_FOOD      = '#ff2266';
  const C_POWER     = '#ffdd00';
  const C_SCORE_TXT = '#ccffdd';
  const C_TITLE     = '#00ff66';
  const C_DEAD      = '#ff2266';
  const C_UI_DIM    = '#aabbcc';

  // ── Timing ─────────────────────────────────────────────────────────────────
  const INTERVAL_START = 0.18;
  const INTERVAL_MIN   = 0.08;
  const SPEED_EVERY    = 5;   // foods eaten before speed bump
  const POWER_EVERY    = 7;   // every N foods, spawn a power-up
  const POWER_DURATION = 8.0; // seconds power-up stays on board

  // ── Directions ─────────────────────────────────────────────────────────────
  const DIR = { R:[1,0], L:[-1,0], U:[0,-1], D:[0,1] };

  // ── State ──────────────────────────────────────────────────────────────────
  let state = 'MENU'; // MENU | PLAYING | DEAD
  let snake, dir, nextDir;
  let food, powerFood, powerTimer;
  let score, best, foodsEaten;
  let interval, timer;
  let _canvas, _ctx;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function cellToScreen(c, r) {
    return [GX + c * CELL, GY + r * CELL];
  }

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  function emptyCells() {
    const occupied = new Set(snake.map(s => s[0] + ',' + s[1]));
    const cells = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!occupied.has(c + ',' + r)) cells.push([c, r]);
      }
    }
    return cells;
  }

  function placeFood() {
    const cells = emptyCells().filter(([c, r]) => {
      if (!powerFood) return true;
      return !(c === powerFood[0] && r === powerFood[1]);
    });
    if (!cells.length) return null;
    return cells[rnd(0, cells.length - 1)];
  }

  function placePowerFood() {
    const cells = emptyCells().filter(([c, r]) => {
      return !(c === food[0] && r === food[1]);
    });
    if (!cells.length) return null;
    return cells[rnd(0, cells.length - 1)];
  }

  function loadBest() {
    try { best = parseInt(localStorage.getItem('nsnake_best') || '0', 10) || 0; } catch(e) { best = 0; }
  }
  function saveBest() {
    try { localStorage.setItem('nsnake_best', String(best)); } catch(e) {}
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(canvas) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    loadBest();
  }

  // ── Game reset ─────────────────────────────────────────────────────────────
  function startGame() {
    // Snake starts at center, length 3, moving right
    const sc = Math.floor(COLS / 2) - 1;
    const sr = Math.floor(ROWS / 2);
    snake     = [[sc, sr], [sc - 1, sr], [sc - 2, sr]];
    dir       = DIR.R;
    nextDir   = DIR.R;
    score     = 0;
    foodsEaten = 0;
    interval  = INTERVAL_START;
    timer     = 0;
    powerFood  = null;
    powerTimer = 0;
    food = placeFood();
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    if (state !== 'PLAYING') return;

    // Power food timer
    if (powerFood) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerFood = null;
        powerTimer = 0;
      }
    }

    timer += dt;
    if (timer < interval) return;
    timer -= interval;

    // Commit next direction (no 180-degree reversal)
    if (!(nextDir[0] === -dir[0] && nextDir[1] === -dir[1])) {
      dir = nextDir;
    }

    // Compute new head
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];

    // Wall collision
    if (head[0] < 0 || head[0] >= COLS || head[1] < 0 || head[1] >= ROWS) {
      die(); return;
    }

    // Self collision
    for (let i = 0; i < snake.length; i++) {
      if (snake[i][0] === head[0] && snake[i][1] === head[1]) {
        die(); return;
      }
    }

    // Move snake forward
    snake.unshift(head);

    // Check food
    if (head[0] === food[0] && head[1] === food[1]) {
      // Grow (don't pop tail)
      score += 1;
      foodsEaten += 1;
      if (score > best) { best = score; saveBest(); }
      try { Audio.play('gem'); } catch(e) {}

      // Speed up every SPEED_EVERY foods
      if (foodsEaten % SPEED_EVERY === 0) {
        interval = Math.max(INTERVAL_MIN, interval - 0.015);
      }

      // Spawn power food every POWER_EVERY foods
      if (foodsEaten % POWER_EVERY === 0) {
        const pf = placePowerFood();
        if (pf) { powerFood = pf; powerTimer = POWER_DURATION; }
      }

      food = placeFood();
      if (!food) {
        // Board full — player wins (treat as continue with same state)
        food = [0, 0];
      }
    } else if (powerFood && head[0] === powerFood[0] && head[1] === powerFood[1]) {
      // Grow (don't pop tail)
      score += 5;
      if (score > best) { best = score; saveBest(); }
      try { Audio.play('power'); } catch(e) {}
      powerFood  = null;
      powerTimer = 0;
    } else {
      // Normal move: remove tail
      snake.pop();
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) { best = score; saveBest(); }
    try { Audio.play('lose'); } catch(e) {}
    AdManager.gameplayStop();
    AdManager.onRunEnd();
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(getScore ? getScore() : (_score || score || 0), 'nsnake_best'); } catch(e) {}
  }

  // ── Swipe / direction input ────────────────────────────────────────────────
  function swipe(dx, dy) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }

    if (dx === 1  && dy === 0) nextDir = DIR.R;
    if (dx === -1 && dy === 0) nextDir = DIR.L;
    if (dx === 0  && dy === 1) nextDir = DIR.D;
    if (dx === 0  && dy === -1) nextDir = DIR.U;
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
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

  function drawStar(ctx, cx, cy, r, points, inner) {
    const step = Math.PI / points;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : inner;
      const angle = i * step - Math.PI / 2;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function setGlow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
  }

  function clearGlow(ctx) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
  }

  // ── Draw background & grid ─────────────────────────────────────────────────
  function drawGrid(ctx) {
    // Background
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, VW, VH);

    // Grid area background
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(GX, GY, COLS * CELL, ROWS * CELL);

    // Grid lines
    ctx.strokeStyle = C_GRID;
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(GX + c * CELL, GY);
      ctx.lineTo(GX + c * CELL, GY + ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(GX, GY + r * CELL);
      ctx.lineTo(GX + COLS * CELL, GY + r * CELL);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = C_BORDER;
    ctx.lineWidth   = 1.5;
    setGlow(ctx, '#2233aa', 6);
    ctx.strokeRect(GX - 1, GY - 1, COLS * CELL + 2, ROWS * CELL + 2);
    clearGlow(ctx);
  }

  // ── Draw snake ─────────────────────────────────────────────────────────────
  function drawSnake(ctx) {
    const PAD = 2;
    const R   = 4;
    const S   = CELL - PAD * 2;

    for (let i = snake.length - 1; i >= 0; i--) {
      const [c, r] = snake[i];
      const [sx, sy] = cellToScreen(c, r);
      const isHead = i === 0;

      const color = isHead ? C_SNAKE_H : C_SNAKE_B;
      const glow  = isHead ? 14 : 8;

      setGlow(ctx, C_SNAKE_GLO, glow);
      ctx.fillStyle = color;
      roundRect(ctx, sx + PAD, sy + PAD, S, S, R);
      ctx.fill();
      clearGlow(ctx);

      // Subtle inner highlight
      ctx.fillStyle = isHead ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
      roundRect(ctx, sx + PAD + 2, sy + PAD + 2, S - 4, S / 3, 2);
      ctx.fill();

      // Eyes on head
      if (isHead) {
        ctx.fillStyle = '#ffffff';
        const eyeR = 2.2;
        // Determine eye positions based on direction
        let ex1, ey1, ex2, ey2;
        const cx = sx + CELL / 2, cy = sy + CELL / 2;
        if (dir[0] === 1) {          // right
          ex1 = cx + 3; ey1 = cy - 3;
          ex2 = cx + 3; ey2 = cy + 3;
        } else if (dir[0] === -1) {  // left
          ex1 = cx - 3; ey1 = cy - 3;
          ex2 = cx - 3; ey2 = cy + 3;
        } else if (dir[1] === -1) {  // up
          ex1 = cx - 3; ey1 = cy - 3;
          ex2 = cx + 3; ey2 = cy - 3;
        } else {                     // down
          ex1 = cx - 3; ey1 = cy + 3;
          ex2 = cx + 3; ey2 = cy + 3;
        }
        ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#001a08';
        ctx.beginPath(); ctx.arc(ex1 + dir[0], ey1 + dir[1], 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2 + dir[0], ey2 + dir[1], 1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ── Draw food ──────────────────────────────────────────────────────────────
  function drawFood(ctx, time) {
    if (!food) return;
    const [c, r] = food;
    const [sx, sy] = cellToScreen(c, r);
    const cx = sx + CELL / 2, cy = sy + CELL / 2;
    const pulse = 1 + 0.1 * Math.sin(time * 5);
    const radius = (CELL / 2 - 2) * pulse;

    setGlow(ctx, C_FOOD, 14);
    ctx.fillStyle = C_FOOD;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    clearGlow(ctx);

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPowerFood(ctx, time) {
    if (!powerFood) return;
    const [c, r] = powerFood;
    const [sx, sy] = cellToScreen(c, r);
    const cx = sx + CELL / 2, cy = sy + CELL / 2;

    // Blink when about to expire
    if (powerTimer < 3 && Math.floor(time * 6) % 2 === 0) return;

    const rot = time * 1.5;
    const pulse = 1 + 0.12 * Math.sin(time * 4);
    const outerR = (CELL / 2 - 1) * pulse;
    const innerR = outerR * 0.45;

    setGlow(ctx, C_POWER, 18);
    ctx.fillStyle = C_POWER;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    drawStar(ctx, 0, 0, outerR, 5, innerR);
    ctx.fill();
    ctx.restore();
    clearGlow(ctx);

    // White core
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Draw HUD ───────────────────────────────────────────────────────────────
  function drawHUD(ctx) {
    const centerX = VW / 2;
    const topY    = GY / 2 - 10;

    // Score
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    setGlow(ctx, C_SNAKE_GLO, 10);
    ctx.fillStyle = C_SCORE_TXT;
    ctx.font      = 'bold 36px monospace';
    ctx.fillText(String(score), centerX, topY);
    clearGlow(ctx);

    // Best
    ctx.fillStyle = '#557766';
    ctx.font      = '14px monospace';
    ctx.fillText('BEST ' + best, centerX, topY + 26);
  }

  // ── Draw menu ──────────────────────────────────────────────────────────────
  function drawMenu(ctx, time) {
    drawGrid(ctx);

    const cx = VW / 2;

    // Title glow
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const titleY = VH / 2 - 80;
    ctx.font = 'bold 44px monospace';
    setGlow(ctx, C_TITLE, 28);
    ctx.fillStyle = C_TITLE;
    ctx.fillText('NEON', cx, titleY);
    ctx.fillText('SNAKE', cx, titleY + 54);
    clearGlow(ctx);

    // Decorative snake-like line
    ctx.strokeStyle = C_SNAKE_B;
    ctx.lineWidth   = 3;
    setGlow(ctx, C_SNAKE_GLO, 8);
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = cx - 80 + i * 4;
      const y = titleY + 90 + Math.sin(i * 0.5 + time * 2) * 8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    clearGlow(ctx);

    // Blink tap prompt
    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = '#aaccaa';
      ctx.font      = '18px monospace';
      ctx.fillText('TAP / SWIPE TO PLAY', cx, VH / 2 + 20);
    }

    // Controls hint
    ctx.fillStyle = '#445544';
    ctx.font      = '13px monospace';
    ctx.fillText('WASD · ARROWS · SWIPE', cx, VH / 2 + 60);

    // Best score
    ctx.fillStyle = '#557766';
    ctx.font      = '15px monospace';
    ctx.fillText('BEST: ' + best, cx, VH / 2 + 100);
  }

  // ── Draw dead screen ───────────────────────────────────────────────────────
  function drawDead(ctx, time) {
    drawGrid(ctx);
    drawSnake(ctx);
    if (food) drawFood(ctx, time);

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    const cx = VW / 2, cy = VH / 2 - 40;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // GAME OVER
    ctx.font = 'bold 42px monospace';
    setGlow(ctx, C_DEAD, 22);
    ctx.fillStyle = C_DEAD;
    ctx.fillText('GAME OVER', cx, cy);
    clearGlow(ctx);

    // Score
    ctx.font      = 'bold 28px monospace';
    ctx.fillStyle = C_SCORE_TXT;
    setGlow(ctx, C_SNAKE_GLO, 8);
    ctx.fillText('SCORE: ' + score, cx, cy + 52);
    clearGlow(ctx);

    // Best
    ctx.font      = '18px monospace';
    ctx.fillStyle = '#557766';
    ctx.fillText('BEST: ' + best, cx, cy + 88);

    // Blink retry
    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = '#aaaacc';
      ctx.font      = '18px monospace';
      ctx.fillText('TAP TO RETRY', cx, cy + 136);
    }
  }

  // ── Main draw ──────────────────────────────────────────────────────────────
  let _time = 0;

  function draw() {
    const ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu(ctx, _time);
      return;
    }

    if (state === 'DEAD') {
      drawDead(ctx, _time);
      return;
    }

    // PLAYING
    drawGrid(ctx);
    drawFood(ctx, _time);
    drawPowerFood(ctx, _time);
    drawSnake(ctx);
    drawHUD(ctx);
  }

  // ── Public update (dt in seconds) ─────────────────────────────────────────
  function updatePublic(dt) {
    _time += dt;
    update(dt);
  }

  function getScore() { return score; }
  function getState() { return state; }
  function getBest()  { return best; }
  return { init, update: updatePublic, draw, tap: swipe, swipe, getScore, getState, getBest };
})();
