'use strict';
var WallRise = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score, time, bonusScore;
  var COLS = 6, COL_W, COL_PAD = 4;
  var BRICK_H = 44, TOP_MARGIN = 100, BOTTOM_MARGIN = 120;
  var PLAY_H, MAX_BRICKS;
  var columns;       // array of arrays of bricks [{mult}]
  var riseAcc;       // accumulator for brick-rise timing
  var riseInterval;  // seconds between each rise step
  var flashParticles;
  var scoreAnim;     // [{val, x, y, life}]

  function _reset() {
    state = 'MENU';
    score = 0;
    time = 0;
  }

  function _startGame() {
    state = 'PLAYING';
    score = 0;
    bonusScore = 0;
    time = 0;
    riseAcc = 0;
    riseInterval = 2.2;
    PLAY_H = VH - TOP_MARGIN - BOTTOM_MARGIN;
    MAX_BRICKS = Math.floor(PLAY_H / BRICK_H);
    COL_W = Math.floor((VW - COL_PAD * (COLS + 1)) / COLS);
    columns = [];
    flashParticles = [];
    scoreAnim = [];
    for (var i = 0; i < COLS; i++) {
      columns.push([]);
    }
    // Seed a few starting bricks
    for (var c = 0; c < COLS; c++) {
      var count = 2 + Math.floor(Math.random() * 2);
      for (var b = 0; b < count; b++) {
        _addBrick(c);
      }
    }
    try { Audio.play('land'); } catch (e) {}
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function _addBrick(col) {
    var mult = 1;
    var r = Math.random();
    if (r < 0.12) mult = 3;
    else if (r < 0.28) mult = 2;
    columns[col].unshift({ mult: mult });
  }

  function _riseStep() {
    // Add one brick to every column, then check game over
    for (var i = 0; i < COLS; i++) {
      _addBrick(i);
    }
    // Speed up over time
    riseInterval = Math.max(0.55, riseInterval * 0.97);
  }

  function _checkGameOver() {
    for (var i = 0; i < COLS; i++) {
      if (columns[i].length >= MAX_BRICKS) return true;
    }
    return false;
  }

  function _spawnScoreAnim(x, y, val) {
    scoreAnim.push({ val: val, x: x, y: y, life: 1.0 });
  }

  function _spawnFlash(cx, cy, color) {
    for (var i = 0; i < 8; i++) {
      var ang = (i / 8) * Math.PI * 2;
      var spd = 80 + Math.random() * 80;
      flashParticles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.7, maxLife: 0.7,
        color: color, r: 4 + Math.random() * 3
      });
    }
  }

  function init(canvas, savedBest) {
    ctx = canvas.getContext('2d');
    best = savedBest || 0;
    COL_W = Math.floor((VW - COL_PAD * (COLS + 1)) / COLS);
    PLAY_H = VH - TOP_MARGIN - BOTTOM_MARGIN;
    MAX_BRICKS = Math.floor(PLAY_H / BRICK_H);
    _reset();
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    time += dt;
    score = Math.floor(time * 8) + bonusScore;

    riseAcc += dt;
    if (riseAcc >= riseInterval) {
      riseAcc -= riseInterval;
      _riseStep();
    }

    if (_checkGameOver()) {
      state = 'DEAD';
      if (score > best) { best = score; AdManager.happyTime(1.0); }
      try { Audio.play('lose'); } catch (e) {}
      try { AdManager.gameplayStop(); } catch (e) {}
      try { AdManager.onRunEnd(); } catch (e) {}
    }

    // Update particles
    for (var i = flashParticles.length - 1; i >= 0; i--) {
      var p = flashParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) flashParticles.splice(i, 1);
    }
    for (var j = scoreAnim.length - 1; j >= 0; j--) {
      var sa = scoreAnim[j];
      sa.y -= 60 * dt;
      sa.life -= dt * 1.5;
      if (sa.life <= 0) scoreAnim.splice(j, 1);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { _startGame(); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function () { _startGame(); }); } catch (e) { _startGame(); }
      try { AdManager.offerDoubleScore(score, 'wallrise_best'); } catch(e) {}
      return;
    }
    if (state !== 'PLAYING') return;

    // Which column was tapped?
    var col = -1;
    for (var i = 0; i < COLS; i++) {
      var colX = COL_PAD + i * (COL_W + COL_PAD);
      if (x >= colX && x < colX + COL_W) { col = i; break; }
    }
    if (col < 0 || columns[col].length === 0) {
      try { Audio.play('tap'); } catch (e) {}
      return;
    }

    // Remove top brick (index 0 = topmost)
    var brick = columns[col].shift();
    var mult = brick.mult;
    var bonus = mult === 3 ? 150 : mult === 2 ? 60 : 10;
    bonusScore += bonus;

    var colX = COL_PAD + col * (COL_W + COL_PAD);
    var brickY = TOP_MARGIN + (MAX_BRICKS - columns[col].length - 1) * BRICK_H;
    var cx = colX + COL_W / 2;
    var cy = brickY + BRICK_H / 2;

    var color = mult >= 3 ? '#ffe600' : mult >= 2 ? '#ff6600' : '#00fff7';
    _spawnFlash(cx, cy, color);
    _spawnScoreAnim(cx, cy, '+' + bonus);

    if (mult >= 2) {
      try { Audio.play('gem'); } catch (e) {}
    } else {
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function _colX(i) {
    return COL_PAD + i * (COL_W + COL_PAD);
  }

  function _brickColor(mult) {
    if (mult >= 3) return { fill: '#ff6600', glow: '#ffe600', text: '#fff' };
    if (mult >= 2) return { fill: '#cc00ff', glow: '#ff00cc', text: '#fff' };
    return { fill: '#003a55', glow: '#00fff7', text: '#00fff7' };
  }

  function _drawBrick(bx, by, bw, bh, mult) {
    var c = _brickColor(mult);
    ctx.save();
    // Glow
    ctx.shadowBlur = mult > 1 ? 14 : 6;
    ctx.shadowColor = c.glow;
    // Fill
    ctx.fillStyle = c.fill;
    ctx.beginPath();
    var r = 6;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    // Highlight stripe
    ctx.shadowBlur = 0;
    var hg = ctx.createLinearGradient(bx, by, bx, by + bh * 0.5);
    hg.addColorStop(0, 'rgba(255,255,255,0.18)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fill();
    // Border
    ctx.strokeStyle = c.glow;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Multiplier text
    if (mult > 1) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = c.glow;
      ctx.fillStyle = c.text;
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mult + 'x', bx + bw / 2, by + bh / 2);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    // Background
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      _drawMenu();
    } else if (state === 'PLAYING' || state === 'DEAD') {
      _drawPlay();
      if (state === 'DEAD') _drawDead();
    }
  }

  function _drawMenu() {
    // Subtle grid bg
    ctx.strokeStyle = 'rgba(0,255,247,0.06)';
    ctx.lineWidth = 1;
    for (var x = 0; x < VW; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke();
    }
    for (var y = 0; y < VH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }

    ctx.save();
    ctx.textAlign = 'center';
    // Title
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00fff7';
    ctx.fillStyle = '#00fff7';
    ctx.fillText('WALL', VW / 2, VH / 2 - 60);
    ctx.fillStyle = '#ff00cc';
    ctx.shadowColor = '#ff00cc';
    ctx.fillText('RISE', VW / 2, VH / 2);

    ctx.shadowBlur = 0;
    ctx.font = '16px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Tap columns to remove bricks', VW / 2, VH / 2 + 60);
    ctx.fillText('Don\'t let them reach the top!', VW / 2, VH / 2 + 85);

    // Pulse tap text
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 160);

    if (best > 0) {
      ctx.fillStyle = 'rgba(255,230,0,0.7)';
      ctx.font = '15px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 200);
    }
    ctx.restore();
  }

  function _drawPlay() {
    // Column backgrounds
    for (var i = 0; i < COLS; i++) {
      var bx = _colX(i);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(bx, TOP_MARGIN, COL_W, PLAY_H);
      // Danger tint when column almost full
      var fill = columns[i].length / MAX_BRICKS;
      if (fill > 0.6) {
        ctx.fillStyle = 'rgba(255,0,0,' + ((fill - 0.6) * 0.3) + ')';
        ctx.fillRect(bx, TOP_MARGIN, COL_W, PLAY_H);
      }
    }

    // Danger line at top
    ctx.strokeStyle = 'rgba(255,50,50,0.4)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, TOP_MARGIN);
    ctx.lineTo(VW, TOP_MARGIN);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bricks
    var bp = 3;
    for (var ci = 0; ci < COLS; ci++) {
      var col = columns[ci];
      var bx = _colX(ci);
      for (var bi = 0; bi < col.length; bi++) {
        // bi=0 is top brick, bi=col.length-1 is bottom
        var rowFromBottom = col.length - 1 - bi;
        var by = TOP_MARGIN + PLAY_H - (rowFromBottom + 1) * BRICK_H + bp;
        _drawBrick(bx + bp, by, COL_W - bp * 2, BRICK_H - bp * 2, col[bi].mult);
      }
    }

    // Particles
    for (var pi = 0; pi < flashParticles.length; pi++) {
      var p = flashParticles[pi];
      var alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score anim
    for (var si = 0; si < scoreAnim.length; si++) {
      var sa = scoreAnim[si];
      ctx.save();
      ctx.globalAlpha = sa.life;
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffe600';
      ctx.fillText(sa.val, sa.x, sa.y);
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px system-ui';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00fff7';
    ctx.fillText(score, VW / 2, 56);
    ctx.fillStyle = 'rgba(255,230,0,0.7)';
    ctx.font = '13px system-ui';
    ctx.shadowBlur = 0;
    ctx.fillText('BEST ' + best, VW / 2, 78);
    ctx.restore();
  }

  function _drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,14,0.78)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';

    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff00cc';
    ctx.fillStyle = '#ff00cc';
    ctx.fillText('GAME', VW / 2, VH / 2 - 70);
    ctx.fillStyle = '#ff6600';
    ctx.shadowColor = '#ff6600';
    ctx.fillText('OVER', VW / 2, VH / 2 - 10);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 + 50);

    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.font = '16px system-ui';
    ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 85);

    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 150);
    ctx.restore();
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
