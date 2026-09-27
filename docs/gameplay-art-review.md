# Remaining golf and environment work

Review date: 2026-09-27. This review used source inspection and existing rendered captures. It did not start a browser or GPU job.

## Putting preview correction

The former preview applied green friction across all surfaces and continued through water. Lotus Crossing predicted 85.07m for a putt whose live rolling equations stopped after 10.70m in rough. The shot started at `(greenX, length-12)`, used full power, and aimed backward along the course.

`golf-roll.js` now shares surface sampling, resistance, slope response, hazards, cup capture, and stopping rules between preview and live play. Live ordering and constants remain unchanged. CPU checks cover fringe, sand, water, slope direction, cup speed, and near misses. `browser-putting-preview.mjs` compares predictions against actual game putts across nine cases and mixed frame durations. The test records actual traveled surfaces and slope signs. It requires three fairway-to-sand crossings, two water stops, both slope directions, a fringe stop, and cup capture. The muted Chrome Metal run passed all nine cases with zero endpoint difference. Actual paths crossed the expected surfaces. Uphill travel measured 4.092m; downhill travel measured 4.592m.

## Later passes

- Shot controls expose direction and power. The launch function accepts a shape argument, but controls never supply it. Consider high/low shot selection with clear carry and roll feedback. Random dispersion also lacks explanatory feedback.
- The cyber course repeats five similar towers at the same route offset. The existing `/tmp/ninja-terrain-3-aerial.png` shows blank upper floors and a regular row of isolated towers. Vary tower silhouettes, heights, setbacks, and building clusters. Verify from both travel and survey cameras.
- Building bounds currently guide scenery placement only. SceneryCollision reads ambush sites, so solid building bodies do not obstruct travel. Add building collision separately from enemy hiding sites. Verify sliding, camera movement, and safe routes.


## Latest rendered review

The full browser pass captured Kaede on the desert selection screen and Shinobi during Japanese-course combat.
The bodies read as people at these distances. Ground contact still has weak visual definition in selection.
Large foreground turf areas remain visually uniform. Distant hill contours and sparse city composition need further art work.
These screenshots do not establish photorealism or AAA character quality.
