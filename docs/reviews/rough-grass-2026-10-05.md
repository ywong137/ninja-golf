# Photographic rough grass

The rough now uses shorter, denser leaf groups over a continuous fine turf surface near fairways.
The previous geometry looked like tall, separate weeds above worn ground.
Thirty-six small leaf groups now occupy each patch, compared with sixteen mixed-size groups before.
The six spreading templates retain their photographic textures and curved shapes.
The twelve original source templates remain available in the asset file.

The source is Rico Cilliers’ [Grass Bermuda 01](https://polyhaven.com/a/grass_bermuda_01), under [CC0](https://polyhaven.com/license).
`public/textures/SOURCES.json` records the original Blender checksum and installed texture checksums.
The existing two 1K images total 234,989 bytes. This update adds no textures or draw calls.
The [USGA course-definition reference](https://www.usga.org/content/usga/home-page/course-care/green-section-record/57/22/defining-definition.html) supports keeping the rough visually distinct from patterned fairways.

The base patch stays below eleven centimetres before local growth and instance scaling.
Nonuniform leaf scaling now applies the corresponding inverse scale to surface normals.
Root shading and the existing thin-leaf transmission model integrate the blades with their ground surface.
The near-fairway material fills gaps with fine turf. Worn or dry ground remains farther from the maintained area.
The desert fringe retains its transition into mineral soil.
Fairway mowing, golf boundaries, ball resistance, terrain heights, controls, and character motion remain unchanged.

## Bounded rendering

Each patch contains 432 triangles. The old patch contained 237 triangles.
The renderer trades distant patch coverage for greater nearby density.
Leaves fade between nine and sixteen metres. The texture surface remains visible beyond them.
The fixed buffer capacity drops from 22,500 to 12,100 patches.
Stable cell coordinates preserve placement as the player moves.
The cached window still includes the complete fade radius throughout every five-metre cell.

Grass follows the actual rendered ground triangles and tilts with their slope.
Placement excludes playing surfaces, collars, bunkers, paths, and nearby water.
The wind moves the leaf tips. No source Blender file downloads at runtime.

## Verification

Six focused checks pass across geometry, unit normals, slopes, placement, and bounded streaming.
The placement check samples more than 100,000 positions across all 36 holes.
Matched captures cover actual fairways, their boundaries, greens, and aerial views on all four course styles.
The inspection script finds a valid fairway station and solves its boundary before positioning the camera.
This avoids mistaking the gaps between desert fairway islands for maintained turf.

The final private build passes four course previews and a golf-to-combat sequence using normal keyboard and mouse input.
Ethan runs and performs light and heavy attacks. The heavy motion remains `Ethan_GDH_Combo5_Review`.
Both grass images return HTTP 200 and decode at 1024 × 1024.
The final bundle is `index-D0L1HRjN.js`.
All four course cards now show the updated scenery. No browser errors occurred, and all test browsers remained muted.

## Performance and limits

The comparison keeps twenty-four enemies alive during moving heavy attacks.
Chrome Metal on the local Apple M1 Max uses 1440 × 900 and a fixed rendering ratio of 1.0.
Each sample measures eight seconds after two warmup seconds. No other automated GPU job runs during sampling.

| Course | Previous FPS | Updated FPS |
| --- | ---: | ---: |
| Crane Coast | 39.3 | 41.2 |
| Heather & Crown | 56.7 | 48.0 |
| Copper Saguaro | 60.1 | 60.1 |
| Neo-Tokyo | 53.8 | 54.5 |

The updated samples have 95th-percentile frame times of 16.7–33.4 ms.
The longest measured frame is 66.7 ms, compared with 300 ms in the first baseline sample.
The baseline Crane Coast sample failed the forty-FPS threshold. All updated samples pass it.
These short encounters vary with combat timing and scene contents. They do not establish a general speed improvement or cross-device performance.
Cached grass updates take roughly 3–9 ms in the updated samples. Initial population takes roughly 24–38 ms.

The rough remains an approximation using textured surfaces and leaf groups.
It improves the earlier oversized, sparse plants but does not establish the full AAA visual objective.
Distant terrain, environmental variety, and dense-scene performance still need work.
The approved characters and accepted gameplay remain intact.
The complete build stays local/private at http://127.0.0.1:4185/, including Ethan’s purchased motions.

Current evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/ground-surfaces/`.
`before/` and `final/` contain matched views. `after/` holds a rejected intermediate material.
`performance-before/` and `performance-after/` hold timing reports and fight screenshots.
`production/` holds the exact-build course and combat checks.
The older `artifacts/reviews/rough-grass/` evidence describes the previous implementation.

## Reproduction

```sh
node --test tests/rough-grass.test.js tests/grass-streaming.test.js
GAME_URL=http://localhost:5184 node tools/capture-course-previews.mjs
npm run build
```
