# Shared leg rollout — October 2, 2026

The game remains a playable alpha. This local correction does not establish release readiness.

## Cause and correction

The actor created `LegJointBalance` only when it created the experimental paired-weapon running controller.
The other heroes therefore skipped this correction, despite passing separate tests of the shared solver.
Ordinary directional runs also skipped balancing when their planner lacked its own terrain callback.
The actor already had the actual terrain callback.

Every native hero now creates the same correction from its calibrated skeleton.
Both running paths use the actor's terrain callback.
Weapon selection no longer controls access to this anatomical correction.
The solver and its numerical bounds remain unchanged.

The running-turn regression now checks that balancing actually runs during each character's turn.
This check covers the integration error that the isolated solver tests missed.

## Initial activation check

| Check | Before | After |
| --- | --- | --- |
| Running turns, all six heroes | 2 failures among 48 cases | All 48 pass |
| Combat transitions, five non-Ronin heroes | 101 failures among 1,650 cases | 21 failures remain |
| Excessive joint twist during combat recovery | 90 cases | 10 cases |
| Excessive foot speed during combat recovery | 11 cases | 11 cases |
| Maximum ankle twist during combat recovery | 43.47 degrees | 23.74 degrees |

The full combat comparison has no newly failing cases.
All sampled knees retain positive flexion and satisfy the existing hinge-deviation check.
Those measurements do not establish natural movement.

Twenty-seven focused joint and contact tests pass.
They include isolated planted-contact transfers on six hero rigs and three enemy rigs.
Enemy gameplay does not gain a new controller through this change.
The production build passes with the existing large-bundle warning.

## Shared recovery corrections

The eleven foot-speed failures occurred on the first frame after an attack.
The experimental running code applied full airborne clearance before its foot path finished blending.
Clearance now follows the same blend. This correction remains in development because the release lacks that experimental clearance stage.

The remaining ten twist failures occurred during loaded turns.
Ordinary runs now use the existing support pivot, with bounded rotation and a fixed sole contact.
The pivot retains the same calibrated knee hinge and ankle limits.

Opus 5.5 High found two implementation defects in this extension.
The pivot could apply an ordinary run's floor offset twice. It also skipped the check that keeps each leg on its own side.
The pivot now stores its anchor in the original floor frame, and the lane check evaluates the ankle after the proposed turn.
New positive and negative floor-offset tests verify the first correction.

The isolated release contains common joint balancing and support pivots for all six heroes.
It uses the existing animation assets and running controller.
The recorded-motion controller and revised heavy-attack asset remain separate.

## Release verification

- All 631 unit and asset tests pass.
- All 1,650 non-Ronin combat-transition cases and 360 Ronin cases pass.
- All 108 running cases and 48 running-turn cases pass.
- Sixteen turn-continuity cases pass, including comparison at 240 and 480 updates per second.
- Ninety running-exit and fast-turn cases pass.
- The golf/combat/pause browser smoke test passes without browser errors.
- The production build passes with its existing large-bundle warning.

The development benchmark averages 52.5 FPS with 64 enemies at 1440×900 on this M1 Max.
The isolated release averages 52.6 FPS in the same scenario, at rendering ratio 1. Its 95th-percentile frame time is 33.4 ms.
Check GitHub Actions for the deployment status of the commit containing this correction.

Actual-game recordings cover Vice President attack recovery and Shinobi turning and attack recovery.
The reviewer inspected sampled frames, not continuous playback.
The latest recordings include separate animation-blend weights, foot positions, sole gaps, contact weights, and joint corrections.

## Remaining work

The earlier 21 numerical failures now pass. This does not establish natural movement.
Backward running still has excessive knee lift and long strides.
Attack entry and return still change movement speed abruptly in the existing controller.
The weapon poses need stronger coordinated body movement.
Opus confirmed both pivot corrections and identified an existing support-foot slide during attack-to-run blending.
The recorded Shinobi return moves a nominally supporting ankle about 20 cm in 33 ms while the planner contact remains fixed.
The position blend after contact planning causes this mismatch. The next correction must transfer the actual outgoing footprint and support phase.
A dedicated mirrored-foot test now verifies the pivot lane constraint. Both cases pass.
Net pivot-angle budgeting and heel-to-toe pivot transfer also need further movement review.

The recorded-motion experiment still requires complete visual and gameplay acceptance.
The scoped release corrects excessive twisting and unsafe pivots. It does not establish complete support continuity.

## Evidence and reproduction

Before and after reports reside in `artifacts/reviews/shared-leg-rollout/`.
They include the complete combat matrices, running-turn measurements, unit results, and build output.

With the development server on port 5173:

```sh
node tests/browser-run-turn-anatomy.mjs
node tests/browser-combat-leg-frames.mjs
node --test tests/leg-joint-balance.test.js tests/leg-pole.test.js tests/planted-pose-roster.test.js
npm run build
```

Both browser scripts mute audio at launch.
`NINJA_COMBAT_LEG_CASES` can select a JSON array of recorded cases for focused diagnosis.
`NINJA_COMBAT_LEG_REPORT` selects a separate report path for parallel runs.
`NINJA_COMBAT_LEG_TRACE=1` includes individual recovery frames.
`GAME_URL=http://localhost:5174` runs these browser checks against the isolated release server.
