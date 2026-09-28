# Ronin candidate authoring

These tools reproduce the accepted V63 Ready/Cleave pilot and the reviewed middle-guard transfer. They do not change shipping files.

The full Ronin family is not ready for release. Other legacy attacks still fail under this sword mount. The published carry correction now preserves native elbow hinges during running. The first cut's entry fade still causes a support-palm contact error.

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

## Reproduce the reviewed diagonal pilot and guard reactions

The diagonal body transfer inclines the accepted cleave through a 15° torso side bend. The native arm joints, two-hand grip, and leg movement remain intact. The head counters the side bend.

```sh
node tools/ronin-candidates/author-diagonal-body.mjs \
  --input /tmp/ronin-guards-v2.glb \
  --heavy-record /tmp/ronin-v63.json \
  --output /tmp/ronin-diagonal-body.glb \
  --record /tmp/ronin-diagonal-body.json

node tools/ronin-candidates/check-diagonal.mjs \
  --model /tmp/ronin-diagonal-body.glb \
  --before /tmp/ronin-guards-v2.glb \
  --output /tmp/ronin-diagonal-body-check.json \
  --hz 480

node tools/ronin-candidates/author-guard-reactions.mjs \
  --input /tmp/ronin-diagonal-body.glb \
  --output /tmp/ronin-family-pilot.glb \
  --record /tmp/ronin-family-pilot-guards.json
```

The diagonal model SHA256 is `66bd0b8ea32062e623f0d13c531e3478f0647dde822f60b02d332f169ca70397`. The combined guard/diagonal model SHA256 is `8b6030d3ef4bb2e58deaa6ef676fb0a9094b4f72026e628c83acefa17ed64767`.

The new first cut lasts 0.60 s. Its hit occurs at 0.2842105263 s. The candidate gameplay route must use both values. Using the old 0.40 s definition silently speeds up the clip.

The diagonal record uses the existing `pairedGrip` contract because both palms have authored positions. Ready and Heavy Cleave now declare this contract too. Their earlier V63 metadata omitted the field. The GLB output remains byte-identical.

The native paired runtime path preserves authored elbows, but the standard diagonal entry fade still tilts the support palm into the shaft. The triangle-surface result reaches 4.617 mm. See `docs/reviews/native-paired-transitions.md`. Keep this family offline until its transition contact passes.

The guard reaction author retains the V2 arms and legs. It adds a 5.5° torso recoil for impact and a 12° recoil for guard break. The stronger break also turns the upper trunk 10° and tilts it 3°.

The diagonal native clip and guard reactions passed local visual review. Actual Opus 5.5 High also accepted the single diagonal pilot. The review and transition limitations are in `docs/reviews/ronin-diagonal-body-v3-opus.md`.

The rejected independent arm-path fits remain outside this directory. These candidate tools do not change shipping models or metadata.
