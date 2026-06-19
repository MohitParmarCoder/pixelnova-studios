'use strict';
var GridSnake = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;

    // Grid: 9 x 14 cells, 38px each, starts at x=24, y=80
    var COLS = 9, ROWS = 14;
    var CELL = 38;
    var GX = Math.floor((VW - COLS * CELL) / 2); // 24
    var GY = 80;

    var MOVE_INTERVAL = 0.35;

    // Snake
    var snake;    // array of {col, row}, head first
    var headVal;  // numeric value of head (2, 4, 8, ...)
    var dir;      // {dc, dr} current direction
    var nextDir;  // buffered next direction

    // Food tiles
    var foods;    // array of {col, row, val}
    var MAX_FOODS = 4;

    // Game state
    var score, lives;
    var moveTimer;
    var animTime;
    var flashTimer;

    // ── Color by value ─────────────────────────────────────────────────────────

    function headColor(val) {
        if (val >= 32)  return '#ff4444';
        if (val >= 16)  return '#ff8800';
        if (val >= 8)   return '#fde68a';
        if (val >= 4)   return '#86efac';
        return '#67e8f9'; // 2
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function isOnSnake(col, row) {
        var i;
        for (i = 0; i < snake.length; i++) {
            if (snake[i].col === col && snake[i].row === row) return true;
        }
        return false;
    }

    function isOnFood(col, row) {
        var i;
        for (i = 0; i < foods.length; i++) {
            if (foods[i].col === col && foods[i].row === row) return true;
        }
        return false;
    }

    function randomEmpty() {
        var empties = [];
        var c, r;
        for (r = 0; r < ROWS; r++) {
            for (c = 0; c < COLS; c++) {
                if (!isOnSnake(c, r) && !isOnFood(c, r)) {
                    empties.push({col: c, row: r});
                }
            }
        }
        if (empties.length === 0) return null;
        return empties[Math.floor(Math.random() * empties.length)];
    }

    function randomFoodVal() {
        var r = Math.random();
        if (r < 0.5) return 2;
        if (r < 0.8) return 4;
        return 8;
    }

    function spawnFood() {
        var pos = randomEmpty();
        if (!pos) return;
        foods.push({col: pos.col, row: pos.row, val: randomFoodVal()});
    }

    // ── Init ───────────────────────────────────────────────────────────────────

    function resetSnake() {
        var startCol = Math.floor(COLS / 2);
        var startRow = Math.floor(ROWS / 2);
        snake = [{col: startCol, row: startRow}];
        headVal = 2;
        dir = {dc: 1, dr: 0};
        nextDir = {dc: 1, dr: 0};
        foods = [];
        var i;
        for (i = 0; i < 3; i++) spawnFood();
        moveTimer = MOVE_INTERVAL;
    }

    function startGame() {
        score = 0;
        lives = 3;
        flashTimer = 0;
        animTime = 0;
        resetSnake();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        animTime = 0;
        state = 'MENU';
        resetSnake();
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    function loseLife() {
        lives--;
        flashTimer = 0.45;
        try { Audio.play('crash'); } catch (e) {}
        if (lives <= 0) {
            state = 'DEAD';
            if (score > best) best = score;
            try { Audio.play('lose'); } catch (e) {}
            try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        } else {
            resetSnake();
        }
    }

    function stepSnake() {
        dir = {dc: nextDir.dc, dr: nextDir.dr};
        var head = snake[0];
        var nc = head.col + dir.dc;
        var nr = head.row + dir.dr;

        // Wall collision
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
            loseLife();
            return;
        }

        // Self collision
        var i;
        for (i = 0; i < snake.length; i++) {
            if (snake[i].col === nc && snake[i].row === nr) {
                loseLife();
                return;
            }
        }

        // Check food
        var foodIdx = -1;
        for (i = 0; i < foods.length; i++) {
            if (foods[i].col === nc && foods[i].row === nr) {
                foodIdx = i;
                break;
            }
        }

        // Move head
        snake.unshift({col: nc, row: nr});

        if (foodIdx >= 0) {
            var food = foods[foodIdx];
            foods.splice(foodIdx, 1);

            if (food.val === headVal) {
                // MERGE: double head value, grow, score
                headVal = headVal * 2;
                score += headVal;
                if (score > best) best = score;
                try { Audio.play('gem'); } catch (e) {}
                // grow: keep tail (don't pop)
            } else {
                // eat but head value changes, no score, grow
                headVal = food.val;
                // grow: keep tail
            }

            // Replenish food
            while (foods.length < MAX_FOODS) {
                spawnFood();
                if (randomEmpty() === null) break;
            }
        } else {
            // No food: remove tail
            snake.pop();
        }
    }

    function update(dt) {
        animTime += dt;
        if (state !== 'PLAYING') return;

        if (flashTimer > 0) {
            flashTimer -= dt;
            return; // pause movement during flash
        }

        var curInterval = Math.max(0.15, MOVE_INTERVAL - score * 0.003);
        moveTimer -= dt;
        if (moveTimer <= 0) {
            moveTimer += curInterval;
            stepSnake();
        }
    }

    // ── Tap ────────────────────────────────────────────────────────────────────

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

        // Determine direction from tap relative to head screen position
        var head = snake[0];
        var headSX = GX + head.col * CELL + CELL / 2;
        var headSY = GY + head.row * CELL + CELL / 2;
        var dx = x - headSX;
        var dy = y - headSY;
        var newDC, newDR;

        if (Math.abs(dx) > Math.abs(dy)) {
            newDC = dx > 0 ? 1 : -1;
            newDR = 0;
        } else {
            newDC = 0;
            newDR = dy > 0 ? 1 : -1;
        }

        // Prevent reversing
        if (newDC !== 0 && newDC === -dir.dc) return;
        if (newDR !== 0 && newDR === -dir.dr) return;

        nextDir = {dc: newDC, dr: newDR};
        try { Audio.play('tap'); } catch (e) {}
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

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        var c, r, gx, gy;
        for (c = 0; c <= COLS; c++) {
            gx = GX + c * CELL;
            ctx.beginPath();
            ctx.moveTo(gx, GY);
            ctx.lineTo(gx, GY + ROWS * CELL);
            ctx.stroke();
        }
        for (r = 0; r <= ROWS; r++) {
            gy = GY + r * CELL;
            ctx.beginPath();
            ctx.moveTo(GX, gy);
            ctx.lineTo(GX + COLS * CELL, gy);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(GX, GY, COLS * CELL, ROWS * CELL);
    }

    function drawSnake() {
        var i, seg, px, py, col, t, gVal, hexG;
        var len = snake.length;
        for (i = len - 1; i >= 0; i--) {
            seg = snake[i];
            px = GX + seg.col * CELL;
            py = GY + seg.row * CELL;

            if (i === 0) {
                // Head
                col = headColor(headVal);
                ctx.shadowColor = col;
                ctx.shadowBlur = 16;
                roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 6);
                ctx.fillStyle = col;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Value label
                ctx.fillStyle = '#000';
                ctx.font = 'bold ' + (headVal >= 100 ? '13' : '16') + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(headVal, px + CELL / 2, py + CELL / 2);
                ctx.textBaseline = 'alphabetic';
            } else {
                // Body: fade from head color to dim
                t = i / (len > 1 ? len - 1 : 1);
                gVal = Math.floor(80 - t * 50);
                hexG = gVal.toString(16);
                if (hexG.length < 2) hexG = '0' + hexG;
                ctx.fillStyle = '#00' + hexG + hexG;
                roundRect(px + 3, py + 3, CELL - 6, CELL - 6, 4);
                ctx.fill();
            }
        }
    }

    function drawFoods() {
        var i, food, fx, fy, r, pulse, valStr;
        for (i = 0; i < foods.length; i++) {
            food = foods[i];
            fx = GX + food.col * CELL + CELL / 2;
            fy = GY + food.row * CELL + CELL / 2;
            r = CELL / 2 - 5;
            pulse = 0.88 + 0.12 * Math.sin(animTime * 4 + i * 1.5);
            r = r * pulse;

            var fc = '#fde68a';
            if (food.val === 4) fc = '#86efac';
            if (food.val === 8) fc = '#c084fc';

            ctx.beginPath();
            ctx.arc(fx, fy, r, 0, Math.PI * 2);
            ctx.fillStyle = fc;
            ctx.shadowColor = fc;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#000';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(food.val, fx, fy);
            ctx.textBaseline = 'alphabetic';
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
        ctx.fillText(heartStr, 12, 52);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 12, 52);

        // Head value center-top
        ctx.fillStyle = headColor(headVal);
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('x' + headVal, VW / 2, 52);
    }

    // ── Draw ───────────────────────────────────────────────────────────────────

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.fillStyle = '#67e8f9';
            ctx.shadowColor = '#0ea5e9';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 46px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MERGE SNAKE', VW / 2, VH / 2 - 90);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaa';
            ctx.font = '20px sans-serif';
            ctx.fillText('Eat matching numbers to merge!', VW / 2, VH / 2 - 38);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 20);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '20px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 70);
            }
            ctx.fillStyle = '#556';
            ctx.font = '16px sans-serif';
            ctx.fillText('Tap toward food to steer', VW / 2, VH / 2 + 120);
            return;
        }

        if (flashTimer > 0) {
            ctx.globalAlpha = (flashTimer / 0.45) * 0.4;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = 1;
        }

        drawGrid();
        drawFoods();
        drawSnake();
        drawHUD();

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.74)';
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

    function getBest() { return best; }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
