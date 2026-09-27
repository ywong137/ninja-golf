# Combat footwork

Kaede's full attack family now uses visible steps, support transfers, and hip-led cuts. Her empty hand lowers during loading and moves with the release. Her Musou finishes with a deeper body drop. See `kaede-combat.md` for the native animation build.

All six heroes use the shared movement correction. Previously, ground placement removed most attack foot lifts. It reduced Kaede's returning cut from 4.2 cm of native lift to 0.3 cm. The authored attack path now preserves lifts and foot pivots on flat ground. Terrain correction adjusts support to the slope and clears obstacles under swinging feet.

## Attacking while moving

`AttackLocomotion` evaluates each hero's native directional guard steps on a mesh-free rig. It advances those steps from actual movement after collision handling. It applies their ankle targets and knee direction through native-length leg IK. The body keeps the attack's upper-body rotations and some of its compression.

WASD and gamepad input remain available during light and heavy attacks. Their input speed remains unchanged. A moving attack blends into stepping over about 0.12 seconds. Releasing movement retains the previous heading and returns to the attack stance over 0.22 seconds. This prevents the large ankle jump caused by an undefined direction at zero speed.

Standing attacks keep their authored footwork. Automatic displacement defaults to zero unless a clip supplies `rootAdvance`. Musou holds its position and uses its authored support transfers.

The layer restores its saved transforms after terrain correction restores, and before the main animation mixer runs. Golf, dodges, emergence, character selection, and the Musou close-up reset the movement layer.

Repeated attacks alternate between two animation actions so the outgoing pose can blend into the next attack. Terrain probes also prepare downhill support during recovery. This removes an 8.2 cm correction jump when an attack starts again on a slope.

## Checks

```sh
node --test tests/attack-locomotion.test.js tests/attack-foot-placement.test.js
node tests/browser-moving-attacks.mjs
node tools/capture-game-attacks.mjs after
node tools/benchmark.mjs --hero=3 --moving
```

The gameplay check covers 96 cases: six heroes, eight movement directions, and light/heavy attacks. The first pass measured at least 10 cm of right-foot recovery in every case. Maximum leg target error was 2.55 cm during blending. Weapon handles remained on the palms within floating-point precision.

The release regression samples seven headings and 40 gait phases on the native Kaede model. Maximum first-frame ankle displacement fell from 65.6 cm to 3.84 cm at 60 Hz.

Steady cardinal support drift averaged 0.4–0.6 cm/s in the CPU audit. Diagonal blends averaged 7.5–10.5 cm/s. These blends retain some sliding. The later roster pass adds distinct standing choreography for the other five heroes. See `roster-combat.md` for the native interpolation repair and current build procedure.

## Performance

Muted Chrome on the local M1 Max measured moving Kaede attacks against 64 enemies. Each test used a 1440×900 viewport and Balanced quality. Tests ran separately from asset baking and other rendering jobs.

| Course | Display scale | Render ratio | Average FPS | Frame time, 95th percentile |
| --- | ---: | ---: | ---: | ---: |
| Crane Coast | 1 | 1.0 | 57.6 | 16.8 ms |
| Crane Coast | 2 | 1.5 | 48.1 | 33.4 ms |
| Neo-Tokyo | 2 | 1.5 | 53.8 | 33.3 ms |

The movement layer remained active during each measurement. Balanced quality disables contact shading at this crowd size. Dynamic shadows remain active. These results apply to the tested machine and views.
