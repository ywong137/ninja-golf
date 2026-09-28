# Combat playback evidence

The playback capture must verify the animation it records.
An earlier Ronin cleave review selected heavy step 1, which plays the rising attack.
Its frame-rate result did not establish the cleave's performance or timing.

`tools/capture-combat-playback.mjs` now resolves the requested attack before recording.
It compares that name with the routed candidate and an optional `--expect-clip` argument.
A mismatch stops the capture with the selected and requested names.

The report includes the observed clip names and their continuous intervals.
Each interval records its start, end, and sampled frame count.
The requested clip must appear for at least three frames.
Existing frame-rate, crowd, and console checks remain active.

Example:

```sh
node tools/capture-combat-playback.mjs /tmp/ronin-cleave.webm \
  --hero 0 --kind heavy --step 0 --expect-clip Ronin_Heavy_Cleave
```

Attack indices start at zero. Heavy step 0 selects the cleave. Heavy step 1 selects the rising attack.

The positive check recorded `Ronin_Heavy_Cleave` at 58.8 FPS with 24–42 enemies and no console errors.
The negative check requested that name with step 1. It rejected the mismatch before creating a recording.
Both checks used an isolated, muted browser. Neither changed a game asset.

This check verifies recording identity. It does not establish anatomical correctness or acceptable animation quality.
