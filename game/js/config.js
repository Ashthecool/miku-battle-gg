// Where the images live: the public Cloudflare R2 "game-assets" bucket (filled by tools/fetch_assets.py,
// tools/sync_avatars.py and tools/sync_maps.py; R2 has no egress fees). Paths in assets/manifest.js and
// js/avatars.js are relative to it.
// Also loaded by sw.js, so keep it free of DOM access.
window.MB = window.MB || {};
MB.ASSET_BASE = 'https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/';
// full URLs (the Card Maker's sprites straight from the miku.gg CDN) are used as they are
const ABSOLUTE = /^(https?:|data:|blob:)/;
MB.asset = (path) => ABSOLUTE.test(path) ? path : path.startsWith('local/') ? 'assets/' + path : MB.ASSET_BASE + path;
// PvP (js/net.js) talks through Supabase Realtime with the project's publishable key (Dashboard > Project Settings >
// API keys, the sb_publishable_... one: it is meant to be public). Empty: PvP only works between tabs of one browser.
MB.SUPABASE_URL = 'https://djknvuaivmtudiecwztx.supabase.co';
MB.SUPABASE_KEY = '';
// sprites also come half size (450px tall) under sm/: shrinking the 900px originals 4-8x into cards and onto
// the 3D board makes them grainy, so small displays use sm/ unless the screen is dense enough for the big ones.
// main.js sets SMALL_SPRITES; big forces the full size (close-ups, story scenes).
MB.SMALL_SPRITES = true;
MB.spriteSrc = (path, big) => MB.asset(!big && MB.SMALL_SPRITES && !ABSOLUTE.test(path)
  ? path.startsWith('local/') ? 'local/sm/' + path.slice(6) : 'sm/' + path
  : path);
MB.avatarUrl = (id) => MB.asset(`avatars/${id}.webp`);
MB.packArt = (tier) => MB.asset(`packs/${tier}.webp`);
