# Mushaf Reader

An installable Quran web app with two Mushaf editions: the 604-page Madani Mushaf (Uthmani script, four font styles) and the 610-page IndoPak 15-line Taj Mushaf (Nastaleeq script, with the printed copy's exact line breaks). It has 10 translations, 8 reciters, bookmarks and highlights. It installs to a phone's home screen and works offline for pages you have already opened.

## Put it online (free, about 5 minutes)

The app is a plain folder of files. Any static host works; it must be served over **https** for installing and offline use.

**Netlify Drop** (easiest, needs a computer)
1. Unzip `quran-app.zip`.
2. Go to https://app.netlify.com/drop and drag the `quran-app` folder onto the page.
3. Netlify gives you a link such as `https://your-name.netlify.app`. Create a free account to keep it.

**GitHub Pages** (this repository publishes automatically: every push to `main` runs the tests and updates the `gh-pages` branch)
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
| IndoPak text and 15-line, 610-page layout (Taj / Qudratullah), word by word | QUL, Quranic Universal Library by Tarteel AI; bundled in `data/` with checksums (see `data/SOURCES.md`) | fixed copy |
| IndoPak Nastaleeq font (Hanafi, waqf lazim; normal, compact and compressed widths) | QUL / Tarteel; bundled in `fonts/indopak/` | fixed copy |
| Page and juz layout (604-page Madani Mushaf, Hafs) | `quran-meta` package on jsDelivr | 6.0.17 (pinned) |
| Recitation audio | EveryAyah.com, one file per ayah | — |
| Fonts | Amiri Quran, Scheherazade New, Amiri, Noto Naskh Arabic (Google Fonts) | — |

Several translations are copyrighted. Check each translation's terms before publishing the app widely.

## Tests

Functional tests run the real app in headless Chrome with local stand-ins for the online sources, so they work without internet. They cover loading and error handling, exact text rendering, all 604 Madani pages, the IndoPak edition with its real bundled text and fonts (exact words on sample pages, printed line breaks, known pages, fonts drawing the ayah numbers, every page ending at an ayah end), navigation, translations, script styles, bookmarks, highlights, copy, recitation, phone layout, the install flow and offline reopening.

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

- Madani pages have the printed page breaks but not yet the printed line breaks (the IndoPak edition has both).
- Copying an ayah from the IndoPak edition copies the standard Unicode (Uthmani) text, because the IndoPak ayah numbers and some waqf signs only display in its own font.
- The IndoPak text size follows the screen width so every line matches the printed page.
- Bookmarks and highlights are stored on the device only.
