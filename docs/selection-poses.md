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
12 degrees of flex in the straighter knee without locking the joint.

The weapon hand sits below the chest and outside the torso. Native wrist targets
use each character's shoulder position and arm length. The elbow guides sit below
the shoulders. This keeps the upper arms close to the body. The free hand rests beside
the body. The Shinobi holds a sword in each hand. The Monk holds his polearm at
his side. The other blades point diagonally down, away from the legs and face.

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

Review each character from the front and side. Check the whole figure and both
hands. Verify relaxed shoulders, supported feet, comfortable wrists, and a clear
face. Numeric joint checks support this review; they do not establish visual
quality by themselves.

The final native checks sample all six poses at 120 Hz. They find no forearm
crossings through the torso and no upper-arm skin folds. The straighter knee
stays near 12 degrees; the other stays below 20 degrees. Weighted shoe surfaces
stay within 2.4 mm of the floor.

Browser checks cover all six grips, selection-to-golf transitions, and portrait
framing at 1280×720, 1440×900, and 1920×1080. A binary comparison confirms that
all 216 earlier animation clips and the existing model data remain unchanged.
