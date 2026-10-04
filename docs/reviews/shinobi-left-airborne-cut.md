# Shinobi Crossing dive

After two light attacks, a heavy attack now performs a left-handed jumping cut. It replaces the old `Twin_Heavy_Rising` performance through the character's motion override. The move includes a preparation step, leap, torso turn, deep landing, and recovery. The left sword strikes; the right sword covers and balances.

This mirrors the complete accepted `Shinobi_Airborne_Cut`. The source is Adobe Mixamo Sword And Shield Power Slash. The private source FBX and its provenance remain in the primary checkout. The game contains fitted motion on its existing character. This is not a replacement for the Shinobi's musou.

The existing mirror tool reflects world-space changes from opposite bind frames. It then reconstructs local bone rotations. Both closed grips remain intact. The assembly keeps vertical movement in the animation and applies the reflected horizontal path through the actor controller. The source record already contains that extracted path, so the assembly must copy it with X reflected.

Native duration is 2.4333 seconds. Playback at 1.6x lasts 1.5208 seconds. The left blade strikes at native time 1.3767 seconds, or gameplay time 0.8604 seconds. Horizontal travel remains 0.8920 metres. The fixed grip roll is zero; the entry blend is 0.14 seconds. Damage retains the existing second heavy branch's value.

The append preserves all 19,864,984 prior binary bytes. Meshes, nodes, skins, textures, materials, the native angry face target, and 41 earlier animations remain unchanged. The new clip adds 803,584 bytes before compression. The preservation ledger records the append after the facial revision.

Validation:

- At 240 Hz, every measured elbow and knee bends in its natural direction. Maximum wrist deviation is 24.99 degrees.
- The native sole apex remains 0.3805 metres. The minimum sole height is -0.000358 metres. The landing error stays below 0.000043 metres.
- The body drops and rises through 0.8162 metres. Chest rotation spans about 180 degrees.
- A 120 Hz surface check finds no intersections between either weapon and the head, body, or limbs.
- The active cutting edge aligns with transverse strike travel at 0.933. Blade-flat alignment is 0.288.
- Nine installed gameplay cases use actual buffered light-light-heavy inputs at 40, 60, and 144 Hz. They verify damage, both attached weapons, moving entry, and queued-light recovery.
- The rebuilt character preview retains identical bounds; only its model fingerprint changes.

Opus 5.5 High accepted the major body mechanics in six paired-view stills. It noted the source's raised head during the leap. Stills do not establish timing. The separate gameplay checks cover input handling and transitions. Normal play remains the final measure of combat feel.

Reproduction starts with commit `0c466be`:

```sh
node tools/mirror-sword-motion.mjs --input BASE/shinobi.glb \
  --clip Shinobi_Airborne_Cut --name Shinobi_Left_Airborne_Cut \
  --output REVIEW/mirrored/shinobi.glb --grips src/grip-data.json --hero shinobi
node tools/assemble-source-attack.mjs --base BASE/shinobi.glb \
  --source REVIEW/mirrored/shinobi.glb --source-clip Shinobi_Left_Airborne_Cut \
  --template Twin_Heavy_Sweep --name Shinobi_Left_Airborne_Cut \
  --output REVIEW/candidate/shinobi.glb --grips src/grip-data.json --hero shinobi \
  --dual-wield --impact 1.3766666666666643 --speed 1.6 --grip-roll=0 \
  --credit 'Mirrored complete Mixamo Sword And Shield Power Slash'
```

Then copy `Shinobi_Airborne_Cut.planarRoot` into the new record and negate each row's X coordinate. Set `impactHands` to `["l"]` and `entryBlend` to `0.14`. Do not extract travel again from the already stationary source root.

Private evidence lives in `artifacts/reviews/shinobi-left-airborne/current/` in the primary checkout. It includes preservation, anatomy, cutting direction, full-body clearance, paired-view renders, a silent motion recording, and installed gameplay results.
