# Rock collision and continuous musou effects

Large scanned rocks had no solid movement bounds. Smaller cover rocks used guessed radii that could lie inside the visible surface.

Every coastal rock, desert rock, and sea cliff now registers its rendered bounds and transform. Walking, running, dodging, and captured attack travel use these bounds. The existing swept movement solver slides along their sides.

The combat camera now searches for a clear side or elevated view when an obstruction brings it too close. Its normal target and the accepted musou introduction remain unchanged. Obstructed ball positions also receive a drop with space for the golf stance.

Musou attacks retain red fire, three rising energy streaks, and a ground glow throughout their action. The effect follows root movement between strikes. Moving blades leave continuous red trails. The aura fades within 0.2 seconds after completion and clears immediately when leaving combat.

The aura uses three fixed draws and 28 flame instances. It creates no per-frame meshes or lights. Reduced-motion mode slows its swirl.

## Checks

- 55 focused unit checks passed, including actual scan bounds at both LODs, rotated fast sweeps, corner sliding, camera clearance, and ball relief.
- Browser checks covered the first hole of all four courses: 58, 71, 173, and 50 registered rock obstacles.
- Keyboard movement and dodges produced no body-collider intersections. The closest camera distances during rock orbits were 2.68, 3.72, 2.64, and 5.72 metres.
- The aura stayed active between impacts, followed the actor, and cleared after completion. Browser errors: zero.
- A real-time 28-enemy musou sample at 1440×900 averaged 41.5 FPS on this Mac. This is one sample, not a frame-rate guarantee.
- All browser audio remained muted.

Reproduce the focused browser check with `node tests/browser-rock-musou.mjs`. Set `NINJA_BASE_URL` and `REVIEW_OUTPUT` as needed.
