'use strict';
var TargetBlitz = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, best;

  var GAME_DURATION = 30;
  var timeLeft;

  // Ring system
  var CX, CY;
  var RING_MAX = 140;
  var RING_MID = 80;
  var RING_CENTER = 35;

  // Sweep bar angle
  var sweepAngle = 0;
  var sweepSpeed = 1.8; // radians per second, increases over time

  var glowPulse = 0;
  var lastScore = 0;
  var scorePopups = [];
  var flashTimer = 0;
  var flashColor = '';

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    CX = VW / 2;
    CY = VH * 0.45;
    state = 'MENU';
  }

  function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    sweepAngle = -Math.PI / 2;
    sweepSpeed = 1.8;
    scorePopups = [];
    flashTimer = 0;
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function endGame() {
    if (score > best) best = score;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    state = 'DEAD';
  }

  function getAccuracyZone(dist) {
    // Returns zone name and points
    if (dist <= RING_CENTER) return { zone: 'PERFECT', pts: 5, color: '#ffff00' };
    if (dist <= RING_MID)   return { zone: 'GOOD', pts: 3, color: '#00ffcc' };
    if (dist <= RING_MAX)   return { zone: 'OK', pts: 1, color: '#aaaaff' };
    return null;
  }

  function isNearTarget() {
    // Check if sweep bar is near the target zone (top, -PI/2)
    var normalized = ((sweepAngle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    // "near top" means normalized angle is close to 0 or 2PI
    return normalized < 0.3 || normalized > Math.PI * 2 - 0.3;
  }

  function update(dt) {
    glowPulse += dt * 2.5;

    // Update score popups
    for (var i = scorePopups.length - 1; i >= 0; i--) {
      var p = scorePopups[i];
      p.y -= 60 * dt;
      p.life -= dt;
      if (p.life <= 0) scorePopups.splice(i, 1);
    }

    if (flashTimer > 0) flashTimer -= dt;

    if (state !== 'PLAYING') return;

    sweepAngle += sweepSpeed * dt;
    // Increase speed over time
    sweepSpeed = 1.8 + (GAME_DURATION - timeLeft) * 0.06;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
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

    // Check distance from center
    var dx = x - CX;
    var dy = y - CY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    var result = getAccuracyZone(dist);
    if (result) {
      // Check timing: sweep bar near the top indicator
      var onTarget = isNearTarget();
      if (onTarget) {
        score += result.pts;
        flashColor = result.color;
        flashTimer = 0.25;
        try { Audio.play('gem'); } catch (e) {}
        scorePopups.push({
          x: CX, y: CY - RING_MAX - 20,
          text: '+' + result.pts + ' ' + result.zone,
          life: 0.9, maxLife: 0.9,
          color: result.color
        });
      } else {
        // Tap rings but not at the right time
        score += 1;
        try { Audio.play('tap'); } catch (e) {}
        scorePopups.push({
          x: CX, y: CY - RING_MAX - 20,
          text: '+1 EARLY',
          life: 0.7, maxLife: 0.7,
          color: '#777'
        });
      }
    } else {
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function draw() {
    var bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, VH);
    bg.addColorStop(0, '#0a0015');
    bg.addColorStop(1, '#000008');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      drawMenu();
      return;
    }

    drawTarget();
    drawSweepBar();
    drawTopIndicator();
    drawScorePopups();
    drawHUD();

    if (flashTimer > 0) {
      var alpha = flashTimer / 0.25 * 0.3;
      ctx.fillStyle = 'rgba(255,255,100,' + alpha + ')';
      ctx.fillRect(0, 0, VW, VH);
    }

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawMenu() {
    // Animated target preview
    var t = glowPulse;
    drawTargetAt(CX, VH * 0.4, 1.0);

    // Animated sweep
    var previewAngle = t * 1.8;
    ctx.save();
    ctx.translate(CX, VH * 0.4);
    ctx.rotate(previewAngle);
    ctx.strokeStyle = 'rgba(255,255,0,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -RING_MAX - 10);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TARGET BLITZ', VW / 2, VH * 0.1);
    ctx.shadowBlur = 0;

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ccb';
    ctx.fillText('Tap when the bar hits the top!', VW / 2, VH * 0.75);
    ctx.fillText('Outer=1  Middle=3  Center=5', VW / 2, VH * 0.81);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,200,0,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawTargetAt(cx, cy, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer ring
    var outerGrd = ctx.createRadialGradient(cx, cy, RING_MID, cx, cy, RING_MAX);
    outerGrd.addColorStop(0, 'rgba(100,100,255,0.3)');
    outerGrd.addColorStop(1, 'rgba(50,50,180,0.1)');
    ctx.beginPath();
    ctx.arc(cx, cy, RING_MAX, 0, Math.PI * 2);
    ctx.fillStyle = outerGrd;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,150,255,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Middle ring
    var midGrd = ctx.createRadialGradient(cx, cy, RING_CENTER, cx, cy, RING_MID);
    midGrd.addColorStop(0, 'rgba(0,200,255,0.35)');
    midGrd.addColorStop(1, 'rgba(0,150,200,0.15)');
    ctx.beginPath();
    ctx.arc(cx, cy, RING_MID, 0, Math.PI * 2);
    ctx.fillStyle = midGrd;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,220,255,0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center ring
    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 4);
    var centerGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, RING_CENTER);
    centerGrd.addColorStop(0, 'rgba(255,255,100,' + (pulse * 0.9) + ')');
    centerGrd.addColorStop(0.5, 'rgba(255,180,0,' + (pulse * 0.7) + ')');
    centerGrd.addColorStop(1, 'rgba(200,100,0,0.2)');
    ctx.beginPath();
    ctx.arc(cx, cy, RING_CENTER, 0, Math.PI * 2);
    ctx.fillStyle = centerGrd;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,0,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - RING_MAX - 10, cy);
    ctx.lineTo(cx + RING_MAX + 10, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - RING_MAX - 10);
    ctx.lineTo(cx, cy + RING_MAX + 10);
    ctx.stroke();

    ctx.restore();
  }

  function drawTarget() {
    drawTargetAt(CX, CY, 1.0);
  }

  function drawSweepBar() {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(sweepAngle);

    // Glow trail
    ctx.strokeStyle = 'rgba(255,220,0,0.2)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -(RING_MAX + 15));
    ctx.stroke();

    // Main bar
    ctx.strokeStyle = 'rgba(255,255,0,0.95)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -(RING_MAX + 15));
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawTopIndicator() {
    // Arrow/indicator at the top of the target circle
    var ix = CX;
    var iy = CY - RING_MAX - 24;
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(glowPulse * 3));
    ctx.fillStyle = 'rgba(255,255,0,' + pulse + ')';
    ctx.beginPath();
    ctx.moveTo(ix, iy + 14);
    ctx.lineTo(ix - 10, iy);
    ctx.lineTo(ix + 10, iy);
    ctx.closePath();
    ctx.fill();
  }

  function drawScorePopups() {
    for (var i = 0; i < scorePopups.length; i++) {
      var p = scorePopups[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
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

    // Timer bar
    var timerBarY = VH - 30;
    var prog = timeLeft / GAME_DURATION;
    var hue = prog * 120;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(20, timerBarY, VW - 40, 16);
    ctx.fillStyle = 'hsl(' + hue + ',90%,55%)';
    ctx.fillRect(20, timerBarY, (VW - 40) * prog, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(timeLeft) + 's', VW / 2, timerBarY + 12);
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 20;
    ctx.fillText('TIME\'S UP!', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ddf';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(255,220,0,' + pulse + ')';
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
