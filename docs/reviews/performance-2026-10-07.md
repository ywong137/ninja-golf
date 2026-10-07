# Loading and crowd performance — October 7, 2026

## Changes

- Surface textures use 1024-pixel previews before the title appears. Background requests then restore the original images on the same texture objects.
- Character and course selections suspend queued background requests. At most two detail requests run together.
- A 48 MiB CPU geometry cache reuses recently visited course meshes. Each scene owns separate geometry buffers and GPU disposal.
- Restarting the same hole keeps its existing scenery. Gameplay state, enemies, effects, and the ball still reset.
- Enemy weapons share instanced drawing batches. Individual animation and combat transforms remain authoritative.
- Dying weapons retain individual materials. Musou portraits use ordinary meshes for their scenery clipping.

The update preserves full-resolution textures, models, animations, enemy counts, and shadow settings. Preview textures add about 10 MB to a complete first download.

## Controlled loading measurements

Chrome, fresh browser context, 1440×900, 20 Mbps download, 50 ms latency, muted audio. The seeded title uses Copper Saguaro.
The readiness measurement requires the actual 3D title and removal of the loading curtain.

| Measurement | Before | After |
| --- | ---: | ---: |
| Cold title | 27.17 s | 15.86 s |
| Cached title | 14.30 s | 5.26 s |
| Downloads before cold title | 64.95 MB | 32.45 MB |
| Downloads before cached title | 27.84 MB | 0 MB |
| First Ronin selection | 7.51 s | 7.53 s |
| First Ace selection | 8.45 s | 8.50 s |
| Return to Copper Saguaro | 3.37 s | 1.26 s |
| Return to Crane Coast | 2.38 s | 0.97 s |

Uncached character and new-course downloads remain substantial. First Crane Coast selection took 24.56 seconds, compared with 23.55 seconds before.
These local measurements use a controlled network limit. They do not predict every device or public-network connection.

## Crowd measurements and validation

The 64-ninja fixture reduced draw calls from 1,666 to 1,165. The fixture includes real enemy AI, animation, course scenery, and shadows.

Alternating disabled/enabled runs used the same browser, camera, 64-enemy layout, and 180-frame sampling window. Two runs used each setting.

| Measurement | Ordinary weapons | Instanced weapons |
| --- | ---: | ---: |
| CPU work per frame | 21.27 ms | 17.38 ms |
| Rendering CPU time | 17.28 ms | 13.62 ms |
| Mean frame interval | 23.33 ms | 22.00 ms |
| Draw calls | 1,666 | 1,165 |

CPU work decreased about 18%. Rendering CPU time decreased about 21%. Frame delivery improved about 6%; GPU work still limits this scene.
Triangle counts stayed effectively unchanged. The batching change targets CPU submission overhead without reducing visual detail.

Six frozen-pose comparisons checked running, attacking, death fades, two camera angles, ambient occlusion, and shadows.
At most one of 1,024,000 pixels differed by more than two color levels. The largest mean channel difference was 0.000028 on a 0–255 scale.
Instanced transforms use float32 values, which can change a triangle boundary by less than a pixel.

Unit checks cover animated world transforms, batch capacity, visibility, death and portrait fallback, disposal, texture priority, and cache eviction.
The geometry cache never shares mutable scene buffers. The texture manifest checks source hashes and content hashes.

The browser texture check restored 2048×2048 pixels with zero differences from the original image.
Production checks passed all four course previews, cancellation, download retry, saved-round restoration, and the transition from golf to combat.

Local measurement artifacts reside in `/Users/yishan/ninja-golf/artifacts/reviews/performance-2026-10-07/`.
