// Drawn poses, chord contact, visibility, one damage event and restoration in real browser playback.
// Usage: NODE_PATH=<bundled node_modules> node tools/check_pristo_attack.js [game URL]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), out = path.join(root, 'output/pristo-check');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errors = [], reports = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.route('**/js/main.js', route => route.fulfill({ contentType: 'application/javascript',
      body: fs.readFileSync(path.join(root, 'game/js/main.js'), 'utf8')
        .replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);') }));
    // Use Pristo's real reference for the attacker; unrelated gallery art is a deterministic fixture.
    const reference = await page.request.get('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/sprites/priest-pristo/amused.webp');
    assert(reference.ok(), 'Pristo reference sprite available');
    const referenceBody = await reference.body();
    await page.route('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/**', route => route.fulfill({
      contentType: 'image/webp', body: referenceBody }));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8765/?dev', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view);
    await page.locator('#loading').click();
    await page.evaluate(() => document.getElementById('btn-gallery').click());
    await page.waitForFunction(() => MB.battle?.units(0).length);
    await page.waitForTimeout(1300);
    await page.locator('#gallery-search').fill('priest pristo');
    await page.locator('.gal-row:not(.style):not(.bond)').filter({ hasText: 'Priest Pristo' }).first().click();
    await page.waitForFunction(() => MB.battle.units(0).some(u => u.card.id === 'priest-pristo'));
    await page.waitForTimeout(1200);
    const cases = [
      { name: 'gallery-left', slot: 1, targetSlot: 1, capture: true },
      { name: 'gallery-right', slot: 1, targetSlot: 2 },
      { name: 'gallery-repeat', slot: 1, targetSlot: 2 },
      { name: 'left-to-right-edge', slot: 0, targetSlot: 3, battle: true },
      { name: 'right-to-left-edge', slot: 3, targetSlot: 0, battle: true },
      { name: 'enemy-leader', slot: 1, leader: true, battle: true },
      { name: 'reverse-near-left', slot: 3, targetSlot: 0, reverse: true, battle: true },
      { name: 'reverse-near-right', slot: 0, targetSlot: 3, reverse: true, battle: true },
      { name: 'reverse-leader', slot: 1, leader: true, reverse: true, battle: true },
      { name: 'small-gallery', slot: 1, targetSlot: 2, small: true },
    ];
    for (const c of cases) {
      await page.setViewportSize(c.small ? { width: 960, height: 540 } : { width: 1600, height: 900 });
      await page.evaluate(c => {
        document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
        document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
        window.pristoCheck = (async () => {
          const V = MB.view, b = MB.battle, a = b.units(0)[0], oldSide = a.side;
          a.slot = c.slot; a.side = c.reverse ? 1 : 0;
          const av = V.ents.get(a.uid), A = V.pos(a); gsap.set(av.el, A);
          const t = c.leader ? b.me(c.reverse ? 0 : 1).leader : b.units(1).find(u => u.card.id === 'dummy');
          const oldTargetSide = t.side;
          if (!c.leader) { t.slot = c.targetSlot; t.side = c.reverse ? 0 : 1; }
          const tv = V.ents.get(t.uid), T = V.pos(t); if (tv) gsap.set(tv.el, T);
          const seen = new Set(), frames = new Set(), visible = [], contacts = [];
          let hits = 0, running = true;
          const monitor = () => {
            document.querySelectorAll('[data-pristo-phase]').forEach(node => {
              if (+gsap.getProperty(node.body, 'opacity') < 0.5) return;
              seen.add(node.dataset.pristoPhase);
              if (node.dataset.pristoFrame) frames.add(+node.dataset.pristoFrame);
              const r = node.body.getBoundingClientRect();
              visible.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, phase: node.dataset.pristoPhase });
            });
            if (running) requestAnimationFrame(monitor);
          };
          requestAnimationFrame(monitor);
          await V.attackFx(a, t, () => {
            hits++;
            const wave = document.querySelector('[data-pristo-phase="contact"]');
            if (!wave) { contacts.push({ missing: true }); return; }
            contacts.push({ dx: +gsap.getProperty(wave, 'x') - T.x, dy: +gsap.getProperty(wave, 'y') - T.y,
              dh: +gsap.getProperty(wave.body, 'y') + V.heightOf(t) * 0.5 });
            V.floatText(T, V.heightOf(t) * 0.5, '-5', 'dmg');
          });
          running = false;
          const restored = { x: +gsap.getProperty(av.el, 'x'), y: +gsap.getProperty(av.el, 'y'),
            opacity: +gsap.getProperty(av.figure, 'opacity'), rotation: +gsap.getProperty(av.figure, 'rotation') };
          a.side = oldSide; t.side = oldTargetSide;
          return { name: c.name, hits, seen: [...seen], frames: [...frames], visible, contacts, restored, home: A,
            leftovers: document.querySelectorAll('[data-pristo-phase]').length };
        })();
      }, c);
      if (c.capture) {
        for (const [phase, name] of [['wind-up', '01-wind-up'], ['strum', '02-strum'], ['contact', '03-contact'], ['grin', '04-grin']]) {
          await page.waitForFunction(phase => document.querySelector(`[data-pristo-phase="${phase}"]`), phase);
          await page.screenshot({ path: path.join(out, name + '.png') });
        }
      }
      const result = await page.evaluate(() => window.pristoCheck);
      assert.equal(result.hits, 1, c.name + ': one damage event');
      assert(result.contacts.every(p => !p.missing && Math.hypot(p.dx, p.dy, p.dh) < 1), c.name + ': centered contact');
      assert.equal(result.leftovers, 0, c.name + ': cleanup');
      assert.equal(result.restored.opacity, 1, c.name + ': original sprite restored');
      assert.equal(result.restored.rotation, 0, c.name + ': no leftover rotation');
      assert(Math.hypot(result.restored.x - result.home.x, result.restored.y - result.home.y) < 1, c.name + ': original slot');
      assert.deepEqual(result.frames.sort(), [0, 1, 2, 3], c.name + ': four complete drawn poses');
      assert(['wind-up', 'strum', 'solo', 'grin', 'flight', 'drain'].every(p => result.seen.includes(p)), c.name + ': all beats visible');
      const w = c.small ? 960 : 1600, h = c.small ? 540 : 900;
      assert(result.visible.every(r => r.left >= 0 && r.right <= w && r.top >= 0 && r.bottom <= h), c.name + ': art stays onscreen');
      if (!c.battle) assert(result.visible.every(r => r.right < w * 0.775), c.name + ': gallery panel clear');
      delete result.visible; reports.push(result); console.log('PASS ' + c.name);
      await page.waitForTimeout(750);
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(reports, null, 2));
    console.log(`${reports.length} browser playbacks passed.`);
  } catch (e) {
    await page.screenshot({ path: path.join(out, 'failure.png') }); throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
