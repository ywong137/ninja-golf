# Copper Saguaro planting — October 5, 2026

## Change

Copper Saguaro now uses three original saguaro forms instead of the African quiver tree scan.
The forms have fluted columns, curved arms, rounded crowns, and separate near and distant geometry.
They cast shadows and retain trunk collisions and enemy emergence anchors.
The cactus shader adds small surface markings without texture downloads.

Grouped dry scrub now borders the maintained turf and existing rock gardens.
Each hole contains 70–116 cacti and 355–560 instances of the new shrub, plus existing woody scrub.
A separate random seed preserves the existing rock layout.
The placement filter checks projected plant bounds against fairways, greens, water, paths, bridges, and bunkers.

The new shrub uses Poly Haven's CC0 Didelta spinosa scan by Jenelle van Heerden.
Its medium source plant supplies two meshes: 22,000 and 10,000 triangles.
The source diffuse and alpha maps form one color texture. Normal and surface maps remain separate.
The shipped maps use 1024-pixel resolution. The compressed model download is 2,222,424 bytes.
The source species is a visual substitute for dry scrub, not a native Sonoran plant.

The generated cactus meshes have no corresponding model downloads.
The scenery manifest now distinguishes generated assets from downloadable models.
The build and loading checks use that distinction.
A missing shader newline also needed correction for the solid cactus depth material.

## References and source

The [Troon North course photographs](https://www.troonnorthgolf.com/) show grouped low scrub with taller saguaro accents.
The reference informed composition; no course photograph ships with the game.
The [Didelta spinosa source](https://polyhaven.com/a/didelta_spinosa) uses [CC0](https://polyhaven.com/license).
The downloaded files match the source manifest MD5 values.
Source credit also appears in the shipped nature manifest and game credits.

A commercial-quality saguaro scan on Sketchfab required login to download.
This build uses original cactus geometry. It contains none of that scan's data.

## Verification

Thirteen unit and asset checks pass.
They cover cactus geometry, outward normals, distinct silhouettes, asset requirements, other tree species, and lossless scenery decoding.
The compression check verifies 229 buffers with the shipped Three.js decoder.

All nine desert holes pass the browser clearance check.
The nearest sampled plant bound stays 3.12 metres beyond the fairway edge.
The check verifies 730 clear approaches to cactus trunks.
It also checks finite geometry, shrub texture opacity, matching shadow cutoffs, and both shrub distance meshes.
Rock gardens can occupy one side of a cactus. Collision tests therefore start from clear player positions.

The shared nature check passes all four course styles, tree distance levels, and leaf shadow cutoffs.
Final screenshots cover an aerial view, the tee, rough, a path, and close cactus geometry.
All captures use the installed source settings. All game browsers remain muted.

The production build succeeds, with the existing large-bundle warning.
The built game passes all four course previews and normal-input golf, running, and combat on Copper Saguaro.
Ethan uses `Ethan_GDH_Combo5_Review` during the observed heavy attack.
The final production check reports no browser errors.
The loading check passes course-specific downloads, cancellation, shared requests, retry, and saved-round restoration.
It resets the scenery cache before testing failure. Shared plant assets can otherwise cover all courses after two selections.
The delivery check passes both compressed files and the fallback for browsers without gzip-stream support.

## Performance

The moving combat sample keeps 24 enemies alive while the Ronin repeats heavy attacks.
Chrome uses Metal on the local Apple M1 Max at 1440 × 900 and a fixed rendering ratio of 1.0.
The sample measures eight seconds after two seconds of warmup.
No other automated GPU job ran during this measurement.

- Average: 53.6 FPS.
- 95th-percentile frame time: 33.3 ms.
- Longest measured frame: 50.0 ms.

This meets the local average frame-rate target. It does not establish performance on other devices or during a full round.
The extra shrub geometry has a rendering cost. The previous daylight sample averaged 57.1 FPS in the same desert fixture.
These separate short samples do not isolate every source of variation.

## Evidence and limits

Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/sonoran-planting/`.
The final images are in `final/`. Clearance, performance, and built-game checks have separate reports.
Early candidates lost leaf density at a 4,000-triangle distant mesh. The final asset retains 10,000 triangles there.
The initial footprint check also found plants crossing water edges. The final placement filter excludes those plants.

Private preview: `http://127.0.0.1:4185/`.
Production bundle: `index-GBtyRjqv.js`.
The complete build remains local and private, including Ethan's purchased polearm motions.

This pass improves desert identity and planting. It does not achieve photorealism.
The broad ground texture, repeated buildings, and distant terrain still limit the scene.
Preserve the accepted controls, golf, running, combat, and approved Ronin and Closer identities.
