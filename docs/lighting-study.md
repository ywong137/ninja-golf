# Next lighting pass

The shoreline release improves terrain shape and water contact. Its saved environment views still show flat lighting and artificial material response. These observations come from `/tmp/ninja-environment-current/0-preview.png` and `0-edge.png`.

## Light balance

The terrain and tree crowns share a broad olive midtone. The photographic sky suggests stronger directional contrast than the ground shows.

`World.applyTheme` gives the hemisphere sky component the sun's warm color. The scene combines this fill with HDR illumination. Each theme rotates the HDR, while the sun direction remains fixed. The exact directional mismatch needs measurement from the HDR asset.

Keep exposure fixed during comparisons. Test reduced hemisphere fill, a cooler sky component, and sunlight aligned with the HDR's dominant light. Compare lit and shaded terrain, neutral stone, and faces. Shadows must remain readable. Avoid compensating with stronger ambient occlusion.

## Maintained turf

The fairway looks like a smooth green carpet beside photographic rough. `courseMaterial` limits turf roughness to roughly 0.80–0.98. It also reduces the normal strength to 0.15, and 0.045 on greens. Color multipliers strongly alter the source maps.

Calibrate tint, roughness variation, and normal strength together. Keep the existing distance filtering. At grazing angles, turf should show restrained directional sheen and surface structure. Rough, fairway, and green should differ beyond color. Reject wet or plastic results.

## Foliage

Crowns look dark and opaque against the sky. Native and atlas materials both limit environment response. Atlas foliage uses ordinary opaque-surface shading, without a leaf backlighting response.

Test a small backlighting term from the existing sunlight. Match the native and atlas responses, including the transition distances. Brighten backlit leaf edges while retaining darker crown interiors. Reject whole-crown glow and visible brightness changes during LOD transitions.

This is an implementation proposal, not a completed change. Capture matched views, review them visually, and measure performance before accepting the next pass.
