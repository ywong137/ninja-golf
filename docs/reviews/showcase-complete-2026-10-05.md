# Complete combat inspection — October 5

Selection previously showed only the opening light and heavy attacks. That hid later combo movements from the user’s review.

The automatic preview now plays the complete light combo. The C panel also offers individual light attacks, follow-up heavy attacks, and the complete musou attack.
Inspection supports scrubbing, frame steps, 0.1–1.0 speed, pause, and replay. Individual inspections hold their final pose.
Gameplay and previews now share attack construction, contact timing, root travel, and musou sequence definitions.
Connected combos use their authored transition times. The Shinobi keeps his intentional smoke transitions.
Preview bounds include every listed motion and fail immediately on invalid geometry.

The user stopped the visor work and authorized removal. The Ace’s model now excludes the visor primitive.
Her body, clothing, skin weights, and animation data remain unchanged.
Removal also eliminates a malformed visor morph target, whose vertex count did not match the replacement geometry.
That defect produced invalid vertices when the musou expression activated. It caused the first bounds bake to fail.

Validation:
- 41 focused unit checks pass, including all six model bounds.
- 250 sampled attack poses match gameplay across all six characters.
- Maximum sampled major-joint rotation difference: 0.000107 radians.
- Normal selection controls, scrubbing, retained speed, and complete loops pass at 60 and 120 updates per second.
- Ten selection layouts and all four course backgrounds keep the full motion bounds visible.
- The exact private build passes normal selection, golf, and a heavy attack without browser errors.
- Build succeeds as `index-ShrUngiB.js`. Its existing large-bundle warning remains.

Evidence: `/Users/yishan/ninja-golf/artifacts/reviews/showcase-complete-2026-10-05/` and `artifacts/reviews/golf-body-2026-10-05/`.
The build stays private. All browser checks mute audio.

Continue with large attack movements and the shared golf shoulder problem. Do not resume visor fitting.
