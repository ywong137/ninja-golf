# Captured attack recovery — October 5

## Scope and evidence

The user prioritizes full-body motion, posture, and balance before scenery or small contact corrections.
The previous goal turn made verified progress. This review continues that work across all six characters.
Muted contact sheets cover their opening light and heavy attacks from two angles.
They show preparation, contact, follow-through, landing, and recovery.
The review found two large transition errors: Ronin's backward recovery slide and Ethan's arm jumps.
The existing blade actions already contain captured torso and leg motion; this change preserves that motion.

## Ronin

`Ronin_Power_Cut` retained 0.9874 metres of horizontal travel inside its pelvis animation.
Returning to ready removed that travel and dragged the body backward.
The model now keeps vertical motion locally and passes horizontal travel through the existing gameplay root-motion controller.
Collision and terrain use that same controller.
The motion record applies the same translation to its recorded hands, feet, elbows, and pelvis offsets.
The new ready pose copies the complete captured opening pose, including both hands and the lower body.

A comparison against the previous model checks 28,880 joint positions throughout the heavy attack.
The extracted path reconstructs the original world motion within 8.9e-16 metres.
This proves that extraction preserves the captured performance; it does not prove artistic quality by itself.

## Ethan

The ready pose now comes from the purchased `Ethan_GDH_Combo5_Review` performance.
It replaces the older polearm pose and retains the captured hand order, grip orientation, and stance.
Compatible sliding polearm grips now retain both authored arms during animation blending.
The displayed palms determine the distance along the shaft, while the primary station blends between clips.
The previous fallback arm solver caused abrupt elbow and hand changes during these transitions.
Fixed-grip compatibility still requires matching stations. Opposite hand orders remain incompatible.

## Shared preview stability

Dense playback exposed a floating-point overshoot in the golf shoulder easing function.
Near its endpoint, the polynomial could produce a negative blend weight and stop the preview.
The function now clamps its mathematical output range.
The preview browser check now covers complete cycles at both 60 and 120 updates per second.
All six character envelopes were rebaked for camera framing.

## Reproduction

Use models and motion metadata from commit `04cba64` as the baseline.
Run `tools/extract-existing-attack-root.mjs` on `Ronin_Power_Cut`.
Run `tools/capture-ready-pose.mjs` using that extracted clip for `Ronin_Ready`.
Use `Ethan_GDH_Combo5_Review` at time zero for `Ethan_Naginata_Ready`.
Ready metadata copies the source's attachment flags and its first pose into a static two-second record.
Its impact list is empty, and both feet have contact windows for the full idle.
The ready-channel tests verify every source transform and the weapon attachment metadata.

## Verification

Twenty focused unit checks pass for captured ready poses, paired grips, root travel, and current preview asset hashes.
The fractional-frame shoulder regression also passes.
The paired-transition browser test covers 180 fixed and sliding cases, including every current Ethan attack paired with ready.
No arm correction changes the captured arm transforms in those compatible transitions.
All six selection cycles pass at 60 and 120 updates per second, including playback controls and menu cleanup.
Eighteen real-combat cases pass for Ronin and Ethan at 40, 60, and 144 updates per second.
They include standing, running, and queued-light recovery, with actual damage and weapon attachment checks.
Ten viewport/control layouts and all four course backgrounds pass the complete selection-framing test.
The framing test now waits for deferred navigation callbacks before checking the next camera.

The private production build is `index-Lj3GQsdA.js`.
The build succeeds with the existing large-chunk warning.
The exact production bundle passes mouse-driven Ronin and Ethan heavy attacks after normal golf shots.
Ronin retains 1.0862 metres of world travel after returning to ready, matching the captured path at gameplay scale.
Both production runs report no browser errors. Their selection poses were also visually checked.
Evidence is under `/Users/yishan/ninja-golf/artifacts/reviews/attack-body-audit-2026-10-05/`.
It includes before/after contact sheets, joint comparisons, test logs, and a muted gameplay recording.

## Remaining work

The broad AAA objective remains incomplete.
Some characters still share captured attack patterns; this review does not establish distinct, finished movesets for everyone.
Do not replace complete captured motion with isolated arm, foot, or pelvis corrections without showing a visible full-body improvement.
No scenery work, public publication, fleet computation, or external-model review occurred during this pass.
