# Enemy spacing and golf clearance

Date: 2026-09-29. Previous release: `5974b2a`.

Waiting melee enemies stopped moving as soon as they reached nine metres from the hero.
This prevented their existing formation targets from separating a group after pursuit.
A twelve-enemy reproduction stayed in two adjacent quarters of the circle for seventeen seconds.

Waiting enemies now move to separate positions at a slower speed, then stand ready.
Different start and stop distances prevent repeated small steps near each position.
A blocked waiting position does not send an extra enemy toward the hero.
A nearby waiting enemy can step away when the player stops beside it.
The running animation follows the actual movement speed after collision handling.

The same reproduction now occupies all four quarters.
The nearest waiting enemy stops 6.10 metres from the hero.
The group has no movement during its final two-second observation.
When the test releases their attack cooldowns, eleven attacks start during six seconds.
At most three melee enemies attack together.
This count can vary with the existing random recovery times.

The wider gameplay check also found a golf regression.
The previous building clearance assumed a 1.04-metre stance offset.
The current native poses and fitted clubs can require 1.78 metres, including the body collider.
The shared free-drop rule now reserves 2.1 metres.
Shot previews and actual landings use this same rule.
Drops remain dry, add no penalty, and cannot move closer to the cup.

The building browser test now uses the rendered ball's radius instead of the former oversized ball.
It checks all six heroes, eight clubs, and sixteen aim directions beside each course's building.
All 3,072 stance checks pass.
The club test also checks the clearance envelope for each of the 48 fitted combinations.

The combat browser test now waits for movement instead of assuming that scene startup finishes within 400 milliseconds.
It closes its browser after failures as well as successful runs.
Keyboard, mouse, gamepad, combo, Musou, and scenery entrance checks pass.
All 415 unit and asset checks pass in the release snapshot.
The production build succeeds.

A moving combat test holds 64 enemies on Crane Coast.
Chrome uses Metal on Apple M1 Max, Balanced settings, at 1440×900 with rendering ratio 1.0.
The ten-second measurement averages 53.5 FPS, with a 33.4-millisecond 95th-percentile frame time.
Contact shading is disabled at this crowd size; dynamic shadows remain active.
The Neo-Tokyo building-route scenario averages 60.1 FPS, with a 16.8-millisecond 95th-percentile frame time.
Its largest combat update takes 45.3 milliseconds.
All development browsers remain muted.

These checks establish the formation and clearance fixes.
Character choreography and close environment detail still need work toward the requested AAA standard.
