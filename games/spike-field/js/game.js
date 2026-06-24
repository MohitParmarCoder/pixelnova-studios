'use strict';
var SpikeField = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score = 0;
    var gemBonus = 0;
    var lives = 3;

    // Ball
    var ballX, ballY, ballVX, ballVY;
    var BALL_R = 16;
    var GRAVITY = 500;
    var MAX_VX = 400;

    // Camera
    var worldY; // camera world position (decreases as ball rises)
    var maxWorldY; // highest (smallest) worldY reached
    var startWorldY; // camera position at start, used as score baseline

    // Platforms
    var platforms; // [{x, y, w, h, hasSpike, hasGem, gemCollected}]
    var PLAT_H = 12;

    // Gems
    var gems; // [{x, y, r, collected}]

    // Spikes
    // spikes are on platforms with hasSpike=true, rendered below the platform

    // Particles
    var particles;

    // Safe platform (last platform ball landed on)
    var lastSafeX, lastSafeY;

    // Trail
    var trail;

    // Generation
    var genY; // world y of next platform batch

    // Timers
    var deathFlash;
    var gemFlash;

    // Menu demo
    var demoY, demoVY;

    function screenY(wy) {
        // Convert world y to screen y. Camera keeps ball near VH/2.
        return wy - worldY + VH / 2;
    }

    function worldYFromScreen(sy) {
        return sy + worldY - VH / 2;
    }

    function spawnParticles(x, y, color, n) {
        for (var i = 0; i < (n || 8); i++) {
            var a = Math.random() * Math.PI * 2;
            var s = 60 + Math.random() * 120;
            particles.push({x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, r: 3 + Math.random() * 4, life: 1, color: color});
        }
    }

    function generatePlatformsAround(topWorldY) {
        // Generate platforms from genY up to topWorldY - 200
        while (genY > topWorldY - 400) {
            var numPlats = 1 + (Math.random() < 0.4 ? 1 : 0);
            for (var n = 0; n < numPlats; n++) {
                var w = 80 + Math.floor(Math.random() * 70);
                var px = Math.floor(Math.random() * (VW - w - 20)) + 10;
                var spikeChance = Math.min(0.55, 0.3 + score * 0.0015);
                var hasSpike = Math.random() < spikeChance;
                var hasGem = (!hasSpike) && Math.random() < 0.25;
                platforms.push({
                    x: px, y: genY, w: w, h: PLAT_H,
                    hasSpike: hasSpike,
                    hasGem: hasGem,
                    gemCollected: false
                });
                if (hasGem) {
                    gems.push({wx: px + w / 2, wy: genY - 24, r: 8, collected: false, platRef: platforms[platforms.length - 1]});
                }
            }
            genY -= 100 + Math.floor(Math.random() * 60);
        }
    }

    function startGame() {
        score = 0;
        gemBonus = 0;
        lives = 3;
        particles = [];
        trail = [];
        deathFlash = 0;
        gemFlash = 0;
        platforms = [];
        gems = [];

        ballX = VW / 2;
        ballY = VH / 2 + 180 - BALL_R;
        ballVX = 150;
        ballVY = 0;

        // Center the camera on the ball so it is visible at start.
        worldY = ballY;
        maxWorldY = worldY;
        startWorldY = worldY;

        // Starting platform (directly under the ball)
        platforms.push({x: VW / 2 - 70, y: VH / 2 + 180, w: 140, h: PLAT_H, hasSpike: false, hasGem: false, gemCollected: false});
        lastSafeX = VW / 2;
        lastSafeY = VH / 2 + 180 - BALL_R;
        genY = VH / 2 + 80;
        generatePlatformsAround(worldY - VH);

        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function diePlayer() {
        lives--;
        try { Audio.play('crash'); } catch (e) {}
        spawnParticles(ballX, screenY(ballY), '#ff4400', 12);
        if (lives <= 0) {
            try { Audio.play('lose'); } catch (e) {}
            if (score > best) { best = score; AdManager.happyTime(1.0); }
            deathFlash = 0.6;
        } else {
            // Reset ball to last safe platform
            ballX = lastSafeX;
            ballY = lastSafeY;
            ballVX = 80;
            ballVY = 0;
        }
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state === 'MENU') {
            demoVY += GRAVITY * dt;
            demoY += demoVY * dt;
            if (demoY > VH * 0.65) { demoY = VH * 0.65; demoVY = -350; }
            return;
        }
        if (state !== 'PLAYING') return;

        if (deathFlash > 0) {
            deathFlash -= dt;
            if (deathFlash <= 0 && lives <= 0) {
                state = 'DEAD';
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                AdManager.showInterstitial(() => {});
                try { AdManager.offerDoubleScore(score, 'spikefield_best'); } catch(e) {}
            }
            return;
        }
        if (gemFlash > 0) gemFlash -= dt;

        // Physics
        ballVY += GRAVITY * dt;
        ballX += ballVX * dt;
        ballY += ballVY * dt;

        // Wall bounce
        if (ballX - BALL_R < 0) { ballX = BALL_R; ballVX = Math.abs(ballVX); }
        if (ballX + BALL_R > VW) { ballX = VW - BALL_R; ballVX = -Math.abs(ballVX); }

        // Ceiling
        var ceilWorldY = worldY - VH / 2;
        if (ballY - BALL_R < ceilWorldY) {
            ballY = ceilWorldY + BALL_R;
            ballVY = Math.abs(ballVY) * 0.5;
        }

        // Platform collisions (only from above)
        var i, pl, scy;
        for (i = 0; i < platforms.length; i++) {
            pl = platforms[i];
            if (ballVY > 0 &&
                ballX + BALL_R * 0.7 > pl.x && ballX - BALL_R * 0.7 < pl.x + pl.w &&
                ballY + BALL_R > pl.y && ballY + BALL_R < pl.y + PLAT_H + 30) {
                ballY = pl.y - BALL_R;
                ballVY = -Math.abs(ballVY) * 0.85;
                if (Math.abs(ballVY) < 60) ballVY = -200; // minimum bounce
                lastSafeX = ballX;
                lastSafeY = ballY;
                // Check spike (spike is BELOW the platform — but wait, spec says spike below platform)
                // Actually spikes are below platform pointing up from the platform bottom.
                // Ball hits from above so it won't hit bottom spikes on normal bounce.
                // Standalone spikes check separately below.
                break;
            }
        }

        // Spike collision: for platforms with spikes, spikes point DOWN from platform bottom
        // Ball approaching from below hits spikes
        for (i = 0; i < platforms.length; i++) {
            pl = platforms[i];
            if (!pl.hasSpike) continue;
            // Spike extends 20px below platform
            var spikeTop = pl.y + PLAT_H;
            var spikeBot = pl.y + PLAT_H + 20;
            if (ballVY < 0 && // ball moving up
                ballX + BALL_R * 0.7 > pl.x + 5 && ballX - BALL_R * 0.7 < pl.x + pl.w - 5 &&
                ballY - BALL_R < spikeBot && ballY + BALL_R > spikeTop) {
                diePlayer();
                return;
            }
        }

        // Gem collection
        var g;
        for (i = 0; i < gems.length; i++) {
            g = gems[i];
            if (g.collected) continue;
            var dx = ballX - g.wx;
            var dy = ballY - g.wy;
            if (dx * dx + dy * dy < (BALL_R + g.r) * (BALL_R + g.r)) {
                g.collected = true;
                gemBonus += 10;
                if (score > best) { best = score; AdManager.happyTime(1.0); }
                gemFlash = 0.3;
                try { Audio.play('gem'); } catch (e) {}
                spawnParticles(g.wx, screenY(g.wy), '#ffdd00', 6);
            }
        }

        // Camera: follow ball upward
        var targetWorldY = ballY;
        if (targetWorldY < worldY) {
            worldY = worldY + (targetWorldY - worldY) * Math.min(1, dt * 4);
        }
        if (worldY < maxWorldY) maxWorldY = worldY;

        // Score based on height climbed since start
        var heightScore = Math.floor((startWorldY - worldY) / 10);
        score = Math.max(score, heightScore + gemBonus);
        if (score > best) { best = score; AdManager.happyTime(1.0); }

        // Generate more platforms
        generatePlatformsAround(worldY - VH);

        // Remove platforms far below
        for (i = platforms.length - 1; i >= 0; i--) {
            if (platforms[i].y > worldY + VH) platforms.splice(i, 1);
        }
        for (i = gems.length - 1; i >= 0; i--) {
            if (gems[i].wy > worldY + VH) gems.splice(i, 1);
        }

        // Ball falls below screen
        if (ballY > worldY + VH / 2 + VH * 0.6) {
            diePlayer();
            return;
        }

        // Trail
        trail.unshift({x: ballX, sy: screenY(ballY)});
        if (trail.length > 8) trail.length = 8;

        // Particles
        for (i = particles.length - 1; i >= 0; i--) {
            var pp = particles[i];
            pp.x += pp.vx * dt;
            pp.y += pp.vy * dt;
            pp.vy += 300 * dt;
            pp.life -= dt * 2;
            if (pp.life <= 0) particles.splice(i, 1);
        }
    }

    function drawPlatform(pl) {
        var sy = screenY(pl.y);
        if (sy < -40 || sy > VH + 40) return;
        ctx.save();
        ctx.fillStyle = '#2a3a4a';
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.fillRect(pl.x, sy, pl.w, pl.h);
        ctx.strokeRect(pl.x, sy, pl.w, pl.h);

        if (pl.hasSpike) {
            // Draw spikes pointing down below platform
            ctx.fillStyle = '#ff2200';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 6;
            var nSpikes = Math.floor(pl.w / 16);
            var sw = pl.w / nSpikes;
            for (var s = 0; s < nSpikes; s++) {
                var sx2 = pl.x + s * sw;
                ctx.beginPath();
                ctx.moveTo(sx2, sy + pl.h);
                ctx.lineTo(sx2 + sw / 2, sy + pl.h + 18);
                ctx.lineTo(sx2 + sw, sy + pl.h);
                ctx.closePath();
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    function drawGem(g) {
        if (g.collected) return;
        var sy = screenY(g.wy);
        if (sy < -20 || sy > VH + 20) return;
        ctx.save();
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        var pts = 5, r1 = g.r, r2 = g.r * 0.45;
        ctx.beginPath();
        for (var i = 0; i < pts * 2; i++) {
            var r = (i % 2 === 0) ? r1 : r2;
            var a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) ctx.moveTo(g.wx + r * Math.cos(a), sy + r * Math.sin(a));
            else ctx.lineTo(g.wx + r * Math.cos(a), sy + r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawBall() {
        var bsy = screenY(ballY);
        ctx.save();
        // Trail
        for (var i = trail.length - 1; i >= 1; i--) {
            var alpha = (1 - i / trail.length) * 0.3;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#aaddff';
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].sy, BALL_R * (1 - i / trail.length * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Ball
        ctx.shadowColor = '#aaddff';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ballX, bsy, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawHUD() {
        ctx.save();
        ctx.textBaseline = 'top';
        // Lives top-left
        var heartsStr = '';
        for (var i = 0; i < 3; i++) heartsStr += (i < lives) ? '♥' : '♡';
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(heartsStr, 10, 10);
        // Score top-right
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#aaffff';
        ctx.shadowBlur = 6;
        ctx.font = 'bold 24px monospace';
        ctx.fillText(score, VW - 10, 10);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.save();
            // Demo ball
            ctx.shadowColor = '#aaddff';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(VW / 2, demoY, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#66aaff';
            ctx.shadowColor = '#4488ff';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 52px monospace';
            ctx.fillText('SPIKE', VW / 2, VH / 2 - 80);
            ctx.fillText('FIELD', VW / 2, VH / 2 - 14);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px monospace';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 110);
            }
            ctx.fillStyle = '#445566';
            ctx.font = '16px monospace';
            ctx.fillText('Tap left/right to steer. Collect gems!', VW / 2, VH / 2 + 158);
            ctx.restore();
            return;
        }

        // Draw platforms
        var i;
        for (i = 0; i < platforms.length; i++) drawPlatform(platforms[i]);
        // Draw gems
        for (i = 0; i < gems.length; i++) drawGem(gems[i]);
        // Draw particles
        ctx.save();
        for (i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        // Draw ball
        drawBall();
        drawHUD();

        if (gemFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (gemFlash / 0.3) * 0.2;
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }
        if (deathFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (deathFlash / 0.6) * 0.4;
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }

        if (state === 'DEAD') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#66aaff';
            ctx.shadowColor = '#4488ff';
            ctx.shadowBlur = 26;
            ctx.font = 'bold 52px monospace';
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 90);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px monospace';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 20);
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 10;
            ctx.font = 'bold 28px monospace';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 34);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaddff';
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
            ctx.restore();
        }
    }

    function tap(x, y) {
        try { Audio.play('tap'); } catch (e) {}
        if (state === 'MENU') { startGame(); return; }
        if (state === 'DEAD') { startGame(); return; }
        if (state !== 'PLAYING') return;
        if (deathFlash > 0) return;
        if (x < VW / 2) {
            ballVX -= 100;
        } else {
            ballVX += 100;
        }
        if (ballVX > MAX_VX) ballVX = MAX_VX;
        if (ballVX < -MAX_VX) ballVX = -MAX_VX;
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        score = 0;
        lives = 3;
        particles = [];
        trail = [];
        platforms = [];
        gems = [];
        demoY = VH * 0.35;
        demoVY = -350;
        worldY = 0;
        maxWorldY = 0;
        genY = 0;
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
