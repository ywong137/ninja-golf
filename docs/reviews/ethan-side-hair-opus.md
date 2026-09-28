# Ethan side-only hair review

The final candidate adds modest hair volume above and just behind the ear.
It preserves the original face, ears, eyes, body, rig and animation data.
It leaves the top height and reviewed front left silhouette unchanged.
It adds no rear offset.

## External review

- Model: `claude-opus-5-5`, verified from `modelUsage`.
- Effort: High.
- Session: `af1c9272-bad9-49fe-9373-5cbc496759cb`.
- Reviewed candidate: V7, with 4 mm side and 6 mm rear offsets.
- Full local result: `/tmp/ninja-ethan-hair-opus-v7/result.json`.

Opus's verdict was: “Keep the side volume, drop the rear growth.”
It identified a small improvement above the visible ear under both supplied camera sets.
It found no seam or separate-shell appearance.
It rejected the rear growth because the reference photographs do not support it.
It also said the baseline already had sufficient rear volume.

V8 applies that one correction. Its rear offset is zero.
Local inspection found no new seam in the front, tilt or wider side views.
Opus reviewed V7; it did not directly review the final V8 images.

## Camera limits

The front and tilt comparisons use identical cameras before and after each change.
The original fit is approximate, especially for the upper face.
The newer fit follows the jaw and ear but places the tilted model's eyes too high.
The side diagnostic is not aligned to the profile photograph.
These limits prevent a precise depth claim from the images.

## Checks

The source model hash was `1cc80a0b1040a409ad90a88837ba49bfbc8b614e084b3969c96958f77234ab72`.
The new surface has 3,549 vertices and 6,381 triangles.
Its maximum offset is 4.16 mm. Its minimum source-to-candidate triangle normal dot product is 0.76724.
No new triangle reverses direction.
All original binary bytes, nodes, skins, animation definitions, images and textures remain unchanged.
All 37 animation clips remain unchanged.
The existing five Ethan fit, eye and expression tests pass.

The new author uses a static recipe rather than a current animation pose.
Its path is `tools/author-vice-president-hair.py`.
A changed selection-animation payload produces identical added hair geometry.
Incorrect head positions and already patched inputs fail before writing output.

## Scope

This is a small hair silhouette correction. It does not resolve the full likeness task.
The original low-resolution hair facets remain. The new surface reuses the existing texture.
The tool rejects a changed head topology; orbital refinement needs a reviewed rebase.

The final release uses this side-only geometry.
The full rebuild reapplies it after the measured head correction.
The Monk asset has a new browser cache key, so a page reload requests the revised model.
