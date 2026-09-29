# Captured sword-motion reference

The Ronin rising-cut experiments still crossed the body. This study tests captured human motion before another hand-path fit.
It adds a validated source decoder. It does not change a shipping animation.

## Source and permission

The [CMU Graphics Lab motion database](https://mocap.cs.cmu.edu/search.php) labels subject 02, trials 07–09, as swordplay.
The [CMU FAQ](https://mocap.cs.cmu.edu/faqs.php) permits copying, modification, and redistribution of its motion data.
The source rate is 120 Hz. The ASF length conversion is `0.0254 / length_unit`, in metres.

`tools/cmu-sword-sources.json` records the source URLs, original byte counts, SHA256 hashes, retrieval date, and license reference.
The downloaded sources remain under ignored `assets/source/cmu-sword/`. They do not enter the browser bundle.

| Trial | Frames | Duration | Wrist separation | Reference use |
| --- | ---: | ---: | --- | --- |
| 02_07 | 2,251 | 18.75 s | 12.4–28.4 cm | Close two-hand motion; narrow stance |
| 02_08 | 1,500 | 12.49 s | 8.9–105.1 cm | Steps and lunges; frequent hand separation |
| 02_09 | 1,033 | 8.60 s | 6.4–129.5 cm | Crouch and recovery; frequent hand separation |

Wrist proximity does not prove contact with a rigid handle. The source contains no sword transform or cutting-edge direction.

## Verified decoder

```sh
node tools/export-acclaim-reference.mjs \
  --asf assets/source/cmu-sword/02.asf \
  --amc assets/source/cmu-sword/02_07.amc \
  --rate 120 --output /tmp/02_07-reference.json

node --test tests/acclaim-motion.test.js
```

The export contains distal segment endpoints and world quaternions, with explicit units and capture rate.
The anatomical wrist is the `wrist` endpoint. Using only the `radius` endpoint omits part of the forearm.
ASF/AMC does not encode the capture rate; the CLI requires it.

Seven tests cover rotation order, joint-axis conjugation, forearm twist, parent rotation, unit conversion, endpoint interpretation, and malformed source data.
An independent scalar-matrix decoder agrees with the quaternion decoder across all 2,251 trial-07 frames.
The maximum endpoint difference is 1.84e−15 metres. This validates decoding, not the quality of the captured performance.

## Actual Opus review

Claude Opus 5.5 High reviewed the source sequences, the first Ronin transfer, the decoder, and the transfer script.
The result identifies `claude-opus-5-5` and contains no permission denials.
The review used image sequences, not video playback.

Opus rejected trial 07 as a direct rising-cut reference.
The hands rise into a sustained overhead hold, while the feet remain close together.
That motion better supports overhead preparation than an upward strike.
Neither trial 08 nor trial 09 maintains a two-hand grip through the relevant body movement.

The reviewer identified these transfer problems:

- The CMU clavicle starts at the chest center. The native clavicle starts beside the neck. Their absolute directions are not equivalent.
- A bend-plane cross product becomes unstable near full extension. The ASF hinge frame gives a stable rotation axis.
- Discarding the captured forearm rotation loses the hand's orientation around the arm.
- A source hand path cannot certify a fixed two-hand weapon grip.

The later diagnostic transfer corrects the clavicle excursion in the chest frame and preserves the native shoulder offsets.
It also uses the ASF hinge axes, captured forearm rotation, and an ankle/forefoot/toe plane for shoe orientation.
The native `neck_01` carries the clavicles, so its rotation follows the chest. Head rotation remains independent.
The native `spine_01` also carries both thighs. A lumbar change there requires compensating the legs; a direct mapping is unsafe.

These corrections improve the diagnostic transfer, but do not qualify it for release.
Sampled forearm twists still reach 83.44° on the right and −87.07° on the left, beyond the current authoring bounds.
Sleeve/body crossings remain. Hand contact and a sword trajectory remain unauthored.

## Next authoring constraint

Use the source elbow paths as soft guides around one shared weapon transform.
Keep native bone lengths, two-hand contact, wrist bounds, body clearance, and planted feet as hard constraints.
Allow the shared handle to move when source proportions conflict with native proportions.
Reject a frame when the necessary displacement destroys the intended action.

Do not label trial 07's overhead preparation as a rising strike.
Do not mirror it until measured hand order establishes which hand leads.
Any combination of trial 07 arms and trial 09 legs is an authored composite, not a captured performance.

Local evidence is in `artifacts/cmu-sword-reference/`.
It includes the Opus prompt/result, raw skeleton sheets, rejected transfer sheets, source parser, and transfer diagnostics.
Those prototype scripts retain their temporary input paths. They are evidence, not release tools.
