'use strict';
var MagmaHop = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score;
    var playerX, playerY, playerVX, playerVY;
    var playerOnGround;
    var platforms;
    var lavaY;
    var tick;
    var PLAYER_R = 14;
    var GRAVITY = 900;
    var lavaRipple;
    var nextPlatformTarget;
    var platformsLanded;
    var particles;

    function makePlatforms() {
        platforms = [];
        var x = VW / 2;
        var y = VH - 180;
        for (var i = 0; i < 7; i++) {
            var w = 100 - i * 6;
            if (w < 40) w = 40;
            platforms.push({ x: x, y: y, w: w, h: 16, landed: (i === 0) });
            x = 40 + Math.random() * (VW - 80);
            y = y - 80 - Math.random() * 60;
        }
    }

    function startGame() {
        score = 0;
        tick = 0;
        platformsLanded = 0;
        lavaY = VH + 60;
        lavaRipple = 0;
        particles = [];
        makePlatforms();
        // player starts on first platform
        playerX = platforms[0].x;
        playerY = platforms[0].y - PLAYER_R;
        playerVX = 0;
        playerVY = 0;
        playerOnGround = true;
        nextPlatformTarget = null;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function addParticles(x, y, color) {
        for (var i = 0; i < 8; i++) {
            var ang = Math.random() * Math.PI * 2;
            var spd = 80 + Math.random() * 140;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 60,
                r: 3 + Math.random() * 4,
                life: 1,
                color: color
            });
        }
    }

    function addPlatform() {
        var last = platforms[platforms.length - 1];
        var w = Math.max(36, 100 - platformsLanded * 3);
        var newX = 40 + Math.random() * (VW - 80);
        var newY = last.y - 80 - Math.random() * 70;
        platforms.push({ x: newX, y: newY, w: w, h: 16, landed: false });
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;
        lavaRipple += dt * 2;

        // lava rises
        var riseSpd = 18 + platformsLanded * 2.5;
        lavaY -= riseSpd * dt;

        // particles
        for (var pi = particles.length - 1; pi >= 0; pi--) {
            var p = particles[pi];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 400 * dt;
            p.life -= dt * 2;
            if (p.life <= 0) particles.splice(pi, 1);
        }

        // player gravity
        playerVY += GRAVITY * dt;
        playerX += playerVX * dt;
        playerY += playerVY * dt;

        // clamp x
        if (playerX < PLAYER_R) playerX = PLAYER_R;
        if (playerX > VW - PLAYER_R) playerX = VW - PLAYER_R;

        playerOnGround = false;

        // platform collisions
        for (var i = 0; i < platforms.length; i++) {
            var pl = platforms[i];
            var left = pl.x - pl.w / 2;
            var right = pl.x + pl.w / 2;
            var top = pl.y;
            if (playerVY >= 0 &&
                playerX + PLAYER_R * 0.7 > left && playerX - PLAYER_R * 0.7 < right &&
                playerY + PLAYER_R > top && playerY + PLAYER_R < top + 30 + playerVY * dt) {
                playerY = top - PLAYER_R;
                playerVY = 0;
                playerVX = 0;
                playerOnGround = true;
                if (!pl.landed) {
                    pl.landed = true;
                    platformsLanded++;
                    score = platformsLanded;
                    if (score > best) best = score;
                    addParticles(playerX, playerY, '#ff8800');
                    try { Audio.play('gem'); } catch (e) {}
                    addPlatform();
                }
                break;
            }
        }

        // camera scroll: keep player in view
        // shift everything down if player gets too high
        if (playerY < VH * 0.35) {
            var shift = VH * 0.35 - playerY;
            playerY += shift;
            for (var j = 0; j < platforms.length; j++) {
                platforms[j].y += shift;
            }
            lavaY += shift;
            for (var pk = 0; pk < particles.length; pk++) {
                particles[pk].y += shift;
            }
        }

        // remove platforms that fell below lava
        for (var k = platforms.length - 1; k >= 0; k--) {
            if (platforms[k].y > lavaY + 80) platforms.splice(k, 1);
        }

        // death: fall into lava or fall off bottom
        if (playerY + PLAYER_R > lavaY || playerY > VH + 100) {
            state = 'DEAD';
            try { Audio.play('lose'); } catch (e) {}
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        }
    }

    function drawLava() {
        ctx.save();
        var grad = ctx.createLinearGradient(0, lavaY, 0, VH + 100);
        grad.addColorStop(0, '#ff6600');
        grad.addColorStop(0.2, '#cc2200');
        grad.addColorStop(1, '#660000');
        ctx.fillStyle = grad;
        // wavy top
        ctx.beginPath();
        ctx.moveTo(0, lavaY);
        for (var x = 0; x <= VW; x += 20) {
            var wave = Math.sin(x * 0.06 + lavaRipple) * 8;
            ctx.lineTo(x, lavaY + wave);
        }
        ctx.lineTo(VW, VH + 100);
        ctx.lineTo(0, VH + 100);
        ctx.closePath();
        ctx.fill();
        // bright top
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (var xx = 0; xx <= VW; xx += 20) {
            var ww = Math.sin(xx * 0.06 + lavaRipple) * 8;
            if (xx === 0) ctx.moveTo(xx, lavaY + ww);
            else ctx.lineTo(xx, lavaY + ww);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlatform(pl) {
        ctx.save();
        ctx.shadowColor = pl.landed ? '#888888' : '#ff8800';
        ctx.shadowBlur = pl.landed ? 4 : 10;
        var grad = ctx.createLinearGradient(pl.x - pl.w / 2, pl.y, pl.x - pl.w / 2, pl.y + pl.h);
        grad.addColorStop(0, pl.landed ? '#555566' : '#884400');
        grad.addColorStop(1, pl.landed ? '#333344' : '#552200');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(pl.x - pl.w / 2, pl.y, pl.w, pl.h, 5);
        ctx.fill();
        ctx.strokeStyle = pl.landed ? '#7777aa' : '#ffaa00';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd44';
        ctx.fill();
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 3;
        ctx.stroke();
        // face
        ctx.fillStyle = '#cc6600';
        ctx.beginPath();
        ctx.arc(-4, -3, 3, 0, Math.PI * 2);
        ctx.arc(4, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#0a0000');
        grad.addColorStop(0.5, '#1a0800');
        grad.addColorStop(1, '#330800');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 22;
            ctx.font = 'bold 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MAGMA HOP', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 10);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 60);
            }
            ctx.fillStyle = '#ffaa88';
            ctx.font = '18px sans-serif';
            ctx.fillText('TAP to jump to platforms!', VW / 2, VH / 2 + 110);
            return;
        }

        // particles
        for (var pi = 0; pi < particles.length; pi++) {
            var p = particles[pi];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (var i = 0; i < platforms.length; i++) drawPlatform(platforms[i]);
        drawLava();
        drawPlayer();

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff6600';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 24;
            ctx.fillText('MELTED!', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 14);
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 36);
            ctx.fillStyle = '#ffaaaa';
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
            if (playerOnGround) {
                // jump toward tap point with velocity
                var dx = x - playerX;
                var dy = y - playerY;
                var len = Math.sqrt(dx * dx + dy * dy);
                if (len < 1) len = 1;
                var jumpSpd = 520;
                playerVX = (dx / len) * jumpSpd * 0.7;
                playerVY = -420 - Math.abs(dy / len) * 200;
                playerOnGround = false;
                try { Audio.play('tap'); } catch (e) {}
            }
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        particles = [];
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
