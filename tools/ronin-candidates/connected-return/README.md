This candidate connects the Ronin's first two light cuts. It branches after the first impact, before the recovery to Ready.

The front foot stays planted. The rear foot turns about the toe. The hips turn into the return slash while both palms retain their complete handle frames.

The candidate requires the fitted first-cut model from `../fixed-grip/author-footwork.mjs`. Its model SHA-256 must match `profile.json`.

Run these commands from the repository root. Keep both directories outside `public/`.

```sh
node tools/ronin-candidates/connected-return/author.mjs --candidate SOURCE_DIRECTORY --output OUTPUT_DIRECTORY
node tools/ronin-candidates/connected-return/check.mjs --candidate OUTPUT_DIRECTORY --before SOURCE_DIRECTORY/ronin.glb
node tools/ronin-candidates/connected-return/check-inputs.mjs --candidate OUTPUT_DIRECTORY
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate OUTPUT_DIRECTORY --rate 45 --follow-up return
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate OUTPUT_DIRECTORY --rate 60 --follow-up return
node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate OUTPUT_DIRECTORY --rate 144 --follow-up return
```

Browser checks require Vite on localhost:5173. They use headless Chrome with audio muted.

The branch occurs at 0.384 native seconds, or 0.256 combat seconds. The connected clip lasts 0.71 native seconds and 0.5 combat seconds.

The return impact occurs at 0.295 native seconds. Damage uses the corresponding combat time. An unqueued or late follow-up retains ordinary recovery.

`continuations` declares the target clip and the native branch time. The controller stops precisely at that pose. The mixer skips its fade only when all incoming transforms match.

The author checks native joint limits. The dense checker also evaluates the rendered skin, including the shoulder correction that carries through the splice.

The validated revision passed 683 native samples and 21 controller cases at 45, 60, and 144 Hz. The smoothed revision reduced peak native joint speed from 2,877 to 1,564 degrees per second.

The candidate preserves every existing animation and all original binary data. It adds one connected return clip.

This remains an offline candidate. Other Ronin attacks and travel poses still need the same fitted grip before this model can replace the published asset.
