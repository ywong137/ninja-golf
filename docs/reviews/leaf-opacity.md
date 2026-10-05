# Scanned foliage opacity repair

Four plant assets embedded JPEG leaf textures without the source opacity masks.
Ferns appeared as solid sheets. Shrubs showed black triangles around their leaves.
The repair restores the original Poly Haven masks in RGBA textures.

The affected assets are understory, fern, woody-scrub, and forest-canopy.
Geometry, UVs, placement, draw groups, and collision data remain unchanged.
Binary comparisons confirm identical geometry buffers for all four models.
The broadleaf color, normal, and shadow atlases now use the repaired model.
Atlas bounds and metadata remain identical.

## Reproduction

The source masks and their download hashes are in `tools/nature-opacity/`.
The source manifest links each CC0 asset to its Poly Haven page.
Run the repair after exporting or compressing these models:

```sh
python3 tools/restore-nature-opacity.py public/models/nature/understory.glb tools/nature-opacity/shrub_01_alpha_2k.png public/models/nature/understory.glb
python3 tools/restore-nature-opacity.py public/models/nature/fern.glb tools/nature-opacity/fern_02_alpha_2k.png public/models/nature/fern.glb
python3 tools/restore-nature-opacity.py public/models/nature/woody-scrub.glb tools/nature-opacity/searsia_burchellii_alpha_2k.png public/models/nature/woody-scrub.glb
python3 tools/restore-nature-opacity.py public/models/nature/forest-canopy.glb tools/nature-opacity/island_tree_01_leaves_alpha_2k.png public/models/nature/forest-canopy.glb
GAME_URL=http://localhost:5173 node tools/bake-nature-impostors.mjs forest-canopy
```

The tool uses Python and Pillow. It changes only the embedded color images.
The asset tests reject JPEG textures and missing alpha channels for these plants.
Browser checks inspect decoded opacity and compare near and distant views.

## Limits

This repair does not restore leaf geometry lost during earlier mesh reduction.
The proposed extra shrub beds remain excluded; their distant appearance was too sparse.
No new plant instances or gameplay obstacles accompany this repair.

## Validation

Eighteen focused tests passed. The production build succeeded.
Browser checks passed for five decoded opacity textures and all four course themes.
The checks also cover near, middle, distant, and aerial tree views.
All browser runs used muted audio.

The fixed-resolution candidate measured 51.4 FPS with 64 enemies in a dense grove.
The machine used Chrome Metal on M1 Max at 1440 × 900, with rendering ratio 1.
The baseline measured 37.1 FPS. Both runs had a 33.4 ms p95 frame time.
Timing varied between runs; these results do not establish a reliable speed improvement.
Adaptive-resolution trials used different scales, so they cannot measure the relative cost.

The four GLBs add about 2.90 MB of lossless opacity data.
The regenerated atlases save about 40 KB. Instance and triangle budgets remain unchanged.
