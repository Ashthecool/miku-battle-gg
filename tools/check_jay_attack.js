// Local browser playback: painted reveal, tip contact, edge/leader visibility and cleanup.
// Requires Playwright + Edge. Usage: node tools/check_jay_attack.js [game URL]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), out = path.join(root, 'output/jay-check');
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
    // Keep unrelated library art deterministic; Jay uses his actual source sprite and generated attack art.
    const reference = await page.request.get('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/sprites/jay-lester/happy.webp');
    assert(reference.ok(), 'Jay reference sprite available');
    const referenceBody = await reference.body();
    await page.route('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/**', route => route.fulfill({
      contentType: 'image/webp', body: referenceBody }));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8765/?dev', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view);
    await page.locator('#loading').click();
    await page.evaluate(() => document.getElementById('btn-gallery').click());
    await page.waitForFunction(() => MB.battle?.units(0).length);
    await page.waitForTimeout(1300);
    await page.locator('#gallery-search').fill('jay lester');
    await page.locator('.gal-row:not(.style):not(.bond)').filter({ hasText: 'Jay Lester' }).first().click();
    await page.waitForFunction(() => MB.battle.units(0).some(u => u.card.id === 'jay-lester'));
    await page.waitForTimeout(1100);
    const cases = [
      { name: 'gallery-left-dummy', slot: 1, targetSlot: 1, capture: true },
      { name: 'gallery-right-dummy', slot: 1, targetSlot: 2 },
      { name: 'gallery-right-repeat', slot: 1, targetSlot: 2 },
      { name: 'left-to-right-edge', slot: 0, targetSlot: 3, battle: true },
      { name: 'right-to-left-edge', slot: 3, targetSlot: 0, battle: true },
      { name: 'enemy-leader', slot: 1, leader: true, battle: true },
      { name: 'reverse-near-left', slot: 3, targetSlot: 0, reverse: true, battle: true },
      { name: 'reverse-near-right', slot: 0, targetSlot: 3, reverse: true, battle: true },
      { name: 'small-viewport', slot: 1, targetSlot: 2, small: true },
    ];
    for (const c of cases) {
      await page.setViewportSize(c.small ? { width: 960, height: 540 } : { width: 1600, height: 900 });
      await page.evaluate(c => {
        document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
        document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
        window.jayCheck = (async () => {
          const V = MB.view, b = MB.battle, a = b.units(0)[0], oldSide = a.side;
          a.slot = c.slot; a.side = c.reverse ? 1 : 0;
          const av = V.ents.get(a.uid), A = V.pos(a); gsap.set(av.el, A);
          const t = c.leader ? b.me(1).leader : b.units(1).find(u => u.card.id === 'dummy');
          const oldTargetSide = t.side;
          if (!c.leader) { t.slot = c.targetSlot; t.side = c.reverse ? 0 : 1; }
          const tv = V.ents.get(t.uid), T = V.pos(t); if (tv) gsap.set(tv.el, T);
          const seen = new Set(), visible = [], poseFrames = new Set(), contacts = [], fallHeights = []; let hits = 0, running = true;
          let canvasSeen = false, distinctPaint = false, returnedAtReveal = false;
          const monitor = () => {
            document.querySelectorAll('[data-jay-phase]').forEach(node => {
              const body = node.body || node, phase = node.dataset.jayPhase;
              if (+gsap.getProperty(body, 'opacity') < 0.5) return;
              seen.add(phase);
              if (['hover', 'fall'].includes(phase)) {
                const r = body.getBoundingClientRect();
                visible.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, phase });
                if (phase === 'fall') fallHeights.push(+gsap.getProperty(body, 'y'));
              }
            });
            const pose = document.querySelector('.jay-paint-cut .jay-painter');
            if (pose) poseFrames.add(+pose.dataset.paintFrame);
            const cut = document.querySelector('.jay-paint-cut');
            if (cut?.dataset.jayPhase === 'paint') {
              canvasSeen ||= +gsap.getProperty(cut.querySelector('.jay-canvas'), 'opacity') > 0.9;
              const sketch = cut.querySelector('.jay-sketch'), solid = cut.querySelector('.jay-solid');
              distinctPaint ||= sketch.src !== solid.src && +gsap.getProperty(solid, 'opacity') === 0;
            }
            if (!cut && document.querySelector('[data-jay-phase="hover"]')) {
              const painter = document.querySelector('[data-jay-phase="painting-pose"]');
              returnedAtReveal ||= Math.abs(+gsap.getProperty(painter, 'x') - A.x) < 1 && Math.abs(+gsap.getProperty(painter, 'y') - A.y) < 1;
            }
            if (running) requestAnimationFrame(monitor);
          };
          requestAnimationFrame(monitor);
          await V.attackFx(a, t, () => {
            hits++;
            const node = document.querySelector('[data-jay-phase="contact"]');
            if (!node) { contacts.push({ missing: true }); return; }
            const r = node.body.getBoundingClientRect();
            fallHeights.push(+gsap.getProperty(node.body, 'y'));
            const probe = V.billboard('', '', T.x, T.y); probe.body.style.width = probe.body.style.height = '1px';
            gsap.set(probe.body, { y: -V.heightOf(t) * 0.5 });
            const p = probe.body.getBoundingClientRect(); probe.remove();
            contacts.push({ dx: r.left + r.width * 0.5 - p.left - p.width / 2,
              dy: r.top + r.height * 0.93 - p.top - p.height / 2 });
            V.floatText(T, V.heightOf(t) * 0.5, '-2', 'dmg');
          });
          running = false;
          const restored = { x: +gsap.getProperty(av.el, 'x'), y: +gsap.getProperty(av.el, 'y'),
            opacity: +gsap.getProperty(av.figure, 'opacity') };
          a.side = oldSide; t.side = oldTargetSide;
          return { name: c.name, hits, seen: [...seen], visible, contacts, restored, home: A,
            canvasSeen, distinctPaint, returnedAtReveal,
            dropDistance: fallHeights.at(-1) - fallHeights[0],
            poseFrames: [...poseFrames], detachedArmLayers: document.querySelectorAll('.jay-arm').length,
            leftovers: document.querySelectorAll('[data-jay-phase]').length };
        })();
      }, c);
      if (c.capture) {
        await page.waitForTimeout(1100); await page.screenshot({ path: path.join(out, '01-painting.png') });
        await page.waitForFunction(() => document.querySelector('.jay-paint-cut')?.dataset.jayPhase === 'reveal');
        await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, '02-zoom-out.png') });
        await page.waitForFunction(() => !document.querySelector('.jay-paint-cut') && document.querySelector('[data-jay-phase="hover"]'));
        await page.screenshot({ path: path.join(out, '03-real-spike.png') });
        await page.waitForFunction(() => document.querySelector('[data-jay-phase="contact"]'));
        await page.screenshot({ path: path.join(out, '04-contact.png') });
        await page.waitForFunction(() => document.querySelector('[data-jay-phase="proud"]') &&
          +gsap.getProperty(document.querySelector('[data-jay-phase="proud"]').body, 'opacity') > 0.95);
        await page.screenshot({ path: path.join(out, '05-proud-grin.png') });
      }
      const result = await page.evaluate(() => window.jayCheck);
      assert.equal(result.hits, 1, c.name + ' impact fires once');
      assert(result.contacts.every(p => !p.missing && Math.hypot(p.dx, p.dy) < 5), c.name + ' tip touches target: ' + JSON.stringify(result.contacts));
      assert.equal(result.leftovers, 0, c.name + ' cleanup');
      assert.equal(result.restored.opacity, 1, c.name + ' Jay restored');
      assert(Math.abs(result.restored.x - result.home.x) < 1 && Math.abs(result.restored.y - result.home.y) < 1, c.name + ' returns home');
      assert(result.poseFrames.length === 4 && !result.detachedArmLayers, c.name + ' complete painting poses without separated arm layers');
      assert(result.canvasSeen && result.distinctPaint, c.name + ' distinct drawing on canvas');
      assert(result.returnedAtReveal, c.name + ' Jay returns to slot during zoom-out');
      assert(result.dropDistance > 45, c.name + ' spike falls downward with visible travel: ' + result.dropDistance);
      assert(['paint', 'reveal', 'hover', 'fall', 'proud'].every(p => result.seen.includes(p)), c.name + ' all beats visible');
      const width = c.small ? 960 : 1600, height = c.small ? 540 : 900;
      assert(result.visible.every(r => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= height), c.name + ' spike stays in viewport');
      if (!c.battle) assert(result.visible.every(r => r.right < width * 0.8), c.name + ' gallery panel clear');
      delete result.visible; reports.push(result); console.log('PASS ' + c.name);
      await page.waitForTimeout(750); // allow camera and transient reaction particles to finish
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(reports, null, 2));
    console.log(`${reports.length} browser playbacks passed.`);
  } catch (e) {
    await page.screenshot({ path: path.join(out, 'failure.png') }); throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
