# Shared-hilt closure and grip review

The curved-blade correction is published in `7f52f9f`.
This study changes no playable model, grip, animation, or joint bound.
All fitted motion candidates remain rejected.

## Independent review

Actual Claude Opus 5.5 reviewed the rendered stock-grip poses and fitting code.
The CLI requested High effort and reported `modelUsage.claude-opus-5-5`, with no permission denials.
The prompt, response, images, measurements, and experiment sources remain in `artifacts/shared-hilt-review/`.

Opus rejected the poses. Both forearms crowd the face, and the final pose changes the blade direction abruptly.
The numerical hand attachment was accurate, but the requested blade motion was not.
A head-bone sphere did not adequately cover the face and neck.

The stock right forearm points approximately `[−0.0525, 0.2588, 0.9645]` in the weapon frame.
The stock left forearm points approximately `[−0.0369, 0.2588, −0.9652]`.
Weapon X is the cutting edge, Y points to the tip, and Z is the blade normal.
Thus, the stock forearms approach from opposite sides of the blade's flat face.
This is evidence that the sword needs an independently calibrated mounting frame.
It does not establish a replacement frame or approve a motion.

The current fitter constructs the elbow hinge from the two arm segments.
Its near-zero hinge-deviation result is therefore a construction invariant, not independent proof of natural elbows.
Upper-arm rotation, forearm rotation, visible skin, and complete body motion still require separate checks.

## Reference guidance

Nicklaus Suino's [SMAA grip article](https://www.smaa-hq.com/articles/article/te-no-uchi-gripping-the-sword-in-muso-jikiden-eishin-ryu-iaido) describes a diagonal grip through the palm.
It also distinguishes that grip from a square grip and discusses changes during a downward cut.
That source does not validate our rising-cut poses or prescribe a universal shaft angle.

Nakamura Taizaburo's [illustrated guidance, hosted by Kenshinkan Dojo](https://kenshinkan-battodo.org/iai-sword-standards--practical-use-and-cutting), places the palms along the handle's upper ridge.
It warns against gripping only its flat sides.
These references guide the next fit; they do not justify relaxing the existing acceptance checks.

## Exact closure

`tools/shared-hilt-closure.mjs` separates hand closure from motion quality.
For a fixed weapon frame and wrist pose, each elbow has a fixed offset from the shared hilt position.
Each upper arm then defines a reach sphere for that hilt.
Their intersection supplies an exact circle of possible hilt positions.

The helper selects the point nearest a requested position, with an optional angle around that circle.
It rejects separated or contained spheres instead of clamping their distance and stretching an arm.
Coincident spheres require another constraint and produce an actionable error.

The separate blade-frame measurement reports shaft, edge, and complete orientation errors.
It detects a wrong cutting face even when the shaft direction matches exactly.
A weighted optimizer score must not replace these independent measurements.

Seven tests cover unequal arm lengths, complete orbits, nearest-point selection, rigid transforms, unreachable geometry, degeneracy, and blade alignment.
An additional check reproduces 28 experimental hilt positions within 0.000000002 mm.
That tiny closure error does not certify the motion: shaft errors across those poses range from 13.46° to 116.37°.

## Rejected experiments

The study tried the stock grip, a fixed blade rotation, a free blade rotation, the earlier 50° grip, and a new 30° diagonal grip.
The 30° value describes the handle relative to the forearm with a neutral wrist. It is an experiment, not a human limit.
Its finger-fit measurements reached 1.84 mm and 1.94 mm maximum cylinder intrusion.
Those vertex measurements do not certify complete finger surfaces, thumb contact, guard clearance, or a moving grip.

All variants failed either blade intent, visible posture, joint bounds, or skin checks.
The 30° render still raises the elbows across the face.
Its preview used the larger shipping handle; it is unsuitable for approving finger contact with the experimental 14 mm handle.

A diagnostic run increased the temporary forearm rotation allowance to 89°.
It still produced torso crossings and elbow folds. The production bound remains unchanged.

The fitter's early collision reports used the native skin without runtime forearm helpers.
A release must check the actual runtime skin too. Neither result can substitute for the other without comparing their geometry.

## Next authoring requirements

- Calibrate the grip and blade orientation from a demonstrated pose with known hand ordering.
- Check the actual long blade's ground clearance before choosing its motion path.
- Include the face and neck in body clearance checks.
- Select a continuous sequence of solutions rather than independent best poses.
- Reject blade-direction errors separately from joint and hand-contact errors.
- Review runtime entry, recovery, and every affected attack before changing a global grip frame.

The retained temporary fitters contain absolute experimental input paths.
They are evidence, not standalone release tools.
