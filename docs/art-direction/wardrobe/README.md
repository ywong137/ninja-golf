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

The other five selected outfits still need their model changes. Preserve their distinct silhouettes when building them. A texture change alone does not complete those outfits.

## Rebuild Ethan’s coat

Use an Ethan model from before the wardrobe addition. Commit `6f2f370` contains the required base. Keep that input outside `public/models`.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-ethan-wardrobe.py -- --input /tmp/ethan-before-wardrobe.glb --output /tmp/ethan-wardrobe
python3 tools/merge-ethan-wardrobe.py --base /tmp/ethan-before-wardrobe.glb --garment /tmp/ethan-wardrobe/ethan-wardrobe-source.glb --output /tmp/ethan-wardrobe/monk.glb
```

The builder reads the saved fabric atlas from `assets/wardrobe/hostile-takeover`. The merge retains the original binary data and appends garment geometry. It verifies joint names, bind matrices, and normalized skin weights. The original hand triangles retain their original material.

Review the candidate in the game before replacing an asset. Check the complete run, golf swing, light attack, and heavy attack. Rebuild the preview bounds after accepting a model.
