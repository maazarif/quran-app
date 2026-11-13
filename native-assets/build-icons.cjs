// Draws the app's gold-star mark (the same as the header and the web icons) at every size the Android and iOS
// apps and the store listings need. Run: node native-assets/build-icons.cjs  (needs Playwright)
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const R = path.resolve(__dirname, "..");
const grad = `<defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#2a6b5a"/><stop offset="1" stop-color="#174a3d"/></radialGradient>
  <linearGradient id="au" gradientUnits="userSpaceOnUse" x1="16" y1="3" x2="16" y2="29"><stop offset="0" stop-color="#e0bd6e"/><stop offset="1" stop-color="#b48c3e"/></linearGradient></defs>`;
const star = (cx, cy, scale) => `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-16 -16)">
  <rect x="7" y="7" width="18" height="18" rx="1.2" fill="url(#au)"/><rect x="7" y="7" width="18" height="18" rx="1.2" fill="url(#au)" transform="rotate(45 16 16)"/>
  <circle cx="16" cy="16" r="5.2" fill="#fbf8ee"/><circle cx="16" cy="16" r="2.2" fill="#1f5a4b"/></g>`;
// shape: "square" | "rounded" | "circle" | "none" (transparent, star only); frac: star radius as a share of the size
const icon = (w, h, frac, shape, extra = "") => { const s = Math.min(w, h), sc = s * frac / 12.7;
  const bg = shape === "none" ? "" : shape === "circle" ? `<circle cx="${w/2}" cy="${h/2}" r="${s/2}" fill="url(#g)"/>` : `<rect width="${w}" height="${h}" rx="${shape === "rounded" ? s*0.22 : 0}" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${grad}${bg}${extra || star(w/2, h/2, sc)}</svg>`; };
const jobs = [];
const A = R + "/android/app/src/main/res/";
for (const [d, n] of [["mdpi",48],["hdpi",72],["xhdpi",96],["xxhdpi",144],["xxxhdpi",192]]) {
  jobs.push([A+`mipmap-${d}/ic_launcher.png`, icon(n, n, .36, "rounded")]);
  jobs.push([A+`mipmap-${d}/ic_launcher_round.png`, icon(n, n, .34, "circle")]);
  const f = n * 108 / 48;   // adaptive icon layers are 108dp; the launcher shows the middle 72dp (safe zone 66dp)
  jobs.push([A+`mipmap-${d}/ic_launcher_foreground.png`, icon(f, f, .29, "none")]);
  jobs.push([A+`mipmap-${d}/ic_launcher_background.png`, icon(f, f, .29, "square", " ")]);
}
const I = R + "/ios/Mushaf/Assets.xcassets/AppIcon.appiconset/";
jobs.push([I + "AppIcon-1024.png", icon(1024, 1024, .34, "square")]);       // iOS rounds the corners itself; must be opaque
const S = R + "/native-assets/store/";
jobs.push([S + "play-icon-512.png", icon(512, 512, .34, "square")]);
jobs.push([S + "feature-graphic-1024x500.png", icon(1024, 500, .0, "square",
  star(250, 250, 500*.34/12.7) + `<text x="640" y="232" font-family="Amiri" font-weight="700" font-size="96" fill="#fbf8ee" text-anchor="middle">المصحف</text>
   <text x="640" y="320" font-family="Figtree" font-weight="600" font-size="44" fill="#e0bd6e" text-anchor="middle" letter-spacing="6">MUSHAF READER</text>`)]);
(async () => {
  const b = await chromium.launch();
  const fonts = `@font-face{font-family:Amiri;font-weight:700;src:url(data:font/woff;base64,${fs.readFileSync(R+"/fonts/quran/amiri-bold.woff").toString("base64")})}
    @font-face{font-family:Figtree;font-weight:300 900;src:url(data:font/woff;base64,${fs.readFileSync(R+"/fonts/quran/figtree.woff").toString("base64")})}`;
  for (const [file, svg] of jobs) {
    const [w, h] = svg.match(/width="([\d.]+)" height="([\d.]+)"/).slice(1).map(Number);
    const p = await b.newPage({ viewport: { width: Math.round(w), height: Math.round(h) } });
    await p.setContent(`<style>${fonts}</style><body style="margin:0;background:transparent">${svg}</body>`);
    await p.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const opaque = /AppIcon|play-icon|feature/.test(file);
    await p.screenshot({ path: file, omitBackground: !opaque, clip: { x: 0, y: 0, width: Math.round(w), height: Math.round(h) } });
    await p.close();
  }
  await b.close();
})();
