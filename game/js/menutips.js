// Main menu explainers: hovering a button opens a small panel beside it with a looping animation of what the
// mode is about, drawn with the game's own cards, sprites, pack art and profile pictures.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const W = 340, H = 170; // the stage

  // a card shrunk to fit the stage, in a box of its shrunk size so it lays out like a small card
  function mini(id, scale = 0.42, locked) {
    const box = el('div', 'mt-card');
    Object.assign(box.style, { width: 160 * scale + 'px', height: 220 * scale + 'px' });
    const c = MB.UI.cardEl(id);
    c.style.zoom = scale;
    if (locked) { MB.UI.lockCard(c, 0); c.querySelector('.shard-veil').remove(); }
    box.appendChild(c);
    return box;
  }
  const place = (n, x, y) => { gsap.set(n, { position: 'absolute', left: 0, top: 0, x, y }); return n; };
  const owned = () => MB.Collection.deckCards().filter(MB.UI.isUnlocked);
  const units = (ids) => ids.filter((id) => MB.cardDef(id).type === 'unit');

  // ---------------------------------------------------------------- scenes: each fills the stage and returns a looping timeline
  function story(S) {
    const save = MB.UI.save;
    const c = Math.max(0, MB.CHAPTERS.findIndex((ch, i) => !ch.hidden && save.progress[i] < MB.STORY.filter((s) => s.chapter === i).length));
    const foes = MB.STORY.filter((s) => s.chapter === c).slice(0, 4).map((s) => s.foe);
    const xs = [40, 125, 210, 295], ys = [128, 104, 128, 104];
    const svg = el('div', 'mt-svg', `<svg width="${W}" height="${H}"><path d="M${xs.map((x, i) => `${x},${ys[i]}`).join(' L')}" /></svg>`);
    S.appendChild(svg);
    const path = svg.querySelector('path');
    const nodes = foes.map((id, i) => {
      const n = place(el('div', 'mt-node', `<img src="${MB.spriteUrl(id, 'idle')}"><i>${i + 1}</i><b>★</b>`), xs[i] - 30, ys[i] - 88);
      S.appendChild(n);
      return n;
    });
    const me = place(el('div', 'mt-me', `<img src="${MB.avatarUrl(save.avatar)}">`), xs[0] - 14, ys[0] - 14);
    S.appendChild(me);
    S.appendChild(place(el('div', 'mt-chap', `Chapter ${c + 1} · ${MB.CHAPTERS[c].title}`), 10, 6));
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    tl.set(nodes.map((n) => n.querySelector('b')), { scale: 0, opacity: 0 })
      .set(nodes.map((n) => n.querySelector('img')), { filter: 'brightness(0) drop-shadow(0 0 3px #fff8)' })
      .set(me, { x: xs[0] - 14, y: ys[0] - 14 })
      .fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power1.inOut' })
      .from(nodes, { scale: 0, opacity: 0, duration: 0.35, stagger: 0.12, ease: 'back.out(2)' }, 0.1);
    nodes.forEach((n, i) => {
      const img = n.querySelector('img');
      // hop to the next stage
      if (i) tl.to(me, { x: xs[i] - 14, duration: 0.45, ease: 'power1.inOut' })
        .to(me, { y: Math.min(ys[i], ys[i - 1]) - 44, duration: 0.22, ease: 'power2.out' }, '<')
        .to(me, { y: ys[i] - 14, duration: 0.23, ease: 'power2.in' });
      tl.to(img, { filter: 'brightness(1) drop-shadow(0 0 0px #fff0)', duration: 0.25 })
        .to(n, { x: `+=${4}`, duration: 0.05, repeat: 5, yoyo: true })
        .to(n.querySelector('b'), { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' })
        .to(img, { filter: 'grayscale(1) brightness(.7)', duration: 0.3 }, '<');
    });
    return tl;
  }

  function deckScene(S) {
    const mine = owned(), hand = [0, 1, 2].map(() => pick(mine));
    const locked = MB.Collection.locked(MB.UI.save);
    const target = locked.find((id) => MB.CARDS[id].rarity === 'rare') || pick(Object.keys(MB.CARDS).filter((id) => MB.CARDS[id].rarity === 'rare'));
    const cards = hand.map((id, i) => { const m = place(mini(id, 0.4), 6 + i * 40, 42); S.appendChild(m); return m; });
    gsap.set(cards, { rotation: (i) => (i - 1) * 10, transformOrigin: '50% 120%' });
    const star = place(mini(target, 0.52, true), 162, 22);
    S.appendChild(star);
    const pieces = [...star.querySelectorAll('.sh')], count = star.querySelector('.shard-count span'), bar = star.querySelector('.shard-count i');
    const stack = place(el('div', 'mt-stack', '<i></i><i></i><i></i><b>19/20</b>'), 258, 44);
    S.appendChild(stack);
    const n = pieces.length, o = { k: 0 };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
    tl.set(star, { x: 136, y: 22, scale: 1, rotation: 0, opacity: 1 })
      .set(pieces, { opacity: 1 }).set(star.querySelector('.shards'), { opacity: 1 }).set(stack.querySelector('b'), { textContent: '19/20' })
      .to(cards, { rotation: (i) => (i - 1) * 14, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
    pieces.forEach((p, i) => {
      tl.to(p, { opacity: 0, duration: 0.25, ease: 'power2.out' }, 0.3 + i * 0.45)
        .to(o, { k: i + 1, duration: 0.01, onUpdate: () => { count.textContent = `🧩 ${Math.round(o.k)}/${n}`; bar.style.width = (o.k / n) * 100 + '%'; } }, '<')
        .fromTo(star, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<');
    });
    tl.to(star.querySelector('.shards'), { opacity: 0, duration: 0.3 })
      .fromTo(star, { filter: 'brightness(2.5)' }, { filter: 'brightness(1)', duration: 0.5 }, '<')
      .to(star, { x: 262, y: 48, scale: 0.55, rotation: 12, duration: 0.5, ease: 'power3.in' }, '+=0.4')
      .to(star, { opacity: 0, duration: 0.1 })
      .set(stack.querySelector('b'), { textContent: '20/20' })
      .fromTo(stack, { scale: 1.2 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, '<');
    return tl;
  }

  function packScene(S) {
    const pack = place(el('div', 'mt-pack', '<div class="rv-pack-body"></div><div class="rv-pack-top"></div>'), 30, 12);
    Object.assign(pack.style, { width: '92px', height: '149px' });
    pack.style.setProperty('--art', `url("${MB.packArt('rare')}")`);
    pack.style.setProperty('--tear', '15%');
    S.appendChild(pack);
    const locked = MB.Collection.locked(MB.UI.save);
    const target = locked.find((id) => MB.CARDS[id].rarity === 'epic') || pick(Object.keys(MB.CARDS).filter((id) => MB.CARDS[id].rarity === 'epic'));
    const card = place(mini(target, 0.62, true), 214, 14);
    S.appendChild(card);
    const pieces = [...card.querySelectorAll('.sh')], count = card.querySelector('.shard-count span'), bar = card.querySelector('.shard-count i');
    const frags = [0, 1, 2].map(() => { const f = place(el('div', 'mt-frag', '🧩'), 64, 60); S.appendChild(f); return f; });
    const top = pack.querySelector('.rv-pack-top'), body = pack.querySelector('.rv-pack-body');
    const n = pieces.length, have = n - 3; // the last three fragments, so the card comes together
    const setCount = (k) => { count.textContent = `🧩 ${k}/${n}`; bar.style.width = (k / n) * 100 + '%'; };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    tl.call(() => setCount(have)).set(pieces, { opacity: (i) => (i < have ? 0 : 1) })
      .set(top, { x: 0, y: 0, rotation: 0, opacity: 1 }).set(body, { y: 0, opacity: 1 }).set(frags, { x: 64, y: 60, opacity: 0, scale: 0.4 })
      .set(card.querySelector('.shards'), { opacity: 1 }).set(card, { filter: 'brightness(1)' })
      .to(pack, { rotation: 4, duration: 0.06, repeat: 9, yoyo: true, ease: 'none' }, 0.3)
      .to(top, { x: 50, y: -60, rotation: 40, opacity: 0, duration: 0.5, ease: 'power2.out' })
      .to(frags, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.08 }, '<');
    frags.forEach((f, i) => {
      tl.to(f, { motionPath: { path: [{ x: 64, y: 60 }, { x: 150, y: -10 + i * 20 }, { x: 240, y: 60 }], curviness: 1.4 }, rotation: 360, duration: 0.6, ease: 'power1.in' }, `>-${i ? 0.35 : 0}`)
        .to(f, { opacity: 0, scale: 0.3, duration: 0.1 })
        .to(pieces[have + i], { opacity: 0, duration: 0.2 }, '<')
        .call(() => setCount(have + i + 1), null, '<')
        .fromTo(card, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<');
    });
    tl.to(body, { y: 30, opacity: 0.3, duration: 0.4 }, '<')
      .to(card.querySelector('.shards'), { opacity: 0, duration: 0.3 }, '+=0.2')
      .fromTo(card, { filter: 'brightness(2.5)' }, { filter: 'brightness(1)', duration: 0.6 }, '<')
      .to({}, { duration: 1 });
    return tl;
  }

  function howtoScene(S) {
    const mine = units(owned()), ally = pick(mine), foe = pick(MB.manifest.characters).id;
    S.appendChild(place(el('div', 'mt-tile'), 30, 110));
    S.appendChild(place(el('div', 'mt-tile'), 110, 110));
    const leader = place(el('div', 'mt-leader', `<img src="${MB.spriteUrl(foe, 'idle')}"><b>20</b>`), 240, 26);
    S.appendChild(leader);
    const gold = place(el('div', 'mt-gold', '🪙 3'), 8, 6);
    S.appendChild(gold);
    const card = place(mini(ally, 0.36), 44, 190);
    S.appendChild(card);
    const unit = place(el('div', 'mt-unit', `<img src="${MB.spriteUrl(ally, 'idle')}">`), 32, 38);
    S.appendChild(unit);
    const svg = el('div', 'mt-svg', `<svg width="${W}" height="${H}"><path class="aim" d="M70,70 Q170,-10 262,62" /></svg>`);
    S.appendChild(svg);
    const aim = svg.querySelector('path'), hp = leader.querySelector('b');
    const dmg = place(el('div', 'mt-dmg', `-${MB.cardDef(ally).atk}`), 262, 40);
    S.appendChild(dmg);
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    tl.set(card, { x: 44, y: 190, scale: 1, opacity: 1 }).set(unit, { opacity: 0, scale: 0.5 }).set(aim, { drawSVG: '0%' })
      .set(dmg, { opacity: 0, y: 40 }).set(hp, { textContent: 20 }).set(gold, { textContent: '🪙 3' })
      .to(card, { y: 60, duration: 0.6, ease: 'power2.out' }, 0.2)
      .to(card, { x: 36, y: 44, scale: 0.8, duration: 0.35, ease: 'power2.in' })
      .set(gold, { textContent: `🪙 ${Math.max(0, 3 - MB.cardDef(ally).cost)}` })
      .to(card, { opacity: 0, duration: 0.15 })
      .to(unit, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, '<')
      .to(aim, { drawSVG: '100%', duration: 0.5, ease: 'power1.inOut' }, '+=0.3')
      .to(unit, { x: 190, y: 20, duration: 0.25, ease: 'power3.in' })
      .to(leader, { x: '+=6', duration: 0.05, repeat: 5, yoyo: true })
      .set(hp, { textContent: Math.max(0, 20 - MB.cardDef(ally).atk) }, '<')
      .fromTo(dmg, { opacity: 1, y: 40 }, { y: 0, opacity: 0, duration: 0.9, ease: 'power1.out' }, '<')
      .to(unit, { x: 32, y: 38, duration: 0.4, ease: 'power2.out' }, '<')
      .to(aim, { drawSVG: '100% 100%', duration: 0.3 }, '<');
    return tl;
  }

  function profileScene(S) {
    const save = MB.UI.save, st = save.stats;
    const pics = save.avatars.length > 1 ? save.avatars.slice() : MB.AVATARS.slice(0, 6).map((a) => a.id);
    const face = place(el('div', 'mt-face', `<img src="${MB.avatarUrl(save.avatar)}">`), 22, 22);
    S.appendChild(face);
    const img = face.querySelector('img');
    const all = Object.values(st.difficulty).reduce((t, [w, l]) => [t[0] + w, t[1] + l], [0, 0]);
    const rows = [['Wins', all[0], Math.min(1, all[0] / 50)], ['Win rate', (all[0] + all[1] ? Math.round((all[0] / (all[0] + all[1])) * 100) : 0) + '%', all[0] + all[1] ? all[0] / (all[0] + all[1]) : 0],
      ['Best streak', st.bestStreak, Math.min(1, st.bestStreak / 10)]];
    const bars = rows.map(([label, v, f], i) => {
      const r = place(el('div', 'mt-stat', `<span>${label}</span><b>${v}</b><em><i></i></em>`), 158, 26 + i * 42);
      r.dataset.f = Math.max(0.06, f);
      S.appendChild(r);
      return r.querySelector('i');
    });
    S.appendChild(place(el('div', 'mt-pics', `🖼 ${save.avatars.length}/${MB.AVATARS.length}`), 30, 140));
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
    tl.fromTo(bars, { width: '0%' }, { width: (i, b) => b.closest('.mt-stat').dataset.f * 100 + '%', duration: 0.8, stagger: 0.15, ease: 'power2.out' }, 0);
    for (let k = 0; k < 3; k++) {
      tl.to(face, { rotationY: 90, duration: 0.2, ease: 'power1.in' }, 1.2 + k * 1.1)
        .call(() => { img.src = MB.avatarUrl(pick(pics)); })
        .to(face, { rotationY: 0, duration: 0.3, ease: 'back.out(2)' });
    }
    tl.to({}, { duration: 0.8 });
    return tl;
  }

  function quickScene(S) {
    const ids = MB.manifest.characters.map((c) => c.id), a = pick(ids), b = pick(ids.filter((x) => x !== a));
    const left = place(el('div', 'mt-vs-sprite', `<img src="${MB.spriteUrl(a, 'taunt')}">`), 10, 10);
    const right = place(el('div', 'mt-vs-sprite flip', `<img src="${MB.spriteUrl(b, 'taunt')}">`), 210, 10);
    const vs = place(el('div', 'mt-vs', 'VS'), 130, 50);
    S.append(left, right, vs);
    return gsap.timeline({ repeat: -1, repeatDelay: 1 })
      .fromTo(left, { x: -120, opacity: 0 }, { x: 10, opacity: 1, duration: 0.4, ease: 'power3.out' })
      .fromTo(right, { x: 340, opacity: 0 }, { x: 210, opacity: 1, duration: 0.4, ease: 'power3.out' }, '<')
      .fromTo(vs, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
      .to(S, { x: 4, duration: 0.05, repeat: 5, yoyo: true }, '<0.1')
      .to([left, right, vs], { opacity: 0, duration: 0.3 }, '+=1.2');
  }

  function galleryScene(S) {
    const id = pick(units(Object.keys(MB.CARDS).filter((x) => !MB.CARDS[x].token && !MB.cardDef(x).emoji))), d = MB.cardDef(id);
    const unit = place(el('div', 'mt-unit big', `<img src="${MB.spriteUrl(id, 'idle')}">`), 20, 10);
    const svg = el('div', 'mt-svg', `<svg width="${W}" height="${H}"><path class="slash" d="M170,140 L320,20" style="stroke:${d.attack.color}"/></svg>`);
    const name = place(el('div', 'mt-atk', `✦ ${d.attack.name}`), 150, 128);
    name.style.color = d.attack.color;
    S.append(unit, svg, name);
    const slash = svg.querySelector('path');
    return gsap.timeline({ repeat: -1, repeatDelay: 0.4 })
      .set(slash, { drawSVG: '0%' }).set(name, { opacity: 0 })
      .to(unit, { x: 60, duration: 0.3, ease: 'power2.in' })
      .to(slash, { drawSVG: '100%', duration: 0.2 })
      .to(name, { opacity: 1, duration: 0.2 }, '<')
      .to(slash, { drawSVG: '100% 100%', duration: 0.3 })
      .to(unit, { x: 20, duration: 0.4 }, '<')
      .to(name, { opacity: 0, duration: 0.3 }, '+=0.6');
  }

  // today's missions fill up one by one and their Glitter flies into the counter
  function missionsScene(S) {
    const list = MB.UI.save.missions.list.slice(0, 3);
    const bank = place(el('div', 'mt-gold', '✨ 0'), 262, 138);
    const rows = list.map((m, i) => place(el('div', 'mt-mission', `<span>${MB.Missions.text(m)}</span><b><i></i></b><em>✨${m.glitter}</em>`), 12, 12 + i * 42));
    S.append(...rows, bank);
    const sum = { n: 0 };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
    tl.set(rows.map((r) => r.querySelector('i')), { width: '0%' }).set(sum, { n: 0 }).call(() => { bank.textContent = '✨ 0'; })
      .from(rows, { x: -40, opacity: 0, stagger: 0.12, duration: 0.3 });
    rows.forEach((r, i) => {
      const fly = place(el('div', 'mt-frag', '✨'), 300, 20 + i * 42);
      S.appendChild(fly);
      tl.to(r.querySelector('i'), { width: '100%', duration: 0.55, ease: 'power1.inOut' })
        .fromTo(fly, { x: 290, y: 16 + i * 42, opacity: 1, scale: 0.6 }, { x: 280, y: 132, scale: 1.2, duration: 0.4, ease: 'power2.in' })
        .set(fly, { opacity: 0 })
        .to(sum, { n: `+=${list[i].glitter}`, duration: 0.3, onUpdate: () => { bank.textContent = `✨ ${Math.round(sum.n)}`; } }, '<');
    });
    return tl;
  }

  // ---------------------------------------------------------------- the panel
  const TIPS = {
    'btn-story': { scene: story, title: 'Story', text: () => {
      const done = MB.CHAPTERS.reduce((t, _, i) => t + MB.UI.save.progress[i], 0);
      return `Battle each novel's cast, chapter by chapter. Beat a rival to recruit them as a leader, take their card and win new <b>profile pictures</b>.<small>⚔ ${done}/${MB.STORY.length} stages cleared</small>`;
    } },
    'btn-deck': { scene: deckScene, title: 'Deck & Collection', text: () => {
      const cards = MB.Collection.deckCards();
      return `Build up to 3 decks of ${MB.RULES.deckSize} from the cards you own. Cards you don't own yet fill in piece by piece as you collect their <b>🧩 fragments</b>.
        <small>🎴 ${cards.filter(MB.UI.isUnlocked).length}/${cards.length} cards · 🧩 ${Object.keys(MB.UI.save.shards).length} collecting</small>`;
    } },
    'btn-packs': { scene: packScene, title: 'Card Packs', text: () => {
      const n = Object.values(MB.UI.save.packs).reduce((a, b) => a + b, 0), R = MB.RARITY;
      return `Every win earns a pack full of <b>card fragments</b>. Collect enough and the card is yours: rarer cards need more
        (<b style="color:${R.rare.color}">${R.rare.shards}</b> · <b style="color:${R.epic.color}">${R.epic.shards}</b> · <b style="color:${R.legendary.color}">${R.legendary.shards}</b>).
        <small>${n ? `🎁 ${n} pack${n > 1 ? 's' : ''} waiting to be opened!` : '🎁 No packs right now: go win some!'}</small>`;
    } },
    'btn-missions': { scene: missionsScene, title: 'Daily Missions', text: () => {
      const s = MB.UI.save, n = MB.Missions.claimable(s);
      return `Three new missions every day. Finish them in battle for <b>✨ Glitter</b>: craft the exact card you're missing, or make your favorites <b>Shiny</b>.
        <small>✨ ${s.glitter} Glitter${n ? ` · 📅 ${n} mission${n > 1 ? 's' : ''} ready to claim!` : ''}</small>`;
    } },
    'btn-howto': { scene: howtoScene, title: 'How to Play', text: () => 'Gold, summoning, attacking, keywords and relationships, all on one page. Start here if you\'re new!' },
    'btn-profile': { scene: profileScene, title: 'Profile', text: () => `Your name, your profile picture and all your battle <b>stats</b>. New pictures are won in Story.` },
    'btn-quick': { scene: quickScene, title: 'Quick Battle', dev: true, text: () => 'A battle against a random opponent, with no story attached.' },
    'btn-gallery': { scene: galleryScene, title: 'Attack Gallery', dev: true, text: () => 'Preview every attack, relationship fusion and sky on training dummies.' },
  };

  let tip, stage, tl = null, hideCall = null, shownFor = null;
  function bind() {
    tip = el('div', 'menu-tip', '<div class="mt-stage"></div><h3></h3><p></p>');
    $('#screen-title').appendChild(tip);
    stage = tip.querySelector('.mt-stage');
    gsap.set(tip, { autoAlpha: 0 });
    Object.keys(TIPS).forEach((id) => {
      const b = document.getElementById(id);
      b.addEventListener('pointerenter', () => open(id, b));
      b.addEventListener('pointerleave', close);
      b.addEventListener('click', () => hide(true));
    });
  }
  function open(id, btn) {
    if (hideCall) { hideCall.kill(); hideCall = null; }
    if (shownFor === id) return;
    const t = TIPS[id], wasShown = !!shownFor;
    shownFor = id;
    if (tl) tl.kill();
    gsap.killTweensOf(tip);
    stage.innerHTML = '';
    gsap.set(stage, { x: 0 });
    tip.querySelector('h3').innerHTML = t.title + (t.dev ? ' <em>DEV</em>' : '');
    tip.querySelector('p').innerHTML = t.text();
    tip.style.setProperty('--glow', getComputedStyle(btn).getPropertyValue('--glow').trim() || '#b9a4ff');
    tl = t.scene(stage);
    // beside the button, kept on screen
    const root = $('#ui-root').getBoundingClientRect(), s = root.width / 1600, r = btn.getBoundingClientRect();
    const mid = (r.top - root.top + r.height / 2) / s, h = tip.offsetHeight || 320;
    const y = Math.max(20, Math.min(900 - h - 20, mid - h / 2)), x = (r.right - root.left) / s + 40;
    if (wasShown) {
      gsap.to(tip, { y, duration: 0.3, ease: 'power3.out' });
      gsap.fromTo(tip.children, { opacity: 0.2 }, { opacity: 1, duration: 0.25 });
    } else {
      gsap.set(tip, { x, y });
      gsap.fromTo(tip, { autoAlpha: 0, scale: 0.92, rotationY: -25, transformOrigin: '0% 50%' }, { autoAlpha: 1, scale: 1, rotationY: 0, duration: 0.4, ease: 'back.out(1.6)' });
    }
    // the pointer arrow stays level with the button
    tip.style.setProperty('--ay', Math.max(20, Math.min(h - 20, mid - y)) + 'px');
  }
  // a short grace period, so moving from one button to the next doesn't flicker
  function close() {
    if (hideCall) hideCall.kill();
    hideCall = gsap.delayedCall(0.15, () => hide());
  }
  function hide(now) {
    if (hideCall) { hideCall.kill(); hideCall = null; }
    if (!shownFor) return;
    shownFor = null;
    gsap.to(tip, { autoAlpha: 0, x: '-=14', duration: now ? 0.1 : 0.2, onComplete: () => { if (!shownFor && tl) { tl.kill(); tl = null; stage.innerHTML = ''; } } });
  }

  MB.MenuTips = { bind, hide };
})();
