# Ninja Golf!

A peaceful round. An unreasonable number of ninjas.

Ninja Golf is a browser game built with Three.js. Choose one of six warriors and four original nine-hole courses, then fight your way to each shot.

[Play Ninja Golf in your browser](https://ywong137.github.io/ninja-golf/). Use a desktop browser with a keyboard and mouse, or a standard gamepad.

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
The production title downloads only its course’s scenery. Other courses load on selection, with retry and cancel controls. Loaded scenery stays cached for later visits.

## Play

| Action | Keyboard / mouse | Standard gamepad |
| --- | --- | --- |
| Aim | A / D or left / right arrows | Left stick |
| Survey shot | R or survey button | Y during golf |
| Pan / orbit / zoom in survey | Drag / right-drag / wheel | Left stick / right stick / triggers |
| Change club | Q / E or club buttons | LB / RB |
| Lower / raise shot height | Z / X or shot-height buttons | D-pad down / up |
| Start swing, then strike | Space or swing button | A |
| Speed up ball tracking | Space | A |
| Move | W A S D or arrows | Left stick |
| Look during combat | Mouse movement; click course to capture | Right stick |
| Fast attack | Left mouse button | X or RT |
| Heavy attack / combo finisher | Right mouse button | Y |
| Musou | F, with full Resolve | RB during combat |
| Focused strafe / backpedal | Hold C | Hold LT |
| Sprint | Hold Shift | Hold left-stick click |
| Dodge | Space | B |
| Directional guard / timed parry | Hold / press V | Hold / press LB |
| Face the ball waypoint | Q | Right-stick click |
| Address the ball | E, near the ball with no nearby enemies | A |
| Pause | Escape | Start |

The power meter repeats. Press the swing button again at the desired power. Carry scales with the square of power.

Choose among eight clubs. Read the lie, wind, elevation, target arc, and course map. The landing preview includes wind and terrain. Survey mode initially fits the full planned shot. Drag to explore the course, orbit with the right mouse button, and scroll to zoom.

Putting grids show slope, with moving dots pointing downhill. Shot results report distance and the next lie. Rough reduces carry. The sand wedge works best in bunkers. Use the putter on greens.

Choose low, normal, or high flight. Low shots sacrifice carry for a flatter flight and more run. High shots sacrifice some carry for a steeper landing and more wind exposure. The carry readout and landing preview follow this choice. Height controls reset the power meter and lock once the swing starts. Putting uses normal height, and each new shot starts at normal height.

After a long shot, walk to the ball and fight the attackers. Movement follows the camera. Hold the focused stance to strafe or backpedal while facing another direction. Q or right-stick click turns the camera toward the ball. The combat radar shows enemies and the next ball waypoint.

Fast attacks build a combo. Heavy attacks add finishers and break enemy guards. Movement can cancel an attack during preparation or recovery. The strike itself has a brief commitment window. Dodge cancels immediately. Defeats build Resolve and restore some health.

With full Resolve, Musou immediately interrupts the current action. Two dramatic wipes and a camera orbit introduce a longer captured attack sequence. Red fire, aura, and blade trails remain visible between strikes. The finish launches enemies through sparks and impact bursts.

Hold V or LB to guard toward the camera. A timed guard press parries, staggers the attacker, and earns Resolve. Guard leaves your rear exposed. Release it to recover strength. Dodge can escape a broken guard.

Ninjas emerge from lanterns, pagodas, rocks, trees, sand, and water. They flank and intercept, while many grunts wait before attacking. Ground warnings show committed attacks. Rocks and buildings block movement, so run around them.

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

The Ronin favors power, the Shinobi favors speed and accuracy, and The Vice President favors health and reach. The Vice President uses an adapted likeness of Ethan Cary.
The Ace carries a straight jian, The Hustler carries a curved dao, and The Closer carries a short wakizashi. Each has a separate stance, fast attacks, heavy finishers, and a Musou sequence. Selection alternates men and women while preserving saved character IDs. [SW4/5 roster research](docs/warrior-roster-reference.md) records the art and character references.
Each warrior has a distinct face, hair, costume, and body shape. Enemies use smaller conventional blades and polearms. Enemies wear traditional ninja clothing in dark grey, black, and blue. Understated trim varies by course. Their appearance is separate from their four combat roles.

The character selection screen cycles through address, a full golf swing, combat ready, a light attack, and a heavy attack. Press **C** to open animation controls. Speed ranges from **0.1× to 1.0×**. **Pause / Go** freezes or resumes the character. Changing characters retains these settings.

## Graphics and scope

This release uses licensed Microsoft Rocketbox humans with adapted geometry, skinning, faces, hair, clothing, and textures. Each character has adapted golf, movement, combat, guard, and death animations. Golf swings use a baked two-hand animation. The ball launches at the swing contact time.

The golf swing keeps the lead arm extended, shifts the hips, turns the chest, and raises the trail heel through the finish. Ethan uses a two-handed naginata, with stepping attacks and an extended Musou sequence. Both hands share the same shaft. His guard reactions use the same grip. See [native motion checks and remaining elbow-fold limits](docs/reviews/native-naginata.md).

The environment uses scanned grass, sand, bark, rock, and pine textures, plus a photographic HDR sky and reflections. Trees, shrubs, rocks, and cliffs use reduced photographic scans. Buildings and small props use generated geometry. Nearby trees retain branches and leaf cards, with wind deformation. Distant trees use 24 viewing angles, including elevated views. Their surface normals respond to scene lighting. Ground shadows follow their actual branches. Short dithered transitions connect the detail levels. Grass uses instancing and fades smoothly at distance. Ponds reflect the scene, with ripples and shoreline foam. The architecture uses curved tiled roofs, galleries, lattice panels, and stone foundations. Weapons use beveled steel, cloth grips, and brass fittings. Each hero weapon uses five to seven material draws. At most 64 enemies remain active at once. Waves can produce hundreds of enemies over a round.

This is a playable browser release, with further art work needed for the requested photorealistic standard. It does not yet match a current AAA golf simulator. It uses simplified golf physics. It includes simplified wind, bounce, slope, rolling friction, and cup capture. It does not include multiplayer or licensed course replicas. Adapted combat performances include Mixamo captures and Quaternius animations.

Buildings block actors, combat cameras, blades, projectiles, and golf balls. Enemies take routes around their walls. Gates, arches, and porches remain open. Interiors and stairs remain inaccessible. Large rocks also block movement and combat cameras. Balls receive a free drop when scenery blocks the golf stance. Inaccessible roofs add one penalty stroke. The [building review](docs/building-collision-review.md) records placement checks, collision behavior, and remaining limits.

Choose Performance, Balanced, or High quality from the pause menu. Balanced adjusts rendering resolution to maintain frame rate, up to 1.5 device pixels. Performance disables dynamic shadows and ambient occlusion. Balanced and High add contact shading with GTAO. Balanced suspends this extra pass during dense combat, while keeping dynamic shadows. High quality caps rendering at 2 device pixels.

Gamepad bindings use the browser Gamepad API and standard button mapping. Physical-controller testing is still needed across controller models.

## Deployment

The included GitHub Actions workflow builds the project and publishes `dist/` to GitHub Pages. In the repository settings, set Pages to use GitHub Actions. Push to `main` to deploy.

Vite uses relative asset paths, so the build works beneath a repository path such as `/ninja-golf/`.

## Music and credits

Each course has four existing recordings: two calm golf tracks and two action tracks. All sixteen use Creative Commons Attribution 4.0. No music is generated.

| Course | Golf | Combat |
| --- | --- | --- |
| Crane Coast | Ishikari Lore; Senbazuru | Neolith; Metalmania |
| Heather & Crown | Skye Cuillin; Errigal | Twisted; Noise Attack |
| Copper Saguaro | Laid Back Guitars; Del Rio Bravo | El Magicia; Lonely |
| Neo-Tokyo | Awayuki; Cyber_Noir | Kengeki; CyberPunk_City |

Crane uses Japanese instruments and guitar rock. Heather uses Celtic music and classic-rock styling. Copper uses Latin music, Latin rock, and dramatic flamenco. Neo-Tokyo mixes Japanese chillout, cyberpunk, synthwave, and Japanese hard rock.

The game alternates recordings within each mode. Combat encounters alternate their starting tracks. Crossfades last 1.15 seconds. Each course retains its track order when you change courses. Only the active mode plays after each fade. Copper and Neo-Tokyo recordings use 160 kbps MP3 encoding. Crane and Heather retain the original MP3 files. The original compositions remain unchanged. See [full soundtrack credits](public/audio/music/CREDITS.md), [source metadata](public/audio/music/SOURCES.json), and the in-game credits.

Licensed recordings supply wind, surf, birds, footsteps, splashes, weapon whooshes, and layered impacts. Web Audio synthesis supplies interface sounds and supporting accents. The game does not generate music. Pause suspends all audio. Mute, music, and volume choices persist across page reloads. A second active tab silences the first tab within the same browser profile. See the [recording credits](public/audio/field/CREDITS.md).

Three.js, Vite, and meshoptimizer use the MIT license. All six heroes and the ninja bodies derive from textured humans from [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), under MIT. The [Quaternius](https://quaternius.com/) Universal Animation Library supplies CC0 motion references. The native motion conversion, weapons, and golf trajectories are original adaptations. See [model credits](public/models/LICENSE.txt) and [the human roster](docs/rocketbox-roster.md).

Earlier tree assets use Daniel Greenheck’s [EZ-Tree](https://github.com/dgreenheck/ez-tree), under MIT. The retained generator runs only during asset production. See [its license](public/licenses/EZ-Tree-MIT.txt). The [Tidewater reference](https://github.com/dgreenheck/tidewater) informed the quality study and supplied the credited CC0 recording collection. Its MIT notice accompanies the adapted audio bank.

Scanned trees, shrubs, ferns, boulders, cliffs, ground materials, and daylight/night HDR skies come from [Poly Haven](https://polyhaven.com/), under CC0. See [landscape credits](public/models/nature/SOURCES.json) and [texture credits](public/textures/SOURCES.json). The desert saguaro models are original project geometry. No Samurai Warriors game assets are included. Official Samurai Warriors 4 and 5 artwork and descriptions inform weapon families and combat styles.

## Code layout

- `src/main.js`: game states, camera, ball simulation, combat, and persistence.
- `src/course.js`: course data, terrain queries, club data, and launch calculations.
- `src/world.js`: terrain, water, vegetation, lighting, and architecture.
- `src/actors.js`: human rigs, motion retargeting, animation blending, and crowd lifecycle.
- `src/effects.js`: slash trails and particles.
- `src/navigation.js`: camera-relative movement, aiming, and radar projection.
- `src/input.js`: shared keyboard, mouse, and gamepad actions.
- `src/audio.js`: course playlists, music crossfades, playback controls, and sound effects.
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

Distant Japanese, Scottish, and Arizona landforms use adapted [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/). See [source credits](public/terrain/LICENSE.txt) and [crop metadata](public/terrain/SOURCES.json). These are fictional course settings, not recreations of real courses.
