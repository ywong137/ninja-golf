# Attack movement and blade direction — 2026-09-29

The curved blade geometry now bends away from its +X cutting edge. Commit `7f52f9e` contains that correction.

Some installed animations still strike with the back or flat of the blade. Geometry alone cannot correct those poses.

## Installed animation audit

The audit measures the actual runtime blade at each gameplay impact. It excludes inactive offhand weapons.

It flags signed edge alignment below 0.65. Double-edged swords use either cutting edge. This threshold is a diagnostic, not a quality certificate.

Of 59 active impact samples, six Ronin samples and five Ethan samples were flagged. The other four characters passed this directional check.

Evidence lives in `artifacts/source-motion-review/palm-registration/live-edge-summary.json` and `live-edge-audit.json`.

## Movement support

`extractPlanarRoot()` separates horizontal pelvis travel from a native animation. It preserves vertical motion and all other tracks.

The extractor rejects moving parents and unsupported pelvis interpolation. It restores the supplied scene, including after an error.

A motion record can supply `planarRoot: {duration, rows: [{time, x, z}]}`. Positions use native-model metres. Times use animation seconds.

The controller samples differences between action times. It scales and rotates those differences, then applies the existing terrain and collision checks.

The skeleton uses the same action clock. Dodging discards the remaining movement. Impacts use the position after collision correction.

`movementScale` controls manual movement during that attack. Its default remains 0.45. A planted lunge can explicitly choose zero.

The Ace rising heavy attack now uses this path. Its native legs and terrain checks are documented in `ace-rising-native-legs.md`.

## Validation

- Unit tests reconstruct child positions under rotated and scaled native parents.
- Travel tests cover five frame rates, three durations, and three headings.
- Browser tests cover frame rates from 30 through 120 FPS, wall collision, impact positions, cancellation, and restarting.
- Existing grounded attacks retain their stationary roots and planted feet.
- Existing attack buffers still chain and cancel correctly.

## Ace candidate

Actual Claude Opus 5.5 High authored the candidate. Its returned model identifier was `claude-opus-5-5`, with no permission denials.

The candidate uses the CC0 Quaternius UAL2 body motion and native arm lengths. It retains the current, fixed sword attachment.

The cutting stroke clears the skin and leads with the blade edge. Recovery includes sideways blade motion. It is not another damaging stroke.

The source motion needed slower timing and corrected foot contacts. An earlier candidate lasted 1.3 seconds and hit at 0.42555 seconds.

Local controller checks found under 2.6 mm of planted ankle drift and under 21 mm of toe drift on sloped terrain.

Those measurements did not approve that candidate. Later review corrected transitions, body timing, native knee hinges, and the rear-leg stance.

Reproduction files and reports live in `artifacts/source-motion-review/opus-ace/`. Temporary working files remain in `/tmp/ninja-opus-ace/`.

## Ronin candidate

A separate ready pose uses mirrored hand angles around one shared handle. Both wrists remain neutral, and both elbows clear the torso.

Reconstruction checks place both palms within 0.1 micrometres of their intended stations. Skin checks found no arm contacts in that pose.

The full cut still fails arm and skin checks. Do not install its attachment frames across the existing attack family.

Evidence lives in `artifacts/source-motion-review/mirrored-two-hand/`.
