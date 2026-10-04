# Hustler heavy finishing cut

The opening heavy attack now uses `Hustler_Power_Finish` through the existing character override.
It retains a full-body preparation, large advancing step, torso turn, downward cut, and recovery.
Later heavy branches keep their previous clips.

The source is Quaternius UAL2 `Sword_Heavy_Combo`, CC0.
The final cut uses source time 2.2333333 to 4.3333335 seconds.
The landing phase adds 180 ms of native time.
Playback lasts 1.9 seconds. The damage contact occurs at 0.444 seconds.
Forward actor travel is 1.46 metres. Entry blending lasts 180 ms.
The source also underlies The Closer's finishing cut.
Each character keeps her own proportions, weapon, grip and damage values.

## Source choice

Two new Mixamo candidates failed the sabre clearance check.
The combined slash crossed the head during preparation and a leg during recovery.
The cross slash still crossed the head after a bounded shoulder adjustment.
Neither candidate ships. Their evidence remains in the primary checkout's review folders.

The accepted source uses the existing full-body transfer and anatomical joint calibration.
The final interval needs no new per-frame correction or blade rotation.
The sword's cutting edge leads its strike interval: edge alignment 0.957, flat alignment 0.225.
The surface check found no crossings against the head, torso, opposite arm, or legs.
All measured clearances exceeded the check's 3 cm reporting limit.
The minimum recorded blade-tip height was 0.379 metres above the review floor.

## Preservation and validation

The model retains every previous binary byte and all 39 previous animation descriptors.
Its mesh, face, hair, wardrobe, materials, skeleton, and skin weights remain unchanged.
The addition appends one animation and adds about 697 KB to the model.
Only The Hustler's selection bounds changed.

The focused regression checks cover signed knees and elbows, arm continuity, wrist bend, support, timing, and asset preservation.
The native body drop is 0.234 metres. Maximum sword-wrist bend is 27.3 degrees.
The largest arm rotation between 240 Hz samples is 3.0 degrees.
The lowest sole point is -0.00038 metres; a supporting sole remains within 0.00008 metres of the floor.

Nine gameplay cases cover standing, running, and queued-light entry at 40, 60, and 144 Hz.
They verify actual enemy damage, hit timing, attached grip, visible sword, recovery, and follow-up input.
The preview checks cover all six heroes, animation controls, and desktop framing.
The production build passes. Its existing large-bundle warning remains.
These checks do not establish overall AAA quality or a new performance benchmark.

Opus 5.5 High found no blocking posture issue in the reviewed stills.
It identified the step, counterbalancing arm, torso turn, and forward weight transfer.
Still images do not verify timing. The separate gameplay recording covers complete playback and recovery.

Local evidence: `artifacts/reviews/hustler-power-cut` in the primary checkout.
The silent gameplay recording is `gameplay/source-heavy.webm`.

## Reproduction

Use the released Ayame model before this addition as the base.
Transfer `Sword_Heavy_Combo` with `tools/transfer-sword-study.mjs`:

```text
--hero ayame --clip Hustler_Power_Source --template Ring_Heavy_Cleave
--palm-frame --palm-pronation-fit --joint-fit --stable-arm-pole
--grounded --sample-rate 240 --look-ahead --right-arm-clearance 14
```

Assemble the final interval with `tools/assemble-source-attack.mjs`:

```text
--source-clip Hustler_Power_Source --template Ring_Heavy_Cleave
--name Hustler_Power_Finish --hero ayame --start 2.2333333333333334
--impact 2.625 --speed 1.2 --slow-phase 2.45,2.70,.18
```

Set `entryBlend` to `0.18`. Rebuild Ayame's selection bounds.
