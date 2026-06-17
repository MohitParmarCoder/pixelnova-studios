'use strict';
var BounceMaster = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var puck;
    var playerX, playerY;
    var aiX, aiY;
    var playerGoals, aiGoals;
    var pulseT;
    var particles;

    var PUCK_R = 20;
    var PADDLE_R = 30;
    var PLAYER_Y = VH - 80;
    var AI_Y = 120;
    var GOAL_TOP = 60;
    var GOAL_BOT = VH - 60;
    var SPEED_CAP = 700;
    var AI_GOAL_LIMIT = 3;
    var PLAYER_GOAL_LIMIT = 3;

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function resetPuck(goDown) {
        var angle = goDown
            ? (Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6)
            : (-Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6);
        puck = {
            x: VW / 2,
            y: VH / 2,
            vx: Math.cos(angle) * 300,
            vy: Math.sin(angle) * 300
        };
    }

    function spawnParticles(x, y, color) {
        var i, a, sp;
        for (i = 0; i < 8; i++) {
            a = Math.random() * Math.PI * 2;
            sp = 80 + Math.random() * 150;
            particles.push({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                color: color,
                life: 0.4 + Math.random() * 0.3,
                t: 0,
                r: 3 + Math.random() * 3
            });
        }
    }

    function startGame() {
        score = 0;
        lives = 3;
        playerGoals = 0;
        aiGoals = 0;
        playerX = VW / 2;
        playerY = PLAYER_Y;
        aiX = VW / 2;
        aiY = AI_Y;
        particles = [];
        resetPuck(true);
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function update(dt) {
        pulseT += dt;
        if (state !== 'PLAYING') return;

        // Update particles
        var i;
        for (i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.t += dt;
            if (p.t >= p.life) { particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
        }

        // AI tracks puck x
        aiX += (puck.x - aiX) * clamp(3 * dt, 0, 1);
        aiX = clamp(aiX, PADDLE_R, VW - PADDLE_R);

        // Move puck
        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;

        // Wall bounces
        if (puck.x - PUCK_R < 0) {
            puck.x = PUCK_R;
            puck.vx = Math.abs(puck.vx);
        }
        if (puck.x + PUCK_R > VW) {
            puck.x = VW - PUCK_R;
            puck.vx = -Math.abs(puck.vx);
        }

        // Player paddle collision
        var dxP = puck.x - playerX, dyP = puck.y - playerY;
        if (Math.sqrt(dxP * dxP + dyP * dyP) < PUCK_R + PADDLE_R && puck.vy > 0) {
            puck.vy = -Math.abs(puck.vy);
            puck.vx += (puck.x - playerX) * 0.3;
            // Speed cap
            var spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
            if (spd > SPEED_CAP) {
                puck.vx = puck.vx / spd * SPEED_CAP;
                puck.vy = puck.vy / spd * SPEED_CAP;
            }
            spawnParticles(puck.x, puck.y, '#4488ff');
            try { Audio.play('tap'); } catch (e) {}
        }

        // AI paddle collision
        var dxA = puck.x - aiX, dyA = puck.y - aiY;
        if (Math.sqrt(dxA * dxA + dyA * dyA) < PUCK_R + PADDLE_R && puck.vy < 0) {
            puck.vy = Math.abs(puck.vy);
            puck.vx += (puck.x - aiX) * 0.3;
            var spdA = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
            if (spdA > SPEED_CAP) {
                puck.vx = puck.vx / spdA * SPEED_CAP;
                puck.vy = puck.vy / spdA * SPEED_CAP;
            }
        }

        // Puck past player (AI scores)
        if (puck.y > GOAL_BOT) {
            aiGoals++;
            spawnParticles(puck.x, GOAL_BOT, '#ff4444');
            try { Audio.play('crash'); } catch (e) {}
            if (aiGoals >= AI_GOAL_LIMIT) {
                // Lose round = lose life
                lives--;
                aiGoals = 0;
                playerGoals = 0;
                if (lives <= 0) {
                    state = 'DEAD';
                    try { Audio.play('lose'); } catch (e) {}
                    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                    return;
                }
            }
            resetPuck(true);
        }

        // Puck past AI (player scores)
        if (puck.y < GOAL_TOP) {
            playerGoals++;
            score += 10;
            if (score > best) best = score;
            spawnParticles(puck.x, GOAL_TOP, '#44ff88');
            try { Audio.play('gem'); } catch (e) {}
            if (playerGoals >= PLAYER_GOAL_LIMIT) {
                score += 50;
                if (score > best) best = score;
                playerGoals = 0;
                aiGoals = 0;
            }
            resetPuck(false);
        }
    }

    function drawDashedLine(y) {
        ctx.setLineDash([12, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VW, y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawPaddle(x, y, color, glow) {
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, PADDLE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;

        // Background
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        // Dark blue halves
        ctx.fillStyle = '#040a18';
        ctx.fillRect(0, 0, VW, VH / 2);
        ctx.fillStyle = '#040d10';
        ctx.fillRect(0, VH / 2, VW, VH / 2);

        if (state === 'MENU') {
            ctx.fillStyle = '#4488ff';
            ctx.shadowColor = '#2266ff';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('AIR HOCKEY', VW / 2, VH / 2 - 80);
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
            ctx.fillText('Tap/drag to move paddle!', VW / 2, VH / 2 + 110);
            ctx.textAlign = 'left';
            return;
        }

        // Center dashed line
        drawDashedLine(VH / 2);

        // Goal lines
        ctx.strokeStyle = '#ff4444';
        ctx.shadowColor = '#ff2222';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GOAL_TOP);
        ctx.lineTo(VW, GOAL_TOP);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#4488ff';
        ctx.shadowColor = '#2266ff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GOAL_BOT);
        ctx.lineTo(VW, GOAL_BOT);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Particles
        var i, p;
        for (i = 0; i < particles.length; i++) {
            p = particles[i];
            var alpha = 1 - p.t / p.life;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // AI paddle
        drawPaddle(aiX, aiY, '#ff5555', '#ff2222');

        // Player paddle
        drawPaddle(playerX, playerY, '#4488ff', '#2266ff');

        // Puck shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(puck.x + 4, puck.y + 6, PUCK_R, PUCK_R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Puck
        ctx.save();
        ctx.shadowColor = '#aaddff';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aaccdd';
        ctx.beginPath();
        ctx.arc(puck.x - 5, puck.y - 5, PUCK_R * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // HUD - lives top-left
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        for (i = 0; i < 3; i++) {
            ctx.fillStyle = (i < lives) ? '#ff3333' : '#442222';
            ctx.fillText((i < lives) ? '♥' : '♡', 14 + i * 28, 44);
        }

        // Score top-right
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 14, 44);

        // Goal scores top/bottom of field
        ctx.fillStyle = '#ff5555';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(aiGoals, VW / 2, GOAL_TOP + 40);
        ctx.fillStyle = '#4488ff';
        ctx.fillText(playerGoals, VW / 2, GOAL_BOT - 14);
        ctx.textAlign = 'left';

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.70)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 24;
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 14);
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 36);
            ctx.fillStyle = '#aaffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
            ctx.textAlign = 'left';
        }
    }

    function tap(x, y) {
        if (state === 'MENU') { startGame(); return; }
        if (state === 'DEAD') { startGame(); return; }
        if (state !== 'PLAYING') return;
        // Move player paddle - clamped to bottom half
        playerX = clamp(x, PADDLE_R, VW - PADDLE_R);
        playerY = clamp(y, VH / 2 + 20, VH - 50);
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        pulseT = 0;
        particles = [];
        playerX = VW / 2;
        playerY = PLAYER_Y;
        aiX = VW / 2;
        aiY = AI_Y;
        resetPuck(true);
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
