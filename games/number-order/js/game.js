'use strict';
var NumberOrder = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives, streak;
    var question;       // {text, correct, answers:[{val,x,y,w,h}]}
    var timeLeft;       // seconds remaining for current question
    var qCount;         // total questions answered
    var flashIdx;       // which button is flashing (-1 none)
    var flashCorrect;   // true = green, false = red
    var flashTimer;
    var QUESTION_TIME = 4;
    var BTN_W = 160, BTN_H = 70;

    function randInt(lo, hi) {
        return lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    function getOps() {
        var ops = ['+'];
        if (score >= 20) { ops.push('-'); }
        if (score >= 50) { ops.push('x'); }
        return ops;
    }

    function generateQuestion() {
        var ops = getOps();
        var op = ops[Math.floor(Math.random() * ops.length)];
        var a, b, correct;
        if (op === '+') {
            a = randInt(1, 20);
            b = randInt(1, 20);
            correct = a + b;
        } else if (op === '-') {
            b = randInt(1, 20);
            a = randInt(b, 20 + b);
            correct = a - b;
        } else {
            a = randInt(1, 9);
            b = randInt(1, 9);
            correct = a * b;
        }
        var opSymbol = op === 'x' ? '×' : op;
        var text = a + ' ' + opSymbol + ' ' + b + ' = ?';

        // Build 4 plausible answers (1 correct + 3 wrong)
        var wrongSet = {};
        wrongSet[correct] = true;
        var wrongs = [];
        var attempts = 0;
        while (wrongs.length < 3 && attempts < 100) {
            attempts++;
            var delta = randInt(1, 6) * (Math.random() < 0.5 ? 1 : -1);
            var w = correct + delta;
            if (w < 0) { w = correct + Math.abs(delta); }
            if (!wrongSet[w]) {
                wrongSet[w] = true;
                wrongs.push(w);
            }
        }
        // Shuffle all 4 answers
        var all = [correct, wrongs[0], wrongs[1], wrongs[2]];
        for (var i = all.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = all[i]; all[i] = all[j]; all[j] = tmp;
        }
        // Lay out 2x2 grid at bottom-center of screen
        var gridLeft = (VW - (BTN_W * 2 + 20)) / 2;
        var gridTop = VH * 0.55;
        var answers = [];
        for (var r = 0; r < 2; r++) {
            for (var c = 0; c < 2; c++) {
                var idx = r * 2 + c;
                answers.push({
                    val: all[idx],
                    x: gridLeft + c * (BTN_W + 20),
                    y: gridTop + r * (BTN_H + 20),
                    w: BTN_W,
                    h: BTN_H
                });
            }
        }
        return { text: text, correct: correct, answers: answers };
    }

    function startGame() {
        score = 0;
        lives = 3;
        streak = 0;
        qCount = 0;
        flashIdx = -1;
        flashTimer = 0;
        question = generateQuestion();
        timeLeft = QUESTION_TIME;
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function nextQuestion() {
        qCount++;
        question = generateQuestion();
        timeLeft = QUESTION_TIME;
        flashIdx = -1;
        flashTimer = 0;
    }

    function endGame() {
        if (score > best) { best = score; }
        state = 'DEAD';
        try { Audio.play('lose'); } catch (e) {}
        try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'numberorder_best'); } catch(e) {}
    }

    function update(dt) {
        if (state !== 'PLAYING') { return; }

        if (flashTimer > 0) {
            flashTimer -= dt;
            if (flashTimer <= 0) {
                flashIdx = -1;
                flashTimer = 0;
                if (lives <= 0) { endGame(); return; }
                nextQuestion(); // load next question after flash completes
            }
            return; // pause timer while flashing answer
        }

        timeLeft -= dt;
        if (timeLeft <= 0) {
            // Timeout — lose a life
            timeLeft = 0;
            lives--;
            streak = 0;
            try { Audio.play('crash'); } catch (e) {}
            if (lives <= 0) { endGame(); return; }
            nextQuestion();
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

    function drawButton(btn, idx) {
        ctx.save();
        var isFlash = (flashIdx === idx);
        var bg = '#1a2a4a';
        if (isFlash) {
            bg = flashCorrect ? '#145214' : '#521414';
        }
        ctx.shadowColor = isFlash ? (flashCorrect ? '#44ff44' : '#ff4444') : '#224488';
        ctx.shadowBlur = isFlash ? 20 : 8;
        ctx.fillStyle = bg;
        roundedRect(btn.x, btn.y, btn.w, btn.h, 14);
        ctx.fill();
        ctx.strokeStyle = isFlash ? (flashCorrect ? '#66ff66' : '#ff6666') : '#3355aa';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(btn.val, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.textBaseline = 'alphabetic';
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
            ctx.shadowColor = '#44aaff';
            ctx.shadowBlur = 22;
            ctx.fillStyle = '#44aaff';
            ctx.font = 'bold 52px sans-serif';
            ctx.fillText('NUMBER', VW / 2, VH / 2 - 80);
            ctx.fillStyle = '#ff9900';
            ctx.shadowColor = '#ff9900';
            ctx.fillText('ORDER', VW / 2, VH / 2 - 18);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);
            ctx.fillStyle = '#aaaacc';
            ctx.font = '18px sans-serif';
            ctx.fillText('Answer fast for more points!', VW / 2, VH / 2 + 108);
            ctx.fillText('+  −  ×  operations', VW / 2, VH / 2 + 138);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '20px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 190);
            }
            return;
        }

        if (state === 'PLAYING' || state === 'DEAD') {
            // Timer bar (top of screen)
            var barW = VW - 40;
            var barFrac = Math.max(0, timeLeft / QUESTION_TIME);
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(20, 58, barW, 12);
            var barColor = barFrac > 0.5 ? '#44dd88' : barFrac > 0.25 ? '#ffcc00' : '#ff4444';
            ctx.fillStyle = barColor;
            ctx.fillRect(20, 58, barW * barFrac, 12);
            ctx.strokeStyle = '#334466';
            ctx.lineWidth = 1;
            ctx.strokeRect(20, 58, barW, 12);

            // HUD
            drawLives();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(score, VW - 16, 44);
            ctx.textAlign = 'left';

            // Question counter
            ctx.fillStyle = '#888899';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Q ' + (qCount + 1), VW / 2, 48);

            // Streak indicator
            if (streak >= 2) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText(streak + 'x STREAK!', VW / 2, 90);
            }

            // Question text
            ctx.shadowColor = '#4488ff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(question.text, VW / 2, VH * 0.38);
            ctx.shadowBlur = 0;

            // Buttons
            for (var i = 0; i < question.answers.length; i++) {
                drawButton(question.answers[i], i);
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
        if (flashTimer > 0) { return; } // ignore taps while flashing

        for (var i = 0; i < question.answers.length; i++) {
            var btn = question.answers[i];
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                try { Audio.play('tap'); } catch (e) {}
                flashIdx = i;
                flashTimer = 0.45;
                if (btn.val === question.correct) {
                    // Correct!
                    flashCorrect = true;
                    streak++;
                    var pts = Math.max(5, Math.floor(10 * timeLeft / QUESTION_TIME));
                    if (streak > 0 && streak % 3 === 0) { pts += 5; } // streak bonus
                    score += pts;
                    if (score > best) { best = score; }
                    try { Audio.play('gem'); } catch (e) {}
                    // nextQuestion() will be called by update() when flashTimer expires
                } else {
                    // Wrong
                    flashCorrect = false;
                    streak = 0;
                    lives--;
                    try { Audio.play('crash'); } catch (e) {}
                    if (lives <= 0) {
                        // Flash briefly, then update() will call endGame() after timer expires
                        flashTimer = 0.3;
                        return;
                    }
                    // nextQuestion() will be called by update() when flashTimer expires
                }
                return;
            }
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
