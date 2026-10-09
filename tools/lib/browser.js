// Shared plumbing for the real-browser checks: finds Playwright without NODE_PATH, serves game/ on a free port,
// and opens the game with images the R2 bucket doesn't have yet served from game/assets/ (tools/fetch_assets.py --local).
//   const { openGame } = require('./lib/browser');
//   const g = await openGame({ gallery: true });   // g.page, g.errors, g.url, await g.close()
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { createRequire } = require('module');
const root = path.join(__dirname, '..', '..'), GAME = path.join(root, 'game');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

// require('playwright') from wherever it is: the normal resolution (NODE_PATH, a local install), npx's cache, the global npm root
function playwright() {
  try { return require('playwright'); } catch (_) { /* look elsewhere */ }
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const dirs = [];
  for (const cache of [path.join(local, 'npm-cache', '_npx'), path.join(os.homedir(), '.npm', '_npx')]) {
    if (!fs.existsSync(cache)) continue;
    for (const d of fs.readdirSync(cache)) dirs.push(path.join(cache, d, 'node_modules'));
  }
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
  const found = dirs.filter((d) => fs.existsSync(path.join(d, 'playwright', 'package.json')))
    .sort((a, b) => fs.statSync(path.join(b, 'playwright')).mtimeMs - fs.statSync(path.join(a, 'playwright')).mtimeMs);
  if (found.length) return createRequire(path.join(found[0], 'x.js'))('playwright');
  throw new Error('Playwright not found. Run `npx -y playwright --version` once (it lands in the npx cache), or set NODE_PATH.');
}

// a static server for game/ on a free port; resolves to { url, close }
function serve(dir = GAME) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, rel);
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) })));
}

// Opens the game in headless Edge (Chromium when Edge isn't there).
//   url: a running copy instead of serving game/ ('?dev' is added for local ones); live: true for the deployed site
//   gallery: open the Attack Gallery and wait for its board; nsfw (default true); fast: preload only attack art, not every sprite
async function openGame({ url, live = false, gallery = false, nsfw = true, fast = true, viewport = { width: 1600, height: 900 }, routeLocal = true } = {}) {
  const { chromium } = playwright();
  const server = url || live ? null : await serve();
  const target = live ? 'https://ashthecool.github.io/miku-battle-gg/' : (url || server.url + '?dev');
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); } catch (_) { browser = await chromium.launch({ headless: true }); }
  const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
  const errors = [], missing = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && /\.(webp|png|jpg|mp3|ogg)(\?|$)/.test(r.url())) missing.push(`${r.status()} ${r.url()}`); });
  if (nsfw) await page.addInitScript(() => { window.MB = Object.assign(window.MB || {}, { NSFW: true }); });
  if (!live && fast) await page.route('**/js/main.js', (route) => route.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(path.join(GAME, 'js/main.js'), 'utf8').replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);') }));
  if (!live && routeLocal) await page.route(/r2\.dev/, (route) => {
    const file = path.join(GAME, 'assets', decodeURIComponent(new URL(route.request().url()).pathname.slice(1)));
    if (fs.existsSync(file)) return route.fulfill({ contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    return route.continue();
  });
  const close = async () => { await browser.close(); if (server) await server.close(); };
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view && MB.UI, null, { timeout: 90000 });
    if (gallery) {
      await page.locator('#loading').click({ timeout: 90000 });
      await page.evaluate(() => document.getElementById('btn-gallery').click());
      await page.waitForFunction(() => MB.battle?.units(0).length && !MB.UI.gallery.busy());
      await page.waitForTimeout(1300); // the gallery's first summon
    }
  } catch (e) { await close(); throw e; }
  return { browser, page, errors, missing, url: target, close };
}

// argv helpers: flag('--shots'), opt('--slow', 1), and the bare words
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => { const a = argv.find((x) => x === name || x.startsWith(name + '=')); return a == null ? dflt : a.includes('=') ? a.slice(name.length + 1) : true; };
const words = () => argv.filter((a) => !a.startsWith('--'));

module.exports = { root, GAME, playwright, serve, openGame, flag, opt, words };
