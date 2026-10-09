---
name: attack-animation
description: Design, add, or repair Miku Battle character attacks when their effects must fit a character's personality and visibly land on targets without leaving the screen.
---

# Character attack animations

Use this for new character attacks and for reports that an attack misses, clips, or stages its prop outside the viewport. Follow the character's actual source description; the requested trait fit is a requirement. A clumsy character can stumble into a hit, a cruel one can trap or mock a target, and a determined one should press the attack with purpose. Make the action, prop, timing, and brief lines express that trait, rather than only changing the attack name.

## Sources and design

- Read the character's existing card, sprite roles, and source description. `py tools/novel_brief.py "Novel Title"` summarizes imported characters; for a character omitted by the cast limit, inspect the relevant entry through `tools/fetch_assets.py`'s `load_novel`, `characters`, and `outfits_of` helpers. Use the safe default outfit and the established art. To add one omitted character from the database without bucket credentials, run `py tools/import_character_sprites.py "Novel Title" "Character Name"` and keep its local sprite files and manifest entry. If authorized R2 credentials are available, upload both sprite sizes to `game-assets`, verify their public URLs, then switch that character's manifest paths to the bucket.
- Write a short beat sheet before coding: **personality cue → wind-up → visible path → contact → reaction → cleanup**. Choose a style from `game/js/fx.js` / `game/js/data.js` when it already tells that story. Add a signature style only when its staging is meaningfully distinct.
- Use `attack.emoji` or existing art for props. If the prop is one of the illustrated IDs in `game/js/attack-art.js`, it renders as an illustrated sprite. Avoid generic effects that obscure the character's own behavior.

## Geometry and hit timing

- Board coordinates are 1180 × 760; slots are at x 215, 465, 715, 965, with opposite rows y 232 and 548. The perspective camera and the gallery panel reduce usable screen space, especially around far and side slots. Use `ctx(V,a,t)` for attacker/target positions and `V.heightOf(t)` for the target's height. `r.T` is the target's floor point; `r.hT` is its visual center. Prefer `arc` and `path` for thrown props, with the final sample at `{x:r.T.x, y:r.T.y, h:r.hT}`. For melee, use `r.C` to stop short of the target.
- The prop must visibly touch the target when `impact()` or `land()` is called. Do not use the wrapper's fallback hit at the end to cover a missed collision. Check actual prop dimensions: a billboard's `y` is its **center**, so a tall book, sign, or board may need its center slightly above `-r.hT`, but its lower edge must overlap the target.
- Keep banners and labels compact and centered over a target. Avoid fixed sideways offsets, very large negative y values, and wide unwrapped text. A drop may begin above the board briefly, but its readable part and landing must be onscreen. Limit particle spread near edges and avoid making UI panels hide the hit.
- Ensure `impact()` fires once at the intended contact; `lander` handles follow-up hit effects, and `attack()` guards the core impact. Finish awaited movement, remove temporary DOM nodes, and restore the attacker's figure and sprite state even after unusual targets such as leaders.

## Verify in the game

- Use the Attack Gallery for visual playback with the character and the style; test both available dummies and repeat enough to cover randomized targets. Inspect left and right edge slots and an enemy leader in a controlled battle or development fixture when the animation uses large props, sideways staging, or camera movement. Repeat for each affected character.
- While the animation plays, confirm the prop stays visible, ends on the target, damage appears at contact, text remains readable, and the attacker returns to its slot. The gallery is not proof by itself when only its center dummies were tested.
- `node tools/check_attacks.js <card|bond|style ...>` (or `--new` for everything changed since HEAD, including users of styles edited in fx.js) plays each attack in a real browser at the centre, an edge and the enemy leader (`--all` for six cases), 4x speed, 3 pages in parallel. It fails on a missing/doubled hit, a page error or an attacker not restored, and warns when nothing touches the target at the hit, props leave the screen or nodes stay in the fx layer. `--shots` saves screenshot strips to `output/attack-check/<id>/` to look at. It serves `game/` itself and finds Playwright in npx's cache, so no server or NODE_PATH is needed.
- Run `node tools/check_game.js 30` for data and battle consistency, plus the relevant browser playback. Fix any error, and record any visibility condition that could not be observed. A passing simulation does not establish visual placement.

## Drawn pose-sheet attacks

A character with a 2x2 pose sheet (frame 0 stance, 1 wind-up, 2 release, 3 recover; transparent PNG in `game/assets/attacks/<set>/<id>/attack-poses.png`
plus `sheet-inventory.json` with each frame's rect) plays its attack from the drawn frames instead of its sprite:

- `py tools/pose_sheets.py` measures every frame's bounds and foot point, writes the sheets as WebP to `game/assets/attacks/poses/` and the numbers to `game/js/poses.js`
  (`MB.POSES`). It preloads with the attack art; add new files to `game/sw.js` `SHELL_FILES` (the script prints nothing about that).
- In `fx.js` ("drawn pose attacks") `posed(V, a, t, impact, id | [ids], async (k) => {...})` swaps the sprite for `poseActor`s, restores everything in a
  `finally`, and hands the script a kit: `k.actor.set(frame)`, `k.hand(i, frame, heightFraction)` (where the drawn hand reaches), `k.make(cls, html, P, h)`
  (a prop that is removed at the end), `k.land(i)` (the first call deals the damage), `k.shiver`, `k.fade`, `k.loop`. A duo passes both ids in `members` order and
  uses `k.home(i)`, `k.actors[i]`. The poses face right and are mirrored about the feet when the target is on the left.
- Style the script after the character (their sheet's four beats are the beat sheet), put props' CSS at the end of `style.css`, and register the style in `STYLE_SKY`
  (and `DUO_STYLES` for a duo).
- `NODE_PATH=<playwright> node tools/check_pose_attacks.js [id ...] [--shots] [--slow=0.3]` plays each in the gallery at the centre, both edges, against an enemy leader and from
  the other side; it fails on a missing/doubled hit, a missing frame, a leftover actor, an unrestored sprite or an actor off screen, and lists props that leave the screen.
  `--shots` saves a screenshot strip to `output/pose-check/` for a look (`--slow` slows the animation clock to catch more frames).
