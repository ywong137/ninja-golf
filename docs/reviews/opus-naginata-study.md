# Ethan naginata review: light (`Naginata_Cut_Diagonal`) and heavy (`Naginata_Heavy_Cleave`)

**Main problem:** the arms, not the body, are driving the weapon. The shaft direction comes from the right wrist alone, and the left hand's position is derived from that direction. Since the wrist is held neutral, wherever the right forearm points decides where the blade points and where the left hand ends up. The authored hand targets also place both hands at or behind the shoulders during the wind-up.

I only read files; I didn't run anything. The failure mechanisms below come from matching the renders against the code, and the probe in §4a is how to confirm them before rewriting. The renders are labelled "The Vice President"; I've assumed that's Ethan's character. I used the `monk` grip entry.

---

## 1. What's wrong in the shipping clips

**Whole body (both clips, all 16 frames)**
- **Legs:** the legs look the same in every frame. It's a square, wide squat with the feet about 0.44 m apart side to side and toes forward. There's no visible step, weight transfer, knee drive or heel lift. The script does author a 0.18 m (light) and 0.25 m (heavy) left-foot step, but nothing of it reads. Naginata never gets the wide footwork the odachi gets (`author-heavy-motion.py:179` is odachi-only). `BASE` (`:11`) is also shared between the two weapons.
- **Pelvis and chest:** in the front view the character stays nearly square to the camera, and I can't see any wind-up twist or release. The arms do all the work.

**Weapon path**
- **Front view:** the blade mostly sweeps sideways across the body. At light 0.286 s and heavy 0.542 s the shaft is horizontal and points out to the character's right.
- **Side view:** the blade flips from overhead-behind (light 0.057–0.114 s, heavy 0.108–0.325 s) to hanging down in front of the shins (light 0.229 s, heavy 0.433 s). The "hit" points at the character's own feet, not at a target 1.5–2 m away.
- **The data is lateral too:**
  - Light: shaft goes from `[.84,.26,.48]` (left, back, up) to `[-.77,-.60,-.21]` (`:23`).
  - Heavy (`:27`) is almost the same diagonal, just scaled. Light and heavy read as one move at two speeds.

**Why the rear hand ends up behind the body.** I computed these from `:23`, `:27` and `:55`, where the lead hand is at `mid + d·.14` and the rear hand at `mid − d·.14`:
- **Light wind-up:** right (lead) palm is at about `[.27,-.08,1.39]`, left palm at about `[.03,-.16,1.25]`.
- **Heavy wind-up:** right palm at about `[.27,-.06,1.50]`.
- In the source axes, +x is the character's left. So the right hand is placed outside the left shoulder, level with the shoulder joints. The right arm has to wrap across the neck, and the arms cross by construction.

The runtime then makes it worse:
- **Shaft comes from the right wrist.** For native clips, `hand-grip.js:108` returns early, so the weapon's rotation is just the right hand's world rotation.
- **The left target hangs off that.** `solveSecondary` (`:131–160`) puts the left hand at `right palm − shaft·spacing`. Any error in the right wrist's angle becomes a position error on the left hand (20° × 0.28 m ≈ 10 cm), and it gets bigger with wider spacing.
- **The left wrist isn't neutral after solving.** `solveGripArm` swings the upper arm with `setFromUnitVectors`, which leaves its twist uncontrolled, then forces the hand's world rotation (`:24–27`). The left wrist absorbs whatever is left over.
- **Possible elbow flips:** the bend-plane fallbacks use world axes (`:18–19`).
- **Possible hand flips:** `alignWeaponShaft` on the left hand uses a minimal rotation, so it has a 180° ambiguity when the axis is nearly reversed.

**Neutral wrist ties the shaft to the forearm.** In grip data, the grip axis is about 78° from hand-local +Y (`acos .20`; the palm centre at y = .070 suggests +Y is the wrist-to-knuckle axis). With an exactly neutral wrist, the shaft therefore sits nearly perpendicular to the forearm. The renders are consistent with this:
- forearms pointing forward give a sideways shaft (front view, 0.286 s);
- forearms held level give a blade pointing down (side view, 0.229 s).

**Weapon setup** (`weapons.js:95,105`)
- The lead hand sits 0.095 m below the blade collar, right against the fittings.
- The rear hand is at 0.375, leaving 0.51 m of shaft behind it that swings past the body.
- It's held like an overlong sword, pivoting between two hands that are close together.

**Timing (light)**
- The load pose is reached at 0.048 s (hit × 0.32), about 3 frames, so there's no anticipation.
- The shaft then rotates about 150° in 55 ms. It reads as a twitch.
- The heavy's hold length is fine, but its pose is wrong.

## 2. What the reference frames show (steps 7→16, order only)

**Limits:** these are YouTube page captures, and the people are about 150–200 px tall. I can't measure hand spacing or which hand leads in every frame. The time between steps is unknown.

**Consistent across all ten frames (grey-gi wielder):**
- The shaft and both hands stay in front of the torso. No hand goes behind the head or the back, even when the weapon is raised (8, 9).
- The hands are always well apart along the shaft; they never bunch together like a sword grip.
- The stance is long, low and front-to-back with bent knees. It's lowest in 13–14.

**Sequence:**
- **8 → 9 → 10:** the shaft goes steep with the hands high in front (8). It then tips back over the head (9). Then the arms extend forward toward the partner with the torso leaning in and the front knee bent (10). The raise comes first; the reach forward comes with the lean.
- **11:** the shaft ends steep and forward-down, tip near the ground in front. It continues past horizontal instead of stopping there.
- **12:** the shaft is near vertical in front of the body as a guard while the partner cuts.
- **13–14:** a low, level shaft aimed at the partner.
- **15–16:** the shafts meet on the centerline.
- The partner's lunges (11, 15), with the rear leg almost straight and the torso inclined, are a good silhouette reference for a heavy contact pose.
- **Arc direction:** the big arcs move toward the opponent, in the vertical or diagonal plane that contains the line between them. None of the frames looks like a sideways wave.

## 3. Keyframe plan (original authoring, not traced)

**Conventions**
- Axes are the author script's source axes: +x = character's left, −y = forward, +z = up, in metres. The origin is the floor between the ready-stance feet.
- Yaw is in degrees; + means turned so the right hip comes forward. Map this to the script's `hip`/`chest` sign by checking one frame; don't guess.
- The right hand is the lead (blade side) and the left is the rear. Both thumbs point toward the blade.
- Assumed body: shoulders at 1.42 m, shoulder half-width 0.19 m, R (max shoulder-to-palm distance) ≈ 0.63 m. Replace these with rig measurements; the validator in §4 enforces them.

**Grip:** lead station 0.36 m below the blade origin, rear station 0.76 m. That gives **0.40 m spacing** and leaves about 0.12 m of butt behind the rear hand.
- ≥ shoulder width, so each hand can sit in front of its own shoulder.
- Still lets the rear palm stay at least 8 cm in front of the belly at contact with the lead arm at ≤ 0.90 R. I checked 0.46–0.55 and it breaks this at level-shaft contact.
- **If a key fails reach or clearance, fix it in this order:** lower the rear hand (steeper shaft), advance the pelvis, then slide the lead hand back along the shaft. Never stretch the arms or bend the wrist.

**New Ready (chudan).** Every naginata clip has to start and end here (`check()` enforces it).
- **Feet:** right `[-.13,-.20]`, left `[.15,.20]`, rear toes turned out about 35°. Weight 55% rear.
- **Pelvis:** shift `[0,.01,-.07]`, yaw +30. Chest yaw +25, bend 0.17.
- **Hands and shaft:** rear palm L `[.04,-.25,.98]`, lead palm R `[.02,-.64,1.08]`, shaft d `[-.05,-.97,.25]`. The tip is about 2.2 m out at head height.

### Light 1: diagonal cut from high right to low left (0.46 s, contact 0.19)

| t | Phase | Feet / weight | Pelvis shift, yaw | Chest yaw, bend | Rear L palm | Lead R palm | Shaft d |
|---|---|---|---|---|---|---|---|
| 0 | Ready | planted, 55% rear | [0,.01,-.07], +30 | +25, .17 | [.04,-.25,.98] | [.02,-.64,1.08] | [-.05,-.97,.25] |
| .11 | Load (wind-up twist) | planted, 65% rear, rear knee loads | [-.03,.05,-.09], +5 | −15, .12 | [-.02,-.36,1.26] | [-.20,-.18,1.57] | [-.45,.45,.77] |
| .135 | Release | rear leg drives | [-.01,0,-.10], +20 | −12, .16 | ≤ 3 cm from load | ≤ 3 cm from load | ≤ 10° from load |
| .19 | Contact | 70% front, front knee over toes, rear knee ~160° | [0,-.10,-.11], +40 | +30, .30 | [-.01,-.39,1.06] | [-.04,-.78,1.12] | [-.08,-.98,.15] |
| .25 | Follow-through | 75% front | [.01,-.12,-.12], +45 | +50, .32 | [-.02,-.37,1.06] | [.06,-.72,.88] | [.20,-.87,-.46] |
| .33→.46 | Settle → Ready | back to 55/45 | → ready | → ready | → ready | → ready | tip rises back; no loop |

- **Why this direction:** at load the lead hand is by the right ear and the rear hand is in front of the sternum, so the arms never cross. The current left-to-right diagonal forces the right hand over the left shoulder.
- **Lever action:** the lead hand travels about 0.77 m while the rear hand pulls about 0.14 m back and down.
- **Cut arc:** the arc is tilted about 33° from vertical and covers about 150° of heading, which should read well from the gameplay camera.
- **Feet:** both stay planted for the light. The drive comes from weight shift and knees, which avoids foot shuffles in a 0.46 s clip.

### Heavy: vertical overhead cleave with a step (0.80 s, contact 0.38)

| t | Phase | Feet / weight | Pelvis shift, yaw | Chest yaw, bend | Rear L palm | Lead R palm | Shaft d |
|---|---|---|---|---|---|---|---|
| .10 | Rise (blade passes vertical in front) | 60% rear | [0,.04,-.06], +20 | +18, .12 | [.03,-.34,1.20] | [.03,-.52,1.56] | [0,-.45,.89] |
| .22 | Overhead load | 70% rear, front heel light | [0,.07,-.06], +15 | +10, −.05 | [.02,-.36,1.47] | [-.02,-.14,1.80] | [-.10,.55,.83] |
| .27 | Release, front foot lifts ≤ 5 cm | rear leg pushes | pelvis starts forward | — | ≤ 3 cm | ≤ 3 cm | — |
| .34 | Front foot plants at `[-.13,-.50]` | | | | | | |
| .38 | Contact | 70% front | [-.02,-.24,-.14], +12 | +8, .35 | [0,-.52,1.02] | [-.01,-.90,1.14] | [-.03,-.95,.30] |
| .46 | Low finish, hold to .56 | 75% front, lowest pelvis | [-.02,-.28,-.19], +12 | +10, .30 | [.12,-.47,1.03] | [.07,-.85,.90] | [-.12,-.94,-.32] |
| .56–.70 | Front foot steps back | | | | | | |
| .80 | Ready | | | | | | |

- **Overhead load:** the tip is about 3.2 m high, the shaft passes about 14 cm in front of the head, and both hands stay in front of the face.
- **Contact:** the tip is about 2.4 m out at head height.
- **Finish:** the tip ends about 0.4 m above the ground about 2.4 m out, not at the character's shins.
- **Rear hand at the finish:** it moves to the front-left of the belly (x ≈ +0.12). This rig's belly leaves no clearance on the centerline.

### Elbow swivel targets
- **Definition:** φ is the angle around the shoulder→palm axis. φ = 0 means the elbow points at the chest's down direction; + is outward. When the arm is near vertical (|n·down| > 0.85), blend the reference to chest-forward.
- **Light:**

  | Arm | Ready | Load | Contact | Follow |
  |---|---|---|---|---|
  | Lead | 20° | 55° | 15° | 10° |
  | Rear | 25° | 20° | 10° | 5° |

- **Heavy:** about 70° for both arms at the overhead load (elbows forward and out, never behind the ears); 15° lead / 10° rear at contact.
- **Allowed band:** −10° to +90°.

### Integration notes
- **Combat time-scaling:** `actors.js:201` time-scales each clip to `action.duration`, so the combat light/heavy durations and hit windows must change too. Otherwise the 0.46 s clip gets squeezed back to 0.40 s.
- **Script changes:**
  - `HITS` (`:10`)
  - naginata-only `BASE` and footwork
  - replace the fixed-height elbow poles (`:56`) with a φ channel

## 4. Solver design and acceptance checks

**4a. Measure first.** Run this on the current 8+8 sample times and log per frame:
1. Angle between the authored shaft (tip − grip) and the runtime weapon +Y.
2. The runtime left palm, expressed in the `spine_03` frame, and its distance from the authored `offGrip`.
3. `handGrip.report` translation and reach errors.
4. Left and right wrist rotation vs `neutralHandRotations`, split into flex/extension and radial/ulnar deviation.
5. φ per arm (to catch flips).
6. The grip-axis vs hand→`middle_01` angle (I expect about 78°).
7. Rendered foot positions vs the authored `footR`/`footL`.

What I expect to see: (1) over 20° around the wind-up and contact; (2) the left palm behind the chest plane at light 0.057–0.114 s and heavy 0.108–0.325 s; (4) a large left-wrist deviation. If (1) is small instead, the problem is in the bake and not the runtime chain.

**4b. Strict-neutral two-hand solve (offline bake, world-space vectors only, no Euler guessing)**
- **Anatomical frames:** derive them once from bind or idle positions: the elbow hinge from the shoulder, elbow and wrist positions; the palm normal from `index_01`, `pinky_01` and `middle_01`.
- **Per frame:** from the authored rear palm, d and s, set the lead palm = rear palm + s·d.
- **Per hand, with the hand exactly neutral:** the forearm frame F has to carry the grip axis g onto ±d. That leaves one free angle γ around d.
  - For each γ: elbow = palm − F(γ)·p (p = the palm's grip point in forearm space). Keep solutions with |elbow − shoulder| = upper-arm length.
  - Each root gives an upper-arm frame from (elbow − shoulder) plus the hinge. The pronation left over must be within ±85°, and elbow flexion within 5–145°.
  - Pick the root closest to the authored φ, and continuous with the previous frame (γ within ±20°).
- **If no root exists,** the target is anatomically impossible with a neutral wrist. Report it and move the palm targets; don't bend the wrist.
- **If you choose to allow a wrist range instead** (recommended: flex/extension within ±15°, deviation within ±10°, penalized quadratically), then an unbounded re-aim is still ruled out. That's your call.
- **Twist bones:** spread pronation over them if the rig has any.
- Build every bone rotation as a full frame, never with `setFromUnitVectors`.

**4c. Runtime**
- For baked two-handed polearm clips, set the weapon from both palms: d = normalize(lead palm − rear palm), position from the lead station, roll from the lead palm projected perpendicular to d. Skip `solveSecondary`.
- **During crossfades only:** fix the spacing symmetrically about the midpoint, then run the same φ-continuous solver, fading it out as the blend ends.
- Assert that both hand axes satisfy axis·d > 0. That removes the 180° ambiguity in `alignWeaponShaft`.

**4d. Acceptance checks** (on the evaluated runtime skeleton, sampled at 120 Hz):

| Check | Threshold |
|---|---|
| Palm centre to station, each hand | ≤ 5 mm |
| Palm grip axis vs shaft | ≤ 3° |
| Spacing | 0.40 ± 3 mm |
| Finger grip weight, both hands, whole clip | ≥ 0.99 |
| Palms in front of the chest/belly front surface | ≥ 0.08 m (torso capsule measured from each mesh) |
| Wrist deviation | ≤ 1° strict, or ≤ 15° / 10° if you allow a range |
| Pronation | ≤ 85° |
| Elbow flexion | 5–145° |
| φ | inside −10°…+90° |
| φ change | ≤ 25° per sample; the hinge-plane normal's sign never flips |
| Forearm to forearm (segment distance) | ≥ 0.09 m |
| Forearm to torso | ≥ 0.02 m |
| Shaft to head | ≥ 0.05 m |
| Blade to own legs | ≥ 0.05 m |
| Lead reach | ≤ 0.90 R |
| Rear reach | ≤ 0.80 R |
| Bone lengths | unchanged within 1e-4 |
| Planted-foot drift | < 5 mm |
| Pelvis over the planted-foot polygon | inside, with 3 cm margin |
| Heavy: foot plant before contact | ≥ 40 ms |
| Order of angular-speed peaks | pelvis → chest → lead shoulder → shaft, each 15–40 ms apart |
| Shaft speed peak vs contact | within ±15 ms |
| Blade edge normal vs tip velocity (contact ±30 ms) | ≥ 0.85 |
| Heavy cut plane vs vertical-forward plane | ≤ 20° |
| Light cut plane tilt from vertical | 25–45° |
| Tip distance at contact | ≥ 1.8 m light, ≥ 2.2 m heavy |
| Runtime palms vs authored targets | ≤ 1 cm |

**Visual check sheet:** front, side, top-down and the gameplay camera, drawing:
- the shaft line
- palm dots labelled by station
- elbow-plane arcs
- the chest front plane
- a tip trail

Frames that fail a check are outlined in red.

**Suggested first iteration:**
1. Run the 4a probe.
2. Switch to the two-palm weapon pose and skip `solveSecondary`.
3. Set stations to 0.36 / 0.76.
4. Author the new Ready plus these two clips.
5. Render the check sheet.

Adjust the keys ±3–5 cm until the validator passes, then re-derive the other six naginata clips and Musou from the new Ready.
## Provenance

The owner authorized this review through the signed-in Claude CLI account. The response identifies canonical model `claude-opus-5-5`, effort `high`. The original response is `/tmp/ninja-naginata-opus-review.json`.

The reference images show decoded frames at seconds7 through16 of the supplied video. The review treated them as ordered frames because the screenshots omit timestamps. Its proposed coordinates and acceptance ranges require validation against the actual rig. They are authoring guidance, not measurements recovered from the video.
