# Ronin candidate authoring

These tools reproduce the accepted V63 Ready/Cleave pilot and the reviewed middle-guard transfer. They do not change shipping files.

The full Ronin family is not ready for release. Other legacy attacks still fail under this sword mount. Running transitions also expose an existing elbow-axis defect in `TravelPose`.

## Reproduce the accepted pilot

```sh
node tools/ronin-candidates/author-heavy-cleave.mjs \
  --input public/models/ronin.glb \
  --output /tmp/ronin-v63.glb \
  --record /tmp/ronin-v63.json
```

The verified input SHA256 is `4a3ad37557fe9ef6e741debe64c2a0b1a503a79346e4132d4f96e48e556315bc`.

With that input, the output SHA256 is `5ea4b1a5bc6f7e93674db1fcc04b8888e36223b860622f5a8ae6994db8c0dd04`. The tool also writes a Ready record and a measurement report beside the motion record.

The author replaces only `Ronin_Ready` and `Ronin_Heavy_Cleave`. It preserves all original geometry, binary data, and other animation channels.

`heavy-cleave-frames.json` contains the neutral hand rotations and the authoring frame before the constant mounting roll. The profile applies a fixed −100° mounting roll once. `ronin-grip-patch.json` contains the resulting runtime frame. Do not interchange these frames.

`sword-grips.json` supplies the fitted authoring grips. The reviewed weapon has a 14 mm handle radius. Its blade geometry is unchanged.

## Reproduce the guard transfer

```sh
node tools/ronin-candidates/author-guards.mjs \
  --input /tmp/ronin-v63.glb \
  --output /tmp/ronin-guards-v2.glb \
  --record /tmp/ronin-guards-v2.json

node tools/ronin-candidates/check-guards.mjs \
  --model /tmp/ronin-guards-v2.glb \
  --before /tmp/ronin-v63.glb \
  --output /tmp/ronin-guards-v2-check.json \
  --rate 480
```

The verified guard output SHA256 is `3916088757f165658a7e01f46083491c6e6e70473cb8847c2dbb3d6803242b08`.

The author transfers the accepted Ready arms and upper trunk to all seven `Odachi_Guard_*` clips. It preserves each original pelvis and leg track. Each guard uses one constant sword mount and a 150 mm gap between the palms.

The upper trunk transfer is necessary. The old trunk bends caused 9–14 sleeve/torso triangle crossings with the corrected arms. The transferred trunk removes those crossings without changing the collision masks.

The guard records use `nativeAttachment` and `pairedGrip`. The runtime keeps the authored wrists and closes the two palms around the same shaft. The checker does not certify running transitions or distinguish impact and break timing visually.

## Release boundary

Merge only the named clip records and the Ronin grip patch after the complete family passes review. Preserve the current grip data for every other hero. The patch includes explicit, unchanged golf frames, which isolate the club from the new sword mount.

The corrected pilot playback uses heavy attack step **0**. Step 1 selects `Heavy_Rising` and does not test this cleave.

The V63 Opus review is in `docs/reviews/ronin-cleave-v63-opus.md`. The guard and transition findings are in `docs/reviews/ronin-guard-transfer-v2.md`.

The rejected diagonal-cut experiments remain outside this directory. They are not part of this checkpoint.
