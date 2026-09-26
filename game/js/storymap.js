// The Story screen: an act's map with its quests (js/story.js), the path of the main story across it, the quest
// panel, and the scenes played before and after the story's fights (visual-novel style, click to go on).
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const S = MB.Story;
  const VW = 1600, VH = 900, PANEL = 430; // the screen, and the quest panel on its right
  const click = () => MB.audio.sfx('click');

  let act = 0;         // the act on screen
  let sel = null;      // the selected quest
  let world = null;    // { w, h } of the map in px
  let pos = { x: 0, y: 0 };
  let pending = null;  // a Story win whose after-scene and map update wait for the result screen's Continue

  const U = () => MB.UI, save = () => MB.UI.save;
  const stageOf = (q) => (q.stage != null && q.stage >= 0 ? MB.STORY[q.stage] : null);
  const actQuests = (a) => S.quests.filter((q) => q.act === a && !S.hidden(q));
  const mainOf = (a) => S.main.filter((q) => q.act === a);
  const nameOf = (id) => (id === 'you' ? save().name : (MB.charById(id) || {}).name || id);
  const px = (q) => [q.at[0] / 100 * world.w, q.at[1] / 100 * world.h];

  // ---------------------------------------------------------------- the map
  function open(opts = {}) {
    U().hideBattle();
    U().show('screen-story');
    const s = save(), nxt = S.next(s);
    const focus = opts.focus && S.byId(opts.focus);
    act = focus ? focus.act : opts.act != null ? opts.act : nxt ? nxt.act : Math.min(act, MB.ACTS.length - 1);
    if (!S.actOpen(s, act)) act = 0;
    render(focus || (nxt && nxt.act === act ? nxt : null), opts);
  }

  function render(focus, opts = {}) {
    const s = save(), A = MB.ACTS[act];
    world = { w: A.size, h: Math.round(A.size * A.h / A.w) };
    MB.audio.music(A.music);
    U().setBg(MB.asset(A.map)).classList.add('blurred');
    const w = $('#map-world');
    Object.assign(w.style, { width: world.w + 'px', height: world.h + 'px' });
    $('#map-img').src = MB.asset(A.map);
    tabs();
    counters();
    drawPath();
    drawNodes(opts.opened || []);
    const nxt = S.next(s);
    $('#map-next').classList.toggle('hidden', !nxt);
    if (nxt) $('#map-next').innerHTML = `▶ ${nxt.act === act ? 'Next' : `Act ${nxt.act + 1}`}: <b>${nxt.title}</b>`;
    const q = focus || mainOf(act).filter((x) => S.isOpen(s, x)).pop() || mainOf(act)[0];
    select(q, false);
    placeToken(opts.walked && opts.walked.act === act ? opts.walked.from : null);
    if (opts.walked && opts.walked.act === act) walk(opts.walked);
  }

  function tabs() {
    const s = save(), box = $('#map-acts');
    box.innerHTML = '';
    MB.ACTS.forEach((A, a) => {
      const open = S.actOpen(s, a), main = mainOf(a), done = main.filter((q) => S.isDone(s, q)).length;
      const b = el('button', `act-tab${a === act ? ' on' : ''}${open ? '' : ' locked'}`,
        `<i>${a + 1}</i><span><b>${open ? A.title : '???'}</b><small>${open ? (done === main.length ? '✔ Complete' : `${done}/${main.length}`) : '🔒 Locked'}</small></span>`);
      b.style.setProperty('--c', A.color);
      b.onclick = () => {
        if (!open) { MB.audio.sfx('error'); gsap.fromTo(b, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.25)' }); return; }
        if (a === act) return;
        click();
        act = a;
        const nxt = S.next(s);
        render(nxt && nxt.act === a ? nxt : null);
        actCard(a);
      };
      box.appendChild(b);
    });
  }

  function counters() {
    const s = save(), qs = actQuests(act), side = qs.filter((q) => q.side);
    const fights = qs.filter((q) => stageOf(q)).map((q) => q.stage);
    const allMain = S.main, mainDone = allMain.filter((q) => S.isDone(s, q)).length;
    $('#map-count').innerHTML = `<span title="Main story, all acts">📖 ${mainDone}/${allMain.length}</span>`
      + `<span title="Side quests in this act">📜 ${side.filter((q) => S.isDone(s, q)).length}/${side.length}</span>`
      + `<span title="Stars in this act">⭐ ${MB.Stars.starCount(s, fights)}/${fights.length * 3}</span>`;
  }

  // Catmull-Rom through the points, as cubic Béziers: one path per link between two main quests
  function curve(pts) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1.map((v) => v.toFixed(1))} ${c2.map((v) => v.toFixed(1))} ${p2.map((v) => v.toFixed(1))}`;
    }
    return d;
  }
  // the points of the link that leads to main quest q (from the one before it in this act)
  function linkPts(q) {
    const main = mainOf(act), k = main.indexOf(q);
    if (k < 1) return null;
    return [px(main[k - 1]), ...(q.via || []).map((v) => [v[0] / 100 * world.w, v[1] / 100 * world.h]), px(q)];
  }
  function drawPath() {
    const s = save(), svg = $('#map-path');
    svg.setAttribute('viewBox', `0 0 ${world.w} ${world.h}`);
    Object.assign(svg.style, { width: world.w + 'px', height: world.h + 'px' });
    svg.innerHTML = '';
    mainOf(act).forEach((q) => {
      const pts = linkPts(q);
      if (!pts) return;
      const d = curve(pts), walked = S.isOpen(s, q);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `link${walked ? ' walked' : ''}`);
      g.dataset.to = q.id;
      g.innerHTML = `<path class="under" d="${d}"/><path class="line" d="${d}"/>`;
      svg.appendChild(g);
    });
  }

  function faceHtml(q) {
    if (!q.foe) return `<div class="qn-face scene">${q === S.lastOf(q.act) && q.act === MB.ACTS.length - 1 ? '🏁' : '📖'}</div>`;
    return `<div class="qn-face" style="background-image:url('${MB.spriteUrl(q.foe, 'idle')}')"></div>`;
  }
  const starRow = (bits) => [0, 1, 2].map((k) => `<i class="${bits & (1 << k) ? 'on' : ''}">${bits & (1 << k) ? '★' : '☆'}</i>`).join('');

  function drawNodes(fresh) {
    const s = save(), box = $('#map-nodes'), main = mainOf(act);
    box.innerHTML = '';
    const nxt = S.next(s);
    actQuests(act).forEach((q) => {
      const open = S.isOpen(s, q), done = S.isDone(s, q);
      if (q.side && !open) return; // side quests show up once they open
      const state = done ? 'done' : open ? 'open' : 'locked';
      const n = el('div', `qn ${q.side ? 'side' : 'main'}${q.foe ? '' : ' scene'} ${state}${q === nxt ? ' next' : ''}${stageOf(q) && MB.bossOf(q.stage) ? ' boss' : ''}`);
      n.style.left = q.at[0] + '%';
      n.style.top = q.at[1] + '%';
      n.style.setProperty('--c', MB.ACTS[act].color);
      n.dataset.id = q.id;
      const num = q.main ? main.indexOf(q) + 1 : null;
      n.innerHTML = `<div class="qn-ring">${state === 'locked' ? '<div class="qn-face lock">?</div>' : faceHtml(q)}</div>`
        + (q.main ? `<b class="qn-num">${num}</b>` : !done ? '<b class="qn-new">!</b>' : '')
        + (stageOf(q) && MB.bossOf(q.stage) && state !== 'locked' ? '<b class="qn-crown">👑</b>' : '')
        + (stageOf(q) && done ? `<div class="qn-stars">${starRow(s.stars[q.stage] | 0)}</div>` : '')
        + (state !== 'locked' ? `<div class="qn-label">${q.title}</div>` : '');
      n.addEventListener('click', (e) => { if (dragged) return; e.stopPropagation(); click(); select(q, true); });
      n.addEventListener('pointerenter', () => { if (state !== 'locked') MB.audio.sfx('hover'); });
      box.appendChild(n);
      if (fresh.includes(q.id)) gsap.fromTo(n, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, delay: 1.2 + fresh.indexOf(q.id) * 0.15, ease: 'back.out(2.5)' });
    });
  }

  // your profile picture, standing at the next main quest (or the last one you reached in this act)
  function placeToken(at) {
    const s = save(), main = mainOf(act), nxt = S.next(s);
    let q = at ? S.byId(at) : nxt && nxt.act === act ? nxt : main.filter((x) => S.isOpen(s, x)).pop();
    if (!q) q = main[0];
    const t = $('#map-token');
    t.innerHTML = `<img src="${MB.avatarUrl(s.avatar)}">`;
    const [x, y] = px(q);
    gsap.killTweensOf(t);
    gsap.set(t, { x, y, xPercent: -50, yPercent: -100 });
    gsap.fromTo(t.firstChild, { y: 0 }, { y: -8, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  // the token walks the path to the quest that just opened, which pops in
  function walk({ to }) {
    const q = S.byId(to), pts = q && q.act === act && linkPts(q);
    if (!pts) return;
    const t = $('#map-token'), g = $(`#map-path .link[data-to="${to}"]`);
    if (g) {
      const line = g.querySelector('.line');
      gsap.fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, delay: 0.3, ease: 'power1.inOut' });
    }
    gsap.to(t, { motionPath: { path: curve(pts) }, duration: 1.2, delay: 0.3, ease: 'power1.inOut', onComplete: () => MB.audio.sfx('ding') });
    const n = $(`#map-nodes .qn[data-id="${to}"]`);
    if (n) gsap.fromTo(n, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, delay: 1.3, ease: 'back.out(2.5)' });
  }

  // ---------------------------------------------------------------- panning
  let dragged = false;
  const clampPos = (p) => ({ x: Math.min(0, Math.max(VW - world.w, p.x)), y: Math.min(0, Math.max(VH - world.h, p.y)) });
  function moveTo(p, animate) {
    pos = clampPos(p);
    if (animate) gsap.to('#map-world', { x: pos.x, y: pos.y, duration: 0.8, ease: 'power3.inOut' });
    else { gsap.killTweensOf('#map-world'); gsap.set('#map-world', { x: pos.x, y: pos.y }); }
  }
  // a quest in the middle of what the panel leaves free
  function centerOn(q, animate) {
    const [x, y] = px(q);
    moveTo({ x: (VW - PANEL) / 2 - x, y: VH / 2 + 40 - y }, animate);
  }
  function bindPan() {
    const view = $('#map-view');
    let start = null;
    const scale = () => document.getElementById('ui-root').getBoundingClientRect().width / VW;
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, pos: { ...pos }, k: scale() };
      dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = (e.clientX - start.x) / start.k, dy = (e.clientY - start.y) / start.k;
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      if (!dragged) { dragged = true; view.classList.add('dragging'); }
      moveTo({ x: start.pos.x + dx, y: start.pos.y + dy });
    });
    window.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      view.classList.remove('dragging');
      setTimeout(() => { dragged = false; }, 0); // the click that ends a drag doesn't select anything
    });
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      moveTo({ x: pos.x - (e.shiftKey ? e.deltaY : e.deltaX), y: pos.y - (e.shiftKey ? 0 : e.deltaY) });
    }, { passive: false });
  }

  // ---------------------------------------------------------------- the quest panel
  function select(q, animate) {
    sel = q;
    document.querySelectorAll('#map-nodes .qn.sel').forEach((n) => n.classList.remove('sel'));
    const n = $(`#map-nodes .qn[data-id="${q.id}"]`);
    if (n) n.classList.add('sel');
    centerOn(q, animate);
    panel(q);
  }

  function panel(q) {
    const s = save(), p = $('#map-panel'), st = stageOf(q), open = S.isOpen(s, q), done = S.isDone(s, q);
    const main = mainOf(q.act), prev = q.main ? main[main.indexOf(q) - 1] || S.main[S.main.indexOf(q) - 1] : S.byId(q.from);
    const tag = q.side ? 'Side quest' : `${q.foe ? 'Main story' : 'Story'} · ${main.indexOf(q) + 1}/${main.length}`;
    const boss = st && MB.bossOf(q.stage), ch = q.foe && MB.charById(q.foe);
    let art;
    if (!open) art = '<div class="mp-art lock">?</div>';
    else if (q.foe) art = `<div class="mp-art"><img src="${MB.spriteUrl(q.foe, done ? 'win' : 'taunt')}"></div>`;
    else {
      // a scene: the first few characters who speak in it
      const who = [...new Set(q.scene.lines.map(S.lineOf).filter((l) => l.who && l.who !== '*' && l.who !== 'you' && MB.charById(l.who)).map((l) => l.who))].slice(0, 3);
      art = `<div class="mp-art trio">${who.map((id) => `<img src="${MB.spriteUrl(id, 'idle')}">`).join('')}</div>`;
    }
    let body = `<div class="mp-tag" style="--c:${MB.ACTS[q.act].color}">${tag}${boss ? ' · 👑 Boss' : ''}</div><h2>${open ? q.title : '???'}</h2>`;
    if (!open) {
      body += art + `<p class="mp-text">🔒 Finish <b>${prev ? prev.title : 'the quest before'}</b> first.</p>`;
    } else {
      body += art;
      if (ch) body += `<div class="mp-who"><b>${ch.name}</b> · ${MB.Missions.novelName(ch.novel)}<br><small>📍 ${st.bg.trim()}</small></div>`;
      body += `<p class="mp-text">${q.text}</p>`;
      if (boss) body += `<div class="mp-boss" style="--c:${boss.color}">${boss.emoji} <b>${boss.name}:</b> ${boss.text}${boss.rage ? `<br>💢 <b>${boss.rage.name}:</b> ${boss.rage.text}` : ''}</div>`;
      if (st) {
        const have = s.stars[q.stage] | 0;
        body += `<div class="mp-stars">${MB.Stars.starsOf(q.stage).map((x, k) => `<span class="${have & (1 << k) ? 'on' : ''}">${have & (1 << k) ? '★' : '☆'} ${x.text}</span>`).join('')}</div>`;
        if (!done) body += `<div class="mp-reward">First win: <b>${ch.name}</b>'s card and leader · ${boss ? '<b style="color:#b35cff">Epic Pack</b>' : '<b style="color:#4aa3ff">Rare Pack</b>'}${q === S.lastOf(q.act) ? ' · 🏁 Act complete: <b style="color:#b35cff">Epic Pack</b>' : ''}</div>`;
      } else if (!done && q === S.lastOf(q.act)) body += '<div class="mp-reward">🏁 Act complete: <b style="color:#b35cff">Epic Pack</b></div>';
    }
    p.innerHTML = `<button class="mp-close" title="Close">✕</button>${body}<div class="mp-btns"></div>`;
    const btns = p.querySelector('.mp-btns');
    if (open) {
      const go = el('button', 'btn primary', q.foe ? (done ? '⚔ Rematch' : '⚔ Battle!') : done ? '📖 Watch again' : '📖 Play');
      go.onclick = () => { click(); play(q); };
      btns.appendChild(go);
      if (q.foe && done && (q.before || q.after)) {
        const re = el('button', 'btn', '📖 Scenes');
        re.onclick = () => { click(); replay(q); };
        btns.appendChild(re);
      }
    }
    p.querySelector('.mp-close').onclick = () => { click(); p.classList.add('closed'); };
    p.classList.remove('closed');
    gsap.fromTo(p, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  // ---------------------------------------------------------------- playing a quest
  function play(q) {
    const s = save();
    if (!S.isOpen(s, q)) return;
    if (!q.foe) {
      scene(S.sceneOf(q, 'scene'), () => finish(q, S.complete(s, q.id)));
      return;
    }
    const first = !S.isDone(s, q);
    U().leaderSelect((lid) => {
      const fight = () => U().storyIntro(q.stage, lid);
      if (first && q.before) scene(S.sceneOf(q, 'before'), fight);
      else fight();
    }, q.foe, () => open({ focus: q.id }));
  }
  function replay(q) {
    const parts = ['before', 'after'].map((k) => S.sceneOf(q, k)).filter(Boolean);
    const run = (i) => (i < parts.length ? scene(parts[i], () => run(i + 1)) : open({ focus: q.id }));
    run(0);
  }
  // a quest just finished (res from MB.Story.complete): save, then back to the map, walking on to what opened
  function finish(q, res) {
    U().persist();
    if (!res.first) { open({ focus: q.id }); return; }
    const nxt = S.next(save()), newAct = nxt && nxt.act !== q.act;
    if (newAct) open({ act: nxt.act, focus: nxt.id, opened: res.opened });
    else open({ focus: nxt ? nxt.id : q.id, opened: res.opened, walked: nxt ? { act: q.act, from: q.id, to: nxt.id } : null });
    // a finished act: its reward over the next act's map, then that act's title
    const card = () => { if (newAct) actCard(nxt.act); };
    if (res.act != null) actDone(res.act, card);
    else card();
  }
  // called by the result screen after a Story win: the scene after the fight, then the map
  function won(q, res) { pending = { q, res }; }
  function next() {
    const p = pending;
    pending = null;
    if (!p) { open(); return; }
    const after = p.res.first && S.sceneOf(p.q, 'after');
    if (after) scene(after, () => finish(p.q, p.res));
    else finish(p.q, p.res);
  }
  const hasAfter = () => !!(pending && pending.res.first);

  // ---------------------------------------------------------------- act cards
  function actCard(a) {
    const A = MB.ACTS[a], c = el('div', 'act-card', `<small>Act ${a + 1}</small><b>${A.title}</b>`);
    c.style.setProperty('--c', A.color);
    $('#screen-story').appendChild(c);
    gsap.timeline({ onComplete: () => c.remove() })
      .fromTo(c, { opacity: 0, scale: 1.3, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out' })
      .to(c, { opacity: 0, y: -30, duration: 0.6, delay: 1.4 });
    MB.audio.sfx('riser');
  }
  function actDone(a, then) {
    const A = MB.ACTS[a], last = a === MB.ACTS.length - 1;
    const box = el('div', 'act-done', `<small>Act ${a + 1} complete</small><b>${A.title}</b>`
      + `<p>🎁 <b style="color:#b35cff">Epic Pack</b> earned!${last ? '<br>You finished the story. Side quests and rematches stay open on every map.' : `<br>Next: Act ${a + 2} · ${MB.ACTS[a + 1].title}`}</p><button class="btn primary">Continue</button>`);
    box.style.setProperty('--c', A.color);
    document.getElementById('ui-root').appendChild(box);
    MB.audio.sfx('fanfare');
    gsap.fromTo(box, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' });
    box.querySelector('button').onclick = () => { click(); box.remove(); then(); };
  }

  // ---------------------------------------------------------------- scenes
  let sceneKeys = null;
  function scene(sc, done) {
    const s = save(), box = $('#screen-scene');
    U().hideBattle();
    U().show('screen-scene');
    U().setBg(MB.asset(U().bgByName(sc.bg).src));
    if (sc.music) MB.audio.music(sc.music);
    const lines = sc.lines.map(S.lineOf);
    const slots = { left: null, right: null }, spoke = { left: 0, right: 0 };
    const img = { left: $('#sc-left'), right: $('#sc-right') };
    Object.values(img).forEach((i) => { i.classList.add('gone'); i.removeAttribute('src'); });
    let i = 0, typing = null, tick = 0, over = false;

    const sideOf = (who) => (slots.left === who ? 'left' : slots.right === who ? 'right' : null);
    function place(who, role) {
      let side = sideOf(who);
      const fresh = !side;
      if (!side) {
        // Hayley, your companion, stands on the left; others take whichever side spoke least recently
        side = who === 'hayley-kate' && slots.left !== null && slots.right === null ? 'right'
          : who === 'hayley-kate' ? 'left' : !slots.right ? 'right' : !slots.left ? 'left' : spoke.left < spoke.right ? 'left' : 'right';
        slots[side] = who;
      }
      const im = img[side];
      if (fresh) gsap.killTweensOf(im); // still fading out after someone who left
      im.src = MB.bigSpriteUrl(who, role);
      im.classList.remove('gone');
      if (fresh) gsap.fromTo(im, { x: side === 'left' ? -300 : 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
      else gsap.fromTo(im, { y: 0 }, { y: -14, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out' });
      spoke[side] = ++tick;
      Object.entries(img).forEach(([k, x]) => x.classList.toggle('dim', k !== side));
    }
    const leave = (side) => {
      slots[side] = null;
      gsap.to(img[side], { opacity: 0, duration: 0.3, onComplete: () => { if (!slots[side]) img[side].classList.add('gone'); } });
    };
    function direct(d) {
      // a new place: whoever was on stage stays behind
      if (d.bg) { U().setBg(MB.asset(U().bgByName(d.bg).src)); ['left', 'right'].forEach((k) => { if (slots[k]) leave(k); }); }
      if (d.music) MB.audio.music(d.music);
      if (d.sfx) MB.audio.sfx(d.sfx);
      if (d.hide && sideOf(d.hide)) leave(sideOf(d.hide));
      // an open rift snaps shut with the next flash or change of place
      if ((d.bg || d.fx === 'flash') && gsap.getProperty('#sc-rift', 'scale') > 0) gsap.to('#sc-rift', { scale: 0, rotation: 40, duration: 0.35, ease: 'back.in(2)' });
      if (d.fx === 'flash' || d.fx === 'rift') gsap.fromTo('#sc-flash', { opacity: d.fx === 'rift' ? 0.5 : 0.95 }, { opacity: 0, duration: d.fx === 'rift' ? 1.2 : 0.7, ease: 'power2.out' });
      if (d.fx === 'rift') gsap.fromTo('#sc-rift', { scale: 0, opacity: 1, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' });
      if (d.fx === 'shake') gsap.fromTo(box, { x: -14 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,0.2)' });
    }
    function step() {
      if (typing) { typing.progress(1); return; }
      while (i < lines.length && !lines[i].text) direct(lines[i++]);
      if (i >= lines.length) { end(); return; }
      const l = lines[i++], who = l.who, narr = who === '*';
      if (!narr && who !== 'you' && MB.charById(who)) place(who, l.role);
      else Object.values(img).forEach((x) => x.classList.add('dim'));
      $('#sc-name').textContent = narr ? '' : nameOf(who);
      $('#sc-name').classList.toggle('hidden', narr);
      box.querySelector('.sc-box').classList.toggle('narr', narr);
      const text = l.text.replace(/\{name\}/g, s.name), o = { n: 0 }, t = $('#sc-text');
      t.textContent = '';
      $('#sc-more').classList.add('hidden');
      typing = gsap.to(o, { n: text.length, duration: Math.min(2.5, text.length * 0.022), ease: 'none',
        onUpdate: () => { t.textContent = text.slice(0, o.n | 0); },
        onComplete: () => { t.textContent = text; typing = null; $('#sc-more').classList.remove('hidden'); } });
    }
    function end() {
      if (over) return;
      over = true;
      if (typing) typing.kill();
      document.removeEventListener('keydown', sceneKeys);
      sceneKeys = null;
      gsap.set('#sc-rift', { scale: 0 });
      done();
    }
    box.onclick = (e) => { if (e.target.closest('#sc-skip')) return; step(); };
    $('#sc-skip').onclick = () => { click(); end(); };
    if (sceneKeys) document.removeEventListener('keydown', sceneKeys);
    sceneKeys = (e) => {
      if (!box.classList.contains('active')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); } else if (e.key === 'Escape') end();
    };
    document.addEventListener('keydown', sceneKeys);
    gsap.set('#sc-rift', { scale: 0 });
    step();
  }

  function bind() {
    bindPan();
    $('#map-next').onclick = () => {
      click();
      const nxt = S.next(save());
      if (!nxt) return;
      if (nxt.act !== act) { act = nxt.act; render(nxt); actCard(act); } else select(nxt, true);
    };
  }

  MB.StoryMap = { open, bind, won, next, hasAfter, scene };
})();
