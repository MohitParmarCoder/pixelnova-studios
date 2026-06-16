'use strict';
var ShapeRecall = (function () {
  var VW = 390, VH = 844;
  var ctx, _best, _score, _state;

  // Sub-states within PLAYING
  var SUB = { SHOW: 'show', ANSWER: 'answer', FEEDBACK: 'feedback' };
  var _sub, _subTimer;

  var SHAPE_TYPES = ['triangle', 'circle', 'square'];
  var SHAPE_COLORS = { triangle: '#ff00cc', circle: '#00fff7', square: '#39ff14' };

  var _shapes = [];       // {type, x, y, size}
  var _targetType;        // which shape to count
  var _correctCount;
  var _round, _showTime;
  var _feedbackCorrect;
  var _particles = [];

  // Answer buttons
  var BTNS_PER_ROW = 5;
  var BTN_W = 60, BTN_H = 60, BTN_GAP = 8;
  var _btns = []; // {label, x, y, w, h}

  function buildBtns() {
    _btns = [];
    var startX = (VW - (BTNS_PER_ROW * BTN_W + (BTNS_PER_ROW - 1) * BTN_GAP)) / 2;
    var row0y = VH - 210;
    for (var n = 0; n <= 9; n++) {
      var col = n % BTNS_PER_ROW;
      var row = Math.floor(n / BTNS_PER_ROW);
      var bx = startX + col * (BTN_W + BTN_GAP);
      var by = row0y + row * (BTN_H + BTN_GAP);
      _btns.push({ label: n, x: bx, y: by, w: BTN_W, h: BTN_H });
    }
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function newRound() {
    _round++;
    // Number of shapes grows with rounds, max 20
    var n = Math.min(10 + _round, 20);
    // Show time shrinks with rounds: starts at 2.5s, down to 1s
    _showTime = Math.max(1.0, 2.5 - _round * 0.12);

    _shapes = [];
    // Pick target type
    _targetType = SHAPE_TYPES[Math.floor(Math.random() * 3)];
    // Number of targets: 1 to min(n-1, 8)
    var maxTarget = Math.min(n - 1, 8);
    _correctCount = 1 + Math.floor(Math.random() * maxTarget);
    var otherCount = n - _correctCount;

    // Build shape list
    var typeList = [];
    for (var i = 0; i < _correctCount; i++) typeList.push(_targetType);
    var others = SHAPE_TYPES.filter(function (t) { return t !== _targetType; });
    for (var i = 0; i < otherCount; i++) typeList.push(others[i % 2]);
    typeList = shuffle(typeList);

    // Place randomly with collision avoidance (simple)
    var placed = [];
    var margin = 40;
    var playH = VH - 320; // play area
    var playTop = 160;
    for (var i = 0; i < typeList.length; i++) {
      var sz = 28 + Math.random() * 14;
      var attempts = 0, ok = false, px, py;
      while (attempts < 30 && !ok) {
        px = margin + sz + Math.random() * (VW - 2 * margin - sz * 2);
        py = playTop + sz + Math.random() * (playH - sz * 2);
        ok = true;
        for (var j = 0; j < placed.length; j++) {
          var dx = px - placed[j].x, dy = py - placed[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < sz + placed[j].size + 4) { ok = false; break; }
        }
        attempts++;
      }
      var obj = { type: typeList[i], x: px, y: py, size: sz };
      placed.push(obj);
      _shapes.push(obj);
    }

    _sub = SUB.SHOW;
    _subTimer = _showTime;
  }

  function spawnParticles(x, y, color) {
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 130;
      _particles.push({ x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, color: color, r: 3 + Math.random() * 4 });
    }
  }

  // ─── Drawing shapes ───────────────────────────────────────────────────────────
  function drawShape(type, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '44';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.beginPath();
    if (type === 'circle') {
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'triangle') {
      var r = size * 0.55;
      for (var i = 0; i < 3; i++) {
        var a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else if (type === 'square') {
      var h = size * 0.45;
      ctx.rect(x - h, y - h, h * 2, h * 2);
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  function init(canvas, best) {
    ctx = canvas.getContext('2d');
    _best = best || 0;
    _score = 0;
    _round = 0;
    _state = 'MENU';
    _particles = [];
    buildBtns();
  }

  function update(dt) {
    for (var i = _particles.length - 1; i >= 0; i--) {
      var p = _particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt * 1.5;
      if (p.life <= 0) _particles.splice(i, 1);
    }

    if (_state !== 'PLAYING') return;

    _subTimer -= dt;
    if (_sub === SUB.SHOW && _subTimer <= 0) {
      _sub = SUB.ANSWER;
      _subTimer = 0;
    }
    if (_sub === SUB.FEEDBACK && _subTimer <= 0) {
      if (_feedbackCorrect) {
        newRound();
      } else {
        _state = 'DEAD';
        try { AdManager.onRunEnd(); } catch (e) {}
      }
    }
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
    if (_state === 'PLAYING' && _sub === SUB.ANSWER) {
      for (var i = 0; i < _btns.length; i++) {
        var b = _btns[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          var answer = b.label;
          if (answer === _correctCount) {
            // Correct!
            _score++;
            if (_score > _best) _best = _score;
            _feedbackCorrect = true;
            spawnParticles(VW / 2, VH / 2, '#39ff14');
            try { Audio.play('gem'); } catch (e) {}
          } else {
            _feedbackCorrect = false;
            spawnParticles(VW / 2, VH / 2, '#ff00cc');
            try { Audio.play('lose'); } catch (e) {}
          }
          _sub = SUB.FEEDBACK;
          _subTimer = 1.2;
          return;
        }
      }
    }
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      drawMenu();
    } else if (_state === 'PLAYING') {
      drawPlaying();
    } else if (_state === 'DEAD') {
      drawDead();
    }

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
  }

  function drawMenu() {
    ctx.save();
    ctx.font = 'bold 52px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff00cc';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff00cc';
    ctx.fillText('SHAPE RECALL', VW / 2, 190);
    ctx.shadowBlur = 0;

    ctx.font = '20px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Memorize the shapes,', VW / 2, 250);
    ctx.fillText('then count them!', VW / 2, 278);

    // Sample shapes
    drawShape('triangle', VW / 2 - 70, 360, 48, '#ff00cc');
    drawShape('circle', VW / 2, 360, 48, '#00fff7');
    drawShape('square', VW / 2 + 70, 360, 48, '#39ff14');

    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffe600';
    ctx.fillText('BEST: ' + _best, VW / 2, 460);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 28px system-ui';
    ctx.fillStyle = '#ffffff';
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO PLAY', VW / 2, 560);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlaying() {
    ctx.save();
    // Score
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, 44);
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(168,237,234,0.6)';
    ctx.fillText('Round ' + _round + '  •  Best: ' + _best, VW / 2, 68);
    ctx.restore();

    if (_sub === SUB.SHOW) {
      // Show shapes
      for (var i = 0; i < _shapes.length; i++) {
        var s = _shapes[i];
        drawShape(s.type, s.x, s.y, s.size, SHAPE_COLORS[s.type]);
      }
      // Timer bar
      var frac = _subTimer / _showTime;
      var barW = VW - 60;
      ctx.save();
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39ff14';
      ctx.beginPath();
      ctx.roundRect(30, 90, barW * frac, 8, 4);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('MEMORIZE!', VW / 2, 116);
      ctx.restore();

    } else if (_sub === SUB.ANSWER) {
      // Question
      var col = SHAPE_COLORS[_targetType];
      ctx.save();
      ctx.font = 'bold 28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('How many', VW / 2, 170);

      ctx.font = 'bold 40px system-ui';
      ctx.fillStyle = col;
      ctx.shadowBlur = 16;
      ctx.shadowColor = col;
      ctx.fillText(_targetType.toUpperCase() + 'S?', VW / 2, 225);
      ctx.shadowBlur = 0;

      // Show target shape example
      drawShape(_targetType, VW / 2, 295, 52, col);
      ctx.restore();

      // Number buttons
      for (var i = 0; i < _btns.length; i++) {
        var b = _btns[i];
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 10);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 26px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.66);
        ctx.restore();
      }

    } else if (_sub === SUB.FEEDBACK) {
      if (_feedbackCorrect) {
        ctx.save();
        ctx.font = 'bold 52px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#39ff14';
        ctx.shadowBlur = 28;
        ctx.shadowColor = '#39ff14';
        ctx.fillText('CORRECT!', VW / 2, VH / 2 - 20);
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = 'bold 52px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff00cc';
        ctx.shadowBlur = 28;
        ctx.shadowColor = '#ff00cc';
        ctx.fillText('WRONG!', VW / 2, VH / 2 - 40);
        ctx.font = '28px system-ui';
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('It was ' + _correctCount, VW / 2, VH / 2 + 20);
        ctx.restore();
      }
    }
  }

  function drawDead() {
    ctx.save();
    ctx.font = 'bold 58px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff00cc';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff00cc';
    ctx.fillText('GAME OVER', VW / 2, 280);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 38px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, 360);

    ctx.font = 'bold 24px system-ui';
    ctx.fillStyle = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffe600';
    ctx.fillText('Best: ' + _best, VW / 2, 410);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 26px system-ui';
    ctx.fillStyle = '#ffffff';
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function getBest() { return _best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
