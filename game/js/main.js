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

  function preload() {
    const urls = new Set();
    MB.manifest.characters.forEach((c) => Object.values(c.sprites).forEach((s) => urls.add(MB.spriteSrc(s))));
    MB.manifest.items.forEach((i) => urls.add(MB.asset(i.icon)));
    Object.keys(MB.PACKS).forEach((t) => urls.add(MB.packArt(t)));
    urls.add(MB.avatarUrl(MB.UI.save.avatar));
    // fusion costumes and the wardrobe picks, so outfit changes don't pop in
    const costume = (id, cos) => { const o = cos && byId.get(id).costumes.find((x) => x.id === cos); if (o) Object.values(o.sprites).forEach((s) => urls.add(MB.spriteSrc(s))); };
    MB.BONDS.forEach((b) => b.pair.forEach((id, i) => costume(id, b.costumes[i])));
    Object.entries(MB.UI.save.costumes).forEach(([id, cos]) => byId.has(id) && costume(id, cos));
    const list = [...urls];
    let done = 0;
    const bar = document.querySelector('#loading i');
    const all = Promise.all(list.map((u) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => { done++; bar.style.width = (done / list.length) * 100 + '%'; res(); };
      img.src = u;
    })));
    // images come from the bucket over the network: a stalled request mustn't keep the game from starting
    return Promise.race([all, new Promise((res) => setTimeout(res, 20000))]);
  }

  // offline support; service workers don't run from file://, so opening index.html directly still works without it
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active.postMessage({ precache: true, small: MB.SMALL_SPRITES }))
      .catch((e) => console.warn('Offline mode unavailable:', e));
  }

  window.addEventListener('DOMContentLoaded', async () => {
    fit();
    await preload();
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
    gsap.to(load, { opacity: 0, duration: 0.5, onComplete: () => load.remove() });
  });
})();
