# Forest needle coverage and course verification

The former transparency cutoff removed much of the photographed needle coverage at middle distances.
The native fir became nearly bare before switching to its fuller distant image.
The new cutoff keeps those needles visible. Surface and shadow materials use the same value.
Three.js overrides the depth cutoff for antialiased foliage. The conifer depth shader now uses an explicit uniform instead.
This affects the three native conifer sources. Other foliage retains its previous cutoff.

The forest mix now uses more of the existing fir source.
Its foliage contains 33,753 triangles, compared with 209,250–345,915 for the pine sources.
The fir retains native branches to 100 metres, then transitions to its distant image through 104 metres.
The dense pines keep their previous distance limits.
Crane Coast retains both pines and broadleaf trees alongside the fir.
Highlands retains all three conifer forms. Desert and Neo-Tokyo mixes stay unchanged.
No models, textures, or downloads were added.

Separate comparisons checked the forest mix, transparency cutoff, and combined result.
The cutoff correction restored the needle silhouette. The combined views show fuller groves and clearer middle-distance branches.
Review captures cover the fairway and groves on both affected courses.

## Validation

The isolated Crane Coast test uses 64 attacking enemies, moving combat, Balanced settings, and a 1440×900 viewport.
Both runs used render ratio 1 on an Apple M1 Max.
The current build averaged 58.83 FPS, with a 16.7 ms 95th-percentile frame time.
The candidate averaged 57.67 FPS, with a 16.8 ms 95th-percentile frame time.
After the shadow correction, the installed build averaged 58.79 FPS, with a 16.7 ms 95th-percentile frame time.
The Highlands candidate averaged 58.83 FPS before that final shadow correction.
Twelve focused unit and asset checks pass. All three conifers pass native, middle, transition, and distant browser checks.
The browser also checks the effective surface and shadow cutoffs. It reports no shader or page errors.
The production build and its normal-input golf-to-combat check pass. The loaded JavaScript and CSS match the build.
These are individual local measurements, not a guarantee for other hardware.

## Complete Neo-Tokyo round

A fresh round as The Hustler completed all nine holes on commit 9047ad6.
Scores were 3, 1, 4, 3, 3, 2, 4, 3, and 2: 25 shots against par 36.
All recorded shots agree with the scorecard and saved next-hole index. No penalties or browser errors occurred.
The round included 16 combat passages, 2,420 defeats, nine walking routes, and two successful route recalculations.
No route failed. Tee, fairway, rough, and green surfaces were exercised.
This round did not exercise bunker shots or water penalties.

The driver used normal controller inputs and a planner that reads the course state.
It did not change the ball, player, health, scores, enemies, or game clock.
This establishes functional coverage. It does not estimate human difficulty or isolated frame rate.

The preceding controller deployment passed all 990 CI tests and the public normal-input check.
The public JavaScript and CSS matched the tested build.
All browser testing stayed muted.
