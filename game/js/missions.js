// Daily missions and Glitter ✨. Missions count what you do in battle (Battle.tally) and pay out Glitter, which also
// comes from every win and from pack fragments no card could use. Glitter crafts fragments of a card you pick (to
// unlock it or level it up), buys the Shop's daily deals and packs, or makes a card you own Shiny. Works on a save's
// { glitter, missions, shop, shiny, unlocked, shards, levels, packs, leaders, decks } only, so tools/check_game.js can
// simulate it.
window.MB = window.MB || {};
(function () {
  const G = MB.GLITTER = {
    win: 5,        // every win
    complete: 25,  // a win once every card is collected and maxed (instead of a pack)
    extra: 10,     // each pack fragment no card could use
    craft: { common: 12, rare: 20, epic: 30, legendary: 45 },    // one fragment
    shiny: { common: 60, rare: 120, epic: 240, legendary: 480 },  // a Shiny finish on a card you own
    // the Shop: `deals` fragment bundles a day (`bundle` fragments of one card, `off` cheaper than crafting them), and packs
    shop: { deals: 6, off: 0.3, bundle: { common: 3, rare: 3, epic: 2, legendary: 2 }, packs: { common: 45, rare: 110, epic: 220 } },
  };
  const PER_DAY = 3;
  const pick = (a) => a[Math.random() * a.length | 0];

  const has = (s, id) => s.unlocked.includes(id);
  // Missions: text ({n}, {novel}), how many (n), the reward, and count(tally, battle cfg, won, mission): the progress
  // one battle makes. `novel` picks a novel when the mission is rolled (of a leader you have, or of 5+ cards you own);
  // can(save) keeps it out of the roll when you couldn't do it.
  MB.MISSIONS = {
    win:        { text: 'Win {n} battles', n: 2, glitter: 60, count: (t, cfg, won) => (won ? 1 : 0) },
    winHard:    { text: 'Win a battle on Hard', n: 1, glitter: 80, count: (t, cfg, won) => (won && cfg.difficulty === 'hard' ? 1 : 0) },
    leader:     { text: 'Win with a leader from {novel}', n: 1, glitter: 70, novel: 'leader',
      count: (t, cfg, won, m) => (won && MB.novelOf(cfg.leader) === m.novel ? 1 : 0) },
    novelCards: { text: 'Play {n} cards from {novel}', n: 10, glitter: 50, novel: 'cards', count: (t, cfg, won, m) => t.novel[m.novel] || 0 },
    bonds:      { text: 'Fuse {n} relationships', n: 2, glitter: 50, can: (s) => MB.BONDS.some((b) => b.pair.every((id) => has(s, id))), count: (t) => t.bonds },
    combos:     { text: 'Make an item combo', n: 1, glitter: 60, can: (s) => MB.COMBOS.some((c) => has(s, c.char) && c.items.some((id) => has(s, id))), count: (t) => t.combos },
    items:      { text: 'Play {n} item cards', n: 6, glitter: 40, count: (t) => t.items },
    big:        { text: 'Play {n} cards that cost 5 or more', n: 5, glitter: 40, count: (t) => t.big },
    kills:      { text: 'Destroy {n} enemy monsters', n: 15, glitter: 40, count: (t) => t.kills },
    face:       { text: 'Deal {n} damage to enemy leaders', n: 50, glitter: 40, count: (t) => t.face },
    heal:       { text: 'Restore {n} HP to your side', n: 25, glitter: 40, count: (t) => t.healed },
    attacks:    { text: 'Attack {n} times', n: 30, glitter: 30, count: (t) => t.attacks },
    powers:     { text: 'Use your leader power {n} times', n: 6, glitter: 30, count: (t) => t.powers },
  };

  // novels a mission can ask for
  function novels(s, kind) {
    const ids = kind === 'leader' ? s.leaders.filter((id) => MB.CARDS[id]) : s.unlocked.filter((id) => MB.CARDS[id] && !MB.CARDS[id].token);
    const n = {};
    ids.forEach((id) => { const nv = MB.novelOf(id); if (nv) n[nv] = (n[nv] || 0) + 1; });
    return Object.keys(n).filter((nv) => kind === 'leader' || n[nv] >= 5);
  }
  // "Legend Of You 1.7 " -> "Legend Of You", "DUMB SUPER FANTASY RPG (1st Part ...)" -> "DUMB SUPER FANTASY RPG"
  const novelName = (nv) => nv.replace(/\s*\(.*\)/, '').replace(/\s+[\d.]+\s*$/, '').trim();

  function roll(s, avoid = []) {
    const taken = new Set([...s.missions.list.map((m) => m.id), ...avoid]);
    const pool = Object.entries(MB.MISSIONS).filter(([id, t]) => !taken.has(id) && (!t.can || t.can(s)) && (!t.novel || novels(s, t.novel).length));
    if (!pool.length) return null;
    const [id, t] = pick(pool), m = { id, n: t.n, have: 0, glitter: t.glitter };
    if (t.novel) m.novel = pick(novels(s, t.novel));
    return m;
  }

  const today = () => new Date().toLocaleDateString('sv'); // local YYYY-MM-DD
  // a new day brings fresh missions (finished ones you haven't claimed stay); true when it rolled
  function daily(s, day = today()) {
    if (s.missions && s.missions.day === day) return false;
    const keep = s.missions ? s.missions.list.filter((m) => m.have >= m.n && !m.claimed) : [];
    s.missions = { day, list: keep, reroll: 1 };
    for (let m; s.missions.list.length < PER_DAY && (m = roll(s));) s.missions.list.push(m);
    return true;
  }

  const text = (m) => MB.MISSIONS[m.id].text.replace('{n}', m.n).replace('{novel}', m.novel ? novelName(m.novel) : '');
  const done = (m) => m.have >= m.n;

  // one battle's progress; returns the missions it finished
  function progress(s, tally, cfg, won) {
    const t = { novel: {}, ...tally }, fresh = [];
    s.missions.list.forEach((m) => {
      if (done(m) || !MB.MISSIONS[m.id]) return;
      m.have = Math.min(m.n, m.have + (MB.MISSIONS[m.id].count(t, cfg, won, m) || 0));
      if (done(m)) fresh.push(m);
    });
    return fresh;
  }
  // pays a finished mission out; returns the Glitter (0 if it can't be claimed)
  function claim(s, i) {
    const m = s.missions.list[i];
    if (!m || !done(m) || m.claimed) return 0;
    m.claimed = true;
    s.glitter += m.glitter;
    return m.glitter;
  }
  // swaps an unfinished mission for another, once a day
  function reroll(s, i) {
    const m = s.missions.list[i];
    if (!m || done(m) || !(s.missions.reroll > 0)) return false;
    const next = roll(s, [m.id]);
    if (!next) return false;
    s.missions.list[i] = next;
    s.missions.reroll--;
    return true;
  }
  const claimable = (s) => (s.missions ? s.missions.list.filter((m) => done(m) && !m.claimed).length : 0);

  // ---------------------------------------------------------------- spending
  const C = MB.Collection;
  // Glitter per fragment of a card that can still use some: a locked one, or a character short of the top level
  // (null: nothing to craft); and for its Shiny finish once you own it
  const craftCost = (s, id) => (MB.CARDS[id] && C.room(s, id) > 0 && G.craft[MB.CARDS[id].rarity]) || null;
  const shinyCost = (s, id) => (MB.CARDS[id] && has(s, id) && !s.shiny.includes(id) && G.shiny[MB.CARDS[id].rarity]) || null;
  // fragments a card still needs for its next step: to unlock it, or for its next level
  const nextStep = (s, id) => (has(s, id) ? Math.max(0, C.upCost(s, id) - (s.shards[id] || 0)) : C.need(id) - (s.shards[id] || 0));
  // crafts up to n fragments (by default what its next step needs); returns { from, to, up?, done } or null
  function craft(s, id, n) {
    const per = craftCost(s, id);
    if (!per) return null;
    const k = Math.min(n || nextStep(s, id) || 1, C.room(s, id), Math.floor(s.glitter / per));
    if (k < 1) return null;
    s.glitter -= k * per;
    const r = C.addShards(s, id, k);
    return { ...r, done: !r.up && has(s, id) };
  }

  // ---------------------------------------------------------------- the Shop
  // A save keeps { shop: { day, deals: [{ card, n, price, bought? }] } }. Each day brings fresh deals, half of them (when
  // it can) on cards you're already after: in one of your decks, or with fragments started.
  const bundle = (id) => G.shop.bundle[MB.CARDS[id].rarity] || 1;
  const dealPrice = (id, n) => Math.round(n * G.craft[MB.CARDS[id].rarity] * (1 - G.shop.off));
  function rollDeals(s) {
    const pool = C.deckCards().filter((id) => G.craft[MB.CARDS[id].rarity] && C.room(s, id) > 0);
    const inDecks = new Set((s.decks || []).flatMap((d) => d.cards || []));
    const keen = pool.filter((id) => inDecks.has(id) || s.shards[id] > 0);
    const out = [], take = (list) => { const id = pick(list.filter((x) => !out.includes(x))); if (id) out.push(id); };
    for (let i = 0; i < G.shop.deals && out.length < pool.length; i++) take(i % 2 === 0 && keen.some((x) => !out.includes(x)) ? keen : pool);
    return out.sort((a, b) => MB.RARITY[MB.CARDS[a].rarity].stars - MB.RARITY[MB.CARDS[b].rarity].stars)
      .map((id) => ({ card: id, n: bundle(id), price: dealPrice(id, bundle(id)) }));
  }
  // a new day brings new deals; true when it rolled
  function shopDaily(s, day = today()) {
    if (s.shop && s.shop.day === day) return false;
    s.shop = { day, deals: rollDeals(s) };
    return true;
  }
  // a deal can be bought once, while its card can still use fragments (a card that needs fewer than the bundle holds
  // gets what it can use, for that share of the price)
  function dealCost(s, d) {
    if (!d || d.bought || !MB.CARDS[d.card]) return null;
    const k = Math.min(d.n, C.room(s, d.card));
    return k < 1 ? null : { k, cost: k === d.n ? d.price : Math.ceil((d.price * k) / d.n) };
  }
  // buys deal i; returns its fragments as a pack-haul entry plus { extra }, or null
  function buyDeal(s, i) {
    const d = s.shop && s.shop.deals[i], c = dealCost(s, d);
    if (!c || s.glitter < c.cost) return null;
    s.glitter -= c.cost;
    d.bought = true;
    const r = C.addShards(s, d.card, c.k);
    return { ...C.entry(s, d.card, r), extra: r.extra };
  }
  // packs for Glitter, while a pack still has something to give
  const packCost = (s, tier) => (!C.finished(s) && G.shop.packs[tier]) || null;
  function buyPack(s, tier) {
    const cost = packCost(s, tier);
    if (!cost || s.glitter < cost) return false;
    s.glitter -= cost;
    s.packs[tier] = (s.packs[tier] | 0) + 1;
    return true;
  }
  function makeShiny(s, id) {
    const cost = shinyCost(s, id);
    if (!cost || s.glitter < cost) return false;
    s.glitter -= cost;
    s.shiny.push(id);
    return true;
  }

  // ---------------------------------------------------------------- Story stars
  // Every Story stage has three stars: a win, a win with your leader at 20+ HP, and a challenge of its own (the stage's
  // index picks it, so neighbouring stages differ). Stars count on Normal and Hard. Each new star pays G.star Glitter;
  // three stars on every stage of a chapter earn an Epic pack, once. A save keeps { stars: { stage: bits }, starChapters }.
  G.star = 15;
  const CHALLENGES = {
    noItems:  { text: 'Win without playing an item card', ok: (r) => !r.tally.items },
    noPower:  { text: 'Win without using your leader power', ok: (r) => !r.tally.powers },
    fast:     { text: 'Win within 11 of your turns', ok: (r) => (r.tally.turns || 0) <= 11 },
    kills:    { text: 'Win and destroy 10 enemy monsters', ok: (r) => (r.tally.kills || 0) >= 10 },
    flawless: { text: 'Win losing 6 monsters or fewer', ok: (r) => (r.tally.lost || 0) <= 6 },
    bond:     { text: 'Win and fuse a relationship', ok: (r) => (r.tally.bonds || 0) > 0 },
  };
  const CH_KEYS = Object.keys(CHALLENGES);
  const HP_STAR = 20;
  // the three stars of stage i: [{ text, ok(result) }]; result = { won, hp (your leader's, at the end), tally, difficulty }
  const starsOf = (i) => [
    { text: 'Win', ok: () => true },
    { text: `Win with your leader at ${HP_STAR}+ HP`, ok: (r) => r.hp >= HP_STAR },
    CHALLENGES[CH_KEYS[(i * 5 + 1) % CH_KEYS.length]],
  ];
  const bits = (n) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
  function starsWon(i, r) {
    if (!r.won || r.difficulty === 'easy') return 0;
    return starsOf(i).reduce((m, st, k) => m | (st.ok(r) ? 1 << k : 0), 0);
  }
  // records a Story battle's stars; returns { fresh (bits), glitter, chapter (index, when it just got fully starred) }
  function awardStars(s, i, r) {
    const had = s.stars[i] | 0, got = starsWon(i, r), fresh = got & ~had;
    s.stars[i] = had | got;
    const glitter = bits(fresh) * G.star;
    s.glitter += glitter;
    const ch = MB.STORY[i].chapter, stages = MB.STORY.map((st, k) => k).filter((k) => MB.STORY[k].chapter === ch);
    let chapter = null;
    if (fresh && !s.starChapters.includes(ch) && stages.every((k) => (s.stars[k] | 0) === 7)) {
      s.starChapters.push(ch);
      s.packs.epic = (s.packs.epic | 0) + 1;
      chapter = ch;
    }
    return { fresh, glitter, chapter };
  }
  const starCount = (s, stages) => stages.reduce((t, k) => t + bits(s.stars[k] | 0), 0);
  MB.Stars = { starsOf, starsWon, awardStars, starCount, bits, CHALLENGES, HP_STAR };

  MB.Missions = { daily, roll, text, done, progress, claim, reroll, claimable, craftCost, shinyCost, nextStep, craft, makeShiny, novelName, today, PER_DAY };
  MB.Shop = { daily: shopDaily, rollDeals, dealCost, buyDeal, packCost, buyPack };
})();
