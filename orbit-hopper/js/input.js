'use strict';

const Input = (() => {
  let _down = false;
  let _justPressed = false;
  let _lastX = 0, _lastY = 0;
  let _canvas = null;
  let _vw = 390, _vh = 844;

  function _coords(e) {
    const rect = _canvas.getBoundingClientRect();
    const src = (e.changedTouches || e.touches) ? (e.changedTouches[0] || e.touches[0]) : e;
    return {
      x: (src.clientX - rect.left) * (_vw / rect.width),
      y: (src.clientY - rect.top)  * (_vh / rect.height),
    };
  }

  function _down_handler(e) {
    e.preventDefault();
    const c = _coords(e);
    _lastX = c.x; _lastY = c.y;
    if (!_down) _justPressed = true;
    _down = true;
  }

  function _up_handler(e) {
    e.preventDefault();
    _down = false;
  }

  function init(canvas, vw, vh) {
    _canvas = canvas;
    _vw = vw || 390; _vh = vh || 844;

    canvas.addEventListener('pointerdown',  _down_handler, { passive: false });
    canvas.addEventListener('pointerup',    _up_handler,   { passive: false });
    canvas.addEventListener('pointercancel',_up_handler,   { passive: false });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!_down) _justPressed = true;
        _down = true;
        _lastX = _vw / 2; _lastY = _vh / 2;
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') _down = false;
    });
  }

  function consumePress() {
    const v = _justPressed;
    _justPressed = false;
    return v;
  }

  function isDown()    { return _down; }
  function lastPos()   { return { x: _lastX, y: _lastY }; }

  return { init, consumePress, isDown, lastPos };
})();
