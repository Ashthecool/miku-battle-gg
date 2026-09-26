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
    // tiny at first, then too big, then settles (ENLARGO)
    grow:  (sp) => gsap.timeline().fromTo(sp, { scale: 0.15, opacity: SPRITE_OP, transformOrigin: '50% 100%' }, { scale: 1.25, duration: 0.5, ease: 'back.out(1.4)' })
      .to(sp, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' }),
    // a portal opens where they stand and they step out of it
    portal: (sp, L, c) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      let gate;
      tl.call(() => {
        const p = spot(sp), h = (p.bottom - p.top) * 0.95;
        gate = fxEl(L, 'cm-portal', '<i></i>', c);
        Object.assign(gate.style, { width: h * 0.55 + 'px', height: h + 'px' });
        gsap.set(gate, { x: p.x, y: p.bottom, xPercent: -50, yPercent: -100, transformOrigin: '50% 100%' });
        gsap.fromTo(gate, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
        gsap.to(gate.firstChild, { rotation: 360, duration: 1.2, ease: 'none', repeat: 1 });
        MB.audio.sfx('warp');
      })
        .fromTo(sp, { scale: 0.2, rotationY: -360, opacity: 0, transformOrigin: '50% 100%' }, { scale: 1, rotationY: 0, opacity: SPRITE_OP, duration: 0.55, ease: 'back.out(1.6)' }, 0.4)
        .call(() => gsap.to(gate, { scaleX: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => gate.remove() }), null, 1);
      return tl;
    },
    // walks in slowly from the side, hips swaying, like a red carpet
    strut: (sp) => gsap.timeline().fromTo(sp, { x: 520, opacity: SPRITE_OP }, { x: 0, duration: 1.2, ease: 'sine.out' })
      .fromTo(sp, { rotation: -3, transformOrigin: '50% 100%' }, { rotation: 3, duration: 0.2, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0)
      .to(sp, { rotation: 0, duration: 0.2 }),
  };
  const LANDING = { drop: 'slam', slide: 'hit', hop: 'boing', zoom: 'hit', pop: 'pop', grow: 'stomp' };
  // clouds of smoke billowing round the sprite (a quick change, a smoke bomb)
  function smoke(L, p, n = 14) {
    for (let i = 0; i < n; i++) {
      const s = fxEl(L, 'cm-smoke');
      const x = p.x + rnd(-p.w * 0.45, p.w * 0.45), y = rnd(p.top + 60, p.bottom - 40);
      gsap.fromTo(s, { x, y, xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0.95 },
        { x: x + rnd(-90, 90), y: y - rnd(20, 120), scale: rnd(1.6, 2.6), opacity: 0, duration: rnd(0.8, 1.3), ease: 'power1.out', onComplete: () => s.remove() });
    }
  }
  function customIntro(sp, L, c, ov, def) {
    const o = def.intro, em = o.emoji || ['✨'], move = MOVES[o.move] || MOVES.pop, fx = o.fx || 'spray';
    const tl = gsap.timeline();
    const before = fx === 'swirl' || fx === 'rain';
    if (before) tl.call(() => {
      const p = spot(sp);
      if (fx === 'swirl') swirl(L, p.x, p.y, em, 20, 1); else rain(L, p.x - 320, p.x + 320, p.bottom, em, 22, 0.6);
      MB.audio.sfx(o.sfx || 'sparkle');
    });
    tl.add(move(sp, L, c), before ? 0.35 : 0).call(() => {
      const p = spot(sp);
      if (LANDING[o.move]) MB.audio.sfx(LANDING[o.move]);
      if (o.move === 'drop') { shake(ov, 14); ring(L, p.x, p.bottom - 30, c, { size: 200, scale: 4, width: 8 }); feetDust(L, sp); }
      if (fx === 'fling') fling(L, p.x, p.y, em, 14);
      else if (fx === 'confetti') confetti(L, p.x, p.top + 120, 40);
      else if (fx === 'column') { column(L, 'cm-light', p, c, 0.6); riseFrom(L, p.x, p.bottom, [c, '#ffffff'], 30, 0.8); }
      else if (fx === 'flash') { screenFlash(L, c, 0.6); spray(L, p.x, p.y, c, 30, { dist: [140, 420], stars: 0.6 }); }
      else if (fx === 'smoke') { smoke(L, p); spray(L, p.x, p.y, c, 16, { dist: [100, 300], stars: 0.5 }); }
      else if (!before) spray(L, p.x, p.y, c, 36, { dist: [140, 440], stars: 0.6 });
      if (!before && o.sfx) MB.audio.sfx(o.sfx);
      word(L, p.x, p.top + 60, line(def, 'Hi!'), c, 46);
    });
    if (o.move === 'drop' || o.move === 'hop' || o.move === 'grow') tl.add(squash(sp));
    if (o.move === 'grow') tl.call(() => { const p = spot(sp); shake(ov, 16); ring(L, p.x, p.bottom - 30, c, { size: 220, scale: 4, width: 10 }); feetDust(L, sp); }, null, 0.5);
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
    enlargo: { move: 'grow', fx: 'flash', sfx: 'grow' }, hora: { move: 'fade', fx: 'swirl', emoji: ['💜', '👑', '🌀'], sfx: 'hypno' },
    riff: { move: 'drop', fx: 'fling', emoji: ['🎸', '🤘', '⚡'], sfx: 'guitar' }, pizza: { move: 'hop', fx: 'fling', emoji: ['🍕', '🍅', '🧀'] },
    barslide: { move: 'slide', fx: 'fling', emoji: ['🍺', '🤠', '🥃'], sfx: 'slide' }, coinflip: { move: 'pop', fx: 'rain', emoji: ['🪙', '💸', '🪙'], sfx: 'flip' },
    formo: { move: 'pop', fx: 'smoke', sfx: 'poof' }, yandere: { move: 'fade', fx: 'fling', emoji: ['♥', '💌', '🪓'], sfx: 'axe' },
    piano: { move: 'fade', fx: 'swirl', emoji: ['🎹', '🎵', '🎶'], sfx: 'piano' }, siren: { move: 'rise', fx: 'swirl', emoji: ['🎵', '🫧', '🐚'], sfx: 'siren' },
    icecross: { move: 'fade', fx: 'column', sfx: 'freeze' }, trashfire: { move: 'sneak', fx: 'smoke', sfx: 'fire' },
    mercy: { move: 'fade', fx: 'swirl', emoji: ['🕊️', '🪶', '🤍'], sfx: 'flutter' }, teaspill: { move: 'sneak', fx: 'fling', emoji: ['🍵', '🌸'] },
    redcarpet: { move: 'strut', fx: 'flash', sfx: 'camera' }, wires: { move: 'sneak', fx: 'fling', emoji: ['💰', '💎', '👛'] },
    mamabear: { move: 'drop', fx: 'fling', emoji: ['🐻', '💚', '🧸'], sfx: 'stomp' }, rainbow: { move: 'hop', fx: 'swirl', emoji: ['🌈', '☀️', '💖'], sfx: 'sparkle' },
    leftonread: { move: 'sneak', fx: 'fling', emoji: ['📱', '💬', '🙄'], sfx: 'tick' }, glomp: { move: 'pop', fx: 'fling', emoji: ['💕', '🤗', '💖'], sfx: 'heartbeat' },
    touchdown: { move: 'slide', fx: 'fling', emoji: ['🏈', '💨', '🏟️'], sfx: 'whistle' }, squeak: { move: 'pop', fx: 'fling', emoji: ['📣', '💚', '✨'], sfx: 'squeak' },
    kindness: { move: 'rise', fx: 'fling', emoji: ['🌼', '😊', '💛'], sfx: 'ding' }, sugarrush: { move: 'slide', fx: 'rain', emoji: ['🍬', '🍭', '🧁'], sfx: 'zip' },
    gavel: { move: 'strut', fx: 'fling', emoji: ['🔨', '📄', '🗳️'], sfx: 'bonk' }, nuhuh: { move: 'spin', fx: 'swirl', emoji: ['❄️', '💅', '✨'], sfx: 'frost' },
    stainedglass: { move: 'fade', fx: 'column', sfx: 'choir' }, tantrum: { move: 'drop', fx: 'smoke', sfx: 'stomp' },
    harp: { move: 'fade', fx: 'swirl', emoji: ['🎵', '📚', '🍂'], sfx: 'melody' },
    pronk: { move: 'hop', fx: 'confetti', sfx: 'squeak' }, kickflip: { move: 'slide', fx: 'spray', sfx: 'zip' },
    lunchrush: { move: 'hop', fx: 'fling', emoji: ['🍱', '🥪', '🧃'] }, present: { move: 'pop', fx: 'rain', emoji: ['🎄', '❄️', '🎁'] },
    livestream: { move: 'zoom', fx: 'flash', sfx: 'ding' }, boxingroo: { move: 'hop', fx: 'fling', emoji: ['🥊', '🦘', '💥'], sfx: 'ding' },
    haiku: { move: 'fade', fx: 'swirl', emoji: ['📄', '📜', '🐐'] }, bigl: { move: 'strut', fx: 'flash', sfx: 'laugh' },
    lockdown: { move: 'drop', fx: 'flash', sfx: 'whistle' }, evaluation: { move: 'strut', fx: 'fling', emoji: ['📋', '📄', '🦌'], sfx: 'crinkle' },
    rift: { move: 'portal', fx: 'fling', emoji: ['🌀', '⚛️', '📐'] }, flambe: { move: 'slide', fx: 'fling', emoji: ['🍸', '🍹', '🔥'] },
    finishline: { move: 'zoom', fx: 'flash', sfx: 'camera' }, multiverse: { move: 'portal', fx: 'swirl', emoji: ['🌀', '🧪', '💖'] },
    nat20: { move: 'pop', fx: 'rain', emoji: ['🎲', '⚔️', '🐉'], sfx: 'ding' }, tear: { move: 'fade', fx: 'column', sfx: 'glitch' },
    timber: { move: 'drop', fx: 'fling', emoji: ['🌲', '🍃', '🪓'], sfx: 'axe' },
    justmonika: { move: 'fade', fx: 'rain', emoji: ['💚', '📝', '🎹'], sfx: 'piano' }, toastdash: { move: 'slide', fx: 'fling', emoji: ['🍞', '⏰', '💕'], sfx: 'zip' },
    mangapanel: { move: 'drop', fx: 'fling', emoji: ['📘', '🧁', '💢'], sfx: 'bonk' }, inkbound: { move: 'fade', fx: 'swirl', emoji: ['📕', '🍵', '🪻'], sfx: 'crinkle' },
    choice: { move: 'pop', fx: 'fling', emoji: ['📗', '✏️', '❓'] }, pentagram: { move: 'rise', fx: 'column', sfx: 'fire' },
    devtail: { move: 'strut', fx: 'fling', emoji: ['💋', '😈', '💚'], sfx: 'kiss' }, queenshadow: { move: 'fade', fx: 'column', sfx: 'choir' },
    ibeam: { move: 'drop', fx: 'fling', emoji: ['⛑️', '🔧', '🚧'], sfx: 'clang' }, yarn: { move: 'sneak', fx: 'swirl', emoji: ['🧶', '💜', '🧣'] },
    strays: { move: 'slide', fx: 'fling', emoji: ['🐈', '🐕', '🐾'], sfx: 'whistle' }, musclefive: { move: 'hop', fx: 'fling', emoji: ['💪', '🥊', '⚾'], sfx: 'punch' },
    ghoststory: { move: 'sneak', fx: 'smoke', sfx: 'wobble' }, checkmate: { move: 'strut', fx: 'fling', emoji: ['♛', '♞', '📚'], sfx: 'tick' },
    micdrop: { move: 'slide', fx: 'fling', emoji: ['🎤', '📻', '😎'], sfx: 'thud' }, fakecry: { move: 'strut', fx: 'flash', sfx: 'camera' },
    oilrig: { move: 'drop', fx: 'rain', emoji: ['💸', '💳', '💎'], sfx: 'coin' }, likestorm: { move: 'zoom', fx: 'swirl', emoji: ['❤️', '👍', '✌️'], sfx: 'camera' },
    quill: { move: 'fade', fx: 'swirl', emoji: ['📚', '🪶', '🍷'], sfx: 'crinkle' }, warmap: { move: 'drop', fx: 'fling', emoji: ['💂', '🗺️', '⚔️'], sfx: 'drumroll' },
  };
  // a recipe attack (fx.js) enters the way it moves, flinging its props
  const RECIPE_ENTRANCE = { stay: 'pop', float: 'fade', dash: 'slide', leap: 'drop', blink: 'zoom', spin: 'spin', hop: 'hop', zigzag: 'slide',
    fly: 'drop', dive: 'rise', charge: 'slide', slide: 'slide', portal: 'portal' };
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
  // a crush hands over a love letter, partners pose back to back, a mentor powers up the student. Plus the variants
  // any fitting kind can pick: a mirror, a duel, a tug of war, a hypnosis attempt, a photoshoot, a bear hug, a night at
  // the bar, a concert, cooking together, etiquette lessons, a grape harvest, a dress-up, and the cross-novel ones: a job
  // interview, stand-up night, bartender flair, a night patrol, a confession, a photo shrine, a chalkboard proof, a boxing
  // match, a scheme, a bake-off, a rescue, a nap, poker night, an auction, a spooky reading.
  // Every scene takes: lines (2+, alternating, or { by: 0|1, text }), backdrop, emoji, word.
  // Positions are measured when each step runs.
  const KINDS = { lovers: '💞', family: '🏠', rivals: '⚔️', friends: '🤝', school: '📚', crush: '💓', partners: '😎', mentor: '🎓' };
  // the scene variants of each kind (the first is the default)
  const SCENE_VARIANTS = { lovers: ['cuddle', 'date', 'dance', 'photoshoot', 'bar', 'cook', 'dreamhome', 'flair', 'rescue', 'nap'],
    family: ['laugh', 'meal', 'movie', 'strict', 'game', 'photoshoot', 'bearhug', 'bar', 'etiquette', 'harvest', 'cook', 'concert',
      'ritual', 'prayer', 'dreamhome', 'grill', 'streak', 'pushups', 'late', 'bakeoff', 'nap', 'reading'],
    rivals: ['clash', 'race', 'mirror', 'duel', 'tug', 'hypnosis', 'debate', 'roast', 'standup', 'confession', 'shrine', 'boxing', 'bakeoff', 'poker', 'auction'],
    friends: ['highfive', 'selfie', 'game', 'cook', 'dressup', 'bar', 'concert', 'bearhug', 'photoshoot', 'harvest', 'poem', 'late', 'grill', 'pushups', 'prayer',
      'standup', 'flair', 'rescue', 'nap', 'poker', 'bakeoff', 'reading'],
    school: ['club', 'class', 'concert', 'etiquette', 'poem', 'debate', 'solve', 'reading'], crush: ['solve'], partners: ['duel', 'mirror', 'ritual', 'patrol', 'scheme', 'boxing'],
    mentor: ['concert', 'duel', 'etiquette', 'ritual', 'interview'] };
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
  // the same n times, one every sec
  const times = (n, sec, fn) => gsap.timeline({ repeat: n - 1 }).call(fn).to({}, { duration: sec });

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
        .call(() => { const p = midOf(S); word(L, p.x - 90, p.y - 60, S.cfg.word || 'HAHA!', c, 46); word(L, p.x + 90, p.y - 20, 'HAHAHA!', c, 40); fling(L, p.x, p.y, laughs, 8, { gravity: -30 }); MB.audio.sfx('laugh'); }, null, t);

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
      if (cfg.guard) guardUp(S, tl.to(vs, { opacity: 0, scale: 0.5, duration: 0.3 }, 5 + X), 5 + X, [ca, cb], 60);
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

  // rivals who agree on one thing: nobody touches their human. Both step up to the viewer, each raising their own
  // power as a barrier (cfg.guard: a line each; cfg.guardEmoji, cfg.guardWord), then straight back to glaring,
  // `spread` apart
  function guardUp(S, tl, at, [ca, cb], spread = 0) {
    const { a, b, L, cfg } = S, chars = cfg.guardEmoji || [['🔥', '🔥', '✨'], ['🪶', '✨', '🪶']];
    return tl.to([a, b], { rotation: 0, scale: 1.08, y: 10, duration: 0.35, ease: 'power2.out' }, at)
      .call(() => {
        MB.audio.sfx('shield');
        [[a, ca, chars[0]], [b, cb, chars[1]]].forEach(([im, col, ch], i) => {
          const h = headOf(S, im), cx = h.x, cy = h.y + im.offsetHeight * 0.45;
          ring(L, cx, cy, col, { size: 260, scale: 1.6, dur: 1.1, width: 10 });
          fling(L, cx, cy, ch, 8, { dist: [80, 240], gravity: -80 });
          gsap.delayedCall(i * 1.2, () => say(S, im, cfg.guard[i], 1.4));
        });
        word(L, midOf(S).x, 110, cfg.guardWord || 'FOR THE HUMAN!', '#ffffff', 50);
      }, null, at + 0.2)
      .to([a, b], { scale: 1, y: 0, duration: 0.4, ease: 'power2.inOut' }, at + 2.9)
      .to(a, { rotation: 6, x: -spread, duration: 0.25 }, at + 3.1).to(b, { rotation: -6, x: spread, duration: 0.25 }, at + 3.1)
      .call(() => { [a, b].forEach((im, i) => { const h = headOf(S, im); word(L, h.x + (i ? -70 : 70), h.y + 30, '💢', '#ff3b3b', 44); }); }, null, at + 3.2);
  }
  // where a partner's head is right now, moves included (headOf is where it stands); h: its height
  const liveHead = (im) => { const r = im.getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top); return { x: p.x, y: p.y, h: r.height / p.s }; };
  // a point across a partner (f: 0 left edge .. 1 right edge) in the duo box's own coordinates, for placing props
  const boxX = (S, im, f = 0.5) => { const r = im.getBoundingClientRect(), br = S.box.getBoundingClientRect(); return (r.left + r.width * f - br.left) / toUi(0, 0).s; };
  // a flashbulb going off somewhere off to the side of the pair
  function flashbulb(S) {
    const bx = S.box.offsetLeft, x = Math.random() < 0.5 ? rnd(bx - 220, bx + 60) : rnd(bx + S.box.offsetWidth - 80, 1600), y = rnd(240, 820);
    const f = fxEl(S.L, 'cm-camflash');
    gsap.fromTo(f, { x, y, xPercent: -50, yPercent: -50, scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.3, onComplete: () => f.remove() });
  }

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

    // alternate selves: a mirror stands between them and each copies the other's every move... until one doesn't
    mirror: (S) => {
      const { a, b, L, c, cfg } = S, frame = prop(S, 'cm-mirror', '<i></i>', 0), shine = frame.firstChild;
      const tl = gsap.timeline()
        .fromTo(frame, { xPercent: -50, scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0)
        .call(() => { const p = midOf(S); MB.audio.sfx('sparkle'); spray(L, p.x, p.y, '#dff6ff', 18, { dist: [60, 220], stars: 0.8 }); }, null, 0.3)
        .fromTo(shine, { xPercent: -120 }, { xPercent: 120, duration: 0.8, ease: 'power1.inOut' }, 0.4)
        .fromTo(a, { x: -360, opacity: 0 }, { x: -50, opacity: SPRITE_OP, duration: 0.7, ease: 'power2.out' }, 0.2)
        .fromTo(b, { x: 360, opacity: 0 }, { x: 50, opacity: SPRITE_OP, duration: 0.7, ease: 'power2.out' }, 0.2);
      // three moves, each copied a beat later, mirrored
      [{ y: -40, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, { rotation: 10, duration: 0.25, yoyo: true, repeat: 1 },
        { rotationY: 360, duration: 0.5, ease: 'power2.inOut' }].forEach((m, i) => {
        const at = 1.1 + i * 0.75, mm = m.rotation ? { ...m, rotation: -m.rotation } : m;
        tl.to(a, m, at).to(b, mm, at + 0.15)
          .call(() => { MB.audio.sfx(i === 2 ? 'whoosh' : 'pop'); [a, b].forEach((im) => { const h = headOf(S, im); word(L, h.x, h.y + 30, '♪', c, 30); }); }, null, at);
      });
      tl.set([a, b], { rotationY: 0 }, 3.4)
        .to(b, { y: -60, rotation: -14, duration: 0.2, yoyo: true, repeat: 1 }, 3.5) // ...that one wasn't copied
        .call(() => { const h = headOf(S, a); mood(S, a, 'lose'); word(L, h.x, h.y + 20, '!?', c, 56); MB.audio.sfx('squeak'); }, null, 3.8)
        .to(a, { x: -10, duration: 0.25 }, 3.9).to(b, { x: 10, duration: 0.25 }, 3.9) // leaning in for a closer look
        .call(() => { // the mirror gives up
          const p = midOf(S);
          MB.audio.sfx('glass'); shake(S.ov, 12); screenFlash(L, '#ffffff', 0.5);
          fling(L, p.x, p.y, ['✨', '💎', '🪞'], 16, { gravity: 120 }); spray(L, p.x, p.y, '#dff6ff', 30, { dist: [80, 360], stars: 0.6 });
          word(L, p.x, p.y - 150, S.cfg.word || 'DOPPELGÄNGER!', c, 54); mood(S, a, 'attack'); mood(S, b, 'taunt');
        }, null, 4.3)
        .to(frame, { opacity: 0, scale: 1.2, duration: 0.3 }, 4.3)
        .to(a, { x: -40, duration: 0.3 }, 4.4).to(b, { x: 40, duration: 0.3 }, 4.4);
      talk(S, tl, 5);
      return { tl, idle: () => [
        gsap.to(a, { rotation: 3, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(b, { rotation: -3, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // still in sync
        every(1.4, () => floatUp(S, cfg.emoji || ['✨', '🪞', '💫'], midOf(S), 1, [20, 30])),
      ] };
    },

    // a duel: they face off far apart, the lines, hands on hilts, a leaf falls... one dash past each other, a beat
    // of silence, and one of them (cfg.winner: 0 or 1; both without it) drops
    duel: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], loser = cfg.winner == null ? null : cfg.winner ? a : b;
      const tl = gsap.timeline()
        .fromTo(a, { x: -420, opacity: 0 }, { x: -140, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 420, opacity: 0 }, { x: 140, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .call(() => MB.audio.sfx('wind'), null, 0.4);
      talk(S, tl, 0.9);
      const t0 = afterTalk(S, 0.9);
      tl.call(() => { MB.audio.sfx('unsheathe'); [a, b].forEach((im, i) => { mood(S, im, 'attack'); const h = liveHead(im); word(L, h.x + (i ? -40 : 40), h.y + 60, '✦', i ? cb : ca, 50); }); }, null, t0)
        .to([a, b], { scaleY: 0.94, y: 12, duration: 0.3 }, t0)
        .call(() => {
          const p = midOf(S), lf = fxEl(L, 'cm-emoji', '🍂');
          lf.style.fontSize = '40px';
          gsap.fromTo(lf, { x: p.x + 120, y: p.y - 260, xPercent: -50, yPercent: -50 }, { x: p.x - 40, y: p.y + 140, rotation: 360, duration: 1.2, ease: 'sine.inOut', onComplete: () => lf.remove() });
        }, null, t0 + 0.3)
        .call(() => { MB.audio.sfx('swish'); screenFlash(L, '#ffffff', 0.7); }, null, t0 + 1.6)
        .to(a, { x: 180, duration: 0.14, ease: 'power4.in', onUpdate: () => afterimage(a) }, t0 + 1.6)
        .to(b, { x: -180, duration: 0.14, ease: 'power4.in', onUpdate: () => afterimage(b) }, t0 + 1.6)
        .call(() => { const p = midOf(S); slashLine(L, p.x, p.y, -18, ca); slashLine(L, p.x, p.y + 60, 14, cb); }, null, t0 + 1.72)
        .to([a, b], { scaleY: 1, y: 0, duration: 0.2 }, t0 + 1.8)
        .call(() => { const p = midOf(S); word(L, p.x, p.y - 180, '. . .', '#ffffff', 60); }, null, t0 + 2)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('gong'); MB.audio.sfx('bond', S.tier); shake(S.ov, 14);
          if (loser) { mood(S, loser, 'lose'); mood(S, loser === a ? b : a, 'win'); const h = liveHead(loser); word(L, h.x, h.y + 40, '💫', '#ffe066', 56); } else [a, b].forEach((im) => mood(S, im, 'lose'));
          spray(L, p.x, p.y, ca, 24, { dist: [80, 300] }); spray(L, p.x, p.y, cb, 24, { dist: [80, 300] });
          word(L, p.x, p.y - 150, cfg.word || 'IPPON!', c, 64);
        }, null, t0 + 2.8);
      if (loser) tl.to(loser, { rotation: loser === a ? -10 : 10, y: 30, scaleY: 0.9, duration: 0.4, ease: 'power2.in' }, t0 + 2.85);
      else {
        tl.to([a, b], { rotation: (i) => (i ? 10 : -10), y: 30, scaleY: 0.9, duration: 0.4, ease: 'power2.in' }, t0 + 2.85)
          .call(() => [a, b].forEach((im, i) => { mood(S, im, 'attack'); const h = liveHead(im); word(L, h.x + (i ? -70 : 70), h.y + 30, '💢', '#ff3b3b', 44); }), null, t0 + 3.8);
      }
      tl.to([a, b], { x: 0, rotation: 0, y: 0, scaleY: 1, duration: 0.6, ease: 'power2.inOut' }, t0 + 4.3); // back to their places
      return { tl, idle: () => [
        gsap.to([a, b], { y: -6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.5, () => { // the wind never stops
          const p = midOf(S), lf = fxEl(L, 'cm-emoji', MB.pick(cfg.emoji || ['🍃', '🍂', '🌸']));
          lf.style.fontSize = rnd(20, 32) + 'px';
          gsap.fromTo(lf, { x: p.x + 500, y: rnd(p.y - 260, p.y + 200), xPercent: -50, yPercent: -50 }, { x: p.x - 600, y: `+=${rnd(-60, 120)}`, rotation: rnd(-360, 360), duration: rnd(1.6, 2.4), ease: 'none', onComplete: () => lf.remove() });
        }),
      ] };
    },

    // tug of war: a rope between them (cfg.emoji[0] tied in the middle), both heave, back and forth... and it snaps
    tug: (S) => {
      const { a, b, L, c, cfg } = S, rope = prop(S, 'cm-rope', `<b>${cfg.emoji ? cfg.emoji[0] : '🎀'}</b>`, 2), home = [-40, 40, 0];
      const tl = gsap.timeline()
        .fromTo(a, { x: -400, opacity: 0 }, { x: -40, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 400, opacity: 0 }, { x: 40, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .call(() => {
          const x0 = boxX(S, a, 0.55), x1 = boxX(S, b, 0.45);
          Object.assign(rope.style, { left: x0 + 'px', width: Math.max(80, x1 - x0) + 'px', top: Math.min(a.offsetTop, b.offsetTop) + a.offsetHeight * 0.5 + 'px' });
          MB.audio.sfx('twang');
        }, null, 0.65)
        .fromTo(rope, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3 }, 0.7)
        .to(a, { rotation: -12, duration: 0.3 }, 0.9).to(b, { rotation: 12, duration: 0.3 }, 0.9); // leaning back
      [-1, 1, -1, 1].forEach((dir, i) => {
        const at = 1.3 + i * 0.5;
        tl.to([a, b, rope], { x: (j) => home[j] + dir * 50, duration: 0.35, ease: 'power2.inOut' }, at)
          .call(() => { const h = liveHead(dir < 0 ? a : b); word(L, h.x, h.y + 40, MB.pick(['HNNG!', 'PULL!', 'GRRR!']), c, 40); MB.audio.sfx('stretch'); }, null, at);
      });
      const snap = 3.5;
      tl.to([a, b, rope], { x: (j) => home[j], duration: 0.2 }, snap - 0.25)
        .call(() => { const p = midOf(S); MB.audio.sfx('twang'); MB.audio.sfx('pop'); shake(S.ov, 12); word(L, p.x, p.y - 140, cfg.word || 'SNAP!', c, 64); spray(L, p.x, p.y, '#d9b77a', 20, { dist: [60, 240], stars: 0 }); }, null, snap)
        .to(rope, { scaleX: 0, opacity: 0, duration: 0.2 }, snap)
        .to(a, { x: -140, rotation: -30, y: 40, duration: 0.35, ease: 'power2.out' }, snap)
        .to(b, { x: 140, rotation: 30, y: 40, duration: 0.35, ease: 'power2.out' }, snap)
        .call(() => [a, b].forEach((im) => { mood(S, im, 'lose'); const h = liveHead(im); word(L, h.x, h.y + 20, '💫', '#ffe066', 50); MB.audio.sfx('bonk'); }), null, snap + 0.35)
        .to([a, b], { x: (i) => (i ? 40 : -40), rotation: 0, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, snap + 1.3)
        .call(() => [a, b].forEach((im) => mood(S, im, 'attack')), null, snap + 1.3);
      talk(S, tl, snap + 1.9);
      return { tl, idle: () => [
        gsap.to(a, { rotation: -3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(b, { rotation: 3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.5, () => { const h = liveHead(MB.pick([a, b])); word(L, h.x + rnd(-50, 50), h.y + 40, MB.pick(['💦', '💢']), '#8fe8ff', 30); }),
      ] };
    },

    // hypnosis: one (cfg.hypnotist: 0 or 1, default the first) swings a spiral in front of the other's face. It
    // almost works. Then a glint, and it doesn't. With cfg.guard they team up anyway afterwards
    hypnosis: (S) => {
      const { a, b, L, c, cfg } = S, [hyp, sub] = cfg.hypnotist ? [b, a] : [a, b], s = sub === b ? 1 : -1, [ca, cb] = cfg.colors || [c, '#ffffff'];
      const sp = prop(S, 'cm-spiral', MB.FX.spiralSvg(c, 240), 3), arms = sp.querySelectorAll('path');
      const tl = gsap.timeline()
        .fromTo(hyp, { x: -s * 400, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(sub, { x: s * 400, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0.1)
        .call(() => {
          Object.assign(sp.style, { left: boxX(S, sub) + 'px', top: sub.offsetTop + sub.offsetHeight * 0.22 + 'px' });
          if (window.DrawSVGPlugin) gsap.fromTo(arms, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6 });
          mood(S, hyp, 'taunt'); MB.audio.sfx('hypno');
        }, null, 0.7)
        .fromTo(sp, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.4, ease: 'back.out(2)' }, 0.7)
        .to(sp, { rotation: 1080, duration: 2.4, ease: 'none' }, 0.7)
        .to(hyp, { x: -s * 20, rotation: s * 6, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.8) // swinging it
        .to(sub, { rotation: s * 5, duration: 0.3, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 1.1) // swaying along
        .call(() => { const h = headOf(S, sub); mood(S, sub, 'lose'); word(L, h.x, h.y + 20, '@_@', c, 44); }, null, 1.3)
        .call(() => say(S, hyp, lineOf(S, 0).text, 1.4), null, 1.5)
        .call(() => { const h = headOf(S, sub); mood(S, sub, 'attack'); spray(L, h.x, h.y + 60, '#ffffff', 12, { dist: [20, 120], stars: 1 }); word(L, h.x, h.y + 40, '✦ *glint* ✦', '#ffffff', 34); MB.audio.sfx('ding'); }, null, 3)
        .to(sub, { rotation: 0, duration: 0.15 }, 3)
        .to(sp, { scale: 0, opacity: 0, rotation: '+=180', duration: 0.3 }, 3.2)
        .call(() => { MB.audio.sfx('glass'); const l = lineOf(S, 1); say(S, l.by ? b : a, l.text, 1.6); }, null, 3.3)
        .call(() => { const h = headOf(S, hyp); mood(S, hyp, 'lose'); word(L, h.x, h.y + 30, cfg.word || 'Hmph!', c, 44); word(L, h.x - s * 70, h.y + 20, '💢', '#ff3b3b', 44); MB.audio.sfx('bond', S.tier); }, null, 4.3)
        .to(hyp, { y: 10, scaleY: 0.96, duration: 0.2, yoyo: true, repeat: 1 }, 4.3);
      const n = Math.max(0, nLines(S) - 2);
      for (let i = 2; i < nLines(S); i++) { const l = lineOf(S, i); tl.call(() => say(S, l.by ? b : a, l.text), null, 5 + (i - 2) * 1.3); }
      if (cfg.guard) guardUp(S, tl, 5.2 + n * 1.3, [ca, cb]);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 2.2 }).to(hyp, { rotation: s * 6, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }) // still trying
          .call(() => { const h = headOf(S, sub); word(L, h.x, h.y + 40, '...', '#ffffff', 34); }, null, 0.6),
        gsap.to(sub, { y: -6, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.3, () => floatUp(S, cfg.emoji || ['🌀', '💜', '✨'], midOf(S), 1, [20, 30])),
      ] };
    },

    // a photoshoot: a red carpet, the flashbulbs go off, they strike pose after pose, and the magazine cover drops
    // (cfg.caption on it)
    photoshoot: (S) => {
      const { a, b, L, c, cfg } = S, rug = prop(S, 'cm-carpet', '', 0);
      const cover = prop(S, 'cm-polaroid cm-cover', `<div>${[a, b].map((im) => `<img src="${im.src}">`).join('')}</div><b>${cfg.caption || '✦ COVER STARS ✦'}</b>`, 3);
      cover.style.setProperty('--c', c);
      gsap.set(cover, { xPercent: -50, opacity: 0 });
      const tl = gsap.timeline()
        .fromTo(rug, { xPercent: -50, scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
        .fromTo([a, b], { y: 60, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.15, ease: 'power2.out' }, 0.3);
      const poses = [[a, { rotation: -6, scale: 1.05 }], [b, { rotation: 6, scale: 1.05 }], [a, { rotationY: 180 }], [b, { y: -30, rotation: -4 }],
        [[a, b], { rotation: (i) => (i ? -5 : 5), x: (i) => (i ? -20 : 20) }]];
      const calls = ['Fabulous!', 'Work it!', 'Gorgeous!', 'Yes! YES!', '✨ ICONIC ✨'];
      poses.forEach(([im, pose], i) => {
        const at = 1.1 + i * 0.7, last = i === poses.length - 1;
        tl.to(im, { ...pose, duration: 0.2, ease: 'back.out(3)' }, at)
          .call(() => {
            flashbulb(S); flashbulb(S); MB.audio.sfx('camera');
            [].concat(im).forEach((x) => mood(S, x, 'win'));
            const h = headOf(S, [].concat(im)[0]); word(L, h.x, h.y + 20, calls[i], c, last ? 48 : 36);
          }, null, at + 0.1);
        if (!last) tl.to(im, { rotation: 0, rotationY: 0, scale: 1, y: 0, duration: 0.25 }, at + 0.55);
      });
      const end = 1.1 + poses.length * 0.7;
      tl.call(() => { screenFlash(L, '#ffffff', 0.8); MB.audio.sfx('camera'); MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier); }, null, end)
        .fromTo(cover, { y: -400, opacity: 1, rotation: 15 }, { y: 0, rotation: -5, duration: 0.6, ease: 'bounce.out' }, end + 0.2)
        .to([a, b], { rotation: 0, x: 0, duration: 0.4 }, end + 0.3);
      talk(S, tl, end + 0.9);
      return { tl, idle: () => [
        every(0.4, () => { if (Math.random() < 0.6) flashbulb(S); }),
        gsap.to(cover, { rotation: 3, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.timeline({ repeat: -1, repeatDelay: 1.6 }).to(a, { rotation: -5, duration: 0.2 }).to(a, { rotation: 0, duration: 0.3, delay: 0.6 })
          .to(b, { rotation: 5, duration: 0.2 }).to(b, { rotation: 0, duration: 0.3, delay: 0.6 }),
      ] };
    },

    // a bear hug: one (cfg.hugger: 0 or 1, default the first) charges in, lifts the other clean off the ground,
    // squeezes, spins, and puts them down
    bearhug: (S) => {
      const { a, b, L, c, cfg } = S, [hug, held] = cfg.hugger ? [b, a] : [a, b], s = hug === a ? 1 : -1;
      const tl = gsap.timeline()
        .fromTo(held, { y: 40, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.5, ease: 'power2.out' }, 0)
        .call(() => MB.audio.sfx('whoosh'), null, 0.5)
        .fromTo(hug, { x: -s * 700, opacity: SPRITE_OP }, { x: s * 30, duration: 0.45, ease: 'power3.in', onUpdate: () => afterimage(hug) }, 0.5)
        .call(() => { const p = midOf(S); MB.audio.sfx('punch'); shake(S.ov, 14); word(L, p.x, p.y - 120, cfg.word || 'BRO HUG!', c, 60); mood(S, hug, 'win'); mood(S, held, 'lose'); ring(L, p.x, p.y, '#ffffff', { size: 140, scale: 4, width: 8 }); }, null, 0.95)
        .to(held, { y: -90, x: -s * 20, rotation: -s * 8, duration: 0.3, ease: 'power2.out' }, 1) // up it goes
        .to(hug, { y: -20, scaleY: 1.05, duration: 0.3 }, 1)
        .to(held, { scaleX: 0.88, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 1.4) // squeeze, squeeze
        .call(() => { const h = liveHead(held); word(L, h.x, h.y + 30, 'SQUEEZE!', c, 40); fling(L, h.x, h.y + 120, ['💪', '💢', '✨', '💦'], 10, { gravity: -30 }); MB.audio.sfx('squeak'); }, null, 1.5)
        .to([hug, held], { rotationY: 360, duration: 0.6, ease: 'power2.inOut' }, 2.3)
        .set([hug, held], { rotationY: 0 }, 2.95)
        .to(held, { y: 0, rotation: 0, x: 0, scaleX: 1, duration: 0.35, ease: 'bounce.out' }, 3.1)
        .to(hug, { y: 0, scaleY: 1, x: 0, duration: 0.3 }, 3.1)
        .call(() => { const h = headOf(S, held); MB.audio.sfx('boing'); spray(L, h.x, S.box.offsetTop + S.box.offsetHeight - 20, '#c9b79c', 14, { dist: [40, 180], gravity: -40, stars: 0 }); mood(S, held, 'play'); }, null, 3.35);
      talk(S, tl, 3.8);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 2.4 }).to(hug, { x: s * 16, duration: 0.15, yoyo: true, repeat: 1 }).to(held, { scaleX: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, 0.1), // a nudge
        gsap.to(held, { y: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1, () => floatUp(S, cfg.emoji || ['💪', '✨', '💜'], midOf(S), 1, [20, 32])),
      ] };
    },

    // a night at the bar: a counter, the first one slides a drink (cfg.food) down to the other, a toast, hiccups
    bar: (S) => {
      const { a, b, L, c, cfg } = S, drinks = cfg.food || ['🍺', '🥃'], counter = prop(S, 'cm-bar', '', 2), mug = fxEl(L, 'cm-emoji', drinks[0]);
      mug.style.fontSize = '70px';
      gsap.set(mug, { opacity: 0 });
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .fromTo(counter, { xPercent: -50, y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.3);
      talk(S, tl, 1);
      const t0 = afterTalk(S, 1);
      tl.call(() => {
        const r = counter.getBoundingClientRect(), top = toUi(r.left, r.top).y, x0 = headOf(S, a).x, x1 = headOf(S, b).x;
        gsap.set(mug, { x: x0, y: top - 32, xPercent: -50, yPercent: -50, opacity: 1 });
        MB.audio.sfx('slide');
        gsap.to(mug, { x: x1, duration: 0.8, ease: 'power2.out' });
        gsap.fromTo(mug, { rotation: -4 }, { rotation: 4, duration: 0.1, yoyo: true, repeat: 7 });
      }, null, t0)
        .to(a, { x: 20, rotation: 5, duration: 0.12, yoyo: true, repeat: 1 }, t0) // a shove
        .to(b, { y: -20, duration: 0.15, yoyo: true, repeat: 1 }, t0 + 0.8) // caught
        .call(() => {
          const p = midOf(S), y = p.y + 40;
          gsap.to(mug, { opacity: 0, duration: 0.1 });
          [[headOf(S, a).x, drinks[1] || drinks[0], -1], [headOf(S, b).x, drinks[0], 1]].forEach(([x, em, s2]) => {
            const e = fxEl(L, 'cm-emoji', em);
            e.style.fontSize = '66px';
            gsap.fromTo(e, { x, y: y + 60, xPercent: -50, yPercent: -50, rotation: s2 * 25 }, { x: p.x + s2 * 30, y: y - 40, rotation: -s2 * 10, duration: 0.35, ease: 'power2.in' });
            gsap.to(e, { opacity: 0, y: '-=40', duration: 0.4, delay: 1.2, onComplete: () => e.remove() });
          });
          gsap.delayedCall(0.35, () => {
            MB.audio.sfx('glass'); MB.audio.sfx('bond', S.tier);
            spray(L, p.x, y - 40, '#fff4c8', 24, { dist: [40, 200], stars: 0.3, gravity: 120 });
            word(L, p.x, y - 170, cfg.word || 'CHEERS!', c, 58); mood(S, a, 'win'); mood(S, b, 'play');
          });
        }, null, t0 + 1.4);
      [a, b, a].forEach((im, i) => {
        const at = t0 + 3 + i * 0.5;
        tl.to(im, { y: -16, duration: 0.08, yoyo: true, repeat: 1 }, at)
          .call(() => { const h = headOf(S, im); word(L, h.x + rnd(-40, 40), h.y + 30, '*hic*', '#ffe6a0', 30); MB.audio.sfx('bubble'); }, null, at);
      });
      return { tl, idle: () => [
        gsap.to([a, b], { rotation: (i) => (i ? -3 : 3), duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // tipsy
        every(0.6, () => { const r = counter.getBoundingClientRect(), p = toUi(r.left + rnd(0.2, 0.8) * r.width, r.top); floatUp(S, ['🫧'], p, 1, [16, 26]); }),
        every(2.6, () => { const h = headOf(S, MB.pick([a, b])); word(L, h.x, h.y + 30, '*hic*', '#ffe6a0', 26); }),
      ] };
    },

    // a concert: stage lights sweep, the amps thump, both headbang on every beat, and the crowd wants more
    concert: (S) => {
      const { a, b, L, c, cfg } = S, notes = cfg.emoji || ['🎸', '🤘', '🎵'], beat = 0.45;
      const lights = [0, 1].map((i) => { const l = prop(S, 'cm-spotlight', '', 0); l.style.setProperty('--c', i ? '#ff4a8a' : c); return l; });
      const amps = [10, 86].map((x) => { const e = prop(S, 'cm-amp', '<i></i><i></i>', 2); e.style.left = x + '%'; e.style.setProperty('--c', c); return e; });
      const tl = gsap.timeline()
        .fromTo(lights, { xPercent: -50, opacity: 0, rotation: (i) => (i ? 25 : -25), transformOrigin: '50% 0%' }, { opacity: 0.8, duration: 0.5 }, 0)
        .fromTo(amps, { xPercent: -50, scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(2)' }, 0.1)
        .fromTo([a, b], { y: 220, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.1, ease: 'back.out(1.4)' }, 0.3)
        .call(() => { MB.audio.sfx('guitar'); mood(S, a, 'attack'); mood(S, b, 'attack'); }, null, 1);
      for (let i = 0; i < 8; i++) {
        const at = 1 + i * beat;
        tl.to([a, b], { rotation: (j) => (j ? -9 : 9), y: 10, duration: beat * 0.4, yoyo: true, repeat: 1, ease: 'power2.out' }, at)
          .to(amps, { scale: 1.08, duration: beat * 0.3, yoyo: true, repeat: 1 }, at)
          .call(() => { const p = midOf(S); if (i % 2 === 0) fling(L, p.x, p.y, notes, 3, { gravity: -60 }); if (i === 4) MB.audio.sfx('drumroll'); }, null, at);
      }
      tl.to(lights, { rotation: (i) => (i ? -25 : 25), duration: beat * 4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1);
      const end = 1 + 8 * beat;
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('gong'); MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier); shake(S.ov, 12); screenFlash(L, c, 0.5);
        confetti(L, p.x, p.y - 100, 40); word(L, p.x, p.y - 160, cfg.word || 'ENCORE!', c, 62); mood(S, a, 'win'); mood(S, b, 'win');
      }, null, end)
        .to([a, b], { y: -40, duration: 0.18, yoyo: true, repeat: 1, stagger: 0.1 }, end);
      talk(S, tl, end + 0.8);
      return { tl, idle: () => [
        gsap.to(lights, { rotation: (i) => (i ? -25 : 25), duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.timeline({ repeat: -1, repeatDelay: 0.5 }).to([a, b], { rotation: (j) => (j ? -6 : 6), duration: 0.25, yoyo: true, repeat: 1 })
          .to(amps, { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1 }, 0),
        every(0.7, () => floatUp(S, notes, midOf(S), 1, [22, 34])),
      ] };
    },

    // cooking together: both throw their ingredients (cfg.food) into the pan along curves (MotionPath), it
    // sizzles, the pan gets tossed, and the dish (cfg.result) is served
    cook: (S) => {
      const { a, b, L, c, cfg } = S, food = cfg.food || ['🍅', '🧀', '🌿'], pan = prop(S, 'cm-pan', '🍳', 3), dish = prop(S, 'cm-frame', cfg.result || '🍕', 3);
      const tl = gsap.timeline()
        .fromTo(a, { x: -380, opacity: 0 }, { x: -20, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 380, opacity: 0 }, { x: 20, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(pan, { xPercent: -50, scale: 0, y: 60 }, { scale: 1.3, y: 0, duration: 0.4, ease: 'back.out(3)' }, 0.5);
      talk(S, tl, 1.1);
      const t0 = afterTalk(S, 1.1);
      tl.call(() => {
        const r = pan.getBoundingClientRect(), P = toUi(r.left + r.width / 2, r.top + r.height * 0.4);
        food.concat(food).forEach((f, i) => {
          const from = headOf(S, i % 2 ? b : a), p0 = { x: from.x, y: from.y + 160 }, mid = { x: (p0.x + P.x) / 2, y: Math.min(p0.y, P.y) - 180 }, k = fxEl(L, 'cm-emoji', f);
          k.style.fontSize = '40px';
          gsap.set(k, { x: p0.x, y: p0.y, xPercent: -50, yPercent: -50 });
          const done = () => { k.remove(); spray(L, P.x, P.y, '#fff4c8', 5, { dist: [20, 80], size: [3, 7], stars: 0 }); if (i % 2) MB.audio.sfx('pop'); };
          if (window.MotionPathPlugin) gsap.to(k, { motionPath: { path: [p0, mid, { x: P.x, y: P.y }], curviness: 1.4 }, rotation: 360, duration: 0.7, delay: i * 0.18, ease: 'power1.in', onComplete: done });
          else gsap.to(k, { x: P.x, y: P.y, rotation: 360, duration: 0.7, delay: i * 0.18, ease: 'power1.in', onComplete: done });
        });
      }, null, t0)
        .to([a, b], { rotation: (i) => (i ? -6 : 6), duration: 0.18, yoyo: true, repeat: 5 }, t0)
        .call(() => MB.audio.sfx('sizzle'), null, t0 + 1)
        .to(pan, { rotation: 12, duration: 0.1, yoyo: true, repeat: 9 }, t0 + 1.3)
        .to(pan, { y: -40, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, t0 + 2.3) // the toss
        .fromTo(dish, { xPercent: -50, scale: 0, opacity: 0, rotation: -180, y: 300 }, { scale: 1, opacity: 1, rotation: 0, y: 0, duration: 0.6, ease: 'back.out(1.6)' }, t0 + 2.4)
        .call(() => { const p = midOf(S); MB.audio.sfx('ding'); MB.audio.sfx('bond', S.tier); spray(L, p.x, p.y - 160, c, 30, { dist: [80, 300], stars: 0.8 }); word(L, p.x, p.y - 260, cfg.word || 'Buon appetito!', c, 50); mood(S, a, 'win'); mood(S, b, 'play'); }, null, t0 + 2.9)
        .call(() => { const h = headOf(S, b); fling(L, h.x, h.y + 100, ['💖', '😋', '✨'], 10, { gravity: -40 }); }, null, t0 + 3.3);
      return { tl, idle: () => [
        every(0.6, () => {
          const r = pan.getBoundingClientRect(), p = toUi(r.left + rnd(0.3, 0.7) * r.width, r.top + 20), st = fxEl(L, 'cm-steam');
          gsap.fromTo(st, { x: p.x, y: p.y, xPercent: -50, opacity: 0.8, scale: 0.5 }, { y: p.y - 120, x: p.x + rnd(-20, 20), opacity: 0, scale: 1.4, duration: 1.6, ease: 'sine.out', onComplete: () => st.remove() });
        }),
        gsap.to(dish, { y: -10, rotation: 4, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: -8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 }),
      ] };
    },

    // etiquette lessons: the teacher (cfg.teacher: 0 or 1, default the first) has the other walk with a book on
    // their head. The first try ends in a thud, the second one passes
    etiquette: (S) => {
      const { a, b, L, c, cfg } = S, [tch, kid] = cfg.teacher ? [b, a] : [a, b], s = kid === b ? 1 : -1, book = fxEl(L, 'cm-emoji', cfg.emoji ? cfg.emoji[0] : '📕');
      book.style.fontSize = '64px';
      gsap.set(book, { opacity: 0, xPercent: -50, yPercent: -100 });
      const headTop = () => { const h = liveHead(kid); return { x: h.x, y: h.y + h.h * 0.05 }; };
      const stick = () => { const p = headTop(); gsap.set(book, { x: p.x, y: p.y, rotation: gsap.getProperty(kid, 'rotation') * 1.6 }); };
      const tl = gsap.timeline()
        .fromTo(tch, { y: 30, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.8, ease: 'sine.out' }, 0)
        .fromTo(kid, { x: s * 400, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0.2)
        .call(() => { mood(S, tch, 'taunt'); say(S, tch, lineOf(S, 0).text, 1.4); }, null, 0.7);
      const place = (at) => tl.call(() => { const p = headTop(); gsap.fromTo(book, { x: p.x, y: p.y - 260, opacity: 1, rotation: -30 }, { y: p.y, rotation: 0, duration: 0.4, ease: 'bounce.out' }); MB.audio.sfx('pop'); }, null, at);
      const walk = (at, wobble) => {
        for (let i = 0; i < 4; i++) tl.to(kid, { x: s * (i % 2 ? 30 : -30), y: -8, rotation: wobble * (i % 2 ? 1 : -1) * (i + 1), duration: 0.3, ease: 'sine.inOut' }, at + i * 0.3);
        tl.to({}, { duration: 1.2, onUpdate: stick }, at); // the book rides along
      };
      place(1.2);
      walk(1.8, 3);
      tl.call(() => { // first try: it slides off
        const p = headTop();
        MB.audio.sfx('whistleDown'); mood(S, kid, 'lose');
        gsap.to(book, { x: p.x + s * 120, y: p.y + kid.offsetHeight * 0.9, rotation: s * 200, duration: 0.55, ease: 'power2.in', onComplete: () => { MB.audio.sfx('bonk'); shake(S.ov, 6); } });
      }, null, 3)
        .to(kid, { rotation: -s * 10, duration: 0.2, yoyo: true, repeat: 1 }, 3)
        .call(() => { const h = headOf(S, tch); mood(S, tch, 'attack'); word(L, h.x, h.y + 30, cfg.order || 'Again.', c, 46); word(L, h.x + s * 70, h.y + 10, '💢', '#ff3b3b', 44); MB.audio.sfx('hit'); }, null, 3.7)
        .call(() => { const l = lineOf(S, 1); say(S, l.by ? b : a, l.text, 1.4); }, null, 4.3)
        .to(kid, { rotation: 0, x: 0, y: 0, duration: 0.2 }, 4.3);
      place(5.3);
      walk(5.9, 0);
      tl.call(() => { // second try: poise
        const p = headTop(), h = headOf(S, tch);
        mood(S, kid, 'win'); mood(S, tch, 'play');
        word(L, h.x, h.y + 30, cfg.word || 'Adequate.', c, 48); fling(L, p.x, p.y + 60, ['✨', '🌹', '👑'], 12, { gravity: -40 });
        MB.audio.sfx('sparkle'); MB.audio.sfx('bond', S.tier);
        gsap.to(book, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.5 });
      }, null, 7.1)
        .to(kid, { y: -24, x: 0, rotation: 0, duration: 0.18, yoyo: true, repeat: 1 }, 7.1)
        .to(tch, { y: 8, duration: 0.15, yoyo: true, repeat: 3 }, 7.3); // nods
      for (let i = 2; i < nLines(S); i++) { const l = lineOf(S, i); tl.call(() => say(S, l.by ? b : a, l.text), null, 8 + (i - 2) * 1.3); }
      return { tl, idle: () => [
        gsap.to(tch, { y: -5, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(kid, { rotation: 2, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.2, () => floatUp(S, ['✨', '🌹'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a harvest: fruit (cfg.food) rains into a tub, they take turns stomping it (juice everywhere) and a bottle
    // (cfg.result) pops out
    harvest: (S) => {
      const { a, b, L, c, cfg } = S, fruit = cfg.food || ['🍇'], tub = prop(S, 'cm-tub', '<i></i>', 2), juice = tub.firstChild, bottle = prop(S, 'cm-frame', cfg.result || '🍷', 3);
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .fromTo(tub, { xPercent: -50, y: 180, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.3)
        .fromTo(juice, { scaleY: 0 }, { scaleY: 0.2, duration: 0.8 }, 1.1)
        .call(() => { const r = tub.getBoundingClientRect(), p0 = toUi(r.left, r.top), p1 = toUi(r.right, r.top); rain(L, p0.x + 30, p1.x - 30, p0.y + 150, fruit, 20, 0.8); MB.audio.sfx('pop'); }, null, 0.8);
      talk(S, tl, 1.4);
      const t0 = Math.max(3.4, afterTalk(S, 1.4));
      [a, b, a, b, a, b].forEach((im, i) => {
        const at = t0 + i * 0.35;
        tl.to(im, { y: 26, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.in' }, at)
          .call(() => {
            const r = tub.getBoundingClientRect(), p = toUi(r.left + r.width * (im === a ? 0.35 : 0.65), r.top);
            spray(L, p.x, p.y, '#8a2be2', 10, { dist: [40, 200], stars: 0, gravity: 160 });
            if (i % 2 === 0) MB.audio.sfx('splat');
            word(L, p.x, p.y - 60, 'STOMP!', c, 30);
          }, null, at + 0.1);
      });
      tl.to(juice, { scaleY: 0.9, duration: 6 * 0.35, ease: 'none' }, t0);
      const pop = t0 + 6 * 0.35 + 0.2;
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('pop'); MB.audio.sfx('bond', S.tier);
        word(L, p.x, p.y - 150, cfg.word || 'POP!', c, 60); spray(L, p.x, p.y - 100, '#c58cff', 30, { dist: [80, 320], stars: 0.6 });
        mood(S, a, 'win'); mood(S, b, 'win');
      }, null, pop)
        .fromTo(bottle, { xPercent: -50, scale: 0, opacity: 0, y: 200, rotation: -40 }, { scale: 1, opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, pop);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 1.8 }).to(a, { y: 18, duration: 0.1, yoyo: true, repeat: 1 }).to(b, { y: 18, duration: 0.1, yoyo: true, repeat: 1 }, 0.35),
        gsap.to(juice, { scaleY: 0.85, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(bottle, { y: -10, rotation: 5, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.9, () => floatUp(S, [...fruit, '✨'], midOf(S), 1, [18, 28])),
      ] };
    },

    // dress-up: a folding screen goes up in front of one (cfg.model: 0 or 1, default the second), clothes (cfg.emoji)
    // fly over the top while the other waits, and then the reveal
    dressup: (S) => {
      const { a, b, L, c, cfg } = S, [fan, model] = cfg.model === 0 ? [b, a] : [a, b], screen = prop(S, 'cm-screen', '<i></i><i></i><i></i>', 3);
      const topOf = () => { const r = screen.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top); };
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 380 : -380), opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .call(() => { screen.style.left = boxX(S, model) + 'px'; MB.audio.sfx('whoosh'); }, null, 0.6)
        .fromTo(screen, { xPercent: -50, scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.65);
      talk(S, tl, 1.2);
      tl.call(() => { const p = topOf(); fling(L, p.x, p.y, cfg.emoji || ['👗', '🎀', '👒', '🧦', '👠'], 14, { dist: [120, 360], gravity: 260 }); MB.audio.sfx('whoosh'); }, null, 1.4)
        .to(screen, { rotation: 2, duration: 0.08, yoyo: true, repeat: 9 }, 1.4)
        .to(fan, { y: -16, duration: 0.12, yoyo: true, repeat: 5 }, 2) // can't wait
        .call(() => { const h = headOf(S, fan); word(L, h.x, h.y + 30, '👀', c, 50); }, null, 2.1)
        .call(() => { const p = topOf(); fling(L, p.x, p.y, ['👚', '🧺', '🎀'], 8, { gravity: 260 }); MB.audio.sfx('squeak'); }, null, 2.3);
      const rev = Math.max(3.4, afterTalk(S, 1.2));
      tl.call(() => MB.audio.sfx('drumroll'), null, rev - 0.9)
        .to(screen, { scaleX: 0, opacity: 0, duration: 0.3, ease: 'power2.in' }, rev)
        .fromTo(model, { rotationY: -180 }, { rotationY: 0, duration: 0.6, ease: 'back.out(1.4)' }, rev)
        .call(() => {
          const h = headOf(S, model);
          mood(S, model, 'win'); mood(S, fan, 'play');
          column(L, 'cm-light', { x: h.x, bottom: S.box.offsetTop + S.box.offsetHeight }, c, 0.5);
          spray(L, h.x, h.y + 120, c, 30, { dist: [80, 320], stars: 0.8 }); word(L, h.x, h.y + 10, cfg.word || 'TA-DA!', c, 60);
          MB.audio.sfx('sparkle'); MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier);
        }, null, rev + 0.1)
        .call(() => { const h = headOf(S, fan); word(L, h.x, h.y + 40, '👏 👏', c, 44); }, null, rev + 0.6);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 1.8 }).to(model, { rotation: -5, scale: 1.03, duration: 0.25 }).to(model, { rotation: 0, scale: 1, duration: 0.3, delay: 0.7 }),
        gsap.to(fan, { y: -10, duration: 0.4, yoyo: true, repeat: -1, repeatDelay: 0.8, ease: 'power1.out' }),
        every(1, () => { const h = headOf(S, model); floatUp(S, ['✨', '💖', '🎀'], { x: h.x, y: h.y + 120 }, 1, [18, 28]); }),
      ] };
    },

    // a poem written together: a notebook page floats between them and they write it a line each (cfg.title,
    // cfg.verse: the lines), then it blooms
    poem: (S) => {
      const { a, b, L, c, cfg } = S, verse = cfg.verse || ['Roses are red,', 'violets are blue,', 'we wrote this', 'and so did you.'];
      const nb = prop(S, 'cm-notebook', `<b>${cfg.title || 'Our Poem'}</b>${verse.map((v) => `<p>${v}</p>`).join('')}`, 3), rows = [...nb.querySelectorAll('p')];
      nb.style.setProperty('--c', c);
      gsap.set(rows, { clipPath: 'inset(0 100% 0 0)' });
      const tl = gsap.timeline()
        .fromTo(a, { x: -380, opacity: 0 }, { x: -10, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 380, opacity: 0 }, { x: 10, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(nb, { xPercent: -50, y: -80, opacity: 0, rotation: -8 }, { y: 0, opacity: 1, rotation: -2, duration: 0.5, ease: 'back.out(1.6)' }, 0.5)
        .call(() => MB.audio.sfx('crinkle'), null, 0.5);
      rows.forEach((r, i) => {
        const im = i % 2 ? b : a, at = 1.1 + i * 0.8;
        tl.to(im, { y: -14, rotation: i % 2 ? -3 : 3, duration: 0.15, yoyo: true, repeat: 1 }, at)
          .call(() => { MB.audio.sfx('tick'); const q = r.getBoundingClientRect(), p = toUi(q.left, q.top + q.height / 2); fling(L, p.x, p.y, ['✏️'], 1, { dist: [10, 40], gravity: 20 }); }, null, at)
          .to(r, { clipPath: 'inset(0 0% 0 0)', duration: 0.65, ease: 'none' }, at);
      });
      const done = 1.2 + rows.length * 0.8;
      tl.call(() => {
        const q = nb.getBoundingClientRect(), p = toUi(q.left + q.width / 2, q.top + q.height / 2);
        MB.audio.sfx('sparkle'); MB.audio.sfx('bond', S.tier);
        fling(L, p.x, p.y, cfg.emoji || ['🌸', '💚', '💗', '✨'], 18, { gravity: -40 });
        word(L, p.x, p.y - 150, cfg.word || 'Beautiful~', c, 48);
        mood(S, a, 'win'); mood(S, b, 'play');
      }, null, done)
        .to(nb, { scale: 1.08, duration: 0.2, yoyo: true, repeat: 1 }, done);
      talk(S, tl, done + 0.7);
      return { tl, idle: () => [
        gsap.to(nb, { rotation: 1, y: -8, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: -6, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.5 }),
        every(0.9, () => floatUp(S, ['🌸', '📝', '💚'], midOf(S), 1, [18, 28])),
      ] };
    },

    // late for school: toast in their mouths, running in place while the street streams past, one trips, the other
    // hauls them up, and they make it as the bell rings
    late: (S) => {
      const { a, b, L, c, cfg } = S, clock = prop(S, 'cm-frame', '⏰', 3);
      const toasts = [a, b].map(() => { const t = fxEl(L, 'cm-emoji', '🍞'); t.style.fontSize = '54px'; gsap.set(t, { opacity: 0, xPercent: -50, yPercent: -50 }); return t; });
      const stick = () => [a, b].forEach((im, i) => { const h = liveHead(im); gsap.set(toasts[i], { x: h.x + (i ? -34 : 34), y: h.y + h.h * 0.17 }); });
      const streak = () => {
        const s = fxEl(L, 'cm-speedline'), y = rnd(120, 860), x0 = S.box.offsetLeft + S.box.offsetWidth + 120;
        gsap.fromTo(s, { x: x0, y, opacity: 0.8 }, { x: S.box.offsetLeft - 360, duration: rnd(0.25, 0.45), ease: 'none', onComplete: () => s.remove() });
      };
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 700 : -700), opacity: SPRITE_OP }, { x: 0, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(clock, { xPercent: -50, scale: 0, opacity: 1 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, 0.4)
        .to(clock, { rotation: 16, duration: 0.05, yoyo: true, repeat: 11 }, 0.7)
        .call(() => { MB.audio.sfx('ding'); MB.audio.sfx('chomp'); gsap.set(toasts, { opacity: 1 }); stick(); }, null, 0.7)
        .to(clock, { scale: 0, duration: 0.25 }, 1.4)
        .add(gsap.timeline({ repeat: 60 }).call(streak).to({}, { duration: 0.05 }), 1.1)
        .to([a, b], { y: -22, duration: 0.09, yoyo: true, repeat: 31, stagger: 0.045, ease: 'power1.out' }, 1.1)
        .to({}, { duration: 3.2, onUpdate: stick }, 1.1)
        .call(() => MB.audio.sfx('zip'), null, 1.1);
      talk(S, tl, 1.3);
      // a trips, b hauls them up
      tl.to(a, { rotation: -28, y: 70, duration: 0.15, ease: 'power2.in' }, 2.3)
        .call(() => { const h = liveHead(a); MB.audio.sfx('bonk'); word(L, h.x, h.y + 40, '*trip*', c, 34); }, null, 2.35)
        .to(b, { x: -60, duration: 0.2 }, 2.45)
        .call(() => { const h = headOf(S, b); word(L, h.x, h.y + 20, 'Gotcha!', c, 40); MB.audio.sfx('whoosh'); }, null, 2.55)
        .to(a, { rotation: 0, y: 0, duration: 0.25, ease: 'back.out(2)' }, 2.6)
        .to(b, { x: 0, duration: 0.3 }, 2.8);
      const end = Math.max(4.4, afterTalk(S, 1.3));
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('ding'); MB.audio.sfx('bond', S.tier); MB.audio.sfx('cheer');
        word(L, p.x, p.y - 150, cfg.word || 'MADE IT!', c, 58); spray(L, p.x, p.y - 60, c, 30, { dist: [80, 320], stars: 0.7 });
        [a, b].forEach((im) => { const h = headOf(S, im); fling(L, h.x, h.y + 40, ['💦', '💦', '✨'], 6, { gravity: 120 }); });
        mood(S, a, 'win'); mood(S, b, 'play');
        toasts.forEach((t) => gsap.to(t, { y: '+=200', rotation: 200, opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: () => t.remove() }));
      }, null, end)
        .to([a, b], { scaleY: 0.94, rotation: (i) => (i ? -5 : 5), duration: 0.3 }, end); // panting
      return { tl, idle: () => [
        gsap.to([a, b], { scaleY: 0.97, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.17 }),
        every(0.9, () => floatUp(S, ['💦', '🍞', '✨'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a debate: podiums, a banner with the question (cfg.topic), and every argument flies across (cfg.props: [[a's], [b's]])
    // and collides with the other's in the middle. The moderator gives up
    debate: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], props = cfg.props || [['📚'], ['📖']];
      const banner = prop(S, 'cm-banner', cfg.topic || 'THE GREAT DEBATE', 3), pods = [0, 1].map((i) => { const p = prop(S, 'cm-podium', '<i></i>', 2); p.style.setProperty('--c', i ? cb : ca); return p; });
      banner.style.setProperty('--c', c);
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.1, ease: 'back.out(1.4)' }, 0)
        .call(() => pods.forEach((p, i) => { p.style.left = boxX(S, i ? b : a) + 'px'; }), null, 0.05)
        .fromTo(pods, { xPercent: -50, y: 220, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.6)' }, 0.2)
        .fromTo(banner, { xPercent: -50, scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.6)
        .call(() => MB.audio.sfx('gong'), null, 0.6);
      const n = Math.max(2, nLines(S)) + 1;
      for (let i = 0; i < n; i++) tl.call(() => {
        const h0 = headOf(S, a), h1 = headOf(S, b), y = Math.min(h0.y, h1.y) + 190, mid = (h0.x + h1.x) / 2, from = i % 2 ? b : a;
        [0, 1].forEach((j) => {
          const k = fxEl(L, 'cm-emoji', MB.pick(props[j])), x0 = j ? h1.x : h0.x;
          k.style.fontSize = '56px';
          gsap.fromTo(k, { x: x0, y: y + 40, xPercent: -50, yPercent: -50 }, { keyframes: [{ x: (x0 + mid) / 2, y: y - 110, duration: 0.25, ease: 'sine.out' }, { x: mid, y, duration: 0.25, ease: 'sine.in' }],
            rotation: j ? -360 : 360, onComplete: () => k.remove() });
        });
        gsap.delayedCall(0.5, () => {
          MB.audio.sfx('clang');
          spray(L, mid, y, ca, 12, { dist: [40, 180] }); spray(L, mid, y, cb, 12, { dist: [40, 180] });
          ring(L, mid, y, '#ffffff', { size: 80, scale: 3, width: 6 });
          word(L, mid, y - 90, MB.pick(['OBJECTION!', 'WRONG!', 'CITATION?', 'POW!', 'SOURCE?!']), '#ffffff', 36);
        });
        gsap.fromTo(from, { rotation: from === a ? 5 : -5, x: from === a ? 24 : -24 }, { rotation: 0, x: 0, duration: 0.45 });
        mood(S, from, 'attack');
      }, null, 1.3 + i * 1.3);
      talk(S, tl, 1.25);
      const end = 1.3 + n * 1.3 + 0.2;
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('bonk'); MB.audio.sfx('bond', S.tier);
        word(L, p.x, p.y - 190, cfg.word || 'ORDER! ORDER!', c, 52);
        fling(L, p.x, p.y - 120, ['🔨'], 1, { dist: [10, 30], gravity: 60 });
        [a, b].forEach((im, i) => { const h = headOf(S, im); word(L, h.x + (i ? -70 : 70), h.y + 30, '💢', '#ff3b3b', 44); mood(S, im, 'taunt'); });
      }, null, end)
        .to(a, { rotation: 5, duration: 0.25 }, end + 0.1).to(b, { rotation: -5, duration: 0.25 }, end + 0.1);
      return { tl, idle: () => [
        gsap.to(banner, { rotation: 1.5, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.timeline({ repeat: -1, repeatDelay: 1.4 }).to(a, { x: 14, duration: 0.15, yoyo: true, repeat: 1 }).to(b, { x: -14, duration: 0.15, yoyo: true, repeat: 1 }, 0.7),
        every(1.1, () => { const p = midOf(S); spray(L, p.x, p.y + 60, MB.pick([ca, cb]), 5, { dist: [20, 80], stars: 0.5 }); }),
      ] };
    },

    // a ritual: a pentagram burns into the floor, candles light round it, the first partner raises the fire while the
    // second kneels, and a crown appears over the second's head... then fades, because she's confused again
    ritual: (S) => {
      const { a, b, L, c, cfg } = S, pts = [0, 1, 2, 3, 4].map((i) => { const g = -Math.PI / 2 + (i * 4 * Math.PI) / 5; return `${(200 + Math.cos(g) * 170).toFixed(0)},${(200 + Math.sin(g) * 170).toFixed(0)}`; }).join(' ');
      const pent = prop(S, 'cm-pentagram', `<svg viewBox="0 0 400 400" width="560" height="560" fill="none" stroke="currentColor" stroke-width="9" stroke-linejoin="round">
        <circle class="d" cx="200" cy="200" r="190"/><circle class="d" cx="200" cy="200" r="170"/><polygon class="d" points="${pts}"/></svg>`, 0);
      pent.style.color = c; pent.style.setProperty('--c', c);
      const candles = [0, 1, 2, 3, 4].map((i) => { const k = prop(S, 'cm-candle', '🕯️<i></i>', 2); k.style.left = 16 + i * 17 + '%'; return k; });
      const crown = fxEl(L, 'cm-emoji', '👑');
      crown.style.fontSize = '90px';
      gsap.set(crown, { opacity: 0, xPercent: -50, yPercent: -50 });
      const tl = gsap.timeline()
        .fromTo(a, { x: -300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.8, ease: 'sine.out' }, 0)
        .fromTo(b, { opacity: 0, y: 40 }, { opacity: SPRITE_OP, y: 0, duration: 0.8, ease: 'sine.out' }, 0.2)
        .fromTo(pent, { xPercent: -50, scaleY: 0.3, scaleX: 0.3, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.5)
        .add(drawIn(pent.querySelectorAll('.d'), { duration: 0.9, stagger: 0.2, ease: 'power1.inOut' }), 0.5)
        .call(() => MB.audio.sfx('rune'), null, 0.5);
      candles.forEach((k, i) => tl.fromTo(k, { xPercent: -50, scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }, 1 + i * 0.12)
        .call(() => { k.classList.add('lit'); MB.audio.sfx('fire'); }, null, 1.5 + i * 0.15));
      talk(S, tl, 1.3);
      const up = Math.max(2.8, afterTalk(S, 1.3) - 0.4);
      tl.to(b, { scaleY: 0.9, y: 30, duration: 0.3 }, 1.4) // kneels
        .to(a, { y: -30, duration: 0.3 }, up)
        .call(() => {
          const h = headOf(S, a);
          MB.audio.sfx('burn'); MB.audio.sfx('choir');
          column(L, 'cm-fire', { x: h.x, bottom: S.box.offsetTop + S.box.offsetHeight }, c, 1);
          riseFrom(L, midOf(S).x, S.box.offsetTop + S.box.offsetHeight, [c, '#ffb347', '#3a0010'], 40, 1.2);
          pent.classList.add('lit');
          mood(S, a, 'attack');
        }, null, up)
        .call(() => {
          const h = liveHead(b);
          gsap.fromTo(crown, { x: h.x, y: h.y - 30, opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, y: h.y - 60, duration: 0.5, ease: 'back.out(2)' });
          screenFlash(L, '#8a3cc8', 0.5); MB.audio.sfx('dark'); MB.audio.sfx('bond', S.tier);
          word(L, h.x, h.y - 150, cfg.word || 'MY QUEEN...', '#b07cff', 52);
          mood(S, b, 'taunt');
        }, null, up + 0.8)
        .call(() => {
          const h = liveHead(b);
          gsap.to(crown, { opacity: 0, y: '-=40', duration: 0.5 });
          word(L, h.x, h.y + 20, '?', '#ffffff', 60); mood(S, b, 'play'); MB.audio.sfx('pop');
        }, null, up + 2.2)
        .call(() => { const h = headOf(S, a); word(L, h.x, h.y + 30, '🤦', c, 60); mood(S, a, 'lose'); }, null, up + 2.7)
        .to(a, { y: 0, duration: 0.3 }, up + 2.7).to(b, { scaleY: 1, y: 0, duration: 0.4 }, up + 2.6);
      return { tl, idle: () => [
        gsap.to(pent.querySelector('svg'), { rotation: 360, duration: 24, repeat: -1, ease: 'none' }),
        every(0.25, () => { const r = candles[Math.floor(rnd(0, 5))].getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top); spray(L, p.x, p.y, '#ffb347', 1, { dist: [5, 30], size: [3, 6], stars: 0, gravity: -80 }); }),
        every(1.2, () => floatUp(S, ['🔥', '🕯️', '💜'], midOf(S), 1, [18, 28])),
      ] };
    },

    // one prays, one doesn't: the second partner kneels in prayer with a halo while the first makes devil horns, winks
    // at you and swishes her tail, and instantly looks pious whenever the other turns round
    prayer: (S) => {
      const { a, b, L, c, cfg } = S, halo = prop(S, 'cm-halo', '', 3), fake = prop(S, 'cm-halo', '', 3), horns = fxEl(L, 'cm-emoji', '😈');
      horns.style.fontSize = '64px';
      gsap.set([halo, fake], { opacity: 0, xPercent: -50 });
      gsap.set(horns, { opacity: 0, xPercent: -50, yPercent: -50 });
      const hornsOn = (on) => { const h = liveHead(a); gsap.to(horns, { x: h.x + 60, y: h.y + 10, opacity: on ? 1 : 0, scale: on ? 1 : 0.3, duration: 0.2 }); };
      const tl = gsap.timeline()
        .fromTo(b, { opacity: 0, y: 40 }, { opacity: SPRITE_OP, y: 20, scaleY: 0.93, duration: 0.8, ease: 'sine.out' }, 0)
        .fromTo(a, { x: -300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.7, ease: 'sine.out' }, 0.2)
        .call(() => {
          halo.style.left = boxX(S, b) + 'px'; fake.style.left = boxX(S, a) + 'px';
          const h = headOf(S, b); column(L, 'cm-light', { x: h.x, bottom: S.box.offsetTop + S.box.offsetHeight }, '#ffe38a', 1.2);
          MB.audio.sfx('choir'); mood(S, b, 'play');
        }, null, 0.6)
        .fromTo(halo, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.6);
      talk(S, tl, 1.1);
      // behind her back, twice
      [1.8, 3.6].forEach((at, i) => {
        tl.call(() => { hornsOn(true); mood(S, a, 'taunt'); const h = headOf(S, a); word(L, h.x, h.y + 80, i ? '💋' : '😉', c, 56); MB.audio.sfx(i ? 'kiss' : 'blink'); }, null, at)
          .to(a, { rotation: -6, x: -14, duration: 0.25, yoyo: true, repeat: 3 }, at)
          .to(b, { rotationY: 160, duration: 0.25 }, at + 1)   // she turns round...
          .call(() => { hornsOn(false); gsap.to(fake, { opacity: 1, duration: 0.15 }); mood(S, a, 'play'); const h = headOf(S, a); word(L, h.x, h.y + 60, '😇', '#ffe38a', 56); MB.audio.sfx('ding'); }, null, at + 1)
          .to(b, { rotationY: 0, duration: 0.25 }, at + 1.5)
          .to(fake, { opacity: 0, duration: 0.3 }, at + 1.7);
      });
      const end = Math.max(5.6, afterTalk(S, 1.1));
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('choir'); MB.audio.sfx('bond', S.tier);
        word(L, p.x, p.y - 170, cfg.word || 'AMEN~', c, 56);
        fling(L, p.x, p.y - 60, ['🕊️', '💚', '✨', '🪶'], 14, { gravity: -40 });
        mood(S, b, 'win'); mood(S, a, 'win');
      }, null, end)
        .to(b, { scaleY: 1, y: 0, duration: 0.4 }, end);
      return { tl, idle: () => [
        gsap.to(halo, { y: -8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(a, { rotation: 3, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1, () => floatUp(S, ['✨', '🕊️', '💚'], midOf(S), 1, [18, 28])),
      ] };
    },

    // the dream: a little ranch house draws itself behind them line by line, the sun goes down behind it, a cow wanders
    // past, and they lean into each other
    dreamhome: (S) => {
      const { a, b, L, c, cfg } = S, sun = prop(S, 'cm-sun', '', 0);
      const house = prop(S, 'cm-house', `<svg viewBox="0 0 400 300" width="560" height="420" fill="none" stroke="#fff6e0" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
        <path class="d" d="M60,290 L60,150 L200,50 L340,150 L340,290 Z"/><path class="d" d="M30,165 L200,30 L370,165"/>
        <path class="d" d="M170,290 L170,200 L230,200 L230,290"/><rect class="d" x="90" y="180" width="50" height="45"/><rect class="d" x="260" y="180" width="50" height="45"/>
        <path class="d" d="M280,95 L280,50 L310,50 L310,118"/><path class="d" d="M0,290 L400,290 M10,250 L10,290 M40,250 L40,290 M370,250 L370,290 M395,250 L395,290 M0,262 L50,262 M360,262 L400,262"/></svg>`, 0);
      sun.style.setProperty('--c', c);
      const tl = gsap.timeline()
        .fromTo(sun, { xPercent: -50, y: -60, opacity: 0 }, { y: 120, opacity: 1, duration: 4.5, ease: 'sine.in' }, 0)
        .fromTo(house, { xPercent: -50, opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3)
        .add(drawIn(house.querySelectorAll('.d'), { duration: 0.5, stagger: 0.18, ease: 'power1.inOut' }), 0.3)
        .call(() => MB.audio.sfx('sparkle'), null, 0.3)
        .fromTo([a, b], { x: (i) => (i ? 300 : -300), opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.9, ease: 'sine.out' }, 0.4)
        .to(house.querySelector('svg'), { fill: 'rgba(255,220,160,.18)', duration: 0.8 }, 1.8);
      talk(S, tl, 1.6);
      tl.call(() => {
        const cow = fxEl(L, 'cm-emoji', '🐄'), y = S.box.offsetTop + S.box.offsetHeight - 40, x0 = S.box.offsetLeft - 80;
        cow.style.fontSize = '64px';
        gsap.fromTo(cow, { x: x0, y, xPercent: -50, yPercent: -100, scaleX: -1 }, { x: x0 + S.box.offsetWidth + 160, duration: 5, ease: 'none', onComplete: () => cow.remove() });
        gsap.to(cow, { y: y - 10, duration: 0.25, yoyo: true, repeat: 19 });
      }, null, 2.2);
      const lean = Math.max(3.6, afterTalk(S, 1.6));
      tl.to(a, { x: 34, rotation: 5, duration: 0.6, ease: 'sine.inOut' }, lean).to(b, { x: -34, rotation: -5, duration: 0.6, ease: 'sine.inOut' }, lean)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('bond', S.tier); MB.audio.sfx('heartbeat');
          word(L, p.x, p.y - 160, cfg.word || 'Home. ♥', c, 56);
          fling(L, p.x, p.y - 40, ['💛', '💕', '🌻'], 14, { gravity: -40 });
          mood(S, a, 'play'); mood(S, b, 'play');
        }, null, lean + 0.5);
      return { tl, idle: () => [
        gsap.to([a, b], { rotation: (i) => (i ? -3 : 3), duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.7, () => floatUp(S, ['💛', '🌻', '💕'], midOf(S), 1, [18, 30])),
      ] };
    },

    // a barbecue: the grill smokes, the first partner flips the patty sky high (twice), the second deadpans that it's
    // on fire, it is, and a burger comes out of it anyway
    grill: (S) => {
      const { a, b, L, c, cfg } = S, grill = prop(S, 'cm-grill', '<i></i>', 3), dish = prop(S, 'cm-frame', cfg.result || '🍔', 3);
      const patty = fxEl(L, 'cm-emoji', '🥩');
      patty.style.fontSize = '60px';
      gsap.set(patty, { opacity: 0, xPercent: -50, yPercent: -50 });
      const top = () => { const r = grill.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top); };
      const flip = (at, hgt) => tl.call(() => { const p = top(); MB.audio.sfx('whoosh'); gsap.fromTo(patty, { x: p.x, y: p.y - 20, opacity: 1 }, { keyframes: [{ y: p.y - hgt, duration: 0.45, ease: 'power2.out' }, { y: p.y - 20, duration: 0.4, ease: 'power2.in' }], rotation: '+=720', onComplete: () => MB.audio.sfx('sizzle') }); }, null, at)
        .to(a, { rotation: 8, y: -20, duration: 0.15, yoyo: true, repeat: 1 }, at);
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 380 : -380), opacity: 0 }, { x: (i) => (i ? 20 : -20), opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(grill, { xPercent: -50, y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.4)
        .call(() => { const p = top(); gsap.set(patty, { x: p.x, y: p.y - 20, opacity: 1 }); MB.audio.sfx('sizzle'); }, null, 0.9);
      talk(S, tl, 1);
      flip(1.3, 360);
      flip(2.6, 520);
      tl.call(() => {
        const p = top();
        MB.audio.sfx('fire'); MB.audio.sfx('burn');
        column(L, 'cm-fire', { x: p.x, bottom: p.y + 20 }, '#ff5a1f', 0.8);
        patty.textContent = '🔥';
        mood(S, b, 'taunt'); mood(S, a, 'lose');
      }, null, 3.5)
        .to(a, { x: -60, duration: 0.2, yoyo: true, repeat: 1 }, 3.6) // jumps back
        .call(() => { const p = top(); MB.audio.sfx('poof'); spray(L, p.x, p.y - 40, '#8a8a8a', 20, { dist: [40, 200], stars: 0, gravity: -120 }); gsap.to(patty, { opacity: 0, duration: 0.2 }); }, null, 4.4)
        .fromTo(dish, { xPercent: -50, scale: 0, opacity: 0, rotation: -180, y: 200 }, { scale: 1, opacity: 1, rotation: 0, y: 0, duration: 0.6, ease: 'back.out(1.6)' }, 4.6)
        .call(() => { const p = midOf(S); MB.audio.sfx('ding'); MB.audio.sfx('bond', S.tier); word(L, p.x, p.y - 250, cfg.word || 'Burger time!', c, 50); spray(L, p.x, p.y - 160, c, 24, { dist: [80, 280], stars: 0.7 }); mood(S, a, 'win'); mood(S, b, 'play'); }, null, 5.1);
      return { tl, idle: () => [
        every(0.4, () => { const p = top(), st = fxEl(L, 'cm-steam'); gsap.fromTo(st, { x: p.x + rnd(-60, 60), y: p.y, xPercent: -50, opacity: 0.8, scale: 0.6 }, { y: p.y - 160, opacity: 0, scale: 1.8, duration: 1.8, ease: 'sine.out', onComplete: () => st.remove() }); }),
        gsap.to(dish, { y: -10, rotation: 4, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: -8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 }),
      ] };
    },

    // the red streak: the first partner paints a streak into the second's hair with a brush, it shines, and the second
    // shows it off in a hand mirror
    streak: (S) => {
      const { a, b, L, c, cfg } = S, brush = fxEl(L, 'cm-emoji', '🖌️'), streakEl = fxEl(L, 'cm-streak', '', c), mirror = fxEl(L, 'cm-emoji', '🪞');
      brush.style.fontSize = '70px'; mirror.style.fontSize = '80px';
      gsap.set([brush, mirror], { opacity: 0, xPercent: -50, yPercent: -50 });
      gsap.set(streakEl, { opacity: 0, xPercent: -50, transformOrigin: '50% 0%' });
      const hair = () => { const h = liveHead(b); return { x: h.x + h.h * 0.03, y: h.y + h.h * 0.02 }; };
      const tl = gsap.timeline()
        .fromTo(b, { x: 300, opacity: 0 }, { x: -10, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(a, { x: -300, opacity: 0 }, { x: 20, opacity: SPRITE_OP, duration: 0.8, ease: 'sine.out' }, 0.2)
        .to(b, { scaleY: 0.95, y: 20, duration: 0.3 }, 0.8) // sits still
        .call(() => { const h = headOf(S, a); gsap.fromTo(brush, { x: h.x + 60, y: h.y + 200, opacity: 1, scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }); }, null, 0.9);
      talk(S, tl, 1.1);
      const paint = 1.8;
      tl.call(() => { const p = hair(); gsap.to(brush, { x: p.x + 30, y: p.y - 10, rotation: -30, duration: 0.4, ease: 'sine.inOut' }); MB.audio.sfx('whoosh'); }, null, paint)
        .call(() => {
          const p = hair();
          gsap.set(streakEl, { x: p.x, y: p.y - 6, height: 0, opacity: 1 });
          gsap.to(streakEl, { height: 190, duration: 0.8, ease: 'power1.inOut' });
          gsap.to(brush, { y: p.y + 180, rotation: -10, duration: 0.8, ease: 'power1.inOut' });
          MB.audio.sfx('swish'); gsap.delayedCall(0.4, () => MB.audio.sfx('swish'));
        }, null, paint + 0.45)
        .call(() => {
          const p = hair();
          gsap.to(brush, { opacity: 0, y: '+=60', duration: 0.3 });
          spray(L, p.x, p.y + 90, c, 26, { dist: [30, 200], stars: 0.8 });
          MB.audio.sfx('sparkle'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 60, cfg.word || 'Perfect. ♥', c, 52);
          mood(S, a, 'play');
        }, null, paint + 1.35)
        .to(b, { scaleY: 1, y: 0, duration: 0.3 }, paint + 1.6)
        .call(() => { const h = headOf(S, b); gsap.fromTo(mirror, { x: h.x - 110, y: h.y + 150, opacity: 1, scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }); mood(S, b, 'win'); MB.audio.sfx('ding'); }, null, paint + 1.8)
        .to(b, { rotation: -5, duration: 0.2, yoyo: true, repeat: 3 }, paint + 2.1) // checks it out
        .call(() => { gsap.to(mirror, { opacity: 0, duration: 0.3 }); }, null, paint + 3)
        .to(b, { x: -40, rotation: -6, duration: 0.4 }, paint + 3.1).to(a, { x: 40, rotation: 6, duration: 0.4 }, paint + 3.1) // a hug
        .call(() => { const p = midOf(S); fling(L, p.x, p.y, ['❤️', '💕', '✨'], 12, { gravity: -40 }); MB.audio.sfx('heartbeat'); }, null, paint + 3.4);
      return { tl, idle: () => [
        gsap.to(streakEl, { opacity: 0.6, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.5 }),
        every(1, () => floatUp(S, ['❤️', '✨'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a workout: the first partner lifts the second overhead like a dumbbell and squats, counting, while the second
    // keeps reading; set down, flex, new record
    pushups: (S) => {
      const { a, b, L, c, cfg } = S, book = fxEl(L, 'cm-emoji', cfg.emoji ? cfg.emoji[0] : '📕');
      book.style.fontSize = '54px';
      gsap.set(book, { opacity: 0, xPercent: -50, yPercent: -50 });
      const stick = () => { const h = liveHead(b); gsap.set(book, { x: h.x - 50, y: h.y + h.h * 0.32 }); };
      const tl = gsap.timeline()
        .fromTo(a, { x: -300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(b, { x: 300, opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.8, ease: 'sine.out' }, 0.1)
        .call(() => { gsap.set(book, { opacity: 1 }); stick(); MB.audio.sfx('crinkle'); }, null, 0.9)
        .to(b, { x: -140, y: -200, rotation: -8, duration: 0.5, ease: 'back.out(1.4)' }, 1.2) // up she goes
        .call(() => { const h = headOf(S, a); word(L, h.x, h.y + 20, 'HUP!', c, 44); MB.audio.sfx('whoosh'); }, null, 1.2)
        .to({}, { duration: 4.2, onUpdate: stick }, 0.9);
      [17, 18, 19, 20].forEach((n, i) => {
        const at = 1.9 + i * 0.6;
        tl.to(a, { scaleY: 0.84, duration: 0.2, ease: 'power2.in' }, at).to(b, { y: -150, duration: 0.2, ease: 'power2.in' }, at)
          .to(a, { scaleY: 1, duration: 0.2, ease: 'power2.out' }, at + 0.25).to(b, { y: -200, duration: 0.2, ease: 'power2.out' }, at + 0.25)
          .call(() => { const h = headOf(S, a); word(L, h.x + 90, h.y + 120, n + '!', c, n === 20 ? 60 : 42); MB.audio.sfx(n === 20 ? 'ding' : 'thud'); }, null, at + 0.25);
      });
      talk(S, tl, 2.5);
      const end = Math.max(4.8, afterTalk(S, 2.5));
      tl.to(b, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: 'bounce.out' }, end)
        .call(() => {
          const p = midOf(S), h = headOf(S, a);
          MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'NEW RECORD!', c, 56);
          fling(L, h.x, h.y + 120, ['💪', '💪', '✨', '💦'], 12, { gravity: -30 });
          mood(S, a, 'win'); mood(S, b, 'play');
        }, null, end + 0.4)
        .to(a, { scale: 1.06, duration: 0.2, yoyo: true, repeat: 3 }, end + 0.4); // flex
      return { tl, idle: () => [
        gsap.to(a, { scaleY: 0.97, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(book, { rotation: 4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.9, () => floatUp(S, ['💪', '📕', '✨'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a roast: the second partner gets a mic under a spotlight and the jokes land on the first like punches, to a laugh
    // track. The comeback fizzles. Crickets
    roast: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || ['#ffffff', c], spot = prop(S, 'cm-spotlight', '', 0), mic = fxEl(L, 'cm-emoji', '🎤');
      mic.style.fontSize = '60px';
      gsap.set(mic, { opacity: 0, xPercent: -50, yPercent: -50 });
      spot.style.setProperty('--c', cb);
      const jokes = cfg.jokes || ['Gated-community gangster!', 'Your dad does TEETH.', 'Nice crew cut, Vanilla.'];
      const tl = gsap.timeline()
        .fromTo(spot, { xPercent: -50, opacity: 0 }, { opacity: 0.8, duration: 0.5 }, 0)
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .call(() => { spot.style.left = boxX(S, b) + 'px'; const h = headOf(S, b); gsap.fromTo(mic, { x: h.x - 60, y: h.y + 140, opacity: 1, scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }); MB.audio.sfx('click'); }, null, 0.5);
      talk(S, tl, 1);
      jokes.forEach((j, i) => tl.call(() => {
        const h0 = headOf(S, b), h1 = headOf(S, a), w = fxEl(L, 'cm-word', j, cb);
        w.style.fontSize = '30px';
        gsap.fromTo(w, { x: h0.x - 60, y: h0.y + 120, xPercent: -50, yPercent: -50, scale: 0.4 }, { x: h1.x, y: h1.y + 140, scale: 1, duration: 0.45, ease: 'power2.in', onComplete: () => {
          w.remove(); MB.audio.sfx('punch'); shake(S.ov, 8); spray(L, h1.x, h1.y + 140, cb, 12, { dist: [40, 160] }); word(L, h1.x, h1.y + 60, MB.pick(['OOF!', 'OUCH!', 'DAMN!']), ca, 40);
          gsap.delayedCall(0.15, () => MB.audio.sfx('laugh'));
        } });
        gsap.fromTo(a, { x: -30, rotation: -8 }, { x: 0, rotation: 0, duration: 0.5, delay: 0.45, ease: 'elastic.out(1,0.4)' });
        mood(S, a, 'lose'); mood(S, b, 'taunt');
      }, null, 1.6 + i * 1));
      const back = 1.6 + jokes.length + 0.6;
      tl.call(() => {
        const h = headOf(S, a), w = fxEl(L, 'cm-word', "Yo... your MOM!", ca);
        w.style.fontSize = '28px';
        mood(S, a, 'attack');
        gsap.fromTo(w, { x: h.x + 60, y: h.y + 120, xPercent: -50, yPercent: -50 }, { x: h.x + 180, y: h.y + 60, duration: 0.5, ease: 'power1.out', onComplete: () => gsap.to(w, { y: '+=260', rotation: 90, opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: () => w.remove() }) });
      }, null, back)
        .call(() => { const p = midOf(S); fling(L, p.x, p.y + 180, ['🦗'], 3, { dist: [40, 120], gravity: 40 }); MB.audio.sfx('tick'); gsap.delayedCall(0.3, () => MB.audio.sfx('tick')); }, null, back + 1)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'ROASTED 🔥', cb, 56);
          fling(L, p.x, p.y - 40, ['🔥', '🎤', '💅'], 12, { gravity: -40 });
          mood(S, b, 'win');
        }, null, back + 1.8)
        .to(a, { rotation: 6, scaleY: 0.95, duration: 0.3 }, back + 1.8); // sulks
      return { tl, idle: () => [
        gsap.to(spot, { opacity: 0.55, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(b, { rotation: -3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.1, () => floatUp(S, ['😂', '🔥', '💅'], midOf(S), 1, [18, 28])),
      ] };
    },

    // ---- cross-novel scenes

    // a job interview: a desk, the applicant slides a résumé over and a trail of past jobs (cfg.jobs) spills out of it,
    // the boss (cfg.mentor 0/1, default 1) reads the whole thing while the clock ticks... HIRED stamp, handshake
    interview: (S) => {
      const { a, b, L, c, cfg } = S, boss = cfg.mentor === 0 ? a : b, app = boss === a ? b : a, dir = boss === b ? 1 : -1;
      const desk = prop(S, 'cm-table', (cfg.food || ['🖊️', '☕', '📋']).map((f) => `<i>${f}</i>`).join(''), 2);
      const cv = fxEl(L, 'cm-paper', `<small>${cfg.paper || 'RÉSUMÉ'}</small><b>${cfg.stamp || 'HIRED!'}</b>`), stamp = cv.querySelector('b');
      const jobs = cfg.jobs || ['🧹', '🍳', '📦', '🚕', '🧾', '🛒'];
      gsap.set(cv, { opacity: 0, xPercent: -50, yPercent: -50 });
      gsap.set(stamp, { opacity: 0, rotation: -8 });
      const onDesk = () => { const p = midOf(S); return { x: p.x, y: p.y + 190 }; };
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .fromTo(desk, { xPercent: -50, y: 220, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.3)
        .call(() => {
          const h = headOf(S, app), p = onDesk();
          MB.audio.sfx('crinkle'); mood(S, app, 'play');
          gsap.fromTo(cv, { x: h.x, y: h.y + 260, opacity: 1, rotation: -20 * dir, scale: 0.4 }, { x: p.x, y: p.y, rotation: 4 * dir, scale: 1, duration: 0.5, ease: 'power2.out' });
        }, null, 0.8)
        .to(app, { x: dir * 30, duration: 0.2, yoyo: true, repeat: 1 }, 0.8);
      jobs.forEach((j, i) => tl.call(() => {
        const p = onDesk(), e = fxEl(L, 'cm-emoji', j), x = p.x + rnd(-170, 170);
        e.style.fontSize = '46px';
        MB.audio.sfx('pop');
        gsap.fromTo(e, { x: p.x, y: p.y - 40, xPercent: -50, yPercent: -50, scale: 0.3 },
          { keyframes: [{ x: (p.x + x) / 2, y: p.y - rnd(220, 320), scale: 1, duration: 0.4, ease: 'power2.out' }, { x, y: p.y + 180, duration: 0.5, ease: 'power2.in' }], rotation: rnd(-360, 360), onComplete: () => e.remove() });
      }, null, 1.4 + i * 0.22));
      talk(S, tl, 1.2);
      const read = 1.6 + jobs.length * 0.22;
      tl.to(boss, { rotation: -6 * dir, y: 14, duration: 0.3 }, read) // leans in to read
        .call(() => { const h = headOf(S, boss); word(L, h.x, h.y + 40, '...', c, 44); MB.audio.sfx('tick'); }, null, read + 0.2)
        .call(() => MB.audio.sfx('tick'), null, read + 0.6)
        .call(() => MB.audio.sfx('tick'), null, read + 1);
      const end = Math.max(read + 1.4, afterTalk(S, 1.2));
      tl.to(boss, { rotation: 0, y: 0, duration: 0.2 }, end - 0.2)
        .call(() => {
          const p = onDesk();
          MB.audio.sfx('thud'); MB.audio.sfx('bond', S.tier); shake(S.ov, 10);
          gsap.fromTo(stamp, { opacity: 1, scale: 3 }, { scale: 1, duration: 0.25, ease: 'power3.in' });
          spray(L, p.x, p.y, '#e0102a', 18, { dist: [40, 200], stars: 0.4 });
          word(L, p.x, p.y - 280, cfg.word || "YOU'RE HIRED!", c, 54);
          mood(S, boss, 'win'); mood(S, app, 'win');
        }, null, end)
        .to(app, { y: -60, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, end + 0.3)
        .to(a, { x: 30, duration: 0.3 }, end + 1).to(b, { x: -30, duration: 0.3 }, end + 1)
        .call(() => { const p = midOf(S); fling(L, p.x, p.y + 80, ['🤝'], 1, { dist: [0, 10], gravity: -80, size: [70, 80] }); MB.audio.sfx('applause'); }, null, end + 1.2);
      return { tl, idle: () => [
        gsap.to(app, { y: -10, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // eager
        gsap.timeline({ repeat: -1, repeatDelay: 1.8 }).to(boss, { y: 6, duration: 0.2, yoyo: true, repeat: 1 }), // approving nods
        every(1, () => { const h = headOf(S, app); floatUp(S, cfg.emoji || jobs, { x: h.x, y: h.y + 120 }, 1, [20, 30]); }),
      ] };
    },

    // stand-up night: a spotlight each, the mic passes back and forth, every line gets a rimshot and a tomato from the
    // crowd. At the end they crack each other up
    standup: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'];
      const spots = [0, 1].map((i) => { const sp = prop(S, 'cm-spotlight', '', 0); sp.style.setProperty('--c', i ? cb : ca); sp.style.width = '520px'; return sp; });
      const mic = fxEl(L, 'cm-emoji', '🎤'), n = Math.max(2, nLines(S)), gap = 1.7;
      mic.style.fontSize = '58px';
      gsap.set(mic, { opacity: 0, xPercent: -50, yPercent: -50 });
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .call(() => spots.forEach((sp, i) => { sp.style.left = boxX(S, i ? b : a) + 'px'; }), null, 0.05)
        .fromTo(spots, { xPercent: -50, opacity: 0 }, { opacity: 0.3, duration: 0.4 }, 0.2);
      for (let i = 0; i < n; i++) {
        const at = 1 + i * gap, by = nLines(S) > i ? lineOf(S, i).by : i % 2, im = by ? b : a, other = by ? a : b;
        tl.call(() => {
          const h = headOf(S, im);
          gsap.to(mic, { x: h.x + (by ? -70 : 70), y: h.y + 150, opacity: 1, duration: 0.3, ease: 'power2.out' });
          gsap.to(spots[by], { opacity: 0.85, duration: 0.2 }); gsap.to(spots[1 - by], { opacity: 0.2, duration: 0.2 });
          mood(S, im, 'taunt'); mood(S, other, 'lose');
        }, null, at)
          .to(im, { rotation: by ? -5 : 5, duration: 0.2, yoyo: true, repeat: 1 }, at)
          .call(() => { // ba-dum tss
            const h = headOf(S, im);
            MB.audio.sfx('thud'); gsap.delayedCall(0.14, () => MB.audio.sfx('thud')); gsap.delayedCall(0.3, () => MB.audio.sfx('tink'));
            word(L, h.x, h.y - 30, cfg.rim || 'BA-DUM TSS!', by ? cb : ca, 34);
          }, null, at + 0.9)
          .call(() => { // a tomato from the crowd
            const h = headOf(S, im), t = fxEl(L, 'cm-emoji', '🍅'), x0 = h.x + rnd(-200, 200), y1 = h.y + 120;
            t.style.fontSize = '52px';
            gsap.fromTo(t, { x: x0, y: 960, xPercent: -50, yPercent: -50 }, { keyframes: [{ x: (x0 + h.x) / 2, y: y1 - 200, duration: 0.3, ease: 'power1.out' }, { x: h.x, y: y1, duration: 0.25, ease: 'power1.in' }],
              rotation: 540, onComplete: () => { t.remove(); MB.audio.sfx('splat'); spray(L, h.x, y1, '#e0302a', 16, { dist: [30, 140], stars: 0 }); } });
            const o = headOf(S, other);
            word(L, o.x, o.y + 60, MB.pick(['*groan*', '🙄', 'boo!']), '#ffffff', 30);
          }, null, at + 1.15);
      }
      talk(S, tl, 1.1, gap);
      const end = 1 + n * gap + 0.2;
      tl.call(() => {
        const p = midOf(S);
        MB.audio.sfx('laugh'); MB.audio.sfx('bond', S.tier);
        gsap.to(spots, { opacity: 0.7, duration: 0.3 }); gsap.to(mic, { opacity: 0, duration: 0.3 });
        word(L, p.x, p.y - 190, cfg.word || 'ENCORE?!', c, 54);
        fling(L, p.x, p.y - 40, ['😂', '🤣', '🎤', '🍅'], 14, { gravity: -40 });
        mood(S, a, 'win'); mood(S, b, 'win');
      }, null, end)
        .to(a, { x: 24, rotation: 6, duration: 0.3 }, end).to(b, { x: -24, rotation: -6, duration: 0.3 }, end);
      return { tl, idle: () => [
        gsap.to([a, b], { scaleY: 0.96, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.12 }), // still giggling
        gsap.to(spots, { opacity: 0.45, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.6 }),
        every(0.9, () => floatUp(S, ['😂', '🤣', '🎤'], midOf(S), 1, [18, 30])),
      ] };
    },

    // bartender flair: bottles (cfg.food) fly back and forth between them, spinning, then all pour into one glass
    // (cfg.result) held up between them. Cheers
    flair: (S) => {
      const { a, b, L, c, cfg } = S, items = cfg.food || ['🍸', '🥃', '🍾'], glass = prop(S, 'cm-frame', cfg.result || '🍹', 3);
      gsap.set(glass, { xPercent: -50, opacity: 0 });
      const hand = (im) => { const h = headOf(S, im); return { x: h.x + (im === a ? 70 : -70), y: h.y + im.offsetHeight * 0.42 }; };
      const glassAt = () => { const r = glass.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top + r.height / 2); };
      const els = items.map((f) => { const e = fxEl(L, 'cm-emoji', f); e.style.fontSize = '56px'; gsap.set(e, { opacity: 0, xPercent: -50, yPercent: -50 }); return e; });
      const holder = items.map((f, j) => j % 2);
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 380 : -380), opacity: 0 }, { x: (i) => (i ? 30 : -30), opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0)
        .call(() => els.forEach((e, j) => { const p = hand(holder[j] ? b : a); gsap.fromTo(e, { x: p.x, y: p.y, opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)' }); }), null, 0.7);
      const throws = items.length * 3;
      for (let k = 0; k < throws; k++) tl.call(() => {
        const j = k % items.length, from = holder[j] ? b : a, to = holder[j] ? a : b, p0 = hand(from), p1 = hand(to);
        holder[j] = 1 - holder[j];
        MB.audio.sfx('whoosh');
        gsap.to(els[j], { keyframes: [{ x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - rnd(220, 330), duration: 0.3, ease: 'power1.out' }, { x: p1.x, y: p1.y, duration: 0.3, ease: 'power1.in' }],
          rotation: '+=540', onComplete: () => MB.audio.sfx('tink', { rate: 0.8 + j * 0.15 }) });
        gsap.fromTo(to, { y: 0 }, { y: 10, duration: 0.12, delay: 0.55, yoyo: true, repeat: 1 });
      }, null, 1.1 + k * 0.28);
      talk(S, tl, 1.2);
      const pour = Math.max(1.1 + throws * 0.28 + 0.5, afterTalk(S, 1.2) - 0.6);
      tl.to(glass, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', startAt: { scale: 0 } }, pour)
        .call(() => els.forEach((e, j) => {
          const g = glassAt();
          gsap.to(e, { x: g.x + (j - (items.length - 1) / 2) * 50, y: g.y - 90, rotation: j % 2 ? -140 : 140, duration: 0.35, delay: j * 0.12, ease: 'power2.out',
            onComplete: () => { spray(L, g.x, g.y - 30, c, 8, { dist: [20, 80], stars: 0.2, gravity: 120 }); MB.audio.sfx('bubble'); gsap.to(e, { opacity: 0, duration: 0.4, delay: 0.3 }); } });
        }), null, pour + 0.2)
        .to([a, b], { x: 0, duration: 0.3 }, pour + 0.9)
        .call(() => {
          const g = glassAt();
          MB.audio.sfx('tink'); gsap.delayedCall(0.1, () => MB.audio.sfx('tink', { rate: 1.3 })); MB.audio.sfx('bond', S.tier);
          word(L, g.x, g.y - 130, cfg.word || 'CHEERS!', c, 54);
          spray(L, g.x, g.y, c, 26, { dist: [60, 260], stars: 0.7 });
          mood(S, a, 'win'); mood(S, b, 'win');
        }, null, pour + 1.2);
      return { tl, idle: () => [
        gsap.to(glass, { y: -10, rotation: 5, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: -6, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 }),
        every(0.5, () => { const g = glassAt(); floatUp(S, ['🫧', '✨'], { x: g.x, y: g.y - 40 }, 1, [14, 24]); }),
      ] };
    },

    // the night patrol: two flashlight beams sweep the dark, something sneaks along the floor (cfg.emoji[0]), both beams
    // lock on to it at once. FREEZE! It's only a raccoon. It runs
    patrol: (S) => {
      const { a, b, L, c, cfg } = S, crit = fxEl(L, 'cm-emoji', (cfg.emoji || ['🦝'])[0]);
      const beams = [a, b].map(() => { const m = fxEl(L, 'cm-beam', '', '#fff6c8'); gsap.set(m, { opacity: 0, yPercent: -50, transformOrigin: '0% 50%' }); return m; });
      crit.style.fontSize = '64px';
      gsap.set(crit, { opacity: 0, xPercent: -50, yPercent: -50 });
      const hand = (im) => { const h = headOf(S, im); return { x: h.x + (im === a ? 50 : -50), y: h.y + im.offsetHeight * 0.4 }; };
      const aim = (i, p, dur = 0.5) => { const h = hand(i ? b : a); gsap.to(beams[i], { x: h.x, y: h.y, rotation: (Math.atan2(p.y - h.y, p.x - h.x) * 180) / Math.PI, duration: dur, ease: 'sine.inOut' }); };
      const floorAt = (f) => ({ x: S.box.offsetLeft + S.box.offsetWidth * f, y: S.box.offsetTop + S.box.offsetHeight - 50 });
      const tl = gsap.timeline()
        .fromTo([a, b], { opacity: 0, y: 30 }, { opacity: SPRITE_OP, y: 0, duration: 0.8, stagger: 0.2, ease: 'sine.out' }, 0)
        .to([a, b], { x: (i) => (i ? 40 : -40), duration: 0.5 }, 0.5) // back to back
        .call(() => { MB.audio.sfx('click'); [0, 1].forEach((i) => { const h = hand(i ? b : a); gsap.set(beams[i], { x: h.x, y: h.y, rotation: i ? 200 : -20, opacity: 0.85 }); }); }, null, 0.8);
      // the beams sweep, each on its own side
      [[1.1, 0.1, 0.9], [2, 0.35, 0.6], [2.9, 0.05, 0.95]].forEach(([at, fa, fb]) => tl.call(() => { aim(0, floorAt(fb)); aim(1, floorAt(fa)); }, null, at));
      tl.call(() => { const p = floorAt(0.5); gsap.fromTo(crit, { x: p.x + 500, y: p.y, opacity: 1 }, { x: p.x, duration: 1.4, ease: 'steps(10)' }); MB.audio.sfx('squeak'); }, null, 2.2);
      talk(S, tl, 1.4);
      const caught = Math.max(3.7, afterTalk(S, 1.4) - 0.4);
      tl.call(() => {
        const p = floorAt(0.5);
        aim(0, p, 0.15); aim(1, p, 0.15);
        MB.audio.sfx('whistle'); shake(S.ov, 8);
        gsap.to(crit, { y: p.y - 60, scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 });
        word(L, p.x, p.y - 160, cfg.freeze || 'FREEZE!', '#ffffff', 58);
        ring(L, p.x, p.y, '#fff6c8', { size: 120, scale: 3, width: 8 });
        mood(S, a, 'attack'); mood(S, b, 'attack');
      }, null, caught)
        .to([a, b], { x: 0, duration: 0.3 }, caught)
        .call(() => { const p = floorAt(0.5); gsap.to(crit, { x: p.x - 700, duration: 0.7, ease: 'power2.in' }); MB.audio.sfx('zip'); fling(L, p.x, p.y - 20, ['💨'], 3, { dist: [20, 80], gravity: -20 }); }, null, caught + 1)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'ALL CLEAR.', c, 52);
          [0, 1].forEach((i) => aim(i, { x: p.x + (i ? -400 : 400), y: p.y - 300 }, 0.6));
          mood(S, a, 'taunt'); mood(S, b, 'taunt');
        }, null, caught + 1.6);
      return { tl, idle: () => [
        gsap.to(beams, { opacity: 0.6, duration: 0.12, yoyo: true, repeat: -1, repeatDelay: 2.2, stagger: 0.7 }), // flicker
        every(2.4, () => { const p = midOf(S); [0, 1].forEach((i) => aim(i, { x: p.x + rnd(-500, 500), y: p.y + rnd(-300, 300) }, 1.2)); }),
        gsap.to([a, b], { y: -4, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      ] };
    },

    // a confession: a lattice screen between them, the sinner (cfg.sinner 0/1, default 1) confesses and each sin
    // (cfg.emoji) floats over into a meter above; it maxes out, alarms, the other lunges, the sinner blows a kiss
    confession: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], sinner = cfg.sinner === 0 ? a : b, judge = sinner === a ? b : a, dir = sinner === b ? -1 : 1;
      const screen = prop(S, 'cm-lattice', '', 2), meter = prop(S, 'cm-meter', `<small>${cfg.meter || 'SIN'}</small><i></i>`, 3), fill = meter.querySelector('i');
      const sins = cfg.emoji || ['💋', '🍷', '😈', '🍫', '💸'];
      meter.style.setProperty('--c', '#ff3b5c');
      const meterAt = () => { const r = meter.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top + r.height / 2); };
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 300 : -300), opacity: 0 }, { x: (i) => (i ? 40 : -40), opacity: SPRITE_OP, duration: 0.7, ease: 'power2.out' }, 0)
        .fromTo(screen, { xPercent: -50, scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.4)
        .fromTo(meter, { xPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.7)
        .call(() => { MB.audio.sfx('gong'); mood(S, sinner, 'play'); mood(S, judge, 'taunt'); }, null, 0.5);
      talk(S, tl, 1.1);
      sins.forEach((s, i) => tl.call(() => {
        const h = headOf(S, sinner), e = fxEl(L, 'cm-emoji', s), m = meterAt(), f = (i + 1) / sins.length;
        e.style.fontSize = '46px';
        gsap.fromTo(e, { x: h.x - dir * 40, y: h.y + 120, xPercent: -50, yPercent: -50, scale: 0.4 }, { keyframes: [{ x: (h.x + m.x) / 2, y: m.y - 120, scale: 1, duration: 0.35 }, { x: m.x, y: m.y, scale: 0.4, duration: 0.3 }],
          onComplete: () => { e.remove(); gsap.to(fill, { width: f * 100 + '%', duration: 0.25 }); MB.audio.sfx('tick'); spray(L, m.x, m.y, '#ff3b5c', 6, { dist: [20, 80] }); } });
        gsap.to(judge, { rotation: dir * -3 * (i + 1), duration: 0.2 }); // leans closer each time
      }, null, 1.5 + i * 0.55));
      const boom = Math.max(1.5 + sins.length * 0.55 + 0.4, afterTalk(S, 1.1) - 0.3);
      tl.call(() => {
        const m = meterAt(), h = headOf(S, judge);
        MB.audio.sfx('zap'); MB.audio.sfx('fire'); shake(S.ov, 12);
        meter.classList.add('full');
        word(L, m.x, m.y - 70, cfg.alarm || 'SIN DETECTED', '#ff3b5c', 44);
        ring(L, h.x, h.y + 200, ca, { size: 200, scale: 2.2, width: 10 });
        mood(S, judge, 'attack');
      }, null, boom)
        .to(judge, { x: dir * -90, rotation: 0, scale: 1.08, duration: 0.2, ease: 'power3.in' }, boom + 0.2) // lunges through the screen
        .to(screen, { rotation: dir * 4, duration: 0.06, yoyo: true, repeat: 5 }, boom + 0.35)
        .to(sinner, { x: dir * -150, y: -40, rotation: dir * 10, duration: 0.3, ease: 'power2.out' }, boom + 0.3) // hops out of reach
        .call(() => { const h = headOf(S, sinner); MB.audio.sfx('kiss'); MB.audio.sfx('bond', S.tier); fling(L, h.x, h.y + 100, ['💋', '💕', '😈'], 10, { gravity: -40 }); word(L, h.x, h.y - 10, cfg.word || '~♥', cb, 54); mood(S, sinner, 'win'); }, null, boom + 0.6)
        .to(sinner, { y: 0, duration: 0.4, ease: 'bounce.out' }, boom + 0.7);
      return { tl, idle: () => [
        gsap.to(meter, { scale: 1.06, duration: 0.3, yoyo: true, repeat: -1 }),
        gsap.timeline({ repeat: -1, repeatDelay: 1.6 }).to(judge, { x: '+=' + dir * -12, duration: 0.06, yoyo: true, repeat: 5 }), // trembling with holy rage
        gsap.to(sinner, { rotation: '+=4', duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.8, () => { const h = headOf(S, sinner); floatUp(S, sins, { x: h.x, y: h.y + 80 }, 1, [18, 28]); }),
      ] };
    },

    // the shrine: a corkboard behind them fills up with photos of YOU as they take turns pinning them, faster and
    // faster; one last photo, they both grab it and it rips in two. Half each
    shrine: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], board = prop(S, 'cm-cork', '', 0), face = cfg.face || '🫵', cap = cfg.caption || 'you ♥';
      const snap = (x, y, rot, big) => {
        const e = fxEl(L, 'cm-snap' + (big ? ' big' : ''), `<i>${face}</i><b>${cap}</b>`);
        gsap.fromTo(e, { x, y, xPercent: -50, yPercent: -50, rotation: rot, scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: 'power3.in' });
        return e;
      };
      const boardAt = () => { const r = board.getBoundingClientRect(), p = toUi(r.left, r.top), q = toUi(r.right, r.bottom); return { x0: p.x, y0: p.y, x1: q.x, y1: q.y }; };
      const tl = gsap.timeline()
        .fromTo(board, { xPercent: -50, scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0)
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0.2);
      const pins = 12;
      for (let i = 0; i < pins; i++) tl.call(() => {
        const r = boardAt(), im = i % 2 ? b : a;
        snap(rnd(r.x0 + 60, r.x1 - 60), rnd(r.y0 + 60, r.y1 - 60), rnd(-18, 18));
        MB.audio.sfx(i % 3 ? 'tink' : 'camera');
        gsap.fromTo(im, { y: -14 }, { y: 0, duration: 0.2 });
        mood(S, im, 'play');
      }, null, 1 + Math.pow(i, 0.8) * 0.36);
      talk(S, tl, 1.2);
      const last = Math.max(1 + Math.pow(pins, 0.8) * 0.36 + 0.3, afterTalk(S, 1.2) - 0.8);
      let big = null;
      tl.call(() => { const p = midOf(S); big = snap(p.x, p.y + 120, 0, true); MB.audio.sfx('heartbeat'); word(L, p.x, p.y - 30, '!!', '#ffffff', 50); }, null, last)
        .to(a, { x: 60, duration: 0.25, ease: 'power2.in' }, last + 0.4).to(b, { x: -60, duration: 0.25, ease: 'power2.in' }, last + 0.4)
        .call(() => { mood(S, a, 'attack'); mood(S, b, 'attack'); MB.audio.sfx('stretch'); gsap.to(big, { rotation: 6, duration: 0.06, yoyo: true, repeat: 9 }); }, null, last + 0.65)
        .to(a, { x: 40, duration: 0.07, yoyo: true, repeat: 7 }, last + 0.65).to(b, { x: -40, duration: 0.07, yoyo: true, repeat: 7 }, last + 0.65)
        .call(() => {
          const p = { x: gsap.getProperty(big, 'x'), y: gsap.getProperty(big, 'y') };
          big.remove();
          MB.audio.sfx('rip'); shake(S.ov, 8);
          [-1, 1].forEach((s) => {
            const half = fxEl(L, 'cm-snap big half' + (s > 0 ? ' r' : ''), `<i>${face}</i><b>${cap}</b>`);
            gsap.fromTo(half, { x: p.x, y: p.y, xPercent: -50, yPercent: -50 }, { x: p.x + s * 170, y: p.y + 30, rotation: s * 24, duration: 0.4, ease: 'power2.out' });
          });
          word(L, p.x, p.y - 150, cfg.word || 'HALF EACH... FOR NOW ♥', c, 42);
          fling(L, p.x, p.y, ['💔', '💗', '🔪'], 10, { gravity: -30 });
          MB.audio.sfx('bond', S.tier);
          mood(S, a, 'win'); mood(S, b, 'win');
        }, null, last + 1.25)
        .to(a, { x: -20, rotation: -4, duration: 0.3 }, last + 1.25).to(b, { x: 20, rotation: 4, duration: 0.3 }, last + 1.25);
      return { tl, idle: () => [
        gsap.to([a, b], { rotation: (i) => (i ? 3 : -3), duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // cuddling their halves
        every(0.7, () => { const r = boardAt(); floatUp(S, ['💗', '💕', '📸'], { x: rnd(r.x0, r.x1), y: r.y1 - 40 }, 1, [18, 28]); }),
        every(1.3, () => { const p = midOf(S); spray(L, p.x, p.y, MB.pick([ca, cb]), 5, { dist: [20, 90], stars: 0.6 }); }),
      ] };
    },

    // a proof at the chalkboard: they take turns writing, the first partner flexes and snaps the chalk, the second
    // gets flustered, and the answer turns out to be a heart
    solve: (S) => {
      const { a, b, L, c, cfg } = S, board = prop(S, 'cm-chalkboard', `<span></span><b>${cfg.answer || '= ♥'}</b>`, 0), txt = board.querySelector('span'), ans = board.querySelector('b');
      const steps = cfg.steps || ['x² + y² = ?', 'x² + y² = 4?', '...(x + y)² ?!'];
      const chalk = (im) => { const r = board.getBoundingClientRect(), p = toUi(r.left + r.width * (im === a ? 0.3 : 0.7), r.top + r.height * 0.45); spray(L, p.x, p.y, '#f4f4ea', 10, { dist: [10, 80], size: [3, 7], stars: 0, gravity: 120 }); MB.audio.sfx('swish'); };
      const tl = gsap.timeline()
        .fromTo(board, { xPercent: -50, y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0)
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0.1);
      steps.forEach((s, i) => {
        const im = i % 2 ? b : a;
        tl.to(im, { rotation: i % 2 ? -6 : 6, y: -16, duration: 0.2, yoyo: true, repeat: 1 }, 0.9 + i * 0.8)
          .call(() => { txt.textContent = s; chalk(im); mood(S, im, 'attack'); }, null, 1 + i * 0.8);
      });
      talk(S, tl, 1.1);
      const flex = Math.max(1 + steps.length * 0.8 + 0.2, afterTalk(S, 1.1) - 1);
      tl.to(a, { scale: 1.08, duration: 0.2, yoyo: true, repeat: 3 }, flex) // flexes
        .call(() => {
          const h = headOf(S, a);
          MB.audio.sfx('buff'); MB.audio.sfx('twang');
          word(L, h.x, h.y + 60, cfg.flex || '*FLEX*', c, 44);
          fling(L, h.x + 60, h.y + 180, ['💪', '🖍️', '✨'], 8, { gravity: 80 });
          mood(S, a, 'taunt');
        }, null, flex + 0.1)
        .call(() => {
          const h = headOf(S, b);
          MB.audio.sfx('heartbeat');
          word(L, h.x, h.y + 20, cfg.fluster || 'H-hwaa?!', '#ff8fc6', 40);
          fling(L, h.x, h.y + 60, ['💦', '💗', '💓'], 10, { gravity: -30 });
          mood(S, b, 'lose');
        }, null, flex + 0.6)
        .to(b, { x: 20, duration: 0.05, yoyo: true, repeat: 7 }, flex + 0.6)
        .call(() => {
          const r = board.getBoundingClientRect(), p = toUi(r.left + r.width / 2, r.top + r.height / 2);
          MB.audio.sfx('ding'); MB.audio.sfx('bond', S.tier);
          gsap.fromTo(ans, { opacity: 1, scale: 3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
          word(L, p.x, p.y - 150, cfg.word || 'Q.E.D. ♥', c, 52);
          spray(L, p.x, p.y, '#ff8fc6', 20, { dist: [60, 240], stars: 0.6 });
          mood(S, b, 'play'); mood(S, a, 'win');
        }, null, flex + 1.3);
      return { tl, idle: () => [
        gsap.timeline({ repeat: -1, repeatDelay: 2 }).to(a, { scale: 1.04, duration: 0.2, yoyo: true, repeat: 1 }), // can't stop flexing
        gsap.to(b, { rotation: -3, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.8, () => { const h = headOf(S, b); floatUp(S, ['💗', '💦', '📐'], { x: h.x, y: h.y + 80 }, 1, [16, 26]); }),
      ] };
    },

    // three rounds in the ring: the bell, punches both ways, a double knockout on a cross-counter, the count... both
    // stand up at 9 and bump fists
    boxing: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], ropes = prop(S, 'cm-ropes', '<i></i><i></i><i></i>', 2);
      const hits = cfg.emoji ? [[cfg.emoji[0]], [cfg.emoji[1] || cfg.emoji[0]]] : [['👊', '🦶'], ['👊', '🥊']];
      const bell = (n) => { const p = midOf(S); MB.audio.sfx('ding'); gsap.delayedCall(0.2, () => MB.audio.sfx('ding')); word(L, p.x, p.y - 200, `ROUND ${n}`, '#ffffff', 48); };
      const blow = (from, to, j) => {
        const h0 = headOf(S, from), h1 = headOf(S, to), e = fxEl(L, 'cm-emoji', MB.pick(hits[j]));
        e.style.fontSize = '64px';
        gsap.fromTo(e, { x: h0.x, y: h0.y + 200, xPercent: -50, yPercent: -50, scaleX: j ? -1 : 1 }, { x: h1.x, y: h1.y + 170, duration: 0.18, ease: 'power2.in',
          onComplete: () => { e.remove(); MB.audio.sfx('punch'); spray(L, h1.x, h1.y + 170, j ? cb : ca, 12, { dist: [30, 150] }); word(L, h1.x, h1.y + 90, MB.pick(['POW!', 'BAM!', 'WHAM!']), j ? cb : ca, 36); } });
        gsap.fromTo(from, { x: j ? -60 : 60 }, { x: 0, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo(to, { rotation: j ? -8 : 8 }, { rotation: 0, duration: 0.4, delay: 0.18, ease: 'elastic.out(1,0.4)' });
        mood(S, from, 'attack'); mood(S, to, 'lose');
      };
      const tl = gsap.timeline()
        .fromTo(ropes, { xPercent: -50, scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 0)
        .fromTo([a, b], { x: (i) => (i ? 380 : -380), opacity: 0 }, { x: 0, opacity: SPRITE_OP, duration: 0.6, ease: 'power2.out' }, 0.2)
        .call(() => bell(1), null, 0.9)
        .call(() => blow(a, b, 0), null, 1.4).call(() => blow(b, a, 1), null, 1.9)
        .call(() => bell(2), null, 2.6)
        .call(() => blow(b, a, 1), null, 3.1).call(() => blow(a, b, 0), null, 3.5).call(() => blow(b, a, 1), null, 3.9)
        .call(() => bell(3), null, 4.6)
        .to(a, { x: 70, duration: 0.2, ease: 'power3.in' }, 5.1).to(b, { x: -70, duration: 0.2, ease: 'power3.in' }, 5.1)
        .call(() => { const p = midOf(S); MB.audio.sfx('punch'); MB.audio.sfx('boom'); shake(S.ov, 16); ring(L, p.x, p.y + 100, '#ffffff', { size: 120, scale: 4, width: 10 }); word(L, p.x, p.y - 60, 'K.O.?!', '#ffffff', 64); mood(S, a, 'lose'); mood(S, b, 'lose'); }, null, 5.3)
        .to(a, { x: -20, y: 90, rotation: -24, duration: 0.4, ease: 'bounce.out' }, 5.4).to(b, { x: 20, y: 90, rotation: 24, duration: 0.4, ease: 'bounce.out' }, 5.4);
      ['1', '2', '3', '...', '9'].forEach((n, i) => tl.call(() => { const p = midOf(S); word(L, p.x, p.y + 60, n, '#ffffff', 44); MB.audio.sfx('tick'); }, null, 6 + i * 0.4));
      talk(S, tl, 1.2, 1.5);
      const up = Math.max(8.1, afterTalk(S, 1.2, 1.5));
      tl.to([a, b], { x: 0, y: 0, rotation: 0, duration: 0.4, ease: 'back.out(2)' }, up)
        .to(a, { x: 30, duration: 0.2 }, up + 0.5).to(b, { x: -30, duration: 0.2 }, up + 0.5)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('clang'); MB.audio.sfx('bond', S.tier); MB.audio.sfx('cheer');
          fling(L, p.x, p.y + 60, ['🤜', '🤛'], 2, { dist: [10, 40], gravity: -60, size: [60, 70] });
          word(L, p.x, p.y - 190, cfg.word || 'DRAW! REMATCH!', c, 54);
          spray(L, p.x, p.y, c, 26, { dist: [60, 260], stars: 0.6 });
          mood(S, a, 'win'); mood(S, b, 'win');
        }, null, up + 0.7);
      return { tl, idle: () => [
        gsap.to([a, b], { y: -10, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.15 }), // bouncing on their toes
        gsap.to(ropes, { scaleY: 1.1, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(1.1, () => floatUp(S, ['💪', '🥊', '💦'], midOf(S), 1, [18, 28])),
      ] };
    },

    // a scheme: a chessboard between them, they take turns moving pieces with an evil laugh each (cfg.laughs), a crown
    // rises... and each is hiding a dagger behind her back. Knowing smiles. Partners, for now
    scheme: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], laughs = cfg.laughs || ['Ohohoho~!', 'Fufufu~'];
      const board = prop(S, 'cm-chess', '<i></i>', 2), crown = prop(S, 'cm-frame', cfg.result || '👑', 3);
      gsap.set(crown, { xPercent: -50, opacity: 0 });
      const boardAt = () => { const r = board.getBoundingClientRect(); return { ...toUi(r.left + r.width / 2, r.top), w: r.width / toUi(0, 0).s }; };
      const pieces = cfg.emoji || ['♟️', '♞', '♜', '♝'];
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 300 : -300), opacity: 0 }, { x: (i) => (i ? 20 : -20), opacity: SPRITE_OP, duration: 0.7, ease: 'power2.out' }, 0)
        .fromTo(board, { xPercent: -50, y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.4);
      for (let i = 0; i < 4; i++) tl.call(() => {
        const bp = boardAt(), im = i % 2 ? b : a, x0 = bp.x + (i % 2 ? 1 : -1) * bp.w * 0.35, x1 = bp.x + (i % 2 ? -1 : 1) * rnd(0.05, 0.3) * bp.w;
        const k = fxEl(L, 'cm-emoji cm-piece', pieces[i % pieces.length]);
        k.style.color = i % 2 ? cb : ca;
        gsap.fromTo(k, { x: x0, y: bp.y - 20, xPercent: -50, yPercent: -100, scale: 0 }, { keyframes: [{ scale: 1, duration: 0.15 }, { x: (x0 + x1) / 2, y: bp.y - 100, duration: 0.25, ease: 'power1.out' }, { x: x1, y: bp.y - 20, duration: 0.25, ease: 'power1.in' }],
          onComplete: () => MB.audio.sfx('tink') });
        const h = headOf(S, im);
        gsap.delayedCall(0.4, () => { word(L, h.x, h.y + 20, laughs[i % 2], i % 2 ? cb : ca, 34); MB.audio.sfx('laugh'); });
        gsap.fromTo(im, { rotation: i % 2 ? -8 : 8 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
        mood(S, im, 'taunt');
      }, null, 1.1 + i * 0.9);
      talk(S, tl, 1.3);
      const rise = Math.max(4.9, afterTalk(S, 1.3) - 0.8);
      tl.to(crown, { opacity: 1, y: -30, duration: 0.6, ease: 'back.out(2)', startAt: { y: 120 } }, rise)
        .call(() => { const p = midOf(S); MB.audio.sfx('fanfare'); spray(L, p.x, p.y - 200, '#ffd24a', 24, { dist: [60, 240], stars: 0.8 }); }, null, rise)
        .call(() => { // the daggers behind their backs
          [a, b].forEach((im, i) => {
            const h = headOf(S, im), d = fxEl(L, 'cm-emoji', '🗡️');
            d.style.fontSize = '56px';
            gsap.fromTo(d, { x: h.x + (i ? 130 : -130), y: h.y + 300, xPercent: -50, yPercent: -50, rotation: i ? 150 : -150, opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 1.2, onComplete: () => d.remove() });
            gsap.delayedCall(0.3, () => word(L, h.x + (i ? -40 : 40), h.y - 10, '👀', '#ffffff', 40));
          });
          MB.audio.sfx('unsheathe');
        }, null, rise + 0.9)
        .to(a, { rotation: 4, duration: 0.2 }, rise + 1.1).to(b, { rotation: -4, duration: 0.2 }, rise + 1.1) // side-eye
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('laugh'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 290, cfg.word || 'Partners~ ♥', c, 50);
          fling(L, p.x, p.y - 120, ['👑', '💜', '🗝️', '✨'], 12, { gravity: -30 });
          mood(S, a, 'win'); mood(S, b, 'win');
        }, null, rise + 2.4)
        .to([a, b], { rotation: 0, duration: 0.3 }, rise + 2.4);
      return { tl, idle: () => [
        gsap.to(crown, { y: -44, rotation: 4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.timeline({ repeat: -1, repeatDelay: 2.6 }).to(a, { x: -8, duration: 0.2, yoyo: true, repeat: 1 }).to(b, { x: 8, duration: 0.2, yoyo: true, repeat: 1 }, 0.3),
        every(1.2, () => { const bp = boardAt(); spray(L, bp.x + rnd(-80, 80), bp.y - 20, MB.pick([ca, cb]), 5, { dist: [20, 80], stars: 0.8, gravity: -40 }); }),
      ] };
    },

    // a bake-off: an oven each, a timer; the first partner's treat (cfg.food[0]) rises perfectly, the second's oven
    // rattles, smokes and blows up... into a giant cake (cfg.food[1]). The judges' scores (cfg.scores) come up
    bakeoff: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], food = cfg.food || ['🧁', '🎂'], scores = cfg.scores || ['9', '10'];
      const ovens = [0, 1].map((i) => { const o = prop(S, 'cm-oven', '<i></i>', 2); o.style.setProperty('--c', i ? cb : ca); return o; });
      const timer = prop(S, 'cm-frame', '⏲️', 3);
      gsap.set(timer, { xPercent: -50 });
      const ovenAt = (i) => { const r = ovens[i].getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top); };
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .call(() => ovens.forEach((o, i) => { o.style.left = boxX(S, i ? b : a) + 'px'; }), null, 0.05)
        .fromTo(ovens, { xPercent: -50, y: 240, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.6)' }, 0.3)
        .fromTo(timer, { scale: 0, opacity: 0 }, { scale: 0.7, opacity: 1, duration: 0.3, ease: 'back.out(3)' }, 0.7)
        .to(timer, { rotation: 10, duration: 0.1, yoyo: true, repeat: 23 }, 1)
        .add(gsap.timeline({ repeat: 8 }).call(() => MB.audio.sfx('tick')).to({}, { duration: 0.3 }), 1)
        .to(ovens[1], { x: 6, duration: 0.05, yoyo: true, repeat: 39 }, 1.4) // rattling
        .add(times(9, 0.25, () => { const p = ovenAt(1), st = fxEl(L, 'cm-steam'); gsap.fromTo(st, { x: p.x + rnd(-40, 40), y: p.y, xPercent: -50, opacity: 0.9, scale: 0.8, background: '#555' }, { y: p.y - 200, opacity: 0, scale: 2.4, duration: 1.4, onComplete: () => st.remove() }); }), 1.6);
      talk(S, tl, 1.2);
      const done = Math.max(3.9, afterTalk(S, 1.2) - 0.6);
      tl.call(() => { // the perfect one
        const p = ovenAt(0), e = fxEl(L, 'cm-emoji', food[0]);
        e.style.fontSize = '90px';
        MB.audio.sfx('ding'); mood(S, a, 'win');
        gsap.fromTo(e, { x: p.x, y: p.y, xPercent: -50, yPercent: -100, scale: 0 }, { y: p.y - 60, scale: 1, duration: 0.5, ease: 'back.out(2)' });
        spray(L, p.x, p.y - 60, ca, 16, { dist: [40, 160], stars: 0.8 });
      }, null, done)
        .call(() => { // the other one
          const p = ovenAt(1), e = fxEl(L, 'cm-emoji', food[1]);
          e.style.fontSize = '150px';
          MB.audio.sfx('boom'); shake(S.ov, 18); mood(S, b, 'lose');
          spray(L, p.x, p.y, '#444', 30, { dist: [60, 300], stars: 0, gravity: -80 });
          column(L, 'cm-fire', { x: p.x, bottom: p.y + 40 }, '#ff7a1c', 0.5);
          gsap.fromTo(e, { x: p.x, y: p.y, xPercent: -50, yPercent: -100, scale: 0, rotation: -40 }, { y: p.y - 80, scale: 1, rotation: 0, duration: 0.7, delay: 0.4, ease: 'elastic.out(1,0.5)' });
        }, null, done + 0.9)
        .to(timer, { opacity: 0, scale: 0, duration: 0.3 }, done + 0.9)
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier);
          [0, 1].forEach((i) => {
            const o = ovenAt(i), card = fxEl(L, 'cm-scorecard', scores[i], i ? cb : ca);
            gsap.fromTo(card, { x: o.x, y: o.y - 300, xPercent: -50, yPercent: -50, rotationY: 180, scale: 0 }, { rotationY: 0, scale: 1, duration: 0.5, delay: i * 0.4, ease: 'back.out(2)' });
          });
          word(L, p.x, p.y - 330, cfg.word || 'BAKE-OFF!', c, 52);
          mood(S, b, 'play');
        }, null, done + 2);
      return { tl, idle: () => [
        gsap.to(ovens, { y: -4, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 }),
        gsap.to([a, b], { y: -8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.5 }),
        every(0.7, () => { const p = ovenAt(Math.random() < 0.5 ? 0 : 1); floatUp(S, [...food, '✨'], { x: p.x, y: p.y - 100 }, 1, [18, 28]); }),
      ] };
    },

    // a rescue: the water rises, the swimmer (cfg.swimmer 0/1, default 1) flails, the lifeguard blows the whistle and
    // throws a lifebuoy, reels them in... then smiles with far too many teeth. The swimmer faints
    rescue: (S) => {
      const { a, b, L, c, cfg } = S, swim = cfg.swimmer === 0 ? a : b, guard = swim === a ? b : a, dir = swim === b ? 1 : -1;
      const water = prop(S, 'cm-waves', '', 3), buoy = fxEl(L, 'cm-emoji', '🛟');
      buoy.style.fontSize = '72px';
      gsap.set(buoy, { opacity: 0, xPercent: -50, yPercent: -50 });
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .fromTo(water, { xPercent: -50, height: 0 }, { height: 320, duration: 1, ease: 'sine.inOut' }, 0.5)
        .call(() => { MB.audio.sfx('splash'); mood(S, swim, 'lose'); }, null, 0.6)
        .to(swim, { y: 220, x: dir * 40, duration: 0.8, ease: 'power2.in' }, 0.7)
        .to(swim, { y: 170, rotation: 8, duration: 0.25, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 1.5) // flailing
        .add(times(4, 0.5, () => { const h = liveHead(swim); word(L, h.x + rnd(-60, 60), h.y + 20, MB.pick(['HELP!', '*blub*', '¡AYUDA!']), '#9fe6ff', 30); fling(L, h.x, h.y + 60, ['💦', '🫧'], 3, { dist: [30, 100], gravity: -40 }); MB.audio.sfx('bubble'); }), 1.4);
      talk(S, tl, 1.3);
      const toss = Math.max(3, afterTalk(S, 1.3) - 1.2);
      tl.call(() => { const h = headOf(S, guard); MB.audio.sfx('whistle'); word(L, h.x, h.y - 10, '🚨 TWEET!', c, 40); mood(S, guard, 'attack'); }, null, toss)
        .call(() => {
          const h0 = headOf(S, guard), h1 = liveHead(swim), p0 = { x: h0.x, y: h0.y + 150 }, p1 = { x: h1.x, y: h1.y + 90 };
          MB.audio.sfx('whoosh');
          gsap.fromTo(buoy, { x: p0.x, y: p0.y, opacity: 1 }, { keyframes: [{ x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - 220, duration: 0.35, ease: 'power1.out' }, { x: p1.x, y: p1.y, duration: 0.35, ease: 'power1.in' }],
            rotation: 540, onComplete: () => { MB.audio.sfx('splash'); spray(L, p1.x, p1.y, '#9fe6ff', 20, { dist: [40, 160], stars: 0.2 }); } });
        }, null, toss + 0.6)
        .to(swim, { y: 0, x: dir * -30, rotation: 0, duration: 0.9, ease: 'power2.out' }, toss + 1.5) // reeled in
        .to({}, { duration: 0.9, onUpdate: () => { const h = liveHead(swim); gsap.set(buoy, { x: h.x, y: h.y + h.h * 0.4 }); } }, toss + 1.5)
        .to(water, { height: 0, duration: 0.9, ease: 'sine.in' }, toss + 1.6)
        .call(() => {
          const h = headOf(S, guard);
          gsap.to(buoy, { opacity: 0, duration: 0.3 });
          MB.audio.sfx('chomp'); mood(S, guard, 'win');
          word(L, h.x, h.y + 40, cfg.grin || '😁🦈', '#ffffff', 60);
        }, null, toss + 2.6)
        .call(() => { const h = headOf(S, swim); MB.audio.sfx('whistleDown'); word(L, h.x, h.y + 20, 'x_x', '#ffffff', 44); mood(S, swim, 'lose'); }, null, toss + 3.1)
        .to(swim, { rotation: dir * 14, y: 40, duration: 0.5, ease: 'power2.in' }, toss + 3.1) // faints
        .call(() => {
          const p = midOf(S);
          MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'SAVED!', c, 56);
          spray(L, p.x, p.y, c, 24, { dist: [60, 260], stars: 0.6 });
        }, null, toss + 3.5);
      return { tl, idle: () => [
        gsap.to(swim, { rotation: `+=${dir * 3}`, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(guard, { y: -8, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.8, () => { const h = headOf(S, swim); floatUp(S, ['💫', '💦', '🫧'], { x: h.x, y: h.y + 60 }, 1, [16, 26]); }),
      ] };
    },

    // nap time: a hammock between them, they sink in and doze, an alarm clock rings and rings, a thrown shoe (cfg.throw) sends it flying,
    // back to sleep
    nap: (S) => {
      const { a, b, L, c, cfg } = S, hammock = prop(S, 'cm-hammock', '', 2), clock = fxEl(L, 'cm-emoji', '⏰'), pillow = fxEl(L, 'cm-emoji', cfg.throw || '👟');
      clock.style.fontSize = '70px'; pillow.style.fontSize = '60px';
      gsap.set([clock, pillow], { opacity: 0, xPercent: -50, yPercent: -50 });
      const zzz = (im) => { const h = liveHead(im); word(L, h.x + (im === a ? 60 : -60), h.y + 20, MB.pick(['z', 'Z', 'zZ', '💤']), c, rnd(28, 44)); };
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.8, stagger: 0.2, ease: 'sine.out' }, 0)
        .fromTo(hammock, { xPercent: -50, scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 0.4)
        .to(a, { y: 70, x: 30, rotation: 14, duration: 0.6, ease: 'power2.in' }, 0.9).to(b, { y: 70, x: -30, rotation: -14, duration: 0.6, ease: 'power2.in' }, 1)
        .call(() => { MB.audio.sfx('wobble'); mood(S, a, 'lose'); mood(S, b, 'lose'); }, null, 1.2)
        .add(times(4, 0.5, () => { zzz(a); zzz(b); }), 1.6);
      const alarm = 3.2;
      tl.call(() => { const p = midOf(S); gsap.fromTo(clock, { x: p.x, y: p.y - 180, opacity: 1, scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }); }, null, alarm)
        .to(clock, { rotation: 18, duration: 0.05, yoyo: true, repeat: 21 }, alarm + 0.2)
        .add(gsap.timeline({ repeat: 5 }).call(() => MB.audio.sfx('ding')).to({}, { duration: 0.18 }), alarm + 0.2);
      talk(S, tl, alarm + 0.3, 1.1);
      const whack = Math.max(alarm + 1.6, afterTalk(S, alarm + 0.3, 1.1) - 0.8);
      tl.call(() => {
        const h = headOf(S, a), p = { x: gsap.getProperty(clock, 'x'), y: gsap.getProperty(clock, 'y') };
        MB.audio.sfx('whoosh');
        gsap.fromTo(pillow, { x: h.x + 60, y: h.y + 200, opacity: 1, rotation: 0 }, { x: p.x, y: p.y, rotation: 360, duration: 0.3, ease: 'power2.in',
          onComplete: () => {
            MB.audio.sfx('bonk'); spray(L, p.x, p.y, '#ffffff', 16, { dist: [30, 140], stars: 0.2 });
            gsap.to(clock, { x: p.x + 600, y: p.y - 300, rotation: 720, duration: 0.8, ease: 'power2.out' });
            gsap.to(pillow, { y: p.y + 400, rotation: 540, opacity: 0, duration: 0.8, ease: 'power2.in' });
            fling(L, p.x, p.y, ['💥', '⭐'], 6, { dist: [40, 160], gravity: 60 });
          } });
      }, null, whack)
        .call(() => { const p = midOf(S); MB.audio.sfx('bond', S.tier); word(L, p.x, p.y - 160, cfg.word || '...5 more minutes.', c, 46); }, null, whack + 0.7)
        .to([a, b], { y: 80, duration: 0.4 }, whack + 0.7);
      return { tl, idle: () => [
        gsap.to([a, b, hammock], { x: '+=16', duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }), // swaying
        every(0.7, () => zzz(Math.random() < 0.5 ? a : b)),
        gsap.to([a, b], { scaleY: 0.97, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.7 }), // breathing
      ] };
    },

    // poker night: a felt table, cards dealt, chips; the gambler (cfg.gambler 0/1, default 1) goes all in and wins big,
    // and while they celebrate the other swipes the whole pot
    poker: (S) => {
      const { a, b, L, c, cfg } = S, gam = cfg.gambler === 0 ? a : b, thief = gam === a ? b : a, [ca, cb] = cfg.colors || [c, '#ffffff'], cg = gam === a ? ca : cb, ct = gam === a ? cb : ca;
      const table = prop(S, 'cm-table cm-felt', '', 2), hand = cfg.hand || ['A♠', 'A♥', 'A♦', 'A♣', 'K♠'];
      const tableAt = () => { const r = table.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top + 30); };
      const chips = [];
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' }, 0)
        .fromTo(table, { xPercent: -50, y: 220, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.3);
      for (let i = 0; i < 6; i++) tl.call(() => { // dealing
        const t = tableAt(), im = i % 2 ? b : a, h = headOf(S, im), card = fxEl(L, 'cm-cardlet', '');
        gsap.fromTo(card, { x: t.x, y: t.y, xPercent: -50, yPercent: -50, rotation: 0 }, { x: h.x + rnd(-30, 30), y: t.y - 10, rotation: rnd(-20, 20) + 720, duration: 0.3, ease: 'power2.out', onComplete: () => gsap.to(card, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => card.remove() }) });
        MB.audio.sfx('deal');
      }, null, 0.9 + i * 0.15);
      talk(S, tl, 1.3);
      const allin = 2.2;
      tl.call(() => { const h = headOf(S, gam); word(L, h.x, h.y + 20, cfg.allin || 'ALL IN!!', cg, 46); mood(S, gam, 'attack'); }, null, allin);
      for (let i = 0; i < 10; i++) tl.call(() => {
        const h = headOf(S, gam), t = tableAt(), ch = fxEl(L, 'cm-emoji', '🪙');
        ch.style.fontSize = '40px';
        gsap.fromTo(ch, { x: h.x, y: t.y - 20, xPercent: -50, yPercent: -50 }, { x: t.x + rnd(-50, 50), y: t.y - 10 - i * 7, duration: 0.25, ease: 'power2.out' });
        chips.push(ch);
        MB.audio.sfx('coin');
      }, null, allin + 0.2 + i * 0.08);
      const reveal = Math.max(allin + 1.5, afterTalk(S, 1.3) - 1.2);
      tl.call(() => {
        const t = tableAt();
        MB.audio.sfx('cardflip'); MB.audio.sfx('fanfare');
        hand.forEach((f, i) => { const k = fxEl(L, 'cm-cardlet up', f); gsap.fromTo(k, { x: t.x + (i - 2) * 64, y: t.y - 260, xPercent: -50, yPercent: -50, rotationY: 180, opacity: 0 }, { rotationY: 0, opacity: 1, duration: 0.3, delay: i * 0.08, onComplete: () => gsap.to(k, { opacity: 0, delay: 1.4, duration: 0.3, onComplete: () => k.remove() }) }); });
        const h = headOf(S, gam);
        word(L, h.x, h.y - 10, cfg.brag || 'READ EM AND WEEP!', cg, 38);
        mood(S, gam, 'win');
      }, null, reveal)
        .to(gam, { y: -60, rotation: 0, duration: 0.25, yoyo: true, repeat: 3, ease: 'power2.out' }, reveal + 0.2) // celebrating, eyes shut
        .to(thief, { opacity: 0.35, duration: 0.3 }, reveal + 0.3)
        .call(() => { const h = headOf(S, thief); chips.forEach((ch, i) => gsap.to(ch, { x: h.x, y: h.y + 260, scale: 0.5, opacity: 0, duration: 0.3, delay: i * 0.05, onStart: () => MB.audio.sfx('coin'), onComplete: () => ch.remove() })); mood(S, thief, 'taunt'); }, null, reveal + 0.5)
        .to(thief, { opacity: SPRITE_OP, duration: 0.3 }, reveal + 1.4)
        .call(() => { const h = headOf(S, gam); MB.audio.sfx('whistleDown'); word(L, h.x, h.y + 40, cfg.huh || '...where is it?', '#ffffff', 36); mood(S, gam, 'lose'); }, null, reveal + 1.7)
        .call(() => {
          const h = headOf(S, thief), p = midOf(S);
          MB.audio.sfx('loot'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'MINE~!', ct, 56);
          fling(L, h.x, h.y + 120, ['🪙', '💰', '💎', '🃏'], 14, { gravity: -30 });
          mood(S, thief, 'win');
        }, null, reveal + 2.3);
      return { tl, idle: () => [
        gsap.to(thief, { rotation: 4, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.timeline({ repeat: -1, repeatDelay: 1.5 }).to(gam, { x: -12, duration: 0.3, yoyo: true, repeat: 3 }), // looking around
        every(0.8, () => { const h = headOf(S, thief); floatUp(S, ['🪙', '💰', '🃏'], { x: h.x, y: h.y + 120 }, 1, [18, 28]); }),
      ] };
    },

    // an auction: a painting (cfg.result) on show, the paddles go up in turn with bigger and bigger bids (cfg.bids),
    // the gavel falls, the winner (cfg.winner 0/1, default 0) gets it and the loser fumes
    auction: (S) => {
      const { a, b, L, c, cfg } = S, [ca, cb] = cfg.colors || [c, '#ffffff'], art = prop(S, 'cm-frame cm-art', cfg.result || '🖼️', 3), bids = cfg.bids || ['$1M', '$5M', '$20M', '$100M', '$1B!!'];
      const win = cfg.winner === 1 ? b : a, lose = win === a ? b : a;
      gsap.set(art, { xPercent: -50 });
      const artAt = () => { const r = art.getBoundingClientRect(); return toUi(r.left + r.width / 2, r.top + r.height / 2); };
      const tl = gsap.timeline()
        .fromTo([a, b], { x: (i) => (i ? 300 : -300), opacity: 0 }, { x: (i) => (i ? 50 : -50), opacity: SPRITE_OP, duration: 0.7, ease: 'power2.out' }, 0)
        .fromTo(art, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0.5)
        .call(() => { const p = artAt(); MB.audio.sfx('sparkle'); spray(L, p.x, p.y, '#ffd24a', 16, { dist: [60, 200], stars: 1 }); }, null, 0.6);
      bids.forEach((bid, i) => tl.call(() => {
        const im = i % 2 ? b : a, h = headOf(S, im), paddle = fxEl(L, 'cm-paddle', bid, i % 2 ? cb : ca);
        gsap.fromTo(paddle, { x: h.x + (i % 2 ? -90 : 90), y: h.y + 160, xPercent: -50, yPercent: -50, scale: 0, rotation: i % 2 ? 20 : -20 },
          { y: h.y - 40, scale: 1 + i * 0.12, rotation: 0, duration: 0.3, ease: 'back.out(2)', onComplete: () => gsap.to(paddle, { opacity: 0, y: '-=40', delay: 0.7, duration: 0.3, onComplete: () => paddle.remove() }) });
        MB.audio.sfx('coin', { rate: 1 + i * 0.1 });
        gsap.fromTo(im, { y: -16 }, { y: 0, duration: 0.3 });
        mood(S, im, 'attack'); mood(S, i % 2 ? a : b, 'lose');
      }, null, 1.1 + i * 0.7));
      talk(S, tl, 1.2);
      const sold = Math.max(1.1 + bids.length * 0.7 + 0.2, afterTalk(S, 1.2) - 0.8);
      tl.call(() => {
        const p = artAt(), g = fxEl(L, 'cm-emoji', '🔨');
        g.style.fontSize = '80px';
        gsap.fromTo(g, { x: p.x + 120, y: p.y - 60, xPercent: -50, yPercent: -50, rotation: -60 }, { rotation: 20, duration: 0.2, ease: 'power3.in', yoyo: true, repeat: 1, onComplete: () => g.remove() });
        gsap.delayedCall(0.2, () => { MB.audio.sfx('thud'); MB.audio.sfx('gong'); shake(S.ov, 10); word(L, p.x, p.y - 120, cfg.gavel || 'SOLD!', '#ffffff', 60); });
      }, null, sold)
        .call(() => {
          const h = headOf(S, win);
          MB.audio.sfx('applause'); MB.audio.sfx('bond', S.tier);
          gsap.to(art, { x: boxX(S, win) - S.box.offsetWidth / 2, y: 60, scale: 0.7, rotation: win === a ? -8 : 8, duration: 0.6, ease: 'power2.inOut' });
          word(L, h.x, h.y - 20, cfg.word || 'Mine, darling~', win === a ? ca : cb, 44);
          mood(S, win, 'win'); mood(S, lose, 'taunt');
        }, null, sold + 0.9)
        .call(() => { const h = headOf(S, lose); word(L, h.x, h.y + 30, '💢', '#ff3b3b', 60); MB.audio.sfx('stomp'); }, null, sold + 1.5)
        .to(lose, { rotation: lose === a ? 6 : -6, scaleY: 0.95, duration: 0.3 }, sold + 1.5);
      return { tl, idle: () => [
        gsap.to(art, { y: 50, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to(win, { rotation: win === a ? -3 : 3, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        every(0.9, () => { const h = headOf(S, win); floatUp(S, ['💸', '💎', '✨'], { x: h.x, y: h.y + 100 }, 1, [18, 28]); }),
        every(1.4, () => { const h = headOf(S, lose); word(L, h.x, h.y + 40, '💢', '#ff3b3b', 36); }),
      ] };
    },

    // a spooky reading: a candle, a book each (cfg.food), pages turning; a ghost (cfg.emoji[0]) creeps up behind
    // them... BOO! They scream, the candle goes out, and then they both burst out laughing
    reading: (S) => {
      const { a, b, L, c, cfg } = S, candle = prop(S, 'cm-candle lit', '🕯️<i></i>', 3), ghost = fxEl(L, 'cm-emoji', (cfg.emoji || ['👻'])[0]);
      const books = (cfg.food || ['📕', '📖']).map((f) => { const k = fxEl(L, 'cm-emoji', f); k.style.fontSize = '56px'; gsap.set(k, { opacity: 0, xPercent: -50, yPercent: -50 }); return k; });
      ghost.style.fontSize = '90px';
      gsap.set(ghost, { opacity: 0, xPercent: -50, yPercent: -50 });
      gsap.set(candle, { xPercent: -50 });
      const stick = () => [a, b].forEach((im, i) => { const h = liveHead(im); gsap.set(books[i], { x: h.x + (i ? -40 : 40), y: h.y + h.h * 0.36 }); });
      const tl = gsap.timeline()
        .fromTo([a, b], { y: 200, opacity: 0 }, { y: 0, opacity: SPRITE_OP, duration: 0.7, stagger: 0.15, ease: 'sine.out' }, 0)
        .to([a, b], { x: (i) => (i ? -20 : 20), y: 20, duration: 0.4 }, 0.6) // huddle up
        .fromTo(candle, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' }, 0.6)
        .call(() => { MB.audio.sfx('fire'); gsap.set(books, { opacity: 1 }); stick(); MB.audio.sfx('crinkle'); }, null, 0.9)
        .add(times(4, 0.7, () => { MB.audio.sfx('crinkle'); books.forEach((k) => gsap.fromTo(k, { scaleX: 1 }, { scaleX: -1, duration: 0.2, yoyo: true, repeat: 1 })); }), 1.2);
      talk(S, tl, 1.2);
      const boo = Math.max(3.8, afterTalk(S, 1.2));
      tl.to({}, { duration: boo - 0.9, onUpdate: stick }, 0.9);
      tl.call(() => { const p = midOf(S); gsap.fromTo(ghost, { x: p.x, y: p.y + 60, opacity: 0, scale: 0.6 }, { y: p.y - 120, opacity: 0.6, duration: 1.2, ease: 'sine.inOut' }); MB.audio.sfx('whistleUp'); }, null, boo - 1.3)
        .call(() => {
          const p = midOf(S);
          gsap.to(ghost, { opacity: 1, scale: 2.4, y: p.y - 60, duration: 0.2, ease: 'back.out(2)' });
          MB.audio.sfx('squeak'); MB.audio.sfx('boom'); shake(S.ov, 16);
          word(L, p.x, p.y - 220, cfg.boo || 'BOO!', '#ffffff', 72);
          candle.classList.remove('lit');
          books.forEach((k, i) => gsap.to(k, { y: '-=260', x: `+=${i ? 120 : -120}`, rotation: i ? 400 : -400, duration: 0.6, ease: 'power2.out' }));
          mood(S, a, 'lose'); mood(S, b, 'lose');
        }, null, boo)
        .to([a, b], { y: -80, duration: 0.2, ease: 'power2.out' }, boo).to([a, b], { y: 20, duration: 0.3, ease: 'bounce.out' }, boo + 0.2)
        .to(ghost, { opacity: 0, x: '+=400', y: '-=200', duration: 0.6, ease: 'power2.in' }, boo + 0.8)
        .call(() => {
          const p = midOf(S);
          candle.classList.add('lit');
          MB.audio.sfx('laugh'); MB.audio.sfx('bond', S.tier);
          word(L, p.x, p.y - 180, cfg.word || 'AGAIN! AGAIN!', c, 52);
          fling(L, p.x, p.y, ['😂', '👻', '📖', '🕯️'], 12, { gravity: -30 });
          mood(S, a, 'win'); mood(S, b, 'win');
          books.forEach((k) => k.remove());
        }, null, boo + 1.3)
        .to([a, b], { scaleY: 0.95, duration: 0.15, yoyo: true, repeat: 5 }, boo + 1.3);
      return { tl, idle: () => [
        gsap.to(candle, { scale: 1.06, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
        gsap.to([a, b], { y: 14, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 }),
        every(1.1, () => floatUp(S, ['👻', '📖', '✨'], midOf(S), 1, [18, 28])),
      ] };
    },
  };
  // draw SVG strokes in (DrawSVG when it's loaded, a dash offset without it)
  function drawIn(els, vars) {
    els = [...els];
    if (window.DrawSVGPlugin) return gsap.fromTo(els, { drawSVG: '0%' }, { drawSVG: '100%', ...vars });
    els.forEach((e) => { const l = e.getTotalLength(); e.style.strokeDasharray = l; e.style.strokeDashoffset = l; });
    return gsap.to(els, { strokeDashoffset: 0, ...vars });
  }

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
    const variant = cfg.scene && (SCENE_VARIANTS[cfg.kind] || []).includes(cfg.scene) && VARIANTS[cfg.scene];
    const { tl, idle } = (variant || SCENES[cfg.kind] || SCENES.friends)(S);
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
      ${def.type === 'unit' && !def.emoji && !def.fused ? `<img class="cm-sprite" src="${MB.bigSpriteUrl(def.id, locked ? 'idle' : 'taunt', def.combo && def.combo.costume)}">` : ''}
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
      if (art) art.src = MB.bigSpriteUrl(def.id, 'idle', def.combo && def.combo.costume);
      if (sprite) {
        sprite.src = MB.bigSpriteUrl(def.id, 'taunt', def.combo && def.combo.costume);
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
    else if (locked) {
      const have = MB.UI.shardsOf(def.id), need = MB.Collection.need(def.id);
      own = `<div class="cm-own lockedtxt">🔒 Not in your collection yet: <b>🧩 ${have}/${need}</b> fragments.
        <div class="cm-shardbar"><i style="width:${(have / need) * 100}%"></i></div>
        Find the rest in 🎁 card packs (won in battle)${MB.STORY.some((s) => s.foe === def.id) ? ', or beat them in Story to get the whole card' : ''}.</div>`;
    }
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
      ${combosHtml(def)}
      ${!locked && !def.fused && !def.combo ? wardrobeHtml(def) : ''}
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
  // item combos this character or item is part of
  function combosHtml(def) {
    if (def.fused) return '';
    const rows = (def.combo ? [def.combo] : MB.combosOf(def.id)).map((c) => {
      const with_ = def.type === 'spell' ? MB.charById(c.char).name : c.items.map((id) => defOf(id).name).join(' or ');
      return `<div class="cm-combo">🔗 <b>${c.name}</b>${def.combo ? '' : ` with ${with_}`}: ${c.text}</div>`;
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
  // items: card ids (a whole card), { avatar }, or { card, from, to, need, done }: fragments from a pack.
  // Each one is dealt face down and flipped with a click; once shown it leans toward the pointer and can be grabbed
  // and thrown away.
  let revealing = false, revealKey = null; // revealKey: what Space / Enter does at this point of a reveal
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const STINGER = ['sparkle', 'sparkle', 'loot', 'gem', 'fanfare']; // the flip's sound, by reveal level
  // leans a node toward the pointer: returns (dx, dy) => void, both -1..1
  function tilter(node, deg, persp) {
    if (persp) gsap.set(node, { transformPerspective: persp });
    const qx = gsap.quickTo(node, 'rotationY', { duration: 0.5, ease: 'power3.out' }), qy = gsap.quickTo(node, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    return (dx, dy) => { qx(dx * deg); qy(-dy * deg * 0.8); };
  }
  function revealLayer() {
    const ov = el('div', 'rv', `<div class="rv-bg"></div><div class="rv-rays"></div><div class="rv-fx"></div>
      <div class="rv-title"></div><div class="rv-sub"></div><div class="rv-hint">Click to continue</div><div class="rv-flash"></div>`);
    root().appendChild(ov);
    gsap.fromTo(ov.querySelector('.rv-bg'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    // a trail of sparks behind the pointer, in the colour of whatever is on show
    const layer = ov.querySelector('.rv-fx');
    let last = 0;
    ov.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 40) return;
      last = now;
      const q = toUi(e.clientX, e.clientY), p = fxEl(layer, 'fx-pt', null, ov.style.getPropertyValue('--rc') || '#fff');
      p.style.width = p.style.height = rnd(4, 9) + 'px';
      gsap.fromTo(p, { x: q.x, y: q.y, xPercent: -50, yPercent: -50, opacity: 0.9 },
        { x: q.x + rnd(-24, 24), y: q.y + rnd(10, 50), scale: 0, opacity: 0, duration: rnd(0.5, 0.9), ease: 'power1.out', onComplete: () => p.remove() });
    });
    return ov;
  }
  // haulOf: { tier, more } when the items came out of a pack: they're laid out together at the end.
  // Resolves true when the player asks to open another pack.
  async function reveal(items, ov, haulOf) {
    if (!items.length && !ov) return false;
    revealing = true;
    ov = ov || revealLayer();
    const skip = items.length > 1 ? skipButton(ov) : null;
    for (let i = 0; i < items.length && !ov.skipAll; i++) await revealOne(ov, items[i], i, items.length);
    if (skip) skip.remove();
    const again = haulOf && items.length ? await haul(ov, items, haulOf) : false;
    revealKey = null;
    await gsap.to(ov, { opacity: 0, duration: 0.35 });
    ov.remove();
    revealing = false;
    return again;
  }
  // jumps past the remaining items (to the haul, if there is one)
  function skipButton(ov) {
    const b = el('button', 'btn rv-skip', 'Skip ⏭');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.onclick = () => { MB.audio.sfx('click'); ov.skipAll = true; b.remove(); if (ov.skipCur) ov.skipCur(); };
    ov.appendChild(b);
    return b;
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
    const def = it.card && defOf(it.card), r = def ? rarityOf(def) : null, shard = it.need != null;
    // a few fragments get a shorter build-up than a card coming together
    const col = r ? r.color : AVATAR_COLOR, lvl = r ? Math.max(1, shard && !it.done ? Math.min(2, r.stars) : r.stars) : 2;
    const layer = ov.querySelector('.rv-fx'), rays = ov.querySelector('.rv-rays'), flash = ov.querySelector('.rv-flash');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub'), hint = ov.querySelector('.rv-hint');
    ov.style.setProperty('--rc', col);
    const glow = el('div', 'rv-glow');
    const back = el('div', 'rv-back', '<div class="rv-back-emblem">✦</div>');
    const card = def ? bigCard(it.card).c : avatarCard(it.avatar, W * S, H * S);
    if (def) card.style.zoom = S;
    if (shard) MB.UI.lockCard(card, it.from);
    // rainbow foil that follows the pointer, on rare+ cards that are whole (not still in pieces)
    const holo = lvl >= 2 && (!shard || it.done) ? card.appendChild(el('div', 'rv-holo')) : null;
    const front = el('div', 'rv-front');
    Object.assign(front.style, { width: W * S + 'px', height: H * S + 'px' });
    front.appendChild(card);
    ov.insertBefore(glow, layer); ov.insertBefore(back, layer); ov.insertBefore(front, layer);
    gsap.set([glow, back, front], { x: X, y: Y, xPercent: -50, yPercent: -50 });
    gsap.set(front, { rotationY: -90, opacity: 0, transformPerspective: 1200 });
    gsap.set(glow, { opacity: 0 });
    const got = shard ? it.to - it.from : 0;
    title.textContent = shard ? `+${got} FRAGMENT${got > 1 ? 'S' : ''}` : def ? r.name.toUpperCase() + '!' : 'NEW PICTURE!';
    title.style.color = col;
    const count = n > 1 ? ` <small>(${i + 1}/${n})</small>` : '';
    const shardLine = (k) => `<b>${def.name}</b> · 🧩 ${k}/${it.need}${count}`;
    sub.innerHTML = shard ? shardLine(it.from) : def ? `<b>${def.name}</b> joined your collection${count}`
      : `<b>${MB.UI.avatarById(it.avatar).name}</b> is now a profile picture${count}`;
    hint.textContent = 'Click the card to flip it';
    gsap.set([title, sub, hint], { opacity: 0 });

    return new Promise((res) => {
      // deal → wait (for the click) → flip → shown → gone
      let phase = 'deal', flipTl = null, stopRiser = null, stopMotes = null, beat = null, grab = null, float = null, lastGlint = 0;
      const idle = [], waiting = [];
      const tiltBack = tilter(back, 16), tiltCard = tilter(card, 20);

      // 1. dealt in face down; the glow around it hints at what's coming
      const tl = gsap.timeline({ onComplete: wait });
      tl.call(() => MB.audio.sfx('deal'))
        .fromTo(back, { y: -300, rotation: -35, scale: 0.4 }, { y: Y, rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' })
        .call(() => { MB.audio.sfx('thud'); spray(layer, X, Y + 200, '#ffffff', 16, { dist: [40, 200], size: [3, 8], gravity: -20, stars: 0 }); })
        .fromTo(glow, { opacity: 0, scale: 0.8 }, { opacity: 0.2 + lvl * 0.1, scale: 0.9 + lvl * 0.05, duration: 0.4 })
        .to(hint, { opacity: 0.75, duration: 0.3 }, '<');

      // 2. waits for its click; rarer cards throb with a heartbeat
      function wait() {
        if (phase !== 'deal') return;
        phase = 'wait';
        waiting.push(gsap.to(glow, { scale: '+=0.12', opacity: '+=0.15', duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        if (lvl < 3) return;
        waiting.push(gsap.fromTo(back, { x: X - 1.5 }, { x: X + 1.5, duration: 0.06, yoyo: true, repeat: -1, ease: 'none' }));
        const thump = () => {
          MB.audio.sfx('heartbeat');
          gsap.fromTo(back, { scale: 1.07 }, { scale: 1, duration: 0.4, ease: 'power2.out' });
          beat = gsap.delayedCall(lvl >= 4 ? 0.85 : 1.25, thump);
        };
        beat = gsap.delayedCall(0.3, thump);
      }
      const stopWaiting = () => { waiting.forEach((t) => t.kill()); if (beat) beat.kill(); beat = null; };

      // 3. charge-up (longer and wilder for rarer cards, with a riser that lands on the flip), flip + explosion
      function flip() {
        tl.progress(1);
        phase = 'flip';
        stopWaiting();
        gsap.killTweensOf(back, 'rotationX,rotationY,scale');
        const charge = 0.35 + lvl * 0.3;
        if (lvl >= 3) stopRiser = MB.audio.sfx('riser', { end: charge + 0.05 });
        flipTl = gsap.timeline();
        flipTl.set(back, { rotationX: 0, rotationY: 0, scale: 1 })
          .to(hint, { opacity: 0, duration: 0.15 }, 0)
          .addLabel('charge', 0)
          .to(glow, { opacity: 1, scale: 1 + lvl * 0.2, duration: charge, ease: 'power1.in' }, 'charge')
          .fromTo(back, { x: X - 3 * lvl }, { x: X + 3 * lvl, duration: 0.05, repeat: Math.round(charge / 0.05), yoyo: true, ease: 'none' }, 'charge')
          .call(() => converge(layer, X, Y, col, 18 * lvl, charge), null, 'charge');
        if (lvl < 3) for (let k = 0; k < lvl; k++) flipTl.call(() => MB.audio.sfx('sparkle'), null, `charge+=${(charge / lvl) * k}`);
        flipTl.set(back, { x: X }, 'charge+=' + charge)
          .to(back, { rotationY: 90, scale: 1.1, duration: 0.14, ease: 'power2.in' })
          .set(back, { opacity: 0 })
          .to(glow, { opacity: 0.55, scale: 1.3, duration: 0.5 }, '<')
          .call(() => {
            MB.audio.sfx('cardflip');
            MB.audio.sfx(STINGER[shard ? Math.min(3, lvl) : lvl]); // a card that completes gets its fanfare when it does
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
          .fromTo(sub, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, '<0.3');
        if (shard) shardsIn(flipTl, it, { card, layer, X, Y, S, col, title, sub, flash, ov, shardLine, def, count });
        flipTl.call(shown);
      }

      // 4. on show: it floats, leans toward the pointer, and glints when the pointer sweeps across it
      function shown() {
        if (phase !== 'flip') return;
        phase = 'shown';
        idle.push(gsap.to(rays, { rotation: '+=360', duration: 30 - lvl * 4, repeat: -1, ease: 'none' }));
        idle.push(float = gsap.to(front, { y: Y - 12, rotationY: 8, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        stopMotes = motes(layer, { x0: X - 240, x1: X + 240, y0: Y + 100, y1: Y + 240 }, col, 0.6 / lvl);
        front.classList.add('live');
        hint.textContent = 'Click to continue · or grab the card and throw it';
        gsap.to(hint, { opacity: 0.75, duration: 0.4, delay: 0.2 });
      }

      // 5. off it goes: toward the collection, or wherever it was thrown (v: the throw, in ui px)
      function dismiss(v) {
        phase = 'gone';
        revealKey = null; ov.skipCur = null;
        if (stopMotes) stopMotes();
        idle.forEach((t) => t.kill());
        MB.audio.sfx('swipe');
        const out = gsap.timeline({ onComplete: finish })
          .to([title, sub, hint], { opacity: 0, duration: 0.2 }, 0)
          .to([rays, glow], { opacity: 0, duration: 0.3 }, 0);
        if (v) {
          const d = Math.hypot(v.x, v.y) || 1, fx = gsap.getProperty(front, 'x'), fy = gsap.getProperty(front, 'y');
          out.to(front, { x: fx + (v.x / d) * 1400, y: fy + (v.y / d) * 1400, rotation: v.x > 0 ? 50 : -50, duration: 0.5, ease: 'power2.in' }, 0);
        } else out.to(front, { x: 1480, y: 60, scale: 0.25, rotation: 25, opacity: 0, duration: 0.55, ease: 'power3.in' }, 0);
      }
      function finish() {
        ov.removeEventListener('pointerdown', onDown);
        ov.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        ov.skipCur = null; revealKey = null;
        glow.remove(); back.remove(); front.remove();
        res();
      }
      // the Skip button: drop everything and move on
      ov.skipCur = () => {
        tl.kill(); if (flipTl) flipTl.kill();
        stopWaiting(); if (stopRiser) stopRiser(); if (stopMotes) stopMotes();
        idle.forEach((t) => t.kill());
        layer.querySelectorAll('.rv-frag').forEach((f) => f.remove());
        gsap.to([title, sub, hint, rays, glow], { opacity: 0, duration: 0.2 });
        finish();
      };

      // a click (or Space) moves one step on; once shown, a press grabs the card
      function advance(e) {
        if (phase === 'deal' || phase === 'wait') flip();
        else if (phase === 'flip') { flipTl.progress(1); if (stopRiser) stopRiser(); } // skips the flip animation
        else if (phase === 'shown') {
          if (!e) { dismiss(); return; }
          const q = toUi(e.clientX, e.clientY);
          grab = { x0: q.x, y0: q.y, fx: gsap.getProperty(front, 'x'), fy: gsap.getProperty(front, 'y'), last: q, t: performance.now(), vx: 0, vy: 0 };
          float.kill();
          tiltCard(0, 0);
          gsap.to([sub, hint], { opacity: 0.2, duration: 0.2 }); // out of the way of the card
          window.addEventListener('pointerup', onUp);
        }
      }
      function onDown(e) { if (e.button === 0 && !grab) advance(e); }
      function onUp() {
        window.removeEventListener('pointerup', onUp);
        const g = grab;
        grab = null;
        if (!g || phase !== 'shown') return;
        // a short drag is a click; a longer one throws the card that way (a quick flick throws it further)
        const dx = g.last.x - g.x0, dy = g.last.y - g.y0;
        dismiss(Math.hypot(dx, dy) > 50 ? { x: dx + g.vx * 200, y: dy + g.vy * 200 } : null);
      }
      function onMove(e) {
        const q = toUi(e.clientX, e.clientY);
        const dx = clamp((q.x - X) / 380, -1, 1), dy = clamp((q.y - Y) / 380, -1, 1);
        if (phase === 'deal' || phase === 'wait') { tiltBack(dx, dy); return; }
        if (phase !== 'shown') return;
        if (grab) {
          const now = performance.now(), dt = Math.max(1, now - grab.t);
          grab.vx = (q.x - grab.last.x) / dt; grab.vy = (q.y - grab.last.y) / dt; grab.last = q; grab.t = now;
          gsap.to(front, { x: grab.fx + q.x - grab.x0, y: grab.fy + q.y - grab.y0, rotation: clamp(grab.vx * 12, -25, 25), duration: 0.15, overwrite: 'auto' });
          return;
        }
        tiltCard(dx, dy);
        card.style.setProperty('--gx', 50 + dx * 50 + '%');
        card.style.setProperty('--gy', 50 + dy * 50 + '%');
        const now = performance.now(), over = Math.abs(q.x - X) < (W * S) / 2 && Math.abs(q.y - Y) < (H * S) / 2;
        if (holo && over && now - lastGlint > 350 && Math.hypot(e.movementX, e.movementY) > 14) {
          lastGlint = now;
          MB.audio.sfx('glint', { rate: rnd(0.9, 1.4) });
        }
      }
      ov.addEventListener('pointerdown', onDown);
      ov.addEventListener('pointermove', onMove);
      revealKey = () => advance(null);
    });
  }

  // the fragments fly into their pieces of the card one by one, each chime a little higher; a finished card sheds
  // its cracks
  function shardsIn(tl, it, { card, layer, X, Y, S, col, title, sub, flash, ov, shardLine, def, count }) {
    const pieces = card.querySelectorAll('.sh'), veil = card.querySelector('.shard-veil');
    const bar = card.querySelector('.shard-count i'), num = card.querySelector('.shard-count span');
    const u = 160 / 166; // svg units -> card px
    for (let k = it.from; k < it.to; k++) {
      const p = pieces[k]; // measured when its turn comes, once the card is on the page
      const f = fxEl(layer, 'rv-frag', '🧩', col);
      const sx = X + (k % 2 ? 1 : -1) * 520, sy = Y + 260 - (k - it.from) * 60;
      gsap.set(f, { x: sx, y: sy, xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
      tl.addLabel('frag' + k, k === it.from ? '+=0.25' : '+=0.05')
        .call(() => {
          const bb = p.getBBox(), cx = X - (W * S) / 2 + (bb.x + bb.width / 2) * u * S, cy = Y - (H * S) / 2 + (bb.y + bb.height / 2) * u * S;
          MB.audio.sfx('whoosh');
          gsap.timeline()
            .to(f, { opacity: 1, scale: 1.3, duration: 0.12 })
            .to(f, { motionPath: { path: [{ x: sx, y: sy }, { x: (sx + cx) / 2, y: Math.min(sy, cy) - 160 }, { x: cx, y: cy }], curviness: 1.2 },
              rotation: 540, scale: 0.8, duration: 0.45, ease: 'power2.in' }, 0)
            .call(() => {
              f.remove();
              MB.audio.sfx('tink', { rate: 0.8 + ((k + 1) / it.need) * 0.7 });
              spray(layer, cx, cy, col, 18, { dist: [40, 200], size: [4, 10] });
              ring(layer, cx, cy, '#ffffff', { size: 60, scale: 3, dur: 0.5, width: 4 });
            });
        }, null, 'frag' + k)
        .to(p, { opacity: 0, duration: 0.25 }, `frag${k}+=0.57`)
        .call(() => {
          num.textContent = `🧩 ${k + 1}/${it.need}`;
          bar.style.width = ((k + 1) / it.need) * 100 + '%';
          sub.innerHTML = shardLine(k + 1);
        }, null, `frag${k}+=0.57`)
        .fromTo(card, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)', duration: 0.35, clearProps: 'filter' }, `frag${k}+=0.57`);
      if (k === it.from && veil) tl.to(veil, { opacity: 0, scale: 0.6, duration: 0.25 }, `frag${k}+=0.57`);
    }
    if (!it.done) return;
    // complete: the cracks glow, burst off, and the card is yours
    const shards = card.querySelector('.shards');
    tl.to(shards, { filter: 'brightness(3) drop-shadow(0 0 8px #fff)', duration: 0.3 }, '+=0.35')
      .call(() => {
        MB.audio.sfx('unlock'); MB.audio.sfx('slam');
        if (rarityOf(def).stars >= 4) MB.audio.sfx('fanfare');
        spray(layer, X, Y, col, 90, { dist: [180, 600], size: [6, 16], dur: [0.8, 1.6] });
        spray(layer, X, Y, '#ffffff', 30, { dist: [120, 420], size: [3, 8] });
        ring(layer, X, Y, col, { size: 180, scale: 8, dur: 0.9, width: 8 });
        ring(layer, X, Y, '#ffffff', { size: 140, scale: 6, dur: 0.7, width: 4 });
        gsap.fromTo(ov, { x: -14, y: 6 }, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.15)', clearProps: 'x,y' });
        title.textContent = 'UNLOCKED!';
        sub.innerHTML = `<b>${def.name}</b> joined your collection${count}`;
      })
      .to(shards, { scale: 1.25, opacity: 0, duration: 0.45, ease: 'power2.out' }, '<')
      .fromTo(flash, { opacity: 0 }, { opacity: 0.8, duration: 0.06 }, '<')
      .to(flash, { opacity: 0, duration: 0.6 })
      .fromTo(title, { scale: 2.4 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, '<');
  }

  // ---------------------------------------------------------------- the haul
  // everything from the pack side by side, to look over (they tilt and lift under the pointer). Resolves true for
  // "open another".
  function haul(ov, items, { tier, more }) {
    items = items.map((it) => (typeof it === 'string' ? { card: it } : it));
    const p = MB.PACKS[tier], N = items.length, S = N > 4 ? 1.2 : 1.35, gap = 36, Y = 380;
    const layer = ov.querySelector('.rv-fx'), rays = ov.querySelector('.rv-rays');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub'), hint = ov.querySelector('.rv-hint');
    ov.style.setProperty('--rc', p.color);
    title.textContent = 'YOUR HAUL';
    title.style.color = p.color;
    const frags = items.reduce((a, it) => a + (it.need != null ? it.to - it.from : 0), 0);
    const fresh = items.filter((it) => it.need == null || it.done).length;
    sub.innerHTML = [frags && `🧩 <b>${frags}</b> fragment${frags > 1 ? 's' : ''}`, fresh && `🎴 <b>${fresh}</b> new card${fresh > 1 ? 's' : ''}!`]
      .filter(Boolean).join(' · ');
    sub.style.top = '620px';
    gsap.set([title, sub, hint], { opacity: 0 });
    gsap.set(rays, { rotation: 0 });

    const boxes = items.map((it, k) => {
      const def = it.card && defOf(it.card), whole = it.need == null || it.done, color = def ? rarityOf(def).color : AVATAR_COLOR;
      const c = def ? MB.UI.cardEl(it.card, true) : avatarCard(it.avatar, W * S, H * S);
      if (def) c.style.zoom = S;
      if (!whole) MB.UI.lockCard(c, it.to);
      if (def) c.appendChild(el('div', 'glare'));
      const box = el('div', 'rv-haul' + (whole ? ' new' : ''));
      box.style.setProperty('--rc', color);
      Object.assign(box.style, { width: W * S + 'px', height: H * S + 'px' });
      box.appendChild(c);
      box.appendChild(el('div', 'rv-haul-tag', whole ? 'NEW!' : `+${it.to - it.from} 🧩 ${it.to}/${it.need}`));
      ov.insertBefore(box, layer);
      const x = 800 + (k - (N - 1) / 2) * (W * S + gap);
      gsap.set(box, { x: 800, y: Y, xPercent: -50, yPercent: -50, transformPerspective: 900, opacity: 0 });
      return { box, c, x, color, whole };
    });
    const btns = el('div', 'rv-haul-btns');
    const done = btns.appendChild(el('button', 'btn', 'Done'));
    const again = more > 0 ? btns.appendChild(el('button', 'btn primary', `🎁 Open another <small>(×${more})</small>`)) : null;
    ov.appendChild(btns);

    let ready = false, over = false;
    const tl = gsap.timeline({ onComplete: () => { ready = true; } })
      .call(() => MB.audio.sfx('fragment'))
      .fromTo(title, { opacity: 0, scale: 2 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' })
      .fromTo(rays, { opacity: 0, scale: 0.4 }, { opacity: 0.2, scale: 1, duration: 0.6 }, '<');
    boxes.forEach((b, k) => {
      const at = 0.15 + k * 0.12;
      tl.fromTo(b.box, { x: 800, y: Y + 60, scale: 0.2, rotationY: 90, opacity: 0 },
        { x: b.x, y: Y, scale: 1, rotationY: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, at)
        .call(() => {
          MB.audio.sfx('pop', { rate: 0.85 + k * 0.1 });
          if (b.whole) spray(layer, b.x, Y, b.color, 24, { dist: [60, 220], size: [4, 10] });
        }, null, at + 0.15);
    });
    tl.fromTo(sub, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3 })
      .fromTo(btns, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 }, '<');
    const idleRays = gsap.to(rays, { rotation: '+=360', duration: 40, repeat: -1, ease: 'none' });

    // each card lifts and leans toward the pointer
    boxes.forEach((b, k) => {
      b.box.addEventListener('pointerenter', () => {
        if (!ready || over) return;
        MB.audio.sfx('glint', { rate: 0.8 + k * 0.12 });
        gsap.to(b.box, { y: Y - 18, scale: 1.06, duration: 0.25, ease: 'back.out(2)' });
      });
      b.box.addEventListener('pointermove', (e) => {
        if (!ready || over) return;
        const rr = b.box.getBoundingClientRect(), dx = ((e.clientX - rr.left) / rr.width) * 2 - 1, dy = ((e.clientY - rr.top) / rr.height) * 2 - 1;
        gsap.to(b.box, { rotationY: dx * 16, rotationX: -dy * 12, duration: 0.3 });
        b.c.style.setProperty('--gx', 50 + dx * 50 + '%');
        b.c.style.setProperty('--gy', 50 + dy * 50 + '%');
      });
      b.box.addEventListener('pointerleave', () => { if (ready && !over) gsap.to(b.box, { y: Y, scale: 1, rotationX: 0, rotationY: 0, duration: 0.35 }); });
    });

    return new Promise((res) => {
      // they all fly off to the collection
      const end = (more) => {
        if (over) return;
        over = true;
        revealKey = null;
        ov.removeEventListener('pointerdown', onBg);
        tl.progress(1);
        idleRays.kill();
        MB.audio.sfx(more ? 'crinkle' : 'swipe');
        gsap.timeline({ onComplete: () => { boxes.forEach((b) => b.box.remove()); btns.remove(); sub.style.top = ''; res(more); } })
          .to([title, sub, btns, rays], { opacity: 0, duration: 0.2 }, 0)
          .to(boxes.map((b) => b.box), { x: 1480, y: 60, scale: 0.2, rotation: 25, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.in' }, 0);
      };
      const onBg = (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        if (tl.progress() < 1) { tl.progress(1); return; } // first click skips the lay-out
        if (!e.target.closest('.rv-haul')) end(false);
      };
      done.onclick = () => end(false);
      if (again) again.onclick = () => end(true);
      ov.addEventListener('pointerdown', onBg);
      revealKey = () => end(!!again); // Space / Enter: the main button
    });
  }

  // ---------------------------------------------------------------- pack opening
  // The pack drops in and leans toward the pointer. Swipe along the dotted line to tear the top off (a click tears it
  // for you); the light leaking out of the tear is the colour of the best card inside. Then each item is revealed and
  // the haul laid out. more: packs of this tier left after this one. Resolves true to open another.
  function openPack(tier, items, fromEl, more = 0) {
    revealing = true;
    const p = MB.PACKS[tier], col = p.color, lvl = { common: 1, rare: 2, epic: 3 }[tier] || 1;
    const X = 800, Y = 450, PW = 346, PH = 560, TEAR = 0.15; // TEAR: the strip that rips off, as a share of the height
    const best = items.map((it) => (typeof it === 'string' ? defOf(it) : it.card && defOf(it.card))).filter(Boolean).map(rarityOf).sort((a, b) => b.stars - a.stars)[0];
    const inner = best ? best.color : col, jackpot = !!best && best.stars >= 4;
    const ov = revealLayer();
    ov.style.setProperty('--rc', col);
    const layer = ov.querySelector('.rv-fx'), flash = ov.querySelector('.rv-flash'), rays = ov.querySelector('.rv-rays');
    const title = ov.querySelector('.rv-title'), sub = ov.querySelector('.rv-sub'), hint = ov.querySelector('.rv-hint');
    const glow = el('div', 'rv-glow');
    const pack = el('div', 'rv-pack', `<div class="rv-pack-tilt"><div class="rv-pack-body"></div><div class="rv-pack-top"></div>
      <div class="rv-slit"></div><div class="rv-pack-shine"></div><div class="rv-tearline"><i></i></div></div>`);
    Object.assign(pack.style, { width: PW + 'px', height: PH + 'px' });
    pack.style.setProperty('--art', `url("${MB.packArt(tier)}")`);
    pack.style.setProperty('--tear', TEAR * 100 + '%');
    pack.style.setProperty('--in', inner);
    ov.insertBefore(glow, layer); ov.insertBefore(pack, layer);
    const tiltEl = pack.querySelector('.rv-pack-tilt'), top = pack.querySelector('.rv-pack-top'), body = pack.querySelector('.rv-pack-body');
    const slit = pack.querySelector('.rv-slit'), shine = pack.querySelector('.rv-pack-shine'), line = pack.querySelector('.rv-tearline');
    const tilt = tilter(tiltEl, 14, 900);
    title.textContent = p.name.toUpperCase();
    title.style.color = col;
    sub.textContent = 'Swipe along the dotted line to tear it open';
    hint.textContent = 'or just click the pack';
    const from = fromEl && fromEl.isConnected ? rectOf(fromEl) : { x: X, y: -300, w: PW };
    gsap.set([pack, glow], { x: X, y: Y, xPercent: -50, yPercent: -50 });
    gsap.set(glow, { opacity: 0 });
    gsap.set([title, sub, hint, line], { opacity: 0 });

    // intro → ready → tearing → auto (a click finishing the tear) → open
    let state = 'intro';
    const idle = [];
    const intro = gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(pack, { x: from.x, y: from.y, scale: from.w / PW, rotation: -12 }, { x: X, y: Y, scale: 1, rotation: 0, duration: 0.75, ease: 'back.out(1.4)' })
      .call(() => { MB.audio.sfx('thud'); MB.audio.sfx('foil'); }, null, 0.4)
      .to(glow, { opacity: 0.6, scale: 1.1, duration: 0.5 }, '<0.3')
      .fromTo(title, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, '<')
      .to([sub, hint], { opacity: 0.85, duration: 0.4 })
      .to(line, { opacity: 1, duration: 0.3 }, '<')
      .call(() => {
        state = 'ready';
        idle.push(gsap.to(pack, { y: Y - 14, rotation: 2, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        idle.push(gsap.to(glow, { scale: 1.25, opacity: 0.8, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        // a glowing dot runs along the tear line to show the move
        const dot = line.querySelector('i');
        idle.push(gsap.timeline({ repeat: -1, repeatDelay: 0.5 })
          .fromTo(dot, { left: '0%' }, { left: '100%', duration: 1.1, ease: 'power1.inOut' })
          .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
          .to(dot, { opacity: 0, duration: 0.2 }, 0.9));
      });

    return new Promise((res) => {
      const lip = Y - PH / 2 + PH * TEAR;
      const lipNow = () => gsap.getProperty(pack, 'y') - PH / 2 + PH * TEAR; // while it bobs
      // tear: the stretch of the line torn so far, in pack px (0..PW); dir 1 = torn left to right
      let tear = null, down = null;
      function setTear(a, b) {
        tear.min = Math.min(tear.min, a, b); tear.max = Math.max(tear.max, a, b);
        tear.dir = tear.max - tear.start >= tear.start - tear.min ? 1 : -1;
        const k = (tear.max - tear.min) / PW;
        gsap.set(slit, { left: tear.min, width: tear.max - tear.min, opacity: 1 });
        // the torn end of the strip lifts, hinging on the part still attached
        top.style.transformOrigin = `${tear.dir > 0 ? 100 : 0}% ${TEAR * 100}%`;
        gsap.to(top, { rotation: tear.dir * k * 14, y: -k * 10, duration: 0.15 });
        gsap.to(glow, { opacity: 0.7 + k * 0.3, scale: 1.1 + k * 0.3, duration: 0.2 });
        return k;
      }
      function startTear(at) {
        tear = { start: at, min: at, max: at, dir: 1, sound: 0 };
        state = 'tearing';
        idle[2].kill();
        gsap.to([sub, hint, line], { opacity: 0, duration: 0.2 });
      }
      function onMove(e) {
        if (state !== 'ready' && state !== 'tearing') return;
        const q = toUi(e.clientX, e.clientY);
        const dx = clamp((q.x - X) / 400, -1, 1), dy = clamp((q.y - Y) / 400, -1, 1);
        tilt(down ? 0 : dx, down ? 0 : dy); // held still while tearing
        shine.style.setProperty('--sx', 50 + dx * 60 + '%');
        shine.style.setProperty('--sy', 50 + dy * 60 + '%');
        if (!down) return;
        down.moved = Math.max(down.moved, Math.hypot(q.x - down.x, q.y - down.y));
        // only a drag along the tear line tears
        const on = Math.abs(q.y - lipNow()) < 90 && Math.abs(q.x - X) < PW / 2 + 40, lx = clamp(q.x - (X - PW / 2), 0, PW);
        if (!on) { down.px = null; return; }
        if (down.px == null) { down.px = lx; return; }
        if (!tear) startTear(down.px);
        const before = tear.max - tear.min, k = setTear(down.px, lx), grew = tear.max - tear.min - before;
        down.px = lx;
        if (grew > 0) {
          tear.sound += grew;
          if (tear.sound > 26) { tear.sound = 0; MB.audio.sfx('tear', { rate: 0.85 + k * 0.5, at: 0.04 + Math.random() * 0.06, len: 0.15 }); }
          spray(layer, q.x, lipNow(), inner, 2, { dist: [20, 90], size: [3, 8], gravity: -30, dur: [0.4, 0.8], stars: 0.5 });
          gsap.fromTo(tiltEl, { x: rnd(-3, 3) }, { x: 0, duration: 0.12 });
        }
        if (k >= 0.8) open();
      }
      function onDown(e) {
        if (e.button !== 0) return;
        if (state === 'intro') { intro.progress(1); return; } // first click skips the drop-in
        if (state !== 'ready' && state !== 'tearing') return;
        const q = toUi(e.clientX, e.clientY);
        down = { x: q.x, y: q.y, moved: 0, px: null };
        MB.audio.sfx('crinkle');
        gsap.to(pack, { scale: 1.03, duration: 0.15 });
        onMove(e);
      }
      function onUp() {
        if (!down) return;
        const d = down;
        down = null;
        if (state !== 'ready' && state !== 'tearing') return;
        gsap.to(pack, { scale: 1, duration: 0.2 });
        if (d.moved < 12) autoTear(); // a click
        else if (state === 'tearing') { sub.textContent = 'Keep going!'; gsap.to(sub, { opacity: 0.85, duration: 0.2 }); }
        else gsap.fromTo(line, { opacity: 0.3 }, { opacity: 1, duration: 0.15, repeat: 3, yoyo: true }); // dragged off the line
      }
      // a click: the tear runs the rest of the way by itself
      function autoTear() {
        if (!tear) startTear(0);
        state = 'auto';
        MB.audio.sfx('rip');
        const run = { v: tear.dir > 0 ? tear.max : tear.min };
        gsap.to(run, { v: tear.dir > 0 ? PW : 0, duration: 0.4, ease: 'power1.in', onComplete: open,
          onUpdate: () => { setTear(run.v, run.v); spray(layer, X - PW / 2 + run.v, lip, inner, 1, { dist: [20, 90], size: [3, 8], gravity: -30, stars: 0.5 }); } });
      }
      // the strip is off: light bursts out, then the pack falls away
      function open() {
        if (state === 'open') return;
        state = 'open';
        revealKey = null;
        ov.removeEventListener('pointerdown', onDown);
        ov.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        idle.forEach((t) => t.kill());
        tilt(0, 0);
        const charge = 0.3 + lvl * 0.2, dir = tear ? tear.dir : 1;
        if (jackpot) [0, 0.45].forEach((d) => gsap.delayedCall(d, () => MB.audio.sfx('heartbeat')));
        if (lvl >= 3 || jackpot) MB.audio.sfx('riser', { end: 0.15 + charge });
        const tl = gsap.timeline({ onComplete: () => { pack.remove(); glow.remove(); reveal(items, ov, { tier, more }).then(res); } });
        tl.to([title, sub, hint, line, shine], { opacity: 0, duration: 0.2 }, 0)
          .to(slit, { left: 0, width: PW, opacity: 1, duration: 0.15 }, 0)
          .to(slit, { height: 16, marginTop: -8, duration: charge, ease: 'power1.in' }, 0.15)
          .to(pack, { y: Y, rotation: 0, scale: 1.04, duration: 0.15 }, 0)
          .fromTo(pack, { x: X - 4 * lvl }, { x: X + 4 * lvl, duration: 0.05, repeat: Math.round(charge / 0.05), yoyo: true, ease: 'none' }, 0.15)
          .to(glow, { opacity: 1, scale: 1.2 + lvl * 0.15, duration: charge, ease: 'power1.in' }, 0.15)
          .call(() => converge(layer, X, lip, inner, 14 * lvl, charge), null, 0.15)
          .set(pack, { x: X }, 0.15 + charge)
          // pop: the top strip flies off the way it was torn and light pours out of the opening
          .call(() => {
            MB.audio.sfx('foil'); MB.audio.sfx('slam');
            MB.audio.sfx(lvl >= 3 ? 'win' : 'sparkle');
            spray(layer, X, lip, inner, 30 + lvl * 15, { dist: [120, 460], size: [5, 14], gravity: -40 });
            spray(layer, X, lip, '#ffffff', 16, { dist: [80, 300], size: [3, 7], gravity: -40 });
            ring(layer, X, lip, inner, { size: 180, scale: 4 + lvl, dur: 0.8 });
            if (jackpot) gsap.fromTo(ov, { x: -14, y: 6 }, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.15)', clearProps: 'x,y' });
          })
          .to(top, { x: dir * 260, y: -260, rotation: dir * 50, opacity: 0, duration: 0.7, ease: 'power2.out' })
          .to(slit, { opacity: 0, duration: 0.4 }, '<')
          .fromTo(flash, { opacity: 0 }, { opacity: 0.35 + lvl * 0.15, duration: 0.06 }, '<')
          .to(flash, { opacity: 0, duration: 0.5 })
          .fromTo(rays, { opacity: 0, scale: 0.2 }, { opacity: 0.2 + lvl * 0.1, scale: 1, duration: 0.6 }, '<')
          .to(body, { y: 420, rotation: -6, opacity: 0, duration: 0.55, ease: 'power2.in' }, '<0.15')
          .to([glow, rays], { opacity: 0, duration: 0.3 }, '<0.2');
        if (!items.length) {
          tl.call(() => { sub.textContent = 'Nothing new inside — your collection is complete!'; gsap.to(sub, { opacity: 1, duration: 0.3 }); });
          tl.to({}, { duration: 1.6 });
        }
      }
      ov.addEventListener('pointerdown', onDown);
      ov.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      revealKey = () => { if (state === 'intro') intro.progress(1); else if (state === 'ready' || state === 'tearing') autoTear(); };
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
      // during a reveal Space / Enter do what a click would (tear the pack, flip, next)
      if (revealing && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (revealKey && !e.repeat) revealKey();
        return;
      }
      if (!modal) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
    }, true);
  }

  // intros, moves and scenes: for tools/check_game.js
  MB.Cards = { bind, open, close, reveal, openPack, flyToDeck, burst, intros: INTRO, styleIntros: STYLE_INTROS, moves: MOVES, scenes: SCENES,
    sceneVariants: SCENE_VARIANTS, backdrops: BACKDROPS };
})();
