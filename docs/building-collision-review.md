# Building collision and placement

Review date: 2026-09-27.

## Geometry and placement

Large buildings now register world-space collision records during construction.
Boxes use half-width, half-depth, yaw, and vertical bounds. Cylinders use radius and vertical bounds.
The collision index inserts each solid into every occupied 12-metre cell.
The system keeps individual posts, walls, foundations, steps, and overhead surfaces separate.
Gateways, Highland arches, and desert porches retain their openings.

Full compound footprints avoid water, course limits, fairways, greens, rendered paths, walking routes, cover, and neighboring buildings.
The previous desert and city placements included three anchors in water. The revised search rejects those placements.
Foundations reach below the lowest sampled ground. Occupied floors sit above the highest ground sample.
Pagodas prefer flatter approaches. Their stair counts follow the required height, with risers no higher than 0.19 metres.
Desert planters use local terrain heights and remain separate from porch columns.

City clusters alternate course sides. Towers have different heights, widths, setbacks, and smaller companion buildings.
Window grids cover four elevations. Dark roofs use narrow light strips and shallow vents.
Shared material batches limit rendering cost.

## Movement and navigation

Actors sweep their movement against boxes and cylinders, then slide along contacted surfaces.
Movement retains the actual prior safe position when a correction reaches water or the course boundary.
The player uses a 0.38-metre radius. Enemies use a 0.30-metre radius.
Enemy entrance destinations must be dry and outside all solids.

Enemies use visible corner routes when a building blocks their engagement position.
The routes validate terrain and building clearance. Nearby enemies share only routes whose new endpoint links remain clear.
Exact endpoint links, static graph edges, and a bounded set of shared routes reduce repeated searches.
A valid route can follow a moving target without another graph search.
The graph uses the same 0.30-metre radius as actual enemy movement.

The combat camera sweeps its full segment against scenery and architecture.
A final correction also protects interpolated, shaken, and cinematic camera positions.
Melee attacks require a clear line through buildings. Projectiles stop at the first building surface before a player hit.

## Golf

Golf balls bounce off building surfaces. Live play and putting previews use the same response.
Airborne previews mark their first building obstruction; they do not simulate the complete rebound path.
A ball settling on an inaccessible roof returns to the shot origin with one penalty stroke.

A ball beside a building receives a free drop when the structure prevents a clear golf stance.
The search reserves room for every aim direction and rejects positions closer to the cup.
It rejects water, bunkers, greens, and course boundaries.
Live play and putting previews share this rule.
If no valid drop exists within 12 metres, the game returns to the shot origin with one penalty stroke.

## Verification

CPU tests cover rounded corners, rotated boxes, thin walls, outward contact movement, compound bounds, and camera segments.
Placement tests check all 36 layouts against actual rendered paths and authored walking routes.
They also check stairs, planter contact, openings, deterministic reconstruction, and city light coverage.
Navigation checks verify progress around both sides, moving targets, and shared routes for 64 enemies.

The four-theme browser test uses actual input and `Game.updateCombat`.
It checks walking, dodge, enemy pursuit, emergence, camera clearance, ball impacts, projectiles, and course reloads.
The test attaches real actors through the crowd renderer.
It also verifies 64 golf stances after free drops and the one-stroke fallback for an unplayable lie.
Saved views cover each theme at ground level and overhead, plus openings and the pagoda stair approach.

The measured Node stress case uses 64 different source and target pairs around a city compound.
Cold route work fell from 174.1 ms to 30.2 ms. Moving-endpoint work fell from 144.5 ms to 10.2 ms.
These CPU measurements do not establish the game's frame rate. Browser measurements belong in `production-quality.md`.

## Limits

Building interiors, galleries, foundations, and stairs do not supply walkable height surfaces.
Their solids block movement. The open gates, arches, and porches remain traversable at terrain height.
Curved pagoda roofs use a conservative grid of overhead boxes.
Sphere sweeps round horizontal corners, but expand roof edges conservatively.
Forest steering remains local. The building graph is not a general terrain navigation mesh.
The first dense routing burst can still take about 30 ms in the Node stress case.

The visual review confirms grounded objects and readable openings. It does not establish photorealistic architecture.
Close walls still show oversized texture patterns. Building materials and surrounding detail require another artistic pass.
