# Ronin knee and foot correction

This release changes Ready and the eight standard Ronin attacks.
The spinning musou still needs separate footwork work.
The existing arm and weapon defects remain outside this correction.

The previous solve aimed the leg segments without aligning their complete native joint frames.
That produced a sideways squat and twisted the skin around the knees.
The new solve bends each knee toward the shoe heading and preserves the native hinge.
The shoes turn ten degrees outward, while their ankle positions and the stance width remain unchanged.
Three heavy attacks distribute rotation between the hip and ankle through a small knee-plane adjustment.
The adjustment occurs during offline authoring, with no runtime search.

Terrain adaptation now retains that authored knee plane.
Previously, it restored the default plane when it moved an ankle to the slope.
The moving-attack solver also uses the corrected knee direction for these motions.
Ready uses its authored support rather than the older procedural stance.

## Verification

At 480 samples per second, the nine native clips have these maxima:

- Hip axial rotation: 35.10 degrees.
- Ankle axial rotation: 8.76 degrees.
- Knee side bend: 0.000024 degrees.

These are project regression bounds, not clinical range-of-motion guarantees.
The independent skinned-surface check finds no left/right leg crossings.
The minimum separation exceeds 60 mm across the reviewed Ronin clips.
The runtime check covers 360 cases at 40, 60, and 120 FPS, with forward, backward, and sideways movement.
It includes flat ground and slopes in both directions.
Maximum runtime hip rotation is 44.24 degrees; maximum ankle rotation is 20.19 degrees.
Maximum planted-ankle drift is 0.003 mm in those cases.
The Ace pivot and existing running browser checks also pass.
Crowded combat averages 59.23 FPS at 1440 × 900 with 22–40 enemies and no browser errors.

Actual Claude Opus 5.5 at High reviewed the front, side, and overhead renders.
Its final review found no visible leg blocker in the three heavy-attack poses shown.
It correctly limited that conclusion to the supplied stills.
The numerical and runtime checks provide separate evidence for the remaining samples.

The model preserves all geometry and all upper-body animation channels.
It preserves 28 unrelated clips and the original 8,355,992 binary bytes.
Only 54 leg rotation channels change. The model grows by 183,584 bytes.
The final model SHA-256 is `2de32bb3b59e6fc488ea3de56c68b4278b8eb1f1574936704da11e1f0c035225`.

## Reproduction

```sh
git show f52c137:public/models/ronin.glb > /tmp/ronin-source.glb
git show f52c137:src/motion-data.json > /tmp/ronin-source-motions.json
node tools/author-ronin-legs.mjs \
  --input /tmp/ronin-source.glb \
  --motions /tmp/ronin-source-motions.json \
  --output /tmp/ronin-leg-candidate.glb \
  --record /tmp/ronin-leg-records.json
```

The author rejects a changed source model or motion records that already contain this correction.
It restores source rotations between samples because Three.js can skip writes for constant tracks.
Without that restoration, the added shoe rotation accumulates during a static pose.

Ignored review evidence remains in `artifacts/source-motion-review/ronin-legs/`.
