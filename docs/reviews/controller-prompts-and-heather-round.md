# Controller prompts and Heather round review

The HUD previously showed keyboard commands while the player used a gamepad.
It also showed a mouse-capture instruction during controller combat.
Prompts now follow the device used for movement, looking, or button presses.
An idle connected pad does not replace keyboard prompts.

Golf, survey, flight, combat, guard, Musou, and ball-interaction prompts use the matching controls.
Input handling and displayed button names share the standard gamepad action map.
Right-stick click faces the ball during combat. The help panel describes this command.
The opening golf message clears when the player leaves the aiming phase.

## Verification

Five focused input and scorecard tests pass. The production build succeeds.
A browser check verifies the HUD at 1440×900 and 960×640, including device changes and the phase-specific message.
A separate built-game check uses normal controls to survey, hit a shot, enter combat, face the ball, and return to keyboard prompts.
It reports no browser errors. All browsers remain muted.

The normal-input check is `artifacts/reviews/controller-prompts/production/report.json` in the primary checkout.
The UI-only checks remain separate from that gameplay evidence.
The final public verification is required after deployment.

## Complete Heather & Crown round

A fresh round as The Ace completed all nine holes on release c251043.
The driver used a standard virtual gamepad and UI clicks.
Its shot planner read game state without editing positions, health, enemies, scores, or the clock.
The existing browser kept its original modules while the separate prompt update was prepared.

The round took 23.9 minutes. It included 16 combat passages and 2,638 enemy defeats.
All 25 shots count correctly, with zero penalties and zero browser errors.
The final scorecard shows 25 against par 36: 11 under par.
The saved result includes nine scores, nine penalty entries, the correct course and character, and nextHole 9.

| Hole | Shots | Penalties | Score |
| --- | ---: | ---: | ---: |
| 1 | 3 | 0 | 3 |
| 2 | 2 | 0 | 2 |
| 3 | 3 | 0 | 3 |
| 4 | 2 | 0 | 2 |
| 5 | 4 | 0 | 4 |
| 6 | 2 | 0 | 2 |
| 7 | 4 | 0 | 4 |
| 8 | 2 | 0 | 2 |
| 9 | 3 | 0 | 3 |

The review encountered tee, fairway, rough, bunker, and green lies.
Six walking routes required detours. None required a retry or failed to reach the ball.
The planner used full course data, so its score does not represent human difficulty.
This was a functional review, not an isolated performance benchmark.
It does not verify penalty handling or establish AAA visual quality.

Evidence: `artifacts/reviews/ace-heather-complete/{play.mjs,report.json,summary.json,final.png}` in the primary checkout.
The independent audit matches each score to recorded flights plus penalties.
Neo-Tokyo still needs a complete fresh round. Its earlier resumed review reached only hole four.
