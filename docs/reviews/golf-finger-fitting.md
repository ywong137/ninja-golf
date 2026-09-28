# Golf finger fitting

The golf grip needs a diagonal shaft through the fingers. A contact distance alone does not prove that the hand closes around it.
An open finger can pass a nearest-vertex test by touching the shaft with one vertex.

`tools/fit-golf-fingers.mjs` fits four fingers against the actual skinned hand.
It keeps the supplied shaft center, axis, radius, hand frame, and thumb rotations.
It writes a separate candidate outside the runtime source and public assets.
It does not approve or install that candidate.

Each finger has three flexion hinges and limited knuckle splay.
The hinges follow the rest-pose segments and palm normal.
The final hinge uses the preceding segment because that bone has no child.
The fit couples the middle and distal joint rotations to prevent isolated hooked fingertips.
Multiple starts include an almost straight first knuckle. Ronin needs that start to avoid a false local minimum.

The objective combines skin penetration, segment contact, finger winding, and joint coupling.
The winding angle is a diagnostic. Different finger lengths can produce different valid values.
Inspect the actual silhouette and distal pad contact before accepting a hand.

Example:

```sh
node tools/fit-golf-fingers.mjs \
  --hero kaede --side r \
  --grips /tmp/candidate-roster-grips.json \
  --output /tmp/kaede-right-four-fingers.json
```

The input contains the roster dictionary, including `kaede.golf.r`.
The output contains one hand profile. Merge it deliberately into a candidate roster before body fitting.
The new `fingerClosureFit` contains current measurements. The tool removes obsolete fit measurements from the source profile.

The regression fixture uses a 12 mm handle radius and a shaft at 50 degrees to Kaede's hand.
All four fingers wrap around the shaft with less than 1 mm penetration and less than 2 mm middle/distal contact gaps.
The regression also verifies that the shaft, thumb, and source file stay unchanged.

## Remaining acceptance work

This tool does not solve the thumb or fit the two hands together.
The first separate thumb correction intersected the index finger despite good shaft contact.
An exact triangle check detected that defect. That correction was rejected.
The thumb's distal pad also needs a proper anatomical endpoint; a segment's vertex centroid is not its fingertip.

Before a candidate enters the game, check both hands, finger self-intersections, shared shaft contact, wrist limits, and the full swing.
Review the rendered hand from the palm, back, side, and thumb side.
No runtime grip changed with the introduction of this tool.
