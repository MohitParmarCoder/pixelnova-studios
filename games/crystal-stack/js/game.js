'use strict';
var CrystalStack = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives, moveCount;
    var selectedTube;   // index -1 = none
    var tubes;          // array of 5 arrays of color strings (bottom of array = bottom of tube)
    var MAX_BALLS = 4;
    var NUM_TUBES = 5;
    var TUBE_W = 48, TUBE_H = 200;
    var BALL_R = 18;
    var flashTimer;     // used for win flash
    var winFlash;
    var puzzleNum;

    var COLORS = ['#f87171', '#60a5fa', '#86efac', '#fde68a'];
    var COLOR_NAMES = ['red', 'blue', 'green', 'yellow'];

    function tubeX(i) {
        // 5 tubes evenly spaced across VW
        var totalW = NUM_TUBES * TUBE_W + (NUM_TUBES - 1) * 18;
        var startX = (VW - totalW) / 2;
        return startX + i * (TUBE_W + 18);
    }

    function tubeY() {
        return VH / 2 - 30;
    }

    function generatePuzzle() {
        // Build a guaranteed-solvable puzzle by starting from the solved state
        // and applying 200 random valid moves (reverse-shuffle approach).
        // A valid move: take the top ball from a non-empty tube and push it
        // onto a tube that is (a) not full and (b) empty OR has the same color
        // on top. Reversing any sequence of valid moves is itself a sequence of
        // valid moves, so the resulting state is always solvable.

        // Start from solved state: tube[0..3] each filled with one color, tube[4] empty.
        tubes = [];
        for (var ci = 0; ci < 4; ci++) {
            var tube = [];
            for (var bi = 0; bi < MAX_BALLS; bi++) {
                tube.push(COLORS[ci]);
            }
            tubes.push(tube);
        }
        tubes.push([]); // 5th tube empty

        // Perform random valid moves to shuffle into a solvable state.
        // 500 moves provides thorough mixing while still being instantaneous.
        var SHUFFLE_MOVES = 500;
        for (var m = 0; m < SHUFFLE_MOVES; m++) {
            // Collect all valid (src, dst) pairs for this state.
            var validMoves = [];
            for (var src = 0; src < NUM_TUBES; src++) {
                if (tubes[src].length === 0) { continue; }
                var topBall = tubes[src][tubes[src].length - 1];
                for (var dst = 0; dst < NUM_TUBES; dst++) {
                    if (dst === src) { continue; }
                    if (tubes[dst].length >= MAX_BALLS) { continue; }
                    // Destination must be empty or have same top color
                    if (tubes[dst].length === 0 ||
                        tubes[dst][tubes[dst].length - 1] === topBall) {
                        validMoves.push([src, dst]);
                    }
                }
            }
            if (validMoves.length === 0) { break; } // shouldn't happen, but guard
            var pick = validMoves[Math.floor(Math.random() * validMoves.length)];
            tubes[pick[1]].push(tubes[pick[0]].pop());
        }

        // If the shuffle happened to land on the solved state (rare but possible),
        // force one extra move to ensure the player has something to do.
        // A solved state has every non-empty tube filled with 4 of the same color.
        var isSolved = true;
        for (var s = 0; s < NUM_TUBES; s++) {
            if (tubes[s].length === 0) { continue; }
            if (tubes[s].length !== MAX_BALLS) { isSolved = false; break; }
            var c0 = tubes[s][0];
            for (var b = 1; b < tubes[s].length; b++) {
                if (tubes[s][b] !== c0) { isSolved = false; break; }
            }
            if (!isSolved) { break; }
        }
        if (isSolved) {
            // Find any non-empty tube with room on another tube and make one move
            for (var fi = 0; fi < NUM_TUBES && isSolved; fi++) {
                if (tubes[fi].length === 0) { continue; }
                for (var fj = 0; fj < NUM_TUBES && isSolved; fj++) {
                    if (fj === fi) { continue; }
                    if (tubes[fj].length < MAX_BALLS) {
                        tubes[fj].push(tubes[fi].pop());
                        isSolved = false;
                    }
                }
            }
        }

        selectedTube = -1;
        moveCount = 0;
    }

    function checkWin() {
        // Each tube must be empty OR have 4 balls all same color
        for (var i = 0; i < NUM_TUBES; i++) {
            var tube = tubes[i];
            if (tube.length === 0) { continue; }
            if (tube.length !== MAX_BALLS) { return false; }
            var col = tube[0];
            for (var j = 1; j < tube.length; j++) {
                if (tube[j] !== col) { return false; }
            }
        }
        return true;
    }

    function startGame() {
        score = 0;
        lives = 3;
        puzzleNum = 1;
        winFlash = false;
        flashTimer = 0;
        generatePuzzle();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function endGame() {
        if (score > best) { best = score; AdManager.happyTime(1.0); }
        state = 'DEAD';
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'crystalstack_best'); } catch(e) {}
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        if (state !== 'PLAYING') { return; }
        if (flashTimer > 0) {
            flashTimer -= dt;
            if (flashTimer <= 0 && winFlash) {
                winFlash = false;
                // Start next puzzle
                puzzleNum++;
                generatePuzzle();
            }
        }
    }

    function roundedRect(x, y, w, h, rad) {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.lineTo(x + w - rad, y);
        ctx.arcTo(x + w, y, x + w, y + rad, rad);
        ctx.lineTo(x + w, y + h - rad);
        ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
        ctx.lineTo(x + rad, y + h);
        ctx.arcTo(x, y + h, x, y + h - rad, rad);
        ctx.lineTo(x, y + rad);
        ctx.arcTo(x, y, x + rad, y, rad);
        ctx.closePath();
    }

    function drawTube(i) {
        var x = tubeX(i);
        var ty = tubeY();
        var tube = tubes[i];
        var isSelected = (selectedTube === i);

        ctx.save();

        // Draw tube outline (tall rounded rect, open at top)
        ctx.strokeStyle = isSelected ? '#ffffff' : '#334466';
        ctx.lineWidth = isSelected ? 3 : 2;
        if (isSelected) {
            ctx.shadowColor = '#aaddff';
            ctx.shadowBlur = 18;
        }

        // Tube body
        ctx.fillStyle = 'rgba(10, 15, 35, 0.8)';
        roundedRect(x, ty - TUBE_H, TUBE_W, TUBE_H, 10);
        ctx.fill();
        ctx.stroke();

        // Draw ball slots (empty circles as guides)
        for (var slot = 0; slot < MAX_BALLS; slot++) {
            var ballY = ty - 14 - slot * (BALL_R * 2 + 4);
            if (slot >= tube.length) {
                // Empty slot hint
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.arc(x + TUBE_W / 2, ballY, BALL_R - 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw balls
        for (var bi = 0; bi < tube.length; bi++) {
            var col = tube[bi];
            var bx = x + TUBE_W / 2;
            var by = ty - 14 - bi * (BALL_R * 2 + 4);

            // Ball gradient glow
            ctx.save();
            ctx.shadowColor = col;
            ctx.shadowBlur = 12;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            ctx.arc(bx - BALL_R * 0.25, by - BALL_R * 0.25, BALL_R * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    function drawLives() {
        ctx.save();
        ctx.font = 'bold 22px sans-serif';
        ctx.textBaseline = 'middle';
        for (var i = 0; i < 3; i++) {
            ctx.fillStyle = i < lives ? '#ff4444' : '#442222';
            ctx.fillText(i < lives ? '♥' : '♡', 18 + i * 28, 28);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    function draw() {
        if (!ctx) { return; }
        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.textAlign = 'center';
            ctx.shadowColor = '#f87171';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 52px sans-serif';
            ctx.fillText('CRYSTAL', VW / 2, VH / 2 - 80);
            ctx.fillStyle = '#60a5fa';
            ctx.shadowColor = '#60a5fa';
            ctx.fillText('STACK', VW / 2, VH / 2 - 18);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            ctx.fillStyle = '#aaaacc';
            ctx.font = '18px sans-serif';
            ctx.fillText('Sort colored balls into tubes!', VW / 2, VH / 2 + 108);
            ctx.fillText('Tap to select, tap again to move', VW / 2, VH / 2 + 138);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '20px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 190);
            }
            return;
        }

        if (state === 'PLAYING' || state === 'DEAD') {
            // Win flash overlay
            if (winFlash && flashTimer > 0) {
                var alpha = Math.sin(flashTimer * 8) * 0.3 + 0.1;
                ctx.fillStyle = 'rgba(100,255,150,' + alpha + ')';
                ctx.fillRect(0, 0, VW, VH);
            }

            // Draw all tubes
            for (var i = 0; i < NUM_TUBES; i++) {
                drawTube(i);
            }

            // HUD
            drawLives();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(score, VW - 16, 44);
            ctx.textAlign = 'left';

            // Move count bottom
            ctx.fillStyle = '#8899aa';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Moves: ' + moveCount + '  |  Puzzle ' + puzzleNum, VW / 2, VH - 30);

            // Hint: over-move warning
            if (moveCount >= 25) {
                ctx.fillStyle = '#ff8800';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText('Too many moves! Lose a life at 30', VW / 2, VH - 55);
            }
        }

        if (state === 'DEAD') {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 28;
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 56px sans-serif';
            ctx.fillText('GAME OVER', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('SCORE: ' + score, VW / 2, VH / 2 - 10);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 38);
            ctx.fillStyle = '#aaffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 100);
        }
    }

    function tap(x, y) {
        if (state === 'MENU') { startGame(); return; }
        if (state === 'DEAD') { startGame(); return; }
        if (state !== 'PLAYING') { return; }
        if (winFlash) { return; }

        // Find which tube was tapped.
        // Use a generous hit zone: a tall vertical band covering the tubes,
        // and snap horizontally to the nearest tube column (gaps count toward
        // the closer tube). This makes tapping forgiving for players.
        var ty = tubeY();
        var bandTop = ty - TUBE_H - 60;
        var bandBot = ty + 60;
        var tappedTube = -1;
        if (y >= bandTop && y <= bandBot) {
            var bestDist = 1e9;
            for (var i = 0; i < NUM_TUBES; i++) {
                var cx = tubeX(i) + TUBE_W / 2;
                var d = Math.abs(x - cx);
                if (d < bestDist) { bestDist = d; tappedTube = i; }
            }
            // Reject taps that are far outside the tube spread
            if (bestDist > TUBE_W / 2 + 18) { tappedTube = -1; }
        }

        if (tappedTube === -1) {
            // Tapped well outside the tubes — deselect
            selectedTube = -1;
            return;
        }

        if (selectedTube === -1) {
            // Select this tube if it has balls
            if (tubes[tappedTube].length > 0) {
                selectedTube = tappedTube;
                try { Audio.play('tap'); } catch (e) {}
            }
            return;
        }

        if (tappedTube === selectedTube) {
            // Deselect
            selectedTube = -1;
            return;
        }

        // Try to move top ball from selectedTube to tappedTube
        var srcTube = tubes[selectedTube];
        var dstTube = tubes[tappedTube];

        if (srcTube.length === 0) {
            selectedTube = tappedTube;
            return;
        }

        if (dstTube.length >= MAX_BALLS) {
            // Destination full — reselect destination
            selectedTube = tappedTube;
            try { Audio.play('tap'); } catch (e) {}
            return;
        }

        // Move top ball
        var ball = srcTube[srcTube.length - 1];
        srcTube.pop();
        dstTube.push(ball);
        moveCount++;
        try { Audio.play('tap'); } catch (e) {}
        selectedTube = -1;

        // Check over-move penalty (> 30 moves)
        if (moveCount > 30) {
            lives--;
            try { Audio.play('crash'); } catch (e) {}
            moveCount = 0; // reset move count, give them another 30
            if (lives <= 0) { endGame(); return; }
        }

        // Check win
        if (checkWin()) {
            var bonus = Math.max(10, 100 - moveCount * 2);
            score += bonus;
            if (score > best) { best = score; AdManager.happyTime(1.0); }
            try { Audio.play('gem'); } catch (e) {}
            winFlash = true;
            flashTimer = 1.2;
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
