/* Shared ad manager — auto-detects CrazyGames / GameDistribution portals */
'use strict';
const AdManager = (() => {
  const MIN_INTERVAL_MS = 60000;
  const MAX_EVERY_N_RUNS = 3;
  let _lastAdTs = 0, _runsSinceLast = 0;

  const NullAdapter = {
    init() {}, gameplayStart() {}, gameplayStop() {},
    showInterstitial(cb) { cb(); },
    showRewarded(ok, skip) { skip(); },
  };

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

  function showInterstitial(cb) {
    const now = Date.now();
    if (_runsSinceLast < MAX_EVERY_N_RUNS || now - _lastAdTs < MIN_INTERVAL_MS) { cb(); return; }
    _lastAdTs = now; _runsSinceLast = 0;
    _adapter().showInterstitial(cb);
  }

  function showRewarded(ok, skip) { _adapter().showRewarded(ok, skip); }

  function onRunEnd() { _runsSinceLast++; }

  return { init, gameplayStart, gameplayStop, showInterstitial, showRewarded, onRunEnd };
})();
