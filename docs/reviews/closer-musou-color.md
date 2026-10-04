# The Closer musou face

The earlier close-up used a native facial morph with the neutral color atlas.
Her wide eyes and parted lips could read as alarm instead of anger.
A prior private texture trial changed only a small forehead and nose region.
It did not apply the complete generated expression to the 3D face.

The reviewed version blends the complete angry color atlas into her native head material.
It retains the original normal map, roughness map, UV coordinates, skin geometry, and facial morph.
The cinematic lowers her chin by seven degrees instead of two degrees.
The texture follows the same expression weight as the facial morph.
Golf, dodge, disposal, and neutral recovery clear it through the shared facial controller.
Each actor has a private material. The shared texture loads before shader preparation.

The WebP adds 209,796 bytes. It derives from the licensed Rocketbox Female Adult 12 color atlas.
The source record contains its hash and origin. No model files or animation records change.
Other heroes retain their current appearance and head pose.

Opus 5.5 High reviewed frontal and quarter views.
It preferred the full texture with the lowered chin and accepted it as an incremental improvement.
It identified slightly stronger weathering and painted creases as remaining limits.
The clenched-mouth and lifted-fringe studies remain rejected.
They produced a pout and a visible hair seam respectively.

## Validation

- Four unit checks cover private materials, shader composition, facial reset, and the texture hash.
- Material and loading checks preserve the existing surface maps and retry behavior.
- Twelve rendered comparisons cover four course lighting themes and three graphics settings.
- Each comparison verifies that the actual facial pixels change with the texture weight.
- Golf, dodge, combat recovery, and character replacement restore the neutral color state.
- All six musou cinematics retain their native face targets and complete camera duration.

The browser checks run muted. Evidence is in the primary checkout under
`artifacts/reviews/musou-clenched-pose`.
This improves the expression; it does not establish complete AAA facial animation.
