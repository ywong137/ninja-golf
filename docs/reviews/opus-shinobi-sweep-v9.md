# Shinobi Sweep v9: independent visual review

The actual signed-in Claude CLI used `--model claude-opus-5-5 --effort high`.
The response reports the canonical model as `claude-opus-5-5` with the first-party provider.
The review finished successfully in 131.4 seconds. The reviewer used Read only.

The text below is the reviewer's unedited response.

---

**Model:** Opus 5.5 (`claude-opus-5-5`). I can't see my reasoning-effort setting from inside the session, so I can't confirm "High." I used Read only, opened only the ten named files, and didn't edit or run anything.

## 1. Did the three points improve?

**Yes, all three improved.**

- **Left path: clearly better.** In the 0.432 front view, the left fist is loaded high, outside the shoulder, and the blade passes over the crown instead of tracking across the face. In the 0.532 three-quarter and right views, the left arm reaches well out from the head. The measured minimum rises from 11.6 mm to 91.2 mm, and the closest point is now at 0.433, not 0.479.
- **Two-hit energy: much closer, but only in the numbers.** Contact speeds are 8.90 and 11.32 m/s, a ratio of 1.27 (it was 2.5). The left tip now moves about 19 cm per 60 fps frame, down from 42 cm. Stills can't show speed. The trails in the playback strip (row 3, frames 2–3; row 4, frames 1–2) show arcs, but I can't tell from them which hit is which or how fast each one is.
- **Torso continuation: the plateau is gone.**
  - The chest now keeps turning past each hit, slowing as it goes: 26 → 27.9 → 29 → 30° over 0.26–0.34, and −26 → −27.9 → −29 → −30° over 0.512–0.60.
  - The hip and pelvis position still hold exactly over 0.26–0.30 and 0.512–0.555. That's the requested brace, not a regression.
  - In the 0.280 three-quarter view, the chest has turned into the cut over a braced lunge.

## 2. Is there a blocking flaw?

**I found no blocking flaw.** Everything below that looks like contact is image overlap, and the measurements rule it out:

| Where it looks wrong | Why it's overlap |
|---|---|
| 0.170 three-quarter: right fist at the hairline, blade across the forehead | Limb-to-head clearance is at least 50 mm; blade-to-head is at least 91 mm |
| 0.232 front strip: right blade across the face | Same scans |
| 0.280 three-quarter: fists look clasped together | The 0.280 right view shows the right fist extended and the left fist near the chest, well apart in depth. The blades stay at least 17.5 cm apart |
| 0.432 front: right blade tip touching the side of the hair | Covered by the blade/head scan |

- **Grips look credible in every contact view.** Each fist is below the guard and the blade angles are plausible. In the 0.280 right view, the right blade looks short because it points toward the camera; the tip/palm data (+0.5 m lateral) matches that.
- **One unverified item, not a claimed fault.** In the 0.348 and 0.580 front frames, the follow-through blade crosses the torso outline. The side row shows both blades in front of the body, but the metrics include no blade-to-torso scan.

## 3. Remaining corrections, in order of importance

1. **Line up the hits with peak blade speed (a partial regression in this revision).**
   - Contact comes at only 65% and 74% of peak blade speed.
   - The right hit got softer: 10.3 → 8.9 m/s. Some of the speed balance came from slowing the right hit, not only from taming the left.
   - At 0.532, the active left blade is nearly vertical: the tip is 0.56 m above the palm and only 0.24 m forward. In the three-quarter still it reads as a raised guard, not a strike.
   - Fix: land each contact later and lower on its arc, at ≥0.9 of peak. That should bring both hits to roughly 12–13 m/s without raising the peaks.
2. **Check the chest's braking at 0.26 and 0.512 (this revision).**
   - Going by the keys, chest rotation speed drops from about 343 to 97 °/s at 0.26, and from about 406 to 94 °/s at 0.512. That's one key, 20 ms before each hit.
   - With linear or poorly tangented interpolation, that's a sudden stop. Sample the chest's rotation speed at 480 Hz, and if it's sharp, spread the slowdown over about 0.24–0.30 and 0.49–0.55.
3. **Inherited from the unchanged Ready stance and body support (out of scope here).**
   - The trunk still barely bends: 6° spine and 3° pelvis at each hit.
   - The wide bow-legged squat is still there at 0.000, 0.696 and 0.812.
   - Both hits are still downward-forward chops (vertical velocity about −7 m/s), not sideways sweeps.

## 4. Recommendation

**Accept this as a local improvement.** It fixes all three v5 points:
- the left blade now clears the head by 91 mm;
- the two contact speeds are within a ratio of 1.27;
- the chest keeps turning through both hits instead of holding.

It adds no geometry, grip or support fault that I could confirm. Before treating the torso fix as final, run the 480 Hz chest-speed check from item 2.

**Limitation:** the gameplay strip samples at 10 fps, with the character only about 60–70 px tall. It can't show the real-time rhythm, the 40 ms hip brace, the chest slowdown at 0.26/0.512, or how either blade looks in motion. The continuous timing is still unverified.
