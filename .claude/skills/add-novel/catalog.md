# Catalog: fields, keywords, animations, scenes

## Card

```js
'dan-birk': { cost: 3, atk: 3, hp: 2, rarity: 'common', kw: ['rebel'],
  onPlay: { ...spec },                       // optional abilities (effects.md); abilitySfx: a sound name for their "ability" pop (default sparkle)
  attack: { style: 'parkour', name: 'Wild Vault', color: '#ff9d2e', emoji: '🛹' },  // emoji: generic styles only
  //   or a recipe instead of a style (see Attack recipes), plus optional cry / finish / sfx lines
  intro: 'hyper' | { move: 'drop', fx: 'fling', emoji: ['🔨', '⚙️'], sfx: 'slam' },  // optional close-up entrance
  quote: 'Try and stop me!',                 // optional line said in the close-up
  rival: 'celeste' },                        // optional: double damage both ways against that card
```

`rarity`: `common` `rare` `epic` `legendary`. `copies: n` overrides how many a deck may hold (`MB.RARITY[r].copies`). Tokens (`token: true, name, emoji`) are summonable only.
Item card: `{ type: 'spell', cost, rarity, target?, filter?, effect, color, name?, cast? }`, id = the manifest item id.
`cast` (untargeted item cards): `lob` (default: rises and fades) · `nuke` (flies over the enemy row and blasts it) ·
`call` (rings like a phone) · `coins` (coin bursts).
Power: `{ name, cost, target?, filter?, effect, emoji? }`; `emoji` flies to the targets instead of the glowing orb
(ability specs take `emoji` too).

Game rules (leader HP, max gold, hand size, opening hand, deck size) are `MB.RULES` at the top of data.js.

## Keywords (`kw`)

`taunt` must be attacked first · `haste` attacks the turn it's played · `ranged` no counter-damage ·
`shield` blocks the first damage · `lifesteal` its damage heals your leader · `poison` destroys what it damages ·
`frenzy` attacks twice · `freeze` what it damages skips an attack · `burn` sets what it damages ablaze ·
`guardian` takes damage aimed at your leader · `stealth` untargetable until it attacks ·
`tipsy` ignores Taunt but hits a random enemy · `rebel` ignores Taunt.

## Attack styles (`attack.style`, game/js/fx.js)

Generic (any character; ✱ = uses `attack.emoji`):
- `dash` rush in + jabs · `slam` leap and body-slam (big/tough) · `barrage`✱ volley of projectiles (default ✦)
- `confetti` "HA!" and confetti (jokers) · `beam` charged beam (cool/tech) · `orb`✱ spinning orb + petals (gentle/magic, default 🌸)
- `bounce` hops over (small/cute) · `bolt` hex cloud + lightning (dark/moody) · `spin` spinning curve (agile)
- `boomerang`✱ thrown object that returns (default 🍳) · `coins` coin rain (rich) · `frost`✱ thrown object + frost (default 🍦)
- `wave` water wave · `slash` teleport + three slashes (swords, claws, ninjas) · `shower`✱ rain of emoji on the target
- `shout` shouts `attack.shout` (or the attack name), the words fly and burst (loud, bossy, cheerleaders)
- `uppercut` rising punch · `stumble` drunken wobble

Character-flavored but reusable: `hellfire` fire pillars · `halo` holy light · `heartbreak` tsundere heart ·
`pages` book blizzard · `paint` paint splash · `yawn` sleepy cloud · `lingo` words in many languages ·
`scar` X cut · `dragon` dragon breath · `latte` coffee splash · `mail` letters + parcel · `cart` shopping cart ·
`parkour` flip kick · `jaws` shark fin + chomp · `suplex` grab and slam · `surf` surfs in on a wave ·
`whale` huge shadow breach · `hammer` giant hammer · `scythe` tail whip + bandage · `coffee` chug + curse ·
`stamp` paperwork + stamp (`mark`, default DENIED) · `hyper` zig-zag at full speed (`words`) · `hoops` basketball dunk ·
`katana` iaido blink-through + three thrusts · `darkflame` magic circle + dark flame pillars marching over ·
`dolphin` dolphins leap and splash · `syringe` giant syringe jab · `stare` shadow, two eyes, freeze ·
`pompom` cheer letters (`shout`) + pom-poms · `lasso` rope it and yank · `flask` two flasks react in colored smoke ·
`redcard` whistle + red card slap · `warfan` banners rise round the target + fan gale ·
`enlargo` grows giant, two stomps and a crater · `hora` hypno spiral, then a flurry of fists · `riff` amp + power chord,
sound waves and a lightning solo · `pizza` dough spun overhead, toppings, frisbee, cheese strings · `barslide` a bar counter,
a mug slides down it and smashes · `coinflip` heads: flips itself onto the target, tails: the coin does · `formo` turns into
the target's double and hits it · `yandere` stamped quest form, red glare, axe · `piano` light keyboard, a run of notes, the
chord · `siren` notes lure the target closer, the sea closes over it · `icecross` an ice cross forms and drops ·
`trashfire` kicked trash bin + flicked cigarette = fire · `mercy` doves circle, feathers, soft light · `teaspill` trips with
the tea, then a cursed blade's eye opens · `redcarpet` carpet rolls out, flashbulbs, strut, hair flip · `wires` circles the
target stringing razor wire, pulls it tight, loot falls out.
Effect styles (any fx below as a style): `meteor` `tornado` `blackhole` `missiles` `vines` `runes` `bubble` `clones` `snipe`
`volcano` `kiss` `blades` `hack` `camera` `gravity` `spikes` `melody` `ninja` `timestop` (`emoji` = their prop).

Lines: `cry` (said as it winds up) and `finish` (over the target after the hit) work with every style and replace
the style's own line where it has one; `sfx` adds an impact sound (any name from the Entrances `sfx` list). `lingo`/`hyper` take `words` [..], `stamp` a `mark`,
`shout`/`pompom` a `shout`. Keep lines ≤ 30 chars.

## Attack recipes (no `style`)

Build a new-looking attack from parts, no code:
```js
attack: { name: 'Cat Scratch Combo', color: '#ff9a3c', move: 'blink', fx: 'slashes', hits: 3,
  cry: 'Chat, watch this!', scatter: ['🐾', '💬', '❤️'], finish: 'Nya~ GG!' }
```
- `move` (how the attacker gets there): `stay` (winds up at home) · `float` (rises glowing, magic) · `dash` · `leap`
  (jumps over and lands) · `blink` (vanishes, appears beside the target) · `spin` · `hop` · `zigzag` · `fly` · `dive`
  (sinks into the floor, pops up) · `charge` · `slide` · `portal` (steps through a portal, out of another by the target)
- `fx` (what hits, from where the move left it): `hit` (melee jabs) · `throw` (props arc over) · `volley` (many glowing
  props) · `rain` (props fall on the target) · `orbit` (props circle in) · `slashes` · `pillar` (light columns) · `beam` ·
  `bolt` (lightning) · `stamp` (`mark`) · `words` (`words` fly over) · `quake` (shockwaves along the floor)
- `prop`: emoji or list for throw/volley/rain/orbit · `hits`: how many (1-20) · `floor`: `splat` `frost` `sigil`
  `whirlpool` `ring` decal · `scatter`: emoji flung out on impact · `big`: bigger hit + shake · `shake`: strength
- Defaults: fx `hit` → move `dash`; other fx → move `stay`; move only → `hit` (melee) or `throw` (stay/float).
  `hit` with `stay`/`float` punches thin air (the checker warns).
- Without an `intro` the card enters the way it moves (`leap` → drop, `blink` → zoom...), flinging its props.

Duo styles (bonds; they animate two partners): `combo`✱ tag-team (tier 1 default, `emoji` = the prop) ·
`dojo` karate flurry · `waltz` dance + ring · `jackpot` 777 slot · `miracle` present + group hug ·
`harmony` fire & light helix · `gothic` blood moon + bats · `sleepover` pillow fight · `party` disco ·
`lesson` chalkboard + ruler · `cheerchain` cheer + chain · `howl` moon + spirit wolf · `twinstar` sun & gloom ·
`breakfast` pancake stack · `riptide` whirlpool · `restock` stockroom avalanche · `flashbang` blind + vault ·
`feeding` two fins · `tidal` wave + crabs · `workshop` smash & stitch · `yuri` lilies + hearts · `alleyoop` lob + dunk.
Single styles work for duos too.

## Entrances (`intro`, game/js/cards.js)

Default: the entrance named like the attack style. Every single-character style has one except `shower` and
`shout` (give those an `intro`); recipes get one from their move; without one the sprite just slides in. A string picks another style's
entrance (e.g. a `shout` card with `intro: 'hellfire'`). A recipe:
- `move`: `drop` (falls, shakes the screen) · `slide` (dashes in with afterimages) · `rise` (from below) ·
  `pop` (springs up) · `fade` (glows in) · `spin` (spins in) · `zoom` (from the camera) · `sneak` (peeks, then
  hops in) · `hop` (three hops) · `grow` (tiny, then too big, stomps) · `portal` (steps out of a portal) · `strut`
  (walks in slowly, hips swaying)
- `fx`: `spray` (sparks, default) · `fling` (throws `emoji` around on landing) · `swirl` (`emoji` circle in
  first) · `rain` (`emoji` fall first) · `confetti` · `column` (light pillar) · `flash` (screen flash) · `smoke`
- `emoji`: list for fling/swirl/rain · `sfx`: `sparkle` `slam` `zap` `splash` `heal` `coin` `whoosh` `hit` `buff` `beam`
  · cartoon: `boing` `bonk` `pow` `pop` `squeak` `zip` `honk` `wobble` `tweet` `splat` `twang` `chomp` `ding` `whistle` (referee)
  `whistleUp` `whistleDown` (slide whistles) `bubble` `blink` `punch` `flip` (coin flip) `slide` (glass on a bar) `stretch` (rope)
  · elements: `fire` `burn` `frost` `shatter` `wave` `holy` `fusion` (bond merge) `thunder` `dark` `wind` `boom`
  · attacks: `choir` `laugh` `incoming` (falling bomb) `tornado` `vortex` `missile` `vines` `rune` `shuriken` `melody` `poof`
  `gunshot` `scope` `lava` `kiss` `swish` `clang` `glitch` `camera` `tick` `stab` `cheer` `scythe` `surf` `guitar` `piano`
  `axe` `glass` `flutter` (wings) `stomp` (giant step) `grow` `trash` `drumroll` `gong` `sizzle` `applause` `hypno` `warp`
  `unsheathe` `siren` (singing) · card packs: `crinkle` `foil` `rip` `tear` `cardflip` `deal` `riser` `loot` `gem`
  `fanfare` `fragment` `tink` `unlock` `thud` `swipe` `heartbeat` `glint`. Recorded files in game/assets/sounds/ replace a synth sound
  of the same name (the SAMPLES table in audio.js)

The entrance ends with the card's `quote` (else the style's own line, "Hi!" for recipes).

## Relationships

```js
{ id: 'birk-and-son', pair: ['dan-birk', 'benjamin-birk'], costumes: [null, 'work-outfit'], tier: 2,
  name: 'Birk & Son', short: 'Birks', relation: 'Father & Son', bonus: [1, 2], kw: ['taunt', 'rebel'],
  onFuse: { ...spec },                              // tier 2-3; leave text out, it's generated
  attack: { style: 'restock', name: 'Clearance Sale', color: '#4caf6a' } },
```
Tier 1: `bonus` [0-1, 1], one keyword, `combo` with an `emoji`, no onFuse. Tier 2: bonus about [1, 2], two
keywords, an onFuse. Tier 3 (the novel's central couple/family): [2, 2], strong onFuse, a duo style.
`short` fits a badge (≤ 10 chars). The strongest tier wins when a character could fuse two ways.

`MB.BOND_SCENES[id]` (close-up; `lines` are said by the partners in pair order, ≤ 30 chars each):
- `lovers`: cuddle and hearts.
- `family` + `scene`: `meal` (`food`: 3 emoji on the table) · `movie` · `laugh` · `strict` (a parent drills the
  kid: `paper`, `score`, `order`, `drill` [4 words], `praise`).
- `rivals`: argue and clash; `colors` [a, b]; optional `guard` [2 lines] when they team up to protect you.
- `friends`: high-five.
- `school` + `scene`: `class` (`board`: chalkboard text) · `club` (`props` [2 emoji], `bits` [[..], [..]]
  that swirl together into `result` emoji, `cheer`).

Shared scene variants (`scene`; the kinds that may use each are in `SCENE_VARIANTS`, cards.js):
- `mirror` (rivals, partners): a mirror between them, they copy each other's moves until one doesn't; it shatters.
- `duel` (rivals, partners, mentor): face-off, a leaf falls, they dash past each other; `winner` 0/1 (else both drop), `emoji` = the wind.
- `tug` (rivals): tug of war until the rope snaps; `emoji[0]` tied in the middle.
- `hypnosis` (rivals): `hypnotist` 0/1 swings a spiral, the other resists; works with `guard` (+ `guardEmoji`, `guardWord`).
- `photoshoot` (lovers, family, friends): red carpet, flashbulbs, poses, a magazine cover with `caption`.
- `bearhug` (family, friends): `hugger` 0/1 charges in, lifts, squeezes, spins.
- `bar` (lovers, family, friends): a drink (`food` [2]) slides down the counter, a toast, hiccups.
- `concert` (family, friends, school, mentor): stage lights, amps, headbanging on the beat, ENCORE; `emoji` = notes.
- `cook` (lovers, family, friends): ingredients (`food`) arc into a pan, it sizzles, `result` is served.
- `etiquette` (family, school, mentor): `teacher` 0/1 makes the other walk with a book on their head; `order` on the fail.
- `harvest` (family, friends): `food` rains into a tub, they stomp it, a `result` bottle pops out.
- `dressup` (friends): a folding screen in front of `model` 0/1 (default 1), clothes (`emoji`) fly out, the reveal.
- `interview` (mentor): desk, résumé, past jobs (`jobs` emoji) spill out, the boss (`mentor` 0/1) reads, `stamp`, handshake.
- `standup` (rivals, friends): a spotlight each, the mic passes per line, rimshot (`rim`) + tomato after each; they crack up.
- `flair` (lovers, friends): bottles (`food`) juggled between them, poured into `result`, cheers.
- `patrol` (partners): flashlight beams sweep the dark (use `backdrop: 'night'`), something (`emoji[0]`) sneaks in, `freeze`.
- `confession` (rivals): lattice screen, the `sinner` 0/1 confesses, sins (`emoji`) fill a `meter`, `alarm`, the other lunges.
- `shrine` (rivals): corkboard fills with photos of YOU (`face`, `caption`), both grab the last one, it rips in half.
- `solve` (school, crush): chalkboard `steps`, the first flexes (`flex`), the second is flustered (`fluster`), `answer`.
- `boxing` (rivals, partners): three rounds (`emoji` [a's, b's] blows), double K.O., the count, fist bump.
- `scheme` (partners): chessboard, pieces (`emoji`) moved with `laughs` [a, b], a crown (`result`), hidden daggers.
- `bakeoff` (rivals, friends, family): an oven each, `food` [a's perfect one, b's explodes into it], judges' `scores`.
- `rescue` (lovers, friends): water rises, the `swimmer` 0/1 flails, lifebuoy, reeled in, the lifeguard's `grin`, faint.
- `nap` (lovers, family, friends): hammock, zzz, alarm clock, a thrown `throw` emoji sends it flying.
- `poker` (rivals, friends): felt table, deal, the `gambler` 0/1 goes `allin` and wins (`hand`, `brag`), the other takes the pot.
- `auction` (rivals): `result` on show, paddles with rising `bids`, gavel (`gavel`), the `winner` 0/1 takes it, the loser fumes.
- `reading` (family, friends, school): candle, books (`food`), a ghost (`emoji[0]`) creeps up, `boo`, they laugh.

## Story

```js
MB.CHAPTERS.push({ title: 'Novel Title' });
{ chapter: 15, foe: 'char-id', bg: 'Background name', music: 'music-id', intro: 'In-character line.' },  // at the end of MB.STORY
// game/js/story.js, in the quests of the act that fits the novel:
{ foe: 'char-id', side: true, from: 'jane', at: [62, 48], title: 'Short Quest Title', text: 'One or two sentences for the map panel.' },
```
`chapter` is the index into MB.CHAPTERS. `bg` is a background *name* from the brief, `music` a music id. HP and AI
skill are set from the quest's place in the story (js/story.js).
