// The Story screen: an act's map with its quests (js/story.js), the paths of its storylines, the locations you can
// enter, secrets to find, the quest panel, and the cinematic scenes played around the story's fights.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const S = MB.Story, FX = MB.SceneFX;
  const VW = 1600, VH = 900, PANEL = 430; // the screen, and the quest panel on its right
  const click = () => MB.audio.sfx('click');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let act = 0;         // the act on screen
  let place = null;    // the location of it on screen (null: the act map)
  let world = null;    // { w, h } of the map on screen, in px
  let pos = { x: 0, y: 0 };
  let token = null;    // what the player token stands on: a quest id, a place id or a secret id
  let pending = null;  // a Story win whose after-scene and map update wait for the result screen's Continue

  const U = () => MB.UI, save = () => MB.UI.save;
  const stageOf = (q) => (q.stage != null && q.stage >= 0 ? MB.STORY[q.stage] : null);
  const actQuests = (a) => S.quests.filter((q) => q.act === a && !S.hidden(q));
  const mainOf = (a) => S.main.filter((q) => q.act === a);
  const nameOf = (id) => (id === 'you' ? save().name : (MB.charById(id) || {}).name || id);
  const view = () => (place ? S.place(place) : MB.ACTS[act]);
  // where something is drawn in the view on screen, in px: a quest in this view, the marker of the location a quest
  // is in (on the act map), a location marker or a secret; null when it isn't in this view
  function spot(x) {
    if (!x) return null;
    const xp = x.place || null;
    const at = xp === place ? x.at : !place && xp ? S.place(xp).at : null;
    return at ? [at[0] / 100 * world.w, at[1] / 100 * world.h] : null;
  }
  const bossOf = (q) => stageOf(q) && MB.bossOf(q.stage);

  // ---------------------------------------------------------------- the map
  function open(opts = {}) {
    U().hideBattle();
    U().show('screen-story');
    const s = save(), nxt = S.next(s);
    const focus = opts.focus && S.byId(opts.focus);
    act = focus ? focus.act : opts.act != null ? opts.act : nxt ? nxt.act : Math.min(act, MB.ACTS.length - 1);
    if (!S.actOpen(s, act)) act = 0;
    const target = focus || (nxt && nxt.act === act ? nxt : null);
    place = opts.place !== undefined ? opts.place : target ? target.place || null : null;
    render(target && (target.place || null) === place ? target : null, opts);
    if (!s.actIntros.includes(act) && !opts.walked) flyover(act);
  }

  function render(focus, opts = {}) {
    const s = save(), A = MB.ACTS[act], V = view();
    world = { w: V.size, h: Math.round(V.size * V.h / V.w) };
    const src = MB.asset(place ? V.map : S.mapOf(s, act));
    MB.audio.music(A.music);
    U().setBg(src).classList.add('blurred');
    gsap.set('#map-world', { scale: 1, opacity: 1 });
    Object.assign($('#map-world').style, { width: world.w + 'px', height: world.h + 'px' });
    $('#map-img').src = src;
    $('#screen-story').classList.toggle('in-place', !!place);
    $('#map-leave').classList.toggle('hidden', !place);
    if (place) $('#map-leave').innerHTML = `← ${A.title}`;
    tabs();
    counters();
    drawPath();
    drawNodes(opts.opened || []);
    const nxt = S.next(s);
    $('#map-next').classList.toggle('hidden', !nxt);
    if (nxt) $('#map-next').innerHTML = `▶ ${nxt.act === act ? 'Next' : `Act ${nxt.act + 1}`}: <b>${nxt.title}</b>`;
    const here = actQuests(act).filter((q) => (q.place || null) === place);
    const q = focus || (nxt && nxt.act === act && spot(nxt) ? nxt : null) || here.filter((x) => x.main && S.isOpen(s, x)).pop() || here[0];
    if (q && (q.place || null) === place) select(q, false);
    else if (nxt && spot(nxt)) selectPlace(S.place(nxt.place), false);
    placeToken(opts.walked && opts.walked.act === act ? opts.walked.from : q && q.id);
    if (opts.walked && opts.walked.act === act) walk(opts.walked);
    if (place) placeCard(V);
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
        if (a === act && !place) return;
        click();
        const nxt = S.next(s);
        act = a;
        place = null;
        render(nxt && nxt.act === a && !nxt.place ? nxt : null);
        if (!s.actIntros.includes(a)) flyover(a); else actCard(a);
      };
      box.appendChild(b);
    });
  }

  function counters() {
    const s = save(), qs = actQuests(act), side = qs.filter((q) => q.side), secrets = S.secrets.filter((x) => x.act === act);
    const fights = qs.filter((q) => stageOf(q)).map((q) => q.stage);
    const mainDone = S.main.filter((q) => S.isDone(s, q)).length;
    $('#map-count').innerHTML = `<span title="Main story, all acts">📖 ${mainDone}/${S.main.length}</span>`
      + `<span title="Side quests in this act">📜 ${side.filter((q) => S.isDone(s, q)).length}/${side.length}</span>`
      + (secrets.length ? `<span title="Secrets found in this act">✦ ${secrets.filter((x) => s.secrets.includes(x.id)).length}/${secrets.length}</span>` : '')
      + `<span title="Stars in this act">⭐ ${MB.Stars.starCount(s, fights)}/${fights.length * 3}</span>`;
  }

  // Catmull-Rom through the points, as cubic Béziers
  function curve(pts) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1.map((v) => v.toFixed(1))} ${c2.map((v) => v.toFixed(1))} ${p2.map((v) => v.toFixed(1))}`;
    }
    return d;
  }
  // the points of the path that leads to main quest q from its first need, in this view (null if not drawn here)
  function linkPts(q) {
    const from = S.byId(q.needs[0]);
    if (!from || from.act !== q.act) return null;
    const a = spot(from), b = spot(q);
    if (!a || !b || (a[0] === b[0] && a[1] === b[1])) return null;
    const via = from.place === place && q.place === place ? (q.via || []).map((v) => [v[0] / 100 * world.w, v[1] / 100 * world.h]) : [];
    return [a, ...via, b];
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
      g.setAttribute('class', `link${walked ? ' walked' : ''}${q.arc ? ' arc' : ''}`);
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
  const mark = (n, at) => { n.style.left = at[0] + '%'; n.style.top = at[1] + '%'; n.style.setProperty('--c', MB.ACTS[act].color); return n; };

  function drawNodes(fresh) {
    const s = save(), box = $('#map-nodes'), main = mainOf(act), nxt = S.next(s);
    box.innerHTML = '';
    actQuests(act).filter((q) => (q.place || null) === place).forEach((q) => {
      const open = S.isOpen(s, q), done = S.isDone(s, q);
      if (q.side && !open) return; // side quests show up once they open
      const state = done ? 'done' : open ? 'open' : 'locked';
      const n = mark(el('div', `qn ${q.side ? 'side' : 'main'}${q.foe ? '' : ' scene'} ${state}${q === nxt ? ' next' : ''}${bossOf(q) ? ' boss' : ''}`), q.at);
      n.dataset.id = q.id;
      n.innerHTML = `<div class="qn-ring">${state === 'locked' ? '<div class="qn-face lock">?</div>' : faceHtml(q)}</div>`
        + (q.main ? `<b class="qn-num">${main.indexOf(q) + 1}</b>` : !done ? '<b class="qn-new">!</b>' : '')
        + (bossOf(q) && state !== 'locked' ? '<b class="qn-crown">👑</b>' : '')
        + (stageOf(q) && done ? `<div class="qn-stars">${starRow(s.stars[q.stage] | 0)}</div>` : '')
        + (state !== 'locked' ? `<div class="qn-label">${q.arc && q.main ? `<small>${q.arc}</small>` : ''}${q.title}</div>` : '');
      n.addEventListener('click', (e) => { if (dragged) return; e.stopPropagation(); click(); select(q, true); });
      n.addEventListener('pointerenter', () => { if (state !== 'locked') MB.audio.sfx('hover'); });
      box.appendChild(n);
      if (fresh.includes(q.id)) gsap.fromTo(n, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, delay: 1.2 + fresh.indexOf(q.id) * 0.15, ease: 'back.out(2.5)' });
    });
    if (place) return;
    // the locations of this act: a portal with what waits inside
    S.placesOf(act).forEach((p) => {
      const inside = actQuests(act).filter((q) => q.place === p.id), opened = inside.filter((q) => S.isOpen(s, q));
      const todo = opened.filter((q) => !S.isDone(s, q)).length, all = inside.every((q) => S.isDone(s, q));
      const n = mark(el('div', `qn place${opened.length ? '' : ' locked'}${all ? ' done' : ''}${nxt && nxt.place === p.id ? ' next' : ''}`), p.at);
      n.dataset.place = p.id;
      n.innerHTML = `<div class="qn-ring"><div class="qn-face qn-portal">${opened.length ? p.icon || '🚪' : '🔒'}</div></div>`
        + (todo ? `<b class="qn-new">${todo}</b>` : '') + `<div class="qn-label"><small>Location</small>${p.title}</div>`;
      n.addEventListener('click', (e) => { if (dragged) return; e.stopPropagation(); click(); selectPlace(p, true); });
      n.addEventListener('dblclick', () => { if (opened.length) enter(p.id); });
      box.appendChild(n);
      if (inside.some((q) => fresh.includes(q.id))) gsap.fromTo(n, { scale: 0.6 }, { scale: 1, duration: 0.8, delay: 1.2, ease: 'elastic.out(1,0.4)' });
    });
    // secrets: little sparkles, found once
    S.secrets.filter((x) => x.act === act).forEach((x) => {
      const found = s.secrets.includes(x.id);
      const n = mark(el('div', `secret${found ? ' found' : ''}`, `<i>✦</i><span>${found ? x.title : '???'}</span>`), x.at);
      n.addEventListener('click', (e) => { if (dragged) return; e.stopPropagation(); MB.audio.sfx('glint'); walkTo(x); secret(x); });
      box.appendChild(n);
    });
  }

  // ---------------------------------------------------------------- the player token
  function placeToken(id) {
    const s = save(), t = $('#map-token');
    t.innerHTML = `<img src="${MB.avatarUrl(s.avatar)}">`;
    const at = spot(S.byId(id) || (S.place(id) && { at: S.place(id).at })) || spot(S.next(s)) || [world.w / 2, world.h / 2];
    token = id;
    gsap.killTweensOf(t);
    gsap.set(t, { x: at[0], y: at[1], xPercent: -50, yPercent: -100 });
    gsap.fromTo(t.firstChild, { y: 0 }, { y: -8, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  // the token strolls to whatever you pick on the map
  function walkTo(x) {
    const at = spot(x);
    if (!at) return;
    const t = $('#map-token'), from = [gsap.getProperty(t, 'x'), gsap.getProperty(t, 'y')];
    const dist = Math.hypot(at[0] - from[0], at[1] - from[1]);
    if (dist < 2) return;
    gsap.to(t, { x: at[0], y: at[1], duration: Math.min(1.1, 0.25 + dist / 1400), ease: 'power2.inOut', overwrite: 'auto' });
    gsap.fromTo(t.firstChild, { rotation: -8 }, { rotation: 8, duration: 0.14, yoyo: true, repeat: Math.min(7, Math.round(dist / 180)) | 1, ease: 'sine.inOut', onComplete: () => gsap.set(t.firstChild, { rotation: 0 }) });
    token = x.id;
  }
  // after a quest: the token walks the path to the next one, which pops in
  function walk({ to }) {
    const q = S.byId(to), pts = q && linkPts(q);
    if (!pts) { if (q) walkTo(q); return; }
    const g = $(`#map-path .link[data-to="${to}"]`);
    if (g) gsap.fromTo(g.querySelector('.line'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, delay: 0.3, ease: 'power1.inOut' });
    gsap.to('#map-token', { motionPath: { path: curve(pts) }, duration: 1.2, delay: 0.3, ease: 'power1.inOut', onComplete: () => MB.audio.sfx('ding') });
    const n = $(`#map-nodes .qn[data-id="${to}"]`);
    if (n) gsap.fromTo(n, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, delay: 1.3, ease: 'back.out(2.5)' });
  }

  // ---------------------------------------------------------------- panning
  let dragged = false;
  const clampPos = (p) => ({ x: Math.min(0, Math.max(VW - world.w, p.x)), y: Math.min(0, Math.max(VH - world.h, p.y)) });
  function moveTo(p, animate, duration = 0.8) {
    pos = clampPos(p);
    if (animate) gsap.to('#map-world', { x: pos.x, y: pos.y, duration, ease: 'power3.inOut', overwrite: 'auto' });
    else { gsap.killTweensOf('#map-world'); gsap.set('#map-world', { x: pos.x, y: pos.y }); }
  }
  // a point in the middle of what the panel leaves free
  const centerAt = (at, animate) => at && moveTo({ x: (VW - PANEL) / 2 - at[0], y: VH / 2 + 40 - at[1] }, animate);
  function bindPan() {
    const v = $('#map-view');
    let start = null;
    const scale = () => document.getElementById('ui-root').getBoundingClientRect().width / VW;
    v.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, pos: { ...pos }, k: scale() };
      dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = (e.clientX - start.x) / start.k, dy = (e.clientY - start.y) / start.k;
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      if (!dragged) { dragged = true; v.classList.add('dragging'); }
      moveTo({ x: start.pos.x + dx, y: start.pos.y + dy });
    });
    window.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      v.classList.remove('dragging');
      setTimeout(() => { dragged = false; }, 0); // the click that ends a drag doesn't select anything
    });
    v.addEventListener('wheel', (e) => {
      e.preventDefault();
      moveTo({ x: pos.x - (e.shiftKey ? e.deltaY : e.deltaX), y: pos.y - (e.shiftKey ? 0 : e.deltaY) });
    }, { passive: false });
  }

  // ---------------------------------------------------------------- locations
  function enter(id) {
    const p = S.place(id);
    MB.audio.sfx('whoosh');
    const at = spot({ at: p.at });
    // zoom into the marker, then open the location
    gsap.to('#map-world', { scale: 2.2, x: VW / 2 - at[0] * 2.2, y: VH / 2 - at[1] * 2.2, opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: () => {
      gsap.set('#map-world', { scale: 1, opacity: 1 });
      place = id;
      const s = save(), nxt = S.next(s), inside = actQuests(act).filter((q) => q.place === id);
      render(nxt && nxt.place === id ? nxt : inside.filter((q) => S.isOpen(s, q) && !S.isDone(s, q))[0] || null);
      gsap.fromTo('#map-world', { scale: 0.6, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' });
    } });
  }
  function leave() {
    const was = place;
    MB.audio.sfx('whoosh');
    place = null;
    render(null);
    const p = S.place(was);
    selectPlace(p, false);
    placeToken(was);
    gsap.fromTo('#map-world', { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  function placeCard(p) {
    const c = el('div', 'place-card', `<small>${MB.ACTS[act].title}</small><b>${p.icon || ''} ${p.title}</b>`);
    c.style.setProperty('--c', MB.ACTS[act].color);
    $('#screen-story').appendChild(c);
    gsap.timeline({ onComplete: () => c.remove() }).fromTo(c, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4 }).to(c, { opacity: 0, duration: 0.5, delay: 1.4 });
  }

  // ---------------------------------------------------------------- the panel
  function mark_sel(sel) {
    document.querySelectorAll('#map-nodes .sel').forEach((n) => n.classList.remove('sel'));
    const n = sel && $(sel);
    if (n) n.classList.add('sel');
  }
  function select(q, animate) {
    mark_sel(`#map-nodes .qn[data-id="${q.id}"]`);
    centerAt(spot(q), animate);
    if (animate) walkTo(q);
    panel(q);
  }
  function selectPlace(p, animate) {
    mark_sel(`#map-nodes .qn[data-place="${p.id}"]`);
    centerAt(spot({ at: p.at }), animate);
    if (animate) walkTo({ id: p.id, at: p.at });
    const s = save(), inside = actQuests(act).filter((q) => q.place === p.id), open = inside.filter((q) => S.isOpen(s, q));
    const pn = $('#map-panel');
    pn.innerHTML = `<button class="mp-close" title="Close">✕</button><div class="mp-tag" style="--c:${MB.ACTS[act].color}">Location</div><h2>${p.icon || ''} ${p.title}</h2>
      <div class="mp-art place" style="background-image:url('${MB.asset(p.map)}')"></div><p class="mp-text">${p.text || ''}</p>
      <div class="mp-list">${inside.map((q) => `<span class="${S.isDone(s, q) ? 'done' : S.isOpen(s, q) ? 'open' : ''}">${S.isDone(s, q) ? '✔' : S.isOpen(s, q) ? (q.main ? '▶' : '!') : '🔒'} ${S.isOpen(s, q) ? q.title : '???'}</span>`).join('')}</div>
      <div class="mp-btns"></div>`;
    const b = el('button', 'btn primary', open.length ? '🚪 Enter' : '🔒 Nothing open yet');
    b.disabled = !open.length;
    b.onclick = () => { click(); enter(p.id); };
    pn.querySelector('.mp-btns').appendChild(b);
    pn.querySelector('.mp-close').onclick = () => { click(); pn.classList.add('closed'); };
    showPanel();
  }
  function showPanel() {
    const pn = $('#map-panel');
    pn.classList.remove('closed');
    gsap.fromTo(pn, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function panel(q) {
    const s = save(), p = $('#map-panel'), st = stageOf(q), open = S.isOpen(s, q), done = S.isDone(s, q);
    const main = mainOf(q.act), arc = q.arc && q.main && S.arcsOf(q.act).find((x) => x.name === q.arc);
    const tag = q.side ? 'Side quest' : arc ? `Storyline · ${arc.name} · ${arc.quests.indexOf(q) + 1}/${arc.quests.length}` : `${q.foe ? 'Main story' : 'Story'} · ${main.indexOf(q) + 1}/${main.length}`;
    const boss = bossOf(q), ch = q.foe && MB.charById(q.foe);
    let art;
    if (!open) art = '<div class="mp-art lock">?</div>';
    else if (q.foe) art = `<div class="mp-art"><img src="${MB.spriteUrl(q.foe, done ? 'win' : 'taunt')}"></div>`;
    else {
      // a scene: the first few characters who speak in it
      const who = [...new Set(q.scene.lines.map(S.lineOf).filter((l) => l.who && l.who !== '*' && l.who !== 'you' && MB.charById(l.who)).map((l) => l.who))].slice(0, 3);
      art = `<div class="mp-art trio">${who.map((id) => `<img src="${MB.spriteUrl(id, 'idle')}">`).join('')}</div>`;
    }
    // what it's waiting for: every need, ticked off
    const needs = q.needs.map(S.byId).filter((n) => n && n.act === q.act);
    let body = `<div class="mp-tag" style="--c:${MB.ACTS[q.act].color}">${tag}${boss ? ' · 👑 Boss' : ''}</div><h2>${open ? q.title : '???'}</h2>`;
    if (!open) {
      body += art + `<div class="mp-list">${needs.map((n) => `<span class="${S.isDone(s, n) ? 'done' : ''}">${S.isDone(s, n) ? '✔' : '✖'} ${S.isOpen(s, n) || S.isDone(s, n) ? n.title : '???'}${n.arc && n.arc !== q.arc ? ` <small>(${n.arc})</small>` : ''}</span>`).join('')}</div>`;
    } else {
      body += art;
      if (ch) body += `<div class="mp-who"><b>${ch.name}</b> · ${MB.Missions.novelName(ch.novel)}<br><small>📍 ${st.bg.trim()}</small></div>`;
      body += `<p class="mp-text">${q.text}</p>`;
      if (boss) body += `<div class="mp-boss" style="--c:${boss.color}">${boss.emoji} <b>${boss.name}:</b> ${boss.text}${boss.rage ? `<br>💢 <b>${boss.rage.name}:</b> ${boss.rage.text}` : ''}</div>`;
      if (st) {
        const have = s.stars[q.stage] | 0;
        body += `<div class="mp-stars">${MB.Stars.starsOf(q.stage).map((x, k) => `<span class="${have & (1 << k) ? 'on' : ''}">${have & (1 << k) ? '★' : '☆'} ${x.text}</span>`).join('')}</div>`;
        if (!done) body += `<div class="mp-reward">First win: <b>${ch.name}</b>'s card and leader · ${boss ? '<b style="color:#b35cff">Epic Pack</b>' : '<b style="color:#4aa3ff">Rare Pack</b>'}</div>`;
      } else if (!done && q === S.lastOf(q.act)) body += '<div class="mp-reward">🏁 Act complete: <b style="color:#b35cff">Epic Pack</b></div>';
    }
    p.innerHTML = `<button class="mp-close" title="Close">✕</button>${body}<div class="mp-btns"></div>`;
    const btns = p.querySelector('.mp-btns');
    if (open) {
      const go = el('button', 'btn primary', q.foe ? (done ? '⚔ Rematch' : '⚔ Battle!') : done ? '🎬 Watch again' : '🎬 Play');
      go.onclick = () => { click(); play(q); };
      btns.appendChild(go);
      if (q.foe && done && (q.before || q.after)) {
        const re = el('button', 'btn', '🎬 Scenes');
        re.onclick = () => { click(); replay(q); };
        btns.appendChild(re);
      }
    }
    p.querySelector('.mp-close').onclick = () => { click(); p.classList.add('closed'); };
    showPanel();
  }

  // ---------------------------------------------------------------- playing a quest
  const titleOf = (q) => ({ title: q.title, arc: q.arc || (q.side ? 'Side quest' : `Act ${q.act + 1} · ${MB.ACTS[q.act].title}`), color: MB.ACTS[q.act].color });
  function play(q) {
    const s = save();
    if (!S.isOpen(s, q)) return;
    if (!q.foe) {
      scene(S.sceneOf(q, 'scene'), () => finish(q, S.complete(s, q.id)), titleOf(q));
      return;
    }
    const first = !S.isDone(s, q);
    U().leaderSelect((lid) => {
      const fight = () => U().storyIntro(q.stage, lid);
      if (first && q.before) scene(S.sceneOf(q, 'before'), fight, titleOf(q));
      else fight();
    }, q.foe, () => open({ focus: q.id }));
  }
  function replay(q) {
    const parts = ['before', 'after'].map((k) => S.sceneOf(q, k)).filter(Boolean);
    const run = (i) => (i < parts.length ? scene(parts[i], () => run(i + 1), i ? null : titleOf(q)) : open({ focus: q.id }));
    run(0);
  }
  function secret(x) {
    const s = save(), found = s.secrets.includes(x.id);
    scene(S.secretScene(x), () => {
      const glitter = S.findSecret(s, x.id);
      U().persist();
      open({ act: x.act, place: null });
      if (glitter) toast(`✦ Secret found: <b>${x.title}</b> <span class="glit">+${glitter} ✨</span>`);
    }, { title: x.title, arc: found ? 'Secret' : 'Secret found!', color: '#ffd84a', short: true });
  }
  function toast(html) {
    const t = el('div', 'map-toast', html);
    $('#screen-story').appendChild(t);
    MB.audio.sfx('ding');
    gsap.timeline({ onComplete: () => t.remove() }).fromTo(t, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' }).to(t, { opacity: 0, duration: 0.5, delay: 2.6 });
  }
  // a quest just finished (res from MB.Story.complete): save, then back to the map, walking on to what opened
  function finish(q, res) {
    U().persist();
    if (!res.first) { open({ focus: q.id }); return; }
    const nxt = S.next(save()), newAct = nxt && nxt.act !== q.act;
    // walk on to the next quest of this act when it's in the same view; otherwise just look at it
    const sameView = nxt && !newAct && (nxt.place || null) === (q.place || null);
    if (newAct) open({ act: nxt.act, focus: nxt.id, opened: res.opened, walked: { act: -1 } });
    else open({ focus: sameView ? nxt.id : q.id, place: q.place || null, opened: res.opened, walked: sameView ? { act: q.act, from: q.id, to: nxt.id } : null });
    if (nxt && !newAct && !sameView && res.opened.length) toast(`New: <b>${S.byId(res.opened[0]).title}</b>${res.opened.length > 1 ? ` and ${res.opened.length - 1} more` : ''}`);
    const then = () => { if (newAct) flyover(nxt.act); };
    if (res.act != null) actDone(res.act, then);
    else then();
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

  // ---------------------------------------------------------------- act cards and fly-overs
  function actCard(a) {
    const A = MB.ACTS[a], c = el('div', 'act-card', `<small>Act ${a + 1}</small><b>${A.title}</b>`);
    c.style.setProperty('--c', A.color);
    $('#screen-story').appendChild(c);
    gsap.timeline({ onComplete: () => c.remove() })
      .fromTo(c, { opacity: 0, scale: 1.3, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out' })
      .to(c, { opacity: 0, y: -30, duration: 0.6, delay: 1.4 });
    MB.audio.sfx('riser');
  }
  // the first time an act opens: the camera sweeps over its map under the act's title and intro, then settles
  function flyover(a) {
    const s = save(), A = MB.ACTS[a];
    if (!s.actIntros.includes(a)) { s.actIntros.push(a); U().persist(); }
    if (act !== a || place) { act = a; place = null; render(S.next(s) && S.next(s).act === a ? S.next(s) : null); }
    const end = { ...pos }, box = el('div', 'act-fly', `<small>Act ${a + 1}</small><b>${A.title}</b><p></p><em>Click to skip</em>`);
    box.style.setProperty('--c', A.color);
    $('#screen-story').appendChild(box);
    $('#screen-story').classList.add('flying');
    $('#map-panel').classList.add('closed');
    MB.audio.sfx('riser');
    const tl = gsap.timeline({ onComplete: done });
    const P = box.querySelector('p'), o = { n: 0 };
    tl.set('#map-world', { x: 0, y: 0 })
      .to('#map-world', { x: VW - world.w, y: (VH - world.h) * 0.3, duration: 3.2, ease: 'sine.inOut' }, 0)
      .to('#map-world', { x: end.x, y: end.y, duration: 1.4, ease: 'power2.inOut' }, 3.2)
      .fromTo(box, { opacity: 0, letterSpacing: '30px' }, { opacity: 1, letterSpacing: '0px', duration: 1 }, 0.2)
      .to(o, { n: A.intro.length, duration: A.intro.length * 0.025, ease: 'none', onUpdate: () => { P.textContent = A.intro.slice(0, o.n | 0); } }, 0.8)
      .to(box, { opacity: 0, duration: 0.6 }, 4);
    const skip = () => tl.progress(1);
    box.addEventListener('pointerdown', skip);
    function done() {
      box.remove();
      $('#screen-story').classList.remove('flying');
      pos = end;
      showPanel();
    }
  }
  function actDone(a, then) {
    const A = MB.ACTS[a], last = a === MB.ACTS.length - 1;
    const box = el('div', 'act-done', `<small>Act ${a + 1} complete</small><b>${A.title}</b>`
      + `<p>🎁 <b style="color:#b35cff">Epic Pack</b> earned!${last ? '<br>You finished the story. Side quests, secrets and rematches stay open on every map.' : `<br>Next: Act ${a + 2} · ${MB.ACTS[a + 1].title}`}</p><button class="btn primary">Continue</button>`);
    box.style.setProperty('--c', A.color);
    document.getElementById('ui-root').appendChild(box);
    MB.audio.sfx('fanfare');
    gsap.fromTo(box, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' });
    box.querySelector('button').onclick = () => { click(); box.remove(); then(); };
  }

  // ---------------------------------------------------------------- scenes
  // A small film director: letterbox bars, a title card, location captions, up to three characters on stage,
  // close-ups, weather, fades, camera moves, choices, auto-play and a backlog. Directions are listed in js/story.js.
  const SLOTS = ['left', 'center', 'right'];
  let director = null;
  function scene(sc, done, title) {
    if (director) director.stop();
    const s = save(), box = $('#screen-scene');
    U().hideBattle();
    U().show('screen-scene');
    const bg = () => U().setBg(MB.asset(U().bgByName(sc.bg).src));
    let bgEl = bg();
    kenBurns(bgEl);
    if (sc.music) MB.audio.music(sc.music);
    const lines = sc.lines.map(S.lineOf), log = [];
    const slots = { left: null, right: null, center: null }, spoke = { left: 0, right: 0, center: 0 };
    const img = { left: $('#sc-left'), right: $('#sc-right'), center: $('#sc-center') };
    Object.values(img).forEach((i) => { gsap.killTweensOf(i); gsap.set(i, { clearProps: 'all' }); i.className = i.className.replace(/ (dim|gone)/g, '') + ' gone'; i.removeAttribute('src'); });
    ['#sc-close', '#sc-choices', '#sc-log', '#sc-caption'].forEach((q) => $(q).classList.add('hidden'));
    $('#sc-text').textContent = '';
    $('#sc-name').classList.add('hidden');
    gsap.set('#sc-stage', { opacity: 1 });
    weather('none');
    FX.reset();
    gsap.set('#sc-fade', { opacity: 0 });
    let i = 0, tick = 0, busy = false, over = false, typing = null, auto = false, autoTimer = null;

    // letterbox in, and the quest's title card
    gsap.fromTo('#sc-bars i', { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power3.out' });
    async function opening() {
      if (!title) return;
      busy = true;
      const c = $('#sc-title');
      c.innerHTML = `<small>${title.arc}</small><b>${title.title}</b>`;
      c.style.setProperty('--c', title.color);
      c.classList.remove('hidden');
      MB.audio.sfx('swish');
      await gsap.timeline().fromTo(c, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' })
        .fromTo(c.querySelector('b'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power2.out' }, 0.2)
        .to(c, { opacity: 0, x: 40, duration: 0.5, delay: title.short ? 0.6 : 1.2 });
      c.classList.add('hidden');
      busy = false;
    }

    const sideOf = (who) => SLOTS.find((k) => slots[k] === who) || null;
    function leave(side) {
      slots[side] = null;
      gsap.to(img[side], { opacity: 0, x: side === 'left' ? -120 : side === 'right' ? 120 : 0, duration: 0.35, onComplete: () => { if (!slots[side]) img[side].classList.add('gone'); } });
    }
    function place(who, role, at) {
      let side = sideOf(who);
      const fresh = !side;
      if (fresh) {
        const free = SLOTS.filter((k) => !slots[k]);
        // Hayley, your companion, likes the left; others take a free side, else whoever spoke least recently
        side = at || (who === 'hayley-kate' && !slots.left ? 'left' : free.includes('right') ? 'right' : free.includes('left') ? 'left' : free[0]
          || SLOTS.slice().sort((x, y) => spoke[x] - spoke[y])[0]);
        if (slots[side] && slots[side] !== who) leave(side);
        slots[side] = who;
      }
      const im = img[side];
      if (fresh) gsap.killTweensOf(im); // still leaving after someone else
      im.src = MB.bigSpriteUrl(who, role);
      im.classList.remove('gone');
      if (fresh) gsap.fromTo(im, { x: side === 'left' ? -320 : side === 'right' ? 320 : 0, y: side === 'center' ? 60 : 0, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      spoke[side] = ++tick;
      return side;
    }
    function focus(side) { SLOTS.forEach((k) => img[k].classList.toggle('dim', k !== side)); }

    function kenBurns(e) { gsap.fromTo(e, { scale: 1.02 }, { scale: 1.1, duration: 24, ease: 'none' }); }
    async function direct(d) {
      if (d.fade) {
        await gsap.to('#sc-fade', { opacity: 1, backgroundColor: d.fade === 'white' ? '#fff' : '#000', duration: 0.6 });
        if (d.bg) { sc = { ...sc, bg: d.bg }; bgEl = bg(); kenBurns(bgEl); SLOTS.forEach((k) => { if (slots[k]) { slots[k] = null; img[k].classList.add('gone'); } }); }
        if (d.weather) weather(d.weather);
        if (d.light) FX.light(d.light, 0.01);
        await wait(250);
        await gsap.to('#sc-fade', { opacity: 0, duration: 0.7 });
      } else if (d.bg) {
        // a new place: whoever was on stage stays behind, and an open rift closes
        sc = { ...sc, bg: d.bg };
        bgEl = bg();
        kenBurns(bgEl);
        SLOTS.forEach((k) => { if (slots[k]) leave(k); });
      }
      if (d.bg || d.fx === 'flash') FX.riftClose();
      if (d.music) MB.audio.music(d.music === 'none' ? null : d.music);
      if (d.sfx) MB.audio.sfx(d.sfx);
      if (d.weather && !d.fade) weather(d.weather);
      if (d.light && !d.fade) FX.light(d.light);
      if (d.hide && sideOf(d.hide)) leave(sideOf(d.hide));
      if (d.enter && MB.charById(d.enter)) { place(d.enter, S.MOODS[d.mood] || 'idle', d.at); focus(sideOf(d.enter)); await wait(250); }
      if (d.where) caption(d.where, d.when);
      if (d.cam === 'push') { gsap.fromTo(bgEl, { scale: 1.02 }, { scale: 1.22, duration: 0.9, ease: 'power3.out' }); gsap.fromTo('#sc-sky', { scale: 1 }, { scale: 1.15, duration: 0.9, ease: 'power3.out' }); }
      if (d.cam === 'pull') { gsap.fromTo(bgEl, { scale: 1.25 }, { scale: 1.02, duration: 1.4, ease: 'power2.out' }); gsap.fromTo('#sc-sky', { scale: 1.18 }, { scale: 1, duration: 1.4, ease: 'power2.out' }); }
      if (d.cam === 'pan') gsap.fromTo(bgEl, { x: -60 }, { x: 60, duration: 6, ease: 'sine.inOut' });
      if (d.fx === 'flash') { FX.flash(); FX.shake(10); }
      if (d.fx === 'rift') FX.riftOpen({ at: d.sky, size: d.sky && d.sky[2], tilt: d.sky && d.sky[3] });
      if (d.fx === 'shake') FX.shake(16);
      if (d.fx === 'flicker') FX.flicker();
      if (d.fx === 'rift') await wait(1100); // the tear opens before anyone reacts
      else if (d.fx) await wait(300);
      if (d.choose) await choose(d.choose);
    }
    const shake = (n) => FX.shake(n);
    function caption(where, when) {
      const c = $('#sc-caption');
      c.innerHTML = `<b></b><small>${when || ''}</small>`;
      c.classList.remove('hidden');
      const o = { n: 0 }, B = c.querySelector('b');
      gsap.killTweensOf(c);
      gsap.timeline().fromTo(c, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4 })
        .to(o, { n: where.length, duration: where.length * 0.04, ease: 'none', onUpdate: () => { B.textContent = where.slice(0, o.n | 0); } })
        .to(c, { opacity: 0, duration: 0.8, delay: 2.6, onComplete: () => c.classList.add('hidden') });
    }
    function choose(options) {
      return new Promise((res) => {
        const c = $('#sc-choices');
        c.innerHTML = '';
        c.classList.remove('hidden');
        options.forEach(([label, branch], k) => {
          const b = el('button', 'sc-choice', label);
          b.onclick = (e) => {
            e.stopPropagation();
            click();
            c.classList.add('hidden');
            // what you said, then how they answer, then the scene goes on
            lines.splice(i, 0, { who: 'you', role: 'idle', text: label.replace(/^"|"$/g, '') }, ...branch.map(S.lineOf));
            res();
          };
          c.appendChild(b);
          gsap.fromTo(b, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3, delay: k * 0.08 });
        });
      });
    }
    // the text types out with little pauses on punctuation, like someone talking
    function type(text) {
      return new Promise((res) => {
        const t = $('#sc-text');
        let k = 0, timer = null;
        const finish = () => { clearTimeout(timer); t.textContent = text; typing = null; res(); };
        typing = { finish };
        (function tick() {
          k++;
          t.textContent = text.slice(0, k);
          if (k >= text.length) { finish(); return; }
          const ch = text[k - 1];
          timer = setTimeout(tick, /[.!?]/.test(ch) && text[k] === ' ' ? 220 : ch === ',' ? 90 : 18);
        })();
      });
    }
    async function say(l) {
      const narr = l.who === '*', you = l.who === 'you', char = !narr && !you && MB.charById(l.who);
      let side = null;
      if (char) { side = place(l.who, l.role); focus(side); } else SLOTS.forEach((k) => img[k].classList.add('dim'));
      if (side && !l.close) gsap.fromTo(img[side], { y: 0 }, { y: -12, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out' });
      const cl = $('#sc-close');
      if (l.close && char) {
        cl.querySelector('img').src = MB.bigSpriteUrl(l.who, l.role);
        cl.style.setProperty('--c', MB.ACTS[act].color);
        cl.classList.remove('hidden');
        MB.audio.sfx('swish');
        gsap.fromTo(cl.querySelector('img'), { x: 200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
        gsap.fromTo(cl, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      } else cl.classList.add('hidden');
      gsap.to('#sc-stage', { opacity: l.close && char ? 0.2 : 1, duration: 0.25 });
      if (l.shake) shake(18);
      $('#sc-name').textContent = narr ? '' : nameOf(l.who);
      $('#sc-name').classList.toggle('hidden', narr);
      box.querySelector('.sc-box').classList.toggle('narr', narr);
      box.querySelector('.sc-box').classList.toggle('you', you);
      $('#sc-more').classList.add('hidden');
      const text = l.text.replace(/\{name\}/g, s.name);
      log.push([narr ? '' : nameOf(l.who), text]);
      await type(text);
      $('#sc-more').classList.remove('hidden');
      if (auto) autoTimer = setTimeout(step, 1100 + text.length * 22);
    }
    async function step() {
      clearTimeout(autoTimer);
      if (over || busy) return;
      if (typing) { typing.finish(); return; }
      busy = true;
      while (i < lines.length && !lines[i].text) await direct(lines[i++]);
      busy = false;
      if (over) return;
      if (i >= lines.length) { end(); return; }
      say(lines[i++]);
    }
    function weather(kind) {
      const w = $('#sc-weather');
      w.querySelectorAll('i').forEach((p) => gsap.killTweensOf(p));
      w.innerHTML = '';
      if (!kind || kind === 'none') return;
      const n = { petals: 26, snow: 40, rain: 70, embers: 30, sparkles: 26, stars: 50 }[kind] || 0;
      for (let k = 0; k < n; k++) {
        const p = el('i', kind);
        w.appendChild(p);
        const x = Math.random() * VW, d = 4 + Math.random() * 6;
        if (kind === 'stars' || kind === 'sparkles') {
          gsap.set(p, { x, y: Math.random() * (kind === 'stars' ? 500 : VH), scale: 0.4 + Math.random() });
          gsap.to(p, { opacity: 0.1, duration: 0.6 + Math.random() * 1.6, yoyo: true, repeat: -1, delay: Math.random() * 2 });
        } else if (kind === 'embers') {
          gsap.fromTo(p, { x, y: VH + 20 }, { x: x + (Math.random() - 0.5) * 200, y: -40, duration: d, repeat: -1, delay: -Math.random() * d, ease: 'none' });
        } else {
          const fall = kind === 'rain' ? 0.7 + Math.random() * 0.4 : d;
          gsap.fromTo(p, { x, y: -40, rotation: Math.random() * 360 }, { x: x + (kind === 'rain' ? -80 : (Math.random() - 0.3) * 300), y: VH + 40, rotation: '+=' + (kind === 'petals' ? 540 : 0), duration: fall, repeat: -1, delay: -Math.random() * fall, ease: 'none' });
        }
      }
    }
    function end() {
      if (over) return;
      over = true;
      clearTimeout(autoTimer);
      if (typing) typing.finish();
      director = null;
      document.removeEventListener('keydown', keys);
      weather('none');
      gsap.to('#sc-bars i', { scaleY: 0, duration: 0.4 });
      FX.reset();
      $('#sc-close').classList.add('hidden');
      done();
    }
    function showLog() {
      const L = $('#sc-log');
      L.innerHTML = `<h3>Backlog</h3>${log.map(([n, t]) => `<p>${n ? `<b>${n}</b>` : ''}${t}</p>`).join('')}<button class="btn small">Close</button>`;
      L.classList.remove('hidden');
      L.scrollTop = L.scrollHeight;
      L.querySelector('button').onclick = (e) => { e.stopPropagation(); click(); L.classList.add('hidden'); };
    }
    box.onclick = (e) => {
      if (e.target.closest('#sc-ui, #sc-log, #sc-choices')) return;
      if (!$('#sc-choices').classList.contains('hidden')) return;
      step();
    };
    $('#sc-skip').onclick = () => { click(); end(); };
    $('#sc-auto').onclick = () => { click(); auto = !auto; $('#sc-auto').classList.toggle('on', auto); if (auto && !typing && !busy) step(); };
    $('#sc-auto').classList.toggle('on', auto);
    $('#sc-logbtn').onclick = () => { click(); showLog(); };
    const keys = (e) => {
      if (!box.classList.contains('active') || !$('#sc-log').classList.contains('hidden')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if ($('#sc-choices').classList.contains('hidden')) step(); } else if (e.key === 'Escape') end();
    };
    document.addEventListener('keydown', keys);
    director = { stop: end };
    opening().then(step);
  }

  function bind() {
    bindPan();
    $('#map-leave').onclick = () => { click(); leave(); };
    $('#map-next').onclick = () => {
      click();
      const s = save(), nxt = S.next(s);
      if (!nxt) return;
      if (nxt.act !== act || (nxt.place || null) !== place) {
        const toAct = nxt.act !== act;
        act = nxt.act;
        place = nxt.place || null;
        render(nxt);
        if (toAct) { if (!s.actIntros.includes(act)) flyover(act); else actCard(act); } else if (place) placeCard(S.place(place));
      } else select(nxt, true);
    };
  }

  MB.StoryMap = { open, bind, won, next, hasAfter, scene };
})();
