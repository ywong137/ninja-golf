# Ninja Golf!

A peaceful round. An unreasonable number of ninjas.

Ninja Golf is a browser game built with Three.js. Choose one of six warriors and four original nine-hole courses, then fight your way to each shot.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL that Vite prints. The game requires WebGL 2 and hardware acceleration. A desktop browser works best.

```sh
npm test
npm run build
npm run preview
```

The production build lives in `dist/`. All game assets and music ship with the build. No game service or account is required.

## Play

| Action | Keyboard / mouse | Standard gamepad |
| --- | --- | --- |
| Aim | A / D or left / right arrows | Left stick |
| Survey shot | R or survey button | Y during golf |
| Pan / orbit / zoom in survey | Drag / right-drag / wheel | Left stick / right stick / triggers |
| Change club | Q / E or club buttons | LB / RB |
| Start swing, then strike | Space or swing button | A |
| Speed up ball tracking | Space | A |
| Move | W A S D or arrows | Left stick |
| Look during combat | Mouse movement; click course to capture | Right stick |
| Fast attack | Left mouse button | X or RT |
| Heavy attack / combo finisher | Right mouse button | Y |
| Musou | F, with full Resolve | RB during combat |
| Focused strafe / backpedal | Hold C | Hold LT |
| Sprint / dodge | Hold / tap Shift | Hold / tap B |
| Face the ball waypoint | Q | — |
| Address the ball | E, near the ball with no nearby enemies | A |
| Pause | Escape | Start |

The power meter repeats. Press the swing button again at the desired power. Carry scales with the square of power.

Choose among eight clubs. Read the lie, wind, elevation, target arc, and course map. The landing preview includes wind and terrain. Survey mode initially fits the full planned shot. Drag to explore the course, orbit with the right mouse button, and scroll to zoom. Putting grids show slope, with moving dots pointing downhill. Shot results report distance and the next lie. Rough reduces carry. The sand wedge works best in bunkers. Use the putter on greens.

After a long shot, walk to the ball and fight the attackers. Movement follows the camera. The warrior faces the movement direction. Attacks hold that facing through the strike. Q turns the camera toward the ball without moving you. The combat radar shows nearby enemies and the ball waypoint. Attacks hit several enemies. Defeats build Resolve and restore a little health. Chain fast attacks, then add a heavy attack for different finishers. Musou starts with a screen slash and a 2.85-second face close-up. A six-cut sequence then launches enemies through sparks and shock waves. Hold the focused stance to move independently of facing. Enemies flank and intercept. Three melee attackers and one ranged attacker can commit at once. Grunts often hold a ready stance before attacking. Enemy damage is half the previous release. Ground warnings show committed attacks. Heavy cuts break guards, and a well-timed dodge earns Resolve. Blade ribbons, sparks, and brief impact pauses reinforce contact. They emerge from lanterns, pagodas, rocks, trees, sand, and water.

Water and out-of-bounds shots return to the previous lie and add one penalty stroke. Defeat revives the warrior and adds one penalty stroke. Short shots and putts do not start a new battle.

The game saves completed holes in local browser storage. The title screen offers to continue an unfinished round on the correct course after a reload. Scorecards identify included penalty strokes. It does not save mid-hole progress.

## Course and characters

Choose a warrior, then select a course from four scenic in-game previews. The title shows a random course. Each course has nine original holes and par 36.

| Course | Setting |
| --- | --- |
| Crane Coast | Japanese coastal gardens, scanned trees, temples, and water carries |
| Heather & Crown | Scottish links, woodland, scanned cliffs, ruins, and exposed approaches |
| Copper Saguaro | Desert resort, sculptural trees, scanned boulders, and elevated greens |
| Neo-Tokyo After Dark | Photographic night skyline, neon towers, island constellations, and spiral fairways |

All 36 holes use individually authored routes. Doglegs, split fairways, landing islands, switchbacks, and island greens change the shot strategy. Dry bridges connect routes across water. Both maps show the same fairways, islands, and bridges as the terrain. Displayed hole yardage follows the planned route; distance to the pin stays direct. [Course design notes](docs/course-design.md) describe the layouts and official references.

The Ronin favors power, the Shinobi favors speed and accuracy, and the Monk favors health and reach.
Kaede uses a bladed fan for close, broad cuts and forceful gust finishers. Ayame carries a crescent ring for wider circular cuts and turning entries. Sora uses a hooked sickle to pull enemies into rising attacks. Each has a separate stance, four fast attacks, four heavy finishers, and a Musou sequence. [SW4/5 roster research](docs/warrior-roster-reference.md) records the art and character references.
Each warrior has a distinct face, hair, costume, and body shape. Enemies use smaller conventional blades and polearms.

## Graphics and scope

This release uses skinned human characters with 65-bone skeletons, fitted samurai costumes, and blended walking, running, sword, roll, and death animations. Golf swings use a separate baked two-hand animation. The ball launches at the swing contact time.

The environment uses scanned grass, sand, bark, rock, and pine textures, plus a photographic HDR sky and reflections. Terrain, trees, rocks, and buildings remain generated geometry. Nearby trees retain branches and leaf cards, with wind deformation. Distant trees use eight baked viewing angles and a dithered transition. Grass uses instancing and fades smoothly at distance. Ponds reflect the scene, with ripples and shoreline foam. The architecture uses curved tiled roofs, galleries, lattice panels, and stone foundations. Weapon fittings and blade faces use three draw calls per blade. At most 64 enemies remain active at once. Waves can produce hundreds of enemies over a round.

This is a playable browser release, with further art work needed for the requested photorealistic standard. It does not yet match a current AAA golf simulator. It uses simplified golf physics. It includes simplified wind, bounce, slope, rolling friction, and cup capture. It does not include multiplayer, licensed course replicas, or motion-captured combat.

Choose Performance, Balanced, or High quality from the pause menu. Balanced adjusts rendering resolution to maintain frame rate, up to 1.5 device pixels. Performance disables dynamic shadows and ambient occlusion. Balanced and High add contact shading with GTAO. Balanced suspends this extra pass during dense combat, while keeping dynamic shadows. High quality caps rendering at 2 device pixels.

Gamepad bindings use the browser Gamepad API and standard button mapping. Physical-controller testing is still needed across controller models.

## Deployment

The included GitHub Actions workflow builds the project and publishes `dist/` to GitHub Pages. In the repository settings, set Pages to use GitHub Actions. Push to `main` to deploy.

Vite uses relative asset paths, so the build works beneath a repository path such as `/ninja-golf/`.

## Music and credits

**“Ishikari Lore” — Kevin MacLeod (incompetech.com)**

Licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

[Original track and license](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100192).

**“Neolith” — Kevin MacLeod (incompetech.com)**

Combat switches to this guitar, bass, and drum recording at 145 BPM. It uses [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Original track and license](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100140).

Both recordings ship unchanged and loop during play. The game crossfades between them over 1.15 seconds and controls their volume. See `public/audio/LICENSE.txt` and the in-game credits.

CC0 recordings supply wind, surf, birds, footsteps, splashes, and weapon swishes. Web Audio synthesis adds impact accents. The game does not generate music. Pause suspends all audio. A second active tab silences the first tab within the same browser profile. See the [recording credits](public/audio/field/CREDITS.md).

Three.js and Vite use the MIT license. All six heroes and four enemies use distinct textured humans from [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), under MIT. The [Quaternius](https://quaternius.com/) Universal Animation Library supplies CC0 motion references. The native motion conversion, weapons, and golf trajectories are original adaptations. See [model credits](public/models/LICENSE.txt) and [the human roster](docs/rocketbox-roster.md).

Earlier tree assets use Daniel Greenheck’s [EZ-Tree](https://github.com/dgreenheck/ez-tree), under MIT. The retained generator runs only during asset production. See [its license](public/licenses/EZ-Tree-MIT.txt). The [Tidewater reference](https://github.com/dgreenheck/tidewater) informed the quality study and supplied the credited CC0 recording collection. Its MIT notice accompanies the adapted audio bank.

Current trees, shrubs, ferns, boulders, cliffs, ground materials, and daylight/night HDR skies come from [Poly Haven](https://polyhaven.com/), under CC0. See [landscape credits](public/models/nature/SOURCES.json) and [texture credits](public/textures/SOURCES.json). No Samurai Warriors game assets are included. Official Samurai Warriors 4 and 5 artwork and descriptions inform weapon families and combat styles.

## Code layout

- `src/main.js`: game states, camera, ball simulation, combat, and persistence.
- `src/course.js`: course data, terrain queries, club data, and launch calculations.
- `src/world.js`: terrain, water, vegetation, lighting, and architecture.
- `src/actors.js`: human rigs, motion retargeting, animation blending, and crowd lifecycle.
- `src/effects.js`: slash trails and particles.
- `src/navigation.js`: camera-relative movement, aiming, and radar projection.
- `src/input.js`: shared keyboard, mouse, and gamepad actions.
- `src/audio.js`: two-track music crossfades, playback controls, and sound effects.
- `src/rendering.js`: antialiasing, contact shading, and display output.
- `src/ui.js` and `src/style.css`: menus, controls, HUD, and scorecard.

The development server exposes scenario access for browser tests. Production builds remove that access. Production diagnostics only return current game state.

## Browser verification

With the development server running, install the test browser and run:

```sh
npx playwright install chromium
node tests/browser-audio.mjs
node tests/browser-navigation.mjs
node tests/browser-combat.mjs
node tests/browser-characters.mjs
node tests/browser-smoke.mjs
node tests/browser-scenarios.mjs
node tests/browser-production.mjs
```

Set `PLAYWRIGHT_CHANNEL=chrome` to test with an installed Chrome browser. All browser processes mute audio output. The dedicated audio test still verifies playback internally. Audio tests verify decoding, playback, crossfades, pause, mute, and volume. Navigation tests check A/D under rotated cameras, manual facing, forward-only slashes, and both map modes. The smoke test uses real keyboard input through a swing, ball tracking, combat, and pause. Scenario tests use development-only state setup to verify water, out of bounds, revival, multi-target combat, standard gamepad actions, short putts, saved-round recovery, and all nine-hole scorecards. Screenshots go to `/private/tmp/` on this development machine.

## Motion and character study

See [the character study](docs/character-motion-study.md) for references, pose checkpoints, controls, and enemy counters. `tools/build-rocketbox-warriors.py` converts the licensed native human meshes and rigs. `tools/rocketbox-rig.py` transfers motion while preserving their proportions. The source locomotion library and `src/motion-data.json` supply shared golf and blade trajectories. The runtime uses those same trajectories to position the weapons. See [the asset tool guide](tools/README.md) for the full build sequence.

## Production art and performance checks

See [the production quality record](docs/production-quality.md) for the reference, visual gates, and measured results. Camera sensitivity, inverted vertical look, and reduced camera effects persist locally.

See [the scanned landscape guide](docs/landscape-assets.md) for download, geometry reduction, texture conversion, and distant-tree baking.

The texture tools require Pillow. Character tools require Blender. Shipping assets do not require either tool.

## Expansion validation

Run `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` with the development server active.
The expansion checks exercise six selections, four previews, mouse survey controls, all 36 cups, scorecards, and saved-course identity.
Grip checks compare handles with the actual curled finger joints. Motion checks include forward knee flexion and supporting feet.
Run `node tools/benchmark.mjs --course=0` through `--course=3` to measure each environment. Add `--retina` for the adaptive-resolution check.
All automated browser tests mute audio.
