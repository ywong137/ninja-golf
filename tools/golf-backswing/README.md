# Reviewed golf backswings

Each compressed file contains eight native rotation channels for one character's `Golf_Swing`.
The correction acts between 0.58 and 1.38 seconds. It preserves the address, impact, and accepted finish.
Native `r` leads and native `l` trails in this left-handed swing.

Rebuild a candidate from the published source:

```sh
git show ce08de7:public/models/ronin.glb > /tmp/ronin-before-backswing.glb
node tools/bake-golf-backswing.mjs --hero ronin --input /tmp/ronin-before-backswing.glb --output /tmp/ronin-backswing.glb
```

Repeat with `shinobi`, `monk`, `kaede`, `ayame`, or `sora`.
The builder checks the source and output SHA-256 values.
It rejects an existing output or any output inside `public/`.
It appends the reviewed channels without changing geometry, skin weights, other clips, or other bone channels.
No fitting runs during gameplay.

## Reference and constraints

The fitting reference is CMU subject 64, trial 64_01.
Frames 180, 240, 257, 290, 310, and 330 guide the hand center and elbow bend planes.
The frame schedule spans game times 0.58, 0.95, 1.05, 1.15, 1.24, and 1.38 seconds.
Frame 257 supplies the top pose.
The source swing is mirrored, expressed relative to the chest, and scaled by each character's arm reach.
The source has no tracked club, fingers, or independent scapula motion.
It supplies one human motion reference, not a complete golf rig or an ideal professional swing.

Both hands retain their existing grip frames and spacing on one rigid club frame.
The fitting pass adjusts that frame, the clavicles, and elbow bend planes together.
Native hinge calibration determines the elbow direction and limits wrist flexion and arm rotation.
Elbow guides interpolate through rotation of the bend plane to avoid passing through a straight-arm singularity.
The fit uses a uniform 120 Hz schedule. A 24 ms Gaussian filter smooths the arms through the corrected window.
The filter fades in between 0.58 and 0.70 seconds, then fades out between 1.26 and 1.38 seconds.
Additional midpoint fits restore both complete palm frames after smoothing.
The published curves outside the correction window supply both boundary poses.

The lead arm bends about 18 degrees at the top for five heroes, and 25 degrees for the Vice President.
The Vice President uses an 80-degree trail-elbow fold to accommodate his loose sleeve.
His trail forearm twist stays near 44 degrees at the top.
A small clavicle adjustment retains the 80-degree elbow limit after filtering, with both wrist frames fixed.
His rising upper-arm roll progresses smoothly, without the previous reversal.
The Closer has a smooth 9.17-degree trail-clavicle correction between 0.80 and 1.20 seconds.
Her wrist position and complete hand orientation remain fixed during that correction.
This removes a hood-to-hair crossing without changing skin weights.

The saved curves contain the reviewed result of these fitting passes.
They reproduce the exact assets without rerunning numerical optimization.
See [the lead-arm review](../../docs/reviews/golf-lead-arm.md) for current evidence and remaining limitations.
The [earlier review](../../docs/reviews/golf-backswing.md) records the first backswing correction.
