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

## Results from this build

- Rebuilt 23 authored golf and combat clips at 60 samples per second.
- Golf uses the game's left-handed stance. The right foot leads; the left heel rises through the finish.
- All three heroes pass lead-foot position and orientation checks at five swing checkpoints.
- Clubhead position at impact is within 4.8 cm of the ball center. The visible ball radius is 13 cm.
- All three holes contain fairway ambush gardens: five, one, and eight respectively.
- Automated browser scenarios cover mouse capture, movement, attack chains, Musou, gamepad actions, six entrance types, hazards, saves, and three completed holes.
- A 64-enemy scene averaged 48 FPS without attacks and 46 FPS during active combat at 1440×900, Balanced quality, device pixel ratio 1, on an Apple M1 Max.

These remain authored animations on the existing game skeleton. They are not motion capture. Close-up hand and costume detail can improve further.
