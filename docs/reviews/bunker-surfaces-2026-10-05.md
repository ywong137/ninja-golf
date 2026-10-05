# Bunker surfaces — 2026-10-05

The previous goal turn made progress: commit a056355 saved the approved characters and combat changes. This turn improves the course surfaces.

Fixed-camera inspection found cracked clay in the bunkers. The old `sand_01` scan also supplies dry soil elsewhere, so it remains available.

The bunkers now use Charlotte Baglioni's [Sand 03](https://polyhaven.com/a/sand_03) scan from Poly Haven. Its [CC0 license](https://polyhaven.com/license) permits redistribution.
The two original 2K JPEG files match the publisher's MD5 values. `public/textures/SOURCES.json` records their URLs and SHA256 hashes.

The material uses the scan's two-metre scale. It adds shallow rake grooves, wider rake passes, and a narrow soil face under the turf.
Screen derivatives fade unresolved grooves before they produce subpixel flicker. The shader changes shading, not bunker outlines or ball lies.

The bunker grid now uses quarter-metre cells. This reduces visible facets at the narrow edge and improves the rendered bowl.
The terrain sampler uses the same grid. Its cache test retains an independent reference and checks actual rendered triangles.

Scenery filtering removes generated plants and rocks from bunker interiors and their two-metre margins. It runs after generation to preserve the random sequence.
The filter also removes the corresponding generated ambush sites. Authored rock covers remain visible and retain their existing registered hiding places.

Verification:

- Nine geometry, bunker, and terrain-cache tests pass.
- More than two million queries across all 36 holes match the independent ground reference within floating-point precision.
- Four-theme browser checks find no plants within the protected bunker margin.
- Fixed views show finer sand and smoother edges. Close views show sand grains and rake marks.
- Ground-level rendering measured approximately 60 FPS in each theme at 1440 × 900 and fixed rendering scale 1.
- These are static terrain views. They do not measure combat performance.
- All browser checks remain muted. The production build succeeds.
- The built game loads both sand maps and renders all four course previews without errors.
- Ethan reaches combat through normal shot controls, runs, and executes light and heavy attacks.
- The first test pressed Space before the deferred menu transition finished. Waiting for game mode resolves this test timing error.
- The served JavaScript bundle is `index-20wXOEAS.js`. The local preview remains http://127.0.0.1:4185/.

Evidence: `artifacts/reviews/terrain-detail/` in the primary checkout. The active code remains in the shared-pose-transitions worktree.
The complete build includes purchased Ethan motions and remains local. It must not be pushed to the existing public repository.

The broader AAA-quality objective remains incomplete. This material repair does not resolve the wider environment and character art gap.
