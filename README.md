# Miku Battle — miku.gg All-Stars

A browser card battler starring the casts of miku.gg novels: *Adoptive Life RPG*, *Infernal Harmony*, *Between the Peaks*, *The Lifeguard has Teeth*, *The yuri assist*, *Atarashī gakkō; Secret Garden!*, *Bloodline*, *Fake It to Make It!*, *New Haven*, *DUMB SUPER FANTASY RPG* and *Legend of You*, plus *Noble One* in NSFW mode.

**Play:** https://ashthecool.github.io/miku-battle-gg/

It installs as an app (Chrome/Edge: the install icon in the address bar; phones: "Add to Home Screen") and works offline after the first load, except music, which streams from the miku.gg CDN, and costumes, which are kept for offline use once they've been shown.

## Running locally

Open `game/index.html` directly, or serve the `game/` folder to get offline support too (service workers don't run from `file://`):

```sh
npx serve game
```

## Layout

| Path | What |
| --- | --- |
| `game/` | The whole game: plain HTML/CSS/JS, no build step. This folder is what gets published. |
| `game/assets/manifest.js` | Characters, sprites, backgrounds, items and music of the novels. Generated. |
| `game/assets/music/` | Songs made for the game. Register each in `MB.SONGS` (`game/js/data.js`); `foes` makes it that character's battle theme. |
| `game/js/avatars.js` | The unlockable profile pictures. Generated. |
| `game/js/config.js` | Where the images live (the Supabase bucket). |
| `game/sw.js` | Service worker for offline play. Bump `ASSETS` after changing images in the bucket. |
| `tools/fetch_assets.py` | Downloads the images for the novels in `novels/` (kept local, not in the repo), uploads them to the bucket and writes the manifest. `--local` writes them to `game/assets/` instead, for trying out a new novel before uploading. |
| `tools/outfit_sheets.py` | Contact sheets of a novel's outfits, to check them by eye before uploading. |
| `tools/novel_brief.py` | Condenses the novels into a design brief (characters, items, backgrounds, music). |
| `tools/check_game.js` | Validates the cards, bonds and story against the manifest and plays AI-vs-AI battles (`node tools/check_game.js`). |
| `game/js/effects.js` | Card abilities as data (effect specs) and the texts written from them. |
| `game/js/missions.js` | Daily missions, Glitter, crafting, Shiny cards and Story stars (rewards and prices in `MB.GLITTER`, missions in `MB.MISSIONS`, star challenges in `MB.Stars`). |
| `game/js/arena.js` | The Arena draft mode: leaders, card offers, opponents and rewards (`MB.ARENA`). |
| `game/js/story.js` | Story mode: the four acts, their maps, the main quests and side quests, and every scene's dialogue (`MB.ACTS`). |
| `game/js/storymap.js` | The Story screen: the map, the quest panel and the visual-novel scenes. |
| `.claude/skills/add-novel/` | The Claude Code skill for adding a novel: workflow, effect reference, animation catalog. |
| `tools/sync_avatars.py` | Turns the pictures in the `card-images` bucket into profile pictures and pack art. Run it after adding pictures there. |
| `tools/sync_maps.py` | Copies the Story maps from the `map-images` bucket into `game-assets/maps/` as WebP. |

## Images (Supabase)

The images are not in the repo. They live in the public Supabase Storage bucket `game-assets`:

- `sprites/`, `backgrounds/`, `items/`, `portraits/`: from `tools/fetch_assets.py`
- `sm/sprites/`: half-size sprite copies used for cards and the board, so they stay sharp when drawn small
- `avatars/`, `packs/`: profile picture thumbnails and the Common/Rare/Epic pack art, made by `tools/sync_avatars.py` from the `card-images` bucket
- `maps/`: the Story act maps, copied by `tools/sync_maps.py` from the `map-images` bucket

The game only reads public URLs and needs no key. The tools write to the buckets, so they need the secret key in the environment (never commit it):

```sh
SUPABASE_SECRET_KEY=sb_secret_... py tools/sync_avatars.py
```

## NSFW mode

**⚙️ → NSFW mode (18+)** adds the NSFW novels, outfits and backgrounds (tagged `nsfw` in the manifest by `tools/fetch_assets.py`, filtered out by `game/js/content.js` when the mode is off).

## Saves

Progress lives in the browser's `localStorage`. **⚙️ → Export / Import** moves it between browsers or devices. The save format is versioned; see `SAVE_VERSION` and `MIGRATIONS` in `game/js/ui.js`.

## Deploying

Every push to `main` publishes `game/` to GitHub Pages via `.github/workflows/pages.yml`.

## Credits

Characters, art and music come from the miku.gg novels they are based on and belong to their creators.
