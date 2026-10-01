# Ronin fixed-grip candidate

The base candidate changes Ready and Heavy Cleave. The optional diagonal adds the first light cut.
Neither build replaces the playable model.
The other attacks, guards, selection pose, and travel transitions still need the same grip review.
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

Start Vite on port 5173 before running the browser checks:

```sh
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-family --attack heavy --rate 144
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-family --attack light --rate 144
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-family --rate 60
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate /tmp/ronin-fixed-family --rate 144
```

The browser runs headlessly with audio muted.
The runtime checks include attack entry and recovery to Ready.
The combo check queues a heavy attack during the light cut through the game's input buffer.
It checks the complete two-hand grip throughout both attacks and recovery.
Each failed numerical bound produces a nonzero exit status.
Passing these checks does not establish natural movement or complete artistic acceptance.

`profile.json` retains 97 fitted controls and the original body timing.
The builder solves both complete hand frames at 480 samples per second.
It preserves the original body motion, mesh data, and unrelated animations.
It also adds the primary wrist track missing from the original Ready clip.

The diagonal retains all 366 exported samples and the original foot paths.
Its torso inclines 15 degrees above the thigh parents; the head counters that inclination.
The light cut lasts 0.60 seconds and contacts at 0.2842105263 seconds.
The candidate route supplies both values to the combat controller.
The diagonal author's default path still produces byte-identical output for the earlier candidate.

The handle measures 270 mm long with a 14 mm radius. The palms sit 120 mm apart.
The right and left palm frames remain fixed relative to the blade.
The runtime route uses these dimensions and a temporary right shoulder deformation helper.
That helper acts during recovery and changes the clothing surface without changing the arm bones.

The builder verifies the source model hash before writing files.
The base model hash is `0893ec7f08a8c6d40190743cad18c2600bcd1ec8640bf623efa46f7d19c674dd`.
The three-clip model hash is `49b40b5f1b78e4c7b3985dde6f97050806ba020db6673910dd70bf5a5061a774`.
See [the review](../../../docs/reviews/ronin-fixed-grip.md) for findings and remaining work.
Local silent previews remain in `artifacts/reviews/ronin-fixed-frame/`.
