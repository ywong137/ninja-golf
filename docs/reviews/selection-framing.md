# Complete character previews

The old selection camera cut off clubs and blades on all six characters.
The Vice President's polearm extended furthest beyond the screen.
The playback controls also overlapped the introduction at some desktop sizes.

The camera now fits each character's complete golf and combat preview loop.
It holds one distance throughout that loop. Selecting another character fits their first frame immediately.
The full silhouette shares a clear area beside the roster.
An asymmetric projection places that area correctly without pointing the camera away from the character.
Leaving selection restores the normal camera projection.

The roster uses a separate column for its introduction, cards, and playback controls.
Short windows allow the cards to scroll while keeping the controls and course button accessible.
The sunlight shadow now follows the selected hero instead of a distant fairway point.

## Geometry and cost

An offline tool samples the visible, deformed geometry at 60 Hz.
It includes the body, golf club, and weapons throughout the full preview loop.
A convex envelope combines the individual mesh bounds at those sampled poses.
This fits more closely than one box around all poses while keeping the camera stable.
An eight-centimetre local margin covers small differences between sampled frames.
The viewport fit adds twelve pixels of clear space on each edge.

The game uses the saved envelope. It does not sample skinned vertices during rendering.
Each record includes its model hash, and a release test rejects stale model bounds.
After changing preview animations or held-object geometry, regenerate and review the data:

```sh
node tools/bake-showcase-bounds.mjs --output src/showcase-bounds.json
node tests/browser-selection-framing.mjs
```

The tool requires the local Vite server on port 5173. Its browser remains muted.

## Verification

The browser regression measures all six complete loops again at 43 Hz.
It checks the resulting geometry inside the actual preview region, including all visible weapon arcs.
It checks five desktop sizes, with the animation console both open and closed:
1440×900, 1280×720, 1280×600, 1024×768, and 1920×1080.
Every card remains reachable. Card content stays inside its boundary.
The roster, controls, character region, and footer do not overlap.

All four course backgrounds pass the framing and shadow checks.
The title, course selection, and gameplay restore the normal camera projection.
Existing playback and navigation checks pass, including pause, speed, character changes, golf, and combat transitions.
No browser errors occurred.
All 532 release tests pass in a clean checkout with these changes. The production build succeeds.

The preview measured approximately 60 FPS for all six characters at 1440×900 in Chrome on this Mac.
This uses Balanced quality at a pixel ratio of one. It does not establish performance on other hardware.

The complete arc requires a smaller character than the old cropped camera.
This change improves motion inspection; it does not correct or certify the animation poses themselves.
Local before/after images, viewport captures, and measurements live in `artifacts/reviews/selection-framing/`.
