#!/usr/bin/env node
'use strict';
// Generates a 1024×500 Play Store feature graphic + 1080×1920 screenshot template
// Pure Node.js — no npm deps.
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

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
function makePNG(w, h, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (3 * w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (3 * w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 3;
      const ri = y * (3 * w + 1) + 1 + x * 3;
      raw[ri] = pixels[pi]; raw[ri+1] = pixels[pi+1]; raw[ri+2] = pixels[pi+2];
    }
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v){ return Math.min(255,Math.max(0,Math.round(v))); }

// ── Feature graphic 1024×500 ──────────────────────────────────────────────────
function drawFeature(W, H) {
  const pixels = Buffer.alloc(W * H * 3);
  const cx = W * 0.35, cy = H * 0.5;  // orbit centred at 35% width
  const orbitR = H * 0.36;
  const planetR = H * 0.13;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx*dx + dy*dy);

      // Background: deep navy with subtle rightward purple gradient
      let r = 10 + Math.round((x / W) * 18);
      let g = 8;
      let b = 26 + Math.round((x / W) * 30);

      // Ambient glow near planet
      const glowR = H * 0.55;
      if (d < glowR) {
        const t = (1 - d/glowR)**2.2;
        r = lerp(r, 90, t*0.55);
        g = lerp(g, 12, t*0.35);
        b = lerp(b, 120, t*0.6);
      }

      // Stars (deterministic noise)
      const seed = ((x * 7 + y * 13) * 2654435761) >>> 0;
      if ((seed & 0xFF) < 3 && x > W*0.55) { // stars on right half only
        const bright = 140 + (seed >> 8 & 0x7F);
        r = Math.max(r, bright); g = Math.max(g, bright); b = Math.max(b, bright);
      }

      // Orbit ring
      const ringD = Math.abs(d - orbitR);
      const ringW = Math.max(1.5, H*0.016);
      if (ringD < ringW) {
        const alpha = (1 - ringD/ringW)**1.5 * 0.85;
        r = lerp(r, 168, alpha); g = lerp(g, 237, alpha); b = lerp(b, 234, alpha);
      }

      // Planet sphere
      if (d < planetR) {
        const t = 1 - d/planetR;
        r = lerp(r, 175, t*0.95); g = lerp(g, 80, t*0.95); b = lerp(b, 210, t*0.95);
        const hd = Math.sqrt((dx+planetR*0.3)**2+(dy+planetR*0.35)**2);
        if (hd < planetR*0.45) {
          const ht = 1-hd/(planetR*0.45);
          r=lerp(r,230,ht*0.55); g=lerp(g,200,ht*0.45); b=lerp(b,255,ht*0.55);
        }
      }

      // Ship (small white triangle on orbit at top)
      const sA = -Math.PI*0.55;
      const sx = cx + Math.cos(sA)*orbitR, sy_ = cy + Math.sin(sA)*orbitR;
      const sd = Math.sqrt((x-sx)**2+(y-sy_)**2);
      const shipR = Math.max(3, H*0.042);
      if (sd < shipR) {
        const a = (1-sd/shipR)**0.5;
        r=lerp(r,255,a); g=lerp(g,255,a); b=lerp(b,230,a);
      }

      // Second ship on orbit (showing motion)
      const sA2 = -Math.PI*0.2;
      const sx2 = cx+Math.cos(sA2)*orbitR, sy2 = cy+Math.sin(sA2)*orbitR;
      const sd2 = Math.sqrt((x-sx2)**2+(y-sy2)**2);
      const ship2R = Math.max(2, H*0.028);
      if (sd2 < ship2R) {
        const a = (1-sd2/ship2R)**0.5 * 0.65;
        r=lerp(r,200,a); g=lerp(g,220,a); b=lerp(b,255,a);
      }

      // Right panel: text placeholder — draw subtle card
      if (x > W*0.60 && x < W*0.98 && y > H*0.18 && y < H*0.82) {
        const inset = Math.min(x-W*0.60, W*0.98-x, y-H*0.18, H*0.82-y);
        if (inset < 2) {
          // border
          r=lerp(r,168,0.25); g=lerp(g,237,0.2); b=lerp(b,234,0.25);
        } else {
          // card bg
          r=lerp(r,20,0.45); g=lerp(g,15,0.45); b=lerp(b,45,0.45);
        }
      }

      // "PixelNova" title area — bright band near top
      if (x > W*0.62 && x < W*0.97 && y > H*0.22 && y < H*0.36) {
        const ty = (y-H*0.22)/(H*0.14);
        const tx = (x-W*0.62)/(W*0.35);
        if (ty > 0.1 && ty < 0.9 && tx > 0.02 && tx < 0.98) {
          r=lerp(r,168,0.18); g=lerp(g,237,0.18); b=lerp(b,234,0.18);
        }
      }

      // Tagline area — softer band below title
      if (x > W*0.62 && x < W*0.97 && y > H*0.54 && y < H*0.62) {
        r=lerp(r,130,0.12); g=lerp(g,100,0.1); b=lerp(b,200,0.15);
      }

      const i = (y*W+x)*3;
      pixels[i]=clamp(r); pixels[i+1]=clamp(g); pixels[i+2]=clamp(b);
    }
  }
  return pixels;
}

const outDir = path.join(__dirname, '..', 'orbit-hopper', 'submit');
fs.mkdirSync(outDir, { recursive: true });

const fw = 1024, fh = 500;
const featurePx = drawFeature(fw, fh);
const featurePng = makePNG(fw, fh, featurePx);
fs.writeFileSync(path.join(outDir, 'feature-graphic-1024x500.png'), featurePng);
console.log(`Generated feature-graphic-1024x500.png (${featurePng.length} bytes)`);
