# Playback motion bundle

Date: 2026-09-29. Previous release: `309e9ef`.

Production builds previously included body targets used only by animation authoring tools.
The game plays joint animations from the native GLBs.
Its motion sampler needs eight additional pose fields for held objects and foot contact.

The build plugin retains `grip`, `tip`, `offGrip`, `offTip`, `roll`, `offRoll`, `footR`, and `footL`.
It also retains every sample time and all clip metadata.
It preserves the exact stored numbers and the original interpolation.
It does not alter the source records or any model.

Development keeps the full records for authoring tools and pose reviews.
`vite build --mode motion-reference` also keeps them for production comparisons.
The plugin replaces only the game's motion import.
Invalid retained channels stop the build with a clip and pose identifier.

## Size and loading

| Measurement | Previous build | Playback build |
| --- | ---: | ---: |
| JavaScript bytes | 25,055,389 | 13,515,083 |
| Gzip bytes from local preview | 7,309,989 | 3,946,388 |
| Median game initialization | 4.78 seconds | 4.34 seconds |
| Median loading curtain removal | 6.86 seconds | 6.43 seconds |
| Total encoded startup resources | 229,128,439 bytes | 225,764,838 bytes |

JavaScript transfer falls by 46%.
Total startup transfer falls by about 1.5%; models and textures remain the larger cost.
The measurement used three cold browser contexts per build, with alternating build order.
Each context used the same seeded title course, viewport, and settings.
Chrome used Metal on Apple M1 Max at 1440×900.
Vite preview served local files with gzip compression.
These measurements include asset loading and shader preparation, but do not measure a remote network.

## Pose equivalence

The unit comparison exercises the actual motion sampler.
It compares every key and three intermediate times per interval across all 123 clips.
It also checks clamped endpoints, metadata, invalid records, and build dispatch.
All 126,053 sampled-pose comparisons match exactly.

The browser comparison runs the actual hero and enemy animation code.
It includes all hero clips, all enemy clips, and moving attack transitions on sloping ground.
All 2,394 samples match, including 3,280,528 bone and held-object transform values.
Golf, heavy-attack, and Musou contact sheets match pixel for pixel.
No browser errors occurred.

The clean release snapshot passes all 419 unit and asset tests.
The production build succeeds and matches the gameplay-tested bundle byte for byte.
The production gameplay check covers club selection, a drive, combat, and pause/resume.
All test browsers remain muted and close after their checks.

These comparisons establish that this optimization preserves current animation behavior.
They do not establish that every existing pose meets the requested visual standard.
