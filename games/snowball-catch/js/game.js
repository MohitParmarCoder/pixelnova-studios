'use strict';
var SnowballCatch = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, fish, hook, consecutiveMisses, _missAlreadyPenalized;
  var WATER_TOP = 300;
  var HOOK_START_Y = 200;
  var HOOK_MAX_Y = VH - 60;
  var HOOK_SPEED = 340;
  var LINE_RETRACT_TIME = 1.5;

  var hookStates = {
    IDLE: 'IDLE',
    FALLING: 'FALLING',
    WAITING: 'WAITING',
    RETRACTING: 'RETRACTING'
  };

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0;
    state = 'MENU';
  }

  function makeFish() {
    var big = Math.random() < 0.3;
    var r = big ? 26 : 16;
    var pts = big ? 3 : 1;
    var diff = 1 + score * 0.04;
    var speed = big ? (40 + Math.random() * 30) * diff : (70 + Math.random() * 60) * diff;
    var depth = WATER_TOP + 60 + Math.random() * (VH - WATER_TOP - 120);
    var startLeft = Math.random() < 0.5;
    return {
      x: startLeft ? -r : VW + r,
      y: depth,
      r: r,
      pts: pts,
      speed: speed,
      dir: startLeft ? 1 : -1,
      color: big ? '#ffd700' : '#6bcb77'
    };
  }

  function startGame() {
    score = 0; lives = 3; consecutiveMisses = 0; _missAlreadyPenalized = false;
    fish = [];
    var i;
    for (i = 0; i < 4; i++) fish.push(makeFish());
    hook = { x: VW / 2, y: HOOK_START_Y, hookState: hookStates.IDLE, waitTimer: 0 };
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    var i, f;
    for (i = fish.length - 1; i >= 0; i--) {
      f = fish[i];
      f.x += f.speed * f.dir * dt;
      if (f.x < -f.r - 20 || f.x > VW + f.r + 20) {
        fish.splice(i, 1);
        fish.push(makeFish());
      }
    }
    while (fish.length < 4) fish.push(makeFish());

    if (hook.hookState === hookStates.FALLING) {
      hook.y += HOOK_SPEED * dt;
      if (hook.y >= HOOK_MAX_Y) {
        hook.y = HOOK_MAX_Y;
        hook.hookState = hookStates.WAITING;
        hook.waitTimer = LINE_RETRACT_TIME;
      }
    } else if (hook.hookState === hookStates.WAITING) {
      hook.waitTimer -= dt;
      if (hook.waitTimer <= 0) {
        hook.hookState = hookStates.RETRACTING;
        if (!_missAlreadyPenalized) {
          consecutiveMisses++;
          if (consecutiveMisses >= 3) {
            consecutiveMisses = 0;
            lives--;
            try { Audio.play('lose'); } catch(e) {}
            if (lives <= 0) {
              lives = 0; state = 'DEAD';
              try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
              AdManager.showInterstitial(() => {});
              try { AdManager.offerDoubleScore(score, 'snowballcatch_best'); } catch(e) {}
              return;
            }
          }
        }
        _missAlreadyPenalized = false;
      }
    } else if (hook.hookState === hookStates.RETRACTING) {
      hook.y -= HOOK_SPEED * 1.5 * dt;
      if (hook.y <= HOOK_START_Y) {
        hook.y = HOOK_START_Y;
        hook.hookState = hookStates.IDLE;
        _missAlreadyPenalized = false;
      }
    }
  }

  function trySetHook() {
    if (hook.hookState !== hookStates.WAITING) return;
    var i, f, dx, dy, dist;
    for (i = 0; i < fish.length; i++) {
      f = fish[i];
      dx = hook.x - f.x;
      dy = hook.y - f.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < f.r + 16) {
        score += f.pts;
        if (score > best) best = score;
        consecutiveMisses = 0;
        _missAlreadyPenalized = false;
        try { Audio.play('gem'); } catch(e) {}
        fish.splice(i, 1);
        fish.push(makeFish());
        hook.hookState = hookStates.RETRACTING;
        return;
      }
    }
    hook.hookState = hookStates.RETRACTING;
    _missAlreadyPenalized = true;
    consecutiveMisses++;
    if (consecutiveMisses >= 3) {
      consecutiveMisses = 0;
      lives--;
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) {
        lives = 0; state = 'DEAD';
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'snowballcatch_best'); } catch(e) {}
      }
    }
  }

  function drawBg() {
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, VW, WATER_TOP);
    var g = ctx.createLinearGradient(0, WATER_TOP, 0, VH);
    g.addColorStop(0, '#1a6b9e'); g.addColorStop(1, '#0a3d5e');
    ctx.fillStyle = g;
    ctx.fillRect(0, WATER_TOP, VW, VH - WATER_TOP);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    var wy;
    for (wy = WATER_TOP + 30; wy < VH; wy += 60) {
      ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(VW, wy); ctx.stroke();
    }
    ctx.strokeStyle = '#1a6b9e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, WATER_TOP); ctx.lineTo(VW, WATER_TOP); ctx.stroke();
    ctx.fillStyle = '#5a3010'; ctx.fillRect(0, HOOK_START_Y - 12, VW, 12);
    ctx.fillStyle = '#8B4513'; ctx.fillRect(VW / 2 - 10, HOOK_START_Y - 12, 20, -40);
  }

  function drawFish(f) {
    ctx.save();
    ctx.fillStyle = f.color;
    ctx.shadowBlur = 8; ctx.shadowColor = f.color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r * 1.6, f.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    var tailX = f.x - f.dir * f.r * 1.6;
    ctx.beginPath();
    ctx.moveTo(tailX, f.y);
    ctx.lineTo(tailX - f.dir * f.r * 0.7, f.y - f.r * 0.8);
    ctx.lineTo(tailX - f.dir * f.r * 0.7, f.y + f.r * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222';
    var eyeX = f.x + f.dir * f.r * 1.1;
    ctx.beginPath(); ctx.arc(eyeX, f.y - 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    var i, hearts, h;
    drawBg();
    if (state === 'MENU') {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 24; ctx.shadowColor = '#003a5c';
      ctx.fillText('FISHING DERBY', VW / 2, 180);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap to cast the line', VW / 2, 240);
      ctx.fillText('Tap again to set the hook!', VW / 2, 270);
      ctx.fillStyle = '#ffd700'; ctx.font = '18px system-ui';
      ctx.fillText('Gold fish = 3 pts, Green = 1 pt', VW / 2, 310);
      ctx.fillStyle = '#a8edea'; ctx.font = '20px system-ui';
      ctx.fillText('BEST: ' + best, VW / 2, 360);
      ctx.fillStyle = '#fff'; ctx.font = '22px system-ui';
      ctx.fillText('TAP TO PLAY', VW / 2, 430);
      ctx.textAlign = 'left';
      return;
    }
    for (i = 0; i < fish.length; i++) drawFish(fish[i]);
    if (hook.hookState !== hookStates.IDLE) {
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hook.x, HOOK_START_Y); ctx.lineTo(hook.x, hook.y); ctx.stroke();
      ctx.fillStyle = '#c0c0c0'; ctx.shadowBlur = 6; ctx.shadowColor = '#aaa';
      ctx.beginPath();
      ctx.moveTo(hook.x, hook.y);
      ctx.lineTo(hook.x - 6, hook.y + 14);
      ctx.lineTo(hook.x + 6, hook.y + 14);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#aaa'; ctx.font = '18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('TAP TO CAST', VW / 2, HOOK_START_Y - 20);
    }
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right';
    hearts = '';
    for (h = 0; h < lives; h++) hearts += '♥';
    for (h = lives; h < 3; h++) hearts += '♡';
    ctx.fillText(hearts, VW - 16, 44);
    ctx.fillStyle = '#ff9f43'; ctx.font = '16px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('Misses: ' + consecutiveMisses + '/3', VW - 16, 68);
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
    if (hook.hookState === hookStates.IDLE) {
      hook.x = x;
      hook.y = HOOK_START_Y;
      hook.hookState = hookStates.FALLING;
      hook.waitTimer = LINE_RETRACT_TIME;
      try { Audio.play('tap'); } catch(e) {}
    } else if (hook.hookState === hookStates.FALLING || hook.hookState === hookStates.WAITING) {
      trySetHook();
    }
  }

  function getBest() { return best; }

  c = null;
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
