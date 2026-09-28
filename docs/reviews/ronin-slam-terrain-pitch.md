# Ronin finisher: bounded terrain correction

The offline finisher now has a tested correction for the sampled slopes.
This is a geometry and posture study. It is not installed in the game.

The unchanged candidate blade penetrates uphill terrain after the foot solver lowers the pelvis.
The correction pitches the upper body around `spine_02`, above the leg branch.
Its world axis is the actor's forward direction crossed with world up.
The torso, head, arms, hands, and sword rotate together. The pelvis and legs retain their terrain pose.

The study finds one minimum sufficient angle for each complete attack.
It fades that angle in during 0–0.20 seconds and out during 0.78–1.06 seconds.
It applies no correction when the original blade path already clears the terrain.

| Terrain plane | Heading | Pitch |
| --- | ---: | ---: |
| y = 0.12x + 0.10z | 0° | 11.130° |
| y = 0.12x + 0.10z | 90° | 11.020° |
| y = −0.12x + 0.10z | 0° | 9.508° |
| y = −0.12x + 0.10z | −90° | 12.367° |
| Other four tested downhill headings | Various | 0° |

## Checks

The trajectory study covers 6,132 samples at 480 Hz, including flat cases and both transition fades.
All sampled blade points clear the terrain by at least 6 mm.
The unchanged downhill cases retain 81.8–178.0 mm of clearance.

The actual-bone study covers eight slope/heading combinations and 2,056 samples at 240 Hz.
It applies the rotation to the real bones after foot placement, then updates the weapon attachment.

- No blade/body crossings occur. Blade/leg clearance reaches the 30 mm query cap in every sample.
- The correction leaves the wrists, pelvis, and legs unchanged.
- The paired palm gap stays below 0.060 mm.
- No waist triangles flip. Waist edge ratios remain within 0.8502–1.1612.
- Minimum actual blade/ground clearance is 5.999816 mm, within numerical error of the 6 mm target.

An earlier proposal combined terrain-normal tilt with extra pitch.
It changed downhill poses unnecessarily and stretched waist edges by up to 21.2%.
The pitch-only version reduces maximum edge stretch to 16.1% and removes that downhill change.

Claude Opus 5.5 at High accepted the pictured pitch-only posture, including the worst tested 12.367° case.
It found stable support, a small remaining forward lean, and no added shoulder shrug or sideways tilt.
Its verdict covers sampled posture. It does not certify motion timing or skin geometry from still images.

## Remaining integration work

The exported source probes now reproduce the actual browser rig at all 60 sample times.
`export-slam-probes.mjs` retains both foot support points and 110 blade hull vertices.
The hull preserves planar extrema. It does not certify blade clearance on curved ground.
`check-slam-terrain.mjs` checks the candidate planner against the independent dense plane measurements.

An independent browser audit checked 48 stationary cases on actual course terrain.
It sampled 6,960 poses and all 245 distinct blade mesh vertices.
Minimum blade clearance was 6.00272 mm. Paired palm gaps stayed below 0.060 mm.
The maximum planner disagreement was 0.000367 mm.

The steepest course case required 22.87 degrees of torso pitch.
Opus rejected the pictured 22.87-degree and 16.43-degree poses: the torso leaned back and the chin rose.
The larger rotations therefore remain unacceptable despite their geometric clearance.
A next study must raise the paired arms about the shoulder axis while retaining forward body intent.
It must check shoulder deformation and use an authored alternative where a ground slam cannot remain plausible.

Twelve constant-speed moving diagnostics retained at least 30.39 mm of clearance.
Those results do not validate movement support: the walking layer raised the body and masked stale plans.
Removing its translation exposed an 11.69 mm intersection after 126 mm of travel in one case.
Unfiltered replanning also changed the applied pitch by up to 2.394 degrees between updates.
Recovery still planned against a low-cut time that had already passed.
The current planner therefore remains an offline stationary candidate.

The study chooses angles from the complete trajectory on known terrain planes.
A runtime planner must account for movement, changing heading, and uneven ground without adding visible pauses.
The correction still needs continuous visual playback review through its entry and recovery fades.
The proposed ground effect also needs to respect the actual blade distance from the terrain.

The ignored `artifacts/ronin-slam-v2/` folder retains the comparison image, measured trajectories, bone checks, and Opus review.
The candidate model and author remain unchanged by this study.
