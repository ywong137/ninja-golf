# Ground shadows — October 5, 2026

The course now assigns more shadow detail to nearby characters and objects.
The approved characters, animation, controls, terrain geometry, and photographic textures remain unchanged.
This is a limited lighting improvement. The game still falls below the requested AAA visual standard.

## Cause and change

A fixed Ronin check initially looked as though his feet floated above the fairway.
Skinned shoe measurements and terrain raycasts showed contact within three millimetres.
Changing the character's leg pose would not address this rendering problem.

The original first shadow cascade covered about 75 metres from the camera.
Its texels covered about 7.2 centimetres on the measured projection.
The eight-centimetre normal offset and broad filter further weakened small contact shadows.

`CourseSunShadow` retains the installed Three.js cascade-fitting method and changes its split policy.
The first cascade now covers about 24 metres, with 2.2-centimetre texels on the same projection.
The second cascade still reaches 280 metres. Both share an overlap for the transition.
The atlas remains 4096 × 2048, with two 2048 × 2048 cascades.

The normal offset is now 1.5 centimetres. The filter radius is 1.5 texels.
The depth offset is −0.00002. Four course comparisons show clearer shoes, weapons, and scenery shadows.
No extra render pass or shadow map was added.

The fitter derives from Three.js 0.186.1 under its MIT license.
Its retained internal interfaces need review when upgrading Three.js.
The license is in `docs/licenses/three-sun-shadow-MIT.txt`.

## Verification

Three focused tests pass:

- Nearby shadow resolution improves without a larger atlas.
- Both cascades cover ground, aerial, translated, and offset portrait projections.
- A cloned sunlight retains the course fitting method.

The rendered course-shadow check also passes.
It measures a real caster from camera heights of 20, 90, 200, and 250 metres.
Translated and portrait cameras pass too. Measured shadow brightness remains about 32% of adjacent lit ground.
Canopy transitions and four course landmarks show no browser errors.

Eight fixed character/course views cover all four themes.
The near terrain already contains photographic grass detail, so this pass does not add another grass layer.
Tests use muted Chrome with Metal at 1440 × 900 on the local Apple M1 Max.

| Hero | Enemies | Average FPS | Render ratio | 95th-percentile frame time |
| --- | ---: | ---: | ---: | ---: |
| Ronin | 24 | 49.0 | 1.00 | 33.4 ms |
| Vice President | 24 | 56.4 | 0.85 | 33.3 ms |
| Hustler | 24 | 56.2 | 0.75 | 33.3 ms |
| Closer | 24 | 53.2 | 0.85 | 33.3 ms |

Each encounter measures eight seconds after three seconds of warmup.
Balanced mode adjusts resolution. These local results do not establish performance on other devices.

The production build and normal-input gameplay check pass without browser errors.
The check covers character selection, a drive, landing, Ethan’s three light attacks, a heavy attack, and running recovery.
The served bundle is `assets/index-NtnnPRdm.js`. Ethan’s 44-clip model matches the release source hash.
The build remains local because its existing parent revisions include purchased Ethan motions.

## Evidence

The primary checkout contains `artifacts/reviews/ground-contact/`:

- `contact-metrics.json` and `diagnostic.json`: shoe contact and actual terrain intersections.
- `settled-*-hero-before.png` and `after-*-hero-current.png`: fixed comparisons.
- `after-study.json`: four-theme capture settings and browser errors.
- `cascade-check/report.json`: rendered sunlight and canopy measurements.
- `performance.json`: four crowded encounters.
- `production.json`: exact bundle, downloaded Ethan asset, and normal-input gameplay results.

The intermediate light-fill study produced little useful improvement. Its settings were not adopted.
