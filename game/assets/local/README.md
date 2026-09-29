# Local character sprites

`py tools/import_character_sprites.py "Novel Title" "Character Name"` imports existing illustrations from a miku.gg novel export here when R2 credentials are unavailable. It makes 900 px and 450 px WebP variants while preserving transparency and adds `local/sprites/...` paths to the manifest. `MB.asset()` resolves those to same-origin `game/assets/local/`, and `MB.spriteSrc()` selects `local/sm/` for small displays. Keep both sizes in sync.

Asher's safe default-outfit sprites came from the **Paradiso Suburbia** export, which identifies its license as **CC BY-NC-SA 4.0**. His ten WebP variants are now in the `game-assets` R2 bucket under `sprites/asher/` and `sm/sprites/asher/`; his manifest entry uses those public bucket paths.
