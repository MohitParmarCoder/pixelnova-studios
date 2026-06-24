'use strict';
/* ============================================================
   Pixel Trace -> Dot to Dot
   Virtual canvas: 390 x 844
   Namespace: PixelTrace
   ============================================================ */
var PixelTrace = (function () {

  var VW = 390, VH = 844;

  var NUM_DOTS   = 15;
  var TIME_LIMIT = 20;
  var DOT_R      = 22;

  /* 3 preset dot layouts (normalised 0..1 coords within play area) */
  var LAYOUTS = [
    /* star */
    [
      [0.50, 0.14], [0.66, 0.32], [0.90, 0.30], [0.74, 0.50],
      [0.80, 0.74], [0.50, 0.60], [0.20, 0.74], [0.26, 0.50],
      [0.10, 0.30], [0.34, 0.32], [0.50, 0.40], [0.64, 0.24],
      [0.36, 0.24], [0.50, 0.52], [0.50, 0.80]
    ],
    /* house */
    [
      [0.50, 0.15], [0.72, 0.28], [0.88, 0.40], [0.88, 0.70],
      [0.72, 0.82], [0.50, 0.82], [0.28, 0.82], [0.12, 0.70],
      [0.12, 0.40], [0.28, 0.28], [0.50, 0.50], [0.65, 0.60],
      [0.35, 0.60], [0.50, 0.68], [0.50, 0.38]
    ],
    /* fish */
    [
      [0.18, 0.45], [0.12, 0.30], [0.28, 0.28], [0.45, 0.30],
      [0.62, 0.28], [0.75, 0.38], [0.85, 0.45], [0.75, 0.52],
      [0.62, 0.62], [0.45, 0.65], [0.28, 0.62], [0.12, 0.60],
      [0.18, 0.55], [0.35, 0.45], [0.55, 0.45]
    ]
  ];

  var AREA_X1 = 30, AREA_X2 = 360;
  var AREA_Y1 = 160, AREA_Y2 = 800;
  var AREA_W  = AREA_X2 - AREA_X1;
  var AREA_H  = AREA_Y2 - AREA_Y1;

  /* ── State ──────────────────────────────────────────────────── */
  var _canvas, _ctx;
  var _state;
  var _best;
  var _score, _lives;
  var _pulseT;

  var _dots;
  var _nextDot;
  var _lines;
  var _timeLeft;
  var _layoutIdx;
  var _showComplete;
  var _wrongFlash;

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _snd(name) {
    try { Audio.play(name); } catch (e) {}
  }

  function _dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function _makeDots(layoutIdx) {
    var layout = LAYOUTS[layoutIdx % LAYOUTS.length];
    var d = [], i;
    for (i = 0; i < NUM_DOTS; i++) {
      d.push({
        x:   AREA_X1 + layout[i][0] * AREA_W,
        y:   AREA_Y1 + layout[i][1] * AREA_H,
        num: i + 1,
        hit: false
      });
    }
    return d;
  }

  function _newRound() {
    _dots         = _makeDots(_layoutIdx);
    _nextDot      = 1;
    _lines        = [];
    _timeLeft     = TIME_LIMIT;
    _showComplete = -1;
  }

  /* ── Public: init ────────────────────────────────────────────── */
  function init(canvas, bestScore) {
    _canvas     = canvas;
    _ctx        = canvas.getContext('2d');
    _best       = bestScore || 0;
    _state      = 'MENU';
    _pulseT     = 0;
    _score      = 0;
    _lives      = 3;
    _layoutIdx  = 0;
    _wrongFlash = 0;
    _newRound();
  }

  /* ── Public: tap ─────────────────────────────────────────────── */
  function tap(tapX, tapY) {
    if (_state === 'MENU') {
      _startGame();
      return;
    }
    if (_state === 'DEAD') {
      init(_canvas, _best);
      return;
    }
    if (_state !== 'PLAYING') return;
    if (_showComplete >= 0) return;

    var i, d;
    for (i = 0; i < NUM_DOTS; i++) {
      d = _dots[i];
      if (d.hit) continue;
      if (_dist(tapX, tapY, d.x, d.y) <= DOT_R + 12) {
        if (d.num === _nextDot) {
          d.hit = true;
          _snd('gem');
          if (_nextDot > 1) {
            var prev = _dots[_nextDot - 2];
            _lines.push({ x1: prev.x, y1: prev.y, x2: d.x, y2: d.y });
          }
          _score++;
          if (_score > _best) { _best = _score; AdManager.happyTime(1.0); }
          _nextDot++;
          if (_nextDot > NUM_DOTS) {
            _showComplete = 0;
          }
        } else {
          _snd('crash');
          _wrongFlash = 0.4;
          _lives--;
          if (_lives <= 0) {
            _endGame();
          }
        }
        return;
      }
    }
  }

  function _startGame() {
    _score      = 0;
    _lives      = 3;
    _layoutIdx  = 0;
    _wrongFlash = 0;
    _newRound();
    try { AdManager.gameplayStart(); } catch (e) {}
    _state = 'PLAYING';
  }

  function _endGame() {
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd();     } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(_score, 'pixeltrace_best'); } catch(e) {}
    _state = 'DEAD';
  }

  /* ── Public: update ──────────────────────────────────────────── */
  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    _pulseT += dt;
    if (_wrongFlash > 0) _wrongFlash -= dt;

    if (_state === 'PLAYING') {
      if (_showComplete >= 0) {
        _showComplete += dt;
        if (_showComplete > 1.2) {
          _layoutIdx++;
          _newRound();
        }
        return;
      }

      _timeLeft -= dt;
      if (_timeLeft <= 0) {
        _snd('lose');
        _lives--;
        if (_lives <= 0) {
          _endGame();
        } else {
          _newRound();
        }
      }
    }
  }

  /* ── Public: draw ────────────────────────────────────────────── */
  function draw() {
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#10102a');
    bg.addColorStop(1, '#1a1a40');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenu(ctx);
    } else if (_state === 'PLAYING') {
      _drawGame(ctx);
    } else {
      _drawGame(ctx);
      _drawDead(ctx);
    }
  }

  function _drawMenu(ctx) {
    _text(ctx, 'DOT TO DOT', VW / 2, 200, 44, '#FFD700', 'center', '#FFA500');
    _text(ctx, 'Tap dots in order 1 to 15', VW / 2, 275, 20, '#cccccc', 'center');
    _text(ctx, 'Wrong dot = lose a life', VW / 2, 310, 20, '#ff8888', 'center');
    _text(ctx, '20 seconds per round', VW / 2, 345, 20, '#88aaff', 'center');

    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO PLAY', VW / 2, 500, 28, '#00FF88', 'center', '#00FF88');
    ctx.globalAlpha = 1;

    if (_best > 0) {
      _text(ctx, 'BEST: ' + _best, VW / 2, 560, 20, '#FFDD44', 'center', '#FFAA00');
    }
  }

  function _drawGame(ctx) {
    _text(ctx, 'DOT TO DOT', VW / 2, 50, 26, '#FFD700', 'center', '#FFA500');
    _text(ctx, 'Score: ' + _score, 20, 90, 20, '#ffffff', 'left');
    _drawLives(ctx, VW - 20, 90);

    /* timer bar */
    var frac = Math.max(0, _timeLeft / TIME_LIMIT);
    var barColor = frac > 0.5 ? '#00DD44' : (frac > 0.25 ? '#FFAA00' : '#FF4444');
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    _fillRoundRect(ctx, 20, 110, VW - 40, 10, 5);
    ctx.fillStyle = barColor;
    _fillRoundRect(ctx, 20, 110, Math.max(0, (VW - 40) * frac), 10, 5);
    _text(ctx, '' + Math.ceil(_timeLeft) + 's', VW / 2, 133, 14, '#aaaaaa', 'center');

    if (_showComplete < 0) {
      _text(ctx, 'Next: ' + _nextDot, VW / 2, 155, 20, '#44CCFF', 'center', '#22AAEE');
    } else {
      _text(ctx, 'COMPLETE!', VW / 2, 155, 24, '#00FF88', 'center', '#00FF88');
    }

    if (_wrongFlash > 0) {
      ctx.fillStyle = 'rgba(255,0,0,' + Math.min(0.3, _wrongFlash) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }

    /* lines */
    ctx.strokeStyle = '#44CCFF';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#44CCFF';
    ctx.shadowBlur  = 8;
    var i;
    for (i = 0; i < _lines.length; i++) {
      var ln = _lines[i];
      ctx.beginPath();
      ctx.moveTo(ln.x1, ln.y1);
      ctx.lineTo(ln.x2, ln.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    /* dots */
    var d, isNext, isHit, pulse;
    for (i = 0; i < NUM_DOTS; i++) {
      d      = _dots[i];
      isNext = (d.num === _nextDot);
      isHit  = d.hit;

      if (isHit) {
        ctx.fillStyle   = '#00CC55';
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur  = 12;
      } else if (isNext) {
        pulse = 0.7 + 0.3 * Math.sin(_pulseT * 5);
        ctx.fillStyle   = '#FFD700';
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur  = 18 * pulse;
      } else {
        ctx.fillStyle  = '#2a3a6a';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isHit ? '#00FF88' : (isNext ? '#FFD700' : '#5577aa');
      ctx.lineWidth   = 2;
      ctx.stroke();

      _text(ctx, '' + d.num, d.x, d.y, isHit ? 14 : 16, '#ffffff', 'center');
    }
  }

  function _drawDead(ctx) {
    ctx.fillStyle = 'rgba(5, 10, 30, 0.80)';
    ctx.fillRect(0, 0, VW, VH);

    _text(ctx, 'GAME OVER', VW / 2, 330, 48, '#FF3366', 'center', '#FF3366');
    _text(ctx, 'Score: ' + _score, VW / 2, 410, 30, '#ffffff', 'center');
    _text(ctx, 'Best:  ' + _best,  VW / 2, 456, 22, '#FFDD44', 'center', '#FFAA00');

    var pulse = 0.55 + 0.45 * Math.sin(_pulseT * 3.0);
    ctx.globalAlpha = pulse;
    _text(ctx, 'TAP TO RETRY', VW / 2, 560, 28, '#44CCFF', 'center', '#44CCFF');
    ctx.globalAlpha = 1;
  }

  function _drawLives(ctx, rightX, y) {
    var i;
    for (i = 0; i < 3; i++) {
      var hx = rightX - (3 - i) * 28;
      ctx.font         = '22px Arial';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = i < _lives ? '#FF4466' : '#444466';
      ctx.fillText(i < _lives ? '♥' : '♡', hx, y);
    }
  }

  function _fillRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }

  function _text(ctx, str, x, y, size, color, align, glow) {
    ctx.font         = 'bold ' + size + 'px Arial, sans-serif';
    ctx.textAlign    = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = color;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 16;
    }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function getBest() {
    return _best;
  }

  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

})();
