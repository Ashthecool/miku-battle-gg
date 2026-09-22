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
      const s = V.billboard('star-shot', '✦', A.x, A.y);
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
    for (let i = 0; i < 3; i++) {
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
    const o = V.billboard('petal-orb', '<span>🌸</span><span>🌸</span><span>🌸</span>', A.x, A.y);
    o.body.style.setProperty('--c', c);
    gsap.to(o.body.querySelectorAll('span'), { rotation: 360, duration: 0.6, repeat: -1, ease: 'none' });
    await gsap.to(v.figure, { y: -25, duration: 0.2 });
    MB.audio.sfx('sparkle');
    await path(o, (k) => ({ ...arc(A, T, hA, hT, 160, 60, perp)(k), s: 0.7 + k * 0.5 }), 0.75, 'sine.inOut', (p) => {
      if (Math.random() < 0.35) {
        const pe = V.billboard('petal', '🌸', p.x, p.y);
        gsap.set(pe.body, { y: -p.h, scale: rnd(0.4, 0.8) });
        gsap.to(pe.body, { y: -p.h + rnd(40, 90), rotation: rnd(-200, 200), opacity: 0, duration: 1, onComplete: () => pe.remove() });
      }
    });
    o.remove();
    impact(); hit(V, t, c);
    for (let i = 0; i < 10; i++) {
      const pe = V.billboard('petal', '🌸', T.x, T.y);
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
    const pan = V.billboard('thrown', '🍳', A.x, A.y);
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
    const cone = V.billboard('thrown', '🍦', A.x, A.y);
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
    const huh = V.billboard('float-text ability', 'HUH?!', A.x, A.y);
    gsap.set(huh.body, { y: -V.heightOf(a) - 40 });
    gsap.to(huh.body, { y: '-=60', scale: 1.4, opacity: 0, duration: 0.8, onComplete: () => huh.remove() });
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
    const baka = V.billboard('float-text baka', 'B-BAKA!', T.x, T.y);
    gsap.set(baka.body, { y: -hT - 130 });
    gsap.fromTo(baka.body, { scale: 0.2 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
    gsap.to(baka.body, { opacity: 0, y: '-=40', duration: 0.4, delay: 0.6, onComplete: () => baka.remove() });
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
    const shh = V.billboard('float-text ability', 'Shhh!', T.x, T.y);
    gsap.set(shh.body, { y: -hT - 90 });
    gsap.to(shh.body, { y: '-=50', opacity: 0, duration: 0.8, onComplete: () => shh.remove() });
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
    const b = V.billboard(cls, html, p.x, p.y);
    gsap.set(b.body, { y: -h });
    gsap.timeline({ onComplete: () => b.remove() })
      .fromTo(b.body, { scale: 0.2 }, { scale: 1.15, duration: 0.25, ease: 'back.out(3)' })
      .to(b.body, { y: -h - 60, opacity: 0, duration: dur * 0.6 }, dur * 0.4);
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

  // ---------------------------------------------------------------- relationship fusion
  // full-screen anime cut-in with both partners in their fusion costumes
  function cutin(bond) {
    const T = MB.BOND_TIERS[bond.tier], tier = bond.tier, [a, b] = bond.pair;
    const ov = document.createElement('div');
    ov.className = 'bond-cutin t' + tier;
    ov.style.setProperty('--c', bond.attack.color);
    ov.innerHTML = `<div class="bc-flash"></div><div class="bc-band"><div class="bc-rays"></div></div>
      <img class="bc-a" src="${MB.spriteUrl(a, 'play', bond.costumes[0])}"><img class="bc-b" src="${MB.spriteUrl(b, 'play', bond.costumes[1])}">
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
    const style = S[a.card.attack.style] || S.dash;
    // attack name callout
    const p = V.pos(a);
    if (a.card.attack.name) {
      const tag = V.billboard('attack-name', a.card.attack.name, p.x, p.y);
      tag.body.style.setProperty('--c', a.card.attack.color);
      gsap.set(tag.body, { y: -V.heightOf(a) - 30 });
      gsap.timeline({ onComplete: () => tag.remove() }).from(tag.body, { scale: 0.3, opacity: 0, duration: 0.2, ease: 'back.out(2)' }).to(tag.body, { opacity: 0, y: '-=30', duration: 0.3, delay: 0.6 });
    }
    let hitDone = false;
    await style(V, a, t, () => { if (!hitDone) { hitDone = true; impact(); } });
    if (!hitDone) impact();
  }

  // generic projectile used by abilities and leader powers
  async function orbTo(V, from, to, color, hTo, delay = 0, hFrom = MB.LAYOUT.UNIT_H * 0.6) {
    if (delay) await wait(delay);
    const o = dot(V, from, hFrom, color, 34, 'charge');
    await path(o, (k) => ({ ...arc(from, to, hFrom, hTo * 0.5, 140)(k), s: 1 }), 0.5, 'power1.inOut', (p) => {
      if (Math.random() < 0.6) { const tr = dot(V, p, p.h, color, 10); gsap.to(tr.body, { opacity: 0, scale: 0.1, duration: 0.4, onComplete: () => tr.remove() }); }
    });
    o.remove();
    flash(V, to, hTo * 0.5, color, 120);
    burst(V, to, color, 10, { h: hTo * 0.5, spread: 80 });
  }

  async function spell(V, side, card, from, target, icon, fn) {
    const hFrom = MB.LAYOUT.LEADER_H * 0.7;
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
    } else if (card.effect === 'mansion') {
      const mid = { x: 590, y: MB.LAYOUT.ROW_Y[1 - side] };
      await path(ic, (k) => ({ ...arc(from, mid, hFrom, 320, 100)(k), r: k * 360, s: 1.2 + k }), 0.8, 'power2.inOut');
      await gsap.to(ic.body, { rotation: '+=90', duration: 0.3, ease: 'back.out(3)' });
      MB.audio.sfx('slam'); V.shake(20);
      ring(V, mid, card.color, 5, 0.9); flash(V, mid, 320, card.color, 500);
      fn();
      MB.LAYOUT.SLOT_X.forEach((x) => burst(V, { x, y: mid.y }, card.color, 10, { h: 100 }));
      await gsap.to(ic.body, { opacity: 0, scale: 3, duration: 0.4 });
    } else {
      await gsap.to(ic.body, { y: -hFrom - 90, rotation: card.effect === 'callFriend' ? 0 : 360, duration: 0.5 });
      if (card.effect === 'callFriend') { MB.audio.sfx('zap'); await gsap.to(ic.body, { rotation: 12, duration: 0.05, yoyo: true, repeat: 9 }); }
      if (card.effect === 'allowance') for (let i = 0; i < 3; i++) { MB.audio.sfx('coin'); burst(V, from, card.color, 8, { h: hFrom + 90, spread: 80 }); await wait(0.12); }
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

  MB.FX = { attack, orbTo, spell, dust, burst, rise, ring, flash, flameBurst, fusion, styles: S };
})();
