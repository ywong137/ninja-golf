# Native running

The five `Run_*` and `Sprint_Forward` clips retain licensed arm and torso motion. Native leg IK adds fixed support contacts, foot recovery, heel contact, and toe-off. The bake uses each human's original anatomy and skin weights.

`src/locomotion-data.json` defines each stride. `amplitude` is half the support travel, in unscaled model meters. `support` is the support fraction of one full cycle. The clip's reference speed is `2 * amplitude / (support * duration)`.

The actor advances phase from measured travel speed. It accounts for the actor's scale. Four directional clips share their phase and support windows. Blend weights account for each direction's stride length. This keeps diagonal cadence consistent with travel. Focused backward movement uses a forward-playing backward gait.

The native bake uses 60 samples per second. Run this command to append only locomotion:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-rocketbox-warriors.py -- --locomotion-only
```

The append step retains existing mesh, texture, and animation bytes. It does not replace guard, golf, or attack clips.

`tests/browser-locomotion.mjs` measures support drift, forward knee bend, foot recovery, and transitions. It tests all heroes at gameplay speed, including eight focused directions. It also saves twelve frames of the running sequence. Review these frames before accepting a new bake. Run `tests/browser-motion.mjs` and `tests/browser-guard-walk.mjs` after the movement tests.

The roster check covers 60 movement cases. Maximum support drift was 5.3 mm in cardinal directions and 27.3 mm in blended diagonals. Minimum forward knee bend was 50.9 mm. Each foot recovered at least 154 mm above its lowest point.

Repeated appends remove unreferenced trailing data from older versions of the same clips. A second append produces identical bytes. All original clips, meshes, and textures retain their original bytes.
