'use strict';

/* Shape Tangram — tap a piece to select it, tap target zone to place it.
   5 pre-defined puzzles. Fill all piece slots to win the round.
   Wrong placement = lose a life. */
var ShapeRecall = (function () {
  var VW = 390, VH = 844;

  var canvas, ctx;
  var state = 'MENU'; // 'MENU' | 'PLAYING' | 'DEAD'
  var score = 0, _best = 0;
  var t = 0;
  var lives = 3;

  var selectedPiece = -1;
  var placedPieces = []; // booleans, one per piece

  // Each puzzle has a silhouette region (simplified as polygon or circle/rect)
  // and 5 pieces with target slots inside the silhouette.
  // silhouette: { type:'rect'|'circle', x, y, w, h, r }
  // pieces: array of { color, shape:'tri'|'sq'|'para', slot: {x,y} (center) }

  var PUZZLES = [
    {
      name: 'HOUSE',
      silhouette: { type: 'poly', pts: [
        195, 200, 310, 310, 310, 440, 80, 440, 80, 310
      ]},
      pieces: [
        { color: '#ff5566', shape: 'tri',  slot: { x: 195, y: 260 } },
        { color: '#5599ff', shape: 'sq',   slot: { x: 140, y: 380 } },
        { color: '#55cc88', shape: 'sq',   slot: { x: 250, y: 380 } },
        { color: '#ffcc22', shape: 'para', slot: { x: 195, y: 420 } },
        { color: '#cc55ff', shape: 'tri',  slot: { x: 195, y: 310 } }
      ]
    },
    {
      name: 'ARROW',
      silhouette: { type: 'poly', pts: [
        195, 190, 310, 320, 250, 320, 250, 460, 140, 460, 140, 320, 80, 320
      ]},
      pieces: [
        { color: '#ff5566', shape: 'tri',  slot: { x: 195, y: 255 } },
        { color: '#5599ff', shape: 'sq',   slot: { x: 195, y: 350 } },
        { color: '#55cc88', shape: 'para', slot: { x: 195, y: 420 } },
        { color: '#ffcc22', shape: 'tri',  slot: { x: 148, y: 330 } },
        { color: '#cc55ff', shape: 'tri',  slot: { x: 242, y: 330 } }
      ]
    },
    {
      name: 'STAR',
      silhouette: { type: 'circle', x: 195, y: 320, r: 110 },
      pieces: [
        { color: '#ff5566', shape: 'tri',  slot: { x: 195, y: 240 } },
        { color: '#5599ff', shape: 'tri',  slot: { x: 280, y: 300 } },
        { color: '#55cc88', shape: 'tri',  slot: { x: 250, y: 390 } },
        { color: '#ffcc22', shape: 'tri',  slot: { x: 140, y: 390 } },
        { color: '#cc55ff', shape: 'tri',  slot: { x: 110, y: 300 } }
      ]
    },
    {
      name: 'BOAT',
      silhouette: { type: 'poly', pts: [
        195, 200, 280, 340, 310, 340, 310, 440, 80, 440, 80, 340, 110, 340
      ]},
      pieces: [
        { color: '#ff5566', shape: 'tri',  slot: { x: 195, y: 270 } },
        { color: '#5599ff', shape: 'sq',   slot: { x: 140, y: 390 } },
        { color: '#55cc88', shape: 'sq',   slot: { x: 250, y: 390 } },
        { color: '#ffcc22', shape: 'para', slot: { x: 195, y: 430 } },
        { color: '#cc55ff', shape: 'tri',  slot: { x: 195, y: 340 } }
      ]
    },
    {
      name: 'FISH',
      silhouette: { type: 'poly', pts: [
        100, 320, 80, 260, 80, 380, 130, 320, 280, 260, 310, 320, 280, 380
      ]},
      pieces: [
        { color: '#ff5566', shape: 'tri',  slot: { x: 100, y: 320 } },
        { color: '#5599ff', shape: 'sq',   slot: { x: 195, y: 295 } },
        { color: '#55cc88', shape: 'sq',   slot: { x: 195, y: 350 } },
        { color: '#ffcc22', shape: 'para', slot: { x: 260, y: 320 } },
        { color: '#cc55ff', shape: 'tri',  slot: { x: 290, y: 295 } }
      ]
    }
  ];

  var puzzleIdx = 0;
  var currentPuzzle = null;

  // Piece list on left side (tappable)
  var PIECE_PANEL_X = 18;
  var PIECE_PANEL_Y = 170;
  var PIECE_SLOT_H = 80;
  var PIECE_SLOT_W = 70;

  function loadPuzzle() {
    currentPuzzle = PUZZLES[puzzleIdx % PUZZLES.length];
    selectedPiece = -1;
    placedPieces = [];
    var i;
    for (i = 0; i < currentPuzzle.pieces.length; i++) {
      placedPieces.push(false);
    }
  }

  function startGame() {
    score = 0;
    lives = 3;
    puzzleIdx = 0;
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
    loadPuzzle();
  }

  function gameOver() {
    if (score > _best) _best = score;
    snd('lose');
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function allPlaced() {
    var i;
    for (i = 0; i < placedPieces.length; i++) {
      if (!placedPieces[i]) return false;
    }
    return true;
  }

  function pointInSilhouette(px, py) {
    var sil = currentPuzzle.silhouette;
    if (sil.type === 'circle') {
      var dx = px - sil.x;
      var dy = py - sil.y;
      return (dx * dx + dy * dy) <= sil.r * sil.r;
    }
    if (sil.type === 'rect') {
      return px >= sil.x && px <= sil.x + sil.w && py >= sil.y && py <= sil.y + sil.h;
    }
    if (sil.type === 'poly') {
      return pointInPoly(px, py, sil.pts);
    }
    return false;
  }

  function pointInPoly(px, py, pts) {
    // pts = flat array [x0,y0, x1,y1, ...]
    var n = pts.length / 2;
    var inside = false;
    var xi, yi, xj, yj, i, j;
    for (i = 0, j = n - 1; i < n; j = i++) {
      xi = pts[i * 2]; yi = pts[i * 2 + 1];
      xj = pts[j * 2]; yj = pts[j * 2 + 1];
      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c;
    ctx = canvas.getContext('2d');
    _best = best || 0;
    state = 'MENU';
    score = 0;
    t = 0;
    lives = 3;
  }

  function update(dt) {
    t += dt;
  }

  function tap(vx, vy) {
    if (state === 'MENU') {
      startGame();
      snd('tap');
      return;
    }
    if (state === 'DEAD') {
      try {
        AdManager.showInterstitial(function () { startGame(); });
        try { AdManager.offerDoubleScore(score, 'shaperecall_best'); } catch(e) {}
      } catch (e) {
        startGame();
      }
      snd('tap');
      return;
    }

    // PLAYING
    // Check piece panel (left column)
    if (vx < PIECE_PANEL_X + PIECE_SLOT_W + 10) {
      var pi = Math.floor((vy - PIECE_PANEL_Y) / PIECE_SLOT_H);
      if (pi >= 0 && pi < currentPuzzle.pieces.length && !placedPieces[pi]) {
        selectedPiece = pi;
        snd('tap');
        return;
      }
    }

    // Check silhouette placement
    if (selectedPiece >= 0) {
      var slot = currentPuzzle.pieces[selectedPiece].slot;
      var sdx = vx - slot.x, sdy = vy - slot.y;
      var nearSlot = sdx*sdx + sdy*sdy <= 45*45;
      if (pointInSilhouette(vx, vy) && nearSlot) {
        // Correct placement — snap piece to its slot
        placedPieces[selectedPiece] = true;
        snd('gem');
        selectedPiece = -1;
        if (allPlaced()) {
          score++;
          if (score > _best) _best = score;
          puzzleIdx++;
          loadPuzzle();
        }
      } else {
        // Wrong placement
        snd('crash');
        lives--;
        selectedPiece = -1;
        if (lives <= 0) {
          gameOver();
        }
      }
    }
  }

  function getBest() { return _best; }
  function getScore() { return score; }
  function getState() { return state; }

  // ---- Rendering ----

  function clearBg() {
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(0, 0, VW, VH);
    var g = ctx.createRadialGradient(VW / 2, VH / 2, 40, VW / 2, VH / 2, VH * 0.65);
    g.addColorStop(0, 'rgba(60,20,100,0.30)');
    g.addColorStop(1, 'rgba(20,10,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawSilhouette() {
    var sil = currentPuzzle.silhouette;
    ctx.save();
    ctx.fillStyle = 'rgba(180,180,200,0.25)';
    ctx.strokeStyle = 'rgba(200,200,220,0.8)';
    ctx.lineWidth = 3;

    if (sil.type === 'circle') {
      ctx.beginPath();
      ctx.arc(sil.x, sil.y, sil.r, 0, Math.PI * 2);
    } else if (sil.type === 'poly') {
      var pts = sil.pts;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      var k;
      for (k = 2; k < pts.length; k += 2) {
        ctx.lineTo(pts[k], pts[k + 1]);
      }
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.rect(sil.x, sil.y, sil.w, sil.h);
    }
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(currentPuzzle.name, VW / 2, 150);
    ctx.restore();
  }

  function drawPieceShape(shape, cx, cy, sz, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (shape === 'tri') {
      ctx.moveTo(cx, cy - sz * 0.55);
      ctx.lineTo(cx + sz * 0.5, cy + sz * 0.4);
      ctx.lineTo(cx - sz * 0.5, cy + sz * 0.4);
    } else if (shape === 'sq') {
      var half = sz * 0.42;
      ctx.rect(cx - half, cy - half, half * 2, half * 2);
    } else if (shape === 'para') {
      // parallelogram
      var pw = sz * 0.5, ph = sz * 0.28, off = sz * 0.18;
      ctx.moveTo(cx - pw + off, cy - ph);
      ctx.lineTo(cx + pw + off, cy - ph);
      ctx.lineTo(cx + pw - off, cy + ph);
      ctx.lineTo(cx - pw - off, cy + ph);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawPlacedPieces() {
    var i;
    for (i = 0; i < currentPuzzle.pieces.length; i++) {
      if (!placedPieces[i]) continue;
      var piece = currentPuzzle.pieces[i];
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = piece.color;
      ctx.shadowBlur = 12;
      drawPieceShape(piece.shape, piece.slot.x, piece.slot.y, 44, piece.color);
      ctx.restore();
    }
  }

  function drawPiecePanel() {
    var i;
    for (i = 0; i < currentPuzzle.pieces.length; i++) {
      var piece = currentPuzzle.pieces[i];
      var py = PIECE_PANEL_Y + i * PIECE_SLOT_H;
      var selected = (i === selectedPiece);
      var placed = placedPieces[i];

      ctx.save();
      if (placed) {
        ctx.globalAlpha = 0.3;
      } else if (selected) {
        ctx.shadowColor = piece.color;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 1.0;
      } else {
        ctx.globalAlpha = 0.85;
      }

      // Slot background
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = selected ? piece.color : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.rect(PIECE_PANEL_X, py + 8, PIECE_SLOT_W, PIECE_SLOT_H - 16);
      ctx.fill();
      ctx.stroke();

      if (!placed) {
        drawPieceShape(piece.shape, PIECE_PANEL_X + PIECE_SLOT_W / 2, py + PIECE_SLOT_H / 2, 34, piece.color);
      }

      ctx.restore();
    }
  }

  function drawHUD() {
    var i;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(score), VW / 2, 18);

    for (i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff3b6b' : '#444455';
      ctx.font = '26px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(i < lives ? '♥' : '♡', 110 + i * 32, 22);
    }

    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('BEST ' + _best, VW - 14, 26);
    }

    // Instruction
    var hint = selectedPiece >= 0 ? 'Tap silhouette to place' : 'Tap a piece to select';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(hint, VW / 2, VH - 16);
  }

  function drawMenu() {
    var float = Math.sin(t * 1.5) * 5;

    ctx.save();
    ctx.fillStyle = '#cc88ff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#cc88ff';
    ctx.shadowBlur = 18;
    ctx.fillText('SHAPE', VW / 2, 280 + float);
    ctx.fillStyle = '#88ffcc';
    ctx.shadowColor = '#88ffcc';
    ctx.fillText('TANGRAM', VW / 2, 342 + float);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Demo shapes
    var demoColors = ['#ff5566', '#5599ff', '#55cc88', '#ffcc22', '#cc55ff'];
    var demoShapes = ['tri', 'sq', 'para', 'tri', 'sq'];
    var i;
    for (i = 0; i < 5; i++) {
      ctx.save();
      ctx.shadowColor = demoColors[i];
      ctx.shadowBlur = 10;
      drawPieceShape(demoShapes[i], 70 + i * 62, 430 + Math.sin(t * 1.5 + i) * 8, 32, demoColors[i]);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Select pieces, place them in', VW / 2, 510);
    ctx.fillText('the silhouette to win!', VW / 2, 538);

    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('TAP TO PLAY', VW / 2, 640);
    ctx.restore();

    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '18px Arial';
      ctx.fillText('BEST: ' + _best, VW / 2, 700);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.save();
    ctx.fillStyle = '#ff4466';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Puzzles: ' + score, VW / 2, 380);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '22px Arial';
    ctx.fillText('Best: ' + _best, VW / 2, 430);
    ctx.restore();

    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO RETRY', VW / 2, 580);
    ctx.restore();
  }

  function draw() {
    clearBg();
    if (state === 'MENU') {
      drawMenu();
      return;
    }
    if (state === 'DEAD') {
      drawDead();
      return;
    }
    // PLAYING
    drawSilhouette();
    drawPlacedPieces();
    drawPiecePanel();
    drawHUD();
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

if (typeof module !== 'undefined' && module.exports) { module.exports = ShapeRecall; }
