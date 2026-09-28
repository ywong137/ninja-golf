# Native golf visual review

Model: claude-opus-5-5. Effort: high. The owner authorized all referenced project files.

## Verdict

**Yes, this is a clear, usable improvement on the stated problems, and I don't see a major pose defect that blocks shipping.** In all eight views for both heroes, the lead (anatomical right) arm looks long and straight at address, top and contact. Neither hand looks broken at the wrist, both hands stay on the grip, and the finish reads as a real finish: weight on the lead leg, trail foot up on its toe, hands high, club behind the head. The measured numbers in the README (lead wrist capped at 35°, compared with 82.1° on the shipping Ronin) match what the renders show.

There is one real weakness. **The contact frame (1.400 s) looks almost the same as address.** I recommend fixing it before shipping. The fix is a two-number change plus a re-test, not a new solver pass.

I compared against John Baker's swing mirrored, because he is right-handed. I only saw four frames, so I can't judge transition, release or overall timing.

## Top three corrections

### 1. Contact (1.400 s): the torso straightens up and the pelvis drifts back

- **Visual judgment:** From the front, both heroes at contact look nearly identical to address. The torso doesn't tilt away from the target, and the body hasn't moved toward the target. In the reference impact frame, the trail shoulder is clearly lower, the hips have moved toward the target, and the trail knee is working in. The contact frame looks passive.
- **Measured in the source** (`tools/golf-motion-profile.mjs:13-23`, `GOLF_BODY`): the side-bend and root-X columns both reverse direction right at impact:

| t | side | root X |
|---|---|---|
| 1.32/2.4 | -.14 | -.060 |
| **1.4/2.4 (impact)** | **.02** | **-.035** |
| 1.56/2.4 | -.13 | -.100 |

  Over about 0.1 s, the torso tilt jumps from -.14 to +.02 and back to -.13. The pelvis moves 2.5 cm back toward the trail side, then 6.5 cm toward the target. Negative X means toward the target: the finish row is -.115, and the hips visibly move image-left there. At address the tilt is -.30, so at impact the torso is more upright than at address. Real golfers are the opposite: they tilt further away from the target at impact than at address.
- **Fix:** In the impact row (`tools/golf-motion-profile.mjs:19`), change `side` from `.02` to about `-.28` and root X from `-.035` to about `-.075`, so both columns change in one direction only.
  - The smooth body offsets already hold contact exact, so the arms will re-reach.
  - Re-run the anatomy tests. The lead elbow (14.5°) and wrist (35°) limits are what could break.
  - If the reach fails, `-.20` for `side` is an acceptable compromise, as long as nothing reverses direction.

### 2. Top (1.044 s): the head drifts toward the target

- **Visual, roughly measured from pixels:** In the front views, the head moves about 20 px toward the target (image-left) between address and the top on both heroes. At this scale that's about 10–12 cm, and it reads as a mild reverse pivot. In the reference, the head stays put or moves slightly away from the target.
- **Source:** At the top row (`.435`), root X is `+.02`, only 5 cm away from the target. `side` goes from -.30 at address to +.11 at the top, a 0.41 rad swing, which moves the head toward the target. Some bend toward the lead side at the top is realistic, but this much outweighs the pelvis shift.
- **Fix:** At `.435`, set `side` to about `.00` and root X to about `+.045`. Leave the `1.15/2.4` row roughly where it is so the transition timing stays the same.
- **Also check:** The source asks for 90° of chest turn at the top (`chest` 1.57), but from the front the jacket still faces the camera a lot. It looks more like 45–60°. Read the world yaw of the chest bone at 1.044 s in the GLB. If it's well under 90°, the joint chain is absorbing the turn, and that's a separate bug from the keyframe values.

### 3. Trail wrist, 59–69°: not visible in these frames, so split it into components before accepting

- **Can't judge from these images:** The four frames don't include transition (about 1.15 s) or release (about 1.32 s), where the README says the peak happens. At the top, where the trail wrist is already bent a lot, I see no crease, gap or twisted hand on either hero.
- **Judgment:** If the 69° is mostly the wrist bending back (extension), it's within a real golfer's range at the top and in transition, and isn't a problem. If more than about 30–35° of it is sideways bend (radial/ulnar), it's past the joint limit. It would then show as a kink at the heel of the hand in motion, especially on the Ace's thin forearms.
- **Fix:** Have the anatomy test report the trail wrist as bend-back/forward and sideways separately. Then take two close-ups at 1.15 s and 1.32 s with `tools/capture-hand-detail.mjs`. Only change the club frame or the trail clavicle limit if the sideways part is over the limit.

## Not blocking

- **Club at the top:** The side view shows a near-vertical shaft. That's correct: the source direction `[-.94,0,.34]` is roughly parallel to the target line and pointing at the target, so the shaft is foreshortened from that camera. It isn't a steep or laid-off club.
- **Finish (1.970 s):** In the side view the elbows flare into a "hands-up" diamond. If you want a more relaxed finish later, lower the finish grip height from about 1.73 to about 1.62 and tip the shaft down behind the back (direction z around -.3). This is cosmetic.
- **Address:** Spine tilt, knee flex, where the hands hang and the shaft angle all look good on both heroes.

## Follow-up implementation

The final candidate corrects the impact/root motion and top tilt. The lead wrist now stays within 30 degrees. A bounded trail-elbow swivel separates sideways bending from wrist extension. A centered offline filter removes swivel discontinuities. The release path begins earlier to preserve smooth forearm motion. All six dense anatomy and all six existing skin/feet tests pass. Candidate and review images remain under artifacts.
