# Ronin guard-break body reaction

V6 adds a small body compression to the reviewed V5 guard break. This remains a candidate outside the public game.

The pelvis moves 40 mm down and 45 mm back from its starting position.
Both knees bend while the feet retain their original positions and rotations.
The reaction reaches its low point at 0.10 seconds, holds until 0.16 seconds, then recovers by 0.40 seconds.

The source pelvis previously rose during impact. V6 cancels that rise before adding the compression.
The source-relative correction therefore exceeds the displacement from the starting pose. The reports label these measurements separately.

## Preservation and measurements

Only seven guard-break channels change: pelvis translation and both thigh, calf, and foot rotations.
All 36 other clips and the remaining 233 guard-break channels remain byte-identical.
The upper-body recoil, finger closure, and native arm joints remain unchanged.

The independent 480 Hz check reports:

| Measurement | Maximum |
| --- | ---: |
| Foot or toe displacement from the source path | 0.03331 mm |
| Foot rotation difference | 0.00224° |
| Leg length difference | 0.000073 mm |
| Body rotation per 120 Hz interval | 1.653° |
| Boundary position difference | 0.00087 mm |
| Boundary rotation difference | 0.000175° |

The right knee gains 10.17° of flexion from the start. The left gains 13.80°.
Neither knee collapses inward. The source-relative maximum increases are 26.12° and 28.01° because V5 straightened its knees during impact.
The existing guard checks pass. Wrist deviation remains below 13.41°, and the paired-grip residual stays below 0.00012 mm.
The blade clears the skinned body by at least the scanner's 30 mm reporting limit.

## Visual review

Actual Claude Opus 5.5 at High accepted the six sampled V6 poses.
The returned `modelUsage` confirms `claude-opus-5-5`, with no permission denials.
It found visible knee compression, a supported torso, planted feet, and no new posture defect.
It did not review video playback or certify the complete animation family.

An isolated, muted capture exercises the real `Warrior.update` sequence:
guard loop, impact, guard break, Ready, side movement, then guard loop.
Front and side views show the same actor at normal animation speed.
Extracted frames confirm the body reaction and recovery. They do not establish how fluid the video feels to a player.

The source still ends with the pelvis 25 mm above its initial position.
V6 deliberately preserves this endpoint. Transition checks remain necessary before release.

## Reproduction

Run the V5 transfer and diagonal steps in `tools/ronin-candidates/README.md` first.
Use the diagonal output before applying any guard reaction:

```sh
node tools/ronin-candidates/author-guard-reactions.mjs \
  --input /tmp/ronin-diagonal-body.glb \
  --output /tmp/ronin-family-v6.glb \
  --record /tmp/ronin-family-v6-guards.json --break-body

node tools/ronin-candidates/check-guard-break.mjs \
  --before /tmp/ronin-family-pilot.glb \
  --model /tmp/ronin-family-v6.glb \
  --output /tmp/ronin-guard-break-v6-check.json
```

The verified V6 model SHA-256 is `4f63a8d914d0be796a27f664e625528da39a96ede2bb007201a8c83b265b4ed7`.
Omitting `--break-body` preserves the earlier V5 output exactly.
Private measurements, review responses, and the runtime capture remain in `artifacts/ronin-guard-break-v6/`.
