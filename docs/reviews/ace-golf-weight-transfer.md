# Ace golf stance and release

The Ace now extends the lead leg before impact and stands taller through the finish.
The pelvis moves over the lead shoe. Both hands keep their fitted position and orientation around the same club shaft.

This change affects only the Ace's `Golf_Swing` clip. The other five characters retain their previous golf clips.
Ronin and Vice President candidates failed separate leg checks. They remain outside the release.

| Native measurement | Previous | Revised |
| --- | ---: | ---: |
| Lead knee flexion at impact | 54.5° | 30.4° |
| Lead knee flexion at release, 1.50 s | 44.7° | 24.3° |
| Lead knee flexion at finish | 37.3° | 12.1° |
| Lead hip lateral distance from ankle at impact | 8.1 cm | 3.5 cm |
| Pelvis height at impact | 79.7 cm | 86.1 cm |

The torso distributes its adjustment across three bones. The head retains its original orientation until after impact.
Both hands follow one rigid frame during the release. The elbow solver preserves positive flexion near full extension.
Keeping slight elbow flexion prevents unstable rotation around an almost straight arm.

The lead shoe pivots 35 degrees, starting at the existing 1.42-second contact boundary.
The rear shoe turns farther with the body. Its actual skin surface determines ground support.
The knee solver uses the flat shoe's heading. Projecting the downward ankle-to-toe segment can reverse that heading during a high heel lift.

The fit runs offline. It adds no runtime search, bones, materials, or draw calls.
The export retains the original binary payload, geometry, textures, and 36 unrelated animations, including address, putting, and combat.

The dense arm test examines 6,607 samples across the three golf clips.
The largest measured hand separation is 0.125 mm. The existing acceptance limit remains 0.2 mm.
The arm and torso surface checks find no new intersections. The central leg surfaces retain at least 33 mm clearance.
The finish check examines 802 samples against the actual head, jaw, eye, and hair surfaces.
Both complete upper arms and forearms retain at least 5 mm clearance in that window.

The new posture regression rejects the preceding published swing. It checks lead-leg extension and support through impact, release, and finish.
The existing joint, grip, surface, and foot-contact limits remain unchanged.
The foot regression expects the Ace's new 35-degree pivot. It retains the other characters' 25-degree pivots.

Actual Claude Opus 5.5 High compared matching front and side views of the preceding candidate.
It found a modest improvement in posture height and no definite visible anatomical blocker in those frames.
It did not verify the numerical reports. The local tests independently verify those reports.
The final candidate restores the original lead-foot contact timing and passes the same checks.
Still images cannot establish complete animation quality. The high backswing, impact shaft angle, and finish arm position need further artistic review.

An earlier review received a baseline sheet with different timestamps. The second review used matching timestamps and corrected that comparison.
The reviewer also questioned arm bounds that had already passed before the grip assertion. The review record explains the actual test order and limits.

Extract `public/models/kaede.glb` from commit `4ddf88a` before rebuilding. The author rejects a changed source hash.

```sh
node tools/art-candidates/golf-weight-transfer.mjs \
  --hero kaede --source /tmp/kaede-source.glb \
  --output /tmp/ace-golf-candidate
```

The default export includes the original keys and a 480 Hz sampling grid.
The author writes candidates under `/tmp`; it cannot replace production assets directly.
Other model options remain experimental and require their own validation and review.

Local evidence lives in `artifacts/reviews/ace-golf-weight-transfer/`.
It includes source comparisons, matched images, rejected-candidate reports, both Opus reviews, and release validation.

All 510 tests pass in an isolated copy containing only the release changes. The production build succeeds.
The browser checks pass 108 terrain and frame-rate cases, 150 golf phases, all eight clubs, and all six selection loops.
The production motion projection retains identical transforms and rendered pixels across 2,394 comparison samples.
The reported combat pose also passes its existing runtime check at 40, 60, and 120 FPS.
