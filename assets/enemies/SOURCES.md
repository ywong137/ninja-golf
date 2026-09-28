# Enemy appearance sources

All three bodies derive from Microsoft Rocketbox under its MIT license. The pinned source repository and original files appear in `assets/source/rocketbox/SOURCES.json`.

- Hooded runner: `Male_Adult_18`, material `m023_body`, from the existing Scout model.
- Club regular: `Male_Adult_09`, material `m017_body`, from the existing Shinobi model. The enemy material name prevents the hero's separate outfit texture from replacing the plain shirt.
- Cloth shinobi: `Male_Adult_18`. The original human mesh, eyes, skin weights and UVs remain intact. The continuous face-wrap panel copies weights from the nearest source face vertices. The sash and shin wraps interpolate weights along clipped source surfaces.

The cloth shinobi atlas started from `m023_body_color.tga`. ImageGen replaced the modern garment details with a cloth overlap, sash and woven seams on 2026-09-27. `cloth-ninja-generated.png` preserves that generated output. `cloth-ninja-atlas.png` scales it to the original 2048-square UV layout and restores the original hand pixels. The restored hand mask is `v > .825 && (u < .258 || u > .742)`. This is a generated garment adaptation, not a newly scanned costume. The source MIT license remains applicable to the source-derived portions.

The twelve named palettes live in `src/enemy-appearances.js`. Runtime garment masks preserve exposed skin. All colors are fixed; a twelve-slot sequence selects each family and palette independently of the four combat roles. No color selection uses randomness.

Each appearance includes all four role attacks. The builder transfers bind-relative rotations to the target rig. It retains the target body's joint lengths. The separate enemy locomotion pass changes only six leg rotation tracks in five running/jump clips. A shoe can point backward during toe-off; the knee must not follow that reversed projected heading. The correction blends planted sagittal alignment with a forward swing plane and preserves foot paths and orientations.

Build candidates with:

```sh
node tools/build-enemy-appearances.mjs --output-dir /tmp/enemy-raw --ninja-texture assets/enemies/cloth-ninja-atlas.png
node tools/author-enemy-locomotion.mjs --input /tmp/enemy-raw/enemy-hoodie.glb --output /tmp/enemy-hoodie.glb
node tools/author-enemy-locomotion.mjs --input /tmp/enemy-raw/enemy-tshirt.glb --output /tmp/enemy-tshirt.glb
node tools/author-enemy-locomotion.mjs --input /tmp/enemy-raw/enemy-cloth-ninja.glb --output /tmp/enemy-cloth-ninja.glb
```

Review before installing the candidates. Keep the existing four role models as source inputs. Full rebuilds must run both steps after those models and the Shinobi model finish exporting.

Validation includes 240 Hz joint sampling, unchanged source body/face/UV/weight payloads, normalized cloth weights, all four role attacks, and the twelve fixed palettes. Rendered reviews inspect running/jumping legs, the full wardrobe, and the mask during attacks. The cloth surfaces add 1,224 triangles per ninja; they share existing skeletal skinning and require no per-frame cloth simulation.
