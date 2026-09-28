# Ace arm correction

The Ace's sword arm previously twisted around an arbitrary target direction.
The new clips use the native elbow hinge and separate upper-arm and forearm rotation.
The wrist stays close to its neutral pose. The fitted fingers and weapon handle move together.

The first light and heavy strokes include revised torso loading and planted footwork.
The remaining attacks and guards retain their original body and leg poses.
Three short light attacks now run longer, so the sword does not move at an implausible speed.
Gameplay damage times match those revised clips.

The double-edged jian alternates rising and descending cuts. Each damage event moves an edge through the target.
The musou retains its original body turns and six damage events.

## Checks

- Native joint and surface checks cover every clip at 480 samples per second.
- Measured central arm surfaces have no torso crossings or upper-arm folds.
- Shoulder and forearm rotation remain within the selected 70-degree authoring limit.
- Wrist deviation stays within 18 degrees.
- Runtime entry from Ready, running, and guard preserves the wrist pose and palm contact.
- Controller tests require exact authored duration and contact timing, within floating-point tolerance.

The numeric limits are project checks. They are not universal limits for human movement.
Front and side renders confirm the elbows bend naturally through the sampled phases.
The remaining clips still need more varied free-arm motion and stronger full-body expression.
Selection uses a separate runtime pose and is outside this correction.

## Rebuild

```sh
node tools/author-native-ace-family.mjs --input public/models/kaede.glb --output /tmp/ace-family.glb --record /tmp/ace-family.json
node tools/check-native-ace-family.mjs --model /tmp/ace-family.glb --record /tmp/ace-family.json --before public/models/kaede.glb --skin
```

The author refuses to overwrite a public model. It preserves geometry and unrelated clips.
The validator reads baked bone rotations and deformed surfaces, rather than trusting the source curves.
