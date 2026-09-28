// Cutscene effects for Story scenes (storymap.js): a tear in the sky, lighting (power cuts, candles, night, rift
// glow), flashes, shakes and flickering lights. Everything draws into #screen-scene, in its 1600x900 space, except the
// lighting, which also tints #bg. The overlays stretch past the 16:9 box to the window's edges (--bx/--by), so points
// on them are placed with at(). reset() puts it all back.
window.MB = window.MB || {};
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const VW = 1600, VH = 900, SVG = 'http://www.w3.org/2000/svg';
  // a gradient position for a point given in % of the 1600x900 box, on a layer that bleeds past it
  const at = (x, y) => `calc(${(x / 100) * VW}px + var(--bx)) calc(${(y / 100) * VH}px + var(--by))`;
  const pts = (list) => 'M' + list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

  // ---------------------------------------------------------------- lighting
  // a filter for the background and one for the characters (a bit brighter, so faces still read), a colour that
  // multiplies over both (moonlight blue, candle amber), and the overlay: vignette, a warm candle glow and the rift's
  // purple spill. Filters only dim and desaturate: hue-rotate would turn a green jumper red.
  const NORMAL = 'brightness(1) saturate(1) contrast(1)';
  const LIGHTS = {
    none: { bg: NORMAL, cast: NORMAL, tint: ['#000000', 0], vig: 0.35 },
    night: { bg: 'brightness(0.7) saturate(0.7) contrast(1.05)', cast: 'brightness(0.92) saturate(0.85) contrast(1)', tint: ['#0b1a5c', 0.3], vig: 0.6 },
    dark: { bg: 'brightness(0.42) saturate(0.4) contrast(1.15)', cast: 'brightness(0.72) saturate(0.55) contrast(1.05)', tint: ['#060c38', 0.42], vig: 0.9 },
    candle: { bg: 'brightness(0.5) saturate(0.8) contrast(1.1)', cast: 'brightness(0.88) saturate(0.95) contrast(1.05)', tint: ['#2a1204', 0.32], vig: 0.85, candle: true },
    rift: { bg: 'brightness(0.72) saturate(0.75) contrast(1.08)', cast: 'brightness(0.95) saturate(0.9) contrast(1)', tint: ['#1c0c52', 0.25], vig: 0.65, glow: [50, 6] },
  };
  let lightNow = 'none', candleTl = null, glowTl = null;
  const castEls = () => ['#sc-stage', '#sc-close'].map($).filter(Boolean);
  function light(kind, dur = 0.8) {
    const L = LIGHTS[kind] || LIGHTS.none, bg = $('#bg');
    lightNow = LIGHTS[kind] ? kind : 'none';
    if (bg) gsap.to(bg, { filter: L.bg, duration: dur, ease: 'power2.inOut' });
    castEls().forEach((e) => gsap.to(e, { filter: L.cast, duration: dur, ease: 'power2.inOut' }));
    gsap.to('#sc-light .tint', { backgroundColor: L.tint[0], opacity: L.tint[1], duration: dur });
    gsap.to('#sc-light .vig', { opacity: L.vig, duration: dur });
    // candlelight breathes and gutters
    if (candleTl) { candleTl.kill(); candleTl = null; }
    const c = $('#sc-light .candle');
    if (L.candle) {
      gsap.to(c, { opacity: 0.85, duration: dur });
      candleTl = gsap.timeline({ repeat: -1, delay: dur });
      for (let k = 0; k < 8; k++) candleTl.to(c, { opacity: rnd(0.6, 0.95), scale: rnd(0.96, 1.05), duration: rnd(0.08, 0.35), ease: 'sine.inOut' });
    } else gsap.to(c, { opacity: 0, duration: dur });
    // a rift's light, without the rift: something glowing out of frame
    if (glowTl) { glowTl.kill(); glowTl = null; }
    if (L.glow) { spillAt(L.glow[0], L.glow[1], 1.5, true); glowTl = gsap.fromTo('#sc-light .spill', { opacity: 0.5 }, { opacity: 0.95, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }); } else if (!rift) gsap.to('#sc-light .spill', { opacity: 0, duration: dur });
  }
  function spillAt(x, y, r = 1, strong) {
    $('#sc-light .spill').style.background = strong
      ? `radial-gradient(ellipse ${900 * r}px ${650 * r}px at ${at(x, y)}, #e9d4ffaa, #a86bff66 30%, #5a2ab026 60%, #0000 80%)`
      : `radial-gradient(ellipse ${900 * r}px ${650 * r}px at ${at(x, y)}, #e2c6ff66, #9a5cff40 30%, #5a2ab018 60%, #0000 80%)`;
  }

  // ---------------------------------------------------------------- the lights stutter
  function flicker() {
    const dim = $('#sc-light .dim'), bg = $('#bg'), tl = gsap.timeline();
    [0.85, 0, 0.7, 0.1, 0.9, 0.2, 0].forEach((o, k) => tl.to(dim, { opacity: o, duration: k % 2 ? 0.05 : 0.03 }, `+=${rnd(0.03, 0.1)}`));
    if (bg) tl.add(stutter(bg, 0.35, 7), 0);
    return tl;
  }
  // an element's opacity jumps about for a moment, like a bulb on a bad wire
  function stutter(e, low, n) {
    const tl = gsap.timeline();
    for (let k = 0; k < n; k++) tl.to(e, { opacity: k % 2 ? 1 : rnd(low, low + 0.3), duration: rnd(0.03, 0.08), ease: 'steps(1)' });
    return tl.to(e, { opacity: 1, duration: 0.05 });
  }

  // ---------------------------------------------------------------- shake: jittery, fading, with a little roll
  function shake(n = 14) {
    const tl = gsap.timeline(), T = '#sc-stage, #sc-sky, #bg';
    for (let k = 0; k < 7; k++) {
      const f = n * (1 - k / 7);
      tl.to(T, { x: rnd(-f, f), y: rnd(-f, f) * 0.6, rotation: rnd(-f, f) * 0.03, duration: 0.05, ease: 'none' });
    }
    return tl.to(T, { x: 0, y: 0, rotation: 0, duration: 0.25, ease: 'power2.out' });
  }

  // ---------------------------------------------------------------- flash: white-out, a burst of light rays and a bloom
  function flash(pos, strength = 0.95) {
    const [x, y] = pos || (rift ? [rift.x, rift.y] : lastAt || [50, 42]);
    const f = $('#sc-flash'), rays = $('#sc-rays');
    f.style.background = `radial-gradient(circle at ${at(x, y)}, #fff 0, #fff 25%, #f3e6ff 60%, #e2ccff 100%)`;
    gsap.fromTo(f, { opacity: strength }, { opacity: 0, duration: 0.9, ease: 'power2.out' });
    gsap.set(rays, { left: (x / 100) * VW, top: (y / 100) * VH });
    gsap.fromTo(rays, { opacity: 0.8 * strength, scale: 0.5, rotation: rnd(0, 30) }, { opacity: 0, scale: 1.5, rotation: '+=20', duration: 1.2, ease: 'power2.out' });
    const bg = $('#bg');
    if (bg) gsap.fromTo(bg, { scale: 1.04 }, { scale: 1, duration: 0.8, ease: 'power2.out' });
  }

  // ---------------------------------------------------------------- the rift: a tear in the sky
  // A jagged crack draws itself outward from one point, forks, then splits open on a swirling, starry void. It throws
  // debris, pulls sparks in like wind, and lights the room (and everyone in it) purple until it closes.
  let rift = null, lastAt = null, uid = 0; // lastAt: where the last rift closed, for the flash that closes it
  function tearShape(L, H) {
    const n = 24, top = [], bot = [], mid = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = -L + 2 * L * t, end = k === 0 || k === n;
      const w = H * Math.pow(Math.sin(Math.PI * t), 0.9), c = Math.sin(t * Math.PI * 2.3 + 0.6) * H * 0.22;
      const jx = end ? 0 : rnd(-10, 10);
      top.push([x + jx, c - w * rnd(0.55, 1.2)]);
      bot.push([x - jx, c + w * rnd(0.55, 1.2)]);
      mid.push([x, c + (end ? 0 : rnd(-3, 3))]);
    }
    return { top, bot, mid, shape: pts(top) + 'L' + bot.slice().reverse().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z' };
  }
  // lightning-like forks off the crack
  function forks(mid, L) {
    const out = [];
    for (let k = 0; k < 7; k++) {
      const [x0, y0] = mid[2 + Math.floor(Math.random() * (mid.length - 4))];
      let x = x0, y = y0;
      const p = [[x, y]], dir = Math.random() < 0.5 ? -1 : 1, ax = Math.sign(x0 || 1) * rnd(0.3, 0.9);
      for (let s = 0; s < 4; s++) { x += ax * rnd(12, 30) + rnd(-10, 10); y += dir * rnd(14, 30) * (1 - Math.abs(x0) / L * 0.5); p.push([x, y]); }
      out.push(pts(p));
    }
    return out;
  }
  function riftOpen({ at = [50, 26], size = 1, tilt = -14 } = {}) {
    if (rift) riftClose(true);
    const L = 460, H = 92, id = 'rf' + ++uid, T = tearShape(L, H);
    const box = el('div', 'sc-rift');
    gsap.set(box, { left: (at[0] / 100) * VW, top: (at[1] / 100) * VH, scale: size, rotation: tilt });
    const halo = el('div', 'rift-halo'), rays = el('div', 'rift-rays');
    const stars = Array.from({ length: 34 }, () => `<circle class="rt-star" cx="${rnd(-L, L).toFixed(0)}" cy="${rnd(-H * 1.3, H * 1.3).toFixed(0)}" r="${rnd(0.8, 2.6).toFixed(1)}"/>`).join('');
    const swirl = [['#ff6fae', 0.55, 0.9], ['#7ad7ff', 0.4, 1.3], ['#c9a0ff', 0.6, 0.6], ['#fff3b0', 0.3, 1.1]]
      .map(([c, o, r], k) => `<ellipse class="rt-sw" cx="0" cy="0" rx="${(L * r).toFixed(0)}" ry="${(H * (1.2 + k * 0.4)).toFixed(0)}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="${14 + k * 6}" filter="url(#${id}-soft)"/>`).join('');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `${-L - 80} ${-H * 3} ${2 * L + 160} ${H * 6}`);
    svg.setAttribute('class', 'sc-tear');
    svg.innerHTML = `<defs>
        <radialGradient id="${id}-void" cx="0" cy="0" r="${L}" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 0.3)">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#fff2fd"/><stop offset=".3" stop-color="#f3a6ff"/>
          <stop offset=".5" stop-color="#a152ff"/><stop offset=".72" stop-color="#48179e"/><stop offset="1" stop-color="#1a0845"/></radialGradient>
        <linearGradient id="${id}-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe4ff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#ff9cdc"/></linearGradient>
        <filter id="${id}-glow" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="22"/></filter>
        <filter id="${id}-bloom" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="${id}-soft" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>
        <clipPath id="${id}-clip"><path d="${T.shape}"/></clipPath>
      </defs>
      <g class="rt-open">
        <path class="rt-aura" d="${T.shape}" fill="#b27cff" stroke="#a86bff" stroke-width="80" filter="url(#${id}-glow)"/>
        <path class="rt-aura" d="${T.shape}" fill="#f4e8ff" stroke="#f4e8ff" stroke-width="14" filter="url(#${id}-bloom)"/>
        <g clip-path="url(#${id}-clip)">
          <rect x="${-L - 20}" y="${-H * 3}" width="${2 * L + 40}" height="${H * 6}" fill="url(#${id}-void)"/>
          <g class="rt-swirl">${swirl}</g>
          ${stars}
        </g>
        <path class="rt-rim" d="${T.shape}" fill="none" stroke="url(#${id}-edge)" stroke-width="5" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>
      </g>
      <g class="rt-cracks" fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${forks(T.mid, L).map((d) => `<path class="rt-fork" d="${d}" stroke="#e9dbff" stroke-width="2.2"/>`).join('')}
        <path class="rt-line" d="${pts(T.mid.slice(0, 13).reverse())}" stroke="#fff" stroke-width="5"/>
        <path class="rt-line" d="${pts(T.mid.slice(12))}" stroke="#fff" stroke-width="5"/>
      </g>`;
    const motes = el('div', 'rift-motes');
    box.append(halo, rays, svg, motes);
    $('#sc-sky').appendChild(box);
    const q = (s) => svg.querySelectorAll(s), open = svg.querySelector('.rt-open');
    rift = { box, x: at[0], y: at[1], size, loops: [], timer: null };

    // the room takes its light, and so does everyone standing in it
    spillAt(at[0], at[1], 0.6 + size * 0.6);
    $('#screen-scene').classList.add('rift-lit');

    const tl = gsap.timeline();
    gsap.set(open, { scaleY: 0.02, opacity: 0, transformOrigin: '50% 50%' });
    gsap.set([halo, rays], { opacity: 0, scale: 0.3 });
    gsap.set(q('.rt-line'), { drawSVG: '0%' });
    gsap.set(q('.rt-fork'), { drawSVG: '0%', opacity: 0.9 });
    // 1. a hairline crack races out from the centre
    tl.to(halo, { opacity: 0.6, scale: 0.35, duration: 0.3 }, 0)
      .to(q('.rt-line'), { drawSVG: '100%', duration: 0.38, ease: 'power3.in' }, 0)
      .to(q('.rt-fork'), { drawSVG: '100%', duration: 0.16, stagger: 0.035, ease: 'power1.out' }, 0.3)
      .add(() => { const bg = $('#bg'); if (bg) stutter(bg, 0.4, 5); shake(8); }, 0.32)
    // 2. it splits open
      .add(() => { flash(at, 0.75); shake(22); burst(motes); }, 0.52)
      .to(open, { opacity: 1, duration: 0.1 }, 0.52)
      .to(open, { scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.55)' }, 0.52)
      .to(q('.rt-line'), { opacity: 0, duration: 0.3 }, 0.6)
      .to(q('.rt-fork'), { opacity: 0.35, duration: 0.6 }, 0.6)
      .to(halo, { opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out' }, 0.52)
      .to(rays, { opacity: 0.8, scale: 1, duration: 1, ease: 'power2.out' }, 0.55)
      .to('#sc-light .spill', { opacity: 0.8, duration: 0.8 }, 0.52);
    // 3. it stays open: the void swirls, the edge crackles, the light breathes, the wind pulls sparks in
    tl.add(() => {
      if (!rift || rift.box !== box) return;
      rift.loops.push(
        gsap.to(q('.rt-swirl'), { rotation: 360, svgOrigin: '0 0', duration: 7, repeat: -1, ease: 'none' }),
        gsap.to(q('.rt-sw'), { rotation: -360, svgOrigin: '0 0', duration: (k) => 4 + k * 2.5, repeat: -1, ease: 'none' }),
        gsap.to(q('.rt-star'), { opacity: 0.2, duration: () => rnd(0.3, 1.1), repeat: -1, yoyo: true, stagger: { each: 0.05, from: 'random' } }),
        gsap.to(open, { scaleY: 1.08, scaleX: 1.015, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
        gsap.to(q('.rt-rim'), { opacity: 0.55, duration: 0.07, repeat: -1, yoyo: true, repeatDelay: 0.4, ease: 'steps(1)' }),
        gsap.to(halo, { scale: 1.1, opacity: 0.8, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
        gsap.to(rays, { rotation: '+=360', duration: 40, repeat: -1, ease: 'none' }),
        gsap.to('#sc-light .spill', { opacity: 0.55, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
      );
      rift.timer = setInterval(() => suck(motes), 70);
    });
    rift.loops.push(tl);
    return tl;
  }
  // the tear throws out glowing shards as it opens
  function burst(layer) {
    for (let k = 0; k < 26; k++) {
      const s = el('i', k % 3 ? 'rift-spark' : 'rift-shard'), a = rnd(0, Math.PI * 2), d = rnd(180, 620);
      layer.appendChild(s);
      gsap.fromTo(s, { x: rnd(-200, 200), y: 0, rotation: rnd(0, 360), scale: rnd(0.6, 1.4), opacity: 1 },
        { x: `+=${Math.cos(a) * d}`, y: Math.sin(a) * d * 0.7 + 160, rotation: '+=' + rnd(-540, 540), opacity: 0, duration: rnd(0.9, 1.6), ease: 'power2.out', onComplete: () => s.remove() });
    }
  }
  // sparks and streaks drawn in from all around, like wind rushing into the tear
  function suck(layer) {
    if (document.hidden) return;
    const s = el('i', 'rift-mote'), a = rnd(0, Math.PI * 2), d = rnd(320, 760), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.55;
    layer.appendChild(s);
    gsap.set(s, { x, y, rotation: (Math.atan2(-y, -x) * 180) / Math.PI, opacity: 0, scaleX: rnd(0.6, 1.8) });
    gsap.timeline({ onComplete: () => s.remove() })
      .to(s, { opacity: rnd(0.5, 1), duration: 0.2 })
      .to(s, { x: rnd(-60, 60), y: rnd(-8, 8), scaleX: 3, scaleY: 0.4, duration: rnd(0.7, 1.2), ease: 'power2.in' }, 0)
      .to(s, { opacity: 0, duration: 0.15 }, '>-0.15');
  }
  function riftClose(now) {
    if (!rift) return;
    const R = rift, open = R.box.querySelector('.rt-open');
    rift = null;
    lastAt = [R.x, R.y];
    clearInterval(R.timer);
    R.loops.forEach((t) => t.kill());
    $('#screen-scene').classList.remove('rift-lit');
    if (lightNow !== 'rift') gsap.to('#sc-light .spill', { opacity: 0, duration: now ? 0.1 : 0.6 });
    if (now) { R.box.remove(); return; }
    gsap.timeline({ onComplete: () => R.box.remove() })
      .to(open, { scaleY: 0.02, duration: 0.35, ease: 'back.in(2.5)' })
      .to(R.box.querySelectorAll('.rift-halo, .rift-rays'), { scale: 0.2, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0)
      .to(R.box, { scaleX: 0, opacity: 0, duration: 0.25, ease: 'power3.in' }, 0.3);
  }

  function reset() {
    riftClose(true);
    lastAt = null;
    $('#sc-sky').innerHTML = '';
    [candleTl, glowTl].forEach((t) => t && t.kill());
    candleTl = glowTl = null;
    lightNow = 'none';
    const bg = $('#bg');
    if (bg) { gsap.killTweensOf(bg, 'filter,opacity'); gsap.set(bg, { clearProps: 'filter,opacity' }); }
    castEls().forEach((e) => { gsap.killTweensOf(e, 'filter'); gsap.set(e, { clearProps: 'filter' }); });
    document.querySelectorAll('#sc-light > *').forEach((e) => { gsap.killTweensOf(e); gsap.set(e, { clearProps: 'opacity,transform' }); });
    $('#screen-scene').classList.remove('rift-lit');
  }

  MB.SceneFX = { light, flicker, shake, flash, riftOpen, riftClose, reset, isRiftOpen: () => !!rift, LIGHTS: Object.keys(LIGHTS) };
})();
