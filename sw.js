// Service worker: makes the app installable and lets pages you've opened work offline.
const VERSION = "mushaf-v24";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/artwork-512.png", "icons/artwork-256.png",
  // the default Mushaf font and the interface fonts, so the text draws correctly the first time the app opens offline
  "fonts/quran/amiri-quran.woff", "fonts/quran/amiri-regular.woff", "fonts/quran/amiri-bold.woff", "fonts/quran/figtree.woff"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + "-data").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The layout library and translations come from version-pinned URLs that never change,
// so once fetched they are served from the cache.
const IMMUTABLE = url => url.hostname === "cdn.jsdelivr.net";
const AUDIO_HOST = /(^|\.)(everyayah\.com|mp3quran\.net|tarteel\.ai|quranicaudio\.com)$/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Recitation audio streams straight from the network to the player, never through here. The player fetches a
  // recording in small pieces (range requests); passing each piece through the service worker (and trying to cache
  // it) made playback break up for a moment every few seconds, notably on iPhone and over CarPlay.
  if (req.destination === "audio" || req.destination === "video" || req.headers.has("range") || AUDIO_HOST.test(url.hostname)) return;

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
  // app files: latest version when online, saved copy when offline
  e.respondWith(fetch(req).then(res => { if (res.ok) put(VERSION, req, res.clone()); return res; })
    .catch(() => caches.match(req)));
});

function put(cache, req, res) { caches.open(cache).then(c => c.put(req, res)).catch(() => {}); }
