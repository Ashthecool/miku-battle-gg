// Battle view: a CSS-3D tilted board with paper-cutout sprites, animated with GSAP.
(function () {
  const ROW_Y = [548, 232];              // board-space y of the player (0) and enemy (1) rows
  const SLOT_X = [215, 465, 715, 965];
  const LEADER_POS = [{ x: 60, y: 700 }, { x: 1120, y: 60 }];
  const UNIT_H = 235, LEADER_H = 290;

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // costume: a costume id from the manifest, null for the usual outfit, undefined for the wardrobe choice
  MB.spriteUrl = (charId, role, costume) => {
    const c = MB.charById(charId);
    if (!c) return '';
    if (costume === undefined) costume = MB.UI && MB.UI.save.costumes[charId];
    const o = costume && c.costumes.find((x) => x.id === costume);
    const set = o ? o.sprites : c.sprites;
    return 'assets/' + (set[role] || set.idle);
  };
  // a relationship duo: both partners side by side in their fusion costumes
  MB.duoHtml = (card, role = 'idle') => card.members.map((m) => `<img class="sprite" draggable="false" src="${MB.spriteUrl(m.id, role, m.costume)}">`).join('');

  class View {
    constructor() {
      this.root = document.getElementById('ui-root');
      this.arena = document.getElementById('arena');
      this.camera = document.getElementById('camera');
      this.board = document.getElementById('board');
      this.fxLayer = document.getElementById('fx-layer');
      this.handEl = document.getElementById('hand');
      this.arrow = document.getElementById('aim-arrow');
      this.ents = new Map(); // uid -> { el, figure, img, plate, ent }
      this.tilt = 52;
      this.buildSlots();
      this.bindInput();
      this.parallax();
    }

    // ---------- geometry ----------
    pos(ent) {
      if (ent.isLeader) return LEADER_POS[ent.side];
      return { x: SLOT_X[ent.slot], y: ROW_Y[ent.side] };
    }
    slotPos(side, slot) { return { x: SLOT_X[slot], y: ROW_Y[side] }; }
    heightOf(ent) { return ent.isLeader ? LEADER_H : UNIT_H; }
    setTilt(deg) { this.tilt = deg; this.board.style.setProperty('--tilt', deg + 'deg'); }

    // billboard element standing on the board at (x,y); its .bb-body can be lifted with gsap y (negative = up)
    billboard(cls, html, x, y) {
      const w = el('div', 'bb'), s = el('div', 'bb-stand'), b = el('div', 'bb-body ' + (cls || ''), html);
      s.appendChild(b); w.appendChild(s); this.fxLayer.appendChild(w);
      gsap.set(w, { x, y }); gsap.set(b, { xPercent: -50, yPercent: -50 });
      w.body = b;
      return w;
    }
    flat(cls, html, x, y) {
      const f = el('div', 'flat ' + (cls || ''), html);
      this.fxLayer.appendChild(f);
      gsap.set(f, { x, y, xPercent: -50, yPercent: -50 });
      return f;
    }
    // screen-space (ui-root units) center of an entity's sprite
    screenPos(ent) {
      const v = this.ents.get(ent.uid);
      if (!v) return { x: 800, y: 450 };
      const r = v.figure.getBoundingClientRect();
      return this.toUi(r.left + r.width / 2, r.top + r.height * 0.45);
    }
    toUi(cx, cy) {
      const rr = this.root.getBoundingClientRect(), s = rr.width / 1600;
      return { x: (cx - rr.left) / s, y: (cy - rr.top) / s };
    }

    buildSlots() {
      this.board.querySelectorAll('.slot').forEach((s) => s.remove());
      for (let side = 0; side < 2; side++) for (let i = 0; i < 4; i++) {
        const s = el('div', `slot side${side}`);
        s.dataset.side = side; s.dataset.slot = i;
        const p = this.slotPos(side, i);
        s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
        this.board.insertBefore(s, this.fxLayer);
      }
    }

    parallax() {
      window.addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        gsap.to('#bg', { x: -nx * 30, y: -ny * 18, duration: 1.2, ease: 'power2.out' });
        if (!this.aiming && !this.drag) gsap.to(this.camera, { rotationY: nx * 5, rotationX: -ny * 2.5, duration: 1.4, ease: 'power2.out' });
      });
    }

    // ---------- lifecycle ----------
    init(battle) {
      this.b = battle;
      this.clear();
      this.setTilt(52);
      for (const side of [0, 1]) this.addLeader(battle.me(side).leader);
      document.getElementById('battle-hud').classList.remove('hidden');
      this.arena.classList.remove('hidden');
      document.getElementById('log').innerHTML = '';
      const foe = MB.charById(battle.me(1).leaderId), me = MB.charById(battle.me(0).leaderId);
      document.getElementById('enemy-name').textContent = foe.name;
      document.getElementById('player-name').textContent = me.name;
      const pw = battle.me(0).power;
      document.getElementById('power-btn').innerHTML = `<div class="pw-cost">${pw.cost}</div><div class="pw-name">${pw.name}</div><div class="pw-text">${pw.text}</div>`;
      const epw = battle.me(1).power;
      document.getElementById('enemy-power').innerHTML = `<b>${epw.name}</b> (${epw.cost}): ${epw.text}`;
      this.refresh();
      gsap.fromTo(this.camera, { z: -600, rotationX: 20, opacity: 0 }, { z: 0, rotationX: 0, opacity: 1, duration: 1.4, ease: 'power3.out' });
    }

    clear() {
      this.ents.forEach((v) => v.el.remove());
      this.ents.clear();
      this.fxLayer.innerHTML = '';
      this.handEl.innerHTML = '';
      this.cancelAim();
    }

    // ---------- entity elements ----------
    makeFigure(ent, h) {
      const card = ent.card;
      const wrap = el('div', ent.isLeader ? 'unit leader' : 'unit');
      wrap.dataset.uid = ent.uid;
      const shadow = el('div', 'unit-shadow');
      const stand = el('div', 'stand');
      stand.style.height = h + 'px';
      const figure = el('div', 'figure');
      let img;
      if (card && card.emoji) { img = el('div', 'emoji-sprite', card.emoji); }
      else if (card && card.fused) { img = el('div', 'duo-sprite', MB.duoHtml(card)); }
      else { img = el('img', 'sprite'); img.src = MB.spriteUrl(ent.isLeader ? ent.charId : card.id, 'idle'); img.draggable = false; }
      figure.appendChild(img);
      const status = el('div', 'status');
      figure.appendChild(status);
      const plate = el('div', 'plate');
      stand.append(figure, plate);
      wrap.append(shadow, stand);
      this.board.insertBefore(wrap, this.fxLayer);
      const v = { el: wrap, stand, figure, img, plate, status, ent, emotion: 'idle' };
      this.ents.set(ent.uid, v);
      const p = this.pos(ent);
      gsap.set(wrap, { x: p.x, y: p.y });
      // idle breathing
      v.idle = gsap.to(img, { scaleY: 1.015, scaleX: 0.992, transformOrigin: '50% 100%', duration: 1.6 + Math.random(), yoyo: true, repeat: -1, ease: 'sine.inOut' });
      return v;
    }

    addLeader(leader) {
      const v = this.makeFigure(leader, LEADER_H);
      v.plate.classList.add('leader-plate');
      this.updatePlate(v);
      gsap.from(v.figure, { y: -500, opacity: 0, duration: 0.9, delay: 0.3 + leader.side * 0.2, ease: 'bounce.out' });
    }

    async summon(u) {
      const v = this.makeFigure(u, UNIT_H);
      this.updatePlate(v);
      const p = this.pos(u);
      MB.audio.sfx('play');
      const ring = this.flat('summon-ring', '', p.x, p.y);
      ring.style.setProperty('--c', u.card.attack.color);
      gsap.fromTo(ring, { scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => ring.remove() });
      const tl = gsap.timeline();
      tl.from(v.figure, { y: -420, opacity: 0, duration: 0.45, ease: 'power3.in' })
        .to(v.img, { scaleY: 0.8, scaleX: 1.15, duration: 0.08 })
        .to(v.img, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
      tl.call(() => { MB.FX.burst(this, p, u.card.attack.color, 14, { h: 20, spread: 110 }); this.shake(4); }, null, 0.45);
      this.emote(u, 'play', 1200);
      await tl;
    }

    updatePlate(v) {
      const e = v.ent;
      if (e.isLeader) {
        v.plate.innerHTML = `<span class="hp big ${e.hp < e.maxHp ? 'hurt' : ''}">${Math.max(0, e.hp)}</span>`;
      } else {
        const base = e.card;
        const kw = [...e.kw].map((k) => MB.KEYWORDS[k] ? `<i title="${MB.KEYWORDS[k].name}">${MB.KEYWORDS[k].icon}</i>` : '').join('');
        v.plate.innerHTML = `<span class="atk ${e.atk > base.atk ? 'up' : e.atk < base.atk ? 'down' : ''}">${e.atk}</span>` +
          (base.fused ? `<span class="pname bond">${MB.BOND_TIERS[base.bond.tier].hearts} ${base.bond.short}</span>` : `<span class="pname">${e.name.split(' ')[0]}</span>`) +
          `<span class="hp ${e.hp < e.maxHp ? 'hurt' : e.maxHp > base.hp ? 'up' : ''}">${Math.max(0, e.hp)}</span>` +
          (kw ? `<div class="kw">${kw}</div>` : '');
      }
      v.status.innerHTML = (e.shield ? '<div class="bubble"></div>' : '') + (e.frozen ? '<div class="ice"></div>' : '') +
        (e.burning ? '<div class="flames"><i></i><i></i><i></i></div>' : '') +
        (!e.isLeader && e.sick && e.attacksLeft === 0 && !e.frozen && this.b && e.side === this.b.active ? '<div class="zzz">z<span>z</span><span>z</span></div>' : '');
      v.el.classList.toggle('stealthed', !e.isLeader && e.kw.has('stealth'));
      const low = e.hp > 0 && e.hp / e.maxHp < 0.4;
      if (low !== v.low) { v.low = low; if (v.emotion === 'idle' || v.emotion === 'hurt') this.setSprite(v, low ? 'hurt' : 'idle'); }
    }

    setSprite(v, role) {
      v.emotion = role;
      const card = v.ent.card;
      if (card && card.fused) {
        [...v.img.children].forEach((im, i) => { const src = MB.spriteUrl(card.members[i].id, role, card.members[i].costume); if (!im.src.endsWith(src)) im.src = src; });
        return;
      }
      if (v.img.tagName !== 'IMG') return;
      const src = MB.spriteUrl(v.ent.isLeader ? v.ent.charId : v.ent.card.id, role);
      if (!v.img.src.endsWith(src)) v.img.src = src;
    }

    // temporarily switch a character's emotion sprite
    emote(ent, role, ms) {
      const v = this.ents.get(ent.uid);
      if (!v) return;
      clearTimeout(v.emoteTimer);
      this.setSprite(v, role);
      if (ms) v.emoteTimer = setTimeout(() => this.setSprite(v, v.low ? 'hurt' : 'idle'), ms);
    }

    // ---------- reactions (instant, called by engine) ----------
    react(evt) {
      const v = this.ents.get(evt.ent.uid);
      if (!v) return;
      const p = this.pos(evt.ent), h = this.heightOf(evt.ent);
      switch (evt.type) {
        case 'damage': {
          this.floatText(p, h, '-' + evt.amount, 'dmg');
          gsap.fromTo(v.img, { filter: 'brightness(4) saturate(0)' }, { filter: 'brightness(1) saturate(1)', duration: 0.35, clearProps: 'filter' });
          const dir = evt.ent.side === 0 ? 1 : -1;
          gsap.fromTo(v.figure, { x: (Math.random() - 0.5) * 30, y: -dir * 10 }, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
          this.emote(evt.ent, 'hurt', 900);
          this.shake(Math.min(18, 3 + evt.amount * 2));
          MB.audio.sfx('hit', evt.amount >= 5);
          if (evt.amount >= 5) this.hitStop();
          break;
        }
        case 'heal':
          this.floatText(p, h, '+' + evt.amount, 'heal');
          MB.FX.rise(this, p, '#6fff9a', 10, h);
          this.emote(evt.ent, 'play', 900);
          MB.audio.sfx('heal');
          break;
        case 'buff':
          this.floatText(p, h, evt.label || `+${evt.atk}/+${evt.hp}`, 'buff');
          MB.FX.rise(this, p, '#ffd84a', 8, h);
          gsap.fromTo(v.img, { filter: 'brightness(1.8) sepia(1)' }, { filter: 'brightness(1) sepia(0)', duration: 0.6, clearProps: 'filter' });
          this.emote(evt.ent, 'taunt', 1000);
          MB.audio.sfx('buff');
          break;
        case 'debuff':
          this.floatText(p, h, evt.label || `${evt.atk} ATK`, 'debuff');
          this.emote(evt.ent, 'lose', 1000);
          MB.audio.sfx('debuff');
          break;
        case 'shieldBreak':
          this.floatText(p, h, 'Blocked!', 'shield');
          MB.FX.burst(this, p, '#9fe8ff', 18, { h: h * 0.5, spread: 90 });
          MB.audio.sfx('shield');
          break;
        case 'shield': this.floatText(p, h, 'Shield!', 'shield'); MB.audio.sfx('shield'); break;
        case 'freeze': this.floatText(p, h, 'Frozen!', 'shield'); MB.FX.burst(this, p, '#bff4ff', 16, { h: h * 0.4, spread: 80, shape: 'shard' }); MB.audio.sfx('freeze'); break;
        case 'thaw': break;
        case 'poison': this.floatText(p, h, 'Destroyed!', 'debuff'); MB.FX.burst(this, p, '#a35cff', 18, { h: h * 0.5 }); break;
        case 'burn': this.floatText(p, h, 'Ablaze!', 'burn'); MB.FX.burst(this, p, '#ff6a1c', 16, { h: h * 0.3, spread: 70 }); MB.audio.sfx('zap'); break;
        case 'extinguish': MB.FX.rise(this, p, '#cfd8e0', 8, h * 0.6); break;
        case 'guard':
          this.floatText(p, h, 'Guarded!', 'shield');
          MB.FX.ring(this, p, '#ffe9a0', 1.8);
          this.emote(evt.ent, 'taunt', 900);
          MB.audio.sfx('shield');
          break;
        case 'reveal':
          this.floatText(p, h, 'Revealed!', 'ability');
          gsap.fromTo(v.img, { opacity: 0.3 }, { opacity: 1, duration: 0.4, clearProps: 'opacity' });
          break;
      }
      this.updatePlate(v);
    }

    floatText(p, h, text, cls) {
      const t = this.billboard('float-text ' + cls, text, p.x, p.y);
      gsap.set(t.body, { y: -h * 0.7 });
      gsap.timeline({ onComplete: () => t.remove() })
        .from(t.body, { scale: 2.2, opacity: 0, duration: 0.18, ease: 'back.out(3)' })
        .to(t.body, { y: -h - 70, duration: 1.1, ease: 'power2.out' }, 0.1)
        .to(t.body, { opacity: 0, duration: 0.35 }, 0.85);
    }

    shake(amt) {
      gsap.fromTo(this.camera, { x: (Math.random() - 0.5) * amt * 2, y: (Math.random() - 0.5) * amt * 2 },
        { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1.2,0.25)', overwrite: 'auto' });
    }
    hitStop() {
      gsap.globalTimeline.timeScale(0.08);
      setTimeout(() => gsap.globalTimeline.timeScale(1), 70);
    }
    // push the "camera" toward a board point, returns a restore fn
    focus(p, amount = 0.08) {
      const dx = (590 - p.x) * amount, dy = (380 - p.y) * amount * 0.6;
      gsap.to(this.camera, { scale: 1 + amount, x: dx, y: dy, duration: 0.5, ease: 'power2.out' });
      return () => gsap.to(this.camera, { scale: 1, x: 0, y: 0, duration: 0.7, ease: 'power2.inOut' });
    }

    // ---------- sequenced animations ----------
    async attackFx(att, tgt, impact) {
      const av = this.ents.get(att.uid), tv = this.ents.get(tgt.uid);
      av.el.classList.add('acting');
      this.emote(att, 'attack', 0);
      const restore = this.focus({ x: (this.pos(att).x + this.pos(tgt).x) / 2, y: (this.pos(att).y + this.pos(tgt).y) / 2 }, att.atk >= 5 ? 0.12 : 0.06);
      await MB.FX.attack(this, att, tgt, impact);
      restore();
      av.el.classList.remove('acting');
      if (this.ents.has(att.uid)) this.emote(att, 'idle', 0);
      this.updatePlate(av);
      if (tv) this.updatePlate(tv);
    }

    async abilityFx(u, label, targets, fn, color) {
      const p = this.pos(u);
      if (this.ents.has(u.uid)) { this.floatText(p, UNIT_H, label, 'ability'); this.emote(u, 'taunt', 1000); }
      MB.audio.sfx('sparkle');
      await wait(250);
      await Promise.all(targets.map((t, i) => MB.FX.orbTo(this, p, this.pos(t), color, this.heightOf(t), i * 0.08)));
      fn();
      this.refresh();
      await wait(300);
    }

    async spellFx(side, card, target, fn) {
      const from = LEADER_POS[side];
      const icon = MB.itemIcon(card.id);
      this.emote(this.b.me(side).leader, 'attack', 1200);
      await MB.FX.spell(this, side, card, from, target, icon, fn);
      this.refresh();
    }

    async powerFx(side, pw, target, fn) {
      const leader = this.b.me(side).leader, from = LEADER_POS[side];
      this.emote(leader, 'attack', 1200);
      this.floatText(from, LEADER_H, pw.name, 'ability');
      const lv = this.ents.get(leader.uid);
      gsap.fromTo(lv.img, { filter: 'brightness(2) drop-shadow(0 0 20px #fff)' }, { filter: 'brightness(1) drop-shadow(0 0 0px #fff)', duration: 0.8, clearProps: 'filter' });
      MB.audio.sfx('sparkle');
      await wait(300);
      const color = MB.CARDS[this.b.me(side).leaderId].attack.color;
      if (target) await MB.FX.orbTo(this, from, this.pos(target), color, this.heightOf(target), 0, 180);
      else if (pw.effect === 'facePunch') await MB.FX.orbTo(this, from, LEADER_POS[1 - side], color, LEADER_H, 0, 180);
      fn();
      this.refresh();
      await wait(350);
    }

    // burning monsters flare up before taking their damage
    async burnFx(units, fn) {
      MB.audio.sfx('zap');
      units.forEach((u) => { const p = this.pos(u); MB.FX.flameBurst(this, p, UNIT_H); });
      await wait(350);
      fn();
      this.refresh();
      await wait(300);
    }

    // two partners run together, a cut-in plays, and the duo lands in its new costumes
    async fuse(stay, go, u, bond) {
      const va = this.ents.get(stay.uid), vb = this.ents.get(go.uid);
      [va, vb].forEach((v) => { if (v) { this.ents.delete(v.ent.uid); v.idle && v.idle.kill(); clearTimeout(v.emoteTimer); } });
      const P = this.pos(u);
      const restore = this.focus(P, 0.06 + bond.tier * 0.03);
      await MB.FX.fusion(this, va, vb, P, bond, () => {
        const v = this.makeFigure(u, UNIT_H);
        this.updatePlate(v);
        return v;
      });
      restore();
      this.emote(u, 'taunt', 1400);
      this.refresh();
    }

    // a unit leaves the board without dying (returned to hand)
    async unsummon(u) {
      const v = this.ents.get(u.uid);
      if (!v) return;
      this.ents.delete(u.uid);
      v.idle && v.idle.kill();
      MB.audio.sfx('whoosh');
      MB.FX.burst(this, this.pos(u), u.card.attack.color, 12, { h: UNIT_H * 0.5 });
      await gsap.timeline({ onComplete: () => v.el.remove() })
        .to(v.plate, { opacity: 0, duration: 0.15 })
        .to(v.figure, { y: -300, scale: 0.3, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0);
    }

    async death(units) {
      MB.audio.sfx('death');
      await Promise.all(units.map((u) => {
        const v = this.ents.get(u.uid);
        if (!v) return null;
        this.ents.delete(u.uid);
        v.idle && v.idle.kill();
        this.setSprite(v, 'lose');
        return MB.FX.dust(this, v, this.pos(u));
      }));
    }

    async turnBanner(side) {
      this.refresh();
      const b = document.getElementById('banner');
      b.textContent = side === 0 ? 'YOUR TURN' : 'ENEMY TURN';
      b.className = 'banner ' + (side === 0 ? 'mine' : 'theirs');
      MB.audio.sfx('turn');
      await gsap.timeline()
        .fromTo(b, { opacity: 0, scaleX: 3, scaleY: 0.2, letterSpacing: '60px' }, { opacity: 1, scaleX: 1, scaleY: 1, letterSpacing: '12px', duration: 0.35, ease: 'power3.out' })
        .to(b, { opacity: 0, y: -40, duration: 0.3, delay: 0.5 })
        .set(b, { y: 0 });
    }

    async drawCard(side, card, silent) {
      MB.audio.sfx('draw');
      if (side === 0) {
        this.renderHand(card.cid);
        await wait(silent ? 60 : 250);
      } else { this.refresh(); await wait(silent ? 30 : 150); }
    }

    async burn(side, card) {
      this.log(`${side ? 'Enemy' : 'Your'} hand is full — ${card.name} burned!`);
      const t = this.billboard('float-text debuff', `🔥 ${card.name} burned`, 590, side ? 120 : 640);
      await gsap.to(t.body, { y: -150, opacity: 0, duration: 1.4, onComplete: () => t.remove() });
    }

    async fatigue(side, n) { await wait(400); }

    async cardPlayed(side, card) {
      if (side === 0) {
        const cEl = this.handEl.querySelector(`[data-cid="${card.cid}"]`);
        if (cEl) {
          cEl.classList.add('leaving');
          await gsap.to(cEl, { y: '-=260', scale: 0.4, opacity: 0, rotation: 0, duration: 0.3, ease: 'power2.in' });
          cEl.remove();
        }
        this.renderHand();
      } else {
        // reveal the enemy's card at the top of the screen
        const r = MB.UI.cardEl(card);
        r.classList.add('reveal');
        this.root.appendChild(r);
        MB.audio.sfx('play');
        await gsap.timeline()
          .fromTo(r, { x: 1250, y: 20, rotationY: 180, scale: 0.5 }, { x: 1180, y: 130, rotationY: 0, scale: 1.1, duration: 0.5, ease: 'back.out(1.5)' })
          .to(r, { opacity: 0, y: 60, scale: 0.7, duration: 0.3, delay: 0.7 });
        r.remove();
      }
    }

    async gameOver(winner) {
      const b = this.b;
      for (const side of [0, 1]) {
        const role = side === winner ? 'win' : 'lose';
        this.emote(b.me(side).leader, role, 0);
        b.units(side).forEach((u) => this.emote(u, role, 0));
      }
      const loserLeader = this.ents.get(b.me(1 - winner).leader.uid);
      if (loserLeader) MB.FX.dust(this, loserLeader, LEADER_POS[1 - winner], true);
      MB.audio.sfx(winner === 0 ? 'win' : 'lose');
      await wait(1600);
      MB.UI.battleOver(winner === 0);
    }

    log(text) {
      const l = document.getElementById('log');
      const line = el('div', 'log-line', text);
      l.prepend(line);
      while (l.children.length > 7) l.lastChild.remove();
      gsap.from(line, { x: 40, opacity: 0, duration: 0.3 });
    }

    // ---------- HUD / hand ----------
    refresh() {
      const b = this.b;
      if (!b) return;
      this.ents.forEach((v) => {
        this.updatePlate(v);
        const e = v.ent;
        v.el.classList.toggle('ready', !e.isLeader && e.side === 0 && b.active === 0 && b.canAttack(e));
      });
      const me = b.me(0), foe = b.me(1);
      document.getElementById('player-gold').innerHTML = this.goldHtml(me);
      document.getElementById('enemy-gold').innerHTML = this.goldHtml(foe);
      document.getElementById('player-deck').textContent = me.deck.length;
      document.getElementById('enemy-deck').textContent = foe.deck.length;
      const eh = document.getElementById('enemy-hand');
      if (eh.children.length !== foe.hand.length) {
        eh.innerHTML = foe.hand.map(() => '<div class="card-back"></div>').join('');
      }
      const pbtn = document.getElementById('power-btn');
      pbtn.classList.toggle('usable', b.canPower(0));
      pbtn.classList.toggle('used', me.powerUsed);
      const endBtn = document.getElementById('end-turn');
      endBtn.disabled = b.active !== 0 || b.over;
      endBtn.textContent = b.active === 0 ? 'END TURN' : 'ENEMY TURN';
      const anyMove = b.active === 0 && (me.hand.some((c) => b.canPlay(0, c)) || b.units(0).some((u) => b.canAttack(u)) || b.canPower(0));
      endBtn.classList.toggle('pulse', b.active === 0 && !anyMove);
      this.handEl.querySelectorAll('.card').forEach((c) => {
        const card = me.hand.find((h) => h.cid === +c.dataset.cid);
        c.classList.toggle('playable', !!card && b.active === 0 && b.canPlay(0, card));
      });
    }

    goldHtml(p) {
      let s = '';
      for (let i = 0; i < p.maxGold; i++) s += `<i class="${i < p.gold ? 'full' : ''}"></i>`;
      return `<span class="gold-num">${p.gold}/${p.maxGold}</span><span class="gems">${s}</span>`;
    }

    renderHand(newCid) {
      const hand = this.b.me(0).hand;
      const existing = new Map([...this.handEl.children].map((c) => [+c.dataset.cid, c]));
      hand.forEach((card) => {
        if (!existing.has(card.cid)) {
          const c = MB.UI.cardEl(card);
          c.dataset.cid = card.cid;
          this.handEl.appendChild(c);
          existing.set(card.cid, c);
          if (card.cid === newCid) gsap.set(c, { x: 1400, y: -200, rotation: 30, scale: 0.6 });
        }
      });
      existing.forEach((c, cid) => { if (!hand.some((h) => h.cid === cid) && !c.classList.contains('leaving')) c.remove(); });
      this.layoutHand();
      this.refresh();
    }

    layoutHand() {
      const cards = [...this.handEl.children].filter((c) => !c.classList.contains('leaving'));
      const n = cards.length, spread = Math.min(120, 700 / Math.max(1, n));
      cards.forEach((c, i) => {
        const off = i - (n - 1) / 2;
        c.style.zIndex = 10 + i;
        if (c === this.hovered || (this.drag && this.drag.el === c)) return;
        gsap.to(c, { x: 800 - 80 + off * spread, y: 655 + Math.abs(off) * Math.abs(off) * 4, rotation: off * 4, scale: 1, duration: 0.45, ease: 'power3.out' });
      });
    }

    // ---------- input ----------
    bindInput() {
      const hand = this.handEl;
      hand.addEventListener('pointerover', (e) => {
        const c = e.target.closest('.card');
        if (!c || this.drag || c === this.hovered) return;
        this.hovered = c;
        MB.audio.sfx('hover');
        c.style.zIndex = 100;
        gsap.to(c, { y: 560, scale: 1.35, rotation: 0, duration: 0.2, ease: 'power2.out' });
      });
      hand.addEventListener('pointerout', (e) => {
        const c = e.target.closest('.card');
        if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
        if (this.hovered === c) { this.hovered = null; this.layoutHand(); }
      });
      hand.addEventListener('pointerdown', (e) => {
        const c = e.target.closest('.card');
        if (e.button !== 0 || !c || !this.b || this.b.busy || this.b.active !== 0) return;
        e.preventDefault();
        const card = this.b.me(0).hand.find((h) => h.cid === +c.dataset.cid);
        if (!card) return;
        if (!this.b.canPlay(0, card)) { MB.audio.sfx('error'); gsap.fromTo(c, { x: '-=8' }, { x: '+=8', duration: 0.3, ease: 'elastic.out(1,0.2)' }); return; }
        this.startCardDrag(card, c, e);
      });

      this.board.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.b || this.b.busy || this.b.active !== 0 || this.aiming) return;
        const uEl = e.target.closest('.unit');
        const u = uEl && this.b.find(uEl.dataset.uid);
        if (u && !u.isLeader && u.side === 0 && this.b.canAttack(u)) {
          e.preventDefault();
          this.startAim({ kind: 'attack', source: u, targets: this.b.attackTargets(u), color: '#ff4d6d', from: () => this.screenPos(u), downAt: performance.now() });
        }
      });

      document.getElementById('power-btn').addEventListener('click', () => {
        const b = this.b;
        if (!b || b.busy || !b.canPower(0)) { MB.audio.sfx('error'); return; }
        const pw = b.me(0).power;
        if (!pw.target) return this.run(() => b.usePower(0));
        const btn = document.getElementById('power-btn').getBoundingClientRect();
        const from = this.toUi(btn.left + btn.width / 2, btn.top + btn.height / 2);
        this.startAim({ kind: 'power', targets: b.targetsFor(0, pw.target, pw.filter), color: '#6fff9a', from: () => from, sticky: true });
      });

      document.getElementById('end-turn').addEventListener('click', () => {
        if (!this.b || this.b.busy || this.b.active !== 0) return;
        MB.audio.sfx('click');
        this.cancelAim();
        this.run(() => this.b.endTurn());
      });

      window.addEventListener('pointermove', (e) => this.onMove(e));
      window.addEventListener('pointerup', (e) => this.onUp(e));
      window.addEventListener('contextmenu', (e) => { if (this.aiming || this.drag) { e.preventDefault(); this.cancelAim(); this.cancelDrag(); } });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.cancelAim(); this.cancelDrag(); }
        if ((e.key === 'e' || e.key === 'E') && !document.getElementById('battle-hud').classList.contains('hidden')) document.getElementById('end-turn').click();
      });

      // hover preview of board characters
      this.board.addEventListener('pointerover', (e) => {
        const uEl = e.target.closest('.unit');
        if (!uEl || !this.b) return;
        const ent = this.b.find(uEl.dataset.uid);
        if (ent) MB.UI.preview(ent);
      });
      this.board.addEventListener('pointerout', (e) => { if (e.target.closest('.unit')) MB.UI.preview(null); });
    }

    // Run a battle action while blocking input.
    async run(fn) {
      const b = this.b;
      if (!b || b.busy) return;
      b.busy = true;
      document.body.classList.add('busy');
      try { await fn(); } catch (err) { console.error(err); }
      b.busy = false;
      document.body.classList.remove('busy');
      this.refresh();
    }

    // what battle entity / slot is under the pointer
    pickAt(cx, cy) {
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) return {};
      const uEl = hit.closest('.unit');
      if (uEl) return { ent: this.b.find(uEl.dataset.uid) };
      const s = hit.closest('.slot');
      if (s) return { slot: { side: +s.dataset.side, slot: +s.dataset.slot } };
      if (hit.closest('#board')) return { board: true };
      return {};
    }

    startCardDrag(card, cEl, e) {
      const start = this.toUi(e.clientX, e.clientY);
      this.drag = { card, el: cEl, start, moved: false };
      this.hovered = null;
      cEl.classList.add('dragging');
      cEl.style.zIndex = 200;
      if (card.type === 'unit') this.highlightSlots(true);
      else if (card.target) this.highlightTargets(this.b.targetsFor(0, card.target, card.filter));
    }

    onMove(e) {
      const p = this.toUi(e.clientX, e.clientY);
      if (this.drag) {
        const d = this.drag;
        if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) > 6) d.moved = true;
        if (d.moved) {
          // targeted spells turn into an aiming arrow once they leave the hand
          if (d.card.target && p.y < 640) {
            gsap.to(d.el, { x: 800 - 80, y: 560, scale: 0.9, rotation: 0, duration: 0.2 });
            this.drawArrow({ x: 800, y: 620 }, p, '#7aa7ff');
          } else {
            this.arrow.classList.add('hidden');
            gsap.to(d.el, { x: p.x - 80, y: p.y - 110, rotation: 0, scale: 0.85, duration: 0.12 });
          }
          this.hoverTarget(e);
        }
      } else if (this.aiming) {
        this.drawArrow(this.aiming.from(), p, this.aiming.color);
        this.hoverTarget(e);
      }
    }

    hoverTarget(e) {
      const { ent, slot } = this.pickAt(e.clientX, e.clientY);
      this.board.querySelectorAll('.slot.hot').forEach((s) => s.classList.remove('hot'));
      this.ents.forEach((v) => v.el.classList.remove('hot'));
      if (ent) { const v = this.ents.get(ent.uid); v && v.el.classList.contains('targetable') && v.el.classList.add('hot'); }
      if (slot && slot.side === 0) {
        const s = this.board.querySelector(`.slot.side0[data-slot="${slot.slot}"]`);
        s && s.classList.contains('open') && s.classList.add('hot');
      }
    }

    async onUp(e) {
      if (e.button === 2) return; // right-click cancels (contextmenu handler)
      if (this.drag) {
        const d = this.drag, b = this.b;
        const p = this.toUi(e.clientX, e.clientY);
        const { ent, slot, board } = this.pickAt(e.clientX, e.clientY);
        this.cancelDrag(true);
        if (!d.moved) { return; }
        if (d.card.type === 'unit' && p.y < 640) {
          let s = slot && slot.side === 0 && !b.me(0).board[slot.slot] ? slot.slot : null;
          if (s == null) s = this.nearestFreeSlot(e);
          return this.run(() => b.playCard(0, d.card.cid, { slot: s }));
        }
        if (d.card.type === 'spell' && p.y < 640) {
          if (!d.card.target) return this.run(() => b.playCard(0, d.card.cid));
          if (ent && b.targetsFor(0, d.card.target, d.card.filter).includes(ent)) return this.run(() => b.playCard(0, d.card.cid, { target: ent }));
          MB.audio.sfx('error');
        }
        this.layoutHand();
        return;
      }
      if (this.aiming) {
        const a = this.aiming;
        const { ent } = this.pickAt(e.clientX, e.clientY);
        // quick click on the source keeps aiming (click-to-target mode)
        if (a.kind === 'attack' && ent === a.source) {
          if (performance.now() - a.downAt < 400 || a.sticky) { a.sticky = true; return; }
        }
        if (ent && a.targets.includes(ent)) {
          this.cancelAim();
          if (a.kind === 'attack') return this.run(() => this.b.attack(a.source, ent));
          if (a.kind === 'power') return this.run(() => this.b.usePower(0, ent));
        }
        if (a.sticky && a.kind === 'power' && !a.armed) { a.armed = true; return; }
        this.cancelAim();
      }
    }

    nearestFreeSlot(e) {
      const free = this.b.freeSlots(0);
      let best = free[0], bd = Infinity;
      free.forEach((i) => {
        const r = this.board.querySelector(`.slot.side0[data-slot="${i}"]`).getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - e.clientX);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }

    cancelDrag(keepLayout) {
      if (!this.drag) return;
      this.drag.el.classList.remove('dragging');
      this.drag = null;
      this.highlightSlots(false);
      this.highlightTargets([]);
      this.arrow.classList.add('hidden');
      if (!keepLayout) this.layoutHand();
    }

    startAim(a) {
      this.aiming = a;
      this.highlightTargets(a.targets);
      if (a.source) this.ents.get(a.source.uid).el.classList.add('selected');
      this.drawArrow(a.from(), a.from(), a.color);
    }
    cancelAim() {
      if (this.aiming && this.aiming.source) { const v = this.ents.get(this.aiming.source.uid); v && v.el.classList.remove('selected'); }
      this.aiming = null;
      this.highlightTargets([]);
      this.arrow && this.arrow.classList.add('hidden');
    }

    highlightSlots(on) {
      this.board.querySelectorAll('.slot').forEach((s) => s.classList.remove('open', 'hot'));
      if (!on) return;
      this.b.freeSlots(0).forEach((i) => this.board.querySelector(`.slot.side0[data-slot="${i}"]`).classList.add('open'));
    }
    highlightTargets(list) {
      this.ents.forEach((v) => v.el.classList.toggle('targetable', list.includes(v.ent)));
      this.ents.forEach((v) => v.el.classList.remove('hot'));
    }

    drawArrow(a, b, color) {
      const svg = this.arrow;
      svg.classList.remove('hidden');
      const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 90 - Math.abs(a.x - b.x) * 0.1;
      svg.querySelector('path').setAttribute('d', `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`);
      svg.style.setProperty('--c', color);
      const head = svg.querySelector('.head');
      const ang = Math.atan2(b.y - my, b.x - mx) * 180 / Math.PI;
      head.setAttribute('transform', `translate(${b.x},${b.y}) rotate(${ang})`);
    }
  }

  MB.View = View;
  MB.LAYOUT = { ROW_Y, SLOT_X, LEADER_POS, UNIT_H, LEADER_H };
})();
