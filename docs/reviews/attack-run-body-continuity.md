# Preserve the body when an attack returns to running

Moving attacks adjust the pelvis position even when their pelvic rotation weight is zero.
The return to running previously captured only the feet for those attacks.
That omitted the outgoing body pose and exposed the incoming run height immediately.

The transition now captures the body whenever it captures the outgoing moving-attack pose.
The existing run crossfade then carries the pelvis and torso with the feet.
Terrain correction remains outside the captured pose, so the next frame applies it once.

The browser regression now measures vertical pelvis speed during the first 80 milliseconds of the transition.
It covers all six characters, light and heavy attacks, four travel directions, and three slopes at 40 and 120 Hz.
All 288 cases pass. The largest measured entry speed is 0.527 metres per second.
The preceding behavior fails the new assertion.

The same checks retain their existing joint, foot-speed, terrain, and knee-clearance limits.
The production build succeeds, with the existing large-bundle warning.

This change does not complete the separate experimental run-to-attack braking planner.
That planner still slides the feet during its final handoff and remains outside the published roster.
