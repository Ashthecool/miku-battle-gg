// Greedy opponent. `skill` (0..1) controls how often it makes the smart choice.
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const value = (u) => u.atk * 1.3 + u.hp + (u.kw.has('taunt') ? 1 : 0) + (u.kw.has('poison') ? 2 : 0) + (u.kw.has('frenzy') ? u.atk : 0) +
    (u.kw.has('guardian') ? 2 : 0) + (u.kw.has('burn') ? 1 : 0);

  function bestTarget(b, side, type, filter, mode) {
    const ts = b.targetsFor(side, type, filter);
    if (!ts.length) return null;
    const score = {
      damage: (t) => (t.isLeader ? 1 : (t.hp <= mode.n ? 10 + value(t) : value(t) / 2)),
      heal: (t) => (t.maxHp - t.hp) + (t.isLeader ? 1 : 0),
      buff: (t) => value(t) + (t.attacksLeft > 0 ? 3 : 0),
      debuff: (t) => t.atk,
      kill: (t) => value(t),
    }[mode.kind];
    return ts.slice().sort((a, c) => score(c) - score(a))[0];
  }

  function spellPlan(b, side, card) {
    switch (card.effect) {
      case 'bagSwing': {
        const t = b.units(1 - side).filter((u) => u.hp <= 2 || u.shield).sort((a, c) => value(c) - value(a))[0];
        return t ? { target: t } : null;
      }
      case 'towelOff': {
        const t = bestTarget(b, side, card.target, null, { kind: 'heal' });
        return t && t.maxHp - t.hp >= 3 ? { target: t } : null;
      }
      case 'stick': { const t = bestTarget(b, side, card.target, null, { kind: 'buff' }); return t ? { target: t } : null; }
      case 'mansion': return b.units(1 - side).length >= 2 ? {} : null;
      case 'allowance': return b.me(side).hand.length <= 5 ? {} : null;
      case 'beer': {
        const t = b.units(side).filter((u) => !u.kw.has('tipsy') && !u.kw.has('taunt')).sort((a, c) => value(c) - value(a))[0];
        return t ? { target: t } : null;
      }
      case 'exchange': { // rescue a badly hurt, expensive ally
        const t = b.units(side).filter((u) => u.card.cost >= 3 && u.hp <= u.maxHp / 2).sort((a, c) => c.card.cost - a.card.cost)[0];
        return t && b.me(side).hand.length < 7 ? { target: t } : null;
      }
      case 'sketch': {
        const t = b.units(side).slice().sort((a, c) => c.card.cost - a.card.cost)[0];
        return t && t.card.cost >= 3 && b.me(side).hand.length < 7 ? { target: t } : null;
      }
      case 'closet': return b.me(side).deck.some((c) => c.type === 'unit') ? {} : null;
      default: return {};
    }
  }

  function powerPlan(b, side) {
    const pw = b.me(side).power;
    if (!b.canPower(side)) return null;
    const kind = {
      hug: 'buff', cheerUp: 'buff', pump: 'buff', giveShield: 'buff', overtime: 'buff',
      ping: 'damage', heal3: 'heal', gloom: 'debuff', bribe: 'kill', freezeOne: 'debuff',
      drill: 'buff', bless: 'heal', ignite: 'debuff', tease: 'kill',
    }[pw.effect];
    if (pw.effect === 'chill' && b.me(side).leader.hp <= 8) return null;
    if (pw.effect === 'heal3' && b.me(side).leader.hp >= b.me(side).leader.maxHp - 2 && !b.units(side).some((u) => u.hp < u.maxHp)) return null;
    if (pw.effect === 'groan' && !b.units(1 - side).length) return null;
    if (pw.effect === 'ignite') { const t = b.targetsFor(side, 'enemyUnit').filter((u) => !u.burning).sort((a, c) => value(c) - value(a))[0]; return t ? { target: t } : null; }
    if (pw.effect === 'bless') { const t = b.units(side).filter((u) => u.maxHp - u.hp >= 2 || u.burning).sort((a, c) => (c.maxHp - c.hp) - (a.maxHp - a.hp))[0]; return t ? { target: t } : null; }
    if (pw.effect === 'swapStats') { const t = b.units(side).filter((u) => u.hp - u.atk >= 2).sort((a, c) => (c.hp - c.atk) - (a.hp - a.atk))[0]; return t ? { target: t } : null; }
    if (pw.effect === 'research' && b.me(side).hand.length >= 7) return null;
    if (!pw.target) return {};
    const t = bestTarget(b, side, pw.target, pw.filter, { kind, n: 1 });
    return t ? { target: t } : null;
  }

  function chooseAttack(b, u, skill) {
    const targets = b.attackTargets(u);
    const face = targets.find((t) => t.isLeader);
    const foeLeader = b.foe(u.side).leader;
    // lethal check: total ready attack
    const readyAtk = b.units(u.side).filter((x) => b.canAttack(x)).reduce((s, x) => s + x.atk * x.attacksLeft, 0);
    if (face && readyAtk >= foeLeader.hp) return face;
    let best = null, bestScore = -Infinity;
    for (const t of targets) {
      let s;
      if (t.isLeader) s = 2 + u.atk * 0.6;
      else {
        const kills = t.shield ? false : (t.hp <= u.atk || u.kw.has('poison'));
        const survives = u.kw.has('ranged') || u.shield || t.atk < u.hp;
        s = (kills ? value(t) + 2 : -1) + (survives ? 3 : -value(u) * 0.8) + (t.kw.has('taunt') ? 1 : 0);
        if (t.shield) s += 1.5; // popping shields with small units is fine
      }
      s += (Math.random() - 0.5) * (1 - skill) * 8;
      if (s > bestScore) { bestScore = s; best = t; }
    }
    return best;
  }

  async function takeTurn(b, side) {
    const skill = b.aiSkill ?? 0.6;
    await wait(700);
    // 1. play cards, most expensive first
    for (let guard = 0; guard < 12 && !b.over; guard++) {
      const p = b.me(side);
      const playable = p.hand.filter((c) => b.canPlay(side, c)).sort((a, c) => c.cost - a.cost);
      let played = false;
      for (const card of playable) {
        if (Math.random() > 0.35 + skill && guard > 0) continue; // weaker AIs sometimes hold cards
        let plan = card.type === 'unit' ? { slot: pickSlot(b, side) } : spellPlan(b, side, card);
        if (!plan) continue;
        if (await b.playCard(side, card.cid, plan)) { played = true; await wait(450); break; }
      }
      if (!played) break;
    }
    // 2. leader power
    if (!b.over) {
      const plan = powerPlan(b, side);
      if (plan && Math.random() < 0.5 + skill) { await b.usePower(side, plan.target); await wait(400); }
    }
    // 3. attacks
    for (let guard = 0; guard < 16 && !b.over; guard++) {
      const ready = b.units(side).filter((u) => b.canAttack(u)).sort((a, c) => c.atk - a.atk);
      if (!ready.length) break;
      const u = ready[0];
      const t = chooseAttack(b, u, skill);
      if (!t) break;
      await b.attack(u, t);
      await wait(350);
    }
    if (!b.over) { await wait(500); await b.endTurn(); }
  }

  function pickSlot(b, side) {
    const free = b.freeSlots(side);
    // prefer slots facing enemy monsters (looks like a standoff)
    const facing = free.filter((i) => b.me(1 - side).board[i]);
    return (facing.length ? facing : free)[Math.random() * (facing.length || free.length) | 0];
  }

  MB.AI = { takeTurn };
})();
