# Complete broadleaf canopy

The previous reduction removed most source leaves, then removed more foliage from the middle detail level.
This made the Japanese and city groves look thin, even when their opacity textures were correct.

The replacement preserves all 44,168 leaves from [Poly Haven's Island Tree 01](https://polyhaven.com/a/island_tree_01).
The source uses CC0. The existing source manifest retains its attribution and license links.
Each near leaf uses four triangles. Each middle leaf uses two triangles.
The fit preserves each leaf's position, orientation, and texture rectangle.
Near leaves also retain their longitudinal bend.
The median surface fit error is 3.1 mm. The 99th percentile is 6.6 mm.

Wood geometry, embedded textures, material definitions, and node transforms remain byte-identical or structurally identical to the previous asset.
The preservation audit checks all four wood meshes and nine embedded images.
Only the two leaf primitives change.
The source still has naturally open lower branches; this change does not invent a different tree shape.

The broadleaf opacity cutoff now matches the conifer cutoff of 0.18.
Runtime foliage, shadow materials, and the atlas baker share the cutoff.
The new albedo, normal, and projected-shadow atlases show the restored canopy.
Only this species receives new cache revisions.
Tree positions, collision bounds, detail distances, other species, and character assets remain unchanged.

## Reproduction

Use Python with NumPy and the verified original glTF and binary buffer.

```sh
OPENBLAS_NUM_THREADS=2 python3 tools/rebuild-broadleaf.py \
  --source /path/to/island_tree_01.gltf \
  --model public/models/nature/forest-canopy.glb \
  --output public/models/nature/forest-canopy.glb \
  --report /path/to/canopy-build.json
GAME_URL=http://localhost:5184 node tools/bake-nature-impostors.mjs forest-canopy
npm run build
```

The original source binary has MD5 `8271f2d12c2727bd647ce0c242acdcec`.
The builder rejects incompatible leaf layouts and poor surface fits.
Running the builder again on the final GLB produces identical bytes.
The Blender nature pipeline now calls this builder after export, instead of thinning whole leaves.
Keep the existing opacity repair step when rebuilding from raw Blender exports.

## Cost and checks

| Representation | Leaf triangles | Leaves |
| --- | ---: | ---: |
| Source | 1,060,032 | 44,168 |
| Near | 176,672 | 44,168 |
| Middle | 88,336 | 44,168 |

The uncompressed GLB grows from 8,782,892 to 22,028,456 bytes.
The production build delivers 11,873,462 bytes with Meshopt and gzip.
Its three atlases total 2,028,908 bytes.
Loading remains limited to the selected course's required species.

Fourteen focused checks pass, including exact compressed decoding and complete leaf preservation.
The rendered checks cover all four themes, decoded opacity, shadow cutoff agreement, and all foliage detail levels.
Eight matched views cover 18–140 metres, including both transition regions.
The built game loads all four course previews and its gzip fallback without browser errors.

The initial matched combat comparison used 24 enemies, moving attacks, and fixed rendering ratio 1.0 at 1440 × 900.
The old asset averaged 49.0 FPS in the Japanese grove and 54.2 FPS in the city grove.
The candidate averaged 48.5 and 55.0 FPS respectively, with a 33.4 ms 95th-percentile frame time.
These short M1 Max samples show similar performance, not a measured speed improvement.
They do not establish performance on other hardware.

Evidence lives in the primary checkout under `artifacts/reviews/broadleaf-canopy/`.
The installed asset and rebuilt atlases average 48.7 FPS in the Japanese grove and 55.4 FPS in the city grove.
The final production check passes normal selection, golf, Ethan's three light stages, chained heavy, and running recovery.
The unchanged Ethan model retains 44 clips and SHA256 `30099081f3bebb94ad7da838ab5aa0bd997c590f42b66ee6e9e72407f9994b46`.
One initial input run timed out waiting for a combo stage. An instrumented rerun passed without runtime changes.
The fixture remains timing-sensitive; this pass does not claim to resolve that intermittent result.
The served production bundle is `index-pCg_OwL5.js`.

All browser checks run muted. The complete release remains local and private.
This improves canopy coverage; the broader AAA art objective remains unfinished.
