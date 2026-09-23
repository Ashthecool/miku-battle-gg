// Card, leader and story definitions. Character ids match assets/manifest.js.
window.MB = window.MB || {};

MB.KEYWORDS = {
  taunt:     { name: 'Taunt',     icon: '🛡️', text: 'Enemies must attack this first.' },
  haste:     { name: 'Haste',     icon: '⚡', text: 'Can attack the turn it is played.' },
  ranged:    { name: 'Ranged',    icon: '🏹', text: 'Takes no counter-damage when attacking.' },
  shield:    { name: 'Shield',    icon: '🔰', text: 'Blocks the first damage it takes.' },
  lifesteal: { name: 'Lifesteal', icon: '💗', text: 'Damage it deals heals your leader.' },
  poison:    { name: 'Poison',    icon: '☠️', text: 'Destroys any monster it damages.' },
  frenzy:    { name: 'Frenzy',    icon: '🔥', text: 'Can attack twice each turn.' },
  freeze:    { name: 'Freeze',    icon: '❄️', text: 'Monsters it damages skip their next attack.' },
  burn:      { name: 'Burn',      icon: '♨️', text: 'Sets monsters it damages ablaze: 1 damage each turn until healed.' },
  guardian:  { name: 'Guardian',  icon: '😇', text: 'Takes all damage aimed at your leader.' },
  stealth:   { name: 'Stealth',   icon: '👤', text: "Can't be attacked or targeted until it attacks." },
  tipsy:     { name: 'Tipsy',     icon: '🥴', text: 'Ignores Taunt, but attacks a random enemy.' },
};

// attack.style picks the animation in fx.js
MB.CARDS = {
  'maria-hunley':    { cost: 6, atk: 5, hp: 8, rarity: 'legendary', kw: ['taunt'], onPlay: 'momHug',
    text: 'On play: give your other monsters +0/+2.', attack: { style: 'slam', name: 'Mama Bear Slam', color: '#5fd068' } },
  'hayley-kate':     { cost: 2, atk: 2, hp: 2, rarity: 'common', kw: ['haste'], onPlay: 'cheer',
    text: 'On play: give a random ally +1 ATK.', attack: { style: 'barrage', name: 'Sparkle Barrage', color: '#ff8ad8' } },
  'james-lone':      { cost: 3, atk: 3, hp: 3, rarity: 'common', kw: ['ranged'],
    text: '', attack: { style: 'beam', name: 'Deadpan Beam', color: '#7aa7ff' } },
  'maiko-ghan':      { cost: 4, atk: 3, hp: 4, rarity: 'rare', kw: ['frenzy'],
    text: '', attack: { style: 'dash', name: 'Tomboy Combo', color: '#ffa640' } },
  'isabella-hunley': { cost: 2, atk: 1, hp: 4, rarity: 'common', kw: ['lifesteal'], onPlay: 'soothe',
    text: 'On play: restore 3 HP to your leader.', attack: { style: 'orb', name: 'Petal Stream', color: '#ffb3dc' } },
  'julie-hunley':    { cost: 1, atk: 1, hp: 1, rarity: 'common', kw: ['haste'], onDeath: 'giddyPop',
    text: 'On death: deal 1 damage to a random enemy.', attack: { style: 'bounce', name: 'Giddy Bounce', color: '#c58cff' } },
  'kayla-kate':      { cost: 4, atk: 2, hp: 4, rarity: 'epic', kw: ['poison'],
    text: '', attack: { style: 'bolt', name: 'Gloom Hex', color: '#a35cff' } },
  'luther-jones':    { cost: 2, atk: 2, hp: 2, rarity: 'common', kw: ['shield'],
    text: '', attack: { style: 'spin', name: 'Skate Spin', color: '#46e0c8' } },
  'fami-maft':       { cost: 5, atk: 3, hp: 5, rarity: 'rare', kw: [], onPlay: 'kids',
    text: 'On play: summon two 1/1 Kids.', attack: { style: 'boomerang', name: 'Frying Pan Toss', color: '#ffd24a' } },
  'farley-kate':     { cost: 5, atk: 4, hp: 6, rarity: 'common', kw: ['taunt'],
    text: '', attack: { style: 'slam', name: 'Dad Drop', color: '#e8643c' } },
  'wert-lone':       { cost: 3, atk: 2, hp: 4, rarity: 'common', kw: [], onPlay: 'badJoke', onDeath: 'drawOne',
    text: 'On play: a random enemy monster gets -2 ATK. On death: draw a card.', attack: { style: 'confetti', name: 'Dad Joke Barrage', color: '#ffe066' } },
  'ben-brier':       { cost: 4, atk: 5, hp: 3, rarity: 'rare', kw: ['haste'],
    text: '', attack: { style: 'dash', name: 'Thug Rush', color: '#ff3b3b' } },
  'catherine-jones': { cost: 7, atk: 6, hp: 6, rarity: 'legendary', kw: [], onPlay: 'goldenRain',
    text: 'On play: deal 2 damage to all enemy monsters.', attack: { style: 'coins', name: 'Money Storm', color: '#ffcc33' } },
  'harris-kate':     { cost: 4, atk: 3, hp: 5, rarity: 'epic', kw: ['freeze'],
    text: '', attack: { style: 'frost', name: 'Brain Freeze', color: '#8fe8ff' } },
  'zoe-brier':       { cost: 3, atk: 2, hp: 3, rarity: 'rare', kw: [], onTurnStart: 'tide',
    text: 'Start of your turn: restore 1 HP to all your characters.', attack: { style: 'wave', name: 'Tidal Lesson', color: '#3fb6ff' } },
  'keiko-ghan':      { cost: 2, atk: 3, hp: 2, rarity: 'common', kw: [], onPlay: 'sideHustle',
    text: 'On play: gain 1 gold this turn.', attack: { style: 'slash', name: 'Overtime Slap', color: '#ff6e9a' } },

  // Infernal Harmony. `rival`: deals and takes double damage in fights with that character.
  'lilith':            { cost: 6, atk: 5, hp: 5, rarity: 'legendary', kw: ['burn'], onPlay: 'hellfire', rival: 'celeste',
    text: 'On play: set all enemy monsters ablaze.', attack: { style: 'hellfire', name: 'Infernal Tantrum', color: '#ff4a1c' } },
  'celeste':           { cost: 6, atk: 3, hp: 8, rarity: 'legendary', kw: ['guardian'], onPlay: 'halo', rival: 'lilith',
    text: 'On play: give your other monsters Shield.', attack: { style: 'halo', name: 'Heavenly Judgment', color: '#ffe9a0' } },
  'mr-dino':           { cost: 5, atk: 5, hp: 4, rarity: 'epic', kw: [], onPlay: 'popQuiz',
    text: 'On play: deal 2 damage to each enemy monster with odd ATK.', attack: { style: 'uppercut', name: 'Huh?! Uppercut', color: '#3ddc84' } },
  'clara-click':       { cost: 4, atk: 4, hp: 3, rarity: 'epic', kw: ['stealth'], onPlay: 'tsundere',
    text: 'On play: hit a random ally for 1, then give it +2 ATK.', attack: { style: 'heartbreak', name: 'B-Baka Heartbreak', color: '#ff5c8a' } },
  'janice-garmund':    { cost: 3, atk: 1, hp: 5, rarity: 'rare', kw: [], onTurnStart: 'bookworm',
    text: 'Start of your turn: if you hold 3 or fewer cards, draw one.', attack: { style: 'pages', name: 'Library Blizzard', color: '#9a8cff' } },
  'jay-lester':        { cost: 3, atk: 2, hp: 3, rarity: 'common', kw: [], onPlay: 'repaint',
    text: 'On play: swap ATK and HP of the strongest enemy monster.', attack: { style: 'paint', name: 'Splash of Color', color: '#29c5ff' } },
  'charlie-and-jenny': { cost: 2, atk: 3, hp: 2, rarity: 'common', kw: ['tipsy'], name: 'Charlie & Jenny',
    text: '', attack: { style: 'stumble', name: 'Double Trouble', color: '#ffb347' } },

  // tokens (never in decks)
  'kid':   { cost: 1, atk: 1, hp: 1, rarity: 'token', kw: [], token: true, name: 'Kid', emoji: '🧒',
    text: '', attack: { style: 'bounce', name: 'Tiny Kick', color: '#ffd24a' } },
  'teddy': { cost: 1, atk: 1, hp: 1, rarity: 'token', kw: ['taunt'], token: true, name: 'Teddy', emoji: '🧸',
    text: '', attack: { style: 'bounce', name: 'Fluff Bump', color: '#c58cff' } },
  'dummy': { cost: 0, atk: 0, hp: 99, rarity: 'token', kw: [], token: true, name: 'Training Dummy', emoji: '🎯',
    text: '', attack: { style: 'dash', name: '', color: '#fff' } },

  // item spells (icons from the novel's inventory)
  'school-bag':    { type: 'spell', cost: 1, rarity: 'common', target: 'anyUnit', effect: 'bagSwing',
    text: 'Deal 2 damage to a monster.', color: '#3a9d5d' },
  'towel':         { type: 'spell', cost: 1, rarity: 'common', target: 'friendlyAny', effect: 'towelOff',
    text: 'Restore 5 HP to a friendly character and unfreeze it.', color: '#8fd3ff' },
  'money':         { type: 'spell', cost: 2, rarity: 'rare', target: null, effect: 'allowance',
    text: 'Draw 2 cards.', color: '#ffd84a' },
  'walking-stick': { type: 'spell', cost: 2, rarity: 'common', target: 'allyUnit', effect: 'stick',
    text: 'Give an ally +2/+2.', color: '#b07a45' },
  'your-phone':    { type: 'spell', cost: 3, rarity: 'rare', target: null, effect: 'callFriend',
    text: 'Call a friend: summon a random character costing 3 or less.', color: '#7aa7ff' },
  'mansion-key':   { type: 'spell', cost: 6, rarity: 'epic', target: null, effect: 'mansion',
    text: 'Deal 3 damage to all enemy monsters.', color: '#ffcc33' },
  'beer':          { type: 'spell', cost: 1, rarity: 'common', target: 'allyUnit', effect: 'beer',
    text: 'Give an ally +2 ATK and Tipsy.', color: '#e8a93a' },
  'gift-card':     { type: 'spell', cost: 1, rarity: 'rare', target: 'allyUnit', effect: 'exchange',
    text: 'Return an ally to your hand. It costs 1 less.', color: '#ff7ab8' },
  'jay-s-pencil':  { type: 'spell', cost: 2, rarity: 'rare', target: 'allyUnit', effect: 'sketch',
    text: 'Sketch an ally: add a copy of it to your hand.', color: '#ffd23f' },
  'key-to-the-liquor-closet': { type: 'spell', cost: 4, rarity: 'epic', target: null, effect: 'closet', name: 'Liquor Closet Key',
    text: 'Unlock the closet: summon a random character from your deck.', color: '#c77dff' },
};

// One leader power per character. target uses the same types as spells.
MB.POWERS = {
  'maria-hunley':    { name: "Mom's Hug",       cost: 2, target: 'allyUnit',    effect: 'hug',      text: 'Give an ally +0/+2.' },
  'hayley-kate':     { name: 'Cheer Up',        cost: 2, target: 'allyUnit',    effect: 'cheerUp',  text: 'Give an ally +1 ATK.' },
  'james-lone':      { name: 'Sarcasm',         cost: 2, target: 'enemyAny',    effect: 'ping',     text: 'Deal 1 damage to an enemy.' },
  'maiko-ghan':      { name: 'Honest Punch',    cost: 2, target: null,          effect: 'facePunch',text: 'Deal 2 damage to the enemy leader.' },
  'isabella-hunley': { name: 'Soothe',          cost: 2, target: 'friendlyAny', effect: 'heal3',    text: 'Restore 3 HP to a friendly character.' },
  'julie-hunley':    { name: 'Teddy Time',      cost: 2, target: null,          effect: 'teddy',    text: 'Summon a 1/1 Teddy with Taunt.' },
  'kayla-kate':      { name: 'Gloom',           cost: 2, target: 'enemyUnit',   effect: 'gloom',    text: 'Give an enemy monster -2 ATK.' },
  'luther-jones':    { name: 'Chill Out',       cost: 2, target: null,          effect: 'chill',    text: 'Draw a card. Your leader takes 2 damage.' },
  'fami-maft':       { name: 'Family Dinner',   cost: 2, target: null,          effect: 'dinner',   text: 'Give all your monsters +0/+1.' },
  'farley-kate':     { name: 'Fatherly Shield', cost: 2, target: 'allyUnit',    effect: 'giveShield', text: 'Give an ally Shield.' },
  'wert-lone':       { name: 'Bad Joke',        cost: 3, target: null,          effect: 'groan',    text: 'Deal 1 damage to all enemy monsters.' },
  'ben-brier':       { name: 'Pump Iron',       cost: 3, target: 'allyUnit',    effect: 'pump',     text: 'Give an ally +2 ATK.' },
  'catherine-jones': { name: 'Bribe',           cost: 3, target: 'enemyUnit',   effect: 'bribe',    text: 'Destroy an enemy monster with 2 or less ATK.', filter: 'lowAtk' },
  'harris-kate':     { name: 'Freeze Treat',    cost: 2, target: 'enemyUnit',   effect: 'freezeOne',text: 'Freeze an enemy monster.' },
  'zoe-brier':       { name: 'High Tide',       cost: 2, target: null,          effect: 'tideAll',  text: 'Restore 2 HP to all your characters.' },
  'keiko-ghan':      { name: 'Overtime',        cost: 2, target: 'allyUnit',    effect: 'overtime', text: 'A monster played this turn can attack now.', filter: 'sick' },
  'lilith':            { name: 'Hellspark',     cost: 2, target: 'enemyUnit',   effect: 'ignite',    text: 'Set an enemy monster ablaze.' },
  'celeste':           { name: 'Blessing',      cost: 2, target: 'allyUnit',    effect: 'bless',     text: 'Fully heal an ally.' },
  'mr-dino':           { name: "Coach's Drill", cost: 2, target: 'allyUnit',    effect: 'drill',     text: 'Give an ally +1/+1.' },
  'clara-click':       { name: 'Tease',         cost: 2, target: 'enemyUnit',   effect: 'tease',     text: 'Strip Taunt and Shield from an enemy monster.', filter: 'guarded' },
  'janice-garmund':    { name: 'Research',      cost: 2, target: null,          effect: 'research',  text: 'Draw the cheapest card in your deck.' },
  'jay-lester':        { name: 'Quick Sketch',  cost: 2, target: 'allyUnit',    effect: 'swapStats', text: "Swap an ally's ATK and HP." },
  'charlie-and-jenny': { name: 'Party Foul',    cost: 2, target: null,          effect: 'partyFoul', text: 'Deal 1 damage to two random enemy characters.' },
};

// Relationships. When both characters of a pair stand on the same side of the board they fuse into one
// duo unit: stats are summed (+bonus), keywords are replaced by `kw`, both change into `costumes`
// (costume ids from the manifest, null = usual outfit), the duo can attack right away and uses its own
// special attack. Higher tiers are stronger and trigger `onFuse` (see Battle.trigger). Checked in order.
MB.BOND_TIERS = {
  1: { name: 'Bond',        hearts: '♥' },
  2: { name: 'Deep Bond',   hearts: '♥♥' },
  3: { name: 'Soul Bond',   hearts: '♥♥♥' },
};
MB.BONDS = [
  { id: 'infernal-harmony', pair: ['lilith', 'celeste'], costumes: ['prom-outfit', 'prom-outfit'], tier: 3,
    name: 'Infernal Harmony', short: 'Harmony', relation: 'Rivals → Prom Partners', bonus: [2, 2], kw: ['burn', 'guardian', 'shield'], onFuse: 'judgment',
    text: 'On fusion: deal 2 damage to all enemy monsters and set them ablaze.',
    attack: { style: 'harmony', name: 'Heaven & Hell Duet', color: '#ff7ad9' } },
  { id: 'gothic-love', pair: ['james-lone', 'kayla-kate'], costumes: ['goth-outfit', 'black-jacket'], tier: 3,
    name: 'Gothic Love', short: 'Goth Love', relation: 'In love', bonus: [2, 2], kw: ['poison', 'shield'], onFuse: 'eclipse',
    text: 'On fusion: destroy the enemy monster with the highest ATK.',
    attack: { style: 'gothic', name: 'Midnight Serenade', color: '#9b4dff' } },
  { id: 'hunley-sisters', pair: ['maria-hunley', 'isabella-hunley'], costumes: ['christmas-clothes', 'christmas-clothes'], tier: 3,
    name: 'Hunley Holiday', short: 'Hunleys', relation: 'Sisters', bonus: [2, 2], kw: ['taunt', 'lifesteal'], onFuse: 'groupHug',
    text: 'On fusion: restore 8 HP to your leader and give your other monsters +1/+2.',
    attack: { style: 'miracle', name: 'Christmas Miracle', color: '#ff4f5e' } },
  { id: 'happily-married', pair: ['farley-kate', 'fami-maft'], costumes: ['winter', 'winter'], tier: 2,
    name: 'Happily Married', short: 'Kates', relation: 'Married 19 years', bonus: [1, 2], kw: ['taunt'], onFuse: 'anniversary',
    text: 'On fusion: give your other monsters Shield.',
    attack: { style: 'waltz', name: 'Anniversary Waltz', color: '#ff8f6b' } },
  { id: 'ghan-dojo', pair: ['maiko-ghan', 'keiko-ghan'], costumes: ['karate-outfit', null], tier: 2,
    name: 'Ghan Dojo', short: 'Ghans', relation: 'Mother & Daughter', bonus: [0, 2], kw: ['frenzy'], onFuse: 'discipline',
    text: 'On fusion: gain 1 gold this turn.',
    attack: { style: 'dojo', name: 'Ghan Clan Karate', color: '#ff6a3d' } },
  { id: 'jones-fortune', pair: ['catherine-jones', 'luther-jones'], costumes: ['red-dress', 'school-uniform'], tier: 2,
    name: 'Jones Fortune', short: 'Joneses', relation: 'Mother & Son', bonus: [1, 1], kw: ['shield'], onFuse: 'inheritance',
    text: 'On fusion: draw 2 cards.',
    attack: { style: 'jackpot', name: 'Family Jackpot', color: '#ffcc33' } },
  { id: 'sleepover', pair: ['maiko-ghan', 'hayley-kate'], costumes: ['pajamas', 'pajamas'], tier: 2,
    name: 'Sleepover Besties', short: 'Besties', relation: 'Best friends', bonus: [1, 2], kw: ['shield'], onFuse: 'pepTalk',
    text: 'On fusion: give your other monsters +1 ATK.',
    attack: { style: 'sleepover', name: 'Pillow Fight Frenzy', color: '#ffb0d9' } },
  { id: 'sister-party', pair: ['maria-hunley', 'julie-hunley'], costumes: ['party-dress', 'casual'], tier: 2,
    name: 'Sister Party', short: 'Party', relation: 'Sisters', bonus: [1, 2], kw: ['taunt'], onFuse: 'partyGuests',
    text: 'On fusion: summon two 1/1 Teddies with Taunt.',
    attack: { style: 'party', name: 'Disco Hug Attack', color: '#c58cff' } },
  { id: 'cheer-and-chain', pair: ['hayley-kate', 'james-lone'], costumes: [null, 'goth-outfit'], tier: 2,
    name: 'Cheer and Chain', short: 'Cheer & Chain', relation: 'Opposites attract', bonus: [1, 2], kw: ['ranged', 'freeze'], onFuse: 'chainCheer',
    text: 'On fusion: give your other monsters +1 ATK and freeze the strongest enemy monster.',
    attack: { style: 'cheerchain', name: 'Pom-Pom Shackles', color: '#ff7ac6' } },
  { id: 'lone-wolves', pair: ['james-lone', 'wert-lone'], costumes: ['winter', null], tier: 1,
    name: 'Lone Wolves', short: 'Lones', relation: 'Father & Son', bonus: [1, 1], kw: ['ranged'],
    text: '', attack: { style: 'howl', name: 'Lone Wolf Howl', color: '#7aa7ff' } },
  { id: 'kate-sisters', pair: ['hayley-kate', 'kayla-kate'], costumes: ['summer-dress', 'black-jacket'], tier: 1,
    name: 'Sunshine & Gloom', short: 'Sisters', relation: 'Sisters', bonus: [1, 1], kw: ['poison'],
    text: '', attack: { style: 'twinstar', name: 'Sister Sync', color: '#d07aff' } },
  { id: 'mothers-day', pair: ['fami-maft', 'harris-kate'], costumes: ['mothers-day-dress', 'mothers-day-outfit'], tier: 1,
    name: "Mother's Day", short: "Mom's Day", relation: 'Mother & Child', bonus: [1, 1], kw: ['freeze'],
    text: '', attack: { style: 'breakfast', name: 'Breakfast in Bed', color: '#8fe8ff' } },
  { id: 'unlikely-duo', pair: ['maiko-ghan', 'james-lone'], costumes: ['gym-outfit', 'normal-clothes'], tier: 1,
    name: 'Unlikely Duo', short: 'Duo', relation: 'Classmates', bonus: [0, 1], kw: ['shield'],
    text: '', attack: { style: 'combo', name: 'Honest Sarcasm', color: '#ffa640', emoji: '🥋' } },
  { id: 'little-sisters', pair: ['isabella-hunley', 'julie-hunley'], costumes: ['christmas-clothes', 'christmas-clothes'], tier: 1,
    name: 'Little Hunleys', short: 'Littles', relation: 'Sisters', bonus: [1, 1], kw: ['lifesteal'],
    text: '', attack: { style: 'combo', name: 'Teddy Tag-Team', color: '#ffb3dc', emoji: '🧸' } },
  // the Kate family: every pair has its own bond
  { id: 'daddys-girl', pair: ['farley-kate', 'hayley-kate'], costumes: ['winter', 'winter'], tier: 1,
    name: "Daddy's Girl", short: 'Dad & Hay', relation: 'Father & Daughter', bonus: [1, 1], kw: ['taunt'],
    text: '', attack: { style: 'combo', name: 'Piggyback Charge', color: '#ff9a5c', emoji: '🎈' } },
  { id: 'kitchen-helpers', pair: ['fami-maft', 'hayley-kate'], costumes: ['mothers-day-dress', 'summer-dress'], tier: 1,
    name: 'Kitchen Helpers', short: 'Cooks', relation: 'Mother & Daughter', bonus: [1, 1], kw: ['lifesteal'],
    text: '', attack: { style: 'combo', name: 'Pancake Flip', color: '#ffd24a', emoji: '🍳' } },
  { id: 'sibling-squabble', pair: ['harris-kate', 'hayley-kate'], costumes: [null, 'pajamas'], tier: 1,
    name: 'Sibling Squabble', short: 'Siblings', relation: 'Siblings', bonus: [1, 1], kw: ['shield'],
    text: '', attack: { style: 'combo', name: 'Noogie Rush', color: '#ff8ad8', emoji: '💢' } },
  { id: 'dads-worry', pair: ['farley-kate', 'kayla-kate'], costumes: ['winter', 'black-jacket'], tier: 1,
    name: "Dad's Worry", short: 'Dad & Kay', relation: 'Father & Daughter', bonus: [1, 1], kw: ['guardian'],
    text: '', attack: { style: 'combo', name: 'Grounded!', color: '#e8643c', emoji: '🛡️' } },
  { id: 'tough-love', pair: ['fami-maft', 'kayla-kate'], costumes: ['winter', 'black-jacket'], tier: 1,
    name: 'Tough Love', short: 'Mom & Kay', relation: 'Mother & Daughter', bonus: [1, 1], kw: ['poison'],
    text: '', attack: { style: 'combo', name: 'Wooden Spoon Smack', color: '#a35cff', emoji: '🥄' } },
  { id: 'middle-kids', pair: ['harris-kate', 'kayla-kate'], costumes: ['mothers-day-outfit', 'black-jacket'], tier: 1,
    name: 'Middle Kids', short: 'Middles', relation: 'Siblings', bonus: [1, 1], kw: ['stealth'],
    text: '', attack: { style: 'combo', name: 'Overlooked Ambush', color: '#8f9bff', emoji: '🎧' } },
  { id: 'like-father', pair: ['farley-kate', 'harris-kate'], costumes: ['winter', 'mothers-day-outfit'], tier: 1,
    name: 'Like Father, Like Kid', short: 'Dad & Harris', relation: 'Father & Child', bonus: [1, 1], kw: ['taunt', 'freeze'],
    text: '', attack: { style: 'combo', name: 'Double Brain Freeze', color: '#8fe8ff', emoji: '🍦' } },
  // Ben and Zoe only have one outfit each in the novel
  { id: 'brier-tide', pair: ['ben-brier', 'zoe-brier'], costumes: [null, null], tier: 1,
    name: 'Brier Tide', short: 'Briers', relation: 'Mother & Son', bonus: [1, 1], kw: ['lifesteal'],
    text: '', attack: { style: 'riptide', name: 'Riptide Rush', color: '#3fb6ff' } },
  { id: 'art-club', pair: ['janice-garmund', 'jay-lester'], costumes: ['summer-clothes', 'new-outfit'], tier: 1,
    name: 'Art & Books', short: 'Club', relation: 'Clubmates', bonus: [1, 1], kw: ['taunt'],
    text: '', attack: { style: 'combo', name: 'Illustrated Edition', color: '#29c5ff', emoji: '🎨' } },
  { id: 'extra-credit', pair: ['mr-dino', 'jay-lester'], costumes: ['coach-outfit', null], tier: 1,
    name: 'Extra Credit', short: 'Class', relation: 'Teacher & Student', bonus: [1, 1], kw: ['shield'],
    text: '', attack: { style: 'lesson', name: 'Pop Quiz Barrage', color: '#3ddc84' } },
  { id: 'teachers-pet', pair: ['mr-dino', 'janice-garmund'], costumes: ['coach-outfit', null], tier: 1,
    name: "Teacher's Pet", short: 'Class', relation: 'Teacher & Student', bonus: [1, 1], kw: ['taunt'],
    text: '', attack: { style: 'lesson', name: 'Detention Slip', color: '#9a8cff' } },
];
// the strongest bond wins when a character could fuse with more than one partner (sort is stable)
MB.BONDS.sort((a, b) => b.tier - a.tier);
MB.bondsOf = (id) => MB.BONDS.filter((b) => b.pair.includes(id));

// alternate outfits that aren't real clothes, kept out of the wardrobe
MB.HIDDEN_COSTUMES = { 'james-lone': ['phone-james'], 'hayley-kate': ['hurt'] };

MB.STARTER_LEADERS = ['hayley-kate', 'james-lone', 'maiko-ghan', 'luther-jones'];

// Rarity drives card frames, drop odds and reveal effects. Only commons are owned at the start;
// everything else drops from battle wins (weights are relative among still-locked rarities).
MB.RARITY = {
  common:    { name: 'Common',    color: '#c9d1dc', stars: 1, weight: 50 },
  rare:      { name: 'Rare',      color: '#4aa3ff', stars: 2, weight: 30 },
  epic:      { name: 'Epic',      color: '#b35cff', stars: 3, weight: 14 },
  legendary: { name: 'Legendary', color: '#ffc93c', stars: 4, weight: 6 },
  token:     { name: 'Token',     color: '#888888', stars: 0, weight: 0 },
  bond:      { name: 'Fusion',    color: '#ff5fa2', stars: 4, weight: 0 },
};

MB.STARTER_CARDS = Object.keys(MB.CARDS).filter((id) => MB.CARDS[id].rarity === 'common' && !MB.CARDS[id].token);

// Packs are earned by winning and opened from the Packs screen. Each slot is a card of at least that
// rarity ('card' = any), or 'avatar' for a profile picture (MB.AVATARS, from js/avatars.js).
// A slot with nothing left to unlock gives the other kind instead.
MB.PACKS = {
  common: { name: 'Common Pack', color: '#c9d1dc', slots: ['card', 'avatar'] },
  rare:   { name: 'Rare Pack',   color: '#4aa3ff', slots: ['rare', 'card', 'avatar', 'avatar'] },
  epic:   { name: 'Epic Pack',   color: '#b35cff', slots: ['epic', 'rare', 'avatar', 'avatar', 'avatar'] },
};
MB.STARTER_AVATAR = 'hayley';

MB.STARTER_DECK = [
  'julie-hunley', 'julie-hunley', 'school-bag', 'school-bag', 'towel',
  'hayley-kate', 'hayley-kate', 'keiko-ghan', 'keiko-ghan', 'luther-jones', 'luther-jones',
  'isabella-hunley', 'isabella-hunley', 'walking-stick', 'james-lone', 'james-lone',
  'wert-lone', 'wert-lone', 'farley-kate', 'farley-kate',
];

// Story ladders, one per novel; each chapter is cleared in order but chapters are independent.
MB.CHAPTERS = [
  { title: 'A New Life in Town', outro: 'You finished the story — Mom is proud of you. ❤' },
  { title: 'Infernal Harmony', outro: 'Heaven, hell and the whole prom bow to you. What a night! 🔥😇' },
];

// Story ladder: each opponent fights in their own location with their own music.
MB.STORY = [
  { foe: 'julie-hunley',    hp: 20, ai: 0.2, bg: 'Living Room',               music: 'sun-and-games',
    intro: "Julie wants to play! She promises it's \"just a little card game\"..." },
  { foe: 'james-lone',      hp: 24, ai: 0.4, bg: 'Classroom',                 music: 'welcome-to-school',
    intro: 'James is bored in class. "Fine. One round. Try not to be boring."' },
  { foe: 'maiko-ghan',      hp: 26, ai: 0.5, bg: 'Gym Class',                 music: 'maiko-and-james',
    intro: 'Maiko cracks her knuckles. "Honestly? You don\'t stand a chance."' },
  { foe: 'kayla-kate',      hp: 28, ai: 0.6, bg: 'Forrest sunset',            music: 'fire-ice',
    intro: 'Kayla sighs from the shadows. "Whatever. Let\'s get this over with."' },
  { foe: 'ben-brier',       hp: 30, ai: 0.7, bg: 'Afternoon Alley',           music: "loner-s-bully",
    intro: 'Ben blocks the alley. "Nobody walks through here without a fight."' },
  { foe: 'catherine-jones', hp: 32, ai: 0.85, bg: 'Entrance to Jones Mansion', music: 'cat-jones',
    intro: 'Catherine smirks. "Darling, I could buy your whole deck. Twice."' },
  { foe: 'maria-hunley',    hp: 40, ai: 1.0, bg: 'Our Home from the outside', music: 'the-grand-fun',
    intro: 'Mom is waiting on the porch. "Show me how much you\'ve grown, kiddo."' },

  { chapter: 1, foe: 'jay-lester',        hp: 22, ai: 0.35, bg: 'Art club',                      music: 'jay-s-clubroom',
    intro: 'Jay wipes the paint off his hands. "Wanna play a round? I\'ll go easy on you... probably."' },
  { chapter: 1, foe: 'janice-garmund',    hp: 24, ai: 0.45, bg: 'The Library',                   music: 'afternoon-violin',
    intro: 'Janice pushes up her glasses. "I read the whole rulebook. Twice. Shall we begin?"' },
  { chapter: 1, foe: 'clara-click',       hp: 26, ai: 0.55, bg: 'Outside by the lemonade stand', music: 'clara-click',
    intro: 'Clara crosses her arms. "I-it\'s not like I wanted to play with you! Just sit down already."' },
  { chapter: 1, foe: 'mr-dino',           hp: 30, ai: 0.65, bg: 'Outside gym (afternoon)',       music: 'mr-dino',
    intro: '"Huh. You think you can beat your teacher? Class is in session. Future president, by the way."' },
  { chapter: 1, foe: 'charlie-and-jenny', hp: 28, ai: 0.7,  bg: 'In the kitchen (Party)',        music: 'party-music-1',
    intro: 'Charlie and Jenny stumble over, giggling. "Heeey~ bet you can\'t beat BOTH of us. *hic*"' },
  { chapter: 1, foe: 'celeste',           hp: 34, ai: 0.85, bg: 'Cafeteria (Party)',             music: 'day-2-celeste',
    intro: 'Celeste smiles sweetly. "I\'m your guardian angel, darling. Let me protect you... from that devil."' },
  { chapter: 1, foe: 'lilith',            hp: 40, ai: 1.0,  bg: 'Fire..',                        music: 'party-music',
    intro: 'Lilith\'s horns glow in the firelight. "H-hey! Don\'t get the wrong idea... I just want ALL your attention!"' },
];
MB.STORY.forEach((s) => { s.chapter = s.chapter || 0; });

MB.MUSIC = { title: 'main-theme', quick: 'skate-o-polis', win: 'm-club-celebration', lose: 'missing-my-hayley',
  deck: 'the-jazzer', gallery: 'speech-up-call' };
