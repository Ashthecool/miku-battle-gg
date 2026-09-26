// Battle rules. Pure game state + async calls into the view for animation.
(function () {
  const SLOTS = 4, R = MB.RULES; // the rest of the numbers live in data.js
  let uidSeq = 0;

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.random() * a.length | 0];

  function cardDef(id) {
    const c = MB.CARDS[id];
    const m = MB.charById(id) || MB.manifest.items.find((i) => i.id === id);
    return { id, type: c.type || 'unit', name: c.name || (m ? m.name : id), ...c };
  }

  class Battle {
    constructor(opts) {
      this.view = opts.view;
      this.over = false; this.winner = null; this.turn = 0; this.active = 0; this.busy = false;
      this.tally = { novel: {} }; // what the player did, for daily missions (count)
      this.boss = opts.boss || null; this.bossTurns = 0; this.raged = false; // a Story finale's boss rule (MB.BOSSES)
      this.players = [0, 1].map((side) => {
        const leaderId = side === 0 ? opts.playerLeader : opts.enemyLeader;
        const hp = side === 0 ? R.leaderHp : (opts.enemyHp || R.leaderHp);
        return {
          side, leaderId, power: MB.POWERS[leaderId], powerUsed: false,
          leader: { uid: 'L' + side, isLeader: true, side, hp, maxHp: hp, atk: 0, charId: leaderId },
          gold: 0, maxGold: 0, fatigue: 0,
          deck: shuffle((side === 0 ? opts.playerDeck : opts.enemyDeck).map((id) => ({ cid: ++uidSeq, ...cardDef(id) }))),
          hand: [], board: new Array(SLOTS).fill(null),
        };
      });
    }

    // counts something the player (side 0) did: turns, cards, items, big (cost 5+), powers, attacks, bonds, combos, lost (own monsters died),
    // kills (enemy monsters), face (damage to the enemy leader), healed; tally.novel counts cards played per novel
    count(side, key, n = 1) {
      if (side === 0 && n > 0) this.tally[key] = (this.tally[key] || 0) + n;
    }

    me(side) { return this.players[side]; }
    foe(side) { return this.players[1 - side]; }
    units(side) { return this.players[side].board.filter(Boolean); }
    allUnits() { return [...this.units(0), ...this.units(1)]; }
    find(uid) {
      if (uid === 'L0' || uid === 'L1') return this.players[+uid[1]].leader;
      return this.allUnits().find((u) => u.uid === uid) || null;
    }
    freeSlots(side) { return this.me(side).board.map((u, i) => (u ? -1 : i)).filter((i) => i >= 0); }

    // ---------- flow ----------
    async start() {
      this.view.init(this);
      const first = Math.random() < 0.5 ? 0 : 1;
      for (let i = 0; i < R.openingHand; i++) { await this.draw(first, true); await this.draw(1 - first, true); }
      await this.draw(1 - first, true); // going second: one extra card
      this.view.log(first === 0 ? 'You go first.' : `${MB.charById(this.me(1).leaderId).name} goes first.`);
      await this.startTurn(first);
    }

    async startTurn(side) {
      if (this.over) return;
      this.active = side; this.turn++;
      const p = this.me(side);
      this.count(side, 'turns');
      p.maxGold = Math.min(R.maxGold, p.maxGold + 1); p.gold = p.maxGold; p.powerUsed = false;
      for (const u of this.units(side)) {
        u.sick = false;
        if (u.frozen) { u.attacksLeft = 0; u.thaw = true; }
        else u.attacksLeft = u.kw.has('frenzy') ? 2 : 1;
      }
      await this.view.turnBanner(side);
      const burning = this.units(side).filter((u) => u.burning);
      if (burning.length) { await this.view.burnFx(burning, () => burning.forEach((u) => this.deal(u, 1, null))); await this.resolveDeaths(); }
      if (this.over) return;
      await this.draw(side);
      if (side === 1 && this.boss && !this.over && ++this.bossTurns % this.boss.every === 0) await this.bossRule(this.boss);
      if (this.over) return;
      for (const u of this.units(side)) if (u.onTurnStart && u.hp > 0) await this.trigger(u.onTurnStart, u);
      await this.resolveDeaths();
      this.view.refresh();
      if (!this.over && side === 1) await MB.AI.takeTurn(this, 1);
    }

    async endTurn() {
      if (this.over) return;
      const side = this.active;
      for (const u of this.units(side)) if (u.onTurnEnd && u.hp > 0) await this.trigger(u.onTurnEnd, u);
      await this.resolveDeaths();
      if (this.over) return;
      for (const u of this.units(side)) if (u.thaw) { u.frozen = false; u.thaw = false; this.view.react({ type: 'thaw', ent: u }); }
      this.view.refresh();
      await this.startTurn(1 - side);
    }

    async draw(side, silent) {
      const p = this.me(side);
      if (!p.deck.length) {
        p.fatigue++;
        this.view.log(`${side === 0 ? 'Your' : "Enemy's"} deck is empty! Fatigue ${p.fatigue}.`);
        this.deal(p.leader, p.fatigue, null, false, true);
        await this.view.fatigue(side, p.fatigue);
        await this.resolveDeaths();
        return;
      }
      const card = p.deck.pop();
      if (p.hand.length >= R.maxHand) { await this.view.burn(side, card); return; }
      p.hand.push(card);
      await this.view.drawCard(side, card, silent);
    }

    // ---------- queries ----------
    hasTaunt(side) { return this.units(side).some((u) => u.kw.has('taunt')); }

    canPlay(side, card) {
      const p = this.me(side);
      if (this.over || this.active !== side || card.cost > p.gold) return false;
      if (card.type === 'unit') return this.freeSlots(side).length > 0;
      if (card.effect === 'callFriend' || card.effect === 'closet') return this.freeSlots(side).length > 0;
      if (typeof card.effect === 'object' && MB.Effects.needsSlot(card.effect) && !this.freeSlots(side).length) return false;
      if (card.target) return this.targetsFor(side, card.target, card.filter).length > 0;
      return true;
    }

    canPower(side) {
      const p = this.me(side), pw = p.power;
      if (this.over || this.active !== side || p.powerUsed || p.gold < pw.cost) return false;
      if (pw.effect === 'teddy' || pw.effect === 'seagull') return this.freeSlots(side).length > 0;
      if (typeof pw.effect === 'object' && MB.Effects.needsSlot(pw.effect) && !this.freeSlots(side).length) return false;
      if (pw.target) return this.targetsFor(side, pw.target, pw.filter).length > 0;
      return true;
    }

    targetsFor(side, type, filter) {
      const ally = this.units(side), enemy = this.units(1 - side).filter((u) => !u.kw.has('stealth'));
      let t = [];
      switch (type) {
        case 'enemyUnit': t = enemy; break;
        case 'allyUnit': t = ally; break;
        case 'anyUnit': t = [...ally, ...enemy]; break;
        case 'enemyAny': t = [...enemy, this.foe(side).leader]; break;
        case 'friendlyAny': t = [...ally, this.me(side).leader]; break;
      }
      if (filter === 'lowAtk') t = t.filter((u) => u.atk <= 2);
      if (filter === 'sick') t = t.filter((u) => u.sick && !u.frozen && u.attacksLeft === 0);
      if (filter === 'guarded') t = t.filter((u) => u.kw.has('taunt') || u.shield);
      if (filter === 'hasKw') t = t.filter((u) => u.kw.size || u.shield);
      if (filter === 'noRebel') t = t.filter((u) => !u.kw.has('rebel'));
      if (filter === 'spent') t = t.filter((u) => u.attacksLeft === 0 && !u.frozen && u.atk > 0);
      return t;
    }

    canAttack(u) { return !this.over && u && !u.isLeader && u.side === this.active && u.attacksLeft > 0 && !u.frozen && u.atk > 0; }

    attackTargets(u) {
      const enemy = this.units(1 - u.side).filter((e) => !e.kw.has('stealth'));
      const taunts = enemy.filter((e) => e.kw.has('taunt'));
      if (taunts.length && !u.kw.has('tipsy') && !u.kw.has('rebel')) return taunts;
      return [...enemy, this.foe(u.side).leader];
    }

    // ---------- actions ----------
    async playCard(side, cid, { slot, target } = {}) {
      const p = this.me(side);
      const idx = p.hand.findIndex((c) => c.cid === cid);
      const card = p.hand[idx];
      if (!card || !this.canPlay(side, card)) return false;
      if (card.type === 'unit') {
        if (slot == null || p.board[slot]) slot = this.freeSlots(side)[0];
      } else if (card.target) {
        const valid = this.targetsFor(side, card.target, card.filter);
        target = target && valid.find((t) => t.uid === target.uid);
        if (!target) return false;
      }
      p.hand.splice(idx, 1);
      p.gold -= card.cost;
      this.count(side, 'cards');
      if (card.type === 'spell') this.count(side, 'items');
      if (card.cost >= 5) this.count(side, 'big');
      const novel = MB.novelOf(card.id);
      if (side === 0 && novel) this.tally.novel[novel] = (this.tally.novel[novel] || 0) + 1;
      await this.view.cardPlayed(side, card);
      if (card.type === 'unit') {
        this.view.log(`${side ? 'Enemy' : 'You'} played ${card.name}.`);
        const u = await this.summon(side, card, slot);
        if (u && card.onPlay) await this.trigger(card.onPlay, u);
      } else {
        this.view.log(`${side ? 'Enemy' : 'You'} used ${card.name}${target ? ' on ' + this.nameOf(target) : ''}.`);
        const combo = this.comboFor(side, card, target);
        if (typeof card.effect === 'object') { // a spec (effects.js)
          const r = MB.Effects.prepare(this, card.effect, { side, target });
          await this.view.spellFx(side, card, target, () => r.sync());
          await r.after();
        } else {
          await this.view.spellFx(side, card, target, () => this.spellEffect(side, card, target));
          await this.spellAfter(side, card, target);
        }
        if (combo && !this.over && combo.u.hp > 0 && this.find(combo.u.uid) === combo.u) await this.comboUp(combo.u, combo.combo, card);
      }
      await this.resolveDeaths();
      await this.checkBonds(side);
      this.view.refresh();
      return true;
    }

    async usePower(side, target) {
      const p = this.me(side), pw = p.power;
      if (!this.canPower(side)) return false;
      if (pw.target) {
        target = target && this.targetsFor(side, pw.target, pw.filter).find((t) => t.uid === target.uid);
        if (!target) return false;
      }
      p.gold -= pw.cost; p.powerUsed = true;
      this.count(side, 'powers');
      this.view.log(`${side ? 'Enemy' : 'You'} used ${pw.name}${target ? ' on ' + this.nameOf(target) : ''}.`);
      if (typeof pw.effect === 'object') { // a spec (effects.js)
        const r = MB.Effects.prepare(this, pw.effect, { side, target });
        await this.view.powerFx(side, pw, target, () => r.sync(), r.targets);
        await r.after();
      } else {
        await this.view.powerFx(side, pw, target, () => this.powerEffect(side, pw, target));
        await this.powerAfter(side, pw, target);
      }
      await this.resolveDeaths();
      this.view.refresh();
      return true;
    }

    async attack(attacker, target) {
      if (!this.canAttack(attacker)) return false;
      if (!this.attackTargets(attacker).some((t) => t.uid === target.uid)) return false;
      attacker.attacksLeft--;
      this.count(attacker.side, 'attacks');
      const tipsy = attacker.kw.has('tipsy');
      if (tipsy) target = pick(this.attackTargets(attacker));
      if (attacker.kw.has('stealth')) { attacker.kw.delete('stealth'); this.view.react({ type: 'reveal', ent: attacker }); }
      if (attacker.onAttack) { // may take out the target (or the attacker) before the blow lands
        await this.trigger(attacker.onAttack, attacker);
        await this.resolveDeaths();
        if (this.over || !this.find(attacker.uid) || !this.find(target.uid) || target.hp <= 0) { this.view.refresh(); return true; }
      }
      this.view.log(`${attacker.name} → ${this.nameOf(target)} (${attacker.card.attack.name})${tipsy ? ' *hic*' : ''}`);
      await this.view.attackFx(attacker, target, () => {
        const dealt = this.deal(target, attacker.atk * this.rivalry(attacker, target), attacker);
        if (!target.isLeader && !attacker.kw.has('ranged') && target.atk > 0) this.deal(attacker, target.atk * this.rivalry(target, attacker), target, true);
        return dealt;
      });
      await this.resolveDeaths();
      this.view.refresh();
      return true;
    }

    // ---------- core mechanics ----------
    nameOf(e) { return e.isLeader ? (e.side === 0 ? 'your leader' : 'enemy leader') : e.name; }
    // Lilith and Celeste hit each other twice as hard
    rivalry(a, t) { return !t.isLeader && a.card.rival && a.card.rival === t.card.id ? 2 : 1; }

    summon(side, card, slot) {
      const p = this.me(side);
      if (slot == null || p.board[slot]) slot = this.freeSlots(side)[0];
      if (slot == null) return null;
      const u = {
        uid: 'u' + (++uidSeq), card, name: card.name, side, slot,
        atk: card.atk, hp: card.hp, maxHp: card.hp, kw: new Set(card.kw),
        shield: card.kw.includes('shield'), frozen: false, thaw: false, burning: false,
        sick: true, attacksLeft: 0, onTurnStart: card.onTurnStart, onDeath: card.onDeath,
        onHurt: card.onHurt, onAllyDeath: card.onAllyDeath, onAttack: card.onAttack, onKill: card.onKill, onTurnEnd: card.onTurnEnd,
      };
      if (u.kw.has('haste')) { u.attacksLeft = u.kw.has('frenzy') ? 2 : 1; }
      p.board[slot] = u;
      return this.view.summon(u).then(() => u);
    }

    // ---------- relationships ----------
    // first bond (MB.BONDS order) whose two members both stand, unfused, on this side
    findBond(side) {
      const us = this.units(side).filter((u) => u.hp > 0 && !u.card.fused);
      for (const bond of MB.BONDS) {
        const a = us.find((u) => u.card.id === bond.pair[0]), b = us.find((u) => u.card.id === bond.pair[1]);
        if (a && b) return { bond, a, b };
      }
      return null;
    }

    async checkBonds(side) {
      for (let guard = 0; guard < 4 && !this.over; guard++) {
        const f = this.findBond(side);
        if (!f) return;
        await this.fuse(side, f.bond, f.a, f.b);
      }
    }

    // the two partners merge into one duo unit in the slot of whoever was there first
    async fuse(side, bond, a, b) {
      const p = this.me(side);
      const [stay, go] = +a.uid.slice(1) < +b.uid.slice(1) ? [a, b] : [b, a];
      const atk = Math.max(0, a.atk + b.atk + bond.bonus[0]), maxHp = a.maxHp + b.maxHp + bond.bonus[1];
      const card = {
        id: 'bond:' + bond.id, cid: ++uidSeq, type: 'unit', fused: true, bond, rarity: 'bond',
        name: bond.name, cost: a.card.cost + b.card.cost, atk, hp: maxHp, kw: bond.kw.slice(),
        text: bond.text, attack: bond.attack, members: bond.pair.map((id, i) => ({ id, costume: bond.costumes[i] })),
      };
      const kw = new Set(bond.kw);
      const u = {
        uid: 'u' + (++uidSeq), card, name: bond.name, side, slot: stay.slot,
        atk, hp: a.hp + b.hp + bond.bonus[1], maxHp, kw,
        shield: kw.has('shield') || a.shield || b.shield, frozen: false, thaw: false, burning: false,
        sick: false, attacksLeft: this.active === side ? (kw.has('frenzy') ? 2 : 1) : 0,
        onTurnStart: a.onTurnStart || b.onTurnStart, onTurnEnd: a.onTurnEnd || b.onTurnEnd, onDeath: null,
      };
      p.board[a.slot] = null; p.board[b.slot] = null; p.board[u.slot] = u;
      this.view.log(`💞 ${a.name} & ${b.name} → ${bond.name}!`);
      this.count(side, 'bonds');
      await this.view.fuse(stay, go, u, bond);
      if (bond.onFuse) await this.trigger(bond.onFuse, u);
      else { await this.resolveDeaths(); this.view.refresh(); }
    }

    // a boss rule (or its rage) goes off from the enemy leader; false when it had nothing to hit
    async bossRule(rule, rage) {
      const r = MB.Effects.prepare(this, rule.effect, { side: 1 });
      if (r.empty) return false;
      this.view.log(`👑 ${rule.name}!`);
      await this.view.bossFx(this.boss, rule, r.targets, () => r.sync(), rage);
      await r.after();
      await this.resolveDeaths();
      this.view.refresh();
      return true;
    }

    // ---------- item combos ----------
    // characters on this side that would combo with this item card: [{ combo, u }]
    comboPartners(side, card) {
      if (card.type !== 'spell') return [];
      return MB.COMBOS.filter((c) => c.items.includes(card.id)).flatMap((c) => this.units(side)
        .filter((u) => u.card.id === c.char && !u.card.combo && u.hp > 0).map((u) => ({ combo: c, u })));
    }

    // the partner this play combos with: an item aimed at one of your monsters only combos with the one it hits
    comboFor(side, card, target) {
      const ps = this.comboPartners(side, card);
      if (target && !target.isLeader && target.side === side) return ps.find((p) => p.u === target) || null;
      return ps[0] || null;
    }

    // the partner changes into the combo (after the item's own effect)
    async comboUp(u, c, item) {
      this.view.log(`🔗 ${u.name} + ${item.name} → ${c.name}!`);
      this.count(u.side, 'combos');
      u.card = { ...u.card, combo: c, name: c.name };
      u.name = c.name;
      if (c.costume) u.costume = c.costume;
      const [atk, hp] = c.bonus || [0, 0];
      u.atk += atk; u.maxHp += hp; u.hp += hp;
      (c.kw || []).forEach((k) => { if (k === 'shield') u.shield = true; else u.kw.add(k); });
      await this.view.combo(u, c, item);
      if (c.onCombo) await this.trigger(c.onCombo, u);
      else { await this.resolveDeaths(); this.view.refresh(); }
    }

    // Applies damage immediately and tells the view; returns damage actually dealt.
    // A Guardian steps in front of its leader unless `self` (fatigue, self-inflicted costs).
    deal(target, amount, source, counter, self) {
      if (amount <= 0 || !target || target.hp <= 0) return 0;
      if (target.isLeader && !self) {
        const g = this.units(target.side).find((u) => u.kw.has('guardian') && u.hp > 0);
        if (g) { this.view.react({ type: 'guard', ent: g }); target = g; }
      }
      if (target.shield) {
        target.shield = false;
        this.view.react({ type: 'shieldBreak', ent: target });
        return 0;
      }
      target.hp -= amount;
      if (target.isLeader && !self) this.count(1 - target.side, 'face', amount);
      this.view.react({ type: 'damage', ent: target, amount, counter });
      if (!target.isLeader) target.killedBy = source && !source.isLeader ? source : null; // for onKill, if this blow is fatal
      if (source && !source.isLeader) {
        if (source.kw.has('lifesteal')) this.heal(this.me(source.side).leader, amount);
        if (!target.isLeader && source.kw.has('poison') && target.hp > 0) {
          target.hp = 0; this.view.react({ type: 'poison', ent: target });
        }
        if (!target.isLeader && source.kw.has('freeze') && target.hp > 0) this.freeze(target);
        if (!target.isLeader && source.kw.has('burn') && target.hp > 0) this.ignite(target);
      }
      // Betty: every scar makes her tougher
      if (target.onHurt === 'scarred' && target.hp > 0) {
        target.atk++;
        this.view.react({ type: 'buff', ent: target, atk: 1, hp: 0, label: 'Scarred! +1 ATK' });
      } else if (target.onHurt && target.hp > 0) (this.hurt || (this.hurt = [])).push(target); // runs in resolveDeaths
      return amount;
    }

    heal(t, n) {
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + n);
      this.count(t.side, 'healed', t.hp - before);
      if (t.hp > before) this.view.react({ type: 'heal', ent: t, amount: t.hp - before });
      if (t.burning) { t.burning = false; this.view.react({ type: 'extinguish', ent: t }); }
    }

    ignite(u) {
      if (u.isLeader || u.burning) return;
      u.burning = true;
      this.view.react({ type: 'burn', ent: u });
    }

    swapStats(u, label) {
      [u.atk, u.hp] = [u.hp, u.atk];
      u.maxHp = Math.max(u.hp, 1);
      this.view.react({ type: 'buff', ent: u, atk: 0, hp: 0, label });
    }

    giveKeyword(u, k, label) {
      u.kw.add(k);
      this.view.react({ type: 'buff', ent: u, atk: 0, hp: 0, label });
    }

    // put a card straight into the hand (with a fresh cid); burns it when the hand is full
    async addToHand(side, id, mod) {
      const p = this.me(side), card = { ...cardDef(id), cid: ++uidSeq, ...mod };
      if (p.hand.length >= R.maxHand) { await this.view.burn(side, card); return false; }
      p.hand.push(card);
      await this.view.drawCard(side, card);
      return true;
    }

    buff(u, atk, hp) {
      u.atk = Math.max(0, u.atk + atk);
      if (hp) { u.maxHp += hp; u.hp += hp; }
      this.view.react({ type: atk < 0 ? 'debuff' : 'buff', ent: u, atk, hp });
    }

    freeze(u) {
      // thaw happens at the end of the owner's next full turn
      u.frozen = true; u.thaw = false; u.attacksLeft = 0;
      this.view.react({ type: 'freeze', ent: u });
    }

    async resolveDeaths() {
      // onHurt specs of the monsters that survived damage since the last check
      for (let guard = 0; this.hurt && this.hurt.length && guard < 20 && !this.over; guard++) {
        const u = this.hurt.shift();
        if (u.hp > 0 && this.find(u.uid)) await this.trigger(u.onHurt, u);
      }
      for (let guard = 0; guard < 10; guard++) {
        for (const p of this.players) if (p.leader.hp <= 0 && !this.over) { this.over = true; this.winner = 1 - p.side; }
        const dead = this.allUnits().filter((u) => u.hp <= 0);
        if (!dead.length) break;
        for (const u of dead) { this.me(u.side).board[u.slot] = null; this.count(1 - u.side, 'kills'); this.count(u.side, 'lost'); }
        await this.view.death(dead);
        for (const u of dead) if (u.onDeath) await this.trigger(u.onDeath, u);
        for (const u of dead) for (const a of this.units(u.side)) if (a.onAllyDeath && a.hp > 0) await this.trigger(a.onAllyDeath, a);
        for (const u of dead) { const k = u.killedBy; if (k && k.onKill && k.side !== u.side && k.hp > 0 && this.find(k.uid)) await this.trigger(k.onKill, k); }
      }
      for (const p of this.players) if (p.leader.hp <= 0 && !this.over) { this.over = true; this.winner = 1 - p.side; }
      // a boss flies into a rage at half HP (as soon as the rage has something to hit)
      const bl = this.me(1).leader;
      if (this.boss && this.boss.rage && !this.raged && !this.over && bl.hp <= bl.maxHp / 2) {
        this.raged = true;
        if (!(await this.bossRule(this.boss.rage, true))) this.raged = false;
      }
      if (this.over && !this.overShown) { this.overShown = true; this.view.refresh(); await this.view.gameOver(this.winner); }
    }

    // ---------- card abilities ----------
    async trigger(key, u) {
      const side = u.side, foeUnits = this.units(1 - side);
      const fx = (label, targets, fn, color) => this.view.abilityFx(u, label, targets, fn, color);
      if (typeof key === 'object') await MB.Effects.trigger(this, key, u); // a spec (effects.js)
      else switch (key) {
        case 'momHug': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) await fx("Mom's Hug", allies, () => allies.forEach((a) => this.buff(a, 0, 2)), '#5fd068');
          break;
        }
        case 'cheer': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) { const a = pick(allies); await fx('Cheer!', [a], () => this.buff(a, 1, 0), '#ff8ad8'); }
          break;
        }
        case 'soothe': await fx('Soothe', [this.me(side).leader], () => this.heal(this.me(side).leader, 3), '#ffb3dc'); break;
        case 'giddyPop': {
          const t = pick([...foeUnits, this.foe(side).leader]);
          await fx('Giddy Pop!', [t], () => this.deal(t, 1, null), '#c58cff');
          break;
        }
        case 'kids': {
          for (let i = 0; i < 2 && this.freeSlots(side).length; i++) await this.summon(side, cardDef('kid'), this.nearestFree(side, u.slot));
          break;
        }
        case 'badJoke': {
          if (foeUnits.length) { const t = pick(foeUnits); await fx('Bad Joke...', [t], () => this.buff(t, -2, 0), '#ffe066'); }
          break;
        }
        case 'drawOne': await this.draw(side); break;
        case 'goldenRain':
          if (foeUnits.length) await fx('Golden Rain', foeUnits, () => foeUnits.forEach((t) => this.deal(t, 2, null)), '#ffcc33');
          break;
        case 'tide': {
          const all = [...this.units(side), this.me(side).leader].filter((t) => t.hp < t.maxHp);
          if (all.length) await fx('Tide', all, () => all.forEach((t) => this.heal(t, 1)), '#3fb6ff');
          break;
        }
        case 'sideHustle': this.me(side).gold++; await fx('+1 Gold', [], () => {}, '#ffcc33'); break;
        case 'hellfire':
          if (foeUnits.length) await fx('Hellfire!', foeUnits, () => foeUnits.forEach((t) => this.ignite(t)), '#ff4a1c');
          break;
        case 'halo': {
          const allies = this.units(side).filter((a) => a !== u && !a.shield);
          if (allies.length) await fx('Divine Halo', allies, () => allies.forEach((a) => { a.shield = true; this.view.react({ type: 'shield', ent: a }); }), '#ffe9a0');
          break;
        }
        case 'popQuiz': {
          const odd = foeUnits.filter((t) => t.atk % 2 === 1);
          await fx(odd.length ? 'Pop Quiz!' : 'Pop Quiz... all even?!', odd, () => odd.forEach((t) => this.deal(t, 2, null)), '#3ddc84');
          break;
        }
        case 'tsundere': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) { const a = pick(allies); await fx("I-it's not like I care!", [a], () => { this.deal(a, 1, null); if (a.hp > 0) this.buff(a, 2, 0); }, '#ff5c8a'); }
          break;
        }
        case 'repaint': {
          const t = foeUnits.slice().sort((a, c) => c.atk - a.atk)[0];
          if (t) await fx('Repaint!', [t], () => this.swapStats(t, 'Repainted!'), '#29c5ff');
          break;
        }
        // relationship fusions
        case 'judgment':
          if (foeUnits.length) await fx('Judgment!', foeUnits, () => foeUnits.forEach((t) => { this.deal(t, 2, null); if (t.hp > 0) this.ignite(t); }), '#ff7ad9');
          break;
        case 'groupHug': {
          const leader = this.me(side).leader, allies = this.units(side).filter((a) => a !== u);
          await fx('Group Hug!', [leader, ...allies], () => { this.heal(leader, 8); allies.forEach((a) => this.buff(a, 1, 2)); }, '#ff4f5e');
          break;
        }
        case 'anniversary': {
          const allies = this.units(side).filter((a) => a !== u && !a.shield);
          if (allies.length) await fx('Anniversary!', allies, () => allies.forEach((a) => { a.shield = true; this.view.react({ type: 'shield', ent: a }); }), '#ff8f6b');
          break;
        }
        case 'discipline': this.me(side).gold++; await fx('Discipline! +1 Gold', [], () => {}, '#ff6a3d'); break;
        case 'inheritance': await fx('Inheritance!', [], () => {}, '#ffcc33'); await this.draw(side); await this.draw(side); break;
        case 'eclipse': {
          const t = foeUnits.slice().sort((x, y) => y.atk - x.atk)[0];
          if (t) await fx('Eclipse!', [t], () => { t.hp = 0; this.view.react({ type: 'poison', ent: t }); }, '#9b4dff');
          break;
        }
        case 'pepTalk': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) await fx('Pep Talk!', allies, () => allies.forEach((a) => this.buff(a, 1, 0)), '#ffb0d9');
          break;
        }
        case 'chainCheer': {
          const allies = this.units(side).filter((a) => a !== u), t = foeUnits.slice().sort((x, y) => y.atk - x.atk)[0];
          if (allies.length || t) await fx('Cheer & Chain!', t ? [...allies, t] : allies, () => { allies.forEach((a) => this.buff(a, 1, 0)); if (t) this.freeze(t); }, '#ff7ac6');
          break;
        }
        case 'partyGuests':
          if (this.freeSlots(side).length) await fx('Party Guests!', [], () => {}, '#c58cff');
          for (let i = 0; i < 2 && this.freeSlots(side).length; i++) await this.summon(side, cardDef('teddy'), this.nearestFree(side, u.slot));
          break;
        case 'bookworm':
          if (this.me(side).hand.length <= 3) { await fx('Bookworm', [], () => {}, '#9a8cff'); await this.draw(side); }
          break;
        // Between the Peaks
        case 'polyglot': {
          const own = MB.charById(u.card.id).novel, novels = new Set();
          this.units(side).filter((a) => a !== u).forEach((a) => this.cardIds(a).forEach((id) => { const c = MB.charById(id); if (c && c.novel !== own) novels.add(c.novel); }));
          const n = Math.min(2, novels.size);
          await fx(n ? 'Polyglot!' : 'Bonjour?', [], () => {}, '#4f7dff');
          for (let i = 0; i < n; i++) await this.draw(side);
          break;
        }
        case 'flashbang': {
          const hit = foeUnits.filter((t) => !t.frozen);
          await fx('FLASHBANG!', [...hit, u], () => { hit.forEach((t) => this.freeze(t)); this.freeze(u); }, '#ffffff');
          break;
        }
        case 'couponGift': await fx('Coupon!', [], () => {}, '#ffd23f'); await this.addToHand(side, 'coupon'); break;
        case 'parcel': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) { const a = pick(allies); await fx('Parcel!', [a], () => this.buff(a, 1, 1), '#e2b04a'); }
          break;
        }
        case 'steadfast': if (u.hp < u.maxHp) await fx('Steadfast', [u], () => this.heal(u, 2), '#4caf6a'); break;
        // The Lifeguard has Teeth
        case 'chomp': {
          const t = foeUnits.slice().sort((x, y) => x.hp - y.hp)[0];
          if (t) await fx('CHOMP!', [t], () => { t.hp = 0; this.view.react({ type: 'poison', ent: t }); }, '#8a6cff');
          break;
        }
        case 'wrestle': {
          const t = foeUnits.filter((x) => !x.frozen).sort((x, y) => y.atk - x.atk)[0];
          if (t) await fx('Pinned!', [t], () => this.freeze(t), '#c8894a');
          break;
        }
        case 'gentleGiant': {
          const all = [...this.units(side).filter((a) => a !== u), this.me(side).leader].filter((t) => t.hp < t.maxHp);
          if (all.length) await fx('Gentle Giant', all, () => all.forEach((t) => this.heal(t, 2)), '#5ec8e6');
          break;
        }
        case 'smashFix': {
          if (foeUnits.length) { const t = pick(foeUnits); await fx('Smash!', [t], () => this.deal(t, 3, null), '#e0463c'); }
          const hurt = this.units(side).filter((a) => a !== u && a.hp > 0 && a.hp < a.maxHp);
          if (hurt.length) { const a = pick(hurt); await fx('...Fixed.', [a], () => this.heal(a, 3), '#6fff9a'); }
          break;
        }
        case 'firstAid': {
          const t = [...this.units(side), this.me(side).leader].filter((x) => x.hp < x.maxHp).sort((x, y) => (y.maxHp - y.hp) - (x.maxHp - x.hp))[0];
          if (t) await fx('First Aid!', [t], () => this.heal(t, 4), '#3fd0a8');
          break;
        }
        // The yuri assist
        case 'spite': await fx('Spite!', [u], () => this.buff(u, 2, 0), '#8e7dff'); break;
        case 'rally': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) await fx('Rally!', allies, () => allies.forEach((a) => {
            this.buff(a, 1, 1);
            if (!a.frozen && this.active === side) a.attacksLeft = Math.max(a.attacksLeft, a.kw.has('frenzy') ? 2 : 1);
          }), '#3f6fe0');
          break;
        }
        case 'buzzer': { const t = this.foe(side).leader; await fx('Buzzer!', [t], () => this.deal(t, 1, null), '#f06a2a'); break; }
        // new relationship fusions
        case 'aisleFive':
          await fx('Clearance!', [], () => {}, '#4caf6a');
          for (let i = 0; i < 2; i++) await this.addToHand(side, pick(MB.itemCards()));
          break;
        case 'mayhem': {
          const all = [...foeUnits, this.foe(side).leader];
          await fx('MAYHEM!', all, () => all.forEach((t) => this.deal(t, 1, null)), '#ffd23f');
          break;
        }
        case 'feedingFrenzy':
          if (foeUnits.length) await fx('Feeding Frenzy!', foeUnits, () => foeUnits.forEach((t) => this.deal(t, 2, null)), '#7a8cff');
          break;
        case 'crabFeast': {
          const all = [...this.units(side), this.me(side).leader].filter((t) => t.hp < t.maxHp);
          if (all.length) await fx('Crab Feast!', all, () => all.forEach((t) => this.heal(t, 3)), '#4fc3e8');
          break;
        }
        case 'repairKit': {
          const allies = this.units(side).filter((a) => a !== u);
          if (allies.length) await fx('Repair Kit!', allies, () => allies.forEach((a) => { this.heal(a, a.maxHp); this.buff(a, 1, 0); }), '#ff7a45');
          break;
        }
        case 'firstDate': {
          const allies = this.units(side).filter((a) => a !== u);
          await fx('First Date!', allies, () => allies.forEach((a) => this.buff(a, 1, 1)), '#ff7ab8');
          await this.draw(side); await this.draw(side);
          break;
        }
        case 'swish': { const t = this.foe(side).leader; await fx('SWISH!', [t], () => this.deal(t, 3, null), '#ff8a3d'); break; }
      }
      await this.resolveDeaths();
      this.view.refresh();
    }

    // the real cards behind a board unit (a duo is two cards)
    cardIds(u) { return u.card.fused ? u.card.members.map((m) => m.id) : [u.card.id]; }

    nearestFree(side, slot) {
      const free = this.freeSlots(side);
      return free.sort((a, b) => Math.abs(a - slot) - Math.abs(b - slot))[0];
    }

    spellEffect(side, card, t) {
      const foeUnits = this.units(1 - side);
      switch (card.effect) {
        case 'bagSwing': this.deal(t, 2, null); break;
        case 'towelOff': this.heal(t, 5); if (t.frozen) { t.frozen = false; t.thaw = false; this.view.react({ type: 'thaw', ent: t }); } break;
        case 'stick': this.buff(t, 2, 2); break;
        case 'mansion': foeUnits.forEach((u) => this.deal(u, 3, null)); break;
        case 'beer': this.buff(t, 2, 0); this.giveKeyword(t, 'tipsy', 'Tipsy! *hic*'); break;
        case 'coupon': this.me(side).gold++; break;
        case 'podium': this.buff(t, 2, 2); this.giveKeyword(t, 'taunt', 'Speech!'); break;
        case 'necklace': t.shield = true; this.giveKeyword(t, 'lifesteal', 'Lucky gem!'); break;
        case 'melon': this.deal(t, 3, null); this.heal(this.me(side).leader, 2); break;
        case 'divingMask': this.giveKeyword(t, 'stealth', 'Dive!'); break;
        case 'waterGun':
          for (let i = 0; i < 3; i++) {
            const alive = [...foeUnits.filter((e) => e.hp > 0 && !e.kw.has('stealth')), this.foe(side).leader];
            this.deal(pick(alive), 1, null);
          }
          break;
      }
    }

    async spellAfter(side, card, t) {
      if (card.effect === 'allowance') { await this.draw(side); await this.draw(side); }
      if (card.effect === 'deliveryBox') for (let i = 0; i < 2; i++) await this.addToHand(side, pick(MB.itemCards()));
      if (card.effect === 'exchange' && t && t.hp > 0) {
        this.me(side).board[t.slot] = null;
        await this.view.unsummon(t);
        for (const id of this.cardIds(t)) await this.addToHand(side, id, { cost: Math.max(0, (t.card.fused ? MB.CARDS[id].cost : t.card.cost) - 1) });
      }
      if (card.effect === 'sketch' && t) for (const id of this.cardIds(t)) await this.addToHand(side, id);
      if (card.effect === 'closet') {
        const deck = this.me(side).deck, units = deck.filter((c) => c.type === 'unit');
        if (!units.length) { this.view.log('The closet is empty...'); return; }
        const c = pick(units);
        deck.splice(deck.indexOf(c), 1);
        const u = await this.summon(side, c, this.freeSlots(side)[0]);
        if (u && c.onPlay) await this.trigger(c.onPlay, u);
      }
      if (card.effect === 'callFriend') {
        const pool = Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token && !MB.CARDS[id].type && MB.CARDS[id].cost <= 3);
        await this.summon(side, cardDef(pick(pool)), this.freeSlots(side)[0]);
      }
    }

    powerEffect(side, pw, t) {
      const me = this.me(side), foe = this.foe(side);
      switch (pw.effect) {
        case 'hug': this.buff(t, 0, 2); break;
        case 'cheerUp': this.buff(t, 1, 0); break;
        case 'ping': this.deal(t, 1, null); break;
        case 'facePunch': this.deal(foe.leader, 2, null); break;
        case 'heal3': this.heal(t, 3); break;
        case 'gloom': this.buff(t, -2, 0); break;
        case 'chill': this.deal(me.leader, 2, null, false, true); break;
        case 'dinner': this.units(side).forEach((u) => this.buff(u, 0, 1)); break;
        case 'giveShield': t.shield = true; this.view.react({ type: 'shield', ent: t }); break;
        case 'groan': this.units(1 - side).forEach((u) => this.deal(u, 1, null)); break;
        case 'pump': this.buff(t, 2, 0); break;
        case 'bribe': t.hp = 0; this.view.react({ type: 'poison', ent: t }); break;
        case 'freezeOne': this.freeze(t); break;
        case 'tideAll': [...this.units(side), me.leader].forEach((u) => this.heal(u, 2)); break;
        case 'overtime': t.attacksLeft = t.kw.has('frenzy') ? 2 : 1; this.view.react({ type: 'buff', ent: t, atk: 0, hp: 0, label: 'Overtime!' }); break;
        case 'ignite': this.ignite(t); break;
        case 'bless': this.heal(t, t.maxHp); break;
        case 'drill': this.buff(t, 1, 1); break;
        case 'tease':
          t.kw.delete('taunt'); t.shield = false;
          this.view.react({ type: 'debuff', ent: t, atk: 0, label: 'Exposed!' });
          break;
        case 'swapStats': this.swapStats(t, 'Swapped!'); break;
        case 'partyFoul':
          for (let i = 0; i < 2; i++) {
            const alive = [...this.units(1 - side).filter((e) => e.hp > 0 && !e.kw.has('stealth')), foe.leader];
            this.deal(pick(alive), 1, null);
          }
          break;
        case 'nap': this.heal(me.leader, 4); break;
        case 'untranslate':
          t.kw.clear(); t.shield = false;
          this.view.react({ type: 'debuff', ent: t, atk: 0, label: 'Lost in translation!' });
          break;
        case 'scarPact': this.deal(t, 1, null); if (t.hp > 0) this.buff(t, 2, 0); break;
        case 'partyHard': this.units(side).forEach((u) => this.buff(u, 1, 0)); this.deal(me.leader, 2, null, false, true); break;
        case 'onTheHouse': this.heal(t, 2); if (!t.isLeader) this.buff(t, 1, 0); break;
        case 'sneakOut': this.giveKeyword(t, 'rebel', 'Rebel!'); break;
        case 'bigSis': this.buff(t, 0, 2); this.giveKeyword(t, 'taunt', 'Big Sis Hug!'); break;
        case 'crabBoil': this.units(side).forEach((u) => this.heal(u, 3)); break;
        case 'overhaul': this.deal(t, 1, null); if (t.hp > 0) this.buff(t, 1, 2); break;
        case 'cpr':
          this.heal(t, 4);
          if (t.frozen) { t.frozen = false; t.thaw = false; this.view.react({ type: 'thaw', ent: t }); }
          break;
        case 'darkJoke': this.deal(t, 1, null); break;
        case 'takeCharge': this.buff(t, 1, 0); t.attacksLeft = 1; break;
        case 'threePointer': this.deal(pick([...this.units(1 - side).filter((e) => !e.kw.has('stealth')), foe.leader]), 3, null); break;
      }
    }

    // puts the deck card choose(deck) returns on top (if any), then draws; nothing happens on an empty deck
    async drawChosen(side, choose) {
      const deck = this.me(side).deck;
      if (!deck.length) return;
      const c = choose(deck);
      if (c) { deck.splice(deck.indexOf(c), 1); deck.push(c); } // draw() takes from the end
      await this.draw(side);
    }

    async powerAfter(side, pw, t) {
      if (pw.effect === 'chill' || pw.effect === 'readUp') await this.draw(side);
      if (pw.effect === 'research') await this.drawChosen(side, (deck) => deck.reduce((a, b) => (b.cost < a.cost ? b : a)));
      if (pw.effect === 'infoDump') await this.drawChosen(side, (deck) => deck.reduce((a, b) => (b.cost > a.cost ? b : a)));
      if (pw.effect === 'storeCredit') await this.drawChosen(side, (deck) => deck.filter((c) => c.type === 'spell').pop());
      if (pw.effect === 'delivery') await this.addToHand(side, pick(MB.itemCards()));
      if (pw.effect === 'darkJoke' && t && t.hp <= 0) await this.draw(side);
      if (pw.effect === 'teddy') await this.summon(side, cardDef('teddy'), this.freeSlots(side)[0]);
      if (pw.effect === 'seagull') await this.summon(side, cardDef('seagull'), this.freeSlots(side)[0]);
    }
  }

  MB.Battle = Battle;
  MB.cardDef = cardDef;
  MB.shuffle = shuffle;
  MB.pick = pick;
})();
