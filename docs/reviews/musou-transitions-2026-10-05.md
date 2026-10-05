# Complete musou transitions — October 5

The isolated full-body review found abrupt joins in five continuous musou sequences.
The existing clock trimmed each clip independently around its impact markers.
It also accelerated movement between impact windows by up to 3.2 times the configured combat speed.
This removed preparation and recovery, then blended unrelated body poses within 100 milliseconds.

The Hustler and Closer exposed another error.
Their ordinary combo clips declare exact continuation points into the next recorded cut.
Musou ignored these points, entered the outgoing recovery, and skipped the incoming preparation.
The result was an abrupt crouch-to-spin transition.

## Correction

Continuous musou now keeps each captured performance at its existing combat speed.
Every segment starts at source time zero.
A declared combo continuation ends the preceding segment at its matching source boundary.
Other joins retain complete preparation and recovery, with each motion's existing entry blend.
Matching combo joins use a short 25-millisecond blend to cover frame sampling differences.
The sequence completes any connected combination before it can end.
The Closer therefore finishes her combo instead of stopping after its opening cut.

Body poses, movement, and damage still use one clock.
No new joint offsets, retargeting, model edits, or limb constraints were required.
The Shinobi retains his existing explicit smoke transitions and timing.
Ordinary light and heavy attacks remain unchanged.

## Evidence

Review files are in `/Users/yishan/ninja-golf/artifacts/reviews/musou-transitions-2026-10-05/`.
`audit.mjs` samples the actual Warrior runtime at 120 updates per second.
`baseline/` contains the original complete sequences and transition sheets.
`complete-source/` contains the corrected sequences and matching review sheets.
The sheets omit combat effects so the body movements remain visible.

Maximum measured pelvis speed within 200 milliseconds of a join:

| Character | Before | After |
| --- | ---: | ---: |
| Ronin | 7.47 m/s | 1.95 m/s |
| Vice President | 3.15 m/s | 1.23 m/s |
| Ace | 7.19 m/s | 1.98 m/s |
| Hustler | 21.82 m/s | 8.79 m/s |
| Closer | 21.92 m/s | 8.59 m/s |

These values include intended travel. They are diagnostic comparisons, not anatomical limits.
The Hustler and Closer still perform their captured advancing spin.
The Ace's maximum head speed at the sampled joins fell from 97.43 to approximately 2.1 metres per second.
The remaining brief preparations and recoveries keep their recorded body movements.

Twenty-six focused unit checks pass.
They cover full source preparation, continuation boundaries, complete combo endings, root travel, and original damage contacts.
The shared timing checks cover 40, 60, and 144 updates per second.
These are correctness checks, not GPU frame-rate measurements.

The gameplay browser check passes thirty immediate-interruption cases and all six complete musou sequences.
Every sampled pose remains finite, with weapons visible and effect storage within its bounds.
The wipe audio passes an offline render with no clipped samples. Automated browsers remain muted.
The build succeeds with the existing bundle-size warning.

The exact private production bundle is `index-BihuKihf.js` at http://127.0.0.1:4185/.
Normal keyboard and mouse input completed selection, golf, combat, Resolve charging, musou, and recovery as the Ace and Closer.
Their sequences delivered nine and ten contact events respectively, with real enemy deaths and no browser errors.
Both runs include muted recordings and sampled state in `production/`.
The first test attempt sent Space before the game mode finished loading.
Its wait condition now requires both game mode and the aim phase. The corrected runs pass.
All automated browsers closed. No public publication occurred.
