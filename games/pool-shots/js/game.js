'use strict';
var PoolShots = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';

  // Game state
  var score, lives, round, totalRounds;
  var disc;
  var discLaunched, waitingForNext;
  var waitTimer;

  // Zone definitions: y, h, pts, color, label
  var ZONES = [
    { y: 100, h: 60, pts: 3, color: '#f87171', label: '3 PTS' },
    { y: 180, h: 60, pts: 2, color: '#fde68a', label: '2 PTS' },
    { y: 260, h: 60, pts: 1, color: '#86efac', label: '1 PT' }
  ];

  // Two bumper pegs in the middle of the lane
  var PEGS = [
    { x: VW / 2 - 60, y: 460, r: 16 },
    { x: VW / 2 + 60, y: 530, r: 16 }
  ];

  var DISC_START_X = VW / 2;
  var DISC_START_Y = 760;
  var DISC_R = 22;
  var FRICTION = 200;

  function init(canvas, bestScore) {
    c = canvas;
    ctx = c.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
  }

  function resetDisc() {
    disc = { x: DISC_START_X, y: DISC_START_Y, vx: 0, vy: 0, r: DISC_R };
    discLaunched = false;
    waitingForNext = false;
    waitTimer = 0;
  }

  function startGame() {
    score = 0;
    lives = 3;
    round = 1;
    totalRounds = 5;
    resetDisc();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function endGame() {
    if (score > best) { best = score; AdManager.happyTime(1.0); }
    state = 'DEAD';
    try { Audio.play('lose'); } catch(e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'poolshots_best'); } catch(e) {}
  }

  function nextRound() {
    round++;
    if (round > totalRounds) {
      endGame();
    } else {
      resetDisc();
    }
  }

  function checkZone() {
    for (var i = 0; i < ZONES.length; i++) {
      var z = ZONES[i];
      if (disc.y >= z.y && disc.y <= z.y + z.h) {
        score += z.pts;
        if (score > best) { best = score; AdManager.happyTime(1.0); }
        try { Audio.play('gem'); } catch(e) {}
        return;
      }
    }
    // Miss
    try { Audio.play('tap'); } catch(e) {}
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;

    if (waitingForNext) {
      waitTimer -= dt;
      if (waitTimer <= 0) {
        nextRound();
      }
      return;
    }

    if (!discLaunched) return;

    // Apply friction deceleration
    var spd = Math.sqrt(disc.vx * disc.vx + disc.vy * disc.vy);
    if (spd > 0) {
      var decel = FRICTION * dt;
      if (decel >= spd) {
        disc.vx = 0;
        disc.vy = 0;
      } else {
        var frac = (spd - decel) / spd;
        disc.vx *= frac;
        disc.vy *= frac;
      }
    }

    disc.x += disc.vx * dt;
    disc.y += disc.vy * dt;

    // Wall bounce left/right
    if (disc.x - disc.r < 0) {
      disc.x = disc.r;
      disc.vx = Math.abs(disc.vx) * 0.75;
    }
    if (disc.x + disc.r > VW) {
      disc.x = VW - disc.r;
      disc.vx = -Math.abs(disc.vx) * 0.75;
    }

    // Top wall bounce
    if (disc.y - disc.r < 80) {
      disc.y = 80 + disc.r;
      disc.vy = Math.abs(disc.vy) * 0.5;
    }

    // Bottom wall bounce
    if (disc.y + disc.r > VH - 20) {
      disc.y = VH - 20 - disc.r;
      disc.vy = -Math.abs(disc.vy) * 0.5;
    }

    // Peg collisions
    for (var pi = 0; pi < PEGS.length; pi++) {
      var peg = PEGS[pi];
      var pdx = disc.x - peg.x;
      var pdy = disc.y - peg.y;
      var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      var minDist = disc.r + peg.r;
      if (pdist < minDist && pdist > 0) {
        var nx = pdx / pdist;
        var ny = pdy / pdist;
        disc.x = peg.x + nx * minDist;
        disc.y = peg.y + ny * minDist;
        var dot = disc.vx * nx + disc.vy * ny;
        disc.vx = (disc.vx - 2 * dot * nx) * 0.8;
        disc.vy = (disc.vy - 2 * dot * ny) * 0.8;
      }
    }

    // Check if disc has stopped
    if (Math.abs(disc.vx) < 2 && Math.abs(disc.vy) < 2) {
      disc.vx = 0;
      disc.vy = 0;
      checkZone();
      waitingForNext = true;
      waitTimer = 1.0;
    }
  }

  function drawWoodBg() {
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = '#1a0e04';
    ctx.lineWidth = 1;
    for (var i = 0; i < VH; i += 28) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(VW, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,120,0.04)';
    ctx.lineWidth = 2;
    for (var j = 0; j < VW; j += 18) {
      ctx.beginPath();
      ctx.moveTo(j, 0);
      ctx.lineTo(j + 8, VH);
      ctx.stroke();
    }
  }

  function drawHUD() {
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + score, 14, 44);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a8edea';
    ctx.font = '18px system-ui';
    ctx.fillText('Best: ' + best, VW - 14, 44);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('Round ' + round + ' / ' + totalRounds, VW / 2, 44);
    ctx.textAlign = 'left';
  }

  function draw() {
    drawWoodBg();

    if (state === 'MENU') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 220, VW, 400);

      ctx.textAlign = 'center';
      ctx.font = 'bold 52px system-ui';
      ctx.fillStyle = '#fde68a';
      ctx.shadowBlur = 28;
      ctx.shadowColor = '#fde68a';
      ctx.fillText('POOL SHOTS', VW / 2, 300);
      ctx.shadowBlur = 0;
      ctx.font = '20px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Tap to launch the disc!', VW / 2, 368);
      ctx.fillText('Aim for the high-score zones.', VW / 2, 398);
      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#86efac';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#86efac';
      ctx.fillText('TAP TO PLAY', VW / 2, 468);
      ctx.shadowBlur = 0;
      ctx.font = '18px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 528);
      ctx.textAlign = 'left';
      return;
    }

    // Draw score zones
    for (var zi = 0; zi < ZONES.length; zi++) {
      var z = ZONES[zi];
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(0, z.y, VW, z.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, z.y, VW, z.h);
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px system-ui';
      ctx.fillStyle = z.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = z.color;
      ctx.fillText(z.label, VW / 2, z.y + z.h / 2 + 8);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    // Draw peg bumpers
    for (var pi = 0; pi < PEGS.length; pi++) {
      var peg = PEGS[pi];
      ctx.fillStyle = '#a8edea';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#a8edea';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw disc
    if (disc) {
      ctx.fillStyle = '#aaaaaa';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#cccccc';
      ctx.beginPath();
      ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(disc.x - disc.r * 0.3, disc.y - disc.r * 0.3, disc.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!discLaunched) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(disc.x, disc.y);
        ctx.lineTo(disc.x, disc.y - 120);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.font = '18px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Tap to launch!', VW / 2, disc.y + 50);
        ctx.textAlign = 'left';
      }
    }

    drawHUD();

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px system-ui';
      ctx.fillStyle = '#f87171';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#f87171';
      ctx.fillText('GAME OVER', VW / 2, 300);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(score, VW / 2, 375);
      ctx.font = '22px system-ui';
      ctx.fillStyle = '#a8edea';
      ctx.fillText('BEST: ' + best, VW / 2, 428);
      ctx.font = 'bold 24px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TAP TO RETRY', VW / 2, 510);
      ctx.textAlign = 'left';
    }
  }

  function tap(x, y) {
    if (state === 'MENU') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'DEAD') {
      startGame();
      try { Audio.play('tap'); } catch(e) {}
      return;
    }
    if (state === 'PLAYING') {
      if (waitingForNext) return;
      if (discLaunched) return;

      // Launch disc: power based on tap y — higher tap = more power upward
      var power = (VH - y) / VH * 900;
      if (power < 100) power = 100;

      // Horizontal component based on tap x vs disc center
      var dxLaunch = x - disc.x;
      var vx = dxLaunch * 0.5;
      if (vx > 400) vx = 400;
      if (vx < -400) vx = -400;

      var vyMag = Math.sqrt(Math.max(0, power * power - vx * vx));
      disc.vx = vx;
      disc.vy = -vyMag; // negative = upward
      discLaunched = true;
      try { Audio.play('tap'); } catch(e) {}
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
