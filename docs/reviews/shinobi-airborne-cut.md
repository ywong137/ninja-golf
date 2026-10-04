# Shinobi jumping heavy attack

The opening heavy attack now uses `Shinobi_Airborne_Cut`.
It replaces `Twin_Heavy_Cleave` through the existing character override.
The remaining heavy attacks and later light attacks retain their previous clips.

The complete source is Adobe Mixamo **Sword And Shield Power Slash**.
The local source filename is `sword-shield-power-slash.fbx`.
Its provenance and checksum remain in the primary checkout's `assets/source/mixamo/provenance.json`.
Do not publish the standalone FBX.

The performance includes a preparation step, leap, torso turn, downward cut, deep landing, and recovery.
Native duration is 2.4333334 seconds. Playback is 1.6x, or 1.5208334 seconds.
The right sword strikes at native time 1.3766667 seconds.
The left sword guards and balances; it does not produce another hit or strike trail.
Horizontal travel is approximately 0.89 metres.

The transfer keeps both closed sword grips and complete palm frames.
The fixed blade roll is -0.17233614859650767 radians.
The native gameplay measurement gives 0.944 cutting-edge alignment and 0.271 blade-flat alignment through the strike interval.

## Contact correction

Opus 5.5 High accepted the large body mechanics but found floating soles during the crouched landing.
The contact pass uses `tools/motion-sources/shinobi-airborne-contacts.json`.
It adjusts only the two thighs, calves, and feet.
The pelvis, torso, arms, jump height, and timing remain unchanged.

The corrected animation retains a 0.381-metre airborne sole height.
Its lowest sole point is -0.00036 metres, including interpolated samples.
During the landing hold, the maximum sole error is 0.00005 metres.
No measured knee or elbow reverses. The maximum wrist angle is 25 degrees.
The maximum arm rotation between 240 Hz samples is 4.71 degrees.

The corrected full surface audit has zero weapon/body crossings.
The closest point is a handle binding near the knee, at 1.25 mm.
This measurement includes both weapons, the head, torso, and limbs.

## Reproduction

Transfer from the released model before this addition, with these options:

```text
--hero shinobi --clip Shinobi_Airborne_Cut --template Twin_Heavy_Sweep
--dual-wield --palm-frame --palm-pronation-fit --joint-fit
--stable-arm-pole --sample-rate 240
--contact-windows tools/motion-sources/shinobi-airborne-contacts.json
```

Do not use `--grounded`, which would remove the leap.
Use `tools/assemble-source-attack.mjs` with the same base and the transferred candidate:

```text
--source-clip Shinobi_Airborne_Cut --template Twin_Heavy_Sweep
--name Shinobi_Airborne_Cut --hero shinobi --dual-wield
--impact 1.3766666666666643 --speed 1.6
--grip-roll=-.17233614859650767
```

Set `impactHands` to `["r"]` and `entryBlend` to `0.14` in the record.
Rebuild the selection bounds after integration.

## Validation and limits

Local evidence is in the primary checkout at `artifacts/reviews/shinobi-power-cut`.
It includes raw source poses, Opus review, contact measurements, blade audits, and silent gameplay recordings.
The gameplay check covers standing, moving, and queued-light entry at 40, 60, and 144 Hz.
It verifies actual damage, timing, both grips, weapon visibility, recovery, and queued attacks.

The movement comes from a sword-and-shield performance, adapted to two short swords.
The offhand is a covering weapon in this attack.
The still-frame review cannot establish runtime timing or collision behavior.
The separate gameplay tests cover those paths; normal user play remains the final test of combat feel.
