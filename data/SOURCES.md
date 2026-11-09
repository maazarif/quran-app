# Bundled data sources

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
