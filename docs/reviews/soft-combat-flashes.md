# Soft combat impact flashes

Large polygonal flashes covered the hero during the Copper Saguaro round. Camera-facing soft flashes replace those solid-looking shapes.

The new flash has a small bright center and a dim halo. Sparks, ribbons, attack timing, and damage remain unchanged.

## Verification

- Compared 12 matched screenshots across four effect ages and three graphics modes.
- Used a seeded arrangement with Ethan in an actual attack pose. This comparison was staged, not a full playthrough.
- All 532 sparks remained in both versions. Effects cleared after combat; no browser or shader errors occurred.
- At 0.06 seconds, both versions used 168 draw calls. Five flashes used 390 fewer triangles.
- Warm render measurements were similar. One comparison measured 3.70/3.77 ms; another measured 4.15/3.83 ms, before/after.
- Moving combat with 64 enemies and repeated musou averaged 59.3 FPS. The 95th-percentile frame took 16.8 ms.
- Performance used an M1 Max at 1440×900, with render ratio 1 and contact shading disabled. This result does not establish performance elsewhere.

Private evidence is in `artifacts/reviews/combat-flash/` in the primary checkout. The comparison script, reports, screenshots, and benchmark remain there.
