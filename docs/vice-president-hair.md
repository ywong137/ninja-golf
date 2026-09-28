# Ethan side-only hair

This author adds a separate skinned hair surface. It preserves every original binary byte.
The candidate adds modest volume above the ear. It does not enlarge the back or top of the head.

The recipe contains a fixed authoring camera and head transform. It contains no photographs.
The original camera is approximate. It preserves the reviewed left silhouette; it does not prove a complete facial match.

## Build

Use Python 3 with NumPy installed.

```sh
python3 tools/author-vice-president-hair.py \
  --input path/to/measured-monk.glb \
  --output path/to/monk-with-hair.glb
```

The default recipe is `assets/characters/vice-president-hair-recipe.json`.
Use `--recipe` to select another reviewed recipe.
Run `--help` for the supported arguments.

The author checks exact head position, UV and triangle hashes before writing.
It also checks rigid Head weights, triangle orientation and the maximum height.
It rejects an already patched model and an output path equal to the input.
Body or animation changes can pass when the head still matches the recipe.
An orbital topology change requires a new reviewed recipe and shell.

The author appends one material and one primitive with 3,549 vertices and 6,381 triangles.
It reuses the mapped hair texture and changes no original geometry or texture.
The maximum displacement is 4.16 mm. The head height stays unchanged.

## Review

Claude Opus 5.5 High reviewed the preceding candidate with a 6 mm rear offset.
It accepted the small side-volume improvement but rejected the unsupported rear growth.
The final recipe sets the rear offset to zero.
Local front, tilt and wider side views show no new seam.
The five existing Ethan face and expression tests pass.

The review does not claim that this small hair correction completes Ethan's likeness.
The hair remains a textured surface, not individual strands.
See `docs/reviews/ethan-side-hair-opus.md` for the review scope and limitations.
