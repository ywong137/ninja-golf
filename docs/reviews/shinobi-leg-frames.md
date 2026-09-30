# Shinobi leg frames and supported recovery

This release extends the rear-leg correction to all 17 Shinobi combat clips.
It covers Ready, eight cuts, musou, three stationary guards, and four guard walks.

The source solver reached the foot targets but failed to preserve the native knee hinge.
The correction rebuilds the complete thigh, calf, and ankle frames.
An offline fit samples at 480 Hz and includes every original key time.
Runtime playback uses the resulting animation tracks without the fitting search.

The alternating Sweep previously turned its feet by 80 and −65 degrees.
The revised pivots use 50 and −40.625 degrees around the actual forefoot contact.
The upper-body rotations and blade contacts remain unchanged.

Musou now steps around a wider circle, with outward passing steps that keep the legs apart.
The last left step lands before the right foot closes.
The body shifts over the left support before the right foot lifts.
Both feet support the return to Ready.
The pelvis lowers slightly during the shift, preventing a stretched rear leg.

Guard walks retain their shared contact phase.
Previously, enabling corrected native knees replaced that phase with an attack-specific contact estimate.

## Evidence

All 476 release tests pass in an isolated copy of the reviewed files. The production build succeeds.
Unfinished golf and Ronin experiments remain outside this release.

| Check | Result |
| --- | --- |
| Native hip axial rotation | At most 41.34° |
| Native ankle axial rotation | At most 13.66° |
| Native knee side bend | Below 0.000024° |
| Leg surface intersections across 17 clips | None detected at 480 Hz |
| Musou minimum leg surface gap | 17.85 mm |
| Moving attacks and transitions | 1,650 browser cases pass |
| Musou, guards, and guard walks | 108 cases pass at 40, 60, and 120 FPS |
| Guard movement across six characters | 48 cases pass |
| Attack-to-run transitions | 288 cases pass |
| Paired hand transitions | 138 cases pass |

The guard checks retain planted-foot drift and forward-knee checks.
For corrected clips, they measure actual joint frames instead of a vertical plane above each shoe.
Uncorrected clips retain the earlier check.

A 960 Hz comparison covers 16,581 samples.
It verifies the expected pelvis translation and unchanged upper-body rotations.
The original geometry, weights, textures, and 20 unrelated animations remain intact.
The source comparison preserves 12,301,328 original binary bytes.
The revised model contains 16,470,824 bytes.

Actual Claude Opus 5.5 High reviewed the before/after images and measured support positions.
Its feedback exposed an insufficient weight shift during recovery.
The final review found no remaining visible leg-alignment or support blocker in those views.

The approximate body-mass estimate places the body within 5.3 cm of the left ankle's lateral plane during the closing step.
The pelvis stays within 2.3 cm of that ankle horizontally.
The rear knee remains flexed before lift and through landing.
These estimates compare candidate poses; they do not establish physical balance.
Still views also cannot establish full-speed animation quality.

## Gameplay playback

Muted captures use a 1440 × 900 viewport at pixel ratio one.
Each capture records ten seconds of combat on this machine.

| Attack | Average FPS | Enemy count |
| --- | ---: | ---: |
| Alternating light Sweep | 58.73 | 24–43 |
| Musou | 57.36 | 20–45 |

Both captures play the expected clips and report no browser errors.
The recovery remains a fast movement. These measurements do not establish complete animation quality.

## Reproduction

Use the Shinobi model and motion catalog from commit `1d1a981`.
The author checks the source hash and rejects repeated application.

```sh
node tools/author-combat-leg-frames.mjs \
  --model shinobi \
  --input /tmp/shinobi-source.glb \
  --motions /tmp/source-motions.json \
  --output /tmp/shinobi-candidate.glb \
  --record /tmp/shinobi-records.json
```

The browser asset revision is `shinobi-native-leg-frames-1`.
Local review evidence resides in `artifacts/source-motion-review/shinobi-leg-frames/`.
This correction does not complete the remaining golf, running, and broader animation work.
