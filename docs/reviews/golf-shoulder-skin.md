# Ace golf shoulder skin — 2026-09-30

The Ace's lead shoulder formed a sharp peak during the golf release. The tattoo and dress strap showed severe distortion near 1.47 seconds.

This change reduces that distortion. It does not repair the underlying shoulder pose or all underarm folds.

## Change

The shared limb-skin controller adds two optional skin helpers to the Ace's lead upper arm. They distribute 25% of its axial rotation near the shoulder. The mid-arm helper retains 87.5% of the native rotation. Skin beyond 85% of the arm length keeps the full native rotation.

The correction rises smoothly from 1.26 to 1.44 seconds. It holds through 1.55 seconds and fades out by 1.82 seconds. It follows both actions during a repeated-swing crossfade.

The correction becomes zero before a principal-angle branch or singular swing. The measured runtime swing stays below 147 degrees, outside those fallback regions.

The helpers affect skin only. They preserve all anatomical joints, grip frames, club motion, and foot contacts. Other clips copy the native upper-arm skin transform. Other heroes and enemies do not acquire upper-arm helpers.

The model files, source skin weights, and materials remain unchanged. The existing controller owns and disposes its private geometry and skeleton palette.

## Evidence

- The inactive surface matches across 111 samples covering all 37 Ace clips. Maximum vertex difference: 0.0000000463 metres.
- All anatomical joint matrices remain unchanged across 1,153 swing samples.
- The active skin changes by at most 27.15 mm. Its maximum sampled helper rotation step is 3.25 degrees at 480 Hz.
- The actual runtime upper-arm twist peaks at 146.75 degrees in the correction window.
- A forced repeated swing preserves correction weight immediately, reaches 0.5 halfway through the fade, and reaches zero afterward.
- Across 2,432 authored keys and midpoints, arms, hands, shaft, and grip retain at least 5 mm of head/neck clearance.
- Across 1,153 samples, peak lead-arm/torso triangle intersections fall from 72 to 63. Forearm/torso and elbow-fold intersections remain zero.
- At 1.471 seconds, the 95th-percentile shoulder edge bend change falls from 51.32 to 39.89 degrees.
- The rear-leg regression passes at 40, 60, and 120 FPS. Maximum toe drift remains 1.194 mm.

The intersection count increases in 132 sample/side comparisons. A lower peak does not mean every frame improves. The inner-arm edge and underarm still need further work.

The browser tests also cover six heroes, preview seeks, idle/death transitions, and helper disposal. The existing golf test covers 150 phases and twelve finite clubface contacts.

## Independent review and rejected approaches

Claude Opus 5.5 High reviewed the images and implementation through the authorized Claude subscription. It identified a visible improvement at 1.471 seconds and little change at 1.550 seconds. It also identified repeat-action and branch risks. The implementation now handles both cases. A final review found no visible regression in the entry or exit frames. It found no release blocker for this limited change.

The review did not certify a correct shoulder pose. The remaining inner-arm edge remains faceted.

We rejected constant clavicle-roll changes, shoulder protraction, and local weight smoothing. They either increased intersections, created a notch, or displaced the strap. Dual-quaternion skinning removed the peak but produced a bulge and retained the crease.

The measured clavicle-to-chest twist is about 25 degrees, not the initial review's 99-degree hypothesis. Its swing contributes more of the discrepancy. The upper-arm/clavicle skin rotations differ by 156 degrees at the bad frame.

A neutral-clavicle probe leaves the existing lead-wrist target 56 mm beyond the arm's reach. A complete pose repair must therefore revise the grip path and shoulder motion together.

## Reproduction

```sh
node --test tests/forearm-twist.test.js tests/golf-shoulder-skin.test.js
node tests/browser-golf-shoulder-skin.mjs
node tests/browser-forearm-twist.mjs
node tests/browser-golf-motion.mjs
node tests/browser-ace-rising.mjs
```

The review artifacts remain under `artifacts/reviews/golf-impact/` and `/tmp/ninja-shoulder-frame/`. The machine-readable summary sits beside this document.
