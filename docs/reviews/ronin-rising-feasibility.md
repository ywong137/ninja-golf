# Ronin rising-cut feasibility review

This study does not change the published model, grip, or animation bounds.
The tested poses failed visual and skin checks. Do not install them.

## Published defect

The current Ronin still uses legacy attachment targets for most attacks.
Actual runtime samples show blade/head contact in the opening cut, rising finisher, slam, and musou.
The rising finisher also puts both forearms through the torso.
The blade-curvature release preserves these earlier defects; it did not introduce them.

The candidate Ready, cleave, diagonal, guards, and return were rebuilt against `7f52f9f`.
The rebuild succeeded in `/tmp/ninja-ronin-contact/family.glb`.
This family uses the reviewed 150 mm hand spacing and 14 mm handle radius.
It remains separate from the published model.

## Independent review

Actual Claude Opus 5.5 High reviewed eight rendered views and the fitting code.
The response reports `modelUsage.claude-opus-5-5` and no permission denials.
The prompt, response, and extracted review are in `artifacts/ronin-rising-feasibility/`.

Opus rejected the high-hand poses. It identified three concrete problems:

- The selected source body lowered the pelvis while the hands rose.
- Soft orientation targets allowed blade-direction errors of roughly 12–40 degrees.
- The requested high finish forced the forearms around the face.

Opus corrected its earlier chamber and finish advice after seeing the results.
Its replacement design uses a lower diagonal cut and a rising pelvis.
These recommendations are authoring proposals, not verified poses.

## Tests and rejection

The right forearm, expressed in the candidate weapon frame, is approximately `[0.76052, 0.64279, -0.09185]`.
Local X faces the cutting edge; local Y points toward the tip.
With a neutral wrist, the target blade frame therefore strongly constrains the elbow position.
Matching the palm alone cannot establish a valid pose.

A direct joint construction replaced the soft orientation fit for the next experiment.
It sampled blade planes, upper-arm directions, and wrist deviations within the original authoring bounds.
Both hands retained a common shaft and the fixed grip spacing.
The body used separate pelvis and chest turns, with leg solves preserving the source foot positions.

The four selected low poses passed the sampled joint and palm constraints.
They still failed the skin check:

| Pose | Right upper-arm/torso crossing pairs |
| --- | ---: |
| Chamber | 25 |
| Drive | 26 |
| Contact | 14 |
| Finish | 18 |

The finish also produced 6.90 mm of radial overlap at the left elbow.
The rendered views show the corresponding raised support elbow and crowded arm arrangement.
These are failures, despite the accurate hand-center attachment.

Separate diagnostic runs varied the shaft angle and temporary joint bounds.
They did not establish a publishable sequence. The production bounds remain unchanged.
A finite grid failure does not prove that the grip or motion is universally impossible.

## Retained evidence

`artifacts/ronin-rising-feasibility/` contains the selected pose transforms, skin report, images, solver sources, logs, and Opus review.
The copied solver sources retain their original temporary input paths. They are experiment records, not standalone release tools.
The complete temporary experiments remain under `/tmp/ninja-ronin-contact/`.

Do not reuse the early random search without its independent source rig.
Three's animation mixer can skip unchanged track writes after external bone edits.
The corrected search samples an untouched source rig and then copies its pose.

The next motion needs body clearance during fitting, followed by continuous hand and blade checks.
Do not relax joint limits or skin checks to accept these rejected poses.
The complete Ronin family still needs consistent attacks and runtime transitions before its mount can replace the published one.
