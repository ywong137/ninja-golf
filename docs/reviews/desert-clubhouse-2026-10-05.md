# Copper Saguaro clubhouses — October 5, 2026

Copper Saguaro now has Pueblo-inspired clubhouses and practice lodges.
The buildings have rounded stucco edges, stepped roof walls, timber porches, recessed window frames, and stone terraces.
The entrance stairs reach the actual door threshold. Each flight follows its local terrain.
The smaller practice lodge changes the upper floor width and position.
The new forecourts connect to existing paths where dry, unobstructed routes exist.
Nine such connections serve the eighteen buildings across nine holes.

The [Boulders resort gallery](https://www.theboulders.com/gallery/) informed the building proportions and porch details.
The geometry is original. No reference photograph ships with the game.
Stucco uses Amal Kumar's [clay plaster scan](https://polyhaven.com/a/clay_plaster), under [CC0](https://polyhaven.com/license).
The three source maps match their published MD5 values.
The shipped maps retain 2048-pixel dimensions and use JPEG quality 88.
They total 1,398,645 bytes and load when the desert course needs them.
The shader normalizes the scan's brown pigment before applying a warm lime color.
The roughness and normal maps retain the scanned surface detail.
The game credits link to the shipped texture source manifest.

Both buildings share eight material batches, compared with seven before this change.
Hole one's architecture contains 31,812 triangles, compared with 2,952 before.
The rounded edges account for much of the additional geometry.
There is no new per-frame building animation or library dependency.
Materials that the replacement no longer uses are disposed during construction.

## Verification

The final review covers front, side, porch, and aerial views of both building variants.
It rejected the initial dark brown material before the final warm stucco finish.
The new stairs pass threshold, tread, grounding, and navigation checks on all nine desert holes.
The compound and path checks cover all thirty-six holes.
Plant clearance still passes across the nine desert holes, including 730 safe approaches to cactus trunks.
The closest sampled plant bounds remain 3.12 metres beyond a fairway.

Actual movement checks pass on all four course styles.
They cover walking, dodging, camera clearance, enemy pursuit, emergence, projectiles, ball reflection, and obstruction relief.
The relief checks cover 3,072 character, club, and aim combinations.
The raised desert terrace blocks movement. Its exterior forecourt remains clear.
The corresponding browser fixture now crosses that forecourt instead of the former ground-level porch.

The elevated camera test exposed insufficient wall clearance during an alternate view beside a foundation.
Combat camera sweeps now reserve 25 centimetres instead of 20 centimetres.
A regression check covers thirty-two camera directions beside a raised building.
The existing rock camera checks also pass.

The emergence fixture previously stopped after 2.5 seconds.
That was shorter than some current takeoff, flight, and landing sequences, including their spawn delay.
It now waits for each captured sequence's actual duration plus a small margin.
No enemy animation or emergence behavior changed in this pass.

The production build succeeds with its existing large-bundle warning.
The exact built bundle is `index-By4Y8qz9.js`.
Normal input passes four course previews, a golf shot, running, and light/heavy attacks on Copper Saguaro.
Ethan's observed heavy clip remains `Ethan_GDH_Combo5_Review`.
All three stucco maps download successfully and decode at 2048 × 2048.
The final browser checks report no errors. Every automated game browser remains muted.

## Performance and limits

A fight beside the first clubhouse keeps twenty-four enemies alive while the Ronin attacks and moves laterally.
Chrome uses Metal on the local Apple M1 Max at 1440 × 900, with a fixed rendering ratio of 1.0.
The sample measures eight seconds after two seconds of warmup.
No other automated GPU job runs during the measurement.

- Average: 60.1 FPS.
- 95th-percentile frame time: 16.7 ms.
- Longest measured frame: 16.8 ms.

This sample uses the bare forecourt, with no nearby grass instances.
It is not directly comparable to the previous moving fairway benchmark.
It does not establish full-round or cross-device performance.

The buildings remain solid scenery. Their stairs and terraces do not add walkable floor heights or interior gameplay.
The design improves the course's appearance but does not achieve photorealism.
Broad ground surfaces, rock formations, distant terrain, and further asset variety still limit the environment.

The approved Ronin and Closer identities, accepted controls, and character motions remain intact.
The complete build stays local/private, including Ethan's purchased motions.
The preview runs at http://127.0.0.1:4185/.
Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/desert-clubhouse/`.
