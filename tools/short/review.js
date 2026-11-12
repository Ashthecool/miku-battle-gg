// Review stills for "Look before you ship" (SKILL.md): 3 stills per cast member (wind-up, hit, finish), tiled 4 cast per image.
//   node tools/short/review.js <id>      -> output/short/<id>/review-1.jpg, review-2.jpg ...   (needs the capture; uses SLOT 7 unless SLOT is set)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const id = process.argv[2], REPO = path.join(__dirname, '..', '..'), OUT = path.join(REPO, 'output', 'short', id);
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'configs', id + '.json'), 'utf8'));
const B = 60 / cfg.music.bpm, L = { intro: 6, cast: 5, ...(cfg.beats || {}) }, slot = L.cast * B, start = L.intro * B;
const times = []; cfg.cast.forEach((_, i) => [0.3, Math.min(1.1, slot * 0.45), slot - 0.35].forEach((o) => times.push((start + i * slot + o).toFixed(2))));
execFileSync(process.execPath, [path.join(__dirname, 'render.js'), id, 'peek', ...times], { cwd: REPO, env: { SLOT: '7', ...process.env }, stdio: 'inherit' });
const stills = times.map((t) => path.join(OUT, 'peek', `t${t.padStart(6, '0')}.jpg`));
for (let p = 0; p * 12 < stills.length; p++) {
  const part = stills.slice(p * 12, p * 12 + 12), file = path.join(OUT, `review-${p + 1}.jpg`);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...part.flatMap((f) => ['-i', f]), '-filter_complex', part.map((_, i) => `[${i}]scale=300:-1[v${i}]`).join(';') + ';' + part.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${part.length}:layout=${part.map((_, i) => `${(i % 6) * 300}_${Math.floor(i / 6) * 533}`).join('|')}`, file]);
  console.log('review image', file, 'cast', cfg.cast.slice(p * 4, p * 4 + 4).map((c) => c.id).join(', '));
}
