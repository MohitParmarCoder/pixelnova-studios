'use strict';
var HexFlip = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score, best;
  var VW = 390, VH = 844;

  var TIMER_MAX = 60;
  var timeLeft;

  var COLORS = ['#ff4444', '#44aaff', '#44dd44'];
  var COLOR_DARK = ['#881111', '#115588', '#118811'];

  // Hex grid
  var HEX_SIZE = 34; // radius
  var hexes;
  var COLS = 7;
  var ROWS = 9;

  var scoreAnim; // array of score pop-ups

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function buildGrid() {
    hexes = [];
    var s = HEX_SIZE;
    var w = s * 2;
    var h = Math.sqrt(3) * s;
    var startX = VW / 2 - (COLS - 1) * (w * 0.75) / 2;
    var startY = 140;

    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var x = startX + col * w * 0.75;
        var y = startY + row * h + (col % 2 === 1 ? h / 2 : 0);
        if (y > VH - 120) continue;
        hexes.push({
          x: x,
          y: y,
          col: col,
          row: row,
          color: Math.floor(Math.random() * 3),
          animScale: 1,
          animTimer: 0,
          flashing: false,
          flashTimer: 0
        });
      }
    }
  }

  function startGame() {
    score = 0;
    timeLeft = TIMER_MAX;
    scoreAnim = [];
    buildGrid();
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  // Get hex neighbors (flat-top hexagonal grid)
  function getNeighborIndices(idx) {
    var h = hexes[idx];
    var neighbors = [];
    var s = HEX_SIZE;
    var w = s * 2;
    var hh = Math.sqrt(3) * s;
    var threshold = hh * 1.05;

    for (var i = 0; i < hexes.length; i++) {
      if (i === idx) continue;
      var other = hexes[i];
      var dx = other.x - h.x;
      var dy = other.y - h.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist > 0) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  function checkMatches() {
    var matched = {};

    for (var i = 0; i < hexes.length; i++) {
      if (hexes[i].flashing) continue;
      var neighbors = getNeighborIndices(i);
      for (var n = 0; n < neighbors.length; n++) {
        var ni = neighbors[n];
        if (hexes[ni].flashing) continue;
        if (hexes[ni].color !== hexes[i].color) continue;
        // Check for third in line
        for (var n2 = n + 1; n2 < neighbors.length; n2++) {
          var n2i = neighbors[n2];
          if (hexes[n2i].flashing) continue;
          if (hexes[n2i].color !== hexes[i].color) continue;
          // Found 3 same color touching i
          matched[i] = true;
          matched[ni] = true;
          matched[n2i] = true;
        }
      }
    }

    var matchList = [];
    for (var key in matched) {
      matchList.push(parseInt(key, 10));
    }

    if (matchList.length > 0) {
      var pts = matchList.length;
      score += pts;
      if (score > best) best = score;
      try { Audio.play('gem'); } catch (e) {}
      scoreAnim.push({ pts: pts, timer: 1.0, x: VW / 2, y: VH / 2 - 80 });

      for (var m = 0; m < matchList.length; m++) {
        hexes[matchList[m]].flashing = true;
        hexes[matchList[m]].flashTimer = 0;
      }
    }
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
      return;
    }

    for (var i = 0; i < hexes.length; i++) {
      var h = hexes[i];
      if (h.flashing) {
        h.flashTimer += dt;
        if (h.flashTimer > 0.5) {
          h.flashing = false;
          h.color = Math.floor(Math.random() * 3);
          h.animTimer = 0.3;
          h.animScale = 0.5;
        }
      }
      if (h.animTimer > 0) {
        h.animTimer -= dt;
        var p = Math.max(0, h.animTimer / 0.3);
        h.animScale = 1 - p * 0.5;
      } else {
        h.animScale = 1;
      }
    }

    for (var sa = scoreAnim.length - 1; sa >= 0; sa--) {
      scoreAnim[sa].timer -= dt;
      if (scoreAnim[sa].timer <= 0) scoreAnim.splice(sa, 1);
    }
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    // Find tapped hex
    var closest = -1;
    var closestDist = HEX_SIZE * 1.1;

    for (var i = 0; i < hexes.length; i++) {
      if (hexes[i].flashing) continue;
      var dx = x - hexes[i].x;
      var dy = y - hexes[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    if (closest >= 0) {
      hexes[closest].color = (hexes[closest].color + 1) % 3;
      hexes[closest].animTimer = 0.2;
      hexes[closest].animScale = 0.7;
      try { Audio.play('tap'); } catch (e) {}
      checkMatches();
    }
  }

  function drawHex(cx, cy, size, fillColor, strokeColor, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 3) * i;
      var px = size * Math.cos(angle);
      var py = size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') { drawMenu(); return; }

    // Draw hexes
    for (var i = 0; i < hexes.length; i++) {
      var h = hexes[i];
      var fillColor;
      var strokeColor;

      if (h.flashing) {
        var p = h.flashTimer / 0.5;
        fillColor = '#ffffff';
        ctx.globalAlpha = 1 - p;
        drawHex(h.x, h.y, HEX_SIZE - 2, fillColor, '#ffffff', 1 + p * 0.3);
        ctx.globalAlpha = 1;
        continue;
      } else {
        fillColor = COLORS[h.color];
        strokeColor = COLOR_DARK[h.color];
      }

      drawHex(h.x, h.y, HEX_SIZE - 2, fillColor, strokeColor, h.animScale);

      // Inner highlight
      ctx.globalAlpha = 0.3;
      drawHex(h.x - 4, h.y - 4, HEX_SIZE * 0.5, 'rgba(255,255,255,0.5)', 'transparent', h.animScale);
      ctx.globalAlpha = 1;
    }

    // Score anim
    for (var sa = 0; sa < scoreAnim.length; sa++) {
      var s = scoreAnim[sa];
      ctx.globalAlpha = Math.min(1, s.timer * 2);
      ctx.fillStyle = '#ffff44';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+' + s.pts, s.x, s.y - (1 - s.timer) * 50);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 38);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 38);

    // Timer bar
    var timerFrac = timeLeft / TIMER_MAX;
    var timerColor = timerFrac > 0.5 ? '#44ff44' : (timerFrac > 0.25 ? '#ffff44' : '#ff4444');
    ctx.fillStyle = '#222233';
    ctx.fillRect(16, 52, VW - 32, 12);
    ctx.fillStyle = timerColor;
    ctx.fillRect(16, 52, (VW - 32) * timerFrac, 12);
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 52, VW - 32, 12);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(timeLeft) + 's', VW - 16, 38);

    ctx.fillStyle = '#555566';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap to cycle colors — match 3!', VW / 2, VH - 16);

    if (state === 'DEAD') drawDead();
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, VW, VH);

    // Preview hex grid
    var previewHexes = [
      { x: VW/2 - 60, y: 250, color: 0 },
      { x: VW/2,      y: 220, color: 1 },
      { x: VW/2 + 60, y: 250, color: 2 },
      { x: VW/2 - 30, y: 290, color: 1 },
      { x: VW/2 + 30, y: 290, color: 0 }
    ];
    for (var i = 0; i < previewHexes.length; i++) {
      drawHex(previewHexes[i].x, previewHexes[i].y, 26, COLORS[previewHexes[i].color], COLOR_DARK[previewHexes[i].color], 1);
    }

    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HEX', VW / 2, 380);
    ctx.fillText('FLIP', VW / 2, 438);

    ctx.fillStyle = '#ffeeaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Tap hexes to cycle colors', VW / 2, 490);
    ctx.fillText('Match 3+ same color to score!', VW / 2, 516);

    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 580);

    if (best > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Best: ' + best, VW / 2, 628);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TIME UP!', VW / 2, 340);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 400);

    ctx.fillStyle = '#ffff44';
    ctx.font = '24px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 440);

    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 520);
  }

  function getBest() { return best; }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
}());
