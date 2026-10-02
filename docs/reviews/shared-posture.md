# Shared posture investigation — October 2, 2026

The game remains a playable alpha. This revision passed the incremental release checks.
Its preceding public release was commit `3ce0fe4`.

## Current candidate

`artifacts/reviews/shared-posture/guard-plane-candidates/` contains all six hero models.
One authoring algorithm produces five running clips and four guarded walks for each native skeleton.
It preserves meshes, textures, body rotations, relative grip positions, and unrelated animations.

The correction measures pelvis drop and step width from the licensed jogging and sprinting reference.
It scales these measurements by native leg length and fits the pelvis within the available reach.
Each clip records its stride ratio for the runtime distance clock.

Straight travel now removes the outward shoe angle inherited from static poses.
The correction preserves shoe pitch, roll, and loaded height.
Lateral guards retain their original foot lanes because centering those lanes caused crossed steps.
Straight guarded steps use a small outward recovery arc and a 0.10-radian outward knee-plane offset.
The native hinge correction preserves knee bend direction and both rigid leg lengths.

The outward knee plane resolves the Ronin's upper-thigh clothing overlap.
Increasing the recovery arc alone did not resolve that overlap.
Preserving walking foot height and restoring the original fore/aft stagger also failed the surface check.
Those trials remain separate artifacts. The authoring tool now matches the `guard-plane-candidates` method.

## Native verification

All 54 changed clips pass the independent dense audit.
The six knee audits and six leg-surface audits also pass.
The surface audit now includes all four guarded walks for every hero.
It retains the existing surface selection, zero-intersection requirement, and 3 mm minimum clearance.

Across the 54 changed clips, maximum measured values are:

- Knee side bend: 0.00265 degrees.
- Hip twist: 24.83 degrees.
- Ankle twist: 9.87 degrees.
- Loaded knee medial displacement: 15.78 mm.

The audit checks native limb lengths, unchanged upper-body poses, shoe orientation, loaded foot height, and stride timing.
Lateral guards use the existing lateral-running alignment metric, with separate native joint-frame limits.
Forward and backward travel retain the vertical shoe-plane alignment check.

The candidate passes 60 browser locomotion cases through the current local controller.
The production build and whitespace check pass.
These checks do not establish natural motion or full release acceptance.

## Shared runtime correction

Moving attacks and guarded walking previously skipped joint balancing unless a contact transfer was active.
`src/actors.js` now supplies a stable correction owner during those movements.
The combat test verifies that moving attacks actually execute the shared correction.

The first complete comparison reduced failures from 150 to eight among 2,130 combat cases.
The remaining cases concerned airborne ankle twist during the Vice President's heavy sweep on slopes.
A temporary increase in that clip's pelvis blend from 0.55 to 0.65 passed the complete matrix.
That experiment established a useful baseline, but it changed the attack's lean as well as its turn.

Opus 5.5 High identified a shared problem: walking feet follow the gait fully while the pelvis retains an unbounded attack turn.
The current correction therefore restores the clip's 0.55 blend and bounds the remaining yaw for every moving attack.
`src/attack-pelvis.js` uses an 18-degree residual limit and a smooth four-degree transition band on each side.
Additional correction changes heading only. It preserves the existing pelvic lean.
The torso distributes that correction while retaining chest orientation, weapon orientation, and relative hand position.
Stationary attacks retain their authored motion.

Verification against the final `guard-plane-candidates` models:

- All 2,130 combat cases pass, including all six heroes, slopes, travel directions, and attack recovery.
- The correction activates in 1,656 cases across all six heroes. It is not restricted to the Vice President.
- Maximum measured attack ankle twist is 20.81 degrees, below the unchanged 22-degree criterion.
- All 42 actual-controller interruption cases pass.
- All 29 focused unit tests pass, including hand spacing and chest/weapon orientation across the six heroes.
- The production build and whitespace check pass.

The unit checks also cover quaternion sign, arbitrary actor orientation, unchanged small turns, and continuity across the correction band.
The browser result is stored in `artifacts/reviews/shared-posture/shared-pelvis-roster.json`.
The independent review is stored in `artifacts/reviews/shared-posture/opus-sweep-review.md`.

## Shared slope and turn corrections

The running matrix previously failed 22 sprint-on-slope cases across all six heroes.
The terrain solver lowered the pelvis but held an airborne foot at its earlier world height.
That compressed the free leg and changed its ankle angle after the running correction.

The shared terrain solver now carries an unconstrained airborne foot with the pelvis.
The correction fades as the foot accepts weight and preserves explicit world-space targets.
A ground-clearance floor prevents the shoe from passing through the terrain.
Golf and loaded feet retain their existing contact behavior.

All 108 running cases now pass with unchanged criteria.
Maximum knee flexion falls from 160.65 to 150.40 degrees.
Maximum airborne ankle pitch falls from 40.68 to 26.85 degrees.
The isolated release checkout passes the same 108 cases without asset overrides.
The shared test also checks both free legs on all six heroes and three enemy body rigs.

The turn audit found two premature releases during a short Shinobi lateral step.
A controlled comparison confirmed that the terrain correction did not cause those releases.
The reach forecast looked beyond the foot's scheduled liftoff.
The planner now limits that forecast to the remaining contact time for every character.
All 48 turn cases and 31 focused planner tests pass.

Reports: `release-integrated-run.json`, `carried-free-combat.json`, and `turn-liftoff-roster.json` in the shared-posture artifact directory.

## Visual review

Silent controller captures exist for Shinobi, Ronin, and the Vice President.
The revised moving polearm sweep retains plausible leg directions in sampled front and side views.
Its torso still moves too little for a convincing heavy attack.
A ten-second muted gameplay capture averages 56.46 FPS at 1440×900 with 24–36 enemies and no browser errors.
This short sample does not replace dense-combat or complete-game performance acceptance.
Numerical success does not establish natural motion or full release acceptance.

The earlier Opus constraint review remains in `artifacts/reviews/shared-posture/opus-constraints-review.md`.
It recommended correcting step geometry before relaxing joint checks.
Independent measurements confirmed the reference used narrower steps than the earlier candidate.

## Independent visual review

Opus 5.5 High inspected front and side samples from all six heroes running down a 10% slope.
It found no backward knees or inward knee collapse in the 72 sampled panels.
It found no visual reason to withhold the shared terrain correction.
This review covers still samples, not continuous movement.

The review identified weak rear-foot push-off and limited forward arm drive.
It also identified a sustained forward lean that can make running look crouched.
The next shared movement pass should address those issues before individual weapon choreography.
See `artifacts/reviews/shared-posture/opus-slope-review.md` for the full independent review.

## Release state and next work

The isolated release checkout now contains the current runtime and all six revised hero models.
Its preview bounds were regenerated from complete animation loops at 60 Hz.
The production build and 108 running checks pass against that checkout.
The integrated checkout passes all 837 unit and asset tests.
It also passes 2,130 combat cases, 42 controller interruptions, and 90 running-exit and rapid-turn cases.
Golf motion and leg checks pass. The six preview loops fit all ten tested layouts and four course backgrounds.
The gameplay smoke test passes with no browser errors.
The integrated build averages 51.18 FPS with 64 enemies and a moving Vice President at 1440×900 on the M1 Max.
The rendering ratio remains 1.0; this sample does not establish performance on other devices.
The regression completes all 36 cups and verifies each course scorecard, course selection, and survey controls.
It uses controlled putts; it does not replace full rounds played through every fairway encounter.
The silent polearm recording averages 54.47 FPS with 23–38 enemies and no browser errors.
The incremental correction is accepted for publication. Full animation quality remains unaccepted.

Improve continuous push-off, upper-body movement, and weapon-specific weight transfer next.
