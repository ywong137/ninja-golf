# Course-specific scenery loading

The production title loads only the scenery used by its randomly selected course.
Later course selections reuse completed assets and share pending requests.
The loader waits before replacing the current scene. It keeps failed requests available for retry.
Cancel restores the current course choice. A late request cannot override a newer choice.
Continue loads the saved course before restoring its hole, score, character, and progress.
Development keeps all scenery available for existing inspection tools.

The change does not alter model geometry, textures, placement, collision bounds, or animation.
The existing full scenery loader remains available for inspection tools.
All assets still ship in the static build. No separate server is required.

## Downloads

Sizes include compressed scenery GLBs and their viewing, normal, and shadow atlases.
These are scenery bytes, not total startup bytes.

| Course | Model files | Scenery bytes |
| --- | ---: | ---: |
| Crane Coast | 8 | 39,235,470 |
| Heather & Crown | 7 | 31,119,315 |
| Copper Saguaro | 2 | 3,246,483 |
| Neo-Tokyo | 5 | 13,033,335 |

Surface textures, skies, the initial warrior, enemies, and shared motion still load at startup.
Those remaining downloads limit the overall improvement.

## Verification

Fresh browser contexts successfully loaded all four title courses with only their required scenery.
A separate UI check delayed a download, cancelled it, requested it again, and selected another course.
Only one request ran for the delayed asset. Its completion did not replace the newer choice.
An injected network failure exposed a working retry control.
The saved-round check restored another course, then used normal shot controls to reach combat.
All four previews and the fallback without DecompressionStream passed.
The final candidate also passed seven normal keyboard/gamepad control checks and exact asset comparisons.
The cache tests and 221-buffer lossless decoder test passed.
Every review browser kept its audio muted. No browser errors occurred.

Local evidence is under `artifacts/reviews/course-loading/` in the primary checkout.

## Matched startup trial

Both builds showed Neo-Tokyo with an empty browser cache and matching gzip server behavior.
The connection used 20 Mbps download throughput and 50 ms latency.
Total transfer fell from 113,377,123 to 82,200,046 bytes.
Title readiness improved from 49.13 to 36.53 seconds in this single serial comparison.
This saves 31.18 MB and 12.6 seconds in that trial. It does not establish a universal loading time.
The larger surface and sky downloads remain the main next loading target.
