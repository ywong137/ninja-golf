The Ace now uses native Ready, opening-cut, and heavy-cleave animations in the local game. The opening cut lasts 0.60 seconds and contacts at 0.27 seconds. The heavy cut lasts 0.76 seconds and contacts at 0.36 seconds. The controller and selection preview use those times.

The jian cuts with its edge. Both wrists stay neutral, and the sword hand retains its fitted finger wrap. The hips turn before the chest. The lead foot steps forward and plants before contact. The rear heel rises around a fixed toe. Explicit toe-support intervals keep terrain support active during that pivot.

The heavy cut transfers the hips from the rear support toward the lead foot. The independent body test measures 16.86 degrees of sustained torso lean through contact and follow-through. Its horizontal hip projection moves from 0.318 to 0.741 across the support span. Those values describe visible body placement, not a physical center-of-mass simulation.

The final light is revision 18; the heavy is revision 8. Dense source checks sample the actual skeleton and deformed arms at 480 Hz. Both strokes have neutral wrists and no detected arm–torso intersections or elbow-fold penetration. Their free-arm reach stays below 0.95 of straight-arm length. The heavy blade stays at least 11.46 cm above flat ground. Its contact speed is 14.92 m/s, with 0.986 edge alignment and 0.054 face alignment.

The first runtime integration found an overstraight free elbow in Ready. Revision 17 corrected only the free upper-arm and forearm rotations. A later body test rejected the first heavy candidate for insufficient lean and hip transfer. The accepted heavy retains the existing body-commitment bounds. A separate movement test caught a foot jump when releasing sideways or backward movement. The release now limits displacement instead of completing every stance change within one fixed fade.

The weapon mounting frame includes an 82.02-degree correction around the handle. This leaves its fitted axis and palm center intact. Explicit golf frames prevent that correction from rotating the club. A browser comparison against commit 00c1e3a found no changes in any of the 90 golf fixture transforms. Only the Ace's Ready transform changed. The refreshed fixture also includes the previously accepted native golf and Ethan Ready changes from that commit.

The native patches preserve 6,043,844 original binary bytes and 34 unrelated animation descriptors. They retain the character geometry, textures, skin weights, golf swings, and remaining attacks. Each accepted clip carries the knee-alignment marker so later partial exports do not overwrite its authored support.

Generate and inspect both attacks:

```sh
node tools/author-native-ace.mjs --clip light --output /tmp/ace-light.glb --record /tmp/ace-light.json
node tools/author-native-ace.mjs --clip heavy --input /tmp/ace-light.glb --output /tmp/ace-heavy.glb --record /tmp/ace-heavy.json
node tools/check-native-ace.mjs --model /tmp/ace-light.glb --record /tmp/ace-light.json --ready-record /tmp/ace-light.ready.json --clip Ace_Cut_Diagonal
node tools/check-native-ace.mjs --model /tmp/ace-heavy.glb --record /tmp/ace-heavy.json --ready-record /tmp/ace-heavy.ready.json --clip Ace_Heavy_Cleave
```

The author refuses output paths inside `public/`. Full and relevant partial Blender exports run the same native patches after the canonical export. The native build hook reproduced the installed model bytes and all parsed motion records from the prior model. Python and JavaScript encode some numbers differently; the parsed values match. A complete Blender rebuild was not run during this pass.

All 297 unit and asset tests pass. Browser checks cover 96 moving-attack scenarios, attack entry from idle/run/guard/repetition, fitted grips, blade frames, golf contact, and selection speed/pause controls. The blade-frame test retains exact single-hand bounds and separately checks the polearm midpoint between its two palms.

The final ten-second gameplay capture averaged 55.14 FPS at 1440×900 and pixel ratio 1. It contained 24–43 enemies and reported no console errors. CPU skin tests did not run during this capture. This result applies to the tested scene and machine; it does not establish performance across every course.

Review evidence is in `artifacts/ace-native-integrated/`. Local reviewers inspected the front/side strips and gameplay frames. No Opus review has occurred for these final Ace clips. The other seven Ace attacks still use their previous animations; this pass does not establish full-roster animation quality.
