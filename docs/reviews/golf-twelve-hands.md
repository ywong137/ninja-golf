# Twelve isolated golf hands

These profiles are a baseline for full-body fitting. They do not change production models or runtime grip data.
The root reviewer inspected the isolated hand views and accepted their visible wrap and thumb positions.
Paired hands still need clearance checks on the assembled club throughout the new swing.

## Checkpoint

`tools/art-candidates/golf-hands/twelve-hands/manifest.json` records all twelve profiles and the six input model hashes.
`roster.json` contains only the candidate golf hand profiles. Merge these hand entries explicitly; do not replace the production roster.
The original four source profiles and their manifest remain unchanged in the parent folder.

Each new hand retains its initial shaft seed and four-finger thumb source.
Each final profile retains the thumb pad vertices, distal cap vertices, joint limits, and finger parameters.
Each `before-adjacent.json` preserves the profile before the narrow adjacent-finger correction.
The manifest records those corrections separately.

All eight remaining hands use their own imported geometry and native joint frames.
None has identical local mesh positions, topology, and weights to either reviewed control.
No hand profile was transferred on the assumption that the meshes matched.
The comparison report is `/tmp/ninja-golf-hand-mesh-comparison.json`.

## Fixed geometry and calibration

The shaft radius is 12 mm. Its axis makes 50 degrees with the hand's wrist-to-middle-MCP direction.
The new seed places the center along the hand, then adjusts its palmar offset against the actual skin.
The shaft center, axis, radius, and frame remain fixed through finger and thumb fitting.

The finger fitter uses each imported bone's neutral rotation and a measured hinge axis.
It calibrates MCP splay about the palmar normal. It limits splay to 0.35 radians in either direction.
The thumb fitter uses the actual distal pad and cap, rather than the segment vertex centroid.
The preceding anatomical segment defines the distal reference for most hands.
Shinobi left and Monk left use their measured cap direction and the same 63.025-degree CMC limit as Ronin left.
This avoids the earlier visible fold at the thumb base.

All fitted thumbs stay within the existing MCP and IP delta limits.
Several reach the small extension end of the IP range. These are changes from the imported neutral pose.
The four-view review found no visible thumb-base inversion in the retained profiles.

The old Ronin and Kaede profiles retain their original frame fields for exact preservation.
Those frame Y axes differ from the later shaft axes by approximately 10 degrees.
The golf author already reconstructs the mount from the shaft axis. Continue that explicit reconstruction.
The eight new profile frames align with their shaft axes.

## Separate-finger correction

The expanded control check found defects beyond the previously tested thumb contact.
Shinobi right and Monk right had 48 index–middle triangle intersections each.
Monk left, Ronin right, and Ronin left had eight ring–pinky intersections each.
Kaede left had five ring–pinky intersections.

These were actual interior intersections. None shared a posed vertex within one micrometre.
The checker distinguishes shared edges and touching seams from an edge entering a triangle interior.
The original intersection segments reached 5.46 mm on the two male right hands.
Segment length is not penetration depth.

The narrow correction changes only the two affected finger chains.
It preserves every shaft field, all thumb rotations, and all unaffected finger rotations exactly.
It limits the largest individual joint change to 5.22 degrees on Monk right.
Corrections to the prior Ronin and Kaede controls stay below 1.04 degrees.
The corrected digits retain distal contact and visible wrapping around the shaft.

## Actual skin checks

The source check samples Golf Address and the current Golf Swing at 120 Hz.
It applies the candidate fingers after each source wrist pose. Mixed hand and forearm weights therefore participate.
There are 291 poses per hand, or 3,492 hand poses total.
All twelve have zero thumb/finger and separate-finger triangle intersections under the stated surface filter.

For separate digits, each triangle vertex must have more than 50% weight on that digit.
This filter does not represent every mixed proximal web triangle. The next section records that separate limit.
The shaft check includes mixed hand triangles and measures the triangle surface, not only the vertices.
Its maximum depth is 1.365 mm. The permanent candidate check retains a 1.5 mm rejection limit.

| Hand | Thumb pad-center gap, mm | Thumb cap angle to shaft | Full hand triangle/shaft depth, mm |
| --- | ---: | ---: | ---: |
| Ronin right | 3.83 | 28.1° | 1.152 |
| Ronin left | 3.42 | 29.8° | 1.152 |
| Kaede right | 2.03 | 27.6° | 0.575 |
| Kaede left | 1.90 | 25.9° | 0.566 |
| Shinobi right | 3.76 | 26.5° | 1.365 |
| Shinobi left | 3.48 | 33.8° | 1.267 |
| Monk right | 3.76 | 26.5° | 1.365 |
| Monk left | 3.48 | 33.8° | 1.274 |
| Ayame right | 2.03 | 26.6° | 0.964 |
| Ayame left | 2.02 | 26.1° | 0.966 |
| Sora right | 1.83 | 23.7° | 0.939 |
| Sora left | 1.92 | 25.4° | 0.884 |

The curved pad has a small center gap while its nearest surface contacts the shaft.
The maximum thumb vertex depth is 0.603 mm across all twelve controls and candidates.
The full-hand depth column includes the other fingers and the palm.

## Remaining proximal web folds

A second check assigns mixed web triangles to their largest combined bone-weight group.
It then distinguishes boundary contact from a proper edge/triangle intersection.
This detects small folds near the proximal index–middle web on most hands.
Sora also has a ring–pinky web fold. Kaede has no proper mixed-web intersections under this check.

The local projected-plane inset estimates range from 0.655 mm on Ronin to 4.202 mm on Sora left.
These estimates sample opposing triangle planes. They are not closed-mesh penetration depths.
The durable `web-fold-depth.json` records the triangle indices and worst locations.
The full diagnostic report remains `/tmp/ninja-golf-twelve-hands/adjacent-crossings-with-seams.json`.

The reviewed silhouettes show normal-looking proximal creases rather than a visible inverted digit.
The root reviewer retained this baseline for body fitting, with these limits stated explicitly.
A separate Shinobi trial removed all mixed-web intersections but required about 20 degrees of additional middle-finger splay.
That trial remains outside this checkpoint. It would distort the reviewed grip to satisfy an invisible-mesh objective.

This checkpoint therefore does not claim that every adjacent skin triangle is intersection-free.
It also does not establish clearance between the two assembled hands, the club, the head, or the body.
Those checks belong to the complete swing candidate.

## Reproduction

Rebuild one thumb and its saved narrow finger correction:

```sh
node tools/art-candidates/golf-hands/twelve-hands/rebuild-hand.mjs \
  --hero monk --side r --output /tmp/golf-monk-r-rebuilt.json
```

The command recalibrates hinge axes from the current imported model.
It checks every final quaternion against the isolated checkpoint before writing the output.
A changed reconstructed rotation causes a clear mismatch error. Reassess the current geometry before updating the checkpoint.
The command refuses an output inside the project.

Run the actual posed skin check:

```sh
node tools/art-candidates/golf-hands/twelve-hands/check-hands.mjs \
  --rate 120 --output /tmp/golf-twelve-hands-check.json
```

Use `--bind-only` for an isolated bind-hand diagnostic. Both commands support `--help`.
All twelve rebuilds reproduced all 180 joint quaternions exactly. The maximum component difference was zero.
`rebuild-check.json` records that result.
Neither command changes models or production grip data.

The source fitters remain `tools/fit-golf-fingers.mjs` and `tools/fit-golf-thumb-pad.mjs`.
The checkpoint saves their output and the narrow repair parameters. It does not duplicate those optimizers.

## Visual evidence

Each prefix has `-palm.png`, `-side.png`, `-back.png`, and `-thumb.png` views.
The renderer loads the actual textured model and the fixed 12 mm cylinder.
It masks the rest of the body; cut wrist edges are diagnostic boundaries.

- `/tmp/ninja-golf-twelve-hands/ronin-r` and `ronin-l`: repaired control hands.
- `/tmp/ninja-golf-twelve-hands/kaede-l`: repaired control hand.
- `/tmp/golf-finger-preview-50-18-pad-v1`: unchanged Kaede right control.
- `/tmp/ninja-golf-twelve-hands/shinobi-r`: repaired right hand.
- `/tmp/ninja-golf-remaining-hands/shinobi-l`: unchanged left hand.
- `/tmp/ninja-golf-twelve-hands/monk-r` and `monk-l`: repaired hands.
- `/tmp/ninja-golf-remaining-hands/ayame-r` and `ayame-l`: new hands.
- `/tmp/ninja-golf-remaining-hands/sora-r` and `sora-l`: new hands.
