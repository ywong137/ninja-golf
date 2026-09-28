# Ethan: measured nasal geometry

The previous pass applied small manual displacements. It did not directly fit the mesh to the photograph measurements.

This revision adds a reproducible fit that changes the actual head positions and normals. It then installs that fitted GLB.

## What changed

The visible improvement is narrower nasal wings. The photographic frontal span measures 127 ±10px. The previous model measured approximately 159px through the same camera. The updated model measures approximately 135px.

The nose-width coefficient is −5.10mm per side in model space. Smooth spatial weights reduce the maximum actual vertex movement to 4.73mm. These model units do not establish Ethan's physical measurements.

The constrained fit also makes small mouth and chin adjustments. The visual review did not establish these as a broader likeness improvement.

The fit preserves the forehead, hair, eyes, glasses, textures, skeleton and animation streams. It does not claim an exact reconstruction of Ethan's whole face.

## Why the earlier measurements failed

Two alleged eye-corner anchors hit rigid eyeballs. The alleged upper and lower lip anchors both landed on an upper-lip triangle. The chin anchor sat above the inferior anterior chin ridge.

The subsequent anatomical audit also showed that this ridge is not the lowest visible chin contour. Different camera angles expose different parts of the submental surface.

The new fit uses physical nose and oral-seam vertices. The upper and lower oral-seam points have separate, appropriate lip-bone weights.

For the jaw and cheek outline, it recomputes occluding triangle edges after each deformation. A full-head visibility check rejects hidden edges. An anatomical patch excludes the neck, while its artificial cut edges never become fitting targets.

The fit excludes eyes and open-mouth reference points. Beard boundaries and expression-sensitive contours carry larger uncertainty. The photographs do not establish precise physical dimensions.

## Camera check

The original reference cameras used invalid anchors, so the fit checks two cases:

- Fixed reference cameras.
- Constrained camera changes, with fixed focal length and small rotation/translation limits.

Both cases support nasal narrowing:−5.51mm and−5.10mm coefficients, respectively. The larger cheek/chin changes from the fixed-camera fit do not remain stable. This revision uses the smaller constrained result.

Camera changes affect the analysis only. The game receives only the fitted mesh.

## Independent review and verification

An actual Claude Opus 5.5 High review inspected the matched before/after portraits. It found a visible improvement in nasal proportions and no new anatomical damage at portrait scale.

A final numerical-derivative refinement changes the reviewed shape by at most0.136mm. The exact final model passes the same rig tests.

Three-times enlarged clay renders use identical cameras and raking side light. They show no new seam or fold at the nasal-wing junction. Existing coarse facets remain visible at that magnification.

The exact installed candidate passes:

- Body, topology, UV and skin-stream preservation.
- Checked frontal nasal-width bounds.
- Physical upper/lower lip-anchor ownership.
- Rigid eyeball geometry and matching pivots.
- Facial deformation and eye-clearance limits at all tested angry gaze extremes.

A binary comparison confirms that all changed payload bytes belong to head positions or normals. All 37 animation definitions and payloads remain unchanged. Node, skin, material, image and texture definitions also remain unchanged.

A synthetic recovery check fits a known −4mm nasal-width coefficient as −3.999824mm.
The check uses exact generated observations, separate from the uncertain photographic measurements.

Applying the saved fit reproduces the candidate byte-for-byte. The production build passes.

Candidate SHA256: `1cc80a0b1040a409ad90a88837ba49bfbc8b614e084b3969c96958f77234ab72`.

## Reproduce

The reference identifies the exact baseline. Export it from the repository before applying the saved fit:

```sh
git show 1808074:public/models/monk.glb > /tmp/ethan-v14.glb
node tools/export-vice-president-fit-surface.mjs \
  --model /tmp/ethan-v14.glb --output /tmp/ethan-fit-surface.json
python3 tools/fit-vice-president-shape.py \
  --model /tmp/ethan-v14.glb \
  --surface /tmp/ethan-fit-surface.json \
  --reference assets/characters/vice-president-fit-reference.json \
  --apply-fit assets/characters/vice-president-shape-fit.json \
  --output /tmp/ethan-v15.glb
```

Omit `--apply-fit` to solve again. Use `--camera-mode fixed` for the camera-sensitivity comparison.

The source rejects mismatched topology, baseline hashes, non-finite surface values, failed convergence, active parameter bounds and folded geometry.

The local comparison is `artifacts/ethan-fit-v15/index.html`. It includes matched portraits, unchanged reference photos, enlarged clay renders and the numerical report.
