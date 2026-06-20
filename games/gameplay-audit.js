'use strict';
/**
 * gameplay-audit.js — Static code analysis for common gameplay bugs across all 100 games.
 * Checks: speed caps, particle limits, globalAlpha reset, setLineDash reset,
 *         hardcoded text/spawn coordinates, lives invincibility, difficulty runaway.
 *
 * Usage: node games/gameplay-audit.js [--verbose]
 */
const fs   = require('fs');
const path = require('path');

const GAMES_DIR = __dirname;
const VERBOSE   = process.argv.includes('--verbose');
const VW = 390, VH = 844;

const games = fs.readdirSync(GAMES_DIR)
  .filter(d => fs.existsSync(path.join(GAMES_DIR, d, 'js', 'game.js')))
  .sort();

function check(name, src) {
  const issues = [];

  // 1. Speed variables increasing without a Math.min cap
  //    Look for `speed += X` or `speed *= X` (X>1) without nearby Math.min
  const speedIncPatterns = [
    /speed\s*\+=\s*[\d.]+/g,
    /speed\s*\*=\s*[1-9][\d.]*/g,
    /_speed\s*\+=\s*[\d.]+/g,
    /spawnInterval\s*-=\s*[\d.]+/g,
    /interval\s*-=\s*[\d.]+/g,
  ];
  for (const re of speedIncPatterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const surrounding = src.slice(Math.max(0, m.index - 60), m.index + 80);
      if (!surrounding.includes('Math.min') && !surrounding.includes('Math.max')) {
        issues.push({ sev: 'WARN', msg: `Uncapped speed change: \`${m[0].trim()}\`` });
      }
    }
  }

  // 2. Particle array push without length limit
  const particlePushRe = /(\w+)\.push\s*\(\s*\{[^}]*life[^}]*\}/g;
  let pm;
  while ((pm = particlePushRe.exec(src)) !== null) {
    const arrName = pm[1];
    // Check if there's a length/cap check anywhere near this array
    if (!src.includes(`${arrName}.length`) ||
        !src.includes(`MAX_PART`) && !src.includes('MAX_PARTICLES') &&
        !src.includes(`.length >=`) && !src.includes(`.length>`) &&
        !src.includes('splice') ) {
      issues.push({ sev: 'INFO', msg: `Particles in \`${arrName}\` may grow unbounded` });
    }
    break; // only report once per game
  }

  // 3. ctx.globalAlpha set but never reset in same function
  const alphaSetRe = /ctx\.globalAlpha\s*=\s*(?!1\b)/g;
  const alphaResetRe = /ctx\.globalAlpha\s*=\s*1/g;
  const alphaSetCount  = (src.match(alphaSetRe)  || []).length;
  const alphaResetCount = (src.match(alphaResetRe) || []).length;
  if (alphaSetCount > alphaResetCount) {
    issues.push({ sev: 'WARN', msg: `globalAlpha set ${alphaSetCount}× but reset ${alphaResetCount}× — possible state leak` });
  }

  // 4. setLineDash set but never cleared
  const dashSetCount   = (src.match(/ctx\.setLineDash\s*\(\s*\[[\d,\s]+\]/g)  || []).length;
  const dashClearCount = (src.match(/ctx\.setLineDash\s*\(\s*\[\s*\]/g) || []).length;
  if (dashSetCount > 0 && dashClearCount === 0) {
    issues.push({ sev: 'WARN', msg: `setLineDash used ${dashSetCount}× but never cleared with []` });
  } else if (dashSetCount > dashClearCount + 1) {
    issues.push({ sev: 'INFO', msg: `setLineDash set ${dashSetCount}× but cleared only ${dashClearCount}×` });
  }

  // 5. ctx.shadowBlur set but never reset (set to >0, never to 0)
  const shadowSetRe = /ctx\.shadowBlur\s*=\s*(?!0\b)/g;
  const shadowClrRe = /ctx\.shadowBlur\s*=\s*0/g;
  const shadowSets = (src.match(shadowSetRe) || []).length;
  const shadowClrs = (src.match(shadowClrRe) || []).length;
  if (shadowSets > 0 && shadowClrs === 0) {
    issues.push({ sev: 'WARN', msg: `shadowBlur set ${shadowSets}× but never cleared to 0 — expensive + visual bleed` });
  }

  // 6. textAlign set but not reset at end of draw
  //    Only flag if there are mixed textAlign values without a reset to 'left'
  const textAlignLeft  = (src.match(/ctx\.textAlign\s*=\s*'left'/g)   || []).length;
  const textAlignOther = (src.match(/ctx\.textAlign\s*=\s*'(?:center|right)'/g) || []).length;
  if (textAlignOther > 0 && textAlignLeft === 0) {
    issues.push({ sev: 'INFO', msg: `textAlign set to center/right but never reset to left` });
  }

  // 7. Hardcoded X coordinates in fillText beyond canvas width
  const fillTextRe = /ctx\.fillText\s*\([^,]+,\s*([\d.]+)\s*,/g;
  let ft;
  while ((ft = fillTextRe.exec(src)) !== null) {
    const x = parseFloat(ft[1]);
    if (x > VW) {
      issues.push({ sev: 'ERR', msg: `fillText at x=${x} > canvas width ${VW}` });
    }
  }

  // 8. Objects spawning off-screen (hardcoded spawn x > VW or y > VH)
  const spawnXRe = /[xy]\s*[:=]\s*([\d.]+)/g;
  let sp;
  while ((sp = spawnXRe.exec(src)) !== null) {
    const v = parseFloat(sp[1]);
    // Only flag clearly wrong values (>600 for x, >1200 for y — to avoid false positives)
    if (v > 600 && v < 2000 && src[sp.index - 1] !== '/' && src[sp.index - 2] !== '/') {
      const ctx2 = src.slice(Math.max(0, sp.index - 30), sp.index + 30);
      if (ctx2.match(/spawn|push|new\s|create/i)) {
        issues.push({ sev: 'WARN', msg: `Possible off-screen spawn coordinate: ${v}` });
        break;
      }
    }
  }

  // 9. Multiple lives deduction in same tap/hit (no invincibility timer)
  //    Pattern: `lives--` appears multiple times without `invincible`/`hitCooldown`/`flashTimer` guard
  const livesDecCount = (src.match(/lives\s*--/g) || []).length;
  const hasInvincible  = /invincib|hitCooldown|iframes|invTimer|hitTimer|damageTimer|invulner/i.test(src);
  if (livesDecCount >= 2 && !hasInvincible) {
    issues.push({ sev: 'INFO', msg: `${livesDecCount} lives-- paths with no invincibility timer — rapid cascading deaths possible` });
  }

  // 10. Score variable not clamped — can overflow display
  //     Check for very fast score accumulation (score++ in innermost loop body)
  if (/for\s*\([^)]+\)[^{]*\{[^}]*score\s*\+\+/s.test(src)) {
    issues.push({ sev: 'INFO', msg: 'score++ inside a for-loop — could increment many times per frame' });
  }

  return issues;
}

const results = [];
for (const name of games) {
  const filePath = path.join(GAMES_DIR, name, 'js', 'game.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const issues = check(name, src);
  if (issues.length > 0) {
    results.push({ name, issues });
  }
}

// Output
const errs   = results.filter(r => r.issues.some(i => i.sev === 'ERR'));
const warns  = results.filter(r => r.issues.some(i => i.sev === 'WARN') && !r.issues.some(i => i.sev === 'ERR'));
const infos  = results.filter(r => r.issues.every(i => i.sev === 'INFO'));
const clean  = games.length - results.length;

if (VERBOSE || errs.length > 0) {
  console.log('\n── ERRORS (must fix) ──────────────────');
  for (const r of errs) {
    console.log(`[ERR] ${r.name}`);
    r.issues.filter(i => i.sev === 'ERR').forEach(i => console.log(`      ${i.msg}`));
  }
}

console.log('\n── WARNINGS (should fix) ──────────────');
for (const r of [...errs, ...warns]) {
  const w = r.issues.filter(i => i.sev === 'WARN');
  if (w.length) {
    console.log(`[WARN] ${r.name.padEnd(22)}`);
    w.forEach(i => console.log(`       ${i.msg}`));
  }
}

if (VERBOSE) {
  console.log('\n── INFO (investigate) ─────────────────');
  for (const r of results) {
    const inf = r.issues.filter(i => i.sev === 'INFO');
    if (inf.length) {
      console.log(`[INFO] ${r.name.padEnd(22)}`);
      inf.forEach(i => console.log(`       ${i.msg}`));
    }
  }
}

console.log(`\n══════════════════════════════════════
Games: ${games.length}  Clean: ${clean}  With warnings: ${warns.length + errs.length}  With errors: ${errs.length}
`);
