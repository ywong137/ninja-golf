This pass extends the full-body attack work to all six heroes. Kaede keeps her authored choreography and receives the corrected native interpolation.

| Hero | Movement |
|---|---|
| Ronin | Braced diagonal entries, overhead cuts, and loaded return sweeps |
| Shinobi | Alternating steps, staggered entries, and independent blade paths |
| Monk | A separate polearm family, wider hand spacing, and lateral sweep entries |
| Kaede | Fan cuts with countersteps, free-arm counterbalance, and turning Musou footwork |
| Ayame | Lateral entries, ring orbits, and lower support through wide return sweeps |
| Sora | Lower stances, short advances, and hook-and-retraction attacks |

Each family has four light attacks, four heavy attacks, and one Musou sequence. Gameplay impact times remain unchanged. The Monk now uses the `Naginata_` prefix. His former shared odachi clips are retired.

The three male heroes now have matching ready stances. Their previous idle poses put the hands far below their attack starting positions. The Shinobi's idle-to-attack palm displacement measured 68.2 cm and 58.6 cm. The new stances remove that repeated raising and lowering between attacks.

The native export had another defect. Equivalent quaternions sometimes changed sign between solved keys. Blender interpolated their components before export and produced severe wrist reversals. The export now keeps quaternion signs continuous and uses linear keys. The same Ronin slam fell from 166.3 degrees of between-key shaft error to 6.9 degrees, before increasing its sample rate.

The new five families use 120 Hz native attack samples. Kaede retains her existing sample rates. The native rig also respects the paired-hand reach limit. An explicit `freeHand: 0` now preserves the Shinobi's second weapon grip.

`author-roster-motion.py` regenerates the five revised families in memory. It preserves Kaede and unrelated motion records. Repeating it produces identical data. The older athletic author calls it after the Kaede author, so regeneration cannot restore the earlier partial choreography.

Build the source clips before the native bodies:

```sh
python3 tools/author-roster-motion.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-authored-motion.py -- --attacks-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --enemies --hero ninja
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --enemies --hero enemy-guard
```

The Scout and Guard share attack records with the heroes. Their native clips must match those records after a rebuild.

The native audit covers 54 hero attacks and two enemy attacks. Maximum support drift is 2.303 mm. Maximum arm reach is 96.001% of native limb length. Maximum between-key shaft error is 9.798 degrees. All 183 unrelated clips retain their exact descriptors and animation bytes. Body meshes, skins, materials, and textures remain exact.

The tests distinguish full support from a foot that is releasing contact. On the four slope fixtures, fully supported feet stay within 0.012 mm of their source sole clearance. Partial contacts retain their intended terrain blend.

These checks establish continuity and anatomical limits. They do not establish AAA artistic quality. Gameplay captures remain necessary to assess timing, silhouettes, and body movement.

Final verification passes 195 automated tests, 96 moving-attack scenarios, 385 palm-grip checkpoints, and the slope and transition checks. A Kaede playthrough covers shot selection, ball flight, combat, and pause/resume. The browser reports no errors. The Ronin's first light attack uses a 110 ms carry transition, which passes the run-to-attack displacement check.

The performance checks use muted Chrome with Metal on the local M1 Max. Each uses Balanced quality, a 1440×900 viewport, and 64 active enemies. The characters move and attack during measurement. Asset baking and other test browsers remain stopped.

| Hero and course | Display scale | Render scale | Mean FPS | 95th percentile frame time |
|---|---:|---:|---:|---:|
| Kaede, Crane Coast | 1 | 1 | 58.1 | 16.8 ms |
| Monk, Crane Coast | 2 | 1.5 | 50.8 | 33.4 ms |
| Shinobi, Neo-Tokyo | 2 | 1.5 | 60.1 | 16.8 ms |

The crowd budget disables contact shading during these measurements. Dynamic shadows remain active. These results describe this machine and these scenes; they do not guarantee the same rate on every computer.
