# Tree and scrub variety

The forest uses distinct source tree forms. Uniform scale and rotation retain each form's branch structure.

## Sources and limits

All added sources use [Poly Haven's CC0 license](https://polyhaven.com/license). The license permits modified asset redistribution and commercial use. Verified September 27, 2026.

| Source | Game asset | Use |
| --- | --- | --- |
| [Pine Tree 01](https://polyhaven.com/a/pine_tree_01), Rico Cilliers and Rob Tuytel | `pine-open`, `pine-young` | Separate authored A and B tree forms; sparse, irregular evergreen crowns |
| [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), Rico Cilliers and Rob Tuytel | `fir-layered` | Layered conifer crown with a distinct vertical silhouette |
| [Searsia Burchellii](https://polyhaven.com/a/searsia_burchellii), James Ray Cock and Jenelle van Heerden | `woody-scrub` | Low, branched scrub near Highland rocks and groves |

The conifers combine modeled anatomy with photographed materials. They are not complete tree photogrammetry scans. Native Blender LOD2 contains lower-detail foliage and textured needle cards. The glTF downloads contain only the much larger, modeled-needle LOD0.

Searsia is South African. It supplies a convincing woody scrub shape, but does not represent native Scottish heather or gorse. The game uses it as a visual substitute. A future botanical pass should replace it with licensed local species.

Japanese groves mix two pine forms with the existing broadleaf canopy. Highland groves mix both pines and fir. Highland tree spacing increases, leaving open slopes and more low scrub. Tree selection replaces existing placements. Desert and city tree selection stays unchanged.

Distant belts retain fixed instance matrices, ground sampling, and playable-area clearance. Each theme uses three atlas draws and three merged ground-shadow draws. The previous belt used one of each. Distant tree counts retain their existing caps.

## Reproduction

1. Set `NINJA_BROWSER_UA_FILE` to the verified current browser user-agent JSON file.
2. Run `python3 tools/download-nature.py pine_tree_01 fir_tree_01 searsia_burchellii`.
3. Run background Blender with `--python tools/build-tree-variety.py`.
4. Run `python3 tools/compress-glb-textures.py --max-size 1024 --alpha-size 1024` on the four new GLBs.
5. Start Vite, then run `node tools/bake-nature-impostors.mjs pine-open pine-young fir-layered`.

The download script verifies source MD5 values. It retains source and license links in the manifest. The build preserves authored needle cards and reduces trunk and branch geometry. Embedded maps remain at up to 1024 pixels. The atlas bake appends metadata without changing old atlas files.

Original assets remain available for baseline comparisons. `variety-build.json` records source objects and exported geometry counts. Its byte count precedes texture compression.

The near pine trees contain 228,295–374,624 triangles. Middle-distance pines contain about 130,000 triangles. This is a substantial geometry increase. The fir contains 56,625 near triangles and 43,452 middle-distance triangles. Performance acceptance requires the final frame benchmark.

Branch collapse produced large triangular sheets during the first rendered review. Near trees now retain native branch surfaces. Middle-distance trees keep complete branch components, selected by surface area. The reduction never collapses woody branch junctions.

The fir source stores `UVMap` as a corner vector attribute. The builder converts it to a conventional UV layer before material separation. Pine already supplies a UV layer. Source color attributes are material masks, so the builder removes them rather than multiplying them into game albedo.

| Asset | Near triangles | Middle triangles | Delivered GLB bytes |
| --- | ---: | ---: | ---: |
| pine-open | 374,624 | 129,696 | 21,149,980 |
| pine-young | 228,295 | 129,675 | 15,686,272 |
| fir-layered | 56,625 | 43,452 | 6,588,760 |
| woody-scrub | 7,800 | 2,949 | 2,065,068 |

Each conifer has four material parts per mesh LOD, one atlas draw, and one merged ground-shadow draw. Only active LOD ranges draw. The three new conifer GLBs plus scrub total 45,490,080 bytes before the three atlas sets. The atlases add 3,738,096 bytes, for 49,228,176 delivered bytes. Each atlas set contains color, normal, and sun-shadow views.

The public `forestAtlasSource()` call retains its single-source behavior. Passing a theme returns three sources. `buildDistantForest` retains `mesh` and `shadow` aliases for the first pair, and supplies complete `meshes` and `shadows` arrays. Inspection tools must inspect those arrays to measure all species.


## Crown-density correction

The first aerial review showed sparse young crowns. Pine A native LOD2 contains 345,915 twig triangles; Pine B contains 209,250. An initial reduction to 33,000 near and 4,900 middle triangles lost too much crown density. Those exports were rejected.

Final near models preserve all native foliage triangles and their UVs. Middle models retain complete connected foliage groups in a deterministic shuffled order. They never collapse foliage edges or interpolate across disconnected UV cards. The middle pine foliage budget is 120,000 triangles. The fir retains all 33,753 foliage triangles in both mesh LODs. Far atlases now bake the faithful near crown.

A CPU alpha test also measured texture mip loss. In the pine needle region, coverage at cutoff 0.45 remains about 76.7% at 1024 pixels and 76.3% at 32 pixels. Fir coverage stays near 12% through 64 pixels, then falls to 5.1% at 16 pixels. These are texture-region measurements, not full rendered crown measurements. Far atlases use cutoff 0.25. Fir coverage at small mesh mips remains a potential refinement.

The browser test observes the actual target instance in near, middle, and far groups. It saves matched tree views for all three species. Runtime assertions alone do not establish visual quality.


Conifers use native near geometry through 34–36 metres, followed by complete middle-distance foliage groups. Their atlas transition spans 46–50 metres. The original 108–112 metre transition remains for broadleaf and dry trees. CPU instance selection, color shaders, depth shaders, and atlas shaders use the same species detail settings. The earlier conifer atlas transition keeps subpixel needle strips from producing nearly bare middle-distance crowns.

Final dense-grove measurements on M1 Max reached 59.2 FPS for Crane Coast and 58.6 FPS for Heather & Crown.
The Crane grove reached 51.6 FPS at Retina DPR 2 with a 1.5 rendering ratio.
Each case used 64 enemies, Balanced settings, and a 1440 × 900 viewport.
See [production quality](production-quality.md) for the full measurement limits.

See [leaf opacity repair](reviews/leaf-opacity.md) before rebuilding the scrub asset. Its source opacity mask must survive export.


See [complete broadleaf canopy](reviews/broadleaf-canopy-2026-10-05.md) for the restored source leaves and current broadleaf build procedure.
