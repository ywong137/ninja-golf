# Desert relief and distant terrain lighting

The Arizona background now uses a finer USGS 3DEP elevation crop.
The new grid has 2049 samples per axis, compared with 513 previously.
Its geographic bounds match the existing Sentinel color image.
The source pixel centers, export coordinates, finite elevations, and checksums passed validation.
The fictional course, playable terrain, horizontal scale, and vertical scale remain unchanged.

The desert mesh uses two adaptive refinement passes, bounded at 400,000 triangles.
The first desert hole reaches that limit, compared with the previous limit of 198,000 triangles.
Refinement keeps shared edges watertight and preserves the exact course boundary.
The sampled mesh error is 1.21 metres RMS against the finer elevation grid.
This measures mesh approximation, not geographic accuracy.
The other two natural themes retain their previous mesh limits.

A linear grid scan calculates terrain shadows for the fixed sun direction.
The shader reduces direct light in these shadows and retains ambient illumination.
The course and its immediate surroundings do not inherit these distant shadows.
This calculation adds one vertex attribute, without another texture sampler or draw call.
The scan explicitly rejects unsupported sun directions.

The finer data improves the cliff outlines.
It does not resolve the remaining distant material and landscape composition limitations.
A trial using survey derivatives for surface normals produced black creases and was rejected.
The final mesh retains normals calculated from its actual triangles.

## Sources and reproduction

Public source: https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer

The service identifies its release as August 25, 2026.
The source contains one float32 elevation band, without a hillshade rendering function.
USGS government material is public domain in the United States.
The shipped source manifest records the exact export URL, geographic bounds, and source and output hashes.
The previous desert grid was removed from the shipped assets.
The new grid contains 8,396,802 bytes, before transfer compression.

The offline conversion uses NumPy and Pillow:

```sh
python3 tools/build-desert-relief.py \
  --source-tiff /Users/yishan/ninja-golf/artifacts/reviews/terrain-relief/source/sedona-usgs-2049.tif \
  --export-json /Users/yishan/ninja-golf/artifacts/reviews/terrain-relief/source/usgs-export.json \
  --request-json /Users/yishan/ninja-golf/artifacts/reviews/terrain-relief/source/request.json
```

The Mapzen builder now preserves the Arizona record and rebuilds only Japan and Scotland.
This prevents accidental replacement with the older Arizona grid.

## Verification

Eighteen focused unit checks pass.
They cover source integrity, coordinate alignment, playable boundaries, mesh errors, shared edges, surface sampling, and shrub placement.
Independent sun rays verify shadow results for both grid orientations and all four diagonal sun directions.

Muted Chrome checks pass all eighteen Highland and desert holes.
The checks cover shrub placement, detail transitions, shader compilation, and disposal after horizon replacement.
Twelve captured views cover Japan, Scotland, and Arizona without browser errors.
Desert hole loading measured 2.28–3.64 seconds in the placement check, including scenery creation.
This is a local measurement, not a cross-device guarantee.

Evidence resides in `/Users/yishan/ninja-golf/artifacts/reviews/terrain-relief/`.
Use `before/` and `final/` for the accepted desert comparison.
The intermediate folders preserve rejected or superseded experiments.

## Performance

The four twenty-four-enemy combat samples average 40.3, 52.2, 46.6, 50.2 FPS.
The previous private build measured 40.6, 47.2, 46.4, and 50.3 FPS.
Both runs used Chrome Metal on this Mac’s M1 Max at 1440 × 900 and pixel ratio 1.0.
Each sample measured eight seconds after two warmup seconds.
No automated GPU job ran concurrently during these measurements.
The 95th-percentile frame takes about 33.4 milliseconds; the longest measured frame takes 83.3 milliseconds.
All updated samples exceed forty FPS. These short samples do not establish a speed improvement or cross-device performance.

## Private build

The verified private bundle is `index-fXTCBuXo.js` at http://127.0.0.1:4185/.
All four course previews and Ethan’s normal golf-to-combat input sequence pass without browser errors.
His heavy attack remains `Ethan_GDH_Combo5_Review`.
The new elevation file loads successfully and matches the source asset exactly.
The old desert elevation file is absent from the built game.
All three affected preview images were refreshed.

The approved Ronin and Closer, accepted controls, and character motions remain unchanged.
All automated browsers stayed muted and were closed after testing.
No public upload occurred. The complete game and purchased motions remain private.
The broader AAA objective remains incomplete.
