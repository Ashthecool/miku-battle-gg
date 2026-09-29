// Offline support. Code (html/js/css) is fetched network-first (skipping the browser's HTTP cache) so updates arrive whenever
// you're online; images come from the R2 bucket (MB.ASSET_BASE) and are cache-first.
// Music from the miku.gg CDN needs a connection; our own songs (assets/music/) are same-origin and kept once played.
// After changing images in the bucket, bump ASSETS so they are downloaded again.
const SHELL = 'mb-shell-v21';
const ASSETS = 'mb-assets-v4';
const SHELL_FILES = [
  './', 'index.html', 'css/style.css', 'lib/gsap.min.js', 'lib/CustomEase.min.js', 'lib/CustomWiggle.min.js', 'lib/Physics2DPlugin.min.js', 'lib/DrawSVGPlugin.min.js',
  'lib/MotionPathPlugin.min.js', 'lib/supabase.min.js', 'js/config.js', 'assets/manifest.js', 'js/avatars.js',
  'js/data.js', 'js/content.js', 'js/story.js', 'js/collection.js', 'js/missions.js', 'js/arena.js', 'js/net.js', 'js/effects.js', 'js/audio.js', 'js/engine.js', 'js/ai.js', 'js/fx.js', 'js/view.js', 'js/ui.js', 'js/scenefx.js', 'js/storymap.js', 'js/tutorial.js', 'js/result.js', 'js/cards.js', 'js/menutips.js', 'js/howto.js', 'js/main.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/attack-art.js', 'assets/attacks/magic.png', 'assets/attacks/props.png', 'assets/attacks/everyday.png',
];

// these scripts assign to window.MB / window.MIKU_MANIFEST
self.window = self;
importScripts('js/config.js', 'assets/manifest.js', 'js/avatars.js');

// the images to fetch up front: the small ones every menu shows (items, portraits, profile pictures, pack art,
// ~5 MB). Sprites and backgrounds (~130 MB, most never seen by a given player) are cached the first time they
// are shown instead: downloading them all for every new browser was nearly all of our old Supabase cached egress.
// NSFW entries only in NSFW mode (js/content.js).
function assetUrls(small, nsfw) {
  const out = new Set();
  (function walk(v) {
    if (typeof v === 'string') { if (/\.(webp|png|jpe?g|gif)$/i.test(v) && !/^(https?:|sprites\/|backgrounds\/)/.test(v)) out.add(MB.asset(v)); }
    else if (v && typeof v === 'object' && (nsfw || !v.nsfw)) Object.entries(v).forEach(([k, x]) => { if (k !== 'costumes') walk(x); });
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
    for (const u of assetUrls(e.data.small, e.data.nsfw)) if (!(await cache.match(u))) missing.push(u);
    // a few at a time so the game itself isn't starved of bandwidth
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.all(missing.slice(i, i + 6).map((u) => fetchAsset(u).then((res) => res.ok && cache.put(u, res)).catch(() => {})));
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
  const res = await fetchAsset(url);
  if (res.ok) cache.put(url, res.clone());
  return res;
}

// skips the browser's HTTP cache: R2 only sends Access-Control-Allow-Origin to requests with an Origin, and
// without Vary: Origin, so a copy cached from a plain <img> load (before this worker ran) would fail CORS
function fetchAsset(url) {
  return fetch(url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-cache' }); // revalidate: Pages lets browsers keep files for 10 minutes
    if (res.status === 200) cache.put(req, res.clone()); // not the partial (206) replies audio streams get: the cache refuses them
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
