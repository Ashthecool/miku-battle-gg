// Card close-up modal (right-click any card), new-card reveals and screen-space particle FX.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const root = () => document.getElementById('ui-root');
  const W = 160, H = 220; // base card size

  // window px -> ui-root (1600x900) units
  function toUi(cx, cy) {
    const rr = root().getBoundingClientRect(), s = rr.width / 1600;
    return { x: (cx - rr.left) / s, y: (cy - rr.top) / s, s };
  }
  function rectOf(node) {
    const r = node.getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top + r.height / 2);
    return { x: p.x, y: p.y, w: r.width / p.s, h: r.height / p.s };
  }

  // persistent layer above everything for particles and flying cards
  let fx = null;
  const fxLayer = () => fx || (fx = root().appendChild(el('div', '', '')), fx.id = 'ui-fx', fx);

  // ---------------------------------------------------------------- particles
  function spray(layer, x, y, color, n, { dist = [80, 320], size = [5, 14], dur = [0.6, 1.3], stars = 0.3, gravity = 60 } = {}) {
    for (let i = 0; i < n; i++) {
      const star = Math.random() < stars;
      const p = el('div', star ? 'fx-star' : 'fx-pt', star ? '✦' : null);
      const sz = rnd(size[0], size[1]);
      p.style.setProperty('--c', color);
      if (star) p.style.fontSize = sz * 2.2 + 'px'; else { p.style.width = p.style.height = sz + 'px'; }
      layer.appendChild(p);
      const a = rnd(0, Math.PI * 2), d = rnd(dist[0], dist[1]), t = rnd(dur[0], dur[1]);
      gsap.set(p, { x, y, xPercent: -50, yPercent: -50, scale: rnd(0.6, 1.3) });
      gsap.to(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + gravity, rotation: rnd(-360, 360), duration: t, ease: 'power3.out' });
      gsap.to(p, { opacity: 0, scale: 0, duration: t * 0.5, delay: t * 0.5, ease: 'power1.in', onComplete: () => p.remove() });
    }
  }
  // particles sucked into a point (charge-up)
  function converge(layer, x, y, color, n, dur = 0.7) {
    for (let i = 0; i < n; i++) {
      const p = el('div', 'fx-pt');
      p.style.setProperty('--c', color);
      p.style.width = p.style.height = rnd(4, 10) + 'px';
      layer.appendChild(p);
      const a = rnd(0, Math.PI * 2), d = rnd(260, 520);
      gsap.fromTo(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, xPercent: -50, yPercent: -50, opacity: 0, scale: 1.6 },
        { x, y, opacity: 1, scale: 0.4, duration: rnd(dur * 0.6, dur), delay: rnd(0, dur * 0.5), ease: 'power2.in', onComplete: () => p.remove() });
    }
  }
  function ring(layer, x, y, color, { size = 120, scale = 6, dur = 0.7, width = 6 } = {}) {
    const r = el('div', 'fx-ring');
    r.style.setProperty('--c', color);
    Object.assign(r.style, { width: size + 'px', height: size + 'px', borderWidth: width + 'px' });
    layer.appendChild(r);
    gsap.fromTo(r, { x, y, xPercent: -50, yPercent: -50, scale: 0.1, opacity: 1 },
      { scale, opacity: 0, duration: dur, ease: 'power2.out', onComplete: () => r.remove() });
  }
  // ambient rising motes; returns a stopper
  function motes(layer, box, color, every) {
    let alive = true;
    const spawn = () => {
      if (!alive) return;
      const p = el('div', Math.random() < 0.35 ? 'fx-star' : 'fx-pt', null);
      if (p.className === 'fx-star') { p.textContent = '✦'; p.style.fontSize = rnd(12, 22) + 'px'; } else p.style.width = p.style.height = rnd(4, 9) + 'px';
      p.style.setProperty('--c', color);
      layer.appendChild(p);
      const x = rnd(box.x0, box.x1), y = rnd(box.y0, box.y1), t = rnd(2, 3.5);
      gsap.fromTo(p, { x, y, xPercent: -50, yPercent: -50, opacity: 0, scale: 0.4 },
        { x: x + rnd(-50, 50), y: y - rnd(140, 300), opacity: 1, scale: 1, duration: t, ease: 'sine.out', onComplete: () => p.remove() });
      gsap.to(p, { opacity: 0, duration: t * 0.4, delay: t * 0.6 });
      gsap.delayedCall(rnd(every * 0.5, every * 1.5), spawn);
    };
    spawn();
    return () => { alive = false; };
  }
  const burst = (cx, cy, color, n = 20) => { const p = toUi(cx, cy); spray(fxLayer(), p.x, p.y, color, n, { dist: [40, 160], size: [4, 10], dur: [0.4, 0.8], gravity: 30 }); };

  // ---------------------------------------------------------------- helpers
  const defOf = (id) => MB.cardDef(id);
  const rarityOf = (def) => MB.RARITY[def.rarity] || MB.RARITY.common;
  const starStr = (r) => [1, 2, 3, 4].map((i) => `<i class="${i <= r.stars ? 'on' : ''}">★</i>`).join('');
  function bigCard(card, stats) {
    const def = card.cid ? card : defOf(card.id || card);
    const c = MB.UI.cardEl(card);
    if (stats && def.type === 'unit') {
      const a = c.querySelector('.stat.atk'), h = c.querySelector('.stat.hp');
      a.textContent = stats.atk; h.textContent = Math.max(0, stats.hp);
      if (stats.atk > def.atk) a.classList.add('up'); if (stats.atk < def.atk) a.classList.add('down');
      if (stats.hp < def.hp) h.classList.add('down'); if (stats.hp > def.hp) h.classList.add('up');
    }
    c.appendChild(el('div', 'glare'));
    return { c, def };
  }

  // ---------------------------------------------------------------- close-up modal
  let modal = null;
  // the close-up card is laid out at CARD_S with CSS zoom so the art rasterizes at full resolution;
  // pivot scale 1 = close-up size
  const CARD_X = 430, CARD_Y = 450, CARD_S = 2.15;
  const FULL_W = W * CARD_S;

  function open(card, fromEl, stats) {
    if (modal) return close().then(() => open(card, fromEl, stats));
    const { c, def } = bigCard(card, stats);
    const locked = !MB.UI.isUnlocked(def.id) && def.rarity !== 'token' && !def.fused;
    if (locked) MB.UI.lockCard(c);
    const r = rarityOf(def), col = r.color, lvl = Math.max(1, r.stars);
    const from = fromEl && fromEl.isConnected ? rectOf(fromEl) : { x: CARD_X, y: CARD_Y + 300, w: W, h: H };

    const ov = el('div', 'cm', `
      <div class="cm-backdrop"></div>
      <div class="cm-rays"></div>
      ${def.type === 'unit' && !def.emoji && !def.fused ? `<img class="cm-sprite" src="${MB.spriteUrl(def.id, locked ? 'idle' : 'taunt')}">` : ''}
      <div class="cm-pivot"><div class="cm-tilt"></div></div>
      <div class="cm-info"></div>
      <div class="cm-fx"></div>
      <div class="cm-hint">Right-click, Esc or click outside to close · move the mouse to tilt</div>`);
    ov.style.setProperty('--rc', col);
    ov.classList.toggle('locked', locked);
    root().appendChild(ov);
    const pivot = ov.querySelector('.cm-pivot'), tilt = ov.querySelector('.cm-tilt'), layer = ov.querySelector('.cm-fx');
    const rays = ov.querySelector('.cm-rays'), sprite = ov.querySelector('.cm-sprite'), info = ov.querySelector('.cm-info');
    c.classList.add('cm-card');
    c.style.zoom = CARD_S;
    Object.assign(pivot.style, { width: FULL_W + 'px', height: H * CARD_S + 'px' });
    tilt.appendChild(c);
    info.innerHTML = infoHtml(def, r, locked, stats);
    info.querySelectorAll('[data-costume]').forEach((btn) => btn.addEventListener('click', () => {
      MB.audio.sfx('buff');
      MB.UI.setCostume(def.id, btn.dataset.costume);
      info.querySelectorAll('[data-costume]').forEach((x) => x.classList.toggle('on', x === btn));
      const art = c.querySelector('.card-art img');
      if (art) art.src = MB.spriteUrl(def.id, 'idle');
      if (sprite) {
        sprite.src = MB.spriteUrl(def.id, 'taunt');
        gsap.fromTo(sprite, { filter: 'brightness(3) drop-shadow(0 0 30px #fff)' }, { filter: '', duration: 0.6, clearProps: 'filter' });
      }
      spray(layer, CARD_X, CARD_Y, col, 24, { dist: [120, 320] });
    }));

    // only real card elements get hidden while their close-up is open (board sprites stay visible)
    const hideEl = fromEl && fromEl.classList.contains('card') ? fromEl : null;
    modal = { ov, pivot, tilt, c, from, fromEl, hideEl, stop: null, tweens: [] };
    MB.audio.sfx('draw');
    if (hideEl) gsap.set(hideEl, { opacity: 0 });
    gsap.set(pivot, { xPercent: -50, yPercent: -50 });
    gsap.set(tilt, { transformPerspective: 1000 });

    const tl = gsap.timeline({ onComplete: () => startIdle(lvl, col) });
    tl.fromTo(ov.querySelector('.cm-backdrop'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0)
      .fromTo(pivot, { x: from.x, y: from.y, scale: from.w / FULL_W }, { x: CARD_X, y: CARD_Y, scale: 1, duration: 0.75, ease: 'expo.out' }, 0)
      .fromTo(tilt, { rotationY: -200, rotationZ: -12 }, { rotationY: 0, rotationZ: 0, duration: 0.9, ease: 'back.out(1.3)' }, 0)
      .call(() => {
        MB.audio.sfx(lvl >= 3 ? 'sparkle' : 'play');
        spray(layer, CARD_X, CARD_Y, col, 14 + lvl * 10, { dist: [180, 420] });
        ring(layer, CARD_X, CARD_Y, col, { size: 200, scale: 3 + lvl * 0.5 });
        if (lvl >= 4) gsap.fromTo(ov, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.2)', clearProps: 'x' });
      }, null, 0.45)
      .fromTo(rays, { opacity: 0, scale: 0.3 }, { opacity: 0.12 + lvl * 0.13, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.35)
      .fromTo(info.children, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, 0.3)
      .fromTo(ov.querySelector('.cm-hint'), { opacity: 0 }, { opacity: 0.6, duration: 0.5 }, 0.8);
    if (sprite) tl.fromTo(sprite, { x: 260, opacity: 0 }, { x: 0, opacity: locked ? 1 : 0.95, duration: 0.8, ease: 'power3.out' }, 0.15);
    modal.tl = tl;

    ov.addEventListener('pointermove', onTilt);
    ov.addEventListener('pointerdown', (e) => { if (e.button === 0 && !e.target.closest('.cm-card, .cm-info')) close(); });
  }

  function startIdle(lvl, col) {
    if (!modal) return;
    const m = modal;
    m.tweens.push(gsap.to(m.ov.querySelector('.cm-rays'), { rotation: 360, duration: 40 - lvl * 6, repeat: -1, ease: 'none' }));
    m.tweens.push(gsap.to(m.pivot, { y: CARD_Y - 12, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    const sp = m.ov.querySelector('.cm-sprite');
    if (sp) m.tweens.push(gsap.to(sp, { y: -10, duration: 2.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    m.stop = motes(m.ov.querySelector('.cm-fx'), { x0: CARD_X - 220, x1: CARD_X + 220, y0: CARD_Y + 120, y1: CARD_Y + 260 }, col, 0.7 / lvl);
    m.qx = gsap.quickTo(m.tilt, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    m.qy = gsap.quickTo(m.tilt, 'rotationX', { duration: 0.5, ease: 'power3.out' });
  }

  function onTilt(e) {
    if (!modal || !modal.qx) return;
    const p = toUi(e.clientX, e.clientY);
    const dx = Math.max(-1, Math.min(1, (p.x - CARD_X) / 380)), dy = Math.max(-1, Math.min(1, (p.y - CARD_Y) / 380));
    modal.qx(dx * 22); modal.qy(-dy * 18);
    modal.c.style.setProperty('--gx', 50 + dx * 50 + '%');
    modal.c.style.setProperty('--gy', 50 + dy * 50 + '%');
  }

  function close() {
    if (!modal || modal.closing) return Promise.resolve();
    const m = modal;
    m.closing = true;
    if (m.stop) m.stop();
    m.tl.kill(); m.tweens.forEach((t) => t.kill());
    MB.audio.sfx('whoosh');
    const back = m.hideEl && m.hideEl.isConnected ? rectOf(m.hideEl) : null;
    return new Promise((res) => {
      const tl = gsap.timeline({ onComplete: () => { m.ov.remove(); if (m.hideEl) gsap.set(m.hideEl, { opacity: 1 }); if (modal === m) modal = null; res(); } });
      tl.to(m.ov.querySelectorAll('.cm-info, .cm-hint, .cm-rays, .cm-sprite'), { opacity: 0, duration: 0.2 }, 0)
        .to(m.tilt, { rotationX: 0, rotationY: 0, rotationZ: back ? 0 : 20, duration: 0.4, ease: 'power2.in' }, 0)
        .to(m.pivot, back ? { x: back.x, y: back.y, scale: back.w / FULL_W, duration: 0.4, ease: 'power3.inOut' }
          : { y: CARD_Y + 200, scale: 0.4, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0)
        .to(m.ov.querySelector('.cm-backdrop'), { opacity: 0, duration: 0.3 }, 0.1);
    });
  }

  function infoHtml(def, r, locked, stats) {
    const kw = (def.kw || []).map((k) => `<div class="cm-kw"><b>${MB.KEYWORDS[k].icon} ${MB.KEYWORDS[k].name}</b> ${MB.KEYWORDS[k].text}</div>`).join('');
    const ch = MB.charById(def.id), item = MB.manifest.items.find((i) => i.id === def.id);
    const bio = def.fused ? `${def.members.map((m) => MB.charById(m.id).name).join(' & ')} — ${def.bond.relation}.`
      : ch ? ch.short : item && item.desc ? item.desc : def.type === 'spell' ? 'An item from the novel\'s inventory.' : '';
    const inDeck = MB.UI.save.deck.filter((d) => d === def.id).length;
    const atk = stats ? stats.atk : def.atk, hp = stats ? Math.max(0, stats.hp) : def.hp;
    let own;
    if (def.fused) own = `<div class="cm-own">💞 ${MB.BOND_TIERS[def.bond.tier].name} fusion — formed when both partners share the board.</div>`;
    else if (def.rarity === 'token') own = '<div class="cm-own">Token — created by other cards, never in decks.</div>';
    else if (locked) own = `<div class="cm-own lockedtxt">🔒 Not in your collection yet.<br>Win a battle for a <b>${(MB.UI.dropChance(def.id) * 100).toFixed(1)}%</b> chance to find it${MB.STORY.some((s) => s.foe === def.id) ? ' — or beat them in Story' : ''}.</div>`;
    else own = `<div class="cm-own">✔ In your collection · ${inDeck}/${MB.UI.maxCopies(def.id)} in deck</div>`;
    return `
      <div class="cm-rarity"><span class="stars">${starStr(r)}</span> ${r.name.toUpperCase()}</div>
      <h2>${def.name}</h2>
      <div class="cm-type">${def.type === 'spell' ? 'Item' : 'Character'} · <span class="cm-cost">${def.cost}</span> gold</div>
      ${def.type === 'unit' ? `<div class="cm-stats"><span class="a">⚔ ${atk} ATK</span><span class="h">❤ ${hp} HP</span></div>` : ''}
      ${bio ? `<p class="cm-bio">${bio}</p>` : ''}
      ${kw ? `<div class="cm-kws">${kw}</div>` : ''}
      ${def.text ? `<div class="cm-text">${def.text}</div>` : ''}
      ${def.rival ? `<div class="cm-text">⚔ Rival of <b>${defOf(def.rival).name}</b>: they deal each other double damage.</div>` : ''}
      ${bondsHtml(def)}
      ${!locked && !def.fused ? wardrobeHtml(def) : ''}
      ${def.type === 'unit' && def.attack.name ? `<div class="cm-attack" style="--c:${def.attack.color}">✦ ${def.attack.name}</div>` : ''}
      ${own}`;
  }

  // relationships this character can fuse through
  function bondsHtml(def) {
    if (def.type !== 'unit' || def.fused) return '';
    const rows = MB.bondsOf(def.id).map((b) => {
      const other = b.pair.find((id) => id !== def.id);
      return `<div class="cm-bond"><i>${MB.BOND_TIERS[b.tier].hearts}</i><b>${b.name}</b> with ${MB.charById(other).name} · ${b.relation}</div>`;
    });
    return rows.length ? `<div class="cm-bonds">${rows.join('')}</div>` : '';
  }
  function wardrobeHtml(def) {
    const list = def.type === 'unit' ? MB.UI.costumesOf(def.id) : [];
    if (!list.length) return '';
    const cur = MB.UI.save.costumes[def.id] || '';
    const btn = (id, name) => `<button data-costume="${id}" class="${id === cur ? 'on' : ''}">${name}</button>`;
    return `<div class="cm-wardrobe"><span>👗 Wardrobe</span>${btn('', MB.charById(def.id).outfit)}${list.map((o) => btn(o.id, o.name)).join('')}</div>`;
  }

  // ---------------------------------------------------------------- new card reveal
  let revealing = false;
  async function reveal(ids) {
    if (!ids.length) return;
    revealing = true;
    const ov = el('div', 'rv', `<div class="rv-bg"></div><div class="rv-rays"></div><div class="rv-fx"></div>
      <div class="rv-title"></div><div class="rv-sub"></div><div class="rv-hint">Click to continue</div><div class="rv-flash"></div>`);
    root().appendChild(ov);
    gsap.fromTo(ov.querySelector('.rv-bg'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    for (let i = 0; i < ids.length; i++) await revealOne(ov, ids[i], i, ids.length);
    await gsap.to(ov, { opacity: 0, duration: 0.35 });
    ov.remove();
    revealing = false;
  }

  function revealOne(ov, id, i, n) {
    const def = defOf(id), r = rarityOf(def), col = r.color, lvl = Math.max(1, r.stars);
    const X = 800, Y = 440, S = 1.9;
    const layer = ov.querySelector('.rv-fx'), rays = ov.querySelector('.rv-rays'), flash = ov.querySelector('.rv-flash');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub'), hint = ov.querySelector('.rv-hint');
    ov.style.setProperty('--rc', col);
    const glow = el('div', 'rv-glow');
    const back = el('div', 'rv-back', '<div class="rv-back-emblem">✦</div>');
    const { c: card } = bigCard(id);
    card.style.zoom = S;
    const front = el('div', 'rv-front');
    Object.assign(front.style, { width: W * S + 'px', height: H * S + 'px' });
    front.appendChild(card);
    ov.insertBefore(glow, layer); ov.insertBefore(back, layer); ov.insertBefore(front, layer);
    gsap.set([glow, back, front], { x: X, y: Y, xPercent: -50, yPercent: -50 });
    gsap.set(front, { rotationY: -90, opacity: 0, transformPerspective: 1200 });
    gsap.set(glow, { opacity: 0 });
    title.textContent = r.name.toUpperCase() + '!';
    title.style.color = col;
    sub.innerHTML = `<b>${def.name}</b> joined your collection${n > 1 ? ` <small>(${i + 1}/${n})</small>` : ''}`;
    gsap.set([title, sub, hint], { opacity: 0 });

    let stopMotes = null;
    const idle = [];
    const tl = gsap.timeline();
    // 1. the pack drops in
    tl.call(() => MB.audio.sfx('whoosh'))
      .fromTo(back, { y: -300, rotation: -35, scale: 0.4 }, { y: Y, rotation: 0, scale: 1, duration: 0.7, ease: 'back.out(1.5)' })
      .call(() => { MB.audio.sfx('hit'); spray(layer, X, Y + 200, '#ffffff', 16, { dist: [40, 200], size: [3, 8], gravity: -20, stars: 0 }); });
    // 2. charge-up: longer and wilder for rarer cards
    const charge = 0.35 + lvl * 0.3;
    tl.addLabel('charge', '+=0.15')
      .fromTo(glow, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 + lvl * 0.2, duration: charge, ease: 'power1.in' }, 'charge')
      .fromTo(back, { x: X - 3 * lvl }, { x: X + 3 * lvl, duration: 0.05, repeat: Math.round(charge / 0.05), yoyo: true, ease: 'none' }, 'charge')
      .call(() => converge(layer, X, Y, col, 18 * lvl, charge), null, 'charge');
    for (let k = 0; k < lvl; k++) tl.call(() => MB.audio.sfx('sparkle'), null, `charge+=${(charge / lvl) * k}`);
    // 3. flip + explosion
    tl.set(back, { x: X }, 'charge+=' + charge)
      .to(back, { rotationY: 90, scale: 1.1, duration: 0.14, ease: 'power2.in' })
      .set(back, { opacity: 0 })
      .to(glow, { opacity: 0.55, scale: 1.3, duration: 0.5 }, '<')
      .call(() => {
        MB.audio.sfx(lvl >= 4 ? 'win' : lvl >= 2 ? 'buff' : 'play');
        if (lvl >= 3) MB.audio.sfx('slam');
        spray(layer, X, Y, col, 30 + lvl * 20, { dist: [150, 520], size: [6, 16], dur: [0.8, 1.6] });
        spray(layer, X, Y, '#ffffff', 10 + lvl * 6, { dist: [100, 380], size: [3, 7] });
        ring(layer, X, Y, col, { size: 160, scale: 5 + lvl, dur: 0.9, width: 8 });
        if (lvl >= 3) ring(layer, X, Y, '#ffffff', { size: 120, scale: 4 + lvl, dur: 0.7, width: 4 });
        if (lvl >= 3) gsap.fromTo(ov, { x: -14, y: 6 }, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.15)', clearProps: 'x,y' });
      })
      .fromTo(flash, { opacity: 0 }, { opacity: 0.4 + lvl * 0.15, duration: 0.06 }, '<')
      .to(flash, { opacity: 0, duration: 0.6, ease: 'power2.out' })
      .to(front, { rotationY: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' }, '<')
      .fromTo(rays, { opacity: 0, scale: 0.2 }, { opacity: 0.15 + lvl * 0.15, scale: 1, duration: 0.9, ease: 'power2.out' }, '<')
      .fromTo(title, { opacity: 0, scale: 3, letterSpacing: '40px' }, { opacity: 1, scale: 1, letterSpacing: '10px', duration: 0.6, ease: 'back.out(1.6)' }, '<0.1')
      .fromTo(sub, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, '<0.3')
      .call(() => {
        idle.push(gsap.to(rays, { rotation: '+=360', duration: 30 - lvl * 4, repeat: -1, ease: 'none' }));
        idle.push(gsap.to(front, { y: Y - 12, rotationY: 8, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        stopMotes = motes(layer, { x0: X - 240, x1: X + 240, y0: Y + 100, y1: Y + 240 }, col, 0.6 / lvl);
      })
      .to(hint, { opacity: 0.75, duration: 0.4 }, '+=0.2');

    return new Promise((res) => {
      const onClick = (e) => {
        if (e.button !== 0) return;
        if (tl.progress() < 1) { tl.progress(1); return; } // first click skips ahead
        ov.removeEventListener('pointerdown', onClick);
        if (stopMotes) stopMotes();
        idle.forEach((t) => t.kill());
        MB.audio.sfx('coin');
        gsap.timeline({ onComplete: () => { glow.remove(); back.remove(); front.remove(); res(); } })
          .to([title, sub, hint], { opacity: 0, duration: 0.2 }, 0)
          .to([rays, glow], { opacity: 0, duration: 0.3 }, 0)
          .to(front, { x: 1480, y: 60, scale: 0.25, rotation: 25, opacity: 0, duration: 0.55, ease: 'power3.in' }, 0);
      };
      ov.addEventListener('pointerdown', onClick);
    });
  }

  // ---------------------------------------------------------------- deck builder: card flies into the list
  function flyToDeck(cardNode, target) {
    const from = rectOf(cardNode), to = rectOf(target);
    const ghost = MB.UI.cardEl(cardNode.dataset.id);
    ghost.classList.add('fly-ghost');
    fxLayer().appendChild(ghost);
    const tx = to.x, ty = to.y - to.h / 2 + 40;
    gsap.set(ghost, { x: from.x, y: from.y, xPercent: -50, yPercent: -50 });
    gsap.timeline({ onComplete: () => ghost.remove() })
      .to(ghost, { y: from.y - 40, scale: 1.12, rotation: -6, duration: 0.15, ease: 'power2.out' })
      .to(ghost, { x: tx, y: ty, scale: 0.3, rotation: 12, opacity: 0.2, duration: 0.45, ease: 'power3.in' })
      .call(() => spray(fxLayer(), tx, ty, MB.RARITY[MB.CARDS[cardNode.dataset.id].rarity].color, 14, { dist: [30, 120], size: [4, 9], dur: [0.4, 0.8], gravity: 20 }));
  }

  // ---------------------------------------------------------------- input
  function bind() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const v = MB.view;
      if (v && (v.aiming || v.drag) || revealing) return; // the battle view cancels its own aim
      if (modal) { close(); return; }
      const cardNode = e.target.closest('.card');
      if (cardNode && cardNode.dataset.id && !cardNode.closest('.cm')) {
        const cid = +cardNode.dataset.cid;
        const hand = cid && MB.battle ? MB.battle.me(0).hand.find((h) => h.cid === cid) : null;
        open(hand || cardNode.dataset.id, cardNode);
        return;
      }
      const uEl = e.target.closest('.unit');
      const ent = uEl && MB.battle && MB.battle.find(uEl.dataset.uid);
      if (ent && !ent.isLeader && ent.card) {
        MB.UI.preview(null);
        open(ent.card, uEl.querySelector('.duo-sprite, .sprite, .emoji-sprite'), { atk: ent.atk, hp: ent.hp });
      }
    });
    // while the modal is up it owns the keyboard (no accidental End Turn)
    window.addEventListener('keydown', (e) => {
      if (!modal) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
    }, true);
  }

  MB.Cards = { bind, open, close, reveal, flyToDeck, burst };
})();
