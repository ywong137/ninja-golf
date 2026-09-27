# Environment variety review

This pass changes ground sampling, tree anatomy, and the distant city.
It preserves golf boundaries, ground heights, playable routes, and building collision.

## Ground

Rough grass now samples rotated texture patches with matching normal directions.
The blend preserves texture contrast where patches overlap.
Fine texture contrast fades into its average when the screen cannot resolve it.
This suppresses patterned aerial grain while retaining close grass detail.
Texture gradients are calculated before the distant terrain branch.
This keeps sampling stable at the transition to the regional landscape.

Desert ground uses the sand texture and its normal map.
Dry grass forms an irregular fringe outside the fairway.
The fairway and first-cut boundaries still use the golf simulation's analytic shapes.

## Trees

Japanese groves mix two authored pine forms with the existing broadleaf tree.
Highland groves use both pines, layered firs, and low woody scrub.
Tree placement spacing leaves more open Highland slopes.
Distant groves use the same species choices and matching terrain shadows.

Source details and conversion limits appear in [nature-variety.md](nature-variety.md).
The added conifers use authored geometry and photographed materials under Poly Haven's CC0 license.
They are not complete photogrammetry scans.

The first conversion produced large triangular branch artifacts.
The final conversion preserves complete branches instead of collapsing their junctions.
Fir UV attributes also needed explicit conversion into an exported UV layer.
Close views must check these defects after any future asset rebuild.

## City

The city now has three distant building bands with five building forms.
Facades use scaled window grids, floor bands, dark glazing, and sparse lit rooms.
Haze separates the distant buildings from the playable course.
The photographic panorama supplies lighting and reflections but no longer supplies visible buildings.

The districts sit outside the playable boundary and add no collision objects.
They use two static rendering batches and approximately 11,600 triangles.
They require no additional image downloads or per-frame geometry generation.

## Review procedure

`tests/browser-environment.mjs` captures four aerial views, four turf edges, and four city bearings.
The turf-edge views include the hero to check scale and visibility.
Captures use fixed cameras, a fixed random seed, a fixed time, and muted audio.

Use `--baseline` once to preserve revision `a45b624` and its camera manifest.
Use `--after` to compare the current scene with those exact cameras.
The default mode captures the current scene without requiring a temporary baseline.

Shader checks and geometry checks cannot establish artistic quality.
Inspect the resulting images before accepting a release.

## Final visual findings

The accepted ground shader retains broad photographed growth variation after filtering fine blade contrast.
The earlier filter removed too much color variation and made aerial rough look flat.
The final matched views retain broad patches without the previous regular diagonal bands.

The full pine crowns replace the rejected sparse conversions.
Conifers change to faithful multi-view images at 46–50 metres.
Native foliage remains intact at close range.
A shader-cache correction keeps each species' vertical center independent.

The four city bearings now have consistent building scale and no photographic horizon seam.
City towers and decorative lights still have simplified geometry and materials.
Highland scrub remains a documented botanical substitute.
Close conifer needles can lose coverage as they become smaller than a pixel.
These changes improve the environment, but do not establish AAA or photorealistic quality.
