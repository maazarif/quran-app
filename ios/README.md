# Mushaf Reader for iPhone and iPad

A native app that shows the web app (https://maazarif.github.io/quran-app/) full-screen in a WebKit view. Being a native app, it fixes the background-audio limits of home-screen web apps:

- **Background audio:** keeps reciting with the screen locked or the app minimised (`UIBackgroundModes: audio`).
- **Silent switch:** plays even when the phone is set to silent (audio session category `playback`).
- **Car prompts:** pauses briefly for navigation voices instead of talking over them (mode `spokenAudio`).
- **Offline:** keeps opened pages for offline reading (app-bound domain `maazarif.github.io`, so the web app's service worker runs).
- **Other links:** open in Safari.

Bundle ID `io.github.maazarif.mushaf`, iOS 16 or newer, iPhone and iPad. `.github/workflows/ios.yml` builds it on a Mac for real phones and the simulator, runs it, and saves screenshots to the `native-builds-ios` branch.

## Building it yourself (needs a Mac with Xcode)

```
brew install xcodegen
cd ios && xcodegen     # creates Mushaf.xcodeproj from project.yml
open Mushaf.xcodeproj
```
In Xcode, open **Mushaf → Signing & Capabilities** and choose your team. Then you can run it on your own iPhone. A free Apple ID works for your own phone, for 7 days at a time.

## Publishing on the App Store

1. **Apple Developer Program.** Join at https://developer.apple.com/programs/ ($99 a year).
2. **Create the app.** In App Store Connect, under **Apps → +**, add a new app with bundle ID `io.github.maazarif.mushaf`.
3. **Upload a build.** In Xcode, choose **Product → Archive**, then **Distribute App → App Store Connect**. The build appears in **TestFlight** for you and testers within about 30 minutes.
4. **Listing:**
   - **Screenshots:** a 6.9" iPhone set (and iPad if you keep iPad support).
   - **Privacy policy:** https://maazarif.github.io/quran-app/privacy.html
   - **App Privacy:** "Data Not Collected".
   - **Age rating:** 4+.
5. **Submit for review.** Apple checks that wrapped websites behave like real apps (guideline 4.2, "minimum functionality"). In the review notes, mention:
   - recitation in the background and on the lock screen;
   - offline reading of saved pages;
   - bookmarks and highlights;
   - the Madani and IndoPak editions.

Uploads can also be automated from GitHub (fastlane with an App Store Connect API key) once you have the developer account.
