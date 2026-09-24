// Menus, story, deck builder, attack gallery and result screens.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const DECK_SIZE = MB.RULES.deckSize;

  // ---------------------------------------------------------------- save
  // When the save's shape changes: bump SAVE_VERSION and append a step to MIGRATIONS.
  // MIGRATIONS[v] upgrades a version-v save to v+1; saves from before versioning count as 0.
  const SAVE_VERSION = 3;
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
    ['unlocked', 'progress', 'decks', 'avatars'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    // commons added by later novels are owned right away
    s.unlocked = [...new Set([...s.unlocked, ...MB.STARTER_CARDS])];
    MB.CHAPTERS.forEach((_, i) => { s.progress[i] = s.progress[i] || 0; });
    // decks: always DECK_SLOTS of them, and a deck holding a card you don't own goes back to the starter
    for (let i = 0; i < DECK_SLOTS; i++) {
      const d = obj(s.decks[i]) ? s.decks[i] : {};
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
    if (!s.avatars.includes(s.avatar) || !avatarById.has(s.avatar)) s.avatar = MB.STARTER_AVATAR;
    s.name = String(s.name || '').slice(0, 20) || 'Player';
    // stats groups map an id to [wins, losses]
    s.stats = Object.assign({ leaders: {}, foes: {}, difficulty: {}, streak: 0, bestStreak: 0 }, s.stats);
    ['leaders', 'foes', 'difficulty'].forEach((k) => { if (!obj(s.stats[k])) s.stats[k] = {}; });
    return s;
  }
  function validSave(s) {
    return obj(s) && !(s.version > SAVE_VERSION)
      && ['deck', 'decks', 'leaders', 'unlocked', 'progress', 'avatars'].every((k) => s[k] === undefined || Array.isArray(s[k]))
      && ['costumes', 'stats', 'packs'].every((k) => s[k] === undefined || obj(s[k]));
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
  function saveStatus(msg, bad) {
    const n = $('#save-status');
    n.textContent = msg;
    n.classList.toggle('bad', !!bad);
  }

  const deckCards = () => Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token);
  const maxCopies = (id) => MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2;

  // ---------------------------------------------------------------- collection

  const isUnlocked = (id) => save.unlocked.includes(id);
  // locked cards grouped by rarity, only rarities worth at least minStars
  function lockedByRarity(minStars = 0) {
    const groups = {};
    deckCards().filter((id) => !isUnlocked(id) && MB.RARITY[MB.CARDS[id].rarity].stars >= minStars)
      .forEach((id) => (groups[MB.CARDS[id].rarity] = groups[MB.CARDS[id].rarity] || []).push(id));
    const total = Object.keys(groups).reduce((s, r) => s + MB.RARITY[r].weight, 0);
    return { groups, total };
  }
  function dropChance(id) {
    if (isUnlocked(id)) return 0;
    const { groups, total } = lockedByRarity(), r = MB.CARDS[id].rarity;
    return MB.RARITY[r].weight / total / groups[r].length;
  }
  function rollDrop(minStars) {
    const { groups, total } = lockedByRarity(minStars);
    if (!total) return null;
    let x = Math.random() * total;
    for (const r of Object.keys(groups)) { x -= MB.RARITY[r].weight; if (x <= 0) return MB.pick(groups[r]); }
    return MB.pick(Object.values(groups).pop());
  }
  function unlock(id) { if (id && MB.CARDS[id] && !isUnlocked(id)) { save.unlocked.push(id); return true; } return false; }

  // ---------------------------------------------------------------- packs & profile pictures
  const hasAvatar = (id) => save.avatars.includes(id);
  const lockedAvatars = () => MB.AVATARS.filter((a) => !hasAvatar(a.id)).map((a) => a.id);
  const ownedAvatars = () => MB.AVATARS.filter((a) => hasAvatar(a.id)).length;
  const allCollected = () => !lockedByRarity().total && !lockedAvatars().length;
  const packCount = () => Object.values(save.packs).reduce((a, b) => a + b, 0);

  // spends one pack of this tier and unlocks what's inside: [{ card } | { avatar }], pictures first, rarest card last
  function openPack(tier) {
    if (!(save.packs[tier] > 0)) return null;
    save.packs[tier]--;
    const card = (min) => { const id = rollDrop(min) || rollDrop(0); return unlock(id) ? { card: id } : null; };
    const avatar = () => { const ids = lockedAvatars(); if (!ids.length) return null; const id = MB.pick(ids); save.avatars.push(id); return { avatar: id }; };
    const got = MB.PACKS[tier].slots.map((slot) => (slot === 'avatar' ? avatar() || card(0) : card(slot === 'card' ? 0 : MB.RARITY[slot].stars) || avatar())).filter(Boolean);
    persist();
    const rank = (g) => (g.avatar ? -1 : rarityRank(g.card));
    return got.sort((a, b) => rank(a) - rank(b));
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
  const bgByName = (name) => (MB.manifest.backgrounds.find((b) => b.name.trim().toLowerCase() === name.toLowerCase()) || MB.pick(MB.manifest.backgrounds));

  // ---------------------------------------------------------------- cards
  // big: the art will be shown zoomed in (close-up, reveal)
  function cardEl(card, big) {
    const def = card.cid ? card : MB.cardDef(card.id || card);
    const c = el('div', `card r-${def.rarity} t-${def.type}`);
    const color = def.type === 'spell' ? def.color : def.attack.color;
    const rar = MB.RARITY[def.rarity];
    c.dataset.id = def.id;
    c.style.setProperty('--c', color);
    let art;
    if (def.type === 'spell') art = `<img class="item-art" src="${MB.itemIcon(def.id)}">`;
    else if (def.emoji) art = `<div class="emoji-art">${def.emoji}</div>`;
    else if (def.fused) art = MB.duoHtml(def, 'idle', big);
    else art = `<img src="${MB.spriteUrl(def.id, 'idle', undefined, big)}">`;
    const bonds = def.fused ? [def.bond] : def.type === 'unit' ? MB.bondsOf(def.id) : [];
    const badge = bonds.length ? `<div class="card-bond" title="Relationship">${def.fused ? MB.BOND_TIERS[def.bond.tier].hearts : '♥'}</div>` : '';
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
      ${def.rarity !== 'token' ? `<div class="r-gem" title="${rar.name}"></div>` : ''}`;
    return c;
  }

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

  function title() {
    hideBattle();
    show('screen-title');
    MB.audio.music(MB.MUSIC.title);
    if (titleTimer) titleTimer.kill();
    titleScene();
    logoIntro();
    refreshProfileBits();
    const btns = document.querySelectorAll('#screen-title .menu-btn');
    gsap.fromTo(btns, { opacity: 0, x: -80, rotationY: -35, filter: 'blur(10px)' },
      { opacity: 1, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.08, delay: 0.25, ease: 'power3.out', clearProps: 'filter' });
  }

  function bindMenuFx() {
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
  function leaderSelect(onPick, foeId) {
    show('screen-leader');
    battleOpts();
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
  // stages of one chapter as [{ st, i }] where i is the index into MB.STORY
  const chapterStages = (c) => MB.STORY.map((st, i) => ({ st, i })).filter((s) => s.st.chapter === c);
  const stagePos = (i) => chapterStages(MB.STORY[i].chapter).findIndex((s) => s.i === i);

  function story() {
    hideBattle();
    show('screen-story');
    MB.audio.music(MB.MUSIC.title);
    const list = $('#story-list');
    list.innerHTML = '';
    MB.CHAPTERS.forEach((chap, c) => {
      const stages = chapterStages(c), done = Math.min(save.progress[c], stages.length);
      const box = el('div', 'chapter', `<h2>Chapter ${c + 1} — ${chap.title} <small>${done === stages.length ? '★ Complete' : `${done}/${stages.length}`}</small></h2>`);
      const row = el('div', 'chapter-row');
      box.appendChild(row);
      list.appendChild(box);
      stages.forEach(({ st, i }, pos) => row.appendChild(stageEl(st, i, pos, save.progress[c])));
    });
    const next = list.querySelector('.stage.next');
    if (next) list.scrollTop = next.closest('.chapter').offsetTop - list.offsetTop - 10;
  }

  function stageEl(st, i, pos, progress) {
    const ch = MB.charById(st.foe), bg = bgByName(st.bg);
    const state = pos < progress ? 'cleared' : pos === progress ? 'next' : 'locked';
    const n = el('div', `stage ${state}`, `
      <div class="stage-bg" style="background-image:url('${MB.asset(bg.src)}')"></div>
      <img src="${MB.spriteUrl(st.foe, state === 'cleared' ? 'lose' : 'idle')}">
      <div class="stage-num">${pos + 1}</div>
      <div class="stage-name">${ch.name}</div>
      <div class="stage-loc">📍 ${bg.name}</div>
      <div class="stage-state">${state === 'cleared' ? '★ Cleared' : state === 'next' ? '▶ Fight' : '🔒'}</div>`);
    if (state !== 'locked') n.addEventListener('click', () => { MB.audio.sfx('click'); leaderSelect((lid) => intro(i, lid), st.foe); });
    return n;
  }

  // visual-novel style intro before each story battle
  function intro(i, leaderId) {
    const st = MB.STORY[i], ch = MB.charById(st.foe);
    setBg(MB.asset(bgByName(st.bg).src));
    MB.audio.music(st.music);
    show('screen-intro');
    $('#intro-foe').src = MB.bigSpriteUrl(st.foe, 'taunt');
    $('#intro-me').src = MB.bigSpriteUrl(leaderId, 'idle');
    $('#intro-name').textContent = ch.name;
    $('#intro-text').textContent = '';
    gsap.fromTo('#intro-foe', { x: 400, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    gsap.fromTo('#intro-me', { x: -400, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    const text = st.intro;
    const o = { n: 0 };
    gsap.to(o, { n: text.length, duration: text.length * 0.03, delay: 0.6, ease: 'none', onUpdate: () => { $('#intro-text').textContent = text.slice(0, o.n | 0); } });
    $('#intro-go').onclick = () => {
      MB.audio.sfx('click');
      startBattle({ leader: leaderId, foe: st.foe, foeHp: st.hp, ai: st.ai, bg: st.bg, music: st.music, story: i });
    };
  }

  // ---------------------------------------------------------------- quick battle
  function quick() {
    leaderSelect((lid) => {
      const foes = MB.manifest.characters.map((c) => c.id).filter((id) => id !== lid);
      const foe = MB.pick(foes);
      const bg = MB.pick(MB.manifest.backgrounds.filter((b) => !/hug|white/i.test(b.name)));
      const upbeat = MB.manifest.music.filter((m) => /exciting|fast|fun|happy/i.test(m.tags.join(' ') + m.name));
      startBattle({ leader: lid, foe, foeHp: MB.RULES.leaderHp, ai: 0.7, bgSrc: bg.src, music: MB.pick(upbeat.length ? upbeat : MB.manifest.music).id });
    });
  }

  function aiDeck(foeId) {
    const pool = deckCards().filter((id) => id !== foeId);
    const deck = [];
    const couples = MB.BONDS.filter((bd) => !bd.pair.includes(foeId));
    if (couples.length && Math.random() < 0.6) MB.pick(couples).pair.forEach((id) => { for (let i = 0; i < maxCopies(id); i++) deck.push(id); });
    const cheap = MB.shuffle(pool.filter((id) => MB.CARDS[id].cost <= 2));
    while (deck.length < 7) deck.push(cheap[deck.length % cheap.length]);
    let guard = 0;
    while (deck.length < DECK_SIZE && guard++ < 500) {
      const id = MB.pick(pool);
      if (deck.filter((d) => d === id).length < maxCopies(id)) deck.push(id);
    }
    return deck;
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
    if (save.deck.length !== DECK_SIZE) { alert(`${save.decks[save.activeDeck].name} needs exactly ${DECK_SIZE} cards.`); deck(); return; }
    if (starting) return;
    const diff = DIFFICULTY[save.difficulty];
    const bgSrc = cfg.bgSrc || bgByName(cfg.bg).src;
    const playerDeck = save.deck.slice(), enemyDeck = aiDeck(cfg.foe);
    const imgs = battleImages(cfg, bgSrc, [playerDeck, enemyDeck]);
    starting = true;
    await loadImages(imgs.need);
    starting = false;
    MB.preloadImages(imgs.later);
    current = { ...cfg, difficulty: save.difficulty };
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    setBg(MB.asset(bgSrc));
    MB.audio.music(cfg.music);
    $('#arena').classList.remove('gallery-mode');
    const b = new MB.Battle({ view: MB.view, playerLeader: cfg.leader, enemyLeader: cfg.foe, enemyHp: Math.round(cfg.foeHp * diff.hp),
      playerDeck, enemyDeck });
    b.aiSkill = diff.ai(cfg.ai);
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
    const cfg = current, r = $('#screen-result');
    let unlocked = null;
    const rewards = [];
    const chap = cfg.story != null ? MB.STORY[cfg.story].chapter : null;
    const finale = cfg.story != null && stagePos(cfg.story) === chapterStages(chap).length - 1;
    const firstClear = win && cfg.story != null && save.progress[chap] <= stagePos(cfg.story);
    if (win && cfg.story != null) {
      save.progress[chap] = Math.max(save.progress[chap], stagePos(cfg.story) + 1);
      if (!save.leaders.includes(cfg.foe)) { save.leaders.push(cfg.foe); unlocked = cfg.foe; }
      if (unlock(cfg.foe)) rewards.push(cfg.foe);
    }
    recordResult(cfg, win);
    // packs: Common for a win, Rare on Hard or a first Story clear, Epic for a first chapter clear and every 5-win streak
    const packs = [];
    if (win && !allCollected()) {
      packs.push(firstClear && finale ? 'epic' : firstClear || cfg.difficulty === 'hard' ? 'rare' : 'common');
      if (save.stats.streak % 5 === 0) packs.push('epic');
      packs.forEach((t) => save.packs[t]++);
    }
    persist();
    MB.audio.music(win ? MB.MUSIC.win : MB.MUSIC.lose);
    show('screen-result');
    $('#result-title').textContent = win ? 'VICTORY!' : 'DEFEAT...';
    r.className = 'screen active ' + (win ? 'win' : 'lose');
    $('#result-me').src = MB.bigSpriteUrl(cfg.leader, win ? 'win' : 'lose');
    $('#result-foe').src = MB.bigSpriteUrl(cfg.foe, win ? 'lose' : 'win');
    const foe = MB.charById(cfg.foe);
    $('#result-text').innerHTML = win
      ? (unlocked ? `${foe.name} joins your roster! You can now pick them as a leader.` : `You beat ${foe.name}!`) +
        (finale ? `<br><b>${MB.CHAPTERS[chap].outro}</b>` : '')
      : `${foe.name} wins this round. Tweak your deck and try again!`;
    if (rewards.length) $('#result-text').innerHTML += `<br>🎴 New card${rewards.length > 1 ? 's' : ''}: ` +
      rewards.map((id) => `<b style="color:${MB.RARITY[MB.CARDS[id].rarity].color}">${MB.cardDef(id).name}</b>`).join(', ');
    if (packs.length) $('#result-text').innerHTML += '<br>🎁 Earned: ' + packs.map((t, i) =>
      `<b style="color:${MB.PACKS[t].color}">${MB.PACKS[t].name}</b>${i ? ` <small>(${save.stats.streak}-win streak bonus!)</small>` : ''}`).join(' + ');
    else if (win) $('#result-text').innerHTML += '<br>🎴 Your collection is complete!';
    $('#result-packs').classList.toggle('hidden', !packCount());
    $('#result-packs').textContent = `🎁 Open Packs (${packCount()})`;
    if (rewards.length) gsap.delayedCall(1.1, () => MB.Cards.reveal(rewards));
    gsap.fromTo('#result-title', { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' });
    gsap.fromTo('#result-me', { x: -300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, delay: 0.2 });
    gsap.fromTo('#result-foe', { x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, delay: 0.2 });
    $('#result-again').onclick = () => { MB.audio.sfx('click'); cfg.story != null ? story() : startBattle({ ...cfg, foe: cfg.foe }); };
    $('#result-again').textContent = cfg.story != null ? 'Story Map' : 'Rematch';
  }

  // ---------------------------------------------------------------- deck builder
  function deck() {
    hideBattle();
    show('screen-deck');
    MB.audio.music(MB.MUSIC.deck);
    renderDeck();
    gsap.fromTo('#collection .card', { opacity: 0, y: 50, rotationX: -50, scale: 0.85 },
      { opacity: 1, y: 0, rotationX: 0, scale: 1, duration: 0.55, stagger: 0.025, delay: 0.15, ease: 'back.out(1.4)' });
  }
  function lockCard(c) {
    c.classList.add('locked');
    c.appendChild(el('div', 'lock-veil', `<b>🔒</b><span>${MB.RARITY[MB.CARDS[c.dataset.id].rarity].name}</span>`));
    return c;
  }
  const rarityRank = (id) => MB.RARITY[MB.CARDS[id].rarity].stars;
  function renderDeckTabs() {
    const tabs = $('#deck-tabs');
    tabs.innerHTML = '';
    save.decks.forEach((d, i) => {
      const on = i === save.activeDeck, n = on ? save.deck.length : d.cards.length;
      const t = el('div', 'deck-tab' + (on ? ' on' : '') + (n !== DECK_SIZE ? ' bad' : ''), `<span class="dt-name"></span><small>${n}/${DECK_SIZE}</small>`);
      t.querySelector('.dt-name').textContent = d.name;
      if (on) {
        const pen = el('b', 'dt-rename', '✎');
        pen.title = 'Rename deck';
        pen.onclick = () => {
          const name = prompt('Deck name:', d.name);
          if (name == null || !name.trim()) return;
          d.name = name.trim().slice(0, 20); persist(); renderDeckTabs();
        };
        t.appendChild(pen);
      } else {
        t.title = 'Switch to this deck';
        t.onclick = () => { MB.audio.sfx('click'); switchDeck(i); renderDeck(); };
      }
      tabs.appendChild(t);
    });
  }
  function renderDeck(added) {
    const col = $('#collection'), list = $('#deck-list');
    col.innerHTML = ''; list.innerHTML = '';
    renderDeckTabs();
    deckCards().sort((a, b) => (isUnlocked(b) - isUnlocked(a)) || MB.CARDS[a].cost - MB.CARDS[b].cost || rarityRank(a) - rarityRank(b)).forEach((id) => {
      const c = cardEl(id);
      c.classList.add('collect');
      col.appendChild(c);
      if (!isUnlocked(id)) {
        lockCard(c);
        c.addEventListener('click', () => { MB.audio.sfx('error'); gsap.fromTo(c, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.25)' }); });
        return;
      }
      const n = save.deck.filter((d) => d === id).length;
      c.appendChild(el('div', 'copies', `${n}/${maxCopies(id)}`));
      if (n >= maxCopies(id)) c.classList.add('maxed');
      c.addEventListener('click', () => {
        if (save.deck.length >= DECK_SIZE || n >= maxCopies(id)) { MB.audio.sfx('error'); gsap.fromTo(c, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.25)' }); return; }
        save.deck.push(id); persist(); MB.audio.sfx('play');
        MB.Cards.flyToDeck(c, $('#deck-list'));
        renderDeck(id);
      });
    });
    const counts = {};
    save.deck.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
    Object.keys(counts).sort((a, b) => MB.CARDS[a].cost - MB.CARDS[b].cost).forEach((id) => {
      const d = MB.cardDef(id);
      const row = el('div', `deck-row r-${d.rarity}`, `<span class="dc">${d.cost}</span><span class="dn">${d.name}</span><span class="dx">×${counts[id]}</span>`);
      row.style.setProperty('--c', d.type === 'spell' ? d.color : d.attack.color);
      row.style.setProperty('--rc', MB.RARITY[d.rarity].color);
      row.style.backgroundImage = d.type === 'spell' ? '' : `linear-gradient(90deg, rgba(20,16,40,.95) 45%, rgba(20,16,40,.3)), url("${MB.spriteUrl(id, 'idle')}")`;
      row.addEventListener('click', () => {
        MB.audio.sfx('click');
        gsap.to(row, { x: -60, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => { save.deck.splice(save.deck.indexOf(id), 1); persist(); renderDeck(); } });
      });
      list.appendChild(row);
      if (id === added) gsap.fromTo(row, { x: 50, filter: 'brightness(2.2)' }, { x: 0, filter: 'brightness(1)', duration: 0.6, delay: 0.35, ease: 'back.out(2)', clearProps: 'filter' });
    });
    const owned = deckCards().filter(isUnlocked).length;
    $('#coll-count').textContent = `· 🎴 ${owned}/${deckCards().length}`;
    $('#deck-count').textContent = `${save.deck.length}/${DECK_SIZE}`;
    $('#deck-count').classList.toggle('bad', save.deck.length !== DECK_SIZE);
    const curve = new Array(8).fill(0);
    save.deck.forEach((id) => curve[Math.min(7, MB.CARDS[id].cost)]++);
    const mx = Math.max(1, ...curve);
    $('#deck-curve').innerHTML = curve.map((n, i) => `<div class="bar"><i style="height:${(n / mx) * 100}%"></i><span>${i === 7 ? '7+' : i}</span></div>`).join('');
  }

  // ---------------------------------------------------------------- stats
  const pct = ([w, l]) => (w + l ? Math.round((w / (w + l)) * 100) : 0);
  function stats() {
    hideBattle();
    show('screen-stats');
    MB.audio.music(MB.MUSIC.title);
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
    gal = { b, unit: null, dummy: null };
    b.summon(1, MB.cardDef('dummy'), 1).then((d) => { gal.dummy = d; });
    b.summon(1, MB.cardDef('dummy'), 2).then((d) => { gal.dummy2 = d; });
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
    const target = MB.pick([gal.dummy, gal.dummy2].filter(Boolean));
    target.hp = 99; target.frozen = false; target.shield = false; target.burning = false;
    const unit = gal.unit, card = unit.card;
    if (gal.sky) unit.card = { ...card, attack: { ...card.attack, sky: gal.sky } };
    try { await b.attack(unit, target); } finally { unit.card = card; gal.busy = false; }
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
    const lines = [];
    if (n('epic')) lines.push(`${n('epic')} <b style="color:${MB.RARITY.epic.color}">Epic+</b> card`);
    if (n('rare')) lines.push(`${n('rare')} <b style="color:${MB.RARITY.rare.color}">Rare+</b> card`);
    if (n('card')) lines.push(`${n('card')} card`);
    if (n('avatar')) lines.push(`${n('avatar')} profile picture${n('avatar') > 1 ? 's' : ''}`);
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
        if (opening) return;
        const got = openPack(tier);
        if (!got) return;
        opening = true;
        MB.audio.sfx('click');
        await MB.Cards.openPack(tier, got, t.querySelector('.pack-art'));
        opening = false;
        renderPacks();
      };
      t.appendChild(b);
      list.appendChild(t);
    });
    const cards = deckCards();
    $('#pack-progress').innerHTML = `🎴 Cards <b>${cards.filter(isUnlocked).length}/${cards.length}</b> · 🖼 Profile pictures <b>${ownedAvatars()}/${MB.AVATARS.length}</b>`
      + (allCollected() ? ' · <b class="done">Collection complete!</b>' : '');
    refreshProfileBits();
  }

  // ---------------------------------------------------------------- profile
  function profile() {
    hideBattle();
    show('screen-profile');
    MB.audio.music(MB.MUSIC.title);
    renderProfile();
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
      t.title = own ? av.name : 'Find it in a card pack';
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
    $('#chip-sub').textContent = `🖼 ${ownedAvatars()}/${MB.AVATARS.length}`;
    const n = packCount(), badge = $('#packs-badge');
    badge.textContent = n;
    badge.classList.toggle('hidden', !n);
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
    $('#btn-story').onclick = () => { MB.audio.sfx('click'); story(); };
    $('#btn-quick').onclick = () => { MB.audio.sfx('click'); quick(); };
    $('#btn-deck').onclick = () => { MB.audio.sfx('click'); deck(); };
    $('#btn-gallery').onclick = () => { MB.audio.sfx('click'); gallery(); };
    $('#btn-howto').onclick = () => { MB.audio.sfx('click'); show('screen-howto'); };
    $('#btn-stats').onclick = () => { MB.audio.sfx('click'); stats(); };
    $('#btn-packs').onclick = () => { MB.audio.sfx('click'); packs(); };
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
    $('#save-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); };
    bindMenuFx();
    MB.Cards.bind();
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

  MB.UI = { cardEl, lockCard, preview, title, battleOver, bind, save, show, isUnlocked, dropChance, maxCopies, costumesOf, setCostume,
    avatarById: (id) => avatarById.get(id) };
})();
