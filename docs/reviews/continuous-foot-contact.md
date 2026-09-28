# Continuous heel and toe support

A planted heel can rise while the toe continues to support the body.
The old runtime faded each contact interval separately.
At a shared boundary, both weights reached zero even though the foot never left the ground.

The runtime now joins overlapping or touching intervals before applying the contact fade.
It preserves real gaps, which describe an airborne foot.
It caches the combined schedule for each immutable motion record and leaves the source intervals unchanged.

The regression demonstrates the old error at both handover boundaries: support was zero and is now one.
It also checks overlapping intervals, unordered intervals, exact endpoints, and a real two-millisecond gap.

All six attack-foot tests pass, including native poses and downhill support across six bodies and four course slopes.
The real combat controller passes 18 production attack cases across all six heroes.
Maximum measured planted-foot drift is 0.568 mm; planted-toe drift is 1.325 mm.
All hit counts match, and manual movement remains available during attacks.
The production build passes. The existing large-bundle warning remains.

This correction changes contact weights. It does not change models, authored animation paths, or weapon timing.
The separate Ronin animation candidates remain outside the public game.
