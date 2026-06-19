'use strict';
/**
 * fix-ads.js — Adds missing showInterstitial + offerDoubleScore hooks to all game.js files,
 * and fixes the call-order bug in stack-tower.
 *
 * Usage: node games/fix-ads.js [--dry-run]
 */
const fs   = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const GAMES_DIR = __dirname;

const games = fs.readdirSync(GAMES_DIR)
  .filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'js', 'game.js')))
  .sort();

// Derive best-score localStorage key from folder name: "arrow-dodge" → "arrowdodge_best"
function bestKey(folderName) {
  return folderName.replace(/-/g, '') + '_best';
}

// Choose score variable: if _score appears often, use that; else use 'score', 'chips', etc.
function scoreVar(src) {
  const counts = {};
  for (const v of ['_score', 'score', 'chips', 'pts', 'points']) {
    const rx = new RegExp('\\b' + v + '\\b', 'g');
    counts[v] = (src.match(rx) || []).length;
  }
  // Prefer _score if it appears at least 3 times
  if (counts['_score'] >= 3) return '_score';
  if (counts['chips']  >= 3) return 'chips';
  if (counts['score']  >= 3) return 'score';
  return 'score';
}

// Find the index right after a given pattern's line (includes the newline)
function afterLine(src, pattern) {
  const idx = src.lastIndexOf(pattern); // use last occurrence
  if (idx === -1) return -1;
  const nlIdx = src.indexOf('\n', idx);
  return nlIdx === -1 ? src.length : nlIdx + 1;
}

// Get the leading whitespace of the line that contains pattern
function indentOf(src, pattern) {
  const idx = src.lastIndexOf(pattern);
  if (idx === -1) return '    ';
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  const m = src.slice(lineStart).match(/^(\s*)/);
  return m ? m[1] : '    ';
}

let fixed = 0, skipped = 0, orderFixed = 0;

for (const name of games) {
  const file = path.join(GAMES_DIR, name, 'js', 'game.js');
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  const hasShowInter   = /AdManager\.showInterstitial\s*\(/.test(src);
  const hasOfferDouble = /AdferDoubleScore\s*\(/.test(src) ||
                         /offerDoubleScore\s*\(/.test(src);

  // ── Fix call order in stack-tower ────────────────────────────────────────
  if (name === 'stack-tower') {
    // onRunEnd is called before gameplayStop — find and swap
    // Look for the pattern: onRunEnd()...gameplayStop() in close proximity
    const wrongOrder = /AdManager\.onRunEnd\(\);[\s\S]{0,200}?AdManager\.gameplayStop\(\)/;
    if (wrongOrder.test(src)) {
      // Find the die/trigger function block and reorder
      src = src.replace(
        /(AdManager\.onRunEnd\(\);)([\s\S]*?)(AdManager\.gameplayStop\(\))/,
        '$3$2$1'
      );
      changed = true;
      orderFixed++;
      console.log(`[ORDER-FIX] stack-tower`);
    }
  }

  // ── Add missing showInterstitial ─────────────────────────────────────────
  if (!hasShowInter) {
    // Insert after last AdManager.onRunEnd() call
    const insertAt = afterLine(src, 'AdManager.onRunEnd()');
    if (insertAt === -1) {
      console.log(`[SKIP] ${name} — no onRunEnd found, skipping showInterstitial`);
      skipped++;
      continue;
    }
    const indent = indentOf(src, 'AdManager.onRunEnd()');
    const toInsert = `${indent}AdManager.showInterstitial(() => {});\n`;
    src = src.slice(0, insertAt) + toInsert + src.slice(insertAt);
    changed = true;
  }

  // ── Add missing offerDoubleScore ─────────────────────────────────────────
  const hasOfferNow = /offerDoubleScore\s*\(/.test(src);
  if (!hasOfferNow) {
    // Insert after last showInterstitial call
    const insertAt = afterLine(src, 'AdManager.showInterstitial(');
    if (insertAt === -1) {
      console.log(`[SKIP] ${name} — no showInterstitial after update, skipping offerDoubleScore`);
      skipped++;
      continue;
    }
    const indent = indentOf(src, 'AdManager.showInterstitial(');
    const sv  = scoreVar(src);
    const key = bestKey(name);
    const toInsert = `${indent}try { AdManager.offerDoubleScore(${sv}, '${key}'); } catch(e) {}\n`;
    src = src.slice(0, insertAt) + toInsert + src.slice(insertAt);
    changed = true;
  }

  if (changed) {
    if (!DRY) {
      fs.writeFileSync(file, src, 'utf8');
    }
    fixed++;
    console.log(`[FIXED] ${name}`);
  }
}

console.log(`\nDone. Fixed: ${fixed}, Skipped: ${skipped}, Order-fixed: ${orderFixed}`);
if (DRY) console.log('(dry-run — no files written)');
