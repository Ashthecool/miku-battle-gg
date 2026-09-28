// Arena, Deathpick mode: pick one of three random leaders, draft a deck from every card in the game (one of three, 20 times; you
// don't need to own them), then battle until MB.ARENA.maxWins wins or maxLosses losses. Rewards grow with the wins.
// Works on a save's { arena, arenaBest, arenaRuns, glitter, packs } only, so tools/check_game.js can simulate it.
// save.arena: null, or { stage: 'leader' | 'draft' | 'run' | 'done', leaders, leader, deck, offer, wins, losses, foes, next }
window.MB = window.MB || {};
(function () {
  const A = MB.ARENA = {
    picks: MB.RULES.deckSize,
    maxWins: 7, maxLosses: 3,
    rarity: { common: 50, rare: 30, epic: 14, legendary: 6 }, // odds of each offer's rarity
    home: 0.5,                                                  // chance that one offered card is from the leader's novel
    // what a finished run pays
    rewards: (wins) => ({ glitter: 20 + wins * 25, packs: [wins >= 3 && 'common', wins >= 5 && 'rare', wins >= 7 && 'epic'].filter(Boolean) }),
    // the n-th opponent (n = battles played so far) gets tougher
    foeHp: (n) => 24 + n * 2,
    foeAi: (n) => Math.min(1, 0.4 + n * 0.08),
  };
  const pickFrom = (a, rng) => a[Math.floor(rng() * a.length)];
  const copies = (id) => MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2;
  const draftable = () => Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token);
  const leaderPool = () => Object.keys(MB.POWERS).filter((id) => MB.CARDS[id] && MB.novelOf(id));

  function start(s, rng = Math.random) {
    const pool = leaderPool().slice(), leaders = [];
    while (leaders.length < 3 && pool.length) leaders.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    s.arena = { stage: 'leader', leaders, leader: null, deck: [], offer: null, wins: 0, losses: 0, foes: [], next: null };
    return s.arena;
  }

  function chooseLeader(s, id, rng = Math.random) {
    const a = s.arena;
    if (!a || a.stage !== 'leader' || !a.leaders.includes(id)) return false;
    a.leader = id;
    a.stage = 'draft';
    a.offer = offer(s, rng);
    return true;
  }

  // three different cards of one rarity that still fit in the deck (one from the leader's novel, often)
  function offer(s, rng = Math.random) {
    const a = s.arena, fits = (id) => id !== a.leader && a.deck.filter((d) => d === id).length < copies(id);
    const R = Object.entries(A.rarity);
    let x = rng() * R.reduce((t, [, w]) => t + w, 0), rarity = R[0][0];
    for (const [r, w] of R) { x -= w; if (x <= 0) { rarity = r; break; } }
    let pool = draftable().filter((id) => MB.CARDS[id].rarity === rarity && fits(id));
    if (pool.length < 3) pool = draftable().filter(fits);
    const out = [], home = pool.filter((id) => MB.novelOf(id) === MB.novelOf(a.leader));
    if (home.length && rng() < A.home) out.push(pickFrom(home, rng));
    while (out.length < 3 && out.length < pool.length) {
      const id = pickFrom(pool, rng);
      if (!out.includes(id)) out.push(id);
    }
    return MB.shuffle(out);
  }

  function pick(s, id, rng = Math.random) {
    const a = s.arena;
    if (!a || a.stage !== 'draft' || !a.offer.includes(id)) return false;
    a.deck.push(id);
    if (a.deck.length >= A.picks) { a.stage = 'run'; a.offer = null; a.next = nextFoe(s, rng); }
    else a.offer = offer(s, rng);
    return true;
  }

  // the next opponent: someone you haven't fought this run
  function nextFoe(s, rng = Math.random) {
    const a = s.arena, n = a.wins + a.losses;
    let pool = leaderPool().filter((id) => id !== a.leader && !a.foes.includes(id));
    if (!pool.length) pool = leaderPool().filter((id) => id !== a.leader);
    return { foe: pickFrom(pool, rng), hp: A.foeHp(n), ai: A.foeAi(n) };
  }

  // a battle of the run ended
  function result(s, won, rng = Math.random) {
    const a = s.arena;
    if (!a || a.stage !== 'run') return;
    if (won) a.wins++; else a.losses++;
    a.foes.push(a.next.foe);
    if (a.wins >= A.maxWins || a.losses >= A.maxLosses) { a.stage = 'done'; a.next = null; }
    else a.next = nextFoe(s, rng);
  }

  // pays a run out (a finished one, or one you retire from); returns the rewards
  function finish(s) {
    const a = s.arena;
    if (!a || (a.stage !== 'run' && a.stage !== 'done')) return null;
    const r = A.rewards(a.wins);
    s.glitter += r.glitter;
    r.packs.forEach((t) => { s.packs[t] = (s.packs[t] | 0) + 1; });
    s.arenaBest = Math.max(s.arenaBest | 0, a.wins);
    s.arenaRuns = (s.arenaRuns | 0) + 1;
    s.arena = null;
    return { ...r, wins: a.wins, losses: a.losses };
  }

  // a stored run whose cards or leader vanished (NSFW mode switched off) can't go on
  function valid(a) {
    if (!a || typeof a !== 'object' || !['leader', 'draft', 'run', 'done'].includes(a.stage)) return false;
    if (!Array.isArray(a.leaders) || !Array.isArray(a.deck) || !Array.isArray(a.foes)) return false;
    if (a.leader && !MB.CARDS[a.leader]) return false;
    if (a.stage === 'draft' && !(Array.isArray(a.offer) && a.offer.every((id) => MB.CARDS[id]))) return false;
    if (a.stage === 'run' && !(a.next && MB.CARDS[a.next.foe])) return false;
    return a.deck.every((id) => MB.CARDS[id]) && a.leaders.every((id) => MB.CARDS[id]);
  }

  MB.Arena = { start, chooseLeader, offer, pick, nextFoe, result, finish, valid };

  // Casual PvP (js/net.js): your own deck, leader and card levels against another player. Like Undercards' Standard
  // mode it pays a little for a win and less for a loss, here for the first paidPerDay matches of each day, plus a
  // pack for the day's first win. save.pvp: { wins, losses, streak, best, day, paid, firstWin }
  const P = MB.PVP = {
    win: 10, loss: 4, paidPerDay: 10, firstWin: 'common',
    turnSecs: 90,   // a turn ends by itself after this long
    graceSecs: 60,  // how long a player who dropped out has to come back before the other one wins
  };
  const freshPvp = () => ({ wins: 0, losses: 0, streak: 0, best: 0, day: '', paid: 0, firstWin: false });
  function pvpClean(p) {
    const o = p && typeof p === 'object' ? p : {}, f = freshPvp();
    ['wins', 'losses', 'streak', 'best', 'paid'].forEach((k) => { f[k] = Math.max(0, o[k] | 0); });
    f.day = typeof o.day === 'string' ? o.day : '';
    f.firstWin = !!o.firstWin;
    return f;
  }
  // a finished match; returns what it paid: { glitter, pack }
  function pvpResult(s, won, day = MB.Missions.today()) {
    const p = s.pvp = pvpClean(s.pvp);
    if (p.day !== day) { p.day = day; p.paid = 0; p.firstWin = false; }
    if (won) { p.wins++; p.streak++; p.best = Math.max(p.best, p.streak); } else { p.losses++; p.streak = 0; }
    const out = { glitter: 0, pack: null };
    if (p.paid < P.paidPerDay) { p.paid++; out.glitter = won ? P.win : P.loss; s.glitter += out.glitter; }
    if (won && !p.firstWin) { p.firstWin = true; out.pack = P.firstWin; s.packs[out.pack] = (s.packs[out.pack] | 0) + 1; }
    return out;
  }
  // matches left today that still pay
  const pvpPaidLeft = (s, day = MB.Missions.today()) => (s.pvp && s.pvp.day === day ? Math.max(0, P.paidPerDay - s.pvp.paid) : P.paidPerDay);
  const pvpFirstWinLeft = (s, day = MB.Missions.today()) => !(s.pvp && s.pvp.day === day && s.pvp.firstWin);

  MB.Pvp = { clean: pvpClean, result: pvpResult, paidLeft: pvpPaidLeft, firstWinLeft: pvpFirstWinLeft };
})();
