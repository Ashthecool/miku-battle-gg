// Card close-up modal (right-click any card), pack opening, new-card reveals and screen-space particle FX.
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
    const c = MB.UI.cardEl(card, true);
    if (stats && def.type === 'unit') {
      const a = c.querySelector('.stat.atk'), h = c.querySelector('.stat.hp');
      a.textContent = stats.atk; h.textContent = Math.max(0, stats.hp);
      if (stats.atk > def.atk) a.classList.add('up'); if (stats.atk < def.atk) a.classList.add('down');
      if (stats.hp < def.hp) h.classList.add('down'); if (stats.hp > def.hp) h.classList.add('up');
    }
    c.appendChild(el('div', 'glare'));
    return { c, def };
  }

  // ---------------------------------------------------------------- close-up entrances
  // Every attack style has its own way of stepping into the close-up. Sizes are measured inside .call()s:
  // the big sprite may still be loading when the timeline is built.
  const SPRITE_OP = 0.95;
  const spot = (sp) => ({ x: sp.offsetLeft + sp.offsetWidth / 2, y: sp.offsetTop + sp.offsetHeight * 0.42,
    top: sp.offsetTop, bottom: sp.offsetTop + sp.offsetHeight, w: sp.offsetWidth });
  const shake = (ov, s) => gsap.fromTo(ov, { x: -s, y: s / 2 }, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.2)', clearProps: 'x,y' });
  function fxEl(layer, cls, html, color) {
    const e = el('div', cls, html);
    if (color) e.style.setProperty('--c', color);
    layer.appendChild(e);
    return e;
  }
  // a shouted word that pops and floats off
  function word(layer, x, y, text, color, size = 54) {
    const t = fxEl(layer, 'cm-word', text, color);
    t.style.fontSize = size + 'px';
    gsap.timeline({ onComplete: () => t.remove() })
      .fromTo(t, { x, y, xPercent: -50, yPercent: -50, scale: 0.2, rotation: rnd(-10, 10) }, { scale: 1, duration: 0.3, ease: 'back.out(3)' })
      .to(t, { y: y - 70, opacity: 0, duration: 0.5, delay: 0.55 });
  }
  // emoji flung out from a point
  function fling(layer, x, y, chars, n, { dist = [120, 380], size = [26, 48], gravity = 140 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = fxEl(layer, 'cm-emoji', MB.pick(chars));
      p.style.fontSize = rnd(size[0], size[1]) + 'px';
      const a = rnd(0, Math.PI * 2), d = rnd(dist[0], dist[1]), t = rnd(0.9, 1.5);
      gsap.set(p, { x, y, xPercent: -50, yPercent: -50 });
      gsap.to(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + gravity, rotation: rnd(-240, 240), duration: t, ease: 'power2.out' });
      gsap.to(p, { opacity: 0, duration: t * 0.4, delay: t * 0.6, onComplete: () => p.remove() });
    }
  }
  // emoji falling from above the screen onto a floor line
  function rain(layer, x0, x1, floor, chars, n, spread = 0.9) {
    for (let i = 0; i < n; i++) {
      const p = fxEl(layer, 'cm-emoji', MB.pick(chars));
      p.style.fontSize = rnd(26, 46) + 'px';
      const x = rnd(x0, x1), t = rnd(0.7, 1.2);
      gsap.fromTo(p, { x, y: -80, xPercent: -50, yPercent: -50, rotation: rnd(-90, 90) },
        { y: floor - rnd(0, 140), rotation: `+=${rnd(-360, 360)}`, duration: t, delay: rnd(0, spread), ease: 'power2.in',
          onComplete: () => gsap.to(p, { y: '-=30', opacity: 0, duration: 0.35, ease: 'power1.out', onComplete: () => p.remove() }) });
    }
  }
  // emoji circling in on a point, then scattering
  function swirl(layer, x, y, chars, n, dur = 1) {
    for (let i = 0; i < n; i++) {
      const p = fxEl(layer, 'cm-emoji', MB.pick(chars));
      p.style.fontSize = rnd(24, 40) + 'px';
      const a0 = (i / n) * Math.PI * 2, r0 = rnd(260, 380), o = { k: 0 };
      gsap.set(p, { xPercent: -50, yPercent: -50 });
      gsap.to(o, { k: 1, duration: dur, delay: i * 0.02, ease: 'sine.inOut', onUpdate: () => {
        const r = r0 * (1 - o.k * 0.75), a = a0 + o.k * 5;
        gsap.set(p, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.8, rotation: o.k * 540, opacity: Math.min(1, o.k * 4) });
      }, onComplete: () => gsap.to(p, { x: `+=${rnd(-260, 260)}`, y: `+=${rnd(-260, 200)}`, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => p.remove() }) });
    }
  }
  // fading copy of the sprite where it is right now (for dashes)
  function afterimage(sp) {
    const now = performance.now();
    if (sp._aft && now - sp._aft < 40) return;
    sp._aft = now;
    const g = sp.cloneNode();
    g.classList.add('cm-after');
    sp.before(g);
    gsap.set(g, { x: gsap.getProperty(sp, 'x'), skewX: gsap.getProperty(sp, 'skewX'), opacity: 0.55 });
    gsap.to(g, { opacity: 0, duration: 0.3, onComplete: () => g.remove() });
  }
  function lightning(layer, x, color) {
    let px = 40, pts = `${px},0`;
    for (let y = 0; y < 900; y += rnd(40, 90)) { px = 40 + rnd(-34, 34); pts += ` ${px},${y}`; }
    const b = fxEl(layer, 'cm-bolt', `<svg width="80" height="900" viewBox="0 0 80 900"><polyline points="${pts} 40,900" stroke="${color}" stroke-width="14" fill="none" opacity=".7"/><polyline points="${pts} 40,900" stroke="#fff" stroke-width="4" fill="none"/></svg>`);
    gsap.set(b, { x: x - 40, y: 0 });
    gsap.to(b, { opacity: 0, duration: 0.25, delay: 0.08, onComplete: () => b.remove() });
  }
  function screenFlash(layer, color, o = 0.5) {
    const f = fxEl(layer, 'cm-flash', '', color);
    gsap.fromTo(f, { opacity: o }, { opacity: 0, duration: 0.35, onComplete: () => f.remove() });
  }
  // embers or droplets rising from a floor line
  function riseFrom(layer, x, floor, colors, n, dur = 1) {
    for (let i = 0; i < n; i++) {
      const p = fxEl(layer, 'fx-pt', null, MB.pick(colors));
      p.style.width = p.style.height = rnd(6, 16) + 'px';
      const px = x + rnd(-230, 230), t = rnd(0.7, 1.3);
      gsap.fromTo(p, { x: px, y: floor, xPercent: -50, yPercent: -50 },
        { x: px + rnd(-60, 60), y: floor - rnd(260, 720), duration: t, delay: rnd(0, dur * 0.6), ease: 'power1.out', onComplete: () => p.remove() });
      gsap.to(p, { opacity: 0, scale: 0.3, duration: t * 0.4, delay: t * 0.6 + dur * 0.3 });
    }
  }
  function slashLine(layer, x, y, angle, color) {
    const s = fxEl(layer, 'cm-slash', '', color);
    gsap.set(s, { x, y, xPercent: -50, yPercent: -50, rotation: angle });
    gsap.timeline({ onComplete: () => s.remove() })
      .fromTo(s, { scaleX: 0 }, { scaleX: 1, duration: 0.12, ease: 'power3.out' })
      .to(s, { scaleY: 0, opacity: 0, duration: 0.25 });
  }
  function splat(layer, x, y, color) {
    const s = fxEl(layer, 'cm-splat', '', color);
    gsap.set(s, { x, y, xPercent: -50, yPercent: -50, rotation: rnd(0, 360) });
    gsap.timeline({ onComplete: () => s.remove() })
      .fromTo(s, { scale: 0.1 }, { scale: rnd(0.8, 1.3), duration: 0.25, ease: 'back.out(3)' })
      .to(s, { opacity: 0, duration: 0.6, delay: 1.1 });
  }
  function confetti(layer, x, y, n) {
    const cols = ['#ff5d8f', '#ffe066', '#5fd0ff', '#7dff8a', '#c58cff'];
    for (let i = 0; i < n; i++) {
      const p = fxEl(layer, 'cm-confetti');
      p.style.background = cols[i % cols.length];
      const a = rnd(-Math.PI, 0), d = rnd(150, 480), t = rnd(1, 1.7);
      gsap.set(p, { x, y, xPercent: -50, yPercent: -50 });
      gsap.to(p, { keyframes: [{ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, duration: t * 0.4, ease: 'power2.out' }, { y: `+=${rnd(200, 420)}`, duration: t * 0.6, ease: 'sine.in' }],
        rotation: rnd(-720, 720), rotationX: rnd(-540, 540), onComplete: () => p.remove() });
      gsap.to(p, { opacity: 0, duration: 0.3, delay: t - 0.3 });
    }
  }
  // a column of light (or water) standing on the sprite's feet
  function column(layer, cls, p, color, hold = 0.9) {
    const b = fxEl(layer, cls, '', color);
    gsap.set(b, { x: p.x, y: p.bottom, xPercent: -50, yPercent: -100, transformOrigin: '50% 100%' });
    gsap.timeline({ onComplete: () => b.remove() })
      .fromTo(b, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.25, ease: 'power2.out' })
      .to(b, { scaleX: 0, opacity: 0, duration: 0.45, delay: hold });
  }
  const squash = (sp) => gsap.fromTo(sp, { scaleY: 0.84, scaleX: 1.1, transformOrigin: '50% 100%' }, { scaleY: 1, scaleX: 1, duration: 0.55, ease: 'elastic.out(1,0.35)' });
  const feetDust = (L, sp) => { const p = spot(sp); spray(L, p.x, p.bottom - 20, '#c9b79c', 26, { dist: [80, 320], gravity: -60, stars: 0 }); };

  // styles shared by two characters get a personal line; a card's own `quote` wins
  const line = (def, text) => (def && def.quote) || text;
  const QUOTES = { 'maria-hunley': 'Hi, sweetie!', 'farley-kate': "Dad's here!", 'maiko-ghan': 'Honestly? Easy.', 'ben-brier': 'Outta my way.' };
  const INTRO = {
    // Maria, Farley: drops from the sky and shakes the screen
    slam: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { y: -1000, opacity: SPRITE_OP, rotation: -6 }, { y: 0, rotation: 0, duration: 0.45, ease: 'power3.in' })
      .call(() => { const p = spot(sp); MB.audio.sfx('slam'); ring(L, p.x, p.bottom - 30, c, { size: 220, scale: 4, width: 10 }); feetDust(L, sp); shake(ov, 18); })
      .add(squash(sp))
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, QUOTES[def.id] || 'Hmph!'), c, 46); }, null, 0.6),
    // Hayley: sparkles rush in, she pops out of them
    barrage: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); converge(L, p.x, p.y, c, 34, 0.5); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, scale: 0.3, rotation: -25 }, { opacity: SPRITE_OP, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, 0.4)
      .call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 40, { dist: [160, 460], stars: 0.8 }); MB.audio.sfx('sparkle'); word(L, p.x, p.top + 60, line(def, '✦ Yay! ✦'), c, 50); }, null, 0.6),
    // James: scanned in by a beam, left to right
    beam: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => {
        const p = spot(sp), line = fxEl(L, 'cm-scan', '', c);
        MB.audio.sfx('beam');
        gsap.set(line, { y: p.top, height: p.bottom - p.top });
        gsap.fromTo(line, { x: p.x - p.w / 2 }, { x: p.x + p.w / 2, duration: 0.7, ease: 'power2.inOut', onComplete: () => gsap.to(line, { opacity: 0, duration: 0.2, onComplete: () => line.remove() }) });
      })
      .fromTo(sp, { opacity: SPRITE_OP, clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power2.inOut', clearProps: 'clipPath' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, '...whatever.'), c, 40); }),
    // Maiko, Ben: dashes in leaving afterimages and skids to a stop
    dash: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(sp, { x: 800, opacity: SPRITE_OP, skewX: -20 }, { x: -50, duration: 0.3, ease: 'power3.in', onUpdate: () => afterimage(sp) })
      .call(() => { feetDust(L, sp); MB.audio.sfx('hit'); })
      .to(sp, { x: 0, skewX: 0, duration: 0.55, ease: 'elastic.out(1,0.4)' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, QUOTES[def.id] || 'Ready!'), c, 46); }, null, 0.45),
    // Isabella: blooms out of a whirl of petals
    orb: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); swirl(L, p.x, p.y, ['🌸', '🌸', '💮'], 20, 1); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, y: 40, filter: 'brightness(2.5) blur(8px)' }, { opacity: SPRITE_OP, y: 0, filter: 'brightness(1) blur(0px)', duration: 0.9, ease: 'power2.out', clearProps: 'filter' }, 0.25),
    // Julie: three bouncy hops
    bounce: (sp, L, c, ov, def) => {
      const tl = gsap.timeline().set(sp, { opacity: SPRITE_OP, x: 540 });
      for (let i = 0; i < 3; i++) {
        tl.to(sp, { x: 540 - (i + 1) * 180, duration: 0.3, ease: 'none' })
          .to(sp, { y: -170 + i * 40, duration: 0.15, ease: 'power2.out' }, '<')
          .to(sp, { y: 0, duration: 0.15, ease: 'power2.in' }, '>')
          .call(() => { MB.audio.sfx('click'); const p = spot(sp); spray(L, p.x, p.bottom - 20, c, 8, { dist: [30, 140], gravity: -30, stars: 0 }); });
      }
      return tl.add(squash(sp));
    },
    // Kayla: lightning in the dark
    bolt: (sp, L, c, ov, def) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      for (let i = 0; i < 3; i++) {
        tl.call(() => { MB.audio.sfx(i === 2 ? 'thunder' : 'zap'); screenFlash(L, i === 2 ? '#ffffff' : c, 0.45); const p = spot(sp); lightning(L, p.x + rnd(-160, 160), c); })
          .to(sp, { opacity: i === 2 ? SPRITE_OP : 0.7, duration: 0.04 })
          .to(sp, { opacity: i === 2 ? SPRITE_OP : 0, duration: 0.14 });
      }
      return tl.call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 30, { dist: [150, 420] }); shake(ov, 10); });
    },
    // Luther: skates in spinning
    spin: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(sp, { opacity: SPRITE_OP, x: 500, rotationY: -1080, transformPerspective: 1400 }, { x: 0, rotationY: 0, duration: 1, ease: 'power3.out', onUpdate: () => afterimage(sp) })
      .call(() => { const p = spot(sp); ring(L, p.x, p.bottom - 30, c, { size: 200, scale: 3.5 }); MB.audio.sfx('sparkle'); }, null, 0.8),
    // Fami: the frying pan flies out and she catches it
    boomerang: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 300 }, { x: 0, duration: 0.5, ease: 'power3.out' })
      .call(() => {
        const p = spot(sp), pan = fxEl(L, 'cm-emoji', '🍳');
        pan.style.fontSize = '90px';
        MB.audio.sfx('whoosh');
        gsap.set(pan, { x: p.x, y: p.y, xPercent: -50, yPercent: -50 });
        gsap.to(pan, { rotation: 1440, duration: 1, ease: 'none' });
        gsap.to(pan, { keyframes: [{ x: p.x - 620, y: p.y - 260, duration: 0.5, ease: 'sine.out' }, { x: p.x - 30, y: p.y - 40, duration: 0.5, ease: 'sine.in' }],
          onComplete: () => { pan.remove(); MB.audio.sfx('slam'); spray(L, p.x - 30, p.y - 40, c, 24, { dist: [80, 280] }); word(L, p.x, p.top + 60, line(def, 'Dinner!'), c, 50); } });
      }),
    // Wert: a confetti cannon and a laugh track
    confetti: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: 0, y: 70 }, { opacity: SPRITE_OP, y: 0, duration: 0.45, ease: 'back.out(2)' })
      .call(() => {
        const p = spot(sp);
        confetti(L, p.x, p.top + 120, 50); MB.audio.sfx('sparkle');
        ['HA!', 'HA HA!', 'HA!'].forEach((w, i) => gsap.delayedCall(i * 0.2, () => word(L, p.x + rnd(-170, 170), p.top + rnd(40, 220), w, c, 46)));
      }),
    // Catherine: it rains money
    coins: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); rain(L, p.x - 300, p.x + 300, p.bottom, ['🪙', '💰', '💎', '🪙'], 32); MB.audio.sfx('coin'); })
      .fromTo(sp, { opacity: 0, filter: 'brightness(3) sepia(1)' }, { opacity: SPRITE_OP, filter: 'brightness(1) sepia(0)', duration: 1, clearProps: 'filter' }, 0.3)
      .call(() => MB.audio.sfx('coin'), null, 0.7)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Darling~'), c, 48); }, null, 1),
    // Harris: thaws out of a frozen block
    frost: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); MB.audio.sfx('frost'); spray(L, p.x, p.y, '#bff4ff', 30, { dist: [120, 420], stars: 0.3 }); fling(L, p.x, p.y, ['❄', '❄', '🍦'], 10); })
      .fromTo(sp, { opacity: SPRITE_OP, filter: 'brightness(2.4) saturate(0)' }, { filter: 'brightness(1) saturate(1)', duration: 1.1, ease: 'power2.out', clearProps: 'filter' }, 0)
      .fromTo(sp, { x: -7 }, { x: 7, duration: 0.05, repeat: 9, yoyo: true }, 0)
      .set(sp, { x: 0 }),
    // Zoe: rides up on a wave
    wave: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); MB.audio.sfx('splash'); column(L, 'cm-water', p, c, 0.5); riseFrom(L, p.x, p.bottom, ['#bfe9ff', c], 40, 0.8); })
      .fromTo(sp, { opacity: SPRITE_OP, y: 700 }, { y: 0, duration: 0.75, ease: 'back.out(1.4)' }, 0.1)
      .call(() => { const p = spot(sp); ring(L, p.x, p.bottom - 30, c, { size: 240, scale: 3 }); MB.audio.sfx('splash'); }),
    // Keiko: three slashes and she's suddenly there
    slash: (sp, L, c, ov, def) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      for (let i = 0; i < 3; i++) tl.call(() => { const p = spot(sp); slashLine(L, p.x, p.y + (i - 1) * 120, -35 + i * 35, c); MB.audio.sfx('whoosh'); }).to({}, { duration: 0.12 });
      return tl.fromTo(sp, { opacity: SPRITE_OP, scaleX: 0.05 }, { scaleX: 1, duration: 0.2, ease: 'power3.out' })
        .call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 26, { dist: [120, 360] }); word(L, p.x, p.top + 60, line(def, 'Overtime!'), c, 46); });
    },
    // Lilith: rises out of hellfire
    hellfire: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); column(L, 'cm-fire', p, c, 0.7); riseFrom(L, p.x, p.bottom, ['#ff4a1c', '#ffb347', '#ffe066'], 60, 1.1); MB.audio.sfx('fire'); })
      .fromTo(sp, { opacity: 0, y: 140, filter: 'brightness(0.3) sepia(1) saturate(5)' }, { opacity: SPRITE_OP, y: 0, filter: 'brightness(1) sepia(0) saturate(1)', duration: 1, ease: 'power2.out', clearProps: 'filter' }, 0.15)
      .call(() => { const p = spot(sp); ring(L, p.x, p.y, c, { size: 220, scale: 4 }); shake(ov, 12); MB.audio.sfx('slam'); word(L, p.x, p.top + 60, line(def, 'Look at ME!'), c, 50); }, null, 0.95),
    // Celeste: descends in a beam of light and feathers
    halo: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); column(L, 'cm-light', p, c, 1); rain(L, p.x - 300, p.x + 300, p.bottom, ['🪶', '✨', '🪶'], 18, 1.2); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, y: -500 }, { opacity: SPRITE_OP, y: 0, duration: 1.2, ease: 'power2.out' }, 0.1)
      .call(() => { const p = spot(sp); ring(L, p.x, p.top + 40, '#fff6c8', { size: 170, scale: 2.5, width: 8 }); MB.audio.sfx('heal'); }, null, 1.1),
    // Mr Dino: an uppercut leap from below the screen
    uppercut: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, y: 900 }, { y: -130, duration: 0.35, ease: 'power3.out' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 20, 'HUH?!', c, 72); MB.audio.sfx('whoosh'); })
      .to(sp, { y: 0, duration: 0.3, ease: 'power3.in' })
      .call(() => { MB.audio.sfx('slam'); shake(ov, 18); feetDust(L, sp); })
      .add(squash(sp)),
    // Clara: walks in turned away, then spins round flustered
    heartbreak: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 220, scaleX: -1 }, { x: 0, duration: 0.5, ease: 'power2.out' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Hmph!'), c, 50); })
      .to(sp, { scaleX: 1, duration: 0.2, ease: 'back.out(3)', delay: 0.4 })
      .call(() => { const p = spot(sp); fling(L, p.x, p.y - 80, ['💗', '💢', '💕'], 12); word(L, p.x, p.top + 60, line(def, 'B-baka!'), '#ff5c8a', 56); MB.audio.sfx('sparkle'); }),
    // Janice: pages whirl around her
    pages: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); swirl(L, p.x, p.y, ['📄', '📃', '📖'], 22, 1.1); MB.audio.sfx('draw'); })
      .fromTo(sp, { opacity: 0, scale: 0.92 }, { opacity: SPRITE_OP, scale: 1, duration: 0.9, ease: 'power2.out' }, 0.3)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Shhh...'), c, 44); }, null, 1.1),
    // Jay: paint splashes, then colour floods in
    paint: (sp, L, c, ov, def) => {
      const tl = gsap.timeline();
      [c, '#ff4fa3', '#ffd23f', '#7dff8a'].forEach((col, i) => tl.call(() => { const p = spot(sp); splat(L, p.x + rnd(-220, 220), p.y + rnd(-260, 260), col); MB.audio.sfx('splash'); }, null, i * 0.13));
      return tl.fromTo(sp, { opacity: 0, filter: 'saturate(0) brightness(1.8)' }, { opacity: SPRITE_OP, filter: 'saturate(1) brightness(1)', duration: 0.8, clearProps: 'filter' }, 0.3);
    },
    // Charlie & Jenny: stagger in, swaying
    stumble: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 520, transformOrigin: '50% 100%' }, { x: 0, duration: 1.1, ease: 'power1.out' })
      .fromTo(sp, { rotation: 12 }, { rotation: -10, duration: 0.27, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0)
      .to(sp, { rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' })
      .call(() => { const p = spot(sp); word(L, p.x - 90, p.top + 90, '*hic*', '#ffe6a0', 40); fling(L, p.x, p.top + 120, ['🫧', '🍺', '✨'], 9); }, null, 0.4),

    // Lisa: drags herself up in no hurry at all
    yawn: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, y: 260, rotation: -4, transformOrigin: '50% 100%' }, { y: 0, duration: 1.4, ease: 'sine.out' })
      .call(() => { const p = spot(sp); ['Z', 'z', 'Z'].forEach((z, i) => gsap.delayedCall(i * 0.35, () => word(L, p.x + 90 + i * 45, p.top + 90 - i * 45, z, c, 40 + i * 10))); }, null, 0.4)
      .to(sp, { rotation: 0, duration: 0.6, ease: 'sine.inOut' }, 1.2)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, '*yaaawn*'), c, 46); }, null, 1.4),
    // Claire: "hello" arrives in every language before she does
    lingo: (sp, L, c, ov, def) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      ['Bonjour!', 'Hello!', 'Hola!', 'Ciao!', 'Hallo!'].forEach((w, i) => tl.call(() => {
        const p = spot(sp);
        word(L, p.x + rnd(-260, 260), p.y + rnd(-260, 200), w, [c, '#ffffff', '#ff4f5e'][i % 3], 40);
        MB.audio.sfx('click');
      }, null, i * 0.14));
      return tl.fromTo(sp, { opacity: 0, scale: 0.92 }, { opacity: SPRITE_OP, scale: 1, duration: 0.6, ease: 'power2.out' }, 0.5)
        .call(() => { const p = spot(sp); [c, '#ffffff', '#ff4f5e'].forEach((col) => spray(L, p.x, p.y, col, 16, { dist: [140, 400] })); MB.audio.sfx('sparkle'); }, null, 0.9);
    },
    // Betty: two slashes in the dark, then her silhouette lights up
    scar: (sp, L, c, ov, def) => gsap.timeline()
      .set(sp, { opacity: 0 })
      .call(() => { const p = spot(sp); slashLine(L, p.x, p.y - 80, -35, c); MB.audio.sfx('whoosh'); })
      .call(() => { const p = spot(sp); slashLine(L, p.x, p.y - 80, 35, c); MB.audio.sfx('hit'); shake(ov, 8); }, null, 0.2)
      .fromTo(sp, { opacity: SPRITE_OP, filter: `brightness(0) drop-shadow(0 0 20px ${c})` }, { filter: `brightness(1) drop-shadow(0 0 0px ${c})`, duration: 0.8, clearProps: 'filter' }, 0.35)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, '...mph.'), c, 46); }, null, 1),
    // Deiste: a dragon flies past and he steps out of the fire
    dragon: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => {
        const p = spot(sp), d = fxEl(L, 'cm-emoji', '🐉');
        d.style.fontSize = '150px';
        MB.audio.sfx('whoosh');
        gsap.fromTo(d, { x: -200, y: p.top + 60, xPercent: -50, yPercent: -50 }, { x: 1800, y: p.top - 40, duration: 1.2, ease: 'power1.inOut', onComplete: () => d.remove() });
      })
      .call(() => { const p = spot(sp); column(L, 'cm-fire', p, c, 0.5); riseFrom(L, p.x, p.bottom, ['#ff4a1c', '#ffb347', '#ffffff'], 40, 0.8); MB.audio.sfx('fire'); }, null, 0.5)
      .fromTo(sp, { opacity: 0, scale: 1.1 }, { opacity: SPRITE_OP, scale: 1, duration: 0.6, ease: 'power2.out' }, 0.6)
      .call(() => { const p = spot(sp); shake(ov, 10); word(L, p.x, p.top + 60, line(def, 'The king is I!'), c, 48); }, null, 1.1),
    // Olivia: fresh coffee steam, and a warm welcome
    latte: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => {
        const p = spot(sp);
        for (let i = 0; i < 8; i++) {
          const s = fxEl(L, 'cm-steam');
          gsap.fromTo(s, { x: p.x + rnd(-120, 120), y: p.bottom - 100, xPercent: -50, opacity: 0.8, scale: 0.6 },
            { y: p.top, opacity: 0, scale: 2, duration: 1.6, delay: i * 0.1, ease: 'sine.out', onComplete: () => s.remove() });
        }
      })
      .fromTo(sp, { opacity: 0, x: -120 }, { opacity: SPRITE_OP, x: 0, duration: 0.8, ease: 'power2.out' }, 0.2)
      .call(() => { const p = spot(sp); fling(L, p.x, p.y, ['☕', '🤎', '🥐'], 10, { gravity: -40 }); MB.audio.sfx('sparkle'); word(L, p.x, p.top + 60, line(def, 'Welcome in!'), c, 46); }, null, 0.9),
    // Mason: the mail comes down and he pops up out of the pile
    mail: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); rain(L, p.x - 300, p.x + 300, p.bottom, ['✉️', '📨', '📦'], 22, 0.7); MB.audio.sfx('draw'); })
      .fromTo(sp, { opacity: SPRITE_OP, y: 400 }, { y: 0, duration: 0.5, ease: 'back.out(1.8)' }, 0.5)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Special delivery!'), c, 44); MB.audio.sfx('click'); }, null, 1),
    // Benjamin: the cart rolls in, and so does he, steady as ever
    cart: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => {
        const p = spot(sp), k = fxEl(L, 'cm-emoji', '🛒');
        k.style.fontSize = '120px';
        MB.audio.sfx('whoosh');
        gsap.fromTo(k, { x: 1750, y: p.bottom - 70, xPercent: -50, yPercent: -50 }, { x: p.x - 230, duration: 0.8, ease: 'power2.out',
          onComplete: () => gsap.to(k, { opacity: 0, duration: 0.4, delay: 0.8, onComplete: () => k.remove() }) });
      })
      .fromTo(sp, { opacity: SPRITE_OP, x: 500 }, { x: 0, duration: 1.1, ease: 'power1.out' }, 0.1)
      .call(() => { feetDust(L, sp); shake(ov, 6); MB.audio.sfx('slam'); }, null, 1.1)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Open for business.'), c, 42); }, null, 1.2),
    // Dan: flips in over the top of the screen
    parkour: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(sp, { opacity: SPRITE_OP, x: -700, y: -300, rotation: -360, transformOrigin: '50% 50%' }, { x: 0, y: 0, rotation: 0, duration: 0.7, ease: 'power2.out', onUpdate: () => afterimage(sp) })
      .call(() => { feetDust(L, sp); MB.audio.sfx('hit'); })
      .add(squash(sp))
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Try and stop me!'), c, 44); }, null, 0.8),
    // Rirarra: a fin cuts across, then she bursts out of the water
    jaws: (sp, L, c, ov, def) => gsap.timeline()
      .set(sp, { opacity: 0 })
      .call(() => {
        const p = spot(sp), f = fxEl(L, 'cm-fin', '', c);
        MB.audio.sfx('splash');
        gsap.fromTo(f, { x: p.x - 520, y: p.bottom - 10, xPercent: -50, yPercent: -100 }, { x: p.x, duration: 0.8, ease: 'power2.inOut',
          onComplete: () => gsap.to(f, { yPercent: 0, opacity: 0, duration: 0.2, onComplete: () => f.remove() }) });
      })
      .call(() => { const p = spot(sp); column(L, 'cm-water', p, c, 0.4); riseFrom(L, p.x, p.bottom, ['#bfe9ff', '#ffffff', c], 50, 0.8); MB.audio.sfx('wave'); shake(ov, 14); }, null, 0.85)
      .fromTo(sp, { opacity: SPRITE_OP, y: 700 }, { y: 0, duration: 0.55, ease: 'back.out(1.5)' }, 0.9)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'BIG SIS IS HERE!'), c, 50); fling(L, p.x, p.y, ['💧', '🦈', '💦'], 10); }, null, 1.3),
    // Rowdy: walks in reading, notices you, and fumbles the book shut
    suplex: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 300 }, { x: 0, duration: 0.9, ease: 'power2.out' })
      .call(() => {
        const p = spot(sp), b = fxEl(L, 'cm-emoji', '📖');
        b.style.fontSize = '80px';
        gsap.fromTo(b, { x: p.x - 60, y: p.y, xPercent: -50, yPercent: -50, scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        gsap.to(b, { scaleX: 0, duration: 0.2, delay: 0.8, onComplete: () => b.remove() });
        MB.audio.sfx('draw');
      }, null, 0.3)
      .to(sp, { y: -20, duration: 0.15, yoyo: true, repeat: 1 }, 1.2)
      .call(() => { const p = spot(sp); MB.audio.sfx('click'); word(L, p.x, p.top + 60, line(def, 'Oh! H-hi.'), c, 44); }, null, 1.2),
    // Melanika: surfs in from the side on a spray of sea
    surf: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); MB.audio.sfx('splash'); riseFrom(L, p.x, p.bottom, ['#bfe9ff', '#ffffff'], 30, 0.9); })
      .fromTo(sp, { opacity: SPRITE_OP, x: -600, y: 120, rotation: -10 }, { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'power2.out', onUpdate: () => afterimage(sp) })
      .call(() => { const p = spot(sp); spray(L, p.x, p.bottom - 20, '#bfe9ff', 30, { dist: [100, 360], gravity: -60, stars: 0 }); word(L, p.x, p.top + 60, line(def, "Surf's up!"), c, 48); MB.audio.sfx('splash'); }, null, 0.85),
    // Rinco: rises slowly out of the deep, and the birds come to her
    whale: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); riseFrom(L, p.x, p.bottom, ['#bfe9ff', c, '#ffffff'], 40, 1.2); MB.audio.sfx('splash'); })
      .fromTo(sp, { opacity: 0, y: 300, filter: 'brightness(0.4) saturate(0.4) blur(4px)' }, { opacity: SPRITE_OP, y: 0, filter: 'brightness(1) saturate(1) blur(0px)', duration: 1.4, ease: 'sine.out', clearProps: 'filter' }, 0.1)
      .call(() => { const p = spot(sp); fling(L, p.x, p.top + 80, ['🐦', '🕊️', '🍞'], 8, { gravity: -120 }); MB.audio.sfx('heal'); word(L, p.x, p.top + 60, line(def, 'Hello, little one~'), c, 42); }, null, 1.3),
    // Daphne: her hammer lands first
    hammer: (sp, L, c, ov, def) => gsap.timeline()
      .set(sp, { opacity: 0 })
      .call(() => {
        const p = spot(sp), h = fxEl(L, 'cm-emoji', '🔨');
        h.style.fontSize = '220px';
        MB.audio.sfx('whoosh');
        gsap.fromTo(h, { x: p.x + 60, y: p.top + 40, xPercent: -50, yPercent: -50, rotation: -130 }, { rotation: 20, y: p.bottom - 120, duration: 0.3, ease: 'power4.in', onComplete: () => {
          MB.audio.sfx('slam'); shake(ov, 22);
          ring(L, p.x, p.bottom - 30, c, { size: 220, scale: 4, width: 10 });
          fling(L, p.x, p.bottom - 40, ['🔩', '⚙️', '🪛'], 12);
          gsap.to(h, { opacity: 0, duration: 0.3, delay: 0.1, onComplete: () => h.remove() });
        } });
      })
      .fromTo(sp, { opacity: SPRITE_OP, scale: 0.9, transformOrigin: '50% 100%' }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }, 0.32)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Smash first!'), c, 48); }, null, 0.7),
    // Brizz: one tail whip wipes her into view
    scythe: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); slashLine(L, p.x, p.y, 0, c); MB.audio.sfx('whoosh'); })
      .fromTo(sp, { opacity: SPRITE_OP, clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.3, ease: 'power3.out', clearProps: 'clipPath' }, 0.05)
      .call(() => { const p = spot(sp); fling(L, p.x, p.y, ['🩹', '💊', '🍬'], 12); MB.audio.sfx('sparkle'); word(L, p.x, p.top + 60, line(def, 'Medic on duty~!'), c, 46); }, null, 0.4),
    // Andrea: shuffles in on caffeine alone
    coffee: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 240 }, { x: 0, duration: 1, ease: 'power1.out' })
      .fromTo(sp, { rotation: 1.5, transformOrigin: '50% 100%' }, { rotation: -1.5, duration: 0.25, repeat: 3, yoyo: true }, 0)
      .to(sp, { rotation: 0, duration: 0.2 }, 1)
      .call(() => {
        const p = spot(sp), k = fxEl(L, 'cm-emoji', '☕');
        k.style.fontSize = '90px';
        gsap.fromTo(k, { x: p.x + 130, y: p.top + 200, xPercent: -50, yPercent: -50, scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        gsap.to(k, { opacity: 0, y: '-=40', duration: 0.4, delay: 1, onComplete: () => k.remove() });
        word(L, p.x, p.top + 60, line(def, '*sips*'), c, 40);
      }, null, 0.7)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 120, "...'sup.", '#ffffff', 44); }, null, 1.5),
    // Linda: a spotlight, the paperwork, and an approval stamp
    stamp: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => { const p = spot(sp); column(L, 'cm-light', p, '#dfe6ff', 1); MB.audio.sfx('holy'); })
      .fromTo(sp, { opacity: 0, y: 30 }, { opacity: SPRITE_OP, y: 0, duration: 0.7, ease: 'power2.out' }, 0.2)
      .call(() => { const p = spot(sp); rain(L, p.x - 280, p.x + 280, p.bottom, ['📄', '📋', '📑'], 14, 0.6); }, null, 0.5)
      .call(() => {
        const p = spot(sp), s = fxEl(L, 'cm-stamp', 'APPROVED', '#3fbf6a');
        gsap.fromTo(s, { x: p.x, y: p.top + 170, xPercent: -50, yPercent: -50, scale: 3, opacity: 0, rotation: -14 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power4.in', onComplete: () => {
          MB.audio.sfx('slam'); shake(ov, 10);
          gsap.to(s, { opacity: 0, duration: 0.4, delay: 0.9, onComplete: () => s.remove() });
        } });
      }, null, 1.1),
    // Eva: zips back and forth before she can stand still
    hyper: (sp, L, c, ov, def) => {
      const tl = gsap.timeline().set(sp, { opacity: SPRITE_OP, x: 700 });
      [-420, 300, -200, 120, 0].forEach((x) => tl.call(() => MB.audio.sfx('whoosh')).to(sp, { x, duration: 0.12, ease: 'power2.inOut', onUpdate: () => afterimage(sp) }));
      return tl.call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'HIII!!'), c, 56); spray(L, p.x, p.y, c, 26, { dist: [120, 360], stars: 0.6 }); MB.audio.sfx('sparkle'); })
        .call(() => { const p = spot(sp); word(L, p.x + 120, p.top + 150, '...hi.', '#ffffff', 32); }, null, '+=0.7');
    },
    // Ashley: the ball bounces in ahead of her
    hoops: (sp, L, c, ov, def) => gsap.timeline()
      .set(sp, { opacity: 0 })
      .call(() => {
        const p = spot(sp), b = fxEl(L, 'cm-emoji', '🏀'), step = (1700 - p.x) / 3;
        b.style.fontSize = '80px';
        gsap.set(b, { x: 1700, y: p.bottom - 60, xPercent: -50, yPercent: -50 });
        const btl = gsap.timeline({ onComplete: () => b.remove() });
        for (let i = 0; i < 3; i++) {
          btl.to(b, { x: `-=${step}`, rotation: '-=240', duration: 0.3, ease: 'none' })
            .to(b, { y: p.bottom - 260 + i * 50, duration: 0.15, ease: 'power2.out' }, '<')
            .to(b, { y: p.bottom - 60, duration: 0.15, ease: 'power2.in', onComplete: () => MB.audio.sfx('click') }, '>');
        }
        btl.to(b, { y: p.top + 220, x: p.x + 60, duration: 0.25, ease: 'power2.out' }).to(b, { opacity: 0, duration: 0.2 });
      })
      .fromTo(sp, { opacity: SPRITE_OP, y: 60 }, { y: 0, duration: 0.3, ease: 'back.out(2)' }, 0.9)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, line(def, 'Heads up, eh?'), c, 46); MB.audio.sfx('hit'); }, null, 1.1),
  };

  // A card picks its entrance with `intro`: another style's name ('hyper'), or a recipe built from these parts:
  //   intro: { move: 'drop', fx: 'rain', emoji: ['🦌', '🔬'], sfx: 'sparkle' }
  // move is how the sprite gets in; fx is what happens around it (before it, for swirl and rain; as it lands,
  // for the others). Without `intro` the attack style's entrance plays. `quote` replaces the line it says.
  const MOVES = {
    drop:  (sp) => gsap.fromTo(sp, { y: -1000, opacity: SPRITE_OP }, { y: 0, duration: 0.45, ease: 'power3.in' }),
    slide: (sp) => gsap.fromTo(sp, { x: 800, opacity: SPRITE_OP, skewX: -12 }, { x: 0, skewX: 0, duration: 0.55, ease: 'power3.out', onUpdate: () => afterimage(sp) }),
    rise:  (sp) => gsap.fromTo(sp, { y: 320, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'power2.out' }),
    pop:   (sp) => gsap.fromTo(sp, { scale: 0.3, opacity: 0, rotation: -12 }, { scale: 1, opacity: SPRITE_OP, rotation: 0, duration: 0.5, ease: 'back.out(2)' }),
    fade:  (sp) => gsap.fromTo(sp, { opacity: 0, filter: 'brightness(2.5) blur(8px)' }, { opacity: SPRITE_OP, filter: 'brightness(1) blur(0px)', duration: 0.9, ease: 'power2.out', clearProps: 'filter' }),
    spin:  (sp) => gsap.fromTo(sp, { rotationY: 720, scale: 0.5, opacity: 0 }, { rotationY: 0, scale: 1, opacity: SPRITE_OP, duration: 0.8, ease: 'power2.out' }),
    zoom:  (sp) => gsap.fromTo(sp, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: SPRITE_OP, duration: 0.45, ease: 'power3.in' }),
    sneak: (sp) => gsap.timeline().fromTo(sp, { x: -520, opacity: SPRITE_OP }, { x: -300, duration: 0.5, ease: 'power1.out' })
      .to(sp, { x: -300, duration: 0.35 }).to(sp, { x: 0, duration: 0.3, ease: 'back.out(1.6)' }),
    hop:   (sp) => {
      const tl = gsap.timeline().set(sp, { opacity: SPRITE_OP, x: 540 });
      for (let i = 0; i < 3; i++) tl.to(sp, { x: 540 - (i + 1) * 180, duration: 0.3, ease: 'none' })
        .to(sp, { y: -170 + i * 40, duration: 0.15, ease: 'power2.out' }, '<').to(sp, { y: 0, duration: 0.15, ease: 'power2.in' }, '>')
        .call(() => MB.audio.sfx('boing'));
      return tl;
    },
  };
  const LANDING = { drop: 'slam', slide: 'hit', hop: 'boing', zoom: 'hit', pop: 'pop' };
  function customIntro(sp, L, c, ov, def) {
    const o = def.intro, em = o.emoji || ['✨'], move = MOVES[o.move] || MOVES.pop, fx = o.fx || 'spray';
    const tl = gsap.timeline();
    const before = fx === 'swirl' || fx === 'rain';
    if (before) tl.call(() => {
      const p = spot(sp);
      if (fx === 'swirl') swirl(L, p.x, p.y, em, 20, 1); else rain(L, p.x - 320, p.x + 320, p.bottom, em, 22, 0.6);
      MB.audio.sfx(o.sfx || 'sparkle');
    });
    tl.add(move(sp), before ? 0.35 : 0).call(() => {
      const p = spot(sp);
      if (LANDING[o.move]) MB.audio.sfx(LANDING[o.move]);
      if (o.move === 'drop') { shake(ov, 14); ring(L, p.x, p.bottom - 30, c, { size: 200, scale: 4, width: 8 }); feetDust(L, sp); }
      if (fx === 'fling') fling(L, p.x, p.y, em, 14);
      else if (fx === 'confetti') confetti(L, p.x, p.top + 120, 40);
      else if (fx === 'column') { column(L, 'cm-light', p, c, 0.6); riseFrom(L, p.x, p.bottom, [c, '#ffffff'], 30, 0.8); }
      else if (fx === 'flash') { screenFlash(L, c, 0.6); spray(L, p.x, p.y, c, 30, { dist: [140, 420], stars: 0.6 }); }
      else if (!before) spray(L, p.x, p.y, c, 36, { dist: [140, 440], stars: 0.6 });
      if (!before && o.sfx) MB.audio.sfx(o.sfx);
      word(L, p.x, p.top + 60, line(def, 'Hi!'), c, 46);
    });
    if (o.move === 'drop' || o.move === 'hop') tl.add(squash(sp));
    return tl;
  }
  // the signature styles added later enter with a recipe of their own
  const STYLE_INTROS = {
    katana: { move: 'zoom', fx: 'flash', sfx: 'whoosh' }, darkflame: { move: 'fade', fx: 'column', sfx: 'beam' },
    dolphin: { move: 'rise', fx: 'swirl', emoji: ['🐬', '⭐', '🌙'] }, syringe: { move: 'pop', fx: 'fling', emoji: ['💉', '💊', '💗'] },
    stare: { move: 'fade', fx: 'column', sfx: 'freeze' }, pompom: { move: 'hop', fx: 'confetti' },
    lasso: { move: 'slide', fx: 'fling', emoji: ['🤠', '🍭'] }, flask: { move: 'pop', fx: 'fling', emoji: ['🧪', '⚗️', '🫧'] },
    redcard: { move: 'drop', fx: 'flash' }, warfan: { move: 'drop', fx: 'fling', emoji: ['🎌', '🪭'] },
    meteor: { move: 'drop', fx: 'rain', emoji: ['☄️', '⭐', '✨'], sfx: 'boom' }, tornado: { move: 'spin', fx: 'swirl', emoji: ['🍃', '🌪️', '💨'], sfx: 'wind' },
    blackhole: { move: 'fade', fx: 'swirl', emoji: ['🌌', '✨', '🪐'], sfx: 'dark' }, missiles: { move: 'drop', fx: 'fling', emoji: ['🚀', '💥', '🔥'], sfx: 'boom' },
    vines: { move: 'rise', fx: 'fling', emoji: ['🌹', '🍃', '🌿'] }, runes: { move: 'fade', fx: 'column', sfx: 'holy' },
    ninja: { move: 'zoom', fx: 'flash', sfx: 'whoosh' }, melody: { move: 'pop', fx: 'swirl', emoji: ['🎵', '🎶', '💖'], sfx: 'ding' },
    bubble: { move: 'rise', fx: 'swirl', emoji: ['🫧', '🫧', '✨'], sfx: 'bubble' }, timestop: { move: 'fade', fx: 'flash', sfx: 'blink' },
    clones: { move: 'slide', fx: 'flash', sfx: 'whoosh' }, snipe: { move: 'sneak', fx: 'flash', sfx: 'click' },
    volcano: { move: 'rise', fx: 'column', sfx: 'fire' }, kiss: { move: 'pop', fx: 'fling', emoji: ['💋', '💗', '💕'], sfx: 'sparkle' },
    blades: { move: 'drop', fx: 'rain', emoji: ['🗡️', '⚔️', '✨'], sfx: 'slam' }, hack: { move: 'zoom', fx: 'rain', emoji: ['0', '1', '💻'], sfx: 'zap' },
    camera: { move: 'pop', fx: 'flash', sfx: 'click' }, gravity: { move: 'drop', fx: 'column', sfx: 'dark' },
    spikes: { move: 'rise', fx: 'fling', emoji: ['💎', '❄️', '✨'], sfx: 'shatter' },
  };
  // a recipe attack (fx.js) enters the way it moves, flinging its props
  const RECIPE_ENTRANCE = { stay: 'pop', float: 'fade', dash: 'slide', leap: 'drop', blink: 'zoom', spin: 'spin', hop: 'hop', zigzag: 'slide',
    fly: 'drop', dive: 'rise', charge: 'slide', slide: 'slide' };
  function introOf(def) {
    if (def.intro && typeof def.intro === 'object') return customIntro;
    const name = def.intro || def.attack.style;
    if (INTRO[name]) return INTRO[name];
    const a = def.attack;
    const recipe = STYLE_INTROS[name] || (!def.intro && (a.move || a.fx)
      && { move: RECIPE_ENTRANCE[a.move] || 'pop', fx: 'fling', emoji: [].concat(a.prop || a.scatter || '✨') });
    if (!recipe) return null;
    const fn = (sp, L, c, ov, d) => customIntro(sp, L, c, ov, { ...d, intro: recipe });
    fn.saysQuote = true;
    return fn;
  }

  // ---------------------------------------------------------------- relationship close-ups
  // Each relationship plays a little scene that shows what the two are to each other (MB.BOND_SCENES):
  // lovers cuddle / go on a date / dance, family eats / watches a movie / cracks up / trains / games, rivals argue
  // and clash or race, friends high-five / take a selfie / game, school pairs have a lesson or a club project,
  // a crush hands over a love letter, partners pose back to back, a mentor powers up the student.
  // Every scene takes: lines (2+, alternating, or { by: 0|1, text }), backdrop, emoji, word.
  // Positions are measured when each step runs.
  const KINDS = { lovers: '💞', family: '🏠', rivals: '⚔️', friends: '🤝', school: '📚', crush: '💓', partners: '😎', mentor: '🎓' };
  // the scene variants of each kind (the first is the default)
  const SCENE_VARIANTS = { lovers: ['cuddle', 'date', 'dance'], family: ['laugh', 'meal', 'movie', 'strict', 'game'], rivals: ['clash', 'race'],
    friends: ['highfive', 'selfie', 'game'], school: ['club', 'class'], crush: [], partners: [], mentor: [] };
  // line i of the scene: who says it and what
  const lineOf = (S, i) => { const l = S.lines[i]; return l && typeof l === 'object' ? { by: l.by ? 1 : 0, text: l.text } : { by: i % 2, text: l }; };
  const nLines = (S) => (S.lines ? S.lines.length : 0);
  const headOf = (S, im) => ({ x: S.box.offsetLeft + im.offsetLeft + im.offsetWidth / 2, y: S.box.offsetTop + im.offsetTop });
  const midOf = (S) => ({ x: S.box.offsetLeft + S.b.offsetLeft, y: S.box.offsetTop + Math.min(S.a.offsetTop, S.b.offsetTop) + S.a.offsetHeight * 0.3 });
  // scenery that belongs to the duo (behind them: z 0, in front: z 2)
  function prop(S, cls, html, z) {
    const p = el('div', 'cm-prop ' + cls, html);
    p.style.zIndex = z;
    S.box.appendChild(p);
    return p;
  }
  // a speech bubble over one partner's head
  function say(S, im, text, hold = 1.5) {
    const h = headOf(S, im), x = Math.min(1600 - 140, Math.max(140, h.x)), y = Math.max(70, h.y - 6);
    const bb = fxEl(S.L, 'cm-bubble', text, S.c), who = im === S.a ? 0 : 1;
    // a partner's next line replaces the one still showing
    const old = S.bubbles[who];
    if (old) gsap.to(old, { opacity: 0, duration: 0.15, onComplete: () => old.remove() });
    S.bubbles[who] = bb;
    gsap.timeline({ onComplete: () => bb.remove() })
      .fromTo(bb, { x, y, xPercent: -50, yPercent: -100, scale: 0, transformOrigin: '50% 100%' }, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' })
      .to(bb, { opacity: 0, y: y - 20, duration: 0.3, delay: hold });
    MB.audio.sfx('click');
  }
  // all the lines, one after the other; returns when the last one is up
  const talk = (S, tl, at, gap = 1.3) => {
    for (let i = 0; i < nLines(S); i++) { const l = lineOf(S, i); tl.call(() => say(S, l.by ? S.b : S.a, l.text), null, at + i * gap); }
    return tl;
  };
  // when a scene that talks at `at` is done talking (at least two lines' worth)
  const afterTalk = (S, at, gap = 1.3) => at + Math.max(2, nLines(S)) * gap;
  const floatUp = (S, chars, p, n = 1, size = [26, 44]) => {
    for (let i = 0; i < n; i++) {
      const h = fxEl(S.L, 'cm-emoji', MB.pick(chars));
      h.style.fontSize = rnd(size[0], size[1]) + 'px';
      const x = p.x + rnd(-60, 60);
      gsap.fromTo(h, { x, y: p.y, xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0 },
        { x: x + rnd(-50, 50), y: p.y - rnd(160, 300), scale: 1, opacity: 1, rotation: rnd(-30, 30), duration: rnd(1.6, 2.4), ease: 'sine.out', onComplete: () => h.remove() });
      gsap.to(h, { opacity: 0, duration: 0.6, delay: 1.2 });
    }
  };
  // switch a partner's expression, only to a sprite that has already loaded (duoScene preloads them)
  const MOODS = ['attack', 'lose', 'win', 'play', 'taunt'];
  function mood(S, im, role) {
    const pic = S.moods[im === S.a ? 0 : 1][role];
    if (pic && pic.complete && pic.naturalWidth) im.src = pic.src;
  }
  // a looping spawner; returns a tween so the modal can kill it
  const every = (sec, fn) => gsap.timeline({ repeat: -1, repeatDelay: sec }).call(fn);

  const SCENES = {
    // cuddle up, squeeze, hearts everywhere
    lovers: (S) => {
      if (S.scene === 'date') return VARIANTS.date(S);
      if (S.scene === 'dance') return VARIANTS.dance(S);
      const { a, b, L, c } = S, glow = prop(S, 'cm-loveheart', '♥', 0), hearts = S.cfg.emoji || ['💗', '💕', '💞', '💖'];
      glow.style.setProperty('--c', c);
      const tl = gsap.timeline()
        .call(() => MB.audio.sfx('sparkle'))
        .fromTo(a, { x: -380, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 1, ease: 'sine.out' }, 0)
        .fromTo(b, { x: 380, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 1, ease: 'sine.out' }, 0)
        .fromTo(glow, { xPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.6)' }, 0.6)
        .to(a, { x: 34, rotation: 5, duration: 0.45, ease: 'power2.out' }, 1)
        .to(b, { x: -34, rotation: -5, duration: 0.45, ease: 'power2.out' }, 1)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('bond', S.tier);
          fling(L, p.x, p.y, hearts, 10 + S.tier * 3, { gravity: -40 });
          spray(L, p.x, p.y, c, 30, { dist: [80, 320], stars: 0.6 });
          word(L, p.x, p.y - 70, S.cfg.word || '♥ cuddle ♥', '#ff8fc6', 40);
          mood(S, a, 'play'); mood(S, b, 'play');
        }, null, 1.35)
        .to([a, b], { scaleX: 0.96, scaleY: 1.02, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.4);
      return { tl: talk(S, tl, 2.1), idle: () => [
        gsap.to([a, b], { rotation: '+=2.5', duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // rocking together
        gsap.to(glow, { scale: 1.08, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.5, () => floatUp(S, hearts, midOf(S))),
      ] };
    },

    // comfortable family time: a meal, movie night, or a joke that has them both in stitches
    family: (S) => {
      if (S.scene === 'game') return VARIANTS.game(S);
      const { a, b, L, c, scene } = S, laughs = S.cfg.emoji || ['😂', '🤣', '😆'];
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 220, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.7, stagger: 0.12, ease: 'back.out(1.5)' }, 0)
        .call(() => { MB.audio.sfx('bond', S.tier); const p = midOf(S); spray(L, p.x, p.y, c, 20, { dist: [80, 280], stars: 0.5 }); }, null, 0.6);
      const idle = [() => gsap.to(a, { y: -8, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }), () => gsap.to(b, { y: -8, duration: 2.2, delay: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })];
      const laugh = (t) => tl.to([a, b], { y: -14, duration: 0.09, yoyo: true, repeat: 7, stagger: 0.05, ease: 'sine.inOut' }, t)
        .call(() => { const p = midOf(S); word(L, p.x - 90, p.y - 60, S.cfg.word || 'HAHA!', c, 46); word(L, p.x + 90, p.y - 20, 'HAHAHA!', c, 40); fling(L, p.x, p.y, laughs, 8, { gravity: -30 }); MB.audio.sfx('sparkle'); }, null, t);

      if (scene === 'meal') {
        const table = prop(S, 'cm-table', S.food.map((f) => `<i>${f}</i>`).join(''), 2);
        tl.fromTo(table, { xPercent: -50, y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.5);
        tl.fromTo(table.children, { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.1, ease: 'back.out(3)' }, 0.9);
        talk(S, tl, 1.4);
        const eat = Math.max(4, afterTalk(S, 1.4));
        [a, b, a, b].forEach((im, i) => tl.to(im, { y: 14, duration: 0.12, yoyo: true, repeat: 1 }, eat + i * 0.35)
          .call(() => { const h = headOf(S, im); word(L, h.x, h.y + 40, i % 2 ? 'Yum!' : 'Mmm~', c, 36); }, null, eat + i * 0.35));
        idle.push(() => every(0.7, () => { // steam off the food
          const r = table.getBoundingClientRect(), p = toUi(r.left + rnd(0.2, 0.8) * r.width, r.top);
          const s = fxEl(L, 'cm-steam'); gsap.fromTo(s, { x: p.x, y: p.y, xPercent: -50, opacity: 0.8, scale: 0.5 }, { y: p.y - 120, x: p.x + rnd(-20, 20), opacity: 0, scale: 1.4, duration: 1.6, ease: 'sine.out', onComplete: () => s.remove() });
        }));
        idle.push(() => gsap.timeline({ repeat: -1, repeatDelay: 3 }).to(a, { y: 12, duration: 0.14, yoyo: true, repeat: 1 }).to(b, { y: 12, duration: 0.14, yoyo: true, repeat: 1 }, '+=0.4'));
      } else if (scene === 'movie') {
        const tv = prop(S, 'cm-tvlight', '', 3), corn = prop(S, 'cm-popcorn', '🍿', 3);
        tl.fromTo(tv, { opacity: 0 }, { opacity: 0.55, duration: 0.6 }, 0.5)
          .fromTo(corn, { xPercent: -50, scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(3)' }, 0.8);
        talk(S, tl, 1.3);
        laugh(Math.max(4, afterTalk(S, 1.3)));
        idle.push(() => gsap.to(tv, { '--h': '360deg', duration: 6, repeat: -1, ease: 'none' }));
        idle.push(() => gsap.to(tv, { opacity: 0.3, duration: 0.18, yoyo: true, repeat: -1, repeatDelay: 1.3, ease: 'steps(2)' })); // screen flicker
        idle.push(() => every(0.6, () => { // popcorn hopping out of the bucket
          const r = corn.getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top + 10);
          const k = fxEl(L, 'cm-emoji', '🍿'); k.style.fontSize = '22px';
          const dx = rnd(-110, 110);
          gsap.set(k, { x: p.x, y: p.y, xPercent: -50, yPercent: -50 });
          gsap.to(k, { keyframes: [{ y: p.y - rnd(80, 160), duration: 0.35, ease: 'power2.out' }, { y: p.y + 60, opacity: 0, duration: 0.45, ease: 'power2.in' }], x: p.x + dx, rotation: rnd(-360, 360), onComplete: () => k.remove() });
        }));
        idle.push(() => gsap.timeline({ repeat: -1, repeatDelay: 4 }).to([a, b], { y: -12, duration: 0.09, yoyo: true, repeat: 5, stagger: 0.05 })
          .call(() => { const p = midOf(S); floatUp(S, laughs, p, 2); }, null, 0));
      } else if (scene === 'strict') { // strict parenting: the test isn't good enough, back to training
        const [kid, mom] = [a, b], cfg = S.cfg;
        const paper = fxEl(L, 'cm-paper', `<small>${cfg.paper || 'TEST'}</small><b>${cfg.score}</b>`);
        gsap.set(paper, { opacity: 0 });
        tl.call(() => { // she proudly holds up her test...
          const h = headOf(S, kid);
          gsap.fromTo(paper, { x: h.x, y: h.y + 160, xPercent: -50, yPercent: -50, scale: 0.3, rotation: -20, opacity: 1 }, { x: h.x - 150, y: h.y + 110, scale: 1, rotation: -8, duration: 0.45, ease: 'back.out(2)' });
          mood(S, kid, 'win');
          say(S, kid, lineOf(S, 0).text, 1.1);
        }, null, 1)
          .to(kid, { y: -24, duration: 0.15, yoyo: true, repeat: 1 }, 1.1)
          // ...and mom leans in, unimpressed
          .to(mom, { x: -24, scale: 1.05, rotation: -4, duration: 0.3, ease: 'power2.out' }, 2.4)
          .call(() => { mood(S, mom, 'attack'); say(S, mom, lineOf(S, 1).text, 1.3); MB.audio.sfx('slam'); shake(S.ov, 8); const h = headOf(S, mom); word(L, h.x - 70, h.y + 30, '💢', '#ff3b3b', 50); }, null, 2.5)
          .to(paper, { rotation: 20, scale: 0.2, opacity: 0, y: '+=80', duration: 0.35, ease: 'power2.in' }, 3.6)
          // she shrinks, sweating
          .to(kid, { scaleY: 0.93, y: 16, duration: 0.25 }, 3.7)
          .call(() => { mood(S, kid, 'lose'); const h = headOf(S, kid); word(L, h.x + 60, h.y + 40, '💧', '#8fe8ff', 46); word(L, h.x, h.y + 90, 'S-sorry...', '#cfe3ff', 30); MB.audio.sfx('debuff'); }, null, 3.8)
          .to(mom, { x: 0, scale: 1, rotation: -9, duration: 0.25 }, 4.5) // points: to the dojo
          .call(() => { const p = midOf(S); word(L, p.x, p.y - 150, cfg.order || 'DOJO. NOW.', c, 54); MB.audio.sfx('hit'); }, null, 4.6)
          .to(kid, { scaleY: 1, y: 0, duration: 0.2 }, 4.8)
          .call(() => mood(S, kid, 'attack'), null, 5); // game face on
        // training: a punch on every count, mom nodding along
        cfg.drill.forEach((cnt, i) => {
          const t = 5.2 + i * 0.45;
          tl.to(kid, { x: 26, rotation: 5, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.out' }, t)
            .to(mom, { y: 8, duration: 0.1, yoyo: true, repeat: 1 }, t)
            .call(() => { const h = headOf(S, kid); word(L, h.x + (i % 2 ? 70 : -70), h.y + 40, cnt, c, 40); MB.audio.sfx('hit'); spray(L, h.x + 70, h.y + kid.offsetHeight * 0.4, '#ffffff', 6, { dist: [30, 110], size: [3, 7], stars: 0 }); }, null, t);
        });
        tl.to(mom, { rotation: 0, duration: 0.3 }, 7.1)
          .call(() => { mood(S, mom, 'taunt'); say(S, mom, cfg.praise, 1.6); }, null, 7.2)
          .to(kid, { y: -36, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 8.3) // a rare "good" from mom!
          .call(() => { mood(S, kid, 'win'); const h = headOf(S, kid); fling(L, h.x, h.y + 40, ['✨', '💪', '⭐'], 10, { gravity: -40 }); MB.audio.sfx('sparkle'); }, null, 8.4);
        idle.length = 0;
        idle.push(() => gsap.to(mom, { y: -5, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })); // arms crossed, watching
        idle.push(() => gsap.timeline({ repeat: -1, repeatDelay: 2.2 }).to(kid, { x: 22, rotation: 4, duration: 0.07, yoyo: true, repeat: 3, ease: 'power2.out' })
          .call(() => { const h = headOf(S, kid); word(L, h.x - 70, h.y + 40, MB.pick(cfg.drill), c, 34); }, null, 0));
      } else { // laugh: the joke lands, one leans on the other
        talk(S, tl, 1, 1.4);
        const joke = Math.max(3.8, afterTalk(S, 1, 1.4));
        laugh(joke);
        tl.to(b, { x: -40, rotation: -7, duration: 0.3, ease: 'power2.out' }, joke + 0.1).to(a, { rotation: 4, duration: 0.3 }, joke + 0.1);
        idle.push(() => gsap.timeline({ repeat: -1, repeatDelay: 3.2 }).to([a, b], { y: -10, duration: 0.08, yoyo: true, repeat: 5, stagger: 0.04 })
          .call(() => floatUp(S, [...laughs, '✨'], midOf(S), 2), null, 0));
      }
      return { tl, idle: () => idle.map((f) => f()) };
    },

    // face off, trade insults, clash in the middle (and maybe it's not all hate)
    rivals: (S) => {
      if (S.scene === 'race') return VARIANTS.race(S);
      const { a, b, L, ov, cfg } = S, [ca, cb] = cfg.colors || [S.c, '#ffffff'];
      const glowOf = (col) => `drop-shadow(0 0 3px #fff) drop-shadow(0 0 26px ${col})`;
      const vs = prop(S, 'cm-vs', 'VS', 3);
      const tl = gsap.timeline()
        .call(() => MB.audio.sfx('whoosh'))
        .fromTo(a, { x: -520, opacity: 0 }, { x: -60, opacity: SPRITE_OP, duration: 0.45, ease: 'power3.out' }, 0)
        .fromTo(b, { x: 520, opacity: 0 }, { x: 60, opacity: SPRITE_OP, duration: 0.45, ease: 'power3.out' }, 0.05)
        .set(a, { filter: glowOf(ca) }, 0).set(b, { filter: glowOf(cb) }, 0)
        .to(a, { rotation: 6, duration: 0.2 }, 0.45).to(b, { rotation: -6, duration: 0.2 }, 0.45) // leaning in, glaring
        .fromTo(vs, { xPercent: -50, scale: 4, opacity: 0, rotation: -20 }, { scale: 1, opacity: 1, rotation: -8, duration: 0.35, ease: 'back.out(2.5)' }, 0.5)
        .call(() => { MB.audio.sfx('slam'); shake(ov, 12); const p = midOf(S); lightning(L, p.x, '#ffffff'); spray(L, p.x, p.y, ca, 14); spray(L, p.x, p.y, cb, 14); }, null, 0.6);
      // the insults, each with an angry shake
      const n = Math.max(2, nLines(S)), X = (n - 2) * 1.3; // more lines push everything after them back
      for (let i = 0; i < n; i++) {
        const l = nLines(S) ? lineOf(S, i) : { by: i % 2, text: 'Hmph!' }, im = l.by ? b : a, s = l.by ? 1 : -1;
        tl.call(() => { mood(S, im, 'attack'); say(S, im, l.text, 1.2); const h = headOf(S, im); word(L, h.x - s * 80, h.y + 30, '💢', '#ff3b3b', 48); }, null, 1.1 + i * 1.3)
          .fromTo(im, { x: s * 50 }, { x: s * 70, duration: 0.05, yoyo: true, repeat: 7 }, 1.1 + i * 1.3)
          .to(im, { x: s * 60, duration: 0.1 }, 1.1 + i * 1.3 + 0.8);
      }
      // clash!
      tl.to(a, { x: 20, duration: 0.18, ease: 'power3.in' }, 3.9 + X).to(b, { x: -20, duration: 0.18, ease: 'power3.in' }, 3.9 + X)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('slam'); MB.audio.sfx('zap'); shake(ov, 20); screenFlash(L, '#ffffff', 0.5);
          spray(L, p.x, p.y, ca, 34, { dist: [120, 420] }); spray(L, p.x, p.y, cb, 34, { dist: [120, 420] });
          ring(L, p.x, p.y, '#ffffff', { size: 140, scale: 4, width: 8 });
          word(L, p.x, p.y - 80, cfg.word || 'CLASH!', '#ffffff', 64);
        }, null, 4.08 + X)
        .to(a, { x: -60, duration: 0.5, ease: 'elastic.out(1,0.4)' }, 4.1 + X).to(b, { x: 60, duration: 0.5, ease: 'elastic.out(1,0.4)' }, 4.1 + X);
      if (cfg.guard) { // the one thing they agree on: nobody touches their human. Both step up to the viewer,
        // each raising their own power as a barrier, then go straight back to glaring at each other
        tl.to(vs, { opacity: 0, scale: 0.5, duration: 0.3 }, 5 + X)
          .to([a, b], { rotation: 0, scale: 1.08, y: 10, duration: 0.35, ease: 'power2.out' }, 5 + X)
          .call(() => {
            MB.audio.sfx('shield');
            [[a, ca, ['🔥', '🔥', '✨']], [b, cb, ['🪶', '✨', '🪶']]].forEach(([im, col, chars], i) => {
              const h = headOf(S, im), cx = h.x, cy = h.y + im.offsetHeight * 0.45;
              ring(L, cx, cy, col, { size: 260, scale: 1.6, dur: 1.1, width: 10 });
              fling(L, cx, cy, chars, 8, { dist: [80, 240], gravity: -80 });
              gsap.delayedCall(i * 1.2, () => say(S, im, cfg.guard[i], 1.4));
            });
            word(L, midOf(S).x, 110, 'FOR THE HUMAN!', '#ffffff', 50);
          }, null, 5.2 + X)
          .to([a, b], { scale: 1, y: 0, duration: 0.4, ease: 'power2.inOut' }, 7.9 + X)
          .to(a, { rotation: 6, x: -60, duration: 0.25 }, 8.1 + X).to(b, { rotation: -6, x: 60, duration: 0.25 }, 8.1 + X)
          .call(() => { [a, b].forEach((im, i) => { const h = headOf(S, im); word(L, h.x + (i ? -70 : 70), h.y + 30, '💢', '#ff3b3b', 44); }); }, null, 8.2 + X);
      }
      return { tl, idle: () => [
        gsap.to(a, { y: -8, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(b, { y: -8, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.4, () => { const p = midOf(S); spray(S.L, p.x, p.y, MB.pick([ca, cb]), 8, { dist: [30, 140], size: [3, 8], stars: 0 }); }), // sparks still fly
      ] };
    },

    // run in, high five, giggle
    friends: (S) => {
      if (S.scene === 'selfie') return VARIANTS.selfie(S);
      if (S.scene === 'game') return VARIANTS.game(S);
      const { a, b, L, c } = S;
      const tl = gsap.timeline()
        .fromTo(a, { x: -420, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 420, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .to(a, { x: 30, y: -80, rotation: 8, duration: 0.25, ease: 'power2.out' }, 0.7)
        .to(b, { x: -30, y: -80, rotation: -8, duration: 0.25, ease: 'power2.out' }, 0.7)
        .call(() => {
          const p = midOf(S), five = fxEl(L, 'cm-emoji', '🙌');
          five.style.fontSize = '110px';
          gsap.fromTo(five, { x: p.x, y: p.y - 110, xPercent: -50, yPercent: -50, scale: 0.2 }, { scale: 1.2, duration: 0.2, ease: 'back.out(3)' });
          gsap.to(five, { opacity: 0, y: '-=60', duration: 0.5, delay: 0.7, onComplete: () => five.remove() });
          MB.audio.sfx('hit'); MB.audio.sfx('bond', S.tier);
          ring(L, p.x, p.y - 110, '#ffffff', { size: 120, scale: 3.5, width: 8 });
          spray(L, p.x, p.y - 110, c, 30, { dist: [100, 360], stars: 0.7 });
          word(L, p.x, p.y - 230, S.cfg.word || 'HIGH FIVE!', c, 52);
        }, null, 0.95)
        .to([a, b], { x: 0, y: 0, rotation: 0, duration: 0.45, ease: 'bounce.out' }, 1.1);
      talk(S, tl, 1.8);
      return { tl, idle: () => [
        gsap.to(a, { y: -18, duration: 0.5, yoyo: true, repeat: -1, repeatDelay: 0.9, ease: 'power1.out' }),
        gsap.to(b, { y: -18, duration: 0.5, delay: 0.7, yoyo: true, repeat: -1, repeatDelay: 0.9, ease: 'power1.out' }),
        every(1.1, () => floatUp(S, S.cfg.emoji || ['✨', '🎵', '💫'], midOf(S), 1, [22, 34])),
      ] };
    },

    // a lesson at the chalkboard, or a club project coming together
    school: (S) => {
      const { a, b, L, c, cfg } = S;
      const tl = gsap.timeline()
        .fromTo(a, { x: -300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0.1);
      const idle = [() => gsap.to(b, { y: -6, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })];
      if (S.scene === 'class') {
        const board = prop(S, 'cm-chalkboard', '<span></span><b>A+</b>', 0), txt = board.querySelector('span'), grade = board.querySelector('b');
        const full = cfg.board || 'Lesson 1';
        tl.fromTo(board, { xPercent: -50, scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.3)
          .to(a, { rotation: -7, duration: 0.15, yoyo: true, repeat: 3 }, 0.8) // taps the board
          .to({ n: 0 }, { n: full.length, duration: 0.8, ease: 'none', onUpdate() { txt.textContent = full.slice(0, Math.round(this.targets()[0].n)); } }, 0.8)
          .call(() => MB.audio.sfx('click'), null, 0.8);
        talk(S, tl, 1.8);
        tl.to(b, { y: -40, duration: 0.15, yoyo: true, repeat: 1 }, 3.2) // hand up!
          .fromTo(grade, { scale: 4, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.3, ease: 'back.out(3)' }, 3.4)
          .call(() => { MB.audio.sfx('slam'); const r = grade.getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top + r.height / 2); spray(L, p.x, p.y, '#ffffff', 20, { dist: [60, 220], stars: 0 }); }, null, 3.55);
        idle.push(() => gsap.timeline({ repeat: -1, repeatDelay: 2.5 }).to(a, { rotation: -6, duration: 0.15, yoyo: true, repeat: 3 }));
      } else { // club: their two things (a book and a palette, say) come together into one project
        const [p1, p2] = cfg.props || ['📖', '🎨'], bits = cfg.bits || [['📄', '📃'], ['🟥', '🟨', '🟦']];
        const book = prop(S, 'cm-floaty', p1, 3), pal = prop(S, 'cm-floaty', p2, 3), pic = prop(S, 'cm-frame', cfg.result || '🖼️', 3);
        book.style.left = '22%'; pal.style.left = '78%';
        tl.fromTo([book, pal], { xPercent: -50, scale: 0, y: 60 }, { scale: 1, y: 0, duration: 0.4, stagger: 0.15, ease: 'back.out(3)' }, 0.5);
        talk(S, tl, 1.1);
        tl.call(() => { // pages and paint swirl into the middle
          [[book, bits[0]], [pal, bits[1]]].forEach(([from, chars]) => {
            const r = from.getBoundingClientRect(), f = toUi(r.left + r.width / 2, r.top + r.height / 2), p = midOf(S);
            for (let i = 0; i < 7; i++) {
              const k = fxEl(L, 'cm-emoji', MB.pick(chars)); k.style.fontSize = '24px';
              gsap.fromTo(k, { x: f.x, y: f.y, xPercent: -50, yPercent: -50 }, { x: p.x, y: p.y - 120, rotation: rnd(-360, 360), duration: 0.6, delay: i * 0.06, ease: 'power2.in', onComplete: () => k.remove() });
            }
          });
          MB.audio.sfx('draw');
        }, null, 3.6)
          .fromTo(pic, { xPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' }, 4.3)
          .call(() => { const p = midOf(S); MB.audio.sfx('sparkle'); spray(L, p.x, p.y - 120, c, 30, { dist: [80, 300], stars: 0.8 }); word(L, p.x, p.y - 240, cfg.cheer || 'Masterpiece!', c, 48); }, null, 4.4);
        idle.push(() => gsap.to(book, { y: -14, rotation: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
          () => gsap.to(pal, { y: -14, rotation: 6, duration: 1.4, delay: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
          () => gsap.to(pic, { y: -8, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      }
      return { tl, idle: () => idle.map((f) => f()) };
    },

    // one of them (cfg.crush: 0 or 1, default the first) is hopelessly smitten; a love letter changes hands.
    // cfg.answer: 'yes' and it's mutual
    crush: (S) => {
      const { a, b, L, c, cfg } = S, [me, them] = cfg.crush ? [b, a] : [a, b], s = me === a ? -1 : 1, hearts = cfg.emoji || ['💗', '💓', '💕'];
      const beat = () => {
        const h = headOf(S, me), k = fxEl(L, 'cm-emoji', '💓');
        k.style.fontSize = '54px';
        gsap.timeline({ onComplete: () => k.remove() })
          .fromTo(k, { x: h.x - s * 30, y: h.y + me.offsetHeight * 0.36, xPercent: -50, yPercent: -50, scale: 0.6 }, { scale: 1.25, duration: 0.12, yoyo: true, repeat: 3 })
          .to(k, { opacity: 0, duration: 0.2 });
        word(L, h.x + s * 110, h.y + 40, 'doki', '#ff8fc6', 28);
      };
      const tl = gsap.timeline()
        // the oblivious one strolls in, facing the other way
        .fromTo(them, { x: -s * 380, opacity: 0, scaleX: -1 }, { x: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0)
        // the smitten one peeks in, ducks back out, then shuffles closer
        .fromTo(me, { x: s * 460, opacity: SPRITE_OP }, { x: s * 300, duration: 0.35, ease: 'power2.out' }, 0.5)
        .to(me, { x: s * 430, duration: 0.25, ease: 'power2.in' }, 1.0)
        .call(() => { const h = headOf(S, me); word(L, h.x, h.y + 20, '!!', '#ff8fc6', 44); MB.audio.sfx('squeak'); }, null, 1.0)
        .to(me, { x: s * 30, duration: 0.6, ease: 'power1.inOut' }, 1.4)
        .call(() => { mood(S, me, 'play'); const h = headOf(S, me); word(L, h.x, h.y + 50, '😳', '#ff8fc6', 54); beat(); MB.audio.sfx('pop'); }, null, 2.0)
        .call(() => letter(S, me, them), null, 2.6)
        .to(them, { scaleX: 1, duration: 0.2, ease: 'power2.inOut' }, 3.5) // turns round: !?
        .call(() => { mood(S, them, 'taunt'); const h = headOf(S, them); word(L, h.x, h.y + 20, '!?', c, 50); MB.audio.sfx('ding'); }, null, 3.55);
      talk(S, tl, 4);
      const end = afterTalk(S, 4);
      if (cfg.answer === 'yes') {
        tl.to(me, { x: -s * 24, rotation: -s * 5, duration: 0.4 }, end).to(them, { x: s * 24, rotation: s * 5, duration: 0.4 }, end)
          .call(() => { const p = midOf(S); mood(S, me, 'win'); mood(S, them, 'play'); fling(L, p.x, p.y, hearts, 16, { gravity: -40 }); spray(L, p.x, p.y, c, 30, { dist: [80, 320], stars: 0.6 }); word(L, p.x, p.y - 120, cfg.word || '♥ YES ♥', '#ff5fa2', 60); MB.audio.sfx('bond', S.tier); }, null, end + 0.3);
      } else {
        tl.to(me, { scaleY: 0.9, y: 14, duration: 0.2, yoyo: true, repeat: 1 }, end) // hides her face
          .call(() => { const h = headOf(S, me), h2 = headOf(S, them); word(L, h.x, h.y + 60, cfg.word || 'KYAA~!', '#ff8fc6', 50); fling(L, h.x, h.y + 60, hearts, 8, { gravity: -40 }); word(L, h2.x, h2.y + 10, '?', c, 44); MB.audio.sfx('squeak'); }, null, end);
      }
      return { tl, idle: () => [
        every(1.3, beat),
        gsap.to(them, { y: -8, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(me, { rotation: `+=${-s * 3}`, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // fidgeting
        every(0.9, () => { const h = headOf(S, me); floatUp(S, hearts, { x: h.x, y: h.y + 80 }, 1, [18, 30]); }),
      ] };
    },

    // partners in crime: they skid in, lean back to back, shades on, fist bump
    partners: (S) => {
      const { a, b, L, c, cfg } = S, foot = () => S.box.offsetTop + S.box.offsetHeight - 20;
      const tl = gsap.timeline()
        .call(() => MB.audio.sfx('whoosh'))
        .fromTo(a, { x: -700, opacity: SPRITE_OP, skewX: 18 }, { x: -10, skewX: 0, duration: 0.4, ease: 'power3.out' }, 0)
        .fromTo(b, { x: 700, opacity: SPRITE_OP, skewX: -18 }, { x: 10, skewX: 0, duration: 0.4, ease: 'power3.out' }, 0.1)
        .call(() => { MB.audio.sfx('slam'); shake(S.ov, 10); [a, b].forEach((im) => spray(L, headOf(S, im).x, foot(), '#c9b79c', 20, { dist: [60, 260], gravity: -50, stars: 0 })); }, null, 0.5)
        .to(a, { rotation: 5, duration: 0.3 }, 0.55).to(b, { rotation: -5, duration: 0.3 }, 0.55)
        .call(() => [a, b].forEach((im, i) => { // shades on
          const h = headOf(S, im), g = fxEl(L, 'cm-emoji', '🕶️');
          g.style.fontSize = '60px';
          gsap.fromTo(g, { x: h.x, y: -80, xPercent: -50, yPercent: -50, rotation: -30 }, { y: h.y + 60, rotation: 0, duration: 0.4, delay: i * 0.15, ease: 'bounce.out',
            onComplete: () => { MB.audio.sfx('click'); spray(L, h.x + 24, h.y + 50, '#ffffff', 8, { dist: [20, 90], stars: 1 }); gsap.to(g, { opacity: 0, duration: 0.4, delay: 0.9, onComplete: () => g.remove() }); } });
        }), null, 1)
        .call(() => { // fist bump
          const p = midOf(S), fists = ['🤜', '🤛'].map((f, i) => {
            const e = fxEl(L, 'cm-emoji', f);
            e.style.fontSize = '90px';
            gsap.fromTo(e, { x: p.x + (i ? 260 : -260), y: p.y - 40, xPercent: -50, yPercent: -50 }, { x: p.x + (i ? 40 : -40), duration: 0.25, ease: 'power3.in' });
            return e;
          });
          gsap.delayedCall(0.25, () => {
            MB.audio.sfx('punch'); MB.audio.sfx('bond', S.tier); screenFlash(L, c, 0.35);
            ring(L, p.x, p.y - 40, '#ffffff', { size: 120, scale: 4, width: 8 }); spray(L, p.x, p.y - 40, c, 30, { dist: [80, 340], stars: 0.6 });
            word(L, p.x, p.y - 180, cfg.word || 'PARTNERS!', c, 58); mood(S, a, 'win'); mood(S, b, 'win');
            gsap.to(fists, { opacity: 0, duration: 0.3, delay: 0.5, onComplete: () => fists.forEach((f) => f.remove()) });
          });
        }, null, 1.8);
      talk(S, tl, 2.6);
      return { tl, idle: () => [
        gsap.to([a, b], { y: -8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(2.2, () => [a, b].forEach((im) => { const h = headOf(S, im); spray(L, h.x + rnd(-30, 30), h.y + 50, '#ffffff', 5, { dist: [10, 60], size: [4, 8], stars: 1 }); })),
        every(1, () => floatUp(S, cfg.emoji || ['✨', '⭐', '💥'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a mentor (cfg.mentor: 0 or 1, default the first) shows the student how it's done and powers them up
    mentor: (S) => {
      const { a, b, L, c, cfg } = S, [sen, stu] = cfg.mentor ? [b, a] : [a, b], s = stu === a ? 1 : -1;
      const glow = `drop-shadow(0 0 4px #fff) drop-shadow(0 0 30px ${c})`;
      const tl = gsap.timeline()
        .fromTo(sen, { y: 30, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0)
        .fromTo(stu, { y: -220, opacity: SPRITE_OP }, { y: 0, duration: 0.5, ease: 'bounce.out' }, 0.3)
        // the student gives it a go... and it fizzles
        .to(stu, { x: s * 30, rotation: s * 6, duration: 0.08, yoyo: true, repeat: 3 }, 1.2)
        .call(() => { const h = headOf(S, stu); mood(S, stu, 'lose'); word(L, h.x, h.y + 60, '💨 ...?', '#cfd6e0', 40); spray(L, h.x + s * 60, h.y + 120, '#cfd6e0', 12, { dist: [20, 120], stars: 0 }); MB.audio.sfx('wobble'); }, null, 1.5)
        // the mentor shows how it's done
        .set(sen, { filter: glow }, 2.2)
        .to(sen, { scale: 1.04, duration: 0.3 }, 2.2)
        .call(() => { const h = headOf(S, sen); mood(S, sen, 'attack'); word(L, h.x, h.y + 40, cfg.lesson || 'Watch closely.', c, 40); ring(L, h.x, h.y + sen.offsetHeight * 0.4, c, { size: 200, scale: 2.5 }); MB.audio.sfx('buff'); }, null, 2.3)
        // and passes the power on
        .call(() => transfer(S, sen, stu, c), null, 3.1)
        .set(stu, { filter: glow }, 3.5)
        .to(sen, { scale: 1, duration: 0.4 }, 3.6)
        .set(sen, { clearProps: 'filter' }, 3.9)
        .call(() => {
          const h = headOf(S, stu);
          mood(S, stu, 'win'); column(L, 'cm-light', { x: h.x, bottom: S.box.offsetTop + S.box.offsetHeight }, c, 0.5);
          spray(L, h.x, h.y + 100, c, 30, { dist: [80, 320], stars: 0.8 }); word(L, h.x, h.y + 10, cfg.word || 'LEVEL UP!', c, 56);
          MB.audio.sfx('sparkle'); MB.audio.sfx('bond', S.tier);
        }, null, 3.9)
        .to(stu, { y: -40, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.95)
        .set(stu, { clearProps: 'filter' }, 4.8);
      talk(S, tl, 5);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 2.4 }).to(stu, { x: s * 22, duration: 0.07, yoyo: true, repeat: 3 })
          .call(() => { const h = headOf(S, stu); spray(L, h.x + s * 60, h.y + 110, c, 6, { dist: [20, 100], size: [4, 9], stars: 1 }); }, null, 0),
        gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 0.4 }).to(sen, { y: 6, duration: 0.2, yoyo: true, repeat: 1 }), // nods along
        every(1.2, () => { const h = headOf(S, stu); floatUp(S, cfg.emoji || ['✨', '⭐', '💪'], { x: h.x, y: h.y + 80 }, 1, [18, 28]); }),
      ] };
    },
  };

  // a love letter flies from one partner to the other along a curve (MotionPath)
  function letter(S, from, to) {
    const L = S.L, h0 = headOf(S, from), h1 = headOf(S, to);
    const p0 = { x: h0.x, y: h0.y + from.offsetHeight * 0.4 }, p1 = { x: h1.x, y: h1.y + to.offsetHeight * 0.4 }, mid = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - 230 };
    const e = fxEl(L, 'cm-emoji', '💌');
    e.style.fontSize = '64px';
    gsap.set(e, { x: p0.x, y: p0.y, xPercent: -50, yPercent: -50 });
    MB.audio.sfx('whoosh');
    const land = () => { spray(L, p1.x, p1.y, '#ff8fc6', 18, { dist: [40, 180], stars: 0.6 }); MB.audio.sfx('sparkle'); gsap.to(e, { scale: 1.6, opacity: 0, duration: 0.3, onComplete: () => e.remove() }); };
    if (window.MotionPathPlugin) gsap.to(e, { motionPath: { path: [p0, mid, { x: mid.x + (p1.x - p0.x) * 0.3, y: mid.y + 110 }, p1], curviness: 1.5 }, rotation: 360, duration: 0.9, ease: 'sine.inOut', onComplete: land });
    else gsap.to(e, { keyframes: [{ x: mid.x, y: mid.y, duration: 0.45 }, { x: p1.x, y: p1.y, duration: 0.45 }], onComplete: land });
    const trail = every(0.06, () => {
      const t = fxEl(L, 'cm-emoji', '💗');
      t.style.fontSize = '18px';
      gsap.fromTo(t, { x: gsap.getProperty(e, 'x'), y: gsap.getProperty(e, 'y'), xPercent: -50, yPercent: -50 }, { y: '+=40', opacity: 0, duration: 0.6, onComplete: () => t.remove() });
    });
    gsap.delayedCall(0.9, () => trail.kill());
  }
  // glowing motes arc from one partner into the other
  function transfer(S, from, to, color, n = 16) {
    const h0 = headOf(S, from), h1 = headOf(S, to), p0 = { x: h0.x, y: h0.y + from.offsetHeight * 0.35 }, p1 = { x: h1.x, y: h1.y + to.offsetHeight * 0.35 };
    for (let i = 0; i < n; i++) {
      const p = fxEl(S.L, 'fx-pt', null, color);
      p.style.width = p.style.height = rnd(8, 16) + 'px';
      gsap.set(p, { x: p0.x, y: p0.y, xPercent: -50, yPercent: -50 });
      gsap.to(p, { keyframes: [{ x: (p0.x + p1.x) / 2 + rnd(-40, 40), y: Math.min(p0.y, p1.y) - rnd(80, 200), duration: 0.3, ease: 'sine.out' }, { x: p1.x, y: p1.y, duration: 0.3, ease: 'sine.in' }],
        delay: i * 0.04, onComplete: () => p.remove() });
    }
    MB.audio.sfx('beam');
  }

  // scene variants that more than one kind (or a kind's `scene`) plays
  const VARIANTS = {
    // a date: a café table, the lines, then a toast
    date: (S) => {
      const { a, b, L, c, cfg } = S, hearts = cfg.emoji || ['💗', '💕'], food = cfg.food || ['☕', '🍰', '🍹'];
      const table = prop(S, 'cm-table', food.map((f) => `<i>${f}</i>`).join(''), 2);
      const tl = gsap.timeline()
        .fromTo(a, { x: -380, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0)
        .fromTo(b, { x: 380, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0)
        .fromTo(table, { xPercent: -50, y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.5)
        .fromTo(table.children, { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.1, ease: 'back.out(3)' }, 0.8)
        .call(() => MB.audio.sfx('sparkle'), null, 0.8);
      talk(S, tl, 1.4);
      const toast = afterTalk(S, 1.4) + 0.2;
      tl.call(() => {
        const p = midOf(S);
        [-1, 1].forEach((s) => {
          const g = fxEl(L, 'cm-emoji', '🍷');
          g.style.fontSize = '66px';
          gsap.fromTo(g, { x: p.x + s * 170, y: p.y + 60, xPercent: -50, yPercent: -50, scaleX: -s, rotation: s * 25 }, { x: p.x + s * 28, y: p.y - 50, rotation: -s * 8, duration: 0.35, ease: 'power2.in' });
          gsap.to(g, { opacity: 0, y: '-=40', duration: 0.4, delay: 1.1, onComplete: () => g.remove() });
        });
        gsap.delayedCall(0.35, () => {
          MB.audio.sfx('ding'); MB.audio.sfx('bond', S.tier);
          spray(L, p.x, p.y - 50, '#fff6c8', 20, { dist: [40, 200], stars: 0.8 }); fling(L, p.x, p.y - 50, hearts, 8, { gravity: -40 });
          word(L, p.x, p.y - 170, cfg.word || 'Cheers~ ♥', c, 46);
        });
        mood(S, a, 'play'); mood(S, b, 'play');
      }, null, toast)
        .to(a, { x: 26, rotation: 4, duration: 0.4 }, toast + 0.7).to(b, { x: -26, rotation: -4, duration: 0.4 }, toast + 0.7);
      return { tl, idle: () => [
        gsap.to([a, b], { rotation: '+=2', duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.8, () => { // steam off the cups
          const r = table.getBoundingClientRect(), p = toUi(r.left + rnd(0.2, 0.8) * r.width, r.top);
          const st = fxEl(L, 'cm-steam');
          gsap.fromTo(st, { x: p.x, y: p.y, xPercent: -50, opacity: 0.8, scale: 0.5 }, { y: p.y - 120, x: p.x + rnd(-20, 20), opacity: 0, scale: 1.4, duration: 1.6, ease: 'sine.out', onComplete: () => st.remove() });
        }),
        every(0.8, () => floatUp(S, hearts, midOf(S), 1, [20, 32])),
      ] };
    },

    // a slow dance under a spotlight: each twirls, then the dip
    dance: (S) => {
      const { a, b, L, c, cfg } = S, notes = cfg.emoji || ['🎵', '🎶', '✨'], spot = prop(S, 'cm-spotlight', '', 0);
      spot.style.setProperty('--c', c);
      const tl = gsap.timeline()
        .fromTo(spot, { xPercent: -50, opacity: 0 }, { opacity: 0.85, duration: 0.6 }, 0)
        .call(() => MB.audio.sfx('sparkle'), null, 0.2)
        .fromTo(a, { x: -300, opacity: 0 }, { x: 20, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0.2)
        .fromTo(b, { x: 300, opacity: 0 }, { x: -20, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0.2);
      [a, b].forEach((im, i) => tl.to(im, { rotationY: '+=360', transformPerspective: 900, duration: 0.6, ease: 'power2.inOut' }, 1.2 + i * 0.4)
        .call(() => { const h = headOf(S, im); fling(L, h.x, h.y + 120, notes, 6, { gravity: -30 }); MB.audio.sfx('sparkle'); }, null, 1.5 + i * 0.4));
      talk(S, tl, 2.4);
      const dip = afterTalk(S, 2.4);
      tl.to(a, { rotation: 8, x: 40, duration: 0.4, ease: 'power2.out' }, dip).to(b, { rotation: -16, x: -30, y: 20, duration: 0.4, ease: 'power2.out' }, dip)
        .call(() => { const p = midOf(S); word(L, p.x, p.y - 120, cfg.word || '♪ Shall we dance? ♪', c, 44); fling(L, p.x, p.y, ['💗', ...notes], 12, { gravity: -40 }); MB.audio.sfx('bond', S.tier); mood(S, a, 'play'); mood(S, b, 'play'); }, null, dip + 0.3)
        .to([a, b], { rotation: 0, x: 0, y: 0, duration: 0.5, ease: 'sine.inOut' }, dip + 1.4);
      return { tl, idle: () => [
        gsap.to([a, b], { rotation: (i) => (i ? -4 : 4), x: (i) => (i ? -10 : 10), duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(spot, { opacity: 0.55, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.6, () => floatUp(S, notes, midOf(S), 1, [20, 32])),
      ] };
    },

    // a selfie: squeeze into frame, 3-2-1, flash, and the polaroid (cfg.caption) drops in
    selfie: (S) => {
      const { a, b, L, c, cfg } = S;
      const pic = prop(S, 'cm-polaroid', `<div>${[a, b].map((im) => `<img src="${im.src}">`).join('')}</div><b>${cfg.caption || 'BFFs ♥'}</b>`, 3);
      pic.style.setProperty('--c', c);
      gsap.set(pic, { xPercent: -50, opacity: 0 });
      const phone = fxEl(L, 'cm-emoji', '📱');
      phone.style.fontSize = '70px';
      gsap.set(phone, { opacity: 0 });
      const tl = gsap.timeline()
        .fromTo(a, { x: -420, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 420, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .call(() => { const h = headOf(S, a); gsap.fromTo(phone, { x: h.x - 150, y: h.y + 40, xPercent: -50, yPercent: -50, opacity: 1, scale: 0, rotation: -20 }, { scale: 1, rotation: -8, duration: 0.3, ease: 'back.out(3)' }); }, null, 0.7)
        .to(a, { x: 30, rotation: 6, duration: 0.3 }, 0.9).to(b, { x: -30, rotation: -6, duration: 0.3 }, 0.9); // squeeze into the frame
      ['3', '2', '1'].forEach((n, i) => tl.call(() => { const p = midOf(S); word(L, p.x, p.y - 160, n, c, 70); MB.audio.sfx('click'); }, null, 1.3 + i * 0.4));
      tl.call(() => {
        const p = midOf(S);
        screenFlash(L, '#ffffff', 0.9); MB.audio.sfx('blink'); MB.audio.sfx('click'); MB.audio.sfx('bond', S.tier);
        mood(S, a, 'win'); mood(S, b, 'win');
        [a, b].forEach((im) => { const h = headOf(S, im); word(L, h.x, h.y + 20, '✌️', c, 60); });
        spray(L, p.x, p.y - 80, c, 24, { dist: [80, 300], stars: 0.8 });
        gsap.to(phone, { opacity: 0, duration: 0.3, delay: 0.4, onComplete: () => phone.remove() });
      }, null, 2.5)
        .fromTo(pic, { y: -400, opacity: 1, rotation: 20 }, { y: 0, rotation: -6, duration: 0.6, ease: 'bounce.out' }, 2.8)
        .call(() => MB.audio.sfx('draw'), null, 2.8)
        .to([a, b], { x: 0, rotation: 0, duration: 0.4 }, 3);
      talk(S, tl, 3.5);
      return { tl, idle: () => [
        gsap.to(pic, { rotation: 4, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(a, { y: -14, duration: 0.5, yoyo: true, repeat: -1, repeatDelay: 1, ease: 'power1.out' }),
        gsap.to(b, { y: -14, duration: 0.5, delay: 0.75, yoyo: true, repeat: -1, repeatDelay: 1, ease: 'power1.out' }),
        every(1, () => floatUp(S, cfg.emoji || ['✨', '💖', '📸'], midOf(S), 1, [20, 30])),
      ] };
    },

    // gaming: controllers out, button mashing, one wins (cfg.winner: 0 or 1), rematch!
    game: (S) => {
      const { a, b, L, c, cfg } = S, win = cfg.winner ? b : a, lose = win === a ? b : a;
      const tv = prop(S, 'cm-tvlight', '', 3), pads = [a, b].map(() => { const p = fxEl(L, 'cm-emoji', cfg.emoji ? cfg.emoji[0] : '🎮'); p.style.fontSize = '60px'; gsap.set(p, { opacity: 0 }); return p; });
      const mash = (tl2, at, len) => tl2.to([a, b], { x: (i) => (i ? -5 : 5), duration: 0.05, yoyo: true, repeat: Math.round(len / 0.1) * 2 - 1, ease: 'none' }, at)
        .to(pads, { rotation: (i) => (i ? -10 : 10), duration: 0.05, yoyo: true, repeat: Math.round(len / 0.1) * 2 - 1, ease: 'none' }, at);
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 220, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.7, stagger: 0.12, ease: 'back.out(1.5)' }, 0)
        .fromTo(tv, { opacity: 0 }, { opacity: 0.55, duration: 0.6 }, 0.5)
        .call(() => pads.forEach((p, i) => {
          const im = [a, b][i], h = headOf(S, im);
          gsap.fromTo(p, { x: h.x + (i ? -40 : 40), y: h.y + im.offsetHeight * 0.45, xPercent: -50, yPercent: -50, opacity: 1, scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
          MB.audio.sfx('pop');
        }), null, 0.8);
      talk(S, tl, 1.2);
      mash(tl, 1.6, 1.6);
      [['COMBO!', a], ['PARRY!', b], ['x10!!', a]].forEach(([w, im], i) => tl.call(() => { const h = headOf(S, im); word(L, h.x, h.y + 30, w, c, 40); MB.audio.sfx('click'); }, null, 1.9 + i * 0.45));
      const ko = Math.max(3.4, afterTalk(S, 1.2));
      tl.call(() => {
        const hw = headOf(S, win), hl = headOf(S, lose);
        mood(S, win, 'win'); mood(S, lose, 'lose');
        word(L, midOf(S).x, midOf(S).y - 150, cfg.word || 'K.O.!', '#ff5d5d', 70); MB.audio.sfx('slam'); shake(S.ov, 10);
        fling(L, hw.x, hw.y + 60, ['🏆', '⭐', '✨'], 10, { gravity: -40 }); word(L, hl.x, hl.y + 50, '😭', '#8fe8ff', 54);
        MB.audio.sfx('bond', S.tier);
      }, null, ko)
        .to(win, { y: -50, duration: 0.18, yoyo: true, repeat: 3, ease: 'power2.out' }, ko)
        .to(lose, { scaleY: 0.92, y: 14, duration: 0.3 }, ko)
        .call(() => { const p = midOf(S); word(L, p.x, p.y - 120, 'REMATCH!', c, 54); mood(S, lose, 'attack'); MB.audio.sfx('hit'); }, null, ko + 1.3)
        .to(lose, { scaleY: 1, y: 0, duration: 0.2 }, ko + 1.3);
      mash(tl, ko + 1.5, 0.8);
      return { tl, idle: () => [
        gsap.to(tv, { '--h': '360deg', duration: 6, repeat: -1, ease: 'none' }),
        mash(gsap.timeline({ repeat: -1, repeatDelay: 2.4 }), 0, 0.8),
        every(1.6, () => { const im = MB.pick([a, b]), h = headOf(S, im); word(L, h.x, h.y + 30, MB.pick(['COMBO!', 'NICE!', 'NOOO!', 'GG!']), c, 32); }),
      ] };
    },

    // a race: ready, set, go, flat out, a photo finish (cfg.winner: 0 or 1, or nobody), then the arguing
    race: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], flag = prop(S, 'cm-frame', cfg.goal || '🏁', 3);
      const foot = () => S.box.offsetTop + S.box.offsetHeight - 20;
      const tl = gsap.timeline()
        .fromTo(a, { x: -420, opacity: 0 }, { x: -30, opacity: SPRITE_OP, duration: 0.5, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 420, opacity: 0 }, { x: 30, opacity: SPRITE_OP, duration: 0.5, ease: 'power2.out' }, 0)
        .to([a, b], { scaleY: 0.9, rotation: (i) => (i ? -8 : 8), duration: 0.3 }, 0.6) // crouched at the line
        .fromTo(flag, { xPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' }, 0.6);
      ['READY...', 'SET...', 'GO!!'].forEach((w, i) => tl.call(() => { const p = midOf(S); word(L, p.x, p.y - 140, w, i === 2 ? '#7dff8a' : '#ffffff', i === 2 ? 72 : 52); MB.audio.sfx(i === 2 ? 'whistle' : 'click'); }, null, 1 + i * 0.6));
      tl.to([a, b], { scaleY: 1, rotation: (i) => (i ? -12 : 12), duration: 0.15 }, 2.2)
        .to(a, { y: -22, duration: 0.09, yoyo: true, repeat: 19, ease: 'sine.inOut' }, 2.3)
        .to(b, { y: -22, duration: 0.09, yoyo: true, repeat: 19, ease: 'sine.inOut' }, 2.35)
        .to(a, { x: 10, duration: 1.8, ease: 'sine.inOut' }, 2.3).to(b, { x: -10, duration: 1.8, ease: 'sine.inOut' }, 2.3) // neck and neck
        .call(() => {
          const x0 = S.box.offsetLeft - 300, x1 = S.box.offsetLeft + S.box.offsetWidth + 100;
          const run = every(0.04, () => {
            const sl = fxEl(L, 'cm-speedline');
            gsap.fromTo(sl, { x: x1, y: rnd(200, 860) }, { x: x0, duration: rnd(0.25, 0.4), ease: 'none', onComplete: () => sl.remove() });
            if (Math.random() < 0.2) spray(L, headOf(S, MB.pick([a, b])).x, foot(), '#c9b79c', 3, { dist: [20, 90], gravity: -30, stars: 0 });
          });
          gsap.delayedCall(1.8, () => run.kill());
          MB.audio.sfx('whoosh');
        }, null, 2.3);
      const fin = 4.2;
      tl.call(() => { const p = midOf(S); screenFlash(L, '#ffffff', 0.85); MB.audio.sfx('blink'); MB.audio.sfx('slam'); shake(S.ov, 12); word(L, p.x, p.y - 150, cfg.word || 'PHOTO FINISH!', c, 60); spray(L, p.x, p.y - 60, ca, 20); spray(L, p.x, p.y - 60, cb, 20); }, null, fin)
        .to([a, b], { rotation: 0, x: (i) => (i ? 40 : -40), duration: 0.4 }, fin + 0.2);
      if (cfg.winner != null) {
        const win = cfg.winner ? b : a, lose = win === a ? b : a;
        tl.call(() => { mood(S, win, 'win'); mood(S, lose, 'lose'); const h = headOf(S, win); fling(L, h.x, h.y + 60, ['🏆', '⭐', '✨'], 10, { gravity: -40 }); MB.audio.sfx('bond', S.tier); }, null, fin + 0.5)
          .to(win, { y: -40, duration: 0.18, yoyo: true, repeat: 1 }, fin + 0.5);
      } else tl.call(() => { [a, b].forEach((im, i) => { mood(S, im, 'attack'); const h = headOf(S, im); word(L, h.x + (i ? -70 : 70), h.y + 30, '💢', '#ff3b3b', 44); }); MB.audio.sfx('bond', S.tier); }, null, fin + 0.5);
      talk(S, tl, fin + 0.9);
      return { tl, idle: () => [
        gsap.to([a, b], { scaleY: 0.97, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // out of breath
        every(1.6, () => { const im = MB.pick([a, b]), h = headOf(S, im); word(L, h.x + rnd(-60, 60), h.y + 40, '💦', '#8fe8ff', 30); }),
        every(1.4, () => { const p = midOf(S); spray(L, p.x, p.y, MB.pick([ca, cb]), 8, { dist: [30, 140], size: [3, 8], stars: 0 }); }),
      ] };
    },
  };

  // ---------------------------------------------------------------- relationship scenery
  // cfg.backdrop (a name or a list) sets the mood behind the pair: a tinted sky and/or something in the air
  const TINTS = {
    sunset: 'linear-gradient(#3a1d5c, #c2446f 45%, #ff9a55 75%, #ffd27a)', night: 'radial-gradient(ellipse at 50% 20%, #2b3a8a, #0c1236 60%, #04060f)',
    ocean: 'linear-gradient(#35b6e6, #0c4a72 70%, #062a42)', dream: 'linear-gradient(135deg, #ffb6e6, #c3a8ff 50%, #9fe6ff)',
    forest: 'linear-gradient(#9fd48a, #2f6b3a 60%, #10301a)', fire: 'linear-gradient(to top, #ff7a1c, #9a1c0a 45%, #2a0500)',
  };
  const CONFETTI = ['#ff5d8f', '#ffe066', '#5fd0ff', '#7dff8a', '#c58cff'];
  const AIR = {
    sakura: { chars: ['🌸', '💮'], every: 0.18, move: 'fall', size: [20, 34], drift: 120, dur: [3.5, 5.5] },
    snow: { dots: ['#ffffff'], every: 0.05, move: 'fall', size: [4, 10], drift: 60, dur: [4, 6] },
    rain: { cls: 'cm-raindrop', every: 0.02, move: 'fall', drift: 40, dur: [0.5, 0.8] },
    leaves: { chars: ['🍂', '🍁'], every: 0.3, move: 'fall', size: [22, 34], drift: 160, dur: [4, 6] },
    confetti: { cls: 'cm-confetti', colors: CONFETTI, every: 0.07, move: 'fall', drift: 80, dur: [2.5, 4] },
    hearts: { chars: ['💗', '💕', '💖'], every: 0.3, move: 'rise', size: [20, 36], drift: 60, dur: [3, 4.5] },
    bubbles: { chars: ['🫧'], every: 0.25, move: 'rise', size: [18, 40], drift: 40, dur: [3, 5] },
    notes: { chars: ['🎵', '🎶'], every: 0.35, move: 'rise', size: [20, 32], drift: 60, dur: [3, 4.5] },
    embers: { dots: ['#ffb347', '#ff5a1f', '#ffe066'], every: 0.07, move: 'rise', size: [4, 9], drift: 80, dur: [2, 3.5] },
    fireflies: { dots: ['#fff6a0', '#d8ff7a'], every: 0.25, move: 'wander', size: [6, 10], dur: [3, 5] },
    sparkles: { chars: ['✨'], every: 0.2, move: 'twinkle', size: [16, 30], dur: [1, 1.4] },
    stars: { move: 'stars' },
  };
  const BACKDROPS = [...Object.keys(TINTS), ...Object.keys(AIR)];
  function scenery(S, names) {
    const layer = el('div', 'cm-scenery'), tweens = [], x0 = S.box.offsetLeft - 160, x1 = S.box.offsetLeft + S.box.offsetWidth + 160;
    S.box.before(layer);
    [].concat(names).forEach((name) => {
      if (TINTS[name]) {
        const t = el('div', 'cm-tint');
        Object.assign(t.style, { background: TINTS[name], left: x0 + 'px', width: x1 - x0 + 'px' });
        layer.appendChild(t);
        tweens.push(gsap.fromTo(t, { opacity: 0 }, { opacity: 0.8, duration: 1 }));
        return;
      }
      const f = AIR[name];
      if (!f) return;
      if (f.move === 'stars') {
        for (let i = 0; i < 40; i++) {
          const s = el('div', 'fx-star', '✦');
          s.style.setProperty('--c', '#ffffff'); s.style.fontSize = rnd(8, 20) + 'px';
          layer.appendChild(s);
          gsap.set(s, { x: rnd(x0, x1), y: rnd(20, 600) });
          tweens.push(gsap.fromTo(s, { opacity: rnd(0.3, 1) }, { opacity: 0.1, duration: rnd(0.5, 1.5), yoyo: true, repeat: -1 }));
        }
        return;
      }
      tweens.push(every(f.every, () => {
        const p = el('div', f.chars ? 'cm-emoji' : f.cls || 'fx-pt', f.chars ? MB.pick(f.chars) : null);
        layer.appendChild(p);
        if (f.chars) p.style.fontSize = rnd(...f.size) + 'px';
        if (f.dots) { p.style.setProperty('--c', MB.pick(f.dots)); p.style.width = p.style.height = rnd(...f.size) + 'px'; }
        if (f.colors) p.style.background = MB.pick(f.colors);
        const x = rnd(x0, x1), t = rnd(...f.dur), done = () => p.remove(), spin = f.chars || f.colors;
        if (f.move === 'fall') gsap.fromTo(p, { x, y: -50, rotation: spin ? rnd(-90, 90) : 0 }, { x: x + rnd(-f.drift, f.drift), y: 950, rotation: spin ? `+=${rnd(-240, 240)}` : 0, duration: t, ease: 'none', onComplete: done });
        else if (f.move === 'rise') {
          gsap.fromTo(p, { x, y: 930, opacity: 0 }, { x: x + rnd(-f.drift, f.drift), y: rnd(60, 380), opacity: 1, duration: t, ease: 'sine.out', onComplete: done });
          gsap.to(p, { opacity: 0, duration: t * 0.35, delay: t * 0.65 });
        } else if (f.move === 'wander') {
          const y = rnd(120, 800);
          gsap.fromTo(p, { x, y }, { x: x + rnd(-120, 120), y: y + rnd(-120, 120), duration: t, ease: 'sine.inOut', onComplete: done });
          gsap.fromTo(p, { opacity: 0 }, { opacity: 1, duration: t / 2, yoyo: true, repeat: 1 });
        } else gsap.fromTo(p, { x, y: rnd(80, 760), scale: 0, rotation: rnd(-40, 40) }, { scale: 1, duration: t / 2, yoyo: true, repeat: 1, onComplete: done });
      }));
    });
    return tweens;
  }

  function duoScene(def, box, L, ov) {
    const [a, b] = box.querySelectorAll('img'), cfg = MB.BOND_SCENES[def.bond.id] || { kind: 'friends' };
    const moods = def.members.map((m) => Object.fromEntries(MOODS.map((r) => { const i = new Image(); i.src = MB.bigSpriteUrl(m.id, r, m.costume); return [r, i]; })));
    const S = { def, box, a, b, L, ov, cfg, moods, c: def.attack.color, tier: def.bond.tier, lines: cfg.lines, scene: cfg.scene, food: cfg.food || ['🍰'], bubbles: [] };
    const now = cfg.backdrop ? scenery(S, cfg.backdrop) : [];
    const { tl, idle } = (SCENES[cfg.kind] || SCENES.friends)(S);
    // a plate under the pair says what they are to each other
    const plate = fxEl(L, 'cm-relplate', `${KINDS[cfg.kind]} ${def.bond.relation} <i>${MB.BOND_TIERS[def.bond.tier].hearts} ${MB.BOND_TIERS[def.bond.tier].name}</i>`, def.attack.color);
    gsap.set(plate, { opacity: 0 });
    tl.call(() => {
      gsap.fromTo(plate, { x: Math.min(1600 - 190, box.offsetLeft + box.offsetWidth / 2), y: 856, xPercent: -50, yPercent: -50, scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.35, ease: 'back.out(2)' });
    }, null, 0.6);
    return { tl, idle, now };
  }

  // ---------------------------------------------------------------- close-up modal
  let modal = null;
  // the close-up card is laid out at CARD_S with CSS zoom so the art rasterizes at full resolution;
  // pivot scale 1 = close-up size
  const CARD_X = 430, CARD_Y = 450, CARD_S = 2.15;
  // relationship close-ups move the card and info panel left to give the pair room (.cm.duo)
  const DUO_CARD_X = 290;
  let cardX = CARD_X;
  const FULL_W = W * CARD_S;
  // relationship close-up: both partners drawn equally tall, as big as fits beside the info panel
  const DUO_H = 700, DUO_W = 600, DUO_OVERLAP = 40;

  function open(card, fromEl, stats) {
    if (modal) return close().then(() => open(card, fromEl, stats));
    const { c, def } = bigCard(card, stats);
    const locked = !MB.UI.isUnlocked(def.id) && def.rarity !== 'token' && !def.fused;
    cardX = def.fused ? DUO_CARD_X : CARD_X;
    if (locked) MB.UI.lockCard(c);
    const r = rarityOf(def), col = r.color, lvl = Math.max(1, r.stars);
    const from = fromEl && fromEl.isConnected ? rectOf(fromEl) : { x: cardX, y: CARD_Y + 300, w: W, h: H };

    const ov = el('div', 'cm', `
      <div class="cm-backdrop"></div>
      <div class="cm-rays"></div>
      ${def.type === 'unit' && !def.emoji && !def.fused ? `<img class="cm-sprite" src="${MB.bigSpriteUrl(def.id, locked ? 'idle' : 'taunt')}">` : ''}
      ${def.fused ? `<div class="cm-duo">${def.members.map((m) => `<img src="${MB.bigSpriteUrl(m.id, 'taunt', m.costume)}">`).join('')}</div>` : ''}
      <div class="cm-pivot"><div class="cm-tilt"></div></div>
      <div class="cm-info"></div>
      <div class="cm-fx"></div>
      <div class="cm-hint">Right-click, Esc or click outside to close · move the mouse to tilt</div>`);
    ov.style.setProperty('--rc', col);
    ov.classList.toggle('locked', locked);
    ov.classList.toggle('duo', !!def.fused);
    root().appendChild(ov);
    const pivot = ov.querySelector('.cm-pivot'), tilt = ov.querySelector('.cm-tilt'), layer = ov.querySelector('.cm-fx');
    const rays = ov.querySelector('.cm-rays'), sprite = ov.querySelector('.cm-sprite'), duoBox = ov.querySelector('.cm-duo'), info = ov.querySelector('.cm-info');
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
      if (art) art.src = MB.bigSpriteUrl(def.id, 'idle');
      if (sprite) {
        sprite.src = MB.bigSpriteUrl(def.id, 'taunt');
        gsap.fromTo(sprite, { filter: 'brightness(3) drop-shadow(0 0 30px #fff)' }, { filter: '', duration: 0.6, clearProps: 'filter' });
      }
      spray(layer, cardX, CARD_Y, col, 24, { dist: [120, 320] });
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
      .fromTo(pivot, { x: from.x, y: from.y, scale: from.w / FULL_W }, { x: cardX, y: CARD_Y, scale: 1, duration: 0.75, ease: 'expo.out' }, 0)
      .fromTo(tilt, { rotationY: -200, rotationZ: -12 }, { rotationY: 0, rotationZ: 0, duration: 0.9, ease: 'back.out(1.3)' }, 0)
      .call(() => {
        MB.audio.sfx(lvl >= 3 ? 'sparkle' : 'play');
        spray(layer, cardX, CARD_Y, col, 14 + lvl * 10, { dist: [180, 420] });
        ring(layer, cardX, CARD_Y, col, { size: 200, scale: 3 + lvl * 0.5 });
        if (lvl >= 4) gsap.fromTo(ov, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.2)', clearProps: 'x' });
      }, null, 0.45)
      .fromTo(rays, { opacity: 0, scale: 0.3 }, { opacity: 0.12 + lvl * 0.13, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.35)
      .fromTo(info.children, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, 0.3)
      .fromTo(ov.querySelector('.cm-hint'), { opacity: 0 }, { opacity: 0.6, duration: 0.5 }, 0.8);
    modal.tl = tl;
    // The entrance waits for the big sprites: it measures them to place its effects, and an image that
    // hasn't loaded yet has no size. A slow network only delays it so long.
    const m = modal, art = sprite ? [sprite] : duoBox ? [...duoBox.querySelectorAll('img')] : [];
    const loaded = Promise.race([Promise.all(art.map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]);
    if (art.length) loaded.then(() => {
      if (modal !== m || m.closing) return;
      let intro, idle;
      if (duoBox) {
        MB.fitDuo(duoBox, DUO_H, DUO_W, DUO_OVERLAP);
        let now;
        ({ tl: intro, idle, now } = duoScene(def, duoBox, layer, ov));
        m.tweens.push(...now); // the backdrop runs from the start
      } else if (locked || !introOf(def)) { // locked ones stay a plain silhouette
        intro = gsap.fromTo(sprite, { x: 260, opacity: 0 }, { x: 0, opacity: locked ? 1 : SPRITE_OP, duration: 0.8, ease: 'power3.out' });
      } else {
        const fn = introOf(def);
        intro = fn(sprite, layer, def.attack.color, ov, def);
        // entrances without a line of their own still let the card say its quote
        if (def.quote && !fn.saysQuote && !String(fn).includes('line(def')) intro.call(() => { const p = spot(sprite); word(layer, p.x, p.top + 60, def.quote, def.attack.color, 46); });
      }
      // once in, the character keeps breathing / the relationship scene keeps playing quietly
      idle = idle || (() => [gsap.to(sprite, { y: -10, duration: 2.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })]);
      intro.eventCallback('onComplete', () => { if (modal === m && !m.closing) m.tweens.push(...idle()); });
      m.intro = intro;
    });

    ov.addEventListener('pointermove', onTilt);
    ov.addEventListener('pointerdown', (e) => { if (e.button === 0 && !e.target.closest('.cm-card, .cm-info')) close(); });
  }

  function startIdle(lvl, col) {
    if (!modal) return;
    const m = modal;
    m.tweens.push(gsap.to(m.ov.querySelector('.cm-rays'), { rotation: 360, duration: 40 - lvl * 6, repeat: -1, ease: 'none' }));
    m.tweens.push(gsap.to(m.pivot, { y: CARD_Y - 12, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    m.stop = motes(m.ov.querySelector('.cm-fx'), { x0: cardX - 220, x1: cardX + 220, y0: CARD_Y + 120, y1: CARD_Y + 260 }, col, 0.7 / lvl);
    m.qx = gsap.quickTo(m.tilt, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    m.qy = gsap.quickTo(m.tilt, 'rotationX', { duration: 0.5, ease: 'power3.out' });
  }

  function onTilt(e) {
    if (!modal || !modal.qx) return;
    const p = toUi(e.clientX, e.clientY);
    const dx = Math.max(-1, Math.min(1, (p.x - cardX) / 380)), dy = Math.max(-1, Math.min(1, (p.y - CARD_Y) / 380));
    modal.qx(dx * 22); modal.qy(-dy * 18);
    modal.c.style.setProperty('--gx', 50 + dx * 50 + '%');
    modal.c.style.setProperty('--gy', 50 + dy * 50 + '%');
  }

  function close() {
    if (!modal || modal.closing) return Promise.resolve();
    const m = modal;
    m.closing = true;
    if (m.stop) m.stop();
    m.tl.kill(); if (m.intro) m.intro.kill(); m.tweens.forEach((t) => t.kill());
    MB.audio.sfx('whoosh');
    const back = m.hideEl && m.hideEl.isConnected ? rectOf(m.hideEl) : null;
    return new Promise((res) => {
      const tl = gsap.timeline({ onComplete: () => { m.ov.remove(); if (m.hideEl) gsap.set(m.hideEl, { opacity: 1 }); if (modal === m) modal = null; res(); } });
      tl.to(m.ov.querySelectorAll('.cm-info, .cm-hint, .cm-rays, .cm-sprite, .cm-duo'), { opacity: 0, duration: 0.2 }, 0)
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
    else if (locked) own = `<div class="cm-own lockedtxt">🔒 Not in your collection yet.<br>Find it in 🎁 card packs (won in battle): <b>${(MB.UI.dropChance(def.id) * 100).toFixed(1)}%</b> per pack card${MB.STORY.some((s) => s.foe === def.id) ? ' — or beat them in Story' : ''}.</div>`;
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

  // ---------------------------------------------------------------- new card / picture reveal
  // items: card ids, or { card } / { avatar } from a pack
  let revealing = false;
  function revealLayer() {
    const ov = el('div', 'rv', `<div class="rv-bg"></div><div class="rv-rays"></div><div class="rv-fx"></div>
      <div class="rv-title"></div><div class="rv-sub"></div><div class="rv-hint">Click to continue</div><div class="rv-flash"></div>`);
    root().appendChild(ov);
    gsap.fromTo(ov.querySelector('.rv-bg'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    return ov;
  }
  async function reveal(items, ov) {
    if (!items.length && !ov) return;
    revealing = true;
    ov = ov || revealLayer();
    for (let i = 0; i < items.length; i++) await revealOne(ov, items[i], i, items.length);
    await gsap.to(ov, { opacity: 0, duration: 0.35 });
    ov.remove();
    revealing = false;
  }

  // a profile picture framed like a card, at reveal size
  function avatarCard(id, w, h) {
    const a = MB.UI.avatarById(id);
    const c = el('div', 'rv-pfp', `<img src="${MB.avatarUrl(id)}" alt=""><div class="rv-pfp-name">${a.name}</div><div class="rv-pfp-tag">PROFILE PICTURE</div>`);
    Object.assign(c.style, { width: w + 'px', height: h + 'px' });
    c.appendChild(el('div', 'glare'));
    return c;
  }

  const AVATAR_COLOR = '#ff6fae';
  function revealOne(ov, item, i, n) {
    const it = typeof item === 'string' ? { card: item } : item;
    const X = 800, Y = 440, S = 1.9;
    const def = it.card && defOf(it.card), r = def ? rarityOf(def) : null;
    const col = r ? r.color : AVATAR_COLOR, lvl = r ? Math.max(1, r.stars) : 2;
    const layer = ov.querySelector('.rv-fx'), rays = ov.querySelector('.rv-rays'), flash = ov.querySelector('.rv-flash');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub'), hint = ov.querySelector('.rv-hint');
    ov.style.setProperty('--rc', col);
    const glow = el('div', 'rv-glow');
    const back = el('div', 'rv-back', '<div class="rv-back-emblem">✦</div>');
    const card = def ? bigCard(it.card).c : avatarCard(it.avatar, W * S, H * S);
    if (def) card.style.zoom = S;
    const front = el('div', 'rv-front');
    Object.assign(front.style, { width: W * S + 'px', height: H * S + 'px' });
    front.appendChild(card);
    ov.insertBefore(glow, layer); ov.insertBefore(back, layer); ov.insertBefore(front, layer);
    gsap.set([glow, back, front], { x: X, y: Y, xPercent: -50, yPercent: -50 });
    gsap.set(front, { rotationY: -90, opacity: 0, transformPerspective: 1200 });
    gsap.set(glow, { opacity: 0 });
    title.textContent = def ? r.name.toUpperCase() + '!' : 'NEW PICTURE!';
    title.style.color = col;
    const count = n > 1 ? ` <small>(${i + 1}/${n})</small>` : '';
    sub.innerHTML = def ? `<b>${def.name}</b> joined your collection${count}`
      : `<b>${MB.UI.avatarById(it.avatar).name}</b> is now a profile picture${count}`;
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

  // ---------------------------------------------------------------- pack opening
  // the pack drops in; clicking it tears the top off, then each item is revealed
  function openPack(tier, items, fromEl) {
    revealing = true;
    const p = MB.PACKS[tier], col = p.color, lvl = { common: 1, rare: 2, epic: 3 }[tier] || 1;
    const X = 800, Y = 450, PW = 346, PH = 560, TEAR = 0.15; // TEAR: the strip that rips off, as a share of the height
    const ov = revealLayer();
    ov.style.setProperty('--rc', col);
    const layer = ov.querySelector('.rv-fx'), flash = ov.querySelector('.rv-flash'), rays = ov.querySelector('.rv-rays');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub');
    const glow = el('div', 'rv-glow');
    const pack = el('div', 'rv-pack', '<div class="rv-pack-body"></div><div class="rv-pack-top"></div>');
    Object.assign(pack.style, { width: PW + 'px', height: PH + 'px' });
    pack.style.setProperty('--art', `url("${MB.packArt(tier)}")`);
    pack.style.setProperty('--tear', TEAR * 100 + '%');
    ov.insertBefore(glow, layer); ov.insertBefore(pack, layer);
    const top = pack.querySelector('.rv-pack-top'), body = pack.querySelector('.rv-pack-body');
    title.textContent = p.name.toUpperCase();
    title.style.color = col;
    sub.textContent = 'Click the pack to tear it open';
    const from = fromEl && fromEl.isConnected ? rectOf(fromEl) : { x: X, y: -300, w: PW };
    gsap.set([pack, glow], { x: X, y: Y, xPercent: -50, yPercent: -50 });
    gsap.set(glow, { opacity: 0 });
    gsap.set([title, sub, ov.querySelector('.rv-hint')], { opacity: 0 });

    const idle = [];
    const intro = gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(pack, { x: from.x, y: from.y, scale: from.w / PW, rotation: -12 }, { x: X, y: Y, scale: 1, rotation: 0, duration: 0.75, ease: 'back.out(1.4)' })
      .to(glow, { opacity: 0.6, scale: 1.1, duration: 0.5 }, '<0.3')
      .fromTo(title, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, '<')
      .to(sub, { opacity: 0.85, duration: 0.4 })
      .call(() => {
        idle.push(gsap.to(pack, { y: Y - 14, rotation: 2, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        idle.push(gsap.to(glow, { scale: 1.25, opacity: 0.8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      });

    return new Promise((res) => {
      const onClick = (e) => {
        if (e.button !== 0) return;
        if (intro.progress() < 1) { intro.progress(1); return; } // first click skips the drop-in
        ov.removeEventListener('pointerdown', onClick);
        idle.forEach((t) => t.kill());
        const charge = 0.3 + lvl * 0.25, lip = Y - PH / 2 + PH * TEAR;
        const tl = gsap.timeline({ onComplete: () => { pack.remove(); glow.remove(); reveal(items, ov).then(res); } });
        tl.to([title, sub], { opacity: 0, duration: 0.2 }, 0)
          .to(pack, { y: Y, rotation: 0, scale: 1.04, duration: 0.15 }, 0)
          .fromTo(pack, { x: X - 4 * lvl }, { x: X + 4 * lvl, duration: 0.05, repeat: Math.round(charge / 0.05), yoyo: true, ease: 'none' }, 0.15)
          .to(glow, { opacity: 1, scale: 1.2 + lvl * 0.15, duration: charge, ease: 'power1.in' }, 0.15)
          .call(() => converge(layer, X, Y, col, 14 * lvl, charge), null, 0.15)
          .set(pack, { x: X }, 0.15 + charge)
          // rip: the top strip flies off and light pours out of the opening
          .call(() => {
            MB.audio.sfx('slam');
            MB.audio.sfx(lvl >= 3 ? 'win' : 'sparkle');
            spray(layer, X, lip, col, 30 + lvl * 15, { dist: [120, 460], size: [5, 14], gravity: -40 });
            spray(layer, X, lip, '#ffffff', 16, { dist: [80, 300], size: [3, 7], gravity: -40 });
            ring(layer, X, lip, col, { size: 180, scale: 4 + lvl, dur: 0.8 });
          })
          .to(top, { x: 260, y: -260, rotation: 50, opacity: 0, duration: 0.7, ease: 'power2.out' })
          .fromTo(flash, { opacity: 0 }, { opacity: 0.35 + lvl * 0.15, duration: 0.06 }, '<')
          .to(flash, { opacity: 0, duration: 0.5 })
          .fromTo(rays, { opacity: 0, scale: 0.2 }, { opacity: 0.2 + lvl * 0.1, scale: 1, duration: 0.6 }, '<')
          .to(body, { y: 420, rotation: -6, opacity: 0, duration: 0.55, ease: 'power2.in' }, '<0.15')
          .to([glow, rays], { opacity: 0, duration: 0.3 }, '<0.2');
        if (!items.length) {
          tl.call(() => { sub.textContent = 'Nothing new inside — your collection is complete!'; gsap.to(sub, { opacity: 1, duration: 0.3 }); });
          tl.to({}, { duration: 1.6 });
        }
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

  // intros, moves and scenes: for tools/check_game.js
  MB.Cards = { bind, open, close, reveal, openPack, flyToDeck, burst, intros: INTRO, styleIntros: STYLE_INTROS, moves: MOVES, scenes: SCENES,
    sceneVariants: SCENE_VARIANTS, backdrops: BACKDROPS };
})();
