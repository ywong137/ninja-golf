# Reviewed Ronin return candidate

The V15 return starts and ends in the reviewed Ready pose. It lasts 0.85 seconds and strikes at 0.435 seconds.

The first cut completes its full 0.60-second action before this return starts. An earlier low-follow-through splice was a choreography study. It did not match the controller and must not serve as gameplay evidence.

The return steps forward, cuts toward the character's right, continues through contact, and steps back into Ready. Its sword mount, hand wraps, and 150 mm palm spacing match the reviewed cleave. The handle radius remains 14 mm. The source profile does not change the explicit golf frames.

## Rebuild and check

First, follow `README.md` to build the reviewed Ready, cleave, corrected diagonal, and guards. Then run:

```sh
node tools/ronin-candidates/author-return.mjs \
  --input /tmp/ronin-family-pilot.glb \
  --output /tmp/ronin-return.glb \
  --record /tmp/ronin-return.json

node tools/ronin-candidates/check-return.mjs \
  --model /tmp/ronin-return.glb \
  --before /tmp/ronin-family-pilot.glb \
  --output /tmp/ronin-return-check.json

node tools/ronin-candidates/check-return-controller.mjs \
  --model /tmp/ronin-return.glb \
  --record /tmp/ronin-v63.ready.json \
  --record /tmp/ronin-diagonal-body.json \
  --record /tmp/ronin-return.json \
  --output /tmp/ronin-return-controller.json

node tools/ronin-candidates/check-return-weapon.mjs \
  --model /tmp/ronin-return.glb \
  --record /tmp/ronin-return.json \
  --output /tmp/ronin-return-weapon.json
```

Use freshly generated Ready metadata. The current author declares both `nativeAttachment` and `pairedGrip`. Some historical temporary records omitted `pairedGrip`.

The controller check changes candidate routes only. It supplies the two attack durations and hit times. It preserves the controller's buffering and full-action boundary behavior. The browser stays isolated and muted, and it uses software rendering.

The controller contact metrics cover the Return interval, including entry from the completed first cut. They do not approve the separate Ready-to-first-cut fade.

## Source design

`return-profile.json` contains the body keys, primary-arm controls, support schedule, and fitted support-arm frames at 240 Hz. `author-return.mjs` applies them to the native skeleton.

The primary arm uses its calibrated signed elbow hinge. Shoulder roll, forearm twist, and wrist deviation remain separately bounded. The support-arm frames come from a continuous closed-chain solution. Every frame retains the exact handle constraint. A graph search selected a continuous path among anatomically valid, collision-free solutions. Its maximum world rotation step was 3.265 degrees per 240 Hz frame.

The torso turns at `spine_02`, above the thigh parents. Both legs follow the preserved cleave's step and toe pivot. Each solve starts from the bind rotation. This prevents residual thigh twist at otherwise matching endpoints.

The support-arm frames depend on the body keys and the fixed grip. Refit and recheck them after changing those inputs. Do not independently interpolate wrist or elbow targets to force a new blade direction.

The author appends one replacement animation. It preserves the source geometry, textures, all original binary bytes, and every unrelated animation. It refuses public output paths and input overwrites.

## Verification

The reviewed input was `/tmp/ninja-root-ronin-family-v4.glb`:

- Input SHA256: `e32f197defb296480096c4c4887f1b7650e618ce453436a44663667ef4a12895`.
- Rebuilt model SHA256: `468a091c745d4d4acf950465db638c563ad5cc078c44d501abc374e40839ddf6`.
- Rebuilt motion record SHA256: `6d693937e738b595e1080bd3e3065bfd32dcc40ce1c8070f2cf14bd84c1f5a96`.

The 480 Hz native check found:

- Zero upper-arm/torso or forearm/torso triangle crossings.
- Zero elbow folds.
- Maximum wrist deviation: 13.85 degrees.
- Maximum paired-center error: 0.065 mm.
- Maximum primary-hand speed: 4.587 m/s.
- Maximum source foot-path error: 0.493 mm.
- Maximum foot rotation difference: 0.042 degrees.
- Full first-cut endpoint, return entry, and Ready agree within 0.00018 mm and 0.00006 degrees.
- All 36 unrelated clips and 5,746,140 original binary bytes remain intact.

A separate 480 Hz triangle scan checked the blade, guard, handle, and pommel against the head, torso, and legs. It found no crossings. Clearance stayed above its 30 mm reporting cap. That scan used the larger production handle as a conservative bound.

The source rebuild matches the reviewed pose output. The largest orientation difference is below 0.000015 degrees. Quaternion sign changes do not change orientation.

The actual buffered controller test entered Return at 0.60417 seconds and returned to Ready at 1.45625 seconds. It consumed exactly one queued attack. During Return, the maximum palm gap was 0.0265 mm. Maximum triangle/shaft intrusion was 1.4922 mm, below the unchanged 2.1 mm bound. Maximum palm-frame/shaft error was 0.0275 degrees. The test reported no browser errors.

## Independent review

Actual Claude Opus 5.5 High reviewed the timed full-body and contact images. The response reported `modelUsage.claude-opus-5-5`. It accepted anatomy and considered the choreography acceptable. It identified no visible rejection defect.

Opus saw a distinct return slash, supported by the step and torso movement. It considered a stronger chamber and earlier pelvis turn optional improvements. It asked for a normal-speed check of the 0.72–0.85-second recovery.

The CLI reviewer could inspect images, not the video. Its verdict does not certify between-frame timing or gameplay responsiveness. The normal-speed native video uses the complete first cut before the return.

The full review remains in `/tmp/ronin-return-opus-v15/result.json`. The reviewed images and video remain under `/tmp/ronin-return/`.

## Release boundary

Keep this candidate offline. The changed sword mount still requires the remaining Ronin family to pass anatomy, surface, and transition checks. Do not publish a partial global mount change.

Required eventual runtime fields are:

- `motionOverrides.Cut_Return = 'Ronin_Cut_Return'`.
- Light attack step 1 duration: `0.85`.
- Light attack step 1 hit time: `0.435`.
- The unchanged reviewed Ronin sword grip patch and 14 mm handle radius.
- The existing explicit golf frames.

Replace the sword profiles, but merge each golf frame into its existing side profile. The golf patch contains no finger rotations or shaft centers. A shallow replacement of `golf` would discard them.

Root owns the shared runtime and final integration.
