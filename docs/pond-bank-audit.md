# Pond bank audit

CPU review of the current environment. This audit does not change pond geometry or water behavior.

## Measurement

Sampled 36 holes and 38 basins. Each basin uses 144 angular samples and 25 radial samples across its outer bank (ellipse radius 1.00–1.16). Central differences use a 0.10 m offset. Samples within 0.5 m of dry bridge/island masks are excluded. Rendered estimates use courseSurfaceHeight, which interpolates the actual terrain triangles. These are sampled maxima, not a mathematical proof of the continuous maximum.

| Hole | Japanese max angle | Highland max angle | Desert max angle | City max angle |
|---|---:|---:|---:|---:|
| 1 | 76.0° | 76.4° | 78.4° | 76.2° |
| 2 | 63.1° | 75.7° | 79.0° | 54.4° |
| 3 | 71.2° | 79.7° | 75.9° | 67.3° |
| 4 | 78.8° | 72.7° | 57.0° | 67.0° |
| 5 | 65.4° | 83.7° | 80.4° | 79.0° |
| 6 | 79.9° | 78.0° | 62.3° | 75.0° |
| 7 | 78.0° | 80.8° | 75.6° | 74.1° |
| 8 | 79.7° | 75.4° | 77.8° | 45.2° |
| 9 | 77.5° | 79.0° | 79.9° | 76.4° |

The global maximum is Highland hole 5: 9.08 rise/run (908% grade), or 83.7°. Rendered sampling reaches 8.69 rise/run (83.4°). Its outer bank height spans 14.39–21.04 m. The fixed water plane is 3.1 m, and the shortest grading distance is 2.88 m.

The reviewed desert images use human hole numbers 2 and 6: Copper Ridge (index1) and Oasis Carry (index5). Their sampled maxima are79.0° and62.3°. These filenames are not zero-based indices.

## Cause and shared consumers

- src/course.js:47: each basin forces its bed to 1.8 m and shoreline to 3.1 m. Its entire bank blends back within 16% of the ellipse radius. A smoothstep has a peak derivative of 1.5, which magnifies steep banks.
- src/course.js:46–48: dry bridge/island handling uses a binary distance mask and a fixed minimum height of 4.3 m. Raised local water must not submerge these dry corridors. Rendered samples near masked dry crossings exceed the analytic dry-bank sample maxima on several holes.
- src/course-layout.js:10–11: waterBasins supplies horizontal ellipses. waterAt and lieAt classify hazards from horizontal footprints and dry masks. Keep this classification coherent with visible water.
- src/water.js:34,42: Reflector planes use fixed y=3.1. Its visual depth estimate uses ellipse distance, not the actual bed. Each basin needs its own shared elevation.
- src/golf-roll.js:5–7: ballSurface samples the bed, while ballHazard uses a fixed 3.3 m threshold. Local pond elevation must enter the shared ball surface result.
- src/golf-guide.js:10: airborne preview uses a separate 3.15 m water threshold. It must use the same shared water contact elevation as live flight.
- src/world.js:137,160: water ambush sites use y=3.1. src/course-themes.js:40,198 instead registers water sites at heightAt, which is the bed. Both require the same surface elevation.
- src/main.js:129–133,207–208: water emergence starts from site.y and lands at ellipse radius 1.22. Wider banks require a dry, modest-slope landing search beyond the graded bank.
- src/world.js:53: ocean elevation is -1.1 m. The current global Water hazard threshold also applies to ocean lies. A new waterSurfaceAt must distinguish ocean from inland basins.
- src/terrain.js: course geometry, normals, water-edge refinement and courseSurfaceHeight must all use the new shared grade. Wider banks can exceed the current ellipse radius 1.35 refinement zone.
- src/course-map.js and building-placement.js use horizontal basin footprints. Land movement, enemy movement, vegetation, and relief use lieAt/heightAt. Preserve footprints and audit dry margins, rather than duplicating new water rules in these consumers.

## Recommended future scope

Add a cached, shared basin profile layer. Preserve the existing horizontal water tuples for map/layout compatibility. Profiles should contain surface elevation, depth, shoreline data and bank grading widths. Derive elevation from uncarved terrain, never from heightAt after basin carving. Extract naturalHeightAt to prevent recursion.

Choose a constant water plane near the lowest uncarved shoreline height, with a small freeboard. A percentile alone can put the plane above low shoreline terrain; either constrain it by the actual low rim or grade an explicit berm. Connected or overlapping water basins must share one plane. Keep the ocean separate.

Use grading width in meters, not a fraction of pond radius. For a 0.5 rise/run target and cubic smoothstep, width must initially be at least 3 times the elevation difference. Terrain slope and overlapping grades require a numerical check after composition. Adapt widths by shore direction and blend them continuously. Preserve fairways, greens, tees, buildings, bridges, and islands. If safe grading space is unavailable, adjust that basin explicitly instead of silently grading a playable corridor.

Prefer local water elevation plus controlled bank grading. Keeping water at 3.1 m would require roughly 54 m of grading for the worst 18 m drop at a 0.5 target grade. That is much more disruptive than raising the pond near its local terrain. Raising water alone is insufficient where the rim varies by 6–10 m.

Add waterSurfaceAt(course,x,z) as the common surface API. Use it in pond rendering, live ball contact/hazards, airborne and rolling previews, and ambush registration. Preserve a dry shoulder above the local water plane on bridges/islands, with a continuous bank transition.

Acceptance should include all-36 bank slopes on analytic and rendered surfaces; unchanged hazard footprints; consistent water/bed/surface values; safe dry bridge/island clearance; ball preview/live contact parity; emergence starts and dry landing slopes; and matched near-shore screenshots for both desert examples.
