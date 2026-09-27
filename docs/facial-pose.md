# Native facial pose

`FacialPose` modifies five native facial bones. It does not change meshes, materials, weights, or animation assets.

```js
import {FacialPose} from './facial-pose.js';
const facialPose = new FacialPose(actor.bones);
// Every frame, before AnimationMixer.update():
facialPose.restore();
// After AnimationMixer.update() and other body overlays:
facialPose.apply(dt, {
  gazeYaw,   // Radians; positive toward the character's left.
  gazePitch, // Radians; positive upward.
  exertion,  // 0–1, from movement or attack effort.
  musou,     // 0–1, from the active special attack.
  enabled: true,
});
```

Call `restore()` before exact-pose tests, death handling, and object disposal. Setting `enabled:false` restores transforms and applies no deformation. Missing bones are safe. The class captures each frame's mixer output before applying offsets. It never accumulates previous offsets. Inputs use exponential smoothing; long frames clamp the smoothing interval to 100 ms. The frame methods reuse cached vectors and quaternions.

Limits are shared across the six validated identities:

- Horizontal gaze: ±4 degrees.
- Vertical gaze: ±2 degrees.
- Jaw opening: 1 degree at full exertion, reduced to 0.4 degrees during full Musou.
- Inner brow lowering: 0.3 mm during full Musou.

No random facial offsets or automatic state guesses are included. Eye bones also influence some surrounding skin and eyelashes. Conservative angles limit that secondary deformation.

## Eyelid limitation

No blink is implemented. Small lid translations do not close these eyes. Full closure with the tested translation path folds the existing skin.

The CPU audit projects the actual skinned head triangles along the face's forward axis. It classifies eye triangles by dominant eye-bone weights. A 0.75 mm grid measures visible eye surface against the head surface. These measurements test geometric aperture, not texture transparency or eyelash coverage.

Both upper lids translate along bone-local +Y. Both lower lids translate along -Y by one quarter of the upper movement. Each avatar is measured independently.

| Avatar | Aperture remaining at 2 mm | Aperture remaining at 10 mm | Reversed triangles at 15 mm closure | Maximum edge stretch at closure |
|---|---:|---:|---:|---:|
| Ronin | 79% | 5% | 10 | 16.0× |
| Shinobi | 83% | 14% | 10 | 5.3× |
| Monk | 83% | 16% | 10 | 12.5× |
| Kaede | 81% | 10% | 18 | 15.7× |
| Ayame | 81% | 6% | 7 | 9.7× |
| Sora | 84% | 16% | 10 | 8.4× |

The 15 mm pose closes the sampled aperture for every avatar. It fails the triangle-orientation and stretch checks. Some avatars already reverse triangles at 5–10 mm. This rejects this translation path; it does not prove every possible rig edit is impossible. A real blink needs separately authored eyelid deformation, revised weights, and rendered closure validation.

Run `node tools/audit-facial-pose.mjs` to regenerate `/tmp/facial-pose-audit.json`. The audit also reports added eye-surface penetration and actual weighted vertex displacement. Baseline geometric intersections are subtracted; these are comparative clearance checks, not a claim of perfect anatomical topology.

Run `node --test tests/facial-pose.test.js` for all-six geometry checks, all gaze corners, exact restoration, and actual jaw vertex movement. The accepted pose permits no reversed eyelid triangles, less than 0.5 mm additional eye penetration, and less than 1.5 mm lid-region vertex movement.

## Render verification

`tests/browser-facial-pose.mjs` captures all six from front and side. It compares rest, gaze, and effort under neutral light. It also captures effort under actual selection and Japanese course lights. The course lighting matches ordinary combat lighting; this check does not trigger a full Musou sequence.

The 60 captures completed without browser errors. Eye surfaces stay inside the sockets. Jaw and brow changes stay subtle, with no visible skin folds or new lash gaps. Review sheets are `/tmp/ninja-face-pose-front-sheet.jpg` and `/tmp/ninja-face-pose-side-sheet.jpg`. Additional gaze and lighting sheets use `/tmp/ninja-face-pose-{front,side}-gaze-neutral-sheet.jpg` and `/tmp/ninja-face-pose-front-effort-{selection,course}-sheet.jpg`.

## Actor integration

Native heroes own `actor.facialPose`; enemies do not. Actor updates restore the previous facial overlay before the mixer runs. Golf, dodge, emergence, and death disable facial offsets. Movement and attacks supply exertion; cinematic and Musou attack states supply the brow response.

Selection and cinematic updates accept a world-space `gazeTarget`. Convert its direction into the unmodified right-eye frame before applying the overlay. Local +X points forward. Use `atan2(local.z,local.x)` for yaw and `atan2(-local.y,hypot(local.x,local.z))` for pitch.

`tests/browser-face-integration.mjs` exercises actual actor updates against control actors without the overlay. The initial all-six run achieved target error below 0.000001 radians. Golf, dodge, and death restored exact control transforms. Three-second gaze runs stayed bounded; all four enemy classes had no overlay. Emergence and the explicit Musou attack branch are included for the full-suite run. The isolated capture script disables the actor overlay before adding its own instance, preventing double application.
