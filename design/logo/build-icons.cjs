const { chromium } = require("playwright"); const fs=require("fs");
const FONT="/tmp/claude-0/-home-claude/4321288f-b32d-5eae-b43e-b495976a0547/scratchpad/gf/repo/ofl/katibeh/Katibeh-Regular.ttf";   // Katibeh (SIL OFL)
const OUT="/home/claude/quran-app/icons/";
const {bars}=JSON.parse(fs.readFileSync("opts.json"));
const logo=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="VB">
 <g fill="#424243">${bars}</g>
 <g font-family="AmiriLogo" font-weight="400" fill="#d0ad0e" stroke="#13131c" stroke-width="10" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" direction="rtl">
  <text x="220" y="63.0" font-size="153.4">القرآن</text>
  <text x="220" y="200.0" font-size="132.2">الكريم</text>
 </g></svg>`;
let LOGO;
fs.writeFileSync("/dev/null", logo.replace('font-family="AmiriLogo"','font-family="Katibeh"'));
const face=`@font-face{font-family:AmiriLogo;font-weight:400;src:url(data:font/ttf;base64,${fs.readFileSync(FONT).toString("base64")})}`;
// [file, size, logo width share, rounded corners]
const jobs=[["icon-192.png",192,.74,true],["icon-512.png",512,.74,true],["maskable-512.png",512,.64,false],
  ["apple-touch-icon.png",180,.76,false],["artwork-512.png",512,.64,false],["artwork-256.png",256,.64,false],
  ["logo-64.png",64,.8,true],["logo-128.png",128,.8,true]];
(async()=>{ const b=await chromium.launch();
  // frame the drawing around the real ink of the letters (canvas measures it), so nothing — not even the madda — is cut off
  { const p=await b.newPage(); await p.setContent(`<style>${face}</style><canvas></canvas>`); await p.evaluate(()=>document.fonts.load('40px AmiriLogo','القرآن'));
    const top=await p.evaluate(()=>{ const c=document.querySelector("canvas").getContext("2d"); c.font="153.4px AmiriLogo"; c.direction="rtl"; return 63 - c.measureText("القرآن").actualBoundingBoxAscent; });
    const y0=Math.floor(top-14); LOGO=logo.replace("VB",`20 ${y0} 400 ${400-y0}`); console.log("ink top", top.toFixed(1), "frame from y", y0); await p.close(); }
  fs.writeFileSync("/home/claude/quran-app/design/logo/logo.svg", LOGO.replace('font-family="AmiriLogo"','font-family="Katibeh"'));
  for(const [f,size,share,round] of jobs){
    const p=await b.newPage({viewport:{width:size,height:size}});
    await p.setContent(`<style>${face}</style><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:#13131c;border-radius:${round?size*.22:0}px;display:flex;align-items:center;justify-content:center">${LOGO.replace("<svg ",`<svg style="width:${size*share}px;height:auto" `)}</div></body>`);
    await p.evaluate(()=>document.fonts.ready);
    const ok=await p.evaluate(()=>document.fonts.check('40px AmiriLogo','القرآن')); if(!ok) throw new Error("font not loaded");
    const r=await p.evaluate(()=>{ const t=[...document.querySelectorAll("text")].map(e=>e.getBoundingClientRect()); const s=document.querySelector("svg").getBoundingClientRect(); return {s:[s.top,s.bottom], t:t.map(x=>[x.top,x.bottom])}; });
    await p.screenshot({path:OUT+f,omitBackground:true,clip:{x:0,y:0,width:size,height:size}});
  } await b.close(); })();
