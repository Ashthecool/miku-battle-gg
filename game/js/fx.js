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
    V.emote(a, 'taunt', 0);
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
    V.emote(a, 'taunt', 0);
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
    h.body.textContent = '💔';
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
    hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(22);
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
    V.emote(a, 'taunt', 0);
    const slot = V.billboard('slot-machine', '<i>💰</i><i>💎</i><i>🍒</i>', T.x, T.y);
    gsap.set(slot.body, { y: -hT - 190 });
    await gsap.fromTo(slot.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(R, { rotationY: 1080, duration: 1.1, ease: 'power1.inOut' }); // skate spin while the reels roll
    const reels = [...slot.body.children], icons = ['💰', '💎', '🍒', '🔔', '⭐', '7️⃣'];
    const roll = setInterval(() => reels.forEach((r) => { if (!r.dataset.stop) r.textContent = MB.pick(icons); }), 60);
    for (let i = 0; i < 3; i++) {
      await wait(0.3);
      reels[i].dataset.stop = 1; reels[i].textContent = '7️⃣';
      gsap.fromTo(reels[i], { scale: 1.6 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
      MB.audio.sfx('coin');
    }
    clearInterval(roll);
    gsap.set(R, { rotationY: 0 });
    pop(V, T, hT + 280, 'JACKPOT!', 'float-text buff', 1.2);
    MB.audio.sfx('sparkle');
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
        if (first) { first = false; impact(); hit(V, t, c); } else { burst(V, TT, '#ffffff', 4, { h: hT, spread: 40 }); if (i % 2) MB.audio.sfx('click'); }
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
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12);
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

  // Yumi: daydreams up a sea of stars, and dolphins leap out of the board and splash down on the target
  S.dolphin = async (V, a, t, impact) => {
    const { v, A, T, d, perp, hA, hT, c } = ctx(V, a, t);
    pop(V, A, V.heightOf(a) + 95, own(a, 'cry', '♪~'), 'float-text hic', 1);
    await gsap.to(v.figure, { y: -20, rotation: -5, duration: 0.3, ease: 'sine.inOut' });
    const face = d.x > 0 ? 'scaleX(-1)' : 'none'; // the emoji swims left
    let first = true;
    await Promise.all([0, 1, 2].map((i) => wait(i * 0.18).then(() => {
      const dol = V.billboard('thrown', `<span style="display:inline-block;transform:${face}">🐬</span>`, A.x, A.y);
      const F = { x: A.x + perp.x * (i - 1) * 60, y: A.y + perp.y * (i - 1) * 60 }, TT = { x: T.x + rnd(-25, 25), y: T.y + rnd(-10, 10) };
      MB.audio.sfx('splash');
      return path(dol, (k) => ({ ...arc(F, TT, 0, hT, 260 + i * 30)(k), r: (d.x > 0 ? 1 : -1) * lerp(-35, 55, k) }), 0.7, 'sine.in', (p) => {
        if (Math.random() < 0.4) { const s = dot(V, p, p.h, MB.pick([c, '#ffffff', '#ffe066']), rnd(6, 11)); gsap.to(s.body, { opacity: 0, scale: 0.1, duration: 0.5, onComplete: () => s.remove() }); }
      }).then(() => {
        dol.remove();
        if (first) { first = false; impact(); hit(V, t, c); } else burst(V, TT, c, 6, { h: hT, spread: 60 });
        droplets(V, TT, 6, 100);
      });
    })));
    ring(V, T, c, 2);
    droplets(V, T, 14);
    pop(V, T, hT + 110, own(a, 'finish', 'Iruka-san~ ♪'), 'float-text shield', 1);
    await gsap.to(v.figure, { y: 0, rotation: 0, duration: 0.3 });
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
    impact(); hit(V, t, '#e8283c', true); MB.audio.sfx('slam'); V.shake(14); V.hitStop();
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

  // ---------------------------------------------------------------- shared helpers
  // styles that bring their own sky (attack.sky overrides it; sky: 'none' turns it off)
  const STYLE_SKY = { meteor: 'night', blackhole: 'void', hack: 'matrix', volcano: 'inferno', tornado: 'storm', runes: 'night', gravity: 'void' };
  // the other duo styles; any single style works for a duo too
  const DUO_STYLES = ['combo', 'dojo', 'waltz', 'jackpot', 'miracle', 'harmony', 'gothic', 'sleepover', 'party', 'lesson', 'cheerchain', 'howl', 'twinstar',
    'breakfast', 'riptide', 'restock', 'flashbang', 'feeding', 'tidal', 'workshop', 'yuri', 'alleyoop', 'crossfire', 'launch', 'sync'];

  async function attack(V, a, t, impact) {
    const at = a.card.attack, style = S[at.style] || (at.move || at.fx ? recipe : S.dash);
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
    if (at.cry) gsap.delayedCall(0.35, () => pop(V, p, V.heightOf(a) + 95, at.cry, 'float-text ability', 1.1));
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

  // styles and recipe fx reworked with the GSAP plugins (the attack gallery tags them)
  const UPGRADED = { styles: ['dash', 'slam', 'confetti', 'orb', 'bolt', 'coins', 'frost', 'wave', 'slash', 'shower', 'hellfire', 'halo', 'uppercut',
    'heartbreak', 'pages', 'dojo', 'jackpot', 'gothic', 'scar', 'scythe', 'workshop', 'ninja', 'crossfire'], fx: ['slashes', 'bolt', 'clones'] };
  const upgraded = (at) => !!at && (S[at.style] ? UPGRADED.styles.includes(at.style) : at.move || at.fx ? UPGRADED.fx.includes(at.fx) : true); // no style = dash

  MB.FX = { attack, orbTo, spell, dust, burst, rise, ring, flash, flameBurst, fusion, debris, puff, cracks, toss, sky, eases: EASE, styles: S, duoStyles: DUO_STYLES, upgraded,
    skies: Object.keys(SKIES), recipe: { moves: RMOVE, fx: RFX, floors: FLOORS }, casts: ['lob', 'nuke', 'call', 'coins'] };
})();
