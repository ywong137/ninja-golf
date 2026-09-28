# Hustler native arm candidate

Status: integrated locally, pending publication. This review covers v13 poses. V14 adds durable timing metadata only.

## Changes

The author replaces the arm channels in Ready, nine attacks, and seven guard clips. It preserves the original body and leg poses.

The arm solver uses the native elbow hinge. It controls shoulder rotation and forearm rotation separately. The wrist uses small radial deviation.

The dao has one sharpened edge. Each damage event now uses a forward cut with that edge. The former rising and return arcs become stepping and repeated draw-cuts.

The original footwork still distinguishes the attacks. Musou retains the original body rotation and six damage events. Guard retains its original body recoil and walking cycles.

A fixed −96.8024° rotation around the fitted handle aligns the dao edge with the native palm plane. It does not change the handle axis, palm center, or fitted fingers.

Selection is unchanged. Its procedural runtime still needs separate review. The candidate does not resolve that existing problem.

## Timing

| Clip suffix | Original duration / hits | Candidate duration / hits |
|---|---|---|
| Cut_Diagonal | .40 / .15 | .64 / .24 |
| Cut_Return | .43 / .16 | .688 / .256 |
| Cut_Rising | .48 / .20 | .768 / .32 |
| Cut_Sweep | .58 / .20, .38 | .928 / .32, .608 |
| Heavy_Cleave | .76 / .36 | unchanged |
| Heavy_Rising | .72 / .30 | unchanged |
| Heavy_Sweep | .82 / .28, .53 | .984 / .336, .636 |
| Heavy_Slam | .94 / .47 | unchanged |
| Musou_Flow | 3.30 / .42, .86, 1.30, 1.78, 2.25, 2.82 | unchanged |

All times use seconds. The author scales body sample times and declared support intervals together. It preserves every body sample value.

Suggested visible names include “Second draw” and “Stepping cut.” Keep the existing clip identifiers.

## Verification

The 480 Hz source check passed 8,688 samples across all 17 clips, including interpolated poses.

- Maximum elbow flexion: 91.0°. Maximum shoulder rotation about the upper arm: 48.1°.
- Maximum forearm rotation: 55.0°. Maximum wrist deviation: 16.0°.
- No measured arm/torso intersections or forearm penetration into the upper arm.
- Maximum blade tip speed: 25.1 m/s. Damage events occur at 71–98% of each clip’s peak speed.
- Signed sharpened-edge alignment at damage events: .85–.93.
- Minimum blade height: .739 m. The fitted sword-hand finger rotations remain unchanged.
- All geometry, 20 unrelated clips, and 3,689 retained animation channels preserve their original values.

The runtime audit covers entry from Ready, running, and guard, plus recovery. It tests each entry both while moving and while stationary.

The runtime preserves the authored wrists. Grip correction stays below .000004°. Palm separation stays below numerical precision. The blade stays at least .778 m above the test floor.

The muted gameplay recording reached 56.7 FPS at 1440×900 with 24–44 enemies. It uses the candidate combat timings. Review sampled frames and the recording together.

## Remaining review

The guard loop remains visually static. The retained body motion can still gain more weight transfer and stronger hip rotation.

The arm curves share a forward-cut vocabulary. Different body and foot patterns provide variation, but these are not nine fully distinct attack gestures.

Opus 5.5 High reviewed the front and side strips. It found no severe visible elbow or wrist fault.
It identified limited hip movement, weak follow-through, and a passive free arm as the main remaining movement problems.
The strips cannot establish fine finger detail or continuous timing. The runtime checks cover attachment and continuity separately.

Installation includes the paired sword and golf frames from `.mount.json`. The golf frames preserve the original independent club attachment.

## Rebuild and inspect

```sh
node tools/author-native-hustler.mjs --input public/models/ayame.glb --output /tmp/hustler-candidate.glb --record /tmp/hustler-candidate.json
node tools/check-native-hustler.mjs --model /tmp/hustler-candidate.glb --record /tmp/hustler-candidate.json --before public/models/ayame.glb --skin --output /tmp/hustler-check.json
```

The author writes `.report.json` and `.mount.json` beside the motion records. It refuses to overwrite a public model.

Source data: `tools/native-hustler-profile.mjs` and `tools/native-hustler-frames.json`. The validator exports `inspectNativeHustler()` and `verifyHustlerPreservation()`.

V14 records and pose payloads match v13 exactly. V14 adds `nativeHustlerDuration` to each replacement animation. This prevents repeated exports from scaling the body twice.

## Local review artifacts

- Candidate: `/tmp/hustler-native-v14.glb`, `.json`, and `.mount.json`.
- Dense source report: `/tmp/hustler-native-v13.check.json`.
- Runtime report: `/tmp/hustler-native-v13.runtime.json`.
- Front/side strips: `/tmp/hustler-native-v13-heavy.png` and `/tmp/hustler-native-v13-sweep.png`.
- Muted gameplay: `/tmp/hustler-native-v13-sweep.webm` and its `.json` report.
- Playback command wrapper: `/tmp/capture-hustler-playback.mjs`. It injects candidate timing only into the local review browser.
- Full runtime route wrapper: `/tmp/hustler-candidate-routes.mjs` and `/tmp/audit-hustler-kinematics.mjs`.

The playback command was:

```sh
node /tmp/capture-hustler-playback.mjs /tmp/hustler-native-v13-sweep.webm --hero 4 --kind light --step 3 --model /tmp/hustler-native-v13.glb --motion-record /tmp/hustler-native-v13.Ring_Cut_Sweep.json --ready-record /tmp/hustler-native-v13.Ring_Ready.json --replace-clip Ring_Cut_Sweep
```
