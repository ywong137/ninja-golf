# Distant forest grounding

Distant forest belts use one additional merged mesh for ground shadows.
The mesh reuses the forest atlas's eight baked silhouettes and their exact bounds.
The atlas projects scanned trunks and crowns along the fixed sun direction `(-100,95,-100)`.
It requires no extra shadow rendering and no updates each frame.

Each silhouette uses a 4-by-4 grid. Its vertices sample the supplied rendered terrain surface.
A small height offset and polygon offset prevent depth flicker.
The fragment shader softens canopy edges with five atlas samples and fades opacity with the scene fog.
Clamped atlas coordinates prevent adjacent silhouette tiles from bleeding into a shadow.

Tree placements, scales, and roots stay unchanged.
Distant-only impostors disable the normal near-LOD fade because these belts have no nearby replacement mesh.
The standard tree material keeps its existing near-LOD fade by default.

The world cleanup disposes the merged shadow geometry and material with the other landscape meshes.
The shared atlas texture remains available for subsequent courses.
`buildDistantForest` returns `{mesh,shadow,records}` when trees exist.

Validation:
- CPU tests check sun orientation, terrain conformance, batching, atlas bounds, and invalid inputs.
- Muted browser captures compare Japanese and Highland aerial and grove views before and after shadows.
- `tests/browser-forest-shadows.mjs` saves these comparisons under `/tmp/ninja-forest-shadows-*`.
