# Ace golf shoulder release — 2026-09-30

The Ace's lead shoulder rose too far during the early golf follow-through. The shoulder also formed an angular ridge.

This update lowers the shoulder slightly. It does not remove the ridge or repair every arm and chest overlap.

## Change

The baked animation adjusts the clavicle and both arms together. Both hands retain one shared grip. The equipment rotates around its existing clubface contact point.

The correction starts after contact at 1.4 seconds. It reaches half strength at 1.471 seconds and ends at 1.651 seconds. The lead shoulder sits 13.05 mm lower at 1.471 seconds, measured before the game applies its character scale.

The eight replacement tracks contain arm rotations only. The body, feet, face, fingers, skin bindings, and other animations remain unchanged. The existing shoulder skin helper remains active.

The solver runs during authoring. The game plays baked rotation curves and does not run an additional solver each frame.

## Verification

The exact release snapshot passed all 570 unit tests and the production build. The built game loaded all six expected model hashes without a browser error.

The final Ace preview passed the C console, 0.1× speed, pause, and resume checks. A 480-frame selection sample at 1440 × 900 measured 59.9 median FPS. This is a preview measurement, not a gameplay benchmark.

- 11,282 native pose, key, and midpoint checks passed.
- Maximum separation between the two fitted palms: 0.089 mm.
- Maximum difference between their complete grip frames: 0.011 degrees.
- Maximum wrist rotation: 29.973 degrees.
- Maximum deviation from the calibrated elbow hinge: 0.003 degrees.
- No elbow bends in the negative direction.
- Maximum authored arm rotation rate: 1,797 degrees per second, within the existing regression limit.
- The release reversal regression passed with a 0.496-degree midpoint residual and a 1,511-degree-per-second peak arm rate.
- The existing golf pacing regression passed. The club does not stop and surge after impact.
- The runtime comparison preserved peak clubhead speed at 28.74 m/s. Maximum clubhead-center deviation was 3.158 mm.
- At 240 Hz, the maximum runtime joint step matched the baseline at 6.391 degrees.
- All 150 runtime golf phases passed finger-contact, fixed-club-length, and finite clubface-contact checks.
- 1,154 surface checks retained at least 5 mm of head and neck clearance for the arms, hands, shaft, and grip.
- The character selection checks passed for the full animation cycle, 0.1× speed, pause, resume, and preview framing.

The rotation measurements use the rig's calibrated frames. They are authoring constraints, not clinical measurements of human joints.

## Independent review

Claude Opus 5.5 High compared matching front and side renders. It found a modest improvement near 1.475 seconds and no new visible reason to reject the final candidate.

The review did not certify natural movement from still frames. It identified the remaining shoulder and armpit shape as unfinished.

Stronger corrections either changed the club's speed or caused abrupt arm rotation. We rejected them. Independent elbow optimization also produced inconsistent results between closely spaced keys. The final version fixes the elbow directions and uses a regular 960 Hz grid within the correction window. Original keys remain outside that window.

## Reproduction

Use [the recorded curves and rebuild instructions](../../tools/golf-shoulder/README.md). The baker verifies both source and output hashes.

Source model SHA-256: `9ecacbaa02a0cc258bd02db20e94e26f84f7f4f22e6539edc34c6206a15c241f`.

Output model SHA-256: `8878d752862a0fe12fd0085b808e873a32ccd8a74874e4f6bf329a817ac2942c`.
