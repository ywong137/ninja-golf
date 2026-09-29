# Standard attack knee correction

This release corrects Ready and the standard attacks for the Ace, Hustler, and Closer.
It changes 26 clips. The Ace's previously corrected heavy rising attack remains unchanged.
Together, all 27 Ready and standard attack clips now use their native knee hinges.

The previous solver aimed the thigh and calf without aligning their full joint frames.
That could bend the knee sideways and twist the skin, despite plausible joint positions.
The new authoring step aligns the knee hinge and distributes rotation between the hip and ankle.
It retains each source foot position and orientation.
The adjustment occurs offline, without a runtime search.

Only the six thigh, calf, and foot rotation channels change in each corrected clip.
The models retain their original geometry, textures, upper-body channels, and unrelated animations.
The motion records retain their pose coordinates, foot headings, timing, and contact schedules.
The native-knee flags let the existing terrain and movement layers preserve the corrected frames.

## Verification

The exported skeleton checks sample all 27 clips at 480 Hz.
They require forward knee flexion, negligible knee side bend, and bounded hip and ankle axial rotation.
These are project regression bounds, not clinical guarantees or a complete measure of natural movement.
The skinned-surface check finds no crossings between the two legs.
It examines the thighs, calves, and shoes outside the connected pelvic seam.

The source comparison samples foot and toe positions at 960 Hz, between exported keys.
Maximum differences are 0.076 mm for the Ace, 0.060 mm for the Hustler, and 0.050 mm for the Closer.
Maximum rotation difference is less than 0.005 degrees.
The checked pelvis, chest, and hand positions remain identical.
The binary comparison also verifies unchanged geometry and upper-body channel data.

The browser check covers 690 cases at 40 and 120 FPS.
It includes stationary attacks, four movement directions, flat ground, two slopes, and the half-second after each attack.
The Ace's root-moving rising attack has a separate gameplay check.

| Runtime measurement | Maximum |
| --- | ---: |
| Hip axial rotation during attacks | 48.71° |
| Ankle axial rotation during attacks | 16.43° |
| Knee side bend | 0.0021° |
| Planted ankle drift | 0.713 mm |
| Hip axial rotation during exits | 22.87° |
| Loaded ankle axial rotation during exits | 12.73° |

Muted combat captures use a 1440 × 900 viewport and a pixel ratio of one.
Each capture measures ten seconds of gameplay. These results describe this machine and scene, not every device.

| Character | Average FPS | Enemy count |
| --- | ---: | ---: |
| Ace | 56.31 | 24–44 |
| Hustler | 58.07 | 15–35 |
| Closer | 58.96 | 21–42 |

All three captures report no browser errors.

All 469 unit tests pass in an isolated copy containing only this release's changes.
The production build succeeds.
The existing Ace pivot check passes at 40, 60, and 120 FPS.
The separate attack-to-run check passes all 288 cases across all six characters.
Those cases retain at least 22.5 cm of knee-joint clearance above the terrain.

Actual Claude Opus 5.5 at High reviewed before/after views and a second set of closer views.
The close review found no definite knee-surface or anatomy defect in the twelve frames shown.
It noted possible cloth edges on the Closer and incomplete far-foot visibility in several close views.
The wider views include both feet. The numerical checks independently cover foot positions and contact.
The still-image review does not establish the quality of every frame or the full animation timing.

## Test maintenance

Two older checks required a loaded knee to remain outside a vertical plane above its shoe.
That proxy did not measure the native hinge or the axial rotation of a turning leg.
Corrected clips now use explicit native hip, knee, and ankle checks instead.
Legacy candidates retain the old check. Arm, weapon, grip, contact, and support requirements remain intact.

The hinge regression fixture now injects a deliberate bad thigh frame.
It restores the calf and foot frames before testing the repair.
Thus the test still detects the original defect after the source clip changes.

The shared GLB writer appends rotation tracks without rewriting the original binary payload.
It rejects missing channels, duplicate targets, invalid samples, and duplicate Float32 times.
The Ronin author now uses this writer and omits a duplicate endpoint key.
Its rebuilt foot positions differ from the installed Ronin by less than 0.0003 mm at 960 Hz.
This release does not replace the public Ronin model.

## Reproduction

Export the three source models and motion records from commit `ad13342`.
Then run the following command for each model:

```sh
node tools/author-combat-leg-frames.mjs \
  --model kaede \
  --input /tmp/kaede-source.glb \
  --motions /tmp/source-motions.json \
  --output /tmp/kaede-candidate.glb \
  --record /tmp/kaede-records.json
```

Use `ayame` for the Hustler and `sora` for the Closer.
The author checks the source hash and rejects a second application.
It samples at 480 Hz and includes every original animation key.
Keeping original keys prevents interpolation from smoothing away a short foot pivot.
The author restores source rotations between samples because the mixer can skip constant tracks.

Ignored evidence remains in `artifacts/source-motion-review/combat-leg-frames/`.
It includes renders, Opus reviews, source comparisons, browser cases, gameplay captures, and final asset hashes.

## Remaining scope

This correction does not repair every character animation.
The Shinobi, Vice President, and musou clips need separate foot-turn and body-turn work.
Applying the same fixed-foot correction to those clips exceeds the current hip or ankle bounds.
Those failures require choreography changes, not higher acceptance limits.
The low running posture also remains a separate concern.
