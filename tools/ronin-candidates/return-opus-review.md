# Ronin Return V15 — Opus review

Model: `claude-opus-5-5`. Effort: `high`. The response modelUsage confirms the model.

Source: `/tmp/ronin-return-opus-v15/result.json`. Images: `return-full.png`, `return-contact.png`, and `first-cut.png`.

The reviewer inspected timed images. It did not watch the video. The model remains a private review candidate.

**Verdict:** I'd accept this on anatomy. The choreography is acceptable, and I don't see a defect in these frames that justifies rejecting it. What's left is optional polish, and the most useful piece is a stronger chamber.

## What stills can and can't show

These are eight timed samples plus a four-frame contact strip. They show pose, silhouette, weight placement and blade path. They can't show:
- the easing and acceleration between samples
- whether the peak speed feels like a snap into contact
- hitches, pops or foot slides between samples
- how readable the cut is at 0.85 s real time

The 0.60–0.85 recovery is the part least covered by samples. At 0.72 the side view still shows the feet apart; by 0.85 they're back together. So the foot recovery happens in about 0.13 s, and Root should watch that window closely in the movie. `measurements.json` puts peak joint steps around 0.38–0.41 s, just before the 0.435 contact. That's the right order, but I'm reading it from data, not seeing it.

## 1. Physical plausibility, hands, elbows, wrists

At this resolution they look plausible.
- **Contact (0.435, side):** The lead arm is nearly straight and the rear elbow is flexed, with the rear hand below and behind the lead hand. That's a normal two-handed extension.
- **Follow-through (0.60, front):** The left arm crosses the chest to reach toward the character's right. That's a natural cross-body reach, and I don't see hyperextension or a broken wrist line.
- **Hands:** They read as closed on the handle in every frame. I can't check each finger's wrap at this size.
- **Blade curve:** The blade looks much more curved at 0.48 and 0.60 (front view). That's the katana's normal curvature seen from the flat side, not a deformation. The first-cut side views show the same shape.

## 2. Distinct return slash vs. arm-only repositioning

It reads as a real cut. The tip travels about 90°, from upright at centre to horizontal on the character's right. That's the opposite side from the first cut, which ends low on the left, so it doesn't look like a replay. The torso and legs clearly take part (see point 3), so it isn't arm-only.

The weak part is the chamber. At 0.34 the pose is basically Ready with the blade a bit more upright: hands at chest height, nothing drawn back or loaded. In the first cut, by contrast, the hands go overhead. So the return reads more like a sweep out of guard than a separate strike.

## 3. Torso, weight transfer and feet

The side view shows good support:
- The stride is set by 0.34.
- At 0.435 the hips move forward between the feet as the torso leans over the bent front knee.
- At 0.60 the character is lower and further forward, and the head stays level.
- The torso rises again by 0.72.

In the front view, the shoulders and spine turn toward the cut. The legs and pelvis, though, look much the same from 0.34 to 0.60, apart from some added knee bend, so most of the rotation seems to come from the upper body. That's mild. It isn't wrong, just less hip-led than an athletic cut would be.

## 4. Reject or polish?

- **Anatomy:** Accept. Nothing visible contradicts the measured checks.
- **Choreography:** Acceptable. The cut reads as a cut and is supported by the body. It's a bit soft in the wind-up.

## Optional fixes, in priority order (all keep the current timing)

1. **Load the chamber from about 0.16 to 0.34.** Lift the hands toward shoulder height, or tip the blade back slightly, with a small counter-turn away from the cut direction. This is the one change that would most clearly make it read as a new strike.
2. **Lead the cut with the pelvis from about 0.34 to 0.435.** Rotate the pelvis toward the cut slightly before the shoulders follow. The foot paths wouldn't need to change.
3. **Recovery, 0.72–0.85:** Change this only if Root's full-speed review shows a pop or slide as the foot pulls back. Nothing in the stills calls for a change.
