// Collecting: card fragments from packs, the Shop and first Story wins (never a whole card at once), card levels, and
// the profile pictures won in Story.
// Works on a save's { unlocked, shards, levels, avatars, quests } and nothing else, so tools/check_game.js can
// simulate opening packs.
// s.shards[id] holds a locked card's fragments toward unlocking it, then an owned character's banked fragments toward
// its next levels (spent with levelUp).
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
  // when a pack slot could go either way, it picks a card you don't own this often (else one you can level up)
  const NEW_CARD = 0.8;

  const pickFrom = (list, rng) => list[Math.floor(rng() * list.length)];

  // Roll the starting commons after content filtering, keeping the original deck's costs and unit/item mix.
  // Each distinct template card becomes a distinct common, with the same number of copies.
  function starterDeck(rng = Math.random) {
    const pool = deckCards().filter((id) => MB.CARDS[id].rarity === 'common');
    const counts = new Map(), replacements = new Map(), used = new Set();
    MB.STARTER_DECK.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    counts.forEach((n, id) => {
      const template = MB.CARDS[id];
      const choices = pool.filter((cid) => {
        const c = MB.CARDS[cid];
        return !used.has(cid) && c.cost === template.cost && (c.type || 'unit') === (template.type || 'unit')
          && (c.copies || MB.RARITY.common.copies) >= n;
      });
      if (!choices.length) throw new Error(`No starting common for ${id}`);
      const chosen = pickFrom(choices, rng);
      replacements.set(id, chosen);
      used.add(chosen);
    });
    return MB.STARTER_DECK.map((id) => replacements.get(id));
  }

  // ---------------------------------------------------------------- levels
  const L = MB.LEVELS;
  // character cards level up; items and tokens don't
  const levels = (id) => { const c = MB.CARDS[id]; return !!c && !c.token && (c.type || 'unit') === 'unit' && !!L.cost[c.rarity]; };
  // Lv 1..max for a card you own, 0 for one you don't
  const level = (s, id) => (owned(s, id) ? Math.min(L.max, Math.max(1, (s.levels && s.levels[id]) | 0)) : 0);
  const maxed = (s, id) => levels(id) && level(s, id) >= L.max;
  // fragments from Lv lv to the next one (0 at the top)
  const stepCost = (id, lv) => (levels(id) && lv >= 1 && lv < L.max ? L.cost[MB.CARDS[id].rarity][lv - 1] : 0);
  const upCost = (s, id) => (owned(s, id) ? stepCost(id, level(s, id)) : 0);
  // fragments from Lv lv all the way to the top
  const toMax = (id, lv) => { let n = 0; for (let k = Math.max(1, lv); k < L.max; k++) n += stepCost(id, k); return n; };
  // how many more fragments a card can take: what it still needs to unlock, or to reach the top level
  const room = (s, id) => {
    if (!MB.CARDS[id] || MB.CARDS[id].token) return 0;
    const have = s.shards[id] || 0;
    return owned(s, id) ? (levels(id) ? Math.max(0, toMax(id, level(s, id)) - have) : 0) : need(id) - have;
  };
  // owned characters that can still level up
  const growing = (s) => s.unlocked.filter((id) => room(s, id) > 0);
  // [ATK, HP] a card has gained by Lv lv
  const gainAt = (id, lv) => {
    const g = [0, 0];
    if (levels(id)) L.gain[MB.CARDS[id].rarity].slice(0, Math.max(0, Math.min(L.max, lv) - 1)).forEach(([a, h]) => { g[0] += a; g[1] += h; });
    return g;
  };
  // a card definition (MB.cardDef) at Lv lv: its stats grown, and .level set
  function leveled(def, lv) {
    if (!(lv > 1) || !levels(def.id)) return def;
    const [a, h] = gainAt(def.id, lv);
    return { ...def, atk: def.atk + a, hp: def.hp + h, level: Math.min(L.max, lv) };
  }
  // spends banked fragments on the next level; returns { from, to } levels, or null when it can't
  function levelUp(s, id) {
    const cost = upCost(s, id), have = s.shards[id] || 0;
    if (!cost || have < cost) return null;
    const from = level(s, id);
    if (have > cost) s.shards[id] = have - cost; else delete s.shards[id];
    s.levels = s.levels || {};
    s.levels[id] = from + 1;
    return { from, to: from + 1 };
  }
  // true once there's nothing left to collect: every card owned and every character at the top level
  const finished = (s) => !locked(s).length && !growing(s).length;

  // a card of at least minStars (or any) to give fragments of, rarity chosen by weight: one you don't own yet, or an
  // owned character that can still level up
  function rollCard(s, minStars, rng) {
    const atLeast = (p) => p.filter((id) => rarityOf(id).stars >= minStars);
    const lk = locked(s), gr = growing(s), a = atLeast(lk), b = atLeast(gr);
    const pool = a.length && b.length ? (rng() < NEW_CARD ? a : b) : a.length ? a : b.length ? b : lk.length ? lk : gr;
    if (!pool.length) return null;
    const groups = {};
    pool.forEach((id) => (groups[MB.CARDS[id].rarity] = groups[MB.CARDS[id].rarity] || []).push(id));
    const rs = Object.keys(groups), total = rs.reduce((t, r) => t + MB.RARITY[r].weight, 0);
    let x = rng() * total, r = rs[rs.length - 1];
    for (const k of rs) { x -= MB.RARITY[k].weight; if (x <= 0) { r = k; break; } }
    const started = groups[r].filter((id) => s.shards[id] > 0);
    return pickFrom(started.length && rng() < FOCUS ? started : groups[r], rng);
  }

  // adds n fragments of a card. A locked card unlocks once complete and the fragments past that go to its levels.
  // Returns { from, to, extra }: from/to count toward unlocking, or toward the level bank (up: true, when the card was
  // owned already); extra: the fragments nothing could use (they become Glitter)
  function addShards(s, id, n) {
    if (owned(s, id)) {
      const from = s.shards[id] || 0, k = Math.min(n, room(s, id)), to = from + k;
      if (to) s.shards[id] = to;
      return { from, to, extra: n - k, up: true };
    }
    const from = s.shards[id] || 0, to = Math.min(need(id), from + n);
    let extra = from + n - to;
    if (to >= need(id)) {
      delete s.shards[id];
      s.unlocked.push(id);
      if (extra) extra = addShards(s, id, extra).extra;
    } else s.shards[id] = to;
    return { from, to, extra };
  }
  // an entry for the pack haul and result tiles: { card, from, to, need, done } toward unlocking, or
  // { card, up: true, from, to, need, level } toward the next level (need: its cost, 0 at the top)
  const entry = (s, id, r) => (r.up ? { card: id, up: true, from: r.from, to: r.to, need: upCost(s, id), level: level(s, id) }
    : { card: id, from: r.from, to: r.to, need: need(id), done: r.to >= need(id) });

  // Story: the first win over a rival gives about a third of their card in fragments, never a whole card on its own
  const storyShards = (id) => (MB.CARDS[id] && !MB.CARDS[id].token && need(id) > 1 ? Math.min(need(id) - 1, Math.max(1, Math.round(need(id) / 3))) : 0);
  // adds them to the save: { card, from, to, need, done, extra } (done: they finished the card), or null if the card
  // is owned already or has none to give
  function grantStoryShards(s, id) {
    const n = storyShards(id);
    if (!n || owned(s, id)) return null;
    const r = addShards(s, id, n);
    return { ...entry(s, id, r), extra: r.extra };
  }

  // opens one pack of this tier into the save: one entry per card (see entry), least rare first and completed cards
  // last; .extra on the list counts the fragments nothing could use
  function openPack(s, tier, rng = Math.random) {
    const got = new Map();
    let extra = 0;
    MB.PACKS[tier].slots.forEach((slot) => {
      const id = rollCard(s, slot === 'card' ? 0 : MB.RARITY[slot].stars, rng);
      if (!id) return;
      const r = addShards(s, id, MB.SHARD_DROP[slot] || 1);
      extra += r.extra;
      const g = got.get(id);
      // a card this pack already unlocked keeps its "new card" entry
      if (!g) got.set(id, entry(s, id, r));
      else if (!!g.up === !!r.up) Object.assign(g, entry(s, id, { ...r, from: g.from }));
    });
    const out = [...got.values()];
    out.sort((a, b) => !!a.done - !!b.done || rarityOf(a.card).stars - rarityOf(b.card).stars);
    out.extra = extra;
    return out;
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
  const clearedStages = (s) => MB.Story.clearedStages(s);
  // gives the pictures of every cleared stage; returns the new ones
  function grantStoryAvatars(s) {
    const fresh = [];
    clearedStages(s).forEach((i) => stageAvatars[i].forEach((id) => { if (!s.avatars.includes(id)) { s.avatars.push(id); fresh.push(id); } }));
    return fresh;
  }

  MB.Collection = { deckCards, starterDeck, need, locked, rollCard, addShards, openPack, storyShards, grantStoryShards, stageAvatars, avatarStage, clearedStages, grantStoryAvatars,
    entry, levels, level, maxed, stepCost, upCost, toMax, room, growing, gainAt, leveled, levelUp, finished };
})();
