# Copper Saguaro rock formations

The desert formations now use two separate eroded boulder scans with varied sizes and smaller companion stones.
The previous layout enlarged one small angular scan into formations up to roughly 45 metres tall.
The new main rocks measure roughly 6–12 metres before burial. They preserve each scan's proportions.
Small authored rocks keep their existing cover and ambush roles.

The source is [Namaqualand Boulders 01](https://polyhaven.com/a/namaqualand_boulders_01), under [CC0](https://polyhaven.com/license).
Greg Zaal supplied the photographs. Jenelle van Heerden modeled the asset.
The source represents Namaqualand geology and serves as a visual desert substitute.
The downloaded source files match the official API's MD5 values.

Each form has a full near mesh and an independent distance mesh.
The near meshes contain 16,058 and 24,792 triangles. The distance meshes contain 3,199 and 3,198 triangles.
All four meshes share one material, a 4096-pixel color map, and 2048-pixel normal and roughness maps.
The compressed download adds 5,932,281 bytes. Only the desert course requests it.
The source manifest and Blender build script record provenance and reconstruction details.

Placement checks the full rotated footprint against golf surfaces, water, paths, bridges, bunkers, and buildings.
Terrain height sets burial. Plants cannot grow through the new formations.
Each form supplies its own solid bounds for player movement and camera collision.
A separate random seed preserves the existing surrounding scenery.
The course card now shows the updated clubhouse, plants, and rocks.

## Verification

The nine-hole browser check covers 1,302 rocks and 63,559 footprint samples.
It also checks 5,203 valid movement approaches. No approach ends inside a rock.
Grounding, plant exclusion, golf clearance, and building clearance pass on all nine holes.
Visual review covers both source forms, ground-level views, and the wide clubhouse view.

Eleven focused unit checks pass, including collision bounds and lossless scenery compression.
The production test renders all four course previews and starts a round.
It also loads Copper Saguaro without browser gzip support, including the new boulder asset.
No browser errors occurred. All automated browsers remained muted.
The final build succeeds with the existing large-bundle warning. Its JavaScript bundle is `index-D_rqSYz_.js`.

A moving 24-enemy fight averages 53.0 FPS at 1440 × 900 with rendering ratio 1.0.
The test uses Chrome Metal on the local Apple M1 Max.
It measures eight seconds after two warmup seconds, without another automated GPU job.
The 95th-percentile frame takes 33.3 ms. The longest measured frame takes 66.7 ms.
The comparable earlier planting test averaged 53.6 FPS.
These short samples do not establish full-round or cross-device performance.

The full game remains local and private, including Ethan's purchased motions.
The approved Ronin and Closer identities and accepted character movement remain unchanged.
The private preview runs at http://127.0.0.1:4185/.
Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/desert-rocks/`.

The broader visual goal remains incomplete. Ground transitions, distant terrain, and repeated environmental forms still need work.
