# The Closer: heavy finish and musou

The Closer now uses a recorded full-body heavy cut and a four-cut musou. The heavy cut replaces the base heavy attack, including the follow-up after one light cut. Other heavy branches remain unchanged.

Both motions come from Quaternius UAL2 Sword_Heavy_Combo, CC0. The heavy cut starts at source frame 67, after the previous cut's low crouch. It retains the final overhead chamber, step, downward strike, and recovery. The musou retains the complete four-cut sequence. Horizontal pelvis travel moves the gameplay actor.

The native transfer keeps the sword hand closed. A 14-degree shoulder adjustment clears the handle during the opening preparation. A continuous elbow plane prevents a rapid arm flip near full extension. It changes the wrist path by at most 1.2 mm and the elbow path by 7.8 cm. The landing phase adds 180 ms of native time. Both motions play at 1.2x. Entry blends last 180 ms for heavy and 120 ms for musou.

The four musou impacts replace six old impacts. Each carries 1.5 times the prior damage, preserving the total damage before enemy movement. The final strike has radial coverage and the larger explosion. These effects now follow the actual final strike, independent of strike count.

## Validation

- Native checks cover signed knees and elbows, wrist bend, closed fingers, torso turns, vertical weight transfer, and extracted travel.
- Weapon contact checks found no crossings against the head, torso, opposite arm, or legs. The closest handle clearance is 3.9 mm.
- Fifteen gameplay cases cover 40, 60, and 144 Hz: heavy, queued light, moving entry, dodge, and musou. They verify real enemy damage, strike timing, recovery, and the final radial blast.
- The previous 30-case light-combo test passes with the new heavy follow-up.
- The full regression run passed 925 of 926 tests. Its only failure required six musou strikes. After correcting that obsolete assumption, all 11 focused tests passed.
- Selection framing, slow-motion controls, and weapon visibility pass for all six heroes. The production build passes.
- A silent gameplay recording covers two heavy attacks and the complete musou, including recovery.
- Opus 5.5 High reviewed the earlier pose candidate. Its entry concern led to the later heavy start. The final motion also has numerical and gameplay checks.

## Reproduction

Use the Sora model from commit dfca1d2 as BASE.glb. Bake Closer_Heavy_Source with tools/transfer-sword-study.mjs. Select Sword_Heavy_Combo, the Sickle_Heavy_Cleave template, and these flags:

```text
--palm-frame --palm-pronation-fit --grounded --joint-fit --look-ahead
--right-arm-clearance 14 --sample-rate 240 --stable-arm-pole
```

Run tools/assemble-closer-power.mjs with --base, --source, and --grips. It writes review models and motion records. It does not overwrite production assets.

The review evidence is in artifacts/reviews/closer-heavy. This release does not establish overall AAA quality or a new performance benchmark. Other characters and heavy branches still need full-body motion work.
