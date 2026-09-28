# Native elbow correction during weapon carry

The old carry solver aimed the upper arm and forearm independently.
It reached the requested wrist position but could bend the elbow sideways.
The free running arm also retained this defect from its source animation.

The new solver maps the imported arm frame onto the requested elbow plane.
It applies flexion around the native hinge and keeps the carried wrist neutral.
The free arm follows its existing wrist path, with a corrected elbow frame.
Shoulder rotation stays within 68 degrees of the transported native reference.
The shoulder limit changes gradually during direction changes.

Native paired clips now retain their authored support-hand approach during a carry release.
The old secondary-hand solver no longer refits that released arm.
The weapon uses both palms only after the carry finishes.
Other secondary-grip paths retain their existing behavior.

Ethan's first light cut completes its carry release in 65 ms, before its fast chamber movement.
Its attack duration, hit timing, and authored poses are unchanged.
Other polearm clips retain their existing release timing.

## Independent review

Claude Opus 5.5 reviewed six candidate sheets and three baseline sheets at High effort.
The returned `modelUsage` confirmed `claude-opus-5-5`; no permission denials occurred.
The review found no blocking visible regression in the sampled carry poses.
It identified a repeated shoulder limit during entry and exit.
Applying the gradual limit twice moved the elbow again as the transition ended.

That diagnosis was confirmed with an isolated revision.
The primary carry solve now applies the gradual limit once.
Transition solves preserve that result and enforce only the hard anatomical limit.
The measured entry speed fell from 16.04 to 12.31 degrees per 1/120 second.
This is a bounded carry review, not approval of every animation or overall art quality.

## Validation

The anatomy regression samples both arms at 480 Hz for all six heroes.
It covers four fixed movement directions and one complete direction sweep.
The 30 cases contain 28,800 sampled poses.

| Measure | Maximum |
| --- | ---: |
| Native hinge deviation | 0.000124 degrees |
| Shoulder rotation | 67.626 degrees |
| Forearm twist | 56.602 degrees |
| Free wrist deviation from its imported neutral pose | 18.715 degrees |
| Entry rotation per 1/120 second | 12.31 degrees |
| Active rotation per 1/120 second, including the free arm | 13.52 degrees |

Held wrists remain at their imported neutral rotation after entry.
The existing transition suite passes all 90 cases at 60, 120, and 240 Hz.
Golf paths and attack contact paths match the controls exactly.
Weapon clearance checks cover running and sprinting against deformed leg surfaces.
The smallest measured handle-to-leg clearance is 15.9 mm; blades remain at least 234 mm away.

The final gameplay capture ran Ethan's actual first light attack at 59.49 FPS with 24–50 enemies.
It reported no browser errors. Audio stayed muted.
The recording verified the intended clip and included running in three directions.
The rendered transition test distinguishes exact weapon attachment from the authored paired-hand spacing residual.
The largest observed per-hand residual was 0.125 mm during Ethan’s early attack frames.

Reproduce the relevant checks with:

```sh
node tests/browser-carry-anatomy.mjs
node tests/browser-travel-transitions.mjs
node tools/audit-carry-clearance.mjs --check
SKIP_TRAVEL_CAPTURES=1 node tests/browser-travel-pose.mjs
```

The source gait and remaining attack clips still need further animation work.
The carry correction does not replace those clips or change character geometry.
