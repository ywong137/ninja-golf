# Garment variants

The six heroes keep their original human meshes, UVs, folds, seams, and normal maps.
Only reviewed garment regions receive new colors or woven patterns.

| Hero | Outfit |
| --- | --- |
| Ronin | Burgundy track jacket with cream stripes |
| Shinobi | Teal shirt with a quiet woven grid |
| Monk | Ochre vest over olive sleeves |
| Kaede | Indigo top with a restrained wave repeat |
| Ayame | Lavender and cream argyle top |
| Sora | Jade hoodie with fine wave lines |

`tools/build-outfit-textures.py` creates the textures from licensed Rocketbox source atlases.
Before compression, it keeps every pixel outside each garment mask unchanged.
Runtime color maps use WebP quality 93 at the source resolution, capped at 2048 pixels.
Compression can change individual pixel values but does not move or redraw skin features.
The generated masks make the affected regions available for inspection.
Body geometry, facial features, hair, eyes, and animation remain unchanged.

`src/character-outfits.js` replaces only the six named hero body color maps.
The existing material loader waits for these maps before showing the roster.
The maps share one cached texture per identity and add no materials or draw calls.
`public/textures/outfits/SOURCES.json` records hashes, source identities, dimensions, and mask coverage.
The adjacent license file preserves the MIT terms.

## Verification

The six full-body selection captures passed in muted Chrome with the current swords.
The garment masks show no visible skin contamination, and source folds remain visible.
Ayame's argyle reads clearly at selection distance.
The full texture folder uses 4.7 MB, including small inspection masks.
Five focused material tests passed. The runtime adds no shader changes or draw calls.

Run `PLAYWRIGHT_CHANNEL=chrome node tests/browser-outfits.mjs` for the six captures.
The script writes `/tmp/ninja-outfit-hero-0.png` through `-5.png`.
These images verify outfit appearance; they do not establish combat or weapon quality.
