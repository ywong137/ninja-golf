# Follow-up attack travel — October 5

The previous goal turn fixed the Ace's shorts and visor. This continuation returns to full-body combat movement.
The review checks follow-up heavy attacks, which the automatic opening-attack preview does not show.

## Findings

After two light attacks, a heavy input selects `Hustler_Diagonal_Cut` or `Closer_Rising_Cut` for these characters.
Both clips retained forward movement inside the pelvis animation. The gameplay actor stayed at the starting point.
Recovery removed that movement and pulled the displayed body backward by about 1.24 metres.

The Hustler's cut also started with a 0.796-metre forward offset relative to her ready stance.
That source interval begins partway through a longer combination. Its original world offset did not belong in a standalone attack.
The Closer's initial position already matched her ready stance.

## Correction

The shared extraction tool now accepts an optional ready clip as a horizontal anchor.
It removes the constant starting offset, then transfers horizontal travel through the existing gameplay movement path.
The existing controller handles terrain, obstacle collision, damage origins, cancellation, and recovery.
Vertical motion and all recorded limb, torso, and head rotations remain unchanged.
The motion metadata receives the same translation as the model.

The Hustler now retains 0.388 metres of overall travel at gameplay scale.
The Closer retains 1.257 metres. Neither returns to the original actor position after the cut.
The measured horizontal recovery shift falls to about 0.02 metres for both characters.
These changes preserve their current performances; they do not add new choreography.

## Verification

A comparison checks 38,560 joint positions across the original and corrected performances.
After accounting for the intentional starting translation, maximum reconstruction error is below 8e-16 metres.
Original binary data, geometry, skin weights, materials, and unrelated animations remain unchanged.

Twenty focused unit checks pass, including a new six-character regression over every mapped light and heavy attack.
That check rejects permanent horizontal displacement hidden inside the body animation.
Four extraction tests cover transformed parents, pose preservation, invalid inputs, and optional anchoring.
Six preview-bound checks pass after updating both affected asset records.

Twenty-two muted gameplay cases pass.
They cover three headings at 40, 60, and 144 updates per second, actual enemy damage, wall collision, and cancellation.
Maximum recovery shift across those gameplay cases is 0.0253 metres. No browser errors occur.
These update-rate checks do not measure rendering performance.

The standard selection loop still previews the opening light and heavy attacks.
Those performances are unchanged. This fix affects heavy follow-ups after two light attacks.

Private evidence is in `/Users/yishan/ninja-golf/artifacts/reviews/followup-root-2026-10-05/`.
The original and corrected muted gameplay captures use the same scenario.
The private production verification uses normal selection, golf, two light inputs, and a heavy input.
The exact private bundle `index-Cgy3GjHv.js` passes both real-input combinations without browser errors.
Measured production travel is 0.388 metres for the Hustler and 1.257 metres for the Closer.
The private game remains available at http://127.0.0.1:4185/.
The build succeeds with the existing large-chunk warning.

The broader AAA objective remains incomplete. No scenery changes or public publication occurred.

## Reproduction

Use the Ayame and Sora models and motion data from local commit `ab0f057`.
Run `tools/extract-existing-attack-root.mjs` for each affected clip.
Use `--reference Ring_Ready` for Ayame and `--reference Sickle_Ready` for Sora.
Keep original inputs and write candidates outside `public/` before verification.
Install the corresponding model and motion record together.
