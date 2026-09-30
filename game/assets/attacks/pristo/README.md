# Priest Pristo — Light of Lies

`guitar-poses.png` is a transparent 2x2 sheet generated with the built-in image_gen tool using his established default amused sprite from the game's public asset bucket as an identity/outfit reference. The four complete poses are wind-up, strum, solo and a satisfied fang grin. `prompts.json` preserves the exact prompt.

Beat sheet: charming vampire priest → cocky guitar wind-up → three golden chords cross the board → first chord reaches the target's visual center and deals damage once → chords turn crimson and a glow returns to him → grin, restore original figure and remove props. The returning glow is visual; existing lifesteal rules handle healing.

The `lightriff` style is exclusive to Pristo. Other characters retain `riff`. Generated poses are preloaded and included in the offline shell. `tools/check_pristo_attack.js` checks both gallery dummies, repeat playback, both edge directions, reverse-side attacks, both leaders, a small viewport, all poses, exact contact, one hit and restoration. Ten browser playbacks and `node tools/check_game.js 30` passed.
