#!/usr/bin/env node
'use strict';
// Generates all 3 CrazyGames cover images using only Node built-ins
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG helpers ───────────────────────────────────────────────────────────────
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
  const t = Buffer.from(type, 'ascii'), l = Buffer.alloc(4), c = Buffer.alloc(4);
  l.writeUInt32BE(data.length); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, c]);
}
function makePNG(w, h, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (3 * w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (3 * w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 3, ri = y * (3 * w + 1) + 1 + x * 3;
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

// ── Scene renderer (works for any W×H) ────────────────────────────────────────
function renderScene(W, H, opts = {}) {
  const pixels = Buffer.alloc(W * H * 3);
  const {
    planetFrac  = 0.35,  // planet X position fraction
    planetYFrac = 0.50,  // planet Y position fraction
    orbitFrac   = 0.28,  // orbit radius as fraction of min(W,H)
    planetRFrac = 0.10,
    showTitle   = true,
  } = opts;

  const cx = W * planetFrac, cy = H * planetYFrac;
  const orbitR  = Math.min(W, H) * orbitFrac;
  const planetR = Math.min(W, H) * planetRFrac;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const d  = Math.sqrt(dx*dx + dy*dy);

      // Background gradient: deep navy → dark purple right side
      let r = 8  + Math.round((x/W)*22) + Math.round((y/H)*8);
      let g = 7  + Math.round((x/W)*5);
      let b = 22 + Math.round((x/W)*35) + Math.round((y/H)*10);

      // Stars
      const seed = ((x * 7919 + y * 6271) * 2654435761) >>> 0;
      if ((seed & 0xFF) < 4) {
        const br = 120 + (seed >> 8 & 0x7F);
        r = Math.max(r, br); g = Math.max(g, br); b = Math.max(b, br);
      }

      // Ambient glow
      const glowR = Math.min(W,H) * 0.55;
      if (d < glowR) {
        const t = (1 - d/glowR) ** 2.2;
        r = lerp(r, 90,  t*0.55); g = lerp(g, 12, t*0.3); b = lerp(b, 120, t*0.6);
      }

      // Second orbit (larger, faint)
      const r2 = orbitR * 1.65, w2 = Math.max(1, orbitR*0.01);
      if (Math.abs(d - r2) < w2) {
        const a = (1 - Math.abs(d-r2)/w2) * 0.25;
        r = lerp(r,168,a); g = lerp(g,237,a); b = lerp(b,234,a);
      }

      // Main orbit ring cyan
      const ringW = Math.max(1.5, orbitR*0.035);
      if (Math.abs(d - orbitR) < ringW) {
        const a = (1 - Math.abs(d-orbitR)/ringW) ** 1.5 * 0.9;
        r = lerp(r,168,a); g = lerp(g,237,a); b = lerp(b,234,a);
      }

      // Planet
      if (d < planetR) {
        const t = 1 - d/planetR;
        r = lerp(r,175,t*0.95); g = lerp(g,80,t*0.95); b = lerp(b,210,t*0.95);
        const hd = Math.sqrt((dx+planetR*0.3)**2+(dy+planetR*0.35)**2);
        if (hd < planetR*0.45) { const ht=1-hd/(planetR*0.45); r=lerp(r,230,ht*0.55); g=lerp(g,200,ht*0.45); b=lerp(b,255,ht*0.55); }
      }

      // Ship 1 — white dot on orbit
      const a1 = -Math.PI*0.55;
      const s1d = Math.sqrt((x-(cx+Math.cos(a1)*orbitR))**2+(y-(cy+Math.sin(a1)*orbitR))**2);
      const sr1 = Math.max(3, orbitR*0.065);
      if (s1d < sr1) { const a=(1-s1d/sr1)**0.5; r=lerp(r,255,a); g=lerp(g,255,a); b=lerp(b,230,a); }

      // Ship 2 — smaller trailing ship
      const a2 = -Math.PI*0.18;
      const s2d = Math.sqrt((x-(cx+Math.cos(a2)*orbitR))**2+(y-(cy+Math.sin(a2)*orbitR))**2);
      const sr2 = Math.max(2, orbitR*0.042);
      if (s2d < sr2) { const a=(1-s2d/sr2)**0.6*0.6; r=lerp(r,180,a); g=lerp(g,220,a); b=lerp(b,255,a); }

      // Particle trail
      for (let p = 0; p < 6; p++) {
        const pa = a1 + p * 0.15;
        const pr = orbitR - p * orbitR * 0.008;
        const pd = Math.sqrt((x-(cx+Math.cos(pa)*pr))**2+(y-(cy+Math.sin(pa)*pr))**2);
        if (pd < sr1 * (0.35 - p*0.04)) {
          const alpha = (0.5 - p*0.07);
          r=lerp(r,168,alpha); g=lerp(g,237,alpha); b=lerp(b,234,alpha);
        }
      }

      // Title area highlight band (right side of landscape/square)
      if (showTitle && x > W*0.58 && x < W*0.97) {
        const blend = Math.min((x-W*0.58)/(W*0.08), 1) * 0.12;
        r=lerp(r,80,blend); g=lerp(g,20,blend); b=lerp(b,100,blend);
      }

      const i = (y*W+x)*3;
      pixels[i]=clamp(r); pixels[i+1]=clamp(g); pixels[i+2]=clamp(b);
    }
  }
  return pixels;
}

const outDir = path.join(__dirname, '..', 'orbit-hopper', 'submit');
fs.mkdirSync(outDir, { recursive: true });

const covers = [
  { name: 'cover-landscape-1920x1080.png', W: 1920, H: 1080, opts: { planetFrac:0.30, orbitFrac:0.30, planetRFrac:0.10 } },
  { name: 'cover-portrait-800x1200.png',   W:  800, H: 1200, opts: { planetFrac:0.50, planetYFrac:0.40, orbitFrac:0.28, planetRFrac:0.10, showTitle:false } },
  { name: 'cover-square-800x800.png',      W:  800, H:  800, opts: { planetFrac:0.45, orbitFrac:0.30, planetRFrac:0.11 } },
];

for (const { name, W, H, opts } of covers) {
  process.stdout.write(`Generating ${name} (${W}×${H})...`);
  const pixels = renderScene(W, H, opts);
  const png = makePNG(W, H, pixels);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(` ${(png.length/1024).toFixed(0)} KB`);
}
console.log('Done.');
