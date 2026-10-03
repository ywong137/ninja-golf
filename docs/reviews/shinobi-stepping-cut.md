# Shinobi opening light attack

The Shinobi now opens his light combo with a complete Quaternius Sword_Attack performance. The original source uses CC0 licensing. The transfer keeps the step, torso turn, body drop, balancing arm, and recovery. His right sword cuts. His left sword covers and balances the movement.

The new clip appends to the existing model. It preserves all 38 previous clips, the costume, the face, and the rig. The wardrobe regression verifies the original binary prefix and animation descriptors. The model gains approximately 196 KB.

The cut plays at 1.35 times the source speed. Damage occurs at native time 0.425 seconds. Both sword mounts keep a fixed 60.42-degree axial offset through this clip. The offset aligns the attacking edge with travel without twisting the wrist. Only the attacking sword emits a strike trail.

## Verification

- The source transfer keeps anatomical elbow and knee hinges. Maximum wrist bend is 26.46 degrees. Maximum arm rotation between 240 Hz samples is 8.85 degrees.
- The feet travel up to 0.84 metres relative to the actor. The pelvis changes height by 0.263 metres. The chest rotates through 152.6 degrees.
- Both blades clear the sampled head, torso, and limbs throughout the clip. The measured gap exceeds 3 cm.
- The gameplay strike window has 0.985 average edge alignment and 0.141 average blade-flat alignment.
- Nine gameplay cases cover standing, moving entry, and queued light attacks at 40, 60, and 144 Hz. They check actual damage, timing, recovery, and both weapon grips.
- All six character preview cycles pass. Pause, speed, scrubbing, frame stepping, and the C console pass.
- Opus 5.5 High accepted the eight pose comparisons. It could not judge timing or foot sliding from still frames.

The gameplay review includes a silent recording. The attack lunges in place; it does not add forward actor travel. Opus noted that its 1.14-second total duration may feel slow for a light attack. This remains a gameplay consideration, rather than a proven animation defect.

This change replaces only the opening light attack. Later light attacks, heavy attacks, and musou retain their previous animations.

## Reproduction

Use the Shinobi model from commit `a7772aa` as the input. Run `tools/transfer-sword-study.mjs` with these arguments:

```text
--source UAL1_Standard.glb --hero shinobi
--clip Shinobi_Stepping_Cut --template Twin_Cut_Diagonal
--dual-wield --palm-frame --palm-pronation-fit
--grounded --joint-fit --stable-arm-pole
```

Supply the input model, grip data, and a separate review output. Then run `tools/assemble-source-attack.mjs` with the transferred source and the original base:

```text
--source-clip Shinobi_Stepping_Cut --template Twin_Cut_Diagonal
--name Shinobi_Stepping_Cut --hero shinobi --dual-wield
--impact .425 --speed 1.35 --grip-roll 1.054489544526125
```

Set `impactHands` to `["r"]` and `entryBlend` to `0.14` in the motion record. Rebuild the Shinobi selection bounds after integration.

Local evidence lives in `artifacts/reviews/shinobi-stepping-cut` in the primary checkout. This includes the source transfer, candidate, clearance results, Opus review, gameplay cases, and silent recordings.

The source exporter requires `--dual-wield` to retain both independent blade paths.
The first deployment failed because the offhand path was absent.
The corrected record passes the unchanged wrist interpolation test for all six characters.
