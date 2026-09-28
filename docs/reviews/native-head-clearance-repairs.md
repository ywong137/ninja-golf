# Closer and Hustler head-clearance repairs

The 480 Hz surface check found five blade/head intersections in the published models.
The repairs change four Closer clips and one Hustler clip:

- `Sickle_Heavy_Cleave`
- `Sickle_Heavy_Sweep`
- `Sickle_Heavy_Slam`
- `Sickle_Guard_Impact`
- `Ring_Guard_Impact`

The preparation and recoil now use less elbow flexion and a more forward hand position.
The palm mounts, fitted fingers, hit times, body channels, feet, geometry, and unrelated clips stay unchanged.

## Verification

Actual Opus 5.5 High reviewed front/side strips for all five clips.
Its response metadata confirmed `canonicalModel: claude-opus-5-5`.
It accepted the visible arm and grip changes, subject to checking the hair surface.

The expanded scan includes the head material and skinned opacity material, including the hair.
It compares actual posed triangles at 480 Hz. Distances below use a 150 mm cap.

| Clip | Closest blade/head distance |
| --- | ---: |
| Closer heavy cleave | 89.31 mm |
| Closer heavy sweep | 83.67 mm |
| Closer heavy slam | 89.21 mm |
| Closer guard impact | 85.39 mm |
| Hustler guard impact | 79.98 mm |

No blade triangle intersects the head or hair. All 34 combat clips across both characters pass the permanent regression check.
The native arm, wrist, finger fit, skin, cutting-edge, and contact-speed checks also pass.
Preservation checks retain 868 unrelated channels across Closer's four clips and 217 across Hustler's clip.
Both fixed sword mounts remain byte-for-byte unchanged.

## Limits

The smaller preparation and recoil angles make the heavy attacks less forceful.
Later body work must improve that anticipation through the torso and shoulder.
The front camera can show blade/face overlap even when the side view and surface check establish clearance.
The scanner checks the blade and skinned head, eye, and hair surfaces. It excludes rigid attachments, the guard, and the handle.
The render review does not establish finished professional choreography.

## Rebuild only these clips

```sh
node tools/author-native-closer.mjs \
  --output /tmp/closer-head.glb --record /tmp/closer-head.json \
  --clip Sickle_Heavy_Cleave --clip Sickle_Heavy_Sweep \
  --clip Sickle_Heavy_Slam --clip Sickle_Guard_Impact

node tools/author-native-hustler.mjs \
  --output /tmp/hustler-head.glb --record /tmp/hustler-head.json \
  --clip Ring_Guard_Impact

node --test tests/blade-head-surface.test.js tests/native-head-clearance.test.js
```
