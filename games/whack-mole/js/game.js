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
var WhackMole = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, best;

  var COLS = 3, ROWS = 3;
  var HOLE_R = 44;
  var holes; // {x, y, moleState, moleTimer, moleMaxTime, moleY, targetMoleY, hit}
  var glowPulse = 0;
  var diffFactor = 1.0;
  var spawnTimer = 0;
  var spawnInterval = 1.2;
  var hitFlashes = []; // {x, y, timer}

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    buildHoles();
  }

  function buildHoles() {
    var cellW = VW / COLS;
    var cellH = (VH * 0.55) / ROWS;
    var offsetY = VH * 0.28;
    holes = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        holes.push({
          x: cellW * c + cellW / 2,
          y: offsetY + cellH * r + cellH / 2,
          moleState: 'hidden', // hidden, rising, showing, falling
          moleTimer: 0,
          moleMaxTime: 1.5,
          moleY: 0, // 0=hidden, 1=fully shown
          hit: false
        });
      }
    }
  }

  function startGame() {
    _msDone = {};
    score = 0;
    lives = 5;
    diffFactor = 1.0;
    spawnTimer = 0.5;
    spawnInterval = 1.2;
    hitFlashes = [];
    for (var i = 0; i < holes.length; i++) {
      holes[i].moleState = 'hidden';
      holes[i].moleY = 0;
      holes[i].hit = false;
    }
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function endGame() {
    if (score > best) { best = score; AdManager.happyTime(1.0); }
    vib([40,80,80]);
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'whackmole_best'); } catch(e) {}
    state = 'DEAD';
  }

  function spawnMole() {
    // Pick a random hidden hole
    var available = [];
    for (var i = 0; i < holes.length; i++) {
      if (holes[i].moleState === 'hidden') available.push(i);
    }
    if (available.length === 0) return;
    var idx = available[Math.floor(Math.random() * available.length)];
    var maxTime = Math.max(0.7, 1.5 / diffFactor);
    holes[idx].moleState = 'rising';
    holes[idx].moleTimer = 0;
    holes[idx].moleMaxTime = maxTime;
    holes[idx].hit = false;
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    glowPulse += dt * 2;

    // Update hit flashes
    for (var k = hitFlashes.length - 1; k >= 0; k--) {
      hitFlashes[k].timer -= dt;
      if (hitFlashes[k].timer <= 0) hitFlashes.splice(k, 1);
    }

    if (state !== 'PLAYING') return;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnMole();
      spawnInterval = Math.max(0.5, 1.2 / diffFactor);
      spawnTimer = spawnInterval;
    }

    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      if (h.moleState === 'hidden') continue;

      h.moleTimer += dt;

      if (h.moleState === 'rising') {
        h.moleY = Math.min(1.0, h.moleTimer / 0.25);
        if (h.moleY >= 1.0) {
          h.moleState = 'showing';
          h.moleTimer = 0;
        }
      } else if (h.moleState === 'showing') {
        if (h.moleTimer >= h.moleMaxTime) {
          // Escaped!
          if (!h.hit) {
            lives--;
            vib([25,50,25]);
            try { Audio.play('lose'); } catch (e) {}
            if (lives <= 0) {
              h.moleState = 'falling';
              h.moleTimer = 0;
              endGame();
              return;
            }
          }
          h.moleState = 'falling';
          h.moleTimer = 0;
        }
      } else if (h.moleState === 'falling') {
        h.moleY = Math.max(0.0, 1.0 - h.moleTimer / 0.2);
        if (h.moleY <= 0) {
          h.moleState = 'hidden';
          h.hit = false;
        }
      }
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      return;
    }
    if (state === 'DEAD') {
      startGame();
      return;
    }

    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      if (h.moleState !== 'showing' && h.moleState !== 'rising') continue;
      if (h.hit) continue;

      // Mole visual body center: bodyTop + bodyR*0.8 = h.y - moleY*HOLE_R*1.4 + (HOLE_R-4)*0.8
      var moleDrawY = h.y - h.moleY * HOLE_R * 1.4 + (HOLE_R - 4) * 0.8;
      var dx = x - h.x;
      var dy = y - moleDrawY;
      if (dx * dx + dy * dy <= (HOLE_R + 8) * (HOLE_R + 8)) {
        h.hit = true;
        h.moleState = 'falling';
        h.moleTimer = 0;
        score++;
        vib(8); _milestone(score);
        diffFactor = 1.0 + score * 0.04;
        hitFlashes.push({ x: h.x, y: moleDrawY, timer: 0.35 });
        try { Audio.play('gem'); } catch (e) {}
        return;
      }
    }
  }

  function draw() {
    // Earthy background
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#1a2e0a');
    bg.addColorStop(0.5, '#2a1e0a');
    bg.addColorStop(1, '#0e1a06');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    // Ground texture strips
    ctx.fillStyle = 'rgba(80,50,20,0.25)';
    for (var gy = 0; gy < VH; gy += 60) {
      ctx.fillRect(0, gy + 30, VW, 10);
    }

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawHoles();
    drawMoles();
    drawHitFlashes();
    drawHUD();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawHoles() {
    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      // Hole shadow
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, HOLE_R + 4, (HOLE_R + 4) * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();

      // Hole
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, HOLE_R, HOLE_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0e05';
      ctx.fill();
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawMoles() {
    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      if (h.moleState === 'hidden') continue;

      var vy = h.moleY;
      var moleH = HOLE_R * 1.4;
      var bodyTop = h.y - vy * moleH;

      // Clip to hole area so mole appears to rise from it
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, HOLE_R, HOLE_R * 0.45, 0, Math.PI, Math.PI * 2);
      ctx.rect(h.x - HOLE_R, bodyTop - 10, HOLE_R * 2, h.y - bodyTop + 10);
      ctx.clip();

      // Body
      var bodyR = HOLE_R - 4;
      var bodyGrd = ctx.createRadialGradient(h.x - 8, bodyTop + 10, 0, h.x, bodyTop + bodyR, bodyR);
      bodyGrd.addColorStop(0, '#c87a40');
      bodyGrd.addColorStop(0.6, '#8b4a18');
      bodyGrd.addColorStop(1, '#5a2e08');
      ctx.beginPath();
      ctx.arc(h.x, bodyTop + bodyR * 0.8, bodyR, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrd;
      ctx.fill();

      // Face
      var faceY = bodyTop + bodyR * 0.5;

      // Eyes
      var eyeOff = 11;
      var eyeY = faceY - 2;
      ctx.fillStyle = h.hit ? '#ff4444' : '#fff';
      ctx.beginPath();
      ctx.arc(h.x - eyeOff, eyeY, 7, 0, Math.PI * 2);
      ctx.arc(h.x + eyeOff, eyeY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a0a00';
      ctx.beginPath();
      ctx.arc(h.x - eyeOff + 1, eyeY, 4, 0, Math.PI * 2);
      ctx.arc(h.x + eyeOff + 1, eyeY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = '#d05030';
      ctx.beginPath();
      ctx.arc(h.x, faceY + 8, 5, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#5a1a00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, faceY + 8, 10, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawHitFlashes() {
    for (var i = 0; i < hitFlashes.length; i++) {
      var f = hitFlashes[i];
      var alpha = f.timer / 0.35;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(f.x, f.y, HOLE_R * (1.5 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = alpha;
      ctx.fillText('WHACK!', f.x, f.y - 50 * (1 - alpha));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, 62);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 40);
    ctx.textAlign = 'right';
    ctx.fillText('Best: ' + best, VW - 16, 40);

    // Lives (5 hearts)
    ctx.textAlign = 'center';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < lives ? '#ff4466' : '#333';
      ctx.beginPath();
      ctx.arc(VW / 2 - 40 + i * 20, 38, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    ctx.textAlign = 'center';
    ctx.shadowColor = '#8b4a18';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#f0c060';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('WHACK-A-MOLE', VW / 2, VH * 0.12);
    ctx.shadowBlur = 0;

    // Draw decorative holes
    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, HOLE_R + 4, (HOLE_R + 4) * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, HOLE_R, HOLE_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0e05';
      ctx.fill();
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ccb';
    ctx.shadowBlur = 0;
    ctx.fillText('Tap the moles before they hide!', VW / 2, VH * 0.78);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,200,80,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0c060';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = '#8b4a18';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,200,80,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.68);
    ctx.textAlign = 'left';
  }

  function getBest() {
    return best;
  }

  return {
    init: init,
    update: update,
    draw: draw,
    tap: tap,
    getBest: getBest
  };
})();
