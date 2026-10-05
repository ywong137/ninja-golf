# Scanned cliff surfaces

The Arizona background now uses Poly Haven’s Cliff Side scan for exposed rock faces.
The paired color and OpenGL normal maps replace the boulder texture on those faces.
Matching triplanar coordinates put the scan across the rock surfaces without stretching a flat overhead image down the cliffs.
Shallow slopes retain more loose ground cover.

The shader preserves contrast when it blends texture patches.
It smooths the overhead color image on steep Arizona faces, retaining its broad geographic color variation.
The photographed scan supplies smaller rock layers and fractures.
Normals follow those layers and remain tangent to the underlying surface.
The rock detail remains visible beyond the previous fixed distance fade.

The scan covers about 1.83 metres in its source photography.
The game places it more broadly to represent larger geological layers.
This is an artistic scale change, not a geographically measured reconstruction of Arizona rock strata.
The actual terrain geometry, course layouts, and collision surfaces remain unchanged.

## Assets

Source: https://polyhaven.com/a/cliff_side

Photography: Dario Barresi and James Ray Cock.
Processing: Jenelle van Heerden.
License: CC0, https://polyhaven.com/license

The two 2048-square maps total 3,211,002 bytes.
Both retain RGB channels with no chroma subsampling at JPEG quality 90.
The source file MD5 values match the public API records.
The shipped source manifest records source URLs, authors, source dimensions, output sizes, and SHA-256 values.
The scan uses existing shader texture slots, without more draw calls or geometry.

The game requests these maps only when Arizona terrain first needs them.
Both maps must finish successfully before the shader uses either.
A failed map preserves the complete previous material and disposes the unused new texture.
Course changes share the loaded pair.
Late responses update their cached material without changing the selected course.

Evidence and source files: `/Users/yishan/ninja-golf/artifacts/reviews/cliff-materials/`.
Reproduce the maps with `tools/build-cliff-materials.py --source-dir <evidence>/source`.
An independent output directory reproduces both shipped maps byte for byte.

## Verification

Seventeen focused unit checks pass for course definitions, terrain coordinates, source integrity, and terrain shadows.
Both new images decode at 2048 square and match their manifest checksums.
A muted browser test verifies delayed maps, selection changes, shared caching, and each map failing independently.
The fallback and loaded shaders compile within the tested GPU’s sixteen-texture limit.

## Performance

The four twenty-four-enemy samples average 40.6, 46.7, 51.6, 51.4 FPS.
The previous private build measured 40.3, 52.2, 46.6, and 50.2 FPS.
Both runs use Chrome Metal on the local M1 Max, 1440 × 900, and pixel ratio 1.0.
Each sample covers eight seconds after two warmup seconds.
No other automated GPU job ran during sampling.
The 95th-percentile frame takes about 33.4 ms. The longest measured frame takes 83.5 ms.
These short samples do not establish a speed improvement or performance on other computers.

## Checkpoint

The private production build `index-C-19oK1s.js` passed its four-course preview and Ethan combat checks.
The user then prioritized character movement. Scenery work stopped at this tested checkpoint.
