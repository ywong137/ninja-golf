# Ethan’s native naginata animation

The final v20 candidate replaces thirteen animations. The model retains thirty-seven animation slots.

The author uses a shared shaft and two fitted palm stations. The rear hand stays forward of the body during the reviewed cuts.

The pelvis and chest turn before the blade reaches contact. The heavy cleave includes a planted forward step.

The [Opus movement study](opus-naginata-study.md) supplied the initial motion brief. Later source measurements and rendered poses guided the final curves.

## Timing and coverage

All names below use the `Ethan_Naginata_` prefix, except the three guard clips.

| Clip | Duration, seconds | Damage contacts, seconds |
|---|---:|---|
| Ready | 2.00 | None |
| Cut_Diagonal | 0.60 | 0.30 |
| Cut_Return | 0.60 | 0.30 |
| Cut_Rising | 0.82 | 0.41 |
| Cut_Sweep | 0.72 | 0.36 |
| Heavy_Cleave | 0.92 | 0.46 |
| Heavy_Rising | 0.96 | 0.48 |
| Heavy_Sweep | 1.28 | 0.40, 0.86 |
| Heavy_Slam | 1.02 | 0.51 |
| Musou_Flow | 5.04 | 0.30, 0.90, 1.56, 2.33, 3.14, 3.60, 4.53 |
| Naginata_Guard_Loop | 2.00 | None |
| Naginata_Guard_Impact | 0.30 | None |
| Naginata_Guard_Break | 0.40 | None |

Heavy Sweep has two opposed cuts through the forward target. The tip velocities reverse; the shaft faces forward at both contacts.

Musou contains seven contacts across a full turn. Short hops change the body’s direction between attacks. Each contact has a planted support foot.

Guard Impact compresses the pelvis by 3.6 cm and moves the grip by 8.7 cm.
Guard Break turns the body by 0.36 radians and moves the grip by 24 cm.
Both reactions retain the shared grip and return to Ready.

## Validation

The permanent validator samples the actual skeleton at 480 Hz. It checks the intermediate frames between the authored 240 Hz frames.

The validator checks complete wrist rotations, palm contact, loaded knee alignment, planted feet, actual blade vertices, and local/world arm continuity.
It also checks the full bone transforms at both endpoints against Ready.

| Measurement | Worst final value | Rejection bound |
|---|---:|---:|
| Wrist rotation from imported neutral | 24.00° | 24.01° |
| Forearm-to-middle-knuckle bend | 27.34° | 30° |
| Paired palm gap | 1.760 mm | 2.5 mm |
| Arm rotation per 120 Hz interval | 22.59° | 23° |
| Actual blade height above ground | 0.583 m minimum | 0.10 m minimum |
| Planted ankle movement | 0.264 mm | 1 mm |
| Planted shoe rotation | 0.016° | 0.286° |
| Loaded knee distance inside its shoe plane | Under 0.1 mm | 20 mm |

Every attack lifts a foot more than 40 mm. All attacks and guard reactions match Ready at both endpoints.

The preservation audit retained 7,520,272 original binary bytes and twenty-four unrelated animation descriptors.
The audit also checked geometry, materials, nodes, skin data, face data, and the completed golf animations.

## Visual limits

These measurements do not establish artistic quality. Rendered movement still requires visual review.

Some recovery poses compress the left elbow skin. The sampled heavy sweep has about 30 mm of overlap within the folded sleeve.
Guard reactions show 13–21 mm of the same elbow-fold overlap.
Earlier transition samples also showed brief vest contact. The final contact and quarter-phase samples had no forearm–torso intersections.

The motion uses wrist rotation up to 24 degrees. It does not maintain perfectly neutral wrists throughout every cut.
The animation uses authored curves and a geometric arm solver. It does not use captured human movement.

Some return cuts reverse a reviewed path. Musou joins those paths with turning hops. Further visual work can improve recovery variety and rhythm.

The remaining guard-walk clips retain their older grip spacing. Runtime attachment must interpolate the station spacing during those transitions.

## Rebuild and test

The author uses these checked-in files:

- `tools/author-native-naginata.mjs`
- `tools/native-naginata-profile.mjs`
- `tools/native-naginata-frames.json`

The frame file contains measured hand frames and imported neutral rotations. The author rejects changed neutral rotations or grip centers.

Run the author after the face and golf stages:

```sh
node tools/author-native-naginata.mjs --input public/models/monk.glb --output /tmp/naginata.glb --record /tmp/naginata.json
node tools/check-native-naginata.mjs --model /tmp/naginata.glb --record /tmp/naginata.json --output /tmp/naginata-check.json
```

Merge all thirteen records into `src/motion-data.json`. Install the matching model only after preservation and runtime checks pass.

Keep the three guard names unchanged. Route Ready and all nine attacks through their `Ethan_Naginata_` names.

The author accepts either old or replaced animation names. It replaces descriptors without adding animation slots.

Run the installed source regression:

```sh
node --test tests/native-naginata.test.js
```

The validator also supports `--help` and `--include-frames`. It runs without a browser or GPU.

The final authoring artifacts used the `/tmp/ninja-naginata-v20` prefix. They include the model, matching records, preservation audit, and sampled skin report.
