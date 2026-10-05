# Enemy hit reactions

Surviving enemies previously lost their attack state without playing a reaction.
They could immediately run again while knockback moved them away.
The model already contained the recorded `Hit_Chest` animation, but combat never selected it.

Clean surviving hits now play that complete 0.33-second recoil.
Successful parries use the same recoil.
The existing animation crossfade supports repeated hits without rewinding the displayed pose.
The enemy pauses its movement until the recoil finishes.
Longer existing stuns remain unchanged.
Armored light blocks keep their current response.
Fatal strikes still select the existing death animation.
The procedural idle torso overlay does not modify the recorded recoil.

No model, texture, purchased animation, damage value, or effect asset changes.
The source recoil is a chest reaction, not a full set of directional impact captures.

## Verification

- Twenty-two focused combat, guard, appearance, and skeleton checks pass.
- Twelve browser cases cover four roles at 40, 60, and 144 Hz.
- Additional cases cover armor blocks, repeated hits, interrupted attacks, fatal hits, and parries.
- Five before/after views show the actual enemy response.
- Forty-one source samples retain positive knee flexion: approximately 13–29 degrees.
- The lowest source mesh points remain within 23 mm of the same ground plane.
- All browser playback stayed muted.

The first baseline fixture used a guarded light hit against the armored role.
Its three unarmored cases prove the missing response directly.
The corrected installed fixture uses an unguarded heavy strike for that armored role.

The serial crowd benchmark measured 50.10 FPS before and 50.39 FPS after.
Both runs used 64 enemies, 1440 × 900, rendering ratio 1, and Chrome Metal on this M1 Max.
Both 95th-percentile frame times were 33.4 ms.
This indicates no observed regression in those runs, not a proven speed improvement.

The built game passes normal golf-to-combat input and mouse attacks.
Its read-only diagnostics confirm surviving enemies enter recoil after an actual light attack.
The loaded JavaScript and CSS match the release build hashes.
No browser errors occurred.
