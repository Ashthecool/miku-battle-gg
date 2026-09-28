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
    // the next four fights of the story (the act's last four once it's done)
    const save = MB.UI.save, St = MB.Story, nxt = St.next(save) || St.main[St.main.length - 1];
    const fights = St.main.filter((q) => q.act === nxt.act && q.foe), from = fights.findIndex((q) => !St.isDone(save, q));
    const foes = fights.slice(Math.max(0, Math.min(from < 0 ? fights.length : from, fights.length - 4))).slice(0, 4).map((q) => q.foe);
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
    S.appendChild(place(el('div', 'mt-chap', `Act ${nxt.act + 1} · ${MB.ACTS[nxt.act].title}`), 10, 6));
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

  // the Arena's two modes in turn, under a little copy of its mode switch. Deathpick: two cards are drafted into the
  // deck, then the reward track lights up win by win until a pack drops. Casual PvP: a search, a rival player found,
  // VS, a win and its Glitter.
  function arenaScene(S) {
    const A = MB.ARENA, P = MB.PVP, save = MB.UI.save, pvp = MB.Net.available(), picks = A.picks;
    const pool = Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token && !MB.cardDef(id).emoji);
    const modes = place(el('div', 'mt-modes', `<i></i><span>💀 Deathpick</span>${pvp ? '<span>⚔ Casual PvP</span>' : ''}`), pvp ? 70 : 120, 6);
    const glide = modes.querySelector('i'), tabs = modes.querySelectorAll('span');
    S.appendChild(modes);
    // the sets below give every piece its starting state, so no fromTo may render ahead of its turn
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.2, defaults: { immediateRender: false } });
    const tab = (k) => tl.call(() => tabs.forEach((t, j) => t.classList.toggle('on', j === k)))
      .to(glide, { x: k * 100, duration: 0.3, ease: 'power3.inOut' }, '<');

    // ---- Deathpick
    const stack = place(el('div', 'mt-stack', '<i></i><i></i><i></i><b></b>'), 264, 48), count = stack.querySelector('b');
    const rounds = [0, 1].map(() => [0, 1, 2].map((k) => { const c = place(mini(pick(pool), 0.4), 12 + k * 76, 42); S.appendChild(c); return c; }));
    const nodes = Array.from({ length: A.maxWins + 1 }, (_, w) => `<b style="left:${w * 40}px">${w}</b>`).join('');
    const prize = A.rewards(3).packs[0] || 'common';
    const ladder = place(el('div', 'mt-ladder', `<div><i></i></div>${nodes}<img src="${MB.packArt(prize)}" alt="">`), 22, 78);
    const fill = ladder.querySelector('i'), dots = [...ladder.querySelectorAll('b')], pack = ladder.querySelector('img');
    const bank = place(el('div', 'mt-gold', ''), 136, 136), glit = { n: 0 };
    const showGlit = () => { bank.textContent = `✨ ${Math.round(glit.n)}`; };
    S.append(stack, ladder, bank);
    gsap.set([...rounds.flat(), ladder, bank], { opacity: 0 });
    tl.set(stack, { opacity: 1, scale: 1 }).call(() => { count.textContent = `${picks - 2}/${picks}`; })
      .set([ladder, bank], { opacity: 0 }).set(fill, { width: 0 }).set(pack, { scale: 0, opacity: 0 })
      .call(() => { dots.forEach((d, w) => d.classList.toggle('on', w === 0)); glit.n = A.rewards(0).glitter; showGlit(); });
    tab(0);
    rounds.forEach((cards, r) => {
      const chosen = cards[r ? 2 : 1];
      tl.set(cards, { x: (k) => 12 + k * 76, scale: 1 })
        .fromTo(cards, { y: 120, opacity: 0 }, { y: 42, opacity: 1, duration: 0.3, stagger: 0.07, ease: 'back.out(1.6)' })
        .to(chosen, { y: 30, scale: 1.08, duration: 0.18 }, '+=0.25')
        .to(cards.filter((c) => c !== chosen), { opacity: 0, duration: 0.18 }, '<')
        .to(chosen, { x: 268, y: 52, scale: 0.5, opacity: 0, duration: 0.35, ease: 'power2.in' })
        .call(() => { count.textContent = `${picks - 1 + r}/${picks}`; })
        .fromTo(stack, { scale: 1.15 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    });
    // the deck is ready: on to the battles
    tl.to(stack, { opacity: 0, x: 294, duration: 0.25 }, '+=0.15').set(stack, { x: 264 })
      .fromTo([ladder, bank], { opacity: 0 }, { opacity: 1, duration: 0.3 });
    [1, 2, 3].forEach((w) => {
      tl.to(fill, { width: w * 40, duration: 0.3, ease: 'power1.inOut' }, '+=0.12')
        .call(() => dots[w].classList.add('on'))
        .fromTo(dots[w], { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' })
        .to(glit, { n: A.rewards(w).glitter, duration: 0.3, onUpdate: showGlit }, '<');
    });
    tl.to(pack, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' })
      .to([ladder, bank], { opacity: 0, duration: 0.25 }, '+=0.9');
    if (!pvp) return tl;

    // ---- Casual PvP
    const others = MB.AVATARS.filter((a) => a.id !== save.avatar);
    const player = (cls, src, name) => {
      const n = place(el('div', 'mt-player ' + cls, `<div><img src="${src}" alt=""></div><span></span>`), 0, 0);
      n.querySelector('span').textContent = name; // a player's own name: text, never markup
      return n;
    };
    const me = player('me', MB.avatarUrl(save.avatar), save.name || 'You'), foe = player('foe', MB.avatarUrl(pick(others).id), '???');
    const foeImg = foe.querySelector('img'), foeName = foe.querySelector('span');
    const spin = place(el('div', 'mt-search'), 150, 62), vs = place(el('div', 'mt-vs', 'VS'), 132, 44);
    const cap = place(el('div', 'mt-cap'), 0, 140), coin = place(el('div', 'mt-frag', '✨'), 158, 70);
    S.append(me, foe, spin, vs, cap, coin);
    gsap.set([me, foe, spin, vs, cap, coin], { opacity: 0 });
    tab(1);
    tl.set(me, { x: 24, y: 38 }).set(foe, { x: 236, y: 38, opacity: 0, scale: 1 }).set([me, foe], { filter: 'none' })
      .set([spin, vs, coin], { opacity: 0 })
      .call(() => { cap.textContent = 'Searching…'; foeName.textContent = '???'; })
      .fromTo(me, { x: -60, opacity: 0 }, { x: 24, opacity: 1, duration: 0.35, ease: 'power3.out' })
      .fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.2 }, '<')
      .to(spin, { opacity: 1, duration: 0.2 }, '<')
      .fromTo(spin, { rotation: 0 }, { rotation: 720, duration: 1.2, ease: 'none' }, '<')
      .set(foe, { opacity: 1 }, '<0.3');
    // the rival's picture spins like a slot machine until someone is found
    for (let k = 0; k < 8; k++) tl.call(() => { foeImg.src = MB.avatarUrl(pick(others).id); }, null, k ? '<0.1' : '<');
    tl.call(() => { cap.textContent = 'Matched!'; foeName.textContent = 'Rival'; }, null, '+=0.1')
      .fromTo(foe, { scale: 1.2 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<')
      .to(spin, { opacity: 0, duration: 0.15 }, '<')
      .fromTo(vs, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, '+=0.1')
      .to(S, { x: 4, duration: 0.05, repeat: 5, yoyo: true }, '<0.1')
      .set(S, { x: 0 })
      // you win
      .to(foe, { filter: 'grayscale(1) brightness(.55)', duration: 0.3 }, '+=0.5')
      .fromTo(me, { scale: 1 }, { scale: 1.12, duration: 0.2, yoyo: true, repeat: 1 }, '<')
      .to(vs, { opacity: 0, duration: 0.2 }, '<')
      .call(() => { cap.innerHTML = `🏆 Win · <b>✨ +${P.win}</b>`; })
      .fromTo(coin, { x: 158, y: 70, opacity: 1, scale: 0.6 }, { y: 118, scale: 1.3, duration: 0.4, ease: 'power2.in' })
      .to(coin, { opacity: 0, duration: 0.1 })
      .fromTo(cap, { scale: 1.2 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<')
      .to([me, foe, cap], { opacity: 0, duration: 0.25 }, '+=1');
    return tl;
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

  // today's deals get bought one by one: the Glitter counts down, fragments drop onto each card and it's stamped SOLD
  function shopScene(S) {
    const G = MB.GLITTER, save = MB.UI.save;
    const full = (d) => Math.round(d.n * G.craft[MB.CARDS[d.card].rarity]);
    let deals = ((save.shop && save.shop.deals) || []).slice(0, 3);
    if (!deals.length) deals = [0, 1, 2].map(() => {
      const id = pick(MB.Collection.deckCards().filter((x) => G.craft[MB.CARDS[x].rarity])), n = G.shop.bundle[MB.CARDS[id].rarity] || 1;
      return { card: id, n, price: Math.round(n * G.craft[MB.CARDS[id].rarity] * (1 - G.shop.off)) };
    });
    const total = deals.reduce((t, d) => t + d.price, 0), start = Math.max(save.glitter, total);
    const bank = place(el('div', 'mt-gold', `✨ ${start}`), 262, 8);
    S.appendChild(bank);
    const items = deals.map((d, i) => {
      const x = 14 + i * 84;
      const card = place(mini(d.card, 0.42, !MB.UI.isUnlocked(d.card)), x, 12);
      const tag = place(el('div', 'mt-price', `<s>✨${full(d)}</s> ✨${d.price}`), x - 6, 112);
      const frag = place(el('div', 'mt-frag', `🧩×${d.n}`), x + 8, 30);
      const sold = place(el('div', 'mt-sold', 'SOLD'), x + 4, 46);
      S.append(card, tag, frag, sold);
      return { card, tag, frag, sold, d, x };
    });
    const o = { g: start };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
    tl.set(o, { g: start }).call(() => { bank.textContent = `✨ ${start}`; })
      .set(items.map((it) => it.frag), { opacity: 0 }).set(items.map((it) => it.sold), { opacity: 0, scale: 2.5, rotation: -18 })
      .set(items.map((it) => it.card), { filter: 'brightness(1)' })
      .from(items.map((it) => it.card), { y: 60, opacity: 0, rotationY: -40, duration: 0.4, stagger: 0.1, ease: 'back.out(1.6)' })
      .from(items.map((it) => it.tag), { opacity: 0, y: 10, duration: 0.25, stagger: 0.1 }, '<0.2');
    items.forEach((it) => {
      tl.fromTo(it.tag, { scale: 1 }, { scale: 1.18, duration: 0.12, yoyo: true, repeat: 1 }, '+=0.35')
        .to(o, { g: `-=${it.d.price}`, duration: 0.4, ease: 'power1.out', onUpdate: () => { bank.textContent = `✨ ${Math.round(o.g)}`; } }, '<')
        .fromTo(it.frag, { opacity: 1, y: -20, scale: 0.6 }, { y: 36, scale: 1, duration: 0.35, ease: 'bounce.out' }, '<')
        .to(it.frag, { opacity: 0, duration: 0.15 })
        .fromTo(it.card, { filter: 'brightness(2)' }, { filter: 'brightness(0.55)', duration: 0.4 }, '<')
        .to(it.sold, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)' }, '<');
    });
    tl.to({}, { duration: 0.8 });
    return tl;
  }

  // ---------------------------------------------------------------- the panel
  const TIPS = {
    'btn-story': { scene: story, title: 'Story', text: () => {
      const s = MB.UI.save, St = MB.Story, side = St.quests.filter((q) => q.side && !St.hidden(q));
      return `One story through every novel's world, told on a map. Beat a rival to recruit them as a leader and win 🎁 <b>card packs</b>, 🧩 <b>fragments</b> of their card and new <b>profile pictures</b>. Side quests pop up along the way.`
        + `<small>📖 ${St.main.filter((q) => St.isDone(s, q)).length}/${St.main.length} story quests · 📜 ${side.filter((q) => St.isDone(s, q)).length}/${side.length} side quests</small>`;
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
    'btn-arena': { scene: arenaScene, title: 'Arena', text: () => {
      const s = MB.UI.save, a = s.arena, A = MB.ARENA, p = s.pvp, pvp = MB.Net.available();
      const dp = `<b>💀 Deathpick</b>: draft a deck from <b>every card in the game</b>, owned or not, then battle until ${A.maxWins} wins or ${A.maxLosses} losses. More wins, bigger rewards.`;
      return (pvp ? `${dp}<br><b>⚔ Casual PvP</b>: your own deck against other players, for <b>✨ Glitter</b> every match.` : dp)
        + `<small>${a ? (a.stage === 'done' ? '🎁 Your run is over: claim the rewards!' : a.stage === 'run' ? `💀 Run in progress: ${a.wins} wins · ${a.losses} losses` : '🂠 Draft in progress')
          : s.arenaRuns ? `🏆 Best run: ${s.arenaBest} wins` : '💀 No runs yet'}${pvp && p && p.wins + p.losses ? ` · ⚔ PvP ${p.wins}-${p.losses}` : ''}</small>`;
    } },
    'btn-shop': { scene: shopScene, title: 'Shop', text: () => {
      const s = MB.UI.save, left = ((s.shop && s.shop.deals) || []).filter((d) => MB.Shop.dealCost(s, d)).length;
      return `Spend <b>✨ Glitter</b> on fresh <b>🧩 fragment deals</b> every day, ${Math.round(MB.GLITTER.shop.off * 100)}% cheaper than crafting, or on card packs. You can also craft the exact fragments you need and level up cards you own.
        <small>✨ ${s.glitter} Glitter · ${left ? `🛒 ${left} deal${left > 1 ? 's' : ''} left today` : '🛒 All of today\'s deals are gone'}</small>`;
    } },
    'btn-missions': { scene: missionsScene, title: 'Daily Missions', text: () => {
      const s = MB.UI.save, n = MB.Missions.claimable(s);
      return `Three new missions every day. Finish them in battle for <b>✨ Glitter</b>: craft the exact card you're missing, or make your favorites <b>Shiny</b>.
        <small>✨ ${s.glitter} Glitter${n ? ` · 📅 ${n} mission${n > 1 ? 's' : ''} ready to claim!` : ''}</small>`;
    } },
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
