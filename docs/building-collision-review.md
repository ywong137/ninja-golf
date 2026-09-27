# Building collision plan

Review date: 2026-09-27. This pass inspected source and ran CPU placement queries. It changed no production code or rendered assets.

## Current behavior

`World.build` constructs architecture before `SceneryCollision`. However, the collision constructor receives only `ambushSites`. It accepts trees, lanterns, small pagodas, and rocks. Large buildings register `root.userData.landmarks` for vegetation exclusion, without collision records.

`SceneryCollision` models each site as a vertical cylinder. Its 12m spatial buckets store a cylinder only at its center. Movement queries nine nearby buckets. That approach cannot safely index buildings wider than a bucket. Camera queries also inspect only buckets around the player, rather than the full camera segment.

Player movement, dodge, attack lunges, enemy movement, and enemy knockback ultimately call `slideOnLand`. Player radius is .38m; enemy radius is .3m. Enemy emergence skips that call until its animation ends. Spawn landing checks reject water and out-of-bounds terrain, but do not reject buildings.

`slideOnLand` saves the already-moved position before collision correction. If correction reaches water, it restores that position. This can restore an intersecting position beside a waterfront building. A building implementation must retain the pre-movement position instead.

The combat camera clips through the existing cylinder system. Golf, flight, survey, and cinematic cameras do not use that correction. Golf balls and projectiles currently do not collide with buildings. Keep those systems outside this bounded movement/camera pass, but record the limitation.

## Coordinate contract

All course distances use meters. X and Z define the ground plane; Y points upward. Source builders apply transforms before merging meshes. The course root currently has an identity transform.

`architecture.js` creates world-positioned primitives. It only rotates selected beams around Z. `course-themes.js` also emits world-positioned geometry. Its major building bodies currently have zero yaw. Garden lantern groups can rotate, but they already use separate small-site collisions.

Register collision records during construction, before geometry merging. Do not recover per-building bounds from merged material meshes: each mesh contains multiple structures.

Use a separate `buildingObstacles` collection. Proposed box fields are `{id, kind:'box', x, z, halfWidth, halfDepth, yaw, minY, maxY}`. Use explicit cylinder records for round columns. Keep combat hiding sites independent.

For yaw angle `a`, convert a world offset `(dx,dz)` into box-local coordinates:

- `localX = cos(a)*dx - sin(a)*dz`
- `localZ = sin(a)*dx + cos(a)*dz`

Convert a local correction back with `worldX = cos(a)*localX + sin(a)*localZ` and `worldZ = -sin(a)*localX + cos(a)*localZ`. These signs match Three.js Y rotation. Current bodies use yaw zero; test rotation support with a synthetic rotated obstacle.

## Theme structures and exact source bounds

| Theme | Placement | Ground-level solid geometry | Open or overhead geometry |
| --- | --- | --- | --- |
| Japanese | Gate anchor `(-13,-8)`; pagoda from `pagodaLocation(c)` | Gate sockets at X=-17 and -9, Z=-8, radius about .562m. Pagoda foundation: center `(px,pz)`, half-width10m, half-depth7.5m, Y=`py..py+1.2`. | Keep the gate opening clear. Gate beams start above6m. Pagoda roofs overhang the body; landmark bounds are vegetation margins, not solid walls. |
| Highlands | Two route stations, then X offset−75m and further−12m steps until fairway clearance≥28m | Two tower bodies at `(x±8,z)`, half-width2m, half-depth3m, Y=`y..y+10`. Low rear wall runs approximately X=`x−13.75..x+11.95`, Z=`z+10.45..z+11.55`, top Y=`y+1.35`. | Preserve the central passage. The central lintel occupies X=`x±7`, Z=`z±2`, Y=`y+6..y+9`. Arch stones sit overhead. Do not block the entire15×14m landmark half-extents. |
| Desert | Two stations using the same offset search | Main body: half-width12m, half-depth7m, Y=`y..y+6`. Two porch columns at `(x±10,z−10)`, radius.45m, Y=`y..y+5`. Planters at `(x±10,z−13)`, half-width1.5m, half-depth1m, height.9m. | Porch roof: X=`x±12`, Z=`z−13..z−7`, Y=`y+4.9..y+5.3`. Preserve the open space below it. Upper body center `(x+4,z+2)`, dimensions12×3×8m, bottom Y=`y+6.2`. |
| Cyberpunk | Five stations using the same offset search | Tower: half-width7.5m, half-depth8.5m, Y=`y..y+44+6*k`. Front podium: half-width10m, center Z=`z−10`, half-depth3m, Y=`y..y+4`. | Signage, rings, and antennae should not enlarge the ground collision footprint. Windows currently cover only two faces. Roof details need separate camera bounds only if reachable. |

Japanese pagoda steps are five boxes. Their centers are `(px, pz−9+.42*i)`, half-width4m, half-depth1.2m. Their tops are `py+.2+.2*i`. The combined footprint extends to `pz−10.2`. Current actors follow terrain height, so they cannot stand on rendered steps or galleries. Decide explicitly whether the first pass blocks this foundation or adds step support. Do not silently claim traversable stairs.

## Placement prerequisite

Japanese pagoda placement checks its full13×12m half-extents against fairways, the cup, water, and course bounds. Existing tests sample that footprint. Theme placement checks only the anchor's fairway distance. It does not validate the full footprint or water.

The CPU query found these current anchors in water:

| Course hole | Theme | Anchor X | Anchor Z |
| --- | --- | ---: | ---: |
| Oasis Carry | Desert | -44.10 | 120.14 |
| The Quantum Teacup | Cyberpunk | -60.78 | 129.68 |
| Moon Rabbit Circuit | Cyberpunk | -63.87 | 243.90 |

The query found18 Highland,18 desert, and45 cyber building anchors. No anchor was outside course bounds. Whole-footprint checks remain necessary; anchor clearance alone does not establish safe placement.

Before enabling building collision, validate each compound footprint against water, course limits, fairways, walking bridges, and authored walking routes. Search alternative offsets when validation fails. Preserve openings and open porches. Avoid moving the original holes or hazards to accommodate buildings.

## Bounded implementation sequence

1. Add construction-time obstacle records in architecture and theme builders. Clear them during `World.clear`. Verify compound bounds against known primitive dimensions.
2. Extend `SceneryCollision` with box support and full-footprint bucket insertion. Deduplicate obstacles returned from multiple buckets. Preserve existing cylinder behavior.
3. Resolve a moving circle against box faces and rounded corners. Handle starting inside a box with the nearest valid exit. Use swept movement or bounded substeps for thin walls and fast dodges.
4. Pass pre-movement positions through `slideOnLand`. Reject water or out-of-bounds corrections without restoring an intersecting candidate. Check enemy emergence destinations against building solids.
5. Sweep the camera segment against expanded box bounds, with vertical intervals. Query every crossed bucket. Keep gateways and porches open below their beams.
6. Verify all36 walking routes remain connected and dry after placement changes. Then inspect actual travel, dodge, enemy pursuit, and camera orbit around each structure type.

Enemy steering currently aims directly toward engagement targets. Collision alone can leave enemies pressing against a building. For this pass, add a small deterministic corner detour when a building blocks that target. Verify eventual progress around both sides. Avoid adding a general navigation mesh unless these tests show a need.

## Verification and acceptance

CPU tests should check approach from every box face, diagonal corner sliding, exact-center recovery, rotated boxes, and crossing a thin wall in one frame. Include player/enemy radii and the maximum dodge/lunge displacement. Preserve existing rock and tree collision tests.

Camera tests should cover a wall crossing, an open doorway, a porch below its roof, and a camera above a low wall. Test obstacles whose centers sit outside the queried bucket. Compare simple intersections with independently specified geometry cases, rather than repeating the implementation equations.

Placement tests should inspect all36 compound footprints. Check sampled authored walking corridors and bridge approaches with an actor-radius margin. Verify spawn landing points outside solids. Verify course reload removes old obstacles.

The browser acceptance pass must show actual actor roots, including crowd attachment. Capture Japanese gate passage and pagoda frontage, Highland arch passage, desert porch, and cyber podium corners. Record movement around each obstacle and camera orbit at travel height. A passing position assertion alone does not prove that the collision matches the visible building.

Keep performance bounded: dozens of compound boxes, footprint-indexed buckets, no per-frame triangle raycasts, and no new rendering draws. Measure the dense cyber case with the normal crowd benchmark before acceptance.
