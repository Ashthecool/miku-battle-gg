// Music (novel songs) + synthesized sound effects via WebAudio.
(function () {
  let ctx = null, master = null;
  const settings = Object.assign({ music: 0.5, sfx: 0.7 }, JSON.parse(localStorage.getItem('mb-audio') || '{}'));
  let current = null, currentId = null, blocked = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = settings.sfx; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0 }) {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
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
    lose: () => [440, 415, 392, 330].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.14, delay: i * 0.22 })),
  };

  function sfx(name, ...args) { try { SFX[name] && SFX[name](...args); } catch (e) { /* audio blocked until first click */ } }

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
