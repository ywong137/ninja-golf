# Approved wardrobe

The six concept sheets preserve all 18 proposed outfits. `catalog.json` records the user’s selected defaults and the remaining future unlockables.

| Character | Default |
| --- | --- |
| The Vice President | 01 — Hostile Takeover |
| The Ace | 05 — Major Threat |
| The Ronin | 07 — Redline Ronin |
| The Hustler | 10 — House Advantage |
| The Shinobi | 14 — Scratch Assassin |
| The Closer | 18 — Green Keeper |

Ethan’s first implementation adds a skinned, split long coat and raised collar. It uses dark fabric, crane embroidery, and gold trim. The existing face, skeleton, and 40 animation clips remain unchanged. Four shared material groups contain the added garment geometry.

All six defaults now include new garment geometry and textures. The remaining twelve designs remain saved as future unlockable references.

- The Ace wears an argyle top, Bermuda shorts, knee socks, and a visor.
- The Ronin wears a burgundy wrap jacket, cream collar, and waist sash.
- The Hustler wears an embroidered plum jacket with a bound neckline and lilac sash.
- The Shinobi wears a white technical vest with diagonal teal and navy bands.
- The Closer wears a cream and jade tunic with bamboo artwork and split panels.

These are first costume implementations. They retain the existing character proportions and faces. The original shoes preserve the tested foot contacts. The Closer's trouser length differs from the concept sheet.

Each model uses at most eight skinned draw groups. The added geometry stays below ten thousand triangles per character. The preservation reports record the unchanged face streams, skeletons, and animation data.

## Rebuild Ethan’s coat

Use an Ethan model from before the wardrobe addition. Commit `6f2f370` contains the required base. Keep that input outside `public/models`.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-ethan-wardrobe.py -- --input /tmp/ethan-before-wardrobe.glb --output /tmp/ethan-wardrobe
python3 tools/merge-ethan-wardrobe.py --base /tmp/ethan-before-wardrobe.glb --garment /tmp/ethan-wardrobe/ethan-wardrobe-source.glb --output /tmp/ethan-wardrobe/monk.glb
```

The builder reads the saved fabric atlas from `assets/wardrobe/hostile-takeover`. The merge retains the original binary data and appends garment geometry. It verifies joint names, bind matrices, and normalized skin weights. The original hand triangles retain their original material.

Review the candidate in the game before replacing an asset. Check the complete run, golf swing, light attack, and heavy attack. Rebuild the preview bounds after accepting a model.

## Rebuild the other defaults

Use the original models from commit `e7ad13a`. Keep those inputs outside `public/models`.

For Ronin, Shinobi, and Hustler, run the matching `tools/build-<model>-wardrobe.py` script. Pass the original model with `--input` and a working directory with `--output`.

The Ace and Closer use a clean clothing template from the licensed f008 body. Their original faces, hair, skeletons, and animations remain intact. First run:

```bash
node tools/fit-clothing-base.mjs TARGET.glb ORIGINAL_AYAME.glb FITTED_BASE.glb [--fit-arms]
```

Use `--fit-arms` for the Ace to fit the sleeve surface and weights to her original arms.

Use the fitted base as the input to `tools/build-kaede-wardrobe.py` or `tools/build-sora-wardrobe.py`.

Merge the exported garment with the same base used by its builder:

```bash
python3 tools/merge-selected-wardrobe.py --base BASE.glb --garment OUTPUT_DIR/MODEL-wardrobe-source.glb --output CANDIDATE.glb --model MODEL --outfit-id NUMBER --outfit-name NAME
```

Add `--replace-body --original-body TARGET.glb` for the Ace and Closer. The merge retains their original hands and shoes. Do not re-export the source animations through Blender.

Run the garment preservation, leg clearance, shoulder skin, and browser showcase tests after a change. The saved preservation report identifies the original inputs. Do not replace that baseline with a candidate model.
