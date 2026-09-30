# Golf support across the roster

All six characters now extend their lead leg through impact and finish over that shoe.
The rear heel rises as the body turns. Its knee keeps the calibrated hinge direction.
Both hands retain their fitted position and orientation around the same club.

This release extends the earlier Ace correction to the other five characters.
It also refines the Ace's fit. Only `Golf_Swing` changes in each model.

| Character | Previous impact knee bend | Revised impact knee bend | Revised finish knee bend |
| --- | ---: | ---: | ---: |
| Ronin | 44.6° | 27.1° | 12.0° |
| Shinobi | 44.3° | 26.8° | 12.0° |
| Vice President | 41.8° | 26.4° | 12.0° |
| Ace | 30.4° | 30.1° | 12.0° |
| Hustler | 54.5° | 30.1° | 12.0° |
| Closer | 51.9° | 29.4° | 12.0° |

The comparison uses the published `e0f163f` models. That release already included the Ace's first correction.
The lead hip remains within four centimetres of the supporting ankle laterally.
The men retain more forward hip hinge. A hip position alone does not measure the body's centre of mass.
The Ace retains her stricter existing horizontal support check.

## Fitting changes

The imported thighs descend from `spine_01`. The author now measures support after that bone turns.
This prevents a torso adjustment from moving the planted shoes.
The lead shoe turns 35 degrees after contact. The rear shoe uses its flat heading to guide the knee.
The three male rigs also need a small inward shoe roll during the heel lift.
The actual shoe surface sets its support height.

Ronin's wider trousers require more rear-knee separation during release.
His paired grip also turns around the lead shoulder during the finish.
The head and neck turn with that movement.
The arm fit includes the complete head boundary, including mixed triangles at the neck.

An initial candidate passed collision checks but oscillated during its final hold.
Actual Claude Opus 5.5 High identified this risk in the review images.
Dense motion measurements confirmed it. Damped parameter prediction removed the repeated rebound.
The follow-up review then identified a short elbow speed peak.
The final export slows that shoulder transition along the same fitted pose path.
It preserves the original downswing, impact, and final pose.
The measured peak elbow displacement falls from 14.0 mm to 10.0 mm per five milliseconds across the sampled finish window.

These fits run offline. They add no runtime search, bones, materials, or draw calls.
The exports preserve the original binary payload, geometry, textures, and 36 other animations.
Address, putting, running, and combat retain their previous clips.

## Verification and limits

The native checks cover grip closure, wrist limits, elbow direction, leg clearance, shoe contact, and support through impact.
The expanded head test covers all six characters from 1.6 to 2.4 seconds.
It checks complete arm and hand surfaces, fingers, the shaft, and the grip against the actual head surface.
It includes every native key, adjacent midpoints, and samples at 60 Hz.
The separate finish test rejects repeated head or shaft rebounds and Ronin's rejected elbow speed peak.

All 526 tests pass in an isolated release checkout. The production build succeeds.
Browser checks pass 108 terrain and frame-rate cases, 150 golf phases, all eight clubs, and all six selection loops.
The preview checks cover `C`, speed, pause, resume, and retained settings.
Production playback matches the native transforms and rendered pixels across 2,394 samples.
The final Ronin asset reproduces byte for byte from the checked source and author.

Opus reviewed still images and numerical trajectories. It did not watch a video or certify the complete animation.
Its reviews found no clear lower-body defect in the six revised pose sheets.
The high arm position in some finishes still needs artistic refinement.
These corrections do not establish complete animation realism or AAA quality.

Local evidence lives in `artifacts/reviews/roster-golf-weight-transfer/`.
It includes accepted and rejected measurements, candidate images, actual Opus responses, and release checks.

## Reproduction

Extract each source model from commit `4ddf88a`. The author checks its hash before it writes a candidate.

```sh
node tools/art-candidates/golf-weight-transfer.mjs \
  --hero ronin --source /tmp/ronin-source.glb \
  --output /tmp/new-ronin-golf-candidate
```

Repeat with `shinobi`, `monk`, `kaede`, `ayame`, or `sora`.
The author samples the original keys and a 480 Hz grid.
It writes only to a new directory under `/tmp`.
Run the native, browser, and visual checks before replacing a production model.
