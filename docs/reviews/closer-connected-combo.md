# The Closer: connected source combo

The Closer now uses three full-body light cuts from one continuous Quaternius UAL2 recording. Early input connects the cuts at shared source frames. Without queued input, each cut uses its recorded recovery. The third cut returns to the first on the next light input.

The source controls the steps, pelvic travel, torso turn, and balancing arm. The passing left foot moves outward by up to 6 cm. The landing phase adds 60 ms. These adjustments prevent leg overlap and reduce the landing speed on the target rig. Extracted horizontal travel moves the gameplay actor. Collision handling remains in the game controller. The character preview now displays this travel and restores its origin behind the golf fade.

Single-sword transitions can skip blending only at a declared boundary with matching bone transforms and weapon attachments. Two-handed transitions retain their existing checks. Constant native scale keys remove small import differences between shared frames.

The wakizashi handle is now 20 cm, down from 32 cm. The longer handle intersected the thigh during recovery. The shorter handle retains the same closed grip and blade.

## Evidence

- Thirty gameplay cases cover 40, 60, and 144 Hz. Cases include complete and partial combos, late input, heavy replacement, dodge, repeated combos, running, and terrain.
- Both queued boundaries skip blending. Late input retains recovery and a normal transition.
- Follow-up weapon clearance has zero crossings against the head, torso, opposite arm/fingers, and legs.
- Native anatomical checks cover signed elbow/knee hinges, wrist angles, constant local pelvis position, and exact shared poses.
- Opus 5.5 High found no blocking pose or grip defect. Its raised-knee concern occurs during the source spin. The gameplay recording shows the forward momentum.
- All ten selection layouts and six complete preview cycles pass. The C console, pause, speed, scrubbing, and frame stepping pass.

The finishing strike uses native time 0.64 seconds. Its blade edge has positive alignment with travel at contact. The fast source spin has a larger shoulder rotation per sample than the other cuts. It stays within the reviewed 12-degree regression bound at 240 Hz.

## Limits

This update covers the Closer's light combo. Her heavy attacks and musou still need the broader full-body replacement. Other characters also need complete combo work. This release does not establish overall AAA quality or a new performance benchmark.

## Local evidence

The full regression run passed 920 tests and identified four failures. Two needed updated clip-count and reviewed lunge expectations. The others exposed the passing-leg collision and landing speed. Focused reruns pass after the step correction.

The local review folder is `artifacts/reviews/connected-sword-combo`. It contains source bakes, the candidate, clearance reports, the Opus review, gameplay input results, and a silent gameplay recording.
