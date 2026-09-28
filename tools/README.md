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

The builder finishes with `align-native-knees.mjs`. This pass aligns knees with each shoe's toe direction.
It keeps native leg lengths and foot contacts. Small pelvis shifts make demanding stances reachable.
It changes leg rotation tracks and, when needed, pelvis translation. Meshes, skin weights, and arm tracks remain unchanged.
The pass also runs after partial animation exports, so later arm work cannot restore the old inward knees.

To apply it to an existing uncorrected native model:

```sh
node tools/align-native-knees.mjs input.glb --output corrected.glb
node --test tests/native-knee-alignment.test.js
```

Corrected clips carry a version marker and are skipped on repeat runs. Re-author clips before applying a new correction.
The regression checks all six heroes through selection, ready, attacks, guard steps, and running.
It measures knee alignment against the actual toe direction, not just foot spacing.

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

# Full-body combat authoring

`author-roster-motion.py` regenerates the Ronin, Monk, Shinobi, Ayame, and Sora families. Its `author(data)` API changes the supplied mapping in memory. It preserves Kaede, golf, guard, and unrelated records.

Preview and verify authoring before changing shipping data:

```sh
python3 tools/author-roster-motion.py --output /tmp/ninja-roster-authored.json
python3 tools/author-roster-motion.py --source /tmp/ninja-roster-authored.json --output /tmp/ninja-roster-repeat.json
cmp /tmp/ninja-roster-authored.json /tmp/ninja-roster-repeat.json
```

Run `python3 tools/author-roster-motion.py` to update the shipping motion JSON. For Kaede plus the full roster, run `python3 tools/author-athletic-combat.py`. That entry point runs the Kaede author, then the roster author after its legacy pilot. It cannot restore the old partial attack families.

After authoring, bake the shared source and each affected native model:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-authored-motion.py -- --attacks-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero ronin
```

Repeat the native command for each affected hero. Rebuild enemy Guard when the shared `Heavy_Cleave` record changes. Attack append mode preserves body data and unrelated clips. The source bake includes matching weapon-ready poses marked `nativeAttackReady`.

Coordinate Blender and GPU ownership before baking or rendering. Do not regenerate shared motion data while another asset bake is running.
