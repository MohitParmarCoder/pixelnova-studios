'use strict';
var ZombieSmash = (function () {

  var canvas, ctx;
  var state = 'MENU';
  var score, best, lives;
  var zombies, spawnTimer, spawnInterval, diffTimer;
  var particles;
  var VW = 390, VH = 844;
  var CENTER_Y = VH / 2;
  var MAX_LIVES = 5;

  var ZOMBIE_R = 24;
  var CENTER_LINE = VW / 2;

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    zombies = [];
    particles = [];
  }

  function startGame() {
    score = 0;
    lives = MAX_LIVES;
    zombies = [];
    particles = [];
    spawnInterval = 2.0;
    spawnTimer = 0.5;
    diffTimer = 0;
    try { AdManager.gameplayStart(); } catch (e) {}
    state = 'PLAYING';
  }

  function spawnZombie() {
    var fromLeft = Math.random() < 0.5;
    var x = fromLeft ? -ZOMBIE_R : VW + ZOMBIE_R;
    var y = 120 + Math.random() * (VH - 300);
    var speed = 40 + Math.random() * 30 + Math.min(score * 1.5, 90);
    var dir = fromLeft ? 1 : -1;
    zombies.push({
      x: x,
      y: y,
      speed: speed,
      dir: dir,
      r: ZOMBIE_R,
      eyeAnim: Math.random() * Math.PI * 2,
      wobble: Math.random() * Math.PI * 2,
      smashed: false,
      smashTimer: 0
    });
  }

  function addParticles(x, y) {
    for (var i = 0; i < 8; i++) {
      var angle = (Math.PI * 2 / 8) * i;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (60 + Math.random() * 60),
        vy: Math.sin(angle) * (60 + Math.random() * 60),
        life: 0.5,
        maxLife: 0.5,
        r: 4 + Math.random() * 4
      });
    }
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;

    diffTimer += dt;
    spawnTimer -= dt;

    if (diffTimer > 10) {
      diffTimer = 0;
      if (spawnInterval > 0.5) {
        spawnInterval -= 0.15;
      }
    }

    if (spawnTimer <= 0) {
      spawnZombie();
      spawnTimer = spawnInterval * (0.7 + Math.random() * 0.6);
    }

    var toRemove = [];
    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      z.eyeAnim += dt * 3;
      z.wobble += dt * 2;

      if (z.smashed) {
        z.smashTimer += dt;
        if (z.smashTimer > 0.4) {
          toRemove.push(i);
        }
        continue;
      }

      z.x += z.dir * z.speed * dt;

      var reachedCenter = (z.dir === 1 && z.x >= CENTER_LINE) ||
                          (z.dir === -1 && z.x <= CENTER_LINE);

      if (reachedCenter) {
        lives--;
        try { Audio.play('crash'); } catch (e) {}
        toRemove.push(i);
        if (lives <= 0) {
          endGame();
          return;
        }
      }
    }

    for (var j = toRemove.length - 1; j >= 0; j--) {
      zombies.splice(toRemove[j], 1);
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }
  }

  function endGame() {
    if (score > best) best = score;
    state = 'DEAD';
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'zombiesmash_best'); } catch(e) {}
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
    if (state === 'PLAYING') {
      var hit = false;
      for (var i = zombies.length - 1; i >= 0; i--) {
        var z = zombies[i];
        if (z.smashed) continue;
        var dx = x - z.x;
        var dy = y - z.y;
        if (dx * dx + dy * dy < (z.r + 10) * (z.r + 10)) {
          z.smashed = true;
          z.smashTimer = 0;
          score++;
          hit = true;
          addParticles(z.x, z.y);
          try { Audio.play('gem'); } catch (e) {}
          break;
        }
      }
      if (!hit) {
        try { Audio.play('tap'); } catch (e) {}
      }
    }
  }

  function drawZombie(z) {
    var r = z.r;
    var wobbleX = Math.sin(z.wobble) * 2;

    if (z.smashed) {
      var p = 1 - z.smashTimer / 0.4;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(z.x + wobbleX, z.y);
      ctx.scale(1 + (1 - p) * 0.5, 1 + (1 - p) * 0.5);
    } else {
      ctx.save();
      ctx.translate(z.x + wobbleX, z.y);
    }

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2d6e2d';
    ctx.fill();
    ctx.strokeStyle = '#1a4a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Decay spots
    ctx.fillStyle = '#1a4a1a';
    ctx.beginPath();
    ctx.arc(-6, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // X eyes
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 2.5;
    var eyeR = 5;
    // Left eye
    var lx = -9, ly = -6;
    ctx.beginPath();
    ctx.moveTo(lx - eyeR / 2, ly - eyeR / 2);
    ctx.lineTo(lx + eyeR / 2, ly + eyeR / 2);
    ctx.moveTo(lx + eyeR / 2, ly - eyeR / 2);
    ctx.lineTo(lx - eyeR / 2, ly + eyeR / 2);
    ctx.stroke();
    // Right eye
    var rx2 = 9, ry2 = -6;
    ctx.beginPath();
    ctx.moveTo(rx2 - eyeR / 2, ry2 - eyeR / 2);
    ctx.lineTo(rx2 + eyeR / 2, ry2 + eyeR / 2);
    ctx.moveTo(rx2 + eyeR / 2, ry2 - eyeR / 2);
    ctx.lineTo(rx2 - eyeR / 2, ry2 + eyeR / 2);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#1a4a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 6, 8, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Teeth
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(-7, 6, 4, 4);
    ctx.fillRect(-1, 6, 4, 4);
    ctx.fillRect(5, 6, 4, 4);

    if (z.smashed) {
      // SMASH text
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMASH!', 0, -r - 8);
    }

    ctx.restore();
  }

  function draw() {
    // Dark graveyard background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, VW, VH);

    // Ground
    ctx.fillStyle = '#1a1a0d';
    ctx.fillRect(0, CENTER_Y - 20, VW, VH - CENTER_Y + 20);

    // Grass line
    ctx.fillStyle = '#1a3a0a';
    ctx.fillRect(0, CENTER_Y - 22, VW, 6);

    // Stars
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    var starSeeds = [23, 67, 134, 200, 280, 340, 55, 100, 170, 250, 310, 370];
    var starY = [30, 60, 20, 80, 40, 70, 100, 50, 90, 25, 110, 45];
    for (var s = 0; s < starSeeds.length; s++) {
      ctx.beginPath();
      ctx.arc(starSeeds[s], starY[s], 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gravestones
    ctx.fillStyle = '#333355';
    var gravX = [40, 100, 160, 230, 290, 350];
    var gravH = [50, 40, 60, 45, 55, 38];
    for (var g = 0; g < gravX.length; g++) {
      var gx = gravX[g];
      var gy = CENTER_Y - 22 - gravH[g];
      ctx.fillRect(gx - 14, gy, 28, gravH[g]);
      ctx.beginPath();
      ctx.arc(gx, gy, 14, Math.PI, 0);
      ctx.fill();
    }

    // Moon
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath();
    ctx.arc(330, 70, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(342, 65, 24, 0, Math.PI * 2);
    ctx.fill();

    // Center line (danger zone)
    ctx.strokeStyle = 'rgba(255,50,50,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(CENTER_LINE, 100);
    ctx.lineTo(CENTER_LINE, VH - 100);
    ctx.stroke();
    ctx.setLineDash([]);

    // Skull at center
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☠', CENTER_LINE, 90);

    // Particles
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      var alpha = pt.life / pt.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#88ff44';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Zombies
    for (var i = 0; i < zombies.length; i++) {
      drawZombie(zombies[i]);
    }

    if (state === 'MENU') {
      drawMenu();
    } else if (state === 'PLAYING') {
      drawHUD();
    } else if (state === 'DEAD') {
      drawHUD();
      drawDead();
    }
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#44ff44';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZOMBIE', VW / 2, 340);
    ctx.fillText('SMASH', VW / 2, 400);

    ctx.fillStyle = '#88ff88';
    ctx.font = '20px sans-serif';
    ctx.fillText('Tap zombies before they reach center!', VW / 2, 460);

    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO PLAY', VW / 2, 540);

    if (best > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Best: ' + best, VW / 2, 590);
    }
  }

  function drawHUD() {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 36);

    // Lives
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff4444';
    var hearts = '';
    for (var h = 0; h < MAX_LIVES; h++) {
      hearts += h < lives ? '♥ ' : '♡ ';
    }
    ctx.font = '22px sans-serif';
    ctx.fillText(hearts, VW - 16, 36);

    // Best
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Best: ' + best, VW / 2, 36);
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VW / 2, 340);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Score: ' + score, VW / 2, 400);

    ctx.fillStyle = '#ffff44';
    ctx.font = '24px sans-serif';
    ctx.fillText('Best: ' + best, VW / 2, 440);

    ctx.fillStyle = '#44ff44';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('TAP TO RETRY', VW / 2, 520);
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
}());
