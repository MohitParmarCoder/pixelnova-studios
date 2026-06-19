'use strict';
var BunnyHop = (function () {

  var canvas, ctx;
  var state; // MENU, PLAYING, DEAD
  var best;

  var VW = 390;
  var VH = 844;

  // bunny
  var bx, by, bvx, bvy;
  var BW = 30;
  var BH = 36;
  var GRAVITY = 1400;
  var onPlatform;

  // world / scroll
  var scrollY; // total upward distance traveled
  var platformSpeed; // downward scroll speed in px/s

  // platforms
  var platforms; // {x, y, w}
  var PLAT_H = 14;

  // carrots
  var carrots; // {x, y, collected}

  var score;
  var scoreBase;
  var carrotBonus;

  var GEN_AHEAD = 950;
  var worldTopY; // highest platform world-y generated so far (lower number = higher up)

  function worldToScreen(wy) {
    // screen y = wy - scrollY + VH (scrollY is how high the camera has gone)
    // at start scrollY=0, screen bottom = VH
    return wy - scrollY + VH;
  }

  function genPlatforms() {
    // generate platforms above worldTopY until we have GEN_AHEAD above camera top
    var camTop = scrollY - GEN_AHEAD;
    while (worldTopY > camTop) {
      var w = 60 + Math.random() * 120;
      var x = Math.random() * (VW - w);
      worldTopY -= 90 + Math.random() * 60;
      platforms.push({ x: x, y: worldTopY, w: w });
      // maybe carrot
      if (Math.random() < 0.5) {
        carrots.push({ x: x + w / 2 - 10, y: worldTopY - 30, collected: false });
      }
    }
  }

  function cullBelow() {
    var bottom = scrollY + VH + 100;
    var i;
    for (i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > bottom) platforms.splice(i, 1);
    }
    for (i = carrots.length - 1; i >= 0; i--) {
      if (carrots[i].y > bottom) carrots.splice(i, 1);
    }
  }

  function resetGame() {
    scrollY = 0;
    platformSpeed = 60;
    score = 0;
    scoreBase = 0;
    carrotBonus = 0;
    bx = VW / 2 - BW / 2;
    by = VH - 200 - BH;
    bvx = 0;
    bvy = 0;
    onPlatform = true;
    platforms = [];
    carrots = [];

    // starting platform right under bunny
    var startY = VH - 200;
    platforms.push({ x: VW / 2 - 60, y: startY, w: 120 });
    worldTopY = startY;
    genPlatforms();
  }

  function init(c, bestScore) {
    canvas = c;
    ctx = canvas.getContext('2d');
    best = bestScore || 0;
    state = 'MENU';
    resetGame();
  }

  function update(dt) {
    if (state !== 'PLAYING') return;

    platformSpeed = 60 + scrollY * 0.015;
    // move camera up: scrollY increases as bunny goes higher
    // camera tries to keep bunny at ~VH/3 from top
    var targetScroll = scrollY;
    var bunnyScreen = worldToScreen(by);
    var desiredBunnyScreen = VH * 0.35;
    if (bunnyScreen < desiredBunnyScreen) {
      targetScroll += desiredBunnyScreen - bunnyScreen;
    }
    // scroll platforms down
    scrollY += platformSpeed * dt;
    if (scrollY < targetScroll) scrollY = targetScroll;

    // physics
    bvy += GRAVITY * dt;
    bx += bvx * dt;
    by += bvy * dt;

    // wrap horizontally
    if (bx + BW < 0) bx = VW;
    if (bx > VW) bx = -BW;

    // platform collision (only when falling down)
    onPlatform = false;
    var i;
    for (i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      var ps = worldToScreen(p.y);
      if (bvy >= 0 &&
          bx + BW > p.x && bx < p.x + p.w &&
          by + BH >= p.y && by + BH <= p.y + 20 + bvy * dt * 2) {
        by = p.y - BH;
        bvy = -680 - platformSpeed;
        bvx = bvx * 0.6;
        onPlatform = true;
        try { Audio.play('tap'); } catch (e) {}
        break;
      }
    }

    // collect carrots
    for (i = 0; i < carrots.length; i++) {
      var c2 = carrots[i];
      if (!c2.collected) {
        if (bx < c2.x + 20 && bx + BW > c2.x && by < c2.y + 20 && by + BH > c2.y) {
          c2.collected = true;
          carrotBonus += 5;
          try { Audio.play('gem'); } catch (e) {}
        }
      }
    }

    // score from height + collected carrots
    var heightScore = Math.floor(scrollY / 50);
    if (heightScore > scoreBase) {
      scoreBase = heightScore;
    }
    score = scoreBase + carrotBonus;

    genPlatforms();
    cullBelow();

    // fall off bottom = dead
    if (worldToScreen(by) > VH + 50) {
      die();
    }
  }

  function die() {
    state = 'DEAD';
    if (score > best) best = score;
    try { Audio.play('lose'); } catch (e) {}
    try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch (e) {}
    AdManager.showInterstitial(() => {});
    try { AdManager.offerDoubleScore(score, 'bunnyhop_best'); } catch(e) {}
  }

  function tap(x, y) {
    if (state === 'MENU') {
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    if (state === 'DEAD') {
      resetGame();
      state = 'PLAYING';
      try { AdManager.gameplayStart(); } catch (e) {}
      return;
    }
    // jump toward tapped side
    if (state === 'PLAYING') {
      if (x < VW / 2) {
        bvx = -180;
      } else {
        bvx = 180;
      }
      if (onPlatform || bvy > -200) {
        bvy = -750;
        try { Audio.play('tap'); } catch (e) {}
      }
    }
  }

  // ---- drawing ----
  function drawBg() {
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#b3e5fc');
    grad.addColorStop(1, '#e8f5e9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // flowers in background
    ctx.fillStyle = 'rgba(255,182,193,0.4)';
    var positions = [40, 130, 220, 310, 60, 170, 280];
    var i;
    for (i = 0; i < positions.length; i++) {
      var fy = ((positions[i] * 3 + scrollY * 0.08) % (VH + 60)) - 30;
      ctx.beginPath();
      ctx.arc(positions[i], fy, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatforms() {
    var i;
    for (i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      var py2 = worldToScreen(p.y);
      if (py2 < -20 || py2 > VH + 20) continue;
      ctx.fillStyle = '#81c784';
      ctx.fillRect(p.x, py2, p.w, PLAT_H);
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(p.x + 2, py2 + 2, p.w - 4, 4);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(p.x, py2 + PLAT_H - 3, p.w, 3);
    }
  }

  function drawCarrots() {
    var i;
    for (i = 0; i < carrots.length; i++) {
      var c2 = carrots[i];
      if (c2.collected) continue;
      var cy2 = worldToScreen(c2.y);
      if (cy2 < -30 || cy2 > VH + 30) continue;
      // carrot body
      ctx.fillStyle = '#ff7043';
      ctx.beginPath();
      ctx.moveTo(c2.x + 10, cy2 + 20);
      ctx.lineTo(c2.x, cy2);
      ctx.lineTo(c2.x + 20, cy2);
      ctx.closePath();
      ctx.fill();
      // leaves
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(c2.x + 7, cy2 - 8, 3, 10);
      ctx.fillRect(c2.x + 12, cy2 - 6, 3, 8);
    }
  }

  function drawBunny() {
    var bsy = worldToScreen(by);
    // body
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(bx, bsy, BW, BH);
    // ears
    ctx.fillStyle = '#fce4ec';
    ctx.fillRect(bx + 4, bsy - 18, 7, 18);
    ctx.fillRect(bx + 17, bsy - 18, 7, 18);
    ctx.fillStyle = '#f8bbd0';
    ctx.fillRect(bx + 6, bsy - 16, 3, 14);
    ctx.fillRect(bx + 19, bsy - 16, 3, 14);
    // eye
    ctx.fillStyle = '#e91e63';
    ctx.fillRect(bx + 8, bsy + 8, 5, 5);
    ctx.fillRect(bx + 18, bsy + 8, 5, 5);
    // tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx - 6, bsy + BH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.fillStyle = '#f48fb1';
    ctx.fillRect(bx + 12, bsy + 15, 5, 4);
  }

  function drawHUD() {
    ctx.fillStyle = '#4a148c';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 16, 38);
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + best, VW - 16, 38);
  }

  function drawMenu() {
    drawBg();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#7b1fa2';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUNNY', VW / 2, 320);
    ctx.fillText('HOP', VW / 2, 385);

    ctx.fillStyle = '#1a237e';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO PLAY', VW / 2, 480);

    if (best > 0) {
      ctx.fillStyle = '#e91e63';
      ctx.font = '22px monospace';
      ctx.fillText('BEST: ' + best, VW / 2, 530);
    }
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ce93d8';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OOPS!', VW / 2, 340);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SCORE: ' + score, VW / 2, 410);

    ctx.fillStyle = '#f1c40f';
    ctx.font = '24px monospace';
    ctx.fillText('BEST: ' + best, VW / 2, 450);

    ctx.fillStyle = '#a5d6a7';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TAP TO RETRY', VW / 2, 530);
  }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    if (state === 'MENU') {
      drawMenu();
      return;
    }
    drawBg();
    drawPlatforms();
    drawCarrots();
    drawBunny();
    drawHUD();
    if (state === 'DEAD') {
      drawDead();
    }
  }

  function getBest() { return best; }

  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
