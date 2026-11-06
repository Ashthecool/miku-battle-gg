// Estimates a track's tempo and first-beat offset: node bpm.js <audio file> [seconds to analyse]
const { execFileSync } = require('child_process');
const [, , file, secs = '40'] = process.argv;
const SR = 8000, HOP = 80; // 100 envelope frames per second
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-t', secs, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
const s = new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1), env = [];
for (let i = 0; i + HOP <= s.length; i += HOP) { let e = 0; for (let j = 0; j < HOP; j++) e += s[i + j] * s[i + j]; env.push(Math.sqrt(e / HOP)); }
const on = env.map((v, i) => (i ? Math.max(0, v - env[i - 1]) : 0)), fps = SR / HOP;
let best = [0, 0];
for (let bpm = 70; bpm <= 180; bpm += 0.5) {
  const lag = (60 / bpm) * fps; let sc = 0;
  for (let k = 1; k <= 4; k++) for (let i = 0; i + lag * k < on.length; i += 1) sc += on[i] * on[Math.round(i + lag * k)];
  if (sc / (1 + 0) > best[1]) best = [bpm, sc];
}
const bpm = best[0], lag = (60 / bpm) * fps; let off = [0, 0];
for (let o = 0; o < lag; o++) { let sc = 0; for (let i = o; i < on.length; i += lag) sc += on[Math.round(i)]; if (sc > off[1]) off = [o, sc]; }
console.log(JSON.stringify({ bpm, offset: +(off[0] / fps).toFixed(2) }));
