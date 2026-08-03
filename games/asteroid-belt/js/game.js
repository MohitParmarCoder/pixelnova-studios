'use strict';
var AsteroidBelt = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var playerX, playerY, playerTargetX, playerTargetY;
    var asteroids, crystals;
    var spawnTimer, crystalTimer;
    var stars;
    var flashTimer;
    var tick;

    function initStars() {
        stars = [];
        for (var i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * VW,
                y: Math.random() * VH,
                r: Math.random() * 1.8 + 0.2,
                a: Math.random() * 0.8 + 0.2
            });
        }
    }

    function startGame() {
        score = 0;
        lives = 3;
        tick = 0;
        playerX = VW / 2;
        playerY = VH / 2;
        playerTargetX = VW / 2;
        playerTargetY = VH / 2;
        asteroids = [];
        crystals = [];
        spawnTimer = 0;
        crystalTimer = 0;
        flashTimer = 0;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function randomEdgePos() {
        var edge = Math.floor(Math.random() * 4);
        if (edge === 0) return { x: Math.random() * VW, y: -30 };
        if (edge === 1) return { x: VW + 30, y: Math.random() * VH };
        if (edge === 2) return { x: Math.random() * VW, y: VH + 30 };
        return { x: -30, y: Math.random() * VH };
    }

    function spawnAsteroid() {
        var pos = randomEdgePos();
        var cx = VW / 2 + (Math.random() - 0.5) * 160;
        var cy = VH / 2 + (Math.random() - 0.5) * 160;
        var dx = cx - pos.x;
        var dy = cy - pos.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        var spd = 80 + Math.random() * 80 + tick * 0.04;
        var pts = [];
        var sides = 6 + Math.floor(Math.random() * 4);
        var r = 18 + Math.random() * 22;
        for (var i = 0; i < sides; i++) {
            var ang = (i / sides) * Math.PI * 2;
            var rr = r * (0.6 + Math.random() * 0.5);
            pts.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr });
        }
        asteroids.push({
            x: pos.x, y: pos.y,
            vx: (dx / len) * spd,
            vy: (dy / len) * spd,
            r: r, pts: pts, rot: Math.random() * Math.PI * 2,
            rotSpd: (Math.random() - 0.5) * 1.4
        });
    }

    function spawnCrystal() {
        crystals.push({
            x: 40 + Math.random() * (VW - 80),
            y: 40 + Math.random() * (VH - 80),
            r: 12,
            pulse: 0
        });
    }

    function dist2(ax, ay, bx, by) {
        var dx = ax - bx, dy = ay - by;
        return dx * dx + dy * dy;
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state !== 'PLAYING') return;
        tick += dt;

        // move player
        var dx = playerTargetX - playerX;
        var dy = playerTargetY - playerY;
        playerX += dx * Math.min(1, dt * 7);
        playerY += dy * Math.min(1, dt * 7);

        // spawn asteroids
        spawnTimer += dt;
        var si = Math.max(0.5, 1.6 - tick * 0.025);
        if (spawnTimer >= si) {
            spawnTimer = 0;
            spawnAsteroid();
        }

        // spawn crystals
        crystalTimer += dt;
        if (crystalTimer >= 2.2 && crystals.length < 5) {
            crystalTimer = 0;
            spawnCrystal();
        }

        // update crystals
        for (var c = crystals.length - 1; c >= 0; c--) {
            crystals[c].pulse += dt * 3;
            if (dist2(playerX, playerY, crystals[c].x, crystals[c].y) < (14 * 14)) {
                crystals.splice(c, 1);
                score++;
                if (score > best) { best = score; AdManager.happyTime(1.0); }
                try { Audio.play('gem'); } catch (e) {}
            }
        }

        // update asteroids
        for (var i = asteroids.length - 1; i >= 0; i--) {
            var a = asteroids[i];
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.rot += a.rotSpd * dt;
            if (a.x < -80 || a.x > VW + 80 || a.y < -80 || a.y > VH + 80) {
                asteroids.splice(i, 1);
                continue;
            }
            if (dist2(playerX, playerY, a.x, a.y) < ((a.r * 0.75 + 12) * (a.r * 0.75 + 12))) {
                asteroids.splice(i, 1);
                lives--;
                flashTimer = 0.3;
                try { Audio.play('crash'); } catch (e) {}
                if (lives <= 0) {
                    state = 'DEAD';
                    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                    AdManager.showInterstitial(() => {});
                    try { AdManager.offerDoubleScore(score, 'asteroidbelt_best'); } catch(e) {}
                }
            }
        }

        if (flashTimer > 0) flashTimer -= dt;
    }

    function drawCrystal(c) {
        ctx.save();
        ctx.translate(c.x, c.y);
        var s = 1 + Math.sin(c.pulse) * 0.12;
        ctx.scale(s, s);
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fillStyle = '#aaffee';
        ctx.fill();
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawAsteroid(a) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.beginPath();
        ctx.moveTo(a.pts[0].x, a.pts[0].y);
        for (var i = 1; i < a.pts.length; i++) {
            ctx.lineTo(a.pts[i].x, a.pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = '#665544';
        ctx.fill();
        ctx.strokeStyle = '#998877';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.shadowColor = '#44aaff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(-12, 14);
        ctx.lineTo(0, 8);
        ctx.lineTo(12, 14);
        ctx.closePath();
        ctx.fillStyle = '#88ccff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#000008');
        grad.addColorStop(0.5, '#020218');
        grad.addColorStop(1, '#040420');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        for (var i = 0; i < stars.length; i++) {
            ctx.globalAlpha = stars[i].a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(stars[i].x, stars[i].y, stars[i].r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (state === 'MENU') {
            ctx.fillStyle = '#aaddff';
            ctx.shadowColor = '#44aaff';
            ctx.shadowBlur = 24;
            ctx.font = 'bold 46px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ASTEROID BELT', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 10);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 60);
            }
            ctx.fillStyle = '#aaaaff';
            ctx.font = '18px sans-serif';
            ctx.fillText('Collect crystals, dodge asteroids!', VW / 2, VH / 2 + 110);
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = flashTimer / 0.3 * 0.38;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        for (var j = 0; j < crystals.length; j++) drawCrystal(crystals[j]);
        for (var k = 0; k < asteroids.length; k++) drawAsteroid(asteroids[k]);
        drawPlayer();

        // lives
        for (var l = 0; l < 3; l++) {
            ctx.globalAlpha = (l < lives) ? 1 : 0.2;
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            var hx = 24 + l * 32, hy = 30;
            ctx.moveTo(hx, hy + 8);
            ctx.bezierCurveTo(hx - 12, hy - 4, hx - 14, hy - 16, hx, hy - 10);
            ctx.bezierCurveTo(hx + 14, hy - 16, hx + 12, hy - 4, hx, hy + 8);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff6644';
            ctx.font = 'bold 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 24;
            ctx.fillText('DESTROYED', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 14);
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 36);
            ctx.fillStyle = '#aaffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
        }
    }

    function tap(x, y) {
        if (state === 'MENU') {
            startGame();
        } else if (state === 'DEAD') {
            startGame();
        } else if (state === 'PLAYING') {
            playerTargetX = x;
            playerTargetY = y;
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        initStars();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
