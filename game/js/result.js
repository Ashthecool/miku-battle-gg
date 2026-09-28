// The result screen after a battle: the title stamps in letter by letter, both leaders react (the winner hops, the
// loser droops), then the battle in numbers, the Story stars, the rewards dealt in as tiles (packs, profile pictures,
// a new leader, Glitter), notes, and the buttons. A win throws confetti under spinning rays; a loss is cold and rainy.
// js/ui.js (battleOver) works out what was won and hands it here; clicking skips to the end.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const CONFETTI = ['#ffd84a', '#ff6fae', '#7ad7ff', '#8dffa8', '#b35cff', '#ffffff'];
  const W = 1600, H = 900;
  let loops = [];        // looping tweens (rain, floating tiles), stopped when the screen is shown again
  let tl = null, skipping = false;
  const loop = (t) => { loops.push(t); return t; };
  const sfx = (name) => { if (!skipping) MB.audio.sfx(name); };

  // ---------------------------------------------------------------- pieces
  function tile(r) {
    let art, name, sub, color;
    if (r.kind === 'pack') {
      const P = MB.PACKS[r.tier];
      color = P.color; name = P.name; sub = r.note;
      art = `<img class="rt-pack" src="${MB.packArt(r.tier)}" alt="">`;
    } else if (r.kind === 'avatar') {
      color = '#ff6fae'; name = r.name; sub = r.count ? 'Profile pictures' : 'Profile picture';
      art = `<img class="rt-pfp" src="${MB.avatarUrl(r.id)}" alt="">${r.count ? `<i class="rt-count">×${r.count}</i>` : ''}`;
    } else if (r.kind === 'shards') {
      const def = MB.cardDef(r.card);
      color = MB.RARITY[def.rarity].color; name = r.done ? 'Card complete!' : `+${r.to - r.from} 🧩`; sub = `${def.name} · ${r.to}/${r.need}`;
      art = `<div class="rt-face" style="background-image:url('${MB.spriteUrl(r.card, 'idle')}')"></div><i class="rt-bar"><i></i></i>`;
    } else if (r.kind === 'leader') {
      color = '#7dff9a'; name = MB.charById(r.id).name; sub = 'New leader';
      art = `<div class="rt-face" style="background-image:url('${MB.spriteUrl(r.id, 'idle')}')"></div>`;
    } else {
      color = '#ffd84a'; name = '+<span class="rt-n">0</span> ✨'; sub = r.note || 'Glitter';
      art = '<div class="rt-glit">✨</div>';
    }
    const t = el('div', `r-tile k-${r.kind}${r.tier ? ' t-' + r.tier : ''}`, `<div class="rt-art">${art}<i class="rt-shine"></i></div><b>${name}</b><small>${sub}</small>`);
    t.style.setProperty('--rc', color);
    return t;
  }
  // a ring of sparks out of a tile as it lands
  function sparks(t, color) {
    if (skipping) return;
    for (let k = 0; k < 14; k++) {
      const p = el('i', 'rt-spark');
      p.style.background = p.style.color = color;
      t.appendChild(p);
      const a = (k / 14) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(70, 120);
      gsap.fromTo(p, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0, duration: rnd(0.5, 0.8), ease: 'power2.out', onComplete: () => p.remove() });
    }
  }
  // confetti: a burst out of a point (the title), then a slow fall over the whole screen
  function confetti(fx, cx = W / 2, cy = 150) {
    if (skipping) return;
    const phys = !!window.Physics2DPlugin;
    const piece = () => {
      const p = el('i', 'cf' + (Math.random() < 0.3 ? ' ribbon' : ''));
      p.style.background = CONFETTI[(Math.random() * CONFETTI.length) | 0];
      fx.appendChild(p);
      return p;
    };
    for (let k = 0; k < 70; k++) {
      const p = piece(), dur = rnd(1.6, 2.6);
      gsap.set(p, { x: cx + rnd(-160, 160), y: cy, rotation: rnd(0, 360) });
      if (phys) gsap.to(p, { physics2D: { velocity: rnd(500, 1050), angle: rnd(-165, -15), gravity: 900 }, rotation: '+=' + rnd(-720, 720), rotationX: '+=' + rnd(360, 1080), duration: dur, ease: 'none' });
      else gsap.to(p, { x: '+=' + rnd(-600, 600), y: rnd(300, 900), rotation: '+=' + rnd(-720, 720), duration: dur, ease: 'power2.out' });
      gsap.to(p, { opacity: 0, duration: 0.4, delay: dur - 0.4, onComplete: () => p.remove() });
    }
    for (let k = 0; k < 60; k++) {
      const p = piece(), dur = rnd(3.5, 6), x = rnd(0, W);
      gsap.fromTo(p, { x, y: -30, rotation: rnd(0, 360) }, { x: x + rnd(-160, 160), y: H + 30, rotation: '+=' + rnd(360, 900), rotationX: '+=' + rnd(360, 1440),
        duration: dur, delay: rnd(0.2, 2.2), ease: 'none', onComplete: () => p.remove() });
    }
  }
  // a loss: cold rain that keeps falling while the screen is up
  function rain(fx) {
    for (let k = 0; k < 46; k++) {
      const p = el('i', 'rn');
      fx.appendChild(p);
      const x = rnd(-100, W), d = rnd(0.6, 1.1);
      loop(gsap.fromTo(p, { x, y: -60 }, { x: x - 90, y: H + 60, duration: d, repeat: -1, delay: -rnd(0, d), ease: 'none' }));
    }
  }

  // ---------------------------------------------------------------- the screen
  // o: { win, leader, foe, kicker, line, stats: [[icon, value, label]], stars: { row, text } | null,
  //      rewards: [{ kind: 'pack' | 'avatar' | 'leader' | 'shards' | 'glitter', ... }], notes: [html], color, onDealt }
  function show(o) {
    loops.forEach((t) => t.kill());
    loops = [];
    if (tl) tl.kill();
    skipping = false;
    const r = $('#screen-result'), box = r.querySelector('.result-box'), fx = r.querySelector('.rs-fx');
    MB.UI.show('screen-result');
    // this screen runs its own entrance
    gsap.killTweensOf(r.children);
    gsap.set(r.children, { clearProps: 'transform,opacity' });
    r.className = 'screen active ' + (o.win ? 'win' : 'lose');
    r.style.setProperty('--c', o.win ? o.color || '#ffd84a' : '#8a8aff');
    fx.innerHTML = '';

    const me = $('#result-me'), foe = $('#result-foe');
    [me, foe].forEach((s) => { gsap.killTweensOf(s); gsap.set(s, { clearProps: 'all' }); s.classList.remove('beaten'); });
    me.src = MB.bigSpriteUrl(o.leader, o.win ? 'win' : 'lose');
    foe.src = MB.bigSpriteUrl(o.foe, o.win ? 'lose' : 'win');

    $('#result-kicker').textContent = o.kicker || '';
    const title = $('#result-title');
    title.innerHTML = [...(o.win ? 'VICTORY!' : 'DEFEAT...')].map((c) => `<span>${c}</span>`).join('');
    const letters = title.querySelectorAll('span');
    $('#result-text').innerHTML = o.line;
    $('#result-stats').innerHTML = (o.stats || []).map(([i, v, l]) => `<span><i>${i}</i><b>${v}</b><small>${l}</small></span>`).join('');
    const stars = $('#result-stars');
    stars.innerHTML = o.stars ? `<div class="result-stars">${o.stars.row}</div>${o.stars.text}` : '';
    stars.classList.toggle('hidden', !o.stars);
    const rw = $('#result-rewards'), rewards = o.rewards || [];
    rw.innerHTML = rewards.length ? '<h3>Rewards</h3><div class="rr-row"></div>' : '';
    rw.classList.toggle('hidden', !rewards.length);
    const tiles = rewards.map((x) => rw.querySelector('.rr-row').appendChild(tile(x)));
    const notes = $('#result-notes');
    notes.innerHTML = (o.notes || []).map((n) => `<div>${n}</div>`).join('');
    notes.classList.toggle('hidden', !(o.notes || []).length);
    const meta = ['#result-kicker', '#result-text', '#result-stats'].map($).concat(o.stars ? [stars] : []);
    const btns = [...box.querySelectorAll('.row .btn')];

    tl = gsap.timeline();
    tl.fromTo(box, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }, 0)
      .fromTo(me, { x: -340, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.15)
      .fromTo(foe, { x: 340, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.15);
    const land = 0.15 + letters.length * 0.06 + 0.35;
    if (o.win) {
      tl.fromTo('#screen-result .rs-rays', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 1, ease: 'power2.out' }, 0)
        .fromTo(letters, { y: -200, opacity: 0, scale: 1.8, rotation: () => rnd(-40, 40) }, { y: 0, opacity: 1, scale: 1, rotation: 0, duration: 0.55, stagger: 0.06, ease: 'back.out(2.6)' }, 0.15)
        .call(() => { sfx('slam'); sfx('cheer'); confetti(fx); }, null, land)
        .fromTo(title, { scale: 1.15 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }, land)
        .to(letters, { y: -14, duration: 0.18, stagger: 0.05, yoyo: true, repeat: 1, ease: 'power1.out' }, land + 0.35)
        // the winner cheers, the loser droops
        .to(me, { y: -46, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out' }, land)
        .call(() => foe.classList.add('beaten'), null, land)
        .to(foe, { y: 40, duration: 0.9, ease: 'power2.out' }, land);
    } else {
      rain(fx);
      tl.fromTo('#screen-result .rs-gloom', { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
        .fromTo(letters, { y: -160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: 'bounce.out' }, 0.15)
        .call(() => sfx('thud'), null, land - 0.2)
        // the dots slide off their line, one by one
        .to([...letters].slice(-3), { y: (k) => 10 + k * 8, rotation: (k) => 10 + k * 12, duration: 0.5, stagger: 0.12, ease: 'power2.in' }, land + 0.1)
        .call(() => me.classList.add('beaten'), null, land)
        .to(me, { y: 40, duration: 0.9, ease: 'power2.out' }, land)
        .to(foe, { y: -40, duration: 0.22, yoyo: true, repeat: 3, ease: 'power2.out' }, land);
    }
    tl.fromTo(meta, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' }, land - 0.1);
    // new stars stamp in one by one
    const fresh = stars.querySelectorAll('.result-stars i.new');
    let at = land + 0.4;
    if (fresh.length) {
      tl.fromTo(fresh, { scale: 3, opacity: 0, rotation: -180 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, stagger: 0.25, ease: 'back.out(2.2)' }, at);
      fresh.forEach((_, k) => tl.call(() => sfx('ding'), null, at + 0.3 + k * 0.25));
      at += 0.4 + fresh.length * 0.25;
    }
    // the rewards, dealt in
    if (tiles.length) {
      tl.fromTo(rw.querySelector('h3'), { opacity: 0, letterSpacing: '18px' }, { opacity: 1, letterSpacing: '6px', duration: 0.4 }, at);
      at += 0.2;
      tiles.forEach((t, k) => {
        const x = rewards[k], when = at + k * 0.26;
        tl.fromTo(t, { opacity: 0, y: 50, scale: 0.4, rotationY: -120 }, { opacity: 1, y: 0, scale: 1, rotationY: 0, duration: 0.6, ease: 'back.out(1.7)' }, when)
          .call(() => { sfx({ pack: 'loot', avatar: 'sparkle', leader: 'unlock', shards: 'fragment', glitter: 'coin' }[x.kind]); sparks(t, getComputedStyle(t).getPropertyValue('--rc')); }, null, when + 0.25)
          .fromTo(t.querySelector('.rt-shine'), { xPercent: -160 }, { xPercent: 260, duration: 0.7, ease: 'power2.inOut' }, when + 0.45);
        // the fragments fill the card's bar
        if (x.kind === 'shards') tl.fromTo(t.querySelector('.rt-bar i'), { width: x.from / x.need * 100 + '%' }, { width: x.to / x.need * 100 + '%', duration: 0.7, ease: 'power2.out' }, when + 0.35);
        if (x.kind === 'glitter') {
          const n = t.querySelector('.rt-n'), c = { v: 0 };
          tl.to(c, { v: x.n, duration: 0.8, ease: 'power2.out', onUpdate: () => { n.textContent = Math.round(c.v); } }, when + 0.3);
        }
      });
      at += tiles.length * 0.26 + 0.5;
    }
    tl.fromTo(notes, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, at)
      .fromTo(btns, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: 'back.out(2)' }, at + 0.1)
      .call(() => {
        // once everything is in, the packs float and glint now and then
        tiles.forEach((t, k) => {
          const art = t.querySelector('.rt-art');
          loop(gsap.to(art, { y: -6, duration: 1.3 + k * 0.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
          loop(gsap.fromTo(t.querySelector('.rt-shine'), { xPercent: -160 }, { xPercent: 260, duration: 0.8, repeat: -1, repeatDelay: 2.4 + k * 0.4, delay: 1 + k * 0.3, ease: 'power2.inOut' }));
        });
        if (o.onDealt) o.onDealt();
      }, null, at + 0.5);
    // a click anywhere but the buttons skips to the end
    r.onpointerdown = (e) => {
      if (!tl || !tl.isActive() || e.target.closest('button')) return;
      skipping = true;
      tl.progress(1);
      skipping = false;
    };
  }

  MB.Result = { show, confetti };
})();
