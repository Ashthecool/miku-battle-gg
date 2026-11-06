// Records real Miku Battle gameplay for a short: a real Battle runs in the real game page (headless Chrome) and every
// signature attack of the cast is captured frame by frame.
//   node tools/short/capture.js <id> [group index]     frames to output/short/<id>/battle/g<N>/
// configs/<id>.json "battle": { bg, leader, foe, foeDeck, groups: [[cast ids, at most 4 per battle], ...] }
// Time is virtual (CDP Emulation.setVirtualTimePolicy): the game's animations (GSAP, timers, CSS) advance exactly 1/30 s
// per captured frame, so playback is smooth however long a screenshot takes, and the boring parts are skipped fast.
// A scripted director plays side 0 (cast cards into free slots, then one attack each at an enemy monster); the game's
// own AI plays the foe. log.json lists what happened when: attacks (with screen rects), impacts, card plays, sounds.
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const HERE = __dirname, REPO = path.join(HERE, '..', '..'), GAME = path.join(REPO, 'game');
const PORT = 8796, DBG = 9338, STEP = 1000 / 30, VW = 1600, VH = 900, DSF = +(process.env.DSF || 1.5);
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const [, , id, only] = process.argv;
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'configs', id + '.json'), 'utf8')), B = cfg.battle;
const manifest = require(path.join(GAME, 'assets/manifest.json'));
const OUT = path.join(REPO, 'output', 'short', id, 'battle'), CACHE = path.join(REPO, 'output', 'short', 'cache');
fs.mkdirSync(OUT, { recursive: true });
const bgSrc = (manifest.backgrounds.filter((b) => b.name === B.bg).find((b) => fs.existsSync(path.join(GAME, 'assets', b.src))) || {}).src;
if (!bgSrc) { console.error('no local background ' + B.bg); process.exit(1); }

const T = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(GAME, p);
  if (p === '/sw.js') { s.writeHead(404); return s.end(); } // no service worker: it would fetch from the network
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); return s.end(); }
    if (p === '/js/config.js') d = Buffer.from(d.toString().replace(/MB\.ASSET_BASE = '[^']*'/, "MB.ASSET_BASE = '/assets/'"));
    if (p === '/js/main.js') d = Buffer.from(d.toString().replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);'));
    s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); s.end(d);
  });
});

// ---- the page-side director (runs inside the game)
const director = (group, opts) => `(async () => {
  const b = MB.battle, V = MB.view, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = window.__log = [], L = (o) => log.push({ t: performance.now(), ...o });
  const group = ${JSON.stringify(group)}, captured = new Set(), p = b.me(0);
  window.__cap = 0;
  const rect = (u) => { const v = V.ents.get(u.uid); if (!v) return null; const r = v.el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const sfx0 = MB.audio.sfx; MB.audio.sfx = (n, ...a) => { if (window.__cap) L({ k: 'sfx', name: n }); return sfx0(n, ...a); };
  const atk0 = V.attackFx.bind(V);
  V.attackFx = async (att, tgt, impact, spill) => {
    const mine = att.side === 0;
    if (mine || ${opts.foeShots}) { window.__cap = 1; L({ k: 'attack', id: att.card.id, name: att.card.attack.name, side: att.side, tgt: tgt.isLeader ? 'leader' : tgt.card.id, ra: rect(att), rt: rect(tgt) }); await sleep(500); L({ k: 'go', id: att.card.id }); }
    await atk0(att, tgt, (...a) => { if (window.__cap) L({ k: 'impact', id: att.card.id }); return impact(...a); }, spill);
    if (window.__cap) { await sleep(800); L({ k: 'end', id: att.card.id }); window.__cap = 0; }
  };
  await V.run(() => b.start());
  // stack the hand: the cast cards are drawn first (a draw takes the last card of the deck)
  const cards = [...p.hand, ...p.deck], pick = group.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
  p.hand = pick.slice(0, 4); p.deck = cards.filter((c) => !p.hand.includes(c)); V.refresh();
  for (let turn = 0; turn < 14 && captured.size < group.length && !b.over; turn++) {
    while (b.busy || b.active !== 0) await sleep(50);
    p.maxGold = 10; p.gold = 10;
    for (const c of p.hand.slice()) {
      if (!group.includes(c.id) || captured.has(c.id) || b.units(0).some((u) => u.card.id === c.id)) continue;
      if (!b.freeSlots(0).length) break;
      const slot = [1, 2, 0, 3].find((s) => !p.board[s]); p.gold = 10;
      window.__cap = ${opts.plays ? 1 : 0}; L({ k: 'play', id: c.id }); b.busy = true;
      await b.playCard(0, c.cid, { slot }); b.busy = false; V.refresh();
      if (window.__cap) { await sleep(600); window.__cap = 0; } L({ k: 'played', id: c.id });
    }
    for (const u of b.units(0)) {
      if (!group.includes(u.card.id) || captured.has(u.card.id) || !b.canAttack(u)) continue;
      const foes = b.attackTargets(u).filter((t) => !t.isLeader).sort((a, c) => a.hp - c.hp);
      if (!foes.length) continue;
      b.busy = true; await sleep(300); await b.attack(u, foes[0]); b.busy = false; V.refresh(); captured.add(u.card.id);
    }
    if (captured.size >= group.length) break;
    b.busy = true; await sleep(200); b.busy = false;
    await b.endTurn();
  }
  window.__done = 1;
})()`;

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const groups = only != null ? [B.groups[+only]] : B.groups;
  const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${path.join(CACHE, 'chrome-capture')}`, `--window-size=${VW},${VH}`, '--hide-scrollbars', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let tgt; for (let i = 0; i < 60 && !tgt; i++) { try { tgt = (await (await fetch(`http://127.0.0.1:${DBG}/json`)).json()).find((x) => x.type === 'page'); } catch {} if (!tgt) await new Promise((r) => setTimeout(r, 300)); }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let n = 0; const wait = new Map(), events = [];
  ws.onmessage = (m) => { const o = JSON.parse(m.data); if (o.id && wait.has(o.id)) { wait.get(o.id)(o); wait.delete(o.id); } else if (o.method === 'Emulation.virtualTimeBudgetExpired') events.push('b'); else if (o.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(o.params.exceptionDetails).slice(0, 500)); else if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') console.log('ERR', o.params.args.map((a) => a.value || a.description).join(' ').slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 700)); return r.result.result.value; };
  const advance = async (ms) => { events.length = 0; await cdp('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: ms }); while (!events.length) await new Promise((r) => setTimeout(r, 1)); };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DSF, mobile: false });

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi], dir = path.join(OUT, 'g' + (only != null ? +only : gi)); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    await cdp('Emulation.setVirtualTimePolicy', { policy: 'advance' }); // real time while it boots
    await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/?dev` });
    for (let i = 0; i < 300; i++) { if (await ev('!!(window.MB && MB.view && MB.UI)').catch(() => false)) break; await new Promise((r) => setTimeout(r, 200)); }
    await ev("(() => { const l = document.getElementById('loading'); if (l) { l.click(); l.classList.add('hidden'); l.style.display = 'none'; } })()");
    const foeDeck = B.foeDeck, foeLeader = B.foe;
    // the battle, set up as ui.js startBattle does it
    await ev(`(async () => {
      const group = ${JSON.stringify(group)}, foeDeck = ${JSON.stringify(foeDeck)}, ids = [...group, ${JSON.stringify(B.leader)}, ${JSON.stringify(foeLeader)}, ...foeDeck];
      await MB.preloadImages([MB.asset(${JSON.stringify(bgSrc)}), ...(MB.bootImages || []), ...ids.flatMap((id) => MB.charImages(id))]);
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      MB.UI.setBg(MB.asset(${JSON.stringify(bgSrc)}));
      document.getElementById('arena').classList.remove('gallery-mode');
      const deck = []; for (let i = 0; i < 3; i++) deck.push(...group); while (deck.length < 20) deck.push(group[deck.length % group.length]);
      const fdeck = []; while (fdeck.length < 20) fdeck.push(foeDeck[fdeck.length % foeDeck.length]);
      const b = new MB.Battle({ view: MB.view, playerLeader: ${JSON.stringify(B.leader)}, enemyLeader: ${JSON.stringify(foeLeader)}, enemyHp: 60, playerDeck: deck.slice(0, 20), enemyDeck: fdeck,
        first: 1, control: ['local', 'ai'], playerLevels: {}, enemyLevels: {} });
      const cheap = new Set(['julie-hunley', 'isabella-hunley', 'keiko-ghan']); b.me(1).deck.sort((a, c) => cheap.has(a.id) - cheap.has(c.id)); // cheap monsters come first, so there is something to hit
      b.aiSkill = 0.7; MB.battle = b; MB.view.b = b;
      window.__go = () => ${director(group, { foeShots: !!B.foeShots, plays: B.plays !== false })};
      return true; })()`);
    await ev('window.__go(); true'); // runs on in the page
    await cdp('Emulation.setVirtualTimePolicy', { policy: 'pause' });
    const frames = []; let k = 0, t0 = Date.now(), vt = 0;
    for (let guard = 0; guard < 60000; guard++) {
      const st = await ev('JSON.stringify([window.__cap|0, window.__done|0])'), [cap, done] = JSON.parse(st);
      if (done) break;
      await advance(cap ? STEP : 100);
      if (cap) { const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 86 }); k++; fs.writeFileSync(path.join(dir, `f${String(k).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64')); frames.push(Math.round(await ev('performance.now()') * 100) / 100); if (k % 60 === 0) console.log(`g${gi}: ${k} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    }
    const log = await ev('JSON.stringify(window.__log)');
    fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify({ group, frames, log: JSON.parse(log), fps: 30, w: VW, h: VH, dsf: DSF }));
    console.log(`group ${gi}: ${k} frames, attacks by`, JSON.parse(log).filter((e) => e.k === 'attack' && e.side === 0).map((e) => e.id).join(', '));
  }
  ch.kill(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
