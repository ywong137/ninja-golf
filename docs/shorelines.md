# Local water levels and graded shores

The old terrain placed every pond at 3.1 m, regardless of surrounding elevation. Several elevated ponds looked like deep pits. The previous audit found banks approaching 84 degrees.

Each basin now has a cached local profile. Its water plane starts below the median uncarved shoreline height. Nearby greens and dry islands constrain that plane. The terrain forms a graded shore around the same horizontal hazard footprint. Lower surrounding ground receives a retaining shoulder where necessary.

Bank widths use meters and local height differences. Signed distances include the dry island and bridge masks. The putting surfaces and tees retain their original heights. Wider grades stop before those surfaces and the ocean boundary. These are designed golf ponds, including some raised banks; the algorithm does not simulate natural hydrology.

`waterSurfaceAt(course,x,z)` returns the visible water elevation, or null on dry ground. Pond rendering, ball contact, flight previews, and water ambush sites use this API. Ocean contact uses its separate −1.1 m plane. The coastal terrain now meets that plane at the horizontal hazard boundary.

Water entrances choose nearby dry land with moderate slopes. The search rejects blocked landings and arcs that cross terrain or buildings. Shallow entrances begin above the bed. Trees and undergrowth cannot occupy a bridge corridor.

The terrain includes finer shoreline triangles and a damp soil margin. Pond reflections use 1024-pixel targets. Caustic detail fades before it becomes an aerial dot pattern. The shader estimates depth from the same 1.8 m basin depth and 8 m inner slope.

## Verification

All 185 unit tests pass. The tests cover these requirements:

- All 38 pond profiles drive their actual reflection planes.
- Dense wet samples remain below the visible water; dry islands remain above it.
- Water edges are continuous across the horizontal hazard boundary.
- Protected tee and putting surfaces keep their original heights.
- The ocean hazard and visible shoreline meet the same contour.
- Ball contact and flight previews agree across all 36 holes.
- Water entrance searches check slope, collision, and arc clearance.

The maximum grade in the old narrow bank band fell to 0.672 analytically and 0.684 on rendered triangles, approximately 34 degrees. This comparison uses the old audit region and excludes dry crossing masks.

A wider radial audit covers the full graded area. It excludes bunker margins and unchanged terrain. Its largest sampled slope is 50.7 degrees on Ninefold Return's outer, ocean-facing bank. The next largest is 42.9 degrees on The Long Glen. Those wider slopes remain a terrain refinement opportunity. The old narrow-band result does not establish a maximum for all terrain.

The full game-loop browser test covers six representative holes. It checks actual penalty strokes, ball reset, reflection heights, water entrances, and bridge clearance. Each case spawns six enemies from water. Their entrance paths stay above the bed and finish on dry ground.

The putting test now checks both a controlled Lotus Crossing putt and an overhit. The controlled putt stops in rough. The overhit rolls down the revised bank into water. Both outcomes match the actual game loop.

## Visual review and tools

`node tools/capture-shorelines.mjs before|after` captures five pond environments from aerial and shore cameras. Captures go to `/tmp/ninja-shorelines-LABEL`. The horizontal views match; camera heights follow the changed ground and water elevations.

The reviewed views show shallower banks, a continuous waterline, dry islands, and clear bridges. The new Palm Mirage and Sunset Terrace aerial views show different landing strategies. This pass improves their terrain and layout. It does not establish photorealistic environments or complete the AAA goal.

`node tools/benchmark-shorelines.mjs [--retina]` measures charging previews and three pond combat scenes with 64 enemies. Run GPU captures and performance checks sequentially.

## Performance and release checks

Muted headless Chrome used ANGLE Metal on an Apple M1 Max. Each test used a 1440 × 900 viewport and Balanced graphics. The higher-resolution run used a display scale of 2. Adaptive rendering selected the pixel ratios below. Each measured interval lasted ten seconds after warmup.

The combat cases retained 64 enemies and repeated light and heavy attacks. The fixture held the hero near the shore for a stable view. The normal gameplay HUD remained visible. These are local stress checks, not performance guarantees for other machines.

| Scene | Desktop FPS | Desktop ratio | Higher-resolution FPS | Higher-resolution ratio |
| --- | ---: | ---: | ---: | ---: |
| The Crane’s Landing — charging | 60.1 | 1.00 | 60.0 | 1.50 |
| The Sunken Kirk — water combat | 56.3 | 0.95 | 54.1 | 1.35 |
| Oasis Carry — water combat | 57.5 | 0.90 | 52.1 | 1.20 |
| Moon Rabbit Circuit — water combat | 60.1 | 0.85 | 52.4 | 1.15 |

The 95th-percentile frame interval was 16.8 ms for the desktop cases. Higher-resolution combat measured 33.3–33.4 ms. Contact shading remained active during golf. The existing performance controller disabled it during these combat cases.

The production build passes. Browser checks pass for all 36 holes, putting previews, live water penalties, combat, buildings, and environment views. All four course preview images were refreshed.
