# Production quality targets

## Current readiness — October 3, 2026

The game remains a playable alpha. It does not yet meet the requested AAA presentation or animation standard.
All six approved outfit defaults are live. The concept references remain archived for future unlockable outfits.

The release checkout now has complete source performances for every hero's opening light and heavy attack.
The Shinobi heavy attack is live and verified. The Hustler heavy attack has passed local checks and awaits deployment.
Their checks cover full-body movement, anatomical limbs, attached weapons, cutting direction, hit timing, and recovery.
The Hustler reuses an accepted body performance with her own rig and sabre.
This avoids rebuilding common human movement separately for each character.

Remaining release work includes:

- Replace weak later attack branches and musou sequences with complete, connected body performances.
- Refine the first 3D outfit implementations toward the approved concept silhouettes and materials.
- Play complete rounds across all four courses, including combat, penalties, and scorecards.
- Verify rendering performance on the same integrated build used for visual acceptance.

The current 64-enemy moving-combat stress test averaged 32.3 FPS at 1440×900 on this M1 Max.
Balanced mode reduced the render ratio to 0.75. This result misses the user's 40–50 FPS target.
It is a local stress measurement, not a universal frame-rate estimate.
A second test with loaded assets and fixed resolution measured 32.4 FPS.
The CPU profile points mainly to rendering and scene transforms. Performance work remains separate from the attack changes.

The older experiment reports below remain historical evidence. They do not describe the current release's exact behavior.

## Historical readiness — October 2, 2026

The game is a playable alpha. It does not yet meet the requested AAA presentation or animation standard.
Feature coverage does not establish release quality. The historical checks below describe earlier builds.

The captured forward-running candidate now passes full integration across all six heroes.
One shared transfer fits recorded pelvis and leg motion to each body's calibrated skeleton.
It preserves native hands, weapon carry, mesh data, textures, and 35 unrelated animations per hero.
The shared recovery correction also passes defect controls on all three enemy bodies.

Candidate v22 passes all 870 unit and asset tests, 108 running cases, and 2,130 combat-transition cases.
It also passes 16 turn-continuity cases, 48 turn-anatomy cases, 90 running exits, and 42 actual-controller interruption cases.
Golf motion, golf leg frames, character selection, and the production build pass.
The original regression limits remain unchanged. Six runtime sheets show consistent running without the former sustained crouch.
Opus 5.5 High found no visible backward knee or new ankle error in the six runtime sheets.
All six recorded sprint–attack–sprint sequences pass, averaging 57.81–59.46 FPS with 24–54 enemies.
Dense moving combat averages 51.23 FPS with 64 enemies at 1440×900 on this M1 Max.
The expanded arm-entry check still fails six Vice President cases already present in `81b07de`.
A fresh comparison against that published code and its assets confirms no new arm-limit failures.
The scoped running update is ready for publication with that existing arm-transition defect documented.
See [the integrated running review](reviews/shared-posture.md#integrated-captured-running-v22) for scope and evidence.

| Area | Current state | Remaining acceptance work |
| --- | --- | --- |
| Core game and content | Golf/combat loop, six heroes, four nine-hole courses, and sixteen licensed music recordings exist. | Complete a fresh playthrough and regression pass after the animation changes. |
| Shared human movement | The published posture and contact corrections pass the complete six-hero combat, running, turn, and interruption checks. Shared terrain tests also cover three enemy bodies. | Improve push-off, arm drive, and full-body weight transfer. |
| Running controller | The published native controller passes 108 running cases, 48 turns, and 90 running exits. Experimental recorded starts and stops remain separate candidates. | Review continuous movement and contact transitions during complete encounters. |
| Golf and combat animation | Individual improvements exist, but coordinated motion and transitions remain release blockers. | Accept complete swings and weapon families in motion, with stable grips and convincing weight transfer. |
| Art and presentation | Textured humans and scanned scenery improve the baseline. AAA visual parity remains unmet. | Review characters, environments, effects, and menus together at gameplay distance. |
| Performance and stability | The published release passes 837 unit/asset tests and public gameplay smoke. Dense moving combat averages 51.18 FPS with 64 enemies at 1440×900 on this M1 Max. All 36 controlled cup tests pass. | Review full rounds through fairway encounters and measure other devices. |

The integrated shared posture candidate passes 54 native clip audits and 2,130 combat cases across six heroes.
It also passes 837 unit and asset tests, 108 running cases, 48 turns, and 42 controller interruption cases.
Shared corrections now limit pelvic twist, preserve airborne leg shape on slopes, and prevent premature foot release.
Opus 5.5 High found no backward knees in 72 review panels across the roster.
Continuous motion still needs better push-off and upper-body movement. Golf and preview checks pass.
Dense moving combat averages 51.18 FPS with 64 enemies at 1440×900 on this M1 Max.
All 36 controlled cup tests and four course scorecards pass.
Commit `81b07de` is live. GitHub Pages deployment and the muted public golf/combat smoke test pass.
The verified public bundle is `assets/index-ChkIYKyf.js`. The local preview uses the same six models.
See [the current shared posture review](reviews/shared-posture.md) for results and remaining work.
Numerical anatomy checks cannot establish natural motion by themselves.
The subsequent sprint candidate uses one shared bake across six bodies. Candidate v7d passes all 108 running scenarios, including continuity checks.
Its 2,130 ordinary-run combat cases also pass. A separate Ronin sprint–attack–sprint gameplay recording passes with muted audio.
Opus 5.5 High confirms a shared lower-body improvement but still identifies crouching, excessive torso lean, and stiff weapon carry.
The candidate remains unpublished. The [push-off study](reviews/shared-posture.md#unpublished-push-off-study) records the evidence and remaining work.

The next release requires continuous visual acceptance across all six heroes and three enemy bodies.
That includes starts, stops, turns, slopes, complete golf swings, and attacks with each weapon family.
After that, play every course through fairway encounters and scorecards. Controlled cup tests cannot replace those rounds.
Presentation and performance acceptance must use the same integrated build. The existing feature list is not a completion percentage.
The earlier shared pose-blending correction was published as `8297bd3` in a separate release checkout.
It covers every hero's guard, running, and attack transitions without shipping the unfinished recorded-motion controller.
That release passes 603 unit and asset tests, focused browser regressions, and gameplay smoke testing.
GitHub Pages deployment succeeded. The public golf-and-combat smoke check also passed with no browser errors and muted audio.
Its moving-combat benchmark averages 47.94 FPS with 64 enemies at 1440×900 on this M1 Max.
See [the scoped release record](reviews/shared-pose-transitions.md) for evidence and limits.
The current controller checks measure the actual skinned soles and retain separate measurements for the contact anchors.
Neither result substitutes for continuous visual review or complete-game performance measurements.

A separate recorded-motion experiment concerns candidate v144. Its backward cycle remains an unaccepted, reversed forward recording.
Opus 5.5 High identified braking timing, interrupted acceleration, and toe-contact errors in the shared system.
Interrupted input changes now preserve current velocity. Turns limit hip rotation when the supporting foot is too far behind.
The pelvis recovery limit now also applies after running stops.
These corrections pass shared rig checks, but the candidate still has failing turn criteria and lacks continuous visual acceptance.
See [the current backward-motion review](reviews/backward-motion-study.md#october-2-shared-controller-review) for results and unresolved work.

The latest contact follow-up tracks shoe bending through the actual skin weights on all nine body rigs.
The local Ronin controller passes 52 focused cases and 24 starts; 11 of 32 turn cases still fail foot-speed criteria.
Turn contact and pivot checks now pass, but the upper body and reversal timing remain visually unaccepted.
Its muted moving-combat benchmark averages 50.76 FPS with 64 enemies at 1440×900 on this M1 Max.
Five existing golf-arm review failures also remain in the broader unit selection.
See [the articulated sole follow-up](reviews/backward-motion-study.md#october-2-articulated-sole-follow-up) for scope and evidence.

The subsequent shared controller correction preserves horizontal momentum during flight and selects reversal support from the requested travel direction.
It also fixes a toe-off interval wrapping into another stride and foot velocity amplification during acceleration.
Current checks pass 94 shared unit tests, 52 focused scenarios, and 24 recorded-start scenarios.
The broader stride-phase set has two touchdown failures; the recorded-turn set retains eleven source-entry speed failures.
Its muted dense-combat benchmark averages 51.38 FPS under the same local configuration.
Rigid upper-body motion, weak weight transfer, and the unaccepted backward source still prevent visual acceptance.
See [contact-dependent braking and velocity continuity](reviews/backward-motion-study.md#contact-dependent-braking-and-velocity-continuity) for evidence and limits.

The new forward-stop study transfers CMU 143_02 to all six heroes and three enemy bodies, including a mirrored lead-foot version.
All eighteen fitted transfers pass sole-contact and joint checks with the same solver.
Opus 5.5 High identified the source as a two-foot running stop, unsuitable for walking, backward travel, or reversals.
The local Ronin controller now executes both stop variants and supports movement, attack, and guard interruptions.
The body begins recovery during the landing, with a closed two-hand grip. The latest candidate retains its widened landing without extra stance steps.
It preserves flat-foot contacts and separate toe pivots through later attacks. A canceled airborne pose completes its landing before gaining support.
Shared transfer checks cover all nine body rigs. Gameplay coverage remains limited to the Ronin candidate.
Its planted-combat benchmark averages 55.8 FPS with 64 enemies at 1440×900 on this M1 Max, using a 0.95 rendering ratio.
Rigid upper-body carry, quiet idle motion, and abrupt attack recovery still prevent visual acceptance.
Other bodies retain isolated transfer coverage; the new controller has not entered their gameplay or the public release.
See [the recorded-stop study](reviews/recorded-running-stop.md) for evidence and scope.

The subsequent heavy-attack pass extends preparation and recovery while preserving the fast cut and complete hand grip.
Combat and character selection now share explicit motion timing. All six previews pass normal and slow playback checks.
The local Ronin candidate passes 36 stop/attack/guard scenarios through complete recovery and the native arm/skin/grip check.
Opus 5.5 High finds the timing clearer, but full-body visual acceptance remains incomplete.
A separate hip-lead experiment passes technical checks without a clear visual improvement; it is not the active candidate.
See [heavy attack timing](reviews/heavy-attack-timing.md) for the active candidate, results, and scope.

The next shared-leg audit found an integration error: joint balancing depended on the experimental paired-weapon running setup.
Ordinary directional runs also skipped balancing because their planner had no terrain callback.
Every native hero now creates the same anatomical correction, independently of its weapon. The actor supplies terrain for both running paths.
All 48 running-turn cases pass. Each case now checks that the correction actually runs during the turn.
The full 1,650-case combat-transition matrix falls from 101 failures to 21, with no newly failing cases.
Ten excessive ankle-twist cases and eleven abrupt foot-movement cases remain. The matrix therefore still fails overall.
Twenty-seven focused joint and contact tests pass, including isolated contact transfers on all nine body rigs. The production build also passes.
This correction remains local. Continuous visual acceptance, full gameplay integration, and a new performance check remain required.
See [the shared leg rollout](reviews/shared-leg-rollout.md) for exact scope and evidence.

The shared recovery follow-up now passes all 1,650 non-Ronin combat cases and 360 Ronin cases.
The correction gives ordinary runs the same controlled sole pivot and calibrated joint bounds.
An Opus 5.5 High review found a repeated floor offset and a skipped leg-lane constraint. Both defects now have corrections.
The isolated release passes 631 unit and asset tests, 108 running cases, 48 turns, 16 continuity cases, and 90 running-exit cases.
Golf, combat, and pause/resume pass the browser smoke test. The isolated release averages 52.6 FPS with 64 enemies at 1440×900.
Opus confirmed the pivot corrections. Existing attack-to-run support sliding remains open.
Commit `3ce0fe4` is published. The public bundle matches the tested release, and the muted public gameplay smoke test passes.
Backward stride shape, abrupt movement-speed changes, and weak attack body mechanics remain open work.

The subsequent local handoff correction preserves actual foot contacts through moving attacks, running, stops, and guard interruptions.
It now passes one shared 2,130-case combat-transition matrix across all six heroes and 42 actual-controller interruption cases.
The existing 108 running cases, 48 turning cases, and 87 focused unit and rig tests also pass.
Its muted moving-combat benchmark averages 52.66 FPS with 64 enemies at 1440×900 on this M1 Max.
Opus 5.5 High still identifies sustained crouching and weak torso coordination in sampled views.
New measurements locate most of the crouch in the authored source poses, rather than additional runtime pelvis lowering.
The candidate remains local pending source-posture work, continuous visual acceptance, and release integration.
See [the shared foot handoff review](reviews/shared-foot-handoff.md) for evidence and the next correction.

### Earlier movement experiments

The latest shared step planner also passes half-turn checks on all six heroes and three enemy rigs.
These checks do not enable that controller throughout the roster.
Independent review finds better reversal contacts, but the three-step turn still looks upright and mechanical.
Early attack interruptions now preserve movement velocity and both hand attachments through overlapping animation fades.
The latest recovery correction reduces the largest unreachable airborne-foot target from about 223 mm to 71 mm.
The tests report this distance but do not yet cap it. It remains a concern despite passing other anatomy and contact checks.
Recovery now releases an overstretched support earlier and removes the outgoing foot displacement during the rising half of the swing.
Recorded sequence exits retain their measured support timing. This prevents a frame-rate regression from the adaptive takeoff correction.
The latest runtime passes 84 relevant unit and rig checks and the production build.

The turn now continues into a recorded push from its existing bent-knee pose.
It no longer stands up before repeating the source animation's preparation.
The same clock accelerates both body movement and animation from rest.
Late direction changes and aiming changes now use actual braking contacts before turning.
Attacks retain those contacts even when the hand transition remains unfinished.
A shared blend function preserves the complete animation mixture through interrupted transitions.
The additional 72 late-interruption cases cover stopping, attacks, redirection, aiming, and sprinting during the recorded push.
These corrections remain in the local candidate. They do not establish complete motion acceptance or production readiness.

### Shared correction policy

Apply common anatomical rules before weapon-specific motion design:

1. Calibrate joint axes and limb lengths from each rig's native skeleton.
2. Preserve knee and elbow bend direction independently of hand or foot orientation.
3. Preserve foot contact and hand attachment through animation changes.
4. Test the same correction across all affected rigs and intermediate frames.
5. Inspect complete movements and gameplay interruptions before accepting the result.

Different body proportions require calibration. They do not require unrelated anatomy solvers for each character.
Weapon families still require distinct grips, reach, timing, and coordinated body movement.
Recorded human motion supplies the running reference. Joint limits alone cannot supply convincing performance.

The next release checks must cover complete movement, not more isolated character poses:

1. Accept one complete reference sequence: start, run, turn, stop, attack, recover, and golf swing.
2. Apply the shared corrections across the roster, then inspect complete sequences with each weapon family.
3. Complete all 36 holes and repeat dense-combat performance, menu, audio, and save checks on that integrated build.

These are acceptance steps, not a completion percentage or delivery estimate.
The October 1 contact-timed turn experiment passed numerical checks but failed independent visual review. It does not enter the runtime.

See [the current locomotion record](native-locomotion.md#recorded-start-controller-integration) for the candidate, checks, and unresolved failures.

Reference: Dan Greenheck's [prompt thread](https://x.com/dangreenheck/status/2102911556296052788), [demonstration](https://x.com/dangreenheck/status/2102878170089169235), and [Tidewater source](https://github.com/dgreenheck/tidewater).

The reference asks for repeated, multi-view inspection, believable materials and motion, environmental life, coherent effects, and steady performance. Its ocean features are examples of that standard. Ninja Golf must apply that standard to golf and crowd combat.

## Acceptance gates

- Art: natural tree crowns and branches, varied ground coverage, readable grass cuts, grounded buildings, weathered surfaces, reflective water, coherent daylight.
- Characters: visible faces, correct blade silhouettes, stable grips, grounded feet, coordinated core movement, distinct enemy silhouettes.
- Golf: clear shot planning, useful putting information, controlled swing timing, readable ball flight, informative shot results.
- Combat: readable threats, spacing around the player, impact feedback, distinct enemy counters, reliable movement and camera controls.
- Presentation: legible HUD at 1280×720 and 1440×900, unobstructed hero selection, smooth transitions, useful settings and tutorials.
- Audio: licensed recordings for environment and movement, clear attack feedback, controlled music transitions, silent automated testing.
- Performance: target at least 40–50 FPS during dense combat on the current M1 Max. Measure resolution and graphics settings explicitly.
- Stability: complete all 36 holes across four nine-hole courses, revisit menus, change characters, pause/resume, mute/unmute, and recover saved progress without errors.

## Inspection procedure

Capture title, selection, tee, fairway, tree interior, shoreline, green, melee crowd, heavy attack, Musou, and scorecard views. Inspect still frames and movement. Check GPU cost after each major rendering change. Preserve before/after screenshots outside the shipping build.

## Earlier baseline

Baseline: 94baeb3. Active combat averaged 46 FPS at 1440×900, Balanced, DPR 1, with 64 enemies. Main visual shortcomings: sparse angular crowns, flat water, coarse course boundaries, plain architecture, repetitive cloth folds, and weak material variation. Gameplay shortcomings: crowd compression, limited shot planning, weak impact response, and little encounter pacing.

## Earlier production pass

- Four tree assets with bark maps, leaf cards, wind, and eight-angle distant views. Dithered transitions reduce visible changes between tree representations.
- Analytic fairway cuts, collars, sand edges, and mowing stripes. Denser geometry follows shorelines, bunkers, and greens.
- Reflected pond scenery, layered ripples, Fresnel response, depth color, and shoreline foam. Inland hollows no longer expose the ocean plane.
- Curved temple roofs, roof tile detail, lattice panels, galleries, rafters, stone stairs, and a curved torii. Temple placement avoids the pond and trees.
- Grounded garden props, shoreline rocks, wind-blown grass, and coastal birds.
- Smoother hero faces, less repetitive sleeve folds, slimmer scout clothing, fitted hat details, and material variation on cloth, leather, and metal.
- Limited simultaneous enemy attacks, approach spacing, directional ground warnings, blade ribbons, impact pauses, guard-break feedback, and rewarded dodges.
- Aerial shot survey, wind-aware landing estimates, putting slope markers, shot results, and an unobstructed swing view.
- Recorded environmental and movement sounds. Cross-tab audio ownership prevents a second delayed soundtrack.
- Camera collision, adjustable sensitivity, inverted vertical look, reduced camera effects, and adaptive resolution in Balanced mode.
- Shipping 2K textures retain their dimensions with optimized JPEG encoding. This removes about 9.7 MB of downloads.

That release used Quaternius-derived bodies. The current release replaces those bodies with licensed textured Rocketbox humans. Facial expression and cloth simulation remain simpler than current AAA systems. The golf simulation does not model every aerodynamic or turf interaction.

## Previous release verification

Chrome on Apple M1 Max, Metal renderer, Balanced settings, 1440×900 CSS pixels. Each performance run holds 64 active enemies and repeatedly attacks for ten seconds after warmup. These are local measurements, not guarantees for other devices.

| Display | Rendering ratio | Average FPS | 95th-percentile frame time |
|---|---:|---:|---:|
| Standard display | 1.0 | 46.7 | 33.4 ms |
| Retina display, DPR 2 | 1.2 after adaptation | 47.6 | 33.4 ms |

The standard-display runs varied from 46.7 to 49.8 FPS with different crowd and attack timings. The HUD keeps the display's full resolution.

- All 30 unit and asset checks pass.
- The complete browser suite passes: audio transitions, duplicate-tab audio, navigation, combat, golf, penalties, revival, saved progress, and three-hole completion.
- Character checks verify blade silhouettes, rigs, clip coverage, hand grips, and golf contact.
- Visual checks cover title, three character selections, tee, aerial survey, putting, pond, temple, forest, and combat.
- Both 1280×720 and 1440×900 layouts pass. Shader compilation produces no browser errors.
- The production build and whitespace checks pass.

Reproduce with `npm test`, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, and `npm run build`.
Run performance checks with `PLAYWRIGHT_CHANNEL=chrome node tools/benchmark.mjs`, then repeat with `--retina`.
Run the public gameplay smoke check with `GAME_URL=https://ywong137.github.io/ninja-golf/ PLAYWRIGHT_CHANNEL=chrome node tests/browser-smoke.mjs`.
All automated browser runs mute system audio.


## Earlier four-course expansion

The game now has four original nine-hole courses and six heroes. Each course has its own scenery, architecture, lighting, and preview.
Fairway decorations supply visible ambush cover without occupying the central landing corridor.
The title selects a random course. The selection flow chooses a hero before a course.

The three female heroes have independent fan, ring, and sickle weapon families.
They have separate ready stances, eight fast/heavy attacks, and six-cut Musou sequences.
The roster study uses official Samurai Warriors 4 and 5 artwork and descriptions.
The designs and animations remain original adaptations of the shared base rigs.

Grip checks now compare each handle against the actual curled finger joints.
All six heroes have separate faces, hair, and costume shapes.
Combat motion uses stepping turns, coupled pelvis/chest motion, and forward knee flexion.
The longer Musou intro lasts 2.85 seconds, followed by a 3.3-second attack.
Its damage sectors use the headings from the actual animation family.

Enemy damage is half the previous release. Most grunts pause before committing to an attack.
Enemies carry smaller blades and polearms. Musou defeats launch and tumble enemies before the ground impact.
The survey camera supports mouse pan, orbit, and zoom without changing shot aim.
Saved progress includes the selected course, hero, nine-hole scores, and penalty counts.


### Expansion verification

- All 45 unit and asset checks pass.
- Browser checks cover audio, navigation, combat, all 36 cups, penalties, revival, saves, survey controls, and course selection.
- Character checks cover 385 physical hand-grip samples and 100 Musou knee samples for each hero.
- Maximum handle-to-finger-cavity distance is 1.72 cm. Maximum supporting-foot drift during Musou is 1.55 cm.
- Both 1440×900 and 1280×720 layouts pass. Preview lighting keeps faces readable on the night course.
- The production build and whitespace checks pass.

The first dense-crowd measurements missed the target. Profiling found repeated skeleton matrix work and a costly crowd shading pass.
Hand updates now use only the required ancestor chains and cached transforms.
Balanced mode suspends GTAO above 32 enemies and restores it below 24. Dynamic shadows remain active.
High quality retains GTAO. Golf and character selection retain the full contact shading.

Final local measurements use Chrome, Metal, Apple M1 Max, Balanced, 64 active enemies, and repeated attacks.
Each run measures ten seconds after warmup. Other applications were also active.

| Course / display | CSS size | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | --- | ---: | ---: | ---: |
| Crane Coast | 1440×900 | 1.00 | 51.8 | 33.4 ms |
| Heather & Crown | 1440×900 | 1.00 | 54.9 | 33.3 ms |
| Copper Saguaro | 1440×900 | 1.00 | 58.5 | 16.8 ms |
| Neo-Tokyo After Dark | 1440×900 | 1.00 | 58.5 | 16.8 ms |
| Crane Coast, Retina DPR 2 | 1440×900 | 1.05 after adaptation | 46.8 | 33.4 ms |

These earlier results describe this machine and these scenarios. They predate the native human and scanned landscape replacement.


## Native human and landscape replacement

All six heroes and four enemies now use separate Microsoft Rocketbox humans under MIT.
Their source anatomy, skinning, faces, hair, clothing, UV coordinates, and texture maps remain intact.
Native arm and leg solvers transfer the game’s golf and combat trajectories without replacing human proportions.
Heroes retain only their required movement, golf, and weapon clips. Enemies retain thirteen required clips.

The landscape uses CC0 Poly Haven trees, shrubs, ferns, boulders, and cliffs.
Near trees use detailed geometry. Distant trees use eight-angle images. Repeated objects use instancing.
The ground shader preserves scanned grass and sand contrast. A coarse outer landscape removes the visible terrain boundary.
The city uses a licensed night panorama. Limited bloom highlights prevent bright panorama lights from flooding the scene.

All 36 holes have separate authored layouts. These include forks, islands, separated landing pads, elbows, hairpins, and spirals.
Maps, terrain, water masks, bridges, and walking routes share the same geometry data.
Every route passes 801 dry-ground samples from tee to green. Tee and green discs remain dry.

These assets improve human anatomy and natural surface detail. They do not establish parity with modern AAA games.
Buildings and props still use generated geometry. Full facial performance and cloth simulation remain outside this implementation.

### Replacement-pass verification

- All 49 unit and asset checks pass.
- The browser suite passes audio, movement, combat, golf, penalties, revival, saved rounds, and all 36 cups.
- All six selection screens and all four course previews received visual inspection.
- All 385 weapon-grip samples stay within 8.4 mm of the measured finger cavity.
- Native golf contact error stays below 3 micrometres. Lead-foot drift stays below 0.15 mm.
- Musou support-foot drift stays below 3.85 cm. Sampled knees bend forward throughout each sequence.
- The production build and whitespace checks pass.

The geometric measurements validate attachment and contact constraints. They do not measure animation quality by themselves.
Rendered pose checks accompany them.

### Replacement-pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440×900 viewport.
Each run holds 64 enemies alive and repeats attacks for ten seconds after warmup.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 54.1 | 33.3 ms |
| Heather & Crown | 1.00 | 60.0 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.7 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 53.8 | 33.3 ms |

The HUD retains full display resolution. These results describe these local scenarios, not every device or camera position.
Both 1440×900 and 1280×720 visual layouts pass. Automated tests mute system audio.


## Defensive combat and material refinement

Each hero now has a weapon-specific guard, impact response, broken-guard recoil, and four directional guard steps.
Guard faces the camera. It blocks a 130-degree frontal arc and leaves the rear exposed.
A timed press parries one attack, staggers its attacker, and adds ten Resolve.
Guard strength limits continuous blocking. A broken guard permits a dodge or buffers an attack through a short recovery.

Weapons now have sharp bevel normals, mapped steel grain, cord wraps, and brass fittings.
The sickle and ring use curved surfaces. The fan has pleated metal blades.
Grip origins, combat reach, and the smaller enemy weapon sizes remain consistent.

Distant tree images now contain 24 views, including three camera elevations.
Separate surface-normal images let them respond to daylight and night lighting.
Ground silhouettes follow the scanned branches and the same sun direction as nearby shadows.
The renderer changes detail within short distance bands. This reduces visible dithering during movement.


### Refinement verification

- All 61 unit and asset checks pass.
- The complete 15-script browser suite passes, including all 36 cups.
- All six heroes pass guard movement checks in eight directions.
- Support-foot drift stays below 0.6 mm in cardinal directions and 1.9 cm in diagonal blends.
- Guard movement follows actual displacement after collision. A boundary regression verifies the change.
- Keyboard guard uses V; gamepad guard uses LB. Ctrl remains available to the browser.
- B only dodges. Held left-stick click sprints. Keyboard sprint remains Shift.
- All four course previews use the revised lighting and foliage.
- Day, night, aerial, and tree-detail views pass without shader errors.
- The 1280×720 and 1440×900 presentation checks pass with audio muted.

### Refinement performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440×900 viewport.
Each measurement holds 64 enemies alive and repeats attacks for ten seconds after warmup.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 51.8 | 33.4 ms |
| Heather & Crown | 1.00 | 60.1 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.20 | 50.7 | 33.4 ms |

Retina rendering adapts independently of the HUD, which retains full display resolution.
These local measurements do not establish performance on every device or at every camera position.
The environment still needs further art work to meet the full photorealism target.

## Regional terrain and native running pass

The source skin and clothing specular maps now control character roughness.
All ten humans retain their original geometry, skin weights, color maps, normal maps, and hair coverage.
The material capture covers all six heroes under four course lighting themes.

Ordinary movement now uses five native clips with separate support and foot recovery.
Forward, backward, and side movement blend by actual displacement after collision.
Sprint uses its own stride and cadence. Licensed arm and torso motion remains intact.
The 60-case movement check measures up to 5.3 mm cardinal drift and 27.3 mm diagonal drift.
A repeated export keeps existing animation bytes and produces identical gait bytes.

Distant Japanese, Scottish, and Arizona landforms now use adapted public elevation data.
Course edges preserve the playable height field. Each region has its own terrain shape and surface colors.
Forest belts use a single atlas draw and stay outside playable boundaries.
The final forest placement samples rendered triangles to prevent floating trunks.
Bunker floors, lips, sand masks, minimaps, and lies share the same curved outline.

The terrain still needs further art work to reach the full photorealism target.

### Regional pass verification

- All 79 unit and asset checks pass.
- All 18 browser scripts pass with audio muted.
- All 36 cups complete with course-specific scorecards.
- All six heroes pass the 60-case movement check and the existing golf, grip, attack, and guard checks.
- Character material comparisons cover all six faces under four lighting themes.
- Regional grid checks cover checksums, partial download failure, playable-edge continuity, and triangle orientation.
- Forest height sampling agrees with ray intersections on the rendered mesh.
- Each course has inspected aerial, tee, and bunker views without browser or shader errors.

### Regional pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440×900 viewport.
Each run holds 64 enemies alive and repeats attacks after warmup.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 51.3 | 33.4 ms |
| Heather & Crown | 1.00 | 59.8 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 52.0 | 33.4 ms |

These local measurements do not establish performance on every device or camera position.

## Ground contact and course surface pass

All six heroes now adapt their legs to the rendered course triangles.
The solver preserves native limb lengths and the golf club path.
Running and guard steps retain their recovery arcs. Rolls, jumps, and airborne attacks release ground correction.
The four-theme slope audit measures up to 10 mm support error and 2.5 mm penetration.
Golf support stays within 15.6 mm. Club-position error stays zero.
The real-game test covers combat, address, swing, and flight updates.

Short turf now retains the RGB detail from ambientCG Grass005.
Fairways use subtle viewing-dependent mowing bands. Greens use finer detail and weaker normals.
Curved gravel paths follow the terrain and exclude grass, shrubs, and the main playing surfaces.
Nearby rough grass has narrower blades and lower height.
Distant groves gain terrain-following shadows without another dynamic shadow pass.

These changes improve grounding and surface detail. They do not establish full AAA quality or photorealism.

### Art priorities identified after the ground pass

The latest visual review identifies three larger gaps:

- Fairway boundaries still contain long straight edges and abrupt corners. Shared curved boundaries should preserve each hole's distinct routing.
- Distant ridges show triangular seams and broad pale patches. Refine prominent ridges and use geological surface detail aligned with their slopes.
- Large weapons obscure faces during travel. Author side-carry poses and refine blade proportions while preserving grips and combat reach.

The current bodies read as people. Further body replacement is not the next priority.

### Ground pass verification and performance

All 85 unit checks and 21 browser scripts pass.
The browser suite covers all 36 cups, all six heroes, grips, music transitions, controls, guard actions, and terrain views.
All development browsers use muted audio.

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each measurement holds 64 enemies alive and repeats attacks after warmup.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 0.85 | 46.4 | 33.4 ms |
| Heather & Crown | 1.00 | 59.7 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.7 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.8 ms |
| Crane Coast, Retina DPR 2 | 1.20 | 51.8 | 33.4 ms |

These local measurements include adaptive resolution. They do not establish performance on every device or camera position.

## Curved fairways, mountain surfaces, and travel poses

All 36 fairways now use curved centerlines and varying widths through their existing landing areas.
Detached pads have asymmetric outlines. Short, broad elbows spread their turns to prevent folded inner banks.
Terrain, physical lies, scenery exclusions, and both maps share the same baked segments.
The authored tees, cups, route branches, water carries, and walking bridges remain intact.

The regional mountain mesh shares vertices and uses normals from its rendered faces.
Adaptive detail reduces interpolation error while keeping a 198,000-triangle limit.
RGB rock and grass photographs replace the previous mostly flat mountain colors.
Stochastic triplanar mapping reduces repeated rock patterns and stretching on steep faces.
The desert material uses elevation bands with broad weathering breaks.

Each hero has a separate weapon carry during travel.
The arm solver follows native proportions and keeps the weapon at the calibrated palm grip.
Native legs, core motion, and terrain foot placement continue to supply the running motion.
Odachi and naginata blades have less bulk. Enemy weapons retain their original dimensions.

### Verification

All 95 unit checks and 25 browser scripts pass.
The complete browser suite covers all 36 cups, six heroes, controls, audio, saves, guard actions, and terrain contact.
New checks cover curved boundaries, mountain topology, travel grips, and early movement transitions.
Golf club paths match the control from the first frame through impact.
Light and heavy weapon paths match the control from the first gameplay hit.
Rendered comparisons cover all three natural regions and all six weapon carries.
All automated browser sessions mute audio.

The performance review found a grass-cache defect near cell corners.
It compared the player's distance against a cell origin instead of comparing cell identities.
Some stationary positions therefore rebuilt 14,400 ground samples every frame.
The corrected cache retains the grass buffer until the player enters another cell.
A regression checks positive cells, negative cells, and repeated updates at the far corner.
At one fixed position with 64 enemies, this correction reduced frame time from 30.34 ms to 12.52 ms.
That controlled comparison used rendering ratio 1 and measured 32.4 versus 59.9 FPS.
Separate live-combat measurements follow below.

### Live-combat performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run holds 64 enemies alive and repeats attacks for ten seconds after warmup.
Balanced mode retains dynamic shadows and disables contact shading for this crowd size.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.6 | 16.7 ms |
| Heather & Crown | 1.00 | 59.7 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 53.6 | 33.3 ms |

These local measurements do not establish performance on every device or camera position.
The final terrain, foot-contact, and gameplay smoke checks pass after the cache correction.
All four course previews show the revised surfaces and fairway curves.

### Remaining visual work

The latest multi-view review still falls short of full photorealism and AAA presentation.
The next foreground priorities are subtle turf-condition variation and replacement of repeated primitive props.
The desert has conspicuous repeated orange boulders. Large cube tee markers also need a more convincing golf design.
The current scanned rocks can replace those boulders with varied scale, rotation, and ground embedding.
Buildings, distant city integration, foliage transitions, and combat performance still need further visual review.

## Foreground scenery pass

Short turf now uses a darker base, weaker mowing bands, and broad growth variation beneath the photographic detail.
Small roughness changes follow the same growth pattern. Greens retain finer, more uniform grass.
These material changes do not alter physical lies, course boundaries, or the shared maps.

Scanned boulders replace repeated polygonal rocks in Japanese gardens, Highland cover, desert cover, and ruin rubble.
Their low proportions preserve natural rock shapes. Their registered heights match their visible tops.
Existing collision radii remain explicit, and the rocks share the landscape's instancing and distance-detail system.
Course reloads release cloned geometry and materials while retaining shared source textures.

Small rounded tee markers replace the large white cubes.
Their finishes match each theme, and the pair follows the opening route.
Their bases and small contact shadows follow the rendered terrain.
Daytime airborne particles are smaller, softer, and closer to the ground.

### Foreground verification

All 101 unit checks and seven targeted browser scripts pass.
The browser checks cover all 36 cups, navigation, golf and combat, terrain views, tree detail, rock emergence, and tee markers.
The rock test verifies rendered instances, their registered heights, and resource disposal through course reloads.
All development browser sessions mute audio.

Dense-combat measurements use Chrome, Metal, Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run holds 64 enemies alive and repeats light and heavy attacks for ten seconds after warmup.
Balanced mode disables contact shading for this crowd size. Dynamic shadows remain active.

| Course | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.8 | 16.8 ms |
| Heather & Crown | 1.00 | 59.7 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.7 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 53.1 | 33.3 ms |

These local measurements do not establish performance on every device or camera position.

### Remaining character work

A separate CPU audit found a low running posture and weak pelvic rotation.
Forward running turns the hips approximately 1.6 degrees, while shoulders turn approximately 60–64 degrees relative to them.
Flat-ground support samples permit a conservative 3 cm posture lift with the existing foot targets.
This remains a proposal. Slopes, transitions, and rendered movement need verification before implementation.

The native eye, eyelid, jaw, and brow bones deform vertices, but their existing animation channels remain effectively constant.
The models have no expression morph targets, so the older morph-based expression layer has no effect.
Athletic body motion remains the first character priority. Facial bone animation can follow after per-character calibration.

The game still falls short of full AAA presentation and photorealism.
The buildings, city integration, character movement, and close-up detail require further work.


## Running posture and putting consistency

The running revision raises the pelvis within each native leg's reach.
The planted foot targets remain fixed. The free foot folds higher during recovery.
Hip rotation now reaches the thigh joints because the upper-body correction starts above their parent bone.
The original chest and arm rotations remain intact.
Terrain adaptation now prepares for downhill support and respects each foot's actual target.
This removes a slope-related ankle jump exposed by the higher posture.
The change is modest in screenshots, with clearer knee recovery and less crouch during support.
It does not establish final AAA character motion.

The game now uses native eye, jaw, and brow bones for small facial changes.
Eyes follow the camera during selection and the Musou close-up.
Running and attacks add a small jaw movement. Musou adds a small brow movement.
Golf, dodge, emergence, and death preserve their original facial transforms.
Only heroes use this layer; crowds have no additional facial update.
The previous inactive expression morph layer was removed.

There is no blink. The current eyelid translation closes the eyes only with invalid skin folds.
`docs/facial-pose.md` records the rejected deformation and the accepted limits.

Putting guides now share live rolling resistance, slope response, hazards, and cup capture.
The previous guide treated every surface like a green and could continue through water.
One Lotus Crossing putt predicted 85.07 metres but stopped after 10.70 metres in rough.
The corrected guide predicts 10.696 metres. Live rolling constants and operation order remain unchanged.

### Remaining work after this pass

Building collision, city architecture, shot-shaping controls, and clearer dispersion feedback remain incomplete.
Close-up character detail and athletic combat motion still need further artistic review.
The game remains below the requested AAA and photorealistic standard.


### Verification for the running and putting revision

All 111 unit tests pass. All 29 browser scripts pass across the full run and focused reruns.
The first terrain-contact run exposed a 43.4 mm planted-ankle step on a downhill cyber-course stance.
The corrected solver passes all 24 hero-and-theme cases without changing the original thresholds.
Maximum support-step movement is 1.1 mm; maximum pelvis correction change is 16.2 mm at 60 Hz.
Golf hand paths remain unchanged. Actual putts and previews have zero endpoint difference in nine browser cases.
The production build succeeds. All development browser sessions remain muted.

Final dense-combat measurements use Chrome, Metal, Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run keeps 64 enemies alive and repeats attacks for ten seconds after warmup.
No Blender or capture jobs ran during these measurements.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.5 | 16.8 ms |
| Heather & Crown | 1.00 | 59.6 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.7 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 53.2 | 33.3 ms |

Dynamic shadows remain active. Balanced mode disables contact shading at this crowd size.
These local measurements do not establish performance on every device or camera position.


## Solid architecture and crowd routes

Buildings now block actors, combat cameras, melee attacks, projectiles, and golf balls.
Construction records preserve open gateways, arches, and porches.
Enemies take validated routes around building corners. Nearby enemies reuse routes after checking their new endpoints.
Movement retains its previous safe position when a collision correction reaches water.

Placement checks cover whole building footprints across all 36 holes.
They exclude water, fairways, greens, walking routes, rendered paths, cover objects, and neighboring structures.
Pagoda stairs now meet local ground and the foundation deck.
Desert planters have grounded bases and clearance from porch columns.
City clusters use different tower heights, setbacks, smaller buildings, four-sided windows, dark roofs, and narrow light strips.

Golf balls rebound from walls. Putting previews share the live response.
Airborne guides show their first building obstruction.
A ball beside a building receives a free drop when the golfer needs room for the address stance.
The drop cannot move nearer the cup. Inaccessible roofs and unplayable building lies add one penalty stroke.

### Building verification

All 142 unit tests pass. The production build succeeds.
Ten relevant browser scripts pass: buildings, navigation, combat, guard, putting, expansion, production views, foot placement, rocks, and smoke.
The expansion check completes all 36 cups.
The building check uses actual player input, attached enemies, live golf updates, and projectiles across all four themes.
It verifies 64 golf stances after free drops, without adding strokes or penalties.
It also checks one-stroke roof relief and the unplayable-lie fallback.

Rendered inspections cover all four buildings at travel height and overhead, plus openings and the pagoda stairs.
Those inspections exposed glowing rooftop slabs and floating planters. The final captures confirm both corrections.
Development and verification browsers remain muted.

### Limits after the building revision

The stairs, galleries, and building interiors remain inaccessible.
Curved roof collision uses conservative overhead cells.
The building routes do not replace local forest or terrain steering.
Close walls still have oversized texture patterns. City surroundings need more architectural detail and coherent ground surfaces.
Character movement and close-up detail still need artistic refinement.
The game remains below the requested AAA and photorealistic standard.


### Building-pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run keeps 64 enemies alive and repeats attacks for ten seconds after warmup.
No other rendering or capture jobs ran during the measurements.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.7 | 16.8 ms |
| Heather & Crown | 1.00 | 59.7 | 16.7 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.7 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.8 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 52.8 | 33.4 ms |
| City building detours | 1.00 | 60.0 | 16.8 ms |

The building scenario starts all 64 enemies across a solid city podium from the hero.
Its largest measured combat update took 25.7 ms, including the first route searches.
The measurement records 132 route requests across setup, warmup, and sampling.
Steady average frame rate does not exclude that initial delay.
Dynamic shadows remain active; Balanced mode suspends contact shading at this crowd size.
These measurements describe this machine and these scenarios, not every device or camera position.

## Architecture surfaces and entrances

Architectural stone now has consistent texture density across walls, blocks, and foundations.
Desert buildings use plaster with service doors and side windows.
Highland masonry covers the lower foundations and inner walls.
City buildings have framed glazing, floor bands, paired doors, and handrails.

Ninety entrance courts and 41 dry path connections now organize the building surroundings across all 36 holes.
Courts reuse the existing path material. They exclude playing surfaces and suppress grass beneath them.
City stairs meet the raised entrances and retain solid collision.
Grouped stair outlines limit navigation graph growth while route checks retain the individual solids.

The city additions total 18,020–18,960 triangles per hole, including ground surfaces, stairs, rails, and facades.
Each city hole adds one material batch. The pass adds no texture downloads or per-frame geometry generation.

### Architecture review limits

Matched captures verify the material scale, foundations, entrances, and path connections.
The Japanese court now touches the bottom stair. Desert coping stops beside service door frames.
Highland blocks remain oversized and repetitive at close range.
The Japanese stair still leads to an uninterrupted screen facade without a clear doorway.
City towers remain simplified, and the surrounding skyline needs further artistic work.
Stairs, galleries, and interiors remain inaccessible.
Character movement and close-up detail still need refinement.
The game remains below the requested AAA and photorealistic standard.

### Architecture verification

All 153 unit tests pass. Ten relevant browser scripts pass, including all 36 cups and actual building navigation.
Matched captures verify all four themes. The capture script checks shader errors, shared texture settings, and material counts.
The city geometry measurements include all nine holes.
Development and verification browsers remain muted.

The refreshed course previews also show three broader environment problems:

- Crane and Highland rough have regular texture stripes. Desert turf has a hard border against uniform sand.
- Repeated forked trunks and compact crowns make the forests too uniform. Highland slopes need more low scrub and fewer repeated tree silhouettes.
- The photographic city skyline meets the course at a straight horizontal boundary. A distant building layer and matched haze need evaluation.

These observations need matched camera comparisons in later passes. They are not corrected by the architecture changes.


### Architecture-pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run keeps 64 enemies alive and repeats attacks for ten seconds after warmup.
No other rendering or capture jobs ran during these measurements.

| Course / display | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.6 | 16.8 ms |
| Heather & Crown | 1.00 | 59.6 | 16.8 ms |
| Copper Saguaro | 1.00 | 60.1 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.0 | 16.7 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 51.5 | 33.4 ms |
| City building detours | 1.00 | 59.9 | 16.8 ms |

The city routing scenario starts all 64 enemies across a solid podium from the hero.
Its largest combat update took 31.2 ms. The run recorded 90 route requests, including setup and warmup.
Dynamic shadows remain active. Balanced mode suspends contact shading at this crowd size.
The earlier architecture baseline measured 59.7–60.1 FPS at desktop resolution and 52.8 FPS for Retina.
These single-run comparisons cannot isolate normal timing variation.
The measurements describe this machine and these scenarios, not every device or camera position.

## Ground, tree variety, and city horizon

Rough grass now combines rotated close texture patches with broad photographed growth variation.
Fine blade contrast fades when the screen cannot resolve it.
Desert turf grades through dry grass into textured mineral soil.
Golf boundaries, ground heights, and route geometry remain unchanged.

Japanese groves mix two authored pine forms with the previous broadleaf tree.
Highland groves use those pines, firs, and low woody scrub with more open spacing.
The conifers preserve native close foliage and use faithful distant views.
Separate species retain matching shadows and independent vertical centers.
The added assets total 48.54 MB, including four models and three atlas sets.
See [tree sources and conversion](nature-variety.md) for licenses, geometry costs, and botanical limits.

The city uses three modeled building bands with scaled windows and sparse lit rooms.
The photographic panorama supplies reflections and lighting without visible background towers.
This removes the mismatched tower scale and the straight photographic horizon seam.
The new districts use two static batches and approximately 11,600 triangles.

### Environment review limits

Matched views cover four previews, four turf edges, and four city bearings.
Fifteen tree views cover near geometry, middle geometry, transitions, and distant images.
Review rejected triangular branch artifacts, sparse crowns, and overly flat distant grass before the final versions.

City architecture and decorative lights still look simplified at close range.
Conifer needles can lose coverage when they become smaller than a pixel.
The Highland scrub is a South African shape substitute, not native Scottish planting.
The distant tree images have limited parallax.
Characters still need further motion and close-up refinement.
The game remains below the requested AAA and photorealistic standard.

### Environment-pass performance

Chrome uses Metal on Apple M1 Max, Balanced settings, and a 1440 × 900 viewport.
Each run keeps 64 enemies alive and repeats attacks for ten seconds after warmup.
No other automated capture or asset conversion ran during these measurements.

| Course / scenario | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast | 1.00 | 59.1 | 16.8 ms |
| Heather & Crown | 1.00 | 59.4 | 16.8 ms |
| Copper Saguaro | 1.00 | 59.9 | 16.8 ms |
| Neo-Tokyo After Dark | 1.00 | 60.1 | 16.8 ms |
| Crane Coast, Retina DPR 2 | 1.50 | 50.5 | 33.4 ms |
| City building detours | 1.00 | 60.0 | 16.8 ms |
| Crane Coast, dense grove | 1.00 | 59.2 | 16.8 ms |
| Heather & Crown, dense grove | 1.00 | 58.6 | 16.8 ms |
| Crane dense grove, Retina DPR 2 | 1.50 | 51.6 | 33.4 ms |

The dense-grove cases place combat inside each theme's most crowded safe tree cluster.
The Crane grove contains 13 nearby trees and submits about 8.3 million triangles during the measured frame.
The city routing case recorded 96 routes and a largest combat update of 32.6 ms.
Dynamic shadows remain active. Balanced mode suspends contact shading at this crowd size.
These local measurements do not guarantee performance on every device or camera position.
The previous architecture pass measured 59.6–60.1 FPS in standard views and 51.5 FPS in its Retina case.

### Environment verification

All 161 unit and asset checks pass. The production build succeeds.
Thirteen relevant browser scripts pass, including all 36 cups, navigation, combat, building collision, and putting previews.
The environment capture verifies hero framing, dry ground, collision clearance, and clear torso sightlines.
Its city hero moves 1.2 metres from an obstructed test position while the comparison camera remains fixed.
Fifteen tree views verify actual instances across near, middle, transition, and distant representations.
All test browsers remain muted. Course-selection previews now show the revised environments.

### Native golf, likeness, and shoreline update

The six selection poses now derive blade direction from the elbow and neutral wrist.
Dense hand checks include the guard, collar, and grip end rings.
A separate body check rejects handles that touch the torso or legs.
The Shinobi carries shorter twin blades with different arm pitches.

The Vice President uses an adapted likeness of Ethan Cary, reviewed with Claude Opus 5.5 High.
The women now appear as The Ace, The Hustler, and The Closer.
The selection alternates men and women without changing saved character IDs.
Native golf now includes torso rotation, weight transfer, an upward release, and a supported heel pivot.
Musou uses individual facial adjustments and a closer camera centered on the eyes.
All 38 water basins and 12 islands use shared organic outlines across rendering, maps, physics, and enemy emergence.

The final local run passes 273 unit and asset checks and the production build.
Browser checks cover 974 grip samples, 150 golf phases, six selection poses, and all six Musou close-ups.
Additional checks cover real-input golf/combat, facial restoration, water emergence, and putting previews.
The water comparison checked 147,368 CPU/GPU samples and six live emergence cases.
All automated browsers remain muted.

Chrome used Metal on Apple M1 Max at 1440 × 900 for the following measurements.
The combat samples kept 64 enemies alive and measured ten seconds after warmup.
No other automated GPU capture ran concurrently. CPU unit checks ran during the shoreline samples.

| Scenario | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| Crane Coast, charging a drive | 1.00 | 60.0 | 16.8 ms |
| Heather & Crown, water combat | 0.85 | 53.3 | 33.3 ms |
| Copper Saguaro, water combat | 0.85 | 58.5 | 16.8 ms |
| Neo-Tokyo, water combat | 0.85 | 54.9 | 33.3 ms |
| The Vice President, moving combat | 1.00 | 59.0 | 16.8 ms |

Balanced mode reduced resolution in three shoreline scenes and disabled contact shading during crowded combat.
These measurements meet the requested local frame-rate range, but do not establish performance on other hardware.
Combat choreography and some close character details still fall below the requested AAA standard.
The Vice President's loose vest retains a small sleeve-edge overlap just after golf impact.
