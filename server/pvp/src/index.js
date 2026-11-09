// Miku Battle PvP relay (pvp.miku-battle.org). The game's js/net.js opens one WebSocket per channel:
//   wss://pvp.miku-battle.org/ch/<name>?id=<player id>
// Every channel ('lobby', 'room-…', 'friend-ABCD') is one Durable Object, so everyone in it meets on the same
// instance. The relay knows nothing about the game: it forwards messages and keeps the list of who is here.
//
// Client → server (JSON):  { t: 'm', e, d }       a message for everyone else in the channel
//                          { t: 'track', meta }   this player's presence data (shown to everyone in members)
//                          'ping'                 keep-alive, answered 'pong' without waking the object
// Server → client (JSON):  { t: 'm', e, d }       someone else's message
//                          { t: 'p', members }    who is here now: [{ id, ...meta }], self included
//
// Sockets use the hibernation API: an idle channel costs nothing, and its sockets stay open.
import { DurableObject } from 'cloudflare:workers';

const NAME = /^[a-z0-9-]{1,40}$/i;
const ID = /^[a-z0-9]{4,32}$/i;
const MAX_MSG = 16 * 1024;           // a move or hello is far smaller; a deck hello is ~1 KB
const MAX_META = 1024;
const ROOM_CAP = 6;                  // two players, plus room for a reconnect overlapping the old socket
const LOBBY_CAP = 2000;
const RATE = 40;                     // messages per socket per RATE_WINDOW
const RATE_WINDOW = 5000;
const STALE = 75 * 1000;             // no ping for this long: the socket is dead (a phone that went to sleep)
const SWEEP = 30 * 1000;

const ORIGINS = [
  /^https:\/\/(www\.)?miku-battle\.org$/,
  /^https:\/\/[a-z0-9-]+\.github\.io$/i,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const originOk = (o) => !o || ORIGINS.some((re) => re.test(o)); // no Origin: not a browser (tests, tools)

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') return new Response('miku-battle pvp ok\n');
    const m = url.pathname.match(/^\/ch\/([^/]+)$/);
    if (!m || !NAME.test(m[1])) return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (!originOk(req.headers.get('Origin'))) return new Response('origin not allowed', { status: 403 });
    if (!ID.test(url.searchParams.get('id') || '')) return new Response('bad id', { status: 400 });
    const name = m[1].toLowerCase();
    return env.CHANNEL.get(env.CHANNEL.idFromName(name)).fetch(req);
  },
};

export class Channel extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const name = url.pathname.slice(4).toLowerCase();
    const cap = name === 'lobby' ? LOBBY_CAP : ROOM_CAP;

    // the same player again (a reconnect): the old socket goes
    for (const ws of this.ctx.getWebSockets(id)) try { ws.close(4000, 'replaced'); } catch (e) {}
    if (this.live().length >= cap) return new Response('channel full', { status: 429 });

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, meta: null, at: Date.now(), n: 0, win: Date.now() });
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP);
    this.presence(); // the newcomer learns who's here (they track() right after)
    return new Response(null, { status: 101, webSocket: client });
  }

  // open sockets, minus one that is closing right now
  live(except) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN);
  }

  presence(except) {
    const socks = this.live(except);
    const members = [];
    for (const ws of socks) {
      const a = ws.deserializeAttachment();
      if (a && a.meta) members.push({ ...a.meta, id: a.id });
    }
    const out = JSON.stringify({ t: 'p', members });
    for (const ws of socks) try { ws.send(out); } catch (e) {}
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return ws.close(1009, 'too big');
    const a = ws.deserializeAttachment();
    const now = Date.now();
    if (now - a.win > RATE_WINDOW) { a.win = now; a.n = 0; }
    if (++a.n > RATE) { ws.serializeAttachment(a); return; } // over the limit: dropped (lockstep asks again)
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'track') {
      const meta = msg.meta && typeof msg.meta === 'object' && !Array.isArray(msg.meta) ? msg.meta : null;
      if (meta && JSON.stringify(meta).length > MAX_META) return;
      a.meta = meta;
      ws.serializeAttachment(a);
      return this.presence();
    }
    ws.serializeAttachment(a);
    if (msg.t === 'm' && typeof msg.e === 'string' && msg.e.length <= 32) {
      const out = JSON.stringify({ t: 'm', e: msg.e, d: msg.d });
      for (const other of this.live()) if (other !== ws) try { other.send(out); } catch (e) {}
    }
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (e) {}
    this.presence(ws);
  }

  async webSocketError(ws) {
    this.presence(ws);
  }

  // dead sockets (no ping for STALE) are closed, so the other player sees them leave
  async alarm() {
    const now = Date.now();
    let gone = false;
    for (const ws of this.ctx.getWebSockets()) {
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      const a = ws.deserializeAttachment() || { at: 0 };
      const last = Math.max(pinged ? pinged.getTime() : 0, a.at);
      if (now - last > STALE) { try { ws.close(4001, 'stale'); } catch (e) {} gone = true; }
    }
    if (gone) this.presence();
    if (this.live().length) await this.ctx.storage.setAlarm(now + SWEEP);
  }
}
