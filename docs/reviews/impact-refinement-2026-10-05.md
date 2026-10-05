# Contact flashes, sparks, and fire — October 5, 2026

The previous contact shader produced ten identical star points around each hit.
Every missed swing also emitted metallic sparks at the hero's body.
Large musou arcs had hard edges that looked like flat strips.

The effects now use a short hot filament, uneven glow, and a broken expanding ring.
Sparks mix a few long streaks with smaller flecks, with varied drag and lifetimes.
Ordinary hits use warm sparks. Guard contacts use cooler sparks and retain their existing blood exclusion.
Fire loses its prolonged white center and retains more orange detail as it fades.
Blood droplets have softer outlines. Swing and musou arcs have soft edges and tapered ends.

Missed swings retain their blade trails and swing arcs. They no longer emit contact sparks.
Actual hit effects remain at the struck body. Musou retains its separate magical flourishes and persistent red aura.
The particle counts and pool capacities remain bounded. Empty pools stop drawing, and expired particles skip their fragment shaders.
No new particle library or asset download is required.

## Verification

Eleven focused tests pass. They cover missed swings, contact positions, guards, pool reuse, course changes, and calm golf cleanup.
They also verify the persistent musou aura and Shinobi shadow effects.

Matched isolated views cover light hits, heavy hits, guards, explosions, and misses at five ages.
The baseline, first candidate, and refined fire captures use the same random seed and camera.
The integrated musou review covers Ethan and the Closer at four times during each sequence.
F interrupts the existing heavy attack immediately. The aura follows the character and remains visible between contacts.
The effects clear after combat. The browser reports no shader or page errors. All tests stay muted.

## Performance

Chrome uses Metal on the Apple M1 Max at 1440 × 900, with 24 active enemies.
Balanced rendering adjusts its resolution. Each measurement covers eight seconds after warmup.
Enemies remain alive to sustain the workload. These tests do not measure ordinary kill pacing.
No other rendering or asset work runs during the measurements.

| Scene | Average FPS | Rendering ratio | 95th-percentile frame time, ms |
| --- | ---: | ---: | ---: |
| Ronin heavy combat | 51.3 | 1.00 | 33.4 |
| Vice President heavy combat | 57.6 | 0.85 | 16.8 |
| Hustler heavy combat | 56.6 | 0.75 | 33.3 |
| Closer heavy combat | 54.6 | 0.75 | 33.3 |
| Vice President sustained musou | 42.2 | 0.75 | 33.4 |

The sustained musou test passes the local 40 FPS average threshold, with limited margin.
These results apply to this machine and these scenes. Other devices remain unverified.
The manually stepped musou screenshots show a stale HUD frame counter. Use the live measurement above for performance.

## Evidence and limits

Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/impact-refinement/`.
It includes the original shaders, repeatable capture scripts, isolated images, combat images, and performance reports.
`tests/impact-lifecycle.test.js` preserves the new behavior checks.

This pass preserves the approved Ronin and Closer identities, all models, combat controls, animation timing, golf, and sound.
The complete build remains local because it includes the purchased Ethan polearm motions.
The public site remains on its earlier release. The broad AAA art objective remains unfinished.

The final production check passes normal selection, a golf shot, combat entry, three light stages, and a chained heavy attack.
The browser serves `index-BJ9UZy2T.js` and the unchanged 44-clip Ethan model without errors.
The private preview remains `http://127.0.0.1:4185/`.
