'use strict';
var OrbitTap = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score = 0;
  var best = 0;
  var lives = 3;

  var VW = 390;
  var VH = 844;

  var SUN_X = VW / 2;
  var SUN_Y = VH / 2;
  var SUN_R = 30;

  var planets = [];
  var time = 0;
  var particles = [];
  var shakeTime = 0;
  var flashTime = 0;
  var flashColor = '#fff';

  var PLANET_DEFS = [
    { r: 90,  speed: 1.1,  size: 16, color: '#4CAF50', targetArc: 0.22 },
    { r: 150, speed: 0.7,  size: 20, color: '#2196F3', targetArc: 0.20 },
    { r: 215, speed: 0.45, size: 24, color: '#FF9900', targetArc: 0.18 }
  ];

  // Target zone is fixed at right side (angle=0) for each planet
  var TARGET_ANGLE = 0;

  function makePlanets() {
    planets = [];
    for (var i = 0; i < PLANET_DEFS.length; i++) {
      var def = PLANET_DEFS[i];
      planets.push({
        r: def.r,
        speed: def.speed,
        size: def.size,
        color: def.color,
        targetArc: def.targetArc,
        angle: Math.random() * Math.PI * 2,
        tapped: false,
        tapFlash: 0
      });
    }
  }

  function angleInZone(planet) {
    // Normalize angle to -PI..PI
    var a = planet.angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    // Target zone centered at 0 (right side) — check closeness to 0 or 2PI
    var diff = Math.abs(a);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff < planet.targetArc;
  }

  function spawnParticles(x, y, color) {
    for (var i = 0; i < 12; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd = 40 + Math.random() * 80;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 0.7,
        maxLife: 0.7,
        size: 3 + Math.random() * 4
      });
    }
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    score = 0;
    lives = 3;
    time = 0;
    particles = [];
    makePlanets();
  }

  function startGame() {
    state = 'PLAYING';
    score = 0;
    lives = 3;
    time = 0;
    particles = [];
    makePlanets();
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function killPlayer() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'orbittap_best'); } catch(e) {}
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    time += dt;
    if (shakeTime > 0) shakeTime -= dt;
    if (flashTime > 0) flashTime -= dt;

    var speedMult = 1 + score * 0.015;
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      p.angle += p.speed * speedMult * dt;
      if (p.tapFlash > 0) p.tapFlash -= dt;
    }

    for (var j = particles.length - 1; j >= 0; j--) {
      var pt = particles[j];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 30 * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(j, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);

    // Space background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, VW, VH);
    drawStars();

    if (state === 'MENU') { drawMenu(); return; }

    var sx = 0, sy = 0;
    if (shakeTime > 0) {
      sx = (Math.random() - 0.5) * 10;
      sy = (Math.random() - 0.5) * 10;
    }

    ctx.save();
    ctx.translate(sx, sy);

    if (flashTime > 0) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashTime * 0.5;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }

    drawOrbits();
    drawTargetZones();
    drawSun();
    drawPlanets();
    drawParticles();
    drawHUD();

    ctx.restore();

    if (state === 'DEAD') drawDeadOverlay();
  }

  function drawStars() {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // Use a seeded pattern
    for (var i = 0; i < 60; i++) {
      var sx2 = ((i * 137 + 23) % VW);
      var sy2 = ((i * 211 + 47) % VH);
      var r = (i % 3 === 0) ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(sx2, sy2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOrbits() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SUN_X, SUN_Y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTargetZones() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var pulse = 0.4 + 0.4 * Math.abs(Math.sin(time * 3 + i));
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(SUN_X, SUN_Y, p.r, -p.targetArc, p.targetArc);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Star marker at target
      ctx.fillStyle = p.color;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(SUN_X + p.r, SUN_Y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawSun() {
    var grd = ctx.createRadialGradient(SUN_X, SUN_Y, 2, SUN_X, SUN_Y, SUN_R);
    grd.addColorStop(0, '#fff9c4');
    grd.addColorStop(0.4, '#FFD700');
    grd.addColorStop(1, '#FF9900');
    ctx.fillStyle = grd;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(SUN_X, SUN_Y, SUN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPlanets() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var px = SUN_X + Math.cos(p.angle) * p.r;
      var py = SUN_Y + Math.sin(p.angle) * p.r;

      // Glow when near target
      if (angleInZone(p)) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
      }

      var grd = ctx.createRadialGradient(px - p.size * 0.3, py - p.size * 0.3, 2, px, py, p.size);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.5, p.color);
      grd.addColorStop(1, shadeColor(p.color, -50));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (p.tapFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (p.tapFlash * 2) + ')';
        ctx.beginPath();
        ctx.arc(px, py, p.size + 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE: ' + score, VW / 2, 50);

    // Lives
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#FF4C4C' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(VW / 2 + (i - 1) * 28, 80, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMenu() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 24;
    ctx.fillText('ORBIT TAP', VW / 2, VH * 0.25);
    ctx.shadowBlur = 0;

    ctx.font = '20px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Tap planets in the glowing zone!', VW / 2, VH * 0.35);
    ctx.fillText('3 lives. Miss = lose a life!', VW / 2, VH * 0.41);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.52);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO PLAY', VW / 2, VH * 0.65);
    ctx.globalAlpha = 1;

    drawSun();
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var px = SUN_X + Math.cos(p.angle) * (p.r * 0.4 + 20);
      var py = SUN_Y + 60 + Math.sin(p.angle) * (p.r * 0.3 + 10);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDeadOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#FF4C4C';
    ctx.font = 'bold 54px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF4C4C';
    ctx.shadowBlur = 30;
    ctx.fillText('GAME OVER', VW / 2, VH * 0.35);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('SCORE: ' + score, VW / 2, VH * 0.47);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BEST: ' + best, VW / 2, VH * 0.56);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    var pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO RETRY', VW / 2, VH * 0.7);
    ctx.globalAlpha = 1;
  }

  function shadeColor(color, amount) {
    var num = parseInt(color.slice(1), 16);
    var r = Math.max(0, Math.min(255, (num >> 16) + amount));
    var g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
    var b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { state = 'MENU'; return; }
    if (state !== 'PLAYING') return;

    var hit = false;
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var px = SUN_X + Math.cos(p.angle) * p.r;
      var py = SUN_Y + Math.sin(p.angle) * p.r;
      var dx = x - px;
      var dy = y - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < p.size + 14) {
        hit = true;
        if (angleInZone(p)) {
          score++;
          p.tapFlash = 0.3;
          spawnParticles(px, py, p.color);
          try { Audio.play('gem'); } catch (e) {}
          flashColor = p.color;
          flashTime = 0.15;
        } else {
          lives--;
          p.tapFlash = 0.3;
          shakeTime = 0.3;
          try { Audio.play('crash'); } catch (e) {}
          if (lives <= 0) { killPlayer(); return; }
        }
        break;
      }
    }
    // Empty-space tap: do nothing (no penalty)
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
