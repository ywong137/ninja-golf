# Ninja Golf: approved characters and combat polish

The user approved the new Ronin and Closer identities. This build uses them in the models, selection portraits, and angry musou textures.

The active checkout is `/Users/yishan/.codex/worktrees/shared-pose-transitions/ninja-golf`. The primary checkout contains older source changes and the review evidence.

Completed changes:

- Ronin has cropped hair, a short beard, and the approved Latino identity. Closer has the approved Black identity and short natural curls.
- Closer keeps the fitted shirt neckline. The separate collar intersected her neck during the captured attack pose, so this build removes it.
- Ace has narrower shorts. Shinobi has a relaxed ready pose, captured airborne light attacks, and a three-part heavy attack.
- Ethan uses the purchased Combo5 and advancing thrust in the normal character asset. His musou also uses these captures.
- Musou sequences accelerate pauses between captured contacts. All six sequences retain their source poses and run for at least seven seconds.
- Fixed blade mounts align cutting edges with movement and forward-facing ready poses. Polearm thrusts retain their axial orientation.
- Musou camera clipping uses separate materials. It no longer removes hero surfaces that share materials with nearby enemies or scenery.
- Melee impacts add metal clashes when the struck enemy faces the hero or attacks. Misses retain their separate air sounds.
- Pooled fire, smoke, and thinner luminous sparks accompany impacts and moving musou blades.
- Dead enemies fade with smoke. Their roots stay above the ground, and neighboring enemies retain opaque materials.
- Moving ranged enemies face their actual travel direction. Stationary attacks still face the player.
- Selection cards update before expensive loading. Obsolete queued selections cannot replace the latest choice.
- The shared shoulder skin correction now covers early backswing motion. This is a modest deformation improvement, not a new golf animation.

Verification:

- The full initial run contained 1,034 tests: 998 passed, 30 failed, and six skipped.
- Focused reruns resolved all initial failures. These covered revised asset expectations, captured-motion metadata, and the sandbox-restricted local HTTP test.
- The last broad focused run passed 48 tests. The final collar and preview-framing checks passed another 11 tests.
- All six heroes passed the browser shoulder checks. All six musou sequences and 30 priority-interruption cases passed.
- Camera tests passed nine cases and 27 renders. Browser combat checks covered metal sounds, enemy fading, disposal, and running direction.
- At 1440 × 900, 24-enemy combat averaged 57.0 FPS. Musou averaged 45.7 FPS, with adaptive rendering at 0.75 scale.
- These timings describe this Mac and this scene. They are not a general performance guarantee.
- All browser reviews stayed muted. The production build completed successfully.
- Final production checks matched all nine model files and the JavaScript bundle exactly. All six selections and normal golf-to-combat controls passed.
- The local preview runs at http://127.0.0.1:4185/. The prior preview used an old output directory; it has been replaced.
- The obsolete separate paid-motion preview on port 5186 has stopped. The normal private build now contains those motions.

The supplied particle repositories informed the pooled design:
[Photons2](https://github.com/mkkellogg/Photons2),
[particles-training](https://github.com/DancingPhoenix88/particles-training),
[boom-js](https://github.com/junqiuzhang/boom-js), and
[three.quarks](https://github.com/Alchemist0823/three.quarks).
The new effects use original Three.js instancing code. They add no particle-library dependency.

The complete build stays local. Ethan's purchased motions are embedded in it; the raw purchased pack remains outside the repository.
The existing GitHub repository is public. This complete build has not been pushed there.

Evidence lives in `/Users/yishan/ninja-golf/artifacts/reviews/release-polish/`.
The model revision manifest preserves original binary prefixes, nodes, skins, and historical animation records.
The broader environment art and AAA-quality goal remain incomplete. Human play feedback should guide the next changes.
