'use strict';
var LaserMaze = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score = 0;
    var lives = 3;

    // Grid dimensions
    var COLS = 6, ROWS = 9;
    var CELL = 52;
    var GRID_X = (VW - COLS * CELL) / 2; // 33
    var GRID_Y = 70;

    // Puzzle state
    var mirrors;   // [{col, row, type: '/' or '\'}]
    var walls;     // [{col, row}]
    var laserPath; // [{col, row}] cells the beam passes through
    var beamReachesTarget;
    var puzzleIndex = 0;
    var puzzleTimer = 0;
    var PUZZLE_TIME = 20;
    var mirrorTaps = 0;
    var winFlash = 0;
    var deathFlash = 0;
    var puzzlesSolved = 0;

    // Pre-designed puzzles: each has mirrors [{col,row,type}] and walls [{col,row}]
    // Laser source at (0,0) going RIGHT, target at (5,8)
    var PUZZLES = [
        {
            mirrors: [
                {col:0, row:0, type:'\\'},
                {col:0, row:4, type:'/'},
                {col:3, row:4, type:'\\'},
                {col:3, row:8, type:'/'},
                {col:5, row:8, type:'\\'}
            ],
            walls: [{col:2, row:2}, {col:4, row:6}]
        },
        {
            mirrors: [
                {col:2, row:0, type:'\\'},
                {col:2, row:3, type:'/'},
                {col:5, row:3, type:'\\'},
                {col:5, row:8, type:'/'}
            ],
            walls: [{col:1, row:5}, {col:3, row:1}]
        },
        {
            mirrors: [
                {col:1, row:0, type:'\\'},
                {col:1, row:6, type:'/'},
                {col:4, row:6, type:'\\'},
                {col:4, row:2, type:'/'},
                {col:5, row:2, type:'\\'},
                {col:5, row:8, type:'/'}
            ],
            walls: [{col:3, row:4}]
        },
        {
            mirrors: [
                {col:3, row:0, type:'\\'},
                {col:3, row:5, type:'/'},
                {col:0, row:5, type:'\\'},
                {col:0, row:8, type:'/'},
                {col:5, row:8, type:'\\'}
            ],
            walls: [{col:2, row:7}, {col:4, row:3}]
        }
    ];

    function cellToScreen(col, row) {
        return {
            x: GRID_X + col * CELL + CELL / 2,
            y: GRID_Y + row * CELL + CELL / 2
        };
    }

    function isWall(col, row) {
        for (var i = 0; i < walls.length; i++) {
            if (walls[i].col === col && walls[i].row === row) return true;
        }
        return false;
    }

    function getMirror(col, row) {
        for (var i = 0; i < mirrors.length; i++) {
            if (mirrors[i].col === col && mirrors[i].row === row) return mirrors[i];
        }
        return null;
    }

    function traceLaser() {
        laserPath = [];
        beamReachesTarget = false;
        var col = 0, row = 0;
        var dx = 1, dy = 0; // start going right
        var maxSteps = 200;
        var steps = 0;
        while (steps < maxSteps) {
            steps++;
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) break;
            if (isWall(col, row)) break;
            laserPath.push({col: col, row: row});
            if (col === 5 && row === 8) {
                beamReachesTarget = true;
                break;
            }
            var m = getMirror(col, row);
            if (m) {
                if (m.type === '/') {
                    var newDx = -dy;
                    var newDy = -dx;
                    dx = newDx; dy = newDy;
                } else { // '\'
                    var newDx2 = dy;
                    var newDy2 = dx;
                    dx = newDx2; dy = newDy2;
                }
            }
            col += dx;
            row += dy;
        }
    }

    function loadPuzzle() {
        var p = PUZZLES[puzzleIndex % PUZZLES.length];
        mirrors = [];
        for (var i = 0; i < p.mirrors.length; i++) {
            mirrors.push({col: p.mirrors[i].col, row: p.mirrors[i].row, type: p.mirrors[i].type});
        }
        walls = [];
        for (var j = 0; j < p.walls.length; j++) {
            walls.push({col: p.walls[j].col, row: p.walls[j].row});
        }
        puzzleTimer = PUZZLE_TIME;
        mirrorTaps = 0;
        winFlash = 0;
        traceLaser();
    }

    function startGame() {
        score = 0;
        lives = 3;
        puzzleIndex = 0;
        puzzlesSolved = 0;
        deathFlash = 0;
        winFlash = 0;
        loadPuzzle();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function drawGrid() {
        ctx.save();
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var sx = GRID_X + c * CELL;
                var sy = GRID_Y + r * CELL;
                ctx.fillStyle = '#111820';
                ctx.fillRect(sx + 1, sy + 1, CELL - 2, CELL - 2);
                ctx.strokeStyle = '#1e2a38';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + 1, sy + 1, CELL - 2, CELL - 2);
            }
        }
        ctx.restore();
    }

    function drawWalls() {
        ctx.save();
        for (var i = 0; i < walls.length; i++) {
            var sx = GRID_X + walls[i].col * CELL + 1;
            var sy = GRID_Y + walls[i].row * CELL + 1;
            ctx.fillStyle = '#2a3040';
            ctx.fillRect(sx, sy, CELL - 2, CELL - 2);
            ctx.fillStyle = '#3a4050';
            ctx.fillRect(sx + 3, sy + 3, CELL - 8, CELL - 8);
        }
        ctx.restore();
    }

    function drawSource() {
        var pos = cellToScreen(0, 0);
        ctx.save();
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SRC', pos.x, pos.y);
        ctx.restore();
    }

    function drawTarget() {
        var pos = cellToScreen(5, 8);
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        // Draw a simple star-like shape
        var r1 = 16, r2 = 8, pts = 5;
        ctx.beginPath();
        for (var i = 0; i < pts * 2; i++) {
            var r = (i % 2 === 0) ? r1 : r2;
            var a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) ctx.moveTo(pos.x + r * Math.cos(a), pos.y + r * Math.sin(a));
            else ctx.lineTo(pos.x + r * Math.cos(a), pos.y + r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fillStyle = beamReachesTarget ? '#00ffff' : '#006677';
        ctx.fill();
        ctx.restore();
    }

    function drawMirrors() {
        ctx.save();
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 8;
        for (var i = 0; i < mirrors.length; i++) {
            var m = mirrors[i];
            var sx = GRID_X + m.col * CELL;
            var sy = GRID_Y + m.row * CELL;
            var pad = 10;
            ctx.beginPath();
            if (m.type === '/') {
                ctx.moveTo(sx + CELL - pad, sy + pad);
                ctx.lineTo(sx + pad, sy + CELL - pad);
            } else {
                ctx.moveTo(sx + pad, sy + pad);
                ctx.lineTo(sx + CELL - pad, sy + CELL - pad);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawLaserBeam() {
        if (!laserPath || laserPath.length === 0) return;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.shadowColor = beamReachesTarget ? '#ff6600' : '#ff2200';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = beamReachesTarget ? '#ff8800' : '#ff3300';
        ctx.beginPath();
        for (var i = 0; i < laserPath.length; i++) {
            var pos = cellToScreen(laserPath[i].col, laserPath[i].row);
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
        // bright core
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,220,200,0.9)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (var j = 0; j < laserPath.length; j++) {
            var pos2 = cellToScreen(laserPath[j].col, laserPath[j].row);
            if (j === 0) ctx.moveTo(pos2.x, pos2.y);
            else ctx.lineTo(pos2.x, pos2.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawHUD() {
        ctx.save();
        // Lives top-left
        ctx.font = 'bold 22px sans-serif';
        ctx.textBaseline = 'top';
        var heartsStr = '';
        for (var i = 0; i < 3; i++) heartsStr += (i < lives) ? '♥' : '♡';
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.fillText(heartsStr, 12, 10);
        // Score top-right
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#aaffff';
        ctx.shadowBlur = 6;
        ctx.font = 'bold 22px monospace';
        ctx.fillText(score, VW - 12, 10);
        // Timer bar
        ctx.shadowBlur = 0;
        var timerFrac = Math.max(0, puzzleTimer / PUZZLE_TIME);
        ctx.fillStyle = '#1a2230';
        ctx.fillRect(GRID_X, GRID_Y - 14, COLS * CELL, 8);
        ctx.fillStyle = timerFrac > 0.4 ? '#00cc66' : '#ff4400';
        ctx.fillRect(GRID_X, GRID_Y - 14, COLS * CELL * timerFrac, 8);
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
            ctx.fillStyle = '#00ccff';
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 32;
            ctx.font = 'bold 52px monospace';
            ctx.fillText('LASER', VW / 2, VH / 2 - 80);
            ctx.fillText('MAZE', VW / 2, VH / 2 - 16);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px monospace';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px monospace';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 110);
            }
            ctx.fillStyle = '#445566';
            ctx.font = '16px monospace';
            ctx.fillText('Tap mirrors to rotate. Direct the laser!', VW / 2, VH / 2 + 160);
            ctx.restore();
            return;
        }

        if (state === 'PLAYING' || state === 'DEAD') {
            drawGrid();
            drawWalls();
            drawLaserBeam();
            drawSource();
            drawTarget();
            drawMirrors();
            drawHUD();

            // Win flash
            if (winFlash > 0) {
                ctx.save();
                ctx.globalAlpha = (winFlash / 0.5) * 0.35;
                ctx.fillStyle = '#00ffaa';
                ctx.fillRect(0, 0, VW, VH);
                ctx.restore();
            }
            // Death flash
            if (deathFlash > 0) {
                ctx.save();
                ctx.globalAlpha = (deathFlash / 0.6) * 0.4;
                ctx.fillStyle = '#ff2200';
                ctx.fillRect(0, 0, VW, VH);
                ctx.restore();
            }
        }

        if (state === 'DEAD') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ff3300';
            ctx.shadowColor = '#ff0000';
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
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 34);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#00ffaa';
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
        if (winFlash > 0 || deathFlash > 0) return;

        // Check if tap is on a mirror cell
        var col = Math.floor((x - GRID_X) / CELL);
        var row = Math.floor((y - GRID_Y) / CELL);
        if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
            var m = getMirror(col, row);
            if (m) {
                m.type = (m.type === '/') ? '\\' : '/';
                mirrorTaps++;
                traceLaser();
                if (beamReachesTarget) {
                    var gained = Math.max(10, 100 - mirrorTaps * 5);
                    score += gained;
                    if (score > best) best = score;
                    puzzlesSolved++;
                    try { Audio.play('gem'); } catch (e) {}
                    winFlash = 0.5;
                    puzzleIndex++;
                }
            }
        }
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state !== 'PLAYING') return;
        if (winFlash > 0) {
            winFlash -= dt;
            if (winFlash <= 0) {
                loadPuzzle();
            }
            return;
        }
        if (deathFlash > 0) {
            deathFlash -= dt;
            if (deathFlash <= 0) {
                if (lives <= 0) {
                    state = 'DEAD';
                    if (score > best) best = score;
                    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                    AdManager.showInterstitial(() => {});
                    try { AdManager.offerDoubleScore(score, 'lasermaze_best'); } catch(e) {}
                } else {
                    loadPuzzle();
                }
            }
            return;
        }
        puzzleTimer -= dt;
        if (puzzleTimer <= 0) {
            lives--;
            try { Audio.play('crash'); } catch (e) {}
            deathFlash = 0.6;
            if (lives <= 0) {
                try { Audio.play('lose'); } catch (e) {}
            }
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
        puzzleIndex = 0;
        puzzlesSolved = 0;
        mirrors = [];
        walls = [];
        laserPath = [];
        beamReachesTarget = false;
        winFlash = 0;
        deathFlash = 0;
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
