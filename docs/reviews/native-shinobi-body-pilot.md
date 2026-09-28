# Shinobi full-body Sweep pilot

Status: **v5 is integrated.** Actual Opus 5.5 High accepted this pilot as an improvement.
The review requested a fist/forearm-to-head check before shipping; that check now passes.
The public model now includes the full arm family and this body pilot. The controller uses the matching hit times.
Read the [full Opus follow-up](opus-shinobi-body-v5.md) for its visual findings and remaining limits.

This pilot follows the actual [Opus 5.5 High review](opus-shinobi-v9.md).
That review accepted the arm anatomy but identified weak body movement and fast covering blades.
The later head scan rejected v9. The repaired arm baseline, v11, remains separate from this body pilot.

## Motion and scope

Only `Twin_Cut_Sweep` changes its body movement. Duration stays 0.812 seconds, with right and left hits at 0.280 and 0.532 seconds.
The legacy clip name remains stable. The visible motion is two alternating downward cuts, not a horizontal sweep.
The pelvis starts each turn before the chest. The chest braces around contact while the active arm continues its cut.
The head counters the chest turn. The pelvis moves between the legs and lowers by up to 6 cm.

The rear feet pivot around their planted toes. Maximum authored yaw is 80° right and 65° left, with 25° heel pitch.
These large pivots need visual judgment. They permit the rear knee to follow the hip without inward collapse.
The heel returns after the pelvis unloads that leg, rather than before the transfer.
Both toe and full-foot support intervals are explicit in the motion record.

The pilot preserves every local arm and finger rotation channel from v11.
It preserves 227 other channels inside Sweep, all 36 other animations, and all geometry and original binary data.
Only the pelvis translation and 12 body, head, and leg rotation tracks change.
All other family clips remain anatomy repairs with their earlier body movement.

## Verification

The source checks use 480 Hz samples, exact hit times, and support boundaries.
All four permanent Shinobi tests pass on the complete candidate.

| Measure for Sweep | Result |
| --- | ---: |
| Maximum wrist deviation | 14.00° |
| Maximum elbow flexion | 85.00° |
| Maximum upper-arm axial rotation | 45.51° |
| Maximum forearm axial rotation | 42.00° |
| Maximum elbow-hinge deviation | 0.014° |
| Maximum arm turn per equivalent 120 Hz frame | 14.06° |
| Full-foot drift | 0.235 mm |
| Planted-toe drift | 0.229 mm |
| Maximum loaded-knee inward displacement | 2.89 mm |
| Maximum knee speed | 4.82 m/s |
| Detected central arm/torso crossings | 0 |
| Measured elbow-fold penetration | 0 mm |
| Actual blade/head clearance | 11.59 mm |
| Fist/forearm/head clearance | At least 50 mm |
| Minimum distance between blade centerlines | 190.75 mm |

Both active sharp edges align with tip velocity at 0.83.
Right and left contact speeds are 10.26 and 25.50 m/s. These are 98% and 100% of each blade's clip peak.
The covering blade moves at about 1.6 m/s at each hit, down from roughly 5–7 m/s in the earlier body motion.
The unequal cut speeds remain an artistic timing limit.
Opus also recommends smoother chest deceleration through contact, more hip hinge, and a less static Ready stance.
These changes remain separate from the accepted anatomy and support repair.
The profile angles are offsets from Ready, rather than absolute body angles.
The measured hip-midpoint to shoulder-midpoint axis leans 7.29° in Ready and 12.70° at the first hit.

All 17 candidate clips pass the exact blade/head scan. The closest other clip is Heavy_Rising preparation, at 6.51 mm.
The added pilot check compares actual posed lower-arm, hand, and finger triangles against the same head surfaces.
It finds zero crossings and at least 50 mm clearance throughout the clip, including preparation.
This check now runs inside the permanent source validator when the body-pilot record is present.
The head scanner covers skinned head, eye, and hair triangles. It excludes rigid attachments, such as glasses.
The blade-to-blade check uses conservative centerline envelopes, rather than exact triangle intersections.

The runtime audit covers entry from Ready, running, and guard, with stationary and moving recovery.
Both wrists remain within 14°, both palm gaps stay below numerical precision, and neither blade crosses the head.
Runtime head clearance stays above 12.74 mm after actor scaling. Maximum recovery arm turn is 5.72° per 240 Hz frame.

A muted 1440×900 gameplay capture averaged 57.86 FPS with 24–44 enemies and no browser errors.
Passing these checks does not establish professional animation quality.
The Ready stance remains broad and static. Other attacks still need the same body review.

## Files

- Repaired arm baseline: `/tmp/shinobi-native-v11.glb`, `.json`, and `.mount.json`.
- Full-body pilot: `/tmp/shinobi-body-v5.glb`, `.json`, and `.mount.json`.
- Source measurements: `/tmp/shinobi-body-v5.check.json`.
- Complete head scan: `/tmp/shinobi-body-v5.all-head.json`.
- Preservation report: `/tmp/shinobi-body-v5.body-report.json`.
- Test results: `/tmp/shinobi-body-v5.test.log`.
- Runtime transitions and exact head geometry: `/tmp/shinobi-body-v5.runtime.json`.
- Front/side strip: `/tmp/shinobi-body-v5-sweep.png`.
- Larger contact views: `/tmp/shinobi-body-v5-contact-0.280-three-quarter.png` and `/tmp/shinobi-body-v5-contact-0.532-front.png`.
- Gameplay recording: `/tmp/shinobi-body-v5-playback.webm`.

The model SHA-256 is `8c51247b793088fbfecb64dfcc6717a82b8874a0873008fca5f034ec4b6b9e62`.
The record SHA-256 is `9453dfa6fc1dcc996f22c5daf45447410ca3834c5ad9a643764fe509cee384ef`.

## Rebuild

First rebuild the arm family and its support bake using [the candidate instructions](native-shinobi-candidate.md).
Then apply this body pass to that baseline:

```sh
node tools/author-native-shinobi-body.mjs \
  --model /tmp/shinobi-final.glb --record /tmp/shinobi-final.json \
  --frames /tmp/shinobi-final.mount.json \
  --output /tmp/shinobi-body.glb --output-record /tmp/shinobi-body.json

cp /tmp/shinobi-final.mount.json /tmp/shinobi-body.mount.json

NINJA_SHINOBI_CANDIDATE=/tmp/shinobi-body \
  node --test tests/native-shinobi.test.js
```

Do not run the old full-foot support bake after this pilot. Its explicit toe pivots are already baked at 240 Hz.
The author verifies that the foot targets remain reachable and that unrelated animation data stays unchanged.

## Release recovery correction

The full release suite found a terminal torso acceleration in three other clips.
Heavy Rising, Heavy Slam, and Musou accelerated the world-space wrist near their final frame.
The local wrist itself did not cause the defect.

The final 120 ms now blends the body toward its settled endpoint with a smooth quintic curve.
The largest body correction is 3.01 degrees. All arm and finger channels remain unchanged.
The foot solver preserves the original foot positions and orientations.
The three repaired clips retain 684 other channels and all 34 unrelated animations.

The unchanged recovery test now passes.

| Clip | Previous terminal right-wrist speed | Repaired speed |
| --- | ---: | ---: |
| Twin_Heavy_Rising | 192.6°/s | 24.7°/s |
| Twin_Heavy_Slam | 194.4°/s | 22.2°/s |
| Twin_Musou_Flow | 197.1°/s | 25.7°/s |

The 480 Hz anatomy, skin, support, and blade/head checks pass too.
This correction does not change damage timing or the Sweep body pilot.

Reproduce from a pre-correction Shinobi model and its matching motion records:

```sh
node tools/smooth-native-recovery.mjs \
  --model /tmp/shinobi-body.glb --record /tmp/shinobi-body.json \
  --output /tmp/shinobi-recovery.glb --output-record /tmp/shinobi-recovery.json \
  --clip Twin_Heavy_Rising --clip Twin_Heavy_Slam --clip Twin_Musou_Flow
```

Merge only the three emitted records into the complete motion catalog.
The tool rejects an already-corrected clip to prevent repeated smoothing.


## Sweep revision v9: accepted local refinement

This revision changes the Sweep's upper torso and arm path. It leaves Ready and the fixed weapon mounts unchanged.
The chest now continues through each hit instead of holding for approximately 40 ms.
The second preparation moves outward, and its active cut takes longer.
The duration remains 0.812 seconds. Damage still occurs at 0.280 seconds and 0.532 seconds.

| Measured property | Accepted v5 | Candidate v9 |
| --- | ---: | ---: |
| Right contact speed | 10.26 m/s | 8.90 m/s |
| Left contact speed | 25.50 m/s | 11.32 m/s |
| Minimum blade/head clearance | 11.59 mm | 91.23 mm |
| Cover-blade speed at either hit | 1.60 m/s | 0.90 m/s |

The right and left sharp-edge alignments are 0.801 and 0.886.
Contact retains 65% and 74% of each blade's peak speed.
The source still has no measured elbow folds or arm/torso crossings at 480 Hz.
Fist and forearm clearance from the head exceeds the scanner's 50 mm reporting cap.
The exact blade scan includes the skinned head, eyes, and hair. It excludes rigid attachments.

All 24 lower-body channels remain unchanged. The planted ankle and toe errors remain below 0.24 mm.
The fitted fingers remain unchanged within numerical precision. All 36 other clips and the original geometry remain unchanged.
The five native Shinobi tests pass. Ready, running, and guard transitions also pass with both visible wrists within 14 degrees.
The largest recovery arm turn is 5.72 degrees per 240 Hz frame. No runtime blade/head crossings occur.
The muted gameplay capture averaged 59.50 FPS at 1440×900 with 24–43 enemies.

The large contact views show separate blade paths and retained weight transfer.
The Ready squat and limited forward torso bend remain visible limitations.
The extracted gameplay frames do not establish continuous artistic cadence.
The actual Opus 5.5 High review accepts this as a local improvement and reports no blocking anatomy or grip fault.
See [the complete review](opus-shinobi-sweep-v9.md).
It still identifies reduced contact speed relative to each global peak and the unchanged broad Ready stance.
The new regression checks reject the old hit-speed imbalance, the impact plateau, and the close blade/head path.

The requested 480 Hz chest-speed check confirms continued rotation through both former plateaus.
The source curve has matching derivatives across the relevant keys.
The baked chest still brakes rapidly over approximately 30–40 ms. That remains an artistic timing limitation.
A separate 480 Hz check found no blade crossings through 867 skinned torso/neck triangles, with clearance above the 200 mm reporting cap.
The unchanged nine-attack recovery test also passes.

Candidate files:

- `/tmp/shinobi-sweep-v9.glb`, `.json`, and `.mount.json`.
- `/tmp/shinobi-sweep-v9-Twin_Cut_Sweep.json` contains the only record needed for integration.
- `/tmp/shinobi-sweep-v9.check.json`, `.head.json`, and `.runtime.json` contain the physical checks.
- `/tmp/shinobi-sweep-v9.preservation.json` verifies geometry and unrelated animations.
- `/tmp/shinobi-sweep-v9-support-finger-preservation.json` verifies the retained support and fingers.
- `/tmp/shinobi-sweep-v9-sweep.png` and `-contact-0.532-three-quarter.png` show the rendered motion.
- `/tmp/shinobi-sweep-v9-playback.webm` records the actual gameplay.

The candidate model SHA-256 is `d0e0f48e5673ebd357ce695b29c4e4a947e4523293e26598b3b7c0b215474b94`.
The single Sweep record SHA-256 is `4f714dfd6356ebc04357c82ac7ea06ceecf8259ebd71c258bb09a1e485e26259`.

### Rebuild order

The rig attaches both thighs to `spine_01` and the clavicles to `neck_01`.
Retain the accepted lower torso rotation when revising the upper torso.
Author the arms after the body pass so their reference frame matches the new chest.
A fresh export and an incremental rebuild agree within 0.028 mm in joint position at 480 Hz.

Start with the supported arm-family baseline from the earlier rebuild section.
Use the current public model instead when it already contains the body pilot.
The body tool detects that case and preserves the lower-body channels without applying the toe pivots twice.

```sh
node tools/author-native-shinobi-body.mjs \
  --model /tmp/shinobi-final.glb --record /tmp/shinobi-final.json \
  --frames /tmp/shinobi-final.mount.json \
  --output /tmp/shinobi-body-stage.glb --output-record /tmp/shinobi-body-stage.json

node tools/author-native-shinobi.mjs \
  --input /tmp/shinobi-body-stage.glb --clip Twin_Cut_Sweep \
  --output /tmp/shinobi-arm-stage.glb --record /tmp/shinobi-arm-stage.json

node --input-type=module - <<'JS'
import fs from 'node:fs';
const records = JSON.parse(fs.readFileSync('/tmp/shinobi-body-stage.json'));
Object.assign(records, JSON.parse(fs.readFileSync('/tmp/shinobi-arm-stage.json')));
fs.writeFileSync('/tmp/shinobi-arm-stage.all.json', JSON.stringify(records));
JS

node tools/author-native-shinobi-body.mjs \
  --model /tmp/shinobi-arm-stage.glb --record /tmp/shinobi-arm-stage.all.json \
  --frames /tmp/shinobi-arm-stage.mount.json \
  --output /tmp/shinobi-sweep.glb --output-record /tmp/shinobi-sweep.json

cp /tmp/shinobi-arm-stage.mount.json /tmp/shinobi-sweep.mount.json

NINJA_SHINOBI_CANDIDATE=/tmp/shinobi-sweep \
  node --test tests/native-shinobi.test.js
```

The final body pass refreshes the hand and support metadata against the actual new arm frames.
Merge only `Twin_Cut_Sweep` into the current motion catalog. Do not replace unrelated records from an older candidate catalog.
