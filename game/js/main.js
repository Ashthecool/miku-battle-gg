// Boot: read the asset manifest, preload sprites, show the title screen.
(function () {
  MB.manifest = window.MIKU_MANIFEST;
  const byId = new Map(MB.manifest.characters.map((c) => [c.id, c]));
  MB.charById = (id) => byId.get(id);
  MB.itemIcon = (id) => { const it = MB.manifest.items.find((i) => i.id === id); return it ? MB.asset(it.icon) : ''; };

  // keep the 1600x900 UI scaled to the window
  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    // picked once, before anything is drawn: full-size sprites only when a UI pixel covers 1.5+ screen pixels
    if (!MB.view) MB.SMALL_SPRITES = s * (window.devicePixelRatio || 1) < 1.5;
    const root = document.getElementById('ui-root');
    root.style.transform = `scale(${s})`;
    root.style.left = (window.innerWidth - 1600 * s) / 2 + 'px';
    root.style.top = (window.innerHeight - 900 * s) / 2 + 'px';
    // how far the window runs past the 1600x900 box on each side, in UI pixels: full-screen layers (cutscene
    // lighting, fades, bars, weather) stretch by this much so they cover the letterbox margins too
    MB.bleed = { x: (window.innerWidth / s - 1600) / 2, y: (window.innerHeight / s - 900) / 2 };
    root.style.setProperty('--bx', MB.bleed.x + 'px');
    root.style.setProperty('--by', MB.bleed.y + 'px');
  }
  window.addEventListener('resize', fit);
  fit();

  // decoded images stay referenced here so the browser keeps them ready: nothing has to be fetched or
  // decoded the first time a sprite shows up mid-battle. Only the most recently asked-for ones are kept (up to
  // DECODED_PX pixels, ~400 MB of bitmaps): holding every sprite a session had touched grew past gigabytes and made
  // the whole game lag. A dropped one is still in the HTTP cache and decodes again when next shown or preloaded.
  const DECODED_PX = 100e6;
  const images = new Map(); // url -> promise of the decoded Image, oldest first
  const px = new Map(); // url -> pixels of a decoded one
  let heldPx = 0;
  const trim = () => {
    for (const [u, n] of px) {
      if (heldPx <= DECODED_PX) break;
      px.delete(u); images.delete(u); heldPx -= n;
    }
  };
  MB.preloadImages = (urls, onProgress) => {
    const list = [...new Set(urls)].filter(Boolean);
    let done = 0;
    return Promise.all(list.map((u) => {
      let p = images.get(u);
      if (p) { // asked for again: now the newest
        images.delete(u); images.set(u, p);
        if (px.has(u)) { const n = px.get(u); px.delete(u); px.set(u, n); }
      } else {
        const img = new Image();
        img.src = u;
        p = img.decode().then(() => {
          if (images.get(u) === p) { const n = img.naturalWidth * img.naturalHeight; px.set(u, n); heldPx += n; trim(); }
          return img;
        }, () => { if (images.get(u) === p) images.delete(u); }); // a failed one is tried again next time
        images.set(u, p);
      }
      return p.then((img) => { done++; if (onProgress) onProgress(done / list.length, img, done, list.length); });
    }));
  };

  // the rest of the roster, a few at a time and in order, downloaded into the HTTP cache behind the game without
  // starving what a screen asks for right now. Not decoded or held: ~1300 sprites decoded at once were most of
  // the lag. preloadImages decodes the ones a battle uses when it starts, from the cache.
  const fetchImage = (u) => new Promise((res) => {
    const img = new Image();
    img.fetchPriority = 'low';
    img.onload = img.onerror = res;
    img.src = u;
  });
  MB.preloadBackground = (urls, pool = 4) => {
    const list = [...new Set(urls)].filter((u) => u && !images.has(u));
    let next = 0;
    return Promise.all(Array.from({ length: pool }, async () => {
      while (next < list.length) await fetchImage(list[next++]);
    }));
  };

  // one character's sprites in the size the board uses, in the outfit they wear (the usual one, or the wardrobe's
  // pick) and in their relationship costumes so fusions don't pop in
  const costume = (c, id) => id && c && c.costumes.find((o) => o.id === id);
  MB.charImages = (id) => {
    const c = MB.charById(id), urls = [];
    if (!c) return urls;
    const sprites = (set) => Object.values(set).forEach((s) => urls.push(MB.spriteSrc(s)));
    sprites(c.sprites);
    const worn = costume(c, MB.UI.save.costumes[id]);
    if (worn) sprites(worn.sprites);
    MB.BONDS.forEach((bd) => bd.pair.forEach((p, i) => { if (p === id) { const o = costume(c, bd.costumes[i]); if (o) sprites(o.sprites); } }));
    MB.COMBOS.forEach((cb) => { if (cb.char === id) { const o = costume(c, cb.costume); if (o) sprites(o.sprites); } });
    return urls;
  };

  // The loading screen waits for what the first screens show: item icons, pack art, the profile picture and the
  // sprites of the leaders, your deck and the two guides. Every other character loads behind the game (a battle
  // waits for the ones it uses, ui.js); other costumes load when first shown, each battle adds its background and close-ups
  function preload() {
    const urls = [...MB.AttackArt.urls];
    // the Card Maker only shows the characters it brings (js/maker-bridge.js) and loads those itself
    if (MB.Maker) return MB.preloadImages(MB.bootImages = urls);
    const save = MB.UI.save;
    MB.manifest.items.forEach((i) => urls.push(MB.asset(i.icon)));
    Object.keys(MB.PACKS).forEach((t) => urls.push(MB.packArt(t)));
    urls.push(MB.avatarUrl(save.avatar));
    const first = new Set([save.leader, 'hayley-kate', 'm-chan', ...save.leaders, ...save.deck]);
    first.forEach((id) => urls.push(...MB.charImages(id)));
    // M-chan's intro and the Story-button guide show her full-size, so those must be ready before the first screen
    const mchan = MB.charById('m-chan');
    if (mchan) Object.keys(mchan.sprites).forEach((role) => urls.push(MB.bigSpriteUrl('m-chan', role, null)));
    // battles wait for any of these still loading when the timeout below started the game (not the wall's
    // portraits: a battle doesn't need them, and decoding them all again at every battle start was a stall)
    MB.bootImages = urls.slice();
    // everyone's portrait too: it fills the loading screen's wall of faces
    const faces = new Map(MB.manifest.characters.map((c) => [MB.spriteSrc(c.sprites.idle), c.id]));
    faces.forEach((id, u) => urls.push(u));
    const bar = document.querySelector('#loading i');
    const label = document.querySelector('#loading').firstElementChild, wall = document.querySelector('#loading .ld-sprites');
    // the wall of faces: a grid of square tiles, each portrait popping into a free spot (random order) as it arrives;
    // once the wall is full, new arrivals replace tiles
    const cols = 16, tw = window.innerWidth / cols, rows = Math.ceil(window.innerHeight / tw), spots = cols * rows;
    const tiles = [], fill = ['#3a1f6e', '#5a1f4e', '#1f3a6e', '#1f5a4e'];
    let shownN = 0;
    const all = MB.preloadImages(urls, (f, img, n, total) => {
      bar.style.width = f * 100 + '%';
      label.textContent = `Loading sprites… ${n}/${total}`;
      if (!img || !faces.has(img.getAttribute('src'))) return;
      const i = (shownN++ * 67) % spots;
      let t = tiles[i];
      if (!t) {
        t = tiles[i] = document.createElement('div');
        Object.assign(t.style, { left: (i % cols) * tw + 'px', top: Math.floor(i / cols) * tw + 'px', width: tw - 4 + 'px', height: tw - 4 + 'px', backgroundColor: fill[i % 4] });
        wall.appendChild(t);
      }
      t.style.backgroundImage = `url("${img.src}")`;
      gsap.fromTo(t, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' });
    });
    const rest = [];
    MB.manifest.characters.forEach((c) => { if (!first.has(c.id)) rest.push(...MB.charImages(c.id)); });
    // images come from the bucket over the network: a stalled request mustn't keep the game from starting
    return Promise.race([all, new Promise((res) => setTimeout(res, 30000))]).then(() => { MB.preloadBackground(rest); });
  }

  // offline support; service workers don't run from file://, so opening index.html directly still works without it
  const sw = 'serviceWorker' in navigator && location.protocol !== 'file:'
    ? navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).catch((e) => console.warn('Offline mode unavailable:', e))
    : Promise.resolve();

  window.addEventListener('DOMContentLoaded', async () => {
    fit();
    await preload();
    // the offline copy of everything else downloads after the sprites, so the two don't share the bandwidth
    if (!MB.Maker) sw.then((reg) => reg && reg.active.postMessage({ precache: true, small: MB.SMALL_SPRITES, nsfw: MB.NSFW }));
    MB.view = new MB.View();
    MB.UI.bind();
    // browsers only allow music after a user gesture, so the title waits for one click/key
    const load = document.getElementById('loading'), label = load.firstElementChild;
    label.textContent = 'Click anywhere to start';
    load.classList.add('ready');
    if (MB.Maker) MB.Maker.waiting();
    const pulse = gsap.to(label, { opacity: 0.35, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await new Promise((res) => {
      const go = () => { window.removeEventListener('keydown', go); load.removeEventListener('pointerdown', go); res(); };
      load.addEventListener('pointerdown', go);
      window.addEventListener('keydown', go);
    });
    pulse.kill();
    MB.audio.unlock();
    if (MB.Maker) MB.Maker.start(); else MB.UI.start();
    // kept for the battle loading screen (ui.js)
    gsap.to(load, { opacity: 0, duration: 0.5, onComplete: () => { load.querySelector('.ld-sprites').innerHTML = ''; load.classList.add('hidden'); load.classList.remove('ready'); gsap.set(label, { opacity: 1 }); } });
  });
})();
