# Licensed human roster

The playable heroes and enemies use ten separate Microsoft Rocketbox adult identities.
The game preserves their original anatomy, clothing, texture maps, and skin weights.

| Hero | Source identity |
| --- | --- |
| Ronin | Male_Adult_10 |
| Shinobi | Male_Adult_09 |
| Monk | Male_Adult_05 |
| Kaede | Female_Adult_03 |
| Ayame | Female_Adult_08 |
| Sora | Female_Adult_12 |
| Scout | Male_Adult_18 |
| Guard | Male_Adult_04 |
| Lancer | Male_Adult_11 |
| Skirmisher | Female_Adult_13 |

Source: https://github.com/microsoft/Microsoft-Rocketbox

Pinned source commit: `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
The MIT notice ships as `public/models/ROCKETBOX-LICENSE.txt`.
Source FBX and TGA files remain in the ignored `assets/source/rocketbox` directory.
`SOURCES.json` records exact URLs, byte sizes, and source blob identifiers.

Build with Blender:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-rocketbox-warriors.py
```

Add `-- --preview` to inspect unmodified source bodies without changing game assets.
Native animation clips preserve each model's original limb proportions.

Use `-- --enemies` to export the four enemy bodies with 1K textures and only their required clips.
The build requires a system Python with Pillow for embedded texture compression.

## Surface materials

The original Rocketbox head and body specular maps now control local roughness.
The conversion preserves the author’s surface masks for skin, eyes, cloth, and hair.
It approximates modern roughness from legacy specular intensity; it is not measured physical data.
The original color maps, normal maps, UVs, anatomy, and material assignments remain intact.

Run `python3 tools/build-character-material-maps.py` to rebuild the maps from the licensed source files.
Hero maps use 1024 pixels per side. Enemy maps use 512 pixels per side.
`public/textures/characters/SOURCES.json` records source URLs, source blob IDs, conversion parameters, and output hashes.
The adjacent license file contains the original MIT terms.

Hair cards keep the original blended strand coverage and depth settings.
Opaque cutoffs and changes to depth writes produced visible seams in these layered source cards.
The loader awaits all surface textures before the character selection screen becomes ready.

`tests/browser-character-materials.mjs` captures each hero before and after the material pass under all four course lighting themes.
