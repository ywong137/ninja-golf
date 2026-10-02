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
The incremental correction is published as `81b07de`. GitHub Pages deployment succeeded.
The public bundle matches the tested build, and the muted public gameplay smoke passes without browser errors.
Full animation quality remains unaccepted.

Improve continuous push-off, upper-body movement, and weapon-specific weight transfer next.

## Unpublished push-off study

The next study found two shared problems in the native sprint.
The pelvis rises during support and falls toward landing. The supporting foot also stays too close to the hip during heel rise.
Increasing heel rise alone worsens knee compression. The first candidate therefore remains rejected.

The revised authoring tool couples support placement, heel rise, and the pelvis height curve.
It scales the reference displacement by each skeleton's leg length. It contains no character-specific pose angles.
The bake preserves the model buffers, hands, upper-body rotations, and all 36 other animation clips.
The fit retains the reference height curve when reach permits. The original constant-target fit produces identical results in a controlled comparison.

A native heel rise also needs a different contact measurement.
The new check measures the rendered toe while the ankle moves around it. It still detects a sliding toe.
Four contact tests and four offline fit tests pass.

Candidate `v4-sprint` passes the joint and contact limits in all 108 running scenarios.
The maximum measured support drift is 25.91 mm, within the existing 35 mm limit.
However, its full regression fails the sampling-convergence check for Shinobi, Kaede, and Sora.
The calf rotation and knee-position measurements do not yet converge within the existing 15% tolerance.
The candidate therefore remains unpublished. Its passing anatomy limits do not establish motion quality.

Current public and local preview models still match release `81b07de`.
Evidence and candidate models are in `artifacts/reviews/running-push-off/`.
`v4-summary.json` separates joint/contact results from the failed continuity checks.
`model-preservation.json` records asset preservation and verifies the unchanged public models.

Opus 5.5 High inspected the published Ronin sheet and all six candidate sheets.
It confirmed stronger toe push-off and corrected pelvis timing. It also identified missing forward reach at landing and increased late-stance compression.
The candidate fits its displacement to release alone. That shifts landing backward by the same amount.
Its foot contact, height blend, and heel rotation also use different release windows.
These overlapping windows constrain pelvis rise after the intended liftoff.

The existing support measurement covers phases 0.04–0.24. It does not establish contact stability through the final push at 0.24–0.28.
The next correction must define one contact schedule and validate the complete loaded interval.
Fit landing and release together before replacing the support trajectory.
The forward lean and rigid weapon arm remain separate full-body issues.
See `artifacts/reviews/running-push-off/opus-v4-review.md` for the independent review.

### Shared sprint candidate v7d

The next candidate preserves forward landing and computes stride length from both landing and release.
One contact schedule now governs heel contact, a flat sole, toe push-off, and release.
The pelvis fit uses loaded support only. The free-foot fit respects limb reach and actual shoe clearance.
All six bodies use the same construction, scaled to their calibrated leg lengths and shoe contact points.
Only `Sprint_Forward` changes. The model geometry, upper-body rotations, hands, and other 36 clips remain unchanged.

All 108 running cases pass, including the previous sampling-convergence failures on Shinobi, Kaede, and Sora.
The contact measurement now includes the complete loaded interval through release, rather than excluding the final push.
Fourteen focused contact, trajectory, and offline fitting tests pass.
The ordinary-run combat matrix also passes all 2,130 cases. Those cases do not exercise the revised sprint clip.

Opus 5.5 High read the published Ronin sheet and all six new candidate sheets.
It confirmed restored forward landing and stronger toe push-off across the roster.
It recommended gameplay testing, without publication yet.
Mid-stance crouching, sustained torso lean, and stiff weapon carry remain visible.
Ordinary running still uses a different contact schedule; its transition to sprint needs continuous review.

The capture tool now supports explicit sprint–attack–sprint sequences and complete candidate-model routing.
It verifies that the actual sprint and selected attack clips appear twice in the recorded sequence.
The first Ronin recording passes without browser errors and retains 24–54 enemies.
It averages 41.97 FPS at 1440×900 with a rendering ratio of 0.75 while recording video.
This adaptive-resolution recording does not replace a controlled performance benchmark or visual acceptance of every body.
Audio remains muted. The candidate remains unpublished; public models still use release `81b07de`.

Evidence in `artifacts/reviews/running-push-off/`:

- `v7d-roster-regression.json` and `.log`: all running cases, continuity samples, and source controls.
- `v7d-combat-regression.json` and `.log`: ordinary-run combat checks.
- `v7d-roster-flat/`: all six runtime review sheets.
- `opus-v7d-review.md`: independent visual review; the result metadata confirms `claude-opus-5-5`.
- `v7d-ronin-sprint-combat.webm` and `.json`: silent gameplay and verified clip intervals.

### Captured torso candidate v8d

The shared bake transfers CMU 09_01 pelvis, torso, and head rotations to both forward run clips on all six heroes.
It preserves the native arm and finger tracks, chest-relative grips, and previous foot targets.
The neck remains in its native shoulder frame because the imported clavicles attach beneath it.
The new runtime carry follows the captured torso frame. Its arm counter-swing remains authored.

Authoring and terrain now share the same 0.985 extension reserve.
An earlier mismatch caused a knee jump when a tiny sole penetration triggered terrain correction.
Candidate v8d passes all 108 running cases, including continuity, and all 2,130 ordinary-run combat cases.
The maximum support drift is 25.91 mm, below the unchanged 35 mm limit.
Thirty-six focused carry and contact checks also pass.

The silent Ronin sprint/attack recording averages 57.40 FPS with 34–54 enemies at 1440×900 and rendering ratio 1.0.
It verifies two sprint–attack–sprint sequences and records no browser errors.
This video capture does not establish comparative performance or continuous acceptance across the roster.

Opus 5.5 High finds a clear torso improvement across all six heroes.
It identifies the remaining low pelvis and long trailing leg as the largest visible failure.
The torso and feet still come from different motion sources.
The reviewer recommends transferring pelvis height and leg recovery from the same capture.

The broader carry test also exposes an existing Vice President ready-to-run issue.
The unchanged public model fails that check too. Warming the real ready pose removes unrelated bind-pose false positives.
The Vice President's entry wrist and arm-speed checks still require correction.

Evidence: `v8d-run-regression.json`, `v8d-combat-regression.json`, `v8d-unit-checks.log`, `v8d-body-flat/`, and `opus-v8d-review.md`.
The recording and timing report use the `v8d-ronin-sprint-combat.webm` prefix.
These files remain under `artifacts/reviews/running-push-off/`. The public release remains `81b07de`.

### Complete-body candidate v9

The authoring tool now has a `--whole-body` mode. It transfers pelvis height, torso, legs, and recovering feet from CMU 09_01.
It uses one phase map and each target skeleton's bind calibration. Native arm and finger tracks remain intact.
The first complete candidate covers Ronin only. No other hero model or public model has this transfer yet.

The first runtime test exposed a shared knee reversal.
The recovery solver used shoe direction to choose the knee bend. A naturally recovering shoe can point backward.
The captured path now supplies the recorded knee plane to the same recovery solver.
The correction preserves that plane independently of the shoe's pitch.

The new regression exercises all six heroes and all three enemy bodies with the same captured motion.
Its negative control reproduces the old reversal on every rig. The corrected solver passes every rig.
Twenty-four focused knee-plane and carry tests pass. These isolated checks do not establish whole-roster gameplay acceptance.

In the Ronin ordinary-run test, maximum knee-plane speed falls from 363.81 to 17.13 radians per second.
The visible backward-knee branch is removed, but the complete running acceptance test still fails.
The candidate reaches approximately 34 degrees of hip twist and 29 degrees of ankle twist.
The existing limits remain 30 and 18 degrees. Sprint support drift reaches 87 mm; its limit remains 35 mm.
The native stance lasts 0.28 cycles, while the recording's measured right stance lasts approximately 0.205 cycles.
The current phase warp and constant distance clock therefore need a joint contact fit.
The source recording also covers 2.667 metres in 0.733 seconds. Sprint cadence requires continuous review at actual gameplay speed.

The next correction must preserve the complete body's loading and recovery while matching grounded contacts to world travel.
Do not publish this candidate or treat its nine isolated rig passes as integrated acceptance.
The runtime change activates only for clips with `capturedBodyVersion`; existing public clips retain their previous path.

Evidence: `v9-body/ronin.glb`, `v9-author.log`, `v9-pole-flat/ronin.png`, `v9-pole-regression.json`, and `v9-captured-knee-tests.log`.
The rejected first runtime reports are `v9-run-regression.log` and `v9-run-regression.json`.

Opus 5.5 High compares the v8d and v9 runtime sheets and confirms a higher pelvis and clearer heel recovery.
It recommends retaining the complete-capture direction and fixing support drift next.
It also identifies a lingering straight trailing leg, a twisted supporting shoe, and the same measured hip-twist failure.
The reviewer cannot judge continuous motion from these sheets.

The contact fit must constrain the actual loaded sole point to world travel, including toe or heel rotation.
Constraining only the ankle would still allow a rolling sole to slide.
Keep the captured free-leg path and body motion outside the contact transition.
The JSON regression already records all 108 cases before assertions; its terminal log displays only the first failure.
The 58 mm ordinary-run and 87 mm sprint measurements come from separate rows in that same report.
See `opus-v9-review.md` and its result metadata for the independent review.


### Complete-body contact study v10–v14

The shared authoring path now transfers the complete captured run to all six hero skeletons.
Both forward running clips use the same source pelvis, torso, and legs. The native arm and finger tracks remain intact.
The stance fit holds the actual sole contact while matching travel distance to the animation clock.
Authored free-foot recovery removes a duplicate runtime shoe adjustment. Planned turns still receive the required correction.

Candidate v11 passes the joint and contact bounds but fails independent visual review.
Opus 5.5 High identifies an excessive incoming-foot lift near phase 0.90.
The diagnostic trace finds a mismatch between the capture's forefoot landing and the fit's heel-first landing.
The mismatch puts the toe about 27 mm below ground. The periodic clearance fit compensates with up to 202 mm of unwanted lift.

Candidate v13 selects the capture's forefoot contact. The same fit now adds only 5–16 mm of clearance lift on Ronin.
The stance helper retains heel-first contact as its default for existing clips.
A new forefoot regression verifies the fixed toe anchor and heel clearance.
All six full-body models now have the same corrected contact schedule.

Shared runtime changes also remove a binary support-pressure switch and a shoe-heading reversal when the toe passes vertical.
Straight runs now use the existing joint-balancing path. Captured directional blends create explicit contact plans.
The joint solver's former eight search steps quantized the knee correction.
It now resolves the correction to 0.001 degrees. A smooth-trajectory test reproduces the coarse solver's failure and passes the refined solver.

The v14 runtime with v13 models passes joint, contact, and clearance bounds in all 108 running cases.
Maximum hip twist is 29.58 degrees; maximum ankle twist is 17.68 degrees. Maximum support drift is 25.91 mm.
The bounds remain 30 degrees, 18 degrees, and 35 mm respectively.
The complete regression still fails peak-velocity convergence on all six heroes.
A short correction lobe at phase 0.40 increases Ronin's measured calf peak from 12.30 to 14.32 radians per cycle phase.
The corresponding knee-plane peak increases from 11.18 to 13.72 as sampling rises from 240 to 960 samples.
This remaining behavior is shared across the roster. It is not six separate character-specific defects.

Forty focused tests pass. They cover all nine knee rigs, contact trajectories, joint balancing, shoe heading, and torso-relative carry.
The unchanged public models also pass all 108 running checks with the revised runtime.
The production build passes, with the existing large-bundle warning.
All renders and browser checks remain muted. The public release remains `81b07de`.

Evidence under `artifacts/reviews/running-push-off/`:

- `v11-roster-regression.json`, `opus-v11-review.md`: earlier numerical results and the rejected foot lift.
- `v12-diagnostic/ronin.glb.body.json`: actual contact heights at landing.
- `v13-forefoot/`: six complete model candidates and their authoring reports.
- `v14-roster-flat/`: all six runtime review sheets.
- `v14-roster-regression.json`: all 108 cases, continuity results, and source controls.
- `v14-public-model-regression.json`: passing control using the unchanged public models.
- `v14-shared-tests.log`, `v14-convergence-negative.log`: focused passes and the reproduced coarse-solver defect.
- `v14-stage-trace.json`: source, terrain, and final joint-correction samples.
- `v14-build.log`: production build result.

Do not publish these candidate models until continuous motion and combat transitions pass review.
A passing contact or scalar joint limit cannot establish natural choreography.


Opus 5.5 High confirms that the forefoot correction removes the visible incoming-foot lift on Ronin.
It finds no new major anatomical failure in that sheet. The straight trailing leg still needs continuous review.
The model metadata confirms `claude-opus-5-5`; the review uses `opus-v13-result.json` and `opus-v13-review.md`.

The reviewer identifies the phase-0.40 correction as sharp but continuous.
A finer trace at 3,840 samples confirms the calf peak remains approximately 14.32 radians per phase.
The 240-sample check averages across this short event. No acceptance threshold has changed.
The next motion improvement should fit the knee-plane correction into the authored cycle.
A periodic constrained curve can prepare the correction before the joint reaches its limit, while keeping the exact foot target.
The same authored fit must serve every rig through its own bind calibration.
The current scalar bounds are project regression criteria; they do not independently establish natural human motion.

The full v14 combat matrix finds two failures among 2,130 cases.
Both concern loaded-ankle twist after a heavy slam returns to downhill running, on Ronin and Shinobi.
Both hit the same arbitrary 24-degree knee-correction search edge while an improving solution remains nearby.
The v15 solver continues that local search to a maximum of 32 degrees without changing the anatomical bounds.
The focused pair now passes. Maximum loaded-ankle twist falls from 21.03 to 17.76 degrees.
A new supporting-shoe regression checks this case, including exact shoe retention and a forward hinge.
All thirteen joint-balancing tests pass. The old coarse-search negative control still fails the smooth-trajectory test.
See `v14-combat-failures.json`, `v14-combat-trace.json`, `v15-combat-focused.json`, and `v15-balance-tests.log`.


The complete v15 combat rerun passes all 2,130 cases across the six candidate heroes.
Forty-one focused checks, 48 public-model turning cases, and the unchanged public roster's 108 running cases also pass.
The production build passes with the existing bundle-size warning.
A silent live-gameplay recording verifies two complete Ronin sprint–heavy attack–sprint sequences.
It averages 58.41 FPS with 24–54 enemies at 1440×900 and rendering ratio 1.0, with no browser errors.
This short recording is not a controlled benchmark or visual approval of every animation.
Evidence: `v15-combat-regression.json`, `v15-shared-tests.log`, `v15-turn-anatomy.log`, `v15-public-model-regression.json`, and `v15-build.log`.
The video and timing report use the prefix `v15-ronin-sprint-combat.webm`.

The candidate remains unpublished. The short free-leg correction still needs an authored smoothing pass and continuous visual review.
Broader release work remains: all weapon families, complete golf swings, all 36 fairway rounds, and integrated art and performance acceptance.


## Periodic joint correction (v18)

The forward run and sprint now use one captured body cycle across all six heroes.
The offline fit calibrates each rig's axes and limb lengths. It preserves shoe positions, shoe rotations, and the knee hinge.
A periodic cubic spline smooths the knee-plane correction before runtime playback.
The previous sharp correction now begins before the source hip reaches its limit.
The left leg already meets the source bounds; its fitted correction is zero.
The bake still evaluates both legs to verify contact and hinge accuracy.

Only the forward run and sprint change. The binary geometry, textures, and 35 other animations remain intact.
The original binary payload and unrelated animation descriptors pass exact preservation checks.
Native hand and arm channels remain intact during the body transfer.
The runtime carries the weapon in the moving chest frame and retains the existing grip correction.
No extra temporal filter runs during gameplay.

Validation on the candidate:

- All 108 running cases pass, including the original 240/960-sample continuity criteria.
- All 2,130 combat and transition cases pass.
- Fourteen focused tests pass across nine rigs and the offline periodic fit.
- Maximum knee hinge deviation: 0.00265 degrees during running.
- Maximum runtime hip twist: 26.98 degrees. Maximum ankle twist: 17.514 degrees.
- Authored foot-position error: below 0.0000001 m. Authored shoe-angle error: below 0.00000006 radians.
- Dense moving combat: 51.27 FPS, 64 enemies, 1440×900, rendering ratio 1.0, M1 Max.
- Audio remained muted during all browser checks.

Opus 5.5 High reviewed all six runtime sheets, the shared fit, and the numerical reports.
The returned model identifier was `claude-opus-5-5`.
It found no visible regression against the published Ronin run and supported an incremental release after integration checks.
It flagged upright sprint posture, low recovering toes, free-arm movement, and possible glaive intersections for continuous review.
Still images cannot establish full-motion quality.

Two measurements raised by the review have specific contexts.
The 17.514-degree ankle result occurs during Kaede's uphill sprint at 40 Hz.
The authored limit is 17 degrees; the runtime terrain correction prefers 17.5 degrees, with the existing test bound below 18 degrees.
The largest measured support drift, 25.91 mm, occurs during Ronin's focused left strafe, using the existing lateral animation.
It is not the captured forward-running contact error. It remains below the unchanged 35 mm test bound and needs visual improvement.

Evidence remains in `artifacts/reviews/running-push-off/`: `v18-roster-regression.json`, `v18-combat-regression.json`,
`v18-fit-tests.log`, `v18-benchmark.json`, `v18-review-data.json`, `v18-roster-flat/`, and `opus-v18-review.md`.
These local review artifacts do not ship with the game.


## Full integration findings and v21 follow-up

The v18 integration failed gates that the initial candidate checks did not cover.
The release remains unpublished. The public game still uses `81b07de`.

- The existing native test requires ankle twist below 15 degrees. V18 exceeded that limit.
- A loaded running knee crossed 38.7 mm inside the shoe plane. The existing limit is 20 mm.
- A near-zero captured weight selected a different knee solver during a sideways-to-backward turn.
- A recovering shoe could reverse the legacy turn solver's preferred knee direction.
- Captured hip motion contained a brief rotation peak. The original 240/480 Hz turn continuity check exposed it.
- Six preview hashes need rebaking after the model assets change.
- Six old recovery tests assumed the released model retained a folded ankle. They now construct the defect explicitly.

V21 addresses these findings through shared rules:

1. The calibrated thigh frame determines the ordinary knee direction. Shoe pitch cannot reverse it.
2. Captured knee influence follows the actual animation weight, including weights close to zero.
3. A turn preserves the displayed knee plane at entry, then blends it over 160 ms while retaining the shoe target.
4. A periodic five-frame binomial filter removes capture noise before retargeting and contact fitting.
5. The offline fit requires ankle twist below 14.5 degrees and loaded medial knee displacement below 19 mm.

The filter preserves each channel's mean and range. Positive coefficients cannot create a reversed source knee.
The fit preserves exact shoes and the calibrated hinge. No native anatomy threshold was relaxed.
The unchanged native Ronin test passes all 23 clip cases, with maximum running medial distance 18.59 mm.
Ronin's original 16 turn continuity cases also pass. The earlier revised runtime passes all 48 turn anatomy cases.
Twenty-four focused recovery and pole tests pass. Fourteen offline joint-fit tests pass.
The complete six-model v21 integration and independent review remain pending.

These findings supersede the earlier v18 release recommendation. Forward-running and combat checks alone did not establish integration readiness.


## Integrated captured running (v22)

V21 passed the full combat matrix, but six running cases exceeded the existing free-ankle limit.
The periodic fit now constrains that rotation during recovery before runtime playback.
A shared world-rotation correction also preserves shoe direction on imported rigs with nonuniform bone scales.
The original support test tolerance remains unchanged.
The quadratic fit now uses a Cholesky coordinate transform for numerical stability, with the same objective and constraints.

The complete integrated candidate passes:

- 870 unit and asset tests, including nine-rig recovery controls.
- 108 running cases, including slopes, multiple frame rates, and dense continuity checks.
- 16 turn-continuity cases and 48 turn-anatomy cases.
- 2,130 combat and transition cases across six heroes.
- 24 pose interruptions, 42 actual-controller interruptions, and 90 running exits.
- 150 golf phases, 108 golf leg-frame cases, and all six selection loops.
- Ten selection layouts, all four course-selection layouts, and the production build.

The running matrix records maximum hip twist of 23.94 degrees and knee hinge deviation of 0.00265 degrees.
Maximum free-ankle off-pitch rotation falls to 13.325 degrees, below the unchanged 15-degree limit.
The largest support drift is 25.91 mm in a lateral native clip, below the unchanged 35 mm limit.
These project criteria detect regressions. They do not certify natural human performance.

Each asset preserves its complete original binary payload and 35 unrelated animation descriptors.
Only Run_Forward and Sprint_Forward change. Geometry, textures, golf, and combat clips remain intact.
Six matched runtime sheets show front and side views through the same shared sprint cycle.
Two-weapon carry remains restrained, and sprint posture remains relatively upright.
Continuous gameplay and independent visual review remain required before publication.

### Independent code-review follow-up

Opus 5.5 High reviewed the integration through the authorized Claude subscription.
The returned model identifier was `claude-opus-5-5`.
Captured influence now divides by total running weight. Near-zero influence cannot select a different anatomical branch.
Shared pole interpolation handles opposing directions continuously. Turn entry uses the final displayed knees after terrain correction.
Recovery tests now exercise both the neutral and captured branches, with explicit malformed-ankle controls.

The source rotation peak was not an Euler wrap.
Adjacent capture frames changed root yaw from -3.05595 to +0.549712 degrees at 120 Hz.
The periodic five-frame filter reduces this sharp source change before retargeting and contact fitting.
Its positive coefficients preserve the mean and prevent overshoot; they can reduce extrema.
Contact trajectories are fitted from the filtered capture, rather than copied from an earlier fit.
No runtime temporal filter adds latency to player input.

Evidence is under `artifacts/reviews/running-push-off/`.
The `release-*-v22` reports describe the isolated release checkout and its exact model assets.
`release-preservation-v22.json` records asset preservation. `v22-roster-flat/` contains the six visual sheets.
Browser audio remains muted throughout verification.


### Final visual review of v22

Opus 5.5 High compared all six v22 sheets with the earlier v18 review and three v18 sheets.
It found no new backward knee, incorrect ankle direction, or visibly worse body movement at sheet resolution.
It recommended an incremental release after the remaining gameplay and performance checks.
The straight, flat sheets demonstrate no visible regression; they do not demonstrate the turn and slope corrections.
Those corrections have separate runtime measurements.

The reviewer retained specific visual concerns: low swing toes, a high free fist, and possible projected weapon overlap.
Close knee tracks on two female models also need three-quarter motion review.
The review does not establish AAA quality or approve complete rounds.
The result is recorded in `opus-v22-review.md`; its model metadata confirms `claude-opus-5-5`.


### Gameplay and performance checks

All six heroes complete the recorded sprint–attack–sprint–attack–sprint sequence without browser errors.
The ten-second recordings retain 24–54 enemies, except Sora, whose minimum is 34.
At 1440×900 and rendering ratio 1.0, the recorded frame rates range from 57.81 to 59.46 FPS.
Sampled chronological frames show running and attack recovery in the actual course scene.
The recordings verify clip transitions; sampled frames do not establish complete visual acceptance.

The controlled moving-combat benchmark retains 64 enemies and averages 51.23 FPS.
It uses Chrome's Metal renderer on the Apple M1 Max, Balanced settings, 1440×900, and rendering ratio 1.0.
The 95th-percentile frame interval is 33.4 ms. Contact shading is disabled at this crowd size.
The earlier published build measured 51.18 FPS in the same scenario; this difference does not establish a performance improvement.
The production bundle remains large: 13.93 MB of JavaScript, or 4.10 MB with gzip.
Vite reports the existing chunk-size warning. The build succeeds.

The six recordings use the prefix `v22-hero-` and include JSON timing reports.
`v22-benchmark.json` records the controlled measurement. All audio remains muted.


### Existing arm-entry failure

The expanded arm-carry check starts from the actual ready pose, rather than the bind pose.
It reports six Vice President cases above the 20-degree wrist criterion during entry.
The wrist reaches 23.58 degrees. Its settled weapon hand remains neutral.
One left-strafe entry also exceeds the 15-degree-per-120-Hz-frame rotation criterion, reaching 17.90 degrees.
The earlier baseline report contains the same wrist values and left-strafe peak.
The candidate improves the forward and turning entry peaks, but does not correct this existing defect.
The test remains strict and continues to report the failure.
This result limits the release claim: the running update does not complete arm-transition acceptance.


A fresh control serves the exact `81b07de` source modules and six models into the same browser test.
All seven reported threshold violations match existing public values across the six Vice President cases.
No newly failing arm limit appears in the candidate. The wrist results match exactly.
The left-strafe rotation peak differs by less than 0.00000001 degrees per measured frame.
`current-public-carry-control.json` and `release-carry-comparison-v22.json` record the comparison.

The actual gameplay smoke test passes golf, club changes, combat, pause, and resume without browser errors.
The scoped running release proceeds with the existing arm-entry failure recorded above.
It does not claim complete animation acceptance, complete-round QA, or AAA presentation.
