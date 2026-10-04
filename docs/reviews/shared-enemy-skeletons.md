# Shared enemy skeleton calculations

Clothing meshes used separate skeleton objects with identical bones and inverse bind matrices.
Each enemy recalculated its 80-bone palette two to five times per render pass.

`shareClonedSkeletons` replaces exact duplicate palettes inside one cloned enemy.
It compares bone identities, bone order, and inverse bind matrices.
Different enemies retain separate animated bones. Hero deformation helpers remain unchanged.
Actor disposal releases each retained skeleton once.
The change preserves all geometry, animation, materials, shadows, and graphics settings.

## Validation

Ten related unit checks pass, including every enemy clip and conservative animated bounds.
Eighteen browser cases compare separate and shared skeletons across running, jumping, attacks, death scaling, and three camera views.
All rendered pixels match exactly. Actor cleanup passes without browser errors.
The production build passes with the existing large-bundle warning.

The repeatable fixed-frame benchmark uses 64 enemies, Balanced graphics, a 1440×900 viewport, and a 0.75 render ratio.
It alternates separate/shared/shared/separate palettes within one muted Chrome session on an M1 Max.
Each measured run renders the same animation sequence for 360 frames after 180 warmup frames.
All four runs end with 1,331 draw calls and 6,041,682 triangles.

| Condition | Palettes | Mean CPU time | FPS |
| --- | ---: | ---: | ---: |
| Separate, first | 212 | 15.75 ms | 55.66 |
| Shared, first | 64 | 13.45 ms | 60.00 |
| Shared, second | 64 | 13.87 ms | 60.00 |
| Separate, second | 212 | 14.78 ms | 60.00 |

This comparison supports an average reduction of about 1.6 ms of CPU work per frame.
The 60 Hz display limits the fixed scene's frame rate.
The moving-combat stress test measured 48 FPS after the change, versus earlier measurements of 32.3–32.4 FPS.
Those separate runs do not isolate every source of variance. Do not attribute their entire difference to this change.
The game still needs broader performance checks across courses and full rounds.

Reproduce with:

```sh
node --test tests/shared-skeletons.test.js tests/skinned-bounds.test.js
GAME_URL=http://localhost:5174 node tests/browser-skeleton-sharing.mjs
GAME_URL=http://localhost:5174 node tools/benchmark-skeletons.mjs /tmp/ninja-skeleton-benchmark
npm run build
```

Local evidence is in the primary checkout's `artifacts/reviews/crowd-performance` directory.
