# Ronin fixed hand frames and animation entry

## Game change

A crossfade blended the static ready pose into an attack that already started at that pose.
The blended limb rotations briefly broke the closed grip between the two hands.
The controller now checks the complete incoming pose before skipping that redundant fade.
The existing grip layer owns finger rotations, so the comparison excludes only those rotations.

The shortcut requires the character's settled Ready clip, a compatible native pair, and no other active animation.
It retains fades for different wrist or body positions, guards, running, carry, and interrupted attacks.
The existing Ethan attack family benefits from this change.

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

## Review and remaining work

Actual Claude Opus 5.5 High reviewed the earlier poses.
It identified a low chamber, excessive handle length, and a passive finish.
The revised candidate addresses the chamber and handle; the complete motion remains provisional.
The final review attempt returned Anthropic's weekly account limit before model execution.
It did not return a review or an approval denial.

Do not publish this candidate as a complete Ronin replacement.
Its grip profile would also affect the other attacks, guards, and travel poses.
Those motions and their transitions still need fitting and review.

The [reproduction tools](../../tools/ronin-candidates/fixed-grip/README.md) contain the retained controls and checks.
The local silent preview remains in `artifacts/reviews/ronin-fixed-frame/`.

## Validation

The focused unit checks pass all 27 cases.
The browser checks pass 138 native-pair transitions, the combat flow, and all six selection animation sequences.
The build succeeds.

The full working-tree test run reports 636 passes and six failures.
The failures come from the pre-existing edited Ronin review test and five checks in the untracked golf-frame study.
Those studies remain outside this change. No failing check was removed or relaxed.
