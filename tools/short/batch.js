// Runs several shorts at once. Every browser job (one capture group, the audit, one chunk of a render) takes a free "slot": its own
// ports and Chrome profile (SLOT env, see capture.js / render.js), so W jobs run side by side on a multi-core machine.
//   node tools/short/batch.js capture <id...> [--workers 4] [--force]
//        records every battle group of each short (skips groups that already have a log.json unless --force); a failed group is retried once
//   node tools/short/batch.js render <id...> [--workers 4] [--chunks 4] [--upload public|unlisted|private]
//        per short: audit, the frames in --chunks parallel pieces, join, sound mix, ffprobe + volumedetect, then (optional) the YouTube upload
//        (uploads run one at a time, in the background of the next renders). Look at `render.js <id> peek` stills BEFORE this (SKILL.md).
// Progress goes to stdout; each job's own output goes to output/short/<id>/batch-<job>.log.
const fs = require('fs'), path = require('path'), { spawn, spawnSync, execFileSync } = require('child_process');
const HERE = __dirname, REPO = path.join(HERE, '..', '..');
const [, , cmd, ...rest] = process.argv;
const flag = (n, d) => { const i = rest.indexOf('--' + n); if (i < 0) return d; const v = rest[i + 1]; rest.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const SLOT_BASE = +flag('slot-base', 0), WORKERS = +flag('workers', 4), CHUNKS = +flag('chunks', 4), FORCE = !!flag('force', false), UPLOAD = flag('upload', '');
const ids = rest;
if (!['capture', 'render'].includes(cmd) || !ids.length) { console.error('usage: node tools/short/batch.js capture|render <id...> [--workers N] [--chunks N] [--force] [--upload public] [--slot-base N]'); process.exit(1); }
const cfgOf = (id) => JSON.parse(fs.readFileSync(path.join(HERE, 'configs', id + '.json'), 'utf8'));
const outOf = (id) => path.join(REPO, 'output', 'short', id);
const t0 = Date.now(), stamp = () => `[${((Date.now() - t0) / 60000).toFixed(1)}m]`, say = (...a) => console.log(stamp(), ...a);

// ---- slot pool
const free = Array.from({ length: WORKERS }, (_, i) => SLOT_BASE + i), waiting = [];
const take = () => new Promise((r) => (free.length ? r(free.shift()) : waiting.push(r)));
const give = (s) => (waiting.length ? waiting.shift()(s) : free.push(s));
const run = (file, args, { slot, log, env = {} }) => new Promise((resolve) => {
  const out = fs.openSync(log, 'w');
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { cwd: REPO, env: { ...process.env, ...(slot != null ? { SLOT: String(slot) } : {}), ...env }, stdio: ['ignore', out, out] });
  p.on('close', (code) => { fs.closeSync(out); resolve(code); if (slot != null) for (const k of ['chrome-capture', 'chrome-profile']) fs.rm(path.join(REPO, 'output', 'short', 'cache', `${k}-${slot}-${p.pid}`), { recursive: true, force: true, maxRetries: 20, retryDelay: 1000 }, () => {}); });
});
const job = async (name, id, file, args, tries = 2) => { // a browser job on a free slot; retried once
  for (let k = 1; k <= tries; k++) {
    const slot = await take();
    try { const code = await run(file, args, { slot, log: path.join(outOf(id), `batch-${name}${k > 1 ? '-retry' : ''}.log`) }); if (code === 0) return true; say(`${id} ${name} failed (exit ${code}, try ${k}/${tries}), see batch-${name}.log`); }
    finally { give(slot); }
  }
  return false;
};
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 26 });

// ---- capture
async function capture(id) {
  const cfg = cfgOf(id), groups = cfg.battle.groups; fs.mkdirSync(outOf(id), { recursive: true });
  const todo = groups.map((_, gi) => gi).filter((gi) => FORCE || !fs.existsSync(path.join(outOf(id), 'battle', 'g' + gi, 'log.json')));
  say(`${id}: ${todo.length}/${groups.length} groups to record`);
  let n = 0; const bad = [];
  await Promise.all(todo.map(async (gi) => { const ok = await job(`capture-g${gi}`, id, 'capture.js', [id, String(gi)]); say(`${id}: group ${gi} ${ok ? 'recorded' : 'FAILED'} (${++n}/${todo.length})`); if (!ok) bad.push(gi); }));
  return { id, ok: !bad.length, bad };
}

// ---- render (+ upload)
let uploads = Promise.resolve();
async function render(id) {
  const cfg = cfgOf(id), OUT = outOf(id), fail = (why) => { say(`${id}: ${why}`); return { id, ok: false, why }; };
  if (!(await job('audit', id, 'render.js', [id, 'audit'], 1))) return fail('AUDIT FAILED, a character or footage frame is missing (batch-audit.log)');
  const TL = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8')), frames = Math.round(TL.dur * 30), per = Math.ceil(frames / CHUNKS);
  say(`${id}: audit ok, ${TL.dur.toFixed(1)} s = ${frames} frames in ${CHUNKS} chunks`);
  const segs = Array.from({ length: CHUNKS }, (_, i) => [i * per, Math.min(frames, (i + 1) * per)]).filter(([a, z]) => z > a);
  segs.forEach((_, i) => fs.rmSync(path.join(OUT, `seg${i}.mp4`), { force: true }));
  const oks = await Promise.all(segs.map(([a, z], i) => job(`seg${i}`, id, 'render.js', [id, 'seg', String(a), String(z), path.join(OUT, `seg${i}.mp4`)])));
  if (oks.includes(false)) return fail('a render chunk failed');
  fs.writeFileSync(path.join(OUT, 'segs.txt'), segs.map((_, i) => `file '${path.join(OUT, `seg${i}.mp4`).replace(/\\/g, '/')}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'segs.txt'), '-c', 'copy', path.join(OUT, 'silent.mp4')]);
  execFileSync(process.execPath, [path.join(HERE, 'render.js'), id, 'mix'], { cwd: REPO, stdio: 'inherit' });
  const final = path.join(REPO, 'output', `miku-battle-${id}-short.mp4`);
  for (const f of [...segs.map((_, i) => `seg${i}.mp4`), 'silent.mp4']) fs.rmSync(path.join(OUT, f), { force: true }); // intermediates (disk space)
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', final]).toString());
  const vd = spawnSync('ffmpeg', ['-hide_banner', '-i', final, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '', vnum = (k) => +((vd.match(new RegExp(k + ': (-?[0-9.]+) dB')) || [])[1]);
  const r = { id, ok: true, w: probe.streams[0].width, h: probe.streams[0].height, frames: +probe.streams[0].nb_read_frames, expect: frames, dur: +(+probe.format.duration).toFixed(2), meanDb: vnum('mean_volume'), maxDb: vnum('max_volume') };
  say(`${id}: ${final}  ${r.w}x${r.h}  ${r.dur}s  ${r.frames}/${frames} frames  mean ${r.meanDb} dB, max ${r.maxDb} dB`);
  if (r.w !== 1080 || r.h !== 1920 || r.frames !== frames) return fail(`bad output ${JSON.stringify(r)}`);
  if (UPLOAD) {
    const name = (cfg.name || cfg.novel).trim();
    const up = () => new Promise((resolve) => {
      const log = fs.openSync(path.join(OUT, 'batch-upload.log'), 'w');
      const p = spawn(process.execPath, [path.join(REPO, 'tools/youtube/upload.js'), 'upload', final, '--title', `${name} is in Miku Battle!`, '--description-file', path.join(REPO, 'tools/youtube/descriptions', id + '.txt'),
        '--tags', `Miku Battle,${name},miku.gg,card game,visual novel`, '--privacy', String(UPLOAD), '--short'], { cwd: REPO, stdio: ['ignore', log, log] });
      p.on('close', (code) => { const t = fs.readFileSync(path.join(OUT, 'batch-upload.log'), 'utf8'); const m = t.match(/Uploaded: (\S+)\s+\((\w+)\)/); say(`${id}: upload ${code === 0 && m ? m[1] + ' (' + m[2] + ')' : 'FAILED, see batch-upload.log'}`); r.url = m && m[1]; r.privacy = m && m[2]; resolve(); });
    });
    uploads = uploads.then(up); await uploads;
  }
  return r;
}

(async () => {
  say(`${cmd}: ${ids.join(', ')} with ${WORKERS} workers${cmd === 'render' ? `, ${CHUNKS} chunks each` : ''}`);
  const res = await Promise.all(ids.map((id) => (cmd === 'capture' ? capture(id) : render(id).catch((e) => ({ id, ok: false, why: String(e) })))));
  say('summary'); res.forEach((r) => console.log('  ', JSON.stringify(r)));
  process.exit(res.every((r) => r.ok) ? 0 : 1);
})();
