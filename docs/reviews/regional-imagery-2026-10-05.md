# Regional landscape color

Heather & Crown and Copper Saguaro now use color imagery aligned with their existing elevation grids.
The Highland slopes gain their photographed rock and moorland variation.
The desert gains distinct red sandstone and pale upper cliffs, replacing much of the repeated procedural banding.
This changes distant surfaces, not playable terrain geometry or golf boundaries.
The accepted characters and gameplay remain intact.

## Sources and processing

The images use Sentinel-2 L2A true-color scenes from the public Earth Search catalog:

- Cuillin Hills: `S2B_29VPD_20240919_0_L2A`, September 19, 2024.
- Sedona: `S2B_12SVD_20240913_0_L2A`, September 13, 2024.

The [collection metadata](https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a) identifies the data producers, processors, and license.
The [official notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice) permits reuse and modification with attribution.
The in-game credits and terrain license now include: “Contains modified Copernicus Sentinel data 2024.”
`public/terrain/IMAGERY.json` records scene URLs, bounds, dates, file sizes, and SHA-256 checksums.

The builder reads only the source blocks needed for each crop.
It reprojects both scenes into the existing geographic bounds and writes 2048 × 2048 JPEGs.
The Highland file contains 606,262 bytes. The desert file contains 1,949,118 bytes.
Seven isolated black pixels in the desert crop use their nearest valid neighbors.
The builder rejects incomplete swaths with one hundred or more missing pixels.
Offline reconstruction produces byte-identical JPEGs from the saved crops.

A Japanese scene was inspected but rejected because clouds and dense urban detail weakened the course setting.
The first desert candidate lacked coverage across much of the required crop and was also rejected.
Neither rejected source ships with the game.

## Rendering and loading

Image coordinates follow the elevation grid, including its course-specific placement and north–south reversal.
The shader reverses image rows for Three.js texture coordinates.
The imagery blends in between 900 and 2,000 metres outside the detailed terrain rectangle.
This avoids projecting photographed sea onto the invented ground around each playable course.
The final blend reaches 85 percent. Existing scanned rock detail retains fine surface variation.
The desert exposure multiplier reduces excessively bright cliffs from the initial direct-image prototype.

Each course requests its own image when required. Revisits reuse the cached texture.
Late responses cannot switch the current course. Failed responses retain the existing procedural terrain material.
Asset readiness now includes images that start loading after the elevation grids arrive.

The first shader prototype exceeded the GPU's sixteen-texture limit.
The corrected shader shares the existing grass normal texture instead of loading a separate distant-grass normal.
All four course shaders compile on the tested sixteen-texture GPU.
The update adds no terrain triangles or draw calls.
Each loaded image needs roughly 21.3 MiB of GPU memory, including mipmaps.
Both course cards now show the revised scenery.

## Checks

Nine focused tests pass for source integrity, grid alignment, image orientation, terrain seams, and geometry limits.
They cover all 36 playable course boundaries and both north–south mapping directions.
A muted browser check verifies course-specific downloads, delayed completion, caching, failure fallback, and shader compilation.
Matched fairway and aerial views cover the three natural course themes.
The final private production check covers all four course previews and Ethan's golf-to-combat sequence.

The production bundle is `index-CK68sb2L.js`.
The complete build remains local/private at http://127.0.0.1:4185/.
Ethan's purchased motions remain included. No files were pushed to the public repository.

## Performance and limits

The comparison uses twenty-four enemies, moving heavy attacks, and a fixed 1440 × 900 rendering size.
Chrome uses Metal on the local Apple M1 Max. The rendering ratio stays at 1.0.
Each sample measures eight seconds after two seconds of warmup.
All automated browser tests remain muted.

| Course | Before FPS | Updated FPS |
| --- | ---: | ---: |
| Crane Coast | 41.6 | 40.8 |
| Heather & Crown | 52.3 | 47.8 |
| Copper Saguaro | 52.7 | 52.4 |
| Neo-Tokyo | 49.5 | 50.9 |

Updated 95th-percentile frame times are approximately 33.4 ms. The longest frame is 83.3 ms.
Every updated sample passes forty FPS. Short encounter differences do not establish a general performance improvement.
The source images retain some photographed lighting and cannot add geometric detail absent from the elevation mesh.
The landscape still needs better intermediate scenery and less uniform transitions near the course.
This improves regional surface variation but does not complete the full AAA quality objective.

## Reproduction

```sh
node --test tests/regional-terrain.test.js tests/landscape-horizon.test.js
node tests/browser-regional-imagery.mjs http://localhost:5184 /private/tmp/ninja-regional-imagery
GAME_URL=http://localhost:5184 node tools/capture-course-previews.mjs --courses=1,2
npm run build
```

`tools/build-regional-imagery.py --help` describes offline and remote reconstruction.
Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/regional-imagery/`.
`before/` and `blended/` contain the accepted comparison views.
`prototype/`, `aligned/`, and `textured/` record rejected intermediate shaders or materials.
`loading/`, `performance-before/`, `performance-after/`, and `production/` contain the checks and screenshots.
