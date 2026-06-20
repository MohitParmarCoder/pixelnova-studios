'use strict';
var ArrowDodge = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var targets;
    var playerArrows;
    var wind;
    var cooldown;
    var COOLDOWN_MAX = 0.5;
    var flashTimer;
    var stars;
    var archerX, archerY;

    function initStars() {
        stars = [];
        for (var i = 0; i < 60; i++) {
            stars.push({
                x: Math.random() * VW,
                y: Math.random() * VH,
                r: Math.random() * 1.4 + 0.3,
                a: Math.random() * 0.8 + 0.2
            });
        }
    }

    function randomTargetColor() {
        var cols = ['#ff4444', '#ff8800', '#ffcc00', '#44ff88', '#44ccff', '#cc44ff'];
        return cols[Math.floor(Math.random() * cols.length)];
    }

    function spawnTarget() {
        var r = 35 + Math.random() * 10;
        var x = r + 20 + Math.random() * (VW - r * 2 - 40);
        var y = r + 80 + Math.random() * (VH * 0.3 - r * 2);
        var spd = 60 + Math.random() * 60;
        if (score > 50) { spd += 40; }
        var fallSpd = 28 + Math.random() * 18 + Math.floor(score / 30) * 4;
        return {
            x: x, y: y, r: r,
            dir: (Math.random() < 0.5 ? 1 : -1),
            speed: spd,
            fallSpeed: fallSpd,
            color: randomTargetColor()
        };
    }

    function startGame() {
        score = 0;
        lives = 3;
        cooldown = 0;
        flashTimer = 0;
        wind = (Math.random() - 0.5) * 40;
        targets = [spawnTarget(), spawnTarget(), spawnTarget()];
        playerArrows = [];
        archerX = VW / 2;
        archerY = 760;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function loseLife() {
        lives--;
        flashTimer = 0.35;
        try { Audio.play('crash'); } catch (e) {}
        if (lives <= 0) {
            state = 'DEAD';
            if (score > best) { best = score; }
            try { Audio.play('lose'); } catch (e) {}
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'arrowdodge_best'); } catch(e) {}
        }
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state !== 'PLAYING') { return; }

        if (flashTimer > 0) { flashTimer -= dt; }
        if (cooldown > 0) { cooldown -= dt; if (cooldown < 0) { cooldown = 0; } }

        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            t.x += t.dir * t.speed * dt;
            t.y += t.fallSpeed * dt;

            if (t.x - t.r < 0) { t.x = t.r; t.dir = 1; }
            if (t.x + t.r > VW) { t.x = VW - t.r; t.dir = -1; }

            if (t.y + t.r > VH - 80) {
                loseLife();
                if (state !== 'PLAYING') { return; }
                targets[i] = spawnTarget();
            }
        }

        for (var j = playerArrows.length - 1; j >= 0; j--) {
            var a = playerArrows[j];
            if (!a.alive) { playerArrows.splice(j, 1); continue; }
            a.vx += wind * dt * 0.4;
            a.x += a.vx * dt;
            a.y += a.vy * dt;

            if (a.x < -20 || a.x > VW + 20 || a.y < -20 || a.y > VH + 20) {
                playerArrows.splice(j, 1);
                continue;
            }

            for (var k = 0; k < targets.length; k++) {
                var tgt = targets[k];
                var ddx = a.x - tgt.x;
                var ddy = a.y - tgt.y;
                if (ddx * ddx + ddy * ddy < tgt.r * tgt.r) {
                    var distToArcher = Math.sqrt(Math.pow(tgt.x - archerX, 2) + Math.pow(tgt.y - archerY, 2));
                    var pts = Math.max(5, Math.floor(distToArcher / 30));
                    var prevThreshold = Math.floor(score / 30);
                    score += pts;
                    if (score > best) { best = score; }
                    try { Audio.play('gem'); } catch (e) {}
                    if (Math.floor(score / 30) > prevThreshold) {
                        wind = (Math.random() - 0.5) * (40 + Math.floor(score / 30) * 15);
                    }
                    targets[k] = spawnTarget();
                    a.alive = false;
                    break;
                }
            }
            if (!a.alive) { playerArrows.splice(j, 1); }
        }
    }

    function drawBullseye(t) {
        ctx.save();
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd00';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = '#ee2222';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5555';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
    }

    function drawArrowInFlight(a) {
        ctx.save();
        var ang = Math.atan2(a.vy, a.vx);
        ctx.translate(a.x, a.y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#cc8833';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffaa44';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#aaaaaa';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(2, -4);
        ctx.lineTo(2, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawArcher() {
        ctx.save();
        ctx.translate(archerX, archerY);
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#aaaaff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -44, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#eecc99';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(0, -4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-12, 20);
        ctx.moveTo(0, -4);
        ctx.lineTo(12, 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, -28);
        ctx.lineTo(-22, -16);
        ctx.stroke();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-22, -10, 12, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-22, -10 - 12 * Math.sin(0.55 * Math.PI));
        ctx.lineTo(-10, -12);
        ctx.lineTo(-22, -10 + 12 * Math.sin(0.55 * Math.PI));
        ctx.stroke();
        ctx.restore();
    }

    function drawCooldownArc() {
        if (cooldown <= 0) { return; }
        ctx.save();
        ctx.translate(archerX, archerY - 60);
        var frac = cooldown / COOLDOWN_MAX;
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawWindIndicator() {
        var cx = VW / 2, cy = 36;
        ctx.save();
        ctx.fillStyle = 'rgba(170,170,255,0.8)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WIND', cx, cy - 8);
        var len = Math.min(Math.abs(wind) * 1.2, 55);
        var dir = wind >= 0 ? 1 : -1;
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx - dir * len / 2, cy + 4);
        ctx.lineTo(cx + dir * len / 2, cy + 4);
        ctx.stroke();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(cx + dir * len / 2, cy + 4);
        ctx.lineTo(cx + dir * (len / 2 - 8), cy);
        ctx.lineTo(cx + dir * (len / 2 - 8), cy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawLives() {
        ctx.save();
        ctx.font = 'bold 22px sans-serif';
        ctx.textBaseline = 'middle';
        for (var i = 0; i < 3; i++) {
            ctx.fillStyle = i < lives ? '#ff4444' : '#442222';
            ctx.fillText(i < lives ? '♥' : '♡', 18 + i * 28, 28);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    function draw() {
        if (!ctx) { return; }
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        for (var s = 0; s < stars.length; s++) {
            ctx.globalAlpha = stars[s].a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(stars[s].x, stars[s].y, stars[s].r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (state === 'MENU') {
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 24;
            ctx.fillStyle = '#ff8800';
            ctx.font = 'bold 50px sans-serif';
            ctx.fillText('ARROW', VW / 2, VH / 2 - 80);
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.fillText('DODGE', VW / 2, VH / 2 - 18);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            ctx.fillStyle = '#aaaacc';
            ctx.font = '18px sans-serif';
            ctx.fillText('Shoot targets before they fall!', VW / 2, VH / 2 + 108);
            ctx.fillText('Tap anywhere to aim & fire', VW / 2, VH / 2 + 140);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '20px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 190);
            }
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = (flashTimer / 0.35) * 0.4;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        for (var ti = 0; ti < targets.length; ti++) {
            drawBullseye(targets[ti]);
        }
        for (var ai = 0; ai < playerArrows.length; ai++) {
            drawArrowInFlight(playerArrows[ai]);
        }

        drawArcher();
        drawCooldownArc();
        drawLives();
        drawWindIndicator();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 16, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 28;
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 54px sans-serif';
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 10);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 38);
            ctx.fillStyle = '#aaffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
        }
    }

    function tap(x, y) {
        if (state === 'MENU') { startGame(); return; }
        if (state === 'DEAD') { startGame(); return; }
        if (state === 'PLAYING') {
            try { Audio.play('tap'); } catch (e) {}
            if (cooldown > 0) { return; }
            cooldown = COOLDOWN_MAX;
            var dx = x - archerX;
            var dy = y - archerY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) { dist = 1; }
            var spd = 600;
            playerArrows.push({
                x: archerX,
                y: archerY - 34,
                vx: (dx / dist) * spd,
                vy: (dy / dist) * spd,
                alive: true
            });
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
