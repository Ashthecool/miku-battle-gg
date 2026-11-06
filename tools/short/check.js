// Preflight for a short: every image and sound it will draw or play has to exist (on disk or in the bucket).
//   node tools/short/check.js <id>
// Prints what is missing and exits 1. capture.js and render.js run it first, so a missing sprite stops the job instead of
// becoming a character that silently vanishes from the video (see SKILL.md: "disappearing sprites").
const fs = require('fs'), path = require('path');
const assets = require('./lib/assets');
const HERE = __dirname, GAME = assets.GAME;

async function preflight(id, { quiet } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'configs', id + '.json'), 'utf8'));
  const manifest = require(path.join(GAME, 'assets/manifest.json'));
  const need = new Map(), add = (rel, why) => { if (rel) need.set(rel, (need.get(rel) || []).concat(why)); };
  const char = (cid, why) => {
    const c = manifest.characters.find((x) => x.id === cid);
    if (!c) { add('?character:' + cid, why); return; }
    Object.entries(c.sprites).forEach(([role, p]) => add(p, `${cid} ${role}${role === 'attack' ? ' (the game swaps to it during their attack)' : ''}`));
    add('portraits/' + cid + '.webp', cid + ' portrait');
  };
  (cfg.cast || []).forEach((c) => char(c.id, 'cast'));
  const B = cfg.battle || {};
  [B.leader, B.foe, ...(B.foeDeck || []), ...(B.groups || []).flat()].filter(Boolean).forEach((cid) => char(cid, 'battle'));
  // every portrait in the grid
  manifest.characters.filter((c) => c.novel === cfg.novel).forEach((c) => add('portraits/' + c.id + '.webp', 'grid'));
  // backgrounds: any variant of the name that exists
  const bgFound = async (name) => { for (const b of manifest.backgrounds.filter((x) => x.name === name)) { const r = await assets.find(b.src); if (r.file) return; } add('?background:' + name, 'background'); };
  for (const n of [...(cfg.bgs || []), B.bg].filter(Boolean)) await bgFound(n);
  // sounds the page and the game's own samples use
  const html = fs.readFileSync(path.join(HERE, 'short.html'), 'utf8');
  for (const m of html.matchAll(/'([a-z0-9-]+\.mp3)'/g)) add('sounds/' + m[1], 'short.html');
  for (const m of fs.readFileSync(path.join(GAME, 'js/audio.js'), 'utf8').matchAll(/file: '([^']+)'/g)) add('sounds/' + m[1], 'game sample');
  if (cfg.music && cfg.music.file) add('music/' + cfg.music.file, 'song');
  add('icons/icon-192.png', 'logo');

  const rows = [], missing = [];
  for (const [rel, why] of need) {
    if (rel.startsWith('?')) { missing.push({ rel, why: why[0] }); continue; }
    const r = rel.startsWith('icons/') ? { file: path.join(GAME, rel), where: 'disk' } : await assets.find(rel);
    if (!r.file || !fs.existsSync(r.file)) missing.push({ rel, why: why[0] }); else if (r.where.startsWith('bucket')) rows.push({ rel, where: r.where });
  }
  if (!quiet) {
    if (rows.length) console.log(`${rows.length} files come from the bucket, not from game/assets/ (cached under output/short/cache/assets/):\n  ` + rows.map((r) => r.rel).join('\n  '));
    if (missing.length) console.error(`MISSING (${missing.length}), nothing may be drawn or played from these:\n  ` + missing.map((m) => `${m.rel}  <- ${m.why}`).join('\n  '));
    else console.log('preflight ok: ' + need.size + ' assets for ' + id);
  }
  return missing;
}
module.exports = { preflight };
if (require.main === module) preflight(process.argv[2]).then((m) => process.exit(m.length ? 1 : 0));
