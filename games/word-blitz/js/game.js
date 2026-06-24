'use strict';
function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch(e) {} }
var _msDone = {};
function _milestone(s) {
  var ms = [10,25,50,100,250,500];
  for (var i=0; i<ms.length; i++) {
    if (s >= ms[i] && !_msDone[ms[i]]) {
      _msDone[ms[i]] = true;
      vib([10,30,10]);
      try { Audio.play('highscore'); } catch(e) {}
      AdManager.happyTime(0.8);
      _showMsFlash(ms[i]);
      break;
    }
  }
}
function _showMsFlash(n) {
  if (typeof document === 'undefined') return;
  var el = document.createElement('div');
  el.textContent = n >= 100 ? n+'!!!' : n >= 50 ? n+'!!' : n+'!';
  Object.assign(el.style, {
    position:'fixed', top:'30%', left:'50%', transform:'translateX(-50%)',
    fontSize:'72px', fontWeight:'900', color:'#FFD700',
    textShadow:'0 0 30px #FFD700, 0 0 60px rgba(255,215,0,0.5)',
    fontFamily:'system-ui,sans-serif', zIndex:'9999',
    pointerEvents:'none', opacity:'1', transition:'opacity 1.5s ease 0.8s'
  });
  document.body.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; }, 100);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2500);
}
var WordBlitz = (function () {
  var c, ctx, best = 0;
  var VW = 390, VH = 844;
  var state = 'MENU';
  var score, lives, bubbles, targetWord, progress, timer, timerMax;
  var WORDS = ['CAT','DOG','SUN','MAP','JAM','FLY','BOX','HOP','ZAP','GEM','ICE','OAK','PIE','QUE','SKY'];

  function init(canvas, bestScore) {
    c = canvas; ctx = c.getContext('2d'); best = bestScore || 0; state = 'MENU';
  }

  function newRound() {
    targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    progress = 0; timerMax = Math.max(8, 15 - score * 0.3); timer = timerMax;
    bubbles = [];
    var pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(function(l){ return targetWord.indexOf(l) === -1; });
    pool.sort(function() { return Math.random() - 0.5; });
    var letters = targetWord.split('').concat(pool.slice(0, 9));
    letters.sort(function() { return Math.random() - 0.5; });
    for (var i = 0; i < letters.length; i++) {
      bubbles.push({
        x: 30 + Math.random() * (VW - 60),
        y: 250 + Math.random() * (VH - 360),
        r: 28, letter: letters[i],
        color: ['#FF6B6B','#4EC5F1','#6BCB77','#FFD700','#CC5DE8'][Math.floor(Math.random()*5)],
        hit: false
      });
    }
  }

  function startGame() {
    _msDone = {};
    score = 0; lives = 3; state = 'PLAYING';
    try { AdManager.gameplayStart(); } catch(e) {}
    newRound();
  }

  function update(dt) {
  if (dt > 0.05) dt = 0.05;
    if (state !== 'PLAYING') return;
    timer -= dt;
    if (timer <= 0) {
      lives--;
      vib([25,50,25]);
      try { Audio.play('lose'); } catch(e) {}
      if (lives <= 0) { if (score > best) { best = score; AdManager.happyTime(1.0); } state = 'DEAD'; vib([40,80,80]); try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
        AdManager.showInterstitial(() => {});
        try { AdManager.offerDoubleScore(score, 'wordblitz_best'); } catch(e) {}
      } else newRound();
    }
    bubbles.forEach(function(b) {
      b.y += Math.sin(Date.now()/1000 + b.x) * 0.3;
    });
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a0020'); g.addColorStop(1, '#002030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (state === 'MENU') {
      ctx.fillStyle = '#4EC5F1'; ctx.font = 'bold 50px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 22; ctx.shadowColor = '#4EC5F1';
      ctx.fillText('WORD BLITZ', VW/2, 270);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Tap letters to spell words!', VW/2, 350);
      ctx.fillText('TAP TO PLAY', VW/2, 410);
      ctx.fillStyle = '#a8edea'; ctx.font = '18px system-ui';
      ctx.fillText('BEST: ' + best, VW/2, 470);
      return;
    }

    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Spell: ' + targetWord, VW/2, 110);

    var prgW = 200;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(VW/2 - prgW/2, 125, prgW, 8);
    ctx.fillStyle = '#6BCB77'; ctx.fillRect(VW/2 - prgW/2, 125, prgW * (progress / targetWord.length), 8);

    ctx.fillStyle = '#a8edea'; ctx.font = '24px system-ui';
    ctx.fillText(targetWord.substring(0, progress) + '_', VW/2, 165);

    var timerFrac = Math.max(0, timer / timerMax);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, 180, VW-40, 6);
    ctx.fillStyle = timerFrac > 0.5 ? '#6BCB77' : timerFrac > 0.25 ? '#FFD700' : '#f87171';
    ctx.fillRect(20, 180, (VW-40)*timerFrac, 6);

    bubbles.forEach(function(b) {
      if (b.hit) return;
      ctx.fillStyle = b.color; ctx.shadowBlur = 10; ctx.shadowColor = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(b.letter, b.x, b.y + 7);
    });

    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 16, 44);
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.font = '22px system-ui';
    var hearts = '';
    for (var h = 0; h < 3; h++) hearts += (h < lives ? '♥' : '♡');
    ctx.fillText(hearts, VW-16, 44);

    if (state === 'DEAD') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
      ctx.shadowBlur = 18; ctx.shadowColor = '#f87171'; ctx.fillText('GAME OVER', VW/2, 310);
      ctx.shadowBlur = 0; ctx.fillStyle = '#4EC5F1'; ctx.font = 'bold 30px system-ui';
      ctx.fillText('Words: ' + score, VW/2, 380);
      ctx.fillStyle = '#a8edea'; ctx.font = '22px system-ui'; ctx.fillText('Best: ' + best, VW/2, 425);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('TAP TO RETRY', VW/2, 495);
    }
    ctx.textAlign = 'left';
  }

  function tap(x, y) {
    if (state === 'MENU') { startGame(); return; }
    if (state === 'DEAD') { startGame(); return; }
    if (state !== 'PLAYING') return;

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i]; if (b.hit) continue;
      var dx = x - b.x, dy = y - b.y;
      if (dx*dx + dy*dy < b.r*b.r) {
        if (b.letter === targetWord[progress]) {
          b.hit = true; progress++;
          try { Audio.play('tap'); } catch(e) {}
          if (progress >= targetWord.length) {
            score++; vib(8); _milestone(score); if (score > best) { best = score; AdManager.happyTime(1.0); }
            try { Audio.play('gem'); } catch(e) {}
            setTimeout(function() { if (state==='PLAYING') newRound(); }, 400);
          }
        } else {
          lives--;
          vib([25,50,25]);
          try { Audio.play('crash'); } catch(e) {}
          if (lives <= 0) { state = 'DEAD'; vib([40,80,80]); try { AdManager.gameplayStop(); AdManager.onRunEnd(); } catch(e) {}
            AdManager.showInterstitial(() => {});
            try { AdManager.offerDoubleScore(score, 'wordblitz_best'); } catch(e) {}
          }
        }
        return;
      }
    }
  }

  function getBest() { return best; }
  return { init: init, update: update, draw: draw, tap: tap, getBest: getBest };
})();
