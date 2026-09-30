# Golf release curves

These curves correct the Ace elbow release after contact.
The author fits complete world arm frames while preserving both complete wrist frames.
Only six arm rotation channels change, between 1.40 and 1.70 seconds.
The source body, feet, club path, impact pose, and later finish remain intact.

Each compressed file records the exact source and output hashes.
The source is commit `6fb899524600c15f13d0b5ea8d04560d6cc8b468`.

```sh
git show 6fb8995:public/models/kaede.glb > /tmp/ace-release-source.glb
node tools/bake-golf-release.mjs --hero kaede --input /tmp/ace-release-source.glb --output /tmp/ace-release-rebuilt.glb
```

The writer rejects a different source and an existing destination.
It also rejects outputs inside `public/` and verifies the rebuilt output hash.
The fitting step has no runtime cost.

This correction does not resolve the source club-speed dips or torso timing.
The later [pacing revision](../golf-pacing/README.md) addresses the club-speed dips with a coordinated stroke clock and corrected foot pivots.
See [the review](../../docs/reviews/golf-release.md) for evidence and remaining work.
