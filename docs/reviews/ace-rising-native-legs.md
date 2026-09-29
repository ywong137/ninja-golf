# Ace rising attack and rear-leg correction

The Ace now steps into a rising cut and extends through the legs. The attack lasts 1.55 seconds and hits at 0.62555 seconds.

## Rear-leg defect

The user identified the rear leg in the 0.63-second review image. The foot solver reached its target but did not preserve the knee hinge.

The rear knee had about 41 degrees of sideways bend relative to its native bone frame. Its outward foot angle also produced a poor lunge.

The correction aligns complete thigh and calf frames with the native hinge. It preserves the solved joints and shoe orientation within import precision.

The rear foot turns less during impact. The rear knee now flexes about 33 degrees, while the front knee accepts the weight.

The motion record enables `nativeKneeHinges`. Terrain correction preserves those hinges during this attack, including animation blends.

## Motion

- The character lowers gradually during preparation and rises during the cutting stroke.
- The front heel lifts for a toe pivot. The rear foot steps through recovery.
- Both endpoints return to the ready stance. Small foot steps connect the different stance widths.
- The fixed hand attachment and fitted fingers remain intact. Wrist deviation stays below 20 degrees.
- Extracted root travel moves the character through the existing collision controller. Manual movement has zero weight during this planted attack.

Actual Claude Opus 5.5 High authored and reviewed earlier candidates. Its first visual review rejected the crouch timing and late leg extension.

Later review prompted checks of foot pivots and recovery. The user's rear-leg report exposed a separate failure in knee-frame validation.

These changes cover the Ace rising attack. Other attack families still require separate visual review.

## Validation

- Twenty-three focused tests cover joints, contacts, timing, root travel, and existing slope support.
- Dense checks at 240 Hz found no arm-skin or blade-body intersections.
- Both existing arm-clearance tests pass for this attack.
- Browser checks at 40, 60, and 120 FPS keep knee side-bend below 0.001 degrees.
- Planted ankle drift stays below 0.5 mm on the tested slope. Toe drift stays below 15 mm.
- Crowded gameplay averaged 58.9 FPS at 1440 × 900, with 24–48 enemies and no console errors.
- The asset preserves all original geometry and 36 unrelated animations. It adds about 265 KB.

The passing measurements do not establish complete visual or anatomical accuracy. Recovery timing remains a possible polish item.

## Rebuild

The compressed curve source includes its motion record and a skeleton fingerprint. The writer rejects a different rig.

```sh
node tools/bake-attack-curves.mjs --input public/models/kaede.glb --curves tools/motion-sources/ace-rising-curves.json.gz --output /tmp/ace-rising.glb --record /tmp/ace-rising.json
```

The writer preserves existing payloads and appends new animation data. Use the original input when checking byte-for-byte reproduction.

The original body reference comes from Quaternius Universal Animation Library 2 under CC0. Native motion, joints, contacts, and timing use authored adaptations.

Local review images, scripts, measurements, and Opus responses live in `artifacts/source-motion-review/opus-ace/`.
