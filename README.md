# Mushaf Reader

An installable Quran web app: Madani Mushaf pages, four Mushaf script styles, 10 translations, 8 reciters, bookmarks and highlights. It installs to a phone's home screen and works offline for pages you have already opened.

## Put it online (free, about 5 minutes)

The app is a plain folder of files. Any static host works; it must be served over **https** for installing and offline use.

**Netlify Drop** (easiest, needs a computer)
1. Unzip `quran-app.zip`.
2. Go to https://app.netlify.com/drop and drag the `quran-app` folder onto the page.
3. Netlify gives you a link such as `https://your-name.netlify.app`. Create a free account to keep it.

**GitHub Pages**
1. Create a new public repository and upload the contents of the folder (index.html at the top level).
2. Settings → Pages → Deploy from branch → `main` / root → Save.
3. The app appears at `https://<username>.github.io/<repository>/`.

**Vercel**: import the repository at https://vercel.com/new, framework preset "Other", no build command.

## Install it on a phone

- **iPhone / iPad**: open the link in Safari → Share → **Add to Home Screen**.
- **Android**: open the link in Chrome → tap **Install** in the app (or browser menu → Install app).

The app has an Install button that shows the right steps for each device.

## Run it on your computer

```
cd quran-app
python3 -m http.server 8080
```
Open http://localhost:8080.

## Where the content comes from

The Quran text is never typed or edited by hand. It is downloaded from these sources and shown exactly as published (each ayah is rendered as received, with no normalisation):

| Content | Source | Version |
|---|---|---|
| Uthmani Arabic text | The Noble Qur'an Encyclopedia (King Fahd Glorious Qur'an Printing Complex), via the `quran-json` package on jsDelivr | 3.1.2 (pinned) |
| Translations | Saheeh International, Maududi (Urdu), Indonesian Ministry of Religious Affairs, Diyanet (Turkish), Hamidullah (French), Isa García (Spanish), Kuliev (Russian), Muhiuddin Khan (Bengali), Makin (Chinese), Bernström (Swedish); transliteration from Tanzil | same package |
| Page and juz layout (604-page Madani Mushaf, Hafs) | `quran-meta` package on jsDelivr | 6.0.17 (pinned) |
| Recitation audio | EveryAyah.com, one file per ayah | — |
| Fonts | Amiri Quran, Scheherazade New, Amiri, Noto Naskh Arabic (Google Fonts) | — |

Several translations are copyrighted. Check each translation's terms before publishing the app widely.

## Tests

28 functional tests run the real app in headless Chrome with local stand-ins for the online sources, so they work without internet. They cover loading and error handling, exact text rendering, all 604 pages, navigation, translations, script styles, bookmarks, highlights, copy, recitation, phone layout, the install flow and offline reopening.

```
npm install
npx playwright install chromium
npm test
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Mushaf page design, light and dark themes |
| `app.js` | Loading, page rendering, translations, recitation, bookmarks, highlights |
| `sw.js` | Service worker: offline reading and caching |
| `manifest.webmanifest`, `icons/` | Home-screen install |
| `tests/` | Functional test suite |

## Known gaps

- Lines within a page are not yet broken exactly like the printed 15-line Mushaf (needs the King Fahd Complex page fonts and line data).
- IndoPak script needs its own text edition and font.
- Bookmarks and highlights are stored on the device only.
