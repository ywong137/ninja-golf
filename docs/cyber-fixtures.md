# Cyber course fixtures

The perimeter now uses 1.55 m course-light bollards. Fairway ambush sites use wider 1.50 m service-light cabinets. Both preserve the existing placement coordinates and site identities.

Each fixture has a chamfered steel shell, recessed front and rear diffusers, protective louvers, service vents, a base plate, and four fasteners. Diffusers use restrained emissive material. Fixtures add no scene lights.

`queueCyberFixture(root, {x, y, z, kind, yaw})` appends static geometry. `kind` is `bollard` or `cover`. `flushCyberFixtures(root)` merges all fixtures on that root into three material batches. Repeated flushes replace and dispose the old geometry. A cleared root gets fresh batches.

Published bounds in `CYBER_FIXTURES` include all panels and hardware. The plinth extends 5 cm below the supplied ground height. Collision radii enclose the full geometry at any yaw. Site heights match the visible tops.

Run `node --test tests/cyber-fixtures.test.js` for bounds, collision, batching, disposal, and reload checks. Visual acceptance also requires an actual gameplay capture beside a visible hero.

Root accepted the actual gameplay view in `/tmp/ninja-environment-current/3-edge.png`. The visible hero confirms sensible scale. The frame, diffuser, and vent details remain readable. All twelve environment capture views passed runtime checks. The first hole's perimeter fixtures use 13,440 triangles across three material batches.
