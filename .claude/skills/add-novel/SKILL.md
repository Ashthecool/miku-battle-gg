---
name: add-novel
description: Add miku.gg novels to Miku Battle. Use when new novel exports appear in novels/ or the user asks to add a novel, its characters, cards, relationships or story chapter to the game, or to upload its images to the R2 bucket. Covers checking outfits, uploading assets, writing cards, powers, bonds, chapters and story quests as data (no engine code), and crediting the novel's creator in the Credits modal.
---

# Add a novel to Miku Battle

Everything a novel brings is **data in `game/js/data.js`**: cards, leader powers, relationships and a story
chapter. Abilities are effect specs (`effects.md`), animations are picked from a catalog (`catalog.md`).
Only write engine/animation code when a concept truly can't be expressed; if so, add it to `effects.js` or the
catalog generically so the next novel can reuse it, and document it in this skill.
For a new or changed character attack, apply the [attack-animation helper](../attack-animation/SKILL.md) before deciding the style and checking its visible impact.

Scratch output (sheets, brief, logs) goes to the session scratchpad, never the repo. `novels/` and
`game/assets/*` images are gitignored; only `game/assets/manifest.{js,json}` are committed.

## 1. Find what's new

`novels/*.json` are miku.gg exports (history or `.novel` files). Novels already in the game are listed in
`game/assets/manifest.json` → `novels`. Titles that aren't there are new.

## 2. Pick the cast

A novel brings at most **about 12 characters**. If it has more, choose the core ones (the lead, their family
and closest friends, a rival or two, whoever the write-ups revolve around; prefer characters with several
relationships to each other) and list their ids in `ONLY_CHARACTERS` in `tools/fetch_assets.py`, keyed by the
novel title. Ask the user if the choice isn't obvious. Alternate-universe copies of a character count as
separate characters; usually leave them out.

## 3. Check the outfits by eye

NSFW content is downloaded too, but tagged `nsfw: true` in the manifest; the game shows it only with
⚙️ → NSFW mode on (`game/js/content.js` removes it otherwise, with every card, bond and chapter built on it).
The asset tool tags an outfit NSFW when the export flags it (`outfit.nsfw = 1`), its name matches `NSFW_NAME`,
or it has adult-only emotions (`ADULT_EMOTIONS`). The export's flag misses a lot, so check by eye:

```sh
py tools/outfit_sheets.py <scratch>/sheets "<part of title>" ["<another>"]
```

It only shows the characters that pass `ONLY_CHARACTERS`, so pick the cast first.

Read **every** sheet. Add to `NSFW_OUTFITS` in `tools/fetch_assets.py` (as `"character-id/outfit-id"`, the
label on the sheet) anything that is nude, underwear/lingerie, only a towel or an open shirt with nothing under
it; blank or placeholder art goes into `SKIP_OUTFITS`. Swimwear and ordinary clothes are fine. Safe outfits come
first, so the first safe one is the character's usual look; a character with no safe outfit is NSFW as a whole.
Look at the backgrounds too: names matching `NSFW_NAME` are tagged, but a novel whose scenes are mostly
explicit goes into `NSFW_NOVELS` (all its characters, backgrounds, items and music are NSFW). Its cards, bonds
and chapter are only playable in NSFW mode; keep their texts non-explicit anyway. Bond costumes must be safe
outfits (the checker warns), and story backgrounds must not share a name with an explicit one (`bgByName`
takes the first match).

## 4. Upload the images

Needs the R2 keys (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`). Ask the user if they aren't in the
conversation or environment; pass them only as env vars on the command line, never write them to a file or commit them.

```sh
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... py tools/fetch_assets.py > <scratch>/fetch.log 2>&1   # run in background
```

It skips files already in the bucket and rewrites `game/assets/manifest.{json,js}` at the end (ids, costumes,
songs, backgrounds). A novel adds ~15-30 MB per 10 characters; R2's free tier holds 10 GB. Check the log for
`FAIL` lines (failed images are left out of the manifest automatically). Characters whose name exists in an
earlier novel get a suffix (`keiko-atarashi`); same-named characters inside one novel are merged.

## 5. Read the brief

```sh
py tools/novel_brief.py > <scratch>/brief.md          # novels with characters that have no card yet
py tools/novel_brief.py "New Haven" > <scratch>/nh.md  # or name them
```

Per character: id, short description, traits, costume ids, who else they mention, and the write-up. Also the
novel's items, background names and music ids. Design from this; don't open the raw exports.

## 6. Write the content in `game/js/data.js`

Add a commented section per novel in each table, in the novel's order. See `catalog.md` for every field.

- **`MB.CARDS[id]`** for every character: `cost, atk, hp, rarity, kw, attack {style, name, color, emoji?}`,
  optional abilities (`onPlay`, `onDeath`, `onTurnStart`, `onAllyDeath`, `onHurt` as effect specs), `intro`,
  `quote`. Leave `text` out: it's written from the specs (write it only for named legacy abilities).
- **`MB.POWERS[id]`** for every character: `name, cost, target?, filter?, effect` (spec), optional `sfx` (a sound name from catalog.md, default sparkle).
- **Item cards**: each inventory item in the brief can become `MB.CARDS[itemId] = { type: 'spell', cost,
  rarity, target?, effect, color }` (skip ones that make no sense, like money duplicates).
- **`MB.BONDS`** + **`MB.BOND_SCENES`**: 2-6 relationships per novel from the write-ups (family, lovers,
  friends, rivals, classmates). Costumes must be costume ids of that character (or `null`).
- **`MB.ITEM_NOVELS`**: list the novel's item cards under its name (the manifest doesn't say which novel an item
  is from; rival decks and the collection's novel filter need it).
- **`MB.COMBOS`**: 1-3 item combos per novel, where an item plainly belongs to a character (its description
  names them, it's their tool or gift): `{ char, item, name, short, costume?, bonus: [atk, hp], kw?, onCombo?, line }`.
  Use a costume that shows the item when there is one (a "holding water gun" outfit). Budget: about +2 stats
  plus one keyword or a small `onCombo` effect. `short` fits the board plate (≤ 12 characters).
- **`MB.CHAPTERS`** + **`MB.STORY`**: one chapter per novel, 4-8 rivals appended at the end of `MB.STORY` (saves
  keep stars by index), each in a fitting background (by name) with fitting music (id) and an in-character intro
  line. The novel's main character or boss gets a boss rule in `MB.BOSSES`.
- **Story quests** (`game/js/story.js`): Story is one story told on the maps of four acts, so every new rival also
  needs a quest there. Put the novel's rivals as **side quests** on the act whose map and setting fit it best (a
  town/school novel in Act 1, a city/campus/beach one in Act 2, a Japanese one in Act 3, a fantasy or mountain one
  in Act 4): `{ foe, side: true, from: 'quest id', at: [x, y], title, text }`, `from` being the main quest (or a
  side quest of the same novel, to chain them) after which they open, `at` a free spot on the map in %, away from
  the main path. HP and AI skill come from where the quest sits in the story; don't set them. Only weave a novel
  into the main story (with `before`/`after` scenes) when the user asks; NSFW novels stay side quests. A brand-new
  map goes in the `map-images` bucket, then `py tools/sync_maps.py` copies it into the game (see the top of
  story.js for acts, quests and scene lines). A character with a `close` line gets a backdrop in `MB.CLOSE_LOOKS`
  (catalog.md). `node tools/check_game.js` checks every quest and plays the story through.
- `MB.HIDDEN_COSTUMES` for costumes that aren't real clothes (a pose, a hurt variant).
- **Outfit upgrades** (`upgrades` on a card, catalog.md) for a character whose novel is about changing costumes: the card
  changes outfits mid-battle for gold. Use it sparingly (a legendary).
- Novels with generic background names ("background 1") share them with other novels; name the story `bg` by its
  manifest id instead (`bgByName` takes ids too).

Design rules:
- **Flavor first**: each ability, power, attack name, quote and entrance should say something about who the
  character is (their job, quirk, catchphrase, relationships). Reuse the novel's own words and items.
- **Stat budget**: a card with no text has about `2 × cost + 1` total ATK+HP; each keyword or ability costs
  1-3 of that. `node tools/check_game.js` flags outliers.
- **Rarity mix per novel**: ~40% common, 30% rare, 20% epic, 10% legendary (the leads/bosses). Commons are
  owned from the start, so the common cards should be simple and fun.
- **Powers** cost 2 (small) or 3 (card draw, strong), never more; they must be usable most turns.
- **Variety**: don't give two characters of one novel the same attack style or entrance; mix the generic
  styles with `emoji`, give styles their own `cry`/`finish` lines, build attack recipes (`move` + `fx` + props),
  and use `intro` recipes. Colors should match the character's look.
- Bonds only between relationships the write-ups actually describe.
- Keep text short: the card box fits about 110 characters.

## 7. Credit the creator

Every novel in the manifest must be credited in `MB.CREDITS` (`game/js/credits.js`, the ♥ Credits modal on the title
screen); `check_game.js` fails until it is. Look the novel and its creator up on miku.gg's public API (no key needed);
the export's `author` is often not their miku.gg username:

```sh
curl -s "https://api.miku.gg/bots?take=12&search=<title>"   # pick the EN entry: id = novel id, author.{id,username}
curl -s "https://api.miku.gg/users/search?username=<username>"   # profilePic
```

- **Creator already credited** (same `author.id`): add `{ novel, id }` to their `novels`.
- **New creator**: add an entry `{ name, aka?, id, color, pic?, novels: [{ novel, title?, id }] }`. `name` is their miku.gg
  username, `aka` the name in the export when it differs, `color` a #rrggbb accent not already used by another
  creator, `pic` the `profilePic` path as the API gives it (leave it out when it's null: their initials show).
  Order the list by how many novels they have in the game.
- `novel` is the title exactly as in `manifest.json` → `novels` (it picks the faces, counts the cast and hides NSFW
  novels); `title` is a cleaner name to show when the manifest's has version numbers or tags.
- Not on miku.gg's search (unlisted)? Ask the user for the novel's or creator's miku.gg link; the ids are in the URLs
  (`miku.gg/novel-preview/<novel id>`, `miku.gg/author/<author id>`).

## 8. Check

```sh
node tools/check_game.js          # validates every reference, then 300 AI-vs-AI battles
node tools/check_game.js --texts  # also prints the generated card/power texts to proofread
node tools/check_game.js --sfw     # the same with NSFW mode off
```

Fix every ERROR. Read the texts: if one reads badly, simplify the spec or give the card a `text`.
Then open the game (serve `game/`, e.g. `npx serve game`) if you can, and look at a few new close-ups.

## 9. Finish

- README: add the novel titles to the intro line.
- `game/sw.js`: bump `ASSETS` only if images at *existing* paths changed (new files need nothing).
- Commit and push to `main` (deploys Pages).
