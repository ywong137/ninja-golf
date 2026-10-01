# Remaining golf and environment work

Initial review: 2026-09-27. That review used source inspection and existing rendered captures. Later sections record browser and GPU checks.

## Putting preview correction

The former preview applied green friction across all surfaces and continued through water. Lotus Crossing predicted 85.07m for a putt whose live rolling equations stopped after 10.70m in rough. The shot started at `(greenX, length-12)`, used full power, and aimed backward along the course.

`golf-roll.js` now shares surface sampling, resistance, slope response, hazards, cup capture, and stopping rules between preview and live play. Live ordering and constants remain unchanged. CPU checks cover fringe, sand, water, slope direction, cup speed, and near misses. `browser-putting-preview.mjs` compares predictions against actual game putts across nine cases and mixed frame durations. The test records actual traveled surfaces and slope signs. It requires three fairway-to-sand crossings, two water stops, both slope directions, a fringe stop, and cup capture. The muted Chrome Metal run passed all nine cases with zero endpoint difference. Actual paths crossed the expected surfaces. Uphill travel measured 4.092m; downhill travel measured 4.592m.

## Shot-height control

The player can choose low, normal, or high flight before a shot.
Z/X lowers or raises the choice; the gamepad uses D-pad down/up.
The three on-screen buttons show the same selection and its main tradeoff.
Keyboard activation of a focused height button does not also start a swing.

Low flight uses 65% of the club's normal loft and 86% of its carry.
High flight adds eight degrees of loft and uses 92% of normal carry.
The first dry-ground contact retains 12% more horizontal speed for low shots and 14% less for high shots.
Later bounces, sand resistance, and putting retain their existing rules.
Normal shots preserve the previous launch and landing behavior.
These values are game tuning, not measured launch-monitor data.

The carry label, aiming line, landing marker, and live ball share the selected profile.
Wind acts through the existing flight simulation; high shots spend longer in the air.
Changing height resets a charging power meter.
The choice locks when the swing begins and resets for putting and each new lie.
Selecting another airborne club keeps the choice, so players can compare clubs.
The compact desktop layout keeps the lie above the club controls.
Survey mode moves the swing panel beside the map, clearing the center of the aiming line.

PGA coach Jordan Thomas describes lower flight and an easier swing when playing into wind.
That informed the lower carry and flight-height tradeoff.
See [The Punch Shot is the Best Way to Fight Through the Wind](https://www.pga.com/story/the-punch-shot-is-the-best-way-to-fight-through-the-wind).
The game still uses simplified flight and landing equations.
This pass does not add aerodynamic spin simulation or separate swing animations for each height.

Validation covers all seven airborne clubs at all three heights.
All 21 actual first landings matched their previews with zero measured endpoint difference.
Driver, seven-iron, and sand-wedge cases also confirmed the expected apex and run ordering.
The existing putting cases passed across slopes, sand, water, fringe, and cup capture.
Keyboard, mouse, simulated gamepad, input locking, and five desktop layouts passed.
A muted Chrome Metal benchmark with 64 moving enemies averaged 51.9 FPS at 1440×900.
Its 95th-percentile frame took 33.4 ms; its 99th percentile took 50 ms.
These local measurements do not establish performance on every device.
Physical controller testing remains outstanding.

## Later passes

- Shot height now changes flight and landing behavior. Random dispersion still lacks explanatory feedback. The simulation still needs spin, aerodynamic drag, and the associated swing variations.
- The later [environment review](environment-variety-review.md) records the completed city, tree, terrain, and shadow changes. Close vegetation and regional landscape detail still need art work.
- The later [building review](building-collision-review.md) records completed collision for actors, cameras, projectiles, and golf balls. Interiors and stairs remain inaccessible.


## Latest rendered review

The full browser pass captured Kaede on the desert selection screen and Shinobi during Japanese-course combat.
The bodies read as people at these distances. Ground contact still has weak visual definition in selection.
Large foreground turf areas remain visually uniform. Distant hill contours and sparse city composition need further art work.
These screenshots do not establish photorealism or AAA character quality.
