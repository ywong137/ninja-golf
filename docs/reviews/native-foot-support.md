# Retimed foot support

The arm updates retained the original leg poses. Their support records also retained each declared landing and lift time.
However, the original leg keys used a sparse sampling grid. A key outside support could lift the foot early through interpolation.
Retiming moved the test samples between those keys. The defect affected Sora and Kaede.

`tools/bake-native-foot-support.mjs` fixes the native leg rotations. It includes every support boundary and original animation key in a 240 Hz sampling grid.
It holds the ankle and sole orientation during declared full-foot support. A 25 ms blend joins each correction to free movement.
The solver retains rigid leg lengths and aligns each knee with its shoe. It does not change the support records.

The pass preserves pelvis, torso, arms, fingers, face, geometry, golf, and unrelated clips.
It appends new rotation tracks for the six thigh, calf, and foot bones.
The preservation check compares all other channel descriptors and their samplers inside each changed clip.

## Verified candidates

- `/tmp/closer-support-v2.glb`: all nine Sickle attacks.
- `/tmp/ace-support-v2.glb`: all seven remaining Fan attacks. The separate Ace opening cut and heavy cut stay unchanged.
- The unchanged knee test passes for both candidates.
- The new source test samples every support interval at 480 Hz, including exact boundaries.
- Sora's maximum support drift is 0.319 mm. Kaede's maximum is 0.444 mm.
- Maximum knee speed is 7.51 m/s. Maximum ankle speed is 5.79 m/s.
- The same test rejects both original models. Their exact-boundary drift reaches 4.85 mm and 6.38 mm, respectively.

The support fix does not change choreography or improve the existing torso motion. It addresses early lift and late landing interpolation only.

## Rebuild order

Run the support pass after the native arm author and all timeline changes. Pass the matching, final motion records.
Run it before model installation and final preservation checks. Do not run another timeline scale afterward.

```sh
node tools/bake-native-foot-support.mjs \
  --model /tmp/sora-authored.glb --output /tmp/sora-supported.glb \
  --record /tmp/sora-authored.json \
  --clip Sickle_Cut_Diagonal --clip Sickle_Cut_Return \
  --clip Sickle_Cut_Rising --clip Sickle_Cut_Sweep \
  --clip Sickle_Heavy_Cleave --clip Sickle_Heavy_Rising \
  --clip Sickle_Heavy_Sweep --clip Sickle_Heavy_Slam \
  --clip Sickle_Musou_Flow

node tools/bake-native-foot-support.mjs \
  --model /tmp/kaede-authored.glb --output /tmp/kaede-supported.glb \
  --record /tmp/kaede-authored.json \
  --clip Fan_Cut_Return --clip Fan_Cut_Rising --clip Fan_Cut_Sweep \
  --clip Fan_Heavy_Rising --clip Fan_Heavy_Sweep --clip Fan_Heavy_Slam \
  --clip Fan_Musou_Flow

NINJA_KNEE_MODEL_DIR=/tmp/ninja-support-models \
  node --test tests/native-foot-support.test.js tests/native-knee-alignment.test.js
```

The model directory must contain candidate `sora.glb` and `kaede.glb` files. Other characters can link to their installed models.
