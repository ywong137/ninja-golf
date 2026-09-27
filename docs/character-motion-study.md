# Character and controls study

## Sources and observations

- [SW5 official PC controls](https://www.koeitecmoamerica.com/manual/sw5/en/2400.html): mouse camera, left-click normal attack, right-click power attack, F Musou, and WASD movement. Keyboard-only alternatives are separate from the primary mouse layout.
- [Donna White, Keiser University College of Golf](https://collegeofgolf.keiseruniversity.edu/mastering-weight-transfer-in-the-golf-swing-balance-power-and-timing/): pressure shifts toward the lead foot before the backswing finishes. Pelvis, torso, arms, and club accelerate in sequence. Pressure transfer is not the same as large sideways body travel. The finish balances over the lead leg with the trail heel raised.
- [BodiTrak's Kevin Kisner demonstration](https://www.youtube.com/watch?v=TRebiq3T2NA), linked by White: observed a centered head during the strike, bent setup, coordinated turning, and a balanced finish. This is a visual reference, not motion-capture data.
- [All Japan Kendo Federation, Iaido](https://www.kendo.or.jp/en/knowledge/iaido-concept/) and its [English instruction manual, hosted by Martial Arts Toronto](https://www.martialartstoronto.ca/wp-content/uploads/2018/07/ZNKR-Iaido-2009.pdf), printed pages 12–21: distinguish horizontal, vertical, diagonal cuts, and thrusts. Rising and descending diagonal cuts connect without a stop. Foot placement accompanies the cut. A two-handed grip returns near the center of the body after a committed descending cut.

These sources guide animation. The combat remains exaggerated arcade fiction, not a reconstruction of a historical fighting school.

## Audit of the previous implementation

1. Most attacks reused Sword_Attack at different speeds. Root rotation supplied the apparent variation.
2. Golf used one shared rotation parameter for hips and shoulders. This prevented meaningful segment timing.
3. Golf wrists and club orientation followed separate curves. Two hands could separate from the shaft.
4. Narrow diamond blade cross-sections and uniform metal shading resembled pointed rods.
5. Outfit color determined enemy appearance, while nearly every enemy chased and struck the same way.
6. Mouse look required holding the button needed for heavy attacks. Important attacks also occupied the far side of the keyboard.

## Motion specification

### Golf

| Phase | Body | Arms and club | Feet |
|---|---|---|---|
| Address | Hip hinge, modest knee flex, relaxed head toward ball | Shared two-hand grip, club grounded behind ball | Shoulder-width stance |
| Takeaway | Chest begins turning over a quiet pelvis | Wide hand arc, gradual wrist hinge | Trail-side loading, no foot slide |
| Top | Shoulder turn exceeds hip turn | Lead arm long, trail elbow folded | Pressure begins returning to lead side |
| Transition | Pelvis opens before the chest | Hands descend while club remains behind them | Lead knee accepts load |
| Impact | Hips open, head still near the address position | Both hands on shaft, wrists releasing, real clubhead near ball | Lead foot stable, trail heel begins rising |
| Finish | Chest turns through, torso extends | Arms fold and club wraps around shoulder | Weight over lead leg, trail toe supports balance |

The animation curves represent visible mass movement. They do not simulate measured ground forces. Putting uses shoulder rocking with quiet hips and feet.

### Combat

Each attack has anticipation, acceleration, contact, follow-through, and recovery. The damaging window must align with the blade crossing the target area.

- Diagonal cut: load the rear hip, raise the hands, turn the pelvis, then cut across the torso line.
- Returning cut: recover through the opposite side, with a different elbow and blade path.
- Rising cut: lower the center, drive upward through the legs, then recover above the shoulder.
- Heavy cut: longer preparation, two-hand grip, deeper weight transfer, visible recovery vulnerability.
- Thrust: compact guard, forward step, arms extend along the weapon line, then retract.
- Musou: exaggerate established poses and linked cuts. Preserve a readable grip and a landing after the flourish.

Small distributed torso deformation supports these poses. Large uniform scaling or rotating the entire body cannot substitute for joint articulation.

## Visual and tactical identities

| Enemy | Silhouette and equipment | Behavior | Player response |
|---|---|---|---|
| Scout | Short jacket, open hood, paired short blades | Fast flanking rush and short recovery | Face the approach and interrupt |
| Guard | Lamellar armor and open helmet, broad sword | Advances slowly; absorbs light frontal attacks | Heavy finisher or flank |
| Lancer | Straw hat, long split coat, bladed polearm | Holds distance and telegraphs a straight thrust | Dodge sideways, then close |
| Skirmisher | Head wrap, scarf, light clothing, throwing weapons | Maintains range, circles, throws visible projectiles | Pursue or dodge the projectile |

Colors reinforce these identities but do not define them.

## Two-hand control layout

Left hand: WASD, Shift, C, Q, E, F, Space. Right hand: mouse movement, left-click, right-click.

Combat mouse movement controls the camera after a click captures it. Escape releases the mouse and pauses. Left-click attacks; right-click performs a heavy attack. F uses Musou. E addresses the ball. Q faces the ball waypoint. C holds the focused stance. Shift sprints or dodges. Golf retains its existing club and swing controls.

## Verification

Inspect front and side views at address, top, transition, impact, and finish. Check hand separation, foot drift, and blade silhouette. Exercise each enemy's different threat and counter. Measure a mixed 64-enemy fight at the same viewport and quality settings as the previous release.

## Results from the previous three-hole build

- Rebuilt 23 authored golf and combat clips at 60 samples per second.
- Golf uses the game's left-handed stance. The right foot leads; the left heel rises through the finish.
- All three heroes pass lead-foot position and orientation checks at five swing checkpoints.
- Clubhead position at impact is within 4.8 cm of the ball center. The visible ball radius is 13 cm.
- All three holes contain fairway ambush gardens: five, one, and eight respectively.
- Automated browser scenarios cover mouse capture, movement, attack chains, Musou, gamepad actions, six entrance types, hazards, saves, and three completed holes.
- A 64-enemy scene averaged 48 FPS without attacks and 46 FPS during active combat at 1440×900, Balanced quality, device pixel ratio 1, on an Apple M1 Max.

These remain authored animations on the existing game skeleton. They are not motion capture. Close-up hand and costume detail can improve further.

## Athletic motion revision

Combat now uses separate loading, hip initiation, contact, follow-through, and recovery poses. The chest stays within 0.9 radians of the pelvis. Explicit elbow and knee targets keep the joints bent in useful directions.

Musou lasts 3.3 seconds. Six cuts make one complete turn, with impacts at 0.42, 0.86, 1.30, 1.78, 2.25, and 2.82 seconds. The sequence combines diagonal, returning, rising, sweeping, and downward cuts. Each foot stays still while the other foot steps. The final pose completes the turn without reversing the animation angle.

Twin clips have independent secondary hand and blade paths. The second sword guards during preparation and counters during recovery.

The wrist targets include the measured grip center between the curled fingers. The right center is `(-0.028, 0.096, 0)`. The left center is `(0.028, 0.096, 0)`. Local Z follows the shaft. Combat limits clavicle rotation and projects the shared handle into the reach of both arms. Golf allows the clavicle to move. Runtime weapons follow the evaluated palms.

Run `python3 tools/author-combat-motion.py` to regenerate combat landmarks. This command preserves the golf landmarks. Run Blender with `tools/build-authored-motion.py` to export the clips. The export reports the largest palm target error for each clip.

Run `PLAYWRIGHT_CHANNEL=chrome node tests/browser-motion.mjs` to check all six heroes. The check measures golf grip position, the planted lead foot, and Musou support feet. It checks knee direction at 100 points through Musou. It also saves four Musou views under `/tmp/ninja-musou-*.png`.

## Three independent female weapon styles

Kaede uses a single bladed fan. Her raised guard, open free hand, lateral cuts, and wrist turns show the fan face between attacks. Ayame holds a crescent ring. Her compact guard, lower stance, crossing arcs, and circular recoveries keep the weapon close to her body. Sora uses a hooked sickle. She prepares from an asymmetric low guard, extends the hook, and draws it back toward her hip.

Each style has a separate stance loop, four light attacks, four heavy attacks, and a six-cut Musou sequence. These clips use the `Fan_`, `Ring_`, and `Sickle_` prefixes. They retain the combat hit times. The `roll` value turns each weapon around its shaft; the baker applies the same rotation to the palm. The free hand uses its own trajectory and partly open fingers.

The runtime helper `combatMotionName` selects the correct family from warrior metadata. The motion check renders four Musou phases for each woman and verifies knee direction throughout each sequence.

## Native human rig bridge

The player roster now uses six licensed Microsoft Rocketbox humans. Their native meshes, skin weights, and limb lengths remain intact. The earlier fixed palm coordinates apply only to the source mannequin.

`tools/rocketbox-rig.py` maps the native Biped bones to the game names. It aligns bone axes with anatomical child joints. The bridge transfers motion relative to each native rest pose. Hand and foot IK then restores the authored contacts. The arm chains use the upper arm and forearm. Knee and elbow pole angles come from each model's actual joint geometry.

The builder embeds common movement and golf clips with each hero’s own combat family. Runtime prefers these native clips. It does not apply the mannequin's joint transforms to the human mesh. Grip markers transfer the measured closed-finger center through the GLB coordinate conversion.

Use `MOTION_HERO=3 PLAYWRIGHT_CHANNEL=chrome node tests/browser-motion.mjs` for a single hero check. Omit `MOTION_HERO` to check the full roster. The check saves rendered poses before reporting failed contacts, so numerical results cannot hide visible defects.

Native clips start at frame zero. This keeps the authored 1.4-second golf contact and the combat impact times exact after GLB export.

For two-handed combat, the bridge moves the shared handle into both native arms' reach. Both wrist targets receive the same translation. This preserves their spacing along the shaft. The browser check measures the second palm against that shaft throughout Musou.

Native free hands follow the solved forearm orientation. They keep the authored wrist position without copying an unused weapon direction. This prevents a sharply bent wrist in relaxed guards.

## Native directional guards

Each weapon has a braced guard loop, a short impact response, and a guard-break recoil. Odachi uses a diagonal blade cover. Twin blades cross in front of the body. Naginata uses a wider, 30 cm hand spacing. The fan covers the upper body. The ring stays near the centerline. The sickle uses a compact hook guard.

Impact lowers the pelvis and lets the chest absorb force. Guard break opens the arms and turns the chest. The native bake keeps feet supported and maintains the measured grips. Runtime guard states suppress the ordinary idle overlays.

`Warrior.update` accepts `blocking`, `parry`, `guardBreak`, and `guardHitToken`. `parry` and `guardBreak` use remaining seconds. Each new hit token starts impact recoil. A rising guard-break state starts the break clip. An attack exits the guard immediately.

Run `python3 tools/author-guard-motion.py`, then Blender with `tools/build-authored-motion.py -- --guards-only`. Run Blender with `tools/build-rocketbox-warriors.py -- --guards-only` to append the native clips. The append tool preserves existing animation descriptors and binary bytes. It does not rebuild the bodies or replace earlier motion.

Run `PLAYWRIGHT_CHANNEL=chrome node tests/browser-guards.mjs` to verify all six guards, state transitions, grip spacing, foot support, and joint posture. The check saves guard, impact, and break contact sheets under `/tmp/ninja-guard-*.png`.

Guard locomotion uses four native cycles for forward, backward, and sideways travel. Each cycle has a planted support phase and a lifted recovery step. The shorter side steps retain bent knees. Runtime blends adjacent directions at the same gait phase. It scales each direction's contribution by that clip's travel speed, then sets cadence from actual movement and model scale. Zero actual speed returns to the planted guard.

Use `moveSpeed` and `moveAngle` from actual displacement when guarding. Attacks and dodges take priority over a lingering guard-break response. Run `tests/browser-guard-walk.mjs` for all six heroes in eight directions. The test also checks blocked movement, grip contact, knee direction, foot lift, and break cancellation.

Blender's `tools/build-rocketbox-warriors.py -- --guard-walk-only` appends only the four movement clips. Earlier guards, attacks, golf motion, and body data remain unchanged. Final validation measured less than 0.6 mm support drift in cardinal directions and 1.9 cm in diagonal blends. The largest two-handed grip gap was 0.018 mm.
