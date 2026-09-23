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
  }
  window.addEventListener('resize', fit);
  fit();

  // decoded images stay referenced here so the browser keeps them ready: nothing has to be fetched or
  // decoded the first time a sprite shows up mid-battle
  const images = new Map(); // url -> promise of the decoded Image
  MB.preloadImages = (urls, onProgress) => {
    const list = [...new Set(urls)].filter(Boolean);
    let done = 0;
    return Promise.all(list.map((u) => {
      let p = images.get(u);
      if (!p) {
        const img = new Image();
        img.src = u;
        p = img.decode().then(() => img, () => { images.delete(u); }); // a failed one is tried again next time
        images.set(u, p);
      }
      return p.then(() => { done++; if (onProgress) onProgress(done / list.length); });
    }));
  };

  // every character's sprites in the size the board uses, in the outfit they wear (the usual one, or the
  // wardrobe's pick) and in their relationship costumes so fusions don't pop in; item icons, pack art and the
  // profile picture. Other costumes load when first shown; each battle adds its background and close-ups (ui.js)
  function preload() {
    const urls = [];
    const sprites = (set) => Object.values(set).forEach((s) => urls.push(MB.spriteSrc(s)));
    const costume = (c, id) => id && c && c.costumes.find((o) => o.id === id);
    MB.manifest.characters.forEach((c) => {
      sprites(c.sprites);
      const worn = costume(c, MB.UI.save.costumes[c.id]);
      if (worn) sprites(worn.sprites);
    });
    MB.BONDS.forEach((bd) => bd.pair.forEach((id, i) => { const o = costume(MB.charById(id), bd.costumes[i]); if (o) sprites(o.sprites); }));
    MB.manifest.items.forEach((i) => urls.push(MB.asset(i.icon)));
    Object.keys(MB.PACKS).forEach((t) => urls.push(MB.packArt(t)));
    urls.push(MB.avatarUrl(MB.UI.save.avatar));
    MB.bootImages = urls; // battles wait for any of these still loading when the timeout below started the game
    const bar = document.querySelector('#loading i');
    const all = MB.preloadImages(urls, (f) => { bar.style.width = f * 100 + '%'; });
    // images come from the bucket over the network: a stalled request mustn't keep the game from starting
    return Promise.race([all, new Promise((res) => setTimeout(res, 30000))]);
  }

  // offline support; service workers don't run from file://, so opening index.html directly still works without it
  const sw = 'serviceWorker' in navigator && location.protocol !== 'file:'
    ? navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).catch((e) => console.warn('Offline mode unavailable:', e))
    : Promise.resolve();

  window.addEventListener('DOMContentLoaded', async () => {
    fit();
    await preload();
    // the offline copy of everything else downloads after the sprites, so the two don't share the bandwidth
    sw.then((reg) => reg && reg.active.postMessage({ precache: true, small: MB.SMALL_SPRITES }));
    MB.view = new MB.View();
    MB.UI.bind();
    // browsers only allow music after a user gesture, so the title waits for one click/key
    const load = document.getElementById('loading'), label = load.firstElementChild;
    label.textContent = 'Click anywhere to start';
    load.classList.add('ready');
    const pulse = gsap.to(label, { opacity: 0.35, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await new Promise((res) => {
      const go = () => { window.removeEventListener('keydown', go); load.removeEventListener('pointerdown', go); res(); };
      load.addEventListener('pointerdown', go);
      window.addEventListener('keydown', go);
    });
    pulse.kill();
    MB.audio.unlock();
    MB.UI.title();
    // kept for the battle loading screen (ui.js)
    gsap.to(load, { opacity: 0, duration: 0.5, onComplete: () => { load.classList.add('hidden'); load.classList.remove('ready'); gsap.set(label, { opacity: 1 }); } });
  });
})();
