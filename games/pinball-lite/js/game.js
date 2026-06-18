'use strict';

var PinballLite = (function () {

    // ── Virtual canvas dimensions ────────────────────────────────────────────
    var VW = 390;
    var VH = 844;

    // ── Canvas / context ─────────────────────────────────────────────────────
    var canvas;
    var ctx;

    // ── State ────────────────────────────────────────────────────────────────
    var STATE_MENU    = 'MENU';
    var STATE_PLAYING = 'PLAYING';
    var STATE_DEAD    = 'DEAD';
    var state = STATE_MENU;

    // ── Scoring / lives ──────────────────────────────────────────────────────
    var score     = 0;
    var bestScore = 0;
    var lives     = 3;

    // ── Physics constants ─────────────────────────────────────────────────────
    var GRAVITY      = 900;   // px / s²
    var BALL_RADIUS  = 10;
    var WALL_LEFT    = 20;
    var WALL_RIGHT   = 370;
    var DRAIN_Y      = 820;

    // ── Ball ─────────────────────────────────────────────────────────────────
    var ball = {
        x: VW / 2,
        y: 80,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS
    };

    // ── Flippers ─────────────────────────────────────────────────────────────
    var FLIPPER_LENGTH = 80;
    var FLIPPER_WIDTH  = 10;
    var FLIPPER_Y      = 780;

    // Left flipper pivots at left end, right flipper at right end
    var leftFlipper = {
        pivotX:   110,
        pivotY:   FLIPPER_Y,
        angle:    0.45,      // radians, positive = tip down (rest)
        active:   false
    };

    var rightFlipper = {
        pivotX:   280,
        pivotY:   FLIPPER_Y,
        angle:    Math.PI - 0.45,  // tip down on right side
        active:   false
    };

    // Flipper angle targets
    var FLIPPER_REST_L  =  0.45;
    var FLIPPER_UP_L    = -0.35;
    var FLIPPER_REST_R  = Math.PI - 0.45;
    var FLIPPER_UP_R    = Math.PI + 0.35;
    var FLIPPER_SPEED   = 14;  // rad / s spring-like

    // ── Bumpers ───────────────────────────────────────────────────────────────
    var BUMPER_RADIUS   = 25;
    var BUMPER_HIT_BOOST = 550;  // extra speed on hit

    var bumpers = [
        { x: 130, y: 320, color: '#00ffff', lit: 0 },
        { x: 260, y: 340, color: '#ff00ff', lit: 0 },
        { x: 195, y: 420, color: '#ffff00', lit: 0 },
        { x: 110, y: 490, color: '#00ff88', lit: 0 },
        { x: 280, y: 480, color: '#ff6600', lit: 0 },
        { x: 195, y: 560, color: '#ff0088', lit: 0 }
    ];

    // ── Particles ─────────────────────────────────────────────────────────────
    var particles = [];
    var MAX_PARTICLES = 120;

    // ── Grid / background ────────────────────────────────────────────────────
    var GRID_SPACING = 40;

    // ── Timing ───────────────────────────────────────────────────────────────
    var totalTime = 0;

    // ── Drain animation ──────────────────────────────────────────────────────
    var drainFlash = 0;   // countdown timer for red flash

    // ═════════════════════════════════════════════════════════════════════════
    //  Helpers
    // ═════════════════════════════════════════════════════════════════════════

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function dist(ax, ay, bx, by) {
        var dx = ax - bx;
        var dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Ball launch
    // ═════════════════════════════════════════════════════════════════════════

    function launchBall() {
        ball.x  = VW / 2;
        ball.y  = 80;
        ball.vx = (Math.random() - 0.5) * 120;
        ball.vy = 200;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Particle system
    // ═════════════════════════════════════════════════════════════════════════

    function spawnParticles(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            if (particles.length >= MAX_PARTICLES) { break; }
            var angle  = Math.random() * Math.PI * 2;
            var speed  = 80 + Math.random() * 180;
            particles.push({
                x:     x,
                y:     y,
                vx:    Math.cos(angle) * speed,
                vy:    Math.sin(angle) * speed,
                life:  0.5 + Math.random() * 0.4,
                maxLife: 0.5 + Math.random() * 0.4,
                r:     2 + Math.random() * 3,
                color: color
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x    += p.vx * dt;
            p.y    += p.vy * dt;
            p.vy   += 200 * dt;   // slight gravity on particles
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Flipper helpers
    // ═════════════════════════════════════════════════════════════════════════

    function updateFlipperAngle(flipper, targetAngle, dt) {
        var diff = targetAngle - flipper.angle;
        var step = FLIPPER_SPEED * dt;
        if (Math.abs(diff) <= step) {
            flipper.angle = targetAngle;
        } else {
            flipper.angle += (diff > 0 ? 1 : -1) * step;
        }
    }

    // Returns the tip position of a flipper
    function flipperTip(flipper) {
        return {
            x: flipper.pivotX + Math.cos(flipper.angle) * FLIPPER_LENGTH,
            y: flipper.pivotY + Math.sin(flipper.angle) * FLIPPER_LENGTH
        };
    }

    // Closest point on segment [ax,ay]->[bx,by] to point [px,py]
    function closestPointOnSegment(ax, ay, bx, by, px, py) {
        var dx = bx - ax;
        var dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq === 0) { return { x: ax, y: ay, t: 0 }; }
        var t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = clamp(t, 0, 1);
        return { x: ax + t * dx, y: ay + t * dy, t: t };
    }

    // Ball vs flipper collision – modifies ball in place, returns true if hit
    function resolveBallFlipper(flipper) {
        var tip = flipperTip(flipper);
        var cp  = closestPointOnSegment(
            flipper.pivotX, flipper.pivotY,
            tip.x, tip.y,
            ball.x, ball.y
        );
        var d = dist(ball.x, ball.y, cp.x, cp.y);
        if (d < ball.radius + FLIPPER_WIDTH / 2) {
            // Push ball out
            var overlap = ball.radius + FLIPPER_WIDTH / 2 - d;
            var nx, ny;
            if (d < 0.0001) {
                nx = 0; ny = -1;
            } else {
                nx = (ball.x - cp.x) / d;
                ny = (ball.y - cp.y) / d;
            }
            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // Reflect velocity with bounce factor
            var dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                var bounceFactor = 0.65;
                // Active flipper gives extra upward kick
                var extraVy = flipper.active ? -280 : 0;
                ball.vx = (ball.vx - 2 * dot * nx) * bounceFactor;
                ball.vy = (ball.vy - 2 * dot * ny) * bounceFactor + extraVy;
            }
            return true;
        }
        return false;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Bumper collision
    // ═════════════════════════════════════════════════════════════════════════

    function resolveBallBumper(bumper) {
        var d = dist(ball.x, ball.y, bumper.x, bumper.y);
        var minDist = ball.radius + BUMPER_RADIUS;
        if (d < minDist) {
            // Push out
            var nx, ny;
            if (d < 0.0001) {
                nx = 0; ny = -1;
            } else {
                nx = (ball.x - bumper.x) / d;
                ny = (ball.y - bumper.y) / d;
            }
            ball.x = bumper.x + nx * minDist;
            ball.y = bumper.y + ny * minDist;

            // Bounce with extra boost
            var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            var newSpeed = Math.max(speed, 200) + BUMPER_HIT_BOOST;
            // Clamp to prevent infinite speed
            if (newSpeed > 900) { newSpeed = 900; }
            ball.vx = nx * newSpeed;
            ball.vy = ny * newSpeed;

            // Score
            score += 100;
            if (score > bestScore) { bestScore = score; }

            // Flash bumper
            bumper.lit = 0.35;

            // Sound
            try { Audio.play('gem'); } catch (e) {}

            // Particles
            spawnParticles(bumper.x, bumper.y, bumper.color, 12);

            return true;
        }
        return false;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Wall collisions
    // ═════════════════════════════════════════════════════════════════════════

    function resolveWalls() {
        // Left wall
        if (ball.x - ball.radius < WALL_LEFT) {
            ball.x  = WALL_LEFT + ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.75;
        }
        // Right wall
        if (ball.x + ball.radius > WALL_RIGHT) {
            ball.x  = WALL_RIGHT - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.75;
        }
        // Top wall
        if (ball.y - ball.radius < 10) {
            ball.y  = 10 + ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.75;
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Drain
    // ═════════════════════════════════════════════════════════════════════════

    function handleDrain() {
        lives -= 1;
        drainFlash = 0.4;
        try { Audio.play('crash'); } catch (e) {}

        if (lives <= 0) {
            lives = 0;
            state = STATE_DEAD;
            try { AdManager.gameplayStop(); } catch (e) {}
            try { AdManager.onRunEnd(); } catch (e) {}
        } else {
            launchBall();
            try { Audio.play('tap'); } catch (e) {}
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Game reset
    // ═════════════════════════════════════════════════════════════════════════

    function resetGame() {
        score     = 0;
        lives     = 3;
        particles = [];
        drainFlash = 0;
        totalTime  = 0;

        // Reset bumper lights
        for (var i = 0; i < bumpers.length; i++) {
            bumpers[i].lit = 0;
        }

        // Reset flippers
        leftFlipper.angle  = FLIPPER_REST_L;
        leftFlipper.active = false;
        rightFlipper.angle = FLIPPER_REST_R;
        rightFlipper.active = false;

        launchBall();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Update
    // ═════════════════════════════════════════════════════════════════════════

    function update(dt) {
        if (state !== STATE_PLAYING) { return; }

        totalTime += dt;
        if (drainFlash > 0) { drainFlash -= dt; }

        // ── Flipper spring ──────────────────────────────────────────────────
        var targetL = leftFlipper.active  ? FLIPPER_UP_L   : FLIPPER_REST_L;
        var targetR = rightFlipper.active ? FLIPPER_UP_R   : FLIPPER_REST_R;
        updateFlipperAngle(leftFlipper,  targetL, dt);
        updateFlipperAngle(rightFlipper, targetR, dt);

        // ── Ball physics (substep for stability) ────────────────────────────
        var SUBSTEPS = 3;
        var subDt = dt / SUBSTEPS;
        for (var step = 0; step < SUBSTEPS; step++) {
            ball.vy += GRAVITY * subDt;

            // Cap speed
            var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (speed > 1000) {
                ball.vx = ball.vx / speed * 1000;
                ball.vy = ball.vy / speed * 1000;
            }

            ball.x += ball.vx * subDt;
            ball.y += ball.vy * subDt;

            resolveWalls();
            resolveBallFlipper(leftFlipper);
            resolveBallFlipper(rightFlipper);

            for (var b = 0; b < bumpers.length; b++) {
                resolveBallBumper(bumpers[b]);
            }
        }

        // ── Bumper light decay ───────────────────────────────────────────────
        for (var bi = 0; bi < bumpers.length; bi++) {
            if (bumpers[bi].lit > 0) {
                bumpers[bi].lit -= dt * 2;
                if (bumpers[bi].lit < 0) { bumpers[bi].lit = 0; }
            }
        }

        // ── Particles ────────────────────────────────────────────────────────
        updateParticles(dt);

        // ── Drain check ──────────────────────────────────────────────────────
        if (ball.y > DRAIN_Y) {
            handleDrain();
        }

    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Draw helpers
    // ═════════════════════════════════════════════════════════════════════════

    function drawBackground() {
        // Solid dark background
        ctx.fillStyle = '#060610';
        ctx.fillRect(0, 0, VW, VH);

        // Neon grid lines
        ctx.strokeStyle = 'rgba(0, 80, 180, 0.25)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (var gx = 0; gx <= VW; gx += GRID_SPACING) {
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, VH);
        }
        for (var gy = 0; gy <= VH; gy += GRID_SPACING) {
            ctx.moveTo(0, gy);
            ctx.lineTo(VW, gy);
        }
        ctx.stroke();

        // Side walls with glow
        ctx.strokeStyle = '#00bfff';
        ctx.lineWidth   = 4;
        ctx.shadowColor = '#00bfff';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(WALL_LEFT,  0);
        ctx.lineTo(WALL_LEFT,  VH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(WALL_RIGHT, 0);
        ctx.lineTo(WALL_RIGHT, VH);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Top wall
        ctx.strokeStyle = '#00bfff';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00bfff';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.moveTo(WALL_LEFT, 10);
        ctx.lineTo(WALL_RIGHT, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Drain gutter line
        ctx.strokeStyle = 'rgba(255,0,60,0.4)';
        ctx.lineWidth   = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(WALL_LEFT,  DRAIN_Y);
        ctx.lineTo(WALL_RIGHT, DRAIN_Y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawHUD() {
        // Score
        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 26px monospace';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('SCORE  ' + score, WALL_LEFT + 8, 18);

        // Lives as small balls
        ctx.fillStyle    = '#ffffff';
        ctx.font         = '16px monospace';
        ctx.textAlign    = 'right';
        ctx.fillText('LIVES', WALL_RIGHT - 8, 18);
        for (var i = 0; i < 3; i++) {
            var lifeX = WALL_RIGHT - 14 - i * 22;
            ctx.beginPath();
            ctx.arc(lifeX, 46, 8, 0, Math.PI * 2);
            if (i < lives) {
                ctx.fillStyle = '#00ffff';
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur  = 10;
            } else {
                ctx.fillStyle = '#222';
                ctx.shadowBlur  = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function drawBumper(bumper) {
        var lit = bumper.lit;

        // Outer glow when lit
        if (lit > 0) {
            ctx.beginPath();
            ctx.arc(bumper.x, bumper.y, BUMPER_RADIUS + 10, 0, Math.PI * 2);
            var grad = ctx.createRadialGradient(
                bumper.x, bumper.y, BUMPER_RADIUS - 5,
                bumper.x, bumper.y, BUMPER_RADIUS + 14
            );
            grad.addColorStop(0, hexToRgba(bumper.color, lit));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            // Simpler: just use shadow
            ctx.shadowColor = bumper.color;
            ctx.shadowBlur  = 28 * lit;
        }

        // Bumper body
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, BUMPER_RADIUS, 0, Math.PI * 2);
        if (lit > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = bumper.color;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Bumper ring
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, BUMPER_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // Inner circle decoration
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, BUMPER_RADIUS * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
    }

    function drawFlipper(flipper, isLeft) {
        var tip = flipperTip(flipper);

        ctx.save();
        ctx.lineCap     = 'round';
        ctx.lineWidth   = FLIPPER_WIDTH;
        ctx.strokeStyle = '#e0e8ff';
        ctx.shadowColor = 'rgba(180,200,255,0.7)';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.moveTo(flipper.pivotX, flipper.pivotY);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Pivot dot
        ctx.beginPath();
        ctx.arc(flipper.pivotX, flipper.pivotY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#aabbdd';
        ctx.fill();
        ctx.restore();
    }

    function drawBall() {
        // Glow
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 6, 0, Math.PI * 2);
        var grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius + 6);
        grad.addColorStop(0,   'rgba(255,255,255,0.4)');
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Ball body
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        var ballGrad = ctx.createRadialGradient(
            ball.x - 3, ball.y - 3, 1,
            ball.x, ball.y, ball.radius
        );
        ballGrad.addColorStop(0,   '#ffffff');
        ballGrad.addColorStop(0.5, '#c0d0e8');
        ballGrad.addColorStop(1,   '#7090b0');
        ctx.fillStyle = ballGrad;
        ctx.fill();
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p   = particles[i];
            var t   = p.life / p.maxLife;
            var alpha = t;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawDrainFlash() {
        if (drainFlash > 0) {
            var alpha = drainFlash / 0.4 * 0.35;
            ctx.fillStyle = 'rgba(255,0,0,' + alpha + ')';
            ctx.fillRect(0, 0, VW, VH);
        }
    }

    // ── Title glow text helper ───────────────────────────────────────────────
    function drawGlowText(text, x, y, size, color, glowColor, glowBlur) {
        ctx.font         = 'bold ' + size + 'px monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = glowColor || color;
        ctx.shadowBlur   = glowBlur || 16;
        ctx.fillStyle    = color;
        ctx.fillText(text, x, y);
        ctx.shadowBlur   = 0;
    }

    // ── Menu animated bumpers (static preview) ────────────────────────────────
    function drawMenuBumpers(t) {
        for (var i = 0; i < bumpers.length; i++) {
            var bmp = bumpers[i];
            var pulse = 0.7 + 0.3 * Math.sin(t * 2.5 + i * 1.1);
            ctx.beginPath();
            ctx.arc(bmp.x, bmp.y, BUMPER_RADIUS * pulse, 0, Math.PI * 2);
            ctx.fillStyle   = bmp.color;
            ctx.shadowColor = bmp.color;
            ctx.shadowBlur  = 20 * pulse;
            ctx.fill();
            ctx.shadowBlur  = 0;
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Draw states
    // ═════════════════════════════════════════════════════════════════════════

    function drawMenu() {
        drawBackground();
        drawMenuBumpers(totalTime);

        // Title
        drawGlowText('PINBALL', VW / 2, 160, 54, '#ffffff', '#00ffff', 28);
        drawGlowText('LITE',    VW / 2, 220, 48, '#00ffff', '#00ffff', 22);

        // Subtitle
        ctx.globalAlpha = 0.8;
        drawGlowText('NEON ARCADE EDITION', VW / 2, 270, 16, '#aaddff', '#0088ff', 8);
        ctx.globalAlpha = 1;

        // Tap to play (pulsing)
        var pulse = 0.6 + 0.4 * Math.abs(Math.sin(totalTime * 2.2));
        ctx.globalAlpha = pulse;
        drawGlowText('TAP TO PLAY', VW / 2, 680, 28, '#ffff00', '#ff8800', 18);
        ctx.globalAlpha = 1;

        // Best score
        if (bestScore > 0) {
            drawGlowText('BEST  ' + bestScore, VW / 2, 730, 20, '#00ffff', '#00ffff', 10);
        }

        // Controls hint
        ctx.globalAlpha = 0.55;
        drawGlowText('TAP LEFT = LEFT FLIPPER', VW / 2, 780, 13, '#8899aa', '#000', 0);
        drawGlowText('TAP RIGHT = RIGHT FLIPPER', VW / 2, 800, 13, '#8899aa', '#000', 0);
        ctx.globalAlpha = 1;
    }

    function drawPlaying() {
        drawBackground();
        drawDrainFlash();

        // Bumpers
        for (var i = 0; i < bumpers.length; i++) {
            drawBumper(bumpers[i]);
        }

        // Flippers
        drawFlipper(leftFlipper,  true);
        drawFlipper(rightFlipper, false);

        // Particles under ball
        drawParticles();

        // Ball
        drawBall();

        // HUD on top
        drawHUD();
    }

    function drawDead() {
        drawBackground();

        // Ghost bumpers
        for (var i = 0; i < bumpers.length; i++) {
            ctx.globalAlpha = 0.25;
            drawBumper(bumpers[i]);
        }
        ctx.globalAlpha = 1;

        // Dark overlay
        ctx.fillStyle = 'rgba(0,0,10,0.72)';
        ctx.fillRect(0, 0, VW, VH);

        // GAME OVER
        drawGlowText('GAME', VW / 2, 280, 58, '#ff2244', '#ff0000', 30);
        drawGlowText('OVER', VW / 2, 345, 58, '#ff2244', '#ff0000', 30);

        // Final score
        drawGlowText('SCORE', VW / 2, 440, 22, '#ffffff', '#00ffff', 10);
        drawGlowText('' + score, VW / 2, 480, 44, '#ffff00', '#ff8800', 20);

        // Best
        drawGlowText('BEST   ' + bestScore, VW / 2, 540, 22, '#00ffff', '#00ffff', 12);

        // Tap to retry (pulsing)
        var pulse = 0.5 + 0.5 * Math.abs(Math.sin(totalTime * 2.4));
        ctx.globalAlpha = pulse;
        drawGlowText('TAP TO RETRY', VW / 2, 650, 26, '#ffff00', '#ff8800', 16);
        ctx.globalAlpha = 1;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Public API
    // ═════════════════════════════════════════════════════════════════════════

    function init(cvs, best) {
        canvas    = cvs;
        ctx       = canvas.getContext('2d');
        bestScore = best || 0;
        state     = STATE_MENU;
        totalTime = 0;
        particles = [];
    }

    function draw() {
        if (!ctx) { return; }
        if (state === STATE_MENU) {
            totalTime += 0.016;  // approximate dt for menu animations
            drawMenu();
        } else if (state === STATE_PLAYING) {
            drawPlaying();
        } else if (state === STATE_DEAD) {
            totalTime += 0.016;
            drawDead();
        }
    }

    function tap(x, y) {
        if (state === STATE_MENU) {
            resetGame();
            state = STATE_PLAYING;
            try { AdManager.gameplayStart(); } catch (e) {}
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        if (state === STATE_DEAD) {
            resetGame();
            state = STATE_PLAYING;
            try { AdManager.gameplayStart(); } catch (e) {}
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        if (state === STATE_PLAYING) {
            if (x < VW / 2) {
                leftFlipper.active  = !leftFlipper.active;
            } else {
                rightFlipper.active = !rightFlipper.active;
            }
            try { Audio.play('tap'); } catch (e) {}
        }
    }

    function getBest() {
        return bestScore;
    }

    // ── Return public API ────────────────────────────────────────────────────
    return {
        init:    init,
        update:  update,
        draw:    draw,
        tap:     tap,
        getBest: getBest
    };

})();
