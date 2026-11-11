const { chromium } = require("playwright"); const fs=require("fs");
const svg=fs.readFileSync("logo-hybrid.svg","utf8");
const OUT="/home/claude/quran-app/icons/";
// [file, size, logo width as share of the canvas, rounded corners]
const jobs=[["icon-192.png",192,.74,true],["icon-512.png",512,.74,true],["maskable-512.png",512,.6,false],
  ["apple-touch-icon.png",180,.76,false],["artwork-512.png",512,.6,false],["artwork-256.png",256,.6,false],
  ["logo-64.png",64,.86,true],["logo-128.png",128,.86,true]];
(async()=>{ const b=await chromium.launch();
  for(const [f,size,share,round] of jobs){
    const p=await b.newPage({viewport:{width:size,height:size}});
    await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:#13131c;border-radius:${round?size*.22:0}px;display:flex;align-items:center;justify-content:center">${svg.replace("<svg ",`<svg style="width:${size*share}px;height:auto;margin-top:${size*.01}px" `)}</div></body>`);
    await p.waitForTimeout(150);
    await p.screenshot({path:OUT+f,omitBackground:true,clip:{x:0,y:0,width:size,height:size}});
  } await b.close(); })();
