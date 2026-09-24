// Collecting: card fragments from packs, and the profile pictures won in Story.
// Works on a save's { unlocked, shards, avatars, progress } and nothing else, so tools/check_game.js can
// simulate opening packs.
window.MB = window.MB || {};
(function () {
  const deckCards = () => Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token);
  const rarityOf = (id) => MB.RARITY[MB.CARDS[id].rarity];
  // fragments that unlock a card
  const need = (id) => rarityOf(id).shards || 1;
  const owned = (s, id) => s.unlocked.includes(id);
  const locked = (s) => deckCards().filter((id) => !owned(s, id));
  // when a pack picks a card, it goes for one you've already started this often, so fragments add up
  const FOCUS = 0.75;

  const pickFrom = (list, rng) => list[Math.floor(rng() * list.length)];

  // a locked card of at least minStars (or any locked one), rarity chosen by weight
  function rollCard(s, minStars, rng) {
    let pool = locked(s).filter((id) => rarityOf(id).stars >= minStars);
    if (!pool.length) pool = locked(s);
    if (!pool.length) return null;
    const groups = {};
    pool.forEach((id) => (groups[MB.CARDS[id].rarity] = groups[MB.CARDS[id].rarity] || []).push(id));
    const rs = Object.keys(groups), total = rs.reduce((t, r) => t + MB.RARITY[r].weight, 0);
    let x = rng() * total, r = rs[rs.length - 1];
    for (const k of rs) { x -= MB.RARITY[k].weight; if (x <= 0) { r = k; break; } }
    const started = groups[r].filter((id) => s.shards[id] > 0);
    return pickFrom(started.length && rng() < FOCUS ? started : groups[r], rng);
  }

  // adds n fragments of a card; unlocks it once complete (extra fragments are lost)
  function addShards(s, id, n) {
    const from = s.shards[id] || 0, to = Math.min(need(id), from + n);
    if (to >= need(id)) { delete s.shards[id]; s.unlocked.push(id); } else s.shards[id] = to;
    return { from, to };
  }

  // opens one pack of this tier into the save: [{ card, from, to, need, done }], one entry per card,
  // least rare first and completed cards last
  function openPack(s, tier, rng = Math.random) {
    const got = new Map();
    MB.PACKS[tier].slots.forEach((slot) => {
      const id = rollCard(s, slot === 'card' ? 0 : MB.RARITY[slot].stars, rng);
      if (!id) return;
      const { from, to } = addShards(s, id, MB.SHARD_DROP[slot] || 1);
      const g = got.get(id);
      if (g) g.to = to; else got.set(id, { card: id, from, to, need: need(id) });
    });
    const out = [...got.values()];
    out.forEach((g) => { g.done = g.to >= g.need; });
    return out.sort((a, b) => a.done - b.done || rarityOf(a.card).stars - rarityOf(b.card).stars);
  }

  // ---------------------------------------------------------------- profile pictures
  // Every picture is won in Story: a rival's own picture comes with beating them, the others are shared out
  // over all the stages in order. Depends only on the lists, so a save just remembers which stages it cleared.
  const stageAvatars = MB.STORY.map(() => []), avatarStage = {};
  (function share() {
    const left = MB.AVATARS.map((a) => a.id).filter((id) => id !== MB.STARTER_AVATAR);
    // NSFW chapters give none, so every picture can be won the same way in either mode
    const take = (i, id) => { stageAvatars[i].push(id); avatarStage[id] = i; left.splice(left.indexOf(id), 1); };
    MB.STORY.forEach((st, i) => {
      if (MB.CHAPTERS[st.chapter].nsfw) return;
      const first = st.foe.split('-')[0];
      left.filter((id) => id === st.foe || (first.length >= 3 && (id === first || id.startsWith(first + '-')))).forEach((id) => take(i, id));
    });
    const open = MB.STORY.map((st, i) => i).filter((i) => !MB.CHAPTERS[MB.STORY[i].chapter].nsfw);
    let i = 0;
    while (left.length) { take(open[i % open.length], left[0]); i++; }
  })();

  // the stages cleared in a save, as indexes into MB.STORY
  function clearedStages(s) {
    const seen = {};
    return MB.STORY.map((st, i) => ((seen[st.chapter] = (seen[st.chapter] || 0) + 1) <= (s.progress[st.chapter] || 0) ? i : -1)).filter((i) => i >= 0);
  }
  // gives the pictures of every cleared stage; returns the new ones
  function grantStoryAvatars(s) {
    const fresh = [];
    clearedStages(s).forEach((i) => stageAvatars[i].forEach((id) => { if (!s.avatars.includes(id)) { s.avatars.push(id); fresh.push(id); } }));
    return fresh;
  }

  MB.Collection = { deckCards, need, locked, rollCard, addShards, openPack, stageAvatars, avatarStage, clearedStages, grantStoryAvatars };
})();
