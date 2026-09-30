# Hero running: free-leg and ankle correction

The old solver kept each shoe almost level while its shin folded behind the body. This bent the shoe toward the shin during recovery. It also twisted the hip and ankle to maintain a horizontal shoe heading.

The free knee now follows the pelvis's native bend plane. The shoe follows the shin, with separate smooth limits for pitch and sideways rotation. The correction fades in after support and fades out before contact. It preserves the original ankle paths, rigid segment lengths, and loaded shoe rotations.

Native calibration now lives in `src/leg-anatomy.js`. Authoring tools re-export that implementation. The measurements include ankle pitch and rotation outside that pitch plane.

## Verification

The browser regression covers all six heroes in 108 cases. It includes running, sprinting, eight focused directions, slopes of ±0.1, and frame rates of 40, 60, and 120 Hz.

| Measurement | Published source | Correction |
|---|---:|---:|
| Maximum hip axial rotation | 59.24° | 22.26° |
| Maximum ankle axial rotation | 43.83° | 16.57° |
| Maximum ankle pitch during full correction | 114.88° | 39.32° |
| Maximum rotation outside the ankle pitch plane during full correction | 34.15° | 12.23° |
| Maximum support drift | 13.97 mm | 13.97 mm |

“Full correction” means leg phase 0.44–0.82. The pitch measurements do not cover the entire airborne interval. These numbers describe the game rig, not clinical joint limits.

A second check samples each hero's sprint at 240 and 960 points per cycle. Peak shoe, shin, knee-direction, and knee-position speeds converge within 1%. Corrected peak shin speed remains within 1% of the source control. The source control disables only the recovery weight in an isolated browser page.

The corrected shoe rotates faster because it follows the shin. An earlier guess of 25 radians per second rejected that motion without measuring its cause. The final regression checks convergence and compares shin speed with the source instead.

Actual skinned leg surfaces were also checked at 240 Hz. Twelve forward run/sprint cases contained no intersections. Minimum clearance was 26 mm. This check includes shoe, calf, and lower-thigh triangles. It excludes the shared upper-thigh seam.

Six native-rig unit tests verify ankle targets, segment lengths, knee hinges, shoe orientation, and unchanged support. They include an outer rotation and scale. The older locomotion test now compares horizontal toe direction only during support. Free knees use native hinge measurements instead.

The isolated release passed all 486 unit tests and the production build. Browser checks for locomotion, attack-to-run transitions, travel transitions, and foot placement also passed.

The final combat capture averaged 59.48 FPS at 1440×900, with 24–47 enemies and no page errors.

## Opus review and remaining issues

Claude Opus 5.5 High reviewed the earlier candidate and the close-view sheets. It confirmed the visible shoe/shin improvement. It did not approve the full animation from stills.

Its review identified a speculative 135° fold cap and hard angular clamps. The final change removes that fold cap and smooths the angular limits. It preserves the authored sprint tuck. The final surface check found no free-shoe/stance-leg intersections during forward movement.

Known source problems remain:

- The rear heel stays low near toe-off. The early fade still retains that source pose.
- Some backward recovery poses regain excessive ankle pitch during the return to contact.
- Backward diagonal blends can cross the legs. This correction does not change their foot paths.
- Downhill adaptation can produce deep knee folding near 160°.

Review artifacts, source controls, renders, and raw measurements are stored locally in `artifacts/reviews/hero-run-recovery/`. They are excluded from the deployed game.
