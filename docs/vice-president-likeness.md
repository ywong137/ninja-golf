# The Vice President

The Vice President replaces the Monk's visual identity with an interpretation of Ethan Cary.
The user supplied five reference photographs and authorized their use for this character.
The source photographs remain outside the repository and game assets.

## Geometry and appearance

`tools/build-vice-president.py` sculpts the licensed native Rocketbox mesh in Blender.
It changes 2,341 head, hair, and neck vertices while keeping the original vertex count.
The edits change the jaw, cheeks, nose, forehead, eyelids, and chin proportions.
The head retains its native facial bones, skin weights, UV coordinates, and animation clips.

The glasses use two small meshes attached to the existing Head bone.
They have rectangular dark frames and silver temples.
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
The final model includes those corrections and keeps the native eye spheres separate from the eyelid edits.
The final Opus 5.5 High review accepted the likeness for user review, with no major mismatch remaining.
It suggested later improvements to brow contrast, hair volume, and nose shading.
The saved reviews are in the ignored `artifacts` directory.

The mesh patch preserves all 37 original clips and their animation buffers.
The final integration checked 16,995 animation, skin-weight, joint-index, and UV streams without differences.
The candidate adds approximately 650 KB to the native model.
The normal correction preserves the source artist's smooth normals across UV seams.
The minimum sampled sculpt Jacobian is positive, so the deformation does not fold at the checked vertices.

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

To revise the facial projection, export the sculpted Blender scene first:

```sh
blender --background --python tools/build-vice-president.py -- \
  --input /tmp/monk-native.glb \
  --output /tmp/vice-president-preview.glb \
  --blend /tmp/vice-president.blend
blender --background --python tools/bake-vice-president-face.py -- \
  --blend /tmp/vice-president.blend
```

Then rebuild the candidate with the updated JPEG.
The builder rejects an input that already contains the likeness to prevent a second sculpt pass.

Render a level-camera comparison in muted Chrome:

```sh
node tools/render-vice-president.mjs /tmp/vice-president.glb /tmp/vice-president-portrait
```
