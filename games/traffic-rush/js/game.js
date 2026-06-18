'use strict';

var TrafficRush = (function () {

  // ─── Virtual canvas dimensions ────────────────────────────────────────────
  var VW = 390;
  var VH = 844;

  // ─── Layout constants ─────────────────────────────────────────────────────
  var SAFE_ZONE_H = 60;          // height of top/bottom safe zones
  var LANE_COUNT  = 7;           // number of traffic lanes between safe zones
  var LANE_H = (VH - SAFE_ZONE_H * 2) / LANE_COUNT;  // ~103 px each

  // ─── Player constants ─────────────────────────────────────────────────────
  var PLAYER_W = 28;
  var PLAYER_H = 28;
  var PLAYER_X = VW / 2 - PLAYER_W / 2;  // horizontally centred

  // ─── Car constants ────────────────────────────────────────────────────────
  var CAR_W       = 52;
  var CAR_H       = 32;
  var BASE_SPEEDS = [80, 95, 110, 130, 150, 175, 200];  // px/s per lane (bottom→top)
  var CARS_PER_LANE = 3;
  var CAR_COLORS  = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6'];

  // ─── State variables ──────────────────────────────────────────────────────
  var _canvas;
  var _ctx;
  var _state;        // 'MENU' | 'PLAYING' | 'DEAD'
  var _best;
  var _score;
  var _speedMult;
  var _player;       // { x, y, laneIdx }  laneIdx -1 = bottom safe zone
  var _lanes;        // array of lane objects
  var _flashTimer;   // brief white flash on death
  var _menuPulse;    // animation timer for menu text

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _laneY(laneIdx) {
    // Returns the TOP y-coordinate of the lane at laneIdx (0 = bottom lane).
    // Safe zone at bottom occupies y: VH - SAFE_ZONE_H  to  VH
    // Lane 0 sits just above the bottom safe zone, lane LANE_COUNT-1 at the top.
    return VH - SAFE_ZONE_H - (laneIdx + 1) * LANE_H;
  }

  function _playerYForLane(laneIdx) {
    // Vertically centre player inside lane.
    if (laneIdx === -1) {
      // bottom safe zone
      return VH - SAFE_ZONE_H + (SAFE_ZONE_H - PLAYER_H) / 2;
    }
    if (laneIdx === LANE_COUNT) {
      // top safe zone
      return (SAFE_ZONE_H - PLAYER_H) / 2;
    }
    return _laneY(laneIdx) + (LANE_H - PLAYER_H) / 2;
  }

  function _randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function _makeCar(laneIdx, xHint) {
    var goRight = (laneIdx % 2 === 0);
    var x;
    if (xHint !== undefined) {
      x = xHint;
    } else {
      x = goRight ? _randomBetween(-VW, 0) : _randomBetween(VW, VW * 2);
    }
    var colorIdx = (laneIdx + Math.floor(Math.random() * CAR_COLORS.length)) % CAR_COLORS.length;
    return {
      x: x,
      y: _laneY(laneIdx) + (LANE_H - CAR_H) / 2,
      w: CAR_W,
      h: CAR_H,
      goRight: goRight,
      speed: BASE_SPEEDS[laneIdx] * _speedMult,
      color: CAR_COLORS[colorIdx],
      laneIdx: laneIdx
    };
  }

  function _initLanes() {
    _lanes = [];
    var i, j, car, spacing;
    for (i = 0; i < LANE_COUNT; i++) {
      var goRight = (i % 2 === 0);
      var cars = [];
      spacing = VW / CARS_PER_LANE;
      for (j = 0; j < CARS_PER_LANE; j++) {
        if (goRight) {
          car = _makeCar(i, -CAR_W + j * (spacing + _randomBetween(-20, 20)));
        } else {
          car = _makeCar(i, VW + j * (spacing + _randomBetween(-20, 20)));
        }
        cars.push(car);
      }
      _lanes.push({ cars: cars, goRight: goRight });
    }
  }

  function _resetPlayer() {
    _player = {
      x: PLAYER_X,
      y: _playerYForLane(-1),
      laneIdx: -1
    };
  }

  // ─── Collision ────────────────────────────────────────────────────────────

  function _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    var margin = 4;   // small shrink to forgive near-misses
    return (ax + margin < bx + bw - margin) &&
           (ax + aw - margin > bx + margin) &&
           (ay + margin < by + bh - margin) &&
           (ay + ah - margin > by + margin);
  }

  function _checkCollision() {
    if (_player.laneIdx < 0 || _player.laneIdx >= LANE_COUNT) {
      return false;
    }
    var lane = _lanes[_player.laneIdx];
    var i, car;
    for (i = 0; i < lane.cars.length; i++) {
      car = lane.cars[i];
      if (_rectsOverlap(_player.x, _player.y, PLAYER_W, PLAYER_H,
                        car.x,      car.y,      car.w,    car.h)) {
        return true;
      }
    }
    return false;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  function init(canvas, bestScore) {
    _canvas   = canvas;
    _ctx      = canvas.getContext('2d');
    _best     = bestScore || 0;
    _state    = 'MENU';
    _score    = 0;
    _speedMult = 1;
    _flashTimer = 0;
    _menuPulse  = 0;
    _resetPlayer();
    _initLanes();
  }

  function _startGame() {
    _score     = 0;
    _speedMult = 1;
    _flashTimer = 0;
    _resetPlayer();
    _initLanes();
    _state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch (e) {}
  }

  function _die() {
    var isNewBest = _score > _best;
    if (isNewBest) { _best = _score; }
    _isNewBest  = isNewBest;
    _state      = 'DEAD';
    _flashTimer = 0.25;
    try { Audio.play('crash'); } catch (e) {}
    try { AdManager.gameplayStop(); } catch (e) {}
    try { AdManager.onRunEnd(); } catch (e) {}
  }

  function update(dt) {
    _menuPulse += dt;

    if (_state === 'MENU') { return; }

    if (_flashTimer > 0) {
      _flashTimer -= dt;
    }

    if (_state === 'DEAD') { return; }

    // ── Move cars ──
    var i, j, car, lane;
    for (i = 0; i < _lanes.length; i++) {
      lane = _lanes[i];
      for (j = 0; j < lane.cars.length; j++) {
        car = lane.cars[j];
        if (car.goRight) {
          car.x += car.speed * dt;
          // Recycle off right edge
          if (car.x > VW + 10) {
            car.x = -CAR_W - _randomBetween(20, 120);
          }
        } else {
          car.x -= car.speed * dt;
          // Recycle off left edge
          if (car.x < -CAR_W - 10) {
            car.x = VW + _randomBetween(20, 120);
          }
        }
      }
    }

    // ── Collision check while in a traffic lane ──
    if (_player.laneIdx >= 0 && _player.laneIdx < LANE_COUNT) {
      if (_checkCollision()) {
        _die();
        return;
      }
    }

    // ── Reached top safe zone ──
    if (_player.laneIdx >= LANE_COUNT) {
      _score += 1;
      _speedMult += 0.12;
      try { Audio.play('gem'); } catch (e) {}

      // Re-apply new speed to all cars
      for (i = 0; i < _lanes.length; i++) {
        lane = _lanes[i];
        for (j = 0; j < lane.cars.length; j++) {
          lane.cars[j].speed = BASE_SPEEDS[i] * _speedMult;
        }
      }

      // Reset player to bottom
      _resetPlayer();
    }
  }

  function tap(x, y) {
    if (_state === 'MENU') {
      _startGame();
      try { Audio.play('tap'); } catch (e) {}
      return;
    }

    if (_state === 'DEAD') {
      try { Audio.play('tap'); } catch (e) {}
      _startGame();
      return;
    }

    // PLAYING: move player up one lane
    if (_state === 'PLAYING') {
      _player.laneIdx += 1;
      _player.y = _playerYForLane(_player.laneIdx);
      try { Audio.play('tap'); } catch (e) {}
    }
  }

  function getBest() {
    return _best;
  }

  // ─── Draw helpers ─────────────────────────────────────────────────────────

  function _drawRoad() {
    var ctx = _ctx;
    var i, laneTop;

    // Asphalt background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, VW, VH);

    // Bottom safe zone (pavement)
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, VH - SAFE_ZONE_H, VW, SAFE_ZONE_H);

    // Top safe zone (pavement)
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, VW, SAFE_ZONE_H);

    // Lane separator dashes
    ctx.setLineDash([18, 14]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f1c40f';

    for (i = 0; i <= LANE_COUNT; i++) {
      laneTop = VH - SAFE_ZONE_H - i * LANE_H;
      ctx.beginPath();
      ctx.moveTo(0,  laneTop);
      ctx.lineTo(VW, laneTop);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Sidewalk edge stripes
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0,  VH - SAFE_ZONE_H);
    ctx.lineTo(VW, VH - SAFE_ZONE_H);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0,  SAFE_ZONE_H);
    ctx.lineTo(VW, SAFE_ZONE_H);
    ctx.stroke();

    // Arrow cues showing traffic direction in each lane
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (i = 0; i < LANE_COUNT; i++) {
      laneTop = _laneY(i);
      var arrowY = laneTop + LANE_H / 2;
      var goRight = (i % 2 === 0);
      var ax;
      for (ax = 30; ax < VW; ax += 80) {
        ctx.save();
        ctx.translate(ax, arrowY);
        if (!goRight) { ctx.scale(-1, 1); }
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(8,  0);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function _drawCar(car) {
    var ctx = _ctx;
    var x = Math.round(car.x);
    var y = Math.round(car.y);
    var w = car.w;
    var h = car.h;

    // Car body
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // Windshield (top of car from bird's eye)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 6, y + 5, w - 12, h * 0.38);

    // Rear window
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 8, y + h - 10, w - 16, 6);

    // Front headlights
    var hlY = car.goRight ? y + 2 : y + h - 6;
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(x + 4, hlY, 7, 4);
    ctx.fillRect(x + w - 11, hlY, 7, 4);

    // Tail lights
    var tlY = car.goRight ? y + h - 6 : y + 2;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 4, tlY, 7, 4);
    ctx.fillRect(x + w - 11, tlY, 7, 4);
  }

  function _drawPlayer() {
    var ctx = _ctx;
    var x = Math.round(_player.x);
    var y = Math.round(_player.y);
    var w = PLAYER_W;
    var h = PLAYER_H;

    // Outer glow ring
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6);
    ctx.fill();
    ctx.restore();

    // Player body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // Simple "person from above" — head dot + body cross
    ctx.fillStyle = '#00bb55';
    // Head
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Body bar
    ctx.fillRect(x + w / 2 - 2, y + h * 0.38, 4, h * 0.36);
    // Arms
    ctx.fillRect(x + w * 0.18, y + h * 0.44, w * 0.64, 3);
  }

  function _drawMenu() {
    var ctx = _ctx;

    // Background road (static preview)
    _drawRoad();

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, VW, VH);

    // Title
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.font      = 'bold 52px sans-serif';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('TRAFFIC', VW / 2, VH / 2 - 80);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('RUSH',    VW / 2, VH / 2 - 20);

    // Pulsing "TAP TO PLAY"
    var alpha = 0.55 + 0.45 * Math.abs(Math.sin(_menuPulse * 2.2));
    ctx.font      = 'bold 24px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.fillText('TAP TO PLAY', VW / 2, VH / 2 + 60);

    // Best score
    if (_best > 0) {
      ctx.font      = '18px sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Best: ' + _best, VW / 2, VH / 2 + 110);
    }

    // Small car decorations
    _drawDecoCar(60,  VH / 2 + 170, '#e74c3c', true);
    _drawDecoCar(240, VH / 2 + 200, '#3498db', false);
  }

  function _drawDecoCar(x, y, color, goRight) {
    var ctx = _ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, 52, 30, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 6, y + 5, 40, 11);
  }

  function _drawHUD() {
    var ctx = _ctx;

    // Score badge
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(VW / 2 - 55, 8, 110, 40, 8);
    ctx.fill();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 22px sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, 28);
  }

  function _drawDeadOverlay() {
    var ctx = _ctx;

    ctx.fillStyle = 'rgba(0,0,0,0.70)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // "GAME OVER" title
    ctx.font      = 'bold 50px sans-serif';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('GAME OVER', VW / 2, VH / 2 - 90);

    // Score
    ctx.font      = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + _score, VW / 2, VH / 2 - 20);

    // Best
    ctx.font      = '22px sans-serif';
    ctx.fillStyle = '#f1c40f';
    var bestLabel = (_isNewBest && _score > 0) ? 'NEW BEST: ' + _best : 'Best: ' + _best;
    ctx.fillText(bestLabel, VW / 2, VH / 2 + 25);

    // Pulsing retry prompt
    var alpha = 0.5 + 0.5 * Math.abs(Math.sin(_menuPulse * 2.5));
    ctx.font      = 'bold 22px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.fillText('TAP TO RETRY', VW / 2, VH / 2 + 90);
  }

  function draw() {
    var ctx = _ctx;
    ctx.clearRect(0, 0, VW, VH);

    if (_state === 'MENU') {
      _drawMenu();
      return;
    }

    // Draw road + cars + player for PLAYING and DEAD
    _drawRoad();

    var i, j, lane;
    for (i = 0; i < _lanes.length; i++) {
      lane = _lanes[i];
      for (j = 0; j < lane.cars.length; j++) {
        _drawCar(lane.cars[j]);
      }
    }

    _drawPlayer();
    _drawHUD();

    // Death flash
    if (_flashTimer > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (_flashTimer / 0.25) * 0.55 + ')';
      ctx.fillRect(0, 0, VW, VH);
    }

    if (_state === 'DEAD') {
      _drawDeadOverlay();
    }
  }

  // ─── Public surface ───────────────────────────────────────────────────────
  return {
    init:    init,
    update:  update,
    draw:    draw,
    tap:     tap,
    getBest: getBest
  };

}());
