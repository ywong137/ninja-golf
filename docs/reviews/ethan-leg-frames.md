# Ethan polearm leg correction

This release corrects the Vice President's Ready pose, eight standard attacks, musou, and three stationary guard clips.
The rear shoe previously opposed the pelvis turn. The leg solver also failed to preserve the complete native knee frame.

The corrected stance points the front shoe approximately forward and the rear shoe approximately 44 degrees outward.
These are measured shoe directions. The authoring yaw fields also include the imported rig's toe-out offset.
The offline author keeps the ankle paths and adjusts the thigh, calf, and foot rotations.
It samples at 480 Hz and includes every original key time.

The original geometry, skin weights, textures, face, and upper-body animation channels remain unchanged.
A binary comparison verifies the original 16,907,748 bytes and all 24 unrelated animations.
The 960 Hz source comparison covers 16,011 samples.
Maximum ankle-position difference is 0.023 mm. Checked upper-body positions remain identical.

## Moving attacks and transitions

Moving polearm attacks now turn the pelvis partly with the walking steps.
Three torso joints distribute the difference while retaining the authored chest and weapon orientation.
The paired hands retain their relative position.
Other attack families do not enable this pelvic adjustment.

The transition into running captures the displayed feet, pelvis position, body rotations, and toe rotations.
It blends directly toward cached native running poses over 0.24 seconds.
This avoids applying a second blend to an already blended mixer pose.
The capture first removes the terrain adjustment. The terrain layer then applies shoe tilt and support once after blending.
The entry pelvis orientation stays in world space with the foot anchors when the character turns.

Unfocused player movement now limits facing changes to 540 degrees per second.
Previously, a reversal could rotate the root by 81 degrees in one 40 FPS frame.
Attack aiming and focused movement retain their existing controls.

## Verification

The native check samples all 13 clips at 480 Hz.
It checks signed knee flexion, hinge alignment, hip and ankle rotation, planted feet, hands, arms, and blade clearance.
The separate surface check finds no intersections between the two legs.

| Native measurement | Maximum |
| --- | ---: |
| Hip axial rotation | 38.69° |
| Ankle axial rotation | 8.69° |
| Knee side bend | 0.000018° |
| Planted ankle drift | 0.255 mm |
| Paired palm gap | 0.674 mm |
| Detected arm/torso intersection pairs | 0 |

The broader browser check covers 1,170 cases at 40 and 120 FPS.
It includes the three previously corrected women and Ethan.
Ethan's 480 cases include fixed facing and turns toward movement, with four directions and three terrain slopes.
A separate check covers 36 musou and guard cases at 40, 60, and 120 FPS.

| Ethan runtime measurement | Maximum |
| --- | ---: |
| Hip axial rotation during attacks | 47.00° |
| Ankle axial rotation during attacks | 16.25° |
| Hip axial rotation during exits | 27.10° |
| Loaded ankle axial rotation during exits | 14.61° |
| Pelvis translation speed during exits, including player travel | 2.91 m/s |

In the fixed-facing cases, the former hip-position reset reached 9.27 m/s.
The former double blend reached 2,502 degrees per second at the pelvis.
The corrected fixed-facing transition peaks at 439 degrees per second.
Abrupt movement reversals can still produce faster combined global body turns. These measurements do not certify complete animation quality.

All 288 attack-to-run cases pass across six characters.
Their captured foot targets also match between flat ground and slopes, preventing terrain support from entering the blend twice.
All 138 native paired-grip blends pass, with a maximum palm gap of 1.132 mm.
The guard, six-character locomotion, and running weapon/head-clearance checks also pass.
All 472 unit tests pass in an isolated release copy. The production build succeeds.

Muted gameplay captures use a 1440 × 900 viewport with pixel ratio one.
Each capture measures ten seconds of crowded combat on this machine.
Both captures report no browser errors.

| Attack | Average FPS | Enemy count |
| --- | ---: | ---: |
| Heavy cleave | 58.37 | 24–43 |
| Light diagonal cut | 55.58 | 24–50 |

Actual Claude Opus 5.5 at High reviewed the before/after views and runtime sequences.
It found no definite lower-body defect in the reviewed frames.
It identified the missing pelvis-position capture and the world/local transition mismatch; both now have corrections and regression coverage.
The follow-up review confirmed both fixes and identified terrain support entering the foot blend twice.
Capturing after terrain restoration corrects that defect. The slope regression checks this order through its resulting foot targets.
Opus also requested closer attention to passing steps and weapon visibility near the face.
Still frames do not establish full-speed timing quality.

## Reproduction

Use the Monk model and motion records from commit `b606f83`.
The author checks the source hash and rejects repeated application.

```sh
node tools/author-combat-leg-frames.mjs \
  --model monk \
  --input /tmp/monk-source.glb \
  --motions /tmp/source-motions.json \
  --output /tmp/monk-candidate.glb \
  --record /tmp/monk-records.json
```

The character remains `monk.glb` internally to preserve existing references.
The browser asset revision is `ethan-native-leg-frames-1`.
Ignored review evidence resides in `artifacts/source-motion-review/ethan-leg-frames/`.
This release does not complete the remaining Shinobi, golf, running, or other musou animation work.
