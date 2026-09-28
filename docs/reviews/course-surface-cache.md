# Exact terrain lookup cache

Combat and golf foot placement now reuse the actual terrain triangle heights.
Each hole creates a fresh sampler. Replacing that sampler releases the previous hole's cache.

The cached and direct paths share subdivision selection and triangle interpolation.
The cache stores Float64 vertex heights and calculates each touched vertex once.
It preserves outside-course fallback and boundary extrapolation.

## Verification

- 703,914 points across all 36 holes match the direct path exactly.
- The largest change from the previous arithmetic is 7.99e-14 metres.
- Independent rendered-triangle checks pass within 50 micrometres, accounting for Float32 mesh storage.
- Browser checks cover another 120,000 points across slopes, shorelines, and bunkers.
- The actual game passes combat, address, swing, and ball-flight foot-placement checks.
- The production build passes.

In isolated Chrome, 100,000 nearby queries take 6.3–7.2 ms with a warm cache.
Direct queries take 268–368 ms in the same benchmark.
These are query timings, not whole-game frame rates.
The first 1,000 queries with a new sampler take 0.2–0.4 ms.

The tested local patches allocate 2.05–3.97 KB of typed-array storage, plus object overhead.
The cache grows only for visited cells and resets with each hole.
Its conservative full-course storage bound is 16.98–31.86 MB if every cell used the maximum subdivision.
Actual distant cells use fewer subdivisions.

The sampler assumes that course geometry and height callbacks remain unchanged during its lifetime.
Create a new sampler after a course edit.
The ignored benchmark artifacts retain the measured samples and reproduction script.
