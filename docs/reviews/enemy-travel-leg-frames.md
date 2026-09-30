# Enemy running and jump leg frames

The old correction placed the knees forward, but it did not align the bones with each knee's hinge. The native frames still bent sideways by up to 26.43 degrees. Some passing legs also crossed through each other.

The new bake corrects both legs in seven clips on all three enemy outfits. It changes only the thigh, calf, and foot rotation channels. A small outward knee direction keeps the legs separate during running. During the jump tuck, an airborne shoe can turn with the shin. This avoids forcing that rotation into the hip.

The runtime also matches stride timing to actual travel speed and model scale. Previously, each combat role normalized the same animation against its own speed. Slow guards therefore moved their feet much faster than their bodies.

## Checks

- All 480 unit tests and the release build passed in an isolated copy of the proposed release.
- All 72 browser cases passed: three outfits, four roles, forward and backward movement, at 40, 60, and 120 updates per second.
- These cases include the initial idle blend, jogging, sprinting, emergence, landing, and the return to running.
- The maximum live knee deviation was 0.000027 degrees. Hip twist stayed below 15.04 degrees; ankle twist stayed below 7.60 degrees.
- At 480 samples per second, none of the 21 corrected clip/outfit combinations had intersecting leg surfaces. The minimum gap was 4.575 mm.
- The old hoodie clips had 151 crossing triangle pairs during jogging, 165 during sprinting, and 586 during jump start. These counts cover the full sampled clips.
- At sprint time 0.633 seconds, the original gap was 12.825 mm. The new gap is smaller there, but remains positive throughout the clip.
- The ninja shares the hoodie's base trousers. Its test includes the additional weighted cloth and checks a distinct triangle count.
- Original geometry, textures, skin weights, and eight unrelated clips remain unchanged. Each model retains all 1,638 non-leg channels inside the seven changed clips.
- At 960 samples per second, resampling changes a foot position by at most 1.074 mm. Ground shoe rotation differs by at most 0.184 degrees.
- The largest airborne shoe correction is 23.85 degrees. Both shoes return within 0.00008 degrees of the original direction before jump start ends. During the return from 0.45 to 1.183 seconds, the maximum shoe rotation change is 3.85 degrees per frame at 60 Hz.
- Reapplying the authoring tool to a corrected asset fails explicitly.

The stride test measures an 87% reduction in aggregate median sliding across the four role speeds and two gaits. The longer browser test measures actual foot movement over several complete strides. Worst median longitudinal sliding is 0.248 m/s while jogging and 0.586 m/s while sprinting. The worst 95th percentiles fell from 3.065 to 0.622 m/s for jogging and from 5.943 to 3.667 m/s for sprinting. Maximum sliding fell from 3.172 to 1.021 m/s and from 6.023 to 5.136 m/s. The browser regression checks medians, 95th percentiles, maxima, and minimum sample counts. Sprint footfall transitions still need a separate contact-locking pass; the current change does not eliminate all sliding.

A muted combat recording at 1440×900 averaged 57.15 FPS with 23–43 enemies. It reported no browser errors.

## Review limits

Claude Opus 5.5 High found no blocking defect in the 60 reviewed still panels. It requested additional checks on shoe rotation, clip use, clearance, and sliding. The measurements above address those questions. A final Opus review found no issue that blocks this scoped change. Still images and numeric limits do not establish full animation quality.

The game uses Jump_Loop and Jump_Land for enemy emergence. Jump_Start remains an unused library clip. Idle_Loop appears during construction and blends into Sword_Idle on the first update. The existing 2.43 cm jog loop mismatch remains. Hero running and sprinting require further ankle review.

## Reproduction

The source assets come from commit `7840b2c5b66b25da36dc683ef7133175e052cb19`. Extract those assets before running `tools/author-enemy-locomotion.mjs`. Write each candidate outside `public/`, inspect it, then install it. The tool rejects assets that already contain this correction.

Run `tests/enemy-appearances.test.js`, `tests/native-leg-clearance.test.js`, and `tests/enemy-stride-contact.test.js` with Node's test runner. With Vite on port 5173, run `tests/browser-enemy-leg-frames.mjs` and `tests/browser-enemy-appearance.mjs`.

Local review images, reports, review responses, and the combat recording are in `artifacts/source-motion-review/enemy-travel-leg-frames/`.
