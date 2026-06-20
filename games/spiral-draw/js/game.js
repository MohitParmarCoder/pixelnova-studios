'use strict';

var SpiralDraw = (function() {

    // Constants
    var VW = 390;
    var VH = 844;

    var DOT_HIT_RADIUS = 40;
    var DOT_VISUAL_RADIUS = 18;

    var COL_BG = '#0D0D1A';
    var COL_DONE = '#9B59B6';
    var COL_CURRENT = '#F39C12';
    var COL_FUTURE = '#2C3E50';
    var COL_PATH = '#1A1A3A';

    // Spiral params
    var SPIRAL_A = 20;
    var SPIRAL_B = 18;
    var CX = VW / 2;
    var CY = VH / 2 - 50;

    // State
    var canvas = null;
    var ctx = null;
    var bestScore = 0;
    var state = 'MENU';

    var dots = [];
    var currentDot = 0;
    var lives = 3;
    var score = 0;
    var level = 0;
    var pulseTime = 0;

    // Menu background spiral animation
    var menuTime = 0;

    function dotsForLevel(lv) {
        return 8 + (lv - 1) * 4;
    }

    function generateSpiral(n) {
        var result = [];
        for (var i = 0; i < n; i++) {
            var theta = i * 0.8;
            var r = SPIRAL_A + SPIRAL_B * theta;
            var x = CX + r * Math.cos(theta);
            var y = CY + r * Math.sin(theta);
            result.push({ x: x, y: y });
        }
        return result;
    }

    function startLevel() {
        level += 1;
        var n = dotsForLevel(level);
        dots = generateSpiral(n);
        currentDot = 0;
        pulseTime = 0;
    }

    function startGame() {
        score = 0;
        lives = 3;
        level = 0;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch(e) {}
        startLevel();
    }

    function endGame() {
        if (score > bestScore) {
            bestScore = score;
        }
        state = 'DEAD';
        try { Audio.play('lose'); } catch(e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'spiraldraw_best'); } catch(e) {}
    }

    // Public API

    function init(c, best) {
        canvas = c;
        ctx = canvas.getContext('2d');
        bestScore = best || 0;
        state = 'MENU';
        menuTime = 0;
        dots = [];
        currentDot = 0;
        lives = 3;
        score = 0;
        level = 0;
        pulseTime = 0;
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        menuTime += dt;

        if (state === 'PLAYING') {
            pulseTime += dt;
        }
    }

    function draw() {
        if (!ctx) return;

        // Clear background
        ctx.fillStyle = COL_BG;
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            drawMenu();
        } else if (state === 'PLAYING') {
            drawPlaying();
        } else if (state === 'DEAD') {
            drawDead();
        }
    }

    function drawMenu() {
        // Animated background spiral
        drawBackgroundSpiral(menuTime);

        // Title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow glow effect
        ctx.shadowColor = '#9B59B6';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('SPIRAL DRAW', VW / 2, 200);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.fillStyle = '#9B59B6';
        ctx.font = '22px sans-serif';
        ctx.fillText('Trace the Path', VW / 2, 252);

        // Best score
        if (bestScore > 0) {
            ctx.fillStyle = '#F39C12';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('BEST: ' + bestScore, VW / 2, 640);
        }

        // Tap to play — pulsing
        var alpha = 0.6 + 0.4 * Math.sin(menuTime * 2.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('TAP TO PLAY', VW / 2, 700);
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    function drawBackgroundSpiral(t) {
        var n = 24;
        var pts = generateSpiral(n);
        var offsetX = VW / 2 - CX;
        var offsetY = VH / 2 + 60 - CY;

        // Draw connecting path
        ctx.save();
        ctx.strokeStyle = COL_PATH;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var i = 0; i < pts.length; i++) {
            var px = pts[i].x + offsetX;
            var py = pts[i].y + offsetY;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        // Draw dots with animated glow cycling
        for (var j = 0; j < pts.length; j++) {
            var px2 = pts[j].x + offsetX;
            var py2 = pts[j].y + offsetY;
            var phase = (j / n) - t * 0.6;
            var pulse = 0.3 + 0.7 * Math.max(0, Math.sin(phase * Math.PI * 2));
            ctx.beginPath();
            ctx.arc(px2, py2, DOT_VISUAL_RADIUS * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = COL_FUTURE;
            ctx.globalAlpha = 0.4 + 0.4 * pulse;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawPlaying() {
        // Draw spiral path line
        if (dots.length > 1) {
            ctx.save();
            ctx.strokeStyle = COL_PATH;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dots[0].x, dots[0].y);
            for (var i = 1; i < dots.length; i++) {
                ctx.lineTo(dots[i].x, dots[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Draw dots
        for (var j = 0; j < dots.length; j++) {
            var d = dots[j];
            if (j < currentDot) {
                // Completed
                drawDot(d.x, d.y, DOT_VISUAL_RADIUS, COL_DONE, 1.0, false);
            } else if (j === currentDot) {
                // Current target — pulsing
                var pulse = 0.8 + 0.2 * Math.sin(pulseTime * 5.0);
                var r = DOT_VISUAL_RADIUS * pulse;
                drawDot(d.x, d.y, r, COL_CURRENT, 1.0, true);
            } else {
                // Future
                drawDot(d.x, d.y, DOT_VISUAL_RADIUS * 0.75, COL_FUTURE, 0.5, false);
            }
        }

        // HUD: Level and Score at top left
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('LVL ' + level, 20, 24);
        ctx.fillStyle = '#9B59B6';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('SCORE ' + score, 20, 50);
        ctx.restore();

        // HUD: Lives at top right
        drawLives(lives);

        // Progress indicator: dots remaining
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#F39C12';
        ctx.font = '16px sans-serif';
        ctx.fillText((currentDot + 1) + ' / ' + dots.length, VW / 2, VH - 30);
        ctx.restore();
    }

    function drawDot(x, y, r, color, alpha, glow) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 18;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (glow) {
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    function drawLives(remaining) {
        var startX = VW - 24;
        var startY = 24;
        for (var i = 0; i < 3; i++) {
            var hx = startX - i * 32;
            var hy = startY;
            var filled = (i < remaining);
            drawHeart(hx, hy, 12, filled);
        }
    }

    function drawHeart(cx, cy, size, filled) {
        ctx.save();
        ctx.beginPath();
        // Heart shape using bezier curves
        ctx.moveTo(cx, cy + size * 0.3);
        ctx.bezierCurveTo(
            cx, cy - size * 0.1,
            cx - size, cy - size * 0.1,
            cx - size, cy + size * 0.4
        );
        ctx.bezierCurveTo(
            cx - size, cy + size,
            cx, cy + size * 1.3,
            cx, cy + size * 1.5
        );
        ctx.bezierCurveTo(
            cx, cy + size * 1.3,
            cx + size, cy + size,
            cx + size, cy + size * 0.4
        );
        ctx.bezierCurveTo(
            cx + size, cy - size * 0.1,
            cx, cy - size * 0.1,
            cx, cy + size * 0.3
        );
        ctx.closePath();
        if (filled) {
            ctx.fillStyle = '#E74C3C';
        } else {
            ctx.fillStyle = '#2C3E50';
        }
        ctx.fill();
        ctx.restore();
    }

    function drawDead() {
        // Draw playing state dimmed in background
        drawPlaying();

        // Dark overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, VW, VH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Game Over title
        ctx.shadowColor = '#E74C3C';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#E74C3C';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText('GAME OVER', VW / 2, 320);
        ctx.shadowBlur = 0;

        // Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('SCORE: ' + score, VW / 2, 400);

        // Best
        ctx.fillStyle = '#F39C12';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('BEST: ' + bestScore, VW / 2, 445);

        // Tap to retry — pulsing
        var alpha = 0.6 + 0.4 * Math.sin(menuTime * 2.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('TAP TO RETRY', VW / 2, 540);
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    function tap(x, y) {
        if (state === 'MENU') {
            startGame();
            return;
        }

        if (state === 'DEAD') {
            startGame();
            return;
        }

        if (state === 'PLAYING') {
            if (currentDot >= dots.length) return;

            var target = dots[currentDot];
            var dx = x - target.x;
            var dy = y - target.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= DOT_HIT_RADIUS) {
                // Correct tap
                try { Audio.play('tap'); } catch(e) {}
                currentDot += 1;

                if (currentDot >= dots.length) {
                    // Level complete
                    score += 1;
                    if (score > bestScore) {
                        bestScore = score;
                    }
                    try { Audio.play('gem'); } catch(e) {}
                    startLevel();
                }
            } else {
                // Wrong tap — miss
                try { Audio.play('crash'); } catch(e) {}
                lives -= 1;
                if (lives <= 0) {
                    lives = 0;
                    endGame();
                }
            }
        }
    }

    function getBest() {
        return bestScore;
    }

    return {
        init: init,
        update: update,
        draw: draw,
        tap: tap,
        getBest: getBest
    };

})();
