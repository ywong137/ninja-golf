# Four original nine-hole courses

All layouts use metres. Each course contains nine holes, par 36, with distinct terrain, plants, buildings, sky, and light.

| Course | Setting | Route examples |
| --- | --- | --- |
| Crane Coast | Japanese coastal gardens | Harbour dogleg, temple fork, lotus islands, fox hairpin, shrine peninsula |
| Heather & Crown | Scottish Highland links | Double fairway, crofter elbow, coastal crescent, burn crossing, ruined-keep horseshoe |
| Copper Saguaro | Sonoran desert resort | Oblique opening shelf, arroyo islands, oasis loop, ridge steps, terrace fan |
| Neo-Tokyo After Dark | Fictional future city | Circuit board, quantum orbit, figure eight, pocket spiral, constellation, final trident |

All 36 layouts now have authored route geometry. The first three Crane Coast holes retain their names, but their layouts changed.
Each hole has a strategy description, specific hazards, and elevation parameters.
The designs include disconnected landing areas, alternate branches, backward turns, narrow approaches, and greens surrounded by water.
A hole's walking route can differ from its shortest shot route. Players can cut corners or carry water at their own risk.
Displayed course and hole yardages follow the planned route. Distance to the pin remains a direct measurement.

## References and design choices

I read these official pages with `agent-browser` on 26 September 2026.
The layouts are original. They do not reproduce a real hole or its dimensions.

- [Kawana Hotel golf](https://www.princehotels.com/kawana/facilities/kawanagolf/) describes two courses beside the shore, with ocean and mountain views. Crane Coast uses that coastal setting.
- [Royal Dornoch](https://royaldornoch.com/) describes tiered linksland beside the firth, a beach, and gorse-covered slopes. Heather & Crown uses open ground, gorse, and a cool coastal horizon.
- [We-Ko-Pa Saguaro](https://wekopa.com/saguaro-course/) describes wide desert corridors, natural elevation changes, and a course designed for walking. Copper Saguaro uses these broad design ideas.

Stone ruins, temple gardens, resort buildings, and all Neo-Tokyo scenery are artistic additions.
Neo-Tokyo keeps normal golf physics. Its unusual routes, islands, and neon skyline change the setting.

## Shared geometry and playable ground

`course-layout-data.js` defines separate fairway paths, walking routes, water envelopes, dry islands, and bridges.
`course-layout.js` builds smooth centerlines around the authored landing areas. Short, broad elbow connectors spread their centers within those areas to prevent folded inner banks. Every original landing anchor retains at least 60% of its original clear radius. Broad width changes form landing lobes and narrower approaches. Two-point routes bend gently, and isolated pads have asymmetric outlines. The curves bake into 12–40 shared segments per hole, with a width at each end. Separate paths and walking bridges retain their original connectivity.
`fairwayDistance` and the terrain shader evaluate the same segment data. The old sine centre line no longer defines playable fairways.
`routePoint` and `routeNearest` support scenery placement along the walking route.

Water hazards use a union of up to four organic basins. Each shoreline has unequal coves and broad shoulders within its authored envelope.
`shoreline.js` supplies the same contours to hazard detection, bank grading, water meshes, shaders, maps, and emergence placement.
Dry islands have asymmetric shores that retain their original dry interiors. Islands and bridge corridors remove water from the basin union.
`waterAt`, `heightAt`, and the water shader share those masks. The ocean retains its existing curved coast. Inland courses disable the coastal ocean hazard and slope.
The bridge masks raise dry ground above the water surface. Walking does not require a jump.
Each hole uses at most four bunkers, which matches the terrain shader limit.

Both UI maps use `mapOutlines` and `waterBasins`. Their water layer removes the union of dry islands and bridges.
The full map includes every route branch and walking detour within its bounds.
Map outlines approximate the shared segment ends with small polygons. The terrain and lie queries evaluate the same tapered segments analytically.

Every hole has a dry tee, a dry green, and a connected dry walking route to the cup.
Small props supply ambush positions near the route. Pagoda placement checks its full footprint against fairways, water, bounds, and greens.

## Rendering and checks

Repeated plant components use instanced meshes. Static buildings merge by material.
Daytime courses use the photographic sky. The city uses modeled districts and an atmospheric night sky. Its photographic panorama supplies lighting and reflections.
Terrain shares scanned ground textures. Theme scenery and landscape assets have their own credits in the project.
Each water basin has a reflection target. Rebuilding a course releases all basin targets.

`tests/course-sets.test.js` checks all 36 layouts, dry endpoints, hazard centres, walking routes, shader capacities, and water disposal.
`tests/course-map.test.js` checks map bounds and pagoda footprint clearance across all 36 holes.
`tests/fairway-curves.test.js` checks real centerline curvature, preserved landing anchors, asymmetric pads, and map/lie agreement across all 36 holes. It also checks that the broad Highland elbow has no folded inner bank.
`tests/course.test.js` checks course queries and shot calculations.
These CPU checks do not establish a hardware frame rate. Browser checks must measure the complete game.

`tools/capture-course-previews.mjs` frames all route geometry when it captures the four selection images.
It mutes browser audio. Run it only when the shared GPU is available.

Foreground rock cover uses the existing CC0 scans listed in `public/models/nature/SOURCES.json`. Highland and Japanese gardens use `coastal-rock`; desert cover uses `desert-rock`. Ruin rubble uses smaller instances of the same scans.

Call `queueSceneryRock(root, {x, z, y, height, radius, angle, source, burial})` before constructing `NaturalLandscape`. The `y` value is the ground height. The `height` value specifies exposed height, and `radius` bounds the horizontal footprint. Burial defaults to 12%. Fitting preserves the scan's horizontal proportions and centers its rotation using the bounds of both LODs. NaturalLandscape consumes the queue once and includes these rocks in its existing source batches. It clones course geometry and materials but retains shared source textures. Cover sites remain separate records, so decoration does not add unplanned collision or combat sites.

`tests/scenery-rocks.test.js` checks both GLB source bounds, rotated footprints, exposed heights, burial, theme cover visibility, and queue limits.

The desert opener now uses a detached diagonal landing shelf instead of a split fairway loop. Its wider short landing leaves a longer approach. The narrow advanced landing requires a carry over sand. See [the layout identity audit](layout-identity-audit.md) for all 36 strategies and the remaining repeated families.

`tests/shoreline.test.js` checks all 38 basin outlines, dry islands, map agreement, rendered rims, and deep basin floors.
`tests/browser-water.mjs` compares GPU water masks against CPU hazards across all 36 holes, then checks live penalties and water emergence.
