# Golf equipment and contact audit

Status: diagnostic only. No public asset, animation, runtime, solver, or test changed.

The current endpoint convention hides the candidate clubheads inside the ball. Changing the ball mesh alone leaves the clubhead above the ball.

## Measured current state

The game uses metres. `YARD=1.09361` converts its distances to yards.

- The rendered ball and simulation radius are both 0.13 m. The ball diameter is 260 mm.
- The USGA minimum diameter is 42.67 mm. Use 0.021335 m as the proposed visual radius.
- The current ball is 6.09 times that diameter.
- The actor scale is 1.1 during play. Do not apply that scale to a world-space ball.
- The shaft endpoint is `(0, .118, .945)` in the actor frame. `placePlayer` offsets the actor by 1.04 m.
- On flat ground, the endpoint becomes `(0, .1298, -.0005)` relative to the ball's horizontal origin.
- The ball center is `(0, .13, 0)`. Their separation is only 0.54 mm.
- The current fixed palm-to-endpoint length is 0.954939 m locally, or 1.050433 m in play.
- The grip extends 66 mm beyond its primary palm station after actor scale.
- All 3,726 vertices of the proposed driver head fit inside the existing ball at address and swing contact.
- The proposed driver's heel-to-toe width is about 132 mm in play.
- Its toe axis points 49–50 degrees above horizontal. Its sole does not lie along the ground.
- The impact shaft rises only 39.56–41.04 degrees above the ground toward the hands.

The minimum size is verified at the [USGA equipment rule](https://www.usga.org/equipment-standards/equipment-rules-2019/equipment-rules/part-4-rule-4.html).
The rule has no maximum diameter. This is a visual-scale recommendation, not a claim that the existing ball violates that size rule.

## Address and impact differ

All six current `Golf_Address` and `Golf_Swing` contact endpoints coincide within numerical precision.
Their complete club frames differ by 4.71–10.45 degrees. Equal endpoints do not imply equal face contact.

The putt uses a different pose. Its contact occurs at `22/30` seconds, instead of the swing's 1.4 seconds.

| Hero | Swing endpoint height | Putt endpoint height | Putt horizontal displacement |
| --- | ---: | ---: | ---: |
| Ronin | 129.80 mm | 129.80 mm | approximately 0.50 mm |
| Shinobi | 129.80 mm | 129.80 mm | approximately 0.50 mm |
| Monk | 129.80 mm | 137.96 mm | 4.09 mm |
| Ace | 129.80 mm | 142.00 mm | 4.34 mm |
| Hustler | 129.80 mm | 141.26 mm | 4.40 mm |
| Closer | 129.80 mm | 140.42 mm | 4.66 mm |

These values use current public clips and actual runtime hand fitting. They do not describe the golf agent's unfinished paired-hand candidates.

The existing contact test measures the shaft endpoint. It does not test a point on the clubface.
The old runtime head also has a separate local X offset of 47 mm. The endpoint test does not include it.

## Required coordinate contract

Keep the current golf hand frames independent from sword frames. Do not move either grip to repair head placement.

Each club needs these distinct measurements:

1. The primary and secondary palm stations on the grip.
2. The shaft socket position, measured from the primary palm.
3. One fixed head-to-shaft rotation, including lie and loft.
4. A contact point on the finite clubface.
5. The outward normal at that contact point.
6. The sole surface and its ground clearance.

Do not call the hosel origin the ball contact point. Do not change the head rotation independently during a swing.

Use `+Y` down the shaft toward the head. Give the head its own authored basis and socket.
The head's toe and sole need not be perpendicular to the shaft. The current templates assume that relationship.

At contact, calculate:

```text
headSocket = primaryPalm + shaftFrame * (0, shaftLength, 0)
facePoint = headSocket + shaftFrame * headMount * localFacePoint
faceNormal = shaftFrame * headMount * localFaceNormal
ballCenter = facePoint + physicalRadius * faceNormal
```

Apply actor scale once to positions and lengths. Keep the world-space physical ball radius unchanged.
Use the actual closest triangle on the face to verify tangency. An infinite plane can admit a contact outside the head.

At address, leave a small deliberate gap behind the ball. At impact, close that gap.
The current equal-endpoint convention does not author this difference.

## Isolated bridge prototype

The prototype preserves every hand and bone pose. It changes only the visible shaft length, fixed head mounting, and horizontal actor placement.
It sets the head's sole clearance to 2 mm. It uses a 42.67 mm ball, with a 20 mm tee for the driver.
It measures actual head triangles after transformation.

For the Ronin, it requires:

| Club | Added visible shaft | Actor shift opposite shot (+X) | Actor shift away from ball (-Z) | Nearest surface gap |
| --- | ---: | ---: | ---: | ---: |
| Driver | 121.65 mm | +32.58 mm | -139.43 mm | -0.41 mm |
| 3 wood | 127.59 mm | +35.10 mm | -136.64 mm | +2.33 mm |
| 5 iron | 152.41 mm | +33.10 mm | -163.68 mm | +0.03 mm |
| Sand wedge | 162.18 mm | +52.26 mm | -171.03 mm | +11.40 mm |
| Putter | 166.31 mm | +28.49 mm | -162.34 mm | -0.74 mm |

The same bridge needs 3.5–18.6 mm more shaft on the Ace, depending on the pose and club.
Negative gaps mean slight ball/surface penetration. Positive gaps mean separation.

This is not ready for production. The wedge misses its finite face by 11.4 mm despite satisfying the proposed infinite plane.
The driver and putter need submillimetre face-marker adjustments. The putter becomes approximately 1.28 m long, including the grip extension.
The bridge also keeps the current shallow shaft angle. It does not establish a realistic shaft lie.

The render shows the current failure and the useful part of the bridge:

![Equipment comparison](/tmp/ninja-golf-equipment-comparison.png)

## Recommended migration

First, separate the visual ball from the simulation position. Keep the existing 0.13 m collision radius explicitly named as a temporary gameplay proxy.
Use a child mesh with radius 0.021335 m. Offset its center downward by 0.108665 m from the existing simulation center.
Keep the same offset in flight. Do not introduce an abrupt size or center change at launch.
Use the existing beacon, outline, or trail for visibility instead of enlarging the physical ball.
On a tee, add a separate visible lift and account for it in the contact pose.

This preserves the current trajectories, collision outcomes, scoring, and saved positions. It does not make the collision sphere physically accurate.
Building impacts can still occur before the smaller visible surface reaches the building. This temporary discrepancy must remain explicit.
Route impact particles, the visible shadow, and the trail start to the visual center. Gameplay targeting can retain the simulation position.

Second, finish the club art with explicit socket and face markers. Keep dimensions in metres.
Choose plausible lengths and lie angles per club category. Do not copy the driver's length into the putter.
Fit the golfer's address and impact poses around those dimensions. Preserve fitted palm/finger transforms during that fit.
Derive the horizontal player placement from the chosen face contact. Recheck feet and terrain height after placement changes.

Third, validate all eight club selections at address, contact, and finish. Include every hero and at least one sloped lie.
Check the finite face, ball tangency, shaft connection, both palms, the sole, and head/limb clearance.
The separate putt must use its own actual contact frame. Do not derive its head roll only from `Golf_Swing`.

Finally, migrate simulation radius deliberately if desired. Do not change `BALL_RADIUS` alone.
`building-ball.js` hardcodes 0.13 m in sphere sweeps and relief. Ground, water, bounce, preview, and saved positions also need review.
The visible cup radius is 0.22 m. The capture radius is 0.32 m. Preserve these gameplay assists unless the design explicitly changes them.

## Artifacts and reproduction

- `/tmp/ninja-audit-golf-equipment.mjs`: actual runtime geometry audit, without a renderer.
- `/tmp/ninja-golf-equipment-audit.json`: all six heroes and the relevant address/contact poses.
- `/tmp/ninja-golf-equipment-prototype.mjs`: pure candidate factory with explicit geometry measurements.
- `/tmp/ninja-golf-equipment-prototype.json`: proposed dimensions and finite-surface errors for Ronin and Ace.
- `/tmp/ninja-render-golf-equipment.mjs`: muted isolated comparison capture.
- `/tmp/ninja-golf-equipment-size.txt`: verified official size passage.

Run the audit with the local Vite server available on port 5173:

```sh
node /tmp/ninja-audit-golf-equipment.mjs
node /tmp/ninja-render-golf-equipment.mjs
```

The render requires a coordinated GPU slot. Both scripts use isolated, muted Chrome processes.
The prototype imports `tools/art-candidates/golf-club.js`. It does not import or modify the production club mesh.
