# Scanned landscape assets

The landscape uses Poly Haven models under CC0. Their source links and license links ship in `public/models/nature/SOURCES.json`.

| Game asset | Source | Use |
| --- | --- | --- |
| Forest canopy | island_tree_01 | Japanese gardens, Highland groves, city gardens |
| Dry tree | quiver_tree_01 | Desert trees and young plants |
| Understory | shrub_01 | Woodland shrubs and planted borders |
| Fern | fern_02 | Shaded woodland ground |
| Coastal rock | boulder_01 | Garden boulders and shoreline rocks |
| Desert rock | namaqualand_boulder_02 | Desert boulders and distant formations |
| Sea cliff | coastal_cliff_02 | Scanned coastal and Highland rock faces |

The build preserves source texture maps and UV coordinates. It reduces geometry in Blender and exports two detail levels.
The tree build thins whole leaf groups before reduction. This prevents the canopy from collapsing into disconnected triangles.
The trunk has a separate geometry budget. The importer welds matching scan vertices before reduction.

The runtime instances each material group. It selects geometry by distance and uses 24-view tree images beyond 112 metres.
Each tree atlas contains eight horizontal directions at three elevations: 0°, 30°, and 60°.
Albedo and normal atlases let distant trees use the same scene lighting as nearby geometry.
Eight projected branch silhouettes supply ground shadows beyond the dynamic shadow range.
Short dithered transitions connect the detail levels at 34–36 and 108–112 metres.
Close trees retain full branch geometry. Ground shrubs disappear beyond their useful viewing distance.
Tree groves leave open views across the course. Plants and rocks stay outside the authored fairways and greens.

The ground shader uses scanned grass and sand textures. It preserves texture contrast after color-space conversion.
Neo-Tokyo uses Poly Haven’s CC0 Shanghai Bund night panorama for its fictional skyline and reflected light.
The scenery retains generated buildings and small ambush props. This change replaces the main natural landscape assets.

## Rebuild

Set `NINJA_BROWSER_UA_FILE` to a JSON file with the current Chrome user-agent string.
The download helper uses browser headers and verifies each file against the source checksum.

```sh
python3 tools/download-nature.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-nature.py --
python3 tools/compress-glb-textures.py --alpha-size 1024 public/models/nature/*.glb
PLAYWRIGHT_CHANNEL=chrome node tools/bake-nature-impostors.mjs
```

The image bake requires the local development server. It runs with audio muted.

The bake writes color, normal, and shadow WebP atlases, plus view bounds in `src/nature-views.json`.
Run `node tests/browser-nature.mjs` to inspect day, night, aerial, and detail-transition views.

## Regional landforms

The distant landscape uses public Mapzen Terrain Tiles instead of the previous sinusoidal ridge.
Three source regions give the courses different valleys and silhouettes:

- Sanuki Hills, Shikoku, Japan.
- Cuillin Hills, Isle of Skye, Scotland.
- Sedona, Arizona, United States.

The shipped grids contain 513 × 513 signed 16-bit heights each.
Source URLs, crop bounds, hashes, and attribution ship in `public/terrain/`.
`tools/build-regional-terrain.py` reproduces the grids from the original Skadi files.
The game changes horizontal scale, elevation, and placement around its fictional courses.
It does not reproduce actual golf courses from these surveys.

A graded mesh joins the original detailed course edge exactly.
Every playable position still uses the existing golf height field.
The current horizon uses about 135,000 triangles, compared with 258,000 in the first regional implementation.
Each failed region falls back separately, preserving other downloaded regions.

Japanese and Highland forest belts use one additional atlas draw each.
The trees sit outside the playable course limits and follow clustered groves.
A triangle sampler grounds their trunks on the rendered horizon surface.
This prevents floating trees where reduced geometry differs from the source height field.

Bunker masks, maps, lie detection, and terrain height share one deterministic scalloped contour.
Their depressed floors rise into rounded turf lips.
The bunker mesh uses approximately 0.5 m spacing around each hazard.
