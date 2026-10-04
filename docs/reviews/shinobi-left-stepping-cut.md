# Shinobi left-hand follow-up

The second light attack now uses `Shinobi_Left_Stepping_Cut`.
It replaces `Twin_Cut_Return` through the existing character override.
The first and second attacks now use opposite-handed versions of one complete source performance.
The later light attacks and musou retain their previous clips.

The source is Quaternius UAL1 `Sword_Attack`, under CC0.
The approved right-hand adaptation remains unchanged.
The new tool mirrors its world-space rotations relative to each opposite bind frame.
It does not negate local Euler angles or invent replacement limb paths.
Both hands retain the fitted closed grips.

Native duration is 1.5333333 seconds. Playback is 1.35x.
The left blade strikes at native time 0.425 seconds.
The right blade covers and balances. It produces no strike trail or additional hit.
The fixed handle roll is -1.136744268029348 radians.
The clip uses the existing 0.14-second transition blend and complete source recovery.

## Reproduction

Start with the model from commit `205ba1c`.

```sh
node tools/mirror-sword-motion.mjs --input BASE/shinobi.glb \
  --clip Shinobi_Stepping_Cut --name Shinobi_Left_Stepping_Cut \
  --output REVIEW/mirrored/shinobi.glb --grips src/grip-data.json --hero shinobi
node tools/assemble-source-attack.mjs --base BASE/shinobi.glb \
  --source REVIEW/mirrored/shinobi.glb --source-clip Shinobi_Left_Stepping_Cut \
  --template Twin_Cut_Return --name Shinobi_Left_Stepping_Cut \
  --output REVIEW/assembled/shinobi.glb --grips src/grip-data.json \
  --hero shinobi --dual-wield --impact .425 --speed 1.35 \
  --grip-roll=-1.136744268029348 \
  --credit 'Quaternius UAL1 Sword_Attack (CC0); complete source performance mirrored for the left hand'
```

Set `impactHands` to `["l"]` and `entryBlend` to `0.14` in the exported record.
Rebuild the selection bounds after integration.
Mirroring alone does not establish blade direction, joint quality, or clearance. Verify each new adaptation.

## Verification

The candidate preserves all 40 prior clips, all mesh definitions, the rig, the face, and the selected outfit.
It preserves the original 19,195,384 binary bytes exactly.
The model now contains 41 clips.

Eight sampled source poses differ from the reflected native joint positions by at most 0.00000194 metres.
Dense joint checks find no reversed knees or elbows.
The mirrored wrist stays below 27 degrees.
The two-blade surface check finds no intersections at 120 Hz, including the head, torso, and limb surfaces.
The reported minimum clearance reaches the diagnostic cap of 30 mm.
The runtime left-blade cutting alignment is 0.988; blade-flat alignment is 0.134.

Thirty gameplay cases pass at 40, 60, and 144 Hz.
They cover partial/full chains, early/late input, heavy attacks, dodge, repetition, movement, and terrain.
The unchanged circular finisher retains two hits and rear-target damage.
A dodge before the first contact cancels that hit.
The private test initially assumed a different character's finisher and dodge timing. The final script checks Shinobi's actual rules.

Opus 5.5 High reviewed eight two-view frames and found no major anatomical reason to reject the movement.
Its two uncertain blade overlaps have no intersections in the separate surface audit.
The still review does not establish timing. The runtime checks and silent recording cover transitions separately.
Some source foot glide remains; this change does not establish perfect foot locking.

Private evidence: `artifacts/reviews/shinobi-cross-cut` in the primary checkout.
Key files: `preservation.json`, `focused-final.log`, `edge-final.json`, `final-review/clearance.json`,
`gameplay/report.json`, `gameplay/shinobi-combo.webm`, and `opus-review.json`.

## Rejected alternatives

The owned Mixamo Cross Slash trial produced 19 blade/body crossing samples at 120 Hz.
It remains private and is not part of this release.
The previously rejected Dual Weapon Combo and Double Dagger Stab were not fitted again.
The Game Dev Hero commercial pack needs explicit permission for easily extractable public game assets.
The Rokoko free download requires marketing registration. No account enrollment or purchase occurred.
