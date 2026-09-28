# Ethan: inner-eyelid expression correction

The executive musou expression moved each inner brow down 6 mm.
That movement compressed the small eyelid crease and created a straight ledge.
The revised expression uses 3 mm of downward movement.
It retains the existing inward and forward movement.

This reduces the defect. It does not remove the remaining edge or complete the likeness.
The neutral face and model asset remain unchanged.

## Independent visual review

Claude Opus 5.5 High reviewed the actual close-ups and full portraits.
The canonical model was `claude-opus-5-5`.
The session was `98982e6a-d59f-4e80-b258-7b05403151bc`.

The first review accepted the smaller movement as a bounded improvement.
The second review compared the original and revised full portraits and confirmed that decision.
It found a small loss of brow intensity and less contrast at the ledge.
Both versions retain the same identity and type of expression.

Neither version shows strong anger at portrait distance.
The remaining edge, weak expression and existing likeness differences need further work.
A separate weight study will examine the abrupt change between the fold and crease.
That study is not part of this release.

The review images and raw responses are in the ignored local directory `artifacts/ethan-brow-review/`.
The portraits use identical cameras, pose, lighting, materials and model geometry.
The comparison is about expression quality, not calibrated facial measurements.

## Cause and regression

Fold vertices 706 and 1281 have 80% inner-brow weight.
Adjacent crease vertices 755 and 1334 have only 6% inner-brow weight.
The old movement pushed four crease triangles behind their neutral camera-facing direction.
The existing three-dimensional flip check missed this because their normals turned less than 90 degrees.

The new regression checks the signed projected area of these four triangles.
It samples 41 expression strengths through the fixed review camera.
The previous expression fails at strength 0.80.
The revised production expression keeps all four area ratios positive.
An explicit negative control retains the old expression and verifies that the check catches it.

This is a regression for one visible defect, not a general surface-validity rule.
The existing eye-clearance, aperture, edge-stretch and triangle checks remain unchanged.

## Validation

- All 19 focused face, head-rebuild, refinement and regression tests pass.
- Actual browser integration passes for six heroes and four enemy classes.
- The production build passes.
- The GLB file remains unchanged, including its geometry, textures, skin weights and 37 clips.

Unaccepted golf and cleave work remains separate in the shared working directory.
Its stricter motion tests are not part of this expression release.
