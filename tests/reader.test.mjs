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

test("shows a text error (not made-up text) when the Quran text can't load", () => withPage({ text: "404" }, async ({ page }) => {
  await page.waitForSelector(".state.err", { timeout: 15000 });
  assert.match(await page.locator(".state.err b").textContent(), /text didn't load/);
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
  const inView = await page.$eval('.ayah[data-k="2:255"]', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
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
  const box = await page.locator('.ayah[data-k="1:5"]').boundingBox();
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

await run();
