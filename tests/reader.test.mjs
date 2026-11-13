// Functional tests for the Mushaf Reader. Run: node tests/reader.test.mjs
import assert from "node:assert/strict";
import { launch, test, run, PAGE_URL, COUNTS, arText, BASMALA_FIXTURE } from "./harness.mjs";

const READY = ".ayah";
// first family in the computed font stack, without quotes (Chrome drops quotes on one-word names)
const firstFont = page => page.$eval(".ayah", e => getComputedStyle(e).fontFamily.split(",")[0].trim().replace(/^"|"$/g, ""));
async function open(opts, viewport, url = PAGE_URL) {
  const h = await launch(opts, viewport);
  await h.page.goto(url);
  return h;
}
async function withPage(opts, fn, viewport, url) {
  const h = await open(opts, viewport, url);
  try { await fn(h); } finally { await h.browser.close(); }
}

/* ---------- loading ---------- */
test("loads page 1 via the layout module and renders Al-Fatihah", () => withPage({}, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator(".ayah").count(), 7);
  assert.equal(await page.locator(".folio").textContent(), "١");
  assert.match(await page.locator("#where").textContent(), /Page 1 of 604/);
  assert.equal(await page.locator(".basmala").count(), 0, "Al-Fatihah has no separate Basmala line");
  assert.deepEqual(log.errors, []);
}));

test("layout library whose functions need the Hafs data passed in (the iPhone crash)", () => withPage({ esmShape: "needsLists" }, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator(".ayah").count(), 7);
  assert.ok(!log.requests.some(u => u.endsWith(".iife.js")), "should not need the fallback script");
}));

for (const shape of ["plain", "quranObject", "createHafs"]) {
  test("layout library shaped as " + shape + " loads all pages", () => withPage({ esmShape: shape }, async ({ page }) => {
    await page.goto(PAGE_URL + "#p604");
    await page.waitForSelector('.ayah[data-k="114:6"]', { timeout: 15000 });
  }));
}

test("layout from the hafs/ entry point is used first when it exists", () => withPage({ hafsPath: "ok", esm: "404" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator(".ayah").count(), 7);
}));

test("layout data that gives the wrong Madani pages is rejected, never shown", () => withPage({ esmShape: "wrongLayout", iife: "404" }, async ({ page }) => {
  await page.waitForSelector(".state.err", { timeout: 20000 });
  assert.match(await page.locator(".state.err code").textContent(), /2:255 gave page 43, expected 42|1:1 gave page|gave page/);
  assert.equal(await page.locator(".ayah").count(), 0);
}));

test("finds the layout script under either v6 or v7 file name", async () => {
  for (const iifeFile of ["index.iife.js", "quran-meta.iife.js"]) await withPage({ iifeFile, esm: "404" }, async ({ page }) => {
    await page.waitForSelector(READY, { timeout: 15000 });
    assert.equal(await page.locator(".ayah").count(), 7, iifeFile);
  });
});

test("falls back to the layout script when the module can't load", () => withPage({ esm: "404" }, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.ok(log.requests.some(u => u.endsWith("dist/index.iife.js")));
  assert.equal(await page.locator(".ayah").count(), 7);
}));

test("reports a script that loads without the expected global", () => withPage({ esm: "404", iife: "noglobal" }, async ({ page }) => {
  await page.waitForSelector(".state.err", { timeout: 20000 });
  assert.match(await page.locator(".state.err code").textContent(), /index\.iife\.js loaded but quranMeta was not found/);
}));

test("shows a specific error with a retry button when layout data can't load", () => withPage({ iife: "404", esm: "404" }, async ({ page }) => {
  await page.waitForSelector(".state.err", { timeout: 20000 });
  assert.match(await page.locator(".state.err b").textContent(), /page layout didn't load/);
  assert.match(await page.locator(".state.err code").textContent(), /Page layout data: hafs module: .*; module: .*; could not load .*index\.iife\.js; could not load .*quran-meta\.iife\.js/);
  assert.equal(await page.locator(".state.err button", { hasText: "Try again" }).count(), 1);
}));

test("still loads when the source surah index is unavailable (built-in list)", () => withPage({ index: "404" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator("#surahJump option").count(), 114);
  assert.match(await page.locator("#surahJump option").nth(1).textContent(), /2\. Al-Baqarah/);
}));

test("shows an error (not made-up text) when the Quran text can't load", () => withPage({ uthmani: "404" }, async ({ page }) => {
  await page.waitForSelector(".state.err", { timeout: 15000 });
  assert.match(await page.locator(".state.err b").textContent(), /Quran text didn't load/);
  assert.equal(await page.locator(".ayah").count(), 0);
}));

/* ---------- exact text ---------- */
test("renders every ayah's text exactly as received, with no normalisation", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p604");
  await page.waitForSelector('.ayah[data-k="114:1"]', { timeout: 15000 });
  const got = await page.$$eval(".ayah", els => els.map(e => [e.dataset.k, e.firstChild.nodeValue]));
  assert.ok(got.length > 0);
  for (const [k, text] of got) {
    const [s, a] = k.split(":").map(Number);
    assert.equal(text, arText(s, a), "ayah " + k + " differs from source");
  }
}));

test("uses the source's own 1:1 text as the Basmala line, and none before At-Tawbah", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p2");
  await page.waitForSelector('.ayah[data-k="2:1"]', { timeout: 15000 });
  assert.equal(await page.locator(".basmala").first().textContent(), BASMALA_FIXTURE);
  await page.locator("#surahJump").selectOption("9");
  await page.waitForSelector('.ayah[data-k="9:1"]');
  const headBefore9 = await page.evaluate(() => {
    const a = document.querySelector('.ayah[data-k="9:1"]'); const p = a.closest("p.text");
    return p.previousElementSibling && p.previousElementSibling.className;
  });
  assert.equal(headBefore9, "surah-head", "At-Tawbah must not get a Basmala line");
}));

/* ---------- navigation ---------- */
test("page buttons, arrow keys and the URL hash all turn pages", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#nextBtn");
  await page.waitForSelector('.ayah[data-k="2:1"]');
  assert.match(page.url(), /#p2$/);
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector(".folio").textContent === "٣");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".folio").textContent === "٢");
  assert.equal(await page.locator("#prevBtn").isDisabled(), false);
  await page.click("#prevBtn"); await page.waitForFunction(() => document.querySelector(".folio").textContent === "١");
  assert.equal(await page.locator("#prevBtn").isDisabled(), true);
}));

test("a page link followed while the app is still loading lands on that page", async () => {
  for (let i = 0; i < 3; i++) await withPage({}, async ({ page }) => {
    await page.evaluate(() => { location.hash = "#p300"; }); // fires during startup
    await page.waitForFunction(() => document.querySelector(".folio") && document.querySelector(".folio").textContent === "٣٠٠", null, { timeout: 15000 });
    assert.ok(await page.locator(".ayah").count() > 0);
  });
});

test("surah, juz and page-number jumps land on the right page", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.locator("#surahJump").selectOption("114");
  await page.waitForSelector('.ayah[data-k="114:6"]');
  assert.equal(await page.locator(".folio").textContent(), "٦٠٤");
  assert.equal(await page.locator("#nextBtn").isDisabled(), true);
  await page.fill("#pageJump", "300"); await page.press("#pageJump", "Enter"); await page.locator("#pageJump").blur();
  await page.waitForFunction(() => document.querySelector(".folio").textContent === "٣٠٠");
  await page.locator("#juzJump").selectOption("2");
  await page.waitForFunction(() => document.querySelector("#juzJump").value === "2");
  assert.match(await page.locator("#where").textContent(), /Juz 2/);
}));

test("every one of the 6,236 ayat is reachable on exactly one page", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  // walk all 604 pages through the UI's own page input and count ayat
  const total = await page.evaluate(async () => {
    const seen = new Set();
    for (let p = 1; p <= 604; p++) {
      location.hash = "#p" + p;
      await new Promise(r => { const t0 = Date.now(); (function w(){ const f=document.querySelector(".folio"); if (f && f.textContent === String(p).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[d])) r(); else if (Date.now()-t0>4000) r(); else setTimeout(w,5); })(); });
      document.querySelectorAll(".ayah").forEach(e => { if (seen.has(e.dataset.k)) throw new Error("duplicate " + e.dataset.k); seen.add(e.dataset.k); });
    }
    return seen.size;
  });
  assert.equal(total, COUNTS.reduce((a, b) => a + b, 0));
}));

/* ---------- translation ---------- */
test("translation panel lists each ayah on the page; Off hides it", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator(".trow").count(), 7);
  assert.equal(await page.locator(".trow p").first().textContent(), "EN 1:1");
  await page.click("#openSettings");
  await page.locator("#transSel").selectOption("none");
  await page.waitForFunction(() => document.getElementById("trans").hidden);
  await page.locator("#translit").check();
  await page.waitForSelector(".trow .tl");
  assert.equal(await page.locator(".trow .tl").first().textContent(), "TL 1:1");
}));

test("Urdu translation is loaded from its own file and shown right-to-left", () => withPage({}, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  await page.locator("#transSel").selectOption("ur");
  await page.waitForFunction(() => document.querySelector(".trow p") && document.querySelector(".trow p").textContent === "UR 1:1");
  assert.equal(await page.locator(".trow p").first().getAttribute("dir"), "rtl");
  assert.ok(log.requests.some(u => u.endsWith("/chapters/ur/1.json")));
}));

/* ---------- script styles ---------- */
test("each Mushaf script style changes the Quran font and is remembered", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  const styles = await page.locator("#scriptSeg button").count();
  assert.equal(styles, 5, "four Madani styles plus IndoPak");
  for (const [label, font] of [["Quranic Naskh","Scheherazade New"],["Classic Naskh","Amiri"],["Modern Naskh","Noto Naskh Arabic"],["Madani Mushaf","Amiri Quran"]]) {
    await page.locator("#scriptSeg button", { hasText: label }).click();
    assert.equal(await firstFont(page), font, label);
  }
  await page.locator("#scriptSeg button", { hasText: "Classic Naskh" }).click();
  await page.reload(); await page.waitForSelector(READY);
  assert.equal(await firstFont(page), "Amiri");
}));

/* ---------- bookmarks & highlights ---------- */
test("bookmark and highlight an ayah, see it in Saved, and keep it after reload", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:5"]');
  await page.locator("#sheet button", { hasText: "Bookmark" }).click();
  await page.waitForSelector('.ayah.bm[data-k="1:5"]');
  await page.locator("#sheet .swatch.green").click();
  await page.waitForSelector('.ayah[data-k="1:5"][data-hl="green"]');
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".ribbon").count(), 1);
  assert.equal(await page.locator("#markCount").textContent(), "1");
  await page.reload(); await page.waitForSelector('.ayah.bm[data-hl="green"][data-k="1:5"]', { timeout: 15000 });
  await page.click("#openMarks");
  assert.match(await page.locator(".bm-item").first().textContent(), /Al-Fatihah 1:5.*Bookmarked.*green highlight.*p\. 1/);
  await page.keyboard.press("Escape");
  await page.click('.ayah[data-k="1:5"]');
  await page.locator("#sheet button", { hasText: "Remove bookmark" }).click();
  await page.locator("#sheet .swatch.none").click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ribbon") && document.getElementById("markCount").textContent === "0");
}));

test("Saved list jumps to the bookmarked ayah's page", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p604");
  await page.waitForSelector('.ayah[data-k="114:1"]', { timeout: 15000 });
  await page.click('.ayah[data-k="114:1"]');
  await page.locator("#sheet button", { hasText: "Bookmark" }).click();
  await page.keyboard.press("Escape");
  await page.locator("#surahJump").selectOption("1");
  await page.waitForSelector('.ayah[data-k="1:1"]');
  await page.click("#openMarks");
  await page.locator(".bm-item").first().click();
  await page.waitForSelector('.ayah[data-k="114:1"]');
}));

/* ---------- recitation ---------- */
test("recitation plays from everyayah, moves to the next ayah, and turns the page", () => withPage({ audio: "ok" }, async ({ page, log }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:7"]');
  const req = page.waitForRequest("https://everyayah.com/data/Alafasy_128kbps/001007.mp3");
  await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForSelector('.ayah.playing[data-k="1:7"]');
  await req;
  // after 1:7 ends it continues with 2:1, which is on page 2
  await page.waitForSelector('.ayah.playing[data-k="2:1"]', { timeout: 10000 });
  assert.equal(await page.locator(".folio").textContent(), "٢");
  assert.match(await page.locator("#pTitle").textContent(), /Surah-2|Al-Baqarah/);
  await page.click("#playBtn"); // pause
  assert.equal(await page.locator("#playBtn").getAttribute("aria-label"), "Play recitation");
}));

test("changing reciter changes the audio folder", () => withPage({ audio: "ok" }, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#reciterBtn");
  await page.locator("#recSel").selectOption("Husary_64kbps");
  await page.keyboard.press("Escape");
  const req = page.waitForRequest("https://everyayah.com/data/Husary_64kbps/001001.mp3");
  await page.click("#playBtn");
  await page.waitForSelector(".ayah.playing");
  await req;
}));

test("when audio is blocked, the player offers a link to the ayah's audio", () => withPage({ audio: "404" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#playBtn");
  await page.waitForSelector("#pSub a");
  assert.equal(await page.locator("#pSub a").getAttribute("href"), "https://everyayah.com/data/Alafasy_128kbps/001001.mp3");
  assert.match(await page.locator("#pSub").textContent(), /blocked/);
}));

/* ---------- copy & layout ---------- */
test("Copy puts the exact Arabic text, translation and reference on the clipboard", () => withPage({}, async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://reader.test" });
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:2"]');
  await page.locator("#sheet button", { hasText: "Copy" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, arText(1, 2) + " ﴿٢﴾\nEN 1:2\n— Al-Fatihah 1:2");
}));

test("phone width: no sideways scrolling, controls fit", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p2");
  await page.waitForSelector('.ayah[data-k="2:1"]', { timeout: 15000 });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, "page scrolls sideways: " + sw + " > " + cw);
}, { width: 375, height: 760 }));

test("header links to the Muslim Companion app and still fits a small phone", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.getAttribute("#companionLink", "href"), "https://maazarif.github.io/muslim-companion/");
  assert.ok(await page.isVisible("#companionLink"), "link visible");
  const { sw, cw, bar } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    bar: Math.max(...[...document.querySelectorAll(".bar > *")].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().right)) }));
  assert.ok(sw <= cw, "page scrolls sideways: " + sw + " > " + cw);
  assert.ok(bar <= cw, "header overflows: " + bar + " > " + cw);
}, { width: 320, height: 640 }));

test("no script errors across a full session", () => withPage({ audio: "ok" }, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#nextBtn"); await page.waitForSelector('.ayah[data-k="2:1"]');
  await page.click("#openSettings"); await page.locator("#transSel").selectOption("fr"); await page.keyboard.press("Escape");
  await page.click('.ayah[data-k="2:2"]'); await page.locator("#sheet .swatch.blue").click(); await page.keyboard.press("Escape");
  await page.click("#openMarks"); await page.keyboard.press("Escape");
  assert.deepEqual(log.errors, []);
}));

/* ---------- go to an ayah number ---------- */
const flashOn = (page, k) => page.waitForFunction(k => { const e = document.querySelectorAll('.ayah[data-k="' + k + '"]'); return e.length && [...e].every(x => x.classList.contains("flash")); }, k, { timeout: 10000 });

test("Ayah number: choose a surah, type an ayah, and that ayah's page opens with the ayah marked", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.locator("#surahJump").selectOption("2");
  await page.waitForSelector('.ayah[data-k="2:1"]');
  assert.equal(await page.locator("#ayahJump").getAttribute("max"), "286");
  await page.fill("#ayahJump", "255"); await page.press("#ayahJump", "Enter");
  await flashOn(page, "2:255");
  assert.equal(await page.locator("#surahJump").inputValue(), "2");
  assert.equal(await page.locator("#ayahJump").inputValue(), "255");
  // Ayat al-Kursi is taller than a phone screen, so its start must come on screen (after the smooth scroll)
  const inView = await page.waitForFunction(() => { const r = document.querySelector('.ayah[data-k="2:255"]').getClientRects()[0]; return r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 4000 }).then(() => true, () => false);
  assert.ok(inView, "ayah scrolled into view");
}, { width: 390, height: 844 }));

test("Ayah number: too high a number goes to the surah's last ayah; changing surah resets the box", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.locator("#surahJump").selectOption("1");
  await page.fill("#ayahJump", "99"); await page.press("#ayahJump", "Enter");
  await flashOn(page, "1:7");
  assert.equal(await page.locator("#ayahJump").inputValue(), "7");
  await page.locator("#surahJump").selectOption("114");
  await page.waitForSelector('.ayah[data-k="114:1"]');
  assert.equal(await page.locator("#ayahJump").inputValue(), "");
  assert.equal(await page.locator("#ayahJump").getAttribute("max"), "6");
}));

test("Ayah number: the surah stays chosen when its first ayah is mid-page", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i1");
  await page.waitForSelector(".frame.ip", { timeout: 20000 });
  await page.locator("#surahJump").selectOption("114");
  await page.fill("#ayahJump", "4"); await page.press("#ayahJump", "Enter");
  await flashOn(page, "114:4");
  assert.equal(await page.locator(".folio").textContent(), "٦١٠");
  assert.equal(await page.locator("#surahJump").inputValue(), "114");
}));

test("Ayah number in IndoPak: Ayat al-Kursi opens page 42 with all its words marked", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i1");
  await page.waitForSelector(".frame.ip", { timeout: 20000 });
  await page.locator("#surahJump").selectOption("2");
  await page.waitForSelector('.ip .ayah[data-k="2:1"]');
  await page.fill("#ayahJump", "255"); await page.press("#ayahJump", "Enter");
  await flashOn(page, "2:255");
  assert.equal(await page.locator(".folio").textContent(), "٤٢");
}));

test("phone width: the four navigation boxes fit without sideways scrolling", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const r = await page.evaluate(() => ["surahJump","ayahJump","juzJump","pageJump"].map(id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.right, b.width]; }));
  for (const [l, rr, w] of r) { assert.ok(l >= 0 && rr <= 360, "box outside screen"); assert.ok(w >= 60, "box too narrow: " + w); }
}, { width: 360, height: 740 }));

/* ---------- Highlight mode: tap to highlight without the menu ---------- */
test("Highlight mode: a tap highlights the ayah straight away, with no menu; tapping again removes it", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#hlBtn");
  assert.equal(await page.locator("#hlbar").isVisible(), true);
  assert.equal(await page.locator('#hlColors .swatch.amber').getAttribute("aria-pressed"), "true", "amber is the default colour");
  await page.click('.ayah[data-k="1:3"]');
  await page.waitForSelector('.ayah[data-k="1:3"][data-hl="amber"]');
  assert.equal(await page.locator("#sheet").isVisible(), false, "no menu in Highlight mode");
  assert.equal(await page.locator('.trow[data-k="1:3"]').getAttribute("data-hl"), "amber", "translation row shows it too");
  assert.equal(await page.locator("#markCount").textContent(), "1");
  await page.click('.ayah[data-k="1:3"]');
  await page.waitForFunction(() => !document.querySelector('.ayah[data-k="1:3"]').dataset.hl);
  assert.equal(await page.locator("#markCount").textContent(), "0");
}));

test("Highlight mode: change colour, recolour an ayah, use the eraser; colours are kept after reload", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#hlBtn");
  await page.click("#hlColors .swatch.blue");
  await page.click('.ayah[data-k="1:2"]');
  await page.click('.ayah[data-k="1:4"]');
  await page.click("#hlColors .swatch.green");
  await page.click('.ayah[data-k="1:4"]');           // recolour
  await page.waitForSelector('.ayah[data-k="1:4"][data-hl="green"]');
  await page.click('.trow[data-k="1:6"]');            // from the translation list too
  await page.waitForSelector('.ayah[data-k="1:6"][data-hl="green"]');
  await page.click("#hlColors .swatch.none");         // eraser
  await page.click('.ayah[data-k="1:2"]');
  await page.waitForFunction(() => !document.querySelector('.ayah[data-k="1:2"]').dataset.hl);
  await page.reload(); await page.waitForSelector('.ayah[data-k="1:4"][data-hl="green"]', { timeout: 15000 });
  assert.equal(await page.locator('.ayah[data-k="1:6"]').getAttribute("data-hl"), "green");
  assert.equal(await page.locator('.ayah[data-k="1:2"]').getAttribute("data-hl"), null);
  await page.click("#hlBtn");
  assert.equal(await page.locator('#hlColors .swatch.green').getAttribute("aria-pressed"), "true", "last colour remembered; the eraser is not");
}));

test("Highlight mode: press and hold opens the full menu; Done brings back normal taps", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#hlBtn");
  const box = await page.locator('.ayah[data-k="1:5"] .end').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.waitForSelector("#sheet:not([hidden])");
  assert.match(await page.locator("#sheet h3").textContent(), /1:5/);
  assert.equal(await page.locator('.ayah[data-k="1:5"]').getAttribute("data-hl"), null, "holding doesn't also highlight");
  await page.keyboard.press("Escape");
  await page.click("#hlDone");
  assert.equal(await page.locator("#hlbar").isVisible(), false);
  await page.click('.ayah[data-k="1:5"]');
  await page.waitForSelector("#sheet:not([hidden])");
}));

test("Highlight mode in IndoPak: one tap highlights every word of the ayah", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await page.click("#hlBtn");
  await page.click("#hlColors .swatch.rose");
  const n = await page.locator('.ip .ayah[data-k="2:255"]').count();
  await page.locator('.ip .ayah[data-k="2:255"]').nth(5).click();
  await page.waitForFunction(n => document.querySelectorAll('.ip .ayah[data-k="2:255"][data-hl="rose"]').length === n, n);
  assert.equal(await page.locator("#sheet").isVisible(), false);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw);
}, { width: 390, height: 844 }));

test("Highlight mode: the colour bar doesn't cover the last line of the page on a phone", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector(".frame.ip .ipl", { timeout: 20000 });
  await page.click("#hlBtn");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const r = await page.evaluate(() => ({ folio: document.querySelector(".folio").getBoundingClientRect().bottom, bar: document.getElementById("hlbar").getBoundingClientRect().top }));
  assert.ok(r.folio <= r.bar, "page bottom " + r.folio + " is under the bar at " + r.bar);
}, { width: 390, height: 844 }));

/* ---------- reading mode (tap marks your place) and settings ---------- */
const openSettingsPick = async (page, seg, v) => { await page.click("#openSettings"); await page.locator("#" + seg + ' button[data-v="' + v + '"]').click(); await page.keyboard.press("Escape"); };
const curKeys = page => page.$$eval("#page .cur", e => [...new Set(e.map(x => x.dataset.k))]);
const hold = async (page, sel) => { const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); };

test("Reading mode (default): a tap marks one ayah; tapping another moves the mark; nothing is saved", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:2"]');
  assert.deepEqual(await curKeys(page), ["1:2"]);
  assert.equal(await page.locator("#sheet").isVisible(), false, "no popup");
  assert.match(await page.locator("#toast").textContent(), /hold an ayah/i);
  await page.click('.ayah[data-k="1:5"]');
  assert.deepEqual(await curKeys(page), ["1:5"], "only the latest ayah is marked");
  assert.equal(await page.locator("#page [data-hl]").count(), 0, "no lasting highlights made");
  assert.equal(await page.locator("#markCount").textContent(), "0");
  assert.equal(await page.locator('.trow.cur[data-k="1:5"]').count(), 1, "its translation is marked too");
  await page.click('.ayah[data-k="1:5"]');
  assert.deepEqual(await curKeys(page), [], "tapping it again clears the mark");
}));

test("Reading mode: holding opens the menu; your place is kept after reload and play starts there", () => withPage({ tap: "default", audio: "ok" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:3"]');
  await hold(page, '.ayah[data-k="1:4"] .end');
  await page.waitForSelector("#sheet:not([hidden])");
  assert.match(await page.locator("#sheet h3").textContent(), /1:4/);
  await page.keyboard.press("Escape");
  assert.deepEqual(await curKeys(page), ["1:3"], "holding doesn't move your place");
  await page.reload(); await page.waitForSelector('.ayah.cur[data-k="1:3"]', { timeout: 15000 });
  const req = page.waitForRequest(u => u.url().endsWith("/001003.mp3"));
  await page.click("#playBtn");
  await req;
}));

test("Reading mode works the same in IndoPak (every word of the ayah)", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await page.locator('.ip .ayah[data-k="2:254"]').nth(2).click();
  await page.locator('.ip .ayah[data-k="2:255"]').nth(4).click();
  assert.deepEqual(await curKeys(page), ["2:255"]);
  const n = await page.locator('.ip .ayah[data-k="2:255"]').count();
  assert.equal(await page.locator('.ip .ayah.cur[data-k="2:255"]').count(), n);
  assert.equal(await page.locator("#page [data-hl]").count(), 0);
}));

test("Settings: 'Tapping an ayah' switches between marking your place and the menu, and is remembered", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  assert.equal(await page.locator('#tapSeg button[data-v="mark"]').getAttribute("aria-pressed"), "true");
  await page.locator('#tapSeg button[data-v="menu"]').click();
  await page.keyboard.press("Escape");
  await page.click('.ayah[data-k="1:3"]');
  await page.waitForSelector("#sheet:not([hidden])");
  await page.keyboard.press("Escape");
  await page.reload(); await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:3"]');
  await page.waitForSelector("#sheet:not([hidden])");
  await page.keyboard.press("Escape");
  await openSettingsPick(page, "tapSeg", "mark");
  await page.click('.ayah[data-k="1:6"]');
  assert.deepEqual(await curKeys(page), ["1:6"]);
}));

test("Upgrade: anyone on yesterday's 'tap highlights' setting gets the place mark, not more lasting highlights", () => withPage({ tap: "highlight" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click('.ayah[data-k="1:2"]'); await page.click('.ayah[data-k="1:4"]');
  assert.equal(await page.locator("#page [data-hl]").count(), 0);
  assert.deepEqual(await curKeys(page), ["1:4"]);
}));

test("Highlighter button: lasting highlights in the colour chosen in settings", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  await page.locator('#hlColorSet .swatch.blue').click();
  await page.keyboard.press("Escape");
  await page.click("#hlBtn");
  await page.click('.ayah[data-k="1:6"]'); await page.click('.ayah[data-k="1:7"]');
  await page.waitForSelector('.ayah[data-k="1:6"][data-hl="blue"]');
  await page.waitForSelector('.ayah[data-k="1:7"][data-hl="blue"]');
  await page.click("#hlDone");
  await page.click('.ayah[data-k="1:2"]');
  assert.deepEqual(await curKeys(page), ["1:2"], "after Done, taps mark your place again");
  assert.equal(await page.locator("#page [data-hl]").count(), 2, "lasting highlights stay");
}));

test("Saved: 'Remove all highlights' asks first, then clears highlights and keeps bookmarks", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#hlBtn");
  for (const k of ["1:2", "1:3", "1:5"]) await page.click('.ayah[data-k="' + k + '"]');
  await page.click("#hlDone");
  await page.click('.ayah[data-k="1:6"]');
  await page.locator("#sheet button", { hasText: "Bookmark" }).click();
  await page.keyboard.press("Escape");
  await page.click("#openMarks");
  await page.click("#clearHl");
  assert.match(await page.locator(".clearhl").textContent(), /Remove 3 highlights\? Bookmarks stay/);
  assert.equal(await page.locator("#page [data-hl]").count(), 3, "nothing removed before confirming");
  await page.click("#clearHlYes");
  await page.waitForFunction(() => !document.querySelector("#page [data-hl]"));
  assert.equal(await page.locator(".bm-item").count(), 1);
  assert.match(await page.locator(".bm-item").textContent(), /1:6.*Bookmarked/);
  assert.equal(await page.locator("#clearHl").count(), 0);
  await page.reload(); await page.waitForSelector('.ayah.bm[data-k="1:6"]', { timeout: 15000 });
  assert.equal(await page.locator("#page [data-hl]").count(), 0);
}));

/* ---------- side by side layout ---------- */
const rowsOn = page => page.$$eval(".vrow", rs => rs.map(r => { const t = r.querySelector(".vtr").getBoundingClientRect(), a = r.querySelector(".var").getBoundingClientRect();
  return { k: r.dataset.k, trLeft: t.left, arLeft: a.left, ar: r.querySelector(".var").textContent, tr: [...r.querySelectorAll(".vtr p:not(.tl)")].map(p => p.textContent).join() }; }));

test("Side by side: every ayah of the page on its own row, translation on the left, exact Arabic on the right", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p2");
  await page.waitForSelector('.ayah[data-k="2:1"]', { timeout: 15000 });
  const keys = await page.$$eval(".ayah", e => e.map(x => x.dataset.k));
  await openSettingsPick(page, "layoutSeg", "side");
  await page.waitForSelector(".frame.rows .vrow");
  const rows = await rowsOn(page);
  assert.deepEqual(rows.map(r => r.k), keys, "same ayat as the Mushaf page");
  for (const r of rows) {
    const [s, a] = r.k.split(":").map(Number);
    assert.ok(r.trLeft < r.arLeft, "translation is left of the Arabic for " + r.k);
    assert.equal(r.ar, arText(s, a) + " ﴿" + String(a).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]) + "﴾");
    assert.equal(r.tr, "EN " + r.k);
  }
  assert.equal(await page.locator("#trans").isVisible(), false, "no second translation list below");
  assert.equal(await page.locator(".surah-head").count(), 1);
  assert.equal(await page.locator(".basmala").count(), 1);
  await page.reload();
  await page.waitForSelector(".frame.rows .vrow", { timeout: 15000 });
}, { width: 390, height: 844 }));

test("Side by side in IndoPak: the Arabic is the exact IndoPak words; nothing spills off a small phone", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await openSettingsPick(page, "layoutSeg", "side");
  await page.waitForSelector(".frame.rows .vrow");
  const rows = await rowsOn(page);
  const want = {}; for (const [loc, t] of ipWordsOn(42)) { const k = loc.split(":").slice(0, 2).join(":"); (want[k] ||= []).push(t); }
  assert.deepEqual(rows.map(r => r.k), Object.keys(want));
  for (const r of rows) assert.equal(r.ar, want[r.k].join(" "), r.k);
  assert.equal(await page.$eval(".vrow .var", e => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "")), "IP Normal");
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, "sideways scroll");
  const out = await page.evaluate(() => { const b = document.querySelector(".frame.rows .body").getBoundingClientRect(); return [...document.querySelectorAll(".vrow .var,.vrow .vtr")].filter(e => { const r = e.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1; }).length; });
  assert.equal(out, 0);
}, { width: 360, height: 740 }));

test("Side by side: tap marks the row, recitation follows rows across pages, go-to-ayah marks the row", () => withPage({ tap: "default", audio: "ok" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await openSettingsPick(page, "layoutSeg", "side");
  await page.click('.vrow[data-k="1:5"]');
  await page.click('.vrow[data-k="1:6"]');
  assert.deepEqual(await curKeys(page), ["1:6"]);
  assert.equal(await page.locator("#page [data-hl]").count(), 0);
  assert.equal(await page.locator("#sheet").isVisible(), false);
  const box = await page.locator('.vrow[data-k="1:7"]').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForSelector('.vrow.playing[data-k="1:7"]');
  await page.waitForSelector('.vrow.playing[data-k="2:1"]', { timeout: 10000 });
  await page.click("#playBtn");
  await page.locator("#surahJump").selectOption("2");
  await page.fill("#ayahJump", "5"); await page.press("#ayahJump", "Enter");
  await page.waitForSelector('.vrow.flash[data-k="2:5"]', { timeout: 10000 });
}));

test("Side by side with translation off: Arabic rows plus a hint to choose a translation", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  await page.locator("#transSel").selectOption("none");
  await page.locator('#layoutSeg button[data-v="side"]').click();
  await page.keyboard.press("Escape");
  await page.waitForSelector(".frame.rows .vrow");
  assert.match(await page.locator(".frame.rows .empty").textContent(), /Choose a translation/);
  assert.equal(await page.locator(".vrow").count(), 7);
}));

/* ---------- IndoPak edition (real bundled text and fonts) ---------- */
import { readFileSync } from "node:fs";
const IPDATA = JSON.parse(readFileSync(new URL("../data/indopak-15-lines.json", import.meta.url), "utf8"));
const ipWordsOn = p => IPDATA[p-1].flatMap(l => l.t === "w" ? l.w : []);
const pickIndopak = async page => {
  await page.click("#openSettings");
  await page.locator('.seg button[data-script="indopak"]').click();
  await page.waitForSelector(".frame.ip .ipl", { timeout: 20000 });
  await page.keyboard.press("Escape");
};

test("IndoPak: choosing it shows 15-line pages from a 610-page Mushaf", () => withPage({}, async ({ page, log }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await pickIndopak(page);
  assert.equal(await page.locator(".ipl").count(), 15);
  assert.match(await page.locator("#where").textContent(), /Page 1 of 610/);
  assert.match(page.url(), /#i1$/);
  await page.click("#nextBtn"); await page.waitForFunction(() => document.querySelector(".folio").textContent === "٢");
  assert.equal(await page.locator(".ipl").count(), 15);
  assert.deepEqual(log.errors, []);
}));

test("IndoPak: every word on sample pages is exactly the source text, in order", () => withPage({}, async ({ page }) => {
  for (const p of [1, 2, 42, 302, 586, 610]) {
    await page.goto(PAGE_URL + "#i" + p);
    await page.waitForFunction(n => document.querySelector(".frame.ip .folio") && document.querySelector(".frame.ip .folio").textContent === String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]), p, { timeout: 20000 });
    const shown = await page.$$eval(".ip .ayah", els => els.map(e => [e.dataset.k, e.textContent]));
    const src = ipWordsOn(p).map(([loc, t]) => [loc.split(":").slice(0, 2).join(":"), t]);
    assert.deepEqual(shown, src, "page " + p);
  }
}));

test("IndoPak: lines match the printed page — same 15 lines, same words per line", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  const perLine = await page.$$eval(".ipl", ls => ls.map(l => l.querySelectorAll(".ayah").length));
  assert.deepEqual(perLine, IPDATA[41].map(l => l.t === "w" ? l.w.length : 0));
}));

test("IndoPak: Bismillah lines use the source's own words of 1:1, and At-Tawbah has none", () => withPage({}, async ({ page }) => {
  const bism = ipWordsOn(1).filter(([loc]) => /^1:1:[1-4]$/.test(loc)).map(x => x[1]);
  await page.goto(PAGE_URL + "#i2");
  await page.waitForSelector(".ipl.ipb", { timeout: 20000 });
  assert.deepEqual(await page.$$eval(".ipl.ipb .w", ws => ws.map(w => w.textContent)), bism);
  const p9 = IPDATA.findIndex(pg => pg.some(l => l.t === "s" && l.s === 9)) + 1;
  await page.goto(PAGE_URL + "#i" + p9);
  await page.waitForSelector(".ipl.ips", { timeout: 20000 });
  const order = await page.$$eval(".ipl", ls => ls.map(l => l.className));
  const i9 = IPDATA[p9-1].findIndex(l => l.t === "s" && l.s === 9);
  assert.ok(!/ipb/.test(order[i9 + 1] || ""), "no Bismillah line after the At-Tawbah header");
}));

test("IndoPak: known pages of the printed copy — Ayat al-Kursi p42, Juz 30 p586, An-Nas p610", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i1");
  await page.waitForSelector(".frame.ip", { timeout: 20000 });
  await page.locator("#juzJump").selectOption("30");
  await page.waitForFunction(() => document.querySelector(".folio").textContent === "٥٨٦");
  await page.locator("#surahJump").selectOption("114");
  await page.waitForSelector('.ip .ayah[data-k="114:6"]');
  assert.equal(await page.locator(".folio").textContent(), "٦١٠");
  assert.equal(await page.locator("#nextBtn").isDisabled(), true);
  await page.fill("#pageJump", "42"); await page.locator("#pageJump").blur();
  await page.waitForSelector('.ip .ayah[data-k="2:255"]');
}));

test("IndoPak: the font draws the ayah-number glyphs (not blank boxes)", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i1");
  await page.waitForSelector(".frame.ip .ayah", { timeout: 20000 });
  const r = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("2d");
    const wOf = f => { c.font = '40px ' + f; return c.measureText("").width; };
    return { loaded: document.fonts.check('40px "IP Normal"', ""), ip: wOf('"IP Normal"'), fallback: wOf("monospace") };
  });
  assert.ok(r.loaded, "IndoPak font not loaded");
  assert.notEqual(Math.round(r.ip), Math.round(r.fallback), "ayah markers would fall back to another font");
}));

test("IndoPak: no line spills outside the page at phone and desktop widths", async () => {
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 1100, height: 900 }]) await withPage({}, async ({ page }) => {
    for (const p of [3, 42, 200, 500]) {
      await page.goto(PAGE_URL + "#i" + p);
      await page.waitForFunction(n => document.querySelector(".frame.ip .folio") && document.querySelector(".frame.ip .folio").textContent === String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]), p, { timeout: 20000 });
      const bad = await page.evaluate(() => [...document.querySelectorAll(".ipl")].filter(l => { const b = l.getBoundingClientRect(), body = l.parentElement.getBoundingClientRect(); return [...l.children].some(c => { const r = c.getBoundingClientRect(); return r.left < body.left - 1 || r.right > body.right + 1; }); }).length);
      assert.equal(bad, 0, "page " + p + " at " + vp.width + "px");
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(sw <= cw, "page scrolls sideways at " + vp.width + "px");
    }
  }, vp);
});

test("IndoPak: switching editions keeps your place", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#p300");
  await page.waitForFunction(() => document.querySelector(".folio") && document.querySelector(".folio").textContent === "٣٠٠", null, { timeout: 15000 });
  const first = await page.$eval(".ayah", e => e.dataset.k);
  await pickIndopak(page);
  assert.equal(await page.locator('.ip .ayah[data-k="' + first + '"]').count() > 0, true, first + " not on the IndoPak page");
  await page.click("#openSettings");
  await page.locator('.seg button[data-script="amiriq"]').click();
  await page.waitForSelector(".frame:not(.ip) .ayah");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('.ayah[data-k="' + first + '"]').count(), 1);
}));

test("IndoPak: tapping a word selects the whole ayah; highlight and bookmark cover every word", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  const n = await page.locator('.ip .ayah[data-k="2:255"]').count();
  await page.locator('.ip .ayah[data-k="2:255"]').nth(3).click();
  assert.equal(await page.locator('.ip .ayah.sel[data-k="2:255"]').count(), n);
  assert.match(await page.locator("#sheet h3").textContent(), /2:255 · page 42/);
  assert.deepEqual(await page.$$eval("#sheet .ipar span", s => s.map(x => x.textContent)), ipWordsOn(42).filter(([l]) => l.startsWith("2:255:")).map(x => x[1]));
  await page.locator("#sheet .swatch.blue").click();
  await page.waitForFunction(n => document.querySelectorAll('.ip .ayah[data-hl="blue"][data-k="2:255"]').length === n, n);
  await page.locator("#sheet button", { hasText: "Bookmark" }).click();
  await page.waitForSelector('.ip .ayah.bm.endw[data-k="2:255"]');
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".ribbon").count(), 1);
  await page.reload();
  await page.waitForSelector('.ip .ayah[data-hl="blue"][data-k="2:255"]', { timeout: 20000 });
  await page.click("#openMarks");
  assert.match(await page.locator(".bm-item").first().textContent(), /2:255.*p\. 42/);
}));

test("IndoPak: Copy gives the standard Unicode text that other apps can show", () => withPage({}, async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://reader.test" });
  await page.goto(PAGE_URL + "#i1");
  await page.waitForSelector('.ip .ayah[data-k="1:2"]', { timeout: 20000 });
  await page.locator('.ip .ayah[data-k="1:2"]').first().click();
  await page.locator("#sheet button", { hasText: "Copy" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, arText(1, 2) + " ﴿٢﴾\nEN 1:2\n— Al-Fatihah 1:2");
  assert.ok(!/[-]/.test(clip), "clipboard must not contain font-only characters");
}));

test("IndoPak: recitation highlights each ayah's words and turns the IndoPak page", () => withPage({ audio: "ok" }, async ({ page }) => {
  // in the 15-line copy, 2:4 ends page 2 and 2:5 starts page 3
  assert.equal(IPDATA[2].find(l => l.t === "w").w[0][0], "2:5:1");
  await page.goto(PAGE_URL + "#i2");
  await page.waitForSelector('.ip .ayah[data-k="2:4"]', { timeout: 20000 });
  await page.locator('.ip .ayah[data-k="2:4"]').first().click();
  await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForFunction(() => { const w = document.querySelectorAll('.ip .ayah[data-k="2:4"]'); return w.length && [...w].every(x => x.classList.contains("playing")); });
  await page.waitForSelector('.ip .ayah.playing[data-k="2:5"]', { timeout: 10000 });
  assert.equal(await page.locator(".folio").textContent(), "٣");
}));

test("IndoPak data: every page ends at the end of an ayah, like the printed Taj copy", () => {
  const COUNT_OF = Object.fromEntries(COUNTS.map((c,i)=>[i+1,c]));
  const lastWordOf = {};
  for (let p = 1; p <= 610; p++) for (const [loc] of ipWordsOn(p)) { const [s,a,w] = loc.split(":").map(Number); lastWordOf[s+":"+a] = w; }
  for (let p = 1; p <= 610; p++) {
    const [s,a,w] = ipWordsOn(p).at(-1)[0].split(":").map(Number);
    assert.equal(w, lastWordOf[s+":"+a], "page " + p + " ends mid-ayah " + s + ":" + a);
  }
  assert.equal(Object.keys(lastWordOf).length, COUNTS.reduce((x,y)=>x+y,0));
});

test("IndoPak: a #i link opens that IndoPak page, a #p link the Madani page", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i586");
  await page.waitForFunction(() => document.querySelector(".frame.ip .folio") && document.querySelector(".frame.ip .folio").textContent === "٥٨٦", null, { timeout: 20000 });
  await page.evaluate(() => { location.hash = "#p42"; });
  await page.waitForFunction(() => document.querySelector(".frame:not(.ip) .folio") && document.querySelector(".folio").textContent === "٤٢", null, { timeout: 20000 });
}));

test("IndoPak: still readable when translations can't load", () => withPage({ text: "404" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  assert.match(await page.locator("#trans").textContent(), /translation didn't load/);
}));

test("IndoPak: settings show the IndoPak sample in its own font", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  const sample = page.locator('.seg button[data-script="indopak"] .sample');
  await page.waitForFunction(() => document.querySelector('.seg button[data-script="indopak"] .sample').textContent.length > 0);
  assert.equal(await sample.textContent(), ipWordsOn(1).filter(([l]) => /^1:1:[1-4]$/.test(l)).map(x => x[1]).join(" "));
  await page.locator('.seg button[data-script="indopak"]').click();
  await page.waitForSelector('.seg button[data-script="indopak"][aria-pressed="true"]', { timeout: 20000 });
  assert.equal(await page.locator("#ipsize").isEnabled(), true);
}));

const setIpSize = async (page, v) => {
  await page.click("#openSettings");
  await page.locator("#ipsize").fill(String(v));
  await page.keyboard.press("Escape");
};
const wordsShown = page => page.$$eval(".ip .ayah", els => els.map(e => [e.dataset.k, e.textContent]));

test("IndoPak text size: larger text wraps the same words, in the same order, without leaving the page", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  const before = await page.$eval(".ip .ayah", e => parseFloat(getComputedStyle(e).fontSize));
  const src = ipWordsOn(42).map(([loc, t]) => [loc.split(":").slice(0, 2).join(":"), t]);
  await setIpSize(page, 1.6);
  await page.waitForSelector(".ipflow .ayah", { timeout: 10000 });
  const after = await page.$eval(".ip .ayah", e => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(after > before * 1.5, "text got larger: " + before + " → " + after);
  assert.deepEqual(await wordsShown(page), src, "same words, same order");
  const out = await page.evaluate(() => { const b = document.querySelector(".frame.ip .body").getBoundingClientRect();
    return [...document.querySelectorAll(".ip .ayah")].filter(w => { const r = w.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1; }).length; });
  assert.equal(out, 0, "no word outside the page");
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, "page scrolls sideways");
}, { width: 390, height: 844 }));

test("IndoPak text size: remembered after reload; smallest setting brings back the printed 15 lines", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await setIpSize(page, 1.4);
  await page.waitForSelector(".ipflow .ayah");
  await page.reload();
  await page.waitForSelector(".ipflow .ayah", { timeout: 20000 });
  await page.click("#openSettings");
  assert.equal(await page.locator("#ipsize").inputValue(), "1.4");
  assert.match(await page.locator("#ipsizeNote").textContent(), /lines wrap/);
  await page.locator("#ipsize").fill("1");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelectorAll(".ipl").length === 15 && !document.querySelector(".ipflow"));
  const perLine = await page.$$eval(".ipl", ls => ls.map(l => l.querySelectorAll(".ayah").length));
  assert.deepEqual(perLine, IPDATA[41].map(l => l.t === "w" ? l.w.length : 0));
}));

test("IndoPak text size: surah headers, Bismillah, highlights and recitation still work in larger text", () => withPage({ audio: "ok" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#i604");
  await page.waitForSelector(".frame.ip .ipl.ips", { timeout: 20000 });
  const heads = await page.locator(".ipl.ips").count();
  await setIpSize(page, 1.8);
  await page.waitForSelector(".ipflow .ayah");
  assert.equal(await page.locator(".ipl.ips").count(), heads);
  assert.equal(await page.locator(".ipflow.ipb").count(), IPDATA[603].filter(l => l.t === "b").length);
  await page.locator('.ip .ayah[data-k="97:1"]').first().click();
  await page.locator("#sheet .swatch.rose").click();
  await page.waitForSelector('.ip .ayah[data-hl="rose"][data-k="97:1"]');
  await page.keyboard.press("Escape");
  await page.locator('.ip .ayah[data-k="97:1"]').first().click();
  await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForSelector('.ip .ayah.playing[data-k="97:2"]', { timeout: 10000 });
}));

test("Madani text size slider still works and doesn't change IndoPak's", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  await page.locator("#size").fill("2.4");
  const fs = await page.$eval(".ayah", e => getComputedStyle(e).fontSize);
  assert.equal(fs, (2.4 * 16) + "px");
  await page.locator('.seg button[data-script="indopak"]').click();
  await page.waitForSelector("#ipsize", { timeout: 20000 });
  assert.equal(await page.locator("#ipsize").inputValue(), "1");
  assert.equal(await page.locator("#size").count(), 0);
}));

test("IndoPak: reopens offline after it has been read once", () => withPage({ sw: true }, async ({ page, context }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForSelector('.ip .ayah[data-k="2:255"]', { timeout: 20000 });
  await page.waitForTimeout(500);
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.setOffline(true);
  await page.goto(PAGE_URL + "#i43");
  await page.waitForFunction(() => document.querySelector(".frame.ip .folio") && document.querySelector(".frame.ip .folio").textContent === "٤٣", null, { timeout: 20000 });
  assert.ok(await page.evaluate(() => document.fonts.check('40px "IP Normal"', "")));
}));

/* ---------- recitation: one recording per surah, following the ayat ---------- */
const TIM = id => JSON.parse(readFileSync(new URL("../data/timings/" + id + ".json", import.meta.url), "utf8"));
const AFASY = TIM("Alafasy_128kbps");
const startOf = (T, s, a) => T.ayat[s].find(r => r.length === 3 && r[0] === a)[1] / 1000;
const SURAH = { timings: "ok", audio: "ok" };
const playingKey = page => page.$eval("#page .playing", e => e.dataset.k).catch(() => null);
const audioState = page => page.evaluate(() => ({ src: mushafAudio.src, paused: mushafAudio.paused, t: mushafAudio.currentTime }));
// wait until the recording has loaded and is playing, then jump within it
const moveTo = async (page, sec) => {
  await page.waitForFunction(() => mushafAudio.readyState >= 2 && !mushafAudio.paused, null, { timeout: 8000 });
  await page.evaluate(sec => { mushafAudio.currentTime = sec; }, sec);
};
const playFromSheet = async (page, sel) => { await page.locator(sel).first().click(); await page.locator("#sheet button", { hasText: "Play from here" }).click(); };

test("Recitation plays the whole surah as one recording (keeps going with the screen locked)", () => withPage(SURAH, async ({ page, log }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  const req = page.waitForRequest(AFASY.audio["1"]);
  await page.click("#playBtn");
  await req;
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.waitForFunction(() => /screen locked/.test(document.getElementById("pSub").textContent));
  assert.ok(!log.requests.some(u => u.includes("everyayah.com")), "no per-ayah files");
}));

test("Recitation follows the ayat inside the recording without changing files", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  const before = await audioState(page);
  for (const a of [4, 6, 2]) {
    await moveTo(page, startOf(AFASY, 1, a) + 0.3);
    await page.waitForSelector('#page .playing[data-k="1:' + a + '"]', { timeout: 5000 });
  }
  const after = await audioState(page);
  assert.equal(after.src, before.src, "same recording throughout");
  assert.equal(after.paused, false);
  assert.match(await page.locator("#pTitle").textContent(), /1:2/);
  assert.match(await page.evaluate(() => navigator.mediaSession.metadata && navigator.mediaSession.metadata.title), /1:2/, "lock screen shows the ayah");
}));

test("Play from here starts at that ayah's time in the recording", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await playFromSheet(page, '.ayah[data-k="1:5"]');
  await page.waitForSelector('#page .playing[data-k="1:5"]');
  await page.waitForFunction(t => Math.abs(mushafAudio.currentTime - t) < 0.6 && !mushafAudio.paused, startOf(AFASY, 1, 5));
}));

test("Recitation turns the IndoPak page mid-surah while the same recording keeps playing", () => withPage(SURAH, async ({ page }) => {
  // an IndoPak page break inside one surah, early enough in the recording for the stand-in audio
  let found = null;
  for (let p = 2; p < 610 && !found; p++) {
    const last = ipWordsOn(p).at(-1)[0].split(":").map(Number), next = ipWordsOn(p + 1)[0][0].split(":").map(Number);
    if (last[0] === next[0] && startOf(AFASY, next[0], next[1]) < 1700 && last[0] > 2) found = { p, k1: last[0] + ":" + last[1], k2: next[0] + ":" + next[1], s: next[0], a: next[1] };
  }
  assert.ok(found, "page break inside a surah");
  await page.goto(PAGE_URL + "#i" + found.p);
  await page.waitForSelector('.ip .ayah[data-k="' + found.k1 + '"]', { timeout: 20000 });
  await playFromSheet(page, '.ip .ayah[data-k="' + found.k1 + '"]');
  await page.waitForSelector('#page .playing[data-k="' + found.k1 + '"]');
  const src = (await audioState(page)).src;
  await moveTo(page, startOf(AFASY, found.s, found.a) + 0.3);
  await page.waitForSelector('#page .playing[data-k="' + found.k2 + '"]', { timeout: 8000 });
  assert.equal(await page.locator(".folio").textContent(), String(found.p + 1).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]));
  const st = await audioState(page);
  assert.equal(st.src, src); assert.equal(st.paused, false);
}));

test("At the end of a surah, recitation carries on with the next surah's recording", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  const req = page.waitForRequest(AFASY.audio["2"]);
  await page.evaluate(() => mushafAudio.dispatchEvent(new Event("ended")));
  await req;
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 8000 });
}));

test("Where a reciter repeats an ayah, the repeated ayah is marked again", () => withPage(SURAH, async ({ page }) => {
  let pick = null;
  for (const id of ["Alafasy_128kbps", "Husary_64kbps", "Minshawy_Murattal_128kbps", "Abdul_Basit_Murattal_64kbps", "Abdurrahmaan_As-Sudais_192kbps", "Saood_ash-Shuraym_128kbps", "Abu_Bakr_Ash-Shaatree_128kbps", "Hani_Rifai_192kbps"]) {
    const T = TIM(id);
    for (const s in T.ayat) { const rep = T.ayat[s].find(r => r.length === 4 && r[2] < 1700000 && r[0] > 1); if (rep && !pick) pick = { id, s: +s, rep }; }
  }
  if (!pick) return; // no repeats early enough in any recording to test with the stand-in audio
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings"); await page.locator("#recSel").selectOption(pick.id); await page.keyboard.press("Escape");
  await page.locator("#surahJump").selectOption(String(pick.s));
  await page.waitForSelector('#page [data-k="' + pick.s + ':1"]', { timeout: 15000 });
  await playFromSheet(page, '#page [data-k="' + pick.s + ':1"]');
  await page.waitForSelector('#page .playing[data-k="' + pick.s + ':1"]');
  await moveTo(page, (pick.rep[1] + pick.rep[2]) / 2000);
  await page.waitForSelector('#page .playing[data-k="' + pick.s + ":" + pick.rep[0] + '"]', { timeout: 8000 });
}));

test("If the surah recording can't load, recitation falls back to one file per ayah", () => withPage({ timings: "ok", audio: "ok", surahAudio: "404" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  const req = page.waitForRequest("https://everyayah.com/data/Alafasy_128kbps/001001.mp3");
  await page.click("#playBtn");
  await req;
  await page.waitForFunction(() => /ayah by ayah/.test(document.getElementById("pSub").textContent));
}));

test("Without timing data, recitation still works ayah by ayah", () => withPage({ timings: "404", audio: "ok" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const req = page.waitForRequest("https://everyayah.com/data/Alafasy_128kbps/001001.mp3");
  await page.click("#playBtn");
  await req;
}));

test("Changing reciter while reciting continues from the same ayah in the new recording", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await playFromSheet(page, '.ayah[data-k="1:3"]');
  await page.waitForSelector('#page .playing[data-k="1:3"]');
  const HUS = TIM("Husary_64kbps");
  const req = page.waitForRequest(HUS.audio["1"]);
  await page.click("#reciterBtn"); await page.locator("#recSel").selectOption("Husary_64kbps"); await page.keyboard.press("Escape");
  await req;
  await page.waitForFunction(t => Math.abs(mushafAudio.currentTime - t) < 0.6 && !mushafAudio.paused, startOf(HUS, 1, 3));
  assert.match(await page.locator("#pTitle").textContent(), /1:3 · Mahmoud Khalil Al-Husary/);
}));

test("Every reciter's timing file covers all 114 surahs with its own recording", () => {
  for (const id of ["Alafasy_128kbps", "Husary_64kbps", "Minshawy_Murattal_128kbps", "Abdul_Basit_Murattal_64kbps", "Abdurrahmaan_As-Sudais_192kbps", "Saood_ash-Shuraym_128kbps", "Abu_Bakr_Ash-Shaatree_128kbps", "Hani_Rifai_192kbps"]) {
    const T = TIM(id);
    assert.equal(Object.keys(T.audio).length, 114, id);
    assert.equal(new Set(Object.values(T.audio)).size, 114, id);
    let n = 0;
    for (let s = 1; s <= 114; s++) { const can = T.ayat[s].filter(r => r.length === 3); n += can.length; can.forEach((r, i) => { if (i) assert.ok(r[1] >= can[i - 1][1], id + " " + s); }); }
    assert.equal(n + T.missing.length, 6236, id);
  }
});

test("Settings: 'Keep the screen on while reciting' is remembered", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  assert.equal(await page.locator("#wakeChk").isChecked(), false);
  await page.locator("#wakeChk").check();
  await page.reload(); await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  assert.equal(await page.locator("#wakeChk").isChecked(), true);
}));

/* ---------- uninterrupted playback (driving, workouts): what keeps an iPhone playing when locked ---------- */
// record the audio element's events, and what the app asks of the lock screen and the audio session
const SPY = () => {
  window.__ev = []; window.__handlers = {}; window.__handlerLog = [];
  navigator.audioSession = { type: "auto" };
  if (navigator.mediaSession) { const orig = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (a, f) => { window.__handlers[a] = f; window.__handlerLog.push(a + (f ? "" : ":null")); try { orig(a, f); } catch (e) {} }; }
  const watch = () => { if (!window.mushafAudio) return setTimeout(watch, 20);
    for (const e of ["ended", "pause", "play", "playing", "emptied"]) mushafAudio.addEventListener(e, () => __ev.push(e + "@" + mushafAudio.src.split("/").pop()));
    // a src change cancels the queued "pause" event, so record the call itself
    mushafAudio.pause = function () { __ev.push("pause()@" + this.src.split("/").pop()); return HTMLMediaElement.prototype.pause.call(this); }; };
  watch();
};
const spyPage = async (page, url) => { await page.addInitScript(SPY); await page.goto(url); await page.reload(); await page.waitForSelector(READY, { timeout: 15000 }); };
const lastEnd = (T, s) => Math.max(...T.ayat[s].map(r => r[2])) / 1000;

test("Non-stop: one surah runs into the next without the audio ever reaching an end", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  assert.equal(await page.evaluate(() => mushafAudio.loop), true, "set to loop, so it never ends on its own");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
  await page.waitForFunction(() => !mushafAudio.paused);
  const ev = await page.evaluate(() => __ev);
  assert.ok(!ev.some(e => e.startsWith("ended")), "no natural end: " + ev.join(","));
  const iPause = ev.findIndex(e => e === "pause()@001.mp3"), iSwitch = ev.findIndex(e => e === "emptied@002.mp3"), iPlay2 = ev.findIndex(e => e === "play@002.mp3");
  assert.ok(iPause >= 0 && iSwitch > iPause && iPlay2 > iSwitch, "paused, switched, then played the next surah: " + ev.join(","));
}));

test("Non-stop: ayah-by-ayah playback also never reaches an end", () => withPage({ timings: "404", audio: "ok" }, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.click('.ayah[data-k="1:6"]'); await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 15000 });
  const ev = await page.evaluate(() => __ev);
  assert.ok(!ev.some(e => e.startsWith("ended")), ev.join(","));
}));

test("Non-stop: if a recording does run to its end, the loop's jump back is treated as the end", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#playBtn");
  await moveTo(page, 20);
  await page.waitForTimeout(1200);
  const req = page.waitForRequest(AFASY.audio["2"]);
  await page.evaluate(() => { mushafAudio.currentTime = 0.1; });   // what looping does at the end of a file
  await req;
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 8000 });
}));

test("Non-stop: jumping back to an earlier ayah is not mistaken for the end of the surah", () => withPage(SURAH, async ({ page, log }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await playFromSheet(page, '.ayah[data-k="1:6"]');
  await page.waitForFunction(() => mushafAudio.readyState >= 2 && mushafAudio.currentTime > 3);
  await playFromSheet(page, '.ayah[data-k="1:1"]');
  await page.waitForTimeout(1500);
  assert.equal(await playingKey(page), "1:1");
  assert.match((await audioState(page)).src, /001\.mp3$/);
}));

test("Non-stop: the next surah's recording is fetched ahead of time", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  const req = page.waitForRequest(AFASY.audio["2"], { timeout: 8000 });
  await page.click("#playBtn");
  await req;
  assert.match(await playingKey(page), /^1:/, "fetched while still reciting Al-Fatihah");
}));

test("After a surah: 'Repeat the surah' starts it again; 'Stop' stops", () => withPage(SURAH, async ({ page }) => {
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#reciterBtn"); await page.locator("#afterSel").selectOption("repeat"); await page.keyboard.press("Escape");
  await page.click("#playBtn");
  await moveTo(page, lastEnd(AFASY, 1) - 1);
  await page.waitForFunction(() => mushafAudio.currentTime < 3 && !mushafAudio.paused, null, { timeout: 8000 });
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  assert.match((await audioState(page)).src, /001\.mp3$/);
  await page.click("#reciterBtn"); await page.locator("#afterSel").selectOption("stop"); await page.keyboard.press("Escape");
  await moveTo(page, lastEnd(AFASY, 1) - 1);
  await page.waitForFunction(() => mushafAudio.paused, null, { timeout: 8000 });
  assert.match(await page.locator("#pSub").textContent(), /Paused/);
  await page.reload(); await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#reciterBtn");
  assert.equal(await page.locator("#afterSel").inputValue(), "stop");
}));

test("Lock screen and car controls: set each time playback starts, previous/next ayah instead of 10-second skips", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.evaluate(() => { __handlerLog.length = 0; });
  await page.click("#playBtn");
  await page.waitForFunction(() => __ev.includes("playing@001.mp3"));
  const log = await page.evaluate(() => __handlerLog);
  for (const a of ["play", "pause", "previoustrack", "nexttrack", "seekbackward:null", "seekforward:null"]) assert.ok(log.includes(a), a + " in " + log.join(","));
  await page.evaluate(() => __handlers.nexttrack());
  await page.waitForSelector('#page .playing[data-k="1:2"]');
  await page.waitForFunction(t => Math.abs(mushafAudio.currentTime - t) < 0.6 && !mushafAudio.paused, startOf(AFASY, 1, 2));
  await page.evaluate(() => __handlers.previoustrack());
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  assert.equal(await page.evaluate(() => navigator.audioSession.type), "playback", "plays as media, not muted by the silent switch");
}));

test("Translation size: its own slider resizes the translation below the page and side by side, and is remembered", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const size = sel => page.$eval(sel, e => parseFloat(getComputedStyle(e).fontSize));
  const before = await size(".trow p");
  const quran = await size(".ayah");
  await page.click("#openSettings"); await page.locator("#tsize").fill("1.6"); await page.keyboard.press("Escape");
  assert.equal(await size(".trow p"), 1.6 * 16);
  assert.ok(await size(".trow p") > before);
  assert.equal(await size(".ayah"), quran, "the Quran text size is unchanged");
  await page.click("#openSettings"); await page.locator('#layoutSeg button[data-v="side"]').click(); await page.keyboard.press("Escape");
  await page.waitForSelector(".vrow .vtr p");
  assert.equal(await size(".vrow .vtr p"), 1.6 * 16);
  await page.reload(); await page.waitForSelector(".vrow .vtr p", { timeout: 15000 });
  assert.equal(await size(".vrow .vtr p"), 1.6 * 16);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, "no sideways scrolling with large translation text");
}, { width: 390, height: 844 }));

/* ---------- page colours ---------- */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parseRgb = s => s.match(/\d+/g).slice(0, 3).map(Number);
const PAPER_EXPECT = { white: ["#e8ecea", "#ffffff"], cream: ["#e3e8e2", "#fbf8ee"], sepia: ["#e4d6ba", "#f6edd8"], mint: ["#d9e7df", "#f0f8f3"], night: ["#0c1311", "#161f1c"], black: ["#000000", "#050505"] };

test("Page colour: each choice colours the background and page, keeps text easy to read, and is remembered", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i42");
  await page.waitForSelector(".frame.ip .ayah", { timeout: 20000 });
  for (const [id, [ground, paper]] of Object.entries(PAPER_EXPECT)) {
    await page.click("#openSettings"); await page.locator('#paperSeg button[data-v="' + id + '"]').click(); await page.keyboard.press("Escape");
    const c = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, page: getComputedStyle(document.querySelector(".page")).backgroundColor,
      ink: getComputedStyle(document.querySelector(".ip .ayah")).color, meta: (document.getElementById("paperColor") || {}).content }));
    assert.deepEqual(parseRgb(c.body), rgb(ground), id + " background");
    assert.deepEqual(parseRgb(c.page), rgb(paper), id + " page");
    assert.ok(contrast(parseRgb(c.ink), rgb(paper)) >= 7, id + " text contrast " + contrast(parseRgb(c.ink), rgb(paper)).toFixed(1));
    assert.equal(c.meta, ground, id + " status bar colour");
  }
  await page.reload(); await page.waitForSelector(".frame.ip .ayah", { timeout: 20000 });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.paper), "black");
}));

test("Page colour: Auto follows the phone's dark mode; a chosen colour stays when the phone is dark", () => withPage({}, async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForSelector(READY, { timeout: 15000 });
  const pageBg = () => page.evaluate(() => getComputedStyle(document.querySelector(".page")).backgroundColor);
  assert.deepEqual(parseRgb(await pageBg()), rgb("#161f1c"), "auto + dark phone = night");
  await page.click("#openSettings"); await page.locator('#paperSeg button[data-v="sepia"]').click(); await page.keyboard.press("Escape");
  assert.deepEqual(parseRgb(await pageBg()), rgb("#f6edd8"), "sepia stays sepia");
  await page.click("#openSettings"); await page.locator('#paperSeg button[data-v="auto"]').click(); await page.keyboard.press("Escape");
  assert.deepEqual(parseRgb(await pageBg()), rgb("#161f1c"));
  assert.equal(await page.locator("#paperColor").count(), 0);
}));

test("Page colour: highlights, your place and side-by-side rows are visible on every colour", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#hlBtn"); await page.click('.ayah[data-k="1:2"]'); await page.click("#hlDone");
  await page.click('.ayah[data-k="1:4"]');
  for (const id of Object.keys(PAPER_EXPECT)) {
    await page.click("#openSettings"); await page.locator('#paperSeg button[data-v="' + id + '"]').click(); await page.keyboard.press("Escape");
    const c = await page.evaluate(() => ({ paper: getComputedStyle(document.querySelector(".page")).backgroundColor,
      hl: getComputedStyle(document.querySelector('.ayah[data-k="1:2"]')).backgroundColor, cur: getComputedStyle(document.querySelector('.ayah[data-k="1:4"]')).backgroundColor }));
    assert.notEqual(c.hl, "rgba(0, 0, 0, 0)", id + " highlight"); assert.notEqual(c.cur, "rgba(0, 0, 0, 0)", id + " your place");
  }
}));

/* ---------- installable app ---------- */
test("web app manifest is valid and its icons load at the declared sizes", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const man = await page.evaluate(async h => (await fetch(h)).json(), href);
  assert.equal(man.display, "standalone");
  assert.equal(man.start_url, "./");
  assert.ok(man.name && man.short_name);
  assert.ok(man.icons.some(i => i.purpose === "maskable"));
  for (const icon of man.icons) {
    const [w] = icon.sizes.split("x").map(Number);
    const got = await page.evaluate(src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im.naturalWidth); im.onerror = () => bad(new Error("icon failed " + src)); im.src = src; }), icon.src);
    assert.equal(got, w, icon.src);
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  assert.equal(await page.evaluate(async h => (await fetch(h)).status, apple), 200);
}));

test("service worker installs and the app reopens offline on a page already read", () => withPage({ sw: true }, async ({ page, context }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();                                   // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForSelector('.ayah[data-k="1:7"]', { timeout: 15000 });
  await page.click("#nextBtn"); await page.waitForSelector('.ayah[data-k="2:1"]'); // read page 2 too
  await page.waitForTimeout(300);                        // let cache writes finish
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.setOffline(true);
  await page.goto(PAGE_URL + "#p1");
  await page.waitForSelector('.ayah[data-k="1:7"]', { timeout: 15000 });
  assert.equal(await page.locator(".ayah").count(), 7);
  await page.click("#nextBtn");
  await page.waitForSelector('.ayah[data-k="2:1"]', { timeout: 15000 });
}));

test("Install button appears when the browser offers installation", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator("#installBtn").isVisible(), false);
  await page.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: "accepted" }); window.dispatchEvent(e); });
  await page.click("#installBtn");
  assert.equal(await page.evaluate(() => window.__prompted), true);
  assert.equal(await page.locator("#installBtn").isVisible(), false);
}));

test("on iPhone, Install explains Add to Home Screen", () => withPage({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" }, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#installBtn");
  assert.match(await page.locator("#sheet").textContent(), /Share, then Add to Home Screen/);
}, { width: 390, height: 844 }));

/* ---------- the Quran text is exactly King Fahd's text (every ayah) ---------- */
const REF = f => JSON.parse(readFileSync(new URL("./reference/" + f, import.meta.url), "utf8"));
const UTH_FILE = JSON.parse(readFileSync(new URL("../data/uthmani-hafs.json", import.meta.url), "utf8"));
const ALL_AYAT = COUNTS.flatMap((n, i) => Array.from({ length: n }, (_, j) => [i + 1, j + 1]));
// Split a text into its letters and marks, and the places where words break. Encoding-only differences are set
// aside: Unicode's canonical mark order (NFC), the tatweel that carries a small alif, U+200F direction marks and
// the thin space U+2009 that one copy puts inside a word. Nothing that is a letter or a mark is ever removed.
function lettersAndBreaks(t) {
  t = t.normalize("NFC").replace(/[\u0640\u200F\u2009]/g, "");
  let chars = "", breaks = new Set();
  for (const c of t) { if (/\s/.test(c)) breaks.add(chars.length); else chars += c; }
  return { chars, breaks };
}

test("Uthmani: all 6,236 ayat have exactly King Fahd's letters and marks (Mushaf al-Madinah, v13)", () => {
  const ref = {}; for (const r of REF("kfgqpc-uthmani-hafs-v13.json").quran) ref[r.chapter + ":" + r.verse] = r.text;
  assert.equal(Object.keys(ref).length, 6236);
  assert.equal(ALL_AYAT.length, 6236);
  const wrong = [], badBreak = [];
  for (const [s, a] of ALL_AYAT) {
    const mine = lettersAndBreaks(UTH_FILE.ayat[s][a - 1]), kf = lettersAndBreaks(ref[s + ":" + a]);
    if (mine.chars !== kf.chars) wrong.push(s + ":" + a);
    // every word break in the app is a word break in King Fahd's copy; that copy's only extra breaks are the
    // space it leaves after an open tanween (U+08F0-08F2) inside a word
    for (const b of mine.breaks) if (!kf.breaks.has(b)) badBreak.push(s + ":" + a);
    for (const b of kf.breaks) if (!mine.breaks.has(b) && !/[\u08F0-\u08F2]\p{M}*$/u.test(kf.chars.slice(0, b))) badBreak.push(s + ":" + a);
  }
  assert.deepEqual(wrong, [], "ayat whose letters or marks differ");
  assert.deepEqual([...new Set(badBreak)], [], "ayat whose words are split differently");
});

test("Uthmani: the bundled file is the published source, changed only by the open-tanween code points and two restored word spaces", () => {
  const src = REF("quran-json-3.1.2-quran.json");
  const fix = t => t.replace(/\u0657/g, "\u08F0").replace(/\u065E/g, "\u08F1").replace(/\u0656/g, "\u08F2").normalize("NFC");
  // the only other change: a word space the source leaves out in two ayat, restored as in King Fahd's v13 file
  const corr = Object.fromEntries(UTH_FILE.corrections.map(c => [c.ayah, c]));
  assert.deepEqual(Object.keys(corr), ["37:164", "41:47"]);
  for (const c of UTH_FILE.corrections) assert.equal(c.source.replace(/ /g, ""), c.kfgqpc_v13.replace(/ /g, ""), "a correction only adds a space");
  for (const ch of src) {
    assert.equal(UTH_FILE.ayat[ch.id].length, ch.verses.length, "surah " + ch.id + " ayah count");
    for (const v of ch.verses) {
      const k = ch.id + ":" + v.id, c = corr[k];
      let want = fix(v.text);
      if (c) { assert.equal(want.split(c.source).length, 2, k); want = want.replace(c.source, c.kfgqpc_v13); }
      assert.equal(UTH_FILE.ayat[ch.id][v.id - 1], want, k);
    }
  }
  const all = Object.values(UTH_FILE.ayat).flat().join("");
  assert.ok(!/[\u0656\u0657\u065E]/.test(all), "no legacy open-tanween code points left");
  assert.equal(Object.values(UTH_FILE.ayat).flat().length, 6236);
});

test("Uthmani: every ayah on every Madani page is shown exactly as in the bundled text", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const shown = await page.evaluate(async () => {
    const out = [];
    for (let p = 1; p <= 604; p++) {
      location.hash = "#p" + p;
      const num = String(p).replace(/\d/g, d => "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"[d]);
      await new Promise(r => { const t0 = Date.now(); (function w(){ const f = document.querySelector(".folio"); if (f && f.textContent === num) r(); else if (Date.now() - t0 > 4000) r(); else setTimeout(w, 5); })(); });
      document.querySelectorAll("#page .ayah").forEach(e => out.push([p, e.dataset.k, e.firstChild.nodeValue]));
    }
    return out;
  });
  const seen = {};
  for (const [p, k, t] of shown) { const [s, a] = k.split(":").map(Number); assert.equal(t, UTH_FILE.ayat[s][a - 1], "page " + p + ", ayah " + k); seen[k] = 1; }
  assert.deepEqual(ALL_AYAT.map(([s, a]) => s + ":" + a).filter(k => !seen[k]), [], "ayat not shown on any page");
}));

test("IndoPak: every ayah's letters match King Fahd's Nastaleeq text, except 47 listed spelling conventions", () => {
  const D = JSON.parse(readFileSync(new URL("../data/indopak-spelling-differences.json", import.meta.url), "utf8"));
  const G = Object.entries(D.glyph_letters).map(([u, v]) => [String.fromCodePoint(parseInt(u.slice(2), 16)), v]);
  const SAME = { "ی":"ي", "ى":"ي", "ہ":"ه", "ھ":"ه", "ک":"ك", "ٱ":"ا" };
  const letters = t => { for (const [g, v] of G) t = t.split(g).join(v); let o = "";
    for (let c of t.normalize("NFD")) { c = SAME[c] || c; const n = c.codePointAt(0);
      if ((n >= 0xE000 && n <= 0xF8FF) || /[\p{Mn}\p{Zs}\p{Cf}]/u.test(c) || c === "\u0640" || (n >= 0x06D6 && n <= 0x06ED) || c === "۞" || c === "۩") continue;
      o += c; } return o; };
  const words = {}; for (let p = 1; p <= 610; p++) for (const [loc, t] of ipWordsOn(p)) { const k = loc.split(":").slice(0, 2).join(":"); (words[k] ||= []).push(t); }
  const ref = {}; for (const r of REF("kfgqpc-nastaleeq.json").quran) ref[r.chapter + ":" + r.verse] = r.text;
  assert.equal(Object.keys(words).length, 6236, "every ayah is on an IndoPak page");
  const differ = [];
  for (const [s, a] of ALL_AYAT) { const k = s + ":" + a; if (letters(words[k].join(" ")) !== letters(ref[k])) differ.push(k); }
  assert.deepEqual(differ, D.ayat.map(x => x.ayah), "only the listed ayat differ");
  for (const x of D.ayat) {
    assert.equal(letters(words[x.ayah].join(" ")), x.app_letters, x.ayah);
    assert.equal(letters(ref[x.ayah]), x.kfgqpc_letters, x.ayah);
  }
  // each private-use glyph always stands for the same letters, so reading it one way is safe everywhere
  for (const [g] of G) assert.ok(Object.values(words).flat().some(w => w.includes(g)), "glyph map entry in use");
});

test("IndoPak: words that start with the alif-kasra glyph draw it first, on the right (Al-Mulk 67:2, p562)", () => withPage({}, async ({ page }) => {
  const pages = [...new Set(Array.from({ length: 610 }, (_, i) => i + 1).filter(p => ipWordsOn(p).some(([, t]) => t.includes("\uF61F"))))];
  assert.ok(pages.includes(562));
  let checked = 0;
  for (const p of pages) {
    await page.goto(PAGE_URL + "#i" + p);
    await page.waitForSelector(".ip .ayah", { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const res = await page.$$eval(".ip .ayah", els => els.filter(e => e.textContent.startsWith("\uF61F")).map(e => {
      const r = document.createRange(); r.setStart(e.firstChild, 0); r.setEnd(e.firstChild, 1);
      const g = r.getBoundingClientRect(), w = e.getBoundingClientRect();
      return { k: e.dataset.k, bidi: getComputedStyle(e).unicodeBidi, dir: getComputedStyle(e).direction, gap: w.right - g.right, width: w.width };
    }));
    for (const x of res) {
      assert.equal(x.bidi, "bidi-override", x.k); assert.equal(x.dir, "rtl", x.k);
      assert.ok(x.gap < 2, "page " + p + " " + x.k + ": first letter is " + x.gap.toFixed(1) + "px from the right edge of its word");
      checked++;
    }
  }
  assert.equal(checked, 54, "all 54 such words checked");
}, { width: 460, height: 900 }));

/* ---------- IndoPak highlight covers the spaces between words ---------- */
const gapCover = (page, k) => page.$$eval('.ip .ayah[data-k="' + k + '"]', ws => {
  const out = [];
  for (let i = 0; i + 1 < ws.length; i++) {
    const a = ws[i], b = ws[i + 1]; if (a.parentNode !== b.parentNode) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); if (Math.abs(ra.top - rb.top) > 4) continue;
    const before = getComputedStyle(a, "::before");
    out.push({ gap: ra.left - rb.right, w: parseFloat(before.width), bg: before.backgroundColor, own: getComputedStyle(a).backgroundColor });
  }
  return out;
});
test("IndoPak: a highlighted or marked ayah is coloured across the spaces between its words", () => withPage({ tap: "default" }, async ({ page }) => {
  await page.goto(PAGE_URL + "#i562");
  await page.waitForSelector('.ip .ayah[data-k="67:2"]', { timeout: 20000 });
  await page.click("#hlBtn"); await page.click("#hlColors .swatch.green");
  await page.locator('.ip .ayah[data-k="67:2"]').nth(2).click(); await page.click("#hlDone");
  await page.locator('.ip .ayah[data-k="67:1"]').nth(2).click();
  await page.waitForTimeout(400); // colour fade-in
  for (const k of ["67:1", "67:2"]) {
    const gaps = await gapCover(page, k);
    assert.ok(gaps.length > 3, k + " has gaps to check");
    for (const g of gaps) {
      assert.ok(Math.abs(g.w - Math.max(0, g.gap)) < 1.5, k + ": fill " + g.w + " vs gap " + g.gap);
      assert.equal(g.bg, g.own, k + ": gap has the ayah's colour");
      assert.notEqual(g.own, "rgba(0, 0, 0, 0)");
    }
  }
  // a word next to a different ayah gets no fill (the colour stops at the ayah's edge)
  const edge = await page.$$eval(".ip .ayah", ws => ws.filter((w, i) => ws[i + 1] && ws[i + 1].dataset.k !== w.dataset.k).map(w => parseFloat(getComputedStyle(w, "::before").width)));
  assert.ok(edge.every(x => x === 0), "no fill across into the next ayah");
}, { width: 460, height: 900 }));

test("IndoPak larger text: the spaces between a highlighted ayah's words are coloured too", () => withPage({}, async ({ page }) => {
  await page.goto(PAGE_URL + "#i562");
  await page.waitForSelector('.ip .ayah[data-k="67:2"]', { timeout: 20000 });
  await setIpSize(page, 1.6);
  await page.waitForSelector(".ipflow .ayah", { timeout: 10000 });
  await page.click("#hlBtn"); await page.click("#hlColors .swatch.green");
  await page.locator('.ip .ayah[data-k="67:2"]').nth(2).click(); await page.click("#hlDone");
  await page.waitForTimeout(400);
  const r = await page.$$eval('.ip .gapw[data-k="67:2"]', g => g.map(x => [getComputedStyle(x).backgroundColor, x.textContent]));
  const word = await page.$eval('.ip .ayah[data-k="67:2"]', w => getComputedStyle(w).backgroundColor);
  assert.equal(r.length, ipWordsOn(562).filter(([l]) => l.startsWith("67:2:")).length - 1, "one coloured space between each pair of words");
  for (const [bg, t] of r) { assert.equal(bg, word); assert.equal(t, " "); }
  assert.deepEqual(await wordsShown(page), ipWordsOn(562).map(([loc, t]) => [loc.split(":").slice(0, 2).join(":"), t]), "words unchanged");
}, { width: 390, height: 844 }));

/* ---------- settings and menus close clearly ---------- */
test("Settings button shows a gear and the word Settings; Done closes the settings and ayah menus", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.locator("#openSettings .txt").textContent(), "Settings");
  assert.equal(await page.locator("#openSettings svg circle").count(), 1, "gear centre");
  await page.click("#openSettings");
  await page.waitForSelector("#sheet:not([hidden])");
  const done = page.locator("#sheetClose");
  assert.equal(await done.textContent(), "Done");
  await page.locator("#sheetInner").evaluate(e => e.scrollTop = e.scrollHeight);
  const box = await done.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 844, "Done stays on screen while scrolling the settings");
  await done.click();
  assert.equal(await page.locator("#sheet").isHidden(), true);
  assert.equal(await page.locator("#scrim").isHidden(), true);
  await page.click('.ayah[data-k="1:2"]');
  await page.waitForSelector("#sheet:not([hidden])");
  await page.click("#sheetClose");
  assert.equal(await page.locator("#sheet").isHidden(), true);
}, { width: 390, height: 844 }));

/* ---------- design: bundled fonts, journey track, page turns ---------- */
test("Mushaf fonts are bundled: the page draws in Amiri Quran without contacting Google Fonts", () => withPage({}, async ({ page }) => {
  const outside = []; page.on("request", r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) outside.push(r.url()); });
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check('28px "Amiri Quran"', "ٱ")), true, "Amiri Quran loaded");
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "")));
  assert.ok(loaded.includes("Amiri Quran") && loaded.includes("Figtree"), loaded.join(","));
  assert.deepEqual(outside, []);
}));

test("Journey track: shows your place in the Mushaf (page 1 at the right) and jumps when tapped", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const pos = () => page.$eval("#track", t => +getComputedStyle(t).getPropertyValue("--pos"));
  assert.equal(await pos(), 0);
  assert.equal(await page.locator("#track b span").count(), 29, "a tick at the start of juz 2 to 30");
  const box = await page.locator("#track").boundingBox();
  await page.locator("#track").click({ position: { x: 2, y: box.height / 2 } }); // left end = end of the Mushaf
  await page.waitForFunction(() => /Page 60[0-4] of 604/.test(document.querySelector("#where").textContent));
  assert.ok(await pos() > 0.99);
  await page.locator("#track").click({ position: { x: box.width / 2, y: box.height / 2 } });
  await page.waitForFunction(() => /Page (29\d|30\d|31\d) of 604/.test(document.querySelector("#where").textContent));
}));

test("Turning a page slides the new page in, and opening a page directly does not", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  assert.equal(await page.$eval("#page", p => p.dataset.turn || ""), "");
  await page.click("#nextBtn");
  await page.waitForSelector('.ayah[data-k="2:1"]');
  assert.equal(await page.$eval("#page", p => p.dataset.turn), "fwd");
  assert.equal(await page.$eval("#page .frame", f => getComputedStyle(f).animationName), "turnF");
  await page.waitForFunction(() => !document.querySelector("#page").dataset.turn, null, { timeout: 3000 });
  assert.equal(await page.$eval("#page", p => p.dataset.side), "l", "page 2 is a left-hand page");
  await page.click("#prevBtn");
  await page.waitForFunction(() => document.querySelector(".folio").textContent === "١");
  assert.equal(await page.$eval("#page", p => p.dataset.side), "r");
}));

/* ---------- each ayah is a section: previous / next never pause the recitation ---------- */
const POS = () => { window.__pos = []; const ms = navigator.mediaSession; if (ms) ms.setPositionState = st => { window.__pos.push(st); }; };
test("Next / previous ayah within a surah only jump in time: the audio is never paused (iPhone lock screen)", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(POS);
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForFunction(() => __ev.includes("playing@001.mp3"));
  await page.evaluate(() => { __ev.length = 0; });
  for (const [act, k] of [["nexttrack", "1:2"], ["nexttrack", "1:3"], ["previoustrack", "1:2"]]) {
    await page.evaluate(a => __handlers[a](), act);
    await page.waitForSelector('#page .playing[data-k="' + k + '"]');
    const [s, a] = k.split(":").map(Number);
    await page.waitForFunction(t => Math.abs(mushafAudio.currentTime - t) < 0.6, startOf(AFASY, s, a));
  }
  const ev = await page.evaluate(() => __ev);
  assert.ok(!ev.some(e => e.startsWith("pause")), "no pause at all: " + ev.join(","));
  assert.equal((await audioState(page)).paused, false);
  assert.match((await audioState(page)).src, /001\.mp3$/, "same recording");
  // the player's own buttons do the same
  await page.click("#nextAyah");
  await page.waitForSelector('#page .playing[data-k="1:3"]');
  await page.click("#prevAyah"); await page.click("#prevAyah");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.waitForFunction(() => mushafAudio.currentTime < 0.6, null, { timeout: 4000 }); // ayah 1 starts with the Bismillah, at 0
  assert.ok(!(await page.evaluate(() => __ev)).some(e => e.startsWith("pause")));
  assert.equal(await page.locator("#prevAyah").getAttribute("aria-label"), "Previous ayah");
}));

test("Next ayah from the last ayah of a surah switches to the next surah without a gap", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForFunction(() => __ev.includes("playing@001.mp3"));
  await moveTo(page, startOf(AFASY, 1, 7) + 0.3);
  await page.waitForSelector('#page .playing[data-k="1:7"]');
  await page.evaluate(() => { __ev.length = 0; __handlers.nexttrack(); });
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  const ev = await page.evaluate(() => __ev);
  assert.ok(!ev.some(e => e === "pause@001.mp3"), "no pause event reached the app's pause handling: " + ev.join(","));
  assert.match(await page.locator("#pSub").textContent(), /Playing/);
  await page.evaluate(() => __handlers.previoustrack());
  await page.waitForSelector('#page .playing[data-k="1:7"]', { timeout: 10000 });
  await page.waitForFunction(t => !mushafAudio.paused && /001\.mp3$/.test(mushafAudio.src) && Math.abs(mushafAudio.currentTime - t) < 0.6, startOf(AFASY, 1, 7));
}));

test("Lock-screen progress bar covers the current ayah, and dragging it moves within that ayah", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(POS);
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForFunction(() => __ev.includes("playing@001.mp3"));
  await page.evaluate(() => __handlers.nexttrack());
  await page.waitForSelector('#page .playing[data-k="1:2"]');
  const row = AFASY.ayat[1].find(r => r[0] === 2);
  await page.waitForFunction(d => __pos.some(p => Math.abs(p.duration - d) < 0.05), (row[2] - row[1]) / 1000);
  const last = await page.evaluate(() => __pos.at(-1));
  assert.ok(last.position >= 0 && last.position <= last.duration, JSON.stringify(last));
  assert.ok(await page.evaluate(() => typeof __handlers.seekto === "function"));
  await page.evaluate(() => __handlers.seekto({ seekTime: 1 }));
  await page.waitForFunction(t => Math.abs(mushafAudio.currentTime - t) < 0.4, row[1] / 1000 + 1);
  assert.equal(await page.locator('#page .playing[data-k="1:2"]').count() > 0, true, "still on the same ayah");
}));

test("Surah titles fit inside their frame (IndoPak printed line, every phone width)", () => withPage({}, async ({ page }) => {
  for (const w of [360, 390, 460, 1100]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(PAGE_URL + "#i2"); await page.waitForSelector(".ipl.ips .surah-head"); await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const r = await page.$$eval(".ipl.ips", ls => ls.map(l => [l.getBoundingClientRect().height, l.querySelector(".surah-head").getBoundingClientRect().height, getComputedStyle(l.querySelector(".nm")).lineHeight, parseFloat(getComputedStyle(l.querySelector(".nm")).fontSize)]));
    for (const [line, head, lh, fs] of r) {
      assert.ok(head <= line + 0.5, w + "px: title " + head + " taller than its line " + line);
      assert.ok(parseFloat(lh) / fs >= 1.8, w + "px: line height leaves room for descenders");
    }
  }
  await page.goto(PAGE_URL + "#p2"); await page.waitForSelector(".surah-head .nm");
  const m = await page.$eval(".surah-head .nm", n => parseFloat(getComputedStyle(n).lineHeight) / parseFloat(getComputedStyle(n).fontSize));
  assert.ok(m >= 2, "Madani title line height " + m);
}));

/* ---------- end of a surah on real recordings: cut close, length unknown or changing, phone refusing ---------- */
// Real surah files end soon after the last ayah, and a phone's idea of a file's length can be missing or change
// while it loads. Pretend 001.mp3 has the length in window.__dur (seconds), and say when it changes.
const FAKE_LEN = () => {
  window.__dur = undefined;
  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");
  Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get() {
    return /001\.mp3$/.test(this.src) && window.__dur !== undefined ? window.__dur : d.get.call(this); } });
};
const switchedAt = page => page.evaluate(() => { const e = __ev.find(x => x.startsWith("pause()@001")); return e ? +e.split("|")[1] : null; });
const SPY_T = () => { // like SPY, and note where in the file each pause() call happened
  const w = () => { if (!window.mushafAudio) return setTimeout(w, 20);
    mushafAudio.pause = function () { __ev.push("pause()@" + this.src.split("/").pop() + "|" + this.currentTime); return HTMLMediaElement.prototype.pause.call(this); }; };
  setTimeout(w, 50);
};
for (const [name, len] of [["cut 0.6 s after the last ayah", 0.6], ["length unknown (NaN)", NaN], ["length still estimated as endless", Infinity]]) {
  test("End of surah: switches on time when the recording is " + name, () => withPage(SURAH, async ({ page }) => {
    const end = lastEnd(AFASY, 1);
    await page.addInitScript(FAKE_LEN);
    await page.addInitScript(([l, e]) => { window.__dur = Number.isNaN(l) ? NaN : l === Infinity ? Infinity : e + l; }, [len, end]);
    await spyPage(page, PAGE_URL + "#p1");
    await page.evaluate(SPY_T);
    await page.click("#playBtn");
    await page.waitForSelector('#page .playing[data-k="1:1"]');
    await moveTo(page, end - 1.5);
    await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
    await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
    const at = await switchedAt(page);
    assert.ok(at !== null && at >= end - 0.05, "not before the last ayah ends: " + at + " vs " + end);
    assert.ok(at <= end + 0.95, "promptly after it: " + at);
    if (len === 0.6) assert.ok(at < end + len - 0.2, "before the file runs out");
    const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
    assert.ok(plog.some(l => /End of surah 1 \(on time\), next: .*2:1/.test(l)), plog.join(" | "));
  }));
}

test("End of surah: a length estimate that shrinks while loading moves the switch earlier", () => withPage(SURAH, async ({ page }) => {
  const end = lastEnd(AFASY, 1);
  await page.addInitScript(FAKE_LEN);
  await page.addInitScript(() => { window.__dur = 5000; });   // first estimate far too long
  await spyPage(page, PAGE_URL + "#p1");
  await page.evaluate(SPY_T);
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.evaluate(e => { window.__dur = e + 0.4; mushafAudio.dispatchEvent(new Event("durationchange")); }, end);
  await moveTo(page, end - 1.5);
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
  const at = await switchedAt(page);
  assert.ok(at >= end - 0.05 && at < end + 0.3, "switched at the end of the recitation, before the file's real end: " + at);
}));

test("End of surah: if the phone refuses to start the next surah, it waits ready, and play or reopening the app carries on", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(() => {
    window.__refuse = true;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (window.__refuse && /002\.mp3$/.test(this.src)) return Promise.reject(new DOMException("not allowed in the background", "NotAllowedError"));
      return play.call(this);
    };
  });
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForFunction(() => /continue with/.test(document.querySelector("#pSub").textContent), null, { timeout: 10000 });
  assert.match(await page.locator("#pSub").textContent(), /Ready · tap play to continue with/);
  assert.match((await audioState(page)).src, /002\.mp3$/, "the next surah stays loaded (no switch to per-ayah files)");
  assert.equal(await page.locator('#page [data-k="2:1"]').count() > 0, true, "showing the next surah's page");
  let plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /refused to start .*2:1 \(NotAllowedError\)/.test(l)), plog.join(" | "));
  // the lock screen's play button
  await page.evaluate(() => { window.__refuse = false; __handlers.play(); });
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  await page.waitForSelector('#page .playing[data-k="2:1"]');
  assert.match(await page.locator("#pSub").textContent(), /Playing/);
  // and again, this time by coming back to the app
  await page.evaluate(() => { window.__refuse = true; });
  await page.evaluate(() => __handlers.previoustrack()); // 1:7, back in surah 1
  await page.waitForFunction(() => /001\.mp3$/.test(mushafAudio.src) && !mushafAudio.paused);
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForFunction(() => /continue with/.test(document.querySelector("#pSub").textContent), null, { timeout: 10000 });
  await page.evaluate(() => { window.__refuse = false; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /Back in the app: continuing/.test(l)));
}));

test("Playback log: shown newest first in the reciter settings", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
  await page.click("#reciterBtn");
  await page.locator("#playLog summary").click();
  const lines = (await page.locator("#playLog pre").textContent()).split("\n");
  assert.match(lines[0], /^\d\d:\d\d:\d\d Playing .*2:1( \(started after \d+ s\))?$/, "newest first");
  const end = lines.findIndex(l => /End of surah 1 \(on time\)/.test(l));
  assert.ok(end > 0, lines.join(" | "));
  assert.ok(lines.slice(1, end).every(l => /Loading the next recording/.test(l)), "only loading notes in between");
}));

/* ---------- background keep-alive: no silent moment while the next surah loads ---------- */
const kaState = page => page.evaluate(() => window.mushafKeepAlive ? mushafKeepAlive.state : "none");
test("Keep-alive: an inaudible signal runs from tapping play until pausing, and through the switch to the next surah", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  assert.equal(await kaState(page), "none", "nothing before play");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.waitForFunction(() => window.mushafKeepAlive && mushafKeepAlive.state === "running");
  // check the switch: the signal must be running at the moment the recording pauses to change file
  await page.evaluate(() => { const p = HTMLMediaElement.prototype.pause; mushafAudio.pause = function () { (window.__kaAtPause ||= []).push(mushafKeepAlive.state); return p.call(this); }; });
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForSelector('#page .playing[data-k="2:1"]', { timeout: 10000 });
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  assert.deepEqual(await page.evaluate(() => __kaAtPause), ["running"]);
  assert.equal(await kaState(page), "running", "still running while the next surah plays");
  await page.click("#playBtn"); // pause
  await page.waitForFunction(() => mushafKeepAlive.state === "suspended");
  await page.evaluate(() => __handlers.play()); // lock-screen play
  await page.waitForFunction(() => mushafKeepAlive.state === "running" && !mushafAudio.paused);
  await page.evaluate(() => __handlers.pause());
  await page.waitForFunction(() => mushafKeepAlive.state === "suspended");
}));

test("Keep-alive signal is inaudible (peak below -78 dB) but never exact silence", async () => {
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const m = src.match(/d\[i\] = \(Math\.random\(\)\*2 - 1\) \* ([0-9.e-]+)/);
  assert.ok(m, "keep-alive signal found");
  const peak = Number(m[1]);
  assert.ok(peak > 0 && 20 * Math.log10(peak) <= -78, "peak " + 20 * Math.log10(peak) + " dB");
});

test("Playback log: a slow switch notes how long the next surah took, and that you came back while it waited", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(() => {
    window.__hold = true;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (window.__hold && /002\.mp3$/.test(this.src)) return new Promise((res, rej) => { const t = setInterval(() => { if (!window.__hold) { clearInterval(t); play.call(this).then(res, rej); } }, 50); });
      return play.call(this);
    };
  });
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("playLog")) || []).some(l => /End of surah 1/.test(l)), null, { timeout: 10000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.evaluate(() => { window.__hold = false; });
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  await page.waitForFunction(() => /started after/.test(localStorage.getItem("playLog")));
  const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /Back in the app; the next surah had been waiting [23] s/.test(l)), plog.join(" | "));
  assert.ok(plog.some(l => /Playing .*2:1 \(started after [23] s\)/.test(l)), plog.join(" | "));
}));

/* ---------- after An-Nas, start again from Al-Fatihah ---------- */
test("Non-stop: after An-Nas the recitation carries on with Al-Fatihah", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.locator("#surahJump").selectOption("114");
  await page.waitForSelector('.ayah[data-k="114:1"]');
  await page.click('.ayah[data-k="114:1"]'); await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForFunction(() => /114\.mp3$/.test(mushafAudio.src));
  await moveTo(page, lastEnd(AFASY, 114) - 1.5);
  await page.waitForSelector('#page .playing[data-k="1:1"]', { timeout: 10000 });
  await page.waitForFunction(() => !mushafAudio.paused && /001\.mp3$/.test(mushafAudio.src) && mushafAudio.currentTime < 3);
  assert.equal(await page.locator(".folio").textContent(), "١", "turned to page 1");
  const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /End of surah 114 \(on time\), next: .*1:1/.test(l)), plog.join(" | "));
  assert.ok(plog.some(l => /Completed the Quran; starting again from Al-Fatihah/.test(l)));
}));

test("Non-stop: ayah by ayah, An-Nas 114:6 is followed by Al-Fatihah 1:1", () => withPage({ timings: "404", audio: "ok" }, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.locator("#surahJump").selectOption("114");
  await page.waitForSelector('.ayah[data-k="114:6"]');
  await page.click('.ayah[data-k="114:6"]'); await page.locator("#sheet button", { hasText: "Play from here" }).click();
  await page.waitForSelector('#page .playing[data-k="1:1"]', { timeout: 15000 });
}));

/* ---------- lock-screen picture: the app's star mark, set again whenever a recording loads ---------- */
test("Lock-screen picture is the app's star artwork (full addresses), and is set again when a new recording loads or plays", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(() => {
    window.__meta = [];
    if (navigator.mediaSession) Object.defineProperty(navigator.mediaSession, "metadata", { configurable: true, get() { return this.__m; }, set(v) { this.__m = v; window.__meta.push({ at: Date.now(), src: mushafAudio && mushafAudio.src, art: v && [...v.artwork].map(a => a.src) }); } });
  });
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForFunction(() => __ev.includes("playing@001.mp3"));
  const art = await page.evaluate(() => __meta.at(-1).art);
  assert.deepEqual(art.map(u => new URL(u).pathname.split("/").pop()), ["artwork-512.png", "artwork-256.png"]);
  assert.ok(art.every(u => /^https?:\/\//.test(u)), "full addresses");
  for (const u of art) assert.deepEqual(await page.evaluate(async u => { const r = await fetch(u); return [r.status, (await r.blob()).size > 1000]; }, u), [200, true], u);
  // moving into the next surah: the picture is set again after the new file has loaded and started
  await page.evaluate(() => { __meta.length = 0; });
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForFunction(() => !mushafAudio.paused && /002\.mp3$/.test(mushafAudio.src));
  await page.waitForFunction(() => __meta.filter(m => /002\.mp3$/.test(m.src)).length >= 2);
  const last = await page.evaluate(() => __meta.at(-1));
  assert.ok(last.art[0].endsWith("artwork-512.png"));
}));

test("Icons: the home-screen icons and the lock-screen artwork are the new star mark, at the sizes the manifest says", async () => {
  const man = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  const png = f => { const b = readFileSync(new URL("../" + f, import.meta.url)); assert.equal(b.toString("latin1", 1, 4), "PNG", f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const i of man.icons) assert.deepEqual(png(i.src).join("x"), i.sizes, i.src);
  assert.deepEqual(png("icons/apple-touch-icon.png"), [180, 180]);
  assert.deepEqual(png("icons/artwork-512.png"), [512, 512]);
  assert.deepEqual(png("icons/artwork-256.png"), [256, 256]);
});


/* ---------- in the background: position updates are sparse (the surah repeated all night on an iPhone) ---------- */
const DROP_TU = () => { // let the test switch off the playing-position updates the app receives
  window.__dropTU = false;
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (type === "timeupdate" && this instanceof HTMLMediaElement) { const f = fn; fn = function (e) { if (!window.__dropTU) return f.call(this, e); }; }
    return add.call(this, type, fn, o);
  };
};
test("Background: the next surah starts on time even with no position updates at all (switch timer)", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(DROP_TU);
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.evaluate(() => { window.__dropTU = true; });
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForFunction(() => /002\.mp3$/.test(mushafAudio.src) && !mushafAudio.paused, null, { timeout: 8000 });
  const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /End of surah 1 \(on time\), next: .*2:1/.test(l)), plog.join(" | "));
}));

test("Background: a loop back to the start that is noticed late (8 s in) still moves on to the next surah", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(DROP_TU);
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 6);
  await page.waitForFunction(e => Math.abs(mushafAudio.currentTime - e) < 3, lastEnd(AFASY, 1) - 5.5);
  await page.waitForTimeout(1200);                        // the app has seen a position near the end (and its own last seek is well past)
  await page.evaluate(() => { window.__dropTU = true; mushafAudio.currentTime = 8; }); // the loop, first seen 8 s into the start
  await page.waitForFunction(() => /002\.mp3$/.test(mushafAudio.src) && !mushafAudio.paused, null, { timeout: 8000 })
  ;
  const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /End of surah 1 \(the recording looped\), next: .*2:1/.test(l)), plog.join(" | "));
}));

test("Background: a loop noticed late through a position update (not a seek event) also moves on", () => withPage(SURAH, async ({ page }) => {
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await moveTo(page, lastEnd(AFASY, 1) - 12);   // far enough from the end that the switch timer can't be what moves on
  await page.waitForTimeout(1200);
  // the loop happened while the app wasn't told: only a position update arrives, already 10 s into the start
  await page.evaluate(() => { const a = mushafAudio; const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
    Object.defineProperty(a, "currentTime", { configurable: true, get: () => 10, set: v => d.set.call(a, v) });
    a.dispatchEvent(new Event("timeupdate"));
    delete a.currentTime; });
  await page.waitForFunction(() => /002\.mp3$/.test(mushafAudio.src) && !mushafAudio.paused, null, { timeout: 4000 });
  const plog = await page.evaluate(() => JSON.parse(localStorage.getItem("playLog")));
  assert.ok(plog.some(l => /End of surah 1 \(the recording looped\)/.test(l)), plog.join(" | "));
}));

test("Background: pausing stops the switch timer (no surprise start of the next surah)", () => withPage(SURAH, async ({ page }) => {
  await page.addInitScript(DROP_TU);
  await spyPage(page, PAGE_URL + "#p1");
  await page.click("#playBtn");
  await page.waitForSelector('#page .playing[data-k="1:1"]');
  await page.evaluate(() => { window.__dropTU = true; });
  await moveTo(page, lastEnd(AFASY, 1) - 1.5);
  await page.waitForTimeout(150);
  await page.click("#playBtn"); // pause
  await page.waitForTimeout(2500);
  assert.match((await audioState(page)).src, /001\.mp3$/);
  assert.equal((await audioState(page)).paused, true);
}));

/* ---------- choosing a surah scrolls to it; juz quarters (¼ ½ ¾) ---------- */
test("Choosing a surah scrolls to where it begins on its page (not just the top of the page)", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  for (const s of ["4", "67"]) {                  // both begin far down their page in this layout
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator("#surahJump").selectOption(s);
    const head = page.locator('#page .surah-head[data-s="' + s + '"]');
    await head.waitFor();
    assert.ok(await head.evaluate(h => h.getBoundingClientRect().top + scrollY) > 844, "surah " + s + " begins below the first screen");
    await page.waitForFunction(s => { const r = document.querySelector('#page .surah-head[data-s="' + s + '"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, s, { timeout: 4000 });
    assert.equal(await page.locator("#surahJump").inputValue(), s);
  }
}, { width: 390, height: 844 }));

test("Juz quarters: the list is the standard 240 hizb quarters, and every eighth is a juz start", () => {
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const Q = JSON.parse(src.match(/const QUARTERS = (\[.*?\]);/)[1]);
  const ref = JSON.parse(readFileSync(new URL("./reference/hizb-quarters.json", import.meta.url), "utf8"));
  assert.deepEqual(Q, ref.maqras.map(r => r.start.chapter + ":" + r.start.verse));
  assert.deepEqual(Q.filter((_, i) => i % 8 === 0), ref.juzs.map(r => r.start.chapter + ":" + r.start.verse));
  // in Mushaf order, each quarter ending right where the next begins
  const order = k => { const [s, a] = k.split(":").map(Number); return s * 1000 + a; };
  assert.ok(Q.every((k, i) => !i || order(k) > order(Q[i - 1])));
  for (let i = 0; i + 1 < 240; i++) { const e = ref.maqras[i].end, n = ref.maqras[i + 1].start;
    assert.ok(n.chapter === e.chapter ? n.verse === e.verse + 1 : n.chapter === e.chapter + 1 && n.verse === 1, "quarter " + (i + 1)); }
  assert.deepEqual(Q.slice(16, 24), ["2:253", "2:263", "2:272", "2:283", "3:15", "3:33", "3:52", "3:75"], "juz 3, quarter by quarter");
  assert.deepEqual([234, 236, 238].map(i => Q[i]), ["82:1", "87:1", "94:1"], "juz 30: ¼ at Al-Infitar, ½ at Al-Aʿla, ¾ at Ash-Sharh");
});

test("Juz menu: each juz with its ¼, ½ and ¾ points; choosing one opens that ayah and marks it", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  const opts = await page.$$eval("#juzJump option", os => os.map(o => [o.value, o.textContent]));
  assert.equal(opts.length, 120);
  assert.deepEqual(opts.slice(8, 12), [["3", "Juz 3"], ["3.25", "Juz 3 · ¼"], ["3.5", "Juz 3 · ½"], ["3.75", "Juz 3 · ¾"]]);
  for (const [v, k, part] of [["3.5", "3:15", "½"], ["3.25", "2:272", "¼"], ["30.75", "94:1", "¾"]]) {
    await page.locator("#juzJump").selectOption(v);
    const ayah = page.locator('#page .ayah[data-k="' + k + '"]').first();
    await ayah.waitFor();
    await page.waitForFunction(k => { const r = document.querySelector('#page .ayah[data-k="' + k + '"]').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, k, { timeout: 4000 });
    assert.match(await ayah.getAttribute("class"), /flash/, k + " marked");
    assert.equal(await page.locator("#juzJump").inputValue(), v, "menu shows the part chosen");
    assert.match(await page.locator("#where").textContent(), new RegExp("Juz " + Math.floor(+v) + " · " + part));
  }
  // the start of a juz still opens its first page
  await page.locator("#juzJump").selectOption("2");
  await page.waitForFunction(() => document.querySelector('#page .ayah[data-k="2:142"]'));
  assert.equal(await page.locator("#juzJump").inputValue(), "2");
}, { width: 390, height: 844 }));

test("Inside the iPhone/iPad app (window.mushafNative), the Install button stays hidden", () => withPage({}, async ({ page }) => {
  await page.addInitScript(() => {
    window.mushafNative = "ios";
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" });
  });
  await page.goto(PAGE_URL);
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), { prompt() {}, userChoice: Promise.resolve() })));
  assert.equal(await page.locator("#installBtn").isHidden(), true);
}));

await run();
