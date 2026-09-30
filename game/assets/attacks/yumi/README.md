# Yumi's dolphin ride

Three transparent anime sprites generated with the built-in image_gen tool, using Yumi's established default happy sprite from the game's public asset bucket as an identity/outfit reference.

The Common Sense Club relationship now uses `dolphinduet`: Yumi leads, then frightened Eri follows on her own dolphin 0.38 seconds later. `eri-ride.png` and `eri-fall.png` were also generated with image_gen using her established default scared sprite. Both riders share one damage event; the second contact adds a splash reaction. Each returns vertically from above the screen to her own side of the fused slot.

- `dolphin-rise.png`: dolphin breaching from below.
- `yumi-ride.png`: Yumi riding the dolphin into the target.
- `yumi-fall.png`: Yumi descending back into her slot.

Beat sheet: cheerful dolphin daydream → water ring and breach in front of Yumi, on the side away from the enemy → mount and diagonal leap → dolphin nose contacts target with one damage event and splash → disappear → Yumi drops vertically from above the viewport into her original slot → restore original figure and remove temporary sprites.

The `dolphin` style in `game/js/fx.js` uses the three poses. The riding image's nose is approximately at 94% x / 69% y, so the final billboard center is offset to put that point on the target's visual center. All three poses are preloaded through `MB.AttackArt.urls` and included in the offline shell.

`tools/check_yumi_attack.js` runs browser checks for gallery dummies, both edge directions, reverse-side attacks, leaders, and the relationship duo. It checks contact placement, one damage event, spawn position, vertical fall, visibility and cleanup. Supply Playwright on `NODE_PATH` and run with Edge installed.

Dolphin vocal effect: [Dolphin Noise-.wav by jfournier18](https://freesound.org/people/jfournier18/sounds/456151/), CC0, a human dolphin imitation. The HQ MP3 preview is saved locally and capped at 1.15 seconds for takeoff. Existing water sounds accompany emergence and contact. A synthesized chirp is available while the sample loads.
