# Ronin native attack candidate

The candidate replaces Ronin's `Ready` and `Heavy_Cleave` clips. It leaves enemy animation sources unchanged.

The authoring tool preserves the original binary payload, mesh, skin, textures, materials, and other animation descriptors. It keeps the 37-clip budget.

Generate the candidate:

```bash
node tools/author-native-cleave.mjs \
  --output /tmp/ninja-ronin-native-cleave.glb \
  --record /tmp/ninja-ronin-native-cleave.json
node tools/check-native-cleave.mjs \
  --model /tmp/ninja-ronin-native-cleave.glb \
  --output /tmp/ninja-native-cleave-anatomy.json
```

The authoring tool also writes `.ready.json` and `.report.json` beside the requested motion record. It rejects model output inside `public/`.

Review the actual combat controller:

```bash
node tools/capture-game-attacks.mjs after --hero 0 \
  --clip Ronin_Heavy_Cleave \
  --model /tmp/ninja-ronin-native-cleave.glb \
  --motion-record /tmp/ninja-ronin-native-cleave.json \
  --ready-record /tmp/ninja-ronin-native-cleave.ready.json \
  --replace-clip Heavy_Cleave \
  --times 0,0.16,0.25,0.30,0.36,0.44,0.54,0.758 \
  --motion both
```

## Motion

The attack lasts 0.76 seconds and contacts at 0.36 seconds. The top pose arrives at 0.16 seconds.

The pelvis moves first. The elbows then bring the blade forward before the cut. The front foot plants during contact and recovery.

The rear foot stays fixed. Foot placement uses the real leg lengths and the existing knee alignment solver.

The primary arm uses a continuous anatomical elbow plane. Its elbow never reverses through a straight arm.

The wrist stays neutral during anticipation. Contact allows up to 12 degrees of release. The secondary hand follows reviewed wrist frames and an interpolated elbow swivel. This reduces rapid changes without moving the reviewed key poses.

The authoring tool bakes all bones at 240 Hz. Monotone cubic curves preserve velocity across key poses without overshoot.

`nativeAttachment` lets the weapon follow the complete native hand rotation. Runtime shaft aiming must not replace it.

The matching ready pose contains a calibrated `roll`. This preserves the weapon frame during actor construction.

## Review evidence

Claude Opus 5.5 High reviewed the previous runtime screenshots and rig constraints. Its [biomechanics brief](../artifacts/opus55-native-cleave-biomechanics.md) informed the key poses and timing.

Its [candidate review](../artifacts/opus55-native-cleave-review.md) approved replacement of the old move. It also identified later improvements to stance and arm reach.

The source checks evaluate the native keys and intermediate poses. They check elbow continuity, hand speed, forearm collisions, elbow skin folding, and preservation of unrelated assets.

The current candidate clears the torso at every sampled forearm pose. The primary wrist stays within 12 degrees. The smoothed secondary wrist stays within 14 degrees. The maximum hand speed is 10.96 m/s.

The tool compares each original non-attack animation descriptor. It also verifies the complete original binary payload before any new animation data.

A screenshot sequence cannot establish real-time fluidity. Record the real controller for playback review:

```bash
node tools/capture-combat-playback.mjs /tmp/ninja-combat-playback.webm
```

The tool records ten seconds of muted combat. It requires at least 12 enemies and 40 FPS.

## Runtime integration and checks

Ronin resolves his first heavy attack to `Ronin_Heavy_Cleave`. His matching idle uses `Ronin_Ready`. Other attack families retain their existing clips.

The carrying arm blends toward native wrist and elbow targets before this cut. The second hand joins afterward. It releases before running resumes.

All heroes carry their swords with a straight wrist. Forearm rotation presents the blade. Its limit uses the original imported bone reference.

Ethan holds the polearm lower along its wrapped shaft during running. The grip returns to its attack position before contact.

The regression checks cover:

- 1,328 native poses, including interpolation between baked keys.
- Existing loaded-knee alignment limits, with no relaxed threshold.
- Actual blade clearance and planted-foot drift.
- 90 carry transitions at 60, 120, and 240 Hz, including native attack recovery.
- 96 moving attack scenarios across the roster and eight movement directions.
- Deformed hand contact and fittings in 974 runtime samples.
- Deformed leg clearance during jogging and sprinting.
- Weapon and golf transforms compared with release `adf64bf`.

The legacy attack and guard clips still need separate anatomical reviews. These changes do not establish natural movement across the whole roster.

## Rebuild integration

Run the native cleave author after the native golf patch during a full Ronin export. Generate its model and records inside a temporary directory.

The rebuild hook validates the generated model before copying it. It also merges only the two generated Ronin records into the runtime motion data.

Run the same patch after Ronin attack-only exports that touch the shared heavy clip. Those exports can otherwise restore the retired animation.

Selection, guard, and locomotion exports can preserve these clips directly. The author removes existing aliases before replacing source descriptors.
