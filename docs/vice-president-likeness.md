# The Vice President

The Vice President replaces the Monk's visual identity with an interpretation of Ethan Cary.
The user supplied five reference photographs and authorized their use for this character.
The source photographs remain outside the repository and game assets.

## Geometry and appearance

`tools/build-vice-president.py` sculpts the licensed native Rocketbox mesh in Blender.
It changes 2,340 head, hair, and neck vertices while keeping the original vertex count.
The edits change the jaw, cheeks, nose, forehead, eyelids, and chin proportions.
The head retains its native facial bones, skin weights, UV coordinates, and animation clips.

The glasses use two small meshes attached to the existing Head bone.
They have rounded dark frames and brighter silver temples.
They add 1,135 vertices and two draw calls.
The eyes remain visible through the frames; no opaque lens covers them.

Image generation produced a neutral facial reference and a base atlas from the supplied photographs.
Blender projects the facial reference onto the existing UVs using facial landmarks and a soft boundary mask.
The game loads a 2,048-pixel JPEG inside the model.
The generated references stay in `assets/characters`; the original photographs do not.

This is a topology-preserving likeness adaptation, not a scan or a measured facial reconstruction.
Its face texture and geometry should be judged together in the game.

## Review

Claude Opus 5.5 at High reviewed the photographs and the first mesh candidate.
Its review rejected the narrow chin, hollow cheeks, pointed nose, square glasses, and artificial hair strands.
Later reviews corrected excess jaw width, a short forehead, round eyes, and iris saturation.
The final model includes an oval jaw, less jowl fullness, an upright forehead, wider swept-back hair, and thinner glasses rims.
The sculpt rotates each complete eye surface rigidly, using the painted pupil position to align both gaze axes.
The previous sculpt deformed the eyeballs and preserved the native divergent pupil directions.
The new eye calibration preserves all pairwise eye-vertex distances within 0.00012 mm.
The final Opus 5.5 High review accepted the likeness for user review, with no major mismatch remaining.
The final targeted review accepted the current-profile forehead, slimmer cheeks, silver temples, and rim thickness.
Some directional lighting still produces a dark shadow below the nose. An unlit check shows grey stubble there.
The saved reviews are in the ignored `artifacts` directory.

The mesh patch preserves all 37 original clips and their animation buffers.
The final integration checked 16,993 animation, skin-weight, joint-index, and UV streams without differences.
The candidate adds approximately 650 KB to the native model.
The normal correction preserves the source artist's smooth normals across UV seams.
The minimum sampled sculpt Jacobian is 0.624, so the deformation does not fold at the checked vertices.
The angry-face audit reports no flipped triangles across all four gaze corners.
The final half-millimetre sampler resolves each eye separately.
At least 94.6% of each original visible eye aperture remains open.
The test retains the reviewed 92% threshold and all geometric clearance limits.
The correction adds no extra meshes or draw calls beyond the existing glasses.

## Rebuild

First export an unmodified native Monk with the standard character builder.
Its full-export path automatically applies the checked-in likeness texture and sculpt.
Animation-only exports preserve the existing face and accessories.

For a separate candidate, run:

```sh
blender --background --python tools/build-vice-president.py -- \
  --input /tmp/monk-native.glb \
  --output /tmp/vice-president.glb \
  --face-texture assets/characters/vice-president-face-baked.jpg
```

The final JPEG derives from the preserved UV projection in `assets/characters/vice-president-face-projection.jpg`.
The generated nose correction uses a small UV mask. It does not replace the entire atlas.
To reproduce that texture correction, run:

```sh
blender --background --python tools/repair-vice-president-face.py -- \
  --native-model /tmp/monk-native.glb \
  --base-texture assets/characters/vice-president-face-projection.jpg \
  --output assets/characters/vice-president-face-baked.jpg
```

The repair image is generated project artwork. It contains no original photograph.
`tools/bake-vice-president-face.py` retains the original projection workflow and its calibrated landmarks.
A new projection requires checking those landmarks against the revised sculpt.
The normal model rebuild uses the accepted JPEG directly and does not repeat that projection.

The builder rejects an input that already contains the likeness to prevent a second sculpt pass.

Render a level-camera comparison in muted Chrome:

```sh
node tools/render-vice-president.mjs /tmp/vice-president.glb /tmp/vice-president-portrait
```
