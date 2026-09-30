# Golf knee frames and foot pivots

The previous golf clips aimed the leg segments without aligning their native knee hinges.
This produced outward-bowed knees and large sideways ankle rotations.

All six heroes now use calibrated thigh and calf frames in address, swing, and putting clips.
The fit considers hip twist, ankle twist, and ankle rotation outside the forward bending plane.
It changes only the six leg rotation tracks. The torso, arms, hands, and club path remain unchanged.

The lead shoe pivots outward by 25 degrees after impact, from 1.42 to 1.90 seconds.
The rear shoe turns by 45 degrees and raises its heel from 1.10 to 1.95 seconds.
Both pivots retain the horizontal forefoot position. Both shoes hold their final orientation through the finish.
The author measures the actual shoe vertices and retains their initial sole height during each pivot.
This removes the previous three-to-six-centimeter toe penetration.
The initial models retain sole offsets below 2.4 mm.
The test checks the physical shoe surfaces, because the toe bones sit inside the shoes.
The heel lift uses the shoe's transverse axis, rather than the actor's fixed transverse axis.

On slopes, the terrain solver preserves the authored knee direction and native hinge.
A nearly straight leg can raise its heel around the supported toe to retain reach.
The terrain solver does not lower the golf pelvis, which would move the club away from the ball.

## Validation

The dense native audit includes a 480 Hz grid, every authored key, and adjacent midpoints.
Across six heroes, maximum hip twist is 44.62 degrees and ankle twist is 10.77 degrees.
Maximum ankle rotation outside the forward bending plane is 23.52 degrees.
Knee hinge deviation stays below 0.001 degrees. Maximum horizontal forefoot drift is 0.03 mm.
These are project animation measurements, not medical range-of-motion claims.

The skin audit checks both central leg surfaces at 120 Hz throughout all three golf clips.
No selected leg triangles intersect. Ronin has the smallest measured gap, 11.57 mm.
The audit excludes the connected upper-thigh seam. It does not certify all garment surfaces.

The browser audit covers 108 combinations of character, clip, frame rate, and slope.
It tests 60 and 120 Hz playback on flat ground and positive or negative eight-percent grades.
Maximum hip twist is 45.11 degrees. Maximum ankle twist is 12.22 degrees.
The club remains unchanged by terrain correction. The measured reach residual is below numerical tolerance.

The existing grip audit checks 150 phases and twelve finite driver/putter contacts.
The equipment audit checks all eight clubs across six heroes.
The full release suite passes all 508 tests. The production build passes.
Character selection checks cover each complete animation cycle, pause, resume, and slow playback.

Claude Opus 5.5 High reviewed the six character sheets and enlarged intermediate shoe poses.
It accepted the final Ronin and Closer knee and shoe corrections in those stills.
This visual review does not certify the complete swing or continuous motion.

The preservation audit confirms that each model retains all geometry, skin bindings, materials, and original binary payloads.
Each model retains its 34 other clips and 702 non-leg golf channels without changes.

## Remaining swing work

This release corrects the knee frames and foot pivots. It does not complete the golf swing.
The impact pose still bends both knees deeply. The pelvis needs more convincing transfer toward the lead leg.
The backswing club path also needs a separate revision.
That work must retain the closed grip, calibrated contact, and accepted arm geometry.

## Reproduction

Extract the six models and `src/motion-data.json` from commit `fd0c6b17` into a temporary directory.
Run the candidate author with those source paths:

```sh
node tools/author-golf-leg-frames.mjs \
  --source-dir /tmp/golf-source/models \
  --motions /tmp/golf-source/motion-data.json \
  --output /tmp/golf-leg-candidate
```

The author verifies all six source model hashes and refuses an existing output directory.
It writes models, motion records, and per-frame measurements under `/tmp`.
It does not modify production assets.

The older `tools/golf-poses` archives still reproduce the closed-grip release before this leg correction.
Use this author as the later, separate leg pass. Do not replace its source with the old experimental golf author.
