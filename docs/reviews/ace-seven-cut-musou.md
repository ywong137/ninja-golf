# Ace seven-cut musou

The Ace now performs three fast cuts, then a four-cut advancing finish. Complete source performances replace the previous small procedural swings.

The source is Quaternius UAL2, under CC0. Sword_Regular_Combo lasts 3 seconds. A 200 ms ready-pose bridge precedes Sword_Heavy_Combo.

The bridge retains root travel. Endpoint rotations differ by less than two degrees, except the feet. The largest foot difference is 20.83 degrees.

## Adaptation

The shared retargeter keeps the source body motion and fits anatomical joints. The weapon arm opens eight degrees. The balancing arm opens thirty degrees.

The existing Ace recovery adjustment adds twelve degrees of shoulder clearance over source 2.02–2.42 seconds. The native wrist controls the sword.

Landing phases receive 60 ms and 180 ms of extra time. Native duration is 7.7733 seconds. Gameplay uses 1.3x playback, or 5.9795 seconds.

Seven impacts replace six old impacts. Each uses 6/7 of the old damage. The final impact retains radial coverage and the explosion.

The jian uses a fixed 34-degree grip roll. Either sharpened edge can lead a cut.

## Validation

One appended clip preserves all 42 earlier animations and 22,754,296 original binary bytes. The mesh, face, clothing, and rig remain unchanged.

Dense checks found no reversed knees or elbows. Maximum sword-wrist bend is 27.32 degrees. Maximum sampled arm rotation is 8.05 degrees at 240 Hz.

The opening retains the existing regular-combo bound of nine degrees. This differs from the heavy-only musou bound of eight degrees.

The chest turns about 180 degrees. The pelvis changes height by 42.7 cm. Source horizontal travel is 7.72 metres before terrain collision.

All seven cutting windows lead with a sharpened edge. Weighted transverse alignment ranges from 0.79 to 0.96.

Nine gameplay cases pass at 40, 60, and 144 Hz. They cover standing, moving, and queued-light recovery. They verify damage timing, weapon visibility, grip attachment, and completion.

Opus 5.5 High reviewed eight poses. It found no major body-mechanics defect. This review cannot establish continuous timing or foot contact.

## Limits

Nine samples at 120 Hz contain brief weapon contacts with the body or opposite arm. They occur near native 1.68, 3.49–3.53, and 4.32 seconds.

Some source foot glide remains. The head also points low during two cuts. Do not claim perfect foot planting or collision-free motion.

## Reproduction

Private evidence is in the primary checkout: artifacts/reviews/ace-musou-source/. The source assembly is join-library-sequence.mjs.

The source transfer uses transfer-sword-study.mjs with palm-frame, palm-pronation-fit, grounded, joint-fit, stable-arm-pole, sample-rate 240, and look-ahead.

Use free-arm-space 30, arm-space 8, right-arm-forward 12, and right-arm-window 2.02,2.15,2.24,2.42.

Assemble Ace_Tempest_Source with assemble-source-attack.mjs as Ace_Musou_Tempest, using Fan_Musou_Flow as the template.

Use impacts 0.255, 0.721666, 1.58, 3.675, 4.34, 5.0, and 5.82. Set speed 1.3 and grip-roll 0.5934119456780721.

Use slow-phase 1.34,1.56,0.06 and 5.65,5.9,0.18. Set entryBlend to 0.12, damageScale to 6/7, and seven headings to zero.
