// Loads the game's data and rules in Node and checks that everything fits together, then plays AI-vs-AI
// battles to shake out abilities that throw. Run after changing game/js/data.js or the manifest:
//   node tools/check_game.js [battles=300] [--texts]   (--texts prints the card/power texts written from specs)
// Exits non-zero on errors. Warnings (texts to write, stat outliers) don't fail it.
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.join(__dirname, '..', 'game');
const args = process.argv.slice(2), BATTLES = +args.find((a) => /^\d+$/.test(a)) || 300, TEXTS = args.includes('--texts');

// ---------------------------------------------------------------- load the game in a sandbox
const noop = () => {};
const sandbox = {
  console, Math, JSON, Promise, Set, Map, Object, Array, String, Number, Boolean, Error, performance: { now: () => Date.now() },
  setTimeout: (fn) => setImmediate(fn), clearTimeout: noop,
  document: { addEventListener: noop, querySelector: () => null, getElementById: () => null, createElement: () => ({ style: {} }) },
  gsap: new Proxy({}, { get: () => noop }),
  addEventListener: noop,
};
sandbox.window = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['js/config.js', 'assets/manifest.js', 'js/data.js', 'js/effects.js', 'js/engine.js', 'js/ai.js', 'js/fx.js', 'js/cards.js']) {
  vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), sandbox, { filename: f });
}
const MB = sandbox.MB, M = sandbox.MIKU_MANIFEST;
MB.manifest = M;
const chars = new Map(M.characters.map((c) => [c.id, c]));
MB.charById = (id) => chars.get(id);

const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

// ---------------------------------------------------------------- content
const E = MB.Effects, STYLES = MB.FX.styles, INTRO = MB.Cards.intros, MOVES = MB.Cards.moves, SCENES = MB.Cards.scenes;
const TARGETS = ['enemyUnit', 'allyUnit', 'anyUnit', 'enemyAny', 'friendlyAny'];
const FILTERS = [undefined, 'lowAtk', 'sick', 'guarded', 'hasKw', 'noRebel', 'spent'];
const INTRO_FX = ['spray', 'fling', 'swirl', 'rain', 'confetti', 'column', 'flash'];
const SFX = ['sparkle', 'slam', 'zap', 'splash', 'heal', 'coin', 'whoosh', 'hit', 'buff', 'beam', 'click', 'draw', 'freeze', 'shield', 'debuff',
  'boing', 'bonk', 'pow', 'whistleUp', 'whistleDown', 'pop', 'squeak', 'zip', 'honk', 'wobble', 'tweet', 'splat', 'twang', 'chomp', 'ding', 'whistle', 'bubble', 'blink', 'punch',
  'fire', 'burn', 'frost', 'shatter', 'wave', 'holy', 'fusion', 'thunder', 'dark', 'wind', 'boom'];
const cardExists = (id) => id === 'randomItem' || id === 'randomUnit' || !!MB.CARDS[id];

function checkSpec(where, spec, { trigger, target }) {
  if (typeof spec === 'string') return; // a named ability in engine.js
  if (!spec || typeof spec !== 'object') return err(`${where}: not an ability`);
  const steps = E.stepsOf(spec);
  if (!steps.length) err(`${where}: no steps`);
  for (const s of steps) {
    const at = `${where} (${JSON.stringify(s)})`;
    const op = E.OPS[s.op];
    if (!op) { err(`${at}: unknown op "${s.op}"`); continue; }
    if ((!op.async || op.valid) && !op.self && !s.to) err(`${at}: needs "to"`);
    if (s.to && !E.SEL[s.to]) err(`${at}: unknown target "${s.to}"`);
    if (s.to === 'target' && !target) err(`${at}: "to: target" needs a chosen target (only item cards and powers have one)`);
    if (s.to === 'self' && !trigger) err(`${at}: "to: self" only works in a triggered ability`);
    if (s.where && !E.WHERE[s.where]) err(`${at}: unknown where "${s.where}"`);
    if (s.if && !E.IF[s.if]) err(`${at}: unknown if "${s.if}"`);
    if (s.op === 'keyword' && !MB.KEYWORDS[s.kw]) err(`${at}: unknown keyword "${s.kw}"`);
    if ((s.op === 'addCard' || (s.op === 'summon' && s.from !== 'deck')) && !cardExists(s.card)) err(`${at}: unknown card "${s.card}"`);
    if (s.op === 'summon' && s.card && s.card !== 'randomUnit' && MB.CARDS[s.card] && MB.CARDS[s.card].type) err(`${at}: can only summon characters/tokens`);
    if (s.op === 'buff' && !s.atk && !s.hp) err(`${at}: buff needs atk and/or hp`);
    if (s.times && !['randomAlly', 'randomEnemy', 'randomEnemyAny'].includes(s.to)) warn(`${at}: "times" repeats a random pick; with "${s.to}" it hits the same targets`);
    if (trigger === 'onHurt' && s.op === 'damage' && s.to === 'self') err(`${at}: an onHurt that damages itself loops`);
  }
  if (spec.color && !/^#[0-9a-f]{3,8}$/i.test(spec.color)) err(`${where}: bad color ${spec.color}`);
}

const RECIPE = MB.FX.recipe;
function checkAttack(where, a, duo) {
  if (!a) return err(`${where}: no attack`);
  if (a.style ? !STYLES[a.style] : !(a.move || a.fx)) err(`${where}: unknown attack style "${a.style}" (or give a recipe: move/fx)`);
  if (a.style && (a.move || a.fx)) warn(`${where}: has a style and a recipe; the style wins`);
  if (a.move && !RECIPE.moves[a.move]) err(`${where}: unknown recipe move "${a.move}"`);
  if (a.fx && !RECIPE.fx[a.fx]) err(`${where}: unknown recipe fx "${a.fx}"`);
  if (a.floor && !RECIPE.floors[a.floor]) err(`${where}: unknown recipe floor "${a.floor}"`);
  if (a.fx === 'hit' && a.move && RECIPE.moves[a.move] && RECIPE.moves[a.move].ranged) warn(`${where}: fx "hit" with move "${a.move}" punches thin air`);
  if (a.hits != null && !(a.hits >= 1 && a.hits <= 20)) err(`${where}: hits should be 1-20`);
  ['cry', 'finish', 'shout', 'mark'].forEach((k) => { if (a[k] != null && (typeof a[k] !== 'string' || a[k].length > 30)) warn(`${where}: ${k} should be a short line (≤ 30 chars)`); });
  if (a.words && !Array.isArray(a.words)) err(`${where}: words must be a list`);
  if (a.sfx && !SFX.includes(a.sfx)) err(`${where}: unknown sfx "${a.sfx}"`);
  if (!a.name && !where.includes('dummy')) warn(`${where}: attack has no name`);
  if (!/^#[0-9a-f]{3,8}$/i.test(a.color || '')) err(`${where}: bad attack color`);
}

const TRIGGERS = ['onPlay', 'onAttack', 'onKill', 'onDeath', 'onTurnStart', 'onTurnEnd', 'onAllyDeath', 'onHurt'];
for (const [id, c] of Object.entries(MB.CARDS)) {
  const at = `card ${id}`;
  if (c.type === 'spell') {
    if (!M.items.some((i) => i.id === id)) err(`${at}: no item with this id in the manifest (its icon)`);
    if (c.target && !TARGETS.includes(c.target)) err(`${at}: unknown target type ${c.target}`);
    if (!FILTERS.includes(c.filter)) err(`${at}: unknown filter ${c.filter}`);
    if (c.cast && !MB.FX.casts.includes(c.cast)) err(`${at}: unknown cast "${c.cast}"`);
    checkSpec(at, c.effect, { target: c.target });
    if (!c.text) err(`${at}: no text`);
    continue;
  }
  if (!c.token && !chars.has(id)) err(`${at}: no character with this id in the manifest`);
  if (!MB.RARITY[c.rarity]) err(`${at}: unknown rarity ${c.rarity}`);
  (c.kw || []).forEach((k) => { if (!MB.KEYWORDS[k]) err(`${at}: unknown keyword ${k}`); });
  checkAttack(at, c.attack);
  TRIGGERS.forEach((t) => c[t] && checkSpec(`${at} ${t}`, c[t], { trigger: t }));
  if (TRIGGERS.some((t) => typeof c[t] === 'string') && !c.text) warn(`${at}: a named ability but no text`);
  if (c.intro) {
    if (typeof c.intro === 'string') { if (!INTRO[c.intro] && !MB.Cards.styleIntros[c.intro]) err(`${at}: unknown intro "${c.intro}"`); }
    else {
      if (c.intro.move && !MOVES[c.intro.move]) err(`${at}: unknown intro move "${c.intro.move}"`);
      if (c.intro.fx && !INTRO_FX.includes(c.intro.fx)) err(`${at}: unknown intro fx "${c.intro.fx}"`);
    }
  }
  if (!c.token && chars.has(id)) {
    if (!MB.POWERS[id]) err(`${at}: no leader power`);
    // stat budget: a vanilla card has about 2*cost+1 stats; keywords and abilities cost some of that
    const budget = 2 * c.cost + 1, stats = c.atk + c.hp, extras = (c.kw || []).length + TRIGGERS.filter((t) => c[t]).length;
    if (stats > budget + 2 || stats + extras * 2 < budget - 3) warn(`${at}: ${c.cost} mana ${c.atk}/${c.hp} with ${extras} extras looks off (about ${budget} stats expected)`);
  }
}
for (const c of M.characters) if (!MB.CARDS[c.id]) err(`character ${c.id} (${c.novel}) has no card`);

for (const [id, p] of Object.entries(MB.POWERS)) {
  const at = `power ${id}`;
  if (!chars.has(id)) err(`${at}: no such character`);
  if (p.target && !TARGETS.includes(p.target)) err(`${at}: unknown target type ${p.target}`);
  if (!FILTERS.includes(p.filter)) err(`${at}: unknown filter ${p.filter}`);
  checkSpec(at, p.effect, { target: p.target });
  if (!p.name || !p.text || !(p.cost >= 0)) err(`${at}: needs name, cost and text`);
}

const bondIds = new Set();
for (const b of MB.BONDS) {
  const at = `bond ${b.id}`;
  if (bondIds.has(b.id)) err(`${at}: duplicate id`);
  bondIds.add(b.id);
  b.pair.forEach((id, i) => {
    const c = chars.get(id);
    if (!c) return err(`${at}: unknown character ${id}`);
    const cos = b.costumes[i];
    if (cos && !c.costumes.some((o) => o.id === cos)) err(`${at}: ${id} has no costume "${cos}" (has: ${c.costumes.map((o) => o.id).join(', ') || 'none'})`);
  });
  if (!MB.BOND_TIERS[b.tier]) err(`${at}: unknown tier ${b.tier}`);
  checkAttack(at, b.attack);
  if (b.onFuse) checkSpec(`${at} onFuse`, b.onFuse, { trigger: 'onFuse' });
  (b.kw || []).forEach((k) => { if (!MB.KEYWORDS[k]) err(`${at}: unknown keyword ${k}`); });
  const sc = MB.BOND_SCENES[b.id];
  if (!sc) err(`${at}: no close-up scene in MB.BOND_SCENES`);
  else {
    if (!SCENES[sc.kind]) err(`${at}: unknown scene kind "${sc.kind}"`);
    if (!Array.isArray(sc.lines) || sc.lines.length !== 2) err(`${at}: scene needs two lines`);
  }
}
Object.keys(MB.BOND_SCENES).forEach((id) => { if (!bondIds.has(id)) warn(`scene ${id}: no bond with this id`); });
Object.entries(MB.HIDDEN_COSTUMES).forEach(([id, list]) => list.forEach((o) => {
  if (!chars.get(id) || !chars.get(id).costumes.some((x) => x.id === o)) warn(`hidden costume ${id}/${o} doesn't exist`);
}));

const bgNames = new Set(M.backgrounds.map((b) => b.name.trim().toLowerCase())), music = new Set(M.music.map((m) => m.id));
MB.STORY.forEach((s, i) => {
  const at = `story ${i} (${s.foe})`;
  if (!chars.has(s.foe)) err(`${at}: unknown foe`);
  if (!bgNames.has(s.bg.trim().toLowerCase())) err(`${at}: no background named "${s.bg}"`);
  if (!music.has(s.music)) err(`${at}: no music "${s.music}"`);
  if (!MB.CHAPTERS[s.chapter]) err(`${at}: chapter ${s.chapter} has no MB.CHAPTERS entry`);
  if (!s.intro) err(`${at}: no intro`);
});
MB.CHAPTERS.forEach((c, i) => { if (!MB.STORY.some((s) => s.chapter === i)) err(`chapter ${i} (${c.title}) has no stages`); });
MB.STARTER_DECK.forEach((id) => { if (!MB.CARDS[id]) err(`starter deck: unknown card ${id}`); });
MB.STARTER_LEADERS.forEach((id) => { if (!MB.POWERS[id]) err(`starter leader ${id} has no power`); });

// ---------------------------------------------------------------- AI vs AI
const pick = (a) => a[Math.random() * a.length | 0];
const viewStub = new Proxy({}, {
  get: (_, name) => (...args) => {
    const fn = args.find((a) => typeof a === 'function');
    if (name === 'fuse') { const u = args[2]; return Promise.resolve(u); }
    if (fn) fn();
    return Promise.resolve();
  },
});
const deckable = Object.keys(MB.CARDS).filter((id) => !MB.CARDS[id].token);
const leaders = Object.keys(MB.POWERS).filter((id) => chars.has(id));
// decks that lean on one novel so its relationships actually form
function randomDeck() {
  const novel = pick(M.characters).novel;
  const own = deckable.filter((id) => (chars.get(id) || {}).novel === novel);
  const deck = [];
  while (deck.length < 20) deck.push(Math.random() < 0.6 && own.length ? pick(own) : pick(deckable));
  return deck;
}

(async () => {
  const failures = new Map();
  let turns = 0, done = 0;
  for (let i = 0; i < BATTLES; i++) {
    const b = new MB.Battle({ view: viewStub, playerLeader: pick(leaders), enemyLeader: pick(leaders), playerDeck: randomDeck(), enemyDeck: randomDeck() });
    b.aiSkill = Math.random();
    try {
      await b.start();
      for (let g = 0; g < 120 && !b.over; g++) await MB.AI.takeTurn(b, 0);
      turns += b.turn; done++;
    } catch (e) {
      const key = (e.stack || String(e)).split('\n').slice(0, 3).join(' | ');
      failures.set(key, (failures.get(key) || 0) + 1);
    }
  }
  failures.forEach((n, key) => err(`battle crashed ${n}x: ${key}`));

  if (TEXTS) {
    const isSpec = (x) => x && typeof x === 'object';
    Object.entries(MB.CARDS).filter(([, c]) => isSpec(c.effect) || TRIGGERS.some((t) => isSpec(c[t]))).forEach(([id, c]) => console.log(`card  ${id}: ${c.text}`));
    Object.entries(MB.POWERS).filter(([, p]) => isSpec(p.effect)).forEach(([id, p]) => console.log(`power ${id} (${p.name}, ${p.cost}): ${p.text}`));
    MB.BONDS.filter((b) => isSpec(b.onFuse)).forEach((b) => console.log(`bond  ${b.id}: ${b.text}`));
  }
  warnings.forEach((w) => console.log('warn  ' + w));
  errors.forEach((e) => console.log('ERROR ' + e));
  console.log(`\n${M.characters.length} characters, ${Object.keys(MB.CARDS).length} cards, ${MB.BONDS.length} bonds, ${MB.STORY.length} story stages`);
  console.log(`${done}/${BATTLES} battles finished (avg ${(turns / Math.max(1, done)).toFixed(1)} turns); ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
})();
