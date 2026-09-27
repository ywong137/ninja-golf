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

Final browser limits are 12 mm support error, 5 mm penetration, and 20 mm golf sole gap. The measured maxima were 10.0 mm, 2.5 mm, and 15.6 mm. Recovery-foot correction stayed zero when those feet cleared the terrain. Golf club-position error stayed zero.

The test measures world-space support continuity separately from the vertical correction. A large correction change can be necessary when the root climbs a steep lip. Maximum world-space ankle movement during consecutive support frames was 16.4 mm. Pelvis correction changes stay within 35 mm per frame at 60 Hz.

`tests/browser-foot-main.mjs` exercises the real combat, address, swing, and flight update paths. It verifies the callback against the rendered triangle sampler and captures a running sequence across a bunker lip.
