# Ronin guard transfer V2

Status: middle-guard appearance accepted locally; complete state-family release blocked.

The front and side review shows a wide stance, supported elbows, and near-neutral wrists. The root reviewer accepted the static middle guard. Impact and break still need a timing review.

The candidate transfers the accepted V63 arm and upper-trunk locals onto the original guard pelvis and leg paths. All seven guard clips use the same sword mount. The Ready and Cleave clips remain unchanged.

The first attempt retained the old trunk bends. That attempt caused 9–14 sleeve/torso triangle crossings. V2 replaces those upper-trunk bends with the accepted Ready relationship. The collision masks and bounds are unchanged.

The 2,842 native samples at 480 Hz find no arm/torso crossings, elbow folds, or anatomical-bound violations. Maximum wrist rotation is 13.400°. Maximum paired-palm error is 0.00012 mm. The actual runtime guard clips also have no blade/head crossings at 240 Hz. Their clearance exceeds the scanner's 30 mm reporting cap.

The source-preservation check retains 30 unrelated animations and all 5,647,164 original binary bytes from V63. It checks the original animation descriptors, buffer views, accessors, geometry, and model metadata.

## Transitions

The actual Warrior test samples nine state transitions at 240 Hz. It calibrates the arm hinge from the native bind pose. It measures local wrist rotation against the imported neutral hand rotation.

Ready→guard, guard→Ready, guard→impact, and guard→break pass the arm limits. Their held grips remain closed. All tested transitions have no blade/head crossings.

Guard→Cleave briefly reaches 0.948° of left elbow hinge deviation during mixer blending. The strict native-authoring limit is 0.5°. This remains an unresolved transition finding.

Running uses a separate procedural solver. Its shortest-arc segment aiming does not preserve the native hinge frame. These deviations occur with both the shipping and candidate models:

| Transition | Shipping right hinge deviation | Candidate right hinge deviation |
| --- | ---: | ---: |
| Run→guard | 31.42° | 31.21° |
| Guard walk→run | 81.04° | 79.61° |

Both versions reach 46.83° of left hinge deviation during guard walk→run. The candidate improves the held wrist angle, but that does not correct the elbow-axis error. Root owns the separate runtime-solver repair.

Do not describe the guard family as fully verified until the running transitions pass. Do not install its global sword mount while other Ronin attacks remain invalid.

## Reproduction and evidence

Use `tools/ronin-candidates/README.md` for the candidate commands and hashes.

Local evidence is in the ignored `artifacts/ronin-guard-transfer-v2/` directory. It includes the front/side sheet, native checks, actual runtime checks, transition summaries, and snapshot reports. Original source photographs are not included.
