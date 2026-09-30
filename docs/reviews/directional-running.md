# Directional running: coherent turns and backpedaling

The old diagonal blend combined feet from incompatible hip directions. At a rear diagonal, each foot could pass into the other leg's path. Changing the knee hinge alone could not repair those paths.

The new controller separates running from backpedaling. A small angle margin prevents repeated changes between them during sideways travel. The hips turn while each free foot moves into its next path. Pivot steps use shorter support.

The source animations still supply the gait and upper-body motion. Straight forward running and sprinting retain their existing paths until a turn requires adaptation. Controls and movement speed remain unchanged.

## Rig and contact corrections

Both native thighs attach to `spine_01`. That bone must receive the full hip turn. Applying part of the torso counter-rotation there moved the hip joints and caused a knee jump. The controller measures the actual native bone frames and preserves their initial offsets.

The controller also:

- Limits hip rotation against the supporting shoe's measured heading.
- Rolls the shoe around its calibrated toe or heel while that contact stays fixed.
- Preserves position and rotation when the foot leaves the ground.
- Lands at the end of the actual swing path, without snapping to a new target.
- Keeps each step's support duration fixed, except for an explicit release near the leg's reach limit.
- Prevents a released foot from landing twice in one cycle.
- Limits free-foot landing positions and anticipates support height.
- Bounds the pelvis correction speed instead of dropping it abruptly.
- Keeps camera turns continuous across the 180-degree angle boundary.
- Blends from the corrected running pose when an attack or idle animation begins.
- Resets world anchors when running ends or a debug pose seeks in time.

A late transition into the controller does not compress a complete foot roll into the remaining support time.

## Verification

The isolated release passed all 496 unit tests and the production build. Ten focused unit tests cover support contact, foot rolling, phase-zero release, landing continuity, and direction changes. Browser checks measure the rendered skeleton and shoe contacts.

The anatomy regression covers all six heroes at their actual movement speeds. It includes 48 gradual and abrupt turns with two initial gait phases.

| Measurement | Maximum |
|---|---:|
| Hip axial rotation | 29.77° |
| Loaded hip axial rotation | 23.37° |
| Ankle axial rotation | 15.51° |
| Support contact drift | 10.73 mm |

These values describe the game rigs and authoring checks. They are not clinical joint limits. During a foot roll, the contact measurement uses the rendered toe or heel. Ankle movement alone would incorrectly count the roll as sliding.

A second regression samples four movement cases at 60, 120, 240, and 480 Hz. Peak joint and shoe speeds converge under finer sampling. The final turn cases require no additional pelvis drop. The earlier candidate reached approximately 58 mm.

Another 90 cases cover fast camera turns and transitions from running to attacks or idle. These sample 120, 240, and 480 Hz. They include stopping and attacking immediately after a camera spin. Before correction, removing the running controller caused a one-frame hip jump. The transition now starts from the actual corrected pose.

The surface check measures the skinned leg meshes after each turn starts. It covers 18 cases: all six heroes turning 0→135°, 90→135°, and 90→−90°. None intersect. The minimum measured clearance is 13.78 mm. The shared upper-thigh seam is excluded from this measure.

Existing locomotion, running recovery, attack-to-run, travel-transition, and terrain-foot-placement checks also passed. Running recovery covers 108 cases. Attack-to-run covers 288 cases.

A separate slope check covers 24 turns uphill and downhill across all six heroes. Maximum hip rotation is 31.95°, loaded hip rotation 27.41°, and ankle rotation 16.47°. Maximum support contact drift is 10.75 mm.

A muted combat capture averaged 57.91 FPS at 1440×900 with 30–44 enemies. It included rapid focused camera turns and had no page errors. Head-to-hip yaw stayed below 72.21°.

A landing now resets the previous contact's reach measurement. Across 48 turn cases, 14 early releases remain, with at most one per case. These occur during direction changes; repeated premature releases during normal support are corrected.

## References and review

The [KayKit character animation pack](https://kaylousberg.itch.io/kaykit-character-animations) supplied a CC0 reference for studying lateral and backward motion. No new character or animation asset from that pack ships in this change.

Claude Opus 5.5 High reviewed the diagnosis and intermediate code. Its reviews identified shoe-release jumps, contact rescheduling, wrapped body angles, and excessive pelvis lowering. Those findings guided the corrections above. The final review confirmed that the bounded torso counter-turn resolves the winding problem. Still images do not establish full animation quality.

Local review artifacts live in `artifacts/reviews/directional-running/`. They include measurements, reference renders, and Opus reviews. They are excluded from the deployed game.

## Scope

This change repairs directional footwork and transitions. The larger character-animation work remains active. It does not establish AAA quality for the whole game.
