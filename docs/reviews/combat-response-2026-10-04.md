# Combat response, sound, and musou — 2026-10-04

The previous controller locked facing through the entire attack animation. It also retained early attack inputs until long animations ended. Movement used the rendered camera direction, which lagged behind mouse input.

Movement now uses the requested camera heading. Startup permits steering. Reversals and guard inputs interrupt outside short contact intervals. Dodge still interrupts immediately. Recovery yields to movement or a fresh combo input. Inputs expire after 320 milliseconds, including during hit stop. Cancellation clears the captured locomotion state and pending hits.

## References and choices

- [Godot's official third-person controller](https://github.com/godotengine/tps-demo/blob/master/player/player.gd) samples movement and aim independently from firing cooldowns.
- [The MIT Soulslike controller](https://github.com/catprisbrey/Third-Person-Controller--SoulsLIke-Godot4/blob/main/scripts/PlayerTemplate.gd) uses explicit action transitions and dodge interruptions. Its attack movement lock is intentionally stricter than this game's policy.
- [Samurai Warriors 5 musou footage](https://www.youtube.com/watch?v=F97bU8gQX2s) informed weapon-ready composition, an angled camera, and the brief illustrated transition. The footage was viewed muted.

These references informed the behavior. No controller code or commercial game art was copied.

## Recorded sounds

Air swings use recorded swishes from artisticdude's [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack), under CC0. They contain no metal layer.

Confirmed hits combine Socapex's [impact and sword recordings](https://opengameart.org/content/punches-hits-swords-and-squishes), under CC BY-SA 3.0, with the existing CC0 flesh layer. Guarded hits use a separate clash. The wood knock no longer appears in the active mix.

Nine recordings add about 65 KB. Credits, source filenames, editing notes, and the original contributor list accompany them. Sixteen simultaneous sample voices remain the limit.

Offline rendering verified decoding, sound energy, and unclipped output. Browser tests verified swing and contact timing. Speaker playback stayed muted, so these checks do not establish subjective sound quality.

## Musou presentation

The camera uses two constant-radius shots: a wider orbit and a closer side pan. It no longer flies straight into the face. The character holds a captured preparation pose for its actual weapon. Reduced-motion settings remove orbit and roll.

All six heads now use expression color maps on their original UVs. Stronger authored facial targets add brow compression, narrowed lids, a wrinkled nose, and a snarl. Ethan retains more eye opening than the other profiles. Neutral geometry, clothing, and motion tracks remain unchanged.

The illustrated portrait appears briefly during the transition. The posed 3D character occupies most of the 2.85-second introduction. Combat restores the normal camera and expression afterward.

## Verification

- All six heroes: 24 reversal cases at 40 and 144 Hz. Contact commitment ended within 150 ms after reversal.
- Keyboard and mouse near ten enemies: Ethan and the Ace reversed during hit stop, then used normal running. The private spear build also passed.
- Root motion: collision correction and canceled attack travel passed across five frame rates and three headings.
- Every hero visibly changed facial pixels when the angry texture was enabled. The Closer also passed all four lighting themes and three quality settings.
- Facial geometry: no reversed triangles at sampled weights. Eye openings remained above 64% of neutral. Added eyelid penetration remained below 0.8 mm.
- The expression tests confirmed all six cinematics enter the musou attack and retain their full duration.

Review evidence is in the local project at `artifacts/reviews/combat-responsiveness/`. Paid source captures remain outside Git and outside the public build.

The private cinematic check passed nine hero/course combinations and 27 obstruction comparisons. All temporary clipping state cleared afterward. The production build passed seven normal-input checks and exact asset verification.

The full local suite found outdated model hashes and a single-character texture expectation. Neutral mesh streams, materials, skeletons, and animations remain unchanged. Updated provenance records preserve the previous binary hashes. All 20 affected checks passed on rerun.
