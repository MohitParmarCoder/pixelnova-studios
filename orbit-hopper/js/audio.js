'use strict';

// ZzFX – Zuper Zmall Zynth v2.0 – MIT – https://github.com/KilledByAPixel/ZzFX
const Audio = (() => {
  let _ctx = null;
  let _muted = false;
  const SR = 44100;

  function _getCtx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { _ctx = null; }
    }
    return _ctx;
  }

  function resume() {
    const c = _getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function _zzfxG(
    volume=1, randomness=.05, frequency=220,
    attack=0, sustain=0, release=.1, shape=0, shapeCurve=1,
    slide=0, deltaSlide=0, pitchJump=0, pitchJumpTime=0,
    repeatTime=0, noise=0, modulation=0, bitCrush=0,
    delay=0, sustainVolume=1, decay=0, tremolo=0
  ) {
    const PI2 = Math.PI * 2;
    const sign = v => v > 0 ? 1 : -1;
    let startSlide = slide *= 500 * PI2 / SR / SR;
    let startFreq = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / SR;
    let b=[], t=0, tm=0, i=0, j=1, r=0, c=0, s=0, f;

    attack = attack * SR + 9; decay *= SR; sustain *= SR;
    release *= SR; delay *= SR;
    deltaSlide *= 500 * PI2 / Math.pow(SR, 3);
    modulation *= PI2 / SR; pitchJump *= PI2 / SR;
    pitchJumpTime *= SR;
    repeatTime = repeatTime * SR | 0;
    const length = attack + decay + sustain + release + delay | 0;

    for (; i < length; b[i++] = s * volume) {
      if (!(++c % (bitCrush * 100 | 0))) {
        s = shape ? shape > 1 ? shape > 2 ? shape > 3 ?
          Math.sign(Math.sin(Math.pow(t % PI2, 3))) :
          Math.max(Math.min(Math.tan(t), 1), -1) :
          1 - (2 * t / PI2 % 2 + 2) % 2 :
          1 - t / PI2 % 2 * 2 :
          Math.sin(t);
        s = (repeatTime ? 1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) : 1) *
          sign(s) * Math.pow(Math.abs(s), shapeCurve) * volume *
          (i < attack ? i / attack :
           i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume) :
           i < attack + decay + sustain ? sustainVolume :
           i < length - delay ? (length - i - delay) / release * sustainVolume : 0);
        s = delay ? s / 2 + (delay > i ? 0 :
          (i < length - delay ? 1 : (length - i) / delay) * b[i - delay | 0] / 2) : s;
      }
      f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
      t += f - f * noise * (1 - (Math.sin(i) + 1) * 1e9 % 2);
      if (j && ++j > pitchJumpTime) { frequency += pitchJump; startFreq += pitchJump; j = 0; }
      if (repeatTime && !(++r % repeatTime)) { frequency = startFreq; slide = startSlide; j = j || 1; }
    }
    return b;
  }

  function _play(buffer) {
    if (!buffer || !buffer.length) return;
    const c = _getCtx();
    if (!c) return;
    const buf = c.createBuffer(1, buffer.length, SR);
    buf.getChannelData(0).set(buffer);
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = 0.6;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  // Precomputed buffers
  const _defs = {
    hop:       [.6, .02, 523, .01, 0, .12, 0, 1.2, .4, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    gem:       [.4, .01, 1047, .01, 0, .1, 0, 1.8, .5, 0, 220, .08, 0, 0, 0, 0, 0, 1],
    death:     [1.0, .05, 180, .02, .08, .5, 1, 1, -2.5, 0, 0, 0, 0, .25, 0, 0, 0, 1],
    highscore: [.5, 0, 784, .01, .1, .35, 0, 1.1, 1.2, 0, 220, .18, .1, 0, 0, 0, 0, 1],
    nearmiss:  [.35, .02, 392, .01, .04, .1, 0, 1, .3, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    land:      [.5, .02, 330, .01, 0, .15, 0, 1.3, .2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  };

  let _bufs = {};

  function _preload() {
    for (const [k, args] of Object.entries(_defs)) {
      try { _bufs[k] = _zzfxG(...args); } catch(e) {}
    }
  }

  function play(name) {
    if (_muted) return;
    resume();
    if (_bufs[name]) _play(_bufs[name]);
  }

  function setMuted(v) {
    _muted = !!v;
    try { localStorage.setItem('orbit_muted', _muted ? '1' : '0'); } catch(e) {}
  }

  function getMuted() { return _muted; }

  function init() {
    try { _muted = localStorage.getItem('orbit_muted') === '1'; } catch(e) {}
    _preload();
  }

  return { init, play, setMuted, getMuted, resume };
})();
