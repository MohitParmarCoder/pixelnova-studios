'use strict';

// Icon-only UI primitives – no text/words
const UI = (() => {

  function playIcon(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.28, y - size * 0.48);
    ctx.lineTo(x + size * 0.52, y);
    ctx.lineTo(x - size * 0.28, y + size * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function retryIcon(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.16;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(x, y, size * 0.42, -Math.PI * 0.55, Math.PI * 1.15);
    ctx.stroke();

    // Arrowhead at arc end
    const ea = Math.PI * 1.15;
    const ex = x + Math.cos(ea) * size * 0.42;
    const ey = y + Math.sin(ea) * size * 0.42;
    const perpX = -Math.sin(ea), perpY = Math.cos(ea);
    ctx.beginPath();
    ctx.moveTo(ex - perpX * size * 0.22, ey - perpY * size * 0.22);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + perpX * size * 0.1 - perpY * size * 0.24,
               ey + perpY * size * 0.1 + perpX * size * 0.24);
    ctx.stroke();
    ctx.restore();
  }

  function muteIcon(ctx, x, y, size, muted, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;

    // Speaker body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.42, y - size * 0.22);
    ctx.lineTo(x - size * 0.12, y - size * 0.22);
    ctx.lineTo(x + size * 0.18, y - size * 0.45);
    ctx.lineTo(x + size * 0.18, y + size * 0.45);
    ctx.lineTo(x - size * 0.12, y + size * 0.22);
    ctx.lineTo(x - size * 0.42, y + size * 0.22);
    ctx.closePath();
    ctx.fill();

    if (!muted) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x + size * 0.18, y, size * 0.3, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + size * 0.18, y, size * 0.52, -0.9, 0.9);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = size * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.22, y - size * 0.38);
      ctx.lineTo(x + size * 0.56, y + size * 0.38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.56, y - size * 0.38);
      ctx.lineTo(x + size * 0.22, y + size * 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  function starIcon(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.fillStyle = '#FFD700';
    ctx.shadowBlur = size * 1.5;
    ctx.shadowColor = '#FFD700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const oa = (i * 4 * Math.PI / 5) - Math.PI / 2;
      const ia = oa + Math.PI / 5;
      if (i === 0) ctx.moveTo(x + Math.cos(oa) * size, y + Math.sin(oa) * size);
      else         ctx.lineTo(x + Math.cos(oa) * size, y + Math.sin(oa) * size);
      ctx.lineTo(x + Math.cos(ia) * size * 0.4, y + Math.sin(ia) * size * 0.4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function gemIcon(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.shadowBlur = size * 2;
    ctx.shadowColor = '#a8edea';
    const g = ctx.createLinearGradient(x, y - size, x, y + size);
    g.addColorStop(0, '#dff8f8');
    g.addColorStop(1, '#7c83fd');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.72, y - size * 0.18);
    ctx.lineTo(x + size * 0.72, y + size * 0.18);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.72, y + size * 0.18);
    ctx.lineTo(x - size * 0.72, y - size * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Continue icon: heart-like circle with arrow up
  function continueIcon(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.strokeStyle = '#7bed9f';
    ctx.fillStyle = '#7bed9f';
    ctx.lineWidth = size * 0.14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Up arrow
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.55);
    ctx.lineTo(x + size * 0.4, y + size * 0.1);
    ctx.lineTo(x + size * 0.15, y + size * 0.1);
    ctx.lineTo(x + size * 0.15, y + size * 0.55);
    ctx.lineTo(x - size * 0.15, y + size * 0.55);
    ctx.lineTo(x - size * 0.15, y + size * 0.1);
    ctx.lineTo(x - size * 0.4, y + size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Double-gem icon: two stacked gems with ×2 visual (two overlapping gems)
  function doubleGemIcon(ctx, x, y, size, alpha) {
    gemIcon(ctx, x - size * 0.5, y + size * 0.3, size * 0.8, (alpha || 1) * 0.65);
    gemIcon(ctx, x + size * 0.3, y - size * 0.1, size, alpha);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return { playIcon, retryIcon, muteIcon, starIcon, gemIcon, continueIcon, doubleGemIcon, roundRect };
})();
