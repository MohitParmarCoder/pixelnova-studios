# Orbit Hopper — Android App

Wraps the HTML5 game in a native Android shell using **Capacitor** + **AdMob**.

## Prerequisites (run once on your machine)

| Tool | Install |
|------|---------|
| Node 18+ | nodejs.org |
| Android Studio (Flamingo+) | developer.android.com/studio |
| Java 17+ JDK | already in Android Studio |
| Capacitor CLI | installed via npm below |

## Step 1 — Get Ad IDs from Google AdMob

1. Go to **admob.google.com** → sign in with your Google account
2. Add app → Android → Name: "Orbit Hopper" → Save
3. Copy your **AdMob App ID** (format: `ca-app-pub-XXXX~YYYY`)
4. Create two Ad Units:
   - Interstitial → copy its **Ad Unit ID**
   - Rewarded → copy its **Ad Unit ID**

## Step 2 — Fill in your IDs

Edit **`capacitor.config.json`** → replace `REPLACE_WITH_YOUR_ADMOB_APP_ID~...`

Edit **`build.js`** → replace `REPLACE_ME/INTERSTITIAL_ID` and `REPLACE_ME/REWARDED_ID`

## Step 3 — Build

```bash
cd android-app
npm run setup          # installs deps, copies game files, adds android, syncs
npm run open           # opens Android Studio
```

In Android Studio → Build → Generate Signed Bundle/APK → follow wizard.

## Step 4 — Connect AdMob to bank (India/UPI)

1. admob.google.com → **Payments** (top right)
2. Payments profile → **Add payment method**
   - Bank transfer: IFSC + account number
   - OR UPI ID (instant, recommended for India)
3. Minimum payout: **$100 USD** (auto-transferred monthly)

## Step 5 — Upload to Play Store

1. play.google.com/console → **Create app** ($25 one-time fee)
2. Build → **Generate Signed AAB** (Android App Bundle, preferred over APK)
3. Upload to Play Console → Internal Testing → Production
4. Store listing: use screenshots from `orbit-hopper/promo.html`

## Step 6 — Link AdMob to Play Store (for 50% higher eCPM)

In AdMob: Apps → Link to Play Store → search "Orbit Hopper"

---

## TWA (Trusted Web Activity) — Alternative to Capacitor

If you just want a thin wrapper from the GitHub Pages URL:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://mohitparmarcoder.github.io/udemy-react-fullstack-dailynews-project/game/manifest.json
bubblewrap build
```

Then fill in `assetlinks.json` with the SHA-256 fingerprint from your signing key:
```bash
keytool -list -v -keystore android.ks -alias android | grep SHA256
```
Upload the fingerprint to `orbit-hopper/.well-known/assetlinks.json` and redeploy.
