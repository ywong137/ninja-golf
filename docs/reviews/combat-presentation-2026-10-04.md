# Combat presentation review — 2026-10-04

This pass addresses costume clipping, enemy motion and appearance, musou presentation, and impact audio and effects.

## Changes

- Hanging costume panels use thigh collision constraints after skin deformation. The constraint follows each thigh through raised knees. Lining, fabric, and piping retain separate clearances. The depth and shadow passes use the same offsets.
- All four enemy roles use masked cloth ninjas. Four dark palettes combine with four restrained trim colors for each course.
- Three sword attacks and the star throw adapt complete Quaternius UAL2 performances. The export retains anatomical knee and elbow hinges. Extracted planar travel moves the collision body through terrain checks.
- A fixed grip calibration aligns the cutting edge with each enemy stroke. Damage timing follows the source strokes. Weighted cutting-edge alignment around contact measured 0.874, 0.983, and 0.979 for the three sword roles.
- Musou uses six dedicated angry portrait textures. The sequence starts with an angled eye strip, then reveals the face with ink rays and large attack lettering. These are portrait textures over the existing live cutaway, not new 3D facial maps.
- Eleven CC0 recordings replace synthetic sword and impact tones. Swishes, clashes, body impacts, and heavier crunch layers use bounded voices and compression.
- Impacts produce local flashes, red droplets, and bright velocity-aligned spark streaks. Two fixed pools bound particle costs. The effects clear on return to golf.

## Verification

The muted production browser check passed all six selections, a real shot, running, and combat. All nine loaded models and the JavaScript bundle matched the local build hashes.

The browser presentation check verified actual heavy-attack impacts, recovery to Run_Forward, all six portrait atlas cells, large titles, and effect cleanup. It decoded all eleven recordings without speakers. The rendered heavy-impact mix peaked at 0.686, below clipping.

Cloth review sheets cover Ethan, The Ronin, The Hustler, and The Closer through ready, golf, attack, and running poses. A rejected early cloth version collapsed the lining and fabric together. Separate layer clearances corrected that defect.

The added unit checks cover rotated thigh constraints, fabric separation, bounded particle pools, guarded impacts, all four ninja knee hinges, and frame-rate-independent attack travel. Focused motion and character checks pass.

A 64-enemy moving-combat test in a dense Crane Coast grove averaged 52.90 FPS. It used Chrome Metal on this M1 Max at 1440×900, Balanced, render ratio 1. The 95th-percentile frame interval was 33.4 ms. This is one demanding local case, not a guarantee for other hardware.

## Sources and limits

Combat recordings: StarNinjas Sword sounds on OpenGameArt, and Kenney Impact Sounds. Both use CC0. Exact names and URLs are in public/audio/combat/CREDITS.md.

Enemy motion: Quaternius Universal Animation Library 2, CC0. Sword_Regular_A, A_Rec, B, B_Rec, C, and OverhandThrow. Existing body geometry, weights, locomotion, and jump clips remain intact.

Musou decoration references SW5 storyboard frames from https://www.youtube.com/watch?v=IkA8oEUrSX8. No game artwork was copied into the release. The expression artwork derives from the current project characters and authorized references.

Cloth uses a lightweight collision constraint, not a full fabric simulation. The game remains an alpha. Broader visual quality still needs human gameplay review.

Local evidence: artifacts/reviews/combat-presentation/ in the primary workspace.
