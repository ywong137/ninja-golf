# Relaxed character selection poses

The selection screen has its own animation clips. Combat Ready, attacks, guards,
locomotion, and golf retain their existing tracks.

## Reference study

Reviewed the full-body artwork on the official Samurai Warriors 5 site:

- [Nobunaga Oda](https://www.koeitecmoamerica.com/sw5/character/character00.html):
  an asymmetric stance supports a relaxed weapon carry. The face stays clear.
- [Takakage Kobayakawa](https://www.koeitecmoamerica.com/sw5/character/character24.html):
  an upright torso and an offset foot produce a resting silhouette.
- [Kanbei Kuroda](https://www.koeitecmoamerica.com/sw5/character/character18.html):
  the lowered arm follows the torso without a raised shoulder.
- [Sena](https://www.koeitecmoamerica.com/sw5/character/character20.html):
  a small hip shift and unequal arm positions give the standing pose personality.

These images inform joint positions and silhouette. They do not expose the game's
bone hierarchy, joint rotations, skin weights, or animation data. The game uses
its licensed Rocketbox human skeletons and original pose data. It does not copy
Koei Tecmo models or artwork.

[Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) also supplies
characters and animations for games. Adobe requires an Adobe ID. No Mixamo asset
is included in this change.

## Pose construction

Each pose places the pelvis slightly toward one supporting leg. The other foot
sits slightly ahead or behind it. Both feet stay planted through the idle loop.
The chest stays upright, and the shoulders stay low. The native bake calculates
pelvis height from both leg lengths and the fixed ankle positions. It targets
10–12 degrees of flex in the straighter knee without locking the joint.

The weapon hand sits below the chest and outside the torso. Native wrist targets
use each character's shoulder position and arm length. The elbow guides sit below
the shoulders. This keeps the upper arms close to the body. The free hand rests beside
the body. The Shinobi holds a sword in each hand. The Monk holds his polearm at
his side. The Ronin and Kaede carry upright blades near their bodies. Ayame and
Sora point their blades diagonally down, away from their legs and faces.

## Build

```sh
python3 tools/author-selection-motion.py
blender --background --python tools/build-authored-motion.py -- --selection-only
blender --background --python tools/build-rocketbox-warriors.py -- --selection-only
```

The source records live in `src/selection-data.json`. The source skeleton lives
in `public/models/selection-motion.glb`. Each hero receives only their own native
selection clip. A full roster rebuild retains these clips too.

## Review

The user's visual review rejected the original poses except the Monk's selection
pose. Passing the joint checks did not establish natural posture.

A fresh GPT-6 Sol review found disconnected body gestures and unclear weight
distribution. The Ronin pilot now places his weight on the right leg and softens
the left knee. His pelvis tilts slightly, with a small opposing torso adjustment.
His free arm hangs farther down, and his chin sits lower. The sword stays upright
and close to his body.

The independent reviewer rejected the first pilot's rigid chest and backward
free elbow. The third version passed its front, side, and three-quarter visual
review, followed by review at the actual selection camera. This acceptance covers
the Ronin's static body pose only. The subsequent user review rejected its hand
grip. An Opus 5.5 review identified the copied jogging fist and the joint-based
handle anchor as causes. The fitted replacement now uses the actual hand skin.

The Shinobi, Kaede, Ayame, and Sora also received resting poses based on separate
support-leg, wrist, and elbow targets. The Monk retains his accepted body pose.
These selection changes do not establish the quality of the combat motions.

Review each character from the front and side. Check the whole figure and both
hands. Verify relaxed shoulders, supported feet, comfortable wrists, and a clear
face. Numeric joint checks support this review; they do not establish visual
quality by themselves.

The final native checks sample all six poses at 120 Hz. They find no forearm
crossings through the torso and no upper-arm skin folds. The straighter knee
stays near 10–12 degrees; the other stays below 20 degrees. Weighted shoe surfaces
stay within 2.4 mm of the floor.

The selection browser checks cover attachment, selection-to-golf transitions,
and portrait framing at 1280×720, 1440×900, and 1920×1080. The former mean-finger
distance check did not establish a correct grip. `browser-grips.mjs` now samples
the actual hand skin against the handle during selection, combat, golf, and
transitions. See [the grip implementation and review](character-grips.md).
