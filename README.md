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
| Look during combat | Hold right mouse button and drag | Right stick |
| Slash | J or left mouse button | X or RT |
| Special attack | K, with full Resolve | Y |
| Sprint / dodge | Hold / tap Shift | Hold / tap B |
| Run toward the ball | F | — |
| Address the ball | Space, near the ball with no nearby enemies | A |
| Pause | Escape | Start |

The power meter repeats. Press the swing button again at the desired power. Carry scales with the square of power.

Choose among eight clubs. Read the lie, wind, elevation, target arc, and course map. Rough reduces carry. The sand wedge works best in bunkers. Use the putter on greens.

After a long shot, walk to the ball and fight the attackers. Attacks hit several enemies. Defeats build Resolve and restore a little health. Use the special attack to clear a large area.

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

This release uses procedural terrain, original articulated characters, leaf cards, instanced trees, grass, rocks, and animated water. Enemy parts share instanced draw calls. At most 64 enemies remain active at once. Waves can produce hundreds of enemies over a round.

The game targets a polished, compact birthday release. It does not contain AAA scanned assets or full golf-simulator physics. It includes simplified wind, bounce, slope, rolling friction, and cup capture. It does not include multiplayer, a full 18-hole course, licensed course replicas, or motion-captured combat.

Choose Performance, Balanced, or High quality from the pause menu. Balanced caps rendering at 1.5 device pixels. Performance disables shadows. High quality caps rendering at 2 device pixels.

Gamepad bindings use the browser Gamepad API and standard button mapping. Physical-controller testing is still needed across controller models.

## Deployment

The included GitHub Actions workflow builds the project and publishes `dist/` to GitHub Pages. In the repository settings, set Pages to use GitHub Actions. Push to `main` to deploy.

Vite uses relative asset paths, so the build works beneath a repository path such as `/ninja-golf/`.

## Music and credits

**“Ishikari Lore” — Kevin MacLeod (incompetech.com)**

Licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

[Original track and license](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100192).

The original recording ships unchanged and loops during play. The game adjusts playback volume. See `public/audio/LICENSE.txt` and the in-game credits.

Sound effects use Web Audio synthesis. The game does not generate music.

Three.js uses the MIT license. Vite uses the MIT license. Terrain, characters, architecture, and vegetation are original procedural assets.

## Code layout

- `src/main.js`: game states, camera, ball simulation, combat, and persistence.
- `src/course.js`: course data, terrain queries, club data, and launch calculations.
- `src/world.js`: terrain, water, vegetation, lighting, and architecture.
- `src/actors.js`: articulated characters, crowd instancing, and effects.
- `src/input.js`: shared keyboard, mouse, and gamepad actions.
- `src/audio.js`: music playback and sound effects.
- `src/ui.js` and `src/style.css`: menus, controls, HUD, and scorecard.

The development server exposes scenario access for browser tests. Production builds remove that access. Production diagnostics only return current game state.

## Browser verification

With the development server running, install the test browser and run:

```sh
npx playwright install chromium
node tests/browser-smoke.mjs
node tests/browser-scenarios.mjs
```

The smoke test uses real keyboard input through a swing, ball tracking, combat, and pause. Scenario tests use development-only state setup to verify water, out of bounds, revival, multi-target combat, standard gamepad actions, short putts, saved-round recovery, and all three scorecards. Screenshots go to `/private/tmp/` on this development machine.
