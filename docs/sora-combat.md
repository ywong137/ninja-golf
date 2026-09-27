Sora's movement revision adds distinct body motion to her eight regular cuts. Her descending heavies stay low through impact. Rising cuts extend from the loaded legs. Her entry steps now travel farther, with enough foot lift to clear the ground. Her Musou keeps its existing body sequence and receives the arm corrections.

The previous free-hand target stayed at almost one height while the shoulders moved. Every attack folded the left forearm into the upper arm. The revised hand follows the torso, with a lower elbow and a forward guard. A separate native constraint keeps the weapon wrist clear of the shoulder. The native solver uses Sora's actual limb lengths and calibrated palm center.

Her old attack endpoints also differed from her Ready pose. The new forward Ready pose and attack boundaries match. The blade's orientation and scale remain unchanged; the grip moves forward. The weapon fixture records that deliberate position change and preserves every golf transform.

Measurements compare independent assets from commit `137b930` with the revised native model:

| Measurement | Before | After |
| --- | ---: | ---: |
| Cleave torso lean through impact | 12.4° | 20.6° |
| Slam torso lean through impact | 12.5° | 22.4° |
| Cleave transfer across the support span | 1.9% | 23.8% |
| Slam transfer across the support span | 3.3% | 24.1% |
| Maximum free-forearm inset during attacks | 36.3 mm | 0 measured |
| Musou weapon-elbow peak speed | 50.7 m/s | 8.7 m/s |

Transfer measures the horizontal hip projection between the ankles, not physical center of mass. The revised cleave and slam keep the pelvis about 14.5 cm and 16.8 cm below Ready through impact. All nine attacks pass both-arm skin checks at 240 Hz, including entry and recovery. The checks cover central arm surfaces and forearm/torso crossings. They do not certify every shoulder, clothing, or hand intersection.

The export fix includes the exact authored endpoint. Previously, rounding the sample count and truncating fractional NLA frames could stop a clip before its final guard pose. The exporter now evaluates that pose on the next complete sample. GLB finalization places it at the exact authored time. It rejects an input that lacks the endpoint. Both full exports and animation-only updates use this correction.

Ronin now steps into a much wider base for all eight regular attacks. Light cuts span 64–70 cm; heavy cuts span 84–90 cm sideways and 50 cm fore/aft. The rear foot opens before the lead step. Both feet hold through contact, then recover in sequence. Heavy impacts lower the native hip midpoint to 63–66 cm. These are native model measurements; runtime scale adds 10%.

The overhead cleave also keeps its shared handle ahead of the shoulders. Both grip positions move together, preserving their spacing and blade direction. With the wider body motion, peak elbow speed falls from 47.5 to 9.4 m/s. Both central forearms remain clear through the loaded windup, cut, and follow-through. The Guard enemy receives the shared cleave correction. Ronin's Ready pose and Musou body sequence remain separate work.

Native support drift stays below 0.9 mm across Ronin's eight revised attacks. Leg reach stays below 93.6%, with bent knees at each impact. Front and side game-controller captures cover standing and moving attacks. The body meshes, skin weights, textures, and unrelated native clips remain exact in the GLB files. Garment color maps now receive separate runtime variants.

The women now carry three ordinary sword types: Kaede's straight jian, Ayame's curved dao, and Sora's short wakizashi. Their existing independent motion families keep their legacy internal clip names. Weapon geometry and combat style now have separate metadata. The swords retain the calibrated palm attachment. Sora's attacks no longer pull enemies inward as a sickle would.

The carry transition now measures wrist twist at the full destination orientation. Previously, measuring it at the blended orientation could select a different half-turn at different frame rates. Ayame's longer sabre uses a 260 ms heavy-entry blend that ends before contact. Golf trajectories and attack impact poses remain exact.

Validation passed 237 unit tests before the separate garment tests, followed by five material tests and 25 focused final checks. Browser checks covered 385 grip checkpoints, 15,088 blade-frame samples, 96 moving-attack scenarios, all-hero ground contact, and 90 travel transitions across 60/120/240 Hz. Muted Chrome captures verify the revised swords, clothing, and attacks.

The final moving-Sora benchmark averaged 50.8 FPS with 64 enemies on an M1 Max using Metal. It used a 1440×900 CSS viewport, device scale 2, and adaptive render ratio 1.5. The 95th-percentile frame time was 33.4 ms. This is one local crowded-combat measurement, not a performance guarantee for every machine or course.

The wider roster audit still finds defects. The next priorities are the Shinobi's heavy sweep, the Monk's Musou arm reversal, and Ayame's remaining arm paths. This revision does not establish complete roster realism or AAA completion.
