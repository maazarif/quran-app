# Mushaf Reader

An installable Quran web app with two Mushaf editions: the 604-page Madani Mushaf (Uthmani script, four font styles) and the 610-page IndoPak 15-line Taj Mushaf (Nastaleeq script, with the printed copy's exact line breaks). It has page colours (auto, white, cream, sepia, mint, night, black), 10 translations (below the page, or side by side with the Arabic), 8 reciters, bookmarks and highlights. By default, tapping an ayah marks your place (one ayah at a time; press and hold for bookmark, highlight, copy and play); lasting highlights come from the highlighter button. Both can be changed in settings. Recitation plays a whole surah as one recording; previous and next (in the player, on the lock screen, on headphones or in the car) move ayah by ayah without pausing. It installs to a phone's home screen and works offline for pages you have already opened.

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

The Quran text is never typed or edited by hand. It is bundled from the sources below and checked, ayah by ayah, against the King Fahd Complex's own digital texts by the test suite (see `data/SOURCES.md` for exactly what is compared and the only encoding fixes made):

| Content | Source | Version |
|---|---|---|
| Uthmani Arabic text | King Fahd Glorious Qur'an Printing Complex text via the `quran-json` package, bundled in `data/uthmani-hafs.json`; same letters and marks as KFGQPC Uthmani Hafs v13 in all 6,236 ayat | 3.1.2 (fixed copy) |
| Translations | Saheeh International, Maududi (Urdu), Indonesian Ministry of Religious Affairs, Diyanet (Turkish), Hamidullah (French), Isa García (Spanish), Kuliev (Russian), Muhiuddin Khan (Bengali), Makin (Chinese), Bernström (Swedish); transliteration from Tanzil | same package |
| IndoPak text and 15-line, 610-page layout (Taj / Qudratullah), word by word | QUL, Quranic Universal Library by Tarteel AI; bundled in `data/` with checksums (see `data/SOURCES.md`) | fixed copy |
| IndoPak Nastaleeq font (Hanafi, waqf lazim; normal, compact and compressed widths) | QUL / Tarteel; bundled in `fonts/indopak/` | fixed copy |
| Page and juz layout (604-page Madani Mushaf, Hafs) | `quran-meta` package on jsDelivr | 6.0.17 (pinned) |
| Recitation audio | Whole-surah recordings from MP3Quran, Tarteel and QuranicAudio (one continuous recording per surah, so it keeps playing with the screen locked); EveryAyah.com per-ayah files as a fallback | — |
| Ayah timings inside each surah recording | quranic-universal-audio v4.0.0 by QUD Technologies, CC BY 4.0; bundled in `data/timings/` (see `data/SOURCES.md`) | fixed copy |
| Fonts | Amiri Quran, Amiri, Scheherazade New, Noto Naskh Arabic, Figtree (SIL Open Font Licence), bundled in `fonts/quran/` from the Google Fonts repository; each Arabic font has a glyph for every character of the Quran text | fixed copy |

Several translations are copyrighted. Check each translation's terms before publishing the app widely.

## Tests

Functional tests run the real app in headless Chrome with local stand-ins for the online sources, so they work without internet. They check every one of the 6,236 ayat against the King Fahd Complex's Uthmani (v13) and IndoPak texts, and cover loading and error handling, exact text rendering, all 604 Madani pages, the IndoPak edition with its real bundled text and fonts (exact words on sample pages, printed line breaks, known pages, fonts drawing the ayah numbers, every page ending at an ayah end), navigation, translations, script styles, bookmarks, highlights, copy, recitation, phone layout, the install flow and offline reopening.

```
npm install
npx playwright install chromium
npm test
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Mushaf page design, light and dark themes, page colours |
| `fonts/` | Bundled Mushaf and interface fonts, with their licences |
| `app.js` | Loading, page rendering, translations, recitation, bookmarks, highlights |
| `sw.js` | Service worker: offline reading and caching |
| `manifest.webmanifest`, `icons/` | Home-screen install |
| `tests/` | Functional test suite |

## Known gaps

- Madani pages have the printed page breaks but not yet the printed line breaks (the IndoPak edition has both).
- Copying an ayah from the IndoPak edition copies the standard Unicode (Uthmani) text, because the IndoPak ayah numbers and some waqf signs only display in its own font.
- The IndoPak text size follows the screen width so every line matches the printed page.
- Bookmarks and highlights are stored on the device only.
