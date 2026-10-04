# Ethan / Copper Saguaro round review

A muted controller completed all nine holes on release `5ccd4e1` at 1440×900 with Balanced graphics.
The driver used normal gamepad input and UI clicks. Its shot planner read game state without changing it.
It did not edit ball position, health, enemies, scores, or the game clock.

The round took about 30.8 minutes and completed 16 combat passages.
Ethan defeated 2,708 enemies. No browser errors or unexpected pauses occurred.
The final save records all nine holes and `nextHole: 9`.

| Hole | Shots | Penalties | Score |
| --- | ---: | ---: | ---: |
| 1 | 3 | 0 | 3 |
| 2 | 1 | 0 | 1 |
| 3 | 4 | 0 | 4 |
| 4 | 3 | 0 | 3 |
| 5 | 3 | 0 | 3 |
| 6 | 2 | 0 | 2 |
| 7 | 4 | 0 | 4 |
| 8 | 2 | 0 | 2 |
| 9 | 7 | 4 | 11 |
| Total | 29 | 4 | 33 |

The audit matches each committed shot to its flight and each score to shots plus penalties.
The automated player repeated a marginal ninth-hole approach and incurred four penalties before landing safely.
The game adds shot dispersion. The review planner did not include a margin around its nominal landing.
Future automated reviews should account for that margin instead of repeating the same risky shot.
This observation does not establish a production physics defect.

Across 100,218 combat frames, average FPS was 59.71 on this M1 Max.
Median frame time was 16.7 ms; p95 and p99 were 16.8 ms.
These measurements describe this local run, not every device or graphics setting.

## Final scorecard correction

The final scorecard correctly totaled 33 strokes against par 36.
Its headline incorrectly described the last hole: `+7 · A scenic route`.
Completed rounds now use the total result: `3 under par` for this recorded round.
Intermediate scorecards retain their hole result names.
The score calculation and saved results remain unchanged.

Focused tests cover a bad final hole in an under-par round, level par, over par, and an intermediate hole.
A separate browser replay renders the corrected scorecard with the recorded results.
It does not represent a second complete playthrough.

Evidence resides in `artifacts/reviews/ethan-copper-round` in the primary checkout.
`final.png` is the actual end-of-round capture. `scorecard-corrected.png` is the corrected UI replay.
The report, score audit, observations, and input driver remain alongside those images.

## Remaining visual work

Musou explosion flashes still form large polygonal surfaces that can obscure the hero.
Capture a dedicated comparison before replacing the hard flash with a softer effect.
The complete round does not establish natural animation or overall AAA quality.
