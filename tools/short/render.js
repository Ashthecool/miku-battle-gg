// Renders a "<novel> is in Miku Battle!" vertical short (1080x1920, 30 fps) from configs/<id>.json.
//   node tools/short/render.js <id> peek 1.2 4.5 22   stills to output/short/<id>/peek/ (look before rendering)
//   node tools/short/render.js <id> clip 0 6          a silent clip to output/short/<id>/clip.mp4
//   node tools/short/render.js <id> all               the finished short: output/miku-battle-<id>-short.mp4
// short.html draws every frame from the time alone; this script serves it, grabs the frames over the Chrome DevTools
// protocol, pipes them to ffmpeg and mixes the novel's own song with the sound effects the page asks for.
// Needs Chrome and ffmpeg on the machine, nothing from npm.
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execFileSync } = require('child_process');
const HERE = __dirname, REPO = path.join(HERE, '..', '..'), GAME = path.join(REPO, 'game');
const PORT = 8795, DBG = 9337, FPS = 30;
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const [, , id, mode = 'all', ...args] = process.argv;
if (!id || !fs.existsSync(path.join(HERE, 'configs', id + '.json'))) { console.error('usage: node tools/short/render.js <id> [peek t...|clip from to|all]   ids: ' + fs.readdirSync(path.join(HERE, 'configs')).map((f) => f.replace('.json', '')).join(', ')); process.exit(1); }
const OUT = path.join(REPO, 'output', 'short', id), CACHE = path.join(REPO, 'output', 'short', 'cache');
for (const d of [OUT, CACHE, path.join(OUT, 'peek')]) fs.mkdirSync(d, { recursive: true });

// ---- config: the novel's json, plus the song (downloaded once) and its tempo (measured once, then cached in the file)
const cfgPath = path.join(HERE, 'configs', id + '.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const manifest = require(path.join(GAME, 'assets/manifest.json'));
const song = manifest.music.find((m) => m.id === cfg.music.id);
if (!song) { console.error('no song ' + cfg.music.id + ' in the manifest'); process.exit(1); }
const songFile = path.join(CACHE, cfg.music.id + path.extname(new URL(song.url).pathname));
(async () => {
  if (!fs.existsSync(songFile)) { console.log('downloading', song.name); fs.writeFileSync(songFile, Buffer.from(await (await fetch(song.url)).arrayBuffer())); }
  if (!cfg.music.bpm) { Object.assign(cfg.music, JSON.parse(execFileSync('node', [path.join(HERE, 'bpm.js'), songFile, '60']).toString())); fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n'); console.log('tempo', cfg.music); }

  // ---- gameplay clips: capture.js's logs say which frames hold each cast member's attack (go = the wind-up ends, i = the hit)
const samples = {}; for (const m of fs.readFileSync(path.join(GAME, 'js/audio.js'), 'utf8').matchAll(/(\w+): \{ file: '([^']+)', vol: ([\d.]+)/g)) samples[m[1]] = { file: m[2], vol: +m[3] };
cfg.samples = samples; cfg.clips = {};
const battleDir = path.join(OUT, 'battle');
if (fs.existsSync(battleDir)) for (const g of fs.readdirSync(battleDir).filter((f) => /^g\d+$/.test(f))) {
  const D = JSON.parse(fs.readFileSync(path.join(battleDir, g, 'log.json'), 'utf8')), nearest = (t) => D.frames.reduce((b, v, i) => (Math.abs(v - t) < Math.abs(D.frames[b] - t) ? i : b), 0) + 1;
  D.log.filter((e) => e.k === 'attack' && e.side === 0).forEach((a) => {
    if (cfg.clips[a.id]) return; const after = (k) => D.log.find((e) => e.k === k && e.id === a.id && e.t >= a.t), go = after('go'), im = after('impact'), end = after('end');
    if (!go || !im || !end) return;
    cfg.clips[a.id] = { g, n: D.frames.length, go: nearest(go.t), i: nearest(im.t), e: nearest(end.t), sfx: D.log.filter((e) => e.k === 'sfx' && e.t >= a.t && e.t <= end.t).map((e) => ({ f: nearest(e.t), name: e.name })) };
  });
}
const T = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const server = http.createServer((q, s) => {
    const p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/cfg.json') { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify(cfg)); }
    const f = p === '/' ? path.join(HERE, 'short.html') : p.startsWith('/battle/') ? path.join(OUT, p) : p.startsWith('/game/') ? path.join(GAME, p.slice(6)) : path.join(HERE, p);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  });
  await new Promise((r) => server.listen(PORT, r));
  const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${path.join(CACHE, 'chrome-profile')}`, '--window-size=1080,1920', '--hide-scrollbars', '--force-device-scale-factor=1', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
  let tgt; for (let i = 0; i < 60 && !tgt; i++) { try { const j = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); tgt = j.find((x) => x.type === 'page'); } catch {} if (!tgt) await new Promise((r) => setTimeout(r, 300)); }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let n = 0; const wait = new Map();
  ws.onmessage = (m) => { const o = JSON.parse(m.data); if (o.id && wait.has(o.id)) { wait.get(o.id)(o); wait.delete(o.id); } else if (o.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(o.params.exceptionDetails).slice(0, 600)); else if (o.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(o.params.type)) console.log(o.params.type.toUpperCase(), o.params.args.map((a) => a.value || a.description).join(' ')); };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800)); return r.result.result.value; };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  for (let i = 0; i < 300; i++) { if (await ev('window.ready || window.fatal || false').catch(() => false)) break; await new Promise((r) => setTimeout(r, 200)); }
  if (await ev('window.fatal || ""')) { console.error(await ev('window.fatal')); process.exit(1); }
  const TL = await ev('window.TIMELINE'); fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(TL, null, 1));
  console.log('duration', TL.dur.toFixed(2) + 's', TL.segs.length + ' segments', TL.events.length + ' sounds');
  const jpg = (d) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
  const video = (from, to, out, quick) => new Promise(async (done) => {
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', quick ? 'veryfast' : 'medium', '-crf', quick ? '22' : '16', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now(), a = Math.round(from * FPS), z = Math.round(to * FPS);
    for (let f = a; f < z; f++) { const buf = jpg(await ev(`frame(${f})`)); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); if ((f - a) % 150 === 0) console.log(`frame ${f}/${z} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    ff.stdin.end(); ff.on('close', done);
  });

  if (mode === 'peek') {
    for (const a of args) fs.writeFileSync(path.join(OUT, 'peek', `t${(+a).toFixed(2).padStart(6, '0')}.jpg`), jpg(await ev(`frame(${Math.round(+a * FPS)})`)));
    console.log('stills in', path.join(OUT, 'peek'));
  } else if (mode === 'clip') {
    await video(+args[0], +args[1], path.join(OUT, 'clip.mp4'), true); console.log('clip.mp4 done');
  } else {
    const silent = path.join(OUT, 'silent.mp4'); await video(0, TL.dur, silent, false);
    // sound: the song starts at its first beat so the cuts land on the beat, plus the effects the page asked for
    const snd = path.join(GAME, 'assets/sounds'), ins = ['-i', silent, '-ss', String(cfg.music.offset || 0), '-i', songFile], f = [];
    f.push(`[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${TL.dur},afade=t=out:st=${(TL.dur - 1.4).toFixed(2)}:d=1.3,volume=${cfg.music.volume || .62}[m]`);
    TL.events.forEach((e, i) => { ins.push('-i', path.join(snd, e.file)); f.push(`[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${e.vol},adelay=${Math.round(Math.max(0, e.t) * 1000)}:all=1[s${i}]`); });
    f.push('[m]' + TL.events.map((_, i) => `[s${i}]`).join('') + `amix=inputs=${TL.events.length + 1}:duration=first:normalize=0,alimiter=limit=0.92[a]`);
    const final = path.join(REPO, 'output', `miku-battle-${id}-short.mp4`);
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...ins, '-filter_complex', f.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(TL.dur), final], { maxBuffer: 1 << 26 });
    console.log('done', final);
  }
  ch.kill(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
