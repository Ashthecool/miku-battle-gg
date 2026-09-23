// Offline support. Code (html/js/css) is fetched network-first (skipping the browser's HTTP cache) so updates arrive whenever
// you're online; images come from the Supabase bucket (MB.ASSET_BASE) and are cache-first.
// Music streams from the miku.gg CDN and needs a connection.
// After changing images in the bucket, bump ASSETS so they are downloaded again.
const SHELL = 'mb-shell-v3';
const ASSETS = 'mb-assets-v3';
const SHELL_FILES = [
  './', 'index.html', 'css/style.css', 'lib/gsap.min.js', 'js/config.js', 'assets/manifest.js', 'js/avatars.js',
  'js/data.js', 'js/audio.js', 'js/engine.js', 'js/ai.js', 'js/fx.js', 'js/view.js', 'js/ui.js', 'js/cards.js', 'js/main.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

// these scripts assign to window.MB / window.MIKU_MANIFEST
self.window = self;
importScripts('js/config.js', 'assets/manifest.js', 'js/avatars.js');

// every image the game shows: sprites (in the size this screen uses; the other size is cached when first
// shown), costumes, backgrounds, items, portraits, profile pictures, pack art
function assetUrls(small) {
  const out = new Set();
  (function walk(v) {
    if (typeof v === 'string') { if (/\.(webp|png|jpe?g|gif)$/i.test(v) && !/^https?:/.test(v)) out.add(v.startsWith('sprites/') ? MB.spriteSrc(v, !small) : MB.asset(v)); }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(self.MIKU_MANIFEST);
  MB.AVATARS.forEach((a) => out.add(MB.avatarUrl(a.id)));
  ['common', 'rare', 'epic'].forEach((t) => out.add(MB.packArt(t)));
  return [...out];
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    // no clients.claim(): taking over a page mid-session makes the browser fetch its already-loaded images
    // again (through here) instead of reusing the decoded ones, which is the lag the preload avoids.
    // The first visit runs without the worker; every later one starts under it.
  })());
});

// the page asks for this once it has loaded; downloads whatever images aren't cached yet
self.addEventListener('message', (e) => {
  if (!e.data || !e.data.precache) return;
  e.waitUntil((async () => {
    const cache = await caches.open(ASSETS);
    const missing = [];
    for (const u of assetUrls(e.data.small)) if (!(await cache.match(u))) missing.push(u);
    // a few at a time so the game itself isn't starved of bandwidth
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.all(missing.slice(i, i + 6).map((u) => cache.add(u).catch(() => {})));
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.startsWith(MB.ASSET_BASE)) e.respondWith(cacheFirst(req.url));
  else if (new URL(req.url).origin === location.origin) e.respondWith(networkFirst(req));
});

// keyed by URL; fetched with CORS (the bucket allows it) so the cached copy isn't an opaque response
async function cacheFirst(url) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(url);
  if (hit) return hit;
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (res.ok) cache.put(url, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-cache' }); // revalidate: Pages lets browsers keep files for 10 minutes
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
