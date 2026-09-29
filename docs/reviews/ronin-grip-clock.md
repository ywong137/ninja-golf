# Support-hand rotation around the hilt

The offline Ronin candidate has an unconstrained rotation in its support-hand solve.
Matching the palm centre and shaft direction leaves that rotation free.
Consequently, exact attachment and good finger/shaft clearance do not establish a stable two-handed grip.

This finding reopens the candidate's grip review. It does not change the published model or the corrected blade curvature.

## Direct hand measurements

The new check measures the proximal interphalangeal joints: the middle knuckles along the fingers.
It projects each joint onto the plane perpendicular to the handle.
It then measures that radial direction against the actual cutting edge, local +X.
These are joint centres within the fingers, not palm-surface contact points.

The left and right fingers form mirrored arrangements.
The comparison mirrors the reference angles before fitting one common rotation around the handle.
It reports each residual separately. This distinguishes hand rotation from different finger shapes.
No universal anatomical angle threshold applies.

The 60 Hz candidate measurements are:

| Clip | Left-hand rotation relative to mirrored right hand | Largest finger-shape residual |
| --- | --- | --- |
| Ready | −53.08° | 0.0061° |
| Heavy Cleave | −85.04° to −20.75° | 0.0063° |
| Return | −56.24° to −16.23° | 0.0062° |

The primary hand retains its orientation relative to the blade throughout these clips.
The support hand turns through about 64.29° during the cleave despite its fixed finger shape.
The small shape residual confirms that this difference comes from hand rotation, rather than different finger arrangements.

The input model was `/tmp/ninja-ronin-contact/family.glb`.
Its SHA256 is `d07afa1b3963e18863a61b8609ae1a7dc1a211e7ca325895f7e2af7d35453e63`.
The report contains 121 Ready samples, 47 cleave samples, and 53 return samples.
These samples establish the measured defect, not complete between-frame motion quality.

## Reference and independent review

The [New York Battodo grip explanation](https://www.newyorkbattodo.com/post/kissaki-and-grip-perception-and-actuality) relates the middle knuckles to the cutting edge.
It also requires firm contact across the palm pads.
Its upward-cut description finishes with the hands around eye level and the tip forward.
Its photographs demonstrate grip errors; they must not become approved pose templates.
This source does not establish a numerical rotation limit for our rig.

Actual Claude Opus 5.5 High reviewed the renders, measurements, and measurement code.
The response identifies `claude-opus-5-5` and reports no permission denials.
Opus identified the left/right mirror convention, which the revised comparison now handles explicitly.
It agreed that the support-hand rotation was missing from the constraints.
It did not certify the full motion or palm contact.
Its earlier low-handed finish suggestion remains unverified and does not override the instructor reference.

The retained files are in `artifacts/grip-clock-review/`.
The final overlay displays joint centres through the skin for inspection.
The earlier image supplied to Opus kept those markers occluded by the skin.
Its numerical diagnosis therefore relies on the joint measurements, not those hidden markers.

## Reproduce the measurements

Build the offline family using `tools/ronin-candidates/README.md` and `RETURN.md`.
Use the same candidate grip patch as the authoring tools.

```sh
node tools/ronin-candidates/check-grip-edge.mjs \
  --model /tmp/ninja-ronin-contact/family.glb \
  --clip Ronin_Ready --clip Ronin_Heavy_Cleave --clip Ronin_Cut_Return \
  --output /tmp/ronin-grip-edge.json

node --test tests/grip-edge-alignment.test.js tests/shared-hilt-closure.test.js \
  tests/weapon-frame.test.js tests/weapons.test.js
```

All 21 focused tests pass.
They cover angular direction, mirrored fingers, world transforms, angle wrapping, invalid landmarks, shaft closure, and curved blade geometry.

## Remaining correction

Refit the support hand against a reviewed full palm frame relative to the blade.
Allow only explicitly reviewed variation around that frame.
Keep separate checks for elbow motion, forearm rotation, wrist motion, palm surfaces, and blade clearance.
Do not silently clamp unreachable poses or rotate the blade to hide an invalid wrist.

The new fixed-frame experiments still fail body-clearance checks.
They remain outside the game assets.
The earlier candidate approval cannot substitute for this missing grip-orientation review.
