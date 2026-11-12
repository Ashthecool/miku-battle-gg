---
name: novel-short
description: Make the vertical YouTube Short "<Novel> is in Miku Battle!" for a novel that was added to the game, from real recorded gameplay of its characters' signature attacks. Use when the user asks for a short, trailer or announcement video for a novel or characters, or reports a character missing, vanishing, out of frame or wrongly posed in one of these videos.
---

# Novel shorts ("X is in Miku Battle!")

A ~30 s, 1080x1920 video: title slam, one slot per cast member showing **their real attack recorded from the game** (slow motion
on the hit, the game's own sounds), a portrait grid, stat stamps and a call to action, cut on the beat of a song. Everything lives
in `tools/short/`; a novel is one JSON file, no code. Its README has the field-by-field reference; this file is the method and
the rules that keep it from breaking.

## Step 0: ask first, every time (before any tool call)

At the very start of every use of this skill, before reading configs or running anything, ask the user (one `AskUserQuestion` call,
even when they named a novel in the request) and wait for the answers:

1. **Which novel or characters is the short about?** Offer the novels that have a config in `tools/short/configs/` plus the novels
   with uncommitted or recent new characters; "Other" covers the rest. Ask whether it is the full cast or a spotlight on specific
   characters (e.g. a rivalry).
2. **What style should it have?** Offer concrete options (accent colours, song mood, pacing), e.g. the config's current look as the
   recommended one, an alternative theme that fits the novel, and a cute/comedic one.

Use the answers to write or adapt the config (`cast`, `accent`, `accent2`, `music`, `bgs`, tags). Do not start a capture before both
are answered. Do not skip this because the config already exists or the user has used the skill before.

## Run it (in this order, from the repo root)

```
node tools/short/check.js <id>                    # preflight: every image and sound exists (disk or R2 bucket)
node tools/short/capture.js <id> [group]          # records the attacks from real battles, ~10 min, output/short/<id>/battle/
node tools/short/render.js <id> peek 4.5 8.9 ...  # stills to output/short/<id>/peek/ : LOOK at them (see "Look before you ship")
node tools/short/render.js <id> audit             # every gameplay frame loaded, every cut-out drawn
node tools/short/render.js <id> all               # audit, then the video: output/miku-battle-<id>-short.mp4, ~8 min
```

Run long ones with `run_in_background`. One run uses fixed ports and one Chrome profile; to run several at once give each its own `SLOT=<n>` env
(ports and profile are offset by 20 per slot), or use the batch runner:

```
node tools/short/batch.js capture <id...> --workers 5            # every battle group of every short, W at a time, a failed group retried once
node tools/short/batch.js render  <id...> --workers 4 --chunks 4 [--upload public]   # audit, frames in parallel chunks, join, mix, ffprobe/volumedetect, upload
```

What limits a batch on this laptop (measured Nov 2026, 6 shorts / 55 cast / 30 battle groups):
- **Power**: on battery (Balanced plan) the cores run at ~21-51% clock and half of them idle; plugged in, a group records in ~1 min and a 40 s short renders in ~4-5 min. Check `Win32_Battery.BatteryStatus` (2 = AC) before a big batch.
- **Memory**: 15.6 GB total, ~4 GB free with the editor and browser open. More than 2-3 Chromes at once fail (image decodes return width 0, so `audit` fails; ffmpeg pipes die with exit 3221226505). Use `--workers 2`.
- **Disk**: `output/short/` is ~0.4 GB per short and the cache grows by Chrome profiles; a full disk (`ENOSPC`) corrupts captures and crashes renders. Keep a few GB free; `rm` `output/short/cache/chrome-*` when no job runs (batch.js removes its own profile after each job and the render intermediates after the mix).
- Each job gets its own profile and an ephemeral debug port when `SLOT` is set; a slot reused right after another job otherwise meets its dying Chrome (`webSocketDebuggerUrl` of undefined).
- `render.js <id> mix` redoes only the sound mix from `timeline.json` + `silent.mp4`.
Run `check.js` for each id once before a parallel batch so the bucket art is cached and the jobs do not race to download it.
Needs Chrome and ffmpeg; there is no Python on this machine, so everything is Node.

## Upload to YouTube (automatic, last step of every short)

`tools/youtube/upload.js` (Data API v3, OAuth already set up: `tools/youtube/.token.json`, git-ignored; setup in `tools/youtube/README.md`).
Default for a short: **unlisted**, `--short` (adds `#Shorts`), title `<Novel> is in Miku Battle!`, a description file, tags.

1. Write `tools/youtube/descriptions/<id>.txt` (commit it): one line naming the cast, `Play free: https://miku-battle.org`, the config's `credit`
   line (fan-made and unofficial, novel by AshTheCool on miku.gg), hashtags `#MikuBattle #<Novel> #mikugg #Shorts`.
2. Run (about 2.5 min for 85 MB; use `run_in_background` or a long timeout):
   ```
   node tools/youtube/upload.js upload output/miku-battle-<id>-short.mp4 --title "<Novel> is in Miku Battle!" \
     --description-file tools/youtube/descriptions/<id>.txt --tags "Miku Battle,<Novel>,miku.gg,card game,visual novel" --privacy unlisted --short
   ```
3. Give the user the `youtu.be` link. Do this by default as the last step of every short, without being asked: once the mp4 has passed "Look before you ship", write the description file and upload it unlisted (several shorts: one background job, one upload at a time). Skip only if the user says not to upload. Upload only the finished mp4 that passed the checks.
   If `auth` is needed again, kill any stale `node ... upload.js auth` first (it holds port 53682); `whoami` shows the channel.
   Un-audited API projects are forced to private by YouTube; check the visibility in the result line.

## Tools to point at

| Tool | Does |
| --- | --- |
| `tools/short/configs/<id>.json` | the whole short: `novel`, `title`, `cast` (id, tag, mood), `bgs`, `music`, `accent`, and `battle` (how to record) |
| `tools/short/check.js` | preflight. Lists every sprite role, portrait, background, sound and song the short needs; says which come from the bucket; exits 1 if any is nowhere |
| `tools/short/lib/assets.js` | `find(rel)`: art from `game/assets/`, else the R2 bucket (cached under `output/short/cache/assets/`). Both servers use it |
| `tools/short/capture.js` | runs a real `MB.Battle` in the real game page under virtual time and records each cast member's attack (frames + `log.json`); fails on missing art or an unloaded attacker image |
| `tools/short/render.js` | serves `short.html`, `peek` / `audit` / `clip` / `all`; mixes the song and the effects |
| `tools/short/short.html` | draws a frame as a function of time (`window.frame(n)`, `window.audit()`); layouts, effects, timeline, sound cues |
| `tools/short/bpm.js` | measures a song's tempo and first beat (`node tools/short/bpm.js <file> [seconds]`) |

## Disappearing sprites: why it happened and the rules that stop it

**The incident.** Luther, James and Kayla vanished from the footage while attacking. Their `attack` sprite
(`luther-jones/amused.webp`, `james-lone/tired.webp`, `kayla-kate/annoyed.webp`) is in the R2 bucket but not in `game/assets/`. The
game swaps a unit to its `attack` sprite when it strikes; a server that only reads `game/assets/` answered 404 and the unit went blank.
The first "fix" (a cut-out beside the footage) hid the symptom; the cause was the missing file. Rules:

1. **Never serve the game from `game/assets/` alone.** Use `lib/assets.js` (disk, then bucket). `capture.js` and `render.js` do; a new
   tool must too. The game's own `MB.ASSET_BASE` is the bucket.
2. **Run `check.js` first** (capture and render do it for you). It checks all 8 sprite roles of every cast, battle and foe character, not
   only the ones you expect to see: any of them can be shown by an emotion change. A role that is nowhere stops the job. Fix it
   (upload to the bucket, or point the manifest at an existing file) instead of working around it.
3. **`capture.js` fails the run** when art the game asked for is nowhere (404 on `sprites/`, `portraits/`, `backgrounds/`) or when the
   attacker has an unloaded `<img>` at the moment of the hit. Do not use clips from a failed capture; re-record.
4. **The character is always drawn in the cast slot**: the cut-out switches idle, attack, win poses (`firstOf` falls back through
   similar poses, but only for a file that is genuinely absent everywhere). `audit` fails if a cut-out or a gameplay frame is missing.
5. **At most two cast members per recorded battle** (`battle.groups`): only the two middle slots are in the crop; a third stands at the
   board's edge and is cut off. **Bonded characters fuse when they stand together** (`MB.BONDS`) and the fusion's attack replaces the
   one you came for, so keep bonded pairs in different groups. (Cast pairs bonded in Adoptive Life: James+Kayla, Maiko+Hayley,
   Hayley+James, Hayley+Kayla, Maiko+James.)
6. **Look before you ship** (below). The audit proves files and frames exist; only your eyes prove the board looks right.

## Look before you ship

`node tools/short/review.js <id>` does the following for every cast member in one go (3 stills each, tiled 4 cast per image: `output/short/<id>/review-N.jpg`).
Use `peek` at, for every cast member, the wind-up (~0.3 s into their slot), the hit (~1.1 s) and the finish (~2.2 s), then open the
stills (Read tool; tile them with ffmpeg `hstack` to see several at once). For each:

- the character's board unit is visible before the attack and the cut-out is visible all the time, in the right pose;
- the attacker and its target are inside the gameplay window (the crop follows `clip.aim`, the midpoint of the two);
- name, attack name and stats do not overlap the HUD (top 190 px) or run into the bottom 300 px that YouTube covers;
- **never white text on a yellow (or amber) background**: use dark ink there (`isYellow()` in `short.html` does it for the stat bands; check any new
  colour a config's `accent`/`accent2` puts behind text);
- the title, "is in Miku Battle!", the grid count and the end card show the right URL (miku-battle.org).

Then check the finished file: `ffprobe` (1080x1920, duration), `volumedetect` (not silent, not clipping), and a frame from each segment.
Say plainly what you checked and that you have not listened to it.

## Making one for another novel

1. Preconditions: the novel is in the game (see the add-novel skill) with its cards in `game/js/data.js`; each cast member has an attack.
2. Copy `configs/adoptive-life.json`; set `novel`, `title`, `cast` (4-8, strongest first), `bgs`, `music` (`file` from `game/assets/music/`,
   or `id` of a novel song; leave `bpm`/`offset` out to have them measured, then sanity-check the tempo), `battle`.
3. `bgs` and `battle.bg` take a background **name or id**; many novels name theirs `background-<n>` (shared by several novels), so use the id
   (the boss fights in `MB.STORY` in `data.js` show which background a novel uses). A big cast (10+) can set `"beats": { "cast": 3 }` (beats per slot,
   default 5) and a half-time `music.bpm` so each slot is ~2 s and the short stays under ~45 s. Cuts still land on beats when the tempo is halved.
   Songs from commercial game OSTs (Falcom, Tales of...) risk a Content ID claim on a public upload: pick an original or royalty-free track.
4. `battle`: `bg`, `leader`, `foe`, `foeDeck` (cheap monsters so there is a target; the director also moves the cheapest to the top of the deck),
   `groups` (rule 5). Set `foeShots: true` for extra B-roll of the foe's attacks, `plays: true` to also record card entrances (slower).
4. Run the sequence above. Capture takes ~2-4 minutes per group; re-record one group with `capture.js <id> <index>`.
5. Commit the config and tools (`git add tools/short`). `output/` is ignored. Never name the config folder `novels/`: `.gitignore` excludes it.

## Gotchas

- Do not stand in `output/short/<id>/battle/` with your shell: `capture.js` deletes and recreates its `g*` folders (EPERM).
- `capture.js` serves `game/` with `MB.ASSET_BASE` rewritten to `/assets/` and the service worker blocked; time is virtual
  (`Emulation.setVirtualTimePolicy`), so frames are exact but a screenshot costs real time (~0.25 s each).
- The director plays side 0 itself (`b.playCard`, `b.attack`) with the leader HP untouched and the game's AI as the foe; if the foe has no
  monster yet, the attacker waits a turn.
- Gameplay frames are 2400x1350 (1600x900 at 1.5x so the big sprites load). The 1020x1240 window shows the full height and the middle ~1110 px of the width, shifted toward the fight.
- Sounds: the page asks for effects from `game/assets/sounds/` by file name; the game's own sound names are mapped to files through
  `SAMPLES` in `game/js/audio.js` (synthesised-only names have no file and are skipped).
- Shell quoting in this environment is fragile for long inline scripts with apostrophes: write a script file and run it.
