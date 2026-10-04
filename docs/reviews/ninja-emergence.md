# Complete ninja emergence

The old runtime skipped takeoff and switched directly into a floating jump loop. It also cut off landing recovery when the travel path ended.

The replacement uses Quaternius UAL2 NinjaJump_Start, NinjaJump_Idle_Loop, and NinjaJump_Land (CC0). It retains the source crouch, body lean, tuck, arm balance, and recovery. Trees begin with the flight pose. Ground hiding places use the complete takeoff.

A shared clock aligns the landing clip's first sole contact with the end of the existing travel path. The ninja then completes its recovery in place. It cannot move or attack during recovery. Its facing stays fixed through the jump and landing. Landing particles start at contact.

The transfer calibrates the native elbow and knee hinges. It limits ankle twist to 12 degrees. The airborne knee fold reaches 160 degrees. This is a deep tuck, and it has a separate 165-degree test bound. Existing running bounds remain unchanged.

Verification:

- Opus 5.5 High accepted the poses for a gameplay trial. It requested blade and landing checks.
- The actual blade clears the animated torso and legs at 120 Hz. The minimum opening clearance is 0.93 mm. Flight and landing clearance exceeds 50 mm.
- Lit side and rear close-ups show the tucked knees and blade position.
- Eighteen game cases cover six hiding places at 40, 60, and 120 FPS. They check held weapons, finite travel, planted recovery, and delayed attacks.
- Twenty-four runtime cases cover all four roles, forward/backward travel, and three frame rates. Maximum hip twist is 27.4 degrees; ankle twist is 12 degrees.
- The original mesh, skin weights, materials, textures, and prior clips remain unchanged.

The source is already available in the private assets directory. Rebuild with `node tools/transfer-enemy-emergence.mjs --help`.

Private evidence resides in `artifacts/reviews/ninja-emergence` in the primary checkout. The screenshots use muted review browsers. This change does not complete the remaining facial-expression work.

The full local suite passes all 969 tests. The production build also passes exact delivery checks for nine models, two portrait atlases, and ten combat recordings. All six character selections and normal golf-to-combat play pass. The new compressed enemy model adds approximately 271 KB to local network transfer.
