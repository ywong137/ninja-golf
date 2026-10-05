# Release loading and Copper Saguaro review

The broad AAA goal remains incomplete. This update preserves the accepted combat controls and musou introduction.

## Completed round

Ethan completed all nine Copper Saguaro holes through normal virtual gamepad input.
The driver did not alter player, ball, health, enemy, score, or clock state.
It used the golf simulation to choose shots, then applied normal button and stick input.

The scorecard shows 37 strokes: 32 recorded shots and five penalties.
Per-hole scores are 3, 2, 4, 3, 3, 2, 8, 3, and 9.
Both the saved progress and the displayed scorecard match those counts.
The round included 18 combat passages and 3,024 defeated enemies.
No route failed, and no browser error occurred. The round lasted about 35 minutes.
The driver made poor shots on holes seven and nine; those penalties remained in the final score.

Combat averaged 58.3 FPS in this particular automated round at 1440×900, Balanced, on an M1 Max.
Adaptive resolution remained enabled. Other review browsers ran during parts of the round.
This is an observed session result, not a minimum performance guarantee.
All audio remained muted.

Local evidence: `artifacts/reviews/rock-release-round/report.json`, `audit.json`, and `final.png` in the primary checkout.

## Cold startup

A cold public load used about 119.8 MB and reached the title after 51.7 seconds.
The measurement used Chrome with 20 Mbps download throughput and 50 ms simulated latency.
The scenery downloads accounted for 51.3 MB, including image atlases.
Surface and sky textures accounted for another 43.2 MB.
This leaves substantial startup work. A local fast load does not establish acceptable public loading.

Lossless WebP conversion increased the sampled normal texture's size. That experiment was rejected.
The installed scenery encoder instead compresses the existing geometry bytes with meshoptimizer.
The build keeps the original GLBs and writes separate delivery files.
It does not quantize, filter, reorder, simplify, or change the embedded images.
The runtime uses the decoder already distributed with Three.js.

All 221 compressed geometry buffers match their original bytes after decoding.
Uncompressed buffers, materials, nodes, accessors, and image data also remain identical.
Compressed scenery GLBs use 37,711,990 bytes, versus 44,728,257 bytes with plain gzip.
This saves 7,016,267 bytes, or 15.7% of those model downloads.
The total game savings are smaller because textures, characters, and code remain unchanged.

The [official encoder documentation](https://github.com/zeux/meshoptimizer/blob/master/js/README.md) defines the version-zero EXT format used here.
The game includes the [MIT notice](../../public/licenses/MESHOPTIMIZER-MIT.txt).

A serial, matched loading trial used the same Heather title view and simulated connection.
Total transfer fell from 120.38 MB to 113.38 MB. Title readiness changed from 51.21 to 48.88 seconds.
This is one sample; the exact byte reduction is stronger evidence than the timing difference.
Both views show the same scenery detail, with no browser errors.
The first comparison fixture used a constant random value and produced duplicate Three.js IDs.
That invalid fixture was discarded. The corrected comparison uses a seeded random sequence.
The built candidate passes seven normal keyboard/gamepad checks, including golf-to-combat and surviving enemy recoil.
All eleven scenery models decode in the browser. All four course previews render without errors.
The unwrapped delivery path also works when DecompressionStream is unavailable.
Commit 08d0667 passed public deployment with 1,033 tests.
Live checks verified all scenery models, all four course previews, the gzip fallback, and seven normal keyboard/gamepad behaviors.
