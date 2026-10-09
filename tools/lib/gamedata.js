// Loads the game's data tables in Node (no DOM), from the working tree or from a git revision, and lists what changed between two.
//   const { load, changedAttacks } = require('./lib/gamedata');
//   load().CARDS['yumi']; load('HEAD~1').BONDS;  changedAttacks('HEAD') -> { cards: [...], bonds: [...] }
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const FILES = ['js/config.js', 'assets/manifest.js', 'js/avatars.js', 'js/data.js', 'js/content.js'];

const read = (rev, f) => rev
  ? execFileSync('git', ['show', `${rev}:game/${f}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  : fs.readFileSync(path.join(root, 'game', f), 'utf8');

function load(rev = null, { nsfw = true } = {}) {
  const noop = () => {};
  const sb = { console, Math, JSON, Promise, Set, Map, Object, Array, String, Number, Boolean, Error, performance: { now: () => Date.now() },
    setTimeout: (f) => setImmediate(f), clearTimeout: noop, addEventListener: noop, gsap: new Proxy({}, { get: () => noop }),
    document: { readyState: 'loading', addEventListener: noop, querySelector: () => null, getElementById: () => null, createElement: () => ({ style: {} }) } };
  sb.window = sb; sb.self = sb;
  vm.createContext(sb);
  for (const f of FILES) {
    if (f === 'js/content.js') sb.MB.NSFW = nsfw;
    let src;
    try { src = read(rev, f); } catch (e) { if (rev) continue; throw e; } // a file that didn't exist yet at that revision
    vm.runInContext(src, sb, { filename: f });
  }
  sb.MB.manifest = sb.MIKU_MANIFEST;
  return sb.MB;
}

// card and bond ids whose attack is new or different from `rev`
function changedAttacks(rev = 'HEAD') {
  const now = load(), then = load(rev), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cards = Object.keys(now.CARDS).filter((id) => now.CARDS[id].attack && now.CARDS[id].type !== 'spell'
    && !(then.CARDS[id] && same(now.CARDS[id].attack, then.CARDS[id].attack)));
  const old = new Map(then.BONDS.map((b) => [b.id, b]));
  const bonds = now.BONDS.filter((b) => !(old.has(b.id) && same(b.attack, old.get(b.id).attack))).map((b) => b.id);
  return { cards, bonds };
}

// attack styles whose code in fx.js differs from `rev` (each changed line belongs to the `S.name = ` above it)
function changedStyles(rev = 'HEAD') {
  const diff = execFileSync('git', ['diff', '-U0', rev, '--', 'game/js/fx.js'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  const lines = fs.readFileSync(path.join(root, 'game/js/fx.js'), 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = /^\s*S\.([A-Za-z0-9_]+)\s*=/.exec(l); if (m) starts.push([i + 1, m[1]]); });
  const styles = new Set();
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const from = +m[1], n = m[2] == null ? 1 : +m[2];
    for (let ln = from; ln < from + Math.max(n, 1); ln++) {
      const s = starts.filter(([at]) => at <= ln).pop();
      if (s) styles.add(s[1]);
    }
  }
  return [...styles];
}

// ids of every card and bond using one of these styles
function usersOfStyles(MB, styles) {
  const set = new Set(styles);
  return [...Object.keys(MB.CARDS).filter((id) => MB.CARDS[id].attack && set.has(MB.CARDS[id].attack.style)),
    ...MB.BONDS.filter((b) => b.attack && set.has(b.attack.style)).map((b) => b.id)];
}

module.exports = { load, changedAttacks, changedStyles, usersOfStyles };
