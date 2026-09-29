# Ronin candidate authoring

These tools reproduce the accepted V63 Ready/Cleave pilot and the corrected V5 middle-guard transfer. They do not change shipping files.

The full Ronin family is not ready for release. Other legacy attacks still fail under this sword mount. The published carry correction preserves native elbow hinges during running. The first cut's entry fade still needs a hand-surface review.

A later [support-hand rotation audit](../../docs/reviews/ronin-grip-clock.md) also reopens the pilot's grip review.
Its solver keeps the hand on the shaft but permits substantial rotation around it.
Refit and review the complete palm frames before releasing these candidates.

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
  --output /tmp/ronin-guards-v5.glb \
  --record /tmp/ronin-guards-v5.json

node tools/ronin-candidates/check-guards.mjs \
  --model /tmp/ronin-guards-v5.glb \
  --before /tmp/ronin-v63.glb \
  --output /tmp/ronin-guards-v5-check.json \
  --rate 480 --preserve-feet
```

The verified guard output SHA256 is `ad5013ff81aee603c6577f605ec58982b41c424d8dd2a49383472ccf2ae4ec05`.

The author transfers the accepted Ready arms and upper trunk to all seven `Odachi_Guard_*` clips. It preserves each original pelvis, `spine_01`, and leg track. Each guard uses one constant sword mount and a 150 mm gap between the palms.

The upper trunk transfer is necessary. The old trunk bends caused 9–14 sleeve/torso triangle crossings with the corrected arms. The V5 transfer applies the reviewed torso orientation at `spine_02`, relative to the pelvis. It preserves `spine_01`, which also parents both thighs. This removes the crossings without moving the original feet or changing the collision masks.

The guard records use `nativeAttachment` and `pairedGrip`. The runtime keeps the authored wrists and closes the two palms around the same shaft. The checker does not certify running transitions or distinguish impact and break timing visually.

## Release boundary

Merge only the named clip records and the Ronin grip patch after the complete family passes review. Preserve the current grip data for every other hero. The patch includes explicit, unchanged golf frames, which isolate the club from the new sword mount.

The corrected pilot playback uses heavy attack step **0**. Step 1 selects `Heavy_Rising` and does not test this cleave.

The V63 Opus review is in `docs/reviews/ronin-cleave-v63-opus.md`. The historical guard findings are in `docs/reviews/ronin-guard-transfer-v2.md`. The V5 support correction supersedes that foot-placement assessment; see `docs/reviews/ronin-support-v5.md`.

## Reproduce the corrected diagonal pilot and guard reactions

The diagonal body transfer inclines the accepted cleave through a 15° torso side bend. The bend acts above the thigh branch. The native arm joints, two-hand grip, and leg movement remain intact. The head counters the side bend.

```sh
node tools/ronin-candidates/author-diagonal-body.mjs \
  --input /tmp/ronin-guards-v5.glb \
  --heavy-record /tmp/ronin-v63.json \
  --output /tmp/ronin-diagonal-body.glb \
  --record /tmp/ronin-diagonal-body.json

node tools/ronin-candidates/check-diagonal.mjs \
  --model /tmp/ronin-diagonal-body.glb \
  --before /tmp/ronin-guards-v5.glb \
  --output /tmp/ronin-diagonal-body-check.json \
  --hz 480

node tools/ronin-candidates/author-guard-reactions.mjs \
  --input /tmp/ronin-diagonal-body.glb \
  --output /tmp/ronin-family-pilot.glb \
  --record /tmp/ronin-family-pilot-guards.json
```

The diagonal model SHA256 is `6fe3501112e3ce04f1c0c7453e59d51529c63da33922a399523bf6b8efab5c13`. The combined guard/diagonal model SHA256 is `0ea92b08a22e8edbe52f3d36d1cb949a6d768b951b955ceb0733dbbbb6720cbc`.

The new first cut lasts 0.60 s. Its hit occurs at 0.2842105263 s. The candidate gameplay route must use both values. Using the old 0.40 s definition silently speeds up the clip.

The diagonal record uses the existing `pairedGrip` contract because both palms have authored positions. Ready and Heavy Cleave now declare this contract too. Their earlier V63 metadata omitted the field. The GLB output remains byte-identical.

The native paired runtime path preserves authored elbows, but the standard diagonal entry fade still tilts the support palm into the shaft. The triangle-surface result reaches 4.617 mm. See `docs/reviews/native-paired-transitions.md`. Keep this family offline until its transition contact passes.

The guard reaction author retains the V5 transferred arms and original legs. It rejects repeated application and outdated transfers. It adds a 5.5° torso recoil for impact and a 12° recoil for guard break. The stronger break also turns the upper trunk 10° and tilts it 3°.

Actual Opus 5.5 High accepted the earlier single diagonal pilot. Later measurements found foot drift that the V3 review missed. V5 corrects that defect. The historical review remains in `docs/reviews/ronin-diagonal-body-v3-opus.md`; it does not certify V5.

The rejected independent arm-path fits remain outside this directory. These candidate tools do not change shipping models or metadata.

The optional `--break-body` flag adds the V6 planted body compression to guard break.
Apply it to the diagonal model before any guard reaction has been added.
It preserves the reviewed upper body and all other clips. The default still reproduces V5 exactly.
Use `check-guard-break.mjs` to compare V6 against V5 at 480 Hz.
See `docs/reviews/ronin-guard-break-v6.md` for the exact command, measurements, hash, and review limits.

## Check actual blade clearance

The candidate scanner uses the candidate palm centers and fixed frames. It reproduces the runtime midpoint attachment for a paired grip.
It tests every skinned body triangle, including the head, hands, and legs. It excludes rigid attachments.

```sh
node tools/ronin-candidates/check-blade.mjs \
  --model /tmp/ronin-family-pilot.glb \
  --record /tmp/ronin-diagonal-body.json \
  --record /tmp/ronin-family-pilot-guards.json \
  --clip Ronin_Cut_Diagonal --clip Odachi_Guard_Impact --clip Odachi_Guard_Break \
  --output /tmp/ronin-blade-check.json --rate 480
```

This measures the blade. It does not certify handle contact, guard contact, transitions, or artistic quality.
