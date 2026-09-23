// Data-driven abilities. Wherever a card, bond or leader power names an ability (onPlay, onDeath, onTurnStart,
// onAllyDeath, onHurt, onFuse, or the `effect` of an item card or power) it can give a spec instead of a name:
//   { label: 'Smash!', color: '#e0463c', do: [{ op: 'damage', to: 'randomEnemy', n: 3 }, { op: 'draw' }] }
// `do` can also be a single step. Missing card/power texts are written from the spec (MB.Effects.describe).
// The full reference (ops, targets, conditions) is in .claude/skills/add-novel/effects.md.
(function () {
  const pick = (a) => a[Math.random() * a.length | 0];
  const alive = (t) => t && t.hp > 0;
  const visible = (u) => !u.kw.has('stealth');
  const value = (u) => u.atk * 1.3 + u.hp + (u.kw.has('taunt') ? 1 : 0) + (u.kw.has('frenzy') ? u.atk : 0) + (u.kw.has('guardian') ? 2 : 0);

  // ---------------------------------------------------------------- targets
  // pool(ctx) lists the candidates; choose narrows them to the ones affected ('all' by default)
  const SEL = {
    self:            { pool: (c) => (c.self ? [c.self] : []) },
    target:          { pool: (c) => (c.target ? [c.target] : []) },
    allies:          { pool: (c) => c.b.units(c.side).filter((u) => u !== c.self) },
    allAllies:       { pool: (c) => c.b.units(c.side) },
    randomAlly:      { pool: (c) => c.b.units(c.side).filter((u) => u !== c.self), choose: 'random' },
    strongestAlly:   { pool: (c) => c.b.units(c.side).filter((u) => u !== c.self), choose: (ts) => maxBy(ts, (t) => t.atk) },
    myLeader:        { pool: (c) => [c.b.me(c.side).leader] },
    friendly:        { pool: (c) => [...c.b.units(c.side), c.b.me(c.side).leader] },
    mostHurtFriendly:{ pool: (c) => [...c.b.units(c.side), c.b.me(c.side).leader], choose: (ts) => maxBy(ts, (t) => t.maxHp - t.hp) },
    enemies:         { pool: (c) => c.b.units(1 - c.side) },
    enemyLeader:     { pool: (c) => [c.b.foe(c.side).leader] },
    enemyAll:        { pool: (c) => [...c.b.units(1 - c.side), c.b.foe(c.side).leader] },
    randomEnemy:     { pool: (c) => c.b.units(1 - c.side).filter(visible), choose: 'random' },
    randomEnemyAny:  { pool: (c) => [...c.b.units(1 - c.side).filter(visible), c.b.foe(c.side).leader], choose: 'random' },
    strongestEnemy:  { pool: (c) => c.b.units(1 - c.side).filter(visible), choose: (ts) => maxBy(ts, (t) => t.atk) },
    weakestEnemy:    { pool: (c) => c.b.units(1 - c.side).filter(visible), choose: (ts) => maxBy(ts, (t) => -t.hp) },
    everyone:        { pool: (c) => c.b.allUnits() },
    otherMonsters:   { pool: (c) => c.b.allUnits().filter((u) => u !== c.self) },
  };
  const maxBy = (ts, f) => ts.reduce((a, t) => (f(t) > f(a) ? t : a));
  // extra filter on the candidates (step.where)
  const WHERE = {
    hurt: (t) => t.hp < t.maxHp, oddAtk: (t) => t.atk % 2 === 1, evenAtk: (t) => t.atk % 2 === 0,
    frozen: (t) => t.frozen, unfrozen: (t) => !t.frozen, taunt: (t) => t.kw.has('taunt'), shielded: (t) => t.shield,
    burning: (t) => t.burning, cheap: (t) => !t.isLeader && t.card.cost <= 3, big: (t) => !t.isLeader && t.atk >= 4,
    monster: (t) => !t.isLeader,
  };

  // ---------------------------------------------------------------- operations
  // sync ops change the board during the ability's animation; async ones (cards, summons) run after it.
  // valid(t) keeps the op from picking targets it can't affect (heal: only the hurt, freeze: the unfrozen...)
  const monster = (t) => !t.isLeader;
  const OPS = {
    damage: { apply: (c, t, s) => c.b.deal(t, s.n || 1, null, false, t.isLeader && t.side === c.side) },
    heal:   { valid: (t) => t.hp < t.maxHp || t.burning, apply: (c, t, s) => c.b.heal(t, s.n === 'full' ? t.maxHp : s.n || 1) },
    buff:   { valid: monster, apply: (c, t, s) => c.b.buff(t, s.atk || 0, s.hp || 0) },
    freeze: { valid: (t) => monster(t) && !t.frozen, apply: (c, t) => c.b.freeze(t) },
    thaw:   { valid: (t) => t.frozen, apply: (c, t) => { t.frozen = false; t.thaw = false; c.b.view.react({ type: 'thaw', ent: t }); } },
    ignite: { valid: (t) => monster(t) && !t.burning, apply: (c, t) => c.b.ignite(t) },
    shield: { valid: (t) => monster(t) && !t.shield, apply: (c, t) => { t.shield = true; c.b.view.react({ type: 'shield', ent: t }); } },
    kill:   { valid: monster, apply: (c, t) => { t.hp = 0; c.b.view.react({ type: 'poison', ent: t }); } },
    swap:   { valid: monster, apply: (c, t, s) => c.b.swapStats(t, s.say || 'Swapped!') },
    strip:  { valid: (t) => monster(t) && (t.kw.size || t.shield), apply: (c, t, s) => {
      t.kw.clear(); t.shield = false;
      c.b.view.react({ type: 'debuff', ent: t, atk: 0, label: s.say || 'Stripped!' });
    } },
    keyword: { valid: (t, s) => monster(t) && !t.kw.has(s.kw), apply: (c, t, s) => c.b.giveKeyword(t, s.kw, s.say || MB.KEYWORDS[s.kw].name + '!') },
    ready:  { valid: (t) => monster(t) && !t.frozen && t.atk > 0, apply: (c, t, s) => {
      if (c.b.active === c.side) t.attacksLeft = Math.max(t.attacksLeft, t.kw.has('frenzy') ? 2 : 1);
      c.b.view.react({ type: 'buff', ent: t, atk: 0, hp: 0, label: s.say || 'Ready!' });
    } },
    gold:   { self: true, apply: (c, t, s) => { c.b.me(c.side).gold += s.n || 1; } },
    // async
    draw: { async: true, run: async (c, s) => {
      const choose = {
        cheapest: (d) => d.reduce((a, b) => (b.cost < a.cost ? b : a)),
        priciest: (d) => d.reduce((a, b) => (b.cost > a.cost ? b : a)),
        item: (d) => d.filter((x) => x.type === 'spell').pop(),
        unit: (d) => d.filter((x) => x.type === 'unit').pop(),
      }[s.pick];
      for (let i = 0; i < (s.n || 1); i++) await (choose ? c.b.drawChosen(c.side, choose) : c.b.draw(c.side));
    } },
    addCard: { async: true, run: async (c, s) => {
      for (let i = 0; i < (s.n || 1); i++) {
        const id = s.card === 'randomItem' ? pick(MB.itemCards()) : s.card === 'randomUnit' ? pick(unitPool(s.maxCost)) : s.card;
        await c.b.addToHand(c.side, id, s.costMod ? { cost: Math.max(0, MB.CARDS[id].cost + s.costMod) } : undefined);
      }
    } },
    summon: { async: true, run: async (c, s) => {
      const b = c.b;
      for (let i = 0; i < (s.n || 1) && b.freeSlots(c.side).length; i++) {
        const slot = c.self ? b.nearestFree(c.side, c.self.slot) : b.freeSlots(c.side)[0];
        if (s.from === 'deck') {
          const deck = b.me(c.side).deck, units = deck.filter((x) => x.type === 'unit');
          if (!units.length) return;
          const card = pick(units);
          deck.splice(deck.indexOf(card), 1);
          const u = await b.summon(c.side, card, slot);
          if (u && card.onPlay) await b.trigger(card.onPlay, u);
        } else {
          const id = s.card === 'randomUnit' ? pick(unitPool(s.maxCost)) : s.card;
          await b.summon(c.side, MB.cardDef(id), slot);
        }
      }
    } },
  };
  const unitPool = (maxCost = 3) => Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token && !MB.CARDS[id].type && MB.CARDS[id].cost <= maxCost);

  // step.if, checked when the step runs
  const IF = {
    targetDied: (c) => c.target && c.target.hp <= 0,
    targetAlive: (c) => alive(c.target),
    selfAlive: (c) => alive(c.self),
    handSmall: (c) => c.b.me(c.side).hand.length <= 3,
    hasAllies: (c) => c.b.units(c.side).some((u) => u !== c.self),
    noAllies: (c) => !c.b.units(c.side).some((u) => u !== c.self),
    behind: (c) => c.b.me(c.side).leader.hp < c.b.foe(c.side).leader.hp,
    outnumbered: (c) => c.b.units(c.side).length < c.b.units(1 - c.side).length,
  };

  const stepsOf = (spec) => { const d = spec.do || spec; return Array.isArray(d) ? d : [d]; };

  function select(c, s) {
    const sel = SEL[s.to], op = OPS[s.op];
    let ts = sel.pool(c).filter((t) => t && t.hp > 0);
    if (s.where) ts = ts.filter(WHERE[s.where]);
    if (op.valid && s.to !== 'target' && s.to !== 'self') ts = ts.filter((t) => op.valid(t, s));
    if (!ts.length || !sel.choose) return ts;
    return [sel.choose === 'random' ? pick(ts) : sel.choose(ts)];
  }

  // Resolves the targets now (so the animation flies to the right ones) and returns the parts to run.
  function prepare(b, spec, { side, self = null, target = null }) {
    const c = { b, side, self, target };
    const plan = stepsOf(spec).map((s) => ({ s, ts: OPS[s.op].async || OPS[s.op].self || !s.to || s.times ? null : select(c, s) }));
    const ok = (s) => !s.if || IF[s.if](c);
    return {
      targets: [...new Set(plan.flatMap((p) => p.ts || []))],
      // nothing would happen: every step aims at targets that aren't there
      empty: plan.every((p) => p.ts && !p.ts.length),
      sync() {
        for (const { s, ts } of plan) {
          const op = OPS[s.op];
          if (op.async || !ok(s)) continue;
          if (op.self || !s.to) op.apply(c, null, s);
          else if (s.times) for (let i = 0; i < s.times; i++) select(c, s).forEach((t) => op.apply(c, t, s));
          else ts.filter(alive).forEach((t) => op.apply(c, t, s));
        }
      },
      async after() {
        for (const { s } of plan) if (OPS[s.op].async && ok(s)) await OPS[s.op].run(c, s);
      },
    };
  }

  // a triggered ability of unit u (Battle.trigger)
  async function trigger(b, spec, u) {
    const r = prepare(b, spec, { side: u.side, self: u });
    if (r.empty) return;
    await b.view.abilityFx(u, spec.label || u.card.attack.name, r.targets.filter(alive), () => r.sync(), spec.color || u.card.attack.color);
    await r.after();
  }

  // a spec made of summons only needs a free board slot to be worth playing
  const needsSlot = (spec) => stepsOf(spec).every((s) => s.op === 'summon');

  // ---------------------------------------------------------------- AI
  const HOSTILE = new Set(['damage', 'kill', 'freeze', 'ignite', 'strip']);
  // is a targeted spell / power worth using now, and on whom? Returns { target } or {} or null.
  function plan(b, side, src) {
    const steps = stepsOf(src.effect), me = b.me(side);
    if (steps.every((s) => s.op === 'draw' || s.op === 'addCard') && me.hand.length >= 7) return null;
    if (!src.target) {
      const r = prepare(b, src.effect, { side });
      if (r.empty) return null;
      if (steps.some((s) => s.op === 'damage' && ['myLeader', 'friendly'].includes(s.to)) && me.leader.hp <= 8) return null;
      if (steps.some((s) => s.op === 'damage' && ['everyone', 'allAllies', 'allies', 'otherMonsters'].includes(s.to))
        && b.units(1 - side).length <= b.units(side).length) return null;
      if (steps.some((s) => s.op === 'gold') && !me.hand.some((x) => x.cost === me.gold + 1)) return null;
      return {};
    }
    const on = steps.filter((s) => s.to === 'target');
    const friendly = on.some((s) => !HOSTILE.has(s.op) && !(s.op === 'buff' && s.atk < 0) && s.op !== 'swap') || (on.length && on.every((s) => s.op === 'swap') && src.target === 'allyUnit');
    const hurtFirst = on[0] && on[0].op === 'damage' ? on[0].n || 1 : 0; // "hit it, then buff it"
    const cands = b.targetsFor(side, src.target, src.filter).filter((t) => (friendly ? t.side === side : t.side !== side));
    let best = null, bestScore = 0;
    for (const t of cands) {
      let s = 0;
      for (const st of on) {
        if (st.op === 'damage') s += friendly ? (t.shield || t.hp > hurtFirst ? 0 : -99) : t.isLeader ? 1 : t.shield ? 3 : t.hp <= (st.n || 1) ? 10 + value(t) : value(t) / 2;
        else if (st.op === 'kill') s += t.isLeader ? -99 : value(t);
        else if (st.op === 'freeze') s += t.frozen || t.isLeader ? 0 : t.atk;
        else if (st.op === 'ignite') s += t.burning || t.isLeader ? 0 : value(t) / 2;
        else if (st.op === 'strip') s += t.isLeader ? 0 : t.kw.size * 2 + (t.shield ? 3 : 0);
        else if (st.op === 'swap') s += t.isLeader ? -99 : friendly ? t.hp - t.atk - 1 : t.atk - t.hp;
        else if (st.op === 'heal') s += Math.min(st.n === 'full' ? 99 : st.n || 1, t.maxHp - t.hp) + (t.burning ? 2 : 0) + (t.frozen && on.some((x) => x.op === 'thaw') ? 3 : 0) - 1;
        else if (st.op === 'thaw') s += t.frozen ? 3 : 0;
        else if (st.op === 'buff') s += t.isLeader ? 0 : st.atk < 0 ? t.atk : value(t) / 2 + (t.attacksLeft > 0 ? 3 : 0);
        else if (st.op === 'keyword') s += t.isLeader || t.kw.has(st.kw) ? -2 : value(t) / 2 + (t.attacksLeft > 0 ? 2 : 0);
        else if (st.op === 'shield') s += t.isLeader || t.shield ? -2 : value(t) / 2;
        else if (st.op === 'ready') s += t.isLeader || t.attacksLeft > 0 || t.frozen ? -99 : t.atk * 2;
      }
      if (!on.length) s = 1;
      if (s > bestScore) { bestScore = s; best = t; }
    }
    return best ? { target: best } : null;
  }

  // ---------------------------------------------------------------- card text
  const TARGET_NAME = { enemyUnit: 'an enemy monster', allyUnit: 'an ally', anyUnit: 'a monster', enemyAny: 'an enemy character', friendlyAny: 'a friendly character' };
  const WHERE_NAME = { hurt: 'damaged', oddAtk: 'odd-ATK', evenAtk: 'even-ATK', frozen: 'frozen', unfrozen: 'unfrozen', taunt: 'Taunt', shielded: 'shielded', burning: 'burning', cheap: 'cheap', big: 'big' };
  const IF_NAME = { targetDied: 'if it dies, ', targetAlive: 'if it survives, ', selfAlive: 'if it survives, ', handSmall: 'if you hold 3 or fewer cards, ',
    hasAllies: 'if you have another monster, ', noAllies: 'if it stands alone, ', behind: 'if your leader has less HP, ', outnumbered: 'if you have fewer monsters, ' };
  const NUM = ['no', 'a', 'two', 'three', 'four', 'five'];

  const FILTER_NAME = { lowAtk: ' with 2 or less ATK', sick: ' played this turn', guarded: ' with Taunt or Shield', hasKw: ' with a keyword',
    noRebel: ' without Rebel', spent: ' that already attacked' };
  const SINGLE = new Set(['self', 'target', 'randomAlly', 'strongestAlly', 'myLeader', 'mostHurtFriendly', 'enemyLeader', 'randomEnemy', 'randomEnemyAny', 'strongestEnemy', 'weakestEnemy']);
  function who(sel, ctx, where) {
    const w = where ? WHERE_NAME[where] + ' ' : '';
    if (sel === 'target') { const n = ctx.named ? 'it' : (TARGET_NAME[ctx.target] || 'a target') + (FILTER_NAME[ctx.filter] || ''); ctx.named = true; return n; }
    // the same targets as the step before: "it" / "them"
    if (sel === ctx.last && !where && !sel.startsWith('random')) return SINGLE.has(sel) ? 'it' : 'them';
    if (sel === 'self') return ctx.kind === 'trigger' ? 'itself' : 'it';
    return {
      allies: ctx.kind === 'trigger' ? `your other ${w}monsters` : `your ${w}monsters`, allAllies: `all your ${w}monsters`,
      randomAlly: ctx.kind === 'trigger' ? `another random ${w}ally` : `a random ${w}ally`, strongestAlly: `your strongest ${w}ally`,
      myLeader: 'your leader', friendly: 'all your characters', mostHurtFriendly: 'your most injured character',
      enemies: `all ${w}enemy monsters`, enemyLeader: 'the enemy leader', enemyAll: 'every enemy character',
      randomEnemy: `a random ${w}enemy monster`, randomEnemyAny: 'a random enemy character',
      strongestEnemy: `the strongest ${w}enemy monster`, weakestEnemy: `the ${w}enemy monster with the lowest HP`,
      everyone: `all ${w}monsters`, otherMonsters: `all other ${w}monsters`,
    }[sel];
  }
  const cardName = (id, n) => {
    if (id === 'randomItem') return n > 1 ? `${n} random item cards` : 'a random item card';
    if (id === 'randomUnit') return n > 1 ? `${n} random cheap characters` : 'a random cheap character';
    const c = MB.CARDS[id], m = window.MIKU_MANIFEST, stats = c.type ? '' : `${c.atk}/${c.hp} `;
    const name = c.name || ([...m.characters, ...m.items].find((x) => x.id === id) || { name: id }).name;
    return n > 1 ? `${NUM[n] || n} ${stats}${name}s` : `a${/^[aeiou8]/i.test(stats || name) ? 'n' : ''} ${stats}${name}`;
  };

  function phrase(s, ctx) {
    const t = s.to ? who(s.to, ctx, s.where) : '', n = s.n || 1, times = s.times ? ` ${NUM[s.times] === 'two' ? 'twice' : s.times + ' times'}` : '';
    switch (s.op) {
      case 'damage': return `deal ${n} damage to ${t}${times}`;
      case 'heal': return s.n === 'full' ? `fully heal ${t}` : `restore ${n} HP to ${t}${times}`;
      case 'buff': { const a = s.atk || 0; return s.hp ? `give ${t} ${a >= 0 ? '+' : ''}${a}/+${s.hp}${times}` : `give ${t} ${a >= 0 ? '+' : ''}${a} ATK${times}`; }
      case 'freeze': return `freeze ${t}${times}`;
      case 'thaw': return `thaw ${t}`;
      case 'ignite': return `set ${t} ablaze${times}`;
      case 'shield': return `give ${t} Shield`;
      case 'kill': return `destroy ${t}`;
      case 'swap': return `swap the ATK and HP of ${t}`;
      case 'strip': return `remove all keywords and Shield from ${t}`;
      case 'keyword': return `give ${t} ${MB.KEYWORDS[s.kw].name}`;
      case 'ready': return `let ${t} attack right away`;
      case 'gold': return `gain ${n} gold this turn`;
      case 'draw': return s.pick ? `draw the ${{ cheapest: 'cheapest card', priciest: 'most expensive card', item: 'first item card', unit: 'first character' }[s.pick]} in your deck`
        : `draw ${n > 1 ? NUM[n] + ' cards' : 'a card'}`;
      case 'addCard': return `add ${cardName(s.card, n)} to your hand`;
      case 'summon': return s.from === 'deck' ? 'summon a random character from your deck' : `summon ${cardName(s.card, n)}`;
    }
    return s.op;
  }
  const PREFIX = { onPlay: 'On play: ', onDeath: 'On death: ', onTurnStart: 'Start of your turn: ', onAllyDeath: 'Whenever another ally dies: ',
    onHurt: 'Whenever it survives damage: ', onFuse: 'On fusion: ' };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // kind: 'trigger' (with the trigger's name) or 'play' (item cards and powers, with their target type)
  function describe(spec, { trigger, target, filter } = {}) {
    const ctx = { kind: trigger ? 'trigger' : 'play', target, filter, named: false };
    const parts = stepsOf(spec).map((s) => { const p = (s.if ? IF_NAME[s.if] : '') + phrase(s, ctx); ctx.last = s.to; return p; });
    let text = parts.reduce((acc, p, i) => (i === 0 ? p : acc + (p.startsWith('if ') ? '. ' + cap(p) : ', then ' + p)), '');
    text = cap(text) + '.';
    return trigger ? PREFIX[trigger] + text.charAt(0).toLowerCase() + text.slice(1) : text;
  }

  // fills in the text of every card, power and bond whose abilities are specs and that has no text of its own
  const TRIGGERS = ['onPlay', 'onDeath', 'onTurnStart', 'onAllyDeath', 'onHurt', 'onFuse'];
  function fillTexts() {
    const fill = (o, target) => {
      if (o.text) return;
      if (o.effect && typeof o.effect === 'object') o.text = describe(o.effect, { target: o.target, filter: o.filter });
      else o.text = TRIGGERS.filter((k) => o[k] && typeof o[k] === 'object').map((k) => describe(o[k], { trigger: k })).join(' ');
    };
    Object.values(MB.CARDS).forEach((c) => fill(c));
    Object.values(MB.POWERS).forEach((p) => fill(p));
    MB.BONDS.forEach((b) => fill(b));
  }

  MB.Effects = { SEL, OPS, IF, WHERE, prepare, trigger, plan, describe, needsSlot, stepsOf, fillTexts };
  fillTexts();
})();
