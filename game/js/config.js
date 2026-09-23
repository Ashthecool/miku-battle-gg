// Where the images live: the public Supabase "game-assets" bucket (filled by tools/fetch_assets.py and
// tools/sync_avatars.py). Paths in assets/manifest.js and js/avatars.js are relative to it.
// Also loaded by sw.js, so keep it free of DOM access.
window.MB = window.MB || {};
MB.ASSET_BASE = 'https://djknvuaivmtudiecwztx.supabase.co/storage/v1/object/public/game-assets/';
MB.asset = (path) => MB.ASSET_BASE + path;
// sprites also come half size (450px tall) under sm/: shrinking the 900px originals 4-8x into cards and onto
// the 3D board makes them grainy, so small displays use sm/ unless the screen is dense enough for the big ones.
// main.js sets SMALL_SPRITES; big forces the full size (close-ups, story scenes).
MB.SMALL_SPRITES = true;
MB.spriteSrc = (path, big) => MB.asset(!big && MB.SMALL_SPRITES ? 'sm/' + path : path);
MB.avatarUrl = (id) => MB.asset(`avatars/${id}.webp`);
MB.packArt = (tier) => MB.asset(`packs/${tier}.webp`);
