# Mushaf Reader for Android

A Trusted Web Activity: a small Android app that opens the web app (https://maazarif.github.io/quran-app/) full-screen through Chrome. Pages, recitation and settings all come from the web app, so every web update reaches the Android app without a new release.

- App ID `io.github.maazarif.mushaf`, Android 7.0 or newer, targets Android 16 (API 36) as Google Play requires.
- Built by `.github/workflows/android.yml` on every change in `android/`. The **android-latest** release on GitHub has the newest files:
  - `mushaf-test.apk`: install it on any Android phone to try the app.
  - `mushaf-release.aab`: the file to upload to Google Play.
- Background audio works as in Chrome: recitation keeps playing with the screen off, with lock-screen and car controls.

## One-time: add the upload key to GitHub (for Google Play builds)

Google Play only accepts builds signed with your **upload key**. You received it as `upload-key.p12` with its password. Keep a copy somewhere safe, such as a password manager. With Play App Signing, Google can reset it if you lose it.

On GitHub, open **maazarif/quran-app → Settings → Secrets and variables → Actions → New repository secret** and add two secrets:

| Name | Value |
|---|---|
| `ANDROID_UPLOAD_KEY_BASE64` | the whole contents of `upload-key.p12.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | the password |

Then run the build again: **Actions → Android app → Run workflow**. The new `mushaf-release.aab` on the release page is signed.

## Publishing on Google Play

1. **Developer account.** Sign up at https://play.google.com/console ($25 once, plus identity verification).
2. **Create the app.** Name it "Mushaf Reader", make it free, then:
   - **Store listing:**
     - Icon: `native-assets/store/play-icon-512.png`
     - Feature graphic: `native-assets/store/feature-graphic-1024x500.png`
     - Screenshots: from your phone
   - **Privacy policy:** https://maazarif.github.io/quran-app/privacy.html
   - **Data safety:** no data collected or shared.
   - **Content rating questionnaire:** answer it as a reference/education app.
3. **Upload.** Upload `mushaf-release.aab` to **Testing → Closed testing**. Accept **Play App Signing** when asked.
4. **Let Android trust the Play build.** Google re-signs the app with its own key, so add that key to the verification file, or the app will show a browser address bar:
   1. In Play Console, open **Test and release → App integrity → App signing**.
   2. Copy the **SHA-256 certificate fingerprint** of the *app signing key*.
   3. Add it to `sha256_cert_fingerprints` in https://github.com/maazarif/maazarif.github.io/blob/master/.well-known/assetlinks.json.
5. **Closed test.** New personal accounts need **12 testers opted in for 14 days in a row**. Then apply for production access from the Dashboard.

## The verification file

`https://maazarif.github.io/.well-known/assetlinks.json` (repository `maazarif/maazarif.github.io`) lists the keys allowed to open the app full-screen. It holds the upload key, the test key in `android/app/preview.keystore` (not secret; only for the test APK), and, after step 4, Google's app signing key. If a fingerprint is missing, the app still works but shows a small address bar at the top.
