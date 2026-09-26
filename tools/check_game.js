// Loads the game's data and rules in Node and checks that everything fits together, then plays AI-vs-AI
// battles to shake out abilities that throw. Run after changing game/js/data.js or the manifest:
//   node tools/check_game.js [battles=300] [--texts] [--sfw]   (--texts prints the card/power texts written from specs;
//   --sfw checks the game as it is with NSFW mode off, default is everything on)
// Exits non-zero on errors. Warnings (texts to write, stat outliers) don't fail it.
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.join(__dirname, '..', 'game');
const args = process.argv.slice(2), BATTLES = +args.find((a) => /^\d+$/.test(a)) || 300, TEXTS = args.includes('--texts'), SFW = args.includes('--sfw');

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
for (const f of ['js/config.js', 'assets/manifest.js', 'js/avatars.js', 'js/data.js', 'js/content.js', 'js/story.js', 'js/collection.js', 'js/missions.js', 'js/arena.js', 'js/effects.js', 'js/engine.js', 'js/ai.js', 'js/fx.js', 'js/cards.js']) {
  if (f === 'js/content.js') sandbox.MB.NSFW = !SFW;
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
const INTRO_FX = ['spray', 'fling', 'swirl', 'rain', 'confetti', 'column', 'flash', 'smoke'];
const SFX = ['sparkle', 'slam', 'zap', 'splash', 'heal', 'coin', 'whoosh', 'hit', 'buff', 'beam', 'click', 'draw', 'freeze', 'shield', 'debuff',
  'boing', 'bonk', 'pow', 'whistleUp', 'whistleDown', 'pop', 'squeak', 'zip', 'honk', 'wobble', 'tweet', 'splat', 'twang', 'chomp', 'ding', 'whistle', 'bubble', 'blink', 'punch',
  'fire', 'burn', 'frost', 'shatter', 'wave', 'holy', 'fusion', 'thunder', 'dark', 'wind', 'boom',
  'choir', 'laugh', 'incoming', 'tornado', 'vortex', 'missile', 'vines', 'rune', 'shuriken', 'melody', 'poof', 'gunshot', 'scope', 'lava', 'kiss', 'swish', 'clang', 'glitch', 'camera', 'tick', 'stab', 'cheer', 'scythe', 'surf',
  'guitar', 'piano', 'axe', 'flip', 'slide', 'glass', 'flutter', 'stomp', 'grow', 'trash', 'drumroll', 'gong', 'sizzle', 'applause', 'hypno', 'warp', 'unsheathe', 'stretch', 'siren',
  'crinkle', 'foil', 'rip', 'tear', 'cardflip', 'deal', 'riser', 'loot', 'gem', 'fanfare', 'fragment', 'tink', 'unlock', 'thud', 'swipe', 'heartbeat', 'glint'];
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
  if (a.sky != null && a.sky !== 'none' && a.sky !== false && !MB.FX.skies.includes(a.sky)) err(`${where}: unknown sky "${a.sky}" (${MB.FX.skies.join(', ')})`);
  if (a.aura != null && a.aura !== true && !/^#[0-9a-f]{3,8}$/i.test(a.aura)) err(`${where}: aura should be true or a color`);
  if (a.zoom != null && !(a.zoom >= 0 && a.zoom <= 0.3)) err(`${where}: zoom should be 0-0.3`);
  if (a.slowmo != null && a.slowmo !== true && !(a.slowmo > 0 && a.slowmo < 1)) err(`${where}: slowmo should be true or 0-1`);
  if (a.size != null && !(a.size > 0 && a.size <= 3)) err(`${where}: size should be 0-3`);
  if (a.style && MB.FX.duoStyles.includes(a.style) && !duo) warn(`${where}: "${a.style}" is a duo style; on a single character both partners are the same sprite`);
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
  if (c.abilitySfx && !SFX.includes(c.abilitySfx)) err(`${at}: unknown abilitySfx "${c.abilitySfx}"`);
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
  if (p.sfx && !SFX.includes(p.sfx)) err(`${at}: unknown sfx "${p.sfx}"`);
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
    else if (cos && c.costumes.find((o) => o.id === cos).nsfw && !c.nsfw) warn(`${at}: ${id}'s costume "${cos}" is NSFW; pick a safe one`);
  });
  if (!MB.BOND_TIERS[b.tier]) err(`${at}: unknown tier ${b.tier}`);
  checkAttack(at, b.attack, true);
  if (b.onFuse) checkSpec(`${at} onFuse`, b.onFuse, { trigger: 'onFuse' });
  (b.kw || []).forEach((k) => { if (!MB.KEYWORDS[k]) err(`${at}: unknown keyword ${k}`); });
  const sc = MB.BOND_SCENES[b.id];
  if (!sc) err(`${at}: no close-up scene in MB.BOND_SCENES`);
  else {
    if (!SCENES[sc.kind]) err(`${at}: unknown scene kind "${sc.kind}"`);
    else if (sc.scene && !MB.Cards.sceneVariants[sc.kind].includes(sc.scene)) err(`${at}: ${sc.kind} has no scene "${sc.scene}" (${MB.Cards.sceneVariants[sc.kind].join(', ') || 'none'})`);
    if (!Array.isArray(sc.lines) || sc.lines.length < 2) err(`${at}: scene needs at least two lines`);
    else sc.lines.forEach((l, i) => {
      const text = l && typeof l === 'object' ? l.text : l;
      if (typeof text !== 'string' || !text) err(`${at}: line ${i + 1} should be text or { by: 0|1, text }`);
      else if (text.length > 40) warn(`${at}: line ${i + 1} is long for a speech bubble (${text.length} chars)`);
    });
    [].concat(sc.backdrop || []).forEach((n) => { if (!MB.Cards.backdrops.includes(n)) err(`${at}: unknown backdrop "${n}" (${MB.Cards.backdrops.join(', ')})`); });
    if (sc.emoji && !Array.isArray(sc.emoji)) err(`${at}: scene emoji must be a list`);
    if (sc.kind === 'family' && sc.scene === 'strict' && !(sc.score && Array.isArray(sc.drill) && sc.praise)) err(`${at}: a strict scene needs score, drill and praise`);
  }
}
Object.keys(MB.BOND_SCENES).forEach((id) => { if (!bondIds.has(id)) warn(`scene ${id}: no bond with this id`); });
// item combos
const comboKeys = new Set();
MB.COMBOS.forEach((c) => {
  const at = `combo ${c.id}`, ch = chars.get(c.char);
  if (!ch || !MB.CARDS[c.char] || MB.CARDS[c.char].type) return err(`${at}: ${c.char} isn't a character card`);
  c.items.forEach((id) => {
    if (!MB.CARDS[id] || MB.CARDS[id].type !== 'spell') err(`${at}: ${id} isn't an item card`);
    if (comboKeys.has(c.char + '+' + id)) err(`${at}: ${c.char} + ${id} is listed twice`);
    comboKeys.add(c.char + '+' + id);
  });
  if (!c.name || !c.short) err(`${at}: needs a name and a short name`);
  else if (c.short.length > 12) warn(`${at}: short name "${c.short}" is long for the board plate`);
  if (c.costume && !ch.costumes.some((o) => o.id === c.costume)) err(`${at}: ${c.char} has no costume "${c.costume}" (has: ${ch.costumes.map((o) => o.id).join(', ') || 'none'})`);
  else if (c.costume && ch.costumes.find((o) => o.id === c.costume).nsfw) warn(`${at}: costume "${c.costume}" is NSFW; pick a safe one`);
  if (!Array.isArray(c.bonus) || c.bonus.length !== 2) err(`${at}: bonus should be [atk, hp]`);
  (c.kw || []).forEach((k) => { if (!MB.KEYWORDS[k]) err(`${at}: unknown keyword ${k}`); });
  if (c.onCombo) checkSpec(`${at} onCombo`, c.onCombo, { trigger: 'onCombo' });
  if (!c.text) err(`${at}: no text`);
});
Object.entries(MB.HIDDEN_COSTUMES).forEach(([id, list]) => list.forEach((o) => {
  if (!chars.get(id) || !chars.get(id).costumes.some((x) => x.id === o)) warn(`hidden costume ${id}/${o} doesn't exist`);
}));

const bgNames = new Set(M.backgrounds.map((b) => b.name.trim().toLowerCase())), music = new Set(M.music.map((m) => m.id));
MB.STORY.forEach((s, i) => {
  const at = `story ${i} (${s.foe})`;
  if (MB.CHAPTERS[s.chapter] && MB.CHAPTERS[s.chapter].hidden) return; // NSFW mode off
  if (!chars.has(s.foe)) err(`${at}: unknown foe`);
  if (!bgNames.has(s.bg.trim().toLowerCase())) err(`${at}: no background named "${s.bg}"`);
  if (!music.has(s.music)) err(`${at}: no music "${s.music}"`);
  if (!MB.CHAPTERS[s.chapter]) err(`${at}: chapter ${s.chapter} has no MB.CHAPTERS entry`);
  if (!s.intro) err(`${at}: no intro`);
});
MB.CHAPTERS.forEach((c, i) => { if (!MB.STORY.some((s) => s.chapter === i)) err(`chapter ${i} (${c.title}) has no stages`); });

// ---------------------------------------------------------------- the story (js/story.js)
const St = MB.Story, questIds = new Set(), FX = ['flash', 'shake', 'rift'];
MB.ACTS.forEach((A, a) => {
  if (!A.title || !A.map || !(A.w > 0 && A.h > 0) || !(A.size >= 1600) || A.size * A.h / A.w < 900) err(`act ${a}: needs title, map, w/h and a size that fills the screen`);
  if (!music.has(A.music) || !bgNames.has(A.bg.trim().toLowerCase())) err(`act ${a}: unknown music "${A.music}" or background "${A.bg}"`);
});
const inMap = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => v >= 0 && v <= 100);
St.quests.forEach((q) => {
  const at = `quest ${q.id}`;
  if (questIds.has(q.id)) err(`${at}: duplicate id`);
  questIds.add(q.id);
  if (!q.title || !q.text) err(`${at}: needs title and text`);
  if (!inMap(q.at) || (q.via || []).some((v) => !inMap(v))) err(`${at}: at/via must be [x, y] in % of the map`);
  if (q.foe && q.stage < 0) err(`${at}: ${q.foe} has no stage in MB.STORY`);
  if (!q.foe && !q.scene) err(`${at}: a quest without a fight needs a scene`);
  if (q.foe && q.scene) err(`${at}: a fight has before/after scenes, not scene`);
  if (q.side ? !St.byId(q.from) : q.from) err(`${at}: ${q.side ? `side quest from unknown quest "${q.from}"` : 'main quests follow the story, no "from"'}`);
  if (q.side && St.byId(q.from) && St.byId(q.from).act !== q.act) err(`${at}: opens from a quest in another act`);
  if (q.main && St.hidden(q)) err(`${at}: the main story can't go through an NSFW chapter`);
  if (St.hidden(q)) return;
  ['before', 'after', 'scene'].forEach((part) => {
    const sc = St.sceneOf(q, part);
    if (!sc) return;
    const where = `${at} ${part}`;
    if (!bgNames.has(sc.bg.trim().toLowerCase())) err(`${where}: no background "${sc.bg}"`);
    if (!music.has(sc.music)) err(`${where}: no music "${sc.music}"`);
    if (!sc.lines.length) err(`${where}: no lines`);
    sc.lines.map(St.lineOf).forEach((l, k) => {
      const w = `${where} line ${k + 1}`;
      if (!l.text) {
        const keys = Object.keys(l);
        if (!keys.length || keys.some((x) => !['bg', 'music', 'fx', 'sfx', 'hide'].includes(x))) err(`${w}: unknown stage direction ${JSON.stringify(l)}`);
        if (l.bg && !bgNames.has(l.bg.trim().toLowerCase())) err(`${w}: no background "${l.bg}"`);
        if (l.music && !music.has(l.music)) err(`${w}: no music "${l.music}"`);
        if (l.sfx && !SFX.includes(l.sfx)) err(`${w}: no sound "${l.sfx}"`);
        if (l.fx && !FX.includes(l.fx)) err(`${w}: unknown fx "${l.fx}"`);
        if (l.hide && !chars.has(l.hide)) err(`${w}: hides unknown ${l.hide}`);
        return;
      }
      if (l.who !== '*' && l.who !== 'you' && !chars.has(l.who)) err(`${w}: unknown speaker ${l.who}`);
      if (l.mood && !St.MOODS[l.mood]) err(`${w}: unknown mood "${l.mood}"`);
      if (typeof l.text !== 'string') err(`${w}: text must be a string`);
      if (l.text.length > 190) warn(`${w}: ${l.text.length} characters, may not fit the text box`);
    });
  });
});
MB.STORY.forEach((st, i) => {
  const n = St.quests.filter((q) => q.stage === i).length;
  if (n !== 1) err(`story ${i} (${st.foe}): in ${n} quests, needs exactly one`);
  if (!(st.hp >= 15 && st.hp <= 50) || !(st.ai > 0 && st.ai <= 1)) err(`story ${i} (${st.foe}): level hp ${st.hp} ai ${st.ai}`);
});
{ // playing the whole story: the main quests in order, every side quest as it opens; one Epic pack per act
  const s = { quests: [], storyActs: [], packs: { epic: 0 } };
  for (let k = 0; k < 1000; k++) {
    const q = St.next(s) || St.quests.find((x) => !St.hidden(x) && St.isOpen(s, x) && !St.isDone(s, x));
    if (!q) break;
    if (!St.isOpen(s, q)) { err(`story: ${q.id} is next but not open`); break; }
    const r = St.complete(s, q.id);
    if (!r.first) { err(`story: completing ${q.id} did nothing`); break; }
    St.quests.filter((x) => x.side && St.isOpen(s, x) && !St.isDone(s, x)).forEach((x) => St.complete(s, x.id));
  }
  const left = St.quests.filter((q) => !St.hidden(q) && !St.isDone(s, q));
  if (left.length) err(`story: never opened ${left.map((q) => q.id).join(', ')}`);
  if (s.packs.epic !== MB.ACTS.length || s.storyActs.length !== MB.ACTS.length) err(`story: ${s.packs.epic} act packs for ${MB.ACTS.length} acts`);
  if (St.complete(s, St.main[0].id).first || s.packs.epic !== MB.ACTS.length) err('story: a quest completed twice');
  // an old save (cleared stages counted per chapter) keeps its cleared rivals as done quests
  const old = { progress: MB.CHAPTERS.map((c, i) => (i === 0 ? 3 : i === 8 ? 10 : 0)) };
  St.migrate(old);
  const want = [...MB.STORY.slice(0, 3).map((st) => st.foe), ...MB.STORY.filter((st) => st.chapter === 8).map((st) => st.foe)];
  if (old.progress || !want.every((id) => old.quests.includes(id)) || old.quests.length !== want.length) err(`story: migrating an old save gave ${JSON.stringify(old.quests)}`);
}
MB.STARTER_DECK.forEach((id) => { if (!MB.CARDS[id]) err(`starter deck: unknown card ${id}`); });
MB.STARTER_LEADERS.forEach((id) => { if (!MB.POWERS[id]) err(`starter leader ${id} has no power`); });

// ---------------------------------------------------------------- our own songs
const songIds = new Set();
MB.SONGS.forEach((s) => {
  const at = `song ${s.id}`;
  if (songIds.has(s.id)) err(`${at}: duplicate id`);
  songIds.add(s.id);
  if (M.music.filter((m) => m.id === s.id).length > 1) err(`${at}: a miku.gg track already has this id`);
  if (!s.name) err(`${at}: needs a name`);
  if (!s.file || !fs.existsSync(path.join(GAME, 'assets', 'music', s.file))) err(`${at}: no file game/assets/music/${s.file}`);
  // (with --sfw the NSFW characters are gone, so only the full run checks the names)
  (s.foes || []).forEach((id) => { if (!chars.has(id) && !SFW) err(`${at}: unknown foe ${id}`); });
});
(MB.SONGS.flatMap((s) => s.foes || [])).forEach((id, i, all) => { if (all.indexOf(id) !== i) warn(`${id} has more than one theme song; the first one plays`); });

// ---------------------------------------------------------------- item novels, rival decks
Object.entries(MB.ITEM_NOVELS).forEach(([n, ids]) => {
  if (!M.novels.includes(n) && !(M.nsfwNovels || []).includes(n)) err(`MB.ITEM_NOVELS: no novel named "${n}"`);
  if (M.novels.includes(n)) ids.forEach((id) => { if (!M.items.some((i) => i.id === id)) err(`MB.ITEM_NOVELS["${n}"]: no item ${id} in the manifest`); });
});
MB.itemCards().forEach((id) => { if (!MB.novelOf(id)) warn(`item card ${id} has no novel in MB.ITEM_NOVELS`); });
const homeShare = [];
MB.STORY.forEach((st) => {
  if (!chars.has(st.foe)) return;
  for (let k = 0; k < 5; k++) {
    const d = MB.AI.deck(st.foe), at = `rival deck of ${st.foe}`;
    if (d.length !== MB.RULES.deckSize) err(`${at}: ${d.length} cards`);
    if (d.includes(st.foe)) err(`${at}: holds the rival's own card`);
    d.forEach((id) => {
      if (!MB.CARDS[id] || MB.CARDS[id].token) err(`${at}: can't hold ${id}`);
      const max = MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2;
      if (d.filter((x) => x === id).length > max) err(`${at}: too many ${id}`);
    });
    homeShare.push(d.filter((id) => MB.novelOf(id) === MB.novelOf(st.foe)).length);
  }
});

// ---------------------------------------------------------------- packs, fragments, profile pictures
const pick = (a) => a[Math.random() * a.length | 0];
const C = MB.Collection;
Object.entries(MB.PACKS).forEach(([t, p]) => p.slots.forEach((slot) => {
  if (!MB.SHARD_DROP[slot]) err(`pack ${t}: slot "${slot}" has no MB.SHARD_DROP amount`);
  if (slot !== 'card' && !MB.RARITY[slot]) err(`pack ${t}: unknown slot rarity "${slot}"`);
}));
['rare', 'epic', 'legendary'].forEach((r) => { if (!(MB.RARITY[r].shards >= 1)) err(`rarity ${r}: needs a shards count`); });
MB.AVATARS.forEach((a) => { if (a.id !== MB.STARTER_AVATAR && C.avatarStage[a.id] == null) err(`profile picture ${a.id} isn't won anywhere in Story`); });
// open packs from a fresh save until everything is unlocked, checking every result
const packRuns = [];
for (let run = 0; run < 100; run++) {
  const s = { unlocked: MB.STARTER_CARDS.slice(), shards: {} };
  let n = 0;
  while (C.locked(s).length && n < 1000) {
    const tier = pick(['common', 'common', 'common', 'rare', 'epic']);
    const got = C.openPack(s, tier);
    n++;
    got.forEach((g) => {
      if (!(g.to > g.from && g.to <= g.need)) err(`pack ${tier}: bad fragments ${JSON.stringify(g)}`);
      if (g.done !== s.unlocked.includes(g.card)) err(`pack ${tier}: ${g.card} done=${g.done} but unlocked=${s.unlocked.includes(g.card)}`);
    });
    if (!got.length) err(`pack ${tier}: empty while cards are still locked`);
    if (Object.entries(s.shards).some(([id, k]) => s.unlocked.includes(id) || k >= C.need(id))) err('fragments left on an unlocked or complete card');
  }
  if (C.locked(s).length) err(`packs: collection still incomplete after ${n} packs`);
  packRuns.push(n);
  if (errors.length > 20) break;
}
const packAvg = packRuns.reduce((a, b) => a + b, 0) / packRuns.length;
if (packAvg > 250) warn(`packs: ${packAvg.toFixed(0)} packs on average to complete the collection`);

// ---------------------------------------------------------------- boss rules
Object.entries(MB.BOSSES).forEach(([foe, b]) => {
  const at = `boss ${foe}`, i = MB.STORY.findIndex((s) => s.foe === foe);
  if (i < 0) { if (!SFW) err(`${at}: not a Story foe`); return; }
  if (!b.name || !b.text || !(b.every >= 1) || !b.color) err(`${at}: needs name, text, every and color`);
  checkSpec(`${at} rule`, b.effect, {});
  if (b.rage) { if (!b.rage.name || !b.rage.text) err(`${at} rage: needs name and text`); checkSpec(`${at} rage`, b.rage.effect, {}); }
});
MB.CHAPTERS.forEach((c, i) => {
  if (!c.hidden && !MB.STORY.some((s) => s.chapter === i && MB.BOSSES[s.foe])) warn(`chapter ${i} (${c.title}) has no boss`);
});
const bossFoes = Object.keys(MB.BOSSES).filter((id) => chars.has(id) && MB.POWERS[id]);
const bossStats = { battles: 0, fired: 0, raged: 0, won: 0 };

// ---------------------------------------------------------------- daily missions, Glitter
const Ms = MB.Missions;
Object.entries(MB.MISSIONS).forEach(([id, t]) => {
  if (!t.text || !(t.n > 0) || !(t.glitter > 0) || typeof t.count !== 'function') err(`mission ${id}: needs text, n, glitter and count`);
  if (t.text.includes('{novel}') !== !!t.novel) err(`mission ${id}: "{novel}" in the text goes with a novel kind`);
});
// a fresh save and a finished one both get a full day of different missions, with their texts filled in
const saveOf = (unlocked) => ({ unlocked: unlocked.slice(), leaders: MB.STARTER_LEADERS.slice(), shards: {}, glitter: 0, shiny: [], missions: null });
for (const unlocked of [MB.STARTER_CARDS, C.deckCards()]) for (let k = 0; k < 40; k++) {
  const s = saveOf(unlocked);
  Ms.daily(s, 'day' + k);
  const ids = s.missions.list.map((m) => m.id);
  if (ids.length !== Ms.PER_DAY) err(`missions: ${ids.length} rolled instead of ${Ms.PER_DAY}`);
  if (new Set(ids).size !== ids.length) err(`missions: the same mission twice (${ids})`);
  s.missions.list.forEach((m) => { if (/[{}]/.test(Ms.text(m))) err(`mission text not filled in: ${Ms.text(m)}`); });
  if (Ms.daily(s, 'day' + k)) err('missions: rolled twice on one day');
  if (!Ms.reroll(s, 0) || Ms.reroll(s, 1)) err('missions: one reroll a day');
}
{ // crafting a whole legendary, then its Shiny finish; Glitter never goes negative
  const s = saveOf(MB.STARTER_CARDS), id = C.locked(s).find((x) => MB.CARDS[x].rarity === 'legendary'), per = MB.GLITTER.craft.legendary;
  s.glitter = per * 3 + 5;
  const a = Ms.craft(s, id);
  if (!a || a.to !== 3 || s.glitter !== 5 || a.done) err(`crafting: partial craft went wrong ${JSON.stringify(a)} glitter ${s.glitter}`);
  s.glitter = 10000;
  const b = Ms.craft(s, id);
  if (!b || !b.done || !s.unlocked.includes(id) || s.glitter !== 10000 - per * (C.need(id) - 3)) err('crafting: finishing a card went wrong');
  if (Ms.craftCost(s, id) !== null || Ms.craft(s, id)) err('crafting: an owned card can still be crafted');
  if (!Ms.makeShiny(s, id) || Ms.makeShiny(s, id) || !s.shiny.includes(id)) err('shiny: should work once');
  if (Ms.craftCost(s, MB.STARTER_CARDS[0]) !== null) err('crafting: commons are owned from the start');
}
{ // Story stars: three per stage, paid once each; a fully starred chapter pays one Epic pack
  const S = MB.Stars, s = { stars: {}, starChapters: [], glitter: 0, packs: { epic: 0 } };
  MB.STORY.forEach((st, i) => {
    const list = S.starsOf(i);
    if (list.length !== 3 || list.some((x) => !x || !x.text || typeof x.ok !== 'function')) err(`stage ${i}: needs three stars with text and ok()`);
  });
  const perfect = { won: true, hp: 30, difficulty: 'normal', tally: { items: 0, powers: 0, turns: 5, kills: 9, lost: 0, bonds: 1 } };
  if (S.starsWon(0, { ...perfect, difficulty: 'easy' }) !== 0 || S.starsWon(0, { ...perfect, won: false }) !== 0) err('stars: Easy or a loss gives stars');
  const ch0 = MB.STORY.map((st, i) => i).filter((i) => MB.STORY[i].chapter === 0);
  ch0.forEach((i) => S.awardStars(s, i, perfect));
  if (s.glitter !== ch0.length * 3 * MB.GLITTER.star || s.packs.epic !== 1 || !s.starChapters.includes(0)) err(`stars: a perfect chapter paid ${s.glitter} Glitter and ${s.packs.epic} packs`);
  S.awardStars(s, ch0[0], perfect);
  if (s.packs.epic !== 1 || s.glitter !== ch0.length * 3 * MB.GLITTER.star) err('stars: paid twice for the same stars');
}
// ---------------------------------------------------------------- arena
const Ar = MB.Arena;
const arenaDraft = () => { // a whole draft, picking at random; returns { leader, deck }
  const s = { arena: null, glitter: 0, packs: { common: 0, rare: 0, epic: 0 }, arenaBest: 0, arenaRuns: 0 };
  const a = Ar.start(s);
  if (a.leaders.length !== 3 || new Set(a.leaders).size !== 3) err(`arena: leaders ${a.leaders}`);
  Ar.chooseLeader(s, pick(a.leaders));
  for (let k = 0; k < 60 && a.stage === 'draft'; k++) {
    if (a.offer.length !== 3 || new Set(a.offer).size !== 3) err(`arena: offer ${a.offer}`);
    if (a.offer.some((id) => !MB.CARDS[id] || MB.CARDS[id].token || id === a.leader)) err(`arena: bad offer ${a.offer}`);
    Ar.pick(s, pick(a.offer));
  }
  if (a.stage !== 'run' || a.deck.length !== MB.RULES.deckSize) err(`arena: draft ended at ${a.stage} with ${a.deck.length} cards`);
  a.deck.forEach((id) => { const max = MB.CARDS[id].copies || MB.RARITY[MB.CARDS[id].rarity].copies || 2; if (a.deck.filter((x) => x === id).length > max) err(`arena: too many ${id}`); });
  if (!Ar.valid(a)) err('arena: a fresh run fails valid()');
  return { s, leader: a.leader, deck: a.deck.slice() };
};
for (let k = 0; k < 200 && errors.length < 20; k++) arenaDraft();
{ // a run to the end pays out once and clears the run
  const { s } = arenaDraft();
  for (let k = 0; k < 20 && s.arena.stage === 'run'; k++) Ar.result(s, k % 3 !== 2);
  if (s.arena.stage !== 'done') err('arena: run never ends');
  const r = Ar.finish(s);
  if (!r || s.arena || s.glitter !== MB.ARENA.rewards(r.wins).glitter || s.arenaBest !== r.wins || Ar.finish(s)) err(`arena: finishing went wrong ${JSON.stringify(r)}`);
}
const tallies = []; // { tally, won, leader, deck, hp } of the AI battles below, to see how long each mission takes

// ---------------------------------------------------------------- AI vs AI
const combosSeen = new Map(); // combo id -> how often it happened in the AI battles
const viewStub = new Proxy({}, {
  get: (_, name) => (...args) => {
    const fn = args.find((a) => typeof a === 'function');
    if (name === 'fuse') { const u = args[2]; return Promise.resolve(u); }
    if (name === 'combo') combosSeen.set(args[1].id, (combosSeen.get(args[1].id) || 0) + 1);
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
    const bossy = bossFoes.length && i % 3 === 0, foe = bossy ? pick(bossFoes) : pick(leaders); // every 3rd battle is against a boss
    const drafted = i % 5 === 1 ? arenaDraft() : null; // every 5th battle is played with an Arena draft
    const deck = drafted ? drafted.deck : randomDeck();
    const b = new MB.Battle({ view: viewStub, playerLeader: drafted ? drafted.leader : pick(leaders), enemyLeader: foe, playerDeck: deck, enemyDeck: MB.AI.deck(foe), boss: bossy ? MB.BOSSES[foe] : null });
    b.aiSkill = Math.random();
    try {
      await b.start();
      for (let g = 0; g < 120 && !b.over; g++) await MB.AI.takeTurn(b, 0);
      turns += b.turn; done++;
      if (bossy) { bossStats.battles++; bossStats.fired += b.bossTurns >= b.boss.every ? 1 : 0; bossStats.raged += b.raged ? 1 : 0; bossStats.won += b.winner === 1 ? 1 : 0; }
      tallies.push({ tally: b.tally, won: b.winner === 0, leader: b.me(0).leaderId, deck, hp: b.me(0).leader.hp });
    } catch (e) {
      const key = (e.stack || String(e)).split('\n').slice(0, 3).join(' | ');
      failures.set(key, (failures.get(key) || 0) + 1);
    }
  }
  failures.forEach((n, key) => err(`battle crashed ${n}x: ${key}`));

  // how often the AI's wins would earn each star: a challenge nobody meets isn't fun
  const wins = tallies.filter((x) => x.won);
  const starPace = [['hp', { text: 'hp', ok: (r) => r.hp >= MB.Stars.HP_STAR }], ...Object.entries(MB.Stars.CHALLENGES)].map(([id, c]) => {
    const pct = wins.length ? Math.round((wins.filter((x) => c.ok({ ...x, tally: { novel: {}, ...x.tally } })).length / wins.length) * 100) : 0;
    if (wins.length > 30 && (pct < 10 || pct > 90)) warn(`star ${id}: met in ${pct}% of wins; aim for 10-90%`);
    return `${id} ${pct}%`;
  });

  // how many battles each mission takes, replaying the battles above in random order (AI decks lean on one novel,
  // like a player's). A novel mission is played the way a player would: with a leader / a deck from that novel.
  // A mission that takes too long isn't fun as a daily.
  // missions a player builds for: a deck holding a combo's pair / a relationship's pair
  const PLAYS = {
    combos: (x) => MB.COMBOS.some((c) => x.deck.includes(c.char) && c.items.some((i) => x.deck.includes(i))),
    bonds: (x) => MB.BONDS.some((bd) => bd.pair.every((id) => x.deck.includes(id))),
  };
  const topNovel = (x) => Object.entries(x.tally.novel).sort((a, b) => b[1] - a[1]).map(([nv]) => nv)[0];
  const missionPace = Object.entries(MB.MISSIONS).map(([id, t]) => {
    let total = 0;
    for (let k = 0; k < 200 && tallies.length; k++) {
      const novel = t.novel === 'leader' ? MB.novelOf(pick(tallies).leader) : t.novel ? topNovel(pick(tallies)) : undefined;
      const fits = t.novel === 'leader' ? tallies.filter((x) => MB.novelOf(x.leader) === novel) : t.novel ? tallies.filter((x) => topNovel(x) === novel)
        : PLAYS[id] ? tallies.filter(PLAYS[id]) : tallies;
      const m = { id, n: t.n, have: 0, glitter: t.glitter, novel };
      const s = { missions: { list: [m] } };
      let n = 0;
      while (!Ms.done(m) && n < 60) { const x = pick(fits); Ms.progress(s, x.tally, { leader: x.leader, difficulty: 'normal' }, x.won); n++; }
      total += n;
    }
    const avg = total / 200;
    if (id !== 'winHard' && avg > 8) warn(`mission ${id} takes ${avg.toFixed(1)} battles on average; make it smaller`);
    return `${id} ${id === 'winHard' ? 'n/a' : avg.toFixed(1)}`; // the AI battles here are all on Normal
  });

  if (TEXTS) {
    const isSpec = (x) => x && typeof x === 'object';
    Object.entries(MB.CARDS).filter(([, c]) => isSpec(c.effect) || TRIGGERS.some((t) => isSpec(c[t]))).forEach(([id, c]) => console.log(`card  ${id}: ${c.text}`));
    Object.entries(MB.POWERS).filter(([, p]) => isSpec(p.effect)).forEach(([id, p]) => console.log(`power ${id} (${p.name}, ${p.cost}): ${p.text}`));
    MB.BONDS.filter((b) => isSpec(b.onFuse)).forEach((b) => console.log(`bond  ${b.id}: ${b.text}`));
  }
  warnings.forEach((w) => console.log('warn  ' + w));
  errors.forEach((e) => console.log('ERROR ' + e));
  console.log(`\n${M.characters.length} characters, ${Object.keys(MB.CARDS).length} cards, ${MB.BONDS.length} bonds, ${MB.STORY.length} story stages`);
  console.log(`combos: ${[...combosSeen.values()].reduce((a, b) => a + b, 0)} in the battles, ${combosSeen.size}/${MB.COMBOS.length} different`);
  console.log(`missions, battles to finish on average: ${missionPace.join(", ")}`);
  console.log(`boss battles: ${bossStats.battles}, rule went off in ${bossStats.fired}, rage in ${bossStats.raged}, boss won ${bossStats.won}`);
  console.log(`stars, share of wins that earn them: ${starPace.join(", ")}`);
  console.log(`rival decks: avg ${(homeShare.reduce((a, b) => a + b, 0) / homeShare.length).toFixed(1)}/${MB.RULES.deckSize} cards from their own novel, ${Math.min(...homeShare)}-${Math.max(...homeShare)}`);
  console.log(`packs to complete the collection from scratch: avg ${packAvg.toFixed(1)}, ${Math.min(...packRuns)}-${Math.max(...packRuns)}`);
  console.log(`${done}/${BATTLES} battles finished (avg ${(turns / Math.max(1, done)).toFixed(1)} turns); ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
})();
