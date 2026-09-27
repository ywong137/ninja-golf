# Athletic combat pilot

This pass changes six authored attack records. It does not yet cover the full roster's combos or Musou.

| Family | Pilot clips | Native consumers updated |
| --- | --- | --- |
| Two-handed blade | Cut_Diagonal, Heavy_Cleave, Heavy_Sweep | Ronin and Monk |
| Fan | Fan_Cut_Diagonal, Fan_Heavy_Cleave, Fan_Heavy_Sweep | Kaede |
| Enemy guard | Heavy_Cleave | Enemy Guard |

The baseline assets and motion JSON are in `/tmp/ninja-combat-before`. That directory includes every hero and the enemy Guard.

## Authored changes

The pilot separates loading, hip release, chest release, contact, and recovery. The pelvis transfers toward the supporting leg. Kaede's free arm supplies timed counterbalance.

The right foot lifts before its 10 cm light step or 28 cm heavy step. It holds through contact, then lifts during recovery. The heavy entry also moves 4 cm outward. The left foot stays planted. Heavy loading reaches 17.5 cm. The pelvis advances 14–16 cm, and torso follow-through peaks after contact.

Each clip records support intervals in `footPlants`, using seconds.

Both heavy sweeps now strike at 0.28 and 0.53 seconds. The second strike uses an opposed return cut. `rootAdvance: 0` requests no automatic world-space lunge. Manual movement during attacks remains a separate runtime concern.

Spherical shaft arcs prevent near-opposite linear vectors from collapsing during a cut. The native baker transports the palm frame through forward-axis alignment. It retains authored roll and restores the guard orientation during recovery.

The native pilot samples at 60 Hz. It evaluates authored poses in actual seconds, avoiding phase shifts from rounded frame counts. Existing non-pilot bake behavior remains unchanged.

## Rebuild

Run these commands from the repository root:

```sh
python3 tools/author-athletic-combat.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-authored-motion.py -- --attacks-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero ronin
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero kaede
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero monk
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --enemies --hero enemy-guard
```

The source bake writes `public/models/attack-motion.glb`. It leaves `golf-motion.glb` unchanged. Native exports append only selected attack clips. They retain the existing bodies, textures, and unrelated animation data.

The broad `author-combat-motion.py` generator does not contain this pilot. Run the athletic generator afterward if the broad generator changes the motion JSON.

## CPU verification

```sh
node tools/check-native-combat.mjs --before /tmp/ninja-combat-before --heroes ronin,kaede,monk,enemy-guard
node --test tests/athletic-combat.test.js tests/character.test.js
```

The comparator verifies body and texture bytes, protected animation descriptors, and protected sampler bytes. It samples support contacts, forward knee bend, hip/chest timing, and shaft alignment between native keys.

The ten native clip instances passed with these results:

| Measurement | Result |
| --- | ---: |
| Protected clips, exact descriptors and bytes | 109 |
| Maximum planted ankle drift | 1.373 mm |
| Minimum forward knee bend | 104.06 mm |
| Hip speed peak before chest speed peak | 37.5–54.2 ms |
| Heavy native pelvis advance | 14.5–15.4 cm |
| Heavy loading below ready posture | 12.2–12.9 cm |
| Maximum native torso lean, heavy clips | 7.4–10.9 degrees |
| Maximum shaft error at native keys | below 0.0002 degrees |
| Maximum shaft error between keys | 10.30 degrees |

The between-key shaft error remains a measured limitation during fast cleaves. It is substantially lower than the original wrist-frame reversal. Contact tests alone do not establish athletic movement. Repeated front and side captures must establish visual acceptance before roster expansion.

Runtime blending, integrated movement, visual review, and performance results belong in the following acceptance record.

## Runtime and visual acceptance

Front and side sequences show stronger heavy loading, a wider staggered stance, and clearer return cuts. The Fan counterbalance now changes with the strike. This is an accepted improvement for the pilot scope, not full-roster artistic completion.

`rootAdvance` specifies total automatic travel in meters. Zero keeps the revised stationary stance in place. WASD movement remains available during an attack. Moving attacks still need dedicated footwork; planted contact measurements apply to stationary attacks.

Weapon directions crossfade with the hands during the initial blend. The worst first-frame guard-to-attack rotation fell from 75.8 degrees to 9.0 degrees at 120 Hz. The blend ends before contact, preserving authored impact directions. The handle remains attached to the evaluated palm.

The run carry exits after 0.10 seconds for athletic light attacks. The previous 0.12-second exit overlapped blade acceleration and added a visible tip jump. The existing travel transition test caught this regression and passed after the correction.

The new game-loop test checks all nine revised hero attack instances. It verifies automatic travel, planted-foot stability, damage events, and retained manual movement. The CPU transition test covers all six heroes from idle, guard, and running states.

## Release verification

All 173 unit tests and 11 browser test scripts passed. The browser checks completed all 36 holes and checked all six heroes. All 12 environment views passed. The grip test checked 385 checkpoints, with a maximum palm separation below 0.000001 meters. The revised stationary attacks had a maximum planted-foot drift of 0.874 mm in the game loop.

Performance used Chrome Metal on an Apple M1 Max, with a 1440 × 900 viewport and Balanced settings. Each scene had 64 active enemies. Adaptive contact shading was disabled at this population.

| Scene | Render ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.0 | 59.8 | 16.8 ms |
| Copper Saguaro | 1.0 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.0 | 60.1 | 16.8 ms |
| Crane Coast, Retina display scale | 1.5 | 51.2 | 33.4 ms |

These measurements cover this machine and these scenes. They do not establish performance on other hardware or during every combat effect.
