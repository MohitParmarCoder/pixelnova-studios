'use strict';

var BlockDrop = (function () {

    // ── Virtual canvas dimensions ──────────────────────────────────────────
    var VW = 390;
    var VH = 844;

    // ── Grid configuration ─────────────────────────────────────────────────
    var COLS       = 7;
    var CELL       = 50;           // px per cell
    var GRID_ROWS  = 14;
    var GRID_X     = Math.floor((VW - COLS * CELL) / 2);   // left edge of grid
    var GRID_Y     = 120;          // top edge of grid

    // ── Shape definitions [rows of col-offsets] ────────────────────────────
    // Each shape: array of [row, col] offsets from anchor (top-left of piece)
    var SHAPES = [
        // 0 – 1×1 square
        [[0, 0]],
        // 1 – 1×2 horizontal bar
        [[0, 0], [0, 1]],
        // 2 – 1×3 horizontal bar
        [[0, 0], [0, 1], [0, 2]],
        // 3 – 2×1 vertical bar
        [[0, 0], [1, 0]],
        // 4 – 2×2 square
        [[0, 0], [0, 1], [1, 0], [1, 1]]
    ];

    // Bright colours, one per shape type
    var COLORS = [
        '#FF4444',   // 0 – red
        '#44AAFF',   // 1 – blue
        '#44FF88',   // 2 – green
        '#FFD700',   // 3 – yellow
        '#FF44FF'    // 4 – magenta
    ];

    // ── State ──────────────────────────────────────────────────────────────
    var STATE_MENU    = 'MENU';
    var STATE_PLAYING = 'PLAYING';
    var STATE_DEAD    = 'DEAD';

    var canvas, ctx;
    var state;
    var score, best, level, rowsCleared;
    var grid;                 // 2-D array [row][col] = color string or null
    var piece;                // { shapeIdx, col, rowF (float), color }
    var fallTimer;            // accumulated time since last fall step
    var fallInterval;         // seconds per one-cell drop
    var stars;                // background star field
    var flashTimer;           // row-clear flash effect
    var flashRows;            // rows being cleared (for flash)
    var dropFast;             // true when fast-dropping

    // ── Helpers ────────────────────────────────────────────────────────────
    function makeGrid() {
        var g = [];
        var r, c;
        for (r = 0; r < GRID_ROWS; r++) {
            g[r] = [];
            for (c = 0; c < COLS; c++) {
                g[r][c] = null;
            }
        }
        return g;
    }

    function makePiece() {
        var idx = Math.floor(Math.random() * SHAPES.length);
        // Centre the piece horizontally
        var w = pieceWidth(idx);
        var startCol = Math.floor((COLS - w) / 2);
        return {
            shapeIdx: idx,
            col: startCol,
            rowF: 0,
            color: COLORS[idx]
        };
    }

    function pieceWidth(idx) {
        var cells = SHAPES[idx];
        var maxC = 0;
        var i;
        for (i = 0; i < cells.length; i++) {
            if (cells[i][1] > maxC) { maxC = cells[i][1]; }
        }
        return maxC + 1;
    }

    function pieceHeight(idx) {
        var cells = SHAPES[idx];
        var maxR = 0;
        var i;
        for (i = 0; i < cells.length; i++) {
            if (cells[i][0] > maxR) { maxR = cells[i][0]; }
        }
        return maxR + 1;
    }

    // Returns absolute [row, col] pairs for current piece at given gridRow
    function pieceCells(p, gridRow) {
        var cells = SHAPES[p.shapeIdx];
        var result = [];
        var i;
        for (i = 0; i < cells.length; i++) {
            result.push([gridRow + cells[i][0], p.col + cells[i][1]]);
        }
        return result;
    }

    function collides(p, gridRow) {
        var cells = pieceCells(p, gridRow);
        var i, r, c;
        for (i = 0; i < cells.length; i++) {
            r = cells[i][0];
            c = cells[i][1];
            if (c < 0 || c >= COLS) { return true; }
            if (r >= GRID_ROWS) { return true; }
            if (r >= 0 && grid[r][c] !== null) { return true; }
        }
        return false;
    }

    function lockPiece(p) {
        var row = Math.floor(p.rowF);
        var cells = pieceCells(p, row);
        var i, r, c;
        for (i = 0; i < cells.length; i++) {
            r = cells[i][0];
            c = cells[i][1];
            if (r >= 0 && r < GRID_ROWS && c >= 0 && c < COLS) {
                grid[r][c] = p.color;
            }
        }
    }

    function checkRows() {
        var cleared = [];
        var r, c, full;
        for (r = 0; r < GRID_ROWS; r++) {
            full = true;
            for (c = 0; c < COLS; c++) {
                if (grid[r][c] === null) { full = false; break; }
            }
            if (full) { cleared.push(r); }
        }
        if (cleared.length === 0) { return 0; }

        // Flash effect
        flashRows  = cleared.slice();
        flashTimer = 0.18;

        // Remove cleared rows and shift down
        var newGrid = makeGrid();
        var dest = GRID_ROWS - 1;
        for (r = GRID_ROWS - 1; r >= 0; r--) {
            var inCleared = false;
            var k;
            for (k = 0; k < cleared.length; k++) {
                if (cleared[k] === r) { inCleared = true; break; }
            }
            if (!inCleared) {
                newGrid[dest] = grid[r].slice();
                dest--;
            }
        }
        grid = newGrid;
        return cleared.length;
    }

    function dropInstant(p) {
        var row = Math.floor(p.rowF);
        while (!collides(p, row + 1)) {
            row++;
        }
        p.rowF = row;
    }

    function fallSpeed() {
        // Starts at 0.8 s/cell, each 5 rows cleared shaves 0.05 s (min 0.15)
        var speed = 0.8 - Math.floor(rowsCleared / 5) * 0.05;
        return Math.max(speed, 0.15);
    }

    function makeStars() {
        var s = [];
        var i;
        for (i = 0; i < 80; i++) {
            s.push({
                x: Math.random() * VW,
                y: Math.random() * VH,
                r: Math.random() * 1.5 + 0.5,
                a: Math.random() * 0.6 + 0.2
            });
        }
        return s;
    }

    function playSound(name) {
        try { Audio.play(name); } catch (e) {}
    }

    // ── Public: init ───────────────────────────────────────────────────────
    function init(canvasEl, bestScore) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        best   = bestScore || 0;
        stars  = makeStars();
        state  = STATE_MENU;
        score  = 0;
        level  = 1;
        rowsCleared = 0;
        flashTimer  = 0;
        flashRows   = [];
    }

    // ── Start a new game ───────────────────────────────────────────────────
    function startGame() {
        score       = 0;
        level       = 1;
        rowsCleared = 0;
        flashTimer  = 0;
        flashRows   = [];
        dropFast    = false;
        grid        = makeGrid();
        piece       = makePiece();
        fallTimer   = 0;
        fallInterval = fallSpeed();
        state       = STATE_PLAYING;
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function endGame() {
        if (score > best) { best = score; }
        state = STATE_DEAD;
        playSound('lose');
        try { AdManager.gameplayStop(); } catch (e) {}
        try { AdManager.onRunEnd(); } catch (e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'blockdrop_best'); } catch(e) {}
    }

    // ── Public: update ─────────────────────────────────────────────────────
    function update(dt) {
        if (state !== STATE_PLAYING) { return; }

        // Flash timer
        if (flashTimer > 0) {
            flashTimer -= dt;
            if (flashTimer <= 0) { flashRows = []; }
        }

        // Falling
        fallTimer += dt;
        var step = dropFast ? 0.05 : fallInterval;
        if (fallTimer >= step) {
            fallTimer = 0;
            var nextRow = Math.floor(piece.rowF) + 1;
            if (collides(piece, nextRow)) {
                // Land the piece
                lockPiece(piece);
                playSound('gem');
                var n = checkRows();
                if (n > 0) {
                    rowsCleared += n;
                    score += n * 10;
                    level = Math.floor(rowsCleared / 5) + 1;
                    fallInterval = fallSpeed();
                }
                dropFast = false;
                piece = makePiece();
                // Spawn collision = game over
                if (collides(piece, Math.floor(piece.rowF))) {
                    endGame();
                    return;
                }
            } else {
                piece.rowF = nextRow;
            }
        }
    }

    // ── Public: tap ───────────────────────────────────────────────────────
    function tap(x, y) {
        if (state === STATE_MENU) {
            playSound('tap');
            startGame();
            return;
        }
        if (state === STATE_DEAD) {
            playSound('tap');
            startGame();
            return;
        }
        // PLAYING
        if (x < 130) {
            // Move left
            var leftCol = piece.col - 1;
            if (!collides({ shapeIdx: piece.shapeIdx, col: leftCol, rowF: piece.rowF, color: piece.color }, Math.floor(piece.rowF))) {
                piece.col = leftCol;
                playSound('tap');
            }
        } else if (x > 260) {
            // Move right
            var rightCol = piece.col + 1;
            if (!collides({ shapeIdx: piece.shapeIdx, col: rightCol, rowF: piece.rowF, color: piece.color }, Math.floor(piece.rowF))) {
                piece.col = rightCol;
                playSound('tap');
            }
        } else {
            // Drop fast
            dropInstant(piece);
            dropFast = true;
            playSound('crash');
        }
    }

    // ── Public: getBest ────────────────────────────────────────────────────
    function getBest() {
        return best;
    }

    // ── Drawing helpers ────────────────────────────────────────────────────
    function drawBackground() {
        // Deep space gradient
        var grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0,   '#0a0015');
        grad.addColorStop(0.5, '#050820');
        grad.addColorStop(1,   '#000810');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);

        // Stars
        var i, s;
        for (i = 0; i < stars.length; i++) {
            s = stars[i];
            ctx.globalAlpha = s.a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawGridLines() {
        ctx.save();
        ctx.strokeStyle = 'rgba(80, 120, 200, 0.18)';
        ctx.lineWidth = 1;
        var r, c;
        for (r = 0; r <= GRID_ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(GRID_X, GRID_Y + r * CELL);
            ctx.lineTo(GRID_X + COLS * CELL, GRID_Y + r * CELL);
            ctx.stroke();
        }
        for (c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(GRID_X + c * CELL, GRID_Y);
            ctx.lineTo(GRID_X + c * CELL, GRID_Y + GRID_ROWS * CELL);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawCell(r, c, color, alpha) {
        var px = GRID_X + c * CELL;
        var py = GRID_Y + r * CELL;
        ctx.save();
        ctx.globalAlpha = (alpha !== undefined) ? alpha : 1;
        // Main fill
        ctx.fillStyle = color;
        ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        // Highlight top-left
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(px + 2, py + 2, CELL - 4, 6);
        ctx.fillRect(px + 2, py + 2, 6, CELL - 4);
        // Shadow bottom-right
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(px + 2, py + CELL - 8, CELL - 4, 6);
        ctx.fillRect(px + CELL - 8, py + 2, 6, CELL - 4);
        ctx.restore();
    }

    function drawGrid() {
        var r, c;
        for (r = 0; r < GRID_ROWS; r++) {
            for (c = 0; c < COLS; c++) {
                if (grid[r][c] !== null) {
                    // Flash cleared rows white
                    var isFlashing = false;
                    var k;
                    for (k = 0; k < flashRows.length; k++) {
                        if (flashRows[k] === r) { isFlashing = true; break; }
                    }
                    if (isFlashing) {
                        drawCell(r, c, '#ffffff', 0.9);
                    } else {
                        drawCell(r, c, grid[r][c]);
                    }
                }
            }
        }
    }

    function drawPiece() {
        if (!piece) { return; }
        var cells = SHAPES[piece.shapeIdx];
        var row = Math.floor(piece.rowF);
        var i, r, c;

        // Draw ghost (drop preview)
        var ghostRow = row;
        while (!collides(piece, ghostRow + 1)) { ghostRow++; }
        if (ghostRow !== row) {
            for (i = 0; i < cells.length; i++) {
                r = ghostRow + cells[i][0];
                c = piece.col  + cells[i][1];
                if (r >= 0 && r < GRID_ROWS) {
                    ctx.save();
                    ctx.globalAlpha = 0.22;
                    ctx.fillStyle = piece.color;
                    ctx.fillRect(GRID_X + c * CELL + 2, GRID_Y + r * CELL + 2, CELL - 4, CELL - 4);
                    ctx.restore();
                }
            }
        }

        // Draw actual piece
        for (i = 0; i < cells.length; i++) {
            r = row + cells[i][0];
            c = piece.col + cells[i][1];
            if (r >= 0 && r < GRID_ROWS) {
                drawCell(r, c, piece.color);
            }
        }
    }

    function drawHUD() {
        ctx.save();

        // Panel on the right of the grid
        var panelX = GRID_X + COLS * CELL + 10;
        var panelW = VW - panelX - 8;

        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.strokeStyle = 'rgba(100,160,255,0.3)';
        ctx.lineWidth = 1;

        // Score box
        roundRect(ctx, panelX, GRID_Y, panelW, 80, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(160,200,255,0.8)';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCORE', panelX + panelW / 2, GRID_Y + 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(score, panelX + panelW / 2, GRID_Y + 44);

        ctx.fillStyle = 'rgba(160,200,255,0.8)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('BEST: ' + best, panelX + panelW / 2, GRID_Y + 65);

        // Level box
        roundRect(ctx, panelX, GRID_Y + 95, panelW, 60, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(160,200,255,0.8)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('LEVEL', panelX + panelW / 2, GRID_Y + 113);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(level, panelX + panelW / 2, GRID_Y + 142);

        // Control hints
        var hintY = GRID_Y + 175;
        ctx.fillStyle = 'rgba(120,180,255,0.6)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('< MOVE >', panelX + panelW / 2, hintY);
        ctx.fillText('TAP MID', panelX + panelW / 2, hintY + 16);
        ctx.fillText('= DROP', panelX + panelW / 2, hintY + 30);

        ctx.restore();
    }

    function roundRect(c, x, y, w, h, radius) {
        c.beginPath();
        c.moveTo(x + radius, y);
        c.lineTo(x + w - radius, y);
        c.quadraticCurveTo(x + w, y, x + w, y + radius);
        c.lineTo(x + w, y + h - radius);
        c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        c.lineTo(x + radius, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - radius);
        c.lineTo(x, y + radius);
        c.quadraticCurveTo(x, y, x + radius, y);
        c.closePath();
    }

    function drawTapZones() {
        ctx.save();
        ctx.globalAlpha = 0.06;
        // Left zone
        ctx.fillStyle = '#44AAFF';
        ctx.fillRect(0, GRID_Y, 130, GRID_ROWS * CELL);
        // Right zone
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(260, GRID_Y, 130, GRID_ROWS * CELL);
        // Center zone
        ctx.fillStyle = '#44FF88';
        ctx.fillRect(130, GRID_Y, 130, GRID_ROWS * CELL);
        ctx.restore();

        // Arrows
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var midY = GRID_Y + GRID_ROWS * CELL - 30;
        ctx.fillText('<', 65, midY);
        ctx.fillText('>', 325, midY);
        ctx.fillText('v', 195, midY);
        ctx.restore();
    }

    function drawMenuScreen() {
        drawBackground();

        // Decorative falling blocks
        var decorBlocks = [
            { r: 2, c: 1, color: '#FF4444' },
            { r: 3, c: 1, color: '#FF4444' },
            { r: 4, c: 3, color: '#44AAFF' },
            { r: 4, c: 4, color: '#44AAFF' },
            { r: 6, c: 5, color: '#44FF88' },
            { r: 7, c: 5, color: '#44FF88' },
            { r: 7, c: 6, color: '#44FF88' },
            { r: 9, c: 0, color: '#FFD700' },
            { r: 10, c: 0, color: '#FFD700' },
            { r: 11, c: 2, color: '#FF44FF' },
            { r: 11, c: 3, color: '#FF44FF' },
            { r: 12, c: 2, color: '#FF44FF' },
            { r: 12, c: 3, color: '#FF44FF' }
        ];
        var i;
        for (i = 0; i < decorBlocks.length; i++) {
            drawCell(decorBlocks[i].r, decorBlocks[i].c, decorBlocks[i].color, 0.5);
        }

        drawGridLines();

        // Title backdrop
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(ctx, 30, 55, 330, 90, 16);
        ctx.fill();

        // Title
        ctx.textAlign = 'center';
        ctx.shadowColor = '#44AAFF';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px monospace';
        ctx.fillText('BLOCK', VW / 2, 100);
        ctx.fillStyle = '#44FF88';
        ctx.fillText('DROP', VW / 2, 140);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Prompt
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, 80, 770, 230, 50, 12);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAP TO PLAY', VW / 2, 795);
        ctx.restore();

        // Best score
        if (best > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            roundRect(ctx, 120, 166, 150, 36, 10);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,215,0,0.9)';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BEST: ' + best, VW / 2, 184);
            ctx.restore();
        }
    }

    function drawPlayingScreen() {
        drawBackground();
        drawGridLines();
        drawTapZones();
        drawGrid();
        drawPiece();
        drawHUD();

        // Top bar
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,20,0.75)';
        ctx.fillRect(0, 0, VW, GRID_Y - 4);
        ctx.fillStyle = '#aaccff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('BLOCK DROP', 14, 60);
        ctx.restore();
    }

    function drawDeadScreen() {
        // Draw the frozen board underneath
        drawBackground();
        drawGridLines();
        drawGrid();
        drawHUD();

        // Dark overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, VW, VH);

        // Panel
        ctx.fillStyle = 'rgba(10, 10, 40, 0.95)';
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        roundRect(ctx, 50, 280, 290, 280, 20);
        ctx.fill();
        ctx.stroke();

        // GAME OVER
        ctx.shadowColor = '#FF4444';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 38px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME', VW / 2, 330);
        ctx.fillText('OVER', VW / 2, 375);
        ctx.shadowBlur = 0;

        // Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(70, 400);
        ctx.lineTo(320, 400);
        ctx.stroke();

        // Scores
        ctx.fillStyle = 'rgba(160,200,255,0.85)';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('SCORE', VW / 2, 425);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px monospace';
        ctx.fillText(score, VW / 2, 460);

        ctx.fillStyle = 'rgba(255,215,0,0.85)';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('BEST: ' + best, VW / 2, 495);

        // Retry button
        ctx.fillStyle = '#44FF88';
        ctx.font = 'bold 20px monospace';
        ctx.shadowColor = '#44FF88';
        ctx.shadowBlur = 10;
        ctx.fillText('TAP TO RETRY', VW / 2, 530);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // ── Public: draw ───────────────────────────────────────────────────────
    function draw() {
        if (!ctx) { return; }
        ctx.clearRect(0, 0, VW, VH);
        if (state === STATE_MENU) {
            drawMenuScreen();
        } else if (state === STATE_PLAYING) {
            drawPlayingScreen();
        } else if (state === STATE_DEAD) {
            drawDeadScreen();
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────
    return {
        init: init,
        update: update,
        draw: draw,
        tap: tap,
        getBest: getBest
    };

})();
