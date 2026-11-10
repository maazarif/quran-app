# Bundled data sources

## How the Quran text is checked
The tests check every ayah against King Fahd Glorious Qur'an Printing Complex's own digital texts (in `tests/reference/`, copied unchanged from github.com/fawazahmed0/quran-api at commit 93e6f649):
- **Uthmani (Madani pages):** all 6,236 ayat have exactly the same letters and marks as KFGQPC Uthmani Hafs v13 (`kfgqpc-uthmani-hafs-v13.json`), and every word break matches. The only differences are encoding: Unicode canonical mark order (NFC), the tatweel that carries a small alif, U+200F direction marks, and the space that file leaves after an open tanween inside a word.
- **IndoPak:** all 6,236 ayat have the same letters as KFGQPC's Nastaleeq (IndoPak) text (`kfgqpc-nastaleeq.json`), except 47 ayat where the two printed traditions spell a word differently (for example an extra seat letter or a different long-vowel sign). These 47 are listed with both spellings in `data/indopak-spelling-differences.json`, and the test fails if any other ayah differs. Seven private-use glyphs in the QUL text stand for whole letters (`glyph_letters` in that file); each stands for the same letters in every place it is used.
- **On screen:** every ayah on all 604 Madani pages is shown byte for byte as in the bundled file, and IndoPak words that start with a private-use glyph are drawn right to left (the glyph comes first).

## data/uthmani-hafs.json
The Uthmani text shown on Madani pages, side by side, in the ayah menu and when copying.
- From quran-json 3.1.2 (github.com/risan/quran-json, tag v3.1.2, commit 707ba0f) `dist/quran.json`, sha256 d8a8adff387f60ce3ff7dbe3238dd9b27120bfe29d8fcb07ad2e89cad37cefd4 (also kept as `tests/reference/quran-json-3.1.2-quran.json`).
- Two kinds of change, and the tests check that there are no others:
  1. Open tanween is stored in the source as old code points (U+0657, U+065E, U+0656) that fonts draw as other marks. They are re-encoded as the official Quranic open tanween U+08F0, U+08F1, U+08F2 (as in KFGQPC's file), then NFC.
  2. The source joins two words in 37:164 (وَمَامِنَّآ) and 41:47 (مَامِنَّا); the space is restored as in KFGQPC v13 and the printed Mushaf (وَمَا مِنَّآ, مَا مِنَّا). Listed under `corrections` in the file.

## data/indopak-15-lines.json
IndoPak (Hanafi Nastaleeq) Quran text, word by word, in the 15-line, 610-page Taj / Qudratullah Mushaf layout.
- Original source: QUL, Quranic Universal Library by Tarteel AI, layout 6 "Indopak 15 lines – Qudratullah" (https://qul.tarteel.ai/mushaf_layouts/6)
- Copied unchanged from https://github.com/Mohammmed-Waleed/mushaf (data/pages.json) at commit ecd61a3eb9cf82ed3fce932cf1a0d83c5efac0fc
- Checked here: 610 pages × 15 lines, 83,668 words, all 6,236 ayat in order with no gaps, 114 surah headers, 112 Bismillah lines, 2:255 on page 42, Juz 30 from page 586.
- Format per page: list of 15 lines. {"t":"s","s":N} surah header · {"t":"b"} Bismillah · {"t":"w","c":0|1,"w":[["surah:ayah:word","text"],...]} words (c=1: centred line).
- Ayah-end numbers and some waqf signs are font glyphs in the Private Use Area (U+F500–U+F68F); they only display with the fonts below.

## fonts/indopak/*.woff2
IndoPak Nastaleeq (Hanafi, with waqf lazim), normal / compact / compressed widths. From QUL / Tarteel CDN, copied unchanged from the same repository.

Checksums are in SOURCES.sha256. The text, layout and fonts belong to their projects (Tarteel QUL, Quran.com); check their terms before distributing the app widely.

## fonts/quran/*.woff
Mushaf and interface fonts, bundled so the text always draws with a font that has every Quranic character (a missing font made the browser fall back to one that drops marks such as the wasla on ٱ).
- From github.com/google/fonts at commit 5bb28733cec313b63fbd415b574b5ae35c8aa8b8: `ofl/amiriquran`, `ofl/amiri`, `ofl/scheherazadenew`, `ofl/notonaskharabic`, `ofl/figtree`. Licence: SIL Open Font Licence 1.1 (copies in `fonts/quran/OFL-*.txt`).
- The Arabic fonts are repackaged as WOFF with no glyphs removed. Checked here: Amiri Quran, Amiri, Scheherazade New and Noto Naskh Arabic each have a glyph for all 72 characters used in `data/uthmani-hafs.json`. Figtree (interface text only) is cut down to Latin characters.

## data/timings/*.json
Ayah start and end times inside each reciter's full-surah recordings, so a whole surah plays as one continuous recording (which keeps playing when the phone is locked) while the app follows each ayah.
- Source: quranic-universal-audio v4.0.0 by QUD Technologies (https://github.com/QUD-Technologies/quranic-universal-audio/releases/tag/v4.0.0), licence CC BY 4.0. Timing made by forced alignment of the recordings.
- Converted from each package's verse_timestamps.json.gz without changing any time. Rows marked 0 are places where the reciter repeats an ayah. Checked here: ayat in order, times increasing, one audio file per surah.
- The recordings themselves are streamed from their hosts and belong to their reciters and publishers.

| Reciter | Package | Audio host | Ayat timed | Missing | Package sha256 |
|---|---|---|---|---|---|
| Mishary Rashid Al-Afasy | `mishary_rashid_al_afasy_mp3quran` | https://cdn.mp3quran.net/audio/mishary-alafasy/r1/ | 6236 | — | `118fac516a7afd12…` |
| Mahmoud Khalil Al-Husary | `mahmoud_khalil_al_husary_mp3quran` | https://cdn.mp3quran.net/audio/mahmoud-husary/r1/ | 6236 | — | `8ad2dfa18fc86565…` |
| Mohammed Siddiq Al-Minshawi | `mohammed_siddiq_al_minshawi_mp3quran` | https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/ | 6236 | — | `5ee099e93b10bd32…` |
| Abdulbasit Abdulsamad | `abdulbasit_abdulsamad_tarteel` | https://audio-cdn.tarteel.ai/quran/surah/abdulBasit/murattal/mp3/ | 6236 | — | `10ae962c93d9c438…` |
| Abdulrahman Al-Sudais | `abdulrahman_al_sudais_tarteel` | https://audio-cdn.tarteel.ai/quran/surah/abdulrahmanAlSudais/murattal/mp3/ | 6236 | — | `0b4e7ec053f94508…` |
| Saud Al-Shuraim | `saud_al_shuraim_mp3quran` | https://cdn.mp3quran.net/audio/saud-shuraim/r1/ | 6236 | — | `523c280a9fd34c2e…` |
| Abu Bakr Al-Shatri | `abu_bakr_al_shatri_tarteel` | https://audio-cdn.tarteel.ai/quran/surah/abuBakrAlShatri/murattal/mp3/ | 6236 | — | `54159f5a815d480e…` |
| Hani Al-Rifai | `hani_al_rifai_qdc_128k` | https://download.quranicaudio.com/qdc/hani_ar_rifai/murattal/ | 6235 | 6:139 | `d0089fcf68c00bae…` |
