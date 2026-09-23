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

  // styles shared by two characters get a personal line
  const QUOTES = { 'maria-hunley': 'Hi, sweetie!', 'farley-kate': "Dad's here!", 'maiko-ghan': 'Honestly? Easy.', 'ben-brier': 'Outta my way.' };
  const INTRO = {
    // Maria, Farley: drops from the sky and shakes the screen
    slam: (sp, L, c, ov, def) => gsap.timeline()
      .fromTo(sp, { y: -1000, opacity: SPRITE_OP, rotation: -6 }, { y: 0, rotation: 0, duration: 0.45, ease: 'power3.in' })
      .call(() => { const p = spot(sp); MB.audio.sfx('slam'); ring(L, p.x, p.bottom - 30, c, { size: 220, scale: 4, width: 10 }); feetDust(L, sp); shake(ov, 18); })
      .add(squash(sp))
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, QUOTES[def.id] || 'Hmph!', c, 46); }, null, 0.6),
    // Hayley: sparkles rush in, she pops out of them
    barrage: (sp, L, c) => gsap.timeline()
      .call(() => { const p = spot(sp); converge(L, p.x, p.y, c, 34, 0.5); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, scale: 0.3, rotation: -25 }, { opacity: SPRITE_OP, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, 0.4)
      .call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 40, { dist: [160, 460], stars: 0.8 }); MB.audio.sfx('sparkle'); word(L, p.x, p.top + 60, '✦ Yay! ✦', c, 50); }, null, 0.6),
    // James: scanned in by a beam, left to right
    beam: (sp, L, c) => gsap.timeline()
      .call(() => {
        const p = spot(sp), line = fxEl(L, 'cm-scan', '', c);
        MB.audio.sfx('beam');
        gsap.set(line, { y: p.top, height: p.bottom - p.top });
        gsap.fromTo(line, { x: p.x - p.w / 2 }, { x: p.x + p.w / 2, duration: 0.7, ease: 'power2.inOut', onComplete: () => gsap.to(line, { opacity: 0, duration: 0.2, onComplete: () => line.remove() }) });
      })
      .fromTo(sp, { opacity: SPRITE_OP, clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power2.inOut', clearProps: 'clipPath' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, '...whatever.', c, 40); }),
    // Maiko, Ben: dashes in leaving afterimages and skids to a stop
    dash: (sp, L, c, ov, def) => gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(sp, { x: 800, opacity: SPRITE_OP, skewX: -20 }, { x: -50, duration: 0.3, ease: 'power3.in', onUpdate: () => afterimage(sp) })
      .call(() => { feetDust(L, sp); MB.audio.sfx('hit'); })
      .to(sp, { x: 0, skewX: 0, duration: 0.55, ease: 'elastic.out(1,0.4)' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, QUOTES[def.id] || 'Ready!', c, 46); }, null, 0.45),
    // Isabella: blooms out of a whirl of petals
    orb: (sp, L) => gsap.timeline()
      .call(() => { const p = spot(sp); swirl(L, p.x, p.y, ['🌸', '🌸', '💮'], 20, 1); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, y: 40, filter: 'brightness(2.5) blur(8px)' }, { opacity: SPRITE_OP, y: 0, filter: 'brightness(1) blur(0px)', duration: 0.9, ease: 'power2.out', clearProps: 'filter' }, 0.25),
    // Julie: three bouncy hops
    bounce: (sp, L, c) => {
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
    bolt: (sp, L, c, ov) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      for (let i = 0; i < 3; i++) {
        tl.call(() => { MB.audio.sfx('zap'); screenFlash(L, i === 2 ? '#ffffff' : c, 0.45); const p = spot(sp); lightning(L, p.x + rnd(-160, 160), c); })
          .to(sp, { opacity: i === 2 ? SPRITE_OP : 0.7, duration: 0.04 })
          .to(sp, { opacity: i === 2 ? SPRITE_OP : 0, duration: 0.14 });
      }
      return tl.call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 30, { dist: [150, 420] }); shake(ov, 10); });
    },
    // Luther: skates in spinning
    spin: (sp, L, c) => gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(sp, { opacity: SPRITE_OP, x: 500, rotationY: -1080, transformPerspective: 1400 }, { x: 0, rotationY: 0, duration: 1, ease: 'power3.out', onUpdate: () => afterimage(sp) })
      .call(() => { const p = spot(sp); ring(L, p.x, p.bottom - 30, c, { size: 200, scale: 3.5 }); MB.audio.sfx('sparkle'); }, null, 0.8),
    // Fami: the frying pan flies out and she catches it
    boomerang: (sp, L, c) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 300 }, { x: 0, duration: 0.5, ease: 'power3.out' })
      .call(() => {
        const p = spot(sp), pan = fxEl(L, 'cm-emoji', '🍳');
        pan.style.fontSize = '90px';
        MB.audio.sfx('whoosh');
        gsap.set(pan, { x: p.x, y: p.y, xPercent: -50, yPercent: -50 });
        gsap.to(pan, { rotation: 1440, duration: 1, ease: 'none' });
        gsap.to(pan, { keyframes: [{ x: p.x - 620, y: p.y - 260, duration: 0.5, ease: 'sine.out' }, { x: p.x - 30, y: p.y - 40, duration: 0.5, ease: 'sine.in' }],
          onComplete: () => { pan.remove(); MB.audio.sfx('slam'); spray(L, p.x - 30, p.y - 40, c, 24, { dist: [80, 280] }); word(L, p.x, p.top + 60, 'Dinner!', c, 50); } });
      }),
    // Wert: a confetti cannon and a laugh track
    confetti: (sp, L, c) => gsap.timeline()
      .fromTo(sp, { opacity: 0, y: 70 }, { opacity: SPRITE_OP, y: 0, duration: 0.45, ease: 'back.out(2)' })
      .call(() => {
        const p = spot(sp);
        confetti(L, p.x, p.top + 120, 50); MB.audio.sfx('sparkle');
        ['HA!', 'HA HA!', 'HA!'].forEach((w, i) => gsap.delayedCall(i * 0.2, () => word(L, p.x + rnd(-170, 170), p.top + rnd(40, 220), w, c, 46)));
      }),
    // Catherine: it rains money
    coins: (sp, L, c) => gsap.timeline()
      .call(() => { const p = spot(sp); rain(L, p.x - 300, p.x + 300, p.bottom, ['🪙', '💰', '💎', '🪙'], 32); MB.audio.sfx('coin'); })
      .fromTo(sp, { opacity: 0, filter: 'brightness(3) sepia(1)' }, { opacity: SPRITE_OP, filter: 'brightness(1) sepia(0)', duration: 1, clearProps: 'filter' }, 0.3)
      .call(() => MB.audio.sfx('coin'), null, 0.7)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, 'Darling~', c, 48); }, null, 1),
    // Harris: thaws out of a frozen block
    frost: (sp, L) => gsap.timeline()
      .call(() => { const p = spot(sp); MB.audio.sfx('freeze'); spray(L, p.x, p.y, '#bff4ff', 30, { dist: [120, 420], stars: 0.3 }); fling(L, p.x, p.y, ['❄', '❄', '🍦'], 10); })
      .fromTo(sp, { opacity: SPRITE_OP, filter: 'brightness(2.4) saturate(0)' }, { filter: 'brightness(1) saturate(1)', duration: 1.1, ease: 'power2.out', clearProps: 'filter' }, 0)
      .fromTo(sp, { x: -7 }, { x: 7, duration: 0.05, repeat: 9, yoyo: true }, 0)
      .set(sp, { x: 0 }),
    // Zoe: rides up on a wave
    wave: (sp, L, c) => gsap.timeline()
      .call(() => { const p = spot(sp); MB.audio.sfx('splash'); column(L, 'cm-water', p, c, 0.5); riseFrom(L, p.x, p.bottom, ['#bfe9ff', c], 40, 0.8); })
      .fromTo(sp, { opacity: SPRITE_OP, y: 700 }, { y: 0, duration: 0.75, ease: 'back.out(1.4)' }, 0.1)
      .call(() => { const p = spot(sp); ring(L, p.x, p.bottom - 30, c, { size: 240, scale: 3 }); MB.audio.sfx('splash'); }),
    // Keiko: three slashes and she's suddenly there
    slash: (sp, L, c) => {
      const tl = gsap.timeline().set(sp, { opacity: 0 });
      for (let i = 0; i < 3; i++) tl.call(() => { const p = spot(sp); slashLine(L, p.x, p.y + (i - 1) * 120, -35 + i * 35, c); MB.audio.sfx('whoosh'); }).to({}, { duration: 0.12 });
      return tl.fromTo(sp, { opacity: SPRITE_OP, scaleX: 0.05 }, { scaleX: 1, duration: 0.2, ease: 'power3.out' })
        .call(() => { const p = spot(sp); spray(L, p.x, p.y, c, 26, { dist: [120, 360] }); word(L, p.x, p.top + 60, 'Overtime!', c, 46); });
    },
    // Lilith: rises out of hellfire
    hellfire: (sp, L, c, ov) => gsap.timeline()
      .call(() => { const p = spot(sp); column(L, 'cm-fire', p, c, 0.7); riseFrom(L, p.x, p.bottom, ['#ff4a1c', '#ffb347', '#ffe066'], 60, 1.1); MB.audio.sfx('zap'); })
      .fromTo(sp, { opacity: 0, y: 140, filter: 'brightness(0.3) sepia(1) saturate(5)' }, { opacity: SPRITE_OP, y: 0, filter: 'brightness(1) sepia(0) saturate(1)', duration: 1, ease: 'power2.out', clearProps: 'filter' }, 0.15)
      .call(() => { const p = spot(sp); ring(L, p.x, p.y, c, { size: 220, scale: 4 }); shake(ov, 12); MB.audio.sfx('slam'); word(L, p.x, p.top + 60, 'Look at ME!', c, 50); }, null, 0.95),
    // Celeste: descends in a beam of light and feathers
    halo: (sp, L, c) => gsap.timeline()
      .call(() => { const p = spot(sp); column(L, 'cm-light', p, c, 1); rain(L, p.x - 300, p.x + 300, p.bottom, ['🪶', '✨', '🪶'], 18, 1.2); MB.audio.sfx('sparkle'); })
      .fromTo(sp, { opacity: 0, y: -500 }, { opacity: SPRITE_OP, y: 0, duration: 1.2, ease: 'power2.out' }, 0.1)
      .call(() => { const p = spot(sp); ring(L, p.x, p.top + 40, '#fff6c8', { size: 170, scale: 2.5, width: 8 }); MB.audio.sfx('heal'); }, null, 1.1),
    // Mr Dino: an uppercut leap from below the screen
    uppercut: (sp, L, c, ov) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, y: 900 }, { y: -130, duration: 0.35, ease: 'power3.out' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 20, 'HUH?!', c, 72); MB.audio.sfx('whoosh'); })
      .to(sp, { y: 0, duration: 0.3, ease: 'power3.in' })
      .call(() => { MB.audio.sfx('slam'); shake(ov, 18); feetDust(L, sp); })
      .add(squash(sp)),
    // Clara: walks in turned away, then spins round flustered
    heartbreak: (sp, L, c) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 220, scaleX: -1 }, { x: 0, duration: 0.5, ease: 'power2.out' })
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, 'Hmph!', c, 50); })
      .to(sp, { scaleX: 1, duration: 0.2, ease: 'back.out(3)', delay: 0.4 })
      .call(() => { const p = spot(sp); fling(L, p.x, p.y - 80, ['💗', '💢', '💕'], 12); word(L, p.x, p.top + 60, 'B-baka!', '#ff5c8a', 56); MB.audio.sfx('sparkle'); }),
    // Janice: pages whirl around her
    pages: (sp, L, c) => gsap.timeline()
      .call(() => { const p = spot(sp); swirl(L, p.x, p.y, ['📄', '📃', '📖'], 22, 1.1); MB.audio.sfx('draw'); })
      .fromTo(sp, { opacity: 0, scale: 0.92 }, { opacity: SPRITE_OP, scale: 1, duration: 0.9, ease: 'power2.out' }, 0.3)
      .call(() => { const p = spot(sp); word(L, p.x, p.top + 60, 'Shhh...', c, 44); }, null, 1.1),
    // Jay: paint splashes, then colour floods in
    paint: (sp, L, c) => {
      const tl = gsap.timeline();
      [c, '#ff4fa3', '#ffd23f', '#7dff8a'].forEach((col, i) => tl.call(() => { const p = spot(sp); splat(L, p.x + rnd(-220, 220), p.y + rnd(-260, 260), col); MB.audio.sfx('splash'); }, null, i * 0.13));
      return tl.fromTo(sp, { opacity: 0, filter: 'saturate(0) brightness(1.8)' }, { opacity: SPRITE_OP, filter: 'saturate(1) brightness(1)', duration: 0.8, clearProps: 'filter' }, 0.3);
    },
    // Charlie & Jenny: stagger in, swaying
    stumble: (sp, L) => gsap.timeline()
      .fromTo(sp, { opacity: SPRITE_OP, x: 520, transformOrigin: '50% 100%' }, { x: 0, duration: 1.1, ease: 'power1.out' })
      .fromTo(sp, { rotation: 12 }, { rotation: -10, duration: 0.27, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0)
      .to(sp, { rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' })
      .call(() => { const p = spot(sp); word(L, p.x - 90, p.top + 90, '*hic*', '#ffe6a0', 40); fling(L, p.x, p.top + 120, ['🫧', '🍺', '✨'], 9); }, null, 0.4),
  };

  // relationship flavour: what flies when the partners meet
  const DUO_FLAVOR = {
    harmony: ['🔥', '🪶', '😇', '😈'], gothic: ['🦇', '🥀', '🖤'], miracle: ['🎁', '❄', '🎄'], waltz: ['💍', '🌹'],
    dojo: ['🥋', '💥'], jackpot: ['💰', '💎', '🪙'], sleepover: ['🪶', '🌙', '💤'], party: ['🎈', '🪩', '🎉'],
    lesson: ['📏', '✏️', '📚'], cheerchain: ['🎀', '⛓️', '✨'], howl: ['🐺', '🌕'], twinstar: ['☀️', '🌙'],
    breakfast: ['🥞', '🍓', '🍦'], riptide: ['🌊', '🐚', '💧'],
  };
  // the partners run in from both sides, bump into each other and a heart bursts between them
  function duoIntro(def, box, L, ov) {
    const [a, b] = box.querySelectorAll('img'), heart = box.querySelector('.cm-duo-heart');
    const c = def.attack.color, tier = def.bond.tier, T = MB.BOND_TIERS[tier];
    const flavor = DUO_FLAVOR[def.attack.style] || [def.attack.emoji || '💞'];
    const meet = () => ({ x: box.offsetLeft + b.offsetLeft, y: box.offsetTop + box.offsetHeight * 0.3 });
    return gsap.timeline()
      .call(() => MB.audio.sfx('whoosh'))
      .fromTo(a, { x: -520, opacity: 0, rotation: -10 }, { x: 0, opacity: SPRITE_OP, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0)
      .fromTo(b, { x: 620, opacity: 0, rotation: 10 }, { x: 0, opacity: SPRITE_OP, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0.08)
      .to(a, { x: 34, rotation: 4, duration: 0.14, ease: 'power2.in' })
      .to(b, { x: -34, rotation: -4, duration: 0.14, ease: 'power2.in' }, '<')
      .call(() => {
        const p = meet();
        MB.audio.sfx('bond', tier);
        spray(L, p.x, p.y, c, 24 + tier * 14, { dist: [140, 460], stars: 0.5 });
        spray(L, p.x, p.y, '#ffffff', 10 + tier * 6, { dist: [100, 320], size: [3, 8] });
        ring(L, p.x, p.y, c, { size: 160, scale: 3 + tier, dur: 0.9, width: 8 });
        if (tier >= 2) ring(L, p.x, p.y, '#ffffff', { size: 120, scale: 2 + tier, dur: 0.7, width: 4 });
        fling(L, p.x, p.y, [...flavor, '💗', '💕'], 8 + tier * 5);
        word(L, p.x, p.y - 150, `${T.hearts} ${T.name.toUpperCase()}!`, c, 44 + tier * 6);
        if (tier >= 3) { screenFlash(L, '#ffffff', 0.35); shake(ov, 14); }
      })
      .to([a, b], { x: 0, rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' })
      .fromTo(heart, { xPercent: -50, scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(3)' }, '<');
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
      ${def.type === 'unit' && !def.emoji && !def.fused ? `<img class="cm-sprite" src="${MB.bigSpriteUrl(def.id, locked ? 'idle' : 'taunt')}">` : ''}
      ${def.fused ? `<div class="cm-duo">${def.members.map((m) => `<img src="${MB.bigSpriteUrl(m.id, 'taunt', m.costume)}">`).join('')}<div class="cm-duo-heart">♥</div></div>` : ''}
      <div class="cm-pivot"><div class="cm-tilt"></div></div>
      <div class="cm-info"></div>
      <div class="cm-fx"></div>
      <div class="cm-hint">Right-click, Esc or click outside to close · move the mouse to tilt</div>`);
    ov.style.setProperty('--rc', col);
    ov.classList.toggle('locked', locked);
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
    // each character steps in with its own signature entrance; locked ones stay a plain silhouette
    const intro = !sprite ? null : locked || !INTRO[def.attack.style]
      ? gsap.fromTo(sprite, { x: 260, opacity: 0 }, { x: 0, opacity: locked ? 1 : SPRITE_OP, duration: 0.8, ease: 'power3.out' })
      : INTRO[def.attack.style](sprite, layer, def.attack.color, ov, def);
    if (intro) tl.add(intro, 0.15);
    if (duoBox) tl.add(duoIntro(def, duoBox, layer, ov), 0.15);
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
    // the partners sway out of step, leaning into each other
    const heart = m.ov.querySelector('.cm-duo-heart');
    if (heart) m.tweens.push(gsap.to(heart, { scale: 1.2, y: -8, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    m.ov.querySelectorAll('.cm-duo img').forEach((im, i) => m.tweens.push(gsap.to(im, { y: -12, rotation: i ? -1.5 : 1.5, duration: 2.4, delay: i * 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })));
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

  MB.Cards = { bind, open, close, reveal, openPack, flyToDeck, burst };
})();
