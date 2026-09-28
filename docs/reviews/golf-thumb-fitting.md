# Golf thumb diagnosis and four-hand candidates

The reviewed candidates remain outside the public assets. No runtime grip changed.
The reusable tool is `tools/fit-golf-thumb-pad.mjs`.
Both reviewers accepted the four isolated hand poses for the next paired-hand test.

## Finding

For Kaede's fixed right-hand shaft, the CMC lies 66.4 mm from the cylinder axis.
The metacarpal measures 26.7 mm. Even unrestricted CMC rotation leaves the MCP at least 39.7 mm from the axis.
That joint cannot rest against a 12 mm radius shaft. Do not force the middle segment into contact.
The proximal thumb can angle toward the shaft while the distal pad rests against it.

The old segment-3 centroid lies 15.45 mm beyond the IP joint.
The farthest distal vertex lies 25.57 mm away. The centroid is not the fingertip.
That error shortens the target by about 10 mm. It does not alone explain the former nearly transverse thumb.
The middle-contact objective and the unrestricted base aim caused the larger defects.

## Calibration

The fitter starts from the actual imported bind pose, before applying any golf grip rotations.
The middle MCP defines the hand's long direction. Index-to-pinky MCP displacement defines its transverse direction.
Their cross product defines a palmar normal, with its sign toward the existing grip center.

The MCP and IP bend about calibrated axes. Each axis is the anatomical segment direction crossed with the projected palmar normal.
The fitter transforms these axes into the native joint frames and applies rotation after each imported neutral quaternion.
It does not substitute the bone's local X, Y, or Z axis.
The exact local axes appear in each `*.report.json` file.

The distal cap contains vertices within 4 mm of the largest bind projection along the distal segment.
The pad uses palmar-side distal vertices between 5 mm beyond the IP joint and 3 mm before the measured tip.
The two vertex sets can overlap at the cap boundary.
The accepted Kaede hands and Ronin right use the preceding segment for their bend-plane reference.
Ronin left needs its actual cap direction because the imported distal skin diverges from that preceding segment.
`capVertices` and `padVertices` in the reproducible CLI outputs retain the actual mesh names and vertex indices.

The optimizer moves only the three thumb rotations.
It scores distal pad contact, distal alignment, pad facing, cylinder penetration, and exact thumb/finger triangle crossings.
It does not score middle-thumb contact or require a minimum little-finger winding.
The four-finger arrays and the center, radius, axis, and frame remain exactly unchanged.

The MCP delta stays between −0.20 and +1.15 radians. The IP delta stays between −0.25 and +1.35 radians.
These are changes from the imported neutral pose, not absolute anatomical angles.
The accepted thumbs reach the small extension end of that IP range.
Ronin left uses a 1.10-radian base-rotation limit. The other hands use 1.55 radians.
A less constrained Ronin-left attempt caused a visible base fold and was rejected.

## Measurements

The posed check samples Golf Address and the installed Golf Swing at 120 Hz: 291 poses per hand.
It applies the candidate fingers after each source wrist pose, so mixed skin weights participate.
All four hands have zero thumb/finger triangle crossings.
The cylinder check measures the projected triangle surface, not only the vertices.

| Hand | Pad-center gap, mm | Minimum finger clearance, mm | Maximum triangle/cylinder depth, mm | Actual distal-cap angle to shaft | MCP delta | IP delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| kaede r | 2.03 | 12.71 | 0.105 | 27.6° | -2.46° | -14.32° |
| kaede l | 1.90 | 13.17 | 0.228 | 25.9° | -4.93° | -14.21° |
| ronin r | 3.83 | 9.93 | 0.603 | 28.1° | -2.29° | -14.32° |
| ronin l | 3.42 | 9.36 | 0.552 | 29.8° | -11.31° | -14.23° |

These are one-hand checks through existing source wrist poses.
They do not establish that both new hands fit one assembled club throughout the new golf animation.
The golf agent received the candidate file for that separate validation.
The 2–4 mm pad-center gaps include a curved contact patch. The nearest surface contacts the shaft.

## Deliverables

- `/tmp/ninja-golf-complete-hand-candidates.json`: full roster with the four thumb candidates.
- `/tmp/ninja-golf-complete-hand-preservation.json`: source mapping and fixed-field verification.
- `/tmp/ninja-golf-thumb-posed-check.json`: posed contact and intersection results.
- `tools/fit-golf-thumb-pad.mjs`: reusable thumb-only CLI.
- `/tmp/ninja-check-golf-thumb-poses.mjs`: posed diagnostic used for these measurements.

Capture prefixes have `-palm.png`, `-side.png`, `-back.png`, and `-thumb.png` views:

- `/tmp/golf-finger-preview-50-18-pad-v1`: Kaede right.
- `/tmp/golf-thumb-pad-kaede-l-v1`: Kaede left.
- `/tmp/golf-thumb-pad-ronin-r-v1`: Ronin right.
- `/tmp/golf-thumb-pad-ronin-l-v3`: Ronin left.

## Reproduction

The CLI takes one hand profile through `--profile`. It does not fit the four fingers.
It rejects missing fields, invalid calibration choices, a crossed thumb, or more than 1 mm vertex penetration.
It also rejects failed pad alignment/contact, input overwrites, and invalid vectors or quaternions.
The output must use a `.json` extension. Its `.report.json` companion remains a separate file.
It asserts that the shaft fields and four-finger arrays remain unchanged.
Use the later posed triangle check before accepting a complete animation.

For Kaede either hand and Ronin right:

```sh
node tools/fit-golf-thumb-pad.mjs \
  --hero kaede --side r --profile /tmp/golf-thumb-source-kaede-r.json \
  --output /tmp/golf-thumb-rebuilt.json \
  --distal-axis preceding-segment --search compact
```

For Ronin left:

```sh
node tools/fit-golf-thumb-pad.mjs \
  --hero ronin --side l --profile /tmp/golf-thumb-source-ronin-l.json \
  --output /tmp/golf-thumb-ronin-left-rebuilt.json \
  --distal-axis cap --search broad --cmc-max-degrees 63.02535746439056
```

The four CLI rebuilds reproduce every accepted quaternion component exactly.
Their files are `/tmp/golf-thumb-pad-cli-rebuild.json` for Kaede right, and `/tmp/golf-thumb-pad-cli-HERO-SIDE.json` for the other hands.
