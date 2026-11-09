// Relay test: node test.js [base url]  (default: a `wrangler dev` on localhost:8787)
// Checks presence, message relay (not echoed to the sender), a reconnect replacing the old socket, and the room cap.
const BASE = (process.argv[2] || 'ws://127.0.0.1:8787').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) failed++; };

function client(ch, id) {
  const ws = new WebSocket(`${BASE}/ch/${ch}?id=${id}`);
  const c = { ws, got: [], members: [], closed: null };
  ws.onmessage = ({ data }) => {
    if (data === 'pong') return c.got.push('pong');
    const x = JSON.parse(data);
    if (x.t === 'p') c.members = x.members; else c.got.push(x);
  };
  ws.onclose = (e) => { c.closed = e.code; };
  c.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.send = (x) => ws.send(typeof x === 'string' ? x : JSON.stringify(x));
  return c;
}

const room = 'test-' + Date.now().toString(36);
const a = client(room, 'aaaa1111'), b = client(room, 'bbbb2222');
await Promise.all([a.open, b.open]);
a.send({ t: 'track', meta: { t: 1 } });
b.send({ t: 'track', meta: { t: 2 } });
await sleep(300);
ok(a.members.length === 2 && b.members.length === 2, 'both see two members');
ok(a.members.some((m) => m.id === 'bbbb2222' && m.t === 2), 'members carry id and meta');

a.send({ t: 'm', e: 'hello', d: { name: 'A' } });
await sleep(200);
ok(b.got.some((x) => x.e === 'hello' && x.d.name === 'A'), 'message reaches the other player');
ok(!a.got.some((x) => x.e === 'hello'), 'message is not echoed to the sender');

a.send('ping');
await sleep(200);
ok(a.got.includes('pong'), 'ping is answered');

// the same id again: the old socket is replaced
const a2 = client(room, 'aaaa1111');
await a2.open;
a2.send({ t: 'track', meta: { t: 3 } });
await sleep(300);
ok(a.closed === 4000, 'old socket closed on reconnect');
ok(b.members.length === 2 && b.members.find((m) => m.id === 'aaaa1111').t === 3, 'presence shows the reconnected player once');

b.ws.close();
await sleep(300);
ok(a2.members.length === 1, 'a leaver drops out of presence');

// the room cap (6)
const extra = [];
for (let i = 0; i < 6; i++) extra.push(client(room, 'cccc000' + i));
const opened = await Promise.all(extra.map((c) => c.open.then(() => true, () => false)));
ok(opened.filter(Boolean).length === 5, 'room holds at most 6 sockets');

for (const c of [a2, ...extra]) try { c.ws.close(); } catch (e) {}
await sleep(100);
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
