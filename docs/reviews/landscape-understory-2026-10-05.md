# Distant shrub coverage

Heather & Crown and Copper Saguaro now retain shrubs beyond their previous rendering limits.
Grouped planting also fills parts of the open ground beyond each course.
The existing CC0 plant models supply the new distant views.
The approved Ronin and Closer designs, character movements, and controls remain unchanged.

## Scope and appearance

Each shrub atlas has eight horizontal views and three elevations, plus source normal-map detail and baked cavity shading.
The six WebP files total 470,310 bytes.
The existing source credits now record their builder commands, file sizes, and SHA-256 checksums.
No external models or textures were downloaded during this pass.

The first prototype replaced full shrubs at 64–100 metres. Its pale, blurred silhouettes visibly weakened the course views.
Normal-map baking and cavity shading improved the representation, but did not justify that close substitution.
The final version retains native desert shrubs through 260 metres, then fades into their atlases by 300 metres.
Woody shrubs start that transition at 160 metres and finish at 180 metres.
Separate near-to-middle transitions preserve the existing detailed meshes near the camera.
Ground silhouettes follow the sun direction and fade with the geometry transition.
Both affected course cards now show the updated scenery.

## Placement and cost

Each hole uses an independent, fixed planting seed.
Shrubs form elliptical patches on gentle terrain, with open ground between patches.
Placement excludes water, steep slopes, high summits, and the full playable rectangle plus a 65-metre margin.
The actual rendered terrain triangles determine the root heights.
This preserves existing course layouts, cover positions, and collision objects.

The nine Highland holes contain 3,652–5,571 background shrubs each.
The nine desert holes contain 12,861–13,457 shrubs each.
Hard limits remain 9,000 and 14,000 respectively.
The Highland background adds two draw calls. The desert background adds four.
Each background shrub uses two image triangles and two ground-shadow triangles.
These batches do not cast dynamic shadows or require per-frame placement updates.
Course replacement disposes their geometry, materials, and instance buffers while retaining shared atlas textures.

## Verification

Sixteen focused unit checks pass for placement, source geometry, existing forests, and projected shadows.
The muted browser check covers all eighteen affected holes, all shrub detail levels, shader compilation, and cleanup after rebuilding the horizon.
It verifies every background root against the rendered terrain and every position against the protected play area.
All four course previews and Ethan's normal golf-to-combat controls pass in the private production build.
The heavy attack still uses `Ethan_GDH_Combo5_Review`.
All six shipped WebP images decode at the expected dimensions.

The production bundle is `index-Du9VekgH.js`.
The game remains local/private at http://127.0.0.1:4185/.
No public push occurred. All automated browsers remained muted.

## Performance and limits

The benchmark uses twenty-four enemies, moving heavy attacks, and a fixed 1440 × 900 rendering size.
Chrome uses Metal on the local Apple M1 Max, at rendering ratio 1.0.
Each sample measures eight seconds after two warmup seconds, without another automated GPU job.

| Course | Before FPS | Updated FPS |
| --- | ---: | ---: |
| Crane Coast | 40.6 | 40.6 |
| Heather & Crown | 52.8 | 47.2 |
| Copper Saguaro | 53.3 | 46.4 |
| Neo-Tokyo | 51.3 | 50.3 |

All final samples exceed forty FPS. The 95th-percentile frame takes about 33.4 ms; the longest takes 83.4 ms.
The Highland and desert samples are slower than the baseline.
The new scenery costs some rendering time, and short encounter differences also affect the comparison.
These tests do not establish full-round or cross-device performance.
The distant plants still simplify detail and do not replace the need for stronger landscape composition.
This completes a bounded scenery improvement, not the full AAA objective.

## Reproduction

```sh
GAME_URL=http://localhost:5184 node tools/bake-nature-impostors.mjs --tile-size=128 --occlusion desert-scrub woody-scrub
node --test tests/landscape-understory.test.js tests/forest-shadows.test.js tests/distant-forest.test.js tests/nature-variety.test.js
node tests/browser-understory.mjs http://localhost:5184 /private/tmp/ninja-understory
GAME_URL=http://localhost:5184 node tools/capture-course-previews.mjs --courses=1,2
npm run build
```

Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/outskirts/`.
`before/` and `final/` contain matched aerial views.
The final ground cameras differ from the initial, obstructed cameras. Do not treat those views as matched comparisons.
`compare/` shows isolated native and atlas models.
`after/`, `normal-map/`, `occlusion/`, and `crisp/` preserve rejected intermediate choices.
`validation/`, `performance-before/`, `performance-after/`, and `production/` contain the checks and final screenshots.
