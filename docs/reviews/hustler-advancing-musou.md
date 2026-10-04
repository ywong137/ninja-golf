# Hustler advancing musou

The musou replaces six isolated procedural cuts with a complete four-cut performance. It includes preparation, advancing steps, torso turns, counterbalance, and recovery.

The source is Quaternius UAL2 `Sword_Heavy_Combo`, under CC0. The Closer already uses this source family. The Hustler retains her own body, dao, and grip fitting.

## Adaptation

The transfer preserves the source performance and applies the shared knee, elbow, wrist, and elbow-plane constraints. It opens the weapon shoulder by eight degrees.

A fixed 0.3-radian blade roll aligns the cutting edge. The grip station is -0.01 metres, reducing the handle length behind the palm.

Two step phases receive additional time: 140 ms at source 0.42–0.54 seconds, and 180 ms at 2.45–2.70 seconds. Every source pose remains.

The final native duration is 4.6533 seconds. Gameplay uses 1.1x playback, or 4.2303 seconds. The entry blend lasts 160 ms.

Four cuts replace six old hits. Each hit uses 1.5 times the previous damage. The final cut retains radial coverage and the finishing effects.

## Evidence

- One appended animation preserves all 40 prior animations and 18,145,888 original binary bytes. Geometry, likeness, clothing, and skin data remain unchanged.
- Dense anatomical checks found no reversed joints. Maximum sword-wrist bend is 27.32 degrees; maximum arm rotation between 240 Hz samples is 4.86 degrees.
- The chest turns about 180 degrees, and the pelvis changes height by 42.5 cm. Horizontal actor travel is 5.36 metres before terrain collision.
- All four tested cutting edges lead their impact velocity. Point measurements range from 0.73 to 0.82.
- The runtime audit also checks active strike windows with actor travel. Weighted transverse edge alignment ranges from 0.90 to 0.99.
- All 34 affected release tests pass, including assets, source anatomy, motion contracts, timing, and root travel.
- Nine gameplay cases pass at 40, 60, and 144 Hz. They cover standing, moving entry, and queued-light recovery.
- Those cases check real enemy damage, scheduled impacts, final radial coverage, retained weapon visibility, palm attachment, and completion without errors.
- Opus 5.5 High reviewed eight earlier candidate stills. It accepted the major body mechanics and identified the long handle as the remaining prop issue.
- The reviewer did not establish timing or foot contact. The later grip and timing changes have separate local checks and a silent gameplay recording.

## Remaining limits

The handle still touches the hip during four 120 Hz samples, approximately 0.233–0.258 source seconds. This brief prop defect does not reverse a limb.

The source uses fast advancing steps and retains some foot glide. The timed candidate reaches about 29.65 m/s foot speed in native time during another cut. Do not claim stationary foot plants or fully realistic motion.

The old, rejected Mixamo Hustler candidate is unrelated to this UAL2 source. It remains unpublished.

Private evidence lives in the primary checkout under `artifacts/reviews/hustler-heavy-source/`. The reviewed source is `timed/ayame.glb`, with `timed/ayame-motion.json`.


## Reproduction

Start with the Hustler model from commit 6748654. Transfer UAL2 Sword_Heavy_Combo with the existing transfer tool and these options:

```text
--hero ayame --clip Hustler_Heavy_Source --template Ring_Cut_Diagonal
--palm-frame --palm-pronation-fit --grounded --joint-fit
--stable-arm-pole --sample-rate 240 --look-ahead --arm-space 8
```

Assemble the full source with the existing assembly tool:

```text
--source-clip Hustler_Heavy_Source --template Ring_Cut_Diagonal
--name Hustler_Musou_Advance --hero ayame --grip-roll 0.3
--impact 0.475 --impact 1.14 --impact 1.8 --impact 2.62 --speed 1.1
--slow-phase 0.42,0.54,0.14 --slow-phase 2.45,2.70,0.18
```

Set primaryGrip to -0.01, entryBlend to 0.16, damageScale to 1.5, and all four headings to zero.
Keep the candidate outside public until the review passes. The new model revision refreshes cached Hustler assets.
