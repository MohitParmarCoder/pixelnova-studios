/* Shared ad manager — auto-detects CrazyGames / GameDistribution portals */
'use strict';
const AdManager = (() => {
  const MIN_INTERVAL_MS = 60000;
  const MAX_EVERY_N_RUNS = 3;
  let _lastAdTs = 0, _runsSinceLast = 0;

  // ── Null adapter (local dev / no portal) ────────────────────────────────────
  const NullAdapter = {
    init() {}, gameplayStart() {}, gameplayStop() {},
    showInterstitial(cb) { cb(); },
    showRewarded(ok, skip) { skip(); },
  };

  // ── CrazyGames SDK v3 ───────────────────────────────────────────────────────
  const CrazyGamesAdapter = {
    _ready: false,
    init() {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      sdk.init().then(() => { this._ready = true; }).catch(() => {});
    },
    gameplayStart() { if (this._ready) window.CrazyGames?.SDK?.game?.gameplayStart(); },
    gameplayStop()  { if (this._ready) window.CrazyGames?.SDK?.game?.gameplayStop(); },
    showInterstitial(cb) {
      if (!this._ready) { cb(); return; }
      window.CrazyGames.SDK.ad.requestAd('midgame', { adStarted(){}, adFinished: cb, adError: cb });
    },
    showRewarded(ok, skip) {
      if (!this._ready) { skip(); return; }
      window.CrazyGames.SDK.ad.requestAd('rewarded', { adStarted(){}, adFinished: ok, adError: skip });
    },
  };

  // ── GameDistribution SDK v4 ─────────────────────────────────────────────────
  const GameDistributionAdapter = {
    _ready: false,
    init() {
      if (typeof gdsdk === 'undefined') return;
      this._ready = true;
    },
    gameplayStart() {}, gameplayStop() {},
    showInterstitial(cb) {
      if (!this._ready) { cb(); return; }
      gdsdk.showAd(gdsdk.AdType.Interstitial).then(cb).catch(cb);
    },
    showRewarded(ok, skip) {
      if (!this._ready) { skip(); return; }
      gdsdk.showAd(gdsdk.AdType.Rewarded).then(ok).catch(skip);
    },
  };

  function _adapter() {
    const p = (typeof window !== 'undefined') ? (window.GAME_PORTAL || 'null') : 'null';
    if (p === 'crazygames')       return CrazyGamesAdapter;
    if (p === 'gamedistribution') return GameDistributionAdapter;
    return NullAdapter;
  }

  function init()          { _adapter().init(); }
  function gameplayStart() { _adapter().gameplayStart(); }
  function gameplayStop()  { _adapter().gameplayStop(); }

  // Interstitial: frequency-capped (1 per 3 runs, 60 s minimum gap)
  function showInterstitial(cb) {
    const now = Date.now();
    if (_runsSinceLast < MAX_EVERY_N_RUNS || now - _lastAdTs < MIN_INTERVAL_MS) { cb(); return; }
    _lastAdTs = now; _runsSinceLast = 0;
    _adapter().showInterstitial(cb);
  }

  function showRewarded(ok, skip) { _adapter().showRewarded(ok, skip); }

  function onRunEnd() { _runsSinceLast++; }

  // ── "Watch Ad — Double Score" DOM overlay ───────────────────────────────────
  // Call AdManager.offerDoubleScore(score, bestKey) from a game's death handler.
  // Shows a branded "Watch Ad – 2x Score" button over the canvas.
  // On reward: saves score*2 to localStorage[bestKey] if > current saved value
  //            and shows a "SCORE DOUBLED! ✕2" flash.
  // Button auto-hides after 8 s if ignored.
  let _overlay = null;

  function offerDoubleScore(score, bestKey) {
    if (typeof document === 'undefined' || !score) return;
    removeDoubleScoreOverlay();

    // Inject keyframes once
    if (!document.getElementById('__pn_kf')) {
      const sty = document.createElement('style');
      sty.id = '__pn_kf';
      sty.textContent =
        '@keyframes pnPulse{0%,100%{transform:scale(1) translateX(-50%)}50%{transform:scale(1.06) translateX(-50%)}}' +
        '@keyframes pnFade{0%{opacity:1;transform:translateY(0) translateX(-50%)}100%{opacity:0;transform:translateY(-40px) translateX(-50%)}}';
      document.head.appendChild(sty);
    }

    const canvas = document.getElementById('gameCanvas');
    const parent = (canvas && canvas.parentElement) ? canvas.parentElement : document.body;
    if (canvas) parent.style.position = parent.style.position || 'relative';

    const ov = document.createElement('div');
    ov.id = '__pn_rewarded_ov';
    Object.assign(ov.style, {
      position: 'absolute', bottom: '22%', left: '50%',
      transform: 'translateX(-50%)', zIndex: '99', pointerEvents: 'none',
    });

    const btn = document.createElement('button');
    btn.textContent = '📺  Watch Ad  •  Double Score  ×2';
    Object.assign(btn.style, {
      pointerEvents: 'all', cursor: 'pointer', border: 'none', outline: 'none',
      borderRadius: '40px', padding: '15px 34px', fontSize: '16px', fontWeight: '800',
      fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', letterSpacing: '0.03em',
      background: 'linear-gradient(135deg, #00eaff 0%, #b06bff 100%)',
      color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(176,107,255,0.5)',
      animation: 'pnPulse 1.8s ease-in-out infinite',
      transformOrigin: 'center',
    });

    btn.onclick = () => {
      removeDoubleScoreOverlay();
      showRewarded(
        () => {
          // Reward granted — double and save
          const doubled = score * 2;
          if (bestKey) {
            try {
              const saved = parseInt(localStorage.getItem(bestKey), 10) || 0;
              if (doubled > saved) localStorage.setItem(bestKey, String(doubled));
            } catch (e) {}
          }
          // Show a brief "DOUBLED!" flash overlay
          _showDoubledFlash(doubled, parent);
        },
        () => {} // skipped or error — do nothing
      );
    };

    ov.appendChild(btn);
    parent.appendChild(ov);
    _overlay = ov;
    setTimeout(removeDoubleScoreOverlay, 8000);
  }

  function _showDoubledFlash(doubled, parent) {
    const fl = document.createElement('div');
    Object.assign(fl.style, {
      position: 'absolute', top: '35%', left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '100', pointerEvents: 'none',
      textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      animation: 'pnFade 2s ease-out forwards',
    });
    fl.innerHTML =
      '<div style="font-size:28px;font-weight:900;color:#FFD700;text-shadow:0 0 20px #FFD700">SCORE DOUBLED!</div>' +
      '<div style="font-size:44px;font-weight:900;color:#fff;margin-top:4px">' + doubled + '</div>';
    parent.appendChild(fl);
    setTimeout(() => { if (fl.parentElement) fl.parentElement.removeChild(fl); }, 2100);
  }

  function removeDoubleScoreOverlay() {
    if (_overlay && _overlay.parentElement) _overlay.parentElement.removeChild(_overlay);
    _overlay = null;
  }

  return { init, gameplayStart, gameplayStop, showInterstitial, showRewarded, onRunEnd, offerDoubleScore, removeDoubleScoreOverlay };
})();
