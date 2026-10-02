# Shared pose transitions

Date: October 1, 2026. Release base: `881f78b`.

Rapid guard, running, and attack changes previously left several animation fades active.
Guard walking could also compete with the single-pose blend in the recorded-motion candidate.
The resulting mixture could distort intermediate poses even when each source pose was valid.

All actors now use the same normalized pose blend for running, guard walking, and single-clip actions.
Each interruption captures every contributing action, including an alternate action used for a repeated attack.
Only the new transition controls the outgoing weights.
An incoming loop keeps its time when it already contributes to the displayed pose.

Zero-weight directional actions remain available within their active gait.
The next ownership transfer retires them.
This prevents inactive directions from blocking an exact combo continuation.

## Verification

The new browser regression covers every hero at 40 and 120 Hz.
It interrupts transitions after 25 and 75 milliseconds.
It checks running, moving guard, guard impact, guard recovery, light attacks, heavy attacks, and return to Ready.
Every stage must reach its expected animation.
Every frame must retain normalized weights without competing owners.
The final Ready pose must have exactly one scheduled action.

All 24 scenarios failed before the correction and pass afterward.
The same checks also pass with the local recorded-motion candidate.
The isolated release passes all 603 unit and asset tests and the production build.
The existing large JavaScript bundle warning remains.

Existing browser checks cover guard controls, guard walking, guard anatomy, travel transitions, paired grips, showcase controls, attack buffering, and enemy legs.
All pass against the isolated release on port 5174.
The gameplay smoke test also passes with installed Chrome and no browser errors.
All browser tests and recordings mute audio.

Actual-game recordings cover guard entry, guard exit, and attacks for all six heroes in the development workspace.
Separate recordings cover the Ronin and Ace with the isolated release controller.
Local evidence resides in `artifacts/reviews/guard-transitions/`.
Independent review found no blocking blend regression in the release code or sampled release recordings.
The reviewer inspected consecutive frames around transitions. This was not continuous playback.

The isolated release averaged 47.94 FPS during moving combat with 64 enemies.
This measurement used Chrome, Metal, Apple M1 Max, Balanced settings, and a 1440×900 viewport at rendering ratio 1.
The 95th-percentile frame time was 33.4 milliseconds.
This local scenario does not establish performance on every course or device.

This release changes animation blending. It does not replace the authored gait, golf swing, or attack choreography.
It does not include the unfinished recorded-running controller or candidate character assets.
Correct blend weights alone do not establish natural human movement.

Reproduce the focused regression with `node tests/browser-pose-interruptions.mjs` and a local server on port 5173.
Use `npm test` and `npm run build` for the unit, asset, and build checks.
