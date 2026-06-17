'use strict';
var BombSquad = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var paddleX, paddleTargetX;
    var bombs;
    var spawnTimer, spawnInterval;
    var flashTimer;
    var tick;
    var PADDLE_W = 90, PADDLE_H = 18, PADDLE_Y;

    function startGame() {
        score = 0;
        lives = 3;
        tick = 0;
        PADDLE_Y = VH - 60;
        paddleX = VW / 2;
        paddleTargetX = VW / 2;
        bombs = [];
        spawnTimer = 0;
        spawnInterval = 1.0;
        flashTimer = 0;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnBomb() {
        var x = 40 + Math.random() * (VW - 80);
        var dangerous = Math.random() < 0.45;
        var spd = 130 + tick * 10 + Math.random() * 60;
        bombs.push({
            x: x, y: -30,
            spd: spd,
            dangerous: dangerous,
            fuse: 0,
            r: 20
        });
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;
        spawnInterval = Math.max(0.3, 1.0 - tick * 0.03);

        // paddle movement
        paddleX += (paddleTargetX - paddleX) * Math.min(1, dt * 9);

        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnBomb();
        }

        for (var i = bombs.length - 1; i >= 0; i--) {
            var b = bombs[i];
            b.y += b.spd * dt;
            if (b.dangerous) b.fuse += dt;

            // off screen
            if (b.y > VH + 40) {
                bombs.splice(i, 1);
                if (!b.dangerous) {
                    // missed safe bomb - no penalty, just gone
                } else {
                    // missed dangerous bomb - also fine
                }
                continue;
            }

            // paddle collision
            var px = paddleX - PADDLE_W / 2;
            var py = PADDLE_Y;
            if (b.x > px && b.x < px + PADDLE_W &&
                b.y + b.r > py && b.y - b.r < py + PADDLE_H) {
                bombs.splice(i, 1);
                if (b.dangerous) {
                    lives--;
                    flashTimer = 0.35;
                    try { Audio.play('crash'); } catch (e) {}
                    if (lives <= 0) {
                        state = 'DEAD';
                        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                    }
                } else {
                    score++;
                    if (score > best) best = score;
                    try { Audio.play('gem'); } catch (e) {}
                }
            }
        }

        if (flashTimer > 0) flashTimer -= dt;
    }

    function drawBomb(b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        if (b.dangerous) {
            // dark bomb with fuse
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, 0, b.r, 0, Math.PI * 2);
            ctx.fillStyle = '#111111';
            ctx.fill();
            ctx.strokeStyle = '#ff2200';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // fuse
            ctx.beginPath();
            ctx.moveTo(4, -b.r);
            ctx.quadraticCurveTo(14, -b.r - 12, 10, -b.r - 22);
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.stroke();
            // spark at fuse tip - flicker
            if (Math.floor(b.fuse * 12) % 2 === 0) {
                ctx.beginPath();
                ctx.arc(10, -b.r - 22, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffff00';
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 10;
                ctx.fill();
            }
            // red X
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
            ctx.moveTo(7, -7); ctx.lineTo(-7, 7);
            ctx.stroke();
        } else {
            // safe bomb - green or blue
            var safe = (Math.floor(b.spd / 10) % 2 === 0);
            ctx.shadowColor = safe ? '#00ff88' : '#4488ff';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(0, 0, b.r, 0, Math.PI * 2);
            ctx.fillStyle = safe ? '#005522' : '#002255';
            ctx.fill();
            ctx.strokeStyle = safe ? '#00ff88' : '#4488ff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // checkmark
            ctx.strokeStyle = safe ? '#00ff88' : '#88ccff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(-2, 8); ctx.lineTo(9, -7);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPaddle() {
        ctx.save();
        var px = paddleX - PADDLE_W / 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#004466';
        ctx.beginPath();
        ctx.roundRect(px, PADDLE_Y, PADDLE_W, PADDLE_H, 8);
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // grip lines
        ctx.strokeStyle = '#00aacc';
        ctx.lineWidth = 1.5;
        for (var i = 0; i < 5; i++) {
            var lx = px + 14 + i * 14;
            ctx.beginPath();
            ctx.moveTo(lx, PADDLE_Y + 3);
            ctx.lineTo(lx, PADDLE_Y + PADDLE_H - 3);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#0a0a0a');
        grad.addColorStop(0.6, '#111820');
        grad.addColorStop(1, '#0d0d0d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // industrial grid lines
        ctx.strokeStyle = 'rgba(40,60,80,0.5)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx < VW; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, VH);
            ctx.stroke();
        }
        for (var gy = 0; gy < VH; gy += 40) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(VW, gy);
            ctx.stroke();
        }

        if (state === 'MENU') {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 22;
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BOMB SQUAD', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 10);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 60);
            }
            ctx.fillStyle = '#aaaacc';
            ctx.font = '18px sans-serif';
            ctx.fillText('Catch SAFE bombs, avoid DANGER!', VW / 2, VH / 2 + 110);
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = flashTimer / 0.35 * 0.42;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        for (var j = 0; j < bombs.length; j++) drawBomb(bombs[j]);
        drawPaddle();

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

        ctx.fillStyle = '#ffdd00';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.68)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff4400';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 22;
            ctx.fillText('BOOM!', VW / 2, VH / 2 - 80);
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
            paddleTargetX = x;
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
