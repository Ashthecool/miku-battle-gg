#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const modeFlag = args.indexOf('--mode');
const mode = modeArg ? modeArg.slice('--mode='.length) : modeFlag >= 0 ? args[modeFlag + 1] : 'both';
const positional = args.filter((arg, i) => !arg.startsWith('--') && i !== modeFlag + 1);
const savePath = positional[0];
const actQuery = positional.slice(1).join(' ');

function usage() {
  console.error('Usage: node inspect-save.js <save.json> [act name or id] [--mode sfw|nsfw|both]');
  process.exit(2);
}

if (!savePath || !['sfw', 'nsfw', 'both'].includes(mode)) usage();

const repo = path.resolve(__dirname, '..', '..', '..', '..');
const game = path.join(repo, 'game');
const saveFile = path.resolve(process.cwd(), savePath);
let exported;
try {
  exported = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
} catch (error) {
  console.error(`Could not read save JSON at ${saveFile}: ${error.message}`);
  process.exit(1);
}

if (exported.game && exported.game !== 'miku-battle') {
  console.error(`This is a "${exported.game}" export, not a Miku Battle save.`);
  process.exit(1);
}

const save = exported.save || exported;
if (!save || typeof save !== 'object' || (!Array.isArray(save.quests) && !Array.isArray(save.progress))) {
  console.error('Save has neither a quests list nor legacy progress data.');
  process.exit(1);
}

function loadGame(nsfw) {
  const noop = () => {};
  const sandbox = {
    console, Math, JSON, Promise, Set, Map, Object, Array, String, Number, Boolean, Error,
    performance: { now: () => Date.now() },
    setTimeout: (fn) => setImmediate(fn),
    clearTimeout: noop,
    document: {
      readyState: 'loading',
      addEventListener: noop,
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({ style: {} }),
    },
    gsap: new Proxy({}, { get: () => noop }),
    addEventListener: noop,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  for (const file of [
    'js/config.js',
    'assets/manifest.js',
    'js/avatars.js',
    'js/data.js',
    'js/anon.js',
    'js/content.js',
    'js/story.js',
  ]) {
    if (file === 'js/content.js') sandbox.MB.NSFW = nsfw;
    const fullPath = path.join(game, file);
    vm.runInContext(fs.readFileSync(fullPath, 'utf8'), sandbox, { filename: file });
  }
  return sandbox.MB;
}

function findAct(MB) {
  if (!actQuery) return MB.ACTS;
  const matches = MB.ACTS.filter((act) => act.id.toLowerCase() === actQuery.toLowerCase()
    || act.title.toLowerCase() === actQuery.toLowerCase());
  if (matches.length !== 1) {
    const available = MB.ACTS.map((act) => `${act.title} (${act.id})`).join(', ');
    console.error(`Act "${actQuery}" not found. Choose one of: ${available}`);
    process.exit(2);
  }
  return matches;
}

function report(nsfw) {
  const MB = loadGame(nsfw);
  const acts = findAct(MB);
  const state = { ...save };
  if (!Array.isArray(state.quests)) MB.Story.migrate(state);

  for (const act of acts) {
    const side = MB.Story.quests.filter((quest) => quest.act === act.quests[0]?.act && quest.side);
    const hidden = side.filter((quest) => MB.Story.hidden(quest));
    const visible = side.filter((quest) => !MB.Story.hidden(quest));
    const done = visible.filter((quest) => MB.Story.isDone(state, quest));
    const remaining = visible.filter((quest) => !MB.Story.isDone(state, quest));
    const ready = remaining.filter((quest) => MB.Story.isOpen(state, quest));
    const locked = remaining.filter((quest) => !MB.Story.isOpen(state, quest));

    console.log(`\n${act.title} — NSFW ${nsfw ? 'on' : 'off'}`);
    console.log(`Side quests: ${done.length}/${visible.length} complete; ${remaining.length} remaining; ${hidden.length} hidden by mode.`);
    printQuests('READY', ready, MB, state);
    printQuests('LOCKED', locked, MB, state);
    printHidden(hidden, MB, state);
    if (!remaining.length) console.log('All visible side quests are complete.');
  }
}

function printHidden(quests, MB, state) {
  console.log(`HIDDEN BY MODE (${quests.length}):`);
  if (!quests.length) {
    console.log('  none');
    return;
  }
  for (const quest of quests) {
    const saved = MB.Story.isDone(state, quest) ? ' — already completed in this save' : '';
    console.log(`  - ${quest.title || quest.id} [${quest.id}]${saved}`);
  }
}

function printQuests(label, quests, MB, state) {
  console.log(`${label} (${quests.length}):`);
  if (!quests.length) {
    console.log('  none');
    return;
  }
  for (const quest of quests) {
    const stage = quest.stage == null ? null : MB.STORY[quest.stage];
    const stars = stage && state.stars ? state.stars[quest.stage] | 0 : 0;
    const needs = quest.needs.map((id) => {
      const prerequisite = MB.Story.byId(id);
      return `${prerequisite ? prerequisite.title : id} (${MB.Story.isDone(state, prerequisite) ? 'done' : 'not done'})`;
    }).join('; ');
    console.log(`  - ${quest.title || quest.id} [${quest.id}]${stage ? ` — ${stars}/3 stars` : ''}`);
    if (needs) console.log(`    Needs: ${needs}`);
    if (quest.place) console.log(`    Location: ${MB.Story.place(quest.place)?.title || quest.place}`);
    else console.log('    Location: act map');
  }
}

if (mode === 'both') {
  report(false);
  report(true);
} else {
  report(mode === 'nsfw');
}
