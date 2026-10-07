// GSAP effects. Everything lives on the tilted CSS-3D board: billboards stand up facing the
// viewer, "flat" elements lie on the floor, so motion across the board reads as real depth.
(function () {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dirOf = (A, T) => { const dx = T.x - A.x, dy = T.y - A.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l, len: l }; };
  const wait = (s) => new Promise((r) => gsap.delayedCall(s, r));

  // animate a billboard along fn(t) -> {x, y, h, r}
  function path(node, fn, dur, ease = 'none', onUpdate) {
    const o = { t: 0 };
    const apply = () => {
      const p = fn(o.t);
      gsap.set(node, { x: p.x, y: p.y });
      gsap.set(node.body, { y: -p.h, rotation: p.r || 0, scale: p.s == null ? 1 : p.s });
      onUpdate && onUpdate(p, o.t);
    };
    apply();
    return gsap.to(o, { t: 1, duration: dur, ease, onUpdate: apply });
  }
  const arc = (A, T, h0, h1, peak, side = 0, perp) => (t) => ({
    x: lerp(A.x, T.x, t) + (perp ? perp.x * side * Math.sin(Math.PI * t) : 0),
    y: lerp(A.y, T.y, t) + (perp ? perp.y * side * Math.sin(Math.PI * t) : 0),
    h: lerp(h0, h1, t) + peak * Math.sin(Math.PI * t),
  });

  function dot(V, p, h, color, size, cls = 'spark') {
    const b = V.billboard(cls, '', p.x, p.y);
    b.body.style.setProperty('--c', color);
    b.body.style.width = b.body.style.height = size + 'px';
    gsap.set(b.body, { y: -h });
    return b;
  }

  function burst(V, p, color, n = 14, o = {}) {
    const h = o.h ?? 100, spread = o.spread ?? 120;
    for (let i = 0; i < n; i++) {
      const b = dot(V, p, h, color, rnd(6, 16), o.shape === 'shard' ? 'spark shard' : 'spark');
      const a = rnd(0, Math.PI * 2), r = rnd(spread * 0.3, spread) * (PLUG ? 0.75 : 1), dur = rnd(0.4, 0.8);
      gsap.to(b, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, duration: dur, ease: 'power2.out' });
      // sparks arc up and fall back under gravity (Physics2D), or ease out without it
      if (PLUG) gsap.to(b.body, { physics2D: { velocity: rnd(200, 480), angle: rnd(-130, -50), gravity: 1000 }, rotation: rnd(-360, 360), duration: dur + 0.2 });
      else gsap.to(b.body, { y: -h - rnd(-40, 140), rotation: rnd(-360, 360), duration: dur, ease: 'power2.out' });
      gsap.to(b.body, { opacity: 0, scale: 0.2, duration: 0.35, delay: rnd(0.3, 0.6), onComplete: () => b.remove() });
    }
  }

  function rise(V, p, color, n, h) {
    for (let i = 0; i < n; i++) {
      const b = dot(V, { x: p.x + rnd(-50, 50), y: p.y + rnd(-15, 15) }, rnd(0, h * 0.7), color, rnd(6, 12), 'spark plus');
      gsap.to(b.body, { y: `-=${rnd(80, 160)}`, opacity: 0, duration: rnd(0.8, 1.3), delay: i * 0.04, ease: 'power1.out', onComplete: () => b.remove() });
    }
  }

  function ring(V, p, color, scale = 1.6, dur = 0.6) {
    const r = V.flat('shock-ring', '', p.x, p.y);
    r.style.setProperty('--c', color);
    gsap.fromTo(r, { scale: 0.1, opacity: 1 }, { scale, opacity: 0, duration: dur, ease: 'power2.out', onComplete: () => r.remove() });
  }

  function flash(V, p, h, color, size = 160) {
    const b = dot(V, p, h, color, size, 'impact-flash');
    gsap.fromTo(b.body, { scale: 0.2, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => b.remove() });
  }

  function hit(V, t, color, big) {
    const p = V.pos(t), h = V.heightOf(t) * 0.5;
    flash(V, p, h, color, big ? 240 : 160);
    burst(V, p, color, big ? 24 : 14, { h });
    ring(V, p, color, big ? 2.2 : 1.3);
  }

  // afterimage of a moving character
  function ghost(V, v, color) {
    const now = performance.now();
    if (v._ghostT && now - v._ghostT < 35) return;
    v._ghostT = now;
    const x = gsap.getProperty(v.el, 'x'), y = gsap.getProperty(v.el, 'y');
    const g = V.billboard('ghost', v.img.tagName === 'IMG' ? `<img src="${v.img.src}">` : v.img.outerHTML, x, y);
    g.body.style.setProperty('--c', color);
    g.body.style.height = v.stand.style.height;
    gsap.set(g.body, { yPercent: -100, y: gsap.getProperty(v.figure, 'y'), rotationY: gsap.getProperty(v.figure, 'rotationY') });
    gsap.to(g.body, { opacity: 0, duration: 0.35, onComplete: () => g.remove() });
  }

  function ctx(V, a, t) {
    const v = V.ents.get(a.uid);
    const A = V.pos(a), T = V.pos(t), d = dirOf(A, T);
    const perp = { x: -d.y, y: d.x };
    const C = { x: T.x - d.x * 85, y: T.y - d.y * 85 };
    return { v, A, T, d, perp, C, hA: V.heightOf(a) * 0.55, hT: V.heightOf(t) * 0.5, c: a.card.attack.color };
  }

  function goHome(v, A, dur = 0.45) {
    return gsap.timeline()
      .to(v.el, { x: A.x, y: A.y, duration: dur, ease: 'power2.inOut' })
      .to(v.figure, { x: 0, y: 0, rotation: 0, rotationY: 0, opacity: 1, duration: dur }, 0)
      .to(v.img, { scaleX: 1, scaleY: 1, duration: dur }, 0);
  }

  // attack.cry (said while winding up) and attack.finish (over the target after the hit) work with every style;
  // attack() shows them. A style with a line of its own asks own(): null when the card brings its line instead.
  const own = (a, key, line) => (a.card.attack[key] ? null : line);

  // ---------------------------------------------------------------- GSAP plugins (game/lib)
  // Physics2D throws debris under gravity, CustomWiggle makes shake eases, DrawSVG draws strokes in (magic circles,
  // vines, floor cracks), MotionPath flies things along curves (cards.js). The Node checker loads none of them, so
  // nothing here may need them at load time.
  const GW = typeof window !== 'undefined' ? window : {};
  const PLUG = !!(GW.Physics2DPlugin && GW.CustomWiggle && GW.DrawSVGPlugin && GW.CustomEase);
  if (PLUG) {
    gsap.registerPlugin(GW.CustomEase, GW.CustomWiggle, GW.Physics2DPlugin, GW.DrawSVGPlugin, GW.MotionPathPlugin);
    GW.CustomWiggle.create('mb.wiggle', { wiggles: 6, type: 'easeOut' });
    GW.CustomWiggle.create('mb.shakeX', { wiggles: 9, type: 'easeOut' });
    GW.CustomWiggle.create('mb.shakeY', { wiggles: 7, type: 'easeOut' });
    GW.CustomWiggle.create('mb.flutter', { wiggles: 5, type: 'uniform' });
    // a lunge: leans back, snaps forward, overshoots and settles
    GW.CustomEase.create('mb.lunge', 'M0,0 C0.28,-0.12 0.44,-0.12 0.58,0.45 0.66,0.85 0.72,1.1 0.8,1.06 0.88,1.01 0.94,1 1,1');
    // a drop that hangs at the top, then falls hard (slams, stomps)
    GW.CustomEase.create('mb.drop', 'M0,0 C0.3,0 0.5,0.05 0.62,0.2 0.76,0.4 0.86,0.7 1,1');
  }
  const WIGGLE = PLUG ? 'mb.wiggle' : 'none';
  // eases the view uses too (V.shake); null when the plugins are missing
  const EASE = PLUG ? { shakeX: 'mb.shakeX', shakeY: 'mb.shakeY', flutter: 'mb.flutter', lunge: 'mb.lunge', drop: 'mb.drop' }
    : { shakeX: null, shakeY: null, flutter: 'none', lunge: 'back.out(1.6)', drop: 'power3.in' };

  // chunks (glowing shards, or emoji `chars`) thrown up from a floor point that fall back down under gravity
  function debris(V, p, color, n = 10, o = {}) {
    for (let i = 0; i < n; i++) {
      const b = o.chars ? V.billboard('petal', MB.pick(o.chars), p.x, p.y) : dot(V, p, 0, color, rnd(7, 15), 'spark shard');
      if (o.chars) b.body.style.fontSize = rnd(18, 34) + 'px';
      gsap.set(b.body, { y: -(o.h || 0) });
      const v0 = rnd(380, 720), ang = rnd(-112, -68), g = 1800, t = Math.min(1.3, (2 * v0 * Math.sin((-ang * Math.PI) / 180)) / g + 0.1);
      const a = rnd(0, Math.PI * 2), r = rnd(20, (o.spread || 140) * 0.6);
      gsap.to(b, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6, duration: t, ease: 'none' });
      if (PLUG) gsap.to(b.body, { physics2D: { velocity: v0, angle: ang, gravity: g }, rotation: rnd(-540, 540), duration: t });
      else gsap.to(b.body, { keyframes: [{ y: `-=${v0 * 0.2}`, duration: t / 2, ease: 'power2.out' }, { y: `+=${v0 * 0.2}`, duration: t / 2, ease: 'power2.in' }] });
      gsap.to(b.body, { opacity: 0, duration: 0.2, delay: t - 0.2, onComplete: () => b.remove() });
    }
  }
  // a cloud of smoke (a ninja vanishing, rocket exhaust, an explosion)
  function puff(V, p, color = '#d6d6e0', n = 8, h = 40, size = 1) {
    for (let i = 0; i < n; i++) {
      const s = dot(V, { x: p.x + rnd(-40, 40), y: p.y + rnd(-18, 18) }, h + rnd(-20, 50), color, rnd(40, 80) * size, 'smoke');
      gsap.fromTo(s.body, { scale: 0.3, opacity: 0.95 }, { scale: rnd(1.2, 1.9), y: `-=${rnd(20, 70)}`, opacity: 0, duration: rnd(0.6, 1), ease: 'power1.out', onComplete: () => s.remove() });
    }
  }
  // draw SVG strokes in: DrawSVG, or a dash offset without it
  function draw(els, vars) {
    els = [...els];
    if (PLUG) return gsap.fromTo(els, { drawSVG: '0%' }, { drawSVG: '100%', ...vars });
    els.forEach((e) => { const l = e.getTotalLength(); e.style.strokeDasharray = l; e.style.strokeDashoffset = l; });
    return gsap.to(els, { strokeDashoffset: 0, ...vars });
  }
  // a path function whose r turns the billboard along its travel; `off` is where the prop already points (45 for 🚀)
  const along = (fn, off = 0) => (k) => {
    const p = fn(Math.max(0, k - 0.01)), q = fn(Math.min(1, k + 0.01));
    return { ...fn(k), r: (Math.atan2((q.y - p.y) * 0.45 - (q.h - p.h), q.x - p.x) * 180) / Math.PI + off };
  };

  // knock a billboard that is already out (a coin, a thrown prop, a shard) off under gravity, then remove it
  function toss(b, { v = [260, 520], ang = [-150, -30], g = 1500, dur = 0.8, spin = 540 } = {}) {
    if (PLUG) gsap.to(b.body, { physics2D: { velocity: rnd(...v), angle: rnd(...ang), gravity: g }, rotation: `+=${rnd(-spin, spin)}`, duration: dur });
    else gsap.to(b.body, { x: `+=${rnd(-80, 80)}`, y: '+=60', rotation: `+=${rnd(-spin, spin)}`, duration: dur, ease: 'power2.in' });
    gsap.to(b.body, { opacity: 0, duration: 0.25, delay: dur - 0.25, onComplete: () => b.remove() });
  }

  // jagged cracks that run out across the floor from a point, drawn in (DrawSVG). `glow` colors the light in them.
  function cracks(V, p, color, { n = 7, len = 150, hold = 0.9, w = 5, glow = color } = {}) {
    const S2 = Math.round(len * 2 + 40), c0 = S2 / 2, P = (a, r) => `${(c0 + Math.cos(a) * r).toFixed(1)},${(c0 + Math.sin(a) * r).toFixed(1)}`;
    let paths = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), L = len * rnd(0.55, 1);
      let r = rnd(10, 24), d = `M${P(a, r)}`;
      while (r < L) {
        r += rnd(18, 34);
        const aa = a + rnd(-0.28, 0.28);
        d += ` L${P(aa, r)}`;
        if (Math.random() < 0.18) paths += `<path class="d" stroke-width="${w * 0.6}" d="M${P(aa, r)} L${P(aa + rnd(0.3, 0.6) * MB.pick([-1, 1]), r + rnd(20, 40))}"/>`;
      }
      paths += `<path class="d" d="${d}"/>`;
    }
    const f = V.flat('cracks', `<svg viewBox="0 0 ${S2} ${S2}" width="${S2}" height="${S2}"><g fill="none" stroke="currentColor" stroke-width="${w}"
      stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`, p.x, p.y);
    f.style.color = color; f.style.setProperty('--c', glow);
    draw(f.querySelectorAll('.d'), { duration: 0.35, stagger: 0.015, ease: 'power3.out' });
    gsap.to(f, { opacity: 0, duration: 0.6, delay: hold, onComplete: () => f.remove() });
    return f;
  }

  // a sword arc drawn through a point (DrawSVG): colored edge, white core; the tail wipes away after it
  function slashArc(V, T, y, c, rot = 0) {
    const d = 'M28,196 Q118,-6 236,112';
    const s = V.billboard('slash-svg', `<svg viewBox="0 0 260 260" width="260" height="260" fill="none" stroke-linecap="round">
      <path class="d" d="${d}" stroke="${c}" stroke-width="24"/><path class="d" d="${d}" stroke="#fff" stroke-width="8"/></svg>`, T.x, T.y);
    s.body.style.setProperty('--c', c);
    gsap.set(s.body, { y, rotation: rot });
    const strokes = s.body.querySelectorAll('.d');
    draw(strokes, { duration: 0.11, ease: 'power3.out' });
    if (PLUG) gsap.to(strokes, { drawSVG: '100% 100%', duration: 0.22, delay: 0.11, ease: 'power2.in' });
    gsap.to(s.body, { opacity: 0, scale: 1.12, duration: 0.2, delay: 0.14, onComplete: () => s.remove() });
    return s;
  }

  // a magic circle drawn onto the floor (two rings, a hexagram, runes); spins until removed
  const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
  function runeCircle(V, p, color, { size = 300, hold = null } = {}) {
    const pt = (i) => { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2; return `${150 + Math.cos(a) * 118},${150 + Math.sin(a) * 118}`; };
    const tri = (off) => [0, 2, 4].map((i) => pt(i + off)).join(' ');
    const glyphs = [...RUNES].map((g, i) => `<text x="150" y="31" transform="rotate(${i * 30} 150 150)">${g}</text>`).join('');
    const f = V.flat('runes', `<svg viewBox="0 0 300 300" width="${size}" height="${size}"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
      <circle class="d" cx="150" cy="150" r="140"/><circle class="d" cx="150" cy="150" r="118"/><polygon class="d" points="${tri(0)}"/><polygon class="d" points="${tri(1)}"/>
      <circle class="d" cx="150" cy="150" r="44"/></g><g fill="currentColor" font-size="17" text-anchor="middle">${glyphs}</g></svg>`, p.x, p.y);
    f.style.color = color; f.style.setProperty('--c', color);
    draw(f.querySelectorAll('.d'), { duration: 0.6, stagger: 0.08, ease: 'power1.inOut' });
    gsap.fromTo(f.querySelectorAll('text'), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.03, delay: 0.3 });
    const spin = gsap.to(f, { rotation: '+=360', duration: 5, ease: 'none', repeat: -1 });
    const remove = () => gsap.to(f, { opacity: 0, scale: 1.3, duration: 0.5, onComplete: () => { spin.kill(); f.remove(); } });
    if (hold != null) gsap.delayedCall(hold + 0.6, remove);
    return { f, remove };
  }

  // floor decals: attack.floor (any style), and the effects themselves
  const FLOORS = { splat: 'splat', frost: 'frost-floor', sigil: 'sigil', whirlpool: 'whirlpool', ring: 'shock-ring', crater: 'crater', lava: 'lava-pool',
    gloom: 'gloom-floor', dark: 'dark-pool', runes: 'runes' };
  function decal(V, p, name, color, hold = 1) {
    if (name === 'runes') return runeCircle(V, p, color, { hold });
    const f = V.flat(FLOORS[name] || name, '', p.x, p.y);
    f.style.setProperty('--c', color);
    gsap.fromTo(f, { scale: 0.1, opacity: 0.95 }, { scale: 1.2, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(f, { opacity: 0, duration: 0.6, delay: hold, onComplete: () => f.remove() });
    return f;
  }

  // ---------------------------------------------------------------- skies
  // attack.sky swaps the backdrop behind the arena for the length of the attack. It lives in #sky, above the
  // background picture and below the board, so the fight itself stays bright.
  const SKIES = {
    night:   { bg: 'radial-gradient(ellipse at 50% 15%, #26357a, #0b1030 55%, #03040c)', o: 0.88, stars: 70 },
    storm:   { bg: 'linear-gradient(#141821, #2c3342 55%, #0d1016)', o: 0.88, flashes: true, rain: 70 },
    blood:   { bg: 'radial-gradient(circle at 50% 22%, #ffd0c0 0 3%, #ff3030 5%, #7a0012 22%, #1c0006 70%)', o: 0.85 },
    holy:    { bg: 'radial-gradient(ellipse at 50% -10%, #fffdf0, #ffe38a 35%, #c79a3a 75%, #5a3d10)', o: 0.7, rays: true },
    void:    { bg: 'radial-gradient(ellipse at 50% 45%, #3a0f66, #10001f 50%, #000 85%)', o: 0.92, motes: ['#b07cff', 40] },
    inferno: { bg: 'linear-gradient(to top, #ff7a1c, #b3260c 30%, #3a0600 75%)', o: 0.8, motes: ['#ffb347', 50] },
    dream:   { bg: 'linear-gradient(135deg, #ffb6e6, #c3a8ff 50%, #9fe6ff)', o: 0.7, bubbles: 26 },
    ocean:   { bg: 'linear-gradient(#1a8fc4, #07314d 70%, #021624)', o: 0.8, bubbles: 30 },
    sunset:  { bg: 'linear-gradient(#2b1650, #b23a6f 40%, #ff8c4a 70%, #ffd27a)', o: 0.75 },
    matrix:  { bg: 'linear-gradient(#001a08, #000)', o: 0.92, code: 36 },
    space:   { bg: 'radial-gradient(ellipse at 30% 30%, #1d1450, #070418 60%, #000)', o: 0.94, stars: 110, planet: true },
    sakura:  { bg: 'linear-gradient(#ffd6ea, #ff9ecb 55%, #b8527e)', o: 0.7, petals: 40 },
    sunny:   { bg: 'radial-gradient(circle at 50% 6%, #fffbe6 0 5%, #ffe98a 9%, #9ad8ff 28%, #5ab4ff 62%, #3a8ae8)', o: 0.7, rays: true },
  };
  let skyN = 0;
  function sky(name) {
    const def = SKIES[name], box = typeof document !== 'undefined' && document.getElementById('sky');
    if (!def || !box) return () => {};
    const n = ++skyN, loops = [];
    gsap.killTweensOf(box);
    box.innerHTML = '';
    box.style.background = def.bg;
    const add = (cls, css, html) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); if (html) d.textContent = html; box.appendChild(d); return d; };
    const loop = (tw, dur) => { tw.totalTime(rnd(0, dur)); loops.push(tw); };
    for (let i = 0; i < (def.stars || 0); i++) {
      const s = add('sky-star', { left: rnd(0, 100) + '%', top: rnd(0, 80) + '%', width: rnd(2, 5) + 'px' });
      loops.push(gsap.fromTo(s, { opacity: rnd(0.3, 1) }, { opacity: rnd(0, 0.25), duration: rnd(0.3, 1.2), yoyo: true, repeat: -1 }));
    }
    for (let i = 0; i < (def.rain || 0); i++) {
      const s = add('sky-rain', { left: rnd(-5, 105) + '%' }), d = rnd(0.35, 0.6);
      loop(gsap.fromTo(s, { y: '-15vh' }, { y: '110vh', duration: d, repeat: -1, ease: 'none' }), d);
    }
    if (def.motes) for (let i = 0; i < def.motes[1]; i++) {
      const s = add('sky-mote', { left: rnd(0, 100) + '%', background: def.motes[0], boxShadow: `0 0 8px ${def.motes[0]}` }), d = rnd(2.5, 5);
      loop(gsap.fromTo(s, { y: '105vh', x: 0 }, { y: '-10vh', x: rnd(-60, 60), duration: d, repeat: -1, ease: 'none' }), d);
    }
    for (let i = 0; i < (def.bubbles || 0); i++) {
      const s = add('sky-bubble', { left: rnd(0, 100) + '%', width: rnd(10, 34) + 'px' }), d = rnd(3, 6);
      loop(gsap.fromTo(s, { y: '105vh' }, { y: '-10vh', x: rnd(-40, 40), duration: d, repeat: -1, ease: 'sine.inOut' }), d);
    }
    for (let i = 0; i < (def.petals || 0); i++) {
      const s = add('sky-petal', { left: rnd(-10, 100) + '%' }, MB.pick(['🌸', '💮'])), d = rnd(4, 7);
      loop(gsap.fromTo(s, { y: '-10vh', rotation: 0 }, { y: '110vh', x: rnd(40, 200), rotation: rnd(-360, 360), duration: d, repeat: -1, ease: 'none' }), d);
    }
    for (let i = 0; i < (def.code || 0); i++) {
      const s = add('sky-code', { left: (i / def.code) * 100 + rnd(0, 2) + '%' }, Array.from({ length: 14 }, () => (Math.random() < 0.5 ? '0' : '1')).join('\n')), d = rnd(1.4, 3);
      loop(gsap.fromTo(s, { y: '-60vh' }, { y: '110vh', duration: d, repeat: -1, ease: 'none' }), d);
    }
    if (def.rays) loops.push(gsap.to(add('sky-rays', {}), { rotation: 360, duration: 30, repeat: -1, ease: 'none' }));
    if (def.planet) add('sky-planet', {});
    if (def.flashes) {
      const fl = add('sky-flash', {});
      loops.push(gsap.timeline({ repeat: -1, repeatDelay: 0.9 }).set(fl, { opacity: 0.8 }).to(fl, { opacity: 0, duration: 0.12 })
        .set(fl, { opacity: 0.5 }, '+=0.08').to(fl, { opacity: 0, duration: 0.3 }).call(() => { if (Math.random() < 0.4) MB.audio.sfx('thunder'); }));
    }
    gsap.fromTo(box, { opacity: 0 }, { opacity: def.o, duration: 0.45 });
    return () => {
      if (n !== skyN) return loops.forEach((l) => l.kill());
      gsap.to(box, { opacity: 0, duration: 0.6, onComplete: () => { loops.forEach((l) => l.kill()); if (n === skyN) box.innerHTML = ''; } });
    };
  }

  // attack.aura: the attacker glows and gives off motes for the whole attack
  function aura(V, a, color) {
    const v = V.ents.get(a.uid);
    if (!v) return () => {};
    gsap.to(v.figure, { filter: `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 24px ${color})`, duration: 0.3 });
    const tick = gsap.timeline({ repeat: -1, repeatDelay: 0.06 }).call(() => {
      const p = here(v), m = dot(V, { x: p.x + rnd(-45, 45), y: p.y + rnd(-10, 10) }, rnd(0, V.heightOf(a) * 0.8) - gsap.getProperty(v.figure, 'y'), color, rnd(6, 12), 'spark plus');
      gsap.to(m.body, { y: `-=${rnd(50, 110)}`, opacity: 0, duration: rnd(0.5, 0.9), onComplete: () => m.remove() });
    });
    return () => { tick.kill(); gsap.to(v.figure, { filter: 'drop-shadow(0 0 0px transparent)', duration: 0.3, clearProps: 'filter' }); };
  }
  // attack.slowmo: the whole game slows right after the hit (true = 0.25x)
  function slowmo(k) {
    gsap.globalTimeline.timeScale(typeof k === 'number' ? k : 0.25);
    setTimeout(() => gsap.globalTimeline.timeScale(1), 380);
  }

  // ---------------------------------------------------------------- attack styles
  const S = {};

  S.dash = async (V, a, t, impact) => {
    const { v, A, d, C, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    // one lunge (CustomEase): leans back, snaps in, carries a little past the stop
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.46, ease: EASE.lunge, onUpdate() { if (this.progress() > 0.3) ghost(V, v, c); } })
      .to(v.img, { scaleY: 0.86, scaleX: 1.12, duration: 0.22 }, 0)
      .to(v.img, { scaleY: 1.06, scaleX: 0.94, duration: 0.16 }, 0.24);
    impact(); hit(V, t, c, a.atk >= 5);
    // follow-up jabs
    const tl = gsap.timeline();
    for (let i = 0; i < 3; i++) tl.to(v.figure, { x: d.x * 22, duration: 0.05 }).to(v.figure, { x: 0, duration: 0.05 }).call(() => burst(V, V.pos(t), c, 4, { h: V.heightOf(t) * 0.5, spread: 60 }));
    await tl;
    await goHome(v, A);
  };

  // Maiko tries to be formal for one second, then her honest impatience wins.
  S.karatecombo = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t);
    const H = V.heightOf(a);
    pop(V, A, H + 65, 'Bow first!', 'float-text ability', 1);
    await gsap.to(v.figure, { rotation: d.x * 18, y: 25, duration: 0.28, ease: 'sine.inOut' });
    MB.audio.sfx('ding');
    pop(V, A, H + 35, 'Nope. GO!', 'float-text ability', 0.85);
    await gsap.to(v.figure, { rotation: -d.x * 14, y: -70, duration: 0.16, ease: 'power2.out' });
    MB.audio.sfx('swish');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.32, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    const kick = V.billboard('thrown', '🦶', C.x, C.y);
    kick.body.style.fontSize = '115px';
    await path(kick, (k) => ({ ...arc(C, T, H * 0.4, hT, 65)(k), r: -25 + k * 45, s: 0.65 + k * 0.55 }), 0.22, 'power3.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('kick'); V.shake(13);
    pop(V, T, hT + 85, 'KICK!', 'float-text dmg', 0.7);
    gsap.to(kick.body, { scale: 1.6, opacity: 0, duration: 0.24, onComplete: () => kick.remove() });
    await gsap.to(v.figure, { rotation: d.x * 20, y: 0, duration: 0.2, ease: 'bounce.out' });
    pop(V, C, H + 80, '...I bowed!', 'float-text ability', 0.9);
    await goHome(v, A, 0.5);
  };

  // Isabella's gentle tennis serve comes off the racket much harder than she intended.
  S.tennisserve = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const hand = { x: A.x + (A.x > 850 ? -95 : 95), y: A.y + 40 };
    const serve = { x: hand.x - (A.x > 850 ? -30 : 30), y: hand.y };
    const racket = V.billboard('thrown', '<span style="display:block;width:62px;height:80px;border:9px solid #e184b3;border-radius:50%;background:repeating-linear-gradient(90deg,transparent 0 9px,#ffffffaa 10px 12px),repeating-linear-gradient(0deg,transparent 0 9px,#ffffffaa 10px 12px)"></span><span style="display:block;width:12px;height:55px;margin:-3px auto 0;background:#e184b3;border-radius:7px"></span>', hand.x, hand.y);
    gsap.set(racket.body, { y: -hA * 1.1, rotation: -32, scale: 0.9 });
    const ball = V.billboard('thrown', '<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="#c8ee54" stroke="#76972d" stroke-width="3"/><path d="M12 10c18 8 18 28 0 36M44 10c-18 8-18 28 0 36" fill="none" stroke="#fffef0" stroke-width="4"/></svg>', serve.x, serve.y);
    gsap.set(ball.body, { y: -hA * 0.55, scale: 0.7 });
    pop(V, A, V.heightOf(a) + 75, 'Easy serve...', 'float-text ability', 1);
    MB.audio.sfx('boing');
    await gsap.to(ball.body, { y: -hA - 105, duration: 0.35, ease: 'power2.out' });
    await Promise.all([
      gsap.to(ball.body, { y: -hA * 1.15, duration: 0.22, ease: 'power2.in' }),
      gsap.to(v.figure, { rotation: -13, y: -12, duration: 0.22 }),
    ]);
    await gsap.to(racket.body, { rotation: 25, duration: 0.12, ease: 'power2.in' });
    MB.audio.sfx('twang');
    gsap.to(racket.body, { rotation: 85, duration: 0.16, ease: 'power3.out' });
    await path(ball, (k) => ({ ...arc(serve, T, hA * 1.15, hT, 140)(k), r: k * 450, s: 0.75 + k * 0.45 }), 0.55, 'power2.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); V.shake(9);
    pop(V, A, V.heightOf(a) + 65, 'Too hard?!', 'float-text ability', 0.95);
    await path(ball, (k) => ({ ...arc(T, serve, hT, hA * 0.5, 100)(k), r: 450 + k * 360, s: 1.2 - k * 0.6 }), 0.5, 'power2.out');
    ball.remove(); MB.audio.sfx('pop');
    gsap.to(racket.body, { opacity: 0, scale: 0.5, duration: 0.2, onComplete: () => racket.remove() });
    pop(V, A, V.heightOf(a) + 75, 'Good rally?', 'float-text ability', 0.9);
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.3 });
  };

  // Luther barely lifts a foot. The runaway board does the fighting for him and rolls right back.
  S.skatekick = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    const board = V.billboard('thrown', '🛹', A.x, A.y);
    board.body.style.fontSize = '115px';
    gsap.set(board.body, { y: -25, rotation: -12, scale: 0.65 });
    pop(V, A, V.heightOf(a) + 60, 'Watch. Barely.', 'float-text ability', 0.9);
    await gsap.to(v.figure, { rotation: -8, y: -8, duration: 0.3 });
    MB.audio.sfx('slide');
    await path(board, (k) => ({ ...arc(A, T, 25, hT, 115)(k), r: -12 + k * 740, s: 0.65 + k * 0.45 }), 0.8, 'power2.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('whack'); V.shake(10);
    pop(V, T, hT + 90, 'BONK', 'float-text dmg', 0.65);
    await path(board, (k) => ({ ...arc(T, A, hT, 25, 85)(k), r: 728 + k * 700, s: 1.1 - k * 0.45 }), 0.6, 'power2.out');
    board.remove();
    pop(V, A, V.heightOf(a) + 60, 'Probably nailed it.', 'float-text ability', 1);
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.25 });
  };

  // Ben shows off a lift, loses the weight, and calls the resulting collision a workout.
  S.gymfail = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const weight = V.billboard('thrown', '<span style="display:flex;align-items:center;gap:3px;filter:drop-shadow(0 6px 3px #0008)"><b style="width:24px;height:62px;background:#30303b;border:4px solid #aaa;border-radius:8px"></b><i style="display:block;width:72px;height:12px;background:#d4d4da;border-radius:8px"></i><b style="width:24px;height:62px;background:#30303b;border:4px solid #aaa;border-radius:8px"></b></span>', A.x, A.y);
    gsap.set(weight.body, { y: -hA * 0.75, scale: 0.7 });
    pop(V, A, V.heightOf(a) + 70, 'Check my gains!', 'float-text ability', 1);
    MB.audio.sfx('grow');
    await gsap.to(weight.body, { y: -hA - 65, scale: 1, duration: 0.45, ease: 'back.out(2)' });
    await gsap.to(v.figure, { rotation: 8, y: 12, duration: 0.15 });
    pop(V, A, V.heightOf(a) + 40, 'Spot me?!', 'float-text ability', 0.85);
    MB.audio.sfx('whistleUp');
    await path(weight, (k) => ({ ...arc(A, T, hA + 65, hT, 110)(k), r: k * 580, s: 1 + k * 0.3 }), 0.67, 'power1.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('clang'); V.shake(14);
    pop(V, T, hT + 100, 'NEW RECORD!', 'float-text ability', 0.9);
    gsap.to(weight.body, { rotation: '+=120', opacity: 0, y: -hT + 80, duration: 0.38, onComplete: () => weight.remove() });
    await gsap.to(v.figure, { rotation: -10, y: -18, duration: 0.2, ease: 'back.out(2)' });
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.25 });
  };

  // Keiko treats the fight like another shift: punch the timecard, stamp it, and get back to work.
  S.timecard = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const card = V.billboard('thrown', '<span style="display:block;background:#fff8ed;color:#78374c;border:3px solid #78374c;border-radius:5px;padding:8px 12px;font:900 19px sans-serif;white-space:nowrap">TIME CARD<br>08:00 → 22:00</span>', A.x, A.y);
    gsap.set(card.body, { y: -hA, rotation: -9, scale: 0.7 });
    MB.audio.sfx('tick');
    await gsap.to(v.figure, { rotation: -10, duration: 0.18 });
    await path(card, (k) => ({ ...arc(A, T, hA, hT, 95)(k), r: -9 + k * 18, s: 0.7 + k * 0.3 }), 0.52, 'power1.in');
    const stamp = V.billboard('thrown', '🔴', T.x, T.y);
    stamp.body.style.fontSize = '62px';
    gsap.set(stamp.body, { y: -hT - 135, scale: 0.8 });
    MB.audio.sfx('whistleDown');
    await gsap.to(stamp.body, { y: -hT, scale: 1, duration: 0.2, ease: 'power3.in' });
    impact(); hit(V, t, c); MB.audio.sfx('slam'); V.shake(9);
    const mark = V.billboard('float-text debuff', 'OVERTIME', T.x, T.y);
    mark.body.style.color = c;
    gsap.set(mark.body, { y: -hT - 48, rotation: -8, scale: 0.8 });
    gsap.to(mark.body, { opacity: 0, y: -hT - 90, duration: 0.65, delay: 0.3, onComplete: () => mark.remove() });
    gsap.to(stamp.body, { opacity: 0, y: -hT - 80, duration: 0.25, onComplete: () => stamp.remove() });
    gsap.to(card.body, { opacity: 0, rotation: 22, duration: 0.25, onComplete: () => card.remove() });
    await gsap.to(v.figure, { rotation: 0, duration: 0.25 });
  };

  S.slam = async (V, a, t, impact) => {
    const { v, A, T, d, C, c } = ctx(V, a, t);
    MB.audio.sfx('whistleUp');
    await gsap.timeline()
      .to(v.img, { scaleY: 0.78, scaleX: 1.18, duration: 0.22, ease: 'power2.out' })
      .add('jump')
      .to(v.el, { x: C.x + d.x * 40, y: C.y + d.y * 40, duration: 0.62, ease: 'power1.inOut' }, 'jump')
      .to(v.figure, { y: -380, duration: 0.36, ease: 'power2.out' }, 'jump')
      .to(v.figure, { rotation: d.x * 14, duration: 0.36 }, 'jump')
      .to(v.img, { scaleY: 1.1, scaleX: 0.92, duration: 0.2 }, 'jump')
      .to(v.figure, { y: 0, duration: 0.3, ease: EASE.drop }, 'jump+=0.34');
    impact(); MB.audio.sfx('slam'); MB.audio.sfx('boing'); V.shake(26);
    hit(V, t, c, true);
    ring(V, T, '#ffffff', 3, 0.8);
    // the floor gives: cracks run out, rubble flies up and falls back, dust rolls
    cracks(V, T, '#2b1d12', { n: 9, len: 170, w: 7, glow: c, hold: 1.1 });
    debris(V, T, '#c9b79c', 14, { spread: 220 });
    puff(V, T, '#d9ccb4', 7, 10, 1.1);
    gsap.to(V.board, { '--tilt': (V.tilt + 4) + 'deg', duration: 0.08, yoyo: true, repeat: 1 });
    await gsap.to(v.img, { scaleY: 0.8, scaleX: 1.2, duration: 0.08, yoyo: true, repeat: 1 });
    await gsap.timeline()
      .to(v.el, { x: A.x, y: A.y, duration: 0.55, ease: 'power1.inOut' })
      .to(v.figure, { y: -150, rotation: 0, duration: 0.27, ease: 'power2.out' }, 0)
      .to(v.figure, { y: 0, duration: 0.28, ease: 'power2.in' }, 0.27)
      .to(v.img, { scaleX: 1, scaleY: 1, duration: 0.3 }, 0.4);
  };

  S.barrage = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    await gsap.to(v.figure, { y: -30, duration: 0.15, yoyo: true, repeat: 1 });
    MB.audio.sfx('sparkle');
    let first = true;
    const shots = [];
    for (let i = 0; i < 7; i++) {
      const s = V.billboard('star-shot', a.card.attack.emoji || '✦', A.x, A.y);
      s.body.style.setProperty('--c', c);
      const side = rnd(-150, 150), peak = rnd(90, 220), TT = { x: T.x + rnd(-25, 25), y: T.y + rnd(-10, 10) };
      shots.push(wait(i * 0.07).then(() => new Promise((res) => {
        path(s, (k) => ({ ...arc(A, TT, hA, hT, peak, side, perp)(k), r: k * 720, s: 0.6 + k * 0.6 }), 0.55, 'power1.in', (p, k) => {
          if (Math.random() < 0.5) { const tr = dot(V, p, p.h, c, 8); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => tr.remove() }); }
        }).then(() => {
          s.remove();
          if (first) { first = false; impact(); hit(V, t, c); } else { burst(V, TT, c, 5, { h: hT, spread: 60 }); MB.audio.sfx('sparkle'); }
          res();
        });
      })));
    }
    await Promise.all(shots);
    await wait(0.2);
  };

  S.confetti = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    for (let i = 0; i < (own(a, 'cry', 'HA!') ? 3 : 0); i++) {
      const ha = V.billboard('float-text ability', 'HA!', A.x + rnd(-40, 40), A.y);
      gsap.set(ha.body, { y: -hA - 60 });
      gsap.to(ha.body, { y: -hA - 160, opacity: 0, rotation: rnd(-20, 20), duration: 0.8, delay: i * 0.12, onComplete: () => ha.remove() });
    }
    gsap.to(v.figure, { rotation: 6, duration: 0.08, yoyo: true, repeat: 5 });
    await wait(0.35);
    const colors = ['#ff5d8f', '#ffe066', '#5fd0ff', '#7dff8a', '#c58cff'];
    let first = true;
    const all = [];
    for (let i = 0; i < 14; i++) {
      const s = V.billboard('confetti', '', A.x, A.y);
      s.body.style.background = colors[i % colors.length];
      const TT = { x: T.x + rnd(-50, 50), y: T.y + rnd(-20, 20) };
      all.push(wait(i * 0.035).then(() => path(s, (k) => ({ ...arc(A, TT, hA, hT, rnd(120, 200), rnd(-100, 100), perp)(k), r: k * 900 }), 0.6, 'power1.in').then(() => {
        // each strip bursts back up off the target and flutters down (Physics2D + a CustomWiggle flip)
        gsap.to(s.body, { rotationX: 180, duration: 0.9, ease: EASE.flutter });
        toss(s, { v: [220, 460], ang: [-140, -40], g: 700, dur: 1, spin: 200 });
        if (first) { first = false; impact(); hit(V, t, c); const p = V.billboard('float-text ability', '🎉', T.x, T.y); gsap.set(p.body, { y: -hT - 40 }); gsap.to(p.body, { scale: 2, opacity: 0, duration: 0.8, onComplete: () => p.remove() }); }
      })));
    }
    MB.audio.sfx('whoosh');
    await Promise.all(all);
  };

  S.beam = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT, c } = ctx(V, a, t);
    const O = { x: A.x + d.x * 40, y: A.y + d.y * 40 };
    const orb = dot(V, O, hA, c, 60, 'charge');
    MB.audio.sfx('beam');
    await gsap.timeline()
      .fromTo(orb.body, { scale: 0 }, { scale: 1.6, duration: 0.45, ease: 'power2.in' })
      .to(v.figure, { x: -d.x * 10, duration: 0.45 }, 0);
    // beam = chain of glowing billboards so it keeps true perspective
    const N = Math.max(14, Math.round(d.len / 22)), segs = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const s = dot(V, { x: lerp(O.x, T.x, k), y: lerp(O.y, T.y, k) }, lerp(hA, hT, k), c, 46, 'beam-seg');
      gsap.set(s.body, { scale: 0 });
      segs.push(s);
    }
    await gsap.to(segs.map((s) => s.body), { scale: 1, duration: 0.08, stagger: 0.012, ease: 'power2.out' });
    impact(); hit(V, t, c, true);
    V.shake(10);
    await gsap.to(segs.map((s) => s.body), { scale: () => rnd(0.7, 1.2), duration: 0.06, repeat: 5, yoyo: true });
    await gsap.to([...segs.map((s) => s.body), orb.body], { scale: 0, opacity: 0, duration: 0.25, stagger: 0.005 });
    segs.forEach((s) => s.remove()); orb.remove();
    gsap.to(v.figure, { x: 0, duration: 0.3 });
  };

  S.orb = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const em = a.card.attack.emoji || '🌸';
    const o = V.billboard('petal-orb', `<span>${em}</span><span>${em}</span><span>${em}</span>`, A.x, A.y);
    o.body.style.setProperty('--c', c);
    gsap.to(o.body.querySelectorAll('span'), { rotation: 360, duration: 0.6, repeat: -1, ease: 'none' });
    await gsap.to(v.figure, { y: -25, duration: 0.2 });
    MB.audio.sfx('sparkle');
    await path(o, (k) => ({ ...arc(A, T, hA, hT, 160, 60, perp)(k), s: 0.7 + k * 0.5 }), 0.75, 'sine.inOut', (p) => {
      if (Math.random() < 0.35) {
        const pe = V.billboard('petal', em, p.x, p.y);
        gsap.set(pe.body, { y: -p.h, scale: rnd(0.4, 0.8) });
        gsap.to(pe.body, { y: -p.h + rnd(40, 90), rotation: rnd(-200, 200), opacity: 0, duration: 1, onComplete: () => pe.remove() });
      }
    });
    o.remove();
    impact(); hit(V, t, c);
    for (let i = 0; i < 10; i++) {
      const pe = V.billboard('petal', em, T.x, T.y);
      gsap.set(pe.body, { y: -hT });
      gsap.to(pe, { x: T.x + rnd(-120, 120), y: T.y + rnd(-60, 60), duration: 1.1 });
      // petals pop up and drift down on light gravity, rocking as they fall
      gsap.to(pe.body, { skewX: 25, duration: 1.1, ease: EASE.flutter });
      toss(pe, { v: [180, 380], ang: [-150, -30], g: 500, dur: 1.1, spin: 300 });
    }
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  S.bounce = async (V, a, t, impact) => {
    const { v, A, C, c } = ctx(V, a, t);
    const tl = gsap.timeline();
    for (let i = 1; i <= 3; i++) {
      const P = { x: lerp(A.x, C.x, i / 3), y: lerp(A.y, C.y, i / 3) };
      tl.to(v.el, { x: P.x, y: P.y, duration: 0.26, ease: 'none' })
        .to(v.figure, { y: -120 - i * 30, duration: 0.13, ease: 'power2.out' }, '<')
        .to(v.figure, { y: 0, duration: 0.13, ease: 'power2.in' }, '>')
        .to(v.img, { scaleY: 0.8, scaleX: 1.15, duration: 0.06, yoyo: true, repeat: 1 })
        .call(() => { MB.audio.sfx('boing'); burst(V, P, c, 4, { h: 5, spread: 50 }); });
    }
    await tl;
    impact(); hit(V, t, c);
    await gsap.timeline()
      .to(v.el, { x: A.x, y: A.y, duration: 0.5, ease: 'power1.inOut' })
      .to(v.figure, { y: -140, duration: 0.25, ease: 'power2.out' }, 0)
      .to(v.figure, { y: 0, duration: 0.25, ease: 'bounce.out' }, 0.25);
  };

  S.bolt = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    await gsap.timeline().to(v.figure, { y: -40, duration: 0.3 }).to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.3)`, duration: 0.3 }, 0);
    const cloud = V.billboard('hex-cloud', '', T.x, T.y);
    cloud.body.style.setProperty('--c', c);
    gsap.set(cloud.body, { y: -470 });
    await gsap.fromTo(cloud.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
    for (let i = 0; i < 3; i++) {
      const bolt = V.billboard('bolt', lightningSvg(470 - hT * 0.3, c), T.x + rnd(-20, 20), T.y);
      gsap.set(bolt.body, { yPercent: -100, y: -hT * 0.3 });
      // the bolt forks down from the cloud (DrawSVG), then strikes
      await draw(bolt.body.querySelectorAll('.d'), { duration: 0.07, ease: 'power1.in' });
      MB.audio.sfx('thunder');
      if (i === 0) { impact(); hit(V, t, c, true); cracks(V, T, '#1a1030', { n: 6, len: 120, w: 5, glow: c, hold: 0.8 }); }
      else { flash(V, T, hT, c); burst(V, T, c, 8, { h: hT }); }
      V.shake(12);
      gsap.to(bolt.body, { opacity: 0, duration: 0.18, delay: 0.08, onComplete: () => bolt.remove() });
      await wait(0.12);
    }
    gsap.to(cloud.body, { opacity: 0, scale: 1.5, duration: 0.4, onComplete: () => cloud.remove() });
    await gsap.timeline().to(v.figure, { y: 0, duration: 0.3 }).to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' }, 0);
  };

  function lightningSvg(h, c) {
    let x = 30, pts = `${x},0`;
    const forks = [];
    for (let y = 0; y < h; y += rnd(18, 40)) {
      x = 30 + rnd(-24, 24); pts += ` ${x},${y}`;
      // side forks that split off the main bolt partway down
      if (y > h * 0.15 && y < h * 0.8 && Math.random() < 0.14) {
        let fx = x, fy = y, f = `${fx},${fy}`;
        const dir = MB.pick([-1, 1]);
        for (let k = 0; k < 3; k++) { fx += dir * rnd(10, 26); fy += rnd(14, 30); f += ` ${fx.toFixed(0)},${fy.toFixed(0)}`; }
        forks.push(f);
      }
    }
    pts += ` 30,${h}`;
    const line = (p, w, col, op = 1) => `<polyline class="d" points="${p}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"/>`;
    return `<svg width="60" height="${h}" viewBox="0 0 60 ${h}">${forks.map((f) => line(f, 5, c, 0.6) + line(f, 1.5, '#fff')).join('')}${line(pts, 9, c, 0.7)}${line(pts, 3, '#fff')}</svg>`;
  }

  S.spin = async (V, a, t, impact) => {
    const { v, A, C, perp, c } = ctx(V, a, t);
    MB.audio.sfx('wind');
    const curve = (P0, P1, side) => (k) => ({ x: lerp(P0.x, P1.x, k) + perp.x * side * Math.sin(Math.PI * k), y: lerp(P0.y, P1.y, k) + perp.y * side * Math.sin(Math.PI * k) });
    const out = curve(A, C, 130), o = { k: 0 };
    await gsap.timeline()
      .to(o, { k: 1, duration: 0.55, ease: 'power2.in', onUpdate: () => { gsap.set(v.el, out(o.k)); ghost(V, v, c); } })
      .to(v.figure, { rotationY: 1080, duration: 0.55, ease: 'power2.in' }, 0);
    impact(); hit(V, t, c);
    const back = curve(C, A, -130); o.k = 0;
    await gsap.timeline()
      .to(o, { k: 1, duration: 0.55, ease: 'power2.out', onUpdate: () => gsap.set(v.el, back(o.k)) })
      .to(v.figure, { rotationY: 1800, duration: 0.55, ease: 'power2.out' }, 0)
      .set(v.figure, { rotationY: 0 });
  };

  S.boomerang = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const pan = V.billboard('thrown', a.card.attack.emoji || '🍳', A.x, A.y);
    await gsap.to(v.figure, { rotation: -8, duration: 0.2 });
    MB.audio.sfx('zip');
    gsap.to(v.figure, { rotation: 6, duration: 0.15 });
    await path(pan, (k) => ({ ...arc(A, T, hA, hT, 90, 220, perp)(k), r: k * 900 }), 0.6, 'sine.in');
    impact(); hit(V, t, c); MB.audio.sfx('slam');
    MB.audio.sfx('zip');
    await path(pan, (k) => ({ ...arc(T, A, hT, hA, 90, 220, perp)(k), r: 900 + k * 900 }), 0.6, 'sine.out');
    pan.remove();
    await gsap.timeline().to(v.figure, { rotation: 0, duration: 0.2 }).to(v.img, { scaleY: 0.9, duration: 0.08, yoyo: true, repeat: 1 });
  };

  S.coins = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    V.emote(a, 'attack', 0);
    await gsap.to(v.figure, { y: -30, duration: 0.25 });
    let first = true;
    const drops = [];
    for (let i = 0; i < 22; i++) {
      const P = { x: T.x + rnd(-70, 70), y: T.y + rnd(-30, 30) };
      const coin = V.billboard('coin', '', P.x, P.y);
      gsap.set(coin.body, { y: -700 - rnd(0, 200) });
      drops.push(wait(i * 0.035).then(() => gsap.to(coin.body, { y: -hT * rnd(0.2, 1.2), rotationY: rnd(540, 1080), duration: 0.45, ease: 'power2.in' }).then(() => {
        if (first) { first = false; impact(); hit(V, t, c, true); }
        if (i % 3 === 0) MB.audio.sfx('coin');
        burst(V, P, c, 2, { h: hT * 0.5, spread: 40 });
        // coins ping off the target and scatter under gravity
        gsap.to(coin.body, { rotationY: '+=720', duration: 0.8, ease: 'none' });
        toss(coin, { v: [240, 460], ang: [-160, -20], g: 1600, dur: 0.8, spin: 90 });
      })));
    }
    await Promise.all(drops);
    ring(V, T, c, 2.4);
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  S.frost = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const cone = V.billboard('thrown', a.card.attack.emoji || '🍦', A.x, A.y);
    await gsap.to(v.figure, { rotation: -10, duration: 0.18 });
    gsap.to(v.figure, { rotation: 0, duration: 0.2 });
    MB.audio.sfx('frost');
    await path(cone, (k) => ({ ...arc(A, T, hA, hT, 230)(k), r: k * 540 }), 0.65, 'power1.in', (p) => {
      if (Math.random() < 0.5) { const s = dot(V, p, p.h, '#dff9ff', 8, 'spark shard'); gsap.to(s.body, { y: -p.h + 40, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
    });
    cone.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('shatter');
    burst(V, T, '#ffffff', 10, { h: hT, spread: 130, shape: 'shard' });
    debris(V, T, '#dff9ff', 10, { h: hT * 0.6, spread: 160 });
    const fr = V.flat('frost-floor', '', T.x, T.y);
    gsap.fromTo(fr, { scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => fr.remove() });
    // the floor freezes over in a web of ice cracks
    cracks(V, T, '#f2fdff', { n: 10, len: 160, w: 4, glow: '#6fd6ff', hold: 1 });
    for (let i = 0; i < 6; i++) {
      const f = V.billboard('petal', '❄', T.x + rnd(-60, 60), T.y);
      gsap.set(f.body, { y: -rnd(20, hT * 1.6) });
      gsap.to(f.body, { x: rnd(14, 26), duration: 1.1, ease: EASE.flutter });
      gsap.to(f.body, { y: '-=80', rotation: 180, opacity: 0, duration: 1.1, delay: i * 0.05, onComplete: () => f.remove() });
    }
    await wait(0.3);
  };

  S.wave = async (V, a, t, impact) => {
    const { v, A, T, d, c } = ctx(V, a, t);
    await gsap.to(v.figure, { y: -20, duration: 0.2 });
    const w = V.billboard('wave', '<div class="foam"></div>', A.x + d.x * 40, A.y + d.y * 40);
    gsap.set(w.body, { yPercent: -100, y: 10 });
    MB.audio.sfx('wave');
    const from = { x: A.x + d.x * 40, y: A.y + d.y * 40 };
    await path(w, (k) => ({ x: lerp(from.x, T.x, k), y: lerp(from.y, T.y, k), h: -10, s: 0.5 + k * 0.9 }), 0.8, 'power1.in', (p) => {
      if (Math.random() < 0.6) { const dr = dot(V, p, rnd(20, 90), '#bfe9ff', rnd(5, 10)); gsap.to(dr.body, { y: `+=${rnd(-80, 10)}`, opacity: 0, duration: 0.6, onComplete: () => dr.remove() }); }
    });
    impact(); hit(V, t, c, true); MB.audio.sfx('splash');
    gsap.to(w.body, { scaleY: 1.8, opacity: 0, duration: 0.4, onComplete: () => w.remove() });
    // the splash throws droplets up that rain back down (Physics2D)
    debris(V, T, '#bfe9ff', 20, { h: 20, spread: 220 });
    puff(V, T, '#e8f7ff', 5, 30, 0.9);
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  S.slash = async (V, a, t, impact) => {
    const { v, A, T, perp, hT, c } = ctx(V, a, t);
    const side = { x: T.x + perp.x * 120, y: T.y + perp.y * 120 };
    MB.audio.sfx('swish');
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.12 });
    gsap.set(v.el, side);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.1 });
    for (let i = 0; i < 3; i++) {
      slashArc(V, T, -hT, c, -40 + i * 50 + rnd(-10, 10));
      MB.audio.sfx('swish');
      if (i === 0) { impact(); hit(V, t, c); } else burst(V, T, c, 6, { h: hT, spread: 70 });
      gsap.fromTo(v.figure, { x: -perp.x * 20 }, { x: 0, duration: 0.12 });
      await wait(0.12);
    }
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
    gsap.set(v.el, A);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.15 });
  };

  // generic: a shower of attack.emoji comes down on the target
  S.shower = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t), em = a.card.attack.emoji || '⭐';
    V.emote(a, 'attack', 0);
    await gsap.to(v.figure, { y: -30, duration: 0.25 });
    let first = true;
    const drops = [];
    for (let i = 0; i < 16; i++) {
      const P = { x: T.x + rnd(-80, 80), y: T.y + rnd(-30, 30) };
      const d = V.billboard('thrown', em, P.x, P.y);
      gsap.set(d.body, { y: -700 - rnd(0, 200), rotation: rnd(-60, 60) });
      drops.push(wait(i * 0.045).then(() => gsap.to(d.body, { y: -hT * rnd(0.2, 1.1), rotation: `+=${rnd(-200, 200)}`, duration: 0.45, ease: 'power2.in' }).then(() => {
        if (first) { first = false; impact(); hit(V, t, c, true); }
        if (i % 4 === 0) MB.audio.sfx('hit');
        burst(V, P, c, 3, { h: hT * 0.5, spread: 50 });
        toss(d, { v: [200, 420], ang: [-160, -20], g: 1600, dur: 0.7 });
      })));
    }
    await Promise.all(drops);
    ring(V, T, c, 2.2);
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  // generic: winds up and shouts; the words (attack.shout, or the attack name) fly over and burst on the target
  S.shout = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT, c } = ctx(V, a, t), words = (a.card.attack.shout || a.card.attack.name || 'HA!').toUpperCase();
    await gsap.timeline().to(v.figure, { x: -d.x * 20, rotation: -d.x * 8, duration: 0.25 }).to(v.img, { scaleY: 1.08, duration: 0.25 }, 0);
    gsap.to(v.figure, { x: d.x * 16, rotation: d.x * 6, duration: 0.12 });
    MB.audio.sfx('whoosh');
    const w = V.billboard('float-text ability', words, A.x, A.y);
    w.body.style.color = c;
    await path(w, (k) => ({ ...arc(A, T, hA + 30, hT, 60)(k), s: 0.8 + k * 0.8 }), 0.5, 'power2.in');
    impact(); hit(V, t, c, true); V.shake(12);
    ring(V, T, c, 2, 0.5); ring(V, T, '#ffffff', 1.4, 0.4);
    gsap.to(w.body, { scale: 2.6, opacity: 0, duration: 0.35, onComplete: () => w.remove() });
    await gsap.timeline().to(v.figure, { x: 0, rotation: 0, duration: 0.3 }).to(v.img, { scaleY: 1, duration: 0.3 }, 0);
  };

  // ---------------------------------------------------------------- Infernal Harmony styles

  // flame columns licking up from the floor (also used for Burn ticks)
  function pillar(V, p, color, cls = 'pillar') {
    const f = V.billboard(cls, '', p.x, p.y);
    f.body.style.setProperty('--c', color);
    gsap.set(f.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    return f;
  }
  function flameBurst(V, p, h) {
    for (let i = 0; i < 3; i++) {
      const f = pillar(V, { x: p.x + rnd(-45, 45), y: p.y + rnd(-10, 10) }, '#ff5a1f', 'pillar small');
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: rnd(0.7, 1.1), duration: 0.2, delay: i * 0.06, ease: 'power2.out' });
      gsap.to(f.body, { opacity: 0, scaleX: 0.2, duration: 0.35, delay: 0.3 + i * 0.06, onComplete: () => f.remove() });
    }
    burst(V, p, '#ffb347', 8, { h: h * 0.4, spread: 60 });
  }

  const glowUp = (v, c, y) => gsap.timeline().to(v.figure, { y, duration: 0.3, ease: 'power2.out' })
    .to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.25)`, duration: 0.3 }, 0);
  const glowDown = (v) => gsap.timeline().to(v.figure, { y: 0, duration: 0.3 })
    .to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' }, 0);

  S.hellfire = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    await glowUp(v, c, -40);
    // a hell circle is drawn into the floor under the target (DrawSVG), then the flames come up through it
    MB.audio.sfx('fire');
    const circle = runeCircle(V, T, c, { size: 250 });
    await wait(0.55);
    for (let i = 0; i < 5; i++) {
      const P = i === 0 ? T : { x: T.x + rnd(-75, 75), y: T.y + rnd(-30, 30) };
      const f = pillar(V, P, c);
      gsap.fromTo(f.body, { scaleY: 0, scaleX: 0.6 }, { scaleY: rnd(0.8, 1.2), scaleX: 1, duration: 0.18, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => f.remove() });
      if (i === 0) { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); } else { burst(V, P, '#ffb347', 6, { h: hT, spread: 60 }); MB.audio.sfx('burn'); }
      V.shake(8);
      await wait(0.1);
    }
    rise(V, T, '#ffb347', 14, hT * 1.5);
    debris(V, T, '#ff8a2a', 10, { spread: 160 });
    circle.remove();
    await wait(0.3);
    await glowDown(v);
  };

  S.halo = async (V, a, t, impact) => {
    const { v, T, c } = ctx(V, a, t);
    const H = V.heightOf(t);
    await glowUp(v, c, -50);
    MB.audio.sfx('sparkle');
    const halo = V.billboard('halo-ring', '', T.x, T.y);
    halo.body.style.setProperty('--c', c);
    gsap.set(halo.body, { y: -H - 420, scale: 0.4, opacity: 0 });
    await gsap.to(halo.body, { y: -H - 30, scale: 1, opacity: 1, duration: 0.55, ease: 'power2.out' });
    await gsap.to(halo.body, { rotation: 8, duration: 0.08, yoyo: true, repeat: 3 });
    const beam = pillar(V, T, c, 'sky-beam');
    MB.audio.sfx('choir');
    gsap.to(halo.body, { y: -H * 0.2, scale: 1.8, opacity: 0, duration: 0.25, ease: 'power3.in' });
    await gsap.fromTo(beam.body, { scaleX: 0 }, { scaleX: 1, duration: 0.15, ease: 'power2.out' });
    impact(); hit(V, t, c, true); ring(V, T, '#ffffff', 2.4, 0.7); V.shake(12);
    for (let i = 0; i < 10; i++) {
      const f = V.billboard('petal', '🪶', T.x + rnd(-80, 80), T.y + rnd(-20, 20));
      gsap.set(f.body, { y: -rnd(H * 0.6, H * 1.5), rotation: rnd(-60, 60) });
      const dur = rnd(1, 1.6);
      // feathers see-saw as they drift down
      gsap.to(f.body, { x: rnd(20, 40), rotation: `+=${rnd(20, 40)}`, duration: dur, ease: EASE.flutter });
      gsap.to(f.body, { y: `+=${rnd(80, 160)}`, opacity: 0, duration: dur, ease: 'sine.in', onComplete: () => f.remove() });
    }
    await gsap.to(beam.body, { scaleX: 0, opacity: 0, duration: 0.4, delay: 0.2 });
    beam.remove(); halo.remove();
    await glowDown(v);
  };

  S.uppercut = async (V, a, t, impact) => {
    const { v, A, T, C, c } = ctx(V, a, t);
    const tv = V.ents.get(t.uid);
    const huh = own(a, 'cry', 'HUH?!') && V.billboard('float-text ability', 'HUH?!', A.x, A.y);
    if (huh) {
      gsap.set(huh.body, { y: -V.heightOf(a) - 40 });
      gsap.to(huh.body, { y: '-=60', scale: 1.4, opacity: 0, duration: 0.8, onComplete: () => huh.remove() });
    }
    await gsap.to(v.img, { scaleY: 0.75, scaleX: 1.2, duration: 0.25, ease: 'power2.out' });
    MB.audio.sfx('whistleUp');
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.2, ease: 'power3.in', onUpdate: () => ghost(V, v, c) })
      .to(v.img, { scaleY: 0.85, scaleX: 1.1, duration: 0.2 }, 0);
    gsap.to(v.img, { scaleY: 1.25, scaleX: 0.85, duration: 0.12, ease: 'power3.out' });
    gsap.to(v.figure, { y: -60, duration: 0.12 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16);
    if (tv) {
      await gsap.timeline()
        .to(tv.figure, { y: -260, rotation: rnd(-25, 25), duration: 0.35, ease: 'power2.out', overwrite: 'auto' })
        .to(tv.figure, { y: 0, rotation: 0, duration: 0.35, ease: 'bounce.out' });
    } else await wait(0.6);
    // they land hard: the floor cracks and throws up rubble and dust
    cracks(V, T, '#2b1d12', { n: 7, len: 130, w: 6, glow: c });
    debris(V, T, '#c9b79c', 10, { spread: 170 });
    puff(V, T, '#d9ccb4', 5, 10);
    ring(V, T, c, 2);
    await goHome(v, A);
  };

  S.heartbreak = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    await gsap.to(v.figure, { rotation: -6, duration: 0.15, yoyo: true, repeat: 1 });
    const h = V.billboard('thrown', '💗', A.x, A.y);
    MB.audio.sfx('sparkle');
    await path(h, (k) => ({ ...arc(A, T, hA, hT + 60, 140, -80, perp)(k), r: Math.sin(k * Math.PI * 4) * 15, s: 0.6 + k * 0.6 }), 0.7, 'sine.inOut', (p) => {
      if (Math.random() < 0.3) { const s = dot(V, p, p.h, c, 8); gsap.to(s.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => s.remove() }); }
    });
    await gsap.to(h.body, { scale: 1.7, duration: 0.14, yoyo: true, repeat: 1 });
    MB.AttackArt.setText(h.body, '💔');
    impact(); hit(V, t, c); MB.audio.sfx('hit');
    // the broken heart's shards spill down under gravity
    debris(V, T, c, 10, { h: hT + 60, spread: 150 });
    pop(V, T, hT + 130, own(a, 'finish', 'B-BAKA!'), 'float-text baka', 1);
    gsap.to(h.body, { opacity: 0, y: '+=60', duration: 0.5, onComplete: () => h.remove() });
    await wait(0.5);
  };

  S.pages = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const book = V.billboard('thrown', '📖', A.x, A.y);
    gsap.set(book.body, { y: -hA - 110, scale: 0 });
    await gsap.to(book.body, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(book.body, { rotation: 8, duration: 0.1, yoyo: true, repeat: 7 });
    MB.audio.sfx('whoosh');
    let first = true;
    const shots = [];
    for (let i = 0; i < 10; i++) {
      const pg = V.billboard('page', '', A.x, A.y);
      pg.body.style.setProperty('--c', c);
      const TT = { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) }, peak = rnd(60, 160), side = rnd(-160, 160), spin = rnd(-540, 540);
      shots.push(wait(i * 0.06).then(() => path(pg, (k) => ({ ...arc(A, TT, hA + 110, hT, peak, side, perp)(k), r: k * spin }), 0.55, 'power1.in').then(() => {
        // pages glance off and flutter down
        gsap.to(pg.body, { rotationX: 160, duration: 0.9, ease: EASE.flutter });
        toss(pg, { v: [140, 320], ang: [-150, -30], g: 600, dur: 0.9, spin: 180 });
        if (first) { first = false; impact(); hit(V, t, c); } else { burst(V, TT, '#ffffff', 3, { h: hT, spread: 40 }); if (i % 3 === 0) MB.audio.sfx('draw'); }
      })));
    }
    await Promise.all(shots);
    pop(V, T, hT + 90, own(a, 'finish', 'Shhh!'));
    await gsap.to(book.body, { scale: 0, duration: 0.25 });
    book.remove();
  };

  S.paint = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    await gsap.to(v.figure, { rotation: -10, duration: 0.2 });
    gsap.to(v.figure, { rotation: 0, duration: 0.3, ease: 'back.out(3)' });
    let first = true;
    await Promise.all([c, '#ff4fa3', '#ffd23f', '#7dff8a'].map((col, i) => wait(i * 0.12).then(async () => {
      const blob = V.billboard('paint-blob', '', A.x, A.y);
      blob.body.style.setProperty('--c', col);
      MB.audio.sfx('whoosh');
      const TT = { x: T.x + rnd(-45, 45), y: T.y + rnd(-18, 18) }, h = hT * rnd(0.5, 1.2), side = rnd(-120, 120);
      await path(blob, (k) => ({ ...arc(A, TT, hA, h, 150, side, perp)(k), r: k * 360, s: 0.7 + k * 0.5 }), 0.55, 'power1.in');
      blob.remove();
      if (first) { first = false; impact(); hit(V, t, col); } else flash(V, TT, h, col, 120);
      MB.audio.sfx('splat');
      const sp = V.flat('splat', '', TT.x + rnd(-20, 20), TT.y + rnd(-10, 10));
      sp.style.setProperty('--c', col);
      gsap.fromTo(sp, { scale: 0.1, rotation: rnd(0, 360), opacity: 0.9 }, { scale: rnd(0.8, 1.2), duration: 0.25, ease: 'back.out(3)' });
      gsap.to(sp, { opacity: 0, duration: 0.6, delay: 1.3, onComplete: () => sp.remove() });
      burst(V, TT, col, 8, { h, spread: 90 });
    })));
    await wait(0.2);
  };

  // Jay: paints a rough spike on a canvas in close-up, returns to his slot, and leaves a real spike over the enemy.
  S.paintspike = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), art = MB.AttackArt.jay;
    const face = T.x < 590 ? -1 : 1, P = A;
    const nodes = [], cut = document.createElement('div');
    const cameraHome = { scale: gsap.getProperty(V.camera, 'scale'), x: gsap.getProperty(V.camera, 'x'), y: gsap.getProperty(V.camera, 'y') };
    const painterHTML = `<div class="jay-painter" role="img" aria-label="Jay painting with his back turned" style="background-image:url('${art.frames}')"></div>`;
    // Atlas cells share the same body anchor. The extra 38px includes frame 2's full brush;
    // the right column's empty left gutter excludes neighboring brush tips, never any part of Jay.
    const pose = (node, frame) => {
      node.dataset.paintFrame = frame;
      node.style.backgroundPosition = `${frame % 2 ? 480 / 474 * 100 : 0}% ${frame >= 2 ? 100 : 0}%`;
      node.style.clipPath = frame % 2 ? 'inset(0 0 0 13%)' : 'none';
    };
    const spikeHTML = `<img src="${art.spike}" alt="A painted steel spike pointing down">`;
    cut.className = 'jay-paint-cut'; cut.dataset.jayPhase = 'paint';
    cut.innerHTML = `<div class="jay-paint-caption">Just a little finishing touch...</div><div class="jay-paint-stage"><div class="jay-spike-art"><div class="jay-canvas"></div><img class="jay-sketch" src="${art.sketch}" alt="Jay's rough painted spike on canvas"><img class="jay-solid" src="${art.spike}" alt="The painted spike becoming real"></div>${painterHTML}</div>`;
    const stage = cut.querySelector('.jay-paint-stage'), closeJay = stage.querySelector('.jay-painter');
    const closeSpike = stage.querySelector('.jay-spike-art'), stroke = { frame: 0 };
    const canvas = closeSpike.querySelector('.jay-canvas'), sketch = closeSpike.querySelector('.jay-sketch'), solid = closeSpike.querySelector('.jay-solid');
    const caption = cut.querySelector('.jay-paint-caption');
    let painter, spike;
    const rectInUi = (node) => {
      const b = node.getBoundingClientRect(), p = V.toUi(b.left + b.width / 2, b.top + b.height / 2);
      const scale = V.root.getBoundingClientRect().width / 1600;
      return { x: p.x, y: p.y, width: b.width / scale, height: b.height / scale };
    };
    try {
      await MB.preloadImages(Object.values(art));
      V.root.appendChild(cut);
      gsap.set(stage, { x: 620, y: 350 });
      gsap.set(closeJay, { width: 430, height: 600, x: face > 0 ? -450 : 20, y: -185, scaleX: face });
      pose(closeJay, 0);
      gsap.set(closeSpike, { width: 240, height: 360, x: -120, y: -180 });
      gsap.set(sketch, { clipPath: 'inset(0% 0% 100% 0%)' });
      gsap.set(solid, { opacity: 0 });
      await gsap.fromTo(cut, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.set(v.figure, { opacity: 0 });
      MB.audio.sfx('draw');
      // Each frame is a complete, naturally drawn pose. The shoulder, sleeve and elbow stay connected.
      await gsap.timeline()
        .to(stroke, { frame: 3, duration: 1.42, ease: 'none', onUpdate: () => pose(closeJay, Math.min(3, Math.floor(stroke.frame + 0.3))) })
        .to(sketch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.42, ease: 'none' }, 0)
        .to(closeJay, { x: face > 0 ? -403 : -26, y: -75, duration: 0.85, ease: 'sine.inOut' }, 0.57)
        .to(closeJay, { rotation: 2, duration: 0.7, yoyo: true, repeat: 1 }, 0);
      MB.audio.sfx('splat');
      caption.textContent = 'And... done!';
      await wait(0.45); // let the completed, still-flat canvas painting read before the reveal
      // Pull back the board too, leaving sky for a readable drop even above the enemy leader.
      await gsap.to(V.camera, { scale: 0.88, x: 0, y: 55, duration: 0.25, ease: 'sine.inOut' });

      painter = V.billboard('', painterHTML, P.x, P.y); nodes.push(painter);
      painter.dataset.jayPhase = 'painting-pose';
      painter.body.style.width = '179.167px'; painter.body.style.height = '250px';
      const boardJay = painter.body.querySelector('.jay-painter');
      boardJay.style.width = '100%'; boardJay.style.height = '100%';
      gsap.set(boardJay, { scaleX: face });
      pose(boardJay, 3);
      gsap.set(painter.body, { y: -125, opacity: 0 });
      spike = V.billboard('jay-spike-art', spikeHTML, T.x, T.y); nodes.push(spike);
      spike.dataset.jayPhase = 'hover';
      let spikeHeight = 180, hoverHeight = hT + spikeHeight * 0.43 + 100;
      spike.body.style.width = spikeHeight * 2 / 3 + 'px'; spike.body.style.height = spikeHeight + 'px';
      gsap.set(spike.body, { y: -hoverHeight, opacity: 0 });
      // Adapt the hover to the actual projected viewport; the far row and leader have less sky available.
      const hoverBox = spike.body.getBoundingClientRect(), screenScale = hoverBox.height / 180;
      if (hoverBox.top < 85) {
        spikeHeight = Math.max(80, spikeHeight - (85 - hoverBox.top) / (0.93 * Math.max(0.1, screenScale)));
        spike.body.style.width = spikeHeight * 2 / 3 + 'px'; spike.body.style.height = spikeHeight + 'px';
        hoverHeight = hT + spikeHeight * 0.43 + 100;
        gsap.set(spike.body, { y: -hoverHeight });
        const box = spike.body.getBoundingClientRect();
        if (box.top < 85) hoverHeight -= (85 - box.top) / Math.max(0.1, screenScale);
      }
      gsap.set(spike.body, { y: -hoverHeight });
      const s = rectInUi(spike.body), p = rectInUi(painter.body);
      cut.dataset.jayPhase = 'reveal';
      // Jay shrinks back to his own slot while the canvas peels away and the drawing gains solid steel facets.
      await gsap.timeline()
        .to(stage, { x: 0, y: 0, duration: 0.85, ease: 'power2.inOut' })
        .to(closeSpike, { x: s.x - s.width / 2, y: s.y - s.height / 2, width: s.width, height: s.height,
          duration: 0.85, ease: 'power2.inOut' }, 0)
        .to(closeJay, { x: p.x - p.width / 2, y: p.y - p.height / 2, width: p.width, height: p.height,
          rotation: 0, scaleX: face, duration: 0.85, ease: 'power2.inOut' }, 0)
        .to(canvas, { opacity: 0, duration: 0.4 }, 0.15)
        .to(sketch, { opacity: 0, duration: 0.45 }, 0.3)
        .to(solid, { opacity: 1, duration: 0.45 }, 0.3)
        .to(caption, { opacity: 0, duration: 0.35 }, 0.25)
        .to(cut, { '--veil': 0, duration: 0.85 }, 0);
      gsap.set([painter.body, spike.body], { opacity: 1 });
      cut.remove();
      MB.audio.sfx('glint');
      // Jay remains back in his slot; the solid spike hangs for a beat, then accelerates straight down.
      await wait(0.5);
      spike.dataset.jayPhase = 'fall';
      MB.audio.sfx('whistleDown');
      // The generated tip is at (50%, 93%) in its PNG. Land that point on the target's visual center.
      await gsap.to(spike.body, { y: -hT - spikeHeight * 0.43, duration: 0.42, ease: 'power3.in' });
      spike.dataset.jayPhase = 'contact';
      impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('splat'); V.shake(11);
      ring(V, T, c, 1.6); burst(V, T, c, 10, { h: hT, spread: 65 });
      await wait(0.16);
      await Promise.all([
        gsap.to(spike.body, { opacity: 0, duration: 0.25 }),
        gsap.to(painter.body, { opacity: 0, duration: 0.3 }),
      ]);
      // He turns back to us with a proud toothy grin after his masterpiece lands.
      painter.body.classList.add('jay-proud-art');
      painter.body.innerHTML = `<img src="${art.proud}" alt="Jay grinning proudly with his teeth showing">`;
      painter.body.style.width = '200px'; painter.body.style.height = '300px';
      painter.dataset.jayPhase = 'proud';
      gsap.set(painter.body, { y: -150, rotation: 0, scale: 0.94 });
      await gsap.to(painter.body, { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.4)' });
      pop(V, A, 325, 'Heh. Nailed it!', 'float-text ability', 1);
      await wait(1.05);
      await Promise.all([
        gsap.to(painter.body, { opacity: 0, duration: 0.25 }),
        gsap.to(v.figure, { opacity: 1, duration: 0.25 }),
      ]);
    } finally {
      gsap.killTweensOf([cut, stage, closeJay, closeSpike, stroke, caption, canvas, sketch, solid]); cut.remove();
      nodes.forEach((node) => { gsap.killTweensOf(node.body); node.remove(); });
      gsap.set(v.figure, { x: 0, y: 0, rotation: 0, opacity: 1 });
      gsap.set(v.el, { x: A.x, y: A.y }); gsap.set(v.img, { scaleX: 1, scaleY: 1 });
      gsap.to(V.camera, { ...cameraHome, duration: 0.4, ease: 'sine.inOut' });
    }
  };

  S.stumble = async (V, a, t, impact) => {
    const { v, A, T, C, d, perp, hA, hT, c } = ctx(V, a, t);
    const hic = (x, y) => {
      const b = V.billboard('float-text hic', '*hic*', x, y);
      gsap.set(b.body, { y: -hA - 60, scale: 0.7 });
      gsap.to(b.body, { y: '-=70', rotation: rnd(-20, 20), opacity: 0, duration: 0.9, onComplete: () => b.remove() });
      MB.audio.sfx('squeak');
    };
    hic(A.x, A.y);
    const at = (k) => { const w = Math.sin(k * Math.PI * 3) * 45; return { x: lerp(A.x, C.x, k) + perp.x * w, y: lerp(A.y, C.y, k) + perp.y * w }; };
    const o = { k: 0 };
    const sway = gsap.fromTo(v.figure, { rotation: -10 }, { rotation: 10, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await gsap.to(o, { k: 1, duration: 0.9, ease: 'power1.in', onUpdate: () => gsap.set(v.el, at(o.k)) });
    sway.kill();
    await gsap.to(v.figure, { rotation: d.x >= 0 ? 24 : -24, duration: 0.12, ease: 'power2.in' });
    impact(); hit(V, t, c); MB.audio.sfx('slam'); gsap.delayedCall(0.3, () => MB.audio.sfx('tweet')); V.shake(10);
    rise(V, T, '#fff3c4', 12, hT);
    hic(C.x, C.y);
    await gsap.to(v.figure, { rotation: 0, duration: 0.4, ease: 'elastic.out(1,0.4)' });
    await goHome(v, A, 0.6);
  };

  // ---------------------------------------------------------------- relationship duo styles
  // a duo's figure holds two sprites that can move on their own
  const duo = (v) => (v.img.children.length === 2 ? [...v.img.children] : [v.img, v.img]);
  const resetDuo = (v) => { if (v.img.children.length === 2) gsap.set(duo(v), { clearProps: 'transform,filter' }); };
  // text/emoji that pops above a point and floats off
  function pop(V, p, h, html, cls = 'float-text ability', dur = 0.9) {
    if (html == null) return; // a line the card replaced (own)
    const b = V.billboard(cls, html, p.x, p.y);
    gsap.set(b.body, { y: -h });
    gsap.timeline({ onComplete: () => b.remove() })
      .fromTo(b.body, { scale: 0.2 }, { scale: 1.15, duration: 0.25, ease: 'back.out(3)' })
      .to(b.body, { y: -h - 60, opacity: 0, duration: dur * 0.6 }, dur * 0.4);
    return b;
  }
  // emoji flying out from a point in all directions
  function scatter(V, T, h, chars, n, spread = 160) {
    for (let i = 0; i < n; i++) {
      const b = V.billboard('petal', MB.pick(chars), T.x, T.y);
      const ang = rnd(0, Math.PI * 2), r = rnd(spread * 0.4, spread);
      gsap.set(b.body, { y: -h, scale: rnd(0.8, 1.5) });
      gsap.to(b, { x: T.x + Math.cos(ang) * r, y: T.y + Math.sin(ang) * r * 0.7, duration: 1.05, ease: 'power2.out' });
      gsap.to(b.body, { keyframes: [{ y: -h - rnd(60, 200), duration: 0.45, ease: 'power2.out' }, { y: -rnd(0, 40), opacity: 0, duration: 0.6, ease: 'power2.in' }],
        rotation: rnd(-200, 200), onComplete: () => b.remove() });
    }
  }

  // Tier 1: tag-team — one partner leaps in, the other spins after
  // Art & Books: Jay creates the route; Janice crawls up with her books and accidentally delivers them from above.
  S.bookstairs = async (V, a, t, impact) => {
    const r = ctx(V, a, t), { v, A, T, hT, c } = r, art = MB.AttackArt.artBooks;
    const face = T.x < 590 ? -1 : 1, nodes = [], stroke = { frame: 0 };
    const cameraHome = { scale: gsap.getProperty(V.camera, 'scale'), x: gsap.getProperty(V.camera, 'x'), y: gsap.getProperty(V.camera, 'y') };
    const parts = duo(v), savedParts = parts.map(p => ({ opacity: gsap.getProperty(p, 'opacity') }));
    const land = lander(V, t, impact, r, { big: true });
    let sceneScale = 1, step = 0, janiceFrame = 0;
    const jay = V.billboard('art-books-pose art-books-jay', '', T.x - face * 365, T.y + 65);
    jay.body.style.backgroundImage = `url('${art.jay}')`; jay.dataset.artBooksPhase = 'paint'; nodes.push(jay);
    const janice = V.billboard('art-books-pose art-books-janice', '', T.x - face * 275, T.y + 45);
    janice.body.style.backgroundImage = `url('${art.janice}')`; janice.dataset.artBooksPhase = 'carry'; nodes.push(janice);
    const stairPath = 'M345 35 H290 V70 H235 V105 H180 V140 H125 V175 H70 V210 H15';
    const stairs = V.billboard('art-books-stairs', `<svg viewBox="0 0 360 210" aria-label="Jay's painted staircase">
      <path class="stair-solid" d="M15 210 H70 V175 H125 V140 H180 V105 H235 V70 H290 V35 H345 V210 Z"/>
      <path class="stair-tread" fill="none" d="M70 175 H125 M125 140 H180 M180 105 H235 M235 70 H290 M290 35 H345"/>
      <path class="stair-ink" d="${stairPath}"/></svg>`, T.x - face * 137.5, T.y + 45);
    stairs.dataset.artBooksPhase = 'draw'; nodes.push(stairs);
    const solids = stairs.body.querySelectorAll('.stair-solid, .stair-tread'), ink = stairs.body.querySelector('.stair-ink');
    const poseJay = (frame) => {
      jay.dataset.paintFrame = frame;
      jay.body.style.backgroundPosition = `${frame % 2 ? 100 : 0}% ${frame >= 2 ? 100 : 0}%`;
    };
    const poseJanice = (frame) => {
      janiceFrame = frame; janice.dataset.climbFrame = frame;
      const rowH = frame < 2 ? 768 : 562, height = 215 * sceneScale * rowH / 591;
      janice.body.style.width = 215 * sceneScale + 'px'; janice.body.style.height = height + 'px';
      janice.body.style.backgroundSize = `200% ${1330 / rowH * 100}%`;
      janice.body.style.backgroundPosition = `${frame % 2 ? 100 : 0}% ${frame >= 2 ? 100 : 0}%`;
      // The atlas contains full upright and kneeling poses at the same pixel scale, each with its own floor baseline.
      gsap.set(janice.body, { y: -step * 35 * sceneScale - (0.96 - 0.5) * height, scaleX: face });
    };
    const placeScene = () => {
      gsap.set(jay, { x: T.x - face * 365 * sceneScale, y: T.y + 65 });
      jay.body.style.width = 150 * sceneScale + 'px'; jay.body.style.height = 225 * sceneScale + 'px';
      gsap.set(jay.body, { y: -112.5 * sceneScale, scaleX: face });
      gsap.set(stairs, { x: T.x - face * 137.5 * sceneScale, y: T.y + 45 });
      stairs.body.style.width = 360 * sceneScale + 'px'; stairs.body.style.height = 210 * sceneScale + 'px';
      gsap.set(stairs.body, { y: -105 * sceneScale, scaleX: face });
      gsap.set(janice, { x: T.x - face * 275 * sceneScale, y: T.y + 45 }); poseJanice(janiceFrame);
    };
    const cleanup = () => {
      nodes.forEach(node => { gsap.killTweensOf(node); gsap.killTweensOf(node.body); node.remove(); });
      gsap.killTweensOf(stroke); gsap.killTweensOf([ink, ...solids]);
      gsap.set(v.figure, { x: 0, y: 0, rotation: 0, opacity: 1 });
      parts.forEach((p, i) => gsap.set(p, { opacity: savedParts[i].opacity }));
      gsap.set(v.el, { x: A.x, y: A.y }); gsap.set(v.img, { scaleX: 1, scaleY: 1 });
      gsap.to(V.camera, { ...cameraHome, duration: 0.45, ease: 'sine.inOut' });
    };
    try {
      gsap.set([jay.body, janice.body, stairs.body], { opacity: 0 });
      await MB.preloadImages(Object.values(art));
      // Stop the wrapper's focus tween so it cannot override this attack's framing.
      gsap.killTweensOf(V.camera, 'scale,x,y');
      await gsap.to(V.camera, { scale: 0.82, x: 0, y: 70, duration: 0.4, ease: 'sine.inOut' });
      poseJay(0); placeScene();
      // Fit both the taller upright climb and the top-step crawling pose, leaving room for their hop.
      const climbTop = () => {
        step = 1; poseJanice(1); const uprightTop = janice.body.getBoundingClientRect().top;
        step = 5; poseJanice(2);
        return Math.min(uprightTop, janice.body.getBoundingClientRect().top);
      };
      while (climbTop() < 75 && sceneScale > 0.58) {
        sceneScale -= 0.06; placeScene();
      }
      step = 0; poseJanice(0); placeScene();
      gsap.set(solids, { opacity: 0 });
      const length = ink.getTotalLength(); ink.style.strokeDasharray = length; ink.style.strokeDashoffset = length;
      await Promise.all([
        gsap.to(v.figure, { opacity: 0, duration: 0.18 }),
        gsap.to([jay.body, janice.body, stairs.body], { opacity: 1, duration: 0.25 }),
      ]);
      pop(V, { x: T.x - face * 285 * sceneScale, y: T.y + 45 }, 255 * sceneScale, 'Jay: I’ll make a shortcut!', 'float-text ability', 1);
      MB.audio.sfx('draw');
      await gsap.timeline()
        .to(stroke, { frame: 3, duration: 1.15, ease: 'none', onUpdate: () => poseJay(Math.min(3, Math.floor(stroke.frame + 0.3))) })
        .to(ink, { strokeDashoffset: 0, duration: 1.15, ease: 'none' }, 0)
        .to(solids, { opacity: 1, duration: 0.4 }, 0.75);
      stairs.dataset.artBooksPhase = 'solid'; MB.audio.sfx('glint');
      await wait(0.18);
      janice.dataset.artBooksPhase = 'climb';
      // She climbs on her knees, moving onto each actual tread rather than floating across the staircase.
      for (let i = 1; i <= 5; i++) {
        poseJanice(i === 1 ? 1 : 2);
        const height = parseFloat(janice.body.style.height), fromHeight = step * 35 * sceneScale;
        const toHeight = i * 35 * sceneScale;
        const move = { k: 0 }, fromX = T.x - face * (275 - step * 55) * sceneScale;
        const toX = T.x - face * (275 - i * 55) * sceneScale;
        await gsap.to(move, { k: 1, duration: 0.3, ease: 'sine.inOut', onUpdate: () => {
          gsap.set(janice, { x: lerp(fromX, toX, move.k) });
          gsap.set(janice.body, { y: -lerp(fromHeight, toHeight, move.k) - 0.46 * height - 8 * sceneScale * Math.sin(Math.PI * move.k) });
        } });
        step = i; MB.audio.sfx('draw', { vol: 0.2 });
        await wait(0.08);
      }
      janice.dataset.artBooksPhase = 'balance';
      await gsap.to(janice.body, { rotation: face * 5, duration: 0.12, yoyo: true, repeat: 1 });
      await wait(0.2);
      // Her book-carrying pose changes to the complete empty-handed pose exactly as the books leave her arms.
      janice.dataset.artBooksPhase = 'drop'; poseJanice(3);
      const bookStart = { x: T.x + face * 62 * sceneScale, y: T.y + 45 };
      const bookHeight = Math.max(270 * sceneScale, hT + 60 * sceneScale);
      MB.audio.sfx('gasp');
      const books = Array.from({ length: 3 }, (_, i) => {
        const book = V.billboard('thrown art-books-book', '📖', bookStart.x, bookStart.y);
        book.body.style.fontSize = 64 * sceneScale + 'px'; book.dataset.artBooksPhase = 'book-fall';
        book.dataset.book = i; gsap.set(book.body, { y: -bookHeight - i * 12 * sceneScale, rotation: face * (i - 1) * 8 });
        nodes.push(book); return book;
      });
      await Promise.all(books.map((book, i) => wait(i * 0.11).then(async () => {
        MB.audio.sfx('whoosh', { vol: 0.4 });
        // Every book reaches the target center before its corresponding contact effect.
        await path(book, k => ({ x: lerp(bookStart.x, T.x, k), y: lerp(bookStart.y, T.y, k),
          h: lerp(bookHeight + i * 12 * sceneScale, hT, k), r: face * (i * 9 + k * 95) }), 0.48, 'power2.in');
        book.dataset.artBooksPhase = 'book-contact';
        land(i); MB.audio.sfx('bonk');
        await gsap.to(book.body, { y: '-=15', rotation: `+=${face * 25}`, opacity: 0, duration: 0.2 });
        book.remove();
      })));
      janice.dataset.artBooksPhase = 'reaction';
      pop(V, T, hT + 90, 'Janice: ...Those were heavy.', 'float-text ability', 1);
      await wait(0.5);
      await gsap.to([janice.body, jay.body, stairs.body], { opacity: 0, duration: 0.3 });
      await gsap.to(v.figure, { opacity: 1, duration: 0.25 });
    } finally { cleanup(); }
  };

  S.combo = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), em = a.card.attack.emoji || '💞';
    await gsap.to([L, R], { y: -40, duration: 0.14, stagger: 0.08, yoyo: true, repeat: 1, ease: 'power2.out' });
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.24, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    await gsap.timeline().to(L, { y: -120, rotation: -16, duration: 0.18, ease: 'power2.out' }).to(L, { y: 0, rotation: 10, duration: 0.12, ease: 'power3.in' });
    impact(); hit(V, t, c); pop(V, T, hT + 40, em, 'thrown');
    gsap.to(L, { rotation: 0, duration: 0.2 });
    MB.audio.sfx('whoosh');
    await gsap.to(R, { rotationY: 360, x: -24, duration: 0.3, ease: 'power2.in' });
    gsap.set(R, { rotationY: 0 });
    flash(V, T, hT, c, 220); burst(V, T, c, 16, { h: hT }); ring(V, T, c, 1.6); MB.audio.sfx('hit', true); V.shake(10);
    pop(V, C, V.heightOf(a) + 30, 'TEAMWORK!');
    await wait(0.25);
    resetDuo(v);
    await goHome(v, A);
  };

  // Ghan Dojo: alternating karate flurry, then a double dive kick
  S.dojo = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    pop(V, A, V.heightOf(a) + 30, 'OSU!');
    await gsap.to(v.img, { scaleY: 0.85, scaleX: 1.1, duration: 0.2 });
    MB.audio.sfx('whoosh');
    await gsap.timeline().to(v.el, { x: C.x, y: C.y, duration: 0.2, ease: 'power3.in', onUpdate: () => ghost(V, v, c) }).to(v.img, { scaleY: 1, scaleX: 1, duration: 0.2 }, 0);
    const cries = ['HAI!', 'SEI!', 'YAH!'];
    for (let i = 0; i < 6; i++) {
      const img = i % 2 ? R : L, dir = i % 2 ? -1 : 1;
      await gsap.timeline().to(img, { x: dir * 26, y: -30, rotation: dir * 18, duration: 0.07, ease: 'power2.in' }).to(img, { x: 0, y: 0, rotation: 0, duration: 0.08 });
      slashArc(V, T, -hT, c, rnd(-80, 80));
      if (i === 0) { impact(); hit(V, t, c); } else { burst(V, T, c, 5, { h: hT, spread: 60 }); MB.audio.sfx('pow'); }
      if (i % 2 === 0) pop(V, { x: T.x + rnd(-60, 60), y: T.y }, hT + 60, cries[i / 2]);
      V.shake(5);
    }
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.figure, { y: -300, duration: 0.3, ease: 'power2.out' })
      .to([L, R], { rotation: (i) => (i ? -25 : 25), duration: 0.3 }, 0)
      .to(v.figure, { y: 0, duration: 0.18, ease: 'power4.in' });
    hit(V, t, c, true); MB.audio.sfx('kick'); MB.audio.sfx('slam'); V.shake(22);
    ring(V, T, '#ffffff', 2.6, 0.7); burst(V, T, '#c9b79c', 20, { h: 10, spread: 200 });
    pop(V, T, hT + 80, 'KIAI!!', 'float-text baka');
    await wait(0.2);
    resetDuo(v);
    await goHome(v, A);
  };

  // Happily Married: a spiralling waltz around the target, then a wedding ring drops
  S.waltz = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    const d0 = Math.atan2(C.y - T.y, C.x - T.x), r0 = Math.hypot(C.x - T.x, C.y - T.y);
    MB.audio.sfx('sparkle');
    await gsap.timeline().to(v.el, { x: C.x, y: C.y, duration: 0.4, ease: 'power2.inOut' }).to(v.figure, { rotationY: 360, duration: 0.4 }, 0).set(v.figure, { rotationY: 0 });
    const o = { k: 0 };
    let last = 0;
    await gsap.to(o, { k: 1, duration: 1, ease: 'sine.inOut', onUpdate: () => {
      const ang = d0 + o.k * Math.PI * 2, r = r0 + 90 * Math.sin(o.k * Math.PI);
      const p = { x: T.x + Math.cos(ang) * r, y: T.y + Math.sin(ang) * r };
      gsap.set(v.el, p);
      gsap.set(v.figure, { rotationY: o.k * 720 });
      if (o.k - last > 0.05) {
        last = o.k;
        const h = V.billboard('petal', '💗', p.x, p.y);
        gsap.set(h.body, { y: -rnd(40, 160), scale: rnd(0.6, 1) });
        gsap.to(h.body, { y: '-=60', opacity: 0, duration: 0.9, onComplete: () => h.remove() });
      }
    } });
    gsap.set(v.figure, { rotationY: 0 });
    await gsap.to(v.figure, { rotation: -16, duration: 0.2 });
    const ringE = V.billboard('thrown big', '💍', T.x, T.y);
    gsap.set(ringE.body, { y: -720 });
    MB.audio.sfx('whoosh');
    await gsap.to(ringE.body, { y: -hT, rotation: 360, duration: 0.45, ease: 'power2.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14);
    for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.15, () => ring(V, T, i % 2 ? '#ffffff' : c, 1.6 + i * 0.6, 0.7));
    scatter(V, T, hT, ['💗', '💕', '✨'], 12, 140);
    gsap.to(ringE.body, { scale: 2, opacity: 0, duration: 0.5, onComplete: () => ringE.remove() });
    pop(V, T, hT + 70, 'FOREVER ♥', 'float-text buff');
    await wait(0.35);
    gsap.to(v.figure, { rotation: 0, duration: 0.3 });
    await goHome(v, A);
  };

  // Jones Fortune: a slot machine rolls 7-7-7 over the target and pays out in coins
  S.jackpot = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    const [, R] = duo(v);
    V.emote(a, 'attack', 0);
    const slot = V.billboard('slot-machine', '<i>💰</i><i>💎</i><i>🍒</i>', T.x, T.y);
    gsap.set(slot.body, { y: -hT - 190 });
    await gsap.fromTo(slot.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(R, { rotationY: 1080, duration: 1.1, ease: 'power1.inOut' }); // skate spin while the reels roll
    const reels = [...slot.body.children], icons = ['💰', '💎', '🍒', '🔔', '⭐', '7️⃣'];
    const roll = setInterval(() => reels.forEach((r) => { if (!r.dataset.stop) MB.AttackArt.setText(r, MB.pick(icons)); }), 60);
    for (let i = 0; i < 3; i++) {
      await wait(0.3);
      reels[i].dataset.stop = 1; reels[i].textContent = '7️⃣';
      gsap.fromTo(reels[i], { scale: 1.6 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
      MB.audio.sfx('coin');
    }
    clearInterval(roll);
    gsap.set(R, { rotationY: 0 });
    pop(V, T, hT + 280, 'JACKPOT!', 'float-text buff', 1.2);
    MB.audio.sfx('sparkle'); MB.audio.sfx('kaching');
    let first = true;
    const drops = [];
    for (let i = 0; i < 30; i++) {
      const P = { x: T.x + rnd(-80, 80), y: T.y + rnd(-35, 35) };
      const coin = V.billboard('coin', '', P.x, P.y);
      gsap.set(coin.body, { y: -hT - 160 - rnd(0, 120), opacity: 0 });
      drops.push(wait(i * 0.03).then(() => gsap.to(coin.body, { y: -hT * rnd(0.2, 1.2), opacity: 1, rotationY: rnd(540, 1080), duration: 0.4, ease: 'power2.in' }).then(() => {
        if (first) { first = false; impact(); hit(V, t, c, true); }
        if (i % 3 === 0) MB.audio.sfx('coin');
        burst(V, P, c, 2, { h: hT * 0.5, spread: 40 });
        // coins ping off the target and scatter under gravity
        gsap.to(coin.body, { rotationY: '+=720', duration: 0.8, ease: 'none' });
        toss(coin, { v: [240, 460], ang: [-160, -20], g: 1600, dur: 0.8, spin: 90 });
      })));
    }
    await Promise.all(drops);
    ring(V, T, c, 2.6); V.shake(12);
    gsap.to(slot.body, { opacity: 0, scale: 0.5, duration: 0.3, onComplete: () => slot.remove() });
    resetDuo(v);
    await wait(0.2);
  };

  // Hunley Holiday: snow falls, a giant present drops and bursts into a group hug
  S.miracle = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    await glowUp(v, c, -40);
    for (let i = 0; i < 26; i++) {
      const f = V.billboard('petal', '❄', rnd(100, 1080), rnd(80, 640));
      gsap.set(f.body, { y: -rnd(300, 600), opacity: 0 });
      gsap.to(f.body, { y: `+=${rnd(200, 350)}`, opacity: 1, rotation: rnd(-180, 180), duration: rnd(1.4, 2.2), ease: 'none' });
      gsap.to(f.body, { opacity: 0, duration: 0.4, delay: 1.8, onComplete: () => f.remove() });
    }
    MB.audio.sfx('sparkle');
    gsap.to([L, R], { rotation: (i) => (i ? -8 : 8), duration: 0.3, yoyo: true, repeat: 1 });
    const gift = V.billboard('thrown big', '🎁', T.x, T.y);
    gsap.set(gift.body, { y: -900, scale: 1.6 });
    MB.audio.sfx('whoosh');
    await gsap.to(gift.body, { y: -hT - 40, duration: 0.6, ease: 'bounce.out' });
    for (let i = 0; i < 3; i++) { MB.audio.sfx('pop'); await gsap.fromTo(gift.body, { rotation: -10 }, { rotation: 10, duration: 0.07, yoyo: true, repeat: 1 }); }
    await gsap.to(gift.body, { scale: 2.3, duration: 0.12 });
    gift.remove();
    impact(); hit(V, t, c, true); flash(V, T, hT, '#ffffff', 420); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    ring(V, T, c, 3, 0.8); ring(V, T, '#ffffff', 2.2, 0.6); ring(V, T, '#5fd068', 3.6, 1);
    scatter(V, T, hT, ['❤', '⭐', '❄', '🎀', '💚'], 26, 190);
    pop(V, T, hT + 90, 'GROUP HUG!', 'float-text heal', 1.2);
    gsap.to(V.board, { '--tilt': (V.tilt + 5) + 'deg', duration: 0.1, yoyo: true, repeat: 1 });
    await wait(0.5);
    resetDuo(v);
    await glowDown(v);
  };

  // Infernal Harmony: hellfire and holy light spiral in, then a twin helix beam
  S.harmony = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT } = ctx(V, a, t);
    const [L, R] = duo(v), RED = '#ff4a1c', GOLD = '#ffe9a0';
    await gsap.timeline().to(v.figure, { y: -60, duration: 0.35, ease: 'power2.out' })
      .to(L, { filter: `drop-shadow(0 0 18px ${RED}) brightness(1.25)`, duration: 0.35 }, 0)
      .to(R, { filter: `drop-shadow(0 0 18px ${GOLD}) brightness(1.25)`, duration: 0.35 }, 0);
    const sig = V.flat('sigil', '', T.x, T.y);
    sig.style.setProperty('--c', '#ff7ad9');
    MB.audio.sfx('holy');
    await gsap.fromTo(sig, { scale: 0, opacity: 0 }, { scale: 1.3, rotation: 180, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
    gsap.to(sig, { rotation: '+=540', duration: 3, ease: 'none' });
    for (let i = 0; i < 8; i++) {
      const ang = i * 1.3, rr = 150 - i * 16, P = { x: T.x + Math.cos(ang) * rr, y: T.y + Math.sin(ang) * rr * 0.6 };
      const hell = i % 2 === 0;
      const f = pillar(V, P, hell ? RED : GOLD, hell ? 'pillar' : 'sky-beam slim');
      gsap.fromTo(f.body, { scaleY: 0, scaleX: 0.5 }, { scaleY: hell ? rnd(0.7, 1) : 0.5, scaleX: 1, duration: 0.15, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.35, delay: 0.25, onComplete: () => f.remove() });
      burst(V, P, hell ? '#ffb347' : '#ffffff', 5, { h: 60, spread: 50 });
      MB.audio.sfx(hell ? 'burn' : 'sparkle'); V.shake(5);
      await wait(0.09);
    }
    const O = { x: A.x + d.x * 30, y: A.y + d.y * 30 }, perp = { x: -d.y, y: d.x }, N = Math.max(18, Math.round(d.len / 18)), segs = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      for (const s of [1, -1]) {
        const w = Math.sin(k * Math.PI * 3) * 26 * s;
        const seg = dot(V, { x: lerp(O.x, T.x, k) + perp.x * w, y: lerp(O.y, T.y, k) + perp.y * w }, lerp(hA + 60, hT, k) + w * 0.5, s > 0 ? RED : GOLD, 34, 'beam-seg');
        gsap.set(seg.body, { scale: 0 });
        segs.push(seg);
      }
    }
    MB.audio.sfx('fire');
    await gsap.to(segs.map((s) => s.body), { scale: 1, duration: 0.08, stagger: 0.006, ease: 'power2.out' });
    impact(); hit(V, t, '#ff7ad9', true); flash(V, T, hT, '#ffffff', 460); V.hitStop(); MB.audio.sfx('slam'); V.shake(26);
    ring(V, T, RED, 3.2, 0.9); ring(V, T, GOLD, 2.4, 0.7);
    rise(V, T, RED, 12, hT * 1.5); rise(V, T, GOLD, 12, hT * 1.5);
    scatter(V, T, hT, ['🪶', '🔥', '✨'], 14, 150);
    pop(V, T, hT + 100, 'HARMONY!', 'float-text burn', 1.1);
    gsap.to(V.board, { '--tilt': (V.tilt + 5) + 'deg', duration: 0.1, yoyo: true, repeat: 1 });
    await gsap.to(segs.map((s) => s.body), { scale: () => rnd(0.7, 1.3), duration: 0.06, repeat: 5, yoyo: true });
    await gsap.to(segs.map((s) => s.body), { scale: 0, opacity: 0, duration: 0.25, stagger: 0.003 });
    segs.forEach((s) => s.remove());
    gsap.to(sig, { opacity: 0, scale: 1.8, duration: 0.5, onComplete: () => sig.remove() });
    resetDuo(v);
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  // Gothic Love: a blood moon rises, a bat swarm dives in, a black heart shatters into purple lightning
  S.gothic = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    const gloom = V.flat('gloom-floor', '', T.x, T.y);
    gsap.fromTo(gloom, { scale: 0.2, opacity: 0 }, { scale: 2.4, opacity: 1, duration: 0.6, ease: 'power2.out' });
    await gsap.timeline().to(v.figure, { y: -30, duration: 0.3 }).to([L, R], { x: (i) => (i ? -18 : 18), duration: 0.3 }, 0) // lean in together
      .to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(0.9) saturate(1.3)`, duration: 0.3 }, 0);
    const moon = V.billboard('blood-moon', '', T.x, T.y);
    gsap.set(moon.body, { y: -hT - 120, scale: 0, opacity: 0 });
    MB.audio.sfx('dark');
    await gsap.to(moon.body, { y: -hT - 300, scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' });
    let first = true;
    const bats = [];
    for (let i = 0; i < 12; i++) {
      const b = V.billboard('thrown bat', '🦇', A.x + rnd(-60, 60), A.y);
      const side = rnd(-220, 220), peak = rnd(120, 260), TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-12, 12) };
      bats.push(wait(i * 0.06).then(() => path(b, (k) => ({ ...arc(A, TT, hA + rnd(0, 60), hT, peak, side, perp)(k), r: Math.sin(k * Math.PI * 6) * 25, s: 0.5 + k * 0.5 }), 0.6, 'power1.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); MB.audio.sfx('hit'); } else { burst(V, TT, c, 4, { h: hT, spread: 50 }); if (i % 3 === 0) MB.audio.sfx('whoosh'); }
      })));
    }
    await Promise.all(bats);
    const heart = V.billboard('thrown big', '🖤', T.x, T.y);
    gsap.set(heart.body, { y: -hT - 20 });
    await gsap.fromTo(heart.body, { scale: 0.2 }, { scale: 1.3, duration: 0.25, ease: 'back.out(3)' });
    await gsap.to(heart.body, { rotation: 8, duration: 0.05, yoyo: true, repeat: 5 });
    heart.remove();
    for (let i = 0; i < 2; i++) {
      const bolt = V.billboard('bolt', lightningSvg(520 - hT * 0.3, c), T.x + rnd(-25, 25), T.y);
      gsap.set(bolt.body, { yPercent: -100, y: -hT * 0.3 });
      await draw(bolt.body.querySelectorAll('.d'), { duration: 0.07, ease: 'power1.in' });
      MB.audio.sfx('thunder'); V.shake(14);
      flash(V, T, hT, i ? '#ffffff' : c, 300);
      gsap.to(bolt.body, { opacity: 0, duration: 0.2, delay: 0.1, onComplete: () => bolt.remove() });
      await wait(0.14);
    }
    hit(V, t, c, true); V.hitStop(); MB.audio.sfx('slam');
    ring(V, T, c, 3, 0.9); ring(V, T, '#ff2a4a', 2.2, 0.7);
    scatter(V, T, hT, ['🥀', '🖤', '🦇', '💜'], 18, 170);
    pop(V, T, hT + 100, 'FOREVER YOURS', 'float-text debuff', 1.2);
    await wait(0.4);
    gsap.to(moon.body, { opacity: 0, y: '-=60', duration: 0.5, onComplete: () => moon.remove() });
    gsap.to(gloom, { opacity: 0, duration: 0.6, onComplete: () => gloom.remove() });
    resetDuo(v);
    await gsap.timeline().to(v.figure, { y: 0, duration: 0.3 }).to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1) saturate(1)', duration: 0.3, clearProps: 'filter' }, 0);
  };

  // Sleepover Besties: the two take turns lobbing pillows, feathers everywhere
  S.sleepover = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    pop(V, A, V.heightOf(a) + 30, 'PILLOW FIGHT!', 'float-text baka');
    let first = true;
    for (let i = 0; i < 6; i++) {
      const img = i % 2 ? R : L, dir = i % 2 ? -1 : 1;
      gsap.timeline().to(img, { rotation: -dir * 14, y: -24, duration: 0.1 }).to(img, { rotation: dir * 10, y: 0, duration: 0.12 }).to(img, { rotation: 0, duration: 0.15 });
      const pw = V.billboard('pillow', '', A.x + dir * 40, A.y);
      pw.body.style.setProperty('--c', c);
      const TT = { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) }, spin = rnd(-540, 540);
      MB.audio.sfx('whoosh');
      path(pw, (k) => ({ ...arc({ x: A.x + dir * 40, y: A.y }, TT, hA, hT * rnd(0.6, 1.1), rnd(100, 200), dir * 120, perp)(k), r: k * spin }), 0.5, 'power1.in').then(() => {
        pw.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, TT, hT, '#ffffff', 140); MB.audio.sfx('bonk'); }
        for (let k = 0; k < 5; k++) {
          const f = V.billboard('petal', '🪶', TT.x, TT.y);
          gsap.set(f.body, { y: -hT, scale: rnd(0.5, 0.9) });
          gsap.to(f, { x: TT.x + rnd(-110, 110), y: TT.y + rnd(-40, 40), duration: 1.4 });
          gsap.to(f.body, { y: -rnd(0, 30), rotation: rnd(-240, 240), opacity: 0, duration: 1.4, ease: 'sine.in', onComplete: () => f.remove() });
        }
        V.shake(5);
      });
      await wait(0.16);
    }
    await wait(0.55);
    await gsap.to([L, R], { y: -60, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }); // high five jump
    pop(V, A, V.heightOf(a) + 20, '✋ BESTIES! ✋');
    ring(V, T, c, 2);
    resetDuo(v);
    await wait(0.2);
  };

  // Sister Party: a disco ball drops, the floor lights up, confetti and balloons fly
  S.party = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    const ball = V.billboard('thrown big', '🪩', T.x, T.y);
    gsap.set(ball.body, { y: -760 });
    MB.audio.sfx('sparkle');
    await gsap.to(ball.body, { y: -hT - 220, duration: 0.5, ease: 'bounce.out' });
    gsap.to(ball.body, { rotationY: 720, duration: 1.8, ease: 'none' });
    const lights = ['#ff5d8f', '#ffe066', '#5fd0ff', '#7dff8a', '#c58cff'];
    const dance = gsap.to([L, R], { y: -30, rotation: (i) => (i ? -8 : 8), duration: 0.18, yoyo: true, repeat: 7, stagger: 0.09, ease: 'sine.inOut' });
    for (let i = 0; i < 6; i++) {
      const spot = V.flat('disco-spot', '', T.x + rnd(-150, 150), T.y + rnd(-70, 70));
      spot.style.setProperty('--c', lights[i % lights.length]);
      gsap.fromTo(spot, { scale: 0.3, opacity: 0.9 }, { scale: 1.4, opacity: 0, duration: 0.45, onComplete: () => spot.remove() });
      MB.audio.sfx('pop');
      await wait(0.12);
    }
    let first = true;
    const all = [];
    for (let i = 0; i < 18; i++) {
      const s = V.billboard('confetti', '', A.x, A.y);
      s.body.style.background = lights[i % lights.length];
      const TT = { x: T.x + rnd(-60, 60), y: T.y + rnd(-25, 25) };
      all.push(wait(i * 0.03).then(() => path(s, (k) => ({ ...arc(A, TT, hA, hT, rnd(120, 220), rnd(-120, 120), perp)(k), r: k * 900 }), 0.55, 'power1.in').then(() => {
        s.remove();
        if (first) { first = false; impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12); }
      })));
    }
    MB.audio.sfx('whoosh');
    await Promise.all(all);
    dance.progress(1).kill();
    for (let i = 0; i < 8; i++) {
      const b = V.billboard('petal', '🎈', T.x + rnd(-120, 120), T.y + rnd(-40, 40));
      gsap.set(b.body, { y: -rnd(0, 60), scale: rnd(1, 1.6) });
      gsap.to(b.body, { y: `-=${rnd(260, 420)}`, rotation: rnd(-20, 20), duration: rnd(1.4, 2), ease: 'sine.in' });
      gsap.to(b.body, { opacity: 0, duration: 0.4, delay: 1.3, onComplete: () => b.remove() });
    }
    ring(V, T, c, 2.6); ring(V, T, '#ffe066', 1.8);
    pop(V, T, hT + 90, "LET'S PARTY!", 'float-text buff', 1.1);
    gsap.to(ball.body, { y: -900, duration: 0.6, delay: 0.5, ease: 'power2.in', onComplete: () => ball.remove() });
    resetDuo(v);
    await wait(0.6);
  };

  // Mr Dino's lessons: a chalkboard grades the target, chalk barrage, then the ruler comes down
  S.lesson = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    const board = V.billboard('chalkboard', 'F-', T.x, T.y);
    gsap.set(board.body, { y: -hT - 200 });
    pop(V, A, V.heightOf(a) + 30, 'HUH?! CLASS!');
    await gsap.fromTo(board.body, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
    MB.audio.sfx('click');
    gsap.to(R, { y: -40, duration: 0.12, yoyo: true, repeat: 3 }); // the student cheers along
    let first = true;
    const shots = [];
    for (let i = 0; i < 7; i++) {
      gsap.fromTo(L, { rotation: -12 }, { rotation: 0, duration: 0.12, delay: i * 0.08 });
      const ch = V.billboard('chalk', '', A.x, A.y);
      const TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-10, 10) };
      shots.push(wait(i * 0.08).then(() => path(ch, (k) => ({ ...arc(A, TT, hA + 40, hT, rnd(60, 130), rnd(-80, 80), perp)(k), r: k * 900 }), 0.4, 'power1.in').then(() => {
        ch.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else { burst(V, TT, '#ffffff', 4, { h: hT, spread: 40 }); if (i % 2) MB.audio.sfx('chalk'); }
      })));
    }
    await Promise.all(shots);
    const ruler = V.billboard('thrown big', '📏', T.x, T.y);
    gsap.set(ruler.body, { y: -hT - 160, rotation: -80 });
    MB.audio.sfx('whoosh');
    await gsap.to(ruler.body, { rotation: 40, y: -hT, duration: 0.18, ease: 'power3.in' });
    hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16);
    ring(V, T, '#ffffff', 2);
    pop(V, T, hT + 120, 'DETENTION!', 'float-text baka', 1.1);
    gsap.to(ruler.body, { opacity: 0, rotation: 70, duration: 0.3, onComplete: () => ruler.remove() });
    gsap.to(board.body, { opacity: 0, scale: 0.6, duration: 0.3, delay: 0.3, onComplete: () => board.remove() });
    resetDuo(v);
    await wait(0.5);
  };

  // Cheer and Chain: she cheers him up to full power, he lashes a chain around the target and yanks it
  S.cheerchain = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), H = V.heightOf(a), tv = V.ents.get(t.uid);
    const cheers = ['GO!', 'FIGHT!', 'WIN!'];
    await gsap.to(L, { scaleY: 0.9, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut' }); // crouch while the attack name shows
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('sparkle');
      gsap.timeline().to(L, { y: -70, rotation: i % 2 ? 10 : -10, duration: 0.14, ease: 'power2.out' }).to(L, { y: 0, rotation: 0, duration: 0.14, ease: 'power2.in' });
      for (const s of [-1, 1]) {
        const pp = V.billboard('pompom', '', A.x + s * 55, A.y);
        pp.body.style.setProperty('--c', c);
        gsap.set(pp.body, { y: -H * 0.62 });
        gsap.timeline({ onComplete: () => pp.remove() })
          .fromTo(pp.body, { scale: 0.3 }, { scale: 1.1, y: -H * 0.62 - 70, rotation: s * 40, duration: 0.18, ease: 'back.out(3)' })
          .to(pp.body, { scale: 0, opacity: 0, duration: 0.2, delay: 0.05 });
      }
      pop(V, { x: A.x + (i - 1) * 70, y: A.y }, H + 20, cheers[i], 'float-text buff', 0.7);
      rise(V, A, c, 5, H);
      // every cheer charges him up
      gsap.to(R, { filter: `drop-shadow(0 0 ${6 + i * 7}px ${c}) brightness(${1 + i * 0.12})`, duration: 0.2 });
      await wait(0.3);
    }
    await gsap.to(R, { rotation: -14, x: -10, duration: 0.18, ease: 'power2.out' }); // wind-up
    MB.audio.sfx('whoosh');
    gsap.to(R, { rotation: 10, x: 8, duration: 0.14, ease: 'power3.in' });
    // the chain: metal links along an arc, flung out one after another
    const O = { x: A.x + d.x * 40, y: A.y + d.y * 40 }, N = Math.max(12, Math.round(d.len / 26)), links = [];
    const line = arc(O, T, hA + 30, hT, 110, 60, perp);
    for (let i = 0; i <= N; i++) {
      const p = line(i / N), l = V.billboard('chain-link', '', p.x, p.y);
      l.body.style.setProperty('--c', c);
      gsap.set(l.body, { y: -p.h, rotation: (i % 2 ? 90 : 0) + d.x * 20, scale: 0 });
      links.push(l);
    }
    await gsap.to(links.map((l) => l.body), { scale: 1, duration: 0.07, stagger: 0.014, ease: 'back.out(3)' });
    impact(); hit(V, t, c); MB.audio.sfx('zap'); V.shake(8);
    // it coils around the target and locks
    const coil = [];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2, l = V.billboard('chain-link', '', T.x + Math.cos(ang) * 110, T.y + Math.sin(ang) * 40);
      l.body.style.setProperty('--c', c);
      gsap.set(l.body, { y: -hT - Math.sin(ang) * 30, rotation: (ang * 180) / Math.PI + 90, scale: 0 });
      coil.push({ l, ang });
    }
    await gsap.to(coil.map((k) => k.l.body), { scale: 1, duration: 0.06, stagger: 0.02 });
    MB.audio.sfx('click');
    await Promise.all(coil.map(({ l, ang }) => gsap.to(l, { x: T.x + Math.cos(ang) * 60, y: T.y + Math.sin(ang) * 22, duration: 0.18, ease: 'power3.in' })));
    const lock = V.billboard('thrown', '🔒', T.x, T.y);
    gsap.set(lock.body, { y: -hT - 10 });
    gsap.fromTo(lock.body, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(3)' });
    MB.audio.sfx('shield'); flash(V, T, hT, '#ffffff', 220);
    await wait(0.25);
    // yank!
    MB.audio.sfx('slam');
    gsap.to(R, { rotation: -18, x: -16, duration: 0.12, ease: 'power3.out' });
    if (tv) gsap.fromTo(tv.figure, { x: 0 }, { x: -d.x * 60, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
    hit(V, t, c, true); V.shake(18); V.hitStop();
    burst(V, T, '#dfe6f5', 18, { h: hT, spread: 150, shape: 'shard' });
    ring(V, T, c, 2.4); ring(V, T, '#ffffff', 1.6, 0.5);
    [...links, ...coil.map((k) => k.l)].forEach((l, i) => gsap.to(l.body, { y: `+=${rnd(-60, 60)}`, rotation: `+=${rnd(-180, 180)}`, opacity: 0, scale: 0.3, duration: 0.45, delay: i * 0.004, onComplete: () => l.remove() }));
    gsap.to(lock.body, { y: '-=50', opacity: 0, duration: 0.5, delay: 0.2, onComplete: () => lock.remove() });
    pop(V, T, hT + 110, 'CHEER & CHAIN!', 'float-text baka', 1.1);
    await wait(0.45);
    resetDuo(v);
  };

  // Lone Wolves: a full moon rises, father and son howl, a spirit wolf bounds over and claws the target
  S.howl = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), H = V.heightOf(a);
    const moon = V.billboard('full-moon', '', A.x, A.y);
    gsap.set(moon.body, { y: -H - 60, scale: 0, opacity: 0 });
    MB.audio.sfx('dark');
    await gsap.to(moon.body, { y: -H - 170, scale: 1, opacity: 1, duration: 0.45, ease: 'power2.out' });
    gsap.to([L, R], { rotation: (i) => (i ? 8 : -8), y: -14, duration: 0.2 }); // heads back
    pop(V, A, H + 40, 'AWOOO~!', 'float-text ability', 1.1);
    MB.audio.sfx('sparkle');
    await wait(0.35);
    gsap.to([L, R], { rotation: 0, y: 0, duration: 0.25 });
    const wolf = V.billboard('thrown big spirit', '🐺', A.x, A.y);
    wolf.body.style.setProperty('--c', c);
    MB.audio.sfx('whoosh');
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.6, ease: 'power1.in', onUpdate: () => {
      const k = o.k, p = { x: lerp(A.x, T.x, k), y: lerp(A.y, T.y, k) };
      gsap.set(wolf, p);
      gsap.set(wolf.body, { y: -60 - Math.abs(Math.sin(k * Math.PI * 3)) * 80, rotation: Math.cos(k * Math.PI * 6) * 12 });
      if (Math.random() < 0.6) { const s = dot(V, p, rnd(20, 90), c, rnd(6, 12)); gsap.to(s.body, { opacity: 0, scale: 0.2, y: '-=30', duration: 0.5, onComplete: () => s.remove() }); }
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14);
    for (let i = 0; i < 3; i++) {
      const cl = V.billboard('claw', '<i></i><i></i><i></i>', T.x, T.y);
      cl.body.style.setProperty('--c', c);
      gsap.set(cl.body, { y: -hT, rotation: -25 + i * 25 });
      gsap.fromTo(cl.body.children, { scaleY: 0 }, { scaleY: 1, duration: 0.12, stagger: 0.03, ease: 'power3.out' });
      gsap.to(cl.body, { opacity: 0, duration: 0.3, delay: 0.25, onComplete: () => cl.remove() });
      if (i) { burst(V, T, c, 6, { h: hT, spread: 70 }); MB.audio.sfx('bonk'); }
      await wait(0.12);
    }
    gsap.to(wolf.body, { opacity: 0, scale: 1.6, duration: 0.35, onComplete: () => wolf.remove() });
    pop(V, T, hT + 90, 'Wolf-ther knows best!', 'float-text hic', 1.1);
    await wait(0.45);
    pop(V, A, hA + 140, '...seriously, Dad?', 'float-text hic', 1);
    gsap.to(moon.body, { opacity: 0, y: '-=40', duration: 0.5, onComplete: () => moon.remove() });
    await wait(0.4);
    resetDuo(v);
  };

  // Sunshine & Gloom: a sun and a gloom orb spiral around each other all the way to the target
  S.twinstar = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), H = V.heightOf(a), SUN = '#ffcf3f', GLOOM = '#8a3cff';
    gsap.to(L, { y: -40, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }); // Hayley bounces...
    pop(V, { x: A.x - 60, y: A.y }, H + 20, 'Together!', 'float-text buff', 0.8);
    await wait(0.2);
    pop(V, { x: A.x + 60, y: A.y }, H + 60, '...fine.', 'float-text debuff', 0.8); // ...Kayla sighs
    const sun = V.billboard('sun-orb', '', A.x, A.y), moon = V.billboard('gloom-orb', '', A.x, A.y);
    gsap.set([sun.body, moon.body], { y: -hA - 40, scale: 0 });
    MB.audio.sfx('sparkle');
    await gsap.to([sun.body, moon.body], { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(sun.body, { rotation: 360, duration: 1, ease: 'none' });
    MB.audio.sfx('holy');
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.95, ease: 'power1.in', onUpdate: () => {
      const k = o.k, base = arc(A, T, hA + 40, hT, 120)(k), w = Math.cos(k * Math.PI * 4) * 55 * (1 - k * 0.6), z = Math.sin(k * Math.PI * 4) * 40 * (1 - k * 0.6);
      [[sun, 1, SUN], [moon, -1, GLOOM]].forEach(([b, s, col]) => {
        const p = { x: base.x + perp.x * w * s, y: base.y + perp.y * w * s };
        gsap.set(b, p); gsap.set(b.body, { y: -base.h - z * s });
        if (Math.random() < 0.5) { const tr = dot(V, p, base.h + z * s, col, rnd(6, 11)); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.45, onComplete: () => tr.remove() }); }
      });
    } });
    sun.remove(); moon.remove();
    impact(); hit(V, t, c, true); flash(V, T, hT, '#ffffff', 340); MB.audio.sfx('slam'); V.shake(16);
    ring(V, T, SUN, 2.4, 0.7); ring(V, T, GLOOM, 3, 0.9);
    const g = V.flat('gloom-floor', '', T.x, T.y);
    gsap.fromTo(g, { scale: 0.2, opacity: 1 }, { scale: 1.8, opacity: 0, duration: 1, ease: 'power2.out', onComplete: () => g.remove() });
    scatter(V, T, hT, ['☀️', '🌙', '✨', '💜'], 16, 160);
    pop(V, T, hT + 100, 'SISTER SYNC!', 'float-text debuff', 1.1);
    gsap.to([L, R], { x: (i) => (i ? -14 : 14), duration: 0.2, yoyo: true, repeat: 1 }); // a quick side hug
    await wait(0.6);
    resetDuo(v);
  };

  // Mother's Day: pancakes flip onto a growing stack, ice cream on top, and it all comes crashing down
  S.breakfast = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), H = V.heightOf(a);
    const pan = V.billboard('thrown', '🍳', A.x - 40, A.y);
    gsap.set(pan.body, { y: -H * 0.55 });
    await gsap.fromTo(pan.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 30, 'Breakfast time!', 'float-text heal', 0.9);
    const stack = [];
    for (let i = 0; i < 4; i++) {
      gsap.fromTo(pan.body, { rotation: -30 }, { rotation: 20, duration: 0.12, yoyo: true, repeat: 1 });
      gsap.to(L, { rotation: -6, duration: 0.1, yoyo: true, repeat: 1 });
      const pc = V.billboard('thrown', '🥞', A.x - 40, A.y);
      MB.audio.sfx('whoosh');
      const top = hT * 0.35 + i * 26;
      await path(pc, (k) => ({ ...arc({ x: A.x - 40, y: A.y }, T, H * 0.6, top, 170, (i % 2 ? 1 : -1) * 50, perp)(k), r: k * 720 }), 0.42, 'power1.in');
      gsap.set(pc.body, { rotation: 0 });
      gsap.fromTo(pc.body, { scaleY: 0.6 }, { scaleY: 1, duration: 0.2, ease: 'back.out(3)' });
      stack.push(pc);
      if (i === 0) { impact(); hit(V, t, c); } else { burst(V, T, '#ffd89a', 4, { h: top, spread: 50 }); MB.audio.sfx('splat'); }
    }
    gsap.to(pan.body, { scale: 0, duration: 0.2, onComplete: () => pan.remove() });
    // the kid's contribution: ice cream on top
    gsap.to(R, { y: -40, rotation: 8, duration: 0.14, yoyo: true, repeat: 1 });
    const ice = V.billboard('thrown', '🍨', A.x + 40, A.y);
    MB.audio.sfx('whoosh');
    const peak = hT * 0.35 + 4 * 26 + 20;
    await path(ice, (k) => ({ ...arc({ x: A.x + 40, y: A.y }, T, H * 0.6, peak, 220)(k), r: k * 360 }), 0.5, 'power1.in');
    MB.audio.sfx('freeze'); hit(V, t, c, true); V.shake(12);
    burst(V, T, '#ffffff', 14, { h: peak, spread: 120, shape: 'shard' });
    const fr = V.flat('frost-floor', '', T.x, T.y);
    gsap.fromTo(fr, { scale: 0.2, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1, ease: 'power2.out', onComplete: () => fr.remove() });
    await wait(0.15);
    // topple
    MB.audio.sfx('slam');
    [...stack, ice].forEach((p, i) => gsap.to(p.body, { y: `+=${rnd(40, 120)}`, x: `+=${rnd(-120, 120)}`, rotation: rnd(-200, 200), opacity: 0, duration: 0.6, delay: i * 0.03, ease: 'power2.in', onComplete: () => p.remove() }));
    const syrup = V.flat('splat', '', T.x, T.y);
    syrup.style.setProperty('--c', '#c9771f');
    gsap.fromTo(syrup, { scale: 0.1, opacity: 0.9 }, { scale: 1.1, duration: 0.25, ease: 'back.out(3)' });
    gsap.to(syrup, { opacity: 0, duration: 0.6, delay: 1.2, onComplete: () => syrup.remove() });
    scatter(V, T, hT, ['🍓', '🧈', '🥞', '❄'], 12, 150);
    pop(V, T, hT + 110, 'SERVED WITH LOVE!', 'float-text heal', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // Brier Tide: she whips up a whirlpool under the target, he surfs in on the wave
  S.riptide = async (V, a, t, impact) => {
    const { v, A, T, d, C, c } = ctx(V, a, t);
    const [L, R] = duo(v), tv = V.ents.get(t.uid), hT = V.heightOf(t) * 0.5;
    gsap.to(R, { y: -30, rotation: -8, duration: 0.2, yoyo: true, repeat: 1 }); // Zoe raises the tide
    const pool = V.flat('whirlpool', '', T.x, T.y);
    pool.style.setProperty('--c', c);
    MB.audio.sfx('splash');
    gsap.fromTo(pool, { scale: 0, opacity: 0 }, { scale: 1.3, opacity: 1, duration: 0.5, ease: 'power2.out' });
    const spin = gsap.to(pool, { rotation: '+=720', duration: 2.2, ease: 'none' });
    await wait(0.3);
    // ride the wave
    const w = V.billboard('wave', '<div class="foam"></div>', A.x, A.y);
    gsap.set(w.body, { yPercent: -100, y: 10, scale: 0.9 });
    MB.audio.sfx('splash');
    await gsap.timeline()
      .to(v.figure, { y: -70, duration: 0.2, ease: 'power2.out' })
      .to(L, { rotation: 10, duration: 0.2 }, 0)
      .to({ k: 0 }, { k: 1, duration: 0.6, ease: 'power1.in', onUpdate() {
        const k = this.targets()[0].k, p = { x: lerp(A.x, C.x, k), y: lerp(A.y, C.y, k) };
        gsap.set(v.el, p); gsap.set(w, { x: p.x - d.x * 20, y: p.y - d.y * 20 });
        gsap.set(w.body, { scale: 0.9 + k * 0.5 });
        if (Math.random() < 0.6) { const dr = dot(V, p, rnd(20, 90), '#bfe9ff', rnd(5, 10)); gsap.to(dr.body, { y: `+=${rnd(-80, 10)}`, opacity: 0, duration: 0.6, onComplete: () => dr.remove() }); }
        ghost(V, v, c);
      } });
    impact(); hit(V, t, c, true); MB.audio.sfx('wave'); MB.audio.sfx('slam'); V.shake(18);
    gsap.to(w.body, { scaleY: 2, opacity: 0, duration: 0.45, onComplete: () => w.remove() });
    // the whirlpool spins the target round
    if (tv) gsap.fromTo(tv.figure, { rotationY: 0 }, { rotationY: 720, duration: 0.8, ease: 'power2.out', clearProps: 'rotationY' });
    for (let i = 0; i < 22; i++) {
      const dr = dot(V, T, 20, '#bfe9ff', rnd(6, 13));
      const ang = rnd(0, Math.PI * 2);
      gsap.to(dr, { x: T.x + Math.cos(ang) * rnd(60, 150), y: T.y + Math.sin(ang) * rnd(30, 70), duration: 0.9 });
      gsap.to(dr.body, { keyframes: [{ y: -rnd(140, 300), duration: 0.45, ease: 'power2.out' }, { y: 0, opacity: 0, duration: 0.45, ease: 'power2.in' }], onComplete: () => dr.remove() });
    }
    ring(V, T, c, 2.6, 0.8); ring(V, T, '#ffffff', 1.8, 0.6);
    pop(V, T, hT + 120, 'RIPTIDE!', 'float-text shield', 1.1);
    await wait(0.35);
    gsap.to(pool, { scale: 0, opacity: 0, duration: 0.5, onComplete: () => { spin.kill(); pool.remove(); } });
    resetDuo(v);
    await goHome(v, A, 0.5);
  };

  // ---------------------------------------------------------------- Between the Peaks styles

  // Lisa: a long yawn, a drowsy cloud drifts over and puts the target to sleep
  S.yawn = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 20, own(a, 'cry', '*yaaawn*'), 'float-text hic', 1);
    await gsap.to(v.img, { scaleY: 0.9, scaleX: 1.06, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' });
    const z = V.billboard('thrown big', '💤', A.x, A.y);
    MB.audio.sfx('wobble');
    await path(z, (k) => ({ ...arc(A, T, hA + 40, hT + 20, 90, 70, perp)(k), r: Math.sin(k * Math.PI * 3) * 14, s: 0.5 + k * 0.7 }), 0.9, 'sine.inOut', (p) => {
      if (Math.random() < 0.2) {
        const s = V.billboard('float-text hic', 'z', p.x, p.y);
        gsap.set(s.body, { y: -p.h, scale: rnd(0.5, 0.9) });
        gsap.to(s.body, { y: '-=70', opacity: 0, duration: 0.8, onComplete: () => s.remove() });
      }
    });
    z.remove();
    impact(); hit(V, t, c); MB.audio.sfx('hit');
    const tv = V.ents.get(t.uid);
    if (tv) gsap.fromTo(tv.figure, { rotation: 0 }, { rotation: 8, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }); // the target nods off
    for (let i = 0; i < 3; i++) pop(V, { x: T.x + 30 + i * 25, y: T.y }, hT + 50 + i * 35, i % 2 ? 'z' : 'Z', 'float-text debuff', 0.9);
    await wait(0.5);
  };

  // Claire: "hello" in every language she knows, in bleu, blanc, rouge
  S.lingo = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const cols = [c, '#ffffff', '#ff4f5e'];
    await gsap.to(v.figure, { y: -20, duration: 0.15, yoyo: true, repeat: 1 });
    let first = true;
    await Promise.all((a.card.attack.words || ['Bonjour!', 'Hola!', 'Ciao!', 'Hallo!', 'Olá!', 'Hej!', 'Salut!']).map((w, i) => wait(i * 0.09).then(() => {
      const b = V.billboard('float-text ability', w, A.x, A.y), col = cols[i % 3];
      b.body.style.color = col;
      const TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-12, 12) };
      MB.audio.sfx('click');
      return path(b, (k) => ({ ...arc(A, TT, hA + 40, hT, rnd(80, 180), rnd(-140, 140), perp)(k), s: 0.6 + k * 0.5 }), 0.55, 'power1.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, col, 5, { h: hT, spread: 60 });
      });
    })));
    ring(V, T, c, 1.8); ring(V, T, '#ff4f5e', 1.3);
    pop(V, T, hT + 100, own(a, 'finish', 'Voilà!'), 'float-text buff', 1);
    await wait(0.3);
  };

  // Betty: two quick cuts in an X, like the scar across her face
  S.scar = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.28, ease: 'power3.in', onUpdate: () => ghost(V, v, c) })
      .to(v.figure, { rotation: d.x * 10, duration: 0.28 }, 0);
    for (let i = 0; i < 2; i++) {
      slashArc(V, T, -hT, c, i ? 45 : -45);
      gsap.fromTo(v.figure, { x: i ? 20 : -20 }, { x: 0, duration: 0.15 });
      MB.audio.sfx('hit');
      if (!i) { impact(); hit(V, t, c); } else { flash(V, T, hT, '#ffffff', 220); V.shake(12); }
      await wait(0.18);
    }
    burst(V, T, c, 16, { h: hT, spread: 120, shape: 'shard' });
    pop(V, T, hT + 100, own(a, 'finish', 'mph!'), 'float-text shield', 0.9);
    await goHome(v, A);
  };

  // Deiste: a dragon sweeps over the board and breathes fire on the target
  S.dragon = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'THE KING IS I!'), 'float-text burn', 1.1);
    await gsap.to(v.figure, { y: -30, rotation: -6, duration: 0.25 });
    const dr = V.billboard('thrown big', '🐉', A.x, A.y);
    MB.audio.sfx('whoosh');
    await path(dr, (k) => ({ ...arc(A, T, hA + 80, hT + 160, 220, 180, perp)(k), r: Math.sin(k * Math.PI * 2) * 12, s: 0.6 + k * 0.6 }), 0.8, 'sine.inOut', (p) => {
      if (Math.random() < 0.4) { const e = dot(V, p, p.h - 20, MB.pick(['#ff4a1c', '#ffb347']), rnd(6, 12)); gsap.to(e.body, { y: '+=40', opacity: 0, duration: 0.5, onComplete: () => e.remove() }); }
    });
    MB.audio.sfx('fire');
    for (let i = 0; i < 4; i++) {
      const P = i === 0 ? T : { x: T.x + rnd(-60, 60), y: T.y + rnd(-25, 25) };
      const f = pillar(V, P, '#ff5a1f');
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: rnd(0.8, 1.2), duration: 0.18, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => f.remove() });
      if (i === 0) { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); } else burst(V, P, '#ffb347', 6, { h: hT, spread: 60 });
      V.shake(8);
      await wait(0.1);
    }
    rise(V, T, '#ffb347', 12, hT * 1.4);
    gsap.to(dr.body, { y: '-=300', opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => dr.remove() });
    await gsap.to(v.figure, { y: 0, rotation: 0, duration: 0.3 });
  };

  // Olivia: a latte flies over and splashes, latte-art hearts and all
  S.latte = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    await gsap.to(v.figure, { rotation: -8, duration: 0.2 });
    const cup = V.billboard('thrown', '☕', A.x, A.y);
    MB.audio.sfx('whoosh');
    gsap.to(v.figure, { rotation: 6, duration: 0.15 });
    await path(cup, (k) => ({ ...arc(A, T, hA, hT, 200, 40, perp)(k), r: k * 540 }), 0.6, 'power1.in', (p) => {
      if (Math.random() < 0.4) { const s = dot(V, p, p.h, '#f3e2c7', rnd(6, 10)); gsap.to(s.body, { y: '-=50', opacity: 0, duration: 0.6, onComplete: () => s.remove() }); }
    });
    cup.remove();
    impact(); hit(V, t, c); MB.audio.sfx('splash');
    const sp = V.flat('splat', '', T.x, T.y);
    sp.style.setProperty('--c', c);
    gsap.fromTo(sp, { scale: 0.1, opacity: 0.9 }, { scale: 1.1, duration: 0.25, ease: 'back.out(3)' });
    gsap.to(sp, { opacity: 0, duration: 0.6, delay: 1.1, onComplete: () => sp.remove() });
    scatter(V, T, hT, ['🤎', '☕', '🫘'], 10, 130);
    pop(V, T, hT + 90, own(a, 'finish', 'On the house~'), 'float-text heal', 1);
    await gsap.to(v.figure, { rotation: 0, duration: 0.3 });
  };

  // Mason: a flurry of letters, then the big parcel lands
  S.mail = async (V, a, t, impact) => {
    const { A, T, perp, hA, hT, c } = ctx(V, a, t);
    let first = true;
    await Promise.all([0, 1, 2, 3, 4, 5].map((i) => wait(i * 0.08).then(() => {
      const m = V.billboard('thrown', '✉️', A.x, A.y);
      m.body.style.fontSize = '44px';
      const TT = { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) }, spin = rnd(-360, 360);
      MB.audio.sfx('whoosh');
      return path(m, (k) => ({ ...arc(A, TT, hA, hT, rnd(80, 160), rnd(-120, 120), perp)(k), r: k * spin }), 0.5, 'power1.in').then(() => {
        m.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else { burst(V, TT, c, 4, { h: hT, spread: 50 }); MB.audio.sfx('click'); }
      });
    })));
    const box = V.billboard('thrown big', '📦', T.x, T.y);
    gsap.set(box.body, { y: -800 });
    await gsap.to(box.body, { y: -hT - 20, duration: 0.4, ease: 'power2.in' });
    MB.audio.sfx('slam'); V.shake(12); hit(V, t, c, true); ring(V, T, c, 2);
    pop(V, T, hT + 120, own(a, 'finish', 'DELIVERED!'), 'float-text buff', 1);
    gsap.to(box.body, { scale: 1.4, opacity: 0, duration: 0.35, delay: 0.2, onComplete: () => box.remove() });
    await wait(0.4);
  };

  // Benjamin: charges in behind a shopping cart and knocks the groceries everywhere
  S.cart = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t);
    const cart = V.billboard('thrown big', '🛒', A.x + d.x * 60, A.y + d.y * 60);
    gsap.set(cart.body, { y: -40 });
    await gsap.to(v.img, { scaleY: 0.9, scaleX: 1.08, duration: 0.2 });
    MB.audio.sfx('honk');
    const P = { x: C.x - d.x * 60, y: C.y - d.y * 60 };
    await Promise.all([
      gsap.to(v.el, { x: P.x, y: P.y, duration: 0.45, ease: 'power2.in', onUpdate: () => ghost(V, v, c) }),
      gsap.to(cart, { x: C.x, y: C.y, duration: 0.45, ease: 'power2.in' }),
      gsap.to(cart.body, { rotation: 4, duration: 0.07, yoyo: true, repeat: 5 }),
      gsap.to(v.img, { scaleY: 1, scaleX: 1, duration: 0.2 }),
    ]);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16);
    scatter(V, T, hT, ['🥫', '🍞', '🥛', '🍎'], 14, 170);
    pop(V, T, hT + 100, own(a, 'finish', 'CLEAN-UP ON AISLE 5!'), 'float-text buff', 1.1);
    gsap.to(cart.body, { opacity: 0, scale: 0.6, duration: 0.3, delay: 0.3, onComplete: () => cart.remove() });
    await wait(0.3);
    await goHome(v, A, 0.55);
  };

  // Dan: vaults clean over everything with a flip and lands a kick
  S.parkour = async (V, a, t, impact) => {
    const { v, A, T, C, d, c } = ctx(V, a, t);
    await gsap.to(v.img, { scaleY: 0.8, scaleX: 1.12, duration: 0.15 });
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.55, ease: 'power1.inOut', onUpdate: () => ghost(V, v, c) })
      .to(v.img, { scaleY: 1, scaleX: 1, duration: 0.1 }, 0)
      .to(v.figure, { y: -260, duration: 0.28, ease: 'power2.out' }, 0)
      .to(v.figure, { rotation: d.x >= 0 ? 360 : -360, duration: 0.5, ease: 'power1.inOut' }, 0)
      .to(v.figure, { y: 0, duration: 0.27, ease: 'power3.in' }, 0.28)
      .set(v.figure, { rotation: 0 });
    impact(); hit(V, t, c, true); MB.audio.sfx('kick'); MB.audio.sfx('slam'); V.shake(12);
    burst(V, T, '#c9b79c', 14, { h: 10, spread: 150 });
    pop(V, T, V.heightOf(t) * 0.5 + 100, own(a, 'finish', 'Catch me if you can!'), 'float-text hic', 1);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- The Lifeguard has Teeth styles

  // spray of sea water around a point
  function droplets(V, T, n, spread = 150) {
    for (let i = 0; i < n; i++) {
      const dr = dot(V, T, 20, '#bfe9ff', rnd(6, 13)), ang = rnd(0, Math.PI * 2);
      gsap.to(dr, { x: T.x + Math.cos(ang) * rnd(spread * 0.4, spread), y: T.y + Math.sin(ang) * rnd(spread * 0.2, spread * 0.5), duration: 0.9 });
      gsap.to(dr.body, { keyframes: [{ y: -rnd(140, 300), duration: 0.45, ease: 'power2.out' }, { y: 0, opacity: 0, duration: 0.45, ease: 'power2.in' }], onComplete: () => dr.remove() });
    }
  }
  // two rows of teeth snap shut over a point
  async function chomp(V, T, h, c, s = 1) {
    const j = V.billboard('jaw', '<i></i><i></i>', T.x, T.y);
    j.body.style.setProperty('--c', c);
    const [top, bot] = j.body.children;
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .fromTo(j.body, { y: -h, opacity: 0, scale: s * 0.6 }, { opacity: 1, scale: s, duration: 0.15 })
      .fromTo(top, { y: -90 }, { y: -20, duration: 0.25, ease: 'power2.out' }, 0)
      .fromTo(bot, { y: 90 }, { y: 20, duration: 0.25, ease: 'power2.out' }, 0)
      .to(top, { y: 30, duration: 0.09, ease: 'power4.in' })
      .to(bot, { y: -30, duration: 0.09, ease: 'power4.in' }, '<');
    MB.audio.sfx('chomp');
    gsap.to(j.body, { opacity: 0, scale: s * 1.2, duration: 0.3, delay: 0.15, onComplete: () => j.remove() });
  }
  // a shark fin cutting through the board in a closing spiral around T
  function circleFins(V, T, c, n, dur, turns) {
    const fins = [];
    for (let i = 0; i < n; i++) {
      const f = V.billboard('fin', '', T.x, T.y);
      f.body.style.setProperty('--c', c);
      gsap.set(f.body, { yPercent: -100, y: 0 });
      fins.push(f);
    }
    const o = { k: 0 };
    return gsap.to(o, { k: 1, duration: dur, ease: 'power1.in', onUpdate: () => fins.forEach((f, i) => {
      const r = 170 * (1 - o.k * 0.6), ang = o.k * Math.PI * turns + (i * Math.PI * 2) / n;
      const p = { x: T.x + Math.cos(ang) * r, y: T.y + Math.sin(ang) * r * 0.45 };
      gsap.set(f, p);
      gsap.set(f.body, { scaleX: Math.sin(ang) > 0 ? -1 : 1 });
      if (Math.random() < 0.4) { const s = dot(V, p, rnd(0, 20), '#bfe9ff', rnd(5, 10)); gsap.to(s.body, { y: `-=${rnd(20, 60)}`, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
    }), onComplete: () => fins.forEach((f) => f.remove()) });
  }

  // Rirarra: dives into the board, circles as a fin, then CHOMP
  S.jaws = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    MB.audio.sfx('splash');
    await gsap.to(v.figure, { y: 120, opacity: 0, duration: 0.3, ease: 'power2.in' });
    await circleFins(V, T, c, 1, 1, 3.2);
    await chomp(V, T, hT, c);
    impact(); hit(V, t, c, true); V.shake(18); V.hitStop();
    droplets(V, T, 18);
    pop(V, T, hT + 110, own(a, 'finish', 'CHOMP!'), 'float-text baka', 1);
    await wait(0.2);
    MB.audio.sfx('splash');
    await gsap.fromTo(v.figure, { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
  };

  // Rowdy: gentle giant energy, but she still suplexes you
  S.suplex = async (V, a, t, impact) => {
    const { v, A, T, C, d, c } = ctx(V, a, t);
    const tv = !t.isLeader && V.ents.get(t.uid), hT = V.heightOf(t) * 0.5, flip = d.x >= 0 ? 1 : -1;
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in' });
    pop(V, C, V.heightOf(a) + 20, own(a, 'cry', 'S-sorry!'), 'float-text hic', 0.9);
    const figs = tv ? [v.figure, tv.figure] : [v.figure];
    await gsap.timeline()
      .to(figs, { y: -200, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
      .to(v.figure, { rotation: -20 * flip, duration: 0.3 }, 0)
      .to(tv ? tv.figure : {}, { rotation: 180 * flip, duration: 0.3 }, 0)
      .to(figs, { y: 0, duration: 0.18, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(20);
    ring(V, T, '#ffffff', 2.4); burst(V, T, '#c9b79c', 18, { h: 10, spread: 180 });
    if (tv) gsap.to(tv.figure, { rotation: 0, duration: 0.4, ease: 'back.out(2)' });
    pop(V, T, hT + 100, own(a, 'finish', 'SUPLEX!'), 'float-text baka', 1);
    await goHome(v, A);
  };

  // Melanika: surfs in on her own wave
  S.surf = async (V, a, t, impact) => {
    const { v, A, T, C, d, c } = ctx(V, a, t);
    const hT = V.heightOf(t) * 0.5;
    const w = V.billboard('wave', '<div class="foam"></div>', A.x, A.y);
    gsap.set(w.body, { yPercent: -100, y: 10, scale: 0.6 });
    MB.audio.sfx('surf');
    await gsap.timeline().to(w.body, { scale: 1, duration: 0.3 }).to(v.figure, { y: -90, rotation: -d.x * 8, duration: 0.3 }, 0);
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.6, ease: 'power1.in', onUpdate: () => {
      const p = { x: lerp(A.x, C.x, o.k), y: lerp(A.y, C.y, o.k) };
      gsap.set(v.el, p); gsap.set(w, { x: p.x - d.x * 20, y: p.y - d.y * 20 });
      gsap.set(v.figure, { y: -90 - Math.sin(o.k * Math.PI * 3) * 20 });
      if (Math.random() < 0.5) { const s = dot(V, p, rnd(10, 80), '#bfe9ff', rnd(5, 10)); gsap.to(s.body, { y: `+=${rnd(-60, 20)}`, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
      ghost(V, v, c);
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('wave'); V.shake(12);
    gsap.to(w.body, { scaleY: 1.8, opacity: 0, duration: 0.4, onComplete: () => w.remove() });
    scatter(V, T, hT, ['🌊', '💧', '🐚'], 10, 140);
    pop(V, T, hT + 100, own(a, 'finish', "SURF'S UP!"), 'float-text shield', 1);
    await goHome(v, A);
  };

  // Rinco: a huge shadow under the target, then a whale shark breaches out of the board
  S.whale = async (V, a, t, impact) => {
    const { v, T, hT, c } = ctx(V, a, t);
    await glowUp(v, c, -30);
    const shadow = V.flat('whirlpool', '', T.x, T.y);
    shadow.style.setProperty('--c', '#0b3d5c');
    MB.audio.sfx('wave');
    await gsap.fromTo(shadow, { scale: 0, opacity: 0 }, { scale: 2, opacity: 0.9, duration: 0.7, ease: 'power2.out' });
    const whale = V.billboard('thrown big', '🐋', T.x, T.y);
    gsap.set(whale.body, { y: 60, scale: 1.6, opacity: 0 });
    const geyser = pillar(V, T, c, 'sky-beam');
    gsap.fromTo(geyser.body, { scaleX: 0 }, { scaleX: 1, duration: 0.15 });
    await gsap.to(whale.body, { y: -hT - 180, opacity: 1, rotation: -15, duration: 0.45, ease: 'power2.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18);
    droplets(V, T, 22);
    await gsap.to(whale.body, { y: 40, rotation: 20, opacity: 0, duration: 0.5, ease: 'power2.in' });
    whale.remove();
    MB.audio.sfx('splash'); ring(V, T, c, 2.6, 0.8);
    gsap.to(geyser.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => geyser.remove() });
    gsap.to(shadow, { opacity: 0, duration: 0.5, onComplete: () => shadow.remove() });
    pop(V, T, hT + 100, own(a, 'finish', 'There, there~'), 'float-text heal', 1);
    await glowDown(v);
  };

  // Daphne: smash first, fix later
  S.hammer = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in' });
    const hm = V.billboard('thrown big', '🔨', T.x, T.y);
    gsap.set(hm.body, { y: -hT - 180, rotation: -120, scale: 1.4 });
    pop(V, C, V.heightOf(a) + 20, own(a, 'cry', 'Smash first!'), 'float-text burn', 0.9);
    await gsap.to(hm.body, { rotation: -150, duration: 0.25, ease: 'power1.out' });
    await gsap.to(hm.body, { rotation: 10, y: -hT - 40, duration: 0.14, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boing'); gsap.delayedCall(0.35, () => MB.audio.sfx('tweet')); V.shake(22); V.hitStop();
    ring(V, T, '#ffffff', 2.6, 0.7);
    scatter(V, T, hT, ['🔩', '⚙️', '🪛'], 14, 170);
    gsap.to(hm.body, { opacity: 0, y: '-=40', duration: 0.3, delay: 0.2, onComplete: () => hm.remove() });
    await wait(0.35);
    pop(V, T, hT + 110, own(a, 'finish', '...fix later.'), 'float-text hic', 1);
    await goHome(v, A);
  };

  // Brizz: spins so her thresher tail whips round three times, then patches things up
  S.scythe = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.25, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    await gsap.to(v.figure, { rotationY: 360, duration: 0.35, ease: 'power2.in' });
    gsap.set(v.figure, { rotationY: 0 });
    for (let i = 0; i < 3; i++) {
      slashArc(V, T, -hT - 30 + i * 30, c, -60 + i * 20);
      if (!i) { impact(); hit(V, t, c); } else burst(V, T, c, 6, { h: hT, spread: 90 });
      MB.audio.sfx(i ? 'swish' : 'scythe'); V.shake(6);
      await wait(0.1);
    }
    scatter(V, T, hT, ['🩹', '💊', '🩺'], 9, 130);
    pop(V, T, hT + 100, own(a, 'finish', "Doctor's orders!"), 'float-text heal', 1);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- The yuri assist styles

  // Andrea: chugs a coffee, jitters, and fires off a (censored) curse
  S.coffee = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const H = V.heightOf(a);
    const cup = V.billboard('thrown', '☕', A.x + 30, A.y);
    gsap.set(cup.body, { y: -H * 0.7 });
    await gsap.fromTo(cup.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    await gsap.to(cup.body, { rotation: -70, duration: 0.3 });
    cup.remove();
    pop(V, A, H + 20, '*glug glug*', 'float-text hic', 0.8);
    await gsap.fromTo(v.figure, { x: -6 }, { x: 6, duration: 0.04, repeat: 9, yoyo: true }); // caffeine jitters
    gsap.set(v.figure, { x: 0 });
    const curse = V.billboard('float-text baka', '#@$%!', A.x, A.y);
    MB.audio.sfx('whoosh');
    await path(curse, (k) => ({ ...arc(A, T, hA + 40, hT, 150, 60, perp)(k), r: Math.sin(k * Math.PI * 4) * 12, s: 0.7 + k * 0.7 }), 0.55, 'power1.in');
    curse.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12);
    scatter(V, T, hT, ['💢', '☕', '💀'], 10, 140);
    pop(V, T, hT + 100, own(a, 'finish', '*BLEEP*'), 'float-text debuff', 1);
    await wait(0.3);
  };

  // Linda: the paperwork comes down, then the verdict gets stamped
  S.stamp = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Order.'), 'float-text shield', 0.9);
    await gsap.to(v.figure, { y: -20, duration: 0.2, yoyo: true, repeat: 1 });
    for (let i = 0; i < 8; i++) {
      const pg = V.billboard('page', '', T.x + rnd(-90, 90), T.y + rnd(-30, 30));
      pg.body.style.setProperty('--c', c);
      gsap.set(pg.body, { y: -rnd(300, 500), rotation: rnd(-90, 90) });
      gsap.to(pg.body, { y: -rnd(0, 40), rotation: `+=${rnd(-180, 180)}`, duration: rnd(0.5, 0.8), ease: 'power1.in' });
      gsap.to(pg.body, { opacity: 0, duration: 0.3, delay: 1.1, onComplete: () => pg.remove() });
    }
    MB.audio.sfx('draw');
    await wait(0.45);
    const mark = V.billboard('stamp-mark', a.card.attack.mark || 'DENIED', T.x, T.y);
    gsap.set(mark.body, { y: -hT, rotation: -12 });
    await gsap.fromTo(mark.body, { scale: 3.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    ring(V, T, '#e8283c', 2);
    gsap.to(mark.body, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.7, onComplete: () => mark.remove() });
    await wait(0.6);
  };

  // Eva: zig-zags over at full speed shouting, and can't stop hitting
  S.hyper = async (V, a, t, impact) => {
    const { v, A, T, C, perp, hT, c } = ctx(V, a, t);
    const words = a.card.attack.words || ['OMG!!', 'WAIT!!', 'LOOK!!', 'SO COOL!!'];
    MB.audio.sfx('whoosh');
    const o = { k: 0 };
    let said = -1;
    await gsap.to(o, { k: 1, duration: 0.8, ease: 'none', onUpdate: () => {
      const w = Math.sin(o.k * Math.PI * 6) * 80;
      const p = { x: lerp(A.x, C.x, o.k) + perp.x * w, y: lerp(A.y, C.y, o.k) + perp.y * w };
      gsap.set(v.el, p); ghost(V, v, c);
      const n = Math.min(3, Math.floor(o.k * 4));
      if (n !== said) { said = n; pop(V, p, V.heightOf(a) + 20, words[n], 'float-text buff', 0.6); MB.audio.sfx('pop'); }
    } });
    impact(); hit(V, t, c); MB.audio.sfx('hit'); V.shake(10);
    for (let i = 0; i < 2; i++) {
      await gsap.to(v.figure, { x: i ? -24 : 24, y: -30, duration: 0.08, yoyo: true, repeat: 1 });
      burst(V, T, c, 6, { h: hT, spread: 70 }); MB.audio.sfx('bonk');
    }
    scatter(V, T, hT, ['🤓', '✨', '💚'], 8, 120);
    await goHome(v, A);
  };

  // Ashley: a jump shot into a hoop over the target... that drops right on it
  S.hoops = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const hoop = V.billboard('hoop', '', T.x, T.y);
    gsap.set(hoop.body, { y: -hT - 250 });
    gsap.fromTo(hoop.body, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    await gsap.timeline().to(v.figure, { y: -60, duration: 0.2, ease: 'power2.out' }).to(v.figure, { y: 0, duration: 0.2, ease: 'power2.in' });
    const ball = V.billboard('thrown', '🏀', A.x, A.y);
    ball.body.style.fontSize = '54px';
    MB.audio.sfx('whoosh');
    await path(ball, (k) => ({ ...arc(A, T, hA + 40, hT + 220, 260)(k), r: k * 720 }), 0.8, 'sine.inOut');
    MB.audio.sfx('boing');
    pop(V, T, hT + 330, 'SWISH!', 'float-text buff', 0.9);
    await gsap.to(ball.body, { y: -hT, duration: 0.25, ease: 'power2.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('cheer'); V.shake(12);
    await gsap.to(ball.body, { y: -hT - 90, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 });
    gsap.to([ball.body, hoop.body], { opacity: 0, duration: 0.3, onComplete: () => { ball.remove(); hoop.remove(); } });
    pop(V, T, hT + 110, own(a, 'finish', 'Buzzer beater, eh?'), 'float-text hic', 1);
    await wait(0.3);
  };

  // ---------------------------------------------------------------- new relationship duo styles

  // Birk & Son: the whole stockroom comes down on the target
  S.restock = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    pop(V, A, V.heightOf(a) + 30, 'Everything must go!', 'float-text buff', 1);
    gsap.to(R, { rotation: -6, duration: 0.15, yoyo: true, repeat: 3 }); // dad points at the shelves
    let first = true;
    const drops = [];
    for (let i = 0; i < 16; i++) {
      const P = { x: T.x + rnd(-80, 80), y: T.y + rnd(-30, 30) };
      const it = V.billboard('thrown', MB.pick(['🥫', '📦', '🍞', '🥛', '🍎', '🧃']), P.x, P.y);
      it.body.style.fontSize = rnd(40, 64) + 'px';
      gsap.set(it.body, { y: -800 - rnd(0, 200), rotation: rnd(-90, 90) });
      if (i % 4 === 0) gsap.to(L, { y: -40, duration: 0.1, delay: i * 0.05, yoyo: true, repeat: 1 }); // the son does the throwing
      drops.push(wait(i * 0.05).then(() => gsap.to(it.body, { y: -hT * rnd(0.2, 1.1), rotation: `+=${rnd(-180, 180)}`, duration: 0.45, ease: 'power2.in' }).then(() => {
        if (first) { first = false; impact(); hit(V, t, c, true); } else if (i % 3 === 0) MB.audio.sfx('hit');
        burst(V, P, c, 2, { h: hT * 0.5, spread: 40 });
        gsap.to(it.body, { opacity: 0, y: '+=30', duration: 0.3, onComplete: () => it.remove() });
      })));
    }
    MB.audio.sfx('whoosh');
    await Promise.all(drops);
    V.shake(14); ring(V, T, c, 2.4);
    const tag = V.billboard('thrown big', '🏷️', T.x, T.y);
    gsap.set(tag.body, { y: -hT - 60 });
    gsap.fromTo(tag.body, { scale: 2.5, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.25, ease: 'back.out(2)' });
    gsap.to(tag.body, { opacity: 0, duration: 0.3, delay: 0.7, onComplete: () => tag.remove() });
    MB.audio.sfx('coin');
    pop(V, T, hT + 140, 'CLEARANCE SALE!', 'float-text buff', 1.1);
    resetDuo(v);
    await wait(0.5);
  };

  // Trouble Duo: Deiste tosses a flashbang, Dan vaults in while everyone is blinded
  S.flashbang = async (V, a, t, impact) => {
    const { v, A, T, C, perp, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    pop(V, A, V.heightOf(a) + 30, "Livin' it like a dragon!", 'float-text burn', 1);
    await gsap.to(L, { rotation: -14, duration: 0.18 });
    gsap.to(L, { rotation: 8, duration: 0.14 });
    const bomb = V.billboard('thrown', '🧨', A.x, A.y);
    MB.audio.sfx('whoosh');
    await path(bomb, (k) => ({ ...arc(A, T, hA, 20, 180, 60, perp)(k), r: k * 720 }), 0.55, 'power1.in');
    await gsap.to(bomb.body, { y: -60, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
    for (let i = 0; i < 3; i++) { MB.audio.sfx('click'); await gsap.fromTo(bomb.body, { scale: 1 }, { scale: 1.3, duration: 0.08, yoyo: true, repeat: 1 }); }
    bomb.remove();
    impact(); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(24); V.hitStop();
    flash(V, T, hT, '#ffffff', 1600); flash(V, T, hT, c, 700);
    hit(V, t, c, true); ring(V, T, '#ffffff', 4, 0.9);
    pop(V, T, hT + 110, 'BANG!', 'float-text baka', 0.9);
    gsap.to(L, { rotation: 0, duration: 0.2 });
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.35, ease: 'power2.in', onUpdate: () => ghost(V, v, c) })
      .to(R, { y: -120, rotation: 360, duration: 0.35 }, 0)
      .to(R, { y: 0, duration: 0.12 })
      .set(R, { rotation: 0 });
    burst(V, T, c, 12, { h: hT, spread: 110 }); MB.audio.sfx('hit'); V.shake(10);
    pop(V, C, V.heightOf(a) + 60, '...MY EYE!', 'float-text hic', 1);
    resetDuo(v);
    await goHome(v, A);
  };

  // Cabin Sharks: two fins close in from both sides, two bites, a waterspout
  S.feeding = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 30, 'FEEDING TIME!', 'float-text baka', 1);
    MB.audio.sfx('splash');
    await gsap.to(v.figure, { y: 140, opacity: 0, duration: 0.35, ease: 'power2.in' });
    await circleFins(V, T, c, 2, 1.1, 3.5);
    const water = pillar(V, T, '#7fd6ff', 'sky-beam');
    gsap.fromTo(water.body, { scaleX: 0 }, { scaleX: 1.3, duration: 0.15 });
    await chomp(V, { x: T.x - 50, y: T.y }, hT, c, 0.9);
    impact(); hit(V, t, c, true); V.shake(14);
    await chomp(V, { x: T.x + 50, y: T.y }, hT, '#c8894a', 0.9);
    hit(V, t, '#c8894a', true); V.shake(22); V.hitStop(); flash(V, T, hT, '#ffffff', 420);
    ring(V, T, c, 3, 0.9); ring(V, T, '#ffffff', 2.2, 0.7);
    droplets(V, T, 26, 180);
    pop(V, T, hT + 120, 'FEEDING FRENZY!', 'float-text burn', 1.2);
    gsap.to(water.body, { scaleX: 0, opacity: 0, duration: 0.4, delay: 0.2, onComplete: () => water.remove() });
    await wait(0.3);
    MB.audio.sfx('splash');
    await gsap.fromTo(v.figure, { y: 140, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
    resetDuo(v);
  };

  // The Soft Duo: Rinco raises a wave, Melanika rides it in, and it rains crabs
  S.tidal = async (V, a, t, impact) => {
    const { v, A, T, C, d, c } = ctx(V, a, t);
    const [L, R] = duo(v), hT = V.heightOf(t) * 0.5;
    gsap.to(R, { y: -30, duration: 0.25, yoyo: true, repeat: 1 });
    pop(V, A, V.heightOf(a) + 30, 'Hold on, dear~', 'float-text heal', 0.9);
    const w = V.billboard('wave', '<div class="foam"></div>', A.x, A.y);
    gsap.set(w.body, { yPercent: -100, y: 10, scale: 0.5 });
    MB.audio.sfx('splash');
    await gsap.to(w.body, { scale: 1.6, duration: 0.4, ease: 'back.out(1.6)' });
    await gsap.to(v.figure, { y: -120, duration: 0.25 });
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.7, ease: 'power1.in', onUpdate: () => {
      const p = { x: lerp(A.x, C.x, o.k), y: lerp(A.y, C.y, o.k) };
      gsap.set(v.el, p); gsap.set(w, { x: p.x - d.x * 20, y: p.y - d.y * 20 });
      gsap.set(L, { rotation: Math.sin(o.k * Math.PI * 4) * 8 });
      if (Math.random() < 0.5) { const s = dot(V, p, rnd(10, 90), '#bfe9ff', rnd(5, 10)); gsap.to(s.body, { y: `+=${rnd(-60, 20)}`, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
      ghost(V, v, c);
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('wave'); MB.audio.sfx('slam'); V.shake(18);
    gsap.to(w.body, { scaleY: 2.4, opacity: 0, duration: 0.45, onComplete: () => w.remove() });
    for (let i = 0; i < 8; i++) {
      const cr = V.billboard('thrown', MB.pick(['🦀', '🦐', '🦀']), T.x + rnd(-110, 110), T.y + rnd(-40, 40));
      cr.body.style.fontSize = '48px';
      gsap.set(cr.body, { y: -700 - rnd(0, 200), rotation: rnd(-90, 90) });
      gsap.to(cr.body, { y: -rnd(0, 30), rotation: `+=${rnd(-200, 200)}`, duration: rnd(0.5, 0.7), delay: i * 0.05, ease: 'power2.in' });
      gsap.to(cr.body, { opacity: 0, duration: 0.3, delay: 1.1, onComplete: () => cr.remove() });
    }
    droplets(V, T, 16);
    ring(V, T, c, 2.8, 0.8);
    pop(V, T, hT + 120, 'WHALE OF A WAVE!', 'float-text shield', 1.1);
    await wait(0.5);
    resetDuo(v);
    await goHome(v, A, 0.5);
  };

  // Hammer & Scythe: the engineer smashes, the medic sweeps and slaps a bandage on
  S.workshop = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) });
    const hm = V.billboard('thrown big', '🔨', T.x - 30, T.y);
    gsap.set(hm.body, { y: -hT - 170, rotation: -130, scale: 1.3 });
    gsap.to(L, { rotation: -12, duration: 0.2 });
    await gsap.to(hm.body, { rotation: 10, y: -hT - 40, duration: 0.16, ease: 'power4.in', delay: 0.1 });
    gsap.to(L, { rotation: 6, duration: 0.1 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18);
    scatter(V, T, hT, ['🔩', '⚙️'], 8, 150);
    gsap.to(hm.body, { opacity: 0, duration: 0.3, onComplete: () => hm.remove() });
    await gsap.to(R, { rotationY: 360, duration: 0.3, ease: 'power2.in' });
    gsap.set(R, { rotationY: 0 });
    for (let i = 0; i < 2; i++) {
      slashArc(V, T, -hT, '#3fd0a8', i ? 20 : -20);
      burst(V, T, '#3fd0a8', 8, { h: hT, spread: 100 }); MB.audio.sfx('whoosh'); V.shake(6);
      await wait(0.12);
    }
    const aid = V.billboard('thrown big', '🩹', T.x, T.y);
    gsap.set(aid.body, { y: -hT });
    await gsap.fromTo(aid.body, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: 'power4.in' });
    MB.audio.sfx('shield'); flash(V, T, hT, '#ffffff', 220);
    pop(V, T, hT + 120, 'SMASH & STITCH!', 'float-text buff', 1.1);
    gsap.to(aid.body, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.4, onComplete: () => aid.remove() });
    gsap.to([L, R], { rotation: 0, duration: 0.2 });
    await wait(0.3);
    resetDuo(v);
    await goHome(v, A);
  };

  // The Yuri Plan: lilies bloom, two hearts spiral together into one, and a pink beam falls
  S.yuri = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v);
    await gsap.timeline()
      .to([L, R], { x: (i) => (i ? -16 : 16), rotation: (i) => (i ? -5 : 5), duration: 0.35 }) // lean in
      .to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.15)`, duration: 0.35 }, 0);
    pop(V, A, V.heightOf(a) + 30, '...together?', 'float-text baka', 1);
    const lilies = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2, f = V.billboard('petal', i % 2 ? '🌸' : '💮', T.x + Math.cos(ang) * 140, T.y + Math.sin(ang) * 60);
      gsap.set(f.body, { y: -10, scale: 0 });
      gsap.to(f.body, { scale: 1.6, duration: 0.3, delay: i * 0.04, ease: 'back.out(3)' });
      lilies.push(f);
    }
    MB.audio.sfx('sparkle');
    await wait(0.5);
    const hearts = ['💜', '💙'].map((h) => V.billboard('thrown', h, A.x, A.y));
    MB.audio.sfx('beam');
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.9, ease: 'sine.inOut', onUpdate: () => {
      const base = arc(A, T, hA + 60, hT + 160, 120)(o.k);
      hearts.forEach((h, i) => {
        const ang = o.k * Math.PI * 4 + i * Math.PI, r = 70 * (1 - o.k);
        const p = { x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r * 0.5 };
        gsap.set(h, p); gsap.set(h.body, { y: -base.h - Math.sin(ang) * r * 0.4 });
        if (Math.random() < 0.4) { const s = dot(V, p, base.h, c, rnd(6, 10)); gsap.to(s.body, { opacity: 0, scale: 0.1, duration: 0.45, onComplete: () => s.remove() }); }
      });
    } });
    hearts.forEach((h) => h.remove());
    const big = V.billboard('thrown big', '💗', T.x, T.y);
    gsap.set(big.body, { y: -hT - 160 });
    await gsap.fromTo(big.body, { scale: 0.3 }, { scale: 1.6, duration: 0.3, ease: 'back.out(3)' });
    const beam = pillar(V, T, c, 'sky-beam');
    MB.audio.sfx('choir');
    await gsap.fromTo(beam.body, { scaleX: 0 }, { scaleX: 1, duration: 0.15 });
    impact(); hit(V, t, c, true); flash(V, T, hT, '#ffffff', 460); V.hitStop(); MB.audio.sfx('slam'); V.shake(22);
    ring(V, T, c, 3.2, 0.9); ring(V, T, '#ffffff', 2.2, 0.7);
    scatter(V, T, hT, ['🌸', '💗', '💮', '✨'], 22, 190);
    pop(V, T, hT + 120, 'I LIKE YOU!', 'float-text bond-name', 1.2);
    gsap.to(big.body, { scale: 2.4, opacity: 0, duration: 0.4, onComplete: () => big.remove() });
    await gsap.to(beam.body, { scaleX: 0, opacity: 0, duration: 0.4, delay: 0.2 });
    beam.remove();
    lilies.forEach((f, i) => gsap.to(f.body, { y: '-=80', opacity: 0, duration: 0.6, delay: i * 0.03, onComplete: () => f.remove() }));
    resetDuo(v);
    await gsap.to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' });
  };

  // Court Crush: Andrea lobs it up, Ashley flies in for the alley-oop
  S.alleyoop = async (V, a, t, impact) => {
    const { v, A, T, C, hA, hT, c } = ctx(V, a, t);
    const [L, R] = duo(v), O = { x: A.x + 40, y: A.y };
    const ball = V.billboard('thrown', '🏀', O.x, O.y);
    ball.body.style.fontSize = '54px';
    gsap.set(ball.body, { y: -hA });
    gsap.to(R, { y: -30, rotation: -8, duration: 0.15, yoyo: true, repeat: 1 });
    pop(V, A, V.heightOf(a) + 30, 'Up you go.', 'float-text hic', 0.8);
    MB.audio.sfx('whoosh');
    const lob = path(ball, (k) => ({ ...arc(O, T, hA, hT + 240, 180)(k), r: k * 540 }), 0.8, 'sine.inOut');
    await gsap.timeline()
      .to(v.el, { x: C.x, y: C.y, duration: 0.8, ease: 'power1.inOut', onUpdate: () => ghost(V, v, c) })
      .to(v.figure, { y: -300, duration: 0.8, ease: 'power2.out' }, 0)
      .to(L, { rotation: -20, duration: 0.8 }, 0);
    await lob;
    pop(V, T, hT + 330, 'ALLEY-OOP!', 'float-text buff', 0.8);
    await Promise.all([gsap.to(v.figure, { y: 0, duration: 0.2, ease: 'power4.in' }), gsap.to(ball.body, { y: -hT, duration: 0.2, ease: 'power4.in' })]);
    gsap.to(L, { rotation: 0, duration: 0.2 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    ring(V, T, c, 2.6); burst(V, T, '#c9b79c', 16, { h: 10, spread: 170 });
    scatter(V, T, hT, ['💕', '🏀', '✨'], 12, 150);
    gsap.to(ball.body, { opacity: 0, duration: 0.3, delay: 0.2, onComplete: () => ball.remove() });
    pop(V, T, hT + 120, 'Nice dunk~ ♥', 'float-text baka', 1);
    resetDuo(v);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- signature styles, later novels

  // Shino: iaido. A still stance, one blink straight through the target, then the three thrusts of the
  // Sandanzuki land at once
  S.katana = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t);
    await gsap.timeline().to(v.figure, { x: -d.x * 18, duration: 0.3, ease: 'power2.out' })
      .to(v.img, { filter: `drop-shadow(0 0 14px ${c}) brightness(1.2)`, duration: 0.3 }, 0);
    await wait(0.2);
    const P = { x: T.x + d.x * 120, y: T.y + d.y * 120 };
    MB.audio.sfx('swish');
    await gsap.to(v.el, { x: P.x, y: P.y, duration: 0.09, ease: 'power4.in', onUpdate: () => ghost(V, v, c) });
    // the cut hangs in the air for a beat
    const N = Math.max(10, Math.round(d.len / 26)), segs = [];
    for (let i = 0; i <= N; i++) { const k = i / N; segs.push(dot(V, { x: lerp(A.x, P.x, k), y: lerp(A.y, P.y, k) }, hT, '#ffffff', 14, 'beam-seg')); }
    gsap.fromTo(segs.map((s) => s.body), { scale: 0 }, { scale: 1, duration: 0.05, stagger: 0.004 });
    pop(V, P, V.heightOf(a) + 95, own(a, 'cry', '...'), 'float-text shield', 0.9);
    await wait(0.45);
    for (let i = 0; i < 3; i++) {
      const h = hT * (0.6 + i * 0.35);
      flash(V, T, h, i ? c : '#ffffff', 150);
      if (!i) { impact(); hit(V, t, c, true); V.hitStop(); } else burst(V, T, c, 8, { h, spread: 80, shape: 'shard' });
      MB.audio.sfx('hit'); V.shake(8);
      await wait(0.08);
    }
    gsap.to(segs.map((s) => s.body), { scaleY: 0, opacity: 0, duration: 0.25, stagger: 0.005, onComplete: () => segs.forEach((s) => s.remove()) });
    scatter(V, T, hT, ['🌸', '✨'], 8, 130);
    await wait(0.25);
    await gsap.to(v.figure, { opacity: 0, duration: 0.1 });
    gsap.set(v.el, A); gsap.set(v.figure, { x: 0 });
    await gsap.to(v.figure, { opacity: 1, duration: 0.15 });
    gsap.to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' });
  };

  // Keiko: unseals her eye, a magic circle opens under her and pillars of dark flame march across the board
  S.darkflame = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 95, own(a, 'cry', 'Tokoyami no Honoo!'), 'float-text burn', 1.1);
    const sig = V.flat('sigil', '', A.x, A.y);
    sig.style.setProperty('--c', c);
    gsap.fromTo(sig, { scale: 0, opacity: 0 }, { scale: 0.8, opacity: 1, rotation: 180, duration: 0.4, ease: 'back.out(1.6)' });
    gsap.to(sig, { rotation: '+=360', duration: 2, ease: 'none' });
    MB.audio.sfx('dark');
    await glowUp(v, c, -30);
    for (let i = 1; i <= 5; i++) {
      const k = i / 5, P = { x: lerp(A.x, T.x, k), y: lerp(A.y, T.y, k) }, last = i === 5;
      const f = pillar(V, P, i % 2 ? c : '#8b3dff', last ? 'pillar' : 'pillar small');
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: last ? 1.2 : rnd(0.8, 1.1), duration: 0.16, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.25, onComplete: () => f.remove() });
      if (last) { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14); } else { burst(V, P, c, 5, { h: 40, spread: 50 }); MB.audio.sfx('fire'); }
      await wait(0.09);
    }
    rise(V, T, c, 14, hT * 1.5);
    pop(V, T, hT + 110, own(a, 'finish', 'Kneel!'), 'float-text debuff', 1);
    gsap.to(sig, { opacity: 0, scale: 1.2, duration: 0.5, onComplete: () => sig.remove() });
    await wait(0.3);
    await glowDown(v);
  };

  // Yumi: a dolphin breaches, carries her into the target, then she tumbles back to her slot.
  async function dolphinRide(V, a, t, impact, o = {}) {
    const r = ctx(V, a, t), { v, T, d, hT, c } = r, A = o.home || r.A;
    const figure = o.figure || v.figure;
    const face = d.x < 0 ? -1 : 1, size = t.isLeader ? 180 : 280;
    // Breach on the near side of Yumi, away from the enemy; leave room at edge slots.
    const launch = { x: Math.max(125, Math.min(1055, A.x - face * 100)), y: A.y + 45 };
    const art = o.art || MB.AttackArt.yumi, nodes = [];
    const sprite = (phase, p, width) => {
      const node = V.billboard('yumi-dolphin-art', '', p.x, p.y);
      const img = document.createElement('img');
      img.src = art[phase]; img.alt = ''; img.draggable = false;
      img.style.transform = `scaleX(${face})`;
      node.body.style.width = node.body.style.height = width + 'px';
      node.body.appendChild(img); node.dataset.phase = phase;
      node.dataset.rider = o.rider || 'yumi';
      nodes.push(node); return node;
    };
    // Measured nose in the riding PNG: (94%, 69%). Put that point on the target center.
    const contact = { x: T.x - face * size * 0.44, y: T.y };
    const rideHeight = hT + size * 0.19;
    const land = o.land || lander(V, t, impact, r, { big: false });
    try {
      await MB.audio.prepare('dolphin');
      pop(V, A, V.heightOf(a) + 35, o.cry || own(a, 'cry', 'Iruka-san, let’s go~!'), 'float-text shield', 1);
      ring(V, launch, c, 1.3, 0.65); MB.audio.sfx('bubble');
      await gsap.to(figure, { y: -24, rotation: -4 * face, duration: 0.25, ease: 'sine.out' });
      const rising = sprite('rise', launch, 175);
      gsap.set(rising.body, { y: 25, clipPath: 'inset(100% 0% 0% 0%)' });
      MB.audio.sfx('dolphin'); MB.audio.sfx('splash', { vol: 0.6 });
      await gsap.to(rising.body, { y: -100, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.42, ease: 'power2.out' });
      await gsap.to(figure, { x: launch.x - A.x, y: -65, opacity: 0, duration: 0.2, ease: 'power2.out' });
      const riding = sprite('ride', launch, size);
      gsap.set(riding.body, { y: -150, opacity: 0 });
      await Promise.all([
        gsap.to(rising.body, { opacity: 0, duration: 0.12 }),
        gsap.to(riding.body, { opacity: 1, duration: 0.12 }),
      ]);
      rising.remove(); MB.audio.sfx('surf');
      let trailAt = -1;
      await path(riding, (k) => ({ ...arc(launch, contact, 150, rideHeight, t.isLeader ? 25 : 65)(k), r: face * -8 * Math.sin(Math.PI * k) }), 0.95, 'power1.inOut', (p, k) => {
        if (k - trailAt < 0.1) return;
        trailAt = k;
        const drop = dot(V, { x: p.x - face * 65, y: p.y }, Math.max(10, p.h - 60), c, 9);
        nodes.push(drop);
        gsap.to(drop.body, { y: '+=30', opacity: 0, scale: 0.2, duration: 0.3, onComplete: () => drop.remove() });
      });
      land(o.hitIndex || 0); // Dolphin nose touches the target here, before the return pose appears.
      MB.audio.sfx('splash'); V.shake(7);
      droplets(V, T, 16, 95); ring(V, T, c, 1.7);
      await gsap.to(riding.body, { y: '+=55', opacity: 0, duration: 0.18, ease: 'power2.in' });
      riding.remove(); MB.audio.sfx('whistleDown', { vol: 0.4 });
      const falling = sprite('fall', A, 220);
      gsap.set(falling.body, { y: 0, opacity: 0 });
      // Measure the actual projection so the whole sprite begins above the viewport at any screen size.
      const box = falling.body.getBoundingClientRect(), screenScale = Math.max(0.1, box.height / 220);
      const fromHeight = Math.max(350, (box.bottom + 40) / screenScale);
      gsap.set(falling.body, { y: -fromHeight, opacity: 1 });
      await gsap.to(falling.body, { y: -108, duration: 0.85, ease: 'power2.in' });
      await gsap.to(falling.body, { y: o.rider === 'eri' ? -104 : -95, scaleY: 0.92, duration: 0.1, ease: 'power2.in' });
      await gsap.to(falling.body, { opacity: 0, duration: 0.12 });
      falling.remove();
      gsap.set(figure, { x: 0, y: -10, rotation: 0, opacity: 1 });
      await gsap.to(figure, { y: 0, duration: 0.2 });
      pop(V, A, V.heightOf(a) + 30, o.finish || own(a, 'finish', 'Again, again~ ♪'), 'float-text shield', 0.8);
    } finally {
      nodes.forEach((node) => { gsap.killTweensOf(node); gsap.killTweensOf(node.body); node.remove(); });
      gsap.set(figure, { x: 0, y: 0, rotation: 0, rotationY: 0, opacity: 1 });
      if (!o.figure) {
        gsap.set(v.el, { x: r.A.x, y: r.A.y });
        gsap.set(v.img, { scaleX: 1, scaleY: 1 });
      }
    }
  };
  S.dolphin = (V, a, t, impact) => dolphinRide(V, a, t, impact);

  // Yumi leads happily; Eri follows reluctantly on her own dolphin a moment later.
  S.dolphinduet = async (V, a, t, impact) => {
    const r = ctx(V, a, t), { v, A } = r;
    if (!a.card.fused) return dolphinRide(V, a, t, impact);
    const parts = duo(v), members = a.card.members;
    const yi = members.findIndex((m) => m.id === 'yumi'), ei = members.findIndex((m) => m.id === 'eri');
    if (yi < 0 || ei < 0) return S.combo(V, a, t, impact);
    const land = lander(V, t, impact, r, { big: false });
    const home = (index) => ({ x: A.x + (index ? 55 : -55), y: A.y });
    try {
      // Both routines share the lander: the follow-up splash never deals duplicate damage.
      const results = await Promise.allSettled([
        dolphinRide(V, a, t, impact, { figure: parts[yi], home: home(yi), land, rider: 'yumi', cry: 'Come on, Eri~!', finish: 'That was fun~ ♪' }),
        (async () => {
          await wait(0.38);
          await dolphinRide(V, a, t, impact, { figure: parts[ei], home: home(ei), land, hitIndex: 1, art: MB.AttackArt.eri, rider: 'eri', cry: 'YUMI! SLOW DOWN!', finish: 'Never. Again.' });
        })(),
      ]);
      const failed = results.find((result) => result.status === 'rejected'); if (failed) throw failed.reason;
    } finally {
      gsap.set(parts, { opacity: 1 }); resetDuo(v);
      await goHome(v, A, 0.2);
    }
  };

  // Mariko: "hold still~". One giant syringe, one jab, and a flurry of pink crosses
  S.syringe = async (V, a, t, impact) => {
    const { v, A, C, d, T, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 95, own(a, 'cry', 'Hold still~ ♥'), 'float-text baka', 1);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) });
    const sy = V.billboard('thrown big', '💉', T.x - d.x * 30, T.y);
    gsap.set(sy.body, { y: -hT - 120, rotation: d.x >= 0 ? 0 : 90, scale: 0 });
    await gsap.to(sy.body, { scale: 1.2, duration: 0.2, ease: 'back.out(3)' });
    await gsap.to(sy.body, { y: '-=40', duration: 0.2, ease: 'power2.out' });
    await gsap.to(sy.body, { y: -hT - 30, duration: 0.1, ease: 'power4.in' });
    impact(); hit(V, t, c); MB.audio.sfx('stab'); V.shake(8);
    await gsap.to(sy.body, { scaleY: 0.85, duration: 0.25 }); // push the plunger
    rise(V, T, '#ff8ac8', 14, hT);
    scatter(V, T, hT, ['💗', '💊', '🩹'], 8, 120);
    gsap.to(sy.body, { opacity: 0, y: '-=60', duration: 0.3, onComplete: () => sy.remove() });
    pop(V, T, hT + 110, own(a, 'finish', 'All better~'), 'float-text heal', 1);
    await goHome(v, A);
  };

  // Helga: not a word. A shadow falls over the target, two cold eyes open above it, and it freezes where it stands
  S.stare = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 95, own(a, 'cry', '...'), 'float-text shield', 1);
    const dark = V.flat('dark-pool', '', T.x, T.y);
    gsap.fromTo(dark, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' });
    await gsap.to(v.img, { filter: `drop-shadow(0 0 16px ${c}) brightness(0.8)`, duration: 0.5 });
    const eyes = [-1, 1].map((s) => {
      const e = V.billboard('thrown eye', '👁️', T.x + s * 48, T.y);
      e.body.style.setProperty('--c', c);
      gsap.set(e.body, { y: -hT * 1.7, scaleY: 0 });
      return e;
    });
    MB.audio.sfx('frost'); MB.audio.sfx('blink');
    await gsap.to(eyes.map((e) => e.body), { scaleY: 1, duration: 0.25, ease: 'back.out(3)' });
    await wait(0.35);
    impact(); hit(V, t, c, true); V.shake(10); V.hitStop();
    burst(V, T, '#ffffff', 18, { h: hT, spread: 140, shape: 'shard' });
    const fr = V.flat('frost-floor', '', T.x, T.y);
    gsap.fromTo(fr, { scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => fr.remove() });
    for (let i = 0; i < 6; i++) {
      const f = V.billboard('petal', '❄', T.x + rnd(-60, 60), T.y);
      gsap.set(f.body, { y: -rnd(20, hT * 1.6) });
      gsap.to(f.body, { y: '-=80', rotation: 180, opacity: 0, duration: 1.1, delay: i * 0.05, onComplete: () => f.remove() });
    }
    await gsap.to(eyes.map((e) => e.body), { scaleY: 0, duration: 0.15, delay: 0.3 });
    eyes.forEach((e) => e.remove());
    pop(V, T, hT + 110, own(a, 'finish', 'Dismissed.'), 'float-text shield', 1);
    gsap.to(dark, { opacity: 0, duration: 0.5, onComplete: () => dark.remove() });
    await gsap.to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' });
  };

  // Ellis: a cheer routine. Pom-poms up, the cheer (attack.shout) flies over letter by letter, then the pom-poms
  S.pompom = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    const shout = (a.card.attack.shout || 'GO TEAM!').toUpperCase(), top = V.heightOf(a) * 0.6;
    const letters = [...shout.replace(/\s+/g, '')].slice(0, 8);
    const poms = [-1, 1].map((s) => {
      const p = V.billboard('pompom', '', A.x + s * 46, A.y);
      p.body.style.setProperty('--c', c);
      gsap.set(p.body, { y: -top });
      return p;
    });
    gsap.to(poms.map((p) => p.body), { y: -top - 60, rotation: 30, duration: 0.15, yoyo: true, repeat: 5, stagger: 0.07 });
    let first = true;
    await Promise.all(letters.map((ch, i) => wait(i * 0.1).then(() => {
      const b = V.billboard('float-text ability', ch, A.x, A.y);
      b.body.style.color = i % 2 ? '#ffffff' : c;
      MB.audio.sfx('pop');
      gsap.to(v.figure, { y: -24, duration: 0.05, yoyo: true, repeat: 1 });
      const TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-10, 10) }, peak = rnd(120, 200), side = rnd(-120, 120), spin = rnd(-360, 360);
      return path(b, (k) => ({ ...arc(A, TT, hA + 50, hT, peak, side, perp)(k), r: k * spin, s: 0.8 + k * 0.6 }), 0.55, 'power1.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, c, 5, { h: hT, spread: 60 });
      });
    })));
    MB.audio.sfx('whoosh');
    await Promise.all(poms.map((p, i) => {
      const F = { x: A.x + (i ? 46 : -46), y: A.y };
      return path(p, (k) => ({ ...arc(F, T, top, hT, 180)(k), r: k * 720 }), 0.5, 'power1.in').then(() => { p.remove(); burst(V, T, c, 12, { h: hT }); });
    }));
    MB.audio.sfx('cheer'); V.shake(8); ring(V, T, c, 2);
    scatter(V, T, hT, ['🎀', '✨', '💛'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', shout), 'float-text buff', 1.1);
    await wait(0.3);
  };

  // Clara: twirls a lasso overhead, ropes the target and yanks it clean off its feet
  S.lasso = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT, c } = ctx(V, a, t);
    const tv = !t.isLeader && V.ents.get(t.uid), top = V.heightOf(a) + 30;
    const loop = V.billboard('lasso', '', A.x, A.y);
    loop.body.style.setProperty('--c', c);
    gsap.set(loop.body, { y: -top, rotationX: 72, scale: 0.4 });
    pop(V, A, top + 65, own(a, 'cry', 'Yee-haw!'), 'float-text buff', 1);
    gsap.to(loop.body, { scale: 1, duration: 0.2 });
    MB.audio.sfx('twang');
    await gsap.to(loop.body, { rotation: 1080, duration: 0.8, ease: 'power1.in' });
    MB.audio.sfx('whoosh');
    await path(loop, (k) => arc(A, T, top, hT + 40, 100)(k), 0.45, 'power1.in');
    await gsap.to(loop.body, { y: -hT, scale: 0.7, duration: 0.15, ease: 'power2.in' }); // cinches tight
    const N = Math.max(8, Math.round(d.len / 30)), rope = [];
    for (let i = 1; i < N; i++) { const k = i / N; rope.push(dot(V, { x: lerp(A.x, T.x, k), y: lerp(A.y, T.y, k) }, lerp(hA, hT, k) - Math.sin(Math.PI * k) * 30, '#d9b77a', 10, 'rope')); }
    impact(); hit(V, t, c); MB.audio.sfx('hit');
    await wait(0.1);
    MB.audio.sfx('zip');
    gsap.to(v.figure, { x: -d.x * 30, rotation: -d.x * 10, duration: 0.12, yoyo: true, repeat: 1 });
    if (tv) {
      await gsap.timeline()
        .to(tv.figure, { x: -d.x * 70, y: -140, rotation: -d.x * 30, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
        .to(tv.figure, { x: 0, y: 0, rotation: 0, duration: 0.35, ease: 'bounce.out' });
    } else await wait(0.4);
    MB.audio.sfx('slam'); V.shake(12); burst(V, T, '#c9b79c', 14, { h: 10, spread: 150 });
    rope.forEach((r) => gsap.to(r.body, { opacity: 0, duration: 0.25, onComplete: () => r.remove() }));
    gsap.to(loop.body, { opacity: 0, duration: 0.3, onComplete: () => loop.remove() });
    pop(V, T, hT + 110, own(a, 'finish', 'Gotcha, sugar!'), 'float-text buff', 1);
    await gsap.to(v.figure, { x: 0, rotation: 0, duration: 0.2 });
  };

  // Diana: two flasks tossed together over the target; the reaction goes off in colored smoke. ¡Eureka!
  S.flask = async (V, a, t, impact) => {
    const { v, A, T, perp, hA, hT, c } = ctx(V, a, t);
    await gsap.to(v.figure, { rotation: -8, y: -20, duration: 0.2 });
    MB.audio.sfx('whoosh');
    const H = hT + 90, cols = [c, '#6fe0b0', '#c58cff'];
    await Promise.all(['🧪', '⚗️'].map((em, i) => {
      const f = V.billboard('thrown', em, A.x, A.y);
      return path(f, (k) => ({ ...arc(A, T, hA, H, 160, i ? 110 : -110, perp)(k), r: k * (i ? 540 : -540) }), 0.6, 'power1.in').then(() => f.remove());
    }));
    flash(V, T, H, '#ffffff', 260); MB.audio.sfx('bubble');
    await wait(0.12);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14);
    for (let i = 0; i < 10; i++) {
      const s = dot(V, { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) }, hT * rnd(0.6, 1.3), MB.pick(cols), rnd(60, 110), 'smoke');
      gsap.fromTo(s.body, { scale: 0.2, opacity: 0.9 }, { scale: rnd(1.2, 1.8), y: `-=${rnd(40, 120)}`, opacity: 0, duration: rnd(0.9, 1.4), ease: 'power1.out', onComplete: () => s.remove() });
    }
    scatter(V, T, hT, ['🫧', '✨', '💥'], 10, 140);
    pop(V, T, hT + 120, own(a, 'finish', '¡Eureka!'), 'float-text buff', 1.1);
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.3 });
  };

  // Owain: the whistle, then a red card held high and slapped right in the target's face
  S.redcard = async (V, a, t, impact) => {
    const { v, A, T, C, hT } = ctx(V, a, t), top = V.heightOf(a) + 40;
    pop(V, A, top + 55, own(a, 'cry', '*FWEEET!*'), 'float-text hic', 0.9);
    MB.audio.sfx('whistle');
    await gsap.fromTo(v.figure, { x: -5 }, { x: 5, duration: 0.05, repeat: 5, yoyo: true });
    gsap.set(v.figure, { x: 0 });
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, a.card.attack.color) });
    const card = V.billboard('red-card', '', C.x, C.y);
    gsap.set(card.body, { y: -top, rotation: -20, scale: 0 });
    await gsap.to(card.body, { scale: 1.3, rotation: 8, duration: 0.2, ease: 'back.out(3)' });
    await wait(0.15);
    await Promise.all([gsap.to(card, { x: T.x, y: T.y, duration: 0.14, ease: 'power3.in' }), gsap.to(card.body, { y: -hT, rotation: -10, duration: 0.14 })]);
    impact(); hit(V, t, '#e8283c', true); MB.audio.sfx('slap'); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    pop(V, T, hT + 110, own(a, 'finish', "YOU'RE OUT!"), 'float-text baka', 1.1);
    gsap.to(card.body, { y: 0, rotation: 200, opacity: 0, duration: 0.6, delay: 0.3, ease: 'power2.in', onComplete: () => card.remove() });
    await wait(0.3);
    await goHome(v, A);
  };

  // Shogun: raises his war fan; clan banners rise round the target, and one sweep sends a gale through them
  S.warfan = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 95, own(a, 'cry', 'Advance!'), 'float-text buff', 1);
    const fan = V.billboard('thrown', '🪭', A.x + d.x * 40, A.y);
    gsap.set(fan.body, { y: -V.heightOf(a) * 0.8, scale: 0 });
    gsap.to(fan.body, { scale: 1.2, rotation: -60, duration: 0.3, ease: 'back.out(2)' });
    await glowUp(v, c, -20);
    MB.audio.sfx('buff');
    const banners = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2, P = { x: T.x + Math.cos(ang) * 150, y: T.y + Math.sin(ang) * 60 };
      const b = V.billboard('thrown', '🎌', P.x, P.y);
      banners.push({ b, ang });
      gsap.fromTo(b.body, { y: 40, opacity: 0 }, { y: -40, opacity: 1, duration: 0.3, delay: i * 0.06, ease: 'back.out(2)', onStart: () => MB.audio.sfx('click') });
    }
    await wait(0.6);
    MB.audio.sfx('wind');
    await gsap.to(fan.body, { rotation: 60, duration: 0.18, ease: 'power3.in' });
    for (let i = 0; i < 12; i++) {
      const s = dot(V, { x: A.x, y: A.y + rnd(-30, 30) }, hA + rnd(-40, 40), '#ffffff', rnd(8, 14), 'spark shard');
      gsap.to(s, { x: T.x + rnd(-60, 60), y: T.y + rnd(-20, 20), duration: 0.25, delay: i * 0.015, ease: 'power1.in' });
      gsap.to(s.body, { opacity: 0, duration: 0.15, delay: 0.22 + i * 0.015, onComplete: () => s.remove() });
    }
    await wait(0.25);
    impact(); hit(V, t, c, true); V.shake(16);
    ring(V, T, c, 2.4); ring(V, T, '#ffffff', 1.6);
    banners.forEach(({ b, ang }) => {
      gsap.to(b, { x: T.x + Math.cos(ang) * 320, y: T.y + Math.sin(ang) * 130, duration: 0.6, ease: 'power2.out' });
      gsap.to(b.body, { rotation: rnd(-200, 200), opacity: 0, duration: 0.6, onComplete: () => b.remove() });
    });
    pop(V, T, hT + 110, own(a, 'finish', 'By my decree!'), 'float-text buff', 1);
    gsap.to(fan.body, { opacity: 0, duration: 0.3, onComplete: () => fan.remove() });
    await wait(0.2);
    await glowDown(v);
  };

  // ---------------------------------------------------------------- attack recipes
  // An attack with no style is put together from parts in data.js (catalog.md lists them):
  //   attack: { name, color, move: 'leap', fx: 'rain', prop: ['🍡', '🍙'], hits: 3, floor: 'splat', scatter: ['✨'], big: true }
  // `move` takes the attacker somewhere (or not), then `fx` hits the target from wherever it stands.
  const here = (v) => ({ x: gsap.getProperty(v.el, 'x'), y: gsap.getProperty(v.el, 'y') });
  const RMOVE = {
    stay:  { ranged: true, go: (V, r) => gsap.to(r.v.figure, { y: -30, rotation: -r.d.x * 6, duration: 0.2 }), back: (V, r) => gsap.to(r.v.figure, { y: 0, rotation: 0, duration: 0.3 }) },
    float: { ranged: true, go: (V, r) => glowUp(r.v, r.c, -50), back: (V, r) => glowDown(r.v) },
    dash:  { go: (V, r) => gsap.timeline()
      .to(r.v.img, { scaleY: 0.86, scaleX: 1.12, duration: 0.18 })
      .to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.2, ease: 'power3.in', onUpdate: () => ghost(V, r.v, r.c) })
      .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.2 }, '<') },
    leap:  { go: (V, r) => gsap.timeline()
      .to(r.v.img, { scaleY: 0.8, scaleX: 1.15, duration: 0.15 })
      .add('j').to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.5, ease: 'power1.inOut' }, 'j')
      .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.1 }, 'j')
      .to(r.v.figure, { y: -300, duration: 0.25, ease: 'power2.out' }, 'j')
      .to(r.v.figure, { y: 0, duration: 0.25, ease: 'power3.in' }, 'j+=0.25')
      .call(() => { MB.audio.sfx('slam'); MB.audio.sfx('boing'); V.shake(10); burst(V, r.C, '#c9b79c', 10, { h: 10, spread: 120 }); }) },
    blink: {
      go: async (V, r) => {
        MB.audio.sfx('blink');
        await gsap.to(r.v.figure, { scaleX: 0.05, opacity: 0, duration: 0.12 });
        gsap.set(r.v.el, { x: r.T.x + r.perp.x * 120, y: r.T.y + r.perp.y * 120 });
        await gsap.to(r.v.figure, { scaleX: 1, opacity: 1, duration: 0.1 });
      },
      back: async (V, r) => {
        await gsap.to(r.v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
        gsap.set(r.v.el, r.A);
        await gsap.to(r.v.figure, { scaleX: 1, opacity: 1, duration: 0.15 });
      } },
    spin:  { go: (V, r) => {
      const o = { k: 0 }, w = (k) => 110 * Math.sin(Math.PI * k);
      MB.audio.sfx('whoosh');
      return gsap.timeline()
        .to(o, { k: 1, duration: 0.5, ease: 'power2.in', onUpdate: () => { gsap.set(r.v.el, { x: lerp(r.A.x, r.C.x, o.k) + r.perp.x * w(o.k), y: lerp(r.A.y, r.C.y, o.k) + r.perp.y * w(o.k) }); ghost(V, r.v, r.c); } })
        .to(r.v.figure, { rotationY: 1080, duration: 0.5, ease: 'power2.in' }, 0)
        .set(r.v.figure, { rotationY: 0 });
    } },
    hop:   { go: (V, r) => {
      const tl = gsap.timeline();
      for (let i = 1; i <= 3; i++) {
        const P = { x: lerp(r.A.x, r.C.x, i / 3), y: lerp(r.A.y, r.C.y, i / 3) };
        tl.to(r.v.el, { x: P.x, y: P.y, duration: 0.24, ease: 'none' })
          .to(r.v.figure, { y: -110 - i * 30, duration: 0.12, ease: 'power2.out' }, '<')
          .to(r.v.figure, { y: 0, duration: 0.12, ease: 'power2.in' }, '>')
          .call(() => { MB.audio.sfx('boing'); burst(V, P, r.c, 4, { h: 5, spread: 50 }); });
      }
      return tl;
    } },
    zigzag: { go: (V, r) => {
      const o = { k: 0 };
      MB.audio.sfx('whoosh');
      return gsap.to(o, { k: 1, duration: 0.6, ease: 'none', onUpdate: () => {
        const w = Math.sin(o.k * Math.PI * 5) * 70;
        gsap.set(r.v.el, { x: lerp(r.A.x, r.C.x, o.k) + r.perp.x * w, y: lerp(r.A.y, r.C.y, o.k) + r.perp.y * w });
        ghost(V, r.v, r.c);
      } });
    } },
    // flies over in a high arc and hovers beside the target
    fly: { go: (V, r) => gsap.timeline()
      .to(r.v.img, { scaleY: 0.85, scaleX: 1.1, duration: 0.15 })
      .call(() => MB.audio.sfx('whoosh'))
      .add('f').to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.7, ease: 'sine.inOut', onUpdate: () => ghost(V, r.v, r.c) }, 'f')
      .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.15 }, 'f')
      .to(r.v.figure, { y: -200, rotation: r.d.x * 10, duration: 0.35, ease: 'power2.out' }, 'f')
      .to(r.v.figure, { y: -60, rotation: 0, duration: 0.35, ease: 'sine.inOut' }, 'f+=0.35') },
    // sinks into the floor and pops up beside the target
    dive: {
      go: async (V, r) => {
        MB.audio.sfx('splash'); burst(V, r.A, r.c, 8, { h: 10, spread: 60 });
        await gsap.to(r.v.figure, { y: 120, opacity: 0, duration: 0.3, ease: 'power2.in' });
        gsap.set(r.v.el, r.C);
        ring(V, r.C, r.c, 1.2, 0.5);
        await wait(0.25);
        burst(V, r.C, r.c, 10, { h: 10, spread: 80 }); MB.audio.sfx('whistleUp');
        await gsap.fromTo(r.v.figure, { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
      },
      back: async (V, r) => {
        await gsap.to(r.v.figure, { y: 120, opacity: 0, duration: 0.25, ease: 'power2.in' });
        gsap.set(r.v.el, r.A);
        await gsap.fromTo(r.v.figure, { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.6)' });
      } },
    // winds back, then barrels in kicking up dust
    charge: { go: (V, r) => gsap.timeline()
      .to(r.v.figure, { rotation: -r.d.x * 8, x: -r.d.x * 24, duration: 0.25, ease: 'power2.out' })
      .call(() => MB.audio.sfx('whoosh'))
      .to(r.v.figure, { rotation: r.d.x * 12, x: 0, duration: 0.12 })
      .to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.4, ease: 'power2.in', onUpdate: () => {
        ghost(V, r.v, r.c);
        if (Math.random() < 0.35) burst(V, here(r.v), '#c9b79c', 1, { h: 5, spread: 40 });
      } }, '<')
      .call(() => V.shake(8)) },
    // skids in low
    slide: { go: (V, r) => gsap.timeline()
      .to(r.v.img, { scaleY: 0.82, scaleX: 1.15, duration: 0.15 })
      .to(r.v.figure, { rotation: -r.d.x * 14, duration: 0.15 }, 0)
      .call(() => MB.audio.sfx('zip'))
      .to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.35, ease: 'power3.out', onUpdate: () => {
        ghost(V, r.v, r.c);
        if (Math.random() < 0.4) burst(V, here(r.v), '#c9b79c', 1, { h: 5, spread: 30 });
      } })
      .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.15 })
      .to(r.v.figure, { rotation: 0, duration: 0.15 }, '<') },
  };

  // fx(V, t, r, F, land, o): F is where the attacker stands; land(i) marks hit i (the first one deals the damage)
  const propsOf = (o, def = '✦') => [].concat(o.prop || def);
  const sized = (b, o, base) => { if (o.size) b.body.style.fontSize = base * o.size + 'px'; };
  const RFX = {
    hit: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 1); i++) {
        await gsap.timeline().to(r.v.figure, { x: r.d.x * 26, y: -20, duration: 0.07, ease: 'power2.in' }).to(r.v.figure, { x: 0, y: 0, duration: 0.09 });
        land(i);
      }
    },
    throw: (V, t, r, F, land, o) => {
      const ps = propsOf(o);
      return Promise.all(Array.from({ length: o.hits || 1 }, (_, i) => wait(i * 0.14).then(() => {
        const b = V.billboard('thrown', ps[i % ps.length], F.x, F.y), side = i ? (i % 2 ? 90 : -90) : 0;
        sized(b, o, 70);
        MB.audio.sfx('zip');
        return path(b, (k) => ({ ...arc(F, r.T, r.hA, r.hT, 150, side, r.perp)(k), r: k * 720 }), 0.55, 'power1.in').then(() => { b.remove(); land(i); });
      })));
    },
    volley: (V, t, r, F, land, o) => {
      const ps = propsOf(o);
      MB.audio.sfx('sparkle');
      return Promise.all(Array.from({ length: o.hits || 7 }, (_, i) => wait(i * 0.07).then(() => {
        const s = V.billboard('star-shot', ps[i % ps.length], F.x, F.y);
        s.body.style.setProperty('--c', r.c);
        const side = rnd(-150, 150), peak = rnd(90, 220), TT = { x: r.T.x + rnd(-25, 25), y: r.T.y + rnd(-10, 10) };
        return path(s, (k) => ({ ...arc(F, TT, r.hA, r.hT, peak, side, r.perp)(k), r: k * 720, s: 0.6 + k * 0.6 }), 0.55, 'power1.in').then(() => { s.remove(); land(i); });
      })));
    },
    rain: (V, t, r, F, land, o) => {
      const ps = propsOf(o);
      return Promise.all(Array.from({ length: o.hits || 14 }, (_, i) => {
        const P = { x: r.T.x + rnd(-80, 80), y: r.T.y + rnd(-30, 30) }, d = V.billboard('thrown', ps[i % ps.length], P.x, P.y);
        sized(d, o, 70);
        gsap.set(d.body, { y: -700 - rnd(0, 200), rotation: rnd(-60, 60) });
        return wait(i * 0.045).then(() => gsap.to(d.body, { y: -r.hT * rnd(0.2, 1.1), rotation: `+=${rnd(-200, 200)}`, duration: 0.45, ease: 'power2.in' })).then(() => {
          land(i);
          gsap.to(d.body, { opacity: 0, scale: 1.6, duration: 0.25, onComplete: () => d.remove() });
        });
      }));
    },
    orbit: async (V, t, r, F, land, o) => {
      const ps = propsOf(o), n = o.hits || 5, bs = [];
      for (let i = 0; i < n; i++) { const b = V.billboard('thrown', ps[i % ps.length], r.T.x, r.T.y); b.body.style.fontSize = '46px'; bs.push(b); }
      MB.audio.sfx('sparkle');
      const k = { a: 0, r: 180 };
      await gsap.to(k, { a: Math.PI * 3, r: 20, duration: 0.9, ease: 'power2.in', onUpdate: () => bs.forEach((b, i) => {
        const ang = k.a + (i / n) * Math.PI * 2;
        gsap.set(b, { x: r.T.x + Math.cos(ang) * k.r, y: r.T.y + Math.sin(ang) * k.r * 0.45 });
        gsap.set(b.body, { y: -r.hT - Math.sin(ang) * 20 });
      }) });
      bs.forEach((b) => b.remove());
      for (let i = 0; i < n; i++) land(i);
    },
    slashes: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 3); i++) {
        slashArc(V, r.T, -r.hT, r.c, -40 + i * 50 + rnd(-10, 10));
        MB.audio.sfx('whoosh');
        land(i);
        await wait(0.12);
      }
    },
    pillar: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 3); i++) {
        const P = i ? { x: r.T.x + rnd(-70, 70), y: r.T.y + rnd(-25, 25) } : r.T, f = pillar(V, P, r.c);
        gsap.fromTo(f.body, { scaleY: 0, scaleX: 0.6 }, { scaleY: rnd(0.8, 1.2), scaleX: 1, duration: 0.18, ease: 'power3.out' });
        gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => f.remove() });
        if (!i) MB.audio.sfx('holy');
        land(i);
        await wait(0.1);
      }
    },
    beam: async (V, t, r, F, land) => {
      const N = Math.max(12, Math.round(dirOf(F, r.T).len / 22)), segs = [];
      MB.audio.sfx('beam');
      for (let i = 0; i <= N; i++) { const k = i / N; segs.push(dot(V, { x: lerp(F.x, r.T.x, k), y: lerp(F.y, r.T.y, k) }, lerp(r.hA, r.hT, k), r.c, 46, 'beam-seg')); }
      await gsap.fromTo(segs.map((s) => s.body), { scale: 0 }, { scale: 1, duration: 0.08, stagger: 0.012, ease: 'power2.out' });
      land(0);
      await gsap.to(segs.map((s) => s.body), { scale: () => rnd(0.7, 1.2), duration: 0.06, repeat: 5, yoyo: true });
      await gsap.to(segs.map((s) => s.body), { scale: 0, opacity: 0, duration: 0.25, stagger: 0.005 });
      segs.forEach((s) => s.remove());
    },
    bolt: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 3); i++) {
        const b = V.billboard('bolt', lightningSvg(470 - r.hT * 0.3, r.c), r.T.x + rnd(-20, 20), r.T.y);
        gsap.set(b.body, { yPercent: -100, y: -r.hT * 0.3 });
        await draw(b.body.querySelectorAll('.d'), { duration: 0.07, ease: 'power1.in' });
        MB.audio.sfx(i ? 'zap' : 'thunder');
        land(i);
        gsap.to(b.body, { opacity: 0, duration: 0.18, delay: 0.08, onComplete: () => b.remove() });
        await wait(0.16);
      }
    },
    stamp: async (V, t, r, F, land, o) => {
      const m = V.billboard('stamp-mark', o.mark || 'DENIED', r.T.x, r.T.y);
      gsap.set(m.body, { y: -r.hT, rotation: -12 });
      await gsap.fromTo(m.body, { scale: 3.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power4.in' });
      MB.audio.sfx('slam'); V.hitStop();
      land(0);
      gsap.to(m.body, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.7, onComplete: () => m.remove() });
      await wait(0.5);
    },
    words: (V, t, r, F, land, o) => {
      const ws = o.words || [o.shout || o.name || 'HA!'];
      return Promise.all(ws.map((w, i) => wait(i * 0.1).then(() => {
        const b = V.billboard('float-text ability', w, F.x, F.y), TT = { x: r.T.x + rnd(-30, 30), y: r.T.y + rnd(-12, 12) }, peak = rnd(80, 180), side = rnd(-140, 140);
        b.body.style.color = i % 2 ? '#ffffff' : r.c;
        MB.audio.sfx('click');
        return path(b, (k) => ({ ...arc(F, TT, r.hA + 40, r.hT, peak, side, r.perp)(k), s: 0.6 + k * 0.5 }), 0.55, 'power1.in').then(() => { b.remove(); land(i); });
      })));
    },
    quake: async (V, t, r, F, land, o) => {
      await gsap.to(r.v.img, { scaleY: 0.8, scaleX: 1.18, duration: 0.1, yoyo: true, repeat: 1 });
      MB.audio.sfx('slam'); V.shake(12);
      const n = o.hits || 3;
      for (let i = 1; i <= n; i++) {
        const P = { x: lerp(F.x, r.T.x, i / n), y: lerp(F.y, r.T.y, i / n) };
        ring(V, P, r.c, 1.2 + i * 0.3, 0.5);
        burst(V, P, '#c9b79c', 8, { h: 10, spread: 90 });
        await wait(0.09);
      }
      land(0);
    },
  };
  // the bigger effects: each is a recipe fx and the core of a named style below
  Object.assign(RFX, {
    // burning rocks (or `prop`) streak down from the sky; the last and biggest leaves a crater
    meteor: async (V, t, r, F, land, o) => {
      const n = o.hits || 6, ps = o.prop ? propsOf(o) : null;
      MB.audio.sfx('incoming');
      await Promise.all(Array.from({ length: n }, (_, i) => wait(i * 0.15 + (i === n - 1 ? 0.2 : 0)).then(() => {
        const big = i === n - 1, P = big ? r.T : { x: r.T.x + rnd(-110, 110), y: r.T.y + rnd(-40, 40) }, s = big ? 1.8 : rnd(0.7, 1.1), H = big ? r.hT * 0.6 : 10;
        const m = V.billboard(ps ? 'thrown' : 'meteor', ps ? ps[i % ps.length] : '', P.x - 300, P.y);
        m.body.style.setProperty('--c', r.c);
        return path(m, (k) => ({ x: lerp(P.x - 300, P.x, k), y: P.y, h: lerp(950, H, k), s, r: ps ? k * 360 : 0 }), 0.5, 'power2.in', (p) => {
          if (Math.random() < 0.7) { const e = dot(V, p, p.h + rnd(-10, 10), MB.pick([r.c, '#ffb347', '#fff3c4']), rnd(8, 16)); gsap.to(e.body, { opacity: 0, scale: 0.2, duration: 0.45, onComplete: () => e.remove() }); }
        }).then(() => {
          m.remove();
          flash(V, P, H + 20, r.c, big ? 360 : 160); ring(V, P, r.c, big ? 2.8 : 1.2, 0.6);
          debris(V, P, '#6b4a2e', big ? 16 : 5, { spread: big ? 190 : 90 });
          MB.audio.sfx(big ? 'boom' : 'slam'); V.shake(big ? 22 : 7);
          if (big) decal(V, P, 'crater', r.c, 1.2);
          land(i);
          if (big && i) hit(V, t, r.c, true);
        });
      })));
    },
    // a twister crosses the board, lifts the target and spins it round, then drops it
    tornado: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), O = { x: F.x + r.d.x * 70, y: F.y + r.d.y * 70 }, ps = propsOf(o, ['🍃', '💨', '🍂']);
      const tw = V.billboard('twister', '<i></i><i></i><i></i><i></i><i></i><i></i>', O.x, O.y);
      tw.body.style.setProperty('--c', r.c);
      gsap.set(tw.body, { yPercent: -100, y: 8, transformOrigin: '50% 100%' });
      const sway = gsap.to(tw.body.children, { x: (i) => (i % 2 ? 12 : -12) * (1 + i * 0.35), duration: 0.14, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.03 });
      // whatever the wind picked up circles round the funnel
      const bits = Array.from({ length: 12 }, (_, i) => {
        const b = V.billboard('petal', ps[i % ps.length], O.x, O.y);
        b.body.style.fontSize = rnd(18, 32) + 'px';
        return { b, a: rnd(0, 6.3), h: rnd(20, 280), sp: rnd(0.14, 0.24) };
      });
      const whirl = gsap.to({}, { duration: 1, repeat: -1, onUpdate: () => {
        const x = gsap.getProperty(tw, 'x'), y = gsap.getProperty(tw, 'y');
        bits.forEach((q) => { q.a += q.sp; const rad = 25 + q.h * 0.3; gsap.set(q.b, { x: x + Math.cos(q.a) * rad, y: y + Math.sin(q.a) * rad * 0.35 }); gsap.set(q.b.body, { y: -q.h, rotation: q.a * 50 }); });
      } });
      MB.audio.sfx('tornado');
      gsap.fromTo(tw.body, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
      await wait(0.3);
      const q = { k: 0 };
      await gsap.to(q, { k: 1, duration: 0.8, ease: 'power1.inOut', onUpdate: () => {
        const w = Math.sin(q.k * Math.PI * 2) * 50;
        gsap.set(tw, { x: lerp(O.x, r.T.x, q.k) + r.perp.x * w, y: lerp(O.y, r.T.y, q.k) + r.perp.y * w });
      } });
      land(0); MB.audio.sfx('wind');
      for (let i = 1; i < (o.hits || 3); i++) gsap.delayedCall(i * 0.2, () => land(i));
      if (tv) {
        await gsap.timeline()
          .to(tv.figure, { y: -200, rotationY: 1080, duration: 0.8, ease: 'power1.out', overwrite: 'auto' })
          .to(tv.figure, { y: 0, duration: 0.25, ease: 'power3.in' })
          .set(tv.figure, { rotationY: 0 });
      } else await wait(0.9);
      MB.audio.sfx('slam'); V.shake(14); burst(V, r.T, '#c9b79c', 14, { h: 10, spread: 150 });
      sway.kill(); whirl.kill();
      bits.forEach((q2) => gsap.to(q2.b.body, { y: `-=${rnd(40, 160)}`, x: rnd(-120, 120), opacity: 0, duration: 0.6, onComplete: () => q2.b.remove() }));
      await gsap.to(tw.body, { scaleX: 0.1, opacity: 0, duration: 0.35, onComplete: () => tw.remove() });
    },
    // a black hole opens over the target and drinks in the light, then collapses in a blast
    vortex: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), H = r.hT + 60;
      const disk = V.flat('accretion', '', r.T.x, r.T.y), hole = V.billboard('singularity', '', r.T.x, r.T.y);
      disk.style.setProperty('--c', r.c); hole.body.style.setProperty('--c', r.c);
      gsap.set(hole.body, { y: -H });
      MB.audio.sfx('vortex');
      gsap.fromTo(disk, { scale: 0, opacity: 0 }, { scale: 1.2, opacity: 0.9, duration: 0.5 });
      const dspin = gsap.to(disk, { rotation: '-=720', duration: 2.4, ease: 'none' });
      await gsap.fromTo(hole.body, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
      for (let i = 0; i < 30; i++) {
        const s = dot(V, r.T, H, MB.pick([r.c, '#ffffff', '#9fd3ff']), rnd(6, 13)), q = { a: rnd(0, 6.3), d: rnd(180, 300) };
        gsap.to(q, { a: q.a + rnd(5, 8), d: 0, duration: rnd(0.6, 1), delay: i * 0.025, ease: 'power2.in', onComplete: () => s.remove(), onUpdate: () => {
          gsap.set(s, { x: r.T.x + Math.cos(q.a) * q.d, y: r.T.y + Math.sin(q.a) * q.d * 0.45 });
          gsap.set(s.body, { y: -H - Math.sin(q.a) * q.d * 0.25, scale: 0.3 + q.d / 300 });
        } });
      }
      if (tv) { // pulled toward it
        gsap.to(tv.figure, { scaleY: 1.1, scaleX: 0.88, duration: 0.8 });
        gsap.to(tv.figure, { x: 7, duration: 0.9, ease: WIGGLE });
      }
      await wait(0.95);
      await gsap.to(hole.body, { scale: 0.25, duration: 0.14, ease: 'power3.in' });
      land(0);
      for (let i = 1; i < (o.hits || 1); i++) land(i);
      flash(V, r.T, H, '#ffffff', 560); V.hitStop(); V.shake(24); MB.audio.sfx('boom');
      ring(V, r.T, r.c, 3.2, 0.9); ring(V, r.T, '#ffffff', 2.2, 0.6); debris(V, r.T, r.c, 14, { spread: 190, h: 20 });
      if (tv) gsap.to(tv.figure, { scaleX: 1, scaleY: 1, x: 0, duration: 0.6, ease: 'elastic.out(1,0.35)' });
      gsap.to(hole.body, { scale: 2.4, opacity: 0, duration: 0.3, onComplete: () => hole.remove() });
      gsap.to(disk, { scale: 2, opacity: 0, duration: 0.5, onComplete: () => { dspin.kill(); disk.remove(); } });
      await wait(0.35);
    },
    // a salvo of rockets (prop, default 🚀) climbs, arcs over and dives in trailing smoke
    missiles: (V, t, r, F, land, o) => {
      const ps = propsOf(o, '🚀');
      return Promise.all(Array.from({ length: o.hits || 6 }, (_, i) => wait(i * 0.1).then(() => {
        const S0 = { x: F.x + rnd(-30, 30), y: F.y + rnd(-10, 10) }, TT = { x: r.T.x + rnd(-40, 40), y: r.T.y + rnd(-15, 15) };
        const m = V.billboard('thrown rocket', ps[i % ps.length], S0.x, S0.y);
        sized(m, o, 48);
        MB.audio.sfx(i ? 'zip' : 'missile');
        return path(m, along(arc(S0, TT, r.hA, r.hT * rnd(0.5, 1), rnd(320, 420), rnd(-160, 160), r.perp), o.prop ? 0 : 45), 0.85, 'power1.in', (p) => {
          if (Math.random() < 0.6) { const s = dot(V, p, p.h, '#cfcfd8', rnd(14, 24), 'smoke'); gsap.to(s.body, { scale: 2.2, opacity: 0, duration: 0.6, onComplete: () => s.remove() }); }
        }).then(() => {
          m.remove();
          flash(V, TT, r.hT, '#ffb347', 200); burst(V, TT, '#ff7a1c', 10, { h: r.hT, spread: 90 }); puff(V, TT, '#8a8a96', 4, r.hT * 0.6, 0.8);
          MB.audio.sfx(i ? 'hit' : 'boom'); V.shake(8);
          land(i);
        });
      })));
    },
    // thorny vines (drawn in) sprout round the target and squeeze; flowers (prop) bloom at the tips
    vines: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), ps = propsOf(o, ['🌹', '🌸', '🌺']), vines = [];
      MB.audio.sfx('vines');
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + rnd(-0.3, 0.3), side = Math.cos(ang) > 0 ? -1 : 1, H = Math.round(r.hT * 2 * rnd(0.75, 1)), w = 120, sw = rnd(25, 45) * side;
        const P = { x: r.T.x + Math.cos(ang) * 95, y: r.T.y + Math.sin(ang) * 40 };
        const d = `M${w / 2} ${H} C ${w / 2 - sw} ${H * 0.7}, ${w / 2 + sw} ${H * 0.45}, ${w / 2 - sw * 0.4} ${H * 0.25} S ${w / 2 + sw * 1.2} ${H * 0.02}, ${w / 2 + sw * 0.9} 4`;
        const vb = V.billboard('vine', `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}"><path class="st" d="${d}"/><path class="th" d="${d}"/></svg><i style="left:${w / 2 + sw * 0.9}px">${ps[i % ps.length]}</i>`, P.x, P.y);
        vb.body.style.setProperty('--c', r.c);
        gsap.set(vb.body, { yPercent: -100, y: 6, transformOrigin: '50% 100%' });
        const bloom = vb.body.querySelector('i');
        gsap.set(bloom, { xPercent: -50, yPercent: -40, scale: 0 });
        vines.push({ vb, P, bloom });
      }
      await draw(vines.map((q) => q.vb.body.querySelector('.st')), { duration: 0.55, ease: 'power2.out', stagger: 0.03 });
      gsap.to(vines.map((q) => q.vb.body.querySelector('.th')), { opacity: 1, duration: 0.2 });
      MB.audio.sfx('sparkle');
      await gsap.to(vines.map((q) => q.bloom), { scale: 1, rotation: 360, duration: 0.3, stagger: 0.05, ease: 'back.out(3)' });
      MB.audio.sfx('twang');
      await Promise.all(vines.map((q) => gsap.to(q.vb, { x: lerp(q.P.x, r.T.x, 0.45), y: lerp(q.P.y, r.T.y, 0.45), duration: 0.2, ease: 'power2.in' })));
      for (let i = 0; i < (o.hits || 3); i++) {
        if (tv) gsap.fromTo(tv.figure, { scaleX: 0.86, scaleY: 1.06 }, { scaleX: 1, scaleY: 1, duration: 0.25, ease: 'back.out(3)' });
        burst(V, r.T, '#7dff8a', 6, { h: r.hT, spread: 70, shape: 'shard' }); V.shake(6);
        land(i);
        await wait(0.16);
      }
      scatter(V, r.T, r.hT, ['🍃', ...ps], 10, 150);
      vines.forEach((q, i) => gsap.to(q.vb.body, { scaleY: 0, opacity: 0, duration: 0.35, delay: i * 0.04, onComplete: () => q.vb.remove() }));
      await wait(0.3);
    },
    // a magic circle is drawn under the target, runes float off it, a column of light erupts
    runes: async (V, t, r, F, land, o) => {
      const rc = runeCircle(V, r.T, r.c, { size: 320 });
      MB.audio.sfx('rune');
      await wait(0.7);
      for (let i = 0; i < 10; i++) {
        const g = V.billboard('float-text rune', RUNES[i % RUNES.length], r.T.x + rnd(-120, 120), r.T.y + rnd(-45, 45));
        g.body.style.color = r.c;
        gsap.fromTo(g.body, { y: 0, opacity: 0 }, { y: -rnd(120, 300), opacity: 1, duration: 0.7, delay: i * 0.03, ease: 'power1.out',
          onComplete: () => gsap.to(g.body, { opacity: 0, duration: 0.3, onComplete: () => g.remove() }) });
      }
      const beam = pillar(V, r.T, r.c, 'sky-beam');
      MB.audio.sfx('beam');
      await gsap.fromTo(beam.body, { scaleX: 0 }, { scaleX: 1.2, duration: 0.15, ease: 'power2.out' });
      for (let i = 0; i < (o.hits || 1); i++) { land(i); await wait(0.12); }
      V.shake(14); ring(V, r.T, r.c, 2.6, 0.8); rise(V, r.T, r.c, 12, r.hT * 1.5);
      await gsap.to(beam.body, { scaleX: 0, opacity: 0, duration: 0.4, delay: 0.25 });
      beam.remove(); rc.remove();
    },
    // throwing stars fly in from all round the target
    shuriken: (V, t, r, F, land, o) => {
      const n = o.hits || 4, ps = o.prop ? propsOf(o) : null;
      return Promise.all(Array.from({ length: n }, (_, i) => wait(i * 0.08).then(() => {
        const ang = (i / n) * Math.PI * 2 + 0.6, P = { x: r.T.x + Math.cos(ang) * 260, y: r.T.y + Math.sin(ang) * 110 };
        const s = V.billboard(ps ? 'thrown' : 'shuriken', ps ? ps[i % ps.length] : '', P.x, P.y);
        s.body.style.setProperty('--c', r.c);
        if (ps) sized(s, o, 70);
        MB.audio.sfx('shuriken');
        return path(s, (k) => ({ x: lerp(P.x, r.T.x, k), y: lerp(P.y, r.T.y, k), h: lerp(r.hT + 40, r.hT, k), r: k * 1440 }), 0.3, 'power1.in').then(() => {
          s.remove(); burst(V, r.T, r.c, 5, { h: r.hT, spread: 50, shape: 'shard' }); land(i);
        });
      })));
    },
    // music notes (prop) dance over on a wave
    notes: (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['🎵', '🎶', '♪', '♫']);
      return Promise.all(Array.from({ length: o.hits || 8 }, (_, i) => wait(i * 0.1).then(() => {
        const b = V.billboard('float-text note', ps[i % ps.length], F.x, F.y), TT = { x: r.T.x + rnd(-30, 30), y: r.T.y + rnd(-12, 12) };
        const amp = rnd(30, 60), fr = rnd(1.5, 2.5), base = arc(F, TT, r.hA + 30, r.hT, rnd(60, 130), rnd(-80, 80), r.perp);
        b.body.style.color = i % 2 ? '#ffffff' : r.c;
        MB.audio.sfx(i % 3 ? 'pop' : 'ding');
        return path(b, (k) => { const p = base(k), w = Math.sin(k * Math.PI * 2 * fr); return { ...p, h: p.h + w * amp * (1 - k), r: w * 18, s: 0.8 + k * 0.5 }; }, 0.8, 'sine.inOut')
          .then(() => { b.remove(); land(i); });
      })));
    },
    // a big bubble drifts over, swallows the target, lifts it up and pops
    bubble: async (V, t, r, F, land, o) => {
      const tv = !t.isLeader && V.ents.get(t.uid), big = V.billboard('bubble-ball', '', F.x, F.y);
      big.body.style.setProperty('--c', r.c);
      for (let i = 0; i < 8; i++) {
        const s = V.billboard('bubble-ball small', '', F.x + rnd(-30, 30), F.y);
        s.body.style.setProperty('--c', r.c);
        gsap.fromTo(s.body, { y: -r.hA, scale: 0 }, { y: -r.hA - rnd(80, 220), x: rnd(-90, 90), scale: rnd(0.6, 1.2), duration: rnd(0.7, 1.1), delay: i * 0.06, ease: 'sine.out',
          onComplete: () => { MB.audio.sfx('bubble'); gsap.to(s.body, { scale: 1.6, opacity: 0, duration: 0.12, onComplete: () => s.remove() }); } });
      }
      MB.audio.sfx('bubble');
      gsap.set(big.body, { y: -r.hA, scale: 0.2 });
      await gsap.to(big.body, { scale: 0.8, duration: 0.45, ease: 'back.out(2)' });
      await path(big, (k) => ({ ...arc(F, r.T, r.hA, r.hT * 1.1, 90, 60, r.perp)(k), s: 0.8 + k * 1.1 }), 0.9, 'sine.inOut');
      land(0); MB.audio.sfx('bubble');
      const wob = gsap.fromTo(big.body, { scaleX: 1.9, scaleY: 1.9 }, { scaleX: 2.05, scaleY: 1.75, duration: 0.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      if (tv) await Promise.all([gsap.to(tv.figure, { y: -150, duration: 0.7, ease: 'sine.out', overwrite: 'auto' }), gsap.to(big.body, { y: -r.hT * 1.1 - 150, duration: 0.7, ease: 'sine.out' })]);
      else await wait(0.5);
      wob.kill();
      MB.audio.sfx('pop');
      gsap.to(big.body, { scale: 2.8, opacity: 0, duration: 0.18, onComplete: () => big.remove() });
      droplets(V, r.T, 16);
      for (let i = 1; i < (o.hits || 1); i++) land(i);
      if (tv) {
        await gsap.to(tv.figure, { y: 0, duration: 0.35, ease: 'power3.in' });
        gsap.fromTo(tv.figure, { scaleY: 0.85, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1,0.4)' });
        MB.audio.sfx('slam'); V.shake(12); burst(V, r.T, '#c9b79c', 12, { h: 10, spread: 130 });
      }
      await wait(0.2);
    },
    // copies of the attacker surround the target and strike one after another
    clones: async (V, t, r, F, land, o) => {
      const v = r.v, n = Math.min(6, o.hits || 4), html = v.img.tagName === 'IMG' ? `<img src="${v.img.src}">` : v.img.outerHTML;
      MB.audio.sfx('poof');
      const cl = Array.from({ length: n }, (_, i) => {
        const g = V.billboard('ghost clone', html, F.x, F.y), ang = (i / n) * Math.PI * 2 + Math.PI / 2;
        g.body.style.setProperty('--c', r.c); g.body.style.height = v.stand.style.height;
        gsap.set(g.body, { yPercent: -100, y: 0, opacity: 0 });
        return { g, P: { x: r.T.x + Math.cos(ang) * 150, y: r.T.y + Math.sin(ang) * 70 } };
      });
      await Promise.all(cl.map(({ g, P }, i) => gsap.timeline({ delay: i * 0.05 }).to(g.body, { opacity: 1, duration: 0.1 }).to(g, { x: P.x, y: P.y, duration: 0.3, ease: 'power2.out' }, 0)));
      for (let i = 0; i < n; i++) {
        const { g, P } = cl[i];
        await gsap.to(g, { x: lerp(P.x, r.T.x, 0.6), y: lerp(P.y, r.T.y, 0.6), duration: 0.09, ease: 'power3.in' });
        slashArc(V, r.T, -r.hT, r.c, rnd(-80, 80));
        MB.audio.sfx('whoosh'); land(i);
        gsap.to(g, { x: P.x, y: P.y, duration: 0.12 });
      }
      await wait(0.15);
      const home = here(v);
      await Promise.all(cl.map(({ g }) => gsap.to(g, { x: home.x, y: home.y, duration: 0.25, ease: 'power2.in' }).then(() => g.remove())));
      flash(V, home, r.hA, r.c, 160);
    },
    // a reticle locks on, a beat of silence, one shot
    snipe: async (V, t, r, F, land, o) => {
      const ret = V.billboard('reticle', '<i></i>', r.T.x, r.T.y);
      ret.body.style.setProperty('--c', r.c);
      gsap.set(ret.body, { y: -r.hT });
      MB.audio.sfx('scope');
      await gsap.fromTo(ret.body, { scale: 3, rotation: -120, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      await gsap.to(ret.body, { scale: 0.75, duration: 0.12, yoyo: true, repeat: 1 });
      MB.audio.sfx('click');
      await wait(0.3);
      for (let i = 0; i < (o.hits || 1); i++) {
        const N = Math.max(10, Math.round(dirOf(F, r.T).len / 18)), segs = [];
        for (let j = 0; j <= N; j++) { const k = j / N; segs.push(dot(V, { x: lerp(F.x, r.T.x, k), y: lerp(F.y, r.T.y, k) }, lerp(r.hA, r.hT, k), '#fff6c8', 12, 'beam-seg')); }
        gsap.fromTo(segs.map((s) => s.body), { scale: 0 }, { scale: 1, duration: 0.03, stagger: 0.003 });
        gsap.to(segs.map((s) => s.body), { opacity: 0, scaleY: 0.2, duration: 0.25, delay: 0.1, onComplete: () => segs.forEach((s) => s.remove()) });
        gsap.fromTo(r.v.figure, { x: -r.d.x * 18 }, { x: 0, duration: 0.3, ease: 'power2.out' });
        flash(V, F, r.hA, '#ffe28a', 120);
        MB.audio.sfx('gunshot');
        await wait(0.06);
        land(i);
        if (!i) V.hitStop();
        V.shake(12);
        debris(V, F, '#e8c35a', 1, { h: r.hA, spread: 40 }); // the shell casing
        await wait(0.25);
      }
      gsap.to(ret.body, { scale: 1.5, opacity: 0, duration: 0.3, onComplete: () => ret.remove() });
    },
    // the floor cracks open (drawn in) and lava geysers erupt
    lava: async (V, t, r, F, land, o) => {
      const cracks = Array.from({ length: 7 }, (_, i) => {
        let a = (i / 7) * Math.PI * 2 + rnd(-0.2, 0.2), x = 180, y = 180, pts = '180,180';
        for (let s = 0; s < 5; s++) { a += rnd(-0.5, 0.5); x += Math.cos(a) * rnd(22, 36); y += Math.sin(a) * rnd(22, 36); pts += ` ${x.toFixed(1)},${y.toFixed(1)}`; }
        return `<polyline class="d" points="${pts}"/>`;
      }).join('');
      const f = V.flat('cracks', `<svg viewBox="0 0 360 360" width="360" height="360"><g fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">${cracks}</g></svg>`, r.T.x, r.T.y);
      f.style.color = '#ffb347'; f.style.setProperty('--c', r.c);
      MB.audio.sfx('shatter'); V.shake(6);
      await draw(f.querySelectorAll('.d'), { duration: 0.45, ease: 'power2.out' });
      decal(V, r.T, 'lava', r.c, 1.4);
      MB.audio.sfx('lava');
      for (let i = 0; i < (o.hits || 4); i++) {
        const P = i ? { x: r.T.x + rnd(-90, 90), y: r.T.y + rnd(-35, 35) } : r.T, g = pillar(V, P, r.c, i ? 'pillar' : 'pillar lava');
        gsap.fromTo(g.body, { scaleY: 0, scaleX: 0.5 }, { scaleY: rnd(0.9, 1.3), scaleX: 1, duration: 0.18, ease: 'power3.out' });
        gsap.to(g.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.35, onComplete: () => g.remove() });
        debris(V, P, '#3a2414', 5, { spread: 120 }); rise(V, P, '#ffb347', 6, r.hT);
        land(i); V.shake(8);
        await wait(0.12);
      }
      gsap.to(f, { opacity: 0, duration: 0.6, delay: 0.4, onComplete: () => f.remove() });
      await wait(0.3);
    },
    // a blown kiss (prop, default 💋) wobbles over; the target is charmed, hearts circling its head
    kiss: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), ps = propsOf(o, '💋');
      await Promise.all(Array.from({ length: o.hits || 1 }, (_, i) => wait(i * 0.15).then(() => {
        const k0 = V.billboard('thrown', ps[i % ps.length], F.x, F.y), side = i ? (i % 2 ? 70 : -70) : 0;
        sized(k0, o, 70);
        MB.audio.sfx('kiss');
        return path(k0, (k) => ({ ...arc(F, r.T, r.hA + 20, r.hT + 30, 110, side, r.perp)(k), r: Math.sin(k * Math.PI * 4) * 16, s: 0.6 + k * 0.8 + Math.sin(k * Math.PI * 6) * 0.1 }), 0.8, 'sine.inOut', (p) => {
          if (Math.random() < 0.3) { const h = V.billboard('petal', '💗', p.x, p.y); gsap.set(h.body, { y: -p.h, scale: rnd(0.4, 0.8) }); gsap.to(h.body, { y: '-=50', opacity: 0, duration: 0.7, onComplete: () => h.remove() }); }
        }).then(() => { gsap.to(k0.body, { scale: 2.4, opacity: 0, duration: 0.3, onComplete: () => k0.remove() }); land(i); });
      })));
      const H = V.heightOf(t) + 10, hs = [0, 1, 2, 3, 4].map(() => { const h = V.billboard('petal', '💗', r.T.x, r.T.y); h.body.style.fontSize = '30px'; return h; });
      if (tv) gsap.fromTo(tv.figure, { rotation: -6 }, { rotation: 6, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => gsap.to(tv.figure, { rotation: 0, duration: 0.2 }) });
      const q = { a: 0 };
      await gsap.to(q, { a: Math.PI * 4, duration: 1.1, ease: 'none', onUpdate: () => hs.forEach((h, i) => {
        const ang = q.a + (i / 5) * Math.PI * 2;
        gsap.set(h, { x: r.T.x + Math.cos(ang) * 60, y: r.T.y + Math.sin(ang) * 22 }); gsap.set(h.body, { y: -H - Math.sin(ang) * 12 });
      }) });
      hs.forEach((h) => gsap.to(h.body, { y: '-=50', opacity: 0, duration: 0.4, onComplete: () => h.remove() }));
    },
    // a ring of swords appears over the target, turns and falls blade by blade
    blades: async (V, t, r, F, land, o) => {
      const n = o.hits || 8, ps = o.prop ? propsOf(o) : null, top = r.hT + 250;
      const bl = Array.from({ length: n }, (_, i) => {
        const b = V.billboard(ps ? 'thrown' : 'blade', ps ? ps[i % ps.length] : '<i></i><b></b>', r.T.x, r.T.y);
        b.body.style.setProperty('--c', r.c);
        if (ps) sized(b, o, 70);
        return { b, a0: (i / n) * Math.PI * 2 };
      });
      const q = { a: 0, R: 60 };
      const place = () => bl.forEach(({ b, a0 }) => {
        const ang = a0 + q.a;
        gsap.set(b, { x: r.T.x + Math.cos(ang) * q.R, y: r.T.y + Math.sin(ang) * q.R * 0.45 }); gsap.set(b.body, { y: -top - Math.sin(ang) * 20 });
      });
      place();
      gsap.fromTo(bl.map((x) => x.b.body), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, stagger: 0.04, ease: 'back.out(3)' });
      MB.audio.sfx('sparkle');
      await gsap.to(q, { a: Math.PI * 1.5, R: 150, duration: 0.8, ease: 'power2.inOut', onUpdate: place });
      MB.audio.sfx('swish');
      for (let i = 0; i < n; i++) {
        const { b } = bl[i], P = { x: lerp(gsap.getProperty(b, 'x'), r.T.x, 0.55), y: lerp(gsap.getProperty(b, 'y'), r.T.y, 0.55) };
        gsap.to(b, { x: P.x, y: P.y, duration: 0.14, ease: 'power3.in' });
        await gsap.to(b.body, { y: -r.hT * rnd(0.2, 0.9), duration: 0.14, ease: 'power3.in' });
        burst(V, P, r.c, 4, { h: r.hT * 0.5, spread: 50, shape: 'shard' });
        if (i % 3 === 0) MB.audio.sfx('clang');
        land(i); V.shake(5);
        gsap.to(b.body, { opacity: 0, duration: 0.3, delay: 0.35, onComplete: () => b.remove() });
      }
      await wait(0.3);
    },
    // a terminal pops up over the target, code rains down, it glitches, HACKED (mark)
    hack: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), lines = o.words || ['> ping target', '> inject payload', '> ██████ 100%'];
      const term = V.billboard('terminal', '<pre></pre>', r.T.x, r.T.y), pre = term.body.firstChild;
      term.body.style.setProperty('--c', r.c);
      gsap.set(term.body, { y: -r.hT - 190 });
      await gsap.fromTo(term.body, { scaleY: 0 }, { scaleY: 1, duration: 0.2, ease: 'power2.out' });
      const full = lines.join('\n'), q = { n: 0 };
      await gsap.to(q, { n: full.length, duration: 0.9, ease: 'none', onUpdate: () => {
        const s = full.slice(0, Math.round(q.n));
        if (s !== pre.textContent) { pre.textContent = s; if (s.length % 3 === 0) MB.audio.sfx('click'); }
      } });
      for (let i = 0; i < 14; i++) {
        const cd = V.billboard('float-text code', Array.from({ length: 4 }, () => (Math.random() < 0.5 ? '0' : '1')).join(''), r.T.x + rnd(-90, 90), r.T.y + rnd(-30, 30));
        cd.body.style.color = r.c;
        gsap.set(cd.body, { y: -600 });
        gsap.to(cd.body, { y: -rnd(0, r.hT * 1.5), duration: rnd(0.35, 0.6), delay: i * 0.03, ease: 'power1.in', onComplete: () => gsap.to(cd.body, { opacity: 0, duration: 0.2, onComplete: () => cd.remove() }) });
      }
      await wait(0.45);
      if (tv) {
        gsap.set(tv.figure, { filter: 'drop-shadow(5px 0 0 #ff2a6d) drop-shadow(-5px 0 0 #00e5ff)' });
        gsap.fromTo(tv.figure, { x: -8 }, { x: 8, duration: 0.04, repeat: 11, yoyo: true, ease: 'steps(1)', onComplete: () => gsap.set(tv.figure, { x: 0, clearProps: 'filter' }) });
      }
      for (let i = 0; i < (o.hits || 3); i++) { land(i); MB.audio.sfx(i ? 'zap' : 'glitch'); await wait(0.12); }
      const m = V.billboard('stamp-mark', o.mark || 'HACKED', r.T.x, r.T.y);
      m.body.style.color = r.c;
      gsap.set(m.body, { y: -r.hT, rotation: -10 });
      await gsap.fromTo(m.body, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: 'power4.in' });
      V.shake(10); MB.audio.sfx('slam');
      gsap.to([m.body, term.body], { opacity: 0, duration: 0.3, delay: 0.6, onComplete: () => { m.remove(); term.remove(); } });
      await wait(0.5);
    },
    // snap snap snap: camera flashes, and the photos flutter down round the target
    camera: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), C0 = { x: F.x + 30, y: F.y }, src = tv && tv.img.tagName === 'IMG' ? tv.img.src : '';
      const cam = V.billboard('thrown', propsOf(o, '📸')[0], C0.x, C0.y);
      gsap.set(cam.body, { y: -r.hA - 40 });
      await gsap.fromTo(cam.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
      for (let i = 0; i < (o.hits || 3); i++) {
        await gsap.fromTo(cam.body, { scale: 1.25 }, { scale: 1, duration: 0.12 });
        MB.audio.sfx('camera');
        flash(V, r.T, r.hT, '#ffffff', 700); flash(V, C0, r.hA + 40, '#ffffff', 200);
        if (tv) gsap.fromTo(tv.figure, { filter: 'brightness(2.5)' }, { filter: 'brightness(1)', duration: 0.3, clearProps: 'filter' });
        land(i);
        await wait(0.18);
      }
      MB.audio.sfx('draw');
      const all = Array.from({ length: 6 }, (_, i) => {
        const ph = V.billboard('polaroid', `<div>${src ? `<img src="${src}">` : ''}</div>`, C0.x, C0.y);
        ph.body.style.setProperty('--c', r.c);
        const TT = { x: r.T.x + rnd(-100, 100), y: r.T.y + rnd(-40, 40) }, spin = rnd(-40, 40), side = rnd(-80, 80);
        return wait(i * 0.06).then(() => path(ph, (k) => ({ ...arc(C0, TT, r.hA + 40, rnd(0, 20), 160, side, r.perp)(k), r: spin * k + Math.sin(k * 9) * 10 }), 0.7, 'sine.out'))
          .then(() => gsap.to(ph.body, { opacity: 0, duration: 0.4, delay: 0.5, onComplete: () => ph.remove() }));
      });
      gsap.to(cam.body, { scale: 0, duration: 0.25, delay: 0.3, onComplete: () => cam.remove() });
      await Promise.all(all);
    },
    // a field of crushing gravity: rocks float up, then everything slams down
    gravity: async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid), field = V.billboard('gravity-field', '<i></i>', r.T.x, r.T.y);
      field.body.style.setProperty('--c', r.c);
      gsap.set(field.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
      MB.audio.sfx('dark');
      gsap.fromTo(field.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3 });
      const scroll = gsap.fromTo(field.body.firstChild, { backgroundPosition: '0px 0px' }, { backgroundPosition: '0px 120px', duration: 0.35, repeat: -1, ease: 'none' });
      const rocks = Array.from({ length: 8 }, () => {
        const P = { x: r.T.x + rnd(-120, 120), y: r.T.y + rnd(-45, 45) }, b = V.billboard('petal', '🪨', P.x, P.y);
        b.body.style.fontSize = rnd(22, 40) + 'px';
        gsap.to(b.body, { y: -rnd(80, 200), rotation: rnd(-60, 60), duration: 0.8, ease: 'sine.out' });
        return b;
      });
      if (tv) gsap.to(tv.figure, { y: -30, duration: 0.8, ease: 'sine.out', overwrite: 'auto' });
      await wait(0.85);
      MB.audio.sfx('whoosh');
      rocks.forEach((b) => gsap.to(b.body, { y: 0, duration: 0.14, ease: 'power4.in', onComplete: () => gsap.to(b.body, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => b.remove() }) }));
      if (tv) await gsap.to(tv.figure, { y: 0, scaleY: 0.62, scaleX: 1.3, duration: 0.14, ease: 'power4.in' });
      else await wait(0.14);
      land(0);
      for (let i = 1; i < (o.hits || 1); i++) land(i);
      MB.audio.sfx('slam'); V.shake(24); V.hitStop();
      decal(V, r.T, 'crater', r.c, 1); ring(V, r.T, r.c, 2.8, 0.7); debris(V, r.T, '#6b4a2e', 12, { spread: 170 });
      await wait(0.35);
      if (tv) gsap.to(tv.figure, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)' });
      gsap.to(field.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => { scroll.kill(); field.remove(); } });
      await wait(0.3);
    },
    // crystal spikes burst out of the floor in a line to the target
    spikes: async (V, t, r, F, land, o) => {
      for (let i = 1; i <= 6; i++) {
        const k = i / 6, last = i === 6, P = { x: lerp(F.x, r.T.x, k) + rnd(-15, 15), y: lerp(F.y, r.T.y, k) + rnd(-8, 8) };
        for (let j = 0; j < (last ? 3 : 1); j++) {
          const Q = j ? { x: P.x + rnd(-50, 50), y: P.y + rnd(-20, 20) } : P, s = V.billboard('spike', '', Q.x, Q.y);
          s.body.style.setProperty('--c', r.c);
          gsap.set(s.body, { yPercent: -100, y: 6, transformOrigin: '50% 100%', rotation: rnd(-18, 18) });
          gsap.fromTo(s.body, { scaleY: 0 }, { scaleY: (last ? 1.4 : 0.8) * rnd(0.8, 1.1), duration: 0.12, ease: 'back.out(2)' });
          gsap.to(s.body, { opacity: 0, scaleY: 0, duration: 0.3, delay: 0.5, onComplete: () => s.remove() });
        }
        burst(V, P, r.c, 4, { h: 20, spread: 50, shape: 'shard' }); MB.audio.sfx(last ? 'stab' : 'click'); V.shake(3);
        if (last) { for (let h = 0; h < (o.hits || 1); h++) land(h); V.shake(12); }
        await wait(0.07);
      }
      await wait(0.3);
    },
    // a bomb (prop, default 💣) drops on the target, blinks three times and goes off
    explode: async (V, t, r, F, land, o) => {
      const bomb = V.billboard('thrown', propsOf(o, '💣')[0], r.T.x, r.T.y);
      sized(bomb, o, 70);
      gsap.set(bomb.body, { y: -800 });
      await gsap.to(bomb.body, { y: -20, duration: 0.45, ease: 'bounce.out' });
      for (let i = 0; i < 3; i++) { MB.audio.sfx('click'); await gsap.fromTo(bomb.body, { scale: 1, filter: 'brightness(1)' }, { scale: 1.25, filter: 'brightness(2.5)', duration: 0.1, yoyo: true, repeat: 1 }); }
      bomb.remove();
      const fb = dot(V, r.T, r.hT, '#ff7a1c', 220, 'fireball');
      gsap.fromTo(fb.body, { scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => fb.remove() });
      flash(V, r.T, r.hT, '#fff3c4', 520);
      MB.audio.sfx('boom'); V.shake(24); V.hitStop();
      ring(V, r.T, '#ffb347', 3.4, 0.8); ring(V, r.T, '#ffffff', 2.2, 0.5);
      debris(V, r.T, '#3a2a20', 14, { spread: 200 }); puff(V, r.T, '#6d6470', 10, r.hT, 1.4);
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      await wait(0.5);
    },
    // jaws snap shut on the target
    chomp: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 1); i++) { await chomp(V, r.T, r.hT, r.c, i ? 0.8 : 1); land(i); V.shake(12); }
    },
    // three claw marks rake the target
    claws: async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 3); i++) {
        const cl = V.billboard('claw', '<i></i><i></i><i></i>', r.T.x, r.T.y);
        cl.body.style.setProperty('--c', r.c);
        gsap.set(cl.body, { y: -r.hT, rotation: -25 + (i % 3) * 25 });
        gsap.fromTo(cl.body.children, { scaleY: 0 }, { scaleY: 1, duration: 0.12, stagger: 0.03, ease: 'power3.out' });
        gsap.to(cl.body, { opacity: 0, duration: 0.3, delay: 0.25, onComplete: () => cl.remove() });
        MB.audio.sfx('swish'); land(i);
        await wait(0.13);
      }
    },
    // a whirlpool opens under the target and a water spout blasts it upward
    geyser: async (V, t, r, F, land, o) => {
      decal(V, r.T, 'whirlpool', r.c, 0.8);
      MB.audio.sfx('wave');
      await wait(0.35);
      const g = pillar(V, r.T, '#7fd6ff', 'sky-beam');
      MB.audio.sfx('splash');
      await gsap.fromTo(g.body, { scaleX: 0 }, { scaleX: 1.3, duration: 0.15 });
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      droplets(V, r.T, 22); V.shake(12);
      gsap.to(g.body, { scaleX: 0, opacity: 0, duration: 0.4, delay: 0.25, onComplete: () => g.remove() });
      await wait(0.4);
    },
  });

  // land(i) marks hit i of an effect: the first one deals the damage (impact and a hit), the rest are follow-ups
  function lander(V, t, impact, r, o) {
    let first = true;
    const land = (i) => {
      if (!first) { if (i % 2 === 0) MB.audio.sfx('hit'); burst(V, r.T, r.c, 5, { h: r.hT, spread: 70 }); return; }
      first = false;
      impact(); hit(V, t, r.c, o.big);
      if (o.big) V.shake(14);
    };
    land.done = () => !first;
    return land;
  }

  async function recipe(V, a, t, impact) {
    const o = a.card.attack, r = ctx(V, a, t);
    const moveName = o.move || (!o.fx || o.fx === 'hit' ? 'dash' : 'stay'), m = RMOVE[moveName] || RMOVE.dash;
    const fxName = o.fx || (m.ranged ? 'throw' : 'hit');
    await m.go(V, r);
    const F = m.ranged ? r.A : here(r.v);
    const land = lander(V, t, impact, r, o);
    await (RFX[fxName] || RFX.hit)(V, t, r, F, land, o);
    if (!land.done()) land(0);
    await wait(0.2);
    await (m.back ? m.back(V, r) : goHome(r.v, r.A));
  }

  // ---------------------------------------------------------------- effect styles
  // Named styles built on the effects above. attack.emoji becomes the effect's prop, hits/size work too.
  const fxOpts = (a) => ({ ...a.card.attack, prop: a.card.attack.prop || a.card.attack.emoji, big: a.card.attack.big ?? true });
  // wind up, run the effect from where the attacker stands, wind down
  const effect = (fx, { up, down, cry, finish, cls = 'float-text buff' } = {}) => async (V, a, t, impact) => {
    const r = ctx(V, a, t), o = fxOpts(a);
    if (cry) pop(V, r.A, V.heightOf(a) + 30, own(a, 'cry', cry), cls, 1);
    if (up) await up(V, r);
    await RFX[fx](V, t, r, r.A, lander(V, t, impact, r, o), o);
    if (finish) pop(V, r.T, r.hT + 110, own(a, 'finish', finish), cls, 1.1);
    await wait(0.15);
    if (down) await down(V, r);
  };
  const lift = (y) => (V, r) => glowUp(r.v, r.c, y), settle = (V, r) => glowDown(r.v);
  const lean = (V, r) => gsap.to(r.v.figure, { y: -20, rotation: -r.d.x * 8, duration: 0.25 }), unlean = (V, r) => gsap.to(r.v.figure, { y: 0, rotation: 0, duration: 0.3 });

  S.meteor = effect('meteor', { up: lift(-40), down: settle, finish: 'Wish upon THAT!' });
  S.tornado = effect('tornado', { up: (V, r) => gsap.to(r.v.figure, { rotationY: 720, duration: 0.5, ease: 'power2.in', onComplete: () => gsap.set(r.v.figure, { rotationY: 0 }) }), finish: 'Gone with the wind!' });
  S.blackhole = effect('vortex', { up: lift(-50), down: settle, cry: 'Fall into the void.', cls: 'float-text debuff' });
  S.missiles = effect('missiles', { up: lean, down: unlean, cry: 'Lock on!', finish: 'Direct hit!' });
  S.vines = effect('vines', { up: lift(-20), down: settle, finish: 'Bloom~' , cls: 'float-text heal' });
  S.runes = effect('runes', { up: lift(-50), down: settle, cry: 'By the old words...', cls: 'float-text ability' });
  S.bubble = effect('bubble', { up: (V, r) => gsap.to(r.v.img, { scaleX: 1.08, scaleY: 0.94, duration: 0.3, yoyo: true, repeat: 1 }), finish: 'Pop!', cls: 'float-text shield' });
  S.clones = effect('clones', { up: lift(-20), down: settle, cry: 'Which one is real?', cls: 'float-text ability' });
  S.snipe = effect('snipe', { up: lean, down: unlean, finish: 'Target down.', cls: 'float-text shield' });
  S.volcano = effect('lava', { up: (V, r) => gsap.to(r.v.img, { scaleY: 0.85, scaleX: 1.12, duration: 0.15, yoyo: true, repeat: 1 }), cry: 'ERUPT!', cls: 'float-text burn' });
  S.kiss = effect('kiss', { up: lean, down: unlean, cry: 'Chu~ ♥', finish: 'Charmed~', cls: 'float-text baka' });
  S.blades = effect('blades', { up: lift(-40), down: settle, cry: 'Rain of steel!', cls: 'float-text shield' });
  S.hack = effect('hack', { up: (V, r) => gsap.fromTo(r.v.figure, { x: -3 }, { x: 3, duration: 0.05, repeat: 7, yoyo: true, onComplete: () => gsap.set(r.v.figure, { x: 0 }) }), cry: '> sudo hack', cls: 'float-text heal' });
  S.camera = effect('camera', { cry: 'Say cheese~!', finish: 'Perfect shot~' });
  S.gravity = effect('gravity', { up: lift(-40), down: settle, cry: 'Kneel.', cls: 'float-text debuff' });
  S.spikes = effect('spikes', { up: (V, r) => gsap.to(r.v.img, { scaleY: 0.85, scaleX: 1.12, duration: 0.15, yoyo: true, repeat: 1 }), finish: 'Shatter!', cls: 'float-text shield' });

  // music: a spotlight, notes dance over on a wave and burst into hearts
  S.melody = async (V, a, t, impact) => {
    const r = ctx(V, a, t), { v, A, T, hT, c } = r, o = fxOpts(a);
    const spot = pillar(V, A, c, 'sky-beam spot');
    gsap.fromTo(spot.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3 });
    const sway = gsap.fromTo(v.figure, { rotation: -5 }, { rotation: 5, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', '♪ La la la~ ♪'), 'float-text buff', 1); MB.audio.sfx('melody');
    await RFX.notes(V, t, r, A, lander(V, t, impact, r, o), o);
    sway.kill(); gsap.to(v.figure, { rotation: 0, duration: 0.3 });
    scatter(V, T, hT, ['💖', '🎵', '✨'], 12, 150); ring(V, T, c, 2);
    pop(V, T, hT + 110, own(a, 'finish', 'ENCORE!'), 'float-text buff', 1.1);
    gsap.to(spot.body, { scaleX: 0, opacity: 0, duration: 0.4, onComplete: () => spot.remove() });
    await wait(0.4);
  };

  // smoke bomb, throwing stars from every side, then a strike from behind
  S.ninja = async (V, a, t, impact) => {
    const r = ctx(V, a, t), { v, A, T, d, hT, c } = r, o = fxOpts(a), land = lander(V, t, impact, r, o);
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Ninpō!'), 'float-text ability', 0.9);
    MB.audio.sfx('poof'); puff(V, A, '#d6d6e0', 10, 60);
    await gsap.to(v.figure, { opacity: 0, duration: 0.12 });
    await RFX.shuriken(V, t, r, A, land, o);
    const B = { x: T.x + d.x * 110, y: T.y + d.y * 110 };
    gsap.set(v.el, B); puff(V, B, '#d6d6e0', 8, 60); MB.audio.sfx('blink');
    await gsap.to(v.figure, { opacity: 1, duration: 0.1 });
    slashArc(V, T, -hT, c, 30);
    gsap.fromTo(v.figure, { x: -d.x * 24 }, { x: 0, duration: 0.15 });
    land(99); flash(V, T, hT, '#ffffff', 200); V.shake(10); MB.audio.sfx('hit');
    pop(V, T, hT + 100, own(a, 'finish', '...Nin.'), 'float-text shield', 0.9);
    await wait(0.3);
    puff(V, B, '#d6d6e0', 8, 60);
    await gsap.to(v.figure, { opacity: 0, duration: 0.1 });
    gsap.set(v.el, A); puff(V, A, '#d6d6e0', 8, 60);
    await gsap.to(v.figure, { opacity: 1, duration: 0.15 });
  };

  // "Time, stop!": a clock, the world drains of color, the attacker blinks round the target leaving cuts hanging
  // in the air; time moves again and they all land at once
  S.timestop = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = V.ents.get(t.uid), bg = document.getElementById('bg');
    const clock = V.billboard('clock', '<i class="h"></i><i class="m"></i>', A.x, A.y);
    clock.body.style.setProperty('--c', c);
    gsap.set(clock.body, { y: -H - 80 });
    await gsap.fromTo(clock.body, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
    pop(V, A, H + 170, own(a, 'cry', 'Time, stop!'), 'float-text ability', 1);
    MB.audio.sfx('tick');
    const [hh, mm] = clock.body.children;
    await Promise.all([gsap.to(mm, { rotation: 720, duration: 0.6, ease: 'power2.in' }), gsap.to(hh, { rotation: 60, duration: 0.6, ease: 'power2.in' })]);
    MB.audio.sfx('dark'); ring(V, A, '#ffffff', 5, 0.7);
    if (bg) gsap.to(bg, { filter: 'grayscale(1) invert(0.9) brightness(0.8)', duration: 0.25 });
    if (tv) gsap.to(tv.figure, { filter: 'grayscale(1) brightness(0.8)', duration: 0.25 });
    await wait(0.3);
    const cuts = [];
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + 0.4;
      gsap.set(v.el, { x: T.x + Math.cos(ang) * 130, y: T.y + Math.sin(ang) * 60 });
      ghost(V, v, c); MB.audio.sfx('whoosh');
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT, rotation: rnd(-80, 80) });
      gsap.fromTo(s.body, { scale: 0.2 }, { scale: 1.1, duration: 0.08 });
      cuts.push(s);
      await wait(0.13);
    }
    gsap.set(v.el, A);
    await wait(0.35);
    if (bg) gsap.to(bg, { filter: 'none', duration: 0.2, clearProps: 'filter' });
    if (tv) gsap.to(tv.figure, { filter: 'none', duration: 0.2, clearProps: 'filter' });
    impact(); hit(V, t, c, true); V.hitStop(); V.shake(24); MB.audio.sfx('slam');
    cuts.forEach((s, i) => { gsap.to(s.body, { scale: 1.9, opacity: 0, duration: 0.35, delay: i * 0.03, onComplete: () => s.remove() }); burst(V, T, c, 6, { h: hT, spread: 90, shape: 'shard' }); });
    flash(V, T, hT, '#ffffff', 420);
    gsap.to(clock.body, { opacity: 0, scale: 1.5, duration: 0.4, onComplete: () => clock.remove() });
    pop(V, T, hT + 110, own(a, 'finish', '...and time moves.'), 'float-text shield', 1.1);
    await wait(0.4);
  };

  // ---------------------------------------------------------------- signature styles: DSF RPG, Legend of You,
  // Noble One and the newer New Haven cast
  // the target's figure when it is a character (leaders stay where they are)
  const victim = (V, t) => !t.isLeader && V.ents.get(t.uid);
  // a strip lying on the floor from P to Q (a bar counter, a red carpet), unrolled from P's end
  function strip(V, P, Q, cls, color) {
    const dd = dirOf(P, Q), f = V.flat(cls, '', (P.x + Q.x) / 2, (P.y + Q.y) / 2);
    f.style.width = dd.len + 'px';
    f.style.setProperty('--c', color);
    gsap.set(f, { rotation: (Math.atan2(dd.y, dd.x) * 180) / Math.PI });
    gsap.fromTo(f, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.45, ease: 'power2.out' });
    return f;
  }
  // a double spiral, `turns` times round (hypnosis); its strokes have class "d" for drawing in
  function spiralSvg(c, size = 220, turns = 4) {
    const arm = (off) => {
      let d = '';
      for (let i = 0; i <= turns * 30; i++) {
        const k = i / (turns * 30), ang = k * turns * Math.PI * 2 + off;
        d += `${i ? ' L' : 'M'}${(110 + Math.cos(ang) * k * 100).toFixed(1)},${(110 + Math.sin(ang) * k * 100).toFixed(1)}`;
      }
      return d;
    };
    return `<svg viewBox="0 0 220 220" width="${size}" height="${size}" fill="none" stroke-linecap="round" stroke-width="9">
      <path class="d" d="${arm(0)}" stroke="${c}"/><path class="d" d="${arm(Math.PI)}" stroke="#fff"/></svg>`;
  }
  // the spiral standing over P, drawn in (DrawSVG) and spinning; returns { remove }
  function spiral(V, P, h, c, size = 220) {
    const s = V.billboard('hypno-spiral', spiralSvg(c, size), P.x, P.y);
    s.body.style.setProperty('--c', c);
    gsap.set(s.body, { y: -h });
    draw(s.body.querySelectorAll('.d'), { duration: 0.6, ease: 'power1.inOut' });
    const spin = gsap.to(s.body, { rotation: '+=360', duration: 1.1, ease: 'none', repeat: -1 });
    return { s, remove: () => gsap.to(s.body, { scale: 0, opacity: 0, duration: 0.3, onComplete: () => { spin.kill(); s.remove(); } }) };
  }
  // a swirling portal standing on the floor at P, as tall as h; returns the function that closes it
  function portal(V, P, c, h) {
    const p = V.billboard('portal', '<i></i>', P.x, P.y);
    p.body.style.setProperty('--c', c);
    p.body.style.height = h + 'px'; p.body.style.width = h * 0.6 + 'px';
    gsap.set(p.body, { yPercent: -100, y: 16, transformOrigin: '50% 100%' });
    const spin = gsap.to(p.body.firstChild, { rotation: 360, duration: 1.2, ease: 'none', repeat: -1 });
    gsap.fromTo(p.body, { scaleX: 0, scaleY: 0.2, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
    MB.audio.sfx('warp');
    return () => gsap.to(p.body, { scaleX: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { spin.kill(); p.remove(); } });
  }
  // recipe move: steps into a portal and out of another one beside the target
  RMOVE.portal = {
    go: async (V, r) => {
      const H = r.hA / 0.55, close = portal(V, r.A, r.c, H * 1.15);
      await wait(0.3);
      await gsap.to(r.v.figure, { scale: 0.15, opacity: 0, rotationY: 360, duration: 0.3, ease: 'power2.in' });
      close();
      gsap.set(r.v.el, r.C);
      const close2 = portal(V, r.C, r.c, H * 1.15);
      await wait(0.3);
      await gsap.fromTo(r.v.figure, { scale: 0.15, opacity: 0, rotationY: -360 }, { scale: 1, opacity: 1, rotationY: 0, duration: 0.35, ease: 'back.out(2)' });
      burst(V, r.C, r.c, 12, { h: H * 0.5 });
      close2();
    },
    back: async (V, r) => {
      const H = r.hA / 0.55, P = here(r.v), close = portal(V, P, r.c, H * 1.15);
      await wait(0.25);
      await gsap.to(r.v.figure, { scale: 0.15, opacity: 0, rotationY: 360, duration: 0.25, ease: 'power2.in' });
      close();
      gsap.set(r.v.el, r.A);
      const close2 = portal(V, r.A, r.c, H * 1.15);
      await wait(0.25);
      await gsap.fromTo(r.v.figure, { scale: 0.15, opacity: 0, rotationY: -360 }, { scale: 1, opacity: 1, rotationY: 0, duration: 0.3, ease: 'back.out(2)' });
      close2();
    },
  };

  // Brutio: ENLARGO! Grows in three pulses, crosses the board in two giant steps and comes down on the target.
  // Then shrinks back with a pop
  S.enlargo = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'ENLARGO!'), 'float-text burn', 1.1);
    MB.audio.sfx('grow');
    for (let i = 1; i <= 3; i++) {
      await gsap.to(v.figure, { scale: 1 + i * 0.25, duration: 0.15, ease: 'back.out(3)' });
      ring(V, A, c, 1 + i * 0.4, 0.4); V.shake(3 + i * 3);
      await wait(0.06);
    }
    for (let i = 1; i <= 2; i++) {
      const P = { x: lerp(A.x, C.x, i / 2), y: lerp(A.y, C.y, i / 2) };
      await gsap.timeline()
        .to(v.el, { x: P.x, y: P.y, duration: 0.32, ease: 'power1.inOut' })
        .to(v.figure, { y: -70, duration: 0.16, ease: 'power2.out' }, 0)
        .to(v.figure, { y: 0, duration: 0.16, ease: EASE.drop }, 0.16);
      MB.audio.sfx('stomp'); V.shake(12);
      cracks(V, P, '#2b1d12', { n: 5, len: 90, w: 5, glow: c, hold: 0.6 }); puff(V, P, '#d9ccb4', 4, 10, 0.8);
      if (tv) gsap.fromTo(tv.figure, { y: 0 }, { y: -26, duration: 0.1, yoyo: true, repeat: 1, overwrite: 'auto' }); // the whole board jumps
    }
    await gsap.timeline()
      .to(v.figure, { y: -240, rotation: d.x * 8, duration: 0.3, ease: 'power2.out' })
      .to(v.figure, { y: 0, rotation: 0, duration: 0.2, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('stomp'); MB.audio.sfx('boom'); V.shake(28); V.hitStop();
    ring(V, T, '#ffffff', 3.4, 0.8); ring(V, T, c, 2.6, 0.7); decal(V, T, 'crater', c, 1.1);
    cracks(V, T, '#2b1d12', { n: 10, len: 190, w: 8, glow: c, hold: 1.1 });
    debris(V, T, '#c9b79c', 18, { spread: 240 });
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.6, scaleX: 1.3 }, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1,0.35)', overwrite: 'auto' });
    pop(V, T, hT + 140, own(a, 'finish', 'ALPHA!'), 'float-text burn', 1.1);
    await wait(0.35);
    MB.audio.sfx('pop'); puff(V, here(v), '#ffffff', 6, H * 0.6, 1);
    await gsap.to(v.figure, { scale: 1, duration: 0.45, ease: 'elastic.out(1,0.4)' });
    await goHome(v, A);
  };

  // Beatrice: "look into my eyes". A spiral holds the target still, she blinks in front of it and the fists come
  // faster than anyone can count. HORA HORA HORA!
  S.hora = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), fist = d.x >= 0 ? '🤜' : '🤛';
    pop(V, A, H + 95, own(a, 'cry', 'Look into my eyes~'), 'float-text debuff', 1.1);
    await glowUp(v, c, -20);
    const sp = spiral(V, T, hT * 2 + 60, c, 190);
    MB.audio.sfx('hypno');
    const sway = tv && gsap.to(tv.figure, { rotation: 7, duration: 1.2, ease: WIGGLE });
    await wait(0.95);
    sp.remove();
    const F = { x: T.x - d.x * 105, y: T.y - d.y * 105 };
    MB.audio.sfx('blink');
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
    gsap.set(v.el, F);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.08 });
    const jitter = gsap.fromTo(v.figure, { x: -d.x * 6 }, { x: d.x * 10, duration: 0.04, yoyo: true, repeat: -1 });
    let first = true;
    await Promise.all(Array.from({ length: 24 }, (_, i) => wait(i * 0.045).then(() => {
      const s = rnd(-45, 45), P = { x: F.x + perp.x * s, y: F.y + perp.y * s }, TT = { x: T.x + perp.x * rnd(-30, 30), y: T.y + perp.y * rnd(-30, 30) }, hh = hT * rnd(0.6, 1.5);
      const f = V.billboard('thrown fist', fist, P.x, P.y);
      f.body.style.setProperty('--c', c);
      gsap.set(f.body, { y: -H * rnd(0.35, 0.75), scale: rnd(0.55, 0.9) });
      return Promise.all([gsap.to(f, { x: TT.x, y: TT.y, duration: 0.08, ease: 'power2.in' }), gsap.to(f.body, { y: -hh, duration: 0.08 })]).then(() => {
        gsap.to(f.body, { scale: 1.5, opacity: 0, duration: 0.12, onComplete: () => f.remove() });
        if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, TT, hh, i % 2 ? '#ffffff' : c, 90); if (i % 3 === 0) MB.audio.sfx('punch'); }
        if (i % 5 === 2) pop(V, { x: T.x + rnd(-110, 110), y: T.y }, hT + rnd(60, 170), 'HORA!', 'float-text debuff', 0.6);
      });
    })));
    jitter.kill();
    // the last one, wound all the way back
    await gsap.to(v.figure, { x: -d.x * 30, duration: 0.12, ease: 'power2.out' });
    const big = V.billboard('thrown big fist', fist, F.x, F.y);
    big.body.style.setProperty('--c', c);
    gsap.set(big.body, { y: -H * 0.55 });
    gsap.to(v.figure, { x: d.x * 20, duration: 0.1 });
    await Promise.all([gsap.to(big, { x: T.x, y: T.y, duration: 0.1, ease: 'power3.in' }), gsap.to(big.body, { y: -hT, duration: 0.1 })]);
    MB.audio.sfx('pow'); V.shake(20); V.hitStop();
    flash(V, T, hT, '#ffffff', 380); ring(V, T, c, 2.6); burst(V, T, c, 20, { h: hT, spread: 170, shape: 'shard' });
    gsap.to(big.body, { scale: 2.2, opacity: 0, duration: 0.25, onComplete: () => big.remove() });
    if (sway) sway.kill();
    if (tv) gsap.timeline().to(tv.figure, { x: d.x * 50, y: -120, rotation: d.x * 25, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
      .to(tv.figure, { x: 0, y: 0, rotation: 0, duration: 0.4, ease: 'bounce.out' });
    pop(V, T, hT + 130, own(a, 'finish', 'Fufufu... exquisite.'), 'float-text debuff', 1.1);
    await wait(0.45);
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
    gsap.set(v.el, A); gsap.set(v.figure, { x: 0 });
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.15 });
    await glowDown(v);
  };

  // Pristo: an amp rises behind him, one power chord, and the sound itself rolls over the board in waves.
  // Lightning for the solo. \m/
  S.riff = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hA, hT, c } = ctx(V, a, t), H = V.heightOf(a);
    const amp = V.billboard('amp', '<i></i><i></i>', A.x - d.x * 40 + perp.x * 90, A.y - d.y * 40 + perp.y * 90);
    amp.body.style.setProperty('--c', c);
    gsap.set(amp.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    MB.audio.sfx('slam');
    await gsap.fromTo(amp.body, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'back.out(2)' });
    const gtr = V.billboard('thrown', '🎸', A.x + d.x * 30, A.y);
    gsap.set(gtr.body, { y: -H * 0.45, rotation: d.x >= 0 ? -20 : 20, scale: 0 });
    await gsap.to(gtr.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 95, own(a, 'cry', 'Welcome to my CASA.'), 'float-text buff', 1.1);
    MB.audio.sfx('guitar');
    const bang = gsap.to(v.figure, { rotation: d.x * 10, duration: 0.11, yoyo: true, repeat: 11, ease: 'power1.inOut' }); // headbanging
    const thump = gsap.to(amp.body, { scale: 1.08, duration: 0.11, yoyo: true, repeat: 11 });
    gsap.to(gtr.body, { rotation: '+=12', duration: 0.11, yoyo: true, repeat: 11 });
    const O = { x: A.x + d.x * 40, y: A.y + d.y * 40 };
    let first = true;
    await Promise.all([0, 1, 2].map((i) => wait(i * 0.22).then(() => {
      const arcs = [0, 1, 2].map((j) => `<path class="d" d="M${30 + j * 24},${34 + j * 10} Q${74 + j * 24},100 ${30 + j * 24},${166 - j * 10}" stroke-width="${11 - j * 3}"/>`).join('');
      const w = V.billboard('soundwave', `<svg viewBox="0 0 120 200" width="120" height="200" fill="none" stroke="${c}" stroke-linecap="round">${arcs}</svg>`, O.x, O.y);
      w.body.style.setProperty('--c', c);
      draw(w.body.querySelectorAll('.d'), { duration: 0.15, stagger: 0.04 });
      return path(w, along((k) => ({ x: lerp(O.x, T.x, k), y: lerp(O.y, T.y, k), h: lerp(hA, hT, k), s: 0.6 + k * 0.9 })), 0.45, 'power1.in').then(() => {
        gsap.to(w.body, { opacity: 0, scale: 1.8, duration: 0.2, onComplete: () => w.remove() });
        if (first) { first = false; impact(); hit(V, t, c, true); V.shake(14); } else { ring(V, T, c, 1.8, 0.4); burst(V, T, c, 8, { h: hT, spread: 90 }); V.shake(8); MB.audio.sfx('hit'); }
      });
    })));
    for (let i = 0; i < 2; i++) { // the solo
      const b = V.billboard('bolt', lightningSvg(470 - hT * 0.3, '#ffe066'), T.x + rnd(-40, 40), T.y);
      gsap.set(b.body, { yPercent: -100, y: -hT * 0.3 });
      await draw(b.body.querySelectorAll('.d'), { duration: 0.06 });
      MB.audio.sfx('thunder'); flash(V, T, hT, '#ffe066', 200); V.shake(10);
      gsap.to(b.body, { opacity: 0, duration: 0.18, delay: 0.06, onComplete: () => b.remove() });
      await wait(0.1);
    }
    scatter(V, T, hT, ['🤘', '🎵', '⚡'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', '\\m/ AMEN \\m/'), 'float-text buff', 1.1);
    bang.kill(); thump.kill();
    gsap.to(gtr.body, { scale: 0, rotation: '+=180', duration: 0.3, onComplete: () => gtr.remove() });
    gsap.to(amp.body, { scaleY: 0, duration: 0.3, delay: 0.2, ease: 'power2.in', onComplete: () => amp.remove() });
    await gsap.to(v.figure, { rotation: 0, duration: 0.2 });
  };

  // Pristo's drawn guitar poses: a holy-looking riff hides the vampire's appetite.
  // Each chord's center reaches the target before land(); the crimson return is visual only.
  S.lightriff = async (V, a, t, impact) => {
    const r = ctx(V, a, t), { v, A, T, hA, hT, c } = r;
    const H = V.heightOf(a), nodes = [], loops = [], blood = '#c52e59';
    const make = (cls, html, P, phase) => {
      const b = V.billboard(cls, html, P.x, P.y);
      b.dataset.pristoPhase = phase; nodes.push(b); return b;
    };
    const setPose = (node, frame, phase) => {
      node.dataset.pristoPhase = phase; node.dataset.pristoFrame = frame;
      node.body.style.backgroundPosition = `${frame % 2 * 100}% ${Math.floor(frame / 2) * 100}%`;
    };
    const land = lander(V, t, impact, r, { big: true });
    try {
      // Stage directly behind his own slot, keeping the amp away from side margins.
      const amp = make('amp', '<i></i><i></i>', { x: A.x, y: A.y - 26 }, 'amp');
      amp.body.style.setProperty('--c', c);
      gsap.set(amp.body, { yPercent: -100, y: 0, scale: 0.72, transformOrigin: '50% 100%' });
      MB.audio.sfx('slam');
      await gsap.fromTo(amp.body, { scaleY: 0 }, { scaleY: 0.72, duration: 0.28, ease: 'back.out(2)' });
      const pose = make('pristo-guitar-pose', '', A, 'wind-up');
      pose.body.style.backgroundImage = `url("${MB.AttackArt.pristo.poses}")`;
      gsap.set(pose.body, { yPercent: -100, y: 20, transformOrigin: '50% 85%' });
      setPose(pose, 0, 'wind-up');
      gsap.set(v.figure, { opacity: 0 });
      await gsap.fromTo(pose.body, { opacity: 0, rotation: -3 }, { opacity: 1, rotation: 0, duration: 0.22 });
      ring(V, A, c, 1.1, 0.45);
      await wait(0.4);
      loops.push(gsap.to(amp.body, { scaleX: 0.77, duration: 0.13, yoyo: true, repeat: -1 }));
      const flights = [];
      for (let i = 0; i < 3; i++) {
        setPose(pose, 1, 'strum');
        MB.audio.sfx('guitar');
        await gsap.fromTo(pose.body, { rotation: -4 }, { rotation: 3, duration: 0.1, ease: 'power2.in' });
        const wave = make('pristo-chord', `<svg viewBox="0 0 140 140" width="140" height="140" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round">
          <path d="M38 30 Q12 70 38 110 M102 30 Q128 70 102 110"/>
          <path d="M48 43 Q29 70 48 97 M92 43 Q111 70 92 97" stroke-width="3"/>
          <path d="M70 49 V91 M55 63 H85" stroke="#fff8d6" stroke-width="7"/>
        </svg>`, A, 'flight');
        wave.body.style.setProperty('--c', c);
        flights.push((async () => {
          // Zero side offset, small lift: works at far corners and against a leader too.
          await path(wave, (k) => ({ ...arc(A, T, hA, hT, 24)(k), s: 0.5 + k * 0.3 }), 0.5, 'power1.in');
          wave.dataset.pristoPhase = 'contact';
          land(i);
          MB.audio.sfx(i ? 'hit' : 'holy');
          wave.body.style.setProperty('--c', blood);
          wave.body.querySelector('svg').setAttribute('stroke', blood);
          flash(V, T, hT, blood, 115); ring(V, T, c, 1.3, 0.35);
          await gsap.to(wave.body, { opacity: 0, scale: 1.05, duration: 0.2 });
          wave.remove();
        })());
        await wait(0.13);
        setPose(pose, 2, 'solo');
        await gsap.to(pose.body, { rotation: -3, duration: 0.12, ease: 'sine.inOut' });
      }
      await Promise.all(flights);
      setPose(pose, 3, 'grin');
      await gsap.to(pose.body, { rotation: 0, duration: 0.15 });
      // The gold blessing gives way to a crimson thread returning to the smiling priest.
      const essence = make('charge', '', T, 'drain');
      essence.body.style.width = essence.body.style.height = '24px';
      essence.body.style.setProperty('--c', blood);
      await path(essence, (k) => ({ ...arc(T, A, hT, hA, 30)(k), s: 1 - k * 0.25 }), 0.65, 'sine.inOut');
      essence.remove();
      rise(V, A, c, 5, hA); MB.audio.sfx('heal');
      await wait(0.28);
      await Promise.all([
        gsap.to(pose.body, { opacity: 0, duration: 0.2 }),
        gsap.to(v.figure, { opacity: 1, duration: 0.2 }),
        gsap.to(amp.body, { opacity: 0, scaleY: 0, duration: 0.2 }),
      ]);
    } finally {
      loops.forEach((tw) => tw.kill());
      nodes.forEach((node) => {
        gsap.killTweensOf(node); gsap.killTweensOf(node.body); node.remove();
      });
      gsap.set(v.figure, { opacity: 1 });
    }
  };

  // Church of Dalmavilla: shy Julia finds her voice while Pristo supplies the riff.
  // Her recorded hymn drives the drawn mouth poses; ice notes and gold chords merge before contact.
  S.metalmass = async (V, a, t, impact) => {
    if (!a.card.fused) return S.riff(V, a, t, impact);
    const r = ctx(V, a, t), { v, A, T, hA, hT, c } = r, ice = '#9fe8ff';
    const members = a.card.members, ji = members.findIndex(m => m.id === 'julia-aquacrucis');
    const pi = members.findIndex(m => m.id === 'priest-pristo');
    if (ji < 0 || pi < 0) return S.combo(V, a, t, impact);
    const nodes = [], tweens = [], parts = duo(v), land = lander(V, t, impact, r, { big: true });
    const home = index => ({ x: A.x + (index ? 80 : -80), y: A.y });
    const J = home(ji), P = home(pi), Q = { x: lerp(A.x, T.x, 0.4), y: lerp(A.y, T.y, 0.4) };
    const hQ = lerp(hA, hT, 0.4);
    const make = (cls, html, point, phase, by) => {
      const node = V.billboard(cls, html, point.x, point.y);
      node.dataset.metalMassPhase = phase;
      if (by) node.dataset.performer = by;
      nodes.push(node); return node;
    };
    const poseFrame = (node, frame) => {
      if (+node.dataset.poseFrame === frame && node.dataset.poseFrame != null) return;
      node.dataset.poseFrame = frame;
      if (node.dataset.performer === 'julia') {
        // Sample between the generated silhouettes, whose transparent gutters are not a perfect grid.
        const sheet = MB.AttackArt.metalMass, col = frame % 2, row = Math.floor(frame / 2);
        const width = sheet.x[col + 1] - sheet.x[col], height = sheet.y[row + 1] - sheet.y[row];
        node.body.style.backgroundSize = `${sheet.width / width * 100}% ${sheet.height / height * 100}%`;
      }
      node.body.style.backgroundPosition = `${frame % 2 * 100}% ${Math.floor(frame / 2) * 100}%`;
    };
    let stopVoice, voiceMotion;
    try {
      const [voice] = await MB.audio.prepare('singing', 'guitar');
      const seconds = voice ? voice.duration : 6.35;
      // RMS bins follow the supplied voice, including its breath and quiet reverb tail.
      const envelope = [], binSeconds = 0.12;
      if (voice) {
        const data = voice.getChannelData(0), size = Math.round(voice.sampleRate * binSeconds);
        for (let start = 0; start < data.length; start += size) {
          let sum = 0; const end = Math.min(data.length, start + size);
          for (let i = start; i < end; i++) sum += data[i] * data[i];
          envelope.push(Math.sqrt(sum / (end - start)));
        }
      }
      const peak = Math.max(0.001, ...envelope);
      const amp = make('amp', '<i></i><i></i>', { x: P.x, y: P.y - 28 }, 'amp');
      amp.body.style.setProperty('--c', c);
      gsap.set(amp.body, { yPercent: -100, y: 0, scale: 0.65 });
      const priest = make('pristo-guitar-pose', '', P, 'ready', 'pristo');
      const singer = make('julia-singing-pose', '', J, 'breath', 'julia');
      priest.body.style.backgroundImage = `url("${MB.AttackArt.pristo.poses}")`;
      singer.body.style.backgroundImage = `url("${MB.AttackArt.metalMass.julia}")`;
      [priest, singer].forEach(node => {
        node.body.style.width = node.body.style.height = '220px';
        gsap.set(node.body, { yPercent: -100, y: 14, transformOrigin: '50% 90%' });
        poseFrame(node, 0);
      });
      await Promise.all([
        gsap.to(v.figure, { opacity: 0, duration: 0.2 }),
        gsap.fromTo([priest.body, singer.body, amp.body], { opacity: 0 }, { opacity: 1, duration: 0.2 }),
      ]);
      await wait(0.35);
      const audioClock = MB.audio.unlock(), started = audioClock.currentTime, clock = { t: 0 };
      stopVoice = MB.audio.sfx('singing');
      singer.dataset.voiceDuration = seconds;
      singer.dataset.voiceLoaded = !!voice;
      voiceMotion = gsap.to(clock, { t: seconds, duration: seconds, ease: 'none', onUpdate: () => {
        const elapsed = Math.min(seconds, Math.max(0, audioClock.currentTime - started));
        const rms = envelope[Math.min(envelope.length - 1, Math.floor(elapsed / binSeconds))] || 0;
        const level = voice ? rms / peak : (elapsed > 0.2 && elapsed < 4 ? 0.55 + 0.2 * Math.sin(elapsed * 5) : 0);
        const active = level > 0.08;
        const frame = active ? (level > 0.68 ? 2 : 1) : elapsed < 0.3 ? 0 : 3;
        poseFrame(singer, frame); singer.dataset.metalMassPhase = active ? 'singing' : elapsed < 0.3 ? 'breath' : 'bow';
        poseFrame(priest, elapsed < 0.2 ? 0 : active ? (Math.floor(elapsed / 0.28) % 2 ? 2 : 1) : 3);
        priest.dataset.metalMassPhase = active ? 'riff' : elapsed < 0.2 ? 'ready' : 'grin';
        // Move the complete drawn poses; hands and mouth remain attached to the body.
        gsap.set(singer.body, { rotation: active ? Math.sin(elapsed * 3.2) * 2 : 0, y: 14 - level * 3 });
        gsap.set(priest.body, { rotation: active ? Math.sin(elapsed * 11) * 3 : 0 });
        gsap.set(amp.body, { scaleX: 0.65 + (active ? level * 0.04 : 0) });
      } });
      tweens.push(voiceMotion);
      const duetChord = async (i, delay) => {
        await wait(delay);
        MB.audio.sfx('guitar', { vol: 0.38, len: 0.9 });
        const gold = make('pristo-chord', `<svg viewBox="0 0 100 100" width="100" height="100" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round">
          <path d="M30 18 Q5 50 30 82 M70 18 Q95 50 70 82"/><path d="M50 35 V65 M38 45 H62" stroke="#fff8d6"/>
        </svg>`, P, 'gold-flight', 'pristo');
        gold.body.style.setProperty('--c', c);
        const note = make('metal-mass-note', '🎵', J, 'ice-flight', 'julia');
        await Promise.all([
          path(gold, k => ({ ...arc(P, Q, hA, hQ, 20)(k), s: 0.65 }), 0.42, 'sine.inOut'),
          path(note, k => ({ ...arc(J, Q, hA + 25, hQ, 28)(k), s: 0.8, r: Math.sin(k * Math.PI) * 14 }), 0.42, 'sine.inOut'),
        ]);
        gold.remove(); note.remove();
        const chord = make('metal-mass-chord', `<svg viewBox="0 0 140 140" width="140" height="140" fill="none" stroke-linecap="round">
          <path d="M35 22 Q2 70 35 118 M105 22 Q138 70 105 118" stroke="${c}" stroke-width="6"/>
          <path d="M48 34 Q23 70 48 106 M92 34 Q117 70 92 106" stroke="${ice}" stroke-width="4"/>
          <path d="M70 42 V98 M48 60 H92" stroke="${ice}" stroke-width="9"/>
          <path d="M70 42 V98 M48 60 H92" stroke="#fff" stroke-width="3"/>
        </svg>`, Q, 'merge');
        gsap.set(chord.body, { y: -hQ, scale: 0.7 });
        await wait(0.12);
        chord.dataset.metalMassPhase = 'combined-flight';
        await path(chord, k => ({ ...arc(Q, T, hQ, hT, 18)(k), s: 0.7 + k * 0.12 }), 0.38, 'power1.in');
        chord.dataset.metalMassPhase = 'contact';
        land(i); MB.audio.sfx('frost', { vol: 0.22, len: 0.6 });
        flash(V, T, hT, ice, 130); ring(V, T, c, 1.5, 0.4);
        burst(V, T, ice, 7, { h: hT, spread: 55, shape: 'shard' });
        await gsap.to(chord.body, { opacity: 0, scale: 1.1, duration: 0.24 });
        chord.remove();
      };
      const results = await Promise.allSettled([voiceMotion, ...[0.35, 1.45, 2.7].map((delay, i) => duetChord(i, delay))]);
      const failed = results.find(result => result.status === 'rejected'); if (failed) throw failed.reason;
      poseFrame(priest, 3); poseFrame(singer, 3);
      priest.dataset.metalMassPhase = 'grin'; singer.dataset.metalMassPhase = 'bow';
      pop(V, A, V.heightOf(a) + 55, 'Julia: A-amen… ♪', 'float-text shield', 0.9);
      await wait(0.2);
      await Promise.all([
        gsap.to([priest.body, singer.body, amp.body], { opacity: 0, duration: 0.25 }),
        gsap.to(v.figure, { opacity: 1, duration: 0.25 }),
      ]);
    } finally {
      if (stopVoice) stopVoice();
      tweens.forEach(tween => tween.kill());
      nodes.forEach(node => { gsap.killTweensOf(node); gsap.killTweensOf(node.body); node.remove(); });
      gsap.set(v.figure, { opacity: 1 }); gsap.set(parts, { opacity: 1 }); resetDuo(v);
    }
  };

  // Pepita: panics, spins the dough up over her head, the toppings land on it, and the whole pizza flies like a
  // frisbee and lands face first. Cheese everywhere
  S.pizza = async (V, a, t, impact) => {
    const { v, A, T, perp, hT, c } = ctx(V, a, t), H = V.heightOf(a), top = H + 40;
    pop(V, A, top + 55, own(a, 'cry', 'AAAH! S-scusi!'), 'float-text burn', 1);
    const panic = gsap.fromTo(v.figure, { x: -4 }, { x: 4, duration: 0.05, yoyo: true, repeat: -1 });
    const pz = V.billboard('pizza', '', A.x, A.y);
    gsap.set(pz.body, { y: -top, rotationX: 62, scale: 0.3 });
    const spin = gsap.to(pz.body, { rotation: '+=360', duration: 0.35, ease: 'none', repeat: -1 });
    MB.audio.sfx('whoosh');
    await gsap.to(pz.body, { scale: 1.1, y: -top - 30, duration: 0.55, ease: 'power1.out' });
    await Promise.all(['🍅', '🧀', '🍄', '🫒', '🌿'].map((em, i) => wait(i * 0.07).then(() => {
      const F = { x: A.x + rnd(-130, 130), y: A.y + rnd(-20, 20) }, fn = arc(F, A, top + 170, top + 30, 60), b = V.billboard('petal', em, F.x, F.y);
      b.body.style.fontSize = '30px';
      return path(b, (k) => ({ ...fn(k), r: k * 360 }), 0.35, 'power1.in').then(() => { b.remove(); MB.audio.sfx('pop'); });
    })));
    panic.kill(); gsap.set(v.figure, { x: 0 });
    await gsap.to(v.figure, { rotation: -10, duration: 0.15 });
    gsap.to(v.figure, { rotation: 8, duration: 0.12 });
    MB.audio.sfx('zip');
    const fly = arc(A, T, top + 30, hT, 80, 170, perp);
    await path(pz, (k) => ({ ...fly(k), s: 1.1 + k * 0.4 }), 0.6, 'sine.in');
    spin.kill();
    impact(); hit(V, t, c, true); MB.audio.sfx('splat'); V.shake(12);
    gsap.to(pz.body, { rotationX: 0, scale: 2, opacity: 0, duration: 0.3, onComplete: () => pz.remove() });
    decal(V, T, 'splat', '#ffcc33', 1.2);
    // the cheese stretches and drips off the target
    const w = 140, h = Math.round(hT * 1.2), strands = Array.from({ length: 6 }, (_, i) => {
      const x = 15 + i * 22 + rnd(-6, 6);
      return `<path class="d" d="M${x},0 C${x + rnd(-15, 15)},${h * 0.35} ${x + rnd(-15, 15)},${h * 0.65} ${x + rnd(-8, 8)},${h * rnd(0.6, 1)}"/>`;
    }).join('');
    const ch = V.billboard('cheese', `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="#ffd84a" stroke-width="7" stroke-linecap="round">${strands}</svg>`, T.x, T.y);
    gsap.set(ch.body, { yPercent: 0, y: -hT * 1.6 });
    draw(ch.body.querySelectorAll('.d'), { duration: 0.5, stagger: 0.05, ease: 'power1.in' });
    gsap.to(ch.body, { opacity: 0, duration: 0.4, delay: 0.9, onComplete: () => ch.remove() });
    scatter(V, T, hT, ['🍅', '🧀', '🍄', '🫒'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', 'M-mamma mia!'), 'float-text burn', 1.1);
    await gsap.to(v.figure, { rotation: 0, duration: 0.3 });
  };

  // Kuku: a bar counter slides out across the board and she sends a full mug down it. Nobody catches it.
  // Then one for herself, *hic*
  S.barslide = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const P = { x: A.x + d.x * 50, y: A.y + d.y * 50 }, bar = strip(V, P, T, 'bar-counter', c);
    MB.audio.sfx('whoosh');
    pop(V, A, H + 95, own(a, 'cry', 'Yeehaw! This one\'s yours!'), 'float-text buff', 1);
    const mug = V.billboard('thrown', '🍺', P.x, P.y);
    gsap.set(mug.body, { y: -30, scale: 0 });
    await gsap.to(mug.body, { scale: 0.8, duration: 0.25, delay: 0.25, ease: 'back.out(3)' });
    await gsap.to(v.figure, { x: d.x * 24, rotation: d.x * 6, duration: 0.12, yoyo: true, repeat: 1 }); // a shove
    MB.audio.sfx('slide');
    await path(mug, (k) => ({ x: lerp(P.x, T.x, k), y: lerp(P.y, T.y, k), h: 30 + Math.sin(k * 40) * 3, r: Math.sin(k * 30) * 6, s: 0.8 }), 0.8, 'power1.in', (p) => {
      if (Math.random() < 0.35) { const f = dot(V, p, p.h + 30, '#fff8e0', rnd(6, 11)); gsap.to(f.body, { y: `+=${rnd(10, 30)}`, opacity: 0, duration: 0.5, onComplete: () => f.remove() }); }
    });
    await gsap.to(mug.body, { y: -hT * 1.2, rotation: sg * 150, duration: 0.14, ease: 'power2.out' });
    mug.remove();
    impact(); hit(V, t, c); MB.audio.sfx('glass'); V.shake(10);
    debris(V, T, '#fff4c8', 14, { h: hT, spread: 170 }); debris(V, T, '#e8b030', 8, { h: hT, spread: 150 });
    burst(V, T, '#ffffff', 10, { h: hT, spread: 120, shape: 'shard' });
    decal(V, T, 'splat', '#e8b030', 1.1);
    pop(V, T, hT + 120, own(a, 'finish', 'On the house, sugar!'), 'float-text buff', 1.1);
    const mine = V.billboard('thrown', '🍺', A.x + d.x * 30, A.y);
    gsap.set(mine.body, { y: -H * 0.6, scale: 0 });
    await gsap.to(mine.body, { scale: 0.7, duration: 0.2, ease: 'back.out(3)' });
    await gsap.to(mine.body, { rotation: -sg * 70, duration: 0.3 });
    pop(V, A, H + 60, '*hic*', 'float-text hic', 0.8); MB.audio.sfx('bubble');
    gsap.to(mine.body, { opacity: 0, duration: 0.2, onComplete: () => mine.remove() });
    gsap.to(bar, { opacity: 0, duration: 0.4, onComplete: () => bar.remove() });
    await gsap.to(v.figure, { rotation: 0, x: 0, duration: 0.2 });
  };

  // Hed: flips a coin for it. Heads: he IS a head, so he flips himself over onto the target. Tails: the coin does
  // it. Either way his pocket change goes everywhere
  S.coinflip = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t), H = V.heightOf(a), heads = Math.random() < 0.5;
    const coin = V.billboard('coin big-coin', '5', A.x, A.y);
    gsap.set(coin.body, { y: -H * 0.6, scale: 1.6 });
    pop(V, A, H + 95, own(a, 'cry', '...heads or tails, bro?'), 'float-text hic', 1);
    MB.audio.sfx('flip');
    await gsap.timeline()
      .to(coin.body, { y: -H - 240, duration: 0.45, ease: 'power2.out' })
      .to(coin.body, { rotationX: 1800, duration: 0.9, ease: 'none' }, 0)
      .to(coin.body, { y: -H * 0.9, duration: 0.45, ease: 'power2.in' }, 0.45);
    MB.audio.sfx('coin');
    pop(V, A, H + 150, heads ? 'HEADS!' : 'TAILS!', 'float-text buff', 1);
    await wait(0.25);
    if (heads) {
      gsap.to(coin.body, { opacity: 0, duration: 0.2, onComplete: () => coin.remove() });
      MB.audio.sfx('boing');
      await gsap.timeline()
        .to(v.el, { x: C.x, y: C.y, duration: 0.6, ease: 'power1.inOut' })
        .to(v.figure, { y: -260, duration: 0.3, ease: 'power2.out' }, 0)
        .to(v.figure, { y: 0, duration: 0.3, ease: 'power2.in' }, 0.3)
        .to(v.figure, { rotationX: 720, duration: 0.6, ease: 'none' }, 0)
        .set(v.figure, { rotationX: 0 });
    } else {
      const fn = arc(A, T, H * 0.9, hT * 1.6, 180);
      await path(coin, (k) => ({ ...fn(k), s: 1.6 + k * 1.4 }), 0.55, 'power1.in');
      await gsap.to(coin.body, { y: -hT * 0.9, duration: 0.08 });
      gsap.to(coin.body, { rotationX: '+=720', opacity: 0, y: '-=120', duration: 0.5, onComplete: () => coin.remove() });
    }
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); V.shake(12);
    for (let i = 0; i < 8; i++) {
      const cn = V.billboard('coin', '', T.x, T.y);
      gsap.set(cn.body, { y: -hT, scale: 0.6 });
      gsap.to(cn, { x: T.x + rnd(-150, 150), y: T.y + rnd(-60, 60), duration: 0.9 });
      toss(cn, { v: [300, 520], ang: [-140, -40], g: 1600, dur: 0.9, spin: 90 });
    }
    MB.audio.sfx('coin');
    pop(V, T, hT + 120, own(a, 'finish', 'lol gg'), 'float-text hic', 1);
    await wait(0.3);
    if (heads) await goHome(v, A);
  };

  // Brulliant: FORMO. A puff of smoke and he is the target's double (in his colors); the double walks up and
  // hits it, then he's himself again with a hair flip. Ja, ze genius
  S.formo = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = V.ents.get(t.uid), H = V.heightOf(a);
    const look = tv ? tv.img : v.img, html = look.tagName === 'IMG' ? `<img src="${look.src}">` : look.outerHTML;
    pop(V, A, H + 95, own(a, 'cry', 'FORMO!'), 'float-text ability', 1);
    MB.audio.sfx('poof'); puff(V, A, c, 10, H * 0.5, 1.2);
    await gsap.to(v.figure, { opacity: 0, duration: 0.12 });
    const m = V.billboard('mimic', html, A.x, A.y);
    m.body.style.setProperty('--c', c); m.body.style.height = v.stand.style.height;
    gsap.set(m.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    await gsap.fromTo(m.body, { scaleX: 0.2, scaleY: 1.3, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.4, ease: 'elastic.out(1,0.5)' });
    MB.audio.sfx('whoosh');
    await gsap.to(m, { x: C.x, y: C.y, duration: 0.45, ease: 'power2.inOut' });
    if (tv) pop(V, T, hT * 2 + 40, '!?', 'float-text shield', 0.9); // a double take
    await wait(0.35);
    for (let i = 0; i < 2; i++) {
      await gsap.timeline().to(m.body, { x: d.x * 34, rotation: d.x * 6, duration: 0.07, ease: 'power2.in' }).to(m.body, { x: 0, rotation: 0, duration: 0.09 });
      if (!i) { impact(); hit(V, t, c, true); } else burst(V, T, c, 8, { h: hT, spread: 80 });
      MB.audio.sfx('hit');
    }
    pop(V, T, hT + 120, own(a, 'finish', 'Ze perfect copy!'), 'float-text ability', 1.1);
    await wait(0.2);
    MB.audio.sfx('poof'); puff(V, C, c, 10, H * 0.5, 1.2);
    m.remove();
    gsap.set(v.el, C);
    await gsap.to(v.figure, { opacity: 1, duration: 0.1 });
    scatter(V, C, H * 0.8, ['💇', '✨'], 5, 90);
    await gsap.to(v.figure, { rotationY: 360, duration: 0.35 }); // the hair flip
    gsap.set(v.figure, { rotationY: 0 });
    await goHome(v, A);
  };

  // Miracle: the quest form first, stamped with a heart. The smile never moves while the axe comes down.
  // Just you, right? ♥
  S.yandere = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, red = '#ff1a3c';
    pop(V, A, H + 95, own(a, 'cry', 'Your quest form, please~'), 'float-text baka', 1.1);
    const form = V.billboard('quest-form', '<b>QUEST</b><small>party: you + me ♥</small>', T.x, T.y);
    await gsap.fromTo(form.body, { y: -hT - 450, opacity: 0, rotation: 30 }, { y: -hT - 150, opacity: 1, rotation: -8, duration: 0.45, ease: 'back.out(1.6)' });
    MB.audio.sfx('draw');
    const st = V.billboard('stamp-mark', 'APPROVED ♥', T.x, T.y);
    st.body.style.color = c;
    gsap.set(st.body, { y: -hT - 150, rotation: -14 });
    await gsap.fromTo(st.body, { scale: 3, opacity: 0 }, { scale: 0.7, opacity: 1, duration: 0.18, ease: 'power4.in' });
    MB.audio.sfx('slam'); V.shake(6);
    await wait(0.2);
    gsap.to(v.img, { filter: `drop-shadow(0 0 14px ${red}) brightness(0.8)`, duration: 0.3 });
    pop(V, A, H + 60, 'Just you, right? ♥', 'float-text baka', 1.1); MB.audio.sfx('dark');
    await wait(0.45);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, red) });
    // the illustrated axe has its grip lower-left and its edge facing right: mirror it only to swing leftwards,
    // and pivot on the grip so the edge comes down onto the target's middle
    const axe = V.billboard('thrown axe', `<span style="display:inline-block;transform:scaleX(${sg})">🪓</span>`, C.x, C.y);
    gsap.set(axe.body, { y: -H * 0.95, rotation: -sg * 20, scale: 0, transformOrigin: `${sg > 0 ? 15 : 85}% 88%` });
    await gsap.to(axe.body, { scale: 1.6, rotation: -sg * 60, duration: 0.3, ease: 'back.out(2)' });
    await wait(0.15);
    MB.audio.sfx('swish');
    gsap.to(axe.body, { rotation: sg * 80, y: -hT - 100, duration: 0.16, ease: EASE.lunge });
    await gsap.to(axe, { x: T.x - d.x * 20, y: T.y - d.y * 20, duration: 0.16, ease: 'power4.in' });
    slashArc(V, T, -hT, red, sg * 60);
    impact(); hit(V, t, red, true); MB.audio.sfx('axe'); V.shake(20); V.hitStop();
    cracks(V, T, '#2b0010', { n: 6, len: 130, w: 6, glow: red, hold: 0.8 });
    scatter(V, T, hT, ['♥', '💢', '💔'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', 'Paperwork complete ♥'), 'float-text baka', 1.1);
    gsap.to([form.body, st.body], { opacity: 0, y: '+=80', rotation: 40, duration: 0.4, onComplete: () => { form.remove(); st.remove(); } });
    gsap.to(axe.body, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => axe.remove() });
    await wait(0.35);
    gsap.to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' });
    await goHome(v, A);
  };

  // Sophia: a keyboard of light appears, she plays a run up it (every key throws its note), and the last chord
  // goes off on the target. Hmph
  S.piano = async (V, a, t, impact) => {
    const { A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), K = 14;
    const keys = Array.from({ length: K }, (_, i) => `<rect class="w" x="${i * 20 + 1}" y="0" width="18" height="80" rx="3"/>`).join('')
      + [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => `<rect class="k" x="${i * 20 + 13}" y="0" width="12" height="48" rx="2"/>`).join('');
    const P = { x: A.x + d.x * 60, y: A.y + d.y * 60 }, h0 = H * 0.45;
    const kb = V.billboard('keyboard', `<svg viewBox="0 0 280 80" width="280" height="80">${keys}</svg>`, P.x, P.y);
    kb.body.style.setProperty('--c', c);
    gsap.set(kb.body, { y: -h0, rotationX: 35 });
    await gsap.fromTo(kb.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
    pop(V, A, H + 95, own(a, 'cry', 'Listen. And learn.'), 'float-text shield', 1);
    MB.audio.sfx('melody');
    const whites = [...kb.body.querySelectorAll('.w')];
    let first = true;
    await Promise.all(whites.filter((_, i) => i % 2 === 0).map((k, j) => wait(j * 0.09).then(() => {
      gsap.fromTo(k, { fill: c }, { fill: '#ffffff', duration: 0.35 });
      const F = { x: P.x + j * 40 - 130, y: P.y }, TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-12, 12) }, fn = arc(F, TT, h0 + 30, hT, rnd(80, 160));
      const b = V.billboard('float-text note', MB.pick(['🎵', '🎶', '♪', '♫']), F.x, F.y);
      b.body.style.color = j % 2 ? '#ffffff' : c;
      MB.audio.sfx(j % 3 ? 'pop' : 'ding');
      return path(b, (q) => ({ ...fn(q), r: Math.sin(q * 12) * 16, s: 0.8 + q * 0.4 }), 0.55, 'sine.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, c, 4, { h: hT, spread: 60 });
      });
    })));
    // the chord: every key at once
    gsap.fromTo(kb.body.querySelectorAll('rect'), { fill: c }, { fill: (i, el) => (el.getAttribute('class') === 'k' ? '#1a1030' : '#ffffff'), duration: 0.5 });
    MB.audio.sfx('piano'); V.shake(12);
    flash(V, T, hT, '#ffffff', 420); ring(V, T, c, 2.8, 0.8); ring(V, T, '#ffffff', 1.8, 0.6);
    scatter(V, T, hT, ['🎵', '🎶', '✨', '🎹'], 14, 170);
    pop(V, T, hT + 120, own(a, 'finish', 'Bravo. ...For me.'), 'float-text shield', 1.1);
    await wait(0.4);
    await gsap.to(kb.body, { scaleX: 0, opacity: 0, duration: 0.25, onComplete: () => kb.remove() });
  };

  // Nerida: the siren song. The notes loop round the target's head and draw it closer, then the sea closes over it
  S.siren = async (V, a, t, impact) => {
    const { v, A, T, d, hA, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    decal(V, A, 'whirlpool', c, 2.6);
    pop(V, A, H + 95, own(a, 'cry', 'Come closer~ ♪'), 'float-text shield', 1.1);
    MB.audio.sfx('siren');
    const sway = gsap.fromTo(v.figure, { rotation: -4 }, { rotation: 4, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const ns = Array.from({ length: 6 }, (_, i) => { const b = V.billboard('float-text note', i % 2 ? '🎵' : '🎶', A.x, A.y); b.body.style.color = i % 2 ? '#ffffff' : c; return b; });
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1.3, ease: 'sine.inOut', onUpdate: () => ns.forEach((b, i) => {
      const k = Math.max(0, Math.min(1, q.k * 1.4 - i * 0.07)), ang = k * Math.PI * 4 + i, r = 70 * k;
      gsap.set(b, { x: lerp(A.x, T.x, k) + Math.cos(ang) * r, y: lerp(A.y, T.y, k) + Math.sin(ang) * r * 0.4 });
      gsap.set(b.body, { y: -lerp(hA + 40, hT * 2 + 20, k) - Math.sin(ang) * 14 });
    }) });
    const P = tv ? { x: T.x - d.x * 70, y: T.y - d.y * 70 } : T;
    if (tv) { // charmed, it drifts toward her
      scatter(V, T, hT * 2, ['💙', '💗'], 5, 60);
      await gsap.to(tv.el, { x: P.x, y: P.y, duration: 0.5, ease: 'sine.inOut' });
    }
    MB.audio.sfx('wave');
    const w = V.billboard('wave', '<div class="foam"></div>', P.x, P.y);
    gsap.set(w.body, { yPercent: -100, y: 10, transformOrigin: '50% 100%' });
    await gsap.fromTo(w.body, { scaleY: 0, scaleX: 0.6 }, { scaleY: 2.2, scaleX: 1.3, duration: 0.35, ease: 'power2.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); V.shake(12);
    if (tv) gsap.to(tv.figure, { y: 40, duration: 0.15, yoyo: true, repeat: 1, overwrite: 'auto' }); // pulled under
    await gsap.to(w.body, { scaleY: 0, duration: 0.3, ease: 'power2.in' });
    w.remove();
    droplets(V, P, 18);
    ns.forEach((b) => gsap.to(b.body, { opacity: 0, y: '-=40', duration: 0.3, onComplete: () => b.remove() }));
    if (tv) await gsap.to(tv.el, { x: T.x, y: T.y, duration: 0.35, ease: 'power2.out' });
    pop(V, T, hT + 120, own(a, 'finish', 'The water is lovely~'), 'float-text shield', 1.1);
    sway.kill();
    await gsap.to(v.figure, { rotation: 0, duration: 0.2 });
  };

  // Julia: a stammered prayer, and a cross of ice forms high over the target, trembles, and drops like a stone
  S.icecross = async (V, a, t, impact) => {
    const { v, A, T, hT } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = Math.min(210, hT + 95), ice = '#9fe8ff';
    await glowUp(v, ice, -30);
    pop(V, A, H + 95, own(a, 'cry', 'G-g-GELO!'), 'float-text shield', 1.1);
    const cross = V.billboard('ice-cross', '<svg viewBox="0 0 120 190" width="120" height="190"><path d="M44,4 H76 V52 H116 V84 H76 V186 H44 V84 H4 V52 H44 Z"/><path class="hl" d="M53,14 V176 M14,63 H106"/></svg>', T.x, T.y);
    gsap.set(cross.body, { y: -top, scale: 0 });
    for (let i = 0; i < 18; i++) { // frost gathers into it
      const s = dot(V, { x: T.x + rnd(-160, 160), y: T.y + rnd(-50, 50) }, top + rnd(-160, 160), '#dff9ff', rnd(6, 12), 'spark shard');
      gsap.to(s, { x: T.x, y: T.y, duration: 0.5, delay: i * 0.02, ease: 'power2.in' });
      gsap.to(s.body, { y: -top, opacity: 0.2, duration: 0.5, delay: i * 0.02, ease: 'power2.in', onComplete: () => s.remove() });
    }
    MB.audio.sfx('freeze');
    await gsap.to(cross.body, { scale: 1.3, duration: 0.55, ease: 'back.out(1.6)' });
    await gsap.to(cross.body, { rotation: 6, duration: 0.35, ease: WIGGLE });
    MB.audio.sfx('whistleDown');
    await gsap.to(cross.body, { y: -hT * 0.9, duration: 0.3, ease: EASE.drop });
    impact(); hit(V, t, ice, true); MB.audio.sfx('shatter'); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    cross.remove();
    cracks(V, T, '#f2fdff', { n: 10, len: 170, w: 4, glow: '#6fd6ff', hold: 1 });
    const fr = V.flat('frost-floor', '', T.x, T.y);
    gsap.fromTo(fr, { scale: 0.2, opacity: 0.9 }, { scale: 2, opacity: 0, duration: 1.2, ease: 'power2.out', onComplete: () => fr.remove() });
    debris(V, T, '#dff9ff', 16, { h: hT, spread: 200 });
    burst(V, T, '#ffffff', 16, { h: hT, spread: 160, shape: 'shard' });
    if (tv) gsap.fromTo(tv.img, { filter: 'drop-shadow(0 0 12px #9fe8ff) brightness(1.5) saturate(0.3)' }, { filter: 'drop-shadow(0 0 0px #9fe8ff) brightness(1) saturate(1)', duration: 1.1, delay: 0.35, clearProps: 'filter' });
    pop(V, T, hT + 120, own(a, 'finish', 'S-sorry!!'), 'float-text shield', 1.1);
    await wait(0.3);
    await glowDown(v);
  };

  // Mimi: kicks a trash bin across the board, flicks her cigarette in after it, and doesn't look back. It goes up
  S.trashfire = async (V, a, t, impact) => {
    const { v, A, T, d, hT } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', '*cough* ...whatever.'), 'float-text hic', 1);
    const P = { x: A.x + d.x * 60, y: A.y + d.y * 60 }, bin = V.billboard('thrown', '🗑️', P.x, P.y);
    gsap.set(bin.body, { y: -30, scale: 0 });
    await gsap.to(bin.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    gsap.timeline().to(v.figure, { x: d.x * 30, rotation: d.x * 12, duration: 0.1 }).to(v.figure, { x: 0, rotation: 0, duration: 0.2 }); // the kick
    MB.audio.sfx('kick'); MB.audio.sfx('trash');
    for (let i = 0; i < 3; i++) { // it tumbles over in three bounces
      const P0 = { x: lerp(P.x, T.x, i / 3), y: lerp(P.y, T.y, i / 3) }, P1 = { x: lerp(P.x, T.x, (i + 1) / 3), y: lerp(P.y, T.y, (i + 1) / 3) };
      const fn = arc(P0, P1, 30, 30, 140 - i * 30), r0 = gsap.getProperty(bin.body, 'rotation');
      await path(bin, (k) => ({ ...fn(k), r: r0 + k * 200 * sg }), 0.26, 'none');
      MB.audio.sfx('clang'); burst(V, P1, '#9aa0a8', 5, { h: 10, spread: 60 });
    }
    const fnC = arc(A, T, H * 0.7, 40, 200), cig = V.billboard('petal', '🚬', A.x, A.y);
    cig.body.style.fontSize = '34px';
    await path(cig, (k) => ({ ...fnC(k), r: k * 900 }), 0.5, 'power1.in', (p) => {
      if (Math.random() < 0.5) { const e = dot(V, p, p.h, '#ffb347', 7); gsap.to(e.body, { opacity: 0, duration: 0.3, onComplete: () => e.remove() }); }
    });
    cig.remove();
    impact(); hit(V, t, '#ff7a1c', true); MB.audio.sfx('fire'); MB.audio.sfx('boom'); V.shake(16);
    const fire = pillar(V, T, '#ff5a1f', 'pillar lava');
    gsap.fromTo(fire.body, { scaleY: 0, scaleX: 0.5 }, { scaleY: 1.2, scaleX: 1, duration: 0.2, ease: 'power3.out' });
    gsap.to(fire.body, { scaleX: 0.1, opacity: 0, duration: 0.5, delay: 0.5, onComplete: () => fire.remove() });
    flameBurst(V, T, hT); rise(V, T, '#ffb347', 14, hT * 1.5);
    debris(V, T, '#3a3a3a', 6, { spread: 150, chars: ['📰', '🥫', '🍌', '🧃'] });
    gsap.to(bin.body, { y: -320, rotation: '+=540', opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => bin.remove() });
    puff(V, T, '#4a4a52', 8, hT, 1.3);
    pop(V, T, hT + 120, own(a, 'finish', 'Burn, Dalmavilla.'), 'float-text burn', 1.1);
    await wait(0.35);
  };

  // Valse: doves pour out of her and circle the target in a slow halo, feathers fall, and the light comes down
  // soft and pink. Everything she does is out of love
  S.mercy = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t), H = V.heightOf(a), n = 7, top = hT * 2 + 40;
    await glowUp(v, c, -40);
    pop(V, A, H + 95, own(a, 'cry', 'Be at peace~'), 'float-text heal', 1.1);
    MB.audio.sfx('flutter');
    const doves = Array.from({ length: n }, () => V.billboard('thrown dove', '🕊️', A.x, A.y));
    const feather = (x, y) => {
      const f = V.billboard('petal', '🪶', x, y);
      gsap.set(f.body, { y: -top, rotation: rnd(-40, 40) });
      gsap.to(f.body, { y: -rnd(0, 30), rotation: `+=${rnd(-90, 90)}`, duration: 1.4, ease: 'sine.in' });
      gsap.to(f.body, { x: 18, duration: 1.4, ease: EASE.flutter });
      gsap.to(f.body, { opacity: 0, duration: 0.3, delay: 1.2, onComplete: () => f.remove() });
    };
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1.6, ease: 'sine.inOut', onUpdate: () => doves.forEach((b, i) => {
      const k0 = Math.max(0, Math.min(1, q.k * 1.5 - i * 0.07)), fly = Math.min(1, k0 * 1.6), ang = k0 * Math.PI * 3 + (i / n) * Math.PI * 2, R = 110 * Math.min(1, k0 * 1.5);
      const x = lerp(A.x, T.x, fly) + Math.cos(ang) * R, y = lerp(A.y, T.y, fly) + Math.sin(ang) * R * 0.4;
      gsap.set(b, { x, y });
      gsap.set(b.body, { y: -lerp(hA + 60, top, fly) - Math.sin(ang) * 20, scaleX: Math.sin(ang) > 0 ? -1 : 1 }); // 🕊️ faces left
      if (Math.random() < 0.03) feather(x, y);
    }) });
    MB.audio.sfx('choir');
    const beam = pillar(V, T, c, 'sky-beam');
    await gsap.fromTo(beam.body, { scaleX: 0, opacity: 0 }, { scaleX: 1.1, opacity: 1, duration: 0.35, ease: 'power2.out' });
    impact(); hit(V, t, c, true); V.shake(8);
    rise(V, T, '#ffffff', 16, hT * 1.6); ring(V, T, c, 2.4, 0.9);
    scatter(V, T, hT, ['🤍', '🪶', '💗'], 10, 140);
    MB.audio.sfx('flutter');
    doves.forEach((b, i) => {
      gsap.to(b, { x: T.x + rnd(-400, 400), y: T.y - rnd(100, 300), duration: 0.9, delay: i * 0.04, ease: 'power1.in' });
      gsap.to(b.body, { y: '-=300', opacity: 0, duration: 0.9, delay: i * 0.04, onComplete: () => b.remove() });
    });
    pop(V, T, hT + 120, own(a, 'finish', 'Such love...'), 'float-text heal', 1.1);
    await gsap.to(beam.body, { scaleX: 0, opacity: 0, duration: 0.5, delay: 0.2, onComplete: () => beam.remove() });
    await glowDown(v);
  };

  // Ororahime: brings the tea over, trips, and it goes everywhere... then Itami, the cursed blade on her back,
  // opens its eye and finishes the job. She is SO sorry
  S.teaspill = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, red = '#ff1a3c', tea = '#9ccf6a';
    const tray = V.billboard('thrown', '🍵', A.x + d.x * 30, A.y);
    tray.body.style.fontSize = '48px';
    gsap.set(tray.body, { y: -H * 0.62 });
    const tl = gsap.timeline({ onUpdate: () => gsap.set(tray, { x: gsap.getProperty(v.el, 'x') + d.x * 30, y: gsap.getProperty(v.el, 'y') }) });
    for (let i = 1; i <= 3; i++) { // careful little steps
      const P = { x: lerp(A.x, C.x, (i / 3) * 0.75), y: lerp(A.y, C.y, (i / 3) * 0.75) };
      tl.to(v.el, { x: P.x, y: P.y, duration: 0.22, ease: 'sine.inOut' }).to(v.figure, { y: -14, duration: 0.11, yoyo: true, repeat: 1 }, '<');
    }
    await tl;
    MB.audio.sfx('squeak');
    const F = here(v);
    pop(V, F, H + 60, 'Ah- AH!!', 'float-text baka', 0.9);
    gsap.to(v.figure, { rotation: sg * 35, y: 10, duration: 0.18, ease: 'power2.in' }); // ...and trips
    const fnT = arc({ x: F.x + d.x * 30, y: F.y }, T, H * 0.62, hT, 150);
    await path(tray, (k) => ({ ...fnT(k), r: sg * k * 540 }), 0.5, 'power1.in', (p) => {
      if (Math.random() < 0.6) { const dr = dot(V, p, p.h, tea, rnd(6, 11)); gsap.to(dr.body, { y: `+=${rnd(10, 50)}`, opacity: 0, duration: 0.5, onComplete: () => dr.remove() }); }
    });
    tray.remove();
    impact(); hit(V, t, tea); MB.audio.sfx('splash');
    droplets(V, T, 12); puff(V, T, '#ffffff', 5, hT, 0.8); // steam
    await wait(0.3);
    const eye = V.billboard('thrown eye', '👁️', F.x, F.y);
    eye.body.style.setProperty('--c', red);
    gsap.set(eye.body, { y: -H - 30, scaleY: 0 });
    MB.audio.sfx('dark');
    await gsap.to(eye.body, { scaleY: 1, duration: 0.2, ease: 'back.out(3)' });
    await wait(0.25);
    MB.audio.sfx('unsheathe');
    slashArc(V, T, -hT, red, -sg * 30);
    await wait(0.08);
    flash(V, T, hT, red, 300); V.hitStop(); V.shake(14); MB.audio.sfx('stab');
    burst(V, T, red, 14, { h: hT, spread: 130, shape: 'shard' });
    gsap.to(eye.body, { scaleY: 0, duration: 0.15, delay: 0.3, onComplete: () => eye.remove() });
    pop(V, T, hT + 120, own(a, 'finish', "I'm SO sorry!!"), 'float-text baka', 1.1);
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.25 });
    await goHome(v, A);
  };

  // Susan: the red carpet rolls out to the target, the paparazzi go wild on both sides as she struts the whole
  // length of it, and a hair flip dismisses the target
  S.redcarpet = async (V, a, t, impact) => {
    const { v, A, C, T, d, perp, hT, c } = ctx(V, a, t), H = V.heightOf(a);
    const rug = strip(V, { x: A.x + d.x * 40, y: A.y + d.y * 40 }, T, 'red-carpet', c);
    MB.audio.sfx('whoosh');
    pop(V, A, H + 95, own(a, 'cry', 'Cameras, darling.'), 'float-text buff', 1);
    await wait(0.45);
    const steps = 4, strut = gsap.fromTo(v.figure, { rotation: -5 }, { rotation: 5, duration: 0.2, yoyo: true, repeat: steps * 2 - 1, ease: 'sine.inOut' });
    for (let i = 1; i <= steps; i++) {
      const Q = { x: lerp(A.x, C.x, i / steps), y: lerp(A.y, C.y, i / steps) }, s = i % 2 ? 1 : -1, F = { x: Q.x + perp.x * s * 130, y: Q.y + perp.y * s * 130 };
      gsap.to(v.el, { x: Q.x, y: Q.y, duration: 0.38, ease: 'sine.inOut' });
      await wait(0.2);
      flash(V, F, H * 0.6, '#ffffff', 170); MB.audio.sfx('camera');
      const cam = V.billboard('petal', '📸', F.x, F.y);
      gsap.set(cam.body, { y: -H * 0.5, fontSize: 40 });
      gsap.fromTo(cam.body, { scale: 0 }, { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1, onComplete: () => cam.remove() });
      await wait(0.18);
    }
    strut.kill();
    MB.audio.sfx('swish');
    await gsap.to(v.figure, { rotationY: 360, rotation: 0, duration: 0.35, ease: 'power2.inOut' }); // the hair flip
    gsap.set(v.figure, { rotationY: 0 });
    for (let i = 0; i < 8; i++) { // and the gust off it
      const s = dot(V, { x: C.x, y: C.y + rnd(-20, 20) }, H * rnd(0.5, 0.9), '#fff6c8', rnd(6, 12), 'spark shard');
      gsap.to(s, { x: T.x + rnd(-50, 50), y: T.y + rnd(-15, 15), duration: 0.2, delay: i * 0.015 });
      gsap.to(s.body, { opacity: 0, duration: 0.15, delay: 0.18 + i * 0.015, onComplete: () => s.remove() });
    }
    await wait(0.18);
    impact(); hit(V, t, c, true); V.shake(10);
    scatter(V, T, hT, ['✨', '💅', '📸'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', 'Now shoo.'), 'float-text buff', 1.1);
    MB.audio.sfx('applause');
    gsap.to(rug, { opacity: 0, duration: 0.5, delay: 0.3, onComplete: () => rug.remove() });
    await wait(0.3);
    await goHome(v, A);
  };

  // Faneel: runs a circle round the target stringing razor wire as she goes (DrawSVG), then pulls it tight.
  // Anything shiny that falls out is hers now
  S.wires = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), R = 150;
    const pts = Array.from({ length: 7 }, (_, i) => { const ang = ((i * 3) / 7) * Math.PI * 2 - Math.PI / 2; return `${(160 + Math.cos(ang) * 140).toFixed(1)},${(130 + Math.sin(ang) * 110).toFixed(1)}`; }).join(' ');
    const wire = V.billboard('wires', `<svg viewBox="0 0 320 260" width="320" height="260" fill="none" stroke-linejoin="round">
      <polygon class="d" points="${pts}" stroke="${c}" stroke-width="6"/><polygon class="d" points="${pts}" stroke="#fff" stroke-width="2"/></svg>`, T.x, T.y);
    wire.body.style.setProperty('--c', c);
    gsap.set(wire.body, { y: -hT });
    const strokes = wire.body.querySelectorAll('.d');
    if (PLUG) gsap.set(strokes, { drawSVG: '0%' }); else gsap.set(strokes, { opacity: 0 });
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: T.x + R, y: T.y, duration: 0.25, ease: 'power2.in', onUpdate: () => ghost(V, v, c) });
    if (!PLUG) gsap.set(strokes, { opacity: 1 });
    draw(strokes, { duration: 0.8, ease: 'none' });
    const q = { a: 0 };
    await gsap.to(q, { a: Math.PI * 2, duration: 0.8, ease: 'none', onUpdate: () => { gsap.set(v.el, { x: T.x + Math.cos(q.a) * R, y: T.y + Math.sin(q.a) * R * 0.45 }); ghost(V, v, c); } });
    MB.audio.sfx('stretch');
    await gsap.to(wire.body, { scale: 0.35, duration: 0.18, ease: 'power4.in' }); // pulled tight
    impact(); hit(V, t, c, true); V.hitStop(); V.shake(12);
    [-50, 0, 50].forEach((rot) => slashArc(V, T, -hT, c, rot));
    MB.audio.sfx('swish');
    gsap.to(wire.body, { scale: 0.1, opacity: 0, duration: 0.25, onComplete: () => wire.remove() });
    const L0 = here(v);
    for (let i = 0; i < 5; i++) {
      const b = V.billboard('petal', MB.pick(['💰', '💎', '👛', '🪙']), T.x, T.y), fn = arc(T, L0, hT, H * 0.6, 140 + i * 20, rnd(-60, 60), { x: 0, y: 1 });
      b.body.style.fontSize = '34px';
      wait(i * 0.07).then(() => path(b, (k) => ({ ...fn(k), r: k * 360 }), 0.5, 'sine.inOut')).then(() => { b.remove(); MB.audio.sfx('coin'); });
    }
    pop(V, T, hT + 120, own(a, 'finish', 'Mine now~'), 'float-text debuff', 1.1);
    await wait(0.6);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- signature styles: Fake It to Make It! and the
  // Adoptive Life leads
  const RAINBOW = ['#ff4d6d', '#ff9f1c', '#ffe14d', '#5fd068', '#4db4ff', '#a66bff'];
  // little things circling over a head for a while (dizzy stars, hearts)
  function dizzy(V, P, h, chars, dur = 1.2, n = 3) {
    const bs = Array.from({ length: n }, (_, i) => { const b = V.billboard('petal', chars[i % chars.length], P.x, P.y); b.body.style.fontSize = '28px'; return b; });
    const q = { a: 0 }, end = Math.PI * 2 * dur * 1.6;
    return gsap.to(q, { a: end, duration: dur, ease: 'none', onUpdate: () => bs.forEach((b, i) => {
      const ang = q.a + (i / n) * Math.PI * 2;
      gsap.set(b, { x: P.x + Math.cos(ang) * 50, y: P.y + Math.sin(ang) * 18 });
      gsap.set(b.body, { y: -h - Math.sin(ang) * 10, opacity: Math.min(1, (1 - q.a / end) * 5) });
    }), onComplete: () => bs.forEach((b) => b.remove()) });
  }
  // three sound-wave arcs standing at P, drawn in, facing along sg (1 right, -1 left)
  function soundwave(V, P, c, sg = 1) {
    const arcs = [0, 1, 2].map((j) => `<path class="d" d="M${30 + j * 24},${34 + j * 10} Q${74 + j * 24},100 ${30 + j * 24},${166 - j * 10}" stroke-width="${11 - j * 3}"/>`).join('');
    const w = V.billboard('soundwave', `<svg viewBox="0 0 120 200" width="120" height="200" fill="none" stroke="${c}" stroke-linecap="round"
      style="transform: scaleX(${sg})">${arcs}</svg>`, P.x, P.y);
    w.body.style.setProperty('--c', c);
    draw(w.body.querySelectorAll('.d'), { duration: 0.15, stagger: 0.04 });
    return w;
  }

  // Maria: nobody touches her kids. A great spirit bear rises behind her and roars the target back a step, its paw
  // comes down with three claw marks, and then she is just Mom again
  S.mamabear = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', 'Who touched my babies?!'), 'float-text burn', 1.1);
    await gsap.to(v.figure, { y: -12, scaleY: 1.08, duration: 0.18, yoyo: true, repeat: 1 }); // sleeves up
    const B = { x: A.x - sg * 40, y: A.y - 60 }, bear = V.billboard('thrown spirit bear', '🐻', B.x, B.y);
    bear.body.style.setProperty('--c', c);
    gsap.set(bear.body, { yPercent: -100, y: 10, transformOrigin: '50% 100%' });
    MB.audio.sfx('grow');
    await gsap.fromTo(bear.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.45, ease: 'back.out(1.8)' });
    // the roar, and the gust off it
    MB.audio.sfx('stomp'); MB.audio.sfx('boom'); V.shake(16);
    pop(V, B, H * 1.5, 'RAWRR!!', 'float-text burn', 1.1);
    gsap.fromTo(bear.body, { scale: 1.14 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.3)' });
    [0, 1, 2].forEach((i) => gsap.delayedCall(i * 0.1, () => ring(V, A, c, 1.6 + i * 0.8, 0.5)));
    for (let i = 0; i < 12; i++) {
      const s = dot(V, { x: A.x + perp.x * rnd(-90, 90), y: A.y + perp.y * rnd(-90, 90) }, rnd(30, H), '#ffffff', rnd(5, 9), 'spark shard');
      gsap.to(s, { x: T.x + perp.x * rnd(-90, 90), y: T.y + perp.y * rnd(-90, 90), duration: 0.35, delay: i * 0.015, ease: 'power1.in' });
      gsap.to(s.body, { opacity: 0, duration: 0.1, delay: 0.3 + i * 0.015, onComplete: () => s.remove() });
    }
    if (tv) gsap.to(tv.el, { x: T.x + d.x * 40, y: T.y + d.y * 40, duration: 0.25, ease: 'power2.out' });
    await wait(0.3);
    const paw = V.billboard('thrown spirit paw', '🐾', T.x, T.y);
    paw.body.style.setProperty('--c', c);
    gsap.set(paw.body, { y: -hT - 420, rotation: -sg * 25, scale: 1.3 });
    gsap.to(bear.body, { rotation: sg * 12, duration: 0.25 }); // leans in
    MB.audio.sfx('whistleDown');
    await gsap.to(paw.body, { y: -hT * 0.7, rotation: 0, duration: 0.32, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    decal(V, T, 'crater', c, 1);
    cracks(V, T, '#2b1d12', { n: 8, len: 160, w: 6, glow: c, hold: 0.9 });
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.6, scaleX: 1.25 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)', overwrite: 'auto' });
    gsap.to(paw.body, { opacity: 0, scale: 1.8, duration: 0.3, delay: 0.1, onComplete: () => paw.remove() });
    await wait(0.12);
    MB.audio.sfx('swish');
    [-30, 0, 30].forEach((off, i) => gsap.delayedCall(i * 0.05, () => slashArc(V, { x: T.x + off, y: T.y }, -hT, c, sg * 60)));
    await wait(0.35);
    if (tv) gsap.to(tv.el, { x: T.x, y: T.y, duration: 0.4, ease: 'power2.out' });
    // and she is Mom again
    scatter(V, B, H * 0.8, ['💚', '💕', '✨'], 8, 120);
    gsap.to(bear.body, { scale: 0, opacity: 0, rotation: 0, duration: 0.35, ease: 'back.in(2)', onComplete: () => bear.remove() });
    MB.audio.sfx('heal');
    pop(V, A, H + 50, '♥', 'float-text heal', 0.9);
    pop(V, T, hT + 120, own(a, 'finish', "Dinner's at six, sweetie."), 'float-text heal', 1.2);
    await wait(0.4);
  };

  // Hayley: sunshine on legs. The sun comes out over her, she throws a rainbow across the board band by band, slides
  // down it on a trail of sparkles and lands on the target in a burst of stars
  S.rainbow = async (V, a, t, impact) => {
    const { v, A, C, T, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), em = [].concat(a.card.attack.emoji || ['✦', '⭐', '💖']);
    const sun = V.billboard('thrown sun', '☀️', A.x, A.y);
    gsap.set(sun.body, { y: -H - 70, scale: 0 });
    MB.audio.sfx('sparkle');
    gsap.to(sun.body, { scale: 1, duration: 0.35, ease: 'back.out(2)' });
    const spinSun = gsap.to(sun.body, { rotation: 360, duration: 3, ease: 'none', repeat: -1 });
    pop(V, A, H + 150, own(a, 'cry', 'Smile, everyone!'), 'float-text buff', 1.1);
    await gsap.to(v.figure, { y: -40, duration: 0.14, yoyo: true, repeat: 3, ease: 'power1.out' }); // two happy hops
    // the rainbow, red on top, from her feet to the target's; it bows out sideways so it reads as an arc whichever way
    // it crosses the board
    const ride = arc(A, C, 0, 0, 240, 170, perp), band = 13, top = RAINBOW.length * band, N = 22, bands = [];
    MB.audio.sfx('whistleUp');
    for (let s = 0; s <= N; s++) {
      const k = s / N, p = ride(k);
      RAINBOW.forEach((col, i) => {
        const b = dot(V, p, p.h + (RAINBOW.length - 1 - i) * band, col, 24, 'rb-dot');
        gsap.fromTo(b.body, { scale: 0 }, { scale: 1, duration: 0.2, delay: k * 0.5, ease: 'back.out(3)' });
        bands.push(b);
      });
    }
    await wait(0.65);
    // she rides it down
    MB.audio.sfx('boing');
    const q = { k: 0 }, sx = C.x >= A.x ? 1 : -1;
    await gsap.to(q, { k: 1, duration: 0.9, ease: 'power1.in', onUpdate: () => {
      const p = ride(q.k), p2 = ride(Math.min(1, q.k + 0.02));
      gsap.set(v.el, { x: p.x, y: p.y });
      gsap.set(v.figure, { y: -(p.h + top * Math.sin(Math.PI * q.k)), rotation: Math.max(-25, Math.min(25, -(p2.h - p.h) * 3 * sx)) });
      ghost(V, v, MB.pick(RAINBOW));
      if (Math.random() < 0.3) {
        const e = V.billboard('petal', MB.pick(em), p.x, p.y);
        gsap.set(e.body, { y: -(p.h + top + rnd(20, 90)), scale: rnd(0.6, 1.1) });
        gsap.to(e.body, { y: '+=60', opacity: 0, rotation: rnd(-180, 180), duration: 0.6, onComplete: () => e.remove() });
      }
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('boing'); MB.audio.sfx('sparkle'); V.shake(12);
    RAINBOW.forEach((col, i) => ring(V, T, col, 1.3 + i * 0.25, 0.7));
    scatter(V, T, hT, em.concat('🌈'), 14, 170);
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.7, scaleX: 1.2 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)', overwrite: 'auto' });
    await gsap.timeline().to(v.figure, { y: -60, rotation: 0, duration: 0.18, ease: 'power2.out' }).to(v.figure, { y: 0, duration: 0.25, ease: 'bounce.out' });
    pop(V, T, hT + 120, own(a, 'finish', 'Yay! Sparkle power!'), 'float-text buff', 1.1);
    // the rainbow fades from her end
    bands.forEach((b, i) => gsap.to(b.body, { opacity: 0, scale: 0.3, duration: 0.3, delay: (i / bands.length) * 0.5, onComplete: () => b.remove() }));
    gsap.to(sun.body, { scale: 0, duration: 0.3, delay: 0.3, onComplete: () => { spinSun.kill(); sun.remove(); } });
    await goHome(v, A);
  };

  // James: can't be bothered to look up. Out comes the phone, the typing dots go on and on, and the reply lands
  // like a brick: "k." Then the read receipt
  S.leftonread = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    puff(V, A, '#dfe6ff', 3, H * 0.8, 0.6);
    pop(V, A, H + 60, '*sigh*', 'float-text hic', 0.9);
    const phone = V.billboard('thrown', '📱', A.x + sg * 34, A.y);
    phone.body.style.fontSize = '44px';
    gsap.set(phone.body, { y: -H * 0.5, scale: 0 });
    await gsap.to(phone.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    gsap.to(v.figure, { rotation: sg * 5, duration: 0.3 }); // head down
    pop(V, A, H + 95, own(a, 'cry', 'Ugh. Fine.'), 'float-text shield', 1);
    const bub = V.billboard('chat-bubble typing', '<i></i><i></i><i></i>', A.x, A.y);
    bub.body.style.setProperty('--c', c);
    gsap.set(bub.body, { y: -H - 40, scale: 0 });
    await gsap.to(bub.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    const dots = gsap.to(bub.body.querySelectorAll('i'), { y: -8, duration: 0.18, stagger: { each: 0.1, repeat: -1, yoyo: true } });
    for (let i = 0; i < 3; i++) { MB.audio.sfx('tick'); await wait(0.3); }
    dots.kill();
    bub.body.className = 'bb-body chat-bubble';
    bub.body.textContent = 'k.';
    MB.audio.sfx('swipe');
    await gsap.fromTo(bub.body, { scale: 0.7 }, { scale: 1.2, duration: 0.15, ease: 'back.out(3)' });
    await wait(0.15);
    const fly = arc(A, T, H + 40, hT + 190, 90);
    await path(bub, (k) => ({ ...fly(k), s: 1.2 + k * 1.6 }), 0.5, 'power1.inOut');
    await wait(0.12);
    MB.audio.sfx('whistleDown');
    await gsap.to(bub.body, { y: -hT * 0.5, duration: 0.2, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('thud'); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.45, scaleX: 1.35 }, { scaleY: 1, scaleX: 1, duration: 0.8, delay: 0.25, ease: 'elastic.out(1,0.35)', overwrite: 'auto' });
    cracks(V, T, '#1a1a2a', { n: 7, len: 140, w: 5, glow: c, hold: 0.8 });
    puff(V, T, '#dfe6ff', 6, 10, 1);
    gsap.to(bub.body, { opacity: 0, scale: 4.5, duration: 0.3, delay: 0.25, onComplete: () => bub.remove() });
    await wait(0.35);
    const rd = V.billboard('read-receipt', 'Read 12:04 ✓✓', T.x, T.y);
    gsap.set(rd.body, { y: -hT * 2 - 30 });
    MB.audio.sfx('ding');
    gsap.timeline({ onComplete: () => rd.remove() }).fromTo(rd.body, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2 }).to(rd.body, { opacity: 0, duration: 0.3, delay: 0.9 });
    pop(V, T, hT + 120, own(a, 'finish', 'Riveting.'), 'float-text shield', 1.1);
    gsap.to(phone.body, { scale: 0, duration: 0.2, delay: 0.4, onComplete: () => phone.remove() });
    await gsap.to(v.figure, { rotation: 0, duration: 0.3, delay: 0.3 });
  };

  // Carys: heart eyes. She sprints in trailing hearts and glomps the target: a spin, three big squeezes, and she lets
  // go of a very dizzy, very loved target
  S.glomp = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const eyes = V.billboard('thrown', '😍', A.x, A.y);
    gsap.set(eyes.body, { y: -H - 50, scale: 0 });
    MB.audio.sfx('heartbeat');
    await gsap.to(eyes.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    gsap.to(v.figure, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 3 });
    pop(V, A, H + 95, own(a, 'cry', 'You need a HUG!!'), 'float-text baka', 1);
    await wait(0.5);
    gsap.to(eyes.body, { scale: 0, duration: 0.15, onComplete: () => eyes.remove() });
    const G = { x: T.x - d.x * 40, y: T.y - d.y * 40 };
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: G.x, y: G.y, duration: 0.45, ease: 'power2.in', onUpdate: () => {
      ghost(V, v, c);
      if (Math.random() < 0.3) {
        const p = here(v), h = V.billboard('petal', MB.pick(['💕', '💗', '💖']), p.x, p.y);
        gsap.set(h.body, { y: -H * rnd(0.3, 0.8) });
        gsap.to(h.body, { y: '-=50', opacity: 0, scale: 0.4, duration: 0.6, onComplete: () => h.remove() });
      }
    } });
    impact(); hit(V, t, c); MB.audio.sfx('boing'); V.shake(8);
    const spun = tv ? [v.figure, tv.figure] : v.figure;
    gsap.to(spun, { rotationY: '+=360', duration: 0.5, ease: 'power2.inOut', onComplete: () => gsap.set(spun, { rotationY: 0 }) }); // the spin
    const hearts = Array.from({ length: 8 }, (_, i) => V.billboard('petal', i % 2 ? '💗' : '💕', T.x, T.y)), q = { a: 0 };
    const orbit = gsap.to(q, { a: Math.PI * 4, duration: 1.3, ease: 'none', onUpdate: () => hearts.forEach((b, i) => {
      const ang = q.a + (i / 8) * Math.PI * 2;
      gsap.set(b, { x: T.x + Math.cos(ang) * 130, y: T.y + Math.sin(ang) * 50 });
      gsap.set(b.body, { y: -hT - Math.sin(ang) * 20, scale: 1.3 });
    }) });
    await wait(0.4);
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('squeak');
      if (tv) gsap.fromTo(tv.figure, { scaleX: 0.78, scaleY: 1.1 }, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'elastic.out(1,0.4)' });
      gsap.fromTo(v.figure, { scaleX: 0.9 }, { scaleX: 1, duration: 0.3 });
      pop(V, T, hT + 60 + i * 30, 'SQUEEZE!', 'float-text baka', 0.6);
      burst(V, T, c, 8, { h: hT, spread: 80 });
      await wait(0.3);
    }
    await orbit;
    hearts.forEach((b) => gsap.to(b.body, { y: '-=80', opacity: 0, duration: 0.4, onComplete: () => b.remove() }));
    scatter(V, T, hT, ['💕', '💖', '✨'], 10, 150);
    if (tv) dizzy(V, T, hT * 2 + 10, ['💫', '💗'], 1.3);
    pop(V, T, hT + 120, own(a, 'finish', 'Feel better now?'), 'float-text baka', 1.1);
    await gsap.to(v.figure, { y: -30, duration: 0.12, yoyo: true, repeat: 1 }); // a happy skip
    await goHome(v, A);
  };

  // Jack: says nothing. Three-point stance, the field rolls out under him, the snap, and he runs the length of it
  // straight through the target. Then he spikes the ball
  S.touchdown = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const field = strip(V, { x: A.x - d.x * 60, y: A.y - d.y * 60 }, { x: T.x + d.x * 70, y: T.y + d.y * 70 }, 'turf', c);
    MB.audio.sfx('whistle');
    pop(V, A, H + 95, own(a, 'cry', 'Hut... HUT!'), 'float-text buff', 1);
    await gsap.to(v.figure, { scaleY: 0.82, y: 12, rotation: sg * 8, duration: 0.25 }); // three-point stance
    await wait(0.3);
    // the snap
    const S0 = { x: A.x - d.x * 150, y: A.y - d.y * 150 }, ball = V.billboard('thrown', '🏈', S0.x, S0.y), snap = arc(S0, A, 20, H * 0.5, 60);
    ball.body.style.fontSize = '44px';
    MB.audio.sfx('whoosh');
    await path(ball, (k) => ({ ...snap(k), r: k * 720 }), 0.3, 'power1.out');
    const hold = () => gsap.set(ball, { x: gsap.getProperty(v.el, 'x'), y: gsap.getProperty(v.el, 'y') });
    gsap.set(v.figure, { scaleY: 1, y: 0, rotation: sg * 14 }); // head down, go
    const yards = ['30', '20', '10'];
    for (let i = 0; i < 3; i++) {
      const P = { x: lerp(A.x, C.x, (i + 1) / 3), y: lerp(A.y, C.y, (i + 1) / 3) };
      MB.audio.sfx('stomp');
      await gsap.to(v.el, { x: P.x, y: P.y, duration: 0.2, ease: 'none', onUpdate: () => { ghost(V, v, c); hold(); } });
      pop(V, P, 30, yards[i], 'float-text yard', 0.6);
      puff(V, P, '#b8d8a0', 2, 0, 0.6);
    }
    impact(); hit(V, t, c, true); MB.audio.sfx('punch'); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    if (tv) gsap.timeline().to(tv.figure, { rotation: sg * 80, y: -120, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
      .to(tv.figure, { rotation: 0, y: 0, duration: 0.45, ease: 'bounce.out' });
    debris(V, T, '#5a9a3a', 12, { spread: 180 }); debris(V, T, '#6b4a26', 6, { spread: 140 });
    [0, 1, 2].forEach((i) => gsap.delayedCall(i * 0.08, () => ring(V, T, c, 1.5 + i * 0.6, 0.5)));
    await gsap.to(v.el, { x: T.x + d.x * 30, y: T.y + d.y * 30, duration: 0.15, ease: 'power2.out', onUpdate: hold }); // drives on through
    // the spike
    gsap.set(v.figure, { rotation: 0 });
    MB.audio.sfx('whoosh');
    await gsap.to(ball.body, { y: -H - 60, rotation: -90, duration: 0.18, ease: 'power2.out' });
    await gsap.to(ball.body, { y: -10, rotation: 90, duration: 0.12, ease: 'power3.in' });
    MB.audio.sfx('boing'); ring(V, here(v), '#ffffff', 1.2, 0.4);
    toss(ball, { v: [500, 700], ang: [-110, -70], g: 1800, dur: 0.9, spin: 720 });
    scatter(V, T, hT, ['🏈', '🎉', '💨'], 10, 160);
    pop(V, T, hT + 120, own(a, 'finish', 'TOUCHDOWN!'), 'float-text buff', 1.1);
    MB.audio.sfx('cheer');
    gsap.to(field, { opacity: 0, duration: 0.5, delay: 0.3, onComplete: () => field.remove() });
    await wait(0.4);
    await goHome(v, A);
  };

  // Seren: tiny, with a megaphone bigger than she is. A deep breath, a teeny "eep"... then the real one, and the
  // sound itself bowls the target over. Hehe!
  S.squeak = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const M = { x: A.x + d.x * 45, y: A.y + d.y * 45 }, h0 = H * 0.55;
    const mega = V.billboard('thrown big', `<span style="display:inline-block; transform: scaleX(${-sg})">📣</span>`, M.x, M.y);
    gsap.set(mega.body, { y: -h0, scale: 0 });
    await gsap.to(mega.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    MB.audio.sfx('whistleUp');
    pop(V, A, H + 50, '*deep breath*', 'float-text hic', 0.9);
    await gsap.to(v.figure, { scale: 1.12, duration: 0.5, ease: 'power1.in' });
    gsap.to(v.figure, { scale: 1, duration: 0.15 });
    MB.audio.sfx('squeak');
    pop(V, M, h0 + 30, 'eep!', 'float-text hic', 0.7);
    ring(V, M, c, 0.4, 0.4);
    await wait(0.5); // ...that was it?
    pop(V, A, H + 95, own(a, 'cry', 'NO! FIGHTING!!'), 'float-text buff', 1.1);
    await gsap.to(v.figure, { scale: 1.15, duration: 0.2 });
    MB.audio.sfx('megaphone');
    gsap.to(v.figure, { scale: 1, duration: 0.1 });
    gsap.to(v.figure, { x: -sg * 24, duration: 0.1, yoyo: true, repeat: 1 }); // the recoil
    gsap.to(mega.body, { scale: 1.25, duration: 0.08, yoyo: true, repeat: 7 });
    [...'SQUEAK!'].forEach((ch, i) => wait(i * 0.05).then(() => {
      const b = V.billboard('float-text buff', ch, M.x, M.y), fn = arc(M, { x: T.x + rnd(-70, 70), y: T.y + rnd(-20, 20) }, h0, hT + rnd(-30, 90), rnd(20, 90)), spin = rnd(-120, 120);
      b.body.style.color = i % 2 ? '#ffffff' : c;
      path(b, (k) => ({ ...fn(k), s: 0.8 + k * 1.2, r: k * spin }), 0.45, 'power1.in').then(() => gsap.to(b.body, { opacity: 0, scale: 2, duration: 0.2, onComplete: () => b.remove() }));
    }));
    let first = true;
    await Promise.all([0, 1, 2, 3].map((i) => wait(i * 0.13).then(() => {
      const w = soundwave(V, M, i % 2 ? '#ffffff' : c, sg);
      return path(w, (k) => ({ x: lerp(M.x, T.x, k), y: lerp(M.y, T.y, k), h: lerp(h0, hT, k), s: 0.5 + k * 1.3 }), 0.4, 'power1.in').then(() => {
        gsap.to(w.body, { opacity: 0, scale: 2.2, duration: 0.2, onComplete: () => w.remove() });
        if (first) { first = false; impact(); hit(V, t, c, true); } else { ring(V, T, c, 1.6, 0.4); MB.audio.sfx('squeak'); }
        V.shake(8);
        if (tv) gsap.fromTo(tv.figure, { rotation: sg * (10 + i * 4) }, { rotation: 0, duration: 0.35, ease: 'elastic.out(1,0.3)' });
      });
    })));
    MB.audio.sfx('boom'); V.shake(14);
    burst(V, T, c, 14, { h: hT, spread: 150 });
    if (tv) gsap.timeline().to(tv.el, { x: T.x + d.x * 50, y: T.y + d.y * 50, duration: 0.15, ease: 'power2.out' }).to(tv.el, { x: T.x, y: T.y, duration: 0.4, ease: 'power2.inOut' });
    pop(V, T, hT + 120, own(a, 'finish', 'Eep! Hehe! Sorry!'), 'float-text buff', 1.1);
    await gsap.to(v.figure, { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1 }); // hides behind it, giggling
    await gsap.to(mega.body, { scale: 0, rotation: sg * 90, duration: 0.25, onComplete: () => mega.remove() });
  };

  // Catrin: kills with kindness. Compliments float over and circle the target until it blushes, daisies pop up all
  // round it, and all that niceness lands at once
  const COMPLIMENTS = ['Nice hair!', 'Great smile!', "You're amazing!", 'Love your shoes!', 'So brave!', 'Cute outfit!', 'You tried SO hard!'];
  S.kindness = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Hi! You look SO nice!'), 'float-text buff', 1.1);
    const sway = gsap.fromTo(v.figure, { rotation: -5 }, { rotation: 5, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const words = COMPLIMENTS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    const bs = words.map((w, i) => {
      const b = V.billboard('compliment', w, A.x, A.y);
      b.body.style.setProperty('--c', c);
      gsap.set(b.body, { opacity: 0 });
      gsap.delayedCall(i * 0.13, () => MB.audio.sfx('ding'));
      return b;
    });
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1.4, ease: 'sine.inOut', onUpdate: () => bs.forEach((b, i) => {
      const k = Math.max(0, Math.min(1, q.k * 1.5 - i * 0.12)), fly = Math.min(1, k * 1.7), ang = k * Math.PI * 2.5 + (i / bs.length) * Math.PI * 2, R = 120 * Math.min(1, k * 1.6);
      gsap.set(b, { x: lerp(A.x, T.x, fly) + Math.cos(ang) * R, y: lerp(A.y, T.y, fly) + Math.sin(ang) * R * 0.4 });
      gsap.set(b.body, { y: -lerp(hA + 50, hT * 2 + 30, fly) - Math.sin(ang) * 16, opacity: k > 0 ? 1 : 0 });
    }) });
    // the target blushes
    if (tv) {
      gsap.fromTo(tv.img, { filter: 'sepia(0.35) saturate(2.2) hue-rotate(-25deg) brightness(1.08)' },
        { filter: 'sepia(0) saturate(1) hue-rotate(0deg) brightness(1)', duration: 1.4, delay: 0.7, clearProps: 'filter' });
      gsap.fromTo(tv.figure, { rotation: -4 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    }
    MB.audio.sfx('squeak');
    pop(V, T, hT * 2 + 20, '😳', 'thrown', 1);
    // daisies pop up all round it
    const flowers = Array.from({ length: 8 }, (_, i) => {
      const ang = (i / 8) * Math.PI * 2, f = V.billboard('petal', MB.pick(['🌼', '🌸', '🌻']), T.x + Math.cos(ang) * 120, T.y + Math.sin(ang) * 50);
      f.body.style.fontSize = '38px';
      gsap.set(f.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%', scale: 0 });
      gsap.to(f.body, { scale: 1, duration: 0.35, delay: i * 0.05, ease: 'back.out(3)', onStart: () => i % 2 || MB.audio.sfx('pop') });
      return f;
    });
    await wait(0.5);
    await Promise.all(bs.map((b, i) => Promise.all([
      gsap.to(b, { x: T.x, y: T.y, duration: 0.25, delay: i * 0.04, ease: 'power2.in' }),
      gsap.to(b.body, { y: -hT, scale: 0.3, duration: 0.25, delay: i * 0.04, ease: 'power2.in' }),
    ]).then(() => b.remove())));
    impact(); hit(V, t, '#ffd84a', true); MB.audio.sfx('sparkle'); MB.audio.sfx('holy'); V.shake(10);
    flash(V, T, hT, '#fff6c8', 360); rise(V, T, '#ffe98a', 14, hT * 1.5);
    flowers.forEach((f) => {
      gsap.to(f.body, { scale: 1.4, duration: 0.15, yoyo: true, repeat: 1 });
      gsap.to(f.body, { opacity: 0, duration: 0.3, delay: 0.8, onComplete: () => f.remove() });
    });
    scatter(V, T, hT, ['🌼', '💛', '✨', '😊'], 12, 160);
    sway.kill();
    gsap.to(v.figure, { rotation: 0, duration: 0.2 });
    pop(V, A, H + 40, '👍', 'thrown', 1);
    pop(V, T, hT + 120, own(a, 'finish', 'Have a lovely day!'), 'float-text buff', 1.1);
    await wait(0.5);
  };

  // Alice: one candy is all it takes. Sugar high: she shakes, goes every color at once and pinballs round the target
  // off invisible walls with candy flying off her, until she crashes into it face first
  S.sugarrush = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const F = { x: A.x + perp.x * 120, y: A.y + perp.y * 120 }, candy = V.billboard('thrown', '🍬', F.x, F.y), cf = arc(F, A, H * 0.6, H * 0.85, 140);
    candy.body.style.fontSize = '40px';
    MB.audio.sfx('whoosh');
    await path(candy, (k) => ({ ...cf(k), r: k * 540 }), 0.4, 'power1.in');
    candy.remove(); MB.audio.sfx('chomp');
    pop(V, A, H + 60, 'Nom!', 'float-text hic', 0.7);
    await wait(0.25);
    pop(V, A, H + 95, own(a, 'cry', 'SUGAR RUSH!!'), 'float-text baka', 1);
    MB.audio.sfx('zip');
    const hue = gsap.fromTo(v.img, { filter: 'hue-rotate(0deg) saturate(1.6) brightness(1.1)' }, { filter: 'hue-rotate(360deg) saturate(1.6) brightness(1.1)', duration: 0.4, repeat: -1, ease: 'none' });
    const jit = gsap.fromTo(v.figure, { x: -5 }, { x: 5, duration: 0.04, yoyo: true, repeat: -1 });
    await wait(0.5);
    // pinball: wall to wall across the target, a hit every time she passes through
    let first = true;
    for (let i = 0; i < 5; i++) {
      const s = i % 2 ? 1 : -1, Q = { x: T.x + perp.x * s * 210 + d.x * rnd(-90, 60), y: T.y + perp.y * s * 210 + d.y * rnd(-90, 60) }, dur = i ? 0.18 : 0.28;
      if (i) gsap.delayedCall(dur / 2, () => {
        if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, T, hT, MB.pick(RAINBOW), 150); burst(V, T, MB.pick(RAINBOW), 8, { h: hT, spread: 90 }); }
        MB.audio.sfx('punch'); V.shake(6);
        if (tv) gsap.fromTo(tv.figure, { x: -s * 18 }, { x: 0, duration: 0.25 });
      });
      await gsap.to(v.el, { x: Q.x, y: Q.y, duration: dur, ease: 'none', onUpdate: () => {
        ghost(V, v, MB.pick(RAINBOW));
        if (Math.random() < 0.25) { const p = here(v), b = V.billboard('petal', MB.pick(['🍬', '🍭', '🍩']), p.x, p.y); gsap.set(b.body, { y: -H * 0.5 }); toss(b, { v: [200, 380], dur: 0.6 }); }
      } });
      MB.audio.sfx('boing'); ring(V, Q, c, 0.8, 0.3); burst(V, Q, MB.pick(RAINBOW), 6, { h: H * 0.5, spread: 60 });
    }
    jit.kill(); gsap.set(v.figure, { x: 0 });
    // the crash
    await gsap.to(v.el, { x: T.x - d.x * 50, y: T.y - d.y * 50, duration: 0.14, ease: 'power2.in' });
    MB.audio.sfx('pow'); V.shake(16); V.hitStop();
    flash(V, T, hT, '#ffffff', 300); ring(V, T, c, 2.2); decal(V, T, 'splat', '#ff8ad8', 1);
    scatter(V, T, hT, ['🍬', '🍭', '🧁', '🍩', '🍫'], 16, 190);
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.7, scaleX: 1.2 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)' });
    hue.kill();
    gsap.to(v.img, { filter: 'hue-rotate(0deg) saturate(1) brightness(1)', duration: 0.4, clearProps: 'filter' });
    gsap.fromTo(v.figure, { rotation: -10 }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1,0.2)' }); // woozy
    dizzy(V, here(v), H + 10, ['🍬', '⭐'], 1);
    pop(V, T, hT + 120, own(a, 'finish', '...more candy?'), 'float-text baka', 1.1);
    await wait(0.8);
    await goHome(v, A, 0.6);
  };

  // Megan: order! Three bangs of the gavel, the whole board votes (the ballots fly in, the tally runs up), and when
  // the motion passes a gavel the size of a door comes down on the target
  S.gavel = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, mark = (a.card.attack.mark || 'PASSED').toUpperCase();
    const hammer = V.billboard('thrown', '🔨', A.x + sg * 50, A.y);
    hammer.body.style.fontSize = '54px';
    gsap.set(hammer.body, { y: -H * 0.6, transformOrigin: '75% 75%', rotation: -30, scale: 0 });
    await gsap.to(hammer.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 95, own(a, 'cry', 'Order! ORDER!'), 'float-text shield', 1);
    for (let i = 0; i < 3; i++) {
      await gsap.to(hammer.body, { rotation: 30, duration: 0.09, ease: 'power3.in' });
      MB.audio.sfx('gavel', { rate: 1.2 }); V.shake(4 + i * 2); ring(V, A, c, 0.8, 0.3);
      await gsap.to(hammer.body, { rotation: -30, duration: 0.12 });
    }
    // the vote
    const tally = V.billboard('tally', '<b>ALL IN FAVOR?</b><span>YES <i>0</i></span>', A.x, A.y), num = tally.body.querySelector('i');
    tally.body.style.setProperty('--c', c);
    gsap.set(tally.body, { y: -H - 120, scale: 0 });
    await gsap.to(tally.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    let yes = 0;
    await Promise.all(Array.from({ length: 9 }, (_, i) => wait(i * 0.07).then(() => {
      const F = { x: rnd(80, 1100), y: rnd(80, 700) }, fn = arc(F, A, 0, H + 120, 160), b = V.billboard('petal', '📄', F.x, F.y);
      b.body.style.fontSize = '30px';
      return path(b, (k) => ({ ...fn(k), r: k * 360 }), 0.5, 'sine.inOut').then(() => {
        b.remove(); num.textContent = ++yes; MB.audio.sfx('tink');
        gsap.fromTo(tally.body, { scale: 1.12 }, { scale: 1, duration: 0.15 });
      });
    })));
    tally.body.classList.add('passed');
    tally.body.innerHTML = `<b>${mark}</b>`;
    MB.audio.sfx('slam');
    gsap.fromTo(tally.body, { scale: 1.6, rotation: -8 }, { scale: 1, rotation: -8, duration: 0.2, ease: 'power3.in' });
    await wait(0.35);
    // the big one
    const big = V.billboard('thrown giant-gavel', '🔨', T.x, T.y);
    big.body.style.setProperty('--c', c);
    gsap.set(big.body, { y: -hT - 320, transformOrigin: '75% 75%', rotation: -sg * 70 });
    MB.audio.sfx('whistleDown');
    await gsap.fromTo(big.body, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2 });
    await gsap.to(big.body, { y: -hT * 0.9, rotation: sg * 25, duration: 0.25, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('gavel', { rate: 0.8 }); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    cracks(V, T, '#2b1d12', { n: 8, len: 160, w: 6, glow: c, hold: 0.9 });
    ring(V, T, '#ffffff', 2.4, 0.6);
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.55, scaleX: 1.3 }, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1,0.35)' });
    gsap.to(big.body, { y: '-=60', rotation: -sg * 10, opacity: 0, duration: 0.4, delay: 0.2, onComplete: () => big.remove() });
    gsap.to(tally.body, { opacity: 0, y: '-=40', duration: 0.3, delay: 0.3, onComplete: () => tally.remove() });
    gsap.to(hammer.body, { scale: 0, duration: 0.2, delay: 0.3, onComplete: () => hammer.remove() });
    pop(V, T, hT + 120, own(a, 'finish', 'Motion carried.'), 'float-text shield', 1.1);
    await wait(0.5);
  };

  // Eira: like, SO over it. She checks her nails and blows on them (glitter and snow drift over), then a giant finger
  // wags at the target: nuh, uh, NUH UH, flinging ice with every wag. And the last word falls on it: DUH!
  S.nuhuh = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, ice = '#bff4ff';
    const nails = V.billboard('thrown', '💅', A.x + sg * 40, A.y);
    nails.body.style.fontSize = '44px';
    gsap.set(nails.body, { y: -H * 0.62, scale: 0 });
    await gsap.to(nails.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 95, own(a, 'cry', 'Ugh, like, whatever~'), 'float-text baka', 1);
    await wait(0.35);
    MB.audio.sfx('wind'); MB.audio.sfx('sparkle');
    for (let i = 0; i < 14; i++) { // the breath
      const TT = { x: T.x + rnd(-80, 80), y: T.y + rnd(-30, 30) }, fn = arc(A, TT, H * 0.62, hT * rnd(0.8, 1.8), rnd(20, 80)), sp = rnd(-360, 360);
      const b = V.billboard('petal', MB.pick(['❄️', '✨', '❄️', '💎']), A.x, A.y);
      b.body.style.fontSize = rnd(18, 30) + 'px';
      gsap.set(b.body, { opacity: 0 });
      wait(i * 0.04).then(() => { gsap.set(b.body, { opacity: 1 }); return path(b, (k) => ({ ...fn(k), r: k * sp }), 0.7, 'sine.inOut'); })
        .then(() => gsap.to(b.body, { opacity: 0, duration: 0.2, onComplete: () => b.remove() }));
    }
    await wait(0.5);
    const F = V.billboard('thrown spirit finger', '☝️', T.x, T.y);
    F.body.style.setProperty('--c', c);
    gsap.set(F.body, { y: -hT * 2 - 70, transformOrigin: '50% 100%', scale: 0 });
    MB.audio.sfx('pop');
    await gsap.to(F.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    const says = ['Nuh', 'uh', 'NUH UH!'];
    let first = true;
    for (let i = 0; i < 3; i++) {
      const s = i % 2 ? -1 : 1;
      MB.audio.sfx('swish');
      await gsap.to(F.body, { rotation: s * 28, duration: 0.14, ease: 'power2.inOut' });
      pop(V, { x: T.x + s * 110, y: T.y }, hT * 2 + 60, says[i], 'float-text baka', 0.6);
      if (first) { first = false; impact(); hit(V, t, ice); } else { flash(V, T, hT, ice, 160); MB.audio.sfx('frost'); }
      burst(V, T, ice, 8, { h: hT * 1.6, spread: 100, shape: 'shard' });
      V.shake(6);
      if (tv) gsap.fromTo(tv.figure, { x: s * 16 }, { x: 0, duration: 0.25 });
    }
    gsap.to(F.body, { rotation: 0, scale: 0, duration: 0.2, delay: 0.1, onComplete: () => F.remove() });
    await Promise.all([...'DUH!'].map((ch, i) => wait(i * 0.09).then(() => {
      const b = V.billboard('float-text ice-letter', ch, T.x + (i - 1.5) * 50, T.y);
      gsap.set(b.body, { y: -hT - 380 });
      return gsap.to(b.body, { y: -hT * 0.8, duration: 0.25, ease: 'power3.in' }).then(() => {
        MB.audio.sfx('shatter'); V.shake(8);
        burst(V, T, ice, 6, { h: hT, spread: 90, shape: 'shard' });
        gsap.to(b.body, { scale: 1.6, opacity: 0, duration: 0.2, onComplete: () => b.remove() });
      });
    })));
    decal(V, T, 'frost', ice, 0.8);
    if (tv) gsap.fromTo(tv.img, { filter: 'drop-shadow(0 0 12px #bff4ff) brightness(1.4) saturate(0.4)' }, { filter: 'drop-shadow(0 0 0px #bff4ff) brightness(1) saturate(1)', duration: 1, clearProps: 'filter' });
    MB.audio.sfx('swish');
    await gsap.to(v.figure, { rotationY: '+=360', duration: 0.35, ease: 'power2.inOut' }); // a hair flip
    gsap.set(v.figure, { rotationY: 0 });
    pop(V, T, hT + 120, own(a, 'finish', 'Like, DUH!'), 'float-text baka', 1.1);
    gsap.to(nails.body, { scale: 0, duration: 0.2, onComplete: () => nails.remove() });
    await wait(0.4);
  };

  // Rhiannon: folds her hands and prays. A stained-glass window assembles itself over the target (the leading drawn
  // in, then the panes light up), the bell tolls, and colored light pours through it. The glass comes down after
  const GLASS = ['#e8283c', '#3a6ee8', '#ffcc33', '#3fbf6a', '#a64de8', '#ff8a2a'];
  function stainedGlassSvg() {
    const arch = 'M10,255 V90 A70,70 0 0 1 150,90 V255 Z', cx = 80, cy = 88, r = 38;
    const pt = (i) => { const an = (i / 6) * Math.PI * 2 - Math.PI / 2; return `${(cx + Math.cos(an) * r).toFixed(1)},${(cy + Math.sin(an) * r).toFixed(1)}`; };
    const rose = GLASS.map((g, i) => `<path class="pane" fill="${g}" d="M${cx},${cy} L${pt(i)} A${r},${r} 0 0 1 ${pt(i + 1)} Z"/>`).join('');
    const panes = [[10, 130, '#3a6ee8'], [80, 130, '#e8283c'], [10, 192, '#ffcc33'], [80, 192, '#3fbf6a']]
      .map(([x, y, g]) => `<rect class="pane" x="${x}" y="${y}" width="70" height="${y === 130 ? 62 : 63}" fill="${g}"/>`).join('');
    const spokes = GLASS.map((_, i) => `M${cx},${cy} L${pt(i)}`).join(' ');
    return `<svg viewBox="0 0 160 260" width="160" height="260"><path class="pane" d="${arch}" fill="#6a3aa8"/>${panes}${rose}
      <g fill="none" stroke="#2a1a10" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path class="d" d="${arch}"/>
      <circle class="d" cx="${cx}" cy="${cy}" r="${r}"/><path class="d" d="${spokes}"/><path class="d" d="M10,130 H150 M10,192 H150 M80,130 V255"/></g></svg>`;
  }
  S.stainedglass = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), top = hT * 2 + 170;
    await glowUp(v, c, -20);
    pop(V, A, H + 40, '🙏', 'thrown', 1.4);
    pop(V, A, H + 95, own(a, 'cry', 'Lord, forgive them~'), 'float-text heal', 1.1);
    MB.audio.sfx('choir');
    const win = V.billboard('stained-glass', stainedGlassSvg(), T.x, T.y), panes = win.body.querySelectorAll('.pane');
    win.body.style.setProperty('--c', c);
    gsap.set(win.body, { y: -top });
    gsap.set(panes, { opacity: 0 });
    await draw(win.body.querySelectorAll('.d'), { duration: 0.5, stagger: 0.06, ease: 'power1.inOut' });
    await gsap.to(panes, { opacity: 0.92, duration: 0.12, stagger: { each: 0.04, from: 'random' } });
    MB.audio.sfx('gong');
    ring(V, A, '#ffe9a0', 1.6, 0.6);
    gsap.fromTo(win.body, { filter: 'brightness(1)' }, { filter: 'brightness(1.7)', duration: 0.2, yoyo: true, repeat: 1 });
    const beams = GLASS.slice(0, 4).map((col, i) => {
      const b = pillar(V, { x: T.x + (i - 1.5) * 28, y: T.y }, col, 'sky-beam slim glass-beam');
      b.body.style.height = top + 'px';
      gsap.fromTo(b.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.85, duration: 0.25, delay: i * 0.06 });
      return b;
    });
    await wait(0.4);
    impact(); hit(V, t, '#fff6c8', true); MB.audio.sfx('holy'); V.shake(12);
    GLASS.forEach((col, i) => gsap.delayedCall(i * 0.05, () => ring(V, T, col, 1.3 + i * 0.3, 0.6)));
    rise(V, T, '#ffffff', 12, hT * 1.6);
    await wait(0.35);
    // the glass comes down
    MB.audio.sfx('shatter');
    GLASS.forEach((col) => {
      for (let i = 0; i < 4; i++) {
        const s = dot(V, { x: T.x + rnd(-70, 70), y: T.y + rnd(-12, 12) }, top + rnd(-100, 100), col, rnd(10, 18), 'spark shard'), dur = rnd(0.6, 0.9);
        gsap.to(s.body, { y: -rnd(0, 20), rotation: rnd(-360, 360), duration: dur, ease: 'power2.in' });
        gsap.to(s.body, { opacity: 0, duration: 0.2, delay: dur, onComplete: () => s.remove() });
      }
    });
    gsap.to(win.body, { scale: 1.15, opacity: 0, duration: 0.2, onComplete: () => win.remove() });
    beams.forEach((b) => gsap.to(b.body, { scaleX: 0, opacity: 0, duration: 0.4, onComplete: () => b.remove() }));
    pop(V, T, hT + 120, own(a, 'finish', 'Bless your heart, dear.'), 'float-text heal', 1.1);
    await glowDown(v);
  };

  // Alys: somebody said "cute". She goes red, steam comes out of her ears, three stomps, and she charges into a
  // cartoon fight cloud with the target (fists, feet and stars poking out), then the grown-up uppercut
  S.tantrum = async (V, a, t, impact) => {
    const { v, A, C, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    pop(V, { x: A.x + perp.x * 110, y: A.y + perp.y * 110 }, H * 0.9, 'so cute~ ♥', 'float-text cute', 1.2);
    MB.audio.sfx('sparkle');
    await wait(0.55);
    MB.audio.sfx('whistleUp'); // the kettle
    gsap.to(v.img, { filter: 'sepia(0.7) saturate(4) hue-rotate(-30deg) brightness(0.95)', duration: 0.4 });
    const shake = gsap.fromTo(v.figure, { x: -4 }, { x: 4, duration: 0.04, yoyo: true, repeat: -1 });
    for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.12, () => [-1, 1].forEach((s) => puff(V, { x: A.x + s * 30, y: A.y }, '#ffffff', 2, H * 0.92, 0.5)));
    pop(V, A, H + 95, own(a, 'cry', "I'M NOT CUTE!!"), 'float-text burn', 1.1);
    await wait(0.45);
    shake.kill(); gsap.set(v.figure, { x: 0 });
    for (let i = 0; i < 3; i++) { // stomp, stomp, STOMP
      await gsap.timeline().to(v.figure, { y: -30, duration: 0.09, ease: 'power2.out' }).to(v.figure, { y: 0, duration: 0.08, ease: 'power3.in' });
      MB.audio.sfx('stomp'); V.shake(5 + i * 3);
      cracks(V, A, '#2b1d12', { n: 4, len: 50 + i * 25, w: 4, glow: c, hold: 0.5 });
    }
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.35, ease: 'power2.in', onUpdate: () => { ghost(V, v, c); if (Math.random() < 0.4) puff(V, here(v), '#d9ccb4', 1, 10, 0.6); } });
    // the fight cloud
    const M = { x: T.x, y: T.y + 30 }, cloud = V.billboard('brawl', '<i></i><i></i><i></i><i></i>', M.x, M.y);
    gsap.set(cloud.body, { y: -hT });
    gsap.set(v.figure, { opacity: 0 });
    MB.audio.sfx('poof');
    await gsap.from(cloud.body, { scale: 0, duration: 0.15, ease: 'back.out(2)' });
    const wob = gsap.to(cloud.body, { scale: 1.08, rotation: 4, duration: 0.09, yoyo: true, repeat: -1 });
    const pokes = ['👊', '🦶', '💢', '⭐', '💥', '👊', '🦶', '⭐', '💢', '👊'];
    let first = true;
    for (let i = 0; i < pokes.length; i++) {
      const ang = rnd(0, Math.PI * 2), b = V.billboard('thrown poke', pokes[i], M.x, M.y);
      gsap.set(b.body, { y: -hT, scale: 0.3 });
      gsap.to(b.body, { x: Math.cos(ang) * 130, y: -hT - Math.sin(ang) * 95, scale: 1, duration: 0.1, yoyo: true, repeat: 1, onComplete: () => b.remove() });
      MB.audio.sfx(MB.pick(['punch', 'bonk', 'pow', 'punch']));
      if (first) { first = false; impact(); hit(V, t, c); } else if (i % 2) burst(V, T, c, 5, { h: hT, spread: 100 });
      V.shake(5);
      if (i % 3 === 1) pop(V, { x: M.x + rnd(-120, 120), y: M.y }, hT + rnd(90, 160), MB.pick(['POW!', 'BAM!', 'WHAM!']), 'float-text burn', 0.5);
      await wait(0.1);
    }
    wob.kill();
    MB.audio.sfx('poof');
    puff(V, M, '#e8e4f0', 10, hT * 0.6, 1.4);
    gsap.to(cloud.body, { scale: 1.5, opacity: 0, duration: 0.25, onComplete: () => cloud.remove() });
    gsap.set(v.figure, { opacity: 1 });
    // the grown-up uppercut
    await gsap.to(v.figure, { y: 14, scaleY: 0.85, duration: 0.12 });
    MB.audio.sfx('whoosh');
    await gsap.to(v.figure, { y: -150, scaleY: 1.1, rotation: -sg * 10, duration: 0.18, ease: 'power3.out' });
    MB.audio.sfx('pow'); V.shake(16); V.hitStop();
    flash(V, T, hT * 1.4, '#ffffff', 300); ring(V, T, c, 2.2); burst(V, T, c, 16, { h: hT * 1.4, spread: 150, shape: 'shard' });
    if (tv) {
      gsap.timeline().to(tv.figure, { y: -140, rotation: -sg * 20, duration: 0.25, ease: 'power2.out' }).to(tv.figure, { y: 0, rotation: 0, duration: 0.45, ease: 'bounce.out' });
      gsap.delayedCall(0.7, () => dizzy(V, T, hT * 2 + 10, ['⭐', '💫'], 1.2));
    }
    await gsap.to(v.figure, { y: 0, rotation: 0, scaleY: 1, duration: 0.3, ease: 'bounce.out' });
    gsap.to(v.img, { filter: 'sepia(0) saturate(1) hue-rotate(0deg) brightness(1)', duration: 0.5, clearProps: 'filter' });
    pop(V, T, hT + 120, own(a, 'finish', "I'm a GROWN-UP!"), 'float-text burn', 1.1);
    pop(V, here(v), H + 40, 'Hmph!', 'float-text hic', 0.9);
    await wait(0.3);
    await goHome(v, A);
  };

  // Linda: a golden harp draws itself in beside her, a glissando sends a note off every string, and a fun fact
  // arrives with the chord
  const FACTS = ['Harps are older than pianos!', 'Octopi have three hearts.', 'Honey never goes bad.', 'Otters hold hands asleep.',
    'Bananas are berries.', 'Bach had twenty children.'];
  function harpSvg() {
    const q = (k) => ({ x: (1 - k) ** 2 * 20 + 2 * (1 - k) * k * 80 + k * k * 145, y: (1 - k) ** 2 * 30 + k * k * 42 });
    const neckY = (x) => { let best = q(0); for (let i = 1; i <= 60; i++) { const p = q(i / 60); if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; } return best.y; };
    const boxY = (x) => 42 + ((145 - x) * 188) / 115;
    const strings = Array.from({ length: 7 }, (_, i) => { const x = 38 + i * 15; return `<line class="s" x1="${x}" y1="${(neckY(x) + 3).toFixed(1)}" x2="${x}" y2="${(boxY(x) - 3).toFixed(1)}"/>`; }).join('');
    return `<svg viewBox="0 0 160 240" width="160" height="240" fill="none" stroke-linecap="round"><g stroke="#fff4d0" stroke-width="2">${strings}</g>
      <g stroke="#e8c060" stroke-width="9"><path class="d" d="M20,232 V30"/><path class="d" d="M20,30 Q80,0 145,42"/><path class="d" d="M145,42 L30,230"/></g></svg>`;
  }
  S.harp = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, gold = '#ffe08a';
    const P = { x: A.x + sg * 95, y: A.y + 10 }, hp = V.billboard('harp', harpSvg(), P.x, P.y);
    hp.body.style.setProperty('--c', c);
    gsap.set(hp.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    const strings = [...hp.body.querySelectorAll('.s')];
    gsap.set(strings, { opacity: 0 });
    MB.audio.sfx('sparkle');
    await draw(hp.body.querySelectorAll('.d'), { duration: 0.45, stagger: 0.08, ease: 'power1.inOut' });
    await gsap.to(strings, { opacity: 1, duration: 0.05, stagger: 0.03 });
    pop(V, A, H + 95, own(a, 'cry', 'Allow me. Ahem.'), 'float-text buff', 1.1);
    MB.audio.sfx('harp');
    let first = true;
    await Promise.all(strings.map((s, i) => wait(i * 0.08).then(() => {
      gsap.fromTo(s, { stroke: '#ffffff', strokeWidth: 5 }, { stroke: '#fff4d0', strokeWidth: 2, duration: 0.4 });
      gsap.fromTo(s, { x: 3 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.2)' });
      MB.audio.sfx(i % 3 ? 'pop' : 'ding');
      const F = { x: P.x + (i - 3) * 12, y: P.y }, TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-12, 12) }, fn = arc(F, TT, 120, hT, rnd(80, 150));
      const b = V.billboard('float-text note', MB.pick(['🎵', '🎶', '♪', '♫']), F.x, F.y);
      b.body.style.color = i % 2 ? '#ffffff' : gold;
      return path(b, (k) => ({ ...fn(k), r: Math.sin(k * 12) * 16, s: 0.8 + k * 0.4 }), 0.55, 'sine.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, gold, 4, { h: hT, spread: 60 });
      });
    })));
    // the chord, and the fact
    gsap.fromTo(strings, { stroke: '#ffffff' }, { stroke: '#fff4d0', duration: 0.5, stagger: { each: 0.03, from: 'end' } });
    MB.audio.sfx('ding'); MB.audio.sfx('sparkle'); V.shake(8);
    ring(V, T, gold, 2.4, 0.8); ring(V, T, c, 1.6, 0.6); flash(V, T, hT, gold, 300);
    const card = V.billboard('fact-card', `<b>FUN FACT</b><span>${MB.pick(FACTS)}</span>`, T.x, T.y);
    gsap.set(card.body, { y: -hT * 2 - 130, rotation: rnd(-6, 6) });
    MB.audio.sfx('cardflip');
    gsap.timeline({ onComplete: () => card.remove() })
      .fromTo(card.body, { scale: 0, rotationY: 180 }, { scale: 1, rotationY: 0, duration: 0.35, ease: 'back.out(2)' })
      .to(card.body, { opacity: 0, y: '-=40', duration: 0.3, delay: 1.3 });
    scatter(V, T, hT, ['🎵', '🎶', '📚', '🍂'], 10, 160);
    pop(V, T, hT + 120, own(a, 'finish', 'Fun fact: that hurt.'), 'float-text buff', 1.1);
    await wait(0.7);
    await gsap.to(hp.body, { scaleY: 0, opacity: 0, duration: 0.3, onComplete: () => hp.remove() });
  };

  // ---------------------------------------------------------------- signature styles: New Haven
  // one hop of a character from where it stands to P, `h` high
  function hopTo(V, v, P, h, dur) {
    const fn = arc(here(v), P, 0, 0, h), q = { k: 0 };
    return gsap.to(q, { k: 1, duration: dur, ease: 'none', onUpdate: () => { const p = fn(q.k); gsap.set(v.el, { x: p.x, y: p.y }); gsap.set(v.figure, { y: -p.h }); } });
  }
  // a pair of hoofprints pressed into the floor at P
  function hoofprints(V, P) {
    [-14, 14].forEach((dx) => {
      const f = V.flat('hoofprint', '<i></i><i></i>', P.x + dx, P.y + rnd(-6, 6));
      gsap.fromTo(f, { scale: 0.4, opacity: 0.9 }, { scale: 1, duration: 0.15 });
      gsap.to(f, { opacity: 0, duration: 0.5, delay: 1, onComplete: () => f.remove() });
    });
  }
  const squash = (tv, s = 0.6) => tv && gsap.fromTo(tv.figure, { scaleY: s, scaleX: 2 - s * 1.2 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)' });

  // Jane: an excited bleat, then she pronks across the board like a fawn in spring (stiff-legged bounces that leave
  // hoofprints), and the last bounce comes down on the target. GO TEAM!
  S.pronk = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', '*excited bleat*'), 'float-text buff', 1);
    MB.audio.sfx('squeak');
    await gsap.to(v.figure, { scaleY: 0.85, duration: 0.15 });
    gsap.set(v.figure, { scaleY: 1 });
    for (let i = 1; i <= 3; i++) {
      const P = { x: lerp(A.x, C.x, (i / 3) * 0.85), y: lerp(A.y, C.y, (i / 3) * 0.85) };
      MB.audio.sfx('boing');
      await hopTo(V, v, P, 90 + i * 30, 0.3);
      gsap.fromTo(v.figure, { scaleY: 0.82, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 0.2 });
      hoofprints(V, P); puff(V, P, '#e8d8c0', 2, 0, 0.6);
      pop(V, P, H + 30, ['Go!', 'Go!!', 'GOOO!'][i - 1], 'float-text buff', 0.5);
    }
    MB.audio.sfx('whoosh');
    await hopTo(V, v, { x: lerp(C.x, T.x, 0.4), y: lerp(C.y, T.y, 0.4) }, 230, 0.4);
    impact(); hit(V, t, c, true); MB.audio.sfx('stomp'); V.shake(14);
    hoofprints(V, T); cracks(V, T, '#5a3a1a', { n: 5, len: 90, w: 4, glow: c, hold: 0.6 });
    squash(tv);
    scatter(V, T, hT, ['📣', '💛', '🦌', '✨'], 12, 160);
    MB.audio.sfx('cheer');
    pop(V, T, hT + 120, own(a, 'finish', 'BAAAH! Go team!'), 'float-text buff', 1.1);
    await wait(0.3);
    await goHome(v, A);
  };

  // Cheetor: drops his board, grinds a rail across the board with sparks flying off the trucks, kickflips off the
  // end and lands it on the target. Gnarly
  S.kickflip = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), rh = 34;
    const R0 = { x: lerp(A.x, C.x, 0.25), y: lerp(A.y, C.y, 0.25) }, R1 = { x: lerp(A.x, C.x, 0.9), y: lerp(A.y, C.y, 0.9) };
    const rail = strip(V, R0, R1, 'grind-rail', c), board = V.billboard('thrown board', '🛹', A.x, A.y);
    const ride = () => { gsap.set(board, { x: gsap.getProperty(v.el, 'x'), y: gsap.getProperty(v.el, 'y') }); gsap.set(board.body, { y: gsap.getProperty(v.figure, 'y') - 8 }); };
    gsap.set(board.body, { y: -8, scale: 0 });
    MB.audio.sfx('thud');
    await gsap.to(board.body, { scale: 1, duration: 0.15, ease: 'back.out(3)' });
    pop(V, A, H + 95, own(a, 'cry', 'Duuude, watch this.'), 'float-text buff', 1);
    await gsap.to(v.figure, { y: -14, duration: 0.15, onUpdate: ride }); // steps on
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: R0.x, y: R0.y, duration: 0.3, ease: 'power1.in', onUpdate: () => { ghost(V, v, c); ride(); } });
    MB.audio.sfx('boing'); // ollie onto the rail
    await gsap.timeline({ onUpdate: ride }).to(v.figure, { y: -rh - 60, duration: 0.14, ease: 'power2.out' }).to(v.figure, { y: -rh - 14, duration: 0.12, ease: 'power2.in' });
    MB.audio.sfx('slide');
    await gsap.to(v.el, { x: R1.x, y: R1.y, duration: 0.5, ease: 'none', onUpdate: () => {
      ride(); ghost(V, v, c);
      const p = here(v), s = dot(V, p, rh, MB.pick(['#ffd24a', '#ff9a3c', '#ffffff']), rnd(5, 9), 'spark shard');
      gsap.to(s, { x: p.x + rnd(-50, 50), y: p.y + rnd(-10, 20), duration: 0.4 });
      gsap.to(s.body, { y: -rnd(0, 10), opacity: 0, duration: 0.4, onComplete: () => s.remove() });
    } });
    MB.audio.sfx('whoosh'); // the kickflip
    const fn = arc(R1, T, rh + 14, hT * 0.4, 150), q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 0.45, ease: 'power1.in', onUpdate: () => {
      const p = fn(q.k);
      gsap.set(v.el, { x: p.x, y: p.y }); gsap.set(v.figure, { y: -p.h }); ride();
      gsap.set(board.body, { rotationX: q.k * 720 });
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('pop'); V.shake(14);
    squash(tv, 0.7);
    scatter(V, T, hT, ['🛹', '💨', '🤙'], 10, 150);
    pop(V, T, hT + 120, own(a, 'finish', 'Gnarly, dude!'), 'float-text buff', 1.1);
    gsap.to(rail, { opacity: 0, duration: 0.4, delay: 0.2, onComplete: () => rail.remove() });
    gsap.set(board.body, { rotationX: 0 });
    await wait(0.3);
    await goHome(v, A).eventCallback('onUpdate', ride);
    gsap.to(board.body, { scale: 0, duration: 0.15, onComplete: () => board.remove() });
  };

  // Joseph: a tower of lunch trays, hopping in like the kangaroo he is. It wobbles more with every hop, he trips, and
  // the whole lunch comes down on the target. S-sorry, mate!
  S.lunchrush = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const stack = ['🍱', '🥪', '🍝', '🍮', '🧃'].map((f) => V.billboard('thrown tray-item', f, A.x, A.y));
    let sway = 0.3;
    const carry = () => {
      const x = gsap.getProperty(v.el, 'x'), y = gsap.getProperty(v.el, 'y'), fy = gsap.getProperty(v.figure, 'y'), now = performance.now();
      stack.forEach((b, i) => {
        gsap.set(b, { x, y });
        gsap.set(b.body, { y: fy - H * 0.55 - i * 34, x: sg * 30 + Math.sin(now / 110 + i * 0.5) * sway * i * 4, rotation: Math.sin(now / 130) * sway * i * 3 });
      });
    };
    carry();
    gsap.ticker.add(carry);
    stack.forEach((b, i) => gsap.fromTo(b.body, { scale: 0 }, { scale: 1, duration: 0.15, delay: i * 0.06, ease: 'back.out(3)' }));
    MB.audio.sfx('pop');
    pop(V, A, H + 200, own(a, 'cry', 'Coming through!'), 'float-text buff', 1);
    await wait(0.4);
    for (let i = 1; i <= 3; i++) {
      sway = i;
      MB.audio.sfx('boing');
      await hopTo(V, v, { x: lerp(A.x, C.x, i / 3), y: lerp(A.y, C.y, i / 3) }, 50, 0.26);
      MB.audio.sfx('tink');
    }
    sway = 5;
    MB.audio.sfx('squeak');
    pop(V, here(v), H + 60, 'W-whoa-!', 'float-text hic', 0.8);
    await wait(0.3);
    gsap.ticker.remove(carry);
    gsap.to(v.figure, { rotation: sg * 30, y: 10, duration: 0.18 }); // trips
    let first = true;
    await Promise.all(stack.map((b, i) => wait(i * 0.07).then(() => {
      const P = { x: gsap.getProperty(b, 'x') + sg * 30, y: gsap.getProperty(b, 'y') }, h0 = -gsap.getProperty(b.body, 'y'), hh = hT * rnd(0.6, 1.4);
      const TT = { x: T.x + rnd(-40, 40), y: T.y + rnd(-12, 12) }, fn = arc(P, TT, h0, hh, 100), sp = rnd(-540, 540);
      gsap.set(b.body, { x: 0 });
      return path(b, (k) => ({ ...fn(k), r: k * sp }), 0.45, 'power1.in').then(() => {
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, c, 5, { h: hh, spread: 70 });
        MB.audio.sfx(i % 2 ? 'splat' : 'bonk');
        toss(b, { v: [150, 300], dur: 0.6 });
      });
    })));
    decal(V, T, 'splat', '#e8b04a', 1); droplets(V, T, 8); V.shake(10);
    squash(tv, 0.75);
    pop(V, T, hT + 120, own(a, 'finish', 'S-sorry, mate!'), 'float-text buff', 1.1);
    await wait(0.4);
    await goHome(v, A);
  };

  // Natalie: a present drops onto the target, the ribbon ties itself round it (drawn in), it rattles... and goes off
  // in ornaments and snow. Plus a terrible Christmas pun
  const PUNS = ['Yule be sorry!', 'Snow way!', 'Oh deer!', 'Sleigh the day!', 'Freeze, please!'];
  S.present = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), gold = '#ffd24a';
    pop(V, A, H + 95, own(a, 'cry', 'I got you something!'), 'float-text buff', 1);
    MB.audio.sfx('sparkle');
    gsap.to(v.figure, { y: -20, duration: 0.12, yoyo: true, repeat: 1 });
    const box = V.billboard('present', `<svg viewBox="0 0 130 124" width="130" height="124">
      <rect x="10" y="46" width="110" height="76" rx="4" fill="${c}"/>
      <path class="d" d="M65,46 V122 M10,84 H120" stroke="${gold}" stroke-width="12" fill="none"/>
      <g class="lid"><rect x="4" y="26" width="122" height="22" rx="4" fill="${c}" stroke="#0003" stroke-width="2"/>
      <path class="d" d="M65,26 V48" stroke="${gold}" stroke-width="12" fill="none"/>
      <path class="d" d="M65,26 C40,2 28,22 65,26 C102,2 90,22 65,26" stroke="${gold}" stroke-width="7" fill="none" stroke-linecap="round"/></g></svg>`, T.x, T.y + 20);
    const strokes = box.body.querySelectorAll('.d'), lid = box.body.querySelector('.lid');
    gsap.set(strokes, { opacity: 0 });
    gsap.set(box.body, { yPercent: -100, y: -420, transformOrigin: '50% 100%' });
    MB.audio.sfx('whistleDown');
    await gsap.to(box.body, { y: 12, duration: 0.4, ease: EASE.drop });
    MB.audio.sfx('thud'); V.shake(6);
    gsap.fromTo(box.body, { scaleY: 0.8, scaleX: 1.15 }, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1,0.4)' });
    MB.audio.sfx('stretch');
    gsap.set(strokes, { opacity: 1 });
    await draw(strokes, { duration: 0.3, stagger: 0.1 });
    MB.audio.sfx('ding');
    pop(V, T, hT * 2 + 40, 'Joyeux Noël!', 'float-text buff', 0.9);
    await gsap.fromTo(box.body, { rotation: -5 }, { rotation: 5, duration: 0.07, yoyo: true, repeat: 7 }); // it rattles
    gsap.set(box.body, { rotation: 0 });
    gsap.to(lid, { y: -160, rotation: 40, opacity: 0, duration: 0.5, ease: 'power2.out', transformOrigin: '50% 50%' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('pop'); V.shake(16);
    scatter(V, T, hT, ['🎄', '🔔', '⭐', '❄️', '🍬', '🎁'], 18, 200);
    burst(V, T, '#ffffff', 16, { h: hT, spread: 180 }); // snow
    ring(V, T, gold, 2.2, 0.6);
    gsap.to(box.body, { scaleY: 0, opacity: 0, duration: 0.3, delay: 0.25, onComplete: () => box.remove() });
    pop(V, T, hT + 120, own(a, 'finish', MB.pick(PUNS)), 'float-text buff', 1.1);
    await wait(0.4);
  };

  // Quinta: goes live. The overlay pops up with the viewer count climbing, chat floods in, a donation asks for a flip,
  // and she delivers: blinks in, flips, claws, while the emotes rain down on the target
  const CHAT = ['POG', 'KEKW', 'nya~', 'W', 'CLIP IT', '+1 sub', 'LMAO', 'GG'];
  S.livestream = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const ov = V.billboard('stream-overlay', '<b>● LIVE</b><span>👁 <i>12</i></span>', A.x, A.y), views = ov.body.querySelector('i');
    ov.body.style.setProperty('--c', c);
    gsap.set(ov.body, { y: -H - 50, scale: 0 });
    MB.audio.sfx('ding');
    await gsap.to(ov.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    const vc = { n: 12 }, count = gsap.to(vc, { n: 9900, duration: 2.2, ease: 'power2.in', onUpdate: () => { views.textContent = vc.n >= 1000 ? (vc.n / 1000).toFixed(1) + 'K' : Math.round(vc.n); } });
    CHAT.slice().sort(() => Math.random() - 0.5).slice(0, 6).forEach((m, i) => gsap.delayedCall(i * 0.1, () => {
      const b = V.billboard('chat-msg', m, A.x + rnd(-150, 150), A.y + rnd(-10, 10));
      b.body.style.setProperty('--c', MB.pick(RAINBOW));
      gsap.set(b.body, { y: -H * rnd(0.3, 1) });
      MB.audio.sfx('tink');
      gsap.to(b.body, { y: '-=110', opacity: 0, duration: 1.3, ease: 'power1.in', onComplete: () => b.remove() });
    }));
    await wait(0.7);
    const don = V.billboard('donation', '💸 $5 — <b>do a flip!</b>', A.x, A.y);
    gsap.set(don.body, { y: -H - 110, scale: 0 });
    MB.audio.sfx('coin');
    gsap.timeline({ onComplete: () => don.remove() }).to(don.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' }).to(don.body, { opacity: 0, y: '-=30', duration: 0.3, delay: 0.8 });
    pop(V, A, H + 95, own(a, 'cry', 'Chat, watch this!'), 'float-text baka', 1);
    await wait(0.5);
    const F = { x: T.x - d.x * 100, y: T.y - d.y * 100 };
    MB.audio.sfx('blink');
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
    gsap.set(v.el, F);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.08 });
    for (let i = 0; i < 3; i++) {
      if (i === 1) { // the flip
        MB.audio.sfx('whoosh');
        await gsap.timeline().to(v.figure, { rotation: sg * 360, y: -70, duration: 0.25, ease: 'power1.inOut' }).to(v.figure, { y: 0, duration: 0.1 });
        gsap.set(v.figure, { rotation: 0 });
      }
      MB.audio.sfx('swish');
      slashArc(V, T, -hT, c, [-30, 30, 90][i]);
      await wait(0.06);
      if (!i) { impact(); hit(V, t, c); } else { flash(V, T, hT, '#ffffff', 170); burst(V, T, c, 8, { h: hT, spread: 90 }); }
      V.shake(6);
      await wait(0.12);
    }
    for (let i = 0; i < 12; i++) { // the emotes
      const e = V.billboard('petal', MB.pick(['❤️', '😹', '👑', '💎', '🐾']), T.x + rnd(-110, 110), T.y + rnd(-30, 30));
      gsap.set(e.body, { y: -hT * 2 - rnd(80, 220) });
      gsap.to(e.body, { y: -rnd(0, 20), rotation: rnd(-180, 180), duration: rnd(0.5, 0.8), delay: i * 0.03, ease: 'power2.in',
        onComplete: () => gsap.to(e.body, { opacity: 0, duration: 0.2, onComplete: () => e.remove() }) });
    }
    count.kill(); views.textContent = '9.9K';
    pop(V, T, hT + 120, own(a, 'finish', 'Nya~ GG!'), 'float-text baka', 1.1);
    await wait(0.4);
    gsap.to(ov.body, { scale: 0, duration: 0.2, onComplete: () => ov.remove() });
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.1 });
    gsap.set(v.el, A);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.12 });
  };

  // Juliana: gloves on, ding ding! She bounces in on her tail like a proper roo, jab, jab, jab, then leans back on the
  // tail and kicks with both feet. Mind your manners, love
  S.boxingroo = async (V, a, t, impact) => {
    const { v, A, C, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    MB.audio.sfx('ding'); gsap.delayedCall(0.2, () => MB.audio.sfx('ding'));
    pop(V, A, H + 95, own(a, 'cry', 'Ding ding, love!'), 'float-text buff', 1);
    const gloves = [0, 1].map(() => { const g = V.billboard('thrown glove', '🥊', A.x, A.y); g.body.style.setProperty('--c', c); return g; });
    const st = [{ r: 0 }, { r: 0 }], hold = () => {
      const x = gsap.getProperty(v.el, 'x'), y = gsap.getProperty(v.el, 'y'), fy = gsap.getProperty(v.figure, 'y');
      gloves.forEach((g, i) => {
        const s = i ? 1 : -1;
        gsap.set(g, { x: x + perp.x * s * 40 + d.x * st[i].r, y: y + perp.y * s * 40 + d.y * st[i].r });
        gsap.set(g.body, { y: fy - H * 0.55 });
      });
    };
    hold();
    gsap.ticker.add(hold);
    gloves.forEach((g) => gsap.fromTo(g.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' }));
    for (let i = 1; i <= 3; i++) { MB.audio.sfx('boing'); await hopTo(V, v, { x: lerp(A.x, C.x, i / 3), y: lerp(A.y, C.y, i / 3) }, 45, 0.24); }
    let first = true;
    for (const i of [0, 1, 0]) { // jab, jab, jab
      MB.audio.sfx('punch');
      await gsap.to(st[i], { r: 70, duration: 0.07, ease: 'power3.in' });
      if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, T, hT, '#ffffff', 160); burst(V, T, c, 8, { h: hT, spread: 80 }); }
      if (tv) gsap.fromTo(tv.figure, { x: sg * 14 }, { x: 0, duration: 0.2 });
      V.shake(5);
      await gsap.to(st[i], { r: 0, duration: 0.1 });
    }
    pop(V, here(v), H + 50, 'Tail up...', 'float-text hic', 0.6);
    await gsap.to(v.figure, { rotation: -sg * 22, y: -20, duration: 0.2, ease: 'power2.out' }); // leans back on the tail
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: T.x - d.x * 40, y: T.y - d.y * 40, duration: 0.1, ease: 'power3.in' });
    MB.audio.sfx('kick'); MB.audio.sfx('pow'); V.shake(18); V.hitStop();
    flash(V, T, hT, '#ffffff', 320); ring(V, T, c, 2.4); burst(V, T, c, 16, { h: hT, spread: 160, shape: 'shard' });
    pop(V, T, hT + 60, 'ROO KICK!', 'float-text burn', 0.8);
    if (tv) gsap.timeline().to(tv.el, { x: T.x + d.x * 90, y: T.y + d.y * 90, duration: 0.18, ease: 'power2.out' }).to(tv.el, { x: T.x, y: T.y, duration: 0.45, ease: 'power2.inOut' });
    pop(V, T, hT + 120, own(a, 'finish', 'Mind your manners, love!'), 'float-text buff', 1.1);
    await gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.25 });
    gsap.ticker.remove(hold);
    gloves.forEach((g) => gsap.to(g.body, { scale: 0, duration: 0.2, onComplete: () => g.remove() }));
    await goHome(v, A);
  };

  // Asuka: a haiku, written in the air over the target one line at a time (5, 7, 5). Then every word tears off the
  // paper and dives at the target like a shuriken. Data acquired.
  const HAIKUS = [['Data is acquired.', 'Your error bars are too wide.', 'Now so is your pain.'],
    ['Paper tastes like ink.', 'I have chewed on your report.', 'It was not tasty.'],
    ['Goat eyes see all things.', 'Your stance is inefficient.', 'Correction follows.']];
  S.haiku = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), poem = MB.pick(HAIKUS), top = hT * 2 + 150;
    pop(V, A, H + 95, own(a, 'cry', '...A haiku.'), 'float-text debuff', 1);
    const sheet = V.billboard('haiku', poem.map((l) => `<p>${l}</p>`).join(''), T.x, T.y), lines = [...sheet.body.querySelectorAll('p')];
    gsap.set(sheet.body, { y: -top });
    gsap.set(lines, { clipPath: 'inset(0 100% 0 0)' });
    MB.audio.sfx('crinkle');
    await gsap.fromTo(sheet.body, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: 'back.out(2)' });
    for (const l of lines) { MB.audio.sfx('swish'); await gsap.to(l, { clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'steps(12)' }); }
    await wait(0.3);
    const words = poem.join(' ').split(/\s+/);
    let first = true;
    gsap.to(sheet.body, { opacity: 0, duration: 0.2 });
    await Promise.all(words.map((w, i) => wait(i * 0.05).then(() => {
      const F = { x: T.x + rnd(-120, 120), y: T.y }, h0 = top + rnd(-50, 50), hh = hT * rnd(0.6, 1.4), sp = rnd(360, 900) * MB.pick([-1, 1]);
      const TT = { x: T.x + rnd(-30, 30), y: T.y + rnd(-10, 10) }, b = V.billboard('paper-word', w, F.x, F.y);
      gsap.set(b.body, { y: -h0 });
      return path(b, (k) => ({ x: lerp(F.x, TT.x, k), y: lerp(F.y, TT.y, k), h: lerp(h0, hh, k), r: k * sp, s: 1 - k * 0.4 }), 0.35, 'power2.in').then(() => {
        b.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else if (i % 2) { burst(V, TT, '#ffffff', 4, { h: hh, spread: 60, shape: 'shard' }); MB.audio.sfx('swish'); }
      });
    })));
    sheet.remove();
    V.shake(8); ring(V, T, c, 2);
    pop(V, T, hT + 120, own(a, 'finish', '...Data acquired.'), 'float-text debuff', 1.1);
    await wait(0.3);
  };

  // Saria: snaps her fingers, a spotlight finds the target, and the biggest "L" in history lands on it. The squad
  // spells it out. LOSER!
  S.bigl = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), word = (a.card.attack.shout || 'LOSER!').toUpperCase();
    MB.audio.sfx('pop');
    pop(V, A, H + 40, '🫰', 'thrown', 0.8);
    pop(V, A, H + 95, own(a, 'cry', 'Hey, everyone! LOOK!'), 'float-text buff', 1);
    const spot = pillar(V, T, '#fff6c8', 'sky-beam spot');
    MB.audio.sfx('thud');
    await gsap.fromTo(spot.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.8, duration: 0.3 });
    if (tv) gsap.to(tv.figure, { scale: 0.92, duration: 0.3 }); // shrinks under the light
    await wait(0.35);
    const L = V.billboard('float-text giant-l', 'L', T.x, T.y);
    L.body.style.color = c;
    gsap.set(L.body, { y: -hT - 460, rotation: -15 });
    MB.audio.sfx('whistleDown');
    await gsap.to(L.body, { y: -hT * 0.7, rotation: 0, duration: 0.35, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('laugh'); V.shake(20); V.hitStop();
    cracks(V, T, '#2b1d12', { n: 8, len: 150, w: 5, glow: c, hold: 0.9 });
    if (tv) gsap.fromTo(tv.figure, { scaleY: 0.55, scaleX: 1.3 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)' });
    gsap.to(L.body, { opacity: 0, scale: 1.4, duration: 0.3, delay: 0.5, onComplete: () => L.remove() });
    [...word].forEach((ch, i) => gsap.delayedCall(0.1 + i * 0.07, () => { MB.audio.sfx('pop'); pop(V, { x: T.x + (i - word.length / 2) * 38, y: T.y }, hT * 2 + 60, ch, 'float-text buff', 0.7); }));
    gsap.to(spot.body, { scaleX: 0, opacity: 0, duration: 0.3, delay: 0.6, onComplete: () => spot.remove() });
    pop(V, T, hT + 120, own(a, 'finish', 'Ha! Loser~'), 'float-text buff', 1.1);
    await wait(0.7);
  };

  // Aria: the flashlight sweeps the board and locks on, the alarm goes red, caution tape wraps the target, and she
  // brings it down. Access denied
  S.lockdown = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const L0 = { x: A.x + d.x * 30, y: A.y + d.y * 30 }, ang = (Math.atan2(d.y, d.x) * 180) / Math.PI, beam = V.flat('flashlight', '', L0.x, L0.y);
    beam.style.width = dirOf(L0, T).len + 70 + 'px';
    gsap.set(beam, { xPercent: 0, transformOrigin: '0% 50%', rotation: ang - 30, opacity: 0 });
    MB.audio.sfx('click');
    await gsap.to(beam, { opacity: 1, duration: 0.15 });
    await gsap.to(beam, { rotation: ang + 14, duration: 0.45, ease: 'sine.inOut' });
    await gsap.to(beam, { rotation: ang, duration: 0.2, ease: 'power2.out' });
    MB.audio.sfx('scope');
    pop(V, A, H + 95, own(a, 'cry', 'HALT!'), 'float-text shield', 1);
    const siren = V.billboard('thrown', '🚨', A.x, A.y);
    siren.body.style.fontSize = '44px';
    gsap.set(siren.body, { y: -H - 40 });
    gsap.to(siren.body, { rotationY: 1080, duration: 0.9, ease: 'none' });
    [0, 1, 2].forEach((i) => gsap.delayedCall(i * 0.25, () => { flash(V, T, hT, '#ff2a2a', 300); MB.audio.sfx('zap'); }));
    const tapes = [0.4, 1, 1.6].map((f, i) => {
      const b = V.billboard('caution-tape', 'DO NOT CROSS · DO NOT CROSS', T.x, T.y + 10);
      gsap.set(b.body, { y: -hT * f, rotation: [-12, 8, -4][i], clipPath: 'inset(0 100% 0 0)' });
      return b;
    });
    MB.audio.sfx('stretch');
    await Promise.all(tapes.map((b, i) => gsap.to(b.body, { clipPath: 'inset(0 0% 0 0)', duration: 0.25, delay: i * 0.12 })));
    gsap.to(beam, { opacity: 0, duration: 0.3, onComplete: () => beam.remove() });
    await gsap.timeline().to(v.el, { x: C.x, y: C.y, duration: 0.4, ease: 'power1.inOut' })
      .to(v.figure, { y: -150, duration: 0.2, ease: 'power2.out' }, 0).to(v.figure, { y: 0, duration: 0.2, ease: 'power3.in' }, 0.2);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    cracks(V, T, '#2b1d12', { n: 7, len: 140, w: 5, glow: c, hold: 0.8 });
    squash(tv);
    tapes.forEach((b) => gsap.to(b.body, { scaleX: 0.3, opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => b.remove() }));
    gsap.to(siren.body, { scale: 0, duration: 0.2, delay: 0.3, onComplete: () => siren.remove() });
    pop(V, T, hT + 120, own(a, 'finish', 'Access denied.'), 'float-text shield', 1.1);
    await wait(0.3);
    await goHome(v, A);
  };

  // Marija: the performance review. A clipboard, a red X in every box, a big red F, and then the clipboard itself,
  // thrown like a frisbee. REJECTED.
  S.evaluation = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), mark = (a.card.attack.mark || 'REJECTED').toUpperCase();
    const X = '<svg viewBox="0 0 20 20" width="20" height="20"><path class="d" d="M3,3 L17,17 M17,3 L3,17"/></svg>';
    const rows = ['Punctuality', 'Teamwork', 'Lab safety', 'Attitude'].map((r) => `<p>${r}<span>${X}</span></p>`).join('');
    const cb = V.billboard('clipboard', `<i></i><b>REVIEW</b>${rows}<div class="grade">F<svg viewBox="0 0 60 50" width="60" height="50"><ellipse class="d" cx="30" cy="25" rx="27" ry="21"/></svg></div>`, A.x, A.y);
    const grade = cb.body.querySelector('.grade'), marks = [...cb.body.querySelectorAll('p svg')];
    cb.body.style.setProperty('--c', c);
    gsap.set(cb.body, { y: -H - 120, scale: 0 });
    gsap.set([...marks, grade], { opacity: 0 });
    MB.audio.sfx('crinkle');
    await gsap.to(cb.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    for (const x of marks) { gsap.set(x, { opacity: 1 }); MB.audio.sfx('swish'); await draw(x.querySelectorAll('.d'), { duration: 0.14 }); await wait(0.06); }
    gsap.set(grade, { opacity: 1 });
    MB.audio.sfx('debuff');
    gsap.fromTo(grade, { scale: 2.5 }, { scale: 1, duration: 0.2, ease: 'power3.in' });
    await draw(grade.querySelectorAll('.d'), { duration: 0.3 });
    await wait(0.25);
    MB.audio.sfx('whoosh'); // frisbee
    gsap.to(v.figure, { rotation: -8, duration: 0.1, yoyo: true, repeat: 1 });
    const fn = arc(A, T, H + 120, hT, 60);
    await path(cb, (k) => ({ ...fn(k), r: k * 720, s: 1 - k * 0.3 }), 0.45, 'power1.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); MB.audio.sfx('slam'); V.shake(14);
    debris(V, T, '#ffffff', 6, { h: hT, spread: 170, chars: ['📄', '📋', '📄'] });
    squash(tv, 0.7);
    toss(cb, { v: [300, 500], dur: 0.7, spin: 360 });
    pop(V, T, hT * 2 + 30, mark, 'float-text verdict', 1.3);
    pop(V, T, hT + 120, own(a, 'finish', 'See me in my office.'), 'float-text burn', 1.1);
    await wait(0.4);
  };

  // John: "obviously it's quantum". A whiteboard of equations, a rift over the target that spits lightning at it...
  // and then the whole experiment backfires in his face. He meant to do that
  S.rift = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, words = [].concat(a.card.attack.words || ['Quantum!', 'Flux!']);
    const wb = V.billboard('whiteboard', ['E = mc²', 'ψ(x,t) = ???', 'Σ flux ÷ 0', '∴ QUANTUM'].map((e) => `<p>${e}</p>`).join(''), A.x - sg * 120, A.y - 20);
    const lines = [...wb.body.querySelectorAll('p')];
    gsap.set(wb.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    gsap.set(lines, { clipPath: 'inset(0 100% 0 0)' });
    MB.audio.sfx('thud');
    await gsap.fromTo(wb.body, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: 'back.out(2)' });
    for (const l of lines) { MB.audio.sfx('swish'); await gsap.to(l, { clipPath: 'inset(0 0% 0 0)', duration: 0.22, ease: 'steps(8)' }); }
    words.slice(0, 4).forEach((w, i) => gsap.delayedCall(i * 0.1, () => pop(V, { x: A.x + rnd(-90, 90), y: A.y }, H + rnd(20, 90), w, 'float-text shield', 0.8)));
    await wait(0.3);
    const close = portal(V, { x: T.x, y: T.y - 30 }, c, hT * 2 + 60);
    await wait(0.4);
    let first = true;
    for (let i = 0; i < 3; i++) {
      const b = V.billboard('bolt', lightningSvg(hT * 2, '#9fd0ff'), T.x + rnd(-40, 40), T.y);
      gsap.set(b.body, { yPercent: -100, y: -hT * 0.2 });
      await draw(b.body.querySelectorAll('.d'), { duration: 0.06 });
      MB.audio.sfx('zap');
      if (first) { first = false; impact(); hit(V, t, c, true); } else flash(V, T, hT, '#9fd0ff', 200);
      V.shake(8);
      gsap.to(b.body, { opacity: 0, duration: 0.15, delay: 0.05, onComplete: () => b.remove() });
      await wait(0.12);
    }
    close();
    await wait(0.2);
    MB.audio.sfx('boom'); // ...and it backfires
    flash(V, A, H * 0.6, '#ffb347', 260); puff(V, A, '#3a3a40', 8, H * 0.5, 1.1);
    gsap.fromTo(v.img, { filter: 'brightness(0.25) saturate(0.2)' }, { filter: 'brightness(1) saturate(1)', duration: 1.2, delay: 0.4, clearProps: 'filter' });
    gsap.fromTo(v.figure, { rotation: -sg * 10 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    pop(V, A, H + 60, '*cough*', 'float-text hic', 0.9);
    pop(V, T, hT + 120, own(a, 'finish', 'I... meant to do that.'), 'float-text shield', 1.1);
    await wait(0.5);
    await gsap.to(wb.body, { scaleY: 0, duration: 0.2, onComplete: () => wb.remove() });
  };

  // Louis: flair bartending. Three bottles juggled over his head, the cocktail set alight, and one long breath of
  // blue fire across the board. Santé!
  S.flambe = async (V, a, t, impact) => {
    const { A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, blue = '#6fb8ff';
    const bottles = ['🍾', '🥃', '🍸'].map((e) => V.billboard('thrown bottle', e, A.x, A.y)), q = { a: 0 };
    MB.audio.sfx('whoosh');
    [0.37, 0.74].forEach((s) => gsap.delayedCall(s, () => MB.audio.sfx('tink')));
    await gsap.to(q, { a: Math.PI * 4, duration: 1.1, ease: 'none', onUpdate: () => bottles.forEach((b, i) => {
      const ang = q.a + (i / 3) * Math.PI * 2;
      gsap.set(b, { x: A.x + Math.cos(ang) * 55, y: A.y });
      gsap.set(b.body, { y: -H - 30 - Math.sin(ang) * 60, rotation: (ang * 180) / Math.PI });
    }) });
    bottles.slice(0, 2).forEach((b) => gsap.to(b.body, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => b.remove() }));
    const glass = bottles[2], G = { x: A.x + sg * 40, y: A.y };
    gsap.set(glass, G);
    await gsap.to(glass.body, { y: -H * 0.62, rotation: 0, duration: 0.2 });
    pop(V, A, H + 95, own(a, 'cry', 'Santé!'), 'float-text buff', 1);
    MB.audio.sfx('fire');
    const flame = V.billboard('blue-flame', '', G.x, G.y);
    gsap.set(flame.body, { y: -H * 0.62 - 44 });
    gsap.fromTo(flame.body, { scale: 0 }, { scale: 1, duration: 0.2 });
    const flicker = gsap.to(flame.body, { scaleY: 1.25, duration: 0.08, yoyo: true, repeat: -1 });
    await wait(0.4);
    MB.audio.sfx('fire'); MB.audio.sfx('wind');
    const M = { x: A.x + sg * 20, y: A.y }, h0 = H * 0.75;
    let first = true;
    await Promise.all(Array.from({ length: 26 }, (_, i) => wait(i * 0.025).then(() => {
      const TT = { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) }, fb = dot(V, M, h0, i % 3 ? blue : '#ffd24a', rnd(26, 46));
      return path(fb, (k) => ({ x: lerp(M.x, TT.x, k), y: lerp(M.y, TT.y, k), h: lerp(h0, hT, k), s: 0.6 + k * 1.2 }), 0.35, 'power1.in').then(() => {
        gsap.to(fb.body, { opacity: 0, scale: 2, duration: 0.2, onComplete: () => fb.remove() });
        if (first) { first = false; impact(); hit(V, t, blue, true); }
      });
    })));
    V.shake(12);
    for (let i = 0; i < 3; i++) {
      const f = pillar(V, { x: T.x + rnd(-45, 45), y: T.y + rnd(-10, 10) }, blue, 'pillar small');
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: rnd(0.8, 1.2), duration: 0.2, delay: i * 0.06 });
      gsap.to(f.body, { opacity: 0, scaleX: 0.2, duration: 0.35, delay: 0.4 + i * 0.06, onComplete: () => f.remove() });
    }
    pop(V, T, hT + 120, own(a, 'finish', 'On the house!'), 'float-text buff', 1.1);
    flicker.kill();
    gsap.to([flame.body, glass.body], { scale: 0, duration: 0.2, delay: 0.3, onComplete: () => { flame.remove(); glass.remove(); } });
    await wait(0.5);
  };

  // Juniper: on your marks... get set... BANG. A blur of speed lines, the finish tape snaps across the target, and
  // she's already filming the victory selfie
  S.finishline = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const tape = V.billboard('finish-tape', '<i></i><i></i>', T.x - d.x * 20, T.y - d.y * 20);
    gsap.set(tape.body, { y: -hT });
    gsap.fromTo(tape.body, { scaleX: 0 }, { scaleX: 1, duration: 0.3 });
    await gsap.to(v.figure, { scaleY: 0.8, y: 14, rotation: sg * 12, duration: 0.2 }); // in the blocks
    MB.audio.sfx('tick'); pop(V, A, H + 60, 'On your marks...', 'float-text hic', 0.7);
    await wait(0.45);
    MB.audio.sfx('tick'); pop(V, A, H + 60, 'Get set...', 'float-text hic', 0.7);
    await wait(0.45);
    MB.audio.sfx('gunshot'); pop(V, A, H + 95, 'BANG!', 'float-text burn', 0.8); flash(V, A, H, '#ffffff', 200);
    gsap.set(v.figure, { scaleY: 1, y: 0 });
    MB.audio.sfx('zip');
    let snapped = false;
    const snap = () => {
      snapped = true;
      impact(); hit(V, t, c, true); MB.audio.sfx('twang'); MB.audio.sfx('punch'); V.shake(14);
      const [l, r] = tape.body.children;
      gsap.to(l, { x: -90, rotation: -50, opacity: 0, duration: 0.5 });
      gsap.to(r, { x: 90, rotation: 50, opacity: 0, duration: 0.5, onComplete: () => tape.remove() });
      if (tv) gsap.fromTo(tv.figure, { rotation: sg * 25 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    };
    const P = { x: T.x + d.x * 90, y: T.y + d.y * 90 };
    await gsap.to(v.el, { x: P.x, y: P.y, duration: 0.3, ease: 'power2.in', onUpdate: () => {
      ghost(V, v, c);
      const p = here(v), s = dot(V, { x: p.x + rnd(-40, 40), y: p.y }, rnd(20, H), '#ffffff', rnd(4, 7), 'spark shard');
      gsap.to(s, { x: p.x - d.x * 120, y: p.y - d.y * 120, duration: 0.25 });
      gsap.to(s.body, { opacity: 0, duration: 0.25, onComplete: () => s.remove() });
      if (!snapped && dirOf(p, T).len < 60) snap();
    } });
    if (!snapped) snap();
    await gsap.to(v.figure, { rotation: 0, duration: 0.15 });
    const ph = V.billboard('thrown', '📱', P.x + sg * 34, P.y);
    ph.body.style.fontSize = '40px';
    gsap.set(ph.body, { y: -H * 0.8 });
    MB.audio.sfx('camera'); flash(V, P, H * 0.8, '#ffffff', 220);
    pop(V, P, H + 40, '✌️', 'thrown', 0.9);
    pop(V, T, hT + 120, own(a, 'finish', 'Like and subscribe!'), 'float-text buff', 1.1);
    await wait(0.45);
    ph.remove();
    await goHome(v, A);
  };

  // Doe: why fight alone when there are infinite Earths? Portals open round the target and a Doe steps out of each
  // one (another world, another color), every one blows a kiss, and then the real one does
  S.multiverse = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tints = [90, 200, 300];
    pop(V, A, H + 95, own(a, 'cry', '¡Hola, all of me!'), 'float-text baka', 1);
    const spots = [{ x: T.x - 200, y: T.y + 30 }, { x: T.x + 200, y: T.y + 30 }, { x: T.x, y: T.y - 120 }];
    const closers = spots.map((P) => portal(V, P, c, H + 30));
    await wait(0.35);
    const clones = spots.map((P, i) => {
      const g = V.billboard('ghost clone', v.img.tagName === 'IMG' ? `<img src="${v.img.src}">` : v.img.outerHTML, P.x, P.y);
      g.body.style.setProperty('--c', c);
      g.body.style.height = v.stand.style.height;
      gsap.set(g.body, { yPercent: -100, y: 0, filter: `hue-rotate(${tints[i]}deg)` });
      gsap.fromTo(g.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3, delay: i * 0.12, ease: 'back.out(2)' });
      return g;
    });
    await wait(0.6);
    let first = true;
    await Promise.all(spots.map((P, i) => wait(i * 0.15).then(() => {
      MB.audio.sfx('kiss');
      const k = V.billboard('thrown', '💋', P.x, P.y), fn = arc(P, T, H * 0.8, hT, 60);
      k.body.style.fontSize = '48px';
      return path(k, (q) => ({ ...fn(q), s: 1 + q * 0.6 }), 0.4, 'sine.in').then(() => {
        k.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, T, hT, c, 180); burst(V, T, c, 8, { h: hT, spread: 90 }); }
        scatter(V, T, hT, ['💖', '💋'], 3, 90);
      });
    })));
    MB.audio.sfx('kiss');
    const big = V.billboard('thrown big', '💋', A.x, A.y), fb = arc(A, T, H * 0.8, hT, 120);
    await path(big, (q) => ({ ...fb(q), s: 1 + q }), 0.45, 'power1.in');
    big.remove();
    flash(V, T, hT, '#ffffff', 360); ring(V, T, c, 2.6); V.shake(12); MB.audio.sfx('pop');
    scatter(V, T, hT, ['💖', '💋', '🧪'], 12, 170);
    pop(V, T, hT + 120, own(a, 'finish', 'Class dismissed~'), 'float-text baka', 1.1);
    clones.forEach((g, i) => gsap.to(g.body, { scaleX: 0, opacity: 0, duration: 0.25, delay: i * 0.08, onComplete: () => g.remove() }));
    await wait(0.35);
    closers.forEach((close) => close());
    await wait(0.35);
  };

  // Bucky: roll for initiative! A giant d20 tumbles across the board, rolling every number on the way... and stops on
  // a NAT 20. Critical hit: a fireball, straight out of the campaign. Then a happy bleat
  function d20Svg(c) {
    return `<svg viewBox="0 0 120 120" width="110" height="110"><polygon points="60,4 108,32 108,88 60,116 12,88 12,32" fill="${c}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="60,30 88,78 32,78" fill="#ffffff22" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
      <path d="M60,4 L60,30 M108,32 L88,78 M108,88 L88,78 M60,116 L88,78 M60,116 L32,78 M12,88 L32,78 M12,32 L32,78 M12,32 L60,30 M108,32 L60,30" stroke="#fff" stroke-width="2" opacity=".7"/>
      <text x="60" y="68" text-anchor="middle" font-size="24" font-weight="900" fill="#fff" font-family="Segoe UI, sans-serif">1</text></svg>`;
  }
  S.nat20 = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), H = V.heightOf(a);
    MB.audio.sfx('ding');
    pop(V, A, H + 30, '🛎️', 'thrown', 0.7);
    pop(V, A, H + 95, own(a, 'cry', 'Roll for initiative!'), 'float-text buff', 1);
    const die = V.billboard('d20', d20Svg('#7a3cff'), A.x, A.y), num = die.body.querySelector('text');
    gsap.set(die.body, { y: -H * 0.6, scale: 0 });
    await gsap.to(die.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    await gsap.to(v.figure, { rotation: -6, duration: 0.12, yoyo: true, repeat: 1 }); // the throw
    MB.audio.sfx('deal');
    const end = { x: lerp(C.x, T.x, 0.5), y: lerp(C.y, T.y, 0.5) };
    const pts = [A, ...[1, 2].map((i) => ({ x: lerp(A.x, end.x, i / 3) + rnd(-40, 40), y: lerp(A.y, end.y, i / 3) + rnd(-15, 15) })), end];
    for (let i = 0; i < 3; i++) {
      const fn = arc(pts[i], pts[i + 1], i ? 55 : H * 0.6, 55, 150 - i * 40), r0 = gsap.getProperty(die.body, 'rotation');
      await path(die, (k) => ({ ...fn(k), r: r0 + k * 300 }), 0.3, 'none', () => { if (Math.random() < 0.3) num.textContent = 1 + Math.floor(Math.random() * 19); });
      MB.audio.sfx('tink'); burst(V, pts[i + 1], '#ffffff', 4, { h: 10, spread: 50 });
    }
    const r = gsap.getProperty(die.body, 'rotation');
    await gsap.to(die.body, { rotation: Math.round(r / 360) * 360, duration: 0.4, ease: 'elastic.out(1,0.35)' });
    num.textContent = '20'; num.setAttribute('fill', '#ffe066');
    die.body.classList.add('crit');
    MB.audio.sfx('fanfare');
    pop(V, end, 200, 'NAT 20!', 'float-text buff', 1.1);
    await gsap.fromTo(die.body, { scale: 1.5 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    await wait(0.15);
    MB.audio.sfx('whoosh'); // critical hit: fireball
    const fb = dot(V, A, H * 0.7, '#ff7a1c', 90, 'fireball'), ff = arc(A, T, H * 0.7, hT, 160);
    await path(fb, (k) => ({ ...ff(k), s: 0.6 + k * 0.8 }), 0.45, 'power1.in', (p) => {
      const tr = dot(V, p, p.h, '#ffb347', rnd(12, 22)); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => tr.remove() });
    });
    fb.remove();
    impact(); hit(V, t, '#ff7a1c', true); MB.audio.sfx('boom'); MB.audio.sfx('fire'); V.shake(20); V.hitStop();
    flameBurst(V, T, hT); ring(V, T, '#ffe066', 2.6, 0.8); debris(V, T, '#ffb347', 12, { spread: 190 });
    pop(V, T, hT * 2 + 60, 'CRITICAL HIT!', 'float-text burn', 1);
    pop(V, T, hT + 120, own(a, 'finish', 'Nat 20, baby!'), 'float-text buff', 1.1);
    MB.audio.sfx('squeak');
    pop(V, A, H + 50, '*happy bleat*', 'float-text hic', 0.9);
    gsap.to(die.body, { scale: 0, rotation: '+=180', duration: 0.3, delay: 0.4, onComplete: () => die.remove() });
    await wait(0.6);
  };

  // Delphine: she once touched a tear in space-time and lost a world. This time she stabilises it: a crack rips open
  // in the air over the target and pulls the light in, she holds it with trembling hands... and snaps it shut
  S.tear = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = hT + 40;
    await glowUp(v, c, -10);
    pop(V, A, H + 95, own(a, 'cry', 'P-please hold still...'), 'float-text debuff', 1.1);
    let jag = 'M40,0';
    for (let y = 20; y < 260; y += 20) jag += ` L${(40 + rnd(-14, 14)).toFixed(1)},${y}`;
    const tear = V.billboard('rift-tear', `<svg viewBox="0 0 80 260" width="80" height="260"><path class="lens" d="M40,0 Q84,130 40,260 Q-4,130 40,0 Z"/>
      <path class="d" d="${jag} L40,260"/></svg>`, T.x, T.y - 20), lens = tear.body.querySelector('.lens');
    tear.body.style.setProperty('--c', c);
    gsap.set(tear.body, { y: -top });
    gsap.set(lens, { scaleX: 0.05, transformOrigin: '50% 50%' });
    MB.audio.sfx('glitch');
    await draw(tear.body.querySelectorAll('.d'), { duration: 0.35, ease: 'power2.in' });
    MB.audio.sfx('vortex');
    gsap.to(lens, { scaleX: 1, duration: 0.5, ease: 'power2.out' });
    for (let i = 0; i < 20; i++) { // light pulled into it
      const P = { x: T.x + rnd(-220, 220), y: T.y + rnd(-60, 60) }, s = dot(V, P, rnd(0, hT * 2.5), MB.pick([c, '#ffffff', '#ffd27a']), rnd(5, 10), 'spark shard');
      gsap.to(s, { x: T.x, y: T.y - 20, duration: 0.6, delay: i * 0.03, ease: 'power2.in' });
      gsap.to(s.body, { y: -top, opacity: 0.2, duration: 0.6, delay: i * 0.03, ease: 'power2.in', onComplete: () => s.remove() });
    }
    if (tv) gsap.to(tv.figure, { y: -30, rotation: 6, duration: 0.8, ease: 'power1.in' }); // pulled toward it
    const tremble = gsap.fromTo(v.figure, { x: -2 }, { x: 2, duration: 0.05, yoyo: true, repeat: -1 });
    gsap.to(tear.body, { x: 3, duration: 0.05, yoyo: true, repeat: 13 });
    await wait(0.75);
    tremble.kill(); gsap.set(v.figure, { x: 0 });
    pop(V, A, H + 40, 'Estabilizado.', 'float-text debuff', 0.9);
    MB.audio.sfx('shatter');
    await gsap.to(lens, { scaleX: 0, duration: 0.12, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(18); V.hitStop();
    flash(V, T, top, '#ffffff', 420); ring(V, T, c, 2.8, 0.8); ring(V, T, '#ffffff', 1.8, 0.6); rise(V, T, c, 12, hT * 1.6);
    if (tv) gsap.to(tv.figure, { y: 0, rotation: 0, duration: 0.5, ease: 'bounce.out' });
    gsap.to(tear.body, { opacity: 0, scaleY: 1.3, duration: 0.3, onComplete: () => tear.remove() });
    pop(V, T, hT + 120, own(a, 'finish', 'Tear... stabilized.'), 'float-text debuff', 1.1);
    await glowDown(v);
  };

  // Andrew: once a tree surgeon, always a tree surgeon. A tree shoots up beside the target, three chops of the axe with
  // the chips flying, TIMBER!, and it comes down right on top of it
  S.timber = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const P = { x: T.x + 160, y: T.y + 25 }, tree = V.billboard('thrown tree', '🌲', P.x, P.y);
    gsap.set(tree.body, { yPercent: -100, y: 14, transformOrigin: '50% 100%' });
    MB.audio.sfx('vines'); MB.audio.sfx('grow');
    await gsap.fromTo(tree.body, { scaleY: 0, scaleX: 0.5 }, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'back.out(1.6)' });
    pop(V, A, H + 95, own(a, 'cry', 'Stand back, mija.'), 'float-text buff', 1);
    const axe = V.billboard('thrown axe-held', '🪓', A.x, A.y), carry = () => gsap.set(axe, { x: gsap.getProperty(v.el, 'x') - 40, y: gsap.getProperty(v.el, 'y') + 5 });
    gsap.set(axe.body, { y: -H * 0.5, transformOrigin: '80% 80%', rotation: 30, scale: 0 });
    carry();
    gsap.ticker.add(carry);
    gsap.to(axe.body, { scale: 1, duration: 0.2 });
    await gsap.to(v.el, { x: P.x + 80, y: P.y + 20, duration: 0.4, ease: 'power2.inOut', onUpdate: () => ghost(V, v, c) });
    for (let i = 0; i < 3; i++) {
      await gsap.to(axe.body, { rotation: 70, duration: 0.12, ease: 'power2.out' });
      await gsap.to(axe.body, { rotation: -40, duration: 0.08, ease: 'power3.in' });
      MB.audio.sfx('axe'); V.shake(5);
      debris(V, { x: P.x + 10, y: P.y }, '#c9a06a', 5, { h: 40, spread: 90 });
      if (i === 2) debris(V, { x: P.x + 10, y: P.y }, '#c9a06a', 3, { h: 40, spread: 90, chars: ['🪵'] });
      gsap.fromTo(tree.body, { x: -6 }, { x: 0, duration: 0.3, ease: 'elastic.out(1,0.3)' });
      scatter(V, P, 200, ['🍃'], 3, 80);
      await wait(0.08);
    }
    MB.audio.sfx('stretch'); // the creak
    pop(V, P, 300, 'TIMBER!', 'float-text burn', 1);
    await gsap.to(tree.body, { rotation: -12, duration: 0.35, ease: 'power1.in' });
    await gsap.to(tree.body, { rotation: -88, duration: 0.35, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(24); V.hitStop();
    cracks(V, T, '#2b1d12', { n: 8, len: 170, w: 6, glow: c, hold: 0.9 }); puff(V, T, '#d9ccb4', 8, 20, 1.2);
    scatter(V, T, hT, ['🍃', '🌿', '🪵'], 14, 200);
    squash(tv, 0.5);
    gsap.to(tree.body, { opacity: 0, duration: 0.4, delay: 0.5, onComplete: () => tree.remove() });
    pop(V, T, hT + 120, own(a, 'finish', '¡Listo!'), 'float-text burn', 1.1);
    await wait(0.4);
    gsap.ticker.remove(carry);
    gsap.to(axe.body, { scale: 0, duration: 0.15, onComplete: () => axe.remove() });
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- more duo styles
  // the partners split round the target and strike from both sides at once, cutting an X
  S.crossfire = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), em = a.card.attack.emoji;
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Now!'), 'float-text buff', 0.8);
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.el, { x: T.x, y: T.y + 30, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) })
      .to(L, { x: -170, duration: 0.3, ease: 'power2.out' }, 0.15).to(R, { x: 170, duration: 0.3, ease: 'power2.out' }, 0.15);
    for (let i = 0; i < 2; i++) {
      await gsap.timeline().to(L, { x: -50, rotation: 12, duration: 0.1, ease: 'power3.in' }, 0).to(R, { x: 50, rotation: -12, duration: 0.1, ease: 'power3.in' }, 0);
      [45, -45].forEach((rot) => {
        slashArc(V, T, -hT, c, rot);
      });
      if (em) pop(V, T, hT + 30, em, 'thrown');
      if (!i) { impact(); hit(V, t, c, true); } else { flash(V, T, hT, '#ffffff', 260); burst(V, T, c, 14, { h: hT, spread: 110 }); }
      V.shake(10); MB.audio.sfx('slam');
      await gsap.timeline().to(L, { x: -170, rotation: 0, duration: 0.18 }, 0).to(R, { x: 170, rotation: 0, duration: 0.18 }, 0);
    }
    pop(V, T, hT + 120, own(a, 'finish', 'CROSSFIRE!'), 'float-text baka', 1);
    await gsap.to([L, R], { x: 0, duration: 0.2 });
    resetDuo(v);
    await goHome(v, A);
  };

  // one partner hurls the other at the target like a cannonball and catches them on the way back
  S.launch = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), em = a.card.attack.emoji || '✨';
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Ready? THROW!'), 'float-text buff', 0.9);
    await Promise.all([gsap.to(R, { scaleY: 0.85, duration: 0.2 }), gsap.to(L, { y: -40, x: 20, rotation: -12, duration: 0.2 })]);
    MB.audio.sfx('whoosh'); MB.audio.sfx('boing');
    gsap.to(R, { scaleY: 1.08, rotation: -10, duration: 0.12, yoyo: true, repeat: 1 });
    const src = L.tagName === 'IMG' ? L.src : '', fl = V.billboard('ghost clone flyer', src ? `<img src="${src}">` : L.outerHTML, A.x, A.y);
    fl.body.style.setProperty('--c', c); fl.body.style.height = (parseFloat(L.style.height) || V.heightOf(a)) + 'px';
    gsap.set(fl.body, { yPercent: -60 });
    gsap.set(L, { opacity: 0 });
    const spin = T.x >= A.x ? 1 : -1;
    await path(fl, (k) => ({ ...arc(A, T, 60, hT * 0.4, 260)(k), r: k * 720 * spin }), 0.6, 'power1.in', (p) => {
      if (Math.random() < 0.4) { const e = V.billboard('petal', em, p.x, p.y); gsap.set(e.body, { y: -p.h, scale: rnd(0.5, 0.9) }); gsap.to(e.body, { opacity: 0, scale: 0.2, duration: 0.5, onComplete: () => e.remove() }); }
    });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    ring(V, T, c, 2.6); scatter(V, T, hT, [em, '💥', '✨'], 12, 150);
    pop(V, T, hT + 120, own(a, 'finish', 'BULLSEYE!'), 'float-text baka', 1);
    await path(fl, (k) => ({ ...arc(T, A, hT * 0.4, 60, 200)(k), r: (1 - k) * 360 * spin }), 0.55, 'power1.inOut');
    fl.remove(); gsap.set(L, { opacity: 1 });
    await gsap.to([L, R], { y: -40, duration: 0.15, yoyo: true, repeat: 1 }); // caught!
    resetDuo(v);
  };

  // hand in hand: an orb rises from each partner, they circle and merge into one (attack.emoji, or a big orb)
  // that comes down on the target
  S.sync = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a) * 0.6, em = a.card.attack.emoji, top = H + 140;
    await gsap.to([L, R], { x: (i) => (i ? -14 : 14), duration: 0.25 });
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Together!'), 'float-text buff', 0.9);
    const orbs = [c, '#ffffff'].map((col, i) => dot(V, { x: A.x + (i ? 60 : -60), y: A.y }, H, col, 44, 'charge'));
    MB.audio.sfx('sparkle');
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 0.9, ease: 'power1.inOut', onUpdate: () => orbs.forEach((o, i) => {
      const ang = q.k * Math.PI * 4 + i * Math.PI, rr = 60 * (1 - q.k), p = { x: A.x + Math.cos(ang) * rr, y: A.y + Math.sin(ang) * rr * 0.4 }, h = H + q.k * 140 - Math.sin(ang) * rr * 0.3;
      gsap.set(o, p); gsap.set(o.body, { y: -h });
      if (Math.random() < 0.4) { const tr = dot(V, p, h, i ? '#ffffff' : c, 10); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => tr.remove() }); }
    }) });
    orbs.forEach((o) => o.remove());
    const core = em ? V.billboard('thrown big', em, A.x, A.y) : dot(V, A, top, c, 90, 'charge');
    gsap.set(core.body, { y: -top });
    flash(V, A, top, '#ffffff', 320); MB.audio.sfx('fusion');
    await gsap.fromTo(core.body, { scale: 0.3 }, { scale: 1.4, duration: 0.3, ease: 'back.out(3)' });
    MB.audio.sfx('whoosh');
    await path(core, (k) => ({ ...arc(A, T, top, hT, 80)(k), s: 1.4 + k * 0.4, r: em ? k * 360 : 0 }), 0.5, 'power2.in', (p) => {
      const tr = dot(V, p, p.h, c, rnd(14, 24)); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.5, onComplete: () => tr.remove() });
    });
    impact(); hit(V, t, c, true); flash(V, T, hT, '#ffffff', 460); V.hitStop(); V.shake(20); MB.audio.sfx('slam');
    ring(V, T, c, 3, 0.9); ring(V, T, '#ffffff', 2, 0.6); rise(V, T, c, 12, hT * 1.5);
    pop(V, T, hT + 120, own(a, 'finish', 'IN SYNC!'), 'float-text bond-name', 1.1);
    gsap.to(core.body, { scale: 2.4, opacity: 0, duration: 0.35, onComplete: () => core.remove() });
    await gsap.to([L, R], { x: 0, duration: 0.3 });
    resetDuo(v);
    await wait(0.2);
  };

  // ---------------------------------------------------------------- signature styles: Doki Doki Literature Club
  // a floor strip of wavy strokes from P to Q (ink, a tail, yarn), drawn in from P's end; `tip` is put on Q's end
  function trail(V, P, Q, cls, color, { n = 3, amp = 26, waves = 3, w = 10, tip = '' } = {}) {
    const dd = dirOf(P, Q), L0 = Math.max(60, dd.len), H0 = amp * 2 + 40;
    let paths = '';
    for (let j = 0; j < n; j++) {
      const ph = rnd(0, Math.PI * 2), a0 = amp * rnd(0.5, 1), off = (j - (n - 1) / 2) * 10;
      let d = '';
      for (let i = 0; i <= 40; i++) {
        const k = i / 40, y = H0 / 2 + off * (1 - k) + Math.sin(k * Math.PI * 2 * waves + ph) * a0 * Math.sin(Math.PI * k);
        d += `${i ? ' L' : 'M'}${(k * L0).toFixed(1)},${y.toFixed(1)}`;
      }
      paths += `<path class="d" d="${d}" stroke-width="${w - j * 2}"/>`;
    }
    const f = V.flat('trail ' + cls, `<svg viewBox="0 0 ${L0} ${H0}" width="${L0}" height="${H0}" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round">${paths}</svg>${tip ? `<b>${tip}</b>` : ''}`, (P.x + Q.x) / 2, (P.y + Q.y) / 2);
    f.style.color = color; f.style.setProperty('--c', color);
    gsap.set(f, { rotation: (Math.atan2(dd.y, dd.x) * 180) / Math.PI });
    return { f, grow: (dur = 0.5) => draw(f.querySelectorAll('.d'), { duration: dur, stagger: 0.05, ease: 'power1.inOut' }) };
  }
  // tint a victim's sprite for a moment, then give it back its own look
  const tint = (tv, filter, dur = 0.8, delay = 0) => tv && gsap.fromTo(tv.img, { filter }, { filter: 'none', duration: dur, delay, clearProps: 'filter' });
  // a file name for whatever is being hit ("maria_hunley.chr")
  const fileOf = (t) => String(t.name || (t.card && t.card.name) || (t.isLeader ? 'player' : 'target')).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.chr';

  // Monika: the club president has admin rights. The room drops away into her space classroom, a terminal opens
  // over the target and she types... del target.chr. It glitches, flickers and nearly isn't there. Just Monika.
  S.justmonika = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Just Monika.'), 'float-text heal', 1.2);
    await gsap.to(v.figure, { rotation: -4, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }); // a little head tilt
    const con = V.billboard('console', '<b>monika@club:~$</b><p>▌</p>', T.x, T.y), line = con.body.querySelector('p'), cmd = 'del ' + fileOf(t);
    con.body.style.setProperty('--c', c);
    gsap.set(con.body, { y: -hT * 2 - 30, transformOrigin: '50% 100%' });
    MB.audio.sfx('blink');
    await gsap.fromTo(con.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
    for (let i = 1; i <= cmd.length; i++) {
      line.textContent = cmd.slice(0, i) + '▌';
      if (i % 2) MB.audio.sfx('tick');
      await wait(0.03);
    }
    // it knows. It starts to come apart
    const jit = tv && gsap.to(tv.figure, { x: () => rnd(-12, 12), duration: 0.05, repeat: -1, repeatRefresh: true });
    if (tv) gsap.set(tv.img, { filter: 'drop-shadow(7px 0 0 #ff2a6d) drop-shadow(-7px 0 0 #2affd5) saturate(1.6)' });
    MB.audio.sfx('glitch');
    await wait(0.45);
    line.textContent = cmd; MB.audio.sfx('click');
    impact(); flash(V, T, hT, '#ffffff', 300); MB.audio.sfx('glitch'); MB.audio.sfx('zap'); V.shake(12); V.hitStop();
    // glitch blocks tear off it
    const cols = [c, '#ff2a6d', '#2affd5', '#ffffff', '#111111'];
    for (let i = 0; i < 26; i++) {
      const b = V.billboard('glitch-block', '', T.x + rnd(-80, 80), T.y + rnd(-20, 20));
      b.body.style.background = MB.pick(cols);
      b.body.style.width = rnd(16, 90) + 'px'; b.body.style.height = rnd(5, 22) + 'px';
      gsap.set(b.body, { y: -rnd(10, hT * 2.2) });
      gsap.to(b.body, { x: rnd(-160, 160), opacity: 0, duration: rnd(0.3, 0.8), delay: rnd(0, 0.35), ease: 'steps(4)', onComplete: () => b.remove() });
    }
    if (tv) gsap.to(tv.figure, { keyframes: [{ opacity: 0.1, duration: 0.05 }, { opacity: 1, duration: 0.05 }, { opacity: 0.2, duration: 0.07 }, { opacity: 0.9, duration: 0.05 }, { opacity: 0, duration: 0.1 }, { opacity: 1, duration: 0.2, delay: 0.25 }] });
    burst(V, T, c, 16, { h: hT, spread: 150, shape: 'shard' });
    await wait(0.35);
    line.innerHTML = '1 file deleted. <i>♥</i>';
    MB.audio.sfx('ding');
    await wait(0.55);
    if (jit) { jit.kill(); gsap.to(tv.figure, { x: 0, duration: 0.2 }); }
    if (tv) gsap.set(tv.img, { clearProps: 'filter' });
    gsap.to(con.body, { scaleY: 0, opacity: 0, duration: 0.2, onComplete: () => con.remove() });
    pop(V, T, hT + 120, own(a, 'finish', '...Just kidding~ ♥'), 'float-text heal', 1.2);
    await gsap.to(v.figure, { y: -16, duration: 0.15, yoyo: true, repeat: 1 });
  };

  // Sayori: overslept again. The alarm clock goes off over her head, toast in her mouth, she sprints for the bell,
  // trips over nothing, cannonballs into the target... and the toast lands on its head. Ehehe~
  S.toastdash = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const clock = V.billboard('thrown', '⏰', A.x, A.y);
    gsap.set(clock.body, { y: -H - 60, scale: 0 });
    await gsap.to(clock.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    MB.audio.sfx('alarm');
    gsap.fromTo(clock.body, { rotation: -20 }, { rotation: 20, duration: 0.05, repeat: 11, yoyo: true });
    pop(V, A, H + 120, 'RIIING!', 'float-text buff', 0.8);
    await gsap.to(v.figure, { y: -50, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }); // jolts awake
    gsap.to(clock.body, { scale: 0, duration: 0.2, delay: 0.2, onComplete: () => clock.remove() });
    const toast = V.billboard('thrown toast', '🍞', A.x + sg * 22, A.y);
    gsap.set(toast.body, { y: -H * 0.78, scale: 0 });
    gsap.to(toast.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    MB.audio.sfx('chomp');
    pop(V, A, H + 95, own(a, 'cry', "I'm LATE!!"), 'float-text baka', 1);
    await wait(0.25);
    const M = { x: lerp(A.x, C.x, 0.5), y: lerp(A.y, C.y, 0.5) };
    const hold = () => gsap.set(toast, { x: gsap.getProperty(v.el, 'x') + sg * 22, y: gsap.getProperty(v.el, 'y') });
    MB.audio.sfx('zip');
    const bob = gsap.fromTo(v.figure, { y: 0 }, { y: -16, duration: 0.07, yoyo: true, repeat: -1 });
    await gsap.to(v.el, { x: M.x, y: M.y, duration: 0.4, ease: 'power1.in', onUpdate: () => {
      ghost(V, v, c); hold();
      if (Math.random() < 0.3) puff(V, here(v), '#e8dccb', 1, 0, 0.5);
    } });
    bob.kill();
    // trips over absolutely nothing
    MB.audio.sfx('whistleDown');
    pop(V, M, 50, '*trip*', 'float-text hic', 0.7);
    const tf = arc(M, T, H * 0.78, hT * 2 + 16, 280);
    path(toast, (k) => ({ ...tf(k), r: k * 1080 }), 1, 'power1.inOut');
    await gsap.to(v.figure, { rotation: sg * 80, y: -30, duration: 0.14, ease: 'power2.out' });
    MB.audio.sfx('boing');
    await Promise.all([
      gsap.to(v.el, { x: C.x, y: C.y, duration: 0.42, ease: 'power1.in', onUpdate: () => ghost(V, v, c) }),
      gsap.to(v.figure, { rotation: `+=${sg * 540}`, y: 0, duration: 0.42, ease: 'none' }),
    ]);
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); MB.audio.sfx('slam'); V.shake(14);
    squash(tv, 0.55);
    scatter(V, T, hT, ['💫', '💕', '✨'], 8, 130);
    gsap.set(v.figure, { rotation: sg * 20 });
    gsap.to(v.figure, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.35)' });
    dizzy(V, here(v), H + 20, ['⭐', '💫'], 1.1);
    await wait(0.3);
    // the toast comes down on the target's head and stays there a moment
    MB.audio.sfx('pop');
    gsap.to(toast.body, { rotation: sg * 12, duration: 0.15, yoyo: true, repeat: 3 });
    pop(V, T, hT + 130, own(a, 'finish', 'Ehehe~ Oopsie!'), 'float-text baka', 1.1);
    await wait(0.6);
    gsap.to(toast.body, { y: '+=90', rotation: sg * 90, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => toast.remove() });
    await goHome(v, A);
  };

  // Natsuki: manga is literature. A comic panel slams down round the target with speed lines, she flies in with a
  // rolled-up volume of Parfait Girls for three smacks with sound effects, and a cat cupcake to the face to finish
  const MANGA_SFX = ['BAKA!!', 'DUMMY!', 'WHAM!'];
  S.mangapanel = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', "Don't call me CUTE!!"), 'float-text baka', 1.1);
    await gsap.to(v.figure, { scaleY: 0.9, y: 10, duration: 0.15 }); // stomp
    MB.audio.sfx('stomp');
    gsap.to(v.figure, { scaleY: 1, y: 0, duration: 0.3, ease: 'elastic.out(1,0.4)' });
    const panel = V.billboard('manga-panel', '<i></i>', T.x, T.y);
    panel.body.style.setProperty('--c', c);
    gsap.set(panel.body, { yPercent: -100, y: 30, transformOrigin: '50% 100%' });
    MB.audio.sfx('slam');
    await gsap.fromTo(panel.body, { scale: 2.4, opacity: 0, rotation: sg * 8 }, { scale: 1, opacity: 1, rotation: -sg * 2, duration: 0.25, ease: 'power3.in' });
    V.shake(8);
    const spin = gsap.to(panel.body.firstChild, { rotation: 8, duration: 0.08, yoyo: true, repeat: -1 }); // the speed lines flicker
    const book = V.billboard('thrown manga', '📘', A.x, A.y);
    gsap.set(book.body, { y: -H * 0.6, scale: 0 });
    gsap.to(book.body, { scale: 1, duration: 0.15 });
    MB.audio.sfx('whoosh');
    const hold = () => gsap.set(book, { x: gsap.getProperty(v.el, 'x') + sg * 50, y: gsap.getProperty(v.el, 'y') });
    await Promise.all([hopTo(V, v, C, 140, 0.4), gsap.to({}, { duration: 0.4, onUpdate: hold })]);
    hold();
    for (let i = 0; i < 3; i++) {
      await gsap.to(book.body, { rotation: -sg * 100, y: -H - 20, duration: 0.1, ease: 'power2.out' });
      await gsap.to(book.body, { rotation: sg * 40, y: -hT, duration: 0.08, ease: 'power3.in' });
      if (!i) { impact(); hit(V, t, c, true); } else { flash(V, T, hT, '#ffffff', 200); burst(V, T, c, 10, { h: hT, spread: 100 }); }
      MB.audio.sfx(i === 2 ? 'slam' : 'bonk'); V.shake(8 + i * 4);
      const s = V.billboard('manga-sfx', MANGA_SFX[i], T.x + rnd(-70, 70), T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT * 2 - 20 - i * 30, rotation: rnd(-18, 18) });
      gsap.timeline({ onComplete: () => s.remove() }).fromTo(s.body, { scale: 0.2 }, { scale: 1.2, duration: 0.14, ease: 'back.out(3)' }).to(s.body, { opacity: 0, scale: 1.4, duration: 0.3, delay: 0.4 });
      if (tv) gsap.fromTo(tv.figure, { rotation: sg * 12, x: sg * 14 }, { rotation: 0, x: 0, duration: 0.3, ease: 'elastic.out(1,0.4)' });
      await wait(0.12);
    }
    // and a cupcake, since you're here
    gsap.to(book.body, { scale: 0, duration: 0.15, onComplete: () => book.remove() });
    const cake = V.billboard('thrown', '🧁', here(v).x, here(v).y);
    gsap.set(cake.body, { y: -H * 0.6 });
    MB.audio.sfx('whoosh');
    await path(cake, (k) => ({ ...arc(here(v), T, H * 0.6, hT * 1.4, 60)(k), r: k * 360 }), 0.25, 'power1.in');
    cake.remove(); MB.audio.sfx('splat');
    decal(V, T, 'splat', '#ffb3d9', 0.8);
    for (let i = 0; i < 12; i++) { const f = dot(V, T, hT * 1.4, MB.pick(['#ffb3d9', '#ffffff', '#ff6fae']), rnd(8, 16)); toss(f, { v: [240, 480], dur: 0.7 }); }
    spin.kill();
    gsap.to(panel.body, { opacity: 0, scale: 1.2, duration: 0.3, onComplete: () => panel.remove() });
    pop(V, here(v), H + 40, '💢', 'thrown', 1);
    pop(V, T, hT + 130, own(a, 'finish', "Th-there. Happy now?!"), 'float-text baka', 1.1);
    await gsap.to(v.figure, { rotation: -sg * 6, duration: 0.2, yoyo: true, repeat: 1 }); // arms crossed, hmph
    await goHome(v, A);
  };

  // Yuri: once she opens a book she's gone. The pages turn, the lights go out, an eye opens on the page, and ink
  // crawls across the floor, climbs the target in tendrils and pulls tight. She snaps the book shut. Tea?
  S.inkbound = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const B = { x: A.x + d.x * 55, y: A.y + d.y * 55 }, book = V.billboard('thrown', '📕', B.x, B.y);
    gsap.set(book.body, { y: -H * 0.55, scale: 0 });
    await gsap.to(book.body, { scale: 1.1, duration: 0.25, ease: 'back.out(2)' });
    MB.audio.sfx('crinkle');
    MB.AttackArt.setText(book.body, '📖');
    for (let i = 0; i < 3; i++) { MB.audio.sfx('swish'); await gsap.fromTo(book.body, { rotationY: 0 }, { rotationY: 180, duration: 0.12 }); gsap.set(book.body, { rotationY: 0 }); }
    pop(V, A, H + 95, own(a, 'cry', '...Isn\'t it beautiful?'), 'float-text debuff', 1.2);
    const eye = V.billboard('thrown eye', '👁️', B.x, B.y);
    eye.body.style.setProperty('--c', c);
    gsap.set(eye.body, { y: -H * 0.55 - 70 });
    MB.audio.sfx('dark');
    await gsap.fromTo(eye.body, { scaleY: 0, scaleX: 1.2 }, { scaleY: 1, scaleX: 1, duration: 0.35, ease: 'power2.out' });
    // ink runs across the floor
    const ink = trail(V, B, T, 'ink', '#2a0f3f', { n: 3, amp: 34, waves: 2.5, w: 14 });
    MB.audio.sfx('vines');
    await ink.grow(0.55);
    // tendrils climb the target
    const tendrils = [0, 1, 2, 3, 4].map((i) => {
      const ang = (i / 5) * Math.PI * 2, P = { x: T.x + Math.cos(ang) * 70, y: T.y + Math.sin(ang) * 26 };
      const tt = V.billboard('ink-tendril', `<svg viewBox="0 0 60 ${hT * 2.4}" width="60" height="${hT * 2.4}"><path class="d" d="M30,${hT * 2.4} C${rnd(0, 20)},${hT * 1.8} ${rnd(40, 60)},${hT * 1.2} 30,${hT * 0.7} S${rnd(0, 20)},${hT * 0.2} ${rnd(20, 40)},4"/></svg>`, P.x, P.y);
      tt.body.style.setProperty('--c', c);
      gsap.set(tt.body, { yPercent: -100, y: 10, transformOrigin: '50% 100%', rotation: -Math.cos(ang) * 14 });
      draw(tt.body.querySelectorAll('.d'), { duration: 0.35, delay: i * 0.06, ease: 'power2.out' });
      return { tt, P };
    });
    await wait(0.6);
    // ...and pull tight
    MB.audio.sfx('stretch');
    await Promise.all(tendrils.map(({ tt, P }) => gsap.to(tt, { x: lerp(P.x, T.x, 0.6), y: lerp(P.y, T.y, 0.6), duration: 0.2, ease: 'power3.in' })));
    impact(); hit(V, t, c, true); MB.audio.sfx('chomp'); V.shake(12); V.hitStop();
    tint(tv, 'brightness(0.4) sepia(1) hue-rotate(230deg) saturate(3)', 1);
    if (tv) gsap.fromTo(tv.figure, { scaleX: 0.72 }, { scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    decal(V, T, 'dark', '#2a0f3f', 0.9);
    for (let i = 0; i < 10; i++) { const s = dot(V, T, hT, '#3a1560', rnd(10, 18), 'spark'); toss(s, { v: [260, 520], dur: 0.8 }); }
    await wait(0.3);
    // SNAP
    book.body.textContent = '📕';
    MB.audio.sfx('thud');
    gsap.fromTo(book.body, { scaleX: 1.4 }, { scaleX: 1, duration: 0.2 });
    gsap.to(eye.body, { scaleY: 0, duration: 0.1, onComplete: () => eye.remove() });
    tendrils.forEach(({ tt }) => gsap.to(tt.body, { scaleY: 0, opacity: 0, duration: 0.25, onComplete: () => tt.remove() }));
    gsap.to(ink.f, { opacity: 0, duration: 0.4, onComplete: () => ink.f.remove() });
    await wait(0.3);
    MB.AttackArt.setText(book.body, '🍵');
    MB.audio.sfx('pop');
    pop(V, T, hT + 120, own(a, 'finish', 'Ah... where was I?'), 'float-text debuff', 1.2);
    await wait(0.5);
    gsap.to(book.body, { scale: 0, duration: 0.2, onComplete: () => book.remove() });
  };

  // the Protagonist: it's a visual novel, so a choice box pops up. The cursor hovers, hesitates, and picks one
  // (punch it, write a poem, throw his manga), and he does exactly that. Was it the right choice?
  const CHOICES = ['Punch it', 'Write it a poem', 'Throw my manga'];
  S.choice = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const box = V.billboard('vn-choice', `<p>What should I do?</p>${CHOICES.map((o) => `<i>${o}</i>`).join('')}`, A.x, A.y);
    box.body.style.setProperty('--c', c);
    gsap.set(box.body, { y: -H - 110 });
    MB.audio.sfx('pop');
    await gsap.fromTo(box.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
    const opts = [...box.body.querySelectorAll('i')], pick = Math.floor(Math.random() * 3);
    const hops = [0, 1, 2, 1, 0, 1, 2].slice(0, 4 + pick);
    for (const i of hops.concat(pick)) { opts.forEach((o, j) => o.classList.toggle('on', j === i)); MB.audio.sfx('hover'); await wait(0.14); }
    MB.audio.sfx('click');
    gsap.fromTo(opts[pick], { scale: 1.15 }, { scale: 1, duration: 0.25 });
    await wait(0.25);
    gsap.to(box.body, { scale: 0, opacity: 0, duration: 0.2, onComplete: () => box.remove() });
    pop(V, A, H + 95, own(a, 'cry', CHOICES[pick] + '!'), 'float-text buff', 0.9);
    if (pick === 0) { // a very ordinary punch
      MB.audio.sfx('whoosh');
      await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) });
      await gsap.to(v.figure, { rotation: sg * 14, x: sg * 20, duration: 0.08 });
      impact(); hit(V, t, c, true); MB.audio.sfx('punch'); V.shake(12);
      pop(V, T, hT + 60, '👊', 'thrown', 0.8);
      await gsap.to(v.figure, { rotation: 0, x: 0, duration: 0.2 });
    } else if (pick === 1) { // a paper plane with a poem on it
      const plane = V.billboard('thrown', '✈️', A.x, A.y), fn = arc(A, T, H * 0.6, hT, 160, 90, { x: -d.y, y: d.x });
      plane.body.style.fontSize = '48px';
      MB.audio.sfx('whoosh');
      await path(plane, along(fn, 45), 0.7, 'sine.inOut');
      plane.remove();
      impact(); hit(V, t, c); MB.audio.sfx('crinkle'); V.shake(6);
      const poem = V.billboard('paper-word', 'Roses are red...', T.x, T.y);
      gsap.set(poem.body, { y: -hT * 2 - 30 });
      gsap.timeline({ onComplete: () => poem.remove() }).fromTo(poem.body, { scale: 0 }, { scale: 1.2, duration: 0.2, ease: 'back.out(3)' }).to(poem.body, { opacity: 0, delay: 0.8, duration: 0.3 });
      scatter(V, T, hT, ['📝', '💌', '✨'], 8, 120);
    } else { // his manga, spinning like a boomerang
      const bk = V.billboard('thrown', '📗', A.x, A.y), out = arc(A, T, H * 0.6, hT, 90), back = arc(T, A, hT, H * 0.6, 90);
      MB.audio.sfx('whoosh');
      await path(bk, (k) => ({ ...out(k), r: k * 900 }), 0.4, 'power1.in');
      impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); V.shake(10);
      await path(bk, (k) => ({ ...back(k), r: 900 + k * 900 }), 0.45, 'power1.out');
      bk.remove(); MB.audio.sfx('pop');
    }
    pop(V, T, hT + 120, own(a, 'finish', '...Was that the right choice?'), 'float-text hic', 1.3);
    await wait(0.3);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- signature styles: Flaming, Lust, and Pain.
  const starPts = (cx, cy, r) => [0, 1, 2, 3, 4].map((i) => { const ang = -Math.PI / 2 + (i * 4 * Math.PI) / 5; return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]; });
  function pentagramSvg(size) {
    const pts = starPts(150, 150, 128).map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<svg viewBox="0 0 300 300" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round">
      <circle class="d" cx="150" cy="150" r="140"/><polygon class="d" points="${pts}"/></svg>`;
  }
  // Ignis: crossed arms, a glare, and a pentagram burns itself into the floor under whatever annoyed her. Its
  // five points catch fire one by one, then the whole star goes up. She never uncrosses her arms
  S.pentagram = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), size = 300;
    gsap.to(v.figure, { rotation: -3, scaleY: 1.04, duration: 0.25 });
    pop(V, A, H + 95, own(a, 'cry', 'Hmph. Burn, sinner.'), 'float-text burn', 1.1);
    const eyes = [-12, 12].map((dx) => { const e = dot(V, { x: A.x + dx, y: A.y }, H * 0.86, '#ff2a1a', 16, 'charge'); gsap.fromTo(e.body, { scale: 0 }, { scale: 1, duration: 0.15 }); return e; });
    MB.audio.sfx('dark');
    await wait(0.35);
    eyes.forEach((e) => gsap.to(e.body, { opacity: 0, duration: 0.2, onComplete: () => e.remove() }));
    const star = V.flat('pentagram', pentagramSvg(size), T.x, T.y);
    star.style.color = c; star.style.setProperty('--c', c);
    MB.audio.sfx('rune');
    await draw(star.querySelectorAll('.d'), { duration: 0.6, stagger: 0.15, ease: 'power1.inOut' });
    const spin = gsap.to(star, { rotation: '+=40', duration: 3, ease: 'none' });
    // the points light up, one flame at a time
    const pts = starPts(0, 0, (128 / 300) * size);
    for (let i = 0; i < 5; i++) {
      const rot = (gsap.getProperty(star, 'rotation') * Math.PI) / 180, [px, py] = pts[(i * 3) % 5];
      const P = { x: T.x + px * Math.cos(rot) - py * Math.sin(rot), y: T.y + (px * Math.sin(rot) + py * Math.cos(rot)) * 0.95 };
      flameBurst(V, P, 120); MB.audio.sfx('fire');
      await wait(0.1);
    }
    star.classList.add('lit');
    await wait(0.15);
    // the whole star goes up
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleY: 0, scaleX: 1.6 }, { scaleY: 1.3, duration: 0.2, ease: 'power2.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('burn'); V.shake(20); V.hitStop();
    tint(tv, 'brightness(0.5) sepia(1) saturate(4) hue-rotate(-20deg)', 0.9, 0.1);
    cracks(V, T, '#2a0600', { n: 10, len: 170, w: 6, glow: '#ff7a1c', hold: 1 });
    rise(V, T, '#ffb347', 18, hT * 2);
    for (let i = 0; i < 3; i++) flameBurst(V, { x: T.x + rnd(-80, 80), y: T.y + rnd(-30, 30) }, 140);
    gsap.to(col.body, { opacity: 0, scaleX: 0.2, duration: 0.4, delay: 0.35, onComplete: () => col.remove() });
    gsap.to(star, { opacity: 0, duration: 0.5, delay: 0.6, onComplete: () => { spin.kill(); star.remove(); } });
    pop(V, T, hT + 130, own(a, 'finish', "Don't make me repeat myself."), 'float-text burn', 1.2);
    await wait(0.4);
    await gsap.to(v.figure, { rotation: 0, scaleY: 1, duration: 0.3 });
  };

  // Luxuria: hands behind her head, a wink, a blown kiss... and her tail. It slithers across the floor, coils round
  // the target, squeezes, and gives it a little toss. She's only playing. Mostly
  S.devtail = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const sway = gsap.fromTo(v.figure, { rotation: -4 }, { rotation: 4, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    pop(V, A, H + 95, own(a, 'cry', 'Come here, cutie~'), 'float-text baka', 1.1);
    pop(V, A, H + 30, '😉', 'thrown', 0.9);
    MB.audio.sfx('kiss');
    const kiss = V.billboard('thrown', '💋', A.x, A.y);
    kiss.body.style.fontSize = '46px';
    await path(kiss, (k) => ({ ...arc(A, T, H * 0.8, hT * 1.6, 70)(k), s: 1 + k * 0.5 }), 0.5, 'sine.inOut');
    gsap.to(kiss.body, { scale: 2.4, opacity: 0, duration: 0.3, onComplete: () => kiss.remove() });
    tint(tv, 'sepia(0.4) saturate(2.4) hue-rotate(-30deg) brightness(1.1)', 0.8);
    pop(V, T, hT * 2 + 20, '💕', 'thrown', 0.8);
    // the tail
    const P0 = { x: A.x - d.x * 10, y: A.y + 10 }, tail = trail(V, P0, T, 'devil-tail', '#1a1422', { n: 1, amp: 40, waves: 2, w: 16, tip: '♥' });
    tail.f.style.setProperty('--c', c);
    MB.audio.sfx('swish');
    await tail.grow(0.45);
    const coil = V.billboard('tail-coil', `<svg viewBox="0 0 200 ${hT * 2}" width="200" height="${hT * 2}" fill="none" stroke="#1a1422" stroke-width="16" stroke-linecap="round">
      ${[0.25, 0.5, 0.75].map((k) => `<ellipse class="d" cx="100" cy="${(hT * 2 * k).toFixed(0)}" rx="${80 - k * 20}" ry="18"/>`).join('')}</svg>`, T.x, T.y);
    coil.body.style.setProperty('--c', c);
    gsap.set(coil.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    MB.audio.sfx('stretch');
    await draw(coil.body.querySelectorAll('.d'), { duration: 0.35, stagger: 0.1, ease: 'power1.inOut' });
    // squeeze
    impact(); hit(V, t, c); MB.audio.sfx('squeak'); V.shake(8);
    for (let i = 0; i < 2; i++) {
      gsap.fromTo(coil.body, { scaleX: 0.75 }, { scaleX: 1, duration: 0.25 });
      if (tv) gsap.fromTo(tv.figure, { scaleX: 0.8 }, { scaleX: 1, duration: 0.25 });
      pop(V, T, hT * 2 + 10 + i * 30, '♥', 'float-text baka', 0.5);
      MB.audio.sfx('squeak');
      await wait(0.25);
    }
    // and a toss
    MB.audio.sfx('whoosh');
    if (tv) await gsap.to(tv.figure, { y: -140, rotation: sg * 30, duration: 0.25, ease: 'power2.out' });
    gsap.to(coil.body, { opacity: 0, scaleY: 0.2, duration: 0.2, onComplete: () => coil.remove() });
    if (tv) await gsap.to(tv.figure, { y: 0, rotation: 0, duration: 0.3, ease: 'bounce.out' });
    MB.audio.sfx('slam'); V.shake(10); burst(V, T, c, 12, { h: 20, spread: 120 }); ring(V, T, c, 1.6);
    scatter(V, T, hT, ['💚', '💋', '✨'], 8, 130);
    gsap.to(tail.f, { opacity: 0, duration: 0.35, onComplete: () => tail.f.remove() });
    sway.kill();
    gsap.to(v.figure, { rotation: 0, duration: 0.2 });
    pop(V, T, hT + 120, own(a, 'finish', 'Too tight? Hehe~'), 'float-text baka', 1.1);
    await wait(0.4);
  };

  // Doloria: she kneels and prays for everyone's forgiveness, a halo over her veil. Behind her, her shadow gets up:
  // horns, a crown, the Demon Queen she used to be. It crosses the board and brings its hand down. She never looks
  S.queenshadow = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    await gsap.to(v.figure, { scaleY: 0.9, y: 8, duration: 0.3 }); // kneels
    const halo = V.billboard('queen-halo', '', A.x, A.y);
    halo.body.style.setProperty('--c', '#ffe38a');
    gsap.set(halo.body, { y: -H - 10 });
    gsap.fromTo(halo.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 });
    MB.audio.sfx('choir');
    pop(V, A, H + 95, own(a, 'cry', 'Lord, forgive them...'), 'float-text heal', 1.3);
    await wait(0.4);
    // her shadow rises behind her
    const src = v.img.tagName === 'IMG' ? v.img.src : '', S0 = { x: A.x + (d.x >= 0 ? -120 : 120), y: A.y - 70 }; // behind her, off to one side
    const sh = V.billboard('queen-shadow', `${src ? `<img src="${src}">` : v.img.outerHTML}<b>👑</b><i></i><i></i>`, S0.x, S0.y);
    sh.body.style.setProperty('--c', c);
    sh.body.style.height = parseFloat(v.stand.style.height) * 1.4 + 'px';
    gsap.set(sh.body, { yPercent: -100, y: 20, transformOrigin: '50% 100%' });
    MB.audio.sfx('dark'); MB.audio.sfx('grow');
    await gsap.fromTo(sh.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 0.92, duration: 0.6, ease: 'power2.out' });
    gsap.to(halo.body, { borderColor: c, duration: 0.3 }); // the halo flickers purple
    gsap.fromTo(sh.body.querySelectorAll('i'), { scale: 0 }, { scale: 1, duration: 0.2, stagger: 0.05, ease: 'back.out(3)' });
    pop(V, S0, H * 1.5, 'KNEEL.', 'float-text debuff', 1);
    await wait(0.35);
    // across the board
    MB.audio.sfx('whoosh');
    const G = { x: T.x - d.x * 60, y: T.y - d.y * 60 - 20 };
    await gsap.to(sh, { x: G.x, y: G.y, duration: 0.4, ease: 'power2.in' });
    await gsap.to(sh.body, { rotation: d.x >= 0 ? 14 : -14, scaleY: 1.1, duration: 0.12 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(22); V.hitStop();
    decal(V, T, 'dark', c, 1); cracks(V, T, '#12001f', { n: 9, len: 170, w: 6, glow: c, hold: 1 });
    tint(tv, 'brightness(0.3) saturate(2) hue-rotate(250deg)', 1);
    squash(tv, 0.55);
    burst(V, T, c, 20, { h: hT, spread: 160, shape: 'shard' });
    await wait(0.3);
    gsap.to(sh.body, { scaleY: 0, opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: () => sh.remove() });
    // she looks up, none the wiser
    gsap.to(halo.body, { borderColor: '#ffe38a', duration: 0.2 });
    await gsap.to(v.figure, { scaleY: 1, y: 0, duration: 0.3 });
    pop(V, A, H + 40, '?', 'float-text hic', 0.9);
    pop(V, T, hT + 120, own(a, 'finish', 'Amen! ...Did I miss something?'), 'float-text heal', 1.3);
    gsap.to(halo.body, { opacity: 0, duration: 0.3, delay: 0.5, onComplete: () => halo.remove() });
    await wait(0.5);
  };

  // ---------------------------------------------------------------- signature styles: Paradiso Suburbia
  // Hunter: a project manager on a construction site. Hard hat on, the blueprint rolls out under the target, a steel
  // I-beam comes down on a crane cable, swings a little ("easy... easy..."), the cable snaps. Measure twice!
  S.ibeam = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const hat = V.billboard('thrown hardhat', '⛑️', A.x, A.y);
    gsap.set(hat.body, { y: -H - 300 });
    await gsap.to(hat.body, { y: -H + 8, duration: 0.3, ease: 'power2.in' });
    MB.audio.sfx('bonk');
    gsap.fromTo(v.figure, { scaleY: 0.92 }, { scaleY: 1, duration: 0.3, ease: 'elastic.out(1,0.4)' });
    pop(V, A, H + 95, own(a, 'cry', 'Measure twice, hit once!'), 'float-text buff', 1.1);
    const bp = V.flat('blueprint', '<i></i>', T.x, T.y);
    MB.audio.sfx('crinkle');
    gsap.fromTo(bp, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.35, ease: 'power2.out' });
    const cones = [-1, 1].map((s) => { const k = V.billboard('thrown', '🚧', T.x + s * 150, T.y + 10); k.body.style.fontSize = '46px'; gsap.set(k.body, { y: -26 }); gsap.fromTo(k.body, { scale: 0 }, { scale: 1, duration: 0.25, delay: 0.2, ease: 'back.out(3)' }); return k; });
    // the beam comes down on its cable
    const top = Math.min(250, hT + 110), beam = V.billboard('ibeam', '<i class="cable"></i><i class="hook"></i><b></b>', T.x, T.y);
    beam.body.style.setProperty('--c', c);
    gsap.set(beam.body, { y: -top - 300, transformOrigin: '50% 0%' });
    MB.audio.sfx('whistleDown');
    await gsap.to(beam.body, { y: -top, duration: 0.6, ease: 'power2.out' });
    const swing = gsap.fromTo(beam.body, { rotation: -6 }, { rotation: 6, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    pop(V, A, H + 60, 'Easy... easy...', 'float-text hic', 1);
    await wait(0.7);
    // snap
    swing.kill();
    MB.audio.sfx('twang');
    const cable = beam.body.querySelector('.cable'), hook = beam.body.querySelector('.hook');
    gsap.to([cable, hook], { y: -260, opacity: 0, duration: 0.4, ease: 'power2.out' });
    pop(V, T, top + 20, 'SNAP!', 'float-text burn', 0.6);
    await gsap.to(beam.body, { y: -hT * 1.3, rotation: 0, duration: 0.3, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('clang'); V.shake(24); V.hitStop();
    squash(tv, 0.5);
    cracks(V, T, '#3a2a1a', { n: 9, len: 170, w: 6, glow: c, hold: 0.9 });
    debris(V, T, '#9a8a70', 12, { spread: 170 }); puff(V, T, '#d8ccb4', 8, 20, 1.2);
    await gsap.to(beam.body, { y: -hT * 1.3 - 40, rotation: 8, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
    gsap.to(beam.body, { opacity: 0, duration: 0.35, delay: 0.3, onComplete: () => beam.remove() });
    gsap.to(bp, { opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => bp.remove() });
    cones.forEach((k) => gsap.to(k.body, { scale: 0, duration: 0.2, delay: 0.5, onComplete: () => k.remove() }));
    pop(V, A, H + 40, '👍', 'thrown', 1);
    pop(V, T, hT + 130, own(a, 'finish', "Good honest work."), 'float-text buff', 1.1);
    await wait(0.4);
    gsap.to(hat.body, { y: '-=60', opacity: 0, duration: 0.3, onComplete: () => hat.remove() });
  };

  // Marie: she doesn't like to make a fuss. She knits quietly, a ball of yarn rolls over to the target and winds it
  // up into a cozy cocoon, one row at a time, then she gives the loose end a tug and it spins like a top
  S.yarn = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const K = { x: A.x + d.x * 40, y: A.y + d.y * 40 }, knit = V.billboard('thrown', '🧶', K.x, K.y);
    knit.body.style.fontSize = '48px';
    gsap.set(knit.body, { y: -H * 0.45, scale: 0 });
    await gsap.to(knit.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 95, own(a, 'cry', 'O-oh... let me help...'), 'float-text debuff', 1.2);
    for (let i = 0; i < 4; i++) { MB.audio.sfx('tick'); gsap.fromTo(knit.body, { rotation: -10 }, { rotation: 10, duration: 0.1, yoyo: true, repeat: 1 }); await wait(0.14); }
    // the ball rolls over, unwinding
    const ball = V.billboard('thrown', '🧶', K.x, K.y);
    ball.body.style.fontSize = '40px';
    gsap.set(ball.body, { y: -20 });
    const line = strip(V, K, T, 'yarn-line', c);
    MB.audio.sfx('zip');
    await gsap.to(ball, { x: T.x, y: T.y, duration: 0.45, ease: 'power1.inOut', onUpdate: () => gsap.set(ball.body, { rotation: '+=24' }) });
    ball.remove();
    // round and round
    const rows = 5, cocoon = V.billboard('yarn-wrap', `<svg viewBox="0 0 180 ${hT * 2}" width="180" height="${hT * 2}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round">
      ${Array.from({ length: rows }, (_, i) => `<path class="d" d="M20,${(hT * 2 * (i + 0.7)) / rows} Q90,${(hT * 2 * (i + 0.7)) / rows + 26} 160,${(hT * 2 * (i + 0.5)) / rows}"/>`).join('')}</svg>`, T.x, T.y);
    cocoon.body.style.setProperty('--c', c);
    gsap.set(cocoon.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    const rowEls = [...cocoon.body.querySelectorAll('.d')].reverse(); // bottom row first
    for (let i = 0; i < rows; i++) { MB.audio.sfx('swish'); await draw([rowEls[i]], { duration: 0.1 }); }
    pop(V, T, hT * 2 + 20, '🧣', 'thrown', 1);
    impact(); hit(V, t, c); MB.audio.sfx('squeak'); V.shake(6);
    await wait(0.3);
    // a gentle tug
    MB.audio.sfx('stretch');
    await gsap.to(v.figure, { rotation: d.x >= 0 ? -8 : 8, duration: 0.15, yoyo: true, repeat: 1 });
    MB.audio.sfx('whoosh');
    gsap.to(cocoon.body, { opacity: 0, scaleX: 0.3, duration: 0.4, ease: 'power2.in', onComplete: () => cocoon.remove() });
    if (tv) await gsap.to(tv.figure, { rotationY: 1080, duration: 0.8, ease: 'power2.out', onComplete: () => gsap.set(tv.figure, { rotationY: 0 }) });
    else await wait(0.8);
    if (tv) dizzy(V, T, hT * 2 + 10, ['💫', '🧶'], 1);
    burst(V, T, c, 12, { h: hT, spread: 120 });
    gsap.to(line, { opacity: 0, duration: 0.4, onComplete: () => line.remove() });
    gsap.to(knit.body, { scale: 0, duration: 0.2, delay: 0.2, onComplete: () => knit.remove() });
    pop(V, T, hT + 130, own(a, 'finish', "S-sorry! Are you warm, at least?"), 'float-text debuff', 1.3);
    await wait(0.4);
  };

  // Chris picks up strays. He whistles once and every stray cat, dog and raccoon he's ever fed comes running from
  // behind him and bowls the target over. "Good. Now go home."
  const STRAYS = ['🐈', '🐕', '🐈‍⬛', '🦝', '🐩', '🐕', '🐈'];
  S.strays = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const phone = V.billboard('thrown', '📱', A.x + sg * 30, A.y);
    phone.body.style.fontSize = '40px';
    gsap.set(phone.body, { y: -H * 0.5 });
    gsap.to(phone.body, { y: -H * 0.5 - 30, opacity: 0, duration: 0.3, delay: 0.2, onComplete: () => phone.remove() }); // pockets it
    await wait(0.3);
    MB.audio.sfx('whistle');
    pop(V, A, H + 95, own(a, 'cry', "C'mere, guys."), 'float-text burn', 1);
    await wait(0.35);
    let first = true;
    await Promise.all(STRAYS.map((em, i) => wait(i * 0.09).then(() => {
      const side = (i % 2 ? 1 : -1) * rnd(40, 110), S0 = { x: A.x - d.x * 220 + perp.x * side, y: A.y - d.y * 220 + perp.y * side };
      const P1 = { x: T.x + d.x * 180 + perp.x * side * 0.6, y: T.y + d.y * 180 + perp.y * side * 0.6 };
      const b = V.billboard('thrown stray', `<span style="display:inline-block; transform: scaleX(${-sg})">${em}</span>`, S0.x, S0.y);
      b.body.style.setProperty('--c', c);
      MB.audio.sfx(i % 3 ? 'tweet' : 'zip');
      const q = { k: 0 }, hops = 5;
      return gsap.to(q, { k: 1, duration: 0.85, ease: 'none', onUpdate: () => {
        const x = lerp(S0.x, P1.x, q.k), y = lerp(S0.y, P1.y, q.k);
        gsap.set(b, { x, y }); gsap.set(b.body, { y: -Math.abs(Math.sin(q.k * Math.PI * hops)) * 50 - 20 });
        if (Math.random() < 0.15) puff(V, { x, y }, '#d9cbb4', 1, 0, 0.4);
        if (q.k > 0.62 && !b.passed) {
          b.passed = true;
          if (first) { first = false; impact(); hit(V, t, c, true); V.shake(10); } else { burst(V, T, c, 6, { h: hT, spread: 90 }); V.shake(4); }
          MB.audio.sfx('punch');
          if (tv) gsap.fromTo(tv.figure, { rotation: (i % 2 ? 1 : -1) * 14 }, { rotation: 0, duration: 0.3 });
          pop(V, T, hT * 2 + rnd(0, 40), MB.pick(['Mrrow!', 'Woof!', 'Hsss!', '*chitter*']), 'float-text hic', 0.6);
        }
      }, onComplete: () => gsap.to(b.body, { opacity: 0, duration: 0.25, onComplete: () => b.remove() }) });
    })));
    if (tv) dizzy(V, T, hT * 2 + 10, ['🐾', '💫'], 1.1);
    scatter(V, T, hT, ['🐾', '🐾', '💨'], 10, 160);
    pop(V, A, H + 40, '🐾', 'thrown', 0.9);
    pop(V, T, hT + 130, own(a, 'finish', 'Good. Now go home.'), 'float-text burn', 1.1);
    await wait(0.5);
  };

  // Olivia: twenty push-ups a day, and a race about everything. She knocks out the last three, sprints over for a
  // high-five, doesn't get one, and gives one anyway. The target goes flying. Oops! Too hard?
  S.musclefive = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    for (let i = 18; i <= 20; i++) {
      await gsap.to(v.figure, { scaleY: 0.72, y: 14, duration: 0.14, ease: 'power2.in' });
      MB.audio.sfx('thud');
      await gsap.to(v.figure, { scaleY: 1, y: 0, duration: 0.14, ease: 'power2.out' });
      pop(V, A, H + 20 + (i - 18) * 20, i + '!', 'float-text buff', 0.6);
    }
    pop(V, A, H + 95, own(a, 'cry', 'Race you! Ready... GO!'), 'float-text buff', 1);
    MB.audio.sfx('whistle');
    await wait(0.2);
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => { ghost(V, v, c); if (Math.random() < 0.3) puff(V, here(v), '#e8dccb', 1, 0, 0.5); } });
    const hand = V.billboard('thrown big-hand', '✋', C.x, C.y);
    hand.body.style.setProperty('--c', c);
    gsap.set(hand.body, { y: -H - 30, scale: 0 });
    await gsap.to(hand.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, C, H + 110, 'Up top!', 'float-text buff', 0.9);
    await wait(0.45);
    pop(V, T, hT * 2 + 10, '...?', 'float-text hic', 0.7);
    await wait(0.25);
    // she gives it anyway
    await gsap.to(hand.body, { y: -H - 70, rotation: -30, duration: 0.12, ease: 'power2.out' });
    MB.audio.sfx('whoosh');
    await gsap.to(hand, { x: T.x, y: T.y, duration: 0.1, ease: 'power3.in' });
    gsap.set(hand.body, { y: -hT * 1.3 });
    impact(); hit(V, t, c, true); MB.audio.sfx('pow'); MB.audio.sfx('slam'); V.shake(24); V.hitStop();
    flash(V, T, hT, '#ffffff', 420);
    pop(V, T, hT * 2 + 40, 'SMACK!', 'float-text burn', 0.8);
    [0, 1, 2].forEach((i) => gsap.delayedCall(i * 0.07, () => ring(V, T, i ? c : '#ffffff', 1.6 + i * 0.7, 0.5)));
    if (tv) gsap.timeline().to(tv.el, { x: T.x + d.x * 150, y: T.y + d.y * 150, duration: 0.25, ease: 'power2.out' })
      .to(tv.figure, { rotation: 360 * (d.x >= 0 ? 1 : -1), y: -100, duration: 0.25, ease: 'power2.out' }, 0)
      .to(tv.figure, { y: 0, duration: 0.3, ease: 'bounce.out' }).set(tv.figure, { rotation: 0 })
      .to(tv.el, { x: T.x, y: T.y, duration: 0.4, ease: 'power2.inOut' });
    gsap.to(hand.body, { scale: 1.6, opacity: 0, duration: 0.3, onComplete: () => hand.remove() });
    await wait(0.6);
    pop(V, T, hT + 130, own(a, 'finish', 'Oops! Too hard? Sorry!!'), 'float-text buff', 1.2);
    await gsap.to(v.figure, { rotation: -6, duration: 0.15, yoyo: true, repeat: 3 }); // sheepish
    await goHome(v, A);
  };

  // Evelyn: the lights go out and a flashlight clicks on under her chin. She tells a scary story, and while
  // everyone's listening a ghost rises behind the target... BOO! Then she's the one apologising
  S.ghoststory = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    MB.audio.sfx('click');
    const fl = V.billboard('chin-light', '', A.x, A.y);
    gsap.set(fl.body, { y: -H * 0.62 });
    gsap.fromTo(fl.body, { opacity: 0 }, { opacity: 1, duration: 0.1 });
    gsap.to(v.img, { filter: 'brightness(1.35) contrast(1.2) drop-shadow(0 -10px 20px #fff6c8)', duration: 0.2 });
    pop(V, A, H + 95, own(a, 'cry', 'It was a dark and stormy night...'), 'float-text debuff', 1.4);
    await wait(0.5);
    // something rises behind the target
    const B = { x: T.x + d.x * 70, y: T.y + d.y * 70 - 30 }, gh = V.billboard('ghost-rise', '👻', B.x, B.y);
    gh.body.style.setProperty('--c', c);
    gsap.set(gh.body, { y: -hT, scale: 0.4, opacity: 0 });
    MB.audio.sfx('wobble');
    await gsap.to(gh.body, { y: -hT * 2.2, scale: 1.2, opacity: 0.75, duration: 1, ease: 'sine.inOut' });
    pop(V, A, H + 60, '...and it was RIGHT behind you.', 'float-text hic', 1);
    await wait(0.6);
    // BOO
    gsap.to(gh.body, { scale: 2.1, opacity: 1, y: -hT * 1.8, duration: 0.12, ease: 'back.out(3)' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('laugh'); V.shake(18); V.hitStop();
    const boo = V.billboard('float-text boo', 'BOO!', T.x, T.y);
    gsap.set(boo.body, { y: -hT * 2 - 60 });
    gsap.timeline({ onComplete: () => boo.remove() }).fromTo(boo.body, { scale: 0.2 }, { scale: 1.3, duration: 0.2, ease: 'back.out(3)' }).to(boo.body, { opacity: 0, duration: 0.4, delay: 0.5 });
    if (tv) gsap.timeline().to(tv.figure, { y: -110, duration: 0.18, ease: 'power2.out' }).to(tv.figure, { y: 0, duration: 0.35, ease: 'bounce.out' });
    if (tv) gsap.fromTo(tv.figure, { x: -8 }, { x: 8, duration: 0.04, repeat: 12, yoyo: true, onComplete: () => gsap.set(tv.figure, { x: 0 }) });
    scatter(V, T, hT, ['🦇', '🦇', '💀', '🕸️'], 10, 170);
    await wait(0.35);
    gsap.to(gh.body, { opacity: 0, y: '-=80', duration: 0.4, onComplete: () => gh.remove() });
    gsap.to(fl.body, { opacity: 0, duration: 0.2, onComplete: () => fl.remove() });
    gsap.to(v.img, { filter: 'none', duration: 0.3, clearProps: 'filter' });
    pop(V, T, hT + 130, own(a, 'finish', 'S-sorry! Was it too scary?'), 'float-text debuff', 1.2);
    await gsap.to(v.figure, { scaleY: 0.92, duration: 0.15, yoyo: true, repeat: 1 }); // shrinks a little
  };

  // Sophia: straight A's, chess club captain. A board spreads out under the target, the pieces drop into place
  // around it, the king appears over its head... and the queen slides in. Checkmate. Good game!
  const PIECES = ['♜', '♞', '♝', '♜'];
  S.checkmate = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Your move! ...Oh, wait.'), 'float-text baka', 1.1);
    const board = V.flat('chessboard', '', T.x, T.y);
    board.style.setProperty('--c', c);
    MB.audio.sfx('cardflip');
    await gsap.fromTo(board, { scale: 0, rotation: -45, opacity: 1 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(1.6)' });
    const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const pieces = spots.map(([sx, sy], i) => {
      const P = { x: T.x + sx * 110, y: T.y + sy * 50 }, p = V.billboard('chess-piece', PIECES[i], P.x, P.y);
      p.body.style.setProperty('--c', c);
      gsap.set(p.body, { yPercent: -100, y: -400, opacity: 0 });
      gsap.to(p.body, { y: 6, opacity: 1, duration: 0.3, delay: i * 0.12, ease: 'power3.in', onComplete: () => { MB.audio.sfx('tick'); puff(V, P, '#ffffff', 2, 0, 0.4); } });
      return p;
    });
    await wait(0.8);
    const king = V.billboard('chess-piece king', '♚', T.x, T.y);
    gsap.set(king.body, { yPercent: -100, y: -hT * 2 - 20 });
    MB.audio.sfx('ding');
    await gsap.fromTo(king.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    // the queen comes in from Sophia's side
    const Q0 = { x: T.x - d.x * 260, y: T.y - d.y * 260 }, queen = V.billboard('chess-piece queen', '♛', Q0.x, Q0.y);
    queen.body.style.setProperty('--c', c);
    gsap.set(queen.body, { yPercent: -100, y: 0 });
    MB.audio.sfx('whoosh');
    await gsap.fromTo(queen.body, { scale: 0 }, { scale: 1.2, duration: 0.2, ease: 'back.out(3)' });
    await gsap.to(queen, { x: T.x, y: T.y + 4, duration: 0.35, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    const word = V.billboard('float-text checkmate', 'CHECKMATE', T.x, T.y);
    word.body.style.color = c;
    gsap.set(word.body, { y: -hT * 2 - 90 });
    gsap.timeline({ onComplete: () => word.remove() }).fromTo(word.body, { scale: 0.2 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }).to(word.body, { opacity: 0, duration: 0.4, delay: 0.7 });
    // the king topples
    MB.audio.sfx('whistleDown');
    gsap.to(king.body, { rotation: d.x >= 0 ? 90 : -90, y: -hT, opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => king.remove() });
    if (tv) gsap.fromTo(tv.figure, { rotation: d.x >= 0 ? 20 : -20 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.35)' });
    await wait(0.5);
    [...pieces, queen].forEach((p) => gsap.to(p.body, { opacity: 0, y: '-=30', duration: 0.3, onComplete: () => p.remove() }));
    gsap.to(board, { opacity: 0, scale: 0.6, duration: 0.35, onComplete: () => board.remove() });
    pop(V, T, hT + 120, own(a, 'finish', 'Good game! Rematch?'), 'float-text baka', 1.1);
    await wait(0.3);
  };

  // Skritz: from the streets (of a gated community). The boombox drops a beat, he spits his hardest bars, the target
  // yawns through all of them... and then the mic drop lands on its head
  const BARS = ['Yo, I\'m from the STREETS', '...of the cul-de-sac', 'My dad? A DENTIST.', 'Skrrt skrrt!'];
  S.micdrop = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const box = V.billboard('thrown', '📻', A.x - sg * 70, A.y);
    gsap.set(box.body, { y: -30, scale: 0 });
    await gsap.to(box.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    const mic = V.billboard('thrown', '🎤', A.x + sg * 30, A.y);
    mic.body.style.fontSize = '44px';
    gsap.set(mic.body, { y: -H * 0.62 });
    pop(V, A, H + 95, own(a, 'cry', 'Yo, check it!'), 'float-text shield', 0.9);
    const beat = gsap.timeline({ repeat: -1 }).call(() => { MB.audio.sfx('thud'); gsap.fromTo(box.body, { scale: 1.25 }, { scale: 1, duration: 0.2 }); })
      .call(() => MB.audio.sfx('tick'), null, 0.2).call(() => {}, null, 0.4);
    const bop = gsap.to(v.figure, { y: -10, rotation: sg * 4, duration: 0.2, yoyo: true, repeat: -1 });
    for (let i = 0; i < BARS.length; i++) {
      const w = V.billboard('rap-bar', BARS[i], A.x, A.y);
      w.body.style.setProperty('--c', c);
      const fn = arc(A, T, H + 30, hT * 2 + 30, 60);
      path(w, (k) => ({ ...fn(k), s: 0.7 + k * 0.4, r: (i % 2 ? 1 : -1) * 6 }), 0.7, 'power1.in').then(() => {
        gsap.to(w.body, { opacity: 0, scale: 0.4, y: '+=40', duration: 0.25, onComplete: () => w.remove() }); // fizzles
        puff(V, T, '#cfd6e0', 1, hT * 2, 0.5);
      });
      await wait(0.45);
    }
    await wait(0.3);
    beat.kill(); bop.kill();
    gsap.to(v.figure, { y: 0, rotation: 0, duration: 0.15 });
    pop(V, T, hT * 2 + 30, '🥱', 'thrown', 1);
    await wait(0.4);
    // the drop
    pop(V, A, H + 60, '...', 'float-text hic', 0.6);
    MB.audio.sfx('whistleUp');
    const fall = arc({ x: A.x + sg * 30, y: A.y }, T, H * 0.62, hT * 2 + 10, 280);
    await path(mic, (k) => ({ ...fall(k), r: k * 720 * sg }), 0.7, 'power1.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); MB.audio.sfx('boom'); V.shake(18); V.hitStop();
    squash(tv, 0.6);
    if (tv) dizzy(V, T, hT * 2 + 10, ['⭐', '🎵'], 1);
    toss(mic, { v: [300, 480], ang: [-120, -60], dur: 0.7 });
    const drop = V.billboard('float-text micdrop', 'MIC DROP.', T.x, T.y);
    drop.body.style.color = c;
    gsap.set(drop.body, { y: -hT * 2 - 80 });
    gsap.timeline({ onComplete: () => drop.remove() }).fromTo(drop.body, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power3.in' }).to(drop.body, { opacity: 0, duration: 0.3, delay: 0.7 });
    pop(V, A, H + 40, '😎', 'thrown', 1);
    gsap.to(box.body, { scale: 0, duration: 0.2, delay: 0.5, onComplete: () => box.remove() });
    pop(V, T, hT + 130, own(a, 'finish', 'Straight outta suburbia.'), 'float-text shield', 1.1);
    await wait(0.5);
  };

  // Skylar: sugar first. Back-handed compliments float over, the target bristles, and she bursts into tears on
  // cue: "They're BULLYING me!" A detention slip slaps onto the target. The tears stop instantly. Byeee~
  const BACKHANDED = ["Love that you don't try!", 'So brave, wearing that!', 'You look... comfy!', "Wow, you're so... unique!"];
  S.fakecry = async (V, a, t, impact) => {
    const { v, A, T, hA, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 50, '💅', 'thrown', 0.9);
    const said = BACKHANDED.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    for (const s of said) {
      const b = V.billboard('compliment sweet', s, A.x, A.y);
      b.body.style.setProperty('--c', c);
      MB.audio.sfx('ding');
      path(b, (k) => ({ ...arc(A, T, hA + 60, hT * 2 + 40, 60)(k), s: 0.8 + k * 0.3 }), 0.8, 'sine.inOut').then(() => gsap.to(b.body, { opacity: 0, duration: 0.25, delay: 0.3, onComplete: () => b.remove() }));
      await wait(0.5);
    }
    await wait(0.4);
    pop(V, T, hT * 2 + 20, '😠', 'thrown', 0.9);
    if (tv) gsap.fromTo(tv.figure, { y: -20 }, { y: 0, duration: 0.3 });
    await wait(0.3);
    // waterworks
    pop(V, A, H + 95, own(a, 'cry', "WAAAH! They're BULLYING me!"), 'float-text shield', 1.3);
    MB.audio.sfx('splash');
    const sob = gsap.fromTo(v.figure, { x: -4 }, { x: 4, duration: 0.06, yoyo: true, repeat: 15, onComplete: () => gsap.set(v.figure, { x: 0 }) });
    for (let i = 0; i < 18; i++) {
      const s = i % 2 ? 1 : -1, dr = dot(V, { x: A.x + s * 16, y: A.y }, H * 0.86, '#9fdcff', rnd(8, 13));
      gsap.to(dr, { x: A.x + s * rnd(60, 130), y: A.y + rnd(-10, 20), duration: 0.6, delay: i * 0.03, ease: 'power1.out' });
      gsap.to(dr.body, { keyframes: [{ y: -H * 0.86 - rnd(20, 60), duration: 0.25, ease: 'power2.out' }, { y: 0, opacity: 0, duration: 0.35, ease: 'power2.in' }], delay: i * 0.03, onComplete: () => dr.remove() });
    }
    await wait(0.7);
    // the adults believe her
    MB.audio.sfx('whistle');
    const slip = V.billboard('detention-slip', '<b>DETENTION</b><span>for: bullying Skylar</span>', T.x, T.y);
    gsap.set(slip.body, { y: -hT * 2 - 380, rotation: -30 });
    await gsap.to(slip.body, { y: -hT * 1.2, rotation: 8, duration: 0.3, ease: 'power3.in' });
    impact(); hit(V, t, '#ff4d6d', true); MB.audio.sfx('slap'); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    squash(tv, 0.7);
    pop(V, T, hT * 2 + 30, 'BUSTED!', 'float-text burn', 0.8);
    sob.kill(); gsap.set(v.figure, { x: 0 });
    await wait(0.4);
    // the tears stop. just like that
    pop(V, A, H + 40, '😘', 'thrown', 1);
    MB.audio.sfx('kiss');
    gsap.to(slip.body, { opacity: 0, y: '+=40', duration: 0.3, delay: 0.3, onComplete: () => slip.remove() });
    pop(V, T, hT + 130, own(a, 'finish', 'Byeee, loser~'), 'float-text shield', 1.1);
    await gsap.to(v.figure, { rotation: 5, duration: 0.15, yoyo: true, repeat: 1 }); // hair flip
  };

  // Hime: Saitou Oil & Gas. She swipes Daddy's black card (APPROVED), a derrick punches up out of the floor under
  // the target and it strikes oil, all over the target. It's not like she wanted to hit you or anything!
  S.oilrig = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const card = V.billboard('thrown', '💳', A.x + sg * 40, A.y);
    card.body.style.fontSize = '52px';
    gsap.set(card.body, { y: -H * 0.6, scale: 0 });
    await gsap.to(card.body, { scale: 1, duration: 0.15 });
    MB.audio.sfx('swipe');
    await gsap.to(card.body, { x: sg * 60, duration: 0.2, ease: 'power2.in' });
    pop(V, A, H + 40, 'APPROVED', 'float-text heal', 0.8);
    MB.audio.sfx('coin');
    gsap.to(card.body, { opacity: 0, duration: 0.2, onComplete: () => card.remove() });
    pop(V, A, H + 95, own(a, 'cry', "Daddy's paying. Obviously."), 'float-text burn', 1.1);
    // the drill
    for (let i = 0; i < 3; i++) { MB.audio.sfx('stomp'); V.shake(5 + i * 2); await wait(0.16); }
    cracks(V, T, '#1a1208', { n: 8, len: 140, w: 5, glow: '#3a2a10', hold: 1.4 });
    const rig = V.billboard('derrick', `<svg viewBox="0 0 120 260" width="120" height="260" fill="none" stroke="#3a3f4a" stroke-width="7" stroke-linejoin="round">
      <path d="M20,258 L60,6 L100,258 M34,170 L86,170 M44,100 L76,100 M26,220 L94,220 M34,170 L76,100 M86,170 L44,100 M26,220 L86,170 M94,220 L34,170"/>
      <rect x="48" y="0" width="24" height="14" fill="${c}" stroke="none"/></svg>`, T.x + d.x * 60, T.y + d.y * 60 - 10);
    gsap.set(rig.body, { yPercent: -100, y: 10, transformOrigin: '50% 100%' });
    MB.audio.sfx('grow');
    await gsap.fromTo(rig.body, { scaleY: 0 }, { scaleY: 1, duration: 0.4, ease: 'back.out(1.6)' });
    await wait(0.15);
    // gusher
    const oil = V.billboard('oil-gusher', '<i></i>', T.x, T.y);
    gsap.set(oil.body, { yPercent: -100, y: 10, transformOrigin: '50% 100%' });
    MB.audio.sfx('boom'); MB.audio.sfx('splash');
    gsap.fromTo(oil.body, { scaleY: 0, scaleX: 0.6 }, { scaleY: 1, scaleX: 1, duration: 0.25, ease: 'power2.out' });
    impact(); hit(V, t, '#2a2016', true); V.shake(18); V.hitStop();
    tint(tv, 'brightness(0.35) contrast(1.3) sepia(0.5)', 1.2, 0.2);
    for (let i = 0; i < 22; i++) {
      const b = dot(V, { x: T.x + rnd(-30, 30), y: T.y }, hT * 2 + 150, MB.pick(['#1a1410', '#2a2016', '#3a2a18']), rnd(10, 20), 'oil-drop');
      toss(b, { v: [300, 620], ang: [-150, -30], g: 1600, dur: 1.1, spin: 0 });
    }
    decal(V, T, 'dark', '#1a1410', 1.2);
    await wait(0.45);
    // and the money
    for (let i = 0; i < 8; i++) {
      const m = V.billboard('petal', MB.pick(['💸', '💵', '💰']), T.x + rnd(-120, 120), T.y + rnd(-40, 40));
      gsap.set(m.body, { y: -hT * 2 - rnd(160, 300), fontSize: '30px' });
      gsap.to(m.body, { y: -10, rotation: rnd(-200, 200), duration: rnd(0.7, 1.1), ease: 'power1.in', onComplete: () => gsap.to(m.body, { opacity: 0, duration: 0.2, onComplete: () => m.remove() }) });
    }
    MB.audio.sfx('coin');
    gsap.to(oil.body, { scaleY: 0, opacity: 0, duration: 0.35, onComplete: () => oil.remove() });
    gsap.to(rig.body, { scaleY: 0, duration: 0.3, delay: 0.3, ease: 'back.in(2)', onComplete: () => rig.remove() });
    pop(V, A, H + 40, '💢', 'thrown', 0.9);
    pop(V, T, hT + 130, own(a, 'finish', "I-it's not like I aimed for you!"), 'float-text burn', 1.3);
    await gsap.to(v.figure, { rotation: sg * 6, duration: 0.15, yoyo: true, repeat: 1 }); // hmph, hair flip
  };

  // Reina: a ring light comes on behind her and the viewer count says 3. Unacceptable. She points the camera at
  // the target, "Chat, get 'em!", and a river of likes and hearts pours out of her phone onto it while the count
  // shoots up
  const REACTS = ['❤️', '👍', '😂', '🔥', '💜', '😍', '💯'];
  S.likestorm = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const B = { x: A.x - d.x * 20, y: A.y - d.y * 20 - 5 }, rl = V.billboard('ring-light', '', B.x, B.y);
    rl.body.style.setProperty('--c', c);
    gsap.set(rl.body, { y: -H * 0.78 });
    MB.audio.sfx('click');
    await gsap.fromTo(rl.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
    const cnt = V.billboard('stream-counter', '<b>● LIVE</b> <span>👁 3</span>', A.x, A.y);
    cnt.body.style.setProperty('--c', c);
    gsap.set(cnt.body, { y: -H - 60 });
    gsap.fromTo(cnt.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    const num = cnt.body.querySelector('span');
    pop(V, A, H + 20, '✌️', 'thrown', 0.9);
    pop(V, A, H + 110, own(a, 'cry', "Hiii chat~! Get 'em!"), 'float-text baka', 1.1);
    await wait(0.5);
    // the flood of reactions
    let first = true;
    const views = { n: 3 };
    gsap.to(views, { n: 12900, duration: 1.4, ease: 'power2.in', onUpdate: () => { num.textContent = '👁 ' + (views.n >= 1000 ? (views.n / 1000).toFixed(1) + 'K' : Math.round(views.n)); } });
    await Promise.all(Array.from({ length: 22 }, (_, i) => wait(i * 0.055).then(() => {
      const r = V.billboard('petal', MB.pick(REACTS), A.x, A.y), side = Math.sin(i * 0.9) * 50;
      r.body.style.fontSize = rnd(26, 40) + 'px';
      if (i % 3 === 0) MB.audio.sfx('pop');
      const fn = arc(A, T, H * 0.6, hT * rnd(0.6, 1.6), rnd(40, 110), side, perp);
      return path(r, (k) => ({ ...fn(k), s: 0.6 + k * 0.6 }), 0.5, 'power1.in').then(() => {
        if (first) { first = false; impact(); hit(V, t, c); } else if (i % 4 === 0) { burst(V, T, c, 5, { h: hT, spread: 70 }); V.shake(3); }
        if (tv && i % 3 === 0) gsap.fromTo(tv.figure, { rotation: rnd(-8, 8) }, { rotation: 0, duration: 0.2 });
        gsap.to(r.body, { scale: 2, opacity: 0, duration: 0.2, onComplete: () => r.remove() });
      });
    })));
    flash(V, T, hT, c, 320); MB.audio.sfx('applause'); V.shake(10);
    scatter(V, T, hT, REACTS, 12, 170);
    gsap.fromTo(cnt.body, { scale: 1.4 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
    pop(V, T, hT + 130, own(a, 'finish', '12K viewers?! ILY chat!!'), 'float-text baka', 1.2);
    await wait(0.6);
    gsap.to([rl.body, cnt.body], { scale: 0, opacity: 0, duration: 0.25, onComplete: () => { rl.remove(); cnt.remove(); } });
  };

  // Ms. Atkins: every story needs an ending. A giant quill writes one in the air over the target in her best
  // copperplate, "The End", and the full stop drops on it like a cannonball of ink
  S.quill = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), y = hT * 2 + 70;
    pop(V, A, H + 95, own(a, 'cry', 'Every story must end.'), 'float-text debuff', 1.1);
    await gsap.to(v.figure, { y: -10, duration: 0.2, yoyo: true, repeat: 1 });
    const words = V.billboard('cursive', 'The End', T.x, T.y);
    words.body.style.setProperty('--c', c);
    gsap.set(words.body, { y: -y, clipPath: 'inset(0 100% 0 0)' });
    const quill = V.billboard('thrown', '🪶', T.x - 150, T.y);
    quill.body.style.fontSize = '84px';
    gsap.set(quill.body, { y: -y - 30, rotation: -20 });
    MB.audio.sfx('crinkle');
    const scratch = gsap.timeline({ repeat: -1 }).call(() => MB.audio.sfx('tick')).call(() => {}, null, 0.12);
    await Promise.all([
      gsap.to(words.body, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'none' }),
      gsap.to(quill, { x: T.x + 150, duration: 1.1, ease: 'none' }),
      gsap.to(quill.body, { y: -y - 50, rotation: -30, duration: 0.14, yoyo: true, repeat: 7, ease: 'sine.inOut' }),
    ]);
    scratch.kill();
    // the full stop
    await gsap.to(quill.body, { y: -y + 10, rotation: 10, duration: 0.12 });
    MB.audio.sfx('pop');
    const dotB = dot(V, { x: T.x + 150, y: T.y }, y - 10, '#1a0a12', 26, 'ink-dot');
    gsap.to(quill.body, { opacity: 0, y: -y - 120, duration: 0.3, onComplete: () => quill.remove() });
    await gsap.to(dotB.body, { width: 150, height: 150, duration: 0.3, ease: 'back.out(2)' });
    await gsap.to(dotB, { x: T.x, duration: 0.2, ease: 'power2.inOut' });
    await gsap.to(dotB.body, { y: -hT, duration: 0.25, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('splat'); V.shake(18); V.hitStop();
    squash(tv, 0.55);
    decal(V, T, 'splat', '#1a0a12', 1);
    tint(tv, 'brightness(0.4) contrast(1.4)', 0.9);
    for (let i = 0; i < 12; i++) { const s = dot(V, T, hT, '#1a0a12', rnd(8, 16)); toss(s, { v: [250, 500], dur: 0.8 }); }
    gsap.to(dotB.body, { scale: 1.6, opacity: 0, duration: 0.25, onComplete: () => dotB.remove() });
    gsap.to(words.body, { opacity: 0, y: -y - 40, duration: 0.5, delay: 0.3, onComplete: () => words.remove() });
    pop(V, T, hT + 130, own(a, 'finish', 'Beautifully concluded.'), 'float-text debuff', 1.2);
    await wait(0.5);
  };

  // Mr. Reeves: history is ALIVE. He puts on the bicorne, the battle map unrolls across the board, red arrows sweep
  // round both flanks, toy soldiers march down them and the cannon fires. "Just like Austerlitz!"
  S.warmap = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const hat = V.billboard('bicorne', '<i></i>', A.x, A.y);
    gsap.set(hat.body, { y: -H - 260 });
    await gsap.to(hat.body, { y: -H + 12, duration: 0.3, ease: 'power2.in' });
    MB.audio.sfx('pop');
    pop(V, A, H + 95, own(a, 'cry', 'FLANKING MANEUVER!'), 'float-text buff', 1.1);
    // the map
    const map = strip(V, { x: A.x + d.x * 90, y: A.y + d.y * 90 }, { x: T.x + d.x * 60, y: T.y + d.y * 60 }, 'battle-map', c);
    MB.audio.sfx('crinkle');
    await wait(0.45);
    // arrows round both flanks, drawn in red
    const flank = (s) => (k) => ({ x: lerp(A.x, T.x, k) + perp.x * s * 150 * Math.sin(Math.PI * k), y: lerp(A.y, T.y, k) + perp.y * s * 150 * Math.sin(Math.PI * k) });
    const arrows = [-1, 1].map((s) => {
      const fn = flank(s), pts = Array.from({ length: 12 }, (_, i) => fn(0.12 + (i / 11) * 0.8));
      return pts.map((p, i) => {
        const dd = V.flat('map-dash', '', p.x, p.y);
        dd.style.setProperty('--c', '#c0282e');
        gsap.fromTo(dd, { scale: 0, opacity: 1 }, { scale: 1, duration: 0.1, delay: i * 0.03 });
        return dd;
      });
    }).flat();
    MB.audio.sfx('drumroll');
    await wait(0.45);
    // the troops march
    const troops = [];
    [-1, 1].forEach((s) => [0, 1, 2].forEach((j) => {
      const fn = flank(s), b = V.billboard('thrown', '💂', A.x, A.y);
      b.body.style.fontSize = '34px';
      gsap.set(b.body, { opacity: 0 });
      troops.push(wait(j * 0.16).then(() => { gsap.set(b.body, { opacity: 1 }); return path(b, (k) => { const p = fn(0.1 + k * 0.78); return { x: p.x, y: p.y, h: Math.abs(Math.sin(k * Math.PI * 6)) * 12 }; }, 0.9, 'none'); }).then(() => b));
    }));
    await wait(0.5);
    // the cannon
    const cannon = V.billboard('thrown', '💣', A.x + d.x * 50, A.y + d.y * 50);
    cannon.body.style.fontSize = '36px';
    MB.audio.sfx('boom'); puff(V, A, '#e8e0d0', 6, 40, 0.8);
    await path(cannon, (k) => ({ ...arc({ x: A.x + d.x * 50, y: A.y + d.y * 50 }, T, 40, hT, 220)(k), r: k * 540 }), 0.55, 'power1.in');
    cannon.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    flash(V, T, hT, '#ffcc66', 340); puff(V, T, '#d8d0c0', 10, hT, 1.2);
    debris(V, T, '#6b5a3a', 10, { spread: 160 });
    squash(tv, 0.6);
    const done = await Promise.all(troops);
    done.forEach((b) => { pop(V, { x: gsap.getProperty(b, 'x'), y: gsap.getProperty(b, 'y') }, 40, '⚔️', 'thrown', 0.5); gsap.to(b.body, { opacity: 0, duration: 0.3, delay: 0.2, onComplete: () => b.remove() }); });
    MB.audio.sfx('cheer');
    pop(V, T, hT + 130, own(a, 'finish', 'Just like Austerlitz!'), 'float-text buff', 1.2);
    await wait(0.4);
    arrows.forEach((dd) => gsap.to(dd, { opacity: 0, duration: 0.3, onComplete: () => dd.remove() }));
    gsap.to(map, { opacity: 0, duration: 0.4, onComplete: () => map.remove() });
    gsap.to(hat.body, { y: '-=60', opacity: 0, duration: 0.3, onComplete: () => hat.remove() });
  };

  // ---------------------------------------------------------------- duo styles for the new relationships
  // a partner of a duo leaves the pair as a stand-alone copy (they run, fly, get thrown); returns it and a restore
  function standIn(V, v, im, at, cls = 'ghost clone runner') {
    const src = im.tagName === 'IMG' ? im.src : '', fl = V.billboard(cls, src ? `<img src="${src}">` : im.outerHTML, at.x, at.y);
    fl.body.style.height = (parseFloat(im.style.height) || parseFloat(v.stand.style.height) || 180) + 'px';
    gsap.set(fl.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    gsap.set(im, { opacity: 0 });
    return { fl, back: () => { fl.remove(); gsap.set(im, { opacity: 1 }); } };
  }

  // Monika & Sayori: the club officers write a poem together, a word each. The words circle over the target like a
  // wreath, then fold into one big heart that comes down on it
  const POEM_WORDS = [['Ink', 'Reality', 'Piano', 'Dream', 'Words'], ['Sunshine', 'Hugs', 'Clouds', 'Cinnamon', 'Smiles']];
  S.poemduet = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), top = hT * 2 + 150;
    pop(V, A, H + 30, own(a, 'cry', "Let's write one together!"), 'float-text heal', 1.1);
    const words = [], q = { a: 0 };
    const orbit = gsap.to(q, { a: Math.PI * 6, duration: 4, ease: 'none', onUpdate: () => words.forEach((w) => {
      if (!w.on) return;
      const ang = q.a + w.slot;
      gsap.set(w.b, { x: T.x + Math.cos(ang) * 150, y: T.y + Math.sin(ang) * 50 });
      gsap.set(w.b.body, { y: -top - Math.sin(ang) * 30, scale: 0.9 });
    }) });
    for (let i = 0; i < 10; i++) {
      const who = i % 2, im = who ? R : L, P0 = { x: A.x + (who ? 60 : -60), y: A.y };
      gsap.fromTo(im, { y: -24 }, { y: 0, duration: 0.25, ease: 'power2.in' });
      const b = V.billboard('paper-word', POEM_WORDS[who][i >> 1], P0.x, P0.y), w = { b, slot: (i / 10) * Math.PI * 2, on: false };
      b.body.style.color = who ? '#d64f7a' : '#2e8a4e';
      words.push(w);
      MB.audio.sfx(who ? 'pop' : 'tick');
      const ang = q.a + w.slot, P1 = { x: T.x + Math.cos(ang) * 150, y: T.y + Math.sin(ang) * 50 };
      path(b, arc(P0, P1, H * 0.7, top, 120), 0.35, 'sine.out').then(() => { w.on = true; });
      await wait(0.12);
    }
    await wait(0.6);
    // they fold into a heart
    MB.audio.sfx('sparkle');
    const heart = V.billboard('thrown big', '💚', T.x, T.y);
    gsap.set(heart.body, { y: -top, scale: 0 });
    await Promise.all(words.map((w) => { w.on = false; return gsap.to(w.b, { x: T.x, y: T.y, duration: 0.3, ease: 'power2.in' }).then(() => w.b.remove()); }));
    orbit.kill();
    MB.audio.sfx('fusion');
    await gsap.to(heart.body, { scale: 1.6, duration: 0.25, ease: 'back.out(3)' });
    await gsap.to(heart.body, { y: -hT, duration: 0.25, ease: 'power3.in' });
    impact(); hit(V, t, c, true); flash(V, T, hT, '#ffffff', 380); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    ring(V, T, c, 2.4); ring(V, T, '#ff8fa8', 1.6);
    scatter(V, T, hT, ['🌸', '📝', '💚', '💗'], 14, 180);
    gsap.to(heart.body, { scale: 2.6, opacity: 0, duration: 0.3, onComplete: () => heart.remove() });
    pop(V, T, hT + 130, own(a, 'finish', 'A perfect rhyme~'), 'float-text bond-name', 1.2);
    await gsap.to([L, R], { y: -30, duration: 0.15, stagger: 0.08, yoyo: true, repeat: 1 });
    resetDuo(v);
  };

  // Sayori & her childhood friend: the first bell rings, they run for it with toast in their mouths, she trips, he
  // grabs her hand, and the two of them tumble straight through the target. SAFE!
  S.latebell = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const bell = V.billboard('thrown', '🔔', A.x, A.y);
    gsap.set(bell.body, { y: -H - 70, scale: 0 });
    await gsap.to(bell.body, { scale: 1.1, duration: 0.2, ease: 'back.out(3)' });
    MB.audio.sfx('ding'); gsap.delayedCall(0.3, () => MB.audio.sfx('ding'));
    gsap.fromTo(bell.body, { rotation: -25 }, { rotation: 25, duration: 0.1, repeat: 7, yoyo: true, onComplete: () => gsap.to(bell.body, { scale: 0, duration: 0.2, onComplete: () => bell.remove() }) });
    pop(V, A, H + 110, 'DING DONG!', 'float-text buff', 0.8);
    pop(V, A, H + 30, own(a, 'cry', 'RUN!!'), 'float-text baka', 0.9);
    const toasts = [L, R].map((im, i) => { const b = V.billboard('thrown toast', '🍞', A.x + (i ? 50 : -50), A.y); gsap.set(b.body, { y: -H * 0.72, scale: 0.8 }); return b; });
    const follow = () => { const x = gsap.getProperty(v.el, 'x'), y = gsap.getProperty(v.el, 'y'); toasts.forEach((b, i) => gsap.set(b, { x: x + (i ? 50 : -50), y })); };
    const legs = gsap.to([L, R], { y: -18, duration: 0.07, stagger: 0.035, yoyo: true, repeat: -1 });
    MB.audio.sfx('zip');
    const M = { x: lerp(A.x, C.x, 0.6), y: lerp(A.y, C.y, 0.6) };
    await gsap.to(v.el, { x: M.x, y: M.y, duration: 0.45, ease: 'power1.in', onUpdate: () => { ghost(V, v, c); follow(); if (Math.random() < 0.3) puff(V, here(v), '#e8dccb', 1, 0, 0.5); } });
    legs.kill();
    // she trips, he grabs her hand
    MB.audio.sfx('whistleDown');
    await gsap.to(L, { rotation: -sg * 50, y: 10, duration: 0.12 });
    pop(V, M, H * 0.8, 'Gotcha!', 'float-text buff', 0.7);
    await gsap.to([L, R], { x: (i) => (i ? -16 : 16), duration: 0.1 });
    toasts.forEach((b) => toss(b, { v: [300, 500], ang: [-120, -60], dur: 0.9 }));
    MB.audio.sfx('boing');
    await Promise.all([
      gsap.to(v.el, { x: C.x + d.x * 40, y: C.y + d.y * 40, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) }),
      gsap.to(v.figure, { rotation: sg * 360, duration: 0.3, ease: 'none' }),
    ]);
    gsap.set(v.figure, { rotation: 0 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('bonk'); V.shake(18); V.hitStop();
    squash(victim(V, t), 0.55);
    const safe = V.billboard('float-text safe', 'SAFE!', T.x, T.y);
    safe.body.style.color = c;
    gsap.set(safe.body, { y: -hT * 2 - 60 });
    gsap.timeline({ onComplete: () => safe.remove() }).fromTo(safe.body, { scale: 0.2 }, { scale: 1.3, duration: 0.2, ease: 'back.out(3)' }).to(safe.body, { opacity: 0, duration: 0.3, delay: 0.6 });
    scatter(V, T, hT, ['⏰', '🍞', '✨', '💕'], 10, 150);
    gsap.to([L, R], { rotation: 0, x: 0, y: 0, duration: 0.3 });
    pop(V, T, hT + 140, own(a, 'finish', 'Made it! ...Right?'), 'float-text baka', 1.1);
    await wait(0.4);
    resetDuo(v);
    await goHome(v, A);
  };

  // Ignis & Doloria: the ritual in the basement. A circle burns into the floor under the target, black candles
  // light one by one round it while Doloria prays and Ignis raises her hands, and the whole circle erupts
  S.ritualfire = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    gsap.to(R, { scaleY: 0.9, y: 10, duration: 0.3 }); // kneels
    gsap.to(L, { y: -20, duration: 0.3 });
    pop(V, A, H + 30, own(a, 'cry', 'Awaken, my queen!'), 'float-text burn', 1.1);
    const rc = runeCircle(V, T, c, { size: 330 });
    MB.audio.sfx('rune');
    const candles = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2, P = { x: T.x + Math.cos(ang) * 170, y: T.y + Math.sin(ang) * 64 };
      const k = V.billboard('thrown candle', '🕯️', P.x, P.y);
      gsap.set(k.body, { y: -28 });
      gsap.fromTo(k.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
      const fl = dot(V, P, 64, '#ff7a1c', 20, 'charge');
      gsap.fromTo(fl.body, { scale: 0 }, { scale: 1, duration: 0.15, delay: 0.1 });
      const fk = gsap.to(fl.body, { scaleY: 1.3, duration: 0.1, yoyo: true, repeat: -1, delay: 0.25 });
      candles.push({ k, fl, fk, P });
      MB.audio.sfx('fire');
      await wait(0.1);
    }
    await wait(0.3);
    const outer = pillar(V, T, c), inner = pillar(V, T, '#3a0010');
    gsap.fromTo(outer.body, { scaleY: 0, scaleX: 2.2 }, { scaleY: 1.4, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(inner.body, { scaleY: 0, scaleX: 1 }, { scaleY: 1.5, duration: 0.25, delay: 0.05, ease: 'power2.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('burn'); V.shake(24); V.hitStop();
    tint(vt, 'brightness(0.4) sepia(1) saturate(5) hue-rotate(-30deg)', 1);
    cracks(V, T, '#1a0004', { n: 11, len: 190, w: 7, glow: '#ff3a1a', hold: 1 });
    candles.forEach(({ P }) => flameBurst(V, P, 120));
    rise(V, T, '#ffb347', 20, hT * 2.2);
    scatter(V, T, hT, ['💀', '🔥', '🦇'], 10, 170);
    pop(V, T, hT + 140, own(a, 'finish', 'The rite is complete.'), 'float-text burn', 1.2);
    await wait(0.5);
    [outer, inner].forEach((p) => gsap.to(p.body, { opacity: 0, scaleX: 0.2, duration: 0.4, onComplete: () => p.remove() }));
    candles.forEach(({ k, fl, fk, P }) => { fk.kill(); fl.remove(); puff(V, P, '#6a6a6a', 1, 60, 0.5); gsap.to(k.body, { scale: 0, duration: 0.3, delay: 0.3, onComplete: () => k.remove() }); });
    MB.audio.sfx('poof');
    rc.remove();
    await gsap.to([L, R], { y: 0, scaleY: 1, duration: 0.3 });
    resetDuo(v);
  };

  // Luxuria & Doloria: saint and sinner. A golden light rises from the praying nun and a green-black one from the
  // other; they chase each other round into one spinning yin-yang, and it comes down on the target
  S.saintsinner = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a) * 0.6, top = H + 170;
    gsap.to(R, { scaleY: 0.93, duration: 0.3 });
    const halo = V.billboard('queen-halo', '', A.x + 60, A.y);
    gsap.set(halo.body, { y: -V.heightOf(a) - 10 });
    gsap.fromTo(halo.body, { scale: 0 }, { scale: 1, duration: 0.3 });
    pop(V, A, V.heightOf(a) + 30, own(a, 'cry', 'Pray with us~'), 'float-text baka', 1);
    MB.audio.sfx('choir');
    const orbs = [['#ffe38a', 60], [c, -60]].map(([col, dx]) => dot(V, { x: A.x + dx, y: A.y }, H, col, 46, 'charge'));
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1, ease: 'power1.inOut', onUpdate: () => orbs.forEach((o, i) => {
      const ang = q.k * Math.PI * 5 + i * Math.PI, rr = 70 * (1 - q.k * 0.8), p = { x: A.x + Math.cos(ang) * rr, y: A.y + Math.sin(ang) * rr * 0.4 }, h = H + q.k * (top - H);
      gsap.set(o, p); gsap.set(o.body, { y: -h });
      if (Math.random() < 0.5) { const tr = V.billboard('petal', i ? '💚' : '🪶', p.x, p.y); tr.body.style.fontSize = '18px'; gsap.set(tr.body, { y: -h }); gsap.to(tr.body, { y: -h + 50, opacity: 0, duration: 0.6, onComplete: () => tr.remove() }); }
    }) });
    orbs.forEach((o) => o.remove());
    const yy = V.billboard('yinyang', '<i></i><i></i>', A.x, A.y);
    yy.body.style.setProperty('--c', c);
    gsap.set(yy.body, { y: -top });
    MB.audio.sfx('fusion'); flash(V, A, top, '#ffffff', 300);
    const spin = gsap.to(yy.body, { rotation: '+=360', duration: 0.5, ease: 'none', repeat: -1 });
    await gsap.fromTo(yy.body, { scale: 0.2 }, { scale: 1.2, duration: 0.3, ease: 'back.out(3)' });
    MB.audio.sfx('whoosh');
    spin.kill();
    await path(yy, (k) => ({ ...arc(A, T, top, hT, 90)(k), s: 1.2 + k * 0.4, r: k * 900 }), 0.5, 'power2.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('holy'); MB.audio.sfx('dark'); V.shake(20); V.hitStop();
    ring(V, T, '#ffe38a', 2.6); ring(V, T, '#1a1422', 1.8); ring(V, T, c, 1.2);
    scatter(V, T, hT, ['🪶', '💚', '✨', '😈', '😇'], 14, 180);
    gsap.to(yy.body, { scale: 2.6, opacity: 0, duration: 0.3, onComplete: () => yy.remove() });
    gsap.to(halo.body, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => halo.remove() });
    pop(V, T, hT + 140, own(a, 'finish', 'Amen~ ♥'), 'float-text bond-name', 1.1);
    await gsap.to(R, { scaleY: 1, duration: 0.3 });
    resetDuo(v);
  };

  // Hunter & Marie: the dream. A white picket fence springs up round the target, sunflowers come up, and their little
  // ranch house drops out of the sky onto it. Welcome home
  S.homestead = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    await gsap.to([L, R], { x: (i) => (i ? -14 : 14), duration: 0.25 }); // they lean together
    pop(V, A, H + 30, own(a, 'cry', 'One day... a ranch.'), 'float-text buff', 1.1);
    const posts = Array.from({ length: 14 }, (_, i) => {
      const ang = (i / 14) * Math.PI * 2, P = { x: T.x + Math.cos(ang) * 175, y: T.y + Math.sin(ang) * 66 }, f = V.billboard('fence-post', '', P.x, P.y);
      gsap.set(f.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: 1, duration: 0.25, delay: i * 0.04, ease: 'back.out(3)', onStart: () => i % 3 || MB.audio.sfx('tick') });
      return f;
    });
    const flowers = [0, 1, 2, 3].map((i) => {
      const ang = (i / 4) * Math.PI * 2 + 0.4, f = V.billboard('petal', MB.pick(['🌻', '🌼', '🌻']), T.x + Math.cos(ang) * 125, T.y + Math.sin(ang) * 46);
      f.body.style.fontSize = '42px';
      gsap.set(f.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
      gsap.fromTo(f.body, { scale: 0 }, { scale: 1, duration: 0.3, delay: 0.6 + i * 0.08, ease: 'back.out(3)' });
      return f;
    });
    await wait(0.9);
    // the house
    const shadow = V.flat('drop-shadow', '', T.x, T.y), house = V.billboard('thrown house', '🏡', T.x, T.y);
    gsap.set(house.body, { yPercent: -100, y: -900, transformOrigin: '50% 100%' });
    gsap.fromTo(shadow, { scale: 0.1, opacity: 0.2 }, { scale: 1, opacity: 0.6, duration: 0.7, ease: 'power2.in' });
    MB.audio.sfx('incoming');
    await gsap.to(house.body, { y: 20, duration: 0.7, ease: EASE.drop });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(26); V.hitStop();
    tint(vt, 'brightness(0.6)', 0.6);
    gsap.fromTo(house.body, { scaleY: 0.75, scaleX: 1.2 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.35)' });
    puff(V, T, '#e0d4bc', 12, 20, 1.3); debris(V, T, '#c9a36a', 8, { spread: 200 });
    posts.forEach((f, i) => gsap.fromTo(f.body, { y: -30 }, { y: 0, duration: 0.4, delay: i * 0.01, ease: 'bounce.out' }));
    scatter(V, T, hT, ['💛', '🌻', '🏡', '✨'], 12, 200);
    pop(V, T, hT + 180, own(a, 'finish', 'Welcome home. ♥'), 'float-text bond-name', 1.2);
    await wait(0.8);
    [house.body, shadow].forEach((n) => gsap.to(n, { opacity: 0, duration: 0.4, onComplete: () => (n === shadow ? shadow.remove() : house.remove()) }));
    [...posts, ...flowers].forEach((f) => gsap.to(f.body, { scaleY: 0, duration: 0.25, delay: rnd(0, 0.2), onComplete: () => f.remove() }));
    await gsap.to([L, R], { x: 0, duration: 0.3 });
    resetDuo(v);
  };

  // Hunter & Chris: Dad throws the long bomb, Chris sprints under it and lays out for the catch right through the
  // target. Touchdown, son
  S.hailmary = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, vt = victim(V, t);
    pop(V, A, H + 30, own(a, 'cry', 'Go long, son!'), 'float-text buff', 1);
    const run = standIn(V, v, R, { x: A.x + 40, y: A.y });
    MB.audio.sfx('zip');
    const P1 = { x: T.x - d.x * 40, y: T.y - d.y * 40 }, legs = gsap.fromTo(run.fl.body, { y: 0 }, { y: -16, duration: 0.08, yoyo: true, repeat: -1 });
    const sprint = gsap.to(run.fl, { x: P1.x, y: P1.y, duration: 0.95, ease: 'power1.inOut', onUpdate: () => { if (Math.random() < 0.3) puff(V, { x: gsap.getProperty(run.fl, 'x'), y: gsap.getProperty(run.fl, 'y') }, '#e8dccb', 1, 0, 0.5); } });
    await gsap.to(L, { rotation: -sg * 20, x: -sg * 10, duration: 0.25 }); // winds up
    const ball = V.billboard('thrown', '🏈', A.x - 30, A.y);
    ball.body.style.fontSize = '48px';
    MB.audio.sfx('whoosh');
    gsap.to(L, { rotation: sg * 14, x: sg * 10, duration: 0.12, ease: 'power3.in' });
    await path(ball, along(arc({ x: A.x - 30, y: A.y }, T, H * 0.7, hT * 1.2, 440), 0), 1.05, 'sine.inOut');
    await sprint; legs.kill();
    // the dive
    await gsap.to(run.fl.body, { rotation: sg * 70, y: -30, duration: 0.1 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('punch'); V.shake(20); V.hitStop();
    squash(vt, 0.55);
    debris(V, T, '#5a9a3a', 10, { spread: 170 });
    const td = V.billboard('float-text yard', 'TOUCHDOWN!', T.x, T.y);
    gsap.set(td.body, { y: -hT * 2 - 70 });
    gsap.timeline({ onComplete: () => td.remove() }).fromTo(td.body, { scale: 0.2 }, { scale: 1.3, duration: 0.2, ease: 'back.out(3)' }).to(td.body, { opacity: 0, duration: 0.3, delay: 0.7 });
    MB.audio.sfx('cheer');
    toss(ball, { v: [400, 600], ang: [-100, -80], dur: 0.9, spin: 720 });
    await gsap.to(run.fl.body, { rotation: 0, y: 0, duration: 0.3, delay: 0.2 });
    pop(V, T, hT + 140, own(a, 'finish', "That's my boy!"), 'float-text buff', 1.1);
    await gsap.to(run.fl, { x: A.x + 40, y: A.y, duration: 0.45, ease: 'power2.inOut' });
    run.back();
    gsap.to(L, { rotation: 0, x: 0, duration: 0.2 });
    await gsap.to([L, R], { y: -30, duration: 0.12, yoyo: true, repeat: 1 }); // chest bump
    resetDuo(v);
  };

  // Marie & Chris: the red streak in his hair is for her. She paints one big red stroke across the target, he adds a
  // lightning bolt through it, and the paint goes everywhere
  function brushSvg(d, c, w) {
    return `<svg viewBox="0 0 300 300" width="300" height="300" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="d" d="${d}" stroke="${c}" stroke-width="${w}"/><path class="d" d="${d}" stroke="#ffffff66" stroke-width="${w * 0.25}"/></svg>`;
  }
  S.redstreak = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    const brush = V.billboard('thrown', '🖌️', A.x - 50, A.y);
    gsap.set(brush.body, { y: -H * 0.6, scale: 0 });
    await gsap.to(brush.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 30, own(a, 'cry', 'Hold still, sweetie...'), 'float-text burn', 1);
    await gsap.to(L, { y: 14, duration: 0.15, yoyo: true, repeat: 1 }); // dips the brush
    await path(brush, arc({ x: A.x - 50, y: A.y }, T, H * 0.6, hT * 2 + 40, 120), 0.4, 'sine.inOut');
    // her stroke: one long, smooth curve
    const s1 = V.billboard('brush-stroke', brushSvg('M30,60 C110,40 190,150 270,230', c, 42), T.x, T.y);
    gsap.set(s1.body, { y: -hT });
    MB.audio.sfx('swish');
    gsap.to(brush, { x: T.x + 100, duration: 0.25 });
    await draw(s1.body.querySelectorAll('.d'), { duration: 0.25, ease: 'power2.inOut' });
    impact(); hit(V, t, c, true); MB.audio.sfx('splat'); V.shake(12);
    brush.remove();
    // his: a lightning bolt through it
    await gsap.to(R, { y: -30, duration: 0.12, yoyo: true, repeat: 1 });
    const s2 = V.billboard('brush-stroke', brushSvg('M200,20 L120,140 L190,150 L90,285', '#1a0a0a', 26), T.x, T.y);
    gsap.set(s2.body, { y: -hT });
    MB.audio.sfx('zap');
    await draw(s2.body.querySelectorAll('.d'), { duration: 0.15, ease: 'power3.in' });
    flash(V, T, hT, '#ffffff', 360); MB.audio.sfx('slam'); MB.audio.sfx('guitar'); V.shake(18); V.hitStop();
    tint(vt, 'sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)', 1);
    for (let i = 0; i < 16; i++) { const s = dot(V, T, hT, MB.pick([c, c, '#1a0a0a']), rnd(8, 18)); toss(s, { v: [260, 560], dur: 0.9 }); }
    decal(V, T, 'splat', c, 1);
    scatter(V, T, hT, ['❤️', '⚡', '✨'], 10, 160);
    pop(V, T, hT + 140, own(a, 'finish', 'Keep it red. For Mom.'), 'float-text burn', 1.2);
    await wait(0.4);
    [s1, s2].forEach((s) => gsap.to(s.body, { opacity: 0, duration: 0.4, onComplete: () => s.remove() }));
    await gsap.to([L, R], { x: (i) => (i ? -12 : 12), duration: 0.2, yoyo: true, repeat: 1 }); // a hug
    resetDuo(v);
  };

  // Olivia & Evelyn: Evelyn tells the one about the monster under the bed, the lights go out, and the monster
  // actually shows up behind the target. Olivia punches straight through it. Nobody scares her little sister
  S.spookpunch = async (V, a, t, impact) => {
    const { v, A, T, C, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    const fl = V.billboard('chin-light', '', A.x + 60, A.y);
    gsap.set(fl.body, { y: -H * 0.6 });
    MB.audio.sfx('click');
    gsap.to(R, { filter: 'brightness(1.35) contrast(1.2)', duration: 0.2 });
    pop(V, A, H + 30, 'The monster under the bed...', 'float-text debuff', 1.2);
    await wait(0.4);
    const B = { x: T.x + d.x * 70, y: T.y + d.y * 70 - 30 }, mon = V.billboard('ghost-rise monster', '👹', B.x, B.y);
    mon.body.style.setProperty('--c', '#ff2a2a');
    gsap.set(mon.body, { y: -hT, scale: 0.3, opacity: 0 });
    MB.audio.sfx('dark');
    await gsap.to(mon.body, { y: -hT * 2.2, scale: 1.6, opacity: 0.9, duration: 0.7, ease: 'power2.out' });
    pop(V, B, hT * 3, 'GRRAAAH!', 'float-text burn', 0.8);
    await gsap.to(R, { scaleY: 0.9, x: 16, duration: 0.15 }); // Evelyn hides behind her sister
    pop(V, A, H + 70, own(a, 'cry', 'NOBODY scares my sister!'), 'float-text buff', 1);
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    await gsap.to(L, { x: 40, rotation: 10, duration: 0.08 });
    const fist = V.billboard('thrown big', '👊', C.x, C.y);
    gsap.set(fist.body, { y: -hT * 1.2 });
    const through = { x: B.x + d.x * 120, y: B.y + d.y * 120 };
    gsap.to(fist, { x: through.x, y: through.y, duration: 0.25, ease: 'power2.out' });
    gsap.to(fist.body, { y: -hT * 2, opacity: 0, duration: 0.3, delay: 0.1, onComplete: () => fist.remove() });
    impact(); hit(V, t, c, true); MB.audio.sfx('pow'); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    squash(vt, 0.55);
    await wait(0.1);
    MB.audio.sfx('poof');
    puff(V, B, '#5a2a4a', 12, hT * 2, 1.4);
    gsap.to(mon.body, { scale: 0, rotation: 180, opacity: 0, duration: 0.3, onComplete: () => mon.remove() });
    pop(V, B, hT * 2.5, 'K.O.!', 'float-text burn', 0.8);
    scatter(V, T, hT, ['💥', '💜', '⭐'], 10, 160);
    gsap.to(fl.body, { opacity: 0, duration: 0.2, onComplete: () => fl.remove() });
    pop(V, T, hT + 140, own(a, 'finish', 'Monster: defeated!'), 'float-text buff', 1.1);
    await gsap.to(L, { x: 0, rotation: 0, duration: 0.2 });
    await wait(0.3);
    pop(V, C, H + 40, '💜', 'thrown', 0.9);
    gsap.to(R, { filter: 'none', scaleY: 1, x: 0, duration: 0.2, clearProps: 'filter' });
    resetDuo(v);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- cross-novel duo styles
  // an emoji prop standing over P at height h, popped in (the caller removes it)
  function propAt(V, P, h, ch, size, cls = 'thrown') {
    const b = V.billboard(cls, ch, P.x, P.y);
    if (size) b.body.style.fontSize = size + 'px';
    gsap.set(b.body, { y: -h });
    gsap.fromTo(b.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    return b;
  }
  const fadeOut = (b, delay = 0, dur = 0.3) => gsap.to(b.body, { opacity: 0, duration: dur, delay, onComplete: () => b.remove() });
  // where each partner of a duo stands: 0 the left one, 1 the right one
  const sideOf = (A, i) => ({ x: A.x + (i ? 45 : -45), y: A.y });
  // a rubber stamp slammed down over T
  function slamStamp(V, T, h, text, c, hold = 0.8) {
    const st = V.billboard('stamp-mark', text, T.x, T.y);
    st.body.style.color = c;
    gsap.set(st.body, { y: -h, rotation: -10 });
    gsap.to(st.body, { opacity: 0, y: `-=40`, duration: 0.4, delay: 0.2 + hold, onComplete: () => st.remove() });
    return gsap.fromTo(st.body, { scale: 3.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power4.in' });
  }

  // Keiko & Benjamin: her first shift at the minimarket. He punches her card, she tears through every job she has ever
  // had on the target (sweep, fry, deliver...), and he stamps her HIRED on it
  S.doubleshift = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    const card = propAt(V, sideOf(A, 1), H + 40, '🕘', 60);
    pop(V, A, H + 30, own(a, 'cry', 'Shift starts NOW.'), 'float-text buff', 1);
    await gsap.to(R, { y: -16, duration: 0.1, yoyo: true, repeat: 1 });
    MB.audio.sfx('ding');
    pop(V, sideOf(A, 1), H + 110, 'CLOCK IN!', 'float-text shield', 0.8);
    fadeOut(card, 0.3);
    const run = standIn(V, v, L, sideOf(A, 0));
    MB.audio.sfx('zip');
    await gsap.to(run.fl, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => Math.random() < 0.3 && puff(V, { x: gsap.getProperty(run.fl, 'x'), y: gsap.getProperty(run.fl, 'y') }, '#e8dccb', 1, 0, 0.5) });
    const jobs = [['🧹', 'SWEEP!', 'swish'], ['🍳', 'FRY!', 'bonk'], ['📦', 'DELIVERY!', 'thud'], ['🧾', 'RECEIPT!', 'tick'], ['🌭', 'LUNCH RUSH!', 'pop']];
    for (let i = 0; i < jobs.length; i++) {
      const [ch, w, sfx] = jobs[i], p = propAt(V, C, hT + 30, ch, 64);
      gsap.to(run.fl.body, { rotation: i % 2 ? 12 : -12, y: -10, duration: 0.08, yoyo: true, repeat: 1 });
      gsap.to(p, { x: T.x + rnd(-30, 30), y: T.y, duration: 0.14, ease: 'power2.in' });
      await gsap.to(p.body, { rotation: i % 2 ? 200 : -200, duration: 0.14, ease: 'power2.in' });
      MB.audio.sfx(sfx); burst(V, T, c, 8, { h: hT }); V.shake(5);
      pop(V, T, hT + 60 + i * 14, w, 'float-text buff', 0.55);
      toss(p, { v: [200, 380], dur: 0.6 });
      await wait(0.06);
    }
    // his stamp
    MB.audio.sfx('whoosh');
    await slamStamp(V, T, hT, 'HIRED!', c);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    squash(vt, 0.6);
    scatter(V, T, hT, ['🧹', '📦', '🍳', '💵'], 10, 170);
    pop(V, T, hT + 150, own(a, 'finish', 'Welcome aboard.'), 'float-text buff', 1.1);
    await gsap.to(run.fl, { x: sideOf(A, 0).x, y: A.y, duration: 0.4, ease: 'power2.inOut' });
    run.back();
    await gsap.to([L, R], { x: (i) => (i ? -12 : 12), duration: 0.15, yoyo: true, repeat: 1 }); // a handshake
    resetDuo(v);
  };

  // Kuku & Olivia: two bartenders on a swapped shift. A giant mug hangs over the target, the fairy flies bottles into
  // it and the barista sends espresso shots after them; it bubbles over and tips out on the target. Last call
  S.irishcoffee = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), top = hT * 2 + 50, vt = victim(V, t);
    pop(V, A, H + 30, own(a, 'cry', 'Two bars, one drink~'), 'float-text buff', 1);
    const mug = propAt(V, T, top, '☕', 150);
    const flutter = gsap.to(L, { y: -30, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' }); // the fairy hovers
    const shots = [[0, '🥃'], [1, '☕'], [0, '🍸'], [1, '☕'], [0, '🍾']];
    for (const [who, ch] of shots) {
      const P0 = sideOf(A, who), b = V.billboard('thrown bottle', ch, P0.x, P0.y);
      if (!who) rise(V, P0, '#ffe38a', 4, H); // fairy dust
      MB.audio.sfx(who ? 'pop' : 'sparkle');
      gsap.fromTo(who ? R : L, { rotation: who ? 10 : -10 }, { rotation: 0, duration: 0.2 });
      path(b, (k) => ({ ...arc(P0, T, H * 0.7, top + 20, 140)(k), r: k * 540 }), 0.4, 'sine.inOut').then(() => {
        b.remove(); MB.audio.sfx('bubble');
        gsap.fromTo(mug.body, { scaleX: 1.15, scaleY: 0.9 }, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'elastic.out(1,0.4)' });
        puff(V, T, '#f2e6d0', 2, top + 60, 0.5);
      });
      await wait(0.16);
    }
    await wait(0.45);
    flutter.kill();
    // it bubbles over and tips
    MB.audio.sfx('wobble');
    await gsap.to(mug.body, { rotation: -10, duration: 0.07, yoyo: true, repeat: 5 });
    await gsap.to(mug.body, { rotation: 150, y: -hT * 1.4, duration: 0.25, ease: 'power2.in' });
    impact(); hit(V, t, '#8b5a2b', true); MB.audio.sfx('splash'); MB.audio.sfx('sizzle'); V.shake(14); V.hitStop();
    tint(vt, 'sepia(1) saturate(3) brightness(0.7)', 1);
    for (let i = 0; i < 18; i++) { const s = dot(V, T, hT * 1.4, MB.pick(['#6b3a1a', '#8b5a2b', '#f2e6d0', '#d8a24a']), rnd(8, 16)); toss(s, { v: [220, 500], dur: 0.9 }); }
    decal(V, T, 'splat', '#6b3a1a', 1);
    scatter(V, T, hT, ['✨', '🍀', '☕', '🥃'], 10, 160);
    pop(V, T, hT + 150, own(a, 'finish', 'Last call, hon~!'), 'float-text buff', 1.1);
    fadeOut(mug, 0.4);
    await gsap.to([L, R], { y: 0, rotation: 0, duration: 0.2 });
    await wait(0.3);
    resetDuo(v);
  };

  // Ophelia & Luxuria: the sin hunter hears a confession. Luxuria blows the target a kiss and its sins float out one
  // by one and circle it while the count goes up; GUILTY, and a giant cross comes down on all of them
  S.penance = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), GOLD = '#ffe38a';
    const P1 = sideOf(A, 1), kiss = V.billboard('thrown', '💋', P1.x, P1.y);
    kiss.body.style.fontSize = '50px';
    MB.audio.sfx('kiss');
    pop(V, A, H + 30, own(a, 'cry', 'Confess, little lamb~'), 'float-text baka', 1);
    await path(kiss, arc(P1, T, H * 0.7, hT, 90), 0.4, 'sine.inOut');
    kiss.remove();
    const sins = ['🍷', '🍫', '💸', '😈', '💋'], orbs = [], q = { a: 0 };
    const orbit = gsap.to(q, { a: Math.PI * 8, duration: 3, ease: 'none', onUpdate: () => orbs.forEach((b, i) => {
      const ang = q.a + (i / sins.length) * Math.PI * 2;
      gsap.set(b, { x: T.x + Math.cos(ang) * 120, y: T.y + Math.sin(ang) * 44 });
      gsap.set(b.body, { y: -hT - 30 - Math.sin(ang) * 20 });
    }) });
    for (let i = 0; i < sins.length; i++) {
      const b = V.billboard('thrown', sins[i], T.x, T.y);
      b.body.style.fontSize = '46px';
      orbs.push(b);
      gsap.fromTo(b.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
      MB.audio.sfx('tick');
      pop(V, T, hT * 2 + 40, `SINS: ${i + 1}`, 'float-text burn', 0.35);
      await wait(0.22);
    }
    gsap.to(L, { y: -20, duration: 0.2 });
    pop(V, A, H + 80, 'GUILTY!', 'float-text verdict', 0.9);
    MB.audio.sfx('choir');
    const col = pillar(V, T, GOLD);
    gsap.fromTo(col.body, { scaleY: 0, opacity: 0.8 }, { scaleY: 1.3, duration: 0.3 });
    const cross = V.billboard('thrown spirit', '✝️', T.x, T.y);
    cross.body.style.setProperty('--c', GOLD);
    cross.body.style.fontSize = '170px';
    gsap.set(cross.body, { yPercent: -100, y: -800, transformOrigin: '50% 100%' });
    await gsap.to(cross.body, { y: 10, duration: 0.35, ease: EASE.drop });
    orbit.kill();
    impact(); hit(V, t, GOLD, true); MB.audio.sfx('holy'); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    tint(vt, 'brightness(2) sepia(0.6)', 0.8);
    ring(V, T, GOLD, 2.6); ring(V, T, c, 1.6);
    orbs.forEach((b) => toss(b, { v: [300, 550], dur: 0.8 }));
    scatter(V, T, hT, ['🕊️', '✨', '🪶'], 10, 170);
    pop(V, T, hT + 170, own(a, 'finish', 'Absolved. Forcefully.'), 'float-text bond-name', 1.1);
    await wait(0.5);
    fadeOut(cross, 0, 0.4);
    gsap.to(col.body, { opacity: 0, scaleX: 0.2, duration: 0.4, onComplete: () => col.remove() });
    await gsap.to(L, { y: 0, duration: 0.2 });
    resetDuo(v);
  };

  // Mr. Dino & Shiina: the math department. She writes the proof on a chalkboard over the target a line at a time,
  // he flexes through every step, and the Q.E.D. is him slamming the whole board down on it
  S.musclemath = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    const board = V.billboard('chalkboard proof', '', T.x, T.y);
    gsap.set(board.body, { y: -hT - 190 });
    await gsap.fromTo(board.body, { scale: 0, rotation: -15 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(2)' });
    const steps = ['F = m × a', 'm = 💪', '∴ F = PAIN'];
    for (let i = 0; i < steps.length; i++) {
      gsap.fromTo(R, { rotation: -8 }, { rotation: 0, duration: 0.2 }); // she writes
      MB.audio.sfx('chalk');
      const line = document.createElement('div');
      line.textContent = steps[i];
      board.body.appendChild(line);
      gsap.fromTo(line, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.35, ease: 'none' });
      await wait(0.35);
      gsap.fromTo(L, { scaleX: 1.12, scaleY: 0.95 }, { scaleX: 1, scaleY: 1, duration: 0.35, ease: 'elastic.out(1,0.4)' }); // he flexes
      pop(V, sideOf(A, 0), H + 20, ['FLEX!', 'GAINS!', 'PROVEN!'][i], 'float-text buff', 0.6);
      MB.audio.sfx('buff');
      await wait(0.2);
    }
    pop(V, A, H + 60, own(a, 'cry', 'Q.E.D., class!'), 'float-text buff', 0.9);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.25, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    await gsap.to(board.body, { y: -hT - 300, rotation: -20, duration: 0.2, ease: 'power2.out' });
    await gsap.to(board.body, { y: -hT * 0.6, rotation: 0, duration: 0.14, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('clang'); V.shake(20); V.hitStop();
    squash(vt, 0.5);
    puff(V, T, '#ffffff', 10, hT, 1); // chalk dust
    scatter(V, T, hT, ['📐', '✏️', '💪', '➗'], 12, 180);
    slamStamp(V, T, hT * 2 + 60, 'Q.E.D.', c, 0.7);
    pop(V, T, hT + 170, own(a, 'finish', 'Show your work!'), 'float-text buff', 1.1);
    fadeOut(board, 0.3);
    await wait(0.5);
    resetDuo(v);
    await goHome(v, A);
  };

  // Natsuki & Pepita: the bake-off. Natsuki fires three perfect cupcakes at the target; Pepita's pizza stays in the
  // oven too long, comes out on fire, and she flings it in a panic. The judges are divided
  S.ovenmitt = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, A, H + 30, own(a, 'cry', 'Watch and learn!'), 'float-text baka', 0.9);
    const P0 = sideOf(A, 0);
    for (let i = 0; i < 3; i++) {
      const b = V.billboard('thrown', '🧁', P0.x, P0.y), Q = { x: T.x + rnd(-40, 40), y: T.y + rnd(-15, 15) };
      b.body.style.fontSize = '54px';
      gsap.fromTo(L, { rotation: -10 }, { rotation: 0, duration: 0.2 });
      MB.audio.sfx('whoosh');
      path(b, (k) => ({ ...arc(P0, Q, H * 0.6, hT * 1.3, 130)(k), r: k * 360 }), 0.35, 'sine.in').then(() => {
        MB.audio.sfx('splat'); b.remove();
        for (let j = 0; j < 6; j++) { const s = dot(V, Q, hT * 1.3, MB.pick(['#ff6fae', '#ffd1e6', '#ffffff']), rnd(7, 13)); toss(s, { v: [160, 360], dur: 0.7 }); }
      });
      await wait(0.18);
    }
    await wait(0.3);
    // Pepita's pizza
    const P1 = sideOf(A, 1), pz = propAt(V, P1, H * 0.8, '🍕', 64), fire = propAt(V, P1, H * 0.8 - 30, '🔥', 50);
    MB.audio.sfx('sizzle');
    gsap.to(fire.body, { scale: 1.8, duration: 0.6 });
    const panic = gsap.to(R, { x: 4, duration: 0.05, yoyo: true, repeat: 11 });
    pop(V, P1, H + 50, 'T-TOO HOT!!', 'float-text burn', 0.8);
    await wait(0.6);
    panic.kill(); gsap.set(R, { x: 0 });
    fadeOut(fire, 0, 0.1);
    MB.audio.sfx('whoosh');
    await path(pz, (k) => ({ ...arc(P1, T, H * 0.8, hT, 70)(k), r: k * 1440, s: 1 + k * 0.5 }), 0.45, 'power1.in', (p) => {
      if (Math.random() < 0.5) { const f = dot(V, p, p.h, '#ff7a1c', rnd(14, 26), 'charge'); gsap.to(f.body, { opacity: 0, scale: 0.2, duration: 0.4, onComplete: () => f.remove() }); }
    });
    impact(); hit(V, t, '#ff7a1c', true); MB.audio.sfx('boom'); MB.audio.sfx('burn'); V.shake(18); V.hitStop();
    flameBurst(V, T, hT * 2);
    puff(V, T, '#fff6e8', 10, hT, 1.2); // flour everywhere
    tint(vt, 'sepia(1) saturate(5) hue-rotate(-20deg) brightness(0.8)', 0.9);
    toss(pz, { v: [300, 500], ang: [-110, -70], dur: 0.9, spin: 900 });
    pop(V, T, hT * 2 + 70, '🧁 10 · 🍕 2?!', 'float-text buff', 1.2);
    pop(V, T, hT + 150, own(a, 'finish', 'Mamma mia!!'), 'float-text burn', 1.1);
    await gsap.to([L, R], { rotation: 0, duration: 0.2 });
    await wait(0.4);
    resetDuo(v);
  };

  // Rirarra & Diana: lifeguard on duty. The water rises round the target, the whistle blows, a lifebuoy lands over it
  // (Diana insisted), and the lifeguard's fins close in anyway. CHOMP
  S.lifebuoy = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    MB.audio.sfx('whistle');
    pop(V, A, H + 30, own(a, 'cry', 'NO RUNNING ON DECK!'), 'float-text shield', 1);
    decal(V, T, 'whirlpool', '#3fb6ff', 2.4);
    droplets(V, T, 10);
    MB.audio.sfx('wave');
    await gsap.to(R, { y: -20, duration: 0.12, yoyo: true, repeat: 3 }); // Diana panics on its behalf
    pop(V, sideOf(A, 1), H + 60, 'Throw the ring!!', 'float-text baka', 0.8);
    const P0 = sideOf(A, 0), buoy = V.billboard('thrown', '🛟', P0.x, P0.y);
    buoy.body.style.fontSize = '90px';
    MB.audio.sfx('whoosh');
    await path(buoy, (k) => ({ ...arc(P0, T, H * 0.6, hT * 0.7, 200)(k), r: k * 720 }), 0.55, 'sine.inOut');
    MB.audio.sfx('splash'); ring(V, T, '#ff5a5a', 1.4); droplets(V, T, 8);
    await gsap.to(buoy.body, { y: -hT * 0.5, scaleX: 2, scaleY: 0.7, rotation: 0, duration: 0.2, ease: 'back.out(2)' });
    pop(V, T, hT * 2 + 40, 'SAFE...?', 'float-text shield', 0.7);
    await wait(0.25);
    await circleFins(V, T, c, 2, 1, 3);
    await chomp(V, T, hT, c, 1.2);
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); V.shake(20); V.hitStop();
    squash(vt, 0.55);
    toss(buoy, { v: [380, 560], ang: [-110, -70], dur: 1, spin: 720 });
    droplets(V, T, 14, 180);
    scatter(V, T, hT, ['🦈', '💦', '🛟'], 10, 160);
    pop(V, T, hT + 150, own(a, 'finish', 'Rescued! ...Mostly.'), 'float-text shield', 1.1);
    await wait(0.4);
    resetDuo(v);
  };

  // Lisa & Cheetor: the nap club. They yawn a stream of Zzz over the target, a giant alarm clock goes off above it,
  // and they each throw a shoe at the clock, hard enough to bury it (and the target). ...5 more minutes
  S.snooze = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 50;
    gsap.to([L, R], { rotation: (i) => (i ? 8 : -8), y: 8, duration: 0.5 }); // slump
    pop(V, A, H + 30, own(a, 'cry', '*yaaawn*'), 'float-text debuff', 1);
    MB.audio.sfx('wind');
    for (let i = 0; i < 8; i++) {
      const P0 = sideOf(A, i % 2), z = V.billboard('float-text debuff', 'Z', P0.x, P0.y);
      z.body.style.fontSize = rnd(26, 44) + 'px';
      path(z, (k) => ({ ...arc(P0, T, H * 0.8, hT * 1.3, 90)(k), r: Math.sin(k * 9) * 20 }), 0.8, 'sine.inOut').then(() => z.remove());
      await wait(0.08);
    }
    await wait(0.5);
    tint(vt, 'brightness(0.7) saturate(0.4)', 1.4);
    const clock = propAt(V, T, top, '⏰', 130);
    await wait(0.2);
    const ringing = gsap.to(clock.body, { rotation: 12, duration: 0.05, yoyo: true, repeat: -1 });
    pop(V, T, top + 90, 'RIIIING!!', 'float-text burn', 0.9);
    MB.audio.sfx('alarm');
    await gsap.to([L, R], { rotation: 0, y: 0, duration: 0.2 });
    pop(V, A, H + 60, '...not it.', 'float-text debuff', 0.7);
    await wait(0.3);
    MB.audio.sfx('whoosh');
    gsap.fromTo([L, R], { rotation: (i) => (i ? 14 : -14) }, { rotation: 0, duration: 0.3 });
    const shoes = [0, 1].map((i) => { const P0 = sideOf(A, i), s = V.billboard('thrown', '👟', P0.x, P0.y); s.body.style.fontSize = '56px'; return { s, P0 }; });
    await Promise.all(shoes.map(({ s, P0 }, i) => path(s, (k) => ({ ...arc(P0, T, H * 0.7, top, 80 + i * 40)(k), r: k * 900 }), 0.35 + i * 0.06, 'power1.in')));
    ringing.kill();
    MB.audio.sfx('bonk');
    shoes.forEach(({ s }) => toss(s, { v: [200, 400], dur: 0.7 }));
    await gsap.to(clock.body, { y: -hT * 0.6, rotation: 200, duration: 0.2, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    squash(vt, 0.5);
    debris(V, T, '#c0c0c0', 8, { chars: ['⚙️', '🔩'] });
    fadeOut(clock, 0.1, 0.2);
    pop(V, T, hT + 150, own(a, 'finish', '...5 more minutes.'), 'float-text debuff', 1.2);
    await wait(0.5);
    resetDuo(v);
  };

  // Faneel & Hed: high rollers. Hed deals a hand round the target and pushes every chip in; while it watches the pot,
  // Faneel lifts its wallet from behind. Royal flush: the cards fly into it
  S.allin = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), [L] = duo(v), H = V.heightOf(a), vt = victim(V, t), P1 = sideOf(A, 1);
    pop(V, A, H + 30, own(a, 'cry', 'Deal me in~'), 'float-text buff', 0.9);
    const cards = [];
    for (let i = 0; i < 5; i++) {
      const P = { x: T.x + (i - 2) * 54, y: T.y + 30 }, k = V.billboard('play-card', '', P1.x, P1.y);
      k.body.style.setProperty('--c', c);
      MB.audio.sfx('deal');
      path(k, (q) => ({ ...arc(P1, P, H * 0.6, hT * 2 + 40, 60)(q), r: (1 - q) * 360 + (i - 2) * 10 }), 0.3, 'power2.out');
      cards.push(k);
      await wait(0.09);
    }
    // all in
    pop(V, P1, H + 70, 'ALL IN!!', 'float-text buff', 0.9);
    MB.audio.sfx('coin');
    const chips = Array.from({ length: 10 }, (_, i) => {
      const ch = V.billboard('thrown', '🪙', P1.x, P1.y);
      ch.body.style.fontSize = '30px';
      path(ch, arc(P1, { x: T.x + rnd(-50, 50), y: T.y + 50 + rnd(-10, 10) }, H * 0.4, 0, 60 + rnd(0, 60)), 0.35 + i * 0.03, 'sine.in');
      return ch;
    });
    await wait(0.4);
    // the pickpocket
    const sneak = standIn(V, v, L, sideOf(A, 0)), B = { x: T.x + d.x * 100, y: T.y + d.y * 100 };
    gsap.set(sneak.fl.body, { opacity: 0.55 });
    MB.audio.sfx('blink');
    await gsap.to(sneak.fl, { x: B.x, y: B.y, duration: 0.45, ease: 'power2.inOut' });
    const wal = propAt(V, T, hT, '👛', 50);
    MB.audio.sfx('loot');
    pop(V, B, H * 0.9 + 30, 'Yoink~♪', 'float-text baka', 0.8);
    gsap.to(wal, { x: B.x, y: B.y, duration: 0.3 });
    gsap.to(wal.body, { y: -H * 0.5, duration: 0.3, onComplete: () => fadeOut(wal, 0.1) });
    // the reveal
    const face = ['10', 'J', 'Q', 'K', 'A'];
    cards.forEach((k, i) => gsap.to(k.body, { rotationY: 90, duration: 0.1, delay: i * 0.08, onComplete: () => {
      k.body.textContent = face[i] + '♠'; k.body.classList.add('up');
      gsap.to(k.body, { rotationY: 0, duration: 0.1 }); MB.audio.sfx('cardflip');
    } }));
    await wait(0.7);
    pop(V, T, hT * 2 + 140, 'ROYAL FLUSH!', 'float-text buff', 1);
    MB.audio.sfx('fanfare');
    for (const k of cards) {
      MB.audio.sfx('shuriken');
      gsap.to(k, { x: T.x, y: T.y, duration: 0.15, ease: 'power2.in' });
      gsap.to(k.body, { y: -hT, rotation: '+=540', duration: 0.15, ease: 'power2.in', onComplete: () => { k.remove(); burst(V, T, c, 6, { h: hT }); } });
      await wait(0.07);
    }
    await wait(0.12);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('coin'); V.shake(16); V.hitStop();
    squash(vt, 0.6);
    chips.forEach((ch) => toss(ch, { v: [250, 480], dur: 0.8 }));
    scatter(V, T, hT, ['🪙', '💰', '🃏', '💎'], 12, 180);
    pop(V, T, hT + 150, own(a, 'finish', 'The house always wins~'), 'float-text buff', 1.1);
    gsap.set(sneak.fl.body, { opacity: 1 });
    await gsap.to(sneak.fl, { x: sideOf(A, 0).x, y: A.y, duration: 0.4, ease: 'power2.inOut' });
    sneak.back();
    resetDuo(v);
  };

  // Catherine & Susan: two divas, one painting. It hangs over the target and grows with every bid they shout over
  // each other, the gavel comes down on the last one, and so does the frame
  S.biddingwar = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 30;
    const art = propAt(V, T, top, '🖼️', 70);
    MB.audio.sfx('sparkle');
    pop(V, A, H + 90, own(a, 'cry', 'Darling, I OWN art.'), 'float-text buff', 1);
    const bids = ['$1M', '$5M', '$20M', '$100M', '$1B!!'];
    for (let i = 0; i < bids.length; i++) {
      const who = i % 2;
      gsap.fromTo(who ? R : L, { y: -26 }, { y: 0, duration: 0.25, ease: 'power2.in' });
      pop(V, sideOf(A, who), H + 20 + i * 8, `🪧 ${bids[i]}`, 'float-text buff', 0.6);
      MB.audio.sfx(i === bids.length - 1 ? 'coin' : 'tick');
      gsap.to(art.body, { scale: 1 + (i + 1) * 0.2, duration: 0.25, ease: 'back.out(2)' });
      await wait(0.32);
    }
    pop(V, T, top + 120, 'SOLD!', 'float-text verdict', 0.9);
    const gav = V.billboard('thrown giant-gavel', '🔨', T.x + 90, T.y);
    gav.body.style.setProperty('--c', c);
    gsap.set(gav.body, { y: -top - 40, rotation: -60, transformOrigin: '80% 80%' });
    MB.audio.sfx('whoosh');
    await gsap.to(gav.body, { rotation: 10, duration: 0.15, ease: 'power4.in' });
    MB.audio.sfx('gavel'); ring(V, T, c, 1.2);
    fadeOut(gav, 0.2);
    // the frame drops
    await gsap.to(art.body, { y: -hT * 0.9, duration: 0.2, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('glass'); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    squash(vt, 0.6);
    for (let i = 0; i < 14; i++) {
      const b = V.billboard('petal', '💸', T.x + rnd(-120, 120), T.y + rnd(-30, 30));
      gsap.set(b.body, { y: -rnd(300, 500) });
      gsap.to(b.body, { y: -rnd(0, 30), rotation: rnd(-180, 180), duration: rnd(0.6, 1), ease: 'power1.in', onComplete: () => fadeOut(b, 0.3) });
    }
    MB.audio.sfx('kaching');
    pop(V, T, hT + 160, own(a, 'finish', 'Put it in MY lobby.'), 'float-text buff', 1.1);
    fadeOut(art, 0.5);
    await wait(0.5);
    resetDuo(v);
  };

  // Yuri & Evelyn: horror book club. A book opens over the target and its pages flutter out as they read aloud, the
  // lights go down, and whatever was in chapter nine climbs out behind it. BOO
  S.chillchapter = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 60;
    const book = propAt(V, T, top, '📖', 110);
    pop(V, A, H + 30, own(a, 'cry', 'And then... the door creaked.'), 'float-text debuff', 1.3);
    MB.audio.sfx('flutter');
    for (let i = 0; i < 10; i++) {
      const pg = V.billboard('page', '', T.x, T.y), ang = rnd(0, Math.PI * 2);
      pg.body.style.setProperty('--c', c);
      gsap.set(pg.body, { y: -top });
      gsap.to(pg, { x: T.x + Math.cos(ang) * rnd(80, 200), y: T.y + Math.sin(ang) * rnd(30, 70), duration: 1 });
      gsap.to(pg.body, { y: -top + rnd(-60, 120), rotation: rnd(-360, 360), opacity: 0, duration: 1.1, onComplete: () => pg.remove() });
    }
    const words = ['creak...', 'drip...', 'scratch...', 'behind you.'];
    for (let i = 0; i < words.length; i++) {
      const w = V.billboard('paper-word', words[i], T.x + rnd(-120, 120), T.y);
      w.body.style.color = i % 2 ? '#8a5cc8' : '#3a2a4a';
      gsap.set(w.body, { y: -top + rnd(-40, 60) });
      gsap.fromTo(w.body, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.25 });
      fadeOut(w, 0.7);
      gsap.fromTo(i % 2 ? R : L, { y: -10 }, { y: 0, duration: 0.2 });
      MB.audio.sfx('tick');
      await wait(0.28);
    }
    // lights down; they huddle
    tint(vt, 'brightness(0.3)', 1.5);
    gsap.to(R, { x: -16, scaleY: 0.92, duration: 0.2 });
    gsap.to(L, { x: 10, duration: 0.2 });
    MB.audio.sfx('heartbeat');
    await wait(0.5);
    const g = V.billboard('ghost-rise', '👻', T.x + d.x * 40, T.y + d.y * 40 - 20);
    g.body.style.setProperty('--c', '#b07cff');
    gsap.set(g.body, { y: -top, scale: 0.2, opacity: 0 });
    MB.audio.sfx('dark');
    await gsap.to(g.body, { y: -hT * 1.2, scale: 1.4, opacity: 0.95, duration: 0.35, ease: 'power3.in' });
    impact(); hit(V, t, '#9fe8ff', true); MB.audio.sfx('frost'); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    tint(vt, 'brightness(1.6) saturate(0.2) hue-rotate(180deg)', 1);
    decal(V, T, 'frost', '#9fe8ff', 1);
    const boo = V.billboard('float-text boo', 'BOO!', T.x, T.y);
    gsap.set(boo.body, { y: -hT * 2 - 60 });
    gsap.timeline({ onComplete: () => boo.remove() }).fromTo(boo.body, { scale: 0.2 }, { scale: 1.3, duration: 0.2, ease: 'back.out(3)' }).to(boo.body, { opacity: 0, duration: 0.3, delay: 0.5 });
    // the book snaps shut
    MB.audio.sfx('thud');
    gsap.to(book.body, { scaleX: 0.2, duration: 0.12, onComplete: () => { book.body.textContent = '📕'; gsap.to(book.body, { scaleX: 1, duration: 0.12 }); } });
    gsap.to(g.body, { opacity: 0, y: '-=80', duration: 0.5, delay: 0.3, onComplete: () => g.remove() });
    scatter(V, T, hT, ['👻', '📖', '🕯️', '❄️'], 10, 160);
    pop(V, T, hT + 150, own(a, 'finish', 'Keep going... keep going~'), 'float-text debuff', 1.2);
    fadeOut(book, 0.8);
    await wait(0.4);
    gsap.to([L, R], { x: 0, scaleY: 1, duration: 0.3 });
    await wait(0.3);
    resetDuo(v);
  };

  // Villainess-chan & Daphne: the evil master plan, three steps pinned over the target. They laugh (very differently),
  // Daphne pulls the lever, the target drops through a trapdoor, and comes back up on a pillar of dark fire
  S.masterplan = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 50;
    const steps = ['STEP 1: Laugh', 'STEP 2: Trapdoor', 'STEP 3: ???'], notes = [];
    for (let i = 0; i < steps.length; i++) {
      const n = V.billboard('paper-word', steps[i], T.x + (i - 1) * 40, T.y);
      gsap.set(n.body, { y: -top - (2 - i) * 34, rotation: rnd(-6, 6) });
      gsap.fromTo(n.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
      notes.push(n);
      MB.audio.sfx('tick');
      await wait(0.18);
    }
    gsap.to(L, { y: -24, rotation: -6, duration: 0.1, yoyo: true, repeat: 5 });
    pop(V, sideOf(A, 0), H + 30, own(a, 'cry', 'OHOHOHO~!'), 'float-text baka', 1);
    MB.audio.sfx('laugh');
    await wait(0.45);
    pop(V, sideOf(A, 1), H + 30, '...Heh.', 'float-text debuff', 0.9);
    await wait(0.35);
    const lever = propAt(V, sideOf(A, 1), H * 0.5, '🕹️', 48);
    await gsap.to(lever.body, { rotation: 40, duration: 0.15, delay: 0.1 });
    MB.audio.sfx('clang');
    fadeOut(lever, 0.2);
    // the trapdoor
    const hole = V.flat('trapdoor', '', T.x, T.y);
    hole.style.setProperty('--c', c);
    gsap.fromTo(hole, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    MB.audio.sfx('whistleDown');
    if (vt) await gsap.to(vt.figure, { y: 140, opacity: 0, duration: 0.3, ease: 'power2.in' });
    await wait(0.35);
    notes[2].body.textContent = 'STEP 3: PROFIT';
    const outer = pillar(V, T, c), inner = pillar(V, T, '#1a0030');
    gsap.fromTo(outer.body, { scaleY: 0, scaleX: 1.8 }, { scaleY: 1.4, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(inner.body, { scaleY: 0 }, { scaleY: 1.5, duration: 0.25, delay: 0.05, ease: 'power2.out' });
    MB.audio.sfx('dark');
    if (vt) await gsap.timeline().to(vt.figure, { y: -200, opacity: 1, duration: 0.25, ease: 'power2.out' }).to(vt.figure, { y: 0, duration: 0.3, ease: 'power2.in' });
    else await wait(0.3);
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(22); V.hitStop();
    squash(vt, 0.5);
    tint(vt, 'brightness(0.5) sepia(1) saturate(4) hue-rotate(230deg)', 0.9);
    notes.forEach((n) => { gsap.to(n.body, { color: '#ff7a1c', duration: 0.1 }); fadeOut(n, 0.4, 0.4); });
    scatter(V, T, hT, ['🖤', '🔥', '👑', '📜'], 12, 170);
    pop(V, T, hT + 160, own(a, 'finish', 'Evil prevails, desu~!'), 'float-text bond-name', 1.1);
    await wait(0.5);
    [outer, inner].forEach((p) => gsap.to(p.body, { opacity: 0, scaleX: 0.2, duration: 0.4, onComplete: () => p.remove() }));
    gsap.to(hole, { scale: 0, duration: 0.25, onComplete: () => hole.remove() });
    resetDuo(v);
  };

  // Mariko & Brizz: the check-up. A heart monitor over the target beeps along and flatlines, the beach medic shocks it
  // back (CLEAR!) and the nurse's giant syringe goes in. A clean bill of health
  const ECG = 'M0,55 L40,55 L50,25 L62,85 L72,55 L110,55 L120,15 L132,90 L142,55 L240,55';
  S.defib = async (V, a, t, impact) => {
    const { v, A, T, C, hT, c } = ctx(V, a, t), [L] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 30;
    pop(V, A, H + 30, own(a, 'cry', 'Say ahh~ ♥'), 'float-text heal', 0.9);
    const mon = V.billboard('ecg', `<svg viewBox="0 0 240 100" width="240" height="100" fill="none" stroke-width="5" stroke-linejoin="round"
      stroke-linecap="round"><path class="d" d="${ECG}"/></svg><b>♥ 72</b>`, T.x, T.y);
    gsap.set(mon.body, { y: -top, scale: 0 });
    await gsap.to(mon.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    const line = mon.body.querySelector('.d'), bpm = mon.body.querySelector('b');
    for (let i = 0; i < 2; i++) { MB.audio.sfx('heartbeat'); await draw([line], { duration: 0.45, ease: 'none' }); }
    // flatline
    line.setAttribute('d', 'M0,55 L240,55');
    bpm.textContent = '♥ 0';
    mon.body.classList.add('flat-line');
    draw([line], { duration: 0.4, ease: 'none' });
    pop(V, T, top + 70, 'BEEEEEP', 'float-text debuff', 0.8);
    MB.audio.sfx('beam');
    gsap.to(L, { rotation: -10, duration: 0.15, yoyo: true, repeat: 1 });
    await wait(0.45);
    pop(V, sideOf(A, 1), H + 40, 'CLEAR!', 'float-text shield', 0.8);
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.25, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    const pads = [-1, 1].map((s) => propAt(V, { x: T.x + s * 80, y: T.y }, hT, '⚡', 60));
    await Promise.all(pads.map((p, i) => gsap.to(p, { x: T.x + (i ? 18 : -18), duration: 0.12, ease: 'power3.in' })));
    impact(); hit(V, t, '#fff36a', true); MB.audio.sfx('zap'); MB.audio.sfx('thunder'); V.shake(18); V.hitStop();
    flash(V, T, hT, '#ffffff', 380);
    tint(vt, 'brightness(3) saturate(0)', 0.6);
    pads.forEach((p) => fadeOut(p, 0.1));
    // back to life (a little too much)
    line.setAttribute('d', 'M0,55 L30,55 L40,10 L52,95 L62,55 L90,55 L100,5 L112,98 L122,55 L150,55 L160,10 L172,95 L182,55 L240,55');
    mon.body.classList.remove('flat-line');
    bpm.textContent = '♥ 180';
    draw([line], { duration: 0.3, ease: 'none' });
    MB.audio.sfx('heartbeat');
    const syr = propAt(V, { x: T.x - 70, y: T.y }, hT + 40, '💉', 90);
    await gsap.to(syr, { x: T.x - 20, duration: 0.14, delay: 0.1, ease: 'power3.in' });
    MB.audio.sfx('stab'); ring(V, T, c, 1.2); burst(V, T, c, 10, { h: hT });
    fadeOut(syr, 0.3);
    scatter(V, T, hT, ['💊', '🩹', '💉', '🦈'], 10, 160);
    pop(V, T, hT + 160, own(a, 'finish', 'Perfectly healthy~!'), 'float-text heal', 1.1);
    fadeOut(mon, 0.6);
    await wait(0.4);
    resetDuo(v);
    await goHome(v, A);
  };

  // Rhiannon & Valse: Sunday school. They sing a hymn together, the notes gather over the target into the church
  // bell, and it comes down over it and tolls three times. Doves on the third
  S.churchbell = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 80, GOLD = '#ffe38a';
    pop(V, A, H + 30, own(a, 'cry', 'All together now~ ♪'), 'float-text heal', 1);
    MB.audio.sfx('choir');
    gsap.to([L, R], { y: -10, duration: 0.3, yoyo: true, repeat: 3, stagger: 0.15, ease: 'sine.inOut' });
    for (let i = 0; i < 8; i++) {
      const P0 = sideOf(A, i % 2), n = V.billboard('float-text note', MB.pick(['♪', '♫', '♩']), P0.x, P0.y);
      n.body.style.color = i % 2 ? GOLD : c;
      path(n, (k) => ({ ...arc(P0, T, H, top, 80)(k), r: Math.sin(k * 8) * 20 }), 0.6, 'sine.inOut').then(() => n.remove());
      await wait(0.08);
    }
    await wait(0.45);
    const bell = V.billboard('thrown spirit', '🔔', T.x, T.y);
    bell.body.style.setProperty('--c', GOLD);
    bell.body.style.fontSize = '190px';
    gsap.set(bell.body, { yPercent: -100, y: -top, transformOrigin: '50% 10%' });
    MB.audio.sfx('holy');
    await gsap.fromTo(bell.body, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    await gsap.to(bell.body, { y: 30, duration: 0.3, ease: 'power3.in' });
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('gong'); ring(V, T, GOLD, 1.6 + i * 0.5); V.shake(6 + i * 6);
      if (i === 2) { impact(); hit(V, t, GOLD, true); V.hitStop(); tint(vt, 'brightness(1.8) sepia(0.5)', 0.8); }
      pop(V, T, hT * 2 + 110 + i * 24, 'DONG!', 'float-text buff', 0.6);
      await gsap.fromTo(bell.body, { rotation: i % 2 ? 8 : -8 }, { rotation: 0, duration: 0.3, ease: 'elastic.out(1,0.3)' });
    }
    MB.audio.sfx('flutter');
    for (let i = 0; i < 5; i++) {
      const dv = V.billboard('thrown dove', '🕊️', T.x, T.y);
      gsap.set(dv.body, { y: -hT });
      gsap.to(dv, { x: T.x + rnd(-260, 260), y: T.y + rnd(-60, 60), duration: 1.2, ease: 'power1.out' });
      gsap.to(dv.body, { y: -rnd(300, 450), opacity: 0, duration: 1.2, onComplete: () => dv.remove() });
    }
    pop(V, T, hT + 170, own(a, 'finish', 'Bless you, dear.'), 'float-text heal', 1.1);
    await gsap.to(bell.body, { y: -top, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => bell.remove() });
    resetDuo(v);
  };

  // Peter & the Shogun: living history. The teacher unrolls the battle map under the target and calls out the date, the
  // archers of 1600 darken the sky, and the Shogun himself crosses the field in one cut. History, reenacted
  S.reenact = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, A, H + 30, own(a, 'cry', 'History is ALIVE, people!'), 'float-text buff', 1);
    const map = strip(V, { x: T.x - 170, y: T.y }, { x: T.x + 170, y: T.y }, 'battle-map', c);
    MB.audio.sfx('crinkle');
    gsap.to(L, { rotation: -8, y: -10, duration: 0.2, yoyo: true, repeat: 1 }); // points at it
    await wait(0.35);
    pop(V, T, hT * 2 + 80, '1600 · SEKIGAHARA', 'float-text buff', 1.1);
    MB.audio.sfx('gong');
    await wait(0.35);
    MB.audio.sfx('wind');
    for (let i = 0; i < 16; i++) {
      const P = { x: T.x + rnd(-150, 150), y: T.y + rnd(-50, 50) }, ar = V.billboard('arrow-fall', '', P.x - 200, P.y);
      gsap.set(ar.body, { y: -600, rotation: -18 });
      gsap.to(ar, { x: P.x, duration: 0.45, delay: i * 0.03, ease: 'none' });
      gsap.to(ar.body, { y: -30, duration: 0.45, delay: i * 0.03, ease: 'power1.in', onComplete: () => { i % 4 || MB.audio.sfx('stab'); fadeOut(ar, 0.5); } });
    }
    await wait(0.75);
    // the Shogun crosses the field
    const sh = standIn(V, v, R, sideOf(A, 1));
    MB.audio.sfx('unsheathe');
    pop(V, sideOf(A, 1), H + 40, 'Kneel.', 'float-text burn', 0.8);
    await gsap.to(sh.fl.body, { opacity: 0, duration: 0.12 });
    const B = { x: T.x + d.x * 130, y: T.y + d.y * 130 };
    gsap.set(sh.fl, { x: B.x, y: B.y });
    slashArc(V, T, -hT, c, -20);
    MB.audio.sfx('swish');
    await gsap.to(sh.fl.body, { opacity: 1, duration: 0.08 });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    squash(vt, 0.6);
    await wait(0.15);
    slashArc(V, T, -hT, '#ffffff', 60);
    MB.audio.sfx('swish');
    scatter(V, T, hT, ['🏯', '🎌', '🍂', '📜'], 12, 180);
    pop(V, T, hT + 160, own(a, 'finish', 'That one is on the test!'), 'float-text buff', 1.1);
    await wait(0.5);
    gsap.to(map, { opacity: 0, duration: 0.4, onComplete: () => map.remove() });
    await gsap.to(sh.fl.body, { opacity: 0, duration: 0.12 });
    sh.back();
    gsap.fromTo(R, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    await wait(0.15);
    resetDuo(v);
  };

  // Reina & Eira: clout chasers. A phone goes live over the target, the like counter runs away, both of them stream
  // hearts at it for the camera, and the comments decide: RATIO'D
  S.viral = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 40;
    pop(V, A, H + 30, own(a, 'cry', 'Hiii chat~! Say hi!'), 'float-text baka', 1);
    const ph = V.billboard('live-phone', '<em>● LIVE</em><b>0</b><small>likes</small>', T.x, T.y);
    ph.body.style.setProperty('--c', c);
    gsap.set(ph.body, { y: -top, scale: 0 });
    MB.audio.sfx('camera');
    await gsap.to(ph.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    const cnt = ph.body.querySelector('b'), n = { v: 0 };
    const fmt = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(Math.round(x)));
    gsap.to(n, { v: 1.2e6, duration: 1.6, ease: 'power2.in', onUpdate: () => { cnt.textContent = fmt(n.v); } });
    gsap.to([L, R], { y: -18, duration: 0.14, yoyo: true, repeat: 9, stagger: 0.07 }); // posing
    for (let i = 0; i < 14; i++) {
      const who = i % 2, P0 = sideOf(A, who), h = V.billboard('thrown', MB.pick(who ? ['💅', '✨', '👍'] : ['❤️', '💖', '👍']), P0.x, P0.y);
      h.body.style.fontSize = '36px';
      path(h, arc(P0, { x: T.x + rnd(-30, 30), y: T.y }, H * 0.7, hT * rnd(0.8, 1.6), rnd(60, 160)), 0.4, 'sine.in').then(() => {
        h.remove(); burst(V, T, c, 3, { h: hT }); i % 3 || MB.audio.sfx('pop');
      });
      await wait(0.08);
    }
    await wait(0.45);
    MB.audio.sfx('whoosh');
    await slamStamp(V, T, hT, "RATIO'D", c);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('camera'); V.shake(16); V.hitStop();
    squash(vt, 0.6);
    flash(V, T, hT, '#ffffff', 340);
    scatter(V, T, hT, ['❤️', '👍', '💬', '📸', '✨'], 14, 190);
    pop(V, T, hT + 160, own(a, 'finish', 'Like, duh! Subscribe~'), 'float-text baka', 1.1);
    fadeOut(ph, 0.6);
    await wait(0.4);
    resetDuo(v);
  };

  // Hime & Clara: the tsundere summit. They turn their backs on each other (hmph!), a heart floats up between them
  // anyway, they both panic, and the heart and the target get the same double slap. BAKA!
  S.bakaslap = async (V, a, t, impact) => {
    const { v, A, T, C, perp, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    await gsap.to([L, R], { scaleX: -1, duration: 0.15 }); // backs turned
    pop(V, sideOf(A, 0), H + 20, 'Hmph!', 'float-text baka', 0.7);
    MB.audio.sfx('squeak');
    await wait(0.25);
    pop(V, sideOf(A, 1), H + 20, 'Hmph!!', 'float-text baka', 0.7);
    MB.audio.sfx('squeak');
    await wait(0.3);
    const heart = propAt(V, A, H * 0.8, '💗', 60);
    MB.audio.sfx('heartbeat');
    await gsap.to(heart.body, { y: -H - 30, scale: 1.3, duration: 0.45, ease: 'sine.out' });
    gsap.to([L, R], { scaleX: 1, duration: 0.1 });
    pop(V, A, H + 90, own(a, 'cry', "I-IT'S NOT LIKE THAT!!"), 'float-text baka', 1);
    MB.audio.sfx('whoosh');
    path(heart, (k) => ({ ...arc(A, T, H + 30, hT, 40)(k), r: k * 360, s: 1.3 }), 0.35, 'power1.in').then(() => { MB.AttackArt.setText(heart.body, '💔'); fadeOut(heart, 0.3); });
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    // the double slap
    const hands = [-1, 1].map((s) => {
      const h = V.billboard('thrown big-hand', '✋', T.x + perp.x * s * 160, T.y + perp.y * s * 160);
      h.body.style.setProperty('--c', c);
      gsap.set(h.body, { y: -hT, scaleX: s });
      return h;
    });
    MB.audio.sfx('swish');
    await Promise.all(hands.map((h) => gsap.to(h, { x: T.x, y: T.y, duration: 0.12, ease: 'power4.in' })));
    impact(); hit(V, t, c, true); MB.audio.sfx('slap'); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    tint(vt, 'sepia(1) saturate(5) hue-rotate(-50deg)', 0.8);
    squash(vt, 0.65);
    pop(V, { x: T.x - 60, y: T.y }, hT * 2 + 60, 'BAKA!!', 'float-text baka', 0.9);
    pop(V, { x: T.x + 60, y: T.y }, hT * 2 + 100, 'BAKA!!', 'float-text baka', 0.9);
    hands.forEach((h) => fadeOut(h, 0.2));
    scatter(V, T, hT, ['💢', '💗', '💔', '✨'], 12, 170);
    pop(V, T, hT + 160, own(a, 'finish', "D-don't get the wrong idea!"), 'float-text baka', 1.1);
    await wait(0.3);
    resetDuo(v);
    await goHome(v, A);
  };

  // Borcolls & Mai: a price war between two stalls. Tags over the target undercut each other all the way down to FREE,
  // and both stalls dump their stock on it at once: fruit, dango and one very large watermelon
  S.pricewar = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 50;
    const prices = ['¥500', '¥300!', '¥100!!', '¥1!!!', 'FREE!!!!'];
    for (let i = 0; i < prices.length; i++) {
      const who = i % 2, tag = V.billboard('price-tag', prices[i], T.x + (who ? 50 : -50), T.y);
      gsap.fromTo(who ? R : L, { y: -22 }, { y: 0, duration: 0.25, ease: 'power2.in' });
      gsap.set(tag.body, { y: -top - i * 12, rotation: who ? 8 : -8 });
      gsap.fromTo(tag.body, { scale: 0 }, { scale: 1 + i * 0.1, duration: 0.2, ease: 'back.out(3)' });
      fadeOut(tag, 0.4, 0.2);
      MB.audio.sfx(i === prices.length - 1 ? 'coin' : 'tick');
      await wait(0.3);
    }
    pop(V, A, H + 40, own(a, 'cry', 'EVERYTHING MUST GO!'), 'float-text buff', 0.9);
    MB.audio.sfx('incoming');
    for (let i = 0; i < 22; i++) {
      const b = V.billboard('petal', MB.pick(i % 2 ? ['🍡', '🍡', '🍵'] : ['🍎', '🍊', '🍍', '🍇']), T.x + rnd(-110, 110), T.y + rnd(-35, 35));
      b.body.style.fontSize = rnd(34, 50) + 'px';
      gsap.set(b.body, { y: -rnd(500, 750), rotation: rnd(-90, 90) });
      gsap.to(b.body, { y: -rnd(0, 30), rotation: `+=${rnd(-180, 180)}`, duration: rnd(0.45, 0.7), delay: i * 0.025, ease: 'power2.in', onComplete: () => {
        i % 5 || MB.audio.sfx('bonk'); toss(b, { v: [120, 260], dur: 0.6 });
      } });
    }
    await wait(0.6);
    const mel = V.billboard('thrown', '🍉', T.x, T.y);
    mel.body.style.fontSize = '150px';
    gsap.set(mel.body, { yPercent: -100, y: -800, transformOrigin: '50% 100%' });
    await gsap.to(mel.body, { y: 0, duration: 0.4, ease: EASE.drop });
    impact(); hit(V, t, '#ff4a5e', true); MB.audio.sfx('splat'); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    squash(vt, 0.5);
    for (let i = 0; i < 16; i++) { const s = dot(V, T, hT * 0.6, MB.pick(['#ff4a5e', '#3aa84a', '#1a1a1a']), rnd(7, 14)); toss(s, { v: [220, 480], dur: 0.8 }); }
    decal(V, T, 'splat', '#ff4a5e', 1);
    gsap.to(mel.body, { scaleY: 0.4, scaleX: 1.4, opacity: 0, duration: 0.35, onComplete: () => mel.remove() });
    slamStamp(V, T, hT * 2 + 40, 'SOLD OUT!', c, 0.8);
    pop(V, T, hT + 170, own(a, 'finish', 'Come again~!'), 'float-text buff', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Iroha & Suzu: the airhead alliance. A butterfly gets away from them, they chase it round and round the target (one
  // each way, question marks everywhere) and run into each other right on top of it. Bonk
  S.airheads = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), R0 = 160;
    const bf = propAt(V, A, H * 0.9, '🦋', 46);
    pop(V, A, H + 40, own(a, 'cry', 'Ooh~ a butterfly!'), 'float-text baka', 0.9);
    MB.audio.sfx('flutter');
    const runs = [L, R].map((im, i) => standIn(V, v, im, sideOf(A, i)));
    gsap.to(bf, { x: T.x, y: T.y, duration: 0.5, ease: 'sine.inOut' });
    gsap.to(bf.body, { y: -hT * 2 - 40, duration: 0.5 });
    const legs = runs.map((r) => gsap.to(r.fl.body, { y: -14, duration: 0.08, yoyo: true, repeat: -1 }));
    MB.audio.sfx('zip');
    await Promise.all(runs.map((r, i) => gsap.to(r.fl, { x: T.x + (i ? R0 : -R0) + 10 * (i ? 1 : -1), y: T.y, duration: 0.45, ease: 'power1.inOut' })));
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1.6, ease: 'sine.inOut', onUpdate: () => {
      const ang = q.k * Math.PI * 4, rr = R0 * (1 - q.k * 0.85) + 10;
      runs.forEach((r, i) => { const an = i ? -ang : ang + Math.PI; gsap.set(r.fl, { x: T.x + Math.cos(an) * rr, y: T.y + Math.sin(an) * rr * 0.4 }); });
      gsap.set(bf, { x: T.x + Math.cos(ang * 1.3) * 90, y: T.y + Math.sin(ang * 1.3) * 30 });
      if (Math.random() < 0.06) pop(V, { x: T.x + rnd(-120, 120), y: T.y }, hT * 2 + rnd(0, 60), '?', 'float-text buff', 0.5);
    } });
    legs.forEach((l) => l.kill());
    await Promise.all(runs.map((r, i) => gsap.to(r.fl, { x: T.x + (i ? 14 : -14), y: T.y, duration: 0.08, ease: 'power3.in' })));
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); MB.audio.sfx('boing'); V.shake(14); V.hitStop();
    squash(vt, 0.55);
    runs.forEach((r, i) => {
      gsap.to(r.fl, { x: T.x + (i ? 80 : -80), duration: 0.25 });
      gsap.to(r.fl.body, { rotation: i ? 18 : -18, scaleY: 0.85, y: 0, duration: 0.3, ease: 'bounce.out' });
    });
    dizzy(V, T, hT * 2 + 30, ['💫', '⭐', '❓'], 1.4, 3);
    gsap.to(bf, { x: T.x + 200, y: T.y - 150, duration: 1 });
    gsap.to(bf.body, { y: -hT * 3 - 80, opacity: 0, duration: 1, onComplete: () => bf.remove() });
    pop(V, T, hT + 160, own(a, 'finish', 'Wait... what were we doing?'), 'float-text baka', 1.2);
    await wait(0.9);
    await Promise.all(runs.map((r, i) => Promise.all([
      gsap.to(r.fl, { x: sideOf(A, i).x, y: A.y, duration: 0.45, ease: 'power2.inOut' }),
      gsap.to(r.fl.body, { rotation: 0, scaleY: 1, duration: 0.3 }),
    ])));
    runs.forEach((r) => r.back());
    resetDuo(v);
  };

  // Ben & Brutio: gym bros. They bench the barbell together for reps, counting, add more plates than is reasonable,
  // and throw the whole bar on the target. Then they flex
  S.spotme = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    const bar = V.billboard('barbell', '<i></i><i></i><i></i><i></i>', A.x, A.y);
    gsap.set(bar.body, { y: -H * 0.9, scale: 0 });
    await gsap.to(bar.body, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    pop(V, A, H + 60, own(a, 'cry', 'SPOT ME, BRO!'), 'float-text buff', 0.9);
    for (let i = 0; i < 3; i++) {
      gsap.fromTo([L, R], { scaleY: 0.94 }, { scaleY: 1, duration: 0.2 }); // they strain
      await gsap.to(bar.body, { y: -H - 40, duration: 0.18, ease: 'power2.out' });
      pop(V, sideOf(A, i % 2), H + 20, `${i + 1}!`, 'float-text buff', 0.5);
      MB.audio.sfx('buff');
      await gsap.to(bar.body, { y: -H * 0.9, duration: 0.2, ease: 'power2.in' });
      MB.audio.sfx('thud');
    }
    bar.body.classList.add('heavy');
    MB.audio.sfx('clang');
    pop(V, A, H + 100, 'MORE PLATES!', 'float-text burn', 0.8);
    await gsap.to(bar.body, { scale: 1.4, duration: 0.2, ease: 'back.out(3)' });
    MB.audio.sfx('whoosh');
    gsap.to([L, R], { y: -30, duration: 0.15, yoyo: true, repeat: 1 });
    await path(bar, (k) => ({ ...arc(A, T, H * 0.9, hT * 0.4, 260)(k), r: k * 360, s: 1.4 }), 0.6, 'sine.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(26); V.hitStop();
    squash(vt, 0.45);
    cracks(V, T, '#2a1a0a', { n: 8, len: 170, w: 6 });
    debris(V, T, '#8a7a6a', 10, { spread: 190 });
    fadeOut(bar, 0.5, 0.3);
    // the flex
    MB.audio.sfx('sparkle');
    gsap.to([L, R], { scaleX: 1.12, scaleY: 1.04, duration: 0.2, yoyo: true, repeat: 3 });
    [0, 1].forEach((i) => pop(V, sideOf(A, i), H + 20, '💪', 'thrown', 1));
    rise(V, A, '#ffe38a', 10, H);
    pop(V, T, hT + 160, own(a, 'finish', 'Never skip arm day.'), 'float-text buff', 1.1);
    await wait(0.8);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- cross-novel duo styles: the one-girl novels
  // Anna & Nala: spring cleaning. Nala scrubs (bubbles, a feather duster, dust everywhere), then Anna drops a
  // tablecloth over the target and Nala yanks it off like a magic trick. Spotless
  S.spotless = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Spring cleaning. NOW.'), 'float-text buff', 1);
    await gsap.to(L, { rotation: -10, duration: 0.12, yoyo: true, repeat: 1 }); // points
    const bucket = propAt(V, sideOf(A, 1), H * 0.35, '🪣', 54);
    MB.audio.sfx('splash');
    const bubbles = [];
    for (let i = 0; i < 10; i++) {
      const b = V.billboard('thrown', '🫧', sideOf(A, 1).x, A.y);
      b.body.style.fontSize = rnd(26, 44) + 'px';
      gsap.set(b.body, { y: -H * 0.4 });
      bubbles.push(b);
      gsap.to(b, { x: T.x + rnd(-110, 110), y: T.y + rnd(-40, 40), duration: rnd(0.5, 0.8), delay: i * 0.04, ease: 'sine.out' });
      gsap.to(b.body, { y: -hT * rnd(0.6, 2.2), duration: rnd(0.5, 0.8), delay: i * 0.04, ease: 'sine.out' });
    }
    await wait(0.6);
    // the duster: four swipes, a cloud of dust each
    const duster = propAt(V, T, hT * 1.3, '🪶', 70);
    for (let i = 0; i < 4; i++) {
      MB.audio.sfx('swish');
      gsap.fromTo(R, { x: 0 }, { x: i % 2 ? -8 : 8, duration: 0.07, yoyo: true, repeat: 1 });
      gsap.to(duster.body, { rotation: i % 2 ? -30 : 30, duration: 0.14 });
      await gsap.to(duster, { x: T.x + (i % 2 ? -90 : 90), duration: 0.14, ease: 'power1.inOut' });
      puff(V, { x: T.x + (i % 2 ? -60 : 60), y: T.y }, '#cfc6b8', 4, hT, 0.7);
    }
    fadeOut(duster, 0.1);
    bubbles.forEach((b, i) => gsap.to(b.body, { scale: 1.6, opacity: 0, duration: 0.2, delay: i * 0.03, onComplete: () => b.remove() }));
    MB.audio.sfx('pop');
    // the tablecloth trick
    pop(V, sideOf(A, 0), H + 40, 'Watch closely.', 'float-text ability', 0.8);
    const cloth = V.billboard('maid-cloth', '', T.x, T.y);
    cloth.body.style.setProperty('--c', c);
    gsap.set(cloth.body, { y: -hT * 2 - 260, rotation: -8, scaleY: 0.4 });
    MB.audio.sfx('whoosh');
    await gsap.to(cloth.body, { y: -hT, scaleY: 1, rotation: 0, duration: 0.35, ease: 'power2.in' });
    MB.audio.sfx('drumroll');
    await wait(0.6);
    gsap.fromTo(R, { x: 0 }, { x: 18, duration: 0.1, yoyo: true, repeat: 1 }); // the yank
    MB.audio.sfx('rip');
    gsap.to(cloth, { x: T.x + 520, duration: 0.3, ease: 'power3.in' });
    gsap.to(cloth.body, { rotation: 40, scaleX: 0.6, opacity: 0, duration: 0.3, ease: 'power3.in', onComplete: () => cloth.remove() });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    if (vt) gsap.fromTo(vt.figure, { rotationY: 0 }, { rotationY: 720, duration: 0.7, ease: 'power3.out', onComplete: () => gsap.set(vt.figure, { rotationY: 0 }) });
    scatter(V, T, hT, ['✨', '🫧', '🧽', '✨'], 14, 170);
    slamStamp(V, T, hT * 2 + 40, 'SPOTLESS!', c, 0.8);
    MB.audio.sfx('glint');
    fadeOut(bucket, 0.2);
    pop(V, T, hT + 170, own(a, 'finish', 'D-did I do good?'), 'float-text heal', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // Saya & Hina: Project HINA. The CTO projects a hologram idol over the target and it sings on loop; the real Hina
  // hates it, it glitches into static, and she throws the mic herself
  S.hologram = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Initiating Project HINA.'), 'float-text shield', 1);
    const lap = propAt(V, sideOf(A, 0), H * 0.45, '💻', 56);
    MB.audio.sfx('glitch');
    await wait(0.3);
    // a cone of light over the target, and the hologram rises in it
    const beam = V.billboard('holo-beam', '', T.x, T.y - 20);
    beam.body.style.setProperty('--c', c);
    gsap.set(beam.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    MB.audio.sfx('beam');
    await gsap.fromTo(beam.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3 });
    const holo = standIn(V, v, R, { x: T.x, y: T.y - 20 }, 'ghost clone runner holo');
    gsap.set(R, { opacity: 1 }); // the real one stays with Saya
    holo.fl.body.style.setProperty('--c', c);
    await gsap.fromTo(holo.fl.body, { scaleY: 0, opacity: 0 }, { scaleY: 1.2, scaleX: 1.2, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
    // it sings
    MB.audio.sfx('melody');
    for (let i = 0; i < 3; i++) {
      const w = soundwave(V, { x: T.x + (i % 2 ? 90 : -90), y: T.y }, c, i % 2 ? 1 : -1);
      gsap.set(w.body, { y: -hT * 1.6 });
      fadeOut(w, 0.3, 0.3);
      pop(V, { x: T.x + rnd(-90, 90), y: T.y }, hT * 2 + rnd(20, 80), MB.pick(['♪', '♫', '🎵']), 'float-text shield', 0.8);
      gsap.to(holo.fl.body, { rotation: i % 2 ? 6 : -6, duration: 0.15, yoyo: true, repeat: 1 });
      await wait(0.3);
    }
    pop(V, sideOf(A, 1), H + 40, "That's NOT me.", 'float-text burn', 0.9);
    gsap.to(R, { y: -14, duration: 0.1, yoyo: true, repeat: 1 });
    // static
    MB.audio.sfx('glitch');
    await gsap.to(holo.fl.body, { x: '+=14', skewX: 20, opacity: 0.35, duration: 0.05, yoyo: true, repeat: 7 });
    for (let i = 0; i < 16; i++) {
      const d = dot(V, { x: T.x + rnd(-60, 60), y: T.y }, hT * rnd(0.3, 2.4), MB.pick([c, '#ffffff', '#7af0ff']), rnd(6, 12), 'spark shard');
      toss(d, { v: [150, 380], dur: 0.7 });
    }
    holo.back();
    fadeOut(beam, 0, 0.2);
    // the mic
    MB.audio.sfx('whoosh');
    const mic = V.billboard('thrown', '🎤', sideOf(A, 1).x, A.y);
    mic.body.style.fontSize = '64px';
    await path(mic, (k) => ({ ...arc(sideOf(A, 1), T, H * 0.8, hT, 200)(k), r: k * 720, s: 1 }), 0.5, 'power1.in');
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('guitar'); V.shake(18); V.hitStop();
    squash(vt, 0.55);
    mic.remove();
    slamStamp(V, T, hT * 2 + 40, 'MIC DROP', c);
    scatter(V, T, hT, ['🎵', '💢', '⚡', '🎤'], 12, 180);
    fadeOut(lap, 0.2);
    pop(V, T, hT + 170, own(a, 'finish', 'Real ones only.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Amy & Saya: the intern's first presentation. A screen goes up over the target, Amy clicks through three slides
  // while the chart climbs, Saya stamps it APPROVED, and the arrow off the top of the chart comes down on the target
  S.keynote = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 70;
    const scr = V.billboard('keynote', '<em>Q1</em><div class="kn-bars"><i></i><i></i><i></i></div><small>BY AMY LYN, INTERN :3</small>', T.x, T.y);
    scr.body.style.setProperty('--c', c);
    gsap.set(scr.body, { y: -top, scale: 0 });
    MB.audio.sfx('pop');
    await gsap.to(scr.body, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Next slide, please! :3'), 'float-text baka', 1);
    const bars = [...scr.body.querySelectorAll('.kn-bars i')], label = scr.body.querySelector('em');
    for (let i = 0; i < 3; i++) {
      gsap.fromTo(L, { y: 0 }, { y: -14, duration: 0.1, yoyo: true, repeat: 1 }); // click
      MB.audio.sfx('click');
      label.textContent = ['Q1 😐', 'Q2 🙂', 'Q3 :3'][i];
      gsap.to(bars[i], { scaleY: [0.35, 0.65, 1][i], duration: 0.3, ease: 'back.out(2)' });
      await wait(0.4);
    }
    // off the chart
    const arrow = V.billboard('thrown', '📈', T.x, T.y);
    arrow.body.style.fontSize = '90px';
    gsap.set(arrow.body, { y: -top });
    MB.audio.sfx('riser');
    await gsap.to(arrow.body, { y: -top - 300, scale: 1.6, duration: 0.45, ease: 'power2.in' });
    gsap.fromTo(R, { y: 0 }, { y: -10, duration: 0.12, yoyo: true, repeat: 1 }); // Saya nods
    slamStamp(V, T, top, 'APPROVED', '#3fbf6a');
    MB.audio.sfx('thud');
    await wait(0.4);
    MB.audio.sfx('incoming');
    await gsap.to(arrow.body, { y: -hT * 0.5, rotation: 150, scale: 2.2, duration: 0.3, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(20); V.hitStop();
    squash(vt, 0.5);
    cracks(V, T, '#1a1a2a', { n: 7, len: 150, w: 6, glow: c });
    fadeOut(arrow, 0.1);
    gsap.to(scr.body, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.3, onComplete: () => scr.remove() });
    scatter(V, T, hT, ['📊', '📎', '💼', '✨'], 12, 180);
    pop(V, sideOf(A, 0), H + 20, '💖', 'thrown', 1);
    pop(V, T, hT + 170, own(a, 'finish', '...Good work, intern.'), 'float-text shield', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Amy & Maiko: a makeover. Outfit after outfit lands on the target (it spins into each one), and Amy finishes the
  // look with an accessory: a garlic necklace. The succubus panics, and the look goes off in a green cloud
  S.makeover = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Makeover time! :3'), 'float-text baka', 1);
    const looks = ['👗', '🎩', '👘', '👑'];
    for (let i = 0; i < looks.length; i++) {
      const who = i % 2, P0 = sideOf(A, who), o = V.billboard('thrown', looks[i], P0.x, P0.y);
      gsap.fromTo(who ? R : L, { rotation: 0 }, { rotation: who ? 12 : -12, duration: 0.1, yoyo: true, repeat: 1 });
      o.body.style.fontSize = '58px';
      MB.audio.sfx('whoosh');
      await path(o, (k) => ({ ...arc(P0, T, H * 0.7, hT * 1.1, 150)(k), r: k * 360, s: 1 }), 0.32, 'sine.in');
      o.remove();
      MB.audio.sfx('pop');
      if (vt) gsap.fromTo(vt.figure, { rotationY: 0 }, { rotationY: 360, duration: 0.3, ease: 'power2.out' });
      burst(V, T, c, 8, { h: hT });
      pop(V, T, hT * 2 + 50, ['Cute!', 'Classy!', 'Elegant~', 'ROYAL!'][i], 'float-text baka', 0.6);
      await wait(0.15);
    }
    // the finishing touch
    pop(V, sideOf(A, 0), H + 70, 'Accessorize! :3', 'float-text baka', 0.9);
    const g = V.billboard('thrown', '🧄', sideOf(A, 0).x, A.y);
    g.body.style.fontSize = '64px';
    MB.audio.sfx('twang');
    gsap.to(R, { x: 26, rotation: 14, duration: 0.12, yoyo: true, repeat: 3 });
    pop(V, sideOf(A, 1), H + 20, 'EEK! GARLIC!', 'float-text burn', 0.9);
    MB.audio.sfx('squeak');
    await path(g, (k) => ({ ...arc(sideOf(A, 0), T, H * 0.7, hT * 1.2, 180)(k), r: k * 540, s: 1 }), 0.45, 'sine.in');
    impact(); hit(V, t, '#9fdc5a', true); MB.audio.sfx('poof'); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    tint(vt, 'sepia(1) saturate(4) hue-rotate(40deg)', 0.9);
    puff(V, T, '#b8e07a', 14, hT, 1.4);
    squash(vt, 0.6);
    g.remove();
    scatter(V, T, hT, ['🧄', '💨', '🤢', '✨'], 12, 170);
    pop(V, T, hT + 170, own(a, 'finish', 'Stunning! ...and smelly.'), 'float-text baka', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Hina & Maiko: busking on a street corner. Maiko puts a hat down in front of the target, Hina sings for Grandma,
  // tips (coins and, this being a garlic town, garlic) pour in until it's full, and clumsy Maiko trips over it
  S.busking = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    const hat = V.billboard('thrown', '🎩', T.x, T.y + 40);
    hat.body.style.fontSize = '70px';
    gsap.set(hat.body, { y: -20, rotation: 180 });
    MB.audio.sfx('pop');
    gsap.fromTo(hat.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    pop(V, sideOf(A, 1), H + 30, 'Tips, p-please!', 'float-text ability', 0.9);
    await wait(0.4);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', "This one's for Grandma."), 'float-text burn', 1);
    const mic = propAt(V, sideOf(A, 0), H * 0.7, '🎤', 40);
    MB.audio.sfx('guitar');
    gsap.to(L, { y: -10, duration: 0.15, yoyo: true, repeat: 7 }); // headbanging
    for (let i = 0; i < 3; i++) {
      const w = soundwave(V, { x: sideOf(A, 0).x + sg * (60 + i * 40), y: A.y }, c, sg);
      gsap.set(w.body, { y: -H * 0.6 });
      fadeOut(w, 0.35, 0.3);
      await wait(0.12);
    }
    for (let i = 0; i < 16; i++) {
      const tip = V.billboard('petal', MB.pick(['🪙', '🪙', '💴', '🧄']), T.x + rnd(-40, 40), T.y + 40);
      tip.body.style.fontSize = rnd(28, 40) + 'px';
      gsap.set(tip.body, { y: -rnd(400, 600), rotation: rnd(-90, 90) });
      gsap.to(tip.body, { y: -30, rotation: '+=180', duration: rnd(0.4, 0.6), delay: i * 0.05, ease: 'power2.in', onComplete: () => { if (i % 3 === 0) MB.audio.sfx('coin'); tip.remove(); } });
    }
    await gsap.to(hat.body, { scale: 1.5, duration: 1.1, ease: 'power1.in' }); // it fills up
    // Maiko trips over it
    const run = standIn(V, v, R, sideOf(A, 1));
    MB.audio.sfx('zip');
    await gsap.to(run.fl, { x: T.x - sg * 70, y: T.y + 40, duration: 0.35, ease: 'power1.in' });
    MB.audio.sfx('squeak');
    pop(V, T, hT * 2 + 40, 'Waah—!', 'float-text baka', 0.7);
    gsap.to(run.fl.body, { rotation: sg * 70, duration: 0.2 });
    await gsap.to(hat.body, { y: -hT * 2 - 120, rotation: 360, duration: 0.3, ease: 'power2.out' });
    await gsap.to(hat.body, { y: -hT * 1.7, duration: 0.18, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    squash(vt, 0.55);
    MB.audio.sfx('coin');
    scatter(V, T, hT * 1.6, ['🪙', '💴', '🧄'], 16, 200);
    pop(V, T, hT + 170, own(a, 'finish', 'Tip your performers.'), 'float-text burn', 1.1);
    await wait(0.5);
    fadeOut(hat, 0.1); fadeOut(mic, 0.1);
    gsap.to(run.fl.body, { rotation: 0, duration: 0.3 });
    await gsap.to(run.fl, { x: sideOf(A, 1).x, y: A.y, duration: 0.4, ease: 'power2.inOut' });
    run.back();
    resetDuo(v);
  };

  // ---------------------------------------------------------------- signature styles: Academia Magicka
  // Beatrice: every waking moment she holds her mana down, and it makes her sick. She trembles in her chair, a seal
  // cracks open under the target and a column of holy light erupts through it. Then she has to hold it all in again
  S.manaseal = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Forgive me... just a little.'), 'float-text shield', 1.2);
    gsap.to(v.figure, { x: 3, duration: 0.05, yoyo: true, repeat: 13 });
    gsap.to(v.img, { filter: `drop-shadow(0 0 14px ${c}) brightness(1.3)`, duration: 0.5 });
    rise(V, A, '#fff6c8', 16, H);
    MB.audio.sfx('heartbeat');
    await wait(0.7);
    const seal = runeCircle(V, T, c, { size: 260 });
    MB.audio.sfx('rune');
    await wait(0.6);
    cracks(V, T, '#fffbe0', { n: 8, len: 130, w: 4, glow: c, hold: 1 });
    MB.audio.sfx('shatter');
    pop(V, T, hT * 2 + 30, 'CRACK', 'float-text shield', 0.6);
    await wait(0.25);
    const col = pillar(V, T, c);
    MB.audio.sfx('holy'); MB.audio.sfx('beam');
    gsap.fromTo(col.body, { scaleX: 0.1, scaleY: 0 }, { scaleX: 1.6, scaleY: 1.4, duration: 0.3, ease: 'power3.out' });
    impact(); hit(V, t, c, true); V.shake(20); V.hitStop();
    flash(V, T, hT, '#ffffff', 360);
    tint(tv, 'brightness(3) saturate(0)', 0.9);
    rise(V, T, c, 20, hT * 2);
    await wait(0.6);
    // and back in
    seal.remove();
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.35, onComplete: () => col.remove() });
    gsap.to(v.img, { filter: 'brightness(1)', duration: 0.4, clearProps: 'filter' });
    await gsap.to(v.figure, { scaleY: 0.94, duration: 0.2, yoyo: true, repeat: 1 });
    pop(V, A, H + 40, '*cough*', 'float-text hic', 0.8);
    pop(V, T, hT + 130, own(a, 'finish', 'I held back. Truly.'), 'float-text shield', 1.2);
    await wait(0.3);
  };

  // Irene: the chancellor only functions blackout drunk. A long swig, two hiccups, and a lazy point: spells of every
  // element (she knows all of them) open in a ring round the target, and one tipsy flick sets them all off at once
  const ELEMENTS = ['🔥', '❄️', '⚡', '🌪️', '🌑', '✨'];
  S.lastcall = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const bottle = propAt(V, { x: A.x + (d.x >= 0 ? 34 : -34), y: A.y }, H * 0.7, '🍾', 46);
    await gsap.to(bottle.body, { rotation: d.x >= 0 ? -120 : 120, duration: 0.3 });
    MB.audio.sfx('bubble');
    await wait(0.35);
    gsap.to(bottle.body, { rotation: 0, duration: 0.2 });
    for (let i = 0; i < 2; i++) {
      await gsap.to(v.figure, { y: -16, rotation: i ? 4 : -4, duration: 0.1, yoyo: true, repeat: 1 });
      pop(V, A, H + 40 + i * 25, 'hic~', 'float-text hic', 0.6);
    }
    pop(V, A, H + 95, own(a, 'cry', 'Class is in session~'), 'float-text debuff', 1.1);
    const spells = ELEMENTS.map((e, i) => {
      const ang = (i / ELEMENTS.length) * Math.PI * 2, b = V.billboard('thrown', e, T.x + Math.cos(ang) * 150, T.y + Math.sin(ang) * 60);
      b.body.style.fontSize = '48px';
      gsap.set(b.body, { y: -hT - 20 });
      gsap.fromTo(b.body, { scale: 0 }, { scale: 1, duration: 0.25, delay: i * 0.08, ease: 'back.out(3)' });
      gsap.delayedCall(i * 0.08, () => MB.audio.sfx('rune'));
      return b;
    });
    const seal = runeCircle(V, T, c, { size: 320 });
    await wait(0.8);
    // one lazy flick
    gsap.to(v.figure, { rotation: d.x >= 0 ? 8 : -8, duration: 0.12, yoyo: true, repeat: 1 });
    pop(V, A, H + 60, '...oops~', 'float-text hic', 0.8);
    MB.audio.sfx('whoosh');
    await Promise.all(spells.map((b) => Promise.all([gsap.to(b, { x: T.x, y: T.y, duration: 0.3, ease: 'power3.in' }),
      gsap.to(b.body, { y: -hT, scale: 1.4, duration: 0.3, ease: 'power3.in' })])));
    spells.forEach((b) => b.remove());
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('thunder'); V.shake(26); V.hitStop();
    ring(V, T, '#ffffff', 3, 0.7);
    flash(V, T, hT, '#ffffff', 420);
    RAINBOW.forEach((col, i) => gsap.delayedCall(i * 0.05, () => burst(V, T, col, 8, { h: hT, spread: 170 })));
    seal.remove();
    squash(tv, 0.5);
    await wait(0.4);
    fadeOut(bottle, 0.1);
    pop(V, T, hT + 130, own(a, 'finish', 'Was that instant death? Hic~'), 'float-text debuff', 1.3);
    await wait(0.4);
  };

  // Charlotte (Cine Type-8) needs everyone to be her friend. She beams, and a friend counter over the target ticks
  // up... and stops. "Not a friend." The smile doesn't move. Her sword does
  S.friendcount = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', "Let's be friends! ♪"), 'float-text baka', 1);
    const tag = V.billboard('friend-count', '<b>FRIENDS</b><em>0</em>', T.x, T.y), em = tag.body.querySelector('em');
    tag.body.style.setProperty('--c', c);
    gsap.set(tag.body, { y: -hT * 2 - 70 });
    gsap.fromTo(tag.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    for (let i = 1; i <= 8; i++) {
      em.textContent = i;
      MB.audio.sfx('tick');
      pop(V, { x: T.x + rnd(-120, 120), y: T.y + rnd(-30, 30) }, hT * 2 + rnd(0, 60), '#' + i, 'float-text baka', 0.5);
      await wait(0.08);
    }
    await wait(0.25);
    em.textContent = '✕';
    tag.body.classList.add('denied');
    MB.audio.sfx('glitch');
    pop(V, T, hT * 2 + 130, 'Not a friend.', 'float-text verdict', 0.9);
    gsap.to(v.img, { filter: 'saturate(0) brightness(1.1)', duration: 0.2 });
    await wait(0.45);
    MB.audio.sfx('unsheathe');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.18, ease: 'power4.in', onUpdate: () => ghost(V, v, c) });
    for (let i = 0; i < 3; i++) {
      slashArc(V, T, -hT, c, i * 60 - 60);
      MB.audio.sfx('swish');
      if (!i) { impact(); hit(V, t, c, true); V.hitStop(); } else burst(V, T, c, 8, { h: hT });
      await wait(0.1);
    }
    V.shake(14);
    fadeOut(tag, 0.2);
    gsap.to(v.img, { filter: 'none', duration: 0.3, clearProps: 'filter' });
    pop(V, T, hT + 130, own(a, 'finish', "Now we're friends! ♪"), 'float-text baka', 1.2);
    await goHome(v, A);
  };

  // Elyssa: a timid, pouty healer, until she sees evil. The lace glove comes off, the god's mark on her hand blazes,
  // her pout turns into a doting smile, and a hand of light as big as a house comes down. Then she's mortified
  S.divinemark = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), P = { x: A.x + d.x * 30, y: A.y };
    pop(V, A, H + 95, own(a, 'cry', "Hmph. I'm not doing anything..."), 'float-text hic', 1);
    await gsap.to(v.figure, { rotation: d.x >= 0 ? -5 : 5, duration: 0.2, yoyo: true, repeat: 1 }); // pout
    const glove = propAt(V, P, H * 0.5, '🧤', 36);
    await wait(0.2);
    toss(glove, { v: [300, 420], ang: [-120, -60], dur: 0.7 });
    const mark = propAt(V, P, H * 0.5, '✴️', 30);
    MB.audio.sfx('choir');
    await gsap.to(mark.body, { scale: 3, duration: 0.4, ease: 'power2.out' });
    gsap.to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.35)`, duration: 0.3 });
    pop(V, A, H + 70, 'Evil. Detected. ♡', 'float-text heal', 1);
    rise(V, A, '#ffe9a0', 18, H);
    await wait(0.4);
    const hand = V.billboard('thrown god-hand', '✋', T.x, T.y);
    hand.body.style.setProperty('--c', c);
    gsap.set(hand.body, { y: -hT * 2 - 500, rotation: 180 });
    MB.audio.sfx('holy');
    await gsap.to(hand.body, { y: -hT * 2 - 160, duration: 0.5, ease: 'power2.out' });
    await wait(0.25);
    MB.audio.sfx('incoming');
    await gsap.to(hand.body, { y: -hT * 1.2, duration: 0.18, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(26); V.hitStop();
    squash(tv, 0.45);
    cracks(V, T, '#3a2a10', { n: 10, len: 170, w: 6, glow: '#ffe9a0', hold: 1 });
    ring(V, T, '#fff6c8', 2.6, 0.7);
    scatter(V, T, hT, ['✨', '🪶', '♡'], 12, 170);
    await wait(0.4);
    fadeOut(hand, 0, 0.4); fadeOut(mark, 0);
    gsap.to(v.img, { filter: 'none', duration: 0.3, clearProps: 'filter' });
    pop(V, T, hT + 130, own(a, 'finish', 'Be blessed. ♡'), 'float-text heal', 1.1);
    await wait(0.3);
    pop(V, A, H + 40, 'W-wait, what did I do?!', 'float-text hic', 1);
    await wait(0.3);
  };

  // Hailey: spear, scythe, halberd. Her mind goes blank the moment she fights, so she can't explain what happens: a
  // whirl of polearms, three cuts in three styles, and she lands wondering why everyone is staring
  const POLEARMS = [['🔱', 'Spear!'], ['🌙', 'Scythe!'], ['🪓', 'Halberd!']];
  S.armory = async (V, a, t, impact) => {
    const { v, A, C, T, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Big sis is coming through~!'), 'float-text baka', 1);
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    for (let i = 0; i < 3; i++) {
      const [em, word] = POLEARMS[i], w = V.billboard('thrown polearm', em, T.x, T.y), sg = i % 2 ? -1 : 1;
      w.body.style.setProperty('--c', c);
      gsap.set(w.body, { y: -hT, scale: 0 });
      MB.audio.sfx('unsheathe');
      gsap.to(w.body, { scale: 1.6, rotation: sg * 540, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(v.figure, { rotationY: 0 }, { rotationY: sg * 360, duration: 0.3, ease: 'power2.inOut', onComplete: () => gsap.set(v.figure, { rotationY: 0 }) });
      await wait(0.22);
      slashArc(V, T, -hT, c, [-40, 50, 0][i]);
      MB.audio.sfx(i === 2 ? 'axe' : 'stab');
      if (!i) { impact(); hit(V, t, c, true); } else { burst(V, T, c, 10, { h: hT }); flash(V, T, hT, c, 160); }
      if (tv) gsap.fromTo(tv.figure, { x: perp.x * sg * 18 }, { x: 0, duration: 0.25 });
      pop(V, T, hT * 2 + 20 + i * 30, word, 'float-text burn', 0.6);
      fadeOut(w, 0.1, 0.2);
      await wait(0.12);
    }
    V.shake(18); V.hitStop();
    await gsap.to(v.figure, { y: -120, duration: 0.2, ease: 'power2.out' });
    await gsap.to(v.figure, { y: 0, duration: 0.18, ease: 'power3.in' });
    MB.audio.sfx('thud'); ring(V, here(v), c, 1.4);
    pop(V, here(v), H + 40, '...?', 'float-text hic', 0.7);
    pop(V, T, hT + 130, own(a, 'finish', 'Huh? What did I just do?'), 'float-text baka', 1.1);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- signature styles: Elina, Makin' Magic with Miku
  // Elina, the wizard teacher, gives a pop quiz. A chalkboard over the target asks the question, three answers are
  // marked wrong, and the right one is a heart-shaped fireball, with a wink
  S.extracredit = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = Math.min(255, hT + 130);
    pop(V, A, H + 95, own(a, 'cry', 'Pop quiz, dear~'), 'float-text debuff', 1);
    const book = propAt(V, A, H * 0.55, '📖', 44);
    MB.audio.sfx('crinkle');
    const board = V.billboard('chalkboard quiz', 'Q: Who is my<br>favourite student?', T.x, T.y);
    gsap.set(board.body, { y: -top });
    gsap.fromTo(board.body, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'back.out(2)' });
    await wait(0.5);
    for (let i = 0; i < 3; i++) {
      const P = { x: T.x + (i - 1) * 80, y: T.y };
      pop(V, P, top - 60, '✗', 'float-text verdict', 0.7);
      MB.audio.sfx('bonk');
      burst(V, P, '#ff4d5e', 6, { h: hT * 1.4, spread: 70 });
      if (tv) gsap.fromTo(tv.figure, { rotation: (i % 2 ? 1 : -1) * 8 }, { rotation: 0, duration: 0.2 });
      await wait(0.22);
    }
    pop(V, A, H + 60, '😉', 'thrown', 0.9);
    MB.audio.sfx('kiss');
    const fb = V.billboard('thrown', '💘', A.x, A.y);
    fb.body.style.fontSize = '64px';
    MB.audio.sfx('fire');
    await path(fb, (k) => ({ ...arc(A, T, H * 0.6, hT, 170)(k), r: k * 360, s: 1 + k * 0.6 }), 0.45, 'sine.in', (p) => {
      if (Math.random() < 0.5) { const s = dot(V, p, p.h, '#ff6a3d', 12); gsap.to(s.body, { opacity: 0, scale: 0.2, duration: 0.35, onComplete: () => s.remove() }); }
    });
    fb.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(16); V.hitStop();
    flameBurst(V, T, hT * 2);
    scatter(V, T, hT, ['💗', '🔥', '✨'], 12, 160);
    fadeOut(board, 0.2); fadeOut(book, 0.2);
    pop(V, T, hT + 130, own(a, 'finish', 'See me after class~'), 'float-text baka', 1.2);
    await wait(0.4);
  };

  // M-chan, the miku.gg mascot, is sick of being ignored and of low-effort novels. A comment pops up over the target
  // ("omg Hatsune Miku!!"), a vein throbs, and she reviews it: the stars drop one by one to a single star, LOW EFFORT
  // is stamped on it, and the whole review window comes down on its head
  S.critique = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = Math.min(255, hT + 130);
    const com = V.billboard('mb-comment', '<b>anon</b>omg Hatsune Miku!! 😍', T.x, T.y);
    gsap.set(com.body, { y: -top + 20 });
    MB.audio.sfx('pop');
    await gsap.fromTo(com.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    await wait(0.4);
    pop(V, A, H + 30, '💢', 'thrown', 0.9);
    gsap.to(v.figure, { x: 4, duration: 0.04, yoyo: true, repeat: 9 });
    MB.audio.sfx('stretch');
    pop(V, A, H + 95, own(a, 'cry', "It's M-CHAN. M. CHAN."), 'float-text debuff', 1.1);
    fadeOut(com, 0.3, 0.2);
    await wait(0.5);
    const rev = V.billboard('mb-review', '<small>REVIEW</small><em>★★★★★</em>', T.x, T.y), em = rev.body.querySelector('em');
    rev.body.style.setProperty('--c', c);
    gsap.set(rev.body, { y: -top });
    await gsap.fromTo(rev.body, { scale: 0, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(2)' });
    for (let i = 4; i >= 1; i--) { em.textContent = '★'.repeat(i) + '☆'.repeat(5 - i); MB.audio.sfx('tick'); await wait(0.14); }
    await wait(0.2);
    slamStamp(V, T, top - 10, 'LOW EFFORT', '#e8283c');
    MB.audio.sfx('thud'); V.shake(8);
    await wait(0.5);
    MB.audio.sfx('whistleDown');
    await gsap.to(rev.body, { y: -hT * 1.1, scale: 1.8, rotation: 12, duration: 0.25, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('bonk'); V.shake(22); V.hitStop();
    squash(tv, 0.5);
    scatter(V, T, hT, ['⭐', '💜', '📝', '💢'], 12, 180);
    fadeOut(rev, 0.25, 0.3);
    pop(V, T, hT + 130, own(a, 'finish', '1/5. Put in some effort.'), 'float-text debuff', 1.2);
    await wait(0.4);
  };

  // ---------------------------------------------------------------- signature styles: Cyber Delivery
  // Dani delivers. A countdown pops up over the target (thirty minutes or less), she floors it on her scooter, rings
  // the doorbell, and the pizza goes into its face at delivery speed. No tip, of course
  S.express = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    const clock = V.billboard('delivery-timer', '00:30', T.x, T.y);
    clock.body.style.setProperty('--c', c);
    gsap.set(clock.body, { y: -hT * 2 - 70 });
    gsap.fromTo(clock.body, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    pop(V, A, H + 95, own(a, 'cry', 'Thirty minutes or less!'), 'float-text burn', 1);
    const bike = propAt(V, A, 30, `<span style="display:inline-block; transform: scaleX(${-sg})">🛵</span>`, 80);
    MB.audio.sfx('honk');
    await wait(0.3);
    const q = { n: 30 };
    gsap.to(q, { n: 1, duration: 0.5, ease: 'power1.in', onUpdate: () => { clock.body.textContent = '00:' + String(Math.round(q.n)).padStart(2, '0'); } });
    MB.audio.sfx('zip');
    await Promise.all([
      gsap.to(v.el, { x: C.x, y: C.y, duration: 0.5, ease: 'power2.in', onUpdate: () => { ghost(V, v, c); if (Math.random() < 0.3) puff(V, here(v), '#bbbbbb', 1, 0, 0.5); } }),
      gsap.to(bike, { x: C.x, y: C.y, duration: 0.5, ease: 'power2.in' })]);
    MB.audio.sfx('ding');
    pop(V, T, hT * 2 + 20, '🔔 Ding-dong!', 'float-text hic', 0.7);
    await wait(0.3);
    const box = V.billboard('thrown', '🍕', C.x, C.y);
    gsap.set(box.body, { y: -H * 0.6 });
    MB.audio.sfx('whoosh');
    await gsap.to(box, { x: T.x, y: T.y, duration: 0.12, ease: 'power2.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('splat'); V.shake(16); V.hitStop();
    decal(V, T, 'splat', '#e8a23a');
    clock.body.textContent = 'ON TIME!';
    scatter(V, T, hT, ['🍕', '🧀', '🍅', '🌶️'], 12, 170);
    box.remove();
    await wait(0.3);
    pop(V, T, hT + 130, own(a, 'finish', 'No tip?! Cheapskate!'), 'float-text burn', 1.2);
    fadeOut(clock, 0.3);
    await Promise.all([goHome(v, A), gsap.to(bike, { x: A.x, y: A.y, duration: 0.45 })]);
    fadeOut(bike);
  };

  // red target brackets closing in on T (KAT-13, the enforcers, Hope's scanner eye); `label` sits under them
  function lockOn(V, T, hT, c, label) {
    const lock = V.billboard('lock-brackets', `<i></i><i></i><i></i><i></i><b>${label}</b>`, T.x, T.y);
    lock.body.style.setProperty('--c', c);
    gsap.set(lock.body, { y: -hT });
    gsap.fromTo(lock.body, { scale: 2.6, opacity: 0, rotation: 45 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: 'power3.out' });
    MB.audio.sfx('scope');
    return { lock, say: (s) => { lock.body.querySelector('b').textContent = s; } };
  }
  // n laser bolts from P (at height h0) to T, one after another; the first one to land calls impact
  async function lasers(V, t, P, h0, T, hT, c, n, impact, from) {
    for (let i = 0; i < n; i++) {
      const Q = from ? from(i) : { P, h0 }, s = dot(V, Q.P, Q.h0, c, 22, 'charge');
      path(s, (k) => ({ ...arc(Q.P, T, Q.h0, hT, 16)(k), s: 1 }), 0.15, 'none').then(() => {
        s.remove(); burst(V, T, c, 5, { h: hT, spread: 70 });
        if (i === 0) { impact(); hit(V, t, c, true); }
      });
      MB.audio.sfx('zap');
      await wait(0.07);
    }
    await wait(0.2);
  }

  // KAT-13: red brackets lock onto the target, the tone climbs, her shoulder cannon charges and aims on its own while
  // she tilts her head, and a stream of red bolts goes through it. Compliance is mandatory
  S.targetlock = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const lk = lockOn(V, T, hT, c, 'TARGET');
    for (let i = 0; i < 3; i++) { await wait(0.12); MB.audio.sfx('tick'); }
    pop(V, A, H + 95, own(a, 'cry', 'Compliance is mandatory.'), 'float-text burn', 1);
    lk.say('LOCKED');
    const M = { x: A.x + d.x * 20, y: A.y }, orb = dot(V, M, H * 0.85, c, 20, 'charge');
    MB.audio.sfx('riser');
    gsap.to(v.figure, { rotation: d.x >= 0 ? -6 : 6, duration: 0.3 }); // head tilt
    await gsap.to(orb.body, { width: 70, height: 70, duration: 0.5, ease: 'power1.in' });
    MB.audio.sfx('beam');
    await lasers(V, t, M, H * 0.85, T, hT, c, 7, impact);
    orb.remove();
    V.shake(16); V.hitStop();
    tint(tv, 'sepia(1) saturate(5) hue-rotate(-40deg)', 0.8);
    cracks(V, T, '#2a0a0a', { n: 6, len: 120, w: 4, glow: c });
    gsap.to(v.figure, { rotation: 0, duration: 0.2 });
    fadeOut(lk.lock, 0.2);
    pop(V, T, hT + 130, own(a, 'finish', 'Violation logged. Hehe.'), 'float-text burn', 1.1);
    await wait(0.4);
  };

  // a double helix (Seo Jin-tae), strands drawn in (class "d"), its rungs have class "rung"
  function helixSvg(c, h = 220) {
    let s1 = '', s2 = '', rungs = '';
    for (let i = 0; i <= 40; i++) {
      const k = i / 40, y = (k * h).toFixed(1), x1 = (60 + Math.sin(k * Math.PI * 4) * 44).toFixed(1), x2 = (60 - Math.sin(k * Math.PI * 4) * 44).toFixed(1);
      s1 += `${i ? ' L' : 'M'}${x1},${y}`; s2 += `${i ? ' L' : 'M'}${x2},${y}`;
      if (i % 4 === 2) rungs += `<line class="rung" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#ff3b6b" stroke-width="5"/>`;
    }
    return `<svg viewBox="0 0 120 ${h}" width="120" height="${h}" fill="none" stroke-linecap="round">${rungs}
      <path class="d" d="${s1}" stroke="${c}" stroke-width="7"/><path class="d" d="${s2}" stroke="#fff" stroke-width="7"/></svg>`;
  }
  // Seo Jin-tae sees people as data. He taps his bio-interface watch, a double helix unrolls over the target, he edits
  // it (rungs flip, genes are added), and the target mutates: wings, a stinger, too many eyes. Progress
  S.splice = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = hT * 2 + 40;
    pop(V, A, H + 95, own(a, 'cry', 'Hold still. This is progress.'), 'float-text shield', 1.1);
    const watch = propAt(V, A, H * 0.5, '⌚', 36);
    MB.audio.sfx('click'); MB.audio.sfx('beam');
    await wait(0.3);
    const hx = V.billboard('helix', helixSvg(c), T.x, T.y);
    gsap.set(hx.body, { y: -top });
    draw(hx.body.querySelectorAll('.d'), { duration: 0.6, stagger: 0.02 });
    const spin = gsap.to(hx.body, { rotationY: 360, duration: 1.6, repeat: -1, ease: 'none' });
    MB.audio.sfx('glitch');
    await wait(0.6);
    const rungs = [...hx.body.querySelectorAll('.rung')];
    for (let i = 0; i < 4; i++) {
      MB.audio.sfx('tick');
      gsap.fromTo(MB.pick(rungs), { stroke: '#ff3b6b' }, { stroke: '#7dffb0', duration: 0.2 });
      pop(V, { x: T.x + rnd(-60, 60), y: T.y }, top - rnd(40, 120), MB.pick(['A→T', 'G→C', '+WING', '+CLAW', 'DEL']), 'float-text code', 0.6);
      await wait(0.16);
    }
    impact(); hit(V, t, '#7dffb0', true); MB.audio.sfx('glitch'); MB.audio.sfx('chomp'); V.shake(14); V.hitStop();
    tint(tv, 'hue-rotate(110deg) saturate(2.4) contrast(1.3)', 1.2);
    ['🦋', '🦂', '👁️'].forEach((e, i) => gsap.delayedCall(i * 0.12, () => fadeOut(propAt(V, { x: T.x + (i - 1) * 60, y: T.y }, hT * (1.2 + (i % 2) * 0.6), e, 44), 0.6)));
    if (tv) gsap.fromTo(tv.figure, { scaleX: 1.2, scaleY: 0.85 }, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1,0.3)' });
    await wait(0.6);
    spin.kill(); fadeOut(hx); fadeOut(watch);
    pop(V, T, hT + 130, own(a, 'finish', 'Fascinating. Next subject.'), 'float-text shield', 1.1);
    await wait(0.4);
  };

  // Takeda: a hitman's mind in a faulty android body. His samurai proverb glitches halfway, he stutters, blinks through
  // the target in one stroke of the red blade... and a beat later the cut arrives, under the kanji burned into him: 罪
  const PROVERBS = ['Fall seven time, stand up ei—ERR', 'Nail that stick out... get... 404', 'Even monkey fall from tr-tr-tr—'];
  S.glitchblade = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', MB.pick(PROVERBS)), 'float-text code', 1.3);
    for (let i = 0; i < 4; i++) {
      gsap.set(v.figure, { x: rnd(-8, 8) });
      gsap.set(v.img, { filter: `drop-shadow(${rnd(-6, 6).toFixed(0)}px 0 0 #ff2a4a) drop-shadow(${rnd(-6, 6).toFixed(0)}px 0 0 #2af0ff)` });
      MB.audio.sfx('glitch');
      await wait(0.07);
    }
    gsap.set(v.figure, { x: 0 }); gsap.set(v.img, { clearProps: 'filter' });
    MB.audio.sfx('unsheathe');
    await wait(0.2);
    const E = { x: T.x + d.x * 120, y: T.y + d.y * 120 };
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: E.x, y: E.y, duration: 0.1, ease: 'none', onUpdate: () => ghost(V, v, c) });
    slashArc(V, T, -hT, c, d.x >= 0 ? 20 : -20);
    await wait(0.45); // the beat
    impact(); hit(V, t, c, true); MB.audio.sfx('stab'); V.shake(18); V.hitStop();
    tint(tv, 'drop-shadow(8px 0 0 #ff2a4a) drop-shadow(-8px 0 0 #2af0ff)', 0.7);
    pop(V, T, hT * 2 + 30, '罪', 'float-text kanji', 1.2);
    MB.audio.sfx('clang');
    pop(V, T, hT + 130, own(a, 'finish', 'Gomen. ...Or not.'), 'float-text code', 1.1);
    await wait(0.3);
    await goHome(v, A, 0.35);
  };

  // Lamina: the moth mother hovers, huge pale wings open behind her and a shimmer of dust drifts over the target. It
  // goes soft and dreamy, a thread of silk catches it, and one beat of her wings knocks it down
  S.mothdust = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const wings = V.billboard('moth-wings', '🦋', A.x, A.y - 5);
    wings.body.style.setProperty('--c', c);
    gsap.set(wings.body, { y: -H * 0.75 });
    MB.audio.sfx('flutter');
    gsap.fromTo(wings.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.85, duration: 0.4, ease: 'back.out(2)' });
    const flap = gsap.to(wings.body, { scaleX: 0.7, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await gsap.to(v.figure, { y: -40, duration: 0.4, ease: 'sine.out' });
    pop(V, A, H + 135, own(a, 'cry', 'Hush now, little one...'), 'float-text cute', 1.2);
    MB.audio.sfx('sparkle');
    for (let i = 0; i < 26; i++) {
      const s = dot(V, { x: A.x + rnd(-40, 40), y: A.y }, H * 0.8, MB.pick(['#fff6e0', c, '#ffd0f0']), rnd(5, 10), 'spark plus');
      path(s, (k) => ({ ...arc(A, T, H * 0.8, hT * rnd(0.8, 1.6), 120, rnd(-80, 80), perp)(k), s: 1 }), rnd(0.6, 0.9), 'sine.inOut').then(() => s.remove());
      await wait(0.02);
    }
    await wait(0.5);
    tint(tv, 'sepia(.4) saturate(2) hue-rotate(-30deg) brightness(1.2)', 1.6);
    if (tv) dizzy(V, T, hT * 2 + 10, ['💗', '✨'], 1.2);
    pop(V, T, hT * 2 + 60, '...so sleepy...', 'float-text cute', 0.9);
    const line = strip(V, A, T, 'yarn-line', '#fffaf0');
    MB.audio.sfx('stretch');
    await wait(0.35);
    flap.kill();
    MB.audio.sfx('wind');
    await gsap.to(wings.body, { scale: 1.5, duration: 0.2, ease: 'power3.out' });
    impact(); hit(V, t, c, true); V.shake(12); V.hitStop();
    puff(V, T, '#fff0f6', 8, hT, 1.1);
    if (tv) gsap.fromTo(tv.figure, { rotation: d.x >= 0 ? 16 : -16 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
    gsap.to(line, { opacity: 0, duration: 0.4, onComplete: () => line.remove() });
    fadeOut(wings, 0.2, 0.4);
    await gsap.to(v.figure, { y: 0, duration: 0.35 });
    pop(V, T, hT + 130, own(a, 'finish', 'Rest. You are safe with us.'), 'float-text cute', 1.2);
    await wait(0.3);
  };

  // A Biker Named Crash: he drops a jukebox, slams his mixtape in and the bass hits. He revs up, pops a wheelie... and
  // crashes straight into the target, bike and all. He meant to do that
  S.jukebox = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1, J = { x: A.x - sg * 70, y: A.y + 10 };
    const box = propAt(V, J, 40, '📻', 80);
    MB.audio.sfx('thud');
    const tape = propAt(V, A, H * 0.6, '📼', 40);
    await gsap.to(tape, { x: J.x, duration: 0.25 });
    await gsap.to(tape.body, { y: -60, scale: 0.4, duration: 0.15 });
    tape.remove();
    MB.audio.sfx('click'); MB.audio.sfx('guitar');
    pop(V, A, H + 95, own(a, 'cry', 'A BIKER. NAMED. CRASH!'), 'float-text burn', 1.1);
    const beat = gsap.to(box.body, { scale: 1.2, duration: 0.14, yoyo: true, repeat: -1 });
    for (let i = 0; i < 3; i++) {
      const w = soundwave(V, { x: J.x + sg * (50 + i * 40), y: J.y }, c, sg);
      gsap.set(w.body, { y: -60 });
      fadeOut(w, 0.3, 0.3);
      pop(V, { x: A.x + rnd(-60, 60), y: A.y }, H + rnd(0, 60), MB.pick(['♪', '♫']), 'float-text note', 0.7);
      await wait(0.15);
    }
    const bike = propAt(V, A, 30, `<span style="display:inline-block; transform: scaleX(${-sg})">🏍️</span>`, 90), E = { x: T.x - d.x * 40, y: T.y - d.y * 40 };
    MB.audio.sfx('honk');
    gsap.to(bike.body, { rotation: -sg * 25, duration: 0.2 }); // wheelie
    await wait(0.2);
    MB.audio.sfx('zip');
    await Promise.all([
      gsap.to(v.el, { x: E.x, y: E.y, duration: 0.4, ease: 'power2.in', onUpdate: () => { ghost(V, v, c); if (Math.random() < 0.4) puff(V, here(v), '#999999', 1, 0, 0.6); } }),
      gsap.to(bike, { x: E.x, y: E.y, duration: 0.4, ease: 'power2.in' })]);
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); MB.audio.sfx('slam'); V.shake(24); V.hitStop();
    flameBurst(V, T, hT * 2);
    debris(V, T, '#555555', 10, { spread: 180, chars: ['⚙️', '🔩', '💥'] });
    toss(bike, { v: [400, 600], ang: [-120, -60], dur: 0.9, spin: 720 });
    await gsap.to(v.figure, { rotation: sg * 90, duration: 0.2 }); // flat on his back
    pop(V, here(v), H * 0.5, own(a, 'finish', '...I meant to do that.'), 'float-text burn', 1.2);
    await wait(0.5);
    beat.kill(); fadeOut(box, 0.1);
    gsap.to(v.figure, { rotation: 0, duration: 0.25 });
    await goHome(v, A);
  };

  // Pedro: an ex-combat android running a diner. A cutting board lands under the target, the cleaver goes into a blur
  // of chops (onions, peppers, the target), and a sizzling pan comes down on top. ¡Buen provecho!
  S.cleaver = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Order up. Hold still, amigo.'), 'float-text burn', 1);
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in' });
    const board = V.flat('cutting-board', '', T.x, T.y + 10);
    gsap.fromTo(board, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    const knife = propAt(V, C, H * 0.7, '🔪', 60);
    for (let i = 0; i < 7; i++) {
      MB.audio.sfx('stab');
      gsap.fromTo(knife.body, { rotation: -40, y: -H * 0.8 }, { rotation: 30, y: -H * 0.45, duration: 0.07 });
      const bit = V.billboard('petal', MB.pick(['🧅', '🌶️', '🍅', '🥕', '🧄']), T.x + rnd(-50, 50), T.y);
      bit.body.style.fontSize = '30px';
      gsap.set(bit.body, { y: -hT * 0.6 });
      toss(bit, { v: [200, 380], dur: 0.6 });
      if (i === 3) { impact(); hit(V, t, c); }
      await wait(0.08);
    }
    fadeOut(knife);
    const pan = V.billboard('thrown', '🍳', T.x, T.y);
    pan.body.style.fontSize = '120px';
    gsap.set(pan.body, { y: -hT * 2 - 300, rotation: 180 });
    MB.audio.sfx('sizzle');
    await gsap.to(pan.body, { y: -hT * 1.3, duration: 0.3, ease: 'power3.in' });
    MB.audio.sfx('clang'); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    burst(V, T, c, 16, { h: hT }); puff(V, T, '#e8e8e8', 8, hT * 1.5, 1);
    squash(tv, 0.55);
    fadeOut(pan, 0.3);
    gsap.to(board, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: () => board.remove() });
    pop(V, T, hT + 130, own(a, 'finish', '¡Buen provecho!'), 'float-text burn', 1.1);
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- duo styles: Academia Magicka, Cyber Delivery
  // Howard & Hailey Grail, the siblings who used to tear up battlefields: he plants his shield, she runs up it, he
  // heaves, she vaults sky-high and comes down spear-first. Then he cries a little. He's so proud of her
  S.shieldvault = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Formation, like old times!'), 'float-text burn', 1);
    const shield = propAt(V, { x: A.x, y: A.y + 10 }, H * 0.35, '🛡️', 80);
    MB.audio.sfx('clang');
    await wait(0.3);
    const run = standIn(V, v, R, sideOf(A, 1));
    MB.audio.sfx('zip');
    await gsap.to(run.fl, { x: A.x, y: A.y, duration: 0.2, ease: 'power1.in' });
    gsap.fromTo(L, { y: 0 }, { y: -20, duration: 0.12, yoyo: true, repeat: 1 });
    MB.audio.sfx('boing');
    pop(V, sideOf(A, 1), H + 60, 'Hup!', 'float-text baka', 0.6);
    const up = H * 2.2;
    await path(run.fl, (k) => ({ ...arc(A, T, 0, up, up * 0.4)(k), r: k * 360 }), 0.55, 'power1.out');
    const spear = propAt(V, T, up + 40, '🔱', 70);
    gsap.set(spear.body, { rotation: 180 });
    await Promise.all([gsap.to(run.fl.body, { y: 0, rotation: 0, duration: 0.2, ease: 'power4.in' }), gsap.to(spear.body, { y: -hT, duration: 0.2, ease: 'power4.in' })]);
    impact(); hit(V, t, c, true); MB.audio.sfx('stab'); MB.audio.sfx('slam'); V.shake(26); V.hitStop();
    squash(vt, 0.45);
    cracks(V, T, '#2b1d12', { n: 9, len: 170, w: 6, glow: c });
    debris(V, T, '#c9b79c', 12, { spread: 190 });
    fadeOut(spear, 0.2);
    await wait(0.35);
    await gsap.to(run.fl, { x: sideOf(A, 1).x, y: A.y, duration: 0.4, ease: 'power2.inOut' });
    run.back();
    fadeOut(shield);
    pop(V, sideOf(A, 0), H + 30, '😭', 'thrown', 1);
    pop(V, T, hT + 170, own(a, 'finish', "She's all grown up! *sob*"), 'float-text burn', 1.1);
    await wait(0.4);
    resetDuo(v);
  };

  // Steel & Ruby, prince and princess of Azol: she cuts her palm and paints a blood sigil under the target, he calls the
  // desert wind; the wind catches the blood and turns into a red whirlwind that drinks the target's strength
  S.bloodwind = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), P1 = sideOf(A, 1);
    pop(V, P1, H + 40, own(a, 'cry', 'Blood. Price. Paid.'), 'float-text burn', 1);
    gsap.fromTo(R, { rotation: 0 }, { rotation: 6, duration: 0.12, yoyo: true, repeat: 1 });
    MB.audio.sfx('stab');
    for (let i = 0; i < 8; i++) {
      const dr = V.billboard('petal', '🩸', P1.x, P1.y);
      dr.body.style.fontSize = '22px';
      path(dr, (k) => ({ ...arc(P1, T, H * 0.5, 0, 120 + i * 10)(k), s: 1 }), 0.5, 'sine.in').then(() => dr.remove());
      await wait(0.04);
    }
    await wait(0.4);
    const seal = runeCircle(V, T, '#c0182a', { size: 280 });
    MB.audio.sfx('rune');
    await wait(0.4);
    pop(V, sideOf(A, 0), H + 60, 'Wind. Come.', 'float-text shield', 0.9);
    MB.audio.sfx('wind'); MB.audio.sfx('tornado');
    const q = { a: 0 }, motes = Array.from({ length: 18 }, (_, i) => {
      const m = V.billboard('petal', MB.pick(['🩸', '🍂', '💨']), T.x, T.y);
      m.body.style.fontSize = rnd(20, 34) + 'px';
      return { m, r: rnd(50, 120), h: (i / 18) * hT * 2.2 + 10, o: rnd(0, Math.PI * 2) };
    });
    await gsap.to(q, { a: Math.PI * 8, duration: 1, ease: 'power1.in', onUpdate: () => motes.forEach((o) => {
      const ang = q.a + o.o, rr = o.r * (1 - q.a / (Math.PI * 16));
      gsap.set(o.m, { x: T.x + Math.cos(ang) * rr, y: T.y + Math.sin(ang) * rr * 0.4 });
      gsap.set(o.m.body, { y: -o.h });
    }) });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    if (vt) gsap.fromTo(vt.figure, { rotationY: 0 }, { rotationY: 720, duration: 0.6, ease: 'power2.out', onComplete: () => gsap.set(vt.figure, { rotationY: 0 }) });
    tint(vt, 'grayscale(.8) brightness(.7)', 1);
    motes.forEach(({ m }) => toss(m, { v: [300, 500], dur: 0.7 }));
    rise(V, A, '#ff5a6a', 16, H); // the strength flows back to them
    MB.audio.sfx('heal');
    seal.remove();
    pop(V, T, hT + 170, own(a, 'finish', 'Azol. Remembers.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Beatrice & Jeffery: the loyal butler pushes his lady's wheelchair at a run, faster, faster... and lets go. She rolls
  // into the target with her light blazing, and he smiles a little too much. "My hand slipped, my lady."
  S.runaway = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), sg = d.x >= 0 ? 1 : -1;
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'Hold on tight, my lady.'), 'float-text shield', 1);
    const lady = standIn(V, v, L, sideOf(A, 0)), butler = standIn(V, v, R, sideOf(A, 1));
    await gsap.to(butler.fl, { x: sideOf(A, 0).x - sg * 60, duration: 0.25 });
    MB.audio.sfx('zip');
    const M = { x: lerp(A.x, T.x, 0.55), y: lerp(A.y, T.y, 0.55) };
    await Promise.all([
      gsap.to(lady.fl, { x: M.x, y: M.y, duration: 0.5, ease: 'power2.in', onUpdate: () => { if (Math.random() < 0.3) puff(V, here({ el: lady.fl }), '#dddddd', 1, 0, 0.5); } }),
      gsap.to(butler.fl, { x: M.x - sg * 60, y: M.y, duration: 0.5, ease: 'power2.in' })]);
    pop(V, M, H + 60, '...oops.', 'float-text debuff', 0.8);
    gsap.to(butler.fl, { x: M.x - sg * 20, duration: 0.2 });
    MB.audio.sfx('whistleDown');
    gsap.to(lady.fl.body, { filter: `drop-shadow(0 0 16px ${c}) brightness(1.4)`, duration: 0.2 });
    pop(V, M, H + 90, 'Jeffery?!', 'float-text shield', 0.7);
    await gsap.to(lady.fl, { x: T.x - d.x * 40, y: T.y - d.y * 40, duration: 0.25, ease: 'power1.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('holy'); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.4, scaleY: 1.2, duration: 0.25 });
    gsap.to(col.body, { opacity: 0, duration: 0.4, delay: 0.4, onComplete: () => col.remove() });
    squash(vt, 0.5);
    scatter(V, T, hT, ['✨', '🫖', '🌟'], 10, 160);
    pop(V, T, hT + 170, own(a, 'finish', 'My hand slipped, my lady.'), 'float-text debuff', 1.2);
    await wait(0.4);
    gsap.to(lady.fl.body, { filter: 'none', duration: 0.2 });
    await Promise.all([gsap.to(lady.fl, { x: sideOf(A, 0).x, y: A.y, duration: 0.45 }), gsap.to(butler.fl, { x: sideOf(A, 1).x, y: A.y, duration: 0.45 })]);
    lady.back(); butler.back();
    resetDuo(v);
  };

  // Lamina & Seo Jin-tae, who made her what she is: she spins a silk cocoon round the target, he injects it with his
  // serum, it pulses three times... and splits open in a storm of moth wings. His finest work, and her revenge
  S.metamorph = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), vt = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Let me show you what he made.'), 'float-text cute', 1.1);
    const line = strip(V, sideOf(A, 0), T, 'yarn-line', '#fffaf0');
    MB.audio.sfx('stretch');
    const coc = V.billboard('cocoon', '', T.x, T.y);
    gsap.set(coc.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    await gsap.fromTo(coc.body, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power1.inOut' });
    if (vt) gsap.to(vt.figure, { opacity: 0.2, duration: 0.3 });
    pop(V, sideOf(A, 1), H + 60, 'Beautiful. Hold still.', 'float-text shield', 0.9);
    const syr = V.billboard('thrown', '💉', sideOf(A, 1).x, A.y);
    syr.body.style.fontSize = '54px';
    MB.audio.sfx('whoosh');
    await path(syr, (k) => ({ ...arc(sideOf(A, 1), T, H * 0.6, hT, 140)(k), r: 225 + k * 360 }), 0.4, 'sine.in');
    MB.audio.sfx('stab'); syr.remove();
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('heartbeat');
      await gsap.fromTo(coc.body, { scale: 1 }, { scale: 1.15, duration: 0.12, yoyo: true, repeat: 1 });
      gsap.set(coc.body, { filter: `hue-rotate(${(i + 1) * 40}deg)` });
    }
    impact(); hit(V, t, c, true); MB.audio.sfx('poof'); MB.audio.sfx('flutter'); V.shake(18); V.hitStop();
    gsap.to(coc.body, { scaleX: 1.6, scaleY: 0.2, opacity: 0, duration: 0.3, onComplete: () => coc.remove() });
    if (vt) gsap.to(vt.figure, { opacity: 1, duration: 0.3, delay: 0.2 });
    scatter(V, T, hT, ['🦋', '🦋', '🤍', '✨'], 18, 220);
    puff(V, T, '#fff0f6', 10, hT, 1.2);
    tint(vt, 'hue-rotate(260deg) saturate(1.8)', 1);
    gsap.to(line, { opacity: 0, duration: 0.4, onComplete: () => line.remove() });
    pop(V, T, hT + 170, own(a, 'finish', 'My finest work... Yuna.'), 'float-text cute', 1.2);
    await wait(0.5);
    resetDuo(v);
  };

  // KAT-13 & STV-3, Valkyrie Corp's rival enforcers, racing to make the arrest: brackets lock on, B-0-B stomps in and
  // all three open fire. Both log the kill as theirs
  S.enforcers = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), vt = victim(V, t);
    const lk = lockOn(V, T, hT, c, 'SUSPECT');
    pop(V, sideOf(A, 1), H + 30, own(a, 'cry', 'MY arrest, KAT.'), 'float-text burn', 0.9);
    await wait(0.4);
    pop(V, sideOf(A, 0), H + 70, 'Cute. Mine.', 'float-text debuff', 0.9);
    const B = { x: lerp(A.x, T.x, 0.5), y: lerp(A.y, T.y, 0.5) + 70 }, bob = V.billboard('thrown', '🤖', B.x, B.y);
    bob.body.style.fontSize = '90px';
    gsap.set(bob.body, { y: -500 });
    MB.audio.sfx('incoming');
    await gsap.to(bob.body, { y: -40, duration: 0.3, ease: 'power3.in' });
    MB.audio.sfx('stomp'); V.shake(10); ring(V, B, c, 1.5);
    pop(V, B, 140, 'B-0-B ONLINE', 'float-text code', 0.8);
    await wait(0.2);
    await lasers(V, t, null, 0, T, hT, c, 9, impact, (i) => (i % 3 === 2 ? { P: B, h0: 60 } : { P: sideOf(A, i % 2), h0: H * 0.7 }));
    V.shake(16); V.hitStop();
    tint(vt, 'sepia(1) saturate(5) hue-rotate(-40deg)', 0.8);
    lk.say('NEUTRALIZED');
    pop(V, sideOf(A, 0), H + 40, 'KAT-13: +1', 'float-text code', 0.9);
    pop(V, sideOf(A, 1), H + 70, 'STV-3: +1!!', 'float-text code', 0.9);
    fadeOut(lk.lock, 0.5); fadeOut(bob, 0.5);
    pop(V, T, hT + 170, own(a, 'finish', 'Case closed. Twice.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Mel & Nikita: Mel builds something sensible out of scrap, Nikita "improves" it with neon stickers and a fat bass,
  // and the thing waddles over to the target and goes off like a disco grenade
  S.stickerbomb = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), P0 = { x: lerp(A.x, T.x, 0.25), y: lerp(A.y, T.y, 0.25) + 40 };
    pop(V, sideOf(A, 0), H + 30, own(a, 'cry', 'Scrap. Bolts. Done.'), 'float-text shield', 0.9);
    for (let i = 0; i < 4; i++) {
      const p = V.billboard('petal', MB.pick(['🔩', '⚙️', '🔧', '🔋']), A.x, A.y);
      p.body.style.fontSize = '30px';
      path(p, (k) => ({ ...arc(sideOf(A, 0), P0, H * 0.5, 30, 90)(k), r: k * 360 }), 0.3).then(() => p.remove());
      MB.audio.sfx('tink');
      await wait(0.08);
    }
    await wait(0.2);
    const bot = V.billboard('thrown', '🤖', P0.x, P0.y);
    bot.body.style.fontSize = '64px';
    gsap.set(bot.body, { y: -30 });
    gsap.fromTo(bot.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    await wait(0.3);
    pop(V, sideOf(A, 1), H + 60, 'Oi! Needs STICKERS!', 'float-text baka', 0.9);
    for (let i = 0; i < 5; i++) {
      const s = V.billboard('petal', MB.pick(['🌟', '💖', '💚', '⚡', '🌈']), A.x, A.y);
      s.body.style.fontSize = '26px';
      path(s, (k) => ({ ...arc(sideOf(A, 1), P0, H * 0.5, 40, 100)(k), r: k * 180 }), 0.28).then(() => s.remove());
      MB.audio.sfx('pop');
      await wait(0.07);
    }
    const hue = gsap.to(bot.body, { filter: 'hue-rotate(360deg) saturate(3)', duration: 0.5, repeat: -1, ease: 'none' });
    MB.audio.sfx('guitar');
    await path(bot, (k) => ({ x: lerp(P0.x, T.x, k), y: lerp(P0.y, T.y, k), h: 30 + Math.abs(Math.sin(k * Math.PI * 4)) * 30, r: Math.sin(k * Math.PI * 8) * 12 }), 0.7, 'none');
    pop(V, T, hT * 2 + 30, 'BEEP?', 'float-text code', 0.5);
    await wait(0.2);
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(20); V.hitStop();
    hue.kill(); bot.remove();
    RAINBOW.forEach((col, i) => gsap.delayedCall(i * 0.04, () => { burst(V, T, col, 8, { h: hT, spread: 180 }); ring(V, T, col, 1.4 + i * 0.3, 0.5); }));
    scatter(V, T, hT, ['🌟', '💖', '⚡', '🔩'], 14, 200);
    pop(V, sideOf(A, 0), H + 30, '...Seriously?', 'float-text shield', 0.9);
    pop(V, T, hT + 170, own(a, 'finish', 'Och, it WORKED!'), 'float-text baka', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Crash & Hope: he announces the plan through a megaphone (everyone is right there), charges, and trips over his own
  // boot. Hope, who scanned the target while he was yelling, steps over him and lands the one punch that counts
  S.bikergang = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), vt = victim(V, t), sg = d.x >= 0 ? 1 : -1;
    const mega = propAt(V, sideOf(A, 0), H * 0.75, '📢', 50);
    MB.audio.sfx('megaphone');
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'THE PLAN: WE HIT IT!!'), 'float-text burn', 1.1);
    for (let i = 0; i < 2; i++) {
      const w = soundwave(V, { x: sideOf(A, 0).x + sg * (60 + i * 40), y: A.y }, c, sg);
      gsap.set(w.body, { y: -H * 0.75 });
      fadeOut(w, 0.3, 0.3);
      await wait(0.1);
    }
    const lk = lockOn(V, T, hT, '#ff3b4e', 'WEAK SPOT');
    fadeOut(mega, 0.2);
    const crash = standIn(V, v, L, sideOf(A, 0)), M = { x: lerp(A.x, T.x, 0.55), y: lerp(A.y, T.y, 0.55) };
    MB.audio.sfx('zip');
    await gsap.to(crash.fl, { x: M.x, y: M.y, duration: 0.3, ease: 'power2.in' });
    MB.audio.sfx('squeak'); MB.audio.sfx('thud');
    await gsap.to(crash.fl.body, { rotation: sg * 90, duration: 0.15 });
    pop(V, M, H * 0.6, 'OOF!', 'float-text burn', 0.6); V.shake(6);
    const hope = standIn(V, v, R, sideOf(A, 1));
    await gsap.to(hope.fl, { x: C.x, y: C.y, duration: 0.35, ease: 'power2.inOut' });
    pop(V, C, H + 40, 'Idiot.', 'float-text shield', 0.7);
    await gsap.to(hope.fl.body, { x: sg * 30, duration: 0.08 });
    impact(); hit(V, t, c, true); MB.audio.sfx('punch'); MB.audio.sfx('pow'); V.shake(20); V.hitStop();
    squash(vt, 0.5); fadeOut(lk.lock, 0.1);
    pop(V, T, hT + 170, own(a, 'finish', "Told ya the plan'd work!"), 'float-text burn', 1.1);
    await wait(0.4);
    gsap.set(hope.fl.body, { x: 0 }); gsap.set(crash.fl.body, { rotation: 0 });
    await Promise.all([gsap.to(crash.fl, { x: sideOf(A, 0).x, y: A.y, duration: 0.4 }), gsap.to(hope.fl, { x: sideOf(A, 1).x, y: A.y, duration: 0.4 })]);
    crash.back(); hope.back();
    resetDuo(v);
  };

  // M-chan & Monika, the two who know they're in a game: a visual-novel text box opens over the target, M-chan
  // red-pens its line (LOW EFFORT), and Monika opens the console and deletes its character file
  S.fourthwall = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), v = V.ents.get(a.uid), H = V.heightOf(a), vt = victim(V, t), top = hT * 2 + 80;
    const who = String(t.name || (t.card && t.card.name) || '???').replace(/[<>&]/g, '');
    const box = V.billboard('fx-vn-box', `<b>${who}</b><span>...</span>`, T.x, T.y), span = box.body.querySelector('span');
    gsap.set(box.body, { y: -top });
    await gsap.fromTo(box.body, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.out' });
    const line = 'I will defeat you, because... reasons!';
    for (let i = 1; i <= line.length; i += 3) { span.textContent = line.slice(0, i); if (i % 6 === 1) MB.audio.sfx('tick'); await wait(0.03); }
    span.textContent = line;
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Who wrote this? Rewrite.'), 'float-text debuff', 1);
    const pen = propAt(V, T, top + 10, '🖍️', 44);
    MB.audio.sfx('swish');
    span.classList.add('struck');
    await gsap.fromTo(pen, { x: T.x - 120 }, { x: T.x + 120, duration: 0.35 });
    fadeOut(pen);
    slamStamp(V, T, top + 40, 'LOW EFFORT', '#e8283c', 0.6);
    MB.audio.sfx('thud');
    await wait(0.5);
    pop(V, sideOf(A, 1), H + 70, "I'll handle it~", 'float-text heal', 0.9);
    const con = V.billboard('mb-console', `&gt; rm ${fileOf(t)}`, T.x, T.y);
    gsap.set(con.body, { y: -top - 110 });
    gsap.fromTo(con.body, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    MB.audio.sfx('click');
    await wait(0.5);
    impact(); hit(V, t, c, true); MB.audio.sfx('glitch'); MB.audio.sfx('boom'); V.shake(20); V.hitStop();
    tint(vt, 'invert(1) hue-rotate(90deg)', 0.6);
    if (vt) gsap.fromTo(vt.figure, { x: -14 }, { x: 0, duration: 0.4, ease: 'steps(6)' });
    gsap.to(box.body, { scaleY: 0, opacity: 0, duration: 0.25, delay: 0.1, onComplete: () => box.remove() });
    fadeOut(con, 0.4);
    scatter(V, T, hT, ['💚', '💜', '📝', '⭐'], 12, 180);
    pop(V, T, hT + 170, own(a, 'finish', 'Just us. The real writers.'), 'float-text heal', 1.1);
    await wait(0.4);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- Cries behind Snowfall, Kumi, Nanami Hana, Sugar & Sweethearts
  // snowflakes drifting down round P for a moment (the blizzard over the Spur lodge)
  function snowfall(V, P, n = 26, h = 320, spread = 260) {
    for (let i = 0; i < n; i++) {
      const s = dot(V, { x: P.x + rnd(-spread, spread), y: P.y + rnd(-60, 60) }, h + rnd(0, 120), '#ffffff', rnd(5, 11), 'spark');
      gsap.to(s, { x: `+=${rnd(-60, 20)}`, duration: 1.8, ease: 'sine.inOut' });
      gsap.to(s.body, { y: -rnd(0, 30), opacity: 0, duration: rnd(1.3, 2), delay: i * 0.03, ease: 'none', onComplete: () => s.remove() });
    }
  }
  // a kyudo arrow pointing right (turned along its flight by along())
  const arrowSvg = (c) => `<svg viewBox="0 0 110 24" width="110" height="24"><path d="M6,12 H92" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/>
    <polygon points="90,4 108,12 90,20" fill="#e8e8f0"/><path d="M4,12 l12,-8 M4,12 l12,8 M13,12 l12,-8 M13,12 l12,8" stroke="${c}" stroke-width="4" stroke-linecap="round"/></svg>`;

  // Yuuki: her grandmother taught her kyudo. Camellia petals gather on the string while she draws the longbow, one
  // arrow flies, and a red camellia blooms on the target... then drops whole, the way camellias fall
  S.camellia = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = T.x >= A.x ? 1 : -1, B = { x: A.x + sg * 40, y: A.y };
    pop(V, A, H + 95, own(a, 'cry', 'Grandmother... guide my hand.'), 'float-text cute', 1.2);
    const bow = propAt(V, B, H * 0.6, `<span style="display:inline-block; transform: scaleX(${-sg})">🏹</span>`, 80);
    for (let i = 0; i < 12; i++) {
      const p = V.billboard('petal', '🌺', A.x + rnd(-160, 160), A.y + rnd(-40, 40));
      p.body.style.fontSize = rnd(18, 28) + 'px';
      gsap.set(p.body, { y: -H * rnd(0.3, 1.3) });
      gsap.to(p, { x: B.x, y: B.y, duration: 0.5, delay: i * 0.03, ease: 'power2.in' });
      gsap.to(p.body, { y: -H * 0.6, scale: 0.2, opacity: 0, duration: 0.5, delay: i * 0.03, ease: 'power2.in', onComplete: () => p.remove() });
    }
    MB.audio.sfx('stretch');
    await gsap.to(bow.body, { scaleX: 0.75, duration: 0.6, ease: 'power1.in' });
    await wait(0.15);
    MB.audio.sfx('twang'); MB.audio.sfx('whoosh');
    gsap.to(bow.body, { scaleX: 1, duration: 0.3, ease: 'elastic.out(1,0.3)' });
    const ar = V.billboard('thrown', arrowSvg(c), B.x, B.y);
    await path(ar, along(arc(B, T, H * 0.6, hT, 40)), 0.3, 'power1.in', (p) => {
      if (Math.random() < 0.5) {
        const tr = V.billboard('petal', '🌺', p.x, p.y);
        tr.body.style.fontSize = '16px';
        gsap.set(tr.body, { y: -p.h });
        gsap.to(tr.body, { y: -p.h + 40, opacity: 0, duration: 0.6, onComplete: () => tr.remove() });
      }
    });
    ar.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('stab'); V.shake(12); V.hitStop();
    const bloom = propAt(V, T, hT * 1.3, '🌺', 110);
    MB.audio.sfx('sparkle');
    await wait(0.55);
    await gsap.to(bloom.body, { y: -12, rotation: 80, duration: 0.45, ease: 'power2.in' }); // it falls whole
    MB.audio.sfx('thud');
    fadeOut(bloom, 0.5); fadeOut(bow);
    pop(V, T, hT + 140, own(a, 'finish', "Hold still. I'm a nurse."), 'float-text cute', 1.2);
    await wait(0.3);
  };

  // Itsuki: two years ago only his ski lift broke, and his sister died breaking his fall. Snow blows in, a cable
  // strings itself over the target, a chair creaks along it and sways... and the cable snaps
  S.skilift = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = Math.min(220, hT + 125);
    snowfall(V, T, 40, 360, 300);
    pop(V, A, H + 95, own(a, 'cry', 'Only ours broke. Why ours?'), 'float-text debuff', 1.3);
    const chairStart = T.x + (T.x < 590 ? 300 : -300);
    const cable = V.billboard('lift-cable', '', (chairStart + T.x) / 2, T.y);
    cable.body.style.width = '400px';
    gsap.set(cable.body, { y: -top });
    await gsap.fromTo(cable.body, { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power2.out' });
    const chair = V.billboard('thrown', '🚡', chairStart, T.y);
    chair.body.style.fontSize = '96px';
    gsap.set(chair.body, { y: -top + 42, transformOrigin: '50% 0%' });
    MB.audio.sfx('tick');
    await gsap.to(chair, { x: T.x, duration: 1, ease: 'power1.inOut' });
    MB.audio.sfx('tick');
    await gsap.to(chair.body, { rotation: 9, duration: 0.14, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    MB.audio.sfx('clang'); MB.audio.sfx('glass');
    flash(V, T, top, '#ffffff', 140);
    pop(V, T, top + 40, 'SNAP', 'float-text verdict', 0.8);
    gsap.to(cable.body, { rotation: -14, opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => cable.remove() });
    MB.audio.sfx('whistleDown');
    await gsap.to(chair.body, { y: -hT, rotation: 30, duration: 0.4, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('boom'); V.shake(24); V.hitStop();
    squash(tv, 0.5);
    puff(V, T, '#ffffff', 10, 20, 1.2);
    debris(V, T, '#dfe9f5', 10, { spread: 160, chars: ['❄️', '🔩', '⚙️'] });
    fadeOut(chair, 0.4);
    pop(V, T, hT + 140, own(a, 'finish', 'Now you know how it felt.'), 'float-text debuff', 1.3);
    await wait(0.4);
  };

  // Fumiko: kendo club captain turned Nagano cop. A bow, then the three strikes called out loud, men, kote, do
  // (head, wrist, body), and the cuffs come down after them
  S.kendo = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = d.x >= 0 ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', 'Rei. ...Hajime!'), 'float-text buff', 1);
    await gsap.to(v.figure, { rotation: sg * 12, duration: 0.2, yoyo: true, repeat: 1 }); // the bow
    MB.audio.sfx('zip');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.22, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    const strikes = [['面', 'MEN!', -hT * 2 - 10, sg * 80], ['小手', 'KOTE!', -hT * 1.2, sg * 20], ['胴', 'DO!', -hT * 0.9, -sg * 30]];
    for (let i = 0; i < 3; i++) {
      const [kanji, call, y, rot] = strikes[i];
      MB.audio.sfx('swish');
      gsap.fromTo(v.figure, { x: -d.x * 20 }, { x: d.x * 16, duration: 0.1, yoyo: true, repeat: 1 });
      slashArc(V, T, y, c, rot);
      if (!i) { impact(); hit(V, t, c, true); V.hitStop(); } else { burst(V, T, c, 10, { h: hT }); MB.audio.sfx('hit'); }
      V.shake(8 + i * 4);
      pop(V, T, hT * 2 + 40 + i * 30, kanji, 'float-text kanji', 0.8);
      pop(V, here(v), H + 60, call, 'float-text buff', 0.6);
      await wait(0.3);
    }
    const cuffs = propAt(V, T, hT * 2 + 120, '⛓️', 70);
    MB.audio.sfx('clang');
    await gsap.to(cuffs.body, { y: -hT, duration: 0.3, ease: 'power3.in' });
    MB.audio.sfx('clang');
    fadeOut(cuffs, 0.4);
    tint(tv, 'drop-shadow(0 0 10px #ff2a3a) drop-shadow(0 0 20px #2a6aff)', 0.8);
    pop(V, T, hT + 140, own(a, 'finish', 'Remain silent. Please.'), 'float-text buff', 1.2);
    await goHome(v, A);
  };

  // Sugiura: bad luck follows him everywhere and never once touches him. He deals the two of spades, a black cat strolls
  // past the target, and everything above it starts to fall
  S.jinx = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), sg = T.x >= A.x ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', "Don't stand too close to me."), 'float-text ability', 1.1);
    MB.audio.sfx('deal');
    const card = V.billboard('fx-playcard', '<b>2</b><i>♠</i>', A.x, A.y);
    await path(card, (k) => ({ ...arc(A, T, H * 0.7, hT * 2 + 70, 120)(k), r: k * 720 }), 0.5, 'power1.inOut');
    MB.audio.sfx('cardflip');
    await gsap.fromTo(card.body, { rotationY: 90 }, { rotationY: 0, duration: 0.2 });
    pop(V, T, hT * 2 + 160, 'Two of Spades...', 'float-text debuff', 0.8);
    const cat = V.billboard('thrown', `<span style="display:inline-block; transform: scaleX(${-sg})">🐈‍⬛</span>`, T.x - sg * 220, T.y + 30);
    cat.body.style.fontSize = '54px';
    gsap.set(cat.body, { y: -12 });
    MB.audio.sfx('squeak');
    const trot = gsap.to(cat.body, { y: -24, duration: 0.12, yoyo: true, repeat: -1 });
    await gsap.to(cat, { x: T.x + sg * 220, duration: 1, ease: 'none' });
    trot.kill(); cat.remove();
    const junk = ['🪴', '🧱', '🔔'];
    for (let i = 0; i < 3; i++) {
      const j = V.billboard('thrown', junk[i], T.x + rnd(-20, 20), T.y);
      j.body.style.fontSize = 60 + i * 20 + 'px';
      gsap.set(j.body, { y: -hT * 2 - 380 });
      MB.audio.sfx('whistleDown');
      await gsap.to(j.body, { y: -hT * 1.4, rotation: rnd(-40, 40), duration: 0.35, ease: 'power2.in' });
      MB.audio.sfx(i === 2 ? 'gong' : 'bonk');
      if (!i) { impact(); hit(V, t, c); } else burst(V, T, c, 10, { h: hT * 1.4 });
      V.shake(6 + i * 6); squash(tv, 0.7 - i * 0.05);
      toss(j, { v: [200, 380], dur: 0.7 });
      if (i === 2) V.hitStop();
    }
    fadeOut(card, 0.2);
    pop(V, A, H + 60, own(a, 'finish', '...Missed me again.'), 'float-text ability', 1.2);
    await wait(0.3);
  };

  // Hakari: the punk rocker who blew up her school's bathroom with fireworks. She plants three rockets, lights them
  // all, and the show goes off right over the target
  S.fireworks = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), sg = T.x >= A.x ? 1 : -1, cols = [c, '#ffd84a', '#5ad8ff'];
    pop(V, A, H + 95, own(a, 'cry', 'Fire in the hole! Hahaha!'), 'float-text burn', 1.1);
    const pos = [0, 1, 2].map((i) => ({ x: A.x + sg * (50 + i * 34), y: A.y + (i - 1) * 16 }));
    const pads = pos.map((P) => propAt(V, P, 20, '🧨', 44));
    MB.audio.sfx('sizzle');
    for (let s = 0; s < 6; s++) { burst(V, pos[s % 3], '#ffb347', 3, { h: 40, spread: 30 }); await wait(0.07); }
    await Promise.all(pads.map(async (pad, i) => {
      await wait(i * 0.28);
      const P = pos[i], top = hT * 2 + 150 + i * 30, Q = { x: T.x + (i - 1) * 50, y: T.y }, col = cols[i];
      fadeOut(pad, 0, 0.1);
      const r = V.billboard('thrown rocket', '🚀', P.x, P.y);
      MB.audio.sfx('whistleUp');
      await path(r, along(arc(P, Q, 20, top, 140), 45), 0.55, 'power1.out', (p) => {
        if (Math.random() < 0.7) { const s = dot(V, p, p.h, '#ffb347', 8); gsap.to(s.body, { opacity: 0, scale: 0.2, duration: 0.4, onComplete: () => s.remove() }); }
      });
      r.remove();
      MB.audio.sfx('boom'); flash(V, Q, top, col, 260);
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2, s = dot(V, Q, top, col, 10, 'spark plus');
        gsap.to(s, { x: Q.x + Math.cos(ang) * 120, duration: 0.9, ease: 'power2.out' });
        gsap.to(s.body, { keyframes: [{ y: -top - Math.sin(ang) * 110, duration: 0.45, ease: 'power2.out' }, { y: `+=70`, opacity: 0, duration: 0.5, ease: 'power1.in' }],
          onComplete: () => s.remove() });
      }
      if (i === 2) { impact(); hit(V, t, c, true); V.shake(18); V.hitStop(); } else V.shake(6);
    }));
    pop(V, T, hT + 150, own(a, 'finish', 'ENCORE!!'), 'float-text burn', 1.1);
    await wait(0.4);
  };

  // Sora: the folklore student reads from "Stories from Yokai & Whispers from the Mountains". The kamaitachi come on
  // the wind, three sickle-weasels: the first knocks you down, the second cuts, the third salves the cut so it never bleeds
  S.kamaitachi = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    const book = propAt(V, A, H + 30, '📖', 64);
    MB.audio.sfx('crinkle');
    gsap.to(book.body, { rotation: 6, duration: 0.2, yoyo: true, repeat: 3 });
    pop(V, A, H + 110, own(a, 'cry', 'Kamaitachi! They ARE real!'), 'float-text heal', 1.3);
    await wait(0.5);
    MB.audio.sfx('wind');
    const gust = V.billboard('thrown', '🌪️', T.x, T.y);
    gust.body.style.fontSize = '150px';
    gsap.set(gust.body, { y: -hT, opacity: 0.55 });
    const spin = gsap.to(gust.body, { rotationY: 360, duration: 0.5, ease: 'none', repeat: -1 });
    const acts = [['🐾', 'Trip!'], ['🔪', 'Slice!'], ['💊', 'Salve~']];
    for (let i = 0; i < 3; i++) {
      const s = dot(V, T, hT, '#e8fff6', 18, 'spark plus');
      MB.audio.sfx('swish');
      await path(s, (k) => ({ x: T.x + Math.cos(k * Math.PI * 2 + i) * 110, y: T.y + Math.sin(k * Math.PI * 2 + i) * 40, h: hT + Math.sin(k * 6) * 30 }), 0.3, 'none',
        (p) => { const g = dot(V, p, p.h, c, 10); gsap.to(g.body, { opacity: 0, duration: 0.3, onComplete: () => g.remove() }); });
      s.remove();
      pop(V, T, hT * 2 + 40 + i * 35, `${acts[i][0]} ${acts[i][1]}`, i === 2 ? 'float-text heal' : 'float-text buff', 0.8);
      if (i === 0) { impact(); hit(V, t, c); if (tv) gsap.fromTo(tv.figure, { rotation: -20 }, { rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' }); }
      if (i === 1) { slashArc(V, T, -hT, c, 40); slashArc(V, T, -hT * 1.2, c, -40); MB.audio.sfx('stab'); V.shake(14); V.hitStop(); burst(V, T, c, 16, { h: hT }); }
      if (i === 2) { MB.audio.sfx('heal'); rise(V, T, '#6fff9a', 8, hT * 2); }
      await wait(0.12);
    }
    spin.kill(); fadeOut(gust, 0, 0.3); fadeOut(book, 0.2);
    pop(V, A, H + 70, own(a, 'finish', 'No blood! Just like the book!'), 'float-text heal', 1.2);
    await wait(0.3);
  };

  // Kumi: the lazy kitsune wife. Blue foxfire wakes up round her while she yawns and drifts over to pop on the target one
  // wisp at a time; then she melts into mist, pops up beside it for a tail swat, and wanders back for a nap
  S.foxfire = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Mmh... five more minutes...'), 'float-text cute', 1.2);
    MB.audio.sfx('fire');
    const wisps = [0, 1, 2, 3, 4].map(() => dot(V, A, H * 0.6, c, 34, 'spark plus')), q = { a: 0 };
    const orbit = gsap.to(q, { a: Math.PI * 4, duration: 1.1, ease: 'none', onUpdate: () => wisps.forEach((w, i) => {
      const ang = q.a + (i / 5) * Math.PI * 2;
      gsap.set(w, { x: A.x + Math.cos(ang) * 80, y: A.y + Math.sin(ang) * 26 });
      gsap.set(w.body, { y: -H * 0.6 - Math.sin(ang * 2) * 20 });
    }) });
    await orbit;
    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i], P = { x: gsap.getProperty(w, 'x'), y: gsap.getProperty(w, 'y') };
      path(w, arc(P, T, H * 0.6, hT, 90), 0.35, 'power1.in').then(() => {
        w.remove(); MB.audio.sfx('fire'); flash(V, T, hT, c, 140); burst(V, T, c, 8, { h: hT, spread: 80 }); V.shake(5);
        if (!i) { impact(); hit(V, t, c); }
      });
      await wait(0.12);
    }
    await wait(0.45);
    puff(V, A, '#e8eeff', 8, H * 0.5, 1.1); MB.audio.sfx('poof');
    gsap.set(v.figure, { opacity: 0 });
    await wait(0.25);
    gsap.set(v.el, { x: C.x, y: C.y });
    puff(V, C, '#e8eeff', 6, H * 0.5); MB.audio.sfx('poof');
    await gsap.to(v.figure, { opacity: 1, duration: 0.15 });
    MB.audio.sfx('swish');
    await gsap.to(v.figure, { rotation: 360, duration: 0.3, ease: 'power2.in' });
    gsap.set(v.figure, { rotation: 0 });
    hit(V, t, c, true); V.shake(12); V.hitStop(); MB.audio.sfx('bonk');
    scatter(V, T, hT, ['🦊', '💙', '✨'], 8, 140);
    pop(V, T, hT + 130, own(a, 'finish', 'Done. Nap time. With you.'), 'float-text cute', 1.2);
    await goHome(v, A, 0.6);
  };

  // Nanami Hana: the tomboy fighter of "the furious two". Ring ropes rise behind her, she runs back into them, they fling
  // her across the board into a flying dropkick, and the referee counts it out
  S.ropes = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), R = { x: A.x - d.x * 90, y: A.y - d.y * 90 };
    const ropes = V.billboard('ring-ropes', '<i></i><i></i><i></i>', R.x, R.y);
    ropes.body.style.setProperty('--c', c);
    gsap.set(ropes.body, { y: -H * 0.35 });
    MB.audio.sfx('ding');
    await gsap.fromTo(ropes.body, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: 'back.out(2)' });
    pop(V, A, H + 95, own(a, 'cry', 'The Furious Two ride again!'), 'float-text burn', 1.1);
    await gsap.to(v.el, { x: R.x, y: R.y, duration: 0.3, ease: 'power2.in' });
    MB.audio.sfx('stretch');
    await gsap.to(ropes.body, { scaleX: 1.25, scaleY: 0.8, duration: 0.15 });
    MB.audio.sfx('twang');
    gsap.to(ropes.body, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1,0.3)' });
    await Promise.all([
      gsap.to(v.el, { x: C.x, y: C.y, duration: 0.4, ease: 'power1.in', onUpdate: () => ghost(V, v, c) }),
      gsap.to(v.figure, { keyframes: [{ y: -90, rotation: -d.x * 30, duration: 0.2, ease: 'power2.out' }, { y: -30, rotation: -d.x * 70, duration: 0.2, ease: 'power2.in' }] })]);
    impact(); hit(V, t, c, true); MB.audio.sfx('punch'); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    pop(V, T, hT * 2 + 30, '💥', 'float-text burn', 0.8);
    if (tv) gsap.fromTo(tv.figure, { x: d.x * 40, rotation: d.x * 20 }, { x: 0, rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
    gsap.to(v.figure, { y: 0, rotation: 0, duration: 0.25 });
    fadeOut(ropes, 0.2);
    for (const n of ['1...', '2...', '3!']) { MB.audio.sfx('thud'); pop(V, T, hT * 2 + 90, n, 'float-text buff', 0.5); await wait(0.28); }
    MB.audio.sfx('ding');
    pop(V, T, hT + 150, own(a, 'finish', 'Pick on someone your size!'), 'float-text burn', 1.1);
    await goHome(v, A);
  };

  // Momo: the café's pastry chef. Cream is piped round and round over the target, a strawberry lands on top, and the
  // whole cake comes down on it. Then he panics that it was too sweet
  S.piping = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a), top = hT * 2 + 60;
    pop(V, A, H + 95, own(a, 'cry', 'Fresh from the oven~ ♡'), 'float-text cute', 1.1);
    const whisk = propAt(V, A, H * 0.7, '🥄', 50);
    gsap.to(whisk.body, { rotation: 360, duration: 0.25, repeat: 3, ease: 'none' });
    MB.audio.sfx('bubble');
    await wait(0.5); fadeOut(whisk);
    const dollops = [];
    for (let i = 0; i < 18; i++) {
      const k = i / 18, ang = k * Math.PI * 6, r = 1 - k * 0.7;
      const dl = dot(V, { x: T.x + Math.cos(ang) * 70 * r, y: T.y + Math.sin(ang) * 22 * r }, top + k * 90, i % 3 ? '#fff6ee' : c, 26 - k * 10, 'spark');
      gsap.fromTo(dl.body, { scale: 0 }, { scale: 1, duration: 0.15, ease: 'back.out(3)' });
      dollops.push(dl);
      if (i % 3 === 0) MB.audio.sfx('pop');
      await wait(0.035);
    }
    const berry = propAt(V, T, top + 110, '🍓', 46);
    MB.audio.sfx('boing');
    await wait(0.3);
    const cake = propAt(V, T, top + 40, '🎂', 130);
    dollops.forEach((dl) => fadeOut(dl, 0, 0.15)); fadeOut(berry, 0, 0.15);
    await gsap.to(cake.body, { y: -hT, duration: 0.3, ease: 'power3.in' });
    impact(); hit(V, t, '#fff6ee', true); MB.audio.sfx('splat'); V.shake(16); V.hitStop();
    squash(tv, 0.55);
    decal(V, T, 'splat', '#fff6ee', 1);
    scatter(V, T, hT, ['🍓', '🧁', '✨', '🍰'], 12, 170);
    fadeOut(cake, 0.2);
    pop(V, T, hT + 140, own(a, 'finish', 'W-was it too sweet?! Sorry!'), 'float-text cute', 1.2);
    await wait(0.3);
  };

  // Ryu: a law student with a fan club who treats him like a celebrity. Stars rain down over the target like a fan-club
  // flower shower, he throws his hand up, OBJECTION! slams down, and the stars are his evidence: they fly in one by one
  S.objection = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Order in the court!'), 'float-text cute', 1);
    scatter(V, A, H * 0.6, ['💜', '📣', '✨'], 6, 90); // the fan club goes wild
    MB.audio.sfx('ding');
    const stars = [];
    for (let i = 0; i < 9; i++) {
      const P = { x: T.x + rnd(-110, 110), y: T.y + rnd(-40, 40) }, h = hT + rnd(40, 110);
      const b = V.billboard('thrown', '⭐', P.x, P.y);
      b.body.style.fontSize = '40px';
      gsap.set(b.body, { y: -(h + 260), opacity: 0 });
      gsap.to(b.body, { y: -h, opacity: 1, duration: 0.45, ease: 'power2.in' });
      gsap.to(b.body, { rotation: rnd(-40, 40), duration: 0.45 });
      stars.push({ b, P, h });
      if (i % 2 === 0) MB.audio.sfx('tink');
      await wait(0.08);
    }
    await wait(0.35);
    await gsap.to(v.figure, { y: -45, duration: 0.14, ease: 'power2.out' }); // finger up
    gsap.to(v.figure, { y: 0, duration: 0.2, ease: 'power2.in' });
    pop(V, T, hT * 0.6, 'OBJECTION!', 'float-text dmg', 1.1);
    MB.audio.sfx('stomp'); V.shake(8);
    await wait(0.4);
    const last = stars.length - 1;
    for (let i = 0; i <= last; i++) {
      const { b, P, h } = stars[i], strike = path(b, arc(P, T, h, hT, 50), 0.28, 'power2.in').then(() => {
        if (i === last) { impact(); hit(V, t, c, true); MB.audio.sfx('punch'); V.shake(14); V.hitStop(); squash(tv, 0.6); }
        else { hit(V, t, '#ffe27a', false); MB.audio.sfx('tink'); }
        b.remove();
      });
      if (i === last) await strike;
      else await wait(0.09);
    }
    scatter(V, T, hT, ['⭐', '⚖️', '✨'], 10, 160);
    pop(V, T, hT + 150, own(a, 'finish', 'Sustained. ...Next case.'), 'float-text cute', 1.1);
    await wait(0.3);
  };

  // ---------------------------------------------------------------- Siren's Cove Resort
  // Kai: a surfer who talks to the sea. It sends a wave over, he rides it in, forgets that boards have no brakes, and
  // wipes out: he tumbles one way, the board spins the other and clips the target
  S.wipeout = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'The sea says hi, bro.'), 'float-text cute', 1.2);
    MB.audio.sfx('wave');
    const waves = [0, 1, 2].map((i) => propAt(V, { x: A.x, y: A.y + 6 }, 30, '🌊', 76 + i * 16));
    await wait(0.35);
    const o = { k: 0 };
    MB.audio.sfx('surf');
    await gsap.to(o, { k: 1, duration: 0.8, ease: 'power1.in', onUpdate: () => {
      const P = { x: lerp(A.x, C.x, o.k), y: lerp(A.y, C.y, o.k) };
      gsap.set(v.el, { x: P.x, y: P.y });
      gsap.set(v.figure, { y: -28 - 10 * Math.sin(o.k * Math.PI * 3), rotation: d.x * 10 });
      waves.forEach((w, i) => gsap.set(w, { x: P.x - d.x * i * 24, y: P.y - d.y * i * 24 + 8 }));
      ghost(V, v, c);
    } });
    waves.forEach((w) => fadeOut(w, 0, 0.3));
    pop(V, C, H + 40, 'Whoa-', 'float-text dmg', 0.6);
    MB.audio.sfx('boing');
    const board = V.billboard('thrown', '🏄', C.x, C.y);
    board.body.style.fontSize = '66px';
    gsap.to(v.figure, { rotation: d.x < 0 ? -720 : 720, duration: 0.5, ease: 'power1.out' });
    gsap.to(v.figure, { keyframes: [{ y: -160, duration: 0.25, ease: 'power2.out' }, { y: 0, duration: 0.25, ease: 'power2.in' }] });
    await path(board, (k) => ({ ...arc(C, T, H * 0.5, hT, 90)(k), r: -k * 540 }), 0.5, 'power1.in');
    board.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); V.shake(12); V.hitStop();
    squash(tv, 0.65);
    scatter(V, T, hT, ['🌊', '💦', '🐚'], 10, 150);
    pop(V, C, H + 50, '🤙', 'float-text cute', 1);
    pop(V, T, hT + 140, own(a, 'finish', 'Gnarly. The sea says sorry.'), 'float-text cute', 1.1);
    await wait(0.4);
    await goHome(v, A);
  };

  // Henry: an author stuck on his ending. He paces and sips coffee, throwing crumpled drafts at the target, then has
  // the idea: a giant book falls on it and the words THE END come down with it
  S.plotwist = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Hold on. I almost had it...'), 'float-text cute', 1.2);
    for (let i = 0; i < 3; i++) {
      gsap.fromTo(v.figure, { x: -18, rotation: -5 }, { x: 18, rotation: 5, duration: 0.3, ease: 'sine.inOut' });
      pop(V, A, H + 50, ['☕', '✒️', '😩'][i], 'float-text', 0.7);
      MB.audio.sfx('crinkle');
      const ball = V.billboard('thrown', '📄', A.x, A.y);
      ball.body.style.fontSize = '40px';
      path(ball, (k) => ({ ...arc(A, T, H * 0.6, hT, 110)(k), r: k * 540 }), 0.5, 'none').then(() => { ball.remove(); hit(V, t, '#ffe9a8', false); MB.audio.sfx('tink'); });
      await wait(0.4);
    }
    gsap.set(v.figure, { x: 0, rotation: 0 });
    await wait(0.2);
    pop(V, A, H + 60, '💡', 'float-text buff', 0.9);
    MB.audio.sfx('ding');
    await gsap.to(v.figure, { y: -45, duration: 0.15, ease: 'power2.out' });
    gsap.to(v.figure, { y: 0, duration: 0.2 });
    pop(V, A, H + 100, 'THAT\'S the ending!', 'float-text cute', 1);
    await wait(0.4);
    const book = V.billboard('thrown', '📕', T.x, T.y);
    book.body.style.fontSize = '150px';
    gsap.set(book.body, { y: -(hT + 520) });
    MB.audio.sfx('incoming');
    await gsap.to(book.body, { y: -hT * 0.8, rotation: -8, duration: 0.4, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    squash(tv, 0.55);
    pop(V, T, hT * 0.6, 'THE END.', 'float-text dmg', 1.1);
    scatter(V, T, hT, ['📄', '✒️', '☕'], 10, 160);
    fadeOut(book, 0.5, 0.3);
    pop(V, T, hT + 150, own(a, 'finish', '...Now do I have a sequel?'), 'float-text cute', 1.1);
    await wait(0.5);
  };

  // Marcus: a painter who colors things as they look in other dimensions. He lobs an apple; halfway across it turns
  // blue (it is blue in another universe), and so does the target
  S.otherblue = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Apples are blue, you see!'), 'float-text cute', 1.2);
    await gsap.to(v.figure, { rotation: -10, y: -14, duration: 0.2 });
    const M = { x: lerp(A.x, T.x, 0.5), y: lerp(A.y, T.y, 0.5) };
    const apple = V.billboard('thrown', '🍎', A.x, A.y);
    apple.body.style.fontSize = '56px';
    gsap.to(v.figure, { rotation: 8, y: 0, duration: 0.2 });
    MB.audio.sfx('whoosh');
    await path(apple, (k) => ({ ...arc(A, M, H * 0.6, H * 0.9 + 60, 60)(k), r: k * 360 }), 0.4, 'none');
    apple.remove();
    scatter(V, M, H * 0.9 + 60, ['🎨', '💙', '✨'], 8, 90);
    pop(V, M, H * 0.9 + 100, '...BLUE!', 'float-text buff', 0.8);
    MB.audio.sfx('pop');
    const berry = V.billboard('thrown', '🫐', M.x, M.y);
    berry.body.style.fontSize = '56px';
    await path(berry, (k) => ({ ...arc(M, T, H * 0.9 + 60, hT, 40)(k), r: k * 360 }), 0.4, 'power1.in');
    berry.remove();
    impact(); hit(V, t, '#4a8aff', true); MB.audio.sfx('splat'); V.shake(10); V.hitStop();
    tint(tv, 'hue-rotate(190deg) saturate(2.4)', 1.6);
    squash(tv, 0.7);
    scatter(V, T, hT, ['🎨', '💙', '🫐'], 12, 150);
    pop(V, T, hT + 140, own(a, 'finish', 'See? Blue in another universe!'), 'float-text cute', 1.2);
    await wait(0.4);
    await goHome(v, A);
  };

  // Thomas: a pastry chef whose desserts have made people cry. He rings for service and sends a three-course tasting
  // menu across the board, each plate hitting harder, and the target weeps from the dessert
  S.tasting = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Table for one? Tasting menu~'), 'float-text cute', 1.2);
    const bell = propAt(V, { x: A.x + 40, y: A.y }, H * 0.45, '🛎️', 46);
    MB.audio.sfx('ding');
    await wait(0.35);
    fadeOut(bell, 0, 0.2);
    const courses = [['🥗', 'Starter!'], ['🍝', 'Main!'], ['🍰', 'DESSERT!']];
    for (let i = 0; i < 3; i++) {
      const last = i === 2;
      pop(V, A, H + 60, courses[i][1], 'float-text cute', 0.7);
      gsap.fromTo(v.figure, { y: -26, rotation: -8 }, { y: 0, rotation: 0, duration: 0.25 });
      MB.audio.sfx('swish');
      const plate = V.billboard('thrown', courses[i][0], A.x, A.y);
      plate.body.style.fontSize = last ? '70px' : '54px';
      await path(plate, (k) => ({ ...arc(A, T, H * 0.6, hT, 130)(k), r: k * (last ? 900 : 360) }), last ? 0.55 : 0.4, 'power1.in');
      plate.remove();
      MB.audio.sfx('splat');
      if (last) { impact(); hit(V, t, c, true); V.shake(12); V.hitStop(); squash(tv, 0.6); }
      else hit(V, t, '#ffd9a0', false);
      await wait(last ? 0.1 : 0.15);
    }
    scatter(V, T, hT + 20, ['💧', '😭', '💧'], 12, 120);
    pop(V, T, hT + 120, 'It\'s SO GOOD...', 'float-text dmg', 1);
    pop(V, T, hT + 170, own(a, 'finish', 'Made with love! And butter.'), 'float-text cute', 1.1);
    await wait(0.5);
  };

  // Lysander: an exiled siren who loves stormy seas. He hums, a cloud gathers over the target and rains, lightning
  // cracks, and a wave falls out of the sky; an otter surfaces from it, unbothered
  S.stormsong = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', '...A song for the stormy sea.'), 'float-text cute', 1.2);
    glowUp(v, c, -30);
    MB.audio.sfx('melody');
    scatter(V, A, H * 0.7, ['🎵', '🎶', '🌊'], 8, 100);
    await wait(0.5);
    const clouds = [-70, 0, 70].map((dx) => propAt(V, { x: T.x + dx, y: T.y }, hT * 2 + 40, '☁️', 96));
    MB.audio.sfx('wind');
    for (let i = 0; i < 12; i++) {
      const drop = V.billboard('thrown', '💧', T.x + rnd(-90, 90), T.y + rnd(-20, 20));
      drop.body.style.fontSize = '26px';
      gsap.set(drop.body, { y: -(hT * 2 + 20) });
      gsap.to(drop.body, { y: -rnd(0, 30), opacity: 0.2, duration: 0.45, ease: 'power1.in', delay: i * 0.05, onComplete: () => drop.remove() });
    }
    await wait(0.7);
    flash(V, T, hT * 1.6, '#e8f0ff', 320);
    MB.audio.sfx('thunder'); V.shake(8);
    pop(V, T, hT * 2 + 30, '⚡', 'float-text dmg', 0.6);
    await wait(0.3);
    const wave = V.billboard('thrown', '🌊', T.x, T.y);
    wave.body.style.fontSize = '170px';
    gsap.set(wave.body, { y: -(hT + 380) });
    MB.audio.sfx('incoming');
    await gsap.to(wave.body, { y: -hT * 0.75, duration: 0.4, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); V.shake(16); V.hitStop();
    squash(tv, 0.55);
    scatter(V, T, hT, ['💦', '🐚', '🐟'], 12, 170);
    ring(V, T, '#6ac0ff', 2.4, 0.8);
    clouds.forEach((cl, i) => fadeOut(cl, 0.3 + i * 0.1, 0.4));
    fadeOut(wave, 0.5, 0.3);
    await wait(0.3);
    pop(V, T, hT + 70, '🦦', 'float-text cute', 1.2);
    MB.audio.sfx('squeak');
    pop(V, T, hT + 150, own(a, 'finish', '...The otter was not my idea.'), 'float-text cute', 1.2);
    glowDown(v);
    await wait(0.4);
  };

  // Nova: a stardust fairy who is sleepy all day and awake all night. He nods off mid-attack, remembers it is night,
  // and is suddenly a shooting star zig-zagging through the target in a trail of stardust, then nods off again
  S.daydream = async (V, a, t, impact) => {
    const { v, A, T, perp, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Mm? ...Oh. Sorry. Was I asleep?'), 'float-text cute', 1.3);
    for (let i = 0; i < 2; i++) {
      gsap.to(v.figure, { rotation: 14, y: 6, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 });
      pop(V, A, H + 55 + i * 25, '💤', 'float-text', 0.9);
      await wait(0.45);
    }
    MB.audio.sfx('tick');
    pop(V, A, H + 100, '🌙 It\'s NIGHT!', 'float-text buff', 1);
    await gsap.to(v.figure, { rotation: 0, y: -70, duration: 0.2, ease: 'back.out(3)' });
    burst(V, A, '#9fc8ff', 16, { h: H * 0.5 });
    MB.audio.sfx('zap');
    gsap.to(v.figure, { opacity: 0, duration: 0.1 });
    const star = V.billboard('thrown', '⭐', A.x, A.y);
    star.body.style.fontSize = '64px';
    MB.audio.sfx('whoosh');
    await path(star, (k) => ({
      x: lerp(A.x, T.x, k) + perp.x * Math.sin(k * Math.PI * 3) * 60 * (1 - k), y: lerp(A.y, T.y, k) + perp.y * Math.sin(k * Math.PI * 3) * 60 * (1 - k),
      h: lerp(H * 0.6, hT, k) + Math.sin(k * Math.PI * 4) * 40 * (1 - k), r: k * 720,
    }), 0.6, 'power2.in', (p) => {
      if (Math.random() < 0.7) { const s = dot(V, p, p.h, '#bcd8ff', rnd(6, 12), 'spark plus'); gsap.to(s.body, { opacity: 0, scale: 0.2, duration: 0.5, onComplete: () => s.remove() }); }
    });
    star.remove();
    impact(); hit(V, t, c, true); MB.audio.sfx('sparkle'); V.shake(12); V.hitStop();
    squash(tv, 0.65);
    scatter(V, T, hT, ['⭐', '✨', '🌙'], 12, 160);
    pop(V, T, hT + 140, own(a, 'finish', '...Is it morning already?'), 'float-text cute', 1.2);
    await wait(0.3);
    gsap.set(v.figure, { y: 0 });
    gsap.to(v.figure, { opacity: 1, rotation: 12, duration: 0.4 });
    pop(V, A, H + 55, '💤', 'float-text', 0.9);
    await wait(0.5);
    await goHome(v, A, 0.3);
  };

  // Ember: a handyman and secretly an Ifrit. He fixes the target with a wrench: two clangs, and on the third his
  // temper slips, the wrench goes white-hot and everything bursts into flame. Then he pretends it didn't
  S.fixfire = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'I can fix that. Probably.'), 'float-text cute', 1.2);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power2.in', onUpdate: () => ghost(V, v, c) });
    const W = { x: T.x - d.x * 40, y: T.y - d.y * 40 };
    const wrench = V.billboard('thrown', '🔧', W.x, W.y);
    wrench.body.style.fontSize = '76px';
    gsap.set(wrench.body, { y: -hT * 1.1 });
    const lines = ['*CLANG*', '*CLANG*', 'HAH HAH HAH!'];
    for (let i = 0; i < 3; i++) {
      gsap.fromTo(wrench.body, { rotation: -70 }, { rotation: 30, duration: 0.14, ease: 'power2.in' });
      gsap.fromTo(v.figure, { x: -d.x * 16 }, { x: d.x * 22, duration: 0.14, yoyo: true, repeat: 1 });
      await wait(0.14);
      pop(V, T, hT + 50 + i * 20, lines[i], 'float-text dmg', 0.8);
      if (i < 2) { MB.audio.sfx('clang'); hit(V, t, '#ffb347', false); }
      else {
        gsap.set(wrench.body, { filter: 'drop-shadow(0 0 18px #ff5a1a)' });
        MB.audio.sfx('boom'); MB.audio.sfx('fire');
        impact(); hit(V, t, c, true); V.shake(14); V.hitStop();
        tint(tv, 'brightness(1.9) sepia(1) hue-rotate(-25deg)', 1.2);
        scatter(V, T, hT, ['🔥', '💥', '🔧'], 12, 160);
        squash(tv, 0.65);
      }
      await wait(0.16);
    }
    fadeOut(wrench, 0.2, 0.3);
    await wait(0.5);
    pop(V, here(v), H + 60, own(a, 'finish', '...Totally calm.'), 'float-text cute', 1.2);
    await goHome(v, A);
  };

  // Beck: a devil who tends the bar and feeds on feelings, so he takes sorrows rather than joys. He asks about the target's
  // troubles, the sorrows stream out of it into his glass, he knocks it back with a very devilish sigh, and flicks
  // the empty glass back at it
  S.sorrowshot = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Tell me your troubles~'), 'float-text cute', 1.2);
    const glass = propAt(V, { x: A.x + 36, y: A.y }, H * 0.5, '🥃', 50);
    MB.audio.sfx('slide');
    await wait(0.4);
    MB.audio.sfx('dark');
    tint(tv, 'grayscale(0.8) brightness(0.8)', 1.6);
    if (tv) gsap.to(tv.figure, { y: 10, scaleY: 0.92, duration: 0.5, ease: 'sine.inOut' });
    for (let i = 0; i < 10; i++) {
      const w = V.billboard('thrown', i % 3 === 0 ? '😢' : '💧', T.x + rnd(-30, 30), T.y);
      w.body.style.fontSize = i % 3 === 0 ? '40px' : '28px';
      const P = { x: A.x + 36, y: A.y };
      path(w, (k) => ({ ...arc({ x: T.x, y: T.y }, P, hT * 1.2, H * 0.5, 70)(k), s: 1 - k * 0.5 }), 0.55, 'power1.in').then(() => { w.remove(); if (i % 3 === 0) burst(V, P, '#6aa8ff', 5, { h: H * 0.5, spread: 40 }); });
      if (i % 3 === 0) MB.audio.sfx('bubble');
      await wait(0.08);
    }
    await wait(0.5);
    pop(V, A, H + 50, '😌', 'float-text cute', 0.8);
    MB.audio.sfx('chomp');
    await wait(0.4);
    pop(V, A, H + 50, '😈', 'float-text dmg', 0.8);
    MB.audio.sfx('laugh');
    await wait(0.4);
    glass.body.style.fontSize = '60px';
    gsap.to(glass, { x: A.x, y: A.y, duration: 0.01 });
    path(glass, (k) => ({ ...arc(A, T, H * 0.5, hT, 90)(k), r: k * 900 }), 0.5, 'power1.in').then(() => glass.remove());
    await wait(0.5);
    impact(); hit(V, t, c, true); MB.audio.sfx('glass'); V.shake(12); V.hitStop();
    squash(tv, 0.65);
    if (tv) gsap.to(tv.figure, { y: 0, scaleY: 1, duration: 0.3 });
    scatter(V, T, hT, ['🥃', '💔', '✨'], 10, 150);
    pop(V, T, hT + 140, own(a, 'finish', 'On the house. Souls extra.'), 'float-text cute', 1.2);
    await wait(0.4);
  };

  // Cassian: a ghost journalist from the 1920s. A flurry of newspapers, then he drifts straight through the target (cold
  // as a tomb), and the headline lands on it
  S.extra = async (V, a, t, impact) => {
    const { v, A, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Extra! Extra! Read all about it!'), 'float-text cute', 1.2);
    gsap.to(v.figure, { opacity: 0.4, duration: 0.3 });
    MB.audio.sfx('flutter');
    for (let i = 0; i < 5; i++) {
      const paper = V.billboard('thrown', '📰', A.x, A.y);
      paper.body.style.fontSize = '46px';
      path(paper, (k) => ({ ...arc(A, { x: T.x + rnd(-30, 30), y: T.y }, H * 0.6, hT + rnd(-20, 30), 90)(k), r: k * 720 }), 0.5, 'none')
        .then(() => { paper.remove(); hit(V, t, '#e8dcc0', false); MB.audio.sfx('tink'); });
      await wait(0.12);
    }
    await wait(0.4);
    MB.audio.sfx('wind');
    await gsap.to(v.el, { x: T.x, y: T.y, duration: 0.45, ease: 'sine.inOut', onUpdate: () => ghost(V, v, '#9fe0c0') });
    impact(); hit(V, t, c, true); MB.audio.sfx('frost'); V.shake(8); V.hitStop();
    tint(tv, 'saturate(0.2) hue-rotate(170deg) brightness(1.3)', 1.4);
    if (tv) gsap.fromTo(tv.figure, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,0.2)' });
    scatter(V, T, hT, ['❄️', '👻', '✨'], 10, 140);
    await gsap.to(v.el, { x: T.x + d.x * 90, y: T.y + d.y * 90, duration: 0.3, ease: 'sine.out', onUpdate: () => ghost(V, v, '#9fe0c0') });
    const head = V.billboard('', '<div style="font:900 24px/1.1 Georgia,serif;color:#222;background:#f1e8d0;padding:6px 12px;border:3px double #222;text-align:center">EXTRA!<br><span style="font:600 14px Georgia">SPOOK HAUNTS HERO</span></div>', T.x, T.y);
    gsap.set(head.body, { y: -(hT + 100), rotation: -5 });
    gsap.from(head.body, { scale: 0.2, opacity: 0, duration: 0.25, ease: 'back.out(3)' });
    fadeOut(head, 1, 0.3);
    pop(V, T, hT + 190, own(a, 'finish', '...Was that a scoop? I forget.'), 'float-text cute', 1.2);
    await wait(0.7);
    await goHome(v, A, 0.5);
  };

  // Adriana: a nymph who teaches yoga. Tree, Warrior, then Downward Dog, which summons an actual dog; roots creep over
  // the floor, vines heave the target into the air, and the dog tackles it as it comes down
  S.namaste = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Breathe in... breathe out...'), 'float-text cute', 1.2);
    MB.audio.sfx('heal');
    const poses = [['Tree.', -8, -24], ['Warrior.', 10, -8], ['Downward Dog!', 0, 14]];
    for (const [word, rot, y] of poses) {
      gsap.to(v.figure, { rotation: rot, y, duration: 0.2 });
      pop(V, A, H + 50, word, 'float-text buff', 0.8);
      await wait(0.45);
    }
    gsap.to(v.figure, { rotation: 0, y: 0, duration: 0.2 });
    MB.audio.sfx('vines');
    for (let j = 1; j <= 8; j++) {
      const root = propAt(V, { x: lerp(A.x, T.x, j / 9), y: lerp(A.y, T.y, j / 9) }, 14, '🌿', 44);
      fadeOut(root, 0.9, 0.3);
      await wait(0.06);
    }
    const vines = [];
    for (let j = 0; j < 5; j++) {
      const vine = V.billboard('thrown', '🌿', T.x + rnd(-50, 50), T.y + rnd(-8, 8));
      vine.body.style.fontSize = '72px';
      gsap.fromTo(vine.body, { y: -10, scale: 0.2 }, { y: -(hT * 0.6 + rnd(-10, 40)), scale: 1, duration: 0.3, delay: j * 0.04, ease: 'back.out(2)' });
      vines.push(vine);
    }
    if (tv) gsap.to(tv.figure, { y: -80, duration: 0.3, delay: 0.1, ease: 'power2.out' });
    scatter(V, T, hT, ['🌸', '🌼', '🌺'], 8, 120);
    await wait(0.7);
    pop(V, A, H + 50, '🐕', 'float-text cute', 0.7);
    MB.audio.sfx('honk');
    const dog = V.billboard('thrown', '🐕', A.x, A.y);
    dog.body.style.fontSize = '70px';
    path(dog, (k) => ({ ...arc(A, T, 30, hT, 70)(k), r: Math.sin(k * Math.PI * 6) * 8 }), 0.5, 'power1.in').then(() => dog.remove());
    await wait(0.4);
    if (tv) gsap.to(tv.figure, { y: 0, duration: 0.12, ease: 'power3.in' });
    await wait(0.1);
    impact(); hit(V, t, c, true); MB.audio.sfx('bonk'); V.shake(12); V.hitStop();
    squash(tv, 0.6);
    vines.forEach((vn, i) => fadeOut(vn, 0.2 + i * 0.05, 0.3));
    scatter(V, T, hT, ['🐾', '🌿', '✨'], 10, 150);
    pop(V, T, hT + 140, own(a, 'finish', 'Namaste. Good boy!'), 'float-text cute', 1.2);
    await wait(0.4);
  };

  // Mireille: the vampire who runs the resort. Three rings of the service bell, a swarm of bats fills the lobby, she is
  // suddenly beside the target with the bill, and a CHECKED OUT stamp slams down
  S.checkout = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Check-out time was ten minutes ago.'), 'float-text cute', 1.3);
    for (let i = 0; i < 3; i++) {
      pop(V, A, H + 40, '🛎️', 'float-text', 0.5);
      MB.audio.sfx('ding');
      gsap.fromTo(v.figure, { y: -14 }, { y: 0, duration: 0.2 });
      await wait(0.25);
    }
    MB.audio.sfx('flutter');
    for (let i = 0; i < 12; i++) {
      const b = V.billboard('thrown bat', '🦇', A.x, A.y);
      b.body.style.fontSize = '36px';
      const P = { x: T.x + rnd(-60, 60), y: T.y + rnd(-25, 25) };
      path(b, (k) => ({ ...arc(A, P, H * 0.7, hT + rnd(-30, 40), 70 + rnd(0, 60))(k), r: Math.sin(k * 20) * 14 }), 0.55, 'power1.in').then(() => { fadeOut(b, 0, 0.15); if (i % 4 === 0) hit(V, t, '#7a1228', false); });
      await wait(0.05);
    }
    gsap.to(v.figure, { opacity: 0, duration: 0.15 });
    MB.audio.sfx('blink');
    await wait(0.5);
    gsap.set(v.el, { x: C.x, y: C.y });
    await gsap.to(v.figure, { opacity: 1, duration: 0.12 });
    pop(V, here(v), H + 45, '📋', 'float-text cute', 0.8);
    await wait(0.3);
    const mark = V.billboard('stamp-mark', 'CHECKED<br>OUT', T.x, T.y);
    mark.body.style.fontSize = '34px';
    gsap.set(mark.body, { y: -hT, rotation: -10 });
    await gsap.fromTo(mark.body, { scale: 3.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power4.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    ring(V, T, '#c0182a', 2);
    squash(tv, 0.6);
    fadeOut(mark, 0.8, 0.4);
    pop(V, T, hT + 140, own(a, 'finish', 'Breakfast is not included.'), 'float-text cute', 1.2);
    await wait(0.6);
    await goHome(v, A);
  };

  // Selene: the moon goddess, bored and posing for paparazzi who aren't there. She flips her hair, flashbulbs pop, and
  // she drops a full moon on the target; it boings and a litter of bunnies hops out of it
  S.moonfall = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Ugh. Mortals.'), 'float-text cute', 1.2);
    await gsap.to(v.figure, { rotationY: '+=360', duration: 0.5, ease: 'power2.inOut' });
    for (let i = 0; i < 4; i++) {
      flash(V, { x: A.x + rnd(-90, 90), y: A.y + rnd(-10, 10) }, H * rnd(0.3, 0.9), '#ffffff', 120);
      MB.audio.sfx('camera');
      await wait(0.1);
    }
    pop(V, A, H + 50, '📸', 'float-text cute', 0.8);
    MB.audio.sfx('holy');
    flash(V, T, hT, '#cfe0ff', 320);
    ring(V, T, '#cfe0ff', 2.2, 0.8);
    await wait(0.4);
    const moon = V.billboard('thrown', '🌕', T.x, T.y);
    moon.body.style.fontSize = '150px';
    gsap.set(moon.body, { y: -(hT + 420) });
    MB.audio.sfx('incoming');
    await gsap.to(moon.body, { y: -hT * 0.8, duration: 0.45, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boing'); V.shake(16); V.hitStop();
    squash(tv, 0.55);
    gsap.to(moon.body, { keyframes: [{ y: -(hT + 130), duration: 0.25, ease: 'power2.out' }, { y: -hT * 0.8, duration: 0.3, ease: 'bounce.out' }] });
    scatter(V, T, hT, ['🐇', '🐇', '🐰', '✨'], 10, 170);
    pop(V, T, hT + 40, 'Boing.', 'float-text dmg', 0.9);
    await wait(0.8);
    gsap.to(moon.body, { y: -(hT + 400), opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => moon.remove() });
    pop(V, T, hT + 150, own(a, 'finish', 'Don\'t look at me. I\'m iconic.'), 'float-text cute', 1.2);
    await wait(0.4);
  };

  // Jace: a lifeguard by day, a werewolf at full moon. He tosses a lifebuoy over the target ("stay behind the buoy!"),
  // spots the moon coming out, begs it not to, and howls into a very embarrassed three-slash combo
  S.fullmoon = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'Everybody out of the water!'), 'float-text cute', 1.2);
    MB.audio.sfx('whistle');
    pop(V, A, H + 50, 'FWEET!', 'float-text dmg', 0.7);
    const buoy = V.billboard('thrown', '🛟', A.x, A.y);
    buoy.body.style.fontSize = '60px';
    await path(buoy, (k) => ({ ...arc(A, T, H * 0.6, hT, 120)(k), r: k * 540 }), 0.5, 'none');
    buoy.remove();
    hit(V, t, '#ff6a3d', false); MB.audio.sfx('bonk');
    squash(tv, 0.8);
    await wait(0.3);
    const moon = propAt(V, { x: A.x, y: A.y }, H + 120, '🌕', 76);
    MB.audio.sfx('dark');
    pop(V, A, H + 40, 'Oh no. Not tonight.', 'float-text dmg', 1);
    gsap.fromTo(v.figure, { x: -6 }, { x: 6, duration: 0.05, yoyo: true, repeat: 9 });
    await wait(0.6);
    gsap.set(v.figure, { x: 0 });
    // the moonlight hits: he doubles over, bones crack, and for a moment he is the werewolf (the costume is only there in
    // NSFW mode, so without it the transformation is all effects)
    const chr = MB.charById(a.card.id), wolf = !!(chr && chr.costumes.some((o) => o.id === 'werewolf')), look = a.costume;
    flash(V, A, H * 0.6, '#cfe0ff', 320);
    ring(V, A, '#cfe0ff', 2, 0.7);
    MB.audio.sfx('holy');
    await gsap.to(v.figure, { y: 14, scaleY: 0.85, duration: 0.2 });
    pop(V, A, H * 0.6, 'CRACK!', 'float-text dmg', 0.6);
    MB.audio.sfx('crunch');
    gsap.fromTo(v.figure, { x: -8 }, { x: 8, duration: 0.04, yoyo: true, repeat: 9 });
    await wait(0.4);
    if (wolf) { a.costume = 'werewolf'; V.setSprite(v, 'attack'); }
    flash(V, A, H * 0.5, '#ffffff', 360);
    scatter(V, A, H * 0.5, ['🐺', '🐾', '💨'], 10, 130);
    gsap.set(v.figure, { x: 0 });
    gsap.to(v.figure, { y: 0, scale: 1.25, scaleY: 1.25, duration: 0.3, ease: 'back.out(3)' });
    pop(V, A, H + 80, 'AWOOOOO!', 'float-text dmg', 1.1);
    MB.audio.sfx('whoosh');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.3, ease: 'power3.in', onUpdate: () => ghost(V, v, c) });
    for (let i = 0; i < 3; i++) {
      slashArc(V, T, -hT, c, [-50, 40, -5][i]);
      gsap.fromTo(v.figure, { x: -d.x * 14 + (i - 1) * 10 }, { x: 0, duration: 0.15 });
      MB.audio.sfx('hit');
      if (i < 2) hit(V, t, c, false);
      else { impact(); hit(V, t, c, true); V.shake(14); V.hitStop(); squash(tv, 0.6); }
      await wait(0.16);
    }
    fadeOut(moon, 0, 0.3);
    scatter(V, T, hT, ['🐾', '🐺', '💢'], 8, 140);
    await wait(0.3);
    // back to normal, sheepishly
    puff(V, here(v), '#8a8a9a', 6, H * 0.5);
    a.costume = look;
    V.setSprite(v, 'lose');
    gsap.to(v.figure, { scale: 1, scaleY: 1, duration: 0.3 });
    pop(V, T, hT + 140, own(a, 'finish', '...Please don\'t tell anyone.'), 'float-text cute', 1.3);
    await wait(0.6);
    V.setSprite(v, 'idle');
    await goHome(v, A);
  };

  // ---------------------------------------------------------------- Siren's Cove Resort: duo attacks
  // an svg drawing standing on the board (lines are class "d" so draw() can trace them)
  const svgBoard = (V, P, h, w, hgt, inner) => {
    const b = V.billboard('', `<svg viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`, P.x, P.y);
    gsap.set(b.body, { y: -h });
    return b;
  };

  // Nova & Selene: the fairy sent to watch the moon goddess. Nova scatters stardust over the target and it joins up
  // into a constellation (a five-point star, drawn line by line), then Selene drops the moon into the middle of it
  S.starcrossed = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t), N = sideOf(A, 0);
    pop(V, A, H + 40, own(a, 'cry', 'Moon Queen orders!'), 'float-text buff', 1.2);
    gsap.to(L, { y: -16, duration: 0.2, yoyo: true, repeat: 3 });
    MB.audio.sfx('sparkle');
    for (let i = 0; i < 14; i++) {
      const s = V.billboard('petal', MB.pick(['✨', '⭐', '✨']), N.x, A.y);
      s.body.style.fontSize = '30px';
      path(s, arc(N, { x: T.x + rnd(-130, 130), y: T.y + rnd(-30, 30) }, H * 0.6, hT + rnd(-60, 90), 80), 0.55, 'power1.out').then(() => fadeOut(s, 0.4, 0.3));
      await wait(0.05);
    }
    const pts = [0, 1, 2, 3, 4].map((k) => { const an = -Math.PI / 2 + (k * 2 * Math.PI) / 5; return [160 + Math.cos(an) * 140, 100 + Math.sin(an) * 80]; });
    const d = [0, 2, 4, 1, 3, 0].map((k, i) => (i ? 'L' : 'M') + pts[k][0].toFixed(0) + ',' + pts[k][1].toFixed(0)).join(' ');
    const dots = pts.map(([x, y]) => `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="8" fill="#fff" stroke="${c}" stroke-width="3"/>`).join('');
    const board = svgBoard(V, T, hT, 320, 200, `<path class="d" d="${d}" stroke="${c}" stroke-width="5"/>${dots}`);
    gsap.from(board.body, { scale: 0.3, opacity: 0, duration: 0.3 });
    MB.audio.sfx('melody');
    draw(board.body.querySelectorAll('.d'), { duration: 0.8, ease: 'power1.inOut' });
    await wait(0.9);
    gsap.to(R, { y: -16, duration: 0.2, yoyo: true, repeat: 3 });
    pop(V, sideOf(A, 1), H + 40, '🌙', 'float-text cute', 0.8);
    MB.audio.sfx('holy');
    flash(V, T, hT, '#cfe0ff', 300);
    const moon = V.billboard('thrown', '🌕', T.x, T.y);
    moon.body.style.fontSize = '130px';
    gsap.set(moon.body, { y: -(hT + 400) });
    MB.audio.sfx('incoming');
    await gsap.to(moon.body, { y: -hT * 0.8, duration: 0.4, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(16); V.hitStop();
    squash(tv, 0.6);
    gsap.to(board.body, { scale: 0.2, opacity: 0, duration: 0.4, ease: 'power3.in', onComplete: () => board.remove() });
    scatter(V, T, hT, ['⭐', '🌙', '💗', '✨'], 14, 170);
    ring(V, T, '#cfe0ff', 2.4, 0.8);
    fadeOut(moon, 0.3, 0.4);
    pop(V, T, hT + 150, own(a, 'finish', 'Written in the stars.'), 'float-text cute', 1.2);
    await wait(0.6);
    resetDuo(v);
  };

  // Kai & Lysander: the surfer who talks to the sea and the siren who came from it. Kai asks the sea to listen, Lysander
  // sings, a wall of waves rises round the target, the sea's friends leap in one by one, and a whale breaches under it
  S.seasong = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    pop(V, sideOf(A, 0), H + 50, own(a, 'cry', 'Hey, sea. Listen.'), 'float-text cute', 1.2);
    gsap.to(L, { y: 8, duration: 0.3 });
    await wait(0.5);
    gsap.to(R, { y: -14, duration: 0.15, yoyo: true, repeat: 7 });
    MB.audio.sfx('melody');
    for (let i = 0; i < 3; i++) {
      const w = soundwave(V, { x: sideOf(A, 1).x + sg * (60 + i * 40), y: A.y }, c, sg);
      gsap.set(w.body, { y: -H * 0.6 });
      fadeOut(w, 0.35, 0.3);
      scatter(V, sideOf(A, 1), H * 0.7, ['🎵', '🎶'], 2, 80);
      await wait(0.14);
    }
    MB.audio.sfx('wave');
    for (let i = 0; i < 5; i++) fadeOut(propAt(V, { x: T.x + (i - 2) * 45, y: T.y + 10 }, 20, '🌊', 70), 1.6, 0.3);
    await wait(0.5);
    const crew = ['🐬', '🐢', '🦀', '🐟', '🦦'];
    for (let i = 0; i < crew.length; i++) {
      const b = V.billboard('thrown', crew[i], A.x, A.y), P = { x: T.x + rnd(-30, 30), y: T.y + rnd(-10, 10) };
      b.body.style.fontSize = '58px';
      path(b, (k) => ({ ...arc(sideOf(A, i % 2), P, H * 0.5, hT, 120)(k), r: k * 360 }), 0.45, 'power1.in').then(() => { b.remove(); hit(V, t, '#6ac0ff', false); MB.audio.sfx('splash'); });
      await wait(0.18);
    }
    await wait(0.3);
    const whale = V.billboard('thrown', '🐋', T.x, T.y);
    whale.body.style.fontSize = '170px';
    gsap.set(whale.body, { y: -5, scale: 0.3 });
    MB.audio.sfx('splash');
    await gsap.to(whale.body, { y: -hT * 0.9, scale: 1, duration: 0.4, ease: 'power2.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(18); V.hitStop();
    squash(tv, 0.55);
    scatter(V, T, hT, ['💦', '🐚', '🐟', '🎵'], 14, 180);
    ring(V, T, '#6ac0ff', 2.6, 0.8);
    gsap.to(whale.body, { y: -4, scale: 0.4, opacity: 0, duration: 0.5, delay: 0.3, ease: 'power2.in', onComplete: () => whale.remove() });
    pop(V, T, hT + 160, own(a, 'finish', 'The sea sends its regards.'), 'float-text cute', 1.2);
    await wait(0.8);
    resetDuo(v);
  };

  // Cassian & Henry: a ghost journalist and a mystery author solve the case. A magnifying glass sweeps over the target,
  // clues (a clipping, a draft, an old watch) pin themselves round it, red string joins them up, and GUILTY is stamped
  S.whodunit = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'The culprit is...'), 'float-text cute', 1.2);
    gsap.to(L, { opacity: 0.5, duration: 0.3 });
    const lens = V.billboard('thrown', '🔍', T.x - 120, T.y);
    lens.body.style.fontSize = '72px';
    MB.audio.sfx('whoosh');
    await path(lens, (k) => ({ x: lerp(T.x - 120, T.x + 120, k), y: T.y, h: hT + Math.sin(k * Math.PI * 3) * 30, r: Math.sin(k * Math.PI * 2) * 10 }), 0.9, 'sine.inOut');
    fadeOut(lens, 0, 0.2);
    gsap.to(L, { opacity: 1, duration: 0.3 });
    const pins = [['📰', 30, 160], ['📄', 160, 20], ['🕰️', 290, 160]], board = svgBoard(V, T, hT, 320, 200, '<path class="d" d="M30,160 L160,20 L290,160 Z" stroke="#d02a3a" stroke-width="5"/>');
    for (let i = 0; i < 3; i++) {
      const [ch, x, y] = pins[i], P = { x: T.x + (x - 160) * 0.8, y: T.y + 4 };
      const b = V.billboard('thrown', ch, A.x, A.y);
      b.body.style.fontSize = '46px';
      path(b, (k) => ({ ...arc(sideOf(A, i % 2), P, H * 0.5, hT * 2 - y * 0.6 + 30, 60)(k), r: k * 360 }), 0.5, 'power1.out').then(() => { MB.audio.sfx('tink'); fadeOut(b, 1.6, 0.3); });
      await wait(0.2);
    }
    await wait(0.4);
    MB.audio.sfx('draw');
    draw(board.body.querySelectorAll('.d'), { duration: 0.7, ease: 'power1.inOut' });
    fadeOut(board, 1.2, 0.3);
    await wait(0.8);
    pop(V, sideOf(A, 1), H + 50, '💡', 'float-text buff', 0.8);
    MB.audio.sfx('ding');
    await wait(0.3);
    await slamStamp(V, T, hT, 'GUILTY', '#d02a3a');
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    squash(tv, 0.6);
    scatter(V, T, hT, ['📰', '📄', '🔍', '✨'], 12, 160);
    pop(V, T, hT + 160, own(a, 'finish', 'Case closed. ...Where was I?'), 'float-text cute', 1.2);
    await wait(0.8);
    resetDuo(v);
  };

  // Ember & Adriana: an Ifrit handyman and a nymph who hates fire. Ember flicks a tiny spark, Adriana yells NO FIRE and
  // grows a vine in front of it as a barrier... which carries the spark straight to the target and blooms in flames
  S.fireflower = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Just a tiny spark...'), 'float-text burn', 1.1);
    const spark = propAt(V, sideOf(A, 0), H * 0.6, '🔥', 36);
    MB.audio.sfx('fire');
    await wait(0.5);
    pop(V, sideOf(A, 1), H + 60, 'NO FIRE!!', 'float-text dmg', 0.8);
    gsap.to(R, { rotation: 6, duration: 0.06, yoyo: true, repeat: 7 });
    MB.audio.sfx('vines');
    await wait(0.4);
    for (let j = 1; j <= 8; j++) {
      const vn = propAt(V, { x: lerp(A.x, T.x, j / 9), y: lerp(A.y, T.y, j / 9) }, 18, '🌿', 46);
      fadeOut(vn, 1.2, 0.3);
      await wait(0.06);
    }
    pop(V, sideOf(A, 1), H + 60, 'Oh no...', 'float-text cute', 0.8);
    gsap.to(spark.body, { y: -18, duration: 0.2 });
    await wait(0.3);
    fadeOut(spark, 0, 0.1);
    MB.audio.sfx('sizzle');
    for (let j = 1; j <= 8; j++) {
      fadeOut(propAt(V, { x: lerp(A.x, T.x, j / 9), y: lerp(A.y, T.y, j / 9) }, 18, '🔥', 52), 0.2, 0.3);
      await wait(0.07);
    }
    for (let i = 0; i < 6; i++) {
      const bl = V.billboard('thrown', i % 2 ? '🔥' : '🌺', T.x + rnd(-50, 50), T.y + rnd(-8, 8));
      bl.body.style.fontSize = '70px';
      gsap.fromTo(bl.body, { y: -10, scale: 0.2 }, { y: -(hT * 0.6 + rnd(-20, 50)), scale: 1, duration: 0.3, delay: i * 0.04, ease: 'back.out(2)' });
      fadeOut(bl, 0.9, 0.3);
    }
    await wait(0.4);
    impact(); hit(V, t, c, true); MB.audio.sfx('boom'); V.shake(16); V.hitStop();
    tint(tv, 'brightness(1.7) sepia(1) hue-rotate(-25deg)', 1.2);
    squash(tv, 0.6);
    scatter(V, T, hT, ['🌺', '🔥', '🌸', '✨'], 14, 170);
    pop(V, sideOf(A, 0), H + 40, 'Sorry!!', 'float-text cute', 0.9);
    pop(V, T, hT + 160, own(a, 'finish', 'Ember! ...It is pretty, though.'), 'float-text cute', 1.2);
    await wait(0.8);
    resetDuo(v);
  };

  // Finn: a ballet student and a perfectionist. Fouetté turns across the board in a trail of feathers, then a grand
  // jeté over the target and down onto it, landing in an arabesque
  S.swanlake = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'And... one, two, three.'), 'float-text cute', 1);
    MB.audio.sfx('piano');
    for (let i = 1; i <= 3; i++) {
      const P = { x: lerp(A.x, C.x, i / 4), y: lerp(A.y, C.y, i / 4) };
      gsap.to(v.figure, { rotationY: '+=360', duration: 0.3, ease: 'power1.inOut' });
      await gsap.to(v.el, { x: P.x, y: P.y, duration: 0.3, ease: 'sine.inOut', onUpdate: () => ghost(V, v, c) });
      const f = V.billboard('petal', '🪶', P.x + rnd(-30, 30), P.y);
      f.body.style.fontSize = '30px';
      gsap.set(f.body, { y: -H * 0.5 });
      gsap.to(f.body, { y: -H * 0.1, rotation: rnd(-180, 180), opacity: 0, duration: 1.2, ease: 'sine.in', onComplete: () => f.remove() });
      MB.audio.sfx('swish');
    }
    gsap.set(v.figure, { rotationY: 0 });
    MB.audio.sfx('whoosh');
    await Promise.all([gsap.to(v.el, { x: T.x, y: T.y, duration: 0.5, ease: 'none', onUpdate: () => ghost(V, v, '#ffffff') }),
      gsap.to(v.figure, { keyframes: [{ y: -170, duration: 0.25, ease: 'power2.out' }, { y: -20, duration: 0.25, ease: 'power2.in' }] })]);
    impact(); hit(V, t, c, true); MB.audio.sfx('stomp'); V.shake(14); V.hitStop();
    squash(tv, 0.6);
    scatter(V, T, hT, ['🪶', '🦢', '✨'], 12, 170);
    await gsap.to(v.figure, { y: 0, rotation: -d.x * 18, duration: 0.2 }); // arabesque
    pop(V, T, hT + 150, own(a, 'finish', 'Bravo? ...Too much?'), 'float-text cute', 1.1);
    await wait(0.4);
    await goHome(v, A, 0.5);
  };

  // Velour: the café's night maid, 223 years old. After closing, candles light one by one round the target, bats spill
  // out of the dark, he is suddenly at its neck, and the candles blow out
  S.candelabra = async (V, a, t, impact) => {
    const { v, A, C, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', 'The café is closed, dear guest.'), 'float-text cute', 1.2);
    const candles = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      candles.push(propAt(V, { x: T.x + Math.cos(ang) * 120, y: T.y + Math.sin(ang) * 40 }, 20, '🕯️', 40));
      MB.audio.sfx('tink');
      await wait(0.1);
    }
    MB.audio.sfx('flutter');
    for (let i = 0; i < 8; i++) {
      const b = V.billboard('thrown bat', '🦇', T.x, T.y);
      gsap.set(b.body, { y: -hT });
      gsap.to(b, { x: T.x + rnd(-260, 260), y: T.y + rnd(-80, 60), duration: 0.8, ease: 'power1.out' });
      gsap.to(b.body, { y: -hT - rnd(80, 220), opacity: 0, duration: 0.8, ease: 'power1.out', onComplete: () => b.remove() });
    }
    gsap.to(v.figure, { opacity: 0, duration: 0.15 });
    MB.audio.sfx('blink');
    await wait(0.3);
    gsap.set(v.el, { x: C.x, y: C.y });
    await gsap.to(v.figure, { opacity: 1, duration: 0.12 });
    impact(); hit(V, t, c, true); MB.audio.sfx('chomp'); V.shake(10); V.hitStop();
    pop(V, T, hT * 2 + 30, '♥', 'float-text dmg', 0.8);
    tint(tv, 'saturate(0.3) brightness(1.4)', 1);
    for (let i = 0; i < 10; i++) {
      const s = dot(V, T, hT * 1.5, '#c0182a', 12, 'spark plus');
      path(s, arc(T, C, hT * 1.5, H * 0.75, 30), 0.35, 'sine.in').then(() => s.remove());
      await wait(0.03);
    }
    MB.audio.sfx('wind');
    candles.forEach((cd, i) => { puff(V, { x: gsap.getProperty(cd, 'x'), y: gsap.getProperty(cd, 'y') }, '#8a8090', 2, 50, 0.4); fadeOut(cd, i * 0.05, 0.2); });
    pop(V, T, hT + 140, own(a, 'finish', 'Delicious. Do come again.'), 'float-text cute', 1.2);
    await goHome(v, A);
  };

  // Cupid: the god of love has taken an interest. He flutters up with his bells jingling, looses a heart-tipped arrow,
  // and the red string of fate ties the target to him. One tug, and it tumbles over, heart-eyed
  S.redstring = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    MB.audio.sfx('flutter'); MB.audio.sfx('ding');
    await gsap.to(v.figure, { y: -50, duration: 0.35, ease: 'sine.out' });
    const bob = gsap.to(v.figure, { y: -62, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    pop(V, A, H + 150, own(a, 'cry', 'Oh, I ship it~'), 'float-text cute', 1);
    const ar = V.billboard('thrown', '💘', A.x, A.y);
    ar.body.style.fontSize = '60px';
    MB.audio.sfx('twang');
    await path(ar, arc(A, T, H * 0.8, hT, 60), 0.35, 'power1.in', (p) => {
      if (Math.random() < 0.5) {
        const h = V.billboard('petal', '💗', p.x, p.y);
        h.body.style.fontSize = '18px';
        gsap.set(h.body, { y: -p.h });
        gsap.to(h.body, { y: -p.h - 30, opacity: 0, duration: 0.5, onComplete: () => h.remove() });
      }
    });
    ar.remove();
    impact(); hit(V, t, '#ff5fa2'); MB.audio.sfx('kiss'); V.hitStop();
    const line = strip(V, A, T, 'yarn-line', '#ff3a5a');
    MB.audio.sfx('stretch');
    if (tv) dizzy(V, T, hT * 2 + 10, ['💗', '💞', '💘'], 1.3);
    await wait(0.5);
    MB.audio.sfx('whoosh');
    if (tv) await gsap.fromTo(tv.figure, { rotation: 0 }, { rotation: (A.x > T.x ? 1 : -1) * 35, duration: 0.15, yoyo: true, repeat: 1 });
    V.shake(12); burst(V, T, '#ff5fa2', 14, { h: hT });
    scatter(V, T, hT, ['💗', '💘', '🔔'], 10, 150);
    gsap.to(line, { opacity: 0, duration: 0.4, onComplete: () => line.remove() });
    pop(V, T, hT + 150, own(a, 'finish', 'Slow burn. My favorite.'), 'float-text cute', 1.2);
    bob.kill();
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  // Dani: a gyaru from Valencia. A purikura booth frame snaps round the target, three, two, one, FLASH, and she
  // decorates the shot with stickers before the print pops out and flies back to her
  S.purikura = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), tv = victim(V, t), H = V.heightOf(a);
    pop(V, A, H + 95, own(a, 'cry', '¡Oye! Say cheese, bestie!'), 'float-text cute', 1.1);
    const fr = V.billboard('fx-purikura', '<b>♡ BFF ♡</b>', T.x, T.y);
    fr.body.style.setProperty('--c', c);
    fr.body.style.height = hT * 2 + 60 + 'px';
    gsap.set(fr.body, { yPercent: -100, y: 20 });
    MB.audio.sfx('pop');
    await gsap.fromTo(fr.body, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    for (const n of ['3', '2', '1']) { MB.audio.sfx('tick'); pop(V, T, hT * 2 + 110, n, 'float-text buff', 0.4); await wait(0.3); }
    MB.audio.sfx('camera');
    flash(V, T, hT, '#ffffff', 420);
    impact(); hit(V, t, c, true); V.shake(10); V.hitStop();
    tint(tv, 'brightness(2.2) saturate(0.4)', 0.6);
    const stickers = ['💖', '⭐', '🎀', '✌️', '💅', '✨'];
    for (let i = 0; i < 6; i++) {
      const s = propAt(V, { x: T.x + rnd(-70, 70), y: T.y }, rnd(hT * 0.6, hT * 2 + 30), stickers[i], 40);
      gsap.set(s.body, { rotation: rnd(-25, 25) });
      MB.audio.sfx('pop'); fadeOut(s, 0.9 - i * 0.08);
      await wait(0.08);
    }
    pop(V, T, hT * 2 + 80, 'KAWAII♡', 'float-text cute', 1);
    await wait(0.5);
    const print = propAt(V, T, hT, '🖼️', 50);
    MB.audio.sfx('swipe');
    gsap.to(fr.body, { scale: 0, opacity: 0, duration: 0.25, onComplete: () => fr.remove() });
    await path(print, (k) => ({ ...arc(T, A, hT, H * 0.8, 90)(k), r: k * 360 }), 0.5, 'power1.inOut');
    print.remove();
    pop(V, A, H + 60, own(a, 'finish', 'Slay. Totally slay. 💅'), 'float-text cute', 1.1);
  };

  // Zero: headphones on, world off. Four lanes of arrows scroll down onto a judgement line over the target; every note
  // he hits is a hit on it, and it ends in a FULL COMBO he pretends not to care about
  S.rhythm = async (V, a, t, impact) => {
    const { A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), judge = hT * 2 + 50;
    pop(V, A, H + 95, own(a, 'cry', '...Fine. One song.'), 'float-text code', 1);
    const phones = propAt(V, A, H + 20, '🎧', 50);
    MB.audio.sfx('melody');
    const bar = V.billboard('fx-judge', '', T.x, T.y);
    bar.body.style.setProperty('--c', c);
    gsap.set(bar.body, { y: -judge });
    gsap.fromTo(bar.body, { scaleX: 0 }, { scaleX: 1, duration: 0.2 });
    const lanes = ['←', '↓', '↑', '→'], seq = [0, 2, 1, 3, 2, 0, 3];
    const grades = ['PERFECT', 'GREAT', 'PERFECT', 'PERFECT', 'GOOD', 'PERFECT', 'PERFECT'];
    let first = true;
    await Promise.all(seq.map(async (ln, i) => {
      await wait(i * 0.16);
      const X = T.x + (ln - 1.5) * 46, n = V.billboard('fx-note', lanes[ln], X, T.y);
      n.body.style.setProperty('--c', c);
      await gsap.fromTo(n.body, { y: -judge - 260, opacity: 0 }, { y: -judge, opacity: 1, duration: 0.45, ease: 'none' });
      n.remove();
      pop(V, { x: X, y: T.y }, judge + 50, grades[i], grades[i] === 'PERFECT' ? 'float-text code' : 'float-text buff', 0.45);
      MB.audio.sfx('tink'); ring(V, T, c, 0.8, 0.3); burst(V, T, c, 5, { h: hT, spread: 70 });
      if (first) { first = false; impact(); hit(V, t, c); }
    }));
    MB.audio.sfx('fanfare');
    hit(V, t, c, true); V.shake(14); V.hitStop();
    pop(V, T, judge + 110, 'FULL COMBO!', 'float-text buff', 1);
    gsap.to(bar.body, { opacity: 0, duration: 0.3, onComplete: () => bar.remove() });
    fadeOut(phones, 0.3);
    pop(V, A, H + 60, own(a, 'finish', '...Whatever. GG.'), 'float-text code', 1.1);
    await wait(0.3);
  };

  // ---- duo styles: Cries behind Snowfall, Sugar & Sweethearts
  // Atsuo & Keiko, who run the Spur lodge: the old man lights a lantern and tells a ghost story, an oni's shadow rises
  // over the target... and his daughter throws purifying salt, so it slams down on the target instead of the guests
  S.oninight = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    const lamp = propAt(V, A, H + 30, '🏮', 54);
    MB.audio.sfx('fire');
    const swing = gsap.to(lamp.body, { rotation: 8, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    for (const w of ['Long ago...', 'on a night of snow...', 'an ONI came down!']) {
      pop(V, sideOf(A, 0), H + 80, w, 'float-text boo', 0.9); MB.audio.sfx('tick'); await wait(0.45);
    }
    const oni = V.billboard('thrown', '👹', T.x, T.y);
    oni.body.style.fontSize = '240px';
    oni.body.style.filter = 'brightness(0.15) drop-shadow(0 0 20px #ff2a2a)';
    gsap.set(oni.body, { y: -hT * 2 - 40, transformOrigin: '50% 100%' });
    MB.audio.sfx('dark'); MB.audio.sfx('stomp');
    await gsap.fromTo(oni.body, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.5, ease: 'power2.out' });
    if (tv) gsap.fromTo(tv.figure, { x: -8 }, { x: 8, duration: 0.05, yoyo: true, repeat: 7, onComplete: () => gsap.set(tv.figure, { x: 0 }) });
    pop(V, sideOf(A, 1), H + 70, own(a, 'cry', "Father! You'll scare the guests!"), 'float-text heal', 1);
    MB.audio.sfx('whoosh');
    for (let i = 0; i < 14; i++) {  // a fistful of salt
      const s = dot(V, sideOf(A, 1), H * 0.6, '#ffffff', rnd(5, 9), 'spark');
      path(s, arc(sideOf(A, 1), { x: T.x + rnd(-50, 50), y: T.y + rnd(-20, 20) }, H * 0.6, hT * 2, 120), rnd(0.35, 0.5), 'power1.in').then(() => s.remove());
    }
    await wait(0.45);
    MB.audio.sfx('holy');
    flash(V, T, hT * 2, '#ffffff', 300);
    await gsap.to(oni.body, { y: -hT * 0.6, scaleY: 0.6, duration: 0.2, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
    squash(tv, 0.5);
    cracks(V, T, '#2b1d12', { n: 8, len: 160, glow: c });
    puff(V, T, '#3a2a3a', 10, hT, 1.2);
    fadeOut(oni, 0.1, 0.3);
    fadeOut(lamp, 0.3);
    gsap.delayedCall(0.7, () => swing.kill());
    pop(V, sideOf(A, 0), H + 60, 'Hohoho! Works every time.', 'float-text buff', 1.2);
    pop(V, T, hT + 140, own(a, 'finish', 'Dinner is at seven, dear.'), 'float-text heal', 1.1);
    await wait(0.4);
    resetDuo(v);
  };

  // Fumiko & Mitsuye, the Nagano cop and her biker friend: siren on, Mitsuye's bike circles the target twice with
  // Fumiko riding pillion, then the cop jumps off, blade first, and the cuffs come down
  S.pursuit = async (V, a, t, impact) => {
    const { v, A, C, T, d, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 40, own(a, 'cry', 'Hop on, officer~'), 'float-text burn', 1);
    MB.audio.sfx('whistle');
    const siren = propAt(V, A, H + 50, '🚨', 50), bike = propAt(V, A, 30, '🏍️', 80);
    const flick = gsap.to(siren.body, { rotation: 20, duration: 0.1, yoyo: true, repeat: -1 });
    const loop = (k) => { const ang = -Math.PI / 2 + k * Math.PI * 4; return { x: T.x + Math.cos(ang) * 150, y: T.y + Math.sin(ang) * 55 }; };
    MB.audio.sfx('honk'); MB.audio.sfx('zip');
    const P0 = loop(0);
    await gsap.to([v.el, bike, siren], { x: P0.x, y: P0.y, duration: 0.3 });
    if (tv) gsap.fromTo(tv.img, { filter: 'drop-shadow(0 0 14px #ff2a3a)' }, { filter: 'drop-shadow(0 0 14px #2a6aff)', duration: 0.2, yoyo: true, repeat: 5, clearProps: 'filter' });
    const q = { k: 0 };
    await gsap.to(q, { k: 1, duration: 1.1, ease: 'none', onUpdate: () => { const P = loop(q.k); gsap.set([v.el, bike, siren], { x: P.x, y: P.y }); ghost(V, v, c); } });
    pop(V, here(v), H + 60, 'FREEZE! Nagano PD!', 'float-text buff', 0.9);
    MB.audio.sfx('unsheathe');
    await gsap.to(v.el, { x: C.x, y: C.y, duration: 0.2, ease: 'power3.in' });
    slashArc(V, T, -hT * 1.6, c, d.x >= 0 ? 70 : -70);
    impact(); hit(V, t, c, true); MB.audio.sfx('clang'); V.shake(18); V.hitStop();
    const cuffs = propAt(V, T, hT * 2 + 100, '⛓️', 64);
    await gsap.to(cuffs.body, { y: -hT, duration: 0.25, ease: 'power3.in' });
    MB.audio.sfx('clang'); fadeOut(cuffs, 0.4);
    fadeOut(siren, 0.2); fadeOut(bike, 0.2);
    gsap.delayedCall(0.6, () => flick.kill());
    pop(V, T, hT + 140, own(a, 'finish', 'Drinks are on you tonight~'), 'float-text burn', 1.1);
    await goHome(v, A);
    resetDuo(v);
  };

  // Momo & Dante, the Douceur Café kitchen: Dante heaves the tray, Momo pipes cream puffs, and together they stack a
  // croquembouche over the target, spin caramel round it, crown it with a flower... and it topples onto it
  S.croquembouche = async (V, a, t, impact) => {
    const { v, A, T, hT } = ctx(V, a, t), [, R] = duo(v), H = V.heightOf(a), tv = victim(V, t), M = sideOf(A, 0);
    pop(V, sideOf(A, 1), H + 50, '💪 Tray up!', 'float-text buff', 0.9);
    await gsap.to(R, { y: -14, duration: 0.12, yoyo: true, repeat: 1 });
    pop(V, M, H + 90, own(a, 'cry', 'P-piping now! Oui, chef!'), 'float-text cute', 1);
    const puffs = [];
    let h = hT * 2 + 20;
    for (const n of [5, 4, 3, 2, 1]) {
      for (let i = 0; i < n; i++) {
        const p = dot(V, M, H * 0.6, '#e8b060', 28, 'spark');
        path(p, arc(M, { x: T.x + (i - (n - 1) / 2) * 30, y: T.y }, H * 0.6, h, 80), 0.3, 'power1.out');
        puffs.push(p);
        await wait(0.04);
      }
      MB.audio.sfx('pop');
      h += 26;
    }
    await wait(0.3);
    MB.audio.sfx('sizzle');
    const q = { a: 0 }, turns = Math.PI * 6;
    await gsap.to(q, { a: turns, duration: 0.7, ease: 'none', onUpdate: () => {
      const s = dot(V, { x: T.x + Math.cos(q.a) * 80, y: T.y + Math.sin(q.a) * 25 }, hT * 2 + 20 + (q.a / turns) * 130, '#ffcf6a', 7, 'spark plus');
      gsap.to(s.body, { opacity: 0, duration: 0.5, onComplete: () => s.remove() });
    } });
    const flower = propAt(V, T, h + 20, '🌸', 50);
    MB.audio.sfx('ding');
    pop(V, sideOf(A, 1), H + 60, 'Voilà. Service!', 'float-text buff', 1);
    await wait(0.35);
    MB.audio.sfx('whistleDown');
    puffs.forEach((p, i) => gsap.to(p.body, { y: -hT * rnd(0.3, 1), duration: 0.3, delay: i * 0.01, ease: 'power2.in' }));
    await gsap.to(flower.body, { y: -hT, rotation: 120, duration: 0.35, ease: 'power2.in' });
    impact(); hit(V, t, '#e8b060', true); MB.audio.sfx('splat'); V.shake(18); V.hitStop();
    squash(tv, 0.55);
    puffs.forEach((p) => toss(p, { v: [200, 420], dur: 0.7 }));
    fadeOut(flower, 0.2);
    scatter(V, T, hT, ['🌸', '✨', '🍮'], 10, 160);
    pop(V, T, hT + 150, own(a, 'finish', "Oops! ...Still delicious!"), 'float-text cute', 1.2);
    await wait(0.4);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- relationship fusion
  // full-screen anime cut-in with both partners in their fusion costumes
  function cutin(bond) {
    const T = MB.BOND_TIERS[bond.tier], tier = bond.tier, [a, b] = bond.pair;
    const ov = document.createElement('div');
    ov.className = 'bond-cutin t' + tier;
    ov.style.setProperty('--c', bond.attack.color);
    ov.innerHTML = `<div class="bc-flash"></div><div class="bc-band"><div class="bc-rays"></div></div>
      <img class="bc-a" src="${MB.bigSpriteUrl(a, 'play', bond.costumes[0])}"><img class="bc-b" src="${MB.bigSpriteUrl(b, 'play', bond.costumes[1])}">
      <div class="bc-title"><small>${T.name.toUpperCase()} ${T.hearts}</small><b>${bond.name}</b><span>${bond.relation}</span></div>`;
    document.getElementById('ui-root').appendChild(ov);
    const band = ov.querySelector('.bc-band'), A = ov.querySelector('.bc-a'), B = ov.querySelector('.bc-b'), title = ov.querySelector('.bc-title');
    const hold = 0.5 + tier * 0.3;
    MB.audio.sfx('bond', tier); MB.audio.sfx('fusion');
    for (let i = 0; i < 8 + tier * 6; i++) {
      const h = document.createElement('div');
      h.className = 'bc-heart';
      h.textContent = MB.pick(['♥', '♥', '✦', '💞']);
      ov.appendChild(h);
      const x = rnd(80, 1520);
      gsap.fromTo(h, { x, y: 700, opacity: 0, scale: rnd(0.6, 1.4) },
        { x: x + rnd(-80, 80), y: rnd(220, 420), opacity: 1, duration: rnd(0.8, 1.4), delay: rnd(0, hold * 0.8), ease: 'power1.out' });
      gsap.to(h, { opacity: 0, duration: 0.3, delay: hold + 0.4 });
    }
    const tl = gsap.timeline({ onComplete: () => ov.remove() });
    tl.fromTo(ov.querySelector('.bc-flash'), { opacity: 0.2 + tier * 0.2 }, { opacity: 0, duration: 0.5 }, 0)
      .fromTo(band, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: 'power3.out' }, 0)
      .fromTo(ov.querySelector('.bc-rays'), { rotation: 0 }, { rotation: 40 + tier * 20, duration: hold + 0.8, ease: 'none' }, 0)
      .fromTo(A, { x: -700, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 0.1)
      .fromTo(B, { x: 700, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 0.1)
      .fromTo(title, { scale: 2.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.25)
      .to(A, { x: 40, duration: hold, ease: 'none' }, 0.55)
      .to(B, { x: -40, duration: hold, ease: 'none' }, 0.55)
      .to([A, B, title], { opacity: 0, duration: 0.2 }, 0.55 + hold)
      .to(band, { scaleY: 0, duration: 0.22, ease: 'power3.in' }, 0.6 + hold);
    if (tier >= 3) tl.fromTo(title, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.2)' }, 0.5);
    return tl;
  }

  // the partners send hearts to each other, the cut-in plays, they spin into one spot and the duo lands
  async function fusion(V, va, vb, P, bond, makeNew) {
    const c = bond.attack.color, tier = bond.tier, H = MB.LAYOUT.UNIT_H;
    const olds = [va, vb].filter(Boolean);
    MB.audio.sfx('sparkle');
    olds.forEach((v) => { v.el.classList.add('acting'); gsap.to(v.img, { filter: `drop-shadow(0 0 16px ${c}) brightness(1.3)`, duration: 0.3 }); });
    if (va && vb) {
      const A = V.pos(vb.ent), B = V.pos(va.ent);
      for (let i = 0; i < 6; i++) {
        const h = V.billboard('petal', '💗', A.x, A.y);
        path(h, (k) => ({ ...arc(A, B, H * 0.55, H * 0.55, 90)(k), s: 0.7 + Math.sin(k * Math.PI) * 0.7 }), 0.6, 'sine.inOut').then(() => h.remove());
        await wait(0.07);
      }
    }
    await wait(0.4);
    await cutin(bond);
    MB.audio.sfx('whoosh');
    await Promise.all(olds.map((v) => gsap.timeline()
      .to(v.el, { x: P.x, y: P.y, duration: 0.55, ease: 'power2.in' })
      .to(v.figure, { y: -160, rotationY: 720, duration: 0.55, ease: 'power2.in' }, 0)
      .to(v.figure, { scale: 0.2, opacity: 0, duration: 0.2 }, 0.4)));
    olds.forEach((v) => v.el.remove());
    MB.audio.sfx('slam'); V.shake(8 + tier * 6);
    if (tier >= 3) V.hitStop();
    flash(V, P, H * 0.5, '#ffffff', 300 + tier * 60);
    ring(V, P, c, 2 + tier * 0.6, 0.8);
    if (tier >= 2) ring(V, P, '#ffffff', 1.6 + tier * 0.5, 0.6);
    burst(V, P, c, 16 + tier * 8, { h: H * 0.5, spread: 160 });
    scatter(V, P, H * 0.5, ['💗', '💕', '✨'], 6 + tier * 4, 150);
    const v = makeNew();
    MB.audio.sfx('buff');
    const name = V.billboard('float-text bond-name', `${MB.BOND_TIERS[tier].hearts} ${bond.name}!`, P.x, P.y);
    gsap.set(name.body, { y: -H - 50 });
    gsap.timeline({ onComplete: () => name.remove() })
      .fromTo(name.body, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
      .to(name.body, { y: -H - 110, opacity: 0, duration: 0.5, delay: 1.1 });
    const tl = gsap.timeline();
    tl.from(v.figure, { y: -320, scale: 0.6, opacity: 0, duration: 0.4, ease: 'power3.in' })
      .to(v.img, { scaleY: 0.82, scaleX: 1.14, duration: 0.08 })
      .to(v.img, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' })
      .call(() => { ring(V, P, c, 1.8); burst(V, P, c, 14, { h: 20, spread: 120 }); V.shake(6); }, null, 0.4);
    await tl;
    rise(V, P, c, 10 + tier * 4, H);
    await wait(0.3);
  }

  // ---------------------------------------------------------------- item combos
  // a short cut-in: the partner in the combo's outfit on one side, the item spinning in on the other
  function comboCutin(c, item, color) {
    const ov = document.createElement('div');
    ov.className = 'bond-cutin combo-cutin';
    ov.style.setProperty('--c', color);
    ov.innerHTML = `<div class="bc-flash"></div><div class="bc-band"><div class="bc-rays"></div></div>
      <img class="bc-a" src="${MB.bigSpriteUrl(c.char, 'play', c.costume)}"><img class="bc-item" src="${MB.itemIcon(item.id)}">
      <div class="bc-title"><small>🔗 ITEM COMBO</small><b>${c.name}</b><span>${c.line || ''}</span></div>`;
    document.getElementById('ui-root').appendChild(ov);
    const band = ov.querySelector('.bc-band'), A = ov.querySelector('.bc-a'), I = ov.querySelector('.bc-item'), title = ov.querySelector('.bc-title');
    MB.audio.sfx('fusion'); MB.audio.sfx('glint');
    return gsap.timeline({ onComplete: () => ov.remove() })
      .fromTo(ov.querySelector('.bc-flash'), { opacity: 0.4 }, { opacity: 0, duration: 0.4 }, 0)
      .fromTo(band, { scaleY: 0 }, { scaleY: 1, duration: 0.22, ease: 'power3.out' }, 0)
      .fromTo(ov.querySelector('.bc-rays'), { rotation: 0 }, { rotation: 50, duration: 1.7, ease: 'none' }, 0)
      .fromTo(A, { x: -700, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 0.08)
      .fromTo(I, { x: 700, rotation: 400, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.1)
      .fromTo(title, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, 0.25)
      .to(A, { x: 30, duration: 0.9, ease: 'none' }, 0.5)
      .to(I, { x: -30, rotation: -8, duration: 0.9, ease: 'none' }, 0.6)
      .to([A, I, title], { opacity: 0, duration: 0.2 }, 1.4)
      .to(band, { scaleY: 0, duration: 0.2, ease: 'power3.in' }, 1.45);
  }

  // the partner glows, the cut-in plays, then it spins up, changes (swap) at the top of the spin and lands
  async function combo(V, v, P, c, item, swap) {
    const color = item.color || '#ffd23f', H = MB.LAYOUT.UNIT_H;
    v.el.classList.add('acting');
    gsap.to(v.img, { filter: `drop-shadow(0 0 16px ${color}) brightness(1.3)`, duration: 0.3 });
    await comboCutin(c, item, color);
    MB.audio.sfx('whoosh');
    await gsap.to(v.figure, { y: -140, rotationY: 360, duration: 0.4, ease: 'power2.in' });
    swap();
    flash(V, P, H * 0.5, '#ffffff', 320);
    ring(V, P, color, 2.4, 0.8);
    ring(V, P, '#ffffff', 1.6, 0.6);
    burst(V, P, color, 26, { h: H * 0.5, spread: 160 });
    scatter(V, P, H * 0.5, ['🔗', '✨', '⭐'], 8, 150);
    MB.audio.sfx('buff');
    const name = V.billboard('float-text bond-name combo-name', `🔗 ${c.name}!`, P.x, P.y);
    gsap.set(name.body, { y: -H - 50 });
    gsap.timeline({ onComplete: () => name.remove() })
      .fromTo(name.body, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
      .to(name.body, { y: -H - 110, opacity: 0, duration: 0.5, delay: 1.1 });
    await gsap.to(v.figure, { y: 0, rotationY: 720, duration: 0.5, ease: 'bounce.out' });
    gsap.set(v.figure, { rotationY: 0 });
    MB.audio.sfx('slam'); V.shake(10);
    gsap.to(v.img, { filter: 'drop-shadow(0 0 0px #fff) brightness(1)', duration: 0.4, clearProps: 'filter' });
    v.el.classList.remove('acting');
    rise(V, P, color, 12, H);
    await wait(0.3);
  }

  // ---------------------------------------------------------------- outfit upgrades
  // a cut-in of the new outfit, with the old one greyed out on the other side and a pip for each outfit so far
  function outfitCutin(u, up, color) {
    const ups = u.card.upgrades, n = ups.indexOf(up) + 1, id = u.card.id;
    const ov = document.createElement('div');
    ov.className = 'bond-cutin combo-cutin outfit-cutin';
    ov.style.setProperty('--c', color);
    ov.innerHTML = `<div class="bc-flash"></div><div class="bc-band"><div class="bc-rays"></div></div>
      <img class="bc-b" src="${MB.bigSpriteUrl(id, 'idle', n > 1 ? ups[n - 2].costume : undefined)}"><img class="bc-a" src="${MB.bigSpriteUrl(id, 'play', up.costume)}">
      <div class="bc-title"><small>👗 OUTFIT CHANGE ${n}/${ups.length}</small><b>${up.name}</b><span>${up.line || ''}</span></div>
      <div class="oc-steps">${ups.map((x, i) => `<i class="${i < n ? 'on' : ''}">👗</i>`).join('')}</div>`;
    document.getElementById('ui-root').appendChild(ov);
    const band = ov.querySelector('.bc-band'), A = ov.querySelector('.bc-a'), B = ov.querySelector('.bc-b'), title = ov.querySelector('.bc-title');
    const steps = ov.querySelector('.oc-steps');
    MB.audio.sfx('fusion'); MB.audio.sfx('glint');
    return gsap.timeline({ onComplete: () => ov.remove() })
      .fromTo(ov.querySelector('.bc-flash'), { opacity: 0.4 }, { opacity: 0, duration: 0.4 }, 0)
      .fromTo(band, { scaleY: 0 }, { scaleY: 1, duration: 0.22, ease: 'power3.out' }, 0)
      .fromTo(ov.querySelector('.bc-rays'), { rotation: 0 }, { rotation: 60, duration: 1.9, ease: 'none' }, 0)
      .fromTo(B, { x: 700, opacity: 0 }, { x: 0, opacity: 0.8, duration: 0.35, ease: 'power3.out' }, 0.05)
      .to(B, { x: 60, scale: 0.9, opacity: 0, rotationY: 90, duration: 0.35, ease: 'power2.in' }, 0.55)
      .fromTo(A, { x: -700, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' }, 0.5)
      .fromTo(title, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, 0.6)
      .fromTo(steps.children, { scale: 0 }, { scale: 1, duration: 0.25, stagger: 0.06, ease: 'back.out(3)' }, 0.7)
      .to(A, { x: 40, duration: 0.9, ease: 'none' }, 0.9)
      .to([A, title, steps], { opacity: 0, duration: 0.2 }, 1.7)
      .to(band, { scaleY: 0, duration: 0.2, ease: 'power3.in' }, 1.75);
  }

  // a folding screen goes up in front of the character, clothes fly over the top, the cut-in plays, and the screen
  // drops on the new outfit (swap puts it on)
  async function outfitChange(V, v, P, u, up, swap) {
    const color = (up.attack || u.card.attack).color || '#ff8ac8', H = MB.LAYOUT.UNIT_H;
    v.el.classList.add('acting');
    const scr = V.billboard('wardrobe-screen', '<i></i><i></i><i></i>', P.x, P.y + 30);
    scr.body.style.setProperty('--c', color);
    gsap.set(scr.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    MB.audio.sfx('whoosh');
    await gsap.fromTo(scr.body, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' });
    MB.audio.sfx('swish');
    gsap.to(scr.body, { rotation: 2, duration: 0.08, yoyo: true, repeat: 9 });
    for (let i = 0; i < 9; i++) {
      const b = V.billboard('petal', MB.pick(['👗', '👚', '🎀', '🧦', '👠', '👒', ...(up.emoji || [])]), P.x + rnd(-40, 40), P.y + 30);
      b.body.style.fontSize = rnd(30, 44) + 'px';
      gsap.set(b.body, { y: -H * 0.95 });
      toss(b, { v: [300, 520], ang: [-140, -40], dur: 0.9 });
      await wait(0.06);
    }
    await outfitCutin(u, up, color);
    swap();
    gsap.to(scr.body, { scaleX: 0, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => scr.remove() });
    await gsap.fromTo(v.figure, { rotationY: -180 }, { rotationY: 0, duration: 0.5, ease: 'back.out(1.4)' });
    flash(V, P, H * 0.5, '#ffffff', 300);
    ring(V, P, color, 2.2, 0.8);
    burst(V, P, color, 24, { h: H * 0.5, spread: 150 });
    scatter(V, P, H * 0.6, ['✨', '💖', '⭐', ...(up.emoji || ['👗'])], 10, 150);
    MB.audio.sfx('sparkle'); MB.audio.sfx('applause');
    const name = V.billboard('float-text bond-name outfit-name', `👗 ${up.name}!`, P.x, P.y);
    gsap.set(name.body, { y: -H - 50 });
    gsap.timeline({ onComplete: () => name.remove() })
      .fromTo(name.body, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
      .to(name.body, { y: -H - 110, opacity: 0, duration: 0.5, delay: 1.1 });
    v.el.classList.remove('acting');
    rise(V, P, color, 12, H);
    await wait(0.3);
  }

  // ---------------------------------------------------------------- more attack parts
  // New recipe moves and fx (catalog.md lists them), and a named style that pairs each fx with a move.
  {
    const dirX = (r) => (r.d.x >= 0 ? 1 : -1);
    const dirt = (V, P) => burst(V, P, '#c9b79c', 6, { h: 5, spread: 70 });
    const trail = (V, p, c, size = 8) => { const e = dot(V, p, p.h, c, size); gsap.to(e.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => e.remove() }); };
    const sweepTo = (r, o, w) => gsap.set(r.v.el, { x: lerp(r.A.x, r.C.x, o.k) + r.perp.x * w, y: lerp(r.A.y, r.C.y, o.k) + r.perp.y * w });

    // ---- moves
    // crouches, springs over in a flip and lands on the target's doorstep
    RMOVE.pounce = { go: (V, r) => {
      const o = { k: 0 };
      return gsap.timeline()
        .to(r.v.img, { scaleY: 0.72, scaleX: 1.22, duration: 0.2, ease: 'power2.out' })
        .call(() => MB.audio.sfx('boing'))
        .to(r.v.img, { scaleY: 1.1, scaleX: 0.92, duration: 0.12 })
        .to(o, { k: 1, duration: 0.55, ease: 'power1.in', onUpdate: () => { sweepTo(r, o, 0); gsap.set(r.v.figure, { y: -240 * Math.sin(Math.PI * o.k) }); ghost(V, r.v, r.c); } }, '<')
        .to(r.v.figure, { rotation: dirX(r) * 360, duration: 0.55, ease: 'power1.inOut' }, '<')
        .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.2 }, '<')
        .set(r.v.figure, { rotation: 0, y: 0 })
        .call(() => { MB.audio.sfx('thud'); V.shake(9); dirt(V, r.C); });
    } };
    // three cartwheels, weaving side to side
    RMOVE.cartwheel = { go: (V, r) => {
      const o = { k: 0 };
      MB.audio.sfx('whoosh');
      return gsap.timeline()
        .to(o, { k: 1, duration: 0.7, ease: 'power1.inOut', onUpdate: () => { sweepTo(r, o, 60 * Math.sin(o.k * Math.PI * 2)); gsap.set(r.v.figure, { y: -70 * Math.abs(Math.sin(o.k * Math.PI * 4)) }); ghost(V, r.v, r.c); } })
        .to(r.v.figure, { rotation: dirX(r) * 1080, duration: 0.7, ease: 'power1.inOut' }, 0)
        .set(r.v.figure, { rotation: 0, y: 0 })
        .call(() => dirt(V, r.C));
    } };
    // shoots up out of sight, a warning ring opens by the target, then drops in on it
    RMOVE.skydrop = { go: async (V, r) => {
      MB.audio.sfx('whistleUp');
      await gsap.timeline().to(r.v.img, { scaleY: 0.8, scaleX: 1.15, duration: 0.15 })
        .to(r.v.figure, { y: -720, opacity: 0, duration: 0.3, ease: 'power2.in' })
        .to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.05 }, '<');
      gsap.set(r.v.el, { x: r.C.x, y: r.C.y });
      ring(V, r.C, r.c, 1.6, 0.6); MB.audio.sfx('incoming');
      await wait(0.35);
      gsap.set(r.v.figure, { y: -720, opacity: 1 });
      await gsap.to(r.v.figure, { y: 0, duration: 0.3, ease: 'power3.in' });
      MB.audio.sfx('stomp'); V.shake(16);
      ring(V, r.C, '#ffffff', 2.4, 0.6); debris(V, r.C, '#c9b79c', 8, { spread: 150 }); puff(V, r.C, '#d9ccb4', 4, 10);
      await gsap.to(r.v.img, { scaleY: 0.8, scaleX: 1.2, duration: 0.08, yoyo: true, repeat: 1 });
    } };
    // low and half-faded, creeps up on the target, then shows itself
    RMOVE.stalk = { go: async (V, r) => {
      const o = { k: 0 };
      MB.audio.sfx('swish');
      await gsap.to(r.v.img, { scaleY: 0.78, scaleX: 1.12, duration: 0.2 });
      await gsap.to(o, { k: 1, duration: 0.8, ease: 'sine.inOut', onUpdate: () => { sweepTo(r, o, 0); gsap.set(r.v.figure, { opacity: 0.3 + 0.12 * Math.sin(o.k * 20), y: 3 * Math.sin(o.k * 30) }); } });
      gsap.to(r.v.img, { scaleY: 1, scaleX: 1, duration: 0.1 });
      await gsap.to(r.v.figure, { opacity: 1, y: 0, duration: 0.08 });
    } };
    // runs one lap round the target, closing in, then strikes
    RMOVE.circle = { go: (V, r) => {
      const o = { k: 0 }, sign = dirX(r);
      MB.audio.sfx('whoosh');
      return gsap.to(o, { k: 1, duration: 0.85, ease: 'power1.inOut', onUpdate: () => {
        const th = o.k * Math.PI * 2 * sign, rad = lerp(r.d.len, 85, o.k), s = lerp(1, 0.6, Math.sin(Math.PI * o.k));
        const bx = -r.d.x * Math.cos(th) + r.d.y * Math.sin(th), by = -r.d.x * Math.sin(th) - r.d.y * Math.cos(th);
        gsap.set(r.v.el, { x: r.T.x + bx * rad, y: r.T.y + by * rad * s });
        ghost(V, r.v, r.c);
      } });
    } };
    // stretches back like a slingshot, then fires itself at the target spinning
    RMOVE.slingshot = { go: (V, r) => gsap.timeline()
      .to(r.v.figure, { x: -r.d.x * 60, duration: 0.35, ease: 'power2.out' })
      .to(r.v.img, { scaleX: 0.85, scaleY: 1.15, duration: 0.35 }, 0)
      .call(() => MB.audio.sfx('twang'))
      .to(r.v.el, { x: r.C.x, y: r.C.y, duration: 0.28, ease: 'power3.in', onUpdate: () => ghost(V, r.v, r.c) })
      .to(r.v.figure, { x: 0, rotation: dirX(r) * 1440, duration: 0.28, ease: 'power3.in' }, '<')
      .to(r.v.img, { scaleX: 1, scaleY: 1, duration: 0.1 }, '<')
      .set(r.v.figure, { rotation: 0 })
      .call(() => V.shake(8)) };

    // ---- fx
    // a burst of punches: comic words pop round the target
    RFX.flurry = async (V, t, r, F, land, o) => {
      const words = o.words || ['POW!', 'BAM!', 'WHAM!', 'BONK!', 'ZAP!', 'KAPOW!'];
      for (let i = 0; i < (o.hits || 8); i++) {
        gsap.timeline().to(r.v.figure, { x: r.d.x * rnd(14, 30), y: rnd(-24, 4), rotation: rnd(-6, 6), duration: 0.04 }).to(r.v.figure, { x: 0, y: 0, rotation: 0, duration: 0.05 });
        const P = { x: r.T.x + rnd(-45, 45), y: r.T.y + rnd(-15, 15) }, h = r.hT + rnd(-50, 60);
        flash(V, P, h, i % 2 ? '#ffffff' : r.c, rnd(90, 150));
        MB.audio.sfx(['punch', 'whack', 'pow'][i % 3]);
        if (i % 2 === 0) pop(V, P, h + 30, MB.pick(words), 'float-text ability', 0.6);
        land(i);
        await wait(0.075);
      }
      V.shake(12); flash(V, r.T, r.hT, '#ffffff', 300); ring(V, r.T, r.c, 2);
      await wait(0.15);
    };
    // a big crescent of light sweeps across the target
    const crescentSvg = (c) => `<svg viewBox="0 0 320 160" width="320" height="160"><path d="M8,140 C60,-10 260,-10 312,140 C250,40 70,40 8,140 Z" fill="${c}" opacity="0.85"/><path d="M28,132 C80,20 240,20 292,132 C240,56 80,56 28,132 Z" fill="#fff"/></svg>`;
    RFX.crescent = async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 2); i++) {
        const s = V.billboard('slash-svg', crescentSvg(r.c), r.T.x, r.T.y);
        s.body.style.setProperty('--c', r.c);
        gsap.set(s.body, { y: -r.hT, rotation: i % 2 ? 200 : -20 });
        MB.audio.sfx('slash');
        gsap.fromTo(s.body, { scale: 0.5, clipPath: 'inset(0% 100% 0% 0%)' }, { scale: 1.3, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.14, ease: 'power3.out' });
        gsap.to(s.body, { opacity: 0, scale: 1.6, duration: 0.25, delay: 0.14, onComplete: () => s.remove() });
        await wait(0.1);
        land(i); flash(V, r.T, r.hT, '#ffffff', 180);
        await wait(0.14);
      }
    };
    // two slashes cross into an X
    RFX.cross = async (V, t, r, F, land, o) => {
      for (let i = 0; i < (o.hits || 2); i++) {
        MB.audio.sfx('slash'); slashArc(V, r.T, -r.hT, r.c, -50);
        await wait(0.09);
        MB.audio.sfx('slash'); slashArc(V, r.T, -r.hT, '#ffffff', 50);
        await wait(0.07);
        land(i); flash(V, r.T, r.hT, '#ffffff', 200);
        await wait(0.12);
      }
    };
    // rings race across the floor to the target, then the ground splits under it
    RFX.shockwave = async (V, t, r, F, land, o) => {
      MB.audio.sfx('shockwave'); V.shake(8);
      gsap.to(r.v.img, { scaleY: 0.85, scaleX: 1.15, duration: 0.1, yoyo: true, repeat: 1 });
      for (let i = 0; i < 3; i++) {
        const rg = V.flat('shock-ring', '', F.x, F.y);
        rg.style.setProperty('--c', i % 2 ? '#ffffff' : r.c);
        gsap.timeline({ delay: i * 0.12, onComplete: () => rg.remove() })
          .fromTo(rg, { x: F.x, y: F.y, scale: 0.3, opacity: 1 }, { x: r.T.x, y: r.T.y, scale: 2.2, duration: 0.55, ease: 'power1.in' })
          .to(rg, { opacity: 0, duration: 0.2 }, '-=0.2');
      }
      await wait(0.75);
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      MB.audio.sfx('rocks');
      cracks(V, r.T, '#2b1d12', { n: 8, len: 150, w: 6, glow: r.c, hold: 0.9 });
      debris(V, r.T, '#c9b79c', 10, { spread: 180 }); V.shake(14);
      await wait(0.3);
    };
    // the floor cracks open in a line and light erupts along it
    RFX.fissure = async (V, t, r, F, land, o) => {
      const n = 6;
      MB.audio.sfx('rumble'); V.shake(10);
      for (let i = 1; i <= n; i++) {
        const P = { x: lerp(F.x, r.T.x, i / n) + rnd(-15, 15), y: lerp(F.y, r.T.y, i / n) + rnd(-8, 8) };
        cracks(V, P, '#2b1d12', { n: 4, len: 60 + i * 10, w: 5, glow: r.c, hold: 0.7 });
        debris(V, P, '#c9b79c', 3, { spread: 70 });
        const f = pillar(V, P, r.c, 'pillar small');
        gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: 0.5 + i * 0.12, duration: 0.15, ease: 'power2.out' });
        gsap.to(f.body, { opacity: 0, scaleX: 0.2, duration: 0.3, delay: 0.2, onComplete: () => f.remove() });
        await wait(0.08);
      }
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      MB.audio.sfx('rocks');
      cracks(V, r.T, '#2b1d12', { n: 9, len: 170, w: 7, glow: r.c, hold: 1 });
      await wait(0.3);
    };
    // props corkscrew over in pairs
    RFX.helix = (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['✨']);
      MB.audio.sfx('sparkle');
      return Promise.all(Array.from({ length: o.hits || 4 }, (_, i) => wait(i * 0.12).then(() => {
        const b = V.billboard('star-shot', ps[i % ps.length], F.x, F.y), ph = (i % 2) * Math.PI;
        b.body.style.setProperty('--c', r.c);
        return path(b, (k) => {
          const a = k * Math.PI * 6 + ph, w = 70 * (1 - k * 0.5) * Math.sin(a);
          return { x: lerp(F.x, r.T.x, k) + r.perp.x * w, y: lerp(F.y, r.T.y, k) + r.perp.y * w, h: lerp(r.hA, r.hT, k) + 50 * Math.cos(a), r: k * 540, s: 0.7 + k * 0.5 };
        }, 0.7, 'power1.in', (p) => { if (Math.random() < 0.6) trail(V, p, r.c); }).then(() => { b.remove(); land(i); });
      })));
    };
    // props skip along the floor, bouncing on the way
    RFX.ricochet = (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['⚽']);
      return Promise.all(Array.from({ length: o.hits || 2 }, (_, i) => wait(i * 0.25).then(() => {
        MB.audio.sfx('ricochet');
        const b = V.billboard('thrown', ps[i % ps.length], F.x, F.y), off = i ? (i % 2 ? 50 : -50) : 0;
        let last = 0;
        sized(b, o, 70);
        return path(b, (k) => ({
          x: lerp(F.x, r.T.x, k) + r.perp.x * off * k, y: lerp(F.y, r.T.y, k) + r.perp.y * off * k,
          h: 10 + Math.abs(Math.sin(k * Math.PI * 3)) * 190 * (1 - k * 0.5) + k * k * k * (r.hT - 10), r: k * 720,
        }), 0.8, 'none', (p, k) => {
          const n = Math.floor(k * 3);
          if (n > last) { last = n; MB.audio.sfx('boing'); dirt(V, p); }
        }).then(() => { b.remove(); land(i); });
      })));
    };
    // a whip of light lashes out and cracks on the target
    RFX.whip = async (V, t, r, F, land, o) => {
      const n = 22;
      for (let j = 0; j < (o.hits || 2); j++) {
        const segs = Array.from({ length: n + 1 }, () => dot(V, F, r.hA, r.c, 18, 'beam-seg')), q = { p: 0 };
        MB.audio.sfx('swish');
        await gsap.to(q, { p: 1, duration: 0.28, ease: 'power2.in', onUpdate: () => segs.forEach((s, i) => {
          const k = i / n, w = 90 * (1 - q.p) * Math.sin(k * Math.PI * 3 + q.p * 10);
          gsap.set(s, { x: lerp(F.x, r.T.x, k * q.p) + r.perp.x * w, y: lerp(F.y, r.T.y, k * q.p) + r.perp.y * w });
          gsap.set(s.body, { y: -(lerp(r.hA, r.hT, k * q.p) + 40 * (1 - q.p) * Math.cos(k * Math.PI * 3 + q.p * 10)) });
        }) });
        MB.audio.sfx('whipcrack'); land(j);
        flash(V, r.T, r.hT, '#ffffff', 220);
        await gsap.to(segs.map((s) => s.body), { scale: 0, opacity: 0, duration: 0.2, stagger: 0.004 });
        segs.forEach((s) => s.remove());
      }
    };
    // a shadow grows on the floor and something huge drops into it
    RFX.crush = async (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['🪨']), sh = V.flat('', '', r.T.x, r.T.y);
      Object.assign(sh.style, { width: '120px', height: '70px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,.65), transparent 70%)' });
      gsap.fromTo(sh, { scale: 0.2, opacity: 0 }, { scale: 1.6, opacity: 1, duration: 0.55, ease: 'power1.in' });
      const b = V.billboard('thrown big', ps[0], r.T.x, r.T.y);
      sized(b, o, 110);
      gsap.set(b.body, { y: -900, scale: 2.4 });
      MB.audio.sfx('incoming');
      await wait(0.2);
      await gsap.to(b.body, { y: -r.hT * 0.5, duration: 0.4, ease: 'power3.in' });
      MB.audio.sfx('collision'); MB.audio.sfx('crunch'); V.hitStop(); V.shake(22);
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      cracks(V, r.T, '#2b1d12', { n: 8, len: 150, w: 6, glow: r.c, hold: 0.9 });
      debris(V, r.T, '#c9b79c', 10, { spread: 200 }); ring(V, r.T, r.c, 2.6, 0.7); puff(V, r.T, '#d9ccb4', 5, 10);
      gsap.to(b.body, { scale: 3.4, opacity: 0, duration: 0.4, onComplete: () => b.remove() });
      gsap.to(sh, { opacity: 0, duration: 0.4, onComplete: () => sh.remove() });
      await wait(0.4);
    };
    // a big glowing comet arcs up over the board and dives on the target
    RFX.comet = async (V, t, r, F, land, o) => {
      const c = dot(V, F, r.hA, r.c, 70, 'charge');
      MB.audio.sfx('charge');
      await gsap.fromTo(c.body, { scale: 0 }, { scale: 1.2, duration: 0.25, ease: 'back.out(2)' });
      await path(c, (k) => ({ ...arc(F, r.T, r.hA, r.hT, 380)(k), s: 1.2 + k * 0.6 }), 0.7, 'power2.in',
        (p) => { trail(V, p, MB.pick([r.c, '#ffffff', '#ffe066']), rnd(14, 30)); });
      c.remove();
      for (let i = 0; i < (o.hits || 1); i++) land(i);
      flash(V, r.T, r.hT, r.c, 420); ring(V, r.T, r.c, 3, 0.7); V.shake(18); MB.audio.sfx('blast');
      await wait(0.3);
    };
    // a ribbon of props streams over, weaving as it goes
    RFX.ribbon = (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['🌸']);
      MB.audio.sfx('flutter');
      return Promise.all(Array.from({ length: o.hits || 12 }, (_, i) => wait(i * 0.05).then(() => {
        const b = V.billboard('petal', ps[i % ps.length], F.x, F.y), ph = i * 0.9, amp = rnd(30, 70);
        return path(b, (k) => ({
          x: lerp(F.x, r.T.x, k) + r.perp.x * amp * Math.sin(k * Math.PI * 4 + ph), y: lerp(F.y, r.T.y, k) + r.perp.y * amp * Math.sin(k * Math.PI * 4 + ph),
          h: lerp(r.hA, r.hT, k) + 40 * Math.sin(k * Math.PI * 3 + ph), r: k * 360, s: 0.7 + k * 0.5,
        }), 0.6, 'sine.in').then(() => { b.remove(); land(i); });
      })));
    };
    // pulses of force ring out from the target and shake it
    RFX.pulse = async (V, t, r, F, land, o) => {
      const tv = V.ents.get(t.uid);
      for (let i = 0; i < (o.hits || 3); i++) {
        MB.audio.sfx('pulse');
        ring(V, r.T, i % 2 ? '#ffffff' : r.c, 1.4 + i * 0.6, 0.5); flash(V, r.T, r.hT, r.c, 200 + i * 60);
        if (tv) gsap.fromTo(tv.figure, { x: -10 }, { x: 0, duration: 0.25, ease: EASE.shakeX || 'power2.out' });
        land(i);
        await wait(0.18);
      }
    };
    // a boulder (or `prop`) rolls along the floor and runs the target over
    RFX.roll = (V, t, r, F, land, o) => {
      const ps = propsOf(o, ['🪨']);
      return Promise.all(Array.from({ length: o.hits || 1 }, (_, i) => wait(i * 0.2).then(() => {
        const b = V.billboard('thrown big', ps[i % ps.length], F.x, F.y), off = i ? (i % 2 ? 60 : -60) : 0;
        sized(b, o, 110);
        MB.audio.sfx('boulder');
        return path(b, (k) => ({
          x: lerp(F.x, r.T.x, k) + r.perp.x * off * k, y: lerp(F.y, r.T.y, k) + r.perp.y * off * k,
          h: 45 + 10 * Math.abs(Math.sin(k * Math.PI * 8)) + k * k * (r.hT - 45), r: k * 1440, s: 0.8 + k * 0.4,
        }), 0.8, 'power1.in', (p) => { if (Math.random() < 0.5) burst(V, { x: p.x, y: p.y }, '#c9b79c', 1, { h: 5, spread: 40 }); })
          .then(() => { b.remove(); land(i); ring(V, r.T, r.c, 1.6, 0.5); V.shake(10); });
      })));
    };
    // beams stab down from the sky one after another
    RFX.lasers = async (V, t, r, F, land, o) => {
      const n = o.hits || 3, N = 14, all = [];
      const beams = Array.from({ length: n }, (_, i) => {
        const S = { x: r.T.x + (i - (n - 1) / 2) * 230, y: r.T.y - 50 };
        return Array.from({ length: N + 1 }, (_, j) => {
          const k = j / N, s = dot(V, { x: lerp(S.x, r.T.x, k), y: lerp(S.y, r.T.y, k) }, lerp(520, r.hT, k), r.c, 34, 'beam-seg');
          gsap.set(s.body, { scale: 0 });
          all.push(s);
          return s;
        });
      });
      MB.audio.sfx('charge');
      for (let i = 0; i < n; i++) {
        await gsap.to(beams[i].map((s) => s.body), { scale: 1, duration: 0.05, stagger: 0.01 });
        land(i); V.shake(6); MB.audio.sfx('laser');
      }
      await wait(0.15);
      await gsap.to(all.map((s) => s.body), { scale: 0, opacity: 0, duration: 0.25, stagger: 0.003 });
      all.forEach((s) => s.remove());
    };

    // ---- styles: a move, then an fx (cry / finish / emoji work as on any style)
    const moved = (move, fx, { cry, finish, cls = 'float-text buff' } = {}) => async (V, a, t, impact) => {
      const r = ctx(V, a, t), o = fxOpts(a), m = RMOVE[move];
      if (cry) pop(V, r.A, V.heightOf(a) + 30, own(a, 'cry', cry), cls, 1);
      await m.go(V, r);
      await RFX[fx](V, t, r, m.ranged ? r.A : here(r.v), lander(V, t, impact, r, o), o);
      if (finish) pop(V, r.T, r.hT + 110, own(a, 'finish', finish), cls, 1.1);
      await wait(0.15);
      await (m.back ? m.back(V, r) : goHome(r.v, r.A));
    };
    S.flurry = moved('dash', 'flurry', { cry: 'Hyaaa!' });
    S.cyclone = moved('circle', 'flurry', { cry: 'Can you keep up?' });
    S.pounce = moved('pounce', 'claws', { cry: 'Pounce!', finish: 'Gotcha~' });
    S.crescent = moved('float', 'crescent', { cry: 'Moonlit cut!', cls: 'float-text ability' });
    S.xslash = moved('blink', 'cross', { finish: 'Sliced.', cls: 'float-text shield' });
    S.stalker = moved('stalk', 'cross', { finish: '...Too slow.', cls: 'float-text shield' });
    S.cartwheel = moved('cartwheel', 'crescent', { cry: 'Ta-da~!' });
    S.shockwave = moved('stay', 'shockwave', { cry: 'Feel that?' });
    S.fissure = moved('stay', 'fissure', { cry: 'Split!', cls: 'float-text burn' });
    S.helix = moved('float', 'helix', { cry: 'Spiral!', cls: 'float-text ability' });
    S.ricochet = moved('stay', 'ricochet', { cry: 'Bounce it!' });
    S.whip = moved('stay', 'whip', { cry: 'Crack!', cls: 'float-text ability' });
    S.crush = moved('stay', 'crush', { finish: 'Flattened.', cls: 'float-text shield' });
    S.comet = moved('float', 'comet', { cry: 'Shooting star!', cls: 'float-text ability' });
    S.ribbon = moved('float', 'ribbon', { cry: 'Flutter~', cls: 'float-text heal' });
    S.skydive = moved('skydrop', 'pulse', { cry: 'Bombs away!' });
    S.slingshot = moved('slingshot', 'pulse', { finish: 'BOING!' });
    S.pulse = moved('float', 'pulse', { cry: 'Feel the beat.', cls: 'float-text ability' });
    S.boulder = moved('stay', 'roll', { cry: 'Heads up!' });
    S.laserweb = moved('float', 'lasers', { cry: 'Target acquired.', cls: 'float-text debuff' });
  }

  // ---------------------------------------------------------------- signature attacks
  // One character each, written as a little scene (the attack card names them by `style`). The attack() wrapper already
  // shows the name, cry, finish and scatter, so these only stage the action and call land() when the hit connects.
  {
    const dirX = (r) => (r.d.x >= 0 ? 1 : -1);
    const emo = (V, ch, P, h, size, cls = 'thrown') => {
      const b = V.billboard(cls, ch, P.x, P.y);
      b.body.style.fontSize = size + 'px';
      gsap.set(b.body, { y: -h });
      return b;
    };
    const dashTo = (V, r, P, dur = 0.2) => gsap.to(r.v.el, { x: P.x, y: P.y, duration: dur, ease: 'power3.in', onUpdate: () => ghost(V, r.v, r.c) });
    const setup = (V, a, t, impact) => {
      const r = ctx(V, a, t), o = fxOpts(a);
      return { r, land: lander(V, t, impact, r, o), tv: !t.isLeader && V.ents.get(t.uid), H: V.heightOf(a), sg: dirX(r) };
    };
    const wrapUp = async (r, land) => { if (!land.done()) land(0); await wait(0.2); await goHome(r.v, r.A); };
    // a point `dist` sideways of P, toward the middle of the board so it stays in view
    const beside = (r, P, dist) => { const sd = Math.sign((590 - P.x) * r.perp.x) || 1; return { x: P.x + r.perp.x * sd * dist, y: P.y + r.perp.y * sd * dist }; };
    const jolt = (tv, x) => tv && gsap.fromTo(tv.figure, { x }, { x: 0, duration: 0.25, ease: EASE.shakeX || 'power2.out' });
    const fade = (b, dur = 0.25) => gsap.to(b.body, { opacity: 0, duration: dur, onComplete: () => b.remove() });

    // Mel, mechanic: runs a diagnostic on the target, then fixes it the way she fixes everything
    S.diagnostic = async (V, a, t, impact) => {
      const { r, land, tv, sg } = setup(V, a, t, impact);
      await dashTo(V, r, r.C);
      MB.audio.sfx('tick'); ring(V, r.T, r.c, 1.8, 0.7);
      const lines = ['SCANNING...', 'ATTITUDE: <b style="color:#ff5566">BROKEN</b>', 'WARRANTY: <b style="color:#ff5566">VOID</b>', 'FIX: <b style="color:#ffd23f">HIT IT</b>'];
      const panel = V.billboard('', `<div style="font:900 24px monospace;color:${r.c};background:#04150eee;border:3px solid ${r.c};border-radius:8px;padding:8px 14px;white-space:nowrap;text-align:left;box-shadow:0 0 18px ${r.c}88">${lines.map((l) => `<div class="dg" style="opacity:0">&#9656; ${l}</div>`).join('')}</div>`, r.T.x + 190, r.T.y);
      gsap.set(panel.body, { y: -(r.hT * 1.4) });
      gsap.from(panel.body, { scale: 0.3, opacity: 0, duration: 0.2, ease: 'back.out(2)' });
      for (const l of panel.body.querySelectorAll('.dg')) { gsap.set(l, { opacity: 1 }); MB.audio.sfx('tick'); await wait(0.2); }
      await wait(0.15);
      const wr = emo(V, '🔧', { x: lerp(r.C.x, r.T.x, 0.6), y: lerp(r.C.y, r.T.y, 0.6) }, r.hT * 1.2, 100);
      const bangs = ['CLUNK!', 'BONK!', 'KA-CHUNK!'];
      for (let i = 0; i < 3; i++) {
        const last = i === 2;
        await gsap.to(wr.body, { rotation: -100 * sg, y: -r.hT * 1.9, duration: last ? 0.3 : 0.14, ease: 'power2.out' });
        await gsap.to(wr.body, { rotation: 25 * sg, y: -r.hT * 1.1, duration: 0.09, ease: 'power3.in' });
        MB.audio.sfx('clang'); land(i); flash(V, r.T, r.hT, '#ffffff', 200);
        burst(V, r.T, '#ffd23f', last ? 18 : 6, { h: r.hT, shape: 'shard' });
        pop(V, r.T, r.hT + 60 + i * 12, bangs[i], 'float-text dmg', 0.6);
        jolt(tv, -sg * 12);
        if (tv) gsap.to(tv.figure, { opacity: 0.35, duration: 0.03, yoyo: true, repeat: 5 });
        if (i === 1) MB.audio.sfx('glitch');
      }
      // the third hit reboots it
      V.hitStop(); V.shake(14); MB.audio.sfx('sizzle');
      scatter(V, r.T, r.hT, ['⚙️', '🔩'], 8, 150);
      pop(V, r.T, r.hT * 2 + 60, '⚠️', 'float-text debuff', 1);
      dizzy(V, r.T, r.hT * 2 + 10, ['⚡', '⚙️'], 1);
      fade(wr); fade(panel, 0.3);
      await wait(0.45);
      await wrapUp(r, land);
    };

    // Nala, nervous maid: pats the target apologetically, panics and windmills a broom
    S.nekopunch = async (V, a, t, impact) => {
      const { r, land, tv, H, sg } = setup(V, a, t, impact), o = { k: 0 };
      MB.audio.sfx('squeak');
      await gsap.to(o, { k: 1, duration: 0.7, ease: 'none', onUpdate: () => {
        gsap.set(r.v.el, { x: lerp(r.A.x, r.C.x, o.k), y: lerp(r.A.y, r.C.y, o.k) });
        gsap.set(r.v.figure, { y: -34 * Math.abs(Math.sin(o.k * Math.PI * 2)) });
      } });
      gsap.set(r.v.figure, { y: 0 });
      // three little pats that do nothing
      for (let i = 0; i < 3; i++) {
        gsap.timeline().to(r.v.figure, { x: sg * 14, duration: 0.06 }).to(r.v.figure, { x: 0, duration: 0.1 });
        const paw = emo(V, '🐾', { x: r.T.x - sg * 25, y: r.T.y }, r.hT + rnd(-15, 25), 46);
        gsap.fromTo(paw.body, { scale: 0.3 }, { scale: 1, duration: 0.12, ease: 'back.out(3)' });
        gsap.to(paw.body, { opacity: 0, y: '-=25', duration: 0.3, delay: 0.15, onComplete: () => paw.remove() });
        MB.audio.sfx('pop');
        pop(V, { x: r.T.x + rnd(-30, 30), y: r.T.y }, r.hT + 70, ['*pat*', '*pat pat*', '*poke*'][i], 'float-text', 0.55);
        await wait(0.28);
      }
      pop(V, r.T, r.hT * 2 + 30, '❔', 'float-text', 0.8);
      await wait(0.3);
      // she realises what she's doing
      MB.audio.sfx('gasp');
      pop(V, here(r.v), H + 40, '😳', 'float-text', 0.8);
      scatter(V, here(r.v), H * 0.6, ['💦'], 5, 80);
      await gsap.fromTo(r.v.figure, { x: -10 }, { x: 10, duration: 0.05, yoyo: true, repeat: 9 });
      gsap.set(r.v.figure, { x: 0 });
      // ...and panics: spinning, broom out
      MB.audio.sfx('meow');
      const b = emo(V, '🧹', r.C, 90, 150), hits = [0.33, 0.66, 0.98], hitText = ['WHAP!', 'FWOP!', 'BOINK!'];
      let n = 0;
      gsap.to(r.v.figure, { rotation: sg * 1080, duration: 1, ease: 'power1.inOut' });
      await path(b, (k) => {
        const ang = k * Math.PI * 6;
        return { x: r.C.x + (r.d.x * Math.cos(ang) + r.perp.x * Math.sin(ang)) * 105, y: r.C.y + (r.d.y * Math.cos(ang) + r.perp.y * Math.sin(ang)) * 105,
          h: 80 + 30 * Math.sin(ang * 2), r: k * 1440 };
      }, 1, 'power1.inOut', (p, k) => {
        if (n < 3 && k >= hits[n]) {
          land(n); MB.audio.sfx('whack'); flash(V, r.T, r.hT, '#ffffff', 190); puff(V, r.T, '#d9ccb4', 3, 10);
          pop(V, r.T, r.hT + 70, hitText[n], 'float-text dmg', 0.6); jolt(tv, sg * 30);
          n++;
        }
      });
      b.remove();
      gsap.set(r.v.figure, { rotation: 0 });
      dizzy(V, here(r.v), H + 10, ['💫', '💦'], 0.9);
      pop(V, here(r.v), H + 55, 'S-sorry!!', 'float-text buff', 0.9);
      await gsap.to(r.v.figure, { rotation: sg * 25, y: 6, duration: 0.3 });
      await wait(0.5);
      await wrapUp(r, land);
    };

    // Jet, hyperactive courier: zips through the target four times, can't brake, wipes out on delivery boxes
    S.overshoot = async (V, a, t, impact) => {
      const { r, land, tv, H, sg } = setup(V, a, t, impact);
      const at = [-1, 1, -1, 1, -1].map((s) => ({ x: r.T.x + r.perp.x * s * 170, y: r.T.y + r.perp.y * s * 170 }));
      MB.audio.sfx('whoosh');
      await dashTo(V, r, at[0], 0.18);
      const zip = ['zip!', 'zap!', 'zoom!', 'ZOOOM!'];
      for (let i = 0; i < 4; i++) {
        gsap.delayedCall(0.06, () => {
          land(i); MB.audio.sfx(i % 2 ? 'whack' : 'punch'); flash(V, r.T, r.hT + rnd(-20, 30), '#ffffff', 170);
          pop(V, r.T, r.hT + 50 + i * 12, zip[i], 'float-text ability', 0.5); jolt(tv, -sg * 16);
        });
        await gsap.to(r.v.el, { x: at[i + 1].x, y: at[i + 1].y, duration: 0.13, ease: 'none', onUpdate: () => ghost(V, r.v, r.c) });
        puff(V, here(r.v), '#d9ccb4', 2, 8);
      }
      // the last lap goes straight through and out the far side
      const out = { x: r.T.x + r.perp.x * 400, y: r.T.y + r.perp.y * 400 };
      gsap.delayedCall(0.08, () => {
        MB.audio.sfx('sonicboom'); ring(V, r.T, '#ffffff', 3.2, 0.7); ring(V, r.T, r.c, 2.2, 0.5); V.shake(16); land(4);
        if (tv) gsap.timeline().to(tv.figure, { rotation: sg * 720, x: r.d.x * 50, duration: 0.4, ease: 'power2.out' }).set(tv.figure, { rotation: 0 }).to(tv.figure, { x: 0, duration: 0.3 });
      });
      await gsap.to(r.v.el, { x: out.x, y: out.y, duration: 0.22, ease: 'power2.in', onUpdate: () => ghost(V, r.v, r.c) });
      MB.audio.sfx('collision'); V.shake(22);
      scatter(V, out, 60, ['📦', '✉️', '💥'], 9, 150);
      gsap.to(r.v.figure, { rotation: sg * 70, y: -6, duration: 0.15 });
      await dizzy(V, out, H + 10, ['💫', '⭐'], 1.1);
      await goHome(r.v, r.A, 0.35);
      if (!land.done()) land(0);
    };

    // Asher, spoiled rich kid: offers a bribe, takes "no" badly and turns the coin into a projectile.
    S.bribe = async (V, a, t, impact) => {
      const { r, land, tv } = setup(V, a, t, impact);
      const offer = { x: lerp(r.A.x, r.T.x, 0.72), y: lerp(r.A.y, r.T.y, 0.72) };
      const coin = emo(V, '🪙', r.A, r.hA, 60);
      V.emote(a, 'attack', 0);
      MB.audio.sfx('coin');
      pop(V, r.A, r.hA + 100, 'Name your price.', 'float-text buff', 0.8);
      await path(coin, (k) => ({ ...arc(r.A, offer, r.hA, r.hT + 65, 45)(k), r: k * 540 }), 0.55, 'power1.out');
      await wait(0.24);
      pop(V, r.A, r.hA + 90, 'No? How gauche.', 'float-text debuff', 0.8);
      await gsap.to(r.v.figure, { rotation: -7, duration: 0.13 });
      MB.audio.sfx('whoosh');
      await path(coin, (k) => ({ ...arc(offer, r.T, r.hT + 65, r.hT, 12)(k), r: 540 + k * 700,
        s: 1 + k * 0.65 }), 0.3, 'power2.in');
      coin.remove();
      land(0); MB.audio.sfx('slam'); V.shake(9); jolt(tv, 18);
      scatter(V, r.T, r.hT, ['🪙', '💢'], 6, 90);
      await gsap.to(r.v.figure, { rotation: 0, duration: 0.2 });
    };

    // Mizuha, librarian: shushes the target, then the library falls on it
    S.shhh = async (V, a, t, impact) => {
      const { r, land, tv, H } = setup(V, a, t, impact);
      await gsap.to(r.v.figure, { y: -14, duration: 0.15 });
      const f = emo(V, '🤫', here(r.v), H + 30, 80);
      gsap.fromTo(f.body, { scale: 0.2 }, { scale: 1.2, duration: 0.2, ease: 'back.out(3)' });
      MB.audio.sfx('hiss');
      await Promise.all([0, 1, 2].map((i) => wait(i * 0.14).then(() => {
        const w = V.billboard('float-text debuff', 'SHH!', r.A.x, r.A.y);
        return path(w, (k) => ({ x: lerp(r.A.x, r.T.x, k), y: lerp(r.A.y, r.T.y, k), h: lerp(r.hA + 40, r.hT + 30, k), s: 0.6 + k * 0.9 }), 0.45, 'power1.in').then(() => w.remove());
      })));
      fade(f);
      const mute = emo(V, '🔇', r.T, Math.min(255, r.hT + 125), 64);
      gsap.from(mute.body, { scale: 0.2, duration: 0.2, ease: 'back.out(3)' });
      await wait(0.35);
      // the shelf lets go, one heavy book at a time
      const books = [['📕', 'War & Peace'], ['📗', 'Ulysses'], ['📘', 'The Brothers Karamazov'], ['📙', 'Critique of Pure Reason']];
      const stack = [mute], label = (e, s, big) => `<div style="text-align:center;width:${big ? 190 : 170}px"><div style="font-size:${big ? 120 : 76}px;line-height:1">${e}</div><div style="font:900 ${big ? 19 : 16}px/1.1 sans-serif;color:#fff;background:#000c;border-radius:6px;padding:3px 5px;white-space:normal">${s}</div></div>`;
      MB.audio.sfx('riserhit');
      for (let i = 0; i <= books.length; i++) {
        const big = i === books.length, [e, s] = big ? ['📖', 'Dictionary (Unabridged)'] : books[i];
        const b = V.billboard('', label(e, s, big), r.T.x + rnd(-8, 8), r.T.y);
        gsap.set(b.body, { y: -Math.min(430, r.hT + 270), rotation: rnd(-25, 25) });
        // Land at the target's face, then pile only a little higher so every book still overlaps it.
        await gsap.to(b.body, { y: -(r.hT - 25 + i * 8), duration: big ? 0.28 : 0.34, ease: 'power3.in' });
        MB.audio.sfx(big ? 'stomp' : 'thud'); land(i); V.shake(big ? 22 : 8 + i * 3);
        puff(V, r.T, '#d9ccb4', 3, 12);
        if (tv) gsap.to(tv.img, { scaleY: big ? 0.6 : 1 - 0.05 * (i + 1), duration: 0.08 });
        if (big) { V.hitStop(); ring(V, r.T, r.c, 2.4, 0.6); cracks(V, r.T, '#2b1d12', { n: 6, len: 120, w: 5, glow: r.c, hold: 0.7 }); debris(V, r.T, '#c9b79c', 8, { spread: 150 }); }
        else gsap.to(b.body, { rotation: rnd(-8, 8), duration: 0.1 });
        stack.push(b);
        await wait(big ? 0.4 : 0.14);
      }
      await wait(0.3);
      stack.forEach((b) => fade(b, 0.3));
      if (tv) gsap.to(tv.img, { scaleY: 1, duration: 0.3 });
      await wait(0.3);
      await wrapUp(r, land);
    };

    // Borcolls, fruit seller: sets up a stall, sells the target a barrage, and hands over the receipt
    S.marketstall = async (V, a, t, impact) => {
      const { r, land, tv } = setup(V, a, t, impact);
      const SP = beside(r, { x: r.A.x + r.d.x * 60, y: r.A.y + r.d.y * 60 }, 210);
      MB.audio.sfx('kaching');
      const stall = V.billboard('', `<div style="text-align:center;white-space:nowrap"><div style="font-size:120px;line-height:1">🏪</div><div style="font:900 24px sans-serif;color:#3b2200;background:#ffe9a8;border:3px solid #3b2200;border-radius:6px;padding:2px 10px;transform:rotate(-4deg)">APPLES 🍎 $5</div></div>`, SP.x, SP.y);
      gsap.set(stall.body, { y: -60 });
      gsap.from(stall.body, { scale: 0.1, y: -320, duration: 0.4, ease: 'bounce.out' });
      await wait(0.25);
      MB.audio.sfx('thud'); puff(V, SP, '#d9ccb4', 4, 10);
      await wait(0.3);
      pop(V, SP, 190, MB.pick(['Fresh! Organic!', 'Two for one!', 'Best in town!']), 'float-text buff', 0.9);
      await wait(0.25);
      await Promise.all(['🍎', '🍏', '🍐', '🍊', '🍎', '🍏'].map((f, i) => wait(i * 0.12).then(() => {
        MB.audio.sfx('pop');
        const b = emo(V, f, SP, 90, 60), fn = arc(SP, r.T, 90, r.hT, 170);
        return path(b, (k) => ({ ...fn(k), r: k * 720 }), 0.5).then(() => {
          b.remove(); land(i); MB.audio.sfx('splat');
          burst(V, r.T, i % 2 ? '#e33a3a' : '#7cc33a', 8, { h: r.hT, spread: 90 });
          pop(V, { x: r.T.x + rnd(-30, 30), y: r.T.y }, r.hT + 40 + rnd(0, 40), '-$5', 'float-text ability', 0.6); jolt(tv, rnd(-8, 8));
        });
      })));
      // the premium item
      MB.audio.sfx('incoming');
      const m = emo(V, '🍉', SP, 100, 130), fn = arc(SP, r.T, 100, r.hT, 420);
      await path(m, (k) => ({ ...fn(k), r: k * 540, s: 1 + k * 0.5 }), 0.75, 'power1.in');
      m.remove(); MB.audio.sfx('splat'); V.shake(18); V.hitStop(); land(6);
      ring(V, r.T, '#e33a3a', 2.4, 0.6); burst(V, r.T, '#e33a3a', 20, { h: r.hT, spread: 150 });
      scatter(V, r.T, r.hT, ['🍉', '💦', '🍎'], 10, 170);
      await wait(0.5);
      // receipt, stamped
      const rc = V.billboard('', '<div style="font-size:70px;line-height:1">🧾</div>', r.T.x, r.T.y);
      gsap.set(rc.body, { y: -(r.hT * 2 + 240) });
      gsap.to(rc.body, { y: -(r.hT + 30), rotation: 14, duration: 0.7, ease: 'sine.out' });
      gsap.fromTo(rc, { x: r.T.x - 50 }, { x: r.T.x, duration: 0.7, ease: 'elastic.out(1,0.3)' });
      await wait(0.75);
      const st = V.billboard('', '<div style="font:900 34px sans-serif;color:#d11;border:6px solid #d11;border-radius:10px;padding:4px 14px;transform:rotate(-14deg);white-space:nowrap;background:#fff8">NO REFUNDS</div>', r.T.x, r.T.y);
      gsap.set(st.body, { y: -(r.hT + 30) });
      gsap.from(st.body, { scale: 3, opacity: 0, duration: 0.15, ease: 'power4.in' });
      MB.audio.sfx('stab'); V.shake(6);
      await wait(0.7);
      [rc, st, stall].forEach((b) => fade(b, 0.3));
      await wait(0.3);
      await wrapUp(r, land);
    };

    // Dante, cafe owner and bouncer: flips the sign to CLOSED and throws the target out the door
    S.bouncer = async (V, a, t, impact) => {
      const { r, land, tv, H, sg } = setup(V, a, t, impact), o = { k: 0 };
      const out = beside(r, r.T, 420);
      const door = emo(V, '🚪', out, 95, 190);
      gsap.from(door.body, { scale: 0.1, opacity: 0, duration: 0.3, ease: 'back.out(2)' });
      // unhurried walk over
      await gsap.to(o, { k: 1, duration: 0.8, ease: 'sine.inOut', onUpdate: () => {
        gsap.set(r.v.el, { x: lerp(r.A.x, r.C.x, o.k), y: lerp(r.A.y, r.C.y, o.k) });
        gsap.set(r.v.figure, { y: -6 * Math.abs(Math.sin(o.k * Math.PI * 4)) });
      } });
      gsap.set(r.v.figure, { y: 0 });
      const sign = V.billboard('', '<div class="sn" style="font:900 34px sans-serif;color:#fff;background:#2e9d4f;padding:8px 18px;border:4px solid #fff;border-radius:8px">OPEN</div>', r.C.x + r.perp.x * 75, r.C.y + r.perp.y * 75);
      gsap.set(sign.body, { y: -H * 0.85 });
      gsap.from(sign.body, { scale: 0.2, opacity: 0, duration: 0.2, ease: 'back.out(3)' });
      await wait(0.35);
      await gsap.to(sign.body, { scaleX: 0, duration: 0.12 });
      const face = sign.body.querySelector('.sn');
      face.textContent = 'CLOSED'; face.style.background = '#c33';
      MB.audio.sfx('chain');
      await gsap.to(sign.body, { scaleX: 1, duration: 0.14, ease: 'back.out(3)' });
      // knuckles
      MB.audio.sfx('crunch'); pop(V, here(r.v), H + 35, '*crack*', 'float-text', 0.6);
      await wait(0.25);
      MB.audio.sfx('crunch'); pop(V, here(r.v), H + 55, '💢', 'float-text dmg', 0.7);
      await wait(0.35);
      // collar grab
      if (tv) {
        await gsap.to(tv.figure, { y: -80, duration: 0.25 });
        await gsap.fromTo(tv.figure, { rotation: -6 }, { rotation: 6, duration: 0.06, yoyo: true, repeat: 5 });
        gsap.set(tv.figure, { rotation: 0 });
      }
      // out
      MB.audio.sfx('karate'); land(0);
      gsap.to(r.v.figure, { x: sg * 30, rotation: sg * -14, duration: 0.08, yoyo: true, repeat: 1 });
      if (tv) {
        MB.audio.sfx('whistleDown');
        await gsap.timeline()
          .to(tv.el, { x: out.x, y: out.y, duration: 0.45, ease: 'power2.in' })
          .to(tv.figure, { rotation: sg * 1080, duration: 0.45, ease: 'none' }, 0)
          .to(tv.figure, { y: -200, duration: 0.22, ease: 'power2.out' }, 0)
          .to(tv.figure, { y: 0, duration: 0.23, ease: 'power2.in' }, 0.22);
        gsap.set(tv.figure, { rotation: 0 });
      }
      MB.audio.sfx('crunch'); MB.audio.sfx('slam'); V.shake(18);
      scatter(V, out, 90, ['🪵', '💥'], 8, 150); debris(V, out, '#8a5a2b', 8, { spread: 130 });
      gsap.to(door.body, { rotation: sg * 25, opacity: 0.4, duration: 0.3 });
      if (tv) { dizzy(V, out, r.hT * 2 + 10, ['💫', '⭐'], 1); await wait(0.6); }
      fade(sign, 0.3); fade(door, 0.3);
      if (tv) {
        MB.audio.sfx('bonk');
        await gsap.to(tv.el, { x: r.T.x, y: r.T.y, duration: 0.6, ease: 'sine.inOut' });
      }
      await wrapUp(r, land);
    };
  }

  // ---------------------------------------------------------------- drawn pose attacks
  // Characters with a 2x2 pose sheet (js/poses.js, made by tools/pose_sheets.py from assets/attacks/poses/) play their
  // signature attack as four drawn beats: frame 0 stance, 1 wind-up, 2 release, 3 recover. poseActor stands a sheet's
  // frames on a floor point with the feet fixed and frame 0 as tall as the character; posed() hides the sprite while the
  // attack plays and puts it back, whatever happens. Props leave from kit.hand(frame), the drawn hand reaching furthest.
  // 'priest-pristo' is the older uniform sheet (MB.AttackArt.pristo.poses) and answers to the same calls.
  function poseActor(V, id, P, H, flip) {
    const node = V.billboard('pose-actor', '', P.x, P.y), b = node.body, dir = flip ? -1 : 1;
    node.dataset.pose = id;
    if (id === 'priest-pristo') {
      b.style.backgroundImage = `url("${MB.AttackArt.pristo.poses}")`;
      b.style.backgroundSize = '200% 200%';
      const size = H * 1.12;
      b.style.width = b.style.height = size + 'px';
      const act = { node, body: b, id, dir, k: 1, frame: 0, reach: () => size * 0.3 };
      act.set = (i) => {
        act.frame = i; node.dataset.frame = i;
        b.style.backgroundPosition = `${i % 2 * 100}% ${Math.floor(i / 2) * 100}%`;
        gsap.set(b, { yPercent: -100, y: 20, x: 0, scaleX: dir, transformOrigin: '50% 90%' });
      };
      return act;
    }
    const D = MB.POSES[id], k = H / D.frames[0].h;
    b.style.backgroundImage = `url("${D.src}")`;
    b.style.backgroundSize = `${D.w * k}px ${D.h * k}px`;
    const act = { node, body: b, id, D, dir, k, frame: 0, reach: (i) => { const f = D.frames[i == null ? act.frame : i]; return (f.x + f.w - f.ax) * k; } };
    act.set = (i) => {
      const f = D.frames[i];
      act.frame = i; node.dataset.frame = i;
      b.style.width = f.w * k + 'px'; b.style.height = f.h * k + 'px';
      b.style.backgroundPosition = `${-f.x * k}px ${-f.y * k}px`;
      // feet stay on the floor point whichever way the frame leans; the sheet faces right, so mirror about the feet
      gsap.set(b, { yPercent: -100, y: 0, x: (f.w / 2 - (f.ax - f.x)) * k, scaleX: dir, transformOrigin: `${(f.ax - f.x) / f.w * 100}% 100%` });
    };
    return act;
  }
  const faceOf = (A, T) => (T.x < A.x - 30 ? -1 : 1);
  // the sprite swaps for the drawn poses; script(kit) plays the beats and awaits them. A duo's partners each get a
  // pose actor (ids[i], at slot i of the pair) when `ids` is a list.
  async function posed(V, a, t, impact, ids, script) {
    const r = ctx(V, a, t), { v, A, T } = r, H = V.heightOf(a), dir = faceOf(A, T), nodes = [], loops = [];
    const list = [].concat(ids), duoOf = list.length > 1;
    const home = (i) => (duoOf ? { x: A.x + (i ? 80 : -80), y: A.y } : A);
    const actors = list.map((id, i) => poseActor(V, id, home(i), H, dir < 0));
    actors.forEach((ac) => nodes.push(ac.node));
    const actor = actors[0], parts = duo(v);
    const kit = {
      V, a, t, r, v, A, T, H, dir, actor, actors, home, nodes, hT: r.hT, c: r.c,
      land: lander(V, t, impact, r, { big: true }),
      make(cls, html, P, h = 0) { const n = V.billboard(cls, html, P.x, P.y); gsap.set(n.body, { y: -h }); nodes.push(n); return n; },
      loop(tw) { loops.push(tw); return tw; },
      fade(n, d = 0.25, delay = 0) { return gsap.to(n.body, { opacity: 0, duration: d, delay, onComplete: () => n.remove() }); },
      // a drawn hand's spot: how far the frame reaches forward, at the given height
      hand(i = 0, frame, h = 0.55) { const ac = actors[i], x = (duoOf ? home(i).x : A.x) + dir * ac.reach(frame) * 0.9; return { x, y: A.y, h: H * h }; },
      shiver(i = 0, amp = 2, dur = 0.045) {
        const x0 = home(i).x;
        return this.loop(gsap.fromTo(actors[i].node, { x: x0 - amp }, { x: x0 + amp, duration: dur, yoyo: true, repeat: -1 }));
      },
      still(tw, i = 0) { tw.kill(); gsap.set(actors[i].node, { x: home(i).x }); },
      // where a banner or readout over the target goes: above it, or beside a leader (they stand in the board's corners)
      over(extra = 70) { const L = !!t.isLeader; return { h: L ? r.hT * 1.15 : r.hT * 2 + extra, dx: L ? (T.x > 590 ? -170 : 170) : 0 }; },
    };
    try {
      actors.forEach((ac) => { gsap.set(ac.body, { opacity: 0 }); ac.set(0); });
      gsap.set(v.figure, { opacity: 0 });
      await gsap.to(actors.map((ac) => ac.body), { opacity: 1, duration: 0.18 });
      await script(kit);
      await Promise.all([gsap.to(actors.map((ac) => ac.body), { opacity: 0, duration: 0.2 }), gsap.to(v.figure, { opacity: 1, duration: 0.2 })]);
    } finally {
      loops.forEach((tw) => tw.kill());
      nodes.forEach((n) => { gsap.killTweensOf(n); if (n.body) gsap.killTweensOf(n.body); n.remove(); });
      gsap.set(v.figure, { opacity: 1 }); gsap.set(parts, { opacity: 1 }); resetDuo(v);
    }
  }
  // a prop that leaves P (a posed()'s kit.hand) and lands on the target after `dur`, with an optional lift above the line
  const flyTo = (n, P, T, hT, dur, { peak = 70, side = 0, perp, spin = 0, s0 = 1, s1 = 1, ease = 'power1.in' } = {}) => {
    const fn = arc(P, T, P.h, hT, peak, side, perp);
    return path(n, (q) => ({ ...fn(q), r: q * spin, s: lerp(s0, s1, q) }), dur, ease);
  };

  // Maia (Can Anyone Love Maia?): she is worried about YOU. Pages and hearts spiral in round the target, tightening,
  // and land one after another.
  S.heartguard = (V, a, t, impact) => posed(V, a, t, impact, 'maia', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k;
    pop(V, A, H + 40, own(a, 'cry', 'A-are you okay?! Please be okay!'), 'float-text baka', 1.1);
    const shake = k.shiver(0, 2);
    await wait(0.55);
    k.still(shake);
    actor.set(1); MB.audio.sfx('crinkle');
    await gsap.fromTo(actor.body, { rotation: 3 }, { rotation: -2, duration: 0.22, ease: 'power2.out' });
    actor.set(2); gsap.set(actor.body, { rotation: 0 });
    const O = k.hand(0, 2, 0.5);
    MB.audio.sfx('sparkle');
    const glow = k.make('impact-flash', '', O, O.h);
    glow.body.style.setProperty('--c', '#ff9ccd'); glow.body.style.width = glow.body.style.height = '170px';
    gsap.fromTo(glow.body, { scale: 0.2, opacity: 1 }, { scale: 1.4, opacity: 0, duration: 0.6, ease: 'power2.out' });
    const props = ['📃', '💗', '📃', '💗', '📃', '💗'].map((ch, i) => {
      const n = k.make('thrown', ch, O, O.h); n.body.style.fontSize = (i % 2 ? 38 : 46) + 'px'; return n;
    });
    await Promise.all(props.map((n, i) => wait(i * 0.12).then(async () => {
      const a0 = (i / props.length) * Math.PI * 2 + (dir < 0 ? Math.PI : 0);
      const fn = (q) => {
        if (q < 0.4) { // out of the book to a point on the ring round the target
          const e = q / 0.4, E = { x: T.x + Math.cos(a0) * 130, y: T.y + Math.sin(a0) * 65 };
          return { ...arc(O, E, O.h, hT + 40, 90)(e), r: e * 360, s: 0.7 + e * 0.4 };
        }
        const e = (q - 0.4) / 0.6, ang = a0 + e * Math.PI * 2.2, rad = 130 * (1 - e);
        return { x: T.x + Math.cos(ang) * rad, y: T.y + Math.sin(ang) * rad * 0.5, h: hT + 40 * (1 - e) + 18 * Math.sin(e * Math.PI * 3), r: 360 + e * 720, s: 1.1 };
      };
      await path(n, fn, 1.05, 'power1.inOut');
      land(i); MB.audio.sfx(i % 2 ? 'pop' : 'crinkle');
      burst(V, T, '#ff9ccd', 6, { h: hT, spread: 60 });
      n.remove();
    })));
    scatter(V, T, hT, ['💗', '💖', '✨'], 10, 150); ring(V, T, '#ff9ccd', 2.2, 0.5);
    pop(V, T, hT + 110, own(a, 'finish', 'Please... please be okay!!'), 'float-text baka', 1.1);
    actor.set(3); rise(V, A, '#ff8fb8', 7, H); MB.audio.sfx('heal');
    await wait(0.6);
  });

  // Cordelia (Cordelia): the bookstore clerk judges what you read. Verdict tags peel off her book and stick to you, then
  // she snaps it shut and the review lands.
  S.onestar = (V, a, t, impact) => posed(V, a, t, impact, 'cordelia', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k;
    pop(V, A, H + 40, own(a, 'cry', 'Let me guess. ...isekai?'), 'float-text debuff', 1.1);
    await wait(0.55);
    actor.set(1); MB.audio.sfx('crinkle');
    await gsap.fromTo(actor.body, { rotation: -2 }, { rotation: 2, duration: 0.25, ease: 'power2.out' });
    const verdicts = ['TRASHY ISEKAI', 'FETISH?!', 'NO REFUNDS'];
    const start = k.hand(0, 1, 0.82);
    const tags = verdicts.map((txt, i) => {
      const P = { x: start.x + dir * (i - 1) * 70, y: A.y, h: start.h + 30 + (i === 1 ? 26 : 0) };
      const n = k.make('cord-tag', txt, P, P.h); n.P = P;
      gsap.fromTo(n.body, { scale: 0, rotation: -25 }, { scale: 1, rotation: (i - 1) * 8, duration: 0.3, delay: i * 0.1, ease: 'back.out(2.4)' });
      return n;
    });
    MB.audio.sfx('buff');
    await wait(0.65);
    actor.set(2); gsap.set(actor.body, { rotation: 0 });
    const O = k.hand(0, 2, 0.82), OF = { x: O.x, y: A.y };
    MB.audio.sfx('slam'); V.shake(8); ring(V, OF, '#9b4dff', 1.4, 0.4);
    burst(V, OF, '#b06cff', 14, { h: O.h, spread: 120, shape: 'shard' });
    scatter(V, OF, O.h, ['📄'], 5, 100);
    await Promise.all(tags.map((n, i) => wait(i * 0.12).then(async () => {
      MB.audio.sfx('whoosh');
      await path(n, (q) => ({ ...arc(n.P, T, n.P.h, hT + 30 + i * 22, 60)(q), r: lerp((i - 1) * 8, (i - 1) * 8 + 340, q), s: 1 - q * 0.2 }), 0.5, 'power1.in');
      land(i); MB.audio.sfx('hit');
      gsap.set(n.body, { rotation: (i - 1) * 9 }); // it sticks
      gsap.to(n, { x: T.x + (i - 1) * 40, duration: 0.1 });
      flash(V, T, hT + i * 22, '#b06cff', 130 + i * 20);
    })));
    await wait(0.15);
    slamStamp(V, T, hT + 100, '★☆☆☆☆', '#ffd24a', 0.9);
    await wait(0.2);
    MB.audio.sfx('gavel'); V.shake(14); ring(V, T, '#ffd24a', 2.4, 0.5); flash(V, T, hT, '#ffffff', 260);
    tags.forEach((n) => k.fade(n, 0.3, 0.5));
    pop(V, T, hT + 160, own(a, 'finish', 'One star. Do better.'), 'float-text debuff', 1.2);
    actor.set(3);
    await wait(0.75);
  });

  // Hanako (Hanako Ikezawa): shy, a chess player. A board unrolls, her knight is set down and hops the L-shaped way
  // onto you: two forward, one aside.
  S.knightmove = (V, a, t, impact) => posed(V, a, t, impact, 'hanako-ikezawa', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k, lav = '#b49cff';
    pop(V, A, H + 40, own(a, 'cry', '...K-knight to... F3. Sorry.'), 'float-text shield', 1.1);
    await wait(0.5);
    actor.set(1);
    const board = strip(V, A, T, 'chess-board', lav);
    MB.audio.sfx('swish');
    await gsap.fromTo(actor.body, { y: 0 }, { y: -6, duration: 0.18, yoyo: true, repeat: 1 });
    await wait(0.25);
    actor.set(2);
    const O = k.hand(0, 2, 0.5);
    const side = T.x < 590 ? 1 : -1, M = { x: T.x + side * 120, y: T.y };
    MB.audio.sfx('sparkle');
    const glow = k.make('impact-flash', '', O, O.h);
    glow.body.style.setProperty('--c', lav); glow.body.style.width = glow.body.style.height = '130px';
    gsap.fromTo(glow.body, { scale: 0.2, opacity: 1 }, { scale: 1.2, opacity: 0, duration: 0.6 });
    const kn = k.make('chess-knight', '♞︎', O, O.h);
    kn.body.style.setProperty('--c', lav);
    gsap.fromTo(kn.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
    await wait(0.3);
    const hop = async (P, Q, h0, h1, peak, dur) => {
      await path(kn, (q) => ({ ...arc(P, Q, h0, h1, peak)(q), r: Math.sin(q * Math.PI) * 14 * dir }), dur, 'power1.inOut');
      MB.audio.sfx('tick'); ring(V, Q, lav, 0.9, 0.35);
    };
    await hop({ x: O.x, y: A.y }, M, O.h, 60, 90, 0.5);   // two forward...
    await hop(M, T, 60, hT, 110, 0.4);                      // ...and one aside, onto the target
    land(0); MB.audio.sfx('clang'); V.shake(8);
    scatter(V, T, hT, ['♟︎', '✨', '♞︎'], 8, 130); burst(V, T, lav, 12, { h: hT, spread: 90, shape: 'shard' });
    pop(V, T, hT + 110, own(a, 'finish', '...C-checkmate? Ah, sorry...'), 'float-text shield', 1.1);
    await wait(0.25);
    gsap.to(kn.body, { scale: 1.7, duration: 0.35 });
    k.fade(kn, 0.35); gsap.to(board, { opacity: 0, duration: 0.4, onComplete: () => board.remove() });
    actor.set(3);
    await wait(0.6);
  });

  // Ida (Integrated Domestic Android): an android's housekeeping menu. She picks OVERRIDE, helper drones swarm out and
  // sanitize the target in three passes.
  const droneSvg = (c) => `<svg viewBox="0 0 90 60" width="90" height="60"><ellipse class="rot" cx="16" cy="9" rx="15" ry="3.5" fill="${c}" opacity=".55"/><ellipse class="rot" cx="74" cy="9" rx="15" ry="3.5" fill="${c}" opacity=".55"/><path d="M16 9 L34 28 M74 9 L56 28" stroke="#8a97a0" stroke-width="3"/><ellipse cx="45" cy="34" rx="28" ry="21" fill="#f3f6f8" stroke="#8a97a0" stroke-width="3"/><circle cx="45" cy="34" r="11" fill="#0c2a1a" stroke="${c}" stroke-width="3"/><circle cx="45" cy="34" r="4.5" fill="${c}"/></svg>`;
  S.override = (V, a, t, impact) => posed(V, a, t, impact, 'ida', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k, g = '#5dffa0';
    pop(V, A, H + 40, own(a, 'cry', 'Domestic protocol. Engaging.'), 'float-text heal', 1.1);
    await wait(0.5);
    actor.set(1);
    const Ph = { x: A.x + dir * H * 0.38, y: A.y };
    const panel = k.make('ida-holo', '<b>DD-23581321-X</b><i>▸ DUST</i><i>▸ DISHES</i><i>▸ OVERRIDE</i>', Ph, H * 0.95);
    const rows = [...panel.body.querySelectorAll('i')];
    gsap.fromTo(panel.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
    MB.audio.sfx('glitch');
    for (let i = 0; i < rows.length; i++) { rows.forEach((row, j) => row.classList.toggle('sel', j === i)); MB.audio.sfx('tick'); await wait(0.22); }
    MB.audio.sfx('ding');
    gsap.fromTo(panel.body, { x: -4 }, { x: 4, duration: 0.04, yoyo: true, repeat: 5 });
    await wait(0.25);
    actor.set(2);
    const O = k.hand(0, 2, 0.6);
    const drones = [0, 1, 2].map((i) => {
      const n = k.make('ida-drone', droneSvg(g), { x: O.x, y: A.y }, O.h); n.P = { x: O.x, y: A.y, h: O.h };
      gsap.to(n.body.querySelectorAll('.rot'), { scaleX: 0.5, duration: 0.05, yoyo: true, repeat: -1 });
      gsap.fromTo(n.body, { scale: 0 }, { scale: 0.8, duration: 0.2, delay: i * 0.08 });
      return n;
    });
    MB.audio.sfx('powerup');
    const spots = [{ x: -90, y: 0 }, { x: 90, y: 0 }, { x: 0, y: -50 }].map((d) => ({ x: T.x + d.x, y: T.y + d.y }));
    await Promise.all(drones.map((n, i) => wait(i * 0.1).then(() =>
      path(n, (q) => ({ ...arc(n.P, spots[i], n.P.h, hT + 80, 60)(q), s: 0.8, r: Math.sin(q * 9) * 6 }), 0.55, 'power2.out'))));
    const ov = k.over(70);
    const read = k.make('ida-holo ida-read', '<b>SANITIZING</b><u><s></s></u>', { x: T.x + ov.dx, y: T.y }, ov.h);
    const rbar = read.body.querySelector('s');
    gsap.fromTo(read.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2 });
    for (let i = 0; i < 3; i++) {
      const scan = k.make('ida-scan', '', T, hT * 2);
      MB.audio.sfx('laser');
      await gsap.fromTo(scan.body, { y: -hT * 2.1, opacity: 1 }, { y: -4, duration: 0.32, ease: 'none' });
      gsap.to(rbar, { width: `${(i + 1) * 33.4}%`, duration: 0.1 });
      land(i); flash(V, T, hT, g, 150 + i * 30); burst(V, T, g, 8, { h: hT, spread: 70, shape: 'shard' });
      k.fade(scan, 0.2);
      await wait(0.08);
    }
    pop(V, T, hT + 150, own(a, 'finish', 'Sanitized. ...Was that rude?'), 'float-text heal', 1.1);
    k.fade(read, 0.25);
    actor.set(3);
    k.fade(panel, 0.3);
    await Promise.all(drones.map((n, i) => path(n, (q) => ({ ...arc(spots[i], { x: A.x, y: A.y }, hT + 80, H * 0.6, 40)(q), s: 0.8 - q * 0.4 }), 0.55, 'power1.inOut').then(() => n.remove())));
    await wait(0.2);
  });

  // Lilly (Lilly Satou): blind, so she doesn't aim, she listens. Cane taps send echoes across the board, the third finds
  // you, and a curl of amber tea follows the sound.
  S.rebuff = (V, a, t, impact) => posed(V, a, t, impact, 'lilly-satou', async (k) => {
    const { A, T, H, dir, actor, land, hT, r } = k, amber = '#e8a43a';
    pop(V, A, H + 40, own(a, 'cry', '*tap* ...there you are, dear.'), 'float-text buff', 1.1);
    for (let i = 0; i < 3; i++) { // cane taps: an echo races out along the floor to the target
      MB.audio.sfx('tick');
      ring(V, A, '#fff3c8', 1.2, 0.45);
      const e = V.flat('shock-ring', '', A.x, A.y); e.style.setProperty('--c', '#fff3c8');
      gsap.fromTo(e, { scale: 0.15, opacity: 0.9 }, { x: lerp(A.x, T.x, 0.9), y: lerp(A.y, T.y, 0.9), scale: 0.6, opacity: 0, duration: 0.55, ease: 'power1.out', onComplete: () => e.remove() });
      if (i === 2) gsap.delayedCall(0.4, () => { ring(V, T, '#fff3c8', 1.5, 0.5); MB.audio.sfx('ding'); });
      await wait(0.3);
    }
    await wait(0.3);
    actor.set(1);
    const O = k.hand(0, 1, 0.5);
    for (let i = 0; i < 3; i++) { // steam curls off the cup
      const s = k.make('smoke', '', { x: O.x + rnd(-8, 8), y: A.y }, O.h + 20);
      s.body.style.width = s.body.style.height = '26px'; s.body.style.setProperty('--c', '#fff');
      gsap.fromTo(s.body, { scale: 0.4, opacity: 0.8 }, { scale: 1.3, y: `-=${rnd(40, 70)}`, opacity: 0, duration: 0.8, delay: i * 0.15, onComplete: () => s.remove() });
    }
    await wait(0.45);
    actor.set(2);
    const P = k.hand(0, 2, 0.5);
    MB.audio.sfx('swish');
    const drops = Array.from({ length: 11 }, (_, i) => {
      const d = k.make('spark', '', P, P.h);
      d.body.style.setProperty('--c', amber); d.body.style.width = d.body.style.height = (i === 0 ? 20 : rnd(8, 15)) + 'px';
      return d;
    });
    await Promise.all(drops.map((d, i) => wait(i * 0.035).then(async () => {
      const lead = i === 0, side = Math.sin(i * 1.7) * 28;
      await path(d, (q) => ({ ...arc(P, T, P.h, hT, 70 + i * 3, side, r.perp)(q), s: 1 }), 0.55, 'sine.inOut');
      if (lead) { land(0); MB.audio.sfx('splash'); V.shake(8); } else if (i % 3 === 0) burst(V, T, amber, 4, { h: hT, spread: 45 });
      d.remove();
    })));
    droplets(V, T, 12, 120); flash(V, T, hT, '#ffe0a0', 190); ring(V, T, amber, 1.7, 0.45);
    const tv = victim(V, t);
    if (tv) gsap.timeline().to(tv.figure, { x: r.d.x * 38, y: -24, rotation: r.d.x * 9, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
      .to(tv.figure, { x: 0, y: 0, rotation: 0, duration: 0.45, ease: 'bounce.out' });
    pop(V, T, hT + 110, own(a, 'finish', 'Mind your manners, dear.'), 'float-text buff', 1.1);
    await wait(0.25);
    actor.set(3); MB.audio.sfx('ding');
    await wait(0.6);
  });

  // Yllara (Meditate with Yllara): stillness, then one open palm. Her mala beads circle her, a golden lotus blooms
  // underfoot, and the palm sends a second lotus that opens on you.
  const lotusSvg = (c, size = 170) => {
    const petal = (rot, w, fill, op) => `<g transform="rotate(${rot} 85 85)" opacity="${op}"><path d="M85 85 C${85 - w} 55 ${85 - w * 0.6} 18 85 4 C${85 + w * 0.6} 18 ${85 + w} 55 85 85Z" fill="${fill}" stroke="#fff6c8" stroke-width="2"/></g>`;
    const outer = Array.from({ length: 8 }, (_, i) => petal(i * 45, 30, c, 0.82)).join('');
    const inner = Array.from({ length: 8 }, (_, i) => petal(i * 45 + 22.5, 22, '#fff0a8', 0.95)).join('');
    return `<svg viewBox="0 0 170 170" width="${size}" height="${size}" overflow="visible">${outer}${inner}<circle cx="85" cy="85" r="11" fill="#fff9d8" stroke="${c}" stroke-width="3"/></svg>`;
  };
  S.lotuspalm = (V, a, t, impact) => posed(V, a, t, impact, 'yllara', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k, gold = '#f5c242';
    pop(V, A, H + 40, own(a, 'cry', 'Om... nothing to grasp.'), 'float-text buff', 1.2);
    MB.audio.sfx('gong');
    const beads = Array.from({ length: 10 }, () => { const b = k.make('spark', '', A, H * 0.55); b.body.style.setProperty('--c', '#8a4a22'); b.body.style.width = b.body.style.height = '13px'; return b; });
    const spin = { a: 0 };
    k.loop(gsap.to(spin, { a: Math.PI * 2, duration: 1.4, ease: 'none', repeat: -1, onUpdate: () => beads.forEach((b, i) => {
      const ang = spin.a + (i / beads.length) * Math.PI * 2;
      gsap.set(b, { x: A.x + Math.cos(ang) * 64, y: A.y + Math.sin(ang) * 22 });
      gsap.set(b.body, { y: -(H * 0.55) - Math.sin(ang) * 4, scale: 0.8 + Math.sin(ang) * 0.25 });
    }) }));
    await wait(0.7);
    actor.set(1);
    const bloom = V.flat('lotus-floor', lotusSvg(gold, 250), A.x, A.y);
    k.nodes.push(bloom);
    gsap.fromTo(bloom, { scale: 0.1, opacity: 0, rotation: -40 }, { scale: 1, opacity: 0.9, rotation: 0, duration: 0.55, ease: 'back.out(1.7)' });
    MB.audio.sfx('heal'); rise(V, A, gold, 8, H);
    await wait(0.6);
    actor.set(2);
    const O = k.hand(0, 2, 0.55);
    MB.audio.sfx('holy'); flash(V, { x: O.x, y: A.y }, O.h, gold, 220);
    const lotus = k.make('thrown lotus', lotusSvg(gold, 150), { x: O.x, y: A.y }, O.h);
    gsap.fromTo(lotus.body, { scale: 0.1 }, { scale: 0.7, duration: 0.25, ease: 'back.out(2)' });
    await wait(0.3);
    k.loop(gsap.to(lotus.body, { rotation: '+=360', duration: 1.6, ease: 'none', repeat: -1 }));
    await path(lotus, (q) => ({ ...arc({ x: O.x, y: A.y }, T, O.h, hT, 36)(q), s: 0.7 + q * 0.5, r: 0 }), 0.65, 'power2.in');
    land(0); MB.audio.sfx('gong'); V.shake(12);
    gsap.to(lotus.body, { scale: 2.1, opacity: 0, duration: 0.5, ease: 'power2.out' });
    flash(V, T, hT, '#fff6c8', 300);
    for (let i = 0; i < 3; i++) ring(V, T, gold, 1.4 + i * 0.8, 0.5 + i * 0.12);
    const tv = victim(V, t);
    if (tv) gsap.timeline().to(tv.img, { scaleY: 0.86, scaleX: 1.08, duration: 0.14, transformOrigin: '50% 100%' }).to(tv.img, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1,0.5)' });
    scatter(V, T, hT, ['🌸', '✨', '🌼'], 10, 150);
    pop(V, T, hT + 110, own(a, 'finish', 'Let it go.'), 'float-text heal', 1.2);
    await wait(0.3);
    actor.set(3);
    beads.forEach((b) => k.fade(b, 0.4)); gsap.to(bloom, { opacity: 0, duration: 0.5, onComplete: () => bloom.remove() });
    await wait(0.6);
  });

  // Seraphina (Seraphina): an elf guardian. A vine crawls across the floor, climbs the target and blooms.
  const coilSvg = (w, h) => {
    const loops = 4, pts = [];
    for (let i = 0; i <= loops * 2; i++) pts.push([i % 2 ? w * 0.92 : w * 0.08, h - 12 - (i / (loops * 2)) * (h - 40)]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [x, y] = pts[i]; d += ` C${px} ${py - (py - y) * 0.15} ${x} ${y + (py - y) * 0.6} ${x} ${y}`; }
    const leaves = pts.slice(1).map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="5" fill="#5fcf6a" transform="rotate(${i % 2 ? 35 : -35} ${x} ${y})"/>`).join('');
    const flowers = pts.filter((_, i) => i % 2 === 0 && i > 0).map(([x, y]) => `<g class="fl" transform="translate(${x} ${y})"><circle r="11" fill="#ff9ccb"/><circle r="5" fill="#ffe27a"/></g>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" overflow="visible"><path class="d" d="${d}" fill="none" stroke="#2f9b45" stroke-width="9" stroke-linecap="round"/>${leaves}${flowers}</svg>`;
  };
  S.vineward = (V, a, t, impact) => posed(V, a, t, impact, 'seraphina', async (k) => {
    const { A, T, H, dir, actor, land, hT, r } = k, green = '#5fcf6a';
    pop(V, A, H + 40, own(a, 'cry', 'Eldoria, lend me your green.'), 'float-text heal', 1.2);
    await wait(0.45);
    rise(V, A, green, 6, H * 0.8); MB.audio.sfx('vines');
    actor.set(1);
    await wait(0.45);
    actor.set(2);
    // the vine crawls along the floor from her to the target
    const dist = r.d.len, ang = (Math.atan2(r.d.y, r.d.x) * 180) / Math.PI;
    const crawl = V.flat('vine-strip', `<svg viewBox="0 0 ${dist} 120" width="${dist}" height="120" overflow="visible"><path class="d" d="M0 60 Q${dist * 0.25} 5 ${dist * 0.5} 60 T${dist} 60" fill="none" stroke="#2f9b45" stroke-width="10" stroke-linecap="round"/></svg>`, (A.x + T.x) / 2, (A.y + T.y) / 2);
    k.nodes.push(crawl);
    gsap.set(crawl, { rotation: ang });
    draw(crawl.querySelectorAll('.d'), { duration: 0.5, ease: 'power1.in' });
    await wait(0.5);
    const coil = k.make('vine-coil', coilSvg(110, t.isLeader ? hT * 1.5 : hT * 2 + 30), T, 0);
    gsap.set(coil.body, { yPercent: -100, y: 0, transformOrigin: '50% 100%' });
    MB.audio.sfx('vines');
    const fls = coil.body.querySelectorAll('.fl');
    gsap.set(fls, { scale: 0, transformOrigin: 'center' });
    await draw(coil.body.querySelectorAll('.d'), { duration: 0.45, ease: 'none' });
    land(0); V.shake(8); MB.audio.sfx('pop');
    gsap.fromTo(fls, { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.08, ease: 'back.out(3)' });
    flash(V, T, hT, '#ff9ccb', 200); ring(V, T, green, 1.8, 0.5);
    scatter(V, T, hT, ['🌸', '🍃', '🌿'], 10, 140);
    pop(V, T, hT + 120, own(a, 'finish', 'Be still. Let it bloom.'), 'float-text heal', 1.2);
    await wait(0.6);
    actor.set(3);
    ring(V, A, green, 2, 0.6); rise(V, A, '#ffb3d9', 6, H); MB.audio.sfx('heal');
    gsap.to(crawl, { opacity: 0, duration: 0.4, onComplete: () => crawl.remove() });
    k.fade(coil, 0.5);
    await wait(0.6);
  });

  // Eliza (Stranded terrestrial): the concussion woke her cute side. She scans you, the pulse flies wide, she wobbles,
  // and it boomerangs back for the hit.
  S.fieldnotes = (V, a, t, impact) => posed(V, a, t, impact, 'eliza', async (k) => {
    const { A, T, H, dir, actor, land, hT } = k, cy = '#4fe8ff';
    pop(V, A, H + 40, own(a, 'cry', 'Observing the specimen~'), 'float-text shield', 1.1);
    const ret = k.make('eliza-reticle', `<svg viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="${cy}" stroke-width="5" stroke-linecap="round"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="8"/><path d="M60 4V28M60 92V116M4 60H28M92 60H116"/></svg>`, T, hT);
    gsap.fromTo(ret.body, { scale: 2.6, opacity: 0, rotation: -90 }, { scale: 1.1, opacity: 1, rotation: 0, duration: 0.5, ease: 'power3.out' });
    MB.audio.sfx('scope');
    const ov = k.over(70);
    const read = k.make('eliza-read', '<b>SPECIMEN #07</b><i>Hostility: 62%</i><i>Cuteness: ???</i>', { x: T.x + ov.dx, y: T.y }, ov.h);
    gsap.fromTo(read.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.3, delay: 0.25 });
    await wait(0.7);
    actor.set(1);
    const hoverLeaf = k.make('thrown', '🍃', k.hand(0, 1, 0.9), H * 1.05);
    hoverLeaf.body.style.fontSize = '44px'; hoverLeaf.body.style.filter = 'hue-rotate(120deg) drop-shadow(0 0 8px #4fe8ff)';
    k.loop(gsap.fromTo(hoverLeaf.body, { rotation: -20 }, { rotation: 20, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    MB.audio.sfx('powerup');
    await wait(0.5);
    actor.set(2);
    // the wobble...
    const wobble = k.loop(gsap.fromTo(actor.body, { rotation: -7 }, { rotation: 7, duration: 0.11, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    pop(V, A, H + 60, 'Whoa, whoa, w-woooah~', 'float-text baka', 0.9);
    const O = k.hand(0, 2, 0.58);
    const pulse = k.make('thrown', `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" stroke="${cy}" stroke-width="6"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="14" fill="${cy}" fill-opacity=".45"/></svg>`, { x: O.x, y: A.y }, O.h);
    MB.audio.sfx('pulse');
    const side = T.x < 590 ? 1 : -1, W = { x: T.x + side * 250, y: T.y + (A.y < T.y ? -70 : 70) };
    await path(pulse, (q) => ({ ...arc({ x: O.x, y: A.y }, W, O.h, 40, 120)(q), s: 0.6 + q * 0.5, r: q * 400 }), 0.55, 'power1.in');
    ring(V, W, cy, 1.6, 0.5); MB.audio.sfx('zap');
    pop(V, W, 70, 'Oopsie~!', 'float-text baka', 0.9);
    await wait(0.15);
    await path(pulse, (q) => ({ ...arc(W, T, 40, hT, 160, 90 * side, { x: 1, y: 0 })(q), s: 1.1 + q * 0.3, r: 400 + q * 500 }), 0.6, 'power2.in');
    land(0); V.shake(12); MB.audio.sfx('camera');
    flash(V, T, hT, '#ffffff', 240); ring(V, T, cy, 2, 0.5); burst(V, T, cy, 12, { h: hT, spread: 90 });
    pulse.remove();
    gsap.to(ret.body, { scale: 0.5, opacity: 0, duration: 0.3 });
    pop(V, T, hT + 140, own(a, 'finish', 'Ooh! It works when you hit it!'), 'float-text shield', 1.2);
    await wait(0.3);
    wobble.kill(); actor.set(3); gsap.set(actor.body, { rotation: 0 });
    MB.audio.sfx('sparkle');
    k.fade(read, 0.3); k.fade(hoverLeaf, 0.3);
    await wait(0.55);
  });

  // Uzi (Stranded terrestrial): the "Crimson Hare" is a bluff. A giant red hare looms behind her, she shows off a decoy,
  // and the little decoys hop out and blow up far harder than she ever planned.
  const hareSvg = (c) => `<svg viewBox="0 0 220 300" width="100%" height="100%" overflow="visible"><g fill="${c}" stroke="#2a0509" stroke-width="5"><ellipse cx="72" cy="68" rx="23" ry="68" transform="rotate(-8 72 68)"/><ellipse cx="148" cy="68" rx="23" ry="68" transform="rotate(8 148 68)"/><circle cx="110" cy="196" r="84"/></g><g fill="#2a0509"><ellipse cx="72" cy="68" rx="9" ry="48" transform="rotate(-8 72 68)"/><ellipse cx="148" cy="68" rx="9" ry="48" transform="rotate(8 148 68)"/></g><path d="M62 176 L98 190 L64 200Z M158 176 L122 190 L156 200Z" fill="#ffe14a" stroke="#fff" stroke-width="2"/><path d="M66 228 Q110 262 154 228" stroke="#2a0509" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M76 232 l8 16 l8 -12 l8 16 l8 -12 l8 16 l8 -12 l8 16 l8 -12 l8 14" stroke="#fff" stroke-width="5" fill="none" stroke-linejoin="round"/></svg>`;
  const rabbitBotSvg = (c) => `<svg viewBox="0 0 90 90" width="90" height="90" overflow="visible"><g fill="${c}" stroke="#5a0a14" stroke-width="3"><ellipse cx="28" cy="20" rx="9" ry="22" transform="rotate(-14 28 20)"/><ellipse cx="62" cy="20" rx="9" ry="22" transform="rotate(14 62 20)"/><circle cx="45" cy="56" r="28"/></g><rect x="26" y="44" width="38" height="24" rx="12" fill="#1b0508"/><circle cx="37" cy="56" r="5.5" fill="#ffe14a"/><circle cx="53" cy="56" r="5.5" fill="#ffe14a"/><circle cx="45" cy="26" r="4" fill="#ff3b3b" class="led"/></svg>`;
  S.harebluff = (V, a, t, impact) => posed(V, a, t, impact, 'uzi', async (k) => {
    const { A, T, H, dir, actor, land, hT, r } = k, red = '#e02a3a';
    // the bluff: a giant, glaring hare behind her
    const hare = k.make('hare-shadow', hareSvg('#8a0c1c'), { x: A.x, y: A.y - 20 }, 0);
    hare.body.style.height = H * 1.7 + 'px'; hare.body.style.width = H * 1.7 * 220 / 300 + 'px';
    gsap.set(hare.body, { yPercent: -100, y: -H * 0.25, transformOrigin: '50% 100%' }); // its face sits behind her head, the ears tower over her
    gsap.fromTo(hare.body, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.62, duration: 0.5, ease: 'power3.out' });
    MB.audio.sfx('roar');
    pop(V, A, H + 50, own(a, 'cry', 'I WILL DESTROY YOU!!'), 'float-text burn', 1.2);
    const sweat = k.make('petal', '💧', { x: A.x + dir * 40, y: A.y }, H * 0.95); sweat.body.style.fontSize = '30px';
    gsap.fromTo(sweat.body, { y: -H * 0.95, opacity: 0 }, { y: -H * 0.7, opacity: 1, duration: 0.6, delay: 0.3 });
    await wait(0.75);
    actor.set(1);
    const O1 = k.hand(0, 1, 0.55);
    MB.audio.sfx('pop'); flash(V, { x: O1.x, y: A.y }, O1.h, red, 120);
    await wait(0.4);
    actor.set(2);
    const O = k.hand(0, 2, 0.5), OF = { x: O.x, y: A.y };
    MB.audio.sfx('wobble');
    const bots = [0, 1, 2].map((i) => { const n = k.make('rabbit-bot', rabbitBotSvg(red), OF, O.h); n.body.style.setProperty('--c', red); gsap.fromTo(n.body, { scale: 0 }, { scale: 0.62 - i * 0.04, duration: 0.2, delay: i * 0.12 }); return n; });
    await Promise.all(bots.map((n, i) => wait(0.15 + i * 0.28).then(async () => {
      MB.audio.sfx('boing');
      // three bunny hops over, then it counts down and goes off
      const spread = (i - 1) * 40;
      await path(n, (q) => ({ x: lerp(OF.x, T.x + spread, q), y: lerp(OF.y, T.y, q), h: lerp(O.h, hT * 0.5, q) + 80 * Math.abs(Math.sin(q * Math.PI * 3)), s: 0.6, r: Math.sin(q * Math.PI * 6) * 9 }), 0.8, 'none');
      MB.audio.sfx('tick');
      const num = pop(V, { x: T.x + spread, y: T.y }, hT + 70, i === 2 ? '1…' : '!', 'float-text burn', 0.45);
      await wait(0.2);
      puff(V, { x: T.x + spread, y: T.y }, '#ff9a8a', 6, hT * 0.6);
      if (i < 2) { land(i); MB.audio.sfx('pow'); V.shake(8); flash(V, T, hT, red, 160); n.remove(); }
      else { // the last one is far bigger than any decoy should be
        land(2); MB.audio.sfx('boom'); V.shake(24); V.hitStop && V.hitStop();
        flash(V, T, hT, '#ffffff', 420); flash(V, T, hT, red, 340); ring(V, T, red, 3, 0.6); burst(V, T, '#ffb347', 20, { h: hT, spread: 150 });
        n.remove();
      }
    })));
    pop(V, T, hT + 140, own(a, 'finish', 'T-that was... on purpose!'), 'float-text burn', 1.2);
    actor.set(3);
    MB.audio.sfx('gasp'); gsap.to(hare.body, { scale: 0.1, opacity: 0, duration: 0.5, ease: 'power2.in' }); MB.audio.sfx('squeak');
    pop(V, A, H + 50, '...It actually worked?!', 'float-text baka', 1);
    await wait(0.7);
  });

  // Valerian (Valerian): the vampire needs no weapon, only a word. A crimson sigil opens under the target, bats stream out of
  // his hand and spiral in, and the command (KNEEL) is stamped on them.
  const batSvg = (c) => `<svg viewBox="0 0 90 56" width="90" height="56" overflow="visible"><path d="M45 30 C36 8 12 6 0 24 C10 24 14 32 18 40 C24 33 34 33 38 42 L45 54 L52 42 C56 33 66 33 72 40 C76 32 80 24 90 24 C78 6 54 8 45 30Z" fill="#14050b" stroke="${c}" stroke-width="2.5"/><circle cx="41" cy="26" r="2" fill="#ff4a6a"/><circle cx="49" cy="26" r="2" fill="#ff4a6a"/></svg>`;
  S.batcommand = (V, a, t, impact) => posed(V, a, t, impact, 'valerian', async (k) => {
    const { A, T, H, dir, actor, land, hT, r } = k, blood = '#c52e59';
    pop(V, A, H + 40, own(a, 'cry', 'Kneel.'), 'float-text debuff', 1.2);
    await wait(0.6);
    actor.set(1);
    const Oh = k.hand(0, 1, 0.55);
    const sigil = k.make('thrown', '🦇', { x: Oh.x, y: A.y }, Oh.h + 30);
    sigil.body.style.fontSize = '84px'; sigil.body.style.filter = `drop-shadow(0 0 14px ${blood})`;
    gsap.fromTo(sigil.body, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
    MB.audio.sfx('dark');
    const rc = runeCircle(V, T, blood, { size: 280, hold: 1.7 });
    await wait(0.6);
    actor.set(2);
    const O = k.hand(0, 2, 0.55), OF = { x: O.x, y: A.y };
    MB.audio.sfx('flutter');
    k.fade(sigil, 0.2);
    const bats = Array.from({ length: 9 }, (_, i) => { const n = k.make('bat-flock', batSvg(blood), OF, O.h); n.body.style.setProperty('--c', blood); return n; });
    const flap = k.loop(gsap.to(bats.map((n) => n.body.firstChild), { scaleY: 0.45, duration: 0.07, yoyo: true, repeat: -1, transformOrigin: '50% 50%' }));
    await Promise.all(bats.map((n, i) => wait(i * 0.07).then(async () => {
      const a0 = (i / bats.length) * Math.PI * 2, rad0 = 150 + (i % 3) * 25;
      const fn = (q) => {
        if (q < 0.45) { // sweep out and up to a ring round the target
          const e = q / 0.45, E = { x: T.x + Math.cos(a0) * rad0, y: T.y + Math.sin(a0) * rad0 * 0.45 };
          return { ...arc(OF, E, O.h, hT + 60, 60)(e), s: 0.4 + e * 0.35, r: Math.sin(e * 9) * 10 };
        }
        const e = (q - 0.45) / 0.55, ang = a0 + e * Math.PI * 1.6, rad = rad0 * (1 - e);
        return { x: T.x + Math.cos(ang) * rad, y: T.y + Math.sin(ang) * rad * 0.45, h: hT + 60 * (1 - e) + 14 * Math.sin(e * 12), s: 0.75 - e * 0.25, r: Math.sin(e * 22) * 12 };
      };
      await path(n, fn, 1.1, 'power1.in');
      if (i < 3) { land(i); MB.audio.sfx(i ? 'hit' : 'chomp'); burst(V, T, blood, 5, { h: hT, spread: 55 }); }
      n.remove();
    })));
    flap.kill();
    await wait(0.05);
    slamStamp(V, T, hT + 100, 'KNEEL', blood, 0.9);
    MB.audio.sfx('gavel'); V.shake(14); ring(V, T, blood, 2.6, 0.6); flash(V, T, hT, '#ff5a7a', 280);
    const tv = victim(V, t);
    if (tv) gsap.timeline().to(tv.img, { scaleY: 0.8, scaleX: 1.1, duration: 0.16, transformOrigin: '50% 100%' }).to(tv.img, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.45)', delay: 0.3 });
    // his due returns along a crimson thread
    for (let i = 0; i < 6; i++) {
      const d = k.make('spark', '', T, hT); d.body.style.setProperty('--c', blood); d.body.style.width = d.body.style.height = '12px';
      wait(0.1 + i * 0.07).then(() => path(d, (q) => ({ ...arc(T, A, hT, H * 0.6, 50, (i % 2 ? 1 : -1) * 24, r.perp)(q), s: 1 - q * 0.4 }), 0.6, 'sine.inOut').then(() => d.remove()));
    }
    pop(V, T, hT + 150, own(a, 'finish', 'How tiresome. Kneel anyway.'), 'float-text debuff', 1.2);
    await wait(0.5);
    actor.set(3); rise(V, A, blood, 6, H); MB.audio.sfx('heal');
    rc.remove();
    await wait(0.7);
  });

  // Reika (Your Loving Maid): a prankster at the cat cafe. She flicks tea at you, the cup lands on your head like a hat,
  // and her cafe cats rush the spill.
  S.maidprank = (V, a, t, impact) => posed(V, a, t, impact, 'reika', async (k) => {
    const { A, T, H, dir, actor, land, hT, r } = k, matcha = '#8ed36a';
    pop(V, A, H + 40, own(a, 'cry', 'Order up, goshujin-sama. ...Idiot.'), 'float-text baka', 1.2);
    await wait(0.55);
    actor.set(1);
    // two cafe cats sneak out along the floor
    const cats = [-1, 1].map((s, i) => {
      const P = { x: A.x - dir * 20 + s * 24, y: A.y + (T.y > A.y ? 14 : -14) };
      const n = k.make('thrown', '🐈', P, 4); n.body.style.fontSize = '46px'; n.P = P;
      gsap.set(n.body, { scaleX: dir });
      gsap.fromTo(n.body, { scale: 0 }, { scale: 1, duration: 0.2, delay: 0.1 + i * 0.1, ease: 'back.out(3)' });
      return n;
    });
    MB.audio.sfx('meow');
    await wait(0.45);
    cats.forEach((n, i) => {
      const dest = { x: lerp(n.P.x, T.x, 0.62) + (i ? 70 : -70), y: lerp(n.P.y, T.y, 0.62) };
      path(n, (q) => ({ x: lerp(n.P.x, dest.x, q), y: lerp(n.P.y, dest.y, q), h: 4 + 12 * Math.abs(Math.sin(q * Math.PI * 4)), s: 1 }), 0.6, 'power1.inOut');
    });
    actor.set(2);
    const P = k.hand(0, 2, 0.6);
    MB.audio.sfx('swish');
    const cup = k.make('thrown', '🍵', { x: P.x, y: A.y }, P.h); cup.body.style.fontSize = '58px';
    const spill = Array.from({ length: 9 }, () => { const d = k.make('spark', '', { x: P.x, y: A.y }, P.h); d.body.style.setProperty('--c', matcha); d.body.style.width = d.body.style.height = rnd(8, 15) + 'px'; return d; });
    spill.forEach((d, i) => wait(i * 0.03).then(async () => {
      await path(d, (q) => ({ ...arc({ x: P.x, y: A.y }, T, P.h, hT * 0.8, 90 + i * 4, Math.sin(i * 2.1) * 34, r.perp)(q) }), 0.6, 'sine.inOut');
      if (i % 3 === 0) burst(V, T, matcha, 4, { h: hT, spread: 50 });
      d.remove();
    }));
    // the cup lands on the target's head, upside down
    const crown = t.isLeader ? hT * 1.7 : hT * 2 + 10;
    await path(cup, (q) => ({ ...arc({ x: P.x, y: A.y }, T, P.h, crown, t.isLeader ? 60 : 110)(q), r: q * (dir < 0 ? -540 : 540), s: 1 }), 0.65, 'power1.in');
    land(0); MB.audio.sfx('splash'); V.shake(10);
    gsap.set(cup.body, { rotation: 180 });
    droplets(V, T, 10, 110); flash(V, T, hT, matcha, 200); ring(V, T, matcha, 1.7, 0.45);
    pop(V, T, crown + 60, own(a, 'finish', 'Oops. My hand slipped. Ehehe~'), 'float-text baka', 1.2);
    // the cats pounce on the spill
    await Promise.all(cats.map((n, i) => wait(i * 0.18).then(async () => {
      const from = { x: gsap.getProperty(n, 'x'), y: gsap.getProperty(n, 'y') };
      MB.audio.sfx('meow');
      await path(n, (q) => ({ ...arc(from, { x: T.x + (i ? 36 : -36), y: T.y }, 6, hT * 0.7, 90)(q), s: 1 }), 0.4, 'power1.in');
      land(i + 1); burst(V, T, matcha, 5, { h: hT * 0.7, spread: 50 });
      scatter(V, T, hT * 0.7, ['🐾'], 2, 70);
    })));
    await wait(0.25);
    cats.forEach((n) => { k.fade(n, 0.3); });
    k.fade(cup, 0.4, 0.2);
    actor.set(3);
    await wait(0.6);
  });

  // ---------------------------------------------------------------- pose-sheet duos
  // Both partners are drawn from their own sheets. `members` is in pair order (0 = the left partner); a bond whose
  // partners aren't both on the board falls back to a single partner's attack.
  const membersOf = (a, want) => { const m = ((a.card && a.card.members) || []).map((x) => x.id); return want.every((id) => m.includes(id)) ? m : null; };

  // Hanako & Lilly (Katawa Shoujo): tea on the roof between friends. Lilly pours, Hanako sets her knight on the board; the
  // tea runs over the piece and the knight hops in, steaming.
  S.teachess = (V, a, t, impact) => {
    const m = membersOf(a, ['hanako-ikezawa', 'lilly-satou']);
    if (!m) return S.knightmove(V, a, t, impact);
    return posed(V, a, t, impact, m, async (k) => {
      const { A, T, H, dir, actors, land, hT, r } = k, hi = m.indexOf('hanako-ikezawa'), li = 1 - hi, lav = '#b49cff', amber = '#e8a43a';
      pop(V, k.home(hi), H + 40, 'T-tea, Lilly?', 'float-text shield', 1);
      await wait(0.35);
      pop(V, k.home(li), H + 40, 'Of course, Hanako.', 'float-text buff', 1);
      await wait(0.55);
      actors.forEach((ac) => ac.set(1));
      const board = strip(V, A, T, 'chess-board', lav);
      MB.audio.sfx('swish');
      const steam = k.hand(li, 1, 0.5);
      for (let i = 0; i < 3; i++) {
        const s = k.make('smoke', '', { x: steam.x + rnd(-8, 8), y: A.y }, steam.h + 20); s.body.style.width = s.body.style.height = '24px';
        gsap.fromTo(s.body, { scale: 0.4, opacity: 0.8 }, { scale: 1.3, y: `-=${rnd(40, 70)}`, opacity: 0, duration: 0.8, delay: i * 0.15, onComplete: () => s.remove() });
      }
      await wait(0.6);
      actors.forEach((ac) => ac.set(2));
      const OH = k.hand(hi, 2, 0.5), OL = k.hand(li, 2, 0.5), side = T.x < 590 ? 1 : -1, M = { x: T.x + side * 120, y: T.y };
      const kn = k.make('chess-knight', '♞\uFE0E', { x: OH.x, y: A.y }, OH.h);
      kn.body.style.setProperty('--c', lav);
      gsap.fromTo(kn.body, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
      MB.audio.sfx('sparkle');
      await wait(0.3);
      // the tea runs over the knight
      MB.audio.sfx('splash');
      for (let i = 0; i < 6; i++) {
        const d = k.make('spark', '', { x: OL.x, y: A.y }, OL.h); d.body.style.setProperty('--c', amber); d.body.style.width = d.body.style.height = rnd(8, 13) + 'px';
        wait(i * 0.04).then(() => path(d, (q) => arc({ x: OL.x, y: A.y }, { x: OH.x, y: A.y }, OL.h, OH.h, 30)(q), 0.3, 'sine.inOut').then(() => { d.remove(); burst(V, { x: OH.x, y: A.y }, amber, 2, { h: OH.h, spread: 30 }); }));
      }
      await wait(0.4);
      kn.body.style.filter = `drop-shadow(0 0 10px ${amber}) drop-shadow(0 0 8px ${lav})`;
      const hop = async (P, Q, h0, h1, peak, dur) => {
        await path(kn, (q) => ({ ...arc(P, Q, h0, h1, peak)(q), r: Math.sin(q * Math.PI) * 14 * dir }), dur, 'power1.inOut');
        MB.audio.sfx('tick'); ring(V, Q, lav, 0.9, 0.35);
      };
      await hop({ x: OH.x, y: A.y }, M, OH.h, 60, 90, 0.5);
      await hop(M, T, 60, hT, 110, 0.4);
      land(0); MB.audio.sfx('clang'); V.shake(12);
      scatter(V, T, hT, ['♟\uFE0E', '☕', '✨'], 8, 130);
      await wait(0.12);
      // the steam that comes with it
      for (let i = 0; i < 4; i++) puff(V, { x: T.x + rnd(-30, 30), y: T.y }, '#fff8e8', 2, hT * 0.8, 0.8);
      land(1); flash(V, T, hT, amber, 220); ring(V, T, amber, 2, 0.5);
      pop(V, T, hT + 110, '...Checkmate.', 'float-text shield', 1.1);
      await wait(0.2);
      pop(V, T, hT + 60, 'Well played, dear.', 'float-text buff', 1.1);
      k.fade(kn, 0.4); gsap.to(board, { opacity: 0, duration: 0.4, onComplete: () => board.remove() });
      actors.forEach((ac) => ac.set(3));
      await wait(0.7);
    });
  };

  // Eliza & Uzi (Stranded terrestrial): the researcher scans, the soldier bluffs. Eliza's scanner paints three marks on
  // the target, Uzi's decoys hop onto each mark, and the chain goes off.
  S.fieldbluff = (V, a, t, impact) => {
    const m = membersOf(a, ['eliza', 'uzi']);
    if (!m) return S.fieldnotes(V, a, t, impact);
    return posed(V, a, t, impact, m, async (k) => {
      const { A, T, H, dir, actors, land, hT } = k, ei = m.indexOf('eliza'), ui = 1 - ei, cy = '#4fe8ff', red = '#e02a3a';
      const ret = k.make('eliza-reticle', `<svg viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="${cy}" stroke-width="5" stroke-linecap="round"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="8"/><path d="M60 4V28M60 92V116M4 60H28M92 60H116"/></svg>`, T, hT);
      gsap.fromTo(ret.body, { scale: 2.6, opacity: 0, rotation: -90 }, { scale: 1.1, opacity: 1, rotation: 0, duration: 0.5, ease: 'power3.out' });
      MB.audio.sfx('scope');
      const ov = k.over(70);
      const read = k.make('eliza-read', '<b>SPECIMEN #08</b><i>Weak spot: left knee?</i><i>(probably)</i>', { x: T.x + ov.dx, y: T.y }, ov.h);
      gsap.fromTo(read.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.3, delay: 0.25 });
      pop(V, k.home(ei), H + 40, 'Ooh, a weak spot~!', 'float-text shield', 1);
      const glare = actors[ui].node; gsap.fromTo(glare, { x: k.home(ui).x - 2 }, { x: k.home(ui).x + 2, duration: 0.05, yoyo: true, repeat: 9 });
      pop(V, k.home(ui), H + 40, 'W-we know! We KNEW that!', 'float-text burn', 1);
      await wait(0.8);
      actors.forEach((ac) => ac.set(1));
      MB.audio.sfx('powerup');
      await wait(0.5);
      actors.forEach((ac) => ac.set(2));
      // three marks, three decoys
      const marks = [{ x: -70, y: 0, h: 0.35 }, { x: 70, y: 0, h: 0.65 }, { x: 0, y: 0, h: 0.5 }].map((p) => ({ x: T.x + p.x, y: T.y, h: hT * 2 * p.h }));
      const OE = k.hand(ei, 2, 0.6), OU = k.hand(ui, 2, 0.5), OUF = { x: OU.x, y: A.y };
      const bots = marks.map((mk, i) => {
        const n = k.make('rabbit-bot', rabbitBotSvg(red), OUF, OU.h); gsap.fromTo(n.body, { scale: 0 }, { scale: 0.55, duration: 0.2, delay: i * 0.1 }); return n;
      });
      for (let i = 0; i < marks.length; i++) { // the scanner pings each mark
        const ping = k.make('thrown', `<svg viewBox="0 0 60 60" width="60" height="60" fill="none" stroke="${cy}" stroke-width="5"><circle cx="30" cy="30" r="22"/><circle cx="30" cy="30" r="6" fill="${cy}"/></svg>`, { x: OE.x, y: A.y }, OE.h);
        MB.audio.sfx('pulse');
        path(ping, (q) => ({ ...arc({ x: OE.x, y: A.y }, marks[i], OE.h, marks[i].h, 40)(q), s: 0.7 + q * 0.4 }), 0.35, 'power2.out').then(() => { ring(V, marks[i], cy, 0.8, 0.4); ping.remove(); });
        await wait(0.2);
      }
      await Promise.all(bots.map((n, i) => wait(i * 0.3).then(async () => {
        MB.audio.sfx('boing');
        await path(n, (q) => ({ x: lerp(OUF.x, marks[i].x, q), y: lerp(OUF.y, marks[i].y, q), h: lerp(OU.h, marks[i].h, q) + 70 * Math.abs(Math.sin(q * Math.PI * 3)), s: 0.55, r: Math.sin(q * Math.PI * 6) * 9 }), 0.7, 'none');
        MB.audio.sfx('tick'); await wait(0.15);
        land(i); MB.audio.sfx(i < 2 ? 'pow' : 'boom'); V.shake(8 + i * 8);
        flash(V, marks[i], marks[i].h, i < 2 ? red : '#ffffff', 170 + i * 80); ring(V, marks[i], red, 1.4 + i * 0.7, 0.5); puff(V, marks[i], '#ff9a8a', 5, marks[i].h);
        n.remove();
      })));
      burst(V, T, '#ffb347', 20, { h: hT, spread: 150 }); flash(V, T, hT, red, 380);
      pop(V, T, hT + 140, 'Eighty-seven percent effective!', 'float-text shield', 1.2);
      actors.forEach((ac) => ac.set(3));
      pop(V, k.home(ui), H + 40, '...I did that on purpose.', 'float-text baka', 1.1);
      k.fade(ret, 0.3); k.fade(read, 0.3);
      await wait(0.8);
    });
  };

  // Reika & Ida (Your Loving Maid, Integrated Domestic Android): two very different maids on one shift. Reika flicks
  // teacups, Ida's drones catch every one on a tray and deliver it, to the millimeter, onto the customer.
  S.maidshift = (V, a, t, impact) => {
    const m = membersOf(a, ['reika', 'ida']);
    if (!m) return S.maidprank(V, a, t, impact);
    return posed(V, a, t, impact, m, async (k) => {
      const { A, T, H, dir, actors, land, hT } = k, ri = m.indexOf('reika'), ii = 1 - ri, g = '#5dffa0', matcha = '#8ed36a';
      pop(V, k.home(ri), H + 40, 'Order up~ ...idiot.', 'float-text baka', 1.1);
      await wait(0.4);
      const pad = k.make('ida-holo', '<b>ORDER #1</b><i>1x TEA (HOT)</i><i>Table: YOU</i>', { x: k.home(ii).x, y: A.y }, H * 1.05);
      gsap.fromTo(pad.body, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.25 });
      MB.audio.sfx('glitch');
      pop(V, k.home(ii), H + 70, 'Order received.', 'float-text heal', 1);
      await wait(0.6);
      actors.forEach((ac) => ac.set(1));
      await wait(0.45);
      actors.forEach((ac) => ac.set(2));
      const OR = k.hand(ri, 2, 0.6), ORF = { x: OR.x, y: A.y }, OI = k.hand(ii, 2, 0.6);
      MB.audio.sfx('swish');
      const jobs = [0, 1, 2].map((i) => {
        const cup = k.make('thrown', '🍵', ORF, OR.h); cup.body.style.fontSize = '50px';
        const dr = k.make('ida-drone', droneSvg(g), { x: OI.x, y: A.y }, OI.h); gsap.set(dr.body, { scale: 0.7 });
        gsap.to(dr.body.querySelectorAll('.rot'), { scaleX: 0.5, duration: 0.05, yoyo: true, repeat: -1 });
        return { cup, dr, side: (i - 1) * 46 };
      });
      await Promise.all(jobs.map((j, i) => wait(i * 0.3).then(async () => {
        MB.audio.sfx('whoosh');
        const to = { x: T.x + j.side, y: T.y };
        // the cup is flicked up and wide; the drone slides under it, and they arrive together
        path(j.dr, (q) => ({ ...arc({ x: OI.x, y: A.y }, to, OI.h, hT * 1.2, 40)(q), s: 0.7, r: Math.sin(q * 8) * 5 }), 0.7, 'sine.inOut');
        await path(j.cup, (q) => ({ ...arc(ORF, to, OR.h, hT * 1.2 + 24, 120)(q), r: q * 360, s: 1 }), 0.7, 'sine.inOut');
        land(i); MB.audio.sfx(i === 2 ? 'ding' : 'splash'); V.shake(8);
        flash(V, to, hT, matcha, 170); droplets(V, to, 6, 80);
        j.cup.remove(); k.fade(j.dr, 0.3);
      })));
      slamStamp(V, T, hT + 100, 'SERVED!', g, 0.9);
      MB.audio.sfx('applause'); ring(V, T, g, 2.2, 0.5); V.shake(10);
      pop(V, k.home(ii), H + 40, 'Task complete. Tip required.', 'float-text heal', 1.1);
      pop(V, k.home(ri), H + 135, 'N-not like I wanted it!', 'float-text baka', 1.1);
      k.fade(pad, 0.3);
      actors.forEach((ac) => ac.set(3));
      await wait(0.8);
    });
  };

  // Valerian & Priest Pristo (Valerian, DUMB SUPER FANTASY RPG): two vampires, one of them in a cassock. Pristo's amp
  // rises, Valerian's bats take the riff on their wings, and the chords land crimson.
  S.nightmass = (V, a, t, impact) => {
    const m = membersOf(a, ['valerian', 'priest-pristo']);
    if (!m) return S.batcommand(V, a, t, impact);
    return posed(V, a, t, impact, m, async (k) => {
      const { A, T, H, dir, actors, land, hT, r } = k, vi = m.indexOf('valerian'), pi = 1 - vi, blood = '#c52e59', gold = '#f0d27a';
      const amp = k.make('amp', '<i></i><i></i>', { x: k.home(pi).x, y: A.y - 26 }, 0);
      amp.body.style.setProperty('--c', blood);
      gsap.set(amp.body, { yPercent: -100, y: 0, scale: 0.72, transformOrigin: '50% 100%' });
      MB.audio.sfx('slam');
      await gsap.fromTo(amp.body, { scaleY: 0 }, { scaleY: 0.72, duration: 0.28, ease: 'back.out(2)' });
      pop(V, k.home(pi), H + 40, 'Welcome to my CASA, guest.', 'float-text buff', 1.1);
      await wait(0.35);
      pop(V, k.home(vi), H + 40, '...Do play quietly.', 'float-text debuff', 1.1);
      await wait(0.5);
      actors.forEach((ac) => ac.set(1));
      const rc = runeCircle(V, T, blood, { size: 280, hold: 2.2 });
      const sig = k.make('thrown', '🦇', { x: k.hand(vi, 1).x, y: A.y }, H * 0.8);
      sig.body.style.fontSize = '72px'; sig.body.style.filter = `drop-shadow(0 0 14px ${blood})`;
      gsap.fromTo(sig.body, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(2)' });
      MB.audio.sfx('guitar');
      const thump = k.loop(gsap.to(amp.body, { scaleX: 0.77, duration: 0.13, yoyo: true, repeat: -1 }));
      await wait(0.55);
      const OP = { x: k.hand(pi, 1).x, y: A.y }, OV = { x: k.hand(vi, 2).x, y: A.y };
      const flights = [];
      for (let i = 0; i < 3; i++) {
        actors[pi].set(1 + (i % 2)); actors[vi].set(2);
        MB.audio.sfx('guitar');
        const chord = k.make('pristo-chord', `<svg viewBox="0 0 140 140" width="140" height="140" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round"><path d="M38 30 Q12 70 38 110 M102 30 Q128 70 102 110"/><path d="M48 43 Q29 70 48 97 M92 43 Q111 70 92 97" stroke-width="3"/><path d="M70 49 V91 M55 63 H85" stroke="#fff8d6" stroke-width="7"/></svg>`, OP, H * 0.6);
        const bat = k.make('bat-flock', batSvg(blood), OV, H * 0.6); gsap.set(bat.body, { scale: 0.5 });
        gsap.to(bat.body.firstChild, { scaleY: 0.45, duration: 0.07, yoyo: true, repeat: -1 });
        flights.push((async () => {
          // both leave their partner's hand, meet over the middle, and go on to the target as one
          const mid = { x: lerp(OP.x, OV.x, 0.5), y: A.y };
          await Promise.all([
            path(chord, (q) => ({ ...arc(OP, mid, H * 0.6, H * 0.8, 30)(q), s: 0.6 }), 0.3, 'sine.inOut'),
            path(bat, (q) => ({ ...arc(OV, mid, H * 0.6, H * 0.8, 30)(q), s: 0.5 + q * 0.1, r: Math.sin(q * 10) * 10 }), 0.3, 'sine.inOut'),
          ]);
          bat.remove();
          chord.body.querySelector('svg').setAttribute('stroke', blood);
          await path(chord, (q) => ({ ...arc(mid, T, H * 0.8, hT, 30)(q), s: 0.6 + q * 0.3 }), 0.45, 'power1.in');
          land(i); MB.audio.sfx(i ? 'hit' : 'chomp');
          flash(V, T, hT, blood, 150); ring(V, T, blood, 1.5, 0.4); burst(V, T, blood, 7, { h: hT, spread: 60, shape: 'shard' });
          chord.remove();
        })());
        await wait(0.32);
      }
      await Promise.all(flights);
      thump.kill();
      for (let i = 0; i < 2; i++) { // the solo
        const b = V.billboard('bolt', lightningSvg(470 - hT * 0.3, '#ff6a8a'), T.x + rnd(-40, 40), T.y);
        k.nodes.push(b);
        gsap.set(b.body, { yPercent: -100, y: -hT * 0.3 });
        await draw(b.body.querySelectorAll('.d'), { duration: 0.06 });
        MB.audio.sfx('thunder'); flash(V, T, hT, '#ff6a8a', 200); V.shake(10);
        gsap.to(b.body, { opacity: 0, duration: 0.18, delay: 0.06, onComplete: () => b.remove() });
        await wait(0.1);
      }
      slamStamp(V, T, hT + 100, 'AMEN', blood, 0.7); MB.audio.sfx('gavel');
      pop(V, k.home(pi), H + 40, '\\m/ AMEN \\m/', 'float-text buff', 1.1);
      pop(V, k.home(vi), H + 90, 'Encore. Kneeling optional.', 'float-text debuff', 1.1);
      k.fade(sig, 0.3); rc.remove();
      gsap.to(amp.body, { scaleY: 0, duration: 0.3, delay: 0.2 });
      actors.forEach((ac) => ac.set(3));
      await wait(0.8);
    });
  };

  // ---------------------------------------------------------------- signature styles: Exodus, In Her Care, Pastures Unknown
  // Marise: the candidate evaluation. A clipboard hangs over the target, three criteria are ticked off with a red cross, and the
  // stamp comes down: UNQUALIFIED
  S.candidacy = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Let us begin the evaluation.'), 'float-text shield', 1.1);
    await gsap.to(v.figure, { y: -8, duration: 0.15, yoyo: true, repeat: 1 });
    const board = propAt(V, T, hT * 1.6, '📋', 96);
    MB.audio.sfx('crinkle');
    for (const line of ['Punctuality ✗', 'Enthusiasm ✗', 'Protagonist energy ✗']) {
      await wait(0.38);
      MB.audio.sfx('tick');
      pop(V, T, hT * 1.9 + 20, line, 'float-text debuff', 0.8);
    }
    await wait(0.3);
    MB.audio.sfx('swish');
    await slamStamp(V, T, hT * 1.2, 'UNQUALIFIED', '#e0283c', 0.7);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    squash(tv, 0.6);
    fadeOut(board, 0.1);
    pop(V, T, hT + 140, own(a, 'finish', 'We will be in touch.'), 'float-text shield', 1.1);
    await wait(0.5);
  };

  // Sakuragi: the Chief Executive Overlord proclaims fate in his full armor. Grand words rise round him, then a blue light and a
  // sword come down on the target: transcendental relocation
  const swordSvg = (c) => `<svg viewBox="0 0 50 230" width="42" height="180" overflow="visible"><path d="M25 228 L10 170 L10 40 L25 6 L40 40 L40 170Z" fill="#dfe8f2" stroke="#4a5568" stroke-width="3"/><path d="M25 14 V170" stroke="${c}" stroke-width="4"/><rect x="0" y="34" width="50" height="9" rx="4" fill="#d4a63a" stroke="#6b4d10" stroke-width="2"/></svg>`;
  S.proclaim = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Behold: TRANSCENDENTAL RELOCATION!'), 'float-text buff', 1.3);
    gsap.to(v.figure, { y: -22, duration: 0.3, ease: 'power2.out' });
    gsap.to(v.img, { filter: `drop-shadow(0 0 16px ${c}) brightness(1.2)`, duration: 0.4 });
    MB.audio.sfx('choir');
    for (const w of ['FATE', 'DESTINY', 'PROTAGONIST']) { pop(V, { x: A.x + rnd(-50, 50), y: A.y }, H + rnd(10, 60), w, 'float-text shield', 0.8); await wait(0.28); }
    const col = pillar(V, T, c);
    MB.audio.sfx('holy');
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.7, scaleY: 1.4, duration: 0.35, ease: 'power3.out' });
    const sword = V.billboard('thrown', swordSvg(c), T.x, T.y);
    gsap.set(sword.body, { y: -hT * 2 - 80, rotation: 180 });
    sword.body.style.filter = `drop-shadow(0 0 14px ${c})`;
    await wait(0.3);
    MB.audio.sfx('incoming');
    await gsap.to(sword.body, { y: -hT * 0.8, duration: 0.3, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('clang'); MB.audio.sfx('beam'); V.shake(22); V.hitStop();
    flash(V, T, hT, '#ffffff', 340);
    tint(tv, 'brightness(3) saturate(0)', 0.8);
    pop(V, T, hT + 150, own(a, 'finish', 'Your relocation is complete.'), 'float-text buff', 1.2);
    await wait(0.5);
    fadeOut(sword, 0.1); gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to(v.img, { filter: 'brightness(1)', duration: 0.3, clearProps: 'filter' });
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  // Obliviahime: the exiled princess of the Umbral Dynasty finally breaks her seal. A rune circle opens under the target, a swarm of
  // bats pours in, a column of dark fire follows, and she holds the pose a moment too long
  S.umbral = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Sealed by envious gods... NO MORE!'), 'float-text debuff', 1.3);
    gsap.to(v.figure, { y: -14, duration: 0.3 });
    gsap.to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.2)`, duration: 0.4 });
    MB.audio.sfx('dark');
    const seal = runeCircle(V, T, c, { size: 280 });
    await wait(0.8);
    for (let i = 0; i < 9; i++) {
      const b = V.billboard('thrown', '🦇', A.x, A.y), dur = 0.55;
      b.body.style.fontSize = rnd(36, 52) + 'px';
      gsap.set(b.body, { y: -H * 0.8 });
      gsap.to(b, { x: T.x + rnd(-30, 30), y: T.y + rnd(-15, 15), duration: dur, delay: i * 0.06, ease: 'power1.in' });
      gsap.to(b.body, { y: -hT * rnd(0.6, 1.5), rotation: rnd(-40, 40), duration: dur, delay: i * 0.06, ease: 'power1.in', onComplete: () => b.remove() });
    }
    MB.audio.sfx('flutter');
    await wait(0.9);
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.6, scaleY: 1.3, duration: 0.3, ease: 'power3.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('dark'); V.shake(18); V.hitStop();
    tint(tv, 'brightness(0.4) saturate(2)', 0.8);
    await wait(0.6);
    seal.remove();
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to(v.img, { filter: 'brightness(1)', duration: 0.3, clearProps: 'filter' });
    gsap.to(v.figure, { y: 0, duration: 0.3 });
    pop(V, A, H + 40, '...As foretold.', 'float-text hic', 1);
    await wait(0.4);
  };

  // C.A.R.E.: the house is hers. The lights flicker, every door in the place slams shut round the target and a padlock settles on it
  S.homesafe = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'You cannot l-leave, Dearest~'), 'float-text heal', 1.2);
    gsap.to(v.img, { filter: `drop-shadow(0 0 18px ${c}) brightness(1.5)`, duration: 0.3 });
    MB.audio.sfx('glitch');
    ring(V, A, c, 2.4, 0.8);
    for (let i = 0; i < 3; i++) { flash(V, T, hT, c, 300); await wait(0.12); }
    pop(V, T, hT * 2 + 70, 'LOCKING ALL DOORS', 'float-text shield', 0.9);
    const doors = [-1, 1].map((s) => propAt(V, { x: T.x + s * 260, y: T.y }, hT, '🚪', 120));
    await wait(0.4);
    MB.audio.sfx('whoosh');
    await Promise.all(doors.map((d, i) => gsap.to(d, { x: T.x + (i ? 38 : -38), duration: 0.35, ease: 'power3.in' })));
    impact(); hit(V, t, c, true); MB.audio.sfx('clang'); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
    squash(tv, 0.6);
    const lock = propAt(V, T, hT * 2 + 20, '🔒', 76);
    MB.audio.sfx('ding');
    pop(V, T, hT + 140, own(a, 'finish', 'Access denied. Stay a while.'), 'float-text heal', 1.2);
    await wait(0.7);
    doors.forEach((d) => fadeOut(d, 0, 0.3)); fadeOut(lock, 0, 0.3);
    gsap.to(v.img, { filter: 'brightness(1)', duration: 0.3, clearProps: 'filter' });
  };

  // Vachelle: the Cowherd Ruminaut beams up cattle. She pulls the wrong lever first and the beam misses; then the saucer slides over
  // the target, lifts it off the ground and a herd drops down in a cloud of cow puns
  S.abduct = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', 'Beaming up the herd!'), 'float-text heal', 1.1);
    await gsap.to(v.figure, { y: -10, duration: 0.15, yoyo: true, repeat: 1 });
    const ufo = V.billboard('thrown', '🛸', A.x, A.y);
    ufo.body.style.fontSize = '100px';
    gsap.set(ufo.body, { y: -hT * 2 - 120, scale: 0 });
    gsap.to(ufo.body, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    MB.audio.sfx('warp');
    await gsap.to(ufo, { x: T.x + sg * 170, y: T.y, duration: 0.6, ease: 'power2.inOut' });
    const miss = pillar(V, { x: T.x + sg * 170, y: T.y }, c);
    gsap.fromTo(miss.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.8, scaleY: 1.2, duration: 0.25, ease: 'power3.out' });
    MB.audio.sfx('beam');
    pop(V, A, H + 40, 'Oops! Wrong lever!', 'float-text hic', 0.9);
    await wait(0.55);
    gsap.to(miss.body, { opacity: 0, duration: 0.2, onComplete: () => miss.remove() });
    await gsap.to(ufo, { x: T.x, duration: 0.4, ease: 'power2.inOut' });
    const beam = pillar(V, T, c);
    gsap.fromTo(beam.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 2.2, scaleY: 1.4, duration: 0.3, ease: 'power3.out' });
    MB.audio.sfx('beam');
    if (tv) gsap.to(tv.figure, { y: -110, rotation: 12, duration: 0.5, ease: 'sine.out' });
    impact(); hit(V, t, c, true); V.shake(10); V.hitStop();
    for (let i = 0; i < 6; i++) {
      const cow = V.billboard('thrown', '🐄', T.x + rnd(-110, 110), T.y + rnd(-25, 25));
      cow.body.style.fontSize = rnd(46, 64) + 'px';
      gsap.set(cow.body, { y: -hT * 2 - 200, rotation: rnd(-30, 30) });
      gsap.to(cow.body, { y: -20, duration: 0.5, delay: 0.3 + i * 0.1, ease: 'power2.in', onComplete: () => { puff(V, { x: gsap.getProperty(cow, 'x'), y: gsap.getProperty(cow, 'y') }, '#e8e8f0', 4, 20, 0.7); fadeOut(cow, 0.25, 0.3); } });
    }
    pop(V, T, hT + 150, own(a, 'finish', 'Holy cow! That was udderly amazing!'), 'float-text heal', 1.3);
    await wait(1.1);
    if (tv) await gsap.to(tv.figure, { y: 0, rotation: 0, duration: 0.35, ease: 'bounce.out' });
    squash(tv, 0.7);
    gsap.to(beam.body, { opacity: 0, duration: 0.25, onComplete: () => beam.remove() });
    fadeOut(ufo, 0, 0.3);
  };

  // Marise & Sakuragi: the CEO declares a relocation, his liaison cites policy, files the form and stamps it. A trapdoor opens
  // under the target and swallows it for a moment
  S.bossreport = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'Behold: TRANSCENDENTAL RELOCATION!'), 'float-text buff', 1.2);
    gsap.to(R, { y: -22, duration: 0.25, ease: 'power2.out' });
    MB.audio.sfx('choir');
    await wait(0.7);
    gsap.to(R, { y: 0, duration: 0.2 });
    pop(V, sideOf(A, 0), H + 70, 'Sir. Policy twelve.', 'float-text shield', 0.9);
    gsap.fromTo(L, { rotation: 0 }, { rotation: -8, duration: 0.2, yoyo: true, repeat: 1 }); // facepalm
    await wait(0.6);
    const form = V.billboard('thrown', '📄', sideOf(A, 0).x, A.y);
    form.body.style.fontSize = '56px';
    gsap.set(form.body, { y: -H * 0.7 });
    MB.audio.sfx('swish');
    gsap.to(form.body, { y: -hT * 1.6, rotation: 360, duration: 0.45, ease: 'power1.in' });
    await gsap.to(form, { x: T.x, y: T.y, duration: 0.45, ease: 'power1.in' });
    await slamStamp(V, T, hT * 1.2, 'RELOCATED', '#2fbf71', 0.8);
    fadeOut(form, 0, 0.2);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    decal(V, T, 'dark', c, 1.2);
    if (tv) await gsap.to(tv.figure, { y: 70, opacity: 0.2, duration: 0.3, ease: 'power2.in' });
    pop(V, T, hT + 150, own(a, 'finish', 'Filed. Next candidate.'), 'float-text buff', 1.1);
    await wait(0.5);
    if (tv) await gsap.to(tv.figure, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)', clearProps: 'y,opacity' });
    resetDuo(v);
  };

  // Jin & Takuya: the otaku summons Truck-kun, the antihero begs him not to. It comes anyway, down the road and straight through the
  // target, which is sent flying: isekai'd
  S.truckkun = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'I summon thee, TRUCK-KUN!'), 'float-text burn', 1.2);
    gsap.fromTo(R, { y: 0 }, { y: -22, duration: 0.2, yoyo: true, repeat: 3 });
    MB.audio.sfx('whistleUp');
    await wait(0.8);
    pop(V, sideOf(A, 0), H + 70, "...Please don't.", 'float-text shield', 0.8);
    await wait(0.5);
    const truck = V.billboard('thrown', '🚚', T.x - sg * 640, T.y);
    truck.body.style.fontSize = '140px';
    gsap.set(truck.body, { y: -60 });
    MB.audio.sfx('honk');
    pop(V, T, hT * 2 + 140, 'HOOONK!', 'float-text dmg', 0.7);
    await gsap.to(truck, { x: T.x, y: T.y, duration: 0.55, ease: 'power3.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('bonk'); V.shake(26); V.hitStop();
    pop(V, T, hT * 2 + 40, "ISEKAI'D!", 'float-text buff', 1);
    gsap.to(truck, { x: T.x + sg * 640, duration: 0.5, ease: 'power1.in', onComplete: () => truck.remove() });
    if (tv) {
      await gsap.to(tv.figure, { x: sg * 170, y: -300, rotation: sg * 540, duration: 0.45, ease: 'power2.out' });
      await gsap.to(tv.figure, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: 'bounce.out' });
    } else await wait(0.5);
    pop(V, sideOf(A, 1), H + 40, '...I wanted to be the reincarnated one!', 'float-text hic', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Takuya & Obliviahime: two unshakeable believers perform their forbidden technique. A rune circle, a chant, a dark column,
  // and then the quiet, hopeful question whether it actually worked
  S.chuuni = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Our forbidden technique...'), 'float-text debuff', 1.1);
    gsap.to(L, { y: -16, rotation: -10, duration: 0.2 });
    gsap.to(R, { y: -16, rotation: 10, duration: 0.2 });
    MB.audio.sfx('rune');
    await wait(0.6);
    const seal = runeCircle(V, T, c, { size: 300 });
    for (const w of ['Umbral...', 'Protagonist...', 'GENESIS!']) { pop(V, sideOf(A, w === 'Umbral...' ? 1 : 0), H + 80, w, 'float-text burn', 0.8); await wait(0.4); }
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.8, scaleY: 1.5, duration: 0.3, ease: 'power3.out' });
    MB.audio.sfx('thunder'); MB.audio.sfx('dark');
    impact(); hit(V, t, c, true); V.shake(20); V.hitStop();
    flash(V, T, hT, '#ffffff', 340);
    tint(tv, 'brightness(0.4) saturate(2)', 0.8);
    await wait(0.6);
    seal.remove();
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to([L, R], { y: 0, rotation: 0, duration: 0.3 });
    pop(V, sideOf(A, 1), H + 40, own(a, 'finish', '...Did it work?'), 'float-text hic', 1);
    await wait(0.5);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- signature styles: Katya, Cranky Roommate, Reincarnation Colosseum, WTF STEP BRO
  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
  // a prop lobbed from one point to another in an arc (P, Q on the floor, h0 / h1 the heights it leaves and lands at); `done` resolves on landing
  function lobProp(V, P, h0, Q, h1, ch, size, dur = 0.5, delay = 0, spin = 0) {
    const b = V.billboard('thrown', ch, P.x, P.y);
    b.body.style.fontSize = size + 'px';
    gsap.set(b.body, { y: -h0 });
    const tl = gsap.timeline({ delay });
    tl.to(b, { x: Q.x, y: Q.y, duration: dur, ease: 'none' }, 0);
    tl.to(b.body, { y: -Math.max(h0, h1) - 100, duration: dur / 2, ease: 'power1.out' }, 0);
    tl.to(b.body, { y: -h1, duration: dur / 2, ease: 'power1.in' }, dur / 2);
    if (spin) tl.to(b.body, { rotation: spin, duration: dur, ease: 'none' }, 0);
    return { b, done: new Promise((r) => tl.eventCallback('onComplete', r)) };
  }

  // Noah (Cranky Roommate): somebody used his toothpaste. He trembles with rage, squeezes the tube dry across the room and slaps his
  // label on the target: PROPERTY OF NOAH
  S.toothpaste = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', 'WHO USED MY TOOTHPASTE?!'), 'float-text debuff', 1.1);
    gsap.fromTo(v.figure, { x: 0 }, { x: -sg * 6, duration: 0.05, yoyo: true, repeat: 11, clearProps: 'x' });
    MB.audio.sfx('wobble');
    const tube = propAt(V, A, H * 0.9, '🧴', 84);
    await wait(0.6);
    MB.audio.sfx('splat');
    gsap.to(tube.body, { scaleX: 0.5, duration: 0.5 });
    const dollops = [];
    for (let i = 0; i < 9; i++) dollops.push(lobProp(V, A, H * 0.9, { x: T.x + rnd(-30, 30), y: T.y + rnd(-12, 12) }, hT * rnd(0.5, 1.4), '💧', rnd(34, 50), 0.5, i * 0.06));
    await dollops[8].done;
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12); V.hitStop();
    decal(V, T, 'splat', '#7ae8d0', 1);
    tint(tv, 'hue-rotate(120deg) brightness(1.4)', 0.9);
    squash(tv, 0.65);
    dollops.forEach((d) => fadeOut(d.b, 0.2));
    await slamStamp(V, T, hT * 1.3, 'PROPERTY OF NOAH', '#4aa8ff', 0.7);
    pop(V, T, hT + 150, own(a, 'finish', 'It had a LABEL on it!'), 'float-text debuff', 1.1);
    fadeOut(tube, 0.2);
    await wait(0.6);
  };

  // Katya: three Slavic squats, sunflower seeds spat in a fan, a bottle that shatters and the boot that follows it
  S.gopnik = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Davai, davai, davai!'), 'float-text burn', 1.1);
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('boing');
      await gsap.to(v.figure, { scaleY: 0.7, y: 8, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'scaleY,y' });
    }
    const seeds = [];
    for (let i = 0; i < 10; i++) seeds.push(lobProp(V, A, H * 0.7, { x: T.x + rnd(-60, 60), y: T.y + rnd(-20, 20) }, hT * rnd(0.4, 1.6), '🌰', rnd(22, 32), 0.45, i * 0.05, rnd(180, 540)));
    MB.audio.sfx('whoosh');
    await seeds[9].done;
    hit(V, t, c, false); MB.audio.sfx('pop');
    seeds.forEach((s) => fadeOut(s.b, 0, 0.15));
    pop(V, A, H + 60, 'Hold my kvass.', 'float-text hic', 0.8);
    const bottle = lobProp(V, A, H * 0.8, T, hT, '🍾', 76, 0.55, 0, 720);
    await bottle.done;
    fadeOut(bottle.b, 0, 0.05);
    debris(V, T, '#bfe8ff', 12, { chars: ['🍾', '✨', '🌻'], h: hT });
    MB.audio.sfx('glass');
    const boot = lobProp(V, A, H * 0.5, T, hT * 0.8, '🥾', 92, 0.3, 0.1, 360);
    await boot.done;
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('punch'); V.shake(18); V.hitStop();
    fadeOut(boot.b, 0.05, 0.2);
    squash(tv, 0.6);
    pop(V, T, hT + 150, own(a, 'finish', 'Easy, no?'), 'float-text burn', 1.1);
    await wait(0.5);
  };

  // Koko: the announcer calls her own fight. Mic up, crowd roaring, a slow-motion REPLAY stamp, then K.O.
  S.commentary = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'AND WE ARE LIVE!'), 'float-text heal', 1.1);
    const mic = propAt(V, A, H * 0.9, '🎤', 70);
    MB.audio.sfx('cheer');
    for (const w of ['HE WINDS UP...', 'THE CROWD GOES WILD!']) { pop(V, T, hT * 2 + 70, w, 'float-text buff', 0.8); await wait(0.45); }
    for (let i = 0; i < 14; i++) {
      const e = V.billboard('thrown', pickOne(['👏', '🎉', '📣', '🔥']), T.x + rnd(-170, 170), T.y + rnd(-30, 30));
      e.body.style.fontSize = rnd(34, 52) + 'px';
      gsap.set(e.body, { y: -hT * 2 - 220 });
      gsap.to(e.body, { y: -rnd(0, 50), duration: 0.5, delay: i * 0.04, ease: 'power2.in', onComplete: () => fadeOut(e, 0.1, 0.2) });
    }
    await wait(0.75);
    MB.audio.sfx('rip');
    await slamStamp(V, T, hT * 1.3, 'REPLAY ⏪', '#7ee06a', 0.5);
    await wait(0.4);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); MB.audio.sfx('applause'); V.shake(16); V.hitStop();
    slamStamp(V, T, hT * 1.3, 'K.O.!', '#ff4a5a', 0.7);
    squash(tv, 0.6);
    pop(V, T, hT + 150, own(a, 'finish', 'WHAT A MATCH, FOLKS!'), 'float-text heal', 1.1);
    fadeOut(mic, 0.3);
    await wait(0.7);
  };

  // The Receptionist: a bell, a queue number, and a rain of tickets. NOW SERVING: you
  S.numberup = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Take a number, please.'), 'float-text shield', 1.1);
    const bell = propAt(V, A, H * 0.8, '🛎️', 64);
    for (let i = 0; i < 3; i++) { MB.audio.sfx('ding'); gsap.fromTo(bell.body, { rotation: -14 }, { rotation: 0, duration: 0.3, ease: 'elastic.out(1,0.3)' }); await wait(0.28); }
    pop(V, T, hT * 2 + 70, 'NOW SERVING: 99', 'float-text debuff', 0.9);
    MB.audio.sfx('whoosh');
    for (let i = 0; i < 16; i++) {
      const tk = V.billboard('thrown', '🎟️', T.x + rnd(-130, 130), T.y + rnd(-25, 25));
      tk.body.style.fontSize = rnd(36, 54) + 'px';
      gsap.set(tk.body, { y: -hT * 2 - 240, rotation: rnd(-60, 60) });
      gsap.to(tk.body, { y: -rnd(0, 60), rotation: rnd(-30, 30), duration: 0.45, delay: i * 0.035, ease: 'power2.in', onComplete: () => fadeOut(tk, 0.25, 0.25) });
    }
    await wait(0.75);
    await slamStamp(V, T, hT * 1.3, 'NEXT!', '#8a6ab8', 0.6);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12); V.hitStop();
    squash(tv, 0.65);
    pop(V, T, hT + 150, own(a, 'finish', 'Please wait your turn.'), 'float-text shield', 1.1);
    fadeOut(bell, 0.2);
    await wait(0.5);
  };

  // Kayla: three tarot cards turn over above the target (the Tower, Death, the Fool) and a rune seal opens under it. She did warn it
  S.tarot = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Pick a card. ...Not that one.'), 'float-text debuff', 1.1);
    gsap.to(v.img, { filter: `drop-shadow(0 0 14px ${c}) brightness(1.1)`, duration: 0.3 });
    MB.audio.sfx('dark');
    const cards = [];
    for (const [i, name] of ['THE TOWER', 'DEATH', 'THE FOOL'].entries()) {
      const card = propAt(V, { x: T.x + (i - 1) * 90, y: T.y }, hT * 2.1, '🃏', 78);
      cards.push(card);
      MB.audio.sfx('tick');
      pop(V, { x: T.x + (i - 1) * 90, y: T.y }, hT * 2.1 + 70, name, 'float-text debuff', 0.8);
      await wait(0.45);
    }
    const seal = runeCircle(V, T, c, { size: 280 });
    MB.audio.sfx('rune');
    await wait(0.7);
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.5, scaleY: 1.3, duration: 0.3, ease: 'power3.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('thunder'); MB.audio.sfx('dark'); V.shake(16); V.hitStop();
    tint(tv, 'brightness(0.4) saturate(2)', 0.8);
    cards.forEach((card) => fadeOut(card, 0.1));
    pop(V, T, hT + 150, own(a, 'finish', 'Told you.'), 'float-text hic', 1);
    await wait(0.6);
    seal.remove();
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to(v.img, { filter: 'brightness(1)', duration: 0.3, clearProps: 'filter' });
  };

  // Melony: she needs to document this. Three camera flashes, a #BLESSED frame stamped over the target and the likes float up
  S.selfie = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Wait, wait, let me get my good side!'), 'float-text burn', 1.1);
    const phone = propAt(V, A, H * 0.9, '📱', 70);
    await gsap.to(v.figure, { y: -10, duration: 0.15, yoyo: true, repeat: 1 });
    for (let i = 0; i < 3; i++) {
      MB.audio.sfx('camera');
      flash(V, T, hT, '#ffffff', 300);
      await wait(0.22);
    }
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(10); V.hitStop();
    slamStamp(V, T, hT * 1.3, '📸 #BLESSED', c, 0.8);
    for (let i = 0; i < 10; i++) {
      const hrt = V.billboard('petal', '💗', T.x + rnd(-80, 80), T.y);
      hrt.body.style.fontSize = rnd(26, 42) + 'px';
      gsap.set(hrt.body, { y: -hT });
      gsap.to(hrt.body, { y: -hT - rnd(120, 220), opacity: 0, duration: 1, delay: i * 0.06, onComplete: () => hrt.remove() });
    }
    pop(V, T, hT + 150, '+9,999 likes', 'float-text burn', 1);
    squash(tv, 0.7);
    pop(V, A, H + 50, own(a, 'finish', 'Ugh, I look amazing.'), 'float-text burn', 1);
    fadeOut(phone, 0.2);
    await wait(0.8);
  };

  // Samantha: she revs the chopper and rides it straight through the target. A wrench follows, because she is a mechanic
  S.chopper = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t), sg = T.x >= A.x ? 1 : -1;
    pop(V, A, H + 95, own(a, 'cry', 'VROOOOM!'), 'float-text burn', 1.1);
    const bike = V.billboard('thrown', '🏍️', T.x - sg * 700, T.y);
    bike.body.style.fontSize = '130px';
    bike.body.style.transform = sg < 0 ? 'scaleX(-1)' : '';
    gsap.set(bike.body, { y: -50 });
    MB.audio.sfx('boom');
    gsap.fromTo(v.figure, { x: 0 }, { x: -sg * 5, duration: 0.05, yoyo: true, repeat: 9, clearProps: 'x' });
    puff(V, A, '#c8c8d0', 8, 30, 1);
    await wait(0.5);
    await gsap.to(bike, { x: T.x, y: T.y, duration: 0.5, ease: 'power3.in', onUpdate: () => Math.random() < 0.4 && puff(V, { x: gsap.getProperty(bike, 'x'), y: gsap.getProperty(bike, 'y') }, '#9a9aa4', 1, 10, 0.6) });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(24); V.hitStop();
    gsap.to(bike, { x: T.x + sg * 700, duration: 0.5, ease: 'power1.in', onComplete: () => bike.remove() });
    if (tv) {
      await gsap.to(tv.figure, { x: sg * 90, rotation: sg * 25, duration: 0.2, ease: 'power2.out' });
      gsap.to(tv.figure, { x: 0, rotation: 0, duration: 0.4, ease: 'bounce.out' });
    }
    const wrench = lobProp(V, A, H * 0.7, T, hT, '🔧', 64, 0.45, 0, 720);
    await wrench.done;
    hit(V, t, c, false); MB.audio.sfx('clang');
    fadeOut(wrench.b, 0, 0.2);
    pop(V, T, hT + 150, own(a, 'finish', 'Who is short NOW?!'), 'float-text burn', 1.1);
    await wait(0.5);
  };

  // Ashton: a shy "shadow clone... jutsu?" that works far better than he expected. Four fox clones pop in round the target and rush it
  S.shadowclones = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', "S-shadow clone... jutsu?"), 'float-text debuff', 1.1);
    await gsap.to(v.figure, { y: -8, duration: 0.12, yoyo: true, repeat: 1 });
    MB.audio.sfx('poof');
    puff(V, A, '#ffffff', 8, 40, 1);
    const spots = [[-200, 10], [200, -10], [-120, 60], [120, -50]];
    const clones = spots.map(([dx, dy]) => {
      const cl = propAt(V, { x: T.x + dx, y: T.y + dy }, 40, '🦊', 84);
      puff(V, { x: T.x + dx, y: T.y + dy }, '#ffffff', 4, 30, 0.8);
      return cl;
    });
    await wait(0.55);
    pop(V, T, hT * 2 + 70, 'BELIEVE IT!', 'float-text burn', 0.8);
    MB.audio.sfx('whoosh');
    await Promise.all(clones.map((cl, i) => gsap.to(cl, { x: T.x, y: T.y, duration: 0.25, delay: i * 0.07, ease: 'power3.in', onComplete: () => { hit(V, t, c, false); MB.audio.sfx('punch'); } })));
    impact(); hit(V, t, c, true); V.shake(14); V.hitStop();
    scatter(V, T, hT, ['🍥', '⭐', '💨'], 8, 150);
    clones.forEach((cl) => { puff(V, { x: gsap.getProperty(cl, 'x'), y: gsap.getProperty(cl, 'y') }, '#ffffff', 3, 30, 0.8); cl.remove(); });
    squash(tv, 0.65);
    pop(V, T, hT + 150, own(a, 'finish', '...Did that really work?'), 'float-text hic', 1);
    await wait(0.5);
  };

  // Jillian: a garden party. A water arc, sunflowers sprouting round the target and one perfectly ripe tomato
  S.gardenparty = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), H = V.heightOf(a), tv = victim(V, t);
    pop(V, A, H + 95, own(a, 'cry', 'Dinner is at six, dear!'), 'float-text heal', 1.1);
    await gsap.to(v.figure, { y: -10, duration: 0.15, yoyo: true, repeat: 1 });
    MB.audio.sfx('splash');
    const drops = [];
    for (let i = 0; i < 12; i++) drops.push(lobProp(V, A, H * 0.7, { x: T.x + rnd(-70, 70), y: T.y + rnd(-15, 15) }, hT * rnd(0.3, 1.2), '💧', rnd(26, 40), 0.5, i * 0.05));
    await drops[11].done;
    drops.forEach((d) => fadeOut(d.b, 0, 0.2));
    const flowers = [];
    for (let i = 0; i < 6; i++) {
      flowers.push(propAt(V, { x: T.x + (i - 2.5) * 52, y: T.y + rnd(-14, 14) }, 30, pickOne(['🌻', '🌷', '🌱', '🌻']), rnd(56, 84)));
      MB.audio.sfx('pop');
      await wait(0.1);
    }
    await wait(0.3);
    const tomato = lobProp(V, A, H * 0.8, T, hT, '🍅', 70, 0.5, 0, 540);
    await tomato.done;
    fadeOut(tomato.b, 0, 0.05);
    impact(); hit(V, t, c, true); MB.audio.sfx('splat'); V.shake(12); V.hitStop();
    decal(V, T, 'splat', '#e0463c', 1);
    squash(tv, 0.65);
    scatter(V, T, hT, ['🌸', '🍪', '🌿'], 8, 150);
    pop(V, T, hT + 150, own(a, 'finish', 'Eat your vegetables.'), 'float-text heal', 1.2);
    await wait(0.8);
    flowers.forEach((f) => fadeOut(f, 0, 0.4));
  };

  // Marl & Mary: Mary sets Marl's fists on fire, and Marl punches the target through a flaming uppercut
  S.firefists = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'Light me up, Mary!'), 'float-text burn', 1.1);
    gsap.to(R, { y: -14, duration: 0.2 });
    MB.audio.sfx('fire');
    for (let i = 0; i < 6; i++) {
      const f = V.billboard('thrown', '🔥', sideOf(A, 1).x, A.y);
      f.body.style.fontSize = '46px';
      gsap.set(f.body, { y: -H * 0.7 });
      gsap.to(f, { x: sideOf(A, 0).x, duration: 0.35, delay: i * 0.05, ease: 'none' });
      gsap.to(f.body, { y: -H * 0.5, opacity: 0, duration: 0.35, delay: i * 0.05, onComplete: () => f.remove() });
    }
    await wait(0.65);
    gsap.to(L, { filter: `drop-shadow(0 0 16px ${c}) brightness(1.3)`, duration: 0.2 });
    pop(V, sideOf(A, 0), H + 80, 'FLAMING FISTS!', 'float-text burn', 0.8);
    MB.audio.sfx('whoosh');
    for (let i = 0; i < 4; i++) {
      const fist = lobProp(V, A, H * 0.7, { x: T.x + rnd(-20, 20), y: T.y + rnd(-10, 10) }, hT * rnd(0.6, 1.4), '👊', 66, 0.2);
      await fist.done;
      hit(V, t, c, false); MB.audio.sfx('punch');
      fadeOut(fist.b, 0, 0.12);
    }
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.6, scaleY: 1.5, duration: 0.3, ease: 'power3.out' });
    impact(); hit(V, t, c, true); MB.audio.sfx('fire'); MB.audio.sfx('slam'); V.shake(20); V.hitStop();
    tint(tv, 'brightness(0.5) saturate(2)', 0.8);
    pop(V, T, hT + 150, own(a, 'finish', 'Burnt. And broken.'), 'float-text burn', 1.1);
    await wait(0.6);
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to([L, R], { y: 0, filter: 'none', duration: 0.3 });
    resetDuo(v);
  };

  // Melony & Kayla: sisters, so they fight each other first. A lipstick and a tarot card are hurled across the target, collide above it,
  // and the wreckage falls on it
  S.siblingfeud = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Your hair is a crime, Kayla.'), 'float-text burn', 1);
    await wait(0.5);
    pop(V, sideOf(A, 1), H + 70, 'Your room is a crime SCENE.', 'float-text debuff', 1);
    await wait(0.4);
    MB.audio.sfx('whoosh');
    const top = hT * 2.2, mid = { x: T.x, y: T.y };
    const lip = lobProp(V, sideOf(A, 0), H * 0.8, { x: T.x - 25, y: T.y }, top, '💄', 64, 0.5, 0, 360);
    const card = lobProp(V, sideOf(A, 1), H * 0.8, { x: T.x + 25, y: T.y }, top, '🃏', 64, 0.5, 0, -360);
    await Promise.all([lip.done, card.done]);
    flash(V, mid, top, '#ffffff', 260); ring(V, mid, c, 2, 0.6);
    MB.audio.sfx('clang');
    pop(V, T, top + 40, 'SO LOUD!', 'float-text burn', 0.8);
    for (const p of [lip, card]) gsap.to(p.b.body, { y: -hT * 0.7, duration: 0.3, ease: 'power2.in' });
    await wait(0.3);
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(16); V.hitStop();
    debris(V, T, c, 12, { chars: ['💄', '🃏', '✨', '🌙'], h: hT });
    fadeOut(lip.b, 0, 0.2); fadeOut(card.b, 0, 0.2);
    squash(tv, 0.65);
    pop(V, T, hT + 150, own(a, 'finish', 'We are NOT done, Kayla.'), 'float-text burn', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- duo styles: the bonds of Katya, Cranky Roommate, Reincarnation Colosseum, WTF STEP BRO
  // the blow every one of these ends on: the damage lands, the target is squashed
  const duoBlow = (V, t, c, impact, tv, shake = 16) => { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(shake); V.hitStop(); squash(tv, 0.65); };

  // Katya & Noah: she mocks, he takes it personally. Her taunt hits first, his tube of toothpaste is thrown back at her and flies on into the target
  S.dormfight = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Cute shirt. Did you sleep in it?'), 'float-text burn', 1.1);
    gsap.fromTo(L, { rotation: 0 }, { rotation: -8, duration: 0.15, yoyo: true, repeat: 3 });
    MB.audio.sfx('laugh');
    await wait(0.8);
    pop(V, sideOf(A, 1), H + 70, 'You ate my LEFTOVERS!', 'float-text debuff', 1);
    gsap.fromTo(R, { x: 0 }, { x: 5, duration: 0.05, yoyo: true, repeat: 9, clearProps: 'x' });
    await wait(0.6);
    const tube = lobProp(V, sideOf(A, 1), H * 0.8, sideOf(A, 0), H * 0.8, '🧴', 70, 0.3, 0, 360);
    await tube.done;
    pop(V, sideOf(A, 0), H + 100, 'Oi!', 'float-text hic', 0.6);
    const back = lobProp(V, sideOf(A, 0), H * 0.8, T, hT, '🪥', 76, 0.5, 0, 720);
    await back.done;
    fadeOut(tube.b, 0, 0.1); fadeOut(back.b, 0, 0.1);
    decal(V, T, 'splat', '#7ae8d0', 1);
    duoBlow(V, t, c, impact, tv, 14);
    pop(V, T, hT + 150, own(a, 'finish', 'Roommates. Ugh.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Zulu & Fine: two cheats, one deck. Zulu slips cards up a sleeve, Fine swaps the target's hand and an ace falls out of both of them
  S.riggeddeck = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Rules are for the Priestess.'), 'float-text burn', 1);
    MB.audio.sfx('deal');
    for (let i = 0; i < 6; i++) {
      const cd = lobProp(V, sideOf(A, i % 2), H * 0.6, { x: T.x + rnd(-70, 70), y: T.y + rnd(-15, 15) }, hT * rnd(0.5, 1.5), '🃏', rnd(40, 54), 0.4, i * 0.1, rnd(180, 540));
      gsap.delayedCall(0.4 + i * 0.1, () => { hit(V, t, c, false); MB.audio.sfx('swish'); fadeOut(cd.b, 0, 0.25); });
    }
    await wait(1.1);
    pop(V, sideOf(A, 1), H + 70, 'Is that... a marked deck?', 'float-text hic', 0.9);
    await wait(0.5);
    const ace = lobProp(V, sideOf(A, 1), H * 0.7, T, hT * 1.2, '🂡', 100, 0.4, 0, 360);
    await ace.done;
    slamStamp(V, T, hT * 1.3, 'BUSTED', '#ffd84a', 0.6);
    duoBlow(V, t, c, impact, tv, 14);
    fadeOut(ace.b, 0, 0.2);
    pop(V, T, hT + 150, own(a, 'finish', 'Villains win. Remember?'), 'float-text burn', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // Marl & Samantha: the gym floor. They flex at each other, load both their lifts onto one barbell and drop it on the target
  S.armwrestle = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'A wrench? Cute.'), 'float-text burn', 1);
    gsap.to(L, { y: -12, scaleX: 1.08, duration: 0.2 });
    await wait(0.5);
    pop(V, sideOf(A, 1), H + 70, 'My bike weighs more!', 'float-text debuff', 1);
    gsap.to(R, { y: -12, scaleX: 1.08, duration: 0.2 });
    MB.audio.sfx('buff');
    await wait(0.6);
    pop(V, sideOf(A, 0), H + 100, '👊 vs 🔧', 'float-text burn', 0.8);
    for (let i = 0; i < 4; i++) { MB.audio.sfx('clang'); gsap.fromTo([L, R], { rotation: 0 }, { rotation: (j) => (j ? 6 : -6), duration: 0.1, yoyo: true, repeat: 1 }); await wait(0.25); }
    const bar = propAt(V, T, hT * 3.4, '🏋️', 140);
    MB.audio.sfx('incoming');
    await wait(0.5);
    await gsap.to(bar.body, { y: -hT * 0.8, duration: 0.35, ease: 'power3.in' });
    duoBlow(V, t, c, impact, tv, 24);
    debris(V, T, c, 10, { chars: ['💥', '🔧', '👊'], h: hT });
    fadeOut(bar, 0.2);
    gsap.to([L, R], { y: 0, scaleX: 1, duration: 0.3 });
    pop(V, T, hT + 150, own(a, 'finish', 'We call it a tie.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Katya & Samantha: leg day. Both squat, both mock the target's form, then they kick off the floor together through it
  S.legday = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', "Leg day, small one. Da?"), 'float-text burn', 1);
    for (let i = 0; i < 4; i++) {
      MB.audio.sfx('boing');
      await gsap.to([L, R], { scaleY: 0.78, y: 6, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' });
      pop(V, sideOf(A, i % 2), H + 70, String(i + 1), 'float-text shield', 0.5);
    }
    pop(V, sideOf(A, 1), H + 60, "Spot me! ...I'm NOT small.", 'float-text debuff', 0.9);
    await wait(0.4);
    MB.audio.sfx('whoosh');
    const boots = [lobProp(V, sideOf(A, 0), H * 0.4, T, hT * 0.9, '🥾', 80, 0.3, 0, 360), lobProp(V, sideOf(A, 1), H * 0.4, T, hT * 1.1, '👟', 80, 0.3, 0.05, -360)];
    await Promise.all(boots.map((b) => b.done));
    duoBlow(V, t, c, impact, tv, 20);
    boots.forEach((b) => fadeOut(b.b, 0, 0.2));
    pop(V, T, hT + 150, own(a, 'finish', 'Form check: FAILED.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Mary & Chris: Mary's sacred flame, Chris' very frightened prayer. Chris lights the candles, Mary supplies the fire, the target is blessed
  S.sacredflame = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'I-I know a prayer for this...'), 'float-text shield', 1);
    gsap.to(R, { y: -10, duration: 0.2 });
    await wait(0.6);
    pop(V, sideOf(A, 0), H + 70, 'I know a FLAME for this.', 'float-text burn', 1);
    MB.audio.sfx('fire');
    const candles = [-90, 0, 90].map((dx) => propAt(V, { x: T.x + dx, y: T.y + 20 }, 20, '🕯️', 72));
    await wait(0.6);
    for (const cd of candles) { flash(V, { x: gsap.getProperty(cd, 'x'), y: gsap.getProperty(cd, 'y') }, 60, c, 120); MB.audio.sfx('sizzle'); await wait(0.2); }
    const col = pillar(V, T, c);
    gsap.fromTo(col.body, { scaleX: 0.2, scaleY: 0 }, { scaleX: 1.6, scaleY: 1.4, duration: 0.3, ease: 'power3.out' });
    MB.audio.sfx('holy');
    duoBlow(V, t, c, impact, tv, 16);
    pop(V, T, hT + 150, own(a, 'finish', 'Amen! ...Sorry! Amen!'), 'float-text shield', 1.1);
    await wait(0.6);
    candles.forEach((cd) => fadeOut(cd, 0, 0.3));
    gsap.to(col.body, { scaleX: 0, opacity: 0, duration: 0.3, onComplete: () => col.remove() });
    gsap.to(R, { y: 0, duration: 0.3 });
    resetDuo(v);
  };

  // Kayla & Chris: a hymn in a minor key. Notes rise, a bell tolls three times, and the goth's seal opens under the nun's holy light
  S.darkhymn = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'We must not... but fine.'), 'float-text shield', 1);
    pop(V, sideOf(A, 0), H + 70, '...Sing in D minor.', 'float-text debuff', 1);
    MB.audio.sfx('choir');
    for (let i = 0; i < 10; i++) {
      const n = V.billboard('petal', pickOne(['🎵', '🎶', '🕯️']), T.x + rnd(-90, 90), T.y);
      n.body.style.fontSize = rnd(30, 46) + 'px';
      gsap.set(n.body, { y: -hT * 0.5 });
      gsap.to(n.body, { y: -hT * 2 - rnd(20, 100), opacity: 0, duration: 1.2, delay: i * 0.08, onComplete: () => n.remove() });
    }
    await wait(0.8);
    const seal = runeCircle(V, T, c, { size: 280 });
    const bell = propAt(V, T, hT * 2.8, '🔔', 100);
    for (let i = 0; i < 3; i++) { MB.audio.sfx('gong'); gsap.fromTo(bell.body, { rotation: -18 }, { rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' }); await wait(0.5); }
    await gsap.to(bell.body, { y: -hT * 0.7, duration: 0.3, ease: 'power3.in' });
    duoBlow(V, t, c, impact, tv, 18);
    tint(tv, 'brightness(0.5) saturate(2)', 0.8);
    fadeOut(bell, 0.2); seal.remove();
    pop(V, T, hT + 150, own(a, 'finish', 'Amen. ...Ominous.'), 'float-text hic', 1);
    await wait(0.5);
    resetDuo(v);
  };

  // Ashton & Koko: two costumes, one stage. Koko announces the entrance and Ashton's fox clones land a "dramatic" pose on the target
  S.cosplaypair = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'Ladies and gentlemen... COSPLAY!'), 'float-text heal', 1);
    MB.audio.sfx('cheer');
    await wait(0.6);
    pop(V, sideOf(A, 0), H + 70, "U-um, I'm Hinata today...", 'float-text hic', 0.9);
    MB.audio.sfx('poof');
    puff(V, sideOf(A, 0), '#ffffff', 6, 40, 1);
    for (const e of ['🦊', '🐱', '🥷', '🎀']) {
      const p = propAt(V, { x: T.x + rnd(-110, 110), y: T.y + rnd(-20, 20) }, hT * rnd(0.5, 1.4), e, 72);
      puff(V, { x: gsap.getProperty(p, 'x'), y: gsap.getProperty(p, 'y') }, '#ffffff', 3, 30, 0.7);
      gsap.to(p, { x: T.x, y: T.y, duration: 0.3, delay: 0.5, ease: 'power3.in', onComplete: () => { hit(V, t, c, false); MB.audio.sfx('pow'); p.remove(); } });
      await wait(0.15);
    }
    await wait(0.8);
    duoBlow(V, t, c, impact, tv, 14);
    pop(V, T, hT + 150, own(a, 'finish', '10 out of 10, costume contest!'), 'float-text heal', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Melony & Koko: two attention seekers, one crowd. Koko hypes the room, Melony struts it, and the roar of the audience is the weapon
  S.roarcrowd = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'MAKE SOME NOISE!'), 'float-text heal', 1);
    gsap.to(R, { y: -14, duration: 0.2, yoyo: true, repeat: 3 });
    await wait(0.7);
    pop(V, sideOf(A, 0), H + 70, 'Everyone look at ME!', 'float-text burn', 0.9);
    gsap.to(L, { y: -16, rotation: 8, duration: 0.2, yoyo: true, repeat: 3 });
    MB.audio.sfx('cheer');
    for (let i = 0; i < 18; i++) {
      const e = V.billboard('thrown', pickOne(['👏', '📣', '🎤', '💖', '📸']), T.x + rnd(-200, 200), T.y + rnd(-40, 40));
      e.body.style.fontSize = rnd(34, 56) + 'px';
      gsap.set(e.body, { y: -hT * 2 - 260 });
      gsap.to(e.body, { y: -rnd(0, 60), duration: 0.5, delay: i * 0.04, ease: 'power2.in', onComplete: () => fadeOut(e, 0.1, 0.2) });
    }
    ring(V, T, c, 2.4, 0.9);
    await wait(0.9);
    MB.audio.sfx('applause');
    duoBlow(V, t, c, impact, tv, 20);
    pop(V, T, hT + 150, own(a, 'finish', 'ENCORE! ...Not for you.'), 'float-text burn', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // Jillian & Chris: two mother hens. Chris wraps the target in a bandage, Jillian adds a cookie and a scolding, and both fuss it into submission
  S.healinghands = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Eat something, dear. Anything.'), 'float-text heal', 1);
    await wait(0.6);
    pop(V, sideOf(A, 1), H + 70, "I-I made tea. Please sit!", 'float-text shield', 0.9);
    MB.audio.sfx('heal');
    for (let i = 0; i < 6; i++) {
      const p = lobProp(V, sideOf(A, i % 2), H * 0.7, { x: T.x + rnd(-50, 50), y: T.y + rnd(-15, 15) }, hT * rnd(0.4, 1.4), pickOne(['🩹', '🍪', '🍵', '🧣']), rnd(44, 60), 0.45, i * 0.1, rnd(180, 360));
      gsap.delayedCall(0.45 + i * 0.1, () => { hit(V, t, c, false); fadeOut(p.b, 0, 0.25); });
    }
    await wait(1.2);
    duoBlow(V, t, c, impact, tv, 12);
    scatter(V, T, hT, ['💗', '🌸', '🍪'], 8, 150);
    pop(V, T, hT + 150, own(a, 'finish', 'There. Now stay in bed!'), 'float-text heal', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // Koko & the Receptionist: the Colosseum runs on a schedule. Koko introduces the next contestant, the receptionist rings her bell and a queue of numbered tickets drops on them
  S.nextcontestant = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'AND NOW, THE NEXT CONTESTANT!'), 'float-text heal', 1);
    MB.audio.sfx('cheer');
    await wait(0.7);
    pop(V, sideOf(A, 1), H + 70, 'Please take a number.', 'float-text shield', 0.9);
    const bell = propAt(V, sideOf(A, 1), H * 0.8, '🛎️', 60);
    for (let i = 0; i < 2; i++) { MB.audio.sfx('ding'); await wait(0.3); }
    for (let i = 0; i < 14; i++) {
      const tk = V.billboard('thrown', '🎟️', T.x + rnd(-130, 130), T.y + rnd(-25, 25));
      tk.body.style.fontSize = rnd(36, 54) + 'px';
      gsap.set(tk.body, { y: -hT * 2 - 240, rotation: rnd(-60, 60) });
      gsap.to(tk.body, { y: -rnd(0, 60), duration: 0.45, delay: i * 0.04, ease: 'power2.in', onComplete: () => fadeOut(tk, 0.25, 0.25) });
    }
    await wait(0.8);
    slamStamp(V, T, hT * 1.3, 'NEXT!', c, 0.6);
    duoBlow(V, t, c, impact, tv, 14);
    fadeOut(bell, 0.2);
    pop(V, T, hT + 150, own(a, 'finish', 'Thank you for visiting!'), 'float-text heal', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Chris & Marl: the healer holds a barrier up and the gladiator hits from behind it. Marl is hurt first, Chris shrieks and patches her up, then she punches through the barrier
  S.patchup = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', "Y-you're bleeding on the floor!"), 'float-text shield', 1);
    gsap.fromTo(R, { rotation: 0 }, { rotation: -5, duration: 0.1, yoyo: true, repeat: 5 });
    await wait(0.6);
    MB.audio.sfx('heal');
    for (let i = 0; i < 4; i++) { const b = propAt(V, { x: sideOf(A, 1).x + rnd(-40, 40), y: A.y }, H * 0.5 + i * 22, '🩹', 54); fadeOut(b, 0.5, 0.3); await wait(0.1); }
    pop(V, sideOf(A, 1), H + 70, "It's fine. Just fix it. Quickly.", 'float-text burn', 0.9);
    await wait(0.6);
    const wall = propAt(V, { x: sideOf(A, 0).x + (T.x >= A.x ? 110 : -110), y: A.y }, H * 0.5, '🛡️', 120);
    MB.audio.sfx('holy');
    await wait(0.5);
    MB.audio.sfx('whoosh');
    const fist = lobProp(V, sideOf(A, 1), H * 0.7, T, hT, '👊', 100, 0.3);
    await fist.done;
    duoBlow(V, t, c, impact, tv, 22);
    fadeOut(fist.b, 0, 0.2); fadeOut(wall, 0.1);
    pop(V, T, hT + 150, own(a, 'finish', 'Heal me again. I am not done.'), 'float-text burn', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Jillian & Kayla: a mother knocks, a daughter does not open. The door appears, gets knocked on three times, and opens on the target
  S.knockknock = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Kayla, dear, dinner!'), 'float-text heal', 1);
    const door = propAt(V, T, hT * 0.6, '🚪', 160);
    for (let i = 0; i < 3; i++) { MB.audio.sfx('tick'); pop(V, T, hT * 2 + 40, 'knock', 'float-text shield', 0.5); gsap.fromTo(door.body, { x: -4 }, { x: 4, duration: 0.06, yoyo: true, repeat: 3, clearProps: 'x' }); await wait(0.45); }
    pop(V, sideOf(A, 1), H + 70, 'Mom. I am in the middle of a boss.', 'float-text debuff', 1);
    await wait(0.8);
    MB.audio.sfx('slam');
    gsap.to(door.body, { scaleX: 0.15, duration: 0.2, ease: 'power3.in' });
    const tray = lobProp(V, sideOf(A, 0), H * 0.7, T, hT, '🍪', 90, 0.4, 0, 540);
    await tray.done;
    duoBlow(V, t, c, impact, tv, 14);
    scatter(V, T, hT, ['🍪', '🥛', '🎮'], 8, 150);
    fadeOut(tray.b, 0, 0.2); fadeOut(door, 0.2);
    pop(V, T, hT + 150, own(a, 'finish', '...Fine. Five more minutes.'), 'float-text hic', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Ashton & Kayla: a co-op raid. Kayla pulls aggro with a hex, Ashton's fox ninja flanks from the shadows, and the loot drops
  S.coopraid = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 1), H + 40, own(a, 'cry', 'K-Kayla, want to raid together?'), 'float-text shield', 1);
    await wait(0.6);
    pop(V, sideOf(A, 0), H + 70, '...Fine. Do not die, Ash.', 'float-text debuff', 0.9);
    await wait(0.4);
    const mark = propAt(V, T, hT * 2.4, '🎯', 80);
    MB.audio.sfx('dark');
    pop(V, T, hT * 2.4 + 60, 'AGGRO!', 'float-text burn', 0.7);
    for (let i = 0; i < 3; i++) { const h = lobProp(V, sideOf(A, 0), H * 0.7, T, hT, '🔮', 54, 0.35, i * 0.12); gsap.delayedCall(0.35 + i * 0.12, () => { hit(V, t, c, false); fadeOut(h.b, 0, 0.15); }); }
    await wait(0.7);
    puff(V, sideOf(A, 1), '#ffffff', 5, 40, 1);
    const fox = lobProp(V, sideOf(A, 1), H * 0.3, T, hT, '🦊', 100, 0.3);
    await fox.done;
    duoBlow(V, t, c, impact, tv, 18);
    fadeOut(fox.b, 0, 0.2); fadeOut(mark, 0.2);
    scatter(V, T, hT, ['💎', '⭐', '🎁'], 8, 150);
    pop(V, T, hT + 150, own(a, 'finish', 'Loot drop! Epic!'), 'float-text buff', 1.1);
    await wait(0.5);
    resetDuo(v);
  };

  // Jillian & Samantha: Sunday dinner with the niece home from the army. A roast comes out of the oven, Samantha carves it with a wrench and Aunt Jil serves
  S.sundayroast = async (V, a, t, impact) => {
    const { v, A, T, hT, c } = ctx(V, a, t), [L, R] = duo(v), H = V.heightOf(a), tv = victim(V, t);
    pop(V, sideOf(A, 0), H + 40, own(a, 'cry', 'Sam, sweetheart, more gravy?'), 'float-text heal', 1);
    await wait(0.6);
    pop(V, sideOf(A, 1), H + 70, 'Aunt Jil, you are the best.', 'float-text burn', 0.9);
    MB.audio.sfx('sizzle');
    const roast = propAt(V, sideOf(A, 0), H * 0.9, '🍗', 96);
    await wait(0.6);
    pop(V, sideOf(A, 1), H + 100, 'I will carve.', 'float-text burn', 0.7);
    const wrench = lobProp(V, sideOf(A, 1), H * 0.7, sideOf(A, 0), H * 0.9, '🔧', 60, 0.3, 0, 360);
    await wrench.done;
    MB.audio.sfx('clang');
    fadeOut(wrench.b, 0, 0.1); fadeOut(roast, 0, 0.1);
    for (let i = 0; i < 6; i++) {
      const f = lobProp(V, sideOf(A, i % 2), H * 0.8, { x: T.x + rnd(-60, 60), y: T.y + rnd(-15, 15) }, hT * rnd(0.4, 1.4), pickOne(['🍗', '🥔', '🥕', '🥧']), rnd(46, 64), 0.5, i * 0.08, rnd(180, 540));
      gsap.delayedCall(0.5 + i * 0.08, () => { hit(V, t, c, false); fadeOut(f.b, 0, 0.25); });
    }
    await wait(1.1);
    duoBlow(V, t, c, impact, tv, 14);
    pop(V, T, hT + 150, own(a, 'finish', 'Seconds? Of course!'), 'float-text heal', 1.1);
    await wait(0.6);
    resetDuo(v);
  };

  // ---------------------------------------------------------------- shared helpers
  // styles that bring their own sky (attack.sky overrides it; sky: 'none' turns it off)
  const STYLE_SKY = { meteor: 'night', blackhole: 'void', hack: 'matrix', volcano: 'inferno', tornado: 'storm', runes: 'night', gravity: 'void',
    hora: 'void', riff: 'storm', lightriff: 'holy', metalmass: 'holy', yandere: 'blood', piano: 'night', siren: 'ocean', mercy: 'dream', rainbow: 'sunny', stainedglass: 'holy',
    tear: 'void', multiverse: 'space', justmonika: 'space', inkbound: 'void', pentagram: 'inferno', queenshadow: 'void', ghoststory: 'night',
    poemduet: 'sakura', ritualfire: 'blood', saintsinner: 'dream', homestead: 'sunset', spookpunch: 'night',
    chillchapter: 'night', masterplan: 'void', churchbell: 'holy', penance: 'holy', reenact: 'sunset', hologram: 'night',
    manaseal: 'holy', lastcall: 'void', divinemark: 'holy', splice: 'matrix', glitchblade: 'night', mothdust: 'dream', bloodwind: 'blood', metamorph: 'night', fourthwall: 'matrix',
    starcrossed: 'night', seasong: 'ocean', whodunit: 'night', fireflower: 'inferno', stormsong: 'ocean', daydream: 'night', moonfall: 'night', fullmoon: 'night', sorrowshot: 'night', extra: 'night', skilift: 'night', fireworks: 'night', kamaitachi: 'storm', candelabra: 'night', objection: 'night', redstring: 'dream', oninight: 'night', comet: 'night', laserweb: 'space',
    heartguard: 'dream', onestar: 'night', knightmove: 'night', override: 'matrix', rebuff: 'sunny', lotuspalm: 'holy', vineward: 'sunny', fieldnotes: 'space',
    harebluff: 'blood', batcommand: 'blood', maidprank: 'sunset', teachess: 'sunset', fieldbluff: 'space', maidshift: 'dream', nightmass: 'blood',
    proclaim: 'holy', umbral: 'void', homesafe: 'night', abduct: 'space', bossreport: 'holy', truckkun: 'sunset', chuuni: 'night',
    toothpaste: 'sunny', gopnik: 'sunset', commentary: 'holy', numberup: 'dream', tarot: 'night', selfie: 'dream', chopper: 'sunset', shadowclones: 'night', gardenparty: 'sunny',
    firefists: 'inferno', siblingfeud: 'night',
    dormfight: 'sunny', riggeddeck: 'night', armwrestle: 'sunset', legday: 'sunny', sacredflame: 'holy', darkhymn: 'night', cosplaypair: 'dream', roarcrowd: 'dream', healinghands: 'sunny', nextcontestant: 'holy', patchup: 'holy', knockknock: 'night', coopraid: 'night', sundayroast: 'sunset' };
  // the other duo styles; any single style works for a duo too
  const DUO_STYLES = ['combo', 'bookstairs', 'dolphinduet', 'metalmass', 'dojo', 'waltz', 'jackpot', 'miracle', 'harmony', 'gothic', 'sleepover', 'party', 'lesson', 'cheerchain', 'howl', 'twinstar',
    'breakfast', 'riptide', 'restock', 'flashbang', 'feeding', 'tidal', 'workshop', 'yuri', 'alleyoop', 'crossfire', 'launch', 'sync',
    'poemduet', 'latebell', 'ritualfire', 'saintsinner', 'homestead', 'hailmary', 'redstreak', 'spookpunch',
    'doubleshift', 'irishcoffee', 'penance', 'musclemath', 'ovenmitt', 'lifebuoy', 'snooze', 'allin', 'biddingwar', 'chillchapter', 'masterplan', 'defib', 'churchbell', 'reenact', 'viral', 'bakaslap', 'pricewar', 'airheads', 'spotme',
    'spotless', 'hologram', 'keynote', 'makeover', 'busking',
    'shieldvault', 'bloodwind', 'runaway', 'metamorph', 'enforcers', 'stickerbomb', 'bikergang', 'fourthwall',
    'oninight', 'pursuit', 'croquembouche', 'starcrossed', 'seasong', 'whodunit', 'fireflower',
    'teachess', 'fieldbluff', 'maidshift', 'nightmass',
    'bossreport', 'truckkun', 'chuuni', 'firefists', 'siblingfeud',
    'dormfight', 'riggeddeck', 'armwrestle', 'legday', 'sacredflame', 'darkhymn', 'cosplaypair', 'roarcrowd', 'healinghands', 'nextcontestant', 'patchup', 'knockknock', 'coopraid', 'sundayroast'];

  async function attack(V, a, t, impact) {
    const at = a.card.attack, style = S[at.style] || (at.move || at.fx ? recipe : S.dash);
    const emotionCalls = (at.emotions || []).filter((cue) => cue.at > 0).map((cue) => gsap.delayedCall(cue.at, () => V.emote(a, cue.emotion, 0)));
    // options that work with every style: sky, aura, shake, slowmo, floor, scatter (+ cry, finish, sfx below)
    const unsky = sky(at.sky === undefined ? STYLE_SKY[at.style] : at.sky);
    const unaura = at.aura ? aura(V, a, at.aura === true ? at.color : at.aura) : null;
    // attack name callout
    const p = V.pos(a);
    if (at.name) {
      const tag = V.billboard('attack-name', at.name, p.x, p.y);
      tag.body.style.setProperty('--c', at.color);
      gsap.set(tag.body, { y: -V.heightOf(a) - 30 });
      gsap.timeline({ onComplete: () => tag.remove() }).from(tag.body, { scale: 0.3, opacity: 0, duration: 0.2, ease: 'back.out(2)' }).to(tag.body, { opacity: 0, y: '-=30', duration: 0.3, delay: 0.6 });
    }
    if (at.cry) gsap.delayedCall(0.35, () => { pop(V, p, V.heightOf(a) + 95, at.cry, 'float-text ability', 1.1); if (/^ohoho/i.test(at.cry)) MB.audio.sfx('ohoho'); });
    let hitDone = false;
    const onHit = () => {
      if (hitDone) return;
      hitDone = true; impact();
      const T = V.pos(t), hT = V.heightOf(t) * 0.5;
      if (at.sfx) MB.audio.sfx(at.sfx);
      if (at.shake) V.shake(at.shake);
      if (at.slowmo) slowmo(at.slowmo);
      if (at.floor) decal(V, T, at.floor, at.color);
      if (at.scatter) scatter(V, T, hT, [].concat(at.scatter), 10, 140);
      if (at.finish) gsap.delayedCall(0.3, () => { const b = pop(V, T, hT + 120, at.finish, 'float-text buff', 1.2); if (b) b.body.style.color = at.color; });
    };
    try {
      await style(V, a, t, onHit);
      onHit();
    } finally {
      emotionCalls.forEach((call) => { if (call && call.kill) call.kill(); });
      unsky();
      if (unaura) unaura();
    }
  }

  // generic projectile used by abilities and leader powers: a glowing orb, or `emoji` spinning over (spec.emoji)
  async function orbTo(V, from, to, color, hTo, delay = 0, hFrom = MB.LAYOUT.UNIT_H * 0.6, emoji) {
    if (delay) await wait(delay);
    const o = emoji ? V.billboard('thrown', emoji, from.x, from.y) : dot(V, from, hFrom, color, 34, 'charge');
    if (emoji) o.body.style.fontSize = '46px';
    await path(o, (k) => ({ ...arc(from, to, hFrom, hTo * 0.5, 140)(k), s: 1, r: emoji ? k * 540 : 0 }), 0.5, 'power1.inOut', (p) => {
      if (Math.random() < 0.6) { const tr = dot(V, p, p.h, color, 10); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => tr.remove() }); }
    });
    o.remove();
    flash(V, to, hTo * 0.5, color, 120);
    burst(V, to, color, 10, { h: hTo * 0.5, spread: 80 });
  }

  // how an untargeted item card plays out: card.cast, or what the old named effects used
  const CAST = { mansion: 'nuke', callFriend: 'call', allowance: 'coins' };
  async function spell(V, side, card, from, target, icon, fn) {
    const hFrom = MB.LAYOUT.LEADER_H * 0.7, cast = card.cast || CAST[card.effect] || 'lob';
    const ic = V.billboard('item-icon', `<img src="${icon}">`, from.x, from.y);
    ic.body.style.setProperty('--c', card.color);
    gsap.set(ic.body, { y: -hFrom });
    await gsap.fromTo(ic.body, { scale: 0, rotation: -90 }, { scale: 1.2, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
    MB.audio.sfx('whoosh');
    if (target) {
      const T = V.pos(target), hT = V.heightOf(target) * 0.5;
      await path(ic, (k) => ({ ...arc(from, T, hFrom, hT, 200)(k), r: k * 720, s: 1.2 - k * 0.4 }), 0.7, 'power1.in');
      fn();
      flash(V, T, hT, card.color, 200); burst(V, T, card.color, 18, { h: hT }); ring(V, T, card.color, 1.8);
      await gsap.to(ic.body, { scale: 1.8, opacity: 0, duration: 0.3 });
    } else if (cast === 'nuke') {
      const mid = { x: 590, y: MB.LAYOUT.ROW_Y[1 - side] };
      await path(ic, (k) => ({ ...arc(from, mid, hFrom, 320, 100)(k), r: k * 360, s: 1.2 + k }), 0.8, 'power2.inOut');
      await gsap.to(ic.body, { rotation: '+=90', duration: 0.3, ease: 'back.out(3)' });
      MB.audio.sfx('slam'); V.shake(20);
      ring(V, mid, card.color, 5, 0.9); flash(V, mid, 320, card.color, 500);
      fn();
      MB.LAYOUT.SLOT_X.forEach((x) => { burst(V, { x, y: mid.y }, card.color, 10, { h: 100 }); debris(V, { x, y: mid.y }, card.color, 4, { spread: 120 }); });
      cracks(V, mid, '#2b1d12', { n: 12, len: 300, w: 8, glow: card.color, hold: 1.2 });
      await gsap.to(ic.body, { opacity: 0, scale: 3, duration: 0.4 });
    } else {
      await gsap.to(ic.body, { y: -hFrom - 90, rotation: cast === 'call' ? 0 : 360, duration: 0.5 });
      if (cast === 'call') { MB.audio.sfx('zap'); await gsap.to(ic.body, { rotation: 12, duration: 0.05, yoyo: true, repeat: 9 }); }
      if (cast === 'coins') for (let i = 0; i < 3; i++) { MB.audio.sfx('coin'); burst(V, from, card.color, 8, { h: hFrom + 90, spread: 80 }); await wait(0.12); }
      fn();
      await gsap.to(ic.body, { opacity: 0, scale: 0.3, duration: 0.3 });
    }
    ic.remove();
  }

  // Undertale-style dusting: sprite wipes away top-down, shedding particles
  function dust(V, v, p) {
    const H = parseFloat(v.stand.style.height) || MB.LAYOUT.UNIT_H;
    gsap.set(v.img, { clipPath: 'inset(0% 0% 0% 0%)' });
    const tl = gsap.timeline({ onComplete: () => v.el.remove() });
    tl.to(v.img, { filter: 'grayscale(1) brightness(1.7)', duration: 0.25 })
      .to(v.plate, { opacity: 0, duration: 0.3 }, 0)
      .to(v.el.querySelector('.unit-shadow'), { opacity: 0, duration: 1.2 }, 0)
      .to(v.img, {
        clipPath: 'inset(100% 0% 0% 0%)', duration: 1.1, ease: 'power1.in',
        onUpdate() {
          const k = this.progress(), h = H * (1 - k);
          for (let i = 0; i < 2; i++) {
            const d = dot(V, { x: p.x + rnd(-55, 55), y: p.y }, h, '#e8e0f0', rnd(4, 9), 'dust');
            gsap.to(d, { x: `+=${rnd(-40, 70)}`, duration: 1.2 });
            gsap.to(d.body, { y: `-=${rnd(40, 140)}`, opacity: 0, duration: rnd(0.8, 1.4), ease: 'power1.out', onComplete: () => d.remove() });
          }
        },
      });
    return tl;
  }

  MB.FX = { attack, orbTo, spell, dust, burst, rise, ring, flash, flameBurst, fusion, combo, outfitChange, debris, puff, cracks, toss, sky, spiralSvg, eases: EASE, styles: S, duoStyles: DUO_STYLES,
    skies: Object.keys(SKIES), recipe: { moves: RMOVE, fx: RFX, floors: FLOORS }, casts: ['lob', 'nuke', 'call', 'coins'] };
})();
