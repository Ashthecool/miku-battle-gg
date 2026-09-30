# Anime asset expansion

Ten new transparent 4×4 PNG sheets, 16 subjects per sheet (160 total), generated with the built-in image_gen tool. The existing `../props.png` was the style reference, with `../magic.png` used for magic effects. The original sheets are preserved.

Open `index.html` to browse all sets on checkerboard, light, or dark backgrounds. Open a sheet to see its full-resolution PNG. `manifest.json` records every subject in row-major order and the exact final prompt for each sheet.

These are an asset library expansion, including spare props for future use. They are not registered in `game/js/attack-art.js` or preloaded by the game. Before registering a sheet, measure transparent gutters and use those sampling coordinates, as with the existing sheets; generated spacing can differ from a mathematically exact grid. No character attack animations were changed.

| Sheet | Theme | Props |
| --- | --- | --- |
| [01-food-and-drinks.png](01-food-and-drinks.png) | Food and drinks | 16 |
| [02-school-and-art.png](02-school-and-art.png) | School and art | 16 |
| [03-music-and-stage.png](03-music-and-stage.png) | Music and stage | 16 |
| [04-nature-and-garden.png](04-nature-and-garden.png) | Nature and garden | 16 |
| [05-magic-and-status.png](05-magic-and-status.png) | Magic and status | 16 |
| [06-weapons-and-tools.png](06-weapons-and-tools.png) | Weapons and tools | 16 |
| [07-tech-and-games.png](07-tech-and-games.png) | Tech and games | 16 |
| [08-gifts-and-accessories.png](08-gifts-and-accessories.png) | Gifts and accessories | 16 |
| [09-home-and-care.png](09-home-and-care.png) | Home and care | 16 |
| [10-seasonal-extras.png](10-seasonal-extras.png) | Seasonal extras | 16 |
