'use strict';
var SpeedClick = (function () {

  var canvas, ctx;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, best;

  var dot = { x: 0, y: 0, r: 40, timer: 0, maxTime: 2.5 };
  var glowPulse = 0;
  var particles = [];

  function init(c, bestScore) {
    canvas = c;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function dotRadius() {
    return Math.max(16, 40 - score * 0.7);
  }

  function dotMaxTime() {
    return Math.max(0.8, 2.5 - score * 0.04);
  }

  function spawnDot() {
    var r = dotRadius();
    var margin = 60;
    dot.r = r;
    dot.maxTime = dotMaxTime();
    dot.timer = 0;
    dot.x = margin + r + Math.random() * (VW - 2 * (margin + r));
    dot.y = 120 + r + Math.random() * (VH - 120 - 2 * (r + 60));
  }

  function spawnParticles(x, y, color) {
    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * Math.PI * 2;
      var spd = 60 + Math.random() * 80;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        r: 4 + Math.random() * 4,
        color: color
      });
    }
  }

  function startGame() {
    score = 0;
    lives = 3;
    particles = [];
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
    spawnDot();
  }

  function endGame() {
    if (score > best) best = score;
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'speedclick_best'); } catch(e) {}
    state = 'DEAD';
  }

  function update(dt) {
    glowPulse += dt * 3;

    // Update particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    if (state !== 'PLAYING') return;

    dot.timer += dt;
    if (dot.timer >= dot.maxTime) {
      // Dot expired = miss
      lives--;
      try { Audio.play('crash'); } catch (e) {}
      if (lives <= 0) {
        endGame();
        return;
      }
      spawnDot();
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

    var dx = x - dot.x;
    var dy = y - dot.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= dot.r + 8) {
      // Hit!
      score++;
      spawnParticles(dot.x, dot.y, '#00ffcc');
      try { Audio.play('gem'); } catch (e) {}
      spawnDot();
    } else {
      // Miss
      lives--;
      spawnParticles(x, y, '#ff4444');
      try { Audio.play('crash'); } catch (e) {}
      if (lives <= 0) {
        endGame();
        return;
      }
    }
  }

  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#050510');
    bg.addColorStop(1, '#0a0a20');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    // Grid lines decoration
    ctx.strokeStyle = 'rgba(0,200,255,0.04)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < VW; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, VH);
      ctx.stroke();
    }
    for (var gy = 0; gy < VH; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(VW, gy);
      ctx.stroke();
    }

    if (state === 'MENU') {
      drawMenu();
      drawParticles();
      return;
    }

    drawParticles();
    drawDot();
    drawHUD();

    if (state === 'DEAD') {
      drawDead();
    }
  }

  function drawMenu() {
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('SPEED CLICK', VW / 2, VH * 0.2);
    ctx.shadowBlur = 0;

    // Demo dot
    var pr = 44 + Math.sin(glowPulse) * 6;
    var grd = ctx.createRadialGradient(VW / 2, VH * 0.42, 0, VW / 2, VH * 0.42, pr * 2);
    grd.addColorStop(0, 'rgba(0,255,200,0.5)');
    grd.addColorStop(1, 'rgba(0,255,200,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(VW / 2, VH * 0.42, pr * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(VW / 2, VH * 0.42, pr, 0, Math.PI * 2);
    var dotGrd = ctx.createRadialGradient(VW / 2 - 12, VH * 0.42 - 12, 0, VW / 2, VH * 0.42, pr);
    dotGrd.addColorStop(0, '#afffef');
    dotGrd.addColorStop(0.5, '#00ffc8');
    dotGrd.addColorStop(1, '#006655');
    ctx.fillStyle = dotGrd;
    ctx.fill();

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aac';
    ctx.shadowBlur = 0;
    ctx.fillText('Tap the dot before it vanishes!', VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(0,255,200,' + pulse + ')';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.88);

    ctx.fillStyle = '#aac';
    ctx.font = '22px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.94);
    ctx.textAlign = 'left';
  }

  function drawDot() {
    var timeLeft = 1.0 - dot.timer / dot.maxTime;
    var r = dot.r;

    // Danger pulse when time is low
    var extraGlow = timeLeft < 0.3 ? Math.sin(glowPulse * 8) * 0.5 + 0.5 : 0;
    var glowColor = timeLeft < 0.3 ? 'rgba(255,80,0,' : 'rgba(0,255,200,';
    var glowR = r * (1.5 + extraGlow * 0.5);

    var grd = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, glowR * 1.5);
    grd.addColorStop(0, glowColor + '0.5)');
    grd.addColorStop(1, glowColor + '0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, glowR * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
    var dotGrd = ctx.createRadialGradient(dot.x - r * 0.3, dot.y - r * 0.3, 0, dot.x, dot.y, r);
    if (timeLeft < 0.3) {
      dotGrd.addColorStop(0, '#ffddaa');
      dotGrd.addColorStop(0.5, '#ff8800');
      dotGrd.addColorStop(1, '#aa4400');
    } else {
      dotGrd.addColorStop(0, '#afffef');
      dotGrd.addColorStop(0.5, '#00ffc8');
      dotGrd.addColorStop(1, '#006655');
    }
    ctx.fillStyle = dotGrd;
    ctx.fill();

    // Timer arc
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeLeft);
    ctx.strokeStyle = timeLeft < 0.3 ? '#ff8800' : '#00ffc8';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff4466' : '#333';
      ctx.beginPath();
      ctx.arc(VW / 2 - 20 + i * 20, 36, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.38);
    ctx.shadowBlur = 0;

    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ddf';
    ctx.fillText('Score: ' + score, VW / 2, VH * 0.48);
    ctx.fillText('Best: ' + best, VW / 2, VH * 0.55);

    var pulse = 0.7 + 0.3 * Math.sin(glowPulse * 2);
    ctx.fillStyle = 'rgba(0,255,200,' + pulse + ')';
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
