# Native two-handed transitions

Date: 2026-09-28.

The grip solver previously changed native arm poses during an animation fade. It aimed the two arm segments independently. This could move the elbow away from its native hinge.

The runtime now preserves an authored pair when both clips use the same palm stations. The weapon follows the blended palms. The correction does not change either authored arm.

## Scope

Both clips must declare `nativeAttachment`, `pairedGrip`, and `twoHanded`. Their positive palm spacing and effective primary station must match. The character must already have both hands engaged.

Running, carry overlays, guard walking, golf, and offhand weapons do not qualify. An unfinished earlier fade also prevents this path. The decision belongs to the temporary `heldBlend` state. It does not introduce another motion-data flag.

The shipping Ethan Ready, attack, and stationary guard clips qualify. His legacy walking guards do not qualify. The other shipping heroes retain their existing behavior.

## Checks

The browser regression covers 138 cases and samples Ethan's native transitions at 60 and 240 Hz. It includes attack recovery, repeated attacks, stationary guards, and two idle phases. It verifies that the grip stage preserves all six arm rotations. Seven incompatible origins verify the exclusions.

Removing the new branch makes the regression fail. Ready-to-Diagonal then receives an extra 0.001332-radian arm correction.

An independent 480 Hz check covers 30 normal Ethan and candidate Ronin fades. It finds no secondary IK calls. Maximum per-hand spacing errors are 1.282 mm for Ethan and 1.063 mm for the Ronin candidate.

The existing 90-case carry transition test passes at 60, 120, and 240 Hz. Golf paths and attack contact paths remain unchanged. The rendered-hand regression passes 1,055 samples. Its maximum sampled vertex penetration is 1.98 mm.

These contact measurements have different scopes. A separate triangle-surface check finds an existing 2.715 mm Ethan contact at a palm/web triangle. The new Return fade does not increase it. Guard-to-Diagonal changes its measured maximum from 2.721 to 2.744 mm. Independent close-ups show no new visible Ethan grip defect. These small existing contacts still need future hand-fit work.

Actual muted gameplay selected `Ethan_Naginata_Cut_Return`. It held 59.81 FPS with 34–51 enemies and no browser errors at 1440×900. Evidence remains in `artifacts/native-paired-transitions/`.

## Ronin candidate boundary

The new Ronin clips remain outside the public models. Their authoring records now correctly identify Ready and Heavy Cleave as native pairs.

Center spacing alone does not certify their transitions. During the standard 0.07-second entry fade, Ronin's support palm tilts 5.126 degrees from the shaft. Actual left pinky-pad triangles intrude up to 4.617 mm. The underlying single clips pass their checks, but this fade does not.

Do not release the candidate family until its transition surface contact passes. Do not restore the legacy elbow solve to hide this contact error.
