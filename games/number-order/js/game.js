'use strict';
var NumberOrder = (function () {
  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var best = 0;
  var score = 0;
  var lives = 3;

  var COUNT = 12;
  var circles = []; // {num, x, y, r, color, hit, wrongT}
  var nextExpected = 1;
  var timer = 30;
  var timerAcc = 0;
  var wrongIdx = -1;
  var wrongT = 0;
  var hitIdx = -1;
  var hitT = 0;

  var COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c',
                '#e67e22','#e91e63','#00bcd4','#8bc34a','#ff5722','#673ab7'];

  function randBetween(a, b) { return a + Math.random() * (b - a); }

  function buildCircles() {
    circles = [];
    var R = 32;
    var maxAttempts = 200;
    for (var n = 1; n <= COUNT; n++) {
      var placed = false;
      for (var attempt = 0; attempt < maxAttempts; attempt++) {
        var x = randBetween(R+10, VW-R-10);
        var y = randBetween(170 + R, VH - R - 80);
        var ok = true;
        for (var j = 0; j < circles.length; j++) {
          var dx = circles[j].x - x;
          var dy = circles[j].y - y;
          if (Math.sqrt(dx*dx+dy*dy) < R*2 + 8) { ok = false; break; }
        }
        if (ok) {
          circles.push({ num: n, x: x, y: y, r: R, color: COLORS[n-1], hit: false, wrongT: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        // force place fallback
        var col = (n-1) % 4;
        var row = Math.floor((n-1) / 4);
        circles.push({ num: n, x: 50 + col*90, y: 200 + row*120, r: R, color: COLORS[n-1], hit: false, wrongT: 0 });
      }
    }
    nextExpected = 1;
    timer = 30;
    timerAcc = 0;
    wrongIdx = -1;
    wrongT = 0;
    hitIdx = -1;
    hitT = 0;
  }

  function init(c, b) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = b || 0;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    lives = 3;
    buildCircles();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    timerAcc += dt;
    if (timerAcc >= 1) {
      timerAcc -= 1;
      timer--;
      if (timer <= 0) { timer = 0; endGame(); return; }
    }

    if (wrongT > 0) { wrongT -= dt; if (wrongT < 0) { wrongT = 0; wrongIdx = -1; } }
    if (hitT > 0) { hitT -= dt; if (hitT < 0) { hitT = 0; hitIdx = -1; } }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NUMBER ORDER', VW/2, 300);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Tap circles 1 to 12 in order!', VW/2, 365);
      ctx.fillText('30 seconds per set.', VW/2, 400);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO PLAY', VW/2, 490);
      if (best > 0) {
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Best: ' + best + ' sets', VW/2, 550);
      }
      return;
    }

    // HUD
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Sets: ' + score, 20, 50);
    ctx.textAlign = 'right';
    ctx.fillStyle = timer <= 10 ? '#e74c3c' : '#fff';
    ctx.fillText(timer + 's', VW-20, 50);
    ctx.textAlign = 'left';
    for (var li = 0; li < 3; li++) {
      ctx.fillStyle = li < lives ? '#e74c3c' : '#2d2d2d';
      ctx.beginPath();
      ctx.arc(22 + li*34, 80, 13, 0, Math.PI*2);
      ctx.fill();
    }

    // timer bar
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 100, VW-40, 8);
    ctx.fillStyle = timer <= 10 ? '#e74c3c' : '#2ecc71';
    ctx.fillRect(20, 100, (VW-40)*(timer/30), 8);

    // "next" prompt
    ctx.textAlign = 'center';
    if (nextExpected <= COUNT) {
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAP ' + nextExpected, VW/2, 140);
    }

    // circles
    for (var i = 0; i < circles.length; i++) {
      var circ = circles[i];
      if (circ.hit) continue;

      var isWrong = (wrongIdx === i);
      var isHit = (hitIdx === i);

      ctx.save();
      if (isHit) {
        ctx.shadowColor = circ.color;
        ctx.shadowBlur = 20;
      }
      ctx.beginPath();
      ctx.arc(circ.x, circ.y, circ.r, 0, Math.PI*2);
      ctx.fillStyle = isWrong ? '#e74c3c' : circ.color;
      ctx.fill();

      // white border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(circ.num, circ.x, circ.y);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', VW/2, 340);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#f39c12';
      ctx.fillText('Sets: ' + score, VW/2, 405);
      ctx.fillStyle = '#aaa';
      ctx.font = '24px sans-serif';
      ctx.fillText('Best: ' + best, VW/2, 450);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TAP TO RETRY', VW/2, 520);
    }
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD')  { startGame(); return; }

    for (var i = 0; i < circles.length; i++) {
      var circ = circles[i];
      if (circ.hit) continue;
      var dx = x - circ.x, dy = y - circ.y;
      if (dx*dx + dy*dy <= circ.r*circ.r) {
        if (circ.num === nextExpected) {
          circ.hit = true;
          hitIdx = i;
          hitT = 0.3;
          nextExpected++;
          try { Audio.play('tap'); } catch(e) {}
          if (nextExpected > COUNT) {
            // completed set
            score++;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch(e) {}
            buildCircles();
          }
        } else {
          wrongIdx = i;
          wrongT = 0.4;
          lives--;
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { endGame(); return; }
        }
        return;
      }
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
