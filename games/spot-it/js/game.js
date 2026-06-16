'use strict';
var SpotIt = (function () {
  var VW = 390, VH = 844;
  var ctx, _best, _score, _state;
  var _round, _bonus, _bonusTimer, _flash, _flashTimer;
  var BONUS_FULL = 5; // seconds

  // 8 symbol types
  var SYMBOLS = ['star', 'circle', 'triangle', 'square', 'diamond', 'cross', 'hexagon', 'arrow'];
  var COLORS = ['#00fff7', '#ff00cc', '#39ff14', '#ffe600', '#ff6600', '#a855f7', '#00bfff', '#ff4040'];

  // Each circle holds 8 symbols; exactly one matches
  var _circleA, _circleB; // arrays of {sym, color, x, y, size, rot}
  var _matchSym;           // the symbol that appears in both
  var _particles = [];

  // ─── Symbol drawing ──────────────────────────────────────────────────────────
  function drawSym(cx2, x, y, sym, size, color, alpha) {
    cx2.save();
    cx2.globalAlpha = alpha !== undefined ? alpha : 1;
    cx2.strokeStyle = color;
    cx2.fillStyle = color;
    cx2.lineWidth = Math.max(2, size * 0.12);
    cx2.shadowBlur = 10;
    cx2.shadowColor = color;
    cx2.translate(x, y);

    var r = size * 0.5;
    cx2.beginPath();

    if (sym === 'star') {
      for (var i = 0; i < 10; i++) {
        var a = (i * Math.PI / 5) - Math.PI / 2;
        var rr = i % 2 === 0 ? r : r * 0.42;
        var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i === 0 ? cx2.moveTo(px, py) : cx2.lineTo(px, py);
      }
      cx2.closePath();
      cx2.fill();
    } else if (sym === 'circle') {
      cx2.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      cx2.stroke();
    } else if (sym === 'triangle') {
      for (var i = 0; i < 3; i++) {
        var a = (i * Math.PI * 2 / 3) - Math.PI / 2;
        var px = Math.cos(a) * r, py = Math.sin(a) * r;
        i === 0 ? cx2.moveTo(px, py) : cx2.lineTo(px, py);
      }
      cx2.closePath();
      cx2.stroke();
    } else if (sym === 'square') {
      var h = r * 0.78;
      cx2.rect(-h, -h, h * 2, h * 2);
      cx2.stroke();
    } else if (sym === 'diamond') {
      cx2.moveTo(0, -r);
      cx2.lineTo(r * 0.7, 0);
      cx2.lineTo(0, r);
      cx2.lineTo(-r * 0.7, 0);
      cx2.closePath();
      cx2.stroke();
    } else if (sym === 'cross') {
      var t = r * 0.24, h2 = r * 0.78;
      cx2.rect(-t, -h2, t * 2, h2 * 2);
      cx2.fill();
      cx2.beginPath();
      cx2.rect(-h2, -t, h2 * 2, t * 2);
      cx2.fill();
    } else if (sym === 'hexagon') {
      for (var i = 0; i < 6; i++) {
        var a = (i * Math.PI / 3) - Math.PI / 6;
        var px = Math.cos(a) * r, py = Math.sin(a) * r;
        i === 0 ? cx2.moveTo(px, py) : cx2.lineTo(px, py);
      }
      cx2.closePath();
      cx2.stroke();
    } else if (sym === 'arrow') {
      var hw = r * 0.5;
      cx2.moveTo(-r * 0.7, -hw * 0.55);
      cx2.lineTo(r * 0.1, -hw * 0.55);
      cx2.lineTo(r * 0.1, -hw);
      cx2.lineTo(r, 0);
      cx2.lineTo(r * 0.1, hw);
      cx2.lineTo(r * 0.1, hw * 0.55);
      cx2.lineTo(-r * 0.7, hw * 0.55);
      cx2.closePath();
      cx2.fill();
    }

    cx2.restore();
  }

  // ─── Particle system ─────────────────────────────────────────────────────────
  function spawnParticles(x, y, color) {
    for (var i = 0; i < 18; i++) {
      var a = Math.random() * Math.PI * 2;
      var spd = 80 + Math.random() * 160;
      _particles.push({ x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, color: color, r: 3 + Math.random() * 4 });
    }
  }

  // ─── Round generation ─────────────────────────────────────────────────────────
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function placeSymbols(cx, cy, r, syms) {
    var result = [];
    var n = syms.length;
    // Place symbols in a circular layout within the circle
    for (var i = 0; i < n; i++) {
      var angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      var dist = r * 0.55;
      var jx = (Math.random() - 0.5) * r * 0.22;
      var jy = (Math.random() - 0.5) * r * 0.22;
      result.push({
        sym: syms[i],
        color: COLORS[SYMBOLS.indexOf(syms[i])],
        x: cx + Math.cos(angle) * dist + jx,
        y: cy + Math.sin(angle) * dist + jy,
        size: 28 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2
      });
    }
    return result;
  }

  function newRound() {
    var symsA = shuffle(SYMBOLS.slice()).slice(0, 8);
    // Pick the match symbol - one from symsA will also appear in B
    _matchSym = symsA[Math.floor(Math.random() * 8)];
    // Build symsB: different 7 symbols + the match
    var pool = SYMBOLS.filter(function (s) { return symsA.indexOf(s) < 0; });
    // If pool is too small (shouldn't happen with 8 symbols), reuse some
    var symsB = [_matchSym];
    var remaining = shuffle(SYMBOLS.filter(function (s) { return s !== _matchSym; })).slice(0, 7);
    symsB = symsB.concat(remaining);
    symsB = shuffle(symsB);

    var circR = 148;
    var cAx = VW / 2, cAy = 270;
    var cBx = VW / 2, cBy = 580;

    _circleA = placeSymbols(cAx, cAy, circR, symsA);
    _circleB = placeSymbols(cBx, cBy, circR, symsB);
    _bonusTimer = BONUS_FULL;
    _round++;
  }

  // ─── Hit testing ─────────────────────────────────────────────────────────────
  function hitTest(syms, x, y) {
    for (var i = 0; i < syms.length; i++) {
      var s = syms[i];
      var d = Math.sqrt((x - s.x) * (x - s.x) + (y - s.y) * (y - s.y));
      if (d < s.size * 0.7) return s;
    }
    return null;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  function init(canvas, best) {
    ctx = canvas.getContext('2d');
    _best = best || 0;
    _score = 0;
    _state = 'MENU';
    _round = 0;
    _particles = [];
    _flash = null;
    _flashTimer = 0;
  }

  function update(dt) {
    // Update particles
    for (var i = _particles.length - 1; i >= 0; i--) {
      var p = _particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) _particles.splice(i, 1);
    }
    if (_flashTimer > 0) _flashTimer -= dt;

    if (_state !== 'PLAYING') return;
    _bonusTimer -= dt;
    if (_bonusTimer < 0) _bonusTimer = 0;
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _score = 0;
      _round = 0;
      _particles = [];
      _state = 'PLAYING';
      newRound();
      try { Audio.play('button'); } catch (e) {}
      return;
    }
    if (_state === 'DEAD') {
      _state = 'MENU';
      return;
    }
    if (_state === 'PLAYING') {
      // Check tap on either circle
      var hitA = hitTest(_circleA, x, y);
      var hitB = hitTest(_circleB, x, y);
      var hit = hitA || hitB;
      if (!hit) return;

      if (hit.sym === _matchSym) {
        // Correct!
        var pts = 1 + Math.floor(_bonusTimer / BONUS_FULL * 4); // 1-5 bonus points
        _score += pts;
        if (_score > _best) _best = _score;
        _flash = { text: '+' + pts, color: '#39ff14', timer: 1 };
        _flashTimer = 1;
        spawnParticles(hit.x, hit.y, hit.color);
        try { Audio.play('gem'); } catch (e) {}
        newRound();
      } else {
        // Wrong!
        _flash = { text: 'WRONG!', color: '#ff00cc', timer: 1 };
        _flashTimer = 1;
        spawnParticles(hit.x, hit.y, '#ff00cc');
        try { Audio.play('lose'); } catch (e) {}
        _state = 'DEAD';
        try { AdManager.onRunEnd(); } catch (e) {}
      }
    }
  }

  // ─── Drawing helpers ──────────────────────────────────────────────────────────
  function drawCircleBorder(cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBonusBar() {
    var barW = VW - 80, barH = 14, bx = 40, by = 120;
    var frac = _bonusTimer / BONUS_FULL;
    var col = frac > 0.5 ? '#39ff14' : frac > 0.25 ? '#ffe600' : '#ff00cc';
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 7);
    ctx.stroke();
    if (frac > 0) {
      ctx.fillStyle = col;
      ctx.shadowBlur = 12;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW * frac, barH, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    // Background
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      drawMenu();
    } else if (_state === 'PLAYING') {
      drawPlaying();
    } else if (_state === 'DEAD') {
      drawDead();
    }

    // Particles always
    for (var i = 0; i < _particles.length; i++) {
      var p = _particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flash
    if (_flashTimer > 0 && _flash) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, _flashTimer);
      ctx.font = 'bold 52px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = _flash.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = _flash.color;
      ctx.fillText(_flash.text, VW / 2, VH / 2 - 20);
      ctx.restore();
    }
  }

  function drawMenu() {
    ctx.save();
    // Title
    ctx.font = 'bold 58px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00fff7';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00fff7';
    ctx.fillText('SPOT IT', VW / 2, 200);
    ctx.shadowBlur = 0;

    // Description
    ctx.font = '20px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Find the matching symbol', VW / 2, 258);
    ctx.fillText('in both circles!', VW / 2, 284);

    // Sample symbols preview
    var sampleSyms = ['star', 'diamond', 'hexagon', 'cross'];
    for (var i = 0; i < sampleSyms.length; i++) {
      var x = VW / 2 - 60 + i * 40;
      drawSym(ctx, x, 350, sampleSyms[i], 28, COLORS[SYMBOLS.indexOf(sampleSyms[i])]);
    }

    // Best score
    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffe600';
    ctx.fillText('BEST: ' + _best, VW / 2, 430);
    ctx.shadowBlur = 0;

    // TAP TO PLAY
    ctx.font = 'bold 28px system-ui';
    ctx.fillStyle = '#ffffff';
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO PLAY', VW / 2, 530);
    ctx.globalAlpha = 1;

    // Faster = more points tip
    ctx.font = '16px system-ui';
    ctx.fillStyle = 'rgba(168,237,234,0.6)';
    ctx.fillText('Speed bonus: find it faster for more points!', VW / 2, 600);
    ctx.restore();
  }

  function drawPlaying() {
    var circR = 148;
    var cAx = VW / 2, cAy = 270;
    var cBx = VW / 2, cBy = 580;

    // Score & round
    ctx.save();
    ctx.font = 'bold 28px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, 50);
    ctx.font = '16px system-ui';
    ctx.fillStyle = 'rgba(168,237,234,0.7)';
    ctx.fillText('Round ' + _round, VW / 2, 75);
    ctx.restore();

    // Bonus bar
    drawBonusBar();

    // Divider label
    ctx.save();
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Find the match!', VW / 2, VH / 2 - 2);
    ctx.restore();

    // Draw circles
    drawCircleBorder(cAx, cAy, circR, '#00fff7');
    drawCircleBorder(cBx, cBy, circR, '#ff00cc');

    // Draw symbols in circle A
    for (var i = 0; i < _circleA.length; i++) {
      var s = _circleA[i];
      drawSym(ctx, s.x, s.y, s.sym, s.size, s.color);
    }
    // Draw symbols in circle B
    for (var i = 0; i < _circleB.length; i++) {
      var s = _circleB[i];
      drawSym(ctx, s.x, s.y, s.sym, s.size, s.color);
    }
  }

  function drawDead() {
    ctx.save();
    ctx.font = 'bold 60px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff00cc';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff00cc';
    ctx.fillText('GAME OVER', VW / 2, 280);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 40px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, 360);

    ctx.font = 'bold 26px system-ui';
    ctx.fillStyle = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffe600';
    ctx.fillText('Best: ' + _best, VW / 2, 420);
    ctx.shadowBlur = 0;

    // Highlight the match they missed
    ctx.font = '20px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('The match was:', VW / 2, 490);
    drawSym(ctx, VW / 2, 540, _matchSym, 48, COLORS[SYMBOLS.indexOf(_matchSym)]);

    ctx.font = 'bold 26px system-ui';
    ctx.fillStyle = '#ffffff';
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO RETRY', VW / 2, 650);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function getBest() { return _best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
