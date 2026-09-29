// Regression checks for starting cards, save migration and NSFW defaults. Run: node tools/check_save.js
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const GAME = path.join(__dirname, '..', 'game');
const files = ['js/config.js', 'assets/manifest.js', 'js/avatars.js', 'js/data.js', 'js/content.js', 'js/story.js',
  'js/collection.js', 'js/missions.js', 'js/arena.js', 'js/effects.js', 'js/engine.js', 'js/ui.js'];
const sources = new Map(files.map((f) => [f, fs.readFileSync(path.join(GAME, f), 'utf8')]));
const plain = (x) => JSON.parse(JSON.stringify(x));
const noop = () => {};

function load(stored = {}, seed = 1) {
  const storage = new Map(Object.entries(stored)), nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { style: {}, classList: { contains: () => false, add: noop, remove: noop, toggle: noop } });
    return nodes.get(id);
  };
  const math = Object.create(Math);
  math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const context = {
    console, Math: math, URLSearchParams, setTimeout: noop, clearTimeout: noop, addEventListener: noop,
    document: { querySelector: node, querySelectorAll: () => [], addEventListener: noop, body: node('body') },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    location: { search: '', protocol: 'https:', hostname: 'example.test', reload: () => context.reloads++ },
    confirm: () => true, reloads: 0, rolls: 0,
  };
  context.window = context;
  vm.createContext(context);
  for (const f of files) {
    if (f === 'js/ui.js') {
      const roll = context.MB.Collection.starterDeck;
      context.MB.Collection.starterDeck = (...args) => { context.rolls++; return roll(...args); };
    }
    vm.runInContext(sources.get(f), context, { filename: f });
  }
  return Object.assign(context, { storage, nodes, save: context.MB.UI.save });
}

const first = load();
assert.equal(first.MB.NSFW, false, 'NSFW must default off');
assert.equal(first.rolls, 1, 'a new save rolls once');
assert.equal(first.save.version, 11);
assert.deepEqual(plain(first.save.deck), plain(first.save.starterDeck));
assert.deepEqual(plain(first.save.unlocked).sort(), [...new Set(first.save.deck)].sort(), 'only the rolled cards start unlocked');
assert.ok(first.save.decks.every((d) => JSON.stringify(d.cards) === JSON.stringify(first.save.starterDeck)), 'every initial deck slot uses the roll');

const repeat = load(Object.fromEntries(first.storage), 99);
assert.equal(repeat.rolls, 0, 'reload must not roll more cards');
assert.deepEqual(plain(repeat.save.starterDeck), plain(first.save.starterDeck));
assert.deepEqual(plain(repeat.save.unlocked), plain(first.save.unlocked), 'reload must not grant the fixed starter cards');
assert.deepEqual(plain(repeat.save.deck), plain(first.save.deck));

const next = load({}, 99);
assert.notDeepEqual(plain(next.save.starterDeck), plain(first.save.starterDeck), 'new games vary');
const stale = load({ 'mb-nsfw': '1' });
assert.equal(stale.MB.NSFW, false, 'a stale preference cannot enable NSFW for a new game');
assert.equal(load(Object.fromEntries(stale.storage)).MB.NSFW, false, 'refresh cannot restore a stale opt-in');
const adult = load({ ...Object.fromEntries(first.storage), 'mb-nsfw': '1' });
assert.equal(adult.MB.NSFW, true, 'existing saves remember an explicit opt-in');
assert.deepEqual(plain(adult.save.starterDeck), plain(first.save.starterDeck), 'changing content mode keeps the roll');

// Exercise the real settings reset handler in NSFW mode: it must clear the save, turn NSFW off and reload
// before a new starting deck is rolled from the filtered content.
Object.assign(adult.MB, {
  audio: { sfx: noop, settings: { music: 0.5, sfx: 0.5 } },
  MenuTips: { bind: noop }, Cards: { bind: noop }, StoryMap: { bind: noop }, Tutorial: { bind: noop },
});
adult.MB.UI.bind();
assert.equal(adult.nodes.get('#nsfw-mode').checked, true);
adult.nodes.get('#save-reset').onclick();
assert.equal(adult.storage.has('mb-save'), false);
assert.equal(adult.storage.get('mb-nsfw'), '0');
assert.equal(adult.reloads, 1);
const reset = load(Object.fromEntries(adult.storage), 99);
assert.equal(reset.MB.NSFW, false);
assert.notDeepEqual(plain(reset.save.starterDeck), plain(first.save.starterDeck));

const legacyCards = plain(first.MB.STARTER_DECK);
const legacy = load({ 'mb-save': JSON.stringify({ version: 10, decks: [{ cards: legacyCards }],
  unlocked: [...new Set(legacyCards), 'hayley-kate'], glitter: 123, levels: { 'james-lone': 3 } }) });
assert.equal(legacy.rolls, 0);
assert.deepEqual(plain(legacy.save.starterDeck), legacyCards, 'existing saves keep the original starter');
assert.deepEqual(plain(legacy.save.deck), legacyCards);
assert.equal(legacy.save.glitter, 123);
assert.equal(legacy.save.levels['james-lone'], 3);
assert.ok(legacy.save.unlocked.includes('hayley-kate'));
const old = load({ 'mb-save': JSON.stringify({ deck: legacyCards, story: 3 }) });
assert.deepEqual(plain(old.save.deck), legacyCards);
assert.ok(old.MB.STORY.slice(0, 3).every((st) => old.save.unlocked.includes(st.foe)), 'unversioned saves retain earned cards');

const damaged = plain(first.save);
damaged.decks[0].cards = ['missing-card'];
const repaired = load({ 'mb-save': JSON.stringify(damaged) });
assert.deepEqual(plain(repaired.save.deck), plain(first.save.starterDeck), 'deck repairs use the saved roll');

// Many seeded rolls in both content modes: valid commons, legal copies, and enough low-cost cards for the lesson.
for (const game of [first, adult]) {
  const variants = new Set();
  for (let seed = 1; seed <= 250; seed++) {
    const deck = game.MB.Collection.starterDeck(game.MB.rng(seed));
    assert.equal(deck.length, game.MB.RULES.deckSize);
    assert.equal(new Set(deck).size, game.MB.STARTER_CARDS.length);
    deck.forEach((id, i) => {
      const card = game.MB.CARDS[id], template = game.MB.CARDS[game.MB.STARTER_DECK[i]];
      assert.ok(card && !card.token && card.rarity === 'common');
      assert.equal(card.cost, template.cost);
      assert.equal(card.type || 'unit', template.type || 'unit');
      assert.ok(deck.filter((x) => x === id).length <= (card.copies || game.MB.RARITY.common.copies));
      assert.equal(game.MB.HIDDEN_CARDS.has(id), false);
    });
    variants.add(JSON.stringify(deck));
  }
  assert.ok(variants.size > 200, 'starting selections should vary across seeds');
}
console.log('Save checks passed: 500 starter rolls, persistence, migration, deck repair and NSFW defaults/reset.');
