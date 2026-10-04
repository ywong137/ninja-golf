# The Ace: connected full-body combo

The Ace now uses three connected light cuts from Quaternius UAL2 `Sword_Regular_Combo` (CC0).
This is the same source performance used for The Closer, fitted to the Ace's body and straight sword.
The source controls the lunge, torso turn, raised-knee transition, balancing arm, and recovery.
Early input connects matching source poses. Late input retains the recorded recovery and normal blend.
Horizontal source travel moves the gameplay actor through existing collision handling.
The complete early-input chain takes about 2.55 seconds.

The transfer retains the existing character mesh, face, wardrobe, rig, and all 39 previous animations.
Three appended clips add 1,086,664 bytes to the model.
The final model SHA256 is `85561f63b3cde7da5a7fa4569f0e479280797a9313c4644e3b07b6de3314098b`.

## Fitting and review

The transfer uses stable elbow planes, native joint limits, and a bounded head/neck lift.
The jian retains its 78 cm blade. Its one-handed handle is now 18 cm, down from 32 cm.
A fixed 34-degree axial grip rotation aligns the cutting edge with the main strike intervals.
A four-degree forward shoulder correction clears the handle during the finishing recovery.
That correction acts only within native seconds 2.02, 2.15, 2.24, and 2.42 of the continuous source.
It rotates the whole arm without changing its length or bending the wrist to hide an intersection.
The finishing landing phase adds 60 ms, as in the existing Closer assembly.

Opus 5.5 reviewed seven candidate stills through a CLI session configured with high effort.
It found no blocking backward joint, hyperextension, reversed torso, or collapsed pelvis.
It requested the bounded head lift and review of the recovery and moving foot contacts.
The final head lift and shoulder correction came after that review.
The still review does not establish final motion quality or perfect foot contact.

## Verification

- Forty-five focused tests passed, covering assets, original-data preservation, anatomy, timing, source boundaries, playback, weapons, and preview bounds.
- Thirty muted gameplay cases passed for the Ace at 40, 60, and 144 Hz.
- Thirty matching Closer cases passed after sharing the gameplay checker.
- Cases cover partial, complete, late, heavy, interrupted, repeated, moving, and terrain attacks.
- The checker invokes real damage against forward and rear enemies. Forward targets receive damage; rear targets remain unharmed.
- Both early-input boundaries have identical incoming poses and skip blending. Late inputs retain recovery.
- All three final weapon checks found zero crossings against the head, torso, opposite arm, and legs.
- Fifteen reviewed strike intervals passed the blade-direction check, including source travel in world space.
- The three Ace intervals have edge alignment of 0.900, 0.958, and 0.958. Their flat alignment stays below 0.357.
- All six preview cycles, ten selection layouts, C controls, and the production build passed.

A silent gameplay recording shows the complete sequence from two camera directions.
The native joint checks sample at 240 Hz and reject signed elbow or knee reversals.
The weapon remains visible throughout gameplay actions.

## Limits

The source still has visible foot glide during entry and recovery.
Near-floor vertex movement also includes unloaded toes, so those measurements do not prove loaded-foot sliding.
This release does not claim perfect foot locking, unique authored choreography, or photorealistic movement.
It replaces the Ace's light chain only. Her existing heavy attacks and musou remain unchanged.
The broader game remains an alpha.

## Reproduction

Use the Ace model from commit `4b519f1` as the base.
Use `UAL2_Standard_RM.glb` from the existing local Quaternius source folder.
Bake three studies with `tools/transfer-sword-study.mjs`:

- Full: `Sword_Regular_Combo` into `Ace_Combo_Source`.
- Opening: `Sword_Regular_A` plus `Sword_Regular_A_Rec` into `Ace_Opening_Source`.
- Return: `Sword_Regular_B` plus `Sword_Regular_B_Rec` into `Ace_Return_Source`.

Use `--hero kaede --template Ace_Cut_Diagonal --palm-frame --palm-pronation-fit --grounded --joint-fit --stable-arm-pole --sample-rate 240 --look-ahead`.
Add `--right-arm-forward 4 --right-arm-window 2.02,2.15,2.24,2.42` to the full study only.
Keep all outputs outside `public/` until review passes.

Assemble with the shared tool:

```sh
node tools/assemble-connected-sword-combo.mjs \
  --hero kaede --prefix Ace --study STUDY --base BASE.glb \
  --opening-model STUDY/opening/kaede.glb --opening-clip Ace_Opening_Source \
  --template Ace_Cut_Diagonal --grip-roll .5934119456780721
node tools/playtest-connected-combo.mjs --hero kaede --output REVIEW
```

The old Closer commands remain compatibility wrappers for the shared tools.
Local evidence lives in `artifacts/reviews/ace-connected-combo/` in the primary checkout.
The final real-damage reports are `integrated-damage/report.json` and `closer-regression/report.json`.
Final surface reports are in `review-opening`, `review-return`, and `review-finish`.
Earlier candidate directories contain known failures and do not represent the released motion.
