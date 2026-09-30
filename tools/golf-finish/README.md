# Reviewed Ace golf finish

`ace-rotations.json.gz` contains eleven native rotation channels for `Golf_Swing`.
The channels change the finish after 1.68 seconds. They retain the 2.4-second clip duration.
They do not change the geometry, finger profiles, club frame, lower body, address, or impact.

Rebuild from the reviewed source:

```sh
git show 6e7150a:public/models/kaede.glb > /tmp/ace-before-finish.glb
node tools/bake-golf-finish.mjs --input /tmp/ace-before-finish.glb --output /tmp/ace-finish.glb
```

The builder verifies the source SHA-256 and appends only the reviewed channels.
It rejects existing output files and output inside `public/`.
It does not install a candidate or alter another character.

## Reference and fitting

The late hand and elbow targets started from CMU subject 64, trial 64_01, frame 409.
The source uses a right-handed swing. The game uses a left-handed swing, with native `r` as the lead arm.
The target was mirrored and normalized by the native shoulder-to-wrist length.
The source capture has no club, reliable finger tracking, or independent scapula motion.
It supplies a pose reference, not a complete golf rig.

Both palms share one rigid club frame and their existing grip spacing.
The fitting pass adjusts that frame, clavicle rotations, and elbow bend planes together.
The native hinge calibration determines elbow flexion and forearm twist.
The fitting penalties preserve the existing wrist and arm limits.
A shaft/head proxy helps fitting; the independent regression checks the complete deformed head and limb surfaces.

The reference finish blends in from 1.68 to 2.24 seconds.
The chest opens another 20 degrees across `spine_02` and `spine_03` during that interval.
The head retains its world rotation to follow the shot.
On this skeleton, both clavicles descend from `neck_01`; counter-turning that bone would also counter-turn the arms.
The correction therefore acts on `Head`.

The final fitting pass lowers the shaft slightly and preserves both palm frames.
The saved curves contain the reviewed result, including the continuous paired-hand fit.
Replaying these curves requires no optimization during play.

See [the review](../../docs/reviews/ace-golf-finish.md) for results and remaining grip limitations.
