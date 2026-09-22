// Offline support. Code (html/js/css) is fetched network-first so updates arrive whenever
// you're online; images are cache-first. Music streams from the miku.gg CDN and needs a connection.
// After re-running tools/fetch_assets.py, bump ASSETS so changed images are downloaded again.
const SHELL = 'mb-shell-v1';
const ASSETS = 'mb-assets-v1';
const SHELL_FILES = [
  './', 'index.html', 'css/style.css', 'lib/gsap.min.js', 'assets/manifest.js',
  'js/data.js', 'js/audio.js', 'js/engine.js', 'js/ai.js', 'js/fx.js', 'js/view.js', 'js/ui.js', 'js/cards.js', 'js/main.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

// the asset manifest assigns to window.MIKU_MANIFEST
self.window = self;
importScripts('assets/manifest.js');

// every local image the manifest mentions: sprites, costumes, backgrounds, items, portraits
function assetUrls() {
  const out = new Set();
  (function walk(v) {
    if (typeof v === 'string') { if (/\.(webp|png|jpe?g|gif)$/i.test(v) && !/^https?:/.test(v)) out.add('assets/' + v); }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(self.MIKU_MANIFEST);
  return [...out];
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the page asks for this once it has loaded; downloads whatever images aren't cached yet
self.addEventListener('message', (e) => {
  if (e.data !== 'precache') return;
  e.waitUntil((async () => {
    const cache = await caches.open(ASSETS);
    const missing = [];
    for (const u of assetUrls()) if (!(await cache.match(u))) missing.push(u);
    // a few at a time so the game itself isn't starved of bandwidth
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.all(missing.slice(i, i + 6).map((u) => cache.add(u).catch(() => {})));
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isImage = url.pathname.includes('/assets/') && /\.(webp|png|jpe?g|gif)$/i.test(url.pathname);
  e.respondWith(isImage ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
