# Animation import corrections

The FBX loader now keeps centimeter conversion outside the animated hierarchy. An authored root scale track could previously remove that conversion.

The new arm reference helper measures elbow direction from an authored bent pose. A nearly straight bind pose cannot supply a stable direction. The helper restores source transforms and leaves existing animation clocks unchanged.

Use `--arm-reference-time SECONDS` with the transfer tool to select that reference. Both elbows must bend between 15 and 150 degrees. Use `--source-credit TEXT` to record the creator. The file format does not establish ownership.

Validation:

- Twenty focused tests pass, including animated scale, source-state restoration, and opposite numerical noise in nearly straight elbows.
- Three Mixamo source clips retain identical world joint positions across 121 samples each. Normalized rotation differences remain below 0.000004 degrees.
- The original FBX export retains meter-scale positions during animation playback.

These changes affect offline authoring tools. They do not replace any playable animation. The purchased motion studies remain private and still need weapon-clearance and gameplay review.


## Sliding polearm grips

Captured polearm motions can change the distance between the hands. Records can now set `slidingGrip: true` with `pairedGrip`. The signed `gripSpacing` gives the shaft direction. The displayed palm positions give the actual distance after interpolation and pose blending. The attachment preserves those positions and the authored arms.

Sliding grips cannot also use `fixedGripFrame`. They do not qualify for a transition that assumes two fixed grip stations. Existing golf and fixed sword attachments retain their behavior.

Validation: 21 focused grip, attachment, and weapon-frame tests pass. A private purchased-motion trial passes nine combat cases across 40, 60, and 144 Hz. Normal keyboard and mouse play also passes. The source motion remains outside the repository. No playable animation changes in this commit.
