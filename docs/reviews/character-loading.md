# Load heroes on selection

The title screen previously waited for all six heroes. It now loads the Ronin, the cloth ninja, and two shared motion sources. Other heroes load when selected.

The measured initial model transfer fell from 97,253,139 bytes to 18,535,358 bytes on the local built server. This is an 80.9% reduction. These figures exclude the JavaScript bundle, scenery, textures, and sound. Local timing varied under concurrent animation tests, so it does not establish a reliable load-time improvement.

Selection shows a loading panel. Other character cards and Back remain available. A late request cannot change a newer selection. Failed model or outfit downloads expose a retry. Successful downloads remain cached for this page session. Cancel stops the UI request; an in-flight asset may finish and stay cached.

Saved-round continuation waits for the saved hero. The enemy and shared motions already exist before the title screen, so combat needs no further character downloads.

## Validation

- Nine focused loading, surface, and outfit tests pass.
- The built-browser check passes startup, request races, model retry, outfit retry, cancellation, all six selections, saved-round continuation, and normal golf-to-combat play. It reports no page errors.
- Exact delivery checks confirm all nine model hashes, both portrait atlases, and ten combat recordings.
- The model meshes, animations, outfits, and effects have no asset changes.

Run `npm run build`, then start Vite preview. Run `npm run test:loading -- http://127.0.0.1:4184 OUTPUT_DIRECTORY` for the production UI checks.

Direct actor studies now call `preloadWarriorFixtures(page)` before constructing arbitrary actors. The game uses `loadInitialWarriorAssets()` at startup and `loadWarrior(index)` for selections. `loadWarriorAssets()` remains an idempotent full-roster loader for review tools. A synchronous `Warrior` constructor fails clearly when its model is not ready.

Private evidence: `/Users/yishan/ninja-golf/artifacts/reviews/character-loading/`.
