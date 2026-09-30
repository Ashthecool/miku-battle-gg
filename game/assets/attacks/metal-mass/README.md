# Church of Dalmavilla — Metal Mass

Beat sheet: shy Julia finds her voice beside the eccentric Pristo → Julia inhales while Pristo readies his guitar → her icy musical notes and his golden chords travel from their own positions and merge → the combined chord reaches the target's center, with one shared damage event → Julia sustains the hymn while Pristo strums → her shy bow and his grin, then restore both original sprites and remove temporary props.

`julia-singing-poses.png` is a transparent 2x2 sprite sheet generated with the built-in image_gen tool using Julia Aquacrucis's established default happy and shy sprites from the game's public asset bucket. The four complete connected poses show breath, soft singing, a sustained note and a shy finish. Pristo reuses `../pristo/guitar-poses.png`.

`metalmass` is registered as a duo style and assigned to Church of Dalmavilla's existing Metal Mass attack. Both partners use their own drawn poses and are staged according to their member order. Julia's pose changes follow 0.12-second RMS bins from the actual decoded `assets/sounds/singing.flac` supplied by the user. The whole 6.35-second clip plays at its original pitch, including its fading tail; guitar effects are quieter under it. Sound playback is stopped during cleanup. The new art and singing clip are included in the offline shell.

Verify this attack in the Attack Gallery and against edge slots and leaders. Check both performers' poses, real sound decoding/playback, chord merging and contact, one damage event and cleanup.
