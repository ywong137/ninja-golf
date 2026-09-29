# Current measured geometry revision

The latest fitted mesh is documented in [Ethan measured geometry v15](reviews/ethan-measured-geometry-v15.md).
Its visible improvement is narrower nasal wings. It does not establish a complete facial reconstruction.

The current eye appearance uses a separate skin texture correction. Two bounded UV regions remove duplicate painted eye darkness above the actual openings.
The thin upper-lid edge remains visible. The actual eyes, gaze, head geometry, skin weights, and all 37 animation clips remain unchanged.
Opus 5.5 High accepted this limited cleanup in matched portraits and close crops. It did not call this a measured likeness correction.

The eye stencil study compares visible boundaries across four supplied photos. Central lid curvature stays within the manual tracing uncertainty.
A simple downward orbit shift helps the front view but worsens the tilted view. No new eye-placement or aperture sculpt follows from those measurements.
Private measurements and comparisons remain in `artifacts/ethan-eye-study/` and `artifacts/ethan-eye-placement/`.

Full character exports apply `assets/characters/vice-president-head-revision.json` after the Blender base sculpt.
They then apply the reviewed side-only hair recipe through `tools/author-vice-president-hair.py`.
This adds modest volume above the ears while preserving the measured head, original skinning, and animation payloads.
The recipe contains static authoring transforms, so later selection-animation changes cannot alter the hair fit.
The author rejects a different source head or a duplicate application.
This preserves the exact reviewed head while retaining newly exported animation payloads.
The transfer rejects changed topology, UVs, skin weights, base positions, or base normals.
It also rejects duplicate application. Animation-only exports retain the existing head directly.

After reviewing a new fitted head, update the saved revision before publishing:

```sh
node tools/preserve-vice-president-head.mjs \
  --before /tmp/ethan-v14.glb --after /tmp/ethan-reviewed.glb \
  --output assets/characters/vice-president-head-revision.json
```

The `--before` model must contain the reproducible Blender base sculpt, without the measured correction.
The rebuild regression checks both the published head and preservation of newer animation bytes.

The earlier camera-fit RMS values below used several invalid anatomical anchors. Do not use them as likeness evidence.

# The Vice President

The Vice President replaces the Monk's appearance with an interpretation of Ethan Cary.
The user supplied five photographs and authorized this work.
The original photographs remain outside the repository and game assets.

## Source and preservation

`tools/build-vice-president.py` sculpts the licensed native Rocketbox mesh in Blender.
It retains the existing head topology, UVs, skin weights, facial bones, and animation clips.
The glasses use two meshes attached to the Head bone, with 1,135 vertices and two draw calls.
Their outline comes from 15 traced points in `assets/characters/vice-president-glasses-trace.json`.
The trace removes camera roll and estimates perspective distortion. It does not contain a photograph.

Image generation produced the neutral facial reference and base atlas from the supplied photographs.
Blender projects that reference onto the preserved head UVs.
The original projection and local nose-texture repair remain in `assets/characters` for reproduction.
The source photographs never enter the model or game distribution.

This is a likeness adaptation with measured two-dimensional constraints. It is not a facial scan.
Camera focal length, photographic expressions, and prescription lenses limit the measurements.

## Camera-adjusted refinement

The v12 refinement uses two supplied photographs with independent fitted cameras.
Local MediaPipe detects 478 image landmarks. The fit uses 49 paired anchors with different weights.
`tools/export-vice-president-landmarks.mjs` intersects detected model pixels with the actual posed mesh.
It retains triangle indices and barycentric weights, so later measurements track the same surface points.
`tools/fit-vice-president-cameras.py` fits rotation and translation across eight focal-length assumptions.
It never uses MediaPipe's inferred depth as a sculpting measurement.

Both original cameras remain fixed for the primary before/after comparison.
A second comparison refits each camera to report sensitivity.
The seated photograph and supplied profile provide separate visual checks.
Forehead landmark 10 is not the hairline. Silhouette landmarks also move with viewpoint.
The smiling front photograph cannot determine the neutral mouth or lower-face height by itself.

The restrained refinement moves each complete eyeball outward 1.25 mm and downward 1.25 mm.
The outer eyelids extend about 2 mm. Lower-face compression reaches 2 mm.
The mouth widens about 1.25 mm per side and rises slightly.
The nose base widens about 1.5 mm per side. The tip gains less width.
This stage does not change facial depth or widen the jaw.

Each original eye bone receives a constant offset parent and a matching inverse-bind adjustment.
The eye surface moves rigidly with its rotation center.
The original eye-bone transforms and all animation keys remain unchanged.
This matters because some existing clips animate eye translation.

| Candidate | Front, fixed camera | Tilt, fixed camera | Front, refitted | Tilt, refitted |
| --- | ---: | ---: | ---: | ---: |
| v10 baseline |10.368 px|8.558 px|10.368 px|8.558 px|
| v12 restrained fit |7.987 px|6.949 px|7.591 px|6.616 px|
| v14 hair, iris, and distal tip candidate |7.896 px|7.545 px|7.489 px|6.936 px|

Lower error alone does not establish a better likeness.
An earlier aggressive fit scored better but overfit the smile and apparent eye positions behind lenses.
Claude Opus 5.5 at High reviewed the photographs, matched views, and the restrained candidate.
Its v12 review found the remaining major differences in the eyes, hair, and under-nose appearance.

## Isolated appearance checks

The old iris workflow explicitly desaturated the eye disk and added a blue tint.
The new repair uses image-generated brown/hazel iris artwork in `vice-president-iris-repair.png`.
`tools/repair-vice-president-iris.py` registers that artwork to the original painted pupil.
It blends only an annulus, preserving the pupil, original catchlights, sclera, and all other atlas regions.

The reviewed 2048 px atlas has its pupil at approximately (539.2, 1910.0), measured from the upper-left corner.
The annular mask fades in between 12–16 px and fades out between 34–39 px.
The generated source has different iris proportions, so the registration corrects its center and scale.
A decoded PNG check confirmed exact equality outside the 39 px radius and inside the 12 px pupil radius.
The preserved PNG is checked before any optional JPEG encoding.
Run `python3 tools/check-vice-president-iris.py` to repeat the decoded-pixel and warm-color checks.

The v13 hair candidate lifts the front sweep by up to 5.9 mm and extends the rear hair by up to 11.7 mm.
It changes 216 scalp vertices and leaves the forehead and measured facial features unchanged.
The v14 candidate adds a distal nose-tip drop of at most 1.995 mm across 52 vertices.
Its nostril loops and topology remain intact.
These options remain separate, so either change can be rejected independently.

The nose change follows a material diagnostic, not a texture guess.
The dark band disappears with unlit albedo but remains on plain gray geometry.
Removing the normal map has little effect. Removing ambient occlusion has no effect.
Actual triangles form a 6.4 mm shelf with nearly downward normals beneath the tip.
Recomputed normals agree with the stored normals in that region.
The original sculpt also raised the tip despite its earlier comment describing a lowered tip.
The supplied profile supports testing a modest downward correction.

## Validation

`tests/vice-president-fit.test.js` checks both fixed cameras, rigid eye surfaces, matching eye pivots, and unchanged body/skin streams.
Its fixture contains derived coordinates and hashes, not photographs.
The expression test checks every combination of the maximum horizontal and vertical gaze angles.
It retains the existing 92% per-eye aperture limit and all geometric clearance limits.

The v14 candidate passes all four tests.
The detailed facial audit reports zero flipped triangles and no added eye penetration.
Each eye retains at least 95.19% of its original visible aperture.
Maximum lid movement is 0.465 mm. Maximum edge stretch is 1.284; minimum edge ratio is 0.561.
The sculpt's minimum sampled Jacobian is 0.666.
The model contains the same 37 animation payloads, unchanged body vertices, topology, UVs, and skin weights.

Run the candidate checks without replacing the public model:

```sh
NINJA_ETHAN_CANDIDATE=/tmp/ethan-landmarks-v14.glb \
  node --test tests/vice-president-fit.test.js
```

## Reproduction

First export an unmodified native Monk with the normal character builder.
The face builder rejects models that already contain its likeness metadata.
The full-export hook applies the checked-in face source. Animation-only exports preserve the existing face.

Build a separate reviewed candidate:

```sh
blender --background --python tools/build-vice-president.py -- \
  --input /tmp/monk-native.glb \
  --output /tmp/vice-president.glb \
  --face-texture assets/characters/vice-president-face-clean-eyes.png \
  --hair-shape swept --nose-tip-drop-mm 2
```

Use `--hair-shape baseline --nose-tip-drop-mm 0` for the v12 geometry comparison.

Register and blend the generated iris artwork:

```sh
blender --background --python tools/repair-vice-president-iris.py -- \
  --base-texture assets/characters/vice-president-face-baked.jpg \
  --output /tmp/vice-president-warm-eyes.png \
  --report /tmp/vice-president-warm-eyes.json
```

`tools/apply-vice-president-revision.py` transfers reviewed geometry onto the newest gameplay model.
It rejects in-place output and checks the previous geometry at every changed vertex.
It preserves all current animation payloads, including newer golf and combat clips.
The optional `--head-texture` appends the reviewed atlas without rewriting existing binary streams.
Keep the previous face model as the merge baseline until integration completes.

Render standard front, three-quarter, and profile views in isolated muted Chrome:

```sh
node tools/render-vice-president.mjs /tmp/vice-president.glb /tmp/vice-president-portrait
```

Render through a fixed fitted camera:

```sh
node tools/render-vice-president-matched.mjs \
  --model /tmp/vice-president.glb --fit /tmp/reference-cameras.json \
  --output /tmp/vice-president-matched --material original
```

The other material modes are `unlit`, `clay`, `no-normal`, and `no-ao`.
The root review accepted v14 for integration. It retains a visible under-nose shadow under some lights.
The private visual comparisons remain outside the public game.
The final source texture is `assets/characters/vice-president-face-clean-eyes.png`.
The earlier `vice-president-face-warm-eyes.png` remains the separate iris-repair intermediate.
The old `vice-president-face-baked.jpg` remains the reproducible base for the iris repair.

Rebuild the final eye-skin texture from that intermediate and the generated repair artwork:

```sh
blender --background --python tools/repair-vice-president-eye-skin.py -- \
  --output /tmp/vice-president-clean-eyes.png \
  --report /tmp/vice-president-clean-eyes.json
```

The two masks exclude the separate iris island. A decoded pixel comparison confirms no changes outside those masks.
The model stores the replacement image in its original buffer range, with no duplicate image payload.
