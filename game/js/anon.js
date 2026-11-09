// Anon: the faceless one, standing in wherever a story has no character. Every reader who never typed a name, every
// "you" a story forgot. Anon is the surprise villain of "The One You Left Behind", the side quest after the epilogue
// (js/story.js): '???' until its scene says the name. Drawn here as a silhouette, so it needs no sprites in the bucket.
// Loaded after data.js: it adds Anon's character, card, power, boss rule and Story stage before the rest of the game
// reads them.
window.MB = window.MB || {};
(function () {
  const ID = 'anon';
  // a dark figure with two lights for eyes
  const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">'
    + '<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211838"/><stop offset=".7" stop-color="#0b0814"/>'
    + '<stop offset="1" stop-color="#0b0814" stop-opacity="0"/></linearGradient><radialGradient id="e"><stop offset="0" stop-color="#fff"/>'
    + '<stop offset=".45" stop-color="#c9b8ff"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient></defs>'
    + '<path fill="url(#b)" stroke="#7a5cff" stroke-opacity=".5" stroke-width="3" d="M300 140c-62 0-104 48-104 112 0 46 22 84 52 102v34c-70 14-148 44-178 92-22 36-30 120-34 420h528c-4-300-12-384-34-420-30-48-108-78-178-92v-34c30-18 52-56 52-102 0-64-42-112-104-112z"/>'
    + '<circle cx="262" cy="250" r="16" fill="url(#e)"/><circle cx="338" cy="250" r="16" fill="url(#e)"/></svg>');
  const NOVEL = 'Nobody\'s Story';

  // the name stays '???' until Anon says it (the scene's `run` step) or its quest is done
  let named = false;
  const sprites = Object.fromEntries(['idle', 'play', 'attack', 'special', 'hurt', 'lose', 'win', 'taunt'].map((r) => [r, SILHOUETTE]));
  window.MIKU_MANIFEST.characters.push({
    id: ID, get name() { const s = MB.UI && MB.UI.save; return named || (s && s.quests.includes(ID)) ? 'Anon' : '???'; },
    outfit: 'default', short: 'Every reader who never typed a name.', traits: [], sprites, costumes: [], portrait: SILHOUETTE, novel: NOVEL,
  });
  const novelOf = MB.novelOf;
  MB.novelOf = (id) => (id === ID ? NOVEL : novelOf(id));

  MB.CARDS[ID] = { cost: 5, atk: 4, hp: 6, rarity: 'legendary', token: true, kw: ['stealth'],
    text: 'Nobody in particular.', attack: { style: 'unthinkable', name: 'No Name', color: '#7a5cff' },
    intro: { move: 'fade', fx: 'smoke', sfx: 'glitch' }, quote: 'You never even asked my name.' };
  MB.POWERS[ID] = { name: 'Left Behind', cost: 2, target: 'enemyUnit', effect: 'gloom', text: 'Give an enemy monster -2 ATK.' };
  MB.BOSSES[ID] = { name: 'Everyone Nobody Named', every: 3, color: '#7a5cff', emoji: '👤', text: 'Every 3rd turn: a random cheap character steps out of the dark on its side.',
    effect: { do: { op: 'summon', card: 'randomUnit', maxCost: 3 } },
    rage: { name: 'Remember Me', text: 'At half HP: freezes all your monsters.', effect: { do: { op: 'freeze', to: 'enemies' } } } };
  const doe = MB.STORY.find((st) => st.foe === 'doe');
  MB.STORY.push({ chapter: doe ? doe.chapter : 0, foe: ID, bg: 'mountain top', music: 'doomsday-clock-midnight',
    intro: 'Something faceless waits in the dark between the worlds. "My turn to be the main character."' });

  MB.Anon = { ID, name: () => { named = true; } };
})();
