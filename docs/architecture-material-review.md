# Architecture material review

Review date: 2026-09-27. The original review and implementation plan follow the verified changes below.

## Implemented changes

Architectural box UVs now use physical face dimensions before merging. The 1.25m stone repeat is consistent across large walls and small blocks.
Shared texture repeat and wrapping remain unchanged. Finished stone uses weaker normal detail.
Wood and plaster use subtle nonperiodic finish variation.

Desert walls now use pale plaster, service doors, side windows, coping, and shallow divisions.
Highland masonry covers front, rear, inner, outer, and lower foundation faces.
City facades have floor bands, mullions, framed shopfronts, paired doors, and handles.

The 90 entrance courts reuse the course path material. Forty-one dry pedestrian spurs connect to existing paths where the full width fits.
The placement checks exclude fairways, tees, greens, bunkers, water, cover objects, and building obstacles.
Courts extend under opaque foundations and stairs to avoid grass gaps.
Grass and vegetation use the expanded path exclusion map.

City entrance stairs connect the court height to the door threshold. Slender handrails merge into the existing facade metal batch.
The stairs add one stone material batch. They retain solid collision and do not create walkable building interiors.
Each stair flight contributes one navigation outline. Route validation still checks every individual solid.

All geometry and placement work runs when a course loads. This pass adds no texture downloads or render targets.

## Matched visual review

Saved comparisons use the same camera, time, hero position, and viewport for all four themes.
The original revision is `46d3df2502a353e17eff5cfa7dc625376a648aec`.
The capture script also checks shared texture settings, hero visibility, shader errors, and material counts.

The final images show readable wall divisions, ground-level entrances, and paths connecting city compounds.
Review found unfinished Highland foundations and a grass gap below the Japanese stairs. Both received corrections before acceptance. A final desert review also found a coping strip crossing a service door. The strip now stops beside the frame.
The buildings still use simplified geometry. Repeated tower forms, window lighting, and close wall finishes need further artistic work.
This pass does not establish photorealism.

## Geometry measurements

All nine city holes remain below the 20,000 additional triangle limit, including facades, courts, spurs, stairs, and rails.
The range is 18,020–18,960 additional triangles. The Hologram Orchard has the largest increase.
Each city hole adds one material batch. The reviewed theme-and-path total changes from eight to nine.

Matched first-hole facade captures record these changes. Courts and stairs are separate from these facade counts.

| Theme | Additional facade triangles | Material batch change |
| --- | ---: | ---: |
| Japanese | 0 | 0 |
| Highland | 20,664 | -1 |
| Desert | 1,140 | +1 |
| City, including merged rails | 12,424 | 0 |

Highland geometry increases because masonry now covers the full exposed foundations. It remains in one material batch.
The original 20,000 limit applies to city geometry. Runtime measurements also cover the Highland change.

## Evidence

The review inspected `architecture.js`, `course-themes.js`, `building-placement.js`, the texture cache, and local source manifests. It also inspected these saved captures:

- `/tmp/ninja-buildings-2-travel.png`: the desert side wall has large, stretched boulder features and no architectural divisions.
- `/tmp/ninja-buildings-3-travel.png`: shopfront windows look like opaque colored rectangles attached to a blank wall. They lack frames, recesses, doors, and entrance context.
- `/tmp/ninja-buildings-1-opening.png`: small masonry blocks and large tower faces show different texture scales. Large foundation and inner-wall surfaces resemble single enlarged rocks.

The corrected stairs, grounded planters, and restrained roof lighting should remain unchanged. These are separate material and composition problems.

## Root causes

Both builders start with unit-box geometry. They scale vertex positions during merging, but leave each face's UV range at zero to one. One texture therefore covers both a small block and a 24m wall. Its horizontal and vertical scale also changes independently on rectangular faces.

`World.texture` enables repeat wrapping but retains the default repeat values. Multiple systems share each cached texture. Changing its repeat globally would alter terrain, garden props, and other buildings.

The theme builder uses one rock material for desert walls, foundations, planters, trim, and roof surfaces. Its brown color multiplies a boulder photograph. This produces dark orange cliffs rather than plaster or dressed masonry.

Cyber windows already cover all four elevations and follow the tower setbacks. The remaining problem is construction detail. Windows are shallow colored boxes without convincing frames, reveals, or floor divisions at close range. Ground-level glazing also lacks recognizable entrances.

City clusters now occupy both course sides, but each cluster chooses its site independently. Buildings do not face a shared street or connect to a local pedestrian court. Grass reaches most walls, and separate clusters read as isolated props.

## Existing assets to reuse

| Files or source | Verified local provenance | Proposed role |
| --- | --- | --- |
| `rock-color-2k.jpg`, `rock-normal-2k.jpg` | `public/textures/SOURCES.json`: Poly Haven `rock_boulder_dry`, CC0 | Dressed stone and foundation detail at a consistent meter scale. Reduce normal strength on finished stone. |
| `path-color-2k.jpg`, `path-normal-2k.jpg`, `path-roughness-2k.jpg` | `public/textures/GOLF-SURFACES.json`: Poly Haven `gravel_floor_04`, CC0; source width 2.5m | Small service courts and paths. Do not present this aggregate as polished concrete. |
| `bark-color.jpg`, `bark-normal.jpg` | `public/textures/SOURCES.json`: Poly Haven `japanese_cedar_bark`, CC0 | Retain for rough timber where appropriate. Bark is unsuitable for finished joinery or metal frames. |
| Existing procedural wood/plaster/roof materials | Authored in `architecture.js` | Reuse their bounded surface variation for finished plaster and trim. |
| Existing glass, dark metal, and muted emissive materials | Authored in `course-themes.js` | Window frames, mullions, spandrels, doors, and restrained signage. |

No new download is necessary. The first pass should not reuse landscape cliffs or grass photographs as wall finishes. Source manifests do not establish a physical size for the boulder texture; proposed architectural scales are art settings.

## Recommended bounded implementation

### 1. Give architectural surfaces a consistent scale

Add a shared box-UV helper for textured architectural primitives. Calculate UVs from the scaled local face dimensions before world translation and merging. Preserve each face's orientation and normal-map handedness. Keep the geometry and collision bounds unchanged.

Use an initial 1.25m stone repeat. Use separate settings for stone blocks, foundations, and rough decorative rock when necessary. Start finished stone normal strength around .15–.25. Check the result beside the player at a 2–5m camera distance.

Do not change shared texture repeat or wrapping. Do not add per-frame UV work. Cylinder columns can use circumference-based horizontal UVs and height-based vertical UVs when they need texture detail.

Keep the Japanese roof's existing meter-based UV treatment. Its roof generator already scales UVs by physical width and depth.

### 2. Separate material roles and finish visible elevations

For the desert resort, use pale warm plaster on the main walls. Keep textured stone on foundations, planters, and selected trim. Use only subtle surface variation on plaster; strong boulder normals would recreate the same problem at a smaller scale.

Add shallow wall panels or pilasters to blank side elevations. Include a service door, sill line, parapet coping, and modest joints. Keep additions within existing collision envelopes where possible. Do not turn every wall into a dense grid.

For Highland ruins, use the same stone scale across tower bodies, arch stones, and foundation faces. Carry masonry divisions onto visible side and inner faces. Use small color variation within the same material batch rather than isolated flat-colored replacement blocks.

For cyber facades, add narrow mullions, sills, and dark reveals around the existing glazing. Add opaque floor bands between rows. Keep most windows dark or reflective, with a minority of softly lit rooms. Do not enlarge glowing roof surfaces.

Give each cyber podium one readable entrance with paired doors, a frame, and a small canopy. Reuse existing materials. Ground-level details should establish human scale without changing the approved tower silhouettes.

### 3. Connect each city cluster locally

Add a small paved entrance court inside each validated compound. Align its entrance with a reachable compound edge. Use a restrained curb, a few paving joints, and existing planter forms to organize that space.

Where a short dry connection to an existing path is available, add a pedestrian spur. Validate its entire width against fairways, greens, bunkers, water, and obstacles. If no safe short connection exists, keep the court local rather than crossing the playable hole.

Preserve the current safe building sites and both-sided skyline. A shared road network or large-scale city relocation would exceed this pass. Local entrances and courts should first make the current clusters read as occupied places.

## Performance and lifecycle limits

- Reuse existing texture objects. Add no new texture downloads or render targets.
- Keep all static architectural details merged by material. Allow at most one additional material batch per theme.
- Add no more than 20,000 triangles to the densest cyber hole.
- Add no per-frame material, UV, geometry, or placement updates.
- Keep existing building collision records unchanged unless a new visible solid extends beyond them.
- Keep the all 36 placement checks and shared texture disposal rules intact.

These are acceptance limits, not permission to consume the entire budget. Prefer fewer details at upper-floor distances.

## Verification

CPU checks should verify equal UV density on differently sized boxes, correct UV orientation, and finite UVs after merging. Confirm that texture objects retain their original repeat values. Check new geometry bounds against the existing building compounds.

Inspect matched ground-level captures of a desert blank wall, Highland inner arch wall, cyber shopfront, and Japanese foundation. Include the player for scale. Compare the same camera before and after changes.

Inspect a wider cyber travel view showing the entrance court, its building, and the golf path. A close facade screenshot alone cannot establish connected composition. Also inspect an aerial view for repeated court shapes or accidental glowing plates.

Run the existing movement/camera tests after facade changes. Run the dense cyber crowd benchmark with the same camera and scene state. Report added triangles, material draws, and median frame time against the current baseline. Accept the pass only when visual review and those checks agree.

## Verification results

All 153 unit tests pass. The full production build succeeds.
Ten relevant browser scripts pass: architecture, buildings, expansion, scenery rocks, nature, production views, navigation, combat, putting previews, and smoke.
The expansion check completes all 36 cups. Building checks use actual player movement, enemy pursuit, cameras, and golf updates.

Two building fixtures previously started inside the new stairs. They now select dry, exposed ground around the actual solids.
Camera shortening, collision clearance, pursuit distance, and detour assertions remain unchanged.

The final visual review uses `/tmp/ninja-architecture-before/` and `/tmp/ninja-architecture-after/`.
The additional `0-entrance.png` view shows the Japanese stair-to-court junction without a foreground tree.
Runtime checks found no shader errors or changes to shared texture repeat settings.
Development and verification browsers remain muted.


### Architecture-pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run keeps 64 enemies alive and repeats attacks for ten seconds after warmup.
No other rendering or capture jobs ran during these measurements.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.6 | 16.8 ms |
| Heather & Crown | 1.00 | 59.6 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.0 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 51.5 | 33.4 ms |
| City building detours | 1.00 | 59.9 | 16.8 ms |

The city routing scenario starts all 64 enemies across a solid podium from the hero.
Its largest combat update took 31.2 ms. The run recorded 90 route requests, including setup and warmup.
Dynamic shadows remain active. Balanced mode suspends contact shading at this crowd size.
The earlier architecture baseline measured 59.7–60.1 FPS at desktop resolution and 52.8 FPS for Retina.
These single-run comparisons cannot isolate normal timing variation.
The measurements describe this machine and these scenarios, not every device or camera position.
