# Production quality targets

Reference: Dan Greenheck's [prompt thread](https://x.com/dangreenheck/status/2102911556296052788), [demonstration](https://x.com/dangreenheck/status/2102878170089169235), and [Tidewater source](https://github.com/dgreenheck/tidewater).

The reference asks for repeated, multi-view inspection, believable materials and motion, environmental life, coherent effects, and steady performance. Its ocean features are examples of that standard. Ninja Golf must apply that standard to golf and crowd combat.

## Acceptance gates

- Art: natural tree crowns and branches, varied ground coverage, readable grass cuts, grounded buildings, weathered surfaces, reflective water, coherent daylight.
- Characters: visible faces, correct blade silhouettes, stable grips, grounded feet, coordinated core movement, distinct enemy silhouettes.
- Golf: clear shot planning, useful putting information, controlled swing timing, readable ball flight, informative shot results.
- Combat: readable threats, spacing around the player, impact feedback, distinct enemy counters, reliable movement and camera controls.
- Presentation: legible HUD at 1280×720 and 1440×900, unobstructed hero selection, smooth transitions, useful settings and tutorials.
- Audio: licensed recordings for environment and movement, clear attack feedback, controlled music transitions, silent automated testing.
- Performance: target at least 40–50 FPS during dense combat on the current M1 Max. Measure resolution and graphics settings explicitly.
- Stability: complete all 36 holes across four nine-hole courses, revisit menus, change characters, pause/resume, mute/unmute, and recover saved progress without errors.

## Inspection procedure

Capture title, selection, tee, fairway, tree interior, shoreline, green, melee crowd, heavy attack, Musou, and scorecard views. Inspect still frames and movement. Check GPU cost after each major rendering change. Preserve before/after screenshots outside the shipping build.

## Status

Baseline: 94baeb3. Active combat averaged 46 FPS at 1440×900, Balanced, DPR 1, with 64 enemies. Main visual shortcomings: sparse angular crowns, flat water, coarse course boundaries, plain architecture, repetitive cloth folds, and weak material variation. Gameplay shortcomings: crowd compression, limited shot planning, weak impact response, and little encounter pacing.

## Implemented production pass

- Four tree assets with bark maps, leaf cards, wind, and eight-angle distant views. Dithered transitions reduce visible changes between tree representations.
- Analytic fairway cuts, collars, sand edges, and mowing stripes. Denser geometry follows shorelines, bunkers, and greens.
- Reflected pond scenery, layered ripples, Fresnel response, depth color, and shoreline foam. Inland hollows no longer expose the ocean plane.
- Curved temple roofs, roof tile detail, lattice panels, galleries, rafters, stone stairs, and a curved torii. Temple placement avoids the pond and trees.
- Grounded garden props, shoreline rocks, wind-blown grass, and coastal birds.
- Smoother hero faces, less repetitive sleeve folds, slimmer scout clothing, fitted hat details, and material variation on cloth, leather, and metal.
- Limited simultaneous enemy attacks, approach spacing, directional ground warnings, blade ribbons, impact pauses, guard-break feedback, and rewarded dodges.
- Aerial shot survey, wind-aware landing estimates, putting slope markers, shot results, and an unobstructed swing view.
- Recorded environmental and movement sounds. Cross-tab audio ownership prevents a second delayed soundtrack.
- Camera collision, adjustable sensitivity, inverted vertical look, reduced camera effects, and adaptive resolution in Balanced mode.
- Shipping 2K textures retain their dimensions with optimized JPEG encoding. This removes about 9.7 MB of downloads.

The underlying human art remains derived from the Quaternius base. Facial expression and cloth simulation remain simpler than current AAA character systems. The golf simulation does not model every aerodynamic or turf interaction. These limits should remain explicit when describing this release.

## Previous release verification

Chrome on Apple M1 Max, Metal renderer, Balanced settings, 1440×900 CSS pixels. Each performance run holds 64 active enemies and repeatedly attacks for ten seconds after warmup. These are local measurements, not guarantees for other devices.

| Display | Rendering ratio | Average FPS | 95th-percentile frame time |
|---|---:|---:|---:|
| Standard display | 1.0 | 46.7 | 33.4 ms |
| Retina display, DPR 2 | 1.2 after adaptation | 47.6 | 33.4 ms |

The standard-display runs varied from 46.7 to 49.8 FPS with different crowd and attack timings. The HUD keeps the display's full resolution.

- All 30 unit and asset checks pass.
- The complete browser suite passes: audio transitions, duplicate-tab audio, navigation, combat, golf, penalties, revival, saved progress, and three-hole completion.
- Character checks verify blade silhouettes, rigs, clip coverage, hand grips, and golf contact.
- Visual checks cover title, three character selections, tee, aerial survey, putting, pond, temple, forest, and combat.
- Both 1280×720 and 1440×900 layouts pass. Shader compilation produces no browser errors.
- The production build and whitespace checks pass.

Reproduce with `npm test`, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, and `npm run build`.
Run performance checks with `PLAYWRIGHT_CHANNEL=chrome node tools/benchmark.mjs`, then repeat with `--retina`.
Run the public gameplay smoke check with `GAME_URL=https://ywong137.github.io/ninja-golf/ PLAYWRIGHT_CHANNEL=chrome node tests/browser-smoke.mjs`.
All automated browser runs mute system audio.


## Four-course expansion

The game now has four original nine-hole courses and six heroes. Each course has its own scenery, architecture, lighting, and preview.
Fairway decorations supply visible ambush cover without occupying the central landing corridor.
The title selects a random course. The selection flow chooses a hero before a course.

The three female heroes have independent fan, ring, and sickle weapon families.
They have separate ready stances, eight fast/heavy attacks, and six-cut Musou sequences.
The roster study uses official Samurai Warriors 4 and 5 artwork and descriptions.
The designs and animations remain original adaptations of the shared base rigs.

Grip checks now compare each handle against the actual curled finger joints.
All six heroes have separate faces, hair, and costume shapes.
Combat motion uses stepping turns, coupled pelvis/chest motion, and forward knee flexion.
The longer Musou intro lasts 2.85 seconds, followed by a 3.3-second attack.
Its damage sectors use the headings from the actual animation family.

Enemy damage is half the previous release. Most grunts pause before committing to an attack.
Enemies carry smaller blades and polearms. Musou defeats launch and tumble enemies before the ground impact.
The survey camera supports mouse pan, orbit, and zoom without changing shot aim.
Saved progress includes the selected course, hero, nine-hole scores, and penalty counts.


### Expansion verification

- All 45 unit and asset checks pass.
- Browser checks cover audio, navigation, combat, all 36 cups, penalties, revival, saves, survey controls, and course selection.
- Character checks cover 385 physical hand-grip samples and 100 Musou knee samples for each hero.
- Maximum handle-to-finger-cavity distance is 1.72 cm. Maximum supporting-foot drift during Musou is 1.55 cm.
- Both 1440×900 and 1280×720 layouts pass. Preview lighting keeps faces readable on the night course.
- The production build and whitespace checks pass.

The first dense-crowd measurements missed the target. Profiling found repeated skeleton matrix work and a costly crowd shading pass.
Hand updates now use only the required ancestor chains and cached transforms.
Balanced mode suspends GTAO above 32 enemies and restores it below 24. Dynamic shadows remain active.
High quality retains GTAO. Golf and character selection retain the full contact shading.

Final local measurements use Chrome, Metal, Apple M1 Max, Balanced, 64 active enemies, and repeated attacks.
Each run measures ten seconds after warmup. Other applications were also active.

| Course / display | CSS size | Rendering ratio | Average FPS | 95th-percentile frame time |
| --- | --- | ---: | ---: | ---: |
| Crane Coast | 1440×900 | 1.00 | 51.8 | 33.4 ms |
| Heather & Crown | 1440×900 | 1.00 | 54.9 | 33.3 ms |
| Copper Saguaro | 1440×900 | 1.00 | 58.5 | 16.8 ms |
| Neo-Tokyo After Dark | 1440×900 | 1.00 | 58.5 | 16.8 ms |
| Crane Coast, Retina DPR 2 | 1440×900 | 1.05 after adaptation | 46.8 | 33.4 ms |

These results describe this machine and these scenarios. The assets remain stylized and do not match modern photorealistic AAA character art.
