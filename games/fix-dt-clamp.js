'use strict';
/**
 * fix-dt-clamp.js — Inject `if (dt > 0.05) dt = 0.05;` at the top of every
 * update(dt) function that doesn't already clamp dt.
 *
 * Usage: node games/fix-dt-clamp.js [--dry-run]
 */
const fs   = require('fs');
const path = require('path');

const GAMES_DIR = __dirname;
const DRY_RUN   = process.argv.includes('--dry-run');
const CLAMP_LINE = '  if (dt > 0.05) dt = 0.05;';

// Patterns that indicate dt is already clamped
const ALREADY_CLAMPED = [
  /if\s*\(\s*dt\s*>\s*[\d.]+\s*\)/,
  /dt\s*=\s*Math\.min\s*\(/,
  /Math\.min\s*\([^)]*dt/,
];

const games = fs.readdirSync(GAMES_DIR)
  .filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'js', 'game.js')))
  .sort();

let patched = 0, skipped = 0, errors = 0;

for (const name of games) {
  const filePath = path.join(GAMES_DIR, name, 'js', 'game.js');
  let src = fs.readFileSync(filePath, 'utf8');

  // Find the update function body open brace
  // Pattern: function update(dt) { OR function update( dt ) {
  const updateMatch = src.match(/function\s+update\s*\(\s*dt\s*\)\s*\{/);
  if (!updateMatch) {
    console.log(`[SKIP] ${name.padEnd(22)} — no update(dt) found`);
    skipped++;
    continue;
  }

  const matchEnd = updateMatch.index + updateMatch[0].length;
  // Get the first ~200 chars after the open brace to check for existing clamp
  const bodyStart = src.slice(matchEnd, matchEnd + 200);

  if (ALREADY_CLAMPED.some(re => re.test(bodyStart))) {
    console.log(`[OK ] ${name.padEnd(22)} — already clamped`);
    skipped++;
    continue;
  }

  // Inject clamp as first statement in the function body
  const insertAt = matchEnd;
  const newSrc = src.slice(0, insertAt) + '\n' + CLAMP_LINE + src.slice(insertAt);

  if (DRY_RUN) {
    console.log(`[DRY] ${name.padEnd(22)} — would inject dt clamp`);
    patched++;
    continue;
  }

  fs.writeFileSync(filePath, newSrc, 'utf8');

  // Quick syntax check
  const { execSync } = require('child_process');
  try {
    execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    console.log(`[FIX] ${name.padEnd(22)} — dt clamp injected`);
    patched++;
  } catch (e) {
    // Revert on syntax error
    fs.writeFileSync(filePath, src, 'utf8');
    console.error(`[ERR] ${name.padEnd(22)} — syntax error after patch, reverted`);
    errors++;
  }
}

console.log(`\n══════════════════════════════════`);
console.log(`Patched: ${patched}  Skipped: ${skipped}  Errors: ${errors}`);
