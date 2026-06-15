#!/bin/bash
# ============================================================
# ORBIT HOPPER — PLAY STORE AUTOMATED SETUP
# Run this on YOUR computer (Mac / Windows WSL / Linux)
# It builds the Android app ready to upload to Play Store.
# ============================================================
set -e

echo ""
echo "=== Orbit Hopper — Play Store Setup ==="
echo ""

# ── Prerequisites check ───────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v java >/dev/null 2>&1 || { echo "ERROR: Java not found. Install Android Studio which includes Java."; exit 1; }
echo "✓ Node.js $(node -v)"
echo "✓ Java $(java -version 2>&1 | head -1)"
echo ""

# ── Step 1: Install Bubblewrap ─────────────────────────────────
echo "--- Installing Bubblewrap CLI (TWA builder)..."
npm install -g @bubblewrap/cli
echo "✓ Bubblewrap installed"
echo ""

# ── Step 2: Build TWA ─────────────────────────────────────────
OUTDIR="$(dirname "$0")/twa-build"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

echo "--- Initialising TWA from your GitHub Pages manifest..."
echo "    (You will be asked for a signing key password — choose any password and SAVE IT)"
echo ""
bubblewrap init --manifest "https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/game/manifest.json"

# ── Step 3: Set package name ──────────────────────────────────
# bubblewrap init creates twa-manifest.json — patch package name
if [ -f twa-manifest.json ]; then
  node -e "
    const f = 'twa-manifest.json';
    const m = JSON.parse(require('fs').readFileSync(f,'utf8'));
    m.packageId = 'com.pixelnova.orbithopper';
    m.appName   = 'Orbit Hopper';
    require('fs').writeFileSync(f, JSON.stringify(m, null, 2));
    console.log('✓ Patched twa-manifest.json');
  "
fi

echo ""
echo "--- Building signed APK/AAB..."
bubblewrap build

echo ""
echo "=== BUILD COMPLETE ==="
echo ""
echo "Files:"
echo "  $OUTDIR/app-release-signed.aab  ← upload this to Play Console"
echo "  $OUTDIR/app-release-signed.apk  ← test on your phone"
echo ""

# ── Step 4: Get SHA256 fingerprint for assetlinks.json ────────
echo "--- Your app signing fingerprint (needed for assetlinks.json):"
keytool -list -v -keystore android.ks -alias android 2>/dev/null | grep "SHA256:" || \
  echo "  (Run: keytool -list -v -keystore $OUTDIR/android.ks -alias android | grep SHA256)"
echo ""

# ── Step 5: Instructions for what to do next ─────────────────
echo "=== NEXT STEPS ==="
echo ""
echo "1. Go to https://play.google.com/console"
echo "   → Create app → upload app-release-signed.aab"
echo "   → App name: Orbit Hopper"
echo "   → Category: Games / Arcade"
echo "   → Add icon: ../../icons/icon-512.png"
echo "   → Add feature graphic: ../../submit/feature-graphic-1024x500.png"
echo ""
echo "2. Update assetlinks.json with your SHA256 fingerprint above:"
echo "   → Edit orbit-hopper/.well-known/assetlinks.json"
echo "   → Replace REPLACE_WITH_YOUR_SHA256_FINGERPRINT"
echo "   → Commit and push — CI will redeploy automatically"
echo ""
echo "3. Connect bank/UPI in AdMob:"
echo "   → https://admob.google.com → Payments → Add payment method"
echo "   → Threshold: \$100 USD, paid monthly"
echo ""
