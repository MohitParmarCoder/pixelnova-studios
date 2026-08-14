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
var RhythmTap = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, best;

  var BEAT_LINE_Y;
  var CIRCLE_R = 30;
  var PERFECT_WINDOW = 0.1;  // seconds
  var GOOD_WINDOW = 0.22;    // seconds
  var LANE_COUNT = 3;
  var LANE_X = [];

  var circles = [];
  var spawnTimer = 0;
  var spawnInterval = 1.1;
  var fallSpeed = 300; // px per second
  var glowPulse = 0;
  var feedbackItems = [];
  var beatPulse = 0; // for beat line animation
  var beatTimer = 0;

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    BEAT_LINE_Y = VH * 0.8;
    for (var i = 0; i < LANE_COUNT; i++) {
      LANE_X.push((i + 1) * VW / (LANE_COUNT + 1));
    }
    state = 'MENU';
  }

  function startGame() {
    _msDone = {};
    score = 0;
    lives = 5;
    circles = [];
    feedbackItems = [];
    spawnTimer = 0.5;
    spawnInterval = 1.1;
    fallSpeed = 300;
    beatPulse = 0;
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function endGame() {
    if (score > best) { best = score; AdManager.happyTime(1.0); }
    vib([40,80,80]);
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'rhythmtap_best'); } catch(e) {}
    state = 'DEAD';
  }

  function spawnCircle() {
    var lane = Math.floor(Math.random() * LANE_COUNT);
    circles.push({
      x: LANE_X[lane],
      y: -CIRCLE_R,
      lane: lane,
      judged: false,
      color: 'hsl(' + (lane * 120 + 20) + ',80%,60%)'
    });
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    glowPulse += dt * 2.5;
    beatTimer += dt;
    if (beatTimer > 0.5) {
      beatTimer -= 0.5;
      beatPulse = 1.0;
    }
    beatPulse *= Math.pow(0.88, dt * 60);

    // Update feedback items
    for (var k = feedbackItems.length - 1; k >= 0; k--) {
      feedbackItems[k].y -= 50 * dt;
      feedbackItems[k].life -= dt;
      if (feedbackItems[k].life <= 0) feedbackItems.splice(k, 1);
    }

    if (state !== 'PLAYING') return;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnCircle();
      spawnTimer = spawnInterval;
      // Increase difficulty
      spawnInterval = Math.max(0.5, spawnInterval - 0.01);
      fallSpeed = Math.min(600, fallSpeed + 1.5);
    }

    for (var i = circles.length - 1; i >= 0; i--) {
      var c = circles[i];
      c.y += fallSpeed * dt;

      // Auto-miss if circle goes past the beat line too far
      if (!c.judged && c.y > BEAT_LINE_Y + CIRCLE_R * 3) {
        c.judged = true;
        lives--;
        vib([25,50,25]);
        try { Audio.play('lose'); } catch (e) {}
        feedbackItems.push({
          x: c.x, y: BEAT_LINE_Y - 30,
          text: 'MISS', color: '#ff4444',
          life: 0.7
        });
        if (lives <= 0) {
          endGame();
          return;
        }
      }

      // Remove old circles
      if (c.y > VH + CIRCLE_R * 2) {
        circles.splice(i, 1);
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

    // Find nearest lane
    var bestLane = -1;
    var bestDist = 999999;
    for (var l = 0; l < LANE_COUNT; l++) {
      var dx = x - LANE_X[l];
      if (Math.abs(dx) < bestDist) {
        bestDist = Math.abs(dx);
        bestLane = l;
      }
    }
    if (bestDist > VW / (LANE_COUNT + 1) + 10) return;

    // Find closest unjudged circle in that lane near beat line
    var closest = null;
    var closestDist = 999999;
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      if (c.judged) continue;
      if (c.lane !== bestLane) continue;
      var dist = Math.abs(c.y - BEAT_LINE_Y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = c;
      }
    }

    if (closest) {
      var timeDiff = Math.abs(closest.y - BEAT_LINE_Y) / fallSpeed;
      closest.judged = true;
      beatPulse = 1.0;

      if (timeDiff <= PERFECT_WINDOW) {
        score += 3;
        vib(8); _milestone(score);
        try { Audio.play('gem'); } catch (e) {}
        feedbackItems.push({ x: closest.x, y: BEAT_LINE_Y - 40, text: 'PERFECT +3', color: '#ffff00', life: 0.8 });
      } else if (timeDiff <= GOOD_WINDOW) {
        score += 1;
        vib(8); _milestone(score);
        try { Audio.play('tap'); } catch (e) {}
        feedbackItems.push({ x: closest.x, y: BEAT_LINE_Y - 40, text: 'GOOD +1', color: '#00ffcc', life: 0.8 });
      } else {
        // Too early
        try { Audio.play('tap'); } catch (e) {}
        feedbackItems.push({ x: closest.x, y: BEAT_LINE_Y - 40, text: 'EARLY', color: '#aaa', life: 0.7 });
      }
    } else {
      // No circle in lane
      try { Audio.play('crash'); } catch (e) {}
    }
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#050010');
    bg.addColorStop(0.6, '#0a0520');
    bg.addColorStop(1, '#050010');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    // Lane lines
    for (var l = 0; l < LANE_COUNT; l++) {
      ctx.strokeStyle = 'rgba(100,80,200,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(LANE_X[l], 60);
      ctx.lineTo(LANE_X[l], VH - 40);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawBeatLine();
    drawCircles();
    drawFeedback();
    drawHUD();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawBeatLine() {
    var glowSize = 8 + beatPulse * 16;
    var alpha = 0.6 + beatPulse * 0.4;

    ctx.shadowColor = '#ff44ff';
    ctx.shadowBlur = glowSize;
    ctx.strokeStyle = 'rgba(255,68,255,' + alpha + ')';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, BEAT_LINE_Y);
    ctx.lineTo(VW - 20, BEAT_LINE_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane tap zones
    for (var l = 0; l < LANE_COUNT; l++) {
      var ta = 0.2 + beatPulse * 0.4;
      ctx.beginPath();
      ctx.arc(LANE_X[l], BEAT_LINE_Y, CIRCLE_R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,68,255,' + ta + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawCircles() {
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      if (c.judged) continue;

      var nearness = 1.0 - Math.min(1.0, Math.abs(c.y - BEAT_LINE_Y) / 200);

      // Outer glow
      var grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, CIRCLE_R * 2.5);
      grd.addColorStop(0, c.color.replace(')', ',0.4)').replace('hsl', 'hsla'));
      grd.addColorStop(1, c.color.replace(')', ',0)').replace('hsl', 'hsla'));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(c.x, c.y, CIRCLE_R * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(c.x, c.y, CIRCLE_R, 0, Math.PI * 2);
      var cGrd = ctx.createRadialGradient(c.x - 8, c.y - 8, 0, c.x, c.y, CIRCLE_R);
      cGrd.addColorStop(0, '#fff');
      cGrd.addColorStop(0.3, c.color);
      cGrd.addColorStop(1, c.color.replace('60%', '30%'));
      ctx.fillStyle = cGrd;
      ctx.fill();

      // Pulse ring near beat line
      if (nearness > 0.5) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, CIRCLE_R + 6 * nearness, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (nearness * 0.7) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawFeedback() {
    for (var i = 0; i < feedbackItems.length; i++) {
      var f = feedbackItems[i];
      var alpha = f.life / 0.8;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
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

    // Lives
    ctx.textAlign = 'center';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < lives ? '#ff44ff' : '#333';
      ctx.beginPath();
      ctx.arc(VW / 2 - 40 + i * 20, 38, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff44ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('RHYTHM TAP', VW / 2, VH * 0.15);
    ctx.shadowBlur = 0;

    // Decorative beat line
    var beatGlow = 0.5 + 0.5 * Math.abs(Math.sin(glowPulse * 2));
    ctx.strokeStyle = 'rgba(255,68,255,' + beatGlow + ')';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff44ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(20, BEAT_LINE_Y);
    ctx.lineTo(VW - 20, BEAT_LINE_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Demo circles falling
    for (var l = 0; l < LANE_COUNT; l++) {
      var cy = VH * 0.3 + (l * 120);
      var clr = 'hsl(' + (l * 120 + 20) + ',80%,60%)';
      ctx.beginPath();
      ctx.arc(LANE_X[l], cy, CIRCLE_R, 0, Math.PI * 2);
      ctx.fillStyle = clr;
      ctx.fill();
    }

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ccb';
    ctx.fillText('Tap when circles hit the line!', VW / 2, VH * 0.88 - 40);
    ctx.fillText('Perfect=3  Good=1  Miss=-life', VW / 2, VH * 0.88 - 14);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,100,255,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88 + 20);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = '#ff44ff';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ddf';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,100,255,' + pulse + ')';
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
