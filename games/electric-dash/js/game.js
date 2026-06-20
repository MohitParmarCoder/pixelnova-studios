'use strict';
var ElectricDash = (function () {
    var VW = 390, VH = 844;
    var canvas, ctx;
    var state = 'MENU';
    var best = 0;
    var score, lives;
    var grid;
    var rotCount;
    var powered;
    var pulseT;

    var COLS = 5, ROWS = 7;
    var CELL = 60;
    var GRID_X = (VW - COLS * CELL) / 2;
    var GRID_Y = 80;

    var WIRE_DEFS = {
        STRAIGHT: [1, 0, 1, 0],
        CORNER:   [1, 1, 0, 0],
        TEE:      [1, 1, 0, 1],
        CROSS:    [1, 1, 1, 1]
    };
    var WIRE_TYPES = ['STRAIGHT', 'CORNER', 'TEE', 'CROSS'];

    function rotateConns(conns, r) {
        var c = conns.slice();
        var i, last;
        for (i = 0; i < r; i++) {
            last = c.pop();
            c.unshift(last);
        }
        return c;
    }

    function getConns(cell) {
        return rotateConns(WIRE_DEFS[cell.type], cell.rot);
    }

    function makeCell(type, rot) {
        return { type: type, rot: rot, fixed: false };
    }

    // Given a wire type's base connections and a rotation, return rotated connections.
    // Then check if directions `need` (array of direction indices) are all open.
    function wireMatchesNeeds(type, rot, needs) {
        var c = rotateConns(WIRE_DEFS[type], rot);
        for (var i = 0; i < needs.length; i++) {
            if (!c[needs[i]]) return false;
        }
        return true;
    }

    // Pick a wire type + rotation that has open connections in all directions in `needs`
    // and is NOT open in the direction `block` (so it doesn't leak backward, optional -1).
    function pickWire(needs, block) {
        // Shuffle types and rotations to avoid bias
        var types = WIRE_TYPES.slice();
        for (var i = types.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = types[i]; types[i] = types[j]; types[j] = tmp;
        }
        var rots = [0, 1, 2, 3];
        for (var a = rots.length - 1; a > 0; a--) {
            var b = Math.floor(Math.random() * (a + 1));
            var t2 = rots[a]; rots[a] = rots[b]; rots[b] = t2;
        }
        for (var ti = 0; ti < types.length; ti++) {
            for (var ri = 0; ri < rots.length; ri++) {
                if (wireMatchesNeeds(types[ti], rots[ri], needs)) {
                    var c2 = rotateConns(WIRE_DEFS[types[ti]], rots[ri]);
                    // If block direction specified, prefer wires that don't open that side
                    if (block >= 0 && c2[block]) continue;
                    return { type: types[ti], rot: rots[ri] };
                }
            }
        }
        // Fallback: any match ignoring block constraint
        for (var ti2 = 0; ti2 < types.length; ti2++) {
            for (var ri2 = 0; ri2 < rots.length; ri2++) {
                if (wireMatchesNeeds(types[ti2], rots[ri2], needs)) {
                    return { type: types[ti2], rot: rots[ri2] };
                }
            }
        }
        // Should never reach here; return CROSS as last resort
        return { type: 'CROSS', rot: 0 };
    }

    function buildPuzzle() {
        grid = [];
        var r, c;

        // Initialize grid with random filler cells
        for (r = 0; r < ROWS; r++) {
            grid[r] = [];
            for (c = 0; c < COLS; c++) {
                var tp = WIRE_TYPES[Math.floor(Math.random() * WIRE_TYPES.length)];
                var ro = Math.floor(Math.random() * 4);
                grid[r][c] = makeCell(tp, ro);
            }
        }

        // Place fixed SOURCE and SINK
        grid[0][0] = { type: 'SOURCE', rot: 0, fixed: true };
        grid[ROWS - 1][COLS - 1] = { type: 'SINK', rot: 0, fixed: true };

        // Generate a random walk path from SOURCE (0,0) to SINK (ROWS-1, COLS-1).
        // Directions: 0=N,1=E,2=S,3=W
        var dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        var opposite = [2, 3, 0, 1];
        var path = [{ r: 0, c: 0 }];
        var visited = [];
        for (r = 0; r < ROWS; r++) {
            visited[r] = [];
            for (c = 0; c < COLS; c++) visited[r][c] = false;
        }
        visited[0][0] = true;

        // Random walk with backtracking to guarantee reaching SINK
        var maxSteps = ROWS * COLS * 4;
        var steps = 0;
        while (path.length > 0 && steps < maxSteps) {
            steps++;
            var cur = path[path.length - 1];
            if (cur.r === ROWS - 1 && cur.c === COLS - 1) break; // reached SINK

            // Shuffle available directions
            var dOrder = [0, 1, 2, 3];
            for (var i = dOrder.length - 1; i > 0; i--) {
                var jj = Math.floor(Math.random() * (i + 1));
                var tt = dOrder[i]; dOrder[i] = dOrder[jj]; dOrder[jj] = tt;
            }

            var moved = false;
            for (var di = 0; di < 4; di++) {
                var d = dOrder[di];
                var nr = cur.r + dirs[d][0];
                var nc = cur.c + dirs[d][1];
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                if (visited[nr][nc]) continue;
                visited[nr][nc] = true;
                path.push({ r: nr, c: nc });
                moved = true;
                break;
            }
            if (!moved) {
                // Backtrack
                visited[cur.r][cur.c] = false;
                path.pop();
            }
        }

        // If walk didn't reach SINK, fall back to a deterministic L-shaped path
        if (path.length === 0 || path[path.length - 1].r !== ROWS - 1 || path[path.length - 1].c !== COLS - 1) {
            path = [{ r: 0, c: 0 }];
            for (c = 1; c < COLS; c++) path.push({ r: 0, c: c });
            for (r = 1; r < ROWS; r++) path.push({ r: r, c: COLS - 1 });
        }

        // Assign wire types to intermediate path cells based on entry/exit directions
        for (var pi = 1; pi < path.length - 1; pi++) {
            var prev = path[pi - 1];
            var next = path[pi + 1];
            var here = path[pi];

            // Direction from prev to here
            var dr1 = here.r - prev.r, dc1 = here.c - prev.c;
            var entryFrom = -1; // direction we came FROM (the side the wire must be open toward prev)
            for (var dd = 0; dd < 4; dd++) {
                if (dirs[dd][0] === dr1 && dirs[dd][1] === dc1) { entryFrom = dd; break; }
            }
            // Direction from here to next
            var dr2 = next.r - here.r, dc2 = next.c - here.c;
            var exitTo = -1;
            for (var de = 0; de < 4; de++) {
                if (dirs[de][0] === dr2 && dirs[de][1] === dc2) { exitTo = de; break; }
            }

            // The wire at `here` must be open toward opposite[entryFrom] (back to prev) and exitTo (toward next)
            var needs = [opposite[entryFrom], exitTo];
            // Block the opposite of exit to avoid accidental forward leak confusing the path
            // (not strictly necessary, but keeps puzzles cleaner)
            var blockDir = opposite[exitTo];
            // Don't block the entryFrom side — it must stay open
            if (blockDir === opposite[entryFrom]) blockDir = -1;

            var chosen = pickWire(needs, blockDir);
            grid[here.r][here.c] = makeCell(chosen.type, chosen.rot);
        }

        rotCount = 0;
        powered = buildPowered();
    }

    function sourceConns() { return [0, 1, 1, 0]; }
    function sinkConns()   { return [1, 0, 0, 1]; }

    function cellConns(r, c) {
        var cell = grid[r][c];
        if (cell.type === 'SOURCE') return sourceConns();
        if (cell.type === 'SINK')   return sinkConns();
        return getConns(cell);
    }

    function buildPowered() {
        var p = [], r, c;
        for (r = 0; r < ROWS; r++) {
            p[r] = [];
            for (c = 0; c < COLS; c++) p[r][c] = false;
        }
        var queue = [{ r: 0, c: 0 }];
        p[0][0] = true;
        var dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        var opposite = [2, 3, 0, 1];
        while (queue.length > 0) {
            var cur = queue.shift();
            var curConns = cellConns(cur.r, cur.c);
            var d, nr, nc;
            for (d = 0; d < 4; d++) {
                if (!curConns[d]) continue;
                nr = cur.r + dirs[d][0];
                nc = cur.c + dirs[d][1];
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                if (p[nr][nc]) continue;
                var nConns = cellConns(nr, nc);
                if (nConns[opposite[d]]) {
                    p[nr][nc] = true;
                    queue.push({ r: nr, c: nc });
                }
            }
        }
        return p;
    }

    function isSolved() {
        return powered[ROWS - 1][COLS - 1];
    }

    function startGame() {
        score = 0;
        lives = 3;
        pulseT = 0;
        buildPuzzle();
        state = 'PLAYING';
        try { AdManager.gameplayStart(); } catch (e) {}
    }

    function update(dt) {
  if (dt > 0.05) dt = 0.05;
        pulseT += dt;
    }

    function drawWire(cellX, cellY, conns, isPowered) {
        var cx = cellX + CELL / 2, cy = cellY + CELL / 2;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        if (isPowered) {
            ctx.strokeStyle = '#a8edea';
            ctx.shadowColor = '#00ffee';
            ctx.shadowBlur = 12;
        } else {
            ctx.strokeStyle = '#334444';
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        if (conns[0]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cellY); }
        if (conns[1]) { ctx.moveTo(cx, cy); ctx.lineTo(cellX + CELL, cy); }
        if (conns[2]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cellY + CELL); }
        if (conns[3]) { ctx.moveTo(cx, cy); ctx.lineTo(cellX, cy); }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawPowerSymbol(cx, cy, size) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.5, Math.PI * 0.2, Math.PI * 1.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.6);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawBulbSymbol(cx, cy, size, lit) {
        ctx.fillStyle = lit ? '#ffff00' : '#885500';
        ctx.shadowColor = lit ? '#ffff00' : 'transparent';
        ctx.shadowBlur = lit ? 14 : 0;
        ctx.beginPath();
        ctx.arc(cx, cy - size * 0.1, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = lit ? '#ffaa00' : '#553300';
        ctx.fillRect(cx - size * 0.2, cy + size * 0.25, size * 0.4, size * 0.2);
        ctx.shadowBlur = 0;
    }

    function draw() {
        if (!ctx) return;

        ctx.fillStyle = '#04050e';
        ctx.fillRect(0, 0, VW, VH);

        if (state === 'MENU') {
            ctx.fillStyle = '#00ccff';
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 28;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ELECTRIC DASH', VW / 2, VH / 2 - 80);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 10);
            if (best > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '22px sans-serif';
                ctx.fillText('BEST: ' + best, VW / 2, VH / 2 + 60);
            }
            ctx.fillStyle = '#aaddff';
            ctx.font = '18px sans-serif';
            ctx.fillText('Rotate wires to complete circuit!', VW / 2, VH / 2 + 110);
            ctx.textAlign = 'left';
            return;
        }

        var r, c, cx, cy, cell, conns, isPow, i;
        for (r = 0; r < ROWS; r++) {
            for (c = 0; c < COLS; c++) {
                cx = GRID_X + c * CELL;
                cy = GRID_Y + r * CELL;
                isPow = powered[r][c];

                ctx.fillStyle = isPow ? '#0a1f1e' : '#0d0f14';
                ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
                ctx.strokeStyle = isPow ? '#225555' : '#1a1c22';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx + 2, cy + 2, CELL - 4, CELL - 4);

                cell = grid[r][c];
                if (cell.type === 'SOURCE') {
                    ctx.fillStyle = '#332200';
                    ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
                    ctx.strokeStyle = '#ffdd00';
                    ctx.shadowColor = '#ffdd00';
                    ctx.shadowBlur = 12;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx + 3, cy + 3, CELL - 6, CELL - 6);
                    ctx.shadowBlur = 0;
                    drawPowerSymbol(cx + CELL / 2, cy + CELL / 2, 22);
                    ctx.lineWidth = 6;
                    ctx.strokeStyle = '#a8edea';
                    ctx.shadowColor = '#00ffee';
                    ctx.shadowBlur = 12;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(cx + CELL / 2, cy + CELL / 2);
                    ctx.lineTo(cx + CELL, cy + CELL / 2);
                    ctx.moveTo(cx + CELL / 2, cy + CELL / 2);
                    ctx.lineTo(cx + CELL / 2, cy + CELL);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                } else if (cell.type === 'SINK') {
                    ctx.fillStyle = '#332200';
                    ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
                    ctx.strokeStyle = isPow ? '#ffdd00' : '#885500';
                    ctx.shadowColor = isPow ? '#ffdd00' : 'transparent';
                    ctx.shadowBlur = isPow ? 12 : 0;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx + 3, cy + 3, CELL - 6, CELL - 6);
                    ctx.shadowBlur = 0;
                    drawBulbSymbol(cx + CELL / 2, cy + CELL / 2, 22, isPow);
                    ctx.lineWidth = 6;
                    ctx.strokeStyle = isPow ? '#a8edea' : '#334444';
                    ctx.shadowColor = '#00ffee';
                    ctx.shadowBlur = isPow ? 12 : 0;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(cx + CELL / 2, cy + CELL / 2);
                    ctx.lineTo(cx + CELL / 2, cy);
                    ctx.moveTo(cx + CELL / 2, cy + CELL / 2);
                    ctx.lineTo(cx, cy + CELL / 2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                } else {
                    conns = cellConns(r, c);
                    drawWire(cx, cy, conns, isPow);
                }
            }
        }

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

        ctx.fillStyle = rotCount >= 15 ? '#ff8800' : '#88aaff';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROT: ' + rotCount + '/20', VW / 2, 44);
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

        var gc = Math.floor((x - GRID_X) / CELL);
        var gr = Math.floor((y - GRID_Y) / CELL);
        if (gr < 0 || gr >= ROWS || gc < 0 || gc >= COLS) return;

        var cell = grid[gr][gc];
        if (cell.fixed || cell.type === 'SOURCE' || cell.type === 'SINK') return;

        cell.rot = (cell.rot + 1) % 4;
        rotCount++;
        try { Audio.play('tap'); } catch (e) {}

        powered = buildPowered();

        if (isSolved()) {
            var pts = Math.max(10, 100 - rotCount * 3);
            score += pts;
            if (score > best) best = score;
            try { Audio.play('gem'); } catch (e) {}
            buildPuzzle();
        } else if (rotCount >= 20) {
            lives--;
            try { Audio.play('crash'); } catch (e) {}
            if (lives <= 0) {
                state = 'DEAD';
                try { Audio.play('lose'); } catch (e) {}
                try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
                AdManager.showInterstitial(() => {});
                try { AdManager.offerDoubleScore(score, 'electricdash_best'); } catch(e) {}
            } else {
                buildPuzzle();
            }
        }
    }

    function getBest() { return best; }

    function init(c, b) {
        canvas = c;
        ctx = canvas.getContext('2d');
        best = b || 0;
        state = 'MENU';
        pulseT = 0;
        grid = [];
        powered = [];
        rotCount = 0;
        lives = 3;
        score = 0;
        buildPuzzle();
    }

    return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
