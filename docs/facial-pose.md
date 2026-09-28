# Native facial pose

`FacialPose` animates the existing facial bones. It preserves each character's mesh, textures, and identity. It restores the previous overlay before the animation mixer advances.

```js
facialPose.restore();
// Advance the animation mixer and body overlays here.
facialPose.apply(dt, {gazeYaw, gazePitch, exertion, musou, enabled: true});
```

The controller uses the native eye, brow, and lip landmarks to establish anatomical directions. It converts each offset into its bone's parent frame. Eye spacing scales the expression across the six faces. The controller requires those landmarks and the native head bone.

## Expression

Normal exertion opens the jaw by at most one degree. Musou clenches the jaw and lowers the inner brows. Tightened lower lids, raised cheeks, and stretched mouth corners add tension. The upper and lower lips separate to expose the teeth. These are bone-space controls, not measured skin displacements.

Horizontal gaze remains within four degrees. Vertical gaze remains within two degrees. Gaze follows the selection or cinematic camera. The maximum reference inner-brow offset is about seven millimeters; skin weights reduce most surrounding displacement. The Closer narrows her eyes further because her fringe partly hides her brows. The Hustler uses a smaller mouth-corner movement to prevent folded triangles. The Vice President uses a deeper frown. He and The Closer press their lips closer together after Opus identified a surprised or smug reading.

The cinematic also lowers the chin by two degrees while the eyes track the camera. The expression uses the real frame interval during the cinematic. The body animation runs at 15% speed. This separation lets the aggressive expression appear within the first quarter-second.

All expression state uses exponential smoothing. `enabled:false` restores the current animation without adding facial offsets. Golf, dodge, emergence, and death disable the overlay. Enemies do not use it.

## Geometry checks

`tools/audit-facial-pose.mjs` measures the actual skinned head triangles. A 0.75 mm sampling grid compares eye surfaces with the surrounding skin. The check subtracts existing intersections when measuring additional eye penetration.

The audit includes every triangle influenced by the expression bones, including the brows, cheeks, mouth, and jaw. It reports reversed triangles, edge compression, edge stretching, and displacement by facial region.

Very short imported edges can show large stretch ratios after submillimeter movement. The audit reports those ratios and their actual lengths. The regression test separately limits stretching on edges at least one millimeter long.

The accepted geometry limits are:

- No reversed facial triangles.
- Less than 0.5 mm additional eye penetration, including extreme gaze directions.
- At least 95% of the original visible eye aperture, 92% for The Vice President, or 80% for The Closer.
- Less than 1.5 mm movement in the eyelid region.
- No facial edge compressed below half its original length.
- Less than 50% stretching on edges at least one millimeter long.

These checks detect geometry regressions. Visual review still determines whether the expression conveys the intended emotion.

The Vice President's adapted rest eyelids are narrower than the source model. Extreme gaze retains 92.7–94.4% of that aperture. Opus reviewed the rendered eyes and recommended the separate 92% limit. His other geometry limits remain unchanged.

## Verification tools

- `node --test tests/facial-pose.test.js` checks geometry, restoration, and jaw movement.
- `node tests/browser-face-integration.mjs` checks the controller through actual actor updates.
- `node tools/render-expression-study.mjs` captures neutral and Musou faces from two angles.
- `node tests/browser-musou-expression.mjs` captures the real cinematic and verifies its camera, expression timing, and transition into combat.

Review captures remain under `artifacts/expression-review` and `artifacts/musou-review`. The tests use a separate muted browser.

## Blink limitation

The controller does not add automatic blinking. Earlier full-closure experiments folded the existing eyelid skin. A full blink needs separately authored deformation and a new visual review.
