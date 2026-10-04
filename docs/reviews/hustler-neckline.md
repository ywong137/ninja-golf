# Hustler neckline repair

The separate collar strips floated above the jacket during the musou close-up.
The jacket already has a finished, bound neckline. The repair removes those two detached pieces.
It removes 992 triangles and one draw group. It preserves every existing binary byte, including all 40 animations.
The face, body, materials, rig, and remaining clothing do not change.
The wardrobe generator now omits the same collar pieces.

A muted browser checked the close-up and six poses: ready, golf address, golf backswing, light attack, heavy attack, and running.
All 13 affected regression checks and the production build pass. The existing bundle-size warning remains.
The asset preservation test reconstructs the previous mesh list before checking its recorded hash.
Local review images and the exact preservation report are in `artifacts/reviews/hustler-neckline` in the primary checkout.

The rejected four-cut Hustler musou remains separate. This repair does not include that clip or its weapon changes.
