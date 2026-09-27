# Kaede combat movement

This pass replaces Kaede's four light attacks, four heavy attacks, and Musou. Other heroes keep their current clips.

The earlier family mixed three revised attacks with six older attacks. The older regular attacks slid the right ankle 23–25 cm near the floor. Their hips and chest accelerated together. Gameplay also added automatic travel without compensating the supporting feet.

The revised family uses action-specific support transfers. Return cuts step onto the opposite leg. Rising cuts load before extending. Sweeps step sideways and reverse weight through the second strike. Heavy cleave and slam use a forward brace. Musou alternates lifted steps through six directions, with the pelvis moving toward support.

Each clip defines `footPlants.r` and `footPlants.l` as arrays of support intervals in seconds. Outside these intervals, the foot is swinging. `rootAdvance: 0` disables the old automatic lunge. Runtime terrain correction must preserve authored swing height and foot orientation. Manual movement needs separate stance compensation.

Hand targets stay closer to the body, and elbow poles rotate with the chest. The native baker limits each single-handed arm to 94% of its measured reach. This preserves elbow flexion without moving the clavicle or stretching the arm. The safeguard applies only when a clip declares `nativeReachLimit`.

## Rebuild and check

```sh
python3 tools/author-kaede-motion.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-authored-motion.py -- --attacks-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero kaede
node tools/check-kaede-combat.mjs --before /tmp/ninja-kaede-movement-before-67b12b3
node --test tests/attack-foot-placement.test.js tests/athletic-combat.test.js tests/character.test.js
```

The generic athletic author also calls the Kaede author, so it cannot restore the earlier partial Fan family accidentally.

## CPU results

The native audit samples all nine clips at 240 Hz.

| Measurement | Result |
| --- | ---: |
| Maximum planted ankle drift | 2.303 mm |
| Minimum forward knee bend | 97.93 mm |
| Maximum arm reach fraction | 90.722% |
| Hip acceleration peak before chest | 33.3–54.2 ms |
| Maximum shaft error at 60 Hz keys | 0.00021 degrees |
| Maximum shaft error between keys | 9.39 degrees |
| Protected Kaede clips, exact descriptors and bytes | 27 |

The Kaede bake preserves every other hero file. The separate Shinobi/Ayame arm corrections have their own audit in `native-arm-reach.md`. Non-Kaede source animation sampler bytes remain exact. Kaede's mesh, skin, texture, and unrelated animation bytes remain exact.

The 14 focused tests pass. They include the runtime terrain correction check: all Kaede joint positions and rotations remain unchanged on flat ground.

The final visual correction lowers the free hand toward the ribs during loading, then uses a brief counterbalance. It retains the native neutral wrist relationship. Musou transfers toward support and lowers the pelvis 15.3 cm for its final cut. Native torso lean reaches 13.1 degrees.

Musou uses 120 Hz native sampling to retain support during the stronger body motion. Other attacks retain 60 Hz sampling. Separate pelvis tilt and torso bend preserve the hip lead.

The remaining between-key wrist error occurs during fast Musou motion. Front and side contact sheets from the real combat controller show visible stepping, a bent weapon elbow, and a lower free-arm counterbalance. Standing and moving sequences received visual review. The choreography can still improve; these checks do not establish AAA animation quality.
