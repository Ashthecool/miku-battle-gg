# "<Novel> is in Miku Battle!" shorts

A vertical 1080x1920, ~28 s YouTube Short for a novel that was added to the game. Every cast member gets a slot of
**real gameplay**: their signature attack, recorded from an actual battle in the game, with slow motion on the hit and
the game's own sounds. Around it: a title slam, a portrait grid, stat stamps and a call to action, all cut on the beat of
the novel's own song. One JSON file per novel, no code to change.

```
node tools/short/capture.js <id>                  # 1. play the battles and record the attacks (about 10 min)
node tools/short/render.js <id> peek 4.5 8.9 22   # 2. stills to output/short/<id>/peek/ (check the look first)
node tools/short/render.js <id> all               # 3. output/miku-battle-<id>-short.mp4 (about 8 min)
```

Needs Chrome and ffmpeg. `output/` is git-ignored. Without a capture the cast slots fall back to sprite cards.

## Make one for another novel

1. Copy `configs/adoptive-life.json` to `configs/<id>.json`.
2. Set `novel` (the name in `MIKU_MANIFEST.novels`) and `title` (two words: the first line, the big second line).
3. `music.id` is a song id of that novel (see `music` in `assets/manifest.json`). Leave out `bpm` and `offset` and the
   first render measures them (`bpm.js`) and writes them back; a wrong tempo makes the cuts land off the beat, so
   check by ear and set both by hand if needed.
4. `bgs` are background names (as in the manifest; one that is not on disk is skipped). The first is the intro, the
   last is the stats slide's, the rest rotate behind the intro and finale.
5. `cast` is 4-8 characters in the order they appear: `id`, `tag` (the role line) and `mood` (the sprite used on the
   finale: `idle`, `play`, `attack`, `special`, `hurt`, `lose`, `win`, `taunt`). Put the strongest first (the first two
   also stand either side of "is in Miku Battle!").
6. `battle` says how to record them (`capture.js`): `bg` (a background name), `leader`, `foe` (the other leader),
   `foeDeck` (cheap monsters, so there is something to hit), and `groups`: the cast split into battles of at most 4.
   **Characters that share a relationship (`MB.BONDS`) fuse when they stand together**, so keep bonded pairs in
   different groups (the fusion would replace the attack you came for).
7. `accent` / `accent2` colour the title, wipes and sparkles. Each character's card takes the colour of their attack.
8. Optional: `kicker`, `credit` (the small line at the end), `url`, `stats` (`[[16, "CHARACTERS"], ...]`; by default the
   numbers are counted from the game: characters, duo bonds, items, signature attacks).

Card rows (cost, ATK, HP, rarity, attack name) come from `MB.CARDS`, so a new novel needs its cards in `js/data.js` first.

## How it works

`capture.js` serves `game/` locally with the asset base pointed at the local files, opens it in headless Chrome and
starts a real `MB.Battle`: a director plays the cast's cards and attacks with each of them once, and the game's own AI
plays the foe. Time is virtual (`Emulation.setVirtualTimePolicy`), so GSAP, timers and CSS animations advance exactly
1/30 s per frame whatever the screenshots cost, and the stretches between attacks are skipped. `output/short/<id>/battle/g*/`
holds the 2400x1350 frames and `log.json` (when each attack starts, lands and ends, plus every sound the game played).

`short.html` draws a frame as a function of time only (`window.frame(n)`), so `render.js` can grab frames over the
DevTools protocol and pipe them to ffmpeg. Timing is counted in beats of the song: intro 6, 5 per character, grid 6,
stats 4, finale 10. A clip's frames are remapped (quick wind-up, slow motion over the hit, quick finish) and the game's
sounds are placed where they happened. The page also lists the sound effects (`window.TIMELINE.events`, from
`assets/sounds/`) and the hits that shake the screen and split the colours; `render.js` mixes them under the song, which
starts on its first beat. Fonts are Lilita One and Baloo 2 (OFL), in `fonts/`.
