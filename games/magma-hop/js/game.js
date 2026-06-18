'use strict';
var MagmaHop = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score = 0;
    var lives = 3;

    // Frogger layout
    var CELL_W = 50;   // frog hop unit
    var CELL_H = 80;   // lane height
    var FROG_R = 18;
    var NUM_LANES = 7;
    // y positions for each row (row 0 = bottom safe, rows 1-6 = traffic/water, row 7 = top safe)
    // bottom safe zone: y = VH - 80, top safe zone: y = 60
    var BOTTOM_SAFE_Y = VH - 80;
    var TOP_SAFE_Y = 80;
    var LANE_HEIGHT = (BOTTOM_SAFE_Y - TOP_SAFE_Y) / NUM_LANES; // ~98px per lane

    function laneY(lane) { // lane 0=bottom near frog start, 6=top near goal
        return BOTTOM_SAFE_Y - lane * LANE_HEIGHT;
    }

    // Frog position
    var frogX, frogY;
    var frogTargetX, frogTargetY;
    var frogLane; // 0-7 (0=bottom safe, 7=top goal)
    var frogRiding; // reference to log frog is riding, or null
    var frogAlive;
    var frogAnimT; // 0-1 hop animation

    // Lanes configuration
    var lanes; // array of lane objects

    // Timer
    var crossTimer;
    var CROSS_TIME = 20;
    var deathFlash;
    var winFlash;
    var particles;
    var tick;

    function makeLanes() {
        lanes = [];
        var i;
        // Lanes 1-3: roads (cars)
        var carColors = ['#e63030', '#e68a00', '#2080d0', '#30b030', '#cc22cc'];
        for (i = 0; i < 3; i++) {
            var dir = (i % 2 === 0) ? 1 : -1;
            var spd = 80 + i * 40 + score * 5;
            var objs = [];
            var nx = 0;
            while (nx < VW + 200) {
                var w = 70 + Math.floor(Math.random() * 40);
                var gap = 100 + Math.floor(Math.random() * 100);
                var startX = dir > 0 ? nx - 200 : VW - nx + 200;
                objs.push({x: startX, w: w, h: 32, color: carColors[Math.floor(Math.random() * carColors.length)]});
                nx += w + gap;
            }
            lanes.push({type: 'road', lane: i + 1, dir: dir, spd: spd, objs: objs});
        }
        // Lanes 4-6: water + logs
        for (i = 0; i < 3; i++) {
            var dir2 = (i % 2 === 0) ? -1 : 1;
            var spd2 = 45 + i * 20;
            var logs = [];
            var nx2 = 0;
            while (nx2 < VW + 300) {
                var lw = 90 + Math.floor(Math.random() * 60);
                var gap2 = 80 + Math.floor(Math.random() * 80);
                var startX2 = dir2 > 0 ? nx2 - 200 : VW - nx2 + 200;
                logs.push({x: startX2, w: lw, h: 24, color: '#7a4a1a'});
                nx2 += lw + gap2;
            }
            lanes.push({type: 'water', lane: i + 4, dir: dir2, spd: spd2, objs: logs});
        }
    }

    function startGame() {
        score = 0;
        lives = 3;
        tick = 0;
        crossTimer = CROSS_TIME;
        deathFlash = 0;
        winFlash = 0;
        particles = [];
        frogRiding = null;
        frogAlive = true;
        makeLanes();
        frogLane = 0;
        frogX = VW / 2;
        frogY = laneY(0);
        frogTargetX = frogX;
        frogTargetY = frogY;
        frogAnimT = 1;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnParticles(x, y, color) {
        for (var i = 0; i < 8; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = 60 + Math.random() * 120;
            particles.push({x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 4 + Math.random() * 4, life: 1, color: color});
        }
    }

    function loseLane() {
        lives--;
        try { Audio.play('crash'); } catch (e) {}
        deathFlash = 0.5;
        if (lives <= 0) {
            try { Audio.play('lose'); } catch (e) {}
        }
        spawnParticles(frogX, frogY, '#ff4400');
        frogLane = 0;
        frogX = VW / 2;
        frogY = laneY(0);
        frogTargetX = frogX;
        frogTargetY = frogY;
        frogRiding = null;
        crossTimer = CROSS_TIME;
    }

    function update(dt) {
        if (state !== 'PLAYING') return;
        tick += dt;

        if (deathFlash > 0) {
            deathFlash -= dt;
            if (deathFlash <= 0 && lives <= 0) {
                state = 'DEAD';
                if (score > best) best = score;
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
            }
        }
        if (winFlash > 0) { winFlash -= dt; }

        // Animate frog toward target
        if (frogAnimT < 1) {
            frogAnimT = Math.min(1, frogAnimT + dt * 8);
        }

        // Move lane objects
        var i, j, obj, lane;
        for (i = 0; i < lanes.length; i++) {
            lane = lanes[i];
            var speedScale = 1 + score * 0.04;
            for (j = 0; j < lane.objs.length; j++) {
                obj = lane.objs[j];
                obj.x += lane.dir * lane.spd * speedScale * dt;
                // Wrap around
                if (lane.dir > 0 && obj.x > VW + 20) obj.x = -obj.w - 20;
                if (lane.dir < 0 && obj.x + obj.w < -20) obj.x = VW + 20;
            }
        }

        // If frog is on a log, move with it
        if (frogRiding) {
            var ridingLane = null;
            for (i = 0; i < lanes.length; i++) {
                if (lanes[i].type === 'water' && lanes[i].lane === frogLane) {
                    ridingLane = lanes[i];
                    break;
                }
            }
            if (ridingLane) {
                var speedScale2 = 1 + score * 0.04;
                frogX += ridingLane.dir * ridingLane.spd * speedScale2 * dt;
                frogTargetX = frogX;
            }
        }

        // Clamp timer
        if (deathFlash <= 0 && winFlash <= 0) {
            crossTimer -= dt;
            if (crossTimer <= 0) {
                loseLane();
                return;
            }
        }

        // Only check collisions if frog animation is done
        if (frogAnimT < 1) return;

        // Check frog in water lane with no log
        if (frogLane >= 4 && frogLane <= 6) {
            var fy = laneY(frogLane);
            var onLog = false;
            for (i = 0; i < lanes.length; i++) {
                if (lanes[i].lane === frogLane) {
                    for (j = 0; j < lanes[i].objs.length; j++) {
                        obj = lanes[i].objs[j];
                        if (frogX + FROG_R * 0.7 > obj.x && frogX - FROG_R * 0.7 < obj.x + obj.w) {
                            onLog = true;
                            frogRiding = obj;
                            break;
                        }
                    }
                }
                if (onLog) break;
            }
            if (!onLog) {
                frogRiding = null;
                loseLane();
                return;
            }
        } else {
            frogRiding = null;
        }

        // Check frog vs cars
        if (frogLane >= 1 && frogLane <= 3) {
            for (i = 0; i < lanes.length; i++) {
                if (lanes[i].lane === frogLane) {
                    for (j = 0; j < lanes[i].objs.length; j++) {
                        obj = lanes[i].objs[j];
                        var ly = laneY(frogLane);
                        if (frogX + FROG_R * 0.8 > obj.x && frogX - FROG_R * 0.8 < obj.x + obj.w &&
                            Math.abs(frogY - ly) < FROG_R + 10) {
                            loseLane();
                            return;
                        }
                    }
                }
            }
        }

        // Check frog off left/right (while riding log)
        if (frogX < -FROG_R || frogX > VW + FROG_R) {
            loseLane();
            return;
        }
    }

    function drawLanes() {
        var i, j, obj, lane;
        for (i = 0; i < lanes.length; i++) {
            lane = lanes[i];
            var y = laneY(lane.lane) - LANE_HEIGHT / 2;
            if (lane.type === 'water') {
                ctx.fillStyle = '#003399';
                ctx.fillRect(0, y - LANE_HEIGHT / 2, VW, LANE_HEIGHT);
                // ripple lines
                ctx.strokeStyle = '#0044bb';
                ctx.lineWidth = 1;
                for (var wy = y - LANE_HEIGHT / 2 + 8; wy < y + LANE_HEIGHT / 2; wy += 12) {
                    ctx.beginPath();
                    ctx.moveTo(0, wy + Math.sin(tick * 2 + wy * 0.1) * 3);
                    ctx.lineTo(VW, wy + Math.sin(tick * 2 + wy * 0.1 + 2) * 3);
                    ctx.stroke();
                }
            } else {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, y - LANE_HEIGHT / 2, VW, LANE_HEIGHT);
                // road markings
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 2;
                ctx.setLineDash([20, 20]);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(VW, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Draw objects
            for (j = 0; j < lane.objs.length; j++) {
                obj = lane.objs[j];
                var oy = laneY(lane.lane);
                if (lane.type === 'road') {
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(obj.x, oy - obj.h / 2, obj.w, obj.h);
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.fillRect(obj.x + 4, oy - obj.h / 2 + 4, obj.w - 8, 8);
                    // wheels
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    ctx.arc(obj.x + 12, oy + obj.h / 2 - 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(obj.x + obj.w - 12, oy + obj.h / 2 - 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(obj.x, oy - obj.h / 2, obj.w, obj.h);
                    ctx.fillStyle = '#9a6a2a';
                    for (var wx = obj.x + 8; wx < obj.x + obj.w - 8; wx += 20) {
                        ctx.fillRect(wx, oy - obj.h / 2 + 3, 12, obj.h - 6);
                    }
                }
            }
        }
    }

    function drawSafeZones() {
        ctx.fillStyle = '#1a3a10';
        ctx.fillRect(0, BOTTOM_SAFE_Y - LANE_HEIGHT / 2, VW, LANE_HEIGHT);
        ctx.fillStyle = '#2a5a18';
        ctx.fillRect(0, TOP_SAFE_Y - LANE_HEIGHT / 2, VW, LANE_HEIGHT);
    }

    function drawHomeText() {
        // Drawn after lanes so the top water lane never covers it.
        ctx.fillStyle = '#2a5a18';
        ctx.fillRect(0, TOP_SAFE_Y - LANE_HEIGHT / 2, VW, LANE_HEIGHT);
        ctx.fillStyle = '#55ee33';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HOME', VW / 2, TOP_SAFE_Y);
        ctx.textBaseline = 'alphabetic';
    }

    function drawFrog() {
        ctx.save();
        ctx.shadowColor = '#33ff33';
        ctx.shadowBlur = 12;
        // Frog body
        ctx.fillStyle = '#22cc22';
        ctx.beginPath();
        ctx.arc(frogX, frogY, FROG_R, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(frogX - 6, frogY - 5, 6, 0, Math.PI * 2);
        ctx.arc(frogX + 6, frogY - 5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(frogX - 6, frogY - 5, 3, 0, Math.PI * 2);
        ctx.arc(frogX + 6, frogY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawHUD() {
        ctx.save();
        ctx.textBaseline = 'top';
        // Lives top-left
        var heartsStr = '';
        for (var i = 0; i < 3; i++) heartsStr += (i < lives) ? '♥' : '♡';
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
        // Timer bar
        ctx.shadowBlur = 0;
        var timerFrac = Math.max(0, crossTimer / CROSS_TIME);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, VH - 8, VW, 8);
        ctx.fillStyle = timerFrac > 0.4 ? '#00cc66' : '#ff4400';
        ctx.fillRect(0, VH - 8, VW * timerFrac, 8);
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#33ff33';
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 52px sans-serif';
            ctx.fillText('FROG', VW / 2, VH / 2 - 80);
            ctx.fillText('CROSS', VW / 2, VH / 2 - 14);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 58);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 108);
            }
            ctx.fillStyle = '#556655';
            ctx.font = '16px sans-serif';
            ctx.fillText('Tap near frog to hop. Reach the top!', VW / 2, VH / 2 + 155);
            ctx.restore();
            return;
        }

        drawSafeZones();
        drawLanes();
        drawHomeText();
        drawFrog();

        // Particles
        ctx.save();
        for (var pi = 0; pi < particles.length; pi++) {
            var p = particles[pi];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        drawHUD();

        if (winFlash > 0) {
            ctx.save();
            ctx.globalAlpha = winFlash * 0.5;
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }
        if (deathFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (deathFlash / 0.5) * 0.4;
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }

        if (state === 'DEAD') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ff4400';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 26;
            ctx.font = 'bold 52px sans-serif';
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 90);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 20);
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 10;
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 34);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaffaa';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
            ctx.restore();
        }

        // Update particles
        for (var pi2 = particles.length - 1; pi2 >= 0; pi2--) {
            var pp = particles[pi2];
            pp.x += pp.vx * (1 / 60);
            pp.y += pp.vy * (1 / 60);
            pp.vy += 300 * (1 / 60);
            pp.life -= (1 / 60) * 2;
            if (pp.life <= 0) particles.splice(pi2, 1);
        }
    }

    function tap(x, y) {
        try { Audio.play('tap'); } catch (e) {}
        if (state === 'MENU') { startGame(); return; }
        if (state === 'DEAD') { startGame(); return; }
        if (state !== 'PLAYING') return;
        if (deathFlash > 0) return;

        var dx = x - frogX;
        var dy = y - frogY;
        var newLane = frogLane;
        var newX = frogX;

        if (Math.abs(dy) >= Math.abs(dx)) {
            if (dy < 0) newLane = Math.min(7, frogLane + 1);
            else newLane = Math.max(0, frogLane - 1);
        } else {
            if (dx < 0) newX = Math.max(FROG_R, frogX - CELL_W);
            else newX = Math.min(VW - FROG_R, frogX + CELL_W);
        }

        frogLane = newLane;
        frogX = newX;
        frogY = laneY(frogLane);
        frogTargetX = frogX;
        frogTargetY = frogY;
        frogRiding = null;
        frogAnimT = 0;

        // Reached top safe zone
        if (frogLane >= 7) {
            score += 10;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch (e) {}
            winFlash = 0.4;
            spawnParticles(frogX, frogY, '#33ff33');
            frogLane = 0;
            frogX = VW / 2;
            frogY = laneY(0);
            frogTargetX = frogX;
            frogTargetY = frogY;
            frogRiding = null;
            crossTimer = CROSS_TIME;
            // Rebuild lanes at new speed
            makeLanes();
        }
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
        lanes = [];
        tick = 0;
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
