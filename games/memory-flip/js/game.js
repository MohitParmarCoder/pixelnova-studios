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
      AdManager.happyTime(0.8);
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

/* Memory Flip — card matching game. Flip two cards; match keeps them up.
   Clear all pairs to advance a level. A countdown timer runs you out = DEAD. */
var MemoryFlip = (function () {
  var VW = 390, VH = 844;

  var canvas, ctx;
  var state = 'MENU';               // 'MENU' | 'PLAYING' | 'WIN' | 'DEAD'
  var score = 0, _best = 0;
  var level = 1;
  var t = 0;                        // global animation time

  // Grid / layout
  var cols = 4, rows = 4;
  var cardW = 0, cardH = 0, gap = 12;
  var gridX = 0, gridY = 0;         // top-left of grid
  var boardTop = 180;               // y where grid area begins

  // Cards: { sym, x, y, w, h, flip (0=down..1=up), target, matched, faceUp }
  var cards = [];

  // Resolve logic
  var first = -1;                   // index of first flipped card
  var second = -1;                  // index of second flipped card
  var resolveTimer = 0;             // counts down mismatch hold before flipping back
  var moves = 0;

  // Timer
  var levelTime = 60;
  var timeLeft = 60;

  var winTimer = 0;                 // brief WIN banner before next level

  // Symbol definitions: id + color. Drawn as canvas shapes (no text/emoji).
  var SYMBOLS = [
    { id: 'star',     color: '#ffd23b' },
    { id: 'heart',    color: '#ff3b6b' },
    { id: 'circle',   color: '#33e1ff' },
    { id: 'triangle', color: '#2bff88' },
    { id: 'diamond',  color: '#7c4dff' },
    { id: 'square',   color: '#ff7a33' },
    { id: 'bolt',     color: '#ffe85c' },
    { id: 'moon',     color: '#c0d0ff' },
    { id: 'cross',    color: '#ff5ad6' },
    { id: 'ring',     color: '#5affc2' }
  ];

  var FLIP_SPEED = 1 / 0.18;        // full flip in ~0.18s
  var MISMATCH_HOLD = 0.6;          // seconds to show mismatch before flip back

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function rnd(n) { return Math.floor(Math.random() * n); }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = rnd(i + 1);
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // Build the grid for the current level.
  function gridForLevel(lv) {
    // level 1: 4x4 (8 pairs). Grow rows then cols, keep even card count.
    // 4x4 -> 4x5 -> 4x6 -> 5x6 ... cap so it fits the screen.
    var configs = [
      { c: 4, r: 4 },  // 16
      { c: 4, r: 5 },  // 20
      { c: 4, r: 6 },  // 24
      { c: 5, r: 6 }   // 30
    ];
    var idx = lv - 1;
    if (idx >= configs.length) idx = configs.length - 1;
    return configs[idx];
  }

  function layoutGrid() {
    var g = gridForLevel(level);
    cols = g.c; rows = g.r;

    var availW = VW - 24;                 // side margins
    var availH = VH - boardTop - 40;      // bottom margin

    // Compute card size that fits, capped near the spec (~80x96 at 4x4).
    var maxW = (availW - gap * (cols - 1)) / cols;
    var maxH = (availH - gap * (rows - 1)) / rows;
    cardW = Math.min(maxW, 80);
    cardH = Math.min(maxH, cardW * 1.2);  // keep a card-ish aspect
    // If height limits, re-derive width from height to stay proportional.
    if (cardH < cardW * 1.2) {
      cardW = Math.min(cardW, cardH / 1.2);
    }

    var totalW = cols * cardW + (cols - 1) * gap;
    var totalH = rows * cardH + (rows - 1) * gap;
    gridX = (VW - totalW) / 2;
    gridY = boardTop + (availH - totalH) / 2;
  }

  function buildBoard() {
    layoutGrid();
    var total = cols * rows;
    var pairs = total / 2;

    // Pick pairs symbols (cycle through SYMBOLS if not enough unique).
    var pool = [];
    for (var i = 0; i < pairs; i++) {
      var sym = SYMBOLS[i % SYMBOLS.length];
      pool.push(sym, sym);
    }
    shuffle(pool);

    cards = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i2 = r * cols + c;
        cards.push({
          sym: pool[i2],
          x: gridX + c * (cardW + gap),
          y: gridY + r * (cardH + gap),
          w: cardW,
          h: cardH,
          flip: 0,        // 0 = face down, 1 = face up
          target: 0,
          matched: false,
          pulse: 0        // little match celebration pulse
        });
      }
    }
  }

  function resetGame() {
    _msDone = {};
    score = 0;
    level = 1;
    startLevel();
  }

  function startLevel() {
    levelTime = Math.max(30, 60 - (level - 1) * 5);
    timeLeft = levelTime;
    moves = 0;
    first = -1;
    second = -1;
    resolveTimer = 0;
    winTimer = 0;
    buildBoard();
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function runEnded() {
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    try { AdManager.showInterstitial(function () {}); } catch (e) {}
    try { AdManager.offerDoubleScore(getScore(), 'memflip_best'); } catch(e) {}
  }

  function gameOver() {
    state = 'DEAD';
    vib([40,80,80]);
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
    snd('lose');
    runEnded();
  }

  function levelWin() {
    state = 'WIN';
    winTimer = 1.4;
    if (score > _best) { _best = score; AdManager.happyTime(1.0); }
    snd('power');
  }

  function allMatched() {
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].matched) return false;
    }
    return true;
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    level = 1;
    cards = [];
    t = 0;
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    t += dt;

    // Animate flips toward their targets always (so menus/dead still settle).
    for (var i = 0; i < cards.length; i++) {
      var cd = cards[i];
      if (cd.flip < cd.target) {
        cd.flip = Math.min(cd.target, cd.flip + FLIP_SPEED * dt);
      } else if (cd.flip > cd.target) {
        cd.flip = Math.max(cd.target, cd.flip - FLIP_SPEED * dt);
      }
      if (cd.pulse > 0) cd.pulse = Math.max(0, cd.pulse - dt * 2.5);
    }

    if (state === 'WIN') {
      winTimer -= dt;
      if (winTimer <= 0) {
        level++;
        startLevel();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
      }
      return;
    }

    if (state !== 'PLAYING') return;

    // Countdown timer.
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver();
      return;
    }

    // Resolve a mismatched pair after the hold delay.
    if (resolveTimer > 0) {
      resolveTimer -= dt;
      if (resolveTimer <= 0) {
        if (first >= 0) cards[first].target = 0;
        if (second >= 0) cards[second].target = 0;
        first = -1;
        second = -1;
      }
    }
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      startGame();
      snd('button');
      return;
    }
    if (state === 'DEAD') {
      try {
        AdManager.showInterstitial(function () { startGame(); });
      } catch (e) {
        startGame();
      }
      snd('button');
      return;
    }
    if (state === 'WIN') {
      // tap fast-forwards to next level
      winTimer = 0;
      return;
    }

    // PLAYING
    // Ignore taps while a mismatched pair is resolving.
    if (resolveTimer > 0) return;
    // Already have two face-up cards picked (waiting): ignore.
    if (first >= 0 && second >= 0) return;

    // Hit-test cards.
    for (var i = 0; i < cards.length; i++) {
      var cd = cards[i];
      if (cd.matched) continue;
      if (vx >= cd.x && vx <= cd.x + cd.w && vy >= cd.y && vy <= cd.y + cd.h) {
        if (i === first) return;          // already selected
        if (cd.target === 1) return;      // already face up

        cd.target = 1;
        snd('flip');

        if (first < 0) {
          first = i;
        } else {
          second = i;
          moves++;
          // Evaluate match.
          if (cards[first].sym.id === cards[second].sym.id) {
            cards[first].matched = true;
            cards[second].matched = true;
            cards[first].pulse = 1;
            cards[second].pulse = 1;
            var timeBonus = Math.floor(timeLeft);
            score += 100 + timeBonus;
            vib(8); _milestone(score);
            snd('score');
            first = -1;
            second = -1;
            if (allMatched()) {
              // Level clear bonus rewards remaining time.
              score += Math.floor(timeLeft) * 5;
              vib(8); _milestone(score);
              levelWin();
            }
          } else {
            // Mismatch: hold then flip both back.
            resolveTimer = MISMATCH_HOLD;
          }
        }
        return;
      }
    }
  }

  function getScore() { return score; }
  function getState() { return state; }
  function getBest() { return _best; }

  // ---- Rendering ----

  function clearBg() {
    ctx.fillStyle = '#101020';
    ctx.fillRect(0, 0, VW, VH);
    // subtle vignette grid glow
    var g = ctx.createRadialGradient(VW / 2, VH * 0.42, 40, VW / 2, VH * 0.42, VH * 0.7);
    g.addColorStop(0, 'rgba(60,40,120,0.18)');
    g.addColorStop(1, 'rgba(16,16,32,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function roundRect(x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw a symbol centered at (cx,cy) within a box of size s.
  function drawSymbol(sym, cx, cy, s) {
    var col = sym.color;
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, s * 0.08);
    var h = s / 2;

    switch (sym.id) {
      case 'star':
        starPath(cx, cy, h, h * 0.45, 5);
        ctx.fill();
        break;
      case 'heart':
        ctx.beginPath();
        ctx.moveTo(cx, cy + h * 0.75);
        ctx.bezierCurveTo(cx + h * 1.3, cy - h * 0.2, cx + h * 0.4, cy - h, cx, cy - h * 0.35);
        ctx.bezierCurveTo(cx - h * 0.4, cy - h, cx - h * 1.3, cy - h * 0.2, cx, cy + h * 0.75);
        ctx.fill();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(cx, cy, h * 0.85, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(cx, cy - h);
        ctx.lineTo(cx + h * 0.9, cy + h * 0.7);
        ctx.lineTo(cx - h * 0.9, cy + h * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - h);
        ctx.lineTo(cx + h * 0.75, cy);
        ctx.lineTo(cx, cy + h);
        ctx.lineTo(cx - h * 0.75, cy);
        ctx.closePath();
        ctx.fill();
        break;
      case 'square':
        roundRect(cx - h * 0.75, cy - h * 0.75, h * 1.5, h * 1.5, h * 0.2);
        ctx.fill();
        break;
      case 'bolt':
        ctx.beginPath();
        ctx.moveTo(cx + h * 0.25, cy - h);
        ctx.lineTo(cx - h * 0.55, cy + h * 0.1);
        ctx.lineTo(cx - h * 0.05, cy + h * 0.1);
        ctx.lineTo(cx - h * 0.25, cy + h);
        ctx.lineTo(cx + h * 0.6, cy - h * 0.15);
        ctx.lineTo(cx + h * 0.05, cy - h * 0.15);
        ctx.closePath();
        ctx.fill();
        break;
      case 'moon':
        ctx.beginPath();
        ctx.arc(cx + h * 0.15, cy, h * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx + h * 0.55, cy - h * 0.2, h * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'cross':
        var tk = h * 0.42;
        ctx.fillRect(cx - tk / 2, cy - h, tk, h * 2);
        ctx.fillRect(cx - h, cy - tk / 2, h * 2, tk);
        break;
      case 'ring':
        ctx.beginPath();
        ctx.arc(cx, cy, h * 0.8, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, s * 0.16);
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.arc(cx, cy, h * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  }

  function starPath(cx, cy, outer, inner, points) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var rad = (i % 2 === 0) ? outer : inner;
      var a = (Math.PI / points) * i - Math.PI / 2;
      var px = cx + Math.cos(a) * rad;
      var py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // Draw the "?" back glyph of a card.
  function drawCardBack(cx, cy, s) {
    ctx.save();
    ctx.shadowColor = '#33e1ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(120,200,255,0.85)';
    ctx.font = 'bold ' + Math.floor(s * 0.6) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + s * 0.02);
    ctx.restore();
  }

  function drawCard(cd) {
    var cx = cd.x + cd.w / 2;
    var cy = cd.y + cd.h / 2;

    // Horizontal flip: width scales by |cos(flip*PI)|; reveals at flip>=0.5.
    var p = cd.flip;
    var scaleX = Math.abs(Math.cos(p * Math.PI));
    if (scaleX < 0.02) scaleX = 0.02;
    var faceUp = p >= 0.5;

    var w = cd.w * scaleX;
    var x = cx - w / 2;
    var y = cd.y;
    var h = cd.h;

    var pulse = cd.pulse || 0;

    ctx.save();

    // Card body.
    var bodyCol = faceUp ? '#1a1a30' : '#16162a';
    if (cd.matched) bodyCol = '#1e2440';
    ctx.fillStyle = bodyCol;
    roundRect(x, y, w, h, 10);
    ctx.fill();

    // Neon border.
    var borderCol;
    if (cd.matched) {
      borderCol = cd.sym.color;
    } else if (faceUp) {
      borderCol = cd.sym.color;
    } else {
      borderCol = '#3b4d80';
    }
    ctx.shadowColor = borderCol;
    ctx.shadowBlur = (cd.matched ? 14 : 8) + pulse * 14;
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 2.5 + pulse * 2;
    roundRect(x + 1, y + 1, w - 2, h - 2, 9);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Contents (only when card is wide enough to read, i.e. near flat).
    if (scaleX > 0.35) {
      // Re-scale the contents horizontally so symbols squish with the card.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      var sz = Math.min(cd.w, cd.h) * 0.6;
      if (faceUp) {
        drawSymbol(cd.sym, 0, 0, sz);
      } else {
        drawCardBack(0, 0, sz);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawHUD() {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(score), VW / 2, 24);

    // Level + moves
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('LEVEL ' + level, 18, 30);
    ctx.textAlign = 'right';
    ctx.fillText('MOVES ' + moves, VW - 18, 30);

    // Timer bar
    var barX = 24, barY = 78, barW = VW - 48, barH = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    var frac = levelTime > 0 ? timeLeft / levelTime : 0;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;
    var col = frac > 0.5 ? '#2bff88' : (frac > 0.25 ? '#ffd23b' : '#ff3b6b');
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.fillStyle = col;
    if (frac > 0) {
      roundRect(barX, barY, barW * frac, barH, 8);
      ctx.fill();
    }
    ctx.restore();

    // seconds label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(timeLeft) + 's', VW / 2, barY + barH + 16);
  }

  function drawBoard() {
    for (var i = 0; i < cards.length; i++) {
      drawCard(cards[i]);
    }
  }

  function drawCenteredText(lines) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      ctx.save();
      if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = 18; }
      ctx.fillStyle = l.color || '#ffffff';
      ctx.font = 'bold ' + l.size + 'px Arial';
      ctx.fillText(l.text, VW / 2, l.y);
      ctx.restore();
    }
  }

  function drawMenu() {
    // animated decorative cards behind title
    var float = Math.sin(t * 1.5) * 6;
    drawCenteredText([
      { text: 'MEMORY', size: 52, y: 300 + float, color: '#33e1ff', glow: '#33e1ff' },
      { text: 'FLIP', size: 52, y: 358 + float, color: '#ff3b6b', glow: '#ff3b6b' },
      { text: 'Match all the pairs!', size: 20, y: 440, color: 'rgba(255,255,255,0.8)' }
    ]);

    // sample symbols row
    var demo = ['star', 'heart', 'diamond', 'bolt'];
    for (var i = 0; i < demo.length; i++) {
      var sym = null;
      for (var j = 0; j < SYMBOLS.length; j++) { if (SYMBOLS[j].id === demo[i]) sym = SYMBOLS[j]; }
      var x = VW / 2 + (i - 1.5) * 70;
      drawSymbol(sym, x, 530 + Math.sin(t * 2 + i) * 8, 44);
    }

    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    drawCenteredText([
      { text: 'TAP TO PLAY', size: 26, y: 640, color: '#ffffff' }
    ]);
    ctx.restore();

    if (_best > 0) {
      drawCenteredText([
        { text: 'BEST ' + _best, size: 18, y: 700, color: 'rgba(255,255,255,0.6)' }
      ]);
    }
  }

  function drawWinBanner() {
    ctx.save();
    ctx.fillStyle = 'rgba(16,16,32,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
    drawCenteredText([
      { text: 'LEVEL CLEAR!', size: 44, y: VH / 2 - 30, color: '#2bff88', glow: '#2bff88' },
      { text: 'Score ' + score, size: 24, y: VH / 2 + 30, color: '#ffffff' }
    ]);
  }

  function drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(16,16,32,0.7)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    drawCenteredText([
      { text: 'TIME UP!', size: 48, y: 320, color: '#ff3b6b', glow: '#ff3b6b' },
      { text: 'Score', size: 20, y: 400, color: 'rgba(255,255,255,0.7)' },
      { text: String(score), size: 40, y: 440, color: '#ffffff' },
      { text: 'Best ' + _best, size: 22, y: 500, color: 'rgba(255,255,255,0.7)' }
    ]);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawCenteredText([
      { text: 'TAP TO RETRY', size: 26, y: 600, color: '#ffffff' }
    ]);
    ctx.restore();
  }

  function draw() {
    clearBg();

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    // PLAYING / WIN / DEAD all show the board + HUD.
    drawHUD();
    drawBoard();

    if (state === 'WIN') drawWinBanner();
    else if (state === 'DEAD') drawDead();
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getScore: getScore,
    getState: getState,
    getBest: getBest
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = MemoryFlip; }
