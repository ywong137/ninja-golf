# Reusable motion sampling

Date: 2026-09-30. Baseline: `b174c45`.

Each character previously allocated a new pose object and channel arrays on every sample.
The sampler also searched keyframes from the beginning each time.
Dense clips contain hundreds of keys.

The sampler now uses binary search and a buffer owned by each character.
It keeps that buffer's arrays between frames.
It removes obsolete channels when a character changes clips.
The existing `sampleMotion` function still returns an independent pose for tools and other callers.
Both functions use the same interpolation implementation.

This change preserves the original arithmetic order and the interval choice at exact keys.
It also preserves fixed club length, endpoint clamps, reverse playback, and arbitrary seeking.
Models, keyframes, animation timing, and source motion records stay unchanged.

Production already excluded unused authoring channels before this change.
This change addresses repeated CPU work and temporary allocations.

## Performance measurement

Muted Chrome 154 sampled all 129 motion and selection records using production data.
Nine rounds alternated the old and new implementations after warmup.
Each round sampled 200,000 poses; all checksums matched.

| Median measurement | Previous sampler | Reusable sampler |
| --- | ---: | ---: |
| Time per 200,000 poses | 554.5 ms | 175.5 ms |
| Time per pose | 2.77 µs | 0.88 µs |

The sampler runs about 3.16 times faster in this benchmark.
This does not imply the same improvement in overall frame rate.
Rendering and skeletal animation have separate costs.
The JavaScript bundle increases by 390 bytes.

A separate development-build check averaged 57.6 FPS with 64 enemies and the Ace moving through attacks.
It used Crane Coast at 1440×900 on an Apple M1 Max through Chrome's Metal renderer.
The renderer used a 1.0 pixel ratio with contact shading disabled.
The measured 95th-percentile frame interval was 16.8 ms over ten seconds.
This single scene does not establish performance across every course or device.

## Verification

The frozen previous sampler supplies the numerical reference.
All 255,158 comparisons match exactly across full authoring records and projected production records.
They include every key, three intermediate times per interval, selection poses, reverse traversal, and clip changes.
Separate checks verify buffer reuse, independent callers, and obsolete offhand removal.

The browser comparison covers heroes, enemies, and moving attack transitions on sloping ground.
All 2,394 samples and 3,280,528 transform values match exactly.
Golf, heavy-attack, and Musou contact sheets match pixel for pixel.
Golf contact checks, combat controls, gamepad controls, and all six selection cycles pass.
All 563 unit and asset tests pass in an isolated release snapshot.
The production build also passes a drive, club changes, combat, and pause/resume without browser errors.

Reproduce the focused checks with these commands:

```sh
node --test tests/motion-sampling.test.js tests/playback-motion.test.js
# Start Vite before these browser checks.
node tests/browser-playback-motion.mjs --sampler
node tools/benchmark-motion-sampling.mjs /tmp/ninja-sampling/benchmark.json
```

This optimization preserves existing poses; it does not certify their artistic quality.
Coordinated golf impact timing and the Ace's upper-arm garment contacts still need correction.
