# Ring_Heavy_Cleave v5 review

**Verdict:** v5 is a clear upgrade over before and fine to ship. I found no anatomical or choreography error in the frames that needs a change first. Two checks should pass before shipping, but neither needs an edit unless it fails. Everything else is optional polish.

## What v5 fixes (from the frames, not the numbers)

- **Lower body.** Before, the legs never moved in any of the 16 frames. Now the left foot is mid-step at .18. By .36–.50 there is a real lunge. In the front view the lead knee stays over the foot and doesn't cave in. In the side view at .42 the lead shin is close to vertical. The pelvis moves over the lead leg and the rear knee bends behind.
- **Torso.** At .18 the chest is turned right, with the right shoulder back in both the front and top views. It is square at .36, and the left shoulder is back by .42–.50. The keys fire pelvis before chest (`profile.mjs:14`: hip +6 against chest −8 at .32).
- **Chamber.** It is now a real overhead raise. At .18 the blade lies over the head pointing back-left, and at .28 the tip points up and back. That head-wrap chamber suits a dao.
- **Blade path.** The cut stays vertical on the character's right. In the top view at .36–.50 the blade points straight forward, right of the midline, and never swings across the lead leg.
- **Follow-through.** The body keeps moving forward and down after the hit (z .20→.225, y −.055→−.07) instead of holding a pose.

## Area by area

- **Leg and hip support: sound.** The rear foot doesn't pivot, and at this amount of hip turn I agree with that choice. With the pelvis turned +10 to +15° and the right foot planted facing forward, the right hip is only about 15° externally rotated. The baseline's 30–45° heel pivot was too much for this rotation and for a cut driven mainly by dropping.
- **Elbows: sound.** The sword elbow points out and up in the chamber (.18, .28), then down and back through the cut, and it never flips. At this resolution I can't rule out slight hyperextension at .42.
- **Contact timing: acceptable.** In the side row the blade turns about 45° between .33 and .36, then about 45° between .36 and .42. So it moves fastest right up to contact, peaking about one frame before the hit.
  - The .33 frame still looks like Ready from the waist up (compare `full.png` front 0.000 with 0.330). That's because the arm timing maps almost 1:1 through .36 (`profile.mjs:40`), so the arm still passes through the old Ready-like blend.
  - In v5 the frame reads as mid-swing: the tip is at its highest point, the hand is at shoulder height rather than chest, and the body is mid-lunge. Only playback can rule out a hitch there.
- **Follow-through: correct but shallow.** At .50 the blade is only about 15° below horizontal at hip height, nearly where the light attack ends. This is optional item 1 below.
- **Recovery: sequence is right.** Unwind with both feet down (.46–.64), rear heel down at .64, lead foot up at .68, lead foot lands at 1.02, arm reaches Ready at 1.06.
  - I checked the return step with a simple one-foot balance model: the body treated as an inverted pendulum balancing over the right foot. I assumed the right foot is about .22 m from the Ready midline and the pelvis is .8–.9 m high.
  - The keyed pelvis path stays within 1–2 cm of what that model gives, so the weight shift back is believable in its own right, not just on average.
  - One tight spot: only 40 ms (2–3 frames) separate the rear heel landing and the lead foot lifting. Watch for a hop.
- **Free arm: works, but understated.** It is forward and low at .18–.28, then out to the side at .36–.50. It moves out more than back. In the top view at .36–.50 the left hand is about level with the shoulder line, and in the side view at .42 it is barely behind the hip. It reads as a balancing arm rather than a pull-back against the cut.

## Hidden by the averaged number, but not a must-fix

The 30.6% loading average hides a reversal (`profile.mjs:11-13`):

- At .16 the pelvis is still, sitting back and to the right (x −.075, z −.03).
- By .26 it is at x −.005, z +.06. That's 7 cm toward and 9 cm ahead of the foot that is still in the air, in 100 ms.
- The same balance model says a body standing on one foot could move only about 1 cm in that time.

This is the cost of hitting at .36 from a square Ready stance, and hiding it inside the step is the right place. I'm not asking for a change. If playback looks like the character is being pulled forward, this is the first place to look.

## Verify before shipping

1. **Lower-body blade clearance** (already running). The closest spots in the images are:
   - .42–.55: in the side view the hand and pommel sit over the lead thigh. The top view suggests they are clear sideways, since the hand is right of the midline and the lead leg is on the left.
   - .68–.84: the blade rises while the lead leg swings back.
2. **Head clearance.** Which surface gave the 15.5 mm gap at .2167 s? If it was the head mesh without hair, the blade probably passes through the hair. No frame between .18 and .28 shows it.

## Optional polish (item 1 is my one bounded correction)

1. **Deepen the follow-through.** Change `chamberLift` (`profile.mjs:35`): about −16 at .43 (now −10) and about −22 at .50 (now −14), leaving −8 at .60 as is. It stays shoulder-only with no wrist change.
   - It's worth doing because it's the one place the heavy's blade still ends at the light attack's end pose.
   - My rough estimate is that the tip drops from about .35–.40 m above the floor to about .20 m. Re-run the floor and lead-thigh clearance for .43–.60.
2. **Free arm.** Pull it back toward the left hip (shoulder extension) during .36–.50 rather than raising it out to the side.
3. **Rear heel.** A 3.7 cm heel lift barely shows in heeled boots; 5–6 cm would sell the drive better.

## Denser views needed

- **.05–.30, step-in:** four views at 20 ms or tighter. Right now only .18 covers it.
- **.19–.26:** front and side, for blade against hair.
- **.30–.38 at 60 Hz:** to check for a hitch at contact.
- **.50–.70:** heel down, then lead foot lift.
- **.68–1.06, return step:** front and side at about 30 ms, with toe markers. This shows whether the lead toe clears the ground and whether it lands flat at 1.02.

## What the images can't establish

- **Motion between frames.** One example is how the pelvis stops at .36: from the keyed curves, forward speed is about 1.8 m/s at .335 and about 0.5 m/s at .36. That could read as a strong impact accent or as a snap.
- **Foot sliding** between samples. I'm relying on your .01 mm figure.
- **Wrist and finger detail, elbow hyperextension, and true 3D gaps** where parts overlap on screen.
- **Center of mass.** Everything above uses the pelvis as a stand-in.
- **Cancels during .68–1.02,** when the lead foot is in the air. That depends on the controller.

## Note on the evidence

The two side views are shot from opposite sides. In `full.png` forward is to the right of the screen, which matches a camera on −X. In the `four-views.png` Side row forward is to the left; at .18 the blue left-toe marker and the free arm both lead to the left. That means the camera is probably on +X, or the image is mirrored. Please fix the label or the render, because judging which arm is nearer the camera depends on it.

## Verification notes

The side view in the four-angle sheet uses the +X camera. The full-sequence side view uses −X.
The review prompt incorrectly described both as −X. These images are not mirrored.
The rendered rear foot does pivot: the authored angle reaches 32 degrees. The review did not see that pivot clearly.
The geometry scan includes skinned hair and eyes. It found no weapon/head, torso, or leg crossings.
The separate runtime scan found a carry-transition contact. Reducing the existing carry exit from 0.26 to 0.14 seconds fixed it.
Fifteen runtime entries then passed 3,840 head-clearance samples.
