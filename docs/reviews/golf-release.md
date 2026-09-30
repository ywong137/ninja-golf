# Ace golf release

The Ace's lead arm previously reversed its roll abruptly after contact.
This correction reduces that reversal and the repeated smaller changes during the early follow-through.
It changes six arm rotation channels between 1.40 and 1.70 seconds.
The other five characters retain their previous models.

[Normal-speed runtime recording](media/ace-golf-release.webm)

## Method

A 14 ms Gaussian filter supplies target upper-arm and forearm rotations in world space.
A constrained elbow swivel then fits those targets around the existing shoulder-to-wrist axis.
The fit preserves the native elbow hinge, segment lengths, and both complete wrist frames.
It retains the existing wrist and axial-rotation bounds.
The filter enters gradually from 1.40 to 1.43 seconds and exits from 1.64 to 1.70 seconds.
Both transition weights have zero first and second derivatives at their endpoints.

The fitting runs offline. The game plays the exported animation without an additional solver.
The [saved curves](../../tools/golf-release/README.md) rebuild the exact reviewed model from commit `6fb8995`.

## Measured change

The following measurements use 480 Hz native poses over 1.40–1.70 seconds.
They describe this animation and do not establish general human movement limits.

| Measurement | Previous | Revised |
| --- | ---: | ---: |
| Peak world upper-arm rotation | 2,655°/s | 1,299°/s |
| Peak native humeral roll rate | 2,610°/s | 836°/s |
| Peak forearm twist rate | 2,200°/s | 975°/s |
| Largest adjacent roll midpoint difference | 4.38° | 1.41° |
| Later midpoint difference, 1.56–1.70 s | 3.05° | 1.08° |

The midpoint metric detects alternating samples but also includes genuine motion curvature.
The full-window measurements prevent a narrow interval from hiding a worse change near a transition.
New regression checks reject the previous Ace model and pass the revised model.

Both wrist positions remain within 0.0005 mm of the source at the measured times.
Their world rotations remain within 0.00004 degrees.
The body, feet, fingers, club path, contact pose, and later finish retain their source motion.
The binary audit preserves the original geometry, materials, bindings, and 8,297 other animation channels.
The model grows by about 289 KB.

See [the measurements](golf-release-measurements.json) for hashes and preservation results.

## Review and limits

Claude Opus 5.5 High reviewed the measurements and actual runtime frames.
Its feedback narrowed the proposed release to the Ace, where the improvement was substantial.
It also prompted the extended correction for the later roll reversals.
The review found no new visible anatomical or grip defect in the supplied frames.
Opus used sampled images and could not watch continuous video.

The original upper arm intersects the garment in some poses.
A dense surface comparison finds the same peak triangle-pair counts, but some individual poses have more intersecting pairs.
Pair counts do not measure penetration depth or volume.
The correction does not resolve that clothing defect.
The reviewed forearm-to-torso and elbow-fold surfaces have no crossings in either version.

The source club still slows near contact and accelerates again afterward.
The torso and club path require a coordinated redesign.
Timing-only and whole-path experiments remain outside the release because they did not resolve that problem reliably.
This is an incremental arm correction, not a claim of finished golf animation.

## Validation

The isolated release passes all 560 unit tests and the production build.
The exact candidate passes 1,077 head-clearance poses, with no crossings among the eight tested parts.
The native joint check samples 9,702 golf poses across address, swing, and putting.
A separate 480 Hz skin comparison covers 145 poses during the correction.

Browser checks cover 150 golf phases, both complete hand frames, fixed club length, and twelve finite clubface contacts.
All six selection cycles pass, including C, speed, pause, resume, and state cleanup.
The new preview bounds pass ten desktop layouts, six complete cycles, and all four course themes.
Normal-speed and quarter-speed runtime captures report no browser errors.
Sampled comparisons across the final transition show no new pose discontinuity.
These checks do not establish complete animation quality or full-course performance.
