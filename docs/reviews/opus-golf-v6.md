# Ninja Golf swing review: v6 address vs. full swing (left-handed)

**Bottom line:** v6 fixes the bent-arm address, but it introduces a lateral lean and a few contact and clearance problems, and it doesn't blend into the old takeaway. The full swing is still structurally wrong. The arms are free IK chains connecting two separately authored paths (body table and world-space grip table), so elbow bend, wrist bend and wrist twist are whatever falls out of the solve. Tuning won't fix that. The dependency needs to be reversed.

**How I read the scene** (from the code, `author-native-golf.mjs:94`):
- Axes: +Y is up, +Z is toward the ball, −X is the target/lead side (the character's right), +X is the trail side.
- Signs: `body.hip` and `body.chest` greater than 0 mean turned away from the target. `body.side` less than 0 means the spine is tilted away from the target (Rz takes +Y to (−sin s, cos s, 0)).
- Cameras: "front" looks from the ball side (image right = trail). "Side" looks from the target end (image right = ball).
- References: John Baker is a right-handed face-on player, so I mirrored him. Frame 90 is one frame, and I can't tell its phase or handedness. The only things I use from it: the raised foot pivots on the ball of the foot with the knee turned in toward the planted leg; the arms stay extended in front of the sternum; the planted leg is braced.
- Ranges below come from typical golf biomechanics, not from 3D measured off these monocular images.

I'm assuming the code snapshot is what produced v6. Row 0 `side:-.30` matches the new trail-side lean in the v6 front view.

---

## 1. v6 address

**What improved:** both arms read as extended and the triangle is back. Both feet are planted.

**New flaws, front view:**
1. **The upper body leans off the ball.** The head and chest sit toward the trail side (image right) while the hands and shaft stay dead-centre and the pelvis stays level. The tilt is entirely spinal and kinks at `spine_02` (it gets 0.45 × side, `author:80`). With bend 0.65, `side −0.30` gives a face-on chest tilt of atan(tan|s|/cos b) ≈ **21°**. For an iron, 5–12° is typical. My guess is that this tilt is what makes the trail arm (7–17°) reach straight. The trail arm should instead stay soft (10–25°) and absorb that length.
2. **Club and hands look lifeless.** The shaft is exactly vertical and the hands are exactly central, with no forward lean and no hands toward the lead thigh. Low priority.
3. **The clubhead now sits low.** It reads as lower than before in both views (see side view, item 4).
4. **Ace's upper arms press into the chest silhouette.** Run your arm-clearance check on the hero with the largest chest.

**New or newly exposed flaws, side view:**
1. **The grip butt shows above the lead hand and points into the lead hip crease.** By pixel scale that's roughly 10–17 cm of grip above the hand; a real grip shows 1–3 cm. Measure two things: grip end to lead-hand centre, and grip end to the pelvis/thigh surface (target ≥ 10 cm).
2. **The head is craned up.** `Head` world pitch is 0.40 rad while the chest bend is 0.65, so the neck is extended about 14° (about 22° for the 0.885 arm-scale heroes, because `fitting` adds bend but not head pitch). The eyes look past the ball. This was already there, but straight arms make it more obvious.
3. **The legs look nearly straight with vertical shins.** The pelvis is pushed back and the weight reads as on the heels. Measure knee flex: the target is 15–30°, with the knee over the ball of the foot. Already there before v6.
4. **The clubhead probably sits slightly below the ground.** In this view the head is farther from the camera than the lead foot, yet it draws lower than the lead sole. Check the lowest head vertex for y ≥ −5 mm. A 1–10 mm tip error doesn't prove the sole is clear.

**Where v6 meets the old swing:** row 0 changed but the takeaway row didn't. By t=0.528 s:
- `side` goes from −0.30 to +0.04. That's a reverse-pivot lurch: by my estimate the head moves about 8–10 cm toward the target and rises 3–5 cm by the top (measure the `Head` Y and X).
- The lead elbow goes from 7° to 45° (Ronin), so the lead arm collapses during the takeaway.

Also, v6's lead elbow at **7°** is exactly the floor set by the `.998` reach clamp (`author:39`; 0.998(a+b) works out to about 7.3°). The address is sitting at the reach limit, so the grip correction at `author:103` is active and can jitter.

## 2. Full swing (the old frames, still shipping in v6)

| Phase (t) | Measured / visible problems |
|---|---|
| Takeaway 0.528 | Lead elbow 45° (Ronin); lead wrist 78–88°, trail wrist 3–10°. The lead wrist does everything and the arm folds. |
| Top 1.044 | Lead elbow 12–15° is fine. Wrists are backwards: lead 42–46°, trail 21–23° (the trail wrist should be 60–85° extended). Face-on spine tilt is **7.6° toward the target** (reverse pivot). The hands sit laterally between the shoulders (lead wrist z 0.21, shoulders z 0.02–0.37) instead of over the trail shoulder. The head rises (about 5 cm front, more in the side view). |
| Transition 1.15 | Lead elbow 35°; both wrists 0–4°. The wrist cock is thrown away at the top, then the wrists re-hinge. |
| Delivery 1.32 | Trail elbow 87–99° at belt height, only about 5 cm forward of the trail-hip plane (risk of hitting the hip). The lead forearm lies flat across the belt, pointing away from the target. Visually the arms wrap around the belly. |
| Impact 1.40 | Lead elbow 46–47°, trail 61–72°, lead wrist 71–81°: both elbows chicken-winged. Hands are at address height and only 5 cm forward. The pelvis is at its **lowest point** (−7.5 cm), so the lead leg never braces. The render doesn't look like 38° of open hips; check that the pelvis heading actually shows on the mesh. |
| Release 1.56 | Lead 43–51°, trail 40–60°, lead wrist 78–86°. The arms never extend after impact. |
| Finish 1.97 | Trail leg is a straight, splayed kickstand; the trail foot only yaws 27° and pitches 53° (`author:87-88`). The pelvis is at x −0.115 against a lead ankle at −0.205. The lead knee is still bent (pelvis y −0.045). |

The wrist angle over the swing (takeaway 78, top 46, transition 4, delivery 37, impact 71, release 78) isn't monotonic. That's the signature of the roll-search problem in cause 2 below.

## 3. Mathematical causes in the code

`author-native-golf.mjs` = `author`, `golf-motion-profile.mjs` = `profile`, both in `/tmp/ninja-golf-opus-review/`.

1. **Club-first architecture** (`profile:24-38`, `author:94-104`).
   - The grip path and shaft direction are authored in world space, separately from `GOLF_BODY`, so the elbow angles are left over from the solve.
   - At impact, the lead shoulder (−.227, 1.357, .174) to lead wrist (−.081, .903, .354) distance is 0.510 m. That's 0.916 of the arm length, which forces about 47° of elbow bend. A straight arm needs the hand about 4 cm farther out along that line.
   - When the target is out of reach, `author:103` translates the whole club toward the shoulder. That breaks both contact and the lead-arm line.
2. **The wrist cost can't see twist, and can't fix bend** (`author:52-65`).
   - The cost is the angle between the forearm and the hand's knuckle axis. Twist about the forearm costs nothing.
   - Roll about the shaft is the only free variable, and it moves the knuckle axis around a cone of fixed half-angle around the shaft. So the smallest wrist bend it can reach is about |∠(forearm, shaft) − ∠(knuckle axis, shaft)|, which the pole and the authored shaft direction already fix. Takeaway 88° and impact 81° are exactly that gap.
   - Each hand runs its own roll search every frame: a 15° grid, then a ternary refine that assumes one minimum, with no warm start. The two hands can therefore roll differently on the same grip and jump between minima from frame to frame.
3. **Forearm roll is locked to the elbow plane** (`author:35, 43-44`). `segmentFrame(direction, cross(upper, lower))` gives the forearm no pronation or supination beyond its rest value. All the axial twist lands in `hand_*`, which looks like the arms twisting and pinches the wrist skin.
4. **Elbow poles push the elbows forward and outward** (`author:99-100`).
   - The guides have ±0.18 outward x and +0.24/+0.28 forward z in the chest frame, so the elbows bow out like hugging a barrel.
   - The poles are blended by `back = chest/1.57` and `finish = −chest/1.92`. Near impact the chest yaw is about −0.40, so `back`=0 and `finish`=0.21, which puts the address guide back in place at impact. That flares the elbows right at the strike.
   - Clavicle protraction uses the same stand-in for phase, so changing the yaw values in the rebuild will silently change the poles and shoulders too.
5. **Spine side-bend table** (`profile:14-22`). Face-on tilt runs 21° away (address), then 7.6° toward the target (top), then 14° away (impact). Impact should have more tilt away from the target than address, and the top should never tilt toward it.
6. **Pelvis yaw turns about the hinged pelvis axis** (`author:31, 78`). The rotation order is `Rx(bend)·Rz(side)·Ry(yaw)`, which tilts the pelvis sideways by about asin(sin yaw · sin hinge): roughly 18° at the top and 17° at impact, against a typical 5–15°. The same order is right for the thorax, because that's what makes the shoulders turn on a tilted plane.
7. **Pelvis height is timed wrong.** The lowest point is at impact, and the finish is still −4.5 cm, so the lead leg never straightens.
8. **Short-arm fitting rounds the back** (`profile:60`). It adds +0.138 rad of chest bend but only +0.092 of hip hinge, plus extra side tilt, and the head pitch isn't compensated.
9. **Head and neck** (`author:80-82`). `neck_01` is set to the chest orientation, so all of the up-to-68° head-to-thorax turn happens at a single joint, and the head's forward pitch is less than the chest bend.
10. **Interpolation.**
    - The shaft direction is interpolated component by component with Hermite curves and then normalised, which gives uneven angular speed and wobble off the swing plane.
    - The tangents for pelvis and chest yaw are unclamped, so the pelvis tangent is still positive at the top key. Pelvis and thorax reverse at the same time, so the pelvis never starts the downswing first.

## 4. Phase targets for a left-handed swing (mid-iron)

"Away" means away from the target (+X). Δ is relative to address, and "cm" means world-space cm. Angles come from world-space vectors:
- **Pelvis heading:** (thigh_l − thigh_r) projected onto the ground.
- **Thorax heading:** the clavicle roots.
- **Forward tilt:** pelvis to neck, in the plane perpendicular to the target line.
- **Face-on tilt:** the same vector, in the XY plane.

### Body

| Phase | Pelvis yaw / Δx / Δy | Thorax yaw; forward tilt; face-on tilt | Head | Lead leg (R) | Trail leg (L) | Weight on lead foot |
|---|---|---|---|---|---|---|
| P1 Address | 0 / 0 / (3–6 below standing) | 0±5; 35–45°; 5–12 away | Aimed at the ball; neck flexion vs thorax 0–20 | Knee 15–30, over ball of foot | Same | 45–55% |
| P2 Takeaway (shaft parallel) | 8–15 away / 0…+2 / 0 | 35–50 away; hold ±3; 5–12 away | Δx 0…+3 | Knee starts in 0–3 cm | Hold flex | 40–50 |
| P3 Lead arm parallel | 25–35 / +1…+4 / 0…+1 | 60–80; ±5; 0–10 away | 0…+4 | Knee in 3–8 cm | Flex 15–30 | 30–40 |
| P4 Top | 35–50 / +1…+5 / 0…+2; lead hip 5–12° lower | 85–100 (X-factor 40–55); ±5; 0–10 **away** | Δx +1…+5, Δy ≤3; turned 55–75 vs thorax | Points behind ball, flex 25–40, heel down | Flex 15–30, knee inside the foot, hip back 5–10 cm | 25–40 |
| P5 Lead arm parallel, down | 5–20 away / −3…−8 / **lowest, −1…−4** | 60–80 (X-factor +3–10); ±5; 10–20 away | Δx 0…+5 | Back over ankle, flex 25–35 | +5–10 flex, knee heads to target | 50–70 |
| P7 Impact | 30–45 open / −8…−14 / −1…+3; lead hip 8–15° higher | 15–30 open; ≤10 less than address; 15–30 away | Behind the ball Δx 0…+6, Δy ±3 | Flex 10–25, hip over ankle | Flex 30–45, heel 0–3 cm | 70–90 |
| P8 Release (shaft parallel) | 50–65 / −12…−16 / +2…+4 | 45–70 open; 25–35; 25–40 away | Starts to turn | Flex 5–15 | Heel 5–10 cm | 80–95 |
| P10 Finish | 80–100 / over lead foot ±5 / +3…+6 | 95–120; 0–15; 5–20 away | Facing target, within 20° of thorax | Flex 0–10, vertical | On the toe: pitch 70–90, yaw 60–100; knee within 5–10 cm of lead knee | 90–100 |

### Arms and club

| Phase | Lead elbow | Lead wrist (swing only) | Trail elbow | Trail wrist | Hands / club |
|---|---|---|---|---|---|
| P1 | 0–10 | Radial 10–20, extension 10–25, total ≤35 | 10–25, points at trail hip | Extension 10–25 | 0–8 cm target side, 10–18 cm off thighs, lean 0–8° |
| P2 | 0–10 | Radial 15–30 | 20–40 | Extension 20–40 | At trail thigh, shaft ∥ target line ±10°, toe up |
| P3 | 0–15 | Radial 20–30, flex −10…+15 | 60–85 | Extension 40–60 | Shaft about 90° to lead arm |
| P4 | 5–20 | Radial 20–30, flat to 20 flex, total ≤40 | 80–100, elbow 20–30 cm below hands | **Extension 60–85** | Hands 15–30 cm above and over trail shoulder |
| P5 | 0–15 | Cock held | 70–100, 10–20 cm in front of trail hip | Extension 50–80 | Lead-arm-to-shaft angle 60–90 |
| P7 | **0–8** | Ulnar 0–15, flex 5–20, total ≤30 | 20–40 | Extension 20–40 | Hands 5–15 cm ahead, 2–6 cm above address; lean 5–15° |
| P8 | 0–15 | Lead forearm supinates (the roll happens in the forearm) | 0–15 | 0–20 | Both arms extended, toe up |
| P10 | 70–110 | — | 70–110 | 20–50 | Hands by lead ear, shaft behind the neck, ≥5 cm clear of the head |

Wrist twist at the wrist joint should stay ≤10–15° in every phase; pronation and supination belong in the forearm. Pronation/supination terms don't change with handedness.

## 5. Implementation constraints for the rebuild

1. **Lead arm drives the club, not the other way round.** Per frame:
   - Solve the body first (pelvis, thorax, legs to the feet).
   - Place the lead shoulder from the clavicle.
   - Author the lead-hand path in the **thorax frame**, then project the lead wrist onto the reach sphere |W−S| = L·r(t), with r = 0.985–0.995 for P1–P8. Don't rely on the 0.998 clamp.
   - Hand orientation = forearm frame (with authored or solved forearm roll) × wrist rotation (cock and flex, built from landmark axes, zero twist).
   - Club frame = lead-hand world transform × inverse lead-grip transform. The shaft direction is an *output*, so delete `SWING.direction`, or keep it only as a check.
2. **Two hands on one shaft.** Use fixed grip transforms for both hands in the club frame, from grip-data, and one shared clubface roll φ(t). Drop the per-hand roll search. Gates: grip centres ≤3 mm off the shaft axis; spacing 90 mm ±3; hand-to-hand relative rotation constant to ≤2°.
3. **Trail arm.**
   - Two-bone IK to the trail grip point.
   - Pole toward the trail hip joint (and toward the ground at P4), not a fixed chest-frame constant.
   - If out of reach, adjust in this order: trail clavicle protraction or elevation (≤0.15 rad), then lead wrist cock. **Never** translate the club.
4. **Twist distribution.** Split each wrist-relative-to-forearm rotation into swing and twist about the forearm axis. Put the twist on `lowerarm_*` (or its twist bones) and give the hand only the swing. Check: wrist twist ≤15°, and hand-in-forearm change ≤3° per frame at 120 fps (≤8° near impact).
5. **Hip hinge.** Put the tilt in the pelvis, with no more than 10–15° of thorax-on-pelvis flexion. Remove the `fitting` chest-bend term: shorter arms should get more hinge and knee flex, and the ball closer, per hero. Pelvis yaw about world vertical, with lateral tilt authored separately. Keep the current intrinsic order for the thorax only.
6. **Pressure shift.** Use a segment-mass centre of mass projected onto the ground as a proxy, hitting the table's lead-foot fraction; the COM must stay inside the support polygon. The pelvis bottoms out at P5 and rises through impact.
7. **Heel pivot.**
   - Trail foot: keep the current ball-of-foot pivot, but reach pitch 70–90° and yaw 60–100° at the finish.
   - Knee pole toward the lead knee from P7 on.
   - Lead foot: slides ≤3 mm, may roll to its outer edge ≤10°.
   - I didn't see `solveLeg`'s pole logic, so verify it.
8. **Contact.**
   - Lowest clubhead vertex ≥ −5 mm on every frame; at address and impact within −5…+10 mm and ≤10 mm from the ball.
   - Solve a small least-squares over pelvis x/y, thorax side tilt, lead wrist ulnar deviation and φ.
   - Spread the correction smoothly over a ±0.1 s window.
9. **Clearance.** Capsule proxies (pelvis, thighs, torso, head) against the forearms, elbows and shaft, ≥1 cm apart. Critical spots: the trail elbow at P5–P6, the lead arm across the chest at P4, the shaft by the head at P4 and P10.
10. **Head.** A look-at constraint on the ball (or just behind it) through P7+0.05 s, then follow the chest. Neck flexion −5…+25°, rotation ≤70°, split 40/60 between `neck_01` and `Head`.
11. **Timing and interpolation.**
    - Monotone (Fritsch–Carlson) tangents for the yaw rows.
    - Slerp or squad for directions and orientations.
    - Pelvis reaches its top 0.03–0.08 s before the thorax.
    - Peak angular speeds in order: pelvis, thorax, lead arm, club.
    - Drive the poles and protraction from explicit phase variables, not chest yaw.
    - Golf_Address must equal Golf_Swing at t=0, and the P2 row must be re-authored from the new address.

**What I couldn't check:** `solveLeg`, `palmWeaponBasis`, `grip-data.json` and the club mesh weren't in the snapshot. The butt protrusion, sole height and knee-pole points are image estimates, and each has a measurement listed next to it. The shaft is flat at address (about 41° to the ground for a 0.95 m club), which pushes the hands down to the crotch. Steepening it to 50–58° would help, if the prop design allows.
## Review provenance and limits

This review used the owner's authorized Claude CLI subscription with canonical model `claude-opus-5-5`, effort `high`, on 2026-09-27. The original JSON is `/tmp/ninja-golf-opus-review.json`.

The v6 screenshots used the old runtime golf motion records. That mismatch re-aimed the club and hands after native pose evaluation. Treat the review's v6 wrist, grip and clubhead visual conclusions as hypotheses, not accepted measurements. The native joint metrics and source-code review remain useful. The capture tool now requires matching motion records for a candidate model. Later full-swing candidates use that corrected path and separate dense anatomy checks.

The phase tables give proposed biomechanical ranges. They do not establish exact three-dimensional motion from the user's single-camera images. The independent authoring pass must verify them against the actual rig and motion references.
