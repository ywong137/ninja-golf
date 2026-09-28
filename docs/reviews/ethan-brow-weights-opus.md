# Ethan: local inner-eyelid weights

Eight eyelid vertices had an abrupt change in inner-brow influence.
That change compressed the crease during musou and created a straight shelf.
The reviewed correction smooths these eight weights and transfers the difference to the Head bone.
All other skin influences remain unchanged.

The runtime retains the reviewed 3 mm brow movement.
The neutral head geometry, eyes, glasses, textures and all 37 clips remain unchanged.
This is an expression correction, not a new neutral eye shape.

## Visual review

Claude Opus 5.5 High reviewed the actual matched close-ups and full portraits.
The canonical model was `claude-opus-5-5`.
The session was `98982e6a-d59f-4e80-b258-7b05403151bc`.

Opus accepted the weight change at the existing 3 mm movement.
It found a softer inner crease, unchanged brow intensity, and no new visible ridge.
The improvement is small at portrait distance.
A faint straight segment and the dark outer-corner texture wedges remain.
The likeness and emotional intensity still need work.

The reviewer required an audit of other animations that use the same brow bones.
Every channel stays at its neutral transform within floating-point export noise.
The maximum translation difference is 0.000447 mm; the maximum rotation difference is 0.000010 degrees.
The runtime uses these bones only for the reviewed musou overlay.
Tests now require a new review if another clip adds meaningful brow motion.

The 6 mm captures are diagnostic stress tests. They do not change the production expression.
The local evidence resides in `artifacts/ethan-brow-weights-review/`.

## Measured scope

The modified vertices are 700, 706, 755, 756, 1275, 1281, 1331 and 1334.
Only 56 binary bytes change in their joint and weight rows.
Positions, normals, texture coordinates, topology, eye weights and all other payloads remain exact.
The resulting neutral skin differs by at most 0.000108 mm from floating-point rounding.
The upper-brow movement remains exact.

At 3 mm, the minimum projected crease-area ratio improves from 0.192 to 0.485.
At the former 6 mm movement, it improves from −0.286 to 0.424.
These ratios describe four reviewed triangles through one fixed camera.
They are regression measurements, not general anatomical validity scores.

## Rebuild and verification

The author validates every head stream, the rig mapping and the inverse bind matrices before writing.
It rejects duplicate application, altered topology, corrupt recipes and file aliases.
The saved recipe preserves later animation changes.

The full rebuild restores measured head geometry first, then applies the brow weights, then adds the reviewed side hair.
That sequence reproduces the released head and hair streams exactly.
The existing geometric-fit checks reverse only the verified weight patch before comparing their original fingerprints.
They retain the original fingerprints and thresholds.
The negative regression explicitly restores the old weights and still detects the former overhang.

All 26 focused face, refinement, rebuild and weight tests pass.
The browser integration passes for six heroes and four enemy classes.
The production build passes.
The new model adds no vertices, draw calls or per-frame work.

Unaccepted golf and cleave edits remain separate from this release.
