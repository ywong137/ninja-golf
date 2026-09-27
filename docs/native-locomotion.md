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

## Support-aware posture

`tools/native-locomotion-profile.py` controls the baked pelvis height, hip turn, and free-foot recovery. It adds no runtime layer.

The desired lift averages 5.5 cm before reach limits. Its smooth phase curve lowers the body during loading and raises it during extension. Both native leg reaches limit the lift. The solver retains a 2 cm reserve below its conservative reach limit.

The native thighs attach to `spine_01`, below the pelvis. Compensation at that joint cancels the visible hip turn. The bake instead restores the source chest rotation at `spine_02`. This preserves the source chest and arm rotation while the hips turn beneath them.

The added hip turn has a four-degree amplitude. The final forward gait has 6.44 degrees of actual hip travel across each cycle. The previous forward gait had 1.62 degrees. The CPU comparator measures the thigh origins and requires more than five degrees. This rejects the canceled-turn failure.

Support foot targets and orientations remain unchanged. Free-foot recovery can rise to fold the knee and permit further pelvis lift. It never falls below the previous recovery path. The first free-foot samples remain unchanged to protect support interpolation. Cadence and support timing remain unchanged.

The six-hero comparison covered all 30 locomotion clips. It found these maximum differences from the previous bake:

| Measurement | Result |
| --- | ---: |
| Planted foot difference at baked keys | 0.034 mm |
| Planted foot difference between keys | 1.235 mm |
| Foot rotation difference at baked keys | 0.00763 degrees |
| Foot rotation difference between keys | 0.10072 degrees |
| Source chest rotation difference | 0.00212 degrees |
| Native limb length difference | 0.035 mm |
| Maximum leg extension | 97.32% |
| Minimum forward knee bend | 50.78 mm |

Male forward running gains 3.76 cm of average pelvis height. Female forward running gains 4.25 cm. Sprint gains 3.50 cm and 4.17 cm, respectively. Peak lift reaches 8.56 cm across the directional clips. Free-foot recovery changes by at most 9.28 cm.

All 183 protected clips retain exact descriptors and animation bytes. They include golf, attacks, guard, and other non-running motions. The approved Ronin and Kaede image sequences show higher bodies and greater recovery knee folding. Final browser checks must also cover terrain contacts and transitions.

Save the previous six hero files before another posture change. Run the CPU comparison after the append:

```sh
node tools/check-native-locomotion.mjs --before /path/to/previous-models
node --test tests/locomotion-profile.test.js tests/locomotion.test.js
```

The comparator samples every baked key and additional points between keys. It separates support drift from permitted recovery changes.
