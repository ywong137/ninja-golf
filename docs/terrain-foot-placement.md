# Terrain foot placement

`Warrior.update` accepts `groundHeight(x, z)`. Main supplies the height of the visible terrain triangles. Physics still controls the actor root.

The runtime helper corrects the hero's legs after animation blending. It restores those corrections before the next mixer update. Each native rig supplies its own limb lengths, knee direction, ankle clearance, and toe position. No character asset needs another bake.

The helper samples heel and toe contacts. It aligns the sole with the local slope and solves each leg with two-bone IK. It lowers the pelvis when a supporting leg needs more reach. Golf uses only leg corrections, so the pelvis, hands, and club path stay unchanged.

Running and guard steps supply their authored support phases. Recovery feet retain their source arcs. The helper raises a recovery foot only when the terrain would intersect its sole. Rolls, jumps, deaths, selection poses, and airborne Musou phases bypass correction.

Corrections have fixed bounds:

- Ankle height: 32 cm in either direction.
- Pelvis lowering: 20 cm.
- Sole slope: about 32 degrees.
- Additional downhill toe support: about 24 degrees.
- Leg reach: at most 98.5% of the native segment sum.

The course audit uses real bunker lips in all four themes. Their sampled elevation changes reach 27–39 cm across 60 cm. The CPU tests cover all six native humans, preserve segment lengths within 10 micrometres, and verify unchanged golf hand positions. The browser test also checks motion transitions, recovery, grounded attacks, and golf follow-through.

Final browser limits are 12 mm support error, 5 mm penetration, and 20 mm golf sole gap. After the running revision, measured maxima were 5.5 mm, 2.4 mm, and 16.2 mm. Recovery-foot correction stayed zero when those feet cleared the terrain. Golf club-position error stayed zero.

The test measures world-space support continuity separately from the vertical correction. A large correction change can be necessary when the root climbs a steep lip. Maximum world-space ankle movement during consecutive support frames was 1.1 mm. The maximum pelvis correction change was 16.2 mm at 60 Hz.

`tests/browser-foot-main.mjs` exercises the real combat, address, swing, and flight update paths. It verifies the callback against the rendered triangle sampler and captures a running sequence across a bunker lip.


The running revision exposed a reach delay on a downhill stance. It produced a 43.4 mm ankle step in the Shinobi cyber-course test.
The earlier solver also constrained airborne feet against ground height, then stopped that constraint above 25 cm.
The solver now uses each foot's actual target. Four nearby terrain samples prepare the body before a downhill foot loads.
These samples stay independent of the running phase. They add no new rendering work.
The preferred pelvis movement remains smooth, but the current reach ceiling takes precedence over that smoothing.
The 20 cm pelvis bound remains. Golf still changes only the legs.
All 24 hero-and-theme combinations pass the original contact and continuity thresholds after this correction.

Set `FOOT_HERO=1 FOOT_THEME=3 SKIP_FOOT_CAPTURES=1` to isolate the original failure.
The report includes the worst support step and pelvis step, with their frame numbers.
