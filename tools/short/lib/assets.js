// Where a short gets the game's art from. game/assets/ is only part of it: the bucket (MB.ASSET_BASE, Cloudflare R2) holds
// files that were never copied to disk, for instance `attack` sprites such as luther-jones/amused.webp. The game fetches those
// from the bucket, so a local-only server would 404 them and the character would vanish from the footage mid-attack.
// find() answers with the local file, else a cached copy, else downloads it from the bucket (and caches it under
// output/short/cache/assets/). A file that is nowhere comes back as { file: null }.
const fs = require('fs'), path = require('path');
const GAME = path.join(__dirname, '..', '..', '..', 'game'), CACHE = path.join(__dirname, '..', '..', '..', 'output', 'short', 'cache', 'assets');
const BASE = (fs.readFileSync(path.join(GAME, 'js/config.js'), 'utf8').match(/MB\.ASSET_BASE = '([^']+)'/) || [])[1];
const seen = new Map();

async function find(rel) {
  rel = String(rel).replace(/^\/+/, '').replace(/^game\//, '').replace(/^assets\//, '');
  if (seen.has(rel)) return seen.get(rel);
  const p = (async () => {
    const local = path.join(GAME, 'assets', rel);
    if (fs.existsSync(local)) return { rel, file: local, where: 'disk' };
    const cached = path.join(CACHE, rel);
    if (fs.existsSync(cached)) return { rel, file: cached, where: 'bucket (cached)' };
    if (!BASE) return { rel, file: null, where: 'missing' };
    try {
      const r = await fetch(BASE + rel);
      if (!r.ok) return { rel, file: null, where: 'missing' };
      fs.mkdirSync(path.dirname(cached), { recursive: true }); fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
      return { rel, file: cached, where: 'bucket' };
    } catch { return { rel, file: null, where: 'missing' }; }
  })();
  seen.set(rel, p);
  return p;
}

// serve a request for /assets/<rel> or /game/assets/<rel>; false when the path is not an asset path
function route(url) { const m = url.match(/^\/(?:game\/)?assets\/(.+)$/); return m ? m[1] : null; }

module.exports = { find, route, GAME, BASE };
