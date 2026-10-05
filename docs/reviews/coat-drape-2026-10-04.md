# Hanging hems during raised-leg motion

The coat hem followed the thigh too rigidly during a kick or running stride. Collision correction kept it outside the leg but did not let unsupported fabric fall.

The shared garment correction now lowers free hem vertices before the existing thigh constraint. The amount grows smoothly with thigh elevation and distance below the hip. Waist vertices keep their existing correction. Fabric, lining, and trim use the same rule. The rule is a pose correction, not a cloth simulation.

No model, skeleton, face, animation, or source asset changed. The purchased polearm study remains private.

Validation:

- Sixteen focused garment, grip, enemy-motion, and asset-preservation checks passed.
- A separate six-character sample audit retained thigh clearance for fully constrained hem vertices. Waist blends are outside that assertion.
- Eighteen rendered golf, running, and combat poses showed no new trim separation.
- On an M1 Max at 1440×900, the 64-enemy moving-combat benchmark measured 48.7 FPS before and 49.3 FPS after. Both used render ratio 1 and had a 33.4 ms frame-time p95. These single runs do not establish a performance improvement.

An earlier edge-relaxation prototype separated lining and trim. It was rejected and is absent from the release.
