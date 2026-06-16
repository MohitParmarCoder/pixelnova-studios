'use strict';
var ElectricDash = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score;
    var playerX, playerY, playerVY;
    var lasers;
    var spawnTimer, spawnInterval;
    var scrollX;
    var onGround;
    var tick;
    var GROUND_Y = VH - 80;
    var PLAYER_R = 16;
    var JUMP_V = -560;
    var GRAVITY = 1400;
    var SCROLL_SPD = 200;
    var gridOffset;

    function startGame() {
        score = 0;
        tick = 0;
        playerX = 80;
        playerY = GROUND_Y - PLAYER_R;
        playerVY = 0;
        onGround = true;
        lasers = [];
        spawnTimer = 0;
        spawnInterval = 1.4;
        scrollX = 0;
        gridOffset = 0;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnLaser() {
        // laser comes from left or right
        var fromLeft = Math.random() < 0.5;
        var y = 100 + Math.random() * (VH - 240);
        // avoid ground area
        if (y > GROUND_Y - 40) y = GROUND_Y - 80;
        var spd = 140 + tick * 8;
        lasers.push({
            fromLeft: fromLeft,
            x: fromLeft ? -20 : VW + 20,
            y: y,
            h: 10,
            w: 120 + Math.random() * 80,
            spd: spd,
            dead: false
        });
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;
        score = Math.floor(tick * 10 * (1 + tick * 0.02));
        if (score > best) best = score;

        SCROLL_SPD = 200 + tick * 12;
        spawnInterval = Math.max(0.5, 1.4 - tick * 0.03);

        gridOffset = (gridOffset + SCROLL_SPD * dt) % 80;

        // player gravity
        if (!onGround) {
            playerVY += GRAVITY * dt;
        }
        playerY += playerVY * dt;

        if (playerY >= GROUND_Y - PLAYER_R) {
            playerY = GROUND_Y - PLAYER_R;
            playerVY = 0;
            onGround = true;
        }

        // spawn lasers
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnLaser();
        }

        // update lasers
        for (var i = lasers.length - 1; i >= 0; i--) {
            var l = lasers[i];
            if (l.fromLeft) {
                l.x += l.spd * dt;
                if (l.x > VW + l.w + 20) {
                    lasers.splice(i, 1);
                    continue;
                }
            } else {
                l.x -= l.spd * dt;
                if (l.x < -l.w - 20) {
                    lasers.splice(i, 1);
                    continue;
                }
            }

            // collision with player (player is circle r=PLAYER_R)
            var laserLeft = l.fromLeft ? l.x : l.x;
            var laserRight = laserLeft + l.w;
            var laserTop = l.y - l.h / 2;
            var laserBot = l.y + l.h / 2;
            var px = playerX;
            var py = playerY;

            // circle-rect collision
            var nearX = Math.max(laserLeft, Math.min(px, laserRight));
            var nearY = Math.max(laserTop, Math.min(py, laserBot));
            var ddx = px - nearX, ddy = py - nearY;
            if (ddx * ddx + ddy * ddy < PLAYER_R * PLAYER_R * 0.64) {
                state = 'DEAD';
                try { Audio.play('crash'); } catch (e) {}
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
            }
        }
    }

    function drawLaser(l) {
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(l.x, l.y - l.h / 2, l.w, l.h);
        // bright core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(l.x, l.y - l.h / 4, l.w, l.h / 2);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.shadowColor = '#ff88ff';
        ctx.shadowBlur = 18;
        // body
        ctx.fillStyle = '#cc66ff';
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        // visor
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00ccff';
        ctx.beginPath();
        ctx.arc(5, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        // neon grid background
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#050010');
        grad.addColorStop(0.7, '#0a0030');
        grad.addColorStop(1, '#080020');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // scrolling grid
        ctx.strokeStyle = 'rgba(0,180,255,0.15)';
        ctx.lineWidth = 1;
        var gw = 80;
        for (var gx = (-gridOffset % gw); gx < VW + gw; gx += gw) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, VH);
            ctx.stroke();
        }
        for (var gy = 0; gy < VH; gy += gw) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(VW, gy);
            ctx.stroke();
        }

        // ground
        ctx.fillStyle = '#1a004a';
        ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
        ctx.strokeStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(VW, GROUND_Y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (state === 'MENU') {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 22;
            ctx.font = 'bold 50px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ELECTRIC DASH', VW / 2, VH / 2 - 80);
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
            ctx.fillText('TAP to jump over laser beams!', VW / 2, VH / 2 + 110);
            return;
        }

        for (var j = 0; j < lasers.length; j++) drawLaser(lasers[j]);
        drawPlayer();

        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 24;
            ctx.fillText('ZAPPED!', VW / 2, VH / 2 - 80);
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
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
