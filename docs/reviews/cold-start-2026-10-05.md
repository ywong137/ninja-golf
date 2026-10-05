# Cold-load improvements — 2026-10-05

The first usable 3D title screen arrived 38% sooner in the controlled test.
The test used a fresh Chrome context, disabled caches, 20 Mbps downloads, and 50 ms network latency.
Both builds showed Copper Saguaro with seed 9127 at 1440 × 900.
The timer stopped when the landscape loading curtain disappeared and the play button became available.

| Measurement | Before | After |
| --- | ---: | ---: |
| Usable title screen | 44.1 s | 27.5 s |
| Initial resource bytes | 106.4 MB | 64.9 MB |
| JavaScript entry, uncompressed | 17.6 MB | 3.0 MB |
| JavaScript entry, gzip | 5.7 MB | 0.91 MB |

These results measure one course and network profile. Other courses, connections, and computers will differ.
The local production server compressed text responses and served the same binary assets that the release uses.

## Changes

The aerial title no longer waits for a hidden player, enemy models, or shared animation source models.
Character selection loads the chosen model and its motion samples together.
The course menu prepares enemies before the round starts.
Download failures retain retry controls. Changing courses cancels a pending round start.

The entry bundle now contains motion metadata without every character's pose arrays.
Separate hashed assets contain character poses, shared poses, and historical poses.
The loader preserves record identity and validates each complete group before publishing it.
All motion values, samples, clip metadata, and original source files remain intact.

Each course loads only its elevation grid and required daytime or nighttime sky.
Lossless gzip compresses both HDR skies and all elevation grids from 20.4 MiB to 11.8 MiB combined.
The browser decompresses the bytes before the existing terrain and HDR decoders read them.
Browsers without streaming decompression use the original files.

The update retains original texture resolution and model quality.
Deferred character and enemy downloads still occur when the player needs them.
The remaining large startup downloads mainly contain the high-resolution landscape textures.

## Verification

Seventeen focused unit tests passed.
They verify exact motion interpolation, reconstruction of every split pose record, shared requests, retries, and lossless environment decoding.
Production character checks cover all six heroes, cancelled downloads, retries, saved rounds, and normal golf-to-combat play.
Production course checks cover all four themes, delayed and failed downloads, changed selections, and saved rounds.
All browser checks run with audio muted.
The full existing test suite remains a deployment gate.

Local evidence: `/Users/yishan/ninja-golf/artifacts/reviews/cold-start-2026-10-05/`.
The directory contains before/after resource timings, screenshots, build output, and browser reports.
