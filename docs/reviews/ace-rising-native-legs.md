# Ace rising attack and rear-leg correction

The Ace now steps into a rising cut and extends through the legs. The attack lasts 1.55 seconds and hits at 0.62555 seconds.

## Rear-leg defect

The user identified the rear leg in the 0.63-second review image. The foot solver reached its target but did not preserve the knee hinge.

The rear knee had about 41 degrees of sideways bend relative to its native bone frame. Its outward foot angle also produced a poor lunge.

The correction aligns complete thigh and calf frames with the native hinge. It preserves the solved joints and shoe orientation within import precision.

The rear foot turns less during impact. The rear knee extends into the lunge, while the front knee accepts the weight.

The motion record enables `nativeKneeHinges`. Terrain correction preserves those hinges during this attack, including animation blends.

## Motion

- The character lowers gradually during preparation and rises during the cutting stroke.
- The front heel lifts for a toe pivot. The rear foot steps through recovery.
- The rear heel lifts before the recovery step. Both toe pivots hold their full world-space contact positions.
- Hip rotation follows the chest within the existing 0.9-radian separation limit.
- Both endpoints return to the ready stance. Small foot steps connect the different stance widths.
- The fixed hand attachment and fitted fingers remain intact. Wrist deviation stays below 20 degrees.
- Extracted root travel moves the character through the existing collision controller. Manual movement has zero weight during this planted attack.

Actual Claude Opus 5.5 High authored and reviewed earlier candidates. Its first visual review rejected the crouch timing and late leg extension.

Later review prompted checks of foot pivots and recovery. The user's rear-leg report exposed a separate failure in knee-frame validation.

These changes cover the Ace rising attack. Other attack families still require separate visual review.

## Validation

- Twenty-seven focused tests cover joints, contacts, timing, root travel, and existing support limits.
- Dense checks at 240 Hz found no arm-skin or blade-body intersections.
- Both existing arm-clearance tests pass for this attack.
- Browser checks at 40, 60, and 120 FPS keep knee side-bend below 0.001 degrees.
- Planted ankle drift stays below 0.5 mm on the tested slope. Toe drift stays below 3 mm.
- Crowded gameplay averaged 58.9 FPS at 1440 × 900, with 24–48 enemies and no console errors.
- The asset preserves all original geometry and 36 unrelated animations. It adds about 265 KB.

The first full CI run caught missing torso/roll metadata and old foot tests that omitted root travel. It also caught rear-knee collapse during recovery.

The revised recovery lifts the rear heel, steps earlier, and preserves toe contact in three dimensions. Foot tests now include root travel without changing limits.

The passing measurements do not establish complete visual or anatomical accuracy.

## Recovery follow-up

Opus identified a separate balance problem after the knee correction. The body stayed behind the front foot while the rear foot remained airborne.

The revision keeps the rear toe planted until 0.78 seconds. The rear foot lands directly in its final stance at 1.00 seconds.

This reduces single-foot support from 0.40 to 0.22 seconds. The pelvis advances continuously during recovery, without its previous backward movement.

The front foot finishes its pivot before the main support interval. Its angle now uses the planted shoe pose, which removes a 13 mm gap.

Tests check actual weighted shoe vertices during recovery. The tests also reject delayed landing, backward body movement, and a sliding rear foot after landing.

The preparation and impact poses differ from the previous release by less than 0.015 mm at their joints. Maximum bone rotation difference is 0.004 degrees.

The original geometry and 36 unrelated animations remain intact. Only `Fan_Heavy_Rising` changes in the motion records.

Actual Claude Opus 5.5 High compared both recovery versions. It found no visible anatomical or balance blocker in the supplied views.

Its review also identified an abrupt upper-body unwind near landing. That motion still needs refinement; the revised feet do not establish complete dynamic balance.

The mass estimate uses approximate joint centers and proportions from the official [OpenSim Rajagopal model](https://github.com/opensim-org/opensim-models/blob/master/Models/Rajagopal/README.txt).
It helps compare candidates. It is not a calibrated body model, and its noisy acceleration estimate cannot prove physical correctness.

The local workspace also contains unfinished golf and Ronin changes. Seven failures from those files do not belong to this release.
An isolated copy of the committed files verifies this release without removing those changes.

All 453 release tests pass, and the production build succeeds. Dense arm and blade checks still find no intersections.
Final browser checks pass at 40, 60, and 120 FPS. Crowded gameplay averages 55.3 FPS at 1440 × 900, with 24–47 enemies.
The tested slope produces less than 0.2 mm ankle drift and 3.4 mm toe drift. Knee side-bend stays below 0.001 degrees.

## Rebuild

The compressed curve source includes its motion record and a skeleton fingerprint. The writer rejects a different rig.

```sh
node tools/bake-attack-curves.mjs --input public/models/kaede.glb --curves tools/motion-sources/ace-rising-curves.json.gz --output /tmp/ace-rising.glb --record /tmp/ace-rising.json
```

The writer preserves existing payloads and appends new animation data. Use the original input when checking byte-for-byte reproduction.

The original body reference comes from Quaternius Universal Animation Library 2 under CC0. Native motion, joints, contacts, and timing use authored adaptations.

Local review images, scripts, measurements, and Opus responses live in `artifacts/source-motion-review/opus-ace/`.
