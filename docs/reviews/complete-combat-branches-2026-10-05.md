# Complete hero combat branches — October 5, 2026

Later light and heavy branches still selected older procedural attacks for five heroes.
Those clips moved the arms with little stepping or torso movement.
Every declared light and heavy branch now selects an existing full-body source performance.

The Ronin now uses a three-stage light chain: driving cut, low cut, and turning power cut.
His later heavy finisher uses the advancing three-cut performance.
The Ace, Hustler, and Closer retain their connected light chains and gain source-based heavy branches.
The Shinobi retains his accepted attacks and brief shadow disappearances.

Ethan now uses a three-stage light chain: thrust, returning cuts, and leaping finish.
Two intervals from his purchased Combo5 supply the later branches, with the complete original recovery.
The returning cuts use source seconds 0.8–3.3333332538604736, played at 1.4×.
The leaping finish uses source seconds 1.4–3.3333332538604736, played at 1.25×.
His model gains two clips, from 42 to 44. Its size increases by 487,500 bytes.
The original geometry, textures, rig, and 42 animation records remain intact.

The controller, input buffering, running, golf swing, and musou sequences remain unchanged.
The new branches inherit existing damage and knockback rules. Longer finishers deliver several contacts.
Some light and heavy branches share source performances. This does not establish fully distinct choreography for every attack.

## Verification

- 81 focused unit and asset checks pass.
- Coverage checks verify all 48 declared light and heavy slots against their actual model clips.
- Each new interval matches the original joint transforms across 121 samples, including scale and relative root travel.
- 25 normal mouse and keyboard sequences cover every reachable heavy branch across all six heroes.
- Those sequences record 96 contacts. Reversal leaves completed contact commitment within 0.133 seconds.
- The largest measured primary palm gap is below 0.000001 metres. All transforms remain finite.
- The browser records no errors. Every test stays muted.
- Ethan's selection bounds remain geometrically identical after regeneration; only the model hash changes.

The input fixture initially counted the Shinobi's intentional disappearance as a missing weapon.
It now permits invisibility only on the actor root during the declared shadow interval.
It still rejects hidden weapons during visible attacks.

## Crowded combat

Chrome uses Metal on the Apple M1 Max, with a 1440 × 900 viewport and 24 active enemies.
Balanced rendering adjusts its resolution automatically. Each measurement covers eight seconds after warmup.
The fixture keeps enemies alive to sustain the workload. It does not measure ordinary kill pacing.
No other rendering or asset work ran during these measurements.

| Hero | Average FPS | Rendering ratio | 95th-percentile frame time, ms |
| --- | ---: | ---: | ---: |
| Ronin | 51.2 | 1 | 33.4 |
| Vice President | 53.5 | 0.85 | 33.3 |
| Hustler | 54.8 | 0.75 | 33.3 |
| Closer | 52.0 | 0.75 | 33.4 |

These results describe this machine and these scenes. They do not guarantee performance on other hardware.

## Exact production build

The built game passes character selection, a golf shot, combat entry, three queued light attacks, and a chained heavy attack.
Read-only diagnostics confirm the expected motion names, stages, and contacts through real browser input.
The served Ethan model matches SHA-256 `30099081f3bebb94ad7da838ab5aa0bd997c590f42b66ee6e9e72407f9994b46` and contains all 44 clips.
The production browser reports no errors. The local preview remains `http://127.0.0.1:4185/`.

The initial download check exceeded Chrome's response cache. A later check tried to decompress an already decoded HTTP response.
The final check uses the game's existing decoder, which accepts both representations. Neither fixture error required a runtime loading change.

## Evidence and limits

The local evidence directory is `/Users/yishan/ninja-golf/artifacts/reviews/complete-combos/`.
It contains matched pose sheets, assembly inputs, input reports, encounter captures, and build logs.
`tests/browser-combo-branches.mjs` preserves the complete input check.
Use `GAME_URL` to select the local server, and `COMBO_REVIEW_OUTPUT` to select its report directory.

The complete build remains private and local because it contains the purchased polearm performances.
The broader AAA art target remains unfinished. These changes remove weak fallback attacks; they do not finish the character animation work.
The close garment and polearm cuff limitations from the preceding review remain.
