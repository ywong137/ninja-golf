Golf now uses native human bones directly. The former mannequin retarget turned the chest away from the hands and displaced the shoulders.

`tools/golf-motion-profile.mjs` defines a left-handed swing. The anatomical right arm leads; the left hand sits closer to the clubhead.

The pelvis turns before the chest during transition. The golfer retains the address hinge, then transfers weight onto the lead foot. The trail heel pivots around a planted toe. Terrain support preserves that pivot and the native backswing reach without moving either hand. The release passes upward before settling above the lead shoulder.

`tools/author-native-golf.mjs` fits those phases to each native rig. It keeps the native clavicles outside the arm solver. Explicit elbow planes preserve the hinge. A continuous shaft frame prevents wrist flips when the shaft and forearm become nearly parallel. Forearm pronation follows gradually.

The native hierarchy puts the thighs below `spine_01` and the clavicles below `neck_01`. Both relationships require deliberate world-space rotations. Head tracking happens on `Head`, avoiding unintended shoulder movement.

The club retains one length throughout all three golf clips. Driver contact remains at 1.4 seconds, at source position `(0, -.945, .118)`. Existing golf timing and shot physics remain unchanged.

Rebuild and review a candidate:

```sh
node tools/author-native-golf.mjs --hero ronin --output /tmp/ronin-golf.glb
node tools/capture-native-golf.mjs 0 Golf_Swing /tmp/ronin-golf.png --model /tmp/ronin-golf.glb
```

The author rejects public output paths. Full roster builds invoke it automatically before the character geometry patches. It preserves mesh, texture, skin, and unrelated animation bytes. Constant tracks are compacted before export.

Verification:

```sh
node --test tests/golf-motion.test.js tests/native-golf.test.js tests/foot-placement.test.js
node tests/browser-golf-motion.mjs
```

`NINJA_GOLF_MODEL_DIR` redirects the native tests to candidate files. The browser test accepts that directory as its first argument. Both review tools keep audio muted.

The checks cover fixed club length, exact driver contact, wrist continuity, foot support, finger contact, and deformed forearm collisions. The Vice President retains brief sleeve contact with his loose vest after impact. The test records that narrow allowance; deep elbow collapse remains rejected.

Two actual Claude Opus 5.5 High reviews informed these changes. The second identified the hidden downward release shortcut and excessive elbow folding. Sparse screenshots had missed both defects. Dense native checks now cover the intervening phases.
