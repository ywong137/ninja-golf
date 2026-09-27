# Mountain surface and normals

The horizon now shares corner vertices between its rectangular strips.
It computes area-weighted normals from the rendered triangles.
The inner course boundary retains the detailed course's existing height and normal convention.
This keeps the join continuous without using sub-metre derivatives across distant triangles tens of metres wide.

A single refinement pass measures interpolation error against the existing regional elevation data.
It inserts shared edge midpoints where the terrain bends most strongly.
Both faces split when they share a selected edge, so the mesh has no internal cracks.
The pass caps the total at 198,000 triangles and leaves the playable height field unchanged.
`landscapeHorizon(course,region,{refine:false})` exposes the original coarse spacing for numerical and visual comparisons.

A deterministic comparison sampled 30,000 identical positions across an 11-kilometre square:

| Region | RMS before / after | 95th percentile before / after | Maximum before / after |
| --- | --- | --- | --- |
| Japan | 1.86 / 0.87 m | 4.13 / 1.87 m | 23.39 / 10.89 m |
| Highlands | 1.06 / 0.41 m | 1.83 / 0.71 m | 18.99 / 8.26 m |
| Desert | 3.42 / 1.48 m | 7.02 / 3.02 m | 47.42 / 28.95 m |

These values compare rendered triangle heights with the adapted DEM, not surveyed ground truth.
Sharp ridges still exceed the average error because the mesh has a fixed triangle budget.
Typical local CPU construction increased from 85–105 ms to 317–343 ms per course.
There is no new work each frame.

`tests/landscape-horizon.test.js` checks real datasets, error reduction, the triangle cap, shared topology, normals, and course joins.
`tests/browser-ridges.mjs` captures identical cameras and materials with the old and corrected geometry.
The before geometry restores the original small-derivative normals, so the comparison includes the complete geometry correction.

## Surface shading

The mountain material retains RGB detail from the existing CC0 rock and grass photographs.
It projects rock onto three axes, so steep faces do not stretch a top-down image.
Stochastic tile offsets break repeated patterns. The normal maps use the same offsets and axes.
Slope and broad weathering patterns select meadow, exposed stone, and desert talus.
Desert sediment bands follow elevation, with irregular breaks across the faces.
Normal detail fades with distance to limit shimmering.

The shader skips golf-specific surface calculations beyond the course transition.
The playable course keeps its existing turf, bunker, and lie boundaries.
The fictional city retains its existing outskirts material.
The texture sources remain `rock_boulder_dry` and `aerial_grass_rock` from Poly Haven.
`public/textures/SOURCES.json` records the source assets and licenses.
