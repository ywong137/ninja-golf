# Accepted golf address and putting authoring

This package reproduces the accepted quiet golf clips. It does not reproduce the fitted full swing. It changes no production files.

The recipe contains six native parent hierarchies, accepted local poses, exact hand profiles, and the putting curve. It totals 446 KB. It contains no meshes, optimizer inputs, rejected studies, or rendered images.

`author-address-putt.mjs` reproduced all six accepted pose documents byte-for-byte. `reproduction-verification.json` records those hashes. The generated duplicate files were removed after verification. The original accepted files remain at the paths in `accepted-artifacts.json`.

## Dependencies and reproduction

The verified runtime was Node v25.8.0 with Three.js 0.186.1. This author needs no Python, SciPy, browser, GPU, Blender, or network access.

Install the repository's locked Node dependencies before use. The author imports these existing modules:

- `src/golf-club.js`
- `src/golf-club-fit.js`
- `src/golf-equipment.js`
- `node_modules/three/build/three.module.js`

`recipe/manifest.json` records their source hashes and the Three.js package version. The author rejects changed equipment dependencies. Review such changes before updating the manifest.

Run these commands from the repository root. Choose a new output directory.

```sh
node tools/golf-quiet-poses/author-address-putt.mjs \
  --repo /Users/yishan/ninja-golf \
  --recipe tools/golf-quiet-poses/recipe \
  --output /tmp/ninja-golf-closed-chain/integration-worker/provenance/reproduced

NINJA_REPO=/Users/yishan/ninja-golf node --test \
  tools/golf-quiet-poses/address-putt.test.mjs
```

The author writes `HERO/pendulum-poses.json`, `HERO/pendulum-report.json`, and a verification summary. It refuses an existing output directory. It checks every accepted pose-document hash before writing output.

The seven focused tests pass. They verify exact reproduction, unchanged local arm transforms, paired palms through midpoint samples, equipment contact, and continuous angular velocity.

The accepted release rebuild uses `tools/bake-native-golf.mjs` with the archived full poses. That archive also contains the accepted swing. For example:

```sh
node tools/bake-native-golf.mjs --hero kaede \
  --poses tools/golf-poses/kaede.json.gz \
  --source /tmp/kaede-original.glb \
  --output /tmp/kaede-golf-rebuilt.glb
```

Use the writer's preservation report before installing a rebuilt model. Keep accepted hand profiles and paired metadata with those clips. Reproducing quiet clips alone does not regenerate the full release.

## Recipe provenance

`capture-recipe.mjs` documents how the compact inputs were extracted. Reproduction does not require running this capture again.

The capture reads these original inputs:

- `/tmp/ninja-golf-closed-chain/address-putt-worker/dense-input/input-HERO.json`
- `/tmp/ninja-golf-closed-chain/adaptive-poses.json` for Kaede's accepted Swing0 anchor.
- `/tmp/swing-retarget-worker/HERO/poses.json` for the other five accepted Swing0 anchors.
- `/Users/yishan/ninja-golf/public/models/HERO.glb` for the unchanged native hierarchy.
- `/tmp/ninja-golf-closed-chain/address-putt-worker/HERO/pendulum-poses.json` for the accepted output comparison.

The manifest records exact absolute paths, byte counts, and SHA256 hashes. Each hero recipe retains the original output provenance. The capture verifies the native model hash against the measured source input.

To audit capture from the retained original studies, choose another new directory:

```sh
node tools/golf-quiet-poses/capture-recipe.mjs \
  --repo /Users/yishan/ninja-golf \
  --study /tmp/ninja-golf-closed-chain/address-putt-worker \
  --swing-dir /tmp/swing-retarget-worker \
  --kaede-anchor /tmp/ninja-golf-closed-chain/adaptive-poses.json \
  --output /tmp/ninja-golf-closed-chain/integration-worker/provenance/recaptured
```

A later installed model will correctly fail this historical capture check. Use the matching archived source when auditing the original recipe.

## Authored motion

`Golf_Address` keeps the original non-arm local transforms. All 241 captured non-arm samples are exactly constant. The accepted Swing0 supplies its clavicle, arm, hand, and finger local transforms.

`Golf_Putt` starts from the complete accepted Swing0 pose. Its clavicle, arm, hand, and finger local transforms stay constant. The pelvis and legs also stay fixed.

The author rotates `spine_03` about actor-local +Z. Its virtual pivot uses the calibrated physical head's X coordinate and the chest's Y/Z coordinates. A matching translation moves the chest around that pivot. The head counter-rotation preserves its address-to-ball direction. This is not an independent optical gaze measurement.

The Hermite curve uses these values:

| Time, seconds | Angle, degrees | Angular velocity, degrees/second |
|---:|---:|---:|
| 0 | 0 | 0 |
| 0.4 | 5 | 0 |
| 22/30 | 0 | -25 |
| 1.08 | -6 | 0 |
| 1.5 | -5 | 0 |

The curve has continuous velocity. Its acceleration need not be continuous at the knots. The output contains 120 Hz keys plus the exact phase boundaries.

The independent native audit checked 363 putt poses, including interpolated midpoints. The largest palm gap was 0.001341 mm. The largest world-arm step was 0.104690 degrees per sampled interval. Local arm steps were zero. Bone lengths and scales did not change.

The finite putter face contacts the real-size ball at 22/30 seconds. The calibrated sole is 2 mm high there. Its minimum height through the stroke is 1.600–1.623 mm on flat ground. Total head travel is 238–253 mm. Each putter needs a 5 mm whole-actor address correction.

The retained anchors include small target residuals. Maximum wrist rotation is 30.006 degrees. Monk's maximum elbow flexion is 18.018 degrees. Sora's maximum forearm twist is 70.001 degrees. No existing bound was changed to produce these values.

## Measured garment contacts

The candidates are not intersection-free. The review accepted their visible grip and shoulder-driven stroke for the bounded hand correction.

The conservative torso hull reports Shinobi at -0.479 mm and Monk at -3.998 mm. Five exact skin samples cover setup, backswing, impact, follow-through, and finish.

Those samples show no paired-hand crossings, head crossings, elbow folds, or arm-axis crossings through the torso. They show no rigid central upper-arm triangle crossing a torso triangle with zero arm weights.

Mixed sleeve/armpit intersections remain. Some extend beyond adjacent shared-edge seams:

- Shinobi has 44 upper-arm/torso pairs at setup. Finite supporting-face overlap reaches 28.84 mm through the stroke.
- Monk has 62 upper-arm/torso pairs at setup. Right-side overlap is 44.75 mm at baseline.
- Monk's left overlap changes from 33.86 mm to 38.07 mm. One proximal forearm/jacket pair changes from 4.79 mm to 8.31 mm.

These values measure local overlap against finite triangle faces. They are not watertight volume depths. `reports/*-garment-summary.json` preserves source triangles, weights, witness points, and baseline comparisons.

`accepted-artifacts.json` points to the full exact-skin reports and rendered sheets. Those scans include the forearm skin helpers. The numeric native-joint tests do not install helpers.

The first side-view sheets crop the putter head. The front views show its complete path. The physical clearance measurements use all actual head vertices and finite face triangles. No result establishes full garment quality or complete motion quality.

## Metadata

Keep the accepted `pairedGrip:true` and `primaryGrip:0` fields with these clips.
The old author cannot reproduce the release geometry. Its metadata output is not an accepted replacement.
