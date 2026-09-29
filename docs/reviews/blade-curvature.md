# Curved blade direction

The old blade centerline bent toward the sharpened edge. That made curved swords look like forward hooks.
The corrected centerline bends away from the leading edge. The honed bevel stays on local +X, while the curve extends toward −X.
The straight, double-edged jian keeps its existing shape.

The correction covers the odachi, twin blades, naginata, dao, wakizashi, and smaller enemy blades.
Blade-tip markers now match the corrected geometry, so combat trails follow the actual tips.
The grips, blade lengths, material draws, and triangle counts remain unchanged.

## Shinobi preparation

The corrected left blade initially crossed the Shinobi's head during `Twin_Heavy_Rising` preparation.
A six-degree opening at the left shoulder clears that path. The correction rises and falls smoothly during the first 0.16 seconds.
The wrists, finger grips, impact pose, feet, and all 36 other animation clips remain unchanged.

A 480 Hz scan finds no blade/head crossings across 347 samples, with 12.34 mm minimum clearance.
The native anatomy and skin checks also pass. Both blades remain separate, and the active blade leads with its cutting edge.
All nine Shinobi combat actions pass the actual runtime head-surface scan at 120 Hz.
The Hustler's body, head, and carry-transition checks also pass with the corrected blade.

## Scope of the clearance comparison

The before/after scan covers 45 actual attacks across the five curved-weapon heroes.
Four older Ronin actions already cross the head in the unchanged baseline: diagonal light, rising heavy, slam, and musou.
Those cases have the same number of crossing samples before and after the geometry correction.
Those old animation defects remain separate work. The corrected Shinobi preparation removes the new contact introduced by the blade change.

## Reproduction

Use the Shinobi model and motion records from baseline commit `fe0a7416e519c1e39c073a03249e732e0e676793`.

```sh
node tools/author-shinobi-blade-clearance.mjs \
  --input /tmp/shinobi-baseline.glb \
  --record /tmp/baseline-motion.json \
  --output /tmp/shinobi-candidate.glb \
  --output-record /tmp/shinobi-candidate.json
```

The writer preserves all 36 other clips and 12,221,976 original binary bytes.
The existing native Shinobi head-clearance test rejects the curved blade without this preparation change.
A new geometry test also verifies the curve direction, sharpened edge, and tip-marker alignment for every affected weapon.

## Release checks

All 421 automated tests pass, and the production build succeeds.
The detailed browser grip check passes across 1,055 hand samples. Maximum attachment error is 0.089 mm.
The model writer reproduces the candidate model byte for byte.

The older `browser-blade-frame.mjs` check still fails against its stored Ready/golf transforms and strict attachment tolerances.
Its complete report matches the unchanged `fe0a741` baseline exactly across 19,382 samples. This correction introduces no change to those reported errors.
