# Attack foot support at the return to idle

The terrain solver now preserves each authored foot's vertical correction and actual sole orientation.
The procedural solver starts from those values when an attack ends.

Previously, `applyAuthored` reset the procedural state every frame.
The following idle frame therefore started from zero correction and a horizontal sole.
A downhill foot could jump even when no animation time elapsed.

The contact sampler also clamps time to the motion record's duration.
The animation mixer can finish slightly beyond that value because of floating-point rounding.
Previously, that difference released both feet during the last active frame.
Zero-length contact intervals now produce a finite weight at their exact endpoint.

## Evidence

The isolated Slam candidate exposed a 29.004 mm jump on `y = 0.12x + 0.10z`.
The complete animation ended at its exact Ready pose before the test changed modes.
The test then called the real `Warrior.update` with `dt = 0`.
This separates the solver discontinuity from ordinary animation movement.

Preserving only the sole orientation removed the rotation jump, but left the vertical jump.
Preserving both values reduced the maximum movement to 0.000145 mm in that case.
The equivalent flat test remained below 0.000168 mm.

The ordinary controller transition also passes at 240 and 480 Hz.
At the uphill exit, the foot moves about 0.00206 mm during the final 1.667 ms step.
The pelvis continues its time-dependent recovery; it does not jump during the zero-time switch.

## Tests

`tests/attack-foot-placement.test.js` checks the support transition with all six public native bodies.
It covers four terrain planes and two facing directions for each body.
Each test settles authored support, restores the same source pose, and changes solver modes with zero elapsed time.
The test requires less than 1 mm of movement.
All eight tests pass, including existing flat-pose preservation, endpoint handling, and course-slope checks.

An independent controller review compared 108 production exits before and after the state-seeding change.
It covered Ronin, Kaede, and Ethan; light and heavy attacks; idle and running exits; and raised feet.
It found no material new first-frame defect from state seeding.
It also found the separate endpoint bug, which caused a false 60.4 mm airborne movement.

After both fixes, all 24 targeted sloped idle exits retain their final contact weights.
The largest terrain-correction discontinuity is 0.0073 mm, with no browser errors.
The confirmed Ronin handover falls from 28.69 mm to 0.00063 mm.

Starting a run still has a separate support-release problem on some slopes.
An abrupt contact change from one to zero can discard a swing foot's terrain correction.
This existing issue needs a bounded release blend. These fixes do not claim to resolve it.

The production build passes.
This change does not modify any model, motion record, arm pose, or weapon attachment.
It does not solve the separate offline Slam candidate's blade/terrain intersection.
