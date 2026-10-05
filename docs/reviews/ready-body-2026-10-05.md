# Ready stance review — October 5

The user requested a review of whole bodies, with natural stances and visible ground contact.
This pass follows the Ace, golf shoulder, Shinobi continuity, Ronin travel, and Ethan recovery fixes.
The author compared all six characters from front, side, and three-quarter views.
The comparison covers ready stances and golf poses. Separate sheets cover light and heavy attacks.

## Lower guards

The Hustler and Closer retained the old upright-sword stances.
Their opening attack clips already contain a lower guard, staggered feet, and relaxed shoulders.
Their ready clips now copy those complete poses, including wrists, toes, and skin helper channels.
This keeps the stance coherent with the attack instead of changing the sword arm alone.

The source clips are `Hustler_Combo_Opening` and `Closer_Combo_Opening` at time zero.
They derive from Quaternius UAL2, licensed CC0. They are authored animation, not claimed motion capture.
The target clips remain `Ring_Ready` and `Sickle_Ready` to preserve existing gameplay references.
Each ready clip lasts two seconds. Its metadata retains the source grip orientation and primary hand station.
Both feet have support windows throughout the idle. The idle has no attack impacts or extracted travel.

The capture tool now maps Three.js track names back to original GLB node names.
Some face bones contain spaces, which Three.js replaces in animation track names.
The tool rejects ambiguous aliases instead of patching the wrong node.

## Paused inspection

Production screenshots exposed a shared inspection bug after the initial pose updates.
Seeking stopped the animation mixer, but the hand grip still tried to fade from the previous pose.
A paused clock could never complete that fade. The golf grip then pulled a free sword arm behind the torso.
An exact seek now snaps the grip state along with the selected animation.
Normal playback retains its transitions. The change also initializes both golf hands on the first preview frame.

A regression reproduces the old retained grip before the fix.
After the fix, eighteen seeks from address, swing, and heavy attacks pass across all six characters.
Each grip has its intended state immediately. Free arm rotations match their recorded ready poses within floating-point precision.

## Verification

The update preserves geometry, materials, skin weights, and all 43 other clips in each model.
The original binary payloads remain byte-for-byte unchanged.
Twelve focused checks pass for complete source transforms, weapon attachment metadata, and current preview bounds.
All six full selection cycles pass at 60 and 120 updates per second.
The test also checks C, slow playback, pause, scrubbing, frame steps, and menu cleanup.
Eighteen combat cases pass for the Hustler and Closer at 40, 60, and 144 updates per second.
They include standing, running, and queued-light recovery with actual damage and attached weapons.
These update-rate checks test correctness, not GPU performance.

Selection screenshots show the Ace with her feet above the surface and a lower, staggered guard.
On the sampled course, her ready sole gaps are approximately zero and eight millimetres.
The Hustler and Closer measure approximately zero and four millimetres.
These samples do not establish perfect ground contact for every character on every slope.
Ethan's immediate ready seek still shows approximately two centimetres of sole penetration in this sample.
That small contact issue remains separate from the large movement corrections.

The final private build succeeds as `index-_Gdyd_Dy.js`, with the existing large-chunk warning.
Production screenshots confirm that the Ace and Hustler now show their free arms correctly during paused inspection.
Three production runs exercise normal selection, golf, and mouse-triggered heavy attacks for the Ace, Hustler, and Closer.
Their correct clips play and complete, with no browser errors. Both selection and gameplay use the shared attack definitions.
All automated review browsers have closed. The private server remains available at http://127.0.0.1:4185/.
Review evidence is in `/Users/yishan/ninja-golf/artifacts/reviews/ready-body-2026-10-05/`.
All review browsers stay muted.

## Scope

This pass adds no new attacks. It improves the stances used by selection and actual gameplay.
The women still share parts of their attack vocabulary; they do not yet have wholly distinct movesets.
Do not repeat the rejected Hustler cross-slash and combo-slash fitting attempts.
The earlier `hustler-power-finish.md` review already records their blade clearance failures.
No scenery changes or public publication occurred. The broad AAA goal remains incomplete.
