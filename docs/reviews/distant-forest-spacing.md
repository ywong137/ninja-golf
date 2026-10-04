# Distant forest spacing study

The previous grid rejected all eight neighboring cells when any tree occupied them.
This gave the Japanese trees a median nearest neighbor of 25.8 metres on flat terrain, despite a 13-metre spacing setting.
The Highland median was 33.3 metres with a 17-metre setting.

The candidate keeps a spatial grid, but checks actual distance within neighboring cells.
It retains the placement limits, playable-boundary clearance, ocean window, slope limits, summit exclusion, and tree species.
Flat-terrain medians become 16.9 and 22.6 metres. Minimum distances remain above 13 and 17 metres.
The existing atlas and shadow meshes remain unchanged.

Muted comparison: 1440 by 900, pixel ratio 1, Balanced, Chrome Metal on Apple M1 Max.
Twelve matched captures cover tee, aerial, and grove views on the first Japanese and Highland holes.
All six candidate views sustain about 60 FPS after shader warmup, with p95 frames at 16.7–16.8 ms.
All matched views use the same draw-call counts. No console or shader errors occurred.
The Japanese first hole has 2,748 distant trees instead of 1,632. Highlands has 429 instead of 291.
These counts use the rendered terrain surface, not the flat fixture.

The groves look fuller, although the wider environment remains visibly below the requested AAA target.
Nearby course trees, textures, lighting, course layouts, and character assets are unchanged.
This study does not establish performance on weaker computers or high-resolution displays.

Files:
- compare.mjs and report.json: matched camera evidence and measurements.
- *-before.png and *-after.png: rendered comparisons.
- spacing.mjs and spacing.json: nearest-neighbor measurements.
- benchmark.mjs and benchmark-*.json: moving combat with 64 enemies and repeated musou.

The initial compare.log records a private routing failure from an unresolved bare module import.
The corrected runner uses the browser's Three.js module path. compare-fixed.log records the successful run.
The accepted source change follows the successful comparison.
The focused regression checks actual nearest distances, plus existing boundary, grounding, and draw-count contracts.

The separate course-lighting-study reduced hemisphere light to 35 percent.
It produced only a small improvement, so it was rejected. Keep the existing lighting.

Moving combat averaged 59.87 FPS before and 58.71 FPS after the change. Both p95 frame times were 16.8 ms.
The test used 64 enemies, repeated musou, and the same nearby grove. These are short local measurements.
