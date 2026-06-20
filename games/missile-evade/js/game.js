'use strict';
var MissileEvade = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var missiles, explosions;
    var spawnTimer, spawnInterval;
    var wave, waveTimer;
    var cities;
    var shotCooldown;
    var crosshairX, crosshairY;
    var stars;

    function makeStar() {
        return {
            x: Math.random() * VW,
            y: Math.random() * VH,
            r: 0.5 + Math.random() * 1.5,
            a: 0.2 + Math.random() * 0.8
        };
    }

    function makeStars() {
        stars = [];
        for (var i = 0; i < 70; i++) stars.push(makeStar());
    }

    function makeCities() {
        cities = [];
        var positions = [60, VW / 2, VW - 60];
        for (var i = 0; i < 3; i++) {
            cities.push({ x: positions[i], alive: true });
        }
    }

    function spawnMissile() {
        var pick = Math.random();
        var type = (pick < 0.45) ? 'fast' : (pick < 0.8) ? 'slow' : 'bomber';
        var baseSpd = (type === 'fast') ? 200 : (type === 'slow') ? 100 : 80;
        var waveBonus = Math.min(175, (wave - 1) * 25);
        var spd = baseSpd + waveBonus;
        var x = 20 + Math.random() * (VW - 40);
        var vx = (Math.random() - 0.5) * spd * 0.7;
        var vy = Math.sqrt(spd * spd - vx * vx);
        missiles.push({
            x: x, y: -20,
            vx: vx, vy: vy,
            alive: true,
            type: type,
            hits: (type === 'bomber') ? 2 : 1,
            cracked: false
        });
    }

    function addExplosion(x, y, r, color) {
        explosions.push({ x: x, y: y, maxR: r, t: 0, dur: 0.4, color: color || '#ff8800' });
    }

    function startGame() {
        score = 0;
        lives = 3;
        wave = 1;
        waveTimer = 0;
        spawnTimer = 0;
        spawnInterval = 1.2;
        missiles = [];
        explosions = [];
        shotCooldown = 0;
        crosshairX = VW / 2;
        crosshairY = VH / 2;
        makeCities();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state !== 'PLAYING') return;

        waveTimer += dt;
        if (waveTimer >= 60) {
            waveTimer = 0;
            wave++;
        }

        if (shotCooldown > 0) shotCooldown -= dt;

        spawnTimer += dt;
        var curInterval = Math.max(0.4, 1.2 - (wave - 1) * 0.08);
        if (spawnTimer >= curInterval) {
            spawnTimer = 0;
            spawnMissile();
        }

        var i;
        for (i = missiles.length - 1; i >= 0; i--) {
            var m = missiles[i];
            if (!m.alive) { missiles.splice(i, 1); continue; }
            m.x += m.vx * dt;
            m.y += m.vy * dt;

            if (m.x < 10) { m.x = 10; m.vx = Math.abs(m.vx); }
            if (m.x > VW - 10) { m.x = VW - 10; m.vx = -Math.abs(m.vx); }

            if (m.y > VH - 80) {
                addExplosion(m.x, VH - 80, 40, '#ff4400');
                m.alive = false;
                var nearest = -1, nearDist = 9999;
                for (var c = 0; c < cities.length; c++) {
                    if (!cities[c].alive) continue;
                    var dd = Math.abs(cities[c].x - m.x);
                    if (dd < nearDist) { nearDist = dd; nearest = c; }
                }
                if (nearest >= 0) {
                    cities[nearest].alive = false;
                    lives--;
                    try { Audio.play('crash'); } catch (e) {}
                    if (lives <= 0) {
                        state = 'DEAD';
                        try { Audio.play('lose'); } catch (e) {}
                        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                        AdManager.showInterstitial(() => {});
                        try { AdManager.offerDoubleScore(score, 'missileevade_best'); } catch(e) {}
                    }
                }
            }
        }

        for (var j = explosions.length - 1; j >= 0; j--) {
            explosions[j].t += dt;
            if (explosions[j].t >= explosions[j].dur) explosions.splice(j, 1);
        }
    }

    function drawCity(c) {
        if (!c.alive) return;
        ctx.save();
        ctx.fillStyle = '#448844';
        ctx.shadowColor = '#66ff66';
        ctx.shadowBlur = 8;
        var bx = c.x - 20, by = VH - 70;
        ctx.fillRect(bx, by - 20, 12, 20);
        ctx.fillRect(bx + 14, by - 30, 14, 30);
        ctx.fillRect(bx + 30, by - 18, 10, 18);
        ctx.fillStyle = '#ffff99';
        ctx.shadowBlur = 0;
        ctx.fillRect(bx + 2, by - 16, 3, 3);
        ctx.fillRect(bx + 7, by - 16, 3, 3);
        ctx.fillRect(bx + 16, by - 24, 3, 3);
        ctx.fillRect(bx + 22, by - 24, 3, 3);
        ctx.fillRect(bx + 32, by - 14, 3, 3);
        ctx.restore();
    }

    function drawMissile(m) {
        ctx.save();
        var angle = Math.atan2(m.vy, m.vx);
        ctx.translate(m.x, m.y);
        ctx.rotate(angle - Math.PI / 2);
        var bodyColor = (m.type === 'fast') ? '#ee2222' : (m.type === 'slow') ? '#ff8800' : '#ffdd00';
        var w = (m.type === 'fast') ? 6 : (m.type === 'slow') ? 10 : 14;
        var h = (m.type === 'fast') ? 20 : (m.type === 'slow') ? 28 : 22;
        ctx.shadowColor = bodyColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -h / 2 - 6);
        ctx.lineTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, -h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(-w / 2, h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(0, h / 2 + 10 + Math.random() * 6);
        ctx.closePath();
        ctx.fill();
        if (m.type === 'bomber' && m.hits === 1) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(-2, -4);
            ctx.lineTo(3, 0);
            ctx.lineTo(-1, 4);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawExplosion(ex) {
        var frac = ex.t / ex.dur;
        var r = ex.maxR * (0.3 + frac * 0.7);
        ctx.save();
        ctx.globalAlpha = 1 - frac;
        ctx.shadowColor = ex.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = ex.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - frac) * 0.35;
        ctx.fillStyle = ex.color;
        ctx.fill();
        ctx.restore();
    }

    function drawCrosshair() {
        var frac = (shotCooldown > 0) ? (0.25 - shotCooldown) / 0.25 : 1;
        ctx.save();
        ctx.strokeStyle = (shotCooldown > 0) ? '#ff4400' : '#00ff88';
        ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
        var R = 16;
        ctx.beginPath();
        ctx.arc(crosshairX, crosshairY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(crosshairX - R - 4, crosshairY);
        ctx.lineTo(crosshairX - R + 6, crosshairY);
        ctx.moveTo(crosshairX + R - 6, crosshairY);
        ctx.lineTo(crosshairX + R + 4, crosshairY);
        ctx.moveTo(crosshairX, crosshairY - R - 4);
        ctx.lineTo(crosshairX, crosshairY - R + 6);
        ctx.moveTo(crosshairX, crosshairY + R - 6);
        ctx.lineTo(crosshairX, crosshairY + R + 4);
        ctx.stroke();
        ctx.restore();
    }

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        var i;
        for (i = 0; i < stars.length; i++) {
            var s = stars[i];
            ctx.globalAlpha = s.a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (state === 'MENU') {
            ctx.fillStyle = '#ff4422';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MISSILE EVADE', VW / 2, VH / 2 - 80);
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
            ctx.fillText('Tap to shoot missiles!', VW / 2, VH / 2 + 110);
            ctx.textAlign = 'left';
            return;
        }

        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, VH - 80, VW, 80);
        ctx.strokeStyle = '#225522';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, VH - 80);
        ctx.lineTo(VW, VH - 80);
        ctx.stroke();

        for (i = 0; i < explosions.length; i++) drawExplosion(explosions[i]);
        for (i = 0; i < missiles.length; i++) if (missiles[i].alive) drawMissile(missiles[i]);
        for (i = 0; i < cities.length; i++) drawCity(cities[i]);

        drawCrosshair();

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        for (i = 0; i < 3; i++) {
            ctx.fillStyle = (i < lives) ? '#ff3333' : '#442222';
            ctx.fillText((i < lives) ? '♥' : '♡', 14 + i * 28, 44);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 14, 44);

        ctx.fillStyle = '#ffcc44';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE ' + wave, VW / 2, 44);
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
        crosshairX = x;
        crosshairY = y;
        if (shotCooldown > 0) return;
        shotCooldown = 0.25;
        try { Audio.play('tap'); } catch (e) {}
        addExplosion(x, y, 40, '#ffaa00');
        var killed = 0;
        for (var i = 0; i < missiles.length; i++) {
            var m = missiles[i];
            if (!m.alive) continue;
            var dx = m.x - x, dy = m.y - y;
            if (dx * dx + dy * dy <= 40 * 40) {
                if (m.type === 'bomber' && m.hits > 1) {
                    m.hits--;
                    m.cracked = true;
                    addExplosion(m.x, m.y, 20, '#ff8800');
                } else {
                    m.alive = false;
                    killed++;
                    addExplosion(m.x, m.y, 30, '#ff4400');
                }
            }
        }
        if (killed > 0) {
            score += killed * 10;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch (e) {}
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        missiles = [];
        explosions = [];
        makeStars();
        makeCities();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
