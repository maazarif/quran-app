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
