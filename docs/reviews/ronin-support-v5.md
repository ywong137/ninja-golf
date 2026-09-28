# Ronin support correction

The V5 candidate repairs two source animation errors. It remains outside the public game.

## Parent-bone error

The imported rig places both thighs below `spine_01`.
The earlier diagonal author rotated that bone to lean the torso.
This also moved both planted legs.

The corrected author applies the lean to `spine_02`, above the thigh branch.
The head retains its counter-rotation. The native arm relationships and grip remain unchanged.

The guard transfer had the same underlying error.
It copied Ready's `spine_01` into the original guard clips, moving their feet by 10–15 mm vertically.
Procedural terrain correction hid those errors until an attack restored the authored pose.

The V5 transfer preserves each original `spine_01` track.
It calculates `spine_02` relative to the pelvis to retain the reviewed upper-body orientation.
Impact and break recoil also act only on `spine_02`.
The authors reject repeated application and incompatible transfer versions.

## Measured checks

At 480 Hz, the diagonal preserves the source cleave's ankle and toe paths within 1.024 mm.
The remaining difference comes from resampling. Foot rotations differ by at most 0.033°.
The new regression rejects V3's 262.5 mm maximum path difference.

All seven guards preserve the original guard paths within 0.000087 mm.
Their native arm, wrist, grip, and skin checks pass.
The paired-grip residual stays below 0.00015 mm; wrist deviation stays below 13.41°.
The guard support check also rejects the old recoil, which moved the feet by up to 250.9 mm.

The flat guard-loop sole proxies stay within 0.0007 mm of the ground.
The actual shoe mesh retains its existing sole inset: 2.55 mm, reaching 3.68 mm during impact.
This distinction matters: preserving a source path does not prove that the shoe geometry meets the terrain exactly.

The corrected diagonal still passes the native anatomy and skin checks.
Its wrist deviation stays below 13.90°, and its paired-grip residual stays below 0.387 mm.
Across ten corrected clips, 4,461 samples test the blade against all 6,732 skinned body triangles.
The blade clears these surfaces by at least the 30 mm reporting limit.
This scan uses the candidate palm centers and the actual runtime paired attachment.
It does not measure the guard or handle.

The corrected diagonal gameplay capture held 59.64 FPS with 34–50 enemies at 1440×900 and pixel ratio 1.
It reported no browser errors and verified the intended `Ronin_Cut_Diagonal` clip.
That V4 capture has the corrected diagonal but precedes the separate V5 guard repair.

The combined model preserves 29 unrelated animations and 5,647,164 original binary bytes from its V63 input.
No public geometry, textures, models, or motion records changed.

## Independent visual review

Actual Claude Opus 5.5 at High reviewed the corrected front/side strips and a shoe closeup.
The returned `modelUsage` confirms `claude-opus-5-5`, with no permission denials.
It accepted the diagonal and light guard-impact poses. It found no visible sole correction necessary at normal game scale.
It requested lower-body participation in guard break: a small backward/downward pelvis movement, knee compression, and recovery.
That change remains a separate candidate. V5 does not resolve it.
The review also requests an exact contact frame and wider framing for later captures.
It cannot establish motion quality between sparse stills.

## Runtime transition findings

The source guard repair reduces the zero-time guard-to-attack foot change from 26.79 mm to 0.00098 mm.
The existing terrain runtime remains unchanged.
An experiment enabling `nativeStanceFeet` during every idle transition created a 51.8 mm slope-entry jump.
We rejected that change.

A 0.035-second candidate fade reduces stationary-entry handle intrusion from 4.617 mm to 1.594 mm.
The maximum per-hand gap falls from 1.063 mm to 0.096 mm.
Walking guard entries remain separate; the shorter fade increases peak foot speed in one moving case.
No global fade change was made.

## Reproduction and release boundary

The authoring sequence and exact hashes are in `tools/ronin-candidates/README.md`.
The final V5 model SHA-256 is `0ea92b08a22e8edbe52f3d36d1cb949a6d768b951b955ceb0733dbbbb6720cbc`.

Use `check-diagonal.mjs` for the source cleave comparison.
Use `check-guards.mjs --preserve-feet` against the original V63 guards.
Use `check-blade.mjs` with the exact candidate motion records.

The remaining release checks include the full attack family, transition hand contact, and normal-speed visual review.
The new support checks do not establish those results.

The private review artifacts remain in `artifacts/ronin-support-v5/`.
