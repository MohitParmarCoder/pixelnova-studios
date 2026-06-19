'use strict';
/**
 * audit-ads.js — Static analysis of ad-hook coverage across all 100 games.
 * Usage: node games/audit-ads.js
 */
const fs   = require('fs');
const path = require('path');

const GAMES_DIR = __dirname;

// Find all game folders (has js/game.js)
const games = fs.readdirSync(GAMES_DIR)
  .filter(d => {
    const gp = path.join(GAMES_DIR, d, 'js', 'game.js');
    return fs.existsSync(gp);
  })
  .sort();

const results = [];

for (const name of games) {
  const file = path.join(GAMES_DIR, name, 'js', 'game.js');
  const src  = fs.readFileSync(file, 'utf8');

  // Find localStorage keys used (best score keys)
  const lsKeys = [];
  const lsRx = /localStorage\.setItem\(['"]([^'"]+)['"]/g;
  let m;
  while ((m = lsRx.exec(src)) !== null) lsKeys.push(m[1]);

  // Find the likely score variable (used most often near best comparisons)
  const scoreVarCandidates = [];
  // Common score var names
  for (const v of ['_score', 'score', 'chips', 'pts', 'points']) {
    if (new RegExp('\\b' + v + '\\b').test(src)) scoreVarCandidates.push(v);
  }

  // Detect which ad hooks are present
  const hasGameplayStart   = /AdManager\.gameplayStart\s*\(/.test(src);
  const hasGameplayStop    = /AdManager\.gameplayStop\s*\(/.test(src);
  const hasOnRunEnd        = /AdManager\.onRunEnd\s*\(/.test(src);
  const hasShowInter       = /AdManager\.showInterstitial\s*\(/.test(src);
  const hasOfferDouble     = /AdManager\.offerDoubleScore\s*\(/.test(src);

  // Check order: gameplayStop before onRunEnd in source text
  const stopIdx   = src.indexOf('AdManager.gameplayStop');
  const runEndIdx = src.indexOf('AdManager.onRunEnd');
  const orderOk   = (stopIdx > -1 && runEndIdx > -1) ? stopIdx < runEndIdx : null;

  // Find game-over function names
  const deadFns = [];
  const fnRx = /function\s+(\w*(?:die|dead|end|kill|lose|over|finish)\w*)\s*\(/gi;
  while ((m = fnRx.exec(src)) !== null) deadFns.push(m[1]);

  // Find where showInterstitial is called (function context)
  const interCtx = [];
  const interRx = /AdManager\.showInterstitial/g;
  while ((m = interRx.exec(src)) !== null) {
    // Find surrounding function
    const before = src.slice(Math.max(0, m.index - 300), m.index);
    const fnMatch = before.match(/function\s+(\w+)\s*\(/g);
    const ctx = fnMatch ? fnMatch[fnMatch.length - 1].replace('function ', '').replace('(', '') : '?';
    // Also find line number
    const line = src.slice(0, m.index).split('\n').length;
    interCtx.push(`${ctx}:L${line}`);
  }

  results.push({
    name,
    hasGameplayStart,
    hasGameplayStop,
    hasOnRunEnd,
    hasShowInter,
    hasOfferDouble,
    orderOk,
    deadFns,
    interCtx,
    lsKeys,
    scoreVarCandidates,
  });
}

// ── Summary ──────────────────────────────────────────────────────────────────
let missingInter   = [];
let missingDouble  = [];
let orderIssues    = [];
let missingStop    = [];
let missingRunEnd  = [];

for (const r of results) {
  if (!r.hasShowInter)   missingInter.push(r.name);
  if (!r.hasOfferDouble) missingDouble.push(r.name);
  if (r.orderOk === false) orderIssues.push(r.name);
  if (!r.hasGameplayStop)  missingStop.push(r.name);
  if (!r.hasOnRunEnd)      missingRunEnd.push(r.name);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AD INTEGRATION AUDIT — ' + games.length + ' games');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('PER-GAME STATUS (✓=present ✗=missing):\n');
console.log('Game'.padEnd(22) + 'Start Stop RunEnd Inter Double  Order  DeadFns');
console.log('─'.repeat(90));
for (const r of results) {
  const S = (b) => b ? '✓' : '✗';
  const ord = r.orderOk === null ? '─' : (r.orderOk ? '✓' : '✗');
  console.log(
    r.name.padEnd(22) +
    S(r.hasGameplayStart).padEnd(6) +
    S(r.hasGameplayStop).padEnd(5) +
    S(r.hasOnRunEnd).padEnd(7) +
    S(r.hasShowInter).padEnd(7) +
    S(r.hasOfferDouble).padEnd(8) +
    ord.padEnd(7) +
    (r.deadFns.join(',') || '?')
  );
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('SUMMARY:');
console.log(`  Total games:          ${games.length}`);
console.log(`  Missing gameplayStop: ${missingStop.length}`);
console.log(`  Missing onRunEnd:     ${missingRunEnd.length}`);
console.log(`  Missing showInter:    ${missingInter.length}`);
console.log(`  Missing offerDouble:  ${missingDouble.length}`);
console.log(`  Call order issues:    ${orderIssues.length}`);

if (missingStop.length)   console.log('\nMISSING gameplayStop:\n  ' + missingStop.join('\n  '));
if (missingRunEnd.length) console.log('\nMISSING onRunEnd:\n  ' + missingRunEnd.join('\n  '));
if (missingInter.length)  console.log('\nMISSING showInterstitial:\n  ' + missingInter.join('\n  '));
if (missingDouble.length) console.log('\nMISSING offerDoubleScore:\n  ' + missingDouble.join('\n  '));
if (orderIssues.length)   console.log('\nCALL ORDER WRONG (stop must come before runEnd):\n  ' + orderIssues.join('\n  '));

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PER-GAME DETAIL (localStorage keys + interstitial context):\n');
for (const r of results) {
  const issues = [];
  if (!r.hasGameplayStop)  issues.push('NO gameplayStop');
  if (!r.hasOnRunEnd)      issues.push('NO onRunEnd');
  if (!r.hasShowInter)     issues.push('NO showInterstitial');
  if (!r.hasOfferDouble)   issues.push('NO offerDoubleScore');
  if (r.orderOk === false) issues.push('WRONG ORDER');

  if (issues.length === 0 && r.orderOk !== false) continue; // skip clean games

  console.log(`${r.name}:`);
  console.log(`  Issues:  ${issues.join(', ')}`);
  console.log(`  DeadFns: ${r.deadFns.join(', ') || '(none found by name)'}`);
  console.log(`  LS keys: ${r.lsKeys.join(', ') || '(none)'}`);
  console.log(`  ScoreVar:${r.scoreVarCandidates[0] || '?'}`);
  if (r.interCtx.length) console.log(`  InterCtx:${r.interCtx.join(', ')}`);
  console.log();
}
