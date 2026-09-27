# Architecture material review

Review date: 2026-09-27. This is a plan for the next pass. It changes no production files and uses no browser or GPU job.

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
