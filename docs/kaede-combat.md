# Kaede combat movement

This pass replaces Kaede's four light attacks, four heavy attacks, and Musou. Other heroes keep their current clips.

The earlier family mixed three revised attacks with six older attacks. The older regular attacks slid the right ankle 23–25 cm near the floor. Their hips and chest accelerated together. Gameplay also added automatic travel without compensating the supporting feet.

The revised family uses action-specific support transfers. Return cuts step onto the opposite leg. Rising cuts load before extending. Sweeps step sideways and reverse weight through the second strike. Heavy cleave and slam use a forward brace. Musou alternates lifted steps through six directions, with the pelvis moving toward support.

Each clip defines `footPlants.r` and `footPlants.l` as arrays of support intervals in seconds. Outside these intervals, the foot is swinging. `rootAdvance: 0` disables the old automatic lunge. Runtime terrain correction must preserve authored swing height and foot orientation. Manual movement needs separate stance compensation.

Hand targets and elbow guides follow separate paths. During Musou, the free hand follows the lowered body and stays outside the shoulder. Its elbow guide stays behind the wrist line to prevent abrupt flips during turns. The native baker limits each single-handed arm to 94% of its measured reach. This preserves elbow flexion without moving the clavicle or stretching the arm. The safeguard applies only when a clip declares `nativeReachLimit`.

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
| Maximum planted ankle drift | 1.415 mm |
| Minimum forward knee bend | 57.32 mm |
| Maximum arm reach fraction | 94.000% |
| Hip acceleration peak before chest | 33.3–100.0 ms |
| Maximum shaft error at 60 Hz keys | 0.00021 degrees |
| Maximum shaft error between keys | 9.39 degrees |
| Protected Kaede clips, exact descriptors and bytes | 27 |

The Kaede bake preserves every other hero file. The separate Shinobi/Ayame arm corrections have their own audit in `native-arm-reach.md`. Kaede's mesh, skin, texture, and unrelated animation bytes remain exact.

The test suite includes native body and skin checks. The runtime terrain check also preserves Kaede's joint positions and rotations on flat ground.

The final visual correction lowers the free hand toward the ribs during loading, then uses a brief counterbalance. It retains the native neutral wrist relationship. Musou transfers toward support and lowers the pelvis 15.3 cm for its final cut. Native torso lean reaches 13.1 degrees.

All nine attacks use 120 Hz native sampling to retain support during the stronger body motion. Separate pelvis tilt and torso bend preserve the hip lead. Lateral torso bend acts above the native thigh attachment.

The remaining between-key wrist error occurs during fast Musou motion. Front and side contact sheets from the real combat controller show visible stepping, a bent weapon elbow, and a lower free-arm counterbalance. Standing and moving sequences received visual review. The choreography can still improve; these checks do not establish AAA animation quality.

The current body pass adds distinct torso and weight-transfer curves to all eight regular attacks. Light cuts use smaller transfers. Rising cuts load and then extend. Heavy downward cuts retain the load through their finish. The cleave averages 17.8 degrees of forward torso lean through contact and follow-through, compared with 10.4 degrees before this pass.

The cleave shifts horizontal hip projection from 35.8% to 68.0% along the rear-to-lead support span. The earlier clip shifted from 45.3% to 60.5%. This measures visible support transfer, not physical center of mass. Braced knee flexion remains 54.9–73.1 degrees.

The free-arm Musou check samples the deformed skin at 240 Hz. All 794 samples have zero measured central forearm inset and zero arm/torso intersections. Peak elbow speed relative to the shoulder is 7.05 m/s. The independent previous model failed this check with severe folding and an abrupt elbow flip. The test excludes the elbow crease and shared mesh vertices. It does not certify every skin region or every other attack.

Ayame's cleave also gains an outside windup path. Its sampled forearm inset falls from 46.3 mm to zero. The windup elbow speed falls from 29.6 to 5.45 m/s. Both the source endpoints and the .36-second hit remain unchanged.

Run `tests/native-body-commitment.test.js` and `tests/native-arm-clearance.test.js` for these regressions. Their optional asset-directory variables allow verification against independent pre-fix models.

Release checks pass: 208 unit and asset tests, plus browser grip, blade-frame, attack-transition, travel-transition, moving-attack, and grounded-attack suites. Moving attacks cover all six heroes and eight movement directions. The final Kaede crowd test measures 48.75 FPS with 64 enemies on an M1 Max using Metal. It uses a 1440×900 CSS viewport, device scale 2, and Balanced render ratio 1.5. The 95th-percentile frame time is 33.4 ms.
