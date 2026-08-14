#!/usr/bin/env node
'use strict';
// Generates PNG icons for the PWA manifest using only Node built-ins (no npm deps).
// Output: orbit-hopper/icons/icon-192.png, orbit-hopper/icons/icon-512.png
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ── PNG encoder (RGB, no alpha) ───────────────────────────────────────────────
function makePNG(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB

  const raw = Buffer.alloc(size * (3 * size + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (3 * size + 1)] = 0; // None filter
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 3;
      const ri = y * (3 * size + 1) + 1 + x * 3;
      raw[ri]     = pixels[pi];
      raw[ri + 1] = pixels[pi + 1];
      raw[ri + 2] = pixels[pi + 2];
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon drawing ──────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v)       { return Math.min(255, Math.max(0, Math.round(v))); }

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const cx = size / 2, cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const maxD = size * 0.5;

      // Rounded-square mask (r = 22% of size)
      const cornerR = size * 0.22;
      const qx = Math.abs(dx) - (maxD - cornerR);
      const qy = Math.abs(dy) - (maxD - cornerR);
      const outside = Math.sqrt(Math.max(0, qx) ** 2 + Math.max(0, qy) ** 2) - cornerR;
      if (outside > 0) {
        const i = (y * size + x) * 3;
        pixels[i] = pixels[i+1] = pixels[i+2] = 0;
        continue;
      }

      // Base: deep navy #0a0a1a
      let r = 10, g = 10, b = 26;

      // Purple radial glow from centre
      const glowR = size * 0.38;
      if (d < glowR) {
        const t = (1 - d / glowR) ** 2;
        r = lerp(r, 80,  t * 0.7);
        g = lerp(g, 15,  t * 0.5);
        b = lerp(b, 100, t * 0.7);
      }

      // 8-point nova star (outer glow halo)
      const angle  = Math.atan2(dy, dx);
      const points = 8;
      const starOuter = size * 0.30;
      const starInner = size * 0.14;
      const half = Math.PI / points;
      const secA  = ((angle % (2 * half)) + 2 * half) % (2 * half);
      const starR = secA < half
        ? lerp(starInner, starOuter, secA / half)
        : lerp(starOuter, starInner, (secA - half) / half);
      const starDist = d / starR;
      if (starDist < 1.15 && starDist > 0.6) {
        const glow = Math.max(0, 1 - Math.abs(starDist - 0.88) * 7);
        r = lerp(r, 255, glow * 0.45);
        g = lerp(g, 215, glow * 0.35);
        b = lerp(b, 255, glow * 0.55);
      }
      // Solid star fill
      if (starDist < 0.88) {
        const fill = (1 - starDist / 0.88) ** 0.5;
        r = lerp(r, 200, fill * 0.6);
        g = lerp(g, 160, fill * 0.4);
        b = lerp(b, 255, fill * 0.7);
      }

      // Cyan orbit ring at 42% radius
      const orbitR = size * 0.42;
      const orbitW = Math.max(1.5, size * 0.018);
      const ringD  = Math.abs(d - orbitR);
      if (ringD < orbitW) {
        const alpha = (1 - ringD / orbitW) ** 2;
        r = lerp(r, 168, alpha * 0.95);
        g = lerp(g, 237, alpha * 0.95);
        b = lerp(b, 234, alpha * 0.95);
      }

      // Planet: purple sphere at centre
      const planetR = size * 0.13;
      if (d < planetR) {
        const t = 1 - d / planetR;
        r = lerp(r, 175, t * 0.9);
        g = lerp(g, 80,  t * 0.9);
        b = lerp(b, 210, t * 0.9);
        // Highlight
        const hx = -size * 0.04, hy = -size * 0.04;
        const hd = Math.sqrt((dx-hx)**2 + (dy-hy)**2);
        if (hd < planetR * 0.45) {
          const ht = 1 - hd / (planetR * 0.45);
          r = lerp(r, 230, ht * 0.6);
          g = lerp(g, 200, ht * 0.5);
          b = lerp(b, 255, ht * 0.6);
        }
      }

      // Ship: small white dot on orbit at 45°
      const sa  = -Math.PI / 4;
      const sx  = cx + Math.cos(sa) * orbitR;
      const sy_ = cy + Math.sin(sa) * orbitR;
      const shipR = Math.max(2, size * 0.045);
      const sd  = Math.sqrt((x - sx) ** 2 + (y - sy_) ** 2);
      if (sd < shipR) {
        const alpha = (1 - sd / shipR) ** 0.6;
        r = lerp(r, 255, alpha);
        g = lerp(g, 255, alpha);
        b = lerp(b, 240, alpha);
      }

      // Centre dot
      const cdotR = size * 0.025;
      if (d < cdotR) {
        const alpha = (1 - d / cdotR) ** 0.5;
        r = lerp(r, 255, alpha * 0.9);
        g = lerp(g, 255, alpha * 0.9);
        b = lerp(b, 255, alpha * 0.9);
      }

      const i = (y * size + x) * 3;
      pixels[i]     = clamp(r);
      pixels[i + 1] = clamp(g);
      pixels[i + 2] = clamp(b);
    }
  }

  return pixels;
}

// ── Generate & save ───────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'orbit-hopper', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png    = makePNG(size, pixels);
  const file   = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`Generated ${file} (${png.length} bytes)`);
}
