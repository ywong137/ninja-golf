# Whole encounter review — October 5

This review checks movement during encounters after the shared stance, golf shoulder, and selection fixes.
The captures use real mouse and keyboard input, with browser audio muted.
Each character faces 24 ninjas with normal health, damage, and combat behavior.
The fixture places that crowd around the character and fills Resolve to test the musou interrupt.
It does not represent a complete round or normal enemy emergence.

All six characters complete light attacks, a heavy attack, reversal, dodge, advance, musou interruption, and subsequent running.
All six reports contain no browser errors. The actions finish and return control to the player.
The Shinobi's normal heavy attack retains its complete captured motion. His separate musou retains intentional shadow transitions.
The three men's recordings precede the pursuit change. The three women's recordings include it.

## Pursuit spacing

The recordings expose a shared crowd problem.
When the player exceeds three metres per second, every nearby enemy abandons its waiting lane and intercepts the player.
The crowd then hides the player's whole body during reversals and cinematic entries.

Nearby waiting melee enemies now retain their lanes while the player runs.
Committed attackers keep their interception behavior. Distant pursuit and ranged behavior remain unchanged.
This is a shared target-selection correction. It changes no animation clip or character rig.

A controlled 21-enemy comparison isolates waiting pursuit behavior with attacks disabled.
Before the change, retreat brings seven waiting enemies within three metres of the player.
The subsequent reversal brings sixteen within that radius, including five within 1.2 metres.
After the change, those same stages bring no waiting enemies within three metres.
These counts measure this scenario, not every possible crowd arrangement or terrain.

## Verification

Seven focused unit tests pass, including moving and reversing pursuit across the previous speed threshold.
The existing browser spacing test passes after updating its obsolete enemy appearance fixture.
It verifies stationary spacing, pursuit, and normal attackers in the same scene.
Twelve waiting enemies spread into four sectors and settle without continuous orbiting.
Nine attacks occur after the test releases their cooldowns. No more than three melee attackers act together.
The subsequent 144-frame pursuit sequence has no waiting enemy within three metres of the player.

The production build succeeds as `index-l6VnqGM5.js`, with the existing large-chunk warning.
The exact production bundle passes normal selection, a golf shot, and a mouse-triggered heavy attack as the Ace.
Her correct two-contact clip completes and returns control without browser errors.
The selection screenshot shows the lower guard and both feet at the surface.
All automated review browsers have closed. The private server remains at http://127.0.0.1:4185/.
Evidence, muted recordings, and the exact comparison scripts remain in the primary workspace:
`/Users/yishan/ninja-golf/artifacts/reviews/encounter-body-2026-10-05/`.

The first recording failed because its completion predicate required a falsy cinematic timer.
The game allows a small negative timer after the intro. This was a test error, not an animation lockup.
The fixture now checks whether the cinematic is positive and saves reports on failure.

## Remaining scope

This pass does not establish AAA quality, distinct movesets for every character, or perfect anatomy on every frame.
The earlier movement reports contain the six-character stance and shoulder evidence.
Whole encounters remain necessary: isolated pose checks did not reveal the pursuit collapse.
No public files were published.
