# Miku Battle — miku.gg All-Stars

A browser card battler starring the casts of miku.gg novels: *Adoptive Life RPG*, *Infernal Harmony*, *Between the Peaks*, *The Lifeguard has Teeth* and *The yuri assist*.

**Play:** https://ashthecool.github.io/miku-battle-gg/

It installs as an app (Chrome/Edge: the install icon in the address bar; phones: "Add to Home Screen") and works offline after the first load, except music, which streams from the miku.gg CDN.

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
| `game/js/avatars.js` | The unlockable profile pictures. Generated. |
| `game/js/config.js` | Where the images live (the Supabase bucket). |
| `game/sw.js` | Service worker for offline play. Bump `ASSETS` after changing images in the bucket. |
| `tools/fetch_assets.py` | Downloads the images for the novels in `novels/` (kept local, not in the repo), uploads them to the bucket and writes the manifest. `--local` writes them to `game/assets/` instead, for trying out a new novel before uploading. |
| `tools/sync_avatars.py` | Turns the pictures in the `card-images` bucket into profile pictures and pack art. Run it after adding pictures there. |

## Images (Supabase)

The images are not in the repo. They live in the public Supabase Storage bucket `game-assets`:

- `sprites/`, `backgrounds/`, `items/`, `portraits/`: from `tools/fetch_assets.py`
- `sm/sprites/`: half-size sprite copies used for cards and the board, so they stay sharp when drawn small
- `avatars/`, `packs/`: profile picture thumbnails and the Common/Rare/Epic pack art, made by `tools/sync_avatars.py` from the `card-images` bucket

The game only reads public URLs and needs no key. The tools write to the buckets, so they need the secret key in the environment (never commit it):

```sh
SUPABASE_SECRET_KEY=sb_secret_... py tools/sync_avatars.py
```

## Saves

Progress lives in the browser's `localStorage`. **⚙️ → Export / Import** moves it between browsers or devices. The save format is versioned; see `SAVE_VERSION` and `MIGRATIONS` in `game/js/ui.js`.

## Deploying

Every push to `main` publishes `game/` to GitHub Pages via `.github/workflows/pages.yml`.

## Credits

Characters, art and music come from the miku.gg novels they are based on and belong to their creators.
