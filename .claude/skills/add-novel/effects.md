# Effect specs (game/js/effects.js)

An ability is `{ label, color, do }`. `do` is one step or a list of steps. `label` is the callout shown when a
triggered ability fires (defaults to the card's attack name) and `color` its orb color (defaults to the attack
color); item cards and powers ignore both.

```js
onPlay:  { label: 'Smash!', color: '#e0463c', do: [
  { op: 'damage', to: 'randomEnemy', n: 3 },
  { op: 'heal', to: 'mostHurtFriendly', n: 3 },
] },
// power / item card: the chosen target is `to: 'target'`; the card/power's own `target` field says what can be chosen
effect: { do: [{ op: 'damage', to: 'target', n: 1 }, { op: 'draw', if: 'targetDied' }] },
```

Where specs go: card `onPlay` `onDeath` `onTurnStart` `onAllyDeath` (each other ally that dies) `onHurt`
(whenever it survives damage), bond `onFuse`, item card `effect`, power `effect`.

Order: all board steps happen during the animation, in order; card steps (`draw`, `addCard`, `summon`) run
after it, in order.

## Steps

| op | fields | does |
| --- | --- | --- |
| `damage` | `to`, `n` | deals n damage (hitting your own leader skips Guardians) |
| `heal` | `to`, `n` or `'full'` | restores HP, also puts out Burn |
| `buff` | `to`, `atk`, `hp` | +atk/+hp (negative atk for debuffs) |
| `freeze` / `thaw` | `to` | frozen monsters skip their next attack |
| `ignite` | `to` | Burn: 1 damage each turn until healed |
| `shield` | `to` | blocks the next damage |
| `kill` | `to` | destroys a monster |
| `swap` | `to` | swaps ATK and HP |
| `strip` | `to` | removes all keywords and Shield |
| `keyword` | `to`, `kw` | adds a keyword (see catalog) |
| `ready` | `to` | can attack again this turn (on your turn) |
| `gold` | `n` | +n gold this turn |
| `draw` | `n`, `pick?` | draws n; `pick`: `cheapest` `priciest` `item` `unit` card of the deck |
| `addCard` | `card`, `n`, `costMod?` | adds a card to the hand; `card` can be `randomItem` or `randomUnit` (+`maxCost`) |
| `summon` | `card`, `n` / `from: 'deck'` / `card: 'randomUnit', maxCost` | puts characters/tokens on the board |

Every step may also have:
- `where`: narrows the targets: `hurt` `oddAtk` `evenAtk` `frozen` `unfrozen` `taunt` `shielded` `burning`
  `cheap` (cost ≤ 3) `big` (ATK ≥ 4) `monster` (not a leader).
- `if`: only runs when: `targetDied` `targetAlive` `selfAlive` `handSmall` (≤3 cards) `hasAllies` `noAllies`
  `behind` (your leader has less HP) `outnumbered` (fewer monsters than the enemy).
- `times`: repeat a random pick (`randomEnemy` `randomEnemyAny` `randomAlly`) that many times.
- `say`: the float text for `buff`/`keyword`/`swap`/`strip`/`ready` (keyword default: "Taunt!").

Targets skip what an op can't affect (heals pick hurt ones, freeze the unfrozen, shield the unshielded...),
and random/"strongest" picks never pick Stealth enemies.

## Targets (`to`)

| to | who |
| --- | --- |
| `self` | the card itself (triggers only) |
| `target` | the chosen target (item cards and powers only) |
| `allies` / `allAllies` | your other monsters / all your monsters |
| `randomAlly` / `strongestAlly` | one of your other monsters |
| `myLeader` / `friendly` / `mostHurtFriendly` | your leader / all your characters / the most injured one |
| `enemies` / `enemyLeader` / `enemyAll` | enemy monsters / enemy leader / both |
| `randomEnemy` / `randomEnemyAny` | a random enemy monster / enemy monster or leader |
| `strongestEnemy` / `weakestEnemy` | highest ATK / lowest HP enemy monster |
| `everyone` / `otherMonsters` | every monster on the board / all but itself |

## Choosing targets for item cards and powers

`target`: `enemyUnit` `allyUnit` `anyUnit` `enemyAny` `friendlyAny` (none = no choice).
`filter` (optional): `lowAtk` (ATK ≤ 2), `sick` (just played), `guarded` (Taunt or Shield), `hasKw`,
`noRebel`, `spent` (already attacked).

## Card text

Missing `text` is generated, e.g. `{ op: 'damage', to: 'enemies', n: 2 }` in `onPlay` →
"On play: deal 2 damage to all enemy monsters." Check them with `node tools/check_game.js --texts`; give the
card a `text` when the generated one is clumsy (keep it true to the spec).

## AI

The enemy uses specs on its own: targeted ones on the best target for the first `to: 'target'` step (enemies
for damage/kill/freeze/ignite/strip/debuffs, own side otherwise), untargeted ones whenever they'd do
something. Draw-only effects wait while the hand has 7+ cards; `gold` waits until it unlocks a card.

## Examples from the game, rewritten as specs

```js
'maria-hunley' onPlay:   { label: "Mom's Hug", do: { op: 'buff', to: 'allies', hp: 2 } }
'julie-hunley' onDeath:  { label: 'Giddy Pop!', do: { op: 'damage', to: 'randomEnemyAny', n: 1 } }
'fami-maft' onPlay:      { do: { op: 'summon', card: 'kid', n: 2 } }
'janice' onTurnStart:    { label: 'Bookworm', do: { op: 'draw', if: 'handSmall' } }
'mr-dino' onPlay:        { label: 'Pop Quiz!', do: { op: 'damage', to: 'enemies', where: 'oddAtk', n: 2 } }
'betty-glee' onHurt:     { label: 'Scarred!', do: { op: 'buff', to: 'self', atk: 1 } }
'andrea-lyle' onAllyDeath: { label: 'Spite!', do: { op: 'buff', to: 'self', atk: 2 } }
water gun item:          { do: { op: 'damage', to: 'randomEnemyAny', n: 1, times: 3 } }
Dark Joke power:         { target: 'enemyUnit', effect: { do: [{ op: 'damage', to: 'target', n: 1 }, { op: 'draw', if: 'targetDied' }] } }
Take Charge power:       { target: 'allyUnit', filter: 'spent', effect: { do: [{ op: 'buff', to: 'target', atk: 1 }, { op: 'ready', to: 'target' }] } }
```
