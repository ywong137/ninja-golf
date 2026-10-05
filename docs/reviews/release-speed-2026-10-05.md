# Release speed investigation — 2026-10-05

The published game is at https://ywong137.github.io/ninja-golf/.
The previous release succeeded at commit `4fadd8d5491c2ca2e168709334b93ceda067f0e6`.
Its workflow is https://github.com/ywong137/ninja-golf/actions/runs/37369989822.

## Measured delay

GitHub took 44 minutes and 8 seconds after the push.
Local validation and repairs to stale tests also delayed the earlier release before the push.

| Stage | Previous duration |
| --- | ---: |
| Initial runner queue | 5m 52s |
| Full test suite | 26m 14s |
| Production build | 10s |
| Artifact upload | 21s |
| Second runner queue | 10m 23s |
| Pages deployment | 22s |

Checkout, setup, and cleanup account for the remaining time.
The upload and publication steps were not the main bottleneck.

## Changes

Tests, build, artifact upload, and Pages deployment now share one runner.
The workflow retains the full test gate and the explicit `actions/deploy-pages@v4` step.
This removes the second runner queue. The initial queue still depends on GitHub capacity.

The golf clearance tests previously deformed the same head eight times per pose, once for each arm, hand, and club part.
The new batch API deforms the head once, then measures each part separately.
It refreshes the head for every pose and retains independent distances and contact counts.

The geometry checker also rejects triangle pairs whose plane separation exceeds the current distance bound.
Those pairs cannot improve the measured minimum or contribute a contact.
Degenerate triangles retain the original calculation.
The reference path bypasses this new rejection for independent comparisons.

These changes retain every sampled pose, triangle, clearance limit, and existing test.
They do not change the game source, models, animations, or build settings.

## Verification

Four added regression tests cover independent batch results, animated refresh, degenerate triangles, and near contacts after an exact crossing.
All eleven geometry unit tests passed.
The full six-character backswing and finish checks also passed with batching alone.
All 25 final affected checks passed in 149.8 seconds on this Mac.
These include the new plane rejection, six-character golf checks, and native combat clearance tests.

A 183-pose Closer sample produced identical complete reports before and after batching.
Its measured duration fell from 22.2 seconds to 4.7 seconds.
The baseline included CPU profiling, so this is directional evidence, not a controlled speed ratio.
A separate 30-pose finish sample also retained an identical complete report after plane rejection.
GitHub timings from the next release will measure the complete workflow improvement.

Evidence is in `/Users/yishan/ninja-golf/artifacts/reviews/release-speed-2026-10-05/`.
The prior GitHub log and step timestamps are in the adjacent `golf-shoulder-2026-10-05/` directory.

## Release practice

1. Complete relevant checks while making each change.
2. At release time, freeze the requested scope and run the affected checks.
3. Push once and let CI run the full suite before deployment.
4. Verify the deployed bundle and changed behavior with sound muted.
5. Record queue time separately from execution time when diagnosing delays.

Do not repeat unchanged expensive checks locally after they have passed.
Do not start unrelated visual adjustments during a publication request.
