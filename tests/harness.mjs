// Test harness: serves this app folder at https://reader.test/ in headless Chrome and answers
// the requests the app makes to jsDelivr and EveryAyah with local fixtures, so tests run offline.
// Fixture text is clearly synthetic test data, never Quran text.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { extname } from "node:path";
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ["playwright", "/opt/npm-tools/node_modules/playwright"]) { try { return require(p); } catch {} }
  throw new Error("Playwright not found. Run: npm install --save-dev playwright && npx playwright install chromium");
}
const { chromium } = loadPlaywright();
// let page routes also answer requests made by the service worker (Chromium)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

export const ORIGIN = "https://reader.test";
export const PAGE_URL = ORIGIN + "/";
const APP = new URL("../", import.meta.url);
const TYPES = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".webmanifest":"application/manifest+json", ".png":"image/png", ".json":"application/json" };

export const COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

// Synthetic layout: Al-Fatihah on page 1, the rest spread over pages 2–604, juz every 20 pages.
const layoutSrc = `
const COUNTS=${JSON.stringify(COUNTS)};
const IDS=[];for(let s=1;s<=114;s++)for(let a=1;a<=COUNTS[s-1];a++)IDS.push([s,a]);
function pageOfId(id){return id<=7?1:id<=262?2+Math.floor((id-8)*41/255):42+Math.floor((id-262)*562/5969);} // 2:1→2, 2:255→42, 114:1→604 as in the Madani Mushaf
function _meta(id){const [surah,ayah]=IDS[id-1];const page=pageOfId(id);return {surah,ayah,page,juz:Math.min(30,1+Math.floor((page-1)/20))};}
function idOf(s,a){let id=0;for(let i=1;i<s;i++)id+=COUNTS[i-1];return id+a;}
function _page(s,a){return _meta(idOf(s,a)).page;}
function _juz(s,a){return _meta(idOf(s,a)).juz;}
const meta={numAyahs:6236};
const HAFS_LISTS={meta:{numAyahs:6236}};
function need(l){ return l.meta; } // throws without riwayah data, like the real library did on iPhone`;

// Module shapes the layout library may have. "needsLists" mirrors the crash seen on a real iPhone.
const esmShapes = {
  plain: `export const getAyahMeta=_meta, findPage=_page, findJuz=_juz; export {meta};`,
  needsLists: `export function getListsOfRiwaya(n){ if(n!=="Hafs") throw new Error("unknown riwaya"); return HAFS_LISTS; }
export const getAyahMeta=(id,l)=>{need(l);return _meta(id)}, findPage=(s,a,l)=>{need(l);return _page(s,a)}, findJuz=(s,a,l)=>{need(l);return _juz(s,a)}; export {meta};`,
  quranObject: `export const quran={getAyahMeta:_meta,findPage:_page,findJuz:_juz}; export const findPage=(s,a,l)=>{need(l);return _page(s,a)};`,
  createHafs: `export function createHafs(){ return {getAyahMeta:_meta,findPage:_page,findJuz:_juz}; } export const getAyahMeta=(id,l)=>{need(l);return _meta(id)};`,
  wrongLayout: `export const getAyahMeta=id=>({..._meta(id),page:Math.min(604,_meta(id).page+1)}); export const findPage=()=>99;`
};

// Arabic test string with harakat and Quranic annotation marks (U+0670, U+06DF, U+06E5),
// used to prove the app shows text byte-for-byte without normalising it.
export const arText = (s, a) => "نَصٌّ تَجْرِيبِىٌّ ٰ۟ۥ " + s + "-" + a;
export const BASMALA_FIXTURE = "سَطْرُ ٱلِٱفْتِتَاحِ ٱلتَّجْرِيبِىُّ";
const chapter = (lang, s) => ({
  id: s, name: "سورة" + s, transliteration: "Surah-" + s, type: s === 2 ? "medinan" : "meccan", total_verses: COUNTS[s-1],
  verses: Array.from({length: COUNTS[s-1]}, (_, i) => ({
    id: i+1,
    text: s === 1 && i === 0 ? BASMALA_FIXTURE : arText(s, i+1),
    transliteration: "TL " + s + ":" + (i+1),
    ...(lang ? {translation: lang.toUpperCase() + " " + s + ":" + (i+1)} : {})
  }))
});

const CORS = { "access-control-allow-origin": "*" };
const LONG_MP3 = readFileSync(new URL("./surah-silence.mp3", import.meta.url));
const js = body => ({ status: 200, headers: {"content-type":"application/javascript", ...CORS}, body });
const data = (obj, esm) => esm ? js("export default " + JSON.stringify(obj)) : { status: 200, headers: {"content-type":"application/json", ...CORS}, body: JSON.stringify(obj) };

/** opts: { timings: "404"|"ok", tap: "menu"|"highlight" (what tapping an ayah does at first launch), iife: "ok"|"404"|"noglobal", iifeFile, esm: "ok"|"404", text: "ok"|"404", index: "ok"|"404", audio: "ok"|"404", sw: false|true, userAgent } */
export async function launch(opts = {}, viewport = {width: 1100, height: 900}) {
  // timings "404" by default: most tests drive the one-file-per-ayah player; the whole-surah player tests turn them on
  const o = { timings:"404", iife:"ok", esm:"ok", esmShape:"needsLists", hafsPath:"404", text:"ok", index:"ok", audio:"404", sw:false, ...opts };
  const browser = await chromium.launch({ executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ viewport, serviceWorkers: o.sw ? "allow" : "block", ...(o.userAgent ? {userAgent:o.userAgent} : {}) });
  // the app opens the menu on tap only when set to; older tests were written for that behaviour
  const tap = o.tap || "menu";
  await context.addInitScript(t => { try { if (t !== "default" && localStorage.getItem("mushaf:tap-set") === null) { localStorage.setItem("mushaf:tapAction", JSON.stringify(t)); localStorage.setItem("mushaf:tap-set", "1"); } } catch {} }, tap);
  const page = await context.newPage();
  const log = { requests: [], errors: [] };
  page.on("pageerror", e => log.errors.push(String(e)));
  await context.route("**/*", route => {
    const url = route.request().url();
    log.requests.push(url);
    if (url.startsWith(ORIGIN + "/")) {
      let path = new URL(url).pathname.slice(1) || "index.html";
      if (path.startsWith("data/timings/") && o.timings === "404") return route.fulfill({ status: 404, body: "" });
      const file = new URL(path, APP);
      if (!existsSync(file) || path.startsWith("tests/")) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, headers: { "content-type": TYPES[extname(path)] || "application/octet-stream" }, body: readFileSync(file) });
    }
    if (url.includes("quran-meta@6.0.17/dist/") && url.endsWith(".iife.js")) {
      const file = url.split("/").pop();
      if (o.iife === "404" || (o.iifeFile && o.iifeFile !== file)) return route.fulfill({ status: 404, body: "not found" });
      if (o.iife === "noglobal") return route.fulfill(js("/* no global */"));
      return route.fulfill(js("(()=>{" + layoutSrc + "\nwindow.quranMeta={getAyahMeta:_meta,findPage:_page,findJuz:_juz,meta};})();"));
    }
    if (url.includes("quran-meta@6.0.17/hafs/+esm")) {
      if (o.hafsPath !== "ok") return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill(js(layoutSrc + "\n" + esmShapes.plain));
    }
    if (url.includes("quran-meta@6.0.17/+esm")) {
      if (o.esm === "404") return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill(js(layoutSrc + "\n" + esmShapes[o.esmShape]));
    }
    const m = url.match(/quran-json@3\.1\.2\/dist\/chapters\/(?:([a-z]{2})\/)?(\d+|index)\.json(\/\+esm)?$/);
    if (m) {
      const [, lang, n, esm] = m;
      if (n === "index") {
        if (o.index === "404") return route.fulfill({ status: 404, headers: CORS, body: "" });
        return route.fulfill(data(COUNTS.map((c,i)=>({id:i+1,name:"اسم"+(i+1),transliteration:"Idx-"+(i+1),type:"meccan",total_verses:c})), esm));
      }
      if (o.text === "404") return route.fulfill({ status: 404, headers: CORS, body: "" });
      return route.fulfill(data(chapter(lang, +n), esm));
    }
    // whole-surah recordings (cdn.mp3quran.net, audio-cdn.tarteel.ai, download.quranicaudio.com): a 30-minute silent
    // stand-in, served in byte ranges like a real audio host so the player can seek
    if (/^https:\/\/(cdn\.mp3quran\.net|audio-cdn\.tarteel\.ai|download\.quranicaudio\.com)\//.test(url)) {
      if (o.audio === "404" || o.surahAudio === "404") return route.fulfill({ status: 404, body: "" });
      const buf = LONG_MP3, range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()["range"] || "");
      const headers = { "content-type": "audio/mpeg", "accept-ranges": "bytes", ...CORS };
      if (!range) return route.fulfill({ status: 200, headers: { ...headers, "content-length": String(buf.length) }, body: buf });
      const from = +range[1], to = range[2] ? Math.min(+range[2], buf.length - 1) : buf.length - 1;
      return route.fulfill({ status: 206, headers: { ...headers, "content-range": `bytes ${from}-${to}/${buf.length}`, "content-length": String(to - from + 1) }, body: buf.subarray(from, to + 1) });
    }
    if (url.startsWith("https://everyayah.com/")) {
      if (o.audio === "404") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, contentType: "audio/mpeg", body: readFileSync(new URL("./silence.mp3", import.meta.url)) });
    }
    return route.fulfill({ status: 404, body: "" }); // fonts and anything else: offline
  });
  return { browser, context, page, log };
}

/* tiny test runner */
const results = [];
export function test(name, fn) { results.push({ name, fn }); }
export async function run() {
  let pass = 0, fail = 0;
  const only = process.argv[2];
  for (const t of results) {
    if (only && !t.name.includes(only)) continue;
    const t0 = Date.now();
    try { await t.fn(); pass++; console.log("  ✓ " + t.name + "  (" + (Date.now()-t0) + " ms)"); }
    catch (e) { fail++; console.log("  ✗ " + t.name + "\n      " + String(e && e.stack || e).split("\n").slice(0,4).join("\n      ")); }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
}
