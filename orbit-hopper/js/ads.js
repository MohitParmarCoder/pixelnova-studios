'use strict';

// AdManager – NullAdapter + portal stubs
// Set config.adapter to 'crazygames' or 'gamedistribution' after acceptance
const AdManager = (() => {
  const config = {
    adapter: 'null',
    minIntervalMs: 60000,   // 60 s minimum between interstitials
    maxEveryNRuns: 3,        // show at most every 3rd run
  };

  let _lastInterstitialAt = 0;
  let _runsSinceLast = 0;

  // ── NullAdapter ──────────────────────────────────────────────────────────
  const NullAdapter = {
    init()              { console.log('[Ads] NullAdapter ready'); },
    gameplayStart()     { console.log('[Ads] gameplayStart'); },
    gameplayStop()      { console.log('[Ads] gameplayStop'); },
    showInterstitial(cb){ console.log('[Ads] interstitial (null)'); setTimeout(cb, 50); },
    showRewarded(ok, skip) {
      console.log('[Ads] rewarded (null → success)');
      setTimeout(ok, 50);
    },
  };

  // ── CrazyGames skeleton ──────────────────────────────────────────────────
  const CrazyGamesAdapter = {
    init() {
      // TODO: <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
      // await CrazyGames.SDK.init();
      console.log('[Ads] CrazyGames adapter (stub – wire real SDK here)');
    },
    gameplayStart() {
      // TODO: CrazyGames.SDK.game.gameplayStart();
    },
    gameplayStop() {
      // TODO: CrazyGames.SDK.game.gameplayStop();
    },
    showInterstitial(cb) {
      // TODO: CrazyGames.SDK.ad.requestAd('midgame', {
      //   adFinished: cb, adError: cb, adStarted: () => {}
      // });
      cb();
    },
    showRewarded(ok, skip) {
      // TODO: CrazyGames.SDK.ad.requestAd('rewarded', {
      //   adFinished: ok, adError: skip
      // });
      skip();
    },
  };

  // ── GameDistribution skeleton ────────────────────────────────────────────
  const GameDistributionAdapter = {
    init() {
      // TODO: <script src="https://html5.api.gamedistribution.com/main.min.js"></script>
      // gdsdk.showAd('preroll').catch(()=>{});
      console.log('[Ads] GameDistribution adapter (stub – wire real SDK here)');
    },
    gameplayStart() {
      // TODO: gdsdk.preloadAd('midgame').catch(()=>{});
    },
    gameplayStop() {},
    showInterstitial(cb) {
      // TODO: gdsdk.showAd('midgame').then(cb).catch(cb);
      cb();
    },
    showRewarded(ok, skip) {
      // TODO: gdsdk.showAd('rewarded').then(ok).catch(skip);
      skip();
    },
  };

  function _adapter() {
    if (config.adapter === 'crazygames') return CrazyGamesAdapter;
    if (config.adapter === 'gamedistribution') return GameDistributionAdapter;
    return NullAdapter;
  }

  function init()          { _adapter().init(); }
  function gameplayStart() { _adapter().gameplayStart(); }
  function gameplayStop()  { _adapter().gameplayStop(); }

  function showInterstitial(onDone) {
    const now = Date.now();
    const elapsed = now - _lastInterstitialAt;

    if (elapsed < config.minIntervalMs) {
      const wait = Math.ceil((config.minIntervalMs - elapsed) / 1000);
      console.log(`[Ads] Interstitial skipped – cooldown ${wait}s remaining`);
      onDone(); return;
    }
    if (_runsSinceLast < config.maxEveryNRuns - 1) {
      console.log(`[Ads] Interstitial skipped – run ${_runsSinceLast + 1}/${config.maxEveryNRuns}`);
      _runsSinceLast++;
      onDone(); return;
    }

    console.log('[Ads] Showing interstitial');
    _lastInterstitialAt = now;
    _runsSinceLast = 0;
    gameplayStop();
    _adapter().showInterstitial(() => { gameplayStart(); onDone(); });
  }

  function showRewarded(onSuccess, onSkip) {
    console.log('[Ads] Requesting rewarded');
    gameplayStop();
    _adapter().showRewarded(
      () => { gameplayStart(); onSuccess(); },
      () => { gameplayStart(); onSkip(); }
    );
  }

  function onRunEnd() { _runsSinceLast++; }

  return { init, gameplayStart, gameplayStop, showInterstitial, showRewarded, onRunEnd };
})();
