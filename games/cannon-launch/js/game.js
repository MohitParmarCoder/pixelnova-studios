'use strict';
var CannonLaunch = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;

    // Game state
    var score = 0;
    var shotsLeft = 0;
    var TOTAL_SHOTS = 10;
    var gameTime = 0;

    // Cannon
    var CANNON_X = 60;
    var CANNON_Y = 780;
    var cannonAngle = -Math.PI / 4; // angle in radians, negative = upward

    // Ball
    var ball = null; // { x, y, vx, vy, active, trail }
    var GRAVITY = 600;

    // Targets
    var targets = [];
    var NUM_TARGETS = 5;

    // Aim preview
    var aimX = 0;
    var aimY = 0;
    var hasAimPoint = false;

    // Visual
    var clouds = [];
    var explosionParticles = [];
    var scorePopups = [];
    var screenFlash = 0;
    var barrelFlash = 0;

    // Background hills
    var hills = [];

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    function init(c, bestScore) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = bestScore || 0;
        initClouds();
        initHills();
        state = 'MENU';
    }

    function initClouds() {
        clouds = [];
        for (var i = 0; i < 6; i++) {
            clouds.push({
                x: Math.random() * VW,
                y: 60 + Math.random() * 180,
                w: 60 + Math.random() * 80,
                h: 28 + Math.random() * 20,
                spd: 8 + Math.random() * 12,
                alpha: 0.55 + Math.random() * 0.3
            });
        }
    }

    function initHills() {
        hills = [];
        // Far hill
        hills.push({ pts: buildHill(0, VH - 220, VW, 180, 5, 42), color: '#3a5a2a' });
        // Near hill
        hills.push({ pts: buildHill(0, VH - 160, VW, 130, 4, 28), color: '#2e4a1e' });
    }

    function buildHill(startX, startY, width, height, bumps, seed) {
        var pts = [];
        var steps = 32;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var x = startX + t * width;
            var y = startY;
            for (var b = 0; b < bumps; b++) {
                var freq = (b + 1) * 1.3 + seed * 0.05;
                y -= Math.abs(Math.sin(t * Math.PI * freq + seed + b)) * (height / (b + 1.5));
            }
            pts.push({ x: x, y: y });
        }
        return pts;
    }

    function startGame() {
        score = 0;
        shotsLeft = TOTAL_SHOTS;
        gameTime = 0;
        ball = null;
        explosionParticles = [];
        scorePopups = [];
        screenFlash = 0;
        barrelFlash = 0;
        hasAimPoint = false;
        cannonAngle = -Math.PI / 4;
        spawnTargets();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function spawnTargets() {
        targets = [];
        var rightZoneMin = 220;
        var rightZoneMax = 360;
        var yPositions = [160, 280, 400, 520, 640];
        for (var i = 0; i < NUM_TARGETS; i++) {
            var x = rightZoneMin + Math.random() * (rightZoneMax - rightZoneMin);
            var y = yPositions[i] + (Math.random() * 40 - 20);
            targets.push({
                x: x,
                y: y,
                baseY: y,
                r: 38,        // outer ring radius
                hit: false,
                hitTimer: 0,
                bobSpd: 25 + Math.random() * 20,
                bobAmp: 18 + Math.random() * 14,
                bobPhase: Math.random() * Math.PI * 2
            });
        }
    }

    // ---------------------------------------------------------------
    // UPDATE
    // ---------------------------------------------------------------
    function update(dt) {
        if (state === 'MENU') {
            updateClouds(dt);
            return;
        }
        if (state === 'DEAD') {
            updateExplosions(dt);
            updateScorePopups(dt);
            return;
        }

        gameTime += dt;
        updateClouds(dt);
        updateTargets(dt);
        updateBall(dt);
        updateExplosions(dt);
        updateScorePopups(dt);

        if (screenFlash > 0) screenFlash -= dt * 3;
        if (barrelFlash > 0) barrelFlash -= dt * 8;
    }

    function updateClouds(dt) {
        for (var i = 0; i < clouds.length; i++) {
            clouds[i].x += clouds[i].spd * dt;
            if (clouds[i].x > VW + clouds[i].w) {
                clouds[i].x = -clouds[i].w;
                clouds[i].y = 60 + Math.random() * 180;
            }
        }
    }

    function updateTargets(dt) {
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!t.hit) {
                t.y = t.baseY + Math.sin(gameTime * (Math.PI * 2 / t.bobSpd) * t.bobSpd * 0.035 + t.bobPhase) * t.bobAmp;
            } else {
                t.hitTimer += dt;
            }
        }
    }

    function updateBall(dt) {
        if (!ball || !ball.active) return;

        // Save trail point
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 18) ball.trail.shift();

        ball.vy += GRAVITY * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Check screen exit
        if (ball.x > VW + 30 || ball.y > VH + 30 || ball.x < -30) {
            ball.active = false;
            ball = null;
            return;
        }

        // Check target collision
        for (var i = 0; i < targets.length; i++) {
            var tgt = targets[i];
            if (tgt.hit) continue;
            var dx = ball.x - tgt.x;
            var dy = ball.y - tgt.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < tgt.r + 8) {
                // Score based on distance from center
                var pts = 0;
                if (dist < tgt.r * 0.28) {
                    pts = 100;
                } else if (dist < tgt.r * 0.6) {
                    pts = 50;
                } else {
                    pts = 25;
                }
                score += pts;
                if (score > best) best = score;
                tgt.hit = true;
                tgt.hitPts = pts;

                // Particles
                spawnExplosion(ball.x, ball.y, pts);
                scorePopups.push({ x: tgt.x, y: tgt.y - 20, pts: pts, t: 0 });

                try { Audio.play('gem'); } catch (e) {}
                screenFlash = 1;
                ball.active = false;
                ball = null;
                return;
            }
        }
    }

    function spawnExplosion(x, y, pts) {
        var colors = pts === 100 ? ['#FFD700', '#FFA500', '#FF6600', '#fff'] :
                     pts === 50  ? ['#00FFFF', '#0099FF', '#fff'] :
                                   ['#AAFFAA', '#44FF44', '#fff'];
        var count = pts === 100 ? 22 : pts === 50 ? 14 : 8;
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            var spd = 60 + Math.random() * 180;
            explosionParticles.push({
                x: x, y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 30,
                r: 3 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1,
                decay: 1.2 + Math.random() * 0.8
            });
        }
    }

    function updateExplosions(dt) {
        for (var i = explosionParticles.length - 1; i >= 0; i--) {
            var p = explosionParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) explosionParticles.splice(i, 1);
        }
    }

    function updateScorePopups(dt) {
        for (var i = scorePopups.length - 1; i >= 0; i--) {
            scorePopups[i].t += dt;
            scorePopups[i].y -= 40 * dt;
            if (scorePopups[i].t > 1.2) scorePopups.splice(i, 1);
        }
    }

    // ---------------------------------------------------------------
    // TAP
    // ---------------------------------------------------------------
    function tap(x, y) {
        if (state === 'MENU') {
            startGame();
            return;
        }
        if (state === 'DEAD') {
            startGame();
            return;
        }
        if (state !== 'PLAYING') return;

        // If ball in flight, ignore
        if (ball && ball.active) return;

        // Shots used up — end game
        if (shotsLeft <= 0) {
            endGame();
            return;
        }

        // Compute angle from tap position
        var dx = x - CANNON_X;
        var dy = y - CANNON_Y;
        cannonAngle = Math.atan2(dy, dx);

        // Clamp to valid upward range: -75 deg to -5 deg
        var minAngle = -Math.PI * 75 / 180;
        var maxAngle = -Math.PI * 5 / 180;
        if (cannonAngle > maxAngle) cannonAngle = maxAngle;
        if (cannonAngle < minAngle) cannonAngle = minAngle;

        // Fire
        var speed = 520;
        var vx = Math.cos(cannonAngle) * speed;
        var vy = Math.sin(cannonAngle) * speed;

        ball = {
            x: CANNON_X + Math.cos(cannonAngle) * 46,
            y: CANNON_Y + Math.sin(cannonAngle) * 46,
            vx: vx,
            vy: vy,
            active: true,
            trail: []
        };

        hasAimPoint = false;
        shotsLeft--;
        barrelFlash = 1;

        try { Audio.play('tap'); } catch (e) {}

        // If no shots left and no ball, end after ball exits
        // (handled in updateBall)
    }

    function endGame() {
        state = 'DEAD';
        if (score > best) best = score;
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    }

    // ---------------------------------------------------------------
    // DRAW
    // ---------------------------------------------------------------
    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, VW, VH);

        if (state === 'MENU') {
            drawBackground();
            drawMenu();
        } else if (state === 'PLAYING') {
            drawBackground();
            drawTargets();
            drawAimPreview();
            drawBallTrail();
            drawBall();
            drawCannon();
            drawExplosions();
            drawScorePopups();
            drawHUD();
            if (screenFlash > 0) {
                ctx.save();
                ctx.globalAlpha = screenFlash * 0.22;
                ctx.fillStyle = '#FFFF88';
                ctx.fillRect(0, 0, VW, VH);
                ctx.restore();
            }
            // Auto end game when last ball finishes and no shots remain
            if (!ball && shotsLeft <= 0) {
                endGame();
            }
        } else if (state === 'DEAD') {
            drawBackground();
            drawTargets();
            drawExplosions();
            drawScorePopups();
            drawCannon();
            drawDeadOverlay();
        }
    }

    // --- Background ---
    function drawBackground() {
        // Sky gradient: olive/military
        var skyGrad = ctx.createLinearGradient(0, 0, 0, VH * 0.72);
        skyGrad.addColorStop(0, '#5a7a3a');
        skyGrad.addColorStop(0.45, '#8aad5a');
        skyGrad.addColorStop(1, '#a8c878');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, VW, VH);

        // Clouds
        drawClouds();

        // Sun / haze
        ctx.save();
        var sunGrad = ctx.createRadialGradient(VW * 0.72, 90, 0, VW * 0.72, 90, 95);
        sunGrad.addColorStop(0, 'rgba(255,255,200,0.38)');
        sunGrad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(VW * 0.72, 90, 95, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw horizon / ground
        var groundGrad = ctx.createLinearGradient(0, VH - 240, 0, VH);
        groundGrad.addColorStop(0, '#4a6a2a');
        groundGrad.addColorStop(0.3, '#3a5a1a');
        groundGrad.addColorStop(1, '#2a3a10');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, VH - 240, VW, 240);

        // Hills
        for (var h = 0; h < hills.length; h++) {
            var hill = hills[h];
            ctx.save();
            ctx.fillStyle = hill.color;
            ctx.beginPath();
            ctx.moveTo(hill.pts[0].x, VH);
            for (var p = 0; p < hill.pts.length; p++) {
                ctx.lineTo(hill.pts[p].x, hill.pts[p].y);
            }
            ctx.lineTo(hill.pts[hill.pts.length - 1].x, VH);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Ground texture lines
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1;
        for (var gl = 0; gl < 8; gl++) {
            var gy = VH - 30 - gl * 22;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(VW, gy);
            ctx.stroke();
        }
        ctx.restore();

        // Sandbag wall near cannon
        drawSandbags();
    }

    function drawClouds() {
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            ctx.save();
            ctx.globalAlpha = c.alpha;
            ctx.fillStyle = '#e8f0d0';
            drawCloudShape(c.x, c.y, c.w, c.h);
            ctx.restore();
        }
    }

    function drawCloudShape(x, y, w, h) {
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - w * 0.28, y + h * 0.08, w * 0.32, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w * 0.3, y + h * 0.1, w * 0.3, h * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w * 0.1, y - h * 0.18, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawSandbags() {
        // Stacked sandbags behind cannon
        var bx = 20, by = VH - 200;
        ctx.save();
        // Row 3 (top, 2 bags)
        for (var s = 0; s < 2; s++) {
            drawSandbag(bx + s * 38 + 19, by);
        }
        // Row 2 (3 bags)
        for (var s2 = 0; s2 < 3; s2++) {
            drawSandbag(bx + s2 * 38, by + 28);
        }
        // Row 1 (bottom, 4 bags)
        for (var s3 = 0; s3 < 4; s3++) {
            drawSandbag(bx - 19 + s3 * 38, by + 56);
        }
        ctx.restore();
    }

    function drawSandbag(x, y) {
        ctx.fillStyle = '#b8a060';
        ctx.beginPath();
        ctx.ellipse(x, y, 17, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8a7040';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // rope line
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.strokeStyle = '#6a5020';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // --- Cannon ---
    function drawCannon() {
        ctx.save();
        ctx.translate(CANNON_X, CANNON_Y);

        // Wheels
        ctx.fillStyle = '#3a2a10';
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 2;
        // Left wheel
        ctx.beginPath();
        ctx.arc(-18, 22, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Right wheel
        ctx.beginPath();
        ctx.arc(12, 22, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Wheel spokes
        drawWheelSpokes(-18, 22, 18);
        drawWheelSpokes(12, 22, 18);

        // Axle
        ctx.fillStyle = '#5a4020';
        ctx.beginPath();
        ctx.roundRect(-22, 14, 38, 10, 4);
        ctx.fill();
        ctx.strokeStyle = '#2a1808';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Cannon body (rotating with angle)
        ctx.rotate(cannonAngle);

        // Barrel shadow
        ctx.save();
        ctx.translate(2, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.roundRect(0, -12, 68, 24, 8);
        ctx.fill();
        ctx.restore();

        // Barrel
        var barrelGrad = ctx.createLinearGradient(0, -12, 0, 12);
        barrelGrad.addColorStop(0, '#7a7a7a');
        barrelGrad.addColorStop(0.35, '#c8c8c8');
        barrelGrad.addColorStop(0.65, '#b0b0b0');
        barrelGrad.addColorStop(1, '#505050');
        ctx.fillStyle = barrelGrad;
        ctx.beginPath();
        ctx.roundRect(0, -11, 68, 22, 7);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Barrel bands (decorative)
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        for (var b = 0; b < 3; b++) {
            ctx.beginPath();
            ctx.moveTo(14 + b * 16, -11);
            ctx.lineTo(14 + b * 16, 11);
            ctx.stroke();
        }

        // Muzzle
        ctx.fillStyle = '#909090';
        ctx.beginPath();
        ctx.roundRect(58, -13, 14, 26, 5);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Muzzle flash
        if (barrelFlash > 0) {
            ctx.save();
            ctx.globalAlpha = barrelFlash * 0.9;
            var flashGrad = ctx.createRadialGradient(80, 0, 0, 80, 0, 28);
            flashGrad.addColorStop(0, '#FFFFAA');
            flashGrad.addColorStop(0.4, '#FFAA00');
            flashGrad.addColorStop(1, 'rgba(255,80,0,0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(80, 0, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();

        // Cannon base/pivot
        ctx.fillStyle = '#5a4020';
        ctx.beginPath();
        ctx.ellipse(CANNON_X, CANNON_Y, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a1808';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawWheelSpokes(cx, cy, r) {
        ctx.strokeStyle = '#6a4a20';
        ctx.lineWidth = 2;
        for (var s = 0; s < 6; s++) {
            var a = (s / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.stroke();
        }
        ctx.fillStyle = '#8a6030';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Aim Preview ---
    function drawAimPreview() {
        if (ball && ball.active) return;
        if (shotsLeft <= 0) return;

        // Draw dashed trajectory arc
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 180, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        var speed = 520;
        var vx0 = Math.cos(cannonAngle) * speed;
        var vy0 = Math.sin(cannonAngle) * speed;
        var px = CANNON_X + Math.cos(cannonAngle) * 46;
        var py = CANNON_Y + Math.sin(cannonAngle) * 46;
        var step = 0.025;
        var maxT = 2.5;
        var first = true;

        for (var t = 0; t <= maxT; t += step) {
            var sx = px + vx0 * t;
            var sy = py + vy0 * t + 0.5 * GRAVITY * t * t;
            if (sx > VW + 10 || sy > VH + 10) break;
            if (first) { ctx.moveTo(sx, sy); first = false; }
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // --- Ball ---
    function drawBallTrail() {
        if (!ball || !ball.active) return;
        for (var i = 0; i < ball.trail.length; i++) {
            var alpha = (i / ball.trail.length) * 0.5;
            var r = 4 + (i / ball.trail.length) * 4;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(ball.trail[i].x, ball.trail[i].y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawBall() {
        if (!ball || !ball.active) return;

        ctx.save();
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(ball.x + 3, ball.y + 4, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cannonball
        var ballGrad = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 1, ball.x, ball.y, 13);
        ballGrad.addColorStop(0, '#888');
        ballGrad.addColorStop(0.4, '#444');
        ballGrad.addColorStop(1, '#111');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(ball.x - 4, ball.y - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // --- Targets ---
    function drawTargets() {
        for (var i = 0; i < targets.length; i++) {
            drawTarget(targets[i]);
        }
    }

    function drawTarget(t) {
        if (t.hit && t.hitTimer > 0.4) return;

        ctx.save();
        ctx.translate(t.x, t.y);

        var alpha = t.hit ? Math.max(0, 1 - t.hitTimer * 3) : 1;
        ctx.globalAlpha = alpha;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(3, t.r + 6, t.r * 0.7, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Post / stake
        ctx.strokeStyle = '#6a4a1a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, t.r + 2);
        ctx.lineTo(0, t.r + 28);
        ctx.stroke();

        // Outer ring - red
        ctx.fillStyle = '#CC2200';
        ctx.beginPath();
        ctx.arc(0, 0, t.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#801500';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Middle ring - white
        ctx.fillStyle = '#F0F0F0';
        ctx.beginPath();
        ctx.arc(0, 0, t.r * 0.68, 0, Math.PI * 2);
        ctx.fill();

        // Inner ring - red
        ctx.fillStyle = '#DD2200';
        ctx.beginPath();
        ctx.arc(0, 0, t.r * 0.42, 0, Math.PI * 2);
        ctx.fill();

        // Bull's eye - yellow
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, t.r * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(0, 0, t.r * 0.07, 0, Math.PI * 2);
        ctx.fill();

        // Ring lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, t.r * 0.55, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, t.r * 0.3, 0, Math.PI * 2); ctx.stroke();

        ctx.restore();
    }

    // --- Explosions ---
    function drawExplosions() {
        for (var i = 0; i < explosionParticles.length; i++) {
            var p = explosionParticles[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * Math.max(0.2, p.life), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Score Popups ---
    function drawScorePopups() {
        for (var i = 0; i < scorePopups.length; i++) {
            var sp = scorePopups[i];
            var a = Math.max(0, 1 - sp.t / 1.2);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var color = sp.pts === 100 ? '#FFD700' : sp.pts === 50 ? '#00FFFF' : '#AAFFAA';
            ctx.fillStyle = color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.fillText('+' + sp.pts, sp.x, sp.y);
            ctx.restore();
        }
    }

    // --- HUD ---
    function drawHUD() {
        // Score
        ctx.save();
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#AA8800';
        ctx.fillText(score, 16, 16);
        ctx.restore();

        // Shots remaining icons
        var shotIconX = VW - 16;
        var shotIconY = 16;
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = 'rgba(255,255,180,0.9)';
        ctx.fillText('SHOTS', shotIconX, shotIconY);
        ctx.restore();

        for (var s = 0; s < TOTAL_SHOTS; s++) {
            var bx = VW - 16 - (TOTAL_SHOTS - 1 - s) * 16;
            var by = shotIconY + 20;
            ctx.save();
            if (s < shotsLeft) {
                // Remaining - filled cannonball
                ctx.fillStyle = '#444';
                ctx.strokeStyle = '#BBB';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(bx, by + 6, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                // Used - empty circle
                ctx.strokeStyle = 'rgba(180,180,180,0.3)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(bx, by + 6, 6, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Best score
        if (best > 0) {
            ctx.save();
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(255,255,200,0.7)';
            ctx.fillText('BEST ' + best, 16, 52);
            ctx.restore();
        }
    }

    // --- MENU ---
    function drawMenu() {
        ctx.save();

        // Panel
        var panelX = 40, panelY = VH * 0.22, panelW = VW - 80, panelH = 310;
        ctx.fillStyle = 'rgba(20, 40, 10, 0.80)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 18);
        ctx.fill();
        ctx.strokeStyle = '#8aad5a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Title
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title shadow
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = '#2a4a0a';
        ctx.fillText('CANNON', VW / 2 + 3, panelY + 68 + 3);
        ctx.fillText('LAUNCH', VW / 2 + 3, panelY + 118 + 3);

        // Title text
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#AA8800';
        ctx.font = 'bold 48px monospace';
        ctx.fillText('CANNON', VW / 2, panelY + 68);
        ctx.fillText('LAUNCH', VW / 2, panelY + 118);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '16px monospace';
        ctx.fillStyle = '#c8e8a0';
        ctx.fillText('10 SHOTS • HIT THE TARGETS', VW / 2, panelY + 162);

        // Best score
        if (best > 0) {
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('BEST: ' + best, VW / 2, panelY + 198);
        }

        // Tap to play (pulsing)
        var pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#8aad5a';
        ctx.fillText('TAP TO PLAY', VW / 2, panelY + 252);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Cannon icon in menu
        ctx.restore();
        ctx.save();
        ctx.translate(VW / 2, panelY + 330);
        ctx.scale(0.7, 0.7);
        drawMinicannon();
        ctx.restore();

        // How-to-play
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(200,230,160,0.75)';
        ctx.fillText('Tap to aim & fire • Hit bull\'s eye for 100pts', VW / 2, VH - 70);
        ctx.restore();
    }

    function drawMinicannon() {
        // Simplified cannon for menu decoration
        ctx.fillStyle = '#3a2a10';
        ctx.beginPath();
        ctx.arc(-15, 18, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, 18, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(-Math.PI / 5);
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.roundRect(0, -9, 55, 18, 6);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#5a4020';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- DEAD overlay ---
    function drawDeadOverlay() {
        // Darken
        ctx.save();
        ctx.fillStyle = 'rgba(0, 20, 0, 0.72)';
        ctx.fillRect(0, 0, VW, VH);

        // Panel
        var panelX = 40, panelY = VH * 0.22, panelW = VW - 80, panelH = 340;
        ctx.fillStyle = 'rgba(15, 35, 8, 0.92)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 18);
        ctx.fill();
        ctx.strokeStyle = '#8aad5a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // "CEASE FIRE"
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = '#CC3300';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#661100';
        ctx.fillText('CEASE FIRE!', VW / 2, panelY + 58);
        ctx.shadowBlur = 0;

        // Score
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#c8e8a0';
        ctx.fillText('SCORE', VW / 2, panelY + 115);

        ctx.font = 'bold 68px monospace';
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#AA8800';
        ctx.fillText(score, VW / 2, panelY + 178);
        ctx.shadowBlur = 0;

        // Best
        if (score >= best && score > 0) {
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('NEW BEST!', VW / 2, panelY + 228);
        } else {
            ctx.font = '16px monospace';
            ctx.fillStyle = 'rgba(255,255,200,0.65)';
            ctx.fillText('BEST: ' + best, VW / 2, panelY + 228);
        }

        // Tap to retry
        var pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#8aad5a';
        ctx.fillText('TAP TO RETRY', VW / 2, panelY + 285);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    // ---------------------------------------------------------------
    // getBest
    // ---------------------------------------------------------------
    function getBest() {
        return best;
    }

    // ---------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------
    return {
        init: init,
        update: update,
        draw: draw,
        tap: tap,
        getBest: getBest
    };
})();
