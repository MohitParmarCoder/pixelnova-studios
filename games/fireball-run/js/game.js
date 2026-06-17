'use strict';
var FireballRun = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score;
    var playerX, playerY, playerVY;
    var fireballs;
    var spawnTimer, spawnInterval;
    var onGround;
    var tick;
    var scrollOffset;
    var GROUND_Y = VH - 100;
    var PLAYER_W = 28, PLAYER_H = 40;
    var PLAYER_FIXED_X = 80;
    var JUMP_V = -580;
    var GRAVITY = 1500;
    var clouds;

    function makeClouds() {
        clouds = [];
        for (var i = 0; i < 6; i++) {
            clouds.push({
                x: Math.random() * VW,
                y: 60 + Math.random() * 200,
                r: 30 + Math.random() * 30,
                spd: 20 + Math.random() * 20
            });
        }
    }

    function startGame() {
        score = 0;
        tick = 0;
        scrollOffset = 0;
        playerX = PLAYER_FIXED_X;
        playerY = GROUND_Y - PLAYER_H;
        playerVY = 0;
        onGround = true;
        fireballs = [];
        spawnTimer = 0;
        spawnInterval = 1.2;
        makeClouds();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnFireball() {
        var x = VW + 30 + Math.random() * 80;
        var fallY = -40 - Math.random() * 100;
        var spd = 180 + tick * 8 + Math.random() * 60;
        fireballs.push({
            x: x, y: fallY,
            vx: -(spd * 0.6),
            vy: 120 + Math.random() * 60,
            r: 18 + Math.random() * 10,
            rot: 0,
            landed: false,
            landY: GROUND_Y - 10,
            explodeTimer: 0,
            exploding: false
        });
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;
        score = Math.floor(tick * 12 * (1 + tick * 0.015));
        if (score > best) best = score;

        spawnInterval = Math.max(0.45, 1.2 - tick * 0.03);
        var scrollSpd = 180 + tick * 10;
        scrollOffset = (scrollOffset + scrollSpd * dt) % 120;

        // clouds
        for (var ci = 0; ci < clouds.length; ci++) {
            clouds[ci].x -= clouds[ci].spd * dt;
            if (clouds[ci].x < -clouds[ci].r * 2) {
                clouds[ci].x = VW + clouds[ci].r;
                clouds[ci].y = 60 + Math.random() * 180;
            }
        }

        // player
        if (!onGround) playerVY += GRAVITY * dt;
        playerY += playerVY * dt;
        if (playerY >= GROUND_Y - PLAYER_H) {
            playerY = GROUND_Y - PLAYER_H;
            playerVY = 0;
            onGround = true;
        }

        // spawn fireballs
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnFireball();
        }

        // update fireballs
        for (var i = fireballs.length - 1; i >= 0; i--) {
            var fb = fireballs[i];
            if (fb.exploding) {
                fb.explodeTimer += dt;
                if (fb.explodeTimer > 0.5) fireballs.splice(i, 1);
                continue;
            }
            fb.x += fb.vx * dt;
            fb.y += fb.vy * dt;
            fb.rot += dt * 3;

            if (fb.y >= fb.landY) {
                fb.y = fb.landY;
                fb.vy = 0;
                fb.vx = 0;
                fb.exploding = true;
            }

            // check if off screen
            if (fb.x < -60) {
                fireballs.splice(i, 1);
                continue;
            }

            // collision with player
            var px = PLAYER_FIXED_X, py = playerY;
            var fx = fb.x, fy = fb.y;
            var dx = px - fx, dy = (py + PLAYER_H / 2) - fy;
            if (Math.abs(dx) < fb.r + PLAYER_W / 2 && Math.abs(dy) < fb.r + PLAYER_H / 2) {
                state = 'DEAD';
                try { Audio.play('lose'); } catch (e) {}
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
            }
        }
    }

    function drawFireball(fb) {
        ctx.save();
        ctx.translate(fb.x, fb.y);
        if (fb.exploding) {
            var p = fb.explodeTimer / 0.5;
            ctx.globalAlpha = 1 - p;
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(0, 0, fb.r * (1 + p * 3), 0, Math.PI * 2);
            ctx.fillStyle = '#ff8800';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, fb.r * (0.5 + p), 0, Math.PI * 2);
            ctx.fillStyle = '#ffff00';
            ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            ctx.rotate(fb.rot);
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 20;
            // outer
            ctx.beginPath();
            ctx.arc(0, 0, fb.r, 0, Math.PI * 2);
            ctx.fillStyle = '#ff2200';
            ctx.fill();
            // mid
            ctx.beginPath();
            ctx.arc(0, 0, fb.r * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = '#ff8800';
            ctx.fill();
            // core
            ctx.beginPath();
            ctx.arc(0, 0, fb.r * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffff88';
            ctx.fill();
            // flame spikes
            ctx.fillStyle = '#ff6600';
            for (var s = 0; s < 5; s++) {
                var ang = (s / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ang) * fb.r * 0.8, Math.sin(ang) * fb.r * 0.8);
                ctx.lineTo(Math.cos(ang + 0.3) * fb.r * 1.4, Math.sin(ang + 0.3) * fb.r * 1.4);
                ctx.lineTo(Math.cos(ang + 0.6) * fb.r * 0.8, Math.sin(ang + 0.6) * fb.r * 0.8);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(PLAYER_FIXED_X, playerY);
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
        // legs animated
        var legSwing = onGround ? Math.sin(tick * 12) * 8 : 0;
        ctx.fillStyle = '#cc4400';
        ctx.fillRect(-14, PLAYER_H - 20, 10, 20 + legSwing);
        ctx.fillRect(4, PLAYER_H - 20, 10, 20 - legSwing);
        // body
        ctx.fillStyle = '#ff6622';
        ctx.fillRect(-12, 0, 24, PLAYER_H - 14);
        // head
        ctx.beginPath();
        ctx.arc(0, -6, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ffaa44';
        ctx.fill();
        // eye
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, -10, 7, 7);
        ctx.fillStyle = '#000000';
        ctx.fillRect(6, -9, 4, 5);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        // hellscape sky gradient
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#1a0000');
        grad.addColorStop(0.3, '#440800');
        grad.addColorStop(0.65, '#882200');
        grad.addColorStop(1, '#cc4400');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // smoke clouds
        for (var ci = 0; ci < clouds.length; ci++) {
            var c = clouds[ci];
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#cc6600';
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.arc(c.x + c.r * 0.7, c.y - c.r * 0.2, c.r * 0.7, 0, Math.PI * 2);
            ctx.arc(c.x - c.r * 0.6, c.y - c.r * 0.1, c.r * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // dark ground
        ctx.fillStyle = '#1a0a00';
        ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);

        // scrolling ground cracks
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (var gx = (-scrollOffset % 120); gx < VW + 120; gx += 120) {
            ctx.beginPath();
            ctx.moveTo(gx, GROUND_Y);
            ctx.lineTo(gx + 40, VH);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // ground edge glow
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(VW, GROUND_Y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (state === 'MENU') {
            ctx.fillStyle = '#ff4400';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 22;
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('FIREBALL RUN', VW / 2, VH / 2 - 80);
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
            ctx.fillText('TAP to jump over fireballs!', VW / 2, VH / 2 + 110);
            return;
        }

        for (var j = 0; j < fireballs.length; j++) drawFireball(fireballs[j]);
        drawPlayer();

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff4400';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 24;
            ctx.fillText('BURNED!', VW / 2, VH / 2 - 80);
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
            if (onGround) {
                playerVY = JUMP_V;
                onGround = false;
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
        makeClouds();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
