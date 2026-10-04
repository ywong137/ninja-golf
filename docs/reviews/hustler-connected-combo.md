# The Hustler: connected sword attacks

The Hustler now has three connected light attacks from Quaternius UAL2 `Sword_Regular_Combo` (CC0).
The source supplies the steps, body turns, balancing arm, passing step, and recovery.
This is the same source family used by the Ace and Closer, fitted to the Hustler and her dao.
Early input continues between matching poses. Late input retains the full recovery before the next cut.
Horizontal source travel uses the existing gameplay collision handling.
The complete early-input chain takes about 2.55 seconds.

The transfer preserves the selected House Advantage outfit, likeness, geometry, skin weights, and all 41 previous clips.
It appends `Hustler_Combo_Opening`, `Hustler_Combo_Return`, and `Hustler_Combo_Finish`.
The existing heavy attack and musou remain available.

## Fitting

The transfer uses stable elbow planes and the shared anatomical limits.
The free shoulder opens by up to 20 degrees to clear the clothing.
The head and neck share a bounded gaze correction.
A fixed 34-degree axial grip rotation keeps the dao's cutting edge ahead of its flat face.
The primary grip is -0.01 metres, reducing the handle length behind the fist without changing the weapon geometry.
The finishing step gains 60 milliseconds, as in the shared combo assembly.

## Verification

Thirty muted gameplay cases passed at 40, 60, and 144 Hz.
These cover single cuts, partial chains, full chains, late input, heavy attacks, replacement input, dodges, repetition, movement, and terrain.
Real damage reaches forward enemies without hitting the rear targets.
The weapon remains visible, actions finish, and early chain transitions need no pose blend.

The joint checks sample all three clips at 240 Hz.
They found no reversed elbow or knee hinge.
The maximum wrist bend is 26.65 degrees. The maximum arm step is 8.04 degrees per sample.
All three weapon checks found zero intersections with the sampled head, torso, opposite arm, and leg surfaces.
Minimum clearances were 6.66 mm, 4.23 mm, and above the 30 mm reporting cap.
The three runtime strike windows have weighted transverse edge alignment of 0.926, 0.956, and 0.977.
Flat alignment stays below 0.317.

The binary preservation check retains 19,029,504 original bytes and all 41 original animations.
The final model SHA256 is `23b7543e3d23b6581f14fd19cdea7f6e5f5985a7482eb783dfc9644e003e347a`.
Private evidence is in `artifacts/reviews/hustler-connected-combo/` in the primary checkout.
The muted gameplay recording is `gameplay/ayame-combo.webm`.

The integrated release passes 65 focused tests and three additional Hustler anatomy checks.
The shared edge regression covers all nine connected cuts across the Ace, Closer, and Hustler.
Six full selection cycles, ten layouts, and the C animation controls pass.
The production build passes.

The preceding musou-only CI run failed because two asset records still contained the previous model hash.
The corrected records retain the original wardrobe proof and verify all later appended animation data.
The preview bounds were regenerated from the current visible geometry at 60 Hz.

The next CI run passed 970 checks but found one inconsistent knee limit in the older roster test.
That test recognized the Ace and Closer versions of the shared UAL2 lunge, but omitted the Hustler.
It now identifies the reviewed source and return/finish phases, preserving the same 125-degree limit across characters.
Unrelated attacks retain their 120-degree limit. The model and motion data did not change.
The Hustler return reaches 124.35 degrees, matching the Ace within 0.001 degrees.
All 18 connected-combo and full roster leg tests pass, including the stricter 480 Hz knee sampling.
Run both `tests/source-connected-combo.test.js` and `tests/combat-leg-frames.test.js` after adding a shared combo.

## Limits

Some source foot glide remains during entry and recovery.
The source library supplies authored animation; this review does not claim motion capture or unique choreography.
These changes improve the normal light chain. Other remaining attack branches still need review.
The game remains an alpha.

## Reproduction

Use the Hustler model from commit `9c41f1c` as the base.
Use the existing `assets/source/quaternius-ual2/UAL2_Standard_RM.glb` source.
Bake these studies with `tools/transfer-sword-study.mjs`:

- Full: `Sword_Regular_Combo` into `Hustler_Combo_Source`.
- Opening: `Sword_Regular_A` plus `Sword_Regular_A_Rec` into `Hustler_Opening_Source`.
- Return: `Sword_Regular_B` plus `Sword_Regular_B_Rec` into `Hustler_Return_Source`.

Use `--hero ayame --template Ring_Cut_Diagonal --palm-frame --palm-pronation-fit --grounded --joint-fit --stable-arm-pole --sample-rate 240 --look-ahead --free-arm-space 20`.
Keep the studies outside `public/`.

```sh
node tools/assemble-connected-sword-combo.mjs \
  --hero ayame --prefix Hustler --study STUDY --base BASE.glb \
  --opening-model STUDY/opening/ayame.glb --opening-clip Hustler_Opening_Source \
  --template Ring_Cut_Diagonal --grip-roll .5934119456780721
```

Set `primaryGrip: -0.01` on each assembled motion record.
Run `tools/playtest-connected-combo.mjs --hero ayame --output REVIEW --record` after integration.
