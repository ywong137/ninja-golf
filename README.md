# Ninja Golf!

A peaceful round. An unreasonable number of ninjas.

Ninja Golf is a browser game built with Three.js. Play an original three-hole coastal course, then fight your way to each shot.

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

Choose among eight clubs. Read the lie, wind, elevation, target arc, and course map. Rough reduces carry. The sand wedge works best in bunkers. Use the putter on greens.

After a long shot, walk to the ball and fight the attackers. Movement follows the camera. The warrior faces the movement direction. Attacks hold that facing through the strike. Q turns the camera toward the ball without moving you. The combat radar shows nearby enemies and the ball waypoint. Attacks hit several enemies. Defeats build Resolve and restore a little health. Chain fast attacks, then add a heavy attack for different finishers. Musou starts with a face close-up and clears a large area. Hold the focused stance to move independently of facing. Enemies flank and intercept. They emerge from lanterns, pagodas, rocks, trees, sand, and water.

Water and out-of-bounds shots return to the previous lie and add one penalty stroke. Defeat revives the warrior and adds one penalty stroke. Short shots and putts do not start a new battle.

The game saves completed holes in local browser storage. The title screen offers to continue an unfinished round after a reload. It does not save mid-hole progress.

## Course and characters

Kazekage Coast has three original holes:

- The Crane’s Landing: par 4, 361 yards.
- Across the Still Water: par 3, 168 yards.
- The Shogun’s Approach: par 5, 499 yards.

The course uses coastal golf design principles, including broad landing areas, a water carry, guarded greens, and a longer dogleg. The official [Pebble Beach hole guide](https://www.pebblebeach.com/golf/pebble-beach-golf-links/) informed the design. This is a fictional course, not a surveyed recreation.

The Ronin has more driving power. The Shinobi moves faster and has less shot dispersion. The Monk has more health and wider attacks.

## Graphics and scope

This release uses skinned human characters with 65-bone skeletons, fitted samurai costumes, and blended walking, running, sword, roll, and death animations. Golf swings use a separate baked two-hand animation. The ball launches at the swing contact time.

The environment uses scanned grass, sand, bark, rock, and pine textures, plus a photographic HDR sky and reflections. Terrain, trees, rocks, and buildings remain generated geometry. Trees and grass use instancing. Weapon fittings and blade faces use three draw calls per blade. At most 64 enemies remain active at once. Waves can produce hundreds of enemies over a round.

This is a playable browser release, with further art work needed for the requested photorealistic standard. It does not yet match a current AAA golf simulator. It uses simplified golf physics. It includes simplified wind, bounce, slope, rolling friction, and cup capture. It does not include multiplayer, a full 18-hole course, licensed course replicas, or motion-captured combat.

Choose Performance, Balanced, or High quality from the pause menu. Balanced caps rendering at 1.5 device pixels. Performance disables shadows and ambient occlusion. Balanced and High add contact shading with GTAO. High quality caps rendering at 2 device pixels.

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

Sound effects use Web Audio synthesis. The game does not generate music.

Three.js uses the MIT license. Vite uses the MIT license. Human base meshes and the Universal Animation Library come from [Quaternius](https://quaternius.com/), under CC0. Costumes, weapons, and golf animations are original adaptations. See [model credits](public/models/LICENSE.txt).

Scanned materials, pine textures, and the HDR sky come from [Poly Haven](https://polyhaven.com/), under CC0. See [texture credits](public/textures/SOURCES.json). No Samurai Warriors game assets are included. The official [Samurai Warriors 4 character artwork](https://www.koeitecmoamerica.com/sw4/chara05.html) informed costume proportions and silhouettes.

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
```

Set `PLAYWRIGHT_CHANNEL=chrome` to test with an installed Chrome browser. All browser processes mute audio output. The dedicated audio test still verifies playback internally. Audio tests verify decoding, playback, crossfades, pause, mute, and volume. Navigation tests check A/D under rotated cameras, manual facing, forward-only slashes, and both map modes. The smoke test uses real keyboard input through a swing, ball tracking, combat, and pause. Scenario tests use development-only state setup to verify water, out of bounds, revival, multi-target combat, standard gamepad actions, short putts, saved-round recovery, and all three scorecards. Screenshots go to `/private/tmp/` on this development machine.

## Motion and character study

See [the character study](docs/character-motion-study.md) for references, pose checkpoints, controls, and enemy counters. `tools/build-warriors.py` builds the costumes. `tools/build-motion.py` exports the source locomotion library. Run `tools/build-authored-motion.py` last to bake the shared golf and blade trajectories from `src/motion-data.json`. The runtime uses those same trajectories to position the weapons.
