# Native arm reach correction

This correction changes only five native clips:

- Shinobi: `Twin_Cut_Diagonal`, `Twin_Heavy_Cleave`, `Twin_Heavy_Slam`, and `Twin_Musou_Flow`.
- Ayame: `Ring_Musou_Flow`.

The original clips held the arm near full extension for sustained intervals. The native baker now limits wrist targets to 96% of the arm length. It retains the source wrist orientation, timing, and lower-body motion. It does not scale the arms or move the clavicles.

The override exists only during the selected bake. Shared motion data remains unchanged.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --hero shinobi --attack-name Twin_Cut_Diagonal --attack-name Twin_Heavy_Cleave --attack-name Twin_Heavy_Slam --attack-name Twin_Musou_Flow --native-reach-limit .96
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --hero ayame --attack-name Ring_Musou_Flow --native-reach-limit .96
node tools/check-native-reach.mjs --before /tmp/ninja-native-reach-before
```

`--attack-name` requires an explicit hero and rejects unavailable clips. The appender accepts only the named exceptions to its normal animation allowlist.

The audit samples both arms at 240 Hz. Maximum reach is 96.001%. Weapon axes differ by less than 0.00009 degrees at native keys. Between-key orientation changes remain below 3.17 degrees. Pelvis and leg positions have zero measured change.

All 31 unrelated Shinobi clips and 35 unrelated Ayame clips retain their exact descriptors and bytes. Both bodies and textures remain exact. This correction does not replace their broader combat choreography or establish visual acceptance.
