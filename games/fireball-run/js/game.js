'use strict';

/* Castle Defense — FireballRun namespace
   Castle wall on left. Enemies march from right toward castle.
   Tap to fire arrow at that position (arc trajectory).
   Enemy within 20px of arrow = eliminated.
   Castle has 3 HP. Enemy reaches left edge = -1 HP.
   Waves escalate. Score = enemies killed. */
var FireballRun = (function () {
  var VW = 390, VH = 844;
  var canvas, ctx;
  var state = 'MENU';
  var score = 0, _best = 0;
  var t = 0;
  var lives = 3; // castle HP

  // Castle geometry
  var CASTLE_X = 0, CASTLE_W = 55;
  var CASTLE_TOP = 180, CASTLE_BOT = VH - 80;
  var ARROW_ORIGIN_X = CASTLE_W + 5;
  var ARROW_ORIGIN_Y = CASTLE_TOP + 30;

  // Ground
  var GROUND_Y = VH - 80;

  // Enemies array: {x, y, vx, type, hp, maxHp, w, h, hit, hitTimer}
  var enemies = [];
  // Arrows array: {x, y, vx, vy, age}
  var arrows = [];

  // Wave state
  var wave        = 1;
  var waveTimer   = 0;   // countdown between waves
  var enemiesThisWave = 0;
  var spawnCount  = 0;
  var spawnTimer  = 0;
  var REST_TIME   = 3.0;

  // Enemy types
  var TYPES = {
    soldier: { hp: 1, spd: 55, w: 22, h: 38, col: '#cc8833', pts: 1 },
    knight:  { hp: 2, spd: 40, w: 26, h: 44, col: '#8888cc', pts: 2 },
    giant:   { hp: 3, spd: 28, w: 38, h: 60, col: '#cc3344', pts: 4 }
  };

  // Arrow physics
  var ARROW_GRAVITY = 400;
  var ARROW_SPEED   = 620;

  // Hit flash
  var HIT_FLASH = 0.12;

  function snd(name) { try { Audio.play(name); } catch (e) {} }

  function pickType(wv) {
    var r = Math.random();
    if (wv >= 4 && r < 0.18) return 'giant';
    if (wv >= 2 && r < 0.45) return 'knight';
    return 'soldier';
  }

  function spawnEnemy() {
    var tn = pickType(wave);
    var td = TYPES[tn];
    enemies.push({
      x: VW + 10,
      y: GROUND_Y - td.h,
      vx: -(td.spd + wave * 4),
      type: tn,
      hp: td.hp, maxHp: td.hp,
      w: td.w, h: td.h,
      pts: td.pts,
      hit: false, hitTimer: 0,
      wobble: Math.random() * Math.PI * 2
    });
  }

  function resetGame() {
    score = 0; lives = 3;
    enemies = []; arrows = [];
    wave = 1;
    enemiesThisWave = 5;
    spawnCount = 0;
    spawnTimer = 0.6;
    waveTimer = 0;
    t = 0;
  }

  function startGame() {
    resetGame();
    state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function runEnded() {
    if (score > _best) _best = score;
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function fireArrow(tx, ty) {
    // Compute launch velocity for arc to reach (tx, ty)
    var dx = tx - ARROW_ORIGIN_X;
    var dy = ty - ARROW_ORIGIN_Y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    // Fix 1: tap too close to origin — play feedback sound and bail without firing
    if (dist < 1) { snd('tap'); return; }
    // Fix 2: tap to the left of (or on) the castle — clamp to a minimum rightward
    // direction so arrows always fly toward enemies and never waste a shot firing left.
    if (dx <= 0) {
      dx = 1;                                  // minimum rightward offset
      var dist2 = Math.sqrt(dx * dx + dy * dy);
      var vx2 = (dx / dist2) * ARROW_SPEED;
      var time2 = dx / vx2;
      var vy2 = Math.abs(time2) < 0.01 ? -ARROW_SPEED : (dy - 0.5 * ARROW_GRAVITY * time2 * time2) / time2;
      arrows.push({ x: ARROW_ORIGIN_X, y: ARROW_ORIGIN_Y, vx: vx2, vy: vy2, age: 0 });
      snd('tap');
      return;
    }
    // Use fixed speed, compute time to reach, derive vy from parabola
    var vx = (dx / dist) * ARROW_SPEED;
    var time = dx / vx;
    var vy;
    if (Math.abs(time) < 0.01) {
      vy = -ARROW_SPEED;
    } else {
      vy = (dy - 0.5 * ARROW_GRAVITY * time * time) / time;
    }
    arrows.push({ x: ARROW_ORIGIN_X, y: ARROW_ORIGIN_Y, vx: vx, vy: vy, age: 0 });
    snd('tap');
  }

  function checkHits() {
    var i, j, ax, ay, ex, ey, dx, dy, dist, en, td;
    for (i = arrows.length - 1; i >= 0; i--) {
      var ar = arrows[i];
      ax = ar.x; ay = ar.y;
      var hit = false;
      for (j = enemies.length - 1; j >= 0; j--) {
        en = enemies[j];
        // Circle vs rect center
        ex = en.x + en.w / 2; ey = en.y + en.h / 2;
        dx = ax - ex; dy = ay - ey;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20 + en.w / 2) {
          en.hp--;
          en.hit = true; en.hitTimer = HIT_FLASH;
          if (en.hp <= 0) {
            score += en.pts;
            enemies.splice(j, 1);
            snd('gem');
          } else {
            snd('tap');
          }
          hit = true;
          break;
        }
      }
      if (hit) { arrows.splice(i, 1); }
    }
  }

  // ---- Public API ----

  function init(c, best) {
    canvas = c; ctx = canvas.getContext('2d');
    _best = best || 0; state = 'MENU';
    score = 0; lives = 3; t = 0;
    enemies = []; arrows = [];
    wave = 1; spawnCount = 0; spawnTimer = 0; waveTimer = 0;
  }

  function update(dt) {
    t += dt;
    if (state !== 'PLAYING') return;

    var i, en;

    // Spawning logic
    if (waveTimer > 0) {
      waveTimer -= dt;
      if (waveTimer <= 0) {
        wave++;
        enemiesThisWave = 5 + (wave - 1) * 2;
        spawnCount = 0;
        spawnTimer = 0.5;
        waveTimer = 0;
      }
    } else {
      // spawning enemies
      if (spawnCount < enemiesThisWave) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnEnemy();
          spawnCount++;
          spawnTimer = 0.8 - wave * 0.04;
          if (spawnTimer < 0.25) spawnTimer = 0.25;
        }
      } else if (enemies.length === 0 && spawnCount >= enemiesThisWave) {
        // wave cleared
        waveTimer = REST_TIME;
      }
    }

    // Move enemies
    for (i = enemies.length - 1; i >= 0; i--) {
      en = enemies[i];
      en.x += en.vx * dt;
      if (en.hitTimer > 0) en.hitTimer -= dt;
      // Reached castle
      if (en.x + en.w < CASTLE_W + 5) {
        lives--;
        snd('crash');
        enemies.splice(i, 1);
        if (lives <= 0) {
          state = 'DEAD';
          snd('lose');
          runEnded();
          return;
        }
      }
    }

    // Move arrows
    for (i = arrows.length - 1; i >= 0; i--) {
      var ar = arrows[i];
      ar.vy += ARROW_GRAVITY * dt;
      ar.x += ar.vx * dt;
      ar.y += ar.vy * dt;
      ar.age += dt;
      // Remove if off screen or hits ground
      if (ar.x > VW + 20 || ar.y > GROUND_Y || ar.x < 0 || ar.age > 3.0) {
        arrows.splice(i, 1);
      }
    }

    checkHits();
  }

  function tap(vx, vy) {
    if (state === 'MENU') { startGame(); snd('tap'); return; }
    if (state === 'DEAD') {
      try { AdManager.showInterstitial(function () { startGame(); }); } catch (e) { startGame(); }
      try { AdManager.offerDoubleScore(score, 'fireballrun_best'); } catch(e) {}
      snd('tap'); return;
    }
    if (state !== 'PLAYING') return;
    fireArrow(vx, vy);
  }

  function getBest()  { return _best; }
  function getScore() { return score; }
  function getState() { return state; }

  // ---- Drawing ----

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1a0a0a'); g.addColorStop(1, '#2a1010');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // ground
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
    ctx.strokeStyle = '#5a3020'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(VW, GROUND_Y); ctx.stroke();
  }

  function drawCastle() {
    // Castle body
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(CASTLE_X, CASTLE_TOP, CASTLE_W, CASTLE_BOT - CASTLE_TOP);
    // Battlements
    ctx.fillStyle = '#5a5a6a';
    var i;
    for (i = 0; i < 3; i++) {
      ctx.fillRect(CASTLE_X + i * 20, CASTLE_TOP - 18, 14, 18);
    }
    // Castle door
    ctx.fillStyle = '#2a1a0a';
    roundRect(CASTLE_X + 12, CASTLE_BOT - 55, 28, 55, 14);
    ctx.fill();
    // HP hearts on castle
    for (i = 0; i < 3; i++) {
      ctx.font = '14px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i < lives ? '#ff4444' : 'rgba(255,255,255,0.2)';
      ctx.fillText(i < lives ? '♥' : '♡', CASTLE_X + 10 + i * 16, CASTLE_TOP - 36);
    }
    // Window
    ctx.fillStyle = '#ffd070';
    ctx.shadowColor = '#ffd070'; ctx.shadowBlur = 8;
    roundRect(CASTLE_X + 14, CASTLE_TOP + 40, 24, 28, 4);
    ctx.fill(); ctx.shadowBlur = 0;
  }

  function drawEnemy(en) {
    ctx.save();
    if (en.hitTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = TYPES[en.type].col;
    }
    var wobble = Math.sin(t * 8 + en.wobble) * 1.5;
    ctx.translate(en.x + en.w / 2, en.y + en.h);
    ctx.rotate(wobble * Math.PI / 180);
    ctx.translate(-(en.x + en.w / 2), -(en.y + en.h));

    // Body
    ctx.shadowColor = TYPES[en.type].col; ctx.shadowBlur = 8;
    ctx.fillRect(en.x, en.y, en.w, en.h);
    ctx.shadowBlur = 0;

    // Head
    ctx.beginPath();
    ctx.arc(en.x + en.w / 2, en.y - en.w * 0.3, en.w * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    if (en.hp < en.maxHp) {
      var bw = en.w, bx = en.x, by = en.y - en.h * 0.18;
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = '#f44'; ctx.fillRect(bx, by, bw * en.hp / en.maxHp, 5);
    }
    ctx.restore();
  }

  function drawArrow(ar) {
    var angle = Math.atan2(ar.vy, ar.vx);
    ctx.save();
    ctx.translate(ar.x, ar.y); ctx.rotate(angle);
    ctx.strokeStyle = '#d4a020'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd070'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.stroke();
    // Arrowhead
    ctx.fillStyle = '#d4a020';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = '#ff8833'; ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('FIREBALL RUN', VW / 2, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial';
    ctx.fillText(String(score), VW / 2, 40);
    ctx.font = 'bold 14px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.textAlign = 'right'; ctx.fillText('Best: ' + _best, VW - 14, 78);
    // Wave
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffcc55';
    ctx.fillText('Wave ' + wave, CASTLE_W + 10, 78);
    if (waveTimer > 0) {
      ctx.fillStyle = '#aaffaa'; ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center'; ctx.fillText('WAVE CLEAR!', VW / 2, 106);
    }
  }

  function drawMenu() {
    drawBg();
    var float = Math.sin(t * 1.4) * 6;
    ctx.save();
    ctx.shadowColor = '#ff8833'; ctx.shadowBlur = 26;
    ctx.fillStyle = '#ff8833'; ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CASTLE', VW / 2, 310 + float);
    ctx.fillStyle = '#ff4444';
    ctx.fillText('DEFENSE', VW / 2, 368 + float);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '19px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Tap to shoot arrows at enemies', VW / 2, 458);
    ctx.fillText('Protect the castle!', VW / 2, 486);
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.save(); ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial';
    ctx.fillText('TAP TO PLAY', VW / 2, 622);
    ctx.restore();
    if (_best > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.52)'; ctx.font = '17px Arial';
      ctx.fillText('BEST ' + _best, VW / 2, 676);
    }
  }

  function drawDead() {
    ctx.save(); ctx.fillStyle = 'rgba(10,0,0,0.74)'; ctx.fillRect(0, 0, VW, VH);
    var pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
    ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ff4444'; ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CASTLE FALLEN!', VW / 2, 296);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial';
    ctx.fillText('Score: ' + score, VW / 2, 368);
    ctx.font = '20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('Best: ' + _best, VW / 2, 412);
    ctx.globalAlpha = pulse; ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial';
    ctx.fillText('TAP TO RETRY', VW / 2, 528);
    ctx.restore();
  }

  function draw() {
    drawBg();
    if (state === 'MENU') { drawMenu(); return; }

    drawCastle();
    var i;
    for (i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
    for (i = 0; i < arrows.length; i++) drawArrow(arrows[i]);
    drawHUD();

    if (state === 'DEAD') drawDead();
  }

  return { init: init, update: update, draw: draw, tap: tap,
           getScore: getScore, getState: getState, getBest: getBest };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = FireballRun; }
