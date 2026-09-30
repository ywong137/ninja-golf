# Ace golf pacing curves

These curves remove the repeated club slowdown and acceleration after contact.
They use the actual model from commit `9e80579`, rather than an older authoring profile.

The complete stroke follows one monotonic clock from 1.10 to 1.95 seconds.
Contact stays at 1.40 seconds. The clip still lasts 2.40 seconds.
Constrained arm curves preserve both complete wrist frames while smoothing the elbow roll.

The first candidate turned the rear shoe too quickly and failed the existing leg tests.
The final curves smooth both shoe rotations over 70 ms and solve complete leg frames around planted forefeet.
The shoe soles retain their ground plane. Native knee hinges and joint limits remain unchanged.

The GLB animation includes its own `footSupport` data.
Other characters retain their existing motion records.

```sh
git show 9e80579:public/models/kaede.glb > /tmp/ace-pacing-source.glb
node tools/bake-golf-pacing.mjs --input /tmp/ace-pacing-source.glb --output /tmp/ace-pacing-rebuilt.glb
```

The builder checks both source and output hashes.
It rejects an existing destination or a destination inside `public/`.
The compressed curves contain all final joint samples and the foot-support intervals.

The fit runs offline. Playback uses the existing native animation system.
See [the review](../../docs/reviews/golf-pacing.md) for measurements and remaining visual defects.
