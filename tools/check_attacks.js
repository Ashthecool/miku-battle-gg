// Real-browser playback of any character or duo attack (signature, generic or drawn pose sheet). Each is played in the Attack Gallery
// at the centre, both edges, against an enemy leader and from the other side. It fails on a missing or doubled hit, a page error,
// an attacker not back in its slot (moved, hidden, rotated, a duo half left faded), a drawn actor left behind or off screen, or a pose
// frame never shown. It warns when nothing visibly touches the target at the hit (no prop, actor or the attacker within reach of the
// target's sprite) and when props leave the screen; --strict makes those failures too.
// Usage: node tools/check_attacks.js [card id | bond id | style name ...] [--new[=rev]] [--all] [--strict] [--shots] [--slow=0.3] [--cases=center,leader] [--jobs=3]
//   by default 3 cases (centre, an edge, the enemy leader) at 4x animation speed in 3 parallel pages; --all plays all 6, --speed=1 real time
//   --new        everything whose attack differs from HEAD (or rev) in data.js, plus every user of a style changed in fx.js
//   --shots      a screenshot strip of each case to output/attack-check/<id>/ (--slow slows the animation clock to catch more frames)
//   --url=...    check a copy already being served instead of serving game/ here
// Needs Playwright (found in npx's cache, see lib/browser.js) and Edge or Chromium. Images missing from R2 come from game/assets/.
const fs = require('fs'), path = require('path');
const { root, serve, openGame, flag, opt, words } = require('./lib/browser');
const data = require('./lib/gamedata');
const out = path.join(root, 'output/attack-check');
const shots = flag('--shots'), strict = flag('--strict'), slow = +opt('--slow', 1), speed = shots ? slow : +opt('--speed', 4), jobs = +opt('--jobs', 3);
const CASES = [
  { name: 'center', slot: 1, targetSlot: 1, capture: true },
  { name: 'right', slot: 1, targetSlot: 2 },
  { name: 'edge-left-to-right', slot: 0, targetSlot: 3, battle: true },
  { name: 'edge-right-to-left', slot: 3, targetSlot: 0, battle: true },
  { name: 'enemy-leader', slot: 1, leader: true, battle: true },
  { name: 'reversed', slot: 3, targetSlot: 0, reverse: true, battle: true },
];
const pick = opt('--cases', null), QUICK = ['center', 'edge-right-to-left', 'enemy-leader'];
const cases = pick ? CASES.filter((c) => pick.split(',').some((p) => c.name.includes(p))) : flag('--all') ? CASES : CASES.filter((c) => QUICK.includes(c.name));

function targets() {
  const MB = data.load(), ids = new Set();
  for (const w of words()) {
    if (MB.CARDS[w] || MB.BONDS.some((b) => b.id === w)) ids.add(w);
    else {
      const users = data.usersOfStyles(MB, [w]);
      if (!users.length) throw new Error(`"${w}" is not a card, a bond or a style anyone uses`);
      users.forEach((id) => ids.add(id));
    }
  }
  const rev = opt('--new', null);
  if (rev) {
    const r = rev === true ? 'HEAD' : rev, ch = data.changedAttacks(r), styles = data.changedStyles(r);
    [...ch.cards, ...ch.bonds, ...data.usersOfStyles(MB, styles)].forEach((id) => ids.add(id));
    if (styles.length) console.log(`styles changed in fx.js: ${styles.join(', ')}`);
  }
  const bondIds = new Set(MB.BONDS.map((b) => b.id));
  return [...ids].filter((id) => bondIds.has(id) || (MB.CARDS[id] && MB.CARDS[id].type !== 'spell' && MB.CARDS[id].attack))
    .map((id) => ({ id, duo: bondIds.has(id) }));
}

// runs in the page: plays one case and measures it
async function playCase(c) {
  const V = MB.view, b = MB.battle, a = MB.UI.gallery.unit(), oldSide = a.side, oldSlot = a.slot;
  document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
  document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
  a.kw.delete('stealth'); a.attacksLeft = 1; a.frozen = false; a.hp = a.maxHp; V.refresh();
  a.slot = c.duo ? 1 : c.slot; a.side = c.reverse ? 1 : 0;
  const av = V.ents.get(a.uid), A = V.pos(a); gsap.set(av.el, A);
  const dummies = b.units(1);
  const t = c.leader ? b.me(c.reverse ? 0 : 1).leader : dummies.find((u) => u.card.id === 'dummy') || dummies[0];
  const oldTargetSide = t.side, oldTargetSlot = t.slot;
  if (!c.leader) { t.slot = c.targetSlot; t.side = c.reverse ? 0 : 1; t.hp = t.maxHp; }
  const tv = V.ents.get(t.uid), T = V.pos(t); if (tv && !c.leader) gsap.set(tv.el, T);
  const vw = innerWidth, vh = innerHeight, start = performance.now();
  const visible = (n) => { for (let e = n; e && e !== document.body; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.3 || getComputedStyle(e).visibility === 'hidden') return false; return true; };
  // effects that appear at the target whatever the attack does, and text: they don't count as contact or as props
  const ignore = /float-text|spark|smoke|impact-flash|shock-ring|stamp-mark|attack-name|petal|dust|ghost|banner|label|cry|bubble-text/;
  const before = new Set(document.getElementById('fx-layer').children);
  const frames = new Set(), offProps = new Map(), actorBad = [];
  let hits = 0, running = true, firstHit = 0, contact = null, maxProps = 0;
  const props = () => [...document.querySelectorAll('#fx-layer .bb-body')].filter((n) => !ignore.test(n.className) && !n.closest('[data-pose]') && visible(n));
  const monitor = () => {
    document.querySelectorAll('[data-pose]').forEach((n) => {
      if (n.dataset.frame != null) frames.add(`${n.dataset.pose}:${n.dataset.frame}`);
      if (!n.body || +gsap.getProperty(n.body, 'opacity') < 0.5) return;
      const r = n.body.getBoundingClientRect();
      if (r.left < -2 || r.right > vw + 2 || r.top < -2 || r.bottom > vh + 2) actorBad.push({ pose: n.dataset.pose, frame: n.dataset.frame, l: r.left | 0, r: r.right | 0, t: r.top | 0, b: r.bottom | 0 });
    });
    const ps = props(); maxProps = Math.max(maxProps, ps.length);
    ps.forEach((n) => {
      const r = n.getBoundingClientRect(), over = Math.max(-r.left, r.right - vw, -r.top, r.bottom - vh);
      if (r.width > 4 && over > 30 && !(offProps.get(n.className) > over)) offProps.set(n.className, Math.round(over));
    });
    if (running) requestAnimationFrame(monitor);
  };
  requestAnimationFrame(monitor);
  // what is near the target's sprite at the hit: the nearest prop, drawn actor or the attacker itself (gap in px, 0 = overlapping)
  const touch = () => {
    const tr = (tv ? tv.figure : document.body).getBoundingClientRect();
    const gap = (r) => Math.hypot(Math.max(tr.left - r.right, r.left - tr.right, 0), Math.max(tr.top - r.bottom, r.top - tr.bottom, 0));
    const cands = [...props().map((n) => ['prop ' + n.className.replace('bb-body', '').trim(), n]),
      ...[...document.querySelectorAll('[data-pose]')].filter((n) => n.body && visible(n.body)).map((n) => ['actor ' + n.dataset.pose, n.body]),
      ...(visible(av.figure) ? [['attacker', av.figure]] : [])];
    let best = null;
    for (const [what, n] of cands) { const r = n.getBoundingClientRect(); if (r.width < 2) continue; const g = gap(r); if (!best || g < best.gap) best = { what, gap: Math.round(g) }; }
    return best || { what: 'nothing visible', gap: Infinity };
  };
  let error = null;
  try {
    await V.attackFx(a, t, () => {
      hits++;
      if (!firstHit) { firstHit = performance.now() - start; contact = touch(); }
      V.floatText(T, V.heightOf(t) * 0.5, '-5', 'dmg');
    });
  } catch (e) { error = String(e && e.stack || e); }
  running = false;
  await new Promise((r) => setTimeout(r, 2000 / gsap.globalTimeline.timeScale())); // fades that end with the attack (2s of animation time)
  const leftovers = [...document.getElementById('fx-layer').children].filter((n) => !before.has(n) && !/float-text/.test(n.className) && visible(n)).map((n) => n.className || n.tagName);
  const restored = { x: +gsap.getProperty(av.el, 'x'), y: +gsap.getProperty(av.el, 'y'), opacity: +gsap.getProperty(av.figure, 'opacity'),
    rotation: +gsap.getProperty(av.figure, 'rotation'), parts: c.duo && av.img.children.length === 2 ? [...av.img.children].map((p) => +gsap.getProperty(p, 'opacity')) : [] };
  a.side = oldSide; a.slot = oldSlot; t.side = oldTargetSide; t.slot = oldTargetSlot;
  gsap.set(av.el, V.pos(a)); if (tv && !c.leader) gsap.set(tv.el, V.pos(t));
  return { name: c.name, error, hits, firstHit: Math.round(firstHit), total: Math.round(performance.now() - start), contact, frames: [...frames],
    actorBad, offProps: [...offProps].map(([cls, over]) => `${cls.replace('bb-body', '').trim() || 'prop'} by ${over}px`), restored, home: A, maxProps, leftovers,
    actorsLeft: document.querySelectorAll('[data-pose]').length };
}

async function worker(url, queue, fails, warns, reports, missing) {
  const g = await openGame({ url, gallery: true }), page = g.page;
  try {
    for (let job; (job = queue.shift());) {
      const { id, duo } = job;
      await page.evaluate(async ({ id, duo }) => {
        while (MB.UI.gallery.busy()) await new Promise((r) => setTimeout(r, 50));
        if (duo) await MB.UI.gallery.bond(MB.BONDS.find((b) => b.id === id), null); else await MB.UI.gallery.pick(id, null);
      }, { id, duo });
      await page.waitForFunction(() => MB.UI.gallery.unit() && !MB.UI.gallery.busy());
      await page.waitForTimeout(300);
      for (const c of cases) {
        const label = `${id} / ${c.name}`, errs = g.errors.length;
        await page.evaluate((s) => { gsap.globalTimeline.timeScale(s); }, speed);
        await page.evaluate(({ c, src }) => { window.__case = (0, eval)(`(${src})`)(c); window.__done = false; window.__case.finally(() => { window.__done = true; }); },
          { c: { ...c, duo }, src: playCase.toString() });
        if (shots) {
          const dir = path.join(out, id); fs.mkdirSync(dir, { recursive: true });
          for (let shot = 0, t0 = Date.now(); !(await page.evaluate(() => window.__done)) && Date.now() - t0 < 40000 && shot < 40; shot++)
            await page.screenshot({ path: path.join(dir, `${c.name}-${String(shot).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70, clip: { x: 0, y: 100, width: 1240, height: 700 } });
        }
        const r = await page.evaluate(() => window.__case);
        const bad = [], soft = [];
        if (r.error) bad.push(`threw ${r.error.split('\n')[0]}`);
        if (r.hits !== 1) bad.push(`${r.hits} damage events (want exactly one)`);
        if (g.errors.length > errs) bad.push(`page error: ${g.errors.slice(errs).join(' | ')}`);
        if (r.actorsLeft) bad.push('drawn actor left behind');
        if (Math.hypot(r.restored.x - r.home.x, r.restored.y - r.home.y) >= 1) bad.push('attacker not back in its slot');
        if (r.restored.opacity !== 1) bad.push(`attacker opacity ${r.restored.opacity}`);
        if (Math.abs(r.restored.rotation) > 0.01) bad.push(`attacker rotation ${r.restored.rotation}`);
        if (r.restored.parts.some((p) => p !== 1)) bad.push(`duo halves at opacity ${r.restored.parts}`);
        if (r.actorBad.length) bad.push(`drawn actor off screen: ${JSON.stringify(r.actorBad[0])}`);
        if (r.frames.length) { const seen = new Set(r.frames.map((f) => f.split(':')[1])); if (!['0', '1', '2', '3'].every((f) => seen.has(f))) bad.push(`pose frames shown ${[...seen].sort()} (want 0-3)`); }
        if (r.hits && r.contact && r.contact.gap > 40) soft.push(`nothing touches the target at the hit (nearest: ${r.contact.what}, ${r.contact.gap}px away)`);
        if (r.offProps.length) soft.push(`props off screen: ${r.offProps.join(', ')}`);
        if (r.leftovers.length) soft.push(`left in the fx layer: ${[...new Set(r.leftovers)].join(', ')}`);
        if (strict) bad.push(...soft); else warns.push(...soft.map((s) => `${label}: ${s}`));
        if (bad.length) fails.push(`${label}: ${bad.join('; ')}`);
        reports.push({ id, ...r });
        const hit = r.hits ? `hit at ${Math.round(r.firstHit * speed)}ms of ${Math.round(r.total * speed)}ms, ${r.contact.what} ${r.contact.gap}px` : 'no hit';
        console.log(`${bad.length ? 'FAIL' : soft.length ? 'WARN' : 'PASS'} ${label}  ${hit}${bad.length ? '  ✗ ' + bad.join('; ') : ''}${soft.length && !strict ? '  ! ' + soft.join('; ') : ''}`);
      }
    }
  } catch (e) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    fails.push(String(e.stack || e));
  } finally { missing.push(...g.missing); await g.close(); }
}

(async () => {
  const list = targets();
  if (!list.length) { console.log('Nothing to check: name card, bond or style ids, or --new.'); return; }
  console.log(`checking ${list.length}: ${list.map((x) => x.id).join(', ')}`);
  fs.mkdirSync(out, { recursive: true });
  const server = opt('--url', null) ? null : await serve(), url = opt('--url', null) || server.url + '?dev';
  const fails = [], warns = [], reports = [], missing = [], queue = [...list];
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, list.length)) }, () => worker(url, queue, fails, warns, reports, missing)));
  if (server) await server.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(reports, null, 2));
  if (missing.length) console.log(`\nimages that failed to load (${new Set(missing).size}):\n  ${[...new Set(missing)].slice(0, 12).join('\n  ')}`);
  console.log(`\n${reports.length} playbacks: ${fails.length} failed, ${warns.length} warnings${shots ? ` (screenshots in ${path.relative(root, out)})` : ''}`);
  if (fails.length) { console.log(fails.map((f) => '  ✗ ' + f).join('\n')); process.exitCode = 1; }
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
