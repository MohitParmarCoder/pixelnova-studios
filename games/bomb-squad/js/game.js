'use strict';
var BombSquad = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;

    // Grid constants: 8 cols x 10 rows, cell 42x44, grid starts at x=27, y=90
    var COLS = 8, ROWS = 10;
    var CELL_W = 42, CELL_H = 44;
    var GX = Math.floor((VW - COLS * CELL_W) / 2); // 27
    var GY = 90;
    var NUM_MINES = 12;

    var cells;
    var firstTap;
    var flagMode;
    var flagsPlaced;
    var revealedCount;
    var numSafe;
    var elapsedTime;
    var flashTimer;
    var winFlash;

    // ── Cell helpers ───────────────────────────────────────────────────────────

    function cellIndex(col, row) {
        return row * COLS + col;
    }

    function getCell(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
        return cells[cellIndex(col, row)];
    }

    function initBoard() {
        cells = [];
        var i;
        for (i = 0; i < COLS * ROWS; i++) {
            cells.push({ mine: false, revealed: false, flagged: false, adjacentMines: 0, exploded: false });
        }
        firstTap = true;
        flagMode = false;
        flagsPlaced = 0;
        revealedCount = 0;
        numSafe = COLS * ROWS - NUM_MINES;
        elapsedTime = 0;
    }

    function placeMines(avoidCol, avoidRow) {
        var placed = 0;
        while (placed < NUM_MINES) {
            var c = Math.floor(Math.random() * COLS);
            var r = Math.floor(Math.random() * ROWS);
            if (c === avoidCol && r === avoidRow) continue;
            var cell = cells[cellIndex(c, r)];
            if (!cell.mine) {
                cell.mine = true;
                placed++;
            }
        }
        var col, row, dc, dr, nb, count;
        for (row = 0; row < ROWS; row++) {
            for (col = 0; col < COLS; col++) {
                if (cells[cellIndex(col, row)].mine) continue;
                count = 0;
                for (dc = -1; dc <= 1; dc++) {
                    for (dr = -1; dr <= 1; dr++) {
                        if (dc === 0 && dr === 0) continue;
                        nb = getCell(col + dc, row + dr);
                        if (nb && nb.mine) count++;
                    }
                }
                cells[cellIndex(col, row)].adjacentMines = count;
            }
        }
    }

    function floodReveal(col, row) {
        var stack = [{c: col, r: row}];
        var cur, cell, dc, dr, nb;
        while (stack.length > 0) {
            cur = stack.pop();
            cell = getCell(cur.c, cur.r);
            if (!cell || cell.revealed || cell.flagged || cell.mine) continue;
            cell.revealed = true;
            revealedCount++;
            if (cell.adjacentMines === 0) {
                for (dc = -1; dc <= 1; dc++) {
                    for (dr = -1; dr <= 1; dr++) {
                        if (dc === 0 && dr === 0) continue;
                        nb = getCell(cur.c + dc, cur.r + dr);
                        if (nb && !nb.revealed && !nb.flagged) {
                            stack.push({c: cur.c + dc, r: cur.r + dr});
                        }
                    }
                }
            }
        }
    }

    // ── Game flow ──────────────────────────────────────────────────────────────

    function startGame() {
        score = 0;
        lives = 3;
        flashTimer = 0;
        winFlash = 0;
        initBoard();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function winBoard() {
        var timeBonus = Math.max(0, 300 - Math.floor(elapsedTime * 2));
        score += numSafe * 3 + timeBonus;
        if (score > best) best = score;
        try { Audio.play('gem'); } catch (e) {}
        winFlash = 0.8;
    }

    function hitMine(col, row) {
        cells[cellIndex(col, row)].exploded = true;
        cells[cellIndex(col, row)].revealed = true;
        lives--;
        flashTimer = 0.4;
        try { Audio.play('crash'); } catch (e) {}
        if (lives <= 0) {
            var i;
            for (i = 0; i < cells.length; i++) {
                if (cells[i].mine) cells[i].revealed = true;
            }
            state = 'DEAD';
            if (score > best) best = score;
            try { Audio.play('lose'); } catch (e) {}
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        }
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    function update(dt) {
        if (state !== 'PLAYING') return;
        if (flashTimer > 0) flashTimer -= dt;
        if (winFlash > 0) {
            winFlash -= dt;
            if (winFlash <= 0) {
                winFlash = 0;
                initBoard();
            }
            return;
        }
        if (!firstTap) elapsedTime += dt;
    }

    // ── Tap ────────────────────────────────────────────────────────────────────

    function tapCell(col, row) {
        var cell = getCell(col, row);
        if (!cell) return;

        if (flagMode) {
            if (cell.revealed) return;
            if (cell.flagged) {
                cell.flagged = false;
                flagsPlaced--;
            } else {
                cell.flagged = true;
                flagsPlaced++;
            }
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        if (cell.revealed || cell.flagged) return;

        if (firstTap) {
            firstTap = false;
            elapsedTime = 0;
            placeMines(col, row);
        }

        if (cell.mine) {
            hitMine(col, row);
            return;
        }

        floodReveal(col, row);
        score += 5;
        if (score > best) best = score;
        try { Audio.play('tap'); } catch (e) {}

        if (revealedCount >= numSafe) {
            winBoard();
        }
    }

    function tap(x, y) {
        if (state === 'MENU') {
            startGame();
            try { Audio.play('tap'); } catch (e) {}
            return;
        }
        if (state === 'DEAD') {
            startGame();
            try { Audio.play('tap'); } catch (e) {}
            return;
        }
        if (state !== 'PLAYING') return;

        var btnY = VH - 60;
        if (y >= btnY) {
            flagMode = !flagMode;
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        var col = Math.floor((x - GX) / CELL_W);
        var row = Math.floor((y - GY) / CELL_H);
        if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
            tapCell(col, row);
        }
    }

    // ── Draw helpers ───────────────────────────────────────────────────────────

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawBombIcon(cx, cy, r) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy - r);
        ctx.quadraticCurveTo(cx + 8, cy - r - 6, cx + 6, cy - r - 11);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
    }

    function drawFlagIcon(cx, cy) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 10);
        ctx.lineTo(cx + 9, cy - 5);
        ctx.lineTo(cx - 2, cy);
        ctx.closePath();
        ctx.fillStyle = '#ff3333';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 10);
        ctx.lineTo(cx - 2, cy + 8);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    var NUM_COLORS = ['', '#4488ff', '#22aa44', '#ff4444', '#000088', '#880000', '#008888', '#111111', '#888888'];

    function drawCell(col, row) {
        var cell = cells[cellIndex(col, row)];
        var px = GX + col * CELL_W;
        var py = GY + row * CELL_H;
        var pad = 2;
        var cx = px + CELL_W / 2;
        var cy = py + CELL_H / 2;

        if (!cell.revealed) {
            ctx.fillStyle = '#b0b8c0';
            roundRect(px + pad, py + pad, CELL_W - pad * 2, CELL_H - pad * 2, 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(px + pad, py + pad, CELL_W - pad * 2, 3);
            ctx.fillRect(px + pad, py + pad, 3, CELL_H - pad * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(px + pad, py + CELL_H - pad - 3, CELL_W - pad * 2, 3);
            ctx.fillRect(px + CELL_W - pad - 3, py + pad, 3, CELL_H - pad * 2);
            if (cell.flagged) drawFlagIcon(cx, cy);
        } else {
            var bg = cell.exploded ? '#ff2200' : (cell.mine ? '#cc2200' : '#788090');
            ctx.fillStyle = bg;
            roundRect(px + pad, py + pad, CELL_W - pad * 2, CELL_H - pad * 2, 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (cell.mine) {
                drawBombIcon(cx, cy, (CELL_W < CELL_H ? CELL_W : CELL_H) / 2 - 6);
            } else if (cell.adjacentMines > 0) {
                ctx.fillStyle = NUM_COLORS[cell.adjacentMines] || '#ffffff';
                ctx.font = 'bold 18px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cell.adjacentMines, cx, cy);
                ctx.textBaseline = 'alphabetic';
            }
        }
    }

    function drawHUD() {
        var i, heartStr;
        heartStr = '';
        for (i = 0; i < lives; i++) heartStr += '♥';
        for (i = lives; i < 3; i++) heartStr += '♡';
        ctx.fillStyle = '#ff4444';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(heartStr, 12, 52);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 12, 52);

        var minesLeft = NUM_MINES - flagsPlaced;
        ctx.fillStyle = '#ffdd00';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M:' + minesLeft, VW / 2, 52);
    }

    function drawFlagButton() {
        var btnY = VH - 60;
        ctx.fillStyle = flagMode ? '#3a1a00' : '#001a3a';
        ctx.fillRect(0, btnY, VW, 60);
        ctx.strokeStyle = flagMode ? '#ff7700' : '#0077ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, btnY, VW, 60);
        ctx.fillStyle = flagMode ? '#ff9900' : '#44aaff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagMode ? 'FLAG MODE  (tap to switch)' : 'DIG MODE  (tap to FLAG)', VW / 2, btnY + 30);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Draw ───────────────────────────────────────────────────────────────────

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 24;
            ctx.font = 'bold 50px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BOMB SQUAD', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ccddff';
            ctx.font = '20px sans-serif';
            ctx.fillText('Minesweeper - clear the board!', VW / 2, VH / 2 - 28);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 30);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '20px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 80);
            }
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = (flashTimer / 0.4) * 0.38;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        var col, row;
        for (row = 0; row < ROWS; row++) {
            for (col = 0; col < COLS; col++) {
                drawCell(col, row);
            }
        }

        drawHUD();
        drawFlagButton();

        if (winFlash > 0) {
            var alpha = Math.min(1, winFlash / 0.4);
            ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.6) + ')';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#00ffcc';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 28;
            ctx.fillText('BOARD CLEAR!', VW / 2, VH / 2 - 40);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffdd00';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('+' + (numSafe * 3 + Math.max(0, 300 - Math.floor(elapsedTime * 2))), VW / 2, VH / 2 + 20);
            ctx.textAlign = 'left';
        }

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#ff4400';
            ctx.font = 'bold 52px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 22;
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 14);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 36);
            ctx.fillStyle = '#aaffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
        }
    }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
    }

    function getBest() { return best; }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
