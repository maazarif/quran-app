# App logo

القرآن الكريم in gold calligraphy above a Quran stand, on navy. It replaces the owner's earlier logo, of which only a small screenshot survived, and is drawn from scratch so it stays sharp at every size.

- **Lettering:** set in Katibeh, a calligraphy typeface (SIL Open Font Licence, `OFL-Katibeh.txt`), from github.com/google/fonts. The two words are typed, not traced, so every letter is exact. The test suite checks the spelling.
- **Stand:** the stand from the earlier logo, fitted as two vector bars (`stand.json`).
- **Colours:** gold #d0ad0e, stand #424243, background #13131c (matching the earlier logo).
- **Clear space:** a navy edge around the letters cuts them out of the stand. The drawing is framed by the measured ink of the letters, so nothing (the madda of آ included) is cut off.
- **Rebuilding the icons:** `node build-icons.cjs` (Playwright) writes `icons/*.png`; Katibeh needs to be at the path in the script.
