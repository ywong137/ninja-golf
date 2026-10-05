# Character movement review — 2026-10-05

The user identified abrupt Shinobi heavy attacks, the Ace's stiff stance, sunken selection feet, and distorted golf shoulders.
The review covers full-body movement before further scenery work.

## Changes

The Shinobi's normal heavy attack now plays one complete captured leaping cut, including preparation, landing, and recovery.
Light attacks use the captured stepping cuts, alternating hands through the combo.
The old heavy sequence inserted 75-millisecond disappearances, position offsets, and instantaneous 120-degree heading changes.
Those transitions remain exclusive to his separate shadow musou sequence.
Selection and gameplay use the same normal attack definitions and clips.
Selection shows the opening light and heavy attacks, not every combo variant.

The Ace's ready pose now uses the complete first frame of her captured stepping cut.
The pose has staggered feet, bent knees, a lowered blade, and a forward body inclination.
It includes the six rotation channels absent from the old idle, including wrists and toes.
The shared stance metadata preserves the captured weapon mount.
The reproduction tool is `tools/capture-ready-pose.mjs`.
Use `kaede.glb` from commit 840a20f, source `Ace_Cut_Diagonal`, target `Ace_Ready`, and time zero.
Copy the source's first motion sample and attachment fields into the two-second ready record.

The selection preview now passes terrain heights to the same foot-placement controller as gameplay.
Its root height also follows the terrain during extracted attack travel.
Preview contact correction prevents source soles from retaining their original floor penetration.
The actual selection review samples all six characters at address, ready, light attack, and heavy attack.
The Ace's revised ready soles measure approximately zero and eight millimetres above the sampled ground.
Other sampled poses retain small source sole differences below seven millimetres.
These measurements describe the captured selection course, not every possible terrain point.

The golf shoulder fix distributes the lead arm's aiming rotation through the existing shoulder skin helpers.
The proximal helper retains 68 percent of the rotation; the next helper retains 88.8 percent.
It starts at address strength, then fades smoothly between 0.95 and 1.30 seconds of the swing.
It follows active action weights during transitions and works for all six playable rigs.
Joint positions, bone lengths, the body turn, the paired grip, and the club path remain unchanged.
The change reduces the angular shoulder cap; it does not certify perfect anatomy or animation.

## Verification

The Shinobi passes nine actual-combat cases at 40, 60, and 144 FPS.
The cases cover standing, running, and queued-light recovery.
Both weapons remain visible and attached, one real damage event occurs, and control returns after each heavy attack.
A muted gameplay recording preserves the complete revised attack.

Thirty-four existing focused unit checks pass for limb skinning, shoulder transitions, attack timing, root travel, and selection clocks.
Eight added checks cover the complete captured ready channels, the absence of heavy teleports, and shared shoulder continuity.
Across all six rigs, 1,734 sampled swing poses preserve every anatomical joint matrix exactly.
The same shoulder pose remains independent of previous scrubbing positions.

The existing selection test needed two maintenance changes.
It now waits for deferred UI callbacks and computes the full preview duration from its stages.
The previous fixed twelve-second window could not cover Ethan's longer purchased attack.

Review captures, measurements, the before-model, and the muted video remain under
`artifacts/reviews/body-review-2026-10-05/` in the primary workspace.

The complete selection browser test passes for all six characters.
It covers C, speed, pause, resume, direct phase selection, exact seeks, frame steps, and menu cleanup.
The six-rig shoulder browser test also passes through repeated swings and idle/death transitions.
The production build succeeds as `index-8u1QRuX6.js`.
The bundler retains its existing large-chunk warning.
