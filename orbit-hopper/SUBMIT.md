# Orbit Hopper — Platform Submission Checklist

## 1. Enable GitHub Pages (one-time, 2 minutes)

After the CI deploys the `gh-pages` branch:

1. Go to https://github.com/MohitParmarCoder/Udemy-react-fullstack-dailynews-project/settings/pages
2. **Source** → **Deploy from a branch**
3. **Branch** → `gh-pages` → `/(root)` → **Save**

Your live URLs will be:
- Company website: https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/
- Game:           https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/game/

---

## 2. CrazyGames Portal (free, ~1 week review)

**URL to submit:** your GitHub Pages game URL above (or a rawcdn URL)

1. Sign up at https://developer.crazygames.com/
2. **Submit a game** → HTML5
3. Game URL: `https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/game/crazygames.html`
4. Screenshots: open `promo.html` in browser → right-click canvas → Save Image
5. Payment: PayPal or bank wire in developer dashboard (after approval)

**Revenue:** ~$1–5 per 1,000 plays (CPM)

---

## 3. GameDistribution Portal (free, ~5 days review)

1. Sign up at https://developer.gamedistribution.com/
2. Upload game → get your **Game ID** from the dashboard
3. Edit `gamedistribution.html` line: `window.GD_GAME_ID = 'YOUR_ACTUAL_GD_ID';`
4. Submit URL: `.../game/gamedistribution.html`
5. Payment: PayPal or bank wire

---

## 4. Google Play Store — TWA (Trusted Web Activity)

Prerequisites: GitHub Pages is live, app is signed.

### 4a. Install Bubblewrap (run on your local machine)
```bash
npm install -g @bubblewrap/cli
mkdir orbit-hopper-twa && cd orbit-hopper-twa
bubblewrap init --manifest https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/game/manifest.json
```
Follow prompts:
- Package name: `com.pixelnova.orbithopper`
- App name: `Orbit Hopper`
- Create signing key when asked → save `android.ks` and the password

### 4b. Build the APK
```bash
bubblewrap build
```
Output: `app-release-signed.apk` and `app-release-signed.aab`

### 4c. Get your signing fingerprint
```bash
keytool -list -v -keystore android.ks -alias android | grep SHA256
```
Copy the SHA256 fingerprint value.

### 4d. Update assetlinks.json
Edit `.well-known/assetlinks.json` in this repo:
```json
"sha256_cert_fingerprints": ["AA:BB:CC:...(your SHA256 here)"]
```
Commit and push → CI will redeploy it to GitHub Pages.

### 4e. Upload to Play Console
1. https://play.google.com/console → Create app ($25 one-time)
2. App name: **Orbit Hopper**
3. Category: Games → Arcade
4. Privacy policy: required (simple one-liner URL is fine)
5. Upload `.aab` → Internal Testing → review → Production

---

## 5. Google Play Store — Capacitor (full native AdMob)

Use this if you want AdMob interstitial and rewarded ads inside the native app.
Full instructions in `../android-app/README.md`.

### Quick summary:
```bash
# Get AdMob IDs from admob.google.com first, then:
cd android-app
# Fill in capacitor.config.json with your AdMob App ID
# Fill in build.js with your Interstitial + Rewarded Ad Unit IDs
npm run setup       # copies files, adds android platform, syncs
npm run open        # opens Android Studio
# In Android Studio: Build → Generate Signed Bundle/APK
```

---

## 6. Connect Bank to AdMob (India/UPI)

1. Go to https://admob.google.com → top right → **Payments**
2. Click **Payments profile** → **Add payment method**
3. Choose:
   - **UPI** (recommended, instant transfer): enter your UPI ID
   - **Bank transfer**: IFSC code + account number
4. Minimum payout: **$100 USD** (auto-paid on 21st of each month)
5. Tax forms: fill in the W-8BEN form for non-US publishers

---

## Asset checklist for store listings

| Asset | Size | Where |
|-------|------|--------|
| App icon | 512×512 PNG | `icons/icon-512.png` ✅ |
| Feature graphic | 1024×500 PNG | Generate from `promo.html` |
| Phone screenshots (portrait) | 1080×1920 | Generate from `promo.html` or device |
| Game trailer (optional) | YouTube URL | — |
