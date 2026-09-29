# Lateral running anatomy review

Date: 2026-09-29.

The earlier lateral run spread the feet while keeping the hips forward. Its direction-only leg solve also bent the native knee frames sideways. Solving the full knee frame alone transferred excessive rotation into the hip and ankle.

Actual Claude Opus 5.5 High reviewed the prototype, source code, measurements, and final renders. It identified the vertical shoe-plane constraint as the cause of the remaining twist. Running now directs the knee bend along the foot heading. Selection and attack poses retain their existing solver.

## Change

- Replaced `Run_Right` and `Run_Left` in all six hero assets. Original geometry, textures, accessors, and 35 other animations per asset remain unchanged.
- Turned hips toward travel, with a smaller turn through the trunk and head. Distributed trunk rotation over two joints.
- Lengthened the lateral stride and reduced foot spread. Cadence follows actual travel speed, including the actor's 1.1 scale.
- Smoothed foot lift, pelvis bounce, and the free arm swing. The constant pelvis clearance prevents abrupt reach corrections.
- Blended authored foot paths before solving running legs. Quaternion blending alone caused diagonal foot sliding.
- Retained authored toe-off on terrain, prevented sole penetration, and limited pelvis recovery speed when leaving slopes.
- Moved the Ronin, Vice President, and Hustler carry positions slightly outward for weapon clearance.

## Evidence

Six heroes, both lateral clips, sampled at 480 Hz:

- Native knee side-bend below 0.003 degrees.
- Hip axial rotation below 11 degrees; ankle axial rotation below 9 degrees.
- Loaded knee flexion below 65 degrees. Swing flexion stays below 120 degrees.
- Native support drift below 0.5 mm. Runtime diagonal support drift stays below 7 mm in the flat-ground check.
- Loop seam displacement below 0.001 mm.

The browser checks cover ten running cases per hero, all four course surfaces, arm anatomy, weapon clearance, and transitions into golf and combat. Head clearance uses deformed vertices and conservative blade capsules. Oblique images made the polearm appear to touch the face; the measured surfaces remain separate.

The isolated release suite passed 459 tests. The build passed. The moving combat benchmark averaged 51.5 FPS with 64 enemies at 1440×900 on an M1 Max. Continuous running with the same crowd averaged 58.3 FPS. These measurements do not guarantee performance on every device or course.

## Review limits

Opus judged the final stills consistent with the corrected leg metrics. It could not assess cadence from still images. Its concerns about deep stance and weapon/head overlap prompted separate loaded-flexion and surface-clearance checks. The observed left/right camera difference comes from the fixed oblique camera.

The captured motion is a guarded run. More expressive toe push-off and character-specific movement remain possible improvements. This pass does not establish AAA quality for the rest of the game.

Local reports and the muted motion video are in `artifacts/source-motion-review/strafe/`.

## Reproduction

Run `tools/author-native-strafe.mjs ORIGINAL.glb --output CANDIDATE.glb` on an unpatched model. The tool rejects in-place writes and repeat bakes. The profile lives in `tools/strafe-profile.mjs`.

Run `tools/verify-animation-replacement.mjs` with `--replace Run_Right:Run_Right --replace Run_Left:Run_Left` to verify unrelated asset data.

The Blender hero export invokes this pass after native knee alignment. Animation-only exports invoke it only when replacing locomotion.
