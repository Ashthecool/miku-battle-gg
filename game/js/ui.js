// Menus, story, deck builder, attack gallery and result screens.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const DECK_SIZE = MB.RULES.deckSize;

  // ---------------------------------------------------------------- save
  // When the save's shape changes: bump SAVE_VERSION and append a step to MIGRATIONS.
  // MIGRATIONS[v] upgrades a version-v save to v+1; saves from before versioning count as 0.
  const SAVE_VERSION = 9;
  const DECK_SLOTS = 3;
  // scales each fight's own AI skill (0..1) and enemy leader HP
  const DIFFICULTY = {
    easy:   { name: 'Easy',   ai: (a) => a * 0.5,               hp: 0.8 },
    normal: { name: 'Normal', ai: (a) => a,                     hp: 1 },
    hard:   { name: 'Hard',   ai: (a) => Math.min(1, a + 0.25), hp: 1.25 },
  };
  const MIGRATIONS = [
    (s) => {
      // older saves predate unlocks: start them on commons plus the rivals they already beat
      if (!Array.isArray(s.unlocked)) s.unlocked = [...new Set([...MB.STARTER_CARDS, ...MB.STORY.slice(0, s.story || 0).map((st) => st.foe)])];
      // story progress is kept per chapter; old saves only had chapter 1
      if (!Array.isArray(s.progress)) s.progress = [s.story || 0];
    },
    (s) => {
      // one deck became several slots; the old deck is slot 1
      s.decks = [{ name: 'Deck 1', cards: Array.isArray(s.deck) ? s.deck : MB.STARTER_DECK.slice() }];
      s.activeDeck = 0;
    },
    (s) => {
      // card packs and profile pictures arrived; everyone gets a welcome pack
      s.packs = { common: 1 };
      s.avatars = [MB.STARTER_AVATAR];
      s.avatar = MB.STARTER_AVATAR;
    },
    (s) => {
      // packs now hold card fragments; profile pictures moved to Story (loadSave hands out the cleared stages' ones)
      s.shards = {};
    },
    (s) => {
      // Glitter, daily missions (rolled by loadSave) and Shiny cards arrived
      s.glitter = 0;
      s.shiny = [];
    },
    (s) => {
      // Story stars: stage index -> the stars earned there (bits); chapters whose three-star Epic pack was paid out
      s.stars = {};
      s.starChapters = [];
    },
    (s) => {
      // the Arena: the run in progress (js/arena.js), the best one and how many were played
      s.arena = null;
      s.arenaBest = 0;
      s.arenaRuns = 0;
    },
    // Story became one story on maps (js/story.js): the stages cleared per chapter become done quests
    (s) => MB.Story.migrate(s),
    (s) => {
      // card levels (MB.LEVELS) and the Shop arrived; every card you own starts at Lv 1
      s.levels = {};
      s.shop = null;
    },
  ];
  const avatarById = new Map(MB.AVATARS.map((a) => [a.id, a]));
  const freshSave = () => ({ deck: MB.STARTER_DECK.slice(), leaders: MB.STARTER_LEADERS.slice(), story: 0, leader: 'hayley-kate' });
  const obj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

  // upgrades an old save, then fills in whatever content added since it was written
  function loadSave(raw) {
    const s = Object.assign(freshSave(), raw);
    for (let v = s.version || 0; v < SAVE_VERSION; v++) MIGRATIONS[v](s);
    s.version = SAVE_VERSION;
    // a hand-edited or partial save may claim a version but lack fields
    ['unlocked', 'quests', 'storyActs', 'secrets', 'actIntros', 'decks', 'avatars'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    // the starter deck's cards are always owned, so there is always a deck to play
    s.unlocked = [...new Set([...s.unlocked, ...MB.STARTER_CARDS])];
    // Story: the quests done (ids; hidden ones kept for NSFW mode) and the acts whose Epic pack was paid
    s.quests = [...new Set(s.quests)].filter((id) => MB.Story.byId(id));
    // whether M-chan's intro (MB.INTRO) was seen; saves that already started the story skip it
    s.intro = !!s.intro || s.quests.length > 0;
    s.storyActs = [...new Set(s.storyActs)].filter((a) => MB.ACTS[a]);
    // Story secrets found, and the acts whose opening fly-over was shown
    s.secrets = [...new Set(s.secrets)].filter((id) => MB.Story.secrets.some((x) => x.id === id));
    s.actIntros = [...new Set(s.actIntros)].filter((a) => MB.ACTS[a]);
    // card levels: card id -> Lv 2..max, for characters you own (Lv 1 isn't written down)
    const levels = obj(s.levels) ? s.levels : {};
    s.levels = {};
    Object.entries(levels).forEach(([id, n]) => {
      if (MB.HIDDEN_CARDS.has(id)) { if ((n |= 0) > 1) s.levels[id] = n; return; } // NSFW mode is off; kept for later
      if (MB.Collection.levels(id) && s.unlocked.includes(id) && (n |= 0) > 1) s.levels[id] = Math.min(n, MB.LEVELS.max);
    });
    // fragments: card id -> how many, toward unlocking a locked card or banked toward an owned character's levels;
    // never more than the card can still use
    const shards = obj(s.shards) ? s.shards : {};
    s.shards = {};
    Object.entries(shards).forEach(([id, n]) => {
      if (MB.HIDDEN_CARDS.has(id)) { if ((n |= 0) > 0) s.shards[id] = n; return; } // NSFW mode is off; kept for later
      if (!MB.CARDS[id] || !((n |= 0) > 0)) return;
      const cap = s.unlocked.includes(id) ? MB.Collection.toMax(id, MB.Collection.level(s, id)) : MB.Collection.need(id) - 1;
      if (cap > 0) s.shards[id] = Math.min(n, cap);
    });
    // decks: always DECK_SLOTS of them, and a deck holding a card you don't own goes back to the starter
    for (let i = 0; i < DECK_SLOTS; i++) {
      const d = obj(s.decks[i]) ? s.decks[i] : {};
      // cards hidden while NSFW mode is off wait in `hidden` and rejoin the deck when it's back on
      if (Array.isArray(d.cards)) {
        const all = d.cards.concat(Array.isArray(d.hidden) ? d.hidden : []);
        d.cards = all.filter((id) => !MB.HIDDEN_CARDS.has(id)).slice(0, DECK_SIZE);
        d.hidden = all.filter((id) => MB.HIDDEN_CARDS.has(id));
        if (!d.hidden.length) delete d.hidden;
      }
      if (!Array.isArray(d.cards) || d.cards.some((id) => !MB.CARDS[id] || !s.unlocked.includes(id))) d.cards = MB.STARTER_DECK.slice();
      d.name = String(d.name || '').slice(0, 20) || 'Deck ' + (i + 1);
      s.decks[i] = d;
    }
    s.decks.length = DECK_SLOTS;
    if (!(s.activeDeck >= 0 && s.activeDeck < DECK_SLOTS)) s.activeDeck = 0;
    s.deck = s.decks[s.activeDeck].cards.slice(); // working copy of the active deck; persist() writes it back
    s.costumes = s.costumes || {}; // character id -> chosen costume id
    if (!DIFFICULTY[s.difficulty]) s.difficulty = 'normal';
    // packs: tier -> how many are waiting to be opened
    s.packs = Object.fromEntries(Object.keys(MB.PACKS).map((t) => [t, Math.max(0, (obj(s.packs) && s.packs[t]) | 0)]));
    s.avatars = [...new Set([MB.STARTER_AVATAR, ...s.avatars.filter((a) => typeof a === 'string')])];
    MB.Collection.grantStoryAvatars(s); // stages cleared before pictures were Story rewards, or pictures added since
    if (!s.avatars.includes(s.avatar) || !avatarById.has(s.avatar)) s.avatar = MB.STARTER_AVATAR;
    s.name = String(s.name || '').slice(0, 20) || 'Player';
    // stats groups map an id to [wins, losses]
    s.stats = Object.assign({ leaders: {}, foes: {}, difficulty: {}, streak: 0, bestStreak: 0 }, s.stats);
    ['leaders', 'foes', 'difficulty'].forEach((k) => { if (!obj(s.stats[k])) s.stats[k] = {}; });
    s.glitter = Math.max(0, Math.floor(+s.glitter || 0));
    // Shiny cards you own (NSFW ones kept while the mode is off)
    s.shiny = [...new Set(Array.isArray(s.shiny) ? s.shiny : [])].filter((id) => MB.HIDDEN_CARDS.has(id) || (MB.CARDS[id] && s.unlocked.includes(id)));
    // today's missions: { day, list: [{ id, n, have, glitter, novel?, claimed? }], reroll }
    const ms = obj(s.missions) && Array.isArray(s.missions.list) ? s.missions : null;
    s.missions = ms && { day: String(ms.day), reroll: ms.reroll | 0, list: ms.list.filter((m) => obj(m) && MB.MISSIONS[m.id] && m.n > 0).slice(0, MB.Missions.PER_DAY)
      .map((m) => ({ ...m, have: Math.min(m.n, Math.max(0, m.have | 0)), glitter: m.glitter | 0 })) };
    MB.Missions.daily(s);
    // the Shop's deals for today: { day, deals: [{ card, n, price, bought? }] } (a deal on a card that's gone is dropped)
    const sh = obj(s.shop) && Array.isArray(s.shop.deals) ? s.shop : null;
    s.shop = sh && { day: String(sh.day), deals: sh.deals.filter((d) => obj(d) && MB.CARDS[d.card] && d.n > 0 && d.price > 0)
      .map((d) => ({ card: d.card, n: d.n | 0, price: d.price | 0, ...(d.bought ? { bought: true } : {}) })) };
    MB.Shop.daily(s);
    s.stars = Object.fromEntries(Object.entries(obj(s.stars) ? s.stars : {}).filter(([k, v]) => MB.STORY[k] && (v & 7)).map(([k, v]) => [k, v & 7]));
    s.starChapters = Array.isArray(s.starChapters) ? s.starChapters.filter((c) => MB.CHAPTERS[c]) : [];
    if (!MB.Arena.valid(s.arena)) s.arena = null; // a run built on cards that are gone (NSFW mode switched off) ends
    s.arenaBest = s.arenaBest | 0; s.arenaRuns = s.arenaRuns | 0;
    return s;
  }
  function validSave(s) {
    return obj(s) && !(s.version > SAVE_VERSION)
      && ['deck', 'decks', 'leaders', 'unlocked', 'progress', 'quests', 'storyActs', 'secrets', 'actIntros', 'avatars', 'shiny'].every((k) => s[k] === undefined || Array.isArray(s[k]))
      && ['costumes', 'stats', 'packs', 'shards', 'levels', 'stars'].every((k) => s[k] === undefined || obj(s[k]))
      && (s.missions == null || obj(s.missions)) && (s.arena == null || obj(s.arena)) && (s.shop == null || obj(s.shop));
  }
  function readStored() {
    const raw = localStorage.getItem('mb-save');
    try {
      const s = JSON.parse(raw || '{}');
      if (validSave(s)) return s;
    } catch (e) { /* fall through */ }
    // keep the unreadable save around instead of silently losing it
    localStorage.setItem('mb-save-broken-' + Date.now(), raw);
    return {};
  }

  const save = loadSave(readStored());
  // the active deck is edited through save.deck; write it back into its slot before saving
  function snapshot() {
    save.decks[save.activeDeck].cards = save.deck.slice();
    const { deck, ...out } = save;
    return out;
  }
  const persist = () => localStorage.setItem('mb-save', JSON.stringify(snapshot()));
  persist();

  function switchDeck(i) {
    if (i === save.activeDeck) return;
    persist();
    save.activeDeck = i;
    save.deck = save.decks[i].cards.slice();
    persist();
  }

  function exportSave() {
    const data = { game: 'miku-battle', exported: new Date().toISOString(), save: snapshot() };
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `miku-battle-save-${new Date().toLocaleDateString('sv')}.json`; // local YYYY-MM-DD
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    saveStatus('Save downloaded.');
  }
  async function importSave(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { return saveStatus('That file isn\'t a save.', true); }
    const s = data && data.game === 'miku-battle' ? data.save : data;
    if (!validSave(s)) return saveStatus(s && s.version > SAVE_VERSION ? 'That save is from a newer version of the game.' : 'That file isn\'t a save.', true);
    if (!confirm('Replace your current progress with this save?')) return;
    Object.keys(save).forEach((k) => delete save[k]);
    Object.assign(save, loadSave(s));
    persist();
    saveStatus('Save loaded.');
    if ($('#arena').classList.contains('gallery-mode')) MB.view.clear();
    title();
  }
  function resetSave() {
    if (MB.battle && !MB.battle.over && !$('#arena').classList.contains('gallery-mode')) return saveStatus('Finish or forfeit the battle first.', true);
    if (!confirm('Delete ALL your progress (cards, packs, Story, stats) and start over?\nExport your save first if you might want it back.')) return;
    Object.keys(save).forEach((k) => delete save[k]);
    Object.assign(save, loadSave({}));
    persist();
    saveStatus('Progress reset.');
    $('#settings').classList.remove('open');
    if ($('#arena').classList.contains('gallery-mode')) MB.view.clear();
    start();
  }
  function saveStatus(msg, bad) {
    const n = $('#save-status');
    n.textContent = msg;
    n.classList.toggle('bad', !!bad);
  }

  const deckCards = MB.Collection.deckCards;
  const maxCopies = (id) => MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2;

  // ---------------------------------------------------------------- collection
  const isUnlocked = (id) => save.unlocked.includes(id);
  const shardsOf = (id) => save.shards[id] || 0;
  // A locked card is drawn in pieces, one shard per fragment it needs; the ones you have are see-through.
  // A card is always cut the same way (seeded by its id) and its pieces always fill in in the same order.
  const SHARD_GRID = { 1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 2], 5: [1, 5], 6: [2, 3], 8: [2, 4], 9: [3, 3] };
  const shardCache = new Map();
  function seeded(str) {
    let h = 1779033703;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) >>> 0;
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  // the pieces as SVG point lists over the card's 166x226 border box, in fill-in order
  function shardShapes(id) {
    if (shardCache.has(id)) return shardCache.get(id);
    const n = MB.Collection.need(id), [cols, rows] = SHARD_GRID[n] || [1, n], rnd = seeded(id);
    const cw = 166 / cols, ch = 226 / rows, jit = (k) => (rnd() - 0.5) * k;
    const v = [];
    for (let x = 0; x <= cols; x++) {
      v[x] = [];
      for (let y = 0; y <= rows; y++) v[x][y] = [x * cw + (x % cols ? jit(cw * 0.5) : 0), y * ch + (y % rows ? jit(ch * 0.5) : 0)];
    }
    // jagged cuts: a kinked midpoint on every inner edge, shared by the pieces on either side
    const mid = (a, b, dx, dy) => [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy];
    const hm = {}, vm = {};
    for (let x = 0; x < cols; x++) for (let y = 0; y <= rows; y++) hm[x + ',' + y] = mid(v[x][y], v[x + 1][y], 0, y % rows ? jit(ch * 0.35) : 0);
    for (let x = 0; x <= cols; x++) for (let y = 0; y < rows; y++) vm[x + ',' + y] = mid(v[x][y], v[x][y + 1], x % cols ? jit(cw * 0.35) : 0, 0);
    const out = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      out.push([v[x][y], hm[x + ',' + y], v[x + 1][y], vm[(x + 1) + ',' + y], v[x + 1][y + 1], hm[x + ',' + (y + 1)], v[x][y + 1], vm[x + ',' + y]]
        .map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    }
    for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
    shardCache.set(id, out);
    return out;
  }
  function shardOverlay(id, have = shardsOf(id)) {
    const need = MB.Collection.need(id);
    return el('div', 'shards' + (have ? '' : ' none'), `
      <svg viewBox="0 0 166 226" preserveAspectRatio="none">${shardShapes(id).map((pts, i) => `<polygon class="sh${i < have ? ' got' : ''}" points="${pts}"/>`).join('')}</svg>
      <div class="shard-veil"><b>🔒</b><span>${MB.RARITY[MB.CARDS[id].rarity].name}</span></div>
      <div class="shard-count"><i style="width:${(have / need) * 100}%"></i><span>🧩 ${have}/${need}</span></div>`);
  }

  // ---------------------------------------------------------------- packs & profile pictures
  const hasAvatar = (id) => save.avatars.includes(id);
  const ownedAvatars = () => MB.AVATARS.filter((a) => hasAvatar(a.id)).length;
  const allCollected = () => !MB.Collection.locked(save).length;
  const packCount = () => Object.values(save.packs).reduce((a, b) => a + b, 0);

  // spends one pack of this tier and adds its fragments: [{ card, from, to, need, done }]
  function openPack(tier) {
    if (!(save.packs[tier] > 0)) return null;
    save.packs[tier]--;
    const got = MB.Collection.openPack(save, tier);
    got.glitter = got.extra * MB.GLITTER.extra; // fragments past a card's complete aren't wasted
    save.glitter += got.glitter;
    persist();
    return got;
  }
  function setAvatar(id) {
    if (!hasAvatar(id)) return;
    save.avatar = id;
    persist();
    refreshProfileBits();
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    const s = document.getElementById(id);
    if (s) gsap.fromTo(s.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' });
  }
  function hideBattle() {
    $('#battle-hud').classList.add('hidden');
    $('#arena').classList.add('hidden');
    $('#arena').classList.remove('gallery-mode');
    $('#gallery-panel').classList.add('hidden');
    MB.UI.preview(null);
  }

  function setBg(src) {
    const bg = $('#bg');
    const next = el('div', 'bg-img');
    next.style.backgroundImage = `url("${src}")`;
    bg.appendChild(next);
    gsap.fromTo(next, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out', onComplete: () => { while (bg.children.length > 1) bg.firstChild.remove(); } });
    return next;
  }
  // a background by name, or by id where several novels share a name ("background 1")
  const bgByName = (name) => (MB.manifest.backgrounds.find((b) => b.id === name || b.name.trim().toLowerCase() === name.toLowerCase()) || MB.pick(MB.manifest.backgrounds));

  // ---------------------------------------------------------------- cards
  // a card as you'd play it: at the level you have it (MB.LEVELS)
  const myDef = (id) => MB.Collection.leveled(MB.cardDef(id), MB.Collection.level(save, id));
  // big: the art will be shown zoomed in (close-up, reveal). A card given by id shows at your level, unless base
  // (the Arena plays every card at Lv 1); a card from a battle shows the level it was played at
  function cardEl(card, big, { base } = {}) {
    const def = card.cid ? card : base ? MB.cardDef(card.id || card) : myDef(card.id || card);
    const c = el('div', `card r-${def.rarity} t-${def.type}`);
    const color = def.type === 'spell' ? def.color : def.attack.color;
    const rar = MB.RARITY[def.rarity];
    c.dataset.id = def.id;
    c.style.setProperty('--c', color);
    let art;
    if (def.type === 'spell') art = `<img class="item-art" src="${MB.itemIcon(def.id)}">`;
    else if (def.emoji) art = `<div class="emoji-art">${def.emoji}</div>`;
    else if (def.fused) art = MB.duoHtml(def, 'idle', big);
    else art = `<img src="${MB.spriteUrl(def.id, 'idle', def.outfit ? def.outfit.costume : def.combo && def.combo.costume, big)}">`;
    const bonds = def.fused ? [def.bond] : def.type === 'unit' ? MB.bondsOf(def.id) : [];
    const badge = (bonds.length ? `<div class="card-bond" title="Relationship">${def.fused ? MB.BOND_TIERS[def.bond.tier].hearts : '♥'}</div>` : '') +
      (!def.fused && (def.combo || MB.combosOf(def.id).length) ? `<div class="card-combo${bonds.length ? ' second' : ''}" title="Item combo">🔗</div>` : '');
    // three or more keywords only fit as icons (the close-up spells them out); long texts get a smaller font
    const kwList = def.kw || [], iconsOnly = kwList.length >= 3;
    const kws = kwList.map((k) => iconsOnly ? `<b title="${MB.KEYWORDS[k].name}">${MB.KEYWORDS[k].icon}</b>` : `<b>${MB.KEYWORDS[k].icon} ${MB.KEYWORDS[k].name}</b>`).join(' ');
    const len = (def.text || '').length + (def.type === 'unit' ? def.attack.name.length : 0)
      + (iconsOnly ? 20 : kwList.reduce((n, k) => n + MB.KEYWORDS[k].name.length + 4, 0));
    const dense = len > 100 ? ' dense-2' : len > 88 ? ' dense' : '';
    c.innerHTML = `
      <div class="card-art${def.fused ? ' duo' : ''}">${art}</div>${badge}
      <div class="cost">${def.cost}</div>
      <div class="card-name">${def.name}</div>
      <div class="card-body${dense}">
        ${kws ? `<div class="kws${iconsOnly ? ' icons' : ''}">${kws}</div>` : ''}
        <div class="card-text">${def.text || ''}</div>
        ${def.type === 'unit' && def.attack.name ? `<div class="card-attack">✦ ${def.attack.name}</div>` : ''}
      </div>
      ${def.type === 'unit' ? `<div class="stat atk">${def.atk}</div><div class="stat hp">${def.hp}</div>` : '<div class="spell-tag">ITEM</div>'}
      ${def.rarity !== 'token' ? `<div class="r-gem" title="${rar.name}"></div>` : ''}
      ${def.level > 1 ? levelBadge(def.level) : ''}`;
    // a Shiny card (bought with Glitter): holographic sheen and sparkles, wherever the card shows up
    if (!def.fused && save.shiny.includes(def.id)) {
      c.classList.add('shiny');
      c.appendChild(el('div', 'shine', '<i>✦</i><i>✦</i><i>✦</i>'));
    }
    return c;
  }

  const levelBadge = (lv) => (lv >= MB.LEVELS.max ? `<div class="card-lv max" title="Max level">★ MAX</div>` : `<div class="card-lv" title="Level ${lv}">Lv ${lv}</div>`);

  function preview(ent) {
    const p = $('#preview');
    if (!ent) { p.classList.remove('show'); return; }
    p.innerHTML = '';
    if (ent.isLeader) {
      const ch = MB.charById(ent.charId), pw = MB.POWERS[ent.charId];
      p.appendChild(el('div', 'leader-info', `
        <img src="${MB.spriteUrl(ent.charId, 'idle')}">
        <h3>${ch.name}</h3><div class="hpline">❤ ${Math.max(0, ent.hp)} / ${ent.maxHp}</div>
        <div class="pw"><b>${pw.name}</b> (${pw.cost} gold)<br>${pw.text}</div>
        <p>${ch.short}</p>`));
    } else {
      const c = cardEl(ent.card);
      c.querySelector('.atk').textContent = ent.atk;
      c.querySelector('.hp').textContent = Math.max(0, ent.hp);
      p.appendChild(c);
      const notes = [];
      if (ent.frozen) notes.push('❄️ Frozen — skips its next attack.');
      if (ent.burning) notes.push('♨️ Burning — takes 1 damage each turn until healed.');
      if (ent.shield) notes.push('🔰 Shielded.');
      if (ent.sick && ent.attacksLeft === 0) notes.push('💤 Just arrived — can attack next turn.');
      if (ent.card.fused) notes.push(`💞 <b>${ent.card.members.map((m) => MB.charById(m.id).name).join(' & ')}</b> — ${ent.card.bond.relation}`);
      if (ent.card.combo) notes.push(`🔗 <b>Item combo</b>: ${ent.card.combo.text}`);
      [...ent.kw].forEach((k) => notes.push(`${MB.KEYWORDS[k].icon} <b>${MB.KEYWORDS[k].name}</b>: ${MB.KEYWORDS[k].text}`));
      if (notes.length) p.appendChild(el('div', 'notes', notes.join('<br>')));
    }
    p.classList.add('show');
  }

  // ---------------------------------------------------------------- title
  // just the scenery, the music and the buttons: backgrounds slowly pan and crossfade
  let titleTimer = null;
  function titleScene() {
    if (!$('#screen-title').classList.contains('active')) { titleTimer = null; return; }
    const pool = MB.manifest.backgrounds.filter((b) => /street|beach|sunset|campus|school|city|forrest|mountain|shore/i.test(b.name));
    const img = setBg(MB.asset(MB.pick(pool).src));
    const dir = Math.random() < 0.5 ? -1 : 1;
    gsap.to(img, { scale: 1.14, x: dir * 40, y: MB.pick([-20, 20]), duration: 14, delay: 1.2, ease: 'sine.inOut' });
    titleTimer = gsap.delayedCall(11, titleScene);
  }
  // letters drop in one by one, then bob in a wave with a glint sweeping across
  let logoLoop = [];
  function logoIntro() {
    const split = (node) => {
      if (!node.dataset.split) { node.innerHTML = [...node.textContent].map((ch) => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join(''); node.dataset.split = 1; }
      return node.querySelectorAll('span');
    };
    const top = split($('.logo-top')), main = split($('.logo-main')), sub = $('.logo-sub');
    logoLoop.forEach((t) => t.kill());
    gsap.set([top, main], { clearProps: 'all' });
    const tl = gsap.timeline({ delay: 0.15 });
    tl.fromTo(main, { y: -220, opacity: 0, rotationX: -100, scale: 0.4 },
      { y: 0, opacity: 1, rotationX: 0, scale: 1, duration: 0.9, stagger: 0.07, ease: 'back.out(2.2)' })
      .call(() => MB.audio.sfx('slam'), null, 0.45)
      .fromTo(top, { opacity: 0, x: -40, filter: 'blur(8px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.06, ease: 'power3.out' }, 0.35)
      .fromTo(sub, { opacity: 0, letterSpacing: '30px' }, { opacity: 1, letterSpacing: '6px', duration: 0.8, ease: 'power3.out' }, 0.7)
      .fromTo('#logo', { scale: 1.06 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' }, 0.55);
    tl.call(() => {
      logoLoop = [
        gsap.to(main, { y: -8, duration: 1.4, ease: 'sine.inOut', stagger: { each: 0.12, repeat: -1, yoyo: true } }),
        gsap.timeline({ repeat: -1, repeatDelay: 3.5 })
          .to(main, { filter: 'brightness(1.7)', duration: 0.12, stagger: 0.06 })
          .to(main, { filter: 'brightness(1)', duration: 0.3, stagger: 0.06 }, 0.12),
      ];
    });
  }

  // Quick Battle and the Attack Gallery are developer tools, shown in dev mode. It's on by default when the game
  // runs locally (file:// or localhost); ⚙️ → Developer mode or ?dev / ?dev=0 switch it, remembered in this browser.
  let dev = (() => {
    const q = new URLSearchParams(location.search).get('dev');
    const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    try {
      if (q != null) localStorage.setItem('mb-dev', q === '0' ? '0' : '1');
      const stored = localStorage.getItem('mb-dev');
      return stored == null ? local : stored === '1';
    } catch (e) { return q != null ? q !== '0' : local; }
  })();
  function setDev(on) {
    dev = on;
    try { localStorage.setItem('mb-dev', on ? '1' : '0'); } catch (e) { /* not remembered */ }
    document.body.classList.toggle('dev', dev);
    $('#dev-mode').checked = dev;
  }

  function title() {
    hideBattle();
    show('screen-title');
    MB.audio.music(MB.MUSIC.title);
    if (titleTimer) titleTimer.kill();
    titleScene();
    logoIntro();
    refreshProfileBits();
    MB.MenuTips.hide(true);
    const btns = [...document.querySelectorAll('#screen-title .menu-btn')].filter((b) => b.offsetParent);
    gsap.fromTo(btns, { opacity: 0, x: -80, rotationY: -35, filter: 'blur(10px)' },
      { opacity: 1, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.08, delay: 0.25, ease: 'power3.out', clearProps: 'filter' });
    guide();
  }

  // the game's first start plays M-chan's intro, which leads to the title screen and its Story button
  function start() {
    if (save.intro) return title();
    MB.StoryMap.scene(MB.INTRO, () => { save.intro = true; persist(); title(); }, { arc: 'Welcome to', title: 'Miku Battle', color: '#ff6fae' });
  }
  // until the first quest is done, M-chan stands next to the Story button and it pulses
  let guideLoop = [];
  function guide() {
    const g = $('#mchan-guide'), on = save.intro && !save.quests.length && !!MB.charById('m-chan');
    guideLoop.forEach((t) => t.kill());
    guideLoop = [];
    g.classList.toggle('hidden', !on);
    if (!on) return gsap.set('#btn-story', { clearProps: 'boxShadow' });
    const img = g.querySelector('img'), bub = g.querySelector('.mg-bubble');
    img.src = MB.bigSpriteUrl('m-chan', 'taunt');
    gsap.fromTo(img, { x: 160, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.9, ease: 'power3.out' });
    gsap.fromTo(bub, { scale: 0, opacity: 0, transformOrigin: '0% 30%' }, { scale: 1, opacity: 1, duration: 0.5, delay: 1.3, ease: 'back.out(2)' });
    guideLoop = [
      gsap.to(bub, { x: -10, duration: 0.6, delay: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      gsap.fromTo('#btn-story', { boxShadow: '0 0 0 0 rgba(255,111,174,0)' },
        { boxShadow: '0 0 0 4px rgba(255,111,174,.9), 0 0 40px rgba(255,111,174,.9)', duration: 0.8, delay: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    ];
  }

  function bindMenuFx() {
    document.body.classList.toggle('dev', dev);
    $('#dev-mode').checked = dev;
    $('#dev-mode').onchange = (e) => { MB.audio.sfx('click'); setDev(e.target.checked); };
    $('#nsfw-mode').checked = MB.NSFW;
    $('#nsfw-mode').onchange = (e) => {
      MB.audio.sfx('click');
      const on = e.target.checked;
      // the page reloads, which would throw away a battle in progress
      if (MB.battle && !MB.battle.over && !$('#arena').classList.contains('gallery-mode')) { e.target.checked = !on; return saveStatus('Finish or forfeit the battle first.', true); }
      if (on && !confirm('NSFW mode shows adult content (nudity and sexual themes).\nAre you 18 or older?')) { e.target.checked = false; return; }
      persist();
      MB.setNsfw(on);
    };
    MB.MenuTips.bind();
    document.querySelectorAll('#screen-title .menu-btn').forEach((b) => {
      const sheen = el('b', 'sheen');
      b.appendChild(sheen);
      b.addEventListener('pointerenter', () => {
        MB.audio.sfx('hover');
        gsap.to(b, { x: 18, scale: 1.04, duration: 0.3, ease: 'back.out(2)' });
        gsap.to(b.querySelector('i'), { rotation: 360, scale: 1.25, duration: 0.5, ease: 'back.out(2)' });
        gsap.fromTo(sheen, { xPercent: -120 }, { xPercent: 260, duration: 0.7, ease: 'power2.inOut' });
      });
      b.addEventListener('pointerleave', () => {
        gsap.to(b, { x: 0, scale: 1, duration: 0.35, ease: 'power2.out' });
        gsap.to(b.querySelector('i'), { rotation: 0, scale: 1, duration: 0.35 });
      });
      b.addEventListener('pointerdown', (e) => {
        gsap.fromTo(b, { scale: 0.96 }, { scale: 1.04, duration: 0.4, ease: 'elastic.out(1,0.4)' });
        if (MB.Cards) MB.Cards.burst(e.clientX, e.clientY, getComputedStyle(b).getPropertyValue('--glow').trim() || '#ff6fae', 18);
      });
    });
  }

  // ---------------------------------------------------------------- leader select
  // onBack: where ← Back goes (the main menu, unless given)
  function leaderSelect(onPick, foeId, onBack = title) {
    show('screen-leader');
    battleOpts();
    $('#screen-leader [data-back]').onclick = () => { MB.audio.sfx('click'); onBack(); };
    const grid = $('#leader-grid');
    grid.innerHTML = '';
    let novel = null;
    MB.manifest.characters.forEach((ch) => {
      const unlocked = save.leaders.includes(ch.id);
      if (ch.id === foeId) return;
      if (ch.novel !== novel) { novel = ch.novel; grid.appendChild(el('div', 'grid-head', novel)); }
      const pw = MB.POWERS[ch.id];
      const t = el('div', 'leader-tile' + (unlocked ? '' : ' locked') + (save.leader === ch.id ? ' chosen' : ''), `
        <img src="${MB.spriteUrl(ch.id, 'idle')}">
        <div class="lt-name">${ch.name}</div>
        <div class="lt-power">${unlocked ? `<b>${pw.name}</b> (${pw.cost})<br>${pw.text}` : '🔒 Beat them in Story'}</div>`);
      if (unlocked) {
        t.addEventListener('pointerenter', () => { gsap.to(t.querySelector('img'), { y: -12, scale: 1.06, duration: 0.25 }); t.querySelector('img').src = MB.spriteUrl(ch.id, 'taunt'); MB.audio.sfx('hover'); });
        t.addEventListener('pointerleave', () => { gsap.to(t.querySelector('img'), { y: 0, scale: 1, duration: 0.25 }); t.querySelector('img').src = MB.spriteUrl(ch.id, 'idle'); });
        t.addEventListener('click', () => { MB.audio.sfx('click'); save.leader = ch.id; persist(); onPick(ch.id); });
      }
      grid.appendChild(t);
    });
  }

  // deck + difficulty pickers shown above the leader grid
  function battleOpts() {
    const box = $('#battle-opts');
    box.innerHTML = '';
    const sel = el('select');
    save.decks.forEach((d, i) => {
      const cards = i === save.activeDeck ? save.deck : d.cards;
      sel.appendChild(new Option(`${d.name} (${cards.length}/${DECK_SIZE})`, i, false, i === save.activeDeck));
    });
    sel.onchange = () => { MB.audio.sfx('click'); switchDeck(+sel.value); };
    const seg = el('div', 'seg');
    Object.entries(DIFFICULTY).forEach(([k, d]) => {
      const b = el('button', k === save.difficulty ? 'on' : '', d.name);
      b.onclick = () => { MB.audio.sfx('click'); save.difficulty = k; persist(); battleOpts(); };
      seg.appendChild(b);
    });
    const lab = (text, ctl) => { const l = el('label', null, `<span>${text}</span>`); l.appendChild(ctl); return l; };
    box.append(lab('Deck', sel), lab('Difficulty', seg));
  }

  // ---------------------------------------------------------------- story
  // the map, quests and scenes are js/storymap.js; this is the fight's intro and the result
  // ★★☆ for a stage's star bits; `fresh` bits get the .new class (the result screen animates them)
  const starRow = (have, fresh = 0) => [0, 1, 2].map((k) => `<i class="${have & (1 << k) ? 'on' : ''}${fresh & (1 << k) ? ' new' : ''}">${have & (1 << k) ? '★' : '☆'}</i>`).join('');

  // visual-novel style intro before each story battle
  function intro(i, leaderId) {
    const st = MB.STORY[i], ch = MB.charById(st.foe);
    setBg(MB.asset(bgByName(st.bg).src));
    const music = MB.themeOf(st.foe) || st.music;
    MB.audio.music(music);
    show('screen-intro');
    $('#intro-foe').src = MB.bigSpriteUrl(st.foe, 'taunt');
    $('#intro-me').src = MB.bigSpriteUrl(leaderId, 'idle');
    $('#intro-name').textContent = ch.name;
    $('#intro-text').textContent = '';
    gsap.fromTo('#intro-foe', { x: 400, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    gsap.fromTo('#intro-me', { x: -400, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    const text = st.intro, boss = MB.bossOf(i);
    faceOff(!!boss);
    // a finale's boss rule, spelled out before the fight
    document.querySelectorAll('#screen-intro .intro-boss, #screen-intro .intro-stars').forEach((n) => n.remove());
    // the stage's three stars, the ones you have lit
    const have = save.stars[i] | 0;
    const stars = el('div', 'intro-stars', MB.Stars.starsOf(i).map((s, k) => `<span class="${have & (1 << k) ? 'on' : ''}">${have & (1 << k) ? '★' : '☆'} ${s.text}</span>`).join('')
      + (save.difficulty === 'easy' ? '<em>Stars need Normal or Hard</em>' : ''));
    $('#intro-text').after(stars);
    gsap.fromTo(stars, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.4 + text.length * 0.03 });
    if (boss) {
      const b = el('div', 'intro-boss', `👑 <b>Boss rule — ${boss.name}:</b> ${boss.text}${boss.rage ? `<br>💢 <b>${boss.rage.name}:</b> ${boss.rage.text}` : ''}`);
      b.style.setProperty('--c', boss.color);
      $('#intro-text').after(b);
      gsap.fromTo(b, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.6 + text.length * 0.03 });
    }
    const o = { n: 0 };
    gsap.to(o, { n: text.length, duration: text.length * 0.03, delay: 0.6, ease: 'none', onUpdate: () => { $('#intro-text').textContent = text.slice(0, o.n | 0); } });
    $('#intro-go').onclick = () => {
      MB.audio.sfx('click');
      startBattle({ leader: leaderId, foe: st.foe, foeHp: st.hp, ai: st.ai, level: st.level, bg: st.bg, music, story: i, boss });
    };
  }

  // the rivals square up: streaks of colour rush in behind each of them, a flash, and a VS slams down between them
  function faceOff(boss) {
    const scr = $('#screen-intro');
    scr.querySelectorAll('.intro-slash, .intro-vs, .intro-flash').forEach((n) => { gsap.killTweensOf(n); n.remove(); });
    const left = el('div', 'intro-slash left'), right = el('div', 'intro-slash right' + (boss ? ' boss' : ''));
    const vs = el('div', 'intro-vs' + (boss ? ' boss' : ''), `<b>VS</b>${boss ? '<small>👑 Boss battle</small>' : ''}`), flash = el('div', 'intro-flash');
    scr.prepend(left, right);
    scr.querySelector('.vn-box').before(vs);
    scr.appendChild(flash);
    MB.audio.sfx('swish');
    const tl = gsap.timeline()
      .fromTo(left, { xPercent: -110 }, { xPercent: 0, duration: 0.45, ease: 'power3.out' }, 0.05)
      .fromTo(right, { xPercent: 110 }, { xPercent: 0, duration: 0.45, ease: 'power3.out' }, 0.05)
      .fromTo(vs, { scale: 4, opacity: 0, rotation: -25 }, { scale: 1, opacity: 1, rotation: -6, duration: 0.35, ease: 'power4.in' }, 0.45)
      .call(() => MB.audio.sfx('slam'), null, 0.8)
      .fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.8)
      .fromTo(scr, { x: 16 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)', clearProps: 'x' }, 0.8)
      .call(() => { gsap.to(vs, { scale: 1.06, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' }); flash.remove(); }, null, 1.3);
    if (boss) tl.fromTo(vs.querySelector('small'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 }, 1);
  }

  // the first quest's practice battle against Hayley, Maria coaching (js/tutorial.js); then() goes on with the story
  function lesson(then) {
    const T = MB.TUTORIAL;
    startBattle({ leader: T.leader, foe: T.foe, foeHp: T.foeHp, ai: T.ai, bg: T.bg, music: T.music, foeDeck: MB.STARTER_DECK, lesson: then });
  }

  // ---------------------------------------------------------------- quick battle
  // a battle away from Story: any background that isn't a close-up scene, and the foe's theme or something upbeat
  const randomBg = () => MB.pick(MB.manifest.backgrounds.filter((b) => !/hug|white/i.test(b.name)));
  function battleMusic(foe) {
    const upbeat = MB.manifest.music.filter((m) => /exciting|fast|fun|happy/i.test(m.tags.join(' ') + m.name));
    return MB.themeOf(foe) || MB.pick(upbeat.length ? upbeat : MB.manifest.music).id;
  }
  function quick() {
    leaderSelect((lid) => {
      const foes = MB.manifest.characters.map((c) => c.id).filter((id) => id !== lid);
      const foe = MB.pick(foes);
      startBattle({ leader: lid, foe, foeHp: MB.RULES.leaderHp, ai: 0.7, bgSrc: randomBg().src, music: battleMusic(foe) });
    });
  }

  // the board sprites were loaded at boot (main.js; listed again in case that timed out); a battle also needs its background, the full-size
  // fusion cut-ins, and later shows close-ups of the decks' cards and the result screen
  function battleImages(cfg, bgSrc, decks) {
    const need = [...MB.bootImages, MB.asset(bgSrc)], later = [];
    const ids = new Set([cfg.leader, cfg.foe, ...decks.flat()]);
    // only the relationships that can form in this battle
    MB.BONDS.filter((bd) => bd.pair.every((id) => ids.has(id))).forEach((bd) => bd.pair.forEach((id, i) => {
      need.push(MB.bigSpriteUrl(id, 'play', bd.costumes[i]));
      later.push(MB.bigSpriteUrl(id, 'idle', bd.costumes[i]));
    }));
    // the combos that can happen: the partner's cut-in in the combo's outfit
    MB.COMBOS.filter((c) => ids.has(c.char) && c.items.some((id) => ids.has(id))).forEach((c) => need.push(MB.bigSpriteUrl(c.char, 'play', c.costume)));
    // outfit upgrades: the cut-in in the new outfit, and its board sprites
    ids.forEach((id) => ((MB.CARDS[id] || {}).upgrades || []).forEach((u) => {
      need.push(MB.bigSpriteUrl(id, 'play', u.costume));
      ['idle', 'taunt', 'attack', 'hurt'].forEach((role) => later.push(MB.spriteUrl(id, role, u.costume)));
    }));
    // item cards aren't characters, so their urls come back empty and are skipped
    ids.forEach((id) => later.push(MB.bigSpriteUrl(id, 'idle'), MB.bigSpriteUrl(id, 'taunt')));
    [cfg.leader, cfg.foe].forEach((id) => later.push(MB.bigSpriteUrl(id, 'win'), MB.bigSpriteUrl(id, 'lose')));
    return { need, later };
  }

  // shows the loading screen only if the images aren't ready within a moment
  async function loadImages(urls) {
    const load = $('#loading'), bar = load.querySelector('.bar i');
    const show = setTimeout(() => {
      load.firstElementChild.textContent = 'Loading battle…';
      load.classList.remove('hidden');
      gsap.fromTo(load, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    }, 150);
    bar.style.width = '0';
    await Promise.race([MB.preloadImages(urls, (f) => { bar.style.width = f * 100 + '%'; }), new Promise((res) => setTimeout(res, 30000))]);
    clearTimeout(show);
    if (!load.classList.contains('hidden')) gsap.to(load, { opacity: 0, duration: 0.3, onComplete: () => load.classList.add('hidden') });
  }

  let current = null, starting = false;
  async function startBattle(cfg) {
    // cfg.deck: the Arena's drafted deck instead of yours; the Arena sets its own foe HP and skill, so no difficulty
    if (!cfg.deck && save.deck.length !== DECK_SIZE) { alert(`${save.decks[save.activeDeck].name} needs exactly ${DECK_SIZE} cards.`); deck(); return; }
    if (starting) return;
    const diff = cfg.arena ? DIFFICULTY.normal : DIFFICULTY[save.difficulty];
    const bgSrc = cfg.bgSrc || bgByName(cfg.bg).src;
    const playerDeck = (cfg.deck || save.deck).slice(), enemyDeck = cfg.foeDeck ? cfg.foeDeck.slice() : MB.AI.deck(cfg.foe, cfg.level);
    const imgs = battleImages(cfg, bgSrc, [playerDeck, enemyDeck]);
    starting = true;
    await loadImages(imgs.need);
    starting = false;
    MB.preloadImages(imgs.later);
    current = { ...cfg, difficulty: cfg.arena ? 'arena' : save.difficulty };
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    setBg(MB.asset(bgSrc));
    MB.audio.music(cfg.music);
    $('#arena').classList.remove('gallery-mode');
    const b = new MB.Battle({ view: MB.view, playerLeader: cfg.leader, enemyLeader: cfg.foe, enemyHp: Math.round(cfg.foeHp * diff.hp),
      playerDeck, enemyDeck, boss: cfg.boss, first: cfg.lesson ? 0 : null, playerLevels: cfg.arena ? null : { ...save.levels } });
    b.aiSkill = diff.ai(cfg.ai);
    if (cfg.lesson) MB.Tutorial.coach(b);
    $('#player-avatar').src = MB.avatarUrl(save.avatar);
    MB.battle = b;
    MB.view.b = b;
    MB.view.run(() => b.start());
  }

  function recordResult(cfg, win) {
    const st = save.stats;
    const bump = (group, id) => { const r = (group[id] = group[id] || [0, 0]); r[win ? 0 : 1]++; };
    bump(st.leaders, cfg.leader);
    bump(st.foes, cfg.foe);
    bump(st.difficulty, cfg.difficulty);
    st.streak = win ? st.streak + 1 : 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
  }

  function battleOver(win) {
    const cfg = current, b = MB.battle;
    MB.Tutorial.stop();
    let recruited = null, frag = null;
    const pics = [];
    // a Story win completes the rival's quest (js/story.js); the first one also plays its after-scene (js/storymap.js)
    const quest = cfg.story != null ? MB.Story.byStage(cfg.story) : null;
    const done = win && quest ? MB.Story.complete(save, quest.id) : null;
    const firstClear = !!(done && done.first), boss = cfg.story != null && MB.bossOf(cfg.story);
    if (quest) MB.StoryMap.won(quest, done || { first: false, opened: [], act: null });
    // a Story win recruits the rival as a leader and hands out the stage's profile pictures; the first one also gives
    // fragments of the rival's card (never the whole card at once: cards come together from fragments)
    if (win && cfg.story != null) {
      if (!save.leaders.includes(cfg.foe)) { save.leaders.push(cfg.foe); recruited = cfg.foe; }
      pics.push(...MB.Collection.grantStoryAvatars(save));
      if (firstClear) frag = MB.Collection.grantStoryShards(save, cfg.foe);
      if (frag) save.glitter += frag.extra * MB.GLITTER.extra;
    }
    recordResult(cfg, win);
    // packs: Common for a win, Rare on Hard or a first Story win, Epic for a first win over a boss and every 5-win streak
    // (an Arena run pays at its end instead)
    const packs = [], complete = MB.Collection.finished(save); // nothing left to unlock or level up
    if (cfg.arena) MB.Arena.result(save, win);
    else if (win && !complete) {
      packs.push({ tier: firstClear && boss ? 'epic' : firstClear || cfg.difficulty === 'hard' ? 'rare' : 'common',
        note: firstClear ? (boss ? 'Boss defeated' : 'First win') : cfg.difficulty === 'hard' ? 'Hard win' : 'Victory' });
      if (save.stats.streak % 5 === 0) packs.push({ tier: 'epic', note: `${save.stats.streak}-win streak` });
      packs.forEach((p) => save.packs[p.tier]++);
    }
    // Glitter for the win, and the daily missions this battle moved along (the day may have turned mid-battle)
    const glitter = win ? (complete ? MB.GLITTER.complete : MB.GLITTER.win) : 0;
    save.glitter += glitter;
    MB.Missions.daily(save);
    const finished = MB.Missions.progress(save, b ? b.tally : {}, cfg, win);
    // Story stars (and the chapter's Epic pack once every stage has all three)
    const stars = cfg.story != null && b ? MB.Stars.awardStars(save, cfg.story, { won: win, hp: b.me(0).leader.hp, tally: b.tally, difficulty: cfg.difficulty }) : null;
    persist();
    MB.audio.music(win ? MB.MUSIC.win : MB.MUSIC.lose);

    const foe = MB.charById(cfg.foe);
    // what was won, dealt in as tiles (js/result.js)
    const rewards = packs.map((p) => ({ kind: 'pack', ...p }));
    if (done && done.act != null) rewards.push({ kind: 'pack', tier: 'epic', note: `Act ${done.act + 1} complete` });
    if (stars && stars.chapter != null) rewards.push({ kind: 'pack', tier: 'epic', note: `${MB.CHAPTERS[stars.chapter].title}: all stars` });
    if (recruited) rewards.push({ kind: 'leader', id: recruited });
    if (frag) rewards.push({ kind: 'shards', ...frag });
    if (pics.length > 2) rewards.push({ kind: 'avatar', id: pics[0], name: `${pics.length} new pictures`, count: pics.length });
    else pics.forEach((id) => rewards.push({ kind: 'avatar', id, name: avatarById.get(id).name }));
    const newStars = stars ? MB.Stars.bits(stars.fresh) : 0, shine = glitter + (stars ? stars.glitter : 0);
    if (shine) rewards.push({ kind: 'glitter', n: shine, note: newStars ? `Win + ${newStars} star${newStars > 1 ? 's' : ''}` : 'Glitter' });
    const notes = [];
    const sides = done ? done.opened.filter((id) => MB.Story.byId(id).side).length : 0;
    if (sides) notes.push(`📜 ${sides} new side quest${sides > 1 ? 's' : ''} on the map!`);
    if (win && complete && !cfg.arena) notes.push('🎴 Your collection is complete and every character is at max level!');
    finished.forEach((m) => notes.push(`📅 Mission done: <b>${MB.Missions.text(m)}</b> <span class="glit">(+${m.glitter} ✨ to claim)</span>`));
    if (cfg.arena && save.arena) {
      const a = save.arena;
      notes.push(`🏟 Arena run: <b class="arena-wl">${a.wins} win${a.wins === 1 ? '' : 's'} · ${a.losses} loss${a.losses === 1 ? '' : 'es'}</b>`
        + (a.stage === 'done' ? ' — the run is over! Claim your rewards in the Arena.' : ''));
    }
    // the battle in numbers
    const t = b ? b.tally : {}, me = b && b.me(0).leader;
    const stats = [['🔁', t.turns | 0, 'turns'], ['🎴', t.cards | 0, 'cards played'], ['⚔', t.face | 0, 'damage'], ['💀', t.kills | 0, 'KOs']];
    if (win && me) stats.push(['❤', `${Math.max(0, me.hp)}/${me.maxHp}`, 'HP left']);
    const diff = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[cfg.difficulty];
    const kicker = quest ? `Story · ${quest.arc || `Act ${quest.act + 1}`} · ${quest.title}` : cfg.lesson ? 'Story · Practice with Hayley' : cfg.arena ? 'Arena' : `Quick battle${diff ? ` · ${diff}` : ''}`;
    MB.Result.show({
      win, leader: cfg.leader, foe: cfg.foe, kicker, stats, rewards, notes,
      color: quest ? MB.ACTS[quest.act].color : null,
      line: win ? (recruited ? `You beat <b>${foe.name}</b>, who joins your roster as a leader!` : `You beat <b>${foe.name}</b>!`)
        : cfg.lesson ? `<b>${foe.name}</b> wins this one. Don't worry, it was only practice!` : `<b>${foe.name}</b> wins this round. Tweak your deck and try again!`,
      stars: stars && win ? { row: starRow(save.stars[cfg.story] | 0, stars.fresh),
        text: cfg.difficulty === 'easy' ? '<small>Stars need Normal or Hard.</small>' : newStars ? `<span class="glit">⭐ ${newStars} new star${newStars > 1 ? 's' : ''}!</span>` : '' } : null,
      // a card the fragments just finished and new profile pictures get the full reveal once the tiles are in
      onDealt: pics.length || (frag && frag.done) ? () => MB.Cards.reveal([...(frag && frag.done ? [frag] : []), ...pics.map((avatar) => ({ avatar }))]) : null,
    });
    $('#result-packs').classList.toggle('hidden', !packCount());
    $('#result-packs').textContent = `🎁 Open Packs (${packCount()})`;
    $('#result-missions').classList.toggle('hidden', !MB.Missions.claimable(save));
    $('#result-again').onclick = () => { MB.audio.sfx('click'); cfg.lesson ? cfg.lesson() : cfg.arena ? arena() : cfg.story != null ? MB.StoryMap.next() : startBattle({ ...cfg, foe: cfg.foe }); };
    $('#result-again').textContent = cfg.lesson ? '▶ Continue' : cfg.arena ? '🏟 Arena' : cfg.story != null ? (MB.StoryMap.hasAfter() ? '▶ Continue' : '🗺 Story Map') : 'Rematch';
  }

  // ---------------------------------------------------------------- deck & collection
  // the filters stay as they were when you come back; a chip set with nothing on doesn't filter
  const filt = { text: '', type: new Set(), rarity: new Set(), cost: new Set(), show: 'all', novel: '' };
  const COLL_RARITIES = ['common', 'rare', 'epic', 'legendary'];
  function deck() {
    hideBattle();
    show('screen-deck');
    MB.audio.music(MB.MUSIC.deck);
    collTools();
    renderDeck();
    gsap.fromTo([...document.querySelectorAll('#collection .card')].slice(0, 24), { opacity: 0, y: 50, rotationX: -50, scale: 0.85 },
      { opacity: 1, y: 0, rotationX: 0, scale: 1, duration: 0.55, stagger: 0.025, delay: 0.15, ease: 'back.out(1.4)' });
  }
  function lockCard(c, have) {
    c.classList.add('locked');
    c.appendChild(shardOverlay(c.dataset.id, have));
    return c;
  }
  const rarityRank = (id) => MB.RARITY[MB.CARDS[id].rarity].stars;
  // an owned character with enough banked fragments for its next level
  const canLevel = (id) => { const c = MB.Collection.upCost(save, id); return c > 0 && shardsOf(id) >= c; };
  // 0 owned, 1 collecting its fragments, 2 not started
  const ownState = (id) => (isUnlocked(id) ? 0 : shardsOf(id) ? 1 : 2);
  const shake = (n) => gsap.fromTo(n, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.25)' });

  function passes(id) {
    const d = MB.cardDef(id);
    if (filt.text) {
      const hay = [d.name, d.text, d.type === 'unit' && d.attack.name, ...(d.kw || []).map((k) => MB.KEYWORDS[k].name)].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(filt.text.toLowerCase())) return false;
    }
    if (filt.type.size && !filt.type.has(d.type)) return false;
    if (filt.rarity.size && !filt.rarity.has(d.rarity)) return false;
    if (filt.cost.size && !filt.cost.has(Math.min(7, d.cost))) return false;
    if (filt.novel && MB.novelOf(id) !== filt.novel) return false;
    const st = ownState(id);
    return filt.show === 'owned' ? st === 0 : filt.show === 'collecting' ? st === 1 : filt.show === 'locked' ? st > 0
      : filt.show === 'deck' ? save.deck.includes(id) : filt.show === 'levelup' ? canLevel(id) : true;
  }

  function collTools() {
    const bar = $('#coll-tools');
    bar.innerHTML = '';
    const search = el('input');
    Object.assign(search, { id: 'coll-search', type: 'search', placeholder: '🔍 Name, text, keyword…', value: filt.text, spellcheck: false });
    search.oninput = () => { filt.text = search.value.trim(); renderCollection(); };
    // chips toggle on and off; several can be on at once
    const chips = (key, items) => {
      const seg = el('div', 'chips');
      items.forEach(([val, html, title, color]) => {
        const b = el('button', filt[key].has(val) ? 'on' : '', html);
        b.title = title;
        if (color) b.style.setProperty('--cc', color);
        b.onclick = () => {
          MB.audio.sfx('click');
          if (!filt[key].delete(val)) filt[key].add(val);
          b.classList.toggle('on', filt[key].has(val));
          renderCollection();
        };
        seg.appendChild(b);
      });
      return seg;
    };
    const sel = (key, options) => {
      const s = el('select');
      options.forEach(([v, t]) => s.appendChild(new Option(t, v, false, filt[key] === v)));
      s.onchange = () => { MB.audio.sfx('click'); filt[key] = s.value; renderCollection(); };
      return s;
    };
    const reset = el('button', 'chip-reset', '✕');
    reset.title = 'Clear the filters';
    reset.onclick = () => {
      MB.audio.sfx('click');
      Object.assign(filt, { text: '', show: 'all', novel: '' });
      ['type', 'rarity', 'cost'].forEach((k) => filt[k].clear());
      collTools(); renderCollection();
    };
    bar.append(search,
      chips('type', [['unit', '👤', 'Characters'], ['spell', '🎒', 'Items']]),
      chips('rarity', COLL_RARITIES.map((r) => [r, '<i class="gem"></i>', MB.RARITY[r].name, MB.RARITY[r].color])),
      chips('cost', [0, 1, 2, 3, 4, 5, 6, 7].map((n) => [n, n === 7 ? '7+' : n, `Costs ${n === 7 ? '7 or more' : n} gold`])),
      sel('show', [['all', 'All cards'], ['owned', '✔ Owned'], ['collecting', '🧩 Collecting'], ['locked', '🔒 Not owned'], ['levelup', '⬆ Can level up'], ['deck', '🂠 In this deck']]),
      sel('novel', [['', 'All novels'], ...MB.manifest.novels.map((n) => [n, n])]),
      reset);
  }

  function renderDeckTabs() {
    const tabs = $('#deck-tabs');
    tabs.innerHTML = '';
    save.decks.forEach((d, i) => {
      const on = i === save.activeDeck, n = on ? save.deck.length : d.cards.length;
      const t = el('div', 'deck-tab' + (on ? ' on' : '') + (n !== DECK_SIZE ? ' bad' : ''), `<span class="dt-name"></span><small>${n}/${DECK_SIZE}</small>`);
      t.querySelector('.dt-name').textContent = d.name;
      if (!on) {
        t.title = 'Switch to this deck';
        t.onclick = () => { MB.audio.sfx('click'); switchDeck(i); renderDeck(); };
      }
      tabs.appendChild(t);
    });
  }
  function renameDeck() {
    const d = save.decks[save.activeDeck], name = prompt('Deck name:', d.name);
    if (name == null || !name.trim()) return;
    d.name = name.trim().slice(0, 20); persist(); renderDeckSide();
  }

  function renderDeck(added) {
    renderCollection();
    renderDeckSide(added);
  }

  function renderCollHead() {
    const cards = deckCards();
    const meters = COLL_RARITIES.map((r) => {
      const all = cards.filter((id) => MB.CARDS[id].rarity === r), own = all.filter(isUnlocked).length;
      return `<div class="cmeter${own === all.length ? ' full' : ''}" style="--rc:${MB.RARITY[r].color}" title="${MB.RARITY[r].name}: ${own} of ${all.length} owned">
        <i class="gem"></i><span>${own}/${all.length}</span><b><i style="width:${(own / all.length) * 100}%"></i></b></div>`;
    }).join('');
    const collecting = Object.keys(save.shards).filter((id) => !isUnlocked(id)).length, ready = deckCards().filter(canLevel).length;
    $('#coll-progress').innerHTML = `<div class="ctotal">🎴 <b>${cards.filter(isUnlocked).length}</b>/${cards.length}</div>${meters}
      <div class="ccollect" title="Cards you have some fragments of">🧩 <b>${collecting}</b> collecting</div>
      ${ready ? `<div class="ccollect lvup" title="Characters with the fragments for their next level: right-click one to level it up">⬆ <b>${ready}</b> ready</div>` : ''}
      <div class="ccollect glit" title="Glitter: right-click a card to craft its fragments or make it Shiny">✨ <b>${save.glitter}</b></div>`;
  }

  function renderCollection() {
    const col = $('#collection');
    col.innerHTML = '';
    renderCollHead();
    const ids = deckCards().filter(passes).sort((a, b) => ownState(a) - ownState(b)
      || (ownState(a) === 1 && shardsOf(b) / MB.Collection.need(b) - shardsOf(a) / MB.Collection.need(a))
      || MB.CARDS[a].cost - MB.CARDS[b].cost || rarityRank(a) - rarityRank(b));
    if (!ids.length) col.appendChild(el('div', 'coll-empty', 'No cards match these filters.'));
    ids.forEach((id) => {
      const c = cardEl(id);
      c.classList.add('collect');
      col.appendChild(c);
      if (!isUnlocked(id)) {
        lockCard(c);
        c.title = `Collect ${MB.Collection.need(id)} fragments from 🎁 card packs to unlock it`;
        c.addEventListener('click', () => { MB.audio.sfx('error'); shake(c); });
        return;
      }
      // fragments banked toward its next level; ⬆ once there are enough (right-click to level up)
      const cost = MB.Collection.upCost(save, id), have = shardsOf(id);
      if (cost && have) c.appendChild(el('div', 'lv-bank' + (have >= cost ? ' ready' : ''), have >= cost ? '⬆ Level up!' : `🧩 ${have}/${cost}`));
      if (cost) c.title = have >= cost ? 'Right-click to level it up' : `${cost - have} more fragment${cost - have > 1 ? 's' : ''} to reach Lv ${MB.Collection.level(save, id) + 1} (right-click for more)`;
      const n = save.deck.filter((d) => d === id).length;
      c.appendChild(el('div', 'copies' + (n ? ' in' : ''), `${n}/${maxCopies(id)}`));
      if (n >= maxCopies(id)) c.classList.add('maxed');
      c.addEventListener('click', () => {
        if (save.deck.length >= DECK_SIZE || n >= maxCopies(id)) { MB.audio.sfx('error'); shake(c); return; }
        save.deck.push(id); persist(); MB.audio.sfx('play');
        MB.Cards.flyToDeck(c, $('#deck-list'));
        renderDeck(id);
      });
    });
  }

  function renderDeckSide(added) {
    const list = $('#deck-list');
    list.innerHTML = '';
    renderDeckTabs();
    $('#deck-name').textContent = save.decks[save.activeDeck].name;
    const counts = {};
    save.deck.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
    Object.keys(counts).sort((a, b) => MB.CARDS[a].cost - MB.CARDS[b].cost).forEach((id) => {
      const d = MB.cardDef(id);
      const row = el('div', `deck-row r-${d.rarity}`, `<span class="dc">${d.cost}</span><span class="dn">${d.name}</span><span class="dx">×${counts[id]}</span>`);
      row.style.setProperty('--c', d.type === 'spell' ? d.color : d.attack.color);
      row.style.setProperty('--rc', MB.RARITY[d.rarity].color);
      row.style.backgroundImage = d.type === 'spell' ? '' : `linear-gradient(90deg, rgba(20,16,40,.95) 45%, rgba(20,16,40,.3)), url("${MB.spriteUrl(id, 'idle')}")`;
      row.title = 'Click to take one out';
      row.addEventListener('click', () => {
        MB.audio.sfx('click');
        gsap.to(row, { x: -60, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => { save.deck.splice(save.deck.indexOf(id), 1); persist(); renderDeck(); } });
      });
      list.appendChild(row);
      if (id === added) gsap.fromTo(row, { x: 50, filter: 'brightness(2.2)' }, { x: 0, filter: 'brightness(1)', duration: 0.6, delay: 0.35, ease: 'back.out(2)', clearProps: 'filter' });
    });
    if (!save.deck.length) list.appendChild(el('div', 'deck-empty', 'Empty deck.<br>Click owned cards on the left to add them.'));
    const n = save.deck.length, count = $('#deck-count');
    count.innerHTML = `<b>${n}</b>/${DECK_SIZE}`;
    count.classList.toggle('bad', n !== DECK_SIZE);
    count.style.setProperty('--p', (n / DECK_SIZE) * 100 + '%');
    const units = save.deck.filter((id) => MB.cardDef(id).type === 'unit').length;
    const avg = n ? (save.deck.reduce((t, id) => t + MB.CARDS[id].cost, 0) / n).toFixed(1) : '–';
    const bonds = MB.BONDS.filter((bd) => bd.pair.every((id) => save.deck.includes(id))).length;
    $('#deck-meta').innerHTML = `<span title="Characters">👤 <b>${units}</b></span><span title="Items">🎒 <b>${n - units}</b></span>
      <span title="Average cost">🪙 <b>${avg}</b> avg</span><span title="Relationships that can form">💞 <b>${bonds}</b></span>`;
    const curve = new Array(8).fill(0);
    save.deck.forEach((id) => curve[Math.min(7, MB.CARDS[id].cost)]++);
    const mx = Math.max(1, ...curve);
    $('#deck-curve').innerHTML = curve.map((k, i) => `<div class="bar"><em>${k || ''}</em><i style="height:${(k / mx) * 100}%"></i><span>${i === 7 ? '7+' : i}</span></div>`).join('');
  }

  // ---------------------------------------------------------------- stats
  const pct = ([w, l]) => (w + l ? Math.round((w / (w + l)) * 100) : 0);
  // the Stats tab of the profile
  function renderStats() {
    const st = save.stats, body = $('#stats-body');
    const total = Object.values(st.difficulty).reduce((t, [w, l]) => [t[0] + w, t[1] + l], [0, 0]);
    if (!(total[0] + total[1])) { body.innerHTML = '<p class="stats-empty">No battles yet. Go win some!</p>'; return; }
    const tile = (big, label) => `<div class="st-tile"><b>${big}</b><span>${label}</span></div>`;
    const table = (title, group) => {
      const rows = Object.entries(group).filter(([id]) => MB.charById(id))
        .sort((a, b) => b[1][0] + b[1][1] - (a[1][0] + a[1][1]) || pct(b[1]) - pct(a[1]))
        .map(([id, r]) => `<div class="st-row"><img src="${MB.spriteUrl(id, 'idle')}"><span class="st-name">${MB.charById(id).name}</span>
          <span class="st-wl">${r[0]}W · ${r[1]}L</span><span class="st-bar"><i style="width:${pct(r)}%"></i></span><span class="st-pct">${pct(r)}%</span></div>`);
      return `<div class="st-col"><h2>${title}</h2>${rows.join('')}</div>`;
    };
    body.innerHTML = `<div class="st-tiles">
        ${tile(total[0] + total[1], 'Battles')}${tile(total[0], 'Wins')}${tile(pct(total) + '%', 'Win rate')}
        ${tile(st.streak, 'Current streak')}${tile(st.bestStreak, 'Best streak')}
      </div>
      <div class="st-diff">${Object.entries(DIFFICULTY).map(([k, d]) => { const r = st.difficulty[k] || [0, 0]; return `<span><b>${d.name}</b> ${r[0]}W · ${r[1]}L</span>`; }).join('')}</div>
      <div class="st-cols">${table('As leader', st.leaders)}${table('Against', st.foes)}</div>`;
  }

  // ---------------------------------------------------------------- attack gallery
  let gal = null;
  function gallery() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    MB.audio.music(MB.MUSIC.gallery);
    setBg(MB.asset(bgByName('Gym Class').src));
    $('#arena').classList.add('gallery-mode');
    $('#gallery-panel').classList.remove('hidden');
    const list = $('#gallery-list');
    list.innerHTML = '';
    const b = new MB.Battle({ view: MB.view, playerLeader: 'hayley-kate', enemyLeader: 'james-lone', playerDeck: [], enemyDeck: [] });
    MB.battle = b;
    MB.view.init(b);
    $('#battle-hud').classList.add('hidden');
    gal = { b, unit: null, dummies: [] };
    // bottomless gold, and outfits can change every click, so any upgrade (Amy Lyn's wardrobe) can be tried
    Object.defineProperty(b.me(0), 'gold', { get: () => 99, set() {} });
    const upgrade = b.upgrade.bind(b);
    b.upgrade = async (u) => {
      if (gal.busy) return false;
      gal.busy = true;
      try {
        const ok = await upgrade(u);
        if (ok) { u.upgradedTurn = null; await galDummies(); MB.view.refresh(); }
        return ok;
      } finally { gal.busy = false; }
    };
    galDummies();
    list.appendChild(el('div', 'gal-head', '💞 RELATIONSHIPS'));
    MB.BONDS.forEach((bond) => {
      const row = el('div', 'gal-row bond', `${bond.pair.map((id, i) => `<img src="${MB.spriteUrl(id, 'idle', bond.costumes[i])}">`).join('')}
        <div><b>${MB.BOND_TIERS[bond.tier].hearts} ${bond.name}</b><span>✦ ${bond.attack.name}</span></div>`);
      row.style.setProperty('--c', bond.attack.color);
      row.addEventListener('click', () => galBond(bond, row));
      list.appendChild(row);
    });
    list.appendChild(el('div', 'gal-head', '✦ CHARACTERS'));
    deckCards().filter((id) => MB.CARDS[id].type !== 'spell').forEach((id) => {
      const d = MB.cardDef(id);
      const row = el('div', 'gal-row', `<img src="${MB.spriteUrl(id, 'idle')}"><div><b>${d.name}</b><span>✦ ${d.attack.name}</span></div>`);
      row.style.setProperty('--c', d.attack.color);
      row.addEventListener('click', () => galPick(id, row));
      list.appendChild(row);
    });
    // every animation, whoever uses it: a character (or, for duo styles, a pair) performs it on demand
    list.appendChild(el('div', 'gal-head', '🎬 ALL ATTACK STYLES'));
    const pair = MB.BONDS.find((bd) => bd.tier === 1) || MB.BONDS[0];
    Object.keys(MB.FX.styles).sort().forEach((style) => {
      const duo = MB.FX.duoStyles.includes(style);
      const row = el('div', 'gal-row style', `<i>${duo ? '💞' : '✦'}</i><div><b>${style}</b><span>${duo ? 'duo style' : usersOf(style)}</span></div>`);
      row.addEventListener('click', () => galStyle(style, duo ? pair : null, row));
      list.appendChild(row);
    });
    // skies: the backdrop any attack can bring (attack.sky); picking one adds it to the previews
    list.appendChild(el('div', 'gal-head', '🌌 SKIES'));
    ['', ...MB.FX.skies].forEach((name) => {
      const row = el('div', 'gal-row sky', `<i>${name ? '🌌' : '○'}</i><div><b>${name || 'no extra sky'}</b><span>${name ? `sky: '${name}'` : "the attack's own"}</span></div>`);
      row.addEventListener('click', () => {
        gal.sky = name || null;
        list.querySelectorAll('.gal-row.sky').forEach((r) => r.classList.toggle('on', r === row));
        if (gal.sky) gsap.delayedCall(1.2, MB.FX.sky(gal.sky)); // a quick peek
      });
      if (!name) row.classList.add('on');
      list.appendChild(row);
    });
    const firstChar = list.querySelector('.gal-row:not(.bond)');
    galPick(deckCards()[0], firstChar);
  }
  // who has this style, for the gallery row
  function usersOf(style) {
    const who = Object.entries(MB.CARDS).filter(([, c]) => c.attack && c.attack.style === style).map(([id]) => MB.cardDef(id).name);
    return who.length ? who.slice(0, 2).join(', ') + (who.length > 2 ? ` +${who.length - 2}` : '') : 'not used yet';
  }
  // preview a style on the last character picked (or a fused pair), keeping its attack name and color
  async function galStyle(style, bond, row) {
    if (gal.busy) return;
    if (bond) await galBond(bond, row); else await galPick(gal.lastChar || deckCards()[0], row);
    if (!gal.unit) return;
    const card = gal.unit.card;
    gal.unit.card = { ...card, attack: { name: card.attack.name, color: card.attack.color, style } };
    $('#gal-info').innerHTML = `<b>${gal.unit.name}</b> — style <b>${style}</b><br><small>attack: { style: '${style}' } · add emoji, cry, finish, sky, aura…</small>`;
  }
  // keep two training dummies on the enemy side: they can't die, and one that leaves the board anyway is replaced
  function galDummies() {
    const b = gal.b;
    return Promise.all([1, 2].map(async (slot, i) => {
      const d = gal.dummies[i];
      if (d && d.hp > 0 && b.find(d.uid) === d) return;
      if (d) gal.dummies[i] = null;
      const nd = await b.summon(1, MB.cardDef('dummy'), slot);
      if (nd) { nd.undying = true; gal.dummies[i] = nd; }
    }));
  }
  // empty the player's side of the gallery board
  async function galClear() {
    const b = gal.b;
    await Promise.all(b.units(0).map((u) => {
      const old = MB.view.ents.get(u.uid);
      b.me(0).board[u.slot] = null;
      MB.view.ents.delete(u.uid);
      return old ? gsap.to(old.el, { opacity: 0, duration: 0.15, onComplete: () => old.el.remove() }) : null;
    }));
    gal.unit = null;
  }
  // summon both partners and let them fuse
  async function galBond(bond, row) {
    if (gal.busy) return;
    document.querySelectorAll('.gal-row').forEach((r) => r.classList.toggle('on', r === row));
    const b = gal.b;
    gal.busy = true;
    await galClear();
    b.active = 0;
    b.me(0).fatigue = 0; b.me(0).leader.hp = b.me(0).leader.maxHp; // "draw cards" fusions don't wear the hidden leader down
    await b.summon(0, MB.cardDef(bond.pair[0]), 0);
    await b.summon(0, MB.cardDef(bond.pair[1]), 2);
    await b.checkBonds(0);
    gal.unit = b.units(0).find((u) => u.card.fused) || b.units(0)[0];
    $('#gal-info').innerHTML = `<b>${MB.BOND_TIERS[bond.tier].hearts} ${bond.name}</b> — ✦ ${bond.attack.name}<br>
      <small>${bond.relation} · ${MB.BOND_TIERS[bond.tier].name}. ${bond.text || 'Summed stats, new keywords and a special attack.'}</small>`;
    gal.busy = false;
  }
  async function galPick(id, row) {
    if (gal.busy) return;
    document.querySelectorAll('.gal-row').forEach((r) => r.classList.toggle('on', r === row));
    const b = gal.b;
    gal.busy = true;
    await galClear();
    gal.unit = await b.summon(0, MB.cardDef(id), 1);
    if (!row || !row.classList.contains('style')) gal.lastChar = id;
    $('#gal-info').innerHTML = `<b>${gal.unit.name}</b> — ✦ ${gal.unit.card.attack.name}<br><small>${MB.charById(id).short}</small>`;
    gal.busy = false;
  }
  async function galAttack() {
    if (!gal || gal.busy || !gal.unit) return;
    gal.busy = true;
    const b = gal.b;
    b.active = 0;
    gal.unit.attacksLeft = 1; gal.unit.frozen = false; gal.unit.hp = gal.unit.maxHp;
    await galDummies();
    const target = MB.pick(gal.dummies.filter(Boolean));
    if (!target) { gal.busy = false; return; }
    target.hp = target.maxHp; target.frozen = false; target.shield = false; target.burning = false;
    const unit = gal.unit, card = unit.card;
    if (gal.sky) unit.card = { ...card, attack: { ...card.attack, sky: gal.sky } };
    try { await b.attack(unit, target); } finally { unit.card = card; await galDummies(); gal.busy = false; }
  }

  // ---------------------------------------------------------------- wardrobe
  const costumesOf = (id) => {
    const c = MB.charById(id), hidden = MB.HIDDEN_COSTUMES[id] || [];
    return c ? c.costumes.filter((o) => !hidden.includes(o.id)) : [];
  };
  function setCostume(id, costume) {
    if (costume) save.costumes[id] = costume; else delete save.costumes[id];
    persist();
    if (MB.view) MB.view.ents.forEach((v) => MB.view.setSprite(v, v.emotion));
    if ($('#screen-deck').classList.contains('active')) renderDeck();
  }

  // ---------------------------------------------------------------- packs screen
  function packs() {
    hideBattle();
    show('screen-packs');
    MB.audio.music(MB.MUSIC.deck);
    renderPacks();
    gsap.fromTo('.pack-tile', { opacity: 0, y: 80, rotation: (i) => (i - 1) * 8 }, { opacity: 1, y: 0, rotation: 0, duration: 0.7, stagger: 0.1, delay: 0.1, ease: 'back.out(1.6)' });
  }
  function slotsText(slots) {
    const n = (k) => slots.filter((s) => s === k).length;
    const line = (k, label) => `${n(k)}× ${label} <span class="frag">${MB.SHARD_DROP[k]} 🧩</span>`;
    const lines = [];
    if (n('epic')) lines.push(line('epic', `<b style="color:${MB.RARITY.epic.color}">Epic+</b> card`));
    if (n('rare')) lines.push(line('rare', `<b style="color:${MB.RARITY.rare.color}">Rare+</b> card`));
    if (n('card')) lines.push(line('card', 'any card'));
    return lines.join('<br>');
  }
  let opening = false;
  function renderPacks() {
    const list = $('#pack-list');
    list.innerHTML = '';
    Object.entries(MB.PACKS).forEach(([tier, p]) => {
      const n = save.packs[tier];
      const t = el('div', `pack-tile t-${tier}${n ? '' : ' empty'}`, `
        <div class="pack-art"><img src="${MB.packArt(tier)}" alt=""></div>
        <div class="pack-count">×${n}</div>
        <div class="pack-name">${p.name}</div>
        <div class="pack-slots">${slotsText(p.slots)}</div>`);
      t.style.setProperty('--rc', p.color);
      const b = el('button', 'btn primary', n ? 'Open' : 'None yet');
      b.disabled = !n;
      b.onclick = async () => {
        if (opening || !save.packs[tier]) return;
        opening = true;
        MB.audio.sfx('click');
        // the haul screen offers the next pack of this tier straight away
        for (let again = true; again && save.packs[tier] > 0;) {
          const got = openPack(tier);
          t.querySelector('.pack-count').textContent = '×' + save.packs[tier];
          again = await MB.Cards.openPack(tier, got, t.querySelector('.pack-art'), save.packs[tier]);
        }
        opening = false;
        renderPacks();
      };
      t.appendChild(b);
      list.appendChild(t);
    });
    const cards = deckCards();
    $('#pack-progress').innerHTML = `🎴 Cards <b>${cards.filter(isUnlocked).length}/${cards.length}</b> · 🧩 Collecting <b>${cards.filter((id) => !isUnlocked(id) && shardsOf(id)).length}</b>`
      + ` · ★ Max level <b>${cards.filter((id) => MB.Collection.maxed(save, id)).length}/${cards.filter(MB.Collection.levels).length}</b>`
      + (allCollected() ? ' · <b class="done">Collection complete!</b>' : '');
    refreshProfileBits();
  }

  // ---------------------------------------------------------------- arena
  function arena() {
    hideBattle();
    show('screen-arena');
    MB.audio.music(MB.MUSIC.deck);
    renderArena();
  }
  // the drafted deck as a cost curve and a list (cost · name · ×copies)
  function arenaDeckHtml(deck) {
    const counts = {};
    deck.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    const ids = Object.keys(counts).sort((a, b) => MB.CARDS[a].cost - MB.CARDS[b].cost || MB.cardDef(a).name.localeCompare(MB.cardDef(b).name));
    const curve = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => deck.filter((id) => Math.min(7, MB.CARDS[id].cost) === c).length);
    const top = Math.max(1, ...curve);
    return `<div class="ad-curve">${curve.map((n, c) => `<div><i style="height:${(n / top) * 100}%"></i><span>${c === 7 ? '7+' : c}</span></div>`).join('')}</div>
      <div class="ad-list scroll-y">${ids.map((id) => { const d = MB.cardDef(id);
        return `<div class="ad-row" style="--rc:${MB.RARITY[d.rarity].color}"><b>${d.cost}</b><span>${d.name}</span>${counts[id] > 1 ? `<i>×${counts[id]}</i>` : ''}</div>`; }).join('')}</div>`;
  }
  const leaderHtml = (id) => {
    const pw = MB.POWERS[id];
    return `<img src="${MB.spriteUrl(id, 'idle')}"><div class="lt-name">${MB.charById(id).name}</div><div class="lt-power"><b>${pw.name}</b> (${pw.cost})<br>${pw.text}</div>`;
  };
  function renderArena() {
    const A = MB.ARENA, a = save.arena, body = $('#arena-body');
    body.innerHTML = '';
    body.className = a ? 'stage-' + a.stage : 'stage-none';
    if (!a) {
      const tiers = [0, 3, 5, 7].map((w) => { const r = A.rewards(w);
        return `<div class="ar-tier"><b>${w} win${w === 1 ? '' : 's'}</b><span class="glit">✨ ${r.glitter}</span>${r.packs.map((t) => `<span style="color:${MB.PACKS[t].color}">🎁 ${MB.PACKS[t].name}</span>`).join('')}</div>`; }).join('');
      body.innerHTML = `<div class="ar-intro">
        <p>Pick a leader, then <b>draft a deck</b> one card at a time from <b>every card in the game</b>, owned or not. Then battle until
          <b>${A.maxWins} wins</b> or <b>${A.maxLosses} losses</b>. Every win makes the next rival tougher, and the rewards bigger.</p>
        <div class="ar-tiers">${tiers}</div>
        <p class="ar-best">${save.arenaRuns ? `🏆 Best run: <b>${save.arenaBest} wins</b> · ${save.arenaRuns} run${save.arenaRuns > 1 ? 's' : ''} played` : 'No runs yet.'}</p>
      </div>`;
      const go = body.appendChild(el('button', 'btn primary ar-go', '🏟 Start a run'));
      go.onclick = () => { MB.audio.sfx('click'); MB.Arena.start(save); persist(); renderArena(); refreshProfileBits(); };
      return;
    }
    if (a.stage === 'leader') {
      body.appendChild(el('h2', 'ar-step', 'Choose your leader'));
      const row = body.appendChild(el('div', 'ar-leaders'));
      a.leaders.forEach((id) => {
        const t = row.appendChild(el('div', 'leader-tile', leaderHtml(id)));
        t.addEventListener('pointerenter', () => { MB.audio.sfx('hover'); t.querySelector('img').src = MB.spriteUrl(id, 'taunt'); });
        t.addEventListener('pointerleave', () => { t.querySelector('img').src = MB.spriteUrl(id, 'idle'); });
        t.onclick = () => { MB.audio.sfx('click'); MB.Arena.chooseLeader(save, id); persist(); renderArena(); };
      });
      gsap.from(row.children, { y: 60, opacity: 0, rotationY: -40, duration: 0.5, stagger: 0.1, ease: 'back.out(1.6)' });
      return;
    }
    const side = el('div', 'ar-side', `<div class="ar-leader">${leaderHtml(a.leader)}</div>
      <div class="ad-head">🂠 Deck <b>${a.deck.length}/${A.picks}</b></div>${arenaDeckHtml(a.deck)}`);
    if (a.stage === 'draft') {
      const main = el('div', 'ar-main');
      main.appendChild(el('h2', 'ar-step', `Pick a card <small>${a.deck.length + 1} / ${A.picks}</small>`));
      const row = main.appendChild(el('div', 'ar-offer'));
      a.offer.forEach((id) => {
        const box = row.appendChild(el('div', 'ar-card'));
        const c = box.appendChild(cardEl(id, true, { base: true }));
        const home = MB.novelOf(id) === MB.novelOf(a.leader);
        if (home) box.appendChild(el('div', 'ar-tag', 'Same novel as your leader'));
        c.onclick = () => {
          if (row.classList.contains('picked')) return;
          row.classList.add('picked');
          MB.audio.sfx('cardflip');
          MB.Arena.pick(save, id);
          persist();
          gsap.to([...row.children].filter((b) => b !== box), { opacity: 0, y: 40, duration: 0.25 });
          gsap.to(box, { y: -30, scale: 1.08, duration: 0.25, ease: 'power2.out', onComplete: renderArena });
        };
      });
      main.appendChild(el('p', 'pack-tip', 'Right-click a card for a close-up. Relationships and item combos work here too: draft both halves!'));
      body.append(main, side);
      gsap.from(row.children, { y: 80, opacity: 0, rotationX: -40, duration: 0.45, stagger: 0.08, ease: 'back.out(1.5)' });
      return;
    }
    // the run: wins and losses so far, then the next rival (or the rewards, once it's over)
    const main = el('div', 'ar-main');
    const pips = (n, max, cls, sym) => Array.from({ length: max }, (_, k) => `<i class="${k < n ? cls : ''}">${sym}</i>`).join('');
    main.appendChild(el('div', 'ar-record', `<div class="ar-wins">${pips(a.wins, A.maxWins, 'on', '★')}</div><div class="ar-losses">${pips(a.losses, A.maxLosses, 'on', '✖')}</div>`));
    if (a.stage === 'run') {
      const n = a.next, ch = MB.charById(n.foe);
      main.appendChild(el('div', 'ar-next', `<small>Next rival · battle ${a.wins + a.losses + 1}</small>
        <img src="${MB.bigSpriteUrl(n.foe, 'taunt')}"><b>${ch.name}</b><span>❤ ${n.hp} HP · ${ch.novel.replace(/\s*\(.*\)/, '').trim()}</span>`));
      const btns = main.appendChild(el('div', 'row'));
      const fight = btns.appendChild(el('button', 'btn primary', '⚔ Fight'));
      fight.onclick = () => { MB.audio.sfx('click'); startBattle({ leader: a.leader, foe: n.foe, foeHp: n.hp, ai: n.ai, bgSrc: randomBg().src, music: battleMusic(n.foe), arena: true, deck: a.deck }); };
      const retire = btns.appendChild(el('button', 'btn', 'Retire'));
      const r = A.rewards(a.wins);
      retire.onclick = () => { if (confirm(`End this run now and take the rewards for ${a.wins} win${a.wins === 1 ? '' : 's'} (✨ ${r.glitter}${r.packs.length ? ' and ' + r.packs.length + ' pack' + (r.packs.length > 1 ? 's' : '') : ''})?`)) arenaClaim(); };
    } else {
      const r = A.rewards(a.wins);
      main.appendChild(el('div', 'ar-done', `<b>${a.wins >= A.maxWins ? '🏆 A perfect run!' : 'The run is over!'}</b>
        <span>${a.wins} win${a.wins === 1 ? '' : 's'} · ${a.losses} loss${a.losses === 1 ? '' : 'es'}</span>
        <div class="ar-tier"><span class="glit">✨ ${r.glitter}</span>${r.packs.map((t) => `<span style="color:${MB.PACKS[t].color}">🎁 ${MB.PACKS[t].name}</span>`).join('')}</div>`));
      const claim = main.appendChild(el('button', 'btn primary', '🎁 Claim rewards'));
      claim.onclick = arenaClaim;
    }
    body.append(main, side);
  }
  function arenaClaim() {
    const r = MB.Arena.finish(save);
    if (!r) return;
    persist();
    MB.audio.sfx('fanfare'); MB.audio.sfx('coin');
    refreshProfileBits();
    renderArena();
    const note = el('div', 'glit-pop', `+${r.glitter} ✨${r.packs.length ? ` · 🎁 ×${r.packs.length}` : ''}`);
    $('#ui-root').appendChild(note);
    gsap.fromTo(note, { x: 800, y: 420, xPercent: -50, scale: 0.4, opacity: 0 }, { y: 360, scale: 1.4, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
    gsap.to(note, { opacity: 0, y: 300, delay: 1.6, duration: 0.5, onComplete: () => note.remove() });
  }

  // ---------------------------------------------------------------- daily missions & Glitter
  const glitterHtml = () => `<span class="glit">✨ <b>${save.glitter}</b> Glitter</span>`;
  function missions() {
    hideBattle();
    if (MB.Missions.daily(save)) persist();
    show('screen-missions');
    renderMissions();
  }
  function renderMissions() {
    const M = MB.Missions, ms = save.missions, list = $('#mission-list');
    $('#glitter-bank').innerHTML = glitterHtml();
    list.innerHTML = '';
    ms.list.forEach((m, i) => {
      const done = M.done(m), row = el('div', 'mission' + (m.claimed ? ' claimed' : done ? ' done' : ''), `
        <div class="m-text">${M.text(m)}</div>
        <div class="m-bar"><i style="width:${(m.have / m.n) * 100}%"></i><span>${m.have}/${m.n}</span></div>
        <div class="m-reward">✨ ${m.glitter}</div>`);
      const act = el('div', 'm-act');
      if (m.claimed) act.innerHTML = '<span class="m-ok">✔ Claimed</span>';
      else if (done) {
        const b = act.appendChild(el('button', 'btn primary', 'Claim'));
        b.onclick = () => {
          const g = M.claim(save, i);
          if (!g) return;
          persist();
          MB.audio.sfx('coin'); MB.audio.sfx('sparkle');
          glitterBurst(b, g);
          renderMissions();
          refreshProfileBits();
        };
      } else if (ms.reroll > 0) {
        const b = act.appendChild(el('button', 'btn', '↻'));
        b.title = 'Swap for another mission (once a day)';
        b.onclick = () => { if (M.reroll(save, i)) { persist(); MB.audio.sfx('flip'); renderMissions(); } };
      }
      row.appendChild(act);
      list.appendChild(row);
    });
    if (!ms.list.length) list.innerHTML = '<p class="stats-empty">No missions today.</p>';
    const next = new Date(); next.setHours(24, 0, 0, 0);
    const h = Math.floor((next - Date.now()) / 3600000), min = Math.floor(((next - Date.now()) % 3600000) / 60000);
    $('#mission-foot').innerHTML = `New missions in <b>${h}h ${min}m</b>${ms.reroll > 0 ? ' · ↻ swaps one mission (once a day)' : ''}<br>
      ✨ <b>Glitter</b> also comes from every win and from pack fragments no card could use. Spend it in the <b>🛒 Shop</b> on fragments
      and packs, or right-click a card in <b>Deck &amp; Collection</b> to craft its fragments or make it <b>Shiny</b>.`;
  }
  // sparkles fly from a button up to the Glitter counter
  function glitterBurst(from, amount) {
    const bank = $('#glitter-bank'), root = $('#ui-root').getBoundingClientRect(), s = root.width / 1600;
    const a = from.getBoundingClientRect(), b = bank.getBoundingClientRect();
    const A = { x: (a.left + a.width / 2 - root.left) / s, y: (a.top - root.top) / s }, B = { x: (b.left + b.width / 2 - root.left) / s, y: (b.top + b.height / 2 - root.top) / s };
    for (let i = 0; i < 14; i++) {
      const p = el('div', 'glit-fly', '✨');
      $('#ui-root').appendChild(p);
      gsap.fromTo(p, { x: A.x, y: A.y, scale: 0.6, opacity: 1 }, { x: B.x + (Math.random() - 0.5) * 40, y: B.y, scale: 1.2, duration: 0.6 + Math.random() * 0.3,
        delay: i * 0.03, ease: 'power2.in', onComplete: () => p.remove() });
    }
    const pop = el('div', 'glit-pop', `+${amount} ✨`);
    $('#ui-root').appendChild(pop);
    gsap.fromTo(pop, { x: A.x, y: A.y, xPercent: -50, opacity: 0, scale: 0.5 }, { y: A.y - 60, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' });
    gsap.to(pop, { opacity: 0, y: A.y - 100, delay: 1, duration: 0.4, onComplete: () => pop.remove() });
    gsap.fromTo(bank, { scale: 1.25 }, { scale: 1, duration: 0.5, delay: 0.6, ease: 'elastic.out(1,0.4)' });
  }

  // crafting and Shiny, from a card's close-up (cards.js); they return what happened, or null when it can't
  function craft(id, n) {
    const r = MB.Missions.craft(save, id, n);
    if (r) { persist(); refreshProfileBits(); }
    return r;
  }
  function makeShiny(id) {
    const ok = MB.Missions.makeShiny(save, id);
    if (ok) persist();
    return ok;
  }
  // spends banked fragments on a character's next level; returns { from, to } or null
  function levelUp(id) {
    const r = MB.Collection.levelUp(save, id);
    if (r) { persist(); refreshProfileBits(); }
    return r;
  }

  // ---------------------------------------------------------------- shop
  // Glitter buys fragments: today's deals (cheaper, once each), any card at the crafting price, or packs.
  // A card or deal left-clicked opens its close-up, where it can be leveled up too.
  let shopTab = 'deals';
  const shopFilt = { text: '', show: 'want' };
  function shop(tab = shopTab) {
    hideBattle();
    if (MB.Shop.daily(save)) persist();
    show('screen-shop');
    MB.audio.music(MB.MUSIC.deck);
    shopTab = tab;
    renderShop();
  }
  // "+3 🧩" / "-60 ✨" floating up from a button
  function shopPop(from, html) {
    const root = $('#ui-root').getBoundingClientRect(), s = root.width / 1600, a = from.getBoundingClientRect();
    const x = (a.left + a.width / 2 - root.left) / s, y = (a.top - root.top) / s;
    const pop = el('div', 'glit-pop', html);
    $('#ui-root').appendChild(pop);
    gsap.fromTo(pop, { x, y, xPercent: -50, opacity: 0, scale: 0.5 }, { y: y - 60, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' });
    gsap.to(pop, { opacity: 0, y: y - 100, delay: 0.9, duration: 0.4, onComplete: () => pop.remove() });
  }
  // what a purchase of fragments did: a card they finished gets the full reveal
  function bought(btn, got, cost) {
    persist();
    refreshProfileBits();
    MB.audio.sfx('coin'); MB.audio.sfx('fragment');
    shopPop(btn, `-${cost} ✨ · +${got.to - got.from} 🧩`);
    if (got.done) MB.Cards.reveal([{ card: got.card, from: got.from, to: got.to, need: got.need, done: true }]).then(renderShop);
    else renderShop();
  }
  // where a card stands: unlock progress, or its level and the fragments toward the next one
  function standing(id) {
    const C = MB.Collection, have = shardsOf(id);
    if (!isUnlocked(id)) return `🔒 🧩 ${have}/${C.need(id)} to unlock`;
    const lv = C.level(save, id), cost = C.upCost(save, id);
    if (!cost) return `<b class="lv">★ Max level</b>`;
    return `<b class="lv">Lv ${lv}</b> · 🧩 ${have}/${cost}${have >= cost ? ' <b class="ok">⬆ ready</b>' : ''}`;
  }
  function renderShop() {
    const body = $('#shop-body');
    $('#shop-bank').innerHTML = glitterHtml();
    document.querySelectorAll('#shop-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
    body.innerHTML = '';
    body.className = 'tab-' + shopTab;
    if (shopTab === 'deals') renderDeals(body); else renderShopCards(body);
    const next = new Date(); next.setHours(24, 0, 0, 0);
    const h = Math.floor((next - Date.now()) / 3600000), min = Math.floor(((next - Date.now()) % 3600000) / 60000);
    $('#shop-foot').innerHTML = shopTab === 'deals'
      ? `New deals in <b>${h}h ${min}m</b> · Deals are ${Math.round(MB.GLITTER.shop.off * 100)}% cheaper than crafting, once each · Right-click any card to see it up close`
      : `🧩 Fragments unlock a card, then level it up: rarer cards need more fragments per level and gain more stats. Max level unlocks its special move.`;
  }
  function renderDeals(body) {
    const S = MB.Shop, row = body.appendChild(el('div', 'shop-deals'));
    save.shop.deals.forEach((d, i) => {
      const c = S.dealCost(save, d), full = Math.round(d.n * MB.GLITTER.craft[MB.CARDS[d.card].rarity]);
      const t = row.appendChild(el('div', 'shop-deal' + (d.bought ? ' sold' : !c ? ' spent' : '')));
      const card = t.appendChild(cardEl(d.card));
      if (!isUnlocked(d.card)) lockCard(card);
      card.addEventListener('click', () => MB.Cards.open(d.card, card));
      t.appendChild(el('div', 'sd-info', `<div class="sd-n">🧩 ×${c ? c.k : d.n}</div><div class="sd-st">${standing(d.card)}</div>`));
      const b = t.appendChild(el('button', 'btn primary sd-buy', d.bought ? '✔ Bought' : !c ? 'Not needed' : `<s>✨ ${full}</s> ✨ ${c.cost}`));
      b.disabled = !c || save.glitter < c.cost;
      b.onclick = () => {
        const got = S.buyDeal(save, i);
        if (!got) { MB.audio.sfx('error'); return; }
        bought(b, got, c.cost);
      };
    });
    if (!save.shop.deals.length) row.appendChild(el('p', 'stats-empty', 'No deals today: every card is collected and maxed!'));
    gsap.fromTo(row.children, { y: 40, opacity: 0, rotationY: -30 }, { y: 0, opacity: 1, rotationY: 0, duration: 0.45, stagger: 0.06, ease: 'back.out(1.6)' });
    // packs for Glitter, opened right away
    const packsEl = body.appendChild(el('div', 'shop-packs'));
    Object.entries(MB.PACKS).forEach(([tier, p]) => {
      const cost = MB.Shop.packCost(save, tier);
      const t = packsEl.appendChild(el('div', `shop-pack t-${tier}`, `<img class="sp-art" src="${MB.packArt(tier)}" alt="">
        <div><b style="color:${p.color}">${p.name}</b><div class="sp-slots">${slotsText(p.slots)}</div></div>`));
      t.style.setProperty('--rc', p.color);
      const b = t.appendChild(el('button', 'btn sp-buy', cost ? `✨ ${cost}` : '—'));
      b.title = 'Buy it and open it now';
      b.disabled = !cost || save.glitter < cost || opening;
      b.onclick = async () => {
        if (opening || !MB.Shop.buyPack(save, tier)) { MB.audio.sfx('error'); return; }
        opening = true;
        persist(); refreshProfileBits();
        MB.audio.sfx('coin');
        const got = openPack(tier);
        await MB.Cards.openPack(tier, got, t.querySelector('.sp-art'), 0);
        opening = false;
        renderShop();
      };
    });
  }
  function renderShopCards(body) {
    const M = MB.Missions, C = MB.Collection;
    const bar = body.appendChild(el('div', 'shop-tools'));
    const search = el('input');
    Object.assign(search, { type: 'search', placeholder: '🔍 Find a card…', value: shopFilt.text, spellcheck: false });
    const sel = el('select');
    [['want', 'Cards that can use fragments'], ['deck', '🂠 In this deck'], ['owned', '⬆ Owned: level up'], ['locked', '🔒 Not owned yet']]
      .forEach(([v, t]) => sel.appendChild(new Option(t, v, false, shopFilt.show === v)));
    bar.append(search, sel);
    const grid = body.appendChild(el('div', 'shop-cards scroll-y'));
    const fill = () => {
      grid.innerHTML = '';
      const q = shopFilt.text.toLowerCase(), inDeck = new Set(save.deck);
      // closest to their next step first, then cheapest
      const left = (id) => M.nextStep(save, id) / (isUnlocked(id) ? C.upCost(save, id) || 1 : C.need(id));
      const ids = deckCards().filter((id) => M.craftCost(save, id)
        && (!q || MB.cardDef(id).name.toLowerCase().includes(q))
        && (shopFilt.show === 'deck' ? inDeck.has(id) : shopFilt.show === 'owned' ? isUnlocked(id) : shopFilt.show === 'locked' ? !isUnlocked(id) : true))
        .sort((a, b) => inDeck.has(b) - inDeck.has(a) || left(a) - left(b) || MB.CARDS[a].cost - MB.CARDS[b].cost);
      if (!ids.length) grid.appendChild(el('div', 'coll-empty', 'No cards here can use fragments.'));
      ids.forEach((id) => {
        const t = grid.appendChild(el('div', 'shop-card'));
        const card = t.appendChild(cardEl(id));
        if (!isUnlocked(id)) lockCard(card);
        card.addEventListener('click', () => MB.Cards.open(id, card));
        t.appendChild(el('div', 'sd-st', standing(id)));
        const btns = t.appendChild(el('div', 'sc-btns'));
        if (canLevel(id)) {
          const up = btns.appendChild(el('button', 'btn primary sc-lv', `⬆ Lv ${C.level(save, id) + 1}`));
          up.onclick = () => { if (levelUp(id)) { MB.audio.sfx('buff'); MB.audio.sfx('fanfare'); shopPop(up, `⬆ Lv ${C.level(save, id)}!`); fill(); } };
          return;
        }
        const per = M.craftCost(save, id), step = Math.min(M.nextStep(save, id), C.room(save, id));
        const buy = (n, label) => {
          const b = btns.appendChild(el('button', 'btn sc-buy', `${label} <b>✨ ${per * n}</b>`));
          b.disabled = save.glitter < per * n;
          b.onclick = () => {
            const got = M.craft(save, id, n);
            if (!got) { MB.audio.sfx('error'); return; }
            bought(b, { ...got, card: id, need: C.need(id) }, per * n);
          };
        };
        buy(1, '+1 🧩');
        if (step > 1) buy(step, `+${step}`);
      });
    };
    search.oninput = () => { shopFilt.text = search.value.trim(); fill(); };
    sel.onchange = () => { MB.audio.sfx('click'); shopFilt.show = sel.value; fill(); };
    fill();
  }

  // ---------------------------------------------------------------- profile
  function profile(tab = 'pics') {
    hideBattle();
    show('screen-profile');
    MB.audio.music(MB.MUSIC.title);
    renderProfile();
    profileTab(tab);
  }
  // the right-hand side: profile pictures or battle stats
  function profileTab(tab) {
    document.querySelectorAll('#profile-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#avatar-grid').classList.toggle('hidden', tab !== 'pics');
    $('#stats-body').classList.toggle('hidden', tab !== 'stats');
    if (tab === 'stats') renderStats();
    gsap.fromTo(tab === 'stats' ? '#stats-body' : '#avatar-grid', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }
  function renderProfile() {
    const a = avatarById.get(save.avatar), st = save.stats;
    const wins = Object.values(st.difficulty).reduce((t, [w]) => t + w, 0);
    $('#profile-avatar').src = MB.avatarUrl(save.avatar);
    $('#profile-name').textContent = save.name;
    $('#profile-pic-name').textContent = a.name;
    const cards = deckCards();
    $('#profile-tiles').innerHTML = [
      [`${ownedAvatars()}/${MB.AVATARS.length}`, 'Pictures'], [`${cards.filter(isUnlocked).length}/${cards.length}`, 'Cards'],
      [wins, 'Wins'], [packCount(), 'Packs to open'],
    ].map(([big, label]) => `<div class="st-tile"><b>${big}</b><span>${label}</span></div>`).join('');
    $('#avatar-count').textContent = `${ownedAvatars()}/${MB.AVATARS.length}`;
    const grid = $('#avatar-grid');
    grid.innerHTML = '';
    // owned first, both halves alphabetical
    [...MB.AVATARS].sort((x, y) => hasAvatar(y.id) - hasAvatar(x.id)).forEach((av) => {
      const own = hasAvatar(av.id);
      const t = el('div', `pfp${own ? '' : ' locked'}${av.id === save.avatar ? ' on' : ''}`, `<img loading="lazy" src="${MB.avatarUrl(av.id)}" alt=""><span>${own ? av.name : '🔒'}</span>`);
      const at = MB.Collection.avatarStage[av.id];
      const atQuest = at != null && MB.Story.byStage(at);
      t.title = own ? av.name : !atQuest ? 'Locked' : `Win it in Story: beat ${MB.charById(MB.STORY[at].foe).name} (Act ${atQuest.act + 1}${atQuest.side ? ', side quest' : ''})`;
      t.onclick = () => {
        if (!own) { MB.audio.sfx('error'); gsap.fromTo(t, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.25)' }); return; }
        MB.audio.sfx('buff');
        setAvatar(av.id);
        grid.querySelectorAll('.pfp.on').forEach((x) => x.classList.remove('on'));
        t.classList.add('on');
        $('#profile-avatar').src = MB.avatarUrl(av.id);
        $('#profile-pic-name').textContent = av.name;
        gsap.fromTo('#profile-avatar', { scale: 0.8, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
      };
      grid.appendChild(t);
    });
  }
  function renameProfile() {
    const name = prompt('Your name:', save.name);
    if (name == null || !name.trim()) return;
    save.name = name.trim().slice(0, 20);
    persist();
    renderProfile();
    refreshProfileBits();
  }
  // the title screen's profile chip and pack badge
  function refreshProfileBits() {
    $('#chip-avatar').src = MB.avatarUrl(save.avatar);
    $('#chip-name').textContent = save.name;
    $('#chip-sub').textContent = `🖼 ${ownedAvatars()}/${MB.AVATARS.length} · ✨ ${save.glitter}`;
    const n = packCount(), badge = $('#packs-badge');
    badge.textContent = n;
    badge.classList.toggle('hidden', !n);
    if (MB.Missions.daily(save)) persist();
    const up = deckCards().filter(canLevel).length, db = $('#deck-badge');
    db.textContent = up ? '⬆' + up : '';
    db.classList.toggle('hidden', !up);
    const m = MB.Missions.claimable(save), mb = $('#missions-badge');
    mb.textContent = m;
    mb.classList.toggle('hidden', !m);
    // an Arena run in progress: its record, or 🎁 when its rewards are waiting
    const a = save.arena, ab = $('#arena-badge');
    ab.textContent = !a ? '' : a.stage === 'done' ? '🎁' : a.stage === 'run' ? `${a.wins}-${a.losses}` : '…';
    ab.classList.toggle('hidden', !a);
  }

  // ---------------------------------------------------------------- settings / jukebox
  function settings() {
    const p = $('#settings');
    p.classList.toggle('open');
    const sel = $('#jukebox');
    if (!sel.options.length) {
      MB.manifest.music.forEach((m) => sel.appendChild(new Option(m.name, m.id)));
      sel.addEventListener('change', () => MB.audio.music(sel.value));
    }
  }

  function bind() {
    $('#btn-story').onclick = () => { MB.audio.sfx('click'); MB.StoryMap.open(); };
    $('#btn-quick').onclick = () => { MB.audio.sfx('click'); quick(); };
    document.querySelectorAll('#profile-tabs button').forEach((b) => (b.onclick = () => { MB.audio.sfx('click'); profileTab(b.dataset.tab); }));
    $('#deck-rename').onclick = () => { MB.audio.sfx('click'); renameDeck(); };
    $('#btn-deck').onclick = () => { MB.audio.sfx('click'); deck(); };
    $('#btn-gallery').onclick = () => { MB.audio.sfx('click'); gallery(); };
    $('#btn-howto').onclick = () => { MB.audio.sfx('click'); MB.HowTo.open(); };
    $('#btn-packs').onclick = () => { MB.audio.sfx('click'); packs(); };
    $('#btn-missions').onclick = () => { MB.audio.sfx('click'); missions(); };
    $('#btn-shop').onclick = () => { MB.audio.sfx('click'); shop(); };
    document.querySelectorAll('#shop-tabs button').forEach((b) => (b.onclick = () => { MB.audio.sfx('click'); shopTab = b.dataset.tab; renderShop(); }));
    $('#btn-arena').onclick = () => { MB.audio.sfx('click'); arena(); };
    $('#result-missions').onclick = () => { MB.audio.sfx('click'); missions(); };
    $('#profile-chip').onclick = () => { MB.audio.sfx('click'); profile(); };
    $('#profile-rename').onclick = () => { MB.audio.sfx('click'); renameProfile(); };
    $('#result-packs').onclick = () => { MB.audio.sfx('click'); packs(); };
    document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { MB.audio.sfx('click'); title(); }));
    $('#result-menu').onclick = () => { MB.audio.sfx('click'); title(); };
    $('#gal-attack').onclick = galAttack;
    $('#gal-back').onclick = () => { MB.audio.sfx('click'); MB.view.clear(); title(); };
    $('#deck-reset').onclick = () => { save.deck = MB.STARTER_DECK.slice(); persist(); renderDeck(); };
    $('#deck-clear').onclick = () => { save.deck = []; persist(); renderDeck(); };
    $('#btn-settings').onclick = settings;
    $('#save-export').onclick = () => { MB.audio.sfx('click'); exportSave(); };
    $('#save-import').onclick = () => {
      MB.audio.sfx('click');
      // swapping saves mid-battle would pay out rewards to the wrong save
      if (MB.battle && !MB.battle.over && !$('#arena').classList.contains('gallery-mode')) return saveStatus('Finish or forfeit the battle first.', true);
      $('#save-file').click();
    };
    $('#save-reset').onclick = () => { MB.audio.sfx('click'); resetSave(); };
    $('#save-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); };
    bindMenuFx();
    MB.Cards.bind();
    MB.StoryMap.bind();
    MB.Tutorial.bind();
    $('#vol-music').value = MB.audio.settings.music;
    $('#vol-sfx').value = MB.audio.settings.sfx;
    $('#vol-music').oninput = (e) => MB.audio.setVolume('music', +e.target.value);
    $('#vol-sfx').oninput = (e) => MB.audio.setVolume('sfx', +e.target.value);
    $('#btn-forfeit').onclick = () => {
      if (!MB.battle || MB.battle.over || $('#arena').classList.contains('gallery-mode')) return;
      if (!confirm('Forfeit this battle?')) return;
      MB.battle.over = true; MB.battle.overShown = true; MB.view.cancelAim();
      battleOver(false);
    };
    document.addEventListener('mb-music', (e) => { $('#now-playing').textContent = '♪ ' + e.detail; });
    // browsers block autoplay until the first interaction
    window.addEventListener('pointerdown', () => { MB.audio.unlock(); MB.audio.retry(); });
  }

  MB.UI = { cardEl, lockCard, shardOverlay, shardsOf, preview, title, start, battleOver, bind, save, show, isUnlocked, maxCopies, costumesOf, setCostume,
    leaderSelect, storyIntro: intro, lesson, setBg, bgByName, persist, hideBattle,
    craft, makeShiny, levelUp, myDef, levelBadge, renderCollection: () => { if ($('#screen-deck').classList.contains('active')) renderDeck(); if ($('#screen-shop').classList.contains('active')) renderShop(); },
    refreshProfileBits,
    avatarById: (id) => avatarById.get(id) };
})();
