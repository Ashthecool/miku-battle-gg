// Daily missions and Glitter ✨. Missions count what you do in battle (Battle.tally) and pay out Glitter, which also
// comes from every win and from pack fragments past a card's complete. Glitter crafts fragments of a card you pick,
// or makes a card you own Shiny. Works on a save's { glitter, missions, shiny, unlocked, shards, leaders } only, so
// tools/check_game.js can simulate it.
window.MB = window.MB || {};
(function () {
  const G = MB.GLITTER = {
    win: 5,        // every win
    complete: 25,  // a win once every card is collected (instead of a pack)
    extra: 10,     // each pack fragment past a card's complete
    craft: { rare: 20, epic: 30, legendary: 45 },                // one fragment
    shiny: { common: 60, rare: 120, epic: 240, legendary: 480 },  // a Shiny finish on a card you own
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
  // Glitter per fragment of a locked card (null: nothing to craft), and for its Shiny finish once you own it
  const craftCost = (s, id) => (MB.CARDS[id] && !has(s, id) && G.craft[MB.CARDS[id].rarity]) || null;
  const shinyCost = (s, id) => (MB.CARDS[id] && has(s, id) && !s.shiny.includes(id) && G.shiny[MB.CARDS[id].rarity]) || null;
  // crafts up to n fragments (all the card still needs, if n is left out); returns { from, to, done } or null
  function craft(s, id, n) {
    const per = craftCost(s, id);
    if (!per) return null;
    const left = MB.Collection.need(id) - (s.shards[id] || 0), k = Math.min(n || left, left, Math.floor(s.glitter / per));
    if (k < 1) return null;
    s.glitter -= k * per;
    const r = MB.Collection.addShards(s, id, k);
    return { ...r, done: has(s, id) };
  }
  function makeShiny(s, id) {
    const cost = shinyCost(s, id);
    if (!cost || s.glitter < cost) return false;
    s.glitter -= cost;
    s.shiny.push(id);
    return true;
  }

  MB.Missions = { daily, roll, text, done, progress, claim, reroll, claimable, craftCost, shinyCost, craft, makeShiny, novelName, today, PER_DAY };
})();
