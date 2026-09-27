// How to Play: a list of topics, each with a looping animated clip of a small mock battle (or menu) that shows the rule
// happening, built from the real cards and sprites. Clips are GSAP timelines over throwaway DOM; every loop rebuilds
// the stage from scratch, and leaving the screen stops it.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // stage geometry (px): unit feet on the tiles, leaders in opposite corners, hand along the bottom
  const TILE_X = [250, 360, 470, 580], ROW_Y = [272, 150];
  const LEADER = [{ x: 64, y: 336 }, { x: 692, y: 70 }];
  const CURSOR = '<svg viewBox="0 0 24 24"><path d="M3 1.5v18.5l5.2-4.9 3.6 7.4 3.4-1.6-3.6-7.3H19z" fill="#fff" stroke="#1a1030" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  const card = (id) => MB.CARDS[id];
  const has = (id) => !!(MB.CARDS[id] && MB.charById(id));
  const firstOf = (...ids) => ids.find(has) || Object.keys(MB.CARDS).find((id) => card(id).type === 'unit' && !card(id).token && has(id));

  // ---------------------------------------------------------------- stage kit
  function kit(stage, tl) {
    const add = (cls, html, x, y, parent = stage) => {
      const e = el('div', cls, html);
      if (x != null) { e.style.left = x + 'px'; e.style.top = y + 'px'; }
      parent.appendChild(e);
      return e;
    };
    const K = { add, tl, stage };

    K.board = () => {
      add('ht-board');
      [0, 1].forEach((side) => TILE_X.forEach((x) => add('ht-tile s' + side, '', x, ROW_Y[side])));
    };

    K.caption = add('ht-cap', '');
    K.cap = (html, at) => {
      tl.call(() => { K.caption.innerHTML = html; }, null, at);
      tl.fromTo(K.caption, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3 }, '<');
    };

    // a character standing on a tile, with ATK / HP badges
    K.unit = (id, side, slot, { atk, hp, costume = null, ready, kw } = {}) => {
      const d = card(id);
      atk = atk == null ? d.atk : atk; hp = hp == null ? d.hp : hp;
      const icons = (kw || d.kw || []).map((k) => MB.KEYWORDS[k].icon).join('');
      const u = add('ht-unit' + (side ? ' foe' : '') + (ready ? ' ready' : ''),
        `<img src="${MB.spriteUrl(id, 'idle', costume)}"><b class="a">${atk}</b><b class="h">${hp}</b>${icons ? `<i class="kw">${icons}</i>` : ''}`,
        TILE_X[slot], ROW_Y[side]);
      u.pt = { x: TILE_X[slot], y: ROW_Y[side] - 52 };
      u.cid = id;
      return u;
    };
    // a relationship duo on a tile
    K.duo = (bond, side, slot, atk, hp) => {
      const imgs = bond.pair.map((id, i) => `<img src="${MB.spriteUrl(id, 'idle', bond.costumes[i])}">`).join('');
      const u = add('ht-unit duo' + (side ? ' foe' : ''), `${imgs}<b class="a">${atk}</b><b class="h">${hp}</b><i class="kw hearts">${MB.BOND_TIERS[bond.tier].hearts}</i>`, TILE_X[slot], ROW_Y[side]);
      u.pt = { x: TILE_X[slot], y: ROW_Y[side] - 52 };
      return u;
    };
    K.leader = (id, side, hp) => {
      const p = LEADER[side];
      const l = add('ht-leader s' + side, `<img src="${MB.spriteUrl(id, 'idle', null)}"><b class="h">${hp}</b>`, p.x, p.y);
      l.pt = { x: p.x, y: p.y };
      return l;
    };
    // a card in your hand, shrunk to fit
    K.hand = (id, i, { glow, tag } = {}) => {
      const h = add('ht-hc' + (glow ? ' glow' : ''), '', 340 + i * 82, 302);
      h.appendChild(MB.UI.cardEl(id, false, { base: true }));
      if (tag) h.appendChild(el('div', 'ht-tag', tag));
      h.pt = { x: 340 + i * 82 + 34, y: 302 + 46 };
      return h;
    };
    K.coins = (n, lit) => {
      const row = add('ht-coins', '', 118, 372);
      for (let i = 0; i < n; i++) row.appendChild(el('i', i < lit ? 'on' : ''));
      row.set = (k, at) => tl.call(() => [...row.children].forEach((c, i) => c.classList.toggle('on', i < k)), null, at);
      return row;
    };

    // pointer: moves, presses, drags
    K.cursor = add('ht-cursor', CURSOR);
    gsap.set(K.cursor, { x: 700, y: 390, opacity: 0 });
    K.move = (pt, dur = 0.6, at) => tl.to(K.cursor, { x: pt.x, y: pt.y, opacity: 1, duration: dur, ease: 'power2.inOut' }, at);
    K.press = (at) => {
      tl.to(K.cursor, { scale: 0.8, duration: 0.08 }, at).to(K.cursor, { scale: 1, duration: 0.12 });
      tl.call(() => { const r = add('ht-ripple', '', gsap.getProperty(K.cursor, 'x'), gsap.getProperty(K.cursor, 'y')); gsap.fromTo(r, { scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.5, onComplete: () => r.remove() }); }, null, '<');
    };
    K.hideCursor = (at) => tl.to(K.cursor, { opacity: 0, duration: 0.25 }, at);

    // aim arrow, drawn along with the pointer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ht-arrow');
    svg.innerHTML = '<defs><marker id="ht-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff5f8f"/></marker></defs><line marker-end="url(#ht-head)"/>';
    stage.appendChild(svg);
    const line = svg.querySelector('line');
    K.aim = (from, to, dur = 0.55, at) => {
      tl.set(line, { attr: { x1: from.x, y1: from.y, x2: from.x, y2: from.y }, opacity: 1 }, at);
      tl.to(line, { attr: { x2: to.x, y2: to.y }, duration: dur, ease: 'power2.inOut' }, '<');
      tl.to(K.cursor, { x: to.x, y: to.y, duration: dur, ease: 'power2.inOut' }, '<');
    };
    K.unaim = (at) => tl.to(line, { opacity: 0, duration: 0.15 }, at);

    // floating number / word over a point
    K.pop = (pt, text, color = '#ff5a5a', at) => tl.call(() => {
      const p = add('ht-pop', text, pt.x, pt.y);
      p.style.color = color;
      gsap.fromTo(p, { y: 0, scale: 0.4, opacity: 1 }, { y: -46, scale: 1, duration: 0.9, ease: 'power2.out' });
      gsap.to(p, { opacity: 0, duration: 0.3, delay: 0.7, onComplete: () => p.remove() });
    }, null, at);
    K.burst = (pt, chars, n = 10, at) => tl.call(() => {
      for (let i = 0; i < n; i++) {
        const b = add('ht-bit', chars[i % chars.length], pt.x, pt.y);
        const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60;
        gsap.fromTo(b, { x: 0, y: 0, scale: 0.4, opacity: 1 }, { x: Math.cos(a) * r, y: Math.sin(a) * r - 20, scale: 1, opacity: 0, duration: 0.8 + Math.random() * 0.4, ease: 'power2.out', onComplete: () => b.remove() });
      }
    }, null, at);
    K.stat = (u, which, v, at) => tl.call(() => {
      const b = u.querySelector('.' + which);
      b.textContent = v;
      gsap.fromTo(b, { scale: 1.8 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    }, null, at);
    K.shake = (u, at) => tl.fromTo(u, { x: -6 }, { x: 0, duration: 0.35, ease: 'elastic.out(1, .3)' }, at);
    K.die = (u, at) => tl.to(u, { opacity: 0, y: 20, scale: 0.8, filter: 'brightness(3)', duration: 0.45 }, at);
    // one attacker jumps at a target: hit() runs on impact
    K.lunge = (u, to, hit, at) => {
      const from = u.pt;
      tl.to(u, { x: (to.x - from.x) * 0.7, y: (to.y - from.y) * 0.7, duration: 0.2, ease: 'power2.in' }, at);
      hit();
      tl.to(u, { x: 0, y: 0, duration: 0.35, ease: 'power2.out' });
    };
    K.shot = (from, to, glyph, at) => {
      const s = add('ht-shot', glyph, from.x, from.y);
      tl.set(s, { opacity: 1 }, at).to(s, { x: to.x - from.x, y: to.y - from.y, duration: 0.3, ease: 'power1.in' }).set(s, { opacity: 0 });
    };
    // a hand card dragged to a point, where it turns into whatever spawn() makes
    K.drag = (h, to, dur = 0.7) => {
      K.move(h.pt, 0.6);
      K.press();
      tl.to(h, { y: -14, scale: 1.1, duration: 0.15 });
      tl.to(h, { x: to.x - h.pt.x, y: to.y - h.pt.y, scale: 0.7, duration: dur, ease: 'power2.inOut' });
      tl.to(K.cursor, { x: to.x, y: to.y, duration: dur, ease: 'power2.inOut' }, '<');
      tl.to(h, { scale: 0.2, opacity: 0, duration: 0.2 });
    };
    K.appear = (u, at) => tl.fromTo(u, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.2)', immediateRender: true }, at);
    K.banner = (html, cls = '', at) => {
      const b = add('ht-banner ' + cls, html);
      tl.fromTo(b, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)', immediateRender: true }, at);
      return b;
    };
    K.wait = (s) => tl.to({}, { duration: s });
    return K;
  }

  // ---------------------------------------------------------------- clips
  const CLIPS = {
    goal(K) {
      const tl = K.tl;
      K.board();
      K.leader('hayley-kate', 0, 30);
      const foe = K.leader('farley-kate', 1, 7);
      const a = K.unit('james-lone', 0, 1, { ready: true }), b = K.unit('farley-kate', 0, 2, { ready: true });
      const coins = K.coins(10, 0);
      K.cap('You gain <b>1 more gold</b> every turn…');
      for (let t = 1; t <= 4; t++) {
        coins.set(t, '+=0.25');
        K.pop({ x: 130 + (t - 1) * 19, y: 360 }, '+🪙', '#ffd84a', '<');
      }
      K.cap('…up to <b>10</b>. Spend it to play cards.', '+=0.6');
      K.wait(1.1);
      K.cap('Knock the enemy leader\'s HP to <b>0</b> to win!');
      [[a, 3, 4], [b, 4, 0]].forEach(([u, dmg, left]) => {
        K.lunge(u, foe.pt, () => { K.pop(foe.pt, '-' + dmg); K.stat(foe, 'h', left); K.shake(foe); }, '+=0.4');
      });
      tl.to(foe, { filter: 'grayscale(1) brightness(.6)', rotate: 12, y: 16, duration: 0.5 });
      K.banner('VICTORY!', 'win');
      K.burst({ x: 380, y: 200 }, ['✨', '⭐', '🎉'], 16, '<');
      K.wait(1.6);
    },

    summon(K) {
      const tl = K.tl;
      K.board();
      K.leader('hayley-kate', 0, 30); K.leader('farley-kate', 1, 30);
      const coins = K.coins(10, 3);
      const h1 = K.hand('luther-jones', 0, { glow: true }), h2 = K.hand('julie-hunley', 1, { glow: true });
      K.hand('farley-kate', 2);
      K.cap('<b>Drag a character card</b> onto one of your 4 tiles');
      const t1 = { x: TILE_X[1], y: ROW_Y[0] - 40 };
      K.drag(h1, t1);
      const u1 = K.unit('luther-jones', 0, 1);
      K.appear(u1);
      K.burst(t1, ['✦', '✧'], 10, '<');
      coins.set(1, '<');
      const zz = K.add('ht-zzz', 'z<span>z</span>', TILE_X[1] + 26, ROW_Y[0] - 120);
      tl.fromTo(zz, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      K.cap('It can attack <b>next turn</b>…');
      K.wait(1.2);
      K.cap('…unless it has <b>⚡ Haste</b>');
      const t2 = { x: TILE_X[2], y: ROW_Y[0] - 40 };
      K.drag(h2, t2);
      const u2 = K.unit('julie-hunley', 0, 2, { ready: true });
      K.appear(u2);
      K.burst(t2, ['⚡'], 8, '<');
      coins.set(0, '<');
      K.hideCursor('+=0.2');
      K.cap('Glowing characters are <b>ready to attack</b>');
      K.wait(1.8);
    },

    attack(K) {
      const tl = K.tl;
      K.board();
      K.leader('hayley-kate', 0, 30);
      const foeL = K.leader('farley-kate', 1, 30);
      const keiko = K.unit('keiko-ghan', 0, 0, { ready: true }), james = K.unit('james-lone', 0, 1, { ready: true }), luther = K.unit('luther-jones', 0, 2, { ready: true });
      const wert = K.unit('wert-lone', 1, 1);
      K.cap('<b>Drag from a glowing character</b> to an enemy');
      K.move(keiko.pt);
      K.press();
      K.aim(keiko.pt, wert.pt);
      K.unaim('+=0.15');
      K.cap('Both deal their ATK to each other');
      K.lunge(keiko, wert.pt, () => {
        K.pop(wert.pt, '-3'); K.stat(wert, 'h', 1); K.shake(wert);
        K.pop(keiko.pt, '-2', '#ff5a5a', '<'); K.stat(keiko, 'h', 0, '<');
      });
      K.die(keiko);
      K.wait(0.5);
      K.cap('<b>🏹 Ranged</b> attackers take no damage back');
      K.move(james.pt);
      K.press();
      K.aim(james.pt, wert.pt);
      K.unaim('+=0.15');
      K.shot(james.pt, wert.pt, '💬');
      K.pop(wert.pt, '-3'); K.stat(wert, 'h', 0, '<'); K.shake(wert, '<');
      K.die(wert, '+=0.1');
      tl.to(james, { filter: 'brightness(.65)', duration: 0.3 }, '<');
      K.wait(0.4);
      K.cap('Hitting the leader is free: leaders don\'t hit back');
      K.move(luther.pt);
      K.press();
      K.aim(luther.pt, foeL.pt);
      K.unaim('+=0.15');
      K.lunge(luther, foeL.pt, () => { K.pop(foeL.pt, '-2'); K.stat(foeL, 'h', 28); K.shake(foeL); });
      tl.to(luther, { filter: 'brightness(.65)', duration: 0.3 });
      K.hideCursor();
      K.wait(1.5);
    },

    items(K) {
      const tl = K.tl;
      K.board();
      K.leader('hayley-kate', 0, 30); K.leader('farley-kate', 1, 30);
      K.coins(10, 3);
      const farley = K.unit('farley-kate', 0, 1, { hp: 2 });
      farley.querySelector('.h').classList.add('hurt');
      const julie = K.unit('julie-hunley', 1, 2);
      const towel = K.hand('towel', 0, { glow: true }), bag = K.hand('school-bag', 1, { glow: true });
      K.cap('<b>Item cards</b> come from the novels\' inventories');
      K.wait(0.8);
      K.cap('Drag one onto a target: here, a <b>Towel</b> heals');
      K.drag(towel, farley.pt);
      K.burst(farley.pt, ['💚', '✚'], 10);
      K.pop(farley.pt, '+5', '#7dff9a', '<');
      K.stat(farley, 'h', 6, '<');
      tl.call(() => farley.querySelector('.h').classList.remove('hurt'), null, '<');
      K.cap('A <b>School Bag</b> deals 2 damage to a monster', '+=0.5');
      K.drag(bag, julie.pt);
      K.burst(julie.pt, ['💥'], 6);
      K.pop(julie.pt, '-2', '#ff5a5a', '<');
      K.stat(julie, 'h', 0, '<');
      K.die(julie, '+=0.1');
      K.hideCursor();
      K.cap('Items with no target can be dropped anywhere', '+=0.2');
      K.wait(1.6);
    },

    power(K) {
      const tl = K.tl;
      const pw = MB.POWERS['hayley-kate'] || { name: 'Cheer Up', cost: 2 };
      K.board();
      K.leader('hayley-kate', 0, 30); K.leader('farley-kate', 1, 30);
      const coins = K.coins(10, 3);
      const ally = K.unit('luther-jones', 0, 1, { ready: true });
      const btn = K.add('ht-power', `<img src="${MB.spriteUrl('hayley-kate', 'idle', null)}"><b>${pw.cost}</b>`, 176, 318);
      btn.pt = { x: 176, y: 318 };
      K.cap('Your <b>Leader Power</b> is the button by your leader');
      tl.fromTo(btn, { boxShadow: '0 0 0 0 #ffd84a00' }, { boxShadow: '0 0 0 8px #ffd84a66', duration: 0.4, yoyo: true, repeat: 3 });
      K.cap(`<b>${pw.name}</b>: ${pw.text || 'every leader has their own'}`);
      K.move(btn.pt);
      K.press();
      coins.set(3 - pw.cost);
      K.aim(btn.pt, ally.pt);
      K.unaim('+=0.15');
      K.burst(ally.pt, ['⬆', '✨'], 10);
      K.pop(ally.pt, '+1 ATK', '#7dff9a', '<');
      K.stat(ally, 'a', card('luther-jones').atk + 1, '<');
      tl.to(btn, { filter: 'grayscale(1) brightness(.6)', duration: 0.3 });
      K.hideCursor();
      K.cap('It can be used <b>once per turn</b>');
      K.wait(1.8);
    },

    keywords(K) {
      const tl = K.tl;
      K.board();
      K.leader('hayley-kate', 0, 30);
      const foeL = K.leader('keiko-ghan', 1, 30);
      const me = K.unit(firstOf('ben-brier', 'keiko-ghan'), 0, 1, { ready: true });
      const tank = K.unit('farley-kate', 1, 2), shield = K.unit('luther-jones', 1, 0);
      tl.set(shield, { opacity: 0 });
      const bubble = K.add('ht-bubble', '', TILE_X[0], ROW_Y[1]);
      tl.set(bubble, { opacity: 0 });
      K.cap('Keywords change the rules: <b>🛡️ Taunt</b>');
      K.move(me.pt);
      K.press();
      K.aim(me.pt, foeL.pt, 0.6);
      const no = K.add('ht-no', '✖', foeL.pt.x, foeL.pt.y);
      tl.fromTo(no, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(3)' });
      K.cap('Enemies must attack a <b>Taunt</b> character first');
      tl.to(tank, { scale: 1.12, duration: 0.2, yoyo: true, repeat: 3 });
      tl.to(no, { opacity: 0, duration: 0.2 });
      K.aim(me.pt, tank.pt, 0.4);
      K.unaim('+=0.1');
      K.lunge(me, tank.pt, () => { K.pop(tank.pt, '-' + card(me.cid).atk); K.stat(tank, 'h', card('farley-kate').hp - card(me.cid).atk); K.shake(tank); });
      K.hideCursor();
      K.wait(0.4);
      K.cap('<b>🔰 Shield</b> blocks the first damage it takes');
      tl.to(shield, { opacity: 1, duration: 0.3 }).to(bubble, { opacity: 1, duration: 0.3 }, '<');
      K.shot({ x: 120, y: 300 }, shield.pt, '☄️', '+=0.3');
      K.pop(shield.pt, 'Blocked!', '#8fe8ff');
      tl.to(bubble, { scale: 1.4, opacity: 0, duration: 0.35 }, '<');
      K.cap('Every keyword is listed below ↓', '+=0.6');
      K.wait(1.6);
    },

    bonds(K) {
      const tl = K.tl;
      const bond = MB.BONDS.find((b) => b.id === 'gothic-love' && b.pair.every(has)) || MB.BONDS.find((b) => b.pair.every(has));
      if (!bond) return;
      const [p1, p2] = bond.pair;
      K.board();
      K.leader('hayley-kate', 0, 30); K.leader('farley-kate', 1, 30);
      K.coins(10, 10);
      const u1 = K.unit(p1, 0, 0);
      const h = K.hand(p2, 0, { glow: true, tag: '♥' });
      K.cap(`Cards with a <b style="color:#ff8fc6">♥</b> have a partner`);
      tl.fromTo(u1.querySelector('img'), { filter: 'drop-shadow(0 0 0 #ff5fa2)' }, { filter: 'drop-shadow(0 0 10px #ff5fa2)', duration: 0.4, yoyo: true, repeat: 3 });
      K.cap('Put <b>both partners</b> on your side of the board…');
      K.drag(h, { x: TILE_X[2], y: ROW_Y[0] - 40 });
      const u2 = K.unit(p2, 0, 2);
      K.appear(u2);
      K.hideCursor();
      K.burst({ x: TILE_X[1], y: ROW_Y[0] - 60 }, ['💖', '💕'], 12, '+=0.2');
      tl.to(u1, { x: TILE_X[1] - TILE_X[0], duration: 0.5, ease: 'power2.in' }, '+=0.3');
      tl.to(u2, { x: TILE_X[1] - TILE_X[2], duration: 0.5, ease: 'power2.in' }, '<');
      const flash = K.add('ht-flash', '');
      tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.12 }).set([u1, u2], { opacity: 0 });
      const d1 = card(p1), d2 = card(p2);
      const duo = K.duo(bond, 0, 1, d1.atk + d2.atk + bond.bonus[0], d1.hp + d2.hp + bond.bonus[1]);
      duo.classList.add('ready');
      tl.set(duo, { opacity: 0 });
      tl.to(flash, { opacity: 0, duration: 0.5 });
      K.appear(duo, '<');
      K.burst(duo.pt, ['💖', '✨', '💕'], 18, '<');
      K.cap(`…and they <b>fuse</b>: <b style="color:#ff8fc6">${bond.name}</b>!`, '<');
      K.wait(1.4);
      K.cap('Combined stats, new keywords, and it can attack <b>right away</b>');
      K.wait(1.8);
    },

    combos(K) {
      const tl = K.tl;
      const combo = MB.COMBOS.find((c) => c.id === 'james-lone+your-phone' && has(c.char) && MB.CARDS[c.items[0]])
        || MB.COMBOS.find((c) => has(c.char) && MB.CARDS[c.items[0]]);
      if (!combo) return;
      const d = card(combo.char);
      K.board();
      K.leader('hayley-kate', 0, 30); K.leader('farley-kate', 1, 30);
      K.coins(10, 5);
      const u = K.unit(combo.char, 0, 1);
      const h = K.hand(combo.items[0], 0, { glow: true, tag: 'COMBO' });
      K.cap('Some items belong to a character (<b style="color:#ffc93c">🔗</b>)');
      K.wait(0.8);
      K.cap('Play it while they\'re on your side of the board…');
      K.drag(h, u.pt);
      K.hideCursor();
      const flash = K.add('ht-flash gold', '');
      tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.12 });
      tl.call(() => { u.querySelector('img').src = MB.spriteUrl(combo.char, 'play', combo.costume || null); });
      tl.to(flash, { opacity: 0, duration: 0.5 });
      K.burst(u.pt, ['🔗', '✨', '⭐'], 14, '<');
      K.stat(u, 'a', d.atk + combo.bonus[0], '<');
      K.stat(u, 'h', d.hp + combo.bonus[1], '<');
      K.cap(`…and they change into <b style="color:#ffc93c">${combo.name}</b>`, '<');
      K.wait(1.3);
      K.cap('New outfit, extra stats, and often a bonus effect');
      K.wait(1.8);
    },

    bosses(K) {
      const tl = K.tl;
      const boss = firstOf('lilith', 'catherine-jones', 'farley-kate');
      K.board();
      K.leader('hayley-kate', 0, 30);
      const b = K.add('ht-boss', `<img src="${MB.spriteUrl(boss, 'taunt', null)}"><div class="bar"><i></i></div><div class="ctr">⏳ <b>3</b></div>`, 600, 22);
      const bar = b.querySelector('.bar i'), ctr = b.querySelector('.ctr b');
      const mine = [K.unit('luther-jones', 0, 1), K.unit('james-lone', 0, 2)];
      K.cap('👑 Every boss has a <b>boss rule</b>…');
      for (let n = 2; n >= 0; n--) {
        tl.call(() => { ctr.textContent = n; }, null, '+=0.6');
        tl.fromTo(ctr.parentNode, { scale: 1.5 }, { scale: 1, duration: 0.3 }, '<');
      }
      K.cap('…that goes off every few turns');
      const wave = K.add('ht-wave', '', 380, 230);
      tl.fromTo(wave, { scale: 0.1, opacity: 1 }, { scale: 3, opacity: 0, duration: 0.7, ease: 'power2.out' });
      mine.forEach((u) => { K.pop(u.pt, '-2', '#ff5a5a', '<'); K.shake(u, '<'); });
      K.stat(mine[0], 'h', card('luther-jones').hp - 2, '<');
      K.stat(mine[1], 'h', card('james-lone').hp - 2, '<');
      tl.call(() => { ctr.textContent = 3; }, null, '+=0.3');
      K.cap('The first time they drop to <b>half HP</b>…', '+=0.4');
      tl.to(bar, { width: '48%', duration: 0.6, ease: 'power2.out' });
      K.shake(b, '<');
      const rage = K.add('ht-flash rage', '');
      tl.fromTo(rage, { opacity: 0 }, { opacity: 0.8, duration: 0.12 }).to(rage, { opacity: 0, duration: 0.6 });
      tl.to(b.querySelector('img'), { scale: 1.15, filter: 'drop-shadow(0 0 14px #ff2a3a)', duration: 0.4 }, '<');
      K.pop({ x: 660, y: 60 }, '💢 RAGE!', '#ff4a5a', '<');
      K.cap('…they fly into a <b>💢 rage</b>. Both are shown before the fight', '<');
      K.wait(2);
    },

    packs(K) {
      const tl = K.tl;
      const rare = firstOf('maiko-ghan', 'zoe-brier');
      K.add('ht-board plain');
      const pack = K.add('ht-pack', `<img src="${MB.packArt('rare')}">`, 380, 190);
      K.cap('Every win earns a 🎁 <b>card pack</b>');
      tl.fromTo(pack, { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)', immediateRender: true });
      K.move({ x: 380, y: 200 }, 0.6, '+=0.3');
      K.press();
      tl.to(pack, { rotate: 6, duration: 0.06, yoyo: true, repeat: 7, ease: 'none' });
      const flash = K.add('ht-flash', '');
      tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.1 }).set(pack, { opacity: 0 }).to(flash, { opacity: 0, duration: 0.4 });
      K.hideCursor('<');
      const ids = [rare, 'luther-jones', 'keiko-ghan'].filter(has);
      const frags = ids.map((id, i) => {
        const f = K.add('ht-frag', '', 380, 190);
        const c = MB.UI.cardEl(id, false, { base: true });
        f.appendChild(c);
        f.appendChild(el('div', 'ht-tag', '🧩 ×' + (i ? 1 : 2)));
        tl.fromTo(f, { x: 0, scale: 0.2, opacity: 0 }, { x: (i - 1) * 150, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)', immediateRender: true }, i ? '<0.08' : '<');
        return f;
      });
      K.cap('…full of 🧩 <b>card fragments</b>', '<');
      K.wait(1);
      K.cap(`Collect enough and the card is yours: <b style="color:#4aa3ff">Rare</b> takes ${MB.RARITY.rare.shards}`);
      tl.to(frags.slice(1), { opacity: 0, scale: 0.6, duration: 0.3 });
      tl.to(frags[0], { x: 0, scale: 1.15, duration: 0.4 }, '<');
      const prog = K.add('ht-prog', `<i></i><b>2 / ${MB.RARITY.rare.shards}</b>`, 380, 300);
      tl.fromTo(prog, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      tl.set(prog.querySelector('i'), { width: (2 / MB.RARITY.rare.shards) * 100 + '%' }, '<');
      tl.to(prog.querySelector('i'), { width: '100%', duration: 0.6, delay: 0.4 });
      tl.call(() => { prog.querySelector('b').textContent = `${MB.RARITY.rare.shards} / ${MB.RARITY.rare.shards}`; });
      K.burst({ x: 380, y: 190 }, ['✨', '⭐'], 16);
      tl.to(frags[0], { filter: 'drop-shadow(0 0 18px #4aa3ff)', duration: 0.3 }, '<');
      K.banner('UNLOCKED!', 'blue', '<');
      K.wait(1.6);
    },

    story(K) {
      const tl = K.tl;
      K.add('ht-board map');
      const pts = [{ x: 110, y: 300 }, { x: 260, y: 200 }, { x: 430, y: 270 }, { x: 600, y: 150 }];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ht-path');
      svg.innerHTML = `<path d="M${pts.map((p) => p.x + ' ' + p.y).join(' L')}"/>`;
      K.stage.appendChild(svg);
      const rivals = ['farley-kate', 'wert-lone', 'keiko-ghan', firstOf('lilith', 'catherine-jones')];
      const nodes = pts.map((p, i) => K.add('ht-node', `<img src="${MB.spriteUrl(rivals[i], 'idle', null)}"><b>${i + 1}</b>`, p.x, p.y));
      const side = K.add('ht-side', '!', 350, 330);
      tl.set(side, { scale: 0 });
      const me = K.add('ht-marker', `<img src="${MB.spriteUrl('hayley-kate', 'idle', null)}">`, pts[0].x, pts[0].y);
      K.cap('🗺 <b>Story</b>: play the <b>main quests</b> in order');
      for (let i = 1; i < pts.length; i++) {
        tl.to(me, { x: pts[i].x - pts[0].x, y: pts[i].y - pts[0].y, duration: 0.7, ease: 'power1.inOut' }, '+=0.5');
        tl.call(() => nodes[i - 1].classList.add('done'), null, '<');
        if (i === 1) K.pop({ x: pts[0].x, y: pts[0].y - 30 }, 'Recruited!', '#7dff9a', '<');
        if (i === 2) {
          tl.to(side, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
          K.cap('<b style="color:#ffd84a">!</b> <b>Side quests</b> show up as the story reaches them', '<');
        }
      }
      K.cap('Beating a rival recruits them as a leader, and pays packs & pictures');
      K.pop({ x: pts[3].x, y: pts[3].y - 40 }, '🎁 +🧩', '#ffd84a', '<');
      K.wait(2);
    },

    stars(K) {
      const tl = K.tl;
      K.add('ht-board plain');
      const labels = ['Win', 'Win with 20+ HP', 'The fight\'s challenge'];
      const stars = labels.map((l, i) => K.add('ht-star', `<b>★</b><span>${l}</span>`, 230 + i * 150, 170));
      K.cap('⭐ Every Story fight has <b>three stars</b>');
      stars.forEach((s, i) => {
        tl.call(() => s.classList.add('on'), null, '+=0.7');
        tl.fromTo(s.querySelector('b'), { scale: 2.2, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' }, '<');
        K.pop({ x: 230 + i * 150, y: 140 }, '+✨', '#ffe27a', '<');
      });
      K.cap('Each new star gives ✨ <b>Glitter</b> (on Normal and Hard)', '+=0.3');
      K.wait(1.2);
      K.cap('Three stars on every fight of a novel: an <b style="color:#b35cff">Epic Pack</b>');
      const pack = K.add('ht-pack small', `<img src="${MB.packArt('epic')}">`, 380, 310);
      tl.fromTo(pack, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', immediateRender: true });
      K.burst({ x: 380, y: 300 }, ['✨', '💜'], 14, '<');
      K.wait(1.8);
    },

    arena(K) {
      const tl = K.tl;
      K.add('ht-board plain');
      const leaders = MB.STARTER_LEADERS.filter(has).slice(0, 3);
      const picks = leaders.map((id, i) => K.add('ht-pick', `<img src="${MB.spriteUrl(id, 'idle', null)}"><span>${MB.charById(id).name}</span>`, 230 + i * 150, 180));
      K.cap('🏟 <b>Arena</b>: pick one of three leaders');
      K.move({ x: 380, y: 190 }, 0.7, '+=0.4');
      K.press();
      tl.to(picks[1], { scale: 1.12, boxShadow: '0 0 24px #ffd84a', duration: 0.25 });
      tl.to([picks[0], picks[2]], { opacity: 0.25, duration: 0.25 }, '<');
      tl.to(picks, { opacity: 0, y: -30, duration: 0.35 }, '+=0.4');
      K.cap('<b>Draft</b> a deck one card at a time, from every card in the game');
      const pool = Object.keys(MB.CARDS).filter((id) => card(id).type === 'unit' && !card(id).token && has(id));
      const count = K.add('ht-count', '🂠 <b>0</b> / ' + MB.RULES.deckSize, 380, 330);
      for (let r = 0; r < 2; r++) {
        const offer = [0, 1, 2].map((i) => {
          const f = K.add('ht-frag', '', 230 + i * 150, 170);
          f.appendChild(MB.UI.cardEl(pool[(r * 7 + i * 3 + 1) % pool.length], false, { base: true }));
          tl.fromTo(f, { rotateY: 90, opacity: 0 }, { rotateY: 0, opacity: 1, duration: 0.35, immediateRender: true }, i ? '<0.08' : '+=0.1');
          return f;
        });
        const k = r ? 0 : 2;
        K.move({ x: 230 + k * 150, y: 180 }, 0.5, '+=0.3');
        K.press();
        tl.to(offer[k], { x: 380 - (230 + k * 150), y: 160, scale: 0.2, opacity: 0, duration: 0.45, ease: 'power2.in' });
        tl.to(offer.filter((_, i) => i !== k), { opacity: 0, duration: 0.3 }, '<');
        tl.call(() => { count.querySelector('b').textContent = r + 1; }, null);
      }
      K.hideCursor();
      tl.to(count, { opacity: 0, duration: 0.2 });
      K.cap('Battle until <b>7 wins</b> or <b>3 losses</b>: more wins, bigger rewards');
      const rec = K.add('ht-record', '<div class="w">' + '<i></i>'.repeat(7) + '</div><div class="l">' + '<i></i>'.repeat(3) + '</div>', 380, 190);
      tl.fromTo(rec, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      [...rec.querySelectorAll('.w i')].slice(0, 5).forEach((w) => {
        tl.call(() => w.classList.add('on'), null, '+=0.3');
        tl.fromTo(w, { scale: 1.8 }, { scale: 1, duration: 0.3 }, '<');
      });
      tl.call(() => rec.querySelector('.l i').classList.add('on'), null, '+=0.3');
      K.pop({ x: 380, y: 150 }, '✨ +🎁', '#ffe27a', '+=0.2');
      K.wait(1.8);
    },

    missions(K) {
      const tl = K.tl;
      K.add('ht-board plain');
      const list = ['Win 2 battles', 'Play 8 characters', 'Fuse a duo'];
      const rows = list.map((t, i) => K.add('ht-mission', `<span>${t}</span><div class="bar"><i></i></div><b>✨ ${40 + i * 20}</b>`, 300, 90 + i * 70));
      const glit = K.add('ht-glitter', '✨ <b>120</b>', 610, 150);
      K.cap('📅 Three new <b>Daily Missions</b> every day');
      rows.forEach((r) => tl.to(r.querySelector('i'), { width: '100%', duration: 0.6, ease: 'power1.inOut' }, '+=0.2'));
      K.cap('Finish them for <b style="color:#ffe27a">✨ Glitter</b>');
      let total = 120;
      rows.forEach((r, i) => {
        const v = 40 + i * 20, from = total;
        total += v;
        tl.to(r, { x: 250, opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.25');
        const o = { n: from };
        tl.to(o, { n: total, duration: 0.35, onUpdate: () => { glit.querySelector('b').textContent = Math.round(o.n); } }, '<0.2');
        K.burst({ x: 610, y: 150 }, ['✨'], 6, '<');
      });
      K.cap('Spend it on fragments you\'re missing, or make a card <b>Shiny</b>', '+=0.3');
      const c = K.add('ht-frag', '', 300, 190);
      const ce = MB.UI.cardEl('luther-jones', false, { base: true });
      c.appendChild(ce);
      tl.fromTo(c, { scale: 0, opacity: 0 }, { scale: 1.1, opacity: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: true });
      tl.call(() => { ce.classList.add('shiny'); ce.appendChild(el('div', 'shine', '<i>✦</i><i>✦</i><i>✦</i>')); }, null, '+=0.4');
      K.burst({ x: 300, y: 190 }, ['✦', '✨'], 14, '<');
      K.wait(2);
    },

    collection(K) {
      const tl = K.tl;
      const id = 'james-lone', hidden = MB.HIDDEN_COSTUMES[id] || [];
      const outfits = [null, ...MB.charById(id).costumes.filter((o) => !o.nsfw && !hidden.includes(o.id)).map((o) => o.id)].slice(0, 4);
      K.add('ht-board plain');
      const cards = ['luther-jones', id, 'keiko-ghan'].map((cid, i) => {
        const f = K.add('ht-frag', '', 230 + i * 150, 190);
        f.appendChild(MB.UI.cardEl(cid, false, { base: true }));
        return f;
      });
      K.cap('<b>Right-click</b> any card for a close-up');
      K.move({ x: 380, y: 190 }, 0.7, '+=0.3');
      K.press();
      K.pop({ x: 380, y: 150 }, 'right-click', '#fff', '<');
      tl.to([cards[0], cards[2]], { opacity: 0, duration: 0.3 });
      tl.to(cards[1], { x: -170, scale: 1.25, duration: 0.45, ease: 'power2.inOut' }, '<');
      const big = K.add('ht-closeup', `<img src="${MB.spriteUrl(id, 'idle', null)}"><div class="chips">${outfits.map((o, j) => `<i style="top:${40 + j * 40}px">${o ? MB.charById(id).costumes.find((c) => c.id === o).name : 'Usual'}</i>`).join('')}</div>`, 470, 30);
      tl.fromTo(big, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4 }, '<0.1');
      K.cap('👗 Pick an outfit from its <b>Wardrobe</b>');
      const chips = [...big.querySelectorAll('.chips i')];
      tl.call(() => chips[0].classList.add('on'));
      outfits.slice(1).forEach((o, i) => {
        K.move({ x: 470 + 222, y: 30 + 54 + (i + 1) * 40 }, 0.45, '+=0.5');
        K.press();
        tl.call(() => { chips.forEach((c, j) => c.classList.toggle('on', j === i + 1)); big.querySelector('img').src = MB.spriteUrl(id, 'idle', o); });
        tl.fromTo(big.querySelector('img'), { scale: 0.92, filter: 'brightness(2)' }, { scale: 1, filter: 'brightness(1)', duration: 0.35 }, '<');
      });
      K.hideCursor('+=0.3');
      K.cap('Keep up to 3 decks in <b>Deck &amp; Collection</b>');
      K.wait(1.8);
    },
  };

  // ---------------------------------------------------------------- topics (text + which clip)
  const RC = (r) => `<b style="color:${MB.RARITY[r].color}">${MB.RARITY[r].name}</b>`;
  const TOPICS = [
    { group: 'Battle' },
    { id: 'goal', icon: '🏆', title: 'Goal & Gold', text: () => `<p>Knock the enemy leader's HP to <b>0</b>. You gain <b>1 more gold</b> every turn (max ${MB.RULES.maxGold}), and cards cost gold to play (the number in the corner).</p>` },
    { id: 'summon', icon: '🃏', title: 'Summoning', text: () => `<p><b>Drag a character card</b> onto one of your 4 tiles to summon it. It can attack <b>next turn</b> (unless it has ⚡ Haste).</p>` },
    { id: 'attack', icon: '⚔️', title: 'Attacking', text: () => `<p><b>Drag from a glowing character</b> to an enemy to attack. Both deal their ATK to each other — unless the attacker is 🏹 Ranged. Hitting the leader is free.</p><p>Every character has their own <b>attack style</b>.</p>` },
    { id: 'items', icon: '🎒', title: 'Items', text: () => `<p><b>Item cards</b> come from the novel's inventory: drag them onto a target (or anywhere, if they have no target).</p>` },
    { id: 'power', icon: '✨', title: 'Leader Power', text: () => `<p>Your <b>Leader Power</b> (bottom-left button) can be used once per turn. Each leader has their own.</p>` },
    { id: 'keywords', icon: '🛡️', title: 'Keywords', text: () => `<div class="kw-list">${Object.values(MB.KEYWORDS).map((k) => `<div>${k.icon} <b>${k.name}</b> — ${k.text}</div>`).join('')}</div>` },
    { group: 'Special' },
    { id: 'bonds', icon: '💞', title: 'Relationships', text: () => `<p>Cards with a <b style="color:#ff8fc6">♥</b> have a partner. When both partners are on your side of the board they <b>fuse</b> into one duo — new costumes, combined stats, new keywords, a special attack, and they can attack right away. Stronger bonds (<b style="color:#ff8fc6">♥♥</b>, <b style="color:#ff8fc6">♥♥♥</b>) also unleash an effect when they fuse.</p>` },
    { id: 'combos', icon: '🔗', title: 'Item Combos', text: () => `<p>Some items belong to a character (cards with a <b style="color:#ffc93c">🔗</b>). Play the item while that character is on your side of the board (aim it at them, if it targets your monsters) and they change into a combo: a new outfit, extra stats and often a bonus effect. A hand card marked <b style="color:#ffc93c">COMBO</b> has its partner on the board right now.</p>` },
    { id: 'bosses', icon: '👑', title: 'Bosses', text: () => `<p>Every novel's boss has a <b>boss rule</b> that goes off every few turns, and a <b>💢 rage</b> the first time they drop to half HP. Both are shown before the fight and in the enemy's panel.</p>` },
    { group: 'Progress' },
    { id: 'packs', icon: '🎁', title: 'Card Packs', text: () => `<p>You start with the <b>Common</b> cards. Every win earns a 🎁 <b>card pack</b> full of 🧩 <b>card fragments</b> — open it in <b>Card Packs</b>. Collect enough fragments of a card and it's yours: ${RC('rare')} cards take ${MB.RARITY.rare.shards}, ${RC('epic')} ${MB.RARITY.epic.shards} and ${RC('legendary')} ${MB.RARITY.legendary.shards}. Beating a Story rival for the first time gives a few fragments of their card too.</p>` },
    { id: 'story', icon: '🗺', title: 'Story', text: () => `<p>One story across every novel's world, in four acts, each on its own map. Play the <b>main quests</b> in order to move the story along; <b>side quests</b> (<b style="color:#ffd84a">!</b>) show up on the map as the story reaches them. Drag or scroll the map to look around. Beating a rival recruits them as a leader and pays a 🎁 card pack, 🧩 fragments of their card and new <b>profile pictures</b>.</p>` },
    { id: 'stars', icon: '⭐', title: 'Stars', text: () => `<p>Every Story fight has three stars: win, win with your leader at 20+ HP, and a challenge of its own (shown before the fight). Stars count on Normal and Hard. Each new star gives ✨ Glitter, and three stars on every fight of one novel give an ${RC('epic')} Pack.</p>` },
    { id: 'arena', icon: '🏟', title: 'Arena', text: () => `<p>Pick one of three leaders and <b>draft</b> a deck one card at a time from every card in the game (owned or not). Then battle until 7 wins or 3 losses; each win makes the next rival tougher. The more wins, the bigger the ✨ Glitter and pack rewards. You can retire any time and take what you've earned.</p>` },
    { id: 'missions', icon: '📅', title: 'Missions & Glitter', text: () => `<p>Three new missions every day (↻ swaps one). Finishing them earns <b style="color:#ffe27a">✨ Glitter</b>, as does every win and any pack fragment a card didn't need. Spend it in the card close-up (right-click a card): <b>craft fragments</b> of a card you're missing, or make a card you own <b>Shiny</b>.</p>` },
    { id: 'collection', icon: '👗', title: 'Decks & Costumes', text: () => `<p><b>Right-click</b> any card for a close-up. Right-click a character you own and pick an outfit from its <b>Wardrobe</b>.</p><p>🂠 Keep up to 3 decks in <b>Deck &amp; Collection</b> (✎ renames one); the filters above the cards find what you need. Pick which deck to bring, and the <b>difficulty</b>, when you choose your leader.</p><p>🖼 Open <b>Profile</b> (or click your name at the top right of the main menu) to pick a profile picture and see your stats. New pictures are won by beating Story rivals.</p>` },
  ];
  const LESSONS = TOPICS.filter((t) => t.id);

  // ---------------------------------------------------------------- player
  let cur = 0, tl = null, again = null, built = false;

  function stop() {
    if (tl) tl.kill();
    if (again) again.kill();
    tl = again = null;
  }
  function play() {
    stop();
    const stage = $('#ht-stage');
    stage.innerHTML = '';
    tl = gsap.timeline({ onComplete: () => { again = gsap.delayedCall(0.9, () => gsap.to(stage.children, { opacity: 0, duration: 0.3, onComplete: play })); } });
    try { CLIPS[LESSONS[cur].id](kit(stage, tl)); } catch (e) { console.warn('How to Play clip failed', e); stop(); }
  }
  function select(i) {
    cur = (i + LESSONS.length) % LESSONS.length;
    const t = LESSONS[cur];
    document.querySelectorAll('#ht-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.id === t.id));
    $('#ht-title').innerHTML = `${t.icon} ${t.title}`;
    $('#ht-step').textContent = `${cur + 1} / ${LESSONS.length}`;
    $('#ht-text').innerHTML = t.text();
    $('#ht-text').scrollTop = 0;
    const tab = document.querySelector(`#ht-tabs button[data-id="${t.id}"]`);
    if (tab) tab.scrollIntoView({ block: 'nearest' });
    play();
  }

  function build() {
    if (built) return;
    built = true;
    const tabs = $('#ht-tabs');
    TOPICS.forEach((t) => {
      if (t.group) return tabs.appendChild(el('div', 'ht-group', t.group));
      const b = el('button', '', `<span>${t.icon}</span>${t.title}`);
      b.dataset.id = t.id;
      b.onclick = () => { MB.audio.sfx('click'); select(LESSONS.indexOf(t)); };
      tabs.appendChild(b);
    });
    $('#ht-prev').onclick = () => { MB.audio.sfx('click'); select(cur - 1); };
    $('#ht-next').onclick = () => { MB.audio.sfx('click'); select(cur + 1); };
    $('#ht-replay').onclick = () => { MB.audio.sfx('click'); play(); };
    // stop the clip whenever the screen is left, however it was left
    new MutationObserver(() => { if (!$('#screen-howto').classList.contains('active')) stop(); })
      .observe($('#screen-howto'), { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', (e) => {
      if (!$('#screen-howto').classList.contains('active')) return;
      if (e.key === 'ArrowRight') select(cur + 1);
      if (e.key === 'ArrowLeft') select(cur - 1);
    });
  }

  function open() {
    build();
    MB.UI.show('screen-howto');
    select(cur);
  }

  MB.HowTo = { open, stop };
})();
