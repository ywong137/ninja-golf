# Character builds

The checked-in GLBs are ready to load. Blender is only needed to change the assets.

1. Download the free Standard editions of Quaternius Universal Base Characters and Universal Animation Library.
2. Extract `Superhero_Male_FullBody.gltf`, its BIN and textures, and `UAL1_Standard.glb` into `assets/source/`.
3. Run Blender 5.1 with `--background --python tools/build-warriors.py`.
4. Run Blender with `--background --python tools/build-motion.py`.

The scripts export to `public/models/`. Source archives remain outside version control.
See `public/models/LICENSE.txt` for source links and modification details.

# Environment materials

The download scripts retrieve the licensed assets listed in `public/textures/SOURCES.json`.
They use the web-retrieval skill's T1 browser headers. Set `NINJA_BROWSER_UA_FILE`
to a JSON file containing the current local Chrome user-agent string before running them.
The material downloader verifies checksums from the Poly Haven API.
