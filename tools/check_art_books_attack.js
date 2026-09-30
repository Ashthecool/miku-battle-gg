// Art & Books: full browser playback, actual tread climb, book contact, edges and leader cleanup.
// Requires Playwright and Edge. Usage: node tools/check_art_books_attack.js [game URL]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), out = path.join(root, 'output/art-books-check');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errors = [], reports = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.route('**/js/main.js', route => route.fulfill({ contentType: 'application/javascript',
      body: fs.readFileSync(path.join(root, 'game/js/main.js'), 'utf8')
        .replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);') }));
    const references = await Promise.all(['sprites/jay-lester/new-outfit/happy.webp', 'sprites/janice-garmund/summer-clothes/happy.webp'].map(async sprite => {
      const response = await page.request.get('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/' + sprite);
      assert(response.ok(), sprite + ' reference available');
      return response.body();
    }));
    await page.route('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/**', route => {
      const jay = route.request().url().includes('jay-lester');
      return route.fulfill({ contentType: 'image/webp', body: references[jay ? 0 : 1] });
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8765/?dev', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view);
    await page.locator('#loading').click();
    await page.evaluate(() => document.getElementById('btn-gallery').click());
    await page.waitForFunction(() => MB.battle?.units(0).length); await page.waitForTimeout(1300);
    await page.locator('#gallery-search').fill('art books');
    await page.locator('.gal-row.bond').filter({ hasText: 'Art & Books' }).click();
    await page.waitForFunction(() => MB.battle.units(0).some(u => u.card.fused && MB.view.ents.has(u.uid)));
    await page.waitForTimeout(1800);
    const cases = [
      { name: 'gallery-left', slot: 1, targetSlot: 1, capture: true },
      { name: 'gallery-right', slot: 1, targetSlot: 2 },
      { name: 'gallery-repeat', slot: 1, targetSlot: 2 },
      { name: 'left-to-right-edge', slot: 0, targetSlot: 3, battle: true },
      { name: 'right-to-left-edge', slot: 3, targetSlot: 0, battle: true },
      { name: 'enemy-leader', slot: 1, leader: true, battle: true },
      { name: 'reverse-left-edge', slot: 3, targetSlot: 0, reverse: true, battle: true },
      { name: 'reverse-right-edge', slot: 0, targetSlot: 3, reverse: true, battle: true },
      { name: 'small-viewport', slot: 1, targetSlot: 2, small: true },
    ];
    for (const c of cases) {
      await page.setViewportSize(c.small ? { width: 960, height: 540 } : { width: 1600, height: 900 });
      await page.evaluate(c => {
        document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
        document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
        window.artBooksError = null;
        window.artBooksCheck = (async () => {
          const V = MB.view, b = MB.battle, a = b.units(0)[0], oldSide = a.side;
          a.slot = c.slot; a.side = c.reverse ? 1 : 0;
          const av = V.ents.get(a.uid), A = V.pos(a); gsap.set(av.el, { x: A.x, y: A.y });
          const t = c.leader ? b.me(1).leader : b.units(1).find(u => u.card.id === 'dummy');
          const oldTargetSide = t.side;
          if (!c.leader) { t.slot = c.targetSlot; t.side = c.reverse ? 0 : 1; }
          const T = V.pos(t), tv = V.ents.get(t.uid); if (tv) gsap.set(tv.el, { x: T.x, y: T.y });
          const phases = new Set(), frames = new Set(), visible = [], books = new Set(), contacts = [], climb = [];
          let hits = 0, running = true, emptyHandsAtHit = false;
          const monitor = () => {
            document.querySelectorAll('[data-art-books-phase]').forEach(node => {
              const body = node.body, phase = node.dataset.artBooksPhase;
              if (+gsap.getProperty(body, 'opacity') < 0.5) return;
              phases.add(phase);
              const rect = body.getBoundingClientRect();
              visible.push({ phase, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
              if (node.classList.contains('bb') && body.classList.contains('art-books-janice')) {
                frames.add(+node.dataset.climbFrame);
                if (phase === 'climb') climb.push({ x: +gsap.getProperty(node, 'x'), y: +gsap.getProperty(body, 'y') });
              }
              if (node.dataset.book !== undefined) books.add(node.dataset.book);
            });
            if (running) requestAnimationFrame(monitor);
          };
          requestAnimationFrame(monitor);
          await V.attackFx(a, t, () => {
            hits++;
            emptyHandsAtHit = document.querySelector('.art-books-janice')?.parentElement?.parentElement?.dataset.climbFrame === '3';
            const node = document.querySelector('[data-art-books-phase="book-contact"]');
            if (!node) { contacts.push({ missing: true }); return; }
            const probe = V.billboard('', '', T.x, T.y); probe.body.style.width = probe.body.style.height = '1px';
            gsap.set(probe.body, { y: -V.heightOf(t) * 0.5 });
            const p = probe.body.getBoundingClientRect(), r = node.body.getBoundingClientRect(); probe.remove();
            contacts.push({ dx: r.left + r.width / 2 - p.left - p.width / 2, dy: r.top + r.height / 2 - p.top - p.height / 2 });
            V.floatText(T, V.heightOf(t) * 0.5, '-4', 'dmg');
          });
          running = false;
          const restored = { x: +gsap.getProperty(av.el, 'x'), y: +gsap.getProperty(av.el, 'y'),
            opacity: +gsap.getProperty(av.figure, 'opacity'), parts: [...av.img.children].map(p => +gsap.getProperty(p, 'opacity')) };
          a.side = oldSide; t.side = oldTargetSide;
          return { name: c.name, hits, emptyHandsAtHit, phases: [...phases], frames: [...frames], books: [...books], contacts,
            visible, climb, restored, home: A, leftovers: document.querySelectorAll('[data-art-books-phase]').length };
        })().catch(e => { window.artBooksError = e.stack; throw e; });
      }, c);
      if (c.capture) {
        await page.waitForFunction(() => document.querySelector('[data-art-books-phase="draw"]') || window.artBooksError);
        const error = await page.evaluate(() => window.artBooksError); if (error) throw new Error(error);
        await page.waitForTimeout(700); await page.screenshot({ path: path.join(out, '01-painted-stairs.png') });
        await page.waitForFunction(() => document.querySelector('[data-art-books-phase="climb"]')?.dataset.climbFrame === '2');
        await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '02-crawling.png') });
        await page.waitForFunction(() => document.querySelector('[data-art-books-phase="balance"]'));
        await page.screenshot({ path: path.join(out, '03-top-step.png') });
        await page.waitForFunction(() => document.querySelector('[data-art-books-phase="book-contact"]'));
        await page.screenshot({ path: path.join(out, '04-book-contact.png') });
      }
      const result = await page.evaluate(() => window.artBooksCheck);
      assert.equal(result.hits, 1, c.name + ' damage once at book contact');
      assert(result.emptyHandsAtHit, c.name + ' Janice actually drops her books');
      assert(result.contacts.every(p => !p.missing && Math.hypot(p.dx, p.dy) < 8), c.name + ' book touches target: ' + JSON.stringify(result.contacts));
      assert.equal(result.books.length, 3, c.name + ' all three books drop');
      assert.equal(result.frames.length, 4, c.name + ' complete character poses');
      assert(['draw', 'solid', 'climb', 'balance', 'book-fall', 'reaction'].every(p => result.phases.includes(p)), c.name + ' visible story beats');
      assert.equal(result.leftovers, 0, c.name + ' cleanup');
      assert(result.restored.opacity === 1 && result.restored.parts.every(p => p === 1), c.name + ' both original partners restored');
      assert(Math.abs(result.restored.x - result.home.x) < 1 && Math.abs(result.restored.y - result.home.y) < 1, c.name + ' original slot restored');
      const width = c.small ? 960 : 1600, height = c.small ? 540 : 900;
      assert(result.visible.every(r => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= height), c.name + ' all staging visible: ' + JSON.stringify(result.visible.filter(r => r.left < 0 || r.right > width || r.top < 0 || r.bottom > height).slice(0, 2)));
      if (!c.battle) assert(result.visible.every(r => r.right < width * 0.775), c.name + ' gallery panel clear');
      assert(result.climb.length > 5, c.name + ' crawling movement observed');
      delete result.visible; delete result.climb; reports.push(result); console.log('PASS ' + c.name);
      await page.waitForTimeout(750);
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(reports, null, 2));
    console.log(`${reports.length} Art & Books browser playbacks passed.`);
  } catch (e) { await page.screenshot({ path: path.join(out, 'failure.png') }); console.error('Browser errors:', errors); throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
