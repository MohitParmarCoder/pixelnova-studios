'use strict';
var MissileEvade = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var playerX, playerY;
    var targetX, targetY;
    var holding;
    var missiles;
    var spawnTimer, spawnInterval;
    var tick;
    var flashTimer;
    var clouds;
    var cloudOffset;

    function makeClouds() {
        clouds = [];
        for (var i = 0; i < 8; i++) {
            clouds.push({
                x: Math.random() * VW,
                y: 40 + Math.random() * (VH * 0.6),
                w: 60 + Math.random() * 80,
                h: 20 + Math.random() * 24,
                spd: 15 + Math.random() * 20,
                a: 0.1 + Math.random() * 0.18
            });
        }
    }

    function startGame() {
        score = 0;
        lives = 3;
        tick = 0;
        playerX = VW / 2;
        playerY = VH - 120;
        targetX = VW / 2;
        targetY = VH - 120;
        holding = false;
        missiles = [];
        spawnTimer = 0;
        spawnInterval = 1.6;
        flashTimer = 0;
        cloudOffset = 0;
        makeClouds();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnMissile() {
        var x = 30 + Math.random() * (VW - 60);
        var spd = 110 + tick * 8;
        var turnRate = 1.2 + tick * 0.04;
        missiles.push({
            x: x, y: -20,
            angle: Math.PI / 2,  // pointing down
            spd: spd,
            turnRate: turnRate,
            trail: []
        });
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;
        score = Math.floor(tick * 10);
        if (score > best) best = score;

        spawnInterval = Math.max(0.5, 1.6 - tick * 0.04);

        // clouds
        cloudOffset += 20 * dt;
        for (var ci = 0; ci < clouds.length; ci++) {
            clouds[ci].x -= clouds[ci].spd * dt;
            if (clouds[ci].x + clouds[ci].w < 0) {
                clouds[ci].x = VW + 20;
                clouds[ci].y = 40 + Math.random() * (VH * 0.6);
            }
        }

        // player follows hold position
        if (holding) {
            playerX += (targetX - playerX) * Math.min(1, dt * 10);
            playerY += (targetY - playerY) * Math.min(1, dt * 10);
        }
        // clamp
        playerX = Math.max(20, Math.min(VW - 20, playerX));
        playerY = Math.max(20, Math.min(VH - 20, playerY));

        // spawn missiles
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnMissile();
        }

        // update missiles
        for (var i = missiles.length - 1; i >= 0; i--) {
            var m = missiles[i];
            // save trail
            m.trail.push({ x: m.x, y: m.y });
            if (m.trail.length > 18) m.trail.shift();

            // turn toward player
            var dx = playerX - m.x;
            var dy = playerY - m.y;
            var targetAngle = Math.atan2(dy, dx);
            var angleDiff = targetAngle - m.angle;
            // normalize angle diff to [-PI, PI]
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            var turnAmt = m.turnRate * dt;
            if (Math.abs(angleDiff) < turnAmt) {
                m.angle = targetAngle;
            } else {
                m.angle += (angleDiff > 0 ? 1 : -1) * turnAmt;
            }

            m.x += Math.cos(m.angle) * m.spd * dt;
            m.y += Math.sin(m.angle) * m.spd * dt;

            // off screen
            if (m.x < -40 || m.x > VW + 40 || m.y > VH + 40) {
                missiles.splice(i, 1);
                continue;
            }

            // collision with player
            var dist2 = (m.x - playerX) * (m.x - playerX) + (m.y - playerY) * (m.y - playerY);
            if (dist2 < (22 * 22)) {
                missiles.splice(i, 1);
                lives--;
                flashTimer = 0.3;
                try { Audio.play('crash'); } catch (e) {}
                if (lives <= 0) {
                    state = 'DEAD';
                    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                }
            }
        }

        if (flashTimer > 0) flashTimer -= dt;
    }

    function drawMissile(m) {
        ctx.save();
        // trail
        for (var t = 0; t < m.trail.length; t++) {
            var a = (t / m.trail.length) * 0.6;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(m.trail[t].x, m.trail[t].y, (t / m.trail.length) * 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 12;
        // body
        ctx.fillStyle = '#cccccc';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // nose
        ctx.fillStyle = '#ff2200';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(8, -6);
        ctx.lineTo(8, 6);
        ctx.closePath();
        ctx.fill();
        // fins
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-22, -10);
        ctx.lineTo(-8, -4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-22, 10);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fill();
        // exhaust flame
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-30, -5);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-30, 5);
        ctx.closePath();
        ctx.fillStyle = '#ff8800';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.shadowColor = '#4488ff';
        ctx.shadowBlur = 16;
        // jet body triangle
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(-18, 20);
        ctx.lineTo(0, 12);
        ctx.lineTo(18, 20);
        ctx.closePath();
        ctx.fillStyle = '#3366cc';
        ctx.fill();
        // cockpit
        ctx.beginPath();
        ctx.ellipse(0, -8, 6, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#aaddff';
        ctx.fill();
        // engine trails
        ctx.shadowColor = '#0088ff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#44aaff';
        ctx.beginPath();
        ctx.moveTo(-10, 20);
        ctx.lineTo(-14, 34);
        ctx.lineTo(-6, 22);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, 20);
        ctx.lineTo(14, 34);
        ctx.lineTo(6, 22);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#050510');
        grad.addColorStop(0.4, '#0a1428');
        grad.addColorStop(1, '#1a2040');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // clouds
        for (var ci = 0; ci < clouds.length; ci++) {
            var c = clouds[ci];
            ctx.globalAlpha = c.a;
            ctx.fillStyle = '#aabbcc';
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.3, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
            ctx.ellipse(c.x + c.w * 0.65, c.y - c.h * 0.1, c.w * 0.4, c.h * 0.45, 0, 0, Math.PI * 2);
            ctx.ellipse(c.x + c.w * 0.5, c.y + c.h * 0.1, c.w * 0.6, c.h * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (state === 'MENU') {
            ctx.fillStyle = '#4488ff';
            ctx.shadowColor = '#0044ff';
            ctx.shadowBlur = 22;
            ctx.font = 'bold 50px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MISSILE EVADE', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 10);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 60);
            }
            ctx.fillStyle = '#aaccff';
            ctx.font = '18px sans-serif';
            ctx.fillText('Hold to move, dodge missiles!', VW / 2, VH / 2 + 110);
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = flashTimer / 0.3 * 0.4;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        for (var j = 0; j < missiles.length; j++) drawMissile(missiles[j]);
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
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 24;
            ctx.fillText('SHOT DOWN!', VW / 2, VH / 2 - 80);
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
            holding = true;
            targetX = x;
            targetY = y;
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        holding = false;
        makeClouds();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
