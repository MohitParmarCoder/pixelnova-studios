'use strict';
var CandyRain = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, numbers, target, pairsThisTarget, selected;
  var TOTAL_NUMBERS = 8;
  var COLORS = ['#ff6b6b','#ffd700','#6bcb77','#4d96ff','#c77dff','#ff9f43','#a8edea','#fd79a8'];

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function randomTarget() {
    return 5 + Math.floor(Math.random() * 10);
  }

  function spawnNumber(idx) {
    var val = 1 + Math.floor(Math.random() * 9);
    var r = 28;
    var x = r + 10 + Math.random() * (VW - 2 * r - 20);
    var y = 120 + Math.random() * (VH - 240);
    var speed = 50 + Math.random() * 60;
    var angle = Math.random() * Math.PI * 2;
    numbers[idx] = {
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: r, val: val,
      color: COLORS[idx % COLORS.length],
      selected: false
    };
  }

  function hasValidPair() {
    var i, j;
    for (i = 0; i < numbers.length; i++) {
      for (j = i + 1; j < numbers.length; j++) {
        if (numbers[i].val + numbers[j].val === target) return true;
      }
    }
    return false;
  }

  function ensureValidPair() {
    // Guarantee at least one pair on the board sums to the target so the
    // round is always solvable (avoids a dead board / forced life loss).
    if (hasValidPair()) return;
    var a = 1 + Math.floor(Math.random() * 9);
    var b = target - a;
    // Clamp so both values stay in the legal 1..9 range.
    if (b < 1) { b = 1; a = target - b; }
    if (b > 9) { b = 9; a = target - b; }
    if (a < 1) a = 1;
    if (a > 9) a = 9;
    // If the target can't be made from two 1..9 candies, retarget instead.
    if (a + b !== target) { target = a + b; return; }
    var i = Math.floor(Math.random() * numbers.length);
    var j = (i + 1 + Math.floor(Math.random() * (numbers.length - 1))) % numbers.length;
    numbers[i].val = a;
    numbers[j].val = b;
  }

  function startGame() {
    score = 0; lives = 3; numbers = []; pairsThisTarget = 0; selected = -1;
    target = randomTarget();
    var i;
    for (i = 0; i < TOTAL_NUMBERS; i++) {
      numbers.push({});
      spawnNumber(i);
    }
    ensureValidPair();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;
    var i, n;
    for (i = 0; i < numbers.length; i++) {
      n = numbers[i];
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x - n.r < 0) { n.x = n.r; n.vx = Math.abs(n.vx); }
      if (n.x + n.r > VW) { n.x = VW - n.r; n.vx = -Math.abs(n.vx); }
      if (n.y - n.r < 100) { n.y = 100 + n.r; n.vy = Math.abs(n.vy); }
      if (n.y + n.r > VH - 20) { n.y = VH - 20 - n.r; n.vy = -Math.abs(n.vy); }
    }
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a0a2e'); g.addColorStop(1, '#16213e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function draw() {
    var i, n, hearts, h;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#ffd700';
      ctx.fillText('CANDY RAIN', VW / 2, 290);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('Tap two numbers that', VW / 2, 360);
      ctx.fillText('add up to the target!', VW / 2, 392);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 450);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 520);
      ctx.textAlign = 'left';
      return;
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Target: ' + target, VW / 2, 60);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px system-ui';
    ctx.fillText('Score: ' + score, VW / 2, 90);
    for (i = 0; i < numbers.length; i++) {
      n = numbers[i];
      ctx.save();
      ctx.shadowBlur = n.selected ? 20 : 8;
      ctx.shadowColor = n.color;
      ctx.fillStyle = n.selected ? '#fff' : n.color;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      if (n.selected) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = n.selected ? n.color : '#fff';
      ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + n.val, n.x, n.y);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f87171'; ctx.font = '24px system-ui'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, 44);
    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 48px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 320);
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffd700'; ctx.font = 'bold 32px system-ui';
      ctx.fillText('Score: ' + score, VW / 2, 390);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui';
      ctx.fillText('Best: ' + best, VW / 2, 430);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO RETRY', VW / 2, 500);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;
    var i, n, dx, dy, dist, firstIdx;
    for (i = 0; i < numbers.length; i++) {
      n = numbers[i];
      dx = x - n.x; dy = y - n.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < n.r + 10) {
        if (selected === -1) {
          selected = i;
          n.selected = true;
          try { Audio.play('tap'); } catch(e) {}
        } else if (selected === i) {
          n.selected = false;
          selected = -1;
        } else {
          firstIdx = selected;
          var firstN = numbers[firstIdx];
          if (firstN.val + n.val === target) {
            score++;
            if (score > best) best = score;
            pairsThisTarget++;
            try { Audio.play('gem'); } catch(e) {}
            spawnNumber(firstIdx);
            spawnNumber(i);
            if (pairsThisTarget >= 5) {
              pairsThisTarget = 0;
              target = randomTarget();
            }
            ensureValidPair();
          } else {
            lives--;
            try { Audio.play('crash'); } catch(e) {}
            firstN.selected = false;
            n.selected = false;
            if (lives <= 0) {
              lives = 0; state = 'DEAD';
              try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
            }
          }
          selected = -1;
        }
        return;
      }
    }
    if (selected !== -1) {
      numbers[selected].selected = false;
      selected = -1;
    }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
