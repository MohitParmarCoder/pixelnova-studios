'use strict';
var BalanceBeam = (function () {
  var VW = 390, VH = 844;
  var ctx, best, state, score;

  // Beam geometry
  var PIVOT_X, PIVOT_Y;
  var BEAM_LEN = 160;   // half-length from pivot
  var BEAM_H = 14;
  var MAX_ANGLE = Math.PI / 4;  // 45 degrees = game over

  var beamAngle;        // radians, positive = right side down
  var beamVel;          // angular velocity
  var leftItems;        // [{w, x, dist}] w=weight(1-5), x=beam-relative x from center
  var rightItems;
  var fallingItem;      // {w, x, y, vy, side} — currently falling from top
  var fallTimer;        // time until next item spawns
  var FALL_INTERVAL_START = 2.2;
  var fallInterval;
  var GRAVITY = 0.4;    // angular restoring force
  var DAMPING = 0.88;
  var particles;
  var scoreFlashes;     // [{x,y,val,life}]

  var NEON = ['#00fff7','#ff00cc','#39ff14','#ffe600','#ff6600','#cc00ff'];

  function _weightColor(w) {
    if (w >= 5) return '#ffe600';
    if (w >= 4) return '#ff6600';
    if (w >= 3) return '#ff00cc';
    if (w >= 2) return '#00fff7';
    return '#39ff14';
  }

  function _reset() { state = 'MENU'; score = 0; }

  function _startGame() {
    state = 'PLAYING';
    score = 0;
    beamAngle = 0;
    beamVel = 0;
    leftItems = [];
    rightItems = [];
    particles = [];
    scoreFlashes = [];
    PIVOT_X = VW / 2;
    PIVOT_Y = VH / 2 + 60;
    fallInterval = FALL_INTERVAL_START;
    fallTimer = 0.8;
    fallingItem = null;
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function _spawnFalling() {
    // Weight increases with score
    var maxW = Math.min(5, 1 + Math.floor(score / 5));
    var w = 1 + Math.floor(Math.random() * maxW);
    var xr = 40 + Math.random() * (VW - 80);
    fallingItem = { w: w, x: xr, y: 60, vy: 0 };
  }

  function _weightTorque() {
    var leftT = 0, rightT = 0;
    for (var i = 0; i < leftItems.length; i++) leftT += leftItems[i].w * leftItems[i].dist;
    for (var i = 0; i < rightItems.length; i++) rightT += rightItems[i].w * rightItems[i].dist;
    return rightT - leftT;  // positive = right side heavier = positive angle
  }

  function _spawnParticles(bx, by, color) {
    for (var i = 0; i < 10; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 100;
      particles.push({ x: bx, y: by, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 30, life: 0.7, maxLife: 0.7, r: 3 + Math.random() * 3, color: color });
    }
  }

  function init(canvas, savedBest) {
    ctx = canvas.getContext('2d');
    best = savedBest || 0;
    _reset();
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;

    // Falling item physics
    if (fallingItem) {
      fallingItem.vy += 420 * dt;
      fallingItem.y += fallingItem.vy * dt;

      // Hit beam?
      var beamHit = _getFallingBeamY(fallingItem.x);
      if (fallingItem.y >= beamHit && beamHit !== null) {
        _landItem(fallingItem.x, beamHit);
        fallingItem = null;
        fallTimer = 0;
      } else if (fallingItem.y > VH + 50) {
        // Missed entirely
        fallingItem = null;
        fallTimer = 0;
      }
    } else {
      fallTimer += dt;
      if (fallTimer >= fallInterval) {
        fallTimer -= fallInterval;
        _spawnFalling();
        fallInterval = Math.max(0.9, fallInterval * 0.98);
      }
    }

    // Physics: torque from items drives angular velocity
    var torque = _weightTorque();
    var angAccel = torque * 0.012;
    beamVel += angAccel * dt * 60;
    beamVel *= Math.pow(DAMPING, dt * 60);
    beamAngle += beamVel * dt;

    // Clamp and check game over
    if (Math.abs(beamAngle) >= MAX_ANGLE) {
      beamAngle = Math.sign(beamAngle) * MAX_ANGLE;
      state = 'DEAD';
      if (score > best) best = score;
      try { Audio.play('lose'); } catch (e) {}
      try { AdManager.gameplayStop(); } catch (e) {}
      try { AdManager.onRunEnd(); } catch (e) {}
    }

    // Particles
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var p = particles[pi];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(pi, 1);
    }
    for (var fi = scoreFlashes.length - 1; fi >= 0; fi--) {
      var sf = scoreFlashes[fi];
      sf.y -= 55 * dt;
      sf.life -= dt * 1.4;
      if (sf.life <= 0) scoreFlashes.splice(fi, 1);
    }
  }

  // Compute the world-Y of the beam surface at a given screen-X
  function _getFallingBeamY(screenX) {
    // Beam goes from pivot outward in both directions, rotated by beamAngle
    var dx = screenX - PIVOT_X;
    // Within beam bounds?
    if (Math.abs(dx) > BEAM_LEN + 30) return null;
    var beamY = PIVOT_Y + dx * Math.sin(beamAngle) - BEAM_H / 2;
    return beamY;
  }

  function _landItem(screenX, screenY) {
    var dx = screenX - PIVOT_X;
    var side = dx < 0 ? 'left' : 'right';
    var dist = Math.abs(dx);
    var w = fallingItem ? fallingItem.w : 1;

    var itemObj = { w: w, dist: dist, x: screenX };
    if (side === 'left') leftItems.push(itemObj);
    else rightItems.push(itemObj);

    score++;
    var color = _weightColor(w);
    _spawnParticles(screenX, screenY, color);
    scoreFlashes.push({ x: screenX, y: screenY - 20, val: '+' + w, life: 1 });

    try { Audio.play('land'); } catch (e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') { _startGame(); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function () { _startGame(); }); } catch (e) { _startGame(); }
      try { AdManager.offerDoubleScore(score, 'balancebeam_best'); } catch(e) {}
      return;
    }
    if (state !== 'PLAYING' || !fallingItem) return;

    // Override falling item's X to where the player tapped
    fallingItem.x = x;
    // Instantly teleport it to just above the beam
    var targetY = _getFallingBeamY(x);
    if (targetY !== null && fallingItem.y < targetY) {
      fallingItem.y = Math.max(fallingItem.y, targetY - 200);
    }
    fallingItem.vy = Math.max(fallingItem.vy, 200); // give it a boost down
    try { Audio.play('tap'); } catch (e) {}
  }

  // Beam endpoint in world space
  function _beamEnd(side) {
    var s = side === 'left' ? -1 : 1;
    return {
      x: PIVOT_X + s * BEAM_LEN * Math.cos(beamAngle),
      y: PIVOT_Y + s * BEAM_LEN * Math.sin(beamAngle)
    };
  }

  function _drawBeam() {
    var left = _beamEnd('left');
    var right = _beamEnd('right');

    ctx.save();
    // Glow
    ctx.shadowBlur = 16;
    var dangerLevel = Math.abs(beamAngle) / MAX_ANGLE;
    var beamColor = dangerLevel > 0.7
      ? ('#ff' + Math.floor((1 - dangerLevel) * 99).toString(16).padStart(2,'0') + '00')
      : '#00fff7';
    ctx.shadowColor = beamColor;
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = BEAM_H;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    // Center mark
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X - 6, PIVOT_Y);
    ctx.lineTo(PIVOT_X + 6, PIVOT_Y);
    ctx.stroke();
    ctx.restore();

    // Pivot triangle
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffe600';
    ctx.fillStyle = '#ffe600';
    var ph = 22, pw = 18;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y + BEAM_H / 2);
    ctx.lineTo(PIVOT_X - pw / 2, PIVOT_Y + BEAM_H / 2 + ph);
    ctx.lineTo(PIVOT_X + pw / 2, PIVOT_Y + BEAM_H / 2 + ph);
    ctx.closePath();
    ctx.fill();
    // Base
    ctx.fillStyle = '#cc9900';
    ctx.fillRect(PIVOT_X - 30, PIVOT_Y + BEAM_H / 2 + ph, 60, 10);
    ctx.restore();

    // Items on beam
    var allItems = leftItems.map(function(it){ return {it:it,side:'left'}; })
      .concat(rightItems.map(function(it){ return {it:it,side:'right'}; }));
    for (var i = 0; i < allItems.length; i++) {
      var entry = allItems[i];
      var it = entry.it;
      var dx2 = entry.side === 'left' ? -it.dist : it.dist;
      var wx = PIVOT_X + dx2 * Math.cos(beamAngle);
      var wy = PIVOT_Y + dx2 * Math.sin(beamAngle) - BEAM_H / 2;
      _drawWeight(wx, wy, it.w);
    }
  }

  function _drawWeight(cx, topY, w) {
    var r = 14 + w * 3;
    var color = _weightColor(w);
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    var g = ctx.createRadialGradient(cx - r * 0.3, topY - r * 0.3 - r, r * 0.2, cx, topY - r, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, 'rgba(4,5,14,0.8)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, topY - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (12 + w) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(w, cx, topY - r);
    ctx.restore();
  }

  function _drawFalling() {
    if (!fallingItem) return;
    var w = fallingItem.w;
    var r = 14 + w * 3;
    var color = _weightColor(w);
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    var g = ctx.createRadialGradient(fallingItem.x - r * 0.3, fallingItem.y - r * 0.3, r * 0.1, fallingItem.x, fallingItem.y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, 'rgba(4,5,14,0.6)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fallingItem.x, fallingItem.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (12 + w) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(w, fallingItem.x, fallingItem.y);
    // Drop guide
    var beamY = _getFallingBeamY(fallingItem.x);
    if (beamY !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fallingItem.x, fallingItem.y + r);
      ctx.lineTo(fallingItem.x, beamY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function _drawAngleIndicator() {
    var pct = Math.abs(beamAngle) / MAX_ANGLE;
    var barW = 160, barH = 10;
    var bx = VW / 2 - barW / 2, by = 88;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, barW, barH, 5) : ctx.fillRect(bx, by, barW, barH);
    ctx.fill();
    var fillColor = pct > 0.7 ? '#ff3300' : pct > 0.4 ? '#ff6600' : '#39ff14';
    ctx.fillStyle = fillColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = fillColor;
    var fillW = pct * barW;
    // Fill from center outward
    var fillX = beamAngle >= 0 ? VW / 2 : VW / 2 - fillW;
    ctx.beginPath();
    ctx.fillRect(fillX, by, fillW, barH);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#04050e';
    ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') { _drawMenu(); return; }

    // Background grid
    ctx.strokeStyle = 'rgba(0,255,247,0.04)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < VW; gx += 50) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, VH); ctx.stroke();
    }
    for (var gy = 0; gy < VH; gy += 50) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(VW, gy); ctx.stroke();
    }

    // Tap zone hints
    ctx.fillStyle = 'rgba(0,255,247,0.03)';
    ctx.fillRect(0, 0, VW / 2, VH);
    ctx.fillStyle = 'rgba(255,0,204,0.03)';
    ctx.fillRect(VW / 2, 0, VW / 2, VH);
    // Center divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([5, 8]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(VW / 2, 0); ctx.lineTo(VW / 2, VH); ctx.stroke();
    ctx.setLineDash([]);

    _drawBeam();
    _drawFalling();

    // Particles
    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score flashes
    for (var fi = 0; fi < scoreFlashes.length; fi++) {
      var sf = scoreFlashes[fi];
      ctx.save();
      ctx.globalAlpha = sf.life;
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffe600';
      ctx.fillText(sf.val, sf.x, sf.y);
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px system-ui';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00fff7';
    ctx.fillText(score, VW / 2, 56);
    ctx.fillStyle = 'rgba(255,230,0,0.7)';
    ctx.font = '13px system-ui';
    ctx.shadowBlur = 0;
    ctx.fillText('BEST ' + best, VW / 2, 76);
    ctx.restore();

    _drawAngleIndicator();

    // Side labels
    ctx.save();
    ctx.fillStyle = 'rgba(0,255,247,0.3)';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('LEFT', 14, VH - 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,0,204,0.3)';
    ctx.fillText('RIGHT', VW - 14, VH - 30);
    ctx.restore();

    if (state === 'DEAD') _drawDead();
  }

  function _drawMenu() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ffe600';
    ctx.fillStyle = '#ffe600';
    ctx.fillText('BALANCE', VW / 2, VH / 2 - 55);
    ctx.fillStyle = '#00fff7';
    ctx.shadowColor = '#00fff7';
    ctx.fillText('BEAM', VW / 2, VH / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '15px system-ui';
    ctx.fillText('Tap LEFT or RIGHT to place weights', VW / 2, VH / 2 + 72);
    ctx.fillText('Keep the beam balanced!', VW / 2, VH / 2 + 95);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 160);
    if (best > 0) {
      ctx.fillStyle = 'rgba(255,230,0,0.7)';
      ctx.font = '15px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 200);
    }
    ctx.restore();
  }

  function _drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,14,0.80)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ff00cc';
    ctx.fillStyle = '#ff00cc';
    ctx.fillText('GAME', VW / 2, VH / 2 - 60);
    ctx.fillStyle = '#ff6600';
    ctx.shadowColor = '#ff6600';
    ctx.fillText('OVER', VW / 2, VH / 2 + 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 + 62);
    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.font = '16px system-ui';
    ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 96);
    var pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = 'rgba(57,255,20,' + pulse + ')';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 155);
    ctx.restore();
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
