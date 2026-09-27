# Daylight and foliage

The photographed sun in `coastal-sky.hdr` sits at 47.888 degrees elevation. `src/lighting.js` shares its direction with world lighting, water highlights, and tree shadow baking. The panorama stays level and rotates in azimuth. The rendered sky test measures less than 0.01 pixel between the photographed sun center and the projected directional light.

Daylight fill uses the sky color separately from the warm direct light. Matched views set the fill levels for readable tree crowns, stone, and character faces. The foliage shader adds bounded transmission through green leaves. It reuses the existing shadowed direct light, so an occluder also blocks transmission. It adds no extra texture or shadow lookup.

The turf keeps more of its source color and roughness variation. Close views use stronger photographic normals. Unresolved blades fade to a broad rough response to limit distant shimmer. Texture fetch count and terrain geometry remain unchanged.

Five tree shadow atlases now use the shared sun elevation. Their native models, color atlases, and normal atlases remain unchanged. `tools/bake-tree-shadows.mjs` checks these protected files after a shadow-only bake.

Validation includes rendered sky registration, leaf transmission and occlusion, water direction, twelve matched course views, and fifteen tree-distance views. The native-to-atlas tree transition still changes canopy density at some distances. That separate geometry issue remains open.

```sh
node tests/browser-lighting.mjs
node tools/bake-tree-shadows.mjs --help
node tools/study-lighting-fill.mjs --help
```
