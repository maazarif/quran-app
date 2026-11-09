/* ---------- sources (pinned versions; text is displayed exactly as received) ---------- */
const QJ = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/";
const QM = "https://cdn.jsdelivr.net/npm/quran-meta@6.0.17/+esm";
const AUDIO = "https://everyayah.com/data/";

const SCRIPTS = [
  {id:"amiriq", name:"Madani Mushaf", cap:"Amiri Quran", font:'"Amiri Quran","Amiri",serif'},
  {id:"scheh",  name:"Quranic Naskh", cap:"Scheherazade New", font:'"Scheherazade New","Amiri Quran",serif'},
  {id:"amiri",  name:"Classic Naskh", cap:"Amiri", font:'"Amiri","Amiri Quran",serif'},
  {id:"noto",   name:"Modern Naskh", cap:"Noto Naskh Arabic", font:'"Noto Naskh Arabic","Amiri Quran",serif'},
  {id:"indopak",name:"IndoPak", cap:"Nastaleeq · 15 lines · 610 pages", font:'"IP Normal",serif', edition:"indopak"}
];
const editionOf = id => (SCRIPTS.find(x=>x.id===id)||{}).edition || "madani";
const isIP = () => editionOf(S.script) === "indopak";
const TRANSLATIONS = [
  {id:"none",name:"Off",cap:"Mushaf only"},
  {id:"en",name:"English",cap:"Saheeh International"},
  {id:"ur",name:"اردو Urdu",cap:"Abul A'la Maududi",rtl:true},
  {id:"id",name:"Indonesian",cap:"Ministry of Religious Affairs"},
  {id:"tr",name:"Türkçe",cap:"Diyanet İşleri"},
  {id:"fr",name:"Français",cap:"Muhammad Hamidullah"},
  {id:"es",name:"Español",cap:"Muhammad Isa García"},
  {id:"ru",name:"Русский",cap:"Elmir Kuliev"},
  {id:"bn",name:"বাংলা Bengali",cap:"Muhiuddin Khan"},
  {id:"zh",name:"中文 Chinese",cap:"Muhammad Makin"},
  {id:"sv",name:"Svenska",cap:"Knut Bernström"}
];
const RECITERS = [
  {id:"Alafasy_128kbps",name:"Mishary Rashid Alafasy"},
  {id:"Husary_64kbps",name:"Mahmoud Khalil Al-Husary"},
  {id:"Minshawy_Murattal_128kbps",name:"Al-Minshawi (Murattal)"},
  {id:"Abdul_Basit_Murattal_64kbps",name:"Abdul Basit (Murattal)"},
  {id:"Abdurrahmaan_As-Sudais_192kbps",name:"Abdur-Rahman As-Sudais"},
  {id:"Saood_ash-Shuraym_128kbps",name:"Saud Ash-Shuraim"},
  {id:"Abu_Bakr_Ash-Shaatree_128kbps",name:"Abu Bakr Ash-Shatri"},
  {id:"Hani_Rifai_192kbps",name:"Hani Ar-Rifai"}
];
const COLORS = ["amber","green","blue","rose"];

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const key = (s,a) => s+":"+a;
const el = (tag, attrs={}, text) => { const e=document.createElement(tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(text!=null) e.textContent=text; return e; };
const store = {
  get(k,d){try{const v=localStorage.getItem("mushaf:"+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem("mushaf:"+k,JSON.stringify(v))}catch(e){}}
};
const COLORS_OK = c => ["amber","green","blue","rose"].includes(c) ? c : "amber";
const S = {
  page: store.get("page",1), script: store.get("script","amiriq"), size: store.get("size",1.75),
  hlColor: COLORS_OK(store.get("hlColor","amber")), tapAction: store.get("tapAction","mark")==="menu" ? "menu" : "mark", current: store.get("current",null), wake: store.get("wake",false), afterSurah: ["next","repeat","stop"].includes(store.get("afterSurah","next")) ? store.get("afterSurah","next") : "next", paper: store.get("paper","auto"), layout: store.get("layout","page")==="side" ? "side" : "page", ipScale: Math.min(2.2, Math.max(1, +store.get("ipScale",1) || 1)), trans: store.get("trans","en"), translit: store.get("translit",false), reciter: store.get("reciter","Alafasy_128kbps"),
  bookmarks: store.get("bookmarks",[]), highlights: store.get("highlights",{}), sel:null
};
if(!SCRIPTS.some(x=>x.id===S.script)) S.script="amiriq";
if(!TRANSLATIONS.some(x=>x.id===S.trans)) S.trans="en";
if(!RECITERS.some(x=>x.id===S.reciter)) S.reciter="Alafasy_128kbps";
const save = () => ["page","script","size","hlColor","tapAction","current","wake","afterSurah","paper","layout","ipScale","trans","translit","reciter","bookmarks","highlights"].forEach(k=>store.set(k,S[k]));

/* ---------- data ---------- */
// On its own site the app can download the JSON files directly (they are served with CORS).
const json = async path => {
  const r = await fetch(QJ + path);
  if(!r.ok) throw new Error("HTTP " + r.status + " for " + path);
  return r.json();
};
let INDEX = [];             // surah list (id, name, transliteration, translation, type, total_verses)
// The maps below always describe the edition being read (Madani 604 pages or IndoPak 610 pages).
let PAGES = {};             // page -> [[s,a],...] every ayah with words on that page
let AYAH_PAGE = {};         // "s:a" -> page where the ayah starts
let JUZ_START = {};         // juz -> page
let PAGE_JUZ = {};          // page -> juz
let SURAH_START = {};       // surah -> page with its header
let PAGE_KEYS = {};         // page -> Set of "s:a"
let COUNT = 604;            // pages in the edition
const AYAH_JUZ = {};        // "s:a" -> juz (same in both editions)
// First ayah of each juz (standard Hafs division; metadata, not Quran text)
const JUZ_FIRST = ["1:1","2:142","2:253","3:93","4:24","4:148","5:82","6:111","7:88","8:41","9:93","11:6","12:53","15:1","17:1","18:75","21:1","23:1","25:21","27:56","29:46","33:31","36:28","39:32","41:47","46:1","51:31","58:1","67:1","78:1"];
function buildJuzMap(){ let j = 0; for(let s=1;s<=114;s++) for(let a=1;a<=SURAH_N[s-1];a++){ if(JUZ_FIRST[j]===key(s,a)) j++; AYAH_JUZ[key(s,a)] = j; } }
const ED = {};              // edition name -> its maps
function useEdition(name){
  const e = ED[name]; PAGES=e.pages; AYAH_PAGE=e.ayahPage; JUZ_START=e.juzStart; PAGE_JUZ=e.pageJuz;
  SURAH_START=e.surahStart; PAGE_KEYS=e.pageKeys; COUNT=e.count;
}
const pageHas = (p,k) => !!(PAGE_KEYS[p] && PAGE_KEYS[p].has(k));
function finishEdition(e){
  for(const p in e.pages) e.pageKeys[p] = new Set(e.pages[p].map(([s,a])=>key(s,a)));
  // a page belongs to the latest juz that has begun on it (as printed in the running head)
  for(let p=1;p<=e.count;p++){
    const js = (e.pages[p]||[]).map(([s,a])=>AYAH_JUZ[key(s,a)]);
    e.pageJuz[p] = js.length ? Math.max(...js) : (e.pageJuz[p-1] || 1);
  }
  JUZ_FIRST.forEach((k,i)=>{ e.juzStart[i+1] = e.ayahPage[k]; });
  for(let s=1;s<=114;s++) if(!(s in e.surahStart)) e.surahStart[s] = e.ayahPage[key(s,1)];
  return e;
}
const newEdition = count => ({count, pages:{}, ayahPage:{}, juzStart:{}, pageJuz:{}, surahStart:{}, pageKeys:{}});

/* ---------- IndoPak edition: bundled with the app (data/SOURCES.md), shown exactly as stored ---------- */
const IP = { lines:null, ayahWords:{}, bismillah:null, loading:null };
const IP_FONTS = ["IP Normal","IP Compact","IP Compressed"];
function loadIndopak(){
  if(IP.loading) return IP.loading;
  IP.loading = (async ()=>{
    const r = await fetch("data/indopak-15-lines.json");
    if(!r.ok) throw new Error("IndoPak text: HTTP "+r.status);
    const lines = await r.json();
    if(!Array.isArray(lines) || lines.length!==610) throw new Error("IndoPak text: expected 610 pages, got "+(lines && lines.length));
    const e = newEdition(610), words = {};
    lines.forEach((page,i)=>{
      const p = i+1; e.pages[p] = [];
      for(const ln of page){
        if(ln.t==="s"){ if(!(ln.s in e.surahStart)) e.surahStart[ln.s] = p; continue; }
        if(ln.t!=="w") continue;
        for(const [loc,txt] of ln.w){
          const [s,a] = loc.split(":").map(Number), k = key(s,a);
          (words[k] ||= []).push(txt);
          if(!(k in e.ayahPage)) e.ayahPage[k] = p;
          const last = e.pages[p][e.pages[p].length-1];
          if(!last || last[0]!==s || last[1]!==a) e.pages[p].push([s,a]);
        }
      }
    });
    const total = Object.keys(words).length;
    if(total!==6236) throw new Error("IndoPak text: expected 6,236 ayat, found "+total);
    if(e.ayahPage["2:255"]!==42 || e.ayahPage["114:1"]!==610) throw new Error("IndoPak text: page check failed");
    IP.lines = lines; IP.ayahWords = words;
    IP.bismillah = lines[0].flatMap(l=>l.t==="w" ? l.w.filter(([loc])=>/^1:1:[1-4]$/.test(loc)).map(x=>x[1]) : []);
    ED.indopak = finishEdition(e);
    await Promise.all(IP_FONTS.map(f=>document.fonts.load('40px "'+f+'"', " بِسْمِ")));
    calibrateIP();
  })().catch(err=>{ IP.loading = null; throw err; });
  return IP.loading;
}

// Word widths in em, measured once per font, used to fit each line of the 15-line page to the screen.
const cv = document.createElement("canvas").getContext("2d");
const wcache = new Map();
function em(word, font){
  const k = font+"|"+word; let v = wcache.get(k);
  if(v===undefined){ cv.font = '100px "'+font+'"'; cv.direction = "rtl"; v = cv.measureText(word).width/100; wcache.set(k,v); }
  return v;
}
const IP_GAP = 0.22;
const natEm = (words, font) => words.reduce((t,w)=>t+em(w,font),0) + (words.length-1)*IP_GAP;
let IP_REF = 12;
function calibrateIP(){
  const ws = [];
  for(let p=3;p<600;p+=7) for(const ln of IP.lines[p-1]) if(ln.t==="w" && !ln.c && ln.w.length>4) ws.push(natEm(ln.w.map(x=>x[1]), IP_FONTS[0]));
  ws.sort((a,b)=>a-b); IP_REF = ws[Math.floor(ws.length*0.82)] || 12;
}
const chapterCache = {};    // "lang/s" -> chapter json
let BASMALA = null;

/* Surah list (names and ayah counts are standard metadata, not Quran text). Used when the source index can't load. */
const SURAH_EN = "Al-Fatihah|Al-Baqarah|Ali 'Imran|An-Nisa|Al-Ma'idah|Al-An'am|Al-A'raf|Al-Anfal|At-Tawbah|Yunus|Hud|Yusuf|Ar-Ra'd|Ibrahim|Al-Hijr|An-Nahl|Al-Isra|Al-Kahf|Maryam|Taha|Al-Anbiya|Al-Hajj|Al-Mu'minun|An-Nur|Al-Furqan|Ash-Shu'ara|An-Naml|Al-Qasas|Al-'Ankabut|Ar-Rum|Luqman|As-Sajdah|Al-Ahzab|Saba|Fatir|Ya-Sin|As-Saffat|Sad|Az-Zumar|Ghafir|Fussilat|Ash-Shura|Az-Zukhruf|Ad-Dukhan|Al-Jathiyah|Al-Ahqaf|Muhammad|Al-Fath|Al-Hujurat|Qaf|Adh-Dhariyat|At-Tur|An-Najm|Al-Qamar|Ar-Rahman|Al-Waqi'ah|Al-Hadid|Al-Mujadilah|Al-Hashr|Al-Mumtahanah|As-Saff|Al-Jumu'ah|Al-Munafiqun|At-Taghabun|At-Talaq|At-Tahrim|Al-Mulk|Al-Qalam|Al-Haqqah|Al-Ma'arij|Nuh|Al-Jinn|Al-Muzzammil|Al-Muddaththir|Al-Qiyamah|Al-Insan|Al-Mursalat|An-Naba|An-Nazi'at|'Abasa|At-Takwir|Al-Infitar|Al-Mutaffifin|Al-Inshiqaq|Al-Buruj|At-Tariq|Al-A'la|Al-Ghashiyah|Al-Fajr|Al-Balad|Ash-Shams|Al-Layl|Ad-Duha|Ash-Sharh|At-Tin|Al-'Alaq|Al-Qadr|Al-Bayyinah|Az-Zalzalah|Al-'Adiyat|Al-Qari'ah|At-Takathur|Al-'Asr|Al-Humazah|Al-Fil|Quraysh|Al-Ma'un|Al-Kawthar|Al-Kafirun|An-Nasr|Al-Masad|Al-Ikhlas|Al-Falaq|An-Nas".split("|");
const SURAH_AR = "الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبإ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبإ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس".split(" ").map(x=>x.replace("_"," "));
const SURAH_N = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const MEDINAN = new Set([2,3,4,5,8,9,13,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110]);

// v6 ships dist/index.iife.js (per its README); later versions renamed it quran-meta.iife.js
const QM_IIFES = ["https://cdn.jsdelivr.net/npm/quran-meta@6.0.17/dist/index.iife.js",
                  "https://cdn.jsdelivr.net/npm/quran-meta@6.0.17/dist/quran-meta.iife.js"];
const loadScript = src => new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("could not load "+src)); document.head.append(s); });
const QM_HAFS = "https://cdn.jsdelivr.net/npm/quran-meta@6.0.17/hafs/+esm";
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error(what+" timed out")), ms))]);
const isFn = f => typeof f === "function";

/* The layout library has been published in several shapes: plain functions, functions that need the
   riwayah's data passed in, a ready-made `quran` object, or a createHafs() factory. Build every way of
   calling it that the loaded module offers, and keep the first one that gives the known Madani pages. */
function layoutCandidates(mod, label){
  const out = [];
  const add = (name, obj, extra=[]) => {
    if(!obj || (!isFn(obj.getAyahMeta) && !isFn(obj.findPage))) return;
    out.push({ name: label+" "+name,
      meta: isFn(obj.getAyahMeta) ? id => obj.getAyahMeta(id, ...extra) : null,
      page: isFn(obj.findPage) ? (s,a) => obj.findPage(s, a, ...extra) : null,
      juz:  isFn(obj.findJuz)  ? (s,a) => obj.findJuz(s, a, ...extra)  : null });
  };
  for(const root of [mod, mod && mod.default]){
    if(!root || typeof root !== "object" && !isFn(root)) continue;
    if(isFn(root.getListsOfRiwaya)){ try { add("with Hafs data", root, [root.getListsOfRiwaya("Hafs")]); } catch(e){} }
    for(const k of Object.keys(root)){
      const v = root[k];
      if(/^create(Hafs)?$/i.test(k) && isFn(v)){ try { const inst = k==="create" ? v("Hafs") : v(); add(k+"()", inst); } catch(e){} }
      else if(/hafs/i.test(k) && v && typeof v === "object"){ add(k, v); add("with "+k, root, [v]); }
    }
    add("quran object", root.quran);
    add("functions", root);
  }
  return out;
}
const pageOf = (c, s, a, id) => { const m = c.meta && c.meta(id); if(m && m.surah===s && m.ayah===a && m.page) return m.page; return c.page ? c.page(s,a) : undefined; };
function verifyLayout(c){
  // known pages of the 604-page Madani Mushaf: 1:1 → 1, 2:1 → 2, 2:255 → 42, 114:1 → 604
  const checks = [[1,1,1,1],[2,1,8,2],[2,255,262,42],[114,1,6231,604]];
  for(const [s,a,id,want] of checks){ const got = pageOf(c,s,a,id); if(got!==want) throw new Error(s+":"+a+" gave page "+got+", expected "+want); }
  return c;
}

async function getLayoutApi(){
  const notes = [];
  const tryModule = (mod, label) => {
    const cands = layoutCandidates(mod, label);
    if(!cands.length){ notes.push(label+": no page functions"); return null; }
    for(const c of cands){ try { return verifyLayout(c); } catch(e){ notes.push(c.name+": "+e.message); } }
    return null;
  };
  for(const [url,label] of [[QM_HAFS,"hafs module"],[QM,"module"]]){
    try { const r = tryModule(await withTimeout(import(url), 15000, label), label); if(r) return r; }
    catch(e){ notes.push(label+": "+e.message); }
  }
  for(const src of QM_IIFES){
    const label = src.split("/").pop();
    try { await withTimeout(loadScript(src), 15000, "layout script"); }
    catch(e){ notes.push(e.message); continue; }
    if(!window.quranMeta){ notes.push(label+" loaded but quranMeta was not found"); continue; }
    const r = tryModule(window.quranMeta, label); if(r) return r;
  }
  throw new Error("Page layout data: "+notes.join("; "));
}

let LOAD_NOTES = [];
async function loadMeta(){
  buildJuzMap();
  // surah index: built-in list first, enriched by the source's index when it loads
  INDEX = SURAH_EN.map((en,i)=>({id:i+1, name:SURAH_AR[i], transliteration:en, type:MEDINAN.has(i+1)?"medinan":"meccan", total_verses:SURAH_N[i]}));
  json("chapters/en/index.json").then(idx=>{
    if(Array.isArray(idx) && idx.length===114) idx.forEach((s,i)=>{ if(s && s.name) INDEX[i].name = s.name; if(s && s.type) INDEX[i].type = s.type; });
  }).catch(e=>LOAD_NOTES.push("surah index: "+e.message));

  const qm = await getLayoutApi();
  const e = newEdition(604);
  let id = 0;
  for(let s=1; s<=114; s++) for(let a=1; a<=SURAH_N[s-1]; a++){
    id++;
    let p, j;
    const m = qm.meta && qm.meta(id);
    if(m && m.surah===s && m.ayah===a){ p = m.page; j = m.juz; }
    if(!p && qm.page) p = qm.page(s, a);
    if(!j && qm.juz) j = qm.juz(s, a);
    if(!(p>=1 && p<=604)) throw new Error("Page layout data: no page for "+s+":"+a);
    (e.pages[p] ||= []).push([s,a]); e.ayahPage[key(s,a)] = p;
  }
  if(e.ayahPage["2:1"]!==2 || e.ayahPage["114:1"]!==604) throw new Error("Page layout data did not match the 604-page Madani Mushaf");
  ED.madani = finishEdition(e);
}
function chapterPath(lang, s){ return (lang==="none") ? "chapters/"+s+".json" : "chapters/"+lang+"/"+s+".json"; }
async function chapter(lang, s){
  const k = lang+"/"+s;
  if(!chapterCache[k]) chapterCache[k] = json(chapterPath(lang,s)).catch(e=>{ delete chapterCache[k]; throw e; });
  return chapterCache[k];
}
const verse = (ch, a) => (ch.verses || [])[a-1] || {};

/* ---------- rendering ---------- */
// Page colours. The preview colours here only draw the swatches in settings; the page itself uses styles.css.
const PAPERS = [
  {id:"auto", name:"Auto",  bg:"linear-gradient(135deg,#fbf8ee 50%,#161f1c 50%)", fg:"#1f5a4b"},
  {id:"white",name:"White", bg:"#ffffff", fg:"#121815"},
  {id:"cream",name:"Cream", bg:"#fbf8ee", fg:"#1d2421"},
  {id:"sepia",name:"Sepia", bg:"#f6edd8", fg:"#2f2416"},
  {id:"mint", name:"Mint",  bg:"#f0f8f3", fg:"#14231c"},
  {id:"night",name:"Night", bg:"#161f1c", fg:"#ebe4cf"},
  {id:"black",name:"Black", bg:"#050505", fg:"#e9e4d4"}
];
function applyStyle(){
  const sc = SCRIPTS.find(x=>x.id===S.script);
  const root = document.documentElement;
  root.style.setProperty("--f-quran", sc.font);
  root.style.setProperty("--qsize", S.size+"rem");
  if(!PAPERS.some(x=>x.id===S.paper)) S.paper = "auto";
  if(S.paper==="auto") delete root.dataset.paper; else root.dataset.paper = S.paper;
  // phone status bar colour follows the page
  let m = document.getElementById("paperColor");
  if(S.paper==="auto"){ if(m) m.remove(); }
  else {
    if(!m){ m = document.createElement("meta"); m.name = "theme-color"; m.id = "paperColor"; document.head.append(m); }
    m.content = getComputedStyle(root).getPropertyValue("--ground").trim();
  }
}

function surahHeadEl(s){
  const info = INDEX[s-1], sh = el("div",{class:"surah-head"});
  sh.append(el("span",{class:"meta"}, info.type==="medinan"?"مدنية":"مكية"), el("span",{class:"nm"},"سورة "+info.name), el("span",{class:"meta"},"آياتها "+AR(info.total_verses)));
  return sh;
}
const flagAyah = (node, k) => {
  if(S.current===k) node.classList.add("cur");
  if(S.bookmarks.includes(k)) node.classList.add("bm");
  if(S.highlights[k]) node.dataset.hl = S.highlights[k];
  if(S.sel===k) node.classList.add("sel");
  if(P.cur===k) node.classList.add("playing");
};

/* Side by side: each ayah of the page on its own row, translation on the left and Arabic on the right */
function renderRows(body, list, bySurah, ip, textErr){
  const T = TRANSLATIONS.find(t=>t.id===S.trans);
  body.style.setProperty("--ipr", (1.55*S.ipScale)+"rem");
  if(textErr) body.append(el("p",{class:"empty"},"The translation didn't load. Check your internet connection, then turn the page to try again."));
  else if(S.trans==="none" && !S.translit) body.append(el("p",{class:"empty"},"Choose a translation in Aa to show it beside the Arabic."));
  let cur = null;
  for(const [s,a] of list){
    const k = key(s,a);
    if(s!==cur){
      cur = s;
      if(a===1){
        body.append(surahHeadEl(s));
        if(s!==1 && s!==9){
          if(ip && IP.bismillah) body.append(el("div",{class:"basmala ipv"}, IP.bismillah.join(" ")));
          else if(!ip && BASMALA) body.append(el("div",{class:"basmala"}, BASMALA));
        }
      }
    }
    const row = el("div",{class:"vrow","data-k":k,role:"button",tabindex:"0","aria-label":INDEX[s-1].transliteration+" "+s+":"+a});
    flagAyah(row, k);
    const ar = el("div",{class:"var"+(ip?" ipv":"")});
    if(ip) IP.ayahWords[k].forEach((w,i)=>{ if(i) ar.append(" "); ar.append(w); });
    else { ar.append(verse(bySurah[s],a).text || "", " "); ar.append(el("span",{class:"end"},"﴿"+AR(a)+"﴾")); }
    const tr = el("div",{class:"vtr"});
    tr.append(el("span",{class:"ref"}, s+":"+a));
    const v = bySurah[s] ? verse(bySurah[s],a) : {};
    if(S.translit && v.transliteration) tr.append(el("p",{class:"tl"}, v.transliteration));
    if(S.trans!=="none" && v.translation) tr.append(el("p", T.rtl?{dir:"rtl"}:{}, v.translation));
    row.append(tr, ar);
    body.append(row);
  }
}

let renderToken = 0;
async function renderPage(){
  const token = ++renderToken;
  const ip = isIP();
  const p = S.page, list = PAGES[p] || [];
  const surahs = [...new Set(list.map(x=>x[0]))];
  $("where").textContent = "Page "+p+" of "+COUNT+" · Juz "+PAGE_JUZ[p];
  $("nextBtn").disabled = p>=COUNT; $("prevBtn").disabled = p<=1;
  $("pageJump").max = COUNT;
  if(!surahs.includes(+$("surahJump").value)){ $("surahJump").value = surahs[0] || 1; $("ayahJump").value = ""; }
  $("ayahJump").max = SURAH_N[(+$("surahJump").value || 1) - 1];
  $("juzJump").value = PAGE_JUZ[p]; $("pageJump").value = p;
  try{ history.replaceState(null,"",(ip?"#i":"#p")+p) }catch(e){}

  // Madani pages need the Uthmani text; IndoPak pages need it only for translations
  const side = S.layout==="side";
  let chs = null, textErr = null;
  if(!ip || S.trans!=="none" || S.translit){
    try{
      chs = await Promise.all(surahs.map(s => chapter(S.trans, s)));
      if(!ip && !BASMALA){ const f = await chapter(S.trans==="none"?"none":S.trans, 1); BASMALA = verse(f,1).text; }
    }catch(e){ textErr = e; }
  }
  if(token!==renderToken) return;
  if(textErr && !ip){ showError("The Mushaf text didn't load.", new Error("Quran text ("+S.trans+"): "+(textErr && textErr.message || textErr)), renderPage); return; }
  const bySurah = chs ? Object.fromEntries(surahs.map((s,i)=>[s,chs[i]])) : {};

  const page = $("page"); page.replaceChildren();
  if(list.some(([s,a])=>S.bookmarks.includes(key(s,a)))) page.append(el("div",{class:"ribbon","aria-hidden":"true"}));
  const fr = el("div",{class:"frame"+(ip?" ip":"")+(side?" rows":"")});
  const head = el("div",{class:"runhead"});
  head.append(el("span",{}, surahs.map(s=>"سورة "+INDEX[s-1].name).join(" · ")), el("span",{},"الجزء "+AR(PAGE_JUZ[p])));
  const body = el("div",{class:"body"});
  if(side){
    fr.append(head, body, el("div",{class:"folio"},AR(p)));
    page.append(fr);
    renderRows(body, list, bySurah, ip, ip ? textErr : null);
    $("trans").hidden = true;
    updatePlayer();
    return;
  }
  if(ip){
    fr.append(head, body, el("div",{class:"folio"},AR(p)));
    page.append(fr);
    layoutIndopak(body, p);
    renderTrans(list, bySurah, textErr);
    updatePlayer();
    return;
  }
  let para = null, curSurah = null;
  for(const [s,a] of list){
    if(s!==curSurah){
      curSurah = s;
      if(a===1){
        const info = INDEX[s-1], sh = el("div",{class:"surah-head"});
        sh.append(el("span",{class:"meta"}, info.type==="medinan"?"مدنية":"مكية"), el("span",{class:"nm"},"سورة "+info.name), el("span",{class:"meta"},"آياتها "+AR(info.total_verses)));
        body.append(sh);
        if(s!==1 && s!==9 && BASMALA) body.append(el("div",{class:"basmala"},BASMALA));
      }
      para = el("p",{class:"text"}); body.append(para);
    }
    const k = key(s,a), sp = el("span",{class:"ayah","data-k":k,role:"button",tabindex:"0","aria-label":INDEX[s-1].transliteration+" "+s+":"+a});
    if(S.bookmarks.includes(k)) sp.classList.add("bm");
    if(S.highlights[k]) sp.dataset.hl = S.highlights[k];
    if(S.sel===k) sp.classList.add("sel");
    if(S.current===k) sp.classList.add("cur");
    if(P.cur===k) sp.classList.add("playing");
    sp.append(document.createTextNode(verse(bySurah[s],a).text || ""), document.createTextNode(" "), el("span",{class:"end"},"﴿"+AR(a)+"﴾"));
    para.append(sp, document.createTextNode(" "));
  }
  fr.append(head, body, el("div",{class:"folio"},AR(p)));
  page.append(fr);
  renderTrans(list, bySurah);
  updatePlayer();
}

/* One IndoPak page: 15 fixed lines, each fitted to the page width like the printed copy.
   Lines too wide in the normal font use the compact, then compressed width of the same font. */
function layoutIndopak(body, p){
  const W = body.clientWidth * 0.985;   // small margin so waqf signs above the line ends stay inside the frame
  const F = W / IP_REF * 0.96, LH = F * 1.72;
  body.style.setProperty("--ipf", F+"px"); body.style.setProperty("--iplh", LH+"px");
  body.dataset.w = body.clientWidth;
  const ayahLen = k => IP.ayahWords[k].length;
  const wordSpan = (s,a,wn,txt,first) => {
    const k = key(s,a), sp = el("span",{class:"ayah w","data-k":k});
    if(first){ sp.tabIndex = 0; sp.setAttribute("role","button"); sp.setAttribute("aria-label",INDEX[s-1].transliteration+" "+s+":"+a); }
    if(wn===ayahLen(k)) sp.classList.add("endw");
    if(S.bookmarks.includes(k)) sp.classList.add("bm");
    if(S.highlights[k]) sp.dataset.hl = S.highlights[k];
    if(S.sel===k) sp.classList.add("sel");
    if(S.current===k) sp.classList.add("cur");
    if(P.cur===k) sp.classList.add("playing");
    sp.textContent = txt;
    return sp;
  };
  const surahHead = s => {
    const info = INDEX[s-1], sh = el("div",{class:"surah-head"});
    sh.append(el("span",{class:"meta"}, info.type==="medinan"?"مدنية":"مكية"), el("span",{class:"nm"},"سورة "+info.name), el("span",{class:"meta"},"آياتها "+AR(info.total_verses)));
    return sh;
  };

  // Larger text: the same words in the same order, wrapping onto as many lines as they need
  if(S.ipScale > 1.001){
    body.classList.add("ipflow-on");
    body.style.setProperty("--ipf", (F*S.ipScale)+"px");
    let para = null, prevK = null;
    for(const ln of IP.lines[p-1]){
      if(ln.t==="s"){ para = null; const d = el("div",{class:"ipl ips"}); d.append(surahHead(ln.s)); body.append(d); continue; }
      if(ln.t==="b"){ para = null; const d = el("div",{class:"ipflow ipb"}); IP.bismillah.forEach((w,i)=>{ if(i) d.append(" "); d.append(el("span",{class:"w"},w)); }); body.append(d); continue; }
      if(ln.t!=="w") continue;
      if(!para){ para = el("p",{class:"ipflow"}); body.append(para); }
      for(const [loc,txt] of ln.w){
        const [s,a,wn] = loc.split(":").map(Number), k = key(s,a);
        if(para.childNodes.length) para.append(" ");
        para.append(wordSpan(s,a,wn,txt,k!==prevK)); prevK = k;
      }
    }
    return;
  }

  for(const ln of IP.lines[p-1]){
    const d = el("div",{class:"ipl"});
    if(ln.t==="s"){
      d.classList.add("ips");
      d.append(surahHead(ln.s));
    } else if(ln.t==="b"){
      d.classList.add("ipc","ipb");
      for(const w of IP.bismillah) d.append(el("span",{class:"w"}, w));
    } else {
      if(ln.c) d.classList.add("ipc");
      const words = ln.w.map(x=>x[1]);
      let font = IP_FONTS[0];
      for(const f of IP_FONTS){ font = f; if(natEm(words,f)*F <= W) break; }
      d.style.fontFamily = '"'+font+'"';
      const nat = natEm(words,font)*F;
      if(nat > W) d.style.fontSize = (F*W/nat*0.995)+"px";
      let prevK = null;
      for(const [loc,txt] of ln.w){
        const [s,a,wn] = loc.split(":").map(Number), k = key(s,a);
        d.append(wordSpan(s,a,wn,txt,k!==prevK)); prevK = k;
      }
    }
    body.append(d);
  }
}

function renderTrans(list, bySurah, err){
  const box = $("trans");
  if(S.trans==="none" && !S.translit){ box.hidden = true; return; }
  box.hidden = false; box.replaceChildren();
  const T = TRANSLATIONS.find(t=>t.id===S.trans);
  box.append(el("h2",{}, S.trans==="none" ? "Transliteration" : T.name+" · "+T.cap+(S.translit?" · with transliteration":"")));
  if(err){ box.append(el("p",{class:"empty"},"The translation didn't load. Check your internet connection, then turn the page to try again.")); return; }
  for(const [s,a] of list){
    const v = verse(bySurah[s],a), k = key(s,a);
    const row = el("div",{class:"trow"+(P.cur===k?" playing":""),"data-k":k,role:"button",tabindex:"0"});
    if(S.highlights[k]) row.dataset.hl = S.highlights[k];
    if(S.current===k) row.classList.add("cur");
    const d = el("div");
    if(S.translit && v.transliteration) d.append(el("p",{class:"tl"},v.transliteration));
    if(S.trans!=="none" && v.translation) d.append(el("p", T.rtl?{dir:"rtl"}:{}, v.translation));
    row.append(el("span",{class:"ref"},s+":"+a), d);
    box.append(row);
  }
}

function fillJumps(){
  const sj = $("surahJump"); sj.replaceChildren();
  for(const s of INDEX){ const o = el("option",{value:s.id}, s.id+". "+s.transliteration+" · "+s.name); sj.append(o); }
  const jj = $("juzJump"); jj.replaceChildren();
  for(let j=1;j<=30;j++) jj.append(el("option",{value:j},"Juz "+j));
}

function updateCount(){ $("markCount").textContent = new Set([...S.bookmarks,...Object.keys(S.highlights)]).size; }
let READY = false; // page map loaded
function go(p, keepAudio){
  p = Math.max(1, Math.min(COUNT, p|0));
  if(!READY){ S.page = p; save(); return; } // remembered; the first render shows it
  if(p===S.page && !keepAudio) return;
  if(p!==S.page) anchorKey = null;
  S.page = p; S.sel = null; save(); renderPage(); if(!keepAudio) window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- recitation ----------
   Each surah plays as one continuous recording, and the app follows the ayat with timing data
   (data/timings, see data/SOURCES.md). One recording per surah is what lets iPhones keep reciting
   with the screen locked or in another app. If the timings can't load, the app falls back to one
   short file per ayah (EveryAyah), which iPhones stop at the end of an ayah when locked. */
const P = { audio:new Audio(), cur:null, playing:false, failed:false, mode:null, surah:null, rows:null, timings:null, timingsFor:null, seek:null, lock:null };
P.audio.preload = "auto";
window.mushafAudio = P.audio;   // lets the tests move through a recording
const ayahUrl = k => { const [s,a]=k.split(":").map(Number); return AUDIO+S.reciter+"/"+String(s).padStart(3,"0")+String(a).padStart(3,"0")+".mp3"; };
const audioUrl = k => P.mode==="surah" && P.timings ? P.timings.audio[k.split(":")[0]] : ayahUrl(k);
const TIMINGS = {};
function loadTimings(id){
  if(!TIMINGS[id]) TIMINGS[id] = fetch("data/timings/"+id+".json").then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(t=>{ for(const s in t.ayat) t.ayat[s].sort((x,y)=>x[1]-y[1]); return t; })
    .catch(e=>{ delete TIMINGS[id]; throw e; });
  return TIMINGS[id];
}
function useTimings(){ // ready-made timings for the chosen reciter, loading them if needed
  if(P.timingsFor===S.reciter && P.timings) return true;
  const id = S.reciter;
  loadTimings(id).then(t=>{ if(S.reciter===id){ P.timings = t; P.timingsFor = id; } }).catch(()=>{});
  return false;
}
function nextKey(k){
  const [s,a] = k.split(":").map(Number);
  if(a < SURAH_N[s-1]) return key(s,a+1);
  return s<114 ? key(s+1,1) : null;
}
function prevKey(k){
  const [s,a] = k.split(":").map(Number);
  if(a > 1) return key(s,a-1);
  return s>1 ? key(s-1,SURAH_N[s-2]) : null;
}
function setCur(k){
  if(k===P.cur) return;
  P.cur = k;
  if(!pageHas(S.page,k)) go(AYAH_PAGE[k],true); else markPlaying();
  updatePlayer();
}
/* Uninterrupted playback on iPhone. When a web app's audio reaches its natural end, iOS closes the app's
   audio session and, with the screen locked or another app open, won't let it start again. A pause or a
   seek keeps the session open. So the recording is set to loop and never ends on its own: shortly before
   the end the app pauses, switches to the next file and plays, all in one step; if a file does reach its
   end, the loop jumps to the start and the app treats that jump as the end. */
P.audio.loop = true;
let lastT = 0, selfSeekAt = 0, advancedAt = 0;
function startPlay(){
  if(navigator.audioSession){ try { navigator.audioSession.type = "playback"; } catch(e){} }   // media playback: not muted by the silent switch
  P.audio.play().then(()=>{ P.playing=true; P.failed=false; P.switching=false; updatePlayer(); keepAwake(true); })
    .catch(err=>{ if(err && err.name==="AbortError") return; P.switching=false; fallbackOrFail(); });
}
function fallbackOrFail(){
  if(P.mode==="surah" && P.cur){ P.mode = "ayah"; P.surah = null; playAyahFile(P.cur); return; }
  P.playing=false; P.failed=true; updatePlayer();
}
function setSrc(url){ lastT = 0; P.endAt = null; P.audio.src = url; }
function playAyahFile(k){
  P.mode = "ayah"; P.cur = k; P.failed = false; setSrc(ayahUrl(k));
  if(!pageHas(S.page,k)) go(AYAH_PAGE[k],true); else markPlaying();
  startPlay();
  const n = nextKey(k); if(n) prefetch(ayahUrl(n));
}
function playFrom(k){
  P.failed = false;
  if(!useTimings()) return playAyahFile(k);
  const T = P.timings, [s,a] = k.split(":").map(Number);
  const can = T.ayat[s].filter(r=>r.length===3);
  const row = can.find(r=>r[0]===a) || can.find(r=>r[0]>a);   // an ayah missing from a recording: start at the next one
  if(!row){ const n = s<114 ? key(s+1,1) : null; if(n) return playFrom(n); return; }
  P.mode = "surah";
  const url = T.audio[s];
  if(P.surah!==s || !P.audio.src || P.audio.src!==url){ setSrc(url); P.surah = s; P.rows = T.ayat[s]; }
  // where this surah's recitation ends: switch shortly after its last ayah, before the file runs out
  P.lastEnd = Math.max(...T.ayat[s].map(r=>r[2]));
  const at = (row[0]===1 ? 0 : row[1]) / 1000;   // ayah 1 starts with the Bismillah before it
  P.cur = null; setCur(key(s,row[0]));
  seekTo(at);
  startPlay();
}
function seekTo(sec){
  selfSeekAt = Date.now(); lastT = sec;
  if(P.audio.readyState >= 1){ try { P.audio.currentTime = sec; P.seek = null; return; } catch(e){} }
  P.seek = sec;
}
// what plays after the current surah or ayah (Aa › After a surah)
function nextItem(){
  if(P.mode==="surah"){
    if(S.afterSurah==="repeat") return key(P.surah,1);
    if(S.afterSurah==="stop") return null;
    return P.surah<114 ? key(P.surah+1,1) : null;
  }
  return P.cur ? nextKey(P.cur) : null;
}
function advance(){
  const now = Date.now(); if(now - advancedAt < 1500) return; advancedAt = now;
  const n = nextItem();
  P.switching = true;
  P.audio.pause();                        // pausing keeps the audio session open
  if(!n){ P.switching = false; P.playing = false; keepAwake(false); updatePlayer(); if(P.mode==="surah" && S.afterSurah==="stop") toast("Finished the surah"); return; }
  if(P.mode==="surah") playFrom(n); else playAyahFile(n);
}
let pre = null;
function prefetch(url){ // load the next file early so the switch is instant
  if(pre && pre.dataset.url===url) return;
  try { pre = new Audio(); pre.preload = "auto"; pre.muted = true; pre.dataset.url = url; pre.src = url; pre.load(); } catch(e){}
}
P.audio.addEventListener("loadedmetadata", ()=>{
  if(P.seek!=null){ try { P.audio.currentTime = P.seek; } catch(e){} P.seek = null; }
  if(P.mode==="surah" && P.lastEnd) P.endAt = Math.min(P.lastEnd + 700, P.audio.duration*1000 - 300);
});
// the loop jumped back to the start: the file reached its end
P.audio.addEventListener("seeking", ()=>{
  const t = P.audio.currentTime;
  if(Date.now() - selfSeekAt > 800 && lastT > 3 && t < 1.5 && lastT - t > 2) advance();
});
P.audio.addEventListener("timeupdate", ()=>{
  const t = P.audio.currentTime;
  if(P.seek==null && !P.switching){
    if(P.mode==="surah" && P.endAt && t*1000 >= P.endAt && t >= lastT) { lastT = t; return advance(); }
    if(P.mode==="ayah" && P.audio.duration > 1 && t >= P.audio.duration - 0.25 && t >= lastT) { lastT = t; return advance(); }
  }
  if(Date.now() - selfSeekAt > 300 || Math.abs(t - lastT) < 2) lastT = t;
  // follow the recording: which ayah is being recited right now
  if(P.mode!=="surah" || !P.rows || P.seek!=null) return;
  const ms = t*1000;
  let row = null;
  for(const r of P.rows){ if(r[1] <= ms + 40) row = r; else break; }
  if(row) setCur(key(P.surah,row[0]));
  if(P.endAt && P.endAt - ms < 90000){ const n = nextItem(); if(n && P.timings) prefetch(P.timings.audio[n.split(":")[0]]); }
});
P.audio.addEventListener("ended", advance);   // only if looping isn't honoured
P.audio.addEventListener("error", ()=>{ if(P.cur && P.audio.getAttribute("src")) fallbackOrFail(); });
// pauses and plays from the lock screen, headphones, the car or a phone call
P.audio.addEventListener("pause", ()=>{ if(P.switching) return; if(P.playing){ P.playing=false; keepAwake(false); updatePlayer(); } });
P.audio.addEventListener("play", ()=>{ if(!P.playing){ P.playing=true; updatePlayer(); } });
// iOS ignores lock-screen controls set before playback starts, so set them each time it does
P.audio.addEventListener("playing", ()=>{ P.switching = false; setMediaControls(); });
function togglePlay(){
  if(P.playing){ P.audio.pause(); P.playing=false; keepAwake(false); updatePlayer(); return; }
  if(P.cur && !P.failed && pageHas(S.page,P.cur) && P.audio.getAttribute("src")){ startPlay(); return; }
  if(S.current && pageHas(S.page,S.current)) return playFrom(S.current);
  const first = (PAGES[S.page]||[])[0]; if(first) playFrom(key(first[0],first[1]));
}
// lock-screen, headphone and car controls: previous and next ayah instead of 10-second skips
function setMediaControls(){
  if(!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession, on = (a,f)=>{ try { ms.setActionHandler(a,f); } catch(e){} };
  on("play", ()=>{ if(!P.playing) togglePlay(); });
  on("pause", ()=>{ if(P.playing) togglePlay(); });
  on("previoustrack", ()=>{ const k = P.cur && prevKey(P.cur); if(k){ P.audio.pause(); P.mode==="surah" ? playFrom(k) : playAyahFile(k); } });
  on("nexttrack", ()=>{ const k = P.cur && nextKey(P.cur); if(k){ P.audio.pause(); P.mode==="surah" ? playFrom(k) : playAyahFile(k); } });
  on("seekbackward", null); on("seekforward", null);
}
setMediaControls();
function updateMediaSession(rec){
  if(!("mediaSession" in navigator) || !P.cur) return;
  const [s,a] = P.cur.split(":").map(Number);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: INDEX[s-1].transliteration+" "+s+":"+a, artist: rec.name, album: "Mushaf Reader",
      artwork: [{src:"icons/icon-512.png",sizes:"512x512",type:"image/png"},{src:"icons/icon-192.png",sizes:"192x192",type:"image/png"}] });
    navigator.mediaSession.playbackState = P.playing ? "playing" : "paused";
  } catch(e){}
}
// optional: keep the screen on while reciting (Aa › Recitation)
async function keepAwake(on){
  try {
    if(on && S.wake && !P.lock && navigator.wakeLock){ P.lock = await navigator.wakeLock.request("screen"); P.lock.addEventListener("release", ()=>{ P.lock = null; }); }
    if(!on && P.lock){ const l = P.lock; P.lock = null; await l.release(); }
  } catch(e){ P.lock = null; }
}
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && P.playing) keepAwake(true); });
function markPlaying(){
  document.querySelectorAll(".playing").forEach(e=>e.classList.remove("playing"));
  if(!P.cur) return;
  document.querySelectorAll('[data-k="'+P.cur+'"]').forEach(e=>e.classList.add("playing"));
  const a = document.querySelector('#page [data-k="'+P.cur+'"]');
  if(a && P.playing) a.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function updatePlayer(){
  const rec = RECITERS.find(r=>r.id===S.reciter);
  $("playIcon").innerHTML = P.playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4l13 8-13 8z"/>';
  $("playBtn").setAttribute("aria-label", P.playing ? "Pause recitation" : "Play recitation");
  const sub = $("pSub"); sub.replaceChildren();
  if(P.cur){
    const [s,a] = P.cur.split(":").map(Number);
    $("pTitle").textContent = INDEX[s-1].transliteration+" "+s+":"+a+" · "+rec.name;
    if(P.failed){ sub.append("Playback is blocked here. "); const l = el("a",{href:audioUrl(P.cur),target:"_blank",rel:"noopener"},P.mode==="surah"?"Open this surah's audio":"Open this ayah's audio"); sub.append(l); }
    else sub.append(!P.playing ? "Paused" : P.mode==="surah" ? "Playing · keeps going with the screen locked" : "Playing ayah by ayah");
    updateMediaSession(rec);
  } else { $("pTitle").textContent = rec.name; sub.append("Tap play to recite from the top of this page"); }
  markPlaying();
}

/* ---------- sheets ---------- */
function openSheet(nodes){ const s=$("sheetInner"); s.replaceChildren(el("div",{class:"grip"}),...nodes); $("sheet").hidden=false; $("scrim").hidden=false; }
function closeSheet(){ $("sheet").hidden=true; $("scrim").hidden=true; if(S.sel){ document.querySelectorAll(".ayah.sel").forEach(e=>e.classList.remove("sel")); S.sel=null; } }

async function ayahSheet(k){
  S.sel = k;
  document.querySelectorAll(".ayah.sel").forEach(e=>e.classList.remove("sel"));
  document.querySelectorAll('.ayah[data-k="'+k+'"]').forEach(e=>e.classList.add("sel"));
  const [s,a] = k.split(":").map(Number), info = INDEX[s-1], ip = isIP();
  let v = {};
  try { v = verse(await chapter(S.trans, s), a); } catch(e){ if(!ip) throw e; }
  const bm = S.bookmarks.includes(k), hl = S.highlights[k];
  const h = el("h3",{}, info.transliteration); h.append(el("span",{}, s+":"+a+" · page "+AYAH_PAGE[k]));
  let ar;
  if(ip){ // the IndoPak words as stored; the ayah number is part of the text's last word
    ar = el("p",{class:"ar ipar"});
    IP.ayahWords[k].forEach((w,i)=>{ if(i) ar.append(" "); ar.append(el("span",{},w)); });
  } else { ar = el("p",{class:"ar"}, v.text); ar.append(" ", el("span",{class:"end"},"﴿"+AR(a)+"﴾")); }
  const nodes = [h, ar];
  if(S.trans!=="none" && v.translation){ const T=TRANSLATIONS.find(t=>t.id===S.trans); nodes.push(el("p",T.rtl?{class:"tr",dir:"rtl"}:{class:"tr"}, v.translation)); }
  const acts = el("div",{class:"row"});
  const bPlay = el("button",{class:"btn primary"},"Play from here"); bPlay.onclick = ()=>{ closeSheet(); playFrom(k); };
  const bBm = el("button",{class:"btn"}, bm?"Remove bookmark":"Bookmark");
  bBm.onclick = ()=>{ S.bookmarks = bm ? S.bookmarks.filter(x=>x!==k) : [...S.bookmarks,k]; save(); updateCount(); toast(bm?"Bookmark removed":"Bookmarked "+s+":"+a); renderPage().then(()=>ayahSheet(k)); };
  const bCopy = el("button",{class:"btn"},"Copy");
  // IndoPak ayah numbers and some waqf signs only display in its own font, so other apps get the
  // standard Unicode (Uthmani) text instead
  bCopy.onclick = async ()=>{
    let u = v;
    if(ip && !u.text){ try { u = verse(await chapter("none", s), a); } catch(e){ toast("Copy needs an internet connection the first time."); return; } }
    const txt = u.text+" ﴿"+AR(a)+"﴾\n"+(S.trans!=="none"&&v.translation? v.translation+"\n":"")+"— "+info.transliteration+" "+s+":"+a;
    const done = ip ? "Copied "+s+":"+a+" in Uthmani script" : "Copied "+s+":"+a;
    navigator.clipboard.writeText(txt).then(()=>toast(done)).catch(()=>{ const r=document.createRange(); r.selectNodeContents(ar); const sl=getSelection(); sl.removeAllRanges(); sl.addRange(r); toast("Text selected. Copy it from the menu."); });
  };
  acts.append(bPlay,bBm,bCopy);
  const hlRow = el("div",{class:"row"});
  for(const c of [...COLORS,""]){
    const sw = el("button",{class:"swatch "+(c||"none"),"aria-label":c?c+" highlight":"Remove highlight","aria-pressed":String((hl||"")===c)});
    sw.onclick = ()=>{ if(c) S.highlights[k]=c; else delete S.highlights[k]; save(); updateCount(); renderPage().then(()=>ayahSheet(k)); };
    hlRow.append(sw);
  }
  const f = el("div",{class:"field"}); f.append(el("span",{class:"lbl"},"Highlight"), hlRow);
  nodes.push(acts, f);
  openSheet(nodes);
}

function choice(label, id, opts, value, onPick, note){
  const f = el("div",{class:"field"}); f.append(el("span",{class:"lbl"},label));
  const seg = el("div",{class:"seg",id});
  for(const o of opts){
    const b = el("button",{"aria-pressed":String(value===o.v),"data-v":o.v});
    b.append(el("b",{},o.name), el("span",{class:"cap"},o.cap));
    b.onclick = ()=>onPick(o.v);
    seg.append(b);
  }
  f.append(seg); if(note) f.append(el("span",{class:"cap"},note));
  return f;
}
function settingsSheet(){
  const nodes = [el("h3",{},"Reading settings")];
  const fp = el("div",{class:"field"}); fp.append(el("span",{class:"lbl"},"Page colour"));
  const ps = el("div",{class:"paperseg",id:"paperSeg"});
  for(const x of PAPERS){
    const b = el("button",{"aria-pressed":String(S.paper===x.id),"data-v":x.id});
    const pv = el("span",{class:"pv",style:"background:"+x.bg+";color:"+x.fg},"Aa");
    b.append(pv, el("span",{}, x.name));
    b.onclick = ()=>{ S.paper = x.id; save(); applyStyle(); settingsSheet(); };
    ps.append(b);
  }
  fp.append(ps); nodes.push(fp);
  nodes.push(choice("Layout","layoutSeg",[
      {v:"page",name:"Mushaf page",cap:"Like the printed book"},
      {v:"side",name:"Side by side",cap:"Translation left, Arabic right"}],
    S.layout, v=>{ S.layout=v; save(); renderPage(); settingsSheet(); },
    S.layout==="side" && S.trans==="none" && !S.translit ? "Choose a translation below to show it beside the Arabic." : null));
  const f1 = el("div",{class:"field"}); f1.append(el("span",{class:"lbl"},"Mushaf script style"));
  const seg = el("div",{class:"seg",id:"scriptSeg"});
  for(const x of SCRIPTS){
    const b = el("button",{"aria-pressed":String(S.script===x.id),"data-script":x.id});
    const sample = el("span",{class:"sample",style:"font-family:"+x.font}, x.edition==="indopak" ? (IP.bismillah||[]).join(" ") : (BASMALA || ""));
    if(x.edition==="indopak" && !IP.bismillah) fetch("data/indopak-sample.json").then(r=>r.json()).then(d=>{ sample.textContent = d.bismillah.join(" "); }).catch(()=>{});
    b.append(sample, el("b",{},x.name), el("span",{class:"cap"},x.cap));
    b.onclick = ()=>setScript(x.id).then(settingsSheet);
    seg.append(b);
  }
  f1.append(seg); nodes.push(f1);

  const f2 = el("div",{class:"field"}); f2.append(el("label",{class:"lbl",for:"size"},"Text size"));
  if(isIP()){
    f2.firstChild.setAttribute("for","ipsize");
    const r = el("input",{type:"range",id:"ipsize",min:"1",max:"2.2",step:"0.05",value:String(S.ipScale)});
    const cap = el("span",{class:"cap",id:"ipsizeNote"});
    const note = ()=>{ cap.textContent = S.layout==="side" ? "Sets the size of the Arabic beside the translation."
      : S.ipScale > 1.001
      ? "Larger text: lines wrap to fit your screen. Move the slider all the way left to see the printed 15-line page."
      : "Printed page: the 15 lines match the Taj Mushaf. Move the slider right for larger text."; };
    let t; r.oninput = ()=>{ S.ipScale = +r.value; save(); note(); clearTimeout(t); t = setTimeout(renderPage, 60); };
    note(); f2.append(r, cap);
  } else {
    const r = el("input",{type:"range",id:"size",min:"1.2",max:"2.8",step:"0.05",value:String(S.size)});
    r.oninput = ()=>{ S.size=+r.value; applyStyle(); save(); }; f2.append(r);
  }
  nodes.push(f2);

  const f3 = el("div",{class:"field"}); f3.append(el("label",{class:"lbl",for:"transSel"},"Translation"));
  const ts = el("select",{id:"transSel"});
  for(const t of TRANSLATIONS){ const o=el("option",{value:t.id}, t.id==="none"?"Off (Mushaf only)":t.name+" · "+t.cap); if(S.trans===t.id) o.selected=true; ts.append(o); }
  ts.onchange = ()=>{ S.trans=ts.value; save(); renderPage(); };
  const cl = el("label",{class:"check"}); const cb = el("input",{type:"checkbox",id:"translit"}); cb.checked = S.translit;
  cb.onchange = ()=>{ S.translit=cb.checked; save(); renderPage(); }; cl.append(cb, "Show transliteration");
  f3.append(ts, cl); nodes.push(f3);

  nodes.push(choice("Tapping an ayah","tapSeg",[
      {v:"mark",name:"Marks your place",cap:"One ayah at a time · hold for the menu"},
      {v:"menu",name:"Opens the menu",cap:"Bookmark, copy, play"}],
    S.tapAction, v=>{ S.tapAction=v; save(); settingsSheet(); }));
  const fc = el("div",{class:"field"}); fc.append(el("span",{class:"lbl"},"Highlighter colour"));
  const cr = el("div",{class:"row",id:"hlColorSet"});
  for(const c of COLORS){
    const sw = el("button",{class:"swatch "+c,"data-c":c,"aria-label":c,"aria-pressed":String(S.hlColor===c)});
    sw.onclick = ()=>{ S.hlColor=c; hlErase=false; save(); updateHlBar(); settingsSheet(); };
    cr.append(sw);
  }
  fc.append(cr, el("span",{class:"cap"},"For lasting highlights: tap the highlighter button at the top, or hold an ayah."));
  nodes.push(fc);

  nodes.push(reciterField());
  openSheet(nodes);
}
// Change script style; moving between Madani and IndoPak keeps your place (the first ayah on the page).
let anchorKey = null; // the ayah that keeps your place when you switch edition
function pageAnchor(){
  if(anchorKey && pageHas(S.page, anchorKey)) return anchorKey;
  const list = PAGES[S.page] || [];
  const starts = list.find(([s,a])=>AYAH_PAGE[key(s,a)]===S.page) || list[0];
  return starts ? key(starts[0],starts[1]) : null;
}
async function setScript(id){
  const from = editionOf(S.script), to = editionOf(id);
  const anchor = READY ? pageAnchor() : null;
  if(to==="indopak" && !ED.indopak){
    showLoading("Loading the IndoPak Mushaf…");
    try { await loadIndopak(); }
    catch(e){ showError("The IndoPak Mushaf didn't load.", e, ()=>setScript(id)); return; }
  }
  S.script = id; applyStyle();
  if(from!==to){ useEdition(to); if(anchor){ S.page = AYAH_PAGE[anchor] || 1; anchorKey = anchor; } }
  save();
  if(READY) await renderPage();
}
function showLoading(msg){
  const page=$("page"); page.replaceChildren(); const fr=el("div",{class:"frame"}), st=el("div",{class:"state"});
  const sk=el("div",{class:"sk"}); for(let i=0;i<6;i++) sk.append(el("i")); st.append(sk, msg); fr.append(st); page.append(fr);
}

function reciterField(){
  const f = el("div",{class:"field"}); f.append(el("label",{class:"lbl",for:"recSel"},"Reciter"));
  const rs = el("select",{id:"recSel"});
  for(const r of RECITERS){ const o=el("option",{value:r.id},r.name); if(S.reciter===r.id) o.selected=true; rs.append(o); }
  rs.onchange = async ()=>{
    S.reciter=rs.value; save();
    const was=P.playing, cur=P.cur;
    P.audio.pause(); P.playing=false; P.surah=null; P.timings=null; P.timingsFor=null;
    try { P.timings = await loadTimings(S.reciter); P.timingsFor = S.reciter; } catch(e){}
    if(was&&cur) playFrom(cur); else { P.audio.removeAttribute("src"); updatePlayer(); }
    toast("Reciter: "+RECITERS.find(x=>x.id===S.reciter).name);
  };
  const wl = el("label",{class:"check"}); const wc = el("input",{type:"checkbox",id:"wakeChk"}); wc.checked = S.wake;
  wc.onchange = ()=>{ S.wake = wc.checked; save(); keepAwake(P.playing && S.wake); };
  wl.append(wc, "Keep the screen on while reciting");
  const as = el("label",{class:"lbl",for:"afterSel"},"After a surah");
  const asel = el("select",{id:"afterSel"});
  for(const [v,t] of [["next","Play the next surah (non-stop)"],["repeat","Repeat the surah"],["stop","Stop"]]){ const o=el("option",{value:v},t); if(S.afterSurah===v) o.selected=true; asel.append(o); }
  asel.onchange = ()=>{ S.afterSurah = asel.value; save(); };
  f.append(rs, wl, as, asel); return f;
}

function marksSheet(){
  const keys = [...new Set([...S.bookmarks,...Object.keys(S.highlights)])]
    .sort((x,y)=>{const[a,b]=x.split(":").map(Number),[c,d]=y.split(":").map(Number);return a-c||b-d});
  const h = el("h3",{},"Saved"); h.append(el("span",{}, keys.length+" ayat"));
  const nodes = [h];
  if(!keys.length) nodes.push(el("p",{class:"empty"},"Nothing saved yet. Tap an ayah on the page, then choose Bookmark or a highlight colour."));
  for(const k of keys){
    const [s,a]=k.split(":").map(Number), info=INDEX[s-1], hl=S.highlights[k], bm=S.bookmarks.includes(k);
    const b = el("button",{class:"bm-item"});
    const t = el("span",{class:"t"}); t.append(el("b",{}, info.transliteration+" "+s+":"+a), el("span",{}, [bm?"Bookmarked":"", hl?hl+" highlight":""].filter(Boolean).join(" · ")));
    b.append(el("span",{class:"dot "+(hl||"")}), t, el("span",{class:"pg"},"p. "+AYAH_PAGE[k]));
    b.onclick = ()=>{ closeSheet(); go(AYAH_PAGE[k]); setTimeout(()=>{ const e=document.querySelector('.ayah[data-k="'+k+'"]'); if(e){ e.scrollIntoView({block:"center",behavior:"smooth"}); e.classList.add("sel"); setTimeout(()=>e.classList.remove("sel"),1500);} },600); };
    nodes.push(b);
  }
  const nHl = Object.keys(S.highlights).length;
  if(nHl){
    const box = el("div",{class:"row clearhl"});
    const ask = el("button",{class:"btn",id:"clearHl"},"Remove all highlights");
    ask.onclick = ()=>{
      box.replaceChildren(el("span",{class:"cap"},"Remove "+nHl+" highlight"+(nHl>1?"s":"")+"? Bookmarks stay."));
      const yes = el("button",{class:"btn danger",id:"clearHlYes"},"Remove"), no = el("button",{class:"btn"},"Cancel");
      yes.onclick = ()=>{ S.highlights = {}; save(); updateCount(); renderPage(); marksSheet(); toast("Highlights removed"); };
      no.onclick = marksSheet;
      box.append(yes, no);
    };
    box.append(ask); nodes.push(box);
  }
  openSheet(nodes);
}

let tt; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,2000); }

/* ---------- events ---------- */
/* ---------- tapping ayat: menu, or quick highlighting in Highlight mode ---------- */
let hlMode = false;
function setHlMode(on){
  hlMode = on; if(!on) hlErase = false; $("hlbar").hidden = !on; document.body.classList.toggle("hl-on", on);
  $("hlBtn").setAttribute("aria-pressed", String(on));
  if(on) updateHlBar();
}
function updateHlBar(){
  document.querySelectorAll("#hlColors .swatch").forEach(b=>b.setAttribute("aria-pressed", String(hlErase ? b.dataset.c==="" : b.dataset.c===S.hlColor)));
}
// apply one ayah's highlight to everything showing it, without redrawing the page
function paintHl(k){
  document.querySelectorAll('[data-k="'+k+'"]').forEach(x=>{ if(S.highlights[k]) x.dataset.hl = S.highlights[k]; else delete x.dataset.hl; });
}
let hlErase = false;
function quickHighlight(k){
  const c = hlErase ? "" : S.hlColor, had = S.highlights[k];
  if(!c || had===c) delete S.highlights[k]; else S.highlights[k] = c;
  if(had===S.highlights[k]) return;
  save(); updateCount(); paintHl(k);
}
// Reading mode: a tap marks the ayah you are on (one at a time, nothing saved as a highlight)
function setCurrent(k){
  S.current = k; save();
  document.querySelectorAll(".cur").forEach(x=>x.classList.remove("cur"));
  if(k) document.querySelectorAll('[data-k="'+k+'"]').forEach(x=>{ if(!x.closest("#sheet")) x.classList.add("cur"); });
}
const tapHighlights = () => hlMode || S.tapAction!=="menu";   // taps that don't open the menu (so holding does)
function tapAyah(k){
  if(hlMode) return quickHighlight(k);
  if(S.tapAction==="menu") return ayahSheet(k);
  setCurrent(S.current===k ? null : k);
  if(!store.get("tipHold2",false)){ store.set("tipHold2",true); toast("Press and hold an ayah to bookmark, highlight, copy or play it."); }
}

let holdT = null, held = false;
const holdStart = e=>{
  const x = e.target.closest("[data-k]"); held = false; clearTimeout(holdT);
  if(!x || !tapHighlights()) return;
  holdT = setTimeout(()=>{ held = true; ayahSheet(x.dataset.k); }, 500);   // press and hold: full menu
};
const holdEnd = ()=>clearTimeout(holdT);
const pick = e=>{
  const x = e.target.closest("[data-k]"); if(!x) return;
  if(held){ held = false; return; }       // the hold already opened the menu
  tapAyah(x.dataset.k);
};
for(const id of ["page","trans"]){
  const box = $(id);
  box.addEventListener("click",pick);
  box.addEventListener("pointerdown",holdStart);
  for(const ev of ["pointerup","pointerleave","pointercancel","scroll"]) box.addEventListener(ev,holdEnd,{passive:true});
  box.addEventListener("contextmenu",e=>{ const x=e.target.closest("[data-k]"); if(x && tapHighlights()){ e.preventDefault(); clearTimeout(holdT); if(!held) ayahSheet(x.dataset.k); held = false; } });
}
window.addEventListener("scroll",holdEnd,{passive:true});
$("hlBtn").onclick = ()=>setHlMode(!hlMode);
$("hlDone").onclick = ()=>setHlMode(false);
$("hlColors").onclick = e=>{ const b = e.target.closest(".swatch"); if(!b) return; if(b.dataset.c){ S.hlColor = b.dataset.c; hlErase = false; save(); } else hlErase = true; updateHlBar(); };
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !$("sheet").hidden) return closeSheet();
  if((e.key==="Enter"||e.key===" ") && e.target.dataset && e.target.dataset.k){ e.preventDefault(); return tapAyah(e.target.dataset.k); }
  if(!$("sheet").hidden || /INPUT|SELECT/.test(e.target.tagName)) return;
  if(e.key==="ArrowLeft") go(S.page+1);
  if(e.key==="ArrowRight") go(S.page-1);
});
$("nextBtn").onclick=()=>go(S.page+1); $("prevBtn").onclick=()=>go(S.page-1);
$("openSettings").onclick=settingsSheet; $("openMarks").onclick=marksSheet; $("scrim").onclick=closeSheet;
$("playBtn").onclick=togglePlay;
$("reciterBtn").onclick=()=>openSheet([el("h3",{},"Recitation"), reciterField(), el("p",{class:"empty"},"Recitation follows each ayah and turns the page as it goes. It keeps playing with the screen locked, in other apps and in the car.")]);
$("surahJump").onchange=e=>{ const s=+e.target.value; $("ayahJump").value=""; $("ayahJump").max=SURAH_N[s-1]; go(SURAH_START[s]); };
// Go to an ayah of the chosen surah: open its page and briefly mark it
function goToAyah(s, a){
  a = Math.max(1, Math.min(SURAH_N[s-1], a|0 || 1));
  const k = key(s,a);
  $("surahJump").value = s; $("ayahJump").value = a;
  const mark = ()=>{
    const els = document.querySelectorAll('#page [data-k="'+k+'"]'); if(!els.length) return false;
    els[0].scrollIntoView({block:"center",behavior:"smooth"});
    els.forEach(x=>x.classList.add("flash")); setTimeout(()=>els.forEach(x=>x.classList.remove("flash")), 1800);
    return true;
  };
  if(pageHas(S.page,k)) mark();
  else { go(AYAH_PAGE[k]); let n=0; const t=setInterval(()=>{ if(mark() || ++n>40) clearInterval(t); },50); }
}
$("ayahJump").onchange=e=>{ if(e.target.value!=="") goToAyah(+$("surahJump").value, +e.target.value); };
$("ayahJump").onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); e.target.blur(); } };
$("juzJump").onchange=e=>go(JUZ_START[+e.target.value]);
$("pageJump").onchange=e=>go(+e.target.value);
let sx=null,sy=null;
$("page").addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
$("page").addEventListener("touchend",e=>{ if(sx===null) return; const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy; sx=null;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) go(S.page+(dx>0?1:-1)); },{passive:true}); /* RTL book: drag right = next page */
// Page links: #p42 is page 42 of the Madani Mushaf, #i42 page 42 of the IndoPak Mushaf.
// Read the page from the event's own URL: the app may already have rewritten location.hash.
async function openLink(hash){
  const m = /#([pi])(\d+)$/.exec(hash); if(!m) return;
  const wantIP = m[1]==="i", n = +m[2];
  if(wantIP !== isIP()){
    if(!READY){ S.script = wantIP ? "indopak" : "amiriq"; S.page = n; save(); return; }
    await setScript(wantIP ? "indopak" : "amiriq");
  }
  if(n!==S.page) go(n);
}
window.addEventListener("hashchange",e=>openLink(e.newURL || location.hash));

// highlight a whole ayah on hover (IndoPak ayat are split into separate words)
$("page").addEventListener("mouseover",e=>{
  const w = e.target.closest(".ip .ayah"); const k = w && w.dataset.k;
  document.querySelectorAll(".ip .ayah.hov").forEach(x=>{ if(x.dataset.k!==k) x.classList.remove("hov"); });
  if(k) document.querySelectorAll('.ip .ayah[data-k="'+k+'"]').forEach(x=>x.classList.add("hov"));
});
$("page").addEventListener("mouseleave",()=>document.querySelectorAll(".ip .ayah.hov").forEach(x=>x.classList.remove("hov")));

// IndoPak lines are fitted to the page width, so lay the page out again when the width changes
let rz; window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(()=>{
  const b = document.querySelector(".frame.ip .body"); if(b && Math.abs(b.clientWidth - (+b.dataset.w||0)) > 2) renderPage();
},150); });

/* ---------- start ---------- */
applyStyle(); updateCount();
{ const m = /^#([pi])(\d+)$/.exec(location.hash);
  if(m){ const wantIP = m[1]==="i"; if(wantIP!==isIP()) S.script = wantIP ? "indopak" : "amiriq"; S.page = +m[2]; } }
S.page = Math.max(1, Math.min(isIP()?610:604, S.page|0 || 1));
function showError(title, err, retry){
  const page=$("page"); page.replaceChildren(); const fr=el("div",{class:"frame"}), st=el("div",{class:"state err"});
  st.append(el("b",{},title), el("span",{},"Check your internet connection, then try again. If it keeps failing, send the details below."));
  const d = el("code",{style:"font-size:.72rem;color:var(--muted);word-break:break-word;max-width:100%"}, (err && err.message ? err.message : String(err)) + (LOAD_NOTES.length?" | "+LOAD_NOTES.join(" | "):""));
  st.append(d);
  if(retry){ const b=el("button",{class:"btn primary"},"Try again"); b.onclick=retry; st.append(b); }
  fr.append(st); page.append(fr); $("trans").hidden = true;
}
function start(){
  loadMeta().then(async ()=>{
    useEdition("madani");
    if(isIP()){
      showLoading("Loading the IndoPak Mushaf…");
      try { await loadIndopak(); useEdition("indopak"); }
      catch(e){ showError("The IndoPak Mushaf didn't load.", e, start); return; }
    }
    S.page = Math.max(1, Math.min(COUNT, S.page));
    READY = true; fillJumps(); renderPage(); useTimings();
  }).catch(e=>{ PAGES={}; AYAH_PAGE={}; JUZ_START={}; PAGE_JUZ={}; showError("The Mushaf page layout didn't load.", e, start); });
}
start();

/* ---------- installable app ---------- */
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Installed"); });
$("installBtn").onclick = async () => {
  if(installEvt){ installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("installBtn").hidden = true; return; }
  openSheet([el("h3",{},"Install on this device"),
    el("p",{class:"tr"},"iPhone or iPad: open this page in Safari, tap Share, then Add to Home Screen."),
    el("p",{class:"tr"},"Android: open the browser menu, then tap Install app or Add to Home screen.")]);
};
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if(!standalone && isIOS) $("installBtn").hidden = false;
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
