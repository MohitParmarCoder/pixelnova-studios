'use strict';
var LineBreaker = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score = 0;
    var lives = 3;

    // Bricks
    var BRICK_COLS = 7;
    var BRICK_W = 50;
    var BRICK_H = 30;
    var BRICK_GAP = 4;
    var BRICK_TOP = 90;
    var BRICK_AREA_BOT = 680;
    var bricks; // [{x,y,w,h,hp,maxHp,alive}]
    var brickRows = 3;

    // Ball
    var ballX, ballY, ballVX, ballVY;
    var BALL_R = 9;
    var BALL_SPEED = 500;
    var ballLaunched;
    var ballInFlight;

    // Aim
    var aimX, aimY;

    // Power ball
    var bricksDestroyed;
    var powerBall;     // true = next ball does 2 damage (orange)
    var powerActive;   // currently in power state

    // Particles
    var particles;

    // Shake
    var shakeTime;

    // Trail
    var trail;

    // BRICK_COLORS by hp level
    var HP_COLORS = ['#222233', '#1155aa', '#22aa44', '#ddcc00', '#ee6600', '#ee2222'];

    function brickColor(hp, maxHp) {
        var idx = Math.round((hp / maxHp) * (HP_COLORS.length - 1));
        return HP_COLORS[idx];
    }

    function totalGridW() {
        return BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
    }

    function brickStartX() {
        return Math.floor((VW - totalGridW()) / 2);
    }

    function makeBrickRow(rowIndex, yOffset) {
        var row = [];
        var sx = brickStartX();
        for (var c = 0; c < BRICK_COLS; c++) {
            // Randomly skip ~15% of bricks for gaps
            if (Math.random() < 0.15) continue;
            var hp = 1 + Math.floor(Math.random() * Math.min(5, 1 + Math.floor(score / 20)));
            row.push({
                x: sx + c * (BRICK_W + BRICK_GAP),
                y: yOffset,
                w: BRICK_W,
                h: BRICK_H,
                hp: hp,
                maxHp: hp,
                alive: true
            });
        }
        return row;
    }

    function initBricks() {
        bricks = [];
        var i, row;
        for (i = 0; i < brickRows; i++) {
            row = makeBrickRow(i, BRICK_TOP + i * (BRICK_H + BRICK_GAP));
            for (var j = 0; j < row.length; j++) bricks.push(row[j]);
        }
    }

    function addBrickRow() {
        // Shift all bricks down
        var i;
        for (i = 0; i < bricks.length; i++) {
            bricks[i].y += BRICK_H + BRICK_GAP;
        }
        // Remove bricks that fell off bottom
        var fresh = [];
        for (i = 0; i < bricks.length; i++) {
            if (bricks[i].y < BRICK_AREA_BOT) fresh.push(bricks[i]);
        }
        bricks = fresh;
        // Add new row at top
        var row = makeBrickRow(0, BRICK_TOP);
        for (i = 0; i < row.length; i++) bricks.push(row[i]);
    }

    function resetBall() {
        ballX = VW / 2;
        ballY = 730;
        ballVX = 0;
        ballVY = 0;
        ballLaunched = false;
        ballInFlight = false;
        aimX = VW / 2;
        aimY = 400;
        trail = [];
    }

    function startGame() {
        score = 0;
        lives = 3;
        bricksDestroyed = 0;
        powerBall = false;
        powerActive = false;
        particles = [];
        shakeTime = 0;
        initBricks();
        resetBall();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnParticles(cx, cy, color, n) {
        for (var i = 0; i < (n || 8); i++) {
            var a = Math.random() * Math.PI * 2;
            var s = 60 + Math.random() * 100;
            particles.push({x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: color, life: 1, r: 3 + Math.random() * 3});
        }
    }

    function launchBall() {
        var dx = aimX - ballX;
        var dy = aimY - ballY;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) { dy = -1; len = 1; }
        // Ensure ball goes upward
        if (dy > -10) { dy = -80; len = Math.sqrt(dx * dx + dy * dy); }
        var currentSpeed = Math.min(800, BALL_SPEED + Math.floor(score / 30) * 25);
        ballVX = (dx / len) * currentSpeed;
        ballVY = (dy / len) * currentSpeed;
        ballLaunched = true;
        ballInFlight = true;
        powerActive = powerBall;
        try { Audio.play('tap'); } catch (e) {}
    }

    function checkBrickCollision() {
        var i, b, overlapL, overlapR, overlapT, overlapB, minH, minV;
        for (i = 0; i < bricks.length; i++) {
            b = bricks[i];
            if (!b.alive) continue;
            if (ballX + BALL_R > b.x && ballX - BALL_R < b.x + b.w &&
                ballY + BALL_R > b.y && ballY - BALL_R < b.y + b.h) {
                var dmg = powerActive ? 2 : 1;
                b.hp -= dmg;
                try { Audio.play('tap'); } catch (e) {}
                if (b.hp <= 0) {
                    b.alive = false;
                    score += 10;
                    if (score > best) best = score;
                    bricksDestroyed++;
                    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, brickColor(b.maxHp, b.maxHp), 8);
                    try { Audio.play('gem'); } catch (e) {}
                    // Every 5 bricks = power ball
                    if (bricksDestroyed % 5 === 0) {
                        powerBall = true;
                    }
                }
                // Bounce
                overlapL = (ballX + BALL_R) - b.x;
                overlapR = (b.x + b.w) - (ballX - BALL_R);
                overlapT = (ballY + BALL_R) - b.y;
                overlapB = (b.y + b.h) - (ballY - BALL_R);
                minH = overlapL < overlapR ? overlapL : overlapR;
                minV = overlapT < overlapB ? overlapT : overlapB;
                if (minH < minV) {
                    ballVX = -ballVX;
                } else {
                    ballVY = -ballVY;
                }
                return;
            }
        }
    }

    function checkBricksOverflow() {
        for (var i = 0; i < bricks.length; i++) {
            if (bricks[i].alive && bricks[i].y + bricks[i].h >= BRICK_AREA_BOT) {
                lives--;
                try { Audio.play('crash'); } catch (e) {}
                shakeTime = 0.4;
                if (lives <= 0) {
                    try { Audio.play('lose'); } catch (e) {}
                    if (score > best) best = score;
                    state = 'DEAD';
                    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                    AdManager.showInterstitial(() => {});
                    try { AdManager.offerDoubleScore(score, 'linebreaker_best'); } catch(e) {}
                    return true;
                }
                // Push bricks back up one row
                var j;
                for (j = 0; j < bricks.length; j++) {
                    bricks[j].y -= BRICK_H + BRICK_GAP;
                }
                return false;
            }
        }
        return false;
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        if (shakeTime > 0) shakeTime -= dt;

        // Particles
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 2;
            if (p.life <= 0) particles.splice(i, 1);
        }

        if (!ballInFlight) return;

        // Move ball
        ballX += ballVX * dt;
        ballY += ballVY * dt;

        // Wall bounces
        if (ballX - BALL_R < 0) { ballX = BALL_R; ballVX = Math.abs(ballVX); try { Audio.play('tap'); } catch(e){} }
        if (ballX + BALL_R > VW) { ballX = VW - BALL_R; ballVX = -Math.abs(ballVX); try { Audio.play('tap'); } catch(e){} }
        if (ballY - BALL_R < 80) { ballY = 80 + BALL_R; ballVY = Math.abs(ballVY); try { Audio.play('tap'); } catch(e){} }

        // Brick collision
        checkBrickCollision();

        // Ball fell off bottom
        if (ballY - BALL_R > VH + 20) {
            ballInFlight = false;
            ballLaunched = false;
            powerBall = false;
            powerActive = false;
            // Bricks shift down, new row added
            addBrickRow();
            if (checkBricksOverflow()) return;
            resetBall();
            try { Audio.play('crash'); } catch(e) {}
        }

        // Trail
        trail.unshift({x: ballX, y: ballY});
        if (trail.length > 10) trail.length = 10;
    }

    function drawAimPreview() {
        if (ballLaunched) return;
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = powerBall ? '#ffaa00' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Trace aim line for 2 bounces
        var px = ballX, py = ballY;
        var dx = aimX - ballX, dy = aimY - ballY;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) { ctx.restore(); return; }
        if (dy > -10) { dy = -80; len = Math.sqrt(dx * dx + dy * dy); }
        var vx = (dx / len), vy = (dy / len);
        var stepLen = 8;
        var maxSteps = 100;
        var bounces = 0;
        ctx.moveTo(px, py);
        for (var s = 0; s < maxSteps && bounces < 2; s++) {
            px += vx * stepLen;
            py += vy * stepLen;
            if (px < BALL_R) { px = BALL_R; vx = Math.abs(vx); bounces++; }
            if (px > VW - BALL_R) { px = VW - BALL_R; vx = -Math.abs(vx); bounces++; }
            if (py < 80 + BALL_R) { py = 80 + BALL_R; vy = Math.abs(vy); bounces++; }
            ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawBricks() {
        var i, b;
        for (i = 0; i < bricks.length; i++) {
            b = bricks[i];
            if (!b.alive) continue;
            var hpFrac = b.hp / b.maxHp;
            // Color: bright = full hp, dim = low hp
            var baseColor = brickColor(b.hp, b.maxHp);
            ctx.save();
            ctx.fillStyle = baseColor;
            ctx.globalAlpha = 0.4 + hpFrac * 0.6;
            // Rounded rect
            ctx.beginPath();
            ctx.moveTo(b.x + 5, b.y);
            ctx.lineTo(b.x + b.w - 5, b.y);
            ctx.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + 5);
            ctx.lineTo(b.x + b.w, b.y + b.h - 5);
            ctx.quadraticCurveTo(b.x + b.w, b.y + b.h, b.x + b.w - 5, b.y + b.h);
            ctx.lineTo(b.x + 5, b.y + b.h);
            ctx.quadraticCurveTo(b.x, b.y + b.h, b.x, b.y + b.h - 5);
            ctx.lineTo(b.x, b.y + 5);
            ctx.quadraticCurveTo(b.x, b.y, b.x + 5, b.y);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            // HP number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.hp, b.x + b.w / 2, b.y + b.h / 2);
            ctx.restore();
        }
    }

    function drawBall() {
        var i;
        ctx.save();
        // Trail
        for (i = trail.length - 1; i >= 1; i--) {
            var alpha = (1 - i / trail.length) * 0.35;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = powerActive ? '#ffaa00' : '#aaddff';
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].y, BALL_R * (1 - i / trail.length * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Ball
        ctx.shadowColor = powerActive ? '#ffaa00' : '#aaddff';
        ctx.shadowBlur = 16;
        ctx.fillStyle = powerActive ? '#ffcc44' : '#ffffff';
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawHUD() {
        ctx.save();
        ctx.textBaseline = 'top';
        // Lives top-left
        var heartsStr = '';
        var i;
        for (i = 0; i < 3; i++) heartsStr += (i < lives) ? '♥' : '♡';
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
        // Power ball indicator
        if (powerBall) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 10;
            ctx.font = 'bold 14px monospace';
            ctx.fillText('POWER BALL READY!', VW / 2, 46);
            ctx.shadowBlur = 0;
        }
        // Bricks remaining
        var aliveCnt = 0;
        for (var j = 0; j < bricks.length; j++) { if (bricks[j].alive) aliveCnt++; }
        ctx.textAlign = 'left';
        ctx.fillStyle = '#778899';
        ctx.font = '13px monospace';
        ctx.fillText('BRICKS: ' + aliveCnt, 10, 48);
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;

        // Background
        var bg = ctx.createLinearGradient(0, 0, 0, VH);
        bg.addColorStop(0, '#04050e');
        bg.addColorStop(1, '#060c1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#2196F3';
            ctx.shadowColor = '#2196F3';
            ctx.shadowBlur = 30;
            ctx.font = 'bold 52px monospace';
            ctx.fillText('LINE BREAKER', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaddff';
            ctx.font = '18px monospace';
            ctx.fillText('Break bricks. Tap to aim & launch!', VW / 2, VH / 2 - 14);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#2196F3';
            ctx.shadowBlur = 12;
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            ctx.shadowBlur = 0;
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px monospace';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 110);
            }
            ctx.restore();
            return;
        }

        var sx = 0, sy = 0;
        if (shakeTime > 0) {
            sx = (Math.random() - 0.5) * 8;
            sy = (Math.random() - 0.5) * 8;
        }

        ctx.save();
        ctx.translate(sx, sy);

        // Brick zone line
        ctx.strokeStyle = '#223344';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, BRICK_AREA_BOT);
        ctx.lineTo(VW, BRICK_AREA_BOT);
        ctx.stroke();

        drawBricks();
        drawAimPreview();
        drawBall();

        // Particles
        var i;
        for (i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Ball launch zone indicator
        ctx.strokeStyle = '#334455';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 710);
        ctx.lineTo(VW, 710);
        ctx.stroke();

        ctx.restore();

        drawHUD();

        if (state === 'DEAD') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#2196F3';
            ctx.shadowColor = '#2196F3';
            ctx.shadowBlur = 28;
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

        if (!ballInFlight) {
            // Set aim and launch
            aimX = x;
            aimY = y;
            launchBall();
        }
        // If ball is in flight, ignore tap (single ball)
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
        bricks = [];
        bricksDestroyed = 0;
        powerBall = false;
        powerActive = false;
        shakeTime = 0;
        resetBall();
        initBricks();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
