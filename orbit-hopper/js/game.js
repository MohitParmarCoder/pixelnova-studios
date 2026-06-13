'use strict';

const Game = (() => {
  // Virtual canvas (portrait)
  const W = 390, H = 844;

  // Physics
  const BASE_ORBIT_SPD  = 1.35;   // rad/s  (was 2.1 — slower, more readable)
  const BASE_LAUNCH_SPD = 290;    // px/s   (was 370 — more time to aim)
  const GRAV_MULT       = 3.4;    // gravity ring = planet.r × this (was 2.7 — bigger catch zone)
  const ORBIT_MULT      = 1.85;   // orbit path = planet.r × this
  const DIFF_STEP       = 8;
  const COMPANY         = 'PixelNova';
  const TAGLINE         = 'Play Beyond Gravity';
  const TIER_SIZE       = 5;   // difficulty levels per tier
  const TIER_NAMES      = ['Rookie','Explorer','Veteran','Elite','Legend'];
  const TIER_COLORS     = ['#a8edea','#9B59B6','#E74C3C','#FFD700','#FF61A6'];

  // Background palette: deep-space → purple → dusk-orange → dawn-gold
  const BG_STOPS = [
    [[18,20,55],  [10,12,38]],
    [[55,25,95],  [30,15,70]],
    [[160,60,50], [220,90,60]],
    [[240,180,80],[180,100,50]],
  ];

  // Easing
  const eOut  = t => 1 - Math.pow(1 - t, 3);
  const eInOut= t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  function lerp(a,b,t){ return a + (b-a)*t; }
  function lc(a,b,t){ return [a[0]+(b[0]-a[0])*t|0, a[1]+(b[1]-a[1])*t|0, a[2]+(b[2]-a[2])*t|0]; }
  function rgb(c){ return `rgb(${c[0]},${c[1]},${c[2]})`; }
  function dist2(ax,ay,bx,by){ const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; }

  // State
  let canvas, ctx;
  let state = 'SPLASH';  // SPLASH MENU INFO SETTINGS PLAYING DYING RESULTS
  let score, gems, highScore, runsPlayed;
  let diffLv, gameTime, deathTimer;
  let rewardedUsed, gemsDoubled, streakCount;
  let bgPhase, menuPulse;

  // Camera (world coords)
  let cam;

  // Entities
  let ship, planets, gemsList, hazards, particles, popups, stars;

  // UI animation state
  let tutPhase, showTut;
  let resultsAlpha, resultsSlide;
  let continueAlpha, continueTimer;
  let newBestFlash, levelUpTimer;
  let lastOrbitPlanet;
  let infoPage = 0;
  let splashTimer;    // SPLASH state countdown
  let maxLevel;       // highest diffLv ever reached (persisted)
  let settingsOpen;   // settings overlay on top of MENU
  let tierUpFlash;    // true when this level-up also crossed a tier boundary

  // ── Colour helpers ─────────────────────────────────────────────────────
  function bgColors() {
    const raw = (diffLv / 3) * (BG_STOPS.length - 1);
    const i   = Math.min(Math.floor(raw), BG_STOPS.length - 2);
    const f   = raw - i;
    return [lc(BG_STOPS[i][0], BG_STOPS[i+1][0], f),
            lc(BG_STOPS[i][1], BG_STOPS[i+1][1], f)];
  }

  // ── Star generation ────────────────────────────────────────────────────
  function makeStars() {
    stars = [];
    [[100,.08,.5],[50,.25,1],[20,.55,1.6]].forEach(([n,spd,r]) => {
      for (let i=0;i<n;i++) stars.push({
        x: Math.random()*W, y: Math.random()*H,
        r, spd, a: .25+Math.random()*.55
      });
    });
  }

  // ── Planet creation ────────────────────────────────────────────────────
  const PALETTES = [
    ['#6C8EEF','#9B59B6'],['#E67E22','#E74C3C'],
    ['#1ABC9C','#3498DB'],['#E91E63','#8E44AD'],
    ['#00B894','#6C5CE7'],['#FDCB6E','#E17055'],
  ];

  function makePlanet(x, y, big) {
    const r = big ? 42 : 20 + Math.random()*22;
    const pal = PALETTES[Math.floor(Math.random()*PALETTES.length)];
    const p = {
      x, y, r,
      gravR:  r * GRAV_MULT,
      orbitR: r * ORBIT_MULT,
      c1: pal[0], c2: pal[1],
      alpha: 0, scale: 0.3,
      id: Math.random(),
      gemAngles: [],
    };
    const gc = 2 + Math.floor(Math.random()*3);
    for (let i=0;i<gc;i++) p.gemAngles.push(Math.PI*2*i/gc + Math.random()*.4);
    return p;
  }

  function spawnGems(p) {
    for (const ang of p.gemAngles) {
      gemsList.push({
        x: p.x + Math.cos(ang)*p.orbitR,
        y: p.y + Math.sin(ang)*p.orbitR,
        planet: p, collected: false,
        alpha: 1, scale: 1, pulse: Math.random()*Math.PI*2,
      });
    }
  }

  // ── Ship creation ──────────────────────────────────────────────────────
  function makeShip(planet) {
    return {
      x: planet.x + planet.orbitR, y: planet.y,
      vx: 0, vy: 0,
      orbitAngle: 0,
      orbitPlanet: planet,
      orbitSpd: BASE_ORBIT_SPD,
      orbitR: planet.orbitR,
      flying: false,
      flightDist: 0,
      alive: true,
      prevPlanet: null,
      trail: [],
    };
  }

  // ── Difficulty helpers ─────────────────────────────────────────────────
  function launchSpd()  { return BASE_LAUNCH_SPD  + diffLv * 20; }
  function orbitSpd()   { return BASE_ORBIT_SPD   + diffLv * 0.20; }
  function dynGravR(p)  { return p.r * Math.max(2.3, GRAV_MULT - Math.min(diffLv * 0.07, 0.9)); }
  function getCurTier() { return Math.min(Math.floor(diffLv / TIER_SIZE), TIER_NAMES.length-1); }
  function getCurTierColor() { return TIER_COLORS[getCurTier()]; }

  // ── World maintenance ──────────────────────────────────────────────────
  function fillPlanets() {
    const target = 4 + Math.min(Math.floor(diffLv / 2), 4);  // up to 8 planets
    while (planets.length < target) {
      let topY = Infinity;
      for (const p of planets) topY = Math.min(topY, p.y);

      const ref = planets[planets.length-1];
      const ang = -Math.PI/2 + (Math.random()-.5)*Math.PI*.75;
      const d   = 155 + Math.random()*100 + Math.min(diffLv * 10, 130);  // widens at high levels
      const nx  = Math.max(70, Math.min(W-70, ref.x + Math.cos(ang)*d));
      const ny  = topY - 160 - Math.random()*120 - Math.min(diffLv * 4, 80);
      const np  = makePlanet(nx, ny, false);
      planets.push(np);
      spawnGems(np);
    }

    if (diffLv >= 2) {
      const maxH = Math.min(diffLv + 2, 12);
      while (hazards.length < maxH) spawnHazard();
    }
  }

  function spawnHazard() {
    let topY = Infinity;
    for (const p of planets) topY = Math.min(topY, p.y);

    // Level 8+: 40% chance of hazard that orbits a planet
    if (diffLv >= 8 && Math.random() < 0.42 && planets.length > 1) {
      const refP = planets[Math.floor(Math.random() * planets.length)];
      hazards.push({
        x: refP.x, y: refP.y,
        vx: 0, vy: 0,
        orbitPlanet: refP,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitR: refP.r * (2.4 + Math.random() * 1.2),
        orbitSpd: (0.9 + Math.random() * 0.9) * (Math.random() > .5 ? 1 : -1),
        r: 8 + Math.random() * (diffLv >= 12 ? 12 : 7),
        spin: (Math.random()-.5)*5,
        angle: 0, alpha: 0, id: Math.random(),
        _nm: false, _orbiting: true,
      });
      return;
    }

    const speedMult = 1 + Math.min(diffLv * 0.14, 1.8);
    hazards.push({
      x: Math.random()*W, y: topY - 80 - Math.random()*200,
      vx: (Math.random()-.5)*130*speedMult, vy: (25+Math.random()*55)*speedMult,
      r: 7+Math.random()*(diffLv>=5?10:7), spin: (Math.random()-.5)*5,
      angle: 0, alpha: 0, id: Math.random(),
      _nm: false, _orbiting: false,
    });
  }

  function prunePlanets() {
    const cutY = cam.y + H + 250;
    planets  = planets.filter(p => p.y < cutY);
    gemsList = gemsList.filter(g => planets.includes(g.planet));
    hazards  = hazards.filter(h => {
      if (h._orbiting) return planets.includes(h.orbitPlanet);
      return h.y < cutY + 200;
    });
  }

  // ── Particles ──────────────────────────────────────────────────────────
  function burst(x, y, col, n, fast) {
    for (let i=0;i<n;i++) {
      const a = Math.PI*2*i/n + Math.random()*.6;
      const s = fast ? 80+Math.random()*200 : 50+Math.random()*120;
      particles.push({ x, y,
        vx: Math.cos(a)*s, vy: Math.sin(a)*s,
        r: 1.5+Math.random()*3, life:1,
        decay: .7+Math.random()*.9, col,
      });
    }
  }

  function popup(x, y, txt, col) {
    popups.push({ x, y, vy: -65, txt, col: col||'#ffffff', life:1 });
  }

  // ── Core game actions ──────────────────────────────────────────────────
  function launch() {
    if (!ship || !ship.alive || ship.flying || !ship.orbitPlanet) return;
    const dir = Math.sign(ship.orbitSpd || 1);   // match arrow direction
    const tx = -Math.sin(ship.orbitAngle) * dir;
    const ty =  Math.cos(ship.orbitAngle) * dir;
    ship.vx = tx * launchSpd();
    ship.vy = ty * launchSpd();
    ship.flying = true;
    ship.flightDist = 0;
    ship.prevPlanet = ship.orbitPlanet;
    ship.orbitPlanet = null;
    Audio.play('hop');
    if (showTut) showTut = false;
  }

  function land(planet) {
    score++;
    if (score % DIFF_STEP === 0) {
      const oldTier = Math.min(Math.floor(diffLv / TIER_SIZE), TIER_NAMES.length-1);
      diffLv++;
      const newTier = Math.min(Math.floor(diffLv / TIER_SIZE), TIER_NAMES.length-1);
      tierUpFlash = newTier > oldTier;
      levelUpTimer = 1.5;
      const tc = TIER_COLORS[newTier];
      burst(ship.x, ship.y, tc, tierUpFlash ? 22 : 14, true);
      if (tierUpFlash) burst(ship.x, ship.y, '#ffffff', 12, true);
      if (diffLv > maxLevel) {
        maxLevel = diffLv;
        try { localStorage.setItem('orbit_maxlevel', maxLevel); } catch(e) {}
      }
    }

    lastOrbitPlanet = planet;
    ship.orbitPlanet = planet;
    ship.flying = false;
    ship.orbitAngle = Math.atan2(ship.y - planet.y, ship.x - planet.x);
    ship.orbitR   = planet.orbitR;
    ship.orbitSpd = orbitSpd() * (Math.random()>.5 ? 1 : -1);
    ship.vx = ship.vy = 0;

    burst(ship.x, ship.y, planet.c1, 10);
    popup(ship.x, ship.y - 42, '+1');
    Audio.play('land');

    fillPlanets();
    prunePlanets();
  }

  function die(x, y) {
    if (!ship || !ship.alive) return;
    ship.alive = false;
    burst(x, y, '#FF8C7A', 22, true);
    burst(x, y, '#ffffff', 8, true);
    cam.shake = 0.6;
    Audio.play('death');
    AdManager.gameplayStop();
    AdManager.onRunEnd();

    runsPlayed++;
    try { localStorage.setItem('orbit_runs', runsPlayed); } catch(e) {}

    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('orbit_best', highScore); } catch(e) {}
      Audio.play('highscore');
      newBestFlash = 1;
    }

    state = 'DYING';
    deathTimer = 0;
    continueAlpha = 0;
    continueTimer = 0;
  }

  // ── Reset / start ──────────────────────────────────────────────────────
  function resetGame() {
    score = gems = diffLv = 0;
    gameTime = deathTimer = 0;
    rewardedUsed = gemsDoubled = false;
    streakCount = 0; tierUpFlash = false;
    bgPhase = 0;
    cam = { x:0, y:0, tx:0, ty:0, shake:0 };
    planets=[]; gemsList=[]; hazards=[]; particles=[]; popups=[];

    const sp = makePlanet(W/2, H*0.62, true);
    sp.alpha=1; sp.scale=1;
    planets.push(sp);
    spawnGems(sp);

    const sp2 = makePlanet(W/2+(Math.random()-.5)*160, H*0.3, false);
    sp2.alpha=1; sp2.scale=1;
    planets.push(sp2);
    spawnGems(sp2);

    ship = makeShip(sp);
    lastOrbitPlanet = sp;
  }

  function startGame() {
    Audio.stopAmbient();
    try {
      highScore   = parseInt(localStorage.getItem('orbit_best')||'0');
      runsPlayed  = parseInt(localStorage.getItem('orbit_runs')||'0');
    } catch(e) {}
    resetGame();
    showTut = runsPlayed === 0;
    tutPhase = 0;
    state = 'PLAYING';
    AdManager.gameplayStart();
  }

  function restartGame() {
    Audio.stopAmbient();
    AdManager.showInterstitial(() => {
      resetGame();
      showTut = false;
      state = 'PLAYING';
      AdManager.gameplayStart();
    });
  }

  // Rewarded continue: respawn ship on last safe planet
  function continueGame() {
    rewardedUsed = true;
    continueAlpha = 0;
    state = 'PLAYING';
    // Respawn
    ship = makeShip(lastOrbitPlanet || planets[0]);
    ship.alive = true;
    cam.shake = 0;
    AdManager.gameplayStart();
    fillPlanets();
  }

  // ── onTap – all state-aware tap logic ─────────────────────────────────
  function onTap() {
    const pos = Input.lastPos();

    // Mute button (top-right, always)
    if (pos.x > W-55 && pos.y < 58) {
      Audio.setMuted(!Audio.getMuted());
      Audio.resume();
      return;
    }

    // Skip splash
    if (state === 'SPLASH') {
      if (splashTimer > 0.25) {
        splashTimer = 999;
        Audio.resume();
        Audio.startAmbient();
      }
      return;
    }

    // Close settings overlay (tap anywhere)
    if (settingsOpen) {
      // Mute icon in settings center
      if (dist2(pos.x, pos.y, W/2, H*0.56) < 32*32) {
        Audio.setMuted(!Audio.getMuted());
        Audio.resume();
        return;
      }
      settingsOpen = false;
      return;
    }

    if (state === 'INFO') {
      state = 'MENU';
      return;
    }

    if (state === 'MENU') {
      // Settings button (bottom-right)
      if (dist2(pos.x, pos.y, W-42, H-52) < 38*38) {
        settingsOpen = true;
        return;
      }
      // Info button (bottom-left of menu)
      if (dist2(pos.x, pos.y, 42, H-52) < 38*38) {
        state = 'INFO';
        return;
      }
      Audio.resume();
      if (!Audio.isAmbientPlaying()) Audio.startAmbient();
      startGame();
      return;
    }

    if (state === 'DYING') {
      // Tap continue prompt
      if (!rewardedUsed && continueTimer < 3.2) {
        const bx = W/2, by = H*0.72;
        if (dist2(pos.x,pos.y,bx,by) < 55*55) {
          AdManager.showRewarded(continueGame, () => {});
        }
      }
      return;
    }

    if (state === 'RESULTS') {
      // Retry button
      const rb = resultsBtnPos();
      if (dist2(pos.x,pos.y,rb.retry.x,rb.retry.y) < 50*50) {
        restartGame(); return;
      }
      // Double-gems rewarded
      if (!gemsDoubled) {
        const dg = rb.doubleGem;
        if (dist2(pos.x,pos.y,dg.x,dg.y) < 50*50) {
          AdManager.showRewarded(() => {
            gems *= 2; gemsDoubled = true;
          }, () => {});
          return;
        }
      }
      restartGame();
      return;
    }

    if (state === 'PLAYING') {
      launch();
    }
  }

  function resultsBtnPos() {
    const py = H*0.14 + (1-eOut(Math.min(resultsAlpha,1)))*H*0.3;
    return {
      retry:     { x: W*0.62, y: py+294 },
      doubleGem: { x: W*0.38, y: py+294 },
    };
  }

  // ── Update ─────────────────────────────────────────────────────────────
  function update(dt) {
    gameTime += dt;
    menuPulse += dt * 1.8;
    bgPhase = (bgPhase + dt*0.025) % 1;

    if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt*2.5);

    if (state === 'SPLASH') { updateSplash(dt); return; }
    if (state === 'MENU' || state === 'INFO' || settingsOpen) { updateMenu(dt); return; }
    if (state === 'DYING')   { updateDying(dt); return; }
    if (state === 'RESULTS') { updateResults(dt); return; }
    if (state !== 'PLAYING') return;

    // Tutorial
    if (showTut) tutPhase += dt;

    // Planet/hazard fade-in
    for (const p of planets) {
      p.alpha = Math.min(1, p.alpha + dt*2.5);
      p.scale = Math.min(1, p.scale + (1-p.scale)*dt*5);
    }
    for (const h of hazards) {
      if (h._orbiting && h.orbitPlanet) {
        h.orbitAngle += h.orbitSpd * dt;
        h.x = h.orbitPlanet.x + Math.cos(h.orbitAngle) * h.orbitR;
        h.y = h.orbitPlanet.y + Math.sin(h.orbitAngle) * h.orbitR;
      } else {
        h.x += h.vx*dt; h.y += h.vy*dt;
        if (h.x < -25) h.x = W+25;
        if (h.x > W+25) h.x = -25;
      }
      h.angle += h.spin*dt;
      h.alpha = Math.min(1, h.alpha + dt*2);
    }

    if (ship && ship.alive) updateShip(dt);

    updateParticles(dt);
    updatePopups(dt);
    updateGems(dt);

    if (ship && ship.alive) {
      cam.tx = ship.x - W/2;
      cam.ty = ship.y - H/2;
    }
    cam.x += (cam.tx - cam.x) * Math.min(1, dt*4.5);
    cam.y += (cam.ty - cam.y) * Math.min(1, dt*4.5);

    if (newBestFlash > 0) newBestFlash = Math.max(0, newBestFlash - dt*1.5);
    if (levelUpTimer > 0) levelUpTimer = Math.max(0, levelUpTimer - dt);
  }

  function updateMenu(dt) {
    for (const p of planets) p.alpha = Math.min(1, p.alpha+dt*2);
    if (ship) {
      ship.orbitAngle += orbitSpd()*dt;
      const op = ship.orbitPlanet || planets[0];
      ship.x = op.x + Math.cos(ship.orbitAngle)*(op.orbitR||80);
      ship.y = op.y + Math.sin(ship.orbitAngle)*(op.orbitR||80);
    }
  }

  function updateDying(dt) {
    deathTimer += dt;
    continueTimer += dt;
    continueAlpha = !rewardedUsed
      ? Math.min(1, continueTimer*2) * (1 - Math.max(0,(continueTimer-2.5))*2)
      : 0;
    updateParticles(dt);
    updatePopups(dt);
    if (deathTimer > 1.8) {
      state = 'RESULTS';
      resultsAlpha = 0;
      resultsSlide = H*0.28;
    }
  }

  function updateResults(dt) {
    resultsAlpha  = Math.min(1, resultsAlpha + dt*2.8);
    resultsSlide  = lerp(resultsSlide, H*0.1, dt*6*eOut(resultsAlpha));
    updateParticles(dt);
  }

  function updateShip(dt) {
    if (ship.flying) {
      ship.x += ship.vx*dt;
      ship.y += ship.vy*dt;
      ship.flightDist += Math.hypot(ship.vx, ship.vy)*dt;
      ship.trail.push({x:ship.x, y:ship.y, life:1});
      if (ship.trail.length > 22) ship.trail.shift();

      // Missed every ring: run ends after ~2 planet-gaps of empty flight
      // (camera follows the ship, so a viewport-edge check alone never fires)
      const margin = 220;
      if (ship.flightDist > 820 ||
          ship.y > cam.y+H+margin || ship.x < cam.x-margin || ship.x > cam.x+W+margin) {
        die(ship.x, ship.y); return;
      }

      // Hazard collision & near-miss
      for (const h of hazards) {
        const d2 = dist2(ship.x,ship.y,h.x,h.y);
        if (d2 < (h.r+5)*(h.r+5)) { die(ship.x,ship.y); return; }
        if (!h._nm && d2 < (h.r*2.8)*(h.r*2.8)) {
          h._nm = true; setTimeout(()=>{ if(h) h._nm=false; }, 2000);
          const bonus = 10 + Math.min(streakCount,5)*5;
          score += bonus; streakCount++;
          popup(ship.x, ship.y-35, `+${bonus}`, '#FFD700');
          burst(ship.x, ship.y, '#FFD700', 5);
          Audio.play('nearmiss');
          newBestFlash = 0;
        }
      }

      // Gravity capture (ring shrinks at high difficulty)
      for (const p of planets) {
        if (p === ship.prevPlanet) continue;
        const gr = dynGravR(p);
        if (dist2(ship.x,ship.y,p.x,p.y) < gr*gr) {
          land(p); return;
        }
      }
    } else {
      // Orbiting
      ship.orbitAngle += ship.orbitSpd*dt;
      ship.x = ship.orbitPlanet.x + Math.cos(ship.orbitAngle)*ship.orbitR;
      ship.y = ship.orbitPlanet.y + Math.sin(ship.orbitAngle)*ship.orbitR;
      ship.trail.push({x:ship.x, y:ship.y, life:0.45});
      if (ship.trail.length > 14) ship.trail.shift();

      // Gem collect
      for (const g of gemsList) {
        if (g.collected) continue;
        if (dist2(ship.x,ship.y,g.x,g.y) < 16*16) {
          g.collected = true; gems++;
          const val = 5 * (1 + (streakCount >= 3 ? 1 : 0));
          score += val;
          burst(g.x, g.y, '#a8edea', 7);
          popup(g.x, g.y-22, `+${val}`, '#a8edea');
          Audio.play('gem');
        }
      }
    }
    for (const t of ship.trail) t.life -= dt*3.5;
    ship.trail = ship.trail.filter(t=>t.life>0);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vx *= 0.93; p.vy *= 0.93;
      p.vy += 28*dt;
      p.life -= p.decay*dt;
    }
    particles = particles.filter(p=>p.life>0);
  }

  function updatePopups(dt) {
    for (const p of popups) { p.y += p.vy*dt; p.vy*=0.93; p.life-=dt*1.4; }
    popups = popups.filter(p=>p.life>0);
  }

  function updateGems(dt) {
    for (const g of gemsList) {
      g.pulse += dt*2.2;
      if (g.collected) { g.alpha-=dt*4; g.scale-=dt*4; }
    }
    gemsList = gemsList.filter(g=>!g.collected||g.alpha>0);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    if (state === 'SPLASH') { drawSplash(); return; }

    const sx = cam.shake>0 ? (Math.random()-.5)*cam.shake*18 : 0;
    const sy = cam.shake>0 ? (Math.random()-.5)*cam.shake*18 : 0;

    ctx.save();
    ctx.translate(sx, sy);

    drawBg();
    drawStarsLayer();

    // World space
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawPlanets();
    drawGems();
    drawHazards();
    if (ship) drawShip();
    drawParticles();
    drawPopups();
    ctx.restore();

    drawHUD();
    if (state==='MENU')    drawMenu();
    if (state==='INFO')    drawInfo();
    if (state==='PLAYING' && showTut) drawTutorial();
    if (state==='DYING')   drawDying();
    if (state==='RESULTS') drawResults();
    if (levelUpTimer > 0)  drawLevelUpFlash();
    if (settingsOpen)      drawSettings();

    ctx.restore();
  }

  function drawBg() {
    const [f,t] = bgColors();
    const ap = bgPhase*Math.PI*2;
    const cx = W/2 + Math.sin(ap*.7)*40;
    const cy = H/2 + Math.cos(ap*.5)*70;
    const grd = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.hypot(W,H)*.7);
    grd.addColorStop(0, rgb(f));
    grd.addColorStop(1, rgb(t));
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);
  }

  function drawStarsLayer() {
    for (const s of stars) {
      const x = ((s.x - cam.x*s.spd) % W + W) % W;
      const y = ((s.y - cam.y*s.spd) % H + H) % H;
      ctx.globalAlpha = s.a * (.65 + Math.sin(gameTime*1.2 + s.x*.05)*.35);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x,y,s.r,0,Math.PI*2); ctx.fill();
      // Wrap edges
      if (x<5)   { ctx.beginPath(); ctx.arc(x+W,y,s.r,0,Math.PI*2); ctx.fill(); }
      if (x>W-5) { ctx.beginPath(); ctx.arc(x-W,y,s.r,0,Math.PI*2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanets() {
    for (const p of planets) {
      if (p.alpha<=0) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);

      // Gravity ring (dashed, pulsing) — shrinks at higher difficulty
      const gr = dynGravR(p);
      const ringA = .42 + Math.sin(gameTime*2+p.id*7)*.18;
      ctx.globalAlpha = p.alpha * ringA;
      ctx.strokeStyle = p.c1;
      ctx.lineWidth = 2;
      ctx.setLineDash([9,7]);
      ctx.beginPath(); ctx.arc(0,0,gr,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      // Orbit path
      ctx.globalAlpha = p.alpha * .2;
      ctx.strokeStyle = p.c1;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0,0,p.orbitR,0,Math.PI*2); ctx.stroke();

      // Outer glow halo
      ctx.globalAlpha = p.alpha * .28;
      ctx.shadowBlur = 28; ctx.shadowColor = p.c1;
      ctx.fillStyle = p.c1;
      ctx.beginPath(); ctx.arc(0,0,p.r+9,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      // Planet body
      ctx.globalAlpha = p.alpha;
      const bg = ctx.createRadialGradient(-p.r*.32,-p.r*.32,p.r*.08,0,0,p.r);
      bg.addColorStop(0,'#ffffff');
      bg.addColorStop(.28,p.c1);
      bg.addColorStop(1,p.c2);
      ctx.fillStyle = bg;
      ctx.shadowBlur = 12; ctx.shadowColor = p.c1;
      ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  function drawGems() {
    for (const g of gemsList) {
      if (g.alpha<=0) continue;
      ctx.save();
      ctx.globalAlpha = g.alpha;
      ctx.translate(g.x, g.y);
      const pulse = .85 + Math.sin(g.pulse)*.15;
      ctx.scale(g.scale*pulse, g.scale*pulse);
      ctx.rotate(gameTime*1.6 + g.pulse);

      ctx.shadowBlur = 14; ctx.shadowColor = '#a8edea';
      const s = 6;
      const gg = ctx.createLinearGradient(0,-s*1.3,0,s);
      gg.addColorStop(0,'#dff8f8'); gg.addColorStop(1,'#7c83fd');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(0,-s*1.3); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0);
      ctx.closePath(); ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.moveTo(0,-s*1.3); ctx.lineTo(s*.38,-s*.28); ctx.lineTo(0,0); ctx.lineTo(-s*.38,-s*.28);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawHazards() {
    for (const h of hazards) {
      ctx.save();
      ctx.globalAlpha = h.alpha*.92;
      ctx.translate(h.x,h.y);
      ctx.rotate(h.angle);
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff4757';

      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      const pts = 7;
      for (let i=0;i<pts;i++) {
        const a = Math.PI*2*i/pts;
        const r = h.r*(.68+Math.sin(i*2.4+h.id*8)*.32);
        i===0 ? ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r)
              : ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(-h.r*.2,-h.r*.2,h.r*.38,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawShip() {
    if (!ship.alive && deathTimer>.25) return;

    // Single aim-direction arrow — only in PLAYING state
    if (state === 'PLAYING' && !ship.flying && ship.orbitPlanet) {
      const dir  = Math.sign(ship.orbitSpd || 1);
      const aimX = -Math.sin(ship.orbitAngle) * dir;
      const aimY =  Math.cos(ship.orbitAngle) * dir;
      const fadeAlpha = Math.max(0, 0.65 - diffLv * 0.05);
      if (fadeAlpha > 0.05) {
        const len = 85;
        const ax = ship.x + aimX*len, ay = ship.y + aimY*len;
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]); ctx.shadowBlur = 8; ctx.shadowColor = '#a8edea';
        ctx.beginPath(); ctx.moveTo(ship.x, ship.y); ctx.lineTo(ax, ay); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#a8edea'; ctx.shadowBlur = 6;
        const perp = 5.5;
        ctx.beginPath();
        ctx.moveTo(ax + aimX*9,        ay + aimY*9);
        ctx.lineTo(ax - aimY*perp,     ay + aimX*perp);
        ctx.lineTo(ax + aimY*perp,     ay - aimX*perp);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // Trail
    for (let i=0;i<ship.trail.length;i++) {
      const t = ship.trail[i];
      const frac = i/ship.trail.length;
      ctx.globalAlpha = t.life * .45 * frac;
      ctx.shadowBlur = 6; ctx.shadowColor = '#88ccff';
      ctx.fillStyle = '#88ccff';
      ctx.beginPath(); ctx.arc(t.x,t.y,2.2*frac+.4,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;

    // Body
    ctx.save();
    ctx.translate(ship.x, ship.y);
    const ang = ship.flying
      ? Math.atan2(ship.vy, ship.vx)
      : ship.orbitAngle + (ship.orbitSpd>0 ? -Math.PI/2 : Math.PI/2);
    ctx.rotate(ang);

    // Streak glow ring
    if (streakCount>=3) {
      ctx.globalAlpha = .25+Math.sin(gameTime*4)*.15;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14; ctx.shadowColor = '#FFD700';
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;
    }

    ctx.globalAlpha=1;
    ctx.shadowBlur = 18; ctx.shadowColor = '#88ccff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(11,0); ctx.lineTo(-6,-6); ctx.lineTo(-3,0); ctx.lineTo(-6,6);
    ctx.closePath(); ctx.fill();

    // Engine exhaust glow
    const eg = ctx.createRadialGradient(-3,0,0,-3,0,9);
    eg.addColorStop(0,'rgba(100,200,255,.75)');
    eg.addColorStop(1,'rgba(100,200,255,0)');
    ctx.fillStyle = eg;
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(-3,0,9,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.shadowBlur = 8; ctx.shadowColor = p.col;
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    for (const p of popups) {
      ctx.globalAlpha = eOut(p.life);
      ctx.fillStyle = p.col;
      ctx.shadowBlur = 10; ctx.shadowColor = p.col;
      ctx.font = 'bold 19px system-ui,sans-serif';
      ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  // ── HUD ────────────────────────────────────────────────────────────────
  function drawHUD() {
    if (state==='MENU' || state==='RESULTS') return;

    // Score
    ctx.save();
    ctx.textAlign='center';
    ctx.font='bold 50px system-ui,sans-serif';
    ctx.shadowBlur = newBestFlash>0 ? 25 : 8;
    ctx.shadowColor = newBestFlash>0 ? '#FFD700' : 'rgba(255,255,255,.4)';
    ctx.fillStyle = newBestFlash>0
      ? `rgba(255,${Math.floor(215+newBestFlash*40)},0,1)`
      : '#ffffff';
    ctx.fillText(score, W/2, 72);
    ctx.restore();

    // Gems top-right
    UI.gemIcon(ctx, W-46, 46, 11, .85);
    ctx.fillStyle='rgba(255,255,255,.8)'; ctx.font='bold 17px system-ui,sans-serif';
    ctx.textAlign='left'; ctx.fillText(gems, W-28, 53);

    // Best score top-left
    if (highScore>0) {
      UI.starIcon(ctx,38,47,13,.7);
      ctx.fillStyle='rgba(255,215,0,.75)';
      ctx.font='15px system-ui,sans-serif';
      ctx.textAlign='left';
      ctx.fillText(highScore,55,53);
    }

    // Level indicator — tier progress dots + tier name bottom-left
    if (state === 'PLAYING' || state === 'DYING') {
      const tier = getCurTier();
      const tc   = TIER_COLORS[tier];
      const filled = diffLv % TIER_SIZE;          // 0–4 within current tier
      const dotR = 4, dotGap = 14;
      const startX = 18, dotY = H - 32;
      for (let i = 0; i < TIER_SIZE; i++) {
        ctx.globalAlpha = i < filled ? .92 : .22;
        ctx.fillStyle = tc;
        ctx.shadowBlur = i < filled ? 8 : 0; ctx.shadowColor = tc;
        ctx.beginPath(); ctx.arc(startX + i*dotGap, dotY, dotR, 0, Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      // Level number + tier label
      ctx.globalAlpha = .75; ctx.fillStyle = tc;
      ctx.font = 'bold 11px system-ui,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Lv.' + (diffLv+1), startX + TIER_SIZE*dotGap + 4, dotY + 4);
      ctx.globalAlpha = .45; ctx.fillStyle = '#ffffff';
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(TIER_NAMES[tier], startX, dotY + 18);
      ctx.globalAlpha = 1;
    }

    // Mute button
    UI.muteIcon(ctx, W-26, 26, 11, Audio.getMuted(), .55);
  }

  function drawLevelUpFlash() {
    const p  = levelUpTimer / 1.5;
    const tc = getCurTierColor();
    const flashA = p > .5 ? (p-.5)*2*.32 : p*2*.32;
    ctx.fillStyle = `rgba(255,215,0,${flashA})`;
    ctx.fillRect(0,0,W,H);
    if (p > .35) {
      ctx.save();
      const a = (p-.35)/.65;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      // Big level number
      ctx.fillStyle = tierUpFlash ? tc : '#FFD700';
      ctx.font = 'bold 58px system-ui';
      ctx.shadowBlur = 28; ctx.shadowColor = tierUpFlash ? tc : '#FFD700';
      ctx.fillText(diffLv+1, W/2, tierUpFlash ? H/2-14 : H/2+18);
      // Tier name on tier change
      if (tierUpFlash) {
        ctx.fillStyle = tc; ctx.font = 'bold 22px system-ui';
        ctx.shadowBlur = 18; ctx.shadowColor = tc;
        ctx.fillText(TIER_NAMES[getCurTier()].toUpperCase(), W/2, H/2+28);
      }
      ctx.restore();
    }
  }

  function drawMenu() {
    // Vignette
    ctx.fillStyle='rgba(0,0,0,.42)';
    ctx.fillRect(0,0,W,H);

    // Big planet
    const cx=W/2, cy=H*.36;
    ctx.save();
    ctx.shadowBlur=40; ctx.shadowColor='#6C8EEF';
    const pb=ctx.createRadialGradient(cx-18,cy-18,6,cx,cy,55);
    pb.addColorStop(0,'#ffffff'); pb.addColorStop(.28,'#6C8EEF'); pb.addColorStop(1,'#1a1a4e');
    ctx.fillStyle=pb;
    ctx.beginPath(); ctx.arc(cx,cy,55,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Orbit ring
    ctx.save();
    ctx.strokeStyle='rgba(168,237,234,.45)'; ctx.lineWidth=2;
    ctx.shadowBlur=10; ctx.shadowColor='#a8edea';
    ctx.beginPath(); ctx.arc(cx,cy,92,0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // Ship orbiting
    const ma=menuPulse;
    const mx=cx+Math.cos(ma)*92, my=cy+Math.sin(ma)*92;
    ctx.save();
    ctx.translate(mx,my); ctx.rotate(ma+Math.PI/2);
    ctx.shadowBlur=16; ctx.shadowColor='#88ccff';
    ctx.fillStyle='#ffffff';
    ctx.beginPath();
    ctx.moveTo(10,0); ctx.lineTo(-6,-6); ctx.lineTo(-3,0); ctx.lineTo(-6,6);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Play button
    const py=H*.69;
    const pulse=1+Math.sin(menuPulse*2.2)*.055;
    ctx.save();
    ctx.translate(W/2,py); ctx.scale(pulse,pulse);
    ctx.shadowBlur=28; ctx.shadowColor='#a8edea';
    ctx.fillStyle='rgba(168,237,234,.18)';
    ctx.strokeStyle='rgba(168,237,234,.82)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,48,0,Math.PI*2); ctx.fill(); ctx.stroke();
    UI.playIcon(ctx,5,0,26);
    ctx.restore();

    // Best score + max level
    if (highScore>0 || maxLevel>0) {
      ctx.save();
      ctx.translate(W/2, H*.84);
      if (highScore>0) {
        UI.starIcon(ctx,-46,0,14,.9);
        ctx.fillStyle='rgba(255,215,0,.9)';
        ctx.font='bold 26px system-ui,sans-serif';
        ctx.textAlign='left';
        ctx.shadowBlur=10; ctx.shadowColor='#FFD700';
        ctx.fillText(highScore,-24,9);
        ctx.shadowBlur=0;
      }
      if (maxLevel>0) {
        ctx.fillStyle='rgba(168,237,234,.75)';
        ctx.font='bold 14px system-ui,sans-serif';
        ctx.textAlign='center';
        ctx.shadowBlur=6; ctx.shadowColor='#a8edea';
        ctx.fillText('Lv.'+(maxLevel+1), highScore>0?60:0, 9);
        ctx.shadowBlur=0;
      }
      ctx.restore();
    }

    // Mute
    UI.muteIcon(ctx, W-26, 26, 11, Audio.getMuted(), .55);

    // Info button bottom-left
    const ip = 1 + Math.sin(menuPulse*1.8)*.04;
    ctx.save();
    ctx.translate(42, H-52); ctx.scale(ip, ip);
    ctx.globalAlpha = .65;
    ctx.strokeStyle = 'rgba(168,237,234,.7)'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10; ctx.shadowColor = '#a8edea';
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#a8edea';
    ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
    ctx.fillText('i', 0, 6);
    ctx.restore();

    // Settings gear icon bottom-right
    ctx.save();
    ctx.translate(W-42, H-52);
    ctx.rotate(menuPulse * 0.22);
    ctx.globalAlpha = .6;
    ctx.strokeStyle='rgba(168,237,234,.8)'; ctx.lineWidth=2;
    ctx.shadowBlur=8; ctx.shadowColor='#a8edea';
    const gN=8, gO=19, gI=14, gH=7, gT=0.24;
    ctx.beginPath();
    for(let gi=0;gi<gN;gi++){
      const ga=gi/gN*Math.PI*2;
      const ga0=ga-gT/2, ga1=ga+gT/2;
      gi===0?ctx.moveTo(Math.cos(ga0)*gI,Math.sin(ga0)*gI):ctx.lineTo(Math.cos(ga0)*gI,Math.sin(ga0)*gI);
      ctx.lineTo(Math.cos(ga0)*gO,Math.sin(ga0)*gO);
      ctx.lineTo(Math.cos(ga1)*gO,Math.sin(ga1)*gO);
      ctx.lineTo(Math.cos(ga1)*gI,Math.sin(ga1)*gI);
    }
    ctx.closePath();
    ctx.moveTo(gH,0); ctx.arc(0,0,gH,0,Math.PI*2,true);
    ctx.fillStyle='rgba(168,237,234,.15)';
    ctx.fill('evenodd');
    ctx.stroke();
    ctx.shadowBlur=0; ctx.globalAlpha=1;
    ctx.restore();
  }

  function drawTutorial() {
    if (!ship || !ship.orbitPlanet) return;

    // Pulse the nearest planet's gravity ring (no confusing second arrow)
    let target = null, td2 = Infinity;
    for (const p of planets) {
      if (p === ship.orbitPlanet) continue;
      const d = dist2(ship.x, ship.y, p.x, p.y);
      if (d < td2) { td2 = d; target = p; }
    }
    if (target) {
      const pulse = .5 + Math.sin(tutPhase * 3) * .4;
      const sx = target.x - cam.x, sy = target.y - cam.y;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
      ctx.shadowBlur = 18; ctx.shadowColor = '#FFD700';
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(sx, sy, dynGravR(target), 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Tap-hand pulse below ship
    const sx = ship.x - cam.x, sy = ship.y - cam.y + 65;
    const a = .45 + Math.sin(tutPhase*3) * .45;
    ctx.save();
    ctx.globalAlpha = a; ctx.translate(sx, sy);
    const rp = (tutPhase * 2) % 1;
    ctx.globalAlpha = a * (1 - rp);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 18 + rp*28, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0,-27); ctx.lineTo(7,-12); ctx.lineTo(3,-12);
    ctx.lineTo(3,4); ctx.lineTo(-3,4); ctx.lineTo(-3,-12); ctx.lineTo(-7,-12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawInfo() {
    // Fullscreen how-to-play overlay (icon-only, 3 animated steps + sound tip)
    ctx.fillStyle = 'rgba(5,6,22,.94)';
    ctx.fillRect(0, 0, W, H);

    const t = gameTime;
    const cards = [
      { y: H*.14, draw: drawInfoOrbit },
      { y: H*.38, draw: drawInfoLaunch },
      { y: H*.62, draw: drawInfoGem },
      { y: H*.82, draw: drawInfoSound },
    ];
    cards.forEach(c => c.draw(W/2, c.y, t));

    // "tap to close" ripple at bottom
    const rp = (t * 1.4) % 1;
    ctx.globalAlpha = .35 * (1 - rp);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W/2, H*.95, 14 + rp*20, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = .6;
    ctx.fillStyle = '#ffffff'; ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('▶', W/2, H*.956);
    ctx.globalAlpha = 1;
  }

  function drawInfoOrbit(cx, cy, t) {
    // Step 1: ship orbiting a planet → tap → launches
    const pr = 22, orR = 48;
    ctx.save(); ctx.translate(cx, cy);

    // Small planet
    ctx.shadowBlur = 18; ctx.shadowColor = '#6C8EEF';
    const pg = ctx.createRadialGradient(-7,-7,3,0,0,pr);
    pg.addColorStop(0,'#fff'); pg.addColorStop(.3,'#6C8EEF'); pg.addColorStop(1,'#2B2D6B');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0,0,pr,0,Math.PI*2); ctx.fill();

    // Orbit ring
    ctx.shadowBlur = 0; ctx.globalAlpha = .35;
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0,0,orR,0,Math.PI*2); ctx.stroke();

    // Ship position + aim arrow
    const ang = t * 1.35;
    const sx = Math.cos(ang)*orR, sy = Math.sin(ang)*orR;
    const aimX = -Math.sin(ang), aimY = Math.cos(ang);

    ctx.globalAlpha = .5;
    ctx.strokeStyle = '#a8edea'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+aimX*42,sy+aimY*42); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#a8edea';
    ctx.beginPath();
    ctx.moveTo(sx+aimX*50,sy+aimY*50);
    ctx.lineTo(sx+aimX*40-aimY*4,sy+aimY*40+aimX*4);
    ctx.lineTo(sx+aimX*40+aimY*4,sy+aimY*40-aimX*4);
    ctx.closePath(); ctx.fill();

    // Ship
    ctx.globalAlpha = 1; ctx.shadowBlur = 12; ctx.shadowColor = '#88ccff';
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(ang+Math.PI/2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-5,-4); ctx.lineTo(-2,0); ctx.lineTo(-5,4); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.restore();
  }

  function drawInfoLaunch(cx, cy, t) {
    // Step 2: ship flying into gravity ring of next planet
    const prog = (Math.sin(t*1.1)*.5+.5);
    ctx.save(); ctx.translate(cx, cy);

    // Target planet + big gravity ring
    const px = 55 - prog*30, py = -10 + prog*5;
    const pr = 18, grR = 44;
    ctx.shadowBlur = 15; ctx.shadowColor = '#1ABC9C';
    const pg2 = ctx.createRadialGradient(px-5,py-5,3,px,py,pr);
    pg2.addColorStop(0,'#fff'); pg2.addColorStop(.3,'#1ABC9C'); pg2.addColorStop(1,'#0d6e58');
    ctx.fillStyle=pg2; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.globalAlpha=.55+(Math.sin(t*2)*.2);
    ctx.strokeStyle='#1ABC9C'; ctx.lineWidth=2; ctx.setLineDash([8,5]);
    ctx.beginPath(); ctx.arc(px,py,grR,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Flying ship
    const sx = -55 + prog*80, sy = 5 - prog*10;
    ctx.globalAlpha=1; ctx.shadowBlur=12; ctx.shadowColor='#88ccff';
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(-0.18);
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-5,-4); ctx.lineTo(-2,0); ctx.lineTo(-5,4); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Trail
    for(let i=1;i<=5;i++){
      const tx=sx-i*8, ty=sy+i*1.5;
      ctx.globalAlpha=.3*(1-i/6);
      ctx.fillStyle='#88ccff';
      ctx.beginPath(); ctx.arc(tx,ty,2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawInfoGem(cx, cy, t) {
    // Step 3: collect gems = bonus score
    ctx.save(); ctx.translate(cx, cy);
    const pulse = .85 + Math.sin(t*2.5)*.15;
    ctx.scale(pulse, pulse);
    const s = 14;
    ctx.shadowBlur = 16; ctx.shadowColor = '#a8edea';
    ctx.rotate(t * 1.2);
    const gg = ctx.createLinearGradient(0,-s*1.3,0,s);
    gg.addColorStop(0,'#dff8f8'); gg.addColorStop(1,'#7c83fd');
    ctx.fillStyle=gg;
    ctx.beginPath(); ctx.moveTo(0,-s*1.3); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0;

    // +5 popup
    ctx.rotate(-t*1.2);
    const popA = (.7+Math.sin(t*2)*.3);
    ctx.globalAlpha = popA;
    ctx.fillStyle = '#a8edea'; ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center'; ctx.shadowBlur = 8; ctx.shadowColor = '#a8edea';
    ctx.fillText('+5', 38, -20);
    ctx.restore();
  }

  // ── Nova logo (shared between splash + settings) ──────────────────────
  function drawNovaLogo(cx, cy, r, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    // Outer glow halo
    const hg = ctx.createRadialGradient(0,0,0,0,0,r*1.7);
    hg.addColorStop(0,'rgba(168,237,234,.22)');
    hg.addColorStop(1,'rgba(168,237,234,0)');
    ctx.fillStyle=hg;
    ctx.beginPath(); ctx.arc(0,0,r*1.7,0,Math.PI*2); ctx.fill();
    // 8-point star
    ctx.shadowBlur=24; ctx.shadowColor='#a8edea';
    const sg=ctx.createRadialGradient(0,0,0,0,0,r);
    sg.addColorStop(0,'#ffffff');
    sg.addColorStop(0.38,'#a8edea');
    sg.addColorStop(0.72,'#6C8EEF');
    sg.addColorStop(1,'rgba(20,20,80,0)');
    ctx.fillStyle=sg;
    ctx.beginPath();
    for(let i=0;i<16;i++){
      const a=(i*Math.PI/8)+(rot||0);
      const rr=i%2===0?r:r*.36;
      i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    ctx.closePath(); ctx.fill();
    // Centre dot
    ctx.shadowBlur=12; ctx.shadowColor='#fff';
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(0,0,r*.13,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── Splash screen (company branding) ──────────────────────────────────
  function updateSplash(dt) {
    splashTimer += dt;
    if (splashTimer > 2.6) {
      state = 'MENU';
      // startAmbient: only works after user gesture (auto fails silently before that)
      Audio.startAmbient();
    }
  }

  function drawSplash() {
    ctx.fillStyle='#04050e';
    ctx.fillRect(0,0,W,H);
    drawStarsLayer();

    const t=splashTimer;
    const fadeIn  = Math.min(1, t/0.65);
    const fadeOut = t>2.0 ? 1-Math.min(1,(t-2.0)/0.5) : 1;
    const alpha   = eOut(fadeIn)*fadeOut;

    ctx.save();
    ctx.globalAlpha = alpha;

    const rot = t*0.38;
    drawNovaLogo(W/2, H*.40, 54, rot);

    ctx.textAlign='center';
    ctx.shadowBlur=22; ctx.shadowColor='#a8edea';
    ctx.fillStyle='#ffffff';
    ctx.font='bold 40px system-ui,sans-serif';
    ctx.fillText(COMPANY, W/2, H*.605);
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(168,237,234,.65)';
    ctx.font='12px system-ui,sans-serif';
    ctx.fillText('S T U D I O S', W/2, H*.645);
    ctx.fillStyle='rgba(255,255,255,.28)';
    ctx.font='11px system-ui,sans-serif';
    ctx.fillText(TAGLINE, W/2, H*.685);

    // Tap-to-skip hint (only after 0.5s)
    if (t>0.5) {
      const hintA = Math.min(1, (t-0.5)/0.4) * 0.35;
      ctx.globalAlpha = alpha * hintA;
      ctx.fillStyle='#ffffff'; ctx.font='11px system-ui';
      ctx.fillText('▶', W/2, H*.95);
    }

    ctx.restore();
  }

  // ── Settings overlay ───────────────────────────────────────────────────
  function drawSettings() {
    ctx.fillStyle='rgba(4,5,16,.97)';
    ctx.fillRect(0,0,W,H);

    const rot=gameTime*0.40;
    drawNovaLogo(W/2, H*.20, 42, rot);

    ctx.textAlign='center';
    ctx.shadowBlur=14; ctx.shadowColor='#a8edea';
    ctx.fillStyle='#ffffff';
    ctx.font='bold 27px system-ui,sans-serif';
    ctx.fillText(COMPANY, W/2, H*.36);
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(168,237,234,.58)';
    ctx.font='12px system-ui,sans-serif';
    ctx.fillText('S T U D I O S', W/2, H*.40);
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.font='11px system-ui,sans-serif';
    ctx.fillText(TAGLINE, W/2, H*.44);

    // Divider
    ctx.globalAlpha=.18;
    ctx.strokeStyle='#a8edea'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2-90,H*.476); ctx.lineTo(W/2+90,H*.476); ctx.stroke();
    ctx.globalAlpha=1;

    // Sound toggle (tap to toggle)
    const muted=Audio.getMuted();
    ctx.globalAlpha = muted ? .55 : 1;
    UI.muteIcon(ctx, W/2, H*.545, 18, muted, 1);
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(255,255,255,.38)';
    ctx.font='11px system-ui,sans-serif'; ctx.textAlign='center';
    ctx.fillText(muted?'MUTED':'SOUND ON', W/2, H*.598);

    // Divider
    ctx.globalAlpha=.12;
    ctx.beginPath(); ctx.moveTo(W/2-90,H*.63); ctx.lineTo(W/2+90,H*.63); ctx.stroke();
    ctx.globalAlpha=1;

    // Stats: runs | best | max level
    const statsData = [
      { v: runsPlayed, label: '↺' },
      { v: highScore,  label: '★' },
      { v: 'Lv.'+(maxLevel+1), label: '◆' },
    ];
    const statY = H*.69;
    statsData.forEach((s, i) => {
      const sx = W/2 + (i-1) * 88;
      ctx.globalAlpha = .5;
      ctx.fillStyle = '#a8edea'; ctx.font = '12px system-ui';
      ctx.textAlign = 'center'; ctx.fillText(s.label, sx, statY);
      ctx.globalAlpha = .85;
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px system-ui';
      ctx.fillText(s.v, sx, statY + 20);
    });
    ctx.globalAlpha=1;

    // Tier progress badges
    const tierY = H*.79;
    const bW=46, bH=22, bGap=5;
    const bTotalW = TIER_NAMES.length*(bW+bGap)-bGap;
    const bStartX = W/2-bTotalW/2;
    const playerTier = Math.min(Math.floor(maxLevel / TIER_SIZE), TIER_NAMES.length-1);
    TIER_NAMES.forEach((name, t) => {
      const bx = bStartX + t*(bW+bGap);
      const reached = maxLevel > 0 ? t <= playerTier : false;
      ctx.globalAlpha = reached ? .85 : .2;
      ctx.fillStyle = TIER_COLORS[t];
      UI.roundRect(ctx, bx, tierY, bW, bH, 6);
      ctx.fill();
      ctx.globalAlpha = reached ? .5 : .1;
      ctx.strokeStyle = TIER_COLORS[t]; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = reached ? .9 : .35;
      ctx.fillStyle = reached ? '#000' : TIER_COLORS[t];
      ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(name.toUpperCase().slice(0,4), bx+bW/2, tierY+bH/2+3);
    });
    ctx.globalAlpha=1;

    ctx.globalAlpha=.22;
    ctx.fillStyle='#fff'; ctx.font='9px system-ui'; ctx.textAlign='center';
    ctx.fillText('Orbit Hopper  v1.0 · pixelnova.games', W/2, H*.865);
    ctx.globalAlpha=1;

    // Close X — top-right
    ctx.globalAlpha=.6;
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2;
    ctx.shadowBlur=8; ctx.shadowColor='#fff';
    ctx.beginPath(); ctx.arc(W-32,32,15,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W-39,25); ctx.lineTo(W-25,39);
    ctx.moveTo(W-25,25); ctx.lineTo(W-39,39);
    ctx.stroke();
    ctx.shadowBlur=0; ctx.globalAlpha=1;
  }

  function drawInfoSound(cx, cy, t) {
    // Step 4: show mute button location (top-right corner highlight)
    ctx.save(); ctx.translate(cx, cy);
    const pulse = .6 + Math.sin(t*2.5)*.35;

    // Mini corner mockup
    ctx.globalAlpha = .55;
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(-70, -22, 140, 44);

    // Arrow pointing to top-right
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.moveTo(40, -5); ctx.lineTo(60, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56,-10); ctx.lineTo(60,-5); ctx.lineTo(56,0); ctx.stroke();

    UI.muteIcon(ctx, -30, 0, 14, false, .9);
    UI.muteIcon(ctx,  20, 0, 14, true,  .5);

    ctx.restore();
  }

  function drawDying() {
    // Flicker
    const fa=Math.max(0, .45 - deathTimer*.35);
    ctx.fillStyle=`rgba(255,80,80,${fa})`;
    ctx.fillRect(0,0,W,H);

    // Continue prompt (icon-based)
    if (!rewardedUsed && continueAlpha>.02) {
      ctx.save();
      ctx.globalAlpha=continueAlpha;
      ctx.translate(W/2, H*.72);

      // Glow circle
      ctx.shadowBlur=25; ctx.shadowColor='#7bed9f';
      ctx.fillStyle='rgba(123,237,159,.2)';
      ctx.strokeStyle='rgba(123,237,159,.75)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,44,0,Math.PI*2); ctx.fill(); ctx.stroke();

      UI.continueIcon(ctx,0,0,22);
      ctx.restore();
    }

    UI.muteIcon(ctx, W-26, 26, 11, Audio.getMuted(), .55);
  }

  function drawResults() {
    if (resultsAlpha<=0) return;
    const py = resultsSlide;
    const pw=290, ph=350, px=(W-pw)/2;

    ctx.save();
    ctx.globalAlpha = eOut(resultsAlpha);

    // Panel
    ctx.shadowBlur=20; ctx.shadowColor='rgba(168,237,234,.3)';
    ctx.fillStyle='rgba(8,9,28,.88)';
    ctx.strokeStyle='rgba(168,237,234,.38)'; ctx.lineWidth=1.5;
    UI.roundRect(ctx,px,py,pw,ph,22); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;

    // Score big
    ctx.fillStyle='#ffffff';
    ctx.font='bold 76px system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.shadowBlur=12; ctx.shadowColor='rgba(255,255,255,.35)';
    ctx.fillText(score, W/2, py+96);
    ctx.shadowBlur=0;

    // Best row
    const isBest = score>0 && score>=highScore;
    const bx = W/2-22, by = py+148;
    UI.starIcon(ctx,bx,by,15,isBest?1:.65);
    ctx.fillStyle = isBest ? '#FFD700' : 'rgba(255,215,0,.65)';
    ctx.font=(isBest?'bold ':'')+`22px system-ui,sans-serif`;
    ctx.textAlign='left';
    if (isBest) { ctx.shadowBlur=16; ctx.shadowColor='#FFD700'; }
    ctx.fillText(highScore, bx+22, by+8);
    ctx.shadowBlur=0;

    // Gems row
    UI.gemIcon(ctx, W/2-22, py+188, 12);
    ctx.fillStyle = '#a8edea';
    ctx.font='20px system-ui,sans-serif';
    ctx.textAlign='left';
    ctx.fillText(gems + (gemsDoubled?' ×2':''), W/2-2, py+196);

    // Divider
    ctx.globalAlpha=.14;
    ctx.strokeStyle='#a8edea'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(px+18, py+214); ctx.lineTo(px+pw-18, py+214); ctx.stroke();
    ctx.globalAlpha=1;

    // Level + tier row
    const lvDisplay = diffLv + 1;
    const isMaxLv   = diffLv > 0 && diffLv >= maxLevel;
    const tier      = Math.min(Math.floor(diffLv / TIER_SIZE), TIER_NAMES.length-1);
    const tc        = TIER_COLORS[tier];
    ctx.textAlign='center';
    // Tier name
    ctx.fillStyle = tc; ctx.font = 'bold 13px system-ui';
    ctx.shadowBlur=8; ctx.shadowColor=tc;
    ctx.fillText(TIER_NAMES[tier].toUpperCase(), W/2-30, py+234);
    ctx.shadowBlur=0;
    // Level number
    ctx.fillStyle = isMaxLv ? '#FFD700' : 'rgba(255,215,0,.65)';
    ctx.font=(isMaxLv?'bold ':'')+`13px system-ui`;
    if (isMaxLv) { ctx.shadowBlur=8; ctx.shadowColor='#FFD700'; }
    ctx.fillText('Lv.'+lvDisplay+(isMaxLv?' ✦':''), W/2+42, py+234);
    ctx.shadowBlur=0;

    // Buttons
    const rb = resultsBtnPos();

    // Double gem button
    if (!gemsDoubled) {
      ctx.save();
      ctx.translate(rb.doubleGem.x, rb.doubleGem.y);
      const p2=1+Math.sin(gameTime*2.5)*.04;
      ctx.scale(p2,p2);
      ctx.shadowBlur=16; ctx.shadowColor='#a8edea';
      ctx.fillStyle='rgba(168,237,234,.12)';
      ctx.strokeStyle='rgba(168,237,234,.65)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.fill(); ctx.stroke();
      UI.doubleGemIcon(ctx,0,0,14);
      ctx.restore();
    }

    // Retry button
    ctx.save();
    ctx.translate(rb.retry.x, rb.retry.y);
    const p3=1+Math.sin(gameTime*3)*.04;
    ctx.scale(p3,p3);
    ctx.shadowBlur=16; ctx.shadowColor='#a8edea';
    ctx.fillStyle='rgba(168,237,234,.14)';
    ctx.strokeStyle='rgba(168,237,234,.75)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.fill(); ctx.stroke();
    UI.retryIcon(ctx,0,0,20);
    ctx.restore();

    ctx.restore();

    UI.muteIcon(ctx, W-26, 26, 11, Audio.getMuted(), .55);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  function init(cvs) {
    canvas = cvs;
    ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    try {
      highScore  = parseInt(localStorage.getItem('orbit_best')||'0');
      runsPlayed = parseInt(localStorage.getItem('orbit_runs')||'0');
      maxLevel   = parseInt(localStorage.getItem('orbit_maxlevel')||'0');
    } catch(e) { maxLevel = 0; }

    menuPulse = 0; bgPhase = 0; gameTime = 0;
    resultsAlpha = 0; resultsSlide = 0;
    newBestFlash = 0; deathTimer = 0; continueTimer = 0; continueAlpha = 0;
    score = 0; gems = 0; diffLv = 0; streakCount = 0; levelUpTimer = 0;
    rewardedUsed = false; gemsDoubled = false; tierUpFlash = false;
    splashTimer = 0; settingsOpen = false;
    state = 'SPLASH';
    cam = { x:0, y:0, tx:0, ty:0, shake:0 };
    particles=[]; popups=[]; hazards=[]; gemsList=[];

    makeStars();

    // Menu init
    const mp = makePlanet(W/2, H/2, true);
    mp.alpha=1; mp.scale=1;
    planets = [mp];
    ship = makeShip(mp);
  }

  function step(dt) {
    if (Input.consumePress()) {
      Audio.resume();
      onTap();
    }
    update(dt);
    render();
  }

  // Read-only hooks for automated testing
  function getState() { return state; }
  function getScore() { return score; }

  return { init, step, getState, getScore };
})();
