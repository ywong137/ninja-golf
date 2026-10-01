# Ronin fixed-grip candidate

The base candidate changes Ready and Heavy Cleave. Optional flags add the first two light cuts and seven guard motions.
These builds do not replace the playable model.
The other attacks, selection pose, and travel transitions still need the same grip review.
Do not copy the candidate sword profile into the game before that work finishes.

Run these commands from the repository root:

```sh
node tools/ronin-candidates/fixed-grip/build.mjs --output /tmp/ronin-fixed-grip
node tools/ronin-candidates/fixed-grip/check.mjs --candidate /tmp/ronin-fixed-grip
```

Build and check the three-clip candidate:

```sh
node tools/ronin-candidates/fixed-grip/build.mjs --output /tmp/ronin-fixed-family --with-diagonal
node tools/ronin-candidates/fixed-grip/check.mjs --candidate /tmp/ronin-fixed-family --with-diagonal
```

Build the ten-clip candidate with guard recoil and planted knee compression:

```sh
node tools/ronin-candidates/fixed-grip/build.mjs --output /tmp/ronin-fixed-guards --with-diagonal --with-guards
node tools/ronin-candidates/check-guards.mjs --model /tmp/ronin-fixed-guards/ronin.glb --before /tmp/ronin-fixed-guards/attacks.glb --record /tmp/ronin-fixed-guards/guards.json --grip-profiles /tmp/ronin-fixed-guards/grips.json --output /tmp/ronin-fixed-guards/guard-check.json --preserve-feet
node tools/ronin-candidates/check-guard-break.mjs --model /tmp/ronin-fixed-guards/ronin.glb --before /tmp/ronin-fixed-guards/guard-reactions-base.glb --output /tmp/ronin-fixed-guards/break-check.json
```

Build and check the eleven-clip candidate with the return slash:

```sh
node tools/ronin-candidates/fixed-grip/build.mjs --output /tmp/ronin-fixed-return --with-diagonal --with-guards --with-return
node tools/ronin-candidates/fixed-grip/check.mjs --candidate /tmp/ronin-fixed-return --return-only --before /tmp/ronin-fixed-return/before-return.glb --output /tmp/ronin-fixed-return/return-check.json
```

`--with-return` requires `--with-diagonal`.
`before-return.glb` retains the family before the second light cut changes.
`return-profile.json` retains the body timing, blade path, torso rotations, and 31 fitted arm-control keys.
The source model hash guards its original body and leg reference.
No discarded temporary model is required to reproduce the return.
The author removes obsolete scale tracks because this motion uses the rig's bind scales.
Those tracks previously forced a grip-distorting transition despite matching joint positions and rotations.

`attacks.glb` retains the three-clip candidate before guard authoring.
The guard check verifies that the new guard export preserves those attacks and all other unrelated animations.
The build retains `guard-reactions-base.glb` for comparing the added knee and hip compression.

Start Vite on port 5173 before running the browser checks:

```sh
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-family --attack heavy --rate 144
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-family --attack light --rate 144
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-family --rate 60
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-family --rate 144
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-return --rate 60 --follow-up return
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-return --rate 144 --follow-up return
node tools/ronin-candidates/fixed-grip/check-guard-runtime.mjs --candidate /tmp/ronin-fixed-guards --rate 60
node tools/ronin-candidates/fixed-grip/check-guard-runtime.mjs --candidate /tmp/ronin-fixed-guards --rate 144
```

The browser runs headlessly with audio muted.
The runtime checks include attack entry and recovery to Ready.
The combo check queues a heavy attack during the light cut through the game's input buffer.
`--follow-up return` instead queues the second light cut.
It checks the complete two-hand grip throughout both attacks and recovery.
Each failed numerical bound produces a nonzero exit status.
Passing these checks does not establish natural movement or complete artistic acceptance.

The guard runtime check covers seven guard sources and two attack destinations.
It checks complete palm frames, handle and fitting contact, native arm bounds, arm surface intersections, and blade clearance during each transition.
The body retains its crossfade while the matching arm chains continue the authored attack together.
This path requires explicit complete-grip metadata and matching local arm transforms, including missing channels' bind values.
The controller releases this layer smoothly if another action interrupts it.
Travel, dodge grips, and the remaining attack transitions still need separate review.

`profile.json` retains 97 fitted controls and the original body timing.
The builder solves both complete hand frames at 480 samples per second.
It preserves the original body motion, mesh data, and unrelated animations.
It also adds the primary wrist track missing from the original Ready clip.

The diagonal retains all 366 exported samples and the original foot paths.
Its torso inclines 15 degrees above the thigh parents; the head counters that inclination.
The native light clip lasts 0.60 seconds and contacts at 0.2842105263 seconds.
The candidate route plays it over 0.40 gameplay seconds, with contact at 0.1894736842 seconds.
The return retains its 0.85-second native clip and plays over 0.50 gameplay seconds, contacting at 0.2558823529 seconds.
The route scales contact times with playback duration. Heavy Cleave remains 0.76 seconds.
The diagonal author's default path still produces byte-identical output for the earlier candidate.

The handle measures 270 mm long with a 14 mm radius. The palms sit 120 mm apart.
The right and left palm frames remain fixed relative to the blade.
The runtime route uses these dimensions and a temporary right shoulder deformation helper.
That helper acts during recovery and changes the clothing surface without changing the arm bones.

The builder verifies the source model hash before writing files.
The base model hash is `0893ec7f08a8c6d40190743cad18c2600bcd1ec8640bf623efa46f7d19c674dd`.
The three-clip model hash is `49b40b5f1b78e4c7b3985dde6f97050806ba020db6673910dd70bf5a5061a774`.
The ten-clip model hash is `57c90584d135632e8d994522e512b782ecef13055cd25b7c74d90dbd13115529`.
The eleven-clip model hash is `1207ba73b36603a8ecba7069cc904eac84f0192859e8961096ae144769ef52d2`.
See [the review](../../../docs/reviews/ronin-fixed-grip.md) for findings and remaining work.
Local silent previews remain in `artifacts/reviews/ronin-fixed-frame/`.

## First-cut footwork

Build the eleven-clip candidate above, then create a separate body revision:

```sh
node tools/ronin-candidates/fixed-grip/author-footwork.mjs --candidate /tmp/ronin-fixed-return --output /tmp/ronin-footwork
node tools/ronin-candidates/fixed-grip/check-footwork.mjs --candidate /tmp/ronin-footwork --before /tmp/ronin-fixed-return/ronin.glb
```

The author checks the eleven-clip source hash and leaves that directory unchanged.
It modifies only the first light cut. Other clips, the mesh, and textures remain intact.
`footwork-profile.json` retains the step extension, hip and chest turns, front-foot orientation, heel lift, and toe articulation.
The front foot turns during its step. The rear shoe pivots around its toe joint as the heel rises.
The toe joint also extends, preventing the weighted forefoot vertices from sinking during that pivot.

The check measures native leg limits, leg surfaces, shoe height, sole and toe support, cutting-edge direction, and matching endpoints.
It allows up to 3 mm below the native floor; the source mesh already reaches approximately 2.33 mm below that plane.
Run the same runtime, guard, and combo checks against the new output directory.
The original source-foot-path comparison does not apply to this intentional footwork revision.

This improves a single attack. It does not solve the combo's return through Ready or the unfinished weapon motions.
The next attack needs a continuation from the planted finish, with a separate recovery when no follow-up is queued.

## Paired combat running

Build this revision from the connected two-cut candidate:

```sh
node tools/ronin-candidates/fixed-grip/author-travel.mjs --candidate /tmp/ninja-ronin-connected-combo --output /tmp/ninja-ronin-paired-travel
node tools/ronin-candidates/fixed-grip/check-travel-preservation.mjs --candidate /tmp/ninja-ronin-paired-travel --before /tmp/ninja-ronin-connected-combo/ronin.glb
node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate /tmp/ninja-ronin-paired-travel --rate 45
node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate /tmp/ninja-ronin-paired-travel --rate 60
node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate /tmp/ninja-ronin-paired-travel --rate 144
```

The author transfers the fitted Ready arm chains into five combat runs.
The body, head, and leg channels retain their source animation.
The runtime keeps both hands on the sword during those runs.
The torso still blends when an attack starts; matching arm chains continue together.

`travel.json` enables this behavior only for the candidate Ronin.
The public roster has no `pairedTravelGrip` configuration yet.
Other heroes retain their procedural carry.

The preservation check covers 630 body channels, 33 unrelated animations, and all original binary bytes.
The runtime check covers seven movement patterns at each rate, followed by light and heavy attacks, resumed running, and stopping.
It measures complete hand frames, handle contact, arm anatomy, arm surfaces, and blade clearance throughout each sequence.
It does not certify the unfinished attacks, dodge transitions, uneven terrain, or the entire roster.

The original one-handed carry produced sleeve intersections and excessive forearm rotation when entering the fitted attacks.
The paired revision removes those failures in the tested sequences.
The changed weapon mount still requires the remaining Ronin family before publication.

## First-cut preparation

The paired-running review exposed an abrupt lift from waist height into the first cut.
This revision extends preparation while preserving every authored pose and the connected return's entry.

```sh
node tools/ronin-candidates/fixed-grip/author-startup.mjs --candidate /tmp/ninja-ronin-paired-travel --output /tmp/ninja-ronin-paired-travel-windup
node tools/ronin-candidates/fixed-grip/check-startup-preservation.mjs --candidate /tmp/ninja-ronin-paired-travel-windup --before /tmp/ninja-ronin-paired-travel
node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate /tmp/ninja-ronin-paired-travel-windup --rate 60
node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate /tmp/ninja-ronin-paired-travel-windup --rate 144
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ninja-ronin-paired-travel-windup --rate 60 --follow-up return
node tools/ronin-candidates/connected-return/check-inputs.mjs --candidate /tmp/ninja-ronin-paired-travel-windup
node tools/ronin-candidates/fixed-grip/inspect-braking.mjs --candidate /tmp/ninja-ronin-paired-travel-windup
```

The native clip lasts 0.68 seconds and plays over 0.48 gameplay seconds.
Contact occurs at 0.25709 gameplay seconds; the connected return branches at 0.32753 seconds.
The author also retimes foot-support intervals and the recovery's shoulder correction.
The runtime gives the torso 0.16 seconds to blend from an opted-in paired run.
The incoming arms retain their own authored clock throughout that blend.

An independent Codex review accepts the arm preparation but identifies foot sliding during braking.
The final command measures that unresolved problem using actual controller movement on flat ground.
It reports near-ground toe drift during the first 0.18 seconds across four running phases, with movement held or released.
It does not certify the feet or the complete transition. The candidate remains offline.
