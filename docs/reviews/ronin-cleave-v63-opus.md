# Ronin cleave v63: independent Opus review

Status: accepted as a single pilot. The Ronin animation family remains unpublished.

The actual `claude-opus-5-5` review used High effort. The result reports no permission denials.
The reviewer accepts the downward finish, closed grips, neutral wrists, arm motion, and body support.
It reserves a timing judgment on the 40 ms settling pose for playback.

## Independent review

# Ronin heavy cleave pilot, v63 finish: **Accept**

The blocking defect from my v54 review is fixed. The cut now carries through and down past contact, and none of the anatomy got worse. I'd accept this single pilot as shown. One question is left open, and only playback can answer it (see Timing). It isn't a reason to revise.

## Visible choreography: now reads as a real cleave

- **Follow-through exists now.** In the v54 close-up at 0.44 s the pose was almost identical to contact. In v63 at 0.46 s it clearly isn't:
  - From contact (0.358 s) to 0.458 s the lead hand drops about 23 cm (y 0.973 → 0.746). In v54 it dropped about 7 cm.
  - I measured the visible blade line, from grip to tip, at about 2° below horizontal at contact and 24.4° below at 0.46 s, which matches your figure. The straight shaft is about 18.5° below; the curve accounts for the difference, and the curve is what the viewer sees.
  - The whole arc runs from about 25° behind vertical in chamber to about 24° below horizontal. That is an arc of roughly 140°, which is enough for a heavy downward cut.
- **The blade no longer rises too soon.** At 0.543 s in the strip it is still clearly pointing down. It is back above horizontal only by 0.651 s.
- **The body follows the cut.** The pelvis moves about 5 cm forward and 2 cm down after contact, and the chest leans a little further forward. That matches what I asked for.
- **The hands come back toward the body as they fall.** Relative to the pelvis they move back about 16 cm (hand z 0.80 → 0.70 while the pelvis moves forward). That reads as a pulling cut that finishes at the lower belly and front of the hip, which is a standard ending. It is not a defect.
- **The blade stays clear.** It stays edge-down in both 0.46 s views, and the tip ends about 13 cm above the ground with no visible contact. The wide stance stays as you decided.

## Anatomy: the arms stay human and the folded bow does not return

- **Elbows open slightly as the hands drop** (flexion goes from about 51° and 56° to about 45° and 53°). They don't fold. The upper arms hang close to vertical and the forearms angle forward and down.
- **No belly-fold or deep-bow look.** In the three-quarter view at 0.46 s the near upper arm runs along the side of the torso but doesn't cross it. The 480 Hz skin scan also found no crossings.
- **Grips stay closed and wrists look straight** in both finish views. Measured wrist deviation peaks at 13.4° and 13.9°, under the 14° limit. The hand joints change smoothly (at most 1.7° per step after contact), so there are no flips.
- **Risk, not a visible defect:** from contact through the settle, forearm twist sits right at its bounds (right side held at 68.5°, left at −69.5°) and both wrists are near 14°. The finish uses up all the slack the arms had. Any later change that asks for more drop will need a different approach, not more pushing against these limits.

## Timing: the one thing stills can't settle

- **The settle is a hold, not a drift.** The 0.458 s and 0.500 s samples match to about 0.1 mm, so the pose is frozen for about 40 ms, after an ease-out: the hands travel at roughly 2.9 m/s just after contact, slow to about 1.3 m/s, then stop. The pose itself is plausible.
- **Only playback can show how the stop feels.** Whether it reads as weight landing or as a 2–3 frame mechanical hitch can't be judged from stills.
  - If playback shows a hitch, the fix is a small continued sink during the hold, not a deeper finish.
  - Playback should also confirm that the 100 ms from contact to the bottom of the finish reads as heavy rather than quick.
- **Edge alignment, measurement only:** just after contact the numbers show the blade face tilting off the cutting direction (face value 0.42 by 0.383 s). The stills show the edge leading, so nothing looks wrong. It is worth a glance during the same playback check.

## Scope

- **Covered:** Ronin_Ready and Ronin_Heavy_Cleave as supplied.
- **Not covered:** the legacy family. The new Ready mounting affects every other Ronin attack, guard and carry pose, and each needs its own coherent choreography and review before release. The baseline golf frames stay separate.
- Nothing has been published, and I didn't edit any files.

## Verification and scope

V63 preserves the accepted wind-up and contact from V54.
Both palm positions match exactly at every authored sample through 0.36 seconds.
The fixed weapon frame remains unchanged from V54.
The finish lowers the hands by 23 cm and turns the visible blade 24.4 degrees below horizontal.
The wide stance remains unchanged, as the user requested.

The candidate passes 1,328 anatomy, wrist, paired-grip, blade, foot, and knee samples.
Maximum wrist rotation is 13.90 degrees. Maximum palm separation error is 0.173 mm.
The complete blade retains at least 131.9 mm ground clearance.
The 480 Hz scan finds no upper-arm/torso crossings, forearm/torso crossings, or elbow folds.
Maximum hand speed is 9.50 m/s.

A separate 480 Hz check tests the complete weapon against 4,743 head, torso, pelvis, and leg triangles.
It includes the blade, guard, handle, and pommel. It finds no crossings and at least 30 mm clearance.
That check uses the larger production handle radius, so its handle clearance is conservative.
Actual Warrior transitions from Ready, running, and guard also pass the 480 Hz blade/head check.
The corrected cleave playback holds 58.86 FPS with 24–43 enemies and no console errors.
Its report records the actual Ronin_Heavy_Cleave clip. The earlier step1 capture recorded Heavy_Rising and is superseded.

The model preserves 35 unrelated animation payloads and 5,585,716 original binary bytes.
The explicit baseline golf frames preserve the existing club mount independently of the sword.
The candidate uses a 28 mm sword handle. Runtime previews route only that handle-radius change and the candidate grip data.

The new Ready mount still affects every Ronin sword pose. Do not install this pilot alone.
The legacy attacks, guards, selection, and carry poses need coherent motion under the same fixed mount.

## Reproduction

The self-contained source checkpoint is `/tmp/ronin-cleave-v63-source`.
It contains the author, profile, base mounting frames, authoring grips, and runtime grips.
The authoring frame precedes the constant blade roll; the runtime frame includes that roll.
Do not interchange those frame files.

```sh
node /tmp/ronin-cleave-v63-source/author-native-cleave.mjs \
  --input /tmp/ronin-before-arm-fix.glb \
  --output /tmp/ronin-diagonal-v63-reproduced.glb \
  --record /tmp/ronin-diagonal-v63-reproduced.json \
  --frames /tmp/ronin-cleave-v63-source/base-frames.json \
  --grips /tmp/ronin-cleave-v63-source/author-grips.json
```

The reproduced model and motion record match the reviewed files byte for byte.

Model SHA-256: `5ea4b1a5bc6f7e93674db1fcc04b8888e36223b860622f5a8ae6994db8c0dd04`.
Motion record SHA-256: `052fecc335caf784aca8311983ea9f6db268ab2ee95d93bbcab749aee700a945`.

Local evidence:

- `/tmp/ronin-diagonal-v63.png`
- `/tmp/ronin-diagonal-v63-runtime-0.460-right.png`
- `/tmp/ronin-diagonal-v63-runtime-0.460-three-quarter.png`
- `/tmp/ronin-diagonal-v63-cleave-playback.webm`
- `/tmp/ronin-diagonal-v63-check-480.json`
- `/tmp/ronin-diagonal-v63-weapon-body.json`
- `/tmp/ronin-diagonal-v63-runtime-head.json`
- `/tmp/ninja-opus-ronin-v63/result.json`

An ignored backup of the source and evidence is in `artifacts/ronin-cleave-v63/`.
The production author defaults remain unchanged while the full Ronin family awaits correction.
