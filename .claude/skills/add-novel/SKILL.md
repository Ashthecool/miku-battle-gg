---
name: add-novel
description: Add miku.gg novels to Miku Battle. Use when new novel exports appear in novels/ or the user asks to add a novel, its characters, cards, relationships or story chapter to the game, or to upload its images to Supabase. Covers checking outfits, uploading assets, and writing cards, powers, bonds and chapters as data (no engine code).
---

# Add a novel to Miku Battle

Everything a novel brings is **data in `game/js/data.js`**: cards, leader powers, relationships and a story
chapter. Abilities are effect specs (`effects.md`), animations are picked from a catalog (`catalog.md`).
Only write engine/animation code when a concept truly can't be expressed; if so, add it to `effects.js` or the
catalog generically so the next novel can reuse it, and document it in this skill.

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

Novels can hide explicit or underwear outfits behind plain names ("Diana 4"). The asset tool already drops
characters named narrator/placeholders without a description, outfits named nude/topless/naked/CG, and outfits
whose emotion set contains adult-only emotions (`ADULT_EMOTIONS`). For the rest:

```sh
py tools/outfit_sheets.py <scratch>/sheets "<part of title>" ["<another>"]
```

It only shows the characters that pass `ONLY_CHARACTERS`, so pick the cast first.

Read **every** sheet. Add to `SKIP_OUTFITS` in `tools/fetch_assets.py` (as `"character-id/outfit-id"`, the
label on the sheet) anything that is nude, underwear/lingerie, only a towel, an open shirt with nothing under
it, a silhouette/placeholder or blank. Swimwear and ordinary clothes are fine. Re-run the sheets for a character
you changed if unsure. If a character's *main* outfit is unfit, the next one becomes main automatically.

## 4. Upload the images

Needs the Supabase secret key (`sb_secret_...`). Ask the user if it isn't in the conversation or environment;
pass it only as an env var on the command line, never write it to a file or commit it.

```sh
SUPABASE_SECRET_KEY=sb_secret_... py tools/fetch_assets.py > <scratch>/fetch.log 2>&1   # run in background
```

It skips files already in the bucket and rewrites `game/assets/manifest.{json,js}` at the end (ids, costumes,
songs, backgrounds). A novel adds ~15-30 MB per 10 characters; the free bucket holds 1 GB. Check the log for
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
- **`MB.CHAPTERS`** + **`MB.STORY`**: one chapter per novel, 4-8 foes, rising `hp` (20 → ~40) and `ai`
  (0.3 → 1.0), each in a fitting background (by name) with fitting music (id) and an in-character intro line.
  The last foe is the novel's main character or boss.
- `MB.HIDDEN_COSTUMES` for costumes that aren't real clothes (a pose, a hurt variant).

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

## 7. Check

```sh
node tools/check_game.js          # validates every reference, then 300 AI-vs-AI battles
node tools/check_game.js --texts  # also prints the generated card/power texts to proofread
```

Fix every ERROR. Read the texts: if one reads badly, simplify the spec or give the card a `text`.
Then open the game (serve `game/`, e.g. `npx serve game`) if you can, and look at a few new close-ups.

## 8. Finish

- README: add the novel titles to the intro line.
- `game/sw.js`: bump `ASSETS` only if images at *existing* paths changed (new files need nothing).
- Commit and push to `main` (deploys Pages).
