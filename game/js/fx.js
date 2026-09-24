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
      const a = rnd(0, Math.PI * 2), r = rnd(spread * 0.3, spread);
      gsap.to(b, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, duration: rnd(0.4, 0.8), ease: 'power2.out' });
      gsap.to(b.body, { y: -h - rnd(-40, 140), rotation: rnd(-360, 360), duration: rnd(0.4, 0.8), ease: 'power2.out' });
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

  // ---------------------------------------------------------------- attack styles
  const S = {};

  S.dash = async (V, a, t, impact) => {
    const { v, A, d, C, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.el, { x: A.x - d.x * 45, y: A.y - d.y * 45, duration: 0.25, ease: 'power2.out' })
      .to(v.img, { scaleY: 0.86, scaleX: 1.12, duration: 0.25 }, 0)
      .to(v.el, { x: C.x, y: C.y, duration: 0.18, ease: 'power3.in', onUpdate: () => ghost(V, v, c) })
      .to(v.img, { scaleY: 1.06, scaleX: 0.94, duration: 0.18 }, '<');
    impact(); hit(V, t, c, a.atk >= 5);
    // follow-up jabs
    const tl = gsap.timeline();
    for (let i = 0; i < 3; i++) tl.to(v.figure, { x: d.x * 22, duration: 0.05 }).to(v.figure, { x: 0, duration: 0.05 }).call(() => burst(V, V.pos(t), c, 4, { h: V.heightOf(t) * 0.5, spread: 60 }));
    await tl;
    await goHome(v, A);
  };

  S.slam = async (V, a, t, impact) => {
    const { v, A, T, d, C, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
    await gsap.timeline()
      .to(v.img, { scaleY: 0.78, scaleX: 1.18, duration: 0.22, ease: 'power2.out' })
      .add('jump')
      .to(v.el, { x: C.x + d.x * 40, y: C.y + d.y * 40, duration: 0.62, ease: 'power1.inOut' }, 'jump')
      .to(v.figure, { y: -380, duration: 0.36, ease: 'power2.out' }, 'jump')
      .to(v.figure, { rotation: d.x * 14, duration: 0.36 }, 'jump')
      .to(v.img, { scaleY: 1.1, scaleX: 0.92, duration: 0.2 }, 'jump')
      .to(v.figure, { y: 0, duration: 0.26, ease: 'power4.in' }, 'jump+=0.36');
    impact(); MB.audio.sfx('slam'); V.shake(26);
    hit(V, t, c, true);
    ring(V, T, '#ffffff', 3, 0.8);
    burst(V, T, '#c9b79c', 22, { h: 10, spread: 200 });
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
        s.remove();
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
      gsap.to(pe, { x: T.x + rnd(-120, 120), y: T.y + rnd(-60, 60), duration: 0.9 });
      gsap.to(pe.body, { y: -hT - rnd(-40, 120), rotation: rnd(-300, 300), opacity: 0, duration: 0.9, onComplete: () => pe.remove() });
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
        .call(() => { MB.audio.sfx('click'); burst(V, P, c, 4, { h: 5, spread: 50 }); });
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
      MB.audio.sfx('zap');
      if (i === 0) { impact(); hit(V, t, c, true); } else { flash(V, T, hT, c); burst(V, T, c, 8, { h: hT }); }
      V.shake(12);
      gsap.to(bolt.body, { opacity: 0, duration: 0.18, delay: 0.08, onComplete: () => bolt.remove() });
      await wait(0.16);
    }
    gsap.to(cloud.body, { opacity: 0, scale: 1.5, duration: 0.4, onComplete: () => cloud.remove() });
    await gsap.timeline().to(v.figure, { y: 0, duration: 0.3 }).to(v.img, { filter: 'drop-shadow(0 0 0px #000) brightness(1)', duration: 0.3, clearProps: 'filter' }, 0);
  };

  function lightningSvg(h, c) {
    let x = 30, pts = `${x},0`;
    for (let y = 0; y < h; y += rnd(18, 40)) { x = 30 + rnd(-24, 24); pts += ` ${x},${y}`; }
    pts += ` 30,${h}`;
    return `<svg width="60" height="${h}" viewBox="0 0 60 ${h}"><polyline points="${pts}" stroke="${c}" stroke-width="9" fill="none" stroke-linejoin="round" opacity=".7"/><polyline points="${pts}" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/></svg>`;
  }

  S.spin = async (V, a, t, impact) => {
    const { v, A, C, perp, c } = ctx(V, a, t);
    MB.audio.sfx('whoosh');
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
    MB.audio.sfx('whoosh');
    gsap.to(v.figure, { rotation: 6, duration: 0.15 });
    await path(pan, (k) => ({ ...arc(A, T, hA, hT, 90, 220, perp)(k), r: k * 900 }), 0.6, 'sine.in');
    impact(); hit(V, t, c); MB.audio.sfx('slam');
    MB.audio.sfx('whoosh');
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
        gsap.to(coin.body, { opacity: 0, y: '+=40', duration: 0.3, onComplete: () => coin.remove() });
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
    MB.audio.sfx('whoosh');
    await path(cone, (k) => ({ ...arc(A, T, hA, hT, 230)(k), r: k * 540 }), 0.65, 'power1.in', (p) => {
      if (Math.random() < 0.5) { const s = dot(V, p, p.h, '#dff9ff', 8, 'spark shard'); gsap.to(s.body, { y: -p.h + 40, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
    });
    cone.remove();
    impact(); hit(V, t, c, true);
    burst(V, T, '#ffffff', 16, { h: hT, spread: 130, shape: 'shard' });
    const fr = V.flat('frost-floor', '', T.x, T.y);
    gsap.fromTo(fr, { scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => fr.remove() });
    for (let i = 0; i < 6; i++) {
      const f = V.billboard('petal', '❄', T.x + rnd(-60, 60), T.y);
      gsap.set(f.body, { y: -rnd(20, hT * 1.6) });
      gsap.to(f.body, { y: '-=80', rotation: 180, opacity: 0, duration: 1.1, delay: i * 0.05, onComplete: () => f.remove() });
    }
    await wait(0.3);
  };

  S.wave = async (V, a, t, impact) => {
    const { v, A, T, d, c } = ctx(V, a, t);
    await gsap.to(v.figure, { y: -20, duration: 0.2 });
    const w = V.billboard('wave', '<div class="foam"></div>', A.x + d.x * 40, A.y + d.y * 40);
    gsap.set(w.body, { yPercent: -100, y: 10 });
    MB.audio.sfx('splash');
    const from = { x: A.x + d.x * 40, y: A.y + d.y * 40 };
    await path(w, (k) => ({ x: lerp(from.x, T.x, k), y: lerp(from.y, T.y, k), h: -10, s: 0.5 + k * 0.9 }), 0.8, 'power1.in', (p) => {
      if (Math.random() < 0.6) { const dr = dot(V, p, rnd(20, 90), '#bfe9ff', rnd(5, 10)); gsap.to(dr.body, { y: `+=${rnd(-80, 10)}`, opacity: 0, duration: 0.6, onComplete: () => dr.remove() }); }
    });
    impact(); hit(V, t, c, true); MB.audio.sfx('splash');
    gsap.to(w.body, { scaleY: 1.8, opacity: 0, duration: 0.4, onComplete: () => w.remove() });
    for (let i = 0; i < 18; i++) {
      const dr = dot(V, T, 20, '#bfe9ff', rnd(6, 12));
      gsap.to(dr, { x: T.x + rnd(-110, 110), y: T.y + rnd(-50, 50), duration: 0.8 });
      gsap.to(dr.body, { keyframes: [{ y: -rnd(120, 260), duration: 0.4, ease: 'power2.out' }, { y: 0, opacity: 0, duration: 0.4, ease: 'power2.in' }], onComplete: () => dr.remove() });
    }
    await gsap.to(v.figure, { y: 0, duration: 0.3 });
  };

  S.slash = async (V, a, t, impact) => {
    const { v, A, T, perp, hT, c } = ctx(V, a, t);
    const side = { x: T.x + perp.x * 120, y: T.y + perp.y * 120 };
    MB.audio.sfx('whoosh');
    await gsap.to(v.figure, { scaleX: 0.05, opacity: 0, duration: 0.12 });
    gsap.set(v.el, side);
    await gsap.to(v.figure, { scaleX: 1, opacity: 1, duration: 0.1 });
    for (let i = 0; i < 3; i++) {
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT, rotation: -40 + i * 50 + rnd(-10, 10) });
      MB.audio.sfx('whoosh');
      if (i === 0) { impact(); hit(V, t, c); } else burst(V, T, c, 6, { h: hT, spread: 70 });
      gsap.fromTo(s.body, { scale: 0.3, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: () => s.remove() });
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
        gsap.to(d.body, { opacity: 0, scale: 1.6, duration: 0.25, onComplete: () => d.remove() });
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
    const sig = V.flat('sigil', '', T.x, T.y);
    sig.style.setProperty('--c', c);
    MB.audio.sfx('beam');
    await gsap.fromTo(sig, { scale: 0, rotation: 0, opacity: 0 }, { scale: 1, rotation: 180, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
    gsap.to(sig, { rotation: '+=360', duration: 2, ease: 'none' });
    for (let i = 0; i < 5; i++) {
      const P = i === 0 ? T : { x: T.x + rnd(-75, 75), y: T.y + rnd(-30, 30) };
      const f = pillar(V, P, c);
      gsap.fromTo(f.body, { scaleY: 0, scaleX: 0.6 }, { scaleY: rnd(0.8, 1.2), scaleX: 1, duration: 0.18, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => f.remove() });
      if (i === 0) { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); } else { burst(V, P, '#ffb347', 6, { h: hT, spread: 60 }); MB.audio.sfx('zap'); }
      V.shake(8);
      await wait(0.1);
    }
    rise(V, T, '#ffb347', 14, hT * 1.5);
    gsap.to(sig, { opacity: 0, scale: 1.4, duration: 0.5, onComplete: () => sig.remove() });
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
    MB.audio.sfx('beam');
    gsap.to(halo.body, { y: -H * 0.2, scale: 1.8, opacity: 0, duration: 0.25, ease: 'power3.in' });
    await gsap.fromTo(beam.body, { scaleX: 0 }, { scaleX: 1, duration: 0.15, ease: 'power2.out' });
    impact(); hit(V, t, c, true); ring(V, T, '#ffffff', 2.4, 0.7); V.shake(12);
    for (let i = 0; i < 10; i++) {
      const f = V.billboard('petal', '🪶', T.x + rnd(-80, 80), T.y + rnd(-20, 20));
      gsap.set(f.body, { y: -rnd(H * 0.6, H * 1.5), rotation: rnd(-60, 60) });
      gsap.to(f.body, { y: `+=${rnd(80, 160)}`, rotation: `+=${rnd(-120, 120)}`, opacity: 0, duration: rnd(1, 1.6), ease: 'sine.inOut', onComplete: () => f.remove() });
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
    MB.audio.sfx('whoosh');
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
    burst(V, T, '#c9b79c', 14, { h: 10, spread: 150 });
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
    for (let i = 0; i < 8; i++) {
      const s = dot(V, T, hT + 60, c, rnd(8, 14), 'spark shard');
      gsap.to(s, { x: T.x + rnd(-90, 90), duration: 0.8 });
      gsap.to(s.body, { y: -rnd(0, 20), rotation: rnd(-360, 360), opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: () => s.remove() });
    }
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
        pg.remove();
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
      MB.audio.sfx('splash');
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
      MB.audio.sfx('click');
    };
    hic(A.x, A.y);
    const at = (k) => { const w = Math.sin(k * Math.PI * 3) * 45; return { x: lerp(A.x, C.x, k) + perp.x * w, y: lerp(A.y, C.y, k) + perp.y * w }; };
    const o = { k: 0 };
    const sway = gsap.fromTo(v.figure, { rotation: -10 }, { rotation: 10, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await gsap.to(o, { k: 1, duration: 0.9, ease: 'power1.in', onUpdate: () => gsap.set(v.el, at(o.k)) });
    sway.kill();
    await gsap.to(v.figure, { rotation: d.x >= 0 ? 24 : -24, duration: 0.12, ease: 'power2.in' });
    impact(); hit(V, t, c); MB.audio.sfx('slam'); V.shake(10);
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
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT, rotation: rnd(-80, 80) });
      gsap.fromTo(s.body, { scale: 0.3, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.25, onComplete: () => s.remove() });
      if (i === 0) { impact(); hit(V, t, c); } else { burst(V, T, c, 5, { h: hT, spread: 60 }); MB.audio.sfx('hit'); }
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
        gsap.to(coin.body, { opacity: 0, y: '+=40', duration: 0.3, onComplete: () => coin.remove() });
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
    for (let i = 0; i < 3; i++) { MB.audio.sfx('click'); await gsap.fromTo(gift.body, { rotation: -10 }, { rotation: 10, duration: 0.07, yoyo: true, repeat: 1 }); }
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
    MB.audio.sfx('beam');
    await gsap.fromTo(sig, { scale: 0, opacity: 0 }, { scale: 1.3, rotation: 180, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
    gsap.to(sig, { rotation: '+=540', duration: 3, ease: 'none' });
    for (let i = 0; i < 8; i++) {
      const ang = i * 1.3, rr = 150 - i * 16, P = { x: T.x + Math.cos(ang) * rr, y: T.y + Math.sin(ang) * rr * 0.6 };
      const hell = i % 2 === 0;
      const f = pillar(V, P, hell ? RED : GOLD, hell ? 'pillar' : 'sky-beam slim');
      gsap.fromTo(f.body, { scaleY: 0, scaleX: 0.5 }, { scaleY: hell ? rnd(0.7, 1) : 0.5, scaleX: 1, duration: 0.15, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.35, delay: 0.25, onComplete: () => f.remove() });
      burst(V, P, hell ? '#ffb347' : '#ffffff', 5, { h: 60, spread: 50 });
      MB.audio.sfx(hell ? 'zap' : 'sparkle'); V.shake(5);
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
    MB.audio.sfx('beam');
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
    MB.audio.sfx('beam');
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
      MB.audio.sfx('zap'); V.shake(14);
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
        if (first) { first = false; impact(); hit(V, t, c); } else { flash(V, TT, hT, '#ffffff', 140); MB.audio.sfx('hit'); }
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
      MB.audio.sfx('click');
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
    MB.audio.sfx('beam');
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
      if (i) { burst(V, T, c, 6, { h: hT, spread: 70 }); MB.audio.sfx('hit'); }
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
    MB.audio.sfx('beam');
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
      if (i === 0) { impact(); hit(V, t, c); } else { burst(V, T, '#ffd89a', 4, { h: top, spread: 50 }); MB.audio.sfx('click'); }
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
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); MB.audio.sfx('slam'); V.shake(18);
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
    MB.audio.sfx('whoosh');
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
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT, rotation: i ? 45 : -45 });
      gsap.fromTo(s.body, { scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => s.remove() });
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
    MB.audio.sfx('zap');
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
    MB.audio.sfx('whoosh');
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
    MB.audio.sfx('slam');
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
    MB.audio.sfx('splash');
    await gsap.timeline().to(w.body, { scale: 1, duration: 0.3 }).to(v.figure, { y: -90, rotation: -d.x * 8, duration: 0.3 }, 0);
    const o = { k: 0 };
    await gsap.to(o, { k: 1, duration: 0.6, ease: 'power1.in', onUpdate: () => {
      const p = { x: lerp(A.x, C.x, o.k), y: lerp(A.y, C.y, o.k) };
      gsap.set(v.el, p); gsap.set(w, { x: p.x - d.x * 20, y: p.y - d.y * 20 });
      gsap.set(v.figure, { y: -90 - Math.sin(o.k * Math.PI * 3) * 20 });
      if (Math.random() < 0.5) { const s = dot(V, p, rnd(10, 80), '#bfe9ff', rnd(5, 10)); gsap.to(s.body, { y: `+=${rnd(-60, 20)}`, opacity: 0, duration: 0.5, onComplete: () => s.remove() }); }
      ghost(V, v, c);
    } });
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); V.shake(12);
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
    MB.audio.sfx('splash');
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
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(22); V.hitStop();
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
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', c);
      gsap.set(s.body, { y: -hT - 30 + i * 30, rotation: -60 + i * 20 });
      gsap.fromTo(s.body, { scale: 0.4, opacity: 1 }, { scale: 2, rotation: '+=120', opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => s.remove() });
      if (!i) { impact(); hit(V, t, c); } else burst(V, T, c, 6, { h: hT, spread: 90 });
      MB.audio.sfx('whoosh'); V.shake(6);
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
      if (n !== said) { said = n; pop(V, p, V.heightOf(a) + 20, words[n], 'float-text buff', 0.6); MB.audio.sfx('click'); }
    } });
    impact(); hit(V, t, c); MB.audio.sfx('hit'); V.shake(10);
    for (let i = 0; i < 2; i++) {
      await gsap.to(v.figure, { x: i ? -24 : 24, y: -30, duration: 0.08, yoyo: true, repeat: 1 });
      burst(V, T, c, 6, { h: hT, spread: 70 }); MB.audio.sfx('hit');
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
    MB.audio.sfx('sparkle');
    pop(V, T, hT + 330, 'SWISH!', 'float-text buff', 0.9);
    await gsap.to(ball.body, { y: -hT, duration: 0.25, ease: 'power2.in' });
    impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(12);
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
    impact(); MB.audio.sfx('slam'); MB.audio.sfx('zap'); V.shake(24); V.hitStop();
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
    impact(); hit(V, t, c, true); MB.audio.sfx('splash'); MB.audio.sfx('slam'); V.shake(18);
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
      const s = V.billboard('slash-arc', '', T.x, T.y);
      s.body.style.setProperty('--c', '#3fd0a8');
      gsap.set(s.body, { y: -hT, rotation: i ? 20 : -20 });
      gsap.fromTo(s.body, { scale: 0.4, opacity: 1 }, { scale: 2, rotation: '+=100', opacity: 0, duration: 0.35, onComplete: () => s.remove() });
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
    MB.audio.sfx('beam');
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
    MB.audio.sfx('whoosh');
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
    MB.audio.sfx('beam');
    await glowUp(v, c, -30);
    for (let i = 1; i <= 5; i++) {
      const k = i / 5, P = { x: lerp(A.x, T.x, k), y: lerp(A.y, T.y, k) }, last = i === 5;
      const f = pillar(V, P, i % 2 ? c : '#8b3dff', last ? 'pillar' : 'pillar small');
      gsap.fromTo(f.body, { scaleY: 0 }, { scaleY: last ? 1.2 : rnd(0.8, 1.1), duration: 0.16, ease: 'power3.out' });
      gsap.to(f.body, { scaleX: 0.1, opacity: 0, duration: 0.4, delay: 0.25, onComplete: () => f.remove() });
      if (last) { impact(); hit(V, t, c, true); MB.audio.sfx('slam'); V.shake(14); } else { burst(V, P, c, 5, { h: 40, spread: 50 }); MB.audio.sfx('zap'); }
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
    impact(); hit(V, t, c); MB.audio.sfx('hit'); V.shake(8);
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
    MB.audio.sfx('freeze');
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
      MB.audio.sfx('click');
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
    MB.audio.sfx('buff'); V.shake(8); ring(V, T, c, 2);
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
    MB.audio.sfx('whoosh');
    await gsap.to(loop.body, { rotation: 1080, duration: 0.8, ease: 'power1.in' });
    MB.audio.sfx('whoosh');
    await path(loop, (k) => arc(A, T, top, hT + 40, 100)(k), 0.45, 'power1.in');
    await gsap.to(loop.body, { y: -hT, scale: 0.7, duration: 0.15, ease: 'power2.in' }); // cinches tight
    const N = Math.max(8, Math.round(d.len / 30)), rope = [];
    for (let i = 1; i < N; i++) { const k = i / N; rope.push(dot(V, { x: lerp(A.x, T.x, k), y: lerp(A.y, T.y, k) }, lerp(hA, hT, k) - Math.sin(Math.PI * k) * 30, '#d9b77a', 10, 'rope')); }
    impact(); hit(V, t, c); MB.audio.sfx('hit');
    await wait(0.1);
    MB.audio.sfx('whoosh');
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
    flash(V, T, H, '#ffffff', 260); MB.audio.sfx('zap');
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
    MB.audio.sfx('zap');
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
    MB.audio.sfx('whoosh');
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
      .call(() => { MB.audio.sfx('slam'); V.shake(10); burst(V, r.C, '#c9b79c', 10, { h: 10, spread: 120 }); }) },
    blink: {
      go: async (V, r) => {
        MB.audio.sfx('whoosh');
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
          .call(() => { MB.audio.sfx('click'); burst(V, P, r.c, 4, { h: 5, spread: 50 }); });
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
  };

  // fx(V, t, r, F, land, o): F is where the attacker stands; land(i) marks hit i (the first one deals the damage)
  const propsOf = (o) => [].concat(o.prop || '✦');
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
        MB.audio.sfx('whoosh');
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
        const s = V.billboard('slash-arc', '', r.T.x, r.T.y);
        s.body.style.setProperty('--c', r.c);
        gsap.set(s.body, { y: -r.hT, rotation: -40 + i * 50 + rnd(-10, 10) });
        gsap.fromTo(s.body, { scale: 0.3, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: () => s.remove() });
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
        MB.audio.sfx('zap');
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
        MB.audio.sfx('zap');
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
  const FLOORS = { splat: 'splat', frost: 'frost-floor', sigil: 'sigil', whirlpool: 'whirlpool', ring: 'shock-ring' };

  async function recipe(V, a, t, impact) {
    const o = a.card.attack, r = ctx(V, a, t);
    const moveName = o.move || (!o.fx || o.fx === 'hit' ? 'dash' : 'stay'), m = RMOVE[moveName] || RMOVE.dash;
    const fxName = o.fx || (m.ranged ? 'throw' : 'hit');
    await m.go(V, r);
    const F = m.ranged ? r.A : here(r.v);
    let first = true;
    const land = (i) => {
      if (!first) { if (i % 2 === 0) MB.audio.sfx('hit'); burst(V, r.T, r.c, 5, { h: r.hT, spread: 70 }); return; }
      first = false;
      impact(); hit(V, t, r.c, o.big);
      if (o.shake || o.big) V.shake(o.shake || 14);
      if (o.floor) {
        const f = V.flat(FLOORS[o.floor], '', r.T.x, r.T.y);
        f.style.setProperty('--c', r.c);
        gsap.fromTo(f, { scale: 0.1, opacity: 0.95 }, { scale: 1.2, duration: 0.3, ease: 'back.out(2)' });
        gsap.to(f, { opacity: 0, duration: 0.6, delay: 1, onComplete: () => f.remove() });
      }
      if (o.scatter) scatter(V, r.T, r.hT, [].concat(o.scatter), 10, 140);
    };
    await (RFX[fxName] || RFX.hit)(V, t, r, F, land, o);
    if (first) land(0);
    await wait(0.2);
    await (m.back ? m.back(V, r) : goHome(r.v, r.A));
  }

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
    MB.audio.sfx('bond', tier);
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
  async function attack(V, a, t, impact) {
    const at = a.card.attack, style = S[at.style] || (at.move || at.fx ? recipe : S.dash);
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
      if (at.sfx) MB.audio.sfx(at.sfx);
      if (at.finish) gsap.delayedCall(0.3, () => { const b = pop(V, V.pos(t), V.heightOf(t) * 0.5 + 120, at.finish, 'float-text buff', 1.2); if (b) b.body.style.color = at.color; });
    };
    await style(V, a, t, onHit);
    onHit();
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
      MB.LAYOUT.SLOT_X.forEach((x) => burst(V, { x, y: mid.y }, card.color, 10, { h: 100 }));
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

  MB.FX = { attack, orbTo, spell, dust, burst, rise, ring, flash, flameBurst, fusion, styles: S,
    recipe: { moves: RMOVE, fx: RFX, floors: FLOORS }, casts: ['lob', 'nuke', 'call', 'coins'] };
})();
