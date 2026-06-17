'use strict';
var LaserMaze = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score = 0;
    var level = 0;
    var playerX, playerY;
    var playerTargetX, playerTargetY;
    var playerR = 14;
    var lasers;
    var gridAlpha = 0;
    var deathFlash = 0;
    var winFlash = 0;
    var time = 0;

    /* Exit zone: green bar at top of play area */
    var EXIT_TOP = 60;
    var EXIT_H = 50;

    /* Player safe zone Y min (can't go above exit zone or below bottom bar) */
    var PLAY_TOP = EXIT_TOP + EXIT_H + 20;
    var PLAY_BOTTOM = VH - 60;

    /* Level definitions: each laser has type, base angle/pos, amplitude, speed, width */
    /* Types: 'sweep_h' = horizontal sweeping laser (rotates around center point)     */
    /*        'sweep_v' = vertical translate (moves left/right)                       */
    /*        'rotate'  = laser anchored at a wall edge, sweeps angle               */
    function buildLevels() {
        return [
            /* level 1 – 2 slow sweeping lasers */
            [
                { type: 'rotate', ax: 0, ay: 420, ang: 0.2, amp: 0.5, spd: 0.5, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 550, ang: Math.PI - 0.2, amp: 0.5, spd: 0.5, w: 3, phase: Math.PI }
            ],
            /* level 2 */
            [
                { type: 'rotate', ax: 0, ay: 380, ang: 0.3, amp: 0.6, spd: 0.7, w: 3, phase: 0 },
                { type: 'translate', bx: 195, by: 300, ang: 0, amp: 140, spd: 0.8, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 560, ang: Math.PI - 0.3, amp: 0.5, spd: 0.65, w: 3, phase: 1.5 }
            ],
            /* level 3 */
            [
                { type: 'rotate', ax: 0, ay: 360, ang: 0.3, amp: 0.7, spd: 0.9, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 520, ang: Math.PI - 0.3, amp: 0.7, spd: 0.85, w: 3, phase: Math.PI * 0.5 },
                { type: 'translate', bx: 195, by: 440, ang: 0, amp: 160, spd: 1.0, w: 3, phase: 2.0 }
            ],
            /* level 4 */
            [
                { type: 'rotate', ax: 0, ay: 350, ang: 0.4, amp: 0.7, spd: 1.1, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 500, ang: Math.PI - 0.4, amp: 0.7, spd: 1.05, w: 3, phase: 1.0 },
                { type: 'translate', bx: 195, by: 380, ang: 0, amp: 155, spd: 1.2, w: 3, phase: 2.5 },
                { type: 'translate', bx: 195, by: 550, ang: 0, amp: 120, spd: 1.0, w: 4, phase: 0.7 }
            ],
            /* level 5 */
            [
                { type: 'rotate', ax: 0, ay: 340, ang: 0.4, amp: 0.8, spd: 1.3, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 480, ang: Math.PI - 0.4, amp: 0.8, spd: 1.25, w: 3, phase: 1.0 },
                { type: 'translate', bx: 195, by: 600, ang: 0, amp: 170, spd: 1.4, w: 3, phase: 0 },
                { type: 'rotate', ax: VW / 2, ay: VH, ang: -Math.PI / 2, amp: 0.55, spd: 1.1, w: 3, phase: 2.0 }
            ],
            /* level 6 */
            [
                { type: 'rotate', ax: 0, ay: 330, ang: 0.5, amp: 0.8, spd: 1.5, w: 3, phase: 0 },
                { type: 'rotate', ax: VW, ay: 470, ang: Math.PI - 0.5, amp: 0.8, spd: 1.45, w: 3, phase: 1.1 },
                { type: 'translate', bx: 195, by: 580, ang: 0, amp: 160, spd: 1.6, w: 3, phase: 0.5 },
                { type: 'rotate', ax: VW / 2, ay: VH, ang: -Math.PI / 2, amp: 0.6, spd: 1.2, w: 4, phase: 1.8 },
                { type: 'translate', bx: 195, by: 420, ang: 0, amp: 130, spd: 1.5, w: 3, phase: 3.0 }
            ],
            /* level 7 */
            [
                { type: 'rotate', ax: 0, ay: 320, ang: 0.5, amp: 0.85, spd: 1.7, w: 4, phase: 0 },
                { type: 'rotate', ax: VW, ay: 460, ang: Math.PI - 0.5, amp: 0.85, spd: 1.65, w: 4, phase: 1.2 },
                { type: 'translate', bx: 195, by: 570, ang: 0, amp: 165, spd: 1.8, w: 3, phase: 0.3 },
                { type: 'rotate', ax: VW / 2, ay: 0, ang: Math.PI / 2, amp: 0.65, spd: 1.3, w: 3, phase: 2.2 },
                { type: 'translate', bx: 195, by: 410, ang: 0, amp: 140, spd: 1.7, w: 4, phase: 2.8 }
            ],
            /* level 8 */
            [
                { type: 'rotate', ax: 0, ay: 310, ang: 0.55, amp: 0.85, spd: 1.9, w: 4, phase: 0 },
                { type: 'rotate', ax: VW, ay: 450, ang: Math.PI - 0.55, amp: 0.85, spd: 1.85, w: 4, phase: 1.3 },
                { type: 'translate', bx: 195, by: 560, ang: 0, amp: 165, spd: 2.0, w: 4, phase: 0.2 },
                { type: 'rotate', ax: VW / 2, ay: 0, ang: Math.PI / 2, amp: 0.7, spd: 1.5, w: 3, phase: 2.4 },
                { type: 'translate', bx: 195, by: 400, ang: 0, amp: 145, spd: 1.9, w: 4, phase: 2.6 }
            ],
            /* level 9 */
            [
                { type: 'rotate', ax: 0, ay: 300, ang: 0.6, amp: 0.9, spd: 2.1, w: 4, phase: 0 },
                { type: 'rotate', ax: VW, ay: 440, ang: Math.PI - 0.6, amp: 0.9, spd: 2.05, w: 4, phase: 1.4 },
                { type: 'translate', bx: 195, by: 550, ang: 0, amp: 165, spd: 2.2, w: 4, phase: 0.1 },
                { type: 'rotate', ax: VW / 2, ay: 0, ang: Math.PI / 2, amp: 0.75, spd: 1.7, w: 4, phase: 2.5 },
                { type: 'translate', bx: 195, by: 680, ang: 0, amp: 150, spd: 2.0, w: 4, phase: 2.3 }
            ],
            /* level 10 */
            [
                { type: 'rotate', ax: 0, ay: 290, ang: 0.65, amp: 0.92, spd: 2.4, w: 4, phase: 0 },
                { type: 'rotate', ax: VW, ay: 430, ang: Math.PI - 0.65, amp: 0.92, spd: 2.35, w: 4, phase: 1.5 },
                { type: 'translate', bx: 195, by: 540, ang: 0, amp: 165, spd: 2.5, w: 4, phase: 0 },
                { type: 'rotate', ax: VW / 2, ay: 0, ang: Math.PI / 2, amp: 0.8, spd: 1.9, w: 4, phase: 2.6 },
                { type: 'translate', bx: 195, by: 670, ang: 0, amp: 155, spd: 2.3, w: 5, phase: 2.0 }
            ]
        ];
    }

    var allLevels;

    /* Compute the live laser segment for a given laser def at time t */
    function getLaserSegment(laser, t) {
        var x1, y1, x2, y2;
        var reach = 800; /* long enough to cross canvas */

        if (laser.type === 'rotate') {
            var ang = laser.ang + Math.sin(t * laser.spd * Math.PI * 2 + laser.phase) * laser.amp;
            x1 = laser.ax;
            y1 = laser.ay;
            x2 = laser.ax + Math.cos(ang) * reach;
            y2 = laser.ay + Math.sin(ang) * reach;
        } else {
            /* translate: laser is a full-width horizontal line that moves up/down */
            var offset = Math.sin(t * laser.spd * Math.PI * 2 + laser.phase) * laser.amp;
            var cx = laser.bx + offset;
            x1 = cx - reach;
            y1 = laser.by;
            x2 = cx + reach;
            y2 = laser.by;
        }

        return { x1: x1, y1: y1, x2: x2, y2: y2 };
    }

    /* Point-to-segment distance squared */
    function ptSegDistSq(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq === 0) {
            var ex = px - ax, ey = py - ay;
            return ex * ex + ey * ey;
        }
        var t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        if (t < 0) { t = 0; }
        if (t > 1) { t = 1; }
        var nx = ax + t * dx - px;
        var ny = ay + t * dy - py;
        return nx * nx + ny * ny;
    }

    /* Check collision: player circle vs laser segment */
    function checkCollision(laser, t) {
        var seg = getLaserSegment(laser, t);
        var dSq = ptSegDistSq(playerX, playerY, seg.x1, seg.y1, seg.x2, seg.y2);
        return dSq < (playerR + laser.w) * (playerR + laser.w);
    }

    /* Build laser list for current level (loops after level 10) */
    function loadLevel() {
        var idx = (level - 1) % allLevels.length;
        var defs = allLevels[idx];
        lasers = [];
        for (var i = 0; i < defs.length; i++) {
            lasers.push({
                type: defs[i].type,
                ax: defs[i].ax,
                ay: defs[i].ay,
                bx: defs[i].bx,
                by: defs[i].by,
                ang: defs[i].ang,
                amp: defs[i].amp,
                spd: defs[i].spd,
                w: defs[i].w,
                phase: defs[i].phase
            });
        }
    }

    function startGame() {
        score = 0;
        level = 1;
        time = 0;
        playerX = VW / 2;
        playerY = VH - 120;
        playerTargetX = VW / 2;
        playerTargetY = VH - 120;
        deathFlash = 0;
        winFlash = 0;
        allLevels = buildLevels();
        loadLevel();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function killPlayer() {
        state = 'DEAD';
        deathFlash = 0.5;
        if (score > best) { best = score; }
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    }

    function advanceLevel() {
        score += 1;
        if (score > best) { best = score; }
        level += 1;
        winFlash = 0.4;
        playerX = VW / 2;
        playerY = VH - 120;
        playerTargetX = VW / 2;
        playerTargetY = VH - 120;
        time = 0;
        allLevels = buildLevels();
        loadLevel();
        try { Audio.play('gem'); } catch (e) {}
    }

    function update(dt) {
        if (state !== 'PLAYING') { return; }

        time += dt;

        /* Smooth player movement toward tap target */
        var mdx = playerTargetX - playerX;
        var mdy = playerTargetY - playerY;
        var spd = 400 * dt;
        var dist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (dist < spd || dist < 1) {
            playerX = playerTargetX;
            playerY = playerTargetY;
        } else {
            playerX += (mdx / dist) * spd;
            playerY += (mdy / dist) * spd;
        }

        /* Clamp player to play area */
        if (playerX < playerR) { playerX = playerR; }
        if (playerX > VW - playerR) { playerX = VW - playerR; }
        if (playerY < PLAY_TOP + playerR) { playerY = PLAY_TOP + playerR; }
        if (playerY > PLAY_BOTTOM - playerR) { playerY = PLAY_BOTTOM - playerR; }

        /* Also clamp target */
        if (playerTargetX < playerR) { playerTargetX = playerR; }
        if (playerTargetX > VW - playerR) { playerTargetX = VW - playerR; }
        if (playerTargetY < PLAY_TOP + playerR) { playerTargetY = PLAY_TOP + playerR; }
        if (playerTargetY > PLAY_BOTTOM - playerR) { playerTargetY = PLAY_BOTTOM - playerR; }

        /* Check laser collisions */
        for (var i = 0; i < lasers.length; i++) {
            if (checkCollision(lasers[i], time)) {
                killPlayer();
                return;
            }
        }

        /* Check if player reached exit zone */
        if (playerY - playerR <= EXIT_TOP + EXIT_H) {
            advanceLevel();
        }

        if (deathFlash > 0) { deathFlash -= dt; }
        if (winFlash > 0) { winFlash -= dt; }
    }

    /* Draw subtle grid lines */
    function drawGrid() {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        var step = 40;
        for (var x = 0; x < VW; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, VH);
            ctx.stroke();
        }
        for (var y = 0; y < VH; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(VW, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /* Draw the exit zone (green glowing bar at top) */
    function drawExit() {
        ctx.save();
        var grad = ctx.createLinearGradient(0, EXIT_TOP, 0, EXIT_TOP + EXIT_H);
        grad.addColorStop(0, 'rgba(0,255,80,0.55)');
        grad.addColorStop(1, 'rgba(0,255,80,0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, EXIT_TOP, VW, EXIT_H);

        ctx.strokeStyle = '#00ff55';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff55';
        ctx.shadowBlur = 16;
        ctx.strokeRect(1, EXIT_TOP, VW - 2, EXIT_H);

        ctx.fillStyle = '#00ff99';
        ctx.shadowColor = '#00ff99';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', VW / 2, EXIT_TOP + EXIT_H / 2 + 7);
        ctx.restore();
    }

    /* Draw a single laser beam with glow */
    function drawLaser(laser, t) {
        var seg = getLaserSegment(laser, t);

        ctx.save();
        /* Outer glow */
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.lineWidth = laser.w + 10;
        ctx.strokeStyle = 'rgba(255,0,0,0.12)';
        ctx.shadowBlur = 0;
        ctx.stroke();

        /* Mid glow */
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.lineWidth = laser.w + 4;
        ctx.strokeStyle = 'rgba(255,60,0,0.35)';
        ctx.stroke();

        /* Core laser */
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.lineWidth = laser.w;
        ctx.strokeStyle = '#ff2200';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 20;
        ctx.stroke();

        /* Bright white center */
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.lineWidth = Math.max(1, laser.w - 2);
        ctx.strokeStyle = 'rgba(255,200,200,0.9)';
        ctx.shadowBlur = 0;
        ctx.stroke();

        ctx.restore();
    }

    /* Draw the player dot */
    function drawPlayer() {
        ctx.save();
        /* Outer glow */
        ctx.beginPath();
        ctx.arc(playerX, playerY, playerR + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();

        /* Mid glow */
        ctx.beginPath();
        ctx.arc(playerX, playerY, playerR + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();

        /* Core */
        ctx.beginPath();
        ctx.arc(playerX, playerY, playerR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#aaffff';
        ctx.shadowBlur = 18;
        ctx.fill();

        /* Inner bright dot */
        ctx.beginPath();
        ctx.arc(playerX, playerY, playerR * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ccffff';
        ctx.shadowBlur = 6;
        ctx.fill();

        ctx.restore();
    }

    /* Draw HUD: level and score */
    function drawHUD() {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#00ffaa';
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 22px monospace';
        ctx.fillText('LVL ' + level, 16, 42);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#aaffff';
        ctx.fillText('SCORE ' + score, VW - 16, 42);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function draw() {
        if (!ctx) { return; }

        /* Background */
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, VW, VH);

        drawGrid();

        if (state === 'MENU') {
            /* Title */
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff2200';
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 30;
            ctx.font = 'bold 54px monospace';
            ctx.fillText('LASER', VW / 2, VH / 2 - 80);
            ctx.fillText('MAZE', VW / 2, VH / 2 - 16);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#aaffff';
            ctx.shadowBlur = 12;
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            ctx.shadowBlur = 0;

            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px monospace';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 110);
            }

            ctx.fillStyle = '#555577';
            ctx.font = '18px monospace';
            ctx.fillText('Reach the exit. Avoid lasers.', VW / 2, VH / 2 + 160);
            ctx.restore();
            return;
        }

        /* Exit zone */
        drawExit();

        /* Lasers */
        for (var i = 0; i < lasers.length; i++) {
            drawLaser(lasers[i], time);
        }

        /* Player */
        drawPlayer();

        /* HUD */
        drawHUD();

        /* Win flash */
        if (winFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (winFlash / 0.4) * 0.3;
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }

        /* Death flash */
        if (deathFlash > 0 && state === 'DEAD') {
            ctx.save();
            ctx.globalAlpha = (deathFlash / 0.5) * 0.5;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }

        /* DEAD overlay */
        if (state === 'DEAD') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.70)';
            ctx.fillRect(0, 0, VW, VH);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff2200';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 56px monospace';
            ctx.fillText('ZAPPED', VW / 2, VH / 2 - 90);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px monospace';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 20);

            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 10;
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 30);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#00ffaa';
            ctx.shadowColor = '#00ffaa';
            ctx.shadowBlur = 12;
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    function tap(x, y) {
        if (state === 'MENU') {
            startGame();
        } else if (state === 'DEAD') {
            startGame();
        } else if (state === 'PLAYING') {
            /* Clamp tap target to play area */
            var tx = x;
            var ty = y;
            if (tx < playerR) { tx = playerR; }
            if (tx > VW - playerR) { tx = VW - playerR; }
            if (ty < PLAY_TOP + playerR) { ty = PLAY_TOP + playerR; }
            if (ty > PLAY_BOTTOM - playerR) { ty = PLAY_BOTTOM - playerR; }
            playerTargetX = tx;
            playerTargetY = ty;
            try { Audio.play('tap'); } catch (e) {}
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
        time = 0;
        score = 0;
        level = 1;
        playerX = VW / 2;
        playerY = VH - 120;
        playerTargetX = VW / 2;
        playerTargetY = VH - 120;
        allLevels = buildLevels();
        lasers = [];
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
