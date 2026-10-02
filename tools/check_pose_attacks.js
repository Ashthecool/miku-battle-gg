// Real-browser playback of the drawn pose attacks (fx.js "drawn pose attacks"): one damage event, every pose frame shown,
// the drawn actor and its props staying on screen, and the sprite and slot restored afterwards. Single characters are
// played in the Attack Gallery at several slots and against an enemy leader; duos by fusing their bond.
// Usage: NODE_PATH=<node_modules with playwright> node tools/check_pose_attacks.js [character-or-bond id ...] [--shots] [--slow=0.3] [--url=http://127.0.0.1:8765/?dev]
//   --shots saves a screenshot strip of the first case to output/pose-check/ (--slow slows the animation clock to catch more frames)
//   serve the game folder first (e.g. `py -m http.server 8765 --directory game`). Images that the R2 bucket doesn't have yet
//   are served from game/assets/ (tools/fetch_assets.py --local), so the new characters show before they are uploaded.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), out = path.join(root, 'output/pose-check');
const args = process.argv.slice(2), shots = args.includes('--shots');
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:8765/?dev').slice(6);
const slow = +((args.find((a) => a.startsWith('--slow=')) || '--slow=1').slice(7));
const ids = args.filter((a) => !a.startsWith('--'));
const SINGLES = ['maia', 'cordelia', 'hanako-ikezawa', 'ida', 'lilly-satou', 'yllara', 'seraphina', 'eliza', 'uzi', 'valerian', 'reika'];
const BONDS = ['tea-and-chess', 'stranded-together', 'maid-shift', 'night-mass'];
const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errors = [], reports = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => { window.MB = { NSFW: true }; }); // Ida's novel is NSFW
  await page.route('**/js/main.js', (route) => route.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(path.join(root, 'game/js/main.js'), 'utf8').replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);') }));
  await page.route(/r2\.dev/, (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice(1)), file = path.join(root, 'game/assets', rel);
    if (fs.existsSync(file)) return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    return route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view && MB.UI);
    await page.locator('#loading').click();
    await page.evaluate(() => document.getElementById('btn-gallery').click());
    await page.waitForFunction(() => MB.battle?.units(0).length);
    await page.waitForTimeout(1300);
    const list = ids.length ? ids : [...SINGLES, ...BONDS];
    for (const id of list) {
      const duo = BONDS.includes(id) || !!(await page.evaluate((id) => MB.BONDS.find((b) => b.id === id), id));
      await page.evaluate(async ({ id, duo }) => {
        await new Promise((r) => setTimeout(r, 200));
        if (duo) await MB.UI.gallery.bond(MB.BONDS.find((b) => b.id === id), null); else await MB.UI.gallery.pick(id, null);
      }, { id, duo });
      await page.waitForFunction(() => MB.UI.gallery.unit());
      await page.waitForTimeout(900);
      const cases = [
        { name: 'center', slot: duo ? 1 : 1, targetSlot: 1, capture: true },
        { name: 'right', slot: duo ? 1 : 1, targetSlot: 2 },
        { name: 'edge-left-to-right', slot: 0, targetSlot: 3, battle: true },
        { name: 'edge-right-to-left', slot: 3, targetSlot: 0, battle: true },
        { name: 'enemy-leader', slot: 1, leader: true, battle: true },
        { name: 'reversed', slot: 3, targetSlot: 0, reverse: true, battle: true },
      ];
      for (const c of cases) {
        await page.evaluate((o) => { gsap.globalTimeline.timeScale(o.c.capture ? o.slow : 1); }, { c, slow });
        await page.evaluate((c) => {
          const duo = c.duo;
          document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
          document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
          window.poseCheck = (async () => {
            const V = MB.view, b = MB.battle, a = MB.UI.gallery.unit(), oldSide = a.side, oldSlot = a.slot;
            a.slot = duo ? 1 : c.slot; a.side = c.reverse ? 1 : 0;
            const av = V.ents.get(a.uid), A = V.pos(a); gsap.set(av.el, A);
            const dummies = b.units(1);
            const t = c.leader ? b.me(c.reverse ? 0 : 1).leader : dummies.find((u) => u.card.id === 'dummy') || dummies[0];
            const oldTargetSide = t.side, oldTargetSlot = t.slot;
            if (!c.leader) { t.slot = c.targetSlot; t.side = c.reverse ? 0 : 1; }
            const tv = V.ents.get(t.uid), T = V.pos(t); if (tv) gsap.set(tv.el, T);
            const frames = new Set(), bad = [], actorBad = [];
            let hits = 0, running = true, maxProps = 0;
            const vw = innerWidth, vh = innerHeight;
            const ignore = /float-text|spark|smoke|impact-flash|shock-ring|stamp-mark|attack-name|petal|dust|ghost/;
            const monitor = () => {
              document.querySelectorAll('[data-pose]').forEach((n) => {
                if (n.dataset.frame != null) frames.add(`${n.dataset.pose}:${n.dataset.frame}`);
                if (+gsap.getProperty(n.body, 'opacity') < 0.5) return;
                const r = n.body.getBoundingClientRect();
                if (r.left < -2 || r.right > vw + 2 || r.top < -2 || r.bottom > vh + 2) actorBad.push({ pose: n.dataset.pose, frame: n.dataset.frame, l: r.left, r: r.right, t: r.top, b: r.bottom });
              });
              const props = [...document.querySelectorAll('#fx-layer .bb-body')].filter((n) => !ignore.test(n.className) && !n.closest('[data-pose]') && +gsap.getProperty(n, 'opacity') > 0.5);
              maxProps = Math.max(maxProps, props.length);
              props.forEach((n) => {
                const r = n.getBoundingClientRect();
                if (r.width > 4 && (r.left < -30 || r.right > vw + 30 || r.top < -30 || r.bottom > vh + 30)) bad.push({ cls: n.className, l: r.left, r: r.right, t: r.top, b: r.bottom });
              });
              if (running) requestAnimationFrame(monitor);
            };
            requestAnimationFrame(monitor);
            const start = performance.now(); let firstHit = 0;
            await V.attackFx(a, t, () => { hits++; if (!firstHit) firstHit = performance.now() - start; V.floatText(T, V.heightOf(t) * 0.5, '-5', 'dmg'); });
            running = false;
            const restored = { x: +gsap.getProperty(av.el, 'x'), y: +gsap.getProperty(av.el, 'y'), opacity: +gsap.getProperty(av.figure, 'opacity'),
              rotation: +gsap.getProperty(av.figure, 'rotation') };
            a.side = oldSide; a.slot = oldSlot; t.side = oldTargetSide; t.slot = oldTargetSlot;
            return { name: c.name, hits, firstHit: Math.round(firstHit), total: Math.round(performance.now() - start), frames: [...frames], bad, actorBad, restored, home: A, maxProps,
              leftovers: document.querySelectorAll('[data-pose]').length };
          })();
          window.poseCheckDone = false;
          window.poseCheck.then(() => { window.poseCheckDone = true; }, () => { window.poseCheckDone = true; });
        }, { ...c, duo });
        let shot = 0;
        if (shots && c.capture) { // a strip of the playback, as fast as screenshots go
          const t0 = Date.now();
          while (!(await page.evaluate(() => window.poseCheckDone)) && Date.now() - t0 < 40000 && shot < 60) {
            await page.screenshot({ path: path.join(out, `${id}-${String(shot++).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70, clip: { x: 0, y: 100, width: 1240, height: 700 } });
          }
        }
        const result = await page.evaluate(() => window.poseCheck);
        const w = 1600, h = 900;
        const label = `${id} / ${c.name}`;
        assert.equal(result.hits, 1, `${label}: ${result.hits} damage events (want exactly one)`);
        assert.equal(result.leftovers, 0, `${label}: drawn actor left behind`);
        assert.equal(result.restored.opacity, 1, `${label}: original sprite not restored`);
        assert.equal(result.restored.rotation, 0, `${label}: leftover rotation`);
        assert(Math.hypot(result.restored.x - result.home.x, result.restored.y - result.home.y) < 1, `${label}: attacker not back in its slot`);
        const seen = new Set(result.frames.map((f) => f.split(':')[1]));
        assert(['0', '1', '2', '3'].every((f) => seen.has(f)), `${label}: frames shown ${[...seen].sort()} (want all four)`);
        assert(result.actorBad.length === 0, `${label}: drawn actor leaves the screen: ${JSON.stringify(result.actorBad[0])}`);
        const note = result.bad.length ? `  [props off-screen: ${[...new Set(result.bad.map((p) => p.cls))].join(', ')}]` : '';
        reports.push({ ...result, id });
        console.log(`PASS ${label}  hit at ${result.firstHit}ms of ${result.total}ms${note}`);
        await page.waitForTimeout(500);
      }
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(reports, null, 2));
    console.log(`${reports.length} browser playbacks passed.`);
  } catch (e) {
    await page.screenshot({ path: path.join(out, 'failure.png') }); throw e;
  } finally { await browser.close(); }
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
