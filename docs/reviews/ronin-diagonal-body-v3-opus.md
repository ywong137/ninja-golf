# Ronin diagonal body transfer review

Date: 2026-09-28.

The reviewed pilot replaces `Cut_Diagonal` with `Ronin_Cut_Diagonal`. It does not approve the remaining Ronin family under the new sword mount.

## Independent review

The reviewer used actual `claude-opus-5-5` with High effort. The response reports that canonical model and no permission denials.

The review folder was `/tmp/ninja-opus-ronin-diagonal-body-v3`. It contained only project images and measurements. The result remains in `artifacts/ronin-diagonal-body-v3/opus-result.json`.

Opus accepted the anatomy and choreography of this single first cut. It found no required change. It judged the stacked hands, overhead chamber, contact reach, and follow-through plausible. The step and raised rear heel supported the strike.

Opus noted a controlled stop after contact. A later attack can add more blade travel. It also requested a playback check for foot sliding during recovery. Its phrase “feet-together” describes the side projection; the front view retains the wide stance.

The review explicitly excludes running transitions and the other preserved animations.

## Measured result

The source clip lasts 0.60 s. Contact occurs at 0.2842105263 s, or 47.37% of the clip.

The native check samples at 480 Hz. It applies the existing anatomical and skin thresholds.

- No upper-arm or forearm triangles cross the torso.
- No elbow folds occur.
- Wrist bend stays below 13.90°.
- The maximum paired-grip error is 0.386 mm, including interpolated frames.
- The largest joint step is below 10° per 120 Hz interval.
- Peak hand speed is approximately 11.60 m/s.
- Actual weapon triangles clear the head, torso, and legs by at least the 30 mm reporting limit.
- The cutting edge leads during contact.

The model preserves 36 unrelated animations and 5,671,300 existing binary bytes. Both Ready and Heavy Cleave remain unchanged.

The actual gameplay capture selected light step 0 and verified `Ronin_Cut_Diagonal`. It held 59.06 FPS with 24–52 enemies and no console errors. The video is `artifacts/ronin-diagonal-body-v3/playback.webm`.

## Guard reactions

The V3 guard reactions retain the reviewed middle-guard arms. Impact adds a small backward torso recoil. Guard break produces a larger recoil and turn.

Both reactions passed the dense native check and the runtime arm/head check. Root accepted their visible, restrained recoil. Evidence is in `artifacts/ronin-diagonal-body-v3/guard-playback.webm` and `guard.png`.

## Transition limitation

The first runtime route copied the earlier V63 record, which lacked `pairedGrip`. That omission sent the new authored pair through legacy secondary-hand IK. Ready/Guard→cut showed a 2.12° left elbow hinge deviation during entry.

An isolated diagnostic enabled the existing paired-grip contract and retained native paired attachment during the blend. It removed all arm-bound violations. The linear pose blend left a maximum total palm-spacing error of 2.13 mm, about 1.06 mm per hand.

The diagnostic did not change shared runtime files. Its temporary `nativePairedBlend` flag is not a proposed permanent motion field. Integration should detect compatible native paired endpoints and preserve the current carry rules.

The normal cut→Ready, cut→Guard, guard→Impact, and guard→Break tests passed. No tested transition caused blade/head intersections.

A later triangle-surface audit found a support-hand pinky collision during Ready/Guard→cut. The small center gap concealed a 5.126° palm-frame error and 4.617 mm shaft intrusion. This supersedes the center-gap-only contact assessment. The candidate remains offline. See `native-paired-transitions.md` for the bounded runtime correction and release limit.

## Gameplay timing

The existing combo window lasts 0.75 s after the attack. The attack input buffer lasts 0.55 s. A queued follow-up within this clip’s first 0.05 s can therefore expire before recovery ends. Review that buffer behavior before release.

## Release boundary

The guard and first-cut sources form a candidate checkpoint. The remaining legacy attacks still require new choreography under the single sword mount. Preserve explicit golf frames and other characters’ grips during integration.

Do not install the combined candidate until the full Ronin state sequence and native paired transitions pass.
