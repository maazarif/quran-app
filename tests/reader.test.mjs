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
  const styles = await page.locator(".seg button").count();
  assert.equal(styles, 5, "four Madani styles plus IndoPak");
  for (const [label, font] of [["Quranic Naskh","Scheherazade New"],["Classic Naskh","Amiri"],["Modern Naskh","Noto Naskh Arabic"],["Madani Mushaf","Amiri Quran"]]) {
    await page.locator(".seg button", { hasText: label }).click();
    assert.equal(await firstFont(page), font, label);
  }
  await page.locator(".seg button", { hasText: "Classic Naskh" }).click();
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

test("IndoPak: settings show the IndoPak sample in its own font; text size is fixed to the page", () => withPage({}, async ({ page }) => {
  await page.waitForSelector(READY, { timeout: 15000 });
  await page.click("#openSettings");
  const sample = page.locator('.seg button[data-script="indopak"] .sample');
  await page.waitForFunction(() => document.querySelector('.seg button[data-script="indopak"] .sample').textContent.length > 0);
  assert.equal(await sample.textContent(), ipWordsOn(1).filter(([l]) => /^1:1:[1-4]$/.test(l)).map(x => x[1]).join(" "));
  await page.locator('.seg button[data-script="indopak"]').click();
  await page.waitForSelector('.seg button[data-script="indopak"][aria-pressed="true"]', { timeout: 20000 });
  assert.equal(await page.locator("#size").isDisabled(), true);
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
