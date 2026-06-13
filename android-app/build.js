#!/usr/bin/env node
// Copies orbit-hopper web files into www/, patches ads.js to use the Capacitor adapter.
'use strict';
const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '..', 'orbit-hopper');
const DEST = path.join(__dirname, 'www');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.well-known') continue; // skip — served from root
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('Copying orbit-hopper → www/');
copyDir(SRC, DEST);

// Patch index.html to set ORBIT_PORTAL = 'capacitor' before scripts load
const indexPath = path.join(DEST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('ORBIT_PORTAL')) {
  html = html.replace(
    '<script src="js/audio.js"></script>',
    '<script>\n  window.ORBIT_PORTAL = \'capacitor\';\n  window.ADMOB_IDS = {\n    interstitial: \'ca-app-pub-REPLACE_ME/INTERSTITIAL_ID\',\n    rewarded:     \'ca-app-pub-REPLACE_ME/REWARDED_ID\',\n  };\n</script>\n<script src="https://unpkg.com/@capacitor/core@6/dist/capacitor.js"></script>\n<script src="js/audio.js"></script>'
  );
  fs.writeFileSync(indexPath, html);
  console.log('Patched www/index.html with Capacitor adapter config');
}

console.log('Done. Run: npx cap sync android');
