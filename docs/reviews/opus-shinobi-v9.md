**Model:** Opus 5.5 (`claude-opus-5-5`). I only read files: the three v8 strips, the three v9 stills, the playback sheet and `shinobi-v9-metrics.json`. I didn't open the profile file.

## 1. Severe anatomical faults

**None confirmed.**

- **Elbows:** they bend the right way in every view I checked. At Twin_Cut_Sweep 0.280 and 0.532 (three-quarter and right views), the right elbow is tucked at about 90° with the crease facing up and forward. The left arm is extended with a slight bend. In the strips, the low right-arm finish in Sweep at 0.348 and the high left arm in Heavy_Rising at 0.411–0.514 also bend normally.
- **Forearm twist:** no candy-wrapper twisting at any wrist in the large stills. The 60° twist/roll limits are only reached in the rising and Musou clips, which exist only as small strips. **Unverified:** the Heavy_Rising contact at about 0.30 s. It combines 118° flexion, 60° roll and 60° twist, so it's the riskiest frame and needs a close-up.
- **Wrists:** straight or slightly bent toward the little finger in all three stills. None are folded against the handle.
- **Knees:** planted and over the feet in every view. In the Sweep front view at 0.116–0.232, the knees may drift slightly inward, but the image is too small to tell. Treat that as a projection question, not a defect.
- **Projection risk, not a confirmed defect:** in the front view, a blade crosses the face at eye level. This happens in Sweep at 0.116–0.232 (right blade in its raised start position) and in Heavy_Rising at 0.309–0.514 (left blade). The side views are too small to rule out the blade passing through the head. The collision metrics only test arm against torso, so they can't catch this.

## 2. Grip

Both hands visibly hold the handles in all three v9 stills. The guard sits on top of the fist and the handle comes out below the little finger. The fingers visibly wrap the handle, and I see no gap. I found no grip problem.

## 3. Highest-impact full-body changes

These three problems are new findings or have new evidence:

- **The off-hand "cover" swings the blade flat at the moment of every hit.** At contact, the covering blade moves at 5–7.5 m/s, flat side first, and nearly always outward and backward. That is 71–96% of its own peak speed. In Heavy_Rising at 0.30, the cover blade moves at 7.54 m/s, faster than the cutting blade at 7.32 m/s. On screen this reads as both blades swinging, and a flat swing isn't a cover.
- **The torso barely turns at the hit.** In the right view at 0.532, the left blade is at its peak speed (25.9 m/s), yet the view shows a clean side profile. The chest is essentially not turned, and the feet stand square and side by side.
- **The rising cuts are really lifts.** In Cut_Rising, the blade is horizontal across the body at chin height (palm at y = 1.53) and moves straight up (forward speed −0.10 m/s). In Heavy_Rising, the tip moves up and slightly back toward the body (forward speed −0.91 m/s), with the blade across the eyes at 0.309. Both read as a head-high block, not a cut through a target.

**A. Turn the torso from the hips, and let that drive the covering hand.**
- **Wind-up** (about 120 to 50 ms before contact):
  - Turn the pelvis 10–15° away from the cut.
  - Turn the chest another 10–15° beyond the pelvis.
  - Put 60–65% of the weight on the foot on the chamber side.
- **Drive:**
  - The pelvis starts turning about 50 ms before contact.
  - The spine follows 20–40 ms later, mostly from the upper back (about 8–12° per spine joint).
  - The shoulder and elbow extend last.
  - The neck counter-turns so the eyes stay within about 10° of the target.
- **At contact:** pelvis about 10° past neutral, chest 20–30° past, 60–70% of the weight on the lead foot. The chest overshoots by 5–10° and settles over 0.15–0.2 s.
- **Alternating hits:** right then left becomes a ±20–30° chest oscillation.
- **Covering hand:** it should ride the chest's rotation and be parked by the time of contact, with the tip slowing to 3 m/s or less. It should not swing on its own.

**B. Make the rising cuts come from the legs, with contact out in front.**
- **Load:** knees bend 15–20° more and the pelvis drops 4–6 cm.
- **Drive:** the knees straighten by about 15° and the pelvis rises 5–8 cm, arriving at contact.
- **At contact:** hands 10–20 cm further forward than now, and the tip moving forward. The blade should lie along the upward diagonal arc, not flat across the face.
- **Heavy_Rising:** add a 10–20 cm step with the lead foot, heel landing 30–60 ms before contact.
- **Recovery:** 0.2–0.25 s back to guard.

**C. Give the guard room to recoil.**
- **The problem:** in Twin_Guard_Impact the fists sit at the temples, and the frames from 0.043 to 0.257 are almost identical.
- **Change:** set the guard hands 20–30 cm out from the face.
- **Impact** (0–40 ms):
  - Hands pushed back 5–10 cm.
  - Elbows bend 10–15° more.
  - Chest leans back 3–6°.
  - Head moves back 2–4 cm with a slight chin tuck.
  - Knees bend 5–10° more.
- **Absorb:** 40–150 ms.
- **Recover:** 150–300 ms, with a small overshoot.

Keep the elbow hinge and hand wraps as they are. The hands get to the right places through body motion, not through extra wrist twist.

## 4. Integration verdict

This is acceptable as an anatomy improvement, and I found no confirmed blocking defect. The claimed sharp-edge alignment and tip-speed ranges match the metrics. Two checks should come before merging:

1. **Blade-to-head clearance** in Sweep at 0.116–0.232 and Heavy_Rising at 0.2–0.5. If a blade passes through the head, that should block the merge.
2. **The left hit in Sweep at 0.46–0.60 in the real-time clip.** It peaks at 25.9 m/s, about 1.75× the right hit in the same clip. The largest per-step arm change in the whole set (15.0 at 120 Hz) also occurs in this clip, so check for a visible pop.

**Artistic quality** is a separate verdict: it's not there yet. In gameplay the body reads as a stiff column with arms moving on it. The static torso, the flat cover swings and the head-high rising lifts are the main reasons.