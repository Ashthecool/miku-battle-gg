// Card Maker bridge. maker.html shows the game in a frame opened with ?maker: the game then boots straight into the
// Attack Gallery (main.js) with its panel hidden, and the maker drives it with postMessage. It sends the characters,
// cards and relationships it builds from a miku.gg export ('load'), then asks for an attack, a close-up entrance or a
// relationship scene. Maker ids start with 'mk-' so they never replace a character that is already in the game.
// Replies go to the parent as { mb: 'maker', type: 'ready' | 'done' | 'error', ... }.
(function () {
  if (!/[?&]maker\b/.test(location.search)) return;
  const chars = new Map(); // maker characters, in the manifest's shape (sprites are full URLs)
  const post = (msg) => parent.postMessage({ mb: 'maker', ...msg }, '*');
  const G = () => MB.UI.gallery;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // what the editor's pickers offer, read from the running game so they always match it
  function meta() {
    const styles = Object.keys(MB.FX.styles).sort();
    return {
      styles: styles.filter((s) => !MB.FX.duoStyles.includes(s)), duoStyles: MB.FX.duoStyles.slice().sort(),
      skies: MB.FX.skies, moves: Object.keys(MB.FX.recipe.moves), fx: Object.keys(MB.FX.recipe.fx), floors: Object.keys(MB.FX.recipe.floors),
      keywords: MB.KEYWORDS, rarities: Object.keys(MB.RARITY).filter((r) => MB.RARITY[r].weight), tiers: MB.BOND_TIERS,
      variants: MB.Cards.sceneVariants, backdrops: MB.Cards.backdrops, introMoves: Object.keys(MB.Cards.moves),
      intros: [...new Set([...Object.keys(MB.Cards.intros), ...Object.keys(MB.Cards.styleIntros)])].sort(),
    };
  }

  // replace the maker's previous characters, cards and relationships with the ones sent
  function load(d) {
    chars.clear();
    (d.chars || []).forEach((c) => chars.set(c.id, c));
    Object.keys(MB.CARDS).filter((id) => id.startsWith('mk-')).forEach((id) => delete MB.CARDS[id]);
    Object.assign(MB.CARDS, d.cards || {});
    MB.BONDS = MB.BONDS.filter((b) => !b.id.startsWith('mk-'));
    Object.keys(MB.BOND_SCENES).filter((id) => id.startsWith('mk-')).forEach((id) => delete MB.BOND_SCENES[id]);
    // maker relationships first: the gallery fuses the first bond whose pair is on the board
    MB.BONDS.unshift(...(d.bonds || []));
    Object.assign(MB.BOND_SCENES, d.scenes || {});
  }

  // the sprites a preview will show, decoded before it starts (a slow CDN gets 8 s)
  function ready(ids, big) {
    const urls = [];
    ids.forEach(({ id, costume }) => {
      const c = chars.get(id);
      if (!c) return;
      const o = costume && c.costumes.find((x) => x.id === costume);
      Object.values((o || c).sprites).forEach((u) => urls.push(u));
    });
    return Promise.race([MB.preloadImages(big ? urls : urls.map((u) => MB.spriteSrc(u))), wait(8000)]);
  }

  // the gallery ignores clicks while an animation runs: wait for it
  async function idle() {
    for (let i = 0; G().busy() && i < 400; i++) await wait(50);
  }
  function closeUp(unit, stats) {
    const uEl = document.querySelector(`.unit[data-uid="${unit.uid}"]`);
    MB.Cards.open(unit.card, uEl && uEl.querySelector('.duo-sprite, .sprite, .emoji-sprite'), stats);
  }

  // what a board unit was summoned as: replays skip the summon (and a relationship's fusion) while it still matches
  const looks = (ids) => JSON.stringify(ids.map(({ id, costume }) => [(chars.get(id) || {}).sprites, costume || null]));
  // the unit takes the edited card: stats, keywords and attack
  function refresh(u, card) {
    Object.assign(u, { card, name: card.name, atk: card.atk, hp: card.hp, maxHp: card.hp, kw: new Set(card.kw), shield: card.kw.includes('shield') });
    MB.view.refresh();
  }

  const commands = {
    load,
    // show a character on the board
    async show({ id }) {
      await ready([{ id }]);
      await idle();
      const u = G().unit(), look = looks([{ id }]);
      if (u && !u.card.fused && u.card.id === id && u.makerLook === look) return refresh(u, MB.cardDef(id));
      await G().pick(id, null);
      if (G().unit()) G().unit().makerLook = look;
    },
    async attack({ id }) {
      await commands.show({ id });
      await G().attack();
    },
    // the card close-up: its entrance, quote and card
    async closeup({ id }) {
      await ready([{ id }], true);
      await commands.show({ id });
      const u = G().unit();
      if (u) closeUp(u, { atk: u.atk, hp: u.hp });
    },
    // a relationship: the partners fuse, then its scene (the fused card's close-up), its duo attack or nothing ('fuse')
    async bond({ id, mode }) {
      const bond = MB.BONDS.find((b) => b.id === id);
      if (!bond) throw new Error('Unknown relationship ' + id);
      MB.BONDS = [bond, ...MB.BONDS.filter((b) => b !== bond)];
      const who = bond.pair.map((p, i) => ({ id: p, costume: bond.costumes[i] }));
      await ready(who.map((w) => ({ id: w.id })).concat(who));
      if (mode === 'scene') await ready(who, true);
      await idle();
      let u = G().unit();
      const look = looks(who);
      if (u && u.card.fused && u.card.bond.id === id && u.makerLook === look) {
        // the stats a fusion would give (engine.js fuse)
        const kw = bond.kw.slice(), [a, b] = bond.pair.map((p) => MB.cardDef(p));
        const atk = Math.max(0, a.atk + b.atk + bond.bonus[0]), hp = a.hp + b.hp + bond.bonus[1];
        Object.assign(u.card, { bond, name: bond.name, text: bond.text, attack: bond.attack, kw, atk, hp });
        Object.assign(u, { name: bond.name, kw: new Set(kw), atk, hp, maxHp: hp });
        MB.view.refresh();
      } else {
        await G().bond(bond, null);
        u = G().unit();
        if (!u) return;
        u.makerLook = look;
      }
      if (mode === 'scene') closeUp(u, { atk: u.atk, hp: u.hp });
      else if (mode === 'attack') await G().attack();
    },
    close() { return MB.Cards.close(); },
    // a song from the novel (streamed from the miku.gg CDN), the gallery's own ('theme') or none
    music({ url }) {
      if (url === 'theme') return MB.audio.music(MB.MUSIC.gallery);
      if (!url) return MB.audio.music(null);
      let t = MB.manifest.music.find((m) => m.url === url && m.id.startsWith('mk-'));
      if (!t) MB.manifest.music.push(t = { id: 'mk-' + MB.manifest.music.length, name: 'Card Maker', tags: [], url });
      MB.audio.music(t.id);
    },
    // the stage backdrop: a background of the novel, or the gallery's gym
    bg({ url }) { MB.UI.setBg(url || MB.asset(MB.UI.bgByName('Gym Class').src)); },
  };

  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || m.mb !== 'maker-cmd' || !commands[m.type]) return;
    try {
      if (['show', 'attack', 'closeup', 'bond'].includes(m.type)) await MB.Cards.close();
      await commands[m.type](m);
      post({ type: 'done', cmd: m.type, seq: m.seq });
    } catch (err) {
      console.error(err);
      post({ type: 'error', cmd: m.type, seq: m.seq, message: String(err && err.message || err) });
    }
  });

  MB.Maker = {
    // main.js: the stage waits for a click (browsers only play sound after one)
    waiting() { post({ type: 'waiting' }); },
    // main.js calls this instead of showing the title screen
    start() {
      const base = MB.charById;
      MB.charById = (id) => chars.get(id) || base(id);
      // maker cards are never locked in your collection
      const unlocked = MB.UI.isUnlocked;
      MB.UI.isUnlocked = (id) => chars.has(id) || unlocked(id);
      document.body.classList.add('maker');
      G().open();
      post({ type: 'ready', meta: meta() });
    },
  };
  // the maker page shows its own controls
  const css = document.createElement('style');
  css.textContent = 'body.maker #gallery-panel { display: none; }';
  document.head.appendChild(css);
  // the pickers are filled before the stage is started (every script it reads has run by now)
  post({ type: 'meta', meta: meta() });
})();
