# Ronin heavy finisher candidate

This candidate remains outside the public game. Its native poses pass review, but the blade crosses uphill terrain.
Do not install the model or motion override until the terrain path passes review.

## Motion

The author preserves the reviewed cleave's native arm rotations and fixed two-handed grip.
It adds supported body compression and a new timing curve.
The feet retain their source positions while native leg IK lowers the pelvis by up to 126 mm.
The complete animation lasts 1.06 seconds.

The strike interval follows measured blade-tip arc length, from 0.34 to 0.60 seconds.
This removes the earlier double speed peak without doubling the maximum speed.
The damage marker occurs at 0.50 seconds.
The separate `groundCue` marker occurs at 0.60 seconds. The runtime does not implement this effect yet.
Recovery returns to the exact Ready pose.

## Reproduction

Use the reviewed native family and its 0.76-second paired cleave record:

```sh
node tools/ronin-candidates/author-slam.mjs \
  --input /tmp/ninja-root-ronin-family-v6.glb \
  --cleave-record /tmp/ninja-root-ronin-paired-v63.json \
  --output /tmp/ronin-slam.glb \
  --record /tmp/ronin-slam.json
```

The tool writes arc-length and source-time sidecars beside the motion record.
It rejects public model output and preserves the other 36 animation payloads.

The reviewed V2 output has these SHA-256 hashes:

| File | SHA-256 |
| --- | --- |
| Model | `311f9ff05369dd848e5777e0c02f9e6ee94dd9403590aa37a238924117a9a14e` |
| Motion record | `bfec3f091f287a5bcdf50db44e4d333c07a4ee02e505ac60acb5a0d442367910` |

## Source review

Claude Opus 5.5 at High accepted the sampled native poses and the measured timing correction.
That review did not certify continuous playback or terrain handling.
The independent dense source checks found:

- Peak blade-tip speed: 30.25 m/s. Speed at damage: 28.56 m/s.
- Minimum blade height on the source plane: 5.934 mm.
- No detected arm-hinge violations or skin crossings.
- Maximum wrist rotation: 13.898 degrees.
- Maximum planted-foot drift: 0.873 mm. Planted-toe drift: 0.089 mm.
- Exact Ready endpoints within numerical precision.

These measurements apply to the source animation, before runtime terrain changes.
Review images and detailed audit reports are retained in the ignored `artifacts/ronin-slam-v2/` folder.

## Open terrain defect

The actual controller clears flat ground by at least 6.527 mm.
On `y = 0.12x + 0.10z`, the blade penetrates the terrain by 364.6 mm.
The foot solver lowers the pelvis by about 119.8 mm on this slope.
Even without that lowering, the blade would penetrate by 244.8 mm.
The source strike plane therefore needs terrain adaptation before release.

This audit also exposed a separate foot jump when the controller returned to Ready.
The foot solver discarded the authored support's height and orientation before switching modes.
The runtime fix now carries those values into the procedural foot solver.
This removes that transition jump, but does not resolve the blade's terrain path.
