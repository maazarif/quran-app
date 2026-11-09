/* ---------- sources (pinned versions; text is displayed exactly as received) ---------- */
const QJ = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/";
const QM = "https://cdn.jsdelivr.net/npm/quran-meta@6.0.17/+esm";
const AUDIO = "https://everyayah.com/data/";

const SCRIPTS = [
  {id:"amiriq", name:"Madani Mushaf", cap:"Amiri Quran", font:'"Amiri Quran","Amiri",serif'},
  {id:"scheh",  name:"Quranic Naskh", cap:"Scheherazade New", font:'"Scheherazade New","Amiri Quran",serif'},
  {id:"amiri",  name:"Classic Naskh", cap:"Amiri", font:'"Amiri","Amiri Quran",serif'},
  {id:"noto",   name:"Modern Naskh", cap:"Noto Naskh Arabic", font:'"Noto Naskh Arabic","Amiri Quran",serif'}
];
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
const S = {
  page: store.get("page",1), script: store.get("script","amiriq"), size: store.get("size",1.75),
  trans: store.get("trans","en"), translit: store.get("translit",false), reciter: store.get("reciter","Alafasy_128kbps"),
  bookmarks: store.get("bookmarks",[]), highlights: store.get("highlights",{}), sel:null
};
if(!SCRIPTS.some(x=>x.id===S.script)) S.script="amiriq";
if(!TRANSLATIONS.some(x=>x.id===S.trans)) S.trans="en";
if(!RECITERS.some(x=>x.id===S.reciter)) S.reciter="Alafasy_128kbps";
const save = () => ["page","script","size","trans","translit","reciter","bookmarks","highlights"].forEach(k=>store.set(k,S[k]));

/* ---------- data ---------- */
// On its own site the app can download the JSON files directly (they are served with CORS).
const json = async path => {
  const r = await fetch(QJ + path);
  if(!r.ok) throw new Error("HTTP " + r.status + " for " + path);
  return r.json();
};
let INDEX = [];             // surah list (id, name, transliteration, translation, type, total_verses)
let PAGES = {};             // page -> [[s,a],...]
let AYAH_PAGE = {};         // "s:a" -> page
let JUZ_START = {};         // juz -> page
let PAGE_JUZ = {};          // page -> juz
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
const usable = o => o && (typeof o.getAyahMeta==="function" || typeof o.findPage==="function");
function pickApi(o){ for(const c of [o, o&&o.default, o&&o.quran, o&&o.hafs, o&&o.default&&o.default.quran]) if(usable(c)) return c; return null; }
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error(what+" timed out")), ms))]);

async function getLayoutApi(){
  const notes = [];
  try { const api = pickApi(await withTimeout(import(QM), 15000, "layout module")); if(api) return api; notes.push("module loaded without page functions"); }
  catch(e){ notes.push("module: "+e.message); }
  for(const src of QM_IIFES){
    try { await withTimeout(loadScript(src), 15000, "layout script"); const api = pickApi(window.quranMeta); if(api) return api; notes.push(src.split("/").pop()+" loaded but quranMeta was not found"); }
    catch(e){ notes.push(e.message); }
  }
  throw new Error("Page layout data: "+notes.join("; "));
}

let LOAD_NOTES = [];
async function loadMeta(){
  // surah index: built-in list first, enriched by the source's index when it loads
  INDEX = SURAH_EN.map((en,i)=>({id:i+1, name:SURAH_AR[i], transliteration:en, type:MEDINAN.has(i+1)?"medinan":"meccan", total_verses:SURAH_N[i]}));
  json("chapters/en/index.json").then(idx=>{
    if(Array.isArray(idx) && idx.length===114) idx.forEach((s,i)=>{ if(s && s.name) INDEX[i].name = s.name; if(s && s.type) INDEX[i].type = s.type; });
  }).catch(e=>LOAD_NOTES.push("surah index: "+e.message));

  const qm = await getLayoutApi();
  const call = (fn, ...a) => (typeof qm[fn]==="function") ? qm[fn](...a) : undefined;
  let id = 0;
  for(let s=1; s<=114; s++) for(let a=1; a<=SURAH_N[s-1]; a++){
    id++;
    let p, j;
    const m = call("getAyahMeta", id);
    if(m && m.surah===s && m.ayah===a){ p = m.page; j = m.juz; }
    if(!p) p = call("findPage", s, a);
    if(!j) j = call("findJuz", s, a);
    if(!(p>=1 && p<=604)) throw new Error("Page layout data: no page for "+s+":"+a);
    (PAGES[p] ||= []).push([s,a]); AYAH_PAGE[key(s,a)] = p;
    if(j){ if(!(j in JUZ_START)) JUZ_START[j]=p; if(!(p in PAGE_JUZ)) PAGE_JUZ[p]=j; }
  }
  // fill any page whose juz wasn't reported from the page before it
  for(let p=1;p<=604;p++) if(!PAGE_JUZ[p]) PAGE_JUZ[p] = PAGE_JUZ[p-1] || 1;
  if(AYAH_PAGE["2:1"]!==2 || AYAH_PAGE["114:1"]!==604) throw new Error("Page layout data did not match the 604-page Madani Mushaf");
}
function chapterPath(lang, s){ return (lang==="none") ? "chapters/"+s+".json" : "chapters/"+lang+"/"+s+".json"; }
async function chapter(lang, s){
  const k = lang+"/"+s;
  if(!chapterCache[k]) chapterCache[k] = json(chapterPath(lang,s)).catch(e=>{ delete chapterCache[k]; throw e; });
  return chapterCache[k];
}
const verse = (ch, a) => (ch.verses || [])[a-1] || {};

/* ---------- rendering ---------- */
function applyStyle(){
  const sc = SCRIPTS.find(x=>x.id===S.script);
  document.documentElement.style.setProperty("--f-quran", sc.font);
  document.documentElement.style.setProperty("--qsize", S.size+"rem");
}

let renderToken = 0;
async function renderPage(){
  const token = ++renderToken;
  const p = S.page, list = PAGES[p] || [];
  const surahs = [...new Set(list.map(x=>x[0]))];
  $("where").textContent = "Page "+p+" of 604 · Juz "+PAGE_JUZ[p];
  $("nextBtn").disabled = p>=604; $("prevBtn").disabled = p<=1;
  $("surahJump").value = surahs[0]; $("juzJump").value = PAGE_JUZ[p]; $("pageJump").value = p;
  try{ history.replaceState(null,"","#p"+p) }catch(e){}

  let chs;
  try{
    chs = await Promise.all(surahs.map(s => chapter(S.trans, s)));
    if(!BASMALA){ const f = await chapter(S.trans==="none"?"none":S.trans, 1); BASMALA = verse(f,1).text; }
  }catch(e){
    if(token!==renderToken) return;
    showError("The Mushaf text didn't load.", new Error("Quran text ("+S.trans+"): "+(e && e.message || e)), renderPage); return;
  }
  if(token!==renderToken) return;
  const bySurah = Object.fromEntries(surahs.map((s,i)=>[s,chs[i]]));

  const page = $("page"); page.replaceChildren();
  if(list.some(([s,a])=>S.bookmarks.includes(key(s,a)))) page.append(el("div",{class:"ribbon","aria-hidden":"true"}));
  const fr = el("div",{class:"frame"});
  const head = el("div",{class:"runhead"});
  head.append(el("span",{}, surahs.map(s=>"سورة "+INDEX[s-1].name).join(" · ")), el("span",{},"الجزء "+AR(PAGE_JUZ[p])));
  const body = el("div",{class:"body"});
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
    if(P.cur===k) sp.classList.add("playing");
    sp.append(document.createTextNode(verse(bySurah[s],a).text || ""), document.createTextNode(" "), el("span",{class:"end"},"﴿"+AR(a)+"﴾"));
    para.append(sp, document.createTextNode(" "));
  }
  fr.append(head, body, el("div",{class:"folio"},AR(p)));
  page.append(fr);
  renderTrans(list, bySurah);
  updatePlayer();
}

function renderTrans(list, bySurah){
  const box = $("trans");
  if(S.trans==="none" && !S.translit){ box.hidden = true; return; }
  box.hidden = false; box.replaceChildren();
  const T = TRANSLATIONS.find(t=>t.id===S.trans);
  box.append(el("h2",{}, S.trans==="none" ? "Transliteration" : T.name+" · "+T.cap+(S.translit?" · with transliteration":"")));
  for(const [s,a] of list){
    const v = verse(bySurah[s],a), k = key(s,a);
    const row = el("div",{class:"trow"+(P.cur===k?" playing":""),"data-k":k,role:"button",tabindex:"0"});
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
  p = Math.max(1, Math.min(604, p|0));
  if(!READY){ S.page = p; save(); return; } // remembered; the first render shows it
  if(p===S.page && !keepAudio) return;
  S.page = p; S.sel = null; save(); renderPage(); if(!keepAudio) window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- recitation ---------- */
const P = { audio:new Audio(), cur:null, playing:false, failed:false };
P.audio.preload = "auto";
const audioUrl = k => { const [s,a]=k.split(":").map(Number); return AUDIO+S.reciter+"/"+String(s).padStart(3,"0")+String(a).padStart(3,"0")+".mp3"; };
function nextKey(k){
  const [s,a] = k.split(":").map(Number);
  if(a < INDEX[s-1].total_verses) return key(s,a+1);
  return s<114 ? key(s+1,1) : null;
}
function playFrom(k){
  P.cur = k; P.failed = false; P.audio.src = audioUrl(k);
  const p = AYAH_PAGE[k]; if(p!==S.page) go(p,true); else markPlaying();
  P.audio.play().then(()=>{ P.playing=true; updatePlayer(); }).catch(()=>{ P.playing=false; P.failed=true; updatePlayer(); });
}
P.audio.addEventListener("ended", ()=>{ const n = nextKey(P.cur); if(n) playFrom(n); else { P.playing=false; updatePlayer(); } });
P.audio.addEventListener("error", ()=>{ if(P.cur){ P.playing=false; P.failed=true; updatePlayer(); } });
function togglePlay(){
  if(P.playing){ P.audio.pause(); P.playing=false; updatePlayer(); return; }
  if(P.cur && !P.failed && AYAH_PAGE[P.cur]===S.page && P.audio.src){ P.audio.play().then(()=>{P.playing=true;updatePlayer()}).catch(()=>{P.failed=true;updatePlayer()}); return; }
  const first = (PAGES[S.page]||[])[0]; if(first) playFrom(key(first[0],first[1]));
}
function markPlaying(){
  document.querySelectorAll(".playing").forEach(e=>e.classList.remove("playing"));
  if(!P.cur) return;
  document.querySelectorAll('[data-k="'+P.cur+'"]').forEach(e=>e.classList.add("playing"));
  const a = document.querySelector('.ayah[data-k="'+P.cur+'"]');
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
    if(P.failed){ sub.append("Playback is blocked here. "); const l = el("a",{href:audioUrl(P.cur),target:"_blank",rel:"noopener"},"Open this ayah's audio"); sub.append(l); }
    else sub.append(P.playing ? "Playing, continues ayah by ayah" : "Paused");
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
  const [s,a] = k.split(":").map(Number), info = INDEX[s-1];
  const ch = await chapter(S.trans, s), v = verse(ch,a);
  const bm = S.bookmarks.includes(k), hl = S.highlights[k];
  const h = el("h3",{}, info.transliteration); h.append(el("span",{}, s+":"+a+" · page "+AYAH_PAGE[k]));
  const ar = el("p",{class:"ar"}, v.text); ar.append(" ", el("span",{class:"end"},"﴿"+AR(a)+"﴾"));
  const nodes = [h, ar];
  if(S.trans!=="none" && v.translation){ const T=TRANSLATIONS.find(t=>t.id===S.trans); nodes.push(el("p",T.rtl?{class:"tr",dir:"rtl"}:{class:"tr"}, v.translation)); }
  const acts = el("div",{class:"row"});
  const bPlay = el("button",{class:"btn primary"},"Play from here"); bPlay.onclick = ()=>{ closeSheet(); playFrom(k); };
  const bBm = el("button",{class:"btn"}, bm?"Remove bookmark":"Bookmark");
  bBm.onclick = ()=>{ S.bookmarks = bm ? S.bookmarks.filter(x=>x!==k) : [...S.bookmarks,k]; save(); updateCount(); toast(bm?"Bookmark removed":"Bookmarked "+s+":"+a); renderPage().then(()=>ayahSheet(k)); };
  const bCopy = el("button",{class:"btn"},"Copy");
  bCopy.onclick = ()=>{
    const txt = v.text+" ﴿"+AR(a)+"﴾\n"+(S.trans!=="none"&&v.translation? v.translation+"\n":"")+"— "+info.transliteration+" "+s+":"+a;
    navigator.clipboard.writeText(txt).then(()=>toast("Copied "+s+":"+a)).catch(()=>{ const r=document.createRange(); r.selectNodeContents(ar); const sl=getSelection(); sl.removeAllRanges(); sl.addRange(r); toast("Text selected. Copy it from the menu."); });
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

function settingsSheet(){
  const nodes = [el("h3",{},"Reading settings")];
  const f1 = el("div",{class:"field"}); f1.append(el("span",{class:"lbl"},"Mushaf script style"));
  const seg = el("div",{class:"seg"});
  for(const x of SCRIPTS){
    const b = el("button",{"aria-pressed":String(S.script===x.id)});
    const sample = el("span",{class:"sample",style:"font-family:"+x.font}, BASMALA || "");
    b.append(sample, el("b",{},x.name), el("span",{class:"cap"},x.cap));
    b.onclick = ()=>{ S.script=x.id; save(); applyStyle(); settingsSheet(); };
    seg.append(b);
  }
  f1.append(seg); nodes.push(f1);

  const f2 = el("div",{class:"field"}); f2.append(el("label",{class:"lbl",for:"size"},"Text size"));
  const r = el("input",{type:"range",id:"size",min:"1.2",max:"2.8",step:"0.05",value:String(S.size)});
  r.oninput = ()=>{ S.size=+r.value; applyStyle(); save(); }; f2.append(r); nodes.push(f2);

  const f3 = el("div",{class:"field"}); f3.append(el("label",{class:"lbl",for:"transSel"},"Translation"));
  const ts = el("select",{id:"transSel"});
  for(const t of TRANSLATIONS){ const o=el("option",{value:t.id}, t.id==="none"?"Off (Mushaf only)":t.name+" · "+t.cap); if(S.trans===t.id) o.selected=true; ts.append(o); }
  ts.onchange = ()=>{ S.trans=ts.value; save(); renderPage(); };
  const cl = el("label",{class:"check"}); const cb = el("input",{type:"checkbox",id:"translit"}); cb.checked = S.translit;
  cb.onchange = ()=>{ S.translit=cb.checked; save(); renderPage(); }; cl.append(cb, "Show transliteration");
  f3.append(ts, cl); nodes.push(f3);

  nodes.push(reciterField());
  openSheet(nodes);
}
function reciterField(){
  const f = el("div",{class:"field"}); f.append(el("label",{class:"lbl",for:"recSel"},"Reciter"));
  const rs = el("select",{id:"recSel"});
  for(const r of RECITERS){ const o=el("option",{value:r.id},r.name); if(S.reciter===r.id) o.selected=true; rs.append(o); }
  rs.onchange = ()=>{ S.reciter=rs.value; save(); const was=P.playing, cur=P.cur; P.audio.pause(); P.playing=false; if(was&&cur) playFrom(cur); else { P.audio.removeAttribute("src"); updatePlayer(); } toast("Reciter: "+RECITERS.find(x=>x.id===S.reciter).name); };
  f.append(rs); return f;
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
  openSheet(nodes);
}

let tt; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,2000); }

/* ---------- events ---------- */
const pick = e=>{ const x=e.target.closest("[data-k]"); if(x) ayahSheet(x.dataset.k); };
$("page").addEventListener("click",pick); $("trans").addEventListener("click",pick);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !$("sheet").hidden) return closeSheet();
  if((e.key==="Enter"||e.key===" ") && e.target.dataset && e.target.dataset.k){ e.preventDefault(); return ayahSheet(e.target.dataset.k); }
  if(!$("sheet").hidden || /INPUT|SELECT/.test(e.target.tagName)) return;
  if(e.key==="ArrowLeft") go(S.page+1);
  if(e.key==="ArrowRight") go(S.page-1);
});
$("nextBtn").onclick=()=>go(S.page+1); $("prevBtn").onclick=()=>go(S.page-1);
$("openSettings").onclick=settingsSheet; $("openMarks").onclick=marksSheet; $("scrim").onclick=closeSheet;
$("playBtn").onclick=togglePlay;
$("reciterBtn").onclick=()=>openSheet([el("h3",{},"Recitation"), reciterField(), el("p",{class:"empty"},"Recitation plays ayah by ayah and turns the page as it goes.")]);
$("surahJump").onchange=e=>go(AYAH_PAGE[key(+e.target.value,1)]);
$("juzJump").onchange=e=>go(JUZ_START[+e.target.value]);
$("pageJump").onchange=e=>go(+e.target.value);
let sx=null,sy=null;
$("page").addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
$("page").addEventListener("touchend",e=>{ if(sx===null) return; const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy; sx=null;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) go(S.page+(dx>0?1:-1)); },{passive:true}); /* RTL book: drag right = next page */
window.addEventListener("hashchange",()=>{ const m=/^#p(\d+)$/.exec(location.hash); if(m && +m[1]!==S.page) go(+m[1]); });

/* ---------- start ---------- */
applyStyle(); updateCount();
const hp = /^#p(\d+)$/.exec(location.hash); if(hp) S.page = +hp[1];
S.page = Math.max(1, Math.min(604, S.page|0 || 1));
function showError(title, err, retry){
  const page=$("page"); page.replaceChildren(); const fr=el("div",{class:"frame"}), st=el("div",{class:"state err"});
  st.append(el("b",{},title), el("span",{},"Check your internet connection, then try again. If it keeps failing, send the details below."));
  const d = el("code",{style:"font-size:.72rem;color:var(--muted);word-break:break-word;max-width:100%"}, (err && err.message ? err.message : String(err)) + (LOAD_NOTES.length?" | "+LOAD_NOTES.join(" | "):""));
  st.append(d);
  if(retry){ const b=el("button",{class:"btn primary"},"Try again"); b.onclick=retry; st.append(b); }
  fr.append(st); page.append(fr); $("trans").hidden = true;
}
function start(){
  loadMeta().then(()=>{ READY = true; fillJumps(); renderPage(); }).catch(e=>{ PAGES={}; AYAH_PAGE={}; JUZ_START={}; PAGE_JUZ={}; showError("The Mushaf page layout didn't load.", e, start); });
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
