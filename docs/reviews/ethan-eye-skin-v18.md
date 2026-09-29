# Ethan eye appearance, revision 18

This revision removes duplicate painted eye darkness from two head-skin regions. The separate eyeball texture supplies the actual eyes.

The change preserves the thin upper-lid edge, iris color, gaze, glasses, and facial identity. It does not change the eye mesh or claim a measured geometric likeness correction.

## Measured findings

The private stencil study distinguishes visible boundaries from shadows and occluded corners. Central lid curvature remains inside the manual tracing uncertainty.

A downward orbit shift improves the front projection but worsens the tilted projection. A 7.23 mm front-only shift increases the tilted residual from 7.38 to 17.72 px.

That conflict does not establish a safe three-dimensional correction. Camera pose, expression, and glasses limit the inference.

## Reviewed change

The two UV masks have centers [898, 573] and [1150, 573], with radii [78, 47] pixels. Each mask fades after 65% radius.

The final atlas changes 21,603 pixels. Every pixel outside the masks remains identical. The separate iris and sclera region also remains identical.

The first corner-only trial made negligible visible improvement. The second trial removes the larger duplicate painted shadows and enters this revision.

Actual Claude Opus 5.5 High reviewed matched portraits and tight eye crops. It accepted the cleanup without a gaze or identity change.

The sessions were `f35b77bd-50a1-4006-a9eb-738839055c3a` and `1fbf4ef5-8dc2-4bcb-9860-5b4e60f4ca58`. Both results verify `claude-opus-5-5`.

Opus identified expression and bright sclera as remaining appearance issues. It did not support another eyelid sculpt from this evidence.

## Preservation and validation

All 12,830 accessor payloads remain byte-identical, including geometry, normals, UVs, weights, and all 37 animation clips. Nodes, skins, materials, and other images remain unchanged.

The replacement occupies the original image buffer range. The model grows by 877,776 bytes without keeping a duplicate head image.

The checked-in Blender recipe reproduces every decoded atlas pixel. Seventeen relevant facial and rebuild tests pass. The production build passes.

Matched neutral and musou renders retain the same head and gaze. No runtime deformation or per-frame rendering work was added.

The previous iris intermediate remains separate. Full character rebuilds now select `vice-president-face-clean-eyes.png`.

Model SHA-256: `652aedc56b0e98202467c133f965400ec4132540b949b53408aeb2719f1e4961`.

Private reference comparisons remain under `artifacts/ethan-eye-placement/`. They do not enter the game distribution.
