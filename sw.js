// Service worker: makes the app installable and lets pages you've opened work offline.
const VERSION = "mushaf-v4";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + "-data").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Quran text, layout library and font files come from version-pinned URLs that never change,
// so once fetched they are served from the cache.
const IMMUTABLE = url => url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "everyayah.com") return; // audio streams straight from the network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => { put(VERSION, "index.html", res.clone()); return res; })
      .catch(() => caches.match("index.html")));
    return;
  }
  // bundled IndoPak text and fonts: large and unchanging (a new version gets a new file name)
  const BUNDLED = url.origin === self.location.origin && /\/(data|fonts)\//.test(url.pathname);
  if (IMMUTABLE(url) || BUNDLED) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") put(VERSION + "-data", req, res.clone());
      return res;
    })));
    return;
  }
  // app files and the fonts stylesheet: latest version when online, saved copy when offline
  e.respondWith(fetch(req).then(res => { if (res.ok) put(VERSION, req, res.clone()); return res; })
    .catch(() => caches.match(req)));
});

function put(cache, req, res) { caches.open(cache).then(c => c.put(req, res)).catch(() => {}); }
