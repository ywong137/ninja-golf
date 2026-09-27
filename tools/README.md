# Character builds

The checked-in GLBs are ready to load. Blender is only needed to change the assets.

The ten character bodies use Microsoft Rocketbox assets under MIT. See `docs/rocketbox-roster.md` for source identities and licensing.

1. Place the listed source FBX and texture folders in `assets/source/rocketbox/`.
2. Run Blender with `--background --python tools/build-rocketbox-warriors.py` for heroes.
3. Add `-- --enemies` to export the four enemies with smaller textures and filtered clips.

`build-warriors.py` forwards to this native-human pipeline. Source archives remain outside version control.
The build uses a system Python with Pillow to compress embedded textures.

The original locomotion reference still comes from the Quaternius Universal Animation Library under CC0.
`build-motion.py` prepares that reference. `build-authored-motion.py` prepares the authored golf and combat poses.
The native-human builder fits those motions to each body's actual limb proportions and stores them inside each character GLB.

# Environment materials

The download scripts retrieve the licensed assets listed in `public/textures/SOURCES.json`.
They use the web-retrieval skill's T1 browser headers. Set `NINJA_BROWSER_UA_FILE`
to a JSON file containing the current local Chrome user-agent string before running them.
The material downloader verifies checksums from the Poly Haven API.

# Scanned landscape builds

See `docs/landscape-assets.md` for the download, reduction, texture compression, and distant-view bake steps.
Source scans remain in `/private/tmp/ninja-nature-sources`. The game loads only the optimized GLBs and view images.

# Textured human builds

The playable heroes now use separate licensed Rocketbox identities. See `docs/rocketbox-roster.md`.
All four enemy bodies use separate Rocketbox identities. Quaternius remains the original motion reference only.

# Native guard motion

`author-guard-motion.py` defines each weapon’s guard, impact, break, and four directional steps.
`append-native-guard-clips.py` fits these poses to the six native hero rigs.
It replaces only guard clips and preserves every existing mesh and other animation byte.
The regular native-human build also includes the guard family.
