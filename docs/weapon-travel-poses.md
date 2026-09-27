# Weapon travel poses

Travel uses native running clips for the legs, pelvis, torso, and free arm. `TravelPose` adjusts only the arms that carry weapons. Each hero has separate targets relative to the shoulder. Targets follow native arm length.

- Ronin carries the odachi beside his hip, with the blade trailing behind him.
- Shinobi carries both blades low, with opposite small arm movements.
- Monk carries the naginata upright and outside his shoulder.
- Kaede carries the fan below her waist, outside her face and legs.
- Ayame carries the ring low and outside her hip.
- Sora keeps the sickle close to her lower flank.

The solver keeps native bone lengths. It bends each elbow toward a stable pole and limits wrist bend to 45 degrees. Palm offsets set the wrist target. The evaluated palm and shaft axis remain the weapon attachment authority.

The layer enters travel over 120 milliseconds. It leaves for light attacks in 120 milliseconds. Heavy attacks take 220 milliseconds, and guard takes 300 milliseconds. Golf immediately restores the original native pose and club path. During that transition, the solver interpolates the palm position and shaft direction together. Weapons follow the evaluated hand direction. Authored combat directions resume when the layer reaches zero weight. The original motion clips, foot solver, and running cadence stay unchanged.

Odachi and naginata blade widths decrease by 35 percent. Twin blades keep their original width. Ordinary enemy blades keep all original dimensions. The steel thickness cap decreases from 14 to 9 millimeters before the existing taper. Lengths, curves, grip dimensions, and tip metadata stay unchanged.

## Verification

`browser-travel-pose.mjs` checks two seconds of jogging and sprinting for all six heroes. It captures sixteen roster frames. It also checks transitions into golf, guard, attack, and dodge. Handle-to-palm error remains below 0.1 millimeter in the sampled frames. Shaft alignment error stays below 0.01 degrees. Wrist bend stays within 45.01 degrees.

The real-game bunker crossing was inspected across six frames. Ronin's face remains clear, and the blade trails beside his body. The existing golf/combat and directional locomotion browser checks passed. Unit tests verify unchanged native arm lengths, exact pose restoration, blade reach, thickness, and size contrast.

`browser-travel-transitions.mjs` compares each early golf frame against an actor without the travel layer. Address and swing club-head errors are exactly zero, including contact. Light and heavy weapon tips also match the control exactly from the first gameplay hit. This test uses the actual attack definitions. Shaft alignment error stays below 0.01 degrees while the travel layer applies.

Guard transitions now have a maximum tip step of 24.2 centimeters per 60 Hz frame. The previous mixed-rotation approach caused a 2.84-meter flip. Guard captures at frames 0, 3, 6, 9, 12, 15, and 18 show a continuous lift into the held pose. The attack continuity checks compare added movement against the original fast attack motion; they do not misclassify the original contact acceleration as a new transition defect.
