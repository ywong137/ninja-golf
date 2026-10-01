# Ronin fixed hand frames and animation entry

## Game change

A crossfade blended the static ready pose into an attack that already started at that pose.
The blended limb rotations briefly broke the closed grip between the two hands.
The controller now checks the complete incoming pose before skipping that redundant fade.
The existing grip layer owns finger rotations, so the comparison excludes only those rotations.

The shortcut requires settled Ready or a completed attack, a compatible native pair, and no other active animation.
It retains fades for different wrist or body positions, guards, running, carry, and interrupted attacks.
The existing Ethan attack family benefits from this change.

The same redundant fade also affected a completed light cut followed by a heavy attack.
The controller now skips that fade only when all incoming transforms match the completed attack's pose.
The completion check allows one microsecond for exported float32 key times and the float64 gameplay clock.
The complete pose comparison still applies within that tolerance.
Interrupted attacks and mismatched poses retain their fades.

The grip controller also supports an explicit `fixedGripFrame` motion flag.
That flag attaches the weapon to the complete primary palm frame.
Small support-hand interpolation errors then cannot steer the blade.
Existing combat clips keep their previous attachment behavior unless they declare this flag.

## Offline Ronin candidate

The new candidate raises the chamber above the forehead and brings the blade through a continuous downward cut.
It retains the original forward step and body movement.
The handle is shorter, and both complete hand frames remain fixed relative to it.

An export defect omitted the right wrist rotation from Ready.
The exporter now supports explicitly declared new rotation channels and rejects accidental replacements or unknown nodes.
The candidate includes that missing wrist track.

The native check samples Ready three times and Heavy Cleave 731 times at 960 Hz.
It reports:

- No native arm-bound violations or tested arm, torso, and elbow surface intersections.
- At least 30 mm blade clearance from the tested body surfaces; the measurement stops at that distance.
- Maximum handle surface penetration of 1.07 mm, with no guard or pommel penetration.
- Maximum complete hand-frame error of 0.0181 degrees and palm-position error of 0.106 mm.
- Preservation of all 9,764,976 original binary bytes and 35 unrelated animation descriptions.

The actual controller also passes the 144 Hz attack and recovery check.
Its maximum complete hand-frame error is 0.0155 degrees, and its maximum palm-position error is 0.099 mm.
The check uses the model's bind pose for anatomical calibration.

These measurements do not establish athletic movement by themselves.
The fastest sampled local joint rotation remains approximately 2,051 degrees per second during the downswing.
The side renders show the forward step and trunk inclination, but the full movement still needs artistic review.

## First light cut and combo

The candidate now includes a diagonal light cut with the same complete palm frames.
It retains all 366 samples from the cleave and compresses the motion to 0.60 seconds.
The torso inclines 15 degrees above the thigh parents. The head counters that inclination.
Contact occurs at 0.2842105263 seconds.

The native check covers 1,312 samples across Ready, Heavy Cleave, and the light cut.
It finds no native arm violations, tested skin intersections, or blade clearance failures.
Maximum foot-path error against the source cleave is 0.000144 mm.
Maximum foot rotation difference is 0.0000057 degrees.
All original binary bytes and 34 unrelated animations remain intact.

The actual game controller queues Heavy Cleave during the light cut and completes both attacks before returning to Ready.
Before the transition fix, the 144 Hz check measured a 3.26 mm palm gap and 4.05 mm handle intrusion.
After the fix, the 144 Hz check measures a 0.090 mm gap and 1.07 mm maximum surface intrusion.
The 60 Hz check measures a 0.061 mm gap and 1.05 mm maximum surface intrusion.
Neither check finds contact with the guard or pommel.
The maximum complete hand-frame error is below 0.016 degrees.

Front, side, and quarter views show the step, raised chamber, downward cut, and recovery.
The sequence remains an offline candidate. It does not replace the remaining Ronin combat family.
The diagonal's maximum sampled local joint speed is approximately 2,584 degrees per second.
The numerical checks do not resolve that motion's artistic timing by themselves.

## Guard motions and attack transitions

The candidate now includes all seven guard motions with the same 120 mm palm spacing and complete hand frames.
Impact and Break rotate the upper body without changing either arm's local grip.
Break also moves the pelvis down 40 mm and back 45 mm, with both feet planted.
Both knees compress, and the measured inward knee displacement remains below 0.001 mm.

The native check covers 2,842 samples at 480 Hz.
It finds no native arm violations or tested arm surface intersections.
Maximum complete palm-frame error is 0.0000192 degrees.
Maximum ankle or toe displacement against the original paths is 0.0334 mm.
The separate Break comparison verifies recovery and unchanged unrelated animation channels.

The first runtime test exposed another blend defect despite those valid individual poses.
The static guard arms blended independently into the attack, opening the shared grip by 6.71 mm during the light-cut transition.
The controller now continues the incoming arm motion while retaining the body's existing crossfade.
This requires explicit fixed-grip metadata, matching local arm transforms, a shared clavicle parent, and a compatible two-hand attachment.
Missing animation channels use the captured bind transform during comparison and playback.
The actual model parents both clavicles to `neck_01`; the controller does not assume `spine_03`.

A cancellation fades this layer from its displayed pose into the next mixer pose.
This prevents the new layer from jumping back to its underlying blend when a dodge interrupts it.
It does not certify the unfinished candidate's dodge or travel grips.

The guard-to-attack checks cover 14 combinations at each of 60 Hz and 144 Hz.
Both rates retain the body fade and use the arm continuation.
They report no native arm violations, tested arm surface intersections, or blade approaches within the 30 mm measurement cap.
At 60 Hz, maximum palm separation is 0.061 mm and complete frame error is 0.0103 degrees.
At 144 Hz, maximum palm separation is 0.077 mm and complete frame error is 0.00985 degrees.
Maximum handle surface intrusion is 1.066 mm, with no guard or pommel intrusion.

Front, side, and quarter renders show the planted guard recoil and the step into the raised attack chamber.
The ten-clip build reproduces the reviewed local model and all five motion/profile files byte for byte.
The existing 196-case native-pair regression check also passes, including 90 direct pose handoffs.
These guard corrections remain part of the offline candidate until the remaining weapon motions use the same fitted grip.

## Return slash

The second light cut now uses the same complete grip as Ready, Cleave, the first cut, and the guards.
The body turns through the cut while the hands retain their orientation on the handle.
The arm solver accepts an explicit body pose and blade frame for this motion.
The existing ten-clip build remains byte-identical after that change.

The earlier return path required more than 100 degrees of forearm twist with the new grip.
An added torso turn removes that requirement.
The author retains the source hip, knee, ankle, and toe paths with continuous timing.
The earlier retiming jumped forward by 25 milliseconds at the end of the cut; that jump is gone.
The new record lasts 0.85 seconds and contacts at 0.435 seconds.
It retains 31 fitted control keys and 413 reference frames.

The exported GLB passes 818 native samples at 960 Hz:

- No native arm violations or tested arm surface intersections.
- Maximum wrist bend: 13.801 degrees; complete palm-frame error: 0.00394 degrees.
- Maximum palm separation: 0.0298 mm; handle intrusion: 1.017 mm; no fitting intrusion.
- Blade clearance stays at the 30 mm measurement cap.
- Cutting-edge alignment stays above 0.921 during the contact window.
- Maximum hand speed: 5.604 m/s; maximum sampled arm-joint speed: 1,129 degrees/s.
- Source lower-body positions differ by at most 0.235 mm; foot rotation differs by at most 0.00102 degrees.

Whole-body endpoints match Ready and the completed first cut, including scales.
The first game test still opened the grip during the transition.
The retired clip contained slightly different leg-scale tracks that prevented a direct pose continuation.
The return author now removes those obsolete tracks after verifying that every authored scale equals its bind value.
This fixes the mismatch without relaxing the controller's pose comparison.

The buffered light-to-light combo passes at 60 Hz and 144 Hz.
Both rates continue directly into the return and finish in Ready.
Maximum palm separation is 0.061 mm at 60 Hz and 0.090 mm at 144 Hz.
Maximum complete frame error is 0.0155 degrees; maximum handle intrusion is 1.066 mm, with no fitting intrusion.
The 28 focused transition, anatomy, and closure unit checks pass. The game build also passes.

Front, side, and quarter views show the step and torso turn.
The silent preview is `artifacts/reviews/ronin-fixed-return/ronin-return-quarter-speed.mp4`.
No new Opus review occurred. The full-family artistic review remains open.
A second authoring run reproduces the final model and return record byte for byte.
The eleven-clip model remains offline; production character assets have not changed.
Its SHA-256 is `1207ba73b36603a8ecba7069cc904eac84f0192859e8961096ae144769ef52d2`.

## Gameplay timing and first-cut body revision

The candidate route now plays the two light cuts over 0.40 and 0.50 gameplay seconds.
Their native durations remain 0.60 and 0.85 seconds; contact times scale with playback.
Heavy Cleave remains 0.76 seconds.
The faster timings passed Ready entry, recovery, guard transitions, and buffered combos at 60 Hz and 144 Hz.

A direct comparison of native and runtime bone positions confirmed that playback preserves the authored step.
The original first cut advances the right foot about 29 cm and turns the pelvis at most about 16 degrees.
A sparse quarter-view sheet made that step appear smaller than it was.
The independent reviewer corrected their earlier description of static feet after seeing the side view.

The new body candidate extends the step by 16 cm and turns the front foot 14 degrees during that step.
The pelvis turns ahead of the chest, then the rear heel rises while the shoe pivots.
The added forward weight transfer also reduces the deep, simultaneous knee compression.
At normalized phase 0.64, the front knee bends about 56 degrees and the rear knee about 42 degrees.
The earlier body revision bent both knees by roughly 58 and 53 degrees.

The first pivot attempt drove the shoe's forefoot below the floor by about 12 mm.
The toe joint now articulates separately from the heel, reducing that depth to the source mesh's existing tolerance.
The exported revision passes 577 native samples:

- No native leg-bound violations or tested leg-surface crossings.
- At least 57 mm clearance between the tested central leg surfaces.
- Maximum planted-ankle drift of 0.55 mm and toe-joint drift of 0.019 mm.
- Maximum hip twist of 29.75 degrees and ankle twist of 9.47 degrees.
- Minimum shoe height of -2.336 mm; the source reaches approximately -2.326 mm.
- Cutting-edge alignment above 0.886 during the contact window.
- Matching first/last poses and preservation of 36 unrelated animations and the original binary data.

An independent Codex reviewer found the first revision visibly more athletic, with no obvious reversed or inward-collapsing knees.
They identified a larger remaining problem: both attacks recover to upright Ready, interrupting the combo's momentum.
The second cut needs a connected entry from the planted finish. Unqueued attacks still need their own recovery.
No new Opus review occurred during this work.

The retained author and checker are `author-footwork.mjs` and `check-footwork.mjs` in the fixed-grip tools directory.
The final body revision passes Ready entry, recovery, all 14 guard-to-attack transitions, and the light-to-light combo at both frame rates.
Maximum runtime palm separation remains below 0.099 mm, with no tested arm intersections or native arm-bound violations.
Repeated authoring produces byte-identical model and motion files.
The body model hash is `53a864a42ffb11a134c477fb374b8a379d39a6a2192ea5ad7b632ea59b044b15`.
The silent local previews are `artifacts/reviews/ronin-light-body/body-study.mp4` and `body-side.mp4`.
The revision remains offline while the remaining grip and transition work continues.

The heavy follow-up exposed an omitted-track defect in the controller's pose comparison.
The first cut animates the rear toe and finishes at its rest rotation. Heavy Cleave omits that toe track.
The comparison previously rejected every omitted outgoing track, even when restoring it would leave the pose unchanged.
That unnecessary fade opened the support palm by 3.10 mm and drove the hand 3.93 mm into the handle.

The comparison now checks omitted tracks against the already captured rest pose.
It retains the fade when that data is absent, invalid, or different from the displayed transform.
Both rotation and translation/scale checks retain their existing tolerances.
The heavy combo now continues directly at 60 Hz and 144 Hz, with palm gaps below 0.090 mm.
The 30 focused unit checks and production build pass.

## Review and remaining work

Actual Claude Opus 5.5 High reviewed the earlier poses.
It identified a low chamber, excessive handle length, and a passive finish.
The revised candidate addresses the chamber and handle; the complete motion remains provisional.
The final review attempt returned Anthropic's weekly account limit before model execution.
It did not return a review or an approval denial.

Do not publish this candidate as a complete Ronin replacement.
Its grip profile also affects the remaining attacks, selection poses, travel poses, and dodges.
Those motions and their transitions still need fitting and review.

The [reproduction tools](../../tools/ronin-candidates/fixed-grip/README.md) contain the retained controls and checks.
The local silent preview remains in `artifacts/reviews/ronin-fixed-frame/`.

## Validation

The focused unit checks pass all 27 cases.
The browser checks now pass 196 native-pair transitions, including completed attacks and 90 direct pose handoffs.
The input-buffer checks pass 24 cases, input replacement, dodge cancellation, and Musou recovery behavior.
The prior combat-flow and six selection-sequence checks also passed before this extension.
The build succeeds.

The broader attack-transition check still fails Ethan's interrupted light-attack grip bound: 3.91 mm against a 2 mm limit.
The prior behavior produces identical results for all 48 cases, including that failure.
This change fixes matching completed-attack boundaries; it does not fix that existing interrupted-attack defect.

The full working-tree test run reports 636 passes and six failures.
The failures come from the pre-existing edited Ronin review test and five checks in the untracked golf-frame study.
Those studies remain outside this change. No failing check was removed or relaxed.

## Paired running candidate

The connected-combo model now has a separate paired-running revision.
It holds the sword with both hands during forward running, strafing, backward running, and sprinting.
The author transfers the fitted Ready arm chains and preserves the source body, head, and leg channels.
The runtime continues matching arms into an attack while the body retains its crossfade.

The original carry transition crossed sleeve surfaces and reached 86.4 degrees of forearm twist during a lateral run-to-light transition.
Those failures disappear in the tested paired-running sequences.
The support hand stays attached during running, attack entry, full attack recovery, resumed running, and stopping.

At 45, 60, and 144 Hz, 42 candidate cases pass all arm, surface, hand-frame, handle-contact, and blade-clearance checks.
The largest palm gap is 0.0894 mm. The largest complete frame error is 0.0155 degrees.
The preservation check confirms 630 unchanged body channels, 33 unchanged animations, and 11,657,660 preserved source binary bytes.
The connected combo still passes its actual-controller check.
The public roster's existing carry regression passes all 90 cases.
Eighteen focused unit checks and the production build pass.

This revision remains offline. Dodge, selection, and the unfinished attacks still require compatible grips and review.
The public roster does not enable the new `pairedTravelGrip` field.
The model hash is `8920a5c5d88c348ac750ff24efe30941dff6f52e25c2cba4103be4d487c17111`.
The silent local preview is `artifacts/reviews/ronin-paired-travel/paired-travel.mp4`.

## Preparation timing and braking review

The independent paired-running review found a rapid hand lift when the first light attack starts.
The prior preparation reached a hand-speed peak of 27.7–29.4 m/s across four sampled running phases.
A longer torso blend alone did not resolve the abrupt lift.

The new author adds 0.08 native seconds through the first 0.16 seconds of preparation.
It uses a smooth, increasing time mapping and preserves all pose values.
Gameplay duration changes from 0.40 to 0.48 seconds.
The torso blends from a paired run over at least 0.16 seconds, while both arms follow the incoming animation together.
The first 0.14 seconds now peak at 14.1–14.9 m/s in the same samples.
The independent Codex review found a readable lift through chest height into overhead preparation, with continuous shoulders and elbows.
This was a Codex review. No new Opus review occurred.

The preservation check covers 10,193 sampler time keys, 37 unchanged animations, and 11,672,900 original binary bytes.
Contact, combo timing, planted-foot intervals, and the shoulder correction follow the retimed clip.
The 60 Hz and 144 Hz runtime checks pass 28 movement-to-attack cases.
The largest tested palm gap is 0.0894 mm, with no reported arm-bound violations or tested arm/torso crossings.
The connected combo passes at 60 Hz, and all 21 input cases pass across 45, 60, and 144 Hz.
Eighteen focused unit checks and the production build pass.

The reviewer also identified foot sliding during braking.
Actual-controller measurements confirm the issue on flat ground, including when the player releases movement at attack entry.
The current run exit blends leg rotations; it does not retain a ground anchor for the support foot.
The attack's contact schedule also activates while some outgoing running poses still have airborne feet.
These observations require a support-aware braking step, not additional slowing of the arms.
The full transition and candidate model remain unaccepted for publication.

The silent revised preview is `artifacts/reviews/ronin-paired-travel/travel-retimed.mp4`.
The independent review is `artifacts/reviews/ronin-fixed-rising/reviewer/travel-retimed-review.md`.
`inspect-braking.mjs` reproduces the movement diagnostic without playing audio.
