# Shinobi dual-blade candidate

Status: **v9 is rejected. Do not integrate it.** No public model, runtime code, or controller changed in this pass.
Actual Opus 5.5 High review found no confirmed joint or grip defect, but requested a blade-to-head check.
That check found right-blade intersections during Sweep preparation near 0.151 seconds. The previous arm tests did not cover the head.
Candidate v10 moves that preparation outward and forward. The 480 Hz head check finds at least 12.17 mm clearance throughout Sweep.
The repaired arm baseline is now frozen as v11 after its support bake.
The separate [full-body Sweep pilot](native-shinobi-body-pilot.md) now accompanies v11 in the public model.
The head check covers skinned head, eye, and hair triangles. It excludes rigid attachments, such as glasses.

The full Opus review is in [opus-shinobi-v9.md](opus-shinobi-v9.md).
The CLI response verified `canonicalModel: claude-opus-5-5`; the command used High effort and read-only tools.

## Changes

The candidate replaces Ready, nine attacks, and seven guard clips.
The right and left weapons now take separate turns. The inactive hand keeps its blade clear of the active cut.
The two-hit attacks and Musou alternate hands. Rising cuts move upward instead of repeating a downward arm path.

Both elbows use the imported anatomical hinge. Upper-arm rotation and forearm rotation have separate limits.
The wrist stays close to its imported neutral position. The fitted finger poses stay unchanged on both hands.
Each blade has one fixed palm frame, calibrated from the bind forearm. No animation frame changes that mount.

The author retains the original pelvis, torso, and foot trajectories. Five clips use longer timing to permit the arm motion.
A separate support pass corrects early foot lift from sparse source interpolation. It changes only six leg rotation channels.
Golf, selection, locomotion, geometry, face, materials, and unrelated animations remain unchanged.

## Timing

The controller must use this table. Add a `twin` entry to `STYLE_ATTACKS`; do not change the generic attack table.
The `impactHands` record identifies the blade for each hit. The character still uses the existing `Twin_` clip names.

| Clip suffix | Old duration | New duration | Hit times | Active hands |
| --- | ---: | ---: | --- | --- |
| Cut_Diagonal | 0.400 | 0.560 | 0.210 | right |
| Cut_Return | 0.430 | 0.602 | 0.224 | left |
| Cut_Rising | 0.480 | 0.672 | 0.280 | right |
| Cut_Sweep | 0.580 | 0.812 | 0.280, 0.532 | right, left |
| Heavy_Cleave | 0.760 | 0.760 | 0.360 | right |
| Heavy_Rising | 0.720 | 0.720 | 0.300 | left |
| Heavy_Sweep | 0.820 | 0.984 | 0.336, 0.636 | right, left |
| Heavy_Slam | 0.940 | 0.940 | 0.470 | left |
| Musou_Flow | 3.300 | 3.300 | 0.420, 0.860, 1.300, 1.780, 2.250, 2.820 | right, left, right, left, right, left |

## Measured checks

The v9 arm source check covers 8,313 samples at 480 Hz, including damage events and support boundaries.
These results remain valid for those checks. They do not override the later blade-to-head failure.

| Measure | Worst result |
| --- | ---: |
| Wrist deviation | 16.00° |
| Elbow flexion | 118.00° |
| Upper-arm axial rotation | 60.00° |
| Forearm axial rotation | 60.00° |
| Arm rotation per equivalent 120 Hz frame | 15.00° |
| Hand speed | 11.21 m/s |
| Blade tip speed | 25.90 m/s |
| Minimum blade height | 0.905 m |
| Minimum distance between blade centerlines | 0.114 m |
| Active edge alignment with tip velocity | 0.767–0.951 |
| Hit speed relative to that blade's clip peak | 72–100% |
| Planted ankle drift | 0.602 mm |
| Knee speed | 6.89 m/s |
| Ankle speed | 5.28 m/s |

The actual skinned arms show zero detected torso crossings and zero measured elbow-fold penetration.
The blade separation check uses conservative envelopes around the curved blade centerlines. It does not test triangle intersections between blades.

Runtime checks cover Ready, running, and guarding before the two-hit light attack. Each case also tests continued movement and recovery.
Both visible wrists stay within 14°. Both palm gaps remain below numerical precision. Neither blade touches the ground.
The largest recovery arm rotation is 5.72° per 240 Hz frame during continued running.

The muted gameplay recording averaged 58.98 FPS at 1440×900 with 25–44 enemies. It used the v8 arm motion.
The v9 support pass keeps those arm channels identical.

## Preservation and limits

The arm pass preserves 6,058,116 original payload bytes, 20 unrelated clips, and 3,434 body, leg, and other channels.
The support pass preserves all 2,106 non-leg channels inside its nine changed attacks.
The final comparison preserves 3,332 channels after the explicitly allowed arm, finger, and leg changes.

Opus confirmed a visible anatomy improvement over the folded wrists in the original source.
The body still needs stronger weight transfer, torso rotation, and varied recovery. The guard reaction remains restrained.
These are anatomy repairs with distinct hand timing, not a claim of finished AAA choreography.
The strip and large runtime views show natural elbow bends and clear hand contact. The gameplay view still exposes the shallow body turn.
Opus also identified rising cuts that lift near the face, and covering blades that move too quickly during contact.

## Files and reproduction

Rejected pair, retained for regression checks: `/tmp/shinobi-native-v9.glb` and `/tmp/shinobi-native-v9.json`.
Fixed mounts and preserved golf frames: `/tmp/shinobi-native-v9.mount.json`.
Merge both sword frames and both saved golf frames during integration. This prevents Ready from changing the golf club mount.

Reports:

- `/tmp/shinobi-native-v8.check.json`: arm-stage skin, anatomy, timing, and preservation.
- `/tmp/shinobi-native-v9.support.json`: support-stage preservation.
- `/tmp/shinobi-native-v9.complete-check.json`: final feet, blades, and preservation.
- `/tmp/shinobi-native-v9.check.json`: final skin check.
- `/tmp/shinobi-native-v9.test.log`: three permanent source tests.
- `/tmp/shinobi-v8.runtime.json`: actual runtime transitions and both weapon contacts.

Visual review files:

- `/tmp/shinobi-v8-sweep.png`
- `/tmp/shinobi-v8-heavy-rising.png`
- `/tmp/shinobi-v8-guard.png`
- `/tmp/shinobi-v9-body-0.280-three-quarter.png`
- `/tmp/shinobi-v9-body-0.532-three-quarter.png`
- `/tmp/shinobi-v9-body-0.532-right.png`
- `/tmp/shinobi-v8-playback.webm`

```sh
node tools/author-native-shinobi.mjs \
  --input public/models/shinobi.glb \
  --output /tmp/shinobi-arms.glb --record /tmp/shinobi-final.json

node tools/bake-native-foot-support.mjs \
  --model /tmp/shinobi-arms.glb --output /tmp/shinobi-final.glb \
  --record /tmp/shinobi-final.json \
  --clip Twin_Cut_Diagonal --clip Twin_Cut_Return \
  --clip Twin_Cut_Rising --clip Twin_Cut_Sweep \
  --clip Twin_Heavy_Cleave --clip Twin_Heavy_Rising \
  --clip Twin_Heavy_Sweep --clip Twin_Heavy_Slam --clip Twin_Musou_Flow

node tools/check-native-shinobi.mjs \
  --model /tmp/shinobi-final.glb --record /tmp/shinobi-final.json \
  --before public/models/shinobi.glb --foot-support --skin \
  --output /tmp/shinobi-final-check.json

NINJA_SHINOBI_CANDIDATE=/tmp/shinobi-final \
  node --test tests/native-shinobi.test.js
```

The author uses checked-in `tools/native-shinobi-frames.json`. No temporary measurements are required for rebuilding.
