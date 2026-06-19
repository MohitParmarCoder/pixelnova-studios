'use strict';
var SpotIt = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score, lives;
  var puzzle, oddIdx, timer, timerMax;
  var particles, flashText, flashTimer;

  // 12 distinct unicode symbols
  var SYMBOLS = ['★','●','■','▲','◆','♠','♣','♥','✿','⬟','⬡','☾'];
  // matching display colors for each symbol index
  var SYM_COLORS = ['#ffe600','#ff4040','#4488ff','#44ffaa','#ff66cc','#aa88ff','#66ffcc','#ff4444','#ffaa00','#00ddff','#aaffcc','#ccaaff'];

  var GRID_COLS = 4, GRID_ROWS = 4;
  var TIMER_DUR = 3.0;

  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

  function spawnParticles(x, y, col) {
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2;
      var spd = rnd(60, 180);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.8, maxLife: 0.8,
        r: rnd(3, 7),
        color: col
      });
    }
  }

  function newPuzzle() {
    var commonSym = Math.floor(Math.random() * SYMBOLS.length);
    var oddSym = (commonSym + 1 + Math.floor(Math.random() * (SYMBOLS.length - 1))) % SYMBOLS.length;

    var hardMode = (score >= 50);
    var commonColor = SYM_COLORS[commonSym];
    var oddSymbol, oddColor;
    if (hardMode) {
      // same symbol, different color
      oddSymbol = SYMBOLS[commonSym];
      var altColorIdx;
      do { altColorIdx = Math.floor(Math.random() * SYM_COLORS.length); } while (altColorIdx === commonSym);
      oddColor = SYM_COLORS[altColorIdx];
    } else {
      // different symbol
      oddSymbol = SYMBOLS[oddSym];
      oddColor = SYM_COLORS[oddSym];
    }

    var total = GRID_COLS * GRID_ROWS;
    oddIdx = Math.floor(Math.random() * total);

    puzzle = [];
    for (var i = 0; i < total; i++) {
      if (i === oddIdx) {
        puzzle.push({ sym: oddSymbol, color: oddColor });
      } else {
        puzzle.push({ sym: SYMBOLS[commonSym], color: commonColor });
      }
    }

    var dur = Math.max(1.0, TIMER_DUR - score * 0.04);
    timer = dur;
    timerMax = dur;
  }

  function startGame() {
    score = 0;
    lives = 3;
    particles = [];
    flashText = '';
    flashTimer = 0;
    state = 'PLAYING';
    newPuzzle();
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function init(canvas, bestScore) {
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    score = 0;
    lives = 3;
    particles = [];
    flashText = '';
    flashTimer = 0;
    puzzle = [];
    oddIdx = 0;
    timer = TIMER_DUR;
    timerMax = TIMER_DUR;
  }

  function update(dt) {
    var i, p;

    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (flashTimer > 0) flashTimer -= dt;

    if (state !== 'PLAYING') return;

    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      lives--;
      try { Audio.play('crash'); } catch(e) {}
      flashText = 'TIME!';
      flashTimer = 0.7;
      if (lives <= 0) {
        if (score > best) best = score;
        state = 'DEAD';
        try { Audio.play('lose'); } catch(e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'spotit_best'); } catch(e) {}
        return;
      }
      newPuzzle();
    }
  }

  function cellRect(idx) {
    var col = idx % GRID_COLS;
    var row = Math.floor(idx / GRID_COLS);
    var cellW = VW / GRID_COLS;
    var cellH = (VH - 160) / GRID_ROWS;
    var x = col * cellW;
    var y = 120 + row * cellH;
    return { x: x, y: y, w: cellW, h: cellH };
  }

  function drawHUD() {
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e53e3e';
    var heartsStr = '';
    for (var i = 0; i < 3; i++) {
      heartsStr += (i < lives) ? '♥' : '♡';
    }
    ctx.fillText(heartsStr, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(score, VW - 14, 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawTimerBar() {
    var frac = timer / timerMax;
    var barW = VW - 40;
    var barH = 10;
    var bx = 20, by = 54;
    var col;
    if (frac > 0.5) {
      col = '#ffe600';
    } else if (frac > 0.25) {
      col = '#ff9900';
    } else {
      col = '#ff2222';
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx, by, barW, barH);
    if (frac > 0) {
      ctx.fillStyle = col;
      ctx.shadowBlur = 10;
      ctx.shadowColor = col;
      ctx.fillRect(bx, by, barW * frac, barH);
      ctx.shadowBlur = 0;
    }
  }

  function draw() {
    var i, r, pt, pulse, p2;
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 56px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#ffe600';
      ctx.fillText('SPOT IT', VW / 2, 260);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '20px system-ui';
      ctx.fillText('Find the different symbol!', VW / 2, 330);
      ctx.fillText('3 seconds per puzzle', VW / 2, 358);

      for (i = 0; i < 4; i++) {
        ctx.fillStyle = SYM_COLORS[i * 3];
        ctx.shadowBlur = 8;
        ctx.shadowColor = SYM_COLORS[i * 3];
        ctx.font = 'bold 36px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SYMBOLS[i * 3], 60 + i * 90, 430);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
      ctx.globalAlpha = pulse;
      ctx.fillText('TAP TO PLAY', VW / 2, 510);
      ctx.globalAlpha = 1;
      if (best > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '20px system-ui';
        ctx.fillText('BEST: ' + best, VW / 2, 570);
      }
      ctx.textBaseline = 'alphabetic';
      return;
    }

    if (state === 'PLAYING' || state === 'DEAD') {
      for (i = 0; i < puzzle.length; i++) {
        r = cellRect(i);
        var cell = puzzle[i];
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        ctx.fillStyle = cell.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = cell.color;
        ctx.font = 'bold 36px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.sym, r.x + r.w / 2, r.y + r.h / 2);
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (state === 'PLAYING') drawTimerBar();
      drawHUD();
    }

    for (i = 0; i < particles.length; i++) {
      pt = particles[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    if (flashTimer > 0 && flashText) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffffff';
      ctx.fillText(flashText, VW / 2, VH / 2);
      ctx.restore();
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 52px system-ui';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, VH / 2 - 20);
      ctx.fillStyle = '#ffd700';
      ctx.font = '22px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui';
      p2 = 0.65 + 0.35 * Math.sin(Date.now() * 0.005);
      ctx.globalAlpha = p2;
      ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 80);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  function tap(x, y) {
    var i, r, timeBonus, pts;
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    for (i = 0; i < puzzle.length; i++) {
      r = cellRect(i);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        if (i === oddIdx) {
          timeBonus = Math.floor(timer * 3);
          pts = 10 + timeBonus;
          score += pts;
          if (score > best) best = score;
          flashText = '+' + pts;
          flashTimer = 0.6;
          spawnParticles(r.x + r.w / 2, r.y + r.h / 2, puzzle[i].color);
          try { Audio.play('gem'); } catch(e) {}
          newPuzzle();
        } else {
          lives--;
          flashText = 'WRONG!';
          flashTimer = 0.6;
          spawnParticles(r.x + r.w / 2, r.y + r.h / 2, '#ff4444');
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) {
            if (score > best) best = score;
            state = 'DEAD';
            try { Audio.play('lose'); } catch(e) {}
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'spotit_best'); } catch(e) {}
            return;
          }
          newPuzzle();
        }
        return;
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
