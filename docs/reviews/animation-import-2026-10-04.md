# Animation import corrections

The FBX loader now keeps centimeter conversion outside the animated hierarchy. An authored root scale track could previously remove that conversion.

The new arm reference helper measures elbow direction from an authored bent pose. A nearly straight bind pose cannot supply a stable direction. The helper restores source transforms and leaves existing animation clocks unchanged.

Use `--arm-reference-time SECONDS` with the transfer tool to select that reference. Both elbows must bend between 15 and 150 degrees. Use `--source-credit TEXT` to record the creator. The file format does not establish ownership.

Validation:

- Twenty focused tests pass, including animated scale, source-state restoration, and opposite numerical noise in nearly straight elbows.
- Three Mixamo source clips retain identical world joint positions across 121 samples each. Normalized rotation differences remain below 0.000004 degrees.
- The original FBX export retains meter-scale positions during animation playback.

These changes affect offline authoring tools. They do not replace any playable animation. The purchased motion studies remain private and still need weapon-clearance and gameplay review.
