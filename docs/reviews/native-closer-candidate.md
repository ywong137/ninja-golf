# Closer native arm candidate

Candidate v9 replaces the Closer's combat arm motion. It is integrated locally and awaits publication.

The character uses three gestures: a downward cut, a lateral draw, and a rising cut. The two-hit attacks cut down, then up. Musou alternates those directions while retaining the original body turns.

The author preserves the original body and leg sample values. Those clips already contain different lead steps, crouches, and torso turns. Revised timings scale the body sample times and support intervals together.

## Arm construction

The solver uses the imported rig's elbow hinge and carrying angle. It limits elbow flexion, upper-arm rotation, forearm rotation, and wrist deviation separately.

The weapon follows the fitted hand. A fixed −95.401° rotation around the grip aligns the sharpened edge with the native palm plane. This rotation preserves the shaft axis, palm center, and fitted fingers. It does not vary during an attack.

The rising cut extends the elbow while the shoulder and wrist turn within their limits. Raising the arm alone produced a blunt-edge strike. The final path moves the sharpened edge upward and forward through contact.

The author also corrects Ready and seven guard clips. Guard loops contain a small breathing motion. Selection remains unchanged because its runtime pose uses a separate override.

## Timing

All values use seconds. Clip identifiers remain stable.

| Clip suffix | Previous duration | Candidate duration | Candidate hits |
| --- | ---: | ---: | --- |
| Cut_Diagonal | .400 | .560 | .210 |
| Cut_Return | .430 | .602 | .224 |
| Cut_Rising | .480 | .672 | .280 |
| Cut_Sweep | .580 | .812 | .280, .532 |
| Heavy_Cleave | .760 | .760 | .360 |
| Heavy_Rising | .720 | .720 | .300 |
| Heavy_Sweep | .820 | .984 | .336, .636 |
| Heavy_Slam | .940 | .940 | .470 |
| Musou_Flow | 3.300 | 3.300 | .420, .860, 1.300, 1.780, 2.250, 2.820 |

## Source verification

The 480 Hz scan checks 8,505 samples across 17 clips. It also includes every exact hit time.

- Wrist deviation: at most 18.0° from the imported neutral frame.
- Upper-arm rotation: at most 60.0°.
- Forearm rotation: at most 60.0°.
- Elbow flexion: at most 120.0°.
- World arm rotation: at most 12.79° per 120 Hz equivalent interval.
- Hand speed: at most 9.40 m/s.
- Actual blade clearance: at least .287 m.
- Blade tip speed: at most 21.45 m/s.
- Sharp-edge alignment at contact: .808–.975.
- Contact speed: 54–91% of each clip's global peak.
- Deformed elbow folds: zero measured penetration.
- Deformed arm surfaces: zero intersections with the torso.

The lower contact ratio occurs during the final Musou hit. Its speed remains 7.75 m/s; another hit sets the global peak.

The preservation check confirms 9,615,100 original binary bytes and 20 unrelated clips remain unchanged. It also checks 3,689 retained body, leg, and other channels. Only uniformly scaled times differ where the timing table changes.

Golf, selection, geometry, skins, materials, and existing unrelated clips remain unchanged. The output keeps all 37 clips.

## Runtime and visual review

The CPU browser check covers Ready, running, and guard entry, both with and without movement. It includes recovery after the two-hit attack.

The visible right wrist remains within 18.0°. Grip correction stays below .000004°. The palm remains on the handle within floating-point precision. The smallest runtime blade clearance is .664 m.

The source running blend briefly reaches 22.87° before the existing carry correction. The visible pose retains the 18.0° limit. Recovery shows no measured arm jump above 3.94° per 240 Hz frame.

The muted gameplay recording runs at 55.1 FPS at 1440×900, with 24–34 enemies. It produces no console errors.

The author inspected front and side strips, plus sequential gameplay frames from the actual-speed recording. The rising cut extends the body after its load. The heavy cut uses a larger step and lower finish. The two-hit attack visibly changes its cutting direction.

These checks do not establish final artistic quality. The inherited crouched stance remains low throughout Ready and several attacks. Some recovery paths still return directly toward Ready. The free arm has more variation, but it can use further acting and counterbalance work. No external model reviewed this candidate.

## Rebuild

Run the author against the newest public Sora model. This preserves subsequent golf or appearance changes.

```sh
node tools/author-native-closer.mjs --input public/models/sora.glb --output /tmp/closer-candidate.glb --record /tmp/closer-candidate.json
node tools/check-native-closer.mjs --model /tmp/closer-candidate.glb --record /tmp/closer-candidate.json --before public/models/sora.glb --skin --output /tmp/closer-check.json
NINJA_CLOSER_CANDIDATE=/tmp/closer-candidate node --test tests/native-closer.test.js
```

The author writes matching `.mount.json` and `.report.json` files beside the records. The mount file contains independent golf frames captured before Ready changed. Integration must preserve those frames and apply the fixed sword frame.

The shared author separates the model's source duration from the metadata's source duration. It records `nativeCloserDuration` in each animation. Rebuilding an installed candidate therefore does not scale its body timeline twice.

Generated clips include `kneeAlignmentVersion:1`. This prevents later export tools from applying the old knee adjustment again.

The shared author reproduces the earlier Hustler author byte-for-byte with its original configuration. The Hustler wrapper remains unchanged during integration.

## Review artifacts

- Candidate: `/tmp/closer-native-v9.glb`, `.json`, and `.mount.json`.
- Dense source report: `/tmp/closer-native-v9.check.json`.
- Runtime report: `/tmp/closer-native-v9.runtime.json`.
- Rising strip: `/tmp/closer-native-v9-rising.png`.
- Heavy strip: `/tmp/closer-native-v9-heavy.png`.
- Gameplay: `/tmp/closer-native-v9-sweep.webm`.
- Gameplay sequence: `/tmp/closer-native-v9-playback-sequence.png`.

The runtime review injects candidate records, fixed mount frames, and the timing table through `/tmp/closer-candidate-routes.mjs`. The playback wrapper is `/tmp/capture-closer-playback.mjs`. The CPU wrapper is `/tmp/audit-closer-kinematics.mjs`.
