The Ace has a new review candidate for her opening cut. It is not installed in the game.

The candidate fixes the backward blade path. The jian now cuts forward and downward, using a sharpened edge. Its wrist stays neutral. The pelvis turns before the chest, the lead foot lands before contact, and the rear heel rises around a fixed toe. The free hand stays separate from the sword.

Generate the candidate from the current model:

```sh
node tools/author-native-ace.mjs --output /tmp/ace-review.glb --record /tmp/ace-review.json
NINJA_ACE_CANDIDATE=/tmp/ace-review node --test tools/check-native-ace.mjs
node tools/verify-animation-replacement.mjs --before public/models/kaede.glb --after /tmp/ace-review.glb --replace Fan_Cut_Diagonal:Ace_Cut_Diagonal --replace Fan_Ready:Ace_Ready
node tools/capture-native-motion.mjs 3 Ace_Cut_Diagonal /tmp/ace-review.png --model /tmp/ace-review.glb --motion-record /tmp/ace-review.json --ready-record /tmp/ace-review.ready.json --replace-clip Fan_Cut_Diagonal
```

The author refuses output paths inside `public/`. It replaces two animation descriptors and appends their samples. It preserves 6,043,844 original binary bytes and 35 unrelated clips, including golf.

The handle fit previously placed the forearm mainly along the blade's flat face. The author derives an 82.02-degree mounting correction from the measured neutral forearm. This correction rotates the blade about the handle. It preserves the fitted shaft direction and palm position.

The 0.60-second candidate places contact at 0.27 seconds. Tests sample joint motion at 480 Hz and the actual skinned arms at 240 Hz. They report:

- Neutral wrists throughout the stroke.
- Zero detected arm–torso intersections and elbow-fold penetration.
- 0.142 mm maximum planted-ankle drift.
- A fixed rear toe during the heel rise.
- 7.45 m/s maximum hand speed.
- 17.42 m/s maximum blade-tip speed.
- 13.25 m/s blade-tip speed near contact.
- 0.989 edge alignment and 0.008 face alignment near contact.
- 0.593 m minimum blade clearance.

An independent local agent inspected the front and side renders. It accepted the poses for runtime review. It noted a possible hesitation before the later speed peak near 0.30 seconds. Earlier concern about the reported forearm-roll value used an incorrect anatomical interpretation. That value measures correction from the imported bend plane; it does not measure anatomical pronation.

Integration remains unfinished. The runtime previously derived the golf grip orientation from the weapon's Ready frame. A browser comparison found an unwanted 82.02-degree club rotation with this candidate. The Ace now has explicit fitted golf frames in `src/grip-data.json`. `HandGrip` honors them independently, and the fitting tool preserves them. Unit tests exercise changed combat frames and refitted shaft axes. A second browser comparison measured zero change in both golf frames. The comparison reports are in `artifacts/ace-native-candidate/`.

The combat controller still schedules the original 0.40-second opening cut. Update its duration and contact time together with the new clip. Then check transitions to every other attack, guards, running, selection, and golf. Inspect the crossguard and all fingers after the mounting correction. The candidate's two passing source tests do not establish those runtime properties.

The current renders and report are in `artifacts/ace-native-candidate/`. The current candidate has not received an Opus review.
