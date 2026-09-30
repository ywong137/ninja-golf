# Reviewed golf finishes

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

## Remaining roster

The Ronin, Shinobi, Vice President, Hustler, and Closer now use individual finish fits.
Their files are `<model>-rotations.json.gz`. Each file contains eleven rotation channels.
Use each model from commit `9d04ee3` as its source:

```sh
git show 9d04ee3:public/models/ronin.glb > /tmp/ronin-before-finish.glb
node tools/bake-golf-finish.mjs --hero ronin --input /tmp/ronin-before-finish.glb --output /tmp/ronin-finish.glb
```

These files include source and output hashes. The builder checks both.
They preserve all other channels and the complete source binary payload.
Geometry, skin weights, finger profiles, lower-body movement, address, and impact remain unchanged.

Each fit uses the accepted Ace finish as a pose reference.
It transfers the club frame relative to the chest and scales the reach for each skeleton.
The palm frames and grip spacing come from that character's existing grip profile.
The fitting pass solves both arms together against the native elbow calibration.
It adjusts the clavicles, elbow bend planes, and shared club frame.
The transition bounds grow smoothly after 1.68 seconds, preventing an immediate elbow adjustment.
Forearm rotation starts from the existing pose and gradually approaches the fitted finish.
The chest turns another 20 degrees; the head keeps its original world rotation.

The saved curves replay the reviewed results without a runtime solver.
Each asset grows by about 262 KB. See [the roster review](../../docs/reviews/roster-golf-finish.md).

The Ronin and Vice President also use shallower lead-elbow folds to preserve their thicker sleeves.
The final assets pass the existing sleeve constraints without changing skin weights or collision tolerances.

The Vice President completes the new fold at 2.18 seconds to reduce late club travel.
