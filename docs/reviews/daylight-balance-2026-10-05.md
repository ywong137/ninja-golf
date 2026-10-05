# Daylight balance — October 5, 2026

## Change

The daytime scenes had too much unshadowed sky and hemisphere light.
That fill reduced the visible shape of trees, rocks, and clothing.
The revised balance increases direct sunlight and reduces fill across the three daytime themes.
Neo-Tokyo retains its existing night lighting.

Each theme now stores its environment intensity with its other lighting values.
The photographic sky, sun direction, fog, exposure, materials, and shadow maps remain unchanged.
This change adds no rendering passes, geometry, textures, or asset downloads.

## Measurement

The probe renders a rough neutral surface through the actual Three.js material shader.
It measures each light source separately in a floating-point target, before tone mapping.
The table reports relative contributions. It does not claim calibrated physical exposure.

| Theme | Direct sunlight before | Direct sunlight after | Remaining fill after |
| --- | ---: | ---: | ---: |
| Crane Coast | 37.0% | 66.8% | 33.2% |
| Heather & Crown | 35.0% | 54.9% | 45.1% |
| Copper Saguaro | 42.2% | 73.3% | 26.7% |
| Neo-Tokyo | 47.7% | 47.7% | 52.3% |

Six character selections remain readable with the revised daylight.
Sixteen environment views cover the four course styles, including aerial views, tees, rough, and paths.
The final views use the implemented source settings without browser overrides.
The musou check verifies all six angry face textures and the three quality settings across four lighting themes.
Its four theme screenshots retain one course geometry so the lighting comparison stays controlled.

The lighting test confirms that the rendered sky sun matches the directional sun within 0.008 pixels.
Water uses the same sun direction. Backlit leaf transmission still respects an occluding shadow.
Three shadow checks pass for near detail, coverage, and cloning.

The build succeeds. Vite still reports the existing large bundle warning.
All game browsers run muted.

## Performance and private build

Four moving fights keep 24 enemies alive while the Ronin repeats heavy attacks.
Chrome uses Metal on the local Apple M1 Max at 1440 × 900 and a fixed rendering ratio of 1.0.
Each sample measures eight seconds after two seconds of warmup.
No other automated GPU job ran during these samples.

| Course | Average FPS | 95th-percentile frame time |
| --- | ---: | ---: |
| Crane Coast | 41.0 | 33.4 ms |
| Heather & Crown | 56.6 | 33.3 ms |
| Copper Saguaro | 57.1 | 33.3 ms |
| Neo-Tokyo | 51.1 | 33.4 ms |

These short samples meet the local average frame-rate target. They do not establish performance on other devices.
The longest measured frame took 83.3 ms. Movement and streaming can still produce occasional delays.
The balance change adds no work per frame; these results do not prove a speed increase.

The production check passes selection, all four course previews, a golf shot, running, and combat through normal input.
Ethan uses `Ethan_GDH_Combo5_Review` for the observed heavy attack.
The three turf maps return successfully and decode at 2048 × 2048.
The final browser checks report no errors.

Private preview: `http://127.0.0.1:4185/`.
Production bundle: `index-Dgmpk3Uc.js`.
Performance evidence: `performance-after/performance.json`.
Built-game evidence: `production/report.json` and `production/combat.png`.

## Evidence

Local evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/daylight-balance/`.

- `light-contributions.json` and `light-contributions-after.json`: measured light components.
- `characters/`: six selection captures with candidate settings, now installed unchanged.
- `final/`: implemented environment settings, without overrides.
- `musou/`: rendered face texture comparisons and restoration checks.
- `lighting-test.log` and `shadow-test.log`: focused lighting checks.

The initial selection capture used the home overlay by mistake.
The corrected capture explicitly opens the selection interface.
The corrected probe applies each theme before measuring its lights.

## Limits

This pass improves light and shade. It does not make the scene photorealistic.
Sparse planting, repeated scenery, simplified architecture, and some close character details remain visible.
Preserve the accepted controls, motions, and approved Ronin and Closer identities during further work.
The complete build remains local and private, including Ethan's purchased polearm motions.
