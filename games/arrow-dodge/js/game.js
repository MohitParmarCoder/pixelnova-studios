'use strict';
var ArrowDodge = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives, timer;
    var playerX, playerY, playerTargetX;
    var arrows;
    var spawnTimer, spawnInterval;
    var arrowSpeed;
    var stars;
    var flashTimer;

    function initStars() {
        stars = [];
        for (var i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * VW,
                y: Math.random() * VH,
                r: Math.random() * 1.5 + 0.3,
                a: Math.random()
            });
        }
    }

    function startGame() {
        score = 0;
        lives = 3;
        timer = 0;
        playerX = VW / 2;
        playerY = VH - 80;
        playerTargetX = VW / 2;
        arrows = [];
        spawnTimer = 0;
        spawnInterval = 1.2;
        arrowSpeed = 220;
        flashTimer = 0;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnArrow() {
        var x = 30 + Math.random() * (VW - 60);
        arrows.push({ x: x, y: -30, w: 14, h: 36 });
    }

    function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function update(dt) {
        if (state !== 'PLAYING') return;

        timer += dt;
        score = Math.floor(timer * 10);
        if (score > best) best = score;

        // difficulty ramp
        arrowSpeed = 220 + timer * 18;
        spawnInterval = Math.max(0.32, 1.2 - timer * 0.04);

        // move player toward target
        var dx = playerTargetX - playerX;
        playerX += dx * Math.min(1, dt * 8);

        // spawn arrows
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnArrow();
        }

        // update arrows
        for (var i = arrows.length - 1; i >= 0; i--) {
            arrows[i].y += arrowSpeed * dt;
            if (arrows[i].y > VH + 40) {
                arrows.splice(i, 1);
                continue;
            }
            // collision with player (player is 28x40)
            if (rectOverlap(arrows[i].x - 7, arrows[i].y - 18, 14, 36,
                            playerX - 14, playerY - 20, 28, 40)) {
                arrows.splice(i, 1);
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

    function drawArrow(a) {
        ctx.save();
        ctx.translate(a.x, a.y);
        // glow
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 14;
        // shaft
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(-3, -12, 6, 28);
        // head
        ctx.beginPath();
        ctx.moveTo(0, 24);
        ctx.lineTo(-10, 4);
        ctx.lineTo(10, 4);
        ctx.closePath();
        ctx.fillStyle = '#ff2200';
        ctx.fill();
        // fletching
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-6, -14, 5, 8);
        ctx.fillRect(1, -14, 5, 8);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 18;
        // body
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(-14, 18);
        ctx.lineTo(0, 10);
        ctx.lineTo(14, 18);
        ctx.closePath();
        ctx.fillStyle = '#88ddff';
        ctx.fill();
        // engine glow
        ctx.beginPath();
        ctx.arc(0, 20, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff8800';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawLives() {
        for (var i = 0; i < 3; i++) {
            ctx.save();
            ctx.globalAlpha = (i < lives) ? 1 : 0.2;
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            var hx = 24 + i * 32, hy = 30;
            ctx.moveTo(hx, hy + 8);
            ctx.bezierCurveTo(hx - 12, hy - 4, hx - 14, hy - 16, hx, hy - 10);
            ctx.bezierCurveTo(hx + 14, hy - 16, hx + 12, hy - 4, hx, hy + 8);
            ctx.fill();
            ctx.restore();
        }
    }

    function draw() {
        if (!ctx) return;
        // background gradient
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, '#000010');
        grad.addColorStop(0.5, '#050520');
        grad.addColorStop(1, '#000028');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // stars
        for (var i = 0; i < stars.length; i++) {
            ctx.globalAlpha = stars[i].a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(stars[i].x, stars[i].y, stars[i].r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (state === 'MENU') {
            ctx.fillStyle = '#00ccff';
            ctx.shadowColor = '#00ccff';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ARROW DODGE', VW / 2, VH / 2 - 80);
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
            ctx.fillText('Dodge falling arrows!', VW / 2, VH / 2 + 110);
            return;
        }

        // flash on hit
        if (flashTimer > 0) {
            ctx.globalAlpha = flashTimer / 0.3 * 0.4;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        for (var j = 0; j < arrows.length; j++) {
            drawArrow(arrows[j]);
        }
        drawPlayer();
        drawLives();

        // score
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 20, 44);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 24;
            ctx.fillText('DEAD', VW / 2, VH / 2 - 80);
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
        }
    }

    function getBest() {
        return best;
    }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        initStars();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
