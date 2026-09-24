// Music (novel songs) + sound effects via WebAudio: recorded samples where we have them, synthesized otherwise.
(function () {
  let ctx = null, master = null;
  const settings = Object.assign({ music: 0.5, sfx: 0.7 }, JSON.parse(localStorage.getItem('mb-audio') || '{}'));
  let current = null, currentId = null, blocked = null;

  // recorded effects in assets/sounds/ (Pixabay, and CC0 sounds from Freesound listed in CREDITS.md). Once loaded one
  // replaces the synth sound of the same name; vol scales it, max cuts a long tail short (seconds), vary detunes each
  // play a little so repeats don't drone
  const SAMPLES = {
    pow: { file: 'animated-cartoon-explosion-impact.mp3', vol: 0.8, max: 1.3, vary: 0.08 },
    blink: { file: 'cartoon-blinking.mp3', vol: 0.8 },
    boing: { file: 'boing-540788.mp3', vol: 0.7, vary: 0.06 },
    bonk: { file: 'bonk-467788.mp3', vol: 0.7, vary: 0.12 },
    punch: { file: 'punch-563356.mp3', vol: 0.7, vary: 0.1 },
    whistleUp: { file: 'whistle-up-497092.mp3', vol: 0.6 },
    whistleDown: { file: 'whistle-down-395443.mp3', vol: 0.6 },
    pop: { file: 'pop-221091.mp3', vol: 0.8, vary: 0.15 },
    squeak: { file: 'squeak-468443.mp3', vol: 0.6, vary: 0.1 },
    zip: { file: 'zip-361122.mp3', vol: 0.6, vary: 0.1 },
    honk: { file: 'honk-468441.mp3', vol: 0.7 },
    wobble: { file: 'wobble-95595.mp3', vol: 0.7 },
    tweet: { file: 'tweet-403002.mp3', vol: 0.6 },
    splat: { file: 'splat-445117.mp3', vol: 0.8, vary: 0.08 },
    twang: { file: 'twang-540082.mp3', vol: 0.7 },
    chomp: { file: 'chomp-353067.mp3', vol: 0.8 },
    ding: { file: 'ding-360948.mp3', vol: 0.6 },
    whistle: { file: 'whistle-538422.mp3', vol: 0.5 },
    bubble: { file: 'bubble-540074.mp3', vol: 0.7, max: 1.3 },
    // elements and magic
    fire: { file: 'fire-267887.mp3', vol: 0.7, vary: 0.06 },
    burn: { file: 'burn-539972.mp3', vol: 0.6, vary: 0.08 },
    freeze: { file: 'freeze-160420.mp3', vol: 0.6 },
    frost: { file: 'frost-709888.mp3', vol: 0.6, max: 1.6 },
    shatter: { file: 'shatter-422633.mp3', vol: 0.5, vary: 0.06 },
    splash: { file: 'splash-829676.mp3', vol: 0.6, vary: 0.08 },
    wave: { file: 'wave-398039.mp3', vol: 0.7 },
    holy: { file: 'holy-608892.mp3', vol: 0.5, max: 2.2 },
    heal: { file: 'heal-562292.mp3', vol: 0.5 },
    fusion: { file: 'fusion-395442.mp3', vol: 0.6 },
    zap: { file: 'zap-530356.mp3', vol: 0.5, vary: 0.1 },
    thunder: { file: 'thunder-535952.mp3', vol: 0.6, max: 1.8 },
    shield: { file: 'shield-570853.mp3', vol: 0.5, max: 1.4 },
    buff: { file: 'buff-478343.mp3', vol: 0.5 },
    debuff: { file: 'debuff-577960.mp3', vol: 0.5 },
    dark: { file: 'dark-659762.mp3', vol: 0.6 },
    wind: { file: 'wind-742907.mp3', vol: 0.7, vary: 0.1 },
    sparkle: { file: 'sparkle-457306.mp3', vol: 0.5, vary: 0.05 },
    coin: { file: 'coin-393908.mp3', vol: 0.5, vary: 0.05 },
    boom: { file: 'boom-792520.mp3', vol: 0.7 },
  };
  const buffers = {};

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = settings.sfx; master.connect(ctx.destination);
      Object.entries(SAMPLES).forEach(([name, s]) => fetch('assets/sounds/' + s.file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => { buffers[name] = buf; })
        .catch(() => { /* missing or undecodable: the synth version plays */ }));
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function sample(name) {
    const c = ac(), s = SAMPLES[name], t = c.currentTime;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buffers[name];
    if (s.vary) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * s.vary;
    g.gain.value = s.vol ?? 1;
    if (s.max) { g.gain.setValueAtTime(s.vol ?? 1, t + s.max * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + s.max); src.stop(t + s.max + 0.05); }
    src.connect(g); g.connect(master); src.start(t);
  }

  // curve: pitch path in Hz (instead of f0 -> f1) · vib: { rate, depth in Hz, end: depth it fades to } wobbles the pitch
  // attack: fade-in time · lp: lowpass cutoff
  function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, curve, vib, attack = 0, lp }) {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    if (curve) o.frequency.setValueCurveAtTime(Float32Array.from(curve), t, dur);
    else { o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); }
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vib.rate; lg.gain.setValueAtTime(vib.depth, t);
      if (vib.end != null) lg.gain.exponentialRampToValueAtTime(Math.max(0.01, vib.end), t + dur);
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.02);
    }
    if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let out = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
    out.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, f = 1200, q = 1, type = 'bandpass', delay = 0, sweep }) {
    const c = ac(), t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }

  const SFX = {
    click: () => tone({ type: 'triangle', f0: 900, f1: 1200, dur: 0.05, vol: 0.15 }),
    hover: () => tone({ type: 'sine', f0: 1400, dur: 0.03, vol: 0.05 }),
    draw: () => noise({ dur: 0.12, vol: 0.15, f: 3000, sweep: 6000, type: 'highpass' }),
    play: () => { noise({ dur: 0.18, vol: 0.2, f: 800, sweep: 200, type: 'lowpass' }); tone({ type: 'triangle', f0: 520, f1: 780, dur: 0.18, vol: 0.18 }); },
    whoosh: () => noise({ dur: 0.3, vol: 0.25, f: 400, sweep: 2500, q: 2 }),
    hit: (big) => { noise({ dur: big ? 0.35 : 0.18, vol: big ? 0.5 : 0.35, f: 900, sweep: 120, type: 'lowpass' }); tone({ type: 'square', f0: big ? 160 : 220, f1: 50, dur: big ? 0.3 : 0.15, vol: 0.2 }); },
    zap: () => { tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.25, vol: 0.12 }); noise({ dur: 0.25, vol: 0.15, f: 4000, type: 'highpass' }); },
    beam: () => { tone({ type: 'sawtooth', f0: 300, f1: 900, dur: 0.5, vol: 0.12 }); tone({ type: 'sine', f0: 600, f1: 1800, dur: 0.5, vol: 0.1 }); },
    sparkle: () => [0, 0.05, 0.1, 0.15].forEach((d, i) => tone({ type: 'sine', f0: 1200 + i * 300, dur: 0.1, vol: 0.08, delay: d })),
    heal: () => [523, 659, 784].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.25, vol: 0.12, delay: i * 0.07 })),
    buff: () => [392, 523, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.13, delay: i * 0.05 })),
    debuff: () => [500, 380, 260].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.13, delay: i * 0.06 })),
    shield: () => { tone({ type: 'sine', f0: 1500, f1: 700, dur: 0.3, vol: 0.15 }); noise({ dur: 0.2, vol: 0.15, f: 5000, type: 'highpass' }); },
    freeze: () => { noise({ dur: 0.5, vol: 0.2, f: 6000, sweep: 2000, type: 'highpass' }); tone({ type: 'sine', f0: 2400, f1: 1800, dur: 0.4, vol: 0.06 }); },
    coin: () => [0, 0.06].forEach((d) => tone({ type: 'square', f0: 988, f1: 1319, dur: 0.12, vol: 0.06, delay: d })),
    death: () => { noise({ dur: 0.8, vol: 0.2, f: 2000, sweep: 300 }); tone({ type: 'triangle', f0: 440, f1: 110, dur: 0.7, vol: 0.12 }); },
    slam: () => { noise({ dur: 0.6, vol: 0.55, f: 300, sweep: 40, type: 'lowpass' }); tone({ type: 'sine', f0: 90, f1: 30, dur: 0.6, vol: 0.4 }); },
    splash: () => noise({ dur: 0.6, vol: 0.3, f: 1500, sweep: 400, q: 0.7 }),
    turn: () => [440, 554, 659, 880].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.06 })),
    // relationship fusion: a rising chord, longer and brighter for stronger bonds
    bond: (tier = 1) => {
      [523, 659, 784, 1047, 1319, 1568].slice(0, 3 + tier).forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.12, delay: i * 0.07 }));
      tone({ type: 'sine', f0: 262, f1: 523, dur: 0.6, vol: 0.15 });
      if (tier >= 3) noise({ dur: 0.8, vol: 0.18, f: 5000, sweep: 1500, type: 'highpass' });
    },
    error: () => tone({ type: 'square', f0: 180, f1: 140, dur: 0.15, vol: 0.1 }),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.25, vol: 0.14, delay: i * 0.12 })),
    // ---- cartoon set: rubber, wood and slide whistles for the attacks
    boing: () => tone({ type: 'triangle', f0: 140, f1: 420, dur: 0.5, vol: 0.22, vib: { rate: 24, depth: 90, end: 4 } }),
    bonk: (p = 1) => { tone({ type: 'sine', f0: 820 * p, f1: 520 * p, dur: 0.11, vol: 0.3 }); tone({ type: 'triangle', f0: 1650 * p, f1: 1100 * p, dur: 0.06, vol: 0.12 }); noise({ dur: 0.03, vol: 0.2, f: 2500, q: 3 }); },
    pow: () => {
      noise({ dur: 0.22, vol: 0.45, f: 1800, sweep: 200, type: 'lowpass' });
      tone({ type: 'square', f0: 420, f1: 70, dur: 0.18, vol: 0.16, lp: 1800 });
      tone({ type: 'sine', f0: 150, f1: 45, dur: 0.3, vol: 0.35 });
    },
    whistleUp: () => tone({ type: 'sine', f0: 420, f1: 1900, dur: 0.45, vol: 0.14, attack: 0.03, vib: { rate: 7, depth: 30 } }),
    whistleDown: () => tone({ type: 'sine', f0: 1900, f1: 300, dur: 0.7, vol: 0.14, attack: 0.03, vib: { rate: 7, depth: 35 } }),
    pop: () => { tone({ type: 'sine', f0: 380, f1: 1500, dur: 0.07, vol: 0.28 }); noise({ dur: 0.03, vol: 0.12, f: 3000, q: 2 }); },
    squeak: () => tone({ type: 'sawtooth', curve: [1500, 2300, 2500, 1700], dur: 0.16, vol: 0.07, lp: 3200, vib: { rate: 38, depth: 70 } }),
    zip: () => tone({ type: 'sawtooth', f0: 260, f1: 2800, dur: 0.14, vol: 0.08, lp: 4000 }),
    honk: () => [0, 0.2].forEach((d) => [370, 376].forEach((f) => tone({ type: 'sawtooth', f0: f, f1: f * 0.97, dur: 0.16, vol: 0.09, delay: d, attack: 0.01, lp: 1400 }))),
    wobble: () => tone({ type: 'triangle', f0: 330, f1: 220, dur: 0.7, vol: 0.16, attack: 0.02, vib: { rate: 9, depth: 60 } }),
    tweet: () => [0, 0.13, 0.26].forEach((d, i) => tone({ type: 'sine', curve: [2600, 3600 + i * 150, 2900], dur: 0.09, vol: 0.07, delay: d })),
    splat: () => { noise({ dur: 0.3, vol: 0.4, f: 1400, sweep: 150, type: 'lowpass' }); tone({ type: 'sine', f0: 240, f1: 60, dur: 0.22, vol: 0.25 }); },
    twang: () => tone({ type: 'sawtooth', f0: 150, f1: 95, dur: 0.6, vol: 0.12, lp: 1300, vib: { rate: 16, depth: 18, end: 2 } }),
    chomp: () => [0, 0.12].forEach((d) => { tone({ type: 'square', f0: 160, f1: 60, dur: 0.1, vol: 0.18, delay: d, lp: 900 }); noise({ dur: 0.07, vol: 0.3, f: 700, type: 'lowpass', delay: d }); }),
    ding: () => { tone({ type: 'sine', f0: 1760, dur: 0.8, vol: 0.12 }); tone({ type: 'sine', f0: 2640, dur: 0.5, vol: 0.05 }); },
    whistle: () => tone({ type: 'sine', f0: 2900, f1: 2750, dur: 0.5, vol: 0.12, attack: 0.02, vib: { rate: 42, depth: 160 } }),
    bubble: () => [0, 0.08, 0.15, 0.24, 0.3].forEach((d, i) => tone({ type: 'sine', f0: 300 + i * 90, f1: 900 + i * 200, dur: 0.06, vol: 0.14, delay: d })),
    // the cartoon layer under every hit: a bonk at a random pitch, or a POW for heavy ones
    blink: () => [0, 0.18].forEach((d) => tone({ type: 'sine', curve: [900, 1900, 1300], dur: 0.12, vol: 0.12, delay: d })),
    punch: (p) => SFX.bonk(p),
    // synth stand-ins for the element samples
    fire: () => { noise({ dur: 0.5, vol: 0.3, f: 500, sweep: 2200, q: 0.8 }); tone({ type: 'sawtooth', f0: 180, f1: 80, dur: 0.4, vol: 0.08, lp: 900 }); },
    burn: () => SFX.fire(),
    frost: () => SFX.freeze(),
    shatter: () => { noise({ dur: 0.35, vol: 0.25, f: 7000, sweep: 3000, type: 'highpass' }); [2800, 3400, 2200].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.12, vol: 0.05, delay: i * 0.04 })); },
    wave: () => noise({ dur: 1, vol: 0.35, f: 600, sweep: 1800, q: 0.6 }),
    holy: () => [523, 659, 784, 1047].forEach((f) => tone({ type: 'sine', f0: f, dur: 1.2, vol: 0.06, attack: 0.3 })),
    fusion: () => SFX.bond(3),
    thunder: () => { SFX.zap(); SFX.slam(); },
    dark: () => { tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 0.8, vol: 0.1, lp: 600, vib: { rate: 5, depth: 8 } }); noise({ dur: 0.8, vol: 0.12, f: 300, sweep: 120 }); },
    wind: () => SFX.whoosh(),
    boom: () => SFX.slam(),
    // the cartoon layer under every hit: a bonk or a punch, or a POW for heavy ones
    toon: (big) => play(big ? 'pow' : Math.random() < 0.5 ? 'punch' : 'bonk', 0.8 + Math.random() * 0.5),
    lose: () => [440, 415, 392, 330].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.14, delay: i * 0.22 })),
  };

  function play(name, ...args) { if (buffers[name]) sample(name); else if (SFX[name]) SFX[name](...args); }
  function sfx(name, ...args) { try { play(name, ...args); } catch (e) { /* audio blocked until first click */ } }

  function music(id) {
    if (id === currentId) return;
    const track = MB.manifest.music.find((m) => m.id === id);
    const old = current;
    if (old) gsap.to(old, { volume: 0, duration: 0.8, onComplete: () => old.pause() });
    currentId = id; current = null;
    if (!track) return;
    const a = new Audio(track.url); // streamed from the miku.gg CDN
    a.loop = true; a.volume = 0;
    a.play().then(() => gsap.to(a, { volume: settings.music, duration: 1.2 })).catch(() => { if (currentId === id) { currentId = null; blocked = id; } });
    current = a;
    MB.nowPlaying = track.name;
    document.dispatchEvent(new CustomEvent('mb-music', { detail: track.name }));
  }

  function setVolume(kind, v) {
    settings[kind] = v;
    localStorage.setItem('mb-audio', JSON.stringify(settings));
    if (kind === 'music' && current) { gsap.killTweensOf(current); current.volume = v; }
    if (kind === 'sfx' && master) master.gain.value = v;
  }

  MB.audio = { sfx, music, setVolume, settings, unlock: ac, retry: () => { if (blocked && !currentId) { const id = blocked; blocked = null; music(id); } } };
})();
