# Photographic rough grass

The rough now uses photographed leaf textures and curved source geometry.
The previous grass used isolated narrow triangles. The new patches give nearby rough visible leaf shapes and uneven height.
Twelve authored leaf groups supply sixteen varied groups in each repeated patch.
Course colors and heights vary. Desert growth stays close to the fairway; city growth stays shorter.

The source is Rico Cilliers’ [Grass Bermuda 01](https://polyhaven.com/a/grass_bermuda_01) from Poly Haven.
Its [CC0 license](https://polyhaven.com/license) permits this use.
`public/textures/SOURCES.json` records the source links, original Blender checksum, and installed texture checksums.
The two 1K textures total 234,989 bytes. The geometry templates add 89,978 bytes before compression.
No source Blender file downloads at runtime.

Grass follows the actual rendered ground triangles and tilts with the slope.
Placement excludes playing surfaces, green collars, bunkers, paths, and nearby water.
A lower first cut blends into taller rough. Wind moves the leaf tips.
The opacity shader preserves thin leaves and corrects dark edges from the source photograph.
Golf lies, resistance, collision, character models, animation, and controls remain unchanged.

## Bounded streaming

A fixed grid gives each patch a stable position, rotation, and scale.
The cache reuses patch transforms when the player crosses a five-metre cell boundary.
It stores only the current window, including rejected cells. Long walks do not accumulate the whole course.
Grass fades from 17 to 24 metres. The streaming circle includes that range throughout each cell.
Patches outside that circle no longer submit invisible geometry.

## Verification

Nine focused checks pass across grass geometry, streaming, slopes, and bunker compatibility.
Placement checks sample more than 100,000 positions across all 36 holes.
They verify empty playing surfaces and protected green and bunker margins.
The exporter reproduces the installed geometry byte-for-byte from the original Blender source.

Muted browser captures cover all four themes, tees, rough, and greens without browser errors.
The private production build passes all four course previews and normal golf-to-combat input as Ethan.
Both grass images return HTTP 200 and decode at 1024 × 1024.
The production bundle is `index-DRXemcow.js`.

The combat comparison uses 24 enemies, moving heavy attacks, 1440 × 900, and a fixed rendering ratio of 1.0.
Each short sample uses Chrome Metal on this Mac’s M1 Max.

| Course | Earlier grass FPS | New cached grass FPS |
| --- | ---: | ---: |
| Crane Coast | 51.6 | 41.3 |
| Heather & Crown | 57.5 | 47.6 |
| Copper Saguaro | 59.4 | 55.6 |
| Neo-Tokyo | 54.3 | 50.0 |

The final invisible-patch reduction received another Crane Coast check. It averaged 40.4 FPS with 24 enemies and no browser errors.
The 95th-percentile frame time was 33.4 ms. One frame reached 99.9 ms.
These samples meet the lower requested frame-rate target, but the new grass has a measurable rendering cost.
The final culling change does not establish a speed improvement within this short comparison.
Other hardware and longer encounters remain unmeasured.

Cached movement updates take about 7–14 ms, versus 34–46 ms in the earlier grass path.
The initial uncached population remains slower: about 66–84 ms in these samples.
The game still has wider performance and visual work before it reaches the requested AAA standard.

## Reproduction

Run the exporter with Blender and the original CC0 source file.

```sh
blender --background --threads 2 -noaudio --python tools/export-rough-grass.py -- \
  --source /path/to/grass_bermuda_01_1k.blend \
  --output src/rough-grass-templates.json
node --test tests/rough-grass.test.js tests/grass-streaming.test.js tests/bunkers.test.js
npm run build
```

Evidence lives in the primary checkout under `artifacts/reviews/rough-grass/`.
`final/` contains the current views. `production/` contains the built-game report.
`performance-final/` contains four cached encounters; `performance-culled/` contains the final Japanese encounter.
Earlier prototype folders record rejected versions and should not serve as current screenshots.
The complete build remains local and private because it includes Ethan’s purchased motions.
