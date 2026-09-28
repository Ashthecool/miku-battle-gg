// NSFW mode (⚙️ → NSFW mode, 18+). The manifest tags NSFW outfits, backgrounds, items, music, whole characters
// and whole novels with `nsfw` (tools/fetch_assets.py). With the mode off, this removes them and whatever is built
// on them (cards, powers, bonds, Story chapters) before the rest of the game reads the data. Switching reloads.
// Runs right after data.js.
window.MB = window.MB || {};
(function () {
  if (MB.NSFW == null) {
    try { MB.NSFW = localStorage.getItem('mb-nsfw') === '1'; } catch (e) { MB.NSFW = false; }
  }
  MB.setNsfw = (on) => {
    try { localStorage.setItem('mb-nsfw', on ? '1' : '0'); } catch (e) { /* not remembered */ }
    location.reload();
  };

  const M = window.MIKU_MANIFEST;
  const novels = new Set(M.nsfwNovels || []);
  const nsfw = (x) => !!x.nsfw || novels.has(x.novel);
  const chars = new Set(M.characters.filter(nsfw).map((c) => c.id));
  // Story chapters fought by NSFW characters, in either mode (collection.js keeps profile pictures off them)
  MB.CHAPTERS.forEach((ch, i) => { ch.nsfw = MB.STORY.some((st) => st.chapter === i && chars.has(st.foe)); });
  // cards taken out this session; saves keep them (ui.js) so they come back when the mode is switched on
  MB.HIDDEN_CARDS = new Set();
  if (MB.NSFW) return;

  const items = new Set(M.items.filter(nsfw).map((i) => i.id));
  M.characters = M.characters.filter((c) => !chars.has(c.id));
  M.characters.forEach((c) => { c.costumes = c.costumes.filter((o) => !o.nsfw); });
  M.items = M.items.filter((i) => !items.has(i.id));
  M.backgrounds = M.backgrounds.filter((b) => !nsfw(b));
  M.music = M.music.filter((m) => !nsfw(m));
  M.novels = M.novels.filter((n) => !novels.has(n));

  Object.keys(MB.CARDS).forEach((id) => {
    if (!chars.has(id) && !items.has(id)) return;
    MB.HIDDEN_CARDS.add(id);
    delete MB.CARDS[id];
    delete MB.POWERS[id];
  });
  // a bond needs both partners; an NSFW costume falls back to the usual outfit
  const byId = new Map(M.characters.map((c) => [c.id, c]));
  MB.BONDS = MB.BONDS.filter((b) => {
    if (b.pair.every((id) => byId.has(id))) return true;
    delete MB.BOND_SCENES[b.id];
    return false;
  });
  MB.BONDS.forEach((b) => {
    b.costumes = b.costumes.map((cos, i) => (cos && byId.get(b.pair[i]).costumes.some((o) => o.id === cos) ? cos : null));
  });
  // a combo needs its character and at least one of its items
  MB.COMBOS = MB.COMBOS.filter((c) => {
    c.items = c.items.filter((id) => MB.CARDS[id]);
    return byId.has(c.char) && c.items.length;
  });
  MB.COMBOS.forEach((c) => { if (c.costume && !byId.get(c.char).costumes.some((o) => o.id === c.costume)) delete c.costume; });
  // hidden chapters stay in MB.CHAPTERS / MB.STORY so stage indexes (and the saves that count them) don't move
  MB.CHAPTERS.forEach((ch) => { ch.hidden = ch.nsfw; });
  MB.STARTER_CARDS = MB.STARTER_CARDS.filter((id) => MB.CARDS[id]);
  MB.STARTER_LEADERS = MB.STARTER_LEADERS.filter((id) => byId.has(id));
})();
