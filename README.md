# Miku Battle — Adoptive Life Clash

A browser card battler starring the cast of the *Adoptive Life RPG* and *Infernal Harmony* miku.gg novels.

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
| `game/assets/` | Sprites, backgrounds and item icons, plus `manifest.js` describing them. Generated. |
| `game/sw.js` | Service worker for offline play. Bump `ASSETS` after regenerating assets. |
| `tools/fetch_assets.py` | Downloads assets for the novels in `novels/` (kept local, not in the repo) and writes `game/assets/`. |

## Saves

Progress lives in the browser's `localStorage`. **⚙️ → Export / Import** moves it between browsers or devices. The save format is versioned; see `SAVE_VERSION` and `MIGRATIONS` in `game/js/ui.js`.

## Deploying

Every push to `main` publishes `game/` to GitHub Pages via `.github/workflows/pages.yml`.

## Credits

Characters, art and music come from the miku.gg novels they are based on and belong to their creators.
