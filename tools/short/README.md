# "<Novel> is in Miku Battle!" shorts

A vertical 1080x1920, ~25 s YouTube Short for a novel that was added to the game. It is built from the game's own
sprites, portraits, backgrounds, card stats and the novel's own song. One JSON file per novel, no code to change.

```
node tools/short/render.js <id> peek 1.2 4.5 22   # stills to output/short/<id>/peek/ (check the look first)
node tools/short/render.js <id> all               # output/miku-battle-<id>-short.mp4 (a few minutes)
```

Needs Chrome and ffmpeg. `output/` is git-ignored.

## Make one for another novel

1. Copy `configs/adoptive-life.json` to `configs/<id>.json`.
2. Set `novel` (the name in `MIKU_MANIFEST.novels`) and `title` (two words: the first line, the big second line).
3. `music.id` is a song id of that novel (see `music` in `assets/manifest.json`). Leave out `bpm` and `offset` and the
   first render measures them (`bpm.js`) and writes them back; a wrong tempo makes the cuts land off the beat, so
   check by ear and set both by hand if needed.
4. `bgs` are background names (as in the manifest; one that is not on disk is skipped). The first is the intro, the
   last is the stats slide's, the rest rotate behind the cast.
5. `cast` is 4-8 characters in the order they appear: `id`, `tag` (the role line on their card) and `mood`
   (`idle`, `play`, `attack`, `special`, `hurt`, `lose`, `win`, `taunt`: which sprite). Put the strongest first and last
   (the first two also stand either side of "is in Miku Battle!").
6. `accent` / `accent2` colour the title, wipes and sparkles. Each character's card takes the colour of their attack.
7. Optional: `kicker`, `credit` (the small line at the end), `url`, `stats` (`[[16, "CHARACTERS"], ...]`; by default the
   numbers are counted from the game: characters, duo bonds, items, signature attacks).

Card rows (cost, ATK, HP, rarity, attack name) come from `MB.CARDS`, so a new novel needs its cards in `js/data.js` first.

## How it works

`short.html` draws a frame as a function of time only (`window.frame(n)`), so `render.js` can grab frames over the
DevTools protocol and pipe them to ffmpeg. Timing is counted in beats of the song: intro 6, 4 per character, grid 6,
stats 4, finale 10. The page also lists the sound effects (`window.TIMELINE.events`, from `assets/sounds/`) and the
hits that shake the screen and split the colours; `render.js` mixes them under the song, which starts on its first
beat. Fonts are Lilita One and Baloo 2 (OFL), in `fonts/`.
