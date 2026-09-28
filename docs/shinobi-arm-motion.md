# Shinobi arm movement

The former heavy sweep reversed an elbow during the strike. Its forearm entered
the upper-arm skin by 58.3 mm. The elbow moved 45.9 m/s relative to its shoulder
at the worst sampled interval. The ready pose also folded the left forearm.

The revised sword handles stay in front of the chest, on their respective sides.
The elbow guides follow the turning torso and stay ahead of the shoulders.
The swords can cross without folding the forearms together. Three short hand
rises start 16–23 ms earlier during Musou to spread their movement over more frames.

The source retains the blade directions, rolls, impact times, body turns, steps,
and support intervals. The native export now reaches each exact authored end
time. Earlier exports rounded or truncated some final samples. The body and leg
poses agree within 0.001 mm before that final export interval.

## Validation

The native skin test covers all nine attacks and Ready at 120 Hz. It measures
both deformed arms, including the start and end poses. All measured forearm
folds and torso crossings are zero. Maximum elbow speed is 7.11 m/s across the
family; Musou reaches 7.01 m/s. All attacks return to the matching ready pose.

The asset comparison preserves 27 other Shinobi clips, including the relaxed
selection pose. Geometry, skin weights, textures, materials, and bind transforms
remain exact. Browser checks cover weapon grips, entry and recovery transitions,
and 96 moving attack cases across the roster.

Front and side gameplay captures cover all nine Shinobi attacks, both stationary
and moving. These checks establish the arm correction. They do not establish
finished combat choreography or the overall AAA quality target.

## Scout opponent

Scouts now carry one katana and use a separate `Enemy_Scout_Cut` clip. Their
empty hand stays in a low guard. The primary grip sits slightly forward and
lower to clear the thicker sleeves of this model. The new attack has zero
measured forearm folds or torso crossings; maximum elbow speed is 7.68 m/s.

One damage event matches the sword contact at 0.24 seconds. The full gameplay
swing lasts 0.64 seconds. The previous second sword and second damage event
are removed together. Twelve other Scout clips and all model data remain exact.

## Rebuild

Generate the ten Twin records with `tools/author-twin-motion.py`. Merge those
records into `src/motion-data.json`, then bake the source and native hero:

```sh
blender --background --python-exit-code 1 --python tools/build-authored-motion.py -- --attacks-only
blender --background --python-exit-code 1 --python tools/build-rocketbox-warriors.py -- --attacks-only --hero shinobi
node --test tests/native-twin-arms.test.js
```

Generate the Scout record with `tools/author-scout-motion.py` and merge its output
before the source bake. Then export the Scout with `--attacks-only --enemies
--hero ninja`. The complete roster author also retains this separate attack.

Repeated authoring produces identical records. The arm and Musou timing passes
have separate version markers, so they do not repeatedly shift existing poses.
