'use strict';
var SequenceGame = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;

    // Code Breaker / Mastermind
    var COLORS = ['#f87171', '#60a5fa', '#86efac', '#fde68a', '#c084fc'];
    var COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'purple'];
    var CODE_LEN = 4;
    var MAX_ATTEMPTS = 6;

    var secretCode;   // array of 4 color indices
    var guesses;      // array of guess rows: [{colors:[...], blacks:N, whites:N}]
    var currentGuess; // array of 4 color indices (current row being built)
    var attemptCount;
    var gameResult;   // 'win', 'lose', or null

    // Layout
    var HIST_ROW_H = 60;
    var HIST_Y = 100;
    var PEG_R = 22;
    var PEG_GAP = 58;
    var PEGS_X_START = 40; // center of first peg column
    var FEEDBACK_X = 300;
    var CUR_ROW_Y = HIST_Y + MAX_ATTEMPTS * HIST_ROW_H + 20;
    var SUBMIT_BTN_Y = CUR_ROW_Y + 70;
    var SUBMIT_BTN_H = 52;
    var SUBMIT_BTN_X = 60;
    var SUBMIT_BTN_W = VW - 120;

    // ── Helpers ────────────────────────────────────────────────────────────────

    function makeCode() {
        var code = [];
        var i;
        for (i = 0; i < CODE_LEN; i++) {
            code.push(Math.floor(Math.random() * COLORS.length));
        }
        return code;
    }

    function evaluate(guess, code) {
        var blacks = 0, whites = 0;
        var i;
        var gUsed = [false, false, false, false];
        var cUsed = [false, false, false, false];
        for (i = 0; i < CODE_LEN; i++) {
            if (guess[i] === code[i]) { blacks++; gUsed[i] = true; cUsed[i] = true; }
        }
        for (i = 0; i < CODE_LEN; i++) {
            if (gUsed[i]) continue;
            var j;
            for (j = 0; j < CODE_LEN; j++) {
                if (cUsed[j]) continue;
                if (guess[i] === code[j]) { whites++; cUsed[j] = true; break; }
            }
        }
        return { blacks: blacks, whites: whites };
    }

    // ── Game flow ──────────────────────────────────────────────────────────────

    function startGame() {
        score = 0;
        lives = 3;
        newCode();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function newCode() {
        secretCode = makeCode();
        guesses = [];
        currentGuess = [0, 0, 0, 0];
        attemptCount = 0;
        gameResult = null;
    }

    function submitGuess() {
        var result = evaluate(currentGuess, secretCode);
        var row = { colors: currentGuess.slice(), blacks: result.blacks, whites: result.whites };
        guesses.push(row);
        attemptCount++;

        if (result.blacks === CODE_LEN) {
            // WIN this round
            gameResult = 'win';
            var pts = (MAX_ATTEMPTS + 1 - attemptCount) * 100;
            score += pts;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch (e) {}
        } else if (attemptCount >= MAX_ATTEMPTS) {
            // LOSE this round
            gameResult = 'lose';
            lives--;
            try { Audio.play('crash'); } catch (e) {}
            if (lives <= 0) {
                state = 'DEAD';
                if (score > best) best = score;
                try { Audio.play('lose'); } catch (e) {}
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                AdManager.showInterstitial(() => {});
                try { AdManager.offerDoubleScore(score, 'sequencegame_best'); } catch(e) {}
            }
        }

        if (state === 'PLAYING' && (gameResult === 'win' || gameResult === 'lose')) {
            // brief pause handled by player tapping "next"
            // keep gameResult visible, player taps to continue
        }
        currentGuess = [0, 0, 0, 0];
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        // no continuous animation needed
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

        // If round ended (win or lose), tap anywhere to start new code
        if (gameResult !== null) {
            if (lives > 0) newCode();
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        // Tap current guess pegs to cycle color
        var i;
        for (i = 0; i < CODE_LEN; i++) {
            var pegX = PEGS_X_START + i * PEG_GAP;
            var pegY = CUR_ROW_Y;
            var dx = x - pegX;
            var dy = y - pegY;
            if (dx * dx + dy * dy <= (PEG_R + 8) * (PEG_R + 8)) {
                currentGuess[i] = (currentGuess[i] + 1) % COLORS.length;
                try { Audio.play('tap'); } catch (e) {}
                return;
            }
        }

        // Tap submit button
        if (x >= SUBMIT_BTN_X && x <= SUBMIT_BTN_X + SUBMIT_BTN_W &&
            y >= SUBMIT_BTN_Y && y <= SUBMIT_BTN_Y + SUBMIT_BTN_H) {
            submitGuess();
            try { Audio.play('tap'); } catch (e) {}
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

    function drawPeg(cx, cy, r, colorIdx, filled) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (filled) {
            ctx.fillStyle = COLORS[colorIdx];
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            ctx.fillStyle = '#1a2030';
            ctx.fill();
            ctx.strokeStyle = '#445';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    function drawFeedback(cx, cy, blacks, whites) {
        var i, fx, fy;
        var count = 0;
        for (i = 0; i < blacks; i++) {
            fx = cx + (count % 2) * 13;
            fy = cy - 8 + Math.floor(count / 2) * 16;
            ctx.beginPath();
            ctx.arc(fx, fy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.stroke();
            count++;
        }
        for (i = 0; i < whites; i++) {
            fx = cx + (count % 2) * 13;
            fy = cy - 8 + Math.floor(count / 2) * 16;
            ctx.beginPath();
            ctx.arc(fx, fy, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'transparent';
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.stroke();
            count++;
        }
    }

    function drawHistoryRow(rowIdx, guess) {
        var ry = HIST_Y + rowIdx * HIST_ROW_H;
        var i, pegX;

        // Row bg
        ctx.fillStyle = (rowIdx % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, ry, VW, HIST_ROW_H);

        // Row number
        ctx.fillStyle = '#556';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(rowIdx + 1, 10, ry + HIST_ROW_H / 2 + 5);

        if (!guess) {
            // Empty placeholder
            for (i = 0; i < CODE_LEN; i++) {
                pegX = PEGS_X_START + i * PEG_GAP;
                ctx.beginPath();
                ctx.arc(pegX, ry + HIST_ROW_H / 2, 18, 0, Math.PI * 2);
                ctx.fillStyle = '#1a2030';
                ctx.fill();
                ctx.strokeStyle = '#334';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            return;
        }

        for (i = 0; i < CODE_LEN; i++) {
            pegX = PEGS_X_START + i * PEG_GAP;
            drawPeg(pegX, ry + HIST_ROW_H / 2, 18, guess.colors[i], true);
        }
        drawFeedback(FEEDBACK_X, ry + HIST_ROW_H / 2, guess.blacks, guess.whites);
    }

    function drawCurrentRow() {
        var i, pegX;
        // Glow background
        ctx.fillStyle = 'rgba(255,255,100,0.06)';
        ctx.fillRect(0, CUR_ROW_Y - PEG_R - 10, VW, PEG_R * 2 + 20);
        ctx.strokeStyle = 'rgba(255,255,100,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, CUR_ROW_Y - PEG_R - 10, VW, PEG_R * 2 + 20);

        for (i = 0; i < CODE_LEN; i++) {
            pegX = PEGS_X_START + i * PEG_GAP;
            ctx.shadowColor = COLORS[currentGuess[i]];
            ctx.shadowBlur = 12;
            drawPeg(pegX, CUR_ROW_Y, PEG_R, currentGuess[i], true);
            ctx.shadowBlur = 0;
        }

        // Attempt counter
        ctx.fillStyle = '#778';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText((attemptCount + 1) + '/' + MAX_ATTEMPTS, VW - 16, CUR_ROW_Y + 5);
    }

    function drawSubmitBtn() {
        ctx.fillStyle = '#1a7a33';
        roundRect(SUBMIT_BTN_X, SUBMIT_BTN_Y, SUBMIT_BTN_W, SUBMIT_BTN_H, 10);
        ctx.fill();
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SUBMIT', VW / 2, SUBMIT_BTN_Y + 34);
    }

    function drawResultOverlay() {
        var msg, col;
        if (gameResult === 'win') {
            msg = 'CORRECT!';
            col = '#2ecc71';
        } else {
            msg = 'WRONG!  Code was:';
            col = '#e74c3c';
        }

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, CUR_ROW_Y - 40, VW, 200);
        ctx.fillStyle = col;
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(msg, VW / 2, CUR_ROW_Y + 10);

        if (gameResult === 'lose') {
            var i, px;
            for (i = 0; i < CODE_LEN; i++) {
                px = PEGS_X_START + i * PEG_GAP;
                drawPeg(px, CUR_ROW_Y + 50, 18, secretCode[i], true);
            }
        }

        ctx.fillStyle = '#aaffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('TAP TO CONTINUE', VW / 2, CUR_ROW_Y + (gameResult === 'lose' ? 110 : 60));
    }

    // ── Draw ───────────────────────────────────────────────────────────────────

    function draw() {
        if (!ctx) return;
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.fillStyle = '#c084fc';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 30;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SEQUENCE GAME', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaa';
            ctx.font = '20px sans-serif';
            ctx.fillText('Guess the 4-color code!', VW / 2, VH / 2 - 28);
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

        // HUD
        var i, heartStr;
        heartStr = '';
        for (i = 0; i < lives; i++) heartStr += '♥';
        for (i = lives; i < 3; i++) heartStr += '♡';
        ctx.fillStyle = '#ff4444';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(heartStr, 12, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(score, VW - 12, 50);

        // Column header dots (color swatches)
        for (i = 0; i < CODE_LEN; i++) {
            ctx.beginPath();
            ctx.arc(PEGS_X_START + i * PEG_GAP, 75, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#334';
            ctx.fill();
        }
        ctx.fillStyle = '#556';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FEEDBACK', FEEDBACK_X, 80);

        // History rows
        for (i = 0; i < MAX_ATTEMPTS; i++) {
            drawHistoryRow(i, guesses[i] || null);
        }

        if (gameResult !== null) {
            drawResultOverlay();
        } else {
            drawCurrentRow();
            drawSubmitBtn();
        }

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.78)';
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

    // ── Init ───────────────────────────────────────────────────────────────────

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
    }

    function getBest() { return best; }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
