# Shinobi Twin_Cut_Sweep: full-body pilot v5 review

**Model:** Opus 5.5 (`claude-opus-5-5`). I only read the eight named files and didn't edit or run anything.

## 1. Weight transfer, hip/chest sequence, commitment

**This is a clear improvement over the arm-only version.**

**What supports it:**
- **The pelvis leads the chest in both directions.** In the keys, from 0.10 to 0.17 the hip swings from −12° to +4° while the chest stays wound at −22°/−18°. From 0.385 to 0.43 the hip drops from 12° to 4° while the chest holds at 22°/20°.
- **Weight actually shifts.** `leftWeight` goes 0.25 → 0.68 → 0.32. Pelvis x moves about 29 cm side to side, with a 4–6 cm drop into each hit.
- **The weight arrives before each hit.** It reaches 0.68 at 0.26, 20 ms before the 0.280 hit.
- **The 0.280 three-quarter view reads as a real lunge.** The front knee is over the foot, the rear leg is long and the rear heel is up.

**Remaining faults:**
- **The torso stops, then starts again, at each hit.** Hip and chest both freeze together over 0.26–0.30 (16°/26°) and again over 0.512–0.555. Then the chest restarts to 30° (0.34) or −30° (0.60). The torso should decelerate into the hit, but this gives a stop and a second push. The pauses are about 40 ms, which the 10 fps playback can't show, so whether it looks like a hitch in play is unverified.
- **The trunk hardly bends.** Pelvis bend peaks at 3° and spine bend at 6°. In the side row, the trunk is nearly vertical over the feet in all eight phases. The 0.280 right profile has upright hips over the feet, with the arms reaching forward.
- **The Ready squat problem is still there.** The crouch comes almost entirely from the knees, splayed wide (front row 0.000, 0.464, 0.696, 0.812). In the playback strip (row 2, frames 1–2), this bow-legged squat is the most readable body shape at gameplay scale. The weight shift is barely readable there. **Verdict: more athletic in the middle of the attack, but it still starts and ends in the old squat.**

## 2. Toe pivots and knees

- **No foot or knee anatomy error is confirmed.**
- **The rear pivot looks right where the view is clear.** In the 0.280 three-quarter view, the rear foot is on the ball of the foot, toe pointing along the cut, heel lifted.
- **The splay at 0.532 is plausible.** In the front view the unloaded left foot is turned out about 60°, in line with the shin, and the loaded right knee sits over its foot. That matches the 2.89 mm medial figure.
- **The front-row thumbnails at 0.232–0.348 are perspective, not an error.** The right foot looks splayed outward there, which I put down to the lifted heel and foreshortening at thumbnail size.
- **The uneven foot heights in the 0.280 right profile are perspective.** The far foot sits higher because of depth in a wide side-to-side stance. Toe drift is 0.23 mm.
- **Is 80° plausible?** Yes, but only because the stance moves sideways. It makes the transfer read as a side-lunge more than a hip turn.

## 3. Grips and blade paths

- **All grips look credible.** In every contact image, the fists close on the handle below the guard and the blades come out at believable angles. The crossed blades at 0.280 are only overlap in the image; measured separation is at least 19 cm.
- **The cover blade is now a guard.** At 1.6 m/s it trails as follow-through and no longer competes with the active blade.
- **Neither hit is a horizontal sweep.**
  - Right hit velocity is (−2.95, −6.72, 7.17): mostly down and forward.
  - Left hit velocity is (3.2, −11.0, 22.8): mostly forward.
  - Both tips land at about head height (1.54 and 1.68 m).
- **The left hit is hard to read in stills.** At 0.532 front, the active blade is nearly upright with the tip over the head, because its motion is toward the camera. In the three-quarter view it tracks across the face.
- **I don't claim a head crossing.** The scan clears it: minimum clearance is 11.6 mm at 0.479, on the left. But 11.6 mm isn't a credible margin for a real cut.
- **One unchecked risk.** At 0.170 the right fist sits at the hairline. The blade scan excludes hands and forearms, and the arm checks cover the torso only. Since the head now counter-turns, fist/forearm-to-head clearance for about 0.10–0.20 is unverified.

## 4. Verdict

**This should not block integration.** It's a better animation than the arm-only version with no confirmed body defect, so it can go in as the next iteration. Run the fist/forearm-to-head check above before shipping, since it's the only gap I couldn't clear.

**Three corrections:**
1. **Remove the hip and chest holds at the hits.** Stop the hips at about 0.25 and 0.50. Let the chest decelerate straight through each hit to its ±30° peak, with no plateau.
2. **Add hip hinge and narrow the squat.** Raise pelvis/spine forward bend to about 10–15° at each hit. Bring the knees in over the feet. Point part of the 29 cm sideways pelvis travel along the cut instead.
3. **Fix the left cut.** Move its path outward and forward so it clears the head by several centimetres, not 11.6 mm. Bring the two hit speeds closer: the left is 25.5 m/s, about 42 cm of tip travel per 60 fps frame, which will smear. The opening right hit is 10.3 m/s and reads softer.

**Limitation:** the playback is 10 fps, with the character about 60 px tall, so these stills can't show real-time rhythm, the 40 ms holds, or how the fast left tip looks in motion.