# Attack prop artwork

Generated with the built-in image_gen tool for Miku Battle. Final sheets were generated using the existing `sprites/amy-lyn/neutral.webp`, `items/natsuki-s-cupcake.webp`, and `items/purple-tulip.webp` as style references. The ornate initial drafts are not used.

- `magic.png`: 16 magic/nature/relationship effects.
- `props.png`: 16 weapons and everyday objects.
- `everyday.png`: 16 food, healing, and impact props.

All three PNGs retain their original RGBA transparency. Each sheet is a 4×4 atlas, sampled directly with CSS backgrounds; no per-particle network requests or image files are needed. Sampling coordinates follow the measured transparent gutters rather than assuming a perfectly regular generated grid. Files are local to the game, preloaded at boot, and included in the service-worker shell cache.

`game/js/attack-art.js` maps existing emoji identifiers to atlas cells. Battle billboards, flat effects, and card-preview effects render supported identifiers as artwork. Unmapped one-off props retain their original appearance; this release deliberately covers the most-used props first. Character/token sprites and SVG artwork are not changed. When an effect changes a prop during animation, use `MB.AttackArt.setText(element, text)`.

For a visual contact sheet and 11 renderer checks, serve the repository root and open `/tools/check_attack_art.html`. Check the props against both light and dark backgrounds when changing either the artwork or its sampling coordinates.

## Final generation prompts

### magic.png

```
Use case: stylized-concept
Asset type: ONE production battle VFX sprite atlas, square 4 columns x 4 rows.
Reference images: the attached blonde character, cat cupcake, and purple tulip are STYLE REFERENCES only. Match their clean hand-drawn anime visual-novel art: thin dark contours, simple 2-to-3-tone cel shading, soft matte colors, modest white highlights. Do not copy the character. Do not add gold ornaments, jewels, elaborate filigree, glossy 3D rendering, bevels, or emoji typography.
Scene: genuinely transparent alpha background, no checkerboard, no grid lines, no text.
Layout: EXACT regular 4x4 grid of equal square cells. One centered standalone sprite in each cell. ALL artwork confined to central 70% of its cell, leaving at least 15% completely transparent margin on EVERY side. This is used as a CSS sprite sheet; no part may cross a cell boundary.
Subjects row-major:
Row 1: pale-yellow four-point sparkle cluster; warm yellow five-point star with a short pink trail; simple soft pink love heart; pink broken heart with a zigzag split.
Row 2: soft ivory feather; five-petal pastel pink cherry blossom; violet musical eighth-note; pink lipstick kiss imprint.
Row 3: orange cartoon flame with yellow core; yellow lightning bolt; pale cyan six-point snowflake; small turquoise water splash.
Row 4: pale lavender crescent moon; fresh green leaf; small dark purple bat, front view, wings spread; small white feathered angel wing.
Constraints: exactly these 16 subjects, correct order, isolated full silhouettes, no jewelry or decorative object frames. Cute clean 2D illustrated effects that belong beside the reference art. No background.
```

### props.png

```
Use case: stylized-concept
Asset type: ONE production battle VFX sprite atlas, square, exactly 4 columns x 4 rows.
Reference images: blonde anime character, cat cupcake, and purple tulip are STYLE REFERENCES only. Match their simple hand-drawn visual-novel anime look: clean thin dark outlines, matte natural colors, soft 2-to-3-tone cel shading, restrained highlights. Objects should feel like ordinary props illustrated beside those characters. No jeweled fantasy styling, filigree, gold ornamentation, glossy 3D or emoji font glyphs.
Background: genuinely transparent alpha, no checkerboard, no text, no grid lines.
Layout: EXACT regular 4x4 grid with one centered object per equal square cell. Limit every sprite to the central 70% of its cell with at least 15% transparent margins on ALL four sides. No overlap, no cropped parts.
Row 1: open ordinary purple-covered book with cream pages; simple black frying pan with fried egg viewed from above; plain white teacup and saucer with green tea and small steam curl; simple wooden mallet with brown handle.
Row 2: simple yellow gold coin with star stamp; pale cyan faceted diamond; red gift box with pink ribbon; small round glass potion flask with mint-green liquid and cork.
Row 3: small white rocket missile with red fins pointing upper-right; simple steel axe with wooden handle, blade toward upper-right; simple straight steel sword with brown grip, blade upper-right; red leather boxing glove with white wristband.
Row 4: gray metal gear cog; gray threaded bolt and hex nut; simple brass handbell with wooden handle; soft pink tied fabric bow.
Constraints: exactly the 16 subjects in stated order, complete silhouettes, ample transparent space. Match the references' unembellished anime illustration style, no jewelry.
```

### everyday.png

```
Use case: stylized-concept
Asset type: ONE production VFX sprite atlas, square regular 4 columns x 4 rows.
STYLE REFERENCES: attached blonde anime character, cat cupcake, and purple tulip. Match their unembellished hand-drawn anime art: thin dark contour lines, natural soft colors, simple matte cel shading, restrained white highlights. Ordinary objects from a visual novel, no gold ornament, jewelry, gem details, glossy 3D, decorative fantasy frames, or emoji font glyphs.
Background: genuine transparent alpha, no checkerboard, grid lines, words, labels, or scenery.
Composition: EXACT uniform 4x4 grid, one centered full object per cell. ALL sprites constrained to central 70% of their cell, with 15% completely transparent padding on EVERY side. Full silhouettes, no crossing cell boundaries.
Subjects in row-major order:
Row 1: red apple with small green leaf; golden slice of toasted bread; cute pink-frosted cupcake in purple paper wrapper with a small strawberry, echoing the cupcake reference; pink wrapped candy.
Row 2: simple cheese-and-tomato pizza slice; ivory garlic bulb; plain pink and white medicine capsule; plain medical syringe with pale blue liquid, needle points lower-left.
Row 3: two crossed beige adhesive bandages; red rose with two small green leaves; soft warm-brown animal pawprint; clenched human fist with simple dark fingerless glove, knuckles facing viewer.
Row 4: soft mint-white curling gust of wind; round dark cartoon bomb with short lit fuse; simple gold-yellow crown with three points and red inset details; ordinary black smartphone with blank pale blue screen.
Constraints: exactly these 16 subjects in this order, clean coherent 2D game illustration style matching the attached references, generous clear transparent gutters.
```
