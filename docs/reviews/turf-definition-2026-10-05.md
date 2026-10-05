# Course turf definition

Fairway mowing patterns now remain visible from the tee and survey camera.
The previous shader used weak contrast and placed stripe boundaries along the same axis as the grass grain.
The new bands alternate across the mowing direction. Their brightness reverses when the viewing direction reverses.

The visual reference is the USGA’s [Defining Definition](https://www.usga.org/content/usga/home-page/course-care/green-section-record/57/22/defining-definition.html).
Its course photographs and explanation distinguish mowing grain from differently colored grass.
The shader approximates that directional response. It does not simulate individual short grass blades.
No reference photographs or new textures ship with this change.

Each course has a mowing profile:

- Crane Coast uses diagonal stripes.
- Heather & Crown uses a split pattern along the authored fairway branches.
- Copper Saguaro uses broad crossed passes.
- Neo-Tokyo uses a tighter diagonal crossed pattern.

Tees use narrower passes. Greens use smaller, subtler passes.
Continuous cleanup bands follow the fairway perimeter.
Adjacent route segments blend their grain direction without changing the golf boundary.
A slightly deeper turf color separates the maintained areas from the rough.
Existing scanned color, normal, roughness, and broad growth variation remain active.

The shader filters subpixel bands to their average brightness. This prevents distant stripes from producing moving interference patterns.
It adds no textures, geometry, or draw calls.
Character assets, animation, lighting, controls, terrain heights, golf lies, and course layouts remain unchanged.

## Verification

Ten focused course, surface, and cache checks pass.
After the final grain blending change, all six course-set checks pass again.
The GPU check compares 2,304 rendered distances with CPU fairway distances across all 36 holes.
The largest difference is 0.000034 metres, within normal floating-point precision.

The same GPU check verifies these visible behaviors:

- Moving along a mower pass preserves its brightness.
- Crossing into the next pass reverses its contrast.
- Viewing from the opposite direction reverses its contrast.
- Unresolved stripes converge to the base turf brightness.
- Both halves of the split pattern have the expected opposing grain.

Matched captures cover all four themes, including tee, fairway, green, path, and survey views.
The reference and evidence remain in the primary checkout under `artifacts/reviews/turf-finish/`.
`before/` contains the previous material. `final/` contains the current material.
All browser checks run muted.

## Performance

The comparison uses 24 enemies, moving heavy attacks, 1440 × 900, and a fixed rendering ratio of 1.0.
Each eight-second sample uses Chrome Metal on the local M1 Max.

| Course | Previous shader FPS | Updated shader FPS |
| --- | ---: | ---: |
| Crane Coast | 40.3 | 41.6 |
| Heather & Crown | 49.0 | 48.7 |
| Copper Saguaro | 57.9 | 56.9 |
| Neo-Tokyo | 51.7 | 49.2 |

The updated samples have 95th-percentile frame times near 33.4 ms.
These short moving encounters include scene and timing variation. They do not establish performance on other hardware.
The shader stays within the requested lower frame-rate range, but the existing dense grass and foliage still consume substantial rendering time.

## Reproduction

```sh
node --test tests/course-sets.test.js tests/course-surface.test.js tests/course-surface-cache.test.js
GAME_URL=http://localhost:5184 node tests/browser-turf-mowing.mjs
npm run build
```

The full AAA presentation objective remains unfinished. This pass improves course definition and turf appearance.
The complete build remains local and private because it contains Ethan’s purchased motions.

The final private build passes all four course previews and normal golf-to-combat input as Ethan.
All three existing turf maps return HTTP 200 and decode at 2048 × 2048.
The run reports no browser errors. Its heavy attack selects the installed `Ethan_GDH_Combo5_Review` motion.
The production bundle is `index-DDTcFqaD.js`, served at `http://127.0.0.1:4185/`.
