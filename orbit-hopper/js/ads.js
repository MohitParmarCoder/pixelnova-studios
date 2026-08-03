'use strict';

// AdManager — multi-adapter ad controller
// Adapters: null (dev) | crazygames | gamedistribution | capacitor (AdMob via Capacitor bridge)
// Set window.ORBIT_PORTAL before loading scripts to auto-select adapter (portal builds).
const AdManager = (() => {
  const config = {
    adapter:        'null',
    minIntervalMs:  60000,  // 60 s minimum between interstitials
    maxEveryNRuns:  3,      // show at most every 3rd run
  };

  let _lastInterstitialAt = 0;
  let _runsSinceLast = 0;

  // ── NullAdapter ───────────────────────────────────────────────────────────
  const NullAdapter = {
    init()               { console.log('[Ads] NullAdapter ready'); },
    gameplayStart()      { console.log('[Ads] gameplayStart'); },
    gameplayStop()       { console.log('[Ads] gameplayStop'); },
    happyTime(f)         { console.log('[Ads] happyTime', f); },
    gameLoadingStart()   { console.log('[Ads] gameLoadingStart'); },
    gameLoadingStop()    { console.log('[Ads] gameLoadingStop'); },
    hasAdblock()         { return false; },
    showInterstitial(cb) { console.log('[Ads] interstitial (null)'); setTimeout(cb, 50); },
    showRewarded(ok, skip) {
      console.log('[Ads] rewarded (null → success)');
      setTimeout(ok, 50);
    },
  };

  // ── CrazyGames SDK v3 ─────────────────────────────────────────────────────
  // SDK injected by CrazyGames portal — no <script> needed in our HTML.
  const CrazyGamesAdapter = {
    _ready: false,
    init() {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      sdk.init().then(() => { this._ready = true; }).catch(() => {});
    },
    gameplayStart()    { if (this._ready) window.CrazyGames?.SDK?.game?.gameplayStart(); },
    gameplayStop()     { if (this._ready) window.CrazyGames?.SDK?.game?.gameplayStop(); },
    happyTime(f)       { if (this._ready) window.CrazyGames?.SDK?.game?.happyTime?.(f ?? 0.8); },
    gameLoadingStart() { window.CrazyGames?.SDK?.game?.sdkGameLoadingStart?.(); },
    gameLoadingStop()  { window.CrazyGames?.SDK?.game?.sdkGameLoadingStop?.(); },
    hasAdblock()       { return window.CrazyGames?.SDK?.ad?.hasAdblock ?? false; },
    showInterstitial(cb) {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk || !this._ready) { cb(); return; }
      sdk.ad.requestAd('midgame', {
        adStarted:  () => {},
        adFinished: cb,
        adError:    cb,
      });
    },
    showRewarded(ok, skip) {
      const sdk = window.CrazyGames?.SDK;
      if (!sdk || !this._ready) { skip(); return; }
      sdk.ad.requestAd('rewarded', {
        adStarted:  () => {},
        adFinished: ok,
        adError:    skip,
      });
    },
  };

  // ── GameDistribution SDK v4 ───────────────────────────────────────────────
  // Requires GD_OPTIONS global to be set before the SDK script loads.
  // The SDK fires events via onEvent callback.
  let _gdPauseGame  = null;
  let _gdResumeGame = null;
  const GameDistributionAdapter = {
    _interstitialResolve: null,
    _rewardedResolve:     null,
    happyTime() {}, gameLoadingStart() {}, gameLoadingStop() {},
    hasAdblock() { return false; },
    init() {
      window['GD_OPTIONS'] = {
        gameId: window.GD_GAME_ID || 'REPLACE_WITH_YOUR_GD_GAME_ID',
        onEvent(event) {
          switch (event.name) {
            case 'SDK_GAME_PAUSE':
              if (_gdPauseGame) _gdPauseGame();
              break;
            case 'SDK_GAME_START':
              if (_gdResumeGame) _gdResumeGame();
              break;
            case 'SDK_REWARDED_AD_CLOSE':
            case 'SDK_REWARDED_AD_REWARD':
              if (GameDistributionAdapter._rewardedResolve) {
                GameDistributionAdapter._rewardedResolve('ok');
                GameDistributionAdapter._rewardedResolve = null;
              }
              break;
          }
        },
      };
    },
    gameplayStart()  { try { gdsdk?.showAd?.('none'); } catch(e) {} },
    gameplayStop()   {},
    showInterstitial(cb) {
      if (typeof gdsdk === 'undefined') { cb(); return; }
      this._interstitialResolve = cb;
      gdsdk.showAd(gdsdk.AdType?.Interstitial || 'interstitial')
        .then(cb).catch(cb);
    },
    showRewarded(ok, skip) {
      if (typeof gdsdk === 'undefined') { skip(); return; }
      this._rewardedResolve = ok;
      gdsdk.showAd(gdsdk.AdType?.RewardedVideo || 'rewarded')
        .then(ok).catch(skip);
    },
  };

  // ── Capacitor / AdMob ─────────────────────────────────────────────────────
  // Used in the native Android app built with Capacitor.
  // Requires @capacitor-community/admob native plugin.
  // Ad unit IDs are set via window.ADMOB_IDS before scripts load.
  const CapacitorAdMobAdapter = {
    _interstitialId: '',
    _rewardedId:     '',
    happyTime() {}, gameLoadingStart() {}, gameLoadingStop() {},
    hasAdblock() { return false; },
    init() {
      const ids = window.ADMOB_IDS || {};
      this._interstitialId = ids.interstitial || 'ca-app-pub-3940256099942544/1033173712'; // test id
      this._rewardedId     = ids.rewarded     || 'ca-app-pub-3940256099942544/5224354917'; // test id
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) return;
      AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: (ids.interstitial || '').includes('test'),
      }).catch(() => {});
    },
    gameplayStart() {},
    gameplayStop()  {},
    showInterstitial(cb) {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) { cb(); return; }
      AdMob.prepareInterstitial({ adId: this._interstitialId })
        .then(() => AdMob.showInterstitial())
        .then(cb)
        .catch(cb);
    },
    showRewarded(ok, skip) {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) { skip(); return; }
      AdMob.prepareRewardVideoAd({ adId: this._rewardedId })
        .then(() => AdMob.showRewardVideoAd())
        .then(ok)
        .catch(skip);
    },
  };

  function _adapter() {
    const a = config.adapter !== 'null'
      ? config.adapter
      : (typeof window !== 'undefined' ? (window.ORBIT_PORTAL || 'null') : 'null');
    if (a === 'crazygames')      return CrazyGamesAdapter;
    if (a === 'gamedistribution') return GameDistributionAdapter;
    if (a === 'capacitor')       return CapacitorAdMobAdapter;
    return NullAdapter;
  }

  function init()             { _adapter().init(); }
  function gameplayStart()    { _adapter().gameplayStart(); }
  function gameplayStop()     { _adapter().gameplayStop(); }
  function happyTime(f)       { try { _adapter().happyTime(f); } catch(e) {} }
  function gameLoadingStart() { try { _adapter().gameLoadingStart(); } catch(e) {} }
  function gameLoadingStop()  { try { _adapter().gameLoadingStop(); } catch(e) {} }
  function hasAdblock()       { try { return _adapter().hasAdblock(); } catch(e) { return false; } }

  function showInterstitial(onDone) {
    const now     = Date.now();
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

  return { init, gameplayStart, gameplayStop, happyTime, gameLoadingStart, gameLoadingStop, hasAdblock, showInterstitial, showRewarded, onRunEnd };
})();
