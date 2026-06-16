/* Shared audio module — ZzFX micro-synth (MIT, @KilledByAPixel) */
'use strict';
const Audio = (() => {
  let _ctx = null, _muted = false;
  const _key = () => document.body.dataset.muteKey || 'shared_muted';

  function _ctx_() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  // ZzFX — minimal version
  function zzfx(...z) {
    if (_muted) return;
    const ctx = _ctx_();
    if (!ctx) return;
    let [,, frequency=220, attack=0, sustain=0, release=0.1, shape=0, shapeCurve=1,
      slide=0, deltaSlide=0, pitchJump=0, pitchJumpTime=0, repeatTime=0,,
      noise=0, modulation=0, bitCrush=0,, volume=1, length] = z;

    const sampleRate = ctx.sampleRate, startSlide = slide /= 500;
    let b=[], startFrequency = frequency /= 500,
        t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length2;
    attack = attack * sampleRate + 9;
    sustain = sustain * sampleRate;
    release = release * sampleRate;
    if (!length) length = attack + sustain + release;
    length2 = length = length * sampleRate | 0;
    for (; i < length2; b[i++] = s * volume) {
      if (!(++c % (bitCrush * 100 | 0))) { s = shape ? shape > 1 ? shape > 2 ? shape > 3 ?
        Math.sign(Math.sin((t % 1) ** 3)) :
        Math.max(Math.min(Math.tan(t * Math.PI), 1), -1) :
        1 - (2 * t % 2 + 2) % 2 :
        1 - t * 2 % 2 :
        Math.sin(t * 2 * Math.PI);
        s = (repeatTime ? 1 - modulation + modulation * Math.sin(2 * Math.PI * i / repeatTime / sampleRate) : 1) *
          Math.sign(s) * Math.abs(s) ** shapeCurve *
          (i < attack ? i / attack : i < attack + sustain ? 1 :
          (length2 - i) / release);
        s = s * noise ? s * (1 - noise) + (Math.random() * 2 - 1) * noise : s;
      }
      f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
      t += f - f * 0;
      if (j && ++j > pitchJumpTime * sampleRate) { frequency += pitchJump; startFrequency += pitchJump; j = 0; }
      if (repeatTime && !(i % (repeatTime * sampleRate | 0))) { frequency = startFrequency; slide = startSlide; }
    }
    const buf = ctx.createBuffer(1, length, sampleRate);
    buf.getChannelData(0).set(b);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    return src;
  }

  function play(preset) {
    try { zzfx(...(presets[preset] || [])); } catch(e) {}
  }

  const presets = {
    tap:    [1,,.2,,.04,.05,,,,,,.005,,,,.1],
    score:  [1,,.3,,.08,.12,,,5,,,.01,,,,,.15],
    lose:   [1,,.15,,.1,.3,3,,.5,,,,,.4,,,,.5],
    land:   [1,,.25,,.06,.08,,,2,,,.01,,,,,.1],
    gem:    [1,,.4,,.04,.06,,,8,,.2,.01,,,,,.12],
    button: [1,,.1,,.02,.04,,,,,,,,,,.05],
    hop:    [1,,.18,,.03,.06,,,3,,,.005,,,,,.08],
    flip:   [1,,.2,,.05,.1,1,,.4,,,,,,,.1],
    crash:  [1,,.1,,.08,.25,3,,.2,,,,,.3,,,,.4],
    power:  [1,,.35,,.1,.15,,,6,,.1,.01,,,,,.18],
  };

  function setMuted(v) {
    _muted = v;
    try { localStorage.setItem(_key(), v ? '1' : '0'); } catch(e) {}
  }
  function isMuted() { return _muted; }
  function toggle() { setMuted(!_muted); return _muted; }

  function init() {
    try { _muted = localStorage.getItem(_key()) === '1'; } catch(e) {}
    document.addEventListener('pointerdown', () => _ctx_(), { once: true });
  }

  return { init, play, setMuted, isMuted, toggle };
})();
