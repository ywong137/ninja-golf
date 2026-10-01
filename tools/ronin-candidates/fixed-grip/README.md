# Ronin fixed-grip candidate

This candidate changes Ready and Heavy Cleave only. It does not replace the playable model.
The other attacks, guards, selection pose, and travel transitions still need the same grip review.
Do not copy its complete sword profile into the game before that work finishes.

Run these commands from the repository root:

```sh
node tools/ronin-candidates/fixed-grip/build.mjs --output /tmp/ronin-fixed-grip
node tools/ronin-candidates/fixed-grip/check.mjs --candidate /tmp/ronin-fixed-grip
```

Start Vite on port 5173 before running the browser checks:

```sh
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-grip --rate 60
node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate /tmp/ronin-fixed-grip --rate 144
```

The browser runs headlessly with audio muted. The checks include attack entry and recovery to Ready.
Each failed numerical bound produces a nonzero exit status.
Passing these checks does not establish natural movement or complete artistic acceptance.

`profile.json` retains 97 fitted controls and the original body timing.
The builder solves both complete hand frames at 480 samples per second.
It preserves the original body motion, mesh data, and 35 unrelated animations.
It also adds the primary wrist track missing from the original Ready clip.

The handle measures 270 mm long with a 14 mm radius. The palms sit 120 mm apart.
The right and left palm frames remain fixed relative to the blade.
The runtime route uses these dimensions and a temporary right shoulder deformation helper.
That helper acts during recovery and changes the clothing surface without changing the arm bones.

The builder verifies the source model hash before writing files.
Its generated model hash is `0893ec7f08a8c6d40190743cad18c2600bcd1ec8640bf623efa46f7d19c674dd`.
See [the review](../../../docs/reviews/ronin-fixed-grip.md) for findings and remaining work.
