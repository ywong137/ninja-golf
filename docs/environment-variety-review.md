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

## Camera-following sunlight

The old shadow camera followed the golfer inside a 110-metre square.
Ball flight, survey views, and course previews could leave that square.
Buildings then lost their ground shadows and shadows under their roof edges.

The scene now uses Three.js SunLight with two camera-fitted shadow regions.
They cover visible receivers out to 280 metres and blend at their boundary.
The final region fades out before its far limit.
Each region has a 2048-square shadow map.
Sun direction, sky alignment, exposure, and theme lighting remain unchanged.

Near-tree ground silhouettes now follow each species' geometry transition.
They use the rendered camera's position and height.
This prevents mismatched shadows during flyovers and conifer transitions.
Distant forest silhouettes remain in use.

The GPU regression measures shadows at 20, 90, 200, and 250 metres.
It also checks a 450-metre camera translation and an off-centre portrait projection.
All cases retained a shadow-to-lit luminance ratio near 0.196.
All five tree species passed checks at both transition endpoints and their midpoint.
The lighting audit confirmed unchanged alignment with the photographed sun.
Selection framing passed ten layouts, six complete animation loops, and four courses.

A muted Chrome Metal benchmark used 1440×900 pixels and 64 enemies on Crane Coast.
The same frozen crowd held 60 FPS with both lighting systems.
Moving crowds averaged 56.6 FPS before and 51.5 FPS after the change.
The new lighting's 95th-percentile frame took 33.4 ms; the 99th percentile took 66.5 ms.
These timings include animation and combat updates, with automatic resolution changes disabled.
The extra shadow pass increased draw calls from roughly 875 to 1,320.
These are local measurements, not a guarantee for other hardware or courses.
The change fixes missing shadows but does not eliminate combat frame-time spikes.

The same review found a broad reflection washing out the Japanese roofs.
Their ceramic material now uses zero metalness and a roughness of 0.86.
Matched course, close, and reverse views retain the dark tile color.
This finish adjustment adds no geometry, textures, passes, or draw calls.

## Animated crowd visibility

Enemy bodies previously bypassed camera and shadow visibility checks.
Off-screen enemies therefore added work to the main view and both shadow regions.
The crowd renderer now updates each body's bounds from its current skeleton before visibility checks.
Preparation scans each shared mesh once; frame updates only transform boxes around the bones.
The boxes include blended skin weights, whole-body movement, and death rotations and scaling.
Hero deformation and weapon rendering retain their existing behavior.

The unit checks covered every vertex in all 15 native clips for each of the three enemy models.
Six samples per clip checked about 1.27 million posed vertices.
Additional fixtures covered detached binding, nonuniform scale, shear, and large world positions.
The GPU comparison covered 18 pose/view combinations with 48 enemies.
It found zero changed pixels, including shadows, and saved 582 draw calls across those frames.
Removing the crowd restored the original mesh methods and visibility settings.

A muted Chrome Metal comparison used 64 moving enemies at 1440×900 pixels on Crane Coast.
Each variant measured a complete camera orbit after a ten-second warmup.
Automatic resolution changes were disabled.
Average FPS increased from 51.7 to 53.5.
The final sampled frame decreased from 1,283 draw calls to 1,142.
Both variants had 33.3 ms and 50 ms frame times at the 95th and 99th percentiles.
The improvement is modest; animation, foliage, and combat still contribute to frame-time spikes.
These local timings do not establish performance on other hardware or courses.
