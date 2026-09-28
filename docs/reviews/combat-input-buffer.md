# Early combo input

Date: 2026-09-28.

The fixed 0.55-second attack buffer dropped early follow-up presses during longer animations. Ethan's first light attack lasts 0.60 seconds. His heavier attacks take longer. A quick second click could expire before the current attack finished.

The buffer now keeps one follow-up through normal attack recovery, with 0.05 seconds of frame tolerance. The latest light or heavy input replaces that choice. The next attack starts only after the current attack finishes.

Dodge and encounter cleanup still cancel the choice. Musou keeps its existing 0.55-second window, so an early press cannot cause an unexpected attack several seconds later.

The software-rendered browser check uses the actual combat loop. It verifies all 24 light/heavy combinations across six heroes. It also verifies replacement, dodge cancellation, the absence of extra attacks, and both early and late Musou input.

Restoring the old expiry makes the regression fail on Ethan’s first light-to-light combination. The follow-up disappears after his 0.60-second attack.

The production build passes. No animation durations or hit times change.
