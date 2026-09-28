// PvP over the internet (Arena → Casual PvP). Lockstep: both players run the same battle (engine.js) from one seed,
// the second player's with the sides flipped so each sees themself at the bottom, and send each other only their
// moves. Each end of turn carries a digest of the state, so a desync is caught instead of the games drifting apart.
// Messages go through Supabase Realtime (MB.SUPABASE_KEY in config.js), or between the tabs of one browser
// (BroadcastChannel) when there is no key or the page has ?pvp=local, for trying it out alone.
// A match: quick match (players in a lobby are paired by the time they joined) or a friend room (a 4-letter code);
// then both say hello (name, leader, deck, levels), the host sends the seed, and the battle starts (MB.UI.startPvp).
window.MB = window.MB || {};
(function () {
  const PROTOCOL = 1;
  const me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); // this tab
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const local = () => !MB.SUPABASE_KEY || /[?&]pvp=local\b/.test(location.search);

  // both players need the same cards and rules (the same version of the game, and NSFW mode the same)
  let buildHash = null;
  function build() {
    if (buildHash) return buildHash;
    const text = JSON.stringify([PROTOCOL, MB.RULES, MB.LEVELS, MB.CARDS, MB.POWERS, MB.BONDS, MB.COMBOS]);
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (buildHash = (h >>> 0).toString(36));
  }

  // ---------------------------------------------------------------- channels
  // { ready, send(event, data), on(event, fn), track(meta), members() -> [{ id, ...meta }], onSync(fn), close() }
  let client = null;
  async function supabase() {
    if (!window.supabase) await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'lib/supabase.min.js'; s.onload = res; s.onerror = () => rej(new Error('offline'));
      document.head.appendChild(s);
    });
    return client || (client = window.supabase.createClient(MB.SUPABASE_URL, MB.SUPABASE_KEY, { auth: { persistSession: false } }));
  }

  async function supaChannel(name) {
    const sb = await supabase(), handlers = {};
    let onSync = null, meta = null;
    const ch = sb.channel('mb-' + name, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { const f = handlers[payload.e]; if (f) f(payload.d); });
    ch.on('presence', { event: 'sync' }, () => onSync && onSync());
    const ready = new Promise((res, rej) => ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { res(); if (meta) ch.track(meta); } // (again after a reconnect)
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rej(new Error(status));
    }));
    await ready;
    return {
      send: (e, d) => ch.send({ type: 'broadcast', event: 'm', payload: { e, d } }),
      on: (e, fn) => { handlers[e] = fn; },
      track: (m) => { meta = m; return ch.track(m); },
      members: () => Object.entries(ch.presenceState()).map(([id, metas]) => ({ ...metas[0], id })),
      onSync: (fn) => { onSync = fn; },
      close: () => sb.removeChannel(ch),
    };
  }

  // the same between the tabs of one browser; presence is a heartbeat every 1.5 s
  async function localChannel(name) {
    const bc = new BroadcastChannel('mb-' + name), handlers = {}, seen = new Map();
    let onSync = null, meta = null;
    const post = (x) => bc.postMessage({ from: me, ...x });
    bc.onmessage = ({ data }) => {
      if (data.p) {
        const fresh = !seen.has(data.from);
        seen.set(data.from, { at: Date.now(), meta: data.p });
        if (fresh) { if (meta) post({ p: meta }); if (onSync) onSync(); }
      } else if (data.left) { seen.delete(data.from); if (onSync) onSync(); }
      else { const f = handlers[data.e]; if (f) f(data.d); }
    };
    const timer = setInterval(() => {
      if (meta) post({ p: meta });
      let gone = false;
      for (const [id, v] of seen) if (Date.now() - v.at > 5000) { seen.delete(id); gone = true; }
      if (gone && onSync) onSync();
    }, 1500);
    return {
      send: (e, d) => post({ e, d }),
      on: (e, fn) => { handlers[e] = fn; },
      track: (m) => { meta = m; post({ p: m }); if (onSync) onSync(); },
      members: () => [...(meta ? [{ ...meta, id: me }] : []), ...[...seen].map(([id, v]) => ({ ...v.meta, id }))],
      onSync: (fn) => { onSync = fn; },
      close: () => { clearInterval(timer); post({ left: true }); bc.close(); },
    };
  }

  const open = (name) => (local() ? localChannel(name) : supaChannel(name));

  // ---------------------------------------------------------------- the match
  // s: the match in progress (null when idle). status(text, state) tells the Arena screen what's going on.
  let s = null;
  const say = (text, state) => { if (s && s.status) s.status(text, state); };

  // a hello from the other player, checked before anything of it is used
  function checkHello(d) {
    if (!d || d.v !== PROTOCOL || typeof d.id !== 'string') return 'The other player is on a different version of the game.';
    if (d.build !== build()) return 'The other player has a different version of the game (or NSFW mode set differently). Both refresh the page and try again.';
    const deckOk = Array.isArray(d.deck) && d.deck.length === MB.RULES.deckSize && d.deck.every((id) => MB.CARDS[id] && !MB.CARDS[id].token);
    const copies = (id) => MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2;
    const fits = deckOk && d.deck.every((id) => d.deck.filter((x) => x === id).length <= copies(id));
    if (!fits || !MB.POWERS[d.leader] || !MB.CARDS[d.leader]) return 'The other player\'s deck or leader isn\'t valid here.';
    return null;
  }
  const cleanName = (n) => String(n || 'Player').replace(/[<>&"']/g, '').slice(0, 20) || 'Player';
  const cleanLevels = (lv) => Object.fromEntries(Object.entries(lv && typeof lv === 'object' ? lv : {})
    .filter(([id, n]) => MB.CARDS[id] && n > 1).map(([id, n]) => [id, Math.min(n | 0, MB.LEVELS.max)]));

  // hello: { name, avatar, leader, deck, levels } of this player. status: see say().
  function begin(hello, status) {
    leave();
    s = { hello: { ...hello, v: PROTOCOL, build: build(), id: me }, status, lobby: null, room: null, peer: null, host: false,
      seed: null, started: false, b: null, sent: [], got: 0, pending: new Map(), pumping: false, over: false, timers: [] };
    return s;
  }
  const every = (m, fn, ms) => { const t = setInterval(fn, ms); m.timers.push(t); return t; };

  // quick match: everyone in the lobby with the same build, oldest first, pairs up 1-2, 3-4...; the first of a pair
  // invites the second, who accepts, and the first confirms (so nobody ends up in two matches at once)
  async function quick(hello, status) {
    const m = begin(hello, status);
    say('Connecting…', 'search');
    try { m.lobby = await open('lobby'); } catch (e) { return fail(m, 'Couldn\'t reach the PvP server. Are you online?'); }
    if (s !== m) return m.lobby.close();
    const joined = Date.now();
    let inviting = null, inviteUntil = 0, pending = null, pendingUntil = 0;
    const L = m.lobby;
    L.on('invite', (d) => {
      if (d.to !== me || m.room || inviting || (pending && Date.now() < pendingUntil)) return;
      pending = d.from; pendingUntil = Date.now() + 4000;
      L.send('accept', { to: d.from, from: me });
    });
    // a pair that never meets in its room (a message lost on the way) goes back to searching
    const meet = (name, isHost) => {
      toRoom(m, name, isHost);
      setTimeout(() => { if (s === m && !m.peer) quick(hello, status); }, 8000);
    };
    L.on('accept', (d) => {
      if (d.to !== me || m.room || d.from !== inviting) return;
      L.send('go', { to: d.from, from: me });
      meet('room-' + me, true);
    });
    L.on('go', (d) => { if (d.to === me && d.from === pending && !m.room) meet('room-' + d.from, false); });
    const pair = () => {
      if (m.room || s !== m || (inviting && Date.now() < inviteUntil)) return;
      inviting = null;
      const list = L.members().filter((x) => x.build === build()).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
      const i = list.findIndex((x) => x.id === me);
      if (i < 0 || i % 2 || !list[i + 1]) return;
      inviting = list[i + 1].id; inviteUntil = Date.now() + 4000;
      L.send('invite', { to: inviting, from: me });
    };
    L.onSync(pair);
    every(m, pair, 2000);
    const t0 = Date.now();
    every(m, () => { if (!m.room) say(`Searching for an opponent… ${Math.floor((Date.now() - t0) / 1000)}s`, 'search'); }, 1000);
    await L.track({ build: build(), t: joined });
    say('Searching for an opponent…', 'search');
  }

  // a friend room: the one who makes it hosts, the code is the room's name
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  async function host(hello, status) {
    const m = begin(hello, status), code = Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join('');
    m.code = code;
    say(`Room code: <b class="pvp-code">${code}</b> Send it to a friend. Waiting for them to join…`, 'room');
    await toRoom(m, 'friend-' + code, true);
  }
  async function join(code, hello, status) {
    const m = begin(hello, status);
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) return fail(m, 'A room code is 4 letters.');
    say(`Joining room ${code}…`, 'room');
    await toRoom(m, 'friend-' + code, false);
    setTimeout(() => { if (s === m && !m.peer) say(`Nobody is in room ${code} yet. Check the code, or wait for your friend to open it.`, 'room'); }, 6000);
  }

  function fail(m, text) {
    if (s !== m) return;
    say(text, 'error');
    leave(true);
  }

  // both players in one channel: hellos, the seed, then the moves
  async function toRoom(m, name, isHost) {
    m.host = isHost;
    if (m.lobby) { m.lobby.close(); m.lobby = null; }
    let R;
    try { R = await open(name); } catch (e) { return fail(m, 'Couldn\'t reach the PvP server. Are you online?'); }
    if (s !== m) return R.close();
    m.room = R;
    R.on('hello', (d) => {
      if (!d || d.id === me) return;
      if (m.peer) { if (d.id === m.peer.id && m.host && m.seed != null) R.send('start', { seed: m.seed }); return; }
      const bad = checkHello(d);
      if (bad) return fail(m, bad);
      m.peer = { ...d, name: cleanName(d.name), levels: cleanLevels(d.levels) };
      R.send('hello', m.hello); // they may have said hello before we were listening
      if (m.host) { m.seed = Math.random() * 4294967296 >>> 0; R.send('start', { seed: m.seed }); go(m); }
    });
    R.on('start', (d) => { if (!m.host && m.peer && m.seed == null && d.seed >= 0) { m.seed = d.seed >>> 0; go(m); } });
    R.on('move', (d) => got(m, d));
    R.on('need', (d) => resend(m, d.n | 0));
    R.on('bye', (d) => { if (m.started && !m.over) end(m, true, d && d.why === 'forfeit' ? 'forfeit' : 'left'); else if (!m.started) fail(m, 'The other player left.'); });
    R.onSync(() => watch(m));
    R.track({ t: Date.now() });
    R.send('hello', m.hello);
    every(m, () => { if (!m.peer && R.members().some((x) => x.id !== me)) R.send('hello', m.hello); }, 2500);
  }

  function go(m) {
    if (m.started) return;
    m.started = true;
    say(`Matched with <b>${m.peer.name}</b>!`, 'matched');
    const flip = !m.host; // the host is side 0 in the canonical battle
    MB.UI.startPvp({ peer: m.peer, seed: m.seed, flip, code: m.code });
  }

  // ---------------------------------------------------------------- lockstep
  // the battle is made (ui.js): our moves go out, theirs come in and are played in order
  function attach(b) {
    const m = s;
    if (!m) return;
    m.b = b;
    b.onMove = (mv) => {
      if (mv.t === 'end') mv.h = b.digest(); // the state the turn ends in: the other side checks it matches theirs
      const n = m.sent.length;
      m.sent.push(mv);
      m.room.send('move', { n, m: mv });
    };
    clock(m);
    pump(m);
  }

  function got(m, d) {
    if (!d || !Number.isInteger(d.n) || d.n < m.got || m.pending.has(d.n) || !d.m || typeof d.m.t !== 'string') return;
    m.pending.set(d.n, d.m);
    if (d.n > m.got && !m.pending.has(m.got)) m.room.send('need', { n: m.got }); // one went missing
    pump(m);
  }
  const resend = (m, from) => m.sent.slice(from).forEach((mv, k) => m.room.send('move', { n: from + k, m: mv }));

  async function pump(m) {
    if (m.pumping || !m.b) return;
    m.pumping = true;
    const b = m.b;
    while (s === m && !m.over && !b.over && m.pending.has(m.got)) {
      while (!b.turn || b.busy) await sleep(60); // the battle is still starting, or busy animating
      const mv = m.pending.get(m.got);
      m.pending.delete(m.got);
      m.got++;
      if (mv.t === 'end' && mv.h && mv.h !== b.digest()) { end(m, null, 'desync'); break; }
      let ok = false;
      await MB.view.run(async () => { ok = await b.apply(mv); });
      if (!ok && !b.over) { end(m, null, 'desync'); break; }
    }
    m.pumping = false;
  }

  // ---------------------------------------------------------------- the turn clock and the other player's connection
  function clock(m) {
    const el = document.getElementById('pvp-timer');
    let turn = -1;
    m.clock = every(m, () => {
      const b = m.b;
      if (!b || b.over || m.over) { el.classList.add('hidden'); return; }
      if (b.turn !== turn) { turn = b.turn; m.turnAt = Date.now(); }
      const left = Math.max(0, MB.PVP.turnSecs - Math.floor((Date.now() - m.turnAt) / 1000));
      el.classList.remove('hidden');
      el.classList.toggle('mine', b.active === 0);
      el.classList.toggle('low', left <= 15);
      el.textContent = m.away ? `⚠ ${m.peer.name} disconnected · ${Math.max(0, MB.PVP.graceSecs - Math.floor((Date.now() - m.away) / 1000))}s` : `⏳ ${left}s`;
      // out of time: our turn ends by itself; theirs gets a grace period on top (they may be gone)
      if (!left && b.active === 0 && !b.busy) { MB.view.cancelAim(); MB.view.cancelDrag(); MB.view.run(() => b.endTurn()); }
      if (b.active === 1 && Date.now() - m.turnAt > (MB.PVP.turnSecs + MB.PVP.graceSecs) * 1000 && !m.pending.size && !m.pumping && !b.busy) end(m, true, 'left');
      if (m.away && Date.now() - m.away > MB.PVP.graceSecs * 1000) end(m, true, 'left');
    }, 250);
  }

  // presence: the other player dropped out (the clock waits graceSecs for them), or came back (catch up on moves)
  function watch(m) {
    if (!m.peer || !m.started || m.over) return;
    const here = m.room.members().some((x) => x.id === m.peer.id);
    if (!here && !m.away) m.away = Date.now();
    else if (here && m.away) { m.away = null; m.room.send('need', { n: m.got }); }
  }

  // ---------------------------------------------------------------- the end
  // win: true / false, or null for a match that doesn't count (desync). why: 'forfeit', 'left', 'desync' or null (played out)
  function end(m, win, why) {
    if (m.over) return;
    m.over = true;
    if (m.b) return MB.UI.pvpEnd(win, why);
    // still on the face-off: no battle to end
    say('The other player left before the battle began.', 'error');
    leave(true);
    MB.UI.pvpCancel();
  }

  function forfeit() {
    if (!s) return;
    s.over = true;
    if (s.room) s.room.send('bye', { why: 'forfeit' });
  }

  // the match is over (the result screen is up): hang up after the last messages went out
  function done() {
    const m = s;
    if (!m) return;
    m.over = true;
    setTimeout(() => { if (s === m) leave(); }, 3000);
  }

  // stop searching / leave the room (quietly: a started match still going says bye)
  function leave(keepStatus) {
    const m = s;
    if (!m) return;
    if (m.room && m.started && !m.over) m.room.send('bye', { why: 'left' });
    m.timers.forEach(clearInterval);
    if (m.lobby) m.lobby.close();
    if (m.room) { const R = m.room; setTimeout(() => R.close(), 300); }
    document.getElementById('pvp-timer').classList.add('hidden');
    s = null;
    if (!keepStatus && m.status) m.status('', 'idle');
  }

  window.addEventListener('pagehide', () => { if (s && s.room && s.started && !s.over) s.room.send('bye', { why: 'left' }); });

  MB.Net = {
    quick, host, join, attach, forfeit, done, leave, build,
    busy: () => !!s, local, peer: () => s && s.peer,
    // the Arena shows PvP once there's a server to play through (or for testing: ?pvp=local, developer mode)
    available: () => !!MB.SUPABASE_KEY || /[?&]pvp=local\b/.test(location.search) || document.body.classList.contains('dev'),
  };
})();
